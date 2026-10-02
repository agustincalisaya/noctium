import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import type { AlumnoBasico, AlumnoResumen } from "@/types/alumno.types";

/** Contrato público del Módulo B (§2.8): ficha vinculada a la cuenta de sesión. */
export async function obtenerAlumnoDeUsuario(usuarioId: string, db: Prisma.TransactionClient = prisma) {
  const alumno = await db.alumno.findUnique({
    where: { usuarioId },
    select: { idAlumno: true, activoAlumno: true },
  });
  return alumno ? { id: alumno.idAlumno, activo: alumno.activoAlumno } : null;
}

export { buscarAlumnosActivos } from "@/server/alumnos/alumno.service";

/** IDs de todas las fichas activas; Turnos aplica por su cuenta la elegibilidad horaria. */
export async function listarIdsAlumnosActivos(db: Prisma.TransactionClient = prisma): Promise<string[]> {
  const filas = await db.alumno.findMany({
    where: { activoAlumno: true },
    select: { idAlumno: true },
    orderBy: { idAlumno: "asc" },
  });
  return filas.map(({ idAlumno }) => idAlumno);
}

// Mismos textos que MENSAJES de alumno.service.ts (constante no exportada);
// ALUMNO_INACTIVO no tiene texto allí.
const MENSAJES = {
  ALUMNO_NO_ENCONTRADO: "El alumno ya no existe",
  ALUMNO_INACTIVO: "El alumno está inactivo",
} as const;

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
