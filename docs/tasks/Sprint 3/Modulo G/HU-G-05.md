# TASK: HU-G-05 — Desactivar y reactivar gerente

**Módulo:** G (Gerentes) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 3 (2 + 1: absorbe HU-G-06, reactivar)
**Contrato de referencia:** `docs/specs/spec_modulo_G.md` §1, §2.4 (campos que suma esta HU al detalle), §2.5 (desactivar), §2.6 (reactivar), §3.1, §3.4, §3.5, §3.6, §3.7 y §4 · `docs/specs/spec_modulo_F.md` §2.5, §2.6 y §2.7 (mismo diseño y «registró operaciones», DEC-39) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-G-05, criterios 1 a 7; HU-A-06, criterio 7) · `docs/tasks/Sprint 3/Modulo F/HU-F-05.md` (sección 9: **el patrón a copiar**) · `docs/tasks/Sprint 3/Modulo G/HU-G-01.md` y `HU-G-03.md` (sección 9: qué dejaron hecho) · `src/server/personal/personal.service.ts` (`desactivarIntegrante` y `reactivarIntegrante`, de F-05) y `src/server/profesores/profesor.estado.service.ts` (HU-D-08) · `docs/tasks/Sprint 3/PR-0.md` §2.13 y §2.16
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figuras 97 («Ficha de otro gerente») y 98 («Confirmación de la baja»), **solo las páginas 88 y 89** (confirmadas: la 88 trae el encabezado de HU-G-05 y la figura 97; la 89, la figura 98). No muestra el flujo de reactivar, el motivo obligatorio ni el aviso del último gerente activo. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog, y la ficha ya implementada por G-01 no se reorganiza.
**RBAC:** solo **GERENTE**. Usa `gerentes:cambiar_estado` (desactivar y reactivar) y `gerentes:leer` (la ficha y `GET /api/gerentes/[id]`), ya sembrados en `prisma/seed.ts` y en la migración de permisos. Cualquier otro rol recibe `403 SIN_PERMISO` en el servidor (spec G §3.7).
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. `FichaGerente` ya tiene `activoFichaGerente`, `version` y `modificadoPorUsuarioId`; `EntidadHistorialEstado` ya incluye `FICHA_GERENTE`.
**Rama:** `feat/hu-g-05-desactivar-reactivar-gerente`, creada desde `develop` actualizado (G-01 y G-03 ya están mergeadas).
**Estado de la HU:** implementada y cerrada; el resultado está en la sección 9. Es la última HU del carril 4.

---

## 0. Decisiones y verificaciones previas

### 0.1. Decisiones (no relevar de nuevo)

1. **Es la baja y reactivación de F-05 aplicada a `FichaGerente`, sin la regla de la caja y con dos reglas propias de G:** un gerente no se desactiva a sí mismo (criterio 2) y debe quedar al menos un gerente activo (criterio 3). Se copia el patrón de `desactivarIntegrante` / `reactivarIntegrante` (bloqueo, relectura de estado y versión, `updateMany` condicionado, cuenta en la misma transacción, historial encolado). El agregador de «registró operaciones» **ya existe** (lo creó F-05): se reutiliza tal cual, sin tocarlo.
2. **Servicio en `gerente.service.ts`** (como dice la spec G §2.5 y §2.6; no se crea un `gerente.estado.service.ts`): `desactivarGerente(id, input, actor)` y `reactivarGerente(id, input, actor)`, con `actor: ActorDominio` (`actorUsuario(usuarioId)`). `modificadoPorUsuarioId` se escribe solo si el actor es un usuario (la misma función auxiliar que usa F-05).
3. **Orden de la baja, dentro de una única `transaccion`** (el de spec G §2.5, con el ajuste de 0.1.4):
   1. **Lectura simple de la ficha objetivo, sin bloqueo** (`usuarioId`): inexistente → `errores.gerente.noEncontrado`. Si el actor es un usuario y `ficha.usuarioId !== null && ficha.usuarioId === actor.usuarioId` → `errores.gerente.noPuedeDesactivarseASiMismo` (422). Es lo primero y **no toma ningún bloqueo** (spec G §2.5, paso 1; el servidor decide, la interfaz solo lo refleja).
   2. **Bloqueo (criterio 3, spec G §3.4):** se leen los ids de **todas** las fichas de gerente activas y, en **una sola llamada**, `bloquear(tx, { recursos: { fichasGerente: [...idsActivas, id] } })` (el objetivo siempre va, esté activo o no; `bloquear` ordena por id ascendente). Después de tener los bloqueos se **releen** esas fichas (`id`, `activo`, `version`, `usuarioId`): lo que cuenta es el estado releído, no el de la lectura previa.
   3. Objetivo releído inexistente → `noEncontrado`; ya inactivo → `errores.gerente.yaInactivo`; `version` distinta de `input.version` → `errores.gerente.conflictoEdicion`.
   4. **Último gerente activo:** de las fichas releídas, las activas **con `usuarioId`** y **sin contar al objetivo** pasan por `filtrarCuentasActivas(tx, usuarioIds)` (módulo A). Si no queda ninguna → `errores.gerente.ultimoGerenteActivo`. Se cuenta **después** de tener los bloqueos.
   5. **Motivo:** `motivo = input.motivo?.trim() || null`. Sin motivo, con `usuarioId` y `usuarioRegistroOperaciones(tx, usuarioId)` en `true` → `errores.gerente.motivoRequerido`. Si hay motivo se guarda aunque no sea obligatorio.
   6. `updateMany` con `where: { idFichaGerente: id, activoFichaGerente: true, version }` y `data: { activoFichaGerente: false, version + 1, modificadoPorUsuarioId }`; `count === 0` → `errores.gerente.conflictoEdicion` (Regla N.° 7). **No se usa `errores.general.conflictoEdicion`**, que cita la spec y no existe (nota de G-01).
   7. Si tiene `usuarioId`: `desactivarCuenta(tx, usuarioId)`. **No se llama además a `revocarSesiones`**: `desactivarCuenta` ya la llama (la spec nombra las dos; el código real las junta, igual que en F-05 y D-08).
   8. `registrarCambioEstado(tx, { entidad: "FICHA_GERENTE", id, accion: "DESACTIVAR", motivo, actor })`: se escribe después del commit (Regla N.° 2, opción b).
   9. Devuelve `{ id, activo: false, version: version + 1 }`.
