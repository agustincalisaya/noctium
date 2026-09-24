import { randomInt, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { hashPassword } from "@/lib/password";
import { emailSenderConsola } from "@/lib/email";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico, getParametroTexto } from "@/server/shared/parametros";
import { crearCuentaConCredenciales } from "@/server/usuarios/usuario.service";
import type {
  ResultadoAutorregistro,
  ResultadoConfirmacionAutorregistro,
  ResultadoReenvioCodigo,
} from "@/types/alumno.types";
import type { AutorregistroAlumnoInput } from "./alumno.schema";

const MENSAJES = {
  CUENTA_YA_EXISTE: "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada.",
  DNI_DUPLICADO: "Ya existe un alumno registrado con ese DNI",
  RATE_LIMIT_EXCEDIDO: "Hiciste demasiados intentos de registro. Probá de nuevo más tarde.",
  SOLICITUD_NO_ENCONTRADA: "No encontramos esa solicitud de registro. Volvé a intentar el registro.",
  CODIGO_INVALIDO: "El código ingresado no es válido.",
  CODIGO_VENCIDO: "El código venció. Solicitá uno nuevo.",
  INTENTOS_AGOTADOS: "Superaste el máximo de intentos. Solicitá un código nuevo.",
  REENVIO_MUY_PRONTO: "Esperá un momento antes de pedir otro código.",
} as const;

/**
 * Archivo separado de `alumno.service.ts` (566 líneas antes de esta HU) —
 * mismo criterio real ya en uso en `src/server/sesion/` (`autenticacion.service.ts`
 * + `renovacion.service.ts`, separados por responsabilidad, ninguno llamado
 * `sesion.service.ts`). El autorregistro es un flujo público de 4 ramas sin
 * relación funcional con la edición de fichas ya autenticadas.
 */

// ------------------------------------------------------------
// Secreto de HMAC del código OTP (RULES.md Regla N.° 9): validación lazy,
// mismo patrón que getClaveHS256() de src/auth.ts — no revienta `next build`
// (que importa este árbol de módulos para recolectar metadata de rutas),
// solo al primer intento real de generar/verificar un código.
// ------------------------------------------------------------
let claveOtpCache: string | undefined;
function getClaveOtp(): string {
  if (claveOtpCache) return claveOtpCache;
  const secret = process.env.CODIGO_OTP_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno CODIGO_OTP_SECRET (docs/RULES.md Regla N.° 9)");
  }
  claveOtpCache = secret;
  return claveOtpCache;
}

/** 6 dígitos con RNG criptográficamente seguro (spec_modulo_B.md §3.6). */
function generarCodigoOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Solo se persiste el HMAC-SHA256 — nunca el código en texto plano. */
function hashearCodigoOtp(codigo: string): string {
  return createHmac("sha256", getClaveOtp()).update(codigo).digest("hex");
}

/**
 * Comparación en tiempo constante (spec_modulo_B.md §3.6) — nunca `===`.
 * `timingSafeEqual` exige buffers de igual longitud o lanza; el guard de
 * longitud evita ese crash y lo trata como "no coincide", no como error.
 */
function codigoCoincide(codigoIngresado: string, hashAlmacenado: string): boolean {
  const bufferIngresado = Buffer.from(hashearCodigoOtp(codigoIngresado), "hex");
  const bufferAlmacenado = Buffer.from(hashAlmacenado, "hex");
  if (bufferIngresado.length !== bufferAlmacenado.length) return false;
  return timingSafeEqual(bufferIngresado, bufferAlmacenado);
}

/** "j***@gmail.com" (spec_modulo_B.md §2.6) — nunca el email completo. */
function enmascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  const visible = local.slice(0, 1) || "*";
  return `${visible}${"*".repeat(Math.max(local.length - 1, 1))}@${dominio}`;
}

// ------------------------------------------------------------
// Rate limiting de registro (IntentoRegistro) — mismo patrón que
// verificarRateLimit()/registrarIntentoFallido() de
// src/server/sesion/autenticacion.service.ts, pero contra IntentoRegistro
// (solo IP, sin email) y contando TODO intento que pasa el chequeo, no solo
// los fallidos (decisión confirmada: "máximo N registros por IP por hora"
// literal, no "máximo N fallos" como en login).
// ------------------------------------------------------------
async function verificarRateLimitRegistro(ip: string): Promise<void> {
  const maxPorHora = await getParametroNumerico("registro_max_por_ip_hora", 5);
  const intentosRecientes = await prisma.intentoRegistro.count({
    where: {
      ipIntentoRegistro: ip,
      creadoEnIntentoRegistro: { gte: new Date(Date.now() - 60 * 60_000) },
    },
  });
  if (intentosRecientes >= maxPorHora) {
    throw new ServiceError("RATE_LIMIT_EXCEDIDO", MENSAJES.RATE_LIMIT_EXCEDIDO);
  }
}

