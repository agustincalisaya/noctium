// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe,it,expect,vi } from "vitest";
import { ajustarPeriodo, FiltroPeriodo } from "./filtro-periodo";
describe("ajustarPeriodo",()=>{
 it("ajusta hasta a un desde posterior",()=>expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"desde","2026-10")).toEqual({desde:"2026-10",hasta:"2026-10"}));
 it("ajusta desde a un hasta anterior",()=>expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"hasta","2025-10")).toEqual({desde:"2025-10",hasta:"2025-10"}));
 it("máximo inclusivo 24 meses en ambos extremos",()=>{expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"hasta","2028-01")).toEqual({desde:"2026-02",hasta:"2028-01"});expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"desde","2024-01")).toEqual({desde:"2024-01",hasta:"2025-12"});});
 it.each([["2026-10", "2024-11"], ["2027-01", "2025-02"]])("ambos selectores terminan en %s, sin meses futuros", async (actual, primero) => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div"); document.body.append(el); const root = createRoot(el);
  try {
   await act(async () => root.render(createElement(FiltroPeriodo, { rango: { desde: actual, hasta: actual }, mesActual: actual, onChange: vi.fn() })));
   for (const selector of el.querySelectorAll("select")) {
    const opciones = [...selector.options].map(o => o.value);
    expect(opciones).toHaveLength(24); expect(opciones[0]).toBe(primero); expect(opciones.at(-1)).toBe(actual);
    expect(opciones.every(mes => mes <= actual)).toBe(true);
   }
  } finally { await act(async () => root.unmount()); el.remove(); }
 });
});
