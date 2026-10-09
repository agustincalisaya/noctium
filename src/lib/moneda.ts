const formatoMonto = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/**
 * Importe en pesos con el formato de las confirmaciones (HU-C-25, criterio 2):
 * "$ 22.000" — sin decimales y con separador de miles es-AR.
 *
 * No reutiliza `formatearMoneda` de `components/indicadores`: ese usa
 * `style: "currency"` con dos decimales ("$ 22.000,00"), pensado para gráficos.
 */
export function formatearMonto(valor: number): string {
  return `$ ${formatoMonto.format(valor)}`;
}
