// HU-I-05 — verificación HTTP (Nivel 2) y E2E/visual/impresión (Playwright)
// contra una base NUEVA y descartable en el servidor PostgreSQL local.
// Nunca escribe en la base de DATABASE_URL: solo usa su servidor para crear y
// borrar `noctium_pruebas_i05_<aleatorio>`. Compatible con Windows (shell y
// taskkill) y con Linux/macOS.
//
//   node scripts/testing/run-hu-i-05.mjs            -> build + start + api-check + Playwright
//   HU_I05_SIN_BUILD=1 node scripts/testing/run-hu-i-05.mjs   -> reutiliza el .next ya construido
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const origen = new URL(process.env.PG_PRUEBAS_ADMIN_URL ?? process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "::1"].includes(origen.hostname)) throw new Error("PostgreSQL debe ser local");
const base = `noctium_pruebas_i05_${randomBytes(4).toString("hex")}`;
const conBase = (nombre) => { const url = new URL(origen); url.pathname = `/${nombre}`; return url.toString(); };
const admin = new PrismaClient({ datasources: { db: { url: conBase("postgres") } } });
const port = process.env.HU_I05_PORT ?? "3105";
const evidencia = "docs/testing/Modulo I/hu-i-05";
mkdirSync(evidencia, { recursive: true });
const env = {
  ...process.env,
  DATABASE_URL: conBase(base),
  HU_I05_BASE_URL: `http://127.0.0.1:${port}`,
  HU_I05_FIXTURES: join(tmpdir(), `${base}-fixtures.json`),
  HU_I05_TEST_PASSWORD: "Password123!",
  AUTH_URL: `http://127.0.0.1:${port}`, NEXTAUTH_URL: `http://127.0.0.1:${port}`, AUTH_TRUST_HOST: "true",
};
const windows = process.platform === "win32";

function run(cmd, args) {
  const linea = [cmd, ...args.map((a) => `"${a}"`)].join(" ");
  console.log(`\n$ ${linea}`);
  const r = spawnSync(linea, { env, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`${cmd} terminó con ${r.status}`);
}

let server;
let creado = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${base}"`);
  creado = true;
  console.log(`Base descartable: ${base}`);
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
  run("npx", ["tsx", "scripts/testing/hu-i-05-fixtures.ts"]);
  if (!process.env.HU_I05_SIN_BUILD) run("npm", ["run", "build"]);
  server = spawn(`npm run start -- --hostname 127.0.0.1 --port ${port}`, { env, shell: true, detached: !windows, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(join(tmpdir(), `${base}-next.log`));
  server.stdout.pipe(log); server.stderr.pipe(log);
  let listo = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("next start no arrancó (¿otro servidor en el puerto?)");
    try { if ((await fetch(`${env.HU_I05_BASE_URL}/login`)).ok) { listo = true; break; } } catch { /* todavía no */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!listo) throw new Error("next start no responde");
  run("node", [`${evidencia}/api-check.mjs`]);
  run("npx", ["playwright", "test", "-c", "playwright.hu-i-05.config.ts"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server?.pid) {
    if (windows) spawnSync(`taskkill /pid ${server.pid} /T /F`, { shell: true, stdio: "ignore" });
    else { try { process.kill(-server.pid, "SIGTERM"); } catch { /* ya terminó */ } }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (creado) {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${base}" WITH (FORCE)`).catch((e) => console.error(`No se pudo borrar ${base}:`, e.message));
    console.log(`Base descartable borrada: ${base}`);
  }
  await admin.$disconnect();
}
