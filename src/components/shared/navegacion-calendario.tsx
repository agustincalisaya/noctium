import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { NavegacionDelCalendario, VistaCalendario } from "@/lib/calendario-semana";

const UNIDAD: Record<VistaCalendario, { anterior: string; siguiente: string }> = {
  dia: { anterior: "Día anterior", siguiente: "Día siguiente" },
  semana: { anterior: "Semana anterior", siguiente: "Semana siguiente" },
  mes: { anterior: "Mes anterior", siguiente: "Mes siguiente" },
};

/**
 * Navegación del período (HU-J-01 c5, HU-J-02 c4, HU-J-03 c5): "Hoy", ‹ y ›
 * según la vista activa, y el rótulo del período. Recibe los links ya
 * armados por la página (`navegacionDelCalendario()`), que conservan la
 * entidad elegida.
 */
export function NavegacionCalendario({
  vista,
  navegacion,
}: {
  vista: VistaCalendario;
  navegacion: NavegacionDelCalendario;
}) {
  const clase = cn(buttonVariants({ variant: "outline", size: "sm" }));

  return (
    <nav aria-label="Navegación del calendario" className="flex flex-wrap items-center gap-2">
      <Link href={navegacion.hrefHoy} className={clase} aria-current={navegacion.esPeriodoActual ? "date" : undefined}>
        Hoy
      </Link>
      <Link href={navegacion.hrefAnterior} className={cn(clase, "px-2")} aria-label={UNIDAD[vista].anterior}>
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <Link href={navegacion.hrefSiguiente} className={cn(clase, "px-2")} aria-label={UNIDAD[vista].siguiente}>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
      <h2 className="text-base font-semibold" aria-live="polite">
        {navegacion.rotulo}
      </h2>
    </nav>
  );
}
