// Ejecutar únicamente con DATABASE_URL en noctium_i02_pg y la app local en 3005.
// HU_I02_TEST_PASSWORD se inyecta por entorno; no se registra ni se guarda.
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55434") throw new Error("Base no aislada");
const base = process.env.HU_I02_BASE_URL ?? "http://127.0.0.1:3005";
const password = process.env.HU_I02_TEST_PASSWORD;
if (!password) throw new Error("Falta HU_I02_TEST_PASSWORD");
const db = new PrismaClient();

function guardarCookies(response, jar) {
  for (const linea of response.headers.getSetCookie()) {
    const primer = linea.split(";")[0];
    const indice = primer.indexOf("=");
    if (indice > 0) jar.set(primer.slice(0, indice), primer.slice(indice + 1));
  }
}
function cabeceraCookie(jar) {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}
async function iniciarSesion(email) {
  const jar = new Map();
  const csrf = await fetch(`${base}/api/auth/csrf`);
  guardarCookies(csrf, jar);
  const token = (await csrf.json()).csrfToken;
  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cabeceraCookie(jar) },
    body: new URLSearchParams({ csrfToken: token, email, password, callbackUrl: `${base}/alumnos` }),
  });
  guardarCookies(login, jar);
  const sesion = [...jar.entries()].find(([key]) => key.endsWith("session-token"));
  if (!sesion) throw new Error(`No se obtuvo sesión de ${email} (HTTP ${login.status})`);
  return `${sesion[0]}=${sesion[1]}`;
}
async function comprobar(nombre, path, esperado, cookie, extra) {
  const response = await fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {}, cache: "no-store" });
  const body = await response.json();
  const pasa = response.status === esperado && "data" in body && "error" in body && (!extra || extra(body));
  const resultado = { nombre, esperado, status: response.status, pasa,
    modo: body.data?.modo ?? null, items: body.data?.items?.length ?? null, error: body.error?.code ?? null };
  console.log(JSON.stringify(resultado));
  if (!pasa) throw new Error(`Falló ${nombre}: ${JSON.stringify(resultado)}`);
  return body;
}