4. **Por qué hace falta releer y por qué el bloqueo es por ids.** `bloquear` recibe una lista de ids, no un criterio: hay que leer los ids de las fichas activas antes de pedirlos, y esa lectura puede quedar vieja mientras la transacción espera el bloqueo (otra baja que confirma en ese lapso). Por eso el conteo se hace sobre la relectura posterior a los bloqueos. Una ficha que se reactiva o se crea entre la lectura y el bloqueo no figura en la lista, pero eso solo suma gerentes activos y nunca vuelve insegura la regla; una baja concurrente, en cambio, toma el mismo conjunto de bloqueos, así que se serializa con esta (mismo orden ascendente: sin interbloqueos). Orden ficha → cuenta, el mismo que dejó G-01.
5. **Reactivar:** `bloquear(tx, { recursos: { fichasGerente: [id] } })`; relectura; `noEncontrado`, `errores.gerente.yaActivo`, `conflictoEdicion`; `updateMany` con `activo: false` y `version`; `reactivarCuenta(tx, usuarioId)` si tiene cuenta (no restaura sesiones y conserva la marca de cambio de contraseña); `registrarCambioEstado` con `accion: "REACTIVAR"` y sin motivo. Devuelve `{ id, activo: true, version: version + 1 }`. No pide motivo y **no hay regla de «último gerente»**: reactivar solo suma (spec G §2.6).
6. **Ficha sin cuenta (`usuarioId` nulo; las 12 de la fixture de G-03).** Se puede desactivar y reactivar igual: se salta la cuenta, no se llama a `usuarioRegistroOperaciones` (nunca fue actor de nada) y el motivo es opcional. Si está activa, **entra en el bloqueo** de «todas las fichas activas» pero **no cuenta** para «al menos un gerente activo», que cuenta fichas activas con cuenta activa (spec G §2.5, paso 4). Tampoco cuenta una ficha activa cuya cuenta esté inactiva (dato inconsistente que la regla existe para cubrir).
7. **Errores nuevos** (catálogo `src/server/shared/errores-dominio.ts` y textos en `src/lib/textos.ts`; el servicio nunca devuelve textos; el catálogo ya admite `status: 422`):

   | Clave | `code` | HTTP | Texto |
   |---|---|---|---|
   | `errores.gerente.yaInactivo` | `GERENTE_YA_INACTIVO` | 409 | «El gerente ya está inactivo.» |
   | `errores.gerente.yaActivo` | `GERENTE_YA_ACTIVO` | 409 | «El gerente ya está activo.» |
   | `errores.gerente.ultimoGerenteActivo` | `ULTIMO_GERENTE_ACTIVO` | 409 | «Debe quedar al menos un gerente activo» (literal del backlog, criterio 3) |
   | `errores.gerente.noPuedeDesactivarseASiMismo` | `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` | 422 | «No podés desactivarte a vos mismo.» **Propuesto, pendiente de validar por el PO** |
   | `errores.gerente.motivoRequerido` | `MOTIVO_REQUERIDO` | 400 | «Ingresá el motivo de la baja: el gerente registró operaciones.» **Propuesto, pendiente de validar por el PO (P-F6)** |
   | `errores.gerente.motivoDemasiadoLargo` | — (mensaje del schema) | 400 | «El motivo admite hasta 300 caracteres.» (propuesto) |

   `conflictoEdicion`, `noEncontrado`, `datosInvalidos`, `interno` y `comunicacion` ya existen en `errores.gerente.*` (G-01).
8. **Schemas** en `gerente.schema.ts`, `.strict()` y con la forma de los de F-05: `DesactivarGerenteSchema = { motivo?: string (trim, hasta 300; vacío = no enviado), version: entero no negativo }` y `ReactivarGerenteSchema = { version }`. Un campo ajeno es 400 `VALIDATION_ERROR`. Los mensajes salen de `textos.ts`. La forma literal de la spec G (`z.string().trim().max(300).optional()`) se ajusta a la de F-05 para que «vacío» signifique «no enviado» en las dos fichas internas.
9. **«Registró operaciones» (DEC-39).** `usuarioRegistroOperaciones(tx, usuarioId)` de `src/server/shared/actividad-usuario.ts`, con sus líneas de I, C, L y del historial de estados. **No se modifica.** Un gerente que dio de baja o reactivó a alguien ya «registró operaciones» por la línea del historial de estados. La línea de N sigue siendo deuda de HU-N-01 (anotada en F-05).
10. **El detalle suma los tres campos de la spec G §2.4** sin cambiar la firma `obtenerDetalleGerente(id, sesionUsuarioId, db?)`:
    - `historialEstados`: `listarHistorialEstados("FICHA_GERENTE", id, db)`, del más reciente al más antiguo, con el nombre de quien actuó. **El nombre sale de `obtenerNombresPersonal`** (`personal.publico.ts`, ya cubre gerentes por `usuarioId`) y no de `obtenerNombresGerentes`, que no existe (nota de G-01). Cada entrada va en camelCase como el resto del detalle: `{ id, accion, motivo, fecha, usuarioId, usuarioNombre }` (tipo `EntradaHistorialGerente`); `usuarioNombre` es `null` si no se resuelve o si actuó el proceso automático.
    - `motivoObligatorioAlDesactivar`: `usuarioRegistroOperaciones` sobre la cuenta de la ficha. Solo si la ficha está activa y tiene cuenta; si no, `false`.
    - `esUltimoGerenteActivo`: `true` si, **sin contar esta ficha**, no queda ningún gerente activo con cuenta activa (lectura sin bloqueo: fichas activas con `usuarioId`, sin la objetivo, pasadas por `filtrarCuentasActivas`). Solo si la ficha está activa; si no, `false`. Es informativo: el servidor repite la validación al confirmar (paso 4 de 0.1.3).
    - `esVos` ya existe (G-01) y no cambia.
11. **Rutas y Server Actions, las dos** (spec G §2.5 y §2.6; capa delgada, Reglas N.° 4, 5 y 6): `POST /api/gerentes/[id]/desactivar` y `POST /api/gerentes/[id]/reactivar` con `withPermission("gerentes:cambiar_estado")`, cuerpo JSON validado con Zod, `200 { data: { id, activo, version }, error: null }`, `400 VALIDATION_ERROR` con `detalles`, `400 MOTIVO_REQUERIDO`, `401`, `403`, `404 GERENTE_NO_ENCONTRADO`, `409` (`GERENTE_YA_INACTIVO`, `GERENTE_YA_ACTIVO`, `ULTIMO_GERENTE_ACTIVO`, `CONFLICTO_EDICION_CONCURRENTE`) y `422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`. Server Actions `desactivarGerente(id, datos)` y `reactivarGerente(id, datos)` en `src/server/gerentes/actions.ts`, que verifican el permiso **antes** de validar con Zod y hacen `revalidatePath("/gerentes")` y de la ficha. La pantalla usa las Server Actions; las rutas existen para el nivel HTTP del testing. `GET /api/gerentes/[id]` devuelve los campos nuevos sin cambiar nada más.
12. **Pantalla (figuras 97 y 98).** La ficha `/gerentes/[id]` suma, junto a «Editar»: «Desactivar» (botón de contorno con estilo destructivo e ícono de encendido) si la ficha está activa, hay `gerentes:cambiar_estado` y **no es la propia** (`esVos` falso, criterio 2); o «Reactivar» si está inactiva y hay el permiso; y la sección «Historial de estados». No se reorganiza lo que hizo G-01 (etiqueta «Inactivo» junto al nombre, «Registro», «Cuenta de acceso»): «Cuenta de acceso» e «Historial de estados» van en una grilla de dos columnas debajo de «Registro», como en la ficha de personal.
    - **Diálogo** (componente de cliente nuevo, `estado-gerente-dialog.tsx`, copia adaptada de `estado-integrante-dialog.tsx` sin la caja y sobre `ConfirmarAccionDialog` con `destructiva` y **sin** `irreversible`: la baja se revierte con «Reactivar»). Baja: título «¿Estás seguro de que querés desactivar a {nombre} {apellido}? No podrá ingresar al sistema.»; detalle «Las operaciones que registró se conservan con su nombre. Su cuenta pasa a inactiva y se cierran todas sus sesiones.» (sin cuenta: «Las operaciones que registró se conservan con su nombre. No tiene una cuenta de acceso vinculada.»); campo «Motivo de la baja» en `contenido` (hasta 300 caracteres, contador «n / 300»), con la ayuda «Opcional» u «Obligatorio: tiene operaciones registradas» (propuesto); confirmar deshabilitado si el motivo es obligatorio y está vacío; botones «Volver» y «Desactivar» (rojo). Reactivar: título «¿Estás seguro de que querés reactivar a {nombre} {apellido}?»; detalle «Su cuenta vuelve a quedar activa. Las sesiones cerradas en la baja no se restauran: tiene que iniciar sesión de nuevo.» (sin cuenta: «Vuelve a figurar como activo. No tiene una cuenta de acceso vinculada.»); sin motivo.
    - **Rechazos del servidor dentro del mismo modal** (último gerente activo, motivo requerido, ya activo/inactivo, conflicto de versión). Después de cualquier rechazo que no sea de validación, al cerrar el modal se refresca la ficha para tomar el estado y la versión actuales (como F-05).
    - **Aviso del último gerente activo:** si el detalle trae `esUltimoGerenteActivo: true`, «Desactivar» **no** abre la confirmación sino un aviso informativo («No se puede desactivar al gerente» + el texto de `errores.gerente.ultimoGerenteActivo` + «Cerrar»), el mismo recurso que F-05 usó para la caja abierta. Con datos consistentes casi no se alcanza (quien opera es un gerente activo con cuenta activa y no puede ser el objetivo): existe porque lo pide la spec y se prueba con datos de prueba.
    - **Feedback:** toast de éxito («Gerente desactivado correctamente» / «Gerente reactivado correctamente», literales del backlog) y `router.refresh()`; sin banner por parámetro de URL.
