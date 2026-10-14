# Informe de validación — HU-I-05 · Consultar propio historial de pagos

**Fecha:** 14/10/2026 · **Validó:** asistente del PO (revisión estática del código, tests existentes y consultas de solo lectura a la base de desarrollo `noctium_dev`)
**Código revisado:** `develop` en `030e0e7` (la HU entró con `02e203b HU-I-05: Frontend + Backend + Testing Completos` y `2cd093f` de documentación). Working tree limpio.
**Fuente de verdad:** el texto de la HU que pasó el PO. Coincide palabra por palabra con `docs/tasks/Sprint 3/HU-Sprint-3.md` §HU-I-05.
**Task:** `docs/tasks/Sprint 3/Modulo I/HU-I-05.md` · **Contrato:** `docs/specs/spec_modulo_I.md` §2.15 (y §2.9.3 para el comprobante propio de HU-I-11).

---

## 0. Resumen

La HU está implementada completa. Hay dos GET propios con `pagos:leer_propios` y el alumno se resuelve siempre desde la sesión. La pantalla `/mis-pagos` tiene filtros Desde/Hasta/Materia que se combinan, el total sale con `Decimal` sobre todo el resultado filtrado y la paginación es fija de a 10. Los anulados llevan la etiqueta «Anulado» y no suman al total. La respuesta se arma con una lista cerrada de campos (no incluye quién registró el pago, el precio, el motivo ni la caja). Cada fila enlaza al comprobante propio de HU-I-11 (`/mis-pagos/{pago_id}/comprobante`), con «Imprimir» (`window.print()`) y sin el motivo de la anulación.

Los tests dirigidos pasan (15 archivos, 206/206). `tsc` no da errores, ESLint de los archivos de la HU no da errores (queda una advertencia que ya existía) y el verificador de claves de textos da OK.

**Un DESVÍO que tiene que decidir el PO:** el criterio 4 dice que *cualquier* intento de consultar pagos de otro alumno se rechaza con **403**. Si el alumno manda `GET /api/mis-pagos?alumno_id=<otro>`, el servidor responde **400 `VALIDACION`**. La spec §2.15 y la task (§0.4.1) lo decidieron así a propósito, y los tests lo exigen. No se filtra ningún dato: el 403 aparece en los otros caminos (endpoints administrativos y comprobante ajeno). Además hay observaciones menores en §5.2.

Los datos del seed **no traen pagos anulados ni alumnos con cuenta y sin pagos**. Para probar los criterios 1, 5 y 7 hay que prepararlos desde la pantalla (§6.3).

---

## 1. Tabla de trazabilidad

| Capa | Archivo |
|---|---|
| API listado | `src/app/api/mis-pagos/route.ts` (`GET`, `withPermission("pagos:leer_propios")`, `Cache-Control: no-store`) |
| API opciones | `src/app/api/mis-pagos/opciones/route.ts` (`GET`, ídem) |
| API comprobante propio (HU-I-11, ya existía) | `src/app/api/mis-pagos/[id]/comprobante/route.ts` (`GET`, `comprobantes:leer_propios`) |
| Validación | `src/server/pagos/pago.schema.ts` → `MisPagosQuerySchema` (`.strict()`, fechas calendario, `desde ≤ hasta`, `pagina` entera positiva), `OpcionesMisPagosQuerySchema` (`z.object({}).strict()`) |
| Servicio | `src/server/pagos/pago.service.ts` → `listarMisPagos`, `obtenerOpcionesMisPagos`, `alumnoDeSesion` (privada); helpers compartidos con I-02: `pagosConClase`, `totalNoAnulados`, `paginarHistorial`, `ordenarNombre` |
| Lecturas reutilizadas | `listarPagosDeAlumno` (`pago.publico.ts`, I), `obtenerAlumnoDeUsuario` (fachada B), `obtenerClasesBasicas` (fachada C) |
| Páginas | `src/app/(dashboard)/mis-pagos/page.tsx` (`exigirPermiso("pagos:leer_propios")`); `mis-pagos/[id]/comprobante/page.tsx` (HU-I-11, `comprobantes:leer_propios`) |
| Componentes | `mis-pagos/mis-pagos.tsx` (filtros, URL, carga/error/vacíos, paginación), `mis-pagos/tabla-mis-pagos.tsx` (filas), `src/components/pagos/comprobante-card.tsx` (HU-I-11) |
| Utilidades | `src/lib/mis-pagos-listado.ts` (normalización de la URL y query) |
| Tipos | `src/types/pago.types.ts` → `MisPagoItem`, `MisPagosData`, `OpcionesMisPagos` |
| Textos | `src/lib/textos.ts:1942-1965` (`ui.pagos.propios.*`) + `ui.pagos.historial.sinFiltros`, `ui.pagos.correccion.anulado`, `ui.comprobantes.*` |
| Menú | `src/components/layout/Sidebar.tsx:204-205` («Mis pagos» en Mi cuenta del ALUMNO); `rutas-por-rol.ts:27` y `proxy.ts:76` ya lo tenían |

