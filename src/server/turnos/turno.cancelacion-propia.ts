import type { EstadoPagoInscripcion, EstadoTurno, VigenciaInscripcion } from "@prisma/client";
import { inicioDeTurno } from "@/server/shared/fechas-centro";

export type EstadoCancelacionPropia = "PERMITIDA" | "FUERA_DE_PLAZO" | "NO_APLICA";

export type EvaluacionCancelacionPropia = {
  estado: EstadoCancelacionPropia;
  limite: Date | null;
};

type InscripcionCancelable = {
  vigencia: VigenciaInscripcion;
  estadoPago: EstadoPagoInscripcion;
  venceEl: Date | null;
};

type TurnoCancelable = {
  estadoTurno: EstadoTurno;
  fechaTurno: Date;
  horaInicioTurno: Date;
};

export function evaluarCancelacion(
  inscripcion: InscripcionCancelable,
  turno: TurnoCancelable,
  momento: Date,
  parametros: { cancelacionAnticipacionHoras: number },
): EvaluacionCancelacionPropia {
  const inicio = inicioDeTurno(turno);
  if (inscripcion.vigencia !== "VIGENTE" || !["DISPONIBLE", "COMPLETO"].includes(turno.estadoTurno) || inicio.getTime() <= momento.getTime()) {
    return { estado: "NO_APLICA", limite: null };
  }
  if (inscripcion.estadoPago === "RESERVADA") {
    if (!inscripcion.venceEl || momento.getTime() >= inscripcion.venceEl.getTime()) {
      return { estado: "NO_APLICA", limite: null };
    }
    return { estado: "PERMITIDA", limite: inscripcion.venceEl };
  }
  const limite = new Date(inicio.getTime() - parametros.cancelacionAnticipacionHoras * 3_600_000);
  return { estado: momento.getTime() <= limite.getTime() ? "PERMITIDA" : "FUERA_DE_PLAZO", limite };
}
