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
import { fixtureHuE09 } from "./hu-e-09";
import { fixtureHuE07 } from "./hu-e-07";
import { fixtureHuE04 } from "./hu-e-04";
import { fixtureHuE10 } from "./hu-e-10";
import { fixtureHuH06 } from "./hu-h-06";
import { fixtureHuH07 } from "./hu-h-07";
import type { PrismaClient } from "@prisma/client";

/** Lo que recibe cada fixture. */
export type ContextoFixtures = { prisma: PrismaClient };

type Fixture = { nombre: string; correr: (contexto: ContextoFixtures) => Promise<void> };

/** Fixtures en orden de ejecución: una línea por HU. */
const FIXTURES: Fixture[] = [{ nombre: "HU-E-09", correr: fixtureHuE09 }, { nombre: "HU-E-07", correr: fixtureHuE07 }, { nombre: "HU-E-04", correr: fixtureHuE04 }, { nombre: "HU-E-10", correr: fixtureHuE10 }, { nombre: "hu-h-06", correr: fixtureHuH06 }, { nombre: "HU-H-07", correr: fixtureHuH07 }];

export async function correrFixtures(contexto: ContextoFixtures): Promise<void> {
  for (const fixture of FIXTURES) {
    await fixture.correr(contexto);
    console.log(`✓ Fixture ${fixture.nombre}`);
  }
}
