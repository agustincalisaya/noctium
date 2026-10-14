// HU-I-05 — Nivel 2 (HTTP real) y verificación de datos (Nivel 3) contra la app
// levantada por scripts/testing/run-hu-i-05.mjs sobre una base descartable
// `noctium_pruebas_i05_*`. Usa sesiones reales de NextAuth; no imprime ni
// guarda cookies ni contraseñas (la clave pública del seed llega por entorno).
// Escribe api-check-resultados.json y sql-evidencia.json en esta carpeta.
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!url.pathname.startsWith("/noctium_pruebas_i05_")) throw new Error("Base no aislada: se exige noctium_pruebas_i05_*");
const base = process.env.HU_I05_BASE_URL ?? "http://127.0.0.1:3105";
const password = process.env.HU_I05_TEST_PASSWORD;
if (!password) throw new Error("Falta HU_I05_TEST_PASSWORD");
const fx = JSON.parse(readFileSync(process.env.HU_I05_FIXTURES, "utf8"));
const carpeta = "docs/testing/Modulo I/hu-i-05";
const db = new PrismaClient();
const resultados = [];

function guardarCookies(response, jar) {
  for (const linea of response.headers.getSetCookie()) {
    const primer = linea.split(";")[0];
    const i = primer.indexOf("=");
    if (i > 0) jar.set(primer.slice(0, i), primer.slice(i + 1));
  }
}
async function iniciarSesion(email) {
  const jar = new Map();
  const csrf = await fetch(`${base}/api/auth/csrf`);
  guardarCookies(csrf, jar);
  const token = (await csrf.json()).csrfToken;
  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    body: new URLSearchParams({ csrfToken: token, email, password, callbackUrl: `${base}/home` }),
  });
  guardarCookies(login, jar);
  const sesion = [...jar.entries()].find(([k]) => k.endsWith("session-token"));
  if (!sesion) throw new Error(`No se obtuvo sesión de ${email} (HTTP ${login.status})`);
  return `${sesion[0]}=${sesion[1]}`;
}

