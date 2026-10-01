# TASK: HU-C-08 — Consultar turnos asociados al profesor

**Módulo:** C (Turno) · **SP:** 2 · **Sprint:** 2
**Spec:** `docs/specs/spec_modulo_C.md` §2.4, §2.7 (filtro por profesor y selector), R5-12, §3.11 · `spec_modulo_D.md` §2.8 (servicios públicos)
**Pantalla:** mapa de pantallas §1, fila HU-C-08 (mismo listado `/turnos`, no pantalla nueva) · mockup «Noctium pantallas Sprint 2.pdf», pág. 4
**Base:** implementada sobre `origin/develop` @ `66966ab9ddbfd5d9618aafde163cbf2a7b5f3a87`; revisada y reaplicada sobre `9fe4f43` y `c5e8294`; **integrada en la rama `hu-restantes` @ `f69410a` (= `origin/develop`, con HU-I-01 #148 y HU-C-17 #149), 01/10/2026**, junto con el cierre de HU-C-09.

---

## 0. Relevamiento previo a implementación

### 0.1. Estado de la base

`listarTurnos()` ya tenía el punto de extensión `FiltrosListadoTurnos` que dejó HU-C-02 (§1.5 y §1.8 de su task). El alcance del Profesor se resolvía con `profesor: { is: { usuarioId } }` (una cuenta sin ficha veía una lista vacía). `ListarTurnosQuerySchema` no tenía `profesor_id` ni `.strict()`. No existía `GET /api/turnos/filtros/profesores`.

### 0.2. Archivos nuevos

- `src/app/api/turnos/filtros/profesores/route.ts` — selector (Gerente y Mesa de Entrada).
- Tests: `src/app/api/turnos/listado.route.test.ts`, `src/app/api/turnos/listado-sin-permiso.route.test.ts` (m-3), `src/app/(dashboard)/turnos/turnos-listado-profesor.test.tsx`, `src/server/turnos/turno.listado-profesor.pg.test.ts`.

### 0.3. Archivos existentes modificados

- `src/server/turnos/turno.schema.ts` — `profesor_id: z.string().cuid().optional()` y `.strict()`.
- `src/server/turnos/turno.service.ts` — `FiltrosListadoTurnos.profesor_id`, `alcanceProfesorListado()`, `listarOpcionesFiltroProfesor()`.
- `src/app/api/turnos/route.ts` — pasa `profesor_id` y traduce `SIN_PERMISO` (403) / `PROFESOR_NO_ENCONTRADO` (404).
- `src/lib/turno-listado.ts` — `urlListadoTurnos()` suma `profesorId`.
- `src/app/(dashboard)/turnos/page.tsx` y `turnos-listado.tsx` — selector, chip, «Limpiar», URL y mensaje vacío.
- Tests existentes ajustados: `turno.listado.test.ts` (el alcance del Profesor pasa a `profesorId`; se suma el bloque HU-C-08) y `src/lib/turno-listado.test.ts`.

### 0.4. Decisiones y alineación con la spec

1. **Alcance de fechas «desde hoy»:** el filtro conserva el alcance del listado de HU-C-01/C-02 (`fechaTurno >= hoy`). AC3 («cualquier estado») se cumple: no se filtra por estado. Ver turnos pasados de un profesor no es parte de esta HU. **Decisión del PO (01/10/2026):** el alcance «desde hoy» se mantiene en este sprint. Conducta conocida: un profesor que solo tiene turnos pasados ve «Este profesor no tiene turnos registrados».
2. **Selector para Gerente y Mesa de Entrada** (spec §2.7). El mockup de la pág. 4 está hecho con el rol Gerente; la spec y la ruta del selector habilitan también a Mesa de Entrada. **Decisión del PO (01/10/2026):** Mesa de Entrada también tiene el selector; se mantiene como está implementado. Pendiente formal: que el PO lo registre en el backlog o en el mapa de pantallas, que hoy solo nombran al Gerente.
3. **Profesor sin ficha → `403 SIN_PERMISO`** (spec §2.7 paso 1). Antes recibía una lista vacía. Su propio `profesor_id` equivale a no enviarlo; uno ajeno o inexistente responde el mismo `403` neutro.
4. **Mockup pág. 4:** selector «Profesor ▾» a la derecha del buscador, chip «Profesor: Nombre Apellido ×» y «Limpiar» junto al contador. La × quita solo el profesor; «Limpiar» quita profesor y búsqueda. Las opciones y el chip muestran «Nombre Apellido», como en el mockup; las filas siguen con «Apellido, Nombre».
5. **Columnas, orden y tamaño de página del listado sin cambios** (decisión ya tomada en HU-C-02 §1.7, puntos 2, 3 y 5): el mockup muestra otras columnas, «Ir a hoy» y el pie «Mostrando X–Y de N», que no son de esta HU.
6. **Mensaje vacío (AC4):** «Este profesor no tiene turnos registrados» con filtro de profesor y sin `q`, y también para el rol Profesor sin `q`. Con `q` sigue «No se encontraron turnos para «q»».
7. **Código del 400:** `VALIDACION`, como ya responde el listado (HU-C-02 §1.7 punto 7). `.strict()` hace que `materia_id`, `estados` y `solo_futuros` respondan `400`.

**Estado contractual:** los puntos 1 a 3 ya figuran como reglas vigentes en la spec C §2.4, §2.7 y R5-12; el selector para Mesa y el `403` neutro del Profesor están expresos allí, y los puntos 1 y 2 tienen además la decisión del PO del 01/10/2026. El punto 5 conserva decisiones vigentes de C-02. El punto 6 es el texto literal de AC4. El punto 7 reutiliza el contrato actual del listado. Ninguno cambia el alcance por rol de la spec.

**Definido por el prototipo (no son decisiones nuevas ni requieren ratificación):** prototipo `https://claude.ai/artifact/9VhY4YdPBzRXU4dhPrFnLo` (rol Gerente → Turnos):
- la opción «Todos» del selector;
- la × del chip quita solo el profesor; «Limpiar» quita profesor y búsqueda;
- el chip y «Limpiar» siguen visibles cuando no hay resultados;
- la vista del Profesor no tiene selector y, sin turnos, muestra el mensaje de AC4.

**Diferencia con el prototipo, fuera del alcance de C-08 (solo documentada, sin cambio de código):** en el prototipo «Limpiar» aparece también con búsqueda sin profesor y el contador dice «N turnos para «texto»». Ambas cosas corresponden a HU-C-02.

### 0.5. Revisión posterior a la entrega Cloud (01/10/2026)

**Reaplicación sobre `9fe4f43`:** `git apply --check` falló en un único hunk de imports de `src/server/turnos/turno.service.ts`. Diagnóstico: no era de espacios ni finales de línea; HU-C-12/C-13 agregaron `obtenerAlumnoDeUsuario` y `historial.publico` en las líneas de contexto. El patch trae los blobs de origen, así que se aplicó con `git apply --3way` sin conflictos; el resultado conserva los imports de C-12/C-13 y agrega `listarOpcionesProfesoresActivos`.

**Revisión contra spec C §2.7, R5-12, el backlog (AC1–AC4), el mapa de pantallas §1 y el mockup pág. 4:** sin cambios de código. Comprobado:
- Mismo listado `/turnos` (AC1); selector «Profesor» a la derecha del buscador, chip «Profesor: Nombre Apellido ×» y «Limpiar» junto al contador, como el mockup. El selector se muestra y su ruta responde solo a Gerente y Mesa de Entrada; el Profesor recibe `403` y no tiene selector.
- Filtro combinado con `q` y con la paginación; el cambio de filtro vuelve a la página 1 y queda en la URL y en el `retorno` de las filas (AC2).
- Cualquier estado (AC3): no se agrega filtro de estado; se conserva el alcance «desde hoy» de HU-C-01/C-02 (decisión 0.4, punto 1).
- `403 SIN_PERMISO` neutro: el Profesor recibe la misma respuesta para un `profesor_id` ajeno o inexistente; Gerente y Mesa reciben `404 PROFESOR_NO_ENCONTRADO`.
- `por_pagina` sin cambios: sigue opcional con máximo 20 y, si falta, el límite del parámetro `paginacion_limite_default` (HU-C-02 §1.7). No se amplía HU-C-02.
- Se conservan las acciones del listado de HU-C-05 («Descartar» en turnos `PENDIENTE`) y «Continuar configuración».

**Observación (I-3, no corregida por decisión):** si la URL trae un `profesor_id` que responde `403`/`404`, el listado muestra el error con «Reintentar», que repite la misma consulta. Gerente y Mesa pueden volver a «Todos» con el selector; el Profesor debe volver a entrar a «Turnos». Se conserva la conducta para no agregar diseño fuera del mockup (comprobado en navegador el 01/10, §7.4).

### 0.6. Reaplicación en `hu-restantes` y ajustes de revisión (01/10/2026)

**Reaplicación:** patch generado en el worktree `noctium-HU-C-08` con un índice temporal (`GIT_INDEX_FILE`, `read-tree HEAD`, `add -A`, `diff --cached --binary --full-index`), sin tocar el índice real. Lista: los 13 archivos de §0.2/§0.3, esta task incluida. `git apply --check` sobre `hu-restantes` (`f69410a`) **pasó sin `--3way`**: I-01 y C-17 no modificaron ninguno de los 8 archivos existentes del patch desde `c5e8294`. Se aplicó sin staging. El worktree de C-08 se conserva.

**Ajustes (m-1 a m-5):**
- **m-1:** test que monta el listado con `pagina={2}`, cambia el profesor y espera la consulta con `pagina=1` (`turnos-listado-profesor.test.tsx`).
- **m-2:** test con `total_paginas > 1` que verifica que los `href` de «Anterior» y «Siguiente» incluyen `profesor_id`.
- **m-3:** `src/app/api/turnos/listado-sin-permiso.route.test.ts`: ruta y servicio reales (solo Prisma mockeado, nunca el error); compara con `toEqual` el `403` de un Profesor con un `profesor_id` ajeno y con un CUID inexistente.
- **m-4:** mientras no llegan las opciones del selector, el chip no se muestra (antes decía «Profesor: seleccionado»); «Limpiar» sigue visible para quitar el filtro. Se eligió ocultar el chip completo, y no solo el nombre, porque un chip «Profesor:» sin nombre sería texto inventado y la × sin etiqueta no dice qué quita. Test agregado.
- **m-5:** nota de sincronización aditiva sobre `por_pagina` en spec C §2.7, redactada para revisión del SM; sin renumerar.
- Sin cambios en `por_pagina`, HU-C-02, «Descartar», «Continuar configuración» ni el alcance «desde hoy».

---

## 1. Nota de alcance

Mismo listado `/turnos`, con un filtro más. No toca el detalle, `presentar()`, `turno.publico.ts`, el calendario (J), `schema.prisma`, migraciones ni `seed.ts`.

## 2. Historia de Usuario

**Como** Gerente o el propio profesor, **necesito** consultar el listado de turnos de un profesor determinado, **para** revisar su carga de trabajo en formato de lista, no solo de calendario. **2 SP.** (Criterios 1 a 4: `HU-Sprint-2.md` §17 y la planilla oficial.)

## 3. Alcance

**Incluye:** `profesor_id` en `GET /api/turnos` (combinable con `q` y paginación, todos los estados), alcance por rol en el servidor, `GET /api/turnos/filtros/profesores`, selector, chip y mensaje vacío.

**Fuera de alcance (explícito):** filtros por estado, fecha o materia (HU-C-02 AC6), turnos pasados, cambio de columnas, «Ir a hoy», pie «Mostrando X–Y de N», el calendario de HU-J-01/J-03.

## 4. Contrato backend

| Ruta | Permiso | Éxito | Errores |
|---|---|---|---|
| `GET /api/turnos?profesor_id=&q=&pagina=` | `turnos:leer` | `200` mismo formato de §2.4 | `400 VALIDACION` (incluye `materia_id`/`estados`/`solo_futuros`) · `403 SIN_PERMISO` (Profesor con id ajeno/inexistente o sin ficha) · `404 PROFESOR_NO_ENCONTRADO` (Gerente/Mesa) |
| `GET /api/turnos/filtros/profesores` | `turnos:leer` + rol `GERENTE`/`MESA_ENTRADA` | `200` `[{ id, nombre, apellido }]` (activos, vía `listarOpcionesProfesoresActivos()` de D) | `403 SIN_PERMISO` (Profesor) |

## 5. Frontend

`page.tsx` pasa `profesorId` (de la URL), `puedeFiltrarProfesor` (Gerente/Mesa) y `esProfesor`. `TurnosListado` incluye `profesor_id` en la consulta, en `replaceState`, en el paginador y en el `retorno` de cada fila («Volver al listado» conserva el filtro). Elegir o quitar el profesor vuelve a la página 1 y conserva `q`.

## 6. Testing

Ver la sección 7. Niveles de `docs/adicionales/sdd-metodologia.md`:

1. **Unit:** servicio (`turno.listado.test.ts`), rutas (`listado.route.test.ts`), helpers y componente (`turnos-listado-profesor.test.tsx`).
2. **Postman (contrato de API):** `docs/testing/HU-C-08.postman_collection.json` (convención de `HU-I-01.postman_collection.json`). Variables de entorno vacías (`baseUrl`, `email` = Mesa de Entrada, `emailGerente`, `emailProfesor`, `password`); cada carpeta inicia sesión en tiempo de ejecución con el flujo real de NextAuth y no guarda cookies ni tokens en el archivo. Corrida en §7.4.
3. **BD:** `turno.listado-profesor.pg.test.ts` contra PostgreSQL real y comparación, por profesor, del total y los estados de la API con una consulta SQL directa.

## 7. Verificación ejecutada

### 7.1. Entrega Cloud (01/10/2026, base `66966ab`) — registro histórico

Node 24.21.0 · PostgreSQL 16.14 local aislado de la sesión (`noctium_c08_dev` / `noctium_c08_test`).

- `npx tsc --noEmit`: OK · `npm run lint`: OK · `npm run build`: OK (ruta `/api/turnos/filtros/profesores`).
- `npx vitest run`: 94 archivos OK / 12 omitidos; 1298 tests OK / 62 omitidos.
- Tests PostgreSQL: `turno.listado-profesor.pg.test.ts` 4/4 OK (cancelados y pendientes incluidos, combinación con `q` y paginación, profesor inactivo `404`, alcance del Profesor). **Falla preexistente, igual en la base:** `turno.reservas.pg.test.ts` › «asignar profesor y alumnos confirma…». Tests PG de C-05, C-06 y C-10 contra `noctium_test`: 18/18 OK.
- App real (`next start`, sesión real, Playwright): 16/16 casos OK. Gerente: selector con 20 profesores activos; filtro por Giménez → 7 turnos, todos suyos; combinado con `q`; `profesor_id` mal formado y `materia_id` → `400`; profesor inexistente → `404`. Mesa: selector `200`. Profesor: selector `403`; sin parámetro ve solo sus 7 turnos; su propio id → `200`; ajeno o inexistente → `403`. UI: URL con `profesor_id`, chip, AC4 con un profesor sin turnos, «Limpiar» quita el filtro y el Profesor no ve el selector.

### 7.2. Revisión (01/10/2026, base `9fe4f43`) — arnés alternativo, registro histórico

Node 24.21.0 · PostgreSQL 16.15 aislado (bases `noctium_c08_test`, `noctium_c08_dev`). Sin motor nativo de Prisma (red bloqueada a `binaries.prisma.sh`):

**a) Sin motor de Prisma en ejecución (cliente generado con el generador nativo):**
- `npx tsc --noEmit`: OK · `npm run lint`: OK.
- `npx vitest run --exclude "**/*.pg.test.ts"`: 100 archivos / 1352 tests OK, sin errores no controlados.
- `next build --webpack`: OK (ruta `/api/turnos/filtros/profesores`), con fuentes locales en lugar de Google Fonts. Turbopack **no se pudo ejecutar** en este entorno.