async function registrarIntentoRegistro(ip: string): Promise<void> {
  await prisma.intentoRegistro.create({ data: { ipIntentoRegistro: ip } });
}

/**
 * Eventos de seguridad (HU-B-08 §4.8): `EventoSeguridad` es el mecanismo
 * real ya en uso (confirmado en `autenticacion.service.ts`, no un event
 * bus) — síncrono, escrito después del `COMMIT` de la transacción de
 * negocio (Regla N.° 2 de `docs/RULES.md`), nunca dentro de ella.
 *
 * Mapeo de payload confirmado (opción A): `EventoSeguridad` solo tiene
 * `usuarioId`/`emailEvento`/`ipEvento` como columnas — `alumno_id`,
 * `solicitud_id`, `dni` y `via` que pide la spec NO se graban ahí (quedan
 * recuperables vía `Alumno`/`SolicitudAutorregistro` si hiciera falta
 * reconstruir el caso). Ver sección 8 de la task para el detalle completo
 * de esta decisión.
 */
async function registrarEventoAutorregistro(params: {
  tipo: "REGISTRO_CUENTA" | "CODIGO_VERIFICACION_GENERADO" | "AUTORREGISTRO_DERIVADO_MESA_ENTRADA";
  usuarioId: string | null;
  email: string | null;
  ip: string;
}): Promise<void> {
  await prisma.eventoSeguridad.create({
    data: {
      tipoEvento: params.tipo,
      usuarioId: params.usuarioId,
      emailEvento: params.email,
      ipEvento: params.ip,
    },
  });
}

/**
 * Autorregistro del alumno (HU-B-08, spec_modulo_B.md §2.6). 4 ramas según
 * el estado de la ficha por DNI — orden y comportamiento exacto conforme a
 * `docs/tasks/Sprint 1/HU-B-08.md` §4.2, con las ambigüedades ya resueltas
 * (sección 8 de la task): rama (b) vs (d) se decide comparando el email
 * tipeado (case-insensitive) contra `Alumno.emailAlumno` — ese email tipeado
 * es solo un gate de legitimidad, el código siempre se manda al email de
 * contacto ya registrado, nunca al tipeado.
 */
