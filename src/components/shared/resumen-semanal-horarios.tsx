import { agruparHorariosPorDia, formatearIntervalos } from "@/lib/horario-atencion";
import type { HorarioAtencion } from "@/types/profesor.types";

/**
 * Resumen semanal de horarios de atención (HU-D-04 c6): intervalos
 * agrupados por día, en orden de la semana y por hora de inicio
 * (`agruparHorariosPorDia`). Solo lista los días con al menos un intervalo;
 * los contiguos se muestran por separado, tal como están registrados. Lo
 * usan la ficha del profesor, la pantalla de registro de horario y el
 * detalle de HU-D-05.
 */
export function ResumenSemanalHorarios({
  horarios,
  mensajeVacio = "Sin horarios de atención registrados",
}: {
  horarios: HorarioAtencion[];
  mensajeVacio?: string;
}) {
  const porDia = agruparHorariosPorDia(horarios);

  if (porDia.length === 0) {
    return <p className="text-sm text-muted-foreground">{mensajeVacio}</p>;
  }

  return (
    <dl className="divide-y divide-border">
      {porDia.map(({ dia, etiqueta, intervalos }) => (
        <div key={dia} className="grid gap-1 py-2 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr]">
          <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
          <dd className="flex flex-wrap gap-2" title={formatearIntervalos(intervalos)}>
            {intervalos.map((intervalo) => (
              <span
                key={intervalo.id}
                className="rounded-md border border-border bg-muted px-2 py-0.5 text-sm font-medium tabular-nums"
              >
                {intervalo.horaInicio}–{intervalo.horaFin}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
