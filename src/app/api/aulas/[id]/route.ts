import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ModificarAulaSchema } from "@/server/aulas/aula.schema";
import { modificarAula, obtenerAulaPorId } from "@/server/aulas/aula.service";
import { ServiceError } from "@/server/shared/service-error";

export const GET = withPermission("aulas:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  try {
    const data = await obtenerAulaPorId(id);
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

// spec_modulo_K.md §2.4 (HU-K-03).
const STATUS_POR_CODIGO: Record<string, number> = {
  AULA_NO_ENCONTRADA: 404,
  NOMBRE_DUPLICADO: 409,
  CONFLICTO_EDICION_CONCURRENTE: 409,
  CAPACIDAD_MENOR_A_INSCRIPTOS: 409,
};

export const PATCH = withPermission("aulas:editar", async (req, ctx) => {
  const { id } = (await ctx.params) as { id: string };
  const body = await req.json().catch(() => null);
  const parsed = ModificarAulaSchema.safeParse(body);
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
    const data = await modificarAula(id, parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: error.code,
            message: error.message,
            // `detalle` (spec §2.4): turnos_en_conflicto y max_inscriptos.
            ...(error.detalles && { detalle: error.detalles }),
          },
        },
        { status: STATUS_POR_CODIGO[error.code] ?? 400 },
      );
    }
    throw error;
  }
});