**b) Arnés alternativo (PostgreSQL real; Prisma con adaptador `pg`):**
- `*.pg.test.ts` con `HU_C15_TEST_DATABASE_URL`: 9 archivos / 44 tests OK, incluido `turno.listado-profesor.pg.test.ts` 4/4 y `turno.reservas.pg.test.ts` (la falla de 7.1 ya está corregida en esta base).
- Contra `noctium_test`: C-05 7/7, C-10 2/2, C-13 1/1. **C-06 (`turno.reprogramacion.pg.test.ts`): 2 fallas** en la traducción del error de exclusión `23P01`; las mismas aparecen en la revisión de HU-I-01, ninguna de las dos HU toca la reprogramación ni `turno.reserva-error.ts`, y son atribuibles al arnés. **Pendiente de confirmar con el motor nativo.**
- Contrato HTTP contra la app real (`next start`, sesión real de seed): 20/20 casos OK. Selector: Gerente y Mesa `200`, Profesor `403`. Profesor: sin parámetro solo sus turnos; su propio id equivale a no enviarlo; ajeno e inexistente `403` con cuerpo idéntico. Gerente: filas solo del profesor, alcance desde hoy, `q` + filtro, `por_pagina=1&pagina=2` con el mismo total, sin `por_pagina` el límite configurado (10), `por_pagina=21` `400`, `profesor_id` mal formado / `materia_id` / `estados` `400`, inexistente `404`. Mesa filtra igual.
- Total y estados por profesor iguales a SQL directo en los 5 profesores con turnos desde hoy (incluye uno con turnos `CANCELADO`). Los `PENDIENTE` con profesor se cubren en la prueba PG.

