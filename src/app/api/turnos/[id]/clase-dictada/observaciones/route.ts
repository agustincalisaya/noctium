import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { transaccion } from "@/server/shared/transaccion";
import { RegistrarObservacionClaseSchema } from "@/server/historial/observacion-clase.schema";
import { registrarObservacionClase } from "@/server/historial/observacion-clase.service";

const ESTADOS: Record<string, number> = {
  SIN_PERMISO: 403,
  CLASE_NO_REGISTRADA: 404,
};

export const POST = withPermission("observaciones:registrar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "El cuerpo debe ser JSON válido" } }, { status: 400 });
  }

  const validacion = RegistrarObservacionClaseSchema.safeParse(cuerpo);
  if (!validacion.success) {
    return NextResponse.json({
      data: null,
      error: { code: "VALIDACION", message: "Las observaciones no son válidas", detalles: validacion.error.flatten() },
    }, { status: 400 });
  }

  try {
    const observacion = await transaccion((tx) => registrarObservacionClase(tx, id, validacion.data, req.auth!.user));
    return NextResponse.json({ data: observacion, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: ESTADOS[error.code] });
    }
    if (error instanceof ErrorDeDominio) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } }, { status: error.status });
    }
    throw error;
  }
});
