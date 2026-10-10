import { Prisma, type EstadoPagoInscripcion, type EstadoTurno, type VigenciaInscripcion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.publico";
import { obtenerTarifasPorIds } from "@/server/materias/materia.publico";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { columnasActor, encolarHistorial, PROCESO_AUTOMATICO, type ActorDominio } from "@/server/shared/historial";
import { parametrosVigentes } from "@/server/shared/parametros-vigentes";
import { precioClase } from "@/server/shared/precio-clase";
import { ahora } from "@/server/shared/reloj";
import { ServiceError } from "@/server/shared/service-error";
import type { Tx } from "@/server/shared/transaccion";
import { esConflictoDeReserva } from "@/server/turnos/turno.reserva-error";
import {
  calcularVencimiento,
  esVigenteEn,
  inscripcionesVigentes,
  recalcularEstadoTurno,
  sqlInstante,
} from "@/server/turnos/inscripcion.vigencia";

/**
 * Servicio de inscripción del módulo C (PR-0.md §2.13, spec_modulo_C.md
 * §2.16). Toda escritura sobre `turno_alumno` pasa por acá. Cada función
 * recibe el `tx` de una `transaccion()` del llamador, toma sus bloqueos con
 * `bloquear` (pedir de nuevo lo ya tomado no hace nada), usa `ahora()`,
 * lanza `ErrorDeDominio` y encola el historial para después del commit.
 */

type Db = Tx | typeof prisma;

export type OrigenInscripcion = "ALUMNO" | "CENTRO" | "PAGO";

export type InscripcionResumen = {
  id: string;
  turnoId: string;
  alumnoId: string;
  vigencia: VigenciaInscripcion;
  estadoPago: EstadoPagoInscripcion;
  reservadaEl: Date;
  inicioPlazo: Date | null;
  venceBaseEl: Date | null;
  venceEl: Date | null;
  precio: number;
  reabiertaPorAnulacion: boolean;
  finalizadaEl: Date | null;
};

const SELECT_RESUMEN = {
  idInscripcion: true, turnoId: true, alumnoId: true, vigencia: true, estadoPago: true, reservadaEl: true,
  inicioPlazo: true, venceBaseEl: true, venceEl: true, precio: true, reabiertaPorAnulacion: true, finalizadaEl: true,
} as const;

function resumen(fila: Prisma.TurnoAlumnoGetPayload<{ select: typeof SELECT_RESUMEN }>): InscripcionResumen {
  const { idInscripcion, ...resto } = fila;
  return { id: idInscripcion, ...resto };
}

const ESTADOS_CONFIRMADOS: readonly EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

// ---------------------------------------------------------------------------
// Lecturas (fachada inscripcion.publico.ts)
// ---------------------------------------------------------------------------

/**
 * La inscripción con `vigencia = VIGENTE` del par (alumno, clase), o `null`.
 * Es la fila vigente según la columna: si es una reserva que ya venció y
 * todavía no se marcó, la devuelve igual (el llamador marca primero con
 * `marcarVencidas`; para decidir si cuenta, `esVigenteEn`).
 */
export async function inscripcionVigenteDelPar(alumnoId: string, turnoId: string, db: Db = prisma): Promise<InscripcionResumen | null> {
  const fila = await db.turnoAlumno.findFirst({ where: { alumnoId, turnoId, vigencia: "VIGENTE" }, select: SELECT_RESUMEN });
  return fila ? resumen(fila) : null;
}

/** La inscripción más reciente del par (alumno, clase), en cualquier vigencia, o `null`. */
export async function inscripcionMasRecienteDelPar(alumnoId: string, turnoId: string, db: Db = prisma): Promise<InscripcionResumen | null> {
  const fila = await db.turnoAlumno.findFirst({
    where: { alumnoId, turnoId },
    orderBy: [{ reservadaEl: "desc" }, { createdAtInscripcion: "desc" }, { idInscripcion: "desc" }],
    select: SELECT_RESUMEN,
  });
  return fila ? resumen(fila) : null;
}

/**
 * Clases Disponibles o Completas con alguna reserva vencida a `momento` y
 * todavía sin marcar (R6-PR0-9): las que procesa el proceso programado de
 * HU-C-24. Solo lectura, por id ascendente.
 */
export async function clasesConReservasVencidas(db: Db, momento: Date): Promise<string[]> {
  const filas = await db.$queryRaw<{ turnoId: string }[]>(Prisma.sql`
    SELECT ta."turnoId" FROM "turno_alumno" ta
    JOIN "turnos" t ON t."idTurno" = ta."turnoId"
    WHERE ta."vigencia" = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA' AND ta."venceEl" <= ${sqlInstante(momento)}
      AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
    GROUP BY ta."turnoId" ORDER BY ta."turnoId" COLLATE "C"`);
  return filas.map((fila) => fila.turnoId);
}

/** Igual que `clasesConReservasVencidas`, solo para las reservas de un alumno (las que bloquea quien lo inscribe). */
export async function clasesConReservasVencidasDelAlumno(db: Db, alumnoId: string, momento: Date): Promise<string[]> {
  const filas = await db.$queryRaw<{ turnoId: string }[]>(Prisma.sql`
    SELECT ta."turnoId" FROM "turno_alumno" ta
    JOIN "turnos" t ON t."idTurno" = ta."turnoId"
    WHERE ta."alumnoId" = ${alumnoId} AND ta."vigencia" = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA'
      AND ta."venceEl" <= ${sqlInstante(momento)} AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
    GROUP BY ta."turnoId" ORDER BY ta."turnoId" COLLATE "C"`);
  return filas.map((fila) => fila.turnoId);
}

export type MotivoInscripcionConPago = "RESERVA_VENCIDA" | "CANCELADA_SIN_PAGO";

/**
 * Regla de re-reserva como consulta (HU-C-22 criterio 4, R6-PR0-4): `exige`
 * es `true` si el alumno ya tuvo en esa clase una reserva que venció (marcada
 * o no) o que canceló sin pagar. No cuentan la cancelación de una inscripción
 * sin reserva, las reservas pagadas (estado congelado PAGADA), las quitadas
 * por el centro o dadas de baja, ni una reserva reabierta por anulación que
 * después vence o se cancela (HU-C-24 criterio 5). Devuelve el motivo de la
 * más reciente que cuenta.
 */
export async function exigeInscripcionConPago(
  db: Db,
  { turnoId, alumnoId, momento = ahora() }: { turnoId: string; alumnoId: string; momento?: Date },
): Promise<{ exige: boolean; motivo: MotivoInscripcionConPago | null }> {
  const turno = await db.turno.findUnique({ where: { idTurno: turnoId }, select: { estadoTurno: true } });
  if (!turno) return { exige: false, motivo: null };
  const filas = await db.turnoAlumno.findMany({
    where: { turnoId, alumnoId, estadoPago: "RESERVADA", reabiertaPorAnulacion: false },
    orderBy: [{ reservadaEl: "desc" }, { idInscripcion: "desc" }],
    select: { vigencia: true, estadoPago: true, venceEl: true },
  });
  for (const fila of filas) {
    if (fila.vigencia === "RESERVA_VENCIDA") return { exige: true, motivo: "RESERVA_VENCIDA" };
    if (fila.vigencia === "CANCELADA_ALUMNO") return { exige: true, motivo: "CANCELADA_SIN_PAGO" };
    if (fila.vigencia === "VIGENTE" && !esVigenteEn({ ...fila, estadoClase: turno.estadoTurno }, momento)) {
      return { exige: true, motivo: "RESERVA_VENCIDA" };
    }
  }
  return { exige: false, motivo: null };
}

// ---------------------------------------------------------------------------
// Vencimiento perezoso (PR-0.md §2.2)
// ---------------------------------------------------------------------------

type FilaVencida = { idInscripcion: string; turnoId: string; venceEl: Date };

function historialDeVencidas(tx: Tx, filas: FilaVencida[]) {
  for (const fila of filas) {
    encolarHistorial(tx, {
      tipo: "INSCRIPCION", inscripcionId: fila.idInscripcion,
      vigenciaAnterior: "VIGENTE", vigenciaNueva: "RESERVA_VENCIDA",
      estadoPagoAnterior: "RESERVADA", estadoPagoNuevo: "RESERVADA",
      actor: PROCESO_AUTOMATICO, fecha: fila.venceEl,
    });
  }
}

/**
 * Marca como RESERVA_VENCIDA las reservas de la clase vencidas a `momento`,
 * solo si la clase está Disponible o Completa (en una Cancelada no vence
 * nada). Condición atómica en la propia sentencia (Regla N.° 7); fecha =
 * `venceEl` y actor «Proceso automático». Recalcula `Turno.estado` si marcó
 * alguna. Devuelve la cantidad marcada (R6-PR0-9).
 */
export async function marcarVencidas(tx: Tx, turnoId: string, opciones: { momento?: Date } = {}): Promise<number> {
  const momento = opciones.momento ?? ahora();
  await bloquear(tx, { clases: [turnoId] });
  const filas = await tx.$queryRaw<FilaVencida[]>(Prisma.sql`
    UPDATE "turno_alumno" ta
    SET "vigencia" = 'RESERVA_VENCIDA', "finalizadaEl" = ta."venceEl",
        "finalizadaPorActorTipo" = 'PROCESO_AUTOMATICO', "finalizadaPorUsuarioId" = NULL
    FROM "turnos" t
    WHERE t."idTurno" = ta."turnoId" AND ta."turnoId" = ${turnoId}
      AND ta."vigencia" = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA' AND ta."venceEl" <= ${sqlInstante(momento)}
      AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
    RETURNING ta."idInscripcion", ta."turnoId", ta."venceEl"`);
  if (filas.length > 0) {
    await recalcularEstadoTurno(tx, turnoId, momento);
    historialDeVencidas(tx, filas);
  }
  return filas.length;
}

/**
 * Marca las reservas vencidas a `momento` de ESE alumno en las clases
 * indicadas (Disponibles o Completas), que el llamador ya bloqueó. Así una
 * reserva vencida sin marcar no retiene la franja del alumno en el EXCLUDE de
 * `reservas_turno` (HU-C-24 criterio 2). Devuelve la cantidad marcada.
 */
export async function marcarVencidasDelAlumno(
  tx: Tx,
  alumnoId: string,
  { momento, clases }: { momento: Date; clases: readonly string[] },
): Promise<number> {
  if (clases.length === 0) return 0;
  await bloquear(tx, { clases });
  const filas = await tx.$queryRaw<FilaVencida[]>(Prisma.sql`
    UPDATE "turno_alumno" ta
    SET "vigencia" = 'RESERVA_VENCIDA', "finalizadaEl" = ta."venceEl",
        "finalizadaPorActorTipo" = 'PROCESO_AUTOMATICO', "finalizadaPorUsuarioId" = NULL
    FROM "turnos" t
    WHERE t."idTurno" = ta."turnoId" AND ta."alumnoId" = ${alumnoId} AND ta."turnoId" IN (${Prisma.join([...clases])})
      AND ta."vigencia" = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA' AND ta."venceEl" <= ${sqlInstante(momento)}
      AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
    RETURNING ta."idInscripcion", ta."turnoId", ta."venceEl"`);
  for (const turnoId of new Set(filas.map((fila) => fila.turnoId))) await recalcularEstadoTurno(tx, turnoId, momento);
  historialDeVencidas(tx, filas);
  return filas.length;
}

/**
 * Reprogramación (spec_modulo_C.md §2.16.6, HU-C-22 crit. 2): con la fecha u
 * hora de la clase ya cambiadas, marca primero las reservas vencidas según su
 * vencimiento anterior (el guardado) y después acorta o alarga el de las que
 * siguen: `venceEl = min(venceBaseEl, nuevo inicio)`. No cambia `inicioPlazo`
 * ni `venceBaseEl`, ni aplica el plazo configurado al momento de reprogramar.
 */
export async function recalcularVencimientos(tx: Tx, turnoId: string, opciones: { momento?: Date } = {}): Promise<{ marcadas: number; recalculadas: number }> {
  const momento = opciones.momento ?? ahora();
  await bloquear(tx, { clases: [turnoId] });
  const marcadas = await marcarVencidas(tx, turnoId, { momento });
  const turno = await tx.turno.findUnique({ where: { idTurno: turnoId }, select: { fechaTurno: true, horaInicioTurno: true } });
  if (!turno) throw new ErrorDeDominio("errores.turno.noEncontrado");
  const nuevoInicio = sqlInstante(inicioDeTurno(turno));
  const recalculadas = await tx.$executeRaw(Prisma.sql`
    UPDATE "turno_alumno"
    SET "venceEl" = LEAST("venceBaseEl", ${nuevoInicio})
    WHERE "turnoId" = ${turnoId} AND "vigencia" = 'VIGENTE' AND "estadoPago" = 'RESERVADA'
      AND "venceEl" IS DISTINCT FROM LEAST("venceBaseEl", ${nuevoInicio})`);
  return { marcadas, recalculadas };
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export type DatosCrearInscripcion = {
  turnoId: string;
  alumnoId: string;
  origen: OrigenInscripcion;
  /** true: RESERVADA con plazo; false: PAGO_SIN_REGISTRAR (interino, 2.15). Con origen PAGO se ignora: nace PAGADA. */
  conReserva: boolean;
  actor: ActorDominio;
  /** Estado ya resuelto por el llamador (autoservicio). Igual se revalida después de bloquear al alumno (R3-PR0-B3). */
  alumnoActivo?: boolean;
  /** true si el llamador ya bloqueó al alumno, la clase y las clases con reservas vencidas del alumno (registrarOperacion). */
  bloqueosTomados?: boolean;
  /** Momento único de la operación; por defecto `ahora()`. */
  momento?: Date;
};

export type InscripcionCreada = {
  inscripcion: InscripcionResumen;
  /** Estado guardado de la clase después de inscribir (DISPONIBLE o COMPLETO). */
  estadoTurno: EstadoTurno;
  /** true si la inscripción pasó la clase a COMPLETO. */
  completado: boolean;
  inscriptos: number;
  cupo: number;
  /** Alumnos con inscripción vigente después del alta (para el evento turno:completado). */
  alumnoIds: string[];
};

function errorDeAlumno(origen: OrigenInscripcion, alumnoId: string, codigo: string): ErrorDeDominio {
  // CENTRO conserva el contrato de HU-C-04 (1.1): ALUMNO_NO_DISPONIBLE para inexistente o inactivo.
  if (origen === "CENTRO") return new ErrorDeDominio("errores.inscripcion.alumnoNoDisponibleOInactivo", { alumno_id: alumnoId });
  if (codigo === "ALUMNO_NO_ENCONTRADO") return new ErrorDeDominio("errores.alumno.noEncontrado");
  return new ErrorDeDominio("errores.alumno.inactivo");
}

/**
 * Crea una inscripción VIGENTE (PR-0.md §2.13, spec_modulo_C.md §2.16.4,
 * §2.17.2 y §2.18.3). Orden de las validaciones: el de HU-C-04 §2.5 (así los
 * Route Handlers conservan sus respuestas), y después tarifa y re-reserva.
 *
 * - ALUMNO: autoservicio. Con `conReserva` aplica la regla de re-reserva
 *   (RESERVA_PREVIA_SIN_PAGO).
 * - CENTRO: mesa de entrada. Con `conReserva` (HU-C-24) aplica la misma regla
 *   y responde INSCRIPCION_REQUIERE_PAGO.
 * - PAGO: «Se inscribe al confirmar el pago» (HU-I-10); nace PAGADA, en la
 *   misma transacción del cobro.
 *
 * No cambia el estado de una clase PENDIENTE ni CANCELADO (R6-PR0-1): en esas
 * clases no se inscribe.
 */
export async function crearInscripcion(tx: Tx, datos: DatosCrearInscripcion): Promise<InscripcionCreada> {
  const { turnoId, alumnoId, origen, actor } = datos;
  const momento = datos.momento ?? ahora();
  const propio = origen === "ALUMNO";

  // 1. Bloqueos en una sola llamada: alumno → clase destino y clases con sus reservas vencidas sin marcar.
  const conVencidas = await clasesConReservasVencidasDelAlumno(tx, alumnoId, momento);
  if (!datos.bloqueosTomados) {
    await bloquear(tx, { recursos: { alumnos: [alumnoId] }, clases: [turnoId, ...conVencidas] });
  }
  await marcarVencidasDelAlumno(tx, alumnoId, { momento, clases: conVencidas.filter((id) => id !== turnoId) });

  // 2. La clase, ya bloqueada (mismas condiciones y textos que HU-C-04 §2.5).
  const turno = await tx.turno.findUnique({
    where: { idTurno: turnoId },
    select: { estadoTurno: true, cupoMaximoTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, materiaId: true },
  });
  if (!turno) throw new ErrorDeDominio("errores.turno.noEncontrado");
  if (turno.estadoTurno === "CANCELADO") throw new ErrorDeDominio("errores.turno.cancelado");
  if (turno.estadoTurno === "PENDIENTE") throw new ErrorDeDominio("errores.turno.pendiente");
  if (turno.cupoMaximoTurno === null) throw new ErrorDeDominio("errores.turno.sinAula");
  const inicio = inicioDeTurno(turno);
  if (inicio.getTime() <= momento.getTime()) throw new ErrorDeDominio("errores.turno.vencido");
  await marcarVencidas(tx, turnoId, { momento });
  const cupo = turno.cupoMaximoTurno;
  const vigentesAntes = await inscripcionesVigentes(tx, turnoId, momento);
  if (vigentesAntes.length >= cupo) throw new ErrorDeDominio("errores.turno.cupoInsuficiente");

  // 3. El alumno, ya bloqueado: se decide sobre la fila bloqueada (R3-PR0-B3).
  if (datos.alumnoActivo === false) throw errorDeAlumno(origen, alumnoId, "ALUMNO_INACTIVO");
  try {
    await verificarAlumnoActivo(alumnoId, tx);
  } catch (error) {
    if (error instanceof ServiceError) throw errorDeAlumno(origen, alumnoId, error.code);
    throw error;
  }
  if (await inscripcionVigenteDelPar(alumnoId, turnoId, tx)) {
    throw new ErrorDeDominio(propio ? "errores.inscripcion.alumnoYaAsignadoPropio" : "errores.inscripcion.alumnoYaAsignado", { alumno_id: alumnoId });
  }
  const ocupado = new ErrorDeDominio(
    propio ? "errores.inscripcion.alumnoNoDisponiblePropio" : "errores.inscripcion.alumnoNoDisponible", { alumno_id: alumnoId },
  );
  if (await alumnoTieneClaseSuperpuesta(tx, alumnoId, turnoId)) throw ocupado;

  // 4. Tarifa (HU-L-06 criterio 5) y precio congelado.
  const [tarifa] = await obtenerTarifasPorIds([turno.materiaId], tx);
  const precio = precioClase({ tarifaHora: tarifa?.tarifaHora ?? null }, turno.duracionMinutosTurno, { paraAlumno: propio });

  // 5. Re-reserva (HU-C-22 criterio 4; HU-C-24 criterio 3 para el centro): con
  // reserva previa sin pago la inscripción se crea recién al confirmar el pago.
  if (datos.conReserva && origen !== "PAGO" && (await exigeInscripcionConPago(tx, { turnoId, alumnoId, momento })).exige) {
    throw origen === "ALUMNO"
      ? new ErrorDeDominio("errores.reserva.previaSinPago")
      : new ErrorDeDominio("errores.inscripcion.requierePago", { alumno_id: alumnoId });
  }

  // 6. Alta. Los campos que los CHECK unen van juntos en la misma sentencia.
  let estadoPago: EstadoPagoInscripcion = "PAGO_SIN_REGISTRAR";
  let plazo: { inicioPlazo: Date | null; venceBaseEl: Date | null; venceEl: Date | null } = { inicioPlazo: null, venceBaseEl: null, venceEl: null };
  if (origen === "PAGO") {
    estadoPago = "PAGADA";
  } else if (datos.conReserva) {
    estadoPago = "RESERVADA";
    const { plazoPagoHoras } = await parametrosVigentes(tx);
    plazo = { inicioPlazo: momento, ...calcularVencimiento(momento, inicio, plazoPagoHoras) };
  }
  let creada;
  try {
    creada = await tx.turnoAlumno.create({
      data: {
        turnoId, alumnoId, vigencia: "VIGENTE", estadoPago, reservadaEl: momento, ...plazo, precio,
        creadoPorUsuarioId: actor.tipo === "USUARIO" ? actor.usuarioId : null, createdAtInscripcion: momento,
      },
      select: SELECT_RESUMEN,
    });
  } catch (error) {
    if (esConflictoDeReserva(error)) throw ocupado;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorDeDominio(propio ? "errores.inscripcion.alumnoYaAsignadoPropio" : "errores.inscripcion.alumnoYaAsignado", { alumno_id: alumnoId });
    }
    throw error;
  }

  // 7. Estado guardado de la clase e historial.
  const estado = await recalcularEstadoTurno(tx, turnoId, momento);
  encolarHistorial(tx, {
    tipo: "INSCRIPCION", inscripcionId: creada.idInscripcion,
    vigenciaAnterior: null, vigenciaNueva: "VIGENTE", estadoPagoAnterior: null, estadoPagoNuevo: estadoPago,
    actor, fecha: momento,
  });
  const alumnoIds = [...vigentesAntes.map((v) => v.alumnoId), alumnoId];
  return {
    inscripcion: resumen(creada),
    estadoTurno: estado?.nuevo ?? turno.estadoTurno,
    completado: Boolean(estado?.cambio && estado.nuevo === "COMPLETO"),
    inscriptos: alumnoIds.length,
    cupo,
    alumnoIds,
  };
}

/**
 * Superposición con otra clase del alumno: la misma condición que el EXCLUDE
 * de `reservas_turno`, que solo proyecta inscripciones vigentes de clases
 * Disponibles o Completas. Las reservas vencidas del alumno ya se marcaron.
 */
async function alumnoTieneClaseSuperpuesta(tx: Tx, alumnoId: string, turnoId: string): Promise<boolean> {
  const filas = await tx.$queryRaw<{ existe: number }[]>(Prisma.sql`
    SELECT 1 AS existe FROM "reservas_turno" r, "turnos" t
    WHERE t."idTurno" = ${turnoId} AND r."tipoRecurso" = 'ALUMNO' AND r."recursoId" = ${alumnoId} AND r."turnoId" <> ${turnoId}
      AND tsrange(r."inicioReserva", r."finReserva", '[)') && tsrange(
        t."fechaTurno" + t."horaInicioTurno",
        t."fechaTurno" + t."horaInicioTurno" + t."duracionMinutosTurno" * interval '1 minute', '[)')
    LIMIT 1`);
  return filas.length > 0;
}

// ---------------------------------------------------------------------------
// Finalización
// ---------------------------------------------------------------------------

export type VigenciaFinal = Exclude<VigenciaInscripcion, "VIGENTE">;

export type InscripcionFinalizada = {
  inscripcionId: string;
  turnoId: string;
  alumnoId: string;
  vigencia: VigenciaFinal;
  estadoPago: EstadoPagoInscripcion;
  estadoTurno: { anterior: EstadoTurno; nuevo: EstadoTurno; cambio: boolean } | null;
};

/**
 * Termina una inscripción vigente (PR-0.md §2.13): CANCELADA_ALUMNO,
 * RESERVA_VENCIDA, BAJA_ALUMNO o QUITADA_CENTRO. La inscripción no se borra:
 * `estadoPago` y el plazo quedan congelados. Condición atómica sobre la
 * vigencia actual; con `soloSiReservaPendiente` exige además una reserva
 * RESERVADA no vencida (HU-C-26 criterio 6, RESERVA_NO_PENDIENTE). Recalcula
 * `Turno.estado` y libera la franja del alumno (el trigger borra su reserva).
 */
export async function finalizarInscripcion(
  tx: Tx,
  datos: { inscripcionId: string; vigencia: VigenciaFinal; actor: ActorDominio; fecha?: Date; soloSiReservaPendiente?: boolean },
): Promise<InscripcionFinalizada> {
  const momento = ahora();
  const fecha = datos.fecha ?? momento;
  const previa = await tx.turnoAlumno.findUnique({ where: { idInscripcion: datos.inscripcionId }, select: { turnoId: true } });
  if (!previa) throw new ErrorDeDominio("errores.inscripcion.noEncontrada");
  await bloquear(tx, { clases: [previa.turnoId], inscripciones: [datos.inscripcionId] });

  const condicionReserva = datos.soloSiReservaPendiente
    ? Prisma.sql`AND "estadoPago" = 'RESERVADA' AND "venceEl" > ${sqlInstante(momento)}`
    : Prisma.empty;
  const { actorTipo, usuarioId } = columnasActor(datos.actor);
  const filas = await tx.$queryRaw<{ turnoId: string; alumnoId: string; estadoPago: EstadoPagoInscripcion }[]>(Prisma.sql`
    UPDATE "turno_alumno"
    SET "vigencia" = ${datos.vigencia}::"VigenciaInscripcion", "finalizadaEl" = ${sqlInstante(fecha)},
        "finalizadaPorActorTipo" = ${actorTipo}::"ActorTipo", "finalizadaPorUsuarioId" = ${usuarioId}
    WHERE "idInscripcion" = ${datos.inscripcionId} AND "vigencia" = 'VIGENTE' ${condicionReserva}
    RETURNING "turnoId", "alumnoId", "estadoPago"`);
  if (filas.length === 0) {
    throw new ErrorDeDominio(datos.soloSiReservaPendiente ? "errores.reserva.noPendiente" : "errores.inscripcion.noVigente");
  }
  const [fila] = filas as [(typeof filas)[number]];
  const estadoTurno = await recalcularEstadoTurno(tx, fila.turnoId, momento);
  encolarHistorial(tx, {
    tipo: "INSCRIPCION", inscripcionId: datos.inscripcionId,
    vigenciaAnterior: "VIGENTE", vigenciaNueva: datos.vigencia,
    estadoPagoAnterior: fila.estadoPago, estadoPagoNuevo: fila.estadoPago,
    actor: datos.actor, fecha,
  });
  return { inscripcionId: datos.inscripcionId, turnoId: fila.turnoId, alumnoId: fila.alumnoId, vigencia: datos.vigencia, estadoPago: fila.estadoPago, estadoTurno };
}

// ---------------------------------------------------------------------------
// Estado de pago (lo llama el servicio de pagos con el conteo que calcula: Regla N.° 3)
// ---------------------------------------------------------------------------

export type CambioEstadoPago = {
  cambio: boolean;
  anterior: EstadoPagoInscripcion;
  nuevo: EstadoPagoInscripcion;
  venceEl: Date | null;
};

async function inscripcionBloqueada(tx: Tx, inscripcionId: string) {
  const previa = await tx.turnoAlumno.findUnique({ where: { idInscripcion: inscripcionId }, select: { turnoId: true } });
  if (!previa) throw new ErrorDeDominio("errores.inscripcion.noEncontrada");
  await bloquear(tx, { clases: [previa.turnoId], inscripciones: [inscripcionId] });
  const fila = await tx.turnoAlumno.findUniqueOrThrow({
    where: { idInscripcion: inscripcionId },
    select: { ...SELECT_RESUMEN, turno: { select: { estadoTurno: true, fechaTurno: true, horaInicioTurno: true } } },
  });
  return fila;
}

async function pasarAPagada(tx: Tx, inscripcionId: string, anterior: EstadoPagoInscripcion, actor: ActorDominio, momento: Date): Promise<CambioEstadoPago> {
  if (anterior === "PAGADA") return { cambio: false, anterior, nuevo: anterior, venceEl: null };
  const { count } = await tx.turnoAlumno.updateMany({
    where: { idInscripcion: inscripcionId, vigencia: "VIGENTE", estadoPago: anterior },
    data: { estadoPago: "PAGADA", venceBaseEl: null, venceEl: null },
  });
  if (count === 0) return { cambio: false, anterior, nuevo: anterior, venceEl: null };
  encolarHistorial(tx, {
    tipo: "INSCRIPCION", inscripcionId, vigenciaAnterior: "VIGENTE", vigenciaNueva: "VIGENTE",
    estadoPagoAnterior: anterior, estadoPagoNuevo: "PAGADA", actor, fecha: momento,
  });
  return { cambio: true, anterior, nuevo: "PAGADA", venceEl: null };
}

/**
 * Deja la inscripción PAGADA (limpia `venceBaseEl` y `venceEl`). Recibe el
 * conteo de pagos no anulados que calculó el servicio de pagos (R3-PR0-I3),
 * que tiene que ser al menos 1. Una inscripción no vigente no cambia.
 */
export async function marcarPagada(tx: Tx, inscripcionId: string, pagosNoAnulados: number, actor: ActorDominio): Promise<CambioEstadoPago> {
  if (pagosNoAnulados < 1) throw new Error("marcarPagada: hace falta al menos un pago no anulado");
  const momento = ahora();
  const fila = await inscripcionBloqueada(tx, inscripcionId);
  if (fila.vigencia !== "VIGENTE") return { cambio: false, anterior: fila.estadoPago, nuevo: fila.estadoPago, venceEl: fila.venceEl };
  return pasarAPagada(tx, inscripcionId, fila.estadoPago, actor, momento);
}

/**
 * Mantiene «Pagada ⇔ al menos un pago no anulado» después de corregir o
 * anular un pago (PR-0.md §2.13, HU-C-24 criterio 5):
 * - con pagos no anulados: PAGADA;
 * - sin pagos y estaba PAGADA, en una clase Disponible o Completa que no
 *   empezó: vuelve a RESERVADA con un plazo nuevo desde ahora (el plazo
 *   vigente), `venceEl = min(venceBaseEl, inicio)` y `reabiertaPorAnulacion`;
 * - sin pagos y la clase ya empezó o está cancelada: PAGO_SIN_REGISTRAR
 *   (informativo, sin reserva);
 * - una inscripción que ya no es vigente no cambia.
 */
export async function recalcularEstadoPago(tx: Tx, inscripcionId: string, pagosNoAnulados: number, actor: ActorDominio): Promise<CambioEstadoPago> {
  const momento = ahora();
  const fila = await inscripcionBloqueada(tx, inscripcionId);
  const sinCambio = { cambio: false, anterior: fila.estadoPago, nuevo: fila.estadoPago, venceEl: fila.venceEl };
  if (fila.vigencia !== "VIGENTE") return sinCambio;
  if (pagosNoAnulados > 0) return pasarAPagada(tx, inscripcionId, fila.estadoPago, actor, momento);
  if (fila.estadoPago !== "PAGADA") return sinCambio;

  const inicio = inicioDeTurno(fila.turno);
  const reabre = ESTADOS_CONFIRMADOS.includes(fila.turno.estadoTurno) && inicio.getTime() > momento.getTime();
  let nuevo: EstadoPagoInscripcion = "PAGO_SIN_REGISTRAR";
  let venceEl: Date | null = null;
  let datos: Prisma.TurnoAlumnoUpdateManyMutationInput = { estadoPago: "PAGO_SIN_REGISTRAR", venceBaseEl: null, venceEl: null };
  if (reabre) {
    const { plazoPagoHoras } = await parametrosVigentes(tx);
    const vencimiento = calcularVencimiento(momento, inicio, plazoPagoHoras);
    nuevo = "RESERVADA";
    venceEl = vencimiento.venceEl;
    datos = { estadoPago: "RESERVADA", inicioPlazo: momento, ...vencimiento, reabiertaPorAnulacion: true };
  }
  const { count } = await tx.turnoAlumno.updateMany({ where: { idInscripcion: inscripcionId, vigencia: "VIGENTE", estadoPago: "PAGADA" }, data: datos });
  if (count === 0) return sinCambio;
  encolarHistorial(tx, {
    tipo: "INSCRIPCION", inscripcionId, vigenciaAnterior: "VIGENTE", vigenciaNueva: "VIGENTE",
    estadoPagoAnterior: "PAGADA", estadoPagoNuevo: nuevo, actor, fecha: momento,
  });
  return { cambio: true, anterior: "PAGADA", nuevo, venceEl };
}

// ---------------------------------------------------------------------------
// Lecturas de clases para otros módulos (spec_modulo_I.md §2.17, P-I9)
// ---------------------------------------------------------------------------

export type ClaseBasica = {
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoTurno;
  materia: { id: string; nombre: string };
  profesor: { id: string; nombre_para_mostrar: string } | null;
  /** Inicio de la clase como instante (zona del centro). */
  inicio: Date;
};

const hhmm = (minutos: number) => `${String(Math.floor(minutos / 60) % 24).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** Datos básicos de las clases pedidas, en el orden de los ids; los inexistentes se omiten. Solo lectura, sin bloqueo. */
export async function obtenerClasesBasicas(turnoIds: string[], db: Db = prisma): Promise<ClaseBasica[]> {
  const unicos = [...new Set(turnoIds)];
  if (unicos.length === 0) return [];
  const turnos = await db.turno.findMany({
    where: { idTurno: { in: unicos } },
    select: {
      idTurno: true, fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true, estadoTurno: true,
      materia: { select: { idMateria: true, nombreMateria: true } },
      profesor: { select: { idProfesor: true, nombreProfesor: true, apellidoProfesor: true } },
    },
  });
  const porId = new Map(turnos.map((t) => [t.idTurno, t]));
  return unicos.flatMap((id) => {
    const t = porId.get(id);
    if (!t) return [];
    const inicioMin = t.horaInicioTurno.getUTCHours() * 60 + t.horaInicioTurno.getUTCMinutes();
    return [{
      turno_id: t.idTurno,
      fecha: t.fechaTurno.toISOString().slice(0, 10),
      hora_inicio: hhmm(inicioMin),
      hora_fin: hhmm(inicioMin + t.duracionMinutosTurno),
      estado: t.estadoTurno,
      materia: { id: t.materia.idMateria, nombre: t.materia.nombreMateria },
      profesor: t.profesor ? { id: t.profesor.idProfesor, nombre_para_mostrar: `${t.profesor.apellidoProfesor}, ${t.profesor.nombreProfesor}` } : null,
      inicio: inicioDeTurno(t),
    }];
  });
}
