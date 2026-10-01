// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
    void prefetch;
    return React.createElement("a", { href, ...props }, children);
  } };
});
const { TurnosListado } = await import("./turnos-listado");

const LAURA = "ckprofesorlaura0000000001";
const MARCO = "ckprofesormarco0000000001";
const PROFESORES = [{ id: LAURA, nombre: "Laura", apellido: "Méndez" }, { id: MARCO, nombre: "Marco", apellido: "Rossi" }];
const item = (id: string, estado: string) => ({
  id, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", alumnos_inscriptos: "1/5", alumnos: [], profesor: "Méndez, Laura",
  profesor_id: LAURA, materia: "Física", aula: "Aula 1", aula_id: "a1", estado, prioridad: "NORMAL", acciones_habilitadas: [],
});
const datos = (items: unknown[]) => ({ items, paginacion: { total: items.length, pagina_actual: 1, total_paginas: 1, por_pagina: 10 } });
const respuesta = (data: unknown, ok = true, error?: unknown) => ({ ok, json: async () => ({ data, error }) });

let root: Root;
let container: HTMLDivElement;
const esperar = (ms = 20) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const montar = async ({ pagina = 1, ...props }: { pagina?: number; profesorId?: string; puedeFiltrarProfesor?: boolean; esProfesor?: boolean; q?: string } = {}) => {
  await act(async () => root.render(<TurnosListado pagina={pagina} orden="fecha_hora_asc" puedeConfigurar={false} {...props} />));
  await esperar();
};
const selector = () => container.querySelector<HTMLSelectElement>('select[aria-label="Filtrar por profesor"]');
const elegir = async (valor: string) => {
  await act(async () => {
    const elemento = selector()!;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(elemento, valor);
    elemento.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await esperar();
};
const llamadasListado = () => fetch.mock.calls.map(([url]) => url as string).filter((url) => url.startsWith("/api/turnos?"));

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/turnos");
  fetch.mockImplementation(async (url: string) => url === "/api/turnos/filtros/profesores"
    ? respuesta(PROFESORES)
    : respuesta(datos(url.includes("profesor_id") ? [item("t1", "DISPONIBLE"), item("t2", "CANCELADO"), item("t3", "PENDIENTE")] : [item("t1", "DISPONIBLE")])));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-08 filtro por profesor (mockup pág. 4)", () => {
  it("Gerente/Mesa: selector «Profesor» junto al buscador con «Todos» y los profesores activos", async () => {
    await montar({ puedeFiltrarProfesor: true });
    expect(fetch).toHaveBeenCalledWith("/api/turnos/filtros/profesores", expect.objectContaining({ cache: "no-store" }));
    expect(selector()?.closest("label")?.textContent).toContain("Profesor");
    expect([...selector()!.options].map((opcion) => opcion.textContent)).toEqual(["Todos", "Laura Méndez", "Marco Rossi"]);
  });

  it("elegir un profesor vuelve a la página 1, conserva q, muestra todos los estados, el chip y actualiza la URL", async () => {
    await montar({ puedeFiltrarProfesor: true, q: "fisica" });
    await elegir(LAURA);
    expect(llamadasListado().at(-1)).toBe(`/api/turnos?pagina=1&q=fisica&profesor_id=${LAURA}`);
    for (const estado of ["Disponible", "Cancelado", "Pendiente"]) expect(container.querySelector("tbody")?.textContent).toContain(estado);
    expect(container.textContent).toContain("3 turnos");
    expect(container.textContent).toContain("Profesor: Laura Méndez");
    expect(window.location.search).toBe(`?q=fisica&profesor_id=${LAURA}&pagina=1&orden=fecha_hora_asc`);
    const verDetalle = [...container.querySelectorAll("a")].find((a) => a.textContent === "Ver detalle")!;
    expect(decodeURIComponent(verDetalle.getAttribute("href")!)).toContain(`profesor_id=${LAURA}`);
  });

  it("la × del chip quita el filtro y «Limpiar» quita filtro y búsqueda", async () => {
    await montar({ puedeFiltrarProfesor: true, profesorId: LAURA, q: "fisica" });
    expect(llamadasListado()[0]).toBe(`/api/turnos?pagina=1&q=fisica&profesor_id=${LAURA}`);
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Quitar filtro de profesor"]')!.click());
    await esperar();
    expect(llamadasListado().at(-1)).toBe("/api/turnos?pagina=1&q=fisica");
    await elegir(MARCO);
    await act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Limpiar")!.click());
    await esperar();
    expect(llamadasListado().at(-1)).toBe("/api/turnos?pagina=1");
    expect(selector()!.value).toBe("");
  });

  it("AC4: profesor sin turnos → «Este profesor no tiene turnos registrados», con el chip para quitar el filtro", async () => {
    fetch.mockImplementation(async (url: string) => url === "/api/turnos/filtros/profesores" ? respuesta(PROFESORES) : respuesta(datos([])));
    await montar({ puedeFiltrarProfesor: true, profesorId: MARCO });
    expect(container.textContent).toContain("Este profesor no tiene turnos registrados");
    expect(container.textContent).toContain("Profesor: Marco Rossi");
  });

  it("Profesor: sin selector ni consulta de opciones; vacío con el texto de AC4", async () => {
    fetch.mockResolvedValue(respuesta(datos([])));
    await montar({ esProfesor: true });
    expect(selector()).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith("/api/turnos/filtros/profesores", expect.anything());
    expect(container.textContent).toContain("Este profesor no tiene turnos registrados");
  });

  it("un 403/404 del filtro se informa con el aviso del listado", async () => {
    fetch.mockImplementation(async (url: string) => url === "/api/turnos/filtros/profesores"
      ? respuesta(PROFESORES)
      : respuesta(null, false, { code: "PROFESOR_NO_ENCONTRADO", message: "No se encontró un profesor activo" }));
    await montar({ puedeFiltrarProfesor: true, profesorId: LAURA });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("No se encontró un profesor activo");
  });

  it("cambiar el profesor desde la página 2 consulta la página 1", async () => {
    await montar({ puedeFiltrarProfesor: true, pagina: 2 });
    expect(llamadasListado()[0]).toBe("/api/turnos?pagina=2");
    await elegir(MARCO);
    expect(llamadasListado().at(-1)).toBe(`/api/turnos?pagina=1&profesor_id=${MARCO}`);
  });

  it("con más de una página, el paginador conserva profesor_id", async () => {
    fetch.mockImplementation(async (url: string) => url === "/api/turnos/filtros/profesores"
      ? respuesta(PROFESORES)
      : respuesta({ items: [item("t1", "DISPONIBLE")], paginacion: { total: 25, pagina_actual: 2, total_paginas: 3, por_pagina: 10 } }));
    await montar({ puedeFiltrarProfesor: true, profesorId: LAURA, pagina: 2 });
    const paginador = container.querySelector('nav[aria-label="Páginas de turnos"]')!;
    const hrefs = [...paginador.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      `/turnos?profesor_id=${LAURA}&pagina=1&orden=fecha_hora_asc`,
      `/turnos?profesor_id=${LAURA}&pagina=3&orden=fecha_hora_asc`,
    ]);
  });

  it("sin las opciones todavía, no muestra el chip sin nombre pero sí «Limpiar»", async () => {
    fetch.mockImplementation(async (url: string) => url === "/api/turnos/filtros/profesores"
      ? new Promise(() => {})
      : respuesta(datos([item("t1", "DISPONIBLE")])));
    await montar({ puedeFiltrarProfesor: true, profesorId: LAURA });
    expect(container.textContent).toContain("1 turno");
    expect(container.textContent).not.toContain("Profesor:");
    expect(container.querySelector('button[aria-label="Quitar filtro de profesor"]')).toBeNull();
    expect([...container.querySelectorAll("button")].some((b) => b.textContent === "Limpiar")).toBe(true);
  });
});
