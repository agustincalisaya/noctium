// Punto de extensión de fixtures (PR-0.md §2.16).
//
// `prisma/seed.ts` llama a `correrFixtures` al final, después del seed base y
// de abrir las cajas de prueba. Cada HU que necesita datos de presentación
// agrega SU PROPIO archivo en esta carpeta (por ejemplo, `hu-h-06.ts`, que
// exporta una función `(contexto) => Promise<void>`) y UNA línea en la lista
// de abajo, en el orden en que tiene que correr. No edita `seed.ts` ni los
// archivos de otras HU, así varias ramas no chocan en el mismo archivo.
//
// Cada fixture usa los servicios de dominio (nunca escribe directo en
// inscripciones, pagos, comprobantes ni cajas), busca sus datos por id o
// clave estable antes de crearlos (correr el seed dos veces no cambia nada) y
// anota en su PR qué agrega.
import { fixtureHuH07 } from "./hu-h-07";
import type { PrismaClient } from "@prisma/client";

/** Lo que recibe cada fixture. */
export type ContextoFixtures = { prisma: PrismaClient };

type Fixture = { nombre: string; correr: (contexto: ContextoFixtures) => Promise<void> };

/** Fixtures en orden de ejecución: una línea por HU. */
const FIXTURES: Fixture[] = [{ nombre: "HU-H-07", correr: fixtureHuH07 }];

export async function correrFixtures(contexto: ContextoFixtures): Promise<void> {
  for (const fixture of FIXTURES) {
    await fixture.correr(contexto);
    console.log(`✓ Fixture ${fixture.nombre}`);
  }
}
