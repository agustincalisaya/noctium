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
const profesores = [
  { id: "profesor-1", nombre: "Ana", apellido: "Pérez", horarios: [{ horario_id: "horario-1", dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }] },
  { id: "profesor-2", nombre: "Luis", apellido: "Gómez", horarios: [{ horario_id: "horario-2", dia_semana: "JUEVES", hora_inicio: "15:00", hora_fin: "19:00" }] },
];
const aulas = [{ id: "aula-1", nombre: "Aula 1", capacidad: 20 }, { id: "aula-2", nombre: "Aula 2", capacidad: 30 }];
const franja = [
  { horario_id: "horario-1", dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" },
  { horario_id: "horario-1b", dia_semana: "MIERCOLES", hora_inicio: "09:00", hora_fin: "13:00" },
];
const franjaOtro = [{ horario_id: "horario-2", dia_semana: "JUEVES", hora_inicio: "15:00", hora_fin: "19:00" }];

function martesFuturo(semanas: number) {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)!.value);
  const fecha = new Date(Date.UTC(valor("year"), valor("month") - 1, valor("day")));
  fecha.setUTCDate(fecha.getUTCDate() + (9 - fecha.getUTCDay()) % 7 + semanas * 7);
  return fecha.toISOString().slice(0, 10);
}
const desde = martesFuturo(1);
const hasta = martesFuturo(2);
const vista = { cantidad: 2, fechas: [
  { fecha: desde, estado: "OK", motivos: [] }, { fecha: hasta, estado: "OK", motivos: [] },
], hay_conflictos: false, fechas_omitidas_vencidas: 0 };
type Respuesta = { ok: boolean; status: number; json: () => Promise<unknown> };
const respuesta = (data: unknown, status = 200, error: unknown = null): Respuesta => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data, error }) });

