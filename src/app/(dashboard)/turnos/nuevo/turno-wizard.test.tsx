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

describe("HU-C-18 etapa 5: Aula", () => {
  it("muestra solo opciones del GET con turno_id, nombre y capacidad; no persiste selección antes de continuar", async () => {
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1" ? respuesta([aulas[0]]) : undefined;
    await montar(); await crearTurno();
    expect(container.querySelector("select#aula")?.textContent).toContain("Aula 1 · Capacidad 20");
    expect(container.querySelector("select#aula")?.textContent).not.toContain("Aula 2");
    expect(boton("Continuar a alumnos").disabled).toBe(true);
    await seleccionarAula();
    expect(container.querySelector("aside")?.textContent).toContain("AULASin elegir");
    expect(llamadas("PATCH", "/aula")).toHaveLength(0);
  });

  it("data: [] muestra mensaje exacto y permite volver a Fecha/Horario", async () => {
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1" ? respuesta([]) : undefined;
    await montar(); await crearTurno();
    expect([...container.querySelectorAll('[role="status"]')].some((nodo) => nodo.textContent === "No hay aulas disponibles para este horario")).toBe(true);
    expect(boton("Continuar a alumnos").disabled).toBe(true);
    await pulsar(boton("Volver a fecha y horario"));
    expect(container.querySelector("h2#titulo-fecha-horario")).not.toBeNull();
    expect(llamadas("PATCH", "/aula")).toHaveLength(0);
  });

  it("loading, SIN_AULAS_ACTIVAS y error HTTP son estados distintos del vacío", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1"
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar(); await crearTurno();
    expect(container.textContent).toContain("Cargando aulas disponibles");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    await act(async () => { resolver(respuesta(null, false, { code: "SIN_AULAS_ACTIVAS", message: "Sin aulas" })); });
    expect(container.textContent).toContain("No hay aulas activas registradas.");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1"
      ? respuesta(null, false, { code: "ERROR", message: "Falló la consulta de aulas" }) : undefined;
    await pulsar(boton("Reintentar"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló la consulta de aulas");
    expect(container.textContent).not.toContain("No hay aulas disponibles para este horario");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
  });

  it("PATCH de Aula exitoso actualiza Resumen y avanza a Alumnos; Atrás conserva el Aula", async () => {
    await montar(); await crearTurno(); await asignarAula();
    const [patch] = llamadas("PATCH", "/api/turnos/turno-1/aula");
    expect(JSON.parse(String(patch![1].body))).toEqual({ aula_id: "aula-1" });
    expect(container.querySelector("h2#titulo-paso-alumnos")?.textContent).toBe("Agregá alumnos");
    expect(container.querySelector("aside")?.textContent).toContain("AULAAula 1");
    await pulsar(boton("Atrás"));
    expect(container.querySelector<HTMLSelectElement>("select#aula")?.value).toBe("aula-1");
    await pulsar(boton("Atrás"));
    expect(container.querySelector("h2#titulo-fecha-horario")).not.toBeNull();
    expect(container.querySelector("aside")?.textContent).toContain("AULAAula 1");
    expect(llamadas("PATCH", "/aula")).toHaveLength(1);
    expect(llamadas("PATCH", "/configuracion")).toHaveLength(0);
  });

  it("PATCH de Aula fallido conserva turnoId y selección para reintento", async () => {
    let falla = true;
    rutas = (url, init) => url.endsWith("/aula") && init?.method === "PATCH" && falla
      ? (falla = false, respuesta(null, false, { message: "El aula quedó ocupada" })) : undefined;
    await montar(); await crearTurno(); await asignarAula();
    expect(container.querySelector("h2#titulo-paso-aula")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("El aula quedó ocupada");
    expect(container.querySelector<HTMLSelectElement>("select#aula")?.value).toBe("aula-1");
    await pulsar(boton("Continuar a alumnos"));
    expect(container.querySelector("h2#titulo-paso-alumnos")?.textContent).toBe("Agregá alumnos");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
  });

  it("dos clicks durante el PATCH no duplican la asignación", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url, init) => url.endsWith("/aula") && init?.method === "PATCH"
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar(); await crearTurno(); await seleccionarAula();
    act(() => { boton("Continuar a alumnos").click(); boton("Continuar a alumnos").click(); });
    expect(llamadas("PATCH", "/aula")).toHaveLength(1);
    await act(async () => { resolver(respuesta({ id: "turno-1", aula_id: "aula-1", cupo_maximo: 20 })); });
    expect(container.querySelector("h2#titulo-paso-alumnos")?.textContent).toBe("Agregá alumnos");
  });

  it.each([true, false])("reconfiguración con aula_desasignada=%s reconcilia Aula y vuelve a consultar opciones", async (desasignada) => {
    rutas = (url, init) => url.endsWith("/configuracion") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_desasignada: desasignada, cupo_maximo: desasignada ? null : 20 }) : undefined;
    await montar(); await crearTurno(); await asignarAula();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await pulsar(boton("10:30"));
    const consultasAntes = llamadas("GET", "aula/opciones?turno_id=turno-1").length;
    await pulsar(boton("Continuar a aula"));
    expect(llamadas("PATCH", "/configuracion")).toHaveLength(1);
    expect(llamadas("GET", "aula/opciones?turno_id=turno-1")).toHaveLength(consultasAntes + 1);
    expect(container.querySelector<HTMLSelectElement>("select#aula")?.value).toBe(desasignada ? "" : "aula-1");
    expect(container.querySelector("aside")?.textContent).toContain(desasignada ? "AULASin elegir" : "AULAAula 1");
    expect(llamadas("PATCH", "/aula")).toHaveLength(1);
  });

  it("si el GET posterior ya no incluye el aula anterior, no la presenta como vigente", async () => {
    let consultas = 0;
    rutas = (url, init) => url.endsWith("/configuracion") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_desasignada: false, cupo_maximo: 20 })
      : url === "/api/turnos/aula/opciones?turno_id=turno-1"
        ? respuesta(++consultas === 1 ? aulas : [aulas[1]]) : undefined;
    await montar(); await crearTurno(); await asignarAula();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await pulsar(boton("10:30")); await pulsar(boton("Continuar a aula"));
    expect(container.querySelector<HTMLSelectElement>("select#aula")?.value).toBe("");
    expect(container.querySelector("aside")?.textContent).toContain("AULASin elegir");
    expect(boton("Continuar a alumnos").disabled).toBe(true);
  });
});

