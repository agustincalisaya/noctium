// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-A-06 criterio 6 (spec_modulo_D.md §2.9.2 punto 7): en una ficha con
// cuenta, cambiar el email pide confirmación con el aviso de que cambia el
// usuario de ingreso. Sin cuenta, o sin cambio de email, se guarda como antes.

const m = vi.hoisted(() => ({ actualizar: vi.fn(), setDirty: vi.fn() }));
vi.mock("../../actions", () => ({ actualizarContactoProfesor: m.actualizar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty: m.setDirty }) }));
vi.mock("@/components/shared/confirmar-descarte-dialog", () => ({ ConfirmarDescarteDialog: () => null }));
vi.mock("@/components/shared/confirmar-accion-dialog", async () => {
  const React = await import("react");
  return {
    ConfirmarAccionDialog: (p: { abierto: boolean; titulo: string; detalle?: string; textoConfirmar: string; onConfirmar: () => Promise<void>; onCerrar: () => void }) =>
      p.abierto
        ? React.createElement(
            "div",
            { "data-dialogo": "" },
            React.createElement("p", null, p.titulo),
            React.createElement("p", null, p.detalle),
            React.createElement("button", { type: "button", "data-confirmar": "", onClick: () => p.onConfirmar().then(p.onCerrar) }, p.textoConfirmar),
          )
        : null,
  };
});

const { ContactoProfesorForm } = await import("./contacto-profesor-form");

const PROFESOR = "ckprofesor000000000000001";
const AVISO = "Cambiar el email también cambia el usuario con el que esta persona ingresa. Va a ingresar con el email nuevo la próxima vez.";
let contenedor: HTMLDivElement;
let root: Root;

async function montar(conCuenta: boolean) {
  await act(async () => {
    root.render(<ContactoProfesorForm profesorId={PROFESOR} telefonoActual="0387154123456" emailActual="ana@noctium.local" conCuenta={conCuenta} />);
  });
}
const campo = (nombre: string) => contenedor.querySelector<HTMLInputElement>(`[name="${nombre}"]`)!;
async function enviar() {
  await act(async () => {
    contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  m.actualizar.mockResolvedValue({ status: "exito", telefono: "0387154123456", email: "nuevo@noctium.local" });
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe("contacto de una ficha con cuenta", () => {
  beforeEach(() => montar(true));

  it("muestra el aviso junto al email", () => {
    expect(contenedor.textContent).toContain(AVISO);
  });

  it("email nuevo: pide confirmación con el aviso y recién al confirmar guarda", async () => {
    campo("email").value = "Nuevo@Noctium.local";
    await enviar();
    expect(m.actualizar).not.toHaveBeenCalled();
    const dialogo = contenedor.querySelector("[data-dialogo]")!;
    expect(dialogo.textContent).toContain("¿Estás seguro de que querés cambiar el email de ingreso a nuevo@noctium.local?");
    expect(dialogo.textContent).toContain(AVISO);
    expect(dialogo.querySelector("[data-confirmar]")!.textContent).toBe("Cambiar email");

    await act(async () => {
      contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click();
    });
    expect(m.actualizar).toHaveBeenCalledTimes(1);
    expect((m.actualizar.mock.calls[0]![1] as FormData).get("email")).toBe("Nuevo@Noctium.local");
  });

  it("mismo email (solo cambia el teléfono): guarda sin confirmación", async () => {
    campo("telefono").value = "0387154999999";
    await enviar();
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(m.actualizar).toHaveBeenCalledTimes(1);
  });

  it("vaciar el email: el servidor lo rechaza y el error queda junto al campo", async () => {
    m.actualizar.mockResolvedValue({
      status: "error_validacion",
      errores: { email: ["Ingresá el email: es el usuario con el que esta persona ingresa al sistema"] },
    });
    campo("email").value = "";
    await enviar();
    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("Ingresá el email: es el usuario con el que esta persona ingresa al sistema");
  });
});

describe("contacto de una ficha sin cuenta (Sprint 1 y 2)", () => {
  beforeEach(() => montar(false));

  it("sin aviso ni confirmación: guarda directo", async () => {
    expect(contenedor.textContent).not.toContain(AVISO);
    campo("email").value = "nuevo@noctium.local";
    await enviar();
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(m.actualizar).toHaveBeenCalledTimes(1);
  });
});
