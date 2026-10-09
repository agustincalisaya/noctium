import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { obtenerRegistroClaseDictada, registrarClaseDictadaDesdeSolicitud } from "@/server/historial/clase-dictada.service";

import { RegistrarClaseDictadaSchema } from "@/server/historial/clase-dictada.schema";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

const ESTADOS = {
  ASISTENCIA_INCOMPLETA: 400,
  TRANSACCION_OCUPADA: 409,
  SIN_PERMISO: 403,
  TURNO_NO_ENCONTRADO: 404,
  CLASE_NO_REGISTRADA: 404,
  TURNO_NO_ADMITE_CLASE: 409,
  CLASE_NO_FINALIZADA: 409,
} as const;

export const POST = withPermission("clases:registrar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const cuerpo = await req.text();
    let asistencias;
    if (cuerpo.length > 0) {
      let json: unknown;
      try { json = JSON.parse(cuerpo); }
      catch { return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "El cuerpo debe ser JSON válido" } }, { status: 400 }); }
      const validacion = RegistrarClaseDictadaSchema.safeParse(json);
      if (!validacion.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "La asistencia no es válida", detalles: validacion.error.flatten() } }, { status: 400 });
      asistencias = validacion.data.asistencias;
    }
    const resultado = await registrarClaseDictadaDesdeSolicitud(id, req.auth!.user, asistencias);
    return NextResponse.json(
      { data: resultado, error: null },
      { status: resultado.ya_existia ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError && error.code in ESTADOS) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } },
        { status: error instanceof ErrorDeDominio ? error.status : ESTADOS[error.code as keyof typeof ESTADOS] },
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
        { data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } },
        { status: error instanceof ErrorDeDominio ? error.status : ESTADOS[error.code as keyof typeof ESTADOS] },
      );
    }
    throw error;
  }
});