13. **Textos nuevos en `textos.ts`** bajo `ui.gerentes.ficha.*` (botones «Desactivar» y «Reactivar»), `ui.gerentes.baja.*`, `ui.gerentes.reactivacion.*` e `ui.gerentes.historial.*` (título «Historial de estados», vacío «Sin bajas ni reactivaciones.», «Desactivación», «Reactivación» y «Usuario» cuando no hay nombre), más los errores de 0.1.7. Los de la figura 98 y los del backlog son literales; el resto son propuestos y se marcan como tales en la nota de la spec.
14. **El listado no cambia.** G-03 ya muestra activos e inactivos con la fila inactiva atenuada y el `Badge` «Inactivo». Esta HU solo **confirma** que refleja el cambio (criterio 5) y revalida `/gerentes` en las acciones.
15. **Fixture** `prisma/seed/fixtures/hu-g-05.ts` (+ una línea en `fixtures/index.ts`, sin editar `seed.ts`), idempotente por DNI y por «la ficha tiene historial», con los servicios de dominio. DNI `8806600x`, apellidos sin dígitos («Prueba Baja»):
    - `88066001`: activo, con cuenta (nace con la marca de cambio obligatorio), **sin operaciones** → la baja con motivo opcional.
    - `88066002`: activo, con cuenta, **«registró operaciones»** (es quien da de baja a `88066004`, con su cuenta como actor) → motivo obligatorio. Es además la **sesión de las pruebas HTTP propias** (autodesactivación): su contraseña se cambia con el servicio de A para que no tenga la marca de cambio obligatorio y pueda operar (ver 0.2; si no se puede, se reporta antes de inventar otra forma).
    - `88066003`: activo, **sin cuenta** (`usuarioId` nulo, creada con inserción directa como en G-03) → baja y reactivación sin cuenta.
    - `88066004`: con cuenta, **dado de baja** con `desactivarGerente` (con motivo, actor la cuenta de `88066002`) → «Reactivar» y un historial real.

    **No se tocan** los dos gerentes del seed base (24100001 y 24100002; son las cuentas con las que entra el equipo) ni las fichas de las fixtures de G-01 y G-03. Las bajas de las pruebas (HTTP y navegador) se hacen **solo** sobre las fichas de esta fixture; los gerentes del seed pueden actuar como quien da de baja, nunca como objetivo.
16. **Documentos.** `docs/DESIGN.md` §6.4: se corrige **solo** la cláusula de la fila de la ficha del gerente que dice «Sin "Desactivar", "Reactivar" ni historial de estados (los suma HU-G-05)» (precedente: F-03 y G-03), se agregan las filas de desactivar, reactivar y aviso del último gerente activo (y, si §6.3 lista el aviso de caja abierta como excepción, se suma este aviso a esa excepción), y la entrada del historial de cambios **sin fecha y sin el marcador `[FECHA]`**, con el formato «- **HU-G-05:** …» (decisión vigente; las entradas anteriores no se tocan). `docs/RULES.md`: solo una sección nueva «Aplicación HU-G-05 — Baja y reactivación de gerentes» al final. `docs/specs/spec_modulo_G.md`: «Nota de implementación HU-G-05», **aditiva**, a continuación de la de G-03. Evidencia en `docs/testing/Modulo G/hu-g-05/HU-G-05-evidencia.md`.
17. **Etapas: dos** (sección 8). La primera es todo el backend (servicio con bloqueo de todas las fichas activas, reglas del último gerente y de la autodesactivación, concurrencia con PostgreSQL real); la segunda, la pantalla, la fixture y el cierre. Se pausa entre una y otra.

### 0.2. A verificar antes de implementar (si algo contradice lo de arriba, detenerse y reportar)

- **Rama:** que `git branch --show-current` da `feat/hu-g-05-desactivar-reactivar-gerente` y que existen `src/server/gerentes/gerente.service.ts`, `docs/tasks/Sprint 3/Modulo G/HU-G-05.md` y `src/server/shared/actividad-usuario.ts`. Si la rama es otra, detenerse: Claude Code no crea ni cambia de rama.
- **`bloquear` y `fichasGerente`:** que acepta varios ids de `fichasGerente` en una sola llamada (ordenados por id ascendente), que **no lanza con un id inexistente** y que pedir el nivel una sola vez al inicio respeta el orden canónico. Que `desactivarCuenta` y `reactivarCuenta` no piden bloqueos de un nivel anterior a los de la ficha.
- **`filtrarCuentasActivas(tx, usuarioIds)`** (`cuenta.service.ts`): confirmar la firma y que es una lectura simple sin bloqueo (se espera, es la que se usa en 0.1.3 paso 4).
- **«Registró operaciones»:** que `usuarioRegistroOperaciones(tx, usuarioId)` (agregador de F-05, `tx` primero) funciona con la cuenta de un gerente sin tocarlo, y que la línea del historial de estados cuenta a quien dio de baja a otra ficha (la fixture depende de eso).
- **Aislamiento de fachadas (Regla N.° 3):** que `gerente.service.ts` puede importar `shared/actividad-usuario`, `shared/bloquear`, `shared/historial-estados` y `personal.publico` (`obtenerNombresPersonal`) sin que `src/server/publico.aislamiento.test.ts` exija nada; si exige registrar los imports nuevos, se hace sin debilitarlo. Que no se crea un ciclo.
- **Catálogo de errores:** que `errores-dominio.ts` admite las seis claves nuevas (incluido `status: 422`) y que los tests que recorren el catálogo y todas las claves de `textos.ts` se adaptan sin debilitarse.
- **Schema de F-05:** que `DesactivarIntegranteSchema` y `ReactivarIntegranteSchema` tienen la forma descripta en 0.1.8 y copiarla.
- **Tests que fijan la forma del detalle** (`gerente.service.test.ts`, `route.test.ts` de `/api/gerentes/[id]`, `paginas.test.tsx`, `gerente.service.pg.test.ts`): adaptarlos a los tres campos nuevos sin debilitarlos. En particular, el test de `paginas.test.tsx` que hoy fija «sin Desactivar ni Reactivar ni historial» pasa a exigirlo **sin el permiso `gerentes:cambiar_estado`** (como hizo F-05).
- **Permisos:** que `gerentes:cambiar_estado` está solo para GERENTE en `prisma/seed.ts` y en la migración de permisos, y qué test de la matriz lo cubre (G-01 agregó uno en `gerente.service.pg.test.ts`).
- **Rutas y proxy:** `gerentes: ["GERENTE"]` en `rutas-por-rol.ts` y `/gerentes/:path*` en el `matcher` de `src/proxy.ts` ya cubren `/gerentes/[id]` y `/api/gerentes/[id]/desactivar`: se espera **no tocar ninguno**. Confirmarlo.
- **Componentes compartidos:** relevar `ConfirmarAccionDialog` (props `destructiva`, `confirmarDeshabilitado`, `contenido`; `onConfirmar` que lanza un `Error` con el mensaje ya resuelto) y `Dialog`. **No se modifican**; la referencia ya armada es `estado-integrante-dialog.tsx`.
- **Base de pruebas con PostgreSQL:** `scripts/test-pg.mjs` crea una base descartable **sin seed**, pero otros archivos `*.pg.test.ts` dejan fichas de gerente activas con cuenta en esa misma base. Para que la regla del último gerente sea determinista, el test de esta HU **inactiva en `beforeAll`** (escritura directa, solo en la base descartable) todas las fichas de gerente activas preexistentes y sus cuentas y las **restaura en `afterAll`**, y **se corta** si en esa base existe una ficha con DNI 24100001 o 24100002 (nunca toca un gerente del seed). Confirmar que es razonable; si no, reportar antes de inventar otra forma.
- **Fixture, sesión sin marca:** que `cambiarPassword` (módulo A) permite dejar a `88066002` sin la marca de cambio obligatorio desde un fixture (contraseña `Password123!`, distinta del DNI). Si no es razonable, reportar.
- **`obtenerNombresPersonal`:** que devuelve el nombre de las cuentas de gerente (G-01 lo verificó) y su forma de retorno (`usuario_id`, `nombre_completo`).
- **Que `texto()` interpole** `{nombre}`, `{apellido}` y `{cantidad}` (sí, F-05).
- **Tests de Sprint 1 y 2, A-06, A-05, F-01, F-03, F-05, G-01 y G-03** que se vean afectados: ninguno se borra ni se debilita.

