// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ datos: {} as Record<string, unknown>, errores: {} as Record<string, string>, retryMateria: vi.fn(), retryProfesor: vi.fn(), rangos: [] as unknown[] }));
vi.mock("@/components/indicadores/use-indicador", () => ({ useIndicador: (ruta: string, rango: unknown) => { m.rangos.push(rango); return { datos: m.datos[ruta] ?? null, cargando: false, error: m.errores[ruta] ?? null, reintentar: ruta.endsWith("materia") ? m.retryMateria : m.retryProfesor }; } }));
import { CancelacionesIndicadores } from "@/components/indicadores/cancelaciones-indicadores";
let el: HTMLDivElement, root: Root;
const rango = { desde: "2026-05", hasta: "2026-10" };
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  m.errores = {}; m.rangos = []; m.retryMateria.mockClear(); m.retryProfesor.mockClear();
  m.datos = {
    "/api/indicadores/cancelaciones-por-materia": { items: [{ materia_id: "m", nombre: "Materia con nombre particularmente largo para verificar acceso completo", codigo: null, activa: false, clases_canceladas_centro: 2, inscripciones_canceladas_alumno: 3 }] },
    "/api/indicadores/cancelaciones-por-mes": { meses: [{ mes: "2026-05", clases_canceladas_centro: 2, inscripciones_canceladas_alumno: 3, reservas_vencidas: 4, bajas: 7 }], totales: { clases_canceladas_centro: 2, inscripciones_canceladas_alumno: 3, reservas_vencidas: 4, bajas: 7 }, tasas: { clases: { canceladas: 2, totales: 10, tasa: 20 }, inscripciones: { canceladas_alumno: 3, totales: 20, tasa: 15 } } },
  };
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(<CancelacionesIndicadores rango={rango} />)); }
describe("HU-H-10 tarjetas, unidades y tasas", () => {
  it("período común, cuatro series mensuales y dos por materia, tabla exacta y tasas separadas", async () => {
    await render(); expect(m.rangos).toEqual([rango, rango]);
    const cards = el.querySelectorAll('[role="region"]'); expect(cards).toHaveLength(4);
    for (const card of Array.from(cards).slice(0, 2)) await act(async () => (card.querySelector("button") as HTMLButtonElement).click());
    expect(cards[0].querySelectorAll("thead th")).toHaveLength(5); expect(cards[0].querySelector("tbody tr")!.textContent).toContain("2347");
    expect(cards[1].querySelectorAll("thead th")).toHaveLength(4); expect(cards[1].textContent).toContain("particularmente largo"); expect(cards[1].textContent).toContain("Inactiva"); expect(cards[1].textContent).not.toContain("Bajas");
    expect(cards[2].textContent).toContain("20 %"); expect(cards[2].textContent).toContain("2 de 10 clases"); expect(cards[3].textContent).toContain("15 %"); expect(cards[3].textContent).toContain("3 de 20 inscripciones");
  });
  it("sin datos mantiene null como raya, no cero ni NaN", async () => {
    m.datos["/api/indicadores/cancelaciones-por-mes"] = { meses: [], totales: { clases_canceladas_centro: 0, inscripciones_canceladas_alumno: 0, reservas_vencidas: 0, bajas: 0 }, tasas: { clases: { canceladas: 0, totales: 0, tasa: null }, inscripciones: { canceladas_alumno: 0, totales: 0, tasa: null } } };
    m.datos["/api/indicadores/cancelaciones-por-materia"] = { items: [] }; await render(); expect(el.querySelectorAll('[role="status"]')).toHaveLength(2); expect(el.textContent).not.toContain("NaN"); expect(el.querySelectorAll('[role="region"]')[2].textContent).toContain("—");
  });
  it("error de materia permite reintentar solo esa tarjeta y conserva tasas", async () => { m.errores["/api/indicadores/cancelaciones-por-materia"] = "Error temporal"; await render(); expect(el.querySelectorAll('[role="alert"]')).toHaveLength(1); await act(async () => (el.querySelector('[role="alert"] button') as HTMLButtonElement).click()); expect(m.retryMateria).toHaveBeenCalledOnce(); expect(m.retryProfesor).not.toHaveBeenCalled(); expect(el.textContent).toContain("20 %"); });
});
