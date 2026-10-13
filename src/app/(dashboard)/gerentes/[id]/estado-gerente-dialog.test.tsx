// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Diálogo de baja y reactivación de la ficha del gerente (HU-G-05, figuras
// 97 y 98). Las Server Actions, el router y el toast están simulados.

const m = vi.hoisted(() => ({ desactivar: vi.fn(), reactivar: vi.fn(), refresh: vi.fn(), exito: vi.fn() }));
vi.mock("@/server/gerentes/actions", () => ({ desactivarGerente: m.desactivar, reactivarGerente: m.reactivar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

import { EstadoGerenteDialog, type GerenteParaEstado } from "./estado-gerente-dialog";

const ACTIVO: GerenteParaEstado = {
  id: "ckficha", nombre: "Andrés", apellido: "Molina", activo: true, version: 3,
  tieneCuenta: true, esUltimoGerenteActivo: false, motivoObligatorio: false,
};
const TITULO_BAJA = "¿Estás seguro de que querés desactivar a Andrés Molina? No podrá ingresar al sistema.";
const ULTIMO_ACTIVO = "Debe quedar al menos un gerente activo";

let root: Root, container: HTMLDivElement;
const boton = (nombre: string, dentro: ParentNode = document) =>
  [...dentro.querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement | undefined;
const click = async (e: HTMLElement) => act(async () => e.click());
const confirmacion = () => document.querySelector('[role="alertdialog"]');
const aviso = () => document.querySelector('[role="dialog"]');
const montar = (gerente: Partial<GerenteParaEstado> = {}) =>
  act(async () => root.render(<EstadoGerenteDialog gerente={{ ...ACTIVO, ...gerente }} />));
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

describe("baja (figura 98)", () => {
  it("botón de contorno destructivo; abre la confirmación con el título y el detalle del prototipo, sin leyenda irreversible", async () => {
    await montar();
    expect(boton("Desactivar")!.className).toContain("text-destructive");
    expect(boton("Reactivar")).toBeUndefined();
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
    expect(document.querySelector("#ayuda-motivo-gerente span")!.textContent).toBe("Opcional");
    expect(confirmacion()!.textContent).toContain("0 / 300");
    expect(document.querySelector("textarea")!.maxLength).toBe(300);
    expect(confirmarBaja().disabled).toBe(false);
    await escribirMotivo("Renuncia");
    expect(confirmacion()!.textContent).toContain("8 / 300");
  });

  it("motivo obligatorio: la ayuda propia y confirmar deshabilitado hasta escribirlo", async () => {
    await montar({ motivoObligatorio: true });
    await click(boton("Desactivar")!);
    expect(document.querySelector("#ayuda-motivo-gerente span")!.textContent).toBe("Obligatorio: tiene operaciones registradas");
    expect(document.querySelector("textarea")!.required).toBe(true);
    expect(confirmarBaja().disabled).toBe(true);
    await escribirMotivo("   ");
    expect(confirmarBaja().disabled).toBe(true);
    await escribirMotivo("Dejó el centro");
    expect(confirmarBaja().disabled).toBe(false);
  });

  it("éxito: envía motivo y version, toast «Gerente desactivado correctamente» y refresco", async () => {
    await montar();
    await click(boton("Desactivar")!);
    await escribirMotivo("Renuncia");
    await click(confirmarBaja());
    expect(m.desactivar).toHaveBeenCalledWith("ckficha", { motivo: "Renuncia", version: 3 });
    expect(m.exito).toHaveBeenCalledWith("Gerente desactivado correctamente");
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
    ["último gerente activo (cambió después de cargar la ficha)", "ULTIMO_GERENTE_ACTIVO", ULTIMO_ACTIVO],
    ["la propia ficha (422)", "NO_PUEDE_DESACTIVARSE_A_SI_MISMO", "No podés desactivarte a vos mismo."],
    ["ya inactivo", "GERENTE_YA_INACTIVO", "El gerente ya está inactivo."],
    ["conflicto de versión", "CONFLICTO_EDICION_CONCURRENTE", "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales."],
    ["motivo requerido", "MOTIVO_REQUERIDO", "Ingresá el motivo de la baja: el gerente registró operaciones."],
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
      error: { code: "VALIDATION_ERROR", message: "Los datos del gerente no son válidos.", detalles: { motivo: ["El motivo admite hasta 300 caracteres."] } },
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

describe("último gerente activo (aviso informativo)", () => {
  it("«Desactivar» abre el aviso y no la confirmación; «Cerrar» lo cierra sin llamar al servidor", async () => {
    await montar({ esUltimoGerenteActivo: true, motivoObligatorio: true });
    await click(boton("Desactivar")!);
    expect(confirmacion()).toBeNull();
    const dialogo = aviso()!;
    expect(dialogo.textContent).toContain("No se puede desactivar al gerente");
    expect(dialogo.textContent).toContain(ULTIMO_ACTIVO);
    expect(dialogo.querySelector("textarea")).toBeNull();
    await click(boton("Cerrar", dialogo)!);
    expect(aviso()).toBeNull();
    expect(m.desactivar).not.toHaveBeenCalled();
    expect(m.exito).not.toHaveBeenCalled();
  });
});

describe("reactivación", () => {
  it("«Reactivar» con su título y aviso de sesiones, sin motivo; éxito con toast y refresco", async () => {
    await montar({ activo: false, version: 4, esUltimoGerenteActivo: true });
    expect(boton("Desactivar")).toBeUndefined();
    expect(boton("Reactivar")!.className).not.toContain("text-destructive");
    await click(boton("Reactivar")!);
    const dialogo = confirmacion()!;
    expect(dialogo.textContent).toContain("¿Estás seguro de que querés reactivar a Andrés Molina?");
    expect(dialogo.textContent).toContain(
      "Su cuenta vuelve a quedar activa. Las sesiones cerradas en la baja no se restauran: tiene que iniciar sesión de nuevo.",
    );
    expect(dialogo.querySelector("textarea")).toBeNull();
    await click(boton("Reactivar", dialogo)!);
    expect(m.reactivar).toHaveBeenCalledWith("ckficha", { version: 4 });
    expect(m.desactivar).not.toHaveBeenCalled();
    expect(m.exito).toHaveBeenCalledWith("Gerente reactivado correctamente");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("sin cuenta vinculada: el detalle de la reactivación lo dice", async () => {
    await montar({ activo: false, tieneCuenta: false });
    await click(boton("Reactivar")!);
    expect(confirmacion()!.textContent).toContain("Vuelve a figurar como activo. No tiene una cuenta de acceso vinculada.");
  });

  it("conflicto o ya activo: dentro del modal; al cerrar se refresca", async () => {
    m.reactivar.mockResolvedValue({ data: null, error: { code: "GERENTE_YA_ACTIVO", message: "El gerente ya está activo." } });
    await montar({ activo: false });
    await click(boton("Reactivar")!);
    await click(boton("Reactivar", confirmacion()!)!);
    expect(confirmacion()!.textContent).toContain("El gerente ya está activo.");
    await click(boton("Volver", confirmacion()!)!);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
