import { verificarMateriaActiva } from "@/server/materias/materia.service";
import {
  obtenerHorariosDeAtencion,
  obtenerOpcionProfesorActivo,
  profesorActivoDictaMateria,
} from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";

/** Franjas recurrentes del profesor para HU-C-17; materia_id solo revalida la relación. */
export async function listarFranjasProfesor(profesorId: string, materiaId: string) {
  if (!(await verificarMateriaActiva(materiaId))) {
    throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  }
  if (!(await obtenerOpcionProfesorActivo(profesorId))) {
    throw new ServiceError("PROFESOR_NO_ENCONTRADO", "No se encontró un profesor activo");
  }
  if (!(await profesorActivoDictaMateria(profesorId, materiaId))) {
    throw new ServiceError("PROFESOR_NO_DICTA_MATERIA", "El profesor no dicta la materia seleccionada");
  }
  return obtenerHorariosDeAtencion(profesorId);
}
