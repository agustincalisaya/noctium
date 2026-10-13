import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { listarReservasVencidas } from "@/server/turnos/inscripcion.publico";
import { ReservasVencidasQuerySchema, filtrosReservas } from "@/server/turnos/reserva.schema";
import { respuestaDeValidacionReservas } from "@/app/api/reservas/validacion";

/** HU-C-26 §2.20.3: pestaña «Vencidas · últimos 7 días», `?alumno=&materia_id=&pagina=`. Solo consulta. */
export const GET = withPermission("reservas:leer", async (req) => {
  const parsed = ReservasVencidasQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return respuestaDeValidacionReservas(parsed.error);
  return NextResponse.json({ data: await listarReservasVencidas(filtrosReservas(parsed.data)), error: null });
});
