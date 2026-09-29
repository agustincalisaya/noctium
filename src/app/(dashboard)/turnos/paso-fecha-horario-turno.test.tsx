// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));

const { PasoFechaHorarioTurno } = await import("./paso-fecha-horario-turno");
const FECHAS = [
  { fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [{ hora_inicio: "09:00", hora_fin: "12:00", tramos_libres: [{ desde: "09:00", hasta: "12:00" }], inicios: ["09:17", "10:00"] }] },
  { fecha: "2026-10-02", dia_semana: "VIERNES", franjas: [{ hora_inicio: "10:00", hora_fin: "12:00", tramos_libres: [{ desde: "10:00", hasta: "12:00" }], inicios: ["10:30"] }] },
];
type FechaFixture = {
  fecha: string;
  dia_semana: string;
  franjas: { hora_inicio: string; hora_fin: string; tramos_libres: { desde: string; hasta: string }[]; inicios: string[] }[];
};
const respuesta = (fechas: FechaFixture[], ok = true, message?: string) => ({ ok, json: async () => ({ data: ok ? { fechas } : null, error: message ? { message } : null }) });
const volver = vi.fn();
const continuar = vi.fn();

function Harness({ profesorId = "profesor-1", duracionesPermitidas = [60, 120, 180], inicial = null, fechaInicial = "", horaInicial = "" }: {
  profesorId?: string; duracionesPermitidas?: readonly number[]; inicial?: number | null; fechaInicial?: string; horaInicial?: string;
}) {
  const [duracion, setDuracion] = useState<number | null>(inicial);
  const [fecha, setFecha] = useState(fechaInicial);
  const [hora, setHora] = useState(horaInicial);
  return <PasoFechaHorarioTurno materiaId="materia 1" profesorId={profesorId} duracionesPermitidas={duracionesPermitidas} duracionMin={duracion} fecha={fecha} horaInicio={hora}
    onDuracionChange={setDuracion} onFechaChange={setFecha} onHoraChange={setHora} onVolverProfesor={volver} onContinuar={continuar} />;
}

