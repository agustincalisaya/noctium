import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regla N.° 3: los contratos públicos no importan nada de otros módulos.
const SRC = fileURLToPath(new URL("..", import.meta.url));

type Importacion = { especificador: string; soloTipo: boolean };

function importaciones(ruta: string): Importacion[] {
  const codigo = readFileSync(`${SRC}${ruta}`, "utf8");
  const encontradas: Importacion[] = [];
  const estaticas = /^\s*(import|export)\s+(type\s+)?([^"';]*?)\s*from\s*["']([^"']+)["']/gm;
  for (const [, , tipo, , especificador] of codigo.matchAll(estaticas)) {
    encontradas.push({ especificador: especificador!, soloTipo: Boolean(tipo) });
  }
  for (const [, especificador] of codigo.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    encontradas.push({ especificador: especificador!, soloTipo: false });
  }
  for (const [, especificador] of codigo.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']/g)) {
    encontradas.push({ especificador: especificador!, soloTipo: false });
  }
  return encontradas;
}

// Se rechazan imports hacia servicios de otros módulos; de "@/server/" solo se permite
// el service propio (ruta exacta) y "@/server/shared/*". La Regla N.° 11 exige alias
// para tipos, actions y services; el helper local "./turno.validaciones" está permitido.
const PUBLICOS = [
  {
    ruta: "server/alumnos/alumno.publico.ts",
    permitidos: [
      "@prisma/client", "@/lib/prisma", "@/types/alumno.types",
      "@/server/alumnos/alumno.service",
    ],
  },
  {
    ruta: "server/profesores/profesor.publico.ts",
    permitidos: [
      "@prisma/client", "@/lib/prisma", "@/types/profesor.types",
      "@/lib/profesor-listado", "@/lib/horario-atencion",
      "@/server/profesores/profesor.service",
    ],
  },
  {
    ruta: "server/pagos/forma-pago.publico.ts",
    permitidos: ["@prisma/client", "@/lib/prisma"],
  },
  {
    ruta: "server/turnos/turno.publico.ts",
    permitidos: ["@prisma/client", "@/lib/prisma", "./turno.validaciones"],
  },
  {
    ruta: "server/pagos/pago.publico.ts",
    permitidos: ["@prisma/client", "@/lib/prisma", "@/server/alumnos/alumno.publico"],
  },
  // PR 0 (Sprint 3): fachadas nuevas.
  {
    ruta: "server/turnos/inscripcion.publico.ts",
    permitidos: ["@/server/turnos/inscripcion.service", "@/server/turnos/inscripcion.vigencia"],
  },
  {
    ruta: "server/pagos/caja.publico.ts",
    permitidos: ["@/server/pagos/caja.service"],
  },
  {
    ruta: "server/personal/personal.publico.ts",
    permitidos: ["@prisma/client", "@/lib/prisma"],
  },
  {
    ruta: "server/materias/materia.publico.ts",
    permitidos: ["@prisma/client", "@/lib/prisma"],
  },
];

function permitidoEnPublico(especificador: string, permitidos: string[]) {
  return permitidos.includes(especificador) || /^@\/server\/shared\/[^/]+$/.test(especificador);
}

function prohibidosEn(imports: Importacion[], permitidos: string[]) {
  return imports
    .map(({ especificador }) => especificador)
    .filter((especificador) => !permitidoEnPublico(especificador, permitidos));
}

describe("aislamiento de los .publico.ts (Regla N.° 3)", () => {
  it.each(PUBLICOS)("$ruta solo importa de la lista permitida", ({ ruta, permitidos }) => {
    const imports = importaciones(ruta);
    expect(imports.length).toBeGreaterThan(0);
    expect(prohibidosEn(imports, permitidos)).toEqual([]);
  });

  it.each([
    [0, "@/server/turnos/turno.publico"],
    [0, "@/server/alumnos/autorregistro.service"],
    [0, "@/server/alumnos/alumno.schema"],
    [0, "@/server/profesores/profesor.service"],
    [0, "@/lib/horario-atencion"],
    [0, "./alumno.service"],
    [0, "../turnos/turno.publico"],
    [1, "@/server/materias/materia.service"],
    [1, "@/server/alumnos/alumno.service"],
    [1, "@/server/profesores/profesor.schema"],
    [1, "@/server/shared/sub/archivo"],
    [1, "@/lib/normalizar-texto"],
    [1, "@/types/materia.types"],
    [1, "./profesor.service"],
    [2, "@/server/alumnos/alumno.service"],
    [2, "@/server/alumnos/alumno.publico"],
    [2, "@/server/materias/materia.service"],
    [2, "@/server/pagos/forma-pago.service"],
    [2, "./forma-pago.service"],
    [3, "@/server/turnos/turno.service"],
    [3, "./turno.service"],
    [3, "@/server/turnos/turno.validaciones"],
    [3, "@/server/aulas/aula.publico"],
    [3, "@/server/materias/materia.service"],
    [3, "@/server/alumnos/alumno.publico"],
    [3, "./turno.disponibilidad"],
    [3, "../aulas/aula.service"],
    [4, "@/server/turnos/turno.publico"],
    [4, "@/server/turnos/turno.service"],
    [4, "@/server/alumnos/alumno.service"],
    [4, "@/server/pagos/forma-pago.service"],
    [4, "@/server/usuarios/usuario.service"],
    [4, "./forma-pago.publico"],
    [4, "../alumnos/alumno.publico"],
  ])("rechaza en el público %i el import %s", (indice, especificador) => {
    const { permitidos } = PUBLICOS[indice]!;
    const imports = [...importaciones(PUBLICOS[indice]!.ruta), { especificador, soloTipo: false }];
    expect(prohibidosEn(imports, permitidos)).toEqual([especificador]);
  });
});

/**
 * Helpers de src/lib/ que usa profesor.publico.ts: deben ser puros. Solo
 * pueden importar tipos de @prisma/client, otras utilidades puras de
 * src/lib/ (verificadas con esta misma regla), @/types/profesor.types o
 * librerías estándar de Node. Nunca @/lib/prisma, @/server/** ni un service.
 */
const HELPERS = ["@/lib/profesor-listado", "@/lib/horario-atencion"];

function violacionesDeHelper(especificador: string, visitados = new Set<string>()): string[] {
  if (visitados.has(especificador)) return [];
  visitados.add(especificador);
  const ruta = `${especificador.slice(2)}.ts`;
  return importaciones(ruta).flatMap(({ especificador: importado, soloTipo }) => {
    if (importado === "@prisma/client") return soloTipo ? [] : [`${ruta}: ${importado} (no es import type)`];
    if (importado === "@/types/profesor.types" || importado.startsWith("node:")) return [];
    if (importado === "@/lib/prisma" || !/^@\/lib\/[^/]+$/.test(importado)) return [`${ruta}: ${importado}`];
    return violacionesDeHelper(importado, visitados);
  });
}

describe("pureza de los helpers de src/lib/ usados por los .publico.ts", () => {
  it.each(HELPERS)("%s no importa prisma, src/server ni nada fuera de la lista", (helper) => {
    expect(violacionesDeHelper(helper)).toEqual([]);
  });
});
