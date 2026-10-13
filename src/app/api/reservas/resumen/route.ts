import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { resumenReservas } from "@/server/turnos/inscripcion.publico";

/** HU-C-26 §2.20.1: los cuatro totales de la pantalla Reservas (solo mesa de entrada). */
export const GET = withPermission("reservas:leer", async () =>
  NextResponse.json({ data: await resumenReservas(), error: null }));
