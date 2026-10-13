import type { EstadoTurno } from "@prisma/client";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { finalizarInscripcion, marcarVencidas } from "@/server/turnos/inscripcion.service";
import { inscripcionesVigentes } from "@/server/turnos/inscripcion.vigencia";
import { emitirEventoTurno } from "@/server/turnos/turno.service";

export type ReservaQuitada = { inscripcion_id: string; vigencia: "QUITADA_CENTRO"; alumnos_inscriptos: string; estado: EstadoTurno };

/**
 * «Quitar» de la pantalla Reservas (HU-C-26 criterio 6, spec_modulo_C.md
 * §2.20.4). Envoltorio transaccional sobre el PR 0, sin reglas propias: bloquea
 * clase e inscripción en el orden canónico, marca primero las reservas vencidas
 * de la clase (una vencida sin marcar no se quita como si siguiera pendiente) y
 * finaliza con `soloSiReservaPendiente`, cuya condición atómica rechaza con
 * `RESERVA_NO_PENDIENTE` si mientras tanto se pagó o venció. La inscripción
 * queda QUITADA_CENTRO (Regla N.° 1); el historial lo escribe
 * `finalizarInscripcion` después del commit y el evento se emite acá, también
 * después del commit (Regla N.° 2).
 */
export async function quitarReservaPendiente(inscripcionId: string, usuarioId: string): Promise<ReservaQuitada> {
  const resultado = await transaccion(async (tx) => {
    const inscripcion = await tx.turnoAlumno.findUnique({
      where: { idInscripcion: inscripcionId },
      select: { turnoId: true, alumnoId: true, turno: { select: { cupoMaximoTurno: true } } },
    });
    if (!inscripcion) throw new ErrorDeDominio("errores.inscripcion.noEncontrada");
    const { turnoId } = inscripcion;
    await bloquear(tx, { clases: [turnoId], inscripciones: [inscripcionId] });
    await marcarVencidas(tx, turnoId);
    const finalizada = await finalizarInscripcion(tx, {
      inscripcionId, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId), soloSiReservaPendiente: true,
    });
    const estado = finalizada.estadoTurno?.nuevo
      ?? (await tx.turno.findUniqueOrThrow({ where: { idTurno: turnoId }, select: { estadoTurno: true } })).estadoTurno;
    const inscriptos = (await inscripcionesVigentes(tx, turnoId, ahora())).length;
    return {
      turnoId, alumnoId: finalizada.alumnoId, estado, inscriptos, cupo: inscripcion.turno.cupoMaximoTurno,
      liberado: finalizada.estadoTurno?.anterior === "COMPLETO" && estado === "DISPONIBLE",
    };
  });
  const { turnoId, alumnoId } = resultado;
  await emitirEventoTurno("turno:alumno_quitado", turnoId, usuarioId, { turno_id: turnoId, alumno_id: alumnoId, inscripcion_id: inscripcionId, usuario_id: usuarioId });
  if (resultado.liberado) {
    await emitirEventoTurno("turno:disponible_nuevamente", turnoId, usuarioId, { turno_id: turnoId, alumno_id_liberado: alumnoId, usuario_id: usuarioId });
  }
  return {
    inscripcion_id: inscripcionId, vigencia: "QUITADA_CENTRO",
    alumnos_inscriptos: `${resultado.inscriptos}/${resultado.cupo}`, estado: resultado.estado,
  };
}
