# TASK: HU-I-12 — Abrir y cerrar mi caja con arqueo ciego

**Módulo:** I (Pagos)
**Sprint:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_I.md` §2.10 (2.10.1 Abrir, 2.10.2 La caja propia, 2.10.5 Errores) · §2.11 (Cerrar con arqueo ciego, dos pasos) · §2.12 (Cajas del gerente, cierres y cierre por ausencia) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-I-12, líneas 287-308) · `docs/tasks/Sprint 3/Modulo C/HU-C-25.md` (`ConfirmarAccionDialog`) · `docs/tasks/Sprint 3/PR-0.md` §2.5 y §2.13 (modelo y servicio de caja, ya mergeados) · `docs/RULES.md` (Reglas N.° 1, 2, 4, 5, 6, 7, 8, 10, 11)
**RBAC:** `cajas:abrir`, `cajas:cerrar`, `cajas:leer` (MESA_ENTRADA) y `cajas:leer_todas`, `cajas:cerrar_ausencia` (GERENTE) — **ya existen en el seed** (`prisma/seed.ts:959-964`), sin permisos nuevos que crear.
**Schema:** ya completo, sin migración. `Caja` (con `porAusencia`, `efectivoDeclarado` nullable, `efectivoEsperado`, `diferencia`, `resumen` JSONB) ya migrada por el PR 0.

---

## 0. Relevamiento previo a implementación (Claude Code)

Esta sección incorpora, además de la auditoría original contra `develop` (commit `efc148d`), el relevamiento que Claude Code hizo sobre `feature/HU-I-12` (mismo commit) y las correcciones/decisiones ya acordadas con el equipo a partir de ese relevamiento. **Todo lo marcado como "Resuelto así" en 0.4 ya tiene OK y no se vuelve a preguntar.**

**Reglas no negociables de `docs/RULES.md` que esta task debe cumplir** (leer el archivo completo antes de implementar):
- **Regla N.° 1** — nada se borra; el cierre y sus registros son inmutables por diseño del PR 0, esta task no agrega ningún `DELETE`.
- **Regla N.° 2** — la caja y sus movimientos/ajustes/anulaciones son su propia traza (opción a: cada registro lleva usuario y fecha); no hace falta tabla de eventos nueva.
- **Regla N.° 4** — toda la lógica de negocio del cierre, el arqueo y la huella ya vive en `caja.service.ts` (ver 0.1), que **no se modifica**; los envoltorios transaccionales nuevos (`caja.flujos.ts`, ver 0.4) y los Route Handlers son delgados y no reimplementan nada de eso.
- **Regla N.° 5 / N.° 6** — los endpoints nuevos responden `{ data, error }` con Zod antes del servicio.
- **Regla N.° 7** (concurrencia) — ya resuelta por `bloquear(tx, { cajas: [id] })` dentro de `caja.service.ts` (cierre, movimientos, ajustes toman el mismo bloqueo); esta task no reimplementa ni duplica esa concurrencia.
- **Regla N.° 10** — permisos granulares ya dados de alta en el seed (ver cabecera).
- **Regla N.° 11** — rutas en `src/server/pagos/*` y `src/app/api/cajas/**`, junto al resto del módulo I. Se agrega una sección «Aplicación HU-I-12» a `RULES.md` (0.4, punto 5) documentando el patrón `*.lecturas.ts`/`*.flujos.ts` como extensión de esta regla.

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

`src/server/pagos/caja.service.ts` (335 líneas, con `caja.service.pg.test.ts`) **ya implementa, desde el PR 0, el comportamiento completo** de §2.10 a §2.12, probado con PostgreSQL real:

- `cajaAbiertaDe(db, usuarioId)` — solo lectura, sin bloqueo; ya la usa `registrarOperacion` (HU-I-10) y `desactivarIntegrante` (HU-F-05).
- `abrirCaja(tx, { usuarioId, fondoInicial })` — exige ficha activa (`bloquearIntegranteActivo`), inserta con el índice único parcial (`409 CAJA_YA_ABIERTA` ante `P2002`, Regla N.° 7).
- `calcularResumen(db, cajaId)` — arma el `ResumenCaja` completo (fondo, cobros por forma con monto/forma vigentes sin anulados, ingresos/egresos manuales, ajustes, efectivo esperado sumando solo formas con `esEfectivo`, declarado, diferencia con signo, `tipo_diferencia`) y la **huella** SHA-256 (cantidad + último id de cobros, correcciones, anulaciones de pago, movimientos, anulaciones de movimiento y ajustes). Coincide exactamente con el criterio 6 del backlog y con la foto del prototipo (`Cerrar_caja___paso_2.png`).
- `declararEfectivo(tx, { cajaId, usuarioId, efectivoDeclarado, porAusencia? })` — paso 1 del cierre: guarda una sola vez (`updateMany ... WHERE efectivoDeclarado IS NULL`), devuelve resumen + huella; `409 EFECTIVO_YA_DECLARADO` si ya había uno.
- `cerrarCaja(tx, { cajaId, usuarioId, huella, motivo?, porAusencia? })` — paso 2: recalcula resumen y huella, `409 CAJA_CAMBIO` con `detalles: { resumen, huella }` si no coincide (sin cerrar), exige motivo si hay diferencia (`400 MOTIVO_DIFERENCIA_REQUERIDO`), cierra con `updateMany` condicionado al estado (Regla N.° 7). Coincide exactamente con la foto `Cierre_con_un_cobro_que_entró_mientras_tanto.png` (mismo declarado, esperado recalculado, motivo vuelto a pedir).
- `registrarMovimiento`/`anularMovimiento`/`registrarAjuste` también están implementados (los usa HU-I-12-b y HU-I-06 cuando exista), pero **no forman parte de esta task** — ver "Nota de alcance".
- `exigirAlcance`/`cajaBloqueada` son **privados** de `caja.service.ts` (verificado en el relevamiento de Claude Code): no se exportan ni se usan directo desde fuera; todo pasa por las funciones públicas de arriba.
- Todos los `code` de error de §2.10.5 ya están en `src/server/shared/errores-dominio.ts` y sus textos en `src/lib/textos.ts` (`errores.caja.*`, 16 claves verificadas). **No hace falta agregar ningún texto de error nuevo** para esta task.
- Los permisos `cajas:abrir`, `cajas:cerrar`, `cajas:leer`, `cajas:leer_todas`, `cajas:cerrar_ausencia` ya están en `prisma/seed.ts:959-964`. **No hace falta tocar el seed de permisos.**
- `cajaAbiertaDe` ya la consume `desactivarIntegrante` (HU-F-05, ya mergeada): la baja con caja abierta (criterio 10 del backlog) **ya funciona de punta a punta**; falta únicamente el enlace a "Cierres de caja" en `personal/[id]/estado-integrante-dialog.tsx` (0.3), porque esa pantalla no existe todavía.
- El mensaje "No se puede registrar un cobro hasta que abras una caja." (criterio 2) ya lo tira `CAJA_NO_ABIERTA` desde `registrarOperacion` (HU-I-10/PR 0). **Se dispara desde dos lugares de la UI**, no solo uno: el wizard de `/pagos/registrar` (`paso-confirmacion.tsx`/`registrar-pago-wizard.tsx`) y el atajo `turnos/[id]/registrar-pago-dialog.tsx` (la foto `Intento de cobro sin caja abierta.png` es justamente ese atajo) — hoy ninguno de los dos muestra el enlace "Abrir caja" porque `/caja` no existe (0.3).
- **Precedente de impresión, ya existe:** `comprobante-card.tsx` (HU-I-11) junto con una regla `@media print` en `globals.css` que se activa con el atributo `[data-comprobante]`. Esta task reutiliza el mismo mecanismo (misma regla de `globals.css`, ampliada para incluir también `[data-cierre-caja]`), no crea uno nuevo (corrige la suposición anterior de que no había precedente).
- `datosCentro()` en `parametros-vigentes.ts` ya existe y sirve para el encabezado de la impresión del cierre (nombre/dirección del centro), igual que lo usa el comprobante de HU-I-11.

### 0.2. Archivos nuevos a crear (ruta exacta)

**Backend:**
- `src/types/caja.types.ts` — formas de respuesta de la API que consume el frontend (Regla N.° 11).
- `src/server/pagos/caja.schema.ts` — `AbrirCajaSchema`, `DeclararEfectivoSchema`, `ConfirmarCierreSchema`, `ListarCajasQuerySchema`, `PaginaQuerySchema` (Zod, §2.10.1 y §2.11).
- `src/server/pagos/caja.lecturas.ts` — **seis** funciones (no dos; corregido tras el relevamiento), todas de solo lectura, sin mutar nada:
  - `obtenerCajaPropia(usuarioId)` — arqueo ciego: lista ítems sin totales.
  - `obtenerResumenCierre(cajaId, { usuarioId, porAusencia? })` — responde `409 EFECTIVO_NO_DECLARADO` si todavía no se declaró; sirve tanto para el paso 2 de la caja propia como para el cierre por ausencia.
  - `listarMisCierres(usuarioId, { pagina })`.
  - `listarCajasYCierres({ integranteId?, desde?, hasta?, pagina })` — vista del gerente, §2.12.
  - `obtenerDetalleCierre(cajaId, { usuarioId, esGerente })` — responde `403 FUERA_DE_ALCANCE` ante un cierre ajeno sin ser gerente, y `409 CAJA_NO_CERRADA` si la caja sigue abierta.
  - `listarIntegrantesConCaja()` — llena el filtro por integrante del listado del gerente (incluye integrantes inactivos que tengan algún cierre).
- `src/server/pagos/caja.flujos.ts` — envoltorios transaccionales (`transaccion()`, patrón de `registrarOperacionDePago`) que resuelven `cajaAbiertaDe` (o responden `CAJA_NO_ABIERTA`) y llaman a `caja.service.ts`: `abrirMiCaja`, `declararMiEfectivo`, `cerrarMiCaja` (caja propia) y `declararPorAusencia`, `cerrarPorAusencia` (gerente). `caja.service.ts` queda intacto (0.4, punto 1).
- Los 11 Route Handlers de §0.2.1 (abajo).

**Route Handlers (`src/app/api/cajas/...`):**
- `route.ts` — `POST` (abrir) y `GET` (listado del gerente).
- `mia/route.ts` — `GET` (la caja propia).
- `mia/declaracion/route.ts` — `POST` (paso 1 del cierre).
- `mia/resumen/route.ts` — `GET` (paso 2, ver resumen).
- `mia/cierre/route.ts` — `POST` (paso 2, confirmar).
- `mia/cierres/route.ts` y `mia/cierres/[id]/route.ts` — `GET` (mis cierres y su detalle).
- `[id]/route.ts` — `GET` (detalle de un cierre, gerente).
- `[id]/ausencia/declaracion/route.ts`, `[id]/ausencia/resumen/route.ts`, `[id]/ausencia/cierre/route.ts` — cierre por ausencia (gerente).

**Frontend — mesa de entrada (`src/app/(dashboard)/caja/`):**
- `page.tsx` — «Mi caja».
- `mi-caja.tsx` — cliente.
- `abrir-caja-dialog.tsx`.
- `item-caja-badge.tsx` — etiqueta por tipo de ítem.
- `cierres/[id]/page.tsx` — detalle de un cierre propio (ruta corregida, antes no estaba listada — ver 0.4, punto 2).

**Frontend — gerente (`src/app/(dashboard)/cajas/`):**
- `page.tsx` — «Cierres de caja».
- `listado-cajas.tsx` — cliente, con los filtros.
- `[id]/page.tsx` — detalle de un cierre ajeno.

**Componentes compartidos del módulo (`src/components/pagos/`, junto a `comprobante-card.tsx`; **no** en `shared`, porque son específicos del módulo I — corregido tras el relevamiento):**
- `cerrar-caja-dialog.tsx` — **un solo componente con dos modos** (propia / por ausencia): cambia la URL base y el título según el modo. Reemplaza la idea anterior de un `cierre-por-ausencia-dialog.tsx` aparte.
- `resumen-cierre-caja.tsx` — tabla del resumen (criterio 6), compartida entre el paso 2 del cierre propio, el cierre por ausencia y el detalle de un cierre ya hecho.
- `detalle-cierre-caja.tsx` — lo que se imprime, marcado con `data-cierre-caja` (0.1).
- `tabla-cierres-caja.tsx` — tabla de cierres (Apertura/Cierre/Fondo/Esperado/Declarado/Diferencia/Motivo), reusada por «Mis cierres» y por el listado del gerente.
- `diferencia-caja-badge.tsx` — `Badge` de "La caja cuadra"/"Sobrante"/"Faltante" (0.4, punto 4).

**Tests y evidencia:**
- `caja.schema.test.ts`, `caja.lecturas.test.ts`, `caja.lecturas.pg.test.ts`, `caja.flujos.pg.test.ts`.
- `src/app/api/cajas/route.test.ts` (y análogos) cubriendo las 11 rutas con el servicio simulado.
- Tests de los diálogos de abrir y cerrar caja, de `mi-caja` y del listado del gerente.
- `docs/testing/Modulo I/hu-i-12/HU-I-12.postman_collection.json`.
- `docs/testing/Modulo I/hu-i-12/HU-I-12-evidencia.md`, con el SQL de nivel 3.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

- `src/server/shared/rutas-por-rol.ts` (y su test) — agrega `caja: ["MESA_ENTRADA"]` (pantalla "Mi caja", incluye `/caja/cierres/[id]`) y `cajas: ["GERENTE"]` (listado del gerente, **solo** gerente — corregido: no `["MESA_ENTRADA","GERENTE"]`, ver 0.4 punto 2).
- `src/proxy.ts` — agrega `/caja/:path*` y `/cajas/:path*` al `matcher`.
- `src/components/layout/Sidebar.tsx` (y su test) — ítem «Mi caja» (MESA_ENTRADA) → `/caja`, y «Cierres de caja» (GERENTE) → `/cajas`.
- `src/lib/textos.ts` — agrega las claves nuevas bajo `ui.caja.*`, `ui.cajas.*` y `confirmaciones.caja.*` — **no** agrega claves de error (0.1).
- `src/app/globals.css` — la regla `@media print` existente pasa a valer también para `[data-cierre-caja]`, además de `[data-comprobante]` (0.1).
- `docs/DESIGN.md` §6.4 — agrega las filas de Abrir caja, Cerrar caja (dos pasos) y Cierre por ausencia (0.4, punto 3), completa la fila de HU-F-05 con el enlace a "Cierres de caja", y agrega en §6.5/6.6 los colores de los `Badge` de diferencia (0.4, punto 4).
- `docs/RULES.md` — sección corta «Aplicación HU-I-12» (0.4, punto 5).
- `src/app/(dashboard)/pagos/registrar/paso-confirmacion.tsx` (o donde hoy se muestra `CAJA_NO_ABIERTA`) y `src/app/(dashboard)/turnos/[id]/registrar-pago-dialog.tsx` — agregan el enlace "Abrir caja" → `/caja` al mensaje del criterio 2 (corregido: son **dos** lugares, no uno — 0.1).
- `src/components/shared/confirmar-accion-dialog.tsx` (HU-C-25, y su test) — agrega una prop opcional `accionError?: ReactNode`, retrocompatible, que se muestra debajo del mensaje de error del servidor (0.4, punto 3). Sin esto no hay forma de poner el botón "Abrir caja" dentro del propio diálogo de confirmación cuando el cobro falla por `CAJA_NO_ABIERTA`.
- `src/app/(dashboard)/personal/[id]/estado-integrante-dialog.tsx` (y su test) — agrega el enlace «Cierres de caja» → `/cajas` dentro del mensaje de `CAJA_ABIERTA` (HU-F-05, 0.1).

**No se toca en esta task** (explícito, ver sección 1): `registrarMovimiento`, `anularMovimiento`, `registrarAjuste` ni ninguna pantalla que los use — son HU-I-12-b. Tampoco se modifica `caja.service.ts`.

### 0.4. Resuelto así (relevamiento de Claude Code + OK del equipo)

Las cinco preguntas que quedaban abiertas (sección 0.4 original) y las que Claude Code sumó en su propio relevamiento ya tienen respuesta. **No se vuelve a preguntar nada de esto; se implementa directamente así:**

1. **Dónde viven las lecturas y los envoltorios.** `caja.lecturas.ts` (lecturas) y `caja.flujos.ts` (envoltorios transaccionales que resuelven `cajaAbiertaDe` y llaman al servicio) son archivos **nuevos**, separados de `caja.service.ts`, que **no se toca**. Mismo patrón que `inscripcion.lecturas.ts` de Módulo C, extendido con un `*.flujos.ts` paralelo para no mezclar lecturas puras con orquestación transaccional.
2. **Nombres de ruta.** `/caja` es la pantalla de mesa de entrada ("Mi caja", incluye `/caja/cierres/[id]` para el detalle propio). `/cajas` es la pantalla del gerente ("Cierres de caja", listado de todo el personal + `/cajas/[id]` para el detalle ajeno) y es **exclusiva de GERENTE** (no de MESA_ENTRADA también). La API HTTP queda toda bajo `/api/cajas/...` para ambos roles, tal como dice la spec — solo cambian las pantallas, no los endpoints.
3. **Feedback de abrir y cerrar caja: toast en los dos casos**, no banner (corrige la variante de banner que proponía la redacción original de esta sección). "Abrir caja" y "Cerrar caja" son acciones dentro de un modal que vuelve a la misma pantalla (`/caja`), que es exactamente el patrón 6.1 de `DESIGN.md` — no hace falta inventar una variante nueva de 6.2. Tras el toast se hace `router.refresh()` y `/caja` queda vacía, lista para abrir otra caja. El enlace "Abrir caja" dentro del error `CAJA_NO_ABIERTA` de `/pagos/registrar` y de `turnos/[id]/registrar-pago-dialog.tsx` se resuelve ampliando `ConfirmarAccionDialog` (HU-C-25) con una prop opcional `accionError?: ReactNode` (retrocompatible, con su test) — el enlace aparece debajo del error del servidor, igual que en el prototipo.
4. **Paginación y filtro del gerente.** Se reutiliza `Pagination` sin cambios, de a 10, también en «Mis cierres». El filtro por integrante es un `<select>` simple (no un buscador con debounce) con quienes tienen alguna caja — la lista sale de las cajas existentes más `obtenerNombresPersonal`, sin leer tablas del módulo F directo (Regla N.° 3), e incluye integrantes inactivos que tengan algún cierre (`listarIntegrantesConCaja`, 0.2). Colores del `Badge` de diferencia: "La caja cuadra" → `success`; "Faltante" → contorno `--destructive` (mismo patrón que "Cancelado" en §6.5); "Sobrante" → `warning`.
5. **Impresión.** CSS puro, reutilizando el mecanismo ya existente del comprobante de HU-I-11 (`[data-comprobante]`/`@media print` en `globals.css`, ampliado con `[data-cierre-caja]`) — sin ruta `/imprimir` aparte ni librerías nuevas. La fecha de impresión la arma el cliente.
6. **Confirmación cuando la caja cuadra sin diferencia.** El criterio 8 del backlog solo da el ejemplo con faltante; el texto completo por caso:
   - Faltante: *"¿Estás seguro de que querés cerrar tu caja con un faltante de {monto}?"*
   - Sobrante: *"¿Estás seguro de que querés cerrar tu caja con un sobrante de {monto}?"*
   - Cuadra: *"¿Estás seguro de que querés cerrar tu caja sin diferencia?"*
   - Por ausencia: mismas variantes, agregando "...la caja de {integrante}...".
   "Esta acción no se puede deshacer." la agrega sola `ConfirmarAccionDialog` (prop `irreversible`); no va escrita en la clave de texto.
7. **`RULES.md`.** Se agrega una sección corta «Aplicación HU-I-12», siguiendo el formato que ya usan las HU anteriores (documenta el patrón `*.lecturas.ts`/`*.flujos.ts` y que `caja.service.ts` no se toca).

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento — **OK ya dado**: Claude Code puede implementar de punta a punta sin volver a detenerse en nada de lo resuelto en 0.4. Solo debe pausar y preguntar ante una ambigüedad genuinamente nueva, no cubierta acá.

---

## 1. Nota de alcance

**Esta HU se parte en dos** (la propia HU-I-12 del backlog lo sugiere explícitamente por ser la más grande del sprint, 8 SP): esta task cubre **abrir la caja, consultarla en arqueo ciego, cerrarla en dos pasos y las consultas del gerente (incluido el cierre por ausencia)** — el criterio 3 del backlog (movimientos manuales) y la parte del criterio 4 que depende de ajustes quedan en **HU-I-12-b** (`docs/tasks/Sprint 3/Modulo I/HU-I-12-b.md`), que se arma y se mergea después, sobre la misma pantalla `/caja` que esta task deja lista. Esta decisión de partir la historia es del equipo (planning), no un hecho de la spec original.

Depende de:
- **HU-I-10** (cobros) y el PR 0: ya resueltos, la exigencia de caja abierta para cobrar (criterio 2) **ya funciona** desde el merge del PR 0 (0.1) — esta task no la reimplementa, solo le agrega la pantalla y los dos enlaces que le faltaban (`/pagos/registrar` y `turnos/[id]/registrar-pago-dialog.tsx`).
- **HU-C-25** (confirmaciones): ya mergeada, se reutiliza tal cual (ampliada con `accionError?`, 0.4 punto 3) para "Abrir caja" y "Cerrar caja" (irreversible, con el mensaje exacto del criterio 8).
- El servicio `caja.service.ts` del PR 0 (0.1): ya mergeado, esta task no lo modifica.

Es dependencia, a su vez, de:
- **HU-I-12-b** (movimientos manuales), que se construye sobre la pantalla `/caja` que esta task crea.
- **HU-F-05** (ya mergeada): deja de tener el enlace pendiente a "Cierres de caja" una vez que esta task mergea (0.3).
- **HU-C-24** (reservas por vencer) y el resto del circuito de pago: ya citan "Exige caja abierta (HU-I-12, criterio 2)" como precondición, que ya está resuelta desde el PR 0; esta task no les agrega nada nuevo a ellas.
- **HU-I-06** (corregir/anular pagos, todavía sin crear): su criterio 5 ("si la caja del pago está cerrada, el cambio lo hace el gerente... ajuste en una caja abierta") necesita que exista una pantalla de caja abierta para elegir destino — esta task la deja lista, pero **no implementa la UI de elegir una caja de ajuste**, porque `registrarAjuste` no tiene ningún llamador todavía (ver "Verificación diferida").

**Fuera de alcance de esta task (explícito):**
- Registrar o anular un movimiento manual (criterio 3 completo) — HU-I-12-b.
- Cualquier UI para elegir la "caja de ajuste" al corregir/anular un pago de una caja cerrada (criterio 4, segunda mitad) — depende de HU-I-06, que no existe; ver "Verificación diferida".
- El enlace "Ver comprobante"/impresión del comprobante de pago (HU-I-11) — no se toca, es otro documento (solo se reutiliza su mecanismo de impresión, 0.1).
- Cualquier cambio a `caja.service.ts`.

**Verificación diferida** (tal como marca la propia HU en el backlog):
- **Los ajustes por correcciones y anulaciones del criterio 4** (segunda mitad: "el gerente elige la caja abierta... se registra como ajuste") — cuando exista **HU-I-06**. El servicio `registrarAjuste` ya está implementado (0.1) y queda sin usar hasta entonces; esta task no agrega ninguna pantalla para invocarlo.
- La baja con caja abierta del criterio 10 — **ya no es una verificación diferida**: `HU-F-05` ya está mergeada y ya consume `cajaAbiertaDe` (0.1). Lo único pendiente de esa integración es el enlace a "Cierres de caja" en `estado-integrante-dialog.tsx`, que esta task agrega (0.3).

**Limitación conocida, encontrada durante la implementación (no bloqueante, documentada a propósito):** `declararEfectivo`/`cerrarCaja` (PR 0, `caja.service.ts`) no registran **quién** declaró el efectivo contado, solo quién cierra. Si el gerente inicia un cierre por ausencia (declara el efectivo, paso 1) y no llega a confirmar el paso 2, el integrante que vuelve puede terminar el cierre él mismo como un cierre normal — queda `porAusencia = false` y `cerradaPorUsuarioId` del integrante, sin ningún rastro de que el conteo lo hizo el gerente. Ningún criterio del backlog exige lo contrario, y corregirlo de raíz requiere una columna nueva (quién declaró, no solo quién cierra) y tocar `caja.service.ts`, fuera de alcance de esta task. Se deja para **HU-I-06** (que ya va a tocar `caja.service.ts` para los ajustes) o para un bug ticket aparte, a decidir en planning.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** abrir mi caja cuando empiezo a atender, consultarla mientras está abierta (sin ver totales) y cerrarla declarando el efectivo que tengo antes de ver cuánto debería haber
**Para** rendir cuentas de lo que cobré en mi turno de caja y detectar faltantes o sobrantes, y que el gerente pueda controlar cada cierre

**SP estimado:** 5 (de los 8 originales de HU-I-12, partida en la planning)

---

## 3. Alcance de esta task

Implementación **frontend + backend**, conforme a `spec_modulo_I.md` §2.10.1, §2.10.2, §2.10.5, §2.11 y §2.12 completas (sin los movimientos de §2.10.3/2.10.4). Incluye:

- Las seis lecturas nuevas de `caja.lecturas.ts` y los envoltorios de `caja.flujos.ts` (0.2).
- Schemas Zod de `caja.schema.ts`: `AbrirCajaSchema`, `DeclararEfectivoSchema`, `ConfirmarCierreSchema`, `ListarCajasQuerySchema`, `PaginaQuerySchema`.
- Los 11 Route Handlers de 0.2.
- Entradas nuevas en `rutas-por-rol.ts` y el `matcher` del proxy para `/caja` y `/cajas`.
- UI: «Mi caja» (`/caja`, mesa de entrada) con el listado en arqueo ciego, "Abrir caja" (modal + confirmación), "Cerrar caja" (dos pasos en un modal), «Mis cierres» con detalle en `/caja/cierres/[id]`; «Cierres de caja» (`/cajas`, gerente) con el listado paginado y filtrado, el detalle en `/cajas/[id]` con "Imprimir", y el cierre por ausencia.
- Ítem nuevo en el sidebar para ambos roles.
- Textos nuevos en `src/lib/textos.ts` (`ui.caja.*`, `ui.cajas.*`, `confirmaciones.caja.*`) y las filas nuevas en `DESIGN.md` §6.4/6.5/6.6.
- El enlace "Abrir caja" en los dos lugares donde hoy se muestra `CAJA_NO_ABIERTA` sin él (`/pagos/registrar` y `turnos/[id]/registrar-pago-dialog.tsx`), vía la prop nueva `accionError?` de `ConfirmarAccionDialog`.
- El enlace «Cierres de caja» en `estado-integrante-dialog.tsx` (HU-F-05).
- Sección «Aplicación HU-I-12» en `RULES.md`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo listado en la sección 1, más:
- `registrarMovimiento`, `anularMovimiento` y cualquier código de error nuevo en `errores-dominio.ts` (ya están todos, sección 0.1).
- Cualquier cambio al contrato de `POST /api/pagos` o `POST /api/pagos/operaciones` (HU-I-01/HU-I-10).

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/pagos/caja.schema.ts`

```typescript
const montoNoNegativoSchema = z.string().trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número igual o mayor a 0 con hasta 2 decimales");

export const AbrirCajaSchema = z.object({
  fondo_inicial: montoNoNegativoSchema,
}).strict();

export const DeclararEfectivoSchema = z.object({
  efectivo_declarado: montoNoNegativoSchema,
}).strict();

export const ConfirmarCierreSchema = z.object({
  huella: z.string().trim().min(1),
  motivo: z.string().trim().max(300, "El motivo no puede superar los 300 caracteres").optional(),
}).strict();

export const ListarCajasQuerySchema = z.object({
  integrante_id: z.string().cuid().optional(),
  desde: z.string().trim().optional(),   // fecha AAAA-MM-DD, valida contra fechaCalendarioValidaSchema compartido si ya existe
  hasta: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().default(1),
}).strict();

export const PaginaQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
}).strict();
```

Mensajes y formato exactos: ver `spec_modulo_I.md` §2.10.1 y §2.11; no reinventar redacción.

### 4.2. Lecturas y flujos nuevos

**Archivo:** `src/server/pagos/caja.lecturas.ts`

```typescript
/** Arqueo ciego (spec_modulo_I.md §2.10.2): NO usa calcularResumen (ese sí trae
 *  totales/esperado). Lista los ítems (cobros, movimientos, ajustes) del más
 *  nuevo al más viejo, con su monto individual y si está anulado, pero sin
 *  ningún total ni el efectivo esperado. */
