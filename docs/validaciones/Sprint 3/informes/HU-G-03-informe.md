# Validación PO — HU-G-03 · Listar gerentes

**Rama revisada:** `develop` @ `1f503e9` (árbol limpio). La HU entró con el commit `f11047e feat(G03): listar gerentes con busqueda, paginacion y marca (vos)`; HU-G-05 ya está mergeada, así que el criterio 4 (desactivar o reactivar desde la ficha) **ya se puede verificar** y deja de ser verificación diferida.
**Fuente de verdad:** el texto de la HU del pedido de validación (no la task). Coincide palabra por palabra con `docs/tasks/Sprint 3/HU-Sprint-3.md` (líneas 707-717).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md` (reglas generales y «Aplicación HU-G-03»), `docs/DESIGN.md` (§6.4, filas de HU-G-01/G-03, historial), `prisma/seed.ts` y las fixtures `hu-g-01.ts`, `hu-g-03.ts`, `hu-g-05.ts`, `docs/specs/spec_modulo_G.md` (§1, §2.3, §2.4, §3.7 y las notas de implementación), `docs/tasks/Sprint 3/Modulo G/HU-G-03.md`, `docs/tasks/Sprint 3/HU-Sprint-3.md` (convenciones 7 a 9, HU-B-05/HU-I-10 c2 para el criterio de búsqueda) y `docs/tasks/Sprint 3/PR-0.md` (documento de developers del Sprint 3: no hay otro en `docs/`).

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `vitest run` de la HU (`src/server/gerentes`, `src/app/(dashboard)/gerentes`, `src/app/api/gerentes`, `src/lib/textos`) | **13 archivos, 330 tests en verde** (2 archivos PG omitidos en esta pasada, sin base) |
| `npm run test:pg -- src/server/gerentes` (base descartable) | **2 archivos, 39/39 en verde** (`gerente.service.pg.test.ts` y `gerente.estado.pg.test.ts`) |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador HU-C-23) | «Claves de textos verificadas.» |
| `vitest run` completo (dos corridas) | **306 archivos en verde, 1 fallo por timeout**: `src/lib/claves-textos.test.ts` («todas las referencias reales tienen texto…») superó su límite de 60 s con la suite completa en paralelo. **Corrido solo: 36/36 en verde (93 s)**. No es de esta HU (es el escaneo de claves de todo el repo). Ver sección 4 |
| Consulta de **solo lectura** a la base de desarrollo (`fichas_gerente`) | 20 fichas: 2 del seed base, 2 de G-01, 12 de G-03 y 4 de G-05 → dos páginas de 10 |

---

## 1. Trazabilidad de criterios

| # | Criterio (viñeta) | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1a | Columnas Apellido, Nombre, DNI, Teléfono, Email y Estado | Servicio `listarGerentes` (`src/server/gerentes/gerente.service.ts:481-527`) devuelve `apellido, nombre, dni, telefono, email, activo`; tabla en `src/app/(dashboard)/gerentes/listado-gerentes.tsx` (cabeceras `ui.gerentes.listado.apellido…estado`, celdas `:147-173`). Teléfono ausente = «—» (`ui.gerentes.valorAusente`, `:99`); Estado = `Badge` «Activo»/«Inactivo» (`:169`) | **CUBIERTO** | Test de pantalla «seis columnas» y «— sin teléfono». Filas inactivas atenuadas (`opacity-60`, `:146`), con el estado siempre en texto |
| 1b | Orden por Apellido y Nombre ascendente | `orderBy` `apellidoNormalizado`, `nombreNormalizado`, `dni` asc (`gerente.service.ts:493-497`) | **CUBIERTO** | Ordena por las columnas normalizadas (sin tildes ni mayúsculas): «Álvarez» queda entre «Acuña» y «Arce», que es lo esperable. El DNI es solo desempate (dos «Prueba Baja», p. ej.) |
| 1c | Paginado de a 10 | `POR_PAGINA_GERENTES = 10` (`gerente.schema.ts:91`), `skip/take` (`service.ts:498-499`); `Pagination` compartido (`listado-gerentes.tsx:179`) con enlaces `/gerentes?q=…&pagina=N` (`src/lib/gerentes-listado.ts`) | **CUBIERTO** | `por_pagina` no se acepta (400). Página fuera de rango → la última; sin resultados → `pagina 1`, `total_paginas 0`. Probado con PostgreSQL |
| 1d | (implícito) incluye activos e inactivos | Sin filtro de estado en el `where` (`service.ts:486`) | **CUBIERTO** | Cumple el «Para: saber quiénes están activos» |
| 2a | Búsqueda por Nombre, Apellido o DNI | `construirFiltroBusquedaGerentes(q)` (`src/server/gerentes/gerente.busqueda.ts`): por palabra, OR entre apellido, nombre y —si es numérica— DNI; AND entre palabras | **CUBIERTO** | Idéntico a `construirFiltroBusquedaAlumno` de HU-B-05 (`src/server/alumnos/alumno.busqueda.ts:14-26`) |
| 2b | Criterio de HU-B-05: desde 2 caracteres, sin distinguir mayúsculas ni acentos, coincidencia parcial | `tokenizarBusqueda` de `src/lib/busqueda-texto.ts` (umbral 2, `normalizarTexto`, máx. 5 palabras); en pantalla `CampoBusqueda` con debounce, vuelve a página 1, `maxLength=100` | **CUBIERTO** | Tests: «alvarez»→Álvarez, «NUNEZ»→Núñez, «ferr»→Ferreyra y Ferrero, DNI parcial, menos de 2 caracteres = listado completo. Misma utilidad que alumnos (no una copia del criterio) |
| 3 | El gerente autenticado aparece como «(vos)» en su fila | Servidor: `esVos = usuarioId !== null && usuarioId === sesionUsuarioId` (`service.ts:520`); ruta pasa `req.auth!.user.id` (`src/app/api/gerentes/route.ts`, GET), página pasa el id de `exigirPermiso` (`page.tsx:25,76`). Pantalla: `span` «(vos)» junto al apellido (`listado-gerentes.tsx:156-160`) | **CUBIERTO** | Lo decide el servidor, el ítem **no** expone `usuarioId`, una ficha sin cuenta nunca es «(vos)». Ojo en la prueba manual: con los datos actuales, **Paredes (gerente@) y Quiroga (gerente2@) están en la página 2** |
| 4a | Cada fila enlaza a la ficha | `Link href=/gerentes/{id}` con `after:absolute after:inset-0` en `tr relative` (`listado-gerentes.tsx:146-155`): toda la fila es clickeable | **CUBIERTO** | Test de pantalla; enlace accesible por teclado (`focus-visible:ring`) |
| 4b | Desde la ficha se accede a modificar (HU-G-01) | `src/app/(dashboard)/gerentes/[id]/page.tsx:112-117`: «Editar» → `/gerentes/{id}/editar`, con `gerentes:editar` | **CUBIERTO** | |
| 4c | Desde la ficha se accede a desactivar o reactivar (HU-G-05) | `[id]/page.tsx:83,118-130`: `EstadoGerenteDialog` («Desactivar» si activa, «Reactivar» si inactiva) con `gerentes:cambiar_estado` | **CUBIERTO** (antes diferido; G-05 ya está en `develop`) | En la **propia** ficha activa no aparece «Desactivar» (regla de HU-G-05 c2), es correcto. La task lo marcó «diferido a G-05»: no es desvío, es la verificación diferida que indica el backlog; hay que hacerla ahora en la prueba manual |
| 5a | Solo accesible para el Gerente | Permiso `gerentes:leer` sembrado solo para GERENTE (`prisma/seed.ts:975`); `withPermission("gerentes:leer")` en `GET /api/gerentes` y `GET /api/gerentes/[id]`; `exigirPermiso("gerentes:leer")` en `/gerentes` y `/gerentes/[id]`; regla `gerentes: ["GERENTE"]` en `rutas-por-rol.ts:46` y `/gerentes/:path*` en el matcher de `src/proxy.ts:72` | **CUBIERTO** | |
| 5b | 403 para otros roles | API: `403 SIN_PERMISO` (JSON) para MESA_ENTRADA, PROFESOR y ALUMNO, `401` sin sesión (tests en `src/app/api/gerentes/route.test.ts:185-191` y `[id]/route.test.ts`). Pantalla: el proxy redirige a `/sin-permiso` | **CUBIERTO** | La **pantalla** no devuelve un HTTP 403 sino una redirección a «Sin permiso» (mismo patrón de todo el sistema); el 403 literal lo da la API, que es la que protege los datos |

**Desvíos de la task respecto de la HU:** ninguno de fondo. Solo:
- La task trató 4c como «verificación diferida». Ya no lo es (G-05 mergeada): queda para la prueba manual.
- La task corrigió su propio error en el subtítulo («nombre, apellido **y** DNI» → «**o** DNI», §9.3.1). El código ya dice «o», igual que la HU.

---

## 2. Textos literales (HU-C-23)

Textos entre comillas en los criterios y su clave en `src/lib/textos.ts`:

| Texto de la HU | Clave | Valor en el código | ¿Coincide? |
|---|---|---|---|
| «(vos)» | `ui.gerentes.listado.vos` | `(vos)` | **Sí** |

Columnas del criterio 1 (no van entre comillas, pero se compararon igual): `ui.gerentes.listado.apellido/nombre/dni/telefono/email/estado` = «Apellido», «Nombre», «DNI», «Teléfono», «Email», «Estado». **Coinciden.** Estado: «Activo» / «Inactivo» (`ui.gerentes.estado.*`).

**No coincidencias palabra por palabra: ninguna.**

Textos que la HU no define (para que el PO los valide):
- `ui.gerentes.listado.sinResultados` = «No se encontraron gerentes para «{q}»» — **propuesto, pendiente de validar por el PO** (P-F6, el mismo patrón que personal).
- `ui.gerentes.listado.subtitulo` = «Buscá por nombre, apellido o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).» (figura 96).
- `buscarPlaceholder` «Ej.: ferreyra, 31222…», `buscarEtiqueta` «Buscar gerente», `buscando` «Buscando gerentes», `cargando` «Cargando gerentes», `error` «No se pudo cargar el listado de gerentes», `reintentar` «Reintentar».

---

## 3. Reglas de servidor

| Regla | Aplica | Verificación |
|---|---|---|
| Validación (Regla N.° 6) | Sí | `ListarGerentesQuerySchema` `.strict()` (`gerente.schema.ts:98-103`): `pagina` entero positivo (def. 1), `q` trim y ≤ 100; cualquier otro parámetro (incl. `por_pagina`) → `400 VALIDATION_ERROR` con `detalles` y mensaje `errores.gerente.datosInvalidos`. Se valida **después** del permiso (un rol sin permiso recibe 403 aunque mande basura) |
| Permisos / 403 (Regla N.° 10) | Sí | Ver criterio 5. El rechazo lo da el servidor, no solo el menú |
| Capa delgada y `{ data, error }` (Reglas N.° 4 y 5) | Sí | La ruta solo valida, llama al servicio y envuelve; errores 500 sin detalle técnico (`errores.gerente.interno`) |
| Transacciones y bloqueos (Regla N.° 7) | **No aplica** | El listado es de solo lectura; no escribe, no bloquea. (Las reglas de bloqueo del módulo están en G-05) |
| Registros nuevos en vez de modificar (Regla N.° 8) | **No aplica** | Sin escrituras. La evidencia de la task (Nivel 3) comprobó que el listado no escribe filas ni eventos |
| Aislamiento entre módulos (Regla N.° 3) | Sí | `gerente.busqueda.ts` y `gerentes-listado.ts` no importan nada de alumnos ni de personal; reutilizan `src/lib/busqueda-texto.ts` (utilidad compartida) |

### Endpoints

| Método | Ruta | Permiso | Respuestas |
|---|---|---|---|
| `GET` | `/api/gerentes?pagina=&q=` | `gerentes:leer` (solo GERENTE) | `200 { items[{id, apellido, nombre, dni, telefono, email, activo, esVos}], pagina, por_pagina, total, total_paginas }` · `400 VALIDATION_ERROR` · `401` · `403 SIN_PERMISO` |
| `GET` | `/api/gerentes/[id]` (ficha, criterio 4) | `gerentes:leer` | `200` · `401` · `403` · `404 GERENTE_NO_ENCONTRADO` |
| (pantalla) | `/gerentes`, `/gerentes/[id]` | `exigirPermiso("gerentes:leer")` + proxy | Otros roles → redirección a `/sin-permiso` |

### Snippets para comprobar el 403

Pegar en la consola del navegador (F12 → Console) **con la sesión iniciada como Mesa de entrada, Profesor o Alumno**, estando en cualquier pantalla de la app (`http://localhost:3000/...`):