### Criterio 1 — Pantalla «Mis pagos», columnas y anulados

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Pantalla «Mis pagos» | `mis-pagos/page.tsx` + título `ui.pagos.propios.titulo`; menú `Sidebar.tsx:205` | CUBIERTO | El enlace se marca activo también en el comprobante (test `Sidebar.mis-pagos.test.tsx`) |
| Pagos con el alumno autenticado como **pagador** | `listarMisPagos` → `alumnoDeSesion(usuarioId)` → `listarPagosDeAlumno(alumno.id)` (operaciones cuyo `alumnoId` es el pagador) | CUBIERTO | Incluye pagos de clases canceladas, quitadas o pasadas (es un listado financiero histórico) |
| Fecha de pago | `tabla-mis-pagos.tsx:30` → `fechaCorta(fecha_pago)` (dd/mm/aaaa) | CUBIERTO | Fecha **vigente** (aplica correcciones de HU-I-06) |
| Materia y fecha de la clase | `tabla-mis-pagos.tsx:31-34` → «Matemática Mar 13/10» | CUBIERTO | La fecha de la clase no muestra el año (ver §5.2 #2) |
| Monto | `tabla-mis-pagos.tsx:35-40` → `monto()` | CUBIERTO | Monto vigente. Los centavos solo aparecen si existen |
| Forma de pago | `tabla-mis-pagos.tsx:41` | CUBIERTO | Forma vigente de la operación |
| Anulados con la etiqueta «Anulado» | `tabla-mis-pagos.tsx:36-38`: `Badge` outline destructivo (aspecto «Cancelado», DESIGN §6.5), fila atenuada, monto tachado | CUBIERTO | |
| Anulados no suman al total | `totalNoAnulados` (`p.anulado ? suma : suma.plus(p.monto)`) | CUBIERTO | Con `Prisma.Decimal`, sobre todos los filtrados antes de paginar |
| Su comprobante no muestra el motivo de la anulación | `leerComprobanteDeAlumno` (vista del alumno, sin `marcas.anulado.motivo`); `comprobante-card.tsx:104` solo pinta el motivo si viene | CUBIERTO | Lo cubren los tests de `comprobante.lectura` y la ruta `[id]/comprobante`. **Hay que probarlo a mano porque el seed no tiene anulados** (§6.3 b) |

### Criterio 2 — Orden, paginación, total y filtros

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Orden por fecha de pago descendente | `listarPagosDeAlumno` (`ordenFechaYRegistro`): fecha de pago, momento de registro e id, descendentes | CUBIERTO | |
| Paginado de a 10 | `paginarHistorial` (`POR_PAGINA_HISTORIAL = 10`), no configurable (`por_pagina` → 400) | CUBIERTO | Una página fuera de rango lleva a la última. Con una sola página se oculta el paginador (DESIGN §8.1) |
| Total pagado del resultado | `total_pagado` sobre todo el resultado filtrado; UI «Total pagado del período: $ N» | CUBIERTO | El rótulo dice «del período» aunque no haya filtro de fechas (ver §2) |
| Filtro por rango de fechas | Schema `desde`/`hasta` (fecha calendario, inclusivo) → `listarPagosDeAlumno({ desde, hasta })` sobre la fecha de pago vigente | CUBIERTO | Con `desde > hasta` la UI no consulta y muestra «“Desde” no puede ser posterior a “Hasta”.»; el servidor responde 400 |
| Filtro por materia (las de sus clases pagadas) | `obtenerOpcionesMisPagos`: materias de **todas** sus clases con pagos (anulados incluidos), sin duplicados y ordenadas; `materia_id` filtra en el servidor | CUBIERTO | Una materia ajena o inexistente devuelve una lista vacía (nunca muestra pagos ajenos). La UI descarta una `materia_id` de la URL que no esté entre sus opciones |
| Se combinan entre sí | Fechas en la lectura de I y materia después de la lectura en lote de C | CUBIERTO | Cambiar un filtro vuelve a la página 1; «Limpiar filtros» restablece todo; la URL se actualiza con `replaceState` |

### Criterio 3 — Lo que no se muestra

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Sin el usuario que registró el pago | Proyección por lista cerrada en `listarMisPagos` (no lee nombres del personal); comprobante con «Registrado en el centro» (`registrado_en_el_centro: true`) | CUBIERTO | Tests que comparan las claves exactas del JSON (`pago.mis-pagos.test.ts`) |
| Sin pagos de otros alumnos del mismo turno | El universo es solo `alumno.id` de la sesión; la materia se filtra dentro de ese universo | CUBIERTO | Test con dos alumnos en la misma clase (`pago.mis-pagos.test.ts`, `.pg.test.ts`). En el seed hay 8 alumnos que pagaron `seed-turno-26` |

### Criterio 4 — Identidad por sesión y 403

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| El servidor resuelve el alumno a partir de la sesión | `req.auth!.user.id` → `obtenerAlumnoDeUsuario` (fachada B). Nunca lee el alumno de la query | CUBIERTO | Sin ficha → 404 `ALUMNO_NO_ENCONTRADO` |
| Otro rol en los endpoints propios → 403 | `withPermission("pagos:leer_propios")` → 403 `SIN_PERMISO` (Mesa, Gerente, Profesor) | CUBIERTO | Test de rutas `it.each(["MESA_ENTRADA","GERENTE","PROFESOR"])` |
| Alumno contra los endpoints administrativos con `alumno_id` de otro (`/api/pagos/historial`, `/opciones`, `/api/pagos/[id]/historial`, `/api/pagos/[id]/comprobante`, `/api/comprobantes/[id]`) → 403 | `withPermission("pagos:leer" / "comprobantes:leer")`; el alumno no tiene esos permisos (seed:916-961) | CUBIERTO | |
| Alumno pide el comprobante de un pago ajeno → 403 | `GET /api/mis-pagos/[id]/comprobante` → 403 `FUERA_DE_ALCANCE`; la página redirige a `/sin-permiso` | CUBIERTO | |
| Alumno pide `/api/mis-pagos?alumno_id=<otro>` | `MisPagosQuerySchema.strict()` → **400 `VALIDACION`** | **DESVÍO** | La HU dice «cualquier intento… se rechaza con **403**». La spec §2.15 y la task §0.4.1 decidieron 400 a propósito («no introducir una excepción de 403 para ese campo»), y `route.test.ts:48-53` lo exige. No filtra datos (nunca consulta), pero no es literal a la HU. **Decide el PO**: aceptar el 400 (y dejarlo anotado) o pedir 403 para `alumno_id` (es un cambio chico en la ruta, el schema y el test) |

### Criterio 5 — Sin pagos

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| «Todavía no tenés pagos registrados» | `mis-pagos.tsx:172` → `ui.pagos.propios.sinPagos` cuando no hay filtros | CUBIERTO | Con filtros y sin resultados muestra «No hay pagos para los filtros elegidos» (reutiliza el texto de I-02). Un error de carga nunca se muestra como lista vacía (error inline con «Reintentar») |

### Criterio 6 — Solo consulta

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| No incluye registrar, corregir ni anular | La pantalla no tiene acciones de escritura; los servicios solo leen; los POST de pagos exigen `pagos:crear` / `pagos:corregir` (el alumno recibe 403) | CUBIERTO | No hay Server Actions ni `revalidatePath` nuevos. El dev documenta huellas SQL idénticas antes y después (`sql-evidencia.json`) |

### Criterio 7 — Ver e imprimir el comprobante

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Cada pago permite ver su comprobante | `tabla-mis-pagos.tsx:43-49` → `Link` a `/mis-pagos/{pago_id}/comprobante` (por **id de pago**) | CUBIERTO | Para un anulado abre el último comprobante que lo incluyó (`comprobanteDelPagoEnOperacion`, ordenado por número descendente). Si el comprobante viniera `null`, la fila muestra «—», pero en la base los 37 pagos tienen comprobante |
| …e imprimirlo | `comprobante-card.tsx:121` → «Imprimir» = `window.print()`; CSS de impresión `data-comprobante` en `globals.css`; botones y menú `print:hidden` | CUBIERTO | Cerrar/X usa `router.back()` y vuelve a Mis pagos con los filtros de la URL |
| Desde el diálogo del navegador se guarda como PDF | Diálogo nativo, sin librería; ayuda `ui.comprobantes.ayudaImprimir` | CUBIERTO (a confirmar a mano) | El dev tiene PDFs automatizados (`page.pdf()`) y una prueba manual que el usuario informó pero no archivó. **Lo tiene que confirmar el PO** |

**DESVÍOS de la task respecto de la HU:** uno solo de fondo, el **criterio 4** (`alumno_id` → 400 en lugar de 403). Detalles menores de interpretación que no cambian el criterio: la task reemplaza el modal del prototipo por la página existente de HU-I-11 y muestra solo la fecha de la clase, sin la hora (la HU pide «Materia y fecha de la clase», así que está bien).

---

## 2. Textos literales (archivo central `src/lib/textos.ts`)

| Literal de la HU | Clave | Valor en código | ¿Coincide? |
|---|---|---|---|
| «Mis pagos» (pantalla) | `ui.pagos.propios.titulo` / `ui.pagos.propios.menu` | «Mis pagos» | ✅ |
| «Anulado» | `ui.pagos.correccion.anulado` | «Anulado» | ✅ |
| «Todavía no tenés pagos registrados» | `ui.pagos.propios.sinPagos` | «Todavía no tenés pagos registrados» | ✅ |

**No coincide ninguno.** Los tres literales entre comillas están idénticos.

**Rótulos sin comillas en la HU que conviene mirar** (para que decida el PO):
- Total: «**Total pagado del período:**». La HU dice «total pagado del resultado». Sin filtro de fechas, «del período» suena raro.
- Columnas «Fecha de pago», «Clase», «Monto», «Forma de pago», «Comprobante»: coinciden con la redacción del criterio 1 (la columna «Clase» junta materia y fecha).
- El comprobante dice «Registrado en el centro» (literal de HU-I-11 c2, ✅).
- Hay dos mensajes que llegan del servidor y la pantalla muestra tal cual. Una cuenta de alumno sin ficha ve «El alumno ya no existe» (`errores.alumno.noEncontrado`), que es poco feliz para el propio alumno. La API del comprobante ajeno responde «No podés modificar este pago.» (`errores.pago.fueraDeAlcance`, heredado de HU-I-06/I-11) para una **lectura**, aunque en la pantalla se redirige a `/sin-permiso` y ese texto no se ve.

---

## 3. Reglas de servidor

### 3.1 Endpoints

| Método y ruta | Permiso | Validación | Respuestas |
|---|---|---|---|
| `GET /api/mis-pagos?desde=&hasta=&materia_id=&pagina=` | `pagos:leer_propios` (solo ALUMNO) | `MisPagosQuerySchema` `.strict()`: fechas calendario, `desde ≤ hasta`, `pagina` entera > 0; rechaza `alumno_id`, `forma_pago_id`, `estado_pago`, `por_pagina` y cualquier otro campo | 200 `{ data: { total_pagado, items, paginacion }, error: null }` + `no-store`; 400 `VALIDACION` (`detalles` = `flatten()`); 401 `SESION_INVALIDA`; 403 `SIN_PERMISO`; 404 `ALUMNO_NO_ENCONTRADO` |
| `GET /api/mis-pagos/opciones` | `pagos:leer_propios` | Query vacía estricta | 200 `{ data: { materias: [{ id, nombre }] } }`; 400; 401; 403; 404 |
| `GET /api/mis-pagos/{pagoId}/comprobante` (HU-I-11) | `comprobantes:leer_propios` | — | 200 vista del alumno; 403 `FUERA_DE_ALCANCE` (pago ajeno o cuenta sin ficha); 404 `PAGO_NO_ENCONTRADO` |
| Página `/mis-pagos` | `exigirPermiso("pagos:leer_propios")` + `rutas-por-rol` `["ALUMNO"]` | — | Otro rol → `/sin-permiso`; sin sesión → `/login` |
| Página `/mis-pagos/{pagoId}/comprobante` | `exigirPermiso("comprobantes:leer_propios")` | — | Pago ajeno → `/sin-permiso`; inexistente → 404 |

Endpoints de escritura que el alumno **no** puede usar (criterio 6): `POST /api/pagos/operaciones`, `POST /api/pagos` (`pagos:crear`), `POST /api/pagos/{id}/correccion` y `POST /api/pagos/{id}/anulacion` (`pagos:corregir`) → 403.

### 3.2 Verificaciones

| Regla | Resultado |
|---|---|
| N.° 3 (aislamiento) | ✅ I usa `obtenerAlumnoDeUsuario` (B) y `obtenerClasesBasicas` (C) en lote. No toca tablas de otros módulos |
| N.° 4 (ruta delgada) | ✅ Las rutas solo validan, controlan el permiso, llaman al service y traducen el resultado |
| N.° 5 (`{ data, error }`) | ✅ |
| N.° 6 (Zod antes del service, 400 con `flatten()`) | ✅ `respuestaDeValidacion(parsed.error.flatten())` |
| N.° 10 (RBAC granular) | ✅ `withPermission("pagos:leer_propios")`; el alumno no recibe `pagos:leer` |
| N.° 7 (condición + mutación atómica) | **No aplica**: la HU no escribe nada y no hay bloqueos |
| N.° 8 (registros nuevos) | **No aplica a escritura.** La lectura respeta la regla: muestra el valor vigente (`CorreccionPago`, `CorreccionOperacion`, `AnulacionPago`) sin tocar el `Pago` original |
| N.° 1 | ✅ No hay borrados |
| N.° 2 | No aplica (la consulta no se audita y la task lo dice explícitamente) |
| Privacidad | ✅ Respuestas `Cache-Control: no-store`. Una sesión nunca reutiliza la caché de otra |

### 3.3 Snippets para comprobar el 403

Iniciá sesión con la cuenta indicada, abrí la consola (F12) **en una pestaña de la app** (`http://localhost:3000/...`) y pegá el código. Los ids son de la base de desarrollo al 14/10/2026 13:00 (si resembrás, cambian: ver la nota al final).

```js
// A) Con sesión de MESA (mesa.entrada@noctium.local), GERENTE (gerente@noctium.local) o PROFESOR (profesor1@noctium.local):
//    esperado 403 SIN_PERMISO en los tres
for (const url of [
  "/api/mis-pagos",
  "/api/mis-pagos/opciones",
  "/api/mis-pagos/cmv84cxnb02cyuxmk2svb2j0m/comprobante",
]) {
  const r = await fetch(url, { cache: "no-store" });
  console.log(r.status, url, (await r.json()).error);
}
```

```js
// B) Con sesión de ALUMNO Lucas Martínez (alumno02@noctium.local), que comparte la clase seed-turno-26 con Sofía:
//    intentos de ver pagos de Sofía (alumno01). Esperado: 403, 403, 403, 403 y 403 (FUERA_DE_ALCANCE en el último)
const sofia = "cmv84b9xu000ouxmky87bqmkl";
const pagoDeSofia = "cmv84cxnb02cyuxmk2svb2j0m"; // Matemática 13/10, comprobante 0001-00000025
for (const url of [
  `/api/pagos/historial?alumno_id=${sofia}`,
  `/api/pagos/historial/opciones?alumno_id=${sofia}`,
  `/api/pagos/${pagoDeSofia}/historial`,
  `/api/pagos/${pagoDeSofia}/comprobante`,
  `/api/mis-pagos/${pagoDeSofia}/comprobante`,
]) {
  const r = await fetch(url, { cache: "no-store" });
  console.log(r.status, url, (await r.json()).error?.code);
}
// El DESVÍO del criterio 4: hoy responde 400 VALIDACION (la HU pide 403)
const r = await fetch(`/api/mis-pagos?alumno_id=${sofia}`, { cache: "no-store" });
console.log(r.status, (await r.json()).error);
```

```js
// C) Con sesión de ALUMNO (cualquiera): las escrituras están vedadas (criterio 6). Esperado 403 en los tres.
//    El cuerpo va vacío a propósito: aunque lo corras por error con una sesión de gerente, falla la validación y no anula nada.
for (const url of [
  "/api/pagos/cmv84cxqn02d6uxmkve3tbfph/anulacion",
  "/api/pagos/cmv84cxqn02d6uxmkve3tbfph/correccion",
  "/api/pagos/operaciones",
]) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  console.log(r.status, url, (await r.json()).error?.code);
}
```

```js
// D) Con sesión de ALUMNO Sofía (alumno01@noctium.local): validaciones y contrato. Esperado 400, 400, 400, 400 y 200
for (const q of ["desde=2026-02-31", "desde=2026-10-10&hasta=2026-10-01", "pagina=0", "por_pagina=50", "pagina=99"]) {
  const r = await fetch(`/api/mis-pagos?${q}`, { cache: "no-store" });
  const j = await r.json();
  console.log(r.status, q, j.error?.code ?? j.data.paginacion);
}
// Claves de cada ítem: no deben aparecer registrado_por, precio, ajuste, motivo ni caja
const j = await (await fetch("/api/mis-pagos", { cache: "no-store" })).json();
console.log(Object.keys(j.data.items[0]), j.data.total_pagado, j.data.paginacion);
```

Sin sesión (ventana de incógnito, en la URL de la app): `fetch("/api/mis-pagos").then(r => console.log(r.status))` → 401.
Pantalla: con mesa, gerente o profesor, entrar a `/mis-pagos` → `/sin-permiso`. Con Lucas, entrar a `/mis-pagos/cmv84cxnb02cyuxmk2svb2j0m/comprobante` → `/sin-permiso`.

> Si resembrás, buscá los ids nuevos en Prisma Studio: `alumnos` (Sofía, DNI `40100001`) y `pagos` filtrando por su `alumnoId` (el más reciente es el de `seed-turno-26`).

---

## 4. Definición de Terminado

| Punto | Resultado |
|---|---|
| Textos visibles en el archivo central | ✅ Todo pasa por `texto()` (`ui.pagos.propios.*`, `ui.comprobantes.*`, `ui.pagos.historial.sinFiltros`, `ui.pagos.correccion.anulado`). `npx tsx scripts/verificar-claves-textos.ts` → «Claves de textos verificadas». La excepción es el mensaje fijo «Parámetros inválidos» de `respuestaDeValidacion` (helper anterior), que la pantalla nunca muestra porque normaliza la URL antes de consultar |
| Ningún texto visible con «turno» | ✅ Ninguna clave que usa la pantalla ni el comprobante contiene «turno». Solo aparece en comentarios del código |
| Confirmación HU-C-25 en toda operación que guarda | **No aplica**: la HU no guarda nada |
| Tests en verde | ✅ **Dirigidos: 15 archivos, 206/206** (`mis-pagos.test.tsx`, rutas `mis-pagos`, `opciones` y `[id]/comprobante`, `mis-pagos-listado`, `pago.mis-pagos`, `pago.schema`, `pago.historial` (regresión de I-02), `comprobante.lectura`, `components/pagos`, `Sidebar.mis-pagos`). `npx tsc --noEmit` sin errores. ESLint de los archivos de la HU: 0 errores, 1 advertencia que ya existía (`CALENDARIO` sin usar en `Sidebar.tsx:53`). `pago.mis-pagos.pg.test.ts` **queda omitido** (8 tests): necesita la base aislada `127.0.0.1:55434` y yo no la levanté. El dev informa que pasan (`pg-resultados-55434.txt`) |

### 4.1 Suite completa

`npx vitest run`: **327 archivos OK, 2 con falla, 67 omitidos; 4381 pruebas OK, 4 con falla**. Ninguna falla es de esta HU:
- `src/lib/claves-textos.test.ts`: **timeouts** de 60 s, no aserciones. Aun corrido solo sigue cayendo 1 test por tiempo (71 s). El verificador CLI con la misma comprobación da OK. La task lo deja como pendiente sin tildar en su DoD.
- `src/server/shared/actividad-usuario.test.ts` (2 tests): `Cannot read properties of undefined (reading 'findFirst')`. También falla corrido solo. Es de **HU-N-01** (`068239d`, mergeado en `254889d`), y HU-I-05 no toca ese archivo. Hay que avisarle al responsable de HU-N-01.

**Incumplimientos de la DoD atribuibles a HU-I-05:** ninguno. La suite general no está 100 % en verde por causas ajenas (las dos de arriba).

---

## 5. Extras y violaciones a RULES.md / DESIGN.md

### 5.1 Cosas implementadas que la HU no pide (aceptables)

- **«Limpiar filtros»** (aparece solo cuando hay algún filtro activo).
- **Filtros y página en la URL** (`replaceState`): se pueden recargar o compartir, y al volver del comprobante se conservan. La URL inicial se normaliza: descarta fechas inválidas o invertidas y una `materia_id` que no es suya.
- **Estados de carga y de error con «Reintentar»**, separados para el listado y para las opciones de materia.
- **Mensaje inline de rango inválido** y `min`/`max` cruzados en los dos campos de fecha.
- **«Ver comprobante {numero}»** como etiqueta accesible del enlace, y `caption` oculto en la tabla.
- **La respuesta trae `hora_inicio` de la clase, `materia.id` y `forma_pago.id`**, que no se muestran. No son datos sensibles.
- **Refactor en `pago.service.ts`** de código de HU-I-02 (`pagosConClase`, `totalNoAnulados`), sin cambio de contrato. La regresión de I-02 pasa.
- **Infraestructura de E2E propia**: `playwright.hu-i-05.config.ts` en la raíz, `scripts/testing/hu-i-05*.ts` y `run-hu-i-05.mjs`, y unos 40 archivos de evidencia (capturas, PDFs, JSON) en `docs/testing/Modulo I/hu-i-05/`.
- **Documentación tocada fuera de la HU**: filas nuevas en `DESIGN.md` §6.4 y en el historial, y nota de cierre de los diferidos en `docs/validacion/Sprint 3/HU-I-11.md`.

### 5.2 Violaciones u observaciones

| # | Observación | Referencia | Severidad |
|---|---|---|---|
| 1 | `GET /api/mis-pagos?alumno_id=…` responde **400** en lugar de **403** | HU c4 («cualquier intento… 403») vs. spec §2.15 / task §0.4.1 | **DESVÍO**, decide el PO |
| 2 | La fecha de la clase se muestra sin año («Lun 18/11»). Sofía tiene pagos de 2024, 2025 y 2026, así que en las páginas 2 y 3 la fecha de la clase es ambigua (la fecha de pago sí tiene año) | HU c1 «fecha de la clase» | Menor |
| 3 | El total dice «Total pagado del **período**» aunque no haya filtro de fechas. La HU habla del «total pagado del resultado» | HU c2 | Menor/redacción |
| 4 | Una cuenta ALUMNO sin ficha ve «El alumno ya no existe» (mensaje del 404 del servidor) | UX | Menor (en la práctica es un caso de datos inconsistentes) |
| 5 | La API del comprobante ajeno responde «No podés modificar este pago.» para una lectura (heredado de HU-I-11) | Texto de error | Menor, no se ve en la pantalla |
| 6 | `mis-pagos/[id]/comprobante/page.tsx` (HU-I-11) importa `prisma` en la página y se lo pasa a las lecturas de I | RULES N.° 4 / N.° 11 (la lógica igual vive en `src/server/pagos`) | Menor, anterior a esta HU |
| 7 | **Datos del seed:** los 25 pagos de Sofía son todos de Matemática y por Transferencia, sin anulados, y con montos de fixture de indicadores ($ 3.800.000, $ 989.000…). Con eso el filtro de materia ofrece una sola opción y el criterio 1 (anulado) no se puede ver sin preparar datos | Seed / prueba manual | Menor (datos). Ver §6.3 |
| 8 | Ningún alumno de `prisma/seed.ts` con cuenta queda sin pagos (alumno01…06 tienen al menos uno). Para el criterio 5 hay que usar una cuenta de fixture de HU-A-06 o crear una | Seed / prueba manual | Menor (datos). Ver §6.3 d |
| 9 | Diferencia de contrato: una cuenta sin ficha recibe 404 en el listado y 403 en el comprobante. Está documentada en la task §4.4 | Coherencia | Informativa |

No encontré violaciones a las Reglas N.° 1 a 11 en el código propio de la HU, ni colores escritos a mano (DESIGN, regla no negociable). «Anulado» usa `Badge` con el aspecto de «Cancelado» (§6.5), y la paginación es de a 10 y se oculta cuando hay una sola página (§8.1).

---

## 6. Datos para la prueba manual

### 6.1 Credenciales (contraseña de todas: `Password123!`)

| Rol | Cuenta | Para qué |
|---|---|---|
| Alumno | `alumno01@noctium.local` (Fernández, Sofía, DNI 40100001) | c1, c2, c3, c6 y c7: **25 pagos → 3 páginas (10 + 10 + 5)** |
| Alumno | `alumno02@noctium.local` (Martínez, Lucas, DNI 40100002) | c3 y c4: comparte `seed-turno-26` (Matemática 13/10 10:00) con Sofía y otros 6; tiene 1 pago (1 página, sin paginador) |
| Alumno | `alumno03…06@noctium.local` | Igual que Lucas (1 pago cada uno en `seed-turno-26`) |
| Alumno sin pagos | `a06.alumno.mi.cuenta@noctium.local` (Prueba A06, Tercera, DNI 88060003) | c5. Es una cuenta de fixture de HU-A-06 que hoy está en la base de desarrollo; su contraseña es la del seed. Si no está, ver §6.3 d |
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz), **caja abierta** (la de los 25 pagos de Sofía) | Preparar pagos y anulaciones; c4 (403) |
| Gerente | `gerente@noctium.local` | Anular cualquier pago; c4 (403) |
| Profesor | `profesor1@noctium.local` | c4 (403 y `/sin-permiso`) |

