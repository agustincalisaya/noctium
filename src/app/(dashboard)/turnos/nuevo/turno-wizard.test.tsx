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
  return { LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});

const { default: NuevoTurnoPage } = await import("./page");
const materias = [{ id: "materia-1", nombre: "Física", codigo: "FIS" }, { id: "materia-2", nombre: "Matemática", codigo: null }];
const profesores = [{ id: "profesor-1", nombre: "Ana", apellido: "Pérez" }, { id: "profesor-2", nombre: "Luis", apellido: "Gómez" }];
const fechas = [{ fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [
  { hora_inicio: "09:00", hora_fin: "12:00", tramos_libres: [{ desde: "09:00", hasta: "12:00" }], inicios: ["10:00", "10:30"] },
] }];
type Respuesta = { ok: boolean; json: () => Promise<unknown> };
const respuesta = (data: unknown, ok = true, error: unknown = null): Respuesta => ({ ok, json: async () => ({ data, error }) });

let root: Root;
let container: HTMLDivElement;
let rutas: (url: string, init?: RequestInit) => Respuesta | Promise<Respuesta> | undefined;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const montar = async () => { await act(async () => { root.render(<NuevoTurnoPage />); }); await esperar(); };
const boton = (texto: string) => [...container.querySelectorAll("button")].find((elemento) => elemento.textContent?.trim() === texto)!;
const pulsar = async (elemento: Element) => { await act(async () => { (elemento as HTMLElement).click(); }); };
const llamadas = (metodo: string, fragmento: string) => fetch.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === metodo && url.includes(fragmento));
const seleccionarMateria = async (id = "materia-1") => pulsar(container.querySelector(`input[name="materia_turno"][value="${id}"]`)!);
const seleccionarProfesor = async (id = "profesor-1") => pulsar(container.querySelector(`input[name="profesor_turno"][value="${id}"]`)!);
const irAProfesor = async () => { await seleccionarMateria(); await pulsar(boton("Continuar")); };
const irAFecha = async () => { await irAProfesor(); await seleccionarProfesor(); await pulsar(boton("Continuar")); };
const elegirHorario = async () => {
  await pulsar(container.querySelector('input[name="duracion_min"][value="60"]')!);
  await pulsar(boton("2026-10-01 · JUEVES"));
  await pulsar(boton("10:00"));
};
const crearTurno = async () => { await irAFecha(); await elegirHorario(); await pulsar(boton("Continuar a aula")); };

