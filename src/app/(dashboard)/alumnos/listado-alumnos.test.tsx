// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListadoAlumnos as DatosListado } from "@/types/alumno.types";

// HU-B-05: búsqueda del listado de alumnos (spec_modulo_B.md §2.7) con
// `fetchAutenticado` mockeado y timers falsos para la espera de 300 ms.

const { fetchAutenticado } = vi.hoisted(() => ({ fetchAutenticado: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("@/components/shared/pagination", async () => {
  const React = await import("react");
  return {
    Pagination: ({ total, totalPaginas, buildHref }: { total: number; totalPaginas: number; buildHref: (p: number) => string }) =>
      totalPaginas > 1 ? React.createElement("nav", { "data-total": total, "data-siguiente": buildHref(2) }) : null,
  };
});
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return { Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => React.createElement("button", { ...props, "data-variant": variant, "data-size": size }, children) };
});
vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  return { Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props) };
});

const { ListadoAlumnos, ESPERA_BUSQUEDA_MS, ESPERA_AVISO_CARGA_MS } = await import("./listado-alumnos");

function listado(apellidos: string[], total = apellidos.length, porPagina = 20): DatosListado {
  return {
    items: apellidos.map((apellido, i) => ({
      id: `a${i}`, apellido, nombre: "Nombre", dni: `4010000${i}`, telefono: null, email: null, is_active: true,
    })),
    paginacion: { total, pagina_actual: 1, total_paginas: Math.ceil(total / porPagina), por_pagina: porPagina },
  };
}

function respuesta(datos: DatosListado) {
  return { ok: true, json: async () => ({ data: datos, error: null }) };
}

let contenedor: HTMLDivElement;
let root: Root;
const replaceState = vi.spyOn(window.history, "replaceState");