```js
// 1) Listado: debe dar 403 SIN_PERMISO
fetch("/api/gerentes").then(async r => console.log(r.status, await r.json()));

// 2) Listado con búsqueda y página: también 403 (el permiso va antes de validar)
fetch("/api/gerentes?pagina=1&q=paredes").then(async r => console.log(r.status, await r.json()));

// 3) Parámetro inválido: sigue siendo 403, no 400 (no revela nada a otro rol)
fetch("/api/gerentes?por_pagina=5").then(async r => console.log(r.status, await r.json()));

// 4) Ficha de un gerente: 403. Reemplazar <ID> por un id real (copiarlo de la URL
//    de una ficha entrando antes como gerente, p. ej. /gerentes/cmxxxx...)
fetch("/api/gerentes/<ID>").then(async r => console.log(r.status, await r.json()));
```

Resultado esperado en todos: `403 { data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" } }`.

Control positivo, **con sesión de Gerente** (para ver «(vos)» en la API y que no viaja `usuarioId`):

```js
fetch("/api/gerentes?pagina=2").then(r => r.json()).then(j => console.table(j.data.items));
fetch("/api/gerentes?por_pagina=5").then(async r => console.log(r.status, await r.json())); // 400 VALIDATION_ERROR
```

Para la pantalla: con Mesa de entrada / Profesor / Alumno, escribir `http://localhost:3000/gerentes` en la barra → debe terminar en `/sin-permiso`.

