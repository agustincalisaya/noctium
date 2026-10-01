import { prisma } from "@/lib/prisma";
import type { EstadoTurno } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";
import { emitirEventoTurno } from "@/server/turnos/turno.service";
import { turnoSigueVigente } from "@/server/turnos/turno.validaciones";

type FilaCancelacion = {
  idTurno: string;
  estadoTurno: EstadoTurno;
  fechaTurno: Date;
  horaInicioTurno: Date;
  profesorId: string | null;
  aulaId: string | null;
};

/**
 * HU-C-05 (spec_modulo_C.md §2.10): cancela un turno DISPONIBLE/COMPLETO
 * vigente o descarta un PENDIENTE, incluso vencido (N-1). Cancelación lógica:
 * el trigger `turno_sincronizar_reservas` libera `reservas_turno` al cambiar
 * `estadoTurno`; inscripciones y pagos se conservan. Evento tras el commit.
 */
export async function cancelarTurno(id: string, usuarioId: string) {
  const resultado = await prisma.$transaction(async (tx) => {
    const [turno] = await tx.$queryRaw<FilaCancelacion[]>`
      SELECT "idTurno", "estadoTurno", "fechaTurno", "horaInicioTurno", "profesorId", "aulaId"
      FROM "turnos" WHERE "idTurno" = ${id} FOR UPDATE
    `;
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", "No se encontró el turno");
    if (turno.estadoTurno === "CANCELADO") throw new ServiceError("TURNO_CANCELADO", "El turno ya está cancelado");
    if (turno.estadoTurno !== "PENDIENTE" && !turnoSigueVigente(turno.fechaTurno, turno.horaInicioTurno)) {
      throw new ServiceError("TURNO_VENCIDO", "El horario del turno ya pasó: no se puede cancelar");
    }

    const inscriptos = await tx.turnoAlumno.findMany({ where: { turnoId: id }, select: { alumnoId: true }, orderBy: { alumnoId: "asc" } });
    const actualizado = await tx.turno.updateMany({
      where: { idTurno: id, estadoTurno: { in: ["PENDIENTE", "DISPONIBLE", "COMPLETO"] } },
      data: { estadoTurno: "CANCELADO", modificadoPorUsuarioId: usuarioId },
    });
    if (actualizado.count === 0) throw new ServiceError("TURNO_MODIFICADO", "El turno cambió mientras lo editabas. Volvé a cargarlo");
    return { turno, alumnoIds: inscriptos.map(({ alumnoId }) => alumnoId) };
  });

  const { turno, alumnoIds } = resultado;
  await emitirEventoTurno("turno:cancelado", id, usuarioId, {
    turno_id: id,
    estado_anterior: turno.estadoTurno,
    profesor_id: turno.profesorId,
    aula_id: turno.aulaId,
    alumno_ids: alumnoIds,
    usuario_id: usuarioId,
  });
  return { id, estado: "CANCELADO" as const };
}
