# Validación PO — HU-G-05 · Desactivar y reactivar gerente

**Rama revisada:** `feature/HU-C-27` @ `1f503e9` (= `develop`). La HU entró con el commit `fb64e50 feat(G05): desactivar y reactivar gerente`, ya incluido en `HEAD`. El árbol tiene cambios sin commitear **de HU-C-27** (turnos, `textos.ts`, `RULES.md`, una migración de índices), pero **ninguno toca archivos de HU-G-05**: `src/server/gerentes/**`, `src/app/(dashboard)/gerentes/**`, `src/app/api/gerentes/**` y la fixture `hu-g-05.ts` están iguales a `HEAD`, y el diff de `textos.ts` no tiene ninguna clave `gerente`.
**Fuente de verdad:** el texto de la HU del pedido de validación. Coincide palabra por palabra con `docs/tasks/Sprint 3/HU-Sprint-3.md` (líneas 727-733).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md` (reglas generales y «Aplicación HU-G-05»), `docs/DESIGN.md` (§6.3 y §6.4, filas de G-05, historial), `prisma/seed.ts` y la fixture `prisma/seed/fixtures/hu-g-05.ts`, `docs/specs/spec_modulo_G.md` (§2.4 a §2.6, §3.4, §3.7 y la nota de implementación de G-05), `docs/tasks/Sprint 3/Modulo G/HU-G-05.md`, `docs/tasks/Sprint 3/HU-Sprint-3.md` (convenciones 7 a 9) y `docs/tasks/Sprint 3/PR-0.md` (es el documento de developers del Sprint 3; no hay otro en `docs/`).

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `vitest run` de la HU (`src/server/gerentes`, `src/app/(dashboard)/gerentes`, `src/app/api/gerentes`) | **12 archivos, 327 tests en verde** (2 archivos PG omitidos en esta pasada, sin base) |
| `npm run test:pg -- src/server/gerentes` (base descartable) | `gerente.estado.pg.test.ts` (el de esta HU): **15/15 en verde**. `gerente.service.pg.test.ts` (G-01/G-03): 1 `beforeAll` superó el límite de 10 s (crea fichas con bcrypt) y se saltearon 7 tests. **Corrido solo: 24/24 en verde.** Es lentitud de la máquina, no un defecto de G-05 |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador HU-C-23) | «Claves de textos verificadas.» |
| `npx eslint` sobre los archivos de la HU | Sin errores ni avisos |
| `vitest run` completo | **306 archivos en verde, 1 con fallos por timeout**: `src/lib/claves-textos.test.ts` (2 tests) superó los 60 s con la suite completa en paralelo. **Corrido solo: 36/36 en verde (144 s).** Mismo caso ya visto al validar HU-G-03; no es de esta HU |
| Consulta **de solo lectura** a la base de desarrollo (`fichas_gerente` + `usuarios` + `historial_estados`) | 20 fichas; las 4 de la fixture G-05 en el estado esperado (ver sección 6) |

---

## 1. Trazabilidad de criterios

Archivos principales: servicio `src/server/gerentes/gerente.service.ts`, schemas `src/server/gerentes/gerente.schema.ts`, Server Actions `src/server/gerentes/actions.ts`, rutas `src/app/api/gerentes/[id]/desactivar/route.ts` y `.../reactivar/route.ts`, ficha `src/app/(dashboard)/gerentes/[id]/page.tsx`, diálogo `.../[id]/estado-gerente-dialog.tsx`, historial `.../[id]/historial-estados-gerente.tsx`.

| # | Criterio (viñeta) | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1a | «Desactivar» desde la ficha solicita confirmación con el texto literal | Botón en `page.tsx:120` → `EstadoGerenteDialog`; confirmación con `ConfirmarAccionDialog` (HU-C-25) y título `ui.gerentes.baja.titulo` (`estado-gerente-dialog.tsx:100-104`) | **CUBIERTO** | Texto idéntico, `<gerente>` = «{nombre} {apellido}». Baja reversible: `destructiva` sin `irreversible` |
| 1b | La confirmación pide un motivo de hasta 300 caracteres | Textarea con `maxLength=300` y contador «n / 300» (`estado-gerente-dialog.tsx:110-128`); servidor: `DesactivarGerenteSchema` `.trim().max(300)` (`gerente.schema.ts:71-83`) | **CUBIERTO** | El tope se valida en los dos lados; 301 → `400 VALIDATION_ERROR` con el mensaje de `textos.ts` |
| 1c | Motivo obligatorio cuando el gerente registró operaciones | Servidor: `usuarioRegistroOperaciones(tx, usuarioId)` → `MOTIVO_REQUERIDO` (`gerente.service.ts:411-414`). Pantalla: `motivoObligatorioAlDesactivar` del detalle (`:329, :350`) deshabilita «Desactivar» con el campo vacío (`dialog.tsx:108`) | **CUBIERTO** | Agregador común de F-05 (DEC-39). Un gerente que dio de baja a otro ya «registró operaciones» (test PG). Sin cuenta: opcional. Si viene motivo, se guarda aunque no sea obligatorio |
| 2a | La acción no aparece en su propia ficha | `muestraEstado = puedeCambiarEstado && !(gerente.activo && gerente.esVos)` (`page.tsx:83`) | **CUBIERTO** | Test de pantalla: con permiso, la ficha propia no muestra «Desactivar» |
| 2b | El servidor rechaza el intento | `desactivarGerente`, paso 1, antes de tomar bloqueos: `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` 422 (`gerente.service.ts:391-395`) | **CUBIERTO** | Test PG: 422 sin cambiar ficha, cuenta ni historial, incluso con versión vieja |
| 3a | No se puede desactivar al último gerente activo (ficha activa con cuenta activa): «Debe quedar al menos un gerente activo» | `sinOtroGerenteActivo` (`gerente.service.ts:289-294`): cuenta fichas activas **con** cuenta activa (`filtrarCuentasActivas`), sin el objetivo → `ULTIMO_GERENTE_ACTIVO` 409 (`:410`). Pantalla: aviso informativo si `esUltimoGerenteActivo` (`dialog.tsx:54-58, 140-153`); si cambia después, el rechazo aparece en el modal | **CUBIERTO** | Fichas sin cuenta o con cuenta inactiva no cuentan (test PG «único gerente activo con cuenta…») |
| 3b | Verificación y desactivación en la misma transacción, después de bloquear **todas** las fichas de gerente activas | `transaccion(...)` (READ COMMITTED) → lee ids de fichas activas, `bloquear(tx, { fichasGerente: [...activas, id] })` (`SELECT … FOR UPDATE` ordenado por id, `bloquear.ts:147`), **relee** y cuenta sobre la relectura (`gerente.service.ts:397-410`) | **CUBIERTO** | Opción «bloquear todas las fichas activas» del criterio. Tests PG: dos bajas cruzadas (A↔B) en los dos órdenes y sin pausas → una confirma y la otra `ULTIMO_GERENTE_ACTIVO`; lectura vieja con relectura posterior al bloqueo; tres gerentes con dos bajas simultáneas confirman las dos |
| 4a | La ficha y su cuenta pasan a inactivas | `updateMany` condicionado (`activo: true, version`) + `desactivarCuenta(tx, usuarioId)` en la misma transacción (`gerente.service.ts:416-423`) | **CUBIERTO** | Test PG de rollback: si falla la cuenta, la ficha sigue activa y no queda historial |
| 4b | Después de confirmada la operación, la baja queda en el historial de estados (fecha, usuario y acción) | `registrarCambioEstado` (entidad `FICHA_GERENTE`, `DESACTIVAR`, motivo, actor) encolado con `despuesDelCommit` (`gerente.service.ts:424`); se muestra en «Historial de estados» (`historial-estados-gerente.tsx`) con acción, fecha y hora, usuario y motivo | **CUBIERTO** | Opción (b) de la Regla N.° 2. Test: encolado para después del commit y descartado si revierte |
| 4c | Se revocan sus sesiones vigentes (mismo mecanismo que HU-D-08 c4) | `desactivarCuenta` → `revocarSesiones` fija `sesionesValidasDesdeUsuario` (`cuenta.service.ts:116-132`); `withPermission` rechaza con 401 una cuenta inactiva o una sesión anterior al umbral (`with-permission.ts:115-128`) | **CUBIERTO** | Es exactamente la misma función que usa D-08. Test PG verifica el umbral |
| 4d | Las operaciones que registró se conservan con su nombre | Sin `DELETE`; `obtenerNombresPersonal` resuelve nombres de gerentes sin filtrar por activo (`personal.publico.ts`) | **CUBIERTO** | Test PG «nada se borra y su nombre se sigue resolviendo» |
| 5a | Se informa «Gerente desactivado correctamente» | `toast.success(ui.gerentes.baja.exito)` + `router.refresh()` (`dialog.tsx:134-137`) | **CUBIERTO** | Literal exacto |
| 5b | Sigue en el listado con la etiqueta «Inactivo» | El listado (G-03) no filtra por estado; `Badge` «Inactivo» y fila atenuada (`listado-gerentes.tsx:145-170`); la acción revalida `/gerentes` (`actions.ts:103-106`) | **CUBIERTO** | Test PG «el listado refleja el estado». La ficha también muestra «Inactivo» junto al nombre (`page.tsx:109`) |
| 6a | Desde la ficha del inactivo, «Reactivar» pide confirmación «¿Estás seguro de que querés reactivar a <gerente>?» | Mismo componente; título `ui.gerentes.reactivacion.titulo` con `ConfirmarAccionDialog`, sin motivo | **CUBIERTO** | Literal exacto |
| 6b | Vuelve a estado Activo; la reactivación queda en el historial después de confirmada (se conservan todas las bajas y reactivaciones) | `reactivarGerente` (`gerente.service.ts:438-463`): bloqueo de la ficha, relectura, `updateMany` condicionado a inactiva y `version`, `registrarCambioEstado` `REACTIVAR` post-commit | **CUBIERTO** | Test PG: varias bajas y reactivaciones conservan todas las filas. Sin regla de «último gerente» (reactivar solo suma) |
| 6c | Se informa «Gerente reactivado correctamente» | `toast.success(ui.gerentes.reactivacion.exito)` | **CUBIERTO** | Literal exacto |
| 6d | Si tenía cuenta, vuelve a quedar activa y debe iniciar sesión de nuevo | `reactivarCuenta` (no toca `sesionesValidasDesde`, así que las sesiones viejas siguen inválidas) (`cuenta.service.ts:135-138`) | **CUBIERTO** | Test PG: umbral de sesiones y marca de cambio de contraseña conservados. El modal lo avisa |
| 7 | Solo el Gerente; el servidor rechaza con 403 a otros roles | Rutas `withPermission("gerentes:cambiar_estado")`; Server Actions `verificarPermiso` **antes** de Zod (`actions.ts:118, 136`); página `exigirPermiso("gerentes:leer")` + proxy; permiso sembrado solo para GERENTE (`seed.ts:981`, migración `20261008120200_sprint3_permisos`) | **CUBIERTO** | Tests de rutas: 403 para MESA_ENTRADA, PROFESOR y ALUMNO; 401 sin sesión |

**Desvíos task ↔ HU:** no hay desvíos en la implementación. Hay uno **solo documental**: la tabla 9.1 de la task numera los criterios distinto que la HU. Por ejemplo, llama «c7» a «desactivar la ficha desactiva la cuenta» (en la HU, c7 es «solo el Gerente») y reparte el contenido de c4/c5. Todo lo que pide la HU está cubierto igual. Conviene corregir esa tabla para que el informe de cierre no confunda.

---

## 2. Textos literales (HU-C-23)

| Criterio | Texto de la HU | Clave en `src/lib/textos.ts` | ¿Coincide? |
|---|---|---|---|
| 1 | «Desactivar» | `ui.gerentes.ficha.desactivar` / `ui.gerentes.baja.confirmar` = «Desactivar» | Sí |
| 1 | «¿Estás seguro de que querés desactivar a <gerente>? No podrá ingresar al sistema.» | `ui.gerentes.baja.titulo` = «¿Estás seguro de que querés desactivar a {nombre} {apellido}? No podrá ingresar al sistema.» | Sí |
| 3 | «Debe quedar al menos un gerente activo» | `errores.gerente.ultimoGerenteActivo` = «Debe quedar al menos un gerente activo» (sin punto, igual que la HU) | Sí |
| 5 | «Gerente desactivado correctamente» | `ui.gerentes.baja.exito` | Sí |
| 5 | «Inactivo» | `ui.gerentes.estado.inactivo` | Sí |
| 6 | «Reactivar» | `ui.gerentes.ficha.reactivar` / `ui.gerentes.reactivacion.confirmar` | Sí |
| 6 | «¿Estás seguro de que querés reactivar a <gerente>?» | `ui.gerentes.reactivacion.titulo` = «¿Estás seguro de que querés reactivar a {nombre} {apellido}?» | Sí |
| 6 | «Gerente reactivado correctamente» | `ui.gerentes.reactivacion.exito` | Sí |

**No coincide ninguno: 0 diferencias.**

**Textos que la HU no fija y la task marca como «propuestos, a validar por el PO»** (decidir en la prueba manual):

| Clave | Texto |
|---|---|
| `errores.gerente.noPuedeDesactivarseASiMismo` | «No podés desactivarte a vos mismo.» |
| `errores.gerente.motivoRequerido` | «Ingresá el motivo de la baja: el gerente registró operaciones.» |
| `errores.gerente.motivoDemasiadoLargo` | «El motivo admite hasta 300 caracteres.» |
| `errores.gerente.yaInactivo` / `yaActivo` | «El gerente ya está inactivo.» / «El gerente ya está activo.» |
| `ui.gerentes.baja.detalle` / `detalleSinCuenta` | «Las operaciones que registró se conservan con su nombre. Su cuenta pasa a inactiva y se cierran todas sus sesiones.» / «… No tiene una cuenta de acceso vinculada.» |
| `ui.gerentes.baja.motivo` / `motivoOpcional` / `motivoObligatorio` | «Motivo de la baja» / «Opcional» / «Obligatorio: tiene operaciones registradas» |
| `ui.gerentes.baja.ultimoActivoTitulo` / `cerrar` | «No se puede desactivar al gerente» / «Cerrar» |
| `ui.gerentes.reactivacion.detalle` / `detalleSinCuenta` | «Su cuenta vuelve a quedar activa. Las sesiones cerradas en la baja no se restauran: tiene que iniciar sesión de nuevo.» / «Vuelve a figurar como activo. No tiene una cuenta de acceso vinculada.» |
| `ui.gerentes.historial.*` | «Historial de estados», «Sin bajas ni reactivaciones.», «Desactivación», «Reactivación», «Usuario» |

---

## 3. Reglas de servidor

| Regla | Verificación | Estado |
|---|---|---|
| Validación Zod (Regla N.° 6) | `DesactivarGerenteSchema` `{ motivo?: string (trim, ≤300, vacío = no enviado), version: int ≥0 }.strict()` y `ReactivarGerenteSchema { version }.strict()`. Campo ajeno, `version` faltante, cuerpo ausente o motivo de 301 → `400 VALIDATION_ERROR` con `detalles` | OK |
| Permisos (Regla N.° 10, c7) | `withPermission` / `verificarPermiso("gerentes:cambiar_estado")`, solo GERENTE en seed y migración. Las acciones verifican el permiso **antes** de Zod: otro rol no recibe ni siquiera un 400 | OK |
| Lógica en el servicio (Regla N.° 4) | Rutas y acciones solo validan, llaman al servicio y traducen `ErrorDeDominio` | OK |
| Concurrencia (Regla N.° 7 y c3) | La baja abre una transacción READ COMMITTED, hace `FOR UPDATE` de **todas** las fichas activas más la objetivo (en una sola llamada y por id ascendente, sin interbloqueos), relee, cuenta y escribe con `updateMany` condicionado a `activo` + `version` (`count === 0` → 409). Reactivar bloquea la ficha y usa el mismo `updateMany` condicionado. Las cuentas no se bloquean, pero ninguna otra operación del sistema desactiva cuentas de gerente sin pasar por este bloqueo | OK |
| Sin borrado físico (Regla N.° 1) | Baja lógica (`activoFichaGerente=false`, cuenta inactiva); motivo en el historial; DNI y email siguen reservados (test PG) | OK |
| Trazabilidad (Regla N.° 2) | Opción (b) `historial_estados` después del commit + opción (a) `version`/`modificadoPorUsuarioId` en la misma fila | OK |
| Registros nuevos en lugar de modificar (Regla N.° 8) | Cada baja o reactivación **inserta** una fila nueva en `historial_estados`; ninguna se actualiza ni se borra (test PG con varias bajas y reactivaciones) | OK |

### Endpoints

| Método | Ruta | Permiso | Respuestas |
|---|---|---|---|
| `POST` | `/api/gerentes/[id]/desactivar` — cuerpo `{ "version": n, "motivo"?: "…" }` | `gerentes:cambiar_estado` | `200 { data: { id, activo: false, version } }` · `400 VALIDATION_ERROR` / `MOTIVO_REQUERIDO` · `401` · `403 SIN_PERMISO` · `404 GERENTE_NO_ENCONTRADO` · `409 GERENTE_YA_INACTIVO` / `ULTIMO_GERENTE_ACTIVO` / `CONFLICTO_EDICION_CONCURRENTE` · `422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO` |
| `POST` | `/api/gerentes/[id]/reactivar` — cuerpo `{ "version": n }` | `gerentes:cambiar_estado` | `200 { data: { id, activo: true, version } }` · `400` · `401` · `403` · `404` · `409 GERENTE_YA_ACTIVO` / `CONFLICTO_EDICION_CONCURRENTE` |
| `GET` | `/api/gerentes/[id]` (ficha, con `version`, `esVos`, `historialEstados`, `motivoObligatorioAlDesactivar`, `esUltimoGerenteActivo`) | `gerentes:leer` | `200` · `401` · `403` · `404` |
| Server Actions | `desactivarGerente(id, datos)` / `reactivarGerente(id, datos)` en `src/server/gerentes/actions.ts` (las usa la pantalla) | `gerentes:cambiar_estado` | `{ data, error }` con los mismos códigos |
| (pantalla) | `/gerentes/[id]` | `exigirPermiso("gerentes:leer")` + proxy | Otros roles → `/sin-permiso` |

### Snippets para comprobar el 403

**Paso previo, con sesión de Gerente** (`gerente@noctium.local`), para anotar los ids de las fichas de prueba:

```js
fetch("/api/gerentes?q=prueba baja").then(r => r.json()).then(j => console.table(j.data.items.map(g => ({ id: g.id, nombre: `${g.apellido}, ${g.nombre}`, dni: g.dni, activo: g.activo }))));
```

**Con sesión de Mesa de entrada, Profesor o Alumno** (F12 → Console, en cualquier pantalla de `http://localhost:3000`). Reemplazar `<ID_ACTIVO>` por el id de Lucas (88066001) y `<ID_INACTIVO>` por el de Camila (88066004):