async function montar(inicial = listado(["Acosta", "Aguirre"], 40), qInicial = "") {
  await act(async () => {
    root.render(<ListadoAlumnos inicial={inicial} qInicial={qInicial} esMesaDeEntrada />);
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

describe("HU-B-05 listado de alumnos con búsqueda", () => {
  it("busca una sola vez, 300 ms después de la última tecla, en la página 1", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado(["Álvarez", "Ledesma", "Luna", "Martínez"])));
    await montar();

    await escribir("l");
    await escribir("lu");
    await esperar(ESPERA_BUSQUEDA_MS - 1);
    expect(fetchAutenticado).not.toHaveBeenCalled();
    await esperar(1);

    expect(fetchAutenticado).toHaveBeenCalledTimes(1);
    expect(fetchAutenticado.mock.calls[0][0]).toBe("/api/alumnos?pagina=1&por_pagina=20&q=lu");
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/alumnos?q=lu");
    expect(contenedor.querySelector('a[href^="/alumnos/a0"]')?.getAttribute("href")).toBe("/alumnos/a0?pagina=1&q=lu");
  });

  it("con 1 carácter no busca", async () => {
    await montar();
    await escribir("a");
    await esperar(ESPERA_BUSQUEDA_MS * 2);
    expect(fetchAutenticado).not.toHaveBeenCalled();
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("al borrar la búsqueda vuelve al listado completo, en la página 1 y sin q", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado(["Acosta", "Aguirre"], 40)));
    await montar(listado(["López", "Ríos"]), "val");

    await escribir("");
    await esperar(ESPERA_BUSQUEDA_MS);

    expect(fetchAutenticado.mock.calls[0][0]).toBe("/api/alumnos?pagina=1&por_pagina=20");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/alumnos");
    expect(contenedor.querySelector("nav")?.getAttribute("data-total")).toBe("40");
  });

  it("el paginador conserva la búsqueda y muestra el total filtrado", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado(["Acosta"], 40)));
    await montar(listado(["López"], 1));

    await escribir("4010");
    await esperar(ESPERA_BUSQUEDA_MS);

    const nav = contenedor.querySelector("nav")!;
    expect(nav.getAttribute("data-total")).toBe("40");
    expect(nav.getAttribute("data-siguiente")).toBe("/alumnos?q=4010&pagina=2");
  });

  it("sin coincidencias muestra el texto buscado recortado y el acceso a Nuevo alumno", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado([])));
    await montar();

    await escribir("  juan perez  ");
    await esperar(ESPERA_BUSQUEDA_MS);

    expect(contenedor.textContent).toContain("No se encontraron alumnos para «juan perez»");
    expect(contenedor.querySelector('a[href="/alumnos/nueva"]')?.textContent).toBe("Nuevo alumno");
  });

  it("descarta la respuesta de una búsqueda anterior", async () => {
    let resolverVieja: (valor: unknown) => void = () => {};
    fetchAutenticado
      .mockImplementationOnce(() => new Promise((resolve) => { resolverVieja = resolve; }))
      .mockResolvedValueOnce(respuesta(listado(["Gómez"])));
    await montar();

    await escribir("gom");
    await esperar(ESPERA_BUSQUEDA_MS);
    await escribir("gomez santi");
    await esperar(ESPERA_BUSQUEDA_MS);
    await act(async () => resolverVieja(respuesta(listado(["Vieja1", "Vieja2", "Vieja3"]))));

    expect(fetchAutenticado.mock.calls[0][1].signal.aborted).toBe(true);
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(contenedor.textContent).toContain("Gómez");
  });

  it("mientras busca conserva la misma tabla con las filas anteriores, sin 'Cargando alumnos' ni atenuado", async () => {
    let resolver: (valor: unknown) => void = () => {};
    fetchAutenticado.mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    await montar();
    const tabla = contenedor.querySelector("table");

    await escribir("ad");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(fetchAutenticado).toHaveBeenCalledTimes(1);

    // Respuesta pendiente: nada cambia en la zona de resultados.
    expect(contenedor.querySelector("table")).toBe(tabla);
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(contenedor.textContent).not.toContain("Cargando alumnos");
    expect(contenedor.querySelector(".opacity-60, .transition-opacity")).toBeNull();

    await act(async () => resolver(respuesta(listado(["Adorno"]))));

    // Las filas se reemplazan en la misma tabla, sin desmontarla.
    expect(contenedor.querySelector("table")).toBe(tabla);
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(contenedor.textContent).toContain("Adorno");
  });

  it("el spinner del input aparece solo si la respuesta tarda más de 300 ms", async () => {
    let resolver: (valor: unknown) => void = () => {};
    fetchAutenticado.mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    await montar();

    await escribir("ad");
    await esperar(ESPERA_BUSQUEDA_MS);
    await esperar(ESPERA_AVISO_CARGA_MS - 1);
    expect(contenedor.querySelector("[data-buscando]")).toBeNull();

    await esperar(1);
    expect(contenedor.querySelector("[data-buscando]")).not.toBeNull();
    expect(contenedor.querySelector("[role=status]")?.textContent).toBe("Buscando alumnos");

    await act(async () => resolver(respuesta(listado(["Adorno"]))));
    expect(contenedor.querySelector("[data-buscando]")).toBeNull();
  });

  it("una respuesta rápida no muestra ningún aviso", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(listado(["Adorno"])));
    await montar();

    await escribir("ad");
    await esperar(ESPERA_BUSQUEDA_MS);
    await esperar(ESPERA_AVISO_CARGA_MS * 2);

    expect(contenedor.querySelector("[data-buscando]")).toBeNull();
    expect(contenedor.querySelector("[role=status]")).toBeNull();
  });

  it("adopta los datos nuevos del servidor (paginador) sin remontar la tabla ni el input", async () => {
    await montar(listado(["Acosta", "Aguirre"], 40), "");
    const tabla = contenedor.querySelector("table");
    const input = contenedor.querySelector("input");

    await montar({ ...listado(["Luna", "Martínez"], 40), paginacion: { total: 40, pagina_actual: 2, total_paginas: 2, por_pagina: 20 } }, "4010");

    expect(contenedor.querySelector("table")).toBe(tabla);
    expect(contenedor.querySelector("input")).toBe(input);
    expect(input!.value).toBe("4010");
    expect(contenedor.textContent).toContain("Luna");
    expect(contenedor.querySelector('a[href^="/alumnos/a0"]')?.getAttribute("href")).toBe("/alumnos/a0?pagina=2&q=4010");
    await esperar(ESPERA_BUSQUEDA_MS * 2);
    expect(fetchAutenticado).not.toHaveBeenCalled();
  });

  it("si falla la red muestra el aviso de HU-B-04 y Reintentar repite la búsqueda", async () => {
    fetchAutenticado.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(respuesta(listado(["López", "Ríos"])));
    await montar();

    await escribir("val");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(contenedor.textContent).toContain("No se pudo cargar la información de alumnos");
    expect(contenedor.querySelector("input")!.value).toBe("val");

    const reintentar = [...contenedor.querySelectorAll("button")].find((b) => b.textContent === "Reintentar")!;
    await act(async () => reintentar.click());

    expect(fetchAutenticado).toHaveBeenCalledTimes(2);
    expect(fetchAutenticado.mock.calls[1][0]).toBe("/api/alumnos?pagina=1&por_pagina=20&q=val");
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