---

## 4. Definición de Terminado

| Punto | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Cumple** | Toda la pantalla usa `texto("ui.gerentes.…")`; `Pagination` y `CampoBusqueda` (compartidos) también leen `ui.comun.paginacion.*`. `verificar-claves-textos.ts` aprueba |
| Ningún texto visible con «turno» | **Cumple** | Sin «turno» en `page.tsx`, `listado-gerentes.tsx`, `gerentes-listado.ts` ni en las claves `ui.gerentes.*` |
| Confirmación HU-C-25 en toda operación que guarda | **No aplica a esta HU** | El listado no guarda nada. Las operaciones a las que lleva (editar G-01, desactivar/reactivar G-05) usan `ConfirmarAccionDialog` (`[id]/estado-gerente-dialog.tsx:98`) |
| Tests en verde | **Cumple** (HU) | 330 unitarios de la HU + 39 PostgreSQL en verde; comprobador de claves OK. Suite completa: 4096 pasan y 1 falla por **timeout**: `claves-textos.test.ts`, que corrido solo pasa 36/36 en 93 s, contra un límite de 60 s por test. Es una prueba transversal (HU-C-23) que se vuelve lenta con la suite en paralelo, no un fallo de HU-G-03. Conviene avisar al equipo porque en la integración continua puede fallar de forma intermitente |
| Pasan todos sus criterios propios | **Pendiente de prueba manual** | Código y tests cubren los 5 criterios |