```js
// 1) Desactivar: 403 SIN_PERMISO (el permiso se verifica antes que el cuerpo)
fetch("/api/gerentes/<ID_ACTIVO>/desactivar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 0, motivo: "prueba" }) })
  .then(async r => console.log(r.status, await r.json()));

// 2) Reactivar: 403 SIN_PERMISO
fetch("/api/gerentes/<ID_INACTIVO>/reactivar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 1 }) })
  .then(async r => console.log(r.status, await r.json()));

// 3) Cuerpo inválido: sigue siendo 403, no 400 (no revela nada a otro rol)
fetch("/api/gerentes/<ID_ACTIVO>/desactivar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: false }) })
  .then(async r => console.log(r.status, await r.json()));

// 4) Ficha: 403
fetch("/api/gerentes/<ID_ACTIVO>").then(async r => console.log(r.status, await r.json()));
```

Esperado: `403 { data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" } }`. Ninguno cambia datos.

**Criterio 2 por HTTP, con sesión de Gerente sobre su PROPIA ficha** (por ejemplo `gerente@`, id de «Paredes, Silvia» en el listado):

```js
const ID = "<ID_PROPIO>";
const { data } = await (await fetch(`/api/gerentes/${ID}`)).json();
console.log("esVos:", data.esVos, "version:", data.version);
fetch(`/api/gerentes/${ID}/desactivar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: data.version, motivo: "prueba" }) })
  .then(async r => console.log(r.status, await r.json())); // 422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO, sin ningún cambio
