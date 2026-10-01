import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { listarFormasPagoActivas } from "@/server/pagos/forma-pago.publico";

export const GET = withPermission("formas_pago:leer", async () =>
  NextResponse.json({ data: await listarFormasPagoActivas(), error: null }));