### 6.2 Datos que ya trae la base (consultados el 14/10/2026)

| Dato | Valor |
|---|---|
| Pagos de Sofía | 25, del 18/11/2024 al 13/10/2026, todos de Matemática y por Transferencia, ninguno anulado, todos con comprobante (0001-00000001 … 0001-00000025). El primero de la lista: 13/10/2026, `seed-turno-26`, $ 24.000, comprobante 0001-00000025 |
| Clase compartida | `seed-turno-26` (Matemática 13/10/2026 10:00): pagaron 8 alumnos (40100001 a 40100008), con comprobantes 25 a 32 |
| Reservas de Sofía para preparar pagos nuevos | `seed-turno-04` Química 16/10 14:00, `seed-turno-08` Bases de Datos 19/10 12:00, `seed-turno-14` Física 21/10 08:00, `seed-turno-12` Bases de Datos 29/10 10:00 (todas `RESERVADA` y vigentes) |
| Anulaciones / correcciones en la base | 0 / 0 |

### 6.3 Cómo probar cada criterio (y qué preparar)

**a) Pagos de otras materias y otra forma de pago (c2: filtro por materia y combinación).** Con `mesa.entrada@noctium.local` → «Registrar pago» → Sofía → marcá **Química `seed-turno-04`** y **Bases de Datos `seed-turno-08`** (una sola operación) → forma **Efectivo** → confirmar. Después registrá **Física `seed-turno-14`** sola, por Transferencia. Sofía queda con 28 pagos (10 + 10 + 8) y tres materias nuevas en el filtro. Si alguna reserva ya venció, usá `seed-turno-12` o cualquier clase futura con la opción de inscribir al pagar.

