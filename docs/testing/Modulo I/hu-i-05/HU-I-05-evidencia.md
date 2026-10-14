# Evidencia HU-I-05 — Mis pagos (14/10/2026)

## Entorno

- Rama `feature/HU-I-05`, base `e3ea18d` (`origin/develop`), copia `D:\Proyectos Facultad\noctium`. Sin commits propios (revisión vía staged).
- Windows, Node 24.19.0, Next.js 16.3.8, PostgreSQL 16 en Docker (`noctium_db`, `localhost:5433`). `npm ci` con `package.json` y lock sincronizados (sin cambios en ninguno de los dos).
- **Toda escritura de prueba fue en bases descartables** (`noctium_pruebas_*` / `noctium_pruebas_i05_*`), creadas y borradas por `scripts/test-pg.mjs` y `scripts/testing/run-hu-i-05.mjs`. La base de trabajo `noctium_dev` solo recibió una consulta `SELECT` (conteo de pagos sin comprobante). Para la regresión de I-02 se levantó un contenedor propio `noctium_i05_pg_regresion` en `127.0.0.1:55434` y se eliminó al terminar.
- Navegador: Chrome del sistema vía Playwright 1.64 (`channel: "chrome"`), sin descargar navegadores.

## Nivel 1 — unitarios, rutas y componentes (Vitest)

| Archivo | Resultado |
|---|---|
| `src/server/pagos/pago.schema.test.ts` (incluye `MisPagosQuerySchema` / `OpcionesMisPagosQuerySchema`) | ✅ |
| `src/server/pagos/pago.mis-pagos.test.ts` (servicio: sesión, A/B misma clase, total Decimal con centavos, anulados, paginación, filtros, proyección exacta, inconsistencia de clase, opciones) | ✅ |
| `src/app/api/mis-pagos/route.test.ts` (18) y `opciones/route.test.ts` (6): 200/no-store, 400 `VALIDACION` + `flatten`, 401, 403 `SIN_PERMISO`, 404 `ALUMNO_NO_ENCONTRADO` | ✅ 24/24 |
| `src/app/(dashboard)/mis-pagos/mis-pagos.test.tsx` (15): página exige permiso, filtros → página 1, URL, limpiar, vacíos distintos, paginación, fuera de rango, URL inicial normalizada, rango invertido, carga/error/reintento, error de opciones, respuestas viejas descartadas, enlaces por `pago_id`, sin acciones de escritura | ✅ 15/15 |
| `src/components/layout/Sidebar.mis-pagos.test.tsx` (6): solo Alumno, orden, activo en `/mis-pagos` y en el comprobante | ✅ 6/6 |
| `src/lib/mis-pagos-listado.test.ts` | ✅ |
| Regresión dirigida: `pago.historial.test.ts`, `pago.service.test.ts`, `pago.publico.test.ts`, `comprobante.lectura.test.ts`, rutas de historial I-02, comprobantes I-11 (`mis-pagos/[id]`, `pagos/[id]/comprobante`, `comprobantes`), `rutas-por-rol`, Sidebar caja/reservas, `textos`, `terminologia-clases`, `comprobante-card.test.tsx` | ✅ (14 archivos + `comprobante-card` 6/6) |
| `src/lib/claves-textos.test.ts` | La suite general informó 3 timeouts. El verificador CLI `npx tsx scripts/verificar-claves-textos.ts` pasó, pero no sustituye los casos negativos y de flujos del archivo. Ver reejecución dirigida en «Checks finales». |

Los archivos jsdom fallaron una vez al arrancar el worker por carga del equipo (no por aserciones); corridos individualmente pasaron. Resultado de la suite completa: ver «Checks finales».

## Nivel 3a — PostgreSQL real (servicios de dominio)

`node scripts/test-pg.mjs src/server/pagos/pago.mis-pagos.pg.test.ts src/server/pagos/comprobante.lectura.pg.test.ts src/server/pagos/pago.publico.pg.test.ts src/server/pagos/pago.historial.pg.test.ts`

- En `localhost:5433`: **3 archivos ✅, 17 tests**; `pago.historial.pg.test.ts` (I-02) quedó **salteado** por su guarda (`127.0.0.1:55434`) → [pg-resultados.txt](pg-resultados.txt). **No se cuenta como aprobado.**
- Repetido con `PG_PRUEBAS_ADMIN_URL=postgresql://postgres@127.0.0.1:55434/postgres` (contenedor propio descartable compatible con esa guarda): **4 archivos ✅, 21/21, 0 salteados**, incluida la regresión PostgreSQL de I-02 → [pg-resultados-55434.txt](pg-resultados-55434.txt).

