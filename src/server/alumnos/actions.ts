"use server";

import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import {
  ContactoAlumnoSchema,
  FormaPagoPreferidaSchema,
  crearIdentidadAlumnoSchema,
  construirModificarAlumnoSchema,
} from "@/server/alumnos/alumno.schema";
import {
  actualizarContactoAlumno as actualizarContactoAlumnoEnServicio,
  actualizarFormaPagoPreferida as actualizarFormaPagoPreferidaEnServicio,
  crearAlumno as crearAlumnoService,
  modificarAlumno as modificarAlumnoEnServicio,
  type CamposProvistosModificarAlumno,
} from "@/server/alumnos/alumno.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";
import type { ResultadoContactoAlumno, ResultadoModificarAlumno } from "@/types/alumno.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

// Traducción código de servicio -> texto exacto para el usuario
// (spec_modulo_B.md §2.2/§2.3/§2.5). Vive acá, no en el servicio, mismo
// criterio que app/(dashboard)/profesores/actions.ts: no acoplar la capa de
// negocio al copy de UI.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  EMAIL_YA_ASOCIADO: "Ese email ya está asociado a una cuenta existente",
  ALUMNO_NO_ENCONTRADO: "El alumno ya no existe",
  FORMA_PAGO_NO_DISPONIBLE: "La forma de pago seleccionada ya no está disponible",
  DNI_DUPLICADO: "Ya existe un alumno registrado con ese DNI",
  CONFLICTO_EDICION_CONCURRENTE: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales",
  EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE:
    "No se puede modificar el email de un alumno con cuenta vinculada. Esta función está pendiente de una actualización del sistema.",
};

type ResultadoFormaPagoPreferida =
  | { data: { id: string; forma_pago_preferida_id: string | null }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };

type ResultadoCrearAlumno =
  | {
      data: { id: string; nombre: string; apellido: string; dni: string; activo: boolean };
      error: null;
    }
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

/**
 * Server Action equivalente a `POST /api/alumnos` (spec_modulo_B.md §2.1).
 * Movida acá desde `src/app/(dashboard)/alumnos/actions.ts` (deuda técnica
 * de HU-B-01, corregida como parte de HU-B-06 §1 punto 3: violaba la Regla
 * N.° 11 de `docs/RULES.md` — las Server Actions van en
 * `src/server/<modulo>/actions.ts`, nunca sueltas junto a una página). Mismo
 * contrato como objeto plano serializable (Regla N.° 5) — nunca una
 * instancia de `NextResponse`. Recibe el payload ya como objeto (no
 * `FormData`): el formulario de alta arma el objeto antes de llamarla.
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

/**
 * Server Action equivalente a `PATCH /api/alumnos/[id]` (HU-B-06,
 * `spec_modulo_B.md` §2.5). Recibe `FormData` del formulario único
 * (`editar-alumno-form.tsx`): ese formulario ya calculó el diff campo por
 * campo contra el valor cargado (lo necesita igual para deshabilitar
 * "Guardar", criterio 5) y solo agrega al `FormData` las claves que
 * efectivamente cambiaron — por eso `formData.has(clave)` alcanza como
 * `camposProvistos` acá: un campo sin cambios nunca llega a esta función.
 * `version` viaja siempre (hidden input, no participa del diff).
 *
 * Conversión `"" -> null` para `genero`/`forma_pago_id`: mismo criterio que
 * `actualizarFormaPagoPreferida()` de arriba — un `<select>` HTML no puede
 * mandar `null`, así que la opción "sin especificar"/"sin preferencia" llega
 * como `""` y se convierte acá, antes del `safeParse()`.
 */
export async function modificarAlumno(
  alumnoId: string,
  formData: FormData,
): Promise<ResultadoModificarAlumno> {
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  const generoCrudo = formData.get("genero");
  const formaPagoCrudo = formData.get("forma_pago_id");

  const payload: Record<string, unknown> = { version: Number(formData.get("version")) };
  if (formData.has("nombre")) payload.nombre = formData.get("nombre");
  if (formData.has("apellido")) payload.apellido = formData.get("apellido");
  if (formData.has("dni")) payload.dni = formData.get("dni");
  if (formData.has("fecha_nacimiento")) payload.fecha_nacimiento = formData.get("fecha_nacimiento");
  if (formData.has("genero")) payload.genero = generoCrudo === "" ? null : generoCrudo;
  if (formData.has("telefono")) payload.telefono = formData.get("telefono");
  if (formData.has("email")) payload.email = formData.get("email");
  if (formData.has("forma_pago_id")) payload.forma_pago_id = formaPagoCrudo === "" ? null : formaPagoCrudo;

  const parsed = construirModificarAlumnoSchema(dniLongitudMin, dniLongitudMax).safeParse(payload);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const { id: usuarioModificadorId } = await verificarPermiso("alumnos:editar");
    const camposProvistos: CamposProvistosModificarAlumno = {
      nombre: formData.has("nombre"),
      apellido: formData.has("apellido"),
      dni: formData.has("dni"),
      fecha_nacimiento: formData.has("fecha_nacimiento"),
      genero: formData.has("genero"),
      telefono: formData.has("telefono"),
      email: formData.has("email"),
      forma_pago_id: formData.has("forma_pago_id"),
    };
    const resultado = await modificarAlumnoEnServicio(
      alumnoId,
      parsed.data,
      camposProvistos,
      usuarioModificadorId,
    );
    revalidatePath("/alumnos");
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
