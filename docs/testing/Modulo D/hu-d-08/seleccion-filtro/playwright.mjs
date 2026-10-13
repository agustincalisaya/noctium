// Ejecutar contra una instancia local con fixtures descartables de HU-D-08.
// D08_FIXTURES: JSON con origen, destino, m1, m2, turns, extra, inscripcion, pago.
// D08_SESSION: storageState de una sesión de Gerente; no commitear ese archivo.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: process.env.D08_ENV || '.env', override: true, quiet: true });
if (!new URL(process.env.DATABASE_URL).pathname.startsWith('/noctium_d08_revision_')) throw new Error('Solo base descartable D08');
const db = new PrismaClient();
const fixture = JSON.parse(readFileSync(process.env.D08_FIXTURES || '/tmp/d08-fixtures.json', 'utf8'));
const base = process.env.D08_BASE_URL || 'http://localhost:3018';
const output = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
const report = { browser: 'Chromium / Playwright', checks: [], requests: [], errors: [] };
const before = { inscripcion: await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: fixture.inscripcion } }), pago: await db.pago.findUniqueOrThrow({ where: { idPago: fixture.pago } }) };
async function open(context) {
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${base}/profesores/${fixture.origen}`);
  await page.getByRole('button', { name: 'Desactivar profesor', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Seleccionar todas (206)', exact: true }).waitFor();
  return { page, dialog };
}
const storageState = process.env.D08_SESSION || '/tmp/d08-browser-session.json';
try {
  // Escritorio y móvil sobre el mismo estado inicial, sin mutar la base.
  for (const [device, width, height] of [['desktop', 1366, 950], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ storageState, viewport: { width, height } });
    const { page, dialog } = await open(context);
    await dialog.getByRole('checkbox', { name: 'Seleccionar todas (206)', exact: true }).check();
    await dialog.getByText('206 clases seleccionadas', { exact: true }).first().waitFor();
    assert.equal(await dialog.locator('tbody input:checked').count(), 10);
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await dialog.getByText('Página 2 de 21', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Siguiente')?.disabled);
    assert.equal(await dialog.locator('tbody input:checked').count(), 10);
    await dialog.getByLabel('Materia', { exact: true }).selectOption(fixture.m1);
    await dialog.getByRole('checkbox', { name: 'Seleccionar todas de Matemática I D08 (205)', exact: true }).waitFor();
    await dialog.getByText('205 clases seleccionadas', { exact: true }).first().waitFor();
    await dialog.getByLabel('Materia', { exact: true }).selectOption('');
    await dialog.getByRole('checkbox', { name: 'Seleccionar todas (206)', exact: true }).waitFor();
    await dialog.getByText('205 clases seleccionadas', { exact: true }).first().waitFor();
    await dialog.getByLabel('Materia', { exact: true }).selectOption(fixture.m1);
    await dialog.getByRole('checkbox', { name: 'Seleccionar todas de Matemática I D08 (205)', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Cancelar seleccionadas', exact: true }).click();
    const confirm = page.getByRole('alertdialog');
    await confirm.getByText('Esta acción no se puede deshacer.', { exact: true }).waitFor();
    assert.match(await confirm.innerText(), /205 clases/);
    assert.match(await confirm.innerText(), /1 alumno inscripto/);
    assert.match(await confirm.innerText(), /Reintegro/);
    await page.screenshot({ path: `${output}confirmacion-${device}.png` });
    await confirm.getByRole('button', { name: 'Volver', exact: true }).click();
    await dialog.evaluate(el => { el.scrollTop = 0; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const tableOverflow = await dialog.locator('table').evaluate(el => el.parentElement.scrollWidth > el.parentElement.clientWidth);
    assert.equal(tableOverflow, device === 'mobile');
    await page.screenshot({ path: `${output}seleccion-${device}.png` });
    report.checks.push({ device, selection: 205, rows: 10, pageSelectionPersists: true, filterRetainsCompatible: true, offPagePaymentWarning: true, pageOverflow: false, tableOverflow });
    await context.close();
  }
  const context = await browser.newContext({ storageState, viewport: { width: 1366, height: 950 } });
  const { page, dialog } = await open(context);
  let active = 0;
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.url().includes('/turnos-futuros/')) return;
    const body = request.postDataJSON();
    assert.equal(active, 0, 'Las tandas deben ser secuenciales');
    active++;
    report.requests.push({ path: new URL(request.url()).pathname, ids: body.turno_ids.length, destination: body.profesor_destino_id ?? null });
  });
  page.on('response', response => {
    if (response.request().method() !== 'POST' || !response.url().includes('/turnos-futuros/')) return;
    active--;
    report.requests.at(-1).status = response.status();
  });
  await dialog.getByLabel('Materia', { exact: true }).selectOption(fixture.m1);
  const selectAll = dialog.getByRole('checkbox', { name: 'Seleccionar todas de Matemática I D08 (205)', exact: true });
  await selectAll.waitFor(); await selectAll.check();
  await dialog.getByRole('button', { name: 'Cambiar profesor de las seleccionadas', exact: true }).click();
  await dialog.getByLabel('Profesor nuevo', { exact: true }).selectOption(fixture.destino);
  const confirmChange = dialog.getByRole('button', { name: 'Confirmar cambio (204 clases)', exact: true });
  await confirmChange.waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Confirmar cambio (204 clases)' && !b.disabled));
  assert.equal(await dialog.locator('tbody tr').count(), 205);
  assert.equal(await dialog.getByText('Se puede cambiar', { exact: true }).count(), 204);
  assert.equal(await dialog.getByText('Fuera de su horario de atención', { exact: true }).count(), 1);
  await dialog.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `${output}preview-desktop.png` });
  await confirmChange.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar cambio (204 clases)', exact: true }).click();
  await dialog.getByText('Se cambió el profesor de 204 clases', { exact: true }).waitFor({ timeout: 90000 });
  await dialog.getByText('1 clase seleccionada', { exact: true }).first().waitFor();
  await dialog.getByText('Fuera de su horario de atención', { exact: true }).waitFor();
  assert.equal(await dialog.locator('tbody input:checked').count(), 1);
  await dialog.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `${output}parcial-desktop.png` });
  assert.deepEqual(report.requests.filter(r => r.path.endsWith('/previsualizacion')).map(r => r.ids), [100, 100, 5]);
  assert.deepEqual(report.requests.filter(r => r.path.endsWith('/cambio-profesor')).map(r => r.ids), [100, 100, 5]);
  const moved = await db.turno.count({ where: { idTurno: { in: fixture.turns }, profesorId: fixture.destino } });
  assert.equal(moved, 204);
  assert.deepEqual(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: fixture.inscripcion } }), before.inscripcion);
  assert.deepEqual(await db.pago.findUniqueOrThrow({ where: { idPago: fixture.pago } }), before.pago);
  report.checks.push({ mutation: 'cambio', selected: 205, changed: moved, failed: 1, failureSelectedWithReason: true, paymentsAndRegistrationsPreserved: true });
  // Cancelar la fallida; la otra materia queda disponible para resolver.
  await dialog.getByRole('button', { name: 'Cancelar seleccionadas', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar 1 clase', exact: true }).click();
  await dialog.getByText('Se canceló 1 clase', { exact: true }).waitFor();
  if (await dialog.getByLabel('Materia', { exact: true }).count()) await dialog.getByLabel('Materia', { exact: true }).selectOption('');
  await dialog.getByRole('checkbox', { name: 'Seleccionar todas (1)', exact: true }).check();
  await dialog.getByRole('button', { name: 'Cancelar seleccionadas', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar 1 clase', exact: true }).click();
  await dialog.getByRole('button', { name: 'Desactivar profesor', exact: true }).waitFor();
  assert.deepEqual(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: fixture.inscripcion } }), before.inscripcion);
  assert.deepEqual(await db.pago.findUniqueOrThrow({ where: { idPago: fixture.pago } }), before.pago);
  await page.screenshot({ path: `${output}sin-futuras.png` });
  await dialog.getByRole('button', { name: 'Desactivar profesor', exact: true }).click();
  const deactivate = page.getByRole('alertdialog');
  await deactivate.getByLabel('Motivo de la baja', { exact: true }).fill('Verificación descartable de selección global HU-D-08');
  await deactivate.getByRole('button', { name: 'Desactivar profesor', exact: true }).click();
  await page.getByRole('button', { name: 'Reactivar profesor', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reactivar profesor', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivar profesor', exact: true }).click();
  await page.getByRole('button', { name: 'Desactivar profesor', exact: true }).waitFor();
  assert.equal(await db.turno.count({ where: { idTurno: { in: [fixture.turns[204], fixture.extra] }, estadoTurno: 'CANCELADO' } }), 2);
  report.checks.push({ mutation: 'cancelacion', cancelled: 2, paymentsAndRegistrationsPreserved: true, zeroFutureOffersDeactivation: true, deactivatedAndReactivated: true, cancelledNotRestored: true });
  assert.deepEqual(report.errors, []);
  assert.equal(report.requests.every(r => r.status === 200), true);
  await context.close();
  report.result = 'PASS';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(`${output}playwright-resultados.json`, JSON.stringify(report, null, 2));
  await browser.close(); await db.$disconnect();
}
