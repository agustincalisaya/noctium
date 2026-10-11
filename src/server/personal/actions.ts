"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { flattenError, type ZodError } from "zod";
import { obtenerIp } from "@/auth";
import { texto } from "@/lib/textos";
import {
  DesactivarIntegranteSchema,
  ReactivarIntegranteSchema,
  construirAltaIntegranteSchema,
  construirModificarIntegranteSchema,
} from "@/server/personal/personal.schema";
import {
  crearIntegrante as crearIntegranteEnServicio,
  desactivarIntegrante as desactivarIntegranteEnServicio,
  modificarIntegrante as modificarIntegranteEnServicio,
  reactivarIntegrante as reactivarIntegranteEnServicio,
  verificarDisponibilidadIntegrante as verificarDisponibilidadEnServicio,
} from "@/server/personal/personal.service";
import { emailContactoSchema } from "@/server/shared/contacto.schema";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { construirIdentidadPersonaSchema } from "@/server/shared/identidad-persona.schema";
import { getParametroNumerico } from "@/server/shared/parametros";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import type {
  DisponibilidadIntegrante,
  EstadoIntegranteCambiado,
  IntegranteCreado,
  IntegranteModificado,
  ResultadoAccionPersonal,
} from "@/types/personal.types";

// Server Actions del personal de mesa de entrada (spec_modulo_F.md §2.1,
// §2.2, §2.5 y §2.6; HU-F-01 y HU-F-05). Capa delgada (Regla N.° 4): permiso primero (el rechazo vale
// aunque la acción se invoque sin pasar por la pantalla), después Zod con el
// mismo schema del formulario y de la ruta, después el servicio, y el
// resultado como { data, error } (Regla N.° 5). La pantalla las llama directo,
// sin useActionState, porque el diálogo de confirmación espera el resultado.

async function longitudDni(): Promise<[number, number]> {
  return Promise.all([getParametroNumerico("dni_longitud_min", 7), getParametroNumerico("dni_longitud_max", 8)]);
}

/** IP de la solicitud, con el mismo criterio que el login (`obtenerIp`), para el evento CUENTA_CREADA. */
async function ipDeLaSolicitud(): Promise<string> {
  return obtenerIp(new Request("http://localhost", { headers: await headers() }));
}

function validacion(error: ZodError) {
  return {
    data: null,
    error: { code: "VALIDATION_ERROR", message: texto("errores.personal.datosInvalidos"), detalles: flattenError(error).fieldErrors },
  };
}

/** Traduce cualquier error a { code, message }; nunca un detalle técnico. */
function errorDeAccion(error: unknown) {
  if (error instanceof ErrorDeDominio || error instanceof PermisoError) {
    return { data: null, error: { code: error.code, message: error.message } };
  }
  return { data: null, error: { code: "ERROR_COMUNICACION", message: texto("errores.personal.comunicacion") } };
}

/** Alta del integrante con su cuenta de acceso (HU-F-01 c1 a c4 y c6). */
export async function crearIntegrante(datos: unknown): Promise<ResultadoAccionPersonal<IntegranteCreado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("personal:crear");
    const parsed = construirAltaIntegranteSchema(...(await longitudDni())).safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const integrante = await crearIntegranteEnServicio(parsed.data, usuarioId, await ipDeLaSolicitud());
    revalidatePath("/personal");
    return { data: integrante, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/** Modificación de la ficha (HU-F-01 c5): campo ausente = no se toca; `version` obligatoria. */
export async function modificarIntegrante(
  id: string,
  datos: unknown,
): Promise<ResultadoAccionPersonal<IntegranteModificado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("personal:editar");
    const parsed = construirModificarIntegranteSchema(...(await longitudDni())).safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const resultado = await modificarIntegranteEnServicio(id, parsed.data, usuarioId);
    if (resultado.campos_modificados.length > 0) {
      revalidatePath("/personal");
      revalidatePath(`/personal/${id}`);
    }
    return { data: resultado, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/** Revalida el listado y la ficha después de un cambio de estado. */
function revalidarFicha(id: string) {
  revalidatePath("/personal");
  revalidatePath(`/personal/${id}`);
}

/**
 * Baja del integrante (HU-F-05 c1 a c4 y c6): `{ motivo?, version }`. La caja
 * abierta, el motivo obligatorio y la versión los decide el servicio.
 */
export async function desactivarIntegrante(
  id: string,
  datos: unknown,
): Promise<ResultadoAccionPersonal<EstadoIntegranteCambiado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("personal:cambiar_estado");
    const parsed = DesactivarIntegranteSchema.safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const resultado = await desactivarIntegranteEnServicio(id, parsed.data, actorUsuario(usuarioId));
    revalidarFicha(id);
    return { data: resultado, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/** Reactivación del integrante (HU-F-05 c5 y c6): `{ version }`, sin motivo. */
export async function reactivarIntegrante(
  id: string,
  datos: unknown,
): Promise<ResultadoAccionPersonal<EstadoIntegranteCambiado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("personal:cambiar_estado");
    const parsed = ReactivarIntegranteSchema.safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const resultado = await reactivarIntegranteEnServicio(id, parsed.data, actorUsuario(usuarioId));
    revalidarFicha(id);
    return { data: resultado, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/**
 * Verificación al salir del campo (HU-F-01 c3, decisión 9): `personal:crear`
 * en el alta y `personal:editar` en la edición (con `excluirId`). Un valor con
 * formato inválido no se consulta y cuenta como disponible: el propio campo ya
 * muestra su error de formato. Nunca dice de quién es el email.
 */
export async function verificarDisponibilidadIntegrante(consulta: {
  dni?: string;
  email?: string;
  excluirId?: string;
}): Promise<ResultadoAccionPersonal<DisponibilidadIntegrante>> {
  try {
    await verificarPermiso(consulta?.excluirId ? "personal:editar" : "personal:crear");
    const dniSchema = construirIdentidadPersonaSchema(...(await longitudDni())).shape.dni;
    const dni = consulta.dni === undefined ? undefined : dniSchema.safeParse(consulta.dni);
    const email = consulta.email === undefined ? undefined : emailContactoSchema.safeParse(consulta.email);
    const excluirId = typeof consulta.excluirId === "string" && consulta.excluirId !== "" ? consulta.excluirId : undefined;

    const disponibilidad = await verificarDisponibilidadEnServicio({
      dni: dni?.success ? dni.data : undefined,
      email: email?.success ? email.data : undefined,
      excluirId,
    });
    return { data: disponibilidad, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}