**Incumplimientos: ninguno.**

Observación menor (no es de esta HU): el mensaje del `403` de la API («No tenés permisos para acceder a esta sección») está fijo en `src/server/shared/with-permission.ts:28`, no en `textos.ts`. Es previo (PR 0 / Sprint 1-2) y no se ve en la pantalla de gerentes (la pantalla redirige a `/sin-permiso`).

---

## 5. Extras y violaciones

### Implementado sin que la HU lo pida

- **Estado «sin resultados»** con texto propuesto y el enlace «Nuevo gerente» **repetido** debajo del mensaje (además del botón de arriba). Igual que personal. Decisión estética del PO.
- **Aviso de error de carga con «Reintentar»** y spinner si la búsqueda tarda.
- **Subtítulo explicativo** del buscador (viene de la figura 96).
- **Filas inactivas atenuadas** (`opacity-60`).
- **Búsqueda sin recargar** con actualización de la URL (`replaceState`) y paginador que conserva `q`.
- **Fixture `hu-g-03.ts`**: 12 fichas de gerente **sin cuenta** (DNI 88065001-88065012, 3 inactivas) para probar paginación y búsqueda.

### Violaciones / puntos a mirar respecto de RULES.md / DESIGN.md

- **Fichas de gerente sin cuenta (fixture).** La spec G §3.1 y la convención 8 (h) del backlog dicen que ficha y cuenta son una unidad. La fixture crea 12 fichas con `usuarioId` nulo, como excepción documentada para datos de prueba (igual que F-03). No rompe la HU, pero en la ficha se ven como «Sin cuenta» y entran en el bloqueo de G-05 sin contar como «gerente activo». **Aceptable como dato de prueba**; el PO puede pedir que se diga explícitamente en la demo.
- **Historial de `DESIGN.md` sin fecha** en la entrada de HU-G-03 (desvío 9.3.2 de la task, decidido por el responsable). Cosmético; ningún test depende de eso.
- **Diferencias con el prototipo (figura 96) aceptadas en la task:** encabezados con mayúscula inicial (no MAYÚSCULAS), DNI y teléfono sin tipografía monoespaciada, menú desplegable «Gerentes → Listado» en vez de ítem plano. Siguen el patrón aprobado de personal (F-03); el backlog prevalece sobre el prototipo y no pide nada de eso.
- **Mensajes de Zod en inglés** en el `400` de la API para `pagina`/`q` (solo API, no visibles en pantalla: el campo tiene `maxLength=100` y la página ignora valores inválidos). Deuda ya registrada en F-03.
- **Duplicación de código** con personal (`gerente.busqueda.ts`, `gerentes-listado.ts`, `listado-gerentes.tsx`): deuda técnica registrada, no viola reglas.

