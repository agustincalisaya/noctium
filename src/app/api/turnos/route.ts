import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ConfigurarTurnoSchema, ListarTurnosQuerySchema } from "@/server/turnos/turno.schema";
import { configurarTurno, listarTurnos } from "@/server/turnos/turno.service";
import { ServiceError } from "@/server/shared/service-error";

export const GET = withPermission("turnos:leer", async (req) => {
  const parsed = ListarTurnosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  }
  const data = await listarTurnos(parsed.data.pagina, parsed.data.por_pagina, req.auth!.user);
  return NextResponse.json({ data, error: null });
});

export const POST = withPermission("turnos:crear", async (req) => {
  const parsed = ConfigurarTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await configurarTurno(parsed.data, req.auth!.user.id), error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "MATERIA_NO_DISPONIBLE" ? 409 : 422 });
    throw error;
  }
});