async function capturarPantallas(cookie, alumnoId) {
  const fs = await import("node:fs/promises");
  const destinos = [
    { nombre: "historial-escritorio.png", ancho: 1440, alto: 900, query: "" },
    { nombre: "estado-escritorio.png", ancho: 1440, alto: 900, query: "?estado_pago=RESERVADA" },
    { nombre: "historial-movil.png", ancho: 390, alto: 844, query: "" },
    { nombre: "estado-movil.png", ancho: 390, alto: 844, query: "?estado_pago=RESERVADA" },
  ];
  const targets = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const target = targets.find((t) => t.type === "page");
  if (!target) throw new Error("Chrome no tiene pestaña de página");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let secuencia = 0;
  const pendientes = new Map();
  ws.addEventListener("message", (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (!mensaje.id) return;
    const promesa = pendientes.get(mensaje.id);
    if (!promesa) return;
    pendientes.delete(mensaje.id);
    if (mensaje.error) promesa.reject(new Error(mensaje.error.message));
    else promesa.resolve(mensaje.result);
  });
  const enviar = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++secuencia;
    pendientes.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  try {
    await enviar("Page.enable");
    await enviar("Runtime.enable");
    await enviar("Network.enable");
    const corte = cookie.indexOf("=");
    const guardada = await enviar("Network.setCookie", {
      name: cookie.slice(0, corte), value: cookie.slice(corte + 1),
      domain: new URL(base).hostname, path: "/", httpOnly: true, sameSite: "Strict",
    });
    if (!guardada.success) throw new Error("No se instaló la sesión de prueba");
    for (const destino of destinos) {
      await enviar("Emulation.setDeviceMetricsOverride", {
        width: destino.ancho, height: destino.alto, deviceScaleFactor: 1, mobile: destino.ancho < 600,
      });
      await enviar("Page.navigate", { url: base + "/alumnos/" + encodeURIComponent(alumnoId) + "/pagos" + destino.query });
      let lista = false;
      for (let intento = 0; intento < 160; intento++) {
        const lectura = await enviar("Runtime.evaluate", {
          expression: "Boolean(document.querySelector('table'))", returnByValue: true,
        });
        if (lectura.result?.value) { lista = true; break; }
        await new Promise((resolver) => setTimeout(resolver, 500));
      }
      if (!lista) {
        const lectura = await enviar("Runtime.evaluate", {
          expression: "document.body?.innerText.slice(0,500)", returnByValue: true,
        });
        throw new Error("No se cargó la tabla " + destino.nombre + ": " + lectura.result?.value);
      }
      if (destino.ancho < 600) {
        await enviar("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 650, deltaX: 0, deltaY: 500 });
        await new Promise((resolver) => setTimeout(resolver, 600));
      }
      const captura = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await fs.writeFile("docs/testing/Modulo I/hu-i-02/" + destino.nombre, Buffer.from(captura.data, "base64"));
      const resumen = await enviar("Runtime.evaluate", {
        expression: "({ancho: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth, tabla: document.querySelector('table')?.innerText.slice(0,130)})",
        returnByValue: true,
      });
      console.log(JSON.stringify({ captura: destino.nombre, ...resumen.result?.value }));
    }
  } finally {
    ws.close();
  }
}

try {
  const pagos = await db.pago.findMany({ select: { alumnoId: true }, distinct: ["alumnoId"] });
  if (!pagos.length) throw new Error("El seed no creó pagos");
  const reservada = await db.turnoAlumno.findFirst({ where: {
    alumnoId: { in: pagos.map((p) => p.alumnoId) }, estadoPago: "RESERVADA",
  }, select: { alumnoId: true } });
  const alumnoId = reservada?.alumnoId ?? pagos[0].alumnoId;
  const alumno = await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId }, select: { nombreAlumno: true, apellidoAlumno: true } });
  console.log(JSON.stringify({ alumnoId, alumno: `${alumno.nombreAlumno} ${alumno.apellidoAlumno}`, base }));
  const mesa = await iniciarSesion("mesa.entrada@noctium.local");
  const gerente = await iniciarSesion("gerente@noctium.local");
  const profesor = await iniciarSesion("profesor1@noctium.local");
  const estudiante = await iniciarSesion("alumno01@noctium.local");
  const historial = `/api/pagos/historial?alumno_id=${encodeURIComponent(alumnoId)}`;
  const opciones = `/api/pagos/historial/opciones?alumno_id=${encodeURIComponent(alumnoId)}`;
  const estado = `${historial}&estado_pago=RESERVADA`;
  await comprobar("Mesa historial", historial, 200, mesa, (b) => b.data?.modo === "HISTORIAL" && !("saldo" in b.data) && !("caja" in b.data));
  await comprobar("Mesa opciones", opciones, 200, mesa, (b) => Array.isArray(b.data?.formas_pago));
  await comprobar("Mesa estado", estado, 200, mesa, (b) => b.data?.modo === "ESTADO_DE_PAGO" && !("total_pagado" in b.data));
  await comprobar("Query incompatible", `${historial}&estado_pago=PAGADA&materia_id=x`, 400, mesa, (b) => b.error?.code === "VALIDACION");
  await comprobar("Fecha inválida", `${historial}&desde=2026-02-30`, 400, mesa, (b) => b.error?.code === "VALIDACION");
  await comprobar("Alumno inexistente", "/api/pagos/historial?alumno_id=c123456789012345678901234", 404, mesa, (b) => b.error?.code === "ALUMNO_NO_ENCONTRADO");
  await comprobar("Gerente historial", historial, 200, gerente, (b) => b.data?.modo === "HISTORIAL");
  await comprobar("Gerente estado", estado, 200, gerente, (b) => b.data?.items?.every((x) => !x.puede_registrar_pago));
  await comprobar("Profesor 403", historial, 403, profesor, (b) => b.error?.code === "SIN_PERMISO");
  await comprobar("Alumno 403", opciones, 403, estudiante, (b) => b.error?.code === "SIN_PERMISO");
  await comprobar("Sin sesión 401", historial, 401, null, (b) => b.error?.code === "SESION_INVALIDA");
  if (process.env.HU_I02_CAPTURE === "1") await capturarPantallas(mesa, alumnoId);
} finally {
  await db.$disconnect();
}
