import { act } from "react";
import { createRequire } from "node:module";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El worker jsdom del repo no inicia en este worktree; crear el DOM dentro
// del worker Node conserva la prueba de interacción sin depender de su pool.
const { JSDOM } = createRequire(import.meta.url)("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
vi.stubGlobal("window", dom.window);
vi.stubGlobal("document", dom.window.document);
vi.stubGlobal("navigator", dom.window.navigator);
vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
vi.stubGlobal("HTMLInputElement", dom.window.HTMLInputElement);
vi.stubGlobal("Event", dom.window.Event);
const { createRoot } = await import("react-dom/client");
const fetchOriginal = globalThis.fetch;

const m = vi.hoisted(() => ({ guardar: vi.fn() }));
vi.mock("@/server/configuracion/actions", () => ({ guardarConfiguracion: m.guardar }));
vi.mock("@/components/shared/confirmar-accion-dialog", async () => {
  const React = await import("react");
  return { ConfirmarAccionDialog: (p: { abierto: boolean; titulo: string; detalle: React.ReactNode; textoConfirmar: string; onConfirmar: () => Promise<void>; onCerrar: () => void; accionError?: React.ReactNode }) => p.abierto
    ? React.createElement("div", { "data-dialogo": "" }, p.titulo, p.detalle, p.accionError,
        React.createElement("button", { "data-volver": "", onClick: p.onCerrar }, "Volver"),
        React.createElement("button", { "data-confirmar": "", onClick: () => void p.onConfirmar().then(p.onCerrar).catch(() => {}) }, p.textoConfirmar))
    : null };
});

const { ConfiguracionForm } = await import("@/app/(dashboard)/configuracion/configuracion-form");
const parametros = [
  { clave: "plazo_pago_horas", campo: "plazoPagoHoras", valor: 24, unidad: "h", min: 1, max: 72, porDefecto: 24 },
  { clave: "cancelacion_anticipacion_horas", campo: "cancelacionAnticipacionHoras", valor: 24, unidad: "h", min: 1, max: 72, porDefecto: 24 },
  { clave: "umbral_presentismo", campo: "umbralPresentismo", valor: 75, unidad: "%", min: 1, max: 100, porDefecto: 75 },
];
let contenedor: HTMLDivElement;
let root: Root;

async function cambiar(campo: string, valor: string) {
  await act(async () => {
    const input = contenedor.querySelector<HTMLInputElement>(`#${campo}`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.includes("historial")
    ? { items: [], pagina: 1, por_pagina: 10, total: 0, total_paginas: 0 }
    : { parametros } }) })));
  m.guardar.mockResolvedValue({ data: { cambios: ["plazo_pago_horas"] }, error: null });
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  await act(async () => { root.render(<ConfiguracionForm />); });
});
afterEach(() => { act(() => root.unmount()); contenedor.remove(); globalThis.fetch = fetchOriginal; });

