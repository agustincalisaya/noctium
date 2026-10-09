// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe,it,expect,vi } from "vitest";
import { GraficoIndicador } from "./grafico-indicador";
import { etiquetaMesCorta } from "./graficos-indicadores";
describe("GraficoIndicador",()=>{
 it("tabla preserva barras, índice nulo y ausentes; alterna visibilidad",async()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.stubGlobal("ResizeObserver",class {observe(){}unobserve(){}disconnect(){}});
  const el=document.createElement("div");document.body.append(el);const root=createRoot(el);
  await act(async()=>root.render(<GraficoIndicador id="prueba" titulo="Presentismo" total="2" leyendaFecha="Por fecha" datos={[{mes:"2026-01",inscriptos:2,presentes:1,indice:null,ausentes:1}]} series={[{clave:"inscriptos",etiqueta:"Inscriptos",unidad:"inscripciones",tipo:"barra",color:"var(--chart-1)"},{clave:"presentes",etiqueta:"Presentes",unidad:"presencias",tipo:"barra",color:"var(--chart-2)"},{clave:"indice",etiqueta:"Índice",unidad:"%",tipo:"linea",color:"var(--chart-3)",ejePorcentaje:true}]} diferenciaClave="ausentes" mensual estado="ok"/>));
  expect(el.querySelector("table")!.textContent).toContain("—");expect(el.querySelector("table")!.textContent).toContain("Ausentes");
  expect(el.querySelector("table")!.parentElement!.className).toContain("sr-only");await act(async()=>el.querySelector("button")!.click());expect(el.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");expect(el.querySelector("table")!.parentElement!.className).not.toContain("sr-only");
  act(()=>root.unmount());el.remove();vi.unstubAllGlobals();
 });
 it("eje escribe año solo primer mes y enero",()=>{expect(etiquetaMesCorta("2025-10",0)).toBe("Oct ’25");expect(etiquetaMesCorta("2025-11",1)).toBe("Nov");expect(etiquetaMesCorta("2026-01",3)).toBe("Ene ’26");});
});