No se encontraron violaciones de reglas de RULES.md (sin `DELETE`, sin escrituras, Zod previo, permiso en servidor, contrato `{ data, error }`, estructura Regla N.° 11) ni de DESIGN.md (tokens de shadcn/Tailwind, sin colores hexadecimales; estado con texto y no solo color).

---

## 6. Datos para la prueba manual

Contraseña de todas las cuentas del seed y de las fixtures con sesión: **`Password123!`**.

| Usuario | Rol | Para qué sirve |
|---|---|---|
| `gerente@noctium.local` (Silvia **Paredes**, DNI 24100001) | GERENTE | Criterios 1 a 4. Su «(vos)» está en la **página 2**, posición 11 |
| `gerente2@noctium.local` (Roberto **Quiroga**, DNI 24100002) | GERENTE | Criterio 3: al entrar con esta cuenta, «(vos)» pasa a la fila de Quiroga (también página 2) y Paredes deja de tenerlo |
| `g05.operaciones@noctium.local` (Renata **Prueba Baja**, DNI 88066002) | GERENTE (contraseña ya cambiada) | Tercer gerente con sesión: «(vos)» en su fila (página 2) |
| `mesa.entrada@noctium.local` | MESA_ENTRADA | Criterio 5: 403 / `/sin-permiso` |
| `profesor1@noctium.local` | PROFESOR | Criterio 5 |
| `alumno01@noctium.local` | ALUMNO | Criterio 5 |