describe("pantalla de configuración", () => {
  it("muestra tres campos, estado vacío y Guardar inactivo sin cambios", () => {
    expect(contenedor.querySelectorAll('input[type="number"]')).toHaveLength(3);
    expect(contenedor.textContent).toContain("Todavía no hubo cambios");
    expect(contenedor.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  });

  it("confirma el diff, Volver conserva el cambio y guardar refresca banner e historial", async () => {
    await cambiar("plazoPagoHoras", "48");
    await act(async () => { contenedor.querySelector<HTMLButtonElement>("button")!.click(); });
    expect(contenedor.querySelector("[data-dialogo]")?.textContent).toContain("24 → 48");
    expect(m.guardar).not.toHaveBeenCalled();
    await act(async () => { contenedor.querySelector<HTMLButtonElement>("[data-volver]")!.click(); });
    expect(contenedor.querySelector<HTMLInputElement>("#plazoPagoHoras")!.value).toBe("48");
    await act(async () => { contenedor.querySelector<HTMLButtonElement>("button")!.click(); });
    await act(async () => { contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click(); });
    expect(m.guardar).toHaveBeenCalledWith({ valores: { plazoPagoHoras: 48, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 }, esperados: { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 } });
    expect(contenedor.textContent).toContain("Configuración guardada");
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).includes("historial")).length).toBeGreaterThan(1);
  });

  it("rechaza decimal y vacío junto al campo sin enviar", async () => {
    await cambiar("umbralPresentismo", "75.5");
    expect(contenedor.textContent).toContain("Ingresá un número entero");
    expect(m.guardar).not.toHaveBeenCalled();
    await cambiar("umbralPresentismo", "");
    expect(contenedor.querySelector<HTMLInputElement>("#umbralPresentismo")!.getAttribute("aria-invalid")).toBe("true");
  });

  it("un conflicto conserva lo ingresado hasta elegir Recargar", async () => {
    m.guardar.mockResolvedValueOnce({ data: null, error: { code: "CONFLICTO_EDICION_CONCURRENTE", message: "Otro gerente modificó la configuración" } });
    await cambiar("plazoPagoHoras", "48");
    await act(async () => { contenedor.querySelector<HTMLButtonElement>("button")!.click(); });
    await act(async () => { contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click(); });
    expect(contenedor.querySelector<HTMLInputElement>("#plazoPagoHoras")!.value).toBe("48");
    expect(contenedor.querySelector("[data-dialogo]")?.textContent).toContain("Recargar");
    await act(async () => { [...contenedor.querySelectorAll<HTMLButtonElement>("[data-dialogo] button")].find((boton) => boton.textContent === "Recargar")!.click(); });
    expect(contenedor.querySelector<HTMLInputElement>("#plazoPagoHoras")!.value).toBe("24");
  });

  it("muestra error contextual y permite reintentar la carga", async () => {
    await act(async () => { root.unmount(); });
    root = createRoot(contenedor);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (!url.includes("historial")) throw new Error("red");
      return { ok: true, json: async () => ({ data: { items: [], pagina: 1, por_pagina: 10, total: 0, total_paginas: 0 } }) };
    }));
    await act(async () => { root.render(<ConfiguracionForm />); });
    expect(contenedor.textContent).toContain("No se pudo cargar la configuración");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.includes("historial")
      ? { items: [], pagina: 1, por_pagina: 10, total: 0, total_paginas: 0 }
      : { parametros } }) })));
    await act(async () => { [...contenedor.querySelectorAll<HTMLButtonElement>("button")].find((boton) => boton.textContent === "Reintentar")!.click(); });
    expect(contenedor.querySelectorAll('input[type="number"]')).toHaveLength(3);
  });

  it("pagina el historial de a 10 con el componente común y muestra el rango", async () => {
    await act(async () => { root.unmount(); });
    root = createRoot(contenedor);
    const item = (i: number) => ({ id: `h${i}`, clave: "plazo_pago_horas", valorAnterior: 24, valorNuevo: 48, usuario: { id: "g", nombre: "Silvia Paredes" }, fecha: "2026-10-14T12:00:00.000Z" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const pagina = Number(new URL(url, "http://localhost").searchParams.get("pagina") ?? 1);
      return { ok: true, json: async () => ({ data: url.includes("historial")
        ? { items: Array.from({ length: pagina === 1 ? 10 : 1 }, (_, i) => item(i + (pagina - 1) * 10)), pagina, por_pagina: 10, total: 11, total_paginas: 2 }
        : { parametros } }) };
    }));
    await act(async () => { root.render(<ConfiguracionForm />); });
    expect(contenedor.querySelector('nav[aria-label="Paginación"]')).not.toBeNull();
    expect(contenedor.textContent).toContain("Mostrando 1–10 de 11");
    await act(async () => { contenedor.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click(); });
    expect(contenedor.textContent).toContain("Mostrando 11–11 de 11");
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => String(url).endsWith("historial?pagina=2"))).toBe(true);
  });
});
