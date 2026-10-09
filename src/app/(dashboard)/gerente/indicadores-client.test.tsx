// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { IndicadoresClient } from "./indicadores-client";
vi.mock("@/components/indicadores/clases-indicadores",()=>({ClasesIndicadores:()=>null}));
vi.mock("@/components/indicadores/presentismo-panel",()=>({PanelPresentismo:()=>null}));
let container:HTMLDivElement;let root:Root;let fetchMock:ReturnType<typeof vi.fn>;
const reply=(data:unknown,ok=true)=>({ok,json:async()=>({data,error:ok?null:{message:"fallo"}})}) as Response;
beforeEach(()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.stubGlobal("ResizeObserver",class {observe(){}disconnect(){}unobserve(){}});
  fetchMock=vi.fn(async (url:string)=>reply(url.includes("resumen")?{ocupacion_promedio:0,turnos:2}:url.includes("ingresos")?[{mes:"2026-10",total:3800000}]:[{mes:"2026-10",ocupacion_promedio:0}]));
  vi.stubGlobal("fetch",fetchMock);container=document.createElement("div");document.body.append(container);root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.useRealTimers();});
async function render(){await act(async()=>root.render(<IndicadoresClient/>));}
async function click(el:Element){await act(async()=>{(el as HTMLElement).click();});}
async function change(id:string,value:string){await act(async()=>{const el=container.querySelector<HTMLSelectElement>(id)!;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")!.set!.call(el,value);el.dispatchEvent(new Event("change",{bubbles:true}));});}
describe("Panel HU-H-06",()=>{
 it("pide tres contratos con rango común y ofrece meses futuros",async()=>{await render();expect(fetchMock.mock.calls).toHaveLength(3);expect(fetchMock.mock.calls.every(([url])=>url.includes("desde=2026-05&hasta=2026-10"))).toBe(true);expect(container.querySelector("select")!.children).toHaveLength(27);expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);});
 it("conserva período y difiere pedidos al cambiar de pestaña",async()=>{await render();await change("#indicadores-desde","2026-09");await click(container.querySelectorAll('[role="tab"]')[1]!);const n=fetchMock.mock.calls.length;expect(container.querySelector<HTMLSelectElement>("#indicadores-desde")!.value).toBe("2026-09");expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(0);await click(container.querySelectorAll('[role="tab"]')[0]!);expect(fetchMock.mock.calls.length).toBe(n+3);});
 it("ocupa cero con clases es dato válido; tabla muestra mismos valores",async()=>{await render();const occupancy=container.querySelector('[aria-labelledby="indicador-ocupacion-titulo"]')!;expect(occupancy.textContent).toContain("0,0%");expect(occupancy.textContent).not.toContain("No hay datos");const button=occupancy.querySelector("button")!;await click(button);expect(button.getAttribute("aria-pressed")).toBe("true");expect(occupancy.querySelector("table")!.textContent).toContain("0,0%");});
 it("error independiente y reintento no consulta ocupación",async()=>{fetchMock.mockImplementation(async(url:string)=>url.includes("ingresos")?reply(null,false):reply(url.includes("resumen")?{ocupacion_promedio:50,turnos:2}:[{mes:"2026-10",ocupacion_promedio:50}]));await render();expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);expect(container.textContent).toContain("50,0%");fetchMock.mockClear();await click(container.querySelector('[role="alert"] button')!);expect(fetchMock.mock.calls).toHaveLength(1);expect(fetchMock.mock.calls[0]![0]).toContain("ingresos");});
 it("vacío independiente preserva ocupación",async()=>{fetchMock.mockImplementation(async(url:string)=>reply(url.includes("resumen")?{ocupacion_promedio:10,turnos:2}:url.includes("ingresos")?[{mes:"2026-10",total:0}]:[{mes:"2026-10",ocupacion_promedio:10}]));await render();expect(container.textContent).toContain("No hay datos para el período seleccionado");expect(container.textContent).toContain("10,0%");});
 it("ajusta automáticamente el otro extremo y avisa",async()=>{await render();await change("#indicadores-desde","2027-01");expect(container.querySelector<HTMLSelectElement>("#indicadores-hasta")!.value).toBe("2027-01");expect(container.textContent).toContain("El período máximo es de 24 meses.");});
 it("descarta respuesta de un período anterior aunque fetch ignore aborto",async()=>{let resolver:(r:Response)=>void=()=>{};fetchMock.mockImplementation((url:string)=>url.includes("ingresos")&&url.includes("desde=2026-05")?new Promise<Response>(r=>{resolver=r;}):Promise.resolve(reply(url.includes("resumen")?{ocupacion_promedio:10,turnos:2}:url.includes("ingresos")?[{mes:"2026-09",total:200}]:[{mes:"2026-09",ocupacion_promedio:10}])));await render();await change("#indicadores-desde","2026-09");await act(async()=>resolver(reply([{mes:"2026-10",total:9999999}])));expect(container.textContent).toContain("200,00");expect(container.textContent).not.toContain("9.999.999");});
});
