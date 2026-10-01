// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { fetch, setDirty, push } = vi.hoisted(() => ({ fetch: vi.fn(), setDirty: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty, confirmarSalida: (salir: () => void) => salir() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});

describe("HU-C-18 etapa 5: Aula", () => {
  it("muestra solo opciones del GET con turno_id, nombre y capacidad; no persiste selección antes de continuar", async () => {
    rutas = (url) => url === "/api/turnos/aula/opciones?turno_id=turno-1" ? respuesta([aulas[0]]) : undefined;
    await montar(); await crearTurno();
    expect(container.querySelector('[role="radiogroup"][aria-label="Aula"]')?.textContent).toContain("Aula 1Capacidad 20 alumnos");
    expect(container.querySelector('[role="radiogroup"][aria-label="Aula"]')?.textContent).not.toContain("Aula 2");
    expect(container.querySelector("select#aula")).toBeNull();
    expect(container.textContent).toContain("Aulas libres el jueves 1 de octubre, 10:00–11:00");
    expect(boton("Continuar a alumnos").disabled).toBe(true);
    await seleccionarAula();
    expect(container.querySelector("aside")?.textContent).toContain("AULAAula 1");
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
    expect(container.querySelector("h2#titulo-paso-alumnos")?.textContent).toBe("Inscribí alumnos");
    expect(container.querySelector("aside")?.textContent).toContain("AULAAula 1");
    await pulsar(boton("Atrás"));
    expect(container.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toContain("Aula 1");
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
    expect(container.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toContain("Aula 1");
    await pulsar(boton("Continuar a alumnos"));
    expect(container.querySelector("h2#titulo-paso-alumnos")?.textContent).toBe("Inscribí alumnos");
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
    expect(container.querySelector("h2#titulo-paso-alumnos")?.textContent).toBe("Inscribí alumnos");
  });

  it.each([true, false])("reconfiguración con aula_desasignada=%s reconcilia Aula y vuelve a consultar opciones", async (desasignada) => {
    rutas = (url, init) => url.endsWith("/configuracion") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_desasignada: desasignada, cupo_maximo: desasignada ? null : 20 }) : undefined;
    await montar(); await crearTurno(); await asignarAula();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await pulsar(horario("10:30–11:30"));
    const consultasAntes = llamadas("GET", "aula/opciones?turno_id=turno-1").length;
    await pulsar(boton("Continuar a aula"));
    expect(llamadas("PATCH", "/configuracion")).toHaveLength(1);
    expect(llamadas("GET", "aula/opciones?turno_id=turno-1")).toHaveLength(consultasAntes + 1);
    expect(container.querySelector('[role="radio"][aria-checked="true"]')?.textContent ?? null).toBe(desasignada ? null : "Aula 1Capacidad 20 alumnos");
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
    await pulsar(horario("10:30–11:30")); await pulsar(boton("Continuar a aula"));
    expect(container.querySelector('[role="radio"][aria-checked="true"]')).toBeNull();
    expect(container.querySelector("aside")?.textContent).toContain("AULASin elegir");
    expect(boton("Continuar a alumnos").disabled).toBe(true);
  });
});

