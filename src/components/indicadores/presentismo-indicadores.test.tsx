// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ datos: {} as Record<string, unknown>, errores: {} as Record<string, string>, llamadas: [] as string[], retry: vi.fn() }));
vi.mock("@/components/indicadores/use-indicador", () => ({ useIndicador: (ruta: string) => { mocks.llamadas.push(ruta); const key = ruta.split("?")[0]; return { datos: mocks.datos[key] ?? null, error: mocks.errores[key] ?? null, cargando: false, reintentar: mocks.retry }; } }));
vi.mock("@/components/indicadores/grafico-indicador", () => ({ GraficoIndicador: ({ titulo, estado, series, datos }: { titulo: string; estado: string; series: { clave: string }[]; datos: unknown[] }) => <section data-estado={estado} data-series={series.map(s => s.clave).join(",")} data-items={datos.length}>{titulo}</section> }));
import { PresentismoIndicadores } from "@/components/indicadores/presentismo-indicadores";
let root: Root; let container: HTMLDivElement;
const rango = { desde: "2026-05", hasta: "2026-10" };
const resumen = { inscriptos: 4, presentes: 2, ausentes: 2, indice: 50 };
beforeEach(() => { mocks.llamadas = []; mocks.errores = {}; mocks.retry.mockClear(); mocks.datos = {
  "/api/indicadores/presentismo-por-mes": { meses: [{ mes: "2026-05", ...resumen }], resumen, clases_sin_control: 0 },
  "/api/indicadores/presentismo-por-materia": { items: [{ materia_id: "m", nombre: "Física", codigo: null, activa: true, ...resumen }], resumen, clases_sin_control: 0 },
  "/api/indicadores/alumnos-presentismo-bajo": { total: 11, por_pagina: 10, minimo_clases: 2, umbral: 75, pagina: 1, items: [{ alumno_id: "a", nombre_completo: "Díaz, Ana", materia_id: "m", materia: "Física", clases_dictadas: 4, ausencias: 2, porcentaje: 50 }] },
}; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(r = rango) { await act(async () => root.render(<PresentismoIndicadores rango={r} />)); }
describe("Pestaña de presentismo", () => {
  it("usa gráfico común con barras y línea, mantiene aviso cero y enlaza materia del historial", async () => { await render(); expect(container.querySelector('[data-series="inscriptos,presentes,indice"]')).not.toBeNull(); expect(container.textContent).toContain("0 clases dictadas sin control"); expect(container.querySelector('a[href="/alumnos/a?tab=historial&materia_id=m"]')).not.toBeNull(); expect(container.textContent).toContain("75 %"); });
  it("pagina de diez y vuelve a uno cuando cambia el período", async () => { await render(); const next = [...container.querySelectorAll("button")].find(b => b.textContent?.includes("Siguiente"))!; await act(async () => next.click()); expect(mocks.llamadas).toContain("/api/indicadores/alumnos-presentismo-bajo?pagina=2"); await render({ ...rango, desde: "2026-06" }); expect(mocks.llamadas.at(-1)).toBe("/api/indicadores/alumnos-presentismo-bajo?pagina=1"); });
  it("un gráfico con error conserva la otra consulta y la tabla", async () => { mocks.errores["/api/indicadores/presentismo-por-mes"] = "fallo"; await render(); expect(container.querySelectorAll('[data-estado="error"]')).toHaveLength(1); expect(container.querySelector('[data-estado="ok"]')).not.toBeNull(); expect(container.textContent).toContain("Díaz, Ana"); });
  it("el vacío de alumnos es local y conserva los gráficos", async () => { mocks.datos["/api/indicadores/alumnos-presentismo-bajo"] = { total: 0, items: [], umbral: 75, minimo_clases: 2 }; await render(); expect(container.textContent).toContain("No hay alumnos con presentismo bajo en el período."); expect(container.querySelectorAll('[data-estado="ok"]')).toHaveLength(2); });
});