```

---

## 4. Definición de Terminado

| Ítem | Estado |
|---|---|
| Textos visibles en el archivo central | **Cumple.** Todos los textos de la ficha, el diálogo, el aviso, el historial y los errores salen de `texto(...)`; el comprobador de HU-C-23 aprueba |
| Ningún texto visible dice «turno» | **Cumple.** Ninguna clave `ui.gerentes.*` ni `errores.gerente.*` lo contiene. La ficha importa `fechaCorta`/`fechaHoraDeInstante` desde `@/lib/turno-detalle`, pero es solo el nombre del módulo, no un texto visible |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | **Cumple.** Desactivar y reactivar usan `ConfirmarAccionDialog`. El aviso del último gerente activo es un `Dialog` informativo que **no guarda nada** (excepción documentada en DESIGN.md §6.3) |
| Tests en verde | **Cumple con observación.** Los tests de la HU pasan: 327 unitarios y 15/15 con PostgreSQL. En la suite completa hubo 2 timeouts en `claves-textos.test.ts` (36/36 en verde corrido solo) y 1 `beforeAll` lento en el PG de G-03 (24/24 en verde corrido solo). No son de esta HU, pero el equipo debería subirles el límite de tiempo para que la suite completa no dé falsos rojos |

**Incumplimientos: ninguno.**

---

## 5. Extras y violaciones

### Implementado sin que la HU lo pida

- **Aviso informativo «No se puede desactivar al gerente»**, que se abre en lugar de la confirmación cuando la ficha ya indica que es el último gerente activo (lo pide la spec G, no la HU). Con datos consistentes casi no se alcanza (ver 6.c3).
- **Errores 409 «ya inactivo» / «ya activo»** y conflicto de versión (`version` obligatoria en el cuerpo). Al cerrar el modal después de un rechazo, la ficha se refresca.
- **Fichas sin cuenta de acceso** (fixtures): se pueden desactivar y reactivar, con detalle propio en el modal.
- **Rutas HTTP además de las Server Actions** (la pantalla usa las actions; las rutas sirven para Postman y los tests).
- **Detalle del gerente ampliado** con `historialEstados`, `motivoObligatorioAlDesactivar` y `esUltimoGerenteActivo`. El historial muestra también el **motivo**: la HU pide fecha, usuario y acción.
- El modal de reactivación avisa que las sesiones cerradas no se restauran.
- Fixture `hu-g-05.ts` con 4 gerentes de prueba.

Todo es coherente con la HU y no le cambia el alcance.

### Violaciones / puntos a mirar respecto de RULES.md / DESIGN.md

- **Ninguna violación** de las reglas 1 a 11 ni de DESIGN.md. Los colores usan tokens (`destructive`, `muted`, `border`…), sin hexadecimales ni paleta por defecto. Las filas de DESIGN.md §6.4 están actualizadas.
- **Menor (documental):** `docs/RULES.md:180`, en la sección de G-01, todavía dice «El detalle no ofrece desactivar ni reactivar ni historial (HU-G-05)». Quedó vieja: la sección «Aplicación HU-G-05» (línea 191) ya describe lo vigente. No bloquea.
- **Menor (documental):** la numeración de criterios de la tabla 9.1 de la task (ver sección 1).
- **Deuda declarada:** duplicación entre `desactivarIntegrante`/`desactivarGerente` y entre los diálogos e historiales de F-05 y G-05. La línea de N en «registró operaciones» sigue siendo deuda de HU-N-01. Ninguna bloquea.

---

## 6. Datos para la prueba manual

Contraseña de las cuentas del seed y de 88066002: **`Password123!`**. 88066001 nace con la contraseña = DNI (`88066001`) y la marca de cambio obligatorio.

**Estado actual de la base de desarrollo (consulta de solo lectura):**

| DNI | Ficha | Estado | Cuenta | Para qué |
|---|---|---|---|---|
| 24100001 | Paredes, Silvia | Activa | `gerente@noctium.local` (activa) | **Quien opera.** Su propia ficha, para el criterio 2. **No usarla como objetivo** |
| 24100002 | Quiroga, Roberto | Activa | `gerente2@noctium.local` (activa) | Segundo gerente que opera. No usarla como objetivo |
| 88066001 | Prueba Baja, Lucas | Activa, v0 | `g05.sinoperaciones@noctium.local` (activa, con marca) | c1 con **motivo opcional**, c4, c5, c6 |
| 88066002 | Prueba Baja, Renata | Activa, v0 | `g05.operaciones@noctium.local` (activa, **sin marca**, `Password123!`) | c1 con **motivo obligatorio** (dio de baja a Camila), c4 revocación de sesiones, c6 «debe iniciar sesión de nuevo» |
| 88066003 | Prueba Baja, Bruno | Activa, v0 | **Sin cuenta** | Baja y reactivación sin cuenta (motivo opcional, otro detalle en el modal) |
| 88066004 | Prueba Baja, Camila | **Inactiva**, v1 | `g05.inactivo@noctium.local` (inactiva) | c6 «Reactivar»; ya tiene 1 entrada de historial («Licencia prolongada», hecha por Renata) |
| 88064002 | Prueba Gerente, Valeria | Inactiva, sin historial | `g01.inactivo@…` | Otra ficha inactiva para «Reactivar» (historial vacío al empezar) |
| — | `mesa.entrada@noctium.local`, `profesor1@noctium.local`, `alumno01@noctium.local` | — | — | c7 (403 y `/sin-permiso`) |

**Casos por criterio:**

| Criterio | Cómo probarlo |
|---|---|
| 1 (opcional) | Como `gerente@` → Gerentes → «Prueba Baja, Lucas» → «Desactivar». Verificar el título literal, «Motivo de la baja», «Opcional», el contador «0 / 300», que el campo no deja pasar de 300 caracteres y que «Desactivar» está habilitado vacío. Confirmar sin motivo |
| 1 (obligatorio) | Ficha de **Renata** → «Desactivar»: ayuda «Obligatorio: tiene operaciones registradas» y botón deshabilitado con el campo vacío o con solo espacios. Escribir un motivo → se habilita |
| 2 | Como `gerente@`, abrir la ficha propia (Paredes): solo «Editar», sin «Desactivar». Rechazo del servidor: snippet de la sección 3 → `422` |
| 3 | Ver «Preparar el caso del último gerente activo», más abajo. La concurrencia (dos bajas cruzadas) **no se puede probar a mano**; la cubren los 4 tests con PostgreSQL de `gerente.estado.pg.test.ts` |
| 4 | Antes de dar de baja a Renata: en **otra ventana de incógnito**, entrar como `g05.operaciones@` y dejar una pantalla abierta. Dar de baja a Renata desde `gerente@` (con motivo). En la ventana de Renata, navegar o recargar → vuelve al login. Al ingresar de nuevo → «La cuenta está inactiva». En la ficha de Renata, «Historial de estados» muestra «Desactivación», fecha y hora, «Paredes, Silvia» y el motivo. En la ficha de Camila, la entrada vieja sigue mostrando «Prueba Baja, Renata» como autora (nombre conservado) |
| 5 | Después de cada baja: toast «Gerente desactivado correctamente», «Inactivo» junto al nombre; en «Gerentes → Listado» (página 2), la fila atenuada con «Inactivo» |
| 6 | Ficha de **Camila** (o de Renata después de c4) → «Reactivar»: título literal, sin motivo, aviso de sesiones. Confirmar: toast «Gerente reactivado correctamente», sin «Inactivo», historial con «Reactivación» arriba y la baja anterior conservada. Con Renata: su ventana de incógnito sigue fuera; tiene que volver a iniciar sesión (`Password123!`) y entra. Hacer baja → reactivación → baja otra vez y ver que se acumulan las tres entradas |
| Sin cuenta | Bruno (88066003): «Desactivar» con el detalle «No tiene una cuenta de acceso vinculada», motivo opcional; después «Reactivar» |
| 7 | Con `mesa.entrada@`, `profesor1@` y `alumno01@`: el menú no muestra «Gerentes», `http://localhost:3000/gerentes/<ID>` lleva a `/sin-permiso` y los snippets de la sección 3 dan `403` |
| Textos propuestos | Revisar los de la tabla de la sección 2 y aprobarlos o pedir cambios |

