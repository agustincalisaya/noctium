import { obtenerAlumnoDeUsuario } from "@/server/alumnos/alumno.publico";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { parametrosVigentes } from "@/server/shared/parametros-vigentes";
import { ahora } from "@/server/shared/reloj";
import { ServiceError } from "@/server/shared/service-error";
import { transaccion } from "@/server/shared/transaccion";
import { finalizarInscripcion, inscripcionMasRecienteDelPar, marcarVencidas } from "@/server/turnos/inscripcion.service";
import { evaluarCancelacion } from "@/server/turnos/turno.cancelacion-propia";
import { emitirEventoTurno } from "@/server/turnos/turno.service";

export async function cancelarInscripcionPropia(turnoId: string, usuarioId: string) {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId);
  if (!alumno) throw new ServiceError("SIN_PERMISO", "Tu cuenta no tiene una ficha de alumno vinculada");
  const resultado = await transaccion(async (tx) => {
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
    if (!turno) throw new ErrorDeDominio("errores.turno.noEncontrado");
    if (!inscripcion || inscripcion.vigencia !== "VIGENTE") throw new ErrorDeDominio("errores.inscripcion.noVigente");
    if (turno.estadoTurno === "CANCELADO") throw new ErrorDeDominio("errores.turno.cancelado");
    const evaluacion = evaluarCancelacion(inscripcion, turno, momento, parametros);
    if (evaluacion.estado === "NO_DISPONIBLE") throw new ErrorDeDominio("errores.turno.vencido");
    if (evaluacion.estado === "FUERA_DE_PLAZO") throw new ErrorDeDominio("errores.inscripcion.cancelacionFueraDePlazo");

    const finalizada = await finalizarInscripcion(tx, {
      inscripcionId: inscripcion.idInscripcion,
      vigencia: "CANCELADA_ALUMNO",
      actor: actorUsuario(usuarioId),
      fecha: momento,
    });
    const ocupacion = await tx.turnoAlumno.count({ where: { turnoId, vigencia: "VIGENTE" } });
    const estado = finalizada.estadoTurno?.nuevo ?? turno.estadoTurno;
    return {
      data: {
        id: turnoId,
        inscripcion_id: inscripcion.idInscripcion,
        vigencia: "CANCELADA_ALUMNO" as const,
        con_pagos: inscripcion.estadoPago === "PAGADA",
        alumnos_inscriptos: `${ocupacion}/${turno.cupoMaximoTurno ?? 0}`,
        estado,
      },
      disponibleNuevamente: finalizada.estadoTurno?.cambio && estado === "DISPONIBLE",
      alumnoId: alumno.id,
    };
  });
  await emitirEventoTurno("turno:inscripcion_cancelada", turnoId, usuarioId, {
    turno_id: turnoId,
    inscripcion_id: resultado.data.inscripcion_id,
    alumno_id: resultado.alumnoId,
    usuario_id: usuarioId,
  });
  if (resultado.disponibleNuevamente) {
    await emitirEventoTurno("turno:disponible_nuevamente", turnoId, usuarioId, { turno_id: turnoId, usuario_id: usuarioId });
  }
  return resultado.data;
}