**No usar** `g01.activo@noctium.local` ni `g05.sinoperaciones@noctium.local`: nacen con «debe cambiar la contraseña» y entrar con ellas obliga a cambiarla (modifica datos de prueba de G-01/G-05).

**Base de desarrollo actual (20 fichas, orden real del listado):**

| Página 1 | Página 2 |
|---|---|
| Acuña · Álvarez · Arce · Báez (inactiva) · Ferrero (inactiva) · Ferreyra · Gutiérrez · Molina · Núñez · Ordóñez (inactiva) | **Paredes** · Prueba Baja Bruno (sin cuenta) · Prueba Baja Camila (inactiva) · Prueba Baja Lucas · Prueba Baja Renata · Prueba Gerente Tomás · Prueba Gerente Valeria (inactiva) · **Quiroga** · Rodríguez · Toledo |

**Casos por criterio:**

| Criterio | Cómo probarlo |
|---|---|
| 1 | Entrar como `gerente@` → menú «Gerentes → Listado». Ver 6 columnas, orden de la tabla de arriba, 10 filas y paginador «Página 1 de 2». Teléfono vacío = «—» (p. ej. Arce, Quiroga). Inactivos con etiqueta «Inactivo» |
| 2 | Buscar: `alvarez` (→ Álvarez), `NUNEZ` (→ Núñez), `ferr` (→ Ferreyra y Ferrero), `andres` (→ Molina Andrés, por nombre), `88065` (→ las 12 de la fixture, 2 páginas: 10+2), `24100001` (→ Paredes), `prueba baja` (→ 4, AND entre palabras), `a` (1 carácter: listado completo), `zzzz` (→ «No se encontraron gerentes para «zzzz»») |
| 3 | En página 2, «Paredes (vos)». Cerrar sesión, entrar como `gerente2@` → «Quiroga (vos)» y Paredes sin marca. Buscar `paredes` como `gerente2@`: Paredes sin «(vos)» |
| 4 | Click en cualquier parte de una fila → ficha. En la ficha de **otro** gerente activo (p. ej. Prueba Gerente Tomás): «Editar» y «Desactivar». En una **inactiva** (Prueba Gerente Valeria o Prueba Baja Camila): «Editar» y «Reactivar». En la **propia** ficha: solo «Editar» (no «Desactivar»). Basta con abrir el diálogo y **Cancelar** para no cambiar datos |
| 5 | Con `mesa.entrada@`, `profesor1@`, `alumno01@`: el menú no muestra «Gerentes»; `http://localhost:3000/gerentes` → `/sin-permiso`; snippets de la sección 3 → `403` |

**Datos que faltan:** ninguno. Si la base no tiene las 20 fichas (o quedó modificada por pruebas anteriores, p. ej. 24100001 con `version` 2 según la task), regenerarla sin tocar código:

```bash
npx prisma migrate reset --force   # borra la base de desarrollo y corre el seed con todas las fixtures
```

Para revisar sin la interfaz: `npx prisma studio` → tabla `FichaGerente` (contar filas y ver `activoFichaGerente`/`usuarioId`). No se necesita ningún script adicional.

---

## 7. Veredicto preliminar

### **Lista para prueba manual**

**Bloqueantes: ninguno.**

Para cerrar en la prueba manual / decisión del PO (no bloquean):
1. **Verificar el criterio 4 completo** (Editar, Desactivar, Reactivar desde la ficha): la task lo dejó como diferido y G-05 ya está en `develop`.
2. **Validar el texto propuesto** «No se encontraron gerentes para «{q}»» (`ui.gerentes.listado.sinResultados`).
3. Tener en cuenta que, con los datos actuales, **las filas «(vos)» de las cuentas del seed están en la página 2**.
4. Aceptar o no las diferencias cosméticas con la figura 96 (encabezados, tipografía, menú desplegable) y el «Nuevo gerente» repetido en «sin resultados».
5. Avisar al equipo que `claves-textos.test.ts` puede fallar por timeout cuando corre la suite completa (transversal, no es de esta HU).