let root: Root;
let container: HTMLDivElement;
let rutas: (url: string, init?: RequestInit) => Respuesta | Promise<Respuesta> | undefined;
const esperar = () => act(async () => { await new Promise((resolver) => setTimeout(resolver, 0)); });
const montar = async () => { await act(async () => { root.render(<NuevoTurnoPage />); }); await esperar(); };
const boton = (texto: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((elemento) => elemento.textContent?.trim() === texto)!;
const pulsar = async (elemento: Element) => { await act(async () => { (elemento as HTMLElement).click(); }); };
const radio = async (nombre: string, valor: string) => pulsar(container.querySelector<HTMLInputElement>(`input[name="${nombre}"][value="${valor}"]`)!);
const llamadas = (metodo: string, ruta: string) => fetch.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === metodo && url === ruta);
const seleccionarFecha = async (etiqueta: "Desde" | "Hasta", valor: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${etiqueta}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const modoRecurrente = async () => pulsar(boton("Generar varios turnos"));
const irAFranja = async () => {
  await montar(); await modoRecurrente(); await radio("materia_turno", "materia-1");
  await pulsar(boton("Continuar a profesor")); await radio("profesor_turno", "profesor-1");
  await pulsar(boton("Continuar a franja"));
};
const irAAula = async () => {
  await irAFranja(); await radio("franja_recurrente", "horario-1");
  await radio("duracion_recurrente", "120"); await radio("hora_recurrente", "16:00");
  await pulsar(boton("Continuar a aula y rango"));
};
const irAPreview = async () => {
  await irAAula(); await pulsar(container.querySelector('[role="radiogroup"][aria-label="Aula"] [role="radio"]')!);
  await seleccionarFecha("Desde", desde); await seleccionarFecha("Hasta", hasta);
  await pulsar(boton("Continuar a vista previa"));
};

beforeEach(() => {
  vi.clearAllMocks(); rutas = () => undefined;
  fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const propia = rutas(url, init);
    if (propia) return propia;
    if (url === "/api/turnos/configuracion") return respuesta({ materias, parametros: { duraciones_permitidas_minutos: [60, 120, 180], granularidad_minutos: 30 } });
    if (url.startsWith("/api/turnos/profesores/por-materia?")) return respuesta(profesores);
    if (url === "/api/turnos/profesores/opciones-wizard?materia_id=materia-1") return respuesta(profesores);
    if (url === "/api/turnos/profesores/opciones-wizard?materia_id=materia-2") return respuesta([profesores[1]]);
    if (url === "/api/turnos/profesores/profesor-1/franjas?materia_id=materia-1") return respuesta(franja);
    if (url === "/api/turnos/profesores/profesor-2/franjas?materia_id=materia-1" || url === "/api/turnos/profesores/profesor-2/franjas?materia_id=materia-2") return respuesta(franjaOtro);
    if (url === "/api/turnos/aula/opciones") return respuesta(aulas);
    if (url === "/api/turnos/generacion/vista-previa" && init?.method === "POST") return respuesta(vista);
    if (url === "/api/turnos/generacion" && init?.method === "POST") return respuesta({ generacion_id: "cgrupo", cantidad: 2, turno_ids: ["cuno", "cdos"] }, 201);
    return respuesta(null, 404, { message: `Ruta inesperada: ${url}` });
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-17 Fase 4: wizard recurrente", () => {
  it("mantiene individual por defecto y habilita el selector sin escribir al cambiar", async () => {
    await montar();
    expect(boton("Generar un turno").getAttribute("aria-pressed")).toBe("true");
    await radio("materia_turno", "materia-1"); await pulsar(boton("Continuar a profesor")); await radio("profesor_turno", "profesor-1");
    await modoRecurrente();
    expect(boton("Generar varios turnos").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLInputElement>('input[name="materia_turno"][value="materia-1"]')?.checked).toBe(true);
    await pulsar(boton("Continuar a profesor"));
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-1"]')?.checked).toBe(true);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("carga franjas del profesor, ordena sus opciones y conserva selección con Atrás", async () => {
    await irAFranja();
    expect(llamadas("GET", "/api/turnos/profesores/profesor-1/franjas?materia_id=materia-1")).toHaveLength(1);
    expect(container.textContent).toContain("Martes: 16:00–20:00");
    await radio("franja_recurrente", "horario-1"); await radio("duracion_recurrente", "60"); await radio("hora_recurrente", "16:00");
    await pulsar(boton("Atrás")); await pulsar(boton("Continuar a franja"));
    expect(container.querySelector<HTMLInputElement>('input[name="franja_recurrente"][value="horario-1"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[name="hora_recurrente"][value="16:00"]')?.checked).toBe(true);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
  });

  it("al cambiar Materia invalida Profesor, franja y datos dependientes", async () => {
    await irAAula();
    await pulsar(container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li button')[0]!);
    await radio("materia_turno", "materia-2");
    expect(container.querySelector("aside")?.textContent).not.toContain("Martes 16:00");
    await pulsar(boton("Continuar a profesor"));
    expect(container.querySelector<HTMLInputElement>('input[name="profesor_turno"]:checked')).toBeNull();
    expect(boton("Continuar a franja").disabled).toBe(true);
  });

  it("al cambiar Profesor invalida franja y hora", async () => {
    await irAAula();
    await pulsar(container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li button')[1]!);
    await radio("profesor_turno", "profesor-2");
    await pulsar(boton("Continuar a franja"));
    expect(container.querySelector<HTMLInputElement>('input[name="franja_recurrente"]:checked')).toBeNull();
    expect(container.querySelector("aside")?.textContent).not.toContain("Martes 16:00");
  });

  it("solo ofrece 60/120/180 e inicios alineados que caben completos", async () => {
    await irAFranja(); await radio("franja_recurrente", "horario-1");
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="duracion_recurrente"]')].map((input) => input.value)).toEqual(["60", "120", "180"]);
    await radio("duracion_recurrente", "180");
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="hora_recurrente"]')].map((input) => input.value)).toEqual(["16:00", "16:30", "17:00"]);
    await radio("hora_recurrente", "17:00");
    await radio("duracion_recurrente", "120");
    expect(container.querySelector<HTMLInputElement>('input[name="hora_recurrente"][value="17:00"]')?.checked).toBe(true);
    await radio("duracion_recurrente", "180");
    expect(container.querySelector<HTMLInputElement>('input[name="hora_recurrente"][value="17:00"]')?.checked).toBe(true);
    await radio("duracion_recurrente", "120"); await radio("hora_recurrente", "18:00");
    await radio("duracion_recurrente", "180");
    expect(container.querySelector<HTMLInputElement>('input[name="hora_recurrente"]:checked')).toBeNull();
  });

  it("consulta aulas sin turno_id, muestra tarjetas y exige rango válido", async () => {
    await irAAula();
    expect(llamadas("GET", "/api/turnos/aula/opciones")).toHaveLength(1);
    expect(container.querySelector('[role="radiogroup"][aria-label="Aula"]')?.textContent).toContain("Aula 1Capacidad 20 alumnos");
    expect(boton("Continuar a vista previa").disabled).toBe(true);
    await pulsar(container.querySelector('[role="radiogroup"][aria-label="Aula"] [role="radio"]')!);
    await seleccionarFecha("Desde", desde); await seleccionarFecha("Hasta", hasta);
    expect(boton("Continuar a vista previa").disabled).toBe(false);
    expect(container.textContent).toContain("6 meses calendario");
  });

  it("envía payload exacto a preview, muestra todas las fechas y confirma con el mismo payload", async () => {
    await irAPreview(); await pulsar(boton("Generar vista previa"));
    const payload = { materia_id: "materia-1", profesor_id: "profesor-1", horario_id: "horario-1", duracion_min: 120,
      hora_inicio: "16:00", aula_id: "aula-1", fecha_desde: desde, fecha_hasta: hasta };
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion/vista-previa")[0]?.[1]?.body))).toEqual(payload);
    expect(container.querySelectorAll('ol[aria-label="Fechas de la vista previa"] li')).toHaveLength(2);
    expect(container.textContent).toContain("16:00–18:00");
    expect(container.querySelector("aside")?.textContent).not.toContain("ALUMNOS");
    await pulsar(boton("Confirmar generación"));
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion")[0]?.[1]?.body))).toEqual(payload);
    expect(container.textContent).toContain("Se generaron 2 turnos correctamente");
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("muestra ambos motivos en orden, omitidas y bloquea confirmar", async () => {
    rutas = (url) => url === "/api/turnos/generacion/vista-previa" ? respuesta({ ...vista, hay_conflictos: true, fechas_omitidas_vencidas: 1,
      fechas: [{ fecha: desde, estado: "CONFLICTO", motivos: ["AULA_OCUPADA", "PROFESOR_OCUPADO"] }, { fecha: hasta, estado: "OK", motivos: [] }] }) : undefined;
    await irAPreview(); await pulsar(boton("Generar vista previa"));
    const filas = container.querySelectorAll('ol[aria-label="Fechas de la vista previa"] > li');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent?.indexOf("Aula ocupada")).toBeLessThan(filas[0]?.textContent?.indexOf("El profesor ya tiene un turno") ?? 0);
    expect(container.textContent).toContain("1 fecha de hoy vencida fue omitida");
    expect(boton("Confirmar generación").disabled).toBe(true);
  });

  it("cambiar aula o fecha invalida preview y navegar sin cambios la conserva", async () => {
    await irAPreview(); await pulsar(boton("Generar vista previa"));
    await pulsar(boton("Atrás")); await pulsar(boton("Continuar a vista previa"));
    expect(boton("Confirmar generación").disabled).toBe(false);
    await pulsar(boton("Atrás"));
    await pulsar(container.querySelectorAll('[role="radiogroup"][aria-label="Aula"] [role="radio"]')[1]!);
    await pulsar(boton("Continuar a vista previa"));
    expect(boton("Confirmar generación").disabled).toBe(true);
    await pulsar(boton("Generar vista previa"));
    await pulsar(boton("Atrás")); await seleccionarFecha("Hasta", martesFuturo(3));
    await pulsar(boton("Continuar a vista previa"));
    expect(boton("Confirmar generación").disabled).toBe(true);
  });

  it("cambiar hora, duración o franja invalida preview", async () => {
    await irAPreview(); await pulsar(boton("Generar vista previa"));
    await pulsar(container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li button')[2]!);
    await radio("hora_recurrente", "16:30");
    await pulsar(boton("Continuar a aula y rango")); await pulsar(boton("Continuar a vista previa"));
    expect(boton("Confirmar generación").disabled).toBe(true);
    await pulsar(boton("Atrás")); await pulsar(boton("Atrás"));
    await radio("duracion_recurrente", "180");
    expect(container.querySelector<HTMLInputElement>('input[name="hora_recurrente"][value="16:30"]')?.checked).toBe(true);
    await radio("franja_recurrente", "horario-1b");
    expect(container.querySelector<HTMLInputElement>('input[name="hora_recurrente"]:checked')).toBeNull();
    expect(container.querySelector("aside")?.textContent).toContain("Miércoles 09:00–13:00");
  });

  it("cambiar Materia o Profesor después de preview exige una nueva", async () => {
    await irAPreview(); await pulsar(boton("Generar vista previa"));
    await pulsar(container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li button')[1]!);
    await radio("profesor_turno", "profesor-2");
    await pulsar(boton("Continuar a franja"));
    expect(container.querySelector<HTMLInputElement>('input[name="franja_recurrente"]:checked')).toBeNull();
    await pulsar(container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li button')[0]!);
    await radio("materia_turno", "materia-2");
    expect(container.querySelector("aside")?.textContent).not.toContain("Martes 16:00–20:00");
    expect(llamadas("POST", "/api/turnos/generacion")).toHaveLength(0);
  });

  it("impide doble confirmación mientras el request está en curso", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url) => url === "/api/turnos/generacion" ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await irAPreview(); await pulsar(boton("Generar vista previa"));
    act(() => { boton("Confirmar generación").click(); boton("Generando turnos")?.click(); });
    expect(llamadas("POST", "/api/turnos/generacion")).toHaveLength(1);
    await act(async () => { resolver(respuesta({ generacion_id: "cgrupo", cantidad: 2, turno_ids: ["cuno", "cdos"] }, 201)); });
  });

  it("409 tras preview válida muestra detalle, no éxito y exige nueva preview", async () => {
    const detalle = { cantidad: 2, fechas: [{ fecha: desde, estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"] }, { fecha: hasta, estado: "OK", motivos: [] }], hay_conflictos: true, fechas_omitidas_vencidas: 0 };
    rutas = (url) => url === "/api/turnos/generacion" ? respuesta(null, 409, { code: "GENERACION_CON_CONFLICTOS", detalles: detalle }) : undefined;
    await irAPreview(); await pulsar(boton("Generar vista previa")); await pulsar(boton("Confirmar generación"));
    expect(container.textContent).toContain("La disponibilidad cambió");
    expect(container.textContent).toContain("Ya existe un turno de esta materia y profesor");
    expect(container.textContent).not.toContain("turnos correctamente");
    expect(boton("Confirmar generación").disabled).toBe(true);
    await pulsar(boton("Generar vista previa"));
    expect(boton("Confirmar generación").disabled).toBe(false);
  });
});
