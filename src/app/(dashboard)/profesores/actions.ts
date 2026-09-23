"use server";

import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import { prisma } from "@/lib/prisma";
import { getParametroNumerico } from "@/server/shared/parametros";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import {
  construirIdentidadProfesorSchema,
  ContactoProfesorSchema,
} from "@/server/profesores/profesor.schema";
import {
  actualizarContactoProfesor as actualizarContactoProfesorEnServicio,
  crearProfesor as crearProfesorEnServicio,
} from "@/server/profesores/profesor.service";
import type { EstadoContactoProfesor, EstadoNuevoProfesor } from "./profesor.types";

// Traducción código de servicio -> texto exacto para el usuario (HU-D-01,
// criterio de aceptación 3; HU-D-02 criterio 4). Vive acá, no en el servicio,
// mismo criterio que app/(auth)/login/actions.ts: no acoplar la capa de
// negocio al copy de UI.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  DNI_DUPLICADO: "Ya existe un profesor registrado con ese DNI",
  // Genérico a propósito: nunca revela a quién pertenece la otra cuenta.
  EMAIL_YA_ASOCIADO: "Ese email ya está asociado a otra cuenta",
  PROFESOR_NO_ENCONTRADO: "El profesor ya no existe",
};

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

async function resolverLongitudDni(): Promise<{ min: number; max: number }> {
  const [min, max] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);
  return { min, max };
}

/**
 * Alta de identidad de profesor (HU-D-01). Wrapper delgado sobre
 * `crearProfesor()` de `profesor.service.ts` (Regla N.° 4 de
 * `docs/RULES.md`): valida sesión/permiso, valida el payload con Zod,
 * invoca el servicio y traduce el resultado al contrato `{ data, error }`
 * — acá, como `EstadoNuevoProfesor` (Regla N.° 5, forma "Server Action").
 *
 * Todo el flujo vive en un único `try/catch`: ningún error sin traducir
 * llega al cliente ("Definiciones generales" de Sprint 1 — nunca un mensaje
 * técnico ni un detalle interno). `ServiceError` se traduce a un mensaje de
 * campo específico; cualquier otro error (conexión a la base, `PermisoError`
 * si la sesión venció entre que se abrió el formulario y el submit, un
 * `P2002` que el servicio no haya traducido) cae al mismo texto genérico de
 * error de comunicación que usa HU-A-01.
 */
