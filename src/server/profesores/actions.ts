"use server";

import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico, obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { mensajeSuperposicion, type DiaSemanaValor } from "@/lib/horario-atencion";
import {
  ActualizarMateriasProfesorSchema,
  AsociarMateriasProfesorSchema,
  ProfesorIdSchema,
  construirModificarProfesorSchema,
  construirRegistrarHorarioSchema,
} from "@/server/profesores/profesor.schema";
import {
  actualizarMateriasDeProfesor,
  asociarMateriasAProfesor,
  modificarProfesor as modificarProfesorEnServicio,
  registrarHorarioProfesor as registrarHorario,
} from "@/server/profesores/profesor.service";
import type {
  EstadoAsociarMaterias,
  EstadoRegistrarHorario,
  MateriaBloqueadaPorTurnos,
  ResultadoActualizarMaterias,
  ResultadoModificarProfesor,
} from "@/types/profesor.types";

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

// Traducción de HU-D-04 (Regla N.° 5). Los errores de intervalo que el
// servicio revalida (día, granularidad, franja) ya traen el texto de
// validarIntervaloHorario(), el mismo que muestra el schema en el cliente.
const MENSAJES_HORARIO_POR_CODIGO: Record<string, string> = {
  PROFESOR_INACTIVO: "Solo pueden registrarse horarios de profesores activos",
  PROFESOR_NO_ENCONTRADO: "El profesor ya no existe",
};

const CODIGOS_ERROR_INTERVALO = new Set([
  "DIA_NO_OPERATIVO",
  "HORA_NO_GRANULAR",
  "HORARIO_INVERTIDO",
  "FUERA_DE_HORARIO_OPERATIVO",
]);

/**
 * Registro de horario de atención (HU-D-04, `spec_modulo_D.md` §2.4). Mismo
 * patrón que `asociarMateriasProfesor`: invocación directa desde el
 * formulario, permiso primero, después Zod (armado con los parámetros
 * operativos vigentes leídos en el servidor, nunca los que mande el
 * cliente), después el servicio. Ningún error llega con detalle técnico.
 */
export async function registrarHorarioProfesor(formData: FormData): Promise<EstadoRegistrarHorario> {
  try {
    const { id: usuarioId } = await verificarPermiso("profesores:editar");

    const schema = construirRegistrarHorarioSchema(await obtenerParametrosHorarioOperativo());
    const parsed = schema.safeParse({
      profesorId: formData.get("profesorId"),
      diaSemana: formData.get("diaSemana"),
      horaInicio: formData.get("horaInicio"),
      horaFin: formData.get("horaFin"),
    });
    if (!parsed.success) {
      return { status: "error_validacion", errores: flattenError(parsed.error).fieldErrors };
    }

    const horario = await registrarHorario(parsed.data, usuarioId);

    revalidatePath(`/profesores/${parsed.data.profesorId}`);
    revalidatePath("/profesores/horarios/nuevo");

    return { status: "exito", horario };
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "HORARIO_SUPERPUESTO") {
        const { diaSemana, horaInicio, horaFin } = error.detalles as {
          diaSemana: DiaSemanaValor;
          horaInicio: string;
          horaFin: string;
        };
        return { status: "error", mensaje: mensajeSuperposicion(diaSemana, horaInicio, horaFin) };
      }
      if (CODIGOS_ERROR_INTERVALO.has(error.code) && typeof error.detalles?.campo === "string") {
        return { status: "error_validacion", errores: { [error.detalles.campo]: [error.message] } };
      }
      const mensaje = MENSAJES_HORARIO_POR_CODIGO[error.code] ?? MENSAJE_ERROR_COMUNICACION;
      return { status: "error", mensaje };
    }
    if (error instanceof PermisoError) {
      return { status: "error", mensaje: error.message };
    }
    return { status: "error_comunicacion" };
  }
}

// Traducción de HU-D-06 (Regla N.° 5). Mismos textos que el alta y el
// contacto (app/(dashboard)/profesores/actions.ts), que no se pueden importar
// desde un archivo "use server".
const MENSAJES_MODIFICAR_POR_CODIGO: Record<string, string> = {
  DNI_DUPLICADO: "Ya existe un profesor registrado con ese DNI",
  EMAIL_YA_ASOCIADO: "Ese email ya está asociado a otra cuenta",
  CONFLICTO_EDICION_CONCURRENTE: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.",
  PROFESOR_NO_ENCONTRADO: "El profesor ya no existe",
};

/** "" en el FormData = la UI vació el campo: `null` (sin especificar / quitar el medio). */
function vacioANull(valor: FormDataEntryValue | null): FormDataEntryValue | null {
  return valor === "" ? null : valor;
}

/**
 * Modificación de identidad y contacto del profesor (HU-D-06,
 * `spec_modulo_D.md` §2.6). Invocación directa desde el modo edición de la
 * ficha, sin `useActionState`: devuelve `{ data, error }` (Regla N.° 5),
 * igual que `modificarAlumno()` y `modificarMateria()`.
 *
 * El formulario manda solo los campos que cambiaron, más `version`: un campo
 * ausente del FormData no se modifica (`formData.has`). `genero`, `telefono`
 * y `email` vacíos se convierten en `null` antes de validar.
 */