**b) Pagos anulados (c1, y c7 sin motivo).** HU-I-06 ya tiene pantalla. Con `mesa.entrada@noctium.local` (o `gerente@noctium.local`) → Alumnos → Sofía → pestaña «Pagos»:
- **Anulación parcial**: «Anular» en el pago de **Química** de la operación del paso a), con el motivo «Prueba PO HU-I-05». La operación conserva Bases de Datos, así que se emite un comprobante de reemplazo.
- **Anulación total**: «Anular» en el pago de **Matemática 13/10** (`seed-turno-26`, operación de un solo pago), con el motivo «Reintegro». El comprobante 0001-00000025 queda «ANULADO».

Mesa de entrada puede anular los dos porque se registraron hace menos de 30 días y la caja de Marta sigue abierta. Resultado esperado en «Mis pagos» de Sofía: las dos filas atenuadas, con el monto tachado y «Anulado», y el total baja $ 24.000 + el precio de Química. Al abrir sus comprobantes, el de Matemática muestra «ANULADO» y «Anulado el dd/mm/aaaa» **sin «Motivo: …»**, y el de Química (el último que lo incluyó) muestra «Reemplazado por 0001-000000NN», también sin motivo. Para comparar: la misma vista desde mesa (`/comprobantes/{id}`) **sí** muestra el motivo.