describe("HU-C-18 etapa 6: Alumnos y confirmación", () => {
  it("busca en el endpoint real, agrega varios localmente y permite quitar sin PATCH temprano", async () => {
    await montar(); await crearTurno(); await asignarAula();
    expect(boton("Confirmar turno").disabled).toBe(true);
    await agregarAlumno(); await agregarAlumno(alumnos[1]);
    expect(llamadas("GET", "/api/turnos/participantes/alumnos?q=Juan")).toHaveLength(1);
    expect(container.textContent).toContain("(2/20)");
    expect(container.querySelector("aside")?.textContent).toContain("ALUMNOS2 alumnos");
    expect(llamadas("PATCH", "/participantes")).toHaveLength(0);
    await pulsar(container.querySelector('button[aria-label="Quitar a López, Juan"]')!);
    expect(container.textContent).toContain("(1/20)");
    expect(container.querySelector("aside")?.textContent).toContain("ALUMNOS1 alumno");
  });

  it("detiene la carga local al alcanzar el cupo informado por PATCH Aula", async () => {
    rutas = (url, init) => url.endsWith("/aula") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_id: "aula-1", cupo_maximo: 1, estado: "PENDIENTE" }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    expect(container.textContent).toContain("(1/1)");
    expect(container.querySelector<HTMLInputElement>("#alumno-busqueda-wizard")?.disabled).toBe(true);
    expect(container.textContent).toContain("El turno alcanzó su cupo máximo");
  });

  it("confirma con alumno_ids sin profesor_id y muestra DISPONIBLE sin repetir PATCH", async () => {
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    await pulsar(boton("Confirmar turno"));
    expect(JSON.parse(String(llamadas("PATCH", "/participantes")[0]![1].body))).toEqual({ alumno_ids: ["alumno-1"] });
    expect(container.textContent).toContain("Turno confirmado");
    expect(container.textContent).toContain("Disponible");
    expect(boton("Confirmar turno")).toBeUndefined();
    expect(llamadas("PATCH", "/participantes")).toHaveLength(1);
    expect(setDirty).toHaveBeenLastCalledWith(false);
  });

  it("usa el estado COMPLETO devuelto por backend", async () => {
    rutas = (url, init) => url.endsWith("/participantes") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", alumno_ids: ["alumno-1"], profesor_id: "profesor-1", cupo_maximo: 20, estado: "COMPLETO" }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    await pulsar(boton("Confirmar turno"));
    expect(container.textContent).toContain("Completo");
  });

  it.each(["ALUMNO_NO_DISPONIBLE", "TURNO_SIN_AULA"])("error %s conserva selección y PENDIENTE", async (codigo) => {
    rutas = (url, init) => url.endsWith("/participantes") && init?.method === "PATCH"
      ? respuesta(null, false, { code: codigo, message: codigo === "TURNO_SIN_AULA" ? "Asigná un aula antes de confirmar el turno" : "El alumno ya tiene otro turno", detalles: codigo === "ALUMNO_NO_DISPONIBLE" ? { alumno_id: "alumno-1" } : undefined }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    await pulsar(boton("Confirmar turno"));
    expect(container.querySelector("h2#titulo-paso-alumnos")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(codigo === "TURNO_SIN_AULA" ? "Asigná un aula" : "El alumno ya tiene otro turno");
    expect(container.textContent).toContain("López, Juan");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
  });

  it("doble click envía un solo PATCH de participantes", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url, init) => url.endsWith("/participantes") && init?.method === "PATCH"
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    act(() => { boton("Confirmar turno").click(); boton("Confirmar turno").click(); });
    expect(llamadas("PATCH", "/participantes")).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>("#alumno-busqueda-wizard")?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Quitar a López, Juan"]')?.disabled).toBe(true);
    await act(async () => { resolver(respuesta({ id: "turno-1", estado: "DISPONIBLE" })); });
    expect(container.textContent).toContain("Turno confirmado");
  });

  it("Atrás y cambio de Aula conservan alumnos locales sin confirmar", async () => {
    rutas = (url, init) => url.endsWith("/aula") && init?.method === "PATCH" && JSON.parse(String(init.body)).aula_id === "aula-2"
      ? respuesta({ id: "turno-1", aula_id: "aula-2", cupo_maximo: 30, estado: "PENDIENTE" }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    await pulsar(boton("Atrás"));
    expect(llamadas("PATCH", "/participantes")).toHaveLength(0);
    await seleccionarAula("aula-2");
    await pulsar(boton("Continuar a alumnos"));
    expect(container.textContent).toContain("López, Juan");
    expect(container.querySelector("aside")?.textContent).toContain("AULAAula 2");
    expect(llamadas("PATCH", "/participantes")).toHaveLength(0);
  });
});

