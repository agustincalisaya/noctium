import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InscripcionDeAlumno } from "@/server/turnos/inscripcion.publico";
const m = vi.hoisted(() => ({ alumno: vi.fn(), inscripciones: vi.fn(), hechos: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: m.hechos } }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoBasico: m.alumno }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ listarInscripcionesDeAlumno: m.inscripciones }));
vi.mock("@/server/shared/reloj", () => ({ ahora: () => new Date("2026-10-09T13:00:00Z") }));
import { listarClasesDelAlumno } from "./clases-alumno.service";
const mesa = { id: "u", rol: "MESA_ENTRADA" as const };
const base: InscripcionDeAlumno = { inscripcion_id: "i", turno_id: "t", fecha: "2026-10-09", hora_inicio: "10:00", hora_fin: "11:00", estado_clase: "DISPONIBLE", materia: { id: "m", nombre: "Matemática" }, profesor: "Laura", aula: "Aula 1", vigencia: "VIGENTE", vigente_ahora: true, finalizada_el: null, cancelada_el: null, estado_pago: "PAGO_SIN_REGISTRAR", precio: 5000 };
beforeEach(() => { vi.clearAllMocks(); m.alumno.mockResolvedValue({ id: "a", nombre: "Ana", apellido: "Pérez", activo: false }); m.inscripciones.mockResolvedValue([base]); m.hechos.mockResolvedValue([]); });
describe("E02 clasificación y listado", () => {
  it.each(["CANCELADA_ALUMNO", "BAJA_ALUMNO", "QUITADA_CENTRO", "RESERVA_VENCIDA"] as const)("fin %s antes de cancelar gana", async vigencia => {
    m.inscripciones.mockResolvedValue([{ ...base, vigencia, estado_clase: "CANCELADO", finalizada_el: new Date("2026-10-08T10:00Z"), cancelada_el: new Date("2026-10-08T11:00Z") }]);
    expect((await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa)).items[0]?.resultado).toBe(vigencia);
  });
  it("cancelación anterior al fin gana; igualdad conserva fin", async () => {
    m.inscripciones.mockResolvedValue([{ ...base, vigencia: "BAJA_ALUMNO", estado_clase: "CANCELADO", finalizada_el: new Date("2026-10-08T12:00Z"), cancelada_el: new Date("2026-10-08T11:00Z") }]);
    expect((await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa)).items[0]?.resultado).toBe("CANCELADA_CENTRO");
    m.inscripciones.mockResolvedValue([{ ...base, vigencia: "BAJA_ALUMNO", estado_clase: "CANCELADO", finalizada_el: new Date("2026-10-08T11:00Z"), cancelada_el: new Date("2026-10-08T11:00Z") }]);
    expect((await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa)).items[0]?.resultado).toBe("BAJA_ALUMNO");
  });
  it("reserva vencida sin marcar y centro cancelado", async () => {
    m.inscripciones.mockResolvedValue([{ ...base, vigente_ahora: false, estado_pago: "RESERVADA" }, { ...base, inscripcion_id: "i2", estado_clase: "CANCELADO" }]);
    const r = await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa); expect(r.items.map(i => i.resultado)).toEqual(["CANCELADA_CENTRO", "RESERVA_VENCIDA"]);
  });
  it("estrictamente próxima antes de inicio; frontera inicio sin registrar", async () => {
    m.inscripciones.mockResolvedValue([{ ...base, hora_inicio: "10:01" }, { ...base, inscripcion_id: "i2" }]);
    expect((await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa)).items.map(i => i.resultado)).toEqual(["PROXIMA", "SIN_REGISTRAR_COMO_DICTADA"]);
  });
  it("presente/ausente/legacy con porcentajes y proyección sin montos", async () => {
    m.inscripciones.mockResolvedValue([base, { ...base, inscripcion_id: "i2", turno_id: "t2" }, { ...base, inscripcion_id: "i3", turno_id: "t3" }]);
    m.hechos.mockResolvedValue([{ turno_id: "t", asistencia: "PRESENTE" }, { turno_id: "t2", asistencia: "AUSENTE" }, { turno_id: "t3", asistencia: null }]);
    const r = await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, { id: "g", rol: "GERENTE" });
    expect(r.resumen).toMatchObject({ total: 3, asistio_sin_control: 1, clases_con_control: 2, porcentaje_asistencia: 50 }); expect(r.items[0]).toMatchObject({ resultado: "ASISTIO", sin_control_asistencia: true }); expect(JSON.stringify(r)).not.toMatch(/precio|estado_pago/);
    const filtrado = await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10, resultado: "ASISTIO", desde: new Date("2026-10-01Z"), hasta: new Date("2026-10-09Z") }, mesa);
    expect(filtrado.resumen).toMatchObject({ total: 2, asistio_sin_control: 1, clases_con_control: 1, porcentaje_asistencia: 100 }); expect(m.inscripciones).toHaveBeenLastCalledWith("a", { desde: "2026-10-01", hasta: "2026-10-09" });
  });
  it("ordena, pagina y resume todas las filas antes de paginar", async () => {
    m.inscripciones.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ ...base, inscripcion_id: String(i).padStart(2,"0") })));
    const r = await listarClasesDelAlumno("a", { pagina: 2, por_pagina: 10 }, mesa);
    expect(r.items.map(i => i.inscripcion_id)).toEqual(["01", "00"]); expect(r.resumen.total).toBe(12); expect(r.paginacion.total_paginas).toBe(2); expect(r.resumen.porcentaje_asistencia).toBeNull();
  });
  it("alumno inactivo sin inscripciones conserva respuesta vacía y nueve claves", async () => {
    m.inscripciones.mockResolvedValue([]); const r = await listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa); expect(Object.keys(r.resumen.por_resultado)).toHaveLength(9); expect(r.items).toEqual([]); expect(m.hechos).not.toHaveBeenCalled();
  });
  it.each(["PROFESOR", "ALUMNO"] as const)("rol %s 403 antes de leer", async rol => { await expect(listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, { id: "u", rol })).rejects.toMatchObject({ code: "SIN_PERMISO" }); expect(m.alumno).not.toHaveBeenCalled(); });
  it("inexistente 404", async () => { m.alumno.mockResolvedValue(null); await expect(listarClasesDelAlumno("a", { pagina: 1, por_pagina: 10 }, mesa)).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO" }); });
});
