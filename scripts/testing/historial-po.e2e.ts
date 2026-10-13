import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixtures = JSON.parse(readFileSync(process.env.HISTORIAL_PO_FIXTURES ?? "/tmp/noctium-po-fixtures.json", "utf8"));
const output = "docs/testing/Modulo E/revision-po";
async function login(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await page.waitForURL("**/home");
}
const timeline = (page: Page) => page.getByRole("list", { name: "Registros académicos" });
async function screenshot(page: Page, name: string) { await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: "disabled", style: "nextjs-portal { display: none !important; }" }); }

test("E08: DTO real, tres tipos, 16 registros, filtro, paginación y privacidad", async ({ page }) => {
  await login(page, "historial.po@prueba.local");
  await page.goto("/mi-historial", { waitUntil: "domcontentloaded" });
  await expect(timeline(page).locator("li")).toHaveCount(10);
  await expect(page.getByText("12 clases dictadas · 2 exámenes · 2 indicaciones", { exact: true })).toBeVisible();
  const data = (await (await page.request.get("/api/mi-historial")).json()).data;
  expect(data.desglose).toEqual(fixtures.expected);
  expect(data.items.map((i: { tipo: string }) => i.tipo)).toEqual(expect.arrayContaining(["CLASE_DICTADA", "EXAMEN", "INDICACION"]));
  expect(JSON.stringify(data)).not.toMatch(/SECRETO|EXAMEN_ANULADO_PO|observaciones|turno_id|puede_corregir/);
  expect(data.items.find((i: { id: string }) => i.id === fixtures.examen)).toMatchObject({ descripcion_publica: "Parcial de cinemática", registrado_por: "Ferreyra, Julián" });
  expect(data.items.find((i: { tipo: string; registrado_por: string | null }) => i.tipo === "EXAMEN" && i.registrado_por === null)).toMatchObject({ descripcion_publica: null });
  await screenshot(page, "e08-desktop");
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(timeline(page).locator("li")).toHaveCount(6);
  await expect(page.getByText("Mostrando 11–16 de 16", { exact: true })).toBeVisible();
  const p2 = (await (await page.request.get("/api/mi-historial?pagina=2")).json()).data;
  expect(p2.desglose).toEqual(data.desglose);
  expect(new Set([...data.items, ...p2.items].map(i => i.id)).size).toBe(16);
  const fechas = [...data.items, ...p2.items].map(i => i.fecha);
  expect(fechas).toEqual([...fechas].sort().reverse());
  const filtrada = page.waitForResponse(r => r.url().includes("/api/mi-historial?") && r.url().includes("materia_id="));
  await page.getByLabel("Materia", { exact: true }).selectOption({ label: "Física I" });
  const response = await filtrada;
  expect(new URL(response.url()).searchParams.get("pagina")).toBe("1");
  await expect(timeline(page).locator("li")).toHaveCount(8);
  expect((await response.json()).data.desglose).toEqual({ clases_dictadas: 6, examenes: 1, indicaciones: 1 });
  await screenshot(page, "e08-filtrado");
  expect((await page.request.get(`/api/mi-historial?alumno_id=${fixtures.nuevo}`)).status()).toBe(403);
  expect((await page.request.get("/api/mi-historial?desconocido=1")).status()).toBe(400);
  const fuera = (await (await page.request.get("/api/mi-historial?pagina=99")).json()).data;
  expect(fuera.items).toEqual([]); expect(fuera.desglose).toEqual(fixtures.expected);
});

test("E08: móvil, texto largo, nota sin superposición y cero desbordamiento", async ({ page }) => {
  await login(page, "historial.po@prueba.local"); await page.goto("/mi-historial", { waitUntil: "domcontentloaded" });
  await expect(timeline(page).locator("li")).toHaveCount(10);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1080 });
    const layout = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, main: document.querySelector("main")!.scrollWidth, client: document.querySelector("main")!.clientWidth }));
    expect(layout.document).toBeLessThanOrEqual(layout.viewport); expect(layout.main).toBeLessThanOrEqual(layout.client);
    const examen = timeline(page).locator("li").filter({ hasText: "Parcial de cinemática" });
    const titulo = await examen.locator("h2").boundingBox();
    const nota = await examen.locator("p").filter({ hasText: /^8/ }).boundingBox();
    expect(titulo).not.toBeNull(); expect(nota).not.toBeNull();
    if (width < 640) expect(nota!.y).toBeGreaterThanOrEqual(titulo!.y + titulo!.height);
    else expect(nota!.x).toBeGreaterThan(titulo!.x + titulo!.width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, "e08-mobile-texto-largo");
  await page.getByLabel("Materia", { exact: true }).selectOption({ label: "Física I" });
  await expect(timeline(page).locator("li")).toHaveCount(8);
  await screenshot(page, "e08-mobile");
  const sinControl = page.getByText("Asistió (sin control de asistencia)", { exact: true }).first();
  await expect(sinControl).not.toHaveClass(/bg-success/);
});

