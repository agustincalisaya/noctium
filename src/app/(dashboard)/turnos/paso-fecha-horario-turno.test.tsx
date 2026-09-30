// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));

const { PasoFechaHorarioTurno } = await import("./paso-fecha-horario-turno");
const bloque = (inicio: string, fin: string, estado: "LIBRE" | "OCUPADO" | "VENCIDO") => ({ inicio, fin, estado, seleccionable: estado === "LIBRE" });
const franja = (bloques: ReturnType<typeof bloque>[]) => ({ hora_inicio: "09:00", hora_fin: "12:00", bloques });
const libre = franja([bloque("09:00", "10:00", "LIBRE"), bloque("10:00", "11:00", "OCUPADO"), bloque("11:00", "12:00", "LIBRE")]);
const ocupado = franja([bloque("09:00", "10:00", "OCUPADO"), bloque("10:00", "11:00", "OCUPADO")]);
const diasSemana = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
function mes(anio: number, numeroMes: number, etiqueta: string) {
  return { anio, mes: numeroMes, etiqueta, dias: Array.from({ length: new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate() }, (_, indice) => {
    const numero = indice + 1;
    const fecha = `${anio}-${String(numeroMes).padStart(2, "0")}-${String(numero).padStart(2, "0")}`;
    const dia = diasSemana[new Date(`${fecha}T00:00:00.000Z`).getUTCDay()]!;
    const enRango = fecha >= "2026-10-01" && fecha <= "2026-11-03";
    const franjas = fecha === "2026-10-01" || fecha === "2026-11-01" ? [libre] : fecha === "2026-10-02" ? [ocupado] : [];
    const seleccionable = enRango && (fecha === "2026-10-01" || fecha === "2026-11-01");
    return { fecha, dia_semana: dia, numero, en_rango: enRango, operativo: enRango, tiene_horarios_libres: seleccionable, seleccionable, franjas };
  }) };
}
const AGENDA = { profesor: { id: "profesor-1", nombre_completo: "Pérez, Ana" }, duracion_min: 60, granularidad_min: 30,
  rango: { desde: "2026-10-01", hasta: "2026-11-03" }, meses: [mes(2026, 10, "Octubre 2026"), mes(2026, 11, "Noviembre 2026")] };
const respuesta = (agenda: typeof AGENDA, ok = true, message?: string) => ({ ok, json: async () => ({ data: ok ? agenda : null, error: message ? { message } : null }) });
const volver = vi.fn();
const continuar = vi.fn();

function Harness({ profesorId = "profesor-1", duracionesPermitidas = [60, 120, 180], inicial = 60, fechaInicial = "", horaInicial = "" }: {
  profesorId?: string; duracionesPermitidas?: readonly number[]; inicial?: number | null; fechaInicial?: string; horaInicial?: string;
}) {
  const [duracion, setDuracion] = useState<number | null>(inicial);
  const [fecha, setFecha] = useState(fechaInicial);
  const [hora, setHora] = useState(horaInicial);
  return <PasoFechaHorarioTurno materiaId="materia 1" profesorId={profesorId} profesorNombre="Ana Pérez" duracionesPermitidas={duracionesPermitidas} duracionMin={duracion} fecha={fecha} horaInicio={hora}
    onDuracionChange={setDuracion} onFechaChange={setFecha} onHoraChange={setHora} onVolverProfesor={volver} onContinuar={continuar} />;
}