let root: Root;
let container: HTMLDivElement;
const montar = async (props?: Parameters<typeof Harness>[0]) => { await act(async () => { root.render(<Harness {...props} />); }); };
const pulsar = async (elemento: Element) => { await act(async () => { (elemento as HTMLElement).click(); }); };
const boton = (texto: string) => [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(texto))!;

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockResolvedValue(respuesta(FECHAS));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-07 PasoFechaHorarioTurno", () => {
  it("exige duración antes de consultar y usa solo materia, profesor y duración en el GET", async () => {
    await montar();
    expect(container.textContent).toContain("Elegí una duración para ver fechas y horarios.");
    expect(fetch).not.toHaveBeenCalled();
    await pulsar(container.querySelector('input[value="120"]')!);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/turnos/profesores/profesor-1/disponibilidad?materia_id=materia+1&duracion_min=120",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.textContent).toContain("2026-10-01");
  });

  it("muestra solo las duraciones recibidas por prop", async () => {
    await montar({ duracionesPermitidas: [60, 180] });
    expect([...container.querySelectorAll('input[name="duracion_min"]')].map((input) => (input as HTMLInputElement).value)).toEqual(["60", "180"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("muestra loading mientras espera la respuesta", async () => {
    fetch.mockImplementationOnce(() => new Promise(() => {}));
    await montar({ inicial: 60 });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Cargando disponibilidad");
    expect(container.textContent).not.toContain("2026-10-01");
  });

  it("muestra solo fechas e inicios del backend, permite seleccionar y continuar sin POST/PATCH", async () => {
    await montar({ inicial: 60 });
    expect(container.textContent).toContain("2026-10-01");
    expect(container.textContent).toContain("2026-10-02");
    expect(container.textContent).not.toContain("09:00");
    await pulsar(boton("2026-10-01"));
    expect(container.textContent).toContain("09:17");
    expect(container.textContent).toContain("10:00");
    expect(container.textContent).not.toContain("09:30");
    await pulsar(boton("09:17"));
    expect(boton("Continuar a aula").disabled).toBe(false);
    await pulsar(boton("Continuar a aula"));
    expect(continuar).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  it("al cambiar fecha limpia una hora que no corresponde a la nueva fecha", async () => {
    await montar({ inicial: 60, fechaInicial: "2026-10-01", horaInicial: "09:17" });
    await pulsar(boton("2026-10-02"));
    expect(boton("09:17")).toBeUndefined();
    expect(container.textContent).toContain("10:30");
    expect(boton("Continuar a aula").disabled).toBe(true);
  });

  it("conserva los inicios de otra franja aunque la primera no tenga opciones", async () => {
    fetch.mockResolvedValueOnce(respuesta([{
      fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [
        { hora_inicio: "08:00", hora_fin: "10:00", tramos_libres: [], inicios: [] },
        { hora_inicio: "11:00", hora_fin: "12:00", tramos_libres: [{ desde: "11:00", hasta: "12:00" }], inicios: ["11:00", "11:30"] },
      ],
    }]));
    await montar({ inicial: 60 });
    expect(container.textContent).toContain("2026-10-01");
    await pulsar(boton("2026-10-01"));
    expect(boton("11:00")).toBeDefined();
    expect(boton("11:30")).toBeDefined();
    expect(container.textContent).not.toContain("08:00");
    expect(container.textContent).not.toContain("08:30");
  });

  it("muestra una sola vez un inicio repetido entre dos franjas", async () => {
    fetch.mockResolvedValueOnce(respuesta([{
      fecha: "2026-10-01", dia_semana: "JUEVES", franjas: [
        { hora_inicio: "09:00", hora_fin: "11:00", tramos_libres: [], inicios: ["10:00"] },
        { hora_inicio: "10:00", hora_fin: "12:00", tramos_libres: [], inicios: ["10:00", "11:00"] },
      ],
    }]));
    await montar({ inicial: 60 });
    await pulsar(boton("2026-10-01"));
    expect([...container.querySelectorAll("button")].filter((item) => item.textContent === "10:00")).toHaveLength(1);
  });

  it("al cambiar duración invalida fecha/hora y recarga disponibilidad", async () => {
    await montar({ inicial: 60, fechaInicial: "2026-10-01", horaInicial: "09:17" });
    expect(boton("Continuar a aula").disabled).toBe(false);
    await pulsar(container.querySelector('input[value="180"]')!);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![0]).toContain("duracion_min=180");
    expect(container.textContent).not.toContain("Horarios disponibles para 2026-10-01");
    expect(boton("Continuar a aula").disabled).toBe(true);
  });

  it("fechas vacías muestra el mensaje exacto y permite volver a Profesor", async () => {
    fetch.mockResolvedValueOnce(respuesta([]));
    await montar({ inicial: 60 });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Este profesor no tiene horarios disponibles para esta materia en este momento");
    await pulsar(boton("Volver a Profesor"));
    expect(volver).toHaveBeenCalledOnce();
  });

  it("muestra error HTTP y permite reintentar", async () => {
    fetch.mockResolvedValueOnce(respuesta([], false, "No se pudo consultar la disponibilidad"));
    await montar({ inicial: 60 });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("No se pudo consultar la disponibilidad");
    await pulsar(boton("Reintentar"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("2026-10-01");
  });

  it("ignora la respuesta tardía de un profesor anterior", async () => {
    let resolverA: (valor: ReturnType<typeof respuesta>) => void = () => {};
    let resolverB: (valor: ReturnType<typeof respuesta>) => void = () => {};
    fetch.mockImplementationOnce(() => new Promise<ReturnType<typeof respuesta>>((resolve) => { resolverA = resolve; }));
    fetch.mockImplementationOnce(() => new Promise<ReturnType<typeof respuesta>>((resolve) => { resolverB = resolve; }));

    await montar({ profesorId: "profesor-A", inicial: 60 });
    await montar({ profesorId: "profesor-B", inicial: 60 });
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
    expect(fetch.mock.calls[1]![0]).toContain("profesor-B");

    await act(async () => { resolverB(respuesta([FECHAS[1]!])); });
    expect(container.textContent).toContain("2026-10-02");
    await act(async () => { resolverA(respuesta([FECHAS[0]!])); });
    expect(container.textContent).toContain("2026-10-02");
    expect(container.textContent).not.toContain("2026-10-01");
  });
});