test("E08: carga, error, reintento y vacío literal", async ({ page }) => {
  await login(page, "historial.po@prueba.local");
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/mi-historial?*", async route => { await gate; await route.continue(); });
  await page.goto("/mi-historial", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Cargando historial…", { exact: true })).toBeVisible();
  release(); await expect(timeline(page).locator("li")).toHaveCount(10); await page.unroute("**/api/mi-historial?*");
  await page.route("**/api/mi-historial?*", route => route.fulfill({ status: 500, json: { data: null, error: { message: "Servicio de prueba no disponible" } } }));
  await page.reload(); await expect(page.locator("main").getByRole("alert")).toContainText("Servicio de prueba no disponible");
  await screenshot(page, "e08-error"); await page.unroute("**/api/mi-historial?*");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click(); await expect(timeline(page).locator("li")).toHaveCount(10);
  await page.context().clearCookies(); await login(page, "historial.vacio@prueba.local"); await page.goto("/mi-historial", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Todavía no tenés historial académico", { exact: true })).toBeVisible(); await screenshot(page, "e08-vacio");
});

async function contexto(page: Page, turno: string, alumno = fixtures.alumno) {
  await page.goto(`/turnos/${turno}/alumnos/${alumno}/historial`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Registrar indicación", exact: true }).waitFor();
  const token = (await page.content()).match(/eyJhbGciOiJIUzI1NiJ9\.[\w-]+\.[\w-]+/)?.[0];
  expect(token).toBeTruthy(); return token;
}
const endpoint = `/api/alumnos/${fixtures.alumno}/indicaciones`;
test("E04: profesor con A y B, contexto firmado, 403 sin alta y 201 dentro de alcance", async ({ page }) => {
  await login(page, "historial.profesor@prueba.local");
  const token = await contexto(page, fixtures.origenA);
  await expect(page.locator('aside a[href="/alumnos"]')).toHaveCount(0);
  const datos = { materia_id: fixtures.materias[0], indicacion: "Prueba Playwright: repasar cinemática", contexto_origen: token };
  const antes = (await (await page.request.get(`/api/alumnos/${fixtures.alumno}/historial?materia_id=${fixtures.materias[0]}`)).json()).data.paginacion.total;
  expect((await page.request.post(endpoint, { data: { ...datos, materia_id: fixtures.materias[1] } })).status()).toBe(403);
  expect((await page.request.post(endpoint, { data: { ...datos, contexto_origen: token + "x" } })).status()).toBe(403);
  expect((await page.request.post(endpoint, { data: { materia_id: datos.materia_id, indicacion: datos.indicacion } })).status()).toBe(403);
  expect((await page.request.post(`/api/alumnos/${fixtures.nuevo}/indicaciones`, { data: datos })).status()).toBe(403);
  expect((await (await page.request.get(`/api/alumnos/${fixtures.alumno}/historial?materia_id=${fixtures.materias[0]}`)).json()).data.paginacion.total).toBe(antes);
  await page.getByRole("button", { name: "Registrar indicación", exact: true }).click();
  await page.locator("textarea").fill(datos.indicacion); await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("¿Estás seguro de que querés registrar la indicación");
  await expect(page.getByRole("alertdialog")).toContainText(datos.indicacion);
  await expect(page.getByRole("alertdialog")).toContainText("Clase relacionada del"); await screenshot(page, "e04-confirmacion");
  const alta = page.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === "POST");
  await page.getByRole("alertdialog").getByRole("button", { name: "Registrar indicación", exact: true }).click(); expect((await alta).status()).toBe(201);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("E04: clase futura sin primer dictado y profesor ajeno", async ({ page }) => {
  await login(page, "historial.profesor@prueba.local"); const token = await contexto(page, fixtures.futura, fixtures.nuevo);
  await expect(page.getByRole("button", { name: "Registrar indicación", exact: true })).toBeDisabled();
  await expect(page.getByText("Vas a poder registrar indicaciones después de tu primera clase dictada de esta materia con este alumno.", { exact: true })).toBeVisible(); await screenshot(page, "e04-futura");
  expect((await page.request.post(`/api/alumnos/${fixtures.nuevo}/indicaciones`, { data: { materia_id: fixtures.materias[0], indicacion: "No permitido", contexto_origen: token } })).status()).toBe(403);
  await page.context().clearCookies(); await login(page, "historial.ajeno@prueba.local");
  expect((await page.request.post(endpoint, { data: { materia_id: fixtures.materias[0], indicacion: "Ajeno", contexto_origen: token } })).status()).toBe(403);
  await page.goto(`/turnos/${fixtures.origenA}/alumnos/${fixtures.alumno}/historial`, { waitUntil: "domcontentloaded" }); await expect(page).toHaveURL(/sin-permiso/);
});

test("E04: Mesa de Entrada guarda con vínculo y sin contexto/vínculo", async ({ page }) => {
  await login(page, fixtures.mesaEmail);
  const historial = (await (await page.request.get(`/api/alumnos/${fixtures.alumno}/historial`)).json()).data;
  const clase = historial.indicaciones_opciones.clases.find((c: { materia_id: string }) => c.materia_id === fixtures.materias[0]);
  expect(clase).toBeTruthy();
  for (const vincular of [true, false]) {
    const response = await page.request.post(endpoint, { data: { materia_id: fixtures.materias[0], indicacion: `Mesa prueba ${vincular}`, ...(vincular ? { clase_dictada_id: clase.id } : {}) } });
    expect(response.status()).toBe(201); expect((await response.json()).data.clase_dictada_id).toBe(vincular ? clase.id : null);
  }
});

test("C25: confirmaciones E07, E10 y E11 muestran contexto, datos y errores", async ({ page }) => {
  await login(page, fixtures.mesaEmail);
  await page.goto(`/turnos/${fixtures.origenB}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Registrar observaciones", exact: true }).click();
  await page.locator("#temas-vistos").fill("Temas públicos de prueba");
  await page.locator("#observaciones-internas").fill("Nota interna de prueba");
  await page.getByRole("dialog").getByRole("button", { name: "Continuar", exact: true }).click();
  let confirmacion = page.getByRole("alertdialog");
  await expect(confirmacion).toContainText("¿Estás seguro de que querés registrar las observaciones");
  await expect(confirmacion).toContainText("Temas públicos de prueba"); await expect(confirmacion).toContainText("Nota interna de prueba");
  await confirmacion.getByRole("button", { name: "Volver", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();

  await page.goto(`/turnos/${fixtures.origenA}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Corregir asistencia", exact: true }).click();
  await page.locator("#motivo-correccion-clase").fill("Corrección de prueba");
  await page.getByRole("button", { name: "Guardar corrección", exact: true }).click();
  confirmacion = page.getByRole("alertdialog");
  await expect(confirmacion).toContainText("a las 14:00"); await expect(confirmacion).toContainText("Acosta, Sofía");
  await expect(confirmacion).toContainText("Presente"); await expect(confirmacion).toContainText("Corrección de prueba");
  await screenshot(page, "e11-confirmacion-asistencia");
  await confirmacion.getByRole("button", { name: "Volver", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Anular registro de clase dictada", exact: true }).click();
  confirmacion = page.getByRole("alertdialog");
  await expect(confirmacion.getByRole("button", { name: "Volver", exact: true })).toBeFocused();
  await expect(confirmacion.getByRole("button", { name: "Anular registro", exact: true })).toBeDisabled();
  await expect(confirmacion).toContainText("Esta acción no se puede deshacer.");
  await page.locator("#motivo-anulacion-clase").fill("Motivo de prueba");
  await page.route("**/clase-dictada/anulacion", route => route.fulfill({ status: 409, json: { data: null, error: { code: "TRANSACCION_OCUPADA", message: "Otra persona está modificando estos datos" } } }));
  await confirmacion.getByRole("button", { name: "Anular registro", exact: true }).click();
  await expect(confirmacion.getByRole("alert")).toContainText("Otra persona"); await expect(page.locator("#motivo-anulacion-clase")).toHaveValue("Motivo de prueba");
  await screenshot(page, "e11-error-anulacion");
  await confirmacion.getByRole("button", { name: "Volver", exact: true }).click(); await page.unroute("**/clase-dictada/anulacion");

  await page.goto(`/alumnos/${fixtures.alumno}?tab=historial`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^Corregir resultado de Física I/ }).first().click();
  await page.getByRole("dialog").getByLabel("Nota", { exact: true }).fill("9.5");
  await page.getByRole("dialog").locator("textarea").fill("Corrección de nota de prueba");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar corrección", exact: true }).click();
  confirmacion = page.getByRole("alertdialog");
  await expect(confirmacion).toContainText("¿Estás seguro de que querés corregir el resultado");
  await expect(confirmacion).toContainText("Registrado:"); await expect(confirmacion).toContainText("Nuevo valor:"); await expect(confirmacion).toContainText("Corrección de nota de prueba");
  await confirmacion.getByRole("button", { name: "Volver", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: /^Anular resultado de Física I/ }).first().click();
  await page.getByRole("dialog").locator("textarea").fill("Anulación de prueba");
  await page.getByRole("dialog").getByRole("button", { name: "Continuar", exact: true }).click();
  confirmacion = page.getByRole("alertdialog");
  await expect(confirmacion).toContainText("¿Estás seguro de que querés anular el resultado"); await expect(confirmacion).toContainText("Anulación de prueba"); await expect(confirmacion).toContainText("Esta acción no se puede deshacer.");
  await expect(confirmacion.getByRole("button", { name: "Volver", exact: true })).toBeFocused();
});
