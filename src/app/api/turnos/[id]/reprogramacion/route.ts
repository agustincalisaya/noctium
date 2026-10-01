import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ReprogramarTurnoSchema } from "@/server/turnos/turno.schema";
import { reprogramarTurno } from "@/server/turnos/turno.reprogramacion.service";
import { ServiceError } from "@/server/shared/service-error";

// Validaciones de fecha del servicio → 400 VALIDATION_ERROR con `detalles.motivo` (spec_modulo_C.md §2.11).
const MOTIVOS_VALIDACION = ["FECHA_PASADA", "ANTICIPACION_EXCEDIDA", "DIA_NO_OPERATIVO", "HORA_NO_GRANULAR", "FUERA_DE_HORARIO_OPERATIVO", "DURACION_NO_PERMITIDA"];
const invalido = (detalles: unknown, message = "Datos inválidos") => NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message, detalles } }, { status: 400 });
function traducir(error: unknown) {
  if (!(error instanceof ServiceError)) throw error;
  if (MOTIVOS_VALIDACION.includes(error.code)) return invalido({ motivo: error.code }, error.message);
  return NextResponse.json({ data: null, error: { code: error.code, message: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) } }, {
    status: error.code === "TURNO_NO_ENCONTRADO" ? 404 : 409,
  });
}

/** HU-C-06 (spec_modulo_C.md §2.11): cambia fecha y hora de inicio de un turno confirmado. */
export const PATCH = withPermission("turnos:reprogramar", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = ReprogramarTurnoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalido(parsed.error.flatten());
  try {
    return NextResponse.json({ data: await reprogramarTurno(id, parsed.data, req.auth!.user.id), error: null });
  } catch (error) {
    return traducir(error);
  }
});
