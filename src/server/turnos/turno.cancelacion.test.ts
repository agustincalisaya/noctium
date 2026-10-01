import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, queryRaw, updateMany, turnoAlumnoFindMany, eventoCreate, prohibidos } = vi.hoisted(() => ({
  transaction: vi.fn(), queryRaw: vi.fn(), updateMany: vi.fn(), turnoAlumnoFindMany: vi.fn(), eventoCreate: vi.fn(),
  prohibidos: { reservaDelete: vi.fn(), turnoAlumnoDelete: vi.fn(), pagoAny: vi.fn(), turnoDelete: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: transaction,
  eventoTurno: { create: eventoCreate },
} }));

const { cancelarTurno } = await import("@/server/turnos/turno.cancelacion.service");

const FUTURO = { fechaTurno: new Date("2030-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") };
const PASADO = { fechaTurno: new Date("2020-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z") };
const fila = (estadoTurno: string, horario = FUTURO) => ({ idTurno: "turno-1", estadoTurno, ...horario, profesorId: "prof-1", aulaId: "aula-1" });

// Cliente transaccional mínimo: cualquier acceso a borrados o a pagos queda registrado.
const tx = () => ({
  $queryRaw: queryRaw,
  turno: { updateMany, delete: prohibidos.turnoDelete, deleteMany: prohibidos.turnoDelete },
  turnoAlumno: { findMany: turnoAlumnoFindMany, delete: prohibidos.turnoAlumnoDelete, deleteMany: prohibidos.turnoAlumnoDelete },
  reservaTurno: { delete: prohibidos.reservaDelete, deleteMany: prohibidos.reservaDelete },
  pago: { update: prohibidos.pagoAny, updateMany: prohibidos.pagoAny, delete: prohibidos.pagoAny, deleteMany: prohibidos.pagoAny },
});

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([fila("DISPONIBLE")]);
  turnoAlumnoFindMany.mockResolvedValue([{ alumnoId: "alumno-1" }, { alumnoId: "alumno-2" }]);
  updateMany.mockResolvedValue({ count: 1 });
  eventoCreate.mockResolvedValue({});
  transaction.mockImplementation(async (callback: (cliente: unknown) => Promise<unknown>) => callback(tx()));
});

describe("HU-C-05 cancelarTurno", () => {
  it("cancela un DISPONIBLE vigente: solo estado y auditoría, y emite el evento después del commit", async () => {
    let comprometida = false;
    transaction.mockImplementation(async (callback: (cliente: unknown) => Promise<unknown>) => {
      const result = await callback(tx());
      comprometida = true;
      return result;
    });
    eventoCreate.mockImplementation(async () => { expect(comprometida).toBe(true); return {}; });

    await expect(cancelarTurno("turno-1", "mesa-1")).resolves.toEqual({ id: "turno-1", estado: "CANCELADO" });
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { idTurno: "turno-1", estadoTurno: { in: ["PENDIENTE", "DISPONIBLE", "COMPLETO"] } },
      data: { estadoTurno: "CANCELADO", modificadoPorUsuarioId: "mesa-1" },
    });
    expect(eventoCreate).toHaveBeenCalledExactlyOnceWith({ data: {
      tipoEvento: "turno:cancelado", turnoId: "turno-1", usuarioId: "mesa-1",
      payloadEvento: {
        turno_id: "turno-1", estado_anterior: "DISPONIBLE", profesor_id: "prof-1", aula_id: "aula-1",
        alumno_ids: ["alumno-1", "alumno-2"], usuario_id: "mesa-1",
      },
    } });
  });

  it("no borra reservas, inscripciones, pagos ni el turno: la liberación es del trigger", async () => {
    await cancelarTurno("turno-1", "mesa-1");
    for (const borrado of Object.values(prohibidos)) expect(borrado).not.toHaveBeenCalled();
  });

  it("cancela un COMPLETO vigente", async () => {
    queryRaw.mockResolvedValue([fila("COMPLETO")]);
    await expect(cancelarTurno("turno-1", "mesa-1")).resolves.toEqual({ id: "turno-1", estado: "CANCELADO" });
    expect(eventoCreate.mock.calls[0][0].data.payloadEvento.estado_anterior).toBe("COMPLETO");
  });

  it.each([["vigente", FUTURO], ["vencido", PASADO]])("descarta un PENDIENTE %s (N-1)", async (_nombre, horario) => {
    queryRaw.mockResolvedValue([{ ...fila("PENDIENTE", horario), aulaId: null }]);
    turnoAlumnoFindMany.mockResolvedValue([]);
    await expect(cancelarTurno("turno-1", "mesa-1")).resolves.toEqual({ id: "turno-1", estado: "CANCELADO" });
    expect(eventoCreate.mock.calls[0][0].data.payloadEvento).toMatchObject({ estado_anterior: "PENDIENTE", aula_id: null, alumno_ids: [] });
  });

  it.each([
    ["inexistente", [], "TURNO_NO_ENCONTRADO"],
    ["ya cancelado", [fila("CANCELADO")], "TURNO_CANCELADO"],
    ["DISPONIBLE vencido", [fila("DISPONIBLE", PASADO)], "TURNO_VENCIDO"],
    ["COMPLETO vencido", [fila("COMPLETO", PASADO)], "TURNO_VENCIDO"],
  ])("rechaza turno %s sin escribir ni emitir", async (_nombre, filas, code) => {
    queryRaw.mockResolvedValue(filas);
    await expect(cancelarTurno("turno-1", "mesa-1")).rejects.toMatchObject({ code });
    expect(updateMany).not.toHaveBeenCalled();
    expect(eventoCreate).not.toHaveBeenCalled();
  });

  it("count 0 en la escritura condicional responde TURNO_MODIFICADO sin evento", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(cancelarTurno("turno-1", "mesa-1")).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(eventoCreate).not.toHaveBeenCalled();
  });

  it("propaga un fallo del evento posterior al commit sin simular rollback", async () => {
    eventoCreate.mockRejectedValue(new Error("evento no disponible"));
    await expect(cancelarTurno("turno-1", "mesa-1")).rejects.toThrow("evento no disponible");
    expect(transaction).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledOnce();
  });
});
