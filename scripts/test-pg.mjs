// Corre los *.pg.test.ts contra una base PostgreSQL DESCARTABLE (PR-0.md §2.12).
//
//   npm run test:pg                       -> todos los *.pg.test.ts
//   npm run test:pg -- src/server/shared src/server/turnos/x.pg.test.ts
//                                         -> solo los *.pg.test.ts de esas carpetas o archivos
//
// 1. Crea la base noctium_pruebas_<aleatorio> en el MISMO servidor de
//    DATABASE_URL (o de PG_PRUEBAS_ADMIN_URL), que tiene que ser localhost.
// 2. Le aplica las migraciones (`prisma migrate deploy`): migraciones solas, sin seed.
// 3. Corre vitest con DATABASE_URL y todas las HU_*_TEST_DATABASE_URL apuntando
//    a esa base, sin paralelismo entre archivos y con TZ=UTC.
// 4. Borra la base aunque las pruebas fallen.
// Algunos *.pg.test.ts de los Sprints 1 y 2 solo corren en una base con un
// nombre fijo (su guarda lo exige): esos archivos corren además en una pasada
// propia, con una base descartable de ese nombre (ver NOMBRES_EXIGIDOS). Si
// esa base ya existe, no se toca: la pasada falla con un aviso.
// Nunca escribe en la base de DATABASE_URL: solo se conecta a la base
// administrativa "postgres" del mismo servidor para crear y borrar la descartable.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Variables que habilitan los *.pg.test.ts del repo.
const VARIABLES_PG = [
  "HU_PR0_TEST_DATABASE_URL",
  "HU_C05_TEST_DATABASE_URL",
  "HU_C06_TEST_DATABASE_URL",
  "HU_C10_TEST_DATABASE_URL",
  "HU_C13_TEST_DATABASE_URL",
  "HU_C15_TEST_DATABASE_URL",
  "HU_C17_TEST_DATABASE_URL",
];

const origen = process.env.PG_PRUEBAS_ADMIN_URL ?? process.env.DATABASE_URL;
if (!origen) {
  console.error("Falta DATABASE_URL (o PG_PRUEBAS_ADMIN_URL) para ubicar el servidor PostgreSQL.");
  process.exit(1);
}
const servidor = new URL(origen);
if (!["localhost", "127.0.0.1", "::1"].includes(servidor.hostname)) {
  console.error(`El servidor de pruebas tiene que ser local (es ${servidor.hostname}).`);
  process.exit(1);
}

const aleatorio = () => randomBytes(4).toString("hex");
const conBase = (base) => {
  const url = new URL(servidor);
  url.pathname = `/${base}`;
  return url.toString();
};
const admin = new PrismaClient({ datasources: { db: { url: conBase("postgres") } } });

/**
 * Guardas de nombre de base de los *.pg.test.ts existentes: si el archivo
 * contiene `patron`, corre también en una base descartable llamada `base()`.
 */
const NOMBRES_EXIGIDOS = [
  { patron: '=== "/noctium_test"', base: () => "noctium_test", fija: true },
  { patron: 'includes("hu_c17_fase3")', base: () => `noctium_pruebas_hu_c17_fase3_${aleatorio()}`, fija: false },
];

/** Los *.pg.test.ts de las rutas pedidas (carpetas o archivos); sin rutas, los de src/. */
function archivosPg(rutas) {
  const encontrados = [];
  const recorrer = (ruta) => {
    if (statSync(ruta).isDirectory()) {
      for (const nombre of readdirSync(ruta)) if (nombre !== "node_modules") recorrer(join(ruta, nombre));
    } else if (ruta.endsWith(".pg.test.ts")) {
      encontrados.push(ruta.split("\\").join("/"));
    }
  };
  for (const ruta of rutas.length > 0 ? rutas : ["src"]) recorrer(ruta);
  return encontrados.sort();
}

// Una sola línea de comando con cada argumento entre comillas (npx necesita
// shell en Windows; así no se pasan argumentos sueltos a un shell).
function correr(comando, args, env) {
  const linea = [comando, ...args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`)].join(" ");
  const r = spawnSync(linea, { stdio: "inherit", env: { ...process.env, ...env }, shell: true });
  return r.status ?? 1;
}

/** Crea la base, aplica las migraciones, corre los archivos y la borra aunque fallen. */
async function pasada(nombre, archivos, { fija = false } = {}) {
  if (fija) {
    const existe = await admin.$queryRawUnsafe(`SELECT 1 FROM pg_database WHERE datname = $1`, nombre);
    if (existe.length > 0) {
      console.error(`La base ${nombre} ya existe y no es descartable: no se corren ${archivos.join(", ")}.`);
      return 1;
    }
  }
  const url = conBase(nombre);
  let codigo = 1;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${nombre}"`);
    console.log(`Base descartable: ${nombre}`);
    const envPruebas = { DATABASE_URL: url, TZ: "UTC", ...Object.fromEntries(VARIABLES_PG.map((v) => [v, url])) };
    codigo = correr("npx", ["prisma", "migrate", "deploy"], envPruebas);
    if (codigo === 0) codigo = correr("npx", ["vitest", "run", "--no-file-parallelism", ...archivos], envPruebas);
  } finally {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`).catch((error) => {
      console.error(`No se pudo borrar ${nombre}:`, error);
    });
  }
  return codigo;
}

let codigo = 0;
try {
  const archivos = archivosPg(process.argv.slice(2));
  if (archivos.length === 0) {
    console.error("No hay archivos *.pg.test.ts en las rutas indicadas.");
    codigo = 1;
  } else {
    codigo = Math.max(codigo, await pasada(`noctium_pruebas_${aleatorio()}`, archivos));
    for (const { patron, base, fija } of NOMBRES_EXIGIDOS) {
      const propios = archivos.filter((archivo) => readFileSync(archivo, "utf8").includes(patron));
      if (propios.length > 0) codigo = Math.max(codigo, await pasada(base(), propios, { fija }));
    }
  }
} finally {
  await admin.$disconnect();
}
process.exit(codigo);