`pago.mis-pagos.pg.test.ts` (8 casos) crea con los servicios reales: operación de dos clases, B en la misma clase, 10 operaciones simples, anulación parcial y total (`anularPago`), corrección de monto (`corregirPago`) y de fecha+forma (`corregirOperacion`). Verifica total exacto 578.27, paginación, filtros sobre fecha vigente, proyección por claves exactas sin motivos/actores/caja/pagos de B, opciones, 404 sin ficha, comprobante correcto por `pago_id` (original «Reemplazado por» para el anulado parcial, reemplazo para el vigente, «ANULADO» con fecha y sin motivo en la total), 403 ajeno y **ausencia de escrituras** (foto de pagos, correcciones, anulaciones, operaciones, comprobantes, inscripciones y cajas antes/después).

## Nivel 2 — HTTP real (sesiones NextAuth) y Postman

`node scripts/testing/run-hu-i-05.mjs`: base `noctium_pruebas_i05_85e24a23` → migraciones → seed → [fixtures](../../../../scripts/testing/hu-i-05-fixtures.ts) (cobros y correcciones por servicios de dominio con reloj fijo 06/10/2026) → `next start` (build de producción) → [api-check.mjs](api-check.mjs) → Playwright → base borrada.

**77/77 casos OK** → [api-check-resultados.json](api-check-resultados.json). Incluye:

| Grupo | Resultado |
|---|---|
| Preparación I-06 por HTTP como mesa de entrada: anulación parcial (emite reemplazo) y total (sin comprobante nuevo) | 200 ✅ |
| A: listado p1/p2/p3/fuera de rango; total del resultado completo igual en todas las páginas; orden por fecha vigente; anulados listados; monto y fecha/forma vigentes | 200 ✅ |
| Filtros: materia (14 filas, 2 páginas), día exacto de la fecha corregida, rango+materia, sin coincidencias (página 1, total 0.00), materia que solo pagó B (vacío) | 200 ✅ |
| Opciones de A (Física I, Matemática II; anulados incluidos; sin formas) y de alumno sin pagos (vacías) | 200 ✅ |
| B no recibe pagos de A | 200 ✅ |
| `alumno_id` de B, `forma_pago_id`, `estado_pago`, `por_pagina`, extra, fecha inexistente, rango invertido, página 0/fraccionaria, fecha vacía; opciones con `alumno_id` | 400 `VALIDACION` con `flatten` ✅ |
| Sin sesión y sesión inválida | 401 ✅ |
| Mesa, Gerente y Profesor en listado y opciones propios | 403 `SIN_PERMISO` ✅ |
| Cuenta ALUMNO sin ficha | 404 `ALUMNO_NO_ENCONTRADO` ✅ |
| Alumno contra historial y opciones administrativos, «Ver detalle», comprobante administrativo (por id y por pago), anular, corregir, registrar operación y atajo | 403 `SIN_PERMISO` ✅, sin mutación |
| Comprobante propio de **cada uno de los 21 pagos**: mismo id/número que el listado, `registrado_en_el_centro: true`, sin `registrado_por`, `marcas.anulado` solo con `fecha` | 200 ✅ |
| Marcas: anulado parcial → original «Reemplazado por»; vigente → reemplazo «reemplaza a»; total → «ANULADO» con fecha; corrección de monto y de fecha/forma → reemplazos con los valores corregidos | ✅ |
| A pide comprobante de B (misma clase y otra clase) | 403 `FUERA_DE_ALCANCE` ✅, sin datos de B |
| Pago inexistente / sin ficha en comprobante / mesa en comprobante propio | 404 `PAGO_NO_ENCONTRADO` / 403 `FUERA_DE_ALCANCE` / 403 `SIN_PERMISO` ✅ |
| `Cache-Control` de éxitos propios | `no-store, must-revalidate` ✅ (lo fija `withPermission`) |

Colección Postman: [HU-I-05.postman_collection.json](HU-I-05.postman_collection.json) (31 pedidos, sin cookies ni secretos; variables de entorno). La ejecución automatizada equivalente fue `api-check.mjs` (HTTP Node), no Newman.

## Nivel 3b — SQL de verificación

