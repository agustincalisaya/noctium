import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    $queryRaw: vi.fn(),
    turno: { findUnique: vi.fn(), updateMany: vi.fn() },
    turnoAlumno: { findMany: vi.fn() },
    eventoTurno: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const {
  bloquearTurnoParaOperacion,
  obtenerAlumnosInscriptosDeTurno,
  contarTurnosFuturosDeProfesorPorMateria,
  ajustarCuposPorCapacidadDeAula,
  contarTurnosPorMes,
} = await import("./turno.publico");

const turnoId = "turno-1";
const aulaId = "aula-1";
const usuarioId = "usuario-1";
const tx = db as never;
const sql = (indice = 0) => (db.$queryRaw.mock.calls[indice]![0] as TemplateStringsArray).join("?");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  // 09:00 en America/Argentina/Buenos_Aires.
  vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
  db.turnoAlumno.findMany.mockResolvedValue([]);
  db.turno.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("bloquearTurnoParaOperacion", () => {
  const fila = {
    idTurno: turnoId, estadoTurno: "COMPLETO",
    fechaTurno: new Date("2026-09-28T00:00:00.000Z"),
    horaInicioTurno: new Date("1970-01-01T10:30:00.000Z"),
    duracionMinutosTurno: 120, materiaId: "materia-1", profesorId: "profesor-1", aulaId,
  };

  it("bloquea con FOR SHARE y lee los inscriptos después de adquirirlo", async () => {
    db.$queryRaw.mockResolvedValue([fila]);
    db.turnoAlumno.findMany.mockResolvedValue([{ alumnoId: "alumno-1" }, { alumnoId: "alumno-2" }]);
    await expect(bloquearTurnoParaOperacion(turnoId, tx)).resolves.toEqual({
      id: turnoId, estado: "COMPLETO", fecha: "2026-09-28", hora_inicio: "10:30", hora_fin: "12:30",
      duracion_min: 120, materia_id: "materia-1", profesor_id: "profesor-1", aula_id: aulaId,
      alumno_ids: ["alumno-1", "alumno-2"], vencido: false,
    });
    expect(sql()).toMatch(/FROM "turnos" WHERE "idTurno" = \? FOR SHARE/);
    expect(db.$queryRaw.mock.calls[0]![1]).toBe(turnoId);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.turnoAlumno.findMany.mock.invocationCallOrder[0]);
    expect(db.turnoAlumno.findMany).toHaveBeenCalledWith({
      where: { turnoId }, select: { alumnoId: true }, orderBy: { alumnoId: "asc" },
    });
  });

  it("devuelve null sin consultar inscriptos si no existe, y marca vencido desde la hora de inicio", async () => {
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([fila]);
    await expect(bloquearTurnoParaOperacion(turnoId, tx)).resolves.toBeNull();
    expect(db.turnoAlumno.findMany).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-09-28T13:30:00.000Z"));
    await expect(bloquearTurnoParaOperacion(turnoId, tx)).resolves.toMatchObject({ vencido: true });
  });
});

describe("obtenerAlumnosInscriptosDeTurno", () => {
  it("distingue turno inexistente de turno sin alumnos y usa el db recibido", async () => {
    db.turno.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ alumnos: [] })
      .mockResolvedValueOnce({ alumnos: [{ alumnoId: "a" }, { alumnoId: "b" }] });
    await expect(obtenerAlumnosInscriptosDeTurno(turnoId, tx)).resolves.toBeNull();
    await expect(obtenerAlumnosInscriptosDeTurno(turnoId, tx)).resolves.toEqual([]);
    await expect(obtenerAlumnosInscriptosDeTurno(turnoId, tx)).resolves.toEqual(["a", "b"]);
    expect(db.turno.findUnique).toHaveBeenCalledWith({
      where: { idTurno: turnoId },
      select: { alumnos: { select: { alumnoId: true }, orderBy: { alumnoId: "asc" } } },
    });
  });
});

