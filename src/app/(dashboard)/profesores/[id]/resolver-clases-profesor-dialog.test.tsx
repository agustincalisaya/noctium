// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ pedir: vi.fn() }));
vi.mock("@/lib/api-estado-profesor", () => ({ pedirDatos: m.pedir }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { ResolverClasesProfesorDialog } from "./resolver-clases-profesor-dialog";
let root: Root, container: HTMLDivElement;
const fila = (n: number, materia = "m1") => ({ turno_id: `clase-${n}`, fecha: "2026-10-20", hora_inicio: "10:00", hora_fin: "11:00", inscriptos: n === 11 ? 7 : 1, alumnos_inscriptos: n === 11 ? "7/10" : "1/10", estado: "DISPONIBLE" as const, materia: { id: materia, nombre: materia === "m1" ? "Matemática I" : "Física I" }, profesor: { id: "p", nombre_para_mostrar: "Laura Méndez" }, con_pagos: n === 11 });
let clases: ReturnType<typeof fila>[];
const lista = (url = "") => {
  const query = new URL(url || "http://test/?pagina=1", "http://test").searchParams;
  const pagina = Number(query.get("pagina") || 1), materia = query.get("materia_id");
  const filtradas = clases.filter((t) => !materia || t.materia.id === materia);
  return { items: filtradas.slice((pagina - 1) * 10, pagina * 10), total: filtradas.length, pagina, por_pagina: 10, confirmados: clases.length, pendientes: 1,
    materias: ["m1", "m2"].map((id) => ({ id, nombre: id === "m1" ? "Matemática I" : "Física I", cantidad: clases.filter((t) => t.materia.id === id).length })).filter((t) => t.cantidad),
    destinos: [{ materia_id: "m1", profesores: [{ id: "destino", nombre: "Martín", apellido: "Ríos" }] }],
    seleccion: { items: filtradas.slice(0, 500), total: filtradas.length, total_inscriptos: filtradas.slice(0, 500).reduce((s, t) => s + t.inscriptos, 0), truncada: filtradas.length > 500, con_pagos: filtradas.slice(0, 500).filter((t) => t.con_pagos).length } };
};
const boton = (nombre: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === nombre) as HTMLButtonElement;
const click = async (e: HTMLElement) => act(async () => e.click());
const elegir = async (valor: string) => act(async () => { const select = document.querySelector("select")!; select.value = valor; select.dispatchEvent(new Event("change", { bubbles: true })); });
const montar = () => act(async () => root.render(<ResolverClasesProfesorDialog profesorId="p" onCerrar={vi.fn()} onDesactivar={vi.fn()} />));
const todas = () => click(document.querySelector('input[type="checkbox"]')!);
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clases = Array.from({ length: 12 }, (_, i) => fila(i, i === 9 ? "m2" : "m1"));
  m.pedir.mockReset().mockImplementation(async (url: string) => lista(url));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
describe("HU-D-08 selección completa del filtro y resultados parciales", () => {
  it("selecciona doce aunque muestra diez; mantiene y permite desmarcar al cambiar página", async () => {
    await montar(); await todas();
    expect(document.body.textContent).toContain("Seleccionar todas (12)");
    expect(document.body.textContent).toContain("12 clases seleccionadas");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(10);
    await click(boton("Siguiente"));
    expect(document.body.textContent).toContain("12 clases seleccionadas");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(2);
    await click(document.querySelector('tbody input')!);
    await click(boton("Anterior"));
    expect(document.body.textContent).toContain("11 clases seleccionadas");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(10);
  });
  it("rechaza materias mezcladas; el filtro retiene las compatibles y ampliar no restaura descartadas", async () => {
    await montar(); await todas(); await click(boton("Cambiar profesor de las seleccionadas"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("distintas materias");
    await elegir("m1");
    expect(document.body.textContent).toContain("11 clases seleccionadas");
    expect(document.body.textContent).toContain("Seleccionar todas de Matemática I (11)");
    expect(document.body.textContent).not.toContain("en esta página");
    await elegir("");
    expect(document.body.textContent).toContain("11 clases seleccionadas");
    await elegir("m2");
    expect(document.body.textContent).toContain("0 clases seleccionadas");
  });
  it("confirma alumnos y pagos fuera de página; enviar desde página 2 incluye la selección completa", async () => {
    await montar(); await todas(); await click(boton("Siguiente")); await click(boton("Cancelar seleccionadas"));
    const confirmacion = document.querySelector('[role="alertdialog"]');
    expect(confirmacion?.textContent).toContain("12 clases");
    expect(confirmacion?.textContent).toContain("18 alumnos inscriptos");
    expect(confirmacion?.textContent).toContain("Reintegro");
    expect(confirmacion?.textContent).toContain("Esta acción no se puede deshacer");
    m.pedir.mockImplementation(async (url: string) => {
      if (!url.includes("cancelacion")) return lista(url);
      clases = [];
      return { procesadas: 12, no_procesadas: [], restantes: { confirmados: 0, pendientes: 1 } };
    });
    await click(boton("Cancelar 12 clases"));
    expect(m.pedir.mock.calls.find(([url]) => url.includes("cancelacion"))?.[1]).toEqual({ turno_ids: Array.from({ length: 12 }, (_, i) => `clase-${i}`) });
    expect(boton("Desactivar profesor")).toBeTruthy();
  });
  it("las selecciones individuales suman solo sus propios alumnos y pagos", async () => {
    await montar(); await click(document.querySelector('tbody input')!); await click(boton("Cancelar seleccionadas"));
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("1 alumno inscripto");
    expect(document.querySelector('[role="alertdialog"]')?.textContent).not.toContain("Reintegro");
  });
  it("cancelación secuencial 100+100+5 suma éxitos y deja doce fallidas paginadas con motivo", async () => {
    clases = Array.from({ length: 205 }, (_, i) => fila(i));
    let enCurso = 0;
    m.pedir.mockImplementation(async (url: string, body?: { turno_ids: string[] }) => {
      if (!body) return lista(url);
      expect(enCurso++).toBe(0);
      await Promise.resolve();
      enCurso--;
      const fallos = body.turno_ids.filter((id) => Number(id.split("-")[1]) >= 193);
      clases = clases.filter((t) => !body.turno_ids.includes(t.turno_id) || fallos.includes(t.turno_id));
      return { procesadas: body.turno_ids.length - fallos.length, no_procesadas: fallos.map((turno_id) => ({ turno_id, code: "OCUPADO", message: "La clase está ocupada." })), restantes: { confirmados: clases.length, pendientes: 1 } };
    });
    await montar(); await todas(); await click(boton("Cancelar seleccionadas")); await click(boton("Cancelar 205 clases"));
    const llamadas = m.pedir.mock.calls.filter(([, body]) => body);
    expect(llamadas.map(([, body]) => body.turno_ids.length)).toEqual([100, 100, 5]);
    expect(document.body.textContent).toContain("Se cancelaron 193 clases");
    expect(document.body.textContent).toContain("12 clases seleccionadas");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(10);
    expect(document.querySelector('tbody')?.textContent).toContain("La clase está ocupada.");
    await click(boton("Siguiente"));
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(2);
    expect(document.querySelector('tbody')?.textContent).toContain("La clase está ocupada.");
  });
  it("previsualiza y cambia 205 clases en tandas; el fallo final mantiene motivo y selección", async () => {
    clases = Array.from({ length: 205 }, (_, i) => fila(i));
    m.pedir.mockImplementation(async (url: string, body?: { turno_ids: string[]; profesor_destino_id: string }) => {
      if (!body) return lista(url);
      expect(body.profesor_destino_id).toBe("destino");
      if (url.includes("previsualizacion")) return { resultados: body.turno_ids.map((turno_id) => ({ turno_id, resultado: turno_id === "clase-204" ? "OCUPADO" : "SE_PUEDE" })), se_pueden: body.turno_ids.filter((id) => id !== "clase-204").length, no_se_pueden: body.turno_ids.includes("clase-204") ? 1 : 0 };
      clases = clases.filter((t) => !body.turno_ids.includes(t.turno_id) || t.turno_id === "clase-204");
      return { procesadas: body.turno_ids.filter((id) => id !== "clase-204").length, no_procesadas: body.turno_ids.includes("clase-204") ? [{ turno_id: "clase-204", code: "OCUPADO", message: "Tiene otra clase en ese horario" }] : [], restantes: { confirmados: clases.length, pendientes: 1 } };
    });
    await montar(); await todas(); await click(boton("Cambiar profesor de las seleccionadas")); await elegir("destino");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(205);
    expect(m.pedir.mock.calls.filter(([url]) => url.includes("previsualizacion")).map(([, body]) => body.turno_ids.length)).toEqual([100, 100, 5]);
    await click(boton("Confirmar cambio (204 clases)"));
    await click(document.querySelector('[role="alertdialog"] button:last-child')!);
    expect(m.pedir.mock.calls.filter(([url]) => url.endsWith("/cambio-profesor")).map(([, body]) => body.turno_ids.length)).toEqual([100, 100, 5]);
    expect(document.body.textContent).toContain("Se cambió el profesor de 204 clases");
    expect(document.body.textContent).toContain("1 clase seleccionada");
    expect(document.querySelector('tbody')?.textContent).toContain("Tiene otra clase en ese horario");
  });
  it("si falla la segunda tanda no repite éxitos ni envía la tercera, y conserva las pendientes", async () => {
    clases = Array.from({ length: 205 }, (_, i) => fila(i));
    let llamadas = 0;
    m.pedir.mockImplementation(async (url: string, body?: { turno_ids: string[] }) => {
      if (!body) return lista(url);
      if (++llamadas === 2) throw new Error("Sin conexión. Reintentá.");
      clases = clases.filter((t) => !body.turno_ids.includes(t.turno_id));
      return { procesadas: 100, no_procesadas: [], restantes: { confirmados: clases.length, pendientes: 1 } };
    });
    await montar(); await todas(); await click(boton("Cancelar seleccionadas")); await click(boton("Cancelar 205 clases"));
    expect(llamadas).toBe(2);
    expect(document.body.textContent).toContain("Se cancelaron 100 clases");
    expect(document.body.textContent).toContain("105 clases seleccionadas");
    expect(document.querySelector('tbody')?.textContent).toContain("Sin conexión. Reintentá.");
  });
  it("si supera 500 informa el límite y selecciona solo los ítems recibidos", async () => {
    clases = Array.from({ length: 501 }, (_, i) => fila(i));
    await montar(); await todas();
    expect(document.body.textContent).toContain("Seleccionar todas (501)");
    expect(document.body.textContent).toContain("hasta 500 clases por vez");
    expect(document.body.textContent).toContain("500 clases seleccionadas");
  });
  it("permite paginar fallidas aunque hayan desaparecido del listado futuro del servidor", async () => {
    const ids = clases.map((t) => t.turno_id);
    m.pedir.mockImplementation(async (url: string, body?: { turno_ids: string[] }) => {
      if (!body) return lista(url);
      clases = [];
      return { procesadas: 0, no_procesadas: ids.map((turno_id) => ({ turno_id, code: "CANCELADO", message: "La clase fue cancelada por otro usuario." })), restantes: { confirmados: 0, pendientes: 1 } };
    });
    await montar(); await todas(); await click(boton("Cancelar seleccionadas")); await click(boton("Cancelar 12 clases"));
    expect(document.body.textContent).toContain("12 clases seleccionadas");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(10);
    await click(boton("Siguiente"));
    expect(document.body.textContent).toContain("Página 2 de 2");
    expect(document.querySelectorAll('tbody input:checked')).toHaveLength(2);
    expect(document.querySelector('tbody')?.textContent).toContain("La clase fue cancelada por otro usuario.");
  });

  it("si se resuelve la materia filtrada ofrece la única materia restante sin un filtro oculto", async () => {
    m.pedir.mockImplementation(async (url: string, body?: { turno_ids: string[] }) => {
      if (!body) return lista(url);
      clases = clases.filter((t) => !body.turno_ids.includes(t.turno_id));
      return { procesadas: body.turno_ids.length, no_procesadas: [], restantes: { confirmados: clases.length, pendientes: 1 } };
    });
    await montar(); await elegir("m1"); await todas(); await click(boton("Cancelar seleccionadas")); await click(boton("Cancelar 11 clases"));
    expect(document.body.textContent).toContain("Seleccionar todas (1)");
    expect(document.querySelector('tbody')?.textContent).toContain("Física I");
    expect(document.querySelector("select")).toBeNull();
  });

});
