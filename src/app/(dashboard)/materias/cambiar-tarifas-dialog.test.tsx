// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.success, info: m.info } }));
import { CambiarTarifasDialog } from "./cambiar-tarifas-dialog";
import { texto } from "@/lib/textos";
import type { MateriaConTarifa } from "@/types/materia.types";

const items: MateriaConTarifa[] = [
  { id: "cm000000000000000000000001", nombre: "Física I", codigo: "FIS1", tarifa_hora: 12000 },
  { id: "cm000000000000000000000002", nombre: "Matemática", codigo: "MAT", tarifa_hora: 15000 },
  { id: "cm000000000000000000000003", nombre: "Química", codigo: null, tarifa_hora: null },
];
let root: Root;
let container: HTMLDivElement;
const respuesta = (data: unknown, status = 200, error: unknown = null) => Response.json({ data, error }, { status });
const boton = (nombre: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === nombre)!;
const click = async (nombre: string) => act(async () => boton(nombre).click());
const cambiar = async (id: string, valor: string) => act(async () => {
  const input = document.getElementById(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const marcar = async (nombre: string) => act(async () => {
  const label = [...document.querySelectorAll("label")].find((l) => l.textContent === nombre)!;
  label.querySelector("input")!.click();
});
const abrir = async () => {
  await act(async () => root.render(<CambiarTarifasDialog />));
  await click(texto("ui.materias.tarifas.cambiar"));
};
const preparar = async () => {
  await abrir();
  await click(texto("ui.materias.tarifas.todas", { cantidad: 3 }));
  await cambiar("tarifas-importe", "15000");
  await click(texto("ui.materias.tarifas.continuar"));
};
const confirmar = async () => click(texto("ui.materias.tarifas.confirmar"));
const envios = () => m.fetch.mock.calls.filter(([, opciones]) => opciones?.method === "POST");

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", m.fetch);
  m.fetch.mockImplementation((_url, opciones) => Promise.resolve(opciones?.method === "POST"
    ? respuesta({ tarifa_hora: 15000, actualizadas: 2, sin_cambio: 1 }) : respuesta({ items })));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("HU-L-07: selección y previa", () => {
  it("busca desde 2 caracteres, normaliza nombre/código y conserva seleccionadas ocultas", async () => {
    await abrir();
    await cambiar("tarifas-busqueda", "f");
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    await cambiar("tarifas-busqueda", "FISICA");
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    await click(texto("ui.materias.tarifas.todas", { cantidad: 1 }));
    await cambiar("tarifas-busqueda", "mat");
    await click(texto("ui.materias.tarifas.todas", { cantidad: 1 }));
    expect(document.body.textContent).toContain("Materias seleccionadas: 2");
    await cambiar("tarifas-busqueda", "");
    expect([...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map((i) => i.checked)).toEqual([true, true, false]);
    await marcar("Física I");
    expect(document.body.textContent).toContain("Materias seleccionadas: 1");
    expect(envios()).toHaveLength(0);
  });
  it.each(["0", "-1", "1.5", "1000001", ""])("importe %s inválido y error junto al campo", async (valor) => {
    await abrir(); await marcar("Física I"); await cambiar("tarifas-importe", valor);
    // El evento vacío puede no cambiar el estado inicial del input.
    await act(async () => (document.getElementById("tarifas-importe") as HTMLInputElement).focus());
    await act(async () => (document.getElementById("tarifas-busqueda") as HTMLInputElement).focus());
    expect(boton(texto("ui.materias.tarifas.continuar")).disabled).toBe(true);
    expect(document.getElementById("tarifas-importe-error")?.textContent).toBe(texto("errores.materias.tarifaImporte"));
    expect(envios()).toHaveLength(0);
  });
  it("exige selección; previa de todas, null y sin cambio; confirmación cuenta solo cambios", async () => {
    await abrir(); await cambiar("tarifas-importe", "15000");
    expect(boton(texto("ui.materias.tarifas.continuar")).disabled).toBe(true);
    await click(texto("ui.materias.tarifas.todas", { cantidad: 3 }));
    await click(texto("ui.materias.tarifas.continuar"));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(document.body.textContent).toContain("Sin tarifa");
    expect(document.body.textContent).toContain("Sin cambio");
    await confirmar();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("2 materias a $ 15.000");
    expect(envios()).toHaveLength(0);
    await click("Volver"); await click("Volver");
    expect((document.getElementById("tarifas-importe") as HTMLInputElement).value).toBe("15000");
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(3);
  });
  it("todas sin cambio muestra aviso sin confirmar cero ni enviar", async () => {
    await abrir(); await marcar("Matemática"); await cambiar("tarifas-importe", "15000");
    await click(texto("ui.materias.tarifas.continuar"));
    expect(document.body.textContent).toContain(texto("ui.materias.tarifas.sinCambios"));
    expect(boton(texto("ui.materias.tarifas.confirmar"))).toBeUndefined();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(envios()).toHaveLength(0);
    await click(texto("ui.materias.tarifas.cerrar"));
  });
  it("más de 200 visibles no se truncan; continuar se bloquea", async () => {
    const muchas = Array.from({ length: 201 }, (_, i) => ({ ...items[0], id: `m${i}`, nombre: `Materia ${i}` }));
    m.fetch.mockResolvedValue(respuesta({ items: muchas }));
    await abrir(); await click(texto("ui.materias.tarifas.todas", { cantidad: 201 }));
    await cambiar("tarifas-importe", "15000");
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(201);
    expect(boton(texto("ui.materias.tarifas.continuar")).disabled).toBe(true);
    expect(document.body.textContent).toContain(texto("errores.materias.tarifaSeleccion"));
  });
});

describe("HU-L-07: confirmación y errores", () => {
  it("dos clicks en actos separados con POST pendiente producen un único envío", async () => {
    await preparar(); await confirmar();
    let resolver!: (response: Response) => void;
    m.fetch.mockImplementation(() => new Promise<Response>((resolve) => { resolver = resolve; }));
    const confirmarPendiente = boton(texto("ui.materias.tarifas.confirmar"));
    await act(async () => confirmarPendiente.click());
    await act(async () => confirmarPendiente.click());
    expect(envios()).toHaveLength(1);
    expect(JSON.parse(envios()[0][1].body)).toEqual({ tarifa_hora: 15000, materias: items.map((i) => ({ id: i.id, tarifa_actual: i.tarifa_hora })) });
    expect(m.success).not.toHaveBeenCalled();
    await act(async () => resolver(respuesta({ tarifa_hora: 15000, actualizadas: 2, sin_cambio: 1 })));
    expect(m.success).toHaveBeenCalledWith("Se actualizó la tarifa de 2 materias");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
  it("rechazo dentro del diálogo; recarga tarifas y requiere una confirmación nueva", async () => {
    await preparar(); await confirmar();
    m.fetch.mockResolvedValueOnce(respuesta(null, 409, { code: "CONFLICTO_EDICION_CONCURRENTE", message: texto("errores.materias.tarifaConflicto") }));
    await confirmar();
    expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toContain(texto("errores.materias.tarifaConflicto"));
    expect(boton(texto("ui.materias.tarifas.confirmar")).disabled).toBe(true);
    expect(m.success).not.toHaveBeenCalled();
    m.fetch.mockResolvedValueOnce(respuesta({ items: items.map((i) => i.id === items[1].id ? { ...i, tarifa_hora: 16000 } : i) }));
    await click(texto("ui.materias.tarifas.recargar"));
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    await click(texto("ui.materias.tarifas.continuar")); await confirmar();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("3 materias");
    await confirmar();
    expect(JSON.parse(envios()[1][1].body).materias[1].tarifa_actual).toBe(16000);
  });
  it("fallo de red no muestra éxito ni cierra confirmación; permite reintentar", async () => {
    await preparar(); await confirmar(); m.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await confirmar();
    expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toContain(texto("errores.materias.tarifaComunicacion"));
    expect(m.success).not.toHaveBeenCalled();
    await confirmar(); expect(m.success).toHaveBeenCalledTimes(1);
  });
  it("carga rechazada permite reintento; cierre y reapertura consultan datos actuales", async () => {
    m.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch")); await abrir();
    expect(document.body.textContent).toContain(texto("ui.materias.tarifas.errorCarga"));
    expect(boton(texto("ui.materias.tarifas.continuar")).disabled).toBe(true);
    await click(texto("ui.materias.tarifas.reintentar"));
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    await click("Cancelar");
    m.fetch.mockResolvedValueOnce(respuesta({ items: [] }));
    await click(texto("ui.materias.tarifas.cambiar"));
    expect(document.body.textContent).toContain(texto("ui.materias.tarifas.vacio"));
  });
  it("singular en confirmación y éxito", async () => {
    await abrir(); await marcar("Física I"); await cambiar("tarifas-importe", "15000");
    await click(texto("ui.materias.tarifas.continuar")); await confirmar();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("1 materia a $ 15.000");
    m.fetch.mockResolvedValueOnce(respuesta({ tarifa_hora: 15000, actualizadas: 1, sin_cambio: 0 }));
    await confirmar(); expect(m.success).toHaveBeenCalledWith("Se actualizó la tarifa de 1 materia");
  });
});