async function pedir(nombre, { metodo = "GET", path, cookie, cuerpo, esperado, code, verificar }) {
  const response = await fetch(`${base}${path}`, {
    method: metodo, redirect: "manual", cache: "no-store",
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const body = await response.json().catch(() => null);
  let detalle = null;
  let pasa = response.status === esperado && body !== null && "data" in body && "error" in body && (!code || body.error?.code === code);
  if (pasa && verificar) {
    try { verificar(body, response); } catch (e) { pasa = false; detalle = e.message; }
  }
  const r = { nombre, metodo, ruta: path, esperado, status: response.status, code: body?.error?.code ?? null, pasa, ...(detalle ? { detalle } : {}) };
  resultados.push(r);
  console.log(`${pasa ? "OK  " : "FALLA"} ${nombre} → ${response.status}${r.code ? ` ${r.code}` : ""}${detalle ? ` (${detalle})` : ""}`);
  return body;
}
const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };
const noStore = (_b, r) => afirmar((r.headers.get("cache-control") ?? "").startsWith("no-store"), `Cache-Control=${r.headers.get("cache-control")}`);
const CLAVES_ITEM = ["anulado", "clase", "comprobante", "fecha_pago", "forma_pago", "monto", "pago_id"].join();
const centavos = (m) => { const [e, d = ""] = m.split("."); return BigInt(e) * 100n + BigInt(d.padEnd(2, "0")); };
const decimal = (c) => `${c / 100n}.${String(c % 100n).padStart(2, "0")}`;

async function fotoDeTablas() {
  const filas = await db.$queryRaw`
    SELECT
      (SELECT md5(string_agg(row_to_json(p)::text, '|' ORDER BY p."idPago")) FROM pagos p) AS pagos,
      (SELECT md5(coalesce(string_agg(row_to_json(c)::text, '|' ORDER BY c."idCorreccionPago"), '')) FROM correcciones_pago c) AS correcciones,
      (SELECT md5(coalesce(string_agg(row_to_json(c)::text, '|' ORDER BY c."idCorreccionOperacion"), '')) FROM correcciones_operacion c) AS correcciones_operacion,
      (SELECT md5(coalesce(string_agg(row_to_json(a)::text, '|' ORDER BY a."idAnulacionPago"), '')) FROM anulaciones_pago a) AS anulaciones,
      (SELECT md5(string_agg(row_to_json(o)::text, '|' ORDER BY o."idOperacionPago")) FROM operaciones_pago o) AS operaciones,
      (SELECT md5(string_agg(c."idComprobante" || c.numero || c.datos::text || coalesce(c."reemplazaAId", ''), '|' ORDER BY c.numero)) FROM comprobantes c) AS comprobantes,
      (SELECT md5(string_agg(row_to_json(t)::text, '|' ORDER BY t."idInscripcion")) FROM turno_alumno t) AS inscripciones,
      (SELECT md5(string_agg(row_to_json(c)::text, '|' ORDER BY c."idCaja")) FROM cajas c) AS cajas,
      (SELECT md5(coalesce(string_agg(row_to_json(a)::text, '|' ORDER BY a."idAjusteCaja"), '')) FROM ajustes_caja a) AS ajustes_caja,
      (SELECT md5(string_agg(row_to_json(p)::text, '|' ORDER BY 1)) FROM parametros_sistema p) AS parametros`;
  return filas[0];
}

try {
  const [A, B, vacio, sinFicha, mesa, gerente, profesor] = await Promise.all([
    iniciarSesion("sofia.i05@prueba.local"), iniciarSesion("lucas.i05@prueba.local"), iniciarSesion("vacio.i05@prueba.local"),
    iniciarSesion("sinficha.i05@prueba.local"), iniciarSesion("mesa.i05@prueba.local"),
    iniciarSesion("gerente@noctium.local"), iniciarSesion("profesor1@noctium.local"),
  ]);

  // --- Preparación por el flujo autorizado de HU-I-06 (mesa de entrada): anulación parcial y total.
  const parcial = await pedir("Mesa anula el pago de Matemática II de la operación doble (parcial, I-06)", {
    metodo: "POST", path: `/api/pagos/${fx.anularParcial}/anulacion`, cookie: mesa, cuerpo: { motivo: `Reintegro parcial ${fx.secreto}` }, esperado: 200,
    verificar: (b) => afirmar(b.data.comprobante?.reemplazo === true, "esperaba comprobante de reemplazo"),
  });
  await pedir("Mesa anula el pago de una operación de una clase (total, I-06)", {
    metodo: "POST", path: `/api/pagos/${fx.anularTotal}/anulacion`, cookie: mesa, cuerpo: { motivo: `Reintegro total ${fx.secreto}` }, esperado: 200,
    verificar: (b) => afirmar(b.data.comprobante === null, "la anulación total no emite comprobante"),
  });

  const antes = await fotoDeTablas();

  // --- Listado propio.
  const montoDe = (s) => (s.pago === fx.corregidoMonto ? "10500.00" : s.monto);
  const esperadoTotal = decimal(centavos("12000.00") + fx.simples.filter((s) => s.pago !== fx.anularTotal).reduce((t, s) => t + centavos(montoDe(s)), 0n));
  const propios = new Set([...fx.multi.pagos, ...fx.simples.map((s) => s.pago)]);
  const ajenosOInternos = [fx.secreto, "Ferreyra", "Julián", "registrado_por", "precio", "monto_original", "ajuste", "motivo", "caja", "operacion", "cambios", "puede_corregir", fx.pagoDeB, fx.pagoDeBOtraClase, fx.alumnoB, "Martínez"];
  const verificarListado = (b) => {
    for (const item of b.data.items) {
      afirmar(Object.keys(item).sort().join() === CLAVES_ITEM, `claves ${Object.keys(item)}`);
      afirmar(propios.has(item.pago_id), `pago ajeno ${item.pago_id}`);
      afirmar(item.comprobante && /^0001-\d{8}$/.test(item.comprobante.numero), `comprobante ${JSON.stringify(item.comprobante)}`);
    }
    const json = JSON.stringify(b);
    for (const p of ajenosOInternos) afirmar(!json.includes(p), `contiene «${p}»`);
  };
  const p1 = await pedir("A: listado página 1", { path: "/api/mis-pagos", cookie: A, esperado: 200, verificar: (b, r) => {
    noStore(b, r); verificarListado(b);
    afirmar(b.data.items.length === 10, `items ${b.data.items.length}`);
    afirmar(b.data.total_pagado === esperadoTotal, `total ${b.data.total_pagado} ≠ ${esperadoTotal}`);
    afirmar(JSON.stringify(b.data.paginacion) === JSON.stringify({ total: 21, pagina_actual: 1, total_paginas: 3, por_pagina: 10 }), JSON.stringify(b.data.paginacion));
  } });
  const p2 = await pedir("A: página 2 (mismo total)", { path: "/api/mis-pagos?pagina=2", cookie: A, esperado: 200, verificar: (b) => {
    verificarListado(b); afirmar(b.data.items.length === 10 && b.data.total_pagado === esperadoTotal, "página 2");
  } });
  const p3 = await pedir("A: página 3", { path: "/api/mis-pagos?pagina=3", cookie: A, esperado: 200, verificar: (b) => afirmar(b.data.items.length === 1, "página 3") });
  await pedir("A: página fuera de rango → última", { path: "/api/mis-pagos?pagina=99", cookie: A, esperado: 200, verificar: (b) => afirmar(b.data.paginacion.pagina_actual === 3, "última") });
  const todos = [...p1.data.items, ...p2.data.items, ...p3.data.items];
  afirmar(new Set(todos.map((i) => i.pago_id)).size === 21 && todos.every((i) => propios.has(i.pago_id)), "los 21 pagos propios");
  const fechas = todos.map((i) => i.fecha_pago);
  afirmar(JSON.stringify(fechas) === JSON.stringify([...fechas].sort().reverse()), "orden por fecha de pago descendente");
  const porId = new Map(todos.map((i) => [i.pago_id, i]));
  afirmar(porId.get(fx.anularParcial).anulado && porId.get(fx.anularTotal).anulado, "anulados listados");
  afirmar(porId.get(fx.corregidoMonto).monto === "10500.00", "monto vigente corregido");
  afirmar(porId.get(fx.corregidoFecha).fecha_pago === "2026-10-04" && porId.get(fx.corregidoFecha).forma_pago.id === "formapago-efectivo", "fecha y forma vigentes");

  const fisicas = fx.simples.filter((s) => s.materia === fx.materias.fisica);
  await pedir("A: filtro Física I (14 filas, dos páginas)", { path: `/api/mis-pagos?materia_id=${fx.materias.fisica}`, cookie: A, esperado: 200, verificar: (b) => {
    verificarListado(b);
    afirmar(b.data.paginacion.total === fisicas.length + 1 && b.data.paginacion.total_paginas === 2, JSON.stringify(b.data.paginacion));
    afirmar(b.data.items.every((i) => i.clase.materia.id === fx.materias.fisica), "solo Física");
  } });
  await pedir("A: rango de un día (fecha vigente corregida 04/10)", { path: "/api/mis-pagos?desde=2026-10-04&hasta=2026-10-04", cookie: A, esperado: 200, verificar: (b) => {
    afirmar(b.data.items.length === 1 && b.data.items[0].pago_id === fx.corregidoFecha, JSON.stringify(b.data.items.map((i) => i.pago_id)));
  } });
  await pedir("A: rango + materia combinados", { path: `/api/mis-pagos?desde=2026-10-05&hasta=2026-10-06&materia_id=${fx.materias.matematica}`, cookie: A, esperado: 200, verificar: (b) => {
    afirmar(b.data.items.length === 1 && b.data.items[0].pago_id === fx.anularParcial && b.data.total_pagado === "0.00", JSON.stringify(b.data));
  } });
  await pedir("A: filtros sin coincidencias", { path: "/api/mis-pagos?desde=2025-01-01&hasta=2025-01-31", cookie: A, esperado: 200, verificar: (b) => {
    afirmar(b.data.items.length === 0 && b.data.total_pagado === "0.00" && b.data.paginacion.pagina_actual === 1 && b.data.paginacion.total_paginas === 0, JSON.stringify(b.data));
  } });
  await pedir("A: materia que solo pagó B → vacío", { path: `/api/mis-pagos?materia_id=${fx.materias.quimicaB}`, cookie: A, esperado: 200, verificar: (b) => afirmar(b.data.items.length === 0, "vacío") });
  await pedir("A: opciones (materias propias, anulados incluidos, alfabéticas)", { path: "/api/mis-pagos/opciones", cookie: A, esperado: 200, verificar: (b, r) => {
    noStore(b, r);
    afirmar(JSON.stringify(b.data) === JSON.stringify({ materias: [{ id: fx.materias.fisica, nombre: "Física I" }, { id: fx.materias.matematica, nombre: "Matemática II" }] }), JSON.stringify(b.data));
  } });
  await pedir("Alumno sin pagos: listado vacío", { path: "/api/mis-pagos", cookie: vacio, esperado: 200, verificar: (b) => afirmar(b.data.items.length === 0 && b.data.total_pagado === "0.00", "vacío") });
  await pedir("Alumno sin pagos: opciones vacías", { path: "/api/mis-pagos/opciones", cookie: vacio, esperado: 200, verificar: (b) => afirmar(b.data.materias.length === 0, "vacío") });
  await pedir("B: su listado no contiene pagos de A", { path: "/api/mis-pagos", cookie: B, esperado: 200, verificar: (b) => {
    afirmar(b.data.items.length === 2 && b.data.items.every((i) => !propios.has(i.pago_id)), "solo B");
  } });

  // --- 400 / 401 / 403 / 404 del contrato propio.
  for (const [nombre, q] of [
    ["alumno_id de B", `alumno_id=${fx.alumnoB}`], ["forma_pago_id", "forma_pago_id=formapago-efectivo"], ["estado_pago", "estado_pago=PAGADA"],
    ["por_pagina", "por_pagina=50"], ["campo extra", "x=1"], ["fecha inexistente", "desde=2026-02-31"], ["rango invertido", "desde=2026-10-15&hasta=2026-10-14"],
    ["página 0", "pagina=0"], ["página fraccionaria", "pagina=1.5"], ["fecha vacía", "desde="],
  ]) {
    await pedir(`A: listado con ${nombre} → 400`, { path: `/api/mis-pagos?${q}`, cookie: A, esperado: 400, code: "VALIDACION",
      verificar: (b) => afirmar(b.data === null && b.error.detalles && "fieldErrors" in b.error.detalles, "flatten") });
  }
  await pedir("A: opciones con alumno_id de B → 400", { path: `/api/mis-pagos/opciones?alumno_id=${fx.alumnoB}`, cookie: A, esperado: 400, code: "VALIDACION" });
  await pedir("Sin sesión: listado → 401", { path: "/api/mis-pagos", esperado: 401 });
  await pedir("Sin sesión: opciones → 401", { path: "/api/mis-pagos/opciones", esperado: 401 });
  await pedir("Sesión inválida: listado → 401", { path: "/api/mis-pagos", cookie: `${A.split("=")[0]}=token-invalido`, esperado: 401 });
  for (const [rol, cookie] of [["Mesa", mesa], ["Gerente", gerente], ["Profesor", profesor]]) {
    await pedir(`${rol}: listado propio → 403`, { path: "/api/mis-pagos", cookie, esperado: 403, code: "SIN_PERMISO" });
    await pedir(`${rol}: opciones propias → 403`, { path: "/api/mis-pagos/opciones", cookie, esperado: 403, code: "SIN_PERMISO" });
  }
  await pedir("Alumno sin ficha: listado → 404", { path: "/api/mis-pagos", cookie: sinFicha, esperado: 404, code: "ALUMNO_NO_ENCONTRADO" });
  await pedir("Alumno sin ficha: opciones → 404", { path: "/api/mis-pagos/opciones", cookie: sinFicha, esperado: 404, code: "ALUMNO_NO_ENCONTRADO" });

  // --- El alumno contra las APIs administrativas y de escritura (sin mutación).
  const unPago = fx.simples[5].pago;
  for (const [nombre, metodo, path, cuerpo] of [
    ["historial administrativo", "GET", `/api/pagos/historial?alumno_id=${fx.alumnoA}`],
    ["opciones del historial administrativo", "GET", `/api/pagos/historial/opciones?alumno_id=${fx.alumnoA}`],
    ["historial interno del pago (Ver detalle)", "GET", `/api/pagos/${unPago}/historial`],
    ["comprobante administrativo por id", "GET", `/api/comprobantes/${fx.multi.comprobante.id}`],
    ["comprobante administrativo por pago", "GET", `/api/pagos/${unPago}/comprobante`],
    ["anular un pago", "POST", `/api/pagos/${unPago}/anulacion`, { motivo: "Intento del alumno" }],
    ["corregir un pago", "POST", `/api/pagos/${unPago}/correccion`, { monto: "1.00", motivo: "Intento del alumno" }],
    ["registrar una operación", "POST", "/api/pagos/operaciones", { alumno_id: fx.alumnoA, items: [{ turno_id: "x", monto: "1.00" }], forma_pago_id: "formapago-efectivo" }],
    ["registrar un pago (atajo)", "POST", "/api/pagos", { turno_id: "x", alumno_id: fx.alumnoA, monto: "1.00", forma_pago_id: "formapago-efectivo" }],
  ]) {
    await pedir(`A: ${nombre} → 403`, { metodo, path, cookie: A, cuerpo, esperado: 403, code: "SIN_PERMISO" });
  }

  // --- Comprobante propio por pago_id (diferidos I-11 C2 y C5) y ajeno (C4).
  const comprobantes = {};
  for (const item of todos) {
    const b = await pedir(`A: comprobante propio de ${item.pago_id}${item.anulado ? " (anulado)" : ""}`, {
      path: `/api/mis-pagos/${item.pago_id}/comprobante`, cookie: A, esperado: 200, verificar: (body, r) => {
        noStore(body, r);
        const c = body.data;
        afirmar(c.id === item.comprobante.id && c.numero === item.comprobante.numero, "mismo comprobante que el listado");
        afirmar(c.registrado_en_el_centro === true && !("registrado_por" in c), "registrado_en_el_centro sin registrado_por");
        afirmar(!c.marcas.anulado || Object.keys(c.marcas.anulado).join() === "fecha", "marca anulado sin motivo");
        const json = JSON.stringify(c);
        afirmar(!json.includes(fx.secreto) && !json.includes("Ferreyra") && !json.includes("motivo"), "sin motivo ni registrador");
        afirmar(c.alumno.nombre_completo === "Acosta, Sofía", c.alumno.nombre_completo);
      } });
    comprobantes[item.pago_id] = b?.data;
  }
  const original = comprobantes[fx.anularParcial];
  const reemplazo = comprobantes[fx.multi.pagos[0]];
  afirmar(original.id === fx.multi.comprobante.id && original.marcas.reemplazado_por?.numero === reemplazo.numero && original.clases.length === 2, "parcial: el anulado abre el original reemplazado");
  afirmar(reemplazo.marcas.reemplaza_a?.numero === original.numero && reemplazo.clases.length === 1 && reemplazo.marcas.anulado === null, "parcial: el vigente abre el reemplazo");
  afirmar(parcial.data.comprobante.id === reemplazo.id, "el reemplazo es el que emitió la anulación");
  const totalAnulado = comprobantes[fx.anularTotal];
  afirmar(/^\d{4}-\d{2}-\d{2}$/.test(totalAnulado.marcas.anulado?.fecha ?? "") && totalAnulado.marcas.reemplazado_por === null, "total: ANULADO con fecha");
  afirmar(comprobantes[fx.corregidoMonto].total === "10500.00" && comprobantes[fx.corregidoMonto].marcas.reemplaza_a, "corrección de monto: reemplazo");
  afirmar(comprobantes[fx.corregidoFecha].fecha_pago === "2026-10-04" && comprobantes[fx.corregidoFecha].forma_pago.nombre === "Efectivo", "corrección de fecha/forma: reemplazo");
  resultados.push({ nombre: "Marcas de comprobantes tras corrección y anulación parcial/total", pasa: true });

  for (const [nombre, pago] of [["misma clase", fx.pagoDeB], ["otra clase", fx.pagoDeBOtraClase]]) {
    await pedir(`A: comprobante de B (${nombre}) → 403`, { path: `/api/mis-pagos/${pago}/comprobante`, cookie: A, esperado: 403, code: "FUERA_DE_ALCANCE",
      verificar: (b) => afirmar(b.data === null && !JSON.stringify(b).includes("Martínez"), "sin datos de B") });
  }
  await pedir("B: su propio comprobante → 200", { path: `/api/mis-pagos/${fx.pagoDeB}/comprobante`, cookie: B, esperado: 200 });
  await pedir("A: pago inexistente → 404", { path: "/api/mis-pagos/no-existe/comprobante", cookie: A, esperado: 404, code: "PAGO_NO_ENCONTRADO" });
  await pedir("Alumno sin ficha: comprobante → 403 (contrato I-11)", { path: `/api/mis-pagos/${unPago}/comprobante`, cookie: sinFicha, esperado: 403, code: "FUERA_DE_ALCANCE" });
  await pedir("Mesa: comprobante propio del alumno → 403", { path: `/api/mis-pagos/${unPago}/comprobante`, cookie: mesa, esperado: 403, code: "SIN_PERMISO" });

  // --- Nivel 3: la consulta no escribe nada; SQL de contraste.
  const despues = await fotoDeTablas();
  const sinCambios = JSON.stringify(antes) === JSON.stringify(despues);
  resultados.push({ nombre: "Consultas, opciones, comprobantes e intentos del alumno no cambian pagos/compensatorios/inscripciones/cajas/parámetros/comprobantes", pasa: sinCambios });
  console.log(`${sinCambios ? "OK  " : "FALLA"} Sin escrituras por la consulta`);

  const sql = await db.$queryRawUnsafe(readFileSync(`${carpeta}/HU-I-05.sql`, "utf8").split("-- @consulta-vigentes")[1].split("-- @fin")[0], fx.alumnoA);
  const totalSql = sql.filter((f) => !f.anulado).reduce((t, f) => t + centavos(String(f.monto_vigente)), 0n);
  const coincide = decimal(totalSql) === p1.data.total_pagado && sql.length === 21;
  resultados.push({ nombre: "SQL de valores vigentes coincide con el total y la cantidad del API", pasa: coincide, sql_total: decimal(totalSql), api_total: p1.data.total_pagado });
  const motivos = await db.$queryRaw`SELECT a."pagoId", a.motivo FROM anulaciones_pago a WHERE a."pagoId" IN (${fx.anularParcial}, ${fx.anularTotal}) ORDER BY a."pagoId"`;
  const conMotivo = motivos.length === 2 && motivos.every((m) => m.motivo.includes(fx.secreto));
  resultados.push({ nombre: "El motivo existe en la base (contraste) y no llegó a ninguna respuesta del alumno", pasa: conMotivo });
  writeFileSync(`${carpeta}/sql-evidencia.json`, JSON.stringify({
    base: url.pathname.slice(1), fecha: new Date().toISOString(),
    vigentes: sql.map((f) => ({ ...f, monto_original: String(f.monto_original), monto_vigente: String(f.monto_vigente), pago_id: f.pago_id.slice(0, 8) + "…" })),
    total_sql: decimal(totalSql), total_api: p1.data.total_pagado,
    anulaciones_con_motivo_en_base: motivos.map((m) => ({ pago: m.pagoId.slice(0, 8) + "…", motivo_presente: m.motivo.includes(fx.secreto) })),
    huella_antes: antes, huella_despues: despues,
  }, null, 2));
} catch (error) {
  resultados.push({ nombre: "Error de ejecución", pasa: false, detalle: error.message });
  console.error(error);
} finally {
  await db.$disconnect();
  const fallidos = resultados.filter((r) => !r.pasa);
  writeFileSync(`${carpeta}/api-check-resultados.json`, JSON.stringify({ fecha: new Date().toISOString(), total: resultados.length, fallidos: fallidos.length, resultados }, null, 2));
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} casos OK`);
  if (fallidos.length) process.exitCode = 1;
}
