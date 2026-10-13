// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// «Abrir caja» (HU-I-12 criterio 1; foto `Abrir caja.png`): fondo ≥ 0 y la
// confirmación de HU-C-25. El fetch, el router y el toast están simulados.

const m = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", async () => ({ fetchOLanzar: m.fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

import { AbrirCajaDialog } from "./abrir-caja-dialog";

let root: Root, container: HTMLDivElement;
const onCerrar = vi.fn();
const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const confirmacion = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const boton = (nombre: string, dentro: ParentNode | null) =>
  [...(dentro ?? document).querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement;
const click = (e: HTMLElement) => act(async () => e.click());
async function escribir(valor: string) {
  const input = dialogo()!.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("HU-I-12 Abrir caja", () => {
  it.each(["", "-1", "10.555", "abc"])("fondo inválido %j: error junto al campo y sin confirmación", async (valor) => {
    await act(async () => root.render(<AbrirCajaDialog abierto onCerrar={onCerrar} />));
    await escribir(valor);
    await click(boton("Continuar", dialogo()));
    expect(dialogo()!.querySelector('[role="alert"]')?.textContent).toBe("Ingresá un monto igual o mayor a 0, con hasta 2 decimales.");
    expect(confirmacion()).toBeNull();
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("fondo 0: confirma con el monto, abre la caja y avisa con toast", async () => {
    m.fetch.mockResolvedValue({ id: "c1" });
    await act(async () => root.render(<AbrirCajaDialog abierto onCerrar={onCerrar} />));
    await escribir("0");
    await click(boton("Continuar", dialogo()));
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés abrir tu caja con un fondo inicial de $ 0?");
    await click(boton("Abrir caja", confirmacion()));
    expect(m.fetch).toHaveBeenCalledWith("/api/cajas", expect.objectContaining({ method: "POST", body: JSON.stringify({ fondo_inicial: "0" }) }));
    expect(m.exito).toHaveBeenCalledWith("Caja abierta correctamente");
    expect(m.refresh).toHaveBeenCalled();
    expect(onCerrar).toHaveBeenCalled();
  });

  it("rechazo del servidor (CAJA_YA_ABIERTA) dentro de la confirmación; «Volver» conserva el monto", async () => {
    m.fetch.mockRejectedValue(new Error("Ya tenés una caja abierta."));
    await act(async () => root.render(<AbrirCajaDialog abierto onCerrar={onCerrar} />));
    await escribir("5000");
    await click(boton("Continuar", dialogo()));
    expect(confirmacion()!.textContent).toContain("fondo inicial de $ 5.000");
    await click(boton("Abrir caja", confirmacion()));
    expect(confirmacion()!.querySelector('[role="alert"]')?.textContent).toBe("Ya tenés una caja abierta.");
    expect(m.exito).not.toHaveBeenCalled();
    await click(boton("Volver", confirmacion()));
    expect((dialogo()!.querySelector("input") as HTMLInputElement).value).toBe("5000");
  });
});
