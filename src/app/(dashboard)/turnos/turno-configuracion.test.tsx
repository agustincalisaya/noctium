// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetch, setDirty } = vi.hoisted(() => ({ fetch: vi.fn(), setDirty: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty, confirmarSalida: (salir: () => void) => salir() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => { void prefetch; return React.createElement("a", { href, ...props }, children); } };
});
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return { Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => React.createElement("button", { ...props, "data-variant": variant, "data-size": size }, children), buttonVariants: () => "" };
});
vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  return { Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props) };
});

const { TurnoConfiguracion } = await import("./turno-configuracion");
type Respuesta = { ok: boolean; json: () => Promise<unknown> };
const respuesta = (data: unknown, ok = true, error?: unknown): Respuesta => ({ ok, json: async () => ({ data, error }) });
const CONFIGURACION = {
  materias: [{ id: "materia-1", nombre: "Física", codigo: null }],
  parametros: { zona_horaria: "America/Argentina/Buenos_Aires", duracion_minutos: 60, granularidad_minutos: 30, dias_operativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"], apertura: "08:00", cierre: "20:00", anticipacion_maxima_dias: 60 },
};
const AULAS = [{ id: "aula-1", nombre: "Aula 1", capacidad: 10 }, { id: "aula-2", nombre: "Aula 2", capacidad: 30 }];
const PENDIENTE = {
  id: "turno-1", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia: "Física", materia_id: "materia-1", estado: "PENDIENTE",
  aula: "Aula 1", aula_id: "aula-1", cupo_maximo: 10, alumnos: [], profesor_id: null,
};
let root: Root;
let container: HTMLDivElement;
let rutas: (url: string, init?: RequestInit) => Respuesta | undefined;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async (id?: string) => { await act(async () => { root.render(<TurnoConfiguracion id={id} retorno="/turnos" />); }); await esperar(); };
const llamadas = (metodo: string, fin: string) => fetch.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === metodo && url.endsWith(fin));
const campo = <T extends HTMLElement>(selector: string) => container.querySelector(selector) as T;
const escribir = (elemento: HTMLInputElement | HTMLSelectElement, valor: string) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), "value")!.set!.call(elemento, valor);
  elemento.dispatchEvent(new Event(elemento instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});