describe("contarTurnosFuturosDeProfesorPorMateria", () => {
  it("separa confirmados y pendientes, excluye cancelados y usa el límite de vigencia local", async () => {
    db.$queryRaw.mockResolvedValue([{ confirmados: 3n, pendientes: 2n }]);
    await expect(contarTurnosFuturosDeProfesorPorMateria("profesor-1", "materia-1", tx))
      .resolves.toEqual({ confirmados: 3, pendientes: 2 });
    expect(sql()).toContain("COUNT(*) FILTER (WHERE \"estadoTurno\" IN ('DISPONIBLE', 'COMPLETO'))");
    expect(sql()).toContain("COUNT(*) FILTER (WHERE \"estadoTurno\" = 'PENDIENTE')");
    expect(sql()).toContain("date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')");
    expect(sql()).not.toContain("CANCELADO");
    expect(db.$queryRaw.mock.calls[0]!.slice(1)).toEqual(["profesor-1", "materia-1"]);
  });

  it("devuelve ceros sin turnos", async () => {
    db.$queryRaw.mockResolvedValue([{ confirmados: 0n, pendientes: 0n }]);
    await expect(contarTurnosFuturosDeProfesorPorMateria("p", "m"))
      .resolves.toEqual({ confirmados: 0, pendientes: 0 });
  });
});

