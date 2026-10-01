import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerarTurnosSchema } from "./turno.generacion.schema";

const { materiaActiva, profesorActivo, dictaMateria, horario, aulasActivas, aulaActiva, existeAula,
  parametrosHorario, parametros, buscarTurnos, crearTurno, actualizarTurno, borrarTurno, crearEvento } = vi.hoisted(() => ({
  materiaActiva: vi.fn(), profesorActivo: vi.fn(), dictaMateria: vi.fn(), horario: vi.fn(),
  aulasActivas: vi.fn(), aulaActiva: vi.fn(), existeAula: vi.fn(), parametrosHorario: vi.fn(),
  parametros: vi.fn(), buscarTurnos: vi.fn(), crearTurno: vi.fn(), actualizarTurno: vi.fn(), borrarTurno: vi.fn(), crearEvento: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  parametroSistema: { findMany: parametros },
  turno: { findMany: buscarTurnos, create: crearTurno, update: actualizarTurno, delete: borrarTurno },
  eventoTurno: { create: crearEvento },
} }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerOpcionProfesorActivo: profesorActivo, profesorActivoDictaMateria: dictaMateria, obtenerHorarioDeProfesor: horario,
}));
vi.mock("@/server/aulas/aula.publico", () => ({
  hayAulasActivas: aulasActivas, verificarAulaActiva: aulaActiva, existeAula,
}));
vi.mock("@/server/shared/parametros", () => ({ obtenerParametrosHorarioOperativo: parametrosHorario }));

