// Playwright sobre la pantalla integrada. Los casos extremos interceptan solo
// respuestas HTTP; se renderizan los componentes y estilos reales de la app.
// PLAYWRIGHT_MODULE permite reutilizar una instalación externa de Playwright.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.VISUAL_BASE_URL || "http://localhost:3000";
const output = resolve(process.env.VISUAL_OUTPUT || "docs/testing/Modulo H/hu-h-10/correccion");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const resultados = [];
const claves = ["clases_canceladas_centro", "inscripciones_canceladas_alumno", "reservas_vencidas", "bajas"];
const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
function fixture(meses, materias, alto = false, singular = false) {
  const hasta = "2026-10";
  const fecha = new Date(Date.UTC(2026, 10 - meses, 1));
  const desde = fecha.toISOString().slice(0, 7);
  const items = Array.from({ length: materias }, (_, i) => ({
    materia_id: `materia-${i}`, nombre: i === 0 ? "Programación y estructuras de datos con aplicaciones científicas avanzadas" : `Materia ${i + 1}`,
    codigo: null, activa: i !== 1, clases_canceladas_centro: singular ? 1 : (materias - i) * (alto ? 999999 : 1),
    inscripciones_canceladas_alumno: singular ? 1 : (materias - i) * (alto ? 7999999 : 2),
  }));
  const totales = { clases_canceladas_centro: items.reduce((s, m) => s + m.clases_canceladas_centro, 0), inscripciones_canceladas_alumno: items.reduce((s, m) => s + m.inscripciones_canceladas_alumno, 0), reservas_vencidas: singular ? 1 : meses * 3, bajas: singular ? 1 : meses };
  const filas = Array.from({ length: meses }, (_, i) => {
    const mes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    return { mes, ...Object.fromEntries(claves.map(k => [k, Math.floor(totales[k] / meses) + (i < totales[k] % meses ? 1 : 0)])) };
  });
  const clases = singular ? 1 : totales.clases_canceladas_centro + 100;
  const inscripciones = singular ? 3 : totales.inscripciones_canceladas_alumno + totales.reservas_vencidas + 1000;
  const mensual = { meses: filas, totales, tasas: { clases: { canceladas: totales.clases_canceladas_centro, totales: clases, tasa: Math.round(totales.clases_canceladas_centro / clases * 1000) / 10 }, inscripciones: { canceladas_alumno: totales.inscripciones_canceladas_alumno, totales: inscripciones, tasa: Math.round(totales.inscripciones_canceladas_alumno / inscripciones * 1000) / 10 } } };
  return { desde, hasta, mensual, materias: { items } };
}
async function scrollInfo(locator) {
  return locator.evaluate(el => ({ ancho: el.clientWidth, contenido: el.scrollWidth, alto: el.clientHeight, contenidoAlto: el.scrollHeight, izquierda: el.scrollLeft, arriba: el.scrollTop, overflowX: getComputedStyle(el).overflowX, overflowY: getComputedStyle(el).overflowY, tabIndex: el.tabIndex }));
}
async function valoresVisibles(card) {
  const errors = await card.locator(".recharts-label-list text").evaluateAll(texts => texts.flatMap(text => {
    const box = text.getBBox(), svg = text.ownerSVGElement;
    return box.x < -1 || box.x + box.width > svg.viewBox.baseVal.width + 1 || box.y < -1 || box.y + box.height > svg.viewBox.baseVal.height + 1 ? [text.textContent] : [];
  }));
  assert.deepEqual(errors, [], "Valores cortados por los límites del SVG");
  const overlaps = await card.locator(".recharts-label-list text").evaluateAll(texts => {
    const boxes = texts.map(text => ({ texto: text.textContent, box: text.getBBox() }));
    return boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b => a.box.x < b.box.x + b.box.width - 0.5 && a.box.x + a.box.width > b.box.x + 0.5 && a.box.y < b.box.y + b.box.height - 0.5 && a.box.y + a.box.height > b.box.y + 0.5).map(b => [a.texto, b.texto]));
  });
  assert.deepEqual(overlaps, [], "Cifras superpuestas");
}
try {
  const authContext = await browser.newContext(process.env.VISUAL_STORAGE_STATE ? { storageState: process.env.VISUAL_STORAGE_STATE } : {});
  if (!process.env.VISUAL_STORAGE_STATE) {
    const page = await authContext.newPage();
    await page.goto(`${base}/login`);
    await page.locator('input[type="email"]').fill(process.env.VISUAL_USER || "gerente@noctium.local");
    await page.locator('input[type="password"]').fill(process.env.VISUAL_PASSWORD || "Password123!");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/home");
    await page.close();
  }
  const auth = await authContext.storageState();
  // Datos reales antes/después: las rutas y sus cálculos deben ser idénticos.
  if (process.env.VISUAL_BEFORE) {
    const before = JSON.parse(await readFile(process.env.VISUAL_BEFORE, "utf8"));
    const monthly = await authContext.request.get(`${base}/api/indicadores/cancelaciones-por-mes?desde=2026-05&hasta=2026-10`);
    const subjects = await authContext.request.get(`${base}/api/indicadores/cancelaciones-por-materia?desde=2026-05&hasta=2026-10`);
    const after = { monthly: await monthly.json(), subjects: await subjects.json() };
    assert.deepEqual(after, before);
    for (const clave of claves.slice(0, 2)) assert.equal(after.subjects.data.items.reduce((s, m) => s + m[clave], 0), after.monthly.data.totales[clave]);
    await writeFile(`${output}/datos-reales.json`, JSON.stringify(after, null, 2));
    resultados.push({ caso: "datos-reales", resultado: "idénticos antes y después; totales mensuales y por materia coinciden" });
  }
  await authContext.close();
  for (const movil of [false, true]) {
    const context = await browser.newContext({ storageState: auth, viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: movil, hasTouch: movil });
    for (const [meses, materias, alto, singular] of [[6, 2], [12, 3], [13, 8], [24, 16], [22, 3], [6, 8, true], [6, 1, false, true]]) {
      const nombre = `${meses}-${movil ? "mobile" : "desktop"}-${materias}${alto ? "-altos" : singular ? "-singular" : ""}`;
      if (process.env.VISUAL_CASE && nombre !== process.env.VISUAL_CASE) continue;
      const datos = fixture(meses, materias, alto, singular);
      const page = await context.newPage();
      page.setDefaultTimeout(90000);
      await page.clock.setFixedTime(new Date("2026-10-12T12:00:00Z"));
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/api/indicadores/**", route => {
        const url = new URL(route.request().url());
        const data = url.pathname.endsWith("cancelaciones-por-mes") ? datos.mensual : url.pathname.endsWith("cancelaciones-por-materia") ? datos.materias : null;
        return route.fulfill({ status: data ? 200 : 503, json: { data, error: data ? null : { message: "Fuera del caso de prueba" } } });
      });
      await page.goto(`${base}/gerente`);
      await page.getByRole("tab", { name: "Cancelaciones", exact: true }).click();
      await page.locator("#indicadores-desde").selectOption(datos.desde);
      await page.locator("#indicadores-hasta").selectOption(datos.hasta);
      const mensual = page.locator('[aria-labelledby="cancelaciones-mes-titulo"]');
      const materia = page.locator('[aria-labelledby="cancelaciones-materia-titulo"]');
      await mensual.locator(".recharts-surface").waitFor();
      await materia.locator(".recharts-surface").waitFor();
      await page.waitForFunction(n => document.querySelectorAll('[aria-labelledby="cancelaciones-mes-titulo"] [data-category]').length === n, meses);
      const scrollMes = mensual.locator(".overscroll-contain");
      const scrollMateria = materia.locator(".overscroll-contain");
      await page.waitForTimeout(150);
      const mesInfo = await scrollInfo(scrollMes), materiaInfo = await scrollInfo(scrollMateria);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Desborde global");
      assert.equal(materiaInfo.contenido > materiaInfo.ancho + 1, false, "Desborde horizontal de materias");
      assert.equal(materiaInfo.overflowX, "hidden");
      assert.equal(materiaInfo.contenidoAlto > materiaInfo.alto + 1, materias > 8);
      if (!movil && meses === 6 && !alto) { assert.equal(mesInfo.overflowX, "hidden"); assert.ok(mesInfo.contenido <= mesInfo.ancho + 1); }
      await page.screenshot({ path: `${output}/${nombre}.png`, fullPage: true });
      await materia.screenshot({ path: `${output}/${nombre}-materias.png` });
      await valoresVisibles(mensual); await valoresVisibles(materia);
      if (mesInfo.contenido > mesInfo.ancho + 1) {
        assert.ok(mesInfo.izquierda >= mesInfo.contenido - mesInfo.ancho - 2, "Comienza en meses recientes");
        assert.equal(mesInfo.tabIndex, 0);
        assert.ok(await mensual.locator("#cancelaciones-mes-scroll").isVisible());
        await scrollMes.focus();
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(200);
        assert.ok((await scrollInfo(scrollMes)).izquierda < mesInfo.izquierda, "Teclado desplaza a meses anteriores");
        if (movil) {
          await scrollMes.scrollIntoViewIfNeeded();
          const box = await scrollMes.boundingBox();
          const cdp = await context.newCDPSession(page);
          const x = box.x + box.width / 3, y = box.y + box.height / 2;
          const antes = (await scrollInfo(scrollMes)).izquierda;
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
          for (let paso = 1; paso <= 6; paso++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + paso * 22, y }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await page.waitForTimeout(200);
          assert.ok((await scrollInfo(scrollMes)).izquierda < antes, "Tacto desplaza a meses anteriores");
          await cdp.detach();
        } else {
          await scrollMes.hover(); await page.mouse.wheel(-mesInfo.contenido, 0);
          await page.waitForTimeout(200);
          assert.ok((await scrollInfo(scrollMes)).izquierda < mesInfo.izquierda, "Mouse desplaza a meses anteriores");
        }
        await scrollMes.evaluate(el => { el.scrollLeft = 0; });
        await page.screenshot({ path: `${output}/${nombre}-anteriores.png`, fullPage: true });
        await scrollMes.evaluate(el => { el.scrollLeft = el.scrollWidth; });
      }
      if (materias > 8) {
        await scrollMateria.focus(); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(200);
        assert.ok((await scrollInfo(scrollMateria)).arriba > 0, "Teclado recorre las materias");
        await scrollMateria.hover(); await page.mouse.wheel(0, materiaInfo.contenidoAlto); await page.waitForTimeout(200);
        assert.ok((await scrollInfo(scrollMateria)).arriba > 0);
        await scrollMateria.evaluate(el => { el.scrollTop = 0; });
        if (movil) {
          await scrollMateria.scrollIntoViewIfNeeded();
          const box = await scrollMateria.boundingBox();
          const cdp = await context.newCDPSession(page);
          const x = box.x + box.width / 2, y = box.y + box.height * 0.7;
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
          for (let paso = 1; paso <= 6; paso++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - paso * 22 }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await page.waitForTimeout(200);
          assert.ok((await scrollInfo(scrollMateria)).arriba > 0, "Tacto recorre las materias");
          await cdp.detach();
          await scrollMateria.evaluate(el => { el.scrollTop = 0; });
        }
      }
      if (!movil && meses > 12) assert.ok(Math.abs((await mensual.boundingBox()).width - (await materia.boundingBox()).width) < 2, "Materia aprovecha la fila completa");
      for (const [card, filas, columnas] of [[mensual, datos.mensual.meses, claves], [materia, datos.materias.items, claves.slice(0, 2)]]) {
        await card.getByRole("button", { name: "Ver como tabla" }).click();
        assert.equal(await card.locator("tbody tr").count(), filas.length);
        const actual = await card.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(cell => cell.textContent)));
        for (let i = 0; i < filas.length; i++) assert.deepEqual(actual[i].slice(-columnas.length), columnas.map(k => card === mensual ? numero.format(filas[i][k]) : String(filas[i][k])));
        const tablaScroll = card.locator("table").locator("..");
        if ((await scrollInfo(tablaScroll)).contenido > (await scrollInfo(tablaScroll)).ancho + 1) {
          await tablaScroll.focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(200);
          assert.ok((await scrollInfo(tablaScroll)).izquierda > 0, "Tabla accesible por teclado");
        }
        assert.ok((await materia.locator("tbody").textContent()).includes(datos.materias.items[0].nombre));
        await card.getByRole("button", { name: "Ver como tabla" }).click();
      }
      assert.ok((await page.getByRole("region", { name: "Tasa de cancelación de clases", exact: true }).textContent()).includes(`${numero.format(datos.mensual.tasas.clases.tasa)} %`));
      assert.ok((await page.getByRole("region", { name: "Tasa de cancelación de inscripciones", exact: true }).textContent()).includes(`${numero.format(datos.mensual.tasas.inscripciones.tasa)} %`));
      if (singular) { assert.ok((await mensual.locator("strong").allTextContents()).includes("1 inscripción")); assert.ok(!(await mensual.locator("strong").allTextContents()).includes("1 inscripciones")); }
      await mensual.locator(".recharts-surface").waitFor();
      await page.screenshot({ path: `${output}/${nombre}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      resultados.push({ caso: nombre, meses: mesInfo, materias: materiaInfo, resultado: "aprobado" });
      console.log(`PASS ${nombre}`);
      await page.close();
    }
    await context.close();
  }
  await writeFile(`${output}/resultados.json`, JSON.stringify(resultados, null, 2));
} finally { await browser.close(); }