export async function modificarProfesor(
  profesorId: string,
  formData: FormData,
): Promise<ResultadoModificarProfesor> {
  // Sin `version` (o vacía) no se convierte a 0 (`Number(null)`/`Number("")`):
  // queda ausente y el schema la rechaza, porque es obligatoria.
  const version = formData.get("version");
  const payload: Record<string, unknown> = {
    version: typeof version === "string" && version.trim() !== "" ? Number(version) : undefined,
  };
  for (const campo of ["nombre", "apellido", "dni", "fechaNacimiento"] as const) {
    if (formData.has(campo)) payload[campo] = formData.get(campo);
  }
  for (const campo of ["genero", "telefono", "email"] as const) {
    if (formData.has(campo)) payload[campo] = vacioANull(formData.get(campo));
  }

  try {
    const [dniLongitudMin, dniLongitudMax] = await Promise.all([
      getParametroNumerico("dni_longitud_min", 7),
      getParametroNumerico("dni_longitud_max", 8),
    ]);
    const parsed = construirModificarProfesorSchema(dniLongitudMin, dniLongitudMax).safeParse(payload);
    if (!parsed.success) {
      return {
        data: null,
        error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
      };
    }

    const { id: usuarioId } = await verificarPermiso("profesores:editar");
    const resultado = await modificarProfesorEnServicio(profesorId, parsed.data, usuarioId);

    revalidatePath("/profesores");
    revalidatePath(`/profesores/${profesorId}`);

    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "CONTACTO_REQUERIDO") {
        return {
          data: null,
          error: {
            code: "VALIDACION",
            message: "Datos inválidos",
            detalles: { formErrors: [], fieldErrors: { telefono: [error.message] } },
          },
        };
      }
      const mensaje = MENSAJES_MODIFICAR_POR_CODIGO[error.code] ?? MENSAJE_ERROR_COMUNICACION;
      return { data: null, error: { code: error.code, message: mensaje } };
    }
    if (error instanceof PermisoError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    return { data: null, error: { code: "ERROR_COMUNICACION", message: MENSAJE_ERROR_COMUNICACION } };
  }
}

// Traducción de HU-D-07 (Regla N.° 5): mismos textos que la asociación de
// HU-D-03 para los códigos compartidos.
const MENSAJES_MATERIAS_POR_CODIGO: Record<string, string> = {
  ...MENSAJES_POR_CODIGO,
  MATERIA_CON_TURNOS_FUTUROS: "No se pudieron guardar los cambios de materias: hay materias con turnos futuros",
  MATERIA_INACTIVA: "Alguna de las materias seleccionadas dejó de estar activa",
};

function bloqueosDeDetalles(error: ServiceError): MateriaBloqueadaPorTurnos[] {
  const detalle = error.detalles?.detalle;
  return Array.isArray(detalle) ? (detalle as MateriaBloqueadaPorTurnos[]) : [];
}

/**
 * Modificación de las materias asociadas (HU-D-07, `spec_modulo_D.md` §2.7).
 * Recibe el conjunto FINAL como arreglo (no `FormData`: un conjunto vacío es
 * válido y `getAll()` no distingue "vacío" de "no enviado"). Invocación
 * directa desde el modo edición de la ficha, sin `useActionState`: devuelve
 * `{ data, error }` (Regla N.° 5), igual que `modificarProfesor()`. Permiso
 * primero, después Zod, después el servicio.
 */
export async function actualizarMateriasProfesor(
  profesorId: string,
  materiaIds: string[],
): Promise<ResultadoActualizarMaterias> {
  try {
    const { id: usuarioId } = await verificarPermiso("profesores:editar");

    const profesorIdParsed = ProfesorIdSchema.safeParse(profesorId);
    if (!profesorIdParsed.success) {
      return {
        data: null,
        error: { code: "PROFESOR_NO_ENCONTRADO", message: MENSAJES_POR_CODIGO.PROFESOR_NO_ENCONTRADO! },
      };
    }
    const parsed = ActualizarMateriasProfesorSchema.safeParse({ materia_ids: materiaIds });
    if (!parsed.success) {
      return {
        data: null,
        error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
      };
    }

    const resultado = await actualizarMateriasDeProfesor(
      profesorIdParsed.data,
      parsed.data.materia_ids,
      usuarioId,
    );

    if (!resultado.sin_cambios) {
      // HU-L-02 muestra los profesores de cada materia: también cambian.
      revalidatePath("/profesores");
      revalidatePath(`/profesores/${profesorIdParsed.data}`);
      revalidatePath("/materias");
      for (const id of [...resultado.agregadas, ...resultado.quitadas]) {
        revalidatePath(`/materias/${id}`);
      }
    }
    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof ServiceError) {
      const message = MENSAJES_MATERIAS_POR_CODIGO[error.code] ?? MENSAJE_ERROR_COMUNICACION;
      if (error.code === "MATERIA_CON_TURNOS_FUTUROS") {
        return { data: null, error: { code: error.code, message, detalle: bloqueosDeDetalles(error) } };
      }
      if (error.code === "MATERIA_INACTIVA") {
        return { data: null, error: { code: error.code, message, materias: materiasDeDetalles(error) } };
      }
      return { data: null, error: { code: error.code, message } };
    }
    if (error instanceof PermisoError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    return { data: null, error: { code: "ERROR_COMUNICACION", message: MENSAJE_ERROR_COMUNICACION } };
  }
}
