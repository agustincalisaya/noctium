import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import {
  TIEMPOS_TRANSACCION,
  despuesDelCommit,
  esErrorDeConcurrencia,
  tieneColaPosterior,
  transaccion,
  type Tx,
} from "@/server/shared/transaccion";

/** Cliente falso: `$transaction` corre el callback y, si se pide, falla después (como un COMMIT fallido). */
function dbFalso(opciones: { fallarAlConfirmar?: unknown } = {}) {
  const tx = { $executeRawUnsafe: vi.fn(async () => 0) };
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const resultado = await fn(tx);
    if (opciones.fallarAlConfirmar) throw opciones.fallarAlConfirmar;
    return resultado;
  });
  return { db: { $transaction } as unknown as PrismaClient, tx, $transaction };
}

const conocido = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(`error ${code}`, { code, clientVersion: "test", meta });

describe("transaccion() (PR-0.md §2.10 y §2.16)", () => {
  it("usa los tiempos de 2.10, READ COMMITTED y fija lock_timeout y statement_timeout al empezar", async () => {
    const { db, tx, $transaction } = dbFalso();
    await transaccion(async () => "ok", { db });
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 2000, timeout: 8000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
    expect(tx.$executeRawUnsafe.mock.calls.map(([sql]) => sql)).toEqual([
      "SET LOCAL lock_timeout = '5000ms'",
      "SET LOCAL statement_timeout = '7000ms'",
    ]);
    expect(TIEMPOS_TRANSACCION).toEqual({ maxWaitMs: 2000, timeoutMs: 8000, lockTimeoutMs: 5000, statementTimeoutMs: 7000 });
  });

  it("corre la cola después del commit, en orden, y resuelve recién después de vaciarla", async () => {
    const { db } = dbFalso();
    const orden: string[] = [];
    const resultado = await transaccion(async (tx, ctx) => {
      ctx.despuesDelCommit(async () => { await new Promise((r) => setTimeout(r, 5)); orden.push("historial 1"); });
      despuesDelCommit(tx, () => { orden.push("historial 2"); });
      orden.push("negocio");
      return 42;
    }, { db });
    orden.push("resuelto");
    expect(resultado).toBe(42);
    expect(orden).toEqual(["negocio", "historial 1", "historial 2", "resuelto"]);
  });

  it("si la transacción revierte, descarta la cola", async () => {
    const { db } = dbFalso();
    const tarea = vi.fn();
    await expect(transaccion(async (_tx, ctx) => {
      ctx.despuesDelCommit(tarea);
      throw new Error("falla de negocio");
    }, { db })).rejects.toThrow("falla de negocio");
    expect(tarea).not.toHaveBeenCalled();
  });

  it("si el COMMIT falla, tampoco corre la cola", async () => {
    const { db } = dbFalso({ fallarAlConfirmar: conocido("P2028") });
    const tarea = vi.fn();
    await expect(transaccion(async (_tx, ctx) => { ctx.despuesDelCommit(tarea); }, { db })).rejects.toBeInstanceOf(ErrorDeDominio);
    expect(tarea).not.toHaveBeenCalled();
  });

  it("una tarea posterior que falla no deshace ni hace fallar la operación: se registra", async () => {
    const { db } = dbFalso();
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const siguiente = vi.fn();
    await expect(transaccion(async (_tx, ctx) => {
      ctx.despuesDelCommit(() => { throw new Error("historial caído"); });
      ctx.despuesDelCommit(siguiente);
      return "ok";
    }, { db })).resolves.toBe("ok");
    expect(siguiente).toHaveBeenCalled();
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it.each([
    ["P2028 (timeout de transacción)", conocido("P2028")],
    ["P2034 (conflicto de escritura o interbloqueo)", conocido("P2034")],
    ["55P03 (lock_timeout) en meta", conocido("P2010", { code: "55P03" })],
    ["40P01 (interbloqueo) en meta", conocido("P2010", { code: "40P01" })],
    ["55P03 en el mensaje", new Prisma.PrismaClientUnknownRequestError("ERROR: canceling statement due to lock timeout (55P03)", { clientVersion: "test" })],
    ["40P01 en el mensaje", new Prisma.PrismaClientUnknownRequestError("deadlock detected", { clientVersion: "test" })],
  ])("traduce %s a 409 TRANSACCION_OCUPADA", async (_nombre, error) => {
    const { db } = dbFalso();
    const promesa = transaccion(async () => { throw error; }, { db });
    await expect(promesa).rejects.toMatchObject({
      codigo: "errores.transaccion.ocupada", code: "TRANSACCION_OCUPADA", status: 409,
      message: "Otra persona está modificando estos datos. Intentá de nuevo.",
    });
  });

  it("deja pasar los demás errores tal cual (incluido un ErrorDeDominio)", async () => {
    const { db } = dbFalso();
    const unico = conocido("P2002");
    await expect(transaccion(async () => { throw unico; }, { db })).rejects.toBe(unico);
    const dominio = new ErrorDeDominio("errores.caja.sinCajaAbierta");
    await expect(transaccion(async () => { throw dominio; }, { db })).rejects.toBe(dominio);
    expect(esErrorDeConcurrencia(new Error("lock timeout"))).toBe(false);
  });

  it("despuesDelCommit(tx) falla si el tx no lo abrió transaccion()", () => {
    const suelto = {} as Tx;
    expect(tieneColaPosterior(suelto)).toBe(false);
    expect(() => despuesDelCommit(suelto, () => {})).toThrow(/transaccion\(\)/);
  });

  it("admite tiempos más cortos para las pruebas", async () => {
    const { db, tx } = dbFalso();
    await transaccion(async () => {}, { db, tiempos: { lockTimeoutMs: 300 } });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL lock_timeout = '300ms'");
  });
});