const completarConfiguracion = async () => {
  await escribir(campo<HTMLInputElement>("#fecha"), "2026-10-01");
  await escribir(campo<HTMLSelectElement>("#hora"), "10:00");
  await escribir(campo<HTMLSelectElement>("#materia"), "materia-1");
};
const enviar = async () => { await act(async () => { campo<HTMLFormElement>("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); await esperar(); };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T15:00:00.000Z"));
  rutas = () => undefined;
  fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const propia = rutas(url, init);
    if (propia) return propia;
    if (url === "/api/turnos/configuracion") return respuesta(CONFIGURACION);
    if (url.startsWith("/api/turnos/aula/opciones")) return respuesta(AULAS);
    if (url === "/api/turnos" && init?.method === "POST") return respuesta({ id: "turno-nuevo", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", cupo_maximo: null, estado: "PENDIENTE" });
    if (url.endsWith("/aula") && init?.method === "PATCH") {
      const aula = AULAS.find(({ id }) => id === JSON.parse(String(init.body)).aula_id)!;
      return respuesta({ id: "turno-nuevo", aula_id: aula.id, cupo_maximo: aula.capacidad, estado: "PENDIENTE" });
    }
    if (url === "/api/turnos/turno-1") return respuesta(PENDIENTE);
    if (url.endsWith("/configuracion") && init?.method === "PATCH") return respuesta({ id: "turno-1", cupo_maximo: 10, profesor_desasignado: false });
    return respuesta(null, false, { message: `sin ruta: ${url}` });
  });
  window.history.replaceState(null, "", "/turnos/nuevo");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

describe("HU-C-03 + HU-C-15 pantalla fusionada (Revisión 3)", () => {
  it("no pide cupo; el aula se habilita al completar fecha, hora y materia y fija el cupo", async () => {
    await montar();
    expect(container.querySelector("#cupo")).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/turnos/aula/opciones");
    const seccion = campo<HTMLFieldSetElement>("fieldset");
    expect(seccion.disabled).toBe(true);
    expect(container.textContent).toContain("Completá fecha, hora y materia para elegir el aula.");
    await completarConfiguracion();
    expect(seccion.disabled).toBe(false);
    expect(container.textContent).toContain("Cupo máximo: —");
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-1");
    expect(container.textContent).toContain("Cupo máximo: 10 alumnos");
    expect(setDirty).toHaveBeenLastCalledWith(true);
  });

  it("con aula: crea el turno sin cupo, después asigna el aula y ofrece continuar con profesor y alumnos", async () => {
    await montar();
    await completarConfiguracion();
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-1");
    expect(campo<HTMLButtonElement>('button[type="submit"]').textContent).toBe("Guardar turno");
    await enviar();
    const [post] = llamadas("POST", "/api/turnos");
    expect(JSON.parse(String(post![1].body))).toEqual({ fecha: "2026-10-01", hora_inicio: "10:00", materia_id: "materia-1" });
    const [patch] = llamadas("PATCH", "/api/turnos/turno-nuevo/aula");
    expect(JSON.parse(String(patch![1].body))).toEqual({ aula_id: "aula-1" });
    expect(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(post!)]).toBeLessThan(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(patch!)]);
    expect(container.textContent).toContain("Turno configurado");
    expect(container.textContent).toContain("2026-10-01 · 10:00–11:00 · Aula 1 · Cupo máximo: 10 · Pendiente");
    expect(campo<HTMLAnchorElement>('a[href="/turnos/turno-nuevo/participantes?volver=%2Fturnos"]').textContent).toBe("Continuar con profesor y alumnos");
  });

  it("sin aula: solo crea el turno, queda Pendiente sin cupo y ofrece asignar el aula", async () => {
    await montar();
    await completarConfiguracion();
    await enviar();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    expect(container.textContent).toContain("Sin aula asignada · Pendiente");
    expect(container.textContent).toContain("Asigná un aula para poder continuar con profesor y alumnos.");
    expect(container.querySelector('a[href*="/participantes"]')).toBeNull();
    await act(async () => { [...container.querySelectorAll("button")].find((boton) => boton.textContent === "Asignar aula ahora")!.click(); });
    expect(campo<HTMLSelectElement>("#aula").value).toBe("");
    expect(campo<HTMLButtonElement>('button[type="submit"]').textContent).toBe("Guardar cambios");
  });

  it("si el aula falla después de crear el turno, no lo vuelve a crear y reintenta solo el aula", async () => {
    let falla = true;
    rutas = (url, init) => {
      if (falla && url.endsWith("/aula") && init?.method === "PATCH") { falla = false; return respuesta(null, false, { code: "AULA_NO_DISPONIBLE", message: "El aula ya tiene un turno confirmado en ese horario" }); }
      return undefined;
    };
    await montar();
    await completarConfiguracion();
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-1");
    await enviar();
    expect(container.textContent).toContain("El aula ya tiene un turno confirmado en ese horario");
    expect(container.textContent).toContain("El turno ya quedó guardado como Pendiente, sin aula.");
    expect(window.location.pathname).toBe("/turnos/turno-nuevo/configuracion");
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-2");
    await enviar();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(llamadas("PATCH", "/configuracion")).toHaveLength(0);
    expect(llamadas("PATCH", "/api/turnos/turno-nuevo/aula").map(([, init]) => JSON.parse(String(init.body)).aula_id)).toEqual(["aula-1", "aula-2"]);
    expect(container.textContent).toContain("Aula 2 · Cupo máximo: 30");
  });

  it("en edición precarga el aula y un cambio solo de aula no reenvía la configuración", async () => {
    await montar("turno-1");
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/turnos/aula/opciones?turno_id=turno-1");
    expect(campo<HTMLSelectElement>("#aula").value).toBe("aula-1");
    expect(container.textContent).toContain("Cupo máximo: 10 alumnos");
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-2");
    await enviar();
    expect(llamadas("PATCH", "/configuracion")).toHaveLength(0);
    expect(llamadas("PATCH", "/api/turnos/turno-1/aula")).toHaveLength(1);
    expect(container.textContent).toContain("Configuración actualizada");
    expect(container.textContent).toContain("Aula 2 · Cupo máximo: 30");
  });

  it("sin aulas activas permite guardar el turno igual", async () => {
    rutas = (url) => url.startsWith("/api/turnos/aula/opciones") ? respuesta(null, false, { code: "SIN_AULAS_ACTIVAS", message: "No hay aulas activas registradas" }) : undefined;
    await montar();
    await completarConfiguracion();
    expect(container.textContent).toContain("No hay aulas activas registradas. Podés guardar el turno sin aula y asignarla más tarde.");
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
  });
});
