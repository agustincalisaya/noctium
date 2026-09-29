import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ModificarMateriaSchema } from "@/server/materias/materia.schema";
import { modificarMateria, obtenerMateriaPorId } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";

export const GET = withPermission("materias:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  try {
    const data = await obtenerMateriaPorId(id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    throw error;
  }
});

// spec_modulo_L.md §2.4 (HU-L-03).
const STATUS_POR_CODIGO: Record<string, number> = {
  MATERIA_NO_ENCONTRADA: 404,
  NOMBRE_DUPLICADO: 409,
  CODIGO_DUPLICADO: 409,
  CONFLICTO_EDICION_CONCURRENTE: 409,
};

export const PATCH = withPermission("materias:editar", async (req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  const body = await req.json().catch(() => null);
  const parsed = ModificarMateriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  try {
    // withPermission() ya garantizó que req.auth.user existe.
    const data = await modificarMateria(id, parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: STATUS_POR_CODIGO[error.code] ?? 400 },
      );
    }
    throw error;
  }
});