export async function obtenerCajaPropia(usuarioId: string): Promise<{ caja: CajaPropia | null }> { /* ... */ }

/** Paso 2 del cierre (propio o por ausencia): responde 409 EFECTIVO_NO_DECLARADO
 *  si todavía no se declaró el efectivo contado. */
export async function obtenerResumenCierre(cajaId: string, params: { usuarioId: string; porAusencia?: boolean }) { /* ... */ }

export async function listarMisCierres(usuarioId: string, params: { pagina: number }) { /* ... */ }

/** Listado del gerente (spec_modulo_I.md §2.12, criterio 11): cajas abiertas
 *  completas con antigüedad (ahora() - abiertaEl en minutos) + cierres
 *  paginados de a 10, filtrados por integrante y rango de fecha de CIERRE
 *  (DEC-30, no de apertura). */
export async function listarCajasYCierres(filtros: { integranteId?: string; desde?: string; hasta?: string; pagina: number }) { /* ... */ }

/** Detalle de un cierre, propio o del gerente (spec_modulo_I.md §2.12):
 *  devuelve el `resumen` JSONB TAL COMO quedó al cerrar (nunca se recalcula,
 *  criterio 8), más los datos del centro para "Imprimir". 403 FUERA_DE_ALCANCE
 *  ante un cierre ajeno sin ser gerente; 409 CAJA_NO_CERRADA si sigue abierta. */
