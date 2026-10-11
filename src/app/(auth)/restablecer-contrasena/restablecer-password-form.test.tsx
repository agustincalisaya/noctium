// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-A-05 (spec_modulo_A.md §2.7.3 y §2.7.6, figura 90, DESIGN.md §6.4):
// contraseña nueva con el enlace. La Server Action y el diálogo de HU-C-25
// están simulados, como en cambiar-password-form.test.tsx: el diálogo
// simulado conserva el contrato de onConfirmar (un rechazo se muestra
// adentro, un éxito lo cierra).

const m = vi.hoisted(() => ({
  accion: vi.fn(),
  fetch: vi.fn(),
  errorDialogo: { actual: "" },
}));
vi.mock("@/server/sesion/actions", () => ({ restablecerPassword: m.accion }));
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

const { RestablecerPasswordForm } = await import("./restablecer-password-form");

let contenedor: HTMLDivElement;
let root: Root;
const TOKEN = "t".repeat(43);
const NUEVA = "NuevaClave1";
const ubicacionOriginal = window.location;

const campo = (nombre: string) => contenedor.querySelector<HTMLInputElement>(`[name="${nombre}"]`)!;
const alertas = () => [...contenedor.querySelectorAll('[role="alert"]')].map((n) => n.textContent);

async function montar() {
  await act(async () => root.render(<RestablecerPasswordForm token={TOKEN} longitudMinima={8} />));
}
async function enviar(valores: Record<string, string> = { password_nueva: NUEVA, confirmacion: NUEVA }) {
  for (const [nombre, valor] of Object.entries(valores)) campo(nombre).value = valor;
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
  vi.clearAllMocks();
  m.errorDialogo.actual = "";
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  m.accion.mockResolvedValue({ status: "exito" });
  m.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { revocado: true }, error: null })));
  vi.stubGlobal("fetch", m.fetch);
  Object.defineProperty(window, "location", { configurable: true, value: { href: "http://localhost/restablecer-contrasena" } });
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, value: ubicacionOriginal });
});

describe("RestablecerPasswordForm", () => {
  it("figura 90: título, aviso de «anterior», ayuda de la política real y «Guardar contraseña»", async () => {
    await montar();
    expect(contenedor.querySelector("h1")!.textContent).toBe("Definí una contraseña nueva");
    expect(contenedor.textContent).toContain("La contraseña nueva no puede ser igual a la anterior.");
    expect(contenedor.querySelector("#password_nueva-ayuda")!.textContent).toBe(
      "Al menos 8 caracteres, con una mayúscula, una minúscula y un número.",
    );
    expect(contenedor.querySelector('label[for="password_nueva"]')!.textContent).toContain("Contraseña nueva");
    expect(contenedor.querySelector('label[for="confirmacion"]')!.textContent).toContain("Confirmación");
    expect(contenedor.querySelector('button[type="submit"]')!.textContent).toBe("Guardar contraseña");
    expect(campo("token").value).toBe(TOKEN);
  });

  it("política o confirmación distinta: errores junto al campo, foco y sin abrir la confirmación", async () => {
    await montar();
    await enviar({ password_nueva: "corta", confirmacion: "otra" });
    expect(alertas()).toHaveLength(2);
    expect(campo("password_nueva").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(campo("password_nueva"));
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(m.accion).not.toHaveBeenCalled();
  });

  it("abre la confirmación de HU-C-25 con el verbo de la acción", async () => {
    await montar();
    await enviar();
    expect(contenedor.querySelector("[data-dialogo] p")!.textContent).toBe("¿Estás seguro de que querés cambiar tu contraseña?");
    expect(contenedor.querySelector("[data-confirmar]")!.textContent).toBe("Cambiar contraseña");
    expect(m.accion).not.toHaveBeenCalled();
  });

  it("éxito: manda el token y la contraseña, cierra la sesión y va al login con el aviso", async () => {
    await montar();
    await enviar();
    await confirmar();
    const datos = m.accion.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(datos)).toEqual({ token: TOKEN, password_nueva: NUEVA, confirmacion: NUEVA });
    expect(m.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST", credentials: "include" });
    expect(window.location.href).toBe("/login?contrasena=actualizada");
  });

  it("éxito aunque el logout falle (sin red): igual va al login", async () => {
    m.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await montar();
    await enviar();
    await confirmar();
    expect(window.location.href).toBe("/login?contrasena=actualizada");
    expect(m.errorDialogo.actual).toBe("");
  });

  it("igual a la anterior (422): error junto al campo, el formulario sigue y no navega", async () => {
    m.accion.mockResolvedValue({ status: "error_validacion", errores: { password_nueva: ["La contraseña nueva no puede ser igual a la anterior"] } });
    await montar();
    await enviar();
    await confirmar();
    expect(alertas()).toEqual(["La contraseña nueva no puede ser igual a la anterior"]);
    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(m.fetch).not.toHaveBeenCalled();
    expect(window.location.href).toBe("http://localhost/restablecer-contrasena");
  });

  it("enlace inválido al guardar (410): la tarjeta pasa al mensaje y al acceso a pedir otro", async () => {
    m.accion.mockResolvedValue({ status: "enlace_invalido", mensaje: "El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?" });
    await montar();
    await enviar();
    await confirmar();
    expect(contenedor.querySelector("form")).toBeNull();
    expect(alertas()).toEqual(["El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?"]);
    expect(contenedor.querySelector('a[href="/recuperar-contrasena"]')!.textContent).toBe("Pedir un enlace nuevo");
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("error general: se muestra dentro del diálogo", async () => {
    m.accion.mockResolvedValue({ status: "error", mensaje: "Otra persona está modificando estos datos. Intentá de nuevo." });
    await montar();
    await enviar();
    await confirmar();
    expect(m.errorDialogo.actual).toBe("Otra persona está modificando estos datos. Intentá de nuevo.");
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("falla de transporte de la acción: mensaje de comunicación en el diálogo, sin detalles técnicos", async () => {
    m.accion.mockRejectedValue(new TypeError("Failed to fetch"));
    await montar();
    await enviar();
    await confirmar();
    expect(m.errorDialogo.actual).toBe("No se pudo conectar. Intentá nuevamente");
  });

  it("con la confirmación abierta, el botón de guardar queda deshabilitado", async () => {
    await montar();
    await enviar();
    expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });
});
