import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { RegistrarPagoSchema } from "@/server/pagos/pago.schema";
import { registrarPago } from "@/server/pagos/pago.service";

const ERRORES: Record<string, { status: number; message: string }> = {
  TURNO_NO_ENCONTRADO: { status: 404, message: "No se encontró el turno" },
  TURNO_NO_ADMITE_PAGO: { status: 409, message: "Solo se pueden registrar pagos en turnos disponibles o completos" },
  ALUMNO_NO_INSCRIPTO: { status: 409, message: "El alumno no está inscripto en este turno" },
  FORMA_PAGO_NO_ENCONTRADA: { status: 404, message: "No se encontró la forma de pago" },
  FORMA_PAGO_NO_DISPONIBLE: { status: 409, message: "La forma de pago ya no está disponible" },
  FECHA_PAGO_FUTURA: { status: 400, message: "La fecha de pago no puede ser futura" },
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
