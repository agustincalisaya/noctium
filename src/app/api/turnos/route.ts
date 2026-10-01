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
  try {
    const data = await listarTurnos(parsed.data.pagina, parsed.data.por_pagina, req.auth!.user, { q: parsed.data.q, profesor_id: parsed.data.profesor_id });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    // HU-C-08: profesor ajeno o sin ficha (Profesor) → 403; profesor inexistente o inactivo (Gerente/Mesa) → 404.
    if (error instanceof ServiceError && (error.code === "SIN_PERMISO" || error.code === "PROFESOR_NO_ENCONTRADO")) {
      return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "SIN_PERMISO" ? 403 : 404 });
    }
    throw error;
  }
});

export const POST = withPermission("turnos:crear", async (req) => {
  const parsed = ConfigurarTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Datos inválidos", detalles: parsed.error.flatten() } }, { status: 400 });
  try {
    return NextResponse.json({ data: await configurarTurno(parsed.data, req.auth!.user.id), error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "PROFESOR_NO_ENCONTRADO" ? 404 : ["MATERIA_NO_DISPONIBLE", "PROFESOR_NO_DICTA_MATERIA", "PROFESOR_FUERA_DE_HORARIO", "PROFESOR_NO_DISPONIBLE"].includes(error.code) ? 409 : 422 });
    throw error;
  }
});
