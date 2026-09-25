import type { EventoCalendarioMateria as Evento } from "@/types/calendario.types";
import { BloqueEventoCalendario, type EstiloEventoEnGrilla } from "@/components/shared/bloque-evento-calendario";

/**
 * Bloque de un turno en el calendario por materia (HU-J-02 c2): Hora,
 * Profesor, Alumnos inscriptos como ocupación sobre cupo ("Alumnos: 3/5",
 * sin nombres), Aula y Estado (texto e ícono además del color).
 */
export function EventoCalendarioMateria({
  evento,
  estilo,
  volverA,
}: {
  evento: Evento;
  estilo: EstiloEventoEnGrilla;
  /** URL del calendario actual (materia + semana). */
  volverA: string;
}) {
  return (
    <BloqueEventoCalendario
      turnoId={evento.turno_id}
      horaInicio={evento.hora_inicio}
      horaFin={evento.hora_fin}
      estado={evento.estado}
      lineas={[evento.profesor, `Alumnos: ${evento.alumnos_inscriptos}`, evento.aula]}
      descripcion={`${evento.profesor} · ${evento.inscriptos} de ${evento.cupo} alumnos inscriptos · ${evento.aula}`}
      estilo={estilo}
      volverA={volverA}
    />
  );
}
