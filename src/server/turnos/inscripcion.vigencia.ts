import { Prisma, type EstadoPagoInscripcion, type EstadoTurno, type VigenciaInscripcion } from "@prisma/client";
import type { Tx } from "@/server/shared/transaccion";

/**
 * «Vigente a un momento dado» (PR-0.md §2.2, spec_modulo_C.md §2.16.3): ÚNICA
 * implementación de la regla de quién cuenta como inscripto. Nadie lee
 * `vigencia`, `estadoPago` ni `venceEl` por su cuenta para decidirlo.
 */

type Db = Tx | Pick<Prisma.TransactionClient, "turno" | "turnoAlumno">;

/** Lo que la regla necesita de una inscripción: sus columnas y el estado de su clase. */
export type InscripcionParaVigencia = {
  vigencia: VigenciaInscripcion;
  estadoPago: EstadoPagoInscripcion;
  venceEl: Date | null;
  estadoClase: EstadoTurno;
};

const ESTADOS_CONFIRMADOS: readonly EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];

/**
 * `true` si la inscripción es `VIGENTE` y, si es una reserva (`RESERVADA`) de
 * una clase Disponible o Completa, todavía no venció: vence cuando el momento
 * es igual o posterior a `venceEl`. En una clase Cancelada las reservas dejan
 * de vencer (HU-C-24, criterio 6).
 */
export function esVigenteEn(inscripcion: InscripcionParaVigencia, momento: Date): boolean {
  if (inscripcion.vigencia !== "VIGENTE") return false;
  if (inscripcion.estadoPago !== "RESERVADA") return true;
  if (!ESTADOS_CONFIRMADOS.includes(inscripcion.estadoClase)) return true;
  // El CHECK turno_alumno_vencimiento_check garantiza venceEl en una RESERVADA.
  return inscripcion.venceEl === null || momento.getTime() < inscripcion.venceEl.getTime();
}

const ALIAS_VALIDO = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Un instante como parámetro SQL comparable con las columnas `timestamp(3)`
 * (Prisma las guarda en UTC), sin depender del TimeZone de la sesión.
 */