**c) Bloqueado en este entorno (pendiente en una máquina del equipo):**
- PostgreSQL con el motor nativo de Prisma.
- `npm run build` con Turbopack y fuentes reales.
- Navegador (Playwright no pudo descargarse): selector, chip, «Limpiar», URL y mensaje de AC4.

### 7.3. Integración local sobre `origin/develop` (`c5e8294`, 01/10/2026)

Worktree independiente `C:\Users\xRamex\AppData\Local\Temp\noctium-HU-C-08`, rama `feature/HU-C-08_turnos-profesor`; paquete de base `9fe4f43`. `git apply --check` y aplicación directos sobre `origin/develop`, sin merge, staging ni commit. Los 13 archivos del patch coinciden con `ARCHIVOS.txt`; el único cambio adicional es esta actualización de task. Se conservan C-05, C-06, C-10, C-12/C-13 y las acciones del listado.

Entorno: Windows, Node 24.19.0, PostgreSQL 16 en contenedor exclusivo `noctium_hu_patch_pg`, base `noctium_c08_test`; para las regresiones que exigen el nombre `noctium_test` se usó la otra base del mismo contenedor. Motor nativo de Prisma 6.19.3. `npm ci`, `npx prisma generate`, `npx next typegen`, `npx prisma migrate deploy` (34 migraciones), `npx tsc --noEmit`, `npm run lint` y `npm run build` con Turbopack y fuentes reales: **OK**.