[HU-I-05.sql](HU-I-05.sql) (solo `SELECT`). `api-check.mjs` ejecutó el bloque de valores vigentes sobre la base descartable → [sql-evidencia.json](sql-evidencia.json): 21 filas, **total SQL = total API = 223500.50**; los dos motivos de anulación **existen en la base** y no llegaron a ninguna respuesta del alumno; huella md5 de `pagos`, `correcciones_pago`, `correcciones_operacion`, `anulaciones_pago`, `operaciones_pago`, `comprobantes` (incluye `datos`), `turno_alumno`, `cajas`, `ajustes_caja` y `parametros_sistema` **idéntica antes y después** de todas las consultas, comprobantes e intentos del alumno.

**Comprobante `null` (resolución 6):** en el código, solo las fábricas de prueba (`crearOperacionDePrueba` en `src/server/testing/fabricas.ts`) crean operaciones sin pasar por `registrarOperacion`, que siempre emite comprobante en la misma transacción; un pago anulado resuelve al último que lo incluyó y uno vigente al no reemplazado, que siempre existen en datos de dominio. Consulta de solo lectura en `noctium_dev`: 42 pagos, 40 operaciones, **0 pagos sin comprobante**. Conclusión: `null` solo surge de datos de prueba inválidos; todos los pagos usados en esta verificación abrieron su comprobante correcto (pg test y api-check). La UI muestra «—» como defensa.

## E2E, comparación visual e impresión (Playwright, Chrome del sistema)

**7/7** → [playwright-resultados.json](playwright-resultados.json), [e2e-registro.json](e2e-registro.json), [e2e-salida.txt](e2e-salida.txt).

| Escenario | Capturas |
|---|---|
| Menú «Mis pagos» (activo), listado 1440×900: título, leyenda, filtros, total a la derecha, columnas, «Anulado» tachado, «Mostrando 1–10 de 21», paginador; sin acciones de escritura ni registrador | [listado-escritorio](listado-escritorio.png) |
| Filtro Física I + página 2 → comprobante → «Cerrar» vuelve a `?materia_id=…&pagina=2` con el filtro y «Mostrando 11–14 de 14»; ídem con teclado (Enter) y Atrás del navegador | [listado-filtrado-pagina-2](listado-filtrado-pagina-2.png) |
| Comprobante propio vigente (reemplazo de la operación doble) | [escritorio](comprobante-escritorio.png), [impresión](comprobante-propio-impresion.png), [PDF](comprobante-propio.pdf) |
| Anulación parcial (original «Reemplazado por») y total («ANULADO · Anulado el 14/10/2026»); sin motivo en pantalla, HTML, API ni impresión | [parcial](comprobante-anulacion-parcial.png), [parcial impresión](comprobante-anulacion-parcial-impresion.png), [PDF](comprobante-anulacion-parcial.pdf), [total](comprobante-anulacion-total.png), [total impresión](comprobante-anulacion-total-impresion.png), [PDF](comprobante-anulacion-total.pdf) |
| Comprobante de B por URL directa → `/sin-permiso` sin datos de B; API 403 | [comprobante-ajeno-sin-permiso](comprobante-ajeno-sin-permiso.png) |
| Móvil 390×844: documento sin desborde (390 = 390), tabla con scroll local (752 > 356) | [listado-movil](listado-movil.png), [comprobante-movil](comprobante-movil.png) |
| Filtros sin resultados, «Limpiar filtros», error con «Reintentar» (no se muestra como vacío), alumno sin pagos, cuenta sin ficha (error inline) | [filtros-sin-resultados](filtros-sin-resultados.png), [error-reintentar](error-reintentar.png), [sin-pagos](sin-pagos.png), [cuenta-sin-ficha](cuenta-sin-ficha.png) |

