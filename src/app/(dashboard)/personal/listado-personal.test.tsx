// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListadoPersonal as DatosListado } from "@/types/personal.types";

// HU-F-03: búsqueda y paginación del listado del personal de mesa de entrada
// (spec_modulo_F.md §2.3), con `fetchAutenticado` mockeado y timers falsos
// para la espera de 300 ms. Misma mecánica que el listado de alumnos.

const { fetchAutenticado } = vi.hoisted(() => ({ fetchAutenticado: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("@/components/shared/pagination", async () => {
  const React = await import("react");
  return {
    Pagination: ({ total, paginaActual, totalPaginas, buildHref }: { total: number; paginaActual: number; totalPaginas: number; buildHref: (p: number) => string }) =>
      totalPaginas > 1
        ? React.createElement("nav", { "data-total": total, "data-pagina": paginaActual, "data-siguiente": buildHref(paginaActual + 1), "data-primera": buildHref(1) })
        : null,
  };
});
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return {
    Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
      React.createElement("button", { ...props, "data-variant": variant, "data-size": size }, children),
  };
});
vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  return { Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props) };
});

const { ListadoPersonal } = await import("./listado-personal");
const { ESPERA_BUSQUEDA_MS } = await import("@/components/shared/campo-busqueda");

function listado(apellidos: string[], extra: Partial<DatosListado> = {}): DatosListado {
  const total = extra.total ?? apellidos.length;
  return {
    items: apellidos.map((apellido, i) => ({
      id: `f${i}`, apellido, nombre: "Nombre", dni: `8806200${i}`, telefono: null, email: `${i}@x.com`, activo: i !== 1,
    })),
    pagina: 1,
    por_pagina: 10,
    total,
    total_paginas: Math.ceil(total / 10),
    ...extra,
  };
}

function respuesta(datos: DatosListado) {
  return { ok: true, json: async () => ({ data: datos, error: null }) };
}

let contenedor: HTMLDivElement;
let root: Root;
const replaceState = vi.spyOn(window.history, "replaceState");

async function montar(inicial = listado(["Álvarez", "Garcés", "García"], { total: 23 }), qInicial = "") {
  await act(async () => {
    root.render(<ListadoPersonal inicial={inicial} qInicial={qInicial} />);
  });
}

async function escribir(valor: string) {
  const input = contenedor.querySelector("input")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function esperar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const filas = () => [...contenedor.querySelectorAll("tbody tr")];
const apellidos = () => filas().map((fila) => fila.querySelector("a")!.textContent);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  replaceState.mockImplementation(() => {});
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
  vi.useRealTimers();
});

