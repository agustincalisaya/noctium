import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Contrato público del Módulo B (§2.8): ficha vinculada a la cuenta de sesión. */
export async function obtenerAlumnoDeUsuario(usuarioId: string, db: Prisma.TransactionClient = prisma) {
  const alumno = await db.alumno.findUnique({
    where: { usuarioId },
    select: { idAlumno: true, activoAlumno: true },
  });
  return alumno ? { id: alumno.idAlumno, activo: alumno.activoAlumno } : null;
}
