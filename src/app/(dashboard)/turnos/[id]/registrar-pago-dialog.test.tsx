// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-I-12 criterio 2 en el atajo «Registrar pago» del detalle de la clase:
// sin caja abierta, el rechazo ofrece «Abrir caja» y no se registra nada.
// El fetch y el toast están simulados.

const m = vi.hoisted(() => ({ fetch: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

import { RegistrarPagoDialog } from "./registrar-pago-dialog";

const OPCIONES = {
  alumnos: [{ id: "a1", nombre_completo: "Acosta, Sofía", dni: "40111222", forma_pago_preferida_id: "f1" }],
  formas_pago: [{ id: "f1", nombre: "Efectivo" }],
  preseleccionar_alumno_id: "a1",
};

let root: Root, container: HTMLDivElement;
const onRegistrado = vi.fn();
const respuesta = (cuerpo: unknown, ok = true) => ({ ok, status: ok ? 200 : 409, json: async () => cuerpo });

async function abrirYEnviar() {
  await act(async () => root.render(<RegistrarPagoDialog turnoId="t1" contexto="Física I" onRegistrado={onRegistrado} />));
  await act(async () => (document.querySelector("button") as HTMLButtonElement).click());
  const monto = document.querySelector('[role="dialog"] input[inputmode="decimal"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(monto, "12000"); monto.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => (document.querySelector('[role="dialog"] form') as HTMLFormElement).requestSubmit());
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-I-12: «Registrar pago» del detalle de la clase sin caja abierta", () => {
  it("CAJA_NO_ABIERTA muestra el mensaje con el enlace «Abrir caja» y no registra", async () => {
    m.fetch.mockImplementation(async (url: string) => url.startsWith("/api/pagos/opciones")
      ? respuesta({ data: OPCIONES, error: null })
      : respuesta({ data: null, error: { code: "CAJA_NO_ABIERTA", message: "No se puede registrar un cobro hasta que abras una caja." } }, false));
    await abrirYEnviar();
    const alerta = document.querySelector('[role="dialog"] [role="alert"]')!;
    expect(alerta.textContent).toContain("No se puede registrar un cobro hasta que abras una caja.");
    expect(alerta.querySelector('a[href="/caja"]')?.textContent).toBe("Abrir caja");
    expect(m.exito).not.toHaveBeenCalled();
    expect(onRegistrado).not.toHaveBeenCalled();
  });

  it("otro rechazo no ofrece «Abrir caja»", async () => {
    m.fetch.mockImplementation(async (url: string) => url.startsWith("/api/pagos/opciones")
      ? respuesta({ data: OPCIONES, error: null })
      : respuesta({ data: null, error: { code: "TURNO_NO_ADMITE_PAGO", message: "La clase no admite pagos." } }, false));
    await abrirYEnviar();
    expect(document.querySelector('[role="dialog"] [role="alert"]')!.textContent).toContain("La clase no admite pagos.");
    expect(document.querySelector('a[href="/caja"]')).toBeNull();
  });
});