describe("HU-F-03 listado del personal", () => {
  it("tabla con las seis columnas; la fila inactiva atenuada; toda la fila enlaza a la ficha", async () => {
    await montar();
    expect([...contenedor.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Apellido", "Nombre", "DNI", "Teléfono", "Email", "Estado"]);
    expect(filas()).toHaveLength(3);
    const inactiva = filas()[1]!;
    expect(inactiva.className).toContain("opacity-60");
    expect(inactiva.textContent).toContain("Inactivo");
    expect(filas()[0]!.className).not.toContain("opacity-60");
    expect(filas()[0]!.textContent).toContain("Activo");
    expect(filas()[0]!.textContent).toContain("—");
    // El enlace de la primera celda cubre toda la fila (tr relativa + after:inset-0).
    const enlace = filas()[0]!.querySelector("a")!;
    expect(enlace.getAttribute("href")).toBe("/personal/f0");
    expect(enlace.className).toContain("after:absolute");
    expect(enlace.className).toContain("after:inset-0");
    expect(filas()[0]!.className).toContain("relative");
  });

  it("busca una sola vez, 300 ms después de la última tecla, en la página 1, y actualiza la URL", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado(["Garcés", "García"])));
    await montar();
    await escribir("ga");
    await escribir("gar");
    await esperar(ESPERA_BUSQUEDA_MS - 1);
    expect(fetchAutenticado).not.toHaveBeenCalled();
    await esperar(1);
    expect(fetchAutenticado).toHaveBeenCalledTimes(1);
    expect(fetchAutenticado.mock.calls[0]![0]).toBe("/api/personal?pagina=1&q=gar");
    expect(apellidos()).toEqual(["Garcés", "García"]);
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/personal?q=gar");
  });

  it("con menos de 2 caracteres pide el listado completo", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado(["Álvarez", "Garcés", "García"])));
    await montar(listado(["García"]), "garcia");
    await escribir("g");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(fetchAutenticado.mock.calls[0]![0]).toBe("/api/personal?pagina=1");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/personal");
  });

  it("descarta una respuesta vieja: gana la última búsqueda", async () => {
    let resolverVieja: (valor: unknown) => void = () => {};
    fetchAutenticado
      .mockImplementationOnce(() => new Promise((resolver) => (resolverVieja = resolver)))
      .mockResolvedValueOnce(respuesta(listado(["Núñez"])));
    await montar();
    await escribir("al");
    await esperar(ESPERA_BUSQUEDA_MS);
    await escribir("nu");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(apellidos()).toEqual(["Núñez"]);
    await act(async () => resolverVieja(respuesta(listado(["Álvarez"]))));
    expect(apellidos()).toEqual(["Núñez"]);
  });

  it("sin resultados con q: el texto propuesto y «Nuevo integrante»", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado([])));
    await montar();
    await escribir("zeta");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(contenedor.textContent).toContain("No se encontraron integrantes para «zeta»");
    expect(contenedor.querySelector('a[href="/personal/nuevo"]')).not.toBeNull();
  });

  it("sin integrantes y sin q: el mensaje del criterio 4 y «Nuevo integrante»", async () => {
    await montar(listado([]));
    expect(contenedor.textContent).toContain("Todavía no hay personal de mesa de entrada registrado");
    expect(contenedor.querySelector('a[href="/personal/nuevo"]')).not.toBeNull();
    expect(contenedor.querySelector("table")).toBeNull();
  });

  it("el paginador conserva q; la página 1 no va en la URL", async () => {
    await montar(listado(["García"], { total: 23, total_paginas: 3, pagina: 2 }), "garcia");
    const nav = contenedor.querySelector("nav")!;
    expect(nav.getAttribute("data-total")).toBe("23");
    expect(nav.getAttribute("data-siguiente")).toBe("/personal?q=garcia&pagina=3");
    expect(nav.getAttribute("data-primera")).toBe("/personal?q=garcia");
  });

  it("si la búsqueda falla, el aviso con «Reintentar» vuelve a pedir", async () => {
    fetchAutenticado.mockResolvedValueOnce({ ok: false, json: async () => ({ data: null }) }).mockResolvedValueOnce(respuesta(listado(["Ruiz"])));
    await montar();
    await escribir("ruiz");
    await esperar(ESPERA_BUSQUEDA_MS);
    const alerta = contenedor.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain("No se pudo cargar el listado del personal");
    await act(async () => alerta.querySelector("button")!.click());
    expect(fetchAutenticado).toHaveBeenCalledTimes(2);
    expect(fetchAutenticado.mock.calls[1]![0]).toBe("/api/personal?pagina=1&q=ruiz");
    expect(apellidos()).toEqual(["Ruiz"]);
  });

  it("adopta los datos nuevos del servidor (el paginador navegó) sin remontarse", async () => {
    await montar(listado(["Álvarez"], { total: 23 }), "");
    await act(async () => {
      root.render(<ListadoPersonal inicial={listado(["Paz", "Ruiz"], { total: 23, pagina: 2 })} qInicial="" />);
    });
    expect(apellidos()).toEqual(["Paz", "Ruiz"]);
    expect(fetchAutenticado).not.toHaveBeenCalled();
  });
});
