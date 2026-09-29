// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { fetch, setDirty } = vi.hoisted(() => ({ fetch: vi.fn(), setDirty: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty, confirmarSalida: (salir: () => void) => salir() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, prefetch, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean }) => { void prefetch; return React.createElement("a", { href, ...props }, children); } };
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
  parametros: { zona_horaria: "America/Argentina/Buenos_Aires", duraciones_permitidas_minutos: [60, 120, 180], granularidad_minutos: 30, dias_operativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"], apertura: "08:00", cierre: "20:00", anticipacion_maxima_dias: 60 },
};
const AULAS = [{ id: "aula-1", nombre: "Aula 1", capacidad: 10 }, { id: "aula-2", nombre: "Aula 2", capacidad: 30 }];
const PENDIENTE = {
  id: "turno-1", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", duracion_minutos: 60, materia: "Física", materia_id: "materia-1", estado: "PENDIENTE",
  aula: "Aula 1", aula_id: "aula-1", cupo_maximo: 10, alumnos: [], profesor_id: null,
};
let root: Root;
let container: HTMLDivElement;
let rutas: (url: string, init?: RequestInit) => Respuesta | Promise<Respuesta> | undefined;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async (id?: string) => { await act(async () => { root.render(<TurnoConfiguracion id={id} retorno="/turnos" />); }); await esperar(); };
const llamadas = (metodo: string, fin: string) => fetch.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === metodo && url.endsWith(fin));
const campo = <T extends HTMLElement>(selector: string) => container.querySelector(selector) as T;
const escribir = (elemento: HTMLInputElement | HTMLSelectElement, valor: string) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), "value")!.set!.call(elemento, valor);
  elemento.dispatchEvent(new Event(elemento instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});
