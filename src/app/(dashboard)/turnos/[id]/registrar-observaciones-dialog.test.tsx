// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ guardar: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchOLanzar: m.guardar }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));

const { RegistrarObservacionesDialog } = await import("./registrar-observaciones-dialog");
let root: Root;
let container: HTMLDivElement;
const registrada = vi.fn();
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
const dialog = () => document.querySelector('[role="dialog"]')!;
const alertDialog = () => document.querySelector('[role="alertdialog"]')!;
const boton = (scope: Element, label: string) => [...scope.querySelectorAll("button")].find((button) => button.textContent?.trim() === label) as HTMLButtonElement;
const ingresar = async (id: string, valor: string) => {
  const campo = document.getElementById(id) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => { setter.call(campo, valor); campo.dispatchEvent(new Event("input", { bubbles: true })); });
};
const continuar = () => act(async () => dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
const montar = async () => {
  await act(async () => root.render(<RegistrarObservacionesDialog turnoId="turno / uno" contexto="Matemática · 09/10/2026, 10:00–11:00" onRegistrada={registrada} />));
  await act(async () => boton(container, "Registrar observaciones").click());
  await esperar();
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  m.guardar.mockResolvedValue({ id: "obs-1" });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-E-07 diálogo de observaciones", () => {
  it("muestra campos y contadores, rechaza solo espacios y abre la confirmación C-25", async () => {
    await montar();
    expect(dialog().textContent).toContain("Temas vistos");
    expect(dialog().textContent).toContain("Observaciones internas");
    expect(dialog().textContent).toContain("0 / 1000 caracteres");
    await ingresar("temas-vistos", "   ");
    await ingresar("observaciones-internas", "Nota interna");
    expect(dialog().textContent).toContain("3 / 1000 caracteres");
    await act(async () => boton(dialog(), "Continuar").click());
    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe("Escribí los temas vistos para continuar.");
    expect(document.getElementById("temas-vistos")?.getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();

    await ingresar("temas-vistos", "Funciones lineales");
    expect(dialog().querySelector('[role="alert"]')).toBeNull();
    await continuar();
    expect(alertDialog().textContent).toContain("¿Registrar las observaciones de esta clase?");
    expect(alertDialog().textContent).toContain("Esta acción no se puede deshacer.");
  });

  it("guarda la entrada normalizada, muestra el toast literal y devuelve el control al detalle", async () => {
    await montar();
    await ingresar("temas-vistos", "  Funciones lineales  ");
    await ingresar("observaciones-internas", "  Revisar práctica  ");
    await continuar();
    await act(async () => boton(alertDialog(), "Registrar observaciones").click());
    await esperar();
    expect(m.guardar).toHaveBeenCalledWith("/api/turnos/turno%20%2F%20uno/clase-dictada/observaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temas_vistos: "Funciones lineales", observaciones_internas: "Revisar práctica" }),
      cache: "no-store",
    });
    expect(m.exito).toHaveBeenCalledExactlyOnceWith("Observaciones registradas correctamente");
    expect(registrada).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("mantiene abierta la confirmación ante rechazo para permitir revisar el formulario", async () => {
    m.guardar.mockRejectedValueOnce(new Error("La clase ya tiene observaciones"));
    await montar();
    await ingresar("temas-vistos", "Álgebra");
    await continuar();
    await act(async () => boton(alertDialog(), "Registrar observaciones").click());
    await esperar();
    expect(alertDialog().querySelector('[role="alert"]')?.textContent).toBe("La clase ya tiene observaciones");
    expect(registrada).not.toHaveBeenCalled();
  });
});
