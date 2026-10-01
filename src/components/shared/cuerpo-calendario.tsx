import type { ReactNode } from "react";
import { GrillaSemanal } from "@/components/shared/grilla-semanal";
import { GrillaMensual } from "@/components/shared/grilla-mensual";
import { CalendarioVacio } from "@/components/shared/estado-calendario";
import type { EstiloEventoEnGrilla } from "@/components/shared/bloque-evento-calendario";
import type { DiaDeSemana, ParametrosGrilla } from "@/lib/calendario-semana";
import type { ResumenDiaCalendario } from "@/types/calendario.types";

type EventoEnGrilla = { fecha: string; hora_inicio: string; hora_fin: string };

/**
 * Cuerpo de una pantalla de calendario, compartido por la agenda por
 * profesor (HU-J-01) y por materia (HU-J-02) en sus tres vistas (HU-J-03):
 * día y semana con la grilla horaria (el día, con una sola columna) y mes
 * con la grilla mensual. Si el período no tiene turnos, muestra el aviso
 * de vacío sobre la grilla.
 */
export function CuerpoCalendario<E extends EventoEnGrilla>({
  calendario,
  hoy,
  encabezado,
  textoVacio,
  hrefDia,
  renderEvento,
}: {
  calendario:
    | { vista: "dia" | "semana"; dias: DiaDeSemana[]; horario: ParametrosGrilla; eventos: E[] }
    | { vista: "mes"; dias: ResumenDiaCalendario[] };
  hoy: string;
  /** Línea "Turnos de …" sobre la grilla. */
  encabezado: ReactNode;
  textoVacio: string;
  /** Link de cada día del mes a su vista día (conserva profesor o materia). */
  hrefDia: (fecha: string) => string;
  renderEvento: (evento: E, estilo: EstiloEventoEnGrilla) => ReactNode;
}) {
  const sinTurnos =
    calendario.vista === "mes"
      ? calendario.dias.every(({ en_mes, cantidad }) => !en_mes || cantidad === 0)
      : calendario.eventos.length === 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{encabezado}</p>

      {sinTurnos && <CalendarioVacio texto={textoVacio} />}

      {calendario.vista === "mes" ? (
        <GrillaMensual dias={calendario.dias} hoy={hoy} hrefDia={hrefDia} />
      ) : (
        <GrillaSemanal
          dias={calendario.dias}
          horario={calendario.horario}
          eventos={calendario.eventos}
          hoy={hoy}
          renderEvento={renderEvento}
        />
      )}
    </div>
  );
}
