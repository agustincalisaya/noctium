import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { verificarClavesTextos } from "../../scripts/verificar-claves-textos";

// El análisis recorre todo el proyecto con el compilador de TypeScript y cada
// HU suma claves y archivos: con 30 s ya rozaba el límite (~31 s en local).
const LIMITE_MS = 60_000;

/** Las reproducciones de auditoría deben ser código tipado válido. */
function comprobarTiposFixture(ruta: string, contenido: string) {
  const absoluta = resolve(ruta);
  const config = ts.readConfigFile(resolve("tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const host = ts.createCompilerHost(parsed.options);
  const leer = host.readFile.bind(host);
  host.readFile = (archivo) => resolve(archivo) === absoluta ? contenido : leer(archivo);
  const program = ts.createProgram([absoluta], parsed.options, host);
  const fuente = program.getSourceFile(absoluta)!;
  expect([...program.getSyntacticDiagnostics(fuente), ...program.getSemanticDiagnostics(fuente)].map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
}

describe("claves del proyecto (misma comprobación que CLI/PR)", () => {
  it("todas las referencias reales tienen texto, incluidos errores y wrappers", () => {
    expect(verificarClavesTextos()).toEqual([]);
  }, LIMITE_MS);
  it("detecta los negativos sin confiar en casts ni símbolos homónimos", () => {
    const fuentes = {
      "src/__claves_fixture.ts": `
import { texto as t, TEXTOS as catalogo, type ClaveTexto } from "@/lib/textos";
import { ErrorDeDominio as ED } from "@/server/shared/error-dominio";
function tipoSolamente(): ED { return new ED("errores.turno.noEncontrado"); }
tipoSolamente();
const alias = t;
alias("ui.ausente.alias" as ClaveTexto);
t(Math.random() ? "ui.comun.paginacion.nombre" : "ui.ausente.ternaria" as ClaveTexto);
const mapa = { bien: "ui.comun.paginacion.nombre", mal: "ui.ausente.mapa" } as const;
t(mapa[Math.random() ? "bien" : "mal"] as ClaveTexto);
const tabla = catalogo;
tabla["ui.ausente.tabla" as ClaveTexto];
const cerrado = (clave: ClaveTexto) => t(clave);
cerrado("ui.ausente.wrapper" as ClaveTexto);
new ED("ui.ausente.dominio" as never);
t("ui.ausente.cast" as unknown as ClaveTexto);
declare const desconocida: string;
t(desconocida as ClaveTexto);
export const abierto = (clave: ClaveTexto) => t(clave);
["ui.comun.paginacion.nombre"].map(t);
function ajena() { const texto = (s: string) => s; texto("ui.ausente.homonimo"); }
ajena();
`,
    };
    const resultado = verificarClavesTextos({ fuentes });
    for (const caso of ["alias", "ternaria", "mapa", "tabla", "wrapper", "dominio", "cast"]) {
      expect(resultado.some((d) => d.mensaje.includes(`ui.ausente.${caso}`)), caso).toBe(true);
    }
    const fixture = fuentes["src/__claves_fixture.ts"].split("\n");
    for (const referencia of ["t(desconocida as", "export const abierto", '["ui.comun.paginacion.nombre"].map']) {
      const linea = fixture.findIndex((l) => l.includes(referencia)) + 1;
      expect(resultado.some((d) => d.archivo === "src/__claves_fixture.ts" && d.linea === linea && d.mensaje.includes("indeterminada")), referencia).toBe(true);
    }
    const lineaTipo = fixture.findIndex((l) => l.includes("function tipoSolamente")) + 1;
    expect(resultado.some((d) => d.linea === lineaTipo)).toBe(false);
    expect(resultado.every((d) => d.archivo && d.linea > 0)).toBe(true);
    expect(resultado.some((d) => d.mensaje.includes("homonimo"))).toBe(false);
  }, LIMITE_MS);
  it("eliminar una clave usada rompe la misma comprobación", () => {
    const catalogo = readFileSync(resolve("src/lib/textos.ts"), "utf8");
    const sinClave = catalogo.replace(/^  "ui\.comun\.paginacion\.nombre":.*\r?\n/m, "");
    expect(sinClave).not.toBe(catalogo);
    const resultado = verificarClavesTextos({ fuentes: { "src/lib/textos.ts": sinClave } });
    expect(resultado).toContainEqual(expect.objectContaining({ archivo: "src/components/shared/pagination.tsx", mensaje: "Clave de texto ausente: ui.comun.paginacion.nombre" }));
  }, LIMITE_MS);
  describe("escrituras sobre conjuntos finitos", () => {
    const ruta = "src/__claves_escrituras.ts";
    const casos = {
      variable: `{ let clave: ClaveTexto = valida; clave = ausente; t(clave); }`,
      parametro: `{ const cerrado = (clave: ClaveTexto) => { clave = ausente; t(clave); }; cerrado(valida); }`,
      propiedad: `{ const mapa: { a: ClaveTexto } = { a: valida }; mapa.a = ausente; t(mapa.a); }`,
      elemento: `{ const mapa: { b: ClaveTexto } = { b: valida }; mapa["b"] = ausente; t(mapa["b"]); }`,
      assign: `{ const mapa: { a: ClaveTexto } = { a: valida }; Object.assign(mapa, { a: ausente }); t(mapa.a); }`,
      alias: `{ const mapa: { a: ClaveTexto } = { a: valida }; const alias = mapa; alias.a = ausente; t(mapa.a); }`,
      aliasLeido: `{ const mapa: { a: ClaveTexto } = { a: valida }; const alias = mapa; mapa.a = ausente; t(alias.a); }`,
      compuesta: `{ let clave: string = valida; clave += ".ausente"; t(clave as ClaveTexto); }`,
      incremento: `{ const mapa: Record<number, ClaveTexto> = { 0: valida }; let indice = 0; indice++; t(mapa[indice]); }`,
      decremento: `{ const mapa: Record<number, ClaveTexto> = { 0: valida }; let indice = 0; --indice; t(mapa[indice]); }`,
      incrementoInline: `{ const mapa: Record<number, ClaveTexto> = { 0: valida }; let indice = 0; t(mapa[indice++]); }`,
      decrementoInline: `{ const mapa: Record<number, ClaveTexto> = { 0: valida }; let indice = 0; t(mapa[--indice]); }`,
      defineProperty: `{ const mapa: { a: ClaveTexto } = { a: valida }; Object.defineProperty(mapa, "a", { value: "ui.ausente.escritura" }); t(mapa.a); }`,
      defineProperties: `{ const mapa: { a: ClaveTexto } = { a: valida }; Object.defineProperties(mapa, { a: { value: "ui.ausente.escritura" } }); t(mapa.a); }`,
      reflectSet: `{ const mapa: { a: ClaveTexto } = { a: valida }; Reflect.set(mapa, "a", "ui.ausente.escritura"); t(mapa.a); }`,
      reflectDefineProperty: `{ const mapa: { a: ClaveTexto } = { a: valida }; Reflect.defineProperty(mapa, "a", { value: "ui.ausente.escritura" }); t(mapa.a); }`,
    };
    const contenido = `import { texto as t, type ClaveTexto } from "@/lib/textos";
const valida = "ui.comun.paginacion.nombre";
const ausente = "ui.ausente.escritura" as ClaveTexto;
${Object.values(casos).join("\n")}
t(valida);
{ const otroMapa: { a: ClaveTexto } = { a: valida }; t(otroMapa.a); }
`;
    let resultado: ReturnType<typeof verificarClavesTextos>;
    beforeAll(() => {
      comprobarTiposFixture(ruta, contenido);
      resultado = verificarClavesTextos({ fuentes: { [ruta]: contenido } });
    }, LIMITE_MS);
    it.each(Object.keys(casos).map((caso, i) => [caso, i + 4] as const))("diagnostica %s", (caso, linea) => {
      expect(resultado.some((d) => d.archivo === ruta && d.linea === linea && d.mensaje.includes("indeterminada")), caso).toBe(true);
    });
    it("reasignar la copia escalar no invalida el original ni otro mapa", () => {
      expect(resultado.filter((d) => d.archivo === ruta && d.linea > Object.keys(casos).length + 3)).toEqual([]);
    });
  });
  describe("escapes y usos directos de símbolos centrales", () => {
    const ruta = "src/__claves_escapes.ts";
    const casos = [
      `t.call(undefined, ausente);`,
      `t.apply(undefined, [ausente]);`,
      `t.bind(undefined, ausente)();`,
      `ED.call(undefined, ausente);`,
      `ED.apply(undefined, [ausente]);`,
      `ED.bind(undefined, ausente);`,
      `esError.call(undefined, null, ausente);`,
      `esError.apply(undefined, [null, ausente]);`,
      `esError.bind(undefined, null, ausente)();`,
      `ED.prototype.constructor.call(undefined, ausente);`,
      `const alias = t; alias.call(undefined, ausente);`,
      `const AliasED = ED; AliasED.prototype.constructor.call(undefined, ausente);`,
      `const aliasGuard = esError; aliasGuard.apply(undefined, [null, ausente]);`,
      `const envuelto = { t }; envuelto.t(ausente);`,
      `const constructores = { ED }; new constructores.ED(ausente);`,
    ];
    const contenido = `import { texto as t, TEXTOS, type ClaveTexto } from "@/lib/textos";
import { ErrorDeDominio as ED, esErrorDeDominio as esError } from "@/server/shared/error-dominio";
import type { CodigoErrorDominio } from "@/server/shared/errores-dominio";
const ausente = "errores.ausente" as CodigoErrorDominio;
${casos.join("\n")}
const directo = t; directo("ui.comun.paginacion.nombre");
const catalogo = TEXTOS; catalogo["ui.comun.paginacion.nombre"];
const mapa = { a: "ui.comun.paginacion.nombre" as const }; const aliasMapa = mapa; t(aliasMapa.a);
function wrapper(clave: ClaveTexto) { return t(clave); } wrapper("ui.comun.paginacion.nombre");
function errorTipado(): ED { const error = new ED("errores.turno.noEncontrado"); if (error instanceof ED) esError(error, "errores.turno.noEncontrado"); return error; } errorTipado();
`;
    let resultado: ReturnType<typeof verificarClavesTextos>;
    beforeAll(() => {
      comprobarTiposFixture(ruta, contenido);
      resultado = verificarClavesTextos({ fuentes: { [ruta]: contenido } });
    }, LIMITE_MS);
    it.each(casos.map((caso, i) => [caso, i + 5] as const))("diagnostica %s", (caso, linea) => {
      expect(resultado.some((d) => d.archivo === ruta && d.linea === linea && d.mensaje.includes("indeterminada")), caso).toBe(true);
    });
    it("conserva llamadas, catálogo, mapas, alias, tipos e instanceof", () => {
      expect(resultado.filter((d) => d.archivo === ruta && d.linea > casos.length + 4)).toEqual([]);
    });
  });
});
