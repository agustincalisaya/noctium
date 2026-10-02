// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IngresoMes, OcupacionMes } from "@/types/indicadores.types";
import { IndicadoresClient } from "./indicadores-client";

const MESES = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const ingresos: IngresoMes[] = MESES.map((mes, i) => ({ mes, total: [450000, 0, 512000.5, 120000, 98000, 300000][i]! }));
const ocupacion: OcupacionMes[] = MESES.map((mes, i) => ({ mes, ocupacion_promedio: [64.2, 0, 71.8, 68.3, 80, 55.5][i]! }));
const respuesta = (cuerpo: unknown, ok = true) => ({ ok, json: async () => cuerpo }) as Response;

let contenedor: HTMLDivElement;
let raiz: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function responderSegunRuta(datosIngresos: unknown = ingresos, datosOcupacion: unknown = ocupacion) {
  fetchMock.mockImplementation(async (url: string) => respuesta({
    data: url.startsWith("/api/indicadores/ingresos-por-mes") ? datosIngresos : datosOcupacion,
    error: null,
  }));
}

async function esperarRender() {
  await act(async () => { await new Promise((resolver) => setTimeout(resolver, 0)); });
}

async function renderizar() {
  await act(async () => raiz.render(<IndicadoresClient />));
  await esperarRender();
}

async function cambiarMes(select: HTMLSelectElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, valor);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await esperarRender();
}

const textoTabla = (titulo: string) =>
  [...contenedor.querySelectorAll("table")].find((tabla) => tabla.caption?.textContent?.startsWith(titulo));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  fetchMock = vi.fn();
  responderSegunRuta();
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
  it("pide los dos indicadores con el mismo rango y precarga los selectores con el rango del servidor", async () => {
    await renderizar();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/indicadores/ingresos-por-mes", "/api/indicadores/ocupacion-por-mes",
    ]);
    const desde = contenedor.querySelector<HTMLSelectElement>("#indicadores-desde")!;
    const hasta = contenedor.querySelector<HTMLSelectElement>("#indicadores-hasta")!;
    expect(desde.value).toBe("2026-04");
    expect(hasta.value).toBe("2026-09");
    expect(desde.options).toHaveLength(24);
    expect(desde.labels?.[0]?.textContent).toBe("Desde");
    expect(contenedor.textContent).toContain("Ingresos cobrados por mes");
    expect(contenedor.textContent).toContain("Tasa de ocupación promedio");
  });

  it("muestra los valores exactos: moneda local para ingresos y porcentaje con 1 decimal para ocupación", async () => {
    await renderizar();

    const celdasIngresos = [...textoTabla("Ingresos cobrados por mes")!.querySelectorAll("tbody td")].map((td) => td.textContent);
    const celdasOcupacion = [...textoTabla("Tasa de ocupación promedio")!.querySelectorAll("tbody td")].map((td) => td.textContent);
    const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
    expect(celdasIngresos).toEqual(ingresos.map(({ total }) => moneda.format(total)));
    expect(celdasIngresos[1]).toBe(moneda.format(0)); // mes sin pagos: $0, no se omite
    expect(celdasOcupacion).toEqual(["64,2%", "0,0%", "71,8%", "68,3%", "80,0%", "55,5%"]);
    expect(textoTabla("Tasa de ocupación promedio")!.caption!.textContent).toContain("meta 80%");
  });

  it("los dos gráficos van en Card separadas, en grilla de 2 columnas en desktop y 1 en mobile", async () => {
    await renderizar();

    const tarjetas = contenedor.querySelectorAll('[data-slot="card"]');
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0]!.parentElement!.className).toContain("grid-cols-1");
    expect(tarjetas[0]!.parentElement!.className).toContain("lg:grid-cols-2");
    expect(tarjetas[0]!.querySelector('[data-slot="chart"]')).not.toBeNull();
    expect(tarjetas[1]!.querySelector('[data-slot="chart"]')).not.toBeNull();
  });

  it("muestra un Skeleton dentro de cada Card mientras resuelve", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    await renderizar();

    const tarjetas = contenedor.querySelectorAll('[data-slot="card"]');
    expect(tarjetas).toHaveLength(2);
    for (const tarjeta of tarjetas) {
      expect(tarjeta.getAttribute("aria-busy")).toBe("true");
      expect(tarjeta.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    }
  });

  it("actualiza los dos gráficos cuando cambia el rango compartido", async () => {
    await renderizar();
    await cambiarMes(contenedor.querySelector<HTMLSelectElement>("#indicadores-desde")!, "2026-05");

    expect(fetchMock.mock.calls.slice(2).map(([url]) => url)).toEqual([
      "/api/indicadores/ingresos-por-mes?desde=2026-05&hasta=2026-09",
      "/api/indicadores/ocupacion-por-mes?desde=2026-05&hasta=2026-09",
    ]);
  });

  it("sin datos en ninguno de los dos indicadores muestra el mensaje en vez de gráficos en cero", async () => {
    responderSegunRuta(
      MESES.map((mes) => ({ mes, total: 0 })),
      MESES.map((mes) => ({ mes, ocupacion_promedio: 0 })),
    );
    await renderizar();

    expect(contenedor.textContent).toContain("Todavía no hay suficientes datos para este período");
    expect(contenedor.querySelector('[data-slot="card"]')).toBeNull();
  });

  it("si solo uno de los indicadores tiene datos, muestra ambos gráficos", async () => {
    responderSegunRuta(MESES.map((mes) => ({ mes, total: 0 })), ocupacion);
    await renderizar();

    expect(contenedor.textContent).not.toContain("Todavía no hay suficientes datos");
    expect(contenedor.querySelectorAll('[data-slot="card"]')).toHaveLength(2);
  });

  it("no consulta un rango invertido y lo informa", async () => {
    await renderizar();
    await cambiarMes(contenedor.querySelector<HTMLSelectElement>("#indicadores-hasta")!, "2026-03");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe("El mes desde no puede ser posterior al mes hasta");
  });

  it("ante un error del servidor muestra el mensaje y permite reintentar", async () => {
    fetchMock.mockResolvedValue(respuesta({ data: null, error: { message: "Error de prueba" } }, false));
    await renderizar();

    const alerta = contenedor.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain("Error de prueba");
    responderSegunRuta();
    await act(async () => alerta.querySelector("button")!.click());
    await esperarRender();
    expect(contenedor.querySelectorAll('[data-slot="card"]')).toHaveLength(2);
  });
});
