// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAutenticado, exito, fallo } = vi.hoisted(() => ({
  fetchAutenticado: vi.fn(), exito: vi.fn(), fallo: vi.fn(),
}));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));
vi.mock("sonner", () => ({ toast: { success: exito, error: fallo } }));

const { AsignarPrioridadDialog } = await import("./asignar-prioridad-dialog");
const respuesta = (status: number, data: unknown = null, error: unknown = null) => ({
  ok: status >= 200 && status < 300, status, json: async () => ({ data, error }),
});
let root: Root;
let container: HTMLDivElement;
const cerrar = vi.fn();
const cambio = vi.fn(async () => {});
const boton = (nombre: string) => [...document.querySelectorAll("button")].find((item) => item.textContent === nombre) as HTMLButtonElement;
const montar = async (prioridadActual: "NORMAL" | "ALTA" = "NORMAL") => act(async () => {
  root.render(<AsignarPrioridadDialog turnoId="turno-1" prioridadActual={prioridadActual} onCerrar={cerrar} onCambio={cambio} />);
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fetchAutenticado.mockResolvedValue(respuesta(200, { id: "turno-1", prioridad: "URGENTE" }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-C-10 Dialog del mockup, página 10", () => {
  it("muestra los tres niveles y precarga la prioridad vigente", async () => {
    await montar("ALTA");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect([...document.querySelectorAll<HTMLInputElement>('input[name="prioridad"]')].map((input) => [input.value, input.checked]))
      .toEqual([["NORMAL", false], ["ALTA", true], ["URGENTE", false]]);
    await act(async () => boton("Cancelar").click());
    expect(cerrar).toHaveBeenCalledOnce();
    expect(fetchAutenticado).not.toHaveBeenCalled();
  });

  it("guarda Urgente, informa éxito y recarga el detalle", async () => {
    await montar();
    await act(async () => document.querySelector<HTMLInputElement>('input[value="URGENTE"]')!.click());
    await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchAutenticado).toHaveBeenCalledWith("/api/turnos/turno-1/prioridad", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prioridad: "URGENTE" }), cache: "no-store",
    });
    expect(exito).toHaveBeenCalledExactlyOnceWith("Prioridad actualizada");
    expect(cerrar).toHaveBeenCalledOnce();
    expect(cambio).toHaveBeenCalledOnce();
  });

  it("muestra error y permite reintentar; ante Cancelado refresca las acciones", async () => {
    fetchAutenticado.mockResolvedValueOnce(respuesta(500, null, { message: "Error de red" }))
      .mockResolvedValueOnce(respuesta(409, null, { code: "TURNO_CANCELADO", message: "Turno cancelado" }));
    await montar();
    const enviar = async () => act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await enviar();
    expect(fallo).toHaveBeenCalledWith("Error de red");
    expect(cerrar).not.toHaveBeenCalled();
    expect(boton("Guardar").disabled).toBe(false);
    await enviar();
    expect(fallo).toHaveBeenCalledWith("Turno cancelado");
    expect(cambio).toHaveBeenCalledOnce();
  });
});
