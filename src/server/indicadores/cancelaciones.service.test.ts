import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ clases: vi.fn(), inscripciones: vi.fn(), materias: vi.fn() }));
vi.mock("@/server/turnos/turno.publico", () => ({ contarClasesPorMes: m.clases }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ contarInscripcionesPorMes: m.inscripciones }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: m.materias }));
import { obtenerCancelacionesPorMes, obtenerCancelacionesPorMateria } from "./cancelaciones.service";
const rango = { desde: "2026-05", hasta: "2026-10" };
beforeEach(() => { vi.clearAllMocks(); m.clases.mockResolvedValue([]); m.inscripciones.mockResolvedValue([]); m.materias.mockResolvedValue([]); });
describe("Cancelaciones mensuales", () => {
  it("completa ceros, separa unidades y excluye bajas del denominador", async () => {
    m.clases.mockResolvedValue([{ mes: "2026-05", estado: "DISPONIBLE", cantidad: 6 }, { mes: "2026-05", estado: "COMPLETO", cantidad: 2 }, { mes: "2026-06", estado: "CANCELADO", cantidad: 2 }]);
    m.inscripciones.mockResolvedValue([{ mes: "2026-05", vigencia: "VIGENTE", cantidad: 5 }, { mes: "2026-05", vigencia: "CANCELADA_ALUMNO", cantidad: 3 }, { mes: "2026-06", vigencia: "RESERVA_VENCIDA", cantidad: 2 }, { mes: "2026-06", vigencia: "BAJA_ALUMNO", cantidad: 12 }]);
    const r = await obtenerCancelacionesPorMes(rango);
    expect(r.meses).toHaveLength(6); expect(r.meses[5]).toEqual({ mes: "2026-10", clases_canceladas_centro: 0, inscripciones_canceladas_alumno: 0, reservas_vencidas: 0, bajas: 0 });
    expect(r.totales).toEqual({ clases_canceladas_centro: 2, inscripciones_canceladas_alumno: 3, reservas_vencidas: 2, bajas: 12 });
    expect(r.tasas).toEqual({ clases: { canceladas: 2, totales: 10, tasa: 20 }, inscripciones: { canceladas_alumno: 3, totales: 10, tasa: 30 } });
    expect(m.clases).toHaveBeenCalledWith(expect.objectContaining(rango), { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"] });
    expect(m.inscripciones).toHaveBeenCalledWith(expect.objectContaining(rango), { vigencias: ["VIGENTE", "CANCELADA_ALUMNO", "RESERVA_VENCIDA", "BAJA_ALUMNO"] });
  });
  it("denominador cero es null aunque haya bajas; no existe total combinado", async () => { m.inscripciones.mockResolvedValue([{ mes: "2026-05", vigencia: "BAJA_ALUMNO", cantidad: 7 }]); const r = await obtenerCancelacionesPorMes(rango); expect(r.tasas.clases.tasa).toBeNull(); expect(r.tasas.inscripciones).toEqual({ canceladas_alumno: 0, totales: 0, tasa: null }); expect(r).not.toHaveProperty("total"); });
  it("redondea una vez la razón del período, no promedia tasas mensuales", async () => { m.clases.mockResolvedValue([{ mes: "2026-05", estado: "CANCELADO", cantidad: 1 }, { mes: "2026-06", estado: "DISPONIBLE", cantidad: 31 }]); m.inscripciones.mockResolvedValue([{ mes: "2026-05", vigencia: "CANCELADA_ALUMNO", cantidad: 31 }, { mes: "2026-06", vigencia: "VIGENTE", cantidad: 49 }]); const r = await obtenerCancelacionesPorMes(rango); expect(r.tasas.clases.tasa).toBe(3.1); expect(r.tasas.inscripciones.tasa).toBe(38.8); });
  it("rango por defecto y 24 meses se conservan", async () => { expect((await obtenerCancelacionesPorMes({})).meses).toHaveLength(6); expect((await obtenerCancelacionesPorMes({ desde: "2024-11", hasta: "2026-10" })).meses).toHaveLength(24); });
  it("rechaza filas fuera del rango", async () => { m.inscripciones.mockResolvedValue([{ mes: "2024-01", vigencia: "VIGENTE", cantidad: 1 }]); await expect(obtenerCancelacionesPorMes(rango)).rejects.toThrow("fuera del rango"); });
});
describe("Cancelaciones por materia", () => {
  it("agrega por período, incluye inactivas y ordena por centro, alumno, nombre e id", async () => {
    m.clases.mockResolvedValue([{ materia_id: "a", cantidad: 1 }, { materia_id: "a", cantidad: 2 }, { materia_id: "b", cantidad: 3 }, { materia_id: "c", cantidad: 3 }]);
    m.inscripciones.mockResolvedValue([{ materia_id: "b", cantidad: 2 }, { materia_id: "c", cantidad: 2 }, { materia_id: "solo", cantidad: 8 }]);
    m.materias.mockResolvedValue([{ id: "a", nombre: "Z", codigo: null, activa: true }, { id: "c", nombre: "ÁLGEBRA", codigo: null, activa: true }, { id: "b", nombre: "algebra", codigo: "ALG", activa: false }, { id: "solo", nombre: "Física", codigo: null, activa: true }]);
    const r = await obtenerCancelacionesPorMateria(rango); expect(r.items.map(i => i.materia_id)).toEqual(["b", "c", "a", "solo"]); expect(r.items[0]).toMatchObject({ activa: false, clases_canceladas_centro: 3, inscripciones_canceladas_alumno: 2 }); expect(m.inscripciones).toHaveBeenCalledWith(expect.objectContaining(rango), { vigencias: ["CANCELADA_ALUMNO"], porMateria: true });
  });
  it("sin cancelaciones no lista materias activas ni cero del proveedor", async () => { m.clases.mockResolvedValue([{ materia_id: "cero", cantidad: 0 }]); expect(await obtenerCancelacionesPorMateria(rango)).toEqual({ items: [] }); expect(m.materias).toHaveBeenCalledWith([]); });
  it("no oculta referencias inexistentes", async () => { m.clases.mockResolvedValue([{ materia_id: "missing", cantidad: 1 }]); await expect(obtenerCancelacionesPorMateria(rango)).rejects.toThrow("inexistente"); });
});
