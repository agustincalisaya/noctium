// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IndicadoresMensuales } from "@/types/indicadores.types";
import { IndicadoresClient } from "./indicadores-client";

const datos: IndicadoresMensuales = {
  rango: { desde: "2026-04", hasta: "2026-09", meses: 6 },
  meses: [
    { mes: "2026-04", turnos: 8, alumnos_nuevos: 1 },
    { mes: "2026-05", turnos: 0, alumnos_nuevos: 0 },
    { mes: "2026-06", turnos: 4, alumnos_nuevos: 2 },
    { mes: "2026-07", turnos: 1, alumnos_nuevos: 0 },
    { mes: "2026-08", turnos: 3, alumnos_nuevos: 1 },
    { mes: "2026-09", turnos: 2, alumnos_nuevos: 1 },
  ],
};
const respuesta = (cuerpo: unknown, ok = true) => ({ ok, json: async () => cuerpo }) as Response;

let contenedor: HTMLDivElement;
let raiz: Root;
let fetchMock: ReturnType<typeof vi.fn>;

async function esperarRender() {
  await act(async () => { await new Promise((resolver) => setTimeout(resolver, 0)); });
}

async function cambiarMes(select: HTMLSelectElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, valor);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await esperarRender();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock = vi.fn().mockResolvedValue(respuesta({ data: datos, error: null }));
  vi.stubGlobal("fetch", fetchMock);
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});

describe("IndicadoresClient", () => {
  it("carga el rango del servidor y muestra ambos indicadores", async () => {
    await act(async () => raiz.render(<IndicadoresClient />));
    await esperarRender();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/indicadores");
    const desde = contenedor.querySelector<HTMLSelectElement>("#indicadores-desde")!;
    const hasta = contenedor.querySelector<HTMLSelectElement>("#indicadores-hasta")!;
    expect(desde.value).toBe("2026-04");
    expect(hasta.value).toBe("2026-09");
    expect([...desde.options].map((opcion) => opcion.textContent)).toContain("Abril 2026");
    expect([...hasta.options].map((opcion) => opcion.textContent)).toContain("Septiembre 2026");
    expect(desde.options).toHaveLength(24);
    expect(desde.parentElement?.querySelector("svg")).toBeNull();
    expect(desde.labels?.[0]?.textContent).toBe("Desde");
    expect(hasta.labels?.[0]?.textContent).toBe("Hasta");
    expect(contenedor.textContent).toContain("Turnos por mes");
    expect(contenedor.textContent).toContain("Alumnos nuevos por mes");
    expect(contenedor.textContent).toContain("Por fecha del turno; Disponible, Completo y Cancelado");
    expect(contenedor.textContent).toContain("Por fecha de alta de la ficha.");
    expect(contenedor.textContent).not.toContain("HU-H-01");
    expect(contenedor.textContent).not.toContain("HU-H-02");
    expect(contenedor.textContent).toContain("18");
    expect(contenedor.textContent).toContain("5");
  });

  it("actualiza las dos series cuando cambia el rango compartido", async () => {
    await act(async () => raiz.render(<IndicadoresClient />));
    await esperarRender();
    await cambiarMes(contenedor.querySelector<HTMLSelectElement>("#indicadores-desde")!, "2026-05");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/indicadores?desde=2026-05&hasta=2026-09");
  });

  it("muestra ceros y el texto de período vacío", async () => {
    const vacios: IndicadoresMensuales = {
      rango: { desde: "2026-04", hasta: "2026-09", meses: 6 },
      meses: datos.meses.map(({ mes }) => ({ mes, turnos: 0, alumnos_nuevos: 0 })),
    };
    fetchMock.mockResolvedValueOnce(respuesta({ data: vacios, error: null }));

    await act(async () => raiz.render(<IndicadoresClient />));
    await esperarRender();

    expect(contenedor.textContent).toContain("No hay datos para el período seleccionado.");
    expect(contenedor.querySelectorAll("table tbody td")).toHaveLength(12);
    expect([...contenedor.querySelectorAll("table tbody td")].every((celda) => celda.textContent === "0")).toBe(true);
  });

  it("no consulta un rango invertido y permite corregirlo", async () => {
    await act(async () => raiz.render(<IndicadoresClient />));
    await esperarRender();
    await cambiarMes(contenedor.querySelector<HTMLSelectElement>("#indicadores-hasta")!, "2026-03");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe("El mes desde no puede ser posterior al mes hasta");
  });
});
