import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { profesorPuedeRegistrarIndicacion } from "@/server/historial/asistencia.publico";
import { existeInscripcionVigenteConProfesor } from "@/server/turnos/inscripcion.publico";

/**
 * Alcance del Profesor sobre el historial académico (convención 8 g, PR-0.md
 * §2.9, spec_modulo_E.md §2.5.3). Vive en el servicio de E y no en una
 * fachada, porque combina una lectura de C con una de E (R2-PR0-4).
 *
 * `true` si el alumno tiene una inscripción vigente en una clase de ese
 * profesor y esa materia (incluidas las futuras), o si figura en el registro
 * de una clase dictada no anulada de ese profesor y esa materia. Con `false`
 * el servidor responde 403 antes de consultar si el alumno existe.
 */
export async function profesorPuedeVerHistorial(
  profesorId: string,
  alumnoId: string,
  materiaId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  return (await existeInscripcionVigenteConProfesor(alumnoId, profesorId, materiaId, db))
    || (await profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db));
}

export { profesorPuedeRegistrarIndicacion };