---

## 1. Nota de alcance

HU-G-05 cierra el bloque de gerentes y el carril 4: después de G-01 (alta y edición con cuenta) y G-03 (listado), el Gerente puede dar de baja y reactivar a otro gerente. La ficha ya es accesible desde cada fila del listado, que muestra activos e inactivos: el listado no cambia. Es gemela de HU-F-05 con dos diferencias: no hay caja abierta y sí hay «no a sí mismo» y «al menos un gerente activo».

**Lo que ya existe y esta task usa** (verificado en `develop`):

| Qué | Dónde |
|---|---|
| `obtenerDetalleGerente` con `esVos`, `DetalleGerente`, ficha `/gerentes/[id]` con «Cuenta de acceso», `GET /api/gerentes/[id]` | G-01 |
| Listado con fila inactiva atenuada y `Badge` «Inactivo» | G-03 |
| `bloquear` con el recurso `fichasGerente` (varias a la vez) | `src/server/shared/bloquear.ts` |
| `desactivarCuenta` (ya revoca las sesiones), `reactivarCuenta`, `obtenerResumenCuenta`, `filtrarCuentasActivas` | `src/server/usuarios/cuenta.service.ts` |
| `registrarCambioEstado`, `listarHistorialEstados`, `actorUsuario` | `src/server/shared/historial-estados.ts`, `historial.ts` |
| `usuarioRegistroOperaciones(tx, usuarioId)` (agregador de F-05, con las líneas de I, C, L y estados) | `src/server/shared/actividad-usuario.ts` |
| `obtenerNombresPersonal` (resuelve también gerentes) | `src/server/personal/personal.publico.ts` |
| `ConfirmarAccionDialog`, `Dialog`, `toast` (sonner), patrón del diálogo y del historial | `src/components/shared/`, `src/app/(dashboard)/personal/[id]/` (F-05) |
| `errores.gerente.noEncontrado`, `conflictoEdicion`, `datosInvalidos`, `interno`, `comunicacion` | `src/lib/textos.ts` (G-01) |
| Permisos `gerentes:cambiar_estado` y `gerentes:leer` solo para GERENTE; regla de ruta `gerentes` y `matcher` del proxy | `prisma/seed.ts`, migración de permisos, G-01 |

**Lo que no existe y hace esta task:** `desactivarGerente` y `reactivarGerente`, sus schemas, tipos y errores, el detalle ampliado, los dos Route Handlers y las dos Server Actions, el diálogo, el historial y los botones de la ficha, los textos, la fixture y los documentos de 0.1.16.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- El alta y la modificación (HU-G-01) y el listado, la búsqueda y la paginación (HU-G-03): solo se confirma que el listado refleja el estado.
- Cambiar el rol de una cuenta, que un gerente cambie su propia contraseña (HU-A-06, criterio 4), borrado físico y transferir permisos.
- La línea de N en el agregador de «registró operaciones» (HU-N-01) y ampliarlo a altas de alumnos, profesores, materias o aulas. El agregador no se toca.
- Crear una cuenta para una ficha sin cuenta (DEC-14).
- `gerente.publico.ts` y `obtenerNombresGerentes` (ver G-01).
- Que «Volver al listado» conserve la búsqueda (deuda conocida).
- Modificar componentes compartidos (`ConfirmarAccionDialog`, `ConfirmarDescarteDialog`, `CuentaAccesoCard`, etc.). Los textos fijos de `ConfirmarDescarteDialog` siguen siendo deuda.
- Desactivar o modificar a los gerentes del seed base en cualquier prueba.
- Migraciones, `schema.prisma` y `seed.ts`.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** desactivar a un gerente que deja de trabajar en el centro y reactivarlo si vuelve
**Para** que no pueda acceder al sistema, conservando el registro de las operaciones que realizó, y poder volver a habilitarlo sin registrarlo de nuevo

**SP estimado:** 3 (2 + 1: absorbe HU-G-06, reactivar)

---

## 3. Alcance de esta task

- `desactivarGerente` y `reactivarGerente`, con sus schemas, errores y textos; las reglas «no a sí mismo» y «al menos un gerente activo» con el bloqueo de todas las fichas activas.
- El detalle de la ficha con `historialEstados`, `motivoObligatorioAlDesactivar` y `esUltimoGerenteActivo`.
- Dos Route Handlers y dos Server Actions.
- La ficha con «Desactivar», «Reactivar», el aviso del último gerente activo y el historial de estados.
- Fixture, reglas en `RULES.md`, nota aditiva en `spec_modulo_G.md` y evidencia.

---

## 4. Contrato Backend

El contrato completo está en `docs/specs/spec_modulo_G.md` §2.4 a §2.6 y §3.4 a §3.6; esta sección fija qué se implementa y dónde (las decisiones están en 0.1).

- **Schemas:** `DesactivarGerenteSchema` y `ReactivarGerenteSchema` (con sus tipos de entrada) en `src/server/gerentes/gerente.schema.ts`.
- **Servicio:** `desactivarGerente`, `reactivarGerente` y el detalle ampliado en `src/server/gerentes/gerente.service.ts`. Una transacción cada uno; el orden es el de 0.1.3 y 0.1.5. Nunca devuelve textos: lanza `ErrorDeDominio(clave)`.
- **Errores:** claves nuevas en `errores-dominio.ts` y `textos.ts` (0.1.7).
- **Tipos:** `DetalleGerente` suma los tres campos; `EntradaHistorialGerente` y `EstadoGerenteCambiado` (`{ id, activo, version }`) en `src/types/gerente.types.ts`.
- **Rutas:** `src/app/api/gerentes/[id]/desactivar/route.ts` y `reactivar/route.ts` (`POST`, `gerentes:cambiar_estado`). `GET /api/gerentes/[id]` devuelve los campos nuevos.
- **Server Actions:** `desactivarGerente(id, datos)` y `reactivarGerente(id, datos)` en `src/server/gerentes/actions.ts` (permiso → Zod → servicio → `{ data, error }`).
- **Trazabilidad (Regla N.° 2):** opción (b), `registrarCambioEstado` con entidad `FICHA_GERENTE` y acción `DESACTIVAR` (con motivo) o `REACTIVAR`, **después del commit**; la fila de la ficha suma `version` y `modificadoPorUsuarioId` en la misma operación.
- **Regla 3.4 (spec G):** toda baja toma `FOR UPDATE` sobre todas las fichas de gerente activas más la objetivo, por id ascendente, y cuenta después de tener los bloqueos; la prueba con PostgreSQL de dos bajas cruzadas es de esta HU.

**Respuesta `200 OK`** (baja): `{ "data": { "id": "cuid", "activo": false, "version": 4 }, "error": null }`. La reactivación devuelve `activo: true`.

---

## 5. Frontend