export async function crearProfesor(
  _estadoAnterior: EstadoNuevoProfesor,
  formData: FormData,
): Promise<EstadoNuevoProfesor> {
  try {
    const { id: usuarioRegistranteId } = await verificarPermiso("profesores:crear");

    const { min: dniLongitudMin, max: dniLongitudMax } = await resolverLongitudDni();

    const generoIngresado = formData.get("genero");
    const parsed = construirIdentidadProfesorSchema(dniLongitudMin, dniLongitudMax).safeParse({
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fechaNacimiento: formData.get("fechaNacimiento"),
      genero:
        typeof generoIngresado === "string" && generoIngresado !== ""
          ? generoIngresado
          : undefined,
    });

    if (!parsed.success) {
      return { status: "error_validacion", errores: flattenError(parsed.error).fieldErrors };
    }

    const profesor = await crearProfesorEnServicio(parsed.data, usuarioRegistranteId);
    revalidatePath("/profesores");

    return {
      status: "exito",
      profesorId: profesor.id,
      nombre: profesor.nombre,
      apellido: profesor.apellido,
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      // DNI_DUPLICADO se resalta como error del campo `dni` (no como el
      // estado "error" genérico) para que se pinte con el mismo
      // aria-invalid/role="alert" tanto si lo detectó verificarDniDisponible()
      // en el onBlur como si recién lo detectó el submit final — mismo
      // mensaje, misma ubicación visual, sin importar cuál de las dos
      // verificaciones lo haya atrapado.
      if (error.code === "DNI_DUPLICADO") {
        return {
          status: "error_validacion",
          errores: { dni: [MENSAJES_POR_CODIGO.DNI_DUPLICADO!] },
        };
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

/**
 * Verificación liviana de DNI al salir del campo (`onBlur`, HU-D-01 criterio
 * de aceptación 3) — Server Action separada de `crearProfesor()`, de solo
 * lectura. NO reemplaza la revalidación real: es una ayuda de UX, la fuente
 * de verdad sigue siendo el `findFirst` + `P2002` dentro del servicio al
 * confirmar el alta.
 *
 * Pasa por la misma verificación de permiso que el alta real (sin esto,
 * cualquier sesión con acceso al dashboard podría usarla como oráculo de
 * DNIs existentes sin tener el rol Gerente) — a diferencia de
 * `crearProfesor()`, acá el `PermisoError` no se traduce a un estado propio:
 * es una acción de soporte de un campo opcional del formulario, así que se
 * deja propagar tal cual hacia quien la invoque desde el cliente.
 */
export async function verificarDniDisponible(
  dni: string,
): Promise<{ disponible: boolean; inactivo?: boolean }> {
  await verificarPermiso("profesores:crear");

  const { min: dniLongitudMin, max: dniLongitudMax } = await resolverLongitudDni();

  // Reutiliza el mismo sub-schema de `dni` que IdentidadProfesorSchema, en
  // vez de duplicar la regex/longitud acá — un DNI con formato inválido no
  // es "no disponible", el propio campo ya marca ese error por separado.
  const dniSchema = construirIdentidadProfesorSchema(dniLongitudMin, dniLongitudMax).shape.dni;
  const parsedDni = dniSchema.safeParse(dni);
  if (!parsedDni.success) {
    return { disponible: true };
  }

  const existente = await prisma.profesor.findFirst({
    where: { dniProfesor: parsedDni.data },
    select: { activoProfesor: true },
  });

  if (!existente) {
    return { disponible: true };
  }
  return { disponible: false, inactivo: !existente.activoProfesor };
}

/**
 * Registro/actualización del contacto del profesor (HU-D-02,
 * `spec_modulo_D.md` §2.2). Mismo esquema que `crearProfesor()`: permiso
 * primero (el rechazo por rol vale aunque la action se invoque directamente,
 * sin pasar por la página), después `ContactoProfesorSchema` — el mismo que
 * usa el formulario —, después el servicio, y todo error traducido a un
 * mensaje de usuario sin detalles técnicos.
 */
export async function actualizarContactoProfesor(
  profesorId: string,
  formData: FormData,
): Promise<EstadoContactoProfesor> {
  try {
    const { id: usuarioModificadorId } = await verificarPermiso("profesores:editar");

    if (typeof profesorId !== "string" || profesorId === "") {
      return { status: "error", mensaje: MENSAJES_POR_CODIGO.PROFESOR_NO_ENCONTRADO! };
    }

    const parsed = ContactoProfesorSchema.safeParse({
      telefono: formData.get("telefono"),
      email: formData.get("email"),
    });
    if (!parsed.success) {
      return { status: "error_validacion", errores: flattenError(parsed.error).fieldErrors };
    }

    const contacto = await actualizarContactoProfesorEnServicio(
      profesorId,
      parsed.data,
      usuarioModificadorId,
    );
    revalidatePath("/profesores");
    revalidatePath(`/profesores/${profesorId}`);

    return { status: "exito", telefono: contacto.telefono, email: contacto.email };
  } catch (error) {
    if (error instanceof ServiceError) {
      // Se pinta junto al campo email, igual que un error de formato (c6).
      if (error.code === "EMAIL_YA_ASOCIADO") {
        return {
          status: "error_validacion",
          errores: { email: [MENSAJES_POR_CODIGO.EMAIL_YA_ASOCIADO!] },
        };
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
