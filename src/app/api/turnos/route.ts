import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ListarTurnosQuerySchema } from "@/server/turnos/turno.schema";
import { listarTurnos } from "@/server/turnos/turno.service";

export const GET = withPermission("turnos:leer", async (req) => {
  const parsed = ListarTurnosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }
  const data = await listarTurnos(parsed.data.pagina, parsed.data.por_pagina, req.auth!.user);
  return NextResponse.json({ data, error: null });
});

// HU-C-03 todavía no implementada.
export async function POST() {
  return NextResponse.json({ error: "No implementado" }, { status: 501 });
}
