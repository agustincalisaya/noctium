import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-C-26 quitarReservaPendiente (spec_modulo_C.md §2.20.4) con mocks: el
// orden de las llamadas al PR 0 y la propagación de sus errores. La condición
// atómica real se prueba en reserva.pendiente.service.pg.test.ts.

const m = vi.hoisted(() => ({
  orden: [] as string[],
  transaccion: vi.fn(),
  bloquear: vi.fn(),
  marcarVencidas: vi.fn(),
  finalizarInscripcion: vi.fn(),
  inscripcionesVigentes: vi.fn(),
  emitirEventoTurno: vi.fn(),
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: m.transaccion }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: m.bloquear }));
vi.mock("@/server/turnos/inscripcion.service", () => ({ marcarVencidas: m.marcarVencidas, finalizarInscripcion: m.finalizarInscripcion }));
vi.mock("@/server/turnos/inscripcion.vigencia", () => ({ inscripcionesVigentes: m.inscripcionesVigentes }));
vi.mock("@/server/turnos/turno.service", () => ({ emitirEventoTurno: m.emitirEventoTurno }));

const { quitarReservaPendiente } = await import("./reserva.pendiente.service");

const tx = { turnoAlumno: { findUnique: m.findUnique }, turno: { findUniqueOrThrow: m.findUniqueOrThrow } };
const registrar = (nombre: string, valor?: unknown) => async () => { m.orden.push(nombre); return valor; };

beforeEach(() => {
  vi.clearAllMocks();
  m.orden.length = 0;
  m.transaccion.mockImplementation(async (callback) => { const r = await callback(tx); m.orden.push("commit"); return r; });
  m.findUnique.mockResolvedValue({ turnoId: "clase-1", alumnoId: "alu-1", turno: { cupoMaximoTurno: 5 } });
  m.bloquear.mockImplementation(registrar("bloquear"));
  m.marcarVencidas.mockImplementation(registrar("marcarVencidas", 0));
  m.finalizarInscripcion.mockImplementation(registrar("finalizarInscripcion", {
    inscripcionId: "ins-1", turnoId: "clase-1", alumnoId: "alu-1", vigencia: "QUITADA_CENTRO", estadoPago: "RESERVADA",
    estadoTurno: { anterior: "COMPLETO", nuevo: "DISPONIBLE", cambio: true },
  }));
  m.inscripcionesVigentes.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
  m.emitirEventoTurno.mockImplementation(async (tipo: string) => { m.orden.push(tipo); });
});

describe("HU-C-26 quitarReservaPendiente", () => {
  it("bloquea clase e inscripción, marca vencidas antes de finalizar y emite los eventos después del commit", async () => {
    await expect(quitarReservaPendiente("ins-1", "mesa-1")).resolves.toEqual({
      inscripcion_id: "ins-1", vigencia: "QUITADA_CENTRO", alumnos_inscriptos: "4/5", estado: "DISPONIBLE",
    });
    expect(m.orden).toEqual(["bloquear", "marcarVencidas", "finalizarInscripcion", "commit", "turno:alumno_quitado", "turno:disponible_nuevamente"]);
    expect(m.bloquear).toHaveBeenCalledWith(tx, { clases: ["clase-1"], inscripciones: ["ins-1"] });
    expect(m.marcarVencidas).toHaveBeenCalledWith(tx, "clase-1");
    expect(m.finalizarInscripcion).toHaveBeenCalledWith(tx, {
      inscripcionId: "ins-1", vigencia: "QUITADA_CENTRO", actor: expect.objectContaining({ usuarioId: "mesa-1" }), soloSiReservaPendiente: true,
    });
    // Payload ampliado de la Revisión 6 (spec §4).
    expect(m.emitirEventoTurno).toHaveBeenCalledWith("turno:alumno_quitado", "clase-1", "mesa-1",
      { turno_id: "clase-1", alumno_id: "alu-1", inscripcion_id: "ins-1", usuario_id: "mesa-1" });
  });

  it("sin cambio de estado de la clase no emite turno:disponible_nuevamente y relee el estado", async () => {
    m.finalizarInscripcion.mockResolvedValue({ inscripcionId: "ins-1", turnoId: "clase-1", alumnoId: "alu-1", vigencia: "QUITADA_CENTRO", estadoPago: "RESERVADA", estadoTurno: null });
    m.findUniqueOrThrow.mockResolvedValue({ estadoTurno: "DISPONIBLE" });
    await expect(quitarReservaPendiente("ins-1", "mesa-1")).resolves.toMatchObject({ estado: "DISPONIBLE" });
    expect(m.emitirEventoTurno.mock.calls.map(([tipo]) => tipo)).toEqual(["turno:alumno_quitado"]);
  });

  it("inscripción inexistente: INSCRIPCION_NO_ENCONTRADA sin bloquear ni tocar nada", async () => {
    m.findUnique.mockResolvedValue(null);
    await expect(quitarReservaPendiente("no-existe", "mesa-1")).rejects.toMatchObject({ code: "INSCRIPCION_NO_ENCONTRADA", status: 404 });
    expect(m.bloquear).not.toHaveBeenCalled();
    expect(m.marcarVencidas).not.toHaveBeenCalled();
    expect(m.finalizarInscripcion).not.toHaveBeenCalled();
    expect(m.emitirEventoTurno).not.toHaveBeenCalled();
  });

  it("propaga RESERVA_NO_PENDIENTE tal cual, sin reintentar ni emitir eventos", async () => {
    const rechazo = new ErrorDeDominio("errores.reserva.noPendiente");
    m.finalizarInscripcion.mockRejectedValue(rechazo);
    await expect(quitarReservaPendiente("ins-1", "mesa-1")).rejects.toBe(rechazo);
    expect(m.finalizarInscripcion).toHaveBeenCalledOnce();
    expect(m.emitirEventoTurno).not.toHaveBeenCalled();
  });
});
