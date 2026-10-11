import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ErrorDeDominio, esErrorDeDominio } from "@/server/shared/error-dominio";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { bloquear } from "@/server/shared/bloquear";
import type { ActorDominio } from "@/server/shared/historial";
import { listarHistorialEstados, registrarCambioEstado } from "@/server/shared/historial-estados";
import { usuarioRegistroOperaciones } from "@/server/shared/actividad-usuario";
import { cajaAbiertaDe } from "@/server/pagos/caja.publico";
import {
  cambiarEmailCuenta,
  crearCuentaParaFicha,
  desactivarCuenta,
  obtenerResumenCuenta,
  reactivarCuenta,
  verificarEmailNoAsociadoAOtraCuenta,
} from "@/server/usuarios/cuenta.service";
import { construirFiltroBusquedaPersonal } from "@/server/personal/personal.busqueda";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import {
  POR_PAGINA_PERSONAL,
  type AltaIntegranteInput,
  type DesactivarIntegranteInput,
  type ListarPersonalQuery,
  type ModificarIntegranteInput,
  type ReactivarIntegranteInput,
} from "@/server/personal/personal.schema";
import type {
  DetalleIntegrante,
  DisponibilidadIntegrante,
  EntradaHistorialIntegrante,
  EstadoIntegranteCambiado,
  IntegranteCreado,
  IntegranteModificado,
  ListadoPersonal,
} from "@/types/personal.types";

/**
 * Personal de mesa de entrada (spec_modulo_F.md, HU-F-01, F-03 y F-05). Toda la lógica del
 * módulo vive acá (Regla N.° 4); las rutas y las acciones ya validaron el
 * payload con Zod y el permiso. Nunca devuelve textos: lanza
 * `ErrorDeDominio(clave)`. La ficha y su cuenta son una unidad (regla 3.1):
 * la cuenta la crea y la cambia el módulo A, en la misma transacción.
 */

type Db = Tx | Prisma.TransactionClient;

/** `true` si `error` es un P2002 sobre `campo` (filtra por la columna para no confundir índices únicos). */
function esConflictoUnico(error: unknown, campo: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(campo) : typeof target === "string" && target.includes(campo);
}

/**
 * Defensa de constraints fuera de la transacción (spec_modulo_F.md §2.1 paso
 * 6): un alta o una modificación simultánea con el mismo DNI pasa el
 * `findFirst` y la cierra el índice único. Un P2002 sobre `emailUsuario` no
 * puede salir del alta (A usa `ON CONFLICT DO NOTHING`); queda como defensa.
 */
function traducirConflictoUnico(error: unknown): never {
  if (esConflictoUnico(error, "dniFichaMesaEntrada")) throw new ErrorDeDominio("errores.personal.dniDuplicado");
  if (esConflictoUnico(error, "emailUsuario")) throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
  throw error;
}

/** Unicidad del DNI contra todas las fichas de mesa de entrada, activas e inactivas, salvo `excluirId` (regla 3.2). */
async function dniEnUso(db: Db, dni: string, excluirId?: string): Promise<boolean> {
  const otra = await db.fichaMesaEntrada.findFirst({
    where: { dniFichaMesaEntrada: dni, ...(excluirId ? { NOT: { idFichaMesaEntrada: excluirId } } : {}) },
    select: { idFichaMesaEntrada: true },
  });
  return otra !== null;
}

