// Casos de H07 en la pantalla integrada, con los componentes y estilos reales.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.VISUAL_BASE_URL || "http://localhost:3000";
const output = resolve(process.env.VISUAL_OUTPUT || "docs/testing/Modulo H/hu-h-10/correccion/presentismo");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const resultados = [];
const vacio = { inscriptos: 0, presentes: 0, ausentes: 0, indice: null };
function resumen(filas) {
  const inscriptos = filas.reduce((s, m) => s + m.inscriptos, 0), presentes = filas.reduce((s, m) => s + m.presentes, 0);
  return { inscriptos, presentes, ausentes: inscriptos - presentes, indice: inscriptos ? Math.round(presentes / inscriptos * 1000) / 10 : null };
}
function fixture(meses, materias, alto = false, sinRegistros = false) {
  const fecha = new Date(Date.UTC(2026, 10 - meses, 1));
  const filas = Array.from({ length: meses }, (_, i) => {
    const mes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    if (sinRegistros || i % 5 === 1 || i % 5 === 2) return { mes, ...vacio };
    const inscriptos = (alto ? 9999999 : 100) + i * (alto ? 999 : 10);
    const presentes = i % 5 === 3 ? 0 : Math.floor(inscriptos * (0.5 + i % 4 * 0.1));
    return { mes, inscriptos, presentes, ausentes: inscriptos - presentes, indice: Math.round(presentes / inscriptos * 1000) / 10 };
  });
  const total = resumen(filas);
  const items = sinRegistros ? [] : Array.from({ length: materias }, (_, i) => {
    const inscriptos = Math.floor(total.inscriptos / materias) + (i < total.inscriptos % materias ? 1 : 0);
    const presentes = Math.floor(total.presentes / materias) + (i < total.presentes % materias ? 1 : 0);
    return { materia_id: `materia-${i}`, nombre: i === 0 ? "PROGRAMACIÓN AVANZADA Y ESTRUCTURAS DE DATOS PARA APLICACIONES CIENTÍFICAS" : `Materia ${i + 1}`, codigo: null, activa: i !== 1, inscriptos, presentes, ausentes: inscriptos - presentes, indice: inscriptos ? Math.round(presentes / inscriptos * 1000) / 10 : null };
  }).sort((a, b) => a.indice - b.indice || b.ausentes - a.ausentes || a.nombre.localeCompare(b.nombre, "es"));
  return { desde: fecha.toISOString().slice(0, 7), mensual: { meses: filas, resumen: total, clases_sin_control: 0 }, materias: { items, resumen: total, clases_sin_control: 0 } };
}
async function info(locator) { return locator.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, left: el.scrollLeft, top: el.scrollTop, overflowX: getComputedStyle(el).overflowX })); }
async function comprobarGeometria(card) {
  const defects = await card.locator(".recharts-label-list text, [data-annotation]").evaluateAll(texts => {
    const boxes = texts.map(text => ({ value: text.textContent, box: text.getBBox(), svg: text.ownerSVGElement.viewBox.baseVal }));
    const errors = boxes.filter(t => t.box.x < -1 || t.box.y < -1 || t.box.x + t.box.width > t.svg.width + 1 || t.box.y + t.box.height > t.svg.height + 1).map(t => `Cortado: ${t.value}`);
    for (let i = 0; i < boxes.length; i++) for (const b of boxes.slice(i + 1)) {
      const a = boxes[i];
      if (a.box.x < b.box.x + b.box.width - 0.5 && a.box.x + a.box.width > b.box.x + 0.5 && a.box.y < b.box.y + b.box.height - 0.5 && a.box.y + a.box.height > b.box.y + 0.5) errors.push(`Superpuestos: ${a.value} / ${b.value}`);
    }
    return errors;
  });
  assert.deepEqual(defects, []);
}
try {
  const authContext = await browser.newContext(process.env.VISUAL_STORAGE_STATE ? { storageState: process.env.VISUAL_STORAGE_STATE } : {});
  if (!process.env.VISUAL_STORAGE_STATE) {
    const page = await authContext.newPage(); await page.goto(`${base}/login`);
    await page.locator('input[type="email"]').fill(process.env.VISUAL_USER || "gerente@noctium.local");
    await page.locator('input[type="password"]').fill(process.env.VISUAL_PASSWORD || "Password123!");
    await page.locator('button[type="submit"]').click(); await page.waitForURL("**/home"); await page.close();
  }
  const auth = await authContext.storageState(); await authContext.close();
  for (const movil of [false, true]) {
    const context = await browser.newContext({ storageState: auth, viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: movil, hasTouch: movil });
    for (const [meses, materias, alto, sinRegistros] of [[3, 2], [6, 3], [12, 8], [13, 8], [24, 16], [6, 8, true], [6, 0, false, true]]) {
      const nombre = `${meses}-${movil ? "mobile" : "desktop"}-${materias}${alto ? "-altos" : sinRegistros ? "-sin-registros" : ""}`;
      if (process.env.VISUAL_CASE && nombre !== process.env.VISUAL_CASE) continue;
      const datos = fixture(meses, materias, alto, sinRegistros), page = await context.newPage();
      page.setDefaultTimeout(60000); await page.clock.setFixedTime(new Date("2026-10-12T12:00:00Z")); const errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.route("**/api/indicadores/**", route => {
        const url = new URL(route.request().url());
        const data = url.pathname.endsWith("presentismo-por-mes") ? datos.mensual : url.pathname.endsWith("presentismo-por-materia") ? datos.materias : url.pathname.endsWith("alumnos-presentismo-bajo") ? { items: [], total: 0, por_pagina: 10, umbral: 75, minimo_clases: 2 } : null;
        return route.fulfill({ status: data ? 200 : 503, json: { data, error: data ? null : { message: "Fuera del caso" } } });
      });
      await page.goto(`${base}/gerente`);
      for (const selector of ["#indicadores-desde", "#indicadores-hasta"]) {
        const opciones = await page.locator(`${selector} option`).evaluateAll(options => options.map(o => o.value));
        assert.equal(opciones.length, 24); assert.equal(opciones.at(-1), "2026-10"); assert.ok(opciones.every(mes => mes <= "2026-10"));
      }
      await page.getByRole("tab", { name: "Índice de Presentismo", exact: true }).click();
      await page.locator("#indicadores-desde").selectOption(datos.desde);
      const mensual = page.locator('[aria-labelledby="presentismo-mes-titulo"]'), materia = page.locator('[aria-labelledby="presentismo-materia-titulo"]');
      await mensual.locator(".recharts-surface").waitFor();
      await page.waitForFunction(n => document.querySelectorAll('[aria-labelledby="presentismo-mes-titulo"] [data-category]').length === n, meses);
      await page.waitForTimeout(200);
      const scroll = mensual.locator(".overscroll-contain");
      const antes = await info(scroll);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (!movil && meses <= 6 && !alto) { assert.equal(antes.overflowX, "hidden"); assert.equal(await mensual.locator("#presentismo-mes-scroll").count(), 0); }
      if (meses === 24 || movil && meses > 3 || alto) {
        assert.ok(antes.scrollWidth > antes.width + 1); assert.equal(antes.overflowX, "auto"); assert.ok(antes.left >= antes.scrollWidth - antes.width - 2);
        assert.ok(await mensual.locator("#presentismo-mes-scroll").isVisible());
        await scroll.focus(); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(180);
        assert.ok((await info(scroll)).left < antes.left);
      }
      const sinDatos = datos.mensual.meses.filter(m => !m.inscriptos).length;
      await mensual.screenshot({ path: `${output}/${nombre}-mes.png` });
      const etiquetasSinDatos = await mensual.locator("[data-category] text").evaluateAll(texts => texts.filter(text => text.textContent.trim() === "Sin registros").length);
      assert.equal(etiquetasSinDatos, sinDatos);
      assert.equal(await mensual.locator(".recharts-line-dot").count(), meses - sinDatos);
      const segments = datos.mensual.meses.reduce((s, m, i) => s + (m.indice != null && (i === 0 || datos.mensual.meses[i - 1].indice == null) ? 1 : 0), 0);
      const paths = await mensual.locator(".recharts-line-curve").evaluateAll(paths => paths.map(p => p.getAttribute("d") || ""));
      assert.ok(paths.reduce((s, path) => s + (path.match(/M/g)?.length ?? 0), 0) >= (segments > 1 ? segments - 1 : 0), "Línea interrumpida en meses sin registros");
      const dots = await mensual.locator(".recharts-line-dot").evaluateAll(dots => dots.map(dot => ({ x: Number(dot.getAttribute("cx")), center: dot.getBoundingClientRect().x + dot.getBoundingClientRect().width / 2 })));
      const mesesConDatos = datos.mensual.meses.map((m, i) => ({ m, i })).filter(({ m }) => m.indice != null);
      for (const path of paths) {
        let anterior = null;
        for (const command of path.matchAll(/([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
          const x = Number(command[2]);
          const punto = dots.reduce((mejor, dot, i) => Math.abs(dot.x - x) < Math.abs(dots[mejor].x - x) ? i : mejor, 0);
          const indice = mesesConDatos[punto].i;
          if (command[1] === "L") assert.equal(indice, anterior + 1, "La línea no cruza un mes sin datos");
          anterior = indice;
        }
      }
      const total = datos.mensual.resumen.indice == null ? "—" : `${numero.format(datos.mensual.resumen.indice)} %`;
      assert.ok((await mensual.textContent()).includes(total));
      await comprobarGeometria(mensual);
      const annotation = await mensual.locator('[data-annotation="diferencia"]').evaluateAll(texts => texts.map(text => ({ y: text.getBBox().y + text.getBBox().height, value: text.textContent })));
      assert.ok(annotation.every(a => a.y < 25));
      const centrosAusentes = await mensual.locator('[data-annotation="diferencia"]').evaluateAll(texts => texts.map(text => text.getBoundingClientRect().x + text.getBoundingClientRect().width / 2));
      assert.equal(centrosAusentes.length, dots.length);
      assert.ok(centrosAusentes.every((centro, i) => Math.abs(centro - dots[i].center) < 1), "Ausentes centrados sobre cada par");
      const minPlotY = await mensual.locator(".recharts-line-dot").evaluateAll(dots => Math.min(...dots.map(dot => Number(dot.getAttribute("cy")))));
      if (!sinRegistros) assert.ok(minPlotY >= 58, "Línea fuera de las anotaciones");
      await mensual.screenshot({ path: `${output}/${nombre}-mes.png` });
      if (antes.overflowX === "auto") { await scroll.evaluate(el => { el.scrollLeft = 0; }); await mensual.screenshot({ path: `${output}/${nombre}-anteriores.png` }); }
      if (!sinRegistros) {
        await materia.locator(".recharts-surface").waitFor(); await comprobarGeometria(materia);
        const scrollMateria = materia.locator(".overscroll-contain"), mi = await info(scrollMateria);
        if (alto && movil) {
          assert.equal(mi.overflowX, "auto"); assert.ok(mi.scrollWidth > mi.width + 1);
          await scrollMateria.focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(180);
          assert.ok((await info(scrollMateria)).left > 0);
        } else { assert.equal(mi.overflowX, "hidden"); assert.ok(mi.scrollWidth <= mi.width + 1); }
        assert.equal(mi.scrollHeight > mi.height + 1, materias > 8);
        if (!movil && meses > 12) assert.ok(Math.abs((await materia.boundingBox()).width - (await mensual.boundingBox()).width) < 2);
        await materia.screenshot({ path: `${output}/${nombre}-materia.png` });
        const labels = await materia.locator("foreignObject div").evaluateAll(nodes => nodes.map(n => ({ full: n.title, width: n.clientWidth, ellipsis: getComputedStyle(n).textOverflow })));
        assert.equal(labels.length, materias); assert.ok(labels.some(l => l.full === datos.materias.items.find(m => m.materia_id === "materia-0").nombre)); assert.ok(labels.every(l => l.ellipsis === "ellipsis"));
      }
      for (const [card, filas] of [[mensual, datos.mensual.meses], [materia, datos.materias.items]]) {
        await card.getByRole("button", { name: "Ver como tabla" }).click();
        assert.equal(await card.locator("tbody tr").count(), filas.length);
        if (card === mensual) {
          const values = await card.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent)));
          for (let i = 0; i < filas.length; i++) assert.deepEqual(values[i], [numero.format(filas[i].inscriptos), numero.format(filas[i].presentes), filas[i].indice == null ? "—" : `${numero.format(filas[i].indice)} %`, String(filas[i].ausentes)]);
        } else {
          const values = await card.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent)));
          for (let i = 0; i < filas.length; i++) assert.deepEqual(values[i], [String(filas[i].inscriptos), String(filas[i].presentes), filas[i].indice == null ? "—" : `${numero.format(filas[i].indice)}%`, String(filas[i].ausentes)]);
        }
        await card.getByRole("button", { name: "Ver como tabla" }).click();
      }
      // Recalcula el aviso al ampliar/reducir, sin cambiar datos ni total.
      if (!movil && meses === 6 && !alto && !sinRegistros) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => !!document.querySelector("#presentismo-mes-scroll"));
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.waitForFunction(() => !document.querySelector("#presentismo-mes-scroll"));
        assert.ok((await mensual.textContent()).includes(total));
      }
      assert.deepEqual(errors, []); resultados.push({ caso: nombre, resultado: "aprobado", meses: antes, sinRegistros: sinDatos, resumen: datos.mensual.resumen });
      console.log(`PASS H07 ${nombre}`); await page.close();
    }
    await context.close();
  }
  await writeFile(`${output}/resultados.json`, JSON.stringify(resultados, null, 2));
} finally { await browser.close(); }
