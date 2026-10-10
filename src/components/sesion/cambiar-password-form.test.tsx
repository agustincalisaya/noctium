// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-A-06 (spec_modulo_A.md §2.6.6, DESIGN.md §6.4): formulario compartido de
// primer ingreso y «Mi cuenta». La Server Action y el diálogo de HU-C-25 están
// simulados; el diálogo simulado conserva el contrato de onConfirmar (un
// rechazo se muestra adentro, un éxito lo cierra).

const m = vi.hoisted(() => ({
  accion: vi.fn(),
  replace: vi.fn(),
  setDirty: vi.fn(),
  errorDialogo: { actual: "" },
}));
vi.mock("@/server/sesion/actions", () => ({ cambiarPasswordPropia: m.accion }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace, push: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty: m.setDirty }) }));
vi.mock("@/components/shared/confirmar-accion-dialog", async () => {
  const React = await import("react");
  return {
    ConfirmarAccionDialog: (p: { abierto: boolean; titulo: string; textoConfirmar: string; onConfirmar: () => Promise<void>; onCerrar: () => void }) =>
      p.abierto
        ? React.createElement(
            "div",
            { "data-dialogo": "" },
            React.createElement("p", null, p.titulo),
            React.createElement(
              "button",
              {
                type: "button",
                "data-confirmar": "",
                onClick: () =>
                  p.onConfirmar().then(p.onCerrar, (e: Error) => {
                    m.errorDialogo.actual = e.message;
                  }),
              },
              p.textoConfirmar,
            ),
          )
        : null,
  };
});

const { CambiarPasswordForm } = await import("@/components/sesion/cambiar-password-form");

let contenedor: HTMLDivElement;
let root: Root;
const NUEVA = "NuevaClave1";

async function montar(modo: "primerIngreso" | "miCuenta") {
  await act(async () => root.render(<CambiarPasswordForm modo={modo} longitudMinima={8} />));
}
const campo = (nombre: string) => contenedor.querySelector<HTMLInputElement>(`[name="${nombre}"]`);
function completar(valores: Record<string, string>) {
  for (const [nombre, valor] of Object.entries(valores)) campo(nombre)!.value = valor;
}
async function enviar() {
  await act(async () => {
    contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function confirmar() {
  await act(async () => {
    contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click();
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  m.errorDialogo.actual = "";
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});

describe("primer ingreso", () => {
  beforeEach(() => montar("primerIngreso"));

  it("no pide la contraseña actual y muestra la ayuda de la política real", () => {
    expect(campo("password_actual")).toBeNull();
    expect(contenedor.textContent).toContain("Al menos 8 caracteres, con una mayúscula, una minúscula y un número.");
    expect(contenedor.textContent).toContain("Guardar y seguir");
  });

  it("valida antes de confirmar: sin diálogo ni envío si la nueva no cumple la política", async () => {
    completar({ password_nueva: "corta", confirmacion: "corta" });
    await enviar();
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(m.accion).not.toHaveBeenCalled();
    expect(campo("password_nueva")!.getAttribute("aria-invalid")).toBe("true");
  });

  it("confirma con el texto de HU-C-25 y, al terminar, navega a /home con el banner", async () => {
    m.accion.mockResolvedValue({ status: "exito", sesion_conservada: true });
    completar({ password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    expect(contenedor.textContent).toContain("¿Estás seguro de que querés cambiar tu contraseña?");
    expect(contenedor.querySelector("[data-confirmar]")!.textContent).toBe("Cambiar contraseña");
    await confirmar();
    const enviado = m.accion.mock.calls[0]![1] as FormData;
    expect(enviado.get("password_nueva")).toBe(NUEVA);
    expect(enviado.has("password_actual")).toBe(false);
    expect(m.replace).toHaveBeenCalledWith("/home?contrasena=actualizada");
    expect(m.setDirty).toHaveBeenLastCalledWith(false);
  });

  it("un rechazo de campo cierra el diálogo y se muestra junto al campo", async () => {
    m.accion.mockResolvedValue({ status: "error_validacion", errores: { password_nueva: ["La contraseña nueva no puede ser tu DNI"] } });
    completar({ password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    await confirmar();
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(contenedor.textContent).toContain("La contraseña nueva no puede ser tu DNI");
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("un rechazo general se muestra dentro del diálogo", async () => {
    m.accion.mockResolvedValue({ status: "error", mensaje: "Demasiados intentos. Esperá unos minutos e intentá nuevamente" });
    completar({ password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    await confirmar();
    expect(m.errorDialogo.actual).toBe("Demasiados intentos. Esperá unos minutos e intentá nuevamente");
    expect(contenedor.querySelector("[data-dialogo]")).not.toBeNull();
  });

  it("reemisión fallida: cierra la sesión y lleva al login con el aviso de éxito", async () => {
    const fetchMock = vi.fn(async () => new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    const ubicacion = { href: "" };
    vi.stubGlobal("location", ubicacion);
    Object.defineProperty(window, "location", { value: ubicacion, configurable: true });
    m.accion.mockResolvedValue({ status: "exito", sesion_conservada: false });
    completar({ password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    await confirmar();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST", credentials: "include" });
    expect(ubicacion.href).toBe("/login?contrasena=actualizada");
    expect(m.replace).not.toHaveBeenCalled();
  });
});

describe("«Mi cuenta»", () => {
  beforeEach(() => montar("miCuenta"));

  it("pide la contraseña actual antes de confirmar", async () => {
    completar({ password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(contenedor.textContent).toContain("Ingresá tu contraseña actual");
  });

  it("confirma avisando el cierre de las otras sesiones y muestra el banner inline, sin navegar", async () => {
    m.accion.mockResolvedValue({ status: "exito", sesion_conservada: true });
    completar({ password_actual: "Actual123", password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    expect(contenedor.textContent).toContain(
      "¿Estás seguro de que querés cambiar tu contraseña? Se van a cerrar tus sesiones en otros dispositivos.",
    );
    await confirmar();
    expect((m.accion.mock.calls[0]![1] as FormData).get("password_actual")).toBe("Actual123");
    expect(contenedor.querySelector('[role="status"]')!.textContent).toBe("Tu contraseña se actualizó.");
    expect(campo("password_nueva")!.value).toBe("");
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("contraseña actual incorrecta: el error queda junto a ese campo", async () => {
    m.accion.mockResolvedValue({ status: "error_validacion", errores: { password_actual: ["La contraseña actual no es correcta"] } });
    completar({ password_actual: "Mala1234", password_nueva: NUEVA, confirmacion: NUEVA });
    await enviar();
    await confirmar();
    expect(campo("password_actual")!.getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("La contraseña actual no es correcta");
  });
});
