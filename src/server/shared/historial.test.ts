import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  PROCESO_AUTOMATICO,
  actorUsuario,
  columnasActor,
  encolarHistorial,
  prepararHistorial,
  registrarHistorial,
} from "@/server/shared/historial";
import { transaccion, type Tx } from "@/server/shared/transaccion";

function escritorFalso(fallas = 0) {
  let restantes = fallas;
  const llamada = vi.fn(async () => {
    if (restantes > 0) { restantes -= 1; throw new Error("base caída"); }
    return { count: 1 };
  });
  const db = {
    historialInscripcion: { createMany: llamada },
    historialEstado: { createMany: llamada },
    eventoTurno: { createMany: llamada },
    eventoSeguridad: { createMany: llamada },
  };
  return { db: db as unknown as PrismaClient, llamada };
}

const fecha = new Date("2030-05-10T12:00:00.000Z");
const transicion = prepararHistorial({
  tipo: "INSCRIPCION", inscripcionId: "ins-1",
  vigenciaAnterior: "VIGENTE", vigenciaNueva: "RESERVA_VENCIDA",
  estadoPagoAnterior: "RESERVADA", estadoPagoNuevo: "RESERVADA",
  actor: PROCESO_AUTOMATICO, fecha,
});

describe("historial único (PR-0.md §2.16)", () => {
  it("el actor se guarda como actorTipo + usuario, coherente con el CHECK", () => {
    expect(columnasActor(actorUsuario("u1"))).toEqual({ actorTipo: "USUARIO", usuarioId: "u1" });
    expect(columnasActor(PROCESO_AUTOMATICO)).toEqual({ actorTipo: "PROCESO_AUTOMATICO", usuarioId: null });
  });

  it("escribe con el id generado antes y skipDuplicates (idempotente)", async () => {
    const { db, llamada } = escritorFalso();
    await expect(registrarHistorial(transicion, { db })).resolves.toBe(true);
    await registrarHistorial(transicion, { db });
    expect(llamada).toHaveBeenCalledTimes(2);
    for (const [argumentos] of llamada.mock.calls as unknown as [{ data: { idHistorialInscripcion: string }[]; skipDuplicates: boolean }][]) {
      expect(argumentos.skipDuplicates).toBe(true);
      expect(argumentos.data[0]!.idHistorialInscripcion).toBe(transicion.id);
    }
    expect(llamada.mock.calls[0]).toEqual([{
      data: [{
        idHistorialInscripcion: transicion.id, inscripcionId: "ins-1",
        vigenciaAnterior: "VIGENTE", vigenciaNueva: "RESERVA_VENCIDA",
        estadoPagoAnterior: "RESERVADA", estadoPagoNuevo: "RESERVADA",
        actorTipo: "PROCESO_AUTOMATICO", usuarioId: null, fecha,
      }],
      skipDuplicates: true,
    }]);
  });

  it("reintenta hasta 3 veces y se recupera", async () => {
    const { db, llamada } = escritorFalso(3);
    await expect(registrarHistorial(transicion, { db, esperaMs: 0 })).resolves.toBe(true);
    expect(llamada).toHaveBeenCalledTimes(4);
  });

  it("después de 3 reintentos se rinde, registra el error y no lanza", async () => {
    const { db, llamada } = escritorFalso(10);
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(registrarHistorial(transicion, { db, esperaMs: 0 })).resolves.toBe(false);
    expect(llamada).toHaveBeenCalledTimes(4);
    expect(consola).toHaveBeenCalledWith("[historial] no se pudo registrar", expect.objectContaining({ tipo: "INSCRIPCION", id: transicion.id, intentos: 4 }));
    consola.mockRestore();
  });

  it("escribe bajas y reactivaciones, eventos de turno y de seguridad con el mismo mecanismo", async () => {
    const { db, llamada } = escritorFalso();
    await registrarHistorial(prepararHistorial({
      tipo: "ESTADO", entidad: "PROFESOR", entidadId: "p1", accion: "DESACTIVAR", motivo: "Licencia", actor: actorUsuario("g1"), fecha,
    }), { db });
    await registrarHistorial(prepararHistorial({
      tipo: "EVENTO_TURNO", tipoEvento: "turno:alumno_agregado", turnoId: "t1", usuarioId: "u1", payload: { alumno_id: "a1" },
    }), { db });
    await registrarHistorial(prepararHistorial({
      tipo: "EVENTO_SEGURIDAD", tipoEvento: "CUENTA_CREADA", usuarioId: "u2", email: "x@y.z", ip: "127.0.0.1",
    }), { db });
    const datos = llamada.mock.calls.map(([argumentos]) => (argumentos as unknown as { data: Record<string, unknown>[] }).data[0]);
    expect(datos[0]).toMatchObject({ entidad: "PROFESOR", accion: "DESACTIVAR", motivo: "Licencia", actorTipo: "USUARIO", usuarioId: "g1" });
    expect(datos[1]).toMatchObject({ tipoEvento: "turno:alumno_agregado", turnoId: "t1", payloadEvento: { alumno_id: "a1" } });
    expect(datos[2]).toMatchObject({ tipoEvento: "CUENTA_CREADA", usuarioId: "u2", emailEvento: "x@y.z", ipEvento: "127.0.0.1" });
  });

  it("encolarHistorial fija el id antes del commit y escribe recién después", async () => {
    const { db: escritor, llamada } = escritorFalso();
    const tx = { $executeRawUnsafe: vi.fn(async () => 0) };
    const db = { $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)) } as unknown as PrismaClient;
    let idAntesDelCommit = "";
    await transaccion(async (t) => {
      const registro = encolarHistorial(t, {
        tipo: "ESTADO", entidad: "ALUMNO", entidadId: "a1", accion: "REACTIVAR", actor: actorUsuario("m1"), fecha,
      }, { db: escritor });
      idAntesDelCommit = registro.id;
      expect(llamada).not.toHaveBeenCalled();
    }, { db });
    expect(idAntesDelCommit).toMatch(/^[0-9a-f-]{36}$/);
    expect((llamada.mock.calls[0]![0] as unknown as { data: { idHistorialEstado: string }[] }).data[0]!.idHistorialEstado).toBe(idAntesDelCommit);
  });

  it("encolarHistorial fuera de transaccion() falla en vez de perder el registro", () => {
    expect(() => encolarHistorial({} as Tx, {
      tipo: "ESTADO", entidad: "ALUMNO", entidadId: "a1", accion: "REACTIVAR", actor: PROCESO_AUTOMATICO, fecha,
    })).toThrow(/transaccion\(\)/);
  });
});
