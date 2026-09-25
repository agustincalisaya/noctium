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
    expect(fetch).toHaveBeenLastCalledWith("/api/turnos?pagina=2", { cache: "no-store" });
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
