import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import type { AlumnoBasico, AlumnoResumen, AlumnosNuevosPorMes } from "@/types/alumno.types";

/** Contrato público del Módulo B (§2.8): ficha vinculada a la cuenta de sesión. */
export async function obtenerAlumnoDeUsuario(usuarioId: string, db: Prisma.TransactionClient = prisma) {
  const alumno = await db.alumno.findUnique({
    where: { usuarioId },
    select: { idAlumno: true, activoAlumno: true },
  });
  return alumno ? { id: alumno.idAlumno, activo: alumno.activoAlumno } : null;
}

export { buscarAlumnosActivos } from "@/server/alumnos/alumno.service";

// Mismos textos que MENSAJES de alumno.service.ts (constante no exportada);
// ALUMNO_INACTIVO no tiene texto allí.
const MENSAJES = {
  ALUMNO_NO_ENCONTRADO: "El alumno ya no existe",
  ALUMNO_INACTIVO: "El alumno está inactivo",
} as const;

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Datos básicos en lote (activos e inactivos). Los ids inexistentes no
 * aparecen, los repetidos cuentan una vez y el orden es el de `ids`.
 * `forma_pago_preferida_id` es la columna tal cual: no se verifica si la
 * forma de pago sigue activa (eso es del módulo de Pagos).
 */
export async function obtenerAlumnosBasicos(
  ids: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<AlumnoBasico[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];

  const filas = await db.alumno.findMany({
    where: { idAlumno: { in: unicos } },
    select: {
      idAlumno: true,
      nombreAlumno: true,
      apellidoAlumno: true,
      dniAlumno: true,
      activoAlumno: true,
      formaPagoPreferidaId: true,
    },
  });
  const porId = new Map(filas.map((fila) => [fila.idAlumno, fila]));
  return unicos.flatMap((id) => {
    const fila = porId.get(id);
    return fila
      ? [{
          id: fila.idAlumno,
          nombre: fila.nombreAlumno,
          apellido: fila.apellidoAlumno,
          dni: fila.dniAlumno,
          activo: fila.activoAlumno,
          forma_pago_preferida_id: fila.formaPagoPreferidaId,
        }]
      : [];
  });
}

/** Resumen de un alumno, activo o inactivo; `null` si no existe. */
export async function obtenerAlumnoBasico(
  id: string,
  db: Prisma.TransactionClient = prisma,
): Promise<AlumnoResumen | null> {
  const alumno = await db.alumno.findUnique({
    where: { idAlumno: id },
    select: { idAlumno: true, nombreAlumno: true, apellidoAlumno: true, activoAlumno: true },
  });
  return alumno
    ? { id: alumno.idAlumno, nombre: alumno.nombreAlumno, apellido: alumno.apellidoAlumno, activo: alumno.activoAlumno }
    : null;
}

/**
 * Resuelve sin error si la ficha existe y está activa. Distingue los dos
 * fallos (`spec_modulo_B.md` §2.8): `ALUMNO_NO_ENCONTRADO` e `ALUMNO_INACTIVO`.
 */
export async function verificarAlumnoActivo(
  alumnoId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  const alumno = await db.alumno.findUnique({
    where: { idAlumno: alumnoId },
    select: { activoAlumno: true },
  });
  if (!alumno) throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);
  if (!alumno.activoAlumno) throw new ServiceError("ALUMNO_INACTIVO", MENSAJES.ALUMNO_INACTIVO);
}

/**
 * Altas de fichas por mes (todas: activas o inactivas, con o sin cuenta),
 * solo los meses con datos, en orden ascendente. `createdAtAlumno` es
 * TIMESTAMP sin zona guardado en UTC: primero se interpreta como UTC y
 * después se pasa a la hora local de Buenos Aires. `desde` y `hasta`
 * (AAAA-MM) son inclusivos.
 */
export async function contarAlumnosNuevosPorMes(
  desde: string,
  hasta: string,
  db: Prisma.TransactionClient = prisma,
): Promise<AlumnosNuevosPorMes[]> {
  if (!MES_REGEX.test(desde) || !MES_REGEX.test(hasta)) {
    throw new Error(`Rango de meses inválido: se esperaba AAAA-MM (desde="${desde}", hasta="${hasta}")`);
  }
  if (desde > hasta) {
    throw new Error(`Rango de meses inválido: desde (${desde}) es posterior a hasta (${hasta})`);
  }

  const filas = await db.$queryRaw<{ mes: string; cantidad: bigint }[]>`
    SELECT mes, COUNT(*) AS cantidad
    FROM (
      SELECT to_char(
        ("createdAtAlumno" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires',
        'YYYY-MM'
      ) AS mes
      FROM "alumnos"
    ) AS altas
    WHERE mes >= ${desde} AND mes <= ${hasta}
    GROUP BY mes
    ORDER BY mes
  `;
  return filas.map(({ mes, cantidad }) => ({ mes, cantidad: Number(cantidad) }));
}
