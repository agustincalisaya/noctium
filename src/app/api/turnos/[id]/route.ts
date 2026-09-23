import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerTurno } from "@/server/turnos/turno.service";

export const GET = withPermission("turnos:leer", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const data = await obtenerTurno(id, req.auth!.user);
  if (!data) {
    return NextResponse.json({ data: null, error: { code: "TURNO_NO_ENCONTRADO", message: "No se encontró el turno" } }, { status: 404 });
  }
  return NextResponse.json({ data, error: null });
});
