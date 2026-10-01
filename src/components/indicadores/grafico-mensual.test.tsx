// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GraficoMensual } from "./grafico-mensual";

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

describe("GraficoMensual", () => {
  it("expone una alternativa tabular con valor por mes y total", async () => {
    await act(async () => raiz.render(
      <GraficoMensual
        titulo="Turnos por mes"
        descripcion="Por fecha del turno."
        etiquetaValor="Turnos"
        color="chart-1"
        total={12}
        datos={[{ mes: "2026-04", cantidad: 0 }, { mes: "2026-05", cantidad: 12 }]}
      />,
    ));

    expect(contenedor.querySelector("h2")?.textContent).toBe("Turnos por mes");
    expect(contenedor.querySelectorAll("svg rect")).toHaveLength(2);
    const tabla = contenedor.querySelector("table")!;
    expect(tabla.getAttribute("aria-label")).toBe("Turnos por mes. Por fecha del turno.");
    expect(tabla.querySelector("caption")).toBeNull();
    expect((contenedor.querySelector("table") as HTMLTableElement).style.position).toBe("absolute");
    expect(contenedor.querySelectorAll('svg text[font-weight="600"]')).toHaveLength(1);
    expect(Number(contenedor.querySelector("svg rect")?.getAttribute("width"))).toBeGreaterThan(68);
    expect(contenedor.querySelector('svg text[font-size="15"]')).not.toBeNull();
    expect(contenedor.querySelector('svg text[font-size="14"]')).not.toBeNull();
    expect(contenedor.textContent).not.toContain("Turnos por mes. Por fecha del turno.");
    expect([...contenedor.querySelectorAll("tbody tr")].map((fila) => [...fila.querySelectorAll("th, td")].map((celda) => celda.textContent))).toEqual([
      ["abril de 2026", "0"],
      ["mayo de 2026", "12"],
    ]);
    expect(contenedor.querySelector("tfoot")?.textContent).toContain("12");
  });

  it("mantiene el eje y las etiquetas de mes cuando no hay datos", async () => {
    await act(async () => raiz.render(
      <GraficoMensual
        titulo="Alumnos nuevos por mes"
        descripcion="Por fecha de alta."
        etiquetaValor="Alumnos nuevos"
        color="chart-2"
        total={0}
        datos={[{ mes: "2026-09", cantidad: 0 }]}
      />,
    ));

    expect(contenedor.textContent).toContain("Alumnos nuevos por mes");
    expect(contenedor.textContent).toContain("septiembre de 2026");
    expect(contenedor.textContent).toContain("0");
    expect(contenedor.querySelectorAll("svg line")).toHaveLength(5);
  });

  it("mantiene los meses dentro de un gráfico compacto y aprovecha la escala para las barras", async () => {
    await act(async () => raiz.render(
      <GraficoMensual
        titulo="Turnos por mes"
        descripcion="Por fecha del turno."
        etiquetaValor="Turnos"
        color="chart-1"
        total={23}
        datos={[{ mes: "2026-04", cantidad: 0 }, { mes: "2026-09", cantidad: 23 }]}
      />,
    ));

    const svg = contenedor.querySelector("svg")!;
    const etiquetas = [...svg.querySelectorAll("text")];
    const etiquetaSeptiembre = etiquetas.find((etiqueta) => etiqueta.textContent === "Sep");
    const barra = svg.querySelectorAll("rect")[1]!;

    expect(svg.getAttribute("height")).toBe("260");
    expect(etiquetaSeptiembre?.getAttribute("y")).toBe("242");
    expect(etiquetas.map((etiqueta) => etiqueta.textContent)).toContain("25");
    expect(svg.querySelectorAll("line")).toHaveLength(6);
    expect(Number(barra.getAttribute("height"))).toBeGreaterThan(175);
  });
});
