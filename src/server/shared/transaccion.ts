import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

/**
 * Transacción interactiva con los tiempos de PR-0.md §2.10: espera para
 * obtener conexión, duración máxima, aislamiento READ COMMITTED y, al empezar,
 * `SET LOCAL lock_timeout` y `SET LOCAL statement_timeout` (el timeout de
 * Prisma no corta por sí solo una espera de `FOR UPDATE` en el servidor).
 */
export const TIEMPOS_TRANSACCION = {
  maxWaitMs: 2000,
  timeoutMs: 8000,
  lockTimeoutMs: 5000,
  statementTimeoutMs: 7000,
} as const;

export type Tx = Prisma.TransactionClient;
export type TareaPosterior = () => unknown;

export type ContextoTransaccion = {
  /** Encola `tarea` para después del COMMIT. Si la transacción revierte, se descarta. */
  despuesDelCommit(tarea: TareaPosterior): void;
};

export type OpcionesTransaccion = {
  /** Cliente a usar (por defecto el de la app). Lo usan el seed y las pruebas. */
  db?: PrismaClient;
  /** Solo para pruebas: tiempos más cortos para provocar la espera de un bloqueo. */
  tiempos?: Partial<typeof TIEMPOS_TRANSACCION>;
};

const colas = new WeakMap<object, TareaPosterior[]>();

/**
 * `despuesDelCommit` para los servicios, que reciben solo el `tx` del llamador
 * (PR-0.md §2.13). Falla si el `tx` no lo abrió `transaccion()`: sin esa cola
 * el historial se perdería en silencio.
 */
export function despuesDelCommit(tx: Tx, tarea: TareaPosterior): void {
  const cola = colas.get(tx);
  if (!cola) throw new Error("despuesDelCommit: la transacción no se abrió con transaccion()");
  cola.push(tarea);
}

/** `true` si `tx` lo abrió `transaccion()` (y por lo tanto admite `despuesDelCommit`). */
export function tieneColaPosterior(tx: Tx): boolean {
  return colas.has(tx);
}

const CODIGOS_POSTGRES_OCUPADA = ["55P03", "40P01"];

/**
 * Errores que significan «otra operación tiene los datos tomados»: P2028
 * (timeout de la API de transacciones de Prisma), P2034 (conflicto de
 * escritura o interbloqueo), 55P03 (lock_timeout) y 40P01 (interbloqueo).
 */
export function esErrorDeConcurrencia(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2028" || error.code === "P2034") return true;
    const codigoPg = (error.meta as { code?: unknown } | undefined)?.code;
    if (typeof codigoPg === "string" && CODIGOS_POSTGRES_OCUPADA.includes(codigoPg)) return true;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return /\b(55P03|40P01)\b|lock timeout|deadlock detected/i.test(error.message);
  }
  return false;
}

async function vaciarCola(cola: TareaPosterior[]): Promise<void> {
  for (const tarea of cola) {
    try {
      await tarea();
    } catch (error) {
      // La operación ya confirmó: un fallo acá no la deshace. Las tareas de
      // historial reintentan por su cuenta (registrarHistorial); esto es el
      // último resguardo para que el error quede registrado.
      console.error("[transaccion] falló una tarea posterior al commit", error);
    }
  }
}

/**
 * Corre `fn` en una transacción y, recién después del COMMIT, las tareas
 * encoladas con `ctx.despuesDelCommit` (o `despuesDelCommit(tx, …)`), en orden.
 * Resuelve después de vaciar la cola. Si la transacción revierte, la cola se
 * descarta. Los errores de concurrencia se traducen a
 * `ErrorDeDominio("errores.transaccion.ocupada")` (409 TRANSACCION_OCUPADA).
 */
export async function transaccion<T>(
  fn: (tx: Tx, ctx: ContextoTransaccion) => Promise<T>,
  opciones: OpcionesTransaccion = {},
): Promise<T> {
  const db = opciones.db ?? prisma;
  const tiempos = { ...TIEMPOS_TRANSACCION, ...opciones.tiempos };
  const cola: TareaPosterior[] = [];
  const ctx: ContextoTransaccion = { despuesDelCommit: (tarea) => cola.push(tarea) };

  let resultado: T;
  try {
    resultado = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${Math.trunc(tiempos.lockTimeoutMs)}ms'`);
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${Math.trunc(tiempos.statementTimeoutMs)}ms'`);
        colas.set(tx, cola);
        return fn(tx, ctx);
      },
      {
        maxWait: tiempos.maxWaitMs,
        timeout: tiempos.timeoutMs,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  } catch (error) {
    if (esErrorDeConcurrencia(error)) throw new ErrorDeDominio("errores.transaccion.ocupada");
    throw error;
  }
  await vaciarCola(cola);
  return resultado;
}
