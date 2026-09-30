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
const { TurnoDetalleVista } = await import("./[id]/turno-detalle");
const item = (estado: "PENDIENTE" | "DISPONIBLE" | "COMPLETO", extra: Record<string, unknown> = {}) => ({
  id: estado.toLowerCase(), fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", alumnos_inscriptos: "0/5",
  alumnos: [], profesor: "Sin asignar", profesor_id: null, materia: "Física", aula: "Sin asignar", aula_id: null, estado, ...extra,
});
const datos = (items: unknown[], pagina = 2) => ({ items, paginacion: { total: 3, pagina_actual: pagina, total_paginas: 2, por_pagina: 2 } });
const respuesta = (data: unknown, ok = true, error?: unknown) => ({ ok, json: async () => ({ data, error }) });
let root: Root;
let container: HTMLDivElement;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async () => { await act(async () => root.render(<TurnosListado pagina={2} orden="fecha_hora_asc" puedeConfigurar />)); await esperar(); };

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fetch.mockResolvedValue(respuesta(datos([item("PENDIENTE")])));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-01 interfaz", () => {
  it("muestra estado textual, ocupación y navega al paso faltante (aula antes que participantes) conservando retorno", async () => {
    fetch.mockResolvedValue(respuesta(datos([
      item("PENDIENTE", { alumnos_inscriptos: "Sin asignar" }),
      item("PENDIENTE", { id: "con-aula", aula: "Aula 1", aula_id: "aula-1", alumnos_inscriptos: "0/10" }),
      item("DISPONIBLE", { id: "disponible", alumnos_inscriptos: "1/5" }), item("COMPLETO", { id: "completo", alumnos_inscriptos: "5/5" }),
    ])));
    await montar();
    expect(container.querySelector("th")?.textContent).toBe("Fecha");
    expect(container.textContent).toContain("Alumnos inscriptos");
    for (const texto of ["Pendiente", "Disponible", "Completo", "0/10", "1/5", "5/5", "Sin asignar"]) expect(container.textContent).toContain(texto);
    const estados = [...container.querySelectorAll("tbody tr td:nth-child(7) span")];
    expect(estados[0].className).toContain("bg-warning");
    expect(estados[2].className).toContain("bg-success");
    expect(estados[3].className).toContain("bg-secondary");
    const enlaces = [...container.querySelectorAll("a")];
    expect(enlaces.find((a) => a.textContent === "Ver detalle")?.getAttribute("href")).toBe("/turnos/pendiente?volver=%2Fturnos%3Fpagina%3D2%26orden%3Dfecha_hora_asc");
    expect(enlaces.filter((a) => a.textContent === "Continuar configuración").map((a) => a.getAttribute("href"))).toEqual([
      "/turnos/pendiente/configuracion?volver=%2Fturnos%3Fpagina%3D2%26orden%3Dfecha_hora_asc",
      "/turnos/con-aula/participantes?volver=%2Fturnos%3Fpagina%3D2%26orden%3Dfecha_hora_asc",
    ]);
    expect(enlaces.find((a) => a.textContent === "Anterior")?.getAttribute("href")).toBe("/turnos?pagina=1&orden=fecha_hora_asc");
    const paginacion = container.querySelector('nav[aria-label="Páginas de turnos"]')!;
    const anterior = [...paginacion.querySelectorAll("a")].find((a) => a.textContent === "Anterior")!;
    expect(anterior.className).toContain("bg-background");
    expect(anterior.className).toContain("border-border");
    expect(anterior.className).toContain("text-foreground");
    expect(anterior.querySelector("svg")?.nextSibling?.textContent).toBe("Anterior");
    expect(paginacion.querySelector('[aria-disabled="true"]')?.textContent).toBe("Siguiente");
    expect(paginacion.querySelector('[aria-disabled="true"] svg')?.previousSibling?.textContent).toBe("Siguiente");
  });

  it("deshabilita Anterior en la primera página y conserva Siguiente habilitado", async () => {
    fetch.mockResolvedValue(respuesta(datos([item("DISPONIBLE")], 1)));
    await act(async () => root.render(<TurnosListado pagina={1} orden="fecha_hora_asc" puedeConfigurar />));
    await esperar();
    const paginacion = container.querySelector('nav[aria-label="Páginas de turnos"]')!;
    expect(paginacion.querySelector('[aria-disabled="true"]')?.textContent).toBe("Anterior");
    expect(paginacion.querySelector('a[href="/turnos?pagina=2&orden=fecha_hora_asc"]')?.textContent).toBe("Siguiente");
  });

  it("muestra carga, vacío, error y permite reintentar", async () => {
    let liberar!: (value: ReturnType<typeof respuesta>) => void;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; }));
    await act(async () => root.render(<TurnosListado pagina={2} orden="fecha_hora_asc" puedeConfigurar />));
    expect(container.textContent).toContain("Cargando turnos");
    await esperar();
    await act(async () => liberar(respuesta(datos([]))));
    expect(container.textContent).toContain("No hay turnos registrados");
    fetch.mockResolvedValueOnce(respuesta(null, false, { message: "Falló la consulta" })).mockResolvedValueOnce(respuesta(datos([item("COMPLETO")])));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await esperar();
    expect(container.textContent).toContain("Falló la consulta");
    await act(async () => (container.querySelector("button") as HTMLButtonElement).click());
    expect(container.textContent).toContain("Completo");
  });

  it("consulta nuevamente al volver a la pestaña tras modificar un turno", async () => {
    fetch.mockResolvedValueOnce(respuesta(datos([item("DISPONIBLE", { alumnos_inscriptos: "1/5" })])))
      .mockResolvedValueOnce(respuesta(datos([item("COMPLETO", { alumnos_inscriptos: "5/5" })])));
    await montar();
    expect(container.textContent).toContain("1/5");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await esperar();
    expect(container.textContent).toContain("5/5");
    expect(fetch).toHaveBeenLastCalledWith("/api/turnos?pagina=2", { cache: "no-store", signal: expect.any(AbortSignal) });
    expect(container.textContent).not.toContain("Cargando turnos");
  });

  it("abre el detalle en consulta y conserva página y orden al regresar", async () => {
    fetch.mockResolvedValue(respuesta({
      ...item("DISPONIBLE", { id: "turno-1", alumnos_inscriptos: "1/5" }),
      alumnos: [{ id: "alumno-1", nombre: "Pérez, Juan", dni: "30123456" }],
      duracion_minutos: 60, cupo_maximo: 5, profesor: "Gómez, Ana", profesor_dni: "12345678",
      materia_codigo: "FIS", aula: "Aula 1", aula_capacidad: 10,
      creado_en: "2026-09-24T12:00:00.000Z", actualizado_en: "2026-09-24T12:00:00.000Z",
      creado_por: "mesa@example.com", modificado_por: "mesa@example.com",
    }));
    await act(async () => root.render(<TurnoDetalleVista id="turno-1" retorno="/turnos?pagina=2&orden=fecha_hora_asc" puedeConfigurar={false} puedeGestionarAlumnos={false} />));
    await esperar();
    expect(container.textContent).toContain("Pérez, Juan");
    expect(container.textContent).toContain("Disponible");
    expect(container.textContent).toContain("mesa@example.com");
    expect(container.textContent).toContain("Fecha de creación");
    const estado = [...container.querySelectorAll("dt")].find((elemento) => elemento.textContent === "Estado")?.nextElementSibling?.querySelector("span");
    expect(estado?.textContent).toBe("Disponible");
    expect(estado?.className).toContain("bg-success");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/turnos?pagina=2&orden=fecha_hora_asc");
    expect(fetch).toHaveBeenCalledWith("/api/turnos/turno-1", { cache: "no-store" });
  });

  it("en un turno pendiente ofrece aula antes que participantes, y cupo \"Sin asignar\" sin aula (Revisión 3)", async () => {
    const detalle = (extra: Record<string, unknown>) => respuesta({
      ...item("PENDIENTE", { id: "turno-1", ...extra }), duracion_minutos: 60,
      creado_en: "2026-09-24T12:00:00.000Z", actualizado_en: "2026-09-24T12:00:00.000Z",
      creado_por: "mesa@example.com", modificado_por: "mesa@example.com",
    });
    const volver = "?volver=%2Fturnos%3Fpagina%3D2%26orden%3Dfecha_hora_asc";
    const enlace = (texto: string) => [...container.querySelectorAll("a")].find((a) => a.textContent === texto);
    const cupo = () => [...container.querySelectorAll("dt")].find((elemento) => elemento.textContent === "Cupo máximo")?.nextElementSibling?.textContent;
    fetch.mockResolvedValue(detalle({ cupo_maximo: null, alumnos_inscriptos: "Sin asignar" }));
    await act(async () => root.render(<TurnoDetalleVista id="turno-1" retorno="/turnos?pagina=2&orden=fecha_hora_asc" puedeConfigurar puedeGestionarAlumnos />));
    await esperar();
    expect(enlace("Modificar configuración y asignar aula")?.getAttribute("href")).toBe(`/turnos/turno-1/configuracion${volver}`);
    expect(enlace("Asignar profesor y alumnos")).toBeUndefined();
    expect(cupo()).toBe("Sin asignar");
    fetch.mockResolvedValue(detalle({ aula: "Aula 1", aula_id: "aula-1", aula_capacidad: 10, cupo_maximo: 10, alumnos_inscriptos: "0/10" }));
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<TurnoDetalleVista id="turno-1" retorno="/turnos?pagina=2&orden=fecha_hora_asc" puedeConfigurar puedeGestionarAlumnos />));
    await esperar();
    expect(enlace("Modificar configuración o aula")?.getAttribute("href")).toBe(`/turnos/turno-1/configuracion${volver}`);
    expect(enlace("Asignar profesor y alumnos")?.getAttribute("href")).toBe(`/turnos/turno-1/participantes${volver}`);
    expect(cupo()).toBe("10");
    expect(container.querySelector('a[href*="/aula"]')).toBeNull();
  });
});

