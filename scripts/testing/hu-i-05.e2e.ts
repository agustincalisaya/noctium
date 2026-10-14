import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// HU-I-05 — E2E con la app real (next start) y una base descartable, datos de
// scripts/testing/hu-i-05-fixtures.ts y anulaciones hechas por HTTP en
// api-check.mjs (flujo autorizado de HU-I-06). Capturas, PDF y resultados en
// docs/testing/Modulo I/hu-i-05/. Lo ejecuta scripts/testing/run-hu-i-05.mjs.

const fx = JSON.parse(readFileSync(process.env.HU_I05_FIXTURES!, "utf8"));
const out = "docs/testing/Modulo I/hu-i-05";
const filas = (page: Page) => page.locator("main table tbody tr");

/**
 * Sesión real de NextAuth (Credentials) en el mismo contexto del navegador:
 * `page.request` comparte las cookies con la página. Evita depender de la
 * hidratación del formulario de login, que no es parte de esta HU.
 */
async function login(page: Page, email: string) {
  const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
  await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password: "Password123!", callbackUrl: "/home" },
  });
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/home$/);
}
async function captura(page: Page, nombre: string) {
  await page.screenshot({ path: `${out}/${nombre}.png`, fullPage: true, animations: "disabled", style: "nextjs-portal { display: none !important; }" });
}
/** Mismo formato que `monto()` de turno-detalle: «$ 12.000» o «$ 15.000,50». */
function pesos(valor: string) {
  const [e, d = "00"] = valor.split(".");
  const miles = e!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return d === "00" ? `$ ${miles}` : `$ ${miles},${d}`;
}
/** Texto visible con la hoja de impresión activa (elementos con visibility: visible y caja no vacía). */
async function textoImpreso(page: Page) {
  return page.evaluate(() => {
    const partes: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const nodo = walker.currentNode;
      const el = nodo.parentElement;
      if (!el || !nodo.textContent?.trim()) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility !== "visible" || estilo.display === "none") continue;
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      partes.push(nodo.textContent.trim());
    }
    return partes.join(" ");
  });
}
async function imprimirYGuardarPdf(page: Page, nombre: string) {
  await page.emulateMedia({ media: "print" });
  await captura(page, `${nombre}-impresion`);
  const visible = await textoImpreso(page);
  const pdf = await page.pdf({ path: `${out}/${nombre}.pdf`, format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  return { visible, paginas, bytes: pdf.length };
}

const registro: Record<string, unknown> = {};
test.afterAll(() => writeFileSync(`${out}/e2e-registro.json`, JSON.stringify(registro, null, 2)));

test.describe.serial("HU-I-05 Mis pagos", () => {
  test("menú, listado de escritorio, total completo y sin acciones de escritura (c1, c2, c3, c6)", async ({ page }) => {
    await login(page, "sofia.i05@prueba.local");
    const menu = page.getByRole("link", { name: "Mis pagos", exact: true });
    await menu.click();
    await page.waitForURL("**/mis-pagos");
    await expect(filas(page)).toHaveCount(10);
    await expect(menu).toHaveAttribute("aria-current", "page");
    const api = (await (await page.request.get("/api/mis-pagos")).json()).data;
    await expect(page.getByText(`Total pagado del período: ${pesos(api.total_pagado)}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Mostrando 1–10 de 21", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Mis pagos" })).toBeVisible();
    await expect(page.getByText("Los pagos que tenés registrados en el centro. Los anulados no suman al total.")).toBeVisible();
    await expect(page.locator("main table thead th")).toHaveText(["Fecha de pago", "Clase", "Monto", "Forma de pago", "Comprobante"]);
    const primera = filas(page).first();
    await expect(primera).toContainText("06/10/2026");
    await expect(primera).toContainText(/Física I|Matemática II/);
    const anuladas = page.locator("main tbody tr[data-anulado]");
    await expect(anuladas).toHaveCount(2);
    await expect(anuladas.first()).toContainText("Anulado");
    await expect(page.locator("main").getByRole("button", { name: /Registrar|Corregir|Anular|Ver detalle/ })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/Registrado por|Ferreyra|Precio|SECRETO/);
    registro.listado = { total_api: api.total_pagado, filas_pagina_1: 10, total: api.paginacion.total };
    await captura(page, "listado-escritorio");
  });

  test("filtros + página 2 → comprobante → Cerrar conserva filtros y página; también con teclado y Atrás", async ({ page }) => {
    await login(page, "sofia.i05@prueba.local");
    await page.goto("/mis-pagos");
    await expect(filas(page)).toHaveCount(10);
    await page.getByLabel("Materia").selectOption({ label: "Física I" });
    await expect(page.getByText("Mostrando 1–10 de 14", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Mostrando 11–14 de 14", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/mis-pagos\\?materia_id=${fx.materias.fisica}&pagina=2$`));
    await captura(page, "listado-filtrado-pagina-2");

    const enlace = filas(page).first().getByRole("link");
    const href = await enlace.getAttribute("href");
    expect(href).toMatch(/^\/mis-pagos\/[^/]+\/comprobante$/);
    await enlace.click();
    await page.waitForURL(`**${href}`);
    await expect(page.getByText("Registrado en el centro", { exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Registrado por");
    await expect(page.getByRole("link", { name: "Mis pagos", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.waitForURL(/\/mis-pagos\?materia_id=.+&pagina=2$/);
    await expect(page.getByText("Mostrando 11–14 de 14", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Materia")).toHaveValue(fx.materias.fisica);

    // Teclado: foco en el enlace del comprobante y Enter; vuelve con Atrás del navegador.
    await filas(page).nth(1).getByRole("link").focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/mis-pagos\/[^/]+\/comprobante$/);
    await page.goBack();
    await page.waitForURL(/\/mis-pagos\?materia_id=.+&pagina=2$/);
    await expect(page.getByText("Mostrando 11–14 de 14", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Materia")).toHaveValue(fx.materias.fisica);
    registro.regreso = { conserva_filtro_y_pagina: true };
  });

  test("comprobante propio vigente: contenido, Imprimir invoca window.print, vista de impresión y PDF (diferido I-11 C2)", async ({ page }) => {
    await login(page, "sofia.i05@prueba.local");
    await page.goto("/mis-pagos");
    await page.locator(`a[href="/mis-pagos/${fx.multi.pagos[0]}/comprobante"]`).click();
    await page.waitForURL(`**/mis-pagos/${fx.multi.pagos[0]}/comprobante`);
    const api = (await (await page.request.get(`/api/mis-pagos/${fx.multi.pagos[0]}/comprobante`)).json()).data;
    const tarjeta = page.locator("[data-comprobante]");
    await expect(tarjeta).toContainText(`Comprobante N.° ${api.numero}`);
    for (const t of ["Acosta, Sofía", api.alumno.dni, "Mercado Pago", "Registrado en el centro", "Comprobante interno. No válido como factura", `Reemplaza al comprobante ${fx.multi.comprobante.numero}`, `Tel. ${api.centro.telefono}`]) {
      await expect(tarjeta).toContainText(t);
    }
    await expect(tarjeta).not.toContainText(/Registrado por|Ferreyra|CUIT|SECRETO/);
    await captura(page, "comprobante-escritorio");
    await page.evaluate(() => { (window as unknown as { __impresiones: number }).__impresiones = 0; window.print = () => { (window as unknown as { __impresiones: number }).__impresiones += 1; }; });
    await page.getByRole("button", { name: "Imprimir" }).click();
    expect(await page.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones)).toBe(1);
    const impreso = await imprimirYGuardarPdf(page, "comprobante-propio");
    expect(impreso.visible).toContain("Comprobante interno. No válido como factura");
    expect(impreso.visible).toContain("Registrado en el centro");
    expect(impreso.visible).toContain(api.numero);
    expect(impreso.visible).not.toMatch(/Imprimir|Cerrar|Mi cuenta|Mis clases|Solicitar clase|Mis pagos|Registrado por|SECRETO|«Imprimir»/);
    expect(impreso.paginas).toBe(1);
    registro.comprobante_propio = { numero: api.numero, pdf_paginas: impreso.paginas, pdf_bytes: impreso.bytes, window_print: 1 };
  });

  test("anulación parcial y total: marcas correctas y sin motivo en UI, HTML, API ni impresión (diferido I-11 C5)", async ({ page }) => {
    await login(page, "sofia.i05@prueba.local");
    await page.goto("/mis-pagos");
    await page.locator(`a[href="/mis-pagos/${fx.anularParcial}/comprobante"]`).click();
    await page.waitForURL(`**/mis-pagos/${fx.anularParcial}/comprobante`);
    const parcial = (await (await page.request.get(`/api/mis-pagos/${fx.anularParcial}/comprobante`)).json()).data;
    await expect(page.locator("[data-comprobante]")).toContainText(`Reemplazado por ${parcial.marcas.reemplazado_por.numero}`);
    await expect(page.locator("[data-comprobante]")).not.toContainText("ANULADO");
    expect(await page.content()).not.toMatch(/SECRETO|Motivo:/);
    expect(JSON.stringify(parcial)).not.toMatch(/SECRETO|motivo|registrado_por/);
    await captura(page, "comprobante-anulacion-parcial");
    const impresoParcial = await imprimirYGuardarPdf(page, "comprobante-anulacion-parcial");
    expect(impresoParcial.visible).not.toMatch(/SECRETO|Motivo/);

    await page.goto("/mis-pagos");
    await page.locator(`a[href="/mis-pagos/${fx.anularTotal}/comprobante"]`).click();
    await page.waitForURL(`**/mis-pagos/${fx.anularTotal}/comprobante`);
    const total = (await (await page.request.get(`/api/mis-pagos/${fx.anularTotal}/comprobante`)).json()).data;
    expect(Object.keys(total.marcas.anulado)).toEqual(["fecha"]);
    const fecha = total.marcas.anulado.fecha.split("-").reverse().join("/");
    const tarjeta = page.locator("[data-comprobante]");
    await expect(tarjeta).toContainText("ANULADO");
    await expect(tarjeta).toContainText(`Anulado el ${fecha}`);
    expect(await page.content()).not.toMatch(/SECRETO|Motivo:/);
    await captura(page, "comprobante-anulacion-total");
    const impresoTotal = await imprimirYGuardarPdf(page, "comprobante-anulacion-total");
    expect(impresoTotal.visible).toContain("ANULADO");
    expect(impresoTotal.visible).toContain(`Anulado el ${fecha}`);
    expect(impresoTotal.visible).not.toMatch(/SECRETO|Motivo|Imprimir|Mis pagos/);
    expect(impresoTotal.paginas).toBe(1);
    registro.anulaciones = { parcial_reemplazado_por: parcial.marcas.reemplazado_por.numero, total_anulado_fecha: total.marcas.anulado.fecha, motivo_en_ui_api_impresion: false };
  });

  test("comprobante de otro alumno: API 403 FUERA_DE_ALCANCE y página denegada sin datos (diferido I-11 C4)", async ({ page }) => {
    await login(page, "sofia.i05@prueba.local");
    for (const pago of [fx.pagoDeB, fx.pagoDeBOtraClase]) {
      const r = await page.request.get(`/api/mis-pagos/${pago}/comprobante`);
      expect(r.status()).toBe(403);
      expect((await r.json()).error.code).toBe("FUERA_DE_ALCANCE");
      await page.goto(`/mis-pagos/${pago}/comprobante`);
      await page.waitForURL("**/sin-permiso");
      await expect(page.locator("body")).not.toContainText(/Martínez|Lucas|Comprobante N\.°/);
    }
    await captura(page, "comprobante-ajeno-sin-permiso");
    registro.ajeno = { api: 403, pagina: "/sin-permiso" };
  });

  test("móvil: filtros y total sin desbordar la página, tabla con scroll local; comprobante legible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, "sofia.i05@prueba.local");
    await page.goto("/mis-pagos");
    await expect(filas(page)).toHaveCount(10);
    const layout = await page.evaluate(() => {
      const contenedor = document.querySelector("main table")!.parentElement!;
      return { doc: document.documentElement.scrollWidth, vw: innerWidth, tabla: contenedor.scrollWidth, visible: contenedor.clientWidth, overflow: getComputedStyle(contenedor).overflowX };
    });
    expect(layout.doc).toBeLessThanOrEqual(layout.vw);
    expect(layout.overflow).toBe("auto");
    expect(layout.tabla).toBeGreaterThan(layout.visible);
    await captura(page, "listado-movil");
    await page.locator(`a[href="/mis-pagos/${fx.multi.pagos[0]}/comprobante"]`).click();
    await page.waitForURL(/comprobante$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await captura(page, "comprobante-movil");
    registro.movil = layout;
  });

  test("vacíos, filtros sin resultados, error con Reintentar y cuenta sin ficha (c5)", async ({ page, browser }) => {
    await login(page, "sofia.i05@prueba.local");
    await page.goto("/mis-pagos?desde=2025-01-01&hasta=2025-01-31");
    await expect(page.getByText("No hay pagos para los filtros elegidos", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Desde")).toHaveValue("2025-01-01");
    await captura(page, "filtros-sin-resultados");
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(filas(page)).toHaveCount(10);

    await page.route("**/api/mis-pagos?*", (route) => route.fulfill({ status: 500, json: { data: null, error: { code: "X", message: "Servicio de prueba no disponible" } } }));
    await page.getByLabel("Materia").selectOption({ label: "Matemática II" });
    await expect(page.locator("main").getByRole("alert")).toContainText("Servicio de prueba no disponible");
    await expect(page.locator("main")).not.toContainText("No hay pagos para los filtros elegidos");
    await captura(page, "error-reintentar");
    await page.unroute("**/api/mis-pagos?*");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Mostrando 1–7 de 7")).toHaveCount(0);
    await expect(filas(page)).toHaveCount(7);

    const vacio = await browser.newPage();
    await login(vacio, "vacio.i05@prueba.local");
    await vacio.goto("/mis-pagos");
    await expect(vacio.getByText("Todavía no tenés pagos registrados", { exact: true })).toBeVisible();
    await expect(vacio.getByText(/Total pagado del período: \$ 0/)).toBeVisible();
    await captura(vacio, "sin-pagos");
    await vacio.close();

    const sinFicha = await browser.newPage();
    await login(sinFicha, "sinficha.i05@prueba.local");
    await sinFicha.goto("/mis-pagos");
    // Fallan las dos consultas (404 ALUMNO_NO_ENCONTRADO): aviso de opciones y error del listado con «Reintentar».
    await expect(sinFicha.locator("main").getByRole("alert")).toHaveCount(2);
    await expect(sinFicha.locator('main div[role="alert"]')).toContainText("Reintentar");
    await expect(sinFicha.locator("main p[role='alert']")).toContainText("No se pudieron cargar las materias del filtro.");
    await expect(sinFicha.locator("main")).not.toContainText("Todavía no tenés pagos registrados");
    await captura(sinFicha, "cuenta-sin-ficha");
    await sinFicha.close();
    registro.estados = { filtros_sin_resultados: true, error_reintentar: true, sin_pagos: true, sin_ficha_error_inline: true };
  });
});