const { default: NuevoTurnoPage } = await import("./page");
const materias = [{ id: "materia-1", nombre: "Física", codigo: "FIS" }, { id: "materia-2", nombre: "Matemática", codigo: null }];
const profesores = [{ id: "profesor-1", nombre: "Ana", apellido: "Pérez" }, { id: "profesor-2", nombre: "Luis", apellido: "Gómez" }];
const fechas = [{ fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [
  { hora_inicio: "09:00", hora_fin: "12:00", tramos_libres: [{ desde: "09:00", hasta: "12:00" }], inicios: ["10:00", "10:30"] },
] }];
const aulas = [{ id: "aula-1", nombre: "Aula 1", capacidad: 20 }, { id: "aula-2", nombre: "Aula 2", capacidad: 30 }];
const alumnos = [{ id: "alumno-1", nombre: "Juan", apellido: "López", dni: "30123456" }, { id: "alumno-2", nombre: "Ana", apellido: "Paz", dni: "30987654" }];
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
const seleccionarAula = async (id = "aula-1") => { await act(async () => {
  const select = container.querySelector<HTMLSelectElement>("select#aula")!;
  select.value = id;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}); };
const asignarAula = async () => { await seleccionarAula(); await pulsar(boton("Continuar a alumnos")); };
const buscarAlumno = async (texto: string) => {
  const input = container.querySelector<HTMLInputElement>("#alumno-busqueda-wizard")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, texto); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 280)); });
};
const agregarAlumno = async (alumno = alumnos[0]) => { await buscarAlumno(alumno.nombre); await pulsar(boton(`${alumno.apellido}, ${alumno.nombre} · DNI ${alumno.dni}`)); };

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
    if (url === "/api/turnos/turno-1/configuracion" && init?.method === "PATCH") return respuesta({ id: "turno-1", estado: "PENDIENTE", aula_desasignada: false, cupo_maximo: null });
    if (url === "/api/turnos/aula/opciones?turno_id=turno-1") return respuesta(aulas);
    if (url === "/api/turnos/turno-1/aula" && init?.method === "PATCH") return respuesta({ id: "turno-1", aula_id: "aula-1", cupo_maximo: 20, estado: "PENDIENTE" });
    if (url.startsWith("/api/turnos/participantes/alumnos?q=")) return respuesta(alumnos.filter((alumno) => alumno.nombre.toLowerCase().includes(decodeURIComponent(url.split("q=")[1]!).toLowerCase())));
    if (url === "/api/turnos/turno-1/participantes" && init?.method === "PATCH") return respuesta({ id: "turno-1", alumno_ids: ["alumno-1"], profesor_id: "profesor-1", cupo_maximo: 20, estado: "DISPONIBLE" });
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

  it("mantiene loading, muestra el error de configuración y permite reintentar", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    let intentos = 0;
    rutas = (url) => url === "/api/turnos/configuracion" && ++intentos === 1
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar();
    expect(container.textContent).toContain("Cargando materias");
    await act(async () => { resolver(respuesta(null, false, { message: "Falló la configuración" })); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló la configuración");
    await pulsar(boton("Reintentar"));
    expect(container.querySelector("h2#titulo-paso-materia")?.textContent).toBe("Elegí una materia");
    expect(llamadas("GET", "/api/turnos/configuracion")).toHaveLength(2);
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
    expect(llamadas("GET", "/api/turnos/aula/opciones")).toHaveLength(0);
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
    expect(container.querySelector("h2#titulo-paso-aula")?.textContent).toBe("Elegí un aula");
    expect(llamadas("GET", "aula/opciones?turno_id=turno-1")).toHaveLength(1);
    expect(fetch.mock.invocationCallOrder[fetch.mock.calls.findIndex(([url, init]) => url === "/api/turnos" && init?.method === "POST")])
      .toBeLessThan(fetch.mock.invocationCallOrder[fetch.mock.calls.findIndex(([url]) => url === "/api/turnos/aula/opciones?turno_id=turno-1")]);
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
    expect(container.querySelector("h2#titulo-paso-aula")?.textContent).toBe("Elegí un aula");
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
    expect(container.querySelector("h2#titulo-paso-aula")?.textContent).toBe("Elegí un aula");
  });
});
