"use server";

import { crearIdentidadAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { crearAlumno as crearAlumnoService } from "@/server/alumnos/alumno.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";

type ResultadoCrearAlumno =
  | {
      data: { id: string; nombre: string; apellido: string; dni: string; activo: boolean };
      error: null;
    }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };

/**
 * Server Action equivalente a `POST /api/alumnos` (spec_modulo_B.md §2.1).
 * Mismo contrato como objeto plano serializable (Regla N.° 5 de
 * docs/RULES.md) — nunca una instancia de `NextResponse`. Recibe el payload
 * ya como objeto (no `FormData`): el formulario de alta es contrato de
 * frontend, fuera de alcance de esta task.
 */
export async function crearAlumno(input: unknown): Promise<ResultadoCrearAlumno> {
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  const parsed = crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax).safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
    };
  }

  try {
    const { id: usuarioId } = await verificarPermiso("alumnos:crear");
    const alumno = await crearAlumnoService(parsed.data, usuarioId);
    return {
      data: {
        id: alumno.idAlumno,
        nombre: alumno.nombreAlumno,
        apellido: alumno.apellidoAlumno,
        dni: alumno.dniAlumno,
        activo: alumno.activoAlumno,
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof PermisoError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    if (error instanceof ServiceError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}