export async function obtenerDetalleCierre(cajaId: string, params: { usuarioId: string; esGerente: boolean }) { /* ... */ }

/** Filtro por integrante del listado del gerente: incluye inactivos con cierres. */
export async function listarIntegrantesConCaja() { /* ... */ }
```

**Archivo:** `src/server/pagos/caja.flujos.ts` — envoltorios con `transaccion()` que resuelven `cajaAbiertaDe` (o responden `CAJA_NO_ABIERTA`) y delegan en `caja.service.ts`: `abrirMiCaja`, `declararMiEfectivo`, `cerrarMiCaja`, `declararPorAusencia`, `cerrarPorAusencia`.

Ninguno de los dos archivos duplica reglas de negocio (Regla N.° 4): son lecturas puras y orquestación transaccional sobre `caja.service.ts`, con el mismo patrón de `INCLUDE_OPERACION_VIGENTE`/`vigenteDeOperacion` que ya usa `calcularResumen`.

### 4.3. Route Handlers

Los 11 archivos de 0.2. Permisos exactos por ruta (Regla N.° 10):

| Ruta | Método | Permiso |
|---|---|---|
| `/api/cajas` | `POST` | `cajas:abrir` |
| `/api/cajas` | `GET` | `cajas:leer_todas` |
| `/api/cajas/mia` | `GET` | `cajas:leer` |
| `/api/cajas/mia/declaracion` | `POST` | `cajas:cerrar` |
| `/api/cajas/mia/resumen` | `GET` | `cajas:cerrar` |
| `/api/cajas/mia/cierre` | `POST` | `cajas:cerrar` |
| `/api/cajas/mia/cierres` y `.../[id]` | `GET` | `cajas:leer` |
| `/api/cajas/[id]` | `GET` | `cajas:leer_todas` |
| `/api/cajas/[id]/ausencia/*` | `POST`/`GET` | `cajas:cerrar_ausencia` |

Patrón de error: mismo helper `respuestaDeError()` de `src/app/api/pagos/respuesta-error.ts` (ya existe, HU-I-10) — un `ErrorDeDominio` responde con su `status` y expone `error.datos` como `detalles` (necesario para `CAJA_CAMBIO`, que trae `{ resumen, huella }` nuevos). Validación Zod siempre antes del servicio (Regla N.° 6); respuesta siempre `{ data, error }` (Regla N.° 5).

### 4.4. Textos nuevos en `src/lib/textos.ts`

- `confirmaciones.caja.abrir`: `"¿Estás seguro de que querés abrir tu caja con un fondo inicial de {monto}?"`.
- `confirmaciones.caja.cerrar.faltante` / `.sobrante` / `.cuadra`: los tres textos literales de 0.4, punto 6.
- `confirmaciones.caja.cerrarAusencia.*`: mismas variantes para el Gerente, con el nombre del integrante.
- `ui.caja.sinCajaAbierta.titulo` / `.cuerpo`: estado vacío de `/caja` ("No tenés una caja abierta"), con el botón "Abrir caja".
- `ui.caja.item.cobro` / `.movimiento.ingreso` / `.movimiento.egreso` / `.ajuste`: etiquetas de cada tipo de fila en el arqueo ciego.
- `ui.caja.resumen.*`: etiquetas de la tabla del criterio 6 (Fondo inicial, Cobros por forma, Ingresos manuales, Egresos manuales, Efectivo esperado, Efectivo declarado, Diferencia).
- `ui.caja.diferencia.sobrante` / `.faltante` / `.cuadra`: `"Sobrante de {monto}"`, `"Faltante de {monto}"`, `"La caja cuadra"` (criterio 7, literal).
- `ui.cajas.gerente.*`: columnas y estados vacíos del listado del gerente.

---

## 5. Frontend

**`/caja` (mesa de entrada):**
- Sin caja abierta: estado vacío con "Abrir caja" → `Dialog` con el campo "Fondo inicial en efectivo ($)" (acepta 0) y `ConfirmarAccionDialog` (C-25) con el texto de `confirmaciones.caja.abrir`. Igual a la foto `Abrir_caja.png`.
- Con caja abierta: cabecera "Caja abierta · Desde el {fecha} · fondo inicial {monto}" (igual a `Caja_abierta_arqueo_ciego.png`) + leyenda "Arqueo ciego: mientras la caja está abierta no se muestran totales ni el esperado. Al cerrarla primero declararás el efectivo contado." + lista de ítems (`item-caja-badge.tsx` por tipo, sin ningún total al pie) + botón "Cerrar caja".
- **Cerrar caja** (`cerrar-caja-dialog.tsx`, un solo componente con dos pantallas internas y modo propia/ausencia, 0.4 punto 1):
  - Paso 1 de 2: "Contá el efectivo que hay en la caja y declaralo. Cuánto debería haber se muestra recién después de confirmar, y el monto declarado ya no se puede cambiar." + campo "Efectivo contado ($)" + "Confirmar efectivo contado" → `POST declaracion`.
  - Paso 2 de 2: `resumen-cierre-caja.tsx` + `diferencia-caja-badge.tsx` (criterio 7) + campo "Motivo de la diferencia" (obligatorio si no cuadra, opcional como "Observación" si cuadra) + `ConfirmarAccionDialog` (C-25, irreversible) con el texto de `confirmaciones.caja.cerrar.*` según corresponda (0.4 punto 6). Si el servidor rechaza con `CAJA_CAMBIO`: se reemplaza el resumen y la huella con los de `detalles`, se muestra "La caja cambió mientras cerrabas. Revisá el resumen." inline (mismo mecanismo que `MOTIVO_AJUSTE_REQUERIDO` en HU-I-10) y el diálogo sigue abierto con el mismo declarado. Igual a las fotos `Cerrar_caja___paso_1.png`, `Cerrar_caja___paso_2.png` y `Cierre_con_un_cobro_que_entró_mientras_tanto.png`.
  - Al confirmar: **toast** ("Caja cerrada · {texto de diferencia}", 0.4 punto 3) + `router.refresh()`; `/caja` vuelve al estado vacío, igual a `Caja_cerrada_y_mis_cierres.png`.
- Debajo del estado (abierto o vacío): «Mis cierres» (`tabla-cierres-caja.tsx`) con Apertura/Cierre/Fondo/Esperado/Declarado/Diferencia/Motivo, cada fila con «Ver cierre» → `/caja/cierres/[id]` (detalle con "Imprimir", marcado `data-cierre-caja`), igual a `Caja_abierta_arqueo_ciego.png`/`Caja_cerrada_y_mis_cierres.png`.

**`/cajas` (gerente, exclusivo de ese rol — 0.4 punto 2):**
- «Cajas abiertas»: tabla Integrante/Abierta desde/Antigüedad, sin ninguna acción de abrir/cerrar propia salvo «Cierre por ausencia» por fila.
- «Cierres»: `tabla-cierres-caja.tsx` + columna Integrante, con filtro por integrante (`<select>` simple de `listarIntegrantesConCaja`, 0.4 punto 4) y por rango de fechas, paginado de a 10 (`Pagination` compartido).
- Detalle de un cierre (`/cajas/[id]`): igual al de mesa de entrada + quién lo cerró y si fue por ausencia (`Caja_de_todo_el_personal.png`/`Detalle_de_un_cierre.png`).
- **Cierre por ausencia**: desde la fila de una caja abierta ajena, mismo `cerrar-caja-dialog.tsx` en modo ausencia (0.4 punto 1), aclarando en el título a nombre de qué integrante se cierra.

**En `/pagos/registrar` y `turnos/[id]/registrar-pago-dialog.tsx` (0.3):** el error `CAJA_NO_ABIERTA` usa la prop nueva `accionError?` de `ConfirmarAccionDialog` para mostrar el botón "Abrir caja" → `/caja` debajo del mensaje del servidor.

**En `personal/[id]/estado-integrante-dialog.tsx` (0.3):** el mensaje de `CAJA_ABIERTA` agrega el enlace «Cierres de caja» → `/cajas`.

Todos los colores y componentes siguen `docs/DESIGN.md`: tokens de shadcn/ui + Tailwind, nunca hex.

**Fuera de alcance de frontend:** cualquier botón para registrar o anular un movimiento (HU-I-12-b).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios

- `caja.schema.test.ts`: los cinco schemas — válidos e inválidos (monto negativo, con más de 2 decimales, motivo > 300, campo extra).
- `caja.lecturas.test.ts` / `caja.lecturas.pg.test.ts`: `obtenerCajaPropia` arma los ítems sin ningún campo de total (verificación explícita de que la respuesta no trae `efectivo_esperado` ni ningún subtotal mientras la caja está abierta); `listarCajasYCierres` pagina correctamente y filtra por integrante y rango de fecha de cierre; `obtenerDetalleCierre` rechaza un cierre ajeno sin ser gerente y una caja todavía abierta.
- `caja.flujos.pg.test.ts`: `abrirMiCaja`/`cerrarMiCaja`/etc. resuelven `cajaAbiertaDe` y delegan correctamente en `caja.service.ts` (no reimplementan nada).
- `caja.service.test.ts` **no se toca**: ya cubre `abrirCaja`, `calcularResumen`, `declararEfectivo`, `cerrarCaja` (PR 0). Si algún caso de esta task revela un gap, se reporta, no se arregla en silencio acá.
- `confirmar-accion-dialog.test.tsx`: cubre la prop nueva `accionError?` (0.3).
- Componentes: el `Dialog` de abrir caja valida fondo ≥ 0; el de cerrar caja no deja pasar al paso 2 sin declarar; el paso 2 muestra "Motivo" obligatorio solo cuando `tipo_diferencia !== "CUADRA"`; ante `CAJA_CAMBIO` reemplaza resumen/huella sin cerrar el diálogo.

### Nivel 2 — Postman

- `POST /api/cajas` con fondo 0 → `201`; segunda apertura del mismo usuario → `409 CAJA_YA_ABIERTA`.
- `GET /api/cajas/mia` con caja abierta → `200` sin ningún campo de total; sin caja → `{ "caja": null }`.
- `POST .../declaracion` dos veces → la segunda `409 EFECTIVO_YA_DECLARADO`.
- `GET .../resumen` antes de declarar → `409 EFECTIVO_NO_DECLARADO`.
- `POST .../cierre` con la huella vieja tras un cobro nuevo → `409 CAJA_CAMBIO` con `detalles.resumen`/`detalles.huella`; con la huella correcta y diferencia ≠ 0 sin motivo → `400 MOTIVO_DIFERENCIA_REQUERIDO`; con motivo → `200`.
- Gerente con `GET /api/cajas?integrante_id=...` → `200` paginado; mesa de entrada contra esa misma ruta → `403 SIN_PERMISO`.
- Cierre por ausencia sobre la propia caja → `403 FUERA_DE_ALCANCE` (según `exigirAlcance` de `caja.service.ts`, ya implementado).
- `GET /api/cajas/mia/cierres/[id]` sobre un cierre ajeno (mesa de entrada) → `403 FUERA_DE_ALCANCE`; sobre una caja todavía abierta → `409 CAJA_NO_CERRADA`.

### Nivel 3 — BD / TablePlus

- Tras abrir: una fila en `cajas` con `estado = 'ABIERTA'`, `efectivoDeclarado = NULL`.
- Tras declarar: `efectivoDeclarado` seteado, `estado` sigue `'ABIERTA'`.
- Tras cerrar: `estado = 'CERRADA'`, `efectivoEsperado`, `diferencia`, `resumen` (JSONB) y `cerradaPorUsuarioId`/`cerradaPorActorTipo` poblados; con ausencia, `porAusencia = true` y `cerradaPorUsuarioId` es el del Gerente.
- Concurrencia con PostgreSQL real: dos cierres simultáneos de la misma caja (uno gana, el otro `CAJA_YA_CERRADA`) — **ya probado** en `caja.service.pg.test.ts` (PR 0); esta task solo verifica que el endpoint lo expone igual, no repite la prueba de concurrencia desde cero.

**Evidencia esperada:** Postman + SQL; capturas de `/caja` (vacía, abierta, cerrar paso 1 y 2, caja cambió) y de `/cajas` (listado, detalle, impresión, cierre por ausencia), comparadas contra las fotos del prototipo en `C:\Users\agust\Desktop\Imagenes HU\HU-I-12`.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) revisado — todas las decisiones de 0.4 ya tienen OK, no hace falta reconfirmarlas.
- [ ] Las seis lecturas nuevas, los envoltorios de `caja.flujos.ts` y los cinco schemas Zod implementados.
- [ ] Los 11 Route Handlers responden `{ data, error }` con los status codes de §2.10.5, reutilizando `respuesta-error.ts` de HU-I-10.
- [ ] Ningún cambio a `caja.service.ts`; ningún código de error nuevo (ya existen todos).
- [ ] Entradas `caja` (`["MESA_ENTRADA"]`) y `cajas` (`["GERENTE"]`) agregadas a `rutas-por-rol.ts` y al `matcher` del proxy.
- [ ] Frontend: `/caja` (abrir, arqueo ciego, cerrar en dos pasos, mis cierres con detalle en `/caja/cierres/[id]`) y `/cajas` (listado del gerente, detalle en `/cajas/[id]`, imprimir, cierre por ausencia) funcionales.
- [ ] `ConfirmarAccionDialog` ampliado con `accionError?` (retrocompatible, con test) y el enlace "Abrir caja" agregado en `/pagos/registrar` **y** en `turnos/[id]/registrar-pago-dialog.tsx`.
- [ ] Enlace «Cierres de caja» agregado en `personal/[id]/estado-integrante-dialog.tsx` (HU-F-05).
- [ ] `globals.css` amplía la regla de impresión para `[data-cierre-caja]`.
- [ ] Textos nuevos agregados a `textos.ts` bajo `ui.caja.*`/`ui.cajas.*`/`confirmaciones.caja.*`, ninguno hardcodeado.
- [ ] Filas nuevas de HU-I-12 agregadas a `DESIGN.md` §6.4/6.5/6.6, y la fila de HU-F-05 completada.
- [ ] Sección «Aplicación HU-I-12» agregada a `RULES.md`.
- [ ] Ningún `DELETE` físico; ninguna mutación sobre una caja ya cerrada.
- [ ] Tests de los 3 niveles en verde, con evidencia.
- [ ] PR con diff acotado exclusivamente a esta task (sin movimientos manuales ni ajustes — eso es HU-I-12-b).
