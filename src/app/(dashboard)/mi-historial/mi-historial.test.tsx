// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MiHistorialData } from "@/types/historial.types";
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));
import { MiHistorial } from "./mi-historial";
const data: MiHistorialData = {
  materias_disponibles: [{ id: "m1", nombre: "Matemática II" }, { id: "m2", nombre: "Física I" }],
  asistencia_por_materia: [{ materia_id: "m1", presentes: 3, ausentes: 1, sin_control: 1, porcentaje: 75 }],
  paginacion: { total: 12, pagina_actual: 1, total_paginas: 2, por_pagina: 10 },
  items: [
    { tipo: "EXAMEN", id: "e", fecha: "2026-10-03", materia: { id: "m2", nombre: "Física I" }, nota: "8" },
    { tipo: "INDICACION", id: "i", fecha: "2026-10-02", materia: { id: "m1", nombre: "Matemática II" }, indicacion: "Repasar funciones" },
    { tipo: "CLASE_DICTADA", id: "c", fecha: "2026-10-01", materia: { id: "m1", nombre: "Matemática II" }, profesor: "Laura Méndez", temas_vistos: "Regla de L’Hôpital", asistencia: null },
    { tipo: "CLASE_DICTADA", id: "c2", fecha: "2026-09-30", materia: { id: "m1", nombre: "Matemática II" }, profesor: "Laura Méndez", temas_vistos: null, asistencia: "AUSENTE" },
  ],
};
let host: HTMLDivElement; let root: Root;
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  m.fetch.mockResolvedValue({ ok: true, json: async () => ({ data }) });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() { await act(async () => root.render(<MiHistorial />)); await flush(); }
describe("E08 Mi historial", () => {
  it("tres tipos, temas, asistencia, porcentajes y nota", async () => {
    await render(); expect(host.textContent).toContain("75% de asistencia"); expect(host.textContent).toContain("Repasar funciones"); expect(host.textContent).toContain("Regla de L’Hôpital"); expect(host.textContent).toContain("Asistió (sin control de asistencia)"); expect(host.textContent).toContain("Ausente"); expect(host.querySelectorAll("ol > li")).toHaveLength(4);
  });
  it("página 2 y cambio de materia reinicia página 1", async () => {
    await render(); const next = host.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')!;
    await act(async () => next.click()); await flush(); expect(m.fetch.mock.calls.at(-1)?.[0]).toContain("pagina=2");
    const select = host.querySelector("select")!; await act(async () => { select.value = "m2"; select.dispatchEvent(new Event("change", { bubbles: true })); }); await flush();
    expect(m.fetch.mock.calls.at(-1)?.[0]).toContain("pagina=1"); expect(m.fetch.mock.calls.at(-1)?.[0]).toContain("materia_id=m2");
  });
  it("error y reintento conservan filtros", async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Servicio no disponible" } }) }); await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Servicio no disponible"); await act(async () => host.querySelector("button")!.click()); await flush(); expect(host.querySelectorAll("ol > li")).toHaveLength(4);
  });
  it("vacío literal", async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { ...data, items: [], materias_disponibles: [], asistencia_por_materia: [], paginacion: { ...data.paginacion, total: 0, total_paginas: 0 } } }) }); await render(); expect(host.textContent).toContain("Todavía no tenés historial académico");
  });
  it("loading y una respuesta antigua no reemplaza el filtro", async () => {
    await render(); let resolver: (value: unknown) => void = () => {};
    m.fetch.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
    const select = host.querySelector("select")!; await act(async () => { select.value = "m1"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(host.textContent).toContain("Cargando historial");
    await act(async () => { select.value = "m2"; select.dispatchEvent(new Event("change", { bubbles: true })); }); await flush();
    await act(async () => resolver({ ok: true, json: async () => ({ data: { ...data, items: [] } }) })); await flush(); expect(host.querySelectorAll("ol > li")).toHaveLength(4);
  });
});
