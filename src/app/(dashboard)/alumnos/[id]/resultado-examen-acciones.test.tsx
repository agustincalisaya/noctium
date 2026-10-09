// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { enviar, exito } = vi.hoisted(() => ({ enviar: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchOLanzar: enviar }));
vi.mock("sonner", () => ({ toast: { success: exito } }));

const { ResultadoExamenAcciones } = await import("./resultado-examen-acciones");

const ITEM = {
  id: "examen-1", tipo: "EXAMEN" as const, fecha: "2026-10-03", materia: { id: "materia-1", nombre: "Matemática" },
  nota: "8.0", observaciones: null, corregido: false, anulado: false, puede_corregir: true,
};
const actualizar = vi.fn();
let root: Root;
let container: HTMLDivElement;

const boton = (scope: Element, nombre: string) => [...scope.querySelectorAll("button")].find((elemento) => elemento.textContent === nombre) as HTMLButtonElement;
const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const alerta = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const cambiarValor = async (selector: string, valor: string) => {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  const prototipo = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, "value")!.set!;
  await act(async () => { setter.call(input, valor); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const enviarFormulario = async () => act(async () => {
  dialogo()!.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  enviar.mockResolvedValue({ data: {} });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-E-10 acciones del historial académico", () => {
  it("solo muestra acciones cuando el servidor autoriza; presenta estado corregido/anulado", async () => {
    await act(async () => root.render(<ResultadoExamenAcciones alumnoId="alumno-1" item={{ ...ITEM, corregido: true, puede_corregir: false }} onActualizado={actualizar} />));
    expect(container.textContent).toContain("Corregido");
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual([]);

    await act(async () => root.render(<ResultadoExamenAcciones alumnoId="alumno-1" item={{
      ...ITEM, anulado: true, puede_corregir: false,
      anulacion: { motivo: "Cargado a otro alumno", anulada_en: "2026-10-09T15:00:00.000Z", anulada_por: "mesa@noctium.local" },
    }} onActualizado={actualizar} />));
    expect(container.textContent).toContain("Anulado");
    expect(container.textContent).toContain("Motivo: Cargado a otro alumno");
    expect(container.textContent).toContain("mesa@noctium.local");
    expect([...container.querySelectorAll("button")]).toHaveLength(0);
  });

  it("confirma y envía solo los campos cambiados, el motivo y el resultado vigente", async () => {
    await act(async () => root.render(<ResultadoExamenAcciones alumnoId="alumno-1" item={ITEM} onActualizado={actualizar} />));
    await act(async () => boton(container, "Corregir").click());
    expect(dialogo()!.textContent).toContain("Corregir resultado de examen");
    await cambiarValor("#fecha-examen-examen-1", "2026-10-04");
    await cambiarValor("#nota-examen-examen-1", "9,5");
    await cambiarValor("#motivo-examen-examen-1", "La nota se cargó mal");
    await enviarFormulario();

    const confirmacion = alerta()!;
    expect(confirmacion.textContent).toContain("¿Corregir el resultado de Matemática?");
    expect(confirmacion.textContent).toContain("Registrado: 03/10/2026, nota 8,0. Nuevo valor: 04/10/2026, nota 9,5.");
    expect(confirmacion.textContent).toContain("La nota se cargó mal");
    await act(async () => boton(confirmacion, "Guardar corrección").click());

    expect(enviar).toHaveBeenCalledOnce();
    const [url, init] = enviar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/alumnos/alumno-1/examenes/examen-1/correccion");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" });
    expect(JSON.parse(String(init.body))).toEqual({ fecha_examen: "2026-10-04", nota: "9.5", motivo: "La nota se cargó mal" });
    expect(exito).toHaveBeenCalledExactlyOnceWith("Resultado corregido correctamente");
    expect(actualizar).toHaveBeenCalledOnce();
    expect(alerta()).toBeNull();
  });

  it("anular exige un motivo y la confirmación queda marcada como irreversible", async () => {
    await act(async () => root.render(<ResultadoExamenAcciones alumnoId="alumno-1" item={ITEM} onActualizado={actualizar} />));
    await act(async () => boton(container, "Anular").click());
    await cambiarValor("#motivo-examen-examen-1", "Se cargó a otro alumno");
    await enviarFormulario();

    const confirmacion = alerta()!;
    expect(confirmacion.textContent).toContain("¿Anular el resultado de Matemática del 03/10/2026?");
    expect(confirmacion.textContent).toContain("Esta acción no se puede deshacer.");
    const botonAnular = boton(confirmacion, "Anular resultado");
    expect(botonAnular.className).toContain("bg-destructive");
    await act(async () => botonAnular.click());

    expect(enviar).toHaveBeenCalledOnce();
    const [url, init] = enviar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/alumnos/alumno-1/examenes/examen-1/anulacion");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" });
    expect(JSON.parse(String(init.body))).toEqual({ motivo: "Se cargó a otro alumno" });
    expect(exito).toHaveBeenCalledExactlyOnceWith("Resultado anulado");
    expect(actualizar).toHaveBeenCalledOnce();
  });

  it("no abre la confirmación para una corrección sin cambios y muestra el error en el formulario", async () => {
    await act(async () => root.render(<ResultadoExamenAcciones alumnoId="alumno-1" item={ITEM} onActualizado={actualizar} />));
    await act(async () => boton(container, "Corregir").click());
    await cambiarValor("#motivo-examen-examen-1", "Motivo válido");
    await enviarFormulario();
    expect(dialogo()!.querySelector('[role="alert"]')?.textContent).toBe("Modificá la fecha o la nota para guardar una corrección.");
    expect(alerta()).toBeNull();
    expect(enviar).not.toHaveBeenCalled();
  });
});
