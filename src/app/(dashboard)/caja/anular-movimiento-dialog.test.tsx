// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MovimientoAnulable } from "./anular-movimiento-dialog";

// «Anular» un movimiento (HU-I-12-b criterio 3): motivo obligatorio y la
// confirmación irreversible de HU-C-25. El fetch, el router y el toast están simulados.

const m = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", async () => ({ fetchAutenticado: m.fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

import { AnularMovimientoDialog } from "./anular-movimiento-dialog";

let root: Root, container: HTMLDivElement;
const onCerrar = vi.fn();
const MOVIMIENTO: MovimientoAnulable = {
  tipo: "MOVIMIENTO", id: "mov1", momento: "2026-10-12T11:00:00-03:00", detalle: "Ingreso de cambio", movimiento: "INGRESO", monto: "1000.00", anulado: false,
};
const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const confirmacion = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const boton = (nombre: string, dentro: ParentNode | null) =>
  [...(dentro ?? document).querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement;
const click = (e: HTMLElement) => act(async () => e.click());
const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 300, status, json: async () => cuerpo });
async function escribirMotivo(valor: string) {
  const campo = dialogo()!.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-I-12-b Anular movimiento", () => {
  it("sin movimiento no muestra nada", async () => {
    await act(async () => root.render(<AnularMovimientoDialog movimiento={null} onCerrar={onCerrar} />));
    expect(dialogo()).toBeNull();
  });

  it.each(["", "   "])("motivo %j: error junto al campo y no deja confirmar", async (motivo) => {
    await act(async () => root.render(<AnularMovimientoDialog movimiento={MOVIMIENTO} onCerrar={onCerrar} />));
    expect(dialogo()!.textContent).toContain("Ingreso manual · Ingreso de cambio · $ 1.000");
    await escribirMotivo(motivo);
    await click(boton("Continuar", dialogo()));
    expect(document.getElementById("anular-movimiento-motivo-error")?.textContent).toBe("Ingresá el motivo.");
    expect(confirmacion()).toBeNull();
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("confirmación irreversible con una sola leyenda; anula, avisa con toast y refresca", async () => {
    m.fetch.mockResolvedValue(respuesta(201, { data: { id: "an1" }, error: null }));
    await act(async () => root.render(<AnularMovimientoDialog movimiento={MOVIMIENTO} onCerrar={onCerrar} />));
    await escribirMotivo("  Se cargó dos veces ");
    expect(dialogo()!.textContent).toContain("21 / 300");
    await click(boton("Continuar", dialogo()));
    const texto = confirmacion()!.textContent!;
    expect(texto).toContain("¿Estás seguro de que querés anular este movimiento?");
    expect(texto.split("Esta acción no se puede deshacer.").length - 1).toBe(1);
    await click(boton("Anular movimiento", confirmacion()));
    expect(m.fetch).toHaveBeenCalledWith("/api/cajas/mia/movimientos/mov1/anulacion", expect.objectContaining({
      method: "POST", body: JSON.stringify({ motivo: "Se cargó dos veces" }),
    }));
    expect(m.exito).toHaveBeenCalledWith("Movimiento anulado correctamente");
    expect(m.refresh).toHaveBeenCalled();
    expect(onCerrar).toHaveBeenCalled();
  });

  it.each([
    ["ANULACION_DEJA_EFECTIVO_NEGATIVO", "No se puede anular: la caja quedaría con efectivo negativo."],
    ["MOVIMIENTO_YA_ANULADO", "El movimiento ya estaba anulado."],
  ])("%s: el rechazo se ve dentro de la confirmación", async (code, message) => {
    m.fetch.mockResolvedValue(respuesta(409, { data: null, error: { code, message } }));
    await act(async () => root.render(<AnularMovimientoDialog movimiento={MOVIMIENTO} onCerrar={onCerrar} />));
    await escribirMotivo("Error");
    await click(boton("Continuar", dialogo()));
    await click(boton("Anular movimiento", confirmacion()));
    expect(confirmacion()!.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(m.exito).not.toHaveBeenCalled();
  });
});
