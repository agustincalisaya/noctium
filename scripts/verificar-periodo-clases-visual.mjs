// Regresión del filtro compartido de H03 y sus dos tarjetas en Actividad.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.VISUAL_BASE_URL || "http://localhost:3000";
const output = resolve(process.env.VISUAL_OUTPUT || "docs/testing/Modulo H/hu-h-10/correccion/clases");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const resultados = [];
try {
  const authContext = await browser.newContext(); const login = await authContext.newPage();
  await login.goto(`${base}/login`); await login.locator('input[type="email"]').fill(process.env.VISUAL_USER || "gerente@noctium.local");
  await login.locator('input[type="password"]').fill(process.env.VISUAL_PASSWORD || "Password123!"); await login.locator('button[type="submit"]').click(); await login.waitForURL("**/home");
  const auth = await authContext.storageState(); await authContext.close();
  for (const movil of [false, true]) {
    const context = await browser.newContext({ storageState: auth, viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: movil, hasTouch: movil });
    const page = await context.newPage(), consultas = [], errors = []; await page.clock.setFixedTime(new Date("2026-10-12T12:00:00Z")); page.on("pageerror", e => errors.push(e.message));
    await page.route("**/api/indicadores/**", route => {
      const url = new URL(route.request().url()); consultas.push(url.pathname + url.search);
      const [a, m] = url.searchParams.get("desde").split("-").map(Number), [b, n] = url.searchParams.get("hasta").split("-").map(Number);
      const meses = (b - a) * 12 + n - m + 1;
      let data = null;
      if (url.pathname.endsWith("clases-por-materia")) data = { total: meses * 5, items: [{ materia_id: "m1", nombre: "PROGRAMACIÓN Y ESTRUCTURAS DE DATOS", codigo: null, activa: true, clases: meses * 3 }, { materia_id: "m2", nombre: "Física", codigo: null, activa: false, clases: meses * 2 }, { materia_id: "m3", nombre: "Activa sin clases", codigo: null, activa: true, clases: 0 }] };
      else if (url.pathname.endsWith("clases-por-profesor")) data = { total: { clases: meses * 5, horas: meses * 6 }, items: [{ profesor_id: "p1", nombre: "Pérez, Ana María", activo: true, clases: meses * 3, horas: meses * 4 }, { profesor_id: "p2", nombre: "Díaz, Juan", activo: false, clases: meses * 2, horas: meses * 2 }] };
      else if (url.pathname.endsWith("ingresos-por-mes") || url.pathname.endsWith("ocupacion-por-mes")) data = [];
      else if (url.pathname.endsWith("ocupacion-resumen")) data = { turnos: 0, ocupacion_promedio: 0 };
      return route.fulfill({ status: data ? 200 : 503, json: { data, error: data ? null : { message: "Fuera del caso" } } });
    });
    await page.goto(`${base}/gerente`);
    for (const [meses, desde] of [[6, "2026-05"], [24, "2024-11"]]) {
      await page.locator("#indicadores-desde").selectOption(desde);
      for (const selector of ["#indicadores-desde", "#indicadores-hasta"]) {
        const opciones = await page.locator(`${selector} option`).evaluateAll(options => options.map(o => o.value));
        assert.equal(opciones.length, 24); assert.equal(opciones[0], "2024-11"); assert.equal(opciones.at(-1), "2026-10"); assert.ok(opciones.every(m => m <= "2026-10"));
      }
      for (const [id, columnas] of [["clases-materia", 3], ["clases-profesor", 4]]) {
        const card = page.locator(`[aria-labelledby="${id}-titulo"]`); await card.locator(".recharts-surface").waitFor();
        await page.waitForFunction(({ id, total }) => document.querySelector(`[aria-labelledby="${id}-titulo"]`)?.textContent.includes(`${total} clases`), { id, total: meses * 5 });
        await card.screenshot({ path: `${output}/${meses}-${movil ? "mobile" : "desktop"}-${id}.png` });
        await card.getByRole("button", { name: "Ver como tabla" }).click(); assert.equal(await card.locator("thead th").count(), columnas);
        const filas = await card.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent)));
        assert.equal(filas[0][2], String(meses * 3)); assert.equal(filas[1][2], String(meses * 2));
        if (id === "clases-profesor") { assert.equal(filas[0][3], String(meses * 4)); assert.equal(filas[1][3], String(meses * 2)); }
        else assert.equal(filas[2][2], "0");
        await card.getByRole("button", { name: "Ver como tabla" }).click();
        assert.ok(consultas.some(url => url.includes(id === "clases-materia" ? "clases-por-materia" : "clases-por-profesor") && url.includes(`desde=${desde}&hasta=2026-10`)));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      resultados.push({ caso: `${meses}-${movil ? "mobile" : "desktop"}`, resultado: "aprobado", desde, hasta: "2026-10" });
      console.log(`PASS H03 ${meses} ${movil ? "mobile" : "desktop"}`);
    }
    assert.deepEqual(errors, []); await context.close();
  }
  await writeFile(`${output}/resultados.json`, JSON.stringify(resultados, null, 2));
} finally { await browser.close(); }
