// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { fetch, setDirty } = vi.hoisted(() => ({ fetch: vi.fn(), setDirty: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty, confirmarSalida: (salir: () => void) => salir() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) };
});
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) };
});

const { AulaTurno } = await import("./aula-turno");
const respuesta = (data: unknown, ok = true, error?: unknown) => ({ ok, json: async () => ({ data, error }) });
const turno = (extra: Record<string, unknown> = {}) => ({
  id: "turno-1", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia: "Física",
  profesor: "Gómez, Ana", profesor_id: "profesor-1", alumnos_inscriptos: "1/3", alumnos: [{ id: "alumno-1" }],
  cupo_maximo: 3, estado: "PENDIENTE", aula: "Sin asignar", aula_id: null, aula_capacidad: null, ...extra,
});
const aulas = [{ id: "aula-1", nombre: "Aula 1", capacidad: 5 }, { id: "aula-2", nombre: "Aula 2", capacidad: 8 }];
let root: Root;
let container: HTMLDivElement;
const retorno = "/turnos?pagina=2&orden=fecha_asc";
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async () => { await act(async () => { root.render(<AulaTurno id="turno-1" retorno={retorno} />); }); await esperar(); };
const seleccionar = (id: string) => act(async () => {
  const select = container.querySelector("#aula") as HTMLSelectElement;
  select.value = id; select.dispatchEvent(new Event("change", { bubbles: true }));
});
const guardar = () => act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
const patch = () => fetch.mock.calls.filter(([url, init]) => url.endsWith("/aula") && init?.method === "PATCH");
const boton = () => container.querySelector('button[type="submit"]')!.textContent;
const AYUDA_PENDIENTE = "Si todavía faltan datos del turno, el aula quedará asignada y el turno seguirá Pendiente.";

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockImplementation(async (url: string) => url.includes("/opciones?") ? respuesta(aulas) : respuesta(turno()));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-15 interfaz de aula", () => {
  it("muestra aulas elegibles con nombre y capacidad, cupo y retorno al listado", async () => {
    await montar();
    expect(container.textContent).toContain("Cupo máximo: 3");
    expect([...container.querySelectorAll("#aula option")].map((opcion) => opcion.textContent)).toEqual([
      "Seleccioná un aula", "Aula 1 · Capacidad 5", "Aula 2 · Capacidad 8",
    ]);
    expect(container.querySelector(`a[href="${retorno}"]`)?.textContent).toBe("Volver al listado");
    expect(fetch.mock.calls.some(([url, init]) => url.includes("/opciones?turno_id=turno-1") && init?.cache === "no-store")).toBe(true);
    expect(boton()).toBe("Guardar aula y confirmar turno");
    expect(container.textContent).not.toContain(AYUDA_PENDIENTE);
  });

  it("sin alumnos el botón solo guarda el aula", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/opciones?") ? respuesta(aulas) : respuesta(turno({ alumnos: [], alumnos_inscriptos: "0/3" })));
    await montar();
    expect(boton()).toBe("Guardar aula");
    expect(container.textContent).toContain(AYUDA_PENDIENTE);
  });

  it("informa exactamente cuando no hay aulas activas y deshabilita el guardado", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/opciones?")
      ? respuesta(null, false, { code: "SIN_AULAS_ACTIVAS", message: "No hay aulas activas registradas" }) : respuesta(turno()));
    await montar();
    expect(container.querySelector('p[role="status"]')?.textContent).toBe("No hay aulas activas registradas");
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(patch()).toHaveLength(0);
  });

  it("distingue las aulas activas sin capacidad suficiente del caso sin aulas", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/opciones?") ? respuesta([]) : respuesta(turno()));
    await montar();
    expect(container.textContent).toContain("No hay aulas con capacidad suficiente para el cupo máximo del turno");
    expect(container.textContent).not.toContain("No hay aulas activas registradas");
  });

  it("conserva la selección y muestra el error específico de capacidad o conflicto", async () => {
    const errores = [
      { code: "AULA_CAPACIDAD_INSUFICIENTE", message: "La capacidad del aula es menor que el cupo máximo del turno" },
      { code: "AULA_NO_DISPONIBLE", message: "El aula ya tiene un turno confirmado en ese horario" },
    ];
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH"
      ? respuesta(null, false, errores.shift()) : url.includes("/opciones?") ? respuesta(aulas) : respuesta(turno()));
    await montar(); await seleccionar("aula-2");
    for (const mensaje of ["La capacidad del aula es menor que el cupo máximo del turno", "El aula ya tiene un turno confirmado en ese horario"]) {
      await guardar();
      expect(container.querySelector('p[role="alert"]')?.textContent).toBe(mensaje);
      expect((container.querySelector("#aula") as HTMLSelectElement).value).toBe("aula-2");
      expect(container.textContent).toContain("Gómez, Ana");
    }
    expect(JSON.parse(patch()[0][1].body)).toEqual({ aula_id: "aula-2" });
  });

  it("guarda y reemplaza el aula si el servidor mantiene el turno Pendiente", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_id: JSON.parse(init.body as string).aula_id, estado: "PENDIENTE", mensaje: "Aula asignada correctamente" })
      : url.includes("/opciones?") ? respuesta(aulas) : respuesta(turno({ aula_id: "aula-1", aula: "Aula 1", aula_capacidad: 5, profesor_id: null, profesor: "Sin asignar" })));
    await montar();
    expect((container.querySelector("#aula") as HTMLSelectElement).value).toBe("aula-1");
    expect(boton()).toBe("Guardar aula");
    expect(container.textContent).toContain(AYUDA_PENDIENTE);
    await seleccionar("aula-2"); await guardar();
    expect(container.textContent).toContain("Aula asignada correctamente");
    expect(container.querySelector("form")).not.toBeNull();
    expect(setDirty).toHaveBeenLastCalledWith(false);
    await seleccionar("aula-1"); await guardar();
    expect(patch()).toHaveLength(2);
    expect(JSON.parse(patch()[1][1].body)).toEqual({ aula_id: "aula-1" });
  });

  it.each(["DISPONIBLE", "COMPLETO"] as const)("confirma como %s y ofrece volver al listado actualizado", async (estado) => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_id: "aula-1", estado, mensaje: "Turno confirmado correctamente" })
      : url.includes("/opciones?") ? respuesta(aulas) : respuesta(turno()));
    await montar(); await seleccionar("aula-1"); await guardar();
    expect(container.querySelector('div[role="status"]')?.textContent).toContain("Turno confirmado correctamente");
    expect(container.querySelector('div[role="status"]')?.textContent).toContain(estado === "COMPLETO" ? "Completo" : "Disponible");
    expect(container.querySelector('div[role="status"] a[href="/turnos?pagina=2&orden=fecha_asc"]')?.textContent).toBe("Volver al listado");
    expect(container.querySelector("form")).toBeNull();
    expect(setDirty).toHaveBeenLastCalledWith(false);
  });

  it("permite reintentar una falla de carga", async () => {
    fetch.mockRejectedValueOnce(new Error("Sin conexión"));
    await montar();
    expect(container.querySelector('div[role="alert"]')?.textContent).toContain("Sin conexión");
    await act(async () => { (container.querySelector("button") as HTMLButtonElement).click(); });
    expect(container.querySelector("#aula")).not.toBeNull();
  });

  it("si el turno ya está confirmado no consulta opciones ni permite guardar", async () => {
    fetch.mockImplementation(async () => respuesta(turno({ estado: "DISPONIBLE" })));
    await montar();
    expect(container.textContent).toContain("El turno ya está confirmado.");
    expect(container.querySelector("form")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url.includes("/opciones?"))).toBe(false);
  });

  it("un aula guardada que dejó de ser elegible no marca cambios al abrir", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/opciones?") ? respuesta(aulas)
      : respuesta(turno({ aula_id: "aula-antigua", aula: "Aula antigua" })));
    await montar();
    expect(container.textContent).toContain("El aula asignada ya no está disponible para este turno.");
    expect((container.querySelector("#aula") as HTMLSelectElement).value).toBe("");
    expect(setDirty).toHaveBeenLastCalledWith(false);
  });
});