**No usar** `g05.sinoperaciones@` ni `g01.activo@` para iniciar sesión: nacen con «debe cambiar la contraseña» y entrar con ellas obliga a cambiarla, lo que modifica los datos de prueba.

### Preparar el caso del último gerente activo (c3) sin tocar código

Con datos consistentes no se alcanza: quien opera siempre es un gerente activo con cuenta activa y no puede ser el objetivo, así que siempre «queda uno». Para ver el aviso y el `409`, hay que dejar **temporalmente** como única ficha activa con cuenta activa a la del objetivo, y que quien opera tenga la cuenta activa pero la ficha inactiva. El script solo cambia `activoFichaGerente` de 4 fichas, y el de restauración lo deja todo como estaba. Correrlo con `next dev` levantado y **sin sesiones abiertas**, salvo la de Renata.

```bash
# PREPARAR: Renata opera (cuenta activa, ficha inactiva); Paredes, Quiroga y Tomás quedan con la ficha inactiva.
# Lucas (88066001) queda como único gerente activo con cuenta activa.
docker exec -i noctium_db psql -U noctium -d noctium_dev <<'SQL'
UPDATE fichas_gerente SET "activoFichaGerente" = false
WHERE "dniFichaGerente" IN ('24100001','24100002','88064001','88066002');
SQL
```

