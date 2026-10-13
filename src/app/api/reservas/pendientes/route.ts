import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { listarReservasPendientes } from "@/server/turnos/inscripcion.publico";
import { ReservasPendientesQuerySchema, filtrosReservas } from "@/server/turnos/reserva.schema";
import { respuestaDeValidacionReservas } from "@/app/api/reservas/validacion";

/**
 * HU-C-26 §2.20.2: pestaña «Pendientes», `?alumno=&materia_id=&vencen=&pagina=`,
 * de a 10 por vencimiento ascendente. Capa delgada (Regla N.° 4): Zod antes de
 * la lectura pública de C.
 */
export const GET = withPermission("reservas:leer", async (req) => {
  const parsed = ReservasPendientesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacionReservas(parsed.error);
  return NextResponse.json({ data: await listarReservasPendientes(filtrosReservas(parsed.data)), error: null });
});