- Unitarias sin archivos PG: **105 archivos, 1427 tests OK**.
- PostgreSQL nativo: suite `pg.test` **9 archivos, 44 tests OK** y 4 archivos omitidos por la guarda de nombre de base; incluye `turno.listado-profesor.pg.test.ts` 4/4. Regresiones C-05/C-06/C-10/C-13 contra `noctium_test`: **4 archivos, 19 tests OK**; C-06 9/9, incluidas las dos traducciones `23P01` que fallaban en el arnés alternativo.
- HTTP autenticado contra `next start`: selector Gerente y Mesa 200, Profesor 403; Profesor solo ve turnos propios; id ajeno e inexistente reciben `403` con cuerpo idéntico; Gerente combina `profesor_id`, `q` y `por_pagina=1&pagina=2` con total coherente.
- Chrome headless: listado real con selector a la derecha del buscador; al elegir Laura Giménez, la URL conserva `profesor_id`, aparecen chip y «Limpiar», quedan 15 turnos del profesor y «Ver detalle» sigue disponible. «Limpiar» quita el parámetro, el profesor activo Lucía Álvarez sin turnos muestra el mensaje AC4 y una fila `PENDIENTE` del listado de Mesa mantiene «Descartar» (C-05). Capturas temporales fuera del repositorio. La comparación con el mockup de pág. 4 confirma posición del selector, chip y tabla existente.

