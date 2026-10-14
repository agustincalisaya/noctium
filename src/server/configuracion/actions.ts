"use server";

import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import { texto } from "@/lib/textos";
import { GuardarConfiguracionSchema } from "@/server/configuracion/configuracion.schema";
import { guardarConfiguracion as guardarConfiguracionServicio } from "@/server/configuracion/configuracion.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";

export async function guardarConfiguracion(payload: unknown) {
  try {
    const { id } = await verificarPermiso("configuracion:editar");
    const parsed = GuardarConfiguracionSchema.safeParse(payload);
    if (!parsed.success) return { data: null, error: {
      code: "VALIDATION_ERROR", message: texto("errores.configuracion.datosInvalidos"),
      detalles: { ...flattenError(parsed.error), issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) },
    } };
    const data = await guardarConfiguracionServicio(parsed.data, { usuarioId: id });
    if (data.cambios.length) revalidatePath("/configuracion");
    return { data, error: null };
  } catch (error) {
    if (error instanceof PermisoError || error instanceof ErrorDeDominio) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    console.error("[configuracion] falló el guardado", error);
    return { data: null, error: { code: "INTERNAL_ERROR", message: texto("errores.configuracion.interno") } };
  }
}