**Prototipo, descripción visual detallada.** Las dos figuras son capturas de pantalla completa del sistema con la sesión de una gerente («Carolina Paz · Gerente»), con el mismo menú lateral de la figura 96 (fondo azul marino oscuro, logo «Noctium» con una luna, sección «GESTIÓN» con el ítem «Gerentes» activo, en una píldora de fondo verde azulado con texto blanco; abajo, la tarjeta del usuario y las herramientas del prototipo «PROBAR COMO», «Ver pantallas de acceso» y «Restablecer datos de ejemplo», que **no se implementan**). El pie de la página 88 dice «Quién la usa: Gerente. Baja de otro gerente; nunca de uno mismo ni del último activo.».

**Figura 97 (página 88) — «Ficha de otro gerente».** Área de contenido de fondo gris cálido claro:
- **Migas** arriba a la izquierda: «Gerentes» (subrayado, enlace), una barra «/» y «Andrés Molina».
- **Cabecera en una fila.** A la izquierda, el título «Andrés Molina» (grande, en negrita) y debajo, en gris, «Gerente». A la derecha, dos botones en fila: **«Editar»** (fondo blanco, borde gris fino, ícono de lápiz a la izquierda) y **«Desactivar»** (fondo blanco, borde, texto e ícono de encendido —el símbolo de «power»— en rojo, esquinas redondeadas).
- **Cuatro tarjetas** blancas de borde fino y esquinas redondeadas, en una grilla de dos columnas:
  - Arriba a la izquierda, **«Identidad»**: NOMBRE «Andrés», APELLIDO «Molina»; DNI «26444555», FECHA DE NACIMIENTO «20/02/1975»; GÉNERO «Masculino» y ESTADO con una etiqueta verde claro «Activo». Las etiquetas de los campos van en mayúsculas, letra chica y gris; los valores, en un tono más oscuro (DNI en tipografía de ancho fijo).
  - Arriba a la derecha, **«Cuenta de acceso»**: ESTADO con etiqueta verde claro «Activa», ROL «Gerente»; USUARIO (EMAIL) «gerente2@noctium.local»; y un texto chico en gris: «La cuenta se crea al registrar la ficha: el usuario es el email y la contraseña inicial es el DNI, que se cambia obligatoriamente en el primer ingreso (HU-A-06).».
  - Abajo a la izquierda, **«Contacto»**: TELÉFONO «+54 11 5550-0002» (ancho fijo), EMAIL «gerente2@noctium.local»; ALTA «03/02/2025» y ÚLTIMA MODIFICACIÓN «Sin cambios» (en cursiva).
  - Abajo a la derecha, bajo «Cuenta de acceso», **«Historial de estados»** con el texto gris «Sin bajas ni reactivaciones.».
- **Qué mirar** (pie): «Botón "Desactivar" (en la ficha propia no aparece, criterio 2).».

**Figura 98 (página 89) — «Confirmación de la baja».** La misma ficha, atenuada por una capa gris semitransparente, y un **modal centrado** (tarjeta blanca de esquinas redondeadas) con, de arriba abajo:
- Título en negrita, en dos líneas: «¿Estás seguro de que querés desactivar a Andrés Molina? No podrá ingresar al sistema.».
- Texto gris: «Las operaciones que registró se conservan con su nombre. Su cuenta pasa a inactiva y se cierran todas sus sesiones.».
- Etiqueta «Motivo de la baja» (peso medio) y, debajo, en gris y letra chica, «Opcional».
- Un área de texto de tres líneas de alto, ancho completo, con borde verde azulado (foco) y esquinas redondeadas, con el tirador de redimensionado en la esquina; debajo, a la derecha, el contador «0 / 300».
- Pie, a la derecha: «Volver» (botón blanco con borde fino) y «Desactivar» (relleno rojo, texto blanco).
- **Qué mirar** (pie): «"¿Estás seguro de que querés desactivar a <gerente>? No podrá ingresar al sistema.", con el motivo, que es obligatorio cuando el gerente registró operaciones (en este ejemplo es opcional porque no registró ninguna) (criterio 1).».

**Lo que las capturas no muestran:** «Reactivar», la ficha inactiva, el motivo obligatorio, un rechazo del servidor dentro del modal, el aviso del último gerente activo, el historial con entradas y la ficha propia (que, según el pie, no tiene «Desactivar»).

**Diferencias entre el prototipo y el repo, y qué prevalece** (el backlog manda; en lo visual se sigue el patrón vigente de G-01 y F-05, que no se reorganiza):
- **Ficha:** en el repo «Registro» (alta y última modificación) es una sección propia debajo de «Identidad» y «Contacto», no parte de «Contacto»; el estado se muestra como etiqueta «Inactivo» junto al nombre solo cuando corresponde (no hay un campo «Estado» en «Identidad»); no hay subtítulo «Gerente» bajo el nombre; las migas dicen «Apellido, Nombre»; el DNI y el teléfono van sin tipografía de ancho fijo. El texto chico de «Cuenta de acceso» es del componente compartido `CuentaAccesoCard`, que no se toca.
- **Diálogo:** la ayuda «Opcional» va debajo del campo, con el contador a la derecha (como D-08 y F-05); el prototipo la muestra arriba del campo.
- **Datos del ejemplo** (Andrés Molina y los demás): son ilustrativos; no se cambia ningún dato del seed.
- **Menú:** sección desplegable «Gerentes» con «Listado» (G-01); no se toca.

**A implementar** (decisiones en 0.1.12 y 0.1.13): `page.tsx` de la ficha (servidor: `exigirPermiso("gerentes:leer")`, `tienePermiso("gerentes:cambiar_estado")`, pasa `version`, `esVos`, `esUltimoGerenteActivo` y `motivoObligatorioAlDesactivar` al diálogo), `estado-gerente-dialog.tsx` (cliente: baja, aviso del último gerente activo y reactivación) e `historial-estados-gerente.tsx`, con el mismo formato de entrada que el de F-05 (acción, fecha y hora en la zona del centro con `fechaHoraDeInstante`, usuario y motivo). Antes de implementar, actualizar `docs/DESIGN.md` §6.4 (0.1.16). Seguir la guía de diseño: tokens de shadcn/ui y Tailwind del proyecto, nunca colores hexadecimales ni la paleta por defecto.

