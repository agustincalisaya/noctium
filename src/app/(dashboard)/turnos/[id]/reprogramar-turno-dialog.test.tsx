// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAutenticado, exito, fallo } = vi.hoisted(() => ({ fetchAutenticado: vi.fn(), exito: vi.fn(), fallo: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));
vi.mock("sonner", () => ({ toast: { success: exito, error: fallo } }));

const { ReprogramarTurnoDialog } = await import("./reprogramar-turno-dialog");
const { MENSAJE_RESULTADO_INCIERTO } = await import("./turno-acciones-mensajes");

const TURNO = {
  id: "turno-1", fecha: "2026-10-06", hora_inicio: "16:00", hora_fin: "17:00", duracion_minutos: 60, cupo_maximo: 6, alumnos_inscriptos: "2/6",
  alumnos: [{ id: "alumno-1", nombre: "Pérez, Juan", dni: "1" }, { id: "alumno-2", nombre: "Gómez, Lucía", dni: "2" }],
  profesor: "Méndez, Laura", profesor_id: "prof-1", profesor_dni: "3", materia: "Matemática III", materia_id: "m", materia_codigo: "MAT",
  aula: "Aula 3", aula_id: "aula-1", aula_capacidad: 6, estado: "DISPONIBLE" as const, prioridad: "NORMAL" as const,
  creado_en: "", actualizado_en: "", creado_por_id: null, modificado_por_id: null, creado_por: null, acciones_habilitadas: ["reprogramar" as const],
};
const respuesta = (status: number, data: unknown = null, error: unknown = null) => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data, error }) });
const opciones = (fecha: string, inicios: Array<[string, string, boolean]>) => respuesta(200, {
  fecha, duracion_min: 60, tope_fecha: "2026-10-31", inicios: inicios.map(([hora_inicio, hora_fin, actual]) => ({ hora_inicio, hora_fin, actual })),
});
const MISMA_FECHA = opciones("2026-10-06", [["16:00", "17:00", true], ["17:00", "18:00", false], ["18:00", "19:00", false], ["19:00", "20:00", false]]);

