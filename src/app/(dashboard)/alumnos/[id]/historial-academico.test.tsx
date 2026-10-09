// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));
const { HistorialAcademico } = await import("./historial-academico");
let root: Root; let contenedor: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div"); document.body.append(contenedor); root = createRoot(contenedor);
  m.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: {
    alumno: { id: "a", nombre_completo: "Alumno" }, materias_disponibles: [{ id: "m", nombre: "Matemática" }],
    asistencia_por_materia: [{ materia_id: "m", presentes: 1, ausentes: 1, sin_control: 1, porcentaje: 50 }],
    items: ["PRESENTE", "AUSENTE", null].map((asistencia, i) => ({
      tipo: "CLASE_DICTADA", fecha: `2026-01-0${i + 1}`, materia: { id: "m", nombre: "Matemática" }, profesor: "Profesora", turno_id: `t${i}`, asistencia,
      ...(i === 0 ? { observacion: { temas_vistos: "Ecuaciones", observaciones_internas: "Repasar", registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local" } } : {}),
    })),
    paginacion: { total: 3, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
  }, error: null }) });
});
afterEach(async () => { await act(async () => root.unmount()); contenedor.remove(); });
describe("HU-E-09 historial académico", () => {
  it("muestra estados con texto y porcentaje excluyendo clases sin control", async () => {
    await act(async () => root.render(<HistorialAcademico alumnoId="a" puedeRegistrarExamen={false} mostrarNombre={false} />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(contenedor.textContent).toContain("50 % de asistencia");
    expect(contenedor.textContent).toContain("1 clases sin control excluidas del porcentaje");
    const lista = contenedor.querySelector('ol[aria-label="Registros del historial académico"]')!;
    expect(lista.textContent).toContain("Asistió"); expect(lista.textContent).toContain("Ausente"); expect(lista.textContent).toContain("Asistió (sin control de asistencia)");
    expect(lista.querySelector(".text-success-foreground")).not.toBeNull();
    expect(lista.querySelector(".text-destructive-soft-foreground")).not.toBeNull();
  });

  it("muestra temas vistos, observaciones internas autorizadas y autoría con fecha y hora", async () => {
    await act(async () => root.render(<HistorialAcademico alumnoId="a" puedeRegistrarExamen={false} mostrarNombre={false} />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const lista = contenedor.querySelector('ol[aria-label="Registros del historial académico"]')!;
    expect(lista.textContent).toContain("Ecuaciones");
    expect(lista.textContent).toContain("Repasar");
    expect(lista.textContent).toContain("Registradas el 09/10/2026, 11:00 por mesa@noctium.local");
  });
});
