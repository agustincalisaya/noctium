import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ErrorDeDominio, esErrorDeDominio } from "@/server/shared/error-dominio";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { bloquear } from "@/server/shared/bloquear";
import type { ActorDominio } from "@/server/shared/historial";
import { listarHistorialEstados, registrarCambioEstado } from "@/server/shared/historial-estados";
import { usuarioRegistroOperaciones } from "@/server/shared/actividad-usuario";
import {
  cambiarEmailCuenta,
  crearCuentaParaFicha,
  desactivarCuenta,
  filtrarCuentasActivas,
  obtenerResumenCuenta,
  reactivarCuenta,
  verificarEmailNoAsociadoAOtraCuenta,
} from "@/server/usuarios/cuenta.service";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { construirFiltroBusquedaGerentes } from "@/server/gerentes/gerente.busqueda";
import {
  POR_PAGINA_GERENTES,
  type AltaGerenteInput,
  type DesactivarGerenteInput,
  type ListarGerentesQuery,
  type ModificarGerenteInput,
  type ReactivarGerenteInput,
} from "@/server/gerentes/gerente.schema";
import type {
  DetalleGerente,
  DisponibilidadGerente,
  EntradaHistorialGerente,
  EstadoGerenteCambiado,
  GerenteCreado,
  GerenteModificado,
  ListadoGerentes,
} from "@/types/gerente.types";

/**
 * Gerentes (spec_modulo_G.md, HU-G-01, G-03 y G-05). Mismo diseño que
 * `personal.service.ts` (HU-F-01) sobre `FichaGerente`: la duplicación es
 * deliberada (task HU-G-01, decisión 2). Toda la lógica del módulo vive acá
 * (Regla N.° 4); las rutas y las acciones ya validaron el payload con Zod y el
 * permiso. Nunca devuelve textos: lanza `ErrorDeDominio(clave)`. La ficha y su
 * cuenta son una unidad (regla 3.1): la cuenta la crea y la cambia el módulo
 * A, en la misma transacción.
 */

type Db = Tx | Prisma.TransactionClient;

/** `true` si `error` es un P2002 sobre `campo` (filtra por la columna para no confundir índices únicos). */
function esConflictoUnico(error: unknown, campo: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(campo) : typeof target === "string" && target.includes(campo);
}

/**
 * Defensa de constraints fuera de la transacción (spec_modulo_G.md §2.1 paso
 * 5): un alta o una modificación simultánea con el mismo DNI pasa el
 * `findFirst` y la cierra el índice único. Un P2002 sobre `emailUsuario` no
 * puede salir del alta (A usa `ON CONFLICT DO NOTHING`); queda como defensa.
 */
function traducirConflictoUnico(error: unknown): never {
  if (esConflictoUnico(error, "dniFichaGerente")) throw new ErrorDeDominio("errores.gerente.dniDuplicado");
  if (esConflictoUnico(error, "emailUsuario")) throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
  throw error;
}

/** Unicidad del DNI contra todas las fichas de gerente, activas e inactivas, salvo `excluirId` (regla 3.2). */
async function dniEnUso(db: Db, dni: string, excluirId?: string): Promise<boolean> {
  const otra = await db.fichaGerente.findFirst({
    where: { dniFichaGerente: dni, ...(excluirId ? { NOT: { idFichaGerente: excluirId } } : {}) },
    select: { idFichaGerente: true },
  });
  return otra !== null;
}