export async function iniciarAutorregistro(
  input: AutorregistroAlumnoInput,
  ip: string,
): Promise<ResultadoAutorregistro> {
  await verificarRateLimitRegistro(ip);
  await registrarIntentoRegistro(ip);

  // Paso 2 (spec): el email tipeado no puede pertenecer a NINGUNA cuenta ya
  // existente, sin importar todavía si hay o no una ficha por DNI.
  const cuentaExistente = await prisma.usuario.findFirst({
    where: { emailUsuario: { equals: input.email, mode: "insensitive" } },
    select: { idUsuario: true },
  });
  if (cuentaExistente) {
    throw new ServiceError("CUENTA_YA_EXISTE", MENSAJES.CUENTA_YA_EXISTE);
  }

  const alumno = await prisma.alumno.findFirst({
    where: { dniAlumno: input.dni },
    select: { idAlumno: true, usuarioId: true, emailAlumno: true },
  });

  // Rama (a): no existe ninguna ficha — alta directa de Alumno + Usuario.
  if (!alumno) {
    const passwordHash = await hashPassword(input.password);
    const terminosVersion = await getParametroTexto("terminos_version_vigente", "1.0");

    let usuario: { id: string };
    try {
      usuario = await prisma.$transaction(async (tx) => {
        const nuevoUsuario = await crearCuentaConCredenciales(
          { email: input.email, passwordHash, rol: "ALUMNO" },
          tx,
        );
        await tx.alumno.create({
          data: {
            nombreAlumno: input.nombre,
            apellidoAlumno: input.apellido,
            nombreNormalizadoAlumno: normalizarTexto(input.nombre),
            apellidoNormalizadoAlumno: normalizarTexto(input.apellido),
            dniAlumno: input.dni,
            fechaNacimientoAlumno: input.fecha_nacimiento,
            generoAlumno: input.genero ?? null,
            telefonoAlumno: input.telefono ?? null,
            emailAlumno: input.email,
            activoAlumno: true,
            usuarioId: nuevoUsuario.id,
            terminosAceptadosEn: new Date(),
            versionTerminosAceptada: terminosVersion,
          },
        });
        return nuevoUsuario;
      });
    } catch (error) {
      // Defensa en profundidad (mismo criterio que crearAlumno() de
      // HU-B-01): entre los chequeos de arriba y este create() alguien más
      // pudo haber registrado el mismo DNI o el mismo email — más relevante
      // acá que en HU-B-01 porque este es un endpoint público sin sesión.
      // El constraint único es la garantía real (Regla N.° 7 de
      // docs/RULES.md); esto solo traduce el P2002 crudo a un error limpio.
      // La transacción toca dos constraints únicos distintos (emailUsuario
      // vía crearCuentaConCredenciales(), dniAlumno vía alumno.create()) —
      // se distingue por meta.target para no mapear mal el que no fue.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.target;
        const targets = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
        if (targets.some((campo) => campo.toLowerCase().includes("dni"))) {
          throw new ServiceError("DNI_DUPLICADO", MENSAJES.DNI_DUPLICADO);
        }
        throw new ServiceError("CUENTA_YA_EXISTE", MENSAJES.CUENTA_YA_EXISTE);
      }
      throw error;
    }

    await registrarEventoAutorregistro({
      tipo: "REGISTRO_CUENTA",
      usuarioId: usuario.id,
      email: input.email,
      ip,
    });

    return { via: "DIRECTO", email: input.email };
  }

  // Rama (c): la ficha ya tiene cuenta vinculada — mismo error genérico que
  // el paso 2, no distinguible desde el cliente.
  if (alumno.usuarioId) {
    throw new ServiceError("CUENTA_YA_EXISTE", MENSAJES.CUENTA_YA_EXISTE);
  }

  // Ramas (b) vs (d): decisión confirmada (sección 8 de la task) — se
  // deriva a mesa de entrada si no hay email de contacto registrado, o si
  // no coincide (case-insensitive) con el tipeado.
  const emailContacto = alumno.emailAlumno;
  const emailCoincide = emailContacto !== null && emailContacto.toLowerCase() === input.email.toLowerCase();

  if (!emailCoincide) {
    await registrarEventoAutorregistro({
      tipo: "AUTORREGISTRO_DERIVADO_MESA_ENTRADA",
      usuarioId: null,
      email: null,
      ip,
    });
    return { via: "DERIVADO_MESA_ENTRADA" };
  }

  // Rama (b): ficha existente sin cuenta, email verificable — inicia OTP.
  const passwordHash = await hashPassword(input.password);
  const expiracionMinutos = await getParametroNumerico("codigo_verificacion_expiracion_minutos", 10);
  const codigo = generarCodigoOtp();
  const codigoHash = hashearCodigoOtp(codigo);

  const solicitud = await prisma.$transaction(async (tx) => {
    // Invalida cualquier solicitud previa sin confirmar del mismo alumno —
    // mismo criterio que aplicará el reenvío a la solicitud vigente, pero
    // acá sobre un intento de autorregistro anterior y abandonado (ej. el
    // alumno vuelve a completar el formulario días después). Sin esto,
    // quedarían dos códigos "activos" en simultáneo para la misma ficha.
    const solicitudAnterior = await tx.solicitudAutorregistro.findFirst({
      where: { alumnoId: alumno.idAlumno, confirmadaEn: null },
      select: { codigoId: true },
    });
    if (solicitudAnterior) {
      await tx.codigoVerificacion.update({
        where: { idCodigo: solicitudAnterior.codigoId },
        data: { invalidadoEn: new Date() },
      });
    }

    const codigoVerificacion = await tx.codigoVerificacion.create({
      data: {
        alumnoId: alumno.idAlumno,
        codigoHash,
        expiraEn: new Date(Date.now() + expiracionMinutos * 60_000),
      },
    });
    return tx.solicitudAutorregistro.create({
      data: {
        alumnoId: alumno.idAlumno,
        passwordHash,
        emailDestino: emailContacto,
        codigoId: codigoVerificacion.idCodigo,
      },
    });
  });

  // Envío después del COMMIT, nunca dentro de la transacción.
  await emailSenderConsola.enviar(
    emailContacto,
    "Tu código de verificación de Noctium",
    `Tu código de verificación es: ${codigo}`,
  );

  await registrarEventoAutorregistro({
    tipo: "CODIGO_VERIFICACION_GENERADO",
    usuarioId: null,
    email: emailContacto,
    ip,
  });

  return {
    via: "VERIFICACION_REQUERIDA",
    solicitud_id: solicitud.idSolicitud,
    email_enmascarado: enmascararEmail(emailContacto),
  };
}

