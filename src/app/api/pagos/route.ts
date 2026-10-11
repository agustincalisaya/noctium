import { texto as textoC19 } from "@/lib/textos";
import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { RegistrarPagoSchema } from "@/server/pagos/pago.schema";
import { registrarPago } from "@/server/pagos/pago.service";

const ERRORES: Record<string, { status: number; message: string }> = {
  TURNO_NO_ENCONTRADO: { status: 404, message: textoC19("errores.turno.noEncontrado") },
  TURNO_NO_ADMITE_PAGO: { status: 409, message: textoC19("errores.pago.turnoNoAdmitePago") },
  ALUMNO_NO_INSCRIPTO: { status: 409, message: textoC19("errores.pago.alumnoNoInscripto") },
  FORMA_PAGO_NO_ENCONTRADA: { status: 404, message: textoC19("errores.formaPago.noEncontrada") },
  FORMA_PAGO_NO_DISPONIBLE: { status: 409, message: textoC19("errores.formaPago.noDisponible") },
  FECHA_PAGO_FUTURA: { status: 400, message: textoC19("errores.pago.fechaFutura") },
};

export const POST = withPermission("pagos:crear", async (req) => {
  const parsed = RegistrarPagoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }
  try {
    const data = await registrarPago(parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError && ERRORES[error.code]) {
      const { status, message } = ERRORES[error.code];
      return NextResponse.json({ data: null, error: { code: error.code, message } }, { status });
    }
    // Condiciones nuevas del PR 0 (PR-0.md §2.15): caja no abierta y
    // transacción ocupada, con el código y el texto del catálogo central.
    if (esErrorDeDominio(error)) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.status });
    }
    throw error;
  }
});
