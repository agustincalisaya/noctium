"use server";

import { redirect } from "next/navigation";
import { CrearMateriaSchema } from "@/server/materias/materia.schema";
import { crearMateria as crearMateriaService } from "@/server/materias/materia.service";
import { verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import type { EstadoMateria } from "@/types/materia.types";

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