describe("HU-C-02 búsqueda en el listado", () => {
  const replaceState = vi.spyOn(window.history, "replaceState");
  const pagina = (ids: string[], total = ids.length, paginaActual = 1, porPagina = 10) => ({
    items: ids.map((id) => item("DISPONIBLE", { id, alumnos_inscriptos: "1/5", materia: `Materia ${id}` })),
    paginacion: { total, pagina_actual: paginaActual, total_paginas: Math.ceil(total / porPagina), por_pagina: porPagina },
  });
  const diferida = () => {
    let resolver!: (valor: ReturnType<typeof respuesta>) => void;
    const promesa = new Promise<ReturnType<typeof respuesta>>((resolve) => { resolver = resolve; });
    return { promesa, resolver: (data: unknown) => act(async () => resolver(respuesta(data))) };
  };
  const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  // La espera de la búsqueda y, después, el turno de la consulta (setTimeout 0).
  const buscar = async () => { await avanzar(300); await avanzar(0); };
  const render = (props: { pagina?: number; q?: string } = {}) =>
    act(async () => root.render(<TurnosListado pagina={props.pagina ?? 1} q={props.q ?? ""} orden="fecha_hora_asc" puedeConfigurar />));
  const escribir = async (valor: string) => {
    const input = container.querySelector("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input, valor); input.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const url = () => (fetch.mock.lastCall as [string])[0];
  const filas = () => [...container.querySelectorAll("tbody tr")].map((fila) => fila.querySelector("td:nth-child(5)")?.textContent);

  beforeEach(() => {
    vi.useFakeTimers();
    replaceState.mockImplementation(() => {});
    fetch.mockResolvedValue(respuesta(pagina(["a", "b"], 25)));
  });
  afterEach(() => vi.useRealTimers());

  it("muestra subtítulo, buscador y contador del total", async () => {
    await render();
    await avanzar(0);
    expect(container.textContent).toContain("Buscá por profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes).");
    expect(container.textContent).toContain("Desde hoy · Orden: fecha y hora ascendente, luego profesor");
    expect(container.querySelector("input")?.getAttribute("placeholder")).toBe("Ej.: matematica, aula 2, gimenez…");
    expect(container.querySelector('input[aria-label="Buscar turno"]')).not.toBeNull();
    expect(container.textContent).toContain("25 turnos");
    expect(url()).toBe("/api/turnos?pagina=1");
  });

  it("busca una sola vez, 300 ms después de la última tecla, en la página 1, y actualiza la URL", async () => {
    await render({ pagina: 3 });
    await avanzar(0);
    fetch.mockResolvedValue(respuesta(pagina(["r1"], 7)));
    await escribir("ro");
    await escribir("rossi");
    await avanzar(299);
    expect(fetch).toHaveBeenCalledTimes(1);
    await avanzar(1);
    await avanzar(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(url()).toBe("/api/turnos?pagina=1&q=rossi");
    expect(container.textContent).toContain("7 turnos");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/turnos?q=rossi&pagina=1&orden=fecha_hora_asc");
  });

  it("con un carácter no filtra y al borrar vuelve al listado completo en la página 1", async () => {
    await render({ q: "rossi", pagina: 2 });
    await avanzar(0);
    expect(url()).toBe("/api/turnos?pagina=2&q=rossi");
    expect(container.querySelector("input")?.value).toBe("rossi");
    await escribir("r");
    await buscar();
    expect(url()).toBe("/api/turnos?pagina=1");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/turnos?pagina=1&orden=fecha_hora_asc");
  });

  it("descarta respuestas viejas al buscar", async () => {
    await render();
    await avanzar(0);
    const vieja = diferida();
    const nueva = diferida();
    fetch.mockReturnValueOnce(vieja.promesa).mockReturnValueOnce(nueva.promesa);
    await escribir("gim");
    await buscar();
    await escribir("gimenez fisica");
    await buscar();
    await nueva.resolver(pagina(["nueva"]));
    await vieja.resolver(pagina(["vieja"]));
    await avanzar(0);
    expect(filas()).toEqual(["Materia nueva"]);
  });

  it("al paginar sin key trae la página pedida, conserva la tabla y descarta respuestas viejas", async () => {
    await render({ q: "aula" });
    await avanzar(0);
    const tabla = container.querySelector("table");
    const inputAntes = container.querySelector("input");
    const pagina2 = diferida();
    const pagina3 = diferida();
    fetch.mockReturnValueOnce(pagina2.promesa).mockReturnValueOnce(pagina3.promesa);
    await render({ q: "aula", pagina: 2 });
    await avanzar(0);
    expect(url()).toBe("/api/turnos?pagina=2&q=aula");
    await render({ q: "aula", pagina: 3 });
    await avanzar(0);
    expect(url()).toBe("/api/turnos?pagina=3&q=aula");
    // Mientras llega la respuesta: mismas filas, sin "Cargando turnos".
    expect(container.textContent).not.toContain("Cargando turnos");
    expect(filas()).toEqual(["Materia a", "Materia b"]);
    await pagina3.resolver(pagina(["p3"], 25, 3));
    await pagina2.resolver(pagina(["p2"], 25, 2));
    await avanzar(0);
    expect(filas()).toEqual(["Materia p3"]);
    expect(container.textContent).toContain("Página 3 de 3");
    expect(container.querySelector("table")).toBe(tabla);
    expect(container.querySelector("input")).toBe(inputAntes);
    expect(container.querySelector("input")?.value).toBe("aula");
    // La navegación del paginador no toca la URL con replaceState.
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("los enlaces del paginador y de las filas conservan la búsqueda", async () => {
    fetch.mockResolvedValue(respuesta({ ...pagina([], 19, 2), items: [item("PENDIENTE", { id: "pend" })] }));
    await render({ q: "quim", pagina: 2 });
    await avanzar(0);
    const href = (texto: string) => [...container.querySelectorAll("a")].find((a) => a.textContent === texto)?.getAttribute("href");
    const volver = encodeURIComponent("/turnos?q=quim&pagina=2&orden=fecha_hora_asc");
    expect(href("Ver detalle")).toBe(`/turnos/pend?volver=${volver}`);
    expect(href("Continuar configuración")).toBe(`/turnos/pend/configuracion?volver=${volver}`);
    expect(href("Anterior")).toBe("/turnos?q=quim&pagina=1&orden=fecha_hora_asc");
  });

  it("sin coincidencias muestra el texto buscado", async () => {
    await render();
    await avanzar(0);
    fetch.mockResolvedValue(respuesta(pagina([], 0)));
    await escribir("  mendez ");
    await buscar();
    expect(container.textContent).toContain("No se encontraron turnos para «mendez»");
    expect(container.textContent).not.toContain("0 turnos");
  });

  it("muestra el spinner solo si la búsqueda tarda más de 300 ms", async () => {
    await render();
    await avanzar(0);
    const lenta = diferida();
    fetch.mockReturnValueOnce(lenta.promesa);
    await escribir("rossi");
    await buscar();
    await avanzar(299);
    expect(container.querySelector("[data-buscando]")).toBeNull();
    await avanzar(1);
    expect(container.querySelector("[data-buscando]")).not.toBeNull();
    expect(container.querySelector("[role=status]")?.textContent).toBe("Buscando turnos");
    expect(filas()).toEqual(["Materia a", "Materia b"]);
    await lenta.resolver(pagina(["r"]));
    expect(container.querySelector("[data-buscando]")).toBeNull();
  });
});
