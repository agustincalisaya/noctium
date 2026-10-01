import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";

/**
 * Contrato público de pagos del Módulo I (spec_modulo_I.md §2.3, Regla N.° 3):
 * otros módulos leen los pagos por acá y no consultan `pagos` directamente.
 * No exige permiso (lo verifica la ruta del consumidor) y no importa nada del
 * Módulo de Turnos: Pagos consume `turno.publico.ts` y Turnos consume este
 * archivo, así que ninguno de los dos importa al otro.
 */

/** Un pago registrado de un turno, tal como lo muestra el detalle (spec_modulo_C.md §2.4). */
export type PagoDeTurno = {
  id: string;
  alumno: { id: string; nombre_completo: string };
  /** Decimal con punto y dos decimales ("15000.50"), sin pasar por coma flotante. */
  monto: string;
  forma_pago: { id: string; nombre: string };
  /** Fecha de calendario `YYYY-MM-DD`. */
  fecha_pago: string;
  /** Instante de registro en ISO 8601. */
  registrado_en: string;
};

/**
 * Todos los pagos del turno, más recientes primero (por momento de registro,
 * con el id como desempate estable). Incluye los pagos de alumnos que ya no
 * están inscriptos: un pago es un hecho consumado (Regla N.° 8). Los nombres
 * de alumno salen de `obtenerAlumnosBasicos()` en una sola consulta en lote;
 * la forma de pago se lee por la relación propia del módulo, activa o no.
 */
export async function listarPagosDeTurno(
  turnoId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<PagoDeTurno[]> {
  const pagos = await db.pago.findMany({
    where: { turnoId },
    orderBy: [{ createdAtPago: "desc" }, { idPago: "desc" }],
    select: {
      idPago: true,
      alumnoId: true,
      montoPago: true,
      fechaPago: true,
      createdAtPago: true,
      formaPago: { select: { idFormaPago: true, nombreFormaPago: true } },
    },
  });
  if (pagos.length === 0) return [];

  const alumnos = new Map(
    (await obtenerAlumnosBasicos(pagos.map(({ alumnoId }) => alumnoId), db))
      .map((alumno) => [alumno.id, `${alumno.apellido}, ${alumno.nombre}`]),
  );
  return pagos.map((pago) => {
    const nombreCompleto = alumnos.get(pago.alumnoId);
    // La FK es RESTRICT: un alumno con pagos no puede faltar. Si falta, es una
    // inconsistencia de datos y se informa en vez de inventar un nombre.
    if (nombreCompleto === undefined) throw new Error(`Pago ${pago.idPago} sin alumno ${pago.alumnoId}`);
    return {
      id: pago.idPago,
      alumno: { id: pago.alumnoId, nombre_completo: nombreCompleto },
      monto: pago.montoPago.toFixed(2),
      forma_pago: { id: pago.formaPago.idFormaPago, nombre: pago.formaPago.nombreFormaPago },
      fecha_pago: pago.fechaPago.toISOString().slice(0, 10),
      registrado_en: pago.createdAtPago.toISOString(),
    };
  });
}
