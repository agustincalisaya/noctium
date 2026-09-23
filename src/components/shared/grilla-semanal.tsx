import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ETIQUETA_DIA } from "@/lib/horario-atencion";
import {
  asignarCarriles,
  formatearFechaCorta,
  franjasDeLaGrilla,
  posicionEnGrilla,
  type DiaDeSemana,
  type ParametrosGrilla,
} from "@/lib/calendario-semana";

/** Alto de cada franja de la grilla, en rem. */
const ALTO_FRANJA_REM = 3;

type EventoEnGrilla = { fecha: string; hora_inicio: string; hora_fin: string };

/**
 * Grilla semanal de solo lectura (HU-J-01; pensada para reutilizarse en
 * HU-J-02): una columna por día operativo y una fila por franja del
 * horario operativo. Cada evento se posiciona por su hora de inicio y
 * ocupa su intervalo completo; los que se superponen se muestran uno al
 * lado del otro (`spec_modulo_J.md` §3.3). Qué muestra cada evento lo
 * decide quien la usa (`renderEvento`).
 */
export function GrillaSemanal<T extends EventoEnGrilla>({
  dias,
  horario,
  eventos,
  hoy,
  renderEvento,
}: {
  dias: DiaDeSemana[];
  horario: ParametrosGrilla;
  eventos: readonly T[];
  /** "AAAA-MM-DD" en la zona del centro, para resaltar la columna de hoy. */
  hoy: string;
  renderEvento: (evento: T, estilo: { top: string; height: string; left: string; width: string }) => ReactNode;
}) {
  const franjas = franjasDeLaGrilla(horario);
  const altoColumna = `${franjas.length * ALTO_FRANJA_REM}rem`;
  const columnas = `4rem repeat(${dias.length}, minmax(9rem, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <div className="grid min-w-max" style={{ gridTemplateColumns: columnas }}>
        {/* Encabezado: día y fecha */}
        <div className="sticky left-0 z-10 border-b border-border bg-muted" aria-hidden />
        {dias.map(({ fecha, dia }) => {
          const esHoy = fecha === hoy;
          return (
            <div
              key={fecha}
              className={cn(
                "border-b border-l border-border px-2 py-2 text-center text-sm",
                esHoy ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
              )}
              aria-current={esHoy ? "date" : undefined}
            >
              <span className="font-medium">{ETIQUETA_DIA[dia]}</span>{" "}
              <span className="tabular-nums">{formatearFechaCorta(fecha)}</span>
              {esHoy && <span className="sr-only"> (hoy)</span>}
            </div>
          );
        })}

        {/* Columna de horas */}
        <div className="sticky left-0 z-10 bg-card" aria-hidden>
          {franjas.map((franja) => (
            <div
              key={franja}
              className="border-t border-border px-2 pt-0.5 text-right text-xs tabular-nums text-muted-foreground first:border-t-0"
              style={{ height: `${ALTO_FRANJA_REM}rem` }}
            >
              {franja}
            </div>
          ))}
        </div>

        {/* Una columna por día, con los eventos posicionados encima de las franjas */}
        {dias.map(({ fecha, dia }) => {
          const delDia = asignarCarriles(eventos.filter((evento) => evento.fecha === fecha));
          return (
            <section
              key={fecha}
              aria-label={`${ETIQUETA_DIA[dia]} ${formatearFechaCorta(fecha)}`}
              className="relative border-l border-border"
              style={{ height: altoColumna }}
            >
              {franjas.map((franja) => (
                <div
                  key={franja}
                  className="border-t border-border first:border-t-0"
                  style={{ height: `${ALTO_FRANJA_REM}rem` }}
                  aria-hidden
                />
              ))}
              <ul>
                {delDia.map(({ evento, carril, carriles }, i) => {
                  const posicion = posicionEnGrilla(evento, horario);
                  if (!posicion) return null;
                  return (
                    <li key={i}>
                      {renderEvento(evento, {
                        top: `${posicion.filaInicio * ALTO_FRANJA_REM}rem`,
                        height: `calc(${posicion.filas * ALTO_FRANJA_REM}rem - 2px)`,
                        left: `calc(${(carril / carriles) * 100}% + 2px)`,
                        width: `calc(${100 / carriles}% - 4px)`,
                      })}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