/**
 * Confirmación del código de autorregistro (HU-B-08, rama b, `spec_modulo_B.md`
 * §2.6 paso 2). `ip` agregada a la firma respecto al literal de la task
 * (decisión confirmada, sección 8): `EventoSeguridad.ipEvento` es `String`
 * no nullable, así que hace falta para poder emitir `REGISTRO_CUENTA` al
 * confirmar.
 */
export async function confirmarCodigoAutorregistro(
  solicitudId: string,
  codigo: string,
  ip: string,
): Promise<ResultadoConfirmacionAutorregistro> {
  const solicitud = await prisma.solicitudAutorregistro.findUnique({
    where: { idSolicitud: solicitudId },
    include: { codigo: true },
  });
  // Una solicitud ya confirmada, o con su código invalidado (ej. superseded
  // por un iniciarAutorregistro() nuevo del mismo alumno, Fix 2), se trata
  // como "no encontrada" — de un solo uso, no queda como alternativa válida
  // "por las dudas" (spec_modulo_B.md §3.6). Mismo criterio que ya aplica
  // reenviarCodigoAutorregistro() a un código invalidado: no es "el código
  // que ingresaste está mal", es "esta solicitud ya no es válida, empezá de
  // nuevo" — corregido para ser consistente entre ambas funciones.
  if (!solicitud || solicitud.confirmadaEn || solicitud.codigo.invalidadoEn) {
    throw new ServiceError("SOLICITUD_NO_ENCONTRADA", MENSAJES.SOLICITUD_NO_ENCONTRADA);
  }

  const { codigo: codigoVerificacion } = solicitud;

  if (codigoVerificacion.expiraEn <= new Date()) {
    throw new ServiceError("CODIGO_VENCIDO", MENSAJES.CODIGO_VENCIDO);
  }
  const maxIntentos = await getParametroNumerico("codigo_verificacion_max_intentos", 5);
  if (codigoVerificacion.intentos >= maxIntentos) {
    throw new ServiceError("INTENTOS_AGOTADOS", MENSAJES.INTENTOS_AGOTADOS);
  }

  if (!codigoCoincide(codigo, codigoVerificacion.codigoHash)) {
    // Precondiciones ya en orden pero el código no matchea: decrementa
    // intentos restantes (spec_modulo_B.md §2.6 paso 2), sin revelar cuál
    // parte del código estuvo mal.
    await prisma.codigoVerificacion.update({
      where: { idCodigo: codigoVerificacion.idCodigo },
      data: { intentos: { increment: 1 } },
    });
    throw new ServiceError("CODIGO_INVALIDO", MENSAJES.CODIGO_INVALIDO);
  }

  const terminosVersion = await getParametroTexto("terminos_version_vigente", "1.0");

  const resultado = await prisma.$transaction(async (tx) => {
    // emailDestino: el email de contacto que estaba vigente cuando se
    // GENERÓ el código (congelado en SolicitudAutorregistro), no un fetch
    // fresco de Alumno.emailAlumno — si el email cambió entre que se generó
    // el código y que se confirma (HU-B-06 lo permite mientras usuarioId
    // siga null), la cuenta se crea con el email al que efectivamente se
    // mandó y confirmó el código.
    const usuario = await crearCuentaConCredenciales(
      { email: solicitud.emailDestino, passwordHash: solicitud.passwordHash, rol: "ALUMNO" },
      tx,
    );
    await tx.alumno.update({
      where: { idAlumno: solicitud.alumnoId },
      data: {
        usuarioId: usuario.id,
        terminosAceptadosEn: new Date(),
        versionTerminosAceptada: terminosVersion,
      },
    });
    await tx.solicitudAutorregistro.update({
      where: { idSolicitud: solicitudId },
      data: { confirmadaEn: new Date() },
    });
    await tx.codigoVerificacion.update({
      where: { idCodigo: codigoVerificacion.idCodigo },
      data: { invalidadoEn: new Date() },
    });
    return { usuarioId: usuario.id, email: solicitud.emailDestino };
  });

  await registrarEventoAutorregistro({
    tipo: "REGISTRO_CUENTA",
    usuarioId: resultado.usuarioId,
    email: resultado.email,
    ip,
  });

  return { alumno_id: solicitud.alumnoId, usuario_id: resultado.usuarioId, email: resultado.email };
}

/**
 * Rate limit de reenvío (HU-B-08 §4.4): espera mínima entre reenvíos
 * consecutivos y máximo de reenvíos por hora. `ReenvioCodigo` es la tabla
 * dedicada para el segundo chequeo — mismo patrón ya usado en el repo para
 * rate limiting (`IntentoLoginFallido`, `IntentoRegistro`): `CodigoVerificacion`
 * sola no alcanza porque el reenvío sobrescribe sus campos en el lugar, sin
 * dejar historial.
 */
