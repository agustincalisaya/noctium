"use server";

import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import {
  AsociarMateriasProfesorSchema,
  ProfesorIdSchema,
} from "@/server/profesores/profesor.schema";
import { asociarMateriasAProfesor } from "@/server/profesores/profesor.service";
import type { EstadoAsociarMaterias } from "@/types/profesor.types";

// Actions del módulo D en la ubicación de la Regla N.° 11. Las de HU-D-01/D-02
// siguen en app/(dashboard)/profesores/actions.ts hasta su refactor propio
// (HU-D-03 §1 punto 1).

// Traducción código de servicio -> texto para el usuario (Regla N.° 5): vive
// acá, no en el servicio. PROFESOR_NO_ENCONTRADO repite el texto de HU-D-02
// (app/(dashboard)/profesores/actions.ts): un archivo "use server" solo puede
// exportar funciones async, así que no se puede importar la constante.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  PROFESOR_INACTIVO: "Solo pueden asociarse materias a profesores activos",
  PROFESOR_NO_ENCONTRADO: "El profesor ya no existe",
  MATERIA_NO_ENCONTRADA: "Alguna de las materias seleccionadas ya no existe. Recargá la página",
  MATERIA_YA_ASOCIADA: "Alguna de las materias ya está asociada al profesor. Recargá la página",
};

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

function materiasDeDetalles(error: ServiceError): { id: string; nombre: string }[] {
  const materias = error.detalles?.materias;
  return Array.isArray(materias) ? (materias as { id: string; nombre: string }[]) : [];
}

/**
 * Asociación de materias al profesor (HU-D-03, `spec_modulo_D.md` §2.3).
 * Wrapper delgado sobre `asociarMateriasAProfesor()` (Regla N.° 4), mismo
 * patrón que `actualizarContactoProfesor` (HU-D-02): invocación directa
 * desde el formulario, sin `useActionState`, con estado propio. Permiso
 * primero — el rechazo por rol vale aunque la action se invoque sin pasar
 * por la página —, después Zod, después el servicio; ningún error llega al
 * cliente con detalle técnico.
 */
export async function asociarMateriasProfesor(
  profesorId: string,
  formData: FormData,
): Promise<EstadoAsociarMaterias> {
  try {
    const { id: usuarioId } = await verificarPermiso("profesores:editar");

    const profesorIdParsed = ProfesorIdSchema.safeParse(profesorId);
    if (!profesorIdParsed.success) {
      return { status: "error", mensaje: MENSAJES_POR_CODIGO.PROFESOR_NO_ENCONTRADO! };
    }

    const parsed = AsociarMateriasProfesorSchema.safeParse({
      materiaIds: formData.getAll("materiaIds"),
    });
    if (!parsed.success) {
      return { status: "error_validacion", errores: flattenError(parsed.error).fieldErrors };
    }

    const asociadas = await asociarMateriasAProfesor(
      profesorIdParsed.data,
      parsed.data.materiaIds,
      usuarioId,
    );

    // HU-L-02 muestra la cantidad de profesores por materia en el listado y
    // los profesores asociados en el detalle: también quedan desactualizados.
    revalidatePath("/profesores");
    revalidatePath(`/profesores/${profesorIdParsed.data}`);
    revalidatePath("/materias");
    for (const materia of asociadas) {
      revalidatePath(`/materias/${materia.id}`);
    }

    // Toda materia recién asociada está activa (HU-D-03 §1 punto 12).
    return {
      status: "exito",
      asociadas: asociadas.map((materia) => ({ ...materia, activa: true })),
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "MATERIA_INACTIVA") {
        return { status: "materias_inactivas", materias: materiasDeDetalles(error) };
      }
      const mensaje = MENSAJES_POR_CODIGO[error.code] ?? MENSAJE_ERROR_COMUNICACION;
      return { status: "error", mensaje };
    }
    if (error instanceof PermisoError) {
      return { status: "error", mensaje: error.message };
    }
    return { status: "error_comunicacion" };
  }
}
