import Link from "next/link";
import { cn } from "@/lib/utils";
import { CLASE_ESTADO, ETIQUETA_ESTADO, ICONO_ESTADO } from "@/components/shared/bloque-evento-calendario";
import { DIAS_SEMANA } from "@/lib/horario-atencion";
import { ETIQUETA_DIA_CORTA, formatearDiaLargo } from "@/lib/calendario-semana";
import type { ResumenDiaCalendario } from "@/types/calendario.types";

function textoCantidad(cantidad: number): string {
  return cantidad === 1 ? "1 turno" : `${cantidad} turnos`;
}

/**
 * Vista mes del calendario (HU-J-03 c2): grilla de lunes a domingo con
 * semanas completas. Cada día muestra un indicador compacto (cantidad de
 * turnos y estado predominante, con texto e ícono), sin detalle hora a hora;
 * los días de relleno del mes anterior/siguiente van atenuados. Cada día es
 * un link a la vista día de esa fecha (`hrefDia`, que conserva la entidad).
 */
export function GrillaMensual({
  dias,
  hoy,
  hrefDia,
}: {
  dias: readonly ResumenDiaCalendario[];
  /** "AAAA-MM-DD" en la zona del centro. */
  hoy: string;
  hrefDia: (fecha: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="grid grid-cols-7" role="presentation">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="border-b border-border bg-muted px-1 py-1.5 text-center text-xs font-medium text-muted-foreground [&:not(:first-child)]:border-l"
            aria-hidden
          >
            {ETIQUETA_DIA_CORTA[dia]}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-7">
        {dias.map((resumen, i) => (
          <li key={resumen.fecha} className={cn("border-border", i >= 7 && "border-t", i % 7 !== 0 && "border-l")}>
            <CeldaDelMes resumen={resumen} esHoy={resumen.fecha === hoy} href={hrefDia(resumen.fecha)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CeldaDelMes({ resumen, esHoy, href }: { resumen: ResumenDiaCalendario; esHoy: boolean; href: string }) {
  const { fecha, en_mes, cantidad, estado_predominante } = resumen;
  const predominante = estado_predominante ? ETIQUETA_ESTADO[estado_predominante] : null;
  const IconoEstado = estado_predominante ? ICONO_ESTADO[estado_predominante] : null;
  const descripcion =
    cantidad === 0 ? "sin turnos" : `${textoCantidad(cantidad)}, mayoría ${predominante}`;

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`${formatearDiaLargo(fecha)}${esHoy ? " (hoy)" : ""}: ${descripcion}. Ver día`}
      aria-current={esHoy ? "date" : undefined}
      data-en-mes={en_mes}
      className={cn(
        "flex h-full min-h-16 flex-col gap-1 p-1 transition-colors hover:bg-accent focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-24 sm:p-1.5",
        en_mes ? "bg-card" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "w-fit rounded-full px-1.5 font-mono text-xs tabular-nums",
          esHoy ? "bg-brand-accent font-semibold text-foreground" : en_mes ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {Number(fecha.slice(8, 10))}
      </span>
      {cantidad > 0 && IconoEstado && estado_predominante && (
        <>
          <span className="w-fit rounded-sm bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            <span className="sm:hidden">{cantidad}</span>
            <span className="hidden sm:inline">{textoCantidad(cantidad)}</span>
          </span>
          <span
            className={cn(
              "inline-flex w-fit max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              CLASE_ESTADO[estado_predominante],
            )}
          >
            <IconoEstado className="size-3 shrink-0" aria-hidden />
            <span className="sr-only truncate sm:not-sr-only">{predominante}</span>
          </span>
        </>
      )}
    </Link>
  );
}