beforeEach(() => {
  vi.clearAllMocks();
  rutas = () => undefined;
  fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const propia = rutas(url, init);
    if (propia) return propia;
    if (url === "/api/turnos/configuracion") return respuesta({ materias, parametros: { duraciones_permitidas_minutos: [60, 120, 180] } });
    if (url === "/api/turnos/profesores/por-materia?materia_id=materia-1") return respuesta(profesores);
    if (url === "/api/turnos/profesores/por-materia?materia_id=materia-2") return respuesta([profesores[1]]);
    if (url.includes("/disponibilidad?")) return respuesta({ fechas });
    if (url === "/api/turnos" && init?.method === "POST") return respuesta({ id: "turno-1", estado: "PENDIENTE" });
    if (url === "/api/turnos/turno-1/configuracion" && init?.method === "PATCH") return respuesta({ id: "turno-1", estado: "PENDIENTE" });
    return respuesta(null, false, { message: `Ruta inesperada: ${url}` });
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-18 etapa 3: Materia, Profesor, Fecha y horario", () => {
  it("muestra los cinco pasos y carga Materia y duraciones desde configuración", async () => {
    await montar();
    expect(container.querySelector("h1")?.textContent).toBe("Nuevo turno");
    expect([...container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')].map((paso) => paso.textContent?.trim()))
      .toEqual(["1.Materia", "2.Profesor", "3.Fecha y horario", "4.Aula", "5.Alumnos"]);
    expect(container.querySelector("h2#titulo-paso-materia")?.textContent).toBe("Elegí una materia");
    expect(boton("Continuar").disabled).toBe(true);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/turnos/configuracion", { cache: "no-store" });
    expect(container.querySelector("aside")?.textContent).toContain("Sin elegir");
  });

  it("Materia avanza a Profesor sin persistir; por-materia muestra solo las opciones recibidas", async () => {
    rutas = (url) => url.endsWith("por-materia?materia_id=materia-1") ? respuesta([profesores[0]]) : undefined;
    await montar();
    await irAProfesor();
    expect(llamadas("GET", "por-materia?materia_id=materia-1")).toHaveLength(1);
    expect(container.querySelector('input[value="profesor-1"]')).not.toBeNull();
    expect(container.querySelector('input[value="profesor-2"]')).toBeNull();
    expect(container.querySelector("aside")?.textContent).toContain("Física");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(llamadas("GET", "profesores/opciones?turno_id=")).toHaveLength(0);
  });

  it("Profesor distingue carga y lista vacía contractual", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url) => url.endsWith("por-materia?materia_id=materia-1")
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar();
    await seleccionarMateria();
    await pulsar(boton("Continuar"));
    expect(container.textContent).toContain("Cargando profesores");
    await act(async () => { resolver(respuesta(null, false, { code: "SIN_PROFESORES_PARA_MATERIA", message: "No hay profesores asociados a esta materia" })); });
    expect(container.textContent).toContain("No hay profesores asociados a esta materia");
    expect(boton("Continuar").disabled).toBe(true);
  });

  it("Profesor muestra error de carga y permite reintentar", async () => {
    let falla = true;
    rutas = (url) => url.endsWith("por-materia?materia_id=materia-1") && falla
      ? (falla = false, respuesta(null, false, { message: "Falló la consulta" })) : undefined;
    await montar(); await irAProfesor();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló la consulta");
    expect(boton("Continuar").disabled).toBe(true);
    await pulsar(boton("Reintentar"));
    expect(container.querySelector('input[name="profesor_turno"][value="profesor-1"]')).not.toBeNull();
  });

  it("selecciona Profesor y muestra la disponibilidad real tras elegir duración, sin persistencia temprana", async () => {
    await montar();
    await irAFecha();
    expect(container.querySelector("aside")?.textContent).toContain("Pérez, Ana");
    expect([...container.querySelectorAll('input[name="duracion_min"]')].map((elemento) => (elemento as HTMLInputElement).value)).toEqual(["60", "120", "180"]);
    expect(llamadas("GET", "/disponibilidad?")).toHaveLength(0);
    await pulsar(container.querySelector('input[name="duracion_min"][value="60"]')!);
    expect(llamadas("GET", "/api/turnos/profesores/profesor-1/disponibilidad?materia_id=materia-1&duracion_min=60")).toHaveLength(1);
    await pulsar(boton("2026-10-01 · JUEVES"));
    expect(boton("10:00")).toBeDefined();
    await pulsar(boton("10:00"));
    expect(container.querySelector("aside")?.textContent).toContain("2026-10-01 · 10:00 · 1 h");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
  });

  it("confirma paso 3 con un único POST contractual y avanza a Aula con PENDIENTE", async () => {
    await montar();
    await crearTurno();
    const [post] = llamadas("POST", "/api/turnos");
    expect(JSON.parse(String(post![1].body))).toEqual({ materia_id: "materia-1", profesor_id: "profesor-1", fecha: "2026-10-01", hora_inicio: "10:00", duracion_min: 60 });
    expect(container.querySelector("h2#titulo-paso-pendiente")?.textContent).toBe("Elegí un aula");
    expect(container.textContent).toContain("La configuración quedó guardada como Pendiente");
    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(llamadas("PATCH", "/aula")).toHaveLength(0);
    expect(llamadas("PATCH", "/participantes")).toHaveLength(0);
  });

  it("Atrás conserva Materia, Profesor y horario mientras no se cambien", async () => {
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás"));
    expect(container.querySelector<HTMLInputElement>('input[value="profesor-1"]')?.checked).toBe(true);
    await pulsar(boton("Atrás"));
    expect(container.querySelector<HTMLInputElement>('input[value="materia-1"]')?.checked).toBe(true);
    await pulsar(boton("Continuar")); await pulsar(boton("Continuar"));
    expect(container.querySelector<HTMLInputElement>('input[name="duracion_min"][value="60"]')?.checked).toBe(true);
    expect(boton("10:00").getAttribute("aria-pressed")).toBe("true");
  });

  it("cambiar Profesor conserva duración, limpia fecha/hora y consulta al nuevo profesor", async () => {
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás"));
    await seleccionarProfesor("profesor-2");
    expect(container.querySelector("aside")?.textContent).not.toContain("2026-10-01 · 10:00");
    await pulsar(boton("Continuar"));
    expect(container.querySelector<HTMLInputElement>('input[name="duracion_min"][value="60"]')?.checked).toBe(true);
    expect(llamadas("GET", "/api/turnos/profesores/profesor-2/disponibilidad?materia_id=materia-1&duracion_min=60")).toHaveLength(1);
    expect(boton("Continuar a aula").disabled).toBe(true);
  });

  it("cambiar Materia limpia Profesor y horario si ya no figura en por-materia", async () => {
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await seleccionarMateria("materia-2");
    await pulsar(boton("Continuar"));
    expect(llamadas("GET", "por-materia?materia_id=materia-2")).toHaveLength(1);
    expect(boton("Continuar").disabled).toBe(true);
    expect(container.querySelector("aside")?.textContent).not.toContain("2026-10-01 · 10:00");
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-2"]')?.checked).toBe(false);
  });

  it("cambiar Materia conserva profesor y horario solo tras revalidar los inicios del servidor", async () => {
    rutas = (url) => url.endsWith("por-materia?materia_id=materia-2") ? respuesta([profesores[0]]) : undefined;
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await seleccionarMateria("materia-2");
    await pulsar(boton("Continuar"));
    expect(llamadas("GET", "/api/turnos/profesores/profesor-1/disponibilidad?materia_id=materia-2&duracion_min=60")).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-1"]')?.checked).toBe(true);
    await pulsar(boton("Continuar"));
    expect(boton("10:00").getAttribute("aria-pressed")).toBe("true");
  });

  it("cambiar Materia limpia fecha/hora si la nueva disponibilidad ya no las ofrece", async () => {
    rutas = (url) => url.endsWith("por-materia?materia_id=materia-2") ? respuesta([profesores[0]])
      : url.includes("profesor-1/disponibilidad?materia_id=materia-2") ? respuesta({ fechas: [] }) : undefined;
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await seleccionarMateria("materia-2");
    await pulsar(boton("Continuar"));
    expect(container.querySelector("aside")?.textContent).not.toContain("2026-10-01 · 10:00");
  });

  it("tras volver desde Aula confirma paso 3 mediante PATCH, sin otro POST", async () => {
    await montar(); await crearTurno();
    await pulsar(boton("Atrás"));
    await pulsar(boton("10:30"));
    expect(setDirty).toHaveBeenLastCalledWith(true);
    await pulsar(boton("Continuar a aula"));
    const [patch] = llamadas("PATCH", "/api/turnos/turno-1/configuracion");
    expect(JSON.parse(String(patch![1].body))).toEqual({ materia_id: "materia-1", profesor_id: "profesor-1", fecha: "2026-10-01", hora_inicio: "10:30", duracion_min: 60 });
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(container.querySelector("h2#titulo-paso-pendiente")?.textContent).toBe("Elegí un aula");
  });

  it.each(["POST", "PATCH"])("si falla %s permanece en Fecha/Horario con la selección", async (metodo) => {
    let falla = true;
    rutas = (url, init) => init?.method === metodo && (url === "/api/turnos" || url.endsWith("/configuracion")) && falla
      ? (falla = false, respuesta(null, false, { message: "No se pudo guardar" })) : undefined;
    await montar();
    if (metodo === "PATCH") { await crearTurno(); await pulsar(boton("Atrás")); }
    else { await irAFecha(); await elegirHorario(); }
    await pulsar(boton("Continuar a aula"));
    expect(container.textContent).toContain("No se pudo guardar");
    expect(container.querySelector("h2#titulo-fecha-horario")).not.toBeNull();
    expect(boton("10:00").getAttribute("aria-pressed")).toBe("true");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
  });

  it.each(["POST", "PATCH"])("no duplica %s con dos envíos mientras la petición sigue pendiente", async (metodo) => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url, init) => init?.method === metodo && (url === "/api/turnos" || url.endsWith("/configuracion"))
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar();
    if (metodo === "PATCH") {
      rutas = () => undefined; await crearTurno(); await pulsar(boton("Atrás"));
      rutas = (url, init) => init?.method === "PATCH" && url.endsWith("/configuracion")
        ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    } else { await irAFecha(); await elegirHorario(); }
    act(() => { boton("Continuar a aula").click(); boton("Continuar a aula").click(); });
    expect(llamadas(metodo, metodo === "POST" ? "/api/turnos" : "/configuracion")).toHaveLength(1);
    await act(async () => { resolver(respuesta({ id: "turno-1", estado: "PENDIENTE" })); });
    await esperar();
    expect(container.querySelector("h2#titulo-paso-pendiente")?.textContent).toBe("Elegí un aula");
  });
});
