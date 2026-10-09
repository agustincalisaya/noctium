import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ asistencia: vi.fn(), sinControl: vi.fn(), bajo: vi.fn(), alumnos: vi.fn(), materias: vi.fn(), parametros: vi.fn() }));
vi.mock("@/server/historial/historial.publico", () => ({ contarAsistenciasPorMes: mocks.asistencia, contarClasesDictadasSinControl: mocks.sinControl, listarAlumnosConPresentismoBajo: mocks.bajo }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: mocks.alumnos }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: mocks.materias }));
vi.mock("@/server/shared/parametros-vigentes", () => ({ parametrosVigentes: mocks.parametros }));
import { obtenerPresentismoPorMes, obtenerPresentismoPorMateria, listarAlumnosConPresentismoBajo } from "@/server/indicadores/presentismo.service";
const rango = { desde: "2026-05", hasta: "2026-07" };
beforeEach(() => { vi.clearAllMocks(); mocks.sinControl.mockResolvedValue(3); mocks.asistencia.mockResolvedValue([]); mocks.materias.mockResolvedValue([]); mocks.alumnos.mockResolvedValue([]); mocks.parametros.mockResolvedValue({ umbralPresentismo: 75 }); mocks.bajo.mockResolvedValue({ total: 0, items: [] }); });
describe("Presentismo mensual", () => {
  it("completa meses y excluye filas sin control, contando inscripciones, con resumen ponderado", async () => {
    mocks.asistencia.mockResolvedValue([{ mes: "2026-05", presentes: 1, ausentes: 1, sin_control: 50 }, { mes: "2026-07", presentes: 9, ausentes: 1, sin_control: 0 }]);
    expect(await obtenerPresentismoPorMes(rango)).toEqual({ meses: [
      { mes: "2026-05", inscriptos: 2, presentes: 1, ausentes: 1, indice: 50 },
      { mes: "2026-06", inscriptos: 0, presentes: 0, ausentes: 0, indice: null },
      { mes: "2026-07", inscriptos: 10, presentes: 9, ausentes: 1, indice: 90 },
    ], resumen: { inscriptos: 12, presentes: 10, ausentes: 2, indice: 83.3 }, clases_sin_control: 3 });
  });
  it("no confunde cero presentes con ausencia de datos y redondea a un decimal", async () => {
    mocks.asistencia.mockResolvedValue([{ mes: "2026-05", presentes: 0, ausentes: 4 }, { mes: "2026-06", presentes: 1, ausentes: 15 }]);
    const r = await obtenerPresentismoPorMes(rango); expect(r.meses[0].indice).toBe(0); expect(r.meses[1].indice).toBe(6.3);
  });
  it("por defecto consulta seis meses inclusive y sin datos mantiene resumen null", async () => {
    const r = await obtenerPresentismoPorMes({}); expect(r.meses).toHaveLength(6); expect(r.resumen.indice).toBeNull();
  });
});
describe("Presentismo por materia", () => {
  it("suma meses, mantiene inactivas con datos, omite sin control y ordena los empates por ausencias", async () => {
    mocks.asistencia.mockResolvedValue([{ mes: "2026-05", materia_id: "a", presentes: 1, ausentes: 1 }, { mes: "2026-06", materia_id: "a", presentes: 1, ausentes: 1 }, { mes: "2026-05", materia_id: "b", presentes: 1, ausentes: 1 }, { mes: "2026-05", materia_id: "c", presentes: 0, ausentes: 0, sin_control: 8 }]);
    mocks.materias.mockResolvedValue([{ id: "a", nombre: "Zeta", codigo: "Z", activa: false }, { id: "b", nombre: "Alfa", codigo: "A", activa: true }]);
    const r = await obtenerPresentismoPorMateria(rango); expect(r.items.map(x => x.materia_id)).toEqual(["a", "b"]); expect(r.items[0]).toMatchObject({ activa: false, presentes: 2, ausentes: 2, indice: 50 }); expect(r.resumen.inscriptos).toBe(6); expect(mocks.asistencia).toHaveBeenCalledWith(expect.objectContaining(rango), { porMateria: true });
  });
});
describe("Tabla de presentismo bajo", () => {
  it("lee el umbral vigente y delega comparación exacta y mínimo dos clases antes de paginar", async () => {
    mocks.bajo.mockResolvedValue({ total: 23, items: [{ alumno_id: "a", materia_id: "m", presentes: 1, ausentes: 2, clases: 3 }] });
    mocks.alumnos.mockResolvedValue([{ id: "a", nombre: "Juan", apellido: "Díaz" }]); mocks.materias.mockResolvedValue([{ id: "m", nombre: "Física" }]);
    const r = await listarAlumnosConPresentismoBajo({ ...rango, pagina: 2 });
    expect(mocks.bajo).toHaveBeenCalledWith(expect.objectContaining(rango), { umbral: 75, minimoClases: 2, limite: 10, desplazamiento: 10 });
    expect(r).toMatchObject({ total: 23, pagina: 2, por_pagina: 10, minimo_clases: 2, umbral: 75, items: [{ nombre_completo: "Díaz, Juan", materia: "Física", porcentaje: 33.3, ausencias: 2, clases_dictadas: 3 }] });
    mocks.parametros.mockResolvedValue({ umbralPresentismo: 80 }); await listarAlumnosConPresentismoBajo({ ...rango, pagina: 1 }); expect(mocks.bajo).toHaveBeenLastCalledWith(expect.objectContaining(rango), expect.objectContaining({ umbral: 80 }));
  });
  it("la página fuera de rango conserva el total de grupos sin inventar resultados", async () => {
    mocks.bajo.mockResolvedValue({ total: 23, items: [] }); expect(await listarAlumnosConPresentismoBajo({ ...rango, pagina: 99 })).toMatchObject({ items: [], total: 23, pagina: 99 });
  });
});
