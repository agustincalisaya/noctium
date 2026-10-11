// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ guardar: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/server/materias/actions", () => ({ cambiarTarifaMateria: m.guardar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.toast } }));
import { CambiarTarifaDialog } from "./cambiar-tarifa-dialog";
let root: Root;
let container: HTMLDivElement;
const boton = (nombre: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === nombre)!;
const click = async (nombre: string) => act(async () => boton(nombre).click());
const monto = async (valor: string) => act(async () => {
  const input = document.querySelector("input")!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const montar = async (tarifaActual: number | null = 12000) => {
  await act(async () => root.render(<CambiarTarifaDialog id="m" nombre="Física I" tarifaActual={tarifaActual} />));
  await click("Cambiar tarifa");
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); m.guardar.mockResolvedValue({ data: { id: "m", tarifa_hora: 15000, tarifa_anterior: 12000 }, error: null });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("precarga tarifa y muestra importe igual junto al campo sin enviar", async () => {
  await montar(); expect(document.querySelector("input")!.value).toBe("12000");
  await click("Guardar tarifa");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("La tarifa es la misma que la actual");
  expect(m.guardar).not.toHaveBeenCalled();
});
it("cero se rechaza junto al campo", async () => {
  await montar(); await monto("0"); await click("Guardar tarifa");
  expect(document.querySelector("input")!.getAttribute("aria-invalid")).toBe("true");
  expect(m.guardar).not.toHaveBeenCalled();
});
it("confirma valores concretos; Volver conserva el importe y solo confirmar guarda", async () => {
  await montar(); await monto("15000"); await click("Guardar tarifa");
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("de $ 12.000 a $ 15.000 por hora");
  expect(m.guardar).not.toHaveBeenCalled(); await click("Volver");
  expect(document.querySelector("input")!.value).toBe("15000"); await click("Guardar tarifa"); await click("Guardar tarifa");
  expect(m.guardar).toHaveBeenCalledTimes(1); expect(m.guardar).toHaveBeenCalledWith("m", { tarifa_hora: 15000, tarifa_actual: 12000 });
  expect(m.toast).toHaveBeenCalledWith("Tarifa actualizada correctamente"); expect(m.refresh).toHaveBeenCalled();
});
it("primera tarifa se confirma sin anterior $0", async () => {
  await montar(null); await monto("15000"); await click("Guardar tarifa");
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("definir la tarifa de Física I en $ 15.000");
  expect(document.querySelector('[role="alertdialog"]')?.textContent).not.toContain("$ 0");
});
it("conflicto bloquea reintento y ofrece recargar", async () => {
  m.guardar.mockResolvedValue({ data: null, error: { code: "CONFLICTO_EDICION_CONCURRENTE", message: "Tarifa modificada" } });
  await montar(); await monto("15000"); await click("Guardar tarifa"); await click("Guardar tarifa");
  expect(boton("Guardar tarifa").disabled).toBe(true);
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Tarifa modificada");
  await click("Recargar tarifa actual"); expect(m.refresh).toHaveBeenCalled(); expect(m.toast).not.toHaveBeenCalled();
});
