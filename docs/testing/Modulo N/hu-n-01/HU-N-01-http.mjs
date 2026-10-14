// Recorrido HTTP real contra una base descartable ya migrada y con un Gerente de prueba.
// Requiere DATABASE_URL, HU_N_HTTP_EMAIL y HU_N_HTTP_PASSWORD en el entorno.
import assert from "node:assert/strict";

const base = process.env.HU_N_HTTP_BASE_URL ?? "http://localhost:3101";
const database = new URL(process.env.DATABASE_URL ?? "");
assert.match(database.pathname, /^\/noctium_pruebas_http_n_[a-f0-9]{8}$/);
assert.ok(process.env.HU_N_HTTP_EMAIL && process.env.HU_N_HTTP_PASSWORD);

const cookies = new Map();
async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    ...opciones,
    redirect: "manual",
    headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...opciones.headers },
  });
  for (const linea of respuesta.headers.getSetCookie()) {
    const [nombre, valor] = linea.split(";", 1)[0].split("=", 2);
    cookies.set(nombre, valor);
  }
  const tipo = respuesta.headers.get("content-type") ?? "";
  return { status: respuesta.status, body: tipo.includes("application/json") ? await respuesta.json() : null };
}

const inicial = await solicitar("/api/configuracion");
assert.equal(inicial.status, 401);
const csrf = await solicitar("/api/auth/csrf");
assert.equal(csrf.status, 200);
const login = await solicitar("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    csrfToken: csrf.body.csrfToken,
    email: process.env.HU_N_HTTP_EMAIL,
    password: process.env.HU_N_HTTP_PASSWORD,
    json: "true",
  }),
});
assert.equal(login.status, 302);

const leer = async () => {
  const respuesta = await solicitar("/api/configuracion");
  assert.equal(respuesta.status, 200);
  return Object.fromEntries(respuesta.body.data.parametros.map(({ campo, valor }) => [campo, valor]));
};
const guardar = (valores, esperados) => solicitar("/api/configuracion", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ valores, esperados }),
});
const baseValores = { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 };
assert.deepEqual(await leer(), baseValores);
assert.deepEqual((await guardar(baseValores, baseValores)).body.data.cambios, []);
assert.equal((await solicitar("/api/configuracion/historial")).body.data.total, 0);

for (const valores of [
  { ...baseValores, plazoPagoHoras: 24.5 },
  { ...baseValores, plazoPagoHoras: 0 },
  { ...baseValores, umbralPresentismo: 101 },
  { ...baseValores, ajeno: 1 },
]) assert.equal((await guardar(valores, baseValores)).status, 400);
assert.equal((await guardar({ ...baseValores, plazoPagoHoras: "24" }, baseValores)).status, 400);
assert.equal((await solicitar("/api/configuracion", {
  method: "PUT", headers: { "content-type": "application/json" },
  body: JSON.stringify({ valores: baseValores }),
})).status, 400);
assert.equal((await guardar(baseValores, { ...baseValores, ajeno: 1 })).status, 400);
assert.equal((await solicitar("/api/configuracion/historial?foo=")).status, 400);
assert.equal((await solicitar("/api/configuracion/historial?pagina=0")).status, 400);

const minimo = { plazoPagoHoras: 1, cancelacionAnticipacionHoras: 1, umbralPresentismo: 1 };
const maximo = { plazoPagoHoras: 72, cancelacionAnticipacionHoras: 72, umbralPresentismo: 100 };
assert.equal((await guardar(minimo, baseValores)).status, 200);
assert.deepEqual(await leer(), minimo);
assert.equal((await guardar(maximo, minimo)).status, 200);
assert.deepEqual(await leer(), maximo);

const primerEditor = { ...maximo, plazoPagoHoras: 48 };
assert.equal((await guardar(primerEditor, maximo)).status, 200);
const segundoEditor = { ...maximo, cancelacionAnticipacionHoras: 36, plazoPagoHoras: 36 };
const conflicto = await guardar(segundoEditor, maximo);
assert.equal(conflicto.status, 409);
assert.equal(conflicto.body.error.code, "CONFLICTO_EDICION_CONCURRENTE");
assert.deepEqual(await leer(), primerEditor);

let actual = primerEditor;
for (const plazoPagoHoras of [49, 50, 51, 52, 53, 54, 55, 56]) {
  const siguiente = { ...actual, plazoPagoHoras };
  assert.equal((await guardar(siguiente, actual)).status, 200);
  actual = siguiente;
}
const pagina1 = await solicitar("/api/configuracion/historial?pagina=1");
const pagina2 = await solicitar("/api/configuracion/historial?pagina=2");
assert.equal(pagina1.status, 200);
assert.equal(pagina2.status, 200);
assert.equal(pagina1.body.data.items.length, 10);
assert.equal(pagina2.body.data.items.length, 5);
assert.equal(pagina1.body.data.total, 15);
assert.ok(pagina1.body.data.items.every((fila) => fila.usuario.nombre.includes("Gerente") && fila.fecha && Number.isInteger(fila.valorNuevo)));
assert.deepEqual(await leer(), actual);
console.log("HU-N-01 HTTP: 401, 200, 400, 409, bordes, no-op, rollback e historial 10/15 verificados.");