**c) Criterios 2 y 3 paso a paso.**
- Orden y paginación: la primera fila es la fecha de pago más reciente; la página 1 tiene 10 filas, la 2 tiene 10 y la 3 tiene el resto. «Mostrando 1–10 de N».
- Total: sin filtros, la suma de los no anulados. Con «Desde» 01/01/2026 el total y la cantidad bajan y vuelve a la página 1.
- Materia: aparecen solo las materias de sus clases pagadas, incluso la de un pago anulado (Química). Combiná «Desde» 01/10/2026 + Materia «Bases de Datos» → 1 fila.
- Con filtros que no dan resultados («Desde» 01/01/2030): «No hay pagos para los filtros elegidos».
- c3: en la pantalla y en Network (`/api/mis-pagos`) no aparece «Ruiz, Marta» ni ningún `registrado_por`. Con Lucas se ve **solo** su pago de `seed-turno-26`, nunca el de Sofía, aunque sea la misma clase.
- Ida y vuelta: filtrar, ir a la página 2, abrir un comprobante y tocar «Cerrar» → vuelve con los mismos filtros y página.

**d) Alumno sin pagos (c5).** Ingresá con `a06.alumno.mi.cuenta@noctium.local` / `Password123!` → «Mis pagos» → «Todavía no tenés pagos registrados». Si esa cuenta no existe en tu base (no la crea `prisma/seed.ts`), creá una cuenta nueva con el autorregistro (`/registro`) o pedile a mesa que dé de alta un alumno con cuenta. **No sirve** anular todos los pagos de un alumno, porque los anulados se siguen listando.

