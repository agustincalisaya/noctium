import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { transaccion } from "@/server/shared/transaccion";
import { RegistrarIndicacionSchema } from "@/server/historial/indicacion.schema";
import { registrarIndicacion } from "@/server/historial/indicacion.service";

const ESTADOS: Record<string, number> = {
  SIN_PERMISO: 403,
  ALUMNO_NO_ENCONTRADO: 404,
  ALUMNO_INACTIVO: 409,
  MATERIA_NO_CURSADA: 409,
  CLASE_DICTADA_NO_ENCONTRADA: 404,
  CLASE_DICTADA_NO_CORRESPONDE: 409,
  TRANSACCION_OCUPADA: 409,
};

export const POST = withPermission("indicaciones:registrar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = RegistrarIndicacionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
    }, { status: 400 });
  }

  try {
    const resultado = await transaccion((tx) => registrarIndicacion(tx, id, parsed.data, req.auth!.user));
    return NextResponse.json({ data: resultado, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } },
        { status: error instanceof ErrorDeDominio ? error.status : ESTADOS[error.code] },
      );
    }
    throw error;
  }
});
