"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CrearAulaSchema } from "@/server/aulas/aula.schema";
import { crearAula as crearAulaService } from "@/server/aulas/aula.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import type { EstadoAula } from "@/types/aula.types";

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
