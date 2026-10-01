import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { CrearFormaPagoSchema, ListarFormasPagoQuerySchema } from "@/server/pagos/forma-pago.schema";
import { crearFormaPago, listarFormasPago } from "@/server/pagos/forma-pago.service";
import { ServiceError } from "@/server/shared/service-error";

export const GET = withPermission("formas_pago:leer", async (req) => {
  const parsed = ListarFormasPagoQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  const data = await listarFormasPago(parsed.data);
  return NextResponse.json({ data, error: null });
});

export const POST = withPermission("formas_pago:crear", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = CrearFormaPagoSchema.safeParse(body);
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
    const forma = await crearFormaPago(parsed.data, req.auth!.user.id);
    return NextResponse.json(
      {
        data: { id: forma.idFormaPago, nombre: forma.nombreFormaPago, is_active: forma.activaFormaPago },
        error: null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    throw error;
  }
});
