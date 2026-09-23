"use server";

import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import { ContactoAlumnoSchema, FormaPagoPreferidaSchema } from "@/server/alumnos/alumno.schema";
import {
  actualizarContactoAlumno as actualizarContactoAlumnoEnServicio,
  actualizarFormaPagoPreferida as actualizarFormaPagoPreferidaEnServicio,
} from "@/server/alumnos/alumno.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import type { ResultadoContactoAlumno } from "@/types/alumno.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

// Traducción código de servicio -> texto exacto para el usuario
// (spec_modulo_B.md §2.2/§2.3). Vive acá, no en el servicio, mismo criterio
// que app/(dashboard)/profesores/actions.ts: no acoplar la capa de negocio
// al copy de UI.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  EMAIL_YA_ASOCIADO: "Ese email ya está asociado a una cuenta existente",
  ALUMNO_NO_ENCONTRADO: "El alumno ya no existe",
  FORMA_PAGO_NO_DISPONIBLE: "La forma de pago seleccionada ya no está disponible",
};

type ResultadoFormaPagoPreferida =
  | { data: { id: string; forma_pago_preferida_id: string | null }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };

/**
 * Server Action equivalente a `PATCH /api/alumnos/[id]/contacto`
 * (spec_modulo_B.md §2.2, ubicación fijada por Regla N.° 11 de
 * `docs/RULES.md`). No está ligada a `useActionState` (confirmado contra
 * `contacto-alumno-form.tsx`), así que no aplica la excepción de la Regla
 * N.° 5 — devuelve el shape genérico `{ data, error }` como objeto plano
 * serializable, mismo criterio que `crearAlumno()` de HU-B-01.
 */
export async function actualizarContactoAlumno(
  alumnoId: string,
  formData: FormData,
): Promise<ResultadoContactoAlumno> {
  const parsed = ContactoAlumnoSchema.safeParse({
    telefono: formData.get("telefono"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const { id: usuarioModificadorId } = await verificarPermiso("alumnos:editar");
    // "Provisto" se mira sobre el FormData crudo (formData.has), antes de
    // Zod: distingue "el input no vino" de "vino vacío" — ver docstring de
    // actualizarContactoAlumno() en alumno.service.ts.
    const camposProvistos = { telefono: formData.has("telefono"), email: formData.has("email") };
    const contacto = await actualizarContactoAlumnoEnServicio(
      alumnoId,
      parsed.data,
      camposProvistos,
      usuarioModificadorId,
    );
    revalidatePath("/alumnos");
    revalidatePath(`/alumnos/${alumnoId}`);

    return { data: contacto, error: null };
  } catch (error) {
    if (error instanceof PermisoError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    if (error instanceof ServiceError) {
      const mensaje = MENSAJES_POR_CODIGO[error.code] ?? MENSAJE_ERROR_COMUNICACION;
      return { data: null, error: { code: error.code, message: mensaje } };
    }
    throw error;
  }
}

/**
 * Server Action equivalente a `PATCH /api/alumnos/[id]/forma-pago`
 * (spec_modulo_B.md §2.3, HU-B-03). Mismo patrón que
 * `actualizarContactoAlumno()` de arriba: no está ligada a `useActionState`,
 * devuelve el shape genérico `{ data, error }`.
 *
 * Conversión `"" -> null`: el `<select>` HTML manda `""` para la opción
 * "Sin preferencia" (no puede mandar `null`), pero `FormaPagoPreferidaSchema`
 * espera `null` explícito — se resuelve acá, en la capa delgada, antes del
 * `safeParse()`, mismo criterio que otras conversiones de FormData ya
 * resueltas en este módulo.
 */
export async function actualizarFormaPagoPreferida(
  alumnoId: string,
  formData: FormData,
): Promise<ResultadoFormaPagoPreferida> {
  const crudo = formData.get("forma_pago_id");
  const parsed = FormaPagoPreferidaSchema.safeParse({
    forma_pago_id: crudo === "" ? null : crudo,
  });
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    await verificarPermiso("alumnos:editar");
    const resultado = await actualizarFormaPagoPreferidaEnServicio(alumnoId, parsed.data);
    revalidatePath(`/alumnos/${alumnoId}`);

    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof PermisoError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    if (error instanceof ServiceError) {
      const mensaje = MENSAJES_POR_CODIGO[error.code] ?? MENSAJE_ERROR_COMUNICACION;
      return { data: null, error: { code: error.code, message: mensaje } };
    }
    throw error;
  }
}