const duracion = (minutos: number) => campo<HTMLInputElement>(`input[name="duracion_min"][value="${minutos}"]`);
const elegirDuracion = (minutos: number) => act(async () => { duracion(minutos).click(); });
const horasOfrecidas = () => [...campo<HTMLSelectElement>("#hora").options].map(({ value }) => value).filter(Boolean);
const completarConfiguracion = async () => {
  await escribir(campo<HTMLInputElement>("#fecha"), "2026-10-01");
  await elegirDuracion(60);
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
  it("en alta carga configuración sin consultar ni ofrecer aulas antes del POST", async () => {
    await montar();
    expect(container.querySelector("#cupo")).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/turnos/configuracion"]);
    expect(campo<HTMLSelectElement>("#aula")).toBeNull();
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    await completarConfiguracion();
    expect(campo<HTMLSelectElement>("#aula")).toBeNull();
    expect(container.textContent).not.toContain("Cupo máximo:");
    expect(fetch.mock.calls.some(([url]) => url.includes("/aula/opciones"))).toBe(false);
    expect(setDirty).toHaveBeenLastCalledWith(true);
  });

  it("crea el PENDIENTE, consulta aulas filtradas y solo en otro guardado asigna aula", async () => {
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-nuevo" ? respuesta([AULAS[1]]) : undefined;
    await montar();
    await completarConfiguracion();
    expect(campo<HTMLButtonElement>('button[type="submit"]').textContent).toBe("Guardar turno");
    await enviar();
    const [post] = llamadas("POST", "/api/turnos");
    expect(JSON.parse(String(post![1].body))).toEqual({ fecha: "2026-10-01", duracion_min: 60, hora_inicio: "10:00", materia_id: "materia-1" });
    const [get] = llamadas("GET", "/api/turnos/aula/opciones?turno_id=turno-nuevo");
    expect(get).toBeDefined();
    expect(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(post!)]).toBeLessThan(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(get!)]);
    expect(llamadas("PATCH", "/api/turnos/turno-nuevo/aula")).toHaveLength(0);
    expect(campo<HTMLSelectElement>("#aula").options[1]!.textContent).toBe("Aula 2 · Capacidad 30");
    expect(container.textContent).not.toContain("Aula 1 · Capacidad 10");
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-2");
    expect(container.textContent).toContain("Cupo máximo: 30 alumnos");
    await enviar();
    const [patch] = llamadas("PATCH", "/api/turnos/turno-nuevo/aula");
    expect(JSON.parse(String(patch![1].body))).toEqual({ aula_id: "aula-2" });
    expect(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(get!)]).toBeLessThan(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(patch!)]);
    expect(container.textContent).toContain("Turno configurado");
    expect(container.textContent).toContain("2026-10-01 · 10:00–11:00 · Aula 2 · Cupo máximo: 30 · Pendiente");
    expect(campo<HTMLAnchorElement>('a[href="/turnos/turno-nuevo/participantes?volver=%2Fturnos"]').textContent).toBe("Continuar con profesor y alumnos");
  });

  it("permite dejar sin aula al PENDIENTE ya creado y retomar la selección", async () => {
    await montar();
    await completarConfiguracion();
    await enviar();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    await act(async () => { [...container.querySelectorAll("button")].find((boton) => boton.textContent === "Dejar sin aula por ahora")!.click(); });
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
    await enviar();
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-1");
    await enviar();
    expect(container.textContent).toContain("El aula ya tiene un turno confirmado en ese horario");
    expect(container.textContent).toContain("El turno ya quedó guardado como Pendiente, sin aula.");
    expect(window.location.pathname).toBe("/turnos/turno-nuevo/configuracion");
    expect(campo<HTMLSelectElement>("#aula")).toBeDefined();
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

  it("edición con aula persistida y cambio de intervalo conserva continuación si la misma aula sigue disponible", async () => {
    let consultas = 0;
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1"
      ? respuesta(++consultas === 1 ? AULAS : [AULAS[0]]) : undefined;
    await montar("turno-1");
    await escribir(campo<HTMLSelectElement>("#hora"), "10:30");
    expect(container.querySelector("#aula")).toBeNull();
    await enviar();
    expect(consultas).toBe(2);
    expect(llamadas("PATCH", "/api/turnos/turno-1/configuracion")).toHaveLength(1);
    expect(llamadas("PATCH", "/api/turnos/turno-1/aula")).toHaveLength(0);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(container.textContent).toContain("Aula 1 · Cupo máximo: 10");
    expect(campo<HTMLAnchorElement>('a[href="/turnos/turno-1/participantes?volver=%2Fturnos"]').textContent).toBe("Continuar con profesor y alumnos");
  });

  it("edición exige reemplazar el aula persistida si desaparece tras cambiar el intervalo", async () => {
    let consultas = 0;
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1"
      ? respuesta(++consultas === 1 ? AULAS : [AULAS[1]]) : undefined;
    await montar("turno-1");
    await escribir(campo<HTMLSelectElement>("#hora"), "10:30");
    await enviar();
    expect(campo<HTMLSelectElement>("#aula").value).toBe("");
    expect(container.textContent).not.toContain("Aula 1 · Capacidad 10");
    expect(container.querySelector('a[href*="/participantes"]')).toBeNull();
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    expect(llamadas("PATCH", "/api/turnos/turno-1/aula")).toHaveLength(0);
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-2");
    await enviar();
    const [patchAula] = llamadas("PATCH", "/api/turnos/turno-1/aula");
    expect(JSON.parse(String(patchAula![1].body))).toEqual({ aula_id: "aula-2" });
    expect(llamadas("PATCH", "/api/turnos/turno-1/configuracion")).toHaveLength(1);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(container.querySelector('a[href*="/participantes"]')).not.toBeNull();
  });

  it("si falla PATCH de configuración conserva el id y no consulta aulas para el intervalo sin guardar", async () => {
    rutas = (url, init) => url === "/api/turnos/turno-1/configuracion" && init?.method === "PATCH"
      ? respuesta(null, false, { message: "No se pudo actualizar la configuración" }) : undefined;
    await montar("turno-1");
    await escribir(campo<HTMLSelectElement>("#hora"), "10:30");
    await enviar();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("No se pudo actualizar la configuración");
    expect(llamadas("GET", "/api/turnos/aula/opciones?turno_id=turno-1")).toHaveLength(1);
    expect(container.querySelector("#aula")).toBeNull();
    expect(container.querySelector('a[href*="/participantes"]')).toBeNull();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(campo<HTMLButtonElement>('button[type="submit"]').textContent).toBe("Guardar cambios");
  });

  it("un segundo envío mientras el POST sigue pendiente no crea otro turno", async () => {
    let resolverPost: (valor: Respuesta) => void = () => {};
    rutas = (url, init) => url === "/api/turnos" && init?.method === "POST"
      ? new Promise<Respuesta>((resolve) => { resolverPost = resolve; }) : undefined;
    await montar();
    await completarConfiguracion();
    act(() => {
      const formulario = campo<HTMLFormElement>("form");
      formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    await act(async () => { resolverPost(respuesta({ id: "turno-nuevo" })); });
    await esperar();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(llamadas("GET", "/api/turnos/aula/opciones?turno_id=turno-nuevo")).toHaveLength(1);
  });

  it("sin aulas activas permite guardar el turno igual", async () => {
    rutas = (url) => url.startsWith("/api/turnos/aula/opciones") ? respuesta(null, false, { code: "SIN_AULAS_ACTIVAS", message: "No hay aulas activas registradas" }) : undefined;
    await montar();
    await completarConfiguracion();
    expect(container.textContent).not.toContain("No hay aulas activas registradas");
    await enviar();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("No hay aulas activas registradas. Podés guardar el turno sin aula y asignarla más tarde.");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    expect([...container.querySelectorAll("button")].some((boton) => boton.textContent === "Dejar sin aula por ahora")).toBe(true);
  });

  it("data: [] muestra el mensaje contractual de disponibilidad sin confundirlo con SIN_AULAS_ACTIVAS", async () => {
    rutas = (url) => url.startsWith("/api/turnos/aula/opciones") ? respuesta([]) : undefined;
    await montar();
    await completarConfiguracion();
    await enviar();
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/turnos/aula/opciones?turno_id=turno-nuevo");
    expect([...container.querySelectorAll('[role="status"]')].some((elemento) => elemento.textContent === "No hay aulas disponibles para este horario")).toBe(true);
    expect(container.textContent).not.toContain("No hay aulas activas registradas");
    expect(campo<HTMLSelectElement>("#aula")).toBeNull();
    expect([...container.querySelectorAll("button")].some((boton) => boton.textContent === "Reintentar")).toBe(true);
  });

  it("distingue la carga de aulas del resultado vacío tras crear el turno", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-nuevo"
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar();
    await completarConfiguracion();
    await enviar();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Cargando aulas disponibles");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    expect(container.querySelector("#aula")).toBeNull();
    await act(async () => { resolver(respuesta([])); });
    expect([...container.querySelectorAll('[role="status"]')].some((elemento) => elemento.textContent === "No hay aulas disponibles para este horario")).toBe(true);
  });

  it.each([
    ["fecha", "2026-10-02"],
    ["hora", "10:30"],
    ["duracion", "120"],
  ])("al cambiar %s oculta las aulas anteriores y recarga tras guardar el intervalo", async (campoEditado, valor) => {
    let consultas = 0;
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-nuevo"
      ? respuesta(++consultas === 1 ? AULAS : [AULAS[1]]) : undefined;
    await montar();
    await completarConfiguracion();
    await enviar();
    await escribir(campo<HTMLSelectElement>("#aula"), "aula-1");
    if (campoEditado === "fecha") await escribir(container.querySelector<HTMLInputElement>("#fecha")!, valor);
    if (campoEditado === "hora") await escribir(container.querySelector<HTMLSelectElement>("#hora")!, valor);
    if (campoEditado === "duracion") await elegirDuracion(Number(valor));
    expect(container.querySelector("#aula")).toBeNull();
    expect(container.textContent).not.toContain("Aula 1 · Capacidad 10");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    await enviar();
    const [patchConfiguracion] = llamadas("PATCH", "/api/turnos/turno-nuevo/configuracion");
    const gets = llamadas("GET", "/api/turnos/aula/opciones?turno_id=turno-nuevo");
    expect(patchConfiguracion).toBeDefined();
    expect(gets).toHaveLength(2);
    expect(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(patchConfiguracion!)]).toBeLessThan(fetch.mock.invocationCallOrder[fetch.mock.calls.indexOf(gets[1]!)]);
    expect(llamadas("PATCH", "/api/turnos/turno-nuevo/aula")).toHaveLength(0);
    expect(campo<HTMLSelectElement>("#aula").options[1]!.textContent).toBe("Aula 2 · Capacidad 30");
  });

  it("separa el error HTTP de una respuesta vacía y permite reintentar con el id", async () => {
    let falla = true;
    rutas = (url) => {
      if (url !== "/api/turnos/aula/opciones?turno_id=turno-nuevo") return undefined;
      if (falla) { falla = false; return respuesta(null, false, { message: "Falló la carga de aulas" }); }
      return respuesta(AULAS);
    };
    await montar();
    await completarConfiguracion();
    await enviar();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló la carga de aulas");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    expect(container.querySelector("#aula")).toBeNull();
    await act(async () => { [...container.querySelectorAll("button")].find((boton) => boton.textContent === "Reintentar")!.click(); });
    await esperar();
    expect(llamadas("GET", "/api/turnos/aula/opciones?turno_id=turno-nuevo")).toHaveLength(2);
    expect(campo<HTMLSelectElement>("#aula")).toBeDefined();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
  });
});

