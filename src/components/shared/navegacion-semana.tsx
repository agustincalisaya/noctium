import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { formatearRangoSemana } from "@/lib/calendario-semana";
import type { RangoSemana } from "@/types/calendario.types";

/**
 * Encabezado de una vista semanal del calendario (HU-J-01 c1/c5, HU-J-02
 * c1/c4): rango de fechas consultado y navegación Anterior / Hoy /
 * Siguiente. Recibe los links ya armados por la página, que conservan la
 * entidad elegida (profesor o materia); "Hoy" vuelve a la semana actual.
 */
export function NavegacionSemana({
  rango,
  hrefAnterior,
  hrefHoy,
  hrefSiguiente,
  esSemanaActual,
}: {
  rango: RangoSemana;
  hrefAnterior: string;
  hrefHoy: string;
  hrefSiguiente: string;
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
        <Link href={hrefAnterior} className={clase} aria-label="Semana anterior">
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Link>
        <Link href={hrefHoy} className={clase} aria-current={esSemanaActual ? "date" : undefined}>
          Hoy
        </Link>
        <Link href={hrefSiguiente} className={clase} aria-label="Semana siguiente">
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
