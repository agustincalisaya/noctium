# Validación PO — HU-G-05 · Desactivar y reactivar gerente

**Rama revisada:** `develop` @ `030e0e7`, árbol limpio (sin cambios sin commitear). Este informe reemplaza al anterior, que se había hecho sobre `feature/HU-C-27`.
**Fuente de verdad:** el texto de la HU del pedido de validación. Coincide palabra por palabra con `docs/tasks/Sprint 3/HU-Sprint-3.md` (líneas 721-733).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md` (Reglas N.° 1 a 11, «Aplicación HU-A-06», «HU-D-08», «HU-F-05», «HU-G-01», «HU-G-03» y «HU-G-05»), `docs/DESIGN.md` (§4, §6.3, §6.4 y §9), `prisma/seed.ts` y la fixture `prisma/seed/fixtures/hu-g-05.ts`, `docs/specs/spec_modulo_G.md` (§2.4 a §2.6, §3.4 a §3.7, §4 y las notas de implementación de G-01, G-03 y G-05), `docs/tasks/Sprint 3/Modulo G/HU-G-05.md`, `docs/tasks/Sprint 3/HU-Sprint-3.md` (convenciones 7 a 9 y HU-C-25 c4) y `docs/tasks/Sprint 3/PR-0.md` (el documento de developers del Sprint 3; no hay otro en `docs/`).

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `npx vitest run` de la HU (`src/server/gerentes`, `src/app/(dashboard)/gerentes`, `src/app/api/gerentes`) | **12 archivos y 327 tests en verde.** Los 2 archivos `*.pg.test.ts` se omiten en esta pasada porque no tienen base de datos; se corren abajo |
| `npm run test:pg -- src/server/gerentes/gerente.estado.pg.test.ts` (base descartable, nunca toca `noctium_dev`) | **15/15 en verde.** Incluye las bajas cruzadas, la lectura vieja y la autodesactivación |
| `npm run test:pg -- src/server/gerentes/gerente.service.pg.test.ts` | **24/24 en verde** |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador de HU-C-23) | «Claves de textos verificadas.» |
| `npx eslint` sobre los archivos de la HU y la fixture | Sin errores ni avisos |
| `npx vitest run` completo (dos pasadas) | **326 o 327 archivos en verde y 2 o 3 con fallos**, según la pasada. (1) `src/server/shared/actividad-usuario.test.ts`: 2 tests fallan de forma **determinista** con `TypeError: Cannot read properties of undefined (reading 'findFirst')` en `configuracion.publico.ts:9`. El commit `068239d` (HU-N-01) sumó la línea N al agregador, pero no actualizó el `tx` simulado del test. **No es código de G-05**, aunque es el agregador que usa el criterio 1 (ver sección 4). (2) `turno-configuracion.test.tsx` (HU-C-03) y `claves-textos.test.ts` fallan **por timeout** con la suite en paralelo; **corridos solos: 56/56 en verde** |
| Consulta de **solo lectura** a `noctium_dev` (`fichas_gerente`, `usuarios`, `historial_estados`) | Las 4 fichas de la fixture están en el estado esperado (ver sección 6) |

---

## 1. Trazabilidad de criterios

Archivos principales: el servicio `src/server/gerentes/gerente.service.ts`, los schemas `src/server/gerentes/gerente.schema.ts`, las Server Actions `src/server/gerentes/actions.ts`, las rutas `src/app/api/gerentes/[id]/desactivar/route.ts` y `.../reactivar/route.ts`, la ficha `src/app/(dashboard)/gerentes/[id]/page.tsx`, el diálogo `.../[id]/estado-gerente-dialog.tsx` y el historial `.../[id]/historial-estados-gerente.tsx`.

| # | Criterio (viñeta) | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1a | Desde la ficha, «Desactivar» solicita confirmación con el texto literal | Botón en `page.tsx:83` (`muestraEstado`) → `EstadoGerenteDialog`. La confirmación usa `ConfirmarAccionDialog` (HU-C-25), con el título `ui.gerentes.baja.titulo` (`estado-gerente-dialog.tsx:98-104`) | **CUBIERTO** | El texto es idéntico; `<gerente>` se reemplaza por «{nombre} {apellido}». Es una baja reversible: `destructiva` y sin `irreversible`, como pide HU-C-25 c4 |
| 1b | La confirmación pide un motivo de hasta 300 caracteres | `textarea` con `maxLength=300` y contador «n / 300» (`estado-gerente-dialog.tsx:110-128`). En el servidor, `DesactivarGerenteSchema` con `.trim().max(300)` (`gerente.schema.ts:71-82`) | **CUBIERTO** | El tope se controla en la pantalla y en el servidor. Con 301 caracteres, el servidor responde `400 VALIDATION_ERROR` con el mensaje de `textos.ts` |
| 1c | El motivo es obligatorio cuando el gerente registró operaciones (Regla N.° 1) | En el servidor, `usuarioRegistroOperaciones(tx, usuarioId)` → `MOTIVO_REQUERIDO` (`gerente.service.ts:411-414`). En la pantalla, `motivoObligatorioAlDesactivar` del detalle deshabilita «Desactivar» mientras el campo está vacío (`dialog.tsx:108`) | **CUBIERTO** | Usa el agregador común `src/server/shared/actividad-usuario.ts`, que hoy suma las líneas de I (pagos y cajas), C, L, **N (configuración, ya incorporada)** e historial de estados. Sin cuenta, el motivo es opcional. Si viene un motivo, se guarda aunque no fuera obligatorio |
| 2a | La acción no aparece en su propia ficha | `muestraEstado = puedeCambiarEstado && !(gerente.activo && gerente.esVos)` (`page.tsx:83`) | **CUBIERTO** | Hay un test de pantalla que lo verifica: aun con el permiso, la ficha propia no muestra «Desactivar» |
| 2b | El servidor rechaza el intento | `desactivarGerente`: lectura simple y comparación `usuarioId === actor.usuarioId` → `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` 422, antes de tomar cualquier bloqueo (`gerente.service.ts:391-395`) | **CUBIERTO** | Test con PostgreSQL: devuelve 422 sin cambiar la ficha, la cuenta ni el historial, incluso con una versión vieja |
| 3a | No se puede desactivar al último gerente activo (ficha activa con cuenta activa): «Debe quedar al menos un gerente activo» | `sinOtroGerenteActivo` (`gerente.service.ts:289-294`) cuenta, sin el objetivo, las fichas activas con cuenta activa (`filtrarCuentasActivas`, módulo A) → `ULTIMO_GERENTE_ACTIVO` 409 (`:410`). En la pantalla, si `esUltimoGerenteActivo` es verdadero se abre un `Dialog` informativo (`dialog.tsx:54-58, 140-153`) | **CUBIERTO** | La definición de «gerente activo» es exactamente la de la HU: no cuentan las fichas sin cuenta ni las que tienen la cuenta inactiva (test con PostgreSQL) |
| 3b | La verificación y la desactivación van en la misma transacción, después de bloquear todas las fichas de gerente activas | `transaccion(...)` (READ COMMITTED). Dentro: lee los ids de las fichas activas, llama a `bloquear(tx, { fichasGerente: [...activas, id] })` (`SELECT … FOR UPDATE` ordenado por id, `bloquear.ts:147`), relee bajo bloqueo y cuenta sobre esa relectura (`gerente.service.ts:397-410`). El `updateMany` y la cuenta van en la misma transacción | **CUBIERTO** | Usa la primera opción del criterio (bloquear todas las fichas activas). Es seguro aunque la lista de ids se lea antes del bloqueo: una ficha que se activa en ese lapso solo agrega gerentes activos, y dos bajas concurrentes comparten fichas bloqueadas, así que se serializan. Tests con PostgreSQL que pasaron en esta validación: bajas cruzadas A↔B (en los dos órdenes y sin pausas, siempre una confirma y la otra recibe `ULTIMO_GERENTE_ACTIVO`), lectura vieja y tres gerentes con dos bajas simultáneas |
| 4a | Al confirmar, la ficha y su cuenta pasan a inactivas | `updateMany` condicionado a `activo: true` y `version` + `desactivarCuenta(tx, usuarioId)`, en la misma transacción (`gerente.service.ts:416-423`) | **CUBIERTO** | Test de rollback con PostgreSQL: si falla la cuenta, la ficha sigue activa y no queda historial |
| 4b | Después de confirmada la operación, la baja queda en el historial de estados (fecha, usuario y acción; Regla N.° 2) | `registrarCambioEstado` → `encolarHistorial` → `despuesDelCommit` (`gerente.service.ts:424`, `historial.ts:177-180`, `transaccion.ts`: la cola se vacía después del COMMIT y se descarta si la transacción revierte). La ficha lo muestra en «Historial de estados» con la acción, la fecha y hora, el usuario y el motivo | **CUBIERTO** | Opción (b) de la Regla N.° 2: una fila nueva por cada cambio |
| 4c | Se revocan sus sesiones vigentes (RNF-SEG-04, mismo mecanismo que HU-D-08 c4) | `desactivarCuenta` → `revocarSesiones` fija `sesionesValidasDesdeUsuario` (`cuenta.service.ts:116-132`). `withPermission`, `verificarPermiso` y `exigirPermiso` rechazan con 401 una cuenta inactiva o una sesión anterior al umbral | **CUBIERTO** | Es la misma función que usa D-08 (`profesor.estado.service.ts:51`). Un test con PostgreSQL verifica el umbral |
| 4d | Las operaciones que registró se conservan con su nombre | No hay ningún `DELETE` en el módulo. `obtenerNombresPersonal` resuelve el nombre del gerente aunque esté inactivo | **CUBIERTO** | Test con PostgreSQL: «nada se borra y su nombre se sigue resolviendo» |
| 5a | Se informa «Gerente desactivado correctamente» | `toast.success(texto("ui.gerentes.baja.exito"))` + `router.refresh()` (`dialog.tsx:134-137`) | **CUBIERTO** | El texto es literal |
| 5b | Sigue en el listado con la etiqueta «Inactivo» | El listado de G-03 no filtra por estado: muestra `Badge` «Inactivo» y la fila atenuada (`listado-gerentes.tsx:145-170`). La acción revalida `/gerentes` (`actions.ts:103-106`). La ficha también muestra «Inactivo» junto al nombre (`page.tsx:109`) | **CUBIERTO** | Test con PostgreSQL: «el listado refleja el estado» |
| 6a | Desde la ficha del inactivo, «Reactivar» pide la confirmación «¿Estás seguro de que querés reactivar a <gerente>?» | El mismo componente, con el título `ui.gerentes.reactivacion.titulo` y `ConfirmarAccionDialog`, sin campo de motivo | **CUBIERTO** | El texto es literal |
| 6b | Vuelve a Activo y la reactivación queda en el historial después de confirmada, conservando todas las bajas y reactivaciones | `reactivarGerente` (`gerente.service.ts:438-463`): bloquea la ficha, la relee, hace un `updateMany` condicionado a inactiva y `version`, y registra `REACTIVAR` después del commit | **CUBIERTO** | Test con PostgreSQL: después de varias bajas y reactivaciones se conservan todas las filas. No aplica la regla del último gerente, porque reactivar solo suma gerentes |
| 6c | Se informa «Gerente reactivado correctamente» | `toast.success(texto("ui.gerentes.reactivacion.exito"))` | **CUBIERTO** | El texto es literal |
| 6d | Si tenía cuenta, vuelve a quedar activa y debe iniciar sesión de nuevo | `reactivarCuenta` (`cuenta.service.ts:135-138`) no toca `sesionesValidasDesde`, así que las sesiones anteriores a la baja siguen siendo inválidas | **CUBIERTO** | Test con PostgreSQL: se conservan el umbral de sesiones y la marca de cambio de contraseña. El modal lo avisa: «…tiene que iniciar sesión de nuevo.» |
| 7 | Solo el Gerente; el servidor rechaza con 403 a otros roles | Rutas con `withPermission("gerentes:cambiar_estado")`; Server Actions con `verificarPermiso` **antes** de Zod (`actions.ts:118, 136`); página con `exigirPermiso("gerentes:leer")` + `tienePermiso`. El permiso se siembra solo para GERENTE (`seed.ts:981`, migración `20261008120200_sprint3_permisos:68`) | **CUBIERTO** | Tests de rutas: 403 `SIN_PERMISO` para MESA_ENTRADA, PROFESOR y ALUMNO y 401 sin sesión. `/api/gerentes/**` no está en el `matcher` del proxy, así que el 403 lo responde la propia ruta en JSON (no hay redirección) |

**Desvíos task ↔ HU:** la implementación no tiene desvíos; cumple la HU tal como está escrita. Hay uno **solo documental** en la task: la tabla 9.1 numera los criterios distinto que la HU. Por ejemplo, llama «c7» a «desactivar la ficha desactiva la cuenta» (en la HU, c7 es «solo el Gerente») y reparte de otra forma el contenido de c4, c5 y c6. No afecta al código, pero conviene corregirla para que el cierre no confunda.

---

## 2. Textos literales (HU-C-23)

Todos los textos entre comillas de la HU están en `src/lib/textos.ts` y coinciden **palabra por palabra**:

| Criterio | Texto de la HU | Clave en `textos.ts` | ¿Coincide? |
|---|---|---|---|
| 1 | «Desactivar» | `ui.gerentes.ficha.desactivar` / `ui.gerentes.baja.confirmar` | Sí |
| 1 | «¿Estás seguro de que querés desactivar a <gerente>? No podrá ingresar al sistema.» | `ui.gerentes.baja.titulo` = «¿Estás seguro de que querés desactivar a {nombre} {apellido}? No podrá ingresar al sistema.» | Sí |
| 3 | «Debe quedar al menos un gerente activo» | `errores.gerente.ultimoGerenteActivo` (sin punto final, igual que la HU) | Sí |
| 5 | «Gerente desactivado correctamente» | `ui.gerentes.baja.exito` | Sí |
| 5 | «Inactivo» | `ui.gerentes.estado.inactivo` | Sí |
| 6 | «Reactivar» | `ui.gerentes.ficha.reactivar` / `ui.gerentes.reactivacion.confirmar` | Sí |
| 6 | «¿Estás seguro de que querés reactivar a <gerente>?» | `ui.gerentes.reactivacion.titulo` = «¿Estás seguro de que querés reactivar a {nombre} {apellido}?» | Sí |
| 6 | «Gerente reactivado correctamente» | `ui.gerentes.reactivacion.exito` | Sí |

**No hay textos que difieran.** La HU no fija los siguientes textos; los propuso la task y están **pendientes de validar por el PO**:

- «No podés desactivarte a vos mismo.»
- «Ingresá el motivo de la baja: el gerente registró operaciones.»
- «El motivo admite hasta 300 caracteres.»
- «El gerente ya está inactivo.» / «El gerente ya está activo.»
- «Obligatorio: tiene operaciones registradas» / «Opcional»
- «No se puede desactivar al gerente» / «Cerrar»
- Los detalles de la baja y de la reactivación, con y sin cuenta.
- «Desactivación», «Reactivación» y «Usuario» del historial.

---

## 3. Reglas de servidor

| Regla | Verificación | Estado |
|---|---|---|
| Validación Zod previa (Regla N.° 6) | `DesactivarGerenteSchema` y `ReactivarGerenteSchema` son `.strict()`: rechazan campos ajenos como `activo` o `usuarioId`, exigen `version` entera ≥ 0 y el motivo se recorta, hasta 300, con vacío = no enviado. Se validan con `safeParse` antes de llamar al servicio | OK |
| Permisos (Regla N.° 10, c7) | Rutas: `withPermission`. Actions: `verificarPermiso` antes de Zod, así que sin permiso no se filtra información de validación. Página: `exigirPermiso` + `tienePermiso` | OK |
| Transacción y bloqueo (Regla N.° 7, c3) | Una sola `transaccion()` en READ COMMITTED, con `lock_timeout` y `statement_timeout`. Bloquea con `FOR UPDATE` todas las fichas activas más la objetivo, por id ascendente (sin interbloqueos), relee y cuenta después de tener los bloqueos. La mutación usa `updateMany` condicionado a estado y `version`; `count === 0` → 409 | OK |
| Concurrencia optimista | `version` obligatoria; si no coincide, `CONFLICTO_EDICION_CONCURRENTE` 409 | OK |
| Sin borrado físico (Regla N.° 1) | No hay `delete`/`DELETE` en `src/server/gerentes` ni en sus rutas o pantallas | OK |
| Trazabilidad (Regla N.° 2) | (b) `registrarCambioEstado` después del commit, con reintento; (a) `version` y `modificadoPorUsuarioId` en la misma fila | OK |
| Registros nuevos en lugar de modificar (Regla N.° 8) | El historial solo inserta: cada baja o reactivación es una fila nueva y nunca se actualiza una anterior. La ficha y la cuenta no son «hechos consumados»: su estado se cambia con versión, como pide la spec | OK |
| Capa delgada (Regla N.° 4) / contrato (Regla N.° 5) | Las rutas y actions solo validan, verifican el permiso, llaman al servicio y traducen a `{ data, error }` con el status de `ErrorDeDominio` | OK |

### Endpoints

| Método y ruta | Permiso | Respuestas |
|---|---|---|
| `POST /api/gerentes/[id]/desactivar` · cuerpo `{ "version": n, "motivo"?: "…" }` | `gerentes:cambiar_estado` | 200 `{ id, activo: false, version }` · 400 `VALIDATION_ERROR` / `MOTIVO_REQUERIDO` · 401 · 403 `SIN_PERMISO` · 404 `GERENTE_NO_ENCONTRADO` · 409 `GERENTE_YA_INACTIVO` / `ULTIMO_GERENTE_ACTIVO` / `CONFLICTO_EDICION_CONCURRENTE` · 422 `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` |
| `POST /api/gerentes/[id]/reactivar` · cuerpo `{ "version": n }` | `gerentes:cambiar_estado` | 200 `{ id, activo: true, version }` · 400 · 401 · 403 · 404 · 409 `GERENTE_YA_ACTIVO` / `CONFLICTO_EDICION_CONCURRENTE` |
| `GET /api/gerentes/[id]` (detalle con `historialEstados`, `motivoObligatorioAlDesactivar`, `esUltimoGerenteActivo`) | `gerentes:leer` | 200 · 401 · 403 · 404 |
| Server Actions `desactivarGerente(id, datos)` y `reactivarGerente(id, datos)` (`src/server/gerentes/actions.ts`, son las que usa la pantalla) | `gerentes:cambiar_estado` | Mismo `{ data, error }`; sin permiso, `SIN_PERMISO` (cubierto por `actions.test.ts`) |

### Snippet para comprobar el 403 desde la consola del navegador

Iniciá sesión con **otro rol** (por ejemplo `mesa.entrada@noctium.local`, `profesor1@noctium.local` o `alumno01@noctium.local`, todos con `Password123!`), abrí la consola (F12) en cualquier página de la app y pegá:

```js
// Ficha de 88066001 (Lucas Prueba Baja) en la base actual; si se volvió a correr el seed, copiá el id de la URL /gerentes/<id>
const id = "cmv84cl5201v3uxmkqv8gbnww";
const pruebas = [
  ["POST", `/api/gerentes/${id}/desactivar`, { version: 0, motivo: "Prueba 403" }],
  ["POST", `/api/gerentes/${id}/reactivar`, { version: 0 }],
  ["GET", `/api/gerentes/${id}`],
];
for (const [method, url, body] of pruebas) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  console.log(method, url, "→", r.status, await r.json().catch(() => null));
}
// Esperado: 403 con error.code = "SIN_PERMISO" en los tres, y la ficha sin cambios.
```

Para el criterio 2, desde la sesión de un gerente sobre **su propia** ficha. Usá `g05.operaciones@noctium.local` / `Password123!` (Renata, 88066002), no un gerente del seed:

```js
const propia = "cmv84clht01v6uxmk5tmmsali"; // ficha de 88066002
const r = await fetch(`/api/gerentes/${propia}/desactivar`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ version: 0, motivo: "Intento propio" }),
});
console.log(r.status, await r.json()); // Esperado: 422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO, sin cambios
```

Para comprobar el tope del motivo, desde una sesión de gerente: con `motivo: "x".repeat(301)` → `400 VALIDATION_ERROR` con «El motivo admite hasta 300 caracteres.».

---

## 4. Definición de Terminado

| Punto | Estado |
|---|---|
| Textos visibles en el archivo central (`textos.ts`) | **Cumple.** La ficha, el diálogo y el historial usan solo `texto(…)`. El comprobador de claves pasa |
| Ningún texto visible dice «turno» | **Cumple.** Ninguna clave `ui.gerentes.*` ni `errores.gerente.*` contiene «turno». El import `@/lib/turno-detalle` (`fechaHoraDeInstante`) es un nombre técnico, no un texto visible |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | **Cumple.** La baja y la reactivación usan `ConfirmarAccionDialog`. El aviso del último gerente es un `Dialog` informativo que no guarda nada (excepción documentada en DESIGN §6.3) |
| Tests en verde | **Cumple para la HU**: 327 unitarios + 15 + 24 con PostgreSQL, todos en verde. **En `develop`, la suite completa no está en verde**: `actividad-usuario.test.ts` falla (2 tests). Ese test es del agregador «registró operaciones» y lo rompió HU-N-01, no G-05. El comportamiento real está bien: los tests con PostgreSQL de G-05 que dependen del agregador pasan, porque usan una base real y no el `tx` simulado. Lo tiene que corregir el responsable de HU-N-01 actualizando el `tx` simulado del test. Los otros dos fallos fueron timeouts por carga y pasan corridos solos |

**Incumplimientos de la DoD propios de G-05:** ninguno. **Pendiente ajeno que afecta al sprint:** el test roto del agregador (HU-N-01), que hay que corregir antes del cierre para que la rama principal quede en verde.

---

## 5. Extras y violaciones

### Cosas implementadas que la HU no pide (ninguna contradice la HU)

1. **Aviso informativo previo del último gerente activo**: un `Dialog` con «No se puede desactivar al gerente» que se abre en lugar de la confirmación. Está documentado en DESIGN §6.3 y §6.4.
2. **Rutas REST además de las Server Actions**, para las pruebas por HTTP.
3. **Fichas de gerente sin cuenta**: se pueden dar de baja y reactivar sin tocar ninguna cuenta. Entran en el bloqueo, pero no cuentan como gerente activo.
4. **El motivo se guarda aunque sea opcional**, y se muestra en el historial.
5. **Avisos de detalle en los modales**: en la baja, «Su cuenta pasa a inactiva y se cierran todas sus sesiones.»; en la reactivación, «Las sesiones cerradas en la baja no se restauran…». Esto cumple HU-C-25 c4, que pide explicar los efectos que no se restauran.
6. **Rechazos del servidor dentro del modal** (último gerente, motivo, versión, ya inactivo, propia ficha), con refresco de la ficha al cerrar.
7. **Fixture `hu-g-05.ts`** con cuatro fichas de prueba (88066001 a 88066004).

### Violaciones a RULES.md o DESIGN.md

- **Ninguna bloqueante.**
- **Menor, transversal (DESIGN §4, «regla análoga para el rojo»):** el botón «Desactivar» usa `hover:bg-destructive-soft hover:text-destructive` (`estado-gerente-dialog.tsx:91`). Sobre `--destructive-soft` el texto debería ir en `--destructive-soft-foreground`, porque `--destructive` sobre ese fondo da ~4.3:1, por debajo de AA. Solo pasa durante el hover, y el mismo patrón está en otros 7 botones de la app (personal, alumnos, profesores, caja, etc.; `turno-detalle-encabezado.tsx` es el único que lo hace bien). No es propio de esta HU: conviene registrarlo como deuda de diseño en DESIGN §7.
- **Menor:** si el historial no puede resolver el nombre de quien actuó, muestra el genérico «Usuario». Con gerentes no debería pasar (siempre actúa un usuario con ficha), así que no hace falta corregirlo.
- Sin colores hex ni de la paleta default de Tailwind en los archivos de la HU.

---

## 6. Datos para la prueba manual

**Credenciales** (todas con `Password123!` salvo donde se indica):

| Cuenta | Rol / ficha | Uso |
|---|---|---|
| `gerente@noctium.local` | GERENTE · Silvia Paredes (24100001) | Quien da de baja. En su propia ficha, «(vos)» en el listado y sin «Desactivar» |
| `gerente2@noctium.local` | GERENTE · Roberto Quiroga (24100002) | Segundo actor (criterio 3) |
| `g05.operaciones@noctium.local` | GERENTE · Renata Prueba Baja (88066002), **con operaciones** (dio de baja a 88066004) | Motivo obligatorio; sesión para probar la autodesactivación y la revocación de sesiones |
| `g05.sinoperaciones@noctium.local` / contraseña **`88066001`** | GERENTE · Lucas Prueba Baja (88066001), sin operaciones, con la marca de cambio obligatorio | Motivo opcional; después de reactivar sigue yendo a `/primer-ingreso` |
| — | Bruno Prueba Baja (88066003), **sin cuenta** | Baja y reactivación sin cuenta |
| `g05.inactivo@noctium.local` / contraseña **`88066004`** | Camila Prueba Baja (88066004), **inactiva**, con historial («Licencia prolongada», hecho por Renata) | «Reactivar» y historial con datos reales |
| `mesa.entrada@noctium.local`, `profesor1@noctium.local`, `alumno01@noctium.local` | Otros roles | 403 (criterio 7) |

Estado actual de `noctium_dev` (consulta de solo lectura): 24100001, 24100002, 88064001, 88066001, 88066002 y 88066003 están activos; 88064002 y 88066004 están inactivos; 88066004 tiene 1 entrada de historial. Ids: 88066001 `cmv84cl5201v3uxmkqv8gbnww`, 88066002 `cmv84clht01v6uxmk5tmmsali`, 88066003 `cmv84clsp01v9uxmkeudkzcg7`, 88066004 `cmv84cm2u01vcuxmkoww5up03`, 88064001 `cmv84ckal01u9uxmkyultyi2f`, 24100001 `cmv84b9wo000kuxmkez8b7l53`, 24100002 `cmv84b9wz000muxmk9f82doa3`.

### Caso por criterio

| Criterio | Cómo probarlo |
|---|---|
| 1 | Como Silvia: **Gerentes → Lucas (88066001) → Desactivar**. Verificá el título literal, «Motivo de la baja» con «Opcional» y el contador «n / 300»; no se pueden tipear más de 300 caracteres. Después, **Renata (88066002) → Desactivar**: la ayuda dice «Obligatorio…» y «Desactivar» queda deshabilitado hasta escribir un motivo |
| 2 | Como Silvia, abrí tu propia ficha desde el listado (fila con «(vos)»): solo aparece «Editar». Para el servidor, usá el snippet del criterio 2 (sección 3) con la sesión de Renata → 422 |
| 3 | Ver «Preparación del criterio 3» más abajo; necesita un dato inconsistente. La parte concurrente (dos bajas cruzadas a la vez) no se puede reproducir a mano de forma confiable: la cubren los tests con PostgreSQL, que pasaron 15/15 en esta validación |
| 4 | (a) Abrí la app como Renata en una ventana de incógnito. (b) En la ventana normal, como Silvia, desactivá a Renata con un motivo. (c) Ficha de Renata: «Inactivo» junto al nombre, «Cuenta de acceso» Inactiva y el historial con «Desactivación», fecha y hora, «Silvia Paredes» y el motivo. (d) En la ventana de Renata, recargá o navegá: te manda a `/login`, y el login falla porque la cuenta está inactiva. (e) Ficha de Camila (88066004): el historial sigue mostrando «Renata Prueba Baja» como quien la dio de baja, es decir, sus operaciones se conservan con su nombre |
| 5 | Después de cada baja aparece el toast «Gerente desactivado correctamente»; en `/gerentes` la fila se ve atenuada con la etiqueta «Inactivo» |
| 6 | Como Silvia: **Camila (88066004) → Reactivar** → título literal, sin motivo → toast «Gerente reactivado correctamente»; el historial muestra las dos entradas (la baja y la reactivación) y la cuenta queda Activa. Reactivá también a Renata: su ventana de incógnito anterior sigue sin sesión y tiene que volver a iniciar sesión con `Password123!`. Con Bruno (88066003, sin cuenta) probá la baja y la reactivación sin cuenta |
| 7 | Snippet de la sección 3 con mesa de entrada, profesor y alumno → 403 `SIN_PERMISO`. Si además entrás a `/gerentes/<id>` con esos roles, la app te manda a `/sin-permiso` |

### Preparación del criterio 3 (último gerente activo)

Con datos coherentes, la regla nunca se dispara desde la pantalla: quien opera ya es un gerente activo con cuenta activa y no puede ser el objetivo. Para verla hace falta una ficha **inactiva con la cuenta activa**, que es justamente el dato inconsistente que la regla cubre. Sin tocar código:

1. Entrá como **Roberto** (`gerente2@noctium.local`) y desactivá desde la pantalla a **Tomás (88064001)**, **Renata (88066002, con motivo)** y **Silvia (24100001, con motivo)**. Así, los únicos activos con cuenta quedan Roberto y Lucas (88066001).
2. Abrí la ficha de **Lucas** y tocá «Desactivar»: aparece la confirmación normal, porque todavía queda Roberto. **No confirmes** y dejá el modal abierto.
3. Corré este SQL una sola vez (deja la ficha de Roberto inactiva y su cuenta activa, para que pueda seguir operando):
   ```bash
   docker exec noctium_db psql -U noctium -d noctium_dev -c "UPDATE fichas_gerente SET \"activoFichaGerente\" = false WHERE \"dniFichaGerente\" = '24100002';"
   ```
4. En el modal abierto escribí un motivo y confirmá: el rechazo «Debe quedar al menos un gerente activo» aparece **dentro del modal**, y al cerrarlo la ficha se refresca.
5. Tocá «Desactivar» otra vez: ahora se abre directamente el aviso «No se puede desactivar al gerente» con «Debe quedar al menos un gerente activo» y el botón «Cerrar».
6. Opcional, desde la consola con la sesión de Roberto: `fetch("/api/gerentes/cmv84cl5201v3uxmkqv8gbnww/desactivar", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:0})}).then(r=>r.json()).then(console.log)` → `ULTIMO_GERENTE_ACTIVO` (409).
7. **Restaurar:**
   ```bash
   docker exec noctium_db psql -U noctium -d noctium_dev -c "UPDATE fichas_gerente SET \"activoFichaGerente\" = true WHERE \"dniFichaGerente\" = '24100002';"
   ```
   Después, como Roberto, reactivá desde la pantalla a Silvia, Renata y Tomás (esto también sirve como prueba del criterio 6). Otra opción es dejar todo como el seed con `npx prisma migrate reset --force`, que **borra toda la base de desarrollo** y la regenera con el seed.

> El cambio del paso 3 se hace por fuera de la aplicación, así que no queda en el historial de estados de Roberto. Es intencional: simula un dato inconsistente y se revierte en el paso 7.

---

## 7. Veredicto preliminar

**Lista para prueba manual.**

**Bloqueantes:** ninguno.

Observaciones no bloqueantes para el PO y el dev:
1. Validar los textos propuestos de la sección 2 (no los fija la HU).
2. Corregir la numeración de criterios de la tabla 9.1 de la task (solo documental).
3. Registrar como deuda de diseño transversal el contraste del hover de los botones «Desactivar» (DESIGN §4).
4. El criterio 3 en su parte concurrente solo se puede verificar con los tests automáticos con PostgreSQL, que pasaron. La parte visible necesita el dato inconsistente de la sección 6.
5. **Ajeno a G-05, pero a resolver antes del cierre:** `src/server/shared/actividad-usuario.test.ts` está en rojo en `develop` desde `068239d` (HU-N-01): el `tx` simulado no tiene `historialParametro`. Es el agregador del criterio 1 de esta HU; su comportamiento real está verificado con PostgreSQL. Avisar al responsable de HU-N-01.
