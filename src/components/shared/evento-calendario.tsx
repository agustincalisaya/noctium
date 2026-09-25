import type { EventoCalendario as Evento } from "@/types/calendario.types";
import { BloqueEventoCalendario, type EstiloEventoEnGrilla } from "@/components/shared/bloque-evento-calendario";

/**
 * Bloque de un turno en la agenda por profesor (HU-J-01 c3): Hora, Alumno,
 * Materia, Aula y Estado (texto e ícono además del color). Abre el detalle
 * con `?volver=` apuntando a la agenda actual (c6).
 */
export function EventoCalendario({
  evento,
  estilo,
  volverA,
}: {
  evento: Evento;
  estilo: EstiloEventoEnGrilla;
  /** URL de la agenda actual (profesor + semana). */
  volverA: string;
}) {
  return (
    <BloqueEventoCalendario
      turnoId={evento.turno_id}
      horaInicio={evento.hora_inicio}
      horaFin={evento.hora_fin}
      estado={evento.estado}
      lineas={[evento.alumno, evento.materia, evento.aula]}
      descripcion={`${evento.alumno} · ${evento.materia} · ${evento.aula}`}
      estilo={estilo}
      volverA={volverA}
    />
  );
}
