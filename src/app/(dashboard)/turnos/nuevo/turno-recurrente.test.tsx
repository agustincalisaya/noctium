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
const boton = (texto: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((elemento) =>
  elemento.textContent?.trim() === texto || (texto === "Confirmar generación" && elemento.textContent?.startsWith("Confirmar generación (")))!;
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
const seleccionar = async (id: string, valor: string) => {
  const input = container.querySelector<HTMLSelectElement>(`select#${id}`)!;
  await act(async () => { input.value = valor; input.dispatchEvent(new Event("change", { bubbles: true })); });
  await esperar();
};
const configurar = async () => {
  await montar(); await modoRecurrente();
  await seleccionar("materia-recurrente", "materia-1");
  await seleccionar("profesor-recurrente", "profesor-1");
  await seleccionar("franja-recurrente", "horario-1");
  await radio("duracion_recurrente", "120");
  await seleccionar("hora-recurrente", "16:00");
  await seleccionar("aula-recurrente", "aula-1");
  await seleccionarFecha("Desde", desde); await seleccionarFecha("Hasta", hasta);
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

describe("HU-C-17: configuración recurrente en una pantalla", () => {
  it("preserva el modo individual con stepper y muestra las dos cards recurrentes", async () => {
    await montar();
    expect(boton("Turno individual").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('nav[aria-label="Progreso del nuevo turno"]')).not.toBeNull();
    await modoRecurrente();
    expect(container.querySelector('nav[aria-label="Progreso del nuevo turno"]')).toBeNull();
    const card = container.querySelector('[data-testid="configuracion-recurrente"]')!;
    const panel = container.querySelector('[data-testid="vista-previa-recurrente"]')!;
    expect(card.parentElement?.classList.contains("xl:grid-cols-[440px_minmax(0,1fr)]")).toBe(true);
    expect(card.parentElement?.classList.contains("gap-5")).toBe(true);
    expect(card.querySelectorAll("section")).toHaveLength(3);
    expect(card.querySelectorAll("hr")).toHaveLength(2);
    expect(card.textContent).toContain("MATERIA Y PROFESOR");
    expect(card.textContent).toContain("FRANJA Y HORARIO");
    expect(card.textContent).toContain("AULA Y FECHAS");
    for (const id of ["materia-recurrente", "profesor-recurrente", "franja-recurrente", "hora-recurrente", "aula-recurrente"]) expect(card.querySelector(`#${id}`)).not.toBeNull();
    expect(card.querySelector('input[name="duracion_recurrente"]')).not.toBeNull();
    expect(card.querySelector('input[aria-label="Desde"]')).not.toBeNull();
    expect(card.querySelector('input[aria-label="Hasta"]')).not.toBeNull();
    expect(panel.querySelector("h2")?.textContent).toBe("Vista previa");
    expect(panel.textContent).toContain("Completá la configuración y tocá Ver vista previa");
    expect(boton("Ver vista previa").disabled).toBe(true);
    expect(boton("Ver vista previa").classList.contains("w-full")).toBe(true);
    expect(boton("Ver vista previa").classList.contains("bg-background")).toBe(true);
    expect(boton("Ver vista previa").classList.contains("border-border")).toBe(true);
    await pulsar(boton("Turno individual"));
    expect(container.querySelector('nav[aria-label="Progreso del nuevo turno"]')).not.toBeNull();
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
  });

  it("carga franjas y aulas, ordena franjas y limita horas por duración", async () => {
    await montar(); await modoRecurrente();
    await seleccionar("materia-recurrente", "materia-1");
    await seleccionar("profesor-recurrente", "profesor-1");
    expect(llamadas("GET", "/api/turnos/profesores/profesor-1/franjas?materia_id=materia-1")).toHaveLength(1);
    expect([...container.querySelectorAll<HTMLOptionElement>("#franja-recurrente option")].map((e) => e.value)).toEqual(["", "horario-1", "horario-1b"]);
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="duracion_recurrente"]')].map((e) => e.value)).toEqual(["60", "120", "180"]);
    await seleccionar("franja-recurrente", "horario-1"); await radio("duracion_recurrente", "180");
    expect([...container.querySelectorAll<HTMLOptionElement>("#hora-recurrente option")].map((e) => e.value)).toEqual(["", "16:00", "16:30", "17:00"]);
    expect(llamadas("GET", "/api/turnos/aula/opciones")).toHaveLength(1);
    expect(container.querySelector("#aula-recurrente")?.textContent).toContain("Aula 1 · Capacidad 20");
  });

  it("renderiza tabla y resumen de todas las fechas libres con payload intacto", async () => {
    await configurar(); await pulsar(boton("Ver vista previa"));
    const payload = { materia_id: "materia-1", profesor_id: "profesor-1", horario_id: "horario-1", duracion_min: 120, hora_inicio: "16:00", aula_id: "aula-1", fecha_desde: desde, fecha_hasta: hasta };
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion/vista-previa")[0]?.[1]?.body))).toEqual(payload);
    expect(container.querySelector('[data-testid="configuracion-recurrente"] #materia-recurrente')).not.toBeNull();
    const panel = container.querySelector('[data-testid="vista-previa-recurrente"]')!;
    const tabla = panel.querySelector<HTMLTableElement>('table[aria-label="Fechas de la vista previa"]')!;
    expect(tabla).not.toBeNull();
    expect([...tabla.querySelectorAll("thead th")].map((celda) => celda.textContent)).toEqual(["FECHA", "HORARIO", "AULA", "DISPONIBILIDAD"]);
    const filas = tabla.querySelectorAll("tbody tr");
    expect(filas).toHaveLength(2);
    expect(filas[0]?.querySelector("time")?.getAttribute("dateTime")).toBe(desde);
    expect(filas[0]?.querySelector("time")?.textContent).toMatch(/^Mar \d{2}\/\d{2}$/);
    expect(filas[0]?.textContent).toContain("16:00–18:00");
    expect(filas[0]?.textContent).toContain("Aula 1");
    expect([...filas].map((fila) => fila.querySelector("td:last-child")?.textContent)).toEqual(["Libre", "Libre"]);
    expect(filas[0]?.classList.contains("bg-card")).toBe(true);
    expect(panel.textContent).toContain("2 turnos");
    expect(panel.textContent).toContain("martes 16:00–18:00");
    expect(panel.textContent).toContain("Física con Ana Pérez");
    expect(panel.textContent).toContain("estado inicial Disponible, 0 alumnos");
    expect(panel.textContent).not.toContain("fechas tienen conflicto");
    expect(boton("Confirmar generación").textContent).toBe("Confirmar generación (2 turnos)");
    expect(boton("Confirmar generación").disabled).toBe(false);
    expect(boton("Confirmar generación").classList.contains("w-full")).toBe(false);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
  });

  it("muestra alerta, badges de motivos y filas libres junto a conflictos", async () => {
    rutas = (url) => url === "/api/turnos/generacion/vista-previa" ? respuesta({ ...vista, hay_conflictos: true, fechas_omitidas_vencidas: 1, fechas: [{ fecha: desde, estado: "CONFLICTO", motivos: ["AULA_OCUPADA", "PROFESOR_OCUPADO"] }, { fecha: hasta, estado: "OK", motivos: [] }] }) : undefined;
    await configurar(); await pulsar(boton("Ver vista previa"));
    const panel = container.querySelector('[data-testid="vista-previa-recurrente"]')!;
    const filas = panel.querySelectorAll('table[aria-label="Fechas de la vista previa"] tbody tr');
    expect(filas).toHaveLength(2);
    expect(panel.textContent).toContain("1 fecha tiene conflicto.");
    expect(panel.textContent).toContain("Elegí otra aula para todo el rango");
    expect(panel.textContent).toContain("No se genera ningún turno");
    expect(panel.querySelector("svg")).not.toBeNull();
    expect(filas[0]?.classList.contains("bg-warning/20")).toBe(true);
    expect([...filas[0]!.querySelectorAll("td:last-child span")].map((badge) => badge.textContent)).toEqual(["Aula ocupada", "Profesor con otro turno"]);
    expect(filas[1]?.querySelector("td:last-child")?.textContent).toBe("Libre");
    expect(panel.textContent).toContain("1 fecha de hoy vencida fue omitida");
    expect(panel.textContent).toContain("Resolvé los conflictos para habilitar la generación.");
    expect(boton("Confirmar generación").textContent).toBe("Confirmar generación (2 turnos)");
    expect(boton("Confirmar generación").disabled).toBe(true);
  });

  it("invalida preview por cambios dependientes sin escribir en el flujo individual", async () => {
    await configurar(); await pulsar(boton("Ver vista previa"));
    await seleccionar("aula-recurrente", "aula-2");
    expect(boton("Confirmar generación")).toBeUndefined();
    expect(container.querySelector('[data-testid="vista-previa-recurrente"] table')).toBeNull();
    await pulsar(boton("Ver vista previa"));
    await seleccionar("hora-recurrente", "16:30");
    expect(boton("Confirmar generación")).toBeUndefined();
    await seleccionar("profesor-recurrente", "profesor-2");
    expect(container.querySelector<HTMLSelectElement>("#franja-recurrente")?.value).toBe("");
    expect(container.querySelector<HTMLSelectElement>("#aula-recurrente")?.value).toBe("");
    await seleccionar("materia-recurrente", "materia-2");
    expect(container.querySelector<HTMLSelectElement>("#profesor-recurrente")?.value).toBe("");
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("invalida preview al cambiar franja, duración o fechas", async () => {
    await configurar(); await pulsar(boton("Ver vista previa"));
    await seleccionar("franja-recurrente", "horario-1b");
    expect(boton("Confirmar generación")).toBeUndefined();
    await seleccionar("franja-recurrente", "horario-1");
    await seleccionar("hora-recurrente", "16:00");
    await pulsar(boton("Ver vista previa"));
    await radio("duracion_recurrente", "180");
    expect(boton("Confirmar generación")).toBeUndefined();
    await pulsar(boton("Ver vista previa"));
    await seleccionarFecha("Hasta", martesFuturo(3));
    expect(boton("Confirmar generación")).toBeUndefined();
    await pulsar(boton("Ver vista previa"));
    await seleccionarFecha("Desde", martesFuturo(2));
    expect(boton("Confirmar generación")).toBeUndefined();
  });

  it("confirma desde el panel, usa el payload vigente e impide doble submit", async () => {
    let resolver: (valor: Respuesta) => void = () => {};
    rutas = (url) => url === "/api/turnos/generacion" ? new Promise<Respuesta>((resolve) => { resolver = resolve; }) : undefined;
    await configurar(); await pulsar(boton("Ver vista previa"));
    act(() => { boton("Confirmar generación").click(); boton("Generando turnos")?.click(); });
    expect(llamadas("POST", "/api/turnos/generacion")).toHaveLength(1);
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion")[0]?.[1]?.body))).toEqual(JSON.parse(String(llamadas("POST", "/api/turnos/generacion/vista-previa")[0]?.[1]?.body)));
    await act(async () => { resolver(respuesta({ generacion_id: "cgrupo", cantidad: 2, turno_ids: ["cuno", "cdos"] }, 201)); });
    expect(container.querySelector('[data-testid="vista-previa-recurrente"]')?.textContent).toContain("Se generaron 2 turnos correctamente");
  });

  it("409 muestra conflictos recalculados y exige otra preview", async () => {
    const detalle = { cantidad: 2, fechas: [{ fecha: desde, estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"] }, { fecha: hasta, estado: "OK", motivos: [] }], hay_conflictos: true, fechas_omitidas_vencidas: 0 };
    rutas = (url) => url === "/api/turnos/generacion" ? respuesta(null, 409, { code: "GENERACION_CON_CONFLICTOS", detalles: detalle }) : undefined;
    await configurar(); await pulsar(boton("Ver vista previa")); await pulsar(boton("Confirmar generación"));
    expect(container.querySelector('[data-testid="vista-previa-recurrente"]')?.textContent).toContain("Profesor con otro turno");
    expect(boton("Confirmar generación")).toBeUndefined();
    await pulsar(boton("Ver vista previa"));
    expect(boton("Confirmar generación").disabled).toBe(false);
  });
});
