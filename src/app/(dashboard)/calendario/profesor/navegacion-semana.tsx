import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  construirUrlCalendarioProfesor,
  desplazarSemana,
  formatearRangoSemana,
} from "@/lib/calendario-semana";
import type { RangoSemana } from "@/types/calendario.types";

/**
 * Encabezado de la agenda (HU-J-01 c1 y c5): rango de fechas consultado y
 * navegación Anterior / Hoy / Siguiente. Son links que cambian `?semana=` y
 * conservan `?profesorId=`; "Hoy" vuelve a la semana actual.
 */
export function NavegacionSemana({
  lunes,
  rango,
  profesorId,
  esSemanaActual,
}: {
  lunes: string;
  rango: RangoSemana;
  profesorId: string | undefined;
  esSemanaActual: boolean;
}) {
  const clase = cn(buttonVariants({ variant: "outline", size: "sm" }));

  return (
    <nav
      aria-label="Navegación de semanas"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <h2 className="text-base font-semibold tabular-nums" aria-live="polite">
        {formatearRangoSemana(rango.desde, rango.hasta)}
      </h2>
      <div className="flex items-center gap-2">
        <Link
          href={construirUrlCalendarioProfesor({ profesorId, semana: desplazarSemana(lunes, -1) })}
          className={clase}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Link>
        <Link
          href={construirUrlCalendarioProfesor({ profesorId })}
          className={clase}
          aria-current={esSemanaActual ? "date" : undefined}
        >
          Hoy
        </Link>
        <Link
          href={construirUrlCalendarioProfesor({ profesorId, semana: desplazarSemana(lunes, 1) })}
          className={clase}
          aria-label="Semana siguiente"
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
