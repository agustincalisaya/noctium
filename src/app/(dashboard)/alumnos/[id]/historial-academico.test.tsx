// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));
const { HistorialAcademico } = await import("./historial-academico");
let root: Root;
let contenedor: HTMLDivElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
  m.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: {
    alumno: { id: "a", nombre_completo: "Alumno" }, materias_disponibles: [{ id: "m", nombre: "Matemática" }],
    indicaciones_opciones: { materias: [{ id: "m", nombre: "Matemática" }], clases: [] },
    asistencia_por_materia: [{ materia_id: "m", presentes: 1, ausentes: 1, sin_control: 1, porcentaje: 50 }],
    items: ["PRESENTE", "AUSENTE", null].map((asistencia, i) => ({
      id: `c${i}`, tipo: "CLASE_DICTADA", fecha: `2026-01-0${i + 1}`, materia: { id: "m", nombre: "Matemática" },
      profesor: "Profesora", turno_id: `t${i}`, asistencia,
      ...(i === 0 ? { observacion: { temas_vistos: "Ecuaciones", observaciones_internas: "Repasar", registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local" } } : {}),
    })),
    paginacion: { total: 3, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
  }, error: null }) });
});

afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
});

describe("HU-E-09 historial académico", () => {
  it("muestra estados con texto y porcentaje excluyendo clases sin control", async () => {
    await act(async () => root.render(<HistorialAcademico alumnoId="a" puedeRegistrarExamen={false} puedeRegistrarIndicacion={false} mostrarNombre={false} />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(contenedor.textContent).toContain("50 % de asistencia");
    expect(contenedor.textContent).toContain("1 clases sin control excluidas del porcentaje");
    const lista = contenedor.querySelector('ol[aria-label="Registros del historial académico"]')!;
    expect(lista.textContent).toContain("Asistió");
    expect(lista.textContent).toContain("Ausente");
    expect(lista.textContent).toContain("Asistió (sin control de asistencia)");
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

  it("muestra las indicaciones con fecha local, autor y referencia a la clase", async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: {
      alumno: { id: "a", nombre_completo: "Alumno" }, materias_disponibles: [{ id: "m", nombre: "Matemática" }],
      indicaciones_opciones: { materias: [{ id: "m", nombre: "Matemática" }], clases: [{ id: "c", materia_id: "m", fecha: "2026-09-28" }] },
      asistencia_por_materia: [],
      items: [{ id: "i", tipo: "INDICACION", fecha: "2026-09-29", materia: { id: "m", nombre: "Matemática" }, indicacion: "Practicar ecuaciones", registrada_en: "2026-09-30T01:30:00.000Z", registrada_por: "mesa@noctium.local", clase_dictada_id: "c" }],
      paginacion: { total: 1, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
    }, error: null }) });
    await act(async () => root.render(<HistorialAcademico alumnoId="a" puedeRegistrarExamen={false} puedeRegistrarIndicacion={false} mostrarNombre={false} />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(contenedor.textContent).toContain("Indicación");
    expect(contenedor.textContent).toContain("Practicar ecuaciones");
    expect(contenedor.textContent).toContain("Registrada el 29/09/2026, 22:30");
    expect(contenedor.textContent).toContain("Registrada por mesa@noctium.local");
    expect(contenedor.textContent).toContain("Clase relacionada del 28/09/2026");
  });

  it("fija la materia del Profesor y deshabilita indicaciones antes de su primera clase", async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: {
      alumno: { id: "a", nombre_completo: "Alumno" }, materias_disponibles: [{ id: "m", nombre: "Matemática" }],
      indicaciones_opciones: { materias: [{ id: "m", nombre: "Matemática" }], clases: [] }, puede_registrar_indicacion: false,
      asistencia_por_materia: [], items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 },
    }, error: null }) });
    await act(async () => root.render(<HistorialAcademico alumnoId="a" materiaInicial="m" puedeRegistrarExamen={false} puedeRegistrarIndicacion mostrarNombre={false} />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const boton = Array.from(contenedor.querySelectorAll("button")).find((elemento) => elemento.textContent?.includes("Registrar indicación"));
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(contenedor.textContent).toContain("Vas a poder registrar indicaciones después de tu primera clase dictada de esta materia con este alumno.");
    expect(contenedor.querySelector("#materia-historial")).toBeNull();
  });
});
