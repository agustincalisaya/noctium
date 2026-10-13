// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Diálogo de baja y reactivación de la ficha del integrante (HU-F-05,
// figuras 93 y 94). Las Server Actions, el router y el toast están simulados.

const m = vi.hoisted(() => ({ desactivar: vi.fn(), reactivar: vi.fn(), refresh: vi.fn(), exito: vi.fn() }));
vi.mock("@/server/personal/actions", () => ({ desactivarIntegrante: m.desactivar, reactivarIntegrante: m.reactivar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

import { EstadoIntegranteDialog, type IntegranteParaEstado } from "./estado-integrante-dialog";

const ACTIVO: IntegranteParaEstado = {
  id: "ckficha", nombre: "Julián", apellido: "Ferreyra", activo: true, version: 3,
  tieneCuenta: true, cajaAbierta: false, motivoObligatorio: false,
};
const TITULO_BAJA = "¿Estás seguro de que querés desactivar a Julián Ferreyra? No podrá ingresar al sistema.";
const CAJA_ABIERTA = "El integrante tiene la caja abierta. Tiene que cerrarla (o hacé un cierre por ausencia) antes de desactivarlo.";

let root: Root, container: HTMLDivElement;
const boton = (nombre: string, dentro: ParentNode = document) =>
  [...dentro.querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement | undefined;
const click = async (e: HTMLElement) => act(async () => e.click());
const confirmacion = () => document.querySelector('[role="alertdialog"]');
const aviso = () => document.querySelector('[role="dialog"]');
const montar = (integrante: Partial<IntegranteParaEstado> = {}) =>
  act(async () => root.render(<EstadoIntegranteDialog integrante={{ ...ACTIVO, ...integrante }} />));
async function escribirMotivo(valor: string) {
  const area = document.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(area, valor);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const confirmarBaja = () => boton("Desactivar", confirmacion()!)!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  m.desactivar.mockResolvedValue({ data: { id: "ckficha", activo: false, version: 4 }, error: null });
  m.reactivar.mockResolvedValue({ data: { id: "ckficha", activo: true, version: 5 }, error: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("baja (figura 94)", () => {
  it("abre la confirmación con el título y el detalle del prototipo, sin leyenda irreversible", async () => {
    await montar();
    await click(boton("Desactivar")!);
    const dialogo = confirmacion()!;
    expect(dialogo.textContent).toContain(TITULO_BAJA);
    expect(dialogo.textContent).toContain(
      "Las operaciones que registró se conservan con su nombre. Su cuenta pasa a inactiva y se cierran todas sus sesiones.",
    );
    expect(dialogo.textContent).not.toContain("Esta acción no se puede deshacer.");
    expect(dialogo.textContent).toContain("Motivo de la baja");
    expect(boton("Volver", dialogo)).toBeDefined();
    expect(confirmarBaja().className).toContain("bg-destructive");
  });

  it("motivo opcional: «Opcional», contador, tope de 300 y confirmar habilitado vacío", async () => {
    await montar();
    await click(boton("Desactivar")!);
    expect(confirmacion()!.textContent).toContain("Opcional");
    expect(confirmacion()!.textContent).toContain("0 / 300");
    expect(document.querySelector("textarea")!.maxLength).toBe(300);
    expect(confirmarBaja().disabled).toBe(false);
    await escribirMotivo("Renuncia");
    expect(confirmacion()!.textContent).toContain("8 / 300");
  });

  it("motivo obligatorio: la ayuda del prototipo y confirmar deshabilitado hasta escribirlo", async () => {
    await montar({ motivoObligatorio: true });
    await click(boton("Desactivar")!);
    expect(document.querySelector("#ayuda-motivo-integrante span")!.textContent).toBe("Obligatorio: tiene clases, pagos u operaciones registradas");
    expect(confirmarBaja().disabled).toBe(true);
    await escribirMotivo("   ");
    expect(confirmarBaja().disabled).toBe(true);
    await escribirMotivo("Dejó el centro");
    expect(confirmarBaja().disabled).toBe(false);
  });

  it("éxito: envía motivo y version, toast «Integrante desactivado correctamente» y refresco", async () => {
    await montar();
    await click(boton("Desactivar")!);
    await escribirMotivo("Renuncia");
    await click(confirmarBaja());
    expect(m.desactivar).toHaveBeenCalledWith("ckficha", { motivo: "Renuncia", version: 3 });
    expect(m.exito).toHaveBeenCalledWith("Integrante desactivado correctamente");
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(confirmacion()).toBeNull();
  });

  it("sin cuenta vinculada: el detalle lo dice", async () => {
    await montar({ tieneCuenta: false });
    await click(boton("Desactivar")!);
    expect(confirmacion()!.textContent).toContain(
      "Las operaciones que registró se conservan con su nombre. No tiene una cuenta de acceso vinculada.",
    );
  });

  it.each([
    ["CAJA_ABIERTA (la caja se abrió después de cargar la ficha)", "CAJA_ABIERTA", CAJA_ABIERTA],
    ["conflicto de versión", "CONFLICTO_EDICION_CONCURRENTE", "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales."],
    ["motivo requerido", "MOTIVO_REQUERIDO", "Ingresá el motivo de la baja: el integrante registró operaciones."],
  ])("rechazo del servidor (%s): dentro del modal, sin toast; al cerrar se refresca la ficha", async (_caso, code, message) => {
    m.desactivar.mockResolvedValue({ data: null, error: { code, message } });
    await montar();
    await click(boton("Desactivar")!);
    await click(confirmarBaja());
    expect(confirmacion()!.querySelector('[role="alert"]')!.textContent).toContain(message);
    expect(m.exito).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
    await click(boton("Volver", confirmacion()!)!);
    expect(confirmacion()).toBeNull();
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("error de validación del motivo: su mensaje dentro del modal, sin refrescar al cerrar", async () => {
    m.desactivar.mockResolvedValue({
      data: null,
      error: { code: "VALIDATION_ERROR", message: "Los datos del integrante no son válidos.", detalles: { motivo: ["El motivo admite hasta 300 caracteres."] } },
    });
    await montar();
    await click(boton("Desactivar")!);
    await click(confirmarBaja());
    expect(confirmacion()!.querySelector('[role="alert"]')!.textContent).toContain("El motivo admite hasta 300 caracteres.");
    await click(boton("Volver", confirmacion()!)!);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("falla de comunicación: el mensaje central dentro del modal", async () => {
    m.desactivar.mockRejectedValue(new Error("fetch failed"));
    await montar();
    await click(boton("Desactivar")!);
    await click(confirmarBaja());
    expect(confirmacion()!.querySelector('[role="alert"]')!.textContent).toContain("No se pudo conectar. Intentá nuevamente");
  });
});

describe("caja abierta (aviso informativo)", () => {
  it("«Desactivar» abre el aviso y no la confirmación; «Cerrar» lo cierra sin llamar al servidor", async () => {
    await montar({ cajaAbierta: true, motivoObligatorio: true });
    await click(boton("Desactivar")!);
    expect(confirmacion()).toBeNull();
    const dialogo = aviso()!;
    expect(dialogo.textContent).toContain("No se puede desactivar al integrante");
    expect(dialogo.textContent).toContain(CAJA_ABIERTA);
    expect(dialogo.querySelector("textarea")).toBeNull();
    // HU-I-12: enlace a «Cierres de caja», donde el gerente hace el cierre por ausencia.
    const enlace = [...dialogo.querySelectorAll("a")].find((e) => e.textContent === "Ir a Cierres de caja");
    expect(enlace?.getAttribute("href")).toBe("/cajas");
    await click(boton("Cerrar", dialogo)!);
    expect(aviso()).toBeNull();
    expect(m.desactivar).not.toHaveBeenCalled();
  });
});

describe("reactivación", () => {
  it("«Reactivar» con su título y aviso de sesiones, sin motivo; éxito con toast y refresco", async () => {
    await montar({ activo: false, version: 4, cajaAbierta: true });
    expect(boton("Desactivar")).toBeUndefined();
    await click(boton("Reactivar")!);
    const dialogo = confirmacion()!;
    expect(dialogo.textContent).toContain("¿Estás seguro de que querés reactivar a Julián Ferreyra?");
    expect(dialogo.textContent).toContain(
      "Su cuenta vuelve a quedar activa. Las sesiones cerradas en la baja no se restauran: tiene que iniciar sesión de nuevo.",
    );
    expect(dialogo.querySelector("textarea")).toBeNull();
    await click(boton("Reactivar", dialogo)!);
    expect(m.reactivar).toHaveBeenCalledWith("ckficha", { version: 4 });
    expect(m.exito).toHaveBeenCalledWith("Integrante reactivado correctamente");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("conflicto o ya activo: dentro del modal; al cerrar se refresca", async () => {
    m.reactivar.mockResolvedValue({ data: null, error: { code: "INTEGRANTE_YA_ACTIVO", message: "El integrante ya está activo." } });
    await montar({ activo: false });
    await click(boton("Reactivar")!);
    await click(boton("Reactivar", confirmacion()!)!);
    expect(confirmacion()!.textContent).toContain("El integrante ya está activo.");
    await click(boton("Volver", confirmacion()!)!);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