let root: Root;
let container: HTMLDivElement;
const cerrar = vi.fn();
const cambio = vi.fn(async () => {});
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
const dialogo = () => document.querySelector('[role="dialog"]')!;
const radio = (hora: string) => document.querySelector<HTMLInputElement>(`input[name="hora_inicio"][value="${hora}"]`);
const boton = (nombre: string) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === nombre) as HTMLButtonElement;
const enviar = () => act(async () => document.querySelector('[role="dialog"] form')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
const montar = async () => { await act(async () => root.render(<ReprogramarTurnoDialog turno={TURNO} onCerrar={cerrar} onCambio={cambio} />)); await esperar(); };
const cambiarFecha = async (valor: string) => {
  const input = document.querySelector<HTMLInputElement>("#reprogramar-fecha")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, valor); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await esperar();
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fetchAutenticado.mockResolvedValue(MISMA_FECHA);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-C-06 Dialog «Reprogramar turno» (mockup pág. 9)", () => {
  it("AC1: textos del mockup, fecha actual precargada y horas desde el endpoint de opciones", async () => {
    await montar();
    expect(fetchAutenticado).toHaveBeenCalledWith("/api/turnos/turno-1/reprogramacion/opciones?fecha=2026-10-06", expect.objectContaining({ cache: "no-store" }));
    const texto = dialogo().textContent!;
    expect(texto).toContain("Reprogramar turno");
    expect(texto).toContain("Cambia fecha y hora de inicio. Profesor (Méndez, Laura), aula y duración se mantienen.");
    expect(texto).toContain("Nueva fecha");
    expect(texto).toContain("Hora de inicio (dentro del horario de atención, 1 h)");
    expect(texto).toContain("Profesor, Aula 3 y alumnos inscriptos disponibles en ese horario.");
    expect(document.querySelector<HTMLInputElement>("#reprogramar-fecha")!.value).toBe("2026-10-06");
    expect(document.querySelector<HTMLInputElement>("#reprogramar-fecha")!.max).toBe("2026-10-31");
    expect([...document.querySelectorAll<HTMLInputElement>('input[name="hora_inicio"]')].map((input) => input.value)).toEqual(["16:00", "17:00", "18:00", "19:00"]);
    expect(boton("Reprogramar").disabled).toBe(true);
  });

  it("la hora actual queda tachada y deshabilitada solo en su fecha; en otra fecha la misma hora se puede elegir", async () => {
    await montar();
    expect(radio("16:00")!.disabled).toBe(true);
    expect(radio("16:00")!.closest("label")!.className).toContain("line-through");
    fetchAutenticado.mockResolvedValue(opciones("2026-10-13", [["16:00", "17:00", false], ["17:00", "18:00", false]]));
    await cambiarFecha("2026-10-13");
    expect(fetchAutenticado).toHaveBeenLastCalledWith("/api/turnos/turno-1/reprogramacion/opciones?fecha=2026-10-13", expect.anything());
    expect(radio("16:00")!.disabled).toBe(false);
    expect(radio("16:00")!.closest("label")!.className).not.toContain("line-through");
  });

  it("sin horarios ese día muestra el aviso vacío", async () => {
    fetchAutenticado.mockResolvedValue(opciones("2026-10-08", []));
    await montar();
    expect(dialogo().textContent).toContain("No hay horarios disponibles para esa fecha");
  });

  it("AC3: reprograma, informa «Turno reprogramado correctamente» y recarga el detalle", async () => {
    await montar();
    await act(async () => radio("17:00")!.click());
    fetchAutenticado.mockResolvedValue(respuesta(200, { id: "turno-1", fecha: "2026-10-06", hora_inicio: "17:00", hora_fin: "18:00", estado: "DISPONIBLE" }));
    await enviar();
    expect(fetchAutenticado).toHaveBeenLastCalledWith("/api/turnos/turno-1/reprogramacion", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha: "2026-10-06", hora_inicio: "17:00" }), cache: "no-store",
    });
    expect(cerrar).toHaveBeenCalledOnce();
    expect(exito).toHaveBeenCalledExactlyOnceWith("Turno reprogramado correctamente");
    expect(cambio).toHaveBeenCalledOnce();
  });

  it("AC2: un conflicto se informa dentro del Dialog nombrando cada recurso y se vuelven a pedir las opciones", async () => {
    await montar();
    await act(async () => radio("17:00")!.click());
    fetchAutenticado.mockResolvedValueOnce(respuesta(409, null, { code: "REPROGRAMACION_CONFLICTO", message: "No disponible", detalles: { conflictos: [
      { recurso: "PROFESOR", id: "prof-1" }, { recurso: "AULA", id: "aula-1" }, { recurso: "ALUMNO", id: "alumno-2" }] } }));
    await enviar();
    await esperar();
    expect(dialogo().querySelector('[role="alert"]')!.textContent).toBe("No disponible en ese horario: Profesor Méndez, Laura · Aula 3 · Alumno Gómez, Lucía");
    expect(cerrar).not.toHaveBeenCalled();
    expect(exito).not.toHaveBeenCalled();
    expect(fetchAutenticado).toHaveBeenLastCalledWith("/api/turnos/turno-1/reprogramacion/opciones?fecha=2026-10-06", expect.anything());
  });

  it("400 con detalles.motivo se muestra en el Dialog sin cerrarlo", async () => {
    await montar();
    await act(async () => radio("17:00")!.click());
    fetchAutenticado.mockResolvedValueOnce(respuesta(400, null, { code: "VALIDATION_ERROR", message: "La fecha y hora deben ser posteriores al momento actual", detalles: { motivo: "FECHA_PASADA" } }));
    await enviar();
    expect(dialogo().querySelector('[role="alert"]')!.textContent).toBe("La fecha y hora deben ser posteriores al momento actual");
    expect(cerrar).not.toHaveBeenCalled();
  });

  it("409 de estado (p. ej. cancelado mientras tanto): toast de error, cierra y recarga", async () => {
    await montar();
    await act(async () => radio("17:00")!.click());
    fetchAutenticado.mockResolvedValueOnce(respuesta(409, null, { code: "TURNO_CANCELADO", message: "Un turno cancelado no se puede reprogramar" }));
    await enviar();
    expect(fallo).toHaveBeenCalledExactlyOnceWith("Un turno cancelado no se puede reprogramar");
    expect(cerrar).toHaveBeenCalledOnce();
    expect(cambio).toHaveBeenCalledOnce();
  });

  it.each([
    ["un 500 (p. ej. evento posterior al commit)", () => fetchAutenticado.mockResolvedValueOnce(respuesta(500, null, { message: "Error interno" }))],
    ["un fallo de red", () => fetchAutenticado.mockRejectedValueOnce(new TypeError("Failed to fetch"))],
  ])("T-PC: ante %s cierra, avisa el resultado incierto y recarga", async (_caso, preparar) => {
    await montar();
    await act(async () => radio("17:00")!.click());
    preparar();
    await enviar();
    expect(cerrar).toHaveBeenCalledOnce();
    expect(fallo).toHaveBeenCalledExactlyOnceWith(MENSAJE_RESULTADO_INCIERTO);
    expect(exito).not.toHaveBeenCalled();
    expect(cambio).toHaveBeenCalledOnce();
  });

  it("descarta la respuesta vieja si se cambia de fecha antes de que llegue", async () => {
    let resolverVieja: (valor: unknown) => void = () => {};
    fetchAutenticado.mockReturnValueOnce(new Promise((resolve) => { resolverVieja = resolve; }))
      .mockResolvedValueOnce(opciones("2026-10-13", [["09:00", "10:00", false]]));
    await montar();
    await cambiarFecha("2026-10-13");
    await act(async () => resolverVieja(MISMA_FECHA));
    await esperar();
    expect([...document.querySelectorAll<HTMLInputElement>('input[name="hora_inicio"]')].map((input) => input.value)).toEqual(["09:00"]);
  });

  it("«Cancelar» cierra sin reprogramar", async () => {
    await montar();
    await act(async () => boton("Cancelar").click());
    expect(cerrar).toHaveBeenCalledOnce();
    expect(fetchAutenticado).toHaveBeenCalledTimes(1);
  });
});