describe("HU-C-18 etapa 6: Alumnos y confirmación", () => {
  it("filtra localmente por nombre, apellido y DNI sin perder selecciones", async () => {
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    const consultas = llamadas("GET", "/participantes/alumnos/opciones").length;
    await buscarAlumno("aNA");
    expect(alumnoCheckbox(alumnos[1])).toBeDefined();
    expect(alumnoCheckbox(alumnos[0])).toBeUndefined();
    expect(container.querySelector("aside")?.textContent).toContain("ALUMNOSJuan López");
    await buscarAlumno("LÓPEZ");
    expect(alumnoCheckbox(alumnos[0]).checked).toBe(true);
    await buscarAlumno("30987654");
    expect(alumnoCheckbox(alumnos[1])).toBeDefined();
    expect(llamadas("GET", "/participantes/alumnos/opciones")).toHaveLength(consultas);
  });

  it("reintenta errores de la lectura preventiva sin permitir confirmar", async () => {
    let falla = true;
    rutas = (url) => url.includes("/participantes/alumnos/opciones?") && falla
      ? (falla = false, respuesta(null, false, { code: "ERROR", message: "Falló la lista" })) : undefined;
    await montar(); await crearTurno(); await asignarAula();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló la lista");
    expect(boton("Crear turno").disabled).toBe(true);
    await pulsar(boton("Reintentar"));
    expect(container.textContent).toContain("López, Juan");
  });

  it("lista elegible vacía conserva el mínimo de un alumno", async () => {
    rutas = (url) => url.includes("/participantes/alumnos/opciones?") ? respuesta({ turno_id: "turno-1", alumnos: [] }) : undefined;
    await montar(); await crearTurno(); await asignarAula();
    expect(container.textContent).toContain("No hay alumnos disponibles para este turno.");
    expect(boton("Crear turno").disabled).toBe(true);
  });

  it("muestra lista completa, selecciona varios y permite desmarcar sin PATCH temprano", async () => {
    await montar(); await crearTurno(); await asignarAula();
    expect(boton("Crear turno").disabled).toBe(true);
    expect(container.textContent).toContain("López, Juan");
    expect(container.textContent).toContain("Paz, Ana");
    expect(container.textContent).not.toContain("Opcional");
    expect(container.textContent).not.toContain("Todavía no agregaste alumnos.");
    await agregarAlumno(); await agregarAlumno(alumnos[1]);
    expect(llamadas("GET", "/api/turnos/participantes/alumnos/opciones?turno_id=turno-1")).toHaveLength(1);
    expect(container.textContent).toContain("2 de 20");
    expect(container.querySelector("aside")?.textContent).toContain("ALUMNOSJuan López, Ana Paz");
    expect(container.querySelector("aside")?.textContent).toContain("ESTADO INICIALDisponible, 2 alumnos");
    expect(llamadas("PATCH", "/participantes")).toHaveLength(0);
    await agregarAlumno();
    expect(container.textContent).toContain("1 de 20");
    expect(container.querySelector("aside")?.textContent).toContain("ALUMNOSAna Paz");
  });

  it("detiene la carga local al alcanzar el cupo informado por PATCH Aula", async () => {
    rutas = (url, init) => url.endsWith("/aula") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", aula_id: "aula-1", cupo_maximo: 1, estado: "PENDIENTE" }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    expect(container.textContent).toContain("1 de 1");
    expect(container.querySelector("aside")?.textContent).toContain("ESTADO INICIALCompleto, 1 alumno");
    expect(container.textContent).toContain("El turno se va a crear en estado Completo, con 1 alumno");
    expect(alumnoCheckbox(alumnos[1]).disabled).toBe(true);
    await agregarAlumno();
    expect(alumnoCheckbox(alumnos[1]).disabled).toBe(false);
  });

  it("confirma con alumno_ids sin profesor_id y muestra DISPONIBLE sin repetir PATCH", async () => {
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    expect(boton("Ver listado de turnos")).toBeUndefined();
    expect(container.textContent).not.toContain("Turno creado correctamente.");
    await pulsar(boton("Crear turno"));
    expect(JSON.parse(String(llamadas("PATCH", "/participantes")[0]![1].body))).toEqual({ alumno_ids: ["alumno-1"] });
    expect(container.textContent).toContain("Turno confirmado");
    expect(container.textContent).toContain("Turno creado correctamente.");
    expect(container.textContent).toContain("Disponible");
    expect(boton("Crear turno")).toBeUndefined();
    expect(boton("Ver listado de turnos")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
    expect(llamadas("PATCH", "/participantes")).toHaveLength(1);
    expect(setDirty).toHaveBeenLastCalledWith(false);
    await pulsar(boton("Ver listado de turnos"));
    expect(push).toHaveBeenCalledExactlyOnceWith("/turnos");
    expect(llamadas("PATCH", "/participantes")).toHaveLength(1);
  });

  it("usa el estado COMPLETO devuelto por backend", async () => {
    rutas = (url, init) => url.endsWith("/participantes") && init?.method === "PATCH"
      ? respuesta({ id: "turno-1", alumno_ids: ["alumno-1"], profesor_id: "profesor-1", cupo_maximo: 20, estado: "COMPLETO" }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    await pulsar(boton("Crear turno"));
    expect(container.textContent).toContain("Completo");
  });

  it.each(["ALUMNO_NO_DISPONIBLE", "TURNO_SIN_AULA"])("error %s conserva selección y PENDIENTE", async (codigo) => {
    rutas = (url, init) => url.endsWith("/participantes") && init?.method === "PATCH"
      ? respuesta(null, false, { code: codigo, message: codigo === "TURNO_SIN_AULA" ? "Asigná un aula antes de confirmar el turno" : "El alumno ya tiene otro turno", detalles: codigo === "ALUMNO_NO_DISPONIBLE" ? { alumno_id: "alumno-1" } : undefined }) : undefined;
    await montar(); await crearTurno(); await asignarAula(); await agregarAlumno();
    await pulsar(boton("Crear turno"));
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
    act(() => { boton("Crear turno").click(); boton("Crear turno").click(); });
    expect(llamadas("PATCH", "/participantes")).toHaveLength(1);
    expect(alumnoCheckbox(alumnos[0]).disabled).toBe(true);
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
const profesores = [
  { id: "profesor-1", nombre: "Ana", apellido: "Pérez", horarios: [{ horario_id: "horario-1", dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }] },
  { id: "profesor-2", nombre: "Luis", apellido: "Gómez", horarios: [{ horario_id: "horario-2", dia_semana: "JUEVES", hora_inicio: "15:00", hora_fin: "19:00" }] },
];
const fechas = [{ fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [
  { hora_inicio: "09:00", hora_fin: "12:00", tramos_libres: [{ desde: "09:00", hasta: "12:00" }], inicios: ["10:00", "10:30"] },
] }];
const agenda = { profesor: { id: "profesor-1", nombre_completo: "Pérez, Ana" }, duracion_min: 60, granularidad_min: 30,
  rango: { desde: "2026-10-01", hasta: "2026-10-02" }, franjas_recurrentes: [],
  meses: [{ anio: 2026, mes: 10, etiqueta: "Octubre 2026", dias: [
    { fecha: "2026-10-01", dia_semana: "JUEVES", numero: 1, en_rango: true, operativo: true, tiene_horarios_libres: true, seleccionable: true,
      franjas: [{ hora_inicio: "09:00", hora_fin: "12:00", tramos_libres: [{ desde: "09:00", hasta: "12:00" }], tramos_ocupados: [], bloques: [
        { inicio: "10:00", fin: "11:00", estado: "LIBRE", seleccionable: true }, { inicio: "10:30", fin: "11:30", estado: "LIBRE", seleccionable: true },
      ] }],
    },
    { fecha: "2026-10-02", dia_semana: "VIERNES", numero: 2, en_rango: true, operativo: false, tiene_horarios_libres: false, seleccionable: false, franjas: [] },
  ] }] };
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
const botonAvanzar = () => boton("Continuar a profesor") || boton("Continuar a fecha y horario");
const pasoStepper = (numero: number) => container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')[numero - 1]!;
const botonPaso = (numero: number) => pasoStepper(numero).querySelector<HTMLButtonElement>("button")!;
const diaCalendario = (fecha: string) => container.querySelector<HTMLButtonElement>(`button[data-fecha="${fecha}"]`)!;
const horario = (texto: string) => [...container.querySelectorAll('label[data-estado]')].find((elemento) => elemento.textContent?.includes(texto))!;
const pulsar = async (elemento: Element) => { await act(async () => { (elemento as HTMLElement).click(); }); };
const llamadas = (metodo: string, fragmento: string) => fetch.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === metodo && url.includes(fragmento));
const seleccionarMateria = async (id = "materia-1") => pulsar(container.querySelector(`input[name="materia_turno"][value="${id}"]`)!);
const seleccionarProfesor = async (id = "profesor-1") => pulsar(container.querySelector(`input[name="profesor_turno"][value="${id}"]`)!);
const irAProfesor = async () => { await seleccionarMateria(); await pulsar(botonAvanzar()); };
const irAFecha = async () => { await irAProfesor(); await seleccionarProfesor(); await pulsar(botonAvanzar()); };
const elegirHorario = async () => {
  await pulsar(diaCalendario("2026-10-01"));
  await pulsar(horario("10:00–11:00"));
};
const crearTurno = async () => { await irAFecha(); await elegirHorario(); await pulsar(boton("Continuar a aula")); };
const seleccionarAula = async (id = "aula-1") => pulsar(container.querySelector(`[role="radiogroup"][aria-label="Aula"] [role="radio"]:nth-child(${id === "aula-1" ? 1 : 2})`)!);
const asignarAula = async () => { await seleccionarAula(); await pulsar(boton("Continuar a alumnos")); };
const buscarAlumno = async (texto: string) => {
  const input = container.querySelector<HTMLInputElement>("#alumno-busqueda-wizard")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, texto); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const alumnoCheckbox = (alumno = alumnos[0]) => [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((input) => input.closest("label")?.textContent?.includes(`${alumno.apellido}, ${alumno.nombre}`))!;
const agregarAlumno = async (alumno = alumnos[0]) => pulsar(alumnoCheckbox(alumno));

beforeEach(() => {
  vi.clearAllMocks();
  rutas = () => undefined;
  fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const propia = rutas(url, init);
    if (propia) return propia;
    if (url === "/api/turnos/configuracion") return respuesta({ materias, parametros: { duraciones_permitidas_minutos: [60, 120, 180] } });
    if (url === "/api/turnos/profesores/por-materia?materia_id=materia-1") return respuesta(profesores);
    if (url === "/api/turnos/profesores/por-materia?materia_id=materia-2") return respuesta([profesores[1]]);
    if (url === "/api/turnos/profesores/opciones-wizard?materia_id=materia-1") return respuesta(profesores);
    if (url === "/api/turnos/profesores/opciones-wizard?materia_id=materia-2") return respuesta([profesores[1]]);
    if (url.includes("/agenda-wizard?")) return respuesta(agenda);
    if (url.includes("/disponibilidad?")) return respuesta({ fechas });
    if (url === "/api/turnos" && init?.method === "POST") return respuesta({ id: "turno-1", estado: "PENDIENTE" });
    if (url === "/api/turnos/turno-1/configuracion" && init?.method === "PATCH") return respuesta({ id: "turno-1", estado: "PENDIENTE", aula_desasignada: false, cupo_maximo: null });
    if (url === "/api/turnos/aula/opciones?turno_id=turno-1") return respuesta(aulas);
    if (url === "/api/turnos/turno-1/aula" && init?.method === "PATCH") return respuesta({ id: "turno-1", aula_id: "aula-1", cupo_maximo: 20, estado: "PENDIENTE" });
    if (url === "/api/turnos/participantes/alumnos/opciones?turno_id=turno-1") return respuesta({ turno_id: "turno-1", alumnos });
    if (url === "/api/turnos/turno-1/participantes" && init?.method === "PATCH") return respuesta({ id: "turno-1", alumno_ids: ["alumno-1"], profesor_id: "profesor-1", cupo_maximo: 20, estado: "DISPONIBLE" });
    return respuesta(null, false, { message: `Ruta inesperada: ${url}` });
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-18 etapa 3: Materia, Profesor, Fecha y horario", () => {
  it("muestra textos específicos de avance en los pasos 1 y 2", async () => {
    await montar();
    expect(boton("Continuar a profesor")).toBeDefined();
    expect(boton("Continuar")).toBeUndefined();
    await irAProfesor();
    expect(boton("Continuar a fecha y horario")).toBeDefined();
    expect(boton("Continuar")).toBeUndefined();
  });

  it("habilita solo pasos anteriores como botones de tipo button y conserva Atrás", async () => {
    await montar();
    expect(pasoStepper(1).getAttribute("aria-current")).toBe("step");
    expect(botonPaso(1)).toBeNull();
    expect(botonPaso(2)).toBeNull();
    await irAProfesor();
    expect(botonPaso(1).type).toBe("button");
    expect(botonPaso(2)).toBeNull();
    expect(botonPaso(3)).toBeNull();
    await pulsar(pasoStepper(3));
    expect(container.querySelector("h2#titulo-paso-profesor")).not.toBeNull();
    await pulsar(pasoStepper(2));
    expect(container.querySelector("h2#titulo-paso-profesor")).not.toBeNull();
    await pulsar(botonPaso(1));
    expect(container.querySelector("h2#titulo-paso-materia")).not.toBeNull();
    expect(botonPaso(2).type).toBe("button");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(llamadas("PATCH", "/api/turnos")).toHaveLength(0);
    await pulsar(botonAvanzar());
    await pulsar(boton("Atrás"));
    expect(container.querySelector("h2#titulo-paso-materia")).not.toBeNull();
  });

  it("desde Fecha y horario vuelve a Materia o Profesor sin limpiar ni persistir", async () => {
    await montar(); await irAFecha(); await elegirHorario();
    expect([1, 2].map((numero) => botonPaso(numero).type)).toEqual(["button", "button"]);
    expect(botonPaso(3)).toBeNull();
    expect(botonPaso(4)).toBeNull();
    await pulsar(pasoStepper(3));
    expect(container.querySelector("h2#titulo-paso-profesor")).toBeNull();
    await pulsar(botonPaso(2));
    expect(container.querySelector<HTMLInputElement>('input[value="profesor-1"]')?.checked).toBe(true);
    await pulsar(botonAvanzar());
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    await pulsar(botonPaso(1));
    expect(container.querySelector<HTMLInputElement>('input[value="materia-1"]')?.checked).toBe(true);
    expect(botonPaso(2).type).toBe("button");
    expect(botonPaso(3).type).toBe("button");
    await pulsar(botonPaso(3));
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(llamadas("PATCH", "/api/turnos")).toHaveLength(0);
  });

  it("el stepper aplica las mismas invalidaciones al cambiar Profesor o Materia", async () => {
    await montar(); await irAFecha(); await elegirHorario();
    await pulsar(botonPaso(2));
    await seleccionarProfesor("profesor-2");
    expect(container.querySelector("aside")?.textContent).not.toContain("01/10/2026 · 10:00");
    await pulsar(botonAvanzar());
    expect(boton("Continuar a aula").disabled).toBe(true);
    await pulsar(botonPaso(1));
    await seleccionarMateria("materia-2");
    expect(botonPaso(3)).toBeNull();
    await pulsar(botonAvanzar());
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-2"]')?.checked).toBe(true);
    expect(container.querySelector("aside")?.textContent).not.toContain("01/10/2026 · 10:00");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(llamadas("PATCH", "/api/turnos")).toHaveLength(0);
  });

  it("desde Aula el stepper no repite POST ni ejecuta PATCH al volver", async () => {
    await montar(); await crearTurno();
    await pulsar(botonPaso(3));
    expect(botonPaso(4).type).toBe("button");
    await pulsar(botonPaso(4));
    expect(container.querySelector("h2#titulo-paso-aula")).not.toBeNull();
    expect(llamadas("PATCH", "/api/turnos")).toHaveLength(0);
    await pulsar(botonPaso(1));
    expect(container.querySelector("h2#titulo-paso-materia")).not.toBeNull();
    expect(botonPaso(4).type).toBe("button");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(llamadas("PATCH", "/api/turnos")).toHaveLength(0);
    await pulsar(botonAvanzar()); await pulsar(botonAvanzar());
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(llamadas("PATCH", "/api/turnos")).toHaveLength(0);
  });
  it("muestra los cinco pasos y carga Materia y duraciones desde configuración", async () => {
    await montar();
    expect(container.querySelector("h1")?.textContent).toBe("Nuevo turno");
    expect(container.querySelector("header")?.textContent).toContain("Materia → Profesor → Fecha y horario → Aula → Alumnos.");
    expect([...container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')].map((paso) => paso.textContent?.trim()))
      .toEqual(["Paso 1Materia", "Paso 2Profesor", "Paso 3Fecha y horario", "Paso 4Aula", "Paso 5Alumnos"]);
    expect(container.textContent).not.toContain("Paso 1 de 5");
    expect([...container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')].map((paso) => paso.getAttribute("data-estado")))
      .toEqual(["actual", "futuro", "futuro", "futuro", "futuro"]);
    expect(container.querySelector("h2#titulo-paso-materia")?.textContent).toBe("Elegí la materia");
    expect(botonAvanzar().disabled).toBe(true);
    expect(llamadas("GET", "/api/turnos/configuracion")).toHaveLength(1);
    expect(container.querySelector("aside")?.textContent).toContain("Sin elegir");
    expect(container.querySelector("aside")?.textContent).toContain("ESTADO INICIALDisponible, 0 alumnos");
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
    expect(container.querySelector("h2#titulo-paso-materia")?.textContent).toBe("Elegí la materia");
    expect(llamadas("GET", "/api/turnos/configuracion")).toHaveLength(2);
  });

  it("Materia muestra tarjetas con conteo singular/plural y mantiene la selección", async () => {
    await montar();
    expect(container.querySelector("h2#titulo-paso-materia")?.textContent).toBe("Elegí la materia");
    expect(container.textContent).not.toContain("Seleccioná la materia para este turno.");
    expect(container.querySelector('fieldset input[name="materia_turno"]')?.parentElement?.parentElement?.className).toContain("grid-cols-3");
    expect(container.textContent).toContain("FIS · 2 profesores");
    expect(container.textContent).toContain("1 profesor");
    await seleccionarMateria();
    expect(container.querySelector<HTMLInputElement>('input[name="materia_turno"][value="materia-1"]')?.checked).toBe(true);
    expect(botonAvanzar().disabled).toBe(false);
    expect(llamadas("GET", "por-materia?materia_id=materia-1")).toHaveLength(1);
  });

  it("Materia distingue carga y error de los conteos y reintenta sin loop", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    let intentos = 0;
    rutas = (url) => url.endsWith("por-materia?materia_id=materia-1") && ++intentos === 1
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar();
    expect(container.textContent).toContain("Cargando cantidad de profesores");
    await act(async () => { resolver(respuesta(null, false, { message: "Falló el conteo" })); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló el conteo");
    await pulsar(boton("Reintentar conteos"));
    expect(container.textContent).toContain("FIS · 2 profesores");
    expect(llamadas("GET", "por-materia?materia_id=materia-1")).toHaveLength(2);
    expect(llamadas("GET", "por-materia?materia_id=materia-2")).toHaveLength(2);
  });

  it("Materia avanza a Profesor sin persistir; opciones-wizard muestra solo las opciones recibidas", async () => {
    rutas = (url) => url.endsWith("opciones-wizard?materia_id=materia-1") ? respuesta([profesores[0]]) : undefined;
    await montar();
    await irAProfesor();
    expect(llamadas("GET", "por-materia?materia_id=materia-1")).toHaveLength(1);
    expect(llamadas("GET", "opciones-wizard?materia_id=materia-1")).toHaveLength(1);
    expect(container.querySelector('input[value="profesor-1"]')).not.toBeNull();
    expect(container.querySelector('input[value="profesor-2"]')).toBeNull();
    expect(container.querySelector("h2#titulo-paso-profesor")?.textContent).toBe("Elegí el profesor");
    expect(container.textContent.replaceAll("\u00a0", " ")).toContain("Martes: 16:00–20:00");
    expect(container.textContent).not.toContain("Paso 2 de 5");
    expect([...container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')].map((paso) => paso.getAttribute("data-estado")))
      .toEqual(["completado", "actual", "futuro", "futuro", "futuro"]);
    expect(container.querySelector("aside")?.textContent).toContain("Física");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(llamadas("GET", "/api/turnos/aula/opciones")).toHaveLength(0);
    expect(llamadas("GET", "profesores/opciones?turno_id=")).toHaveLength(0);
  });

  it("Profesor distingue carga y lista vacía de opciones con horario", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url) => url.endsWith("opciones-wizard?materia_id=materia-1")
      ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await montar();
    await seleccionarMateria();
    await pulsar(botonAvanzar());
    expect(container.textContent).toContain("Cargando profesores");
    await act(async () => { resolver(respuesta([])); });
    expect(container.textContent).toContain("No hay profesores con horario de atención registrado para esta materia");
    expect(botonAvanzar().disabled).toBe(true);
  });

  it("Profesor muestra error de carga y permite reintentar", async () => {
    let falla = true;
    rutas = (url) => url.endsWith("opciones-wizard?materia_id=materia-1") && falla
      ? (falla = false, respuesta(null, false, { message: "Falló la consulta" })) : undefined;
    await montar(); await irAProfesor();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló la consulta");
    expect(botonAvanzar().disabled).toBe(true);
    await pulsar(boton("Reintentar"));
    expect(container.querySelector('input[name="profesor_turno"][value="profesor-1"]')).not.toBeNull();
  });

  it("selecciona Profesor y carga agenda con 1 h inicial, sin persistencia temprana", async () => {
    await montar();
    await irAFecha();
    expect(container.querySelector("aside")?.textContent).toContain("Ana Pérez");
    expect([...container.querySelectorAll('input[name="duracion_min"]')].map((elemento) => (elemento as HTMLInputElement).value)).toEqual(["60", "120", "180"]);
    expect(container.querySelector<HTMLInputElement>('input[name="duracion_min"][value="60"]')?.checked).toBe(true);
    expect(llamadas("GET", "/api/turnos/profesores/profesor-1/agenda-wizard?materia_id=materia-1&duracion_min=60")).toHaveLength(1);
    await pulsar(diaCalendario("2026-10-01"));
    expect(horario("10:00–11:00")).toBeDefined();
    await pulsar(horario("10:00–11:00"));
    expect(container.querySelector("aside")?.textContent).toContain("01/10/2026 · 10:00–11:00");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
  });

  it("confirma paso 3 con un único POST contractual y avanza a Aula con PENDIENTE", async () => {
    await montar();
    await crearTurno();
    const [post] = llamadas("POST", "/api/turnos");
    expect(JSON.parse(String(post![1].body))).toEqual({ materia_id: "materia-1", profesor_id: "profesor-1", fecha: "2026-10-01", hora_inicio: "10:00", duracion_min: 60 });
    expect(container.querySelector("h2#titulo-paso-aula")?.textContent).toBe("Elegí el aula");
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
    await pulsar(botonAvanzar()); await pulsar(botonAvanzar());
    expect(container.querySelector<HTMLInputElement>('input[name="duracion_min"][value="60"]')?.checked).toBe(true);
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
  });

  it("cambiar Profesor conserva duración, limpia fecha/hora y consulta al nuevo profesor", async () => {
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás"));
    await seleccionarProfesor("profesor-2");
    expect(container.querySelector("aside")?.textContent).not.toContain("01/10/2026 · 10:00");
    await pulsar(botonAvanzar());
    expect(container.querySelector<HTMLInputElement>('input[name="duracion_min"][value="60"]')?.checked).toBe(true);
    expect(llamadas("GET", "/api/turnos/profesores/profesor-2/agenda-wizard?materia_id=materia-1&duracion_min=60")).toHaveLength(1);
    expect(boton("Continuar a aula").disabled).toBe(true);
  });

  it("cambiar Materia limpia Profesor y horario si ya no figura en opciones-wizard", async () => {
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await seleccionarMateria("materia-2");
    await pulsar(botonAvanzar());
    expect(llamadas("GET", "opciones-wizard?materia_id=materia-2")).toHaveLength(1);
    expect(botonAvanzar().disabled).toBe(true);
    expect(container.querySelector("aside")?.textContent).not.toContain("01/10/2026 · 10:00");
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-2"]')?.checked).toBe(false);
  });

  it("cambiar Materia conserva profesor y horario solo tras revalidar los inicios del servidor", async () => {
    rutas = (url) => url.endsWith("opciones-wizard?materia_id=materia-2") ? respuesta([profesores[0]]) : undefined;
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await seleccionarMateria("materia-2");
    await pulsar(botonAvanzar());
    expect(llamadas("GET", "/api/turnos/profesores/profesor-1/disponibilidad?materia_id=materia-2&duracion_min=60")).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-1"]')?.checked).toBe(true);
    await pulsar(botonAvanzar());
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
  });

  it("cambiar Materia limpia fecha/hora si la nueva disponibilidad ya no las ofrece", async () => {
    rutas = (url) => url.endsWith("opciones-wizard?materia_id=materia-2") ? respuesta([profesores[0]])
      : url.includes("profesor-1/disponibilidad?materia_id=materia-2") ? respuesta({ fechas: [] }) : undefined;
    await montar();
    await irAFecha(); await elegirHorario();
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await seleccionarMateria("materia-2");
    await pulsar(botonAvanzar());
    expect(container.querySelector("aside")?.textContent).not.toContain("01/10/2026 · 10:00");
  });

  it("tras volver desde Aula confirma paso 3 mediante PATCH, sin otro POST", async () => {
    await montar(); await crearTurno();
    await pulsar(boton("Atrás"));
    await pulsar(horario("10:30–11:30"));
    expect(setDirty).toHaveBeenLastCalledWith(true);
    await pulsar(boton("Continuar a aula"));
    const [patch] = llamadas("PATCH", "/api/turnos/turno-1/configuracion");
    expect(JSON.parse(String(patch![1].body))).toEqual({ materia_id: "materia-1", profesor_id: "profesor-1", fecha: "2026-10-01", hora_inicio: "10:30", duracion_min: 60 });
    expect(llamadas("POST", "/api/turnos")).toHaveLength(1);
    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(container.querySelector("h2#titulo-paso-aula")?.textContent).toBe("Elegí el aula");
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
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
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
    expect(container.querySelector("h2#titulo-paso-aula")?.textContent).toBe("Elegí el aula");
  });
});
