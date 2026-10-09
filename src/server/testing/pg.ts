import { PrismaClient } from "@prisma/client";

/**
 * Pruebas con PostgreSQL real (PR-0.md §2.12 y §2.16). Corren solo contra una
 * base descartable con las migraciones aplicadas: `HU_PR0_TEST_DATABASE_URL`
 * tiene que estar definida y ser igual a `DATABASE_URL` (así el cliente de la
 * app, que lee `DATABASE_URL`, apunta a la misma base). Si no, se saltean.
 *
 * `npm run test:pg` crea la base, aplica las migraciones, corre los
 * `*.pg.test.ts` sin paralelismo entre archivos, con TZ=UTC, y la borra.
 */
const URL_BASE_DESCARTABLE = process.env.HU_PR0_TEST_DATABASE_URL;

export const basePgHabilitada = Boolean(URL_BASE_DESCARTABLE && process.env.DATABASE_URL === URL_BASE_DESCARTABLE);

/** Cliente propio de una prueba (con `$disconnect` en su `afterAll`). */
export function clientePg(opciones?: ConstructorParameters<typeof PrismaClient>[0]): PrismaClient {
  if (!basePgHabilitada) throw new Error("clientePg: no hay una base descartable habilitada (HU_PR0_TEST_DATABASE_URL)");
  return new PrismaClient(opciones);
}
