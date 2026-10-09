// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ datos: {} as Record<string, unknown>, errores: {} as Record<string, string>, retryMateria: vi.fn(), retryProfesor: vi.fn(), rangos: [] as unknown[] }));
vi.mock("@/components/indicadores/use-indicador", () => ({ useIndicador: (ruta: string, rango: unknown) => { m.rangos.push(rango); return { datos: m.datos[ruta] ?? null, cargando: false, error: m.errores[ruta] ?? null, reintentar: ruta.endsWith("materia") ? m.retryMateria : m.retryProfesor }; } }));
import { ClasesIndicadores } from "@/components/indicadores/clases-indicadores";
let el: HTMLDivElement, root: Root;
const rango = { desde: "2026-05", hasta: "2026-10" };
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  m.errores = {}; m.rangos = []; m.retryMateria.mockClear(); m.retryProfesor.mockClear();
  m.datos = {
    "/api/indicadores/clases-por-materia": { total: 4, items: [{ materia_id: "m", nombre: "Materia con nombre particularmente largo para verificar acceso completo", codigo: null, activa: false, clases: 4 }, { materia_id: "z", nombre: "Cero", codigo: null, activa: true, clases: 0 }] },
    "/api/indicadores/clases-por-profesor": { total: { clases: 4, horas: 1.5 }, items: [{ profesor_id: "p", nombre: "García, Ana", activo: false, clases: 4, horas: 1.5 }, { profesor_id: "q", nombre: "García, Ana", activo: true, clases: 0, horas: 0 }] },
  };
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(<ClasesIndicadores rango={rango} />)); }
describe("HU-H-03 tarjetas y tablas", () => {
  it("ambas consultas reciben período común y las tablas conservan ceros, nombre completo, estado y horas", async () => {
    await render(); expect(m.rangos).toEqual([rango, rango]);
    const tarjetas = el.querySelectorAll('[role="region"]');
    for (const tarjeta of tarjetas) await act(async () => (tarjeta.querySelector("button") as HTMLButtonElement).click());
    expect(tarjetas[0].querySelectorAll("thead th")).toHaveLength(3); expect(tarjetas[0].textContent).toContain("particularmente largo"); expect(tarjetas[0].textContent).toContain("Inactiva"); expect(tarjetas[0].querySelectorAll("tbody tr")).toHaveLength(2);
    expect(tarjetas[1].querySelectorAll("thead th")).toHaveLength(4); expect(tarjetas[1].querySelectorAll("tbody tr")).toHaveLength(2); expect(tarjetas[1].textContent).toContain("1,5"); expect(tarjetas[1].textContent).toContain("Inactivo");
  });
  it("vacío usa mensaje contractual por tarjeta sin ocultar el otro indicador", async () => { m.datos["/api/indicadores/clases-por-materia"] = { total: 0, items: [] }; await render(); expect(el.textContent).toContain("No hay clases en el período seleccionado"); expect(el.textContent).toContain("4 clases · 1,5 h"); });
  it("error/reintento es independiente y preserva profesores", async () => { m.errores["/api/indicadores/clases-por-materia"] = "Error temporal"; await render(); expect(el.querySelectorAll('[role="alert"]')).toHaveLength(1); await act(async () => (el.querySelector('[role="alert"] button') as HTMLButtonElement).click()); expect(m.retryMateria).toHaveBeenCalledOnce(); expect(m.retryProfesor).not.toHaveBeenCalled(); expect(el.textContent).toContain("García, Ana"); });
});
