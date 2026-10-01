import type { ReactNode } from "react";
import { ControlSegmentado } from "@/components/shared/control-segmentado";
import { NavegacionCalendario } from "@/components/shared/navegacion-calendario";
import {
  ETIQUETA_VISTA,
  VISTAS_CALENDARIO,
  type NavegacionDelCalendario,
  type VistaCalendario,
} from "@/lib/calendario-semana";

/**
 * Encabezado común de las pantallas de calendario (HU-J-03, diseño de
 * referencia de HU-J-03.md §5.1):
 * - Título "Calendario" + subtítulo de la pantalla, y el control
 *   Día / Semana / Mes arriba a la derecha (debajo del título en pantallas
 *   chicas).
 * - Fila de filtros: toggle Por profesor / Por materia y el selector
 *   (`children`) a la izquierda; "Hoy", ‹ › y el rótulo del período a la
 *   derecha (solo con una entidad elegida).
 */
export function EncabezadoCalendario({
  subtitulo,
  vista,
  hrefsVista,
  tipos,
  navegacion,
  children,
}: {
  subtitulo: string;
  vista: VistaCalendario;
  hrefsVista: Record<VistaCalendario, string>;
  /** Toggle entre la agenda por profesor y por materia. */
  tipos: { etiqueta: string; href: string; activa: boolean }[];
  /** `undefined` mientras no hay profesor o materia elegidos. */
  navegacion?: NavegacionDelCalendario;
  /** Selector de profesor o materia. */
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Calendario</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <ControlSegmentado
          etiqueta="Vista del calendario"
          opciones={VISTAS_CALENDARIO.map((opcion) => ({
            etiqueta: ETIQUETA_VISTA[opcion],
            href: hrefsVista[opcion],
            activa: opcion === vista,
          }))}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <ControlSegmentado etiqueta="Tipo de agenda" opciones={tipos} className="shrink-0" />
          {children}
        </div>
        {navegacion && <NavegacionCalendario vista={vista} navegacion={navegacion} />}
      </div>
    </div>
  );
}
