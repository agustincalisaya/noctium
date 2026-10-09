import ts from "typescript";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

export interface DiagnosticoTexto { archivo: string; linea: number; mensaje: string }
export interface OpcionesClaves {
  raiz?: string;
  /** Fuentes virtuales para probar el mismo comprobador sin modificar el proyecto. */
  fuentes?: Record<string, string>;
}

/** Comprobación del proyecto con la API y resolución de símbolos de TypeScript. */
export function verificarClavesTextos(opciones: OpcionesClaves = {}): DiagnosticoTexto[] {
  const raiz = resolve(opciones.raiz ?? process.cwd());
  const config = ts.readConfigFile(resolve(raiz, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, raiz);
  const virtuales = new Map(Object.entries(opciones.fuentes ?? {}).map(([ruta, contenido]) => [resolve(raiz, ruta), contenido]));
  const host = ts.createCompilerHost(parsed.options);
  const leer = host.readFile.bind(host);
  host.readFile = (ruta) => virtuales.get(resolve(ruta)) ?? leer(ruta);
  const existe = host.fileExists.bind(host);
  host.fileExists = (ruta) => virtuales.has(resolve(ruta)) || existe(ruta);
  const roots = parsed.fileNames.filter((ruta) => resolve(ruta).startsWith(resolve(raiz, "src")));
  const program = ts.createProgram([...roots, ...virtuales.keys()], parsed.options, host);
  const checker = program.getTypeChecker();
  const catalogo = program.getSourceFile(resolve(raiz, "src/lib/textos.ts"));
  if (!catalogo) throw new Error("No se encontró src/lib/textos.ts");
  const archivos = program.getSourceFiles().filter((f) => !f.isDeclarationFile && (roots.includes(f.fileName) || virtuales.has(resolve(f.fileName))));
  const nodos: ts.Node[] = [];
  const recorrer = (n: ts.Node) => { nodos.push(n); ts.forEachChild(n, recorrer); };
  archivos.forEach(recorrer);
  const simbolo = (n: ts.Node): ts.Symbol | undefined => {
    // `{ t }` nombra la propiedad; el valor que escapa es el símbolo abreviado.
    let s = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n
      ? checker.getShorthandAssignmentValueSymbol(n.parent)
      : checker.getSymbolAtLocation(n);
    if (s && s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    return s;
  };
  const exportado = (archivo: ts.SourceFile | undefined, nombre: string) => {
    const modulo = archivo && checker.getSymbolAtLocation(archivo);
    return modulo && checker.getExportsOfModule(modulo).find((s) => s.name === nombre);
  };
  const textos = exportado(catalogo, "TEXTOS");
  const funcionTexto = exportado(catalogo, "texto");
  const dominio = program.getSourceFile(resolve(raiz, "src/server/shared/error-dominio.ts"));
  const errorDominio = exportado(dominio, "ErrorDeDominio");
  const esError = exportado(dominio, "esErrorDeDominio");
  const errores = exportado(program.getSourceFile(resolve(raiz, "src/server/shared/errores-dominio.ts")), "ERRORES_DE_DOMINIO");
  const desenvolver = (n: ts.Expression): ts.Expression => ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) ? desenvolver(n.expression) : n;
  const inicializador = (s: ts.Symbol | undefined) => s?.valueDeclaration && ts.isVariableDeclaration(s.valueDeclaration) ? s.valueDeclaration.initializer : undefined;
  const identidad = (n: ts.Expression, vistos = new Set<ts.Symbol>()): ts.Symbol | undefined => {
    n = desenvolver(n);
    const s = simbolo(n);
    if (s === textos || s === funcionTexto || s === errorDominio || s === esError) return s;
    if (!s || vistos.has(s)) return s;
    vistos.add(s);
    const init = inicializador(s);
    return init ? identidad(init, vistos) : s;
  };
  // Escrituras sobre variables, parámetros o mapas invalidan la prueba basada
  // en su inicializador. Los alias directos comparten la raíz del mismo mapa.
  const raizReferencia = (expr: ts.Expression, vistos = new Set<ts.Symbol>()): ts.Symbol | undefined => {
    const n = desenvolver(expr);
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) return raizReferencia(n.operand, vistos);
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) return raizReferencia(n.expression, vistos);
    const s = simbolo(n);
    if (!s || vistos.has(s)) return s;
    vistos.add(s);
    const init = inicializador(s);
    return init && ts.isIdentifier(desenvolver(init)) ? raizReferencia(init, vistos) : s;
  };
  const bindingsEscritos = new Set<ts.Symbol>();
  const objetosEscritos = new Set<ts.Symbol>();
  const registrarEscritura = (expr: ts.Expression, objeto = false) => {
    const n = desenvolver(expr);
    if (objeto || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      const raiz = raizReferencia(n);
      if (raiz) objetosEscritos.add(raiz);
    } else {
      const s = simbolo(n);
      if (s) bindingsEscritos.add(s);
    }
  };
  // Métodos globales que escriben propiedades de su primer argumento.
  const escriturasGlobales = new Map([
    ["Object", new Set(["assign", "defineProperty", "defineProperties"])],
    ["Reflect", new Set(["set", "defineProperty"])],
  ]);
  const esDeLibreria = (n: ts.Node) => simbolo(n)?.declarations?.some((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()));
  for (const n of nodos) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) registrarEscritura(n.left);
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) registrarEscritura(n.operand);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)
      && escriturasGlobales.get(n.expression.expression.text)?.has(n.expression.name.text)
      && esDeLibreria(n.expression.expression) && n.arguments[0]) registrarEscritura(n.arguments[0], true);
  }
  const bindingEscrito = (expr: ts.Expression, vistos = new Set<ts.Symbol>()): boolean => {
    const n = desenvolver(expr);
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) return bindingEscrito(n.operand, vistos);
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) return bindingEscrito(n.expression, vistos);
    const s = simbolo(n);
    if (!s || vistos.has(s)) return false;
    if (bindingsEscritos.has(s)) return true;
    vistos.add(s);
    const init = inicializador(s);
    return !!init && ts.isIdentifier(desenvolver(init)) && bindingEscrito(init, vistos);
  };
  const claves = new Set(checker.getTypeOfSymbolAtLocation(textos!, catalogo).getProperties().map((s) => s.name));
  const diagnosticos: DiagnosticoTexto[] = [];
  const reportar = (n: ts.Node, mensaje: string) => {
    const f = n.getSourceFile();
    diagnosticos.push({ archivo: relative(raiz, f.fileName).replaceAll("\\", "/"), linea: f.getLineAndCharacterOfPosition(n.getStart()).line + 1, mensaje });
  };
  const unir = (partes: (string[] | undefined)[]): string[] | undefined => partes.every((p) => p !== undefined) ? [...new Set(partes.flat() as string[])] : undefined;
  const esExportada = (n: ts.Node): boolean => {
    if (ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return true;
    return ts.isArrowFunction(n) && ts.isVariableDeclaration(n.parent) && ts.isVariableDeclarationList(n.parent.parent)
      ? esExportada(n.parent.parent.parent) : false;
  };
  const finitas = (expr: ts.Expression, vistos = new Set<ts.Symbol>()): string[] | undefined => {
    const n = desenvolver(expr); // El cast nunca reemplaza la expresión real.
    const raiz = raizReferencia(n);
    if (bindingEscrito(n) || (raiz && objetosEscritos.has(raiz))) return undefined;
    if (ts.isStringLiteralLike(n)) return [n.text];
    if (ts.isConditionalExpression(n)) return unir([finitas(n.whenTrue, new Set(vistos)), finitas(n.whenFalse, new Set(vistos))]);
    const s = simbolo(n);
    if (s && !vistos.has(s)) {
      vistos.add(s);
      const init = inicializador(s);
      if (init) return finitas(init, vistos);
      const decl = s.valueDeclaration;
      if (decl && ts.isParameter(decl)) {
        const fn = decl.parent;
        // El constructor central reenvía un catálogo finito, comprobado abajo.
        if (ts.isConstructorDeclaration(fn) && fn.getSourceFile() === dominio) {
          const tipo = checker.getTypeAtLocation(n);
          return tipo.isUnion() && tipo.types.every((t) => t.isStringLiteral()) ? tipo.types.map((t) => (t as ts.StringLiteralType).value) : undefined;
        }
        const nombre = ts.isFunctionDeclaration(fn) ? fn.name : ts.isArrowFunction(fn) && ts.isVariableDeclaration(fn.parent) ? fn.parent.name : undefined;
        if (nombre && !esExportada(fn)) {
          const fs = simbolo(nombre);
          const refs = nodos.filter((x) => ts.isIdentifier(x) && x !== nombre && simbolo(x) === fs);
          const llamadas = refs.filter((x) => ts.isCallExpression(x.parent) && x.parent.expression === x).map((x) => x.parent as ts.CallExpression);
          if (refs.length && refs.length === llamadas.length) return unir(llamadas.map((c) => c.arguments[fn.parameters.indexOf(decl)] ? finitas(c.arguments[fn.parameters.indexOf(decl)], new Set(vistos)) : undefined));
        }
      }
      // Forwarding de error.codigo: únicamente la propiedad del ErrorDeDominio real.
      if (decl && ts.isPropertyDeclaration(decl) && decl.getSourceFile() === dominio && decl.name.getText() === "codigo") {
        const tipo = checker.getTypeAtLocation(n);
        if (tipo.isUnion() && tipo.types.every((t) => t.isStringLiteral())) return tipo.types.map((t) => (t as ts.StringLiteralType).value);
      }
    }
    if (ts.isElementAccessExpression(n) || ts.isPropertyAccessExpression(n)) {
      if (ts.isElementAccessExpression(n)) {
        const indice = raizReferencia(n.argumentExpression);
        if (bindingEscrito(n.argumentExpression) || (indice && objetosEscritos.has(indice))) return undefined;
      }
      const init = inicializador(raizReferencia(n.expression));
      const objeto = init && desenvolver(init);
      if (objeto && ts.isObjectLiteralExpression(objeto)) return unir(objeto.properties.map((p) => ts.isPropertyAssignment(p) ? finitas(p.initializer, new Set(vistos)) : undefined));
    }
    return undefined;
  };
  const comprobar = (n: ts.Expression) => {
    const valores = finitas(n);
    if (!valores?.length) reportar(n, "Referencia de texto indeterminada: no se pudo demostrar un conjunto finito de claves.");
    else valores.forEach((c) => { if (!claves.has(c)) reportar(n, `Clave de texto ausente: ${c}`); });
  };
  for (const n of nodos) {
    if ((ts.isCallExpression(n) || ts.isNewExpression(n)) && n.arguments) {
      const id = identidad(n.expression);
      const indice = id === esError ? 1 : id === funcionTexto || id === errorDominio ? 0 : -1;
      if (indice >= 0 && n.arguments[indice]) comprobar(n.arguments[indice]);
    }
    if ((ts.isElementAccessExpression(n) || ts.isPropertyAccessExpression(n)) && identidad(n.expression) === textos && n.getSourceFile() !== catalogo) {
      if (ts.isElementAccessExpression(n)) comprobar(n.argumentExpression);
      else if (!claves.has(n.name.text)) reportar(n, `Clave de texto ausente: ${n.name.text}`);
    }
    // Una función/catálogo que escapa a estos usos no queda silenciosamente fuera.
    if (ts.isIdentifier(n) && n.getSourceFile() !== catalogo && n.getSourceFile() !== dominio) {
      const id = identidad(n);
      if (id === textos || id === funcionTexto || id === errorDominio || id === esError) {
        const p = n.parent;
        const permitido = ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isTypeQueryNode(p) || ts.isTypeReferenceNode(p)
          || ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.expression === n)
          || (id === textos && (ts.isElementAccessExpression(p) || ts.isPropertyAccessExpression(p)) && p.expression === n)
          || (ts.isVariableDeclaration(p) && (p.name === n || (p.initializer === n && !esExportada(p.parent.parent))))
          || (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && p.right === n);
        if (!permitido) reportar(n, "Referencia de texto indeterminada: el símbolo central escapa a los usos comprobables.");
      }
    }
  }
  if (errores?.valueDeclaration) {
    checker.getTypeOfSymbolAtLocation(errores, errores.valueDeclaration).getProperties().forEach((s) => {
      if (!claves.has(s.name)) reportar(s.valueDeclaration ?? errores.valueDeclaration!, `Clave de texto ausente: ${s.name}`);
    });
  }
  return diagnosticos;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const diagnosticos = verificarClavesTextos();
  diagnosticos.forEach((d) => console.error(`${d.archivo}:${d.linea}: ${d.mensaje}`));
  if (diagnosticos.length) process.exitCode = 1;
  else console.log("Claves de textos verificadas.");
}