let root: Root;
let container: HTMLDivElement;
const montar = async (props?: Parameters<typeof Harness>[0]) => { await act(async () => { root.render(<Harness {...props} />); }); };
const pulsar = async (elemento: Element) => { await act(async () => { (elemento as HTMLElement).click(); }); };
const boton = (texto: string) => [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(texto))!;
const dia = (fecha: string) => container.querySelector<HTMLButtonElement>(`button[data-fecha="${fecha}"]`)!;
const horario = (texto: string) => [...container.querySelectorAll('fieldset label[data-estado]')].find((item) => item.textContent?.includes(texto))!;

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockResolvedValue(respuesta(AGENDA));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("Paso 3 agenda y calendario", () => {
  it("consulta solo agenda-wizard sin rango hardcodeado ni POST/PATCH y muestra duración elegida", async () => {
    await montar();
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/turnos/profesores/profesor-1/agenda-wizard?materia_id=materia+1&duracion_min=60", expect.objectContaining({ cache: "no-store" }));
    expect(container.querySelector<HTMLInputElement>('input[name="duracion_min"][value="60"]')?.checked).toBe(true);
    expect([...container.querySelectorAll('input[name="duracion_min"]')].map((input) => (input as HTMLInputElement).value)).toEqual(["60", "120", "180"]);
    expect(fetch.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  it("muestra mes real, grilla, estados de días y límites de navegación", async () => {
    await montar();
    expect(container.textContent).toContain("Octubre 2026");
    expect(container.querySelectorAll('[role="grid"] > button')).toHaveLength(31);
    expect(container.textContent).toContain("Con horarios libres");
    expect(container.textContent).toContain("Seleccionado");
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Mes anterior"]')?.disabled).toBe(true);
    expect(dia("2026-10-01").dataset.estado).toBe("libre");
    expect(dia("2026-10-01").className).toContain("bg-success");
    expect(dia("2026-10-01").className).toContain("text-success-foreground");
    expect(container.querySelector('i.bg-success')).not.toBeNull();
    expect(dia("2026-10-02").dataset.estado).toBe("sin-libres");
    expect(dia("2026-10-03").disabled).toBe(true);
    await pulsar(container.querySelector('button[aria-label="Mes siguiente"]')!);
    expect(container.textContent).toContain("Noviembre 2026");
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Mes siguiente"]')?.disabled).toBe(true);
    expect(dia("2026-11-04").disabled).toBe(true);
    await pulsar(container.querySelector('button[aria-label="Mes anterior"]')!);
    expect(container.textContent).toContain("Octubre 2026");
  });

  it("selecciona día libre y bloque completo, con fecha legible; ocupados visibles, tachados y deshabilitados", async () => {
    await montar();
    await pulsar(dia("2026-10-01"));
    expect(dia("2026-10-01").dataset.estado).toBe("seleccionado");
    expect(container.textContent).toContain("Jueves 1 de octubre");
    expect(container.textContent).toContain("Horario de atención: 09:00–12:00");
    expect(horario("10:00–11:00").className).toContain("line-through");
    expect(horario("10:00–11:00").querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
    expect(container.textContent).toContain("Los horarios tachados no están disponibles: el profesor ya tiene un turno.");
    await pulsar(horario("10:00–11:00"));
    expect(boton("Continuar a aula").disabled).toBe(true);
    await pulsar(horario("09:00–10:00"));
    expect(horario("09:00–10:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    await pulsar(horario("10:00–11:00"));
    expect(horario("09:00–10:00").querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    expect(boton("Continuar a aula").disabled).toBe(false);
    await pulsar(boton("Continuar a aula"));
    expect(continuar).toHaveBeenCalledOnce();
  });

  it("permite inspeccionar día con horario pero sin libres sin seleccionarlo", async () => {
    await montar({ fechaInicial: "2026-10-01", horaInicial: "09:00" });
    await pulsar(dia("2026-10-02"));
    expect(dia("2026-10-02").getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("Viernes 2 de octubre");
    expect(horario("09:00–10:00").querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
    expect(boton("Continuar a aula").disabled).toBe(true);
  });

  it("cambiar duración limpia fecha/hora y vuelve a consultar al servidor", async () => {
    await montar({ fechaInicial: "2026-10-01", horaInicial: "09:00" });
    expect(boton("Continuar a aula").disabled).toBe(false);
    await pulsar(container.querySelector('input[name="duracion_min"][value="180"]')!);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![0]).toContain("duracion_min=180");
    expect(boton("Continuar a aula").disabled).toBe(true);
  });

  it("sin ningún bloque libre conserva mensaje y Volver a Profesor", async () => {
    const sinLibres = structuredClone(AGENDA);
    for (const mes of sinLibres.meses) for (const dia of mes.dias) { dia.seleccionable = false; dia.tiene_horarios_libres = false; }
    fetch.mockResolvedValueOnce(respuesta(sinLibres));
    await montar();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Este profesor no tiene horarios disponibles para esta materia en este momento");
    await pulsar(boton("Volver a Profesor"));
    expect(volver).toHaveBeenCalledOnce();
  });

  it("muestra loading y error con reintento", async () => {
    let resolver: (valor: ReturnType<typeof respuesta>) => void = () => {};
    fetch.mockImplementationOnce(() => new Promise<ReturnType<typeof respuesta>>((resolve) => { resolver = resolve; }));
    await montar();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Cargando disponibilidad");
    await act(async () => { resolver(respuesta(AGENDA, false, "Falló agenda")); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falló agenda");
    await pulsar(boton("Reintentar"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Octubre 2026");
  });

  it("ignora la respuesta tardía de un profesor anterior", async () => {
    let resolverA: (valor: ReturnType<typeof respuesta>) => void = () => {};
    let resolverB: (valor: ReturnType<typeof respuesta>) => void = () => {};
    fetch.mockImplementationOnce(() => new Promise<ReturnType<typeof respuesta>>((resolve) => { resolverA = resolve; }));
    fetch.mockImplementationOnce(() => new Promise<ReturnType<typeof respuesta>>((resolve) => { resolverB = resolve; }));
    await montar({ profesorId: "profesor-A" });
    await montar({ profesorId: "profesor-B" });
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
    await act(async () => { resolverB(respuesta(AGENDA)); });
    expect(container.textContent).toContain("Octubre 2026");
    await act(async () => { resolverA(respuesta({ ...AGENDA, meses: [] })); });
    expect(container.textContent).toContain("Octubre 2026");
  });
});
