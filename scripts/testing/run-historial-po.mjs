// Ejecuta Playwright con una base NUEVA y descartable; no modifica la base de trabajo.
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, createWriteStream } from "node:fs";
import { PrismaClient } from "@prisma/client";
const origen = new URL(process.env.PG_PRUEBAS_ADMIN_URL ?? process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "::1"].includes(origen.hostname)) throw new Error("PostgreSQL debe ser local");
const base = `noctium_pruebas_po_${randomBytes(4).toString("hex")}`;
const conBase = name => { const url = new URL(origen); url.pathname = `/${name}`; return url.toString(); };
const admin = new PrismaClient({ datasources: { db: { url: conBase("postgres") } } });
const port = process.env.HISTORIAL_PO_PORT ?? "3100";
const env = { ...process.env, DATABASE_URL: conBase(base), HISTORIAL_PO_BASE_URL: `http://127.0.0.1:${port}`, HISTORIAL_PO_FIXTURES: `/tmp/${base}-fixtures.json`, AUTH_URL: `http://127.0.0.1:${port}`, NEXTAUTH_URL: `http://127.0.0.1:${port}`, AUTH_TRUST_HOST: "true" };
let server; let creado = false;
function run(cmd, args) {
  const result = spawnSync(cmd, args, { env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} terminó con ${result.status}`);
}
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${base}"`); creado = true;
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
  run("npx", ["tsx", "scripts/testing/historial-po-fixtures.ts"]);
  mkdirSync("docs/testing/Modulo E/revision-po", { recursive: true });
  run("npm", ["run", "build"]);
  server = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", port], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(`/tmp/${base}-next.log`); server.stdout.pipe(log); server.stderr.pipe(log);
  let listo = false;
  for (let intento = 0; intento < 60; intento++) {
    if (server.exitCode !== null) throw new Error("next start no arrancó; cerrá otros servidores del repositorio");
    try { if ((await fetch(`${env.HISTORIAL_PO_BASE_URL}/login`)).ok) { listo = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!listo) throw new Error("next start no responde");
  run("npx", ["playwright", "test", "-c", "playwright.historial.config.ts"]);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (server?.pid) {
    const terminado = new Promise(r => server.once("exit", r));
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
    await Promise.race([terminado, new Promise(r => setTimeout(r, 3000))]);
  }
  if (creado) {
    await admin.$executeRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${base} AND pid <> pg_backend_pid()`;
    await admin.$executeRawUnsafe(`DROP DATABASE "${base}"`);
  }
  await admin.$disconnect();
}
