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

/**
 * Último instante en que se puede cancelar en línea una inscripción que no es
 * una reserva sin pagar: inicio de la clase − anticipación mínima (C §2.19).
 * Única fórmula del límite: la usan `evaluarCancelacion` y el resumen de C-20.
 */
export function limiteCancelacionEnLinea(inicio: Date, anticipacionHoras: number): Date {
  return new Date(inicio.getTime() - anticipacionHoras * 3_600_000);
}

/** `true` si `momento` pasó el límite; el instante exacto del límite todavía es válido (inclusive). */
export function superoElLimiteDeCancelacion(momento: Date, limite: Date): boolean {
  return momento.getTime() > limite.getTime();
}

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
  const limite = limiteCancelacionEnLinea(inicio, parametros.cancelacionAnticipacionHoras);
  return { estado: superoElLimiteDeCancelacion(momento, limite) ? "FUERA_DE_PLAZO" : "PERMITIDA", limite };
}
