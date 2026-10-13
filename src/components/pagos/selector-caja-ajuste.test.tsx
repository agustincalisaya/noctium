// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetchMock }));

const { SelectorCajaAjuste } = await import("./selector-caja-ajuste");

const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 400, status, json: async () => cuerpo });
const caja = (id: string, nombre: string | null, minutos: number) => ({ id, integrante: { id: `u-${id}`, nombre_completo: nombre }, abierta_el: "", antiguedad_minutos: minutos });
const reintentar = vi.fn();
let root: Root;
let container: HTMLDivElement;
const render = (enviando = false) => act(async () => root.render(<SelectorCajaAjuste enviando={enviando} onReintentar={reintentar} />));
const boton = (nombre: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === nombre) as HTMLButtonElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("SelectorCajaAjuste (HU-I-06, spec_modulo_I.md §2.14.4)", () => {
  it("lista las cajas abiertas de GET /api/cajas y reintenta con la elegida", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { data: { abiertas: [caja("c1", "Ruiz, Marta", 30), caja("c2", null, 125)], cierres: { items: [] } }, error: null }));
    await render();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/cajas", expect.objectContaining({ cache: "no-store" }));
    const select = container.querySelector("select")!;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Elegí una caja abierta", expect.stringMatching(/^Ruiz, Marta · abierta hace /), expect.stringMatching(/^— · abierta hace /),
    ]);
    expect(boton("Reintentar con esta caja").disabled).toBe(true);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "c2");
    await act(async () => { select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { boton("Reintentar con esta caja").click(); });
    expect(reintentar).toHaveBeenCalledExactlyOnceWith("c2");
  });

  it("sin cajas abiertas lo informa y no ofrece reintentar", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { data: { abiertas: [], cierres: { items: [] } }, error: null }));
    await render();
    expect(container.textContent).toContain("No hay ninguna caja abierta en mesa de entrada.");
    expect(boton("Reintentar con esta caja")).toBeUndefined();
  });

  it("si la consulta falla, permite volver a cargar", async () => {
    fetchMock.mockResolvedValueOnce(respuesta(403, { data: null, error: { code: "SIN_PERMISO", message: "x" } }));
    fetchMock.mockResolvedValueOnce(respuesta(200, { data: { abiertas: [caja("c1", "Ruiz, Marta", 5)], cierres: { items: [] } }, error: null }));
    await render();
    expect(container.textContent).toContain("No se pudieron cargar las cajas abiertas.");
    await act(async () => { boton("Reintentar").click(); });
    expect(container.querySelector("select")).not.toBeNull();
  });
});
