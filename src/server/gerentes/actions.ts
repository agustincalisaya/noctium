"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { flattenError, type ZodError } from "zod";
import { obtenerIp } from "@/auth";
import { texto } from "@/lib/textos";
import {
  DesactivarGerenteSchema,
  ReactivarGerenteSchema,
  construirAltaGerenteSchema,
  construirModificarGerenteSchema,
} from "@/server/gerentes/gerente.schema";
import {
  crearGerente as crearGerenteEnServicio,
  desactivarGerente as desactivarGerenteEnServicio,
  modificarGerente as modificarGerenteEnServicio,
  reactivarGerente as reactivarGerenteEnServicio,
  verificarDisponibilidadGerente as verificarDisponibilidadEnServicio,
} from "@/server/gerentes/gerente.service";
import { emailContactoSchema } from "@/server/shared/contacto.schema";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { construirIdentidadPersonaSchema } from "@/server/shared/identidad-persona.schema";
import { getParametroNumerico } from "@/server/shared/parametros";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import type {
  DisponibilidadGerente,
  EstadoGerenteCambiado,
  GerenteCreado,
  GerenteModificado,
  ResultadoAccionGerente,
} from "@/types/gerente.types";

// Server Actions de gerentes (spec_modulo_G.md §2.1, §2.2, §2.5 y §2.6;
// HU-G-01 y HU-G-05). Capa delgada (Regla N.° 4): permiso primero (el rechazo
// vale aunque la acción se invoque sin pasar por la pantalla), después Zod con
// el mismo schema del formulario y de la ruta, después el servicio, y el
// resultado como { data, error } (Regla N.° 5). La pantalla las llama directo, sin
// useActionState, porque el diálogo de confirmación espera el resultado.

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
    error: { code: "VALIDATION_ERROR", message: texto("errores.gerente.datosInvalidos"), detalles: flattenError(error).fieldErrors },
  };
}

/** Traduce cualquier error a { code, message }; nunca un detalle técnico. */
function errorDeAccion(error: unknown) {
  if (error instanceof ErrorDeDominio || error instanceof PermisoError) {
    return { data: null, error: { code: error.code, message: error.message } };
  }
  return { data: null, error: { code: "ERROR_COMUNICACION", message: texto("errores.gerente.comunicacion") } };
}

/** Alta del gerente con su cuenta de acceso (HU-G-01 c1 a c3, c5 y c6). */
export async function crearGerente(datos: unknown): Promise<ResultadoAccionGerente<GerenteCreado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("gerentes:crear");
    const parsed = construirAltaGerenteSchema(...(await longitudDni())).safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const gerente = await crearGerenteEnServicio(parsed.data, usuarioId, await ipDeLaSolicitud());
    revalidatePath("/gerentes");
    return { data: gerente, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/** Modificación de la ficha (HU-G-01 c4): campo ausente = no se toca; `version` obligatoria. */
export async function modificarGerente(
  id: string,
  datos: unknown,
): Promise<ResultadoAccionGerente<GerenteModificado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("gerentes:editar");
    const parsed = construirModificarGerenteSchema(...(await longitudDni())).safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const resultado = await modificarGerenteEnServicio(id, parsed.data, usuarioId);
    if (resultado.campos_modificados.length > 0) {
      revalidatePath("/gerentes");
      revalidatePath(`/gerentes/${id}`);
    }
    return { data: resultado, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/** Revalida el listado y la ficha después de un cambio de estado. */
function revalidarFicha(id: string) {
  revalidatePath("/gerentes");
  revalidatePath(`/gerentes/${id}`);
}

/**
 * Baja del gerente (HU-G-05 c1 a c4 y c6): `{ motivo?, version }`. La
 * autodesactivación, el último gerente activo, el motivo obligatorio y la
 * versión los decide el servicio.
 */
export async function desactivarGerente(
  id: string,
  datos: unknown,
): Promise<ResultadoAccionGerente<EstadoGerenteCambiado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("gerentes:cambiar_estado");
    const parsed = DesactivarGerenteSchema.safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const resultado = await desactivarGerenteEnServicio(id, parsed.data, actorUsuario(usuarioId));
    revalidarFicha(id);
    return { data: resultado, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/** Reactivación del gerente (HU-G-05 c5 y c6): `{ version }`, sin motivo. */
export async function reactivarGerente(
  id: string,
  datos: unknown,
): Promise<ResultadoAccionGerente<EstadoGerenteCambiado>> {
  try {
    const { id: usuarioId } = await verificarPermiso("gerentes:cambiar_estado");
    const parsed = ReactivarGerenteSchema.safeParse(datos);
    if (!parsed.success) return validacion(parsed.error);

    const resultado = await reactivarGerenteEnServicio(id, parsed.data, actorUsuario(usuarioId));
    revalidarFicha(id);
    return { data: resultado, error: null };
  } catch (error) {
    return errorDeAccion(error);
  }
}

/**
 * Verificación al salir del campo (HU-G-01, decisión 9): `gerentes:crear` en
 * el alta y `gerentes:editar` en la edición (con `excluirId`). Un valor con
 * formato inválido no se consulta y cuenta como disponible: el propio campo ya
 * muestra su error de formato. Nunca dice de quién es el email.
 */
export async function verificarDisponibilidadGerente(consulta: {
  dni?: string;
  email?: string;
  excluirId?: string;
}): Promise<ResultadoAccionGerente<DisponibilidadGerente>> {
  try {
    await verificarPermiso(consulta?.excluirId ? "gerentes:editar" : "gerentes:crear");
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