export function sqlInstante(momento: Date): Prisma.Sql {
  return Prisma.sql`(${momento.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/**
 * Fragmento SQL equivalente a `esVigenteEn` para consultas crudas y agregadas,
 * sobre la fila `alias` de `turno_alumno`. `momento` viaja como parámetro (el
 * SQL nunca usa `now()`) y se compara en UTC, igual que guarda Prisma.
 */
export function sqlVigenteEn(alias: string, momento: Date): Prisma.Sql {
  if (!ALIAS_VALIDO.test(alias)) throw new Error(`sqlVigenteEn: alias inválido "${alias}"`);
  const a = Prisma.raw(`"${alias}"`);
  const instante = sqlInstante(momento);
  return Prisma.sql`(${a}."vigencia" = 'VIGENTE' AND (
    ${a}."estadoPago" <> 'RESERVADA'
    OR ${a}."venceEl" IS NULL
    OR ${a}."venceEl" > ${instante}
    OR NOT EXISTS (
      SELECT 1 FROM "turnos" vigencia_turno
      WHERE vigencia_turno."idTurno" = ${a}."turnoId"
        AND vigencia_turno."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
    )
  ))`;
}

// Filtro de Prisma equivalente, en un archivo sin dependencias de servidor.
export { filtroVigenteEn } from "./inscripcion.filtro";

/** Inscripciones de la clase vigentes a `momento`, como las expone la fachada de C. */
export async function inscripcionesVigentes(db: Db, turnoId: string, momento: Date): Promise<{ id: string; alumnoId: string }[]> {
  const turno = await db.turno.findUnique({ where: { idTurno: turnoId }, select: { estadoTurno: true } });
  if (!turno) return [];
  const filas = await db.turnoAlumno.findMany({
    where: { turnoId, vigencia: "VIGENTE" },
    select: { idInscripcion: true, alumnoId: true, vigencia: true, estadoPago: true, venceEl: true },
    orderBy: { idInscripcion: "asc" },
  });
  return filas
    .filter((fila) => esVigenteEn({ ...fila, estadoClase: turno.estadoTurno }, momento))
    .map((fila) => ({ id: fila.idInscripcion, alumnoId: fila.alumnoId }));
}

export type Ocupacion = {
  inscriptos: number;
  cupo: number | null;
  /** Estado guardado de la clase. */
  estadoGuardado: EstadoTurno;
  /**
   * Estado que se muestra y con el que se decide: en una clase confirmada,
   * COMPLETO si las inscripciones vigentes llenan el cupo y si no DISPONIBLE;
   * PENDIENTE y CANCELADO, tal cual.
   */
  estado: EstadoTurno;
};

/** Ocupación de la clase a `momento` (cupo, superposición y estado mostrado). `null` si no existe. */
export async function ocupacion(db: Db, turnoId: string, momento: Date): Promise<Ocupacion | null> {
  const turno = await db.turno.findUnique({
    where: { idTurno: turnoId },
    select: { estadoTurno: true, cupoMaximoTurno: true },
  });
  if (!turno) return null;
  const inscriptos = (await inscripcionesVigentes(db, turnoId, momento)).length;
  return {
    inscriptos,
    cupo: turno.cupoMaximoTurno,
    estadoGuardado: turno.estadoTurno,
    estado: estadoSegunOcupacion(turno.estadoTurno, inscriptos, turno.cupoMaximoTurno),
  };
}

/** DISPONIBLE ⇄ COMPLETO solo en clases confirmadas; PENDIENTE y CANCELADO no cambian. */
export function estadoSegunOcupacion(estadoGuardado: EstadoTurno, inscriptos: number, cupo: number | null): EstadoTurno {
  if (!ESTADOS_CONFIRMADOS.includes(estadoGuardado)) return estadoGuardado;
  return cupo !== null && inscriptos >= cupo ? "COMPLETO" : "DISPONIBLE";
}

/**
 * Recalcula y guarda `Turno.estado` (DISPONIBLE ⇄ COMPLETO) con las
 * inscripciones vigentes a `momento` (PR-0.md §2.2). No cambia una clase
 * PENDIENTE ni CANCELADO (la salida de PENDIENTE es exclusiva del alta de la
 * clase, spec_modulo_C.md §2.16.5). El llamador ya bloqueó la clase; el
 * `updateMany` con el estado anterior en la condición igual es atómico.
 */
export async function recalcularEstadoTurno(
  tx: Tx,
  turnoId: string,
  momento: Date,
): Promise<{ anterior: EstadoTurno; nuevo: EstadoTurno; cambio: boolean } | null> {
  const actual = await ocupacion(tx, turnoId, momento);
  if (!actual) return null;
  const { estadoGuardado: anterior, estado: nuevo } = actual;
  if (nuevo === anterior) return { anterior, nuevo, cambio: false };
  const { count } = await tx.turno.updateMany({ where: { idTurno: turnoId, estadoTurno: anterior }, data: { estadoTurno: nuevo } });
  return { anterior, nuevo: count === 1 ? nuevo : anterior, cambio: count === 1 };
}

/**
 * Vencimiento de una reserva (PR-0.md §2.2): `venceBaseEl = momento + plazo`,
 * sin el tope de la clase, y `venceEl = min(venceBaseEl, inicio de la clase)`.
 */
export function calcularVencimiento(momento: Date, inicioClase: Date, plazoHoras: number): { venceBaseEl: Date; venceEl: Date } {
  const venceBaseEl = new Date(momento.getTime() + plazoHoras * 60 * 60 * 1000);
  const venceEl = venceBaseEl.getTime() <= inicioClase.getTime() ? venceBaseEl : new Date(inicioClase.getTime());
  return { venceBaseEl, venceEl };
}