**Comparación con las imágenes** (`C:\Users\agust\Desktop\Imagenes HU\HU-I-05\`): «Mis pagos» coincide en título, leyenda, filtros con etiqueta interna, total a la derecha, tabla de cinco columnas con fecha monoespaciada, «Materia + Mar 13/10», monto a la derecha, número subrayado y pie con rango y paginador numerado. Diferencias deliberadas (decisiones de §0.4/§0.6): comprobante como página con tarjeta centrada (no modal), teléfono en lugar de CUIT, «Apellido, Nombre», solo hora de inicio, «Registrado en el centro» sin la etiqueta «Registrado por:», y el menú real sin «Mi historial». Los centavos solo aparecen si existen (`$ 15.000,50`).

**Impresión:** el test verificó que «Imprimir» invoca `window.print()` (1 llamada); con `emulateMedia('print')` el texto visible contiene número, leyenda, «Registrado en el centro» y marcas, y **no** contiene menú, «Mis pagos», botones, ayuda de impresión, registrador ni motivo; `page.pdf()` (motor de «Guardar como PDF» de Chrome) generó PDFs de **1 página**.

**Verificación manual aportada por el usuario (14/10/2026):** el listado y el comprobante propio funcionan en su entorno local. El usuario informó capturas de una fila anulada en «Mis pagos», un comprobante propio normal y la vista previa **nativa de Edge** con una sola hoja, sin menú ni botones dentro del documento. Esas capturas no están incorporadas a esta carpeta; se registra el resultado comunicado, sin atribuirlo a Playwright ni afirmar una inspección local de los archivos. Esto verifica la vista previa nativa normal en Edge. El usuario informó también que ya ve un pago anulado en su base local; no se prepararon ni modificaron datos de esa base en esta continuidad.

**Pendientes manuales del criterio 7:** no hay evidencia del guardado efectivo y apertura del PDF desde el diálogo, de la impresión/vista previa **del comprobante anulado**, ni de la prueba nativa en Chrome y Firefox. `page.pdf()` y `emulateMedia('print')` son pruebas automatizadas distintas. Para completar lo pendiente:
1. Usar la app local donde el usuario ya ve el pago anulado. El dataset automatizado procede del fixture propio de HU-I-05: `node scripts/testing/run-hu-i-05.mjs` borra su base descartable al finalizar y no sirve para dejar esos datos disponibles para una sesión manual posterior. `npm run dev` sobre el seed común tampoco garantiza ese dataset. Iniciar sesión con una cuenta ALUMNO del entorno local, sin registrar credenciales en esta evidencia, y abrir `/mis-pagos` en el puerto de la app.
2. Desde el listado, abrir un comprobante propio normal y pulsar «Imprimir». En Chrome y Firefox, comprobar la vista previa nativa: una hoja con solo el comprobante, sin menú, barra superior, botones ni registrador. Elegir «Guardar como PDF», abrir el archivo y comprobar el contenido.
3. Abrir desde la fila anulada su comprobante y repetir vista previa y guardado. Comprobar «ANULADO»/marcas y fecha según corresponda, sin motivo en el documento ni en el PDF.
4. Registrar fecha, navegador, resultado y archivos de evidencia antes de marcar esos pasos como realizados.

## Cierre de diferidos de HU-I-11

| Diferido | Prueba ejecutada | Evidencia | Estado |
|---|---|---|---|
| C2 · vista del comprobante del alumno | Desde una fila de Mis pagos se abre el comprobante propio; contenido de la copia fija, «Registrado en el centro», sin registrador (UI, API de los 21 pagos, impresión) | E2E escenarios 2–3; api-check «comprobante propio»; `comprobante-escritorio.png`, `comprobante-propio.pdf`; verificación manual comunicada por el usuario el 14/10 | **Cerrado** (14/10/2026, base `e3ea18d`) |
| C4 · 403 por comprobante ajeno | A pide `pago_id` de B en la misma clase y en otra: API 403 `FUERA_DE_ALCANCE`; página → `/sin-permiso` sin datos. Impresión/PDF automatizada propia verificada; vista previa nativa normal en Edge comunicada por el usuario | api-check; E2E escenario 5; `comprobante-ajeno-sin-permiso.png`; pg test; testimonio manual del 14/10 (capturas no archivadas aquí) | **Acceso cerrado; vista previa normal Edge verificada. PDF guardado, anulado y Chrome/Firefox pendientes** |
| C5 · motivo de anulación omitido | Anulación parcial y total por la API autorizada de I-06; el alumno abre el documento correcto (original «Reemplazado por» / «ANULADO» con fecha); motivo ausente en JSON, HTML, UI e impresión/PDF; SQL confirma que el motivo existe en la base | api-check; E2E escenario 4; `sql-evidencia.json`; capturas y PDFs de anulación | **Cerrado** |

## Checks finales

La corrida general anterior informó **4137 tests aprobados y 5 fallidos**, además de cinco archivos de Turnos que no arrancaron por recursos del runner. No fue una suite íntegramente verde y no se conservó un log completo de esa corrida en esta carpeta; las cifras son del informe de continuidad y se distinguen de la reejecución documentada abajo. Los fallos informados fueron 3 en `claves-textos.test.ts`, 1 en `errores-dominio.test.ts` y 1 en `historial-pagos.test.tsx`.

| Check | Comando / resultado | Evidencia |
|---|---|---|
| PostgreSQL de I-05/I-02/I-11 | `node scripts/test-pg.mjs src/server/pagos/pago.mis-pagos.pg.test.ts src/server/pagos/comprobante.lectura.pg.test.ts src/server/pagos/pago.publico.pg.test.ts src/server/pagos/pago.historial.pg.test.ts` con `PG_PRUEBAS_ADMIN_URL` al contenedor aislado `127.0.0.1:55434`: **4 archivos, 21/21 tests, 0 salteados** | `pg-resultados-55434.txt` |
| HTTP real y E2E | `node scripts/testing/run-hu-i-05.mjs`: **77/77 casos HTTP y 7/7 tests Playwright** | `api-check-resultados.json`, `e2e-salida.txt`, `playwright-resultados.json` |
| Build | `npm run build`: **exit 0**; salida conservada, incluye rutas `/mis-pagos` y sus APIs | `build.txt` (`BUILD_EXIT=0`) |
| TypeScript y lint | Informados como aprobados por la ejecución previa. El informe registró un aviso previo de CALENDARIO en lint; no hay logs separados de esos comandos en esta carpeta. | Informe de continuidad; limitación de trazabilidad |
| Verificador de claves CLI | `npx tsx scripts/verificar-claves-textos.ts`: **exit 0**, «Claves de textos verificadas.»; no reemplaza el archivo de tests | `verificador-claves.txt` |
| Reejecución dirigida | Ver detalle y logs a continuación. | `reejecucion-*.txt` |

### Reejecución de los ocho archivos afectados (14/10/2026)

Antes de iniciar no había una corrida de Vitest activa en esta copia. Se usó `npx vitest run --no-file-parallelism --testTimeout 120000` con los ocho archivos. El primer intento quedó sin salida tras arrancar el worker de `claves-textos.test.ts` y se interrumpió; su log es `reejecucion-dirigida.txt`. La opción CLI de 120 s no sustituye los límites de 60 s escritos dentro de ese archivo.

| Archivo | Resultado concluyente | Log |
|---|---|---|
| `src/server/shared/errores-dominio.test.ts` | Pasó en el grupo de cinco: **124/124 tests** en conjunto | `reejecucion-siete.txt` |
| `src/app/(dashboard)/alumnos/[id]/historial-pagos.test.tsx` | Pasó en el mismo grupo | `reejecucion-siete.txt` |
| `src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx` | Pasó en el mismo grupo | `reejecucion-siete.txt` |
| `src/app/(dashboard)/turnos/turnos-listado.test.tsx` | Pasó en el mismo grupo | `reejecucion-siete.txt` |
| `src/app/(dashboard)/turnos/turno-configuracion.test.tsx` | Pasó en el mismo grupo | `reejecucion-siete.txt` |
| `src/app/(dashboard)/turnos/nuevo/turno-wizard.test.tsx` | **45/45** en corrida aislada | `reejecucion-turno-wizard.txt` |
| `src/app/(dashboard)/turnos/nuevo/turno-recurrente.test.tsx` | **30/30** en corrida aislada | `reejecucion-turno-recurrente.txt` |
| `src/lib/claves-textos.test.ts` | Corrida aislada terminada: **3 tests fallidos por timeout interno de 60 s, 33 salteados**; dos hooks también agotaron 60 s. No hubo fallo de aserción concluyente. | `reejecucion-claves-textos.txt` |

En el grupo de siete hubo **5 archivos / 124 tests aprobados** y dos errores de inicio de worker (wizard y recurrente); ambos aprobaron después por separado. Un intento adicional con `--no-isolate` mezcló el estado de los dos archivos de Turnos y produjo 27 fallos; se conserva como `reejecucion-turnos-dos.txt`, pero las corridas aisladas son el resultado válido de esos archivos. **Balance de los ocho:** siete archivos aprobados (199 tests), uno sin aprobar por límites internos de tiempo. No se modificaron tests, aserciones ni configuración global para ocultar el resultado.

**Comparación con la base:** `git archive e3ea18d` se extrajo en una carpeta temporal separada con el mismo `node_modules`, sin modificar el árbol de trabajo. El primer caso de `claves-textos.test.ts` (`-t 'todas las referencias reales'`) también agotó sus 60 s en la base: **1 fallido por timeout, 35 salteados** (`comparacion-base-claves.txt`). Esto reproduce el síntoma sin HU-I-05; los otros casos del archivo siguen sin una conclusión funcional. La copia temporal no se usó como evidencia de una suite general verde.
