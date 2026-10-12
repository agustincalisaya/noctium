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
type FilaVista = { fecha: string; estado: "OK" | "CONFLICTO"; motivos: string[]; aula: { id: string; nombre: string }; aula_cambiada: boolean; cupo: number; cupo_aula_por_defecto: number; excluida: boolean; sin_aulas_libres: boolean; solo_excluible: boolean };
const fila = (fecha: string, cambios: Partial<FilaVista> = {}): FilaVista => ({
  fecha, estado: "OK", motivos: [], aula: { id: "aula-1", nombre: "Aula 1" }, aula_cambiada: false,
  cupo: 20, cupo_aula_por_defecto: 20, excluida: false, sin_aulas_libres: false, solo_excluible: false, ...cambios,
});
const vistaDe = (fechas: FilaVista[], omitidas = 0) => {
  const incluidas = fechas.filter(({ excluida }) => !excluida);
  return { cantidad: fechas.length, cantidad_incluida: incluidas.length, con_aula_cambiada: incluidas.filter(({ aula_cambiada }) => aula_cambiada).length,
    excluidas: fechas.length - incluidas.length, fechas, hay_conflictos: incluidas.some(({ estado }) => estado === "CONFLICTO"), fechas_omitidas_vencidas: omitidas };
};
const vista = vistaDe([fila(desde), fila(hasta)]);
type Respuesta = { ok: boolean; status: number; json: () => Promise<unknown> };
const respuesta = (data: unknown, status = 200, error: unknown = null): Respuesta => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data, error }) });

