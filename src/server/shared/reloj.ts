import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Reloj único del dominio (PR-0.md §2.2 y §2.16). Toda fecha de dominio
 * (reservadaEl, registradaEl, emitidoEl, abiertaEl…) se toma con `ahora()`,
 * nunca con `new Date()` suelto ni con `now()` de SQL.
 *
 * En pruebas, seed y fixtures el momento se inyecta por contexto con
 * `conReloj(momento, fn)`: vale para todo lo que corre dentro de `fn`, incluso
 * lo asincrónico, sin afectar otras ejecuciones concurrentes. En producción
 * (`NODE_ENV=production`) no se puede cambiar.
 */
type FuenteDeTiempo = () => Date;

const contexto = new AsyncLocalStorage<FuenteDeTiempo>();

export class RelojNoModificableError extends Error {
  constructor() {
    super("El reloj del dominio no se puede cambiar en producción");
    this.name = "RelojNoModificableError";
  }
}

/** Instante actual (UTC) según el reloj vigente en este contexto. */
export function ahora(): Date {
  const fuente = contexto.getStore();
  return fuente ? new Date(fuente().getTime()) : new Date();
}

/**
 * Corre `fn` con el reloj fijado en `momento` (un instante fijo, o una función
 * que lo da en cada llamada, por ejemplo para que avance). Se puede anidar: el
 * más interno manda.
 */
export function conReloj<T>(momento: Date | FuenteDeTiempo, fn: () => T): T {
  if (process.env.NODE_ENV === "production") throw new RelojNoModificableError();
  const fuente: FuenteDeTiempo = typeof momento === "function" ? momento : () => momento;
  return contexto.run(fuente, fn);
}