**Fuera de alcance de frontend:** cambiar la distribución de la ficha de G-01, el listado y el formulario de edición.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
- **Schemas:** `version` obligatoria y entera; `motivo` recortado, vacío = no enviado, 301 caracteres rechazado con el mensaje de `textos.ts`; `.strict()` rechaza `activo`, `usuarioId` y cualquier otro campo.
- **Servicio con mocks:** baja feliz (orden de llamadas: lectura simple → autodesactivación → bloqueo de las fichas activas más la objetivo → relectura → `yaInactivo` → versión → último gerente → motivo → `updateMany` → cuenta → historial); `noEncontrado`; **autodesactivación rechazada antes de bloquear** (`bloquear` no se llama) y con una ficha ajena sí se bloquea; `yaInactivo`; versión vieja; `ultimoGerenteActivo` (no queda otra ficha activa con cuenta activa) y **no** se dispara si queda al menos una; una ficha activa sin cuenta y una ficha activa con cuenta inactiva **no cuentan** como gerente activo; el objetivo no se cuenta; motivo requerido con operaciones y opcional sin ellas; ficha sin cuenta (no llama a `usuarioRegistroOperaciones` ni a las funciones de cuenta); historial encolado para después del commit y descartado si la transacción revierte; no se llama a `revocarSesiones` por separado; actor que no es usuario (no se compara con `usuarioId` y `modificadoPorUsuarioId` queda en `null`). Reactivar: `yaActivo`, versión, cuenta reactivada, sin motivo, sin regla de último gerente.
- **Detalle ampliado:** historial del más reciente al más antiguo con el nombre; `motivoObligatorioAlDesactivar` solo con ficha activa y con cuenta; `esUltimoGerenteActivo` verdadero solo con ficha activa y sin otro gerente activo con cuenta activa, y `false` con la ficha inactiva; `esVos` sin cambios.
- **Acciones:** permiso antes de Zod (sin permiso no se valida), resultado `{ data, error }`, `revalidatePath` de `/gerentes` y de la ficha.
- **Rutas:** `200` con la forma de 0.1.11, `400` (cuerpo ausente, `version` faltante, campo ajeno, motivo de 301), `401`, `403` para MESA_ENTRADA, PROFESOR y ALUMNO, `404`, `409` (`GERENTE_YA_INACTIVO`, `GERENTE_YA_ACTIVO`, `ULTIMO_GERENTE_ACTIVO`, `CONFLICTO_EDICION_CONCURRENTE`), `400 MOTIVO_REQUERIDO` y `422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`. `GET /api/gerentes/[id]` con los campos nuevos.
- **Pantalla:** «Desactivar» solo con ficha activa, permiso y ficha ajena; **no aparece en la ficha propia** aunque haya permiso; «Reactivar» solo con ficha inactiva y permiso; ninguno sin `gerentes:cambiar_estado`; con `esUltimoGerenteActivo` se abre el aviso y no la confirmación; motivo obligatorio (confirmar deshabilitado) y opcional; contador y tope de 300; error del servidor dentro del modal (incluido el 422 y el último gerente activo); éxito con toast y refresco; reactivación; variantes sin cuenta; historial con y sin entradas.
- **Con PostgreSQL real** (nuevo `gerente.estado.pg.test.ts`, con el aislamiento de 0.2: fichas activas preexistentes inactivadas en `beforeAll` y restauradas en `afterAll`, y corte si existen los DNI del seed):
  - Baja con cuenta: ficha y cuenta inactivas en la misma transacción, `version + 1`, `modificadoPorUsuarioId`, `sesionesValidasDesde` fijado, marca de cambio de contraseña intacta; fila de historial `DESACTIVAR` con el motivo y el actor, escrita después del commit.
  - Rollback: si falla la cuenta, la ficha sigue activa y no queda historial.
  - Reactivar: ficha y cuenta activas, **el umbral de sesiones y la marca conservados**, historial `REACTIVAR`; después de varias bajas y reactivaciones se conservan todas las filas.
  - **Autodesactivación:** rechazada con `422` sin cambiar nada (ni ficha, ni cuenta, ni historial), incluso con una `version` vieja.
  - **Último gerente activo (spec G §3.4), las dos órdenes deterministas con la técnica de pausa por `bloquear` de `profesor.estado.pg.test.ts`:** con A y B como únicos gerentes activos con cuenta, **dos bajas cruzadas** (el actor A desactiva a B y el actor B desactiva a A): exactamente una confirma y la otra responde `ULTIMO_GERENTE_ACTIVO`; queda exactamente una ficha activa con cuenta activa y un solo historial `DESACTIVAR`. Y el caso de la **lectura vieja**: la segunda transacción lee los ids de las activas, se la pausa antes de pedir el bloqueo, la primera confirma, y al continuar la segunda **relee** y responde `ULTIMO_GERENTE_ACTIVO` (no cuenta con el estado anterior).
  - Con tres gerentes activos con cuenta, dos bajas simultáneas de objetivos distintos hechas por el tercero: las dos confirman y el tercero sigue activo.
  - Un único gerente activo con cuenta como objetivo y el resto sin cuenta o con cuenta inactiva: `ULTIMO_GERENTE_ACTIVO`.
  - Dos bajas simultáneas del mismo objetivo con la misma versión: una gana y la otra recibe conflicto o `yaInactivo`, con un solo historial.
  - El DNI y el email de la ficha inactiva siguen reservados (alta duplicada: `DNI_DUPLICADO`; el email sigue en uso).
  - Ficha sin cuenta: baja sin motivo y reactivación con historial, sin tocar ninguna cuenta.
  - Nada se borra: las operaciones del gerente (por ejemplo, sus registros de historial) siguen mostrando su nombre con `obtenerNombresPersonal`.
  - El listado (`listarGerentes`) muestra la ficha como inactiva tras la baja y como activa tras la reactivación (criterio 5).

### Nivel 2 — Postman (o curl, documentado como en G-01 y G-03)
Con sesión de Gerente: `GET /api/gerentes/[id]` con los campos nuevos; `POST …/desactivar` sin motivo (gerente sin operaciones, `200`), con motivo, sin motivo con operaciones (`400 MOTIVO_REQUERIDO`), con versión vieja (`409`), a un ya inactivo (`409`), con campo ajeno o `version` faltante (`400`) y a un id inexistente (`404`); **autodesactivación con la sesión de `88066002` sobre su propia ficha (`422`, sin ningún cambio)**; `POST …/reactivar` (`200`, a un ya activo `409`, versión vieja `409`); sin permiso (`403` con Mesa de entrada, Profesor y Alumno) y sin sesión (`401`). Después de la baja de `88066002`: su sesión previa responde `401 SESION_INVALIDA` y el login responde la cuenta inactiva; después de reactivar, tiene que volver a iniciar sesión. En una cuenta que todavía no cambió la contraseña (por ejemplo `88066001`), el servidor sigue mandándola a `/primer-ingreso` (`403 DEBE_CAMBIAR_PASSWORD`). **`ULTIMO_GERENTE_ACTIVO` no se reproduce por HTTP sin desactivar a los gerentes del seed**, que no se tocan: se documenta que lo cubre el Nivel 1 con PostgreSQL. Los gerentes del seed pueden ser quienes dan de baja, nunca el objetivo.

### Nivel 3 — BD / TablePlus
- `fichas_gerente`: `activoFichaGerente`, `version` y `modificadoPorUsuarioId` antes y después de la baja y de la reactivación.
- `usuarios`: `activoUsuario`, `sesionesValidasDesdeUsuario` y `debeCambiarPasswordUsuario` (la marca se conserva) para esa ficha.
- `historial_estados`: una fila por baja y por reactivación (`entidad = FICHA_GERENTE`, acción, motivo, usuario y fecha); ninguna fila del historial ni de las operaciones del gerente desaparece.
- Una baja rechazada (autodesactivación, motivo faltante, versión vieja) no deja filas nuevas ni cambia la ficha ni la cuenta. Los gerentes 24100001 y 24100002 no cambian.
- Recorrido en el navegador como Gerente: listado → ficha de `88066001` → «Desactivar» (motivo opcional) → el listado la muestra «Inactivo» y atenuada; `88066002` (motivo obligatorio); «Reactivar» con `88066004`; ficha sin cuenta con `88066003`; historial en la ficha; **la propia ficha (entrando con una cuenta del seed, solo para mirar) no muestra «Desactivar»**; como Mesa de entrada, la ficha y las rutas rechazan.
- **Verificaciones diferidas que cierra esta HU:** HU-A-06 criterio 7 para gerentes (desactivar y reactivar la ficha desactiva y reactiva la cuenta; la marca de cambio se conserva) y HU-G-03 criterio 4, parte «acceso a desactivar o reactivar desde la ficha» (hasta ahora solo se verificó que cada fila lleva a la ficha).

---

## 7. Checklist de Definition of Done

