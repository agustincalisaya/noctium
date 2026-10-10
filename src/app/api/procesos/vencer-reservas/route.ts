import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isoCentro } from "@/server/shared/fechas-centro";
import { vencerReservas } from "@/server/turnos/reserva.vencimiento.service";

const resumen = (valor: string) => createHash("sha256").update(valor).digest();

/** `Authorization: Bearer <CRON_SECRET>`, comparado en tiempo constante (resúmenes de igual largo). */
function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  const recibido = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!secreto || !recibido) return false;
  return timingSafeEqual(resumen(recibido), resumen(secreto));
}

/**
 * HU-C-24 criterio 1 (spec_modulo_C.md §2.18.1). Única excepción documentada a
 * la Regla N.° 10: sin sesión ni `withPermission`; la autenticación es el
 * secreto del programador. Sin secreto o con uno distinto: 401 sin ejecutar
 * nada ni revelar el motivo.
 */
export async function POST(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ data: null, error: { code: "NO_AUTORIZADO", message: "No autorizado" } }, { status: 401 });
  }
  const { reservasVencidas, clasesAfectadas, ejecutadoEl } = await vencerReservas();
  return NextResponse.json({
    data: { reservas_vencidas: reservasVencidas, clases_afectadas: clasesAfectadas, ejecutado_el: isoCentro(ejecutadoEl) },
    error: null,
  });
}
