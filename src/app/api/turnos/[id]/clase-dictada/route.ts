import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { obtenerRegistroClaseDictada, registrarClaseDictada } from "@/server/historial/clase-dictada.service";

const ESTADOS = {
  SIN_PERMISO: 403,
  TURNO_NO_ENCONTRADO: 404,
  CLASE_NO_REGISTRADA: 404,
  TURNO_NO_ADMITE_CLASE: 409,
  CLASE_NO_FINALIZADA: 409,
} as const;

export const POST = withPermission("clases:registrar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const resultado = await registrarClaseDictada(id, req.auth!.user);
    return NextResponse.json(
      { data: resultado, error: null },
      { status: resultado.ya_existia ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: ESTADOS[error.code as keyof typeof ESTADOS] },
      );
    }
    throw error;
  }
});

export const GET = withPermission("historial:leer", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const registro = await obtenerRegistroClaseDictada(id, req.auth!.user);
    return NextResponse.json({ data: registro, error: null });
  } catch (error) {
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: ESTADOS[error.code as keyof typeof ESTADOS] },
      );
    }
    throw error;
  }
});