- [x] Servicio, Route Handlers, Server Actions y pantalla implementados, sin lógica de negocio en la capa delgada (Regla N.° 4); respuesta `{ data, error }` (Regla N.° 5) y validación Zod previa (Regla N.° 6).
- [x] Baja y reactivación atómicas de la ficha y su cuenta, con `version` (Regla N.° 7), sin ningún `DELETE` físico (Regla N.° 1) y con motivo obligatorio según DEC-39.
- [x] «No a sí mismo» decidido en el servidor antes de bloquear; «al menos un gerente activo» con `FOR UPDATE` sobre todas las fichas activas por id ascendente y conteo posterior a los bloqueos, probado con PostgreSQL con dos bajas cruzadas y con lectura vieja (spec G §3.4).
- [x] Fichas sin cuenta: entran en el bloqueo, no cuentan para «al menos un gerente activo» y se pueden desactivar y reactivar; probado.
- [x] Historial de estados escrito después del commit, con todas las bajas y reactivaciones conservadas (Regla N.° 2).
- [x] Solo el Gerente: `403` en el servidor para cualquier otro rol (Regla N.° 10).
- [x] Todos los textos visibles en `textos.ts`, verificados con `scripts/verificar-claves-textos.ts`; los propuestos marcados como tales.
- [x] Ningún componente compartido modificado; el agregador `actividad-usuario.ts` sin tocar; ningún test de Sprint 1, 2, A-06, A-05, F-01, F-03, F-05, G-01 y G-03 borrado ni debilitado.
- [x] Fixture `hu-g-05.ts` con su línea en el índice, sin editar `seed.ts`; el seed corre dos veces sin duplicar; los gerentes del seed base no se modifican.
- [x] Filas de esta HU en `docs/DESIGN.md` §6.4 (la cláusula corregida de la ficha del gerente y la entrada del historial de cambios, sin fecha).
- [x] Reglas en `RULES.md` (solo la sección nueva «Aplicación HU-G-05»; no se modifica ninguna regla existente) y nota aditiva en `spec_modulo_G.md` (diferencias de 0.1: `errores.general.conflictoEdicion`, `desactivarCuenta` que ya revoca, bloqueo por ids con relectura, `obtenerNombresPersonal`, forma del historial, agregador ya existente, textos propuestos).
- [x] `lint`, `tsc`, `npm test`, `npm run test:pg` y `next build` sin fallos nuevos respecto de `develop` (los conocidos están en el handoff del carril).
- [x] Tests de los 3 niveles documentados en `docs/testing/Modulo G/hu-g-05/HU-G-05-evidencia.md`.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapas de implementación

Antes de escribir código, Claude Code verifica los puntos de la sección 0.2; **solo si alguno contradice lo decidido, se detiene y reporta** y, si no, sigue. No hace commit, push ni cambios de rama, no borra nada, no usa `prisma migrate dev`, no escribe ninguna fecha ni plazo en ningún archivo y no toca el PDF del prototipo ni `.vitest/`. Para las pantallas intenta rasterizar las páginas 88 y 89 del PDF a PNG en una carpeta temporal **fuera del repo** (por ejemplo con `pip install pymupdf`) y, si no puede, sigue la descripción de la sección 5. Al terminar cada etapa **se detiene** y reporta archivos, resultados de los comandos, desvíos y dudas; la siguiente empieza cuando Adriel dice «continuamos».

**Etapa 1 — Backend** (todo menos la pantalla). Orden: 1) errores y textos de error, schemas y tipos; 2) `desactivarGerente`, `reactivarGerente` y el detalle ampliado, con sus tests (unitarios y PostgreSQL, incluidas las bajas cruzadas y la lectura vieja); 3) Server Actions y Route Handlers con sus tests; 4) `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:pg` (el nuevo y los de gerentes, personal y cuentas), `npx tsx scripts/verificar-claves-textos.ts`.

**Etapa 2 — Pantalla y cierre.** Orden: 1) filas de `docs/DESIGN.md` §6.4 (0.1.16); 2) textos de la pantalla; 3) diálogo, historial y ficha, con sus tests (y los de G-01 adaptados); 4) fixture `hu-g-05.ts`, su línea en el índice y `npx prisma db seed` (dos veces); 5) `RULES.md`, nota aditiva en `spec_modulo_G.md` y evidencia (Nivel 2 y Nivel 3; el recorrido en el navegador queda «pendiente del responsable»); 6) `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:pg`, `npx tsx scripts/verificar-claves-textos.ts`, `npx prisma db seed` (dos veces) y `next build`, **de a uno** (`test:pg` y `next build` no se corren a la vez).

**Cierre.** Cuando Adriel hizo el recorrido en el navegador y dice «continuamos»: Claude Code actualiza la evidencia con el resultado del recorrido (de «pendiente del responsable» a lo que Adriel informe); la entrada de `DESIGN.md` ya va sin fecha, no hay nada que reemplazar. Luego se detiene.

---

## 9. Resultado de la implementación

**Estado:** implementada en dos etapas más el cierre, y verificada. El recorrido en el navegador lo hizo el responsable y no tuvo observaciones; las capturas de la ficha y del modal de baja se compararon con las figuras 97 y 98 (coinciden, con las diferencias aceptadas de 9.3). Queda abierto solo lo marcado «propuesto», que valida el PO. Evidencia completa en `docs/testing/Modulo G/hu-g-05/HU-G-05-evidencia.md`. Con esta HU termina el carril 4.

### 9.1. Criterios de aceptación

| Criterio | Resultado |
|---|---|
| HU-G-05 c1: baja con confirmación («¿Estás seguro de que querés desactivar a <gerente>? No podrá ingresar al sistema.») y motivo, obligatorio si el gerente registró operaciones | Cumplido. Tests unitarios, de pantalla y con PostgreSQL; Nivel 2 (`MOTIVO_REQUERIDO` con operaciones, baja sin motivo sin ellas); recorrido en el navegador (modal de la figura 98, botón «Desactivar» deshabilitado con el campo vacío y la ayuda «Obligatorio: tiene operaciones registradas») |
| HU-G-05 c2: un gerente no se desactiva a sí mismo | Cumplido. Lo decide el servidor (`422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`) antes de tomar ningún bloqueo y sin cambiar nada (ni ficha, ni cuenta, ni historial), incluso con una versión vieja; probado por HTTP con la sesión de 88066002 sobre su propia ficha. La pantalla no muestra «Desactivar» en la ficha propia (tests y recorrido) |
| HU-G-05 c3: debe quedar al menos un gerente activo | Cumplido, **probado solo con tests**. Dos bajas cruzadas en las dos órdenes deterministas, lectura vieja con relectura posterior al bloqueo, tres gerentes con dos bajas simultáneas y un único gerente con cuenta activa como objetivo (`ULTIMO_GERENTE_ACTIVO`), todo con PostgreSQL real. No se reproduce por HTTP ni en el navegador sin desactivar a los gerentes del seed, que no se tocan |
| HU-G-05 c4: el historial de estados conserva cada baja y cada reactivación | Cumplido. `registrarCambioEstado` se escribe después del commit y se descarta si la transacción revierte; tras varias bajas y reactivaciones se conservan todas las filas; la ficha muestra el historial con acción, fecha y hora, usuario y motivo, del más reciente al más antiguo (tests, Nivel 3 y recorrido) |
| HU-G-05 c5: el listado refleja el estado y la baja informa el éxito | Cumplido. «Gerente desactivado correctamente» y «Gerente reactivado correctamente» (literales del backlog); el listado muestra la ficha «Inactivo» y atenuada tras la baja y activa tras la reactivación (test con PostgreSQL, Nivel 2 y recorrido) |
| HU-G-05 c6: reactivar con confirmación | Cumplido. Ficha y cuenta activas, historial conservado, versión sumada, la marca de cambio de contraseña conservada y las sesiones cerradas en la baja no restauradas (tests, Nivel 2 y recorrido) |
| HU-G-05 c7 y HU-A-06 c7 para gerentes: desactivar y reactivar la ficha desactiva y reactiva la cuenta | Cumplido. Misma transacción; `sesionesValidasDesde` fijado en la baja (la sesión previa responde `401 SESION_INVALIDA`); la marca de cambio de contraseña se conserva. **Cierra la verificación diferida de A-06** |
| HU-G-03 c4, parte «acceso a desactivar o reactivar desde la ficha» | Cumplido. Cada fila del listado lleva a la ficha, que ofrece «Desactivar» o «Reactivar» según el estado y el permiso. **Cierra la verificación diferida de G-03** |
| Solo el Gerente | Cumplido. `403 SIN_PERMISO` con Mesa de entrada, Profesor y Alumno en las dos rutas y en las Server Actions (el permiso se verifica antes que Zod); `401` sin sesión |
| Fichas sin cuenta | Cumplido. Se desactivan y reactivan igual (sin tocar ninguna cuenta ni llamar a «registró operaciones»), entran en el bloqueo y no cuentan para «al menos un gerente activo» |

### 9.2. Qué dejó hecho

