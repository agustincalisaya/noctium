// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// «Registrar movimiento» (HU-I-12-b criterio 3; foto `Registrar movimiento
// manual.png`): tipo, monto > 0 y concepto obligatorio, y la confirmación de
// HU-C-25. El fetch, el router y el toast están simulados.

const m = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", async () => ({ fetchAutenticado: m.fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

import { RegistrarMovimientoDialog } from "./registrar-movimiento-dialog";

let root: Root, container: HTMLDivElement;
const onCerrar = vi.fn();
const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const confirmacion = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const boton = (nombre: string, dentro: ParentNode | null) =>
  [...(dentro ?? document).querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement;
const click = (e: HTMLElement) => act(async () => e.click());
const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 300, status, json: async () => cuerpo });

async function cambiar(selector: string, valor: string) {
  const campo = dialogo()!.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const prototipo = Object.getPrototypeOf(campo);
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototipo, "value")!.set!.call(campo, valor);
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function completar({ tipo, monto, concepto }: { tipo?: string; monto: string; concepto: string }) {
  if (tipo) await cambiar("#movimiento-tipo", tipo);
  await cambiar("#movimiento-monto", monto);
  await cambiar("#movimiento-concepto", concepto);
  await click(boton("Continuar", dialogo()));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-I-12-b Registrar movimiento", () => {
  it("concepto vacío (solo espacios): error junto al campo y no deja confirmar", async () => {
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await completar({ monto: "1000", concepto: "   " });
    expect(document.getElementById("movimiento-concepto-error")?.textContent).toBe("Ingresá el concepto.");
    expect(confirmacion()).toBeNull();
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it.each(["", "0", "0.00", "-5", "10.555", "abc"])("monto inválido %j: error junto al campo y sin confirmación", async (monto) => {
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await completar({ monto, concepto: "Cambio" });
    expect(document.getElementById("movimiento-monto-error")?.textContent).toBe("Ingresá un monto mayor a 0, con hasta 2 decimales.");
    expect(confirmacion()).toBeNull();
  });

  it("muestra el contador del concepto (n / 200) y limita a 200", async () => {
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await cambiar("#movimiento-concepto", "Retiro para comprar insumos");
    expect(dialogo()!.textContent).toContain("27 / 200");
    expect(dialogo()!.querySelector("#movimiento-concepto")!.getAttribute("maxlength")).toBe("200");
  });

  it("egreso: confirma con tipo, monto y concepto; registra, avisa con toast y refresca", async () => {
    m.fetch.mockResolvedValue(respuesta(201, { data: { id: "mov1" }, error: null }));
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await completar({ tipo: "EGRESO", monto: "1000,5", concepto: "  Retiro para comprar insumos " });
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés registrar un egreso de $ 1.000,50?");
    expect(confirmacion()!.textContent).toContain("Retiro para comprar insumos");
    expect(confirmacion()!.textContent).not.toContain("Esta acción no se puede deshacer.");
    await click(boton("Registrar movimiento", confirmacion()));
    expect(m.fetch).toHaveBeenCalledWith("/api/cajas/mia/movimientos", expect.objectContaining({
      method: "POST", body: JSON.stringify({ tipo: "EGRESO", monto: "1000.5", concepto: "Retiro para comprar insumos" }),
    }));
    expect(m.exito).toHaveBeenCalledWith("Movimiento registrado correctamente");
    expect(m.refresh).toHaveBeenCalled();
    expect(onCerrar).toHaveBeenCalled();
  });

  it("ingreso por defecto: «un ingreso» en la confirmación", async () => {
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await completar({ monto: "500", concepto: "Ingreso de cambio" });
    expect(confirmacion()!.textContent).toContain("registrar un ingreso de $ 500?");
  });

  it("EGRESO_SUPERA_EFECTIVO: el rechazo se ve dentro de la confirmación, sin montos esperados; «Volver» conserva lo cargado", async () => {
    m.fetch.mockResolvedValue(respuesta(409, { data: null, error: { code: "EGRESO_SUPERA_EFECTIVO", message: "El egreso supera el efectivo de la caja." } }));
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await completar({ tipo: "EGRESO", monto: "999999", concepto: "Retiro" });
    await click(boton("Registrar movimiento", confirmacion()));
    expect(confirmacion()!.querySelector('[role="alert"]')?.textContent).toBe("El egreso supera el efectivo de la caja.");
    expect(m.exito).not.toHaveBeenCalled();
    await click(boton("Volver", confirmacion()));
    expect((dialogo()!.querySelector("#movimiento-monto") as HTMLInputElement).value).toBe("999999");
    expect((dialogo()!.querySelector("#movimiento-tipo") as HTMLSelectElement).value).toBe("EGRESO");
  });

  it("CAJA_NO_ABIERTA (la caja se cerró mientras tanto): muestra el texto de UI de movimientos", async () => {
    m.fetch.mockResolvedValue(respuesta(409, { data: null, error: { code: "CAJA_NO_ABIERTA", message: "No se puede registrar un cobro hasta que abras una caja." } }));
    await act(async () => root.render(<RegistrarMovimientoDialog abierto onCerrar={onCerrar} />));
    await completar({ monto: "10", concepto: "Cambio" });
    await click(boton("Registrar movimiento", confirmacion()));
    expect(confirmacion()!.querySelector('[role="alert"]')?.textContent).toBe("Tu caja se cerró. Recargá la pantalla para ver su estado.");
  });
});
