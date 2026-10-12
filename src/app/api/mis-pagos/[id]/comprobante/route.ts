import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoDeUsuario } from "@/server/alumnos/alumno.publico";
import { comprobanteDelPago, leerComprobanteDeAlumno } from "@/server/pagos/comprobante.lectura";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { withPermission } from "@/server/shared/with-permission";
import { respuestaDeError } from "@/app/api/pagos/respuesta-error";

/**
 * HU-I-11 (spec_modulo_I.md §2.9.3): lo mismo que `GET /api/pagos/[id]/comprobante`,
 * solo para un pago del alumno de la sesión y con la vista del alumno (sin
 * quién registró ni el motivo de una anulación). Un pago ajeno, o una cuenta
 * sin ficha de alumno, es `403 FUERA_DE_ALCANCE`.
 */
export const GET = withPermission("comprobantes:leer_propios", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  try {
    const alumno = await obtenerAlumnoDeUsuario(req.auth!.user.id);
    if (!alumno) throw new ErrorDeDominio("errores.pago.fueraDeAlcance");
    const { id: comprobanteId } = await comprobanteDelPago(prisma, id);
    const comprobante = await leerComprobanteDeAlumno(prisma, comprobanteId, alumno.id);
    if (!comprobante) throw new ErrorDeDominio("errores.comprobante.noEncontrado");
    return NextResponse.json({ data: comprobante, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respuestaDeError(error);
  }
});
