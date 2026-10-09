// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SolicitarTurno } from "@/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno";
import { texto } from "@/lib/textos";
import type { ResumenInscripcion } from "@/types/turno.types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const resumen: ResumenInscripcion = {
  turno_id: "turno-confirmacion", materia: { id: "m1", nombre: "Física I" }, profesor: { id: "p1", nombre_para_mostrar: "Pérez, Ana" },
  fecha: "2026-10-13", hora_inicio: "16:00", hora_fin: "18:00", duracion_min: 120, aula: { id: "a1", nombre: "Aula 2" },
  cupo: 8, lugares_disponibles: 3, precio: 24000, plazo_pago_horas: null, vence_pago_el: null,
  limite_cancelacion_en_linea: "2026-10-12T16:00:00-03:00", limite_cancelacion_pasado: false,
};
let root: Root; let container: HTMLDivElement;
const request = vi.fn();
const respuesta = (data: unknown, status = 200, message = "motivo") => new Response(JSON.stringify({ data, error: status === 200 ? null : { code: "ERROR", message } }), { status });
const boton = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
const dialogo = () => document.querySelector('[role="alertdialog"][data-open]');
const elegir = async (name: string, value: string) => act(async () => { (container.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement).click(); });
const click = async (label: string) => act(async () => { boton(label).click(); });
const montar = async () => act(async () => { root.render(<SolicitarTurno />); });
const seleccionar = async () => { await montar(); await elegir("materia", "m1"); await elegir("profesor", "p1"); await elegir("horario", "turno-seleccion"); };
const posts = () => request.mock.calls.filter(([, init]) => init?.method === "POST");
const seleccionActual = () => [...container.querySelectorAll<HTMLInputElement>("input:checked")].map((input) => input.value);
function pendiente<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("scrollTo", vi.fn());
  request.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return respuesta({ id: "turno-confirmacion" });
    if (url.endsWith("/resumen")) return respuesta(resumen);
    if (url.includes("profesor_id=")) return respuesta({ items: [{ turno_id: "turno-seleccion", fecha: "2026-10-13", hora_inicio: "16:00", hora_fin: "18:00", aula: "Aula 2", cupos_libres: 3 }] });
    if (url.includes("materia_id=")) return respuesta({ items: [{ id: "p1", nombre: "Pérez, Ana", turnos_con_lugar: 1 }] });
    return respuesta({ items: [{ id: "m1", nombre: "Física I", turnos_con_lugar: 1 }, { id: "m2", nombre: "Química", turnos_con_lugar: 1 }] });
  });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("C-20 componente y diálogo reales (jsdom, API simulada)", () => {
  it("Inscribirme pide GET sin POST y muestra todos los datos y leyenda literal, sin las diferidas", async () => {
    await seleccionar(); await click("Inscribirme");
    expect(request).toHaveBeenCalledWith("/api/turnos/turno-seleccion/inscripcion/resumen", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(posts()).toHaveLength(0);
    expect(dialogo()!.querySelector("h2")!.textContent).toBe("¿Estás seguro de que querés reservar tu lugar en la clase de Física I del martes 13 de octubre de 2026 a las 16:00?");
    const content = dialogo()!.textContent!;
    for (const valor of ["Física I", "Pérez, Ana", "Martes 13 de octubre de 2026", "16:00–18:00", "120 minutos", "Aula 2", "3", "$ 24.000", texto("ui.turnos.resumen.precioFijo"), "Confirmar reserva", "Volver"]) expect(content).toContain(valor);
    expect(content).not.toMatch(/Si todavía no pagaste|Si ya pagaste|tenés que pagarlo antes|12 de octubre/);
    expect(push).not.toHaveBeenCalled();
  });
  it("Volver conserva materia, profesor y horario; reabrir pide un resumen nuevo", async () => {
    await seleccionar(); await click("Inscribirme"); await click("Volver");
    expect(seleccionActual()).toEqual(["m1", "p1", "turno-seleccion"]);
    expect(posts()).toHaveLength(0);
    expect(dialogo()).toBeNull();
    await click("Inscribirme");
    expect(request.mock.calls.filter(([url]) => url.endsWith("/resumen"))).toHaveLength(2);
  });
  it("bloquea selección y doble GET mientras carga el resumen", async () => {
    await seleccionar();
    const p = pendiente<Response>(); request.mockImplementationOnce(() => p.promise);
    await click("Inscribirme");
    expect([...container.querySelectorAll("fieldset")].every((f) => f.disabled)).toBe(true);
    await elegir("materia", "m2");
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(seleccionActual()).toEqual(["m1", "p1", "turno-seleccion"]);
    expect(request.mock.calls.filter(([url]) => url.endsWith("/resumen"))).toHaveLength(1);
    await act(async () => { p.resolve(respuesta(resumen)); });
    expect(dialogo()).not.toBeNull();
  });
  it("POST usa resumen.turno_id, bloquea ambos botones y previene doble envío incluso antes del render", async () => {
    await seleccionar(); await click("Inscribirme");
    const p = pendiente<Response>(); request.mockImplementationOnce(() => p.promise);
    await act(async () => { const b = boton("Confirmar reserva"); b.click(); b.click(); });
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toEqual(["/api/turnos/turno-confirmacion/inscripcion", { method: "POST", cache: "no-store" }]);
    expect(boton("Volver").disabled).toBe(true);
    expect(boton("Procesando…").disabled).toBe(true);
    await click("Volver");
    expect(dialogo()).not.toBeNull();
    await act(async () => { p.resolve(respuesta({ id: "turno-confirmacion" })); });
    expect(push).toHaveBeenCalledExactlyOnceWith("/alumno?inscripcion=exitosa");
  });
  it.each(["El turno alcanzó su cupo máximo", "Ya tenés otro turno en ese horario"])("rechazo del POST: %s queda en el diálogo sin perder elección", async (motivo) => {
    await seleccionar(); await click("Inscribirme");
    request.mockResolvedValueOnce(respuesta(null, 409, motivo));
    await click("Confirmar reserva");
    expect(dialogo()!.querySelector('[role="alert"]')!.textContent).toContain(motivo);
    expect(push).not.toHaveBeenCalled();
    expect(seleccionActual()).toEqual(["m1", "p1", "turno-seleccion"]);
    await click("Volver");
    expect(seleccionActual()).toEqual(["m1", "p1", "turno-seleccion"]);
  });
  it("error GET no abre diálogo ni POST y conserva selección para reintentar", async () => {
    await seleccionar(); request.mockResolvedValueOnce(respuesta(null, 422, "Esta clase todavía no tiene precio. Comunicate con el centro."));
    await click("Inscribirme");
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("Esta clase todavía no tiene precio");
    expect(dialogo()).toBeNull(); expect(posts()).toHaveLength(0);
    expect(seleccionActual()).toEqual(["m1", "p1", "turno-seleccion"]);
    await click("Inscribirme"); expect(dialogo()).not.toBeNull();
  });
  it("aborta GET al desmontar y descarta su respuesta tardía tras abrir una pantalla nueva", async () => {
    await seleccionar();
    const p = pendiente<Response>(); request.mockImplementationOnce(() => p.promise);
    await click("Inscribirme");
    const signal = request.mock.calls.at(-1)![1].signal as AbortSignal;
    await act(async () => { root.unmount(); });
    expect(signal.aborted).toBe(true);
    root = createRoot(container); await montar();
    await act(async () => { p.resolve(respuesta(resumen)); });
    expect(dialogo()).toBeNull(); expect(seleccionActual()).toEqual([]); expect(posts()).toHaveLength(0);
  });
  it("descarta opciones obsoletas cuando cambia la materia", async () => {
    await montar(); const p = pendiente<Response>(); request.mockImplementationOnce(() => p.promise);
    await elegir("materia", "m1"); await elegir("materia", "m2");
    await act(async () => { p.resolve(respuesta({ items: [{ id: "viejo", nombre: "Profesor anterior", turnos_con_lugar: 1 }] })); });
    expect(container.textContent).not.toContain("Profesor anterior");
    expect(seleccionActual()).toEqual(["m2"]);
  });
  it("fallo de conexión POST queda dentro del diálogo con texto de C", async () => {
    await seleccionar(); await click("Inscribirme"); request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await click("Confirmar reserva");
    expect(dialogo()!.querySelector('[role="alert"]')!.textContent).toContain(texto("ui.turnos.resumen.errorConfirmacion"));
    expect(push).not.toHaveBeenCalled();
  });
});
