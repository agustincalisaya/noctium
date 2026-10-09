import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ contar: vi.fn(), activas: vi.fn(), materias: vi.fn(), activos: vi.fn(), profesores: vi.fn() }));
vi.mock("@/server/turnos/turno.publico", () => ({ contarClasesPorMes: m.contar }));
vi.mock("@/server/materias/materia.service", () => ({ listarMateriasActivas: m.activas }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: m.materias }));
vi.mock("@/server/profesores/profesor.publico", () => ({ listarOpcionesProfesoresActivos: m.activos, obtenerProfesoresBasicos: m.profesores }));
import { obtenerClasesPorMateria, obtenerClasesPorProfesor } from "@/server/indicadores/clases.service";
const rango = { desde: "2026-05", hasta: "2026-10" };
beforeEach(() => { vi.clearAllMocks(); m.contar.mockResolvedValue([]); m.activas.mockResolvedValue([{ idMateria: "a", nombreMateria: "Álgebra", codigoMateria: null }, { idMateria: "b", nombreMateria: "Física", codigoMateria: "FIS" }]); m.materias.mockResolvedValue([]); m.activos.mockResolvedValue([{ id: "p", nombreParaMostrar: "Álvarez, Ana" }, { id: "q", nombreParaMostrar: "Díaz, Luis" }]); m.profesores.mockResolvedValue([]); });
describe("Clases por materia", () => {
  it("suma meses/estados, incluye activos con cero e inactivos con datos sin pedir nombres ya disponibles", async () => {
    m.contar.mockResolvedValue([{ mes: "2026-05", estado: "DISPONIBLE", materia_id: "a", cantidad: 2, minutos: 120 }, { mes: "2026-06", estado: "CANCELADO", materia_id: "a", cantidad: 1, minutos: 180 }, { mes: "2026-05", estado: "COMPLETO", materia_id: "i", cantidad: 4, minutos: 240 }]);
    m.materias.mockResolvedValue([{ id: "i", nombre: "Química", codigo: null, activa: false }]);
    const r = await obtenerClasesPorMateria(rango); expect(r.total).toBe(7); expect(r.items.map(x => [x.materia_id, x.clases, x.activa])).toEqual([["i", 4, false], ["a", 3, true], ["b", 0, true]]); expect(m.materias).toHaveBeenCalledWith(["i"]); expect(m.contar).toHaveBeenCalledWith(expect.objectContaining(rango), { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"], por: "materia" });
  });
  it("desempata sin acentos ni mayúsculas y luego por id, independientemente del orden del catálogo", async () => {
    m.activas.mockResolvedValue([{ idMateria: "z", nombreMateria: "ÁLGEBRA", codigoMateria: null }, { idMateria: "a", nombreMateria: "algebra", codigoMateria: null }]);
    expect((await obtenerClasesPorMateria(rango)).items.map(x => x.materia_id)).toEqual(["a", "z"]);
  });
  it("vacío conserva todos los activos con cero y omite inactivos sin clases", async () => { const r = await obtenerClasesPorMateria({}); expect(r.total).toBe(0); expect(r.items).toHaveLength(2); expect(m.contar.mock.calls[0][0].meses).toHaveLength(6); });
  it("no oculta una referencia imposible del proveedor", async () => { m.contar.mockResolvedValue([{ materia_id: "missing", cantidad: 1 }]); await expect(obtenerClasesPorMateria(rango)).rejects.toThrow("inexistente"); });
});
describe("Clases por profesor", () => {
  it("canceladas cuentan clases y no horas; activos cero, inactivos con datos y total exacto", async () => {
    m.contar.mockResolvedValue([{ mes: "2026-05", estado: "DISPONIBLE", profesor_id: "p", cantidad: 1, minutos: 90 }, { mes: "2026-06", estado: "CANCELADO", profesor_id: "p", cantidad: 2, minutos: 360 }, { mes: "2026-05", estado: "COMPLETO", profesor_id: "i", cantidad: 3, minutos: 240 }]); m.profesores.mockResolvedValue([{ id: "i", nombreParaMostrar: "Zúñiga, Juan", activo: false }]);
    const r = await obtenerClasesPorProfesor(rango); expect(r.total).toEqual({ clases: 6, horas: 5.5 }); expect(r.items.map(x => [x.profesor_id, x.clases, x.horas, x.activo])).toEqual([["i", 3, 4, false], ["p", 3, 1.5, true], ["q", 0, 0, true]]); expect(m.profesores).toHaveBeenCalledWith(["i"]);
  });
  it("orden final por nombre sin acentos y luego id, incluso nombres idénticos", async () => { m.activos.mockResolvedValue([{ id: "z", nombreParaMostrar: "Álvarez, Ana" }, { id: "a", nombreParaMostrar: "alvarez, ana" }]); expect((await obtenerClasesPorProfesor(rango)).items.map(x => x.profesor_id)).toEqual(["a", "z"]); });
  it("redondea horas a dos decimales y el total suma los profesores listados", async () => { m.contar.mockResolvedValue([{ profesor_id: "p", estado: "DISPONIBLE", cantidad: 1, minutos: 61 }, { profesor_id: "q", estado: "COMPLETO", cantidad: 1, minutos: 61 }]); const r = await obtenerClasesPorProfesor(rango); expect(r.items[0].horas).toBe(1.02); expect(r.total.horas).toBe(2.04); });
  it("24 meses inclusivos llegan intactos a C", async () => { await obtenerClasesPorProfesor({ desde: "2024-11", hasta: "2026-10" }); expect(m.contar.mock.calls[0][0].meses).toHaveLength(24); });
  it("no inventa nombres cuando el proveedor devuelve una referencia inexistente", async () => { m.contar.mockResolvedValue([{ profesor_id: "missing", cantidad: 1, estado: "CANCELADO", minutos: 60 }]); await expect(obtenerClasesPorProfesor(rango)).rejects.toThrow("inexistente"); });
});