**e) Criterio 4.** Snippets de §3.3 A, B y D. En la pantalla: con Lucas, pegá en la barra `/mis-pagos/cmv84cxnb02cyuxmk2svb2j0m/comprobante` (pago de Sofía) → `/sin-permiso`.

**f) Criterio 6.** Con Sofía, verificá que ni la tabla ni el comprobante tengan «Registrar», «Corregir», «Anular» ni «Ver detalle». Snippet §3.3 C → 403.

**g) Criterio 7.** Con Sofía → clic en el número de comprobante de una fila → «Imprimir» → en la vista previa sale solo el comprobante (sin menú, botones ni lista). Elegí «Guardar como PDF», guardalo y abrilo. Repetilo con un anulado del paso b): el PDF no debe tener el motivo ni el usuario que registró, y sí «Registrado en el centro».

**h) (Opcional) Cuenta de alumno sin ficha → 404.** Solo en la base de desarrollo y revirtiéndolo al terminar: en Prisma Studio (`npx prisma studio`) → `alumnos` → la fila de DNI `88060003` → anotá `usuarioId`, dejalo vacío (null) y guardá. Con `a06.alumno.mi.cuenta` → «Mis pagos» muestra el error inline («El alumno ya no existe») con «Reintentar», y `fetch("/api/mis-pagos")` da 404 `ALUMNO_NO_ENCONTRADO`. Después volvé a poner el `usuarioId` original.

