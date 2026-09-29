"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flattenError } from "zod";
import { CrearMateriaSchema, ModificarMateriaSchema } from "@/server/materias/materia.schema";
import {
  crearMateria as crearMateriaService,
  modificarMateria as modificarMateriaService,
} from "@/server/materias/materia.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import type { EstadoMateria, ResultadoModificarMateria } from "@/types/materia.types";

export async function crearMateria(
  _estadoAnterior: EstadoMateria,
  formData: FormData,
): Promise<EstadoMateria> {
  const nombreIngresado = String(formData.get("nombre") ?? "");
  const codigoIngresado = String(formData.get("codigo") ?? "");

  const parsed = CrearMateriaSchema.safeParse({
    nombre: nombreIngresado,
    codigo: codigoIngresado,
  });

  if (!parsed.success) {
    const campos = parsed.error.flatten().fieldErrors;
    return {
      status: "error_validacion",
      errores: { nombre: campos.nombre, codigo: campos.codigo },
      nombre: nombreIngresado,
      codigo: codigoIngresado,
    };
  }

  try {
    // withPermission() no aplica acá (es de Route Handler) — verificarPermiso()
    // es el equivalente para Server Actions (mismo chequeo: sesión + jti no
    // revocado + rol con la acción en RolPermiso).
    const { id: usuarioId } = await verificarPermiso("materias:crear");
    await crearMateriaService(parsed.data, usuarioId);
  } catch (error) {
    if (error instanceof PermisoError) {
      return {
        status: "error",
        campo: null,
        mensaje: error.message,
        nombre: nombreIngresado,
        codigo: codigoIngresado,
      };
    }
    if (error instanceof ServiceError) {
      const campo =
        error.code === "NOMBRE_DUPLICADO" ? "nombre" : error.code === "CODIGO_DUPLICADO" ? "codigo" : null;
      return {
        status: "error",
        campo,
        mensaje: error.message,
        nombre: nombreIngresado,
        codigo: codigoIngresado,
      };
    }
    return { status: "error_comunicacion", nombre: nombreIngresado, codigo: codigoIngresado };
  }

  redirect("/materias?creada=1");
}

/**
 * Server Action equivalente a `PATCH /api/materias/[id]` (spec_modulo_L.md
 * §2.4, HU-L-03). Semántica de PATCH sobre el FormData: una key ausente no
 * se modifica (`formData.has`); `codigo` vacío la quita. La ficha manda solo
 * los campos que cambiaron, más `version`.
 */
export async function modificarMateria(
  materiaId: string,
  formData: FormData,
): Promise<ResultadoModificarMateria> {
  const payload: Record<string, unknown> = { version: Number(formData.get("version")) };
  if (formData.has("nombre")) payload.nombre = formData.get("nombre");
  if (formData.has("codigo")) payload.codigo = formData.get("codigo");

  const parsed = ModificarMateriaSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const { id: usuarioId } = await verificarPermiso("materias:editar");
    const resultado = await modificarMateriaService(materiaId, parsed.data, usuarioId);
    revalidatePath("/materias");
    revalidatePath(`/materias/${materiaId}`);
    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof PermisoError || error instanceof ServiceError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}