El historial Cloud (§7.1) y el arnés alternativo (§7.2) permanecen separados de esta verificación. §7.3 queda como registro histórico de la integración sobre `c5e8294`.

### 7.4. Corrida local en `hu-restantes` (`f69410a` + C-08 + C-09, 01/10/2026) — Prisma nativo

Windows 11, Node 24.19.0, Prisma 6.19.3 (motor nativo), Next.js 16.3.8. Copia aislada del árbol de trabajo fuera del repositorio, para no interferir con un `next dev` local. PostgreSQL 16.15 en un contenedor exclusivo de esta verificación (`noctium_c08c09_verif_pg`, solo `127.0.0.1`), con tres bases: `noctium_c0809_test` (suite `pg.test`), `noctium_test` (regresiones C-05/C-06/C-10/C-13) y `noctium_c0809_dev` (seed, HTTP y navegador). Las tres con `prisma migrate deploy`.

- `npm ci`, `npx prisma generate`, `npx next typegen`, `npx tsc --noEmit`, `npm run lint` y `npm run build` (Turbopack, fuentes reales): **OK**.
- `npx vitest run` sin base: **116 archivos / 1613 tests OK**, 15 archivos / 84 tests omitidos (suites PG sin variables).
- `pg.test` con `DATABASE_URL = HU_C15_TEST_DATABASE_URL` (`noctium_c0809_test`):
  - **en paralelo: 1 falla** en `alumno.publico.pg.test.ts` › «agrupa por mes de Buenos Aires…» (esperado 1, recibido 2). El test mide la diferencia de alumnos creados en 2026-10 y otro archivo PG crea un alumno «hoy» al mismo tiempo; no toca C-08 ni C-09. Se repitió dos veces con el mismo resultado;
  - **con un worker:** 10 archivos / **49 tests OK**, 5 archivos omitidos por guarda; incluye `turno.listado-profesor.pg.test.ts` 4/4.