> Las reservas del seed vencen 24 h después de correrlo. Si al preparar el paso a) ya vencieron, en «Registrar pago» la clase aparece como «Pago sin registrar» o se inscribe al pagar: para esta HU da igual, lo único que importa es que quede un pago nuevo.

---

## 7. Veredicto preliminar

### **Lista para prueba manual**

**Bloqueantes de funcionamiento:** ninguno.

**Decisión del PO antes de aprobar (puede pasar a bloqueante):**
1. **Criterio 4, DESVÍO:** `GET /api/mis-pagos?alumno_id=<otro>` responde **400** y no **403**. No se filtran datos, y todos los demás caminos para ver pagos ajenos sí dan 403. Si el PO exige el 403 literal, vuelve al dev con un cambio chico (ruta, schema y `route.test.ts`). Si lo acepta, conviene dejarlo anotado en la HU o en la spec.

**A resolver o aceptar en la prueba (no bloquean):**
2. La fecha de la clase se muestra sin año, y el historial de Sofía abarca 2024–2026 (§5.2 #2).
3. El rótulo «Total pagado del período» se muestra aunque no haya filtro de fechas (§5.2 #3).
4. El mensaje para una cuenta sin ficha («El alumno ya no existe») es poco claro (§5.2 #4).
5. Guardar como PDF desde el diálogo nativo hay que confirmarlo a mano: la prueba manual del dev no tiene archivos de evidencia.
6. Datos: hay que preparar anulados, otras materias y un alumno sin pagos (§6.3 a, b y d).
7. Ajeno a esta HU: `actividad-usuario.test.ts` (HU-N-01) falla en `develop` y `claves-textos.test.ts` se corta por timeout. Conviene avisar a sus responsables antes del cierre del sprint.
