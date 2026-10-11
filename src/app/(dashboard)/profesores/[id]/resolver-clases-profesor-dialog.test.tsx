// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ pedir: vi.fn() }));
vi.mock("@/lib/api-estado-profesor", () => ({ pedirDatos: m.pedir }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { ResolverClasesProfesorDialog } from "./resolver-clases-profesor-dialog";
let root: Root, container: HTMLDivElement;
const fila = (n: number, materia = "m1") => ({ turno_id: `clase-${n}`, fecha: "2026-10-20", hora_inicio: "10:00", hora_fin: "11:00", inscriptos: 1, alumnos_inscriptos: "1/10", estado: "DISPONIBLE", materia: { id: materia, nombre: materia === "m1" ? "Matemática I" : "Física I" }, profesor: { id: "p", nombre_para_mostrar: "Laura Méndez" }, con_pagos: true });
const lista = (pagina = 1, filtrada = false) => ({ items: Array.from({ length: pagina === 1 ? 10 : 2 }, (_, i) => fila(i + (pagina === 1 ? 0 : 10), !filtrada && i === 9 ? "m2" : "m1")), total: 12, pagina, por_pagina: 10, confirmados: 12, pendientes: 1,
  materias: [{ id: "m1", nombre: "Matemática I", cantidad: 11 }, { id: "m2", nombre: "Física I", cantidad: 1 }], destinos: [{ materia_id: "m1", profesores: [{ id: "destino", nombre: "Martín", apellido: "Ríos" }] }], seleccion: { items: [], total: 12, total_inscriptos: 12, truncada: false, con_pagos: 1 } });
const boton = (nombre: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === nombre) as HTMLButtonElement;
const click = async (e: HTMLElement) => act(async () => e.click());
const montar = () => act(async () => root.render(<ResolverClasesProfesorDialog profesorId="p" onCerrar={vi.fn()} onDesactivar={vi.fn()} />));
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  m.pedir.mockReset().mockImplementation(async (url: string) => lista(url.includes("pagina=2") ? 2 : 1, url.includes("materia_id=")));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
describe("HU-D-08 selección por página y resultados parciales", () => {
  it("Seleccionar todas marca diez visibles, no las doce del filtro; cambiar página desmarca", async () => {
    await montar();
    await click(document.querySelector('input[type="checkbox"]')!);
    expect(document.body.textContent).toContain("10 clases seleccionadas");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(10);
    await click(boton("Siguiente"));
    expect(document.body.textContent).toContain("0 clases seleccionadas");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
  });
  it("materias mezcladas rechazan cambio; filtro limpia la selección", async () => {
    await montar(); await click(document.querySelector('input[type="checkbox"]')!); await click(boton("Cambiar profesor de las seleccionadas"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("distintas materias");
    const select = document.querySelector("select")!;
    await act(async () => { select.value = "m1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.body.textContent).toContain("0 clases seleccionadas");
    expect(m.pedir.mock.calls.at(-1)?.[0]).toContain("materia_id=m1");
  });
  it("cancelación confirma alumnos y reintegro; fallo parcial queda seleccionado con motivo", async () => {
    await montar(); await click(document.querySelector('tbody input')!); await click(boton("Cancelar seleccionadas"));
    const confirmacion = document.querySelector('[role="alertdialog"]');
    expect(confirmacion?.textContent).toContain("1 alumno inscripto"); expect(confirmacion?.textContent).toContain("Reintegro"); expect(confirmacion?.textContent).toContain("Esta acción no se puede deshacer");
    m.pedir.mockImplementation(async (url: string) => url.includes("cancelacion") ? { procesadas: 0, no_procesadas: [{ turno_id: "clase-0", code: "TRANSACCION_OCUPADA", message: "La clase está ocupada. Reintentá." }], restantes: { confirmados: 12, pendientes: 1 } } : lista());
    await click(boton("Cancelar 1 clase"));
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(1);
    expect(document.body.textContent).toContain("La clase está ocupada. Reintentá.");
    expect(m.pedir.mock.calls.find(([url]) => url.includes("cancelacion"))?.[1]).toEqual({ turno_ids: ["clase-0"] });
  });
});
