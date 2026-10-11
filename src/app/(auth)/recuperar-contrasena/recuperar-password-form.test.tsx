// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-A-05 (spec_modulo_A.md §2.7.6, figuras 88 y 89, DESIGN.md §6.4): pedido
// del enlace. La Server Action está simulada.

const m = vi.hoisted(() => ({ accion: vi.fn() }));
vi.mock("@/server/sesion/actions", () => ({ solicitarRecuperacion: m.accion }));

const { RecuperarPasswordForm } = await import("./recuperar-password-form");

let contenedor: HTMLDivElement;
let root: Root;

const email = () => contenedor.querySelector<HTMLInputElement>('[name="email"]')!;
const boton = () => contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const alertas = () => [...contenedor.querySelectorAll('[role="alert"]')].map((n) => n.textContent);

async function montar() {
  await act(async () => root.render(<RecuperarPasswordForm />));
}
async function enviar(valor: string) {
  email().value = valor;
  await act(async () => {
    contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  m.accion.mockResolvedValue({ status: "enviada" });
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe("RecuperarPasswordForm", () => {
  it("figura 88: título, bajada, Email con su etiqueta, «Enviar enlace» y volver al login", async () => {
    await montar();
    expect(contenedor.querySelector("h1")!.textContent).toBe("¿Olvidaste tu contraseña?");
    expect(contenedor.textContent).toContain("Ingresá el email de tu cuenta y te enviamos un enlace para definir una contraseña nueva.");
    expect(contenedor.querySelector('label[for="email"]')!.textContent).toBe("Email");
    expect(boton().textContent).toBe("Enviar enlace");
    expect(contenedor.querySelector('a[href="/login"]')!.textContent).toBe("Volver a iniciar sesión");
  });

  it("email inválido: error junto al campo, foco en el campo y sin llamar a la acción", async () => {
    await montar();
    await enviar("ana@");
    expect(alertas()).toEqual(["Ingresá un email válido, por ejemplo nombre@dominio.com."]);
    expect(email().getAttribute("aria-invalid")).toBe("true");
    expect(email().getAttribute("aria-describedby")).toBe("email-error");
    expect(document.activeElement).toBe(email());
    expect(m.accion).not.toHaveBeenCalled();
  });

  it("figura 89: con la respuesta uniforme pasa a «Revisá tu email», con la nota de 30 minutos", async () => {
    await montar();
    await enviar("ana@noctium.local");
    expect(m.accion).toHaveBeenCalledTimes(1);
    expect((m.accion.mock.calls[0]![1] as FormData).get("email")).toBe("ana@noctium.local");
    expect(contenedor.querySelector("h1")!.textContent).toBe("Revisá tu email");
    expect(document.activeElement).toBe(contenedor.querySelector("h1"));
    expect(contenedor.querySelector('[role="status"]')!.textContent).toBe(
      "Si el email corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña",
    );
    expect(contenedor.textContent).toContain("El enlace es de un solo uso y vence a los 30 minutos. Pedir uno nuevo invalida el anterior.");
    expect(contenedor.querySelector("form")).toBeNull();
    expect(contenedor.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it("error de validación del servidor: junto al campo", async () => {
    m.accion.mockResolvedValue({ status: "error_validacion", errores: { email: ["Ingresá un email válido, por ejemplo nombre@dominio.com."] } });
    await montar();
    await enviar("ana@noctium.local");
    expect(alertas()).toEqual(["Ingresá un email válido, por ejemplo nombre@dominio.com."]);
    expect(document.activeElement).toBe(email());
  });

  it("error general de la acción: se muestra y el formulario sigue", async () => {
    m.accion.mockResolvedValue({ status: "error", mensaje: "Otra persona está modificando estos datos. Intentá de nuevo." });
    await montar();
    await enviar("ana@noctium.local");
    expect(alertas()).toEqual(["Otra persona está modificando estos datos. Intentá de nuevo."]);
    expect(contenedor.querySelector("form")).not.toBeNull();
  });

  it("falla de transporte: error de comunicación, sin romper la pantalla", async () => {
    m.accion.mockRejectedValue(new TypeError("Failed to fetch"));
    await montar();
    await enviar("ana@noctium.local");
    expect(alertas()).toEqual(["No se pudo conectar. Intentá nuevamente"]);
  });

  it("mientras envía, el botón está deshabilitado y un segundo envío no llama otra vez", async () => {
    let resolver!: (v: unknown) => void;
    m.accion.mockReturnValue(new Promise((r) => { resolver = r; }));
    await montar();
    await enviar("ana@noctium.local");
    expect(boton().disabled).toBe(true);
    await enviar("ana@noctium.local");
    expect(m.accion).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ status: "enviada" }));
    expect(contenedor.querySelector("h1")!.textContent).toBe("Revisá tu email");
  });
});