1. Entrar como `g05.operaciones@noctium.local` / `Password123!` → Gerentes → «Prueba Baja, Lucas» → «Desactivar» → aparece el aviso «No se puede desactivar al gerente» / «Debe quedar al menos un gerente activo» / «Cerrar».
2. Rechazo del servidor, en la consola con la misma sesión:
   ```js
   const ID = "<ID_LUCAS>";
   const { data } = await (await fetch(`/api/gerentes/${ID}`)).json();
   fetch(`/api/gerentes/${ID}/desactivar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: data.version }) })
     .then(async r => console.log(r.status, await r.json())); // 409 ULTIMO_GERENTE_ACTIVO
   ```
3. **Restaurar enseguida:**

```bash
docker exec -i noctium_db psql -U noctium -d noctium_dev <<'SQL'
UPDATE fichas_gerente SET "activoFichaGerente" = true
WHERE "dniFichaGerente" IN ('24100001','24100002','88064001','88066002');
SQL
```

(Si ya diste de baja a Renata en c4, reactivala primero o sacá `'88066002'` del script de restauración.) Alternativa a los scripts: `npx prisma studio` → `FichaGerente` → cambiar `activoFichaGerente` de esas 4 filas y volverlo atrás. Para dejar toda la base como al inicio, después de la prueba manual: `npx prisma migrate reset --force` (borra la base de desarrollo y vuelve a correr el seed con todas las fixtures).

---

## 7. Veredicto preliminar

### **Lista para prueba manual**

**Bloqueantes:** ninguno.

Para decidir o corregir en la prueba manual (no bloquean):
1. Aprobar o cambiar los **textos propuestos** de la sección 2 (sobre todo «No podés desactivarte a vos mismo.» y «Ingresá el motivo de la baja: el gerente registró operaciones.»).
2. Pedir que suban el límite de tiempo de `src/lib/claves-textos.test.ts` y del `beforeAll` de `gerente.service.pg.test.ts`: en una máquina lenta, la suite completa da falsos rojos (los dos pasan corridos solos).
3. Correcciones documentales: `RULES.md:180` (frase vieja en la sección de G-01) y la numeración de criterios de la tabla 9.1 de la task.