- **Backend:** `desactivarGerente` y `reactivarGerente` en `gerente.service.ts`; la baja lee la ficha, decide la autodesactivación, bloquea en una sola llamada todas las fichas activas más la objetivo, relee y cuenta sobre la relectura (decisión 0.1.3 y 0.1.4); `DesactivarGerenteSchema` y `ReactivarGerenteSchema` (`.strict()`); el detalle suma `historialEstados`, `motivoObligatorioAlDesactivar` y `esUltimoGerenteActivo` sin cambiar la firma; cinco errores nuevos; `POST /api/gerentes/[id]/desactivar` y `/reactivar`; Server Actions `desactivarGerente` y `reactivarGerente`. Sin migración y sin cambios en `schema.prisma`, `seed.ts`, el agregador `actividad-usuario.ts` ni en ningún componente compartido.
- **Pantalla:** `estado-gerente-dialog.tsx` (baja, aviso informativo del último gerente activo y reactivación, sobre `ConfirmarAccionDialog`), `historial-estados-gerente.tsx` y los botones «Desactivar» y «Reactivar» en la ficha, que solo aparecen con `gerentes:cambiar_estado` y, la baja, solo en una ficha ajena.
- **Tests:** nuevos `gerente.estado.pg.test.ts` (15 tests con PostgreSQL), `estado-gerente-dialog.test.tsx` y los de las dos rutas; adaptados los de schema, servicio, acciones, `GET /api/gerentes/[id]` y `paginas.test.tsx` sin debilitarse (los que fijaban «sin Desactivar ni Reactivar ni historial» ahora exigen su ausencia sin el permiso y en la ficha propia).
- **Fixture** `hu-g-05.ts` con su línea en `fixtures/index.ts`: 88066001 (activo, sin operaciones), 88066002 (activo, con operaciones, sesión de las pruebas propias), 88066003 (activo, sin cuenta) y 88066004 (dado de baja con motivo).
- **Documentos:** filas de la ficha y de las tres acciones en `DESIGN.md` §6.4 (más el aviso en la excepción de §6.3 y la entrada del historial, sin fecha), sección «Aplicación HU-G-05 — Baja y reactivación de gerentes» en `RULES.md`, «Nota de implementación HU-G-05» en `spec_modulo_G.md` y la evidencia.

### 9.3. Desvíos respecto de lo decidido

1. **Ids sin repetir antes de bloquear.** El objetivo puede figurar entre las fichas activas, así que se quitan los repetidos antes de llamar a `bloquear` y de releer. Es el mismo conjunto, en una sola llamada.
2. **Un test de más:** las bajas cruzadas sin pausas, además de las dos órdenes deterministas.
3. **Aislamiento del test con PostgreSQL:** las fichas activas preexistentes se inactivan en cada `beforeEach` (no solo en `beforeAll`), porque cada caso del último gerente necesita arrancar sin gerentes activos; `afterAll` las restaura y el archivo se corta si existen los DNI 24100001 o 24100002.
4. **Nivel 2 con un script de Node (`fetch`)** en lugar de curl: 57 pedidos, mismos requests, documentado así en la evidencia. Los pedidos de pantalla pasaron a figurar como Nivel 3 (3.6).
5. **Fixture:** 88066002 quedó con la contraseña `Password123!` y sin la marca de cambio obligatorio, cambiada con el servicio de A; es idempotente por DNI, por la marca y por el historial.
6. **Diferencias con el prototipo aceptadas** (patrón vigente de G-01 y F-05, el backlog manda): sin subtítulo «Gerente» bajo el nombre, «Registro» como sección propia, estado como etiqueta «Inactivo» junto al nombre solo cuando corresponde, migas «Apellido, Nombre», «Opcional» debajo del campo con el contador a la derecha, y «Cuenta de acceso» con «Historial de estados» en dos columnas debajo de «Registro». Claude Code rasterizó las páginas 88 y 89 con `pymupdf`, en una carpeta fuera del repo, y el chat comparó las capturas del responsable con las figuras 97 y 98.
7. **`DESIGN.md`:** además de las filas, el aviso del último gerente activo se sumó a la excepción de §6.3, a continuación del aviso de caja abierta de F-05; la entrada del historial de cambios va sin fecha, después de la de G-03.
8. **Listado:** el seed y las fixtures suman ahora 20 gerentes (siguen dos páginas); la base de desarrollo tiene 22 por altas de pruebas manuales anteriores.
9. **Enlace en la evidencia:** usa la ruta relativa correcta a la task (`../../../tasks/...`); la evidencia de F-05 usa `../tasks/...`, que está roto, y no se tocó.
10. **Finales de línea:** los archivos nuevos quedaron en LF y los modificados conservan el CRLF de la copia local.

### 9.4. Verificación final

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores (queda el aviso previo de `CALENDARIO` en `Sidebar.tsx`) |
| `npx tsc --noEmit` | Sin errores |
| `npm test` | 3795 pasan, 0 fallan (482 omitidos por guarda) |
| `npm run test:pg` completo | Pasada principal: 428 pasan, 0 fallan (40 omitidas); las pasadas propias (2, 1, 6, 5, 18 y 22 tests) también pasan |
| `npx tsx scripts/verificar-claves-textos.ts` | Aprobado |
| Seed dos veces | Sin errores; la segunda no cambia nada; los gerentes 24100001 y 24100002 no cambiaron |
| `next build` | Compila y genera `/api/gerentes/[id]/desactivar` y `/reactivar` |
| Nivel 2 | 57 pedidos, todos con el resultado esperado |
| Nivel 3 | Consultas de solo lectura sobre `fichas_gerente`, `usuarios` e `historial_estados`, más las pantallas por HTTP |
| Recorrido en el navegador | Realizado por el responsable, sin observaciones |

El cierre solo tocó documentación: no se corrieron de nuevo los comandos de la segunda etapa.

### 9.5. Deuda y pendientes

- **Textos propuestos, a validar con el PO:** `errores.gerente.noPuedeDesactivarseASiMismo`, `motivoRequerido` (P-F6), `motivoDemasiadoLargo`, `yaInactivo` y `yaActivo`; `ui.gerentes.ficha.reactivar`; `ui.gerentes.baja.detalleSinCuenta`, `motivoObligatorio` («Obligatorio: tiene operaciones registradas»), `ultimoActivoTitulo` y `cerrar`; el título y los detalles de `ui.gerentes.reactivacion.*`; y «Desactivación», «Reactivación» y «Usuario» de `ui.gerentes.historial.*`. Son literales los de las figuras 97 y 98, «Debe quedar al menos un gerente activo» y los dos toasts de éxito.
- **«Al menos un gerente activo» no se reproduce en el navegador** con datos reales (hay más gerentes activos); queda cubierto por los tests con PostgreSQL. El aviso informativo de la pantalla se prueba con datos de prueba.
- **Duplicación** entre `desactivarIntegrante` y `desactivarGerente`, entre `estado-integrante-dialog.tsx` y `estado-gerente-dialog.tsx`, y entre los dos historiales de estados: se suma a la deuda ya registrada (no se refactoriza).
- **Línea de N** en el agregador de «registró operaciones»: sigue siendo deuda de HU-N-01.
- **Verificaciones diferidas de este carril: ninguna queda abierta.** Esta HU cerró A-06 c7 para gerentes y G-03 c4 (parte del acceso desde la ficha). Siguen sin dueño las de I-07 (forma de pago preferida inactiva de I-10 y forma de pago inactiva de I-06; confirmar con Iván y Cali).
- **Línea base nueva** para el carril: `npm test` 3795 pasan y 482 omitidos; `npm run test:pg` 428 pasan y 40 omitidas, 0 fallos.
- **Base de desarrollo:** las fichas 88066001 a 88066004 quedaron con historial por las pruebas HTTP y el recorrido; `npx prisma migrate reset --force` y el seed la devuelven al estado del seed. Los gerentes 24100001 y 24100002 no se modificaron.