import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  transaction: vi.fn(), queryRaw: vi.fn(), updateMany: vi.fn(), turnoAlumnoFindMany: vi.fn(), eventoCreate: vi.fn(),
  findUnique: vi.fn(), turnoFindMany: vi.fn(), parametros: vi.fn(),
  enHorario: vi.fn(), horarios: vi.fn(), profesores: vi.fn(), aula: vi.fn(), alumnos: vi.fn(),
  // Persistencia de la inscripción (PR-0.md §2.0): vencimiento de reservas antes y después de mover la clase.
  marcarVencidas: vi.fn(), recalcularVencimientos: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: m.transaction,
  eventoTurno: { create: m.eventoCreate },
  turno: { findUnique: m.findUnique, findMany: m.turnoFindMany },
  turnoAlumno: { findMany: m.turnoAlumnoFindMany },
  parametroSistema: { findMany: m.parametros },
} }));
vi.mock("@/server/profesores/profesor.publico", async (original) => ({
  ...(await original<typeof import("@/server/profesores/profesor.publico")>()),
  estaDentroDeHorarioAtencion: m.enHorario, obtenerHorariosDeAtencion: m.horarios,
}));
// turnoAlumnoFindMany: las inscripciones vigentes de la clase (inscripcionesVigentes, PR-0.md §2.2).
vi.mock("./inscripcion.vigencia", async (original) => ({
  ...(await original<typeof import("./inscripcion.vigencia")>()), inscripcionesVigentes: m.turnoAlumnoFindMany,
}));
vi.mock("./inscripcion.service", () => ({ marcarVencidas: m.marcarVencidas, recalcularVencimientos: m.recalcularVencimientos }));
vi.mock("./turno.disponibilidad", async (original) => ({
  ...(await original<typeof import("./turno.disponibilidad")>()),
  profesoresConTurnoSuperpuesto: m.profesores, aulaConTurnoSuperpuesto: m.aula, alumnosConTurnoSuperpuesto: m.alumnos,
}));

const { opcionesReprogramacion, reprogramarTurno } = await import("./turno.reprogramacion.service");

// Jueves 01/10/2026 12:00 en Buenos Aires. Parámetros por defecto: LUN–VIE, 08:00–20:00, 30 min, 30 días.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-10-01T15:00:00.000Z"));
afterAll(() => { vi.useRealTimers(); });

const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const fila = (extra: Record<string, unknown> = {}) => ({
  idTurno: "turno-1", estadoTurno: "DISPONIBLE", fechaTurno: fecha("2026-10-06"), horaInicioTurno: hora("16:00"),
  duracionMinutosTurno: 60, profesorId: "prof-1", aulaId: "aula-1", ...extra,
});
// transaccion() (PR-0.md §2.16) fija los tiempos de la transacción al empezar ($executeRawUnsafe).
const tx = () => ({ $executeRawUnsafe: vi.fn(), $queryRaw: m.queryRaw, turno: { updateMany: m.updateMany }, turnoAlumno: { findMany: m.turnoAlumnoFindMany } });
const input = (valor = "2026-10-07", horaInicio = "17:00") => ({ fecha: fecha(valor), hora_inicio: horaInicio });

beforeEach(() => {
  vi.clearAllMocks();
  m.parametros.mockResolvedValue([]);
  m.queryRaw.mockResolvedValue([fila()]);
  m.findUnique.mockResolvedValue(fila());
  m.turnoAlumnoFindMany.mockResolvedValue([{ id: "insc-2", alumnoId: "alumno-2" }, { id: "insc-1", alumnoId: "alumno-1" }]);
  m.marcarVencidas.mockResolvedValue(0);
  m.recalcularVencimientos.mockResolvedValue({ marcadas: 0, recalculadas: 0 });
  m.updateMany.mockResolvedValue({ count: 1 });
  m.eventoCreate.mockResolvedValue({});
  m.enHorario.mockResolvedValue(true);
  m.profesores.mockResolvedValue(new Map());
  m.aula.mockResolvedValue(false);
  m.alumnos.mockResolvedValue([]);
  m.horarios.mockResolvedValue([{ horario_id: "h1", dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" },
    { horario_id: "h2", dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "12:00" }]);
  m.turnoFindMany.mockResolvedValue([]);
  m.transaction.mockImplementation(async (callback: (cliente: unknown) => Promise<unknown>) => callback(tx()));
});

describe("HU-C-06 reprogramarTurno", () => {
  it("AC3: actualiza solo fecha, hora y auditoría, conserva el estado y emite el evento después del commit", async () => {
    let comprometida = false;
    m.transaction.mockImplementation(async (callback: (cliente: unknown) => Promise<unknown>) => { const r = await callback(tx()); comprometida = true; return r; });
    m.eventoCreate.mockImplementation(async () => { expect(comprometida).toBe(true); return {}; });
    m.queryRaw.mockResolvedValue([fila({ estadoTurno: "COMPLETO" })]);

    await expect(reprogramarTurno("turno-1", input(), "mesa-1")).resolves.toEqual({
      id: "turno-1", fecha: "2026-10-07", hora_inicio: "17:00", hora_fin: "18:00", estado: "COMPLETO",
    });
    expect(m.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { idTurno: "turno-1", estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } },
      data: { fechaTurno: fecha("2026-10-07"), horaInicioTurno: hora("17:00"), modificadoPorUsuarioId: "mesa-1" },
    });
    // Reservas (PR-0.md §2.0): las vencidas se marcan antes de mover la clase y las que siguen recalculan su vencimiento después.
    expect(m.marcarVencidas).toHaveBeenCalledWith(expect.anything(), "turno-1");
    expect(m.recalcularVencimientos).toHaveBeenCalledWith(expect.anything(), "turno-1");
    expect(m.marcarVencidas.mock.invocationCallOrder[0]).toBeLessThan(m.updateMany.mock.invocationCallOrder[0]);
    expect(m.updateMany.mock.invocationCallOrder[0]).toBeLessThan(m.recalcularVencimientos.mock.invocationCallOrder[0]);
    expect(m.eventoCreate).toHaveBeenCalledExactlyOnceWith({ data: {
      tipoEvento: "turno:reprogramado", turnoId: "turno-1", usuarioId: "mesa-1",
      payloadEvento: { turno_id: "turno-1", fecha_anterior: "2026-10-06", hora_inicio_anterior: "16:00", fecha_nueva: "2026-10-07",
        hora_inicio_nueva: "17:00", hora_fin_nueva: "18:00", usuario_id: "mesa-1" },
    } });
  });

  it("AC2: valida profesor, aula y alumnos contra el candidato excluyendo el propio turno", async () => {
    await reprogramarTurno("turno-1", input(), "mesa-1");
    const candidato = { idTurno: "turno-1", fechaTurno: fecha("2026-10-07"), horaInicioTurno: hora("17:00"), duracionMinutosTurno: 60 };
    expect(m.enHorario).toHaveBeenCalledWith("prof-1", fecha("2026-10-07"), "17:00", "18:00", expect.anything());
    expect(m.profesores).toHaveBeenCalledWith(expect.anything(), candidato, ["prof-1"]);
    expect(m.aula).toHaveBeenCalledWith(expect.anything(), candidato, "aula-1");
    // Con el momento de la operación: solo ocupa una inscripción vigente (PR-0.md §2.2).
    expect(m.alumnos).toHaveBeenCalledWith(expect.anything(), candidato, ["alumno-1", "alumno-2"], expect.any(Date));
  });

  it.each([
    ["profesor fuera de su horario de atención", () => m.enHorario.mockResolvedValue(false), [{ recurso: "PROFESOR", id: "prof-1" }]],
    ["profesor con otro turno", () => m.profesores.mockResolvedValue(new Map([["prof-1", { inicio: 1020, fin: 1080 }]])), [{ recurso: "PROFESOR", id: "prof-1" }]],
    ["aula ocupada", () => m.aula.mockResolvedValue(true), [{ recurso: "AULA", id: "aula-1" }]],
    ["un alumno ocupado", () => m.alumnos.mockResolvedValue(["alumno-2"]), [{ recurso: "ALUMNO", id: "alumno-2" }]],
    ["dos alumnos ocupados", () => m.alumnos.mockResolvedValue(["alumno-1", "alumno-2"]), [{ recurso: "ALUMNO", id: "alumno-1" }, { recurso: "ALUMNO", id: "alumno-2" }]],
    ["todo a la vez (el profesor una sola vez)", () => {
      m.enHorario.mockResolvedValue(false); m.profesores.mockResolvedValue(new Map([["prof-1", { inicio: 1020, fin: 1080 }]]));
      m.aula.mockResolvedValue(true); m.alumnos.mockResolvedValue(["alumno-1", "alumno-2"]);
    }, [{ recurso: "PROFESOR", id: "prof-1" }, { recurso: "AULA", id: "aula-1" }, { recurso: "ALUMNO", id: "alumno-1" }, { recurso: "ALUMNO", id: "alumno-2" }]],
  ])("AC2: %s → REPROGRAMACION_CONFLICTO con todos los recursos, sin escribir ni emitir", async (_caso, preparar, conflictos) => {
    preparar();
    await expect(reprogramarTurno("turno-1", input(), "mesa-1")).rejects.toMatchObject({ code: "REPROGRAMACION_CONFLICTO", detalles: { conflictos } });
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.eventoCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["inexistente", [], "TURNO_NO_ENCONTRADO"],
    ["PENDIENTE", [fila({ estadoTurno: "PENDIENTE" })], "TURNO_PENDIENTE"],
    ["CANCELADO", [fila({ estadoTurno: "CANCELADO" })], "TURNO_CANCELADO"],
    ["vencido", [fila({ fechaTurno: fecha("2026-09-29") })], "TURNO_VENCIDO"],
  ])("rechaza un turno %s sin validar ni escribir", async (_caso, filas, code) => {
    m.queryRaw.mockResolvedValue(filas);
    await expect(reprogramarTurno("turno-1", input(), "mesa-1")).rejects.toMatchObject({ code });
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.eventoCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["fecha pasada", input("2026-09-30", "17:00"), "FECHA_PASADA"],
    ["hoy a una hora ya pasada", input("2026-10-01", "11:00"), "FECHA_PASADA"],
    ["día no operativo (sábado)", input("2026-10-03", "10:00"), "DIA_NO_OPERATIVO"],
    ["hora fuera de la granularidad", input("2026-10-07", "17:15"), "HORA_NO_GRANULAR"],
    ["fuera del horario operativo", input("2026-10-07", "19:30"), "FUERA_DE_HORARIO_OPERATIVO"],
    ["más allá de hoy + 30 días", input("2026-11-02", "10:00"), "ANTICIPACION_EXCEDIDA"],
  ])("valida la nueva fecha y hora: %s", async (_caso, datos, code) => {
    await expect(reprogramarTurno("turno-1", datos, "mesa-1")).rejects.toMatchObject({ code });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("N-4: un turno a 5 meses se puede mover hasta su propia fecha y no más allá", async () => {
    m.queryRaw.mockResolvedValue([fila({ fechaTurno: fecha("2027-03-02") })]);
    await expect(reprogramarTurno("turno-1", input("2027-03-02", "17:00"), "mesa-1")).resolves.toMatchObject({ fecha: "2027-03-02" });
    await expect(reprogramarTurno("turno-1", input("2027-03-03", "17:00"), "mesa-1")).rejects.toMatchObject({ code: "ANTICIPACION_EXCEDIDA" });
  });

  it("exclusión del propio turno: solapamiento parcial con su horario actual es válido", async () => {
    await expect(reprogramarTurno("turno-1", input("2026-10-06", "16:30"), "mesa-1")).resolves.toMatchObject({ fecha: "2026-10-06", hora_inicio: "16:30" });
    expect(m.profesores.mock.calls[0][1]).toMatchObject({ idTurno: "turno-1" });
  });

  it("count 0 → TURNO_MODIFICADO sin evento", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    await expect(reprogramarTurno("turno-1", input(), "mesa-1")).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(m.eventoCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["AULA", "Key (\"tipoRecurso\", \"recursoId\")=(AULA, aula-1, ...) conflicts", { recurso: "AULA", id: "aula-1" }],
    ["PROFESOR", "Key (\"tipoRecurso\", \"recursoId\")=(PROFESOR, prof-1, ...) conflicts", { recurso: "PROFESOR", id: "prof-1" }],
    ["ALUMNO", "Key (\"tipoRecurso\", \"recursoId\")=(ALUMNO, alumno-2, x) conflicts", { recurso: "ALUMNO", id: "alumno-2" }],
  ])("defensa de motor: 23P01 sobre %s → REPROGRAMACION_CONFLICTO sin evento", async (_recurso, detalle, conflicto) => {
    m.updateMany.mockRejectedValue(new Prisma.PrismaClientUnknownRequestError(`23P01 reservas_turno_sin_solapamiento ${detalle}`, { clientVersion: "test" }));
    await expect(reprogramarTurno("turno-1", input(), "mesa-1")).rejects.toMatchObject({ code: "REPROGRAMACION_CONFLICTO", detalles: { conflictos: [conflicto] } });
    expect(m.eventoCreate).not.toHaveBeenCalled();
  });

  it("revalida en el PATCH aunque las opciones hayan ofrecido la hora", async () => {
    const opciones = await opcionesReprogramacion("turno-1", fecha("2026-10-07"));
    expect(opciones.inicios.map((inicio) => inicio.hora_inicio)).toContain("09:00");
    m.aula.mockResolvedValue(true); // otro turno tomó el aula entre la consulta y el guardado
    await expect(reprogramarTurno("turno-1", input("2026-10-07", "09:00"), "mesa-1")).rejects.toMatchObject({ code: "REPROGRAMACION_CONFLICTO" });
  });

  it("propaga un fallo del evento posterior al commit sin simular rollback", async () => {
    m.eventoCreate.mockRejectedValue(new Error("evento no disponible"));
    await expect(reprogramarTurno("turno-1", input(), "mesa-1")).rejects.toThrow("evento no disponible");
    expect(m.updateMany).toHaveBeenCalledOnce();
  });
});

describe("HU-C-06 opcionesReprogramacion", () => {
  it("AC1: la hora actual solo figura como `actual` en su propia fecha; en otra fecha es una opción normal", async () => {
    const misma = await opcionesReprogramacion("turno-1", fecha("2026-10-06"));
    expect(misma).toMatchObject({ fecha: "2026-10-06", duracion_min: 60, tope_fecha: "2026-10-31" });
    expect(misma.inicios).toContainEqual({ hora_inicio: "16:00", hora_fin: "17:00", actual: true });
    expect(misma.inicios.filter((inicio) => inicio.actual)).toHaveLength(1);

    m.horarios.mockResolvedValue([{ horario_id: "h1", dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }]);
    const otra = await opcionesReprogramacion("turno-1", fecha("2026-10-13"));
    expect(otra.inicios).toContainEqual({ hora_inicio: "16:00", hora_fin: "17:00", actual: false });
  });

  it("resta lo ocupado por profesor, aula y alumnos, excluyendo el propio turno", async () => {
    m.turnoFindMany.mockResolvedValue([{ horaInicioTurno: hora("17:00"), duracionMinutosTurno: 60 }]);
    const { inicios } = await opcionesReprogramacion("turno-1", fecha("2026-10-06"));
    expect(inicios.map((inicio) => inicio.hora_inicio)).toEqual(["16:00", "18:00", "18:30", "19:00"]);
    expect(m.turnoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      idTurno: { not: "turno-1" }, fechaTurno: fecha("2026-10-06"), estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] },
      // Solo las inscripciones vigentes ahora ocupan al alumno (PR-0.md §2.2).
      OR: [{ profesorId: "prof-1" }, { aulaId: "aula-1" }, { alumnos: { some: expect.objectContaining({ alumnoId: { in: ["alumno-1", "alumno-2"] }, vigencia: "VIGENTE" }) } }],
    }) }));
  });

  it("hoy solo ofrece inicios posteriores a ahora", async () => {
    m.horarios.mockResolvedValue([{ horario_id: "h3", dia_semana: "JUEVES", hora_inicio: "10:00", hora_fin: "14:00" }]);
    const { inicios } = await opcionesReprogramacion("turno-1", fecha("2026-10-01"));
    expect(inicios.map((inicio) => inicio.hora_inicio)).toEqual(["12:30", "13:00"]);
  });

  it("sin franja del profesor ese día → inicios vacíos (200)", async () => {
    await expect(opcionesReprogramacion("turno-1", fecha("2026-10-08"))).resolves.toMatchObject({ inicios: [] });
  });

  it.each([
    ["día no operativo", "2026-10-03", "DIA_NO_OPERATIVO"],
    ["fecha pasada", "2026-09-30", "FECHA_PASADA"],
    ["más allá del tope", "2026-11-02", "ANTICIPACION_EXCEDIDA"],
  ])("valida el día: %s", async (_caso, valor, code) => {
    await expect(opcionesReprogramacion("turno-1", fecha(valor))).rejects.toMatchObject({ code });
  });

  it.each([
    ["inexistente", null, "TURNO_NO_ENCONTRADO"],
    ["PENDIENTE", fila({ estadoTurno: "PENDIENTE" }), "TURNO_PENDIENTE"],
    ["CANCELADO", fila({ estadoTurno: "CANCELADO" }), "TURNO_CANCELADO"],
    ["vencido", fila({ fechaTurno: fecha("2026-09-29") }), "TURNO_VENCIDO"],
  ])("rechaza un turno %s", async (_caso, turno, code) => {
    m.findUnique.mockResolvedValue(turno);
    await expect(opcionesReprogramacion("turno-1", fecha("2026-10-07"))).rejects.toMatchObject({ code });
  });

  it("no escribe nada", async () => {
    await opcionesReprogramacion("turno-1", fecha("2026-10-06"));
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.eventoCreate).not.toHaveBeenCalled();
  });
});
