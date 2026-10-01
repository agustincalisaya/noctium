"use client";

import { useEffect, useRef, useState } from "react";

type DatoMensual = { mes: string; cantidad: number };
type ColorGrafico = "chart-1" | "chart-2";

type GraficoMensualProps = {
  titulo: string;
  descripcion: string;
  etiquetaValor: string;
  color: ColorGrafico;
  total: number;
  datos: DatoMensual[];
};

const ANCHO_BASE = 920;
const ANCHO_MINIMO_POR_MES = 90;
const ALTO = 260;
const MARGEN_IZQUIERDO = 52;
const MARGEN_DERECHO = 24;
const MARGEN_SUPERIOR = 28;
const MARGEN_INFERIOR = 40;
const CLASE_COLOR: Record<ColorGrafico, string> = {
  "chart-1": "fill-chart-1",
  "chart-2": "fill-chart-2",
};
const ESTILO_VISUALMENTE_OCULTO: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

const ETIQUETAS_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function etiquetaMes(mes: string): string {
  const numeroMes = Number(mes.slice(5, 7));
  return ETIQUETAS_MES[numeroMes - 1] ?? mes;
}

function crearMarcasEje(maximo: number): number[] {
  if (maximo <= 0) return [0, 1, 2, 3, 4];

  const aproximado = maximo / 5;
  const potencia = 10 ** Math.floor(Math.log10(aproximado));
  const escala = aproximado / potencia;
  const unidades = [1, 2, 2.5, 5, 10];
  let indiceUnidad = unidades.findIndex((unidad) => unidad >= escala);
  if (indiceUnidad < 0) indiceUnidad = unidades.length - 1;

  let paso = unidades[indiceUnidad]! * potencia;
  if (paso < 1) {
    paso = 1;
  } else if (!Number.isInteger(paso)) {
    const siguienteUnidad = unidades.slice(indiceUnidad + 1).find((unidad) => Number.isInteger(unidad * potencia));
    paso = (siguienteUnidad ?? 10) * potencia;
  }

  const maximoEje = Math.ceil(maximo / paso) * paso;
  const cantidadPasos = Math.round(maximoEje / paso);
  return Array.from({ length: cantidadPasos + 1 }, (_, indice) => indice * paso);
}

export function GraficoMensual({ titulo, descripcion, etiquetaValor, color, total, datos }: GraficoMensualProps) {
  const contenedorGraficoRef = useRef<HTMLDivElement>(null);
  const [anchoContenedor, setAnchoContenedor] = useState(ANCHO_BASE);

  useEffect(() => {
    const contenedor = contenedorGraficoRef.current;
    if (!contenedor) return;

    const medirAncho = () => {
      const anchoMedido = contenedor.clientWidth;
      if (anchoMedido > 0) setAnchoContenedor(Math.round(anchoMedido));
    };

    medirAncho();
    const observador = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(medirAncho);
    observador?.observe(contenedor);
    window.addEventListener("resize", medirAncho);

    return () => {
      observador?.disconnect();
      window.removeEventListener("resize", medirAncho);
    };
  }, []);

  const ancho = Math.max(
    anchoContenedor,
    datos.length * ANCHO_MINIMO_POR_MES + MARGEN_IZQUIERDO + MARGEN_DERECHO,
  );
  const altoUtil = ALTO - MARGEN_SUPERIOR - MARGEN_INFERIOR;
  const anchoUtil = ancho - MARGEN_IZQUIERDO - MARGEN_DERECHO;
  const maximoDato = Math.max(0, ...datos.map((dato) => dato.cantidad));
  const etiquetasEje = crearMarcasEje(maximoDato);
  const maximoEje = etiquetasEje[etiquetasEje.length - 1] || 1;
  const anchoGrupo = datos.length ? anchoUtil / datos.length : anchoUtil;
  const anchoBarra = Math.min(84, anchoGrupo * 0.62);
  const formatoNumero = new Intl.NumberFormat("es-AR");

  return (
    <section aria-labelledby={`${color}-titulo`} className="relative rounded-xl border border-border bg-card p-5 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="space-y-1">
          <h2 id={`${color}-titulo`} className="text-lg font-semibold text-foreground">{titulo}</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{descripcion}</p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="tabular-nums text-3xl font-semibold leading-none text-foreground">{formatoNumero.format(total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">en el período</p>
        </div>
      </header>

      <div ref={contenedorGraficoRef} className="mt-4 w-full overflow-x-auto overscroll-x-contain">
        <svg
          aria-hidden="true"
          width={ancho}
          height={ALTO}
          viewBox={`0 0 ${ancho} ${ALTO}`}
          className="block max-w-none"
          style={{ width: `${ancho}px`, height: "auto" }}
        >
          {etiquetasEje.map((valor, indice) => {
            const y = MARGEN_SUPERIOR + altoUtil - (valor / maximoEje) * altoUtil;
            return (
              <g key={indice}>
                <line x1={MARGEN_IZQUIERDO} y1={y} x2={ancho - MARGEN_DERECHO} y2={y} className="stroke-border" strokeWidth="1" />
                <text x={MARGEN_IZQUIERDO - 10} y={y + 5} textAnchor="end" className="fill-muted-foreground" fontSize="14">
                  {formatoNumero.format(Math.round(valor))}
                </text>
              </g>
            );
          })}

          {datos.map((dato, indice) => {
            const centro = MARGEN_IZQUIERDO + anchoGrupo * indice + anchoGrupo / 2;
            const altura = (dato.cantidad / maximoEje) * altoUtil;
            const y = MARGEN_SUPERIOR + altoUtil - altura;
            return (
              <g key={dato.mes}>
                <text x={centro} y={Math.max(MARGEN_SUPERIOR - 8, y - 9)} textAnchor="middle" className="fill-foreground" fontSize="15" fontWeight="500">
                  {formatoNumero.format(dato.cantidad)}
                </text>
                <rect
                  x={centro - anchoBarra / 2}
                  y={y}
                  width={anchoBarra}
                  height={altura}
                  rx="4"
                  className={`${CLASE_COLOR[color]} transition-opacity hover:opacity-80`}
                />
                <text
                  x={centro}
                  y={ALTO - 18}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="14"
                  fontWeight={indice === datos.length - 1 ? "600" : "400"}
                >
                  {etiquetaMes(dato.mes)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <table aria-label={`${titulo}. ${descripcion}`} className="sr-only" style={ESTILO_VISUALMENTE_OCULTO}>
        <thead>
          <tr><th scope="col">Mes</th><th scope="col">{etiquetaValor}</th></tr>
        </thead>
        <tbody>
          {datos.map((dato) => (
            <tr key={dato.mes}>
              <th scope="row">{new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dato.mes}-01T12:00:00.000Z`))}</th>
              <td>{formatoNumero.format(dato.cantidad)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th scope="row">Total del período</th><td>{formatoNumero.format(total)}</td></tr></tfoot>
      </table>
    </section>
  );
}