async function verificarRateLimitReenvio(codigoId: string, ultimoEnvioEn: Date): Promise<void> {
  const esperaSegundos = await getParametroNumerico("reenvio_codigo_espera_segundos", 60);
  const segundosDesdeUltimoEnvio = (Date.now() - ultimoEnvioEn.getTime()) / 1000;
  if (segundosDesdeUltimoEnvio < esperaSegundos) {
    throw new ServiceError("REENVIO_MUY_PRONTO", MENSAJES.REENVIO_MUY_PRONTO);
  }

  const maxPorHora = await getParametroNumerico("reenvio_codigo_max_por_hora", 3);
  const reenviosEnUltimaHora = await prisma.reenvioCodigo.count({
    where: { codigoId, creadoEn: { gte: new Date(Date.now() - 60 * 60_000) } },
  });
  if (reenviosEnUltimaHora >= maxPorHora) {
    throw new ServiceError("RATE_LIMIT_EXCEDIDO", MENSAJES.RATE_LIMIT_EXCEDIDO);
  }
}

/**
 * Reenvío de código de autorregistro (HU-B-08 §4.4). Sobrescribe
 * `codigoHash`/`expiraEn` de la MISMA fila de `CodigoVerificacion` (no crea
 * una nueva — la relación 1:1 con `SolicitudAutorregistro` se mantiene) y
 * resetea `intentos` a 0: un código nuevo merece un presupuesto de intentos
 * nuevo. Envío del email después del `COMMIT`, nunca dentro de la
 * transacción — mismo criterio que `iniciarAutorregistro()`.
 *
 * Chequeo agregado más allá del comportamiento descripto (no pedido
 * literalmente, pero necesario para que el Fix 2 de `iniciarAutorregistro()`
 * cumpla su propósito): si el código ya está `invalidadoEn` — por ejemplo,
 * porque el alumno arrancó un autorregistro nuevo que invalidó esta
 * solicitud vieja — se trata igual que "no encontrada". Si no,
 * `reenviarCodigoAutorregistro()` podría resucitar una solicitud que
 * `iniciarAutorregistro()` ya había dado por muerta.
 */
export async function reenviarCodigoAutorregistro(
  solicitudId: string,
  ip: string,
): Promise<ResultadoReenvioCodigo> {
  const solicitud = await prisma.solicitudAutorregistro.findUnique({
    where: { idSolicitud: solicitudId },
    include: {
      codigo: { include: { reenvios: { orderBy: { creadoEn: "desc" }, take: 1 } } },
    },
  });
  if (!solicitud || solicitud.confirmadaEn || solicitud.codigo.invalidadoEn) {
    throw new ServiceError("SOLICITUD_NO_ENCONTRADA", MENSAJES.SOLICITUD_NO_ENCONTRADA);
  }

  const { codigo: codigoVerificacion } = solicitud;
  // Sin reenvíos todavía: la referencia de "último envío" es la creación
  // del código original (rama b de iniciarAutorregistro()).
  const ultimoEnvioEn = codigoVerificacion.reenvios[0]?.creadoEn ?? codigoVerificacion.creadoEn;

  await verificarRateLimitReenvio(codigoVerificacion.idCodigo, ultimoEnvioEn);

  const expiracionMinutos = await getParametroNumerico("codigo_verificacion_expiracion_minutos", 10);
  const codigo = generarCodigoOtp();
  const codigoHash = hashearCodigoOtp(codigo);

  await prisma.$transaction(async (tx) => {
    await tx.codigoVerificacion.update({
      where: { idCodigo: codigoVerificacion.idCodigo },
      data: {
        codigoHash,
        expiraEn: new Date(Date.now() + expiracionMinutos * 60_000),
        intentos: 0,
      },
    });
    await tx.reenvioCodigo.create({ data: { codigoId: codigoVerificacion.idCodigo } });
  });

  // emailDestino, no un fetch fresco de Alumno.emailAlumno — mismo criterio
  // que confirmarCodigoAutorregistro() (Fix 1): se reenvía al mismo destino
  // al que se mandó el código original.
  await emailSenderConsola.enviar(
    solicitud.emailDestino,
    "Tu código de verificación de Noctium",
    `Tu código de verificación es: ${codigo}`,
  );

  await registrarEventoAutorregistro({
    tipo: "CODIGO_VERIFICACION_GENERADO",
    usuarioId: null,
    email: solicitud.emailDestino,
    ip,
  });

  return { email_enmascarado: enmascararEmail(solicitud.emailDestino) };
}