let root: Root;
let container: HTMLDivElement;
let rutas: (url: string, init?: RequestInit) => Respuesta | Promise<Respuesta> | undefined;
const esperar = () => act(async () => { await new Promise((resolver) => setTimeout(resolver, 0)); });
const montar = async () => { await act(async () => { root.render(<NuevoTurnoPage />); }); await esperar(); };
const boton = (texto: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((elemento) =>
  elemento.textContent?.trim() === texto || (texto === "Confirmar generación" && elemento.textContent?.startsWith("Confirmar generación (")))!;
const botonDialogo = (texto: string) => [...document.body.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((elemento) => elemento.textContent?.trim() === texto)!;
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
const modoRecurrente = async () => pulsar(boton("Generar varias clases"));
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
    if (url === "/api/turnos/generacion" && init?.method === "POST") return respuesta({ generacion_id: "cgrupo", cantidad: 2, turno_ids: ["cuno", "cdos"], aulas_cambiadas: 0, fechas_excluidas: 0 }, 201);
    return respuesta(null, 404, { message: `Ruta inesperada: ${url}` });
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-17: configuración recurrente en una pantalla", () => {
  it("preserva el modo individual con stepper y muestra las dos cards recurrentes", async () => {
    await montar();
    expect(boton("Clase individual").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("nav[aria-label=\"Progreso de la nueva clase\"]")).not.toBeNull();
    await modoRecurrente();
    expect(container.querySelector("nav[aria-label=\"Progreso de la nueva clase\"]")).toBeNull();
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
    await pulsar(boton("Clase individual"));
    expect(container.querySelector("nav[aria-label=\"Progreso de la nueva clase\"]")).not.toBeNull();
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
    expect([...filas].map((fila) => fila.querySelector("td:last-child [data-badges]")?.textContent)).toEqual(["Libre", "Libre"]);
    expect(filas[0]?.classList.contains("bg-card")).toBe(true);
    expect(panel.textContent).toContain("2 clases");
    expect(panel.textContent).toContain("martes 16:00–18:00");
    expect(panel.textContent).toContain("Física con Ana Pérez");
    expect(panel.textContent).toContain("estado inicial Disponible, 0 alumnos");
    expect(panel.textContent).not.toContain("fechas tienen conflicto");
    expect(boton("Confirmar generación").textContent).toBe("Confirmar generación (2 clases)");
    expect(boton("Confirmar generación").disabled).toBe(false);
    expect(boton("Confirmar generación").classList.contains("w-full")).toBe(false);
    expect(llamadas("POST", "/api/turnos")).toHaveLength(0);
  });

  it("muestra alerta, badges de motivos y filas libres junto a conflictos", async () => {
    rutas = (url) => url === "/api/turnos/generacion/vista-previa" ? respuesta(vistaDe([fila(desde, { estado: "CONFLICTO", motivos: ["AULA_OCUPADA", "PROFESOR_OCUPADO"], solo_excluible: true }), fila(hasta)], 1)) : undefined;
    await configurar(); await pulsar(boton("Ver vista previa"));
    const panel = container.querySelector('[data-testid="vista-previa-recurrente"]')!;
    const filas = panel.querySelectorAll('table[aria-label="Fechas de la vista previa"] tbody tr');
    expect(filas).toHaveLength(2);
    expect(panel.textContent).toContain("1 fecha tiene conflicto.");
    expect(panel.textContent).toContain("Cambiá el aula de las fechas con el aula ocupada o excluilas; las fechas con el profesor ocupado solo pueden excluirse.");
    expect(panel.textContent).not.toContain("Elegí otra aula para todo el rango");
    expect(panel.querySelector("svg")).not.toBeNull();
    expect(filas[0]?.classList.contains("bg-warning/20")).toBe(true);
    expect([...filas[0]!.querySelectorAll("td:last-child [data-badges] span")].map((badge) => badge.textContent)).toEqual(["Aula ocupada", "Profesor con otra clase"]);
    expect(filas[1]?.querySelector("td:last-child [data-badges]")?.textContent).toBe("Libre");
    expect(panel.textContent).toContain("1 fecha de hoy vencida fue omitida");
    expect(panel.textContent).toContain("Resolvé los conflictos para habilitar la generación.");
    expect(boton("Confirmar generación").textContent).toBe("Confirmar generación (2 clases)");
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
    await pulsar(boton("Confirmar generación"));
    expect(llamadas("POST", "/api/turnos/generacion")).toHaveLength(0);
    act(() => { botonDialogo("Generar clases").click(); botonDialogo("Procesando…")?.click(); });
    expect(llamadas("POST", "/api/turnos/generacion")).toHaveLength(1);
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion")[0]?.[1]?.body))).toEqual(JSON.parse(String(llamadas("POST", "/api/turnos/generacion/vista-previa")[0]?.[1]?.body)));
    await act(async () => { resolver(respuesta({ generacion_id: "cgrupo", cantidad: 2, turno_ids: ["cuno", "cdos"], aulas_cambiadas: 0, fechas_excluidas: 0 }, 201)); });
    expect(container.querySelector('[data-testid="vista-previa-recurrente"]')?.textContent).toContain("Se generaron 2 clases correctamente");
  });

  it("409 pide sola una vista previa nueva e interactiva, con el aviso de disponibilidad", async () => {
    const recalculada = vistaDe([fila(desde, { estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"], solo_excluible: true }), fila(hasta)]);
    let previas = 0;
    rutas = (url) => url === "/api/turnos/generacion" ? respuesta(null, 409, { code: "GENERACION_CON_CONFLICTOS", message: "Conflicto" })
      : url === "/api/turnos/generacion/vista-previa" ? respuesta(++previas === 1 ? vista : recalculada) : undefined;
    await configurar(); await pulsar(boton("Ver vista previa")); await pulsar(boton("Confirmar generación"));
    await pulsar(botonDialogo("Generar clases")); await esperar();
    const panel = container.querySelector('[data-testid="vista-previa-recurrente"]')!;
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
    expect(llamadas("POST", "/api/turnos/generacion/vista-previa")).toHaveLength(2);
    expect(panel.textContent).toContain("La disponibilidad cambió desde la vista previa");
    expect(panel.textContent).toContain("Profesor con otra clase");
    expect(panel.querySelector(`tr[data-fecha="${desde}"] button[aria-label^="Excluir"]`)).not.toBeNull();
    expect(boton("Confirmar generación").disabled).toBe(true);
  });
});

describe("HU-C-21: acciones por fila de la vista previa", () => {
  const tercera = martesFuturo(3);
  const aulasDelCentro = { "aula-1": { nombre: "Aula 1", capacidad: 20 }, "aula-2": { nombre: "Aula 2", capacidad: 30 }, "aula-3": { nombre: "Aula 3", capacidad: 8 } } as Record<string, { nombre: string; capacidad: number }>;
  type Pedido = { aula_id: string; aulas_por_fecha?: { fecha: string; aula_id: string }[]; fechas_excluidas?: string[] };
  // Servidor simulado: aulas ocupadas y profesor ocupado por fecha; arma la vista previa a partir del pedido.
  let ocupadas: Record<string, string[]>;
  let profesorOcupado: string[];
  let libresDisponibles: (fecha: string) => Respuesta | Promise<Respuesta>;
  const libresDe = (fecha: string) => Object.entries(aulasDelCentro)
    .filter(([id]) => !(ocupadas[fecha] ?? []).includes(id))
    .map(([id, { nombre, capacidad }]) => ({ id, nombre, capacidad }))
    .sort((a, b) => a.capacidad - b.capacidad);
  const servidor = (pedido: Pedido) => vistaDe([desde, hasta, tercera].map((fecha) => {
    const elegida = pedido.aulas_por_fecha?.find((item) => item.fecha === fecha)?.aula_id;
    const aulaId = elegida ?? pedido.aula_id;
    const base = { aula: { id: aulaId, nombre: aulasDelCentro[aulaId]!.nombre }, aula_cambiada: Boolean(elegida), cupo: aulasDelCentro[aulaId]!.capacidad, cupo_aula_por_defecto: aulasDelCentro[pedido.aula_id]!.capacidad };
    if (pedido.fechas_excluidas?.includes(fecha)) return fila(fecha, { ...base, excluida: true });
    const motivos = [...((ocupadas[fecha] ?? []).includes(aulaId) ? ["AULA_OCUPADA"] : []), ...(profesorOcupado.includes(fecha) ? ["PROFESOR_OCUPADO"] : [])];
    const soloExcluible = motivos.includes("PROFESOR_OCUPADO");
    return fila(fecha, { ...base, estado: motivos.length ? "CONFLICTO" : "OK", motivos, solo_excluible: soloExcluible,
      sin_aulas_libres: motivos.includes("AULA_OCUPADA") && !soloExcluible && libresDe(fecha).length === 0 });
  }));
  const pedidos = () => llamadas("POST", "/api/turnos/generacion/vista-previa").map(([, init]) => JSON.parse(String(init?.body)) as Pedido & Record<string, unknown>);
  const ultimoPedido = () => pedidos().at(-1)!;
  const filaDe = (fecha: string) => container.querySelector<HTMLTableRowElement>(`tr[data-fecha="${fecha}"]`)!;
  const badges = (fecha: string) => [...filaDe(fecha).querySelectorAll("[data-badges] span")].map((badge) => badge.textContent);
  const accion = (fecha: string, inicio: string) => filaDe(fecha).querySelector<HTMLButtonElement>(`button[aria-label^="${inicio}"]`);
  const accionesDe = (fecha: string) => [...filaDe(fecha).querySelectorAll("[data-acciones] button")].map((boton) => boton.textContent);
  const verVistaPrevia = async () => { await configurar(); await seleccionarFecha("Hasta", tercera); await pulsar(boton("Ver vista previa")); await esperar(); };

  beforeEach(() => {
    ocupadas = {};
    profesorOcupado = [];
    libresDisponibles = (fecha) => respuesta(libresDe(fecha));
    rutas = (url, init) => {
      if (url === "/api/turnos/generacion/vista-previa") return respuesta(servidor(JSON.parse(String(init?.body))));
      if (url.startsWith("/api/turnos/generacion/aulas-libres?")) return libresDisponibles(new URLSearchParams(url.split("?")[1]).get("fecha")!);
      return undefined;
    };
  });

  it("muestra cada fila según su situación: libre, aula ocupada, sin aulas libres y profesor con otra clase", async () => {
    ocupadas = { [desde]: ["aula-1"], [hasta]: ["aula-1", "aula-2", "aula-3"], [tercera]: ["aula-1"] };
    profesorOcupado = [tercera];
    await verVistaPrevia();
    expect(badges(desde)).toEqual(["Aula ocupada"]);
    expect(accionesDe(desde)).toEqual(["Cambiar aula", "Excluir esta fecha"]);
    expect(badges(hasta)).toEqual(["Aula ocupada", "Sin aulas libres en este horario"]);
    expect(accionesDe(hasta)).toEqual(["Excluir esta fecha"]);
    expect(badges(tercera)).toEqual(["Aula ocupada", "Profesor con otra clase"]);
    expect(accionesDe(tercera)).toEqual(["Excluir esta fecha"]);
    expect(accion(desde, "Cambiar el aula del")?.getAttribute("aria-label")).toMatch(/^Cambiar el aula del martes \d{2}\/\d{2}$/);
    expect(container.querySelector('[data-testid="vista-previa-recurrente"]')?.textContent).toContain("3 fechas tienen conflicto.");
  });

  it("«Cambiar aula» abre el selector en la fila, con estados, orden del servidor y reintento", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    let fallar = true;
    let liberar: () => void = () => {};
    libresDisponibles = (fecha) => fallar ? respuesta(null, 500, { message: "Error" }) : new Promise((resolver) => { liberar = () => resolver(respuesta(libresDe(fecha))); });
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!);
    await esperar();
    expect(filaDe(desde).querySelector('[role="alert"]')?.textContent).toContain("No se pudieron cargar las aulas libres.");
    fallar = false;
    await pulsar([...filaDe(desde).querySelectorAll("button")].find((b) => b.textContent === "Reintentar")!);
    expect(filaDe(desde).querySelector('[role="status"]')?.textContent).toBe("Cargando aulas libres…");
    await act(async () => { liberar(); }); await esperar();
    expect([...filaDe(desde).querySelectorAll("[data-selector-aulas] li button")].map((b) => b.textContent)).toEqual(["Aula 3 · capacidad 8", "Aula 2 · capacidad 30"]);
    expect(accion(desde, "Cambiar el aula del")?.disabled).toBe(true);
    await pulsar([...filaDe(desde).querySelectorAll("button")].find((b) => b.textContent === "Cancelar")!);
    expect(filaDe(desde).querySelector("[data-selector-aulas]")).toBeNull();
    expect(pedidos()).toHaveLength(1);
  });

  it("elegir un aula pide la vista previa con esa fecha, marca «(cambiada)» y el cupo distinto sin tocar las demás filas", async () => {
    ocupadas = { [desde]: ["aula-1"], [hasta]: ["aula-1"] };
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar([...filaDe(desde).querySelectorAll("[data-selector-aulas] li button")].find((b) => b.textContent === "Aula 3 · capacidad 8")!); await esperar();
    expect(ultimoPedido().aulas_por_fecha).toEqual([{ fecha: desde, aula_id: "aula-3" }]);
    expect(ultimoPedido()).not.toHaveProperty("fechas_excluidas");
    expect(badges(desde)).toEqual(["Libre · Aula 3 (cambiada)"]);
    expect(filaDe(desde).textContent).toContain("cupo 8 en lugar de 20");
    expect(filaDe(desde).querySelector("td:nth-child(3)")?.textContent).toBe("Aula 3");
    expect(accionesDe(desde)).toEqual(["Deshacer", "Excluir esta fecha"]);
    expect(badges(hasta)).toEqual(["Aula ocupada"]);
    expect(filaDe(tercera).querySelector("td:nth-child(3)")?.textContent).toBe("Aula 1");
    // Con la misma capacidad no se muestra el cupo.
    await pulsar(accion(hasta, "Cambiar el aula del")!); await esperar();
    aulasDelCentro["aula-2"]!.capacidad = 20;
    await pulsar([...filaDe(hasta).querySelectorAll("[data-selector-aulas] li button")].find((b) => b.textContent?.startsWith("Aula 2"))!); await esperar();
    aulasDelCentro["aula-2"]!.capacidad = 30;
    expect(badges(hasta)).toEqual(["Libre · Aula 2 (cambiada)"]);
    expect(filaDe(hasta).textContent).not.toContain("en lugar de");
    expect(ultimoPedido().aulas_por_fecha).toEqual([{ fecha: desde, aula_id: "aula-3" }, { fecha: hasta, aula_id: "aula-2" }]);
  });

  it("«Deshacer» quita la fecha de aulas_por_fecha y vuelve a pedir la vista previa", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar(filaDe(desde).querySelector("[data-selector-aulas] li button")!); await esperar();
    await pulsar(accion(desde, "Deshacer el cambio de aula del")!); await esperar();
    expect(ultimoPedido()).not.toHaveProperty("aulas_por_fecha");
    expect(badges(desde)).toEqual(["Aula ocupada"]);
  });

  it("si el aula elegida se ocupa y la por defecto se libera, elegir la por defecto equivale a «Deshacer» (nunca se envía, D10)", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar([...filaDe(desde).querySelectorAll("[data-selector-aulas] li button")].find((b) => b.textContent?.startsWith("Aula 3"))!); await esperar();
    // Cambia la disponibilidad: el aula elegida se ocupa y la por defecto queda libre.
    ocupadas = { [desde]: ["aula-3"] };
    await pulsar(boton("Ver vista previa")); await esperar();
    expect(badges(desde)).toEqual(["Aula ocupada"]);
    expect(accionesDe(desde)).toEqual(["Cambiar aula", "Deshacer", "Excluir esta fecha"]);
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar([...filaDe(desde).querySelectorAll("[data-selector-aulas] li button")].find((b) => b.textContent?.startsWith("Aula 1"))!); await esperar();
    expect(ultimoPedido()).not.toHaveProperty("aulas_por_fecha");
    expect(pedidos().every((pedido) => !pedido.aulas_por_fecha?.some(({ aula_id }) => aula_id === pedido.aula_id))).toBe(true);
    expect(badges(desde)).toEqual(["Libre"]);
  });

  it("si el selector llega vacío, se cierra y pide una vista previa nueva", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    libresDisponibles = () => { ocupadas = { [desde]: ["aula-1", "aula-2", "aula-3"] }; return respuesta([]); };
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar(); await esperar();
    expect(filaDe(desde).querySelector("[data-selector-aulas]")).toBeNull();
    expect(pedidos()).toHaveLength(2);
    expect(badges(desde)).toEqual(["Aula ocupada", "Sin aulas libres en este horario"]);
  });

  it("excluye fechas libres y con conflicto, muestra «Excluida» e «Incluir de nuevo», y la última no se puede excluir", async () => {
    profesorOcupado = [hasta];
    await verVistaPrevia();
    const panel = container.querySelector('[data-testid="vista-previa-recurrente"]')!;
    await pulsar(accion(hasta, "Excluir la fecha")!); await esperar();
    expect(ultimoPedido().fechas_excluidas).toEqual([hasta]);
    expect(badges(hasta)).toEqual(["Excluida"]);
    expect(accionesDe(hasta)).toEqual(["Incluir de nuevo"]);
    expect(filaDe(hasta).classList.contains("text-muted-foreground")).toBe(true);
    expect(panel.textContent).toContain("2 clases");
    expect(panel.textContent).toContain("· 1 excluida");
    expect(boton("Confirmar generación").textContent).toBe("Confirmar generación (2 clases)");
    expect(boton("Confirmar generación").disabled).toBe(false);
    await pulsar(accion(desde, "Excluir la fecha")!); await esperar();
    expect(ultimoPedido().fechas_excluidas).toEqual([desde, hasta]);
    expect(accion(tercera, "Excluir la fecha")?.disabled).toBe(true);
    expect(filaDe(tercera).textContent).toContain("Tiene que quedar al menos una fecha para generar.");
    expect(document.getElementById(accion(tercera, "Excluir la fecha")!.getAttribute("aria-describedby")!)?.textContent).toBe("Tiene que quedar al menos una fecha para generar.");
    await pulsar(accion(desde, "Incluir de nuevo la fecha")!); await esperar();
    expect(ultimoPedido().fechas_excluidas).toEqual([hasta]);
    expect(accion(tercera, "Excluir la fecha")?.disabled).toBe(false);
  });

  it("si una acción falla, conserva la vista previa anterior y no cambia las listas", async () => {
    await verVistaPrevia();
    rutas = (url) => url === "/api/turnos/generacion/vista-previa" ? respuesta(null, 400, { code: "VALIDATION_ERROR", message: "La fecha no pertenece a las fechas a generar" }) : undefined;
    await pulsar(accion(desde, "Excluir la fecha")!); await esperar();
    expect(container.querySelector('[data-testid="vista-previa-recurrente"] [role="alert"]')?.textContent).toBe("La fecha no pertenece a las fechas a generar");
    expect(badges(desde)).toEqual(["Libre"]);
    expect(boton("Confirmar generación").disabled).toBe(false);
    rutas = (url, init) => url === "/api/turnos/generacion/vista-previa" ? respuesta(servidor(JSON.parse(String(init?.body)))) : undefined;
    await pulsar(accion(hasta, "Excluir la fecha")!); await esperar();
    expect(ultimoPedido().fechas_excluidas).toEqual([hasta]);
  });

  it("cambiar un dato del formulario vacía las listas y la vista previa (D9)", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    await verVistaPrevia();
    await pulsar(accion(hasta, "Excluir la fecha")!); await esperar();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar(filaDe(desde).querySelector("[data-selector-aulas] li button")!); await esperar();
    expect(ultimoPedido()).toMatchObject({ fechas_excluidas: [hasta], aulas_por_fecha: [{ fecha: desde }] });
    await seleccionar("hora-recurrente", "16:30");
    expect(container.querySelector('[data-testid="vista-previa-recurrente"] table')).toBeNull();
    await seleccionar("hora-recurrente", "16:00");
    expect(container.querySelector('[data-testid="vista-previa-recurrente"] table')).toBeNull();
    await pulsar(boton("Ver vista previa")); await esperar();
    expect(ultimoPedido()).not.toHaveProperty("fechas_excluidas");
    expect(ultimoPedido()).not.toHaveProperty("aulas_por_fecha");
  });

  it("descarta una respuesta que vuelve después de cambiar el formulario", async () => {
    let liberar: () => void = () => {};
    await verVistaPrevia();
    rutas = (url, init) => url === "/api/turnos/generacion/vista-previa"
      ? new Promise<Respuesta>((resolver) => { liberar = () => resolver(respuesta(servidor(JSON.parse(String(init?.body))))); }) : undefined;
    await pulsar(accion(desde, "Excluir la fecha")!);
    expect(accion(hasta, "Excluir la fecha")?.disabled).toBe(true);
    await seleccionarFecha("Hasta", hasta);
    await act(async () => { liberar(); }); await esperar();
    expect(container.querySelector('[data-testid="vista-previa-recurrente"] table')).toBeNull();
  });

  it("el diálogo muestra los datos de la generación y el resumen final informa los tres números", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar(filaDe(desde).querySelector("[data-selector-aulas] li button")!); await esperar();
    await pulsar(accion(hasta, "Excluir la fecha")!); await esperar();
    rutas = (url) => url === "/api/turnos/generacion" ? respuesta({ generacion_id: "cgrupo", cantidad: 2, turno_ids: ["cuno", "cdos"], aulas_cambiadas: 1, fechas_excluidas: 1 }, 201) : undefined;
    await pulsar(boton("Confirmar generación"));
    const dialogo = document.body.querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain("¿Estás seguro de que querés generar 2 clases de Física con Ana Pérez?");
    expect(dialogo.textContent).toContain("1 con el aula cambiada · 1 fecha excluida");
    expect(dialogo.textContent).not.toContain("Esta acción no se puede deshacer.");
    await pulsar(botonDialogo("Generar clases")); await esperar();
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion")[0]?.[1]?.body))).toEqual(ultimoPedido());
    expect(JSON.parse(String(llamadas("POST", "/api/turnos/generacion")[0]?.[1]?.body))).not.toHaveProperty("resolver_automaticamente");
    const exito = container.querySelector('[data-testid="vista-previa-recurrente"] [role="status"]')!;
    expect(exito.textContent).toContain("Se generaron 2 clases correctamente.");
    expect(exito.textContent).toContain("En 1 se cambió el aula.");
    expect(exito.textContent).toContain("Se excluyó 1 fecha.");
  });

  it("sin cambios ni exclusiones, el diálogo no lleva detalle y el resumen dice «ninguna»", async () => {
    await verVistaPrevia();
    rutas = (url) => url === "/api/turnos/generacion" ? respuesta({ generacion_id: "cgrupo", cantidad: 3, turno_ids: ["a", "b", "c"], aulas_cambiadas: 0, fechas_excluidas: 0 }, 201) : undefined;
    await pulsar(boton("Confirmar generación"));
    expect(document.body.querySelector('[role="alertdialog"]')?.textContent).not.toContain("con el aula cambiada");
    await pulsar(botonDialogo("Generar clases")); await esperar();
    const exito = container.querySelector('[data-testid="vista-previa-recurrente"]')!.textContent;
    expect(exito).toContain("En ninguna se cambió el aula.");
    expect(exito).toContain("No se excluyó ninguna fecha.");
  });

  it("otro rechazo al confirmar se ve dentro del diálogo, sin cerrarlo", async () => {
    await verVistaPrevia();
    rutas = (url) => url === "/api/turnos/generacion" ? respuesta(null, 409, { code: "PROFESOR_NO_DICTA_MATERIA", message: "El profesor no dicta la materia seleccionada" }) : undefined;
    await pulsar(boton("Confirmar generación"));
    await pulsar(botonDialogo("Generar clases")); await esperar();
    expect(document.body.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toContain("El profesor no dicta la materia seleccionada");
    expect(llamadas("POST", "/api/turnos/generacion/vista-previa")).toHaveLength(1);
  });

  it("el 409 conserva las elecciones al pedir la vista previa nueva (§5.7)", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar([...filaDe(desde).querySelectorAll("[data-selector-aulas] li button")].find((b) => b.textContent?.startsWith("Aula 3"))!); await esperar();
    await pulsar(accion(hasta, "Excluir la fecha")!); await esperar();
    const antes = ultimoPedido();
    ocupadas = { [desde]: ["aula-1", "aula-3"] };
    rutas = (url, init) => url === "/api/turnos/generacion" ? respuesta(null, 409, { code: "GENERACION_CON_CONFLICTOS", message: "Un recurso dejó de estar disponible" })
      : url === "/api/turnos/generacion/vista-previa" ? respuesta(servidor(JSON.parse(String(init?.body))))
        : url.startsWith("/api/turnos/generacion/aulas-libres?") ? respuesta(libresDe(desde)) : undefined;
    await pulsar(boton("Confirmar generación"));
    await pulsar(botonDialogo("Generar clases")); await esperar();
    expect(ultimoPedido()).toEqual(antes);
    expect(badges(desde)).toEqual(["Aula ocupada"]);
    expect(accionesDe(desde)).toEqual(["Cambiar aula", "Deshacer", "Excluir esta fecha"]);
    expect(container.querySelector('[data-testid="vista-previa-recurrente"]')?.textContent).toContain("La disponibilidad cambió desde la vista previa");
  });

  it("ningún texto visible de la generación dice «turno»", async () => {
    ocupadas = { [desde]: ["aula-1"] };
    profesorOcupado = [tercera];
    await verVistaPrevia();
    await pulsar(accion(desde, "Cambiar el aula del")!); await esperar();
    await pulsar(boton("Confirmar generación"));
    const textos = [container.textContent, ...[...container.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"))].join(" ");
    expect(textos).not.toMatch(/\bturnos?\b/i);
  });
});