- Regresiones C-05/C-06/C-10/C-13 contra `noctium_test`: **4 archivos / 19 tests OK**, en paralelo y con un worker.
- HTTP autenticado (`next start`, login real por NextAuth): **32/32 casos OK** (16 de C-08). Selector: Gerente y Mesa `200` (21 profesores activos), Profesor `403`, sin sesión `401`. Gerente: 15 de 34 turnos para el profesor elegido, todos suyos; combinado con `q`; `por_pagina=1&pagina=2` con el mismo total; profesor sin turnos `200` con `items: []`; inexistente `404`; mal formado y `materia_id` `400`. Mesa filtra igual. Profesor: solo sus 15 turnos; su id equivale a no enviarlo; ajeno e inexistente `403` con cuerpo idéntico.
- Postman con newman 6: **26 requests / 64 aserciones OK**.
- Chrome (navegador real):
  - **Gerente:** selector a la derecha del buscador con «Todos» y 21 profesores. Al elegir a Laura Giménez: URL con `profesor_id` y `pagina=1`, chip «Profesor: Laura Giménez ×», «Limpiar», «15 turnos», filas solo suyas y «Ver detalle» con el filtro en `volver`. Paginador «Página 1 de 2» con `profesor_id` en los `href`; «Siguiente» conserva filtro y chip. Cambiar de profesor desde la página 2 vuelve a la 1. AC4 con un profesor activo sin turnos: mensaje, chip y «Limpiar» visibles. La × quita solo el profesor. Búsqueda «fisica» + profesor: 4 turnos de Física; «Limpiar» vacía la búsqueda, el selector y la URL (34 turnos).
  - **Mesa:** mismo selector y chip, y «Configurar turno».
  - **Profesor:** sin selector, 15 turnos propios. Con un `profesor_id` ajeno en la URL: aviso «No tenés permisos para ver los turnos de ese profesor» con «Reintentar» (I-3).
- Capturas y logs fuera del repositorio.

### 7.5. Estado de los criterios (01/10/2026)

| AC | Estado | Evidencia |
|---|---|---|
| 1. Mismo listado, filtrable por profesor | Cumple | Componente y rutas (§6); HTTP y Chrome con Gerente, Mesa y Profesor (§7.4) |
| 2. Combinable con búsqueda y paginación | Cumple | m-1, m-2; PG 4/4; HTTP `q` y `por_pagina=1&pagina=2`; Chrome página 2 y vuelta a la 1 |
| 3. Turnos en cualquier estado | Cumple | PG (cancelados y pendientes incluidos); sin condición de estado en el `where` |
| 4. «Este profesor no tiene turnos registrados» | Cumple | Componente; HTTP `200 []`; Chrome con chip y «Limpiar» visibles |

## 8. Checklist DoD

- [x] Mismo listado, sin pantalla nueva (AC1); selector solo Gerente/Mesa; Profesor sin selector.
- [x] Combinable con búsqueda y paginación (AC2); cualquier estado (AC3); mensaje vacío (AC4).
- [x] Alcance por rol resuelto en el servidor (R5-12); servicios públicos de D (Regla 3).
- [x] Tests unit, rutas y componente.
- [x] PostgreSQL real y contrato HTTP (arnés alternativo, 7.2 b).
- [x] PostgreSQL con el motor nativo de Prisma, incluido C-06 (7.3).
- [x] Colección Postman del contrato (§6, nivel 2): `docs/testing/HU-C-08.postman_collection.json`, 64/64 aserciones (§7.4).
- [x] Ajustes de revisión m-1 a m-5 (§0.6) y verificación en `hu-restantes` (§7.4).
- [ ] Registro formal en el backlog o en el mapa de pantallas del selector para Mesa de Entrada (decisión del PO del 01/10, §0.4 punto 2).
- [x] Verificación local en Chrome headless de selector, chip, URL y listado filtrado (7.3).
- [ ] Confirmación explícita del relevamiento de la sección 0 (paso 5 de la metodología): no consta en este documento.