describe("HU-C-03 Revisión 4: duración configurable", () => {
  it("no preselecciona duración y no permite guardar hasta elegir una", async () => {
    await montar();
    expect([60, 120, 180].map((minutos) => duracion(minutos).checked)).toEqual([false, false, false]);
    expect(container.textContent).toContain("1 hora");
    expect(container.textContent).toContain("3 horas");
    await escribir(campo<HTMLInputElement>("#fecha"), "2026-10-01");
    await escribir(campo<HTMLSelectElement>("#hora"), "10:00");
    await escribir(campo<HTMLSelectElement>("#materia"), "materia-1");
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    expect(container.querySelector('fieldset[aria-describedby="aula-ayuda"]')).toBeNull();
    expect(container.textContent).toContain("Hora de finalización: —");
    await elegirDuracion(120);
    expect(container.textContent).toContain("Hora de finalización: 12:00");
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
    await enviar();
    expect(JSON.parse(String(llamadas("POST", "/api/turnos")[0]![1].body))).toMatchObject({ duracion_min: 120 });
  });

  it("las horas de inicio dependen de la duración y una hora que deja de entrar se limpia con aviso", async () => {
    await montar();
    await escribir(campo<HTMLInputElement>("#fecha"), "2026-10-01");
    await elegirDuracion(60);
    expect(horasOfrecidas().at(-1)).toBe("19:00");
    await escribir(campo<HTMLSelectElement>("#hora"), "18:00");
    await elegirDuracion(180);
    expect(horasOfrecidas().at(-1)).toBe("17:00");
    expect(campo<HTMLSelectElement>("#hora").value).toBe("");
    expect(container.textContent).toContain("La hora anterior ya no es válida para esta duración. Elegí otra.");
    await escribir(campo<HTMLSelectElement>("#hora"), "17:00");
    await elegirDuracion(120);
    expect(campo<HTMLSelectElement>("#hora").value).toBe("17:00");
    expect(container.textContent).toContain("Hora de finalización: 19:00");
  });

  it("en edición precarga la duración guardada (2h) y un cambio solo de duración reenvía la configuración", async () => {
    rutas = (url, init) => {
      if (url === "/api/turnos/turno-1") return respuesta({ ...PENDIENTE, hora_fin: "12:00", duracion_minutos: 120 });
      if (url.endsWith("/configuracion") && init?.method === "PATCH") return respuesta({ id: "turno-1", hora_fin: "13:00", duracion_min: 180, cupo_maximo: 10, profesor_desasignado: false });
      return undefined;
    };
    await montar("turno-1");
    expect(duracion(120).checked).toBe(true);
    expect(container.textContent).toContain("Hora de finalización: 12:00");
    expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    await elegirDuracion(180);
    await enviar();
    const [patch] = llamadas("PATCH", "/api/turnos/turno-1/configuracion");
    expect(JSON.parse(String(patch![1].body))).toEqual({ fecha: "2026-10-01", duracion_min: 180, hora_inicio: "10:00", materia_id: "materia-1" });
    expect(llamadas("GET", "/api/turnos/aula/opciones?turno_id=turno-1")).toHaveLength(2);
    expect(container.textContent).toContain("2026-10-01 · 10:00–13:00 · Aula 1");
    expect(container.querySelector('a[href*="/participantes"]')).not.toBeNull();
  });
});