/** `YYYY-MM-DD` de una columna `@db.Date` (medianoche UTC). */
function fechaCalendario(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Alta de un gerente (spec_modulo_G.md §2.1, HU-G-01 c1 a c3, c5 y c6;
 * HU-A-06 c1 y c2), en una única `transaccion`:
 * 1. DNI único entre todas las fichas de gerente (no contra otras tablas).
 * 2. `crearCuentaParaFicha` con rol `GERENTE`: A verifica el email sin
 *    revelar de quién es, guarda solo el hash del DNI como contraseña inicial,
 *    pone la marca de cambio obligatorio y registra CUENTA_CREADA (con `ip`).
 * 3. La ficha, activa, con `usuarioId`, los nombres normalizados,
 *    `creadoPorUsuarioId` y `version = 0` (Regla N.° 2, opción (a)).
 * Si algo falla, no queda ni ficha ni cuenta. Este módulo le entrega el DNI a
 * A y nunca ve ni devuelve la contraseña (regla 3.8).
 */
export async function crearGerente(
  input: AltaGerenteInput,
  usuarioRegistranteId: string,
  ip?: string | null,
): Promise<GerenteCreado> {
  try {
    return await transaccion(async (tx) => {
      if (await dniEnUso(tx, input.dni)) throw new ErrorDeDominio("errores.gerente.dniDuplicado");

      const { usuario_id: usuarioId } = await crearCuentaParaFicha(tx, {
        email: input.email,
        dni: input.dni,
        rol: "GERENTE",
        ip,
      });

      const ficha = await tx.fichaGerente.create({
        data: {
          usuarioId,
          activoFichaGerente: true,
          nombreFichaGerente: input.nombre,
          apellidoFichaGerente: input.apellido,
          nombreNormalizadoFichaGerente: normalizarTexto(input.nombre),
          apellidoNormalizadoFichaGerente: normalizarTexto(input.apellido),
          dniFichaGerente: input.dni,
          fechaNacimientoFichaGerente: input.fechaNacimiento,
          generoFichaGerente: input.genero ?? null,
          telefonoFichaGerente: input.telefono ?? null,
          emailFichaGerente: input.email,
          // Cargar el contacto en el alta no es una modificación: modificadoPorUsuarioId queda null.
          creadoPorUsuarioId: usuarioRegistranteId,
          version: 0,
        },
      });

      return {
        id: ficha.idFichaGerente,
        nombre: ficha.nombreFichaGerente,
        apellido: ficha.apellidoFichaGerente,
        dni: ficha.dniFichaGerente,
        email: ficha.emailFichaGerente,
        telefono: ficha.telefonoFichaGerente,
        activo: ficha.activoFichaGerente,
        cuenta: await obtenerResumenCuenta(usuarioId, tx),
      };
    });
  } catch (error) {
    traducirConflictoUnico(error);
  }
}

/**
 * Modificación (spec_modulo_G.md §2.2, HU-G-01 c4; HU-A-06 c6), en una única
 * `transaccion`:
 * 1. La ficha existe (activa o inactiva: P-G4, corregir un dato no la
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
 *    mismo orden que usará la baja de HU-G-05: ficha y después cuenta).
 *    No revoca sesiones, tampoco si la ficha es la del propio gerente
 *    (DEC-44). Cambiar el DNI no toca la contraseña.
 */
export async function modificarGerente(
  id: string,
  input: ModificarGerenteInput,
  usuarioId: string,
): Promise<GerenteModificado> {
  try {
    return await transaccion(async (tx) => {
      const actual = await tx.fichaGerente.findUnique({
        where: { idFichaGerente: id },
        select: {
          usuarioId: true,
          nombreFichaGerente: true,
          apellidoFichaGerente: true,
          dniFichaGerente: true,
          fechaNacimientoFichaGerente: true,
          generoFichaGerente: true,
          telefonoFichaGerente: true,
          emailFichaGerente: true,
          version: true,
        },
      });
      if (!actual) throw new ErrorDeDominio("errores.gerente.noEncontrado");

      const data: Prisma.FichaGerenteUpdateManyMutationInput = {};
      const camposModificados: string[] = [];

      if (input.nombre !== undefined && input.nombre !== actual.nombreFichaGerente) {
        data.nombreFichaGerente = input.nombre;
        camposModificados.push("nombre");
      }
      if (input.apellido !== undefined && input.apellido !== actual.apellidoFichaGerente) {
        data.apellidoFichaGerente = input.apellido;
        camposModificados.push("apellido");
      }
      if (input.dni !== undefined && input.dni !== actual.dniFichaGerente) {
        data.dniFichaGerente = input.dni;
        camposModificados.push("dni");
      }
      if (
        input.fechaNacimiento !== undefined &&
        input.fechaNacimiento.getTime() !== actual.fechaNacimientoFichaGerente.getTime()
      ) {
        data.fechaNacimientoFichaGerente = input.fechaNacimiento;
        camposModificados.push("fechaNacimiento");
      }
      if (input.genero !== undefined && input.genero !== actual.generoFichaGerente) {
        data.generoFichaGerente = input.genero;
        camposModificados.push("genero");
      }
      if (input.telefono !== undefined && input.telefono !== actual.telefonoFichaGerente) {
        data.telefonoFichaGerente = input.telefono;
        camposModificados.push("telefono");
      }
      const emailNuevo =
        input.email !== undefined && input.email !== actual.emailFichaGerente ? input.email : undefined;
      if (emailNuevo !== undefined) {
        data.emailFichaGerente = emailNuevo;
        camposModificados.push("email");
      }

      if (camposModificados.length === 0) {
        return { id, campos_modificados: [], version: actual.version };
      }

      if (data.dniFichaGerente !== undefined && (await dniEnUso(tx, input.dni!, id))) {
        throw new ErrorDeDominio("errores.gerente.dniDuplicado");
      }
      if (emailNuevo !== undefined && !actual.usuarioId) {
        await verificarEmailNoAsociadoAOtraCuenta(emailNuevo, {}, tx);
      }

      if (data.nombreFichaGerente !== undefined || data.apellidoFichaGerente !== undefined) {
        data.nombreNormalizadoFichaGerente = normalizarTexto(input.nombre ?? actual.nombreFichaGerente);
        data.apellidoNormalizadoFichaGerente = normalizarTexto(input.apellido ?? actual.apellidoFichaGerente);
      }

      const { count } = await tx.fichaGerente.updateMany({
        where: { idFichaGerente: id, version: input.version },
        // updatedAtFichaGerente lo actualiza Prisma (@updatedAt).
        data: { ...data, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
      });
      if (count === 0) throw new ErrorDeDominio("errores.gerente.conflictoEdicion");

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
async function historialDeLaFicha(id: string, db: Db): Promise<EntradaHistorialGerente[]> {
  const historial = await listarHistorialEstados("FICHA_GERENTE", id, db);
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

type FichaParaConteo = { idFichaGerente: string; activoFichaGerente: boolean; usuarioId: string | null };

/**
 * «Al menos un gerente activo» (spec_modulo_G.md §2.5 paso 4): `true` si
 * entre `fichas`, sin contar `excluirId`, no queda ninguna activa con cuenta
 * activa (`filtrarCuentasActivas`, módulo A). Una ficha activa sin cuenta o
 * con la cuenta inactiva no cuenta. No bloquea: quien llama decide si ya
 * tiene los bloqueos.
 */
async function sinOtroGerenteActivo(db: Db, fichas: FichaParaConteo[], excluirId: string): Promise<boolean> {
  const cuentas = fichas.flatMap((f) =>
    f.idFichaGerente !== excluirId && f.activoFichaGerente && f.usuarioId ? [f.usuarioId] : [],
  );
  return (await filtrarCuentasActivas(db, cuentas)).length === 0;
}

/** Indicador de la ficha (sin bloqueo): las demás fichas activas con cuenta, pasadas por el conteo. */
async function esUltimoGerenteActivoSinBloqueo(db: Db, id: string): Promise<boolean> {
  const otras = await db.fichaGerente.findMany({
    where: { activoFichaGerente: true, usuarioId: { not: null }, NOT: { idFichaGerente: id } },
    select: { idFichaGerente: true, activoFichaGerente: true, usuarioId: true },
  });
  return sinOtroGerenteActivo(db, otras, id);
}

/**
 * Ficha del gerente (spec_modulo_G.md §2.4, HU-G-01 y HU-G-05): los datos,
 * `version`, alta, última modificación (`null` si nunca se modificó), la
 * «Cuenta de acceso» con `obtenerResumenCuenta` (nunca el hash ni el DNI como
 * contraseña), `esVos` (la ficha es la del gerente autenticado, DEC-44) y el
 * historial de estados. HU-G-05 suma dos indicadores de solo lectura para que
 * la pantalla decida antes de confirmar la baja, sin bloquear nada:
 * `motivoObligatorioAlDesactivar` (solo con la ficha activa y con cuenta) y
 * `esUltimoGerenteActivo` (solo con la ficha activa); si no, son `false`. La
 * baja repite las dos validaciones.
 */
export async function obtenerDetalleGerente(
  id: string,
  sesionUsuarioId: string,
  db: Db = prisma,
): Promise<DetalleGerente> {
  const ficha = await db.fichaGerente.findUnique({ where: { idFichaGerente: id } });
  if (!ficha) throw new ErrorDeDominio("errores.gerente.noEncontrado");

  const activa = ficha.activoFichaGerente;
  const usuarioActivo = activa ? ficha.usuarioId : null;
  const [cuenta, historialEstados, registroOperaciones, esUltimoGerenteActivo] = await Promise.all([
    obtenerResumenCuenta(ficha.usuarioId, db),
    historialDeLaFicha(id, db),
    usuarioActivo ? usuarioRegistroOperaciones(db, usuarioActivo) : false,
    activa ? esUltimoGerenteActivoSinBloqueo(db, id) : false,
  ]);

  return {
    id: ficha.idFichaGerente,
    version: ficha.version,
    activo: ficha.activoFichaGerente,
    nombre: ficha.nombreFichaGerente,
    apellido: ficha.apellidoFichaGerente,
    dni: ficha.dniFichaGerente,
    fechaNacimiento: fechaCalendario(ficha.fechaNacimientoFichaGerente),
    genero: ficha.generoFichaGerente,
    telefono: ficha.telefonoFichaGerente,
    email: ficha.emailFichaGerente,
    creadoEl: ficha.createdAtFichaGerente,
    // Una ficha nunca modificada no tiene modificador: el alta no cuenta como modificación.
    modificadoEl: ficha.modificadoPorUsuarioId ? ficha.updatedAtFichaGerente : null,
    cuenta,
    esVos: ficha.usuarioId !== null && ficha.usuarioId === sesionUsuarioId,
    historialEstados,
    motivoObligatorioAlDesactivar: registroOperaciones,
    esUltimoGerenteActivo,
  };
}

/** `modificadoPorUsuarioId` solo si actúa un usuario. */
function modificadoPor(actor: ActorDominio): string | null {
  return actor.tipo === "USUARIO" ? actor.usuarioId : null;
}

/**
 * Baja del gerente (spec_modulo_G.md §2.5 y §3.4, HU-G-05 c1 a c4 y c6), en
 * una única `transaccion`, con el patrón de la baja de F-05:
 * 1. Lectura simple de la ficha, sin bloqueo: inexistente, o la del propio
 *    actor (NO_PUEDE_DESACTIVARSE_A_SI_MISMO, criterio 2). Lo decide el
 *    servidor antes de tomar ningún bloqueo.
 * 2. Bloquea, en una sola llamada (por id ascendente), todas las fichas de
 *    gerente activas más la objetivo y las relee ya bloqueadas. `bloquear`
 *    recibe ids: la lista leída antes puede quedar vieja mientras se espera
 *    (otra baja que confirma en ese lapso), así que todo lo que sigue usa la
 *    relectura. Una ficha que se activa entre la lectura y el bloqueo solo
 *    suma gerentes activos; dos bajas toman el mismo conjunto en el mismo
 *    orden y se serializan sin interbloqueos.
 * 3. Objetivo releído: inexistente, ya inactivo o con otra `version`.
 * 4. Sin contar al objetivo, tiene que quedar alguna ficha activa con cuenta
 *    activa; si no, ULTIMO_GERENTE_ACTIVO (criterio 3, spec §3.4).
 * 5. Motivo obligatorio si la cuenta registró operaciones (DEC-39). Una ficha
 *    sin cuenta nunca fue actor de nada: el motivo es opcional. Si viene, se
 *    guarda aunque no sea obligatorio.
 * 6. `updateMany` condicionado a activa y `version` (Regla N.° 7).
 * 7. Con cuenta: `desactivarCuenta`, que también revoca las sesiones.
 * 8. El historial `DESACTIVAR` se escribe después del commit (Regla N.° 2).
 * Nada se borra: las operaciones conservan su `usuarioId` y el DNI y el email
 * siguen reservados.
 */
export async function desactivarGerente(
  id: string,
  input: DesactivarGerenteInput,
  actor: ActorDominio,
): Promise<EstadoGerenteCambiado> {
  return transaccion(async (tx) => {
    const objetivo = await tx.fichaGerente.findUnique({ where: { idFichaGerente: id }, select: { usuarioId: true } });
    if (!objetivo) throw new ErrorDeDominio("errores.gerente.noEncontrado");
    if (actor.tipo === "USUARIO" && objetivo.usuarioId !== null && objetivo.usuarioId === actor.usuarioId) {
      throw new ErrorDeDominio("errores.gerente.noPuedeDesactivarseASiMismo");
    }

    const activas = await tx.fichaGerente.findMany({ where: { activoFichaGerente: true }, select: { idFichaGerente: true } });
    const ids = [...new Set([...activas.map((f) => f.idFichaGerente), id])];
    await bloquear(tx, { recursos: { fichasGerente: ids } });
    const releidas = await tx.fichaGerente.findMany({
      where: { idFichaGerente: { in: ids } },
      select: { idFichaGerente: true, activoFichaGerente: true, version: true, usuarioId: true },
    });

    const ficha = releidas.find((f) => f.idFichaGerente === id);
    if (!ficha) throw new ErrorDeDominio("errores.gerente.noEncontrado");
    if (!ficha.activoFichaGerente) throw new ErrorDeDominio("errores.gerente.yaInactivo");
    if (ficha.version !== input.version) throw new ErrorDeDominio("errores.gerente.conflictoEdicion");

    if (await sinOtroGerenteActivo(tx, releidas, id)) throw new ErrorDeDominio("errores.gerente.ultimoGerenteActivo");
    const motivo = input.motivo?.trim() || null;
    if (!motivo && ficha.usuarioId && (await usuarioRegistroOperaciones(tx, ficha.usuarioId))) {
      throw new ErrorDeDominio("errores.gerente.motivoRequerido");
    }

    const { count } = await tx.fichaGerente.updateMany({
      where: { idFichaGerente: id, activoFichaGerente: true, version: input.version },
      data: { activoFichaGerente: false, version: { increment: 1 }, modificadoPorUsuarioId: modificadoPor(actor) },
    });
    if (count === 0) throw new ErrorDeDominio("errores.gerente.conflictoEdicion");

    // La ficha y la cuenta son una unidad (regla 3.1): si A falla, se deshace también la ficha.
    if (ficha.usuarioId) await desactivarCuenta(tx, ficha.usuarioId);
    registrarCambioEstado(tx, { entidad: "FICHA_GERENTE", id, accion: "DESACTIVAR", motivo, actor });
    return { id, activo: false, version: input.version + 1 };
  });
}

/**
 * Reactivación (spec_modulo_G.md §2.6, HU-G-05 c5 y c6), en una única
 * `transaccion`: bloquea solo la ficha y la relee (inexistente, ya activa u
 * otra `version`), `updateMany` condicionado a inactiva y `version` y, con
 * cuenta, `reactivarCuenta`, que no restaura las sesiones revocadas en la baja
 * y conserva la marca de cambio de contraseña (HU-A-06 c7). No pide motivo ni
 * mira «al menos un gerente activo»: reactivar solo suma. El historial
 * `REACTIVAR` se escribe después del commit.
 */
export async function reactivarGerente(
  id: string,
  input: ReactivarGerenteInput,
  actor: ActorDominio,
): Promise<EstadoGerenteCambiado> {
  return transaccion(async (tx) => {
    await bloquear(tx, { recursos: { fichasGerente: [id] } });
    const ficha = await tx.fichaGerente.findUnique({
      where: { idFichaGerente: id },
      select: { activoFichaGerente: true, version: true, usuarioId: true },
    });
    if (!ficha) throw new ErrorDeDominio("errores.gerente.noEncontrado");
    if (ficha.activoFichaGerente) throw new ErrorDeDominio("errores.gerente.yaActivo");
    if (ficha.version !== input.version) throw new ErrorDeDominio("errores.gerente.conflictoEdicion");

    const { count } = await tx.fichaGerente.updateMany({
      where: { idFichaGerente: id, activoFichaGerente: false, version: input.version },
      data: { activoFichaGerente: true, version: { increment: 1 }, modificadoPorUsuarioId: modificadoPor(actor) },
    });
    if (count === 0) throw new ErrorDeDominio("errores.gerente.conflictoEdicion");

    if (ficha.usuarioId) await reactivarCuenta(tx, ficha.usuarioId);
    registrarCambioEstado(tx, { entidad: "FICHA_GERENTE", id, accion: "REACTIVAR", actor });
    return { id, activo: true, version: input.version + 1 };
  });
}

/**
 * Listado de gerentes (spec_modulo_G.md §2.3, HU-G-03 c1 a c5; parte de
 * HU-G-01, DEC-38), sobre activos e inactivos. Mismo diseño que
 * `listarPersonal` (HU-F-03):
 * - Orden por apellido y nombre normalizados y el DNI como desempate (orden
 *   total: ninguna fila se repite ni se pierde al paginar).
 * - Búsqueda con `construirFiltroBusquedaGerentes` (criterio de HU-B-05); un
 *   `q` de menos de 2 caracteres devuelve el listado completo.
 * - Paginación de a `POR_PAGINA_GERENTES`, con el `total` del resultado
 *   filtrado. Una página fuera de rango se lleva a la última y, sin
 *   resultados, `pagina` es 1 y `total_paginas` es 0.
 * - `esVos` por ítem (criterio 3): la ficha cuya cuenta es la de la sesión.
 *   Una ficha sin cuenta nunca lo es. `usuarioId` se lee para calcularlo,
 *   pero no se devuelve.
 * Solo lectura: no escribe nada.
 */
export async function listarGerentes(
  query: ListarGerentesQuery,
  sesionUsuarioId: string,
  db: Db = prisma,
): Promise<ListadoGerentes> {
  const where = construirFiltroBusquedaGerentes(query.q);
  const total = await db.fichaGerente.count({ where });
  const totalPaginas = Math.ceil(total / POR_PAGINA_GERENTES);
  const pagina = total === 0 ? 1 : Math.min(query.pagina, totalPaginas);

  const fichas = await db.fichaGerente.findMany({
    where,
    orderBy: [
      { apellidoNormalizadoFichaGerente: "asc" },
      { nombreNormalizadoFichaGerente: "asc" },
      { dniFichaGerente: "asc" },
    ],
    skip: (pagina - 1) * POR_PAGINA_GERENTES,
    take: POR_PAGINA_GERENTES,
    select: {
      idFichaGerente: true,
      usuarioId: true,
      apellidoFichaGerente: true,
      nombreFichaGerente: true,
      dniFichaGerente: true,
      telefonoFichaGerente: true,
      emailFichaGerente: true,
      activoFichaGerente: true,
    },
  });
  return {
    items: fichas.map((f) => ({
      id: f.idFichaGerente,
      apellido: f.apellidoFichaGerente,
      nombre: f.nombreFichaGerente,
      dni: f.dniFichaGerente,
      telefono: f.telefonoFichaGerente,
      email: f.emailFichaGerente,
      activo: f.activoFichaGerente,
      esVos: f.usuarioId !== null && f.usuarioId === sesionUsuarioId,
    })),
    pagina,
    por_pagina: POR_PAGINA_GERENTES,
    total,
    total_paginas: totalPaginas,
  };
}

/**
 * Verificación al salir del campo (HU-G-01, decisión 9): una ayuda para la
 * pantalla; el alta y la modificación la repiten siempre. El DNI contra todas
 * las fichas salvo `excluirId`; el email contra las cuentas, salvo la de la
 * propia ficha. Solo dice si está disponible, nunca de quién es. Un campo
 * ausente cuenta como disponible. Un `excluirId` inexistente es
 * GERENTE_NO_ENCONTRADO. Solo lectura.
 */
export async function verificarDisponibilidadGerente(
  consulta: { dni?: string; email?: string; excluirId?: string },
  db: Db = prisma,
): Promise<DisponibilidadGerente> {
  const propia = consulta.excluirId
    ? await db.fichaGerente.findUnique({
        where: { idFichaGerente: consulta.excluirId },
        select: { usuarioId: true },
      })
    : null;
  // Editar una ficha que no existe: el mismo 404 que la modificación.
  if (consulta.excluirId && !propia) throw new ErrorDeDominio("errores.gerente.noEncontrado");

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
