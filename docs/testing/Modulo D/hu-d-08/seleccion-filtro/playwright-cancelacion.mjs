// Ejecutar después de playwright.mjs: cancela las 204 clases del destino.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
require('dotenv').config({ path: process.env.D08_ENV || '.env', override: true, quiet: true });
if (!new URL(process.env.DATABASE_URL).pathname.startsWith('/noctium_d08_revision_')) throw new Error('Solo base descartable D08');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(readFileSync(process.env.D08_FIXTURES || '/tmp/d08-fixtures.json', 'utf8'));
const output = fileURLToPath(new URL('./', import.meta.url));
const report = { browser: 'Chromium / Playwright', requests: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ storageState: process.env.D08_SESSION || '/tmp/d08-browser-session.json', viewport: { width: 1366, height: 950 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  let active = 0;
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.url().endsWith('/cancelacion')) return;
    assert.equal(active++, 0, 'Cancelaciones secuenciales');
    report.requests.push({ ids: request.postDataJSON().turno_ids.length });
  });
  page.on('response', response => {
    if (response.request().method() !== 'POST' || !response.url().endsWith('/cancelacion')) return;
    active--; report.requests.at(-1).status = response.status();
  });
  await page.goto(`${process.env.D08_BASE_URL || 'http://localhost:3018'}/profesores/${fixture.destino}`);
  await page.getByRole('button', { name: 'Desactivar profesor', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Seleccionar todas (204)', exact: true }).check();
  await dialog.getByRole('button', { name: 'Cancelar seleccionadas', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar 204 clases', exact: true }).click();
  await dialog.getByText('Se cancelaron 204 clases', { exact: true }).waitFor({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'Desactivar profesor', exact: true }).waitFor();
  assert.deepEqual(report.requests.map(r => r.ids), [100, 100, 4]);
  assert.equal(report.requests.every(r => r.status === 200), true);
  assert.equal(await db.turno.count({ where: { idTurno: { in: fixture.turns }, estadoTurno: 'CANCELADO' } }), 205);
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `${output}cancelacion-lotes.png` });
  report.cancelled = 204; report.result = 'PASS';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(`${output}cancelacion-resultados.json`, JSON.stringify(report, null, 2));
  await browser.close(); await db.$disconnect();
}