/** `YYYY-MM-DD` de una columna `@db.Date` (medianoche UTC). */
function fechaCalendario(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Alta de un integrante (spec_modulo_F.md §2.1, HU-F-01 c1 a c4 y c6; HU-A-06
 * c1 y c2), en una única `transaccion`:
 * 1. DNI único entre todas las fichas de mesa de entrada (no contra otras tablas).
 * 2. `crearCuentaParaFicha` con rol `MESA_ENTRADA`: A verifica el email sin
 *    revelar de quién es, guarda solo el hash del DNI como contraseña inicial,
 *    pone la marca de cambio obligatorio y registra CUENTA_CREADA (con `ip`).
 * 3. La ficha, activa, con `usuarioId`, los nombres normalizados,
 *    `creadoPorUsuarioId` y `version = 0` (Regla N.° 2, opción (a)).
 * Si algo falla, no queda ni ficha ni cuenta. Este módulo le entrega el DNI a
 * A y nunca ve ni devuelve la contraseña.
 */
export async function crearIntegrante(
  input: AltaIntegranteInput,
  usuarioRegistranteId: string,
  ip?: string | null,
): Promise<IntegranteCreado> {
  try {
    return await transaccion(async (tx) => {
      if (await dniEnUso(tx, input.dni)) throw new ErrorDeDominio("errores.personal.dniDuplicado");

      const { usuario_id: usuarioId } = await crearCuentaParaFicha(tx, {
        email: input.email,
        dni: input.dni,
        rol: "MESA_ENTRADA",
        ip,
      });

      const ficha = await tx.fichaMesaEntrada.create({
        data: {
          usuarioId,
          activoFichaMesaEntrada: true,
          nombreFichaMesaEntrada: input.nombre,
          apellidoFichaMesaEntrada: input.apellido,
          nombreNormalizadoFichaMesaEntrada: normalizarTexto(input.nombre),
          apellidoNormalizadoFichaMesaEntrada: normalizarTexto(input.apellido),
          dniFichaMesaEntrada: input.dni,
          fechaNacimientoFichaMesaEntrada: input.fechaNacimiento,
          generoFichaMesaEntrada: input.genero ?? null,
          telefonoFichaMesaEntrada: input.telefono ?? null,
          emailFichaMesaEntrada: input.email,
          // Cargar el contacto en el alta no es una modificación: modificadoPorUsuarioId queda null.
          creadoPorUsuarioId: usuarioRegistranteId,
          version: 0,
        },
      });

      return {
        id: ficha.idFichaMesaEntrada,
        nombre: ficha.nombreFichaMesaEntrada,
        apellido: ficha.apellidoFichaMesaEntrada,
        dni: ficha.dniFichaMesaEntrada,
        email: ficha.emailFichaMesaEntrada,
        telefono: ficha.telefonoFichaMesaEntrada,
        activo: ficha.activoFichaMesaEntrada,
        cuenta: await obtenerResumenCuenta(usuarioId, tx),
      };
    });
  } catch (error) {
    traducirConflictoUnico(error);
  }
}

/**
 * Modificación (spec_modulo_F.md §2.2, HU-F-01 c5; HU-A-06 c6), en una única
 * `transaccion`:
 * 1. La ficha existe (activa o inactiva: P-F6, corregir un dato no la
 *    reactiva). Sin cambios respecto de lo guardado: `campos_modificados: []`
 *    sin escribir.
 * 2. DNI nuevo: único entre las demás fichas.
 * 3. Email nuevo de una ficha sin cuenta: no puede ser el de ninguna cuenta.
 *    Con cuenta lo verifica `cambiarEmailCuenta` (paso 6). Sin cambios, no se
 *    revalida.
 * 4. Nombres normalizados si cambian nombre o apellido.
 * 5. `updateMany` condicionado a `version` (Regla N.° 7): `count === 0` es
 *    CONFLICTO_EDICION_CONCURRENTE. Solo los campos que cambian.
 * 6. Con cuenta y email nuevo: `cambiarEmailCuenta`, después de la ficha (el
 *    mismo orden de bloqueo que la baja de HU-F-05: ficha y después cuenta).
 *    No revoca sesiones. Cambiar el DNI no toca la contraseña.
 */
export async function modificarIntegrante(
  id: string,
  input: ModificarIntegranteInput,
  usuarioId: string,
): Promise<IntegranteModificado> {
  try {
    return await transaccion(async (tx) => {
      const actual = await tx.fichaMesaEntrada.findUnique({
        where: { idFichaMesaEntrada: id },
        select: {
          usuarioId: true,
          nombreFichaMesaEntrada: true,
          apellidoFichaMesaEntrada: true,
          dniFichaMesaEntrada: true,
          fechaNacimientoFichaMesaEntrada: true,
          generoFichaMesaEntrada: true,
          telefonoFichaMesaEntrada: true,
          emailFichaMesaEntrada: true,
          version: true,
        },
      });
      if (!actual) throw new ErrorDeDominio("errores.personal.noEncontrado");

      const data: Prisma.FichaMesaEntradaUpdateManyMutationInput = {};
      const camposModificados: string[] = [];

      if (input.nombre !== undefined && input.nombre !== actual.nombreFichaMesaEntrada) {
        data.nombreFichaMesaEntrada = input.nombre;
        camposModificados.push("nombre");
      }
      if (input.apellido !== undefined && input.apellido !== actual.apellidoFichaMesaEntrada) {
        data.apellidoFichaMesaEntrada = input.apellido;
        camposModificados.push("apellido");
      }
      if (input.dni !== undefined && input.dni !== actual.dniFichaMesaEntrada) {
        data.dniFichaMesaEntrada = input.dni;
        camposModificados.push("dni");
      }
      if (
        input.fechaNacimiento !== undefined &&
        input.fechaNacimiento.getTime() !== actual.fechaNacimientoFichaMesaEntrada.getTime()
      ) {
        data.fechaNacimientoFichaMesaEntrada = input.fechaNacimiento;
        camposModificados.push("fechaNacimiento");
      }
      if (input.genero !== undefined && input.genero !== actual.generoFichaMesaEntrada) {
        data.generoFichaMesaEntrada = input.genero;
        camposModificados.push("genero");
      }
      if (input.telefono !== undefined && input.telefono !== actual.telefonoFichaMesaEntrada) {
        data.telefonoFichaMesaEntrada = input.telefono;
        camposModificados.push("telefono");
      }
      const emailNuevo =
        input.email !== undefined && input.email !== actual.emailFichaMesaEntrada ? input.email : undefined;
      if (emailNuevo !== undefined) {
        data.emailFichaMesaEntrada = emailNuevo;
        camposModificados.push("email");
      }

      if (camposModificados.length === 0) {
        return { id, campos_modificados: [], version: actual.version };
      }

      if (data.dniFichaMesaEntrada !== undefined && (await dniEnUso(tx, input.dni!, id))) {
        throw new ErrorDeDominio("errores.personal.dniDuplicado");
      }
      if (emailNuevo !== undefined && !actual.usuarioId) {
        await verificarEmailNoAsociadoAOtraCuenta(emailNuevo, {}, tx);
      }

      if (data.nombreFichaMesaEntrada !== undefined || data.apellidoFichaMesaEntrada !== undefined) {
        data.nombreNormalizadoFichaMesaEntrada = normalizarTexto(input.nombre ?? actual.nombreFichaMesaEntrada);
        data.apellidoNormalizadoFichaMesaEntrada = normalizarTexto(input.apellido ?? actual.apellidoFichaMesaEntrada);
      }

      const { count } = await tx.fichaMesaEntrada.updateMany({
        where: { idFichaMesaEntrada: id, version: input.version },
        // updatedAtFichaMesaEntrada lo actualiza Prisma (@updatedAt).
        data: { ...data, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
      });
      if (count === 0) throw new ErrorDeDominio("errores.personal.conflictoEdicion");

      // El email de la ficha es el de la cuenta (regla 3.3): misma unicidad y
      // misma transacción. Si A lo rechaza, se deshace también la ficha.
      if (emailNuevo !== undefined && actual.usuarioId) {
        await cambiarEmailCuenta(tx, { usuarioId: actual.usuarioId, email: emailNuevo });
      }

      return { id, campos_modificados: camposModificados, version: input.version + 1 };
    });
  } catch (error) {
    traducirConflictoUnico(error);
  }
}

/**
 * Historial de bajas y reactivaciones de la ficha (DEC-37), del más reciente
 * al más antiguo, con el nombre de quien actuó (`obtenerNombresPersonal`:
 * mesa de entrada y gerentes por `usuarioId`).
 */
async function historialDeLaFicha(id: string, db: Db): Promise<EntradaHistorialIntegrante[]> {
  const historial = await listarHistorialEstados("FICHA_MESA_ENTRADA", id, db);
  const nombres = await obtenerNombresPersonal(historial.flatMap((r) => (r.usuario_id ? [r.usuario_id] : [])), db);
  const porId = new Map(nombres.map((n) => [n.usuario_id, n.nombre_completo]));
  return historial.map((r) => ({
    id: r.id,
    accion: r.accion,
    motivo: r.motivo,
    fecha: r.fecha,
    usuarioId: r.usuario_id,
    usuarioNombre: r.usuario_id ? (porId.get(r.usuario_id) ?? null) : null,
  }));
}

/**
 * Ficha del integrante (spec_modulo_F.md §2.4): los datos, `version`, alta,
 * última modificación (`null` si nunca se modificó) y la «Cuenta de acceso»
 * con `obtenerResumenCuenta` (nunca el hash ni el DNI como contraseña). HU-F-05
 * suma el historial de estados y dos indicadores de solo lectura para que la
 * pantalla decida antes de confirmar la baja, sin bloquear nada:
 * `cajaAbierta` y `motivoObligatorioAlDesactivar`. Solo se calculan con la
 * ficha activa y con cuenta; si no, son `false`. La baja repite la validación.
 */
export async function obtenerDetalleIntegrante(id: string, db: Db = prisma): Promise<DetalleIntegrante> {
  const ficha = await db.fichaMesaEntrada.findUnique({ where: { idFichaMesaEntrada: id } });
  if (!ficha) throw new ErrorDeDominio("errores.personal.noEncontrado");

  const usuarioActivo = ficha.activoFichaMesaEntrada ? ficha.usuarioId : null;
  const [cuenta, historialEstados, caja, registroOperaciones] = await Promise.all([
    obtenerResumenCuenta(ficha.usuarioId, db),
    historialDeLaFicha(id, db),
    usuarioActivo ? cajaAbiertaDe(db, usuarioActivo) : null,
    usuarioActivo ? usuarioRegistroOperaciones(db, usuarioActivo) : false,
  ]);

  return {
    id: ficha.idFichaMesaEntrada,
    version: ficha.version,
    activo: ficha.activoFichaMesaEntrada,
    nombre: ficha.nombreFichaMesaEntrada,
    apellido: ficha.apellidoFichaMesaEntrada,
    dni: ficha.dniFichaMesaEntrada,
    fechaNacimiento: fechaCalendario(ficha.fechaNacimientoFichaMesaEntrada),
    genero: ficha.generoFichaMesaEntrada,
    telefono: ficha.telefonoFichaMesaEntrada,
    email: ficha.emailFichaMesaEntrada,
    creadoEl: ficha.createdAtFichaMesaEntrada,
    // Una ficha nunca modificada no tiene modificador: el alta no cuenta como modificación.
    modificadoEl: ficha.modificadoPorUsuarioId ? ficha.updatedAtFichaMesaEntrada : null,
    cuenta,
    historialEstados,
    cajaAbierta: caja !== null,
    motivoObligatorioAlDesactivar: registroOperaciones,
  };
}

/** Bloquea la ficha (nivel recurso) y la relee ya bloqueada: estado, versión y cuenta. */
async function fichaBloqueada(tx: Tx, id: string) {
  await bloquear(tx, { recursos: { fichasMesaEntrada: [id] } });
  const ficha = await tx.fichaMesaEntrada.findUnique({
    where: { idFichaMesaEntrada: id },
    select: { activoFichaMesaEntrada: true, version: true, usuarioId: true },
  });
  if (!ficha) throw new ErrorDeDominio("errores.personal.noEncontrado");
  return ficha;
}

/** `modificadoPorUsuarioId` solo si actúa un usuario. */
function modificadoPor(actor: ActorDominio): string | null {
  return actor.tipo === "USUARIO" ? actor.usuarioId : null;
}

/**
 * Baja del integrante (spec_modulo_F.md §2.5, HU-F-05 c1 a c4 y c6), en una
 * única `transaccion`, con el patrón de la baja de profesor (HU-D-08):
 * 1. Bloquea la ficha (`FOR UPDATE`) antes de leer nada. `abrirCaja` bloquea
 *    la misma ficha antes de insertar la caja, así que las dos se serializan
 *    (regla 3.4).
 * 2. Relee la ficha: inexistente, ya inactiva o con otra `version`.
 * 3. Con cuenta: sin caja abierta (`cajaAbiertaDe`, módulo I).
 * 4. Motivo obligatorio si la cuenta registró operaciones (DEC-39). Una ficha
 *    sin cuenta nunca fue actor de nada: el motivo es opcional. Si viene, se
 *    guarda aunque no sea obligatorio.
 * 5. `updateMany` condicionado a activa y `version` (Regla N.° 7).
 * 6. Con cuenta: `desactivarCuenta`, que también revoca las sesiones.
 * 7. El historial `DESACTIVAR` se escribe después del commit (Regla N.° 2).
 * Nada se borra: las operaciones conservan su `usuarioId` y el DNI y el email
 * siguen reservados.
 */
export async function desactivarIntegrante(
  id: string,
  input: DesactivarIntegranteInput,
  actor: ActorDominio,
): Promise<EstadoIntegranteCambiado> {
  return transaccion(async (tx) => {
    const ficha = await fichaBloqueada(tx, id);
    if (!ficha.activoFichaMesaEntrada) throw new ErrorDeDominio("errores.personal.yaInactivo");
    if (ficha.version !== input.version) throw new ErrorDeDominio("errores.personal.conflictoEdicion");

    if (ficha.usuarioId && (await cajaAbiertaDe(tx, ficha.usuarioId))) {
      throw new ErrorDeDominio("errores.personal.cajaAbierta");
    }
    const motivo = input.motivo?.trim() || null;
    if (!motivo && ficha.usuarioId && (await usuarioRegistroOperaciones(tx, ficha.usuarioId))) {
      throw new ErrorDeDominio("errores.personal.motivoRequerido");
    }

    const { count } = await tx.fichaMesaEntrada.updateMany({
      where: { idFichaMesaEntrada: id, activoFichaMesaEntrada: true, version: input.version },
      data: { activoFichaMesaEntrada: false, version: { increment: 1 }, modificadoPorUsuarioId: modificadoPor(actor) },
    });
    if (count === 0) throw new ErrorDeDominio("errores.personal.conflictoEdicion");

    // La ficha y la cuenta son una unidad (regla 3.1): si A falla, se deshace también la ficha.
    if (ficha.usuarioId) await desactivarCuenta(tx, ficha.usuarioId);
    registrarCambioEstado(tx, { entidad: "FICHA_MESA_ENTRADA", id, accion: "DESACTIVAR", motivo, actor });
    return { id, activo: false, version: input.version + 1 };
  });
}

/**
 * Reactivación (spec_modulo_F.md §2.6, HU-F-05 c5 y c6), en una única
 * `transaccion`: el mismo bloqueo y la relectura (inexistente, ya activa u
 * otra `version`), `updateMany` condicionado a inactiva y `version` y, con
 * cuenta, `reactivarCuenta`, que no restaura las sesiones revocadas en la baja
 * y conserva la marca de cambio de contraseña (HU-A-06 c7). No pide motivo. El
 * historial `REACTIVAR` se escribe después del commit.
 */
export async function reactivarIntegrante(
  id: string,
  input: ReactivarIntegranteInput,
  actor: ActorDominio,
): Promise<EstadoIntegranteCambiado> {
  return transaccion(async (tx) => {
    const ficha = await fichaBloqueada(tx, id);
    if (ficha.activoFichaMesaEntrada) throw new ErrorDeDominio("errores.personal.yaActivo");
    if (ficha.version !== input.version) throw new ErrorDeDominio("errores.personal.conflictoEdicion");

    const { count } = await tx.fichaMesaEntrada.updateMany({
      where: { idFichaMesaEntrada: id, activoFichaMesaEntrada: false, version: input.version },
      data: { activoFichaMesaEntrada: true, version: { increment: 1 }, modificadoPorUsuarioId: modificadoPor(actor) },
    });
    if (count === 0) throw new ErrorDeDominio("errores.personal.conflictoEdicion");

    if (ficha.usuarioId) await reactivarCuenta(tx, ficha.usuarioId);
    registrarCambioEstado(tx, { entidad: "FICHA_MESA_ENTRADA", id, accion: "REACTIVAR", actor });
    return { id, activo: true, version: input.version + 1 };
  });
}

/**
 * Listado del personal (spec_modulo_F.md §2.3, HU-F-03 c1, c2 y c4), sobre
 * activos e inactivos:
 * - Orden por apellido y nombre normalizados y el DNI como desempate (orden
 *   total: ninguna fila se repite ni se pierde al paginar).
 * - Búsqueda con `construirFiltroBusquedaPersonal` (criterio de HU-B-05); un
 *   `q` de menos de 2 caracteres devuelve el listado completo.
 * - Paginación de a `POR_PAGINA_PERSONAL`, con el `total` del resultado
 *   filtrado. Como en alumnos, una página fuera de rango se lleva a la última y,
 *   sin resultados, `pagina` es 1 y `total_paginas` es 0.
 * Solo lectura: no escribe nada.
 */
export async function listarPersonal(query: ListarPersonalQuery, db: Db = prisma): Promise<ListadoPersonal> {
  const where = construirFiltroBusquedaPersonal(query.q);
  const total = await db.fichaMesaEntrada.count({ where });
  const totalPaginas = Math.ceil(total / POR_PAGINA_PERSONAL);
  const pagina = total === 0 ? 1 : Math.min(query.pagina, totalPaginas);

  const fichas = await db.fichaMesaEntrada.findMany({
    where,
    orderBy: [
      { apellidoNormalizadoFichaMesaEntrada: "asc" },
      { nombreNormalizadoFichaMesaEntrada: "asc" },
      { dniFichaMesaEntrada: "asc" },
    ],
    skip: (pagina - 1) * POR_PAGINA_PERSONAL,
    take: POR_PAGINA_PERSONAL,
    select: {
      idFichaMesaEntrada: true,
      apellidoFichaMesaEntrada: true,
      nombreFichaMesaEntrada: true,
      dniFichaMesaEntrada: true,
      telefonoFichaMesaEntrada: true,
      emailFichaMesaEntrada: true,
      activoFichaMesaEntrada: true,
    },
  });
  return {
    items: fichas.map((f) => ({
      id: f.idFichaMesaEntrada,
      apellido: f.apellidoFichaMesaEntrada,
      nombre: f.nombreFichaMesaEntrada,
      dni: f.dniFichaMesaEntrada,
      telefono: f.telefonoFichaMesaEntrada,
      email: f.emailFichaMesaEntrada,
      activo: f.activoFichaMesaEntrada,
    })),
    pagina,
    por_pagina: POR_PAGINA_PERSONAL,
    total,
    total_paginas: totalPaginas,
  };
}

/**
 * Verificación al salir del campo (HU-F-01 c3): una ayuda para la pantalla;
 * el alta y la modificación la repiten siempre. El DNI contra todas las fichas
 * salvo `excluirId`; el email contra las cuentas, salvo la de la propia ficha.
 * Solo dice si está disponible, nunca de quién es. Un campo ausente cuenta
 * como disponible. Un `excluirId` inexistente es INTEGRANTE_NO_ENCONTRADO.
 * Solo lectura.
 */
export async function verificarDisponibilidadIntegrante(
  consulta: { dni?: string; email?: string; excluirId?: string },
  db: Db = prisma,
): Promise<DisponibilidadIntegrante> {
  const propia = consulta.excluirId
    ? await db.fichaMesaEntrada.findUnique({
        where: { idFichaMesaEntrada: consulta.excluirId },
        select: { usuarioId: true },
      })
    : null;
  // Editar una ficha que no existe: el mismo 404 que la modificación.
  if (consulta.excluirId && !propia) throw new ErrorDeDominio("errores.personal.noEncontrado");

  const dniDisponible = consulta.dni === undefined || !(await dniEnUso(db, consulta.dni, consulta.excluirId));

  let emailDisponible = true;
  if (consulta.email !== undefined) {
    try {
      await verificarEmailNoAsociadoAOtraCuenta(consulta.email, { excluirUsuarioId: propia?.usuarioId ?? null }, db);
    } catch (error) {
      if (!esErrorDeDominio(error, "errores.cuenta.emailYaAsociado")) throw error;
      emailDisponible = false;
    }
  }

  return { dni_disponible: dniDisponible, email_disponible: emailDisponible };
}
