"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { flattenError } from "zod";
import { CrearAulaSchema, ModificarAulaSchema } from "@/server/aulas/aula.schema";
import {
  crearAula as crearAulaService,
  modificarAula as modificarAulaService,
} from "@/server/aulas/aula.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import type { EstadoAula, ResultadoModificarAula } from "@/types/aula.types";

export async function crearAula(
  _estadoAnterior: EstadoAula,
  formData: FormData,
): Promise<EstadoAula> {
  const nombreIngresado = String(formData.get("nombre") ?? "");
  const capacidadIngresada = String(formData.get("capacidad") ?? "");

  const parsed = CrearAulaSchema.safeParse({
    nombre: nombreIngresado,
    capacidad: capacidadIngresada,
  });

  if (!parsed.success) {
    const campos = parsed.error.flatten().fieldErrors;
    return {
      status: "error_validacion",
      errores: { nombre: campos.nombre, capacidad: campos.capacidad },
      nombre: nombreIngresado,
      capacidad: capacidadIngresada,
    };
  }

  try {
    // withPermission() no aplica acá (es de Route Handler) — verificarPermiso()
    // es el equivalente para Server Actions (mismo chequeo: sesión + jti no
    // revocado + rol con la acción en RolPermiso).
    const { id: usuarioId } = await verificarPermiso("aulas:crear");
    await crearAulaService(parsed.data, usuarioId);
  } catch (error) {
    if (error instanceof PermisoError) {
      return {
        status: "error",
        campo: null,
        mensaje: error.message,
        nombre: nombreIngresado,
        capacidad: capacidadIngresada,
      };
    }
    if (error instanceof ServiceError) {
      const campo = error.code === "NOMBRE_DUPLICADO" ? "nombre" : null;
      return {
        status: "error",
        campo,
        mensaje: error.message,
        nombre: nombreIngresado,
        capacidad: capacidadIngresada,
      };
    }
    return { status: "error_comunicacion", nombre: nombreIngresado, capacidad: capacidadIngresada };
  }

  revalidatePath("/aulas");
  redirect("/aulas?creada=1");
}

/**
 * Modificación de aula (HU-K-03). Mismo patrón que `modificarMateria()`:
 * shape `{ data, error }` (no va ligada a `useActionState`), campo ausente
 * del FormData = no se modifica.
 */
export async function modificarAula(aulaId: string, formData: FormData): Promise<ResultadoModificarAula> {
  const payload: Record<string, unknown> = { version: Number(formData.get("version")) };
  if (formData.has("nombre")) payload.nombre = formData.get("nombre");
  if (formData.has("capacidad")) payload.capacidad = formData.get("capacidad");

  const parsed = ModificarAulaSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
    };
  }

  try {
    const { id: usuarioId } = await verificarPermiso("aulas:editar");
    const resultado = await modificarAulaService(aulaId, parsed.data, usuarioId);
    revalidatePath("/aulas");
    revalidatePath(`/aulas/${aulaId}`);
    // El cupo de los turnos que usan el aula cambió (HU-K-03 criterio 3).
    if (resultado.turnos_actualizados > 0) revalidatePath("/turnos", "layout");
    return { data: resultado, error: null };
  } catch (error) {
    if (error instanceof PermisoError) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    if (error instanceof ServiceError) {
      return {
        data: null,
        error: { code: error.code, message: error.message, ...(error.detalles && { detalle: error.detalles }) },
      };
    }
    throw error;
  }
}
