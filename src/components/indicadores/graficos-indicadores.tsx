"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { IngresoMes, OcupacionMes } from "@/types/indicadores.types";

/**
 * Meta ilustrativa de ocupación (spec_modulo_H.md §5, punto abierto P4): ningún
 * documento define una meta real; queda fija hasta que el PO la ratifique.
 */
export const META_OCUPACION_PORCENTAJE = 80;

const ETIQUETAS_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const formatoMoneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const formatoMonedaCompacto = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", notation: "compact", maximumFractionDigits: 1,
});
const formatoPorcentaje = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatoMesLargo = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-09" → "Sep 26": corto para el eje, el año desambigua rangos de hasta 24 meses. */
export function etiquetaMesCorta(mes: string): string {
  return `${ETIQUETAS_MES[Number(mes.slice(5, 7)) - 1] ?? mes} ${mes.slice(2, 4)}`;
}

/** "2026-09" → "septiembre de 2026", para tooltip y tabla accesible. */
export function etiquetaMesLarga(mes: string): string {
  return formatoMesLargo.format(new Date(`${mes}-01T12:00:00.000Z`));
}

export const formatearMoneda = (valor: number) => formatoMoneda.format(valor);
export const formatearPorcentaje = (valor: number) => `${formatoPorcentaje.format(valor)}%`;

const configIngresos = {
  total: { label: "Ingresos cobrados", color: "var(--chart-1)" },
} satisfies ChartConfig;

const configOcupacion = {
  ocupacion_promedio: { label: "Ocupación promedio", color: "var(--chart-2)" },
} satisfies ChartConfig;

type TarjetaProps = {
  id: string;
  titulo: string;
  descripcion: string;
  cargando: boolean;
  children: React.ReactNode;
};

function TarjetaIndicador({ id, titulo, descripcion, cargando, children }: TarjetaProps) {
  return (
    <Card aria-labelledby={`${id}-titulo`} aria-busy={cargando} role="region">
      <CardHeader>
        <CardTitle id={`${id}-titulo`} className="text-lg font-semibold text-foreground">{titulo}</CardTitle>
        <CardDescription className="text-muted-foreground">{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        {cargando ? (
          <div role="status" aria-label={`Cargando ${titulo.toLowerCase()}`} className="space-y-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="mx-auto h-4 w-32" />
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

/** Tabla equivalente al gráfico para lectores de pantalla: el valor nunca depende solo del color ni del hover. */
function TablaAccesible({ titulo, columna, filas }: { titulo: string; columna: string; filas: { mes: string; valor: string }[] }) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <thead><tr><th scope="col">Mes</th><th scope="col">{columna}</th></tr></thead>
      <tbody>
        {filas.map(({ mes, valor }) => (
          <tr key={mes}><th scope="row">{etiquetaMesLarga(mes)}</th><td>{valor}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function GraficoIngresos({ datos, cargando }: { datos: IngresoMes[]; cargando: boolean }) {
  return (
    <TarjetaIndicador
      id="indicador-ingresos"
      titulo="Ingresos cobrados por mes"
      descripcion="Total de pagos registrados según su fecha de pago, todas las formas de pago."
      cargando={cargando}
    >
      <ChartContainer config={configIngresos} className="aspect-auto h-64 w-full">
        <BarChart accessibilityLayer data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={etiquetaMesCorta} minTickGap={8} />
          <YAxis
            tickLine={false} axisLine={false} width={72} allowDecimals={false}
            tickFormatter={(valor: number) => formatoMonedaCompacto.format(valor)}
          />
          <ChartTooltip
            cursor
            content={(
              <ChartTooltipContent
                labelFormatter={(_, payload) => etiquetaMesLarga(String(payload?.[0]?.payload?.mes ?? ""))}
                formatter={(valor) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">Ingresos</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">{formatearMoneda(Number(valor))}</span>
                  </span>
                )}
              />
            )}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ChartContainer>
      <TablaAccesible
        titulo="Ingresos cobrados por mes"
        columna="Ingresos"
        filas={datos.map(({ mes, total }) => ({ mes, valor: formatearMoneda(total) }))}
      />
    </TarjetaIndicador>
  );
}

export function GraficoOcupacion({ datos, cargando }: { datos: OcupacionMes[]; cargando: boolean }) {
  return (
    <TarjetaIndicador
      id="indicador-ocupacion"
      titulo="Tasa de ocupación promedio"
      descripcion="Inscriptos sobre cupo de los turnos Disponibles y Completos ya dictados (sin Cancelados ni Pendientes)."
      cargando={cargando}
    >
      <ChartContainer config={configOcupacion} className="aspect-auto h-64 w-full">
        <LineChart accessibilityLayer data={datos} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={etiquetaMesCorta} minTickGap={8} />
          <YAxis
            tickLine={false} axisLine={false} width={48} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(valor: number) => `${valor}%`}
          />
          <ReferenceLine
            y={META_OCUPACION_PORCENTAJE}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{ value: `Meta ${META_OCUPACION_PORCENTAJE}%`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ChartTooltip
            cursor
            content={(
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) => etiquetaMesLarga(String(payload?.[0]?.payload?.mes ?? ""))}
                formatter={(valor) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">Ocupación</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">{formatearPorcentaje(Number(valor))}</span>
                  </span>
                )}
              />
            )}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="ocupacion_promedio"
            type="linear"
            stroke="var(--color-ocupacion_promedio)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: "var(--color-ocupacion_promedio)", stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--color-ocupacion_promedio)", stroke: "var(--card)", strokeWidth: 2 }}
          />
        </LineChart>
      </ChartContainer>
      <TablaAccesible
        titulo={`Tasa de ocupación promedio (meta ${META_OCUPACION_PORCENTAJE}%)`}
        columna="Ocupación"
        filas={datos.map(({ mes, ocupacion_promedio }) => ({ mes, valor: formatearPorcentaje(ocupacion_promedio) }))}
      />
    </TarjetaIndicador>
  );
}