describe("ajustarCuposPorCapacidadDeAula", () => {
  it("rechaza capacidad menor a los inscriptos confirmados sin efectuar escrituras", async () => {
    db.$queryRaw.mockResolvedValue([
      { idTurno: "1", estadoTurno: "PENDIENTE", cupoMaximoTurno: 5,
        fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
      { idTurno: "2", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 5,
        fechaTurno: new Date("2026-10-02T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
      { idTurno: "3", estadoTurno: "COMPLETO", cupoMaximoTurno: 5,
        fechaTurno: new Date("2026-10-03T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
    ]);
    db.turnoAlumno.findMany.mockResolvedValue([
      { turnoId: "2", alumnoId: "a" }, { turnoId: "2", alumnoId: "b" },
      { turnoId: "3", alumnoId: "c" }, { turnoId: "3", alumnoId: "d" }, { turnoId: "3", alumnoId: "e" },
    ]);
    await expect(ajustarCuposPorCapacidadDeAula(aulaId, 1, usuarioId, tx))
      .resolves.toEqual({ ok: false, turnos_en_conflicto: ["2", "3"], max_inscriptos: 3 });
    expect(sql()).toMatch(/ORDER BY "idTurno" FOR UPDATE/);
    expect(sql()).not.toContain('("fechaTurno" + "horaInicioTurno")');
    expect(sql()).not.toContain("CURRENT_TIMESTAMP");
    expect(sql()).toContain("'PENDIENTE', 'DISPONIBLE', 'COMPLETO'");
    expect(sql()).not.toContain("CANCELADO");
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.turnoAlumno.findMany.mock.invocationCallOrder[0]);
    expect(db.turno.updateMany).not.toHaveBeenCalled();
    expect(db.eventoTurno.create).not.toHaveBeenCalled();
  });

  it("actualiza pendientes sin transición y devuelve eventos de ambos cambios de estado", async () => {
    db.$queryRaw.mockResolvedValue([
      { idTurno: "1", estadoTurno: "PENDIENTE", cupoMaximoTurno: 2,
        fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
      { idTurno: "2", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 3,
        fechaTurno: new Date("2026-10-02T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
      { idTurno: "3", estadoTurno: "COMPLETO", cupoMaximoTurno: 1,
        fechaTurno: new Date("2026-10-03T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
    ]);
    db.turnoAlumno.findMany.mockResolvedValue([
      { turnoId: "2", alumnoId: "a" }, { turnoId: "2", alumnoId: "b" },
      { turnoId: "3", alumnoId: "c" },
    ]);
    const resultado = await ajustarCuposPorCapacidadDeAula(aulaId, 2, usuarioId, tx);
    expect(resultado).toMatchObject({ ok: true, turnos_actualizados: 3 });
    if (!resultado.ok) throw new Error("Se esperaba un ajuste exitoso");
    expect(resultado.eventos.map(({ tipoEvento }) => tipoEvento)).toEqual([
      "turno:cupo_actualizado", "turno:cupo_actualizado", "turno:completado",
      "turno:cupo_actualizado", "turno:disponible_nuevamente",
    ]);
    expect(resultado.eventos[0]).toEqual({
      tipoEvento: "turno:cupo_actualizado", turnoId: "1",
      payloadEvento: { turno_id: "1", aula_id: aulaId, cupo_anterior: 2, cupo_nuevo: 2, usuario_id: usuarioId },
    });
    expect(resultado.eventos[2]).toEqual({
      tipoEvento: "turno:completado", turnoId: "2",
      payloadEvento: { turno_id: "2", alumno_ids: ["a", "b"], cupo_maximo: 2, usuario_id: usuarioId },
    });
    expect(resultado.eventos[4]).toEqual({
      tipoEvento: "turno:disponible_nuevamente", turnoId: "3",
      payloadEvento: { turno_id: "3", alumno_id_liberado: null, usuario_id: usuarioId },
    });
    expect(db.turno.updateMany.mock.calls.map(([{ where }]) => where.idTurno)).toEqual(["1", "2", "3"]);
    expect(db.turno.updateMany.mock.calls[0]![0].where).toMatchObject({
      idTurno: "1", aulaId, estadoTurno: "PENDIENTE", cupoMaximoTurno: 2,
    });
    expect(db.turno.updateMany.mock.calls[0]![0].data).toEqual({ cupoMaximoTurno: 2, modificadoPorUsuarioId: usuarioId });
    expect(db.turno.updateMany.mock.calls[1]![0].data).toMatchObject({ cupoMaximoTurno: 2, estadoTurno: "COMPLETO" });
    expect(db.turno.updateMany.mock.calls[2]![0].data).toMatchObject({ cupoMaximoTurno: 2, estadoTurno: "DISPONIBLE" });
    expect(db.eventoTurno.create).not.toHaveBeenCalled();
  });

  it("bloquea vencidos pero solo consulta y modifica turnos vigentes", async () => {
    db.$queryRaw.mockResolvedValue([
      { idTurno: "pasado", estadoTurno: "COMPLETO", cupoMaximoTurno: 1,
        fechaTurno: new Date("2026-09-27T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
      { idTurno: "vigente", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 4,
        fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") },
    ]);
    db.turnoAlumno.findMany.mockResolvedValue([{ turnoId: "vigente", alumnoId: "a" }]);
    const resultado = await ajustarCuposPorCapacidadDeAula(aulaId, 1, usuarioId, tx);
    expect(resultado).toMatchObject({ ok: true, turnos_actualizados: 1 });
    if (!resultado.ok) throw new Error("Se esperaba un ajuste exitoso");
    expect(resultado.eventos.every(({ turnoId: id }) => id === "vigente")).toBe(true);
    expect(db.turnoAlumno.findMany.mock.calls[0]![0].where.turnoId.in).toEqual(["vigente"]);
    expect(db.turno.updateMany.mock.calls.map(([{ where }]) => where.idTurno)).toEqual(["vigente"]);
  });

  it("no escribe ni emite cuando todos los turnos bloqueados están vencidos", async () => {
    db.$queryRaw.mockResolvedValue([{ idTurno: "pasado", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 4,
      fechaTurno: new Date("2026-09-27T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") }]);
    await expect(ajustarCuposPorCapacidadDeAula(aulaId, 4, usuarioId, tx))
      .resolves.toEqual({ ok: true, turnos_actualizados: 0, eventos: [] });
    expect(db.turnoAlumno.findMany).not.toHaveBeenCalled();
    expect(db.turno.updateMany).not.toHaveBeenCalled();
  });

  it.each([0, 2])("revierte si updateMany informa %i filas para un turno", async (count) => {
    db.$queryRaw.mockResolvedValue([{ idTurno: "vigente", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 4,
      fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") }]);
    db.turno.updateMany.mockResolvedValue({ count });
    await expect(ajustarCuposPorCapacidadDeAula(aulaId, 2, usuarioId, tx))
      .rejects.toThrow("No se pudo actualizar el turno vigente");
    expect(db.eventoTurno.create).not.toHaveBeenCalled();
  });
});

describe("contarTurnosPorMes", () => {
  it("incluye el mes hasta mediante límite superior exclusivo y convierte bigint", async () => {
    db.$queryRaw.mockResolvedValue([{ mes: "2026-12", cantidad: 2n }, { mes: "2027-01", cantidad: 1n }]);
    await expect(contarTurnosPorMes("2026-12", "2027-01", tx)).resolves.toEqual([
      { mes: "2026-12", cantidad: 2 }, { mes: "2027-01", cantidad: 1 },
    ]);
    expect(sql()).toContain("\"fechaTurno\" >= CAST(? AS date)");
    expect(sql()).toContain("\"fechaTurno\" < CAST(? AS date)");
    expect(sql()).toContain("'DISPONIBLE', 'COMPLETO', 'CANCELADO'");
    expect(sql()).toContain("GROUP BY to_char(\"fechaTurno\", 'YYYY-MM')");
    expect(db.$queryRaw.mock.calls[0]!.slice(1)).toEqual(["2026-12-01", "2027-02-01"]);
  });

  it("omite los meses sin datos", async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(contarTurnosPorMes("2026-01", "2026-03")).resolves.toEqual([]);
  });
});

const { emitirEventosTurno } = await import("./turno.publico");
type EventoTurnoPendiente = import("./turno.publico").EventoTurnoPendiente;
const createMany = vi.fn();
Object.assign(db.eventoTurno, { createMany });

const filaTurnoAula = (idTurno: string, estadoTurno: string, cupoMaximoTurno: number, hora = "10:00") => ({
  idTurno, estadoTurno, cupoMaximoTurno,
  fechaTurno: new Date("2026-09-28T00:00:00.000Z"), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
});

describe("emitirEventosTurno", () => {
  const eventos: EventoTurnoPendiente[] = [
    {
      tipoEvento: "turno:cupo_actualizado", turnoId: "t1",
      payloadEvento: { turno_id: "t1", aula_id: aulaId, cupo_anterior: null, cupo_nuevo: 3, usuario_id: "u1" },
    },
    {
      tipoEvento: "turno:completado", turnoId: "t2",
      payloadEvento: { turno_id: "t2", alumno_ids: ["a", "b"], cupo_maximo: 2, usuario_id: "u2" },
    },
    {
      tipoEvento: "turno:disponible_nuevamente", turnoId: "t3",
      payloadEvento: { turno_id: "t3", alumno_id_liberado: null, usuario_id: "u3" },
    },
  ];

  it("inserta los tres tipos con un único createMany, una fila por evento y en el mismo orden", async () => {
    const otroDb = { eventoTurno: { createMany: vi.fn().mockResolvedValue({ count: 3 }) } };
    await expect(emitirEventosTurno(eventos, otroDb as never)).resolves.toBeUndefined();
    expect(otroDb.eventoTurno.createMany).toHaveBeenCalledTimes(1);
    expect(otroDb.eventoTurno.createMany).toHaveBeenCalledWith({
      data: [
        {
          tipoEvento: "turno:cupo_actualizado", turnoId: "t1", usuarioId: "u1",
          payloadEvento: { turno_id: "t1", aula_id: aulaId, cupo_anterior: null, cupo_nuevo: 3, usuario_id: "u1" },
        },
        {
          tipoEvento: "turno:completado", turnoId: "t2", usuarioId: "u2",
          payloadEvento: { turno_id: "t2", alumno_ids: ["a", "b"], cupo_maximo: 2, usuario_id: "u2" },
        },
        {
          tipoEvento: "turno:disponible_nuevamente", turnoId: "t3", usuarioId: "u3",
          payloadEvento: { turno_id: "t3", alumno_id_liberado: null, usuario_id: "u3" },
        },
      ],
    });
    const { data } = otroDb.eventoTurno.createMany.mock.calls[0]![0];
    expect(Object.keys(data[0]).sort()).toEqual(["payloadEvento", "tipoEvento", "turnoId", "usuarioId"]);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("con un arreglo vacío no toca la base", async () => {
    const otroDb = { eventoTurno: { createMany: vi.fn() } };
    await expect(emitirEventosTurno([], otroDb as never)).resolves.toBeUndefined();
    await expect(emitirEventosTurno([])).resolves.toBeUndefined();
    expect(otroDb.eventoTurno.createMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("sin db usa el prisma global", async () => {
    createMany.mockResolvedValue({ count: 1 });
    await emitirEventosTurno([eventos[0]!]);
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0]![0].data).toHaveLength(1);
  });

  it("si createMany rechaza, rechaza con el mismo error", async () => {
    const error = new Error("fallo de escritura");
    createMany.mockRejectedValue(error);
    await expect(emitirEventosTurno(eventos)).rejects.toBe(error);
  });

  it("acepta sin cast los eventos de un ajuste real DISPONIBLE → COMPLETO", async () => {
    db.$queryRaw.mockResolvedValue([filaTurnoAula("t-disponible", "DISPONIBLE", 4)]);
    db.turnoAlumno.findMany.mockResolvedValue([
      { turnoId: "t-disponible", alumnoId: "a" }, { turnoId: "t-disponible", alumnoId: "b" },
    ]);
    createMany.mockResolvedValue({ count: 2 });
    const ajuste = await ajustarCuposPorCapacidadDeAula(aulaId, 2, usuarioId, tx);
    if (!ajuste.ok) throw new Error("Se esperaba un ajuste exitoso");
    await emitirEventosTurno(ajuste.eventos);
    expect(createMany.mock.calls[0]![0].data).toEqual([
      {
        tipoEvento: "turno:cupo_actualizado", turnoId: "t-disponible", usuarioId,
        payloadEvento: { turno_id: "t-disponible", aula_id: aulaId, cupo_anterior: 4, cupo_nuevo: 2, usuario_id: usuarioId },
      },
      {
        tipoEvento: "turno:completado", turnoId: "t-disponible", usuarioId,
        payloadEvento: { turno_id: "t-disponible", alumno_ids: ["a", "b"], cupo_maximo: 2, usuario_id: usuarioId },
      },
    ]);
  });
});

describe("ajustarCuposPorCapacidadDeAula: frontera de turno futuro (>= ahora, a minuto, Buenos Aires)", () => {
  // Turno de hoy 28/09/2026 a las 10:00 locales = 13:00 UTC (UTC-3, sin horario de verano).
  it.each([
    ["1 minuto antes del inicio", "2026-09-28T12:59:00.000Z", 1],
    ["el mismo minuto del inicio", "2026-09-28T13:00:00.000Z", 1],
    ["el mismo minuto, a los 59 segundos", "2026-09-28T13:00:59.999Z", 1],
    ["1 minuto después del inicio", "2026-09-28T13:01:00.000Z", 0],
  ])("%s ajusta %i turno(s)", async (_caso, ahora, esperados) => {
    vi.setSystemTime(new Date(ahora));
    db.$queryRaw.mockResolvedValue([filaTurnoAula("hoy", "DISPONIBLE", 4)]);
    await expect(ajustarCuposPorCapacidadDeAula(aulaId, 3, usuarioId, tx))
      .resolves.toMatchObject({ ok: true, turnos_actualizados: esperados });
    expect(db.turno.updateMany).toHaveBeenCalledTimes(esperados);
  });

  it("usa el mismo instante para turnos equivalentes aunque cambie el minuto durante el filtro", async () => {
    vi.setSystemTime(new Date("2026-09-28T13:00:58.000Z"));
    const primero = filaTurnoAula("primero", "DISPONIBLE", 4);
    const segundo = filaTurnoAula("segundo", "DISPONIBLE", 4);
    const fecha = segundo.fechaTurno;
    let lecturas = 0;
    Object.defineProperty(segundo, "fechaTurno", {
      get() {
        if (++lecturas === 1) vi.setSystemTime(new Date("2026-09-28T13:01:00.000Z"));
        return fecha;
      },
    });
    db.$queryRaw.mockImplementation(async () => {
      // Simula la espera hasta que FOR UPDATE devuelve las filas bloqueadas.
      vi.setSystemTime(new Date("2026-09-28T13:00:59.999Z"));
      return [primero, segundo];
    });

    const ajuste = await ajustarCuposPorCapacidadDeAula(aulaId, 3, usuarioId, tx);
    expect(ajuste).toMatchObject({ ok: true, turnos_actualizados: 2 });
    expect(db.turno.updateMany.mock.calls.map(([{ where }]) => where.idTurno)).toEqual(["primero", "segundo"]);
    expect(lecturas).toBeGreaterThan(0);
  });

  it("toma el instante después de esperar los locks", async () => {
    vi.setSystemTime(new Date("2026-09-28T13:00:59.999Z"));
    db.$queryRaw.mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-09-28T13:01:00.000Z"));
      return [filaTurnoAula("hoy", "DISPONIBLE", 4)];
    });

    await expect(ajustarCuposPorCapacidadDeAula(aulaId, 3, usuarioId, tx))
      .resolves.toEqual({ ok: true, turnos_actualizados: 0, eventos: [] });
    expect(db.turno.updateMany).not.toHaveBeenCalled();
  });

  it("bloquearTurnoParaOperacion conserva el criterio estricto: en el mismo minuto ya está vencido", async () => {
    vi.setSystemTime(new Date("2026-09-28T13:00:00.000Z"));
    db.$queryRaw.mockResolvedValue([{
      ...filaTurnoAula(turnoId, "DISPONIBLE", 4), duracionMinutosTurno: 60, materiaId: "m", profesorId: null, aulaId,
    }]);
    await expect(bloquearTurnoParaOperacion(turnoId, tx)).resolves.toMatchObject({ vencido: true });
  });
});