const { vistaPreviaGeneracion } = await import("./turno.generacion.service");
const ahora = new Date("2026-09-30T12:00:00.000Z"); // 09:00 en Buenos Aires
const base = {
  materia_id: "materia-1", profesor_id: "ckprofesor000000000000001", horario_id: "ckhorario000000000000001",
  duracion_min: 120, hora_inicio: "10:00", aula_id: "ckaula00000000000000001",
  fecha_desde: "2026-10-05", fecha_hasta: "2026-10-19",
};
const entrada = (cambios: Partial<typeof base> = {}) => GenerarTurnosSchema.parse({ ...base, ...cambios });
type TurnoGuardado = { fechaTurno: Date; horaInicioTurno: Date; duracionMinutosTurno: number; profesorId: string; materiaId: string; aulaId: string; estadoTurno: "PENDIENTE" | "DISPONIBLE" | "COMPLETO" | "CANCELADO" };
let turnos: TurnoGuardado[];
const guardado = (fecha: string, hora: string, estado: TurnoGuardado["estadoTurno"], cambios: Partial<TurnoGuardado> = {}): TurnoGuardado => ({
  fechaTurno: new Date(`${fecha}T00:00:00.000Z`), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
  duracionMinutosTurno: 120, profesorId: base.profesor_id, materiaId: base.materia_id, aulaId: base.aula_id,
  estadoTurno: estado, ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  turnos = [];
  materiaActiva.mockResolvedValue({ idMateria: base.materia_id });
  profesorActivo.mockResolvedValue({ id: base.profesor_id });
  dictaMateria.mockResolvedValue(true);
  horario.mockResolvedValue({ horario_id: base.horario_id, dia_semana: "LUNES", hora_inicio: "08:00", hora_fin: "14:00" });
  aulasActivas.mockResolvedValue(true);
  aulaActiva.mockResolvedValue({ idAula: base.aula_id, capacidadAula: 20 });
  existeAula.mockResolvedValue(false);
  parametrosHorario.mockResolvedValue({ diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"], apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 });
  parametros.mockResolvedValue([
    { clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "40" },
  ]);
  buscarTurnos.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => turnos.filter((turno) => {
    if (turno.fechaTurno.getTime() !== (where.fechaTurno as Date).getTime()) return false;
    if (where.materiaId && turno.materiaId !== where.materiaId) return false;
    if (where.aulaId && turno.aulaId !== where.aulaId) return false;
    if (typeof where.profesorId === "string" && turno.profesorId !== where.profesorId) return false;
    if (where.profesorId && typeof where.profesorId === "object" && !(where.profesorId as { in: string[] }).in.includes(turno.profesorId)) return false;
    if (where.estadoTurno && typeof where.estadoTurno === "object") {
      const estado = where.estadoTurno as { not?: string; in?: string[] };
      if (estado.not && turno.estadoTurno === estado.not) return false;
      if (estado.in && !estado.in.includes(turno.estadoTurno)) return false;
    }
    return true;
  }));
});

describe("vistaPreviaGeneracion", () => {
  it("devuelve todas las fechas sin escrituras ni eventos", async () => {
    await expect(vistaPreviaGeneracion(entrada(), ahora)).resolves.toEqual({
      cantidad: 3, fechas: ["2026-10-05", "2026-10-12", "2026-10-19"].map((fecha) => ({ fecha, estado: "OK", motivos: [] })),
      hay_conflictos: false, fechas_omitidas_vencidas: 0,
    });
    expect(crearTurno).not.toHaveBeenCalled();
    expect(actualizarTurno).not.toHaveBeenCalled();
    expect(borrarTurno).not.toHaveBeenCalled();
    expect(crearEvento).not.toHaveBeenCalled();
  });

  it("informa conflictos por fecha sin impedir la respuesta completa", async () => {
    turnos.push(guardado("2026-10-12", "10:00", "DISPONIBLE", { materiaId: "otra-materia", profesorId: "otro-profesor" }));
    const resultado = await vistaPreviaGeneracion(entrada(), ahora);
    expect(resultado).toMatchObject({ cantidad: 3, hay_conflictos: true, fechas: [
      { estado: "OK" }, { estado: "CONFLICTO", motivos: ["AULA_OCUPADA"] }, { estado: "OK" },
    ] });
    expect(crearTurno).not.toHaveBeenCalled();
  });

  it("detecta TURNO_EXISTENTE aun si está PENDIENTE y lo prioriza", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "PENDIENTE"));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas).toEqual([{ fecha: "2026-10-05", estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"] }]);
  });

  it.each(["DISPONIBLE", "COMPLETO"] as const)("detecta ocupación del profesor en estado %s", async (estado) => {
    turnos.push(guardado("2026-10-05", "10:00", estado, { materiaId: "otra-materia", aulaId: "otra-aula" }));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas[0]?.motivos).toEqual(["PROFESOR_OCUPADO"]);
  });

  it("devuelve ambos conflictos físicos en el orden del contrato", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "COMPLETO", { materiaId: "otra-materia" }));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas[0]?.motivos).toEqual(["AULA_OCUPADA", "PROFESOR_OCUPADO"]);
  });

  it("CANCELADO y turnos contiguos no bloquean; un turno existente confirmado sí", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "CANCELADO"));
    turnos.push(guardado("2026-10-05", "08:00", "DISPONIBLE"));
    turnos.push(guardado("2026-10-05", "12:00", "COMPLETO"));
    expect((await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora)).fechas[0]?.estado).toBe("OK");
    turnos.push(guardado("2026-10-05", "11:00", "DISPONIBLE"));
    expect((await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora)).fechas[0]?.motivos).toEqual(["TURNO_EXISTENTE"]);
  });

  it("acepta exactamente seis meses y rechaza un día adicional", async () => {
    const inicio = { fecha_desde: "2026-10-05", fecha_hasta: "2027-04-05" };
    await expect(vistaPreviaGeneracion(entrada(inicio), ahora)).resolves.toMatchObject({ cantidad: 27 });
    await expect(vistaPreviaGeneracion(entrada({ ...inicio, fecha_hasta: "2027-04-06" }), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
  });

  it("rechaza inicio pasado y rango sin día coincidente", async () => {
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-09-28", fecha_hasta: "2026-10-05" }), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-10-06", fecha_hasta: "2026-10-06" }), ahora)).rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO" });
  });

  it("cuenta hoy futuro y omite hoy vencido", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    const rango = { fecha_desde: "2026-09-30", fecha_hasta: "2026-10-07" };
    expect(await vistaPreviaGeneracion(entrada(rango), ahora)).toMatchObject({ cantidad: 2, fechas_omitidas_vencidas: 0 });
    const tarde = new Date("2026-09-30T15:00:00.000Z"); // 12:00 local
    expect(await vistaPreviaGeneracion(entrada(rango), tarde)).toMatchObject({ cantidad: 1, fechas_omitidas_vencidas: 1 });
    await expect(vistaPreviaGeneracion(entrada({ ...rango, fecha_hasta: "2026-09-30" }), tarde)).rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO" });
  });

  it("aplica el máximo sobre fechas generables después de omitir hoy vencido", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    parametros.mockResolvedValueOnce([{ clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "1" }]);
    const tarde = new Date("2026-09-30T15:00:00.000Z");
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-09-30", fecha_hasta: "2026-10-07" }), tarde))
      .resolves.toMatchObject({ cantidad: 1, fechas_omitidas_vencidas: 1, fechas: [{ fecha: "2026-10-07" }] });
  });

  it("devuelve SIN_FECHAS_EN_RANGO cuando solo quedaba hoy y ya venció", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    const tarde = new Date("2026-09-30T15:00:00.000Z");
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-09-30", fecha_hasta: "2026-09-30" }), tarde))
      .rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO" });
  });

  it("rechaza franja fuera de hora o granularidad", async () => {
    await expect(vistaPreviaGeneracion(entrada({ hora_inicio: "08:15" }), ahora)).rejects.toMatchObject({ code: "FUERA_DE_FRANJA" });
    await expect(vistaPreviaGeneracion(entrada({ hora_inicio: "13:00" }), ahora)).rejects.toMatchObject({ code: "FUERA_DE_FRANJA" });
  });

  it.each(["generacion_maxima_meses", "generacion_maxima_turnos"])("requiere %s sin fallback", async (clave) => {
    parametros.mockResolvedValueOnce([{ clave: clave === "generacion_maxima_meses" ? "generacion_maxima_turnos" : "generacion_maxima_meses", valor: "6" }]);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: "CONFIGURACION_GENERACION_INCOMPLETA" });
  });

  it("aplica el máximo configurado de turnos", async () => {
    parametros.mockResolvedValueOnce([{ clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "2" }]);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
  });

  it.each([
    ["materia inactiva", materiaActiva, "MATERIA_NO_DISPONIBLE"],
    ["profesor inactivo", profesorActivo, "PROFESOR_NO_ENCONTRADO"],
    ["sin relación materia-profesor", dictaMateria, "PROFESOR_NO_DICTA_MATERIA"],
    ["horario ajeno o inexistente", horario, "HORARIO_NO_ENCONTRADO"],
    ["sin aulas activas", aulasActivas, "SIN_AULAS_ACTIVAS"],
    ["aula inexistente", aulaActiva, "AULA_NO_ENCONTRADA"],
  ] as const)("rechaza %s", async (_nombre, dependencia, codigo) => {
    dependencia.mockResolvedValueOnce(null);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: codigo });
    expect(buscarTurnos).not.toHaveBeenCalled();
  });

  it("distingue aula inactiva", async () => {
    aulaActiva.mockResolvedValueOnce(null);
    existeAula.mockResolvedValueOnce(true);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: "AULA_INACTIVA" });
  });
});
