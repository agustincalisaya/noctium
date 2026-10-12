import { obtenerAlumnoDeUsuario } from "@/server/alumnos/alumno.publico";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { actorUsuario, encolarHistorial } from "@/server/shared/historial";
import { parametrosVigentes } from "@/server/shared/parametros-vigentes";
import { ahora } from "@/server/shared/reloj";
import { ServiceError } from "@/server/shared/service-error";
import { transaccion } from "@/server/shared/transaccion";
import { finalizarInscripcion, inscripcionMasRecienteDelPar, marcarVencidas } from "@/server/turnos/inscripcion.service";
import { ocupacion } from "@/server/turnos/inscripcion.vigencia";
import { evaluarCancelacion } from "@/server/turnos/turno.cancelacion-propia";

/**
 * C §2.19: cancelación de la inscripción propia. Lee sin bloquear solo para
 * saber qué bloquear; todo lo que decide se evalúa con la clase y la
 * inscripción releídas bajo bloqueo. Los eventos de la clase se escriben
 * después del commit con el servicio compartido (reintenta y registra el
 * error): una falla ahí no convierte en error una cancelación ya confirmada.
 */
export async function cancelarInscripcionPropia(turnoId: string, usuarioId: string) {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId);
  if (!alumno) throw new ServiceError("SIN_PERMISO", "Tu cuenta no tiene una ficha de alumno vinculada");
  return transaccion(async (tx) => {
    const turnoPrevio = await tx.turno.findUnique({ where: { idTurno: turnoId }, select: { idTurno: true } });
    if (!turnoPrevio) throw new ErrorDeDominio("errores.turno.noEncontrado");
    const inscripcionPrevia = await inscripcionMasRecienteDelPar(alumno.id, turnoId, tx);
    if (!inscripcionPrevia) throw new ErrorDeDominio("errores.inscripcion.noEncontrada");
    if (inscripcionPrevia.vigencia !== "VIGENTE") throw new ErrorDeDominio("errores.inscripcion.noVigente");

    await bloquear(tx, { clases: [turnoId], inscripciones: [inscripcionPrevia.id] });
    const momento = ahora();
    await marcarVencidas(tx, turnoId, { momento });
    const [turno, inscripcion, parametros] = await Promise.all([
      tx.turno.findUnique({ where: { idTurno: turnoId } }),
      tx.turnoAlumno.findUnique({ where: { idInscripcion: inscripcionPrevia.id } }),
      parametrosVigentes(tx),
    ]);
    // Orden del paso 3 de C §2.19, con cada motivo real.
    if (!turno) throw new ErrorDeDominio("errores.turno.noEncontrado");
    if (turno.estadoTurno === "CANCELADO") throw new ErrorDeDominio("errores.turno.cancelado");
    if (inicioDeTurno(turno).getTime() <= momento.getTime()) throw new ErrorDeDominio("errores.turno.vencido");
    if (!inscripcion || inscripcion.vigencia !== "VIGENTE") throw new ErrorDeDominio("errores.inscripcion.noVigente");
    const evaluacion = evaluarCancelacion(inscripcion, turno, momento, parametros);
    if (evaluacion.estado === "NO_APLICA") {
      // Ya descartadas la clase cancelada, la vencida y la inscripción no vigente: queda la clase sin confirmar o una reserva sin vencimiento.
      throw new ErrorDeDominio(turno.estadoTurno === "PENDIENTE" ? "errores.turno.pendiente" : "errores.inscripcion.noVigente");
    }
    if (evaluacion.estado === "FUERA_DE_PLAZO") throw new ErrorDeDominio("errores.inscripcion.cancelacionFueraDePlazo");

    const finalizada = await finalizarInscripcion(tx, {
      inscripcionId: inscripcion.idInscripcion,
      vigencia: "CANCELADA_ALUMNO",
      actor: actorUsuario(usuarioId),
      fecha: momento,
    });
    const actual = await ocupacion(tx, turnoId, momento);
    const estado = finalizada.estadoTurno?.nuevo ?? turno.estadoTurno;
    encolarHistorial(tx, {
      tipo: "EVENTO_TURNO", tipoEvento: "turno:inscripcion_cancelada", turnoId, usuarioId,
      payload: {
        turno_id: turnoId,
        alumno_id: alumno.id,
        inscripcion_id: inscripcion.idInscripcion,
        estado_pago: inscripcion.estadoPago,
        usuario_id: usuarioId,
      },
    });
    if (finalizada.estadoTurno?.cambio && estado === "DISPONIBLE") {
      encolarHistorial(tx, {
        tipo: "EVENTO_TURNO", tipoEvento: "turno:disponible_nuevamente", turnoId, usuarioId,
        payload: { turno_id: turnoId, alumno_id_liberado: alumno.id, usuario_id: usuarioId },
      });
    }
    return {
      id: turnoId,
      inscripcion_id: inscripcion.idInscripcion,
      vigencia: "CANCELADA_ALUMNO" as const,
      con_pagos: inscripcion.estadoPago === "PAGADA",
      alumnos_inscriptos: `${actual?.inscriptos ?? 0}/${turno.cupoMaximoTurno ?? 0}`,
      estado,
    };
  });
}
