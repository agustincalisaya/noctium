# TASK: HU-I-06 — Corregir o anular un pago registrado

**Módulo:** I (Pagos) · **Sprint:** 3 · **SP estimado:** 3.
**Contrato de referencia:** `docs/specs/spec_modulo_I.md` §2.14 completa (2.14.1 Alcance/`puedeCorregirPago`, 2.14.2 Corregir, 2.14.3 Anular, 2.14.4 Ajustes de caja, 2.14.5 Errores, 2.14.6 Historial de cambios/DEC-27, 2.14.7 Pruebas obligatorias) · también §2.6.1 (entidades `CorreccionPago`/`CorreccionOperacion`/`AnulacionPago`/`AjusteCaja`), §2.6.2 (valores vigentes), §2.6.3 (permiso `pagos:corregir`), §2.9.3/§2.9.4 (comprobante, marcas derivadas), §2.17 (servicios públicos del módulo) · reglas §3.6, §3.7, §3.9, §3.12, §3.15 · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-I-06, líneas 542-556) · `docs/tasks/Sprint 3/Modulo I/HU-I-02.md` (historial de pagos del alumno, ya mergeada — su `puede_corregir` queda listo para esta task) · `docs/tasks/Sprint 3/Modulo I/HU-I-10.md`/`HU-I-11.md` (registro y comprobante, ya mergeadas) · `docs/tasks/Sprint 3/Modulo I/HU-I-12.md` (caja, `registrarAjuste` sin llamador hasta esta task) · `docs/tasks/Sprint 3/Modulo C/HU-C-24.md` criterio 5 y `spec_modulo_C.md` §2.18 (reapertura de la reserva al anular el último pago) · HU-C-14 (reintegro, ya mergeada — "Pagos e importes quedan intactos", la anulación la hace esta HU) · `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11)
**RBAC:** `pagos:corregir` (MESA_ENTRADA y GERENTE) — **ya existe en el seed** (`prisma/seed.ts:951-952`), sin permisos nuevos que crear. Lecturas con `pagos:leer` (ya existente).
**Schema:** ya completo, sin migración. `CorreccionPago`, `CorreccionOperacion`, `AnulacionPago` y `AjusteCaja` ya migradas por el PR 0.

---

## 0. Relevamiento previo a implementación (Claude Code)

**Reglas no negociables de `docs/RULES.md` que esta task debe cumplir** (leer el archivo completo antes de implementar):
- **Regla N.° 1** — nada se borra; un pago anulado queda con la etiqueta "Anulado" y deja de sumar, nunca se elimina.
- **Regla N.° 2** — cada corrección/anulación es su propia traza (opción a: usuario y fecha en el registro nuevo); esta task no agrega ninguna tabla de eventos.
- **Regla N.° 3** — el ajuste de caja se registra por `registrarAjuste` (servicio público de Módulo I sobre su propia tabla `AjusteCaja`); la reapertura de la reserva se hace exclusivamente vía `recalcularEstadoPago` (fachada pública de Módulo C), nunca tocando `turno_alumno` directo desde Pagos.
- **Regla N.° 4** — **toda** la lógica de negocio ya vive en `correccion.service.ts` (PR 0, ver 0.1), que **no se modifica**: los envoltorios nuevos (`correccion.flujos.ts`) y los Route Handlers son delgados.
- **Regla N.° 5 / N.° 6** — los 3 endpoints nuevos responden `{ data, error }`, con Zod antes del servicio en los 2 `POST`.
- **Regla N.° 7** (concurrencia) — ya resuelta por el único `bloquear(tx, { clases, inscripciones, operaciones, cajas })` que hace `contextoDelPago` dentro de `correccion.service.ts`; esta task no la reimplementa ni duplica.
- **Regla N.° 8** (inmutabilidad) — el pago original nunca se actualiza: corregir/anular siempre crean un registro nuevo que lo referencia. Ya resuelto por el PR 0.
- **Regla N.° 10** — `pagos:corregir` ya está en el seed; esta task no agrega entradas de `rutas-por-rol.ts` ni del `matcher` del proxy porque **no crea ninguna pantalla nueva** (ver 0.4, punto 7).
- **Regla N.° 11** — archivos nuevos en `src/server/pagos/` (junto al resto del módulo, con el prefijo `correccion.*` que ya usa `correccion.service.ts`) y `src/app/api/pagos/[id]/**`; los tipos nuevos se **suman** a `src/types/pago.types.ts` existente, no se crea un `correccion.types.ts` aparte (un archivo de tipos por módulo, no por HU).

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

Este es el hallazgo central del relevamiento: **toda la lógica de negocio de HU-I-06 ya está implementada y probada** por el PR 0, bajo el nombre de esta misma HU en sus comentarios. Lo que falta es exclusivamente la capa HTTP, el historial de cambios de lectura y el frontend.

- **`src/server/pagos/correccion.service.ts` (228 líneas, con `correccion.service.pg.test.ts`, `correccion.alcance.test.ts`) ya implementa completo**, probado con PostgreSQL real:
  - `puedeCorregirPago(usuario, pago, momento?)` — el helper único de alcance (§2.14.1): Gerente siempre `true` sobre un pago no anulado; Mesa de entrada solo si `registradoEn` es de los últimos 30 días **y** `cajaAbierta`; cualquier otro rol, `false`.
  - `corregirPago(tx, { pagoId, monto, motivo, usuario, cajaAjusteId? })` — corrige el monto: `CorreccionPago`, `emitirReemplazo`, y si la caja del pago está cerrada, `registrarAjuste` por la diferencia. Rechaza `PAGO_ANULADO`, `FUERA_DE_ALCANCE`, `SIN_CAMBIOS`.
  - `corregirOperacion(tx, { pagoId, formaPagoId?, fechaPago?, motivo, usuario, cajaAjusteId? })` — corrige forma y/o fecha de la **operación** (alcanza a todos sus pagos no anulados): una `CorreccionOperacion` por campo que cambia, valida forma activa (`FORMA_PAGO_NO_DISPONIBLE`/`FORMA_PAGO_NO_ENCONTRADA`) y fecha no futura (`FECHA_PAGO_FUTURA`), `emitirReemplazo`, y si la caja está cerrada, el par de ajustes (`−total` en la forma anterior, `+total` en la nueva).
  - `anularPago(tx, { pagoId, motivo, usuario, cajaAjusteId? })` — crea `AnulacionPago` (único por pago, `P2002` → `PAGO_YA_ANULADO`), llama a `recalcularEstadoPago` (fachada pública de C, resuelve HU-C-24 criterio 5: reabre "Reservada" con plazo nuevo, deja "Pago sin registrar" o no crea reserva, según corresponda), reemplaza o deriva "ANULADO" en el comprobante (HU-I-11 ya resuelto, 0.1 de esa task), y si la caja está cerrada, `registrarAjuste` de `−monto` vigente.
  - `contextoDelPago(tx, pagoId, cajaAjusteId?)` (privada) hace el **único** `bloquear(tx, { clases, inscripciones, operaciones, cajas })` de las tres funciones (clase → inscripción → operación → caja del pago + caja de ajuste), releyendo todo bloqueado antes de revalidar alcance — exactamente el paso 2-3 de §2.14.2/§2.14.3. **No se reimplementa.**
  - El propio docstring del archivo ya dice: *"HU-I-06 puede llamar a `corregirPago` y `corregirOperacion` en la misma transacción: el segundo pedido de los mismos bloqueos no hace nada"* — confirma que el caso "cambian monto y forma/fecha a la vez" (§2.14.2 paso 5, dos registros y dos comprobantes de reemplazo encadenados) ya está contemplado por diseño.
- **`registrarAjuste(tx, { cajaId, pagoId, origen, ajustes, usuarioId })`** (`src/server/pagos/caja.service.ts:245-266`, PR 0 de HU-I-12) — ya implementa completo §2.14.4: bloquea la caja de ajuste, exige `ABIERTA` (si no, `CAJA_DE_AJUSTE_NO_ABIERTA`), ignora montos en cero, registra uno o dos `AjusteCaja` según `origen` (`correccionPagoId` | `correccionOperacionId` | `anulacionPagoId`). **Hoy no tiene ningún llamador**: HU-I-12 lo dejó implementado y sin usar a propósito, documentado explícitamente en su "Verificación diferida" ("cuando exista HU-I-06"). Esta task es su primer y único llamador (vía `correccion.service.ts`, que ya lo invoca).
- **Todos los códigos de error de §2.14.5 ya están en `src/server/shared/errores-dominio.ts`** (verificado línea por línea): `PAGO_NO_ENCONTRADO` (404), `PAGO_ANULADO`/`PAGO_YA_ANULADO`/`FORMA_PAGO_NO_DISPONIBLE`/`CAJA_DE_AJUSTE_NO_ABIERTA`/`TRANSACCION_OCUPADA` (409), `SIN_CAMBIOS`/`FECHA_PAGO_FUTURA` (400), `FUERA_DE_ALCANCE` (403), `FORMA_PAGO_NO_ENCONTRADA` (404). **No hace falta agregar ningún código ni texto de error nuevo.**
- **El permiso `pagos:corregir` ya está en el seed** (`prisma/seed.ts:951` MESA_ENTRADA, `:952` GERENTE). **No hace falta tocar el seed de permisos.**
- **Los bloques Zod reutilizables ya existen** en `src/server/pagos/pago.schema.ts`: `montoSchema`, `formaPagoIdSchema`, `motivoSchema`, y `fechaCalendarioValidaSchema` (`src/server/shared/fecha.schema.ts`) — `CorregirPagoSchema`/`AnularPagoSchema` los componen tal cual, sin reinventar validación.
- **`listarPagosDeClase(turnoId, db?)` (`src/server/pagos/pago.publico.ts:197`) ya trae su comentario literal: "Pagos de la clase con los anulados incluidos y los campos de HU-I-06 (spec_modulo_I.md §2.17)"** — el PR 0 ya la construyó pensando en esta HU. Devuelve `PagoDeClase[]` con `anulado`, `anulacion`, `comprobante_vigente`, `cambios`, `clases_de_la_operacion`, `inscripcion_id`, `operacion_id` — todo lo que pide el criterio 1 salvo `puede_corregir` (ver 0.4, punto 1). Hoy **nadie la usa**: el detalle de la clase sigue llamando a `listarPagosDeTurno` (ver 0.3).
- **`listarPagosDeAlumno` (HU-I-02) ya expone `caja_abierta` en lote para calcular `puedeCorregirPago`, sin enviarla nunca al cliente** (nota de `RULES.md`, sección "Aplicación HU-I-02"). `pago.service.ts:323` (`listarHistorialDePagos`) ya llama a `puedeCorregirPago(usuario, {...})` y expone `puede_corregir: boolean` en cada `PagoHistorialItem` (`src/types/pago.types.ts:142`). **La pestaña Pagos del alumno ya tiene el dato que esta task necesita para mostrar los botones** — solo falta pintarlos.
- **HU-I-02 dejó la decisión explícita, ya tomada**: *"no implementar botones funcionales de Corregir/Anular ni su historial de cambios, que pertenecen a I-06; preservar el response contractual y preparar la integración sin enlaces a rutas inexistentes"* (su 0.4, punto 7). Esta task es, literalmente, la que cierra ese pendiente.
- **`src/app/(dashboard)/alumnos/[id]/resultado-examen-acciones.tsx`** (HU-E-11, corrección/anulación de resultados de examen) **es el precedente de UI exacto**: botones "Corregir"/"Anular" en texto (solo si `puede_corregir && !anulado`), un `Dialog` de edición con los campos a cambiar + motivo obligatorio (contador `n/300`), que arma una `ConfirmarAccionDialog` (irreversible solo para anular) con el detalle del cambio, y etiquetas inline "Corregido"/"Anulado" con motivo y actor. Mismo patrón de permiso (`puede_corregir` ya resuelto por el servidor), mismo largo de motivo (300), mismo componente de confirmación. Esta task replica esa estructura para pagos, no la reinventa.
- **`ConfirmarAccionDialog` (`src/components/shared/confirmar-accion-dialog.tsx`, HU-C-25) ya tiene la prop `accionError?: ReactNode`** (agregada por HU-I-12): el rechazo del servidor se muestra inline sin cerrar el diálogo, con contenido a elección del llamador — es el mecanismo que esta task reutiliza para el selector de caja de ajuste ante `CAJA_DE_AJUSTE_NO_ABIERTA` (ver 0.4, punto 2).
- **`GET /api/cajas` (HU-I-12, `cajas:leer_todas`, exclusivo Gerente) ya devuelve `abiertas: CajaAbiertaFila[]`** (`{ id, integrante, abierta_el, antiguedad_minutos }`, `src/types/caja.types.ts:84-87`) — es, literalmente, el selector que pide §2.14.4 ("el selector sale de `abiertas` de `GET /api/cajas`"). No hace falta ningún endpoint de opciones nuevo.
- **`comprobante.lectura.ts` (HU-I-11) ya deriva "ANULADO"/"Reemplazado por" en el momento de leer**, nunca cacheado — su propia task dejó anotado: *"cuando se implemente [HU-I-06], cada corrección/anulación va a llamar a `emitirReemplazo`... y la vista de esta historia va a mostrar las marcas correctamente"*. **No se toca `comprobante.lectura.ts` ni `comprobante.service.ts`.**
- **`obtenerNombresPersonal(usuarioIds, db?)` (`src/server/personal/personal.publico.ts`) ya resuelve `{ usuario_id, nombre_completo }` en lote** — exactamente el shape que pide `registrado_por`/`usuario` en §2.14.6; se reutiliza para el historial de cambios, igual que ya lo usan HU-F-05/HU-G-05.
- **`INCLUDE_OPERACION_VIGENTE`/`vigenteDeOperacion` (`src/server/pagos/pago.vigente.ts`) ya cargan `operacion.correcciones` y `pago.correcciones`/`pago.anulacion`** completos desde Prisma (hoy solo se usan para contar `cambios` y derivar el valor vigente); esta task los reutiliza para construir la lista `cambios[]` del historial, sin una nueva consulta a tablas de corrección.
- `registrarOperacionDePago` (`pago.service.ts:194`) y la ruta `POST /api/pagos/operaciones` (HU-I-10) muestran el patrón exacto a replicar para el envoltorio transaccional: `transaccion(async (tx) => ...)` a nivel de `*.service.ts`/`*.flujos.ts`, nunca en el Route Handler.
- `respuestaDeError()` (`src/app/api/pagos/respuesta-error.ts`, HU-I-10) ya traduce cualquier `ErrorDeDominio` a `{ data: null, error: { code, message } }` con el status de su catálogo — se reutiliza tal cual en los 3 Route Handlers nuevos, sin mapeos adicionales (todos los códigos de 0.1 ya están registrados con su status).

### 0.2. Archivos nuevos a crear (ruta exacta)

**Backend:**
- `src/server/pagos/correccion.alcance.ts` — **extracción, no lógica nueva**: mueve `puedeCorregirPago` y el tipo `UsuarioOperador` fuera de `correccion.service.ts`, sin ninguna dependencia de otros módulos (ni `inscripcion.publico`, ni nada de Turnos). `correccion.service.ts` pasa a reexportarlos (`export { puedeCorregirPago, type UsuarioOperador } from "./correccion.alcance"`) para no romper a quien ya lo importa de ahí. Necesario porque `pago.publico.ts` **no puede** importar de `correccion.service.ts` (Regla N.° 3, ver 0.4 punto 1): `correccion.service.ts` importa `recalcularEstadoPago` de `@/server/turnos/inscripcion.publico`, y `publico.aislamiento.test.ts` tiene una lista cerrada de imports permitidos por archivo público que no incluye ni a `correccion.service.ts` ni a `inscripcion.publico` dentro de la de `pago.publico.ts`. Confirmado leyendo el test: la lista de `pago.publico.ts` hoy es `["@prisma/client", "@/lib/prisma", "@/server/alumnos/alumno.publico", "@/server/pagos/comprobante.lectura", "@/server/pagos/pago.vigente"]`.
- `src/server/pagos/correccion.schema.ts` — `CorregirPagoSchema` (`monto?`, `forma_pago_id?`, `fecha_pago?`, `motivo` obligatorio, `caja_ajuste_id?`, `.strict().refine(...)` que exige al menos uno de los tres campos de cambio, igual al bloque ya redactado en `spec_modulo_I.md` §2.14.2) y `AnularPagoSchema` (`motivo` obligatorio, `caja_ajuste_id?`, `.strict()`, §2.14.3).
- `src/server/pagos/correccion.flujos.ts` — envoltorios transaccionales (patrón `*.flujos.ts` de HU-I-12/`*.lecturas.ts` de HU-C-26), **sin reglas propias**:
  - `corregirPagoFlujo(pagoId, input: CorregirPagoInput, usuario): Promise<PagoCorregidoDto>` — abre `transaccion()`, llama a `corregirPago` si `monto` vino y/o `corregirOperacion` si `forma_pago_id`/`fecha_pago` vinieron (en la misma transacción, orden del paso 5 de §2.14.2: primero monto, después forma/fecha), arma la respuesta `200` de §2.14.2 (incluye `clases_abarcadas` del resultado de `corregirOperacion`, o el conteo de pagos no anulados de la operación si solo cambió el monto).
  - `anularPagoFlujo(pagoId, input: AnularPagoInput, usuario): Promise<PagoAnuladoDto>` — abre `transaccion()`, llama a `anularPago`, arma la respuesta `200` de §2.14.3.
- `src/server/pagos/correccion.lecturas.ts` — **una sola función nueva**, de solo lectura (patrón `*.lecturas.ts`):
  - `obtenerHistorialDePago(pagoId): Promise<HistorialPagoDto>` (DEC-27, §2.14.6) — lee la operación del pago con `INCLUDE_OPERACION_VIGENTE` (reutilizado de `pago.vigente.ts`), arma `registro` (monto/forma/fecha vigentes, `registrado_por`, `registrado_en`) y `cambios[]` mezclando `pago.correcciones` (`CORRECCION_MONTO`) + `operacion.correcciones` que tocaron ese pago (`CORRECCION_FORMA`/`CORRECCION_FECHA`, las de la operación alcanzan a **todos** sus pagos) + `pago.anulacion` (`ANULACION`), orden más nuevo primero, usuarios resueltos en lote con `obtenerNombresPersonal`. `404 PAGO_NO_ENCONTRADO` si no existe.
- Route Handlers (`src/app/api/pagos/[id]/...`, junto a `comprobante/route.ts` existente):
  - `correccion/route.ts` — `POST`, `withPermission("pagos:corregir")` → valida `CorregirPagoSchema` → `corregirPagoFlujo()`.
  - `anulacion/route.ts` — `POST`, `withPermission("pagos:corregir")` → valida `AnularPagoSchema` → `anularPagoFlujo()`.
  - `historial/route.ts` — `GET`, `withPermission("pagos:leer")` → `obtenerHistorialDePago()`.

**Frontend (`src/components/pagos/`, junto a `comprobante-card.tsx` — específicos del módulo I, no en `shared`, mismo criterio que HU-I-12):**
- `pago-acciones.tsx` — client component **compartido** entre el detalle de la clase y la pestaña Pagos del alumno (ver 0.4, punto 6): botones "Corregir"/"Anular"/"Ver detalle" según `puede_corregir`/`anulado`, `Dialog` de edición (Monto, Forma de pago, Fecha, Motivo) para Corregir, `Dialog` simple (Motivo) para Anular, y `ConfirmarAccionDialog` para ambos — mismo esqueleto que `resultado-examen-acciones.tsx`.
- `selector-caja-ajuste.tsx` — `<select>` controlado que puebla `abiertas` de `GET /api/cajas` (Gerente únicamente); vive dentro del `accionError` de la confirmación cuando el servidor rechaza con `CAJA_DE_AJUSTE_NO_ABIERTA` (0.4, punto 2).
- `historial-cambios-dialog.tsx` — modal de solo lectura (DEC-27): tabla con tipo de cambio, valor anterior → nuevo, motivo, usuario y fecha, más el registro original arriba.

**Archivos de apoyo:**
- Ninguno nuevo en `src/lib/`: se reutilizan `fechaCorta`/`monto` de `src/lib/turno-detalle.ts` (ya usados por `turno-pago-card.tsx`) y `formatearDineroHistorial` de `src/lib/pagos-historial-listado.ts` (ya usado por `tabla-historial-pagos.tsx`), cada uno en su contexto — sin crear un tercer helper de formato (0.4, punto 8).

**Tests y evidencia:**
- `correccion.alcance.test.ts` ya existe (de `correccion.service.ts`) — se le suma el caso de que `correccion.service.ts` siga reexportando lo mismo tras el movimiento (test de regresión del reexport, no de la lógica).
- `correccion.schema.test.ts`, `correccion.flujos.test.ts` (mocks) + `correccion.flujos.pg.test.ts` (PostgreSQL real), `correccion.lecturas.test.ts` + `correccion.lecturas.pg.test.ts`.
- `src/app/api/pagos/[id]/correccion/route.test.ts`, `anulacion/route.test.ts`, `historial/route.test.ts`.
- `pago-acciones.test.tsx`, `historial-cambios-dialog.test.tsx`, `selector-caja-ajuste.test.tsx`.
- `docs/testing/Modulo I/hu-i-06/HU-I-06.postman_collection.json`.
- `docs/testing/Modulo I/hu-i-06/HU-I-06-evidencia.md`, con el SQL de nivel 3.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

- `src/server/pagos/pago.publico.ts` — `pagosDeClase()`/`listarPagosDeClase()` (líneas 164-199) suman un parámetro opcional `usuario?: UsuarioOperador` que, si vino, calcula `puede_corregir: boolean` por ítem con `puedeCorregirPago` **importado de `correccion.alcance.ts`** (nunca de `correccion.service.ts` — ver 0.2), usando el `caja_abierta` que `pagosDeOperaciones` ya calcula internamente y hoy descarta al mapear (**nunca se envía `caja_abierta` al cliente**, mismo criterio que HU-I-02). `PagoDeClase` (tipo) suma `puede_corregir: boolean` y `forma_pago.is_active: boolean` (ya calculado por `pagosDeOperaciones`, hoy descartado al mapear — necesario para la etiqueta "Inactiva" del criterio 2). **Se elimina `listarPagosDeTurno()` y el tipo `PagoDeTurno`** (líneas 34-47 y 201-218): verificado que hoy lo usa únicamente `turno.detalle.ts`, pero también lo mencionan `spec_modulo_I.md` (§2.3, §2.17 y una nota de prueba que compara los cuatro) y `spec_modulo_C.md` (línea 319) — hay que actualizar esas menciones, no solo el código (0.3, última fila).
- `src/server/publico.aislamiento.test.ts` — suma `@/server/pagos/correccion.alcance` a la lista `permitidos` de `server/pagos/pago.publico.ts` (línea ~58-61).
- `src/server/turnos/turno.detalle.ts` — línea 3 cambia el import a `listarPagosDeClase`; línea 46 cambia la llamada a `listarPagosDeClase(turno.id, usuario.rol !== "PROFESOR" ? usuario : undefined)` (el `usuario` del parámetro de la función ya está disponible ahí, sin pasarlo más abajo de lo necesario).
- `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx` — **es client component** (`"use client"`, hace su propio fetch con `cargar()`), no Server Component: `router.refresh()` no recarga nada acá. `<TurnoPagoCard>` (línea ~69-76, junto al resto de los `onCambio`) recibe `onCambio={() => cargar(true)}`, que `turno-pago-card.tsx` reenvía a `<PagoAcciones onActualizado={...}>` (0.4, punto 6 corregido). Además, línea 59, `cantidadPagos={turnoActual.pagos?.length}` pasa a `cantidadPagos={turnoActual.pagos?.filter((p) => !p.anulado).length}` — si no, el aviso de `CancelarTurnoDialog` (HU-C-05) cuenta pagos anulados.
- `src/types/turno.types.ts` — `PagoRegistradoTurno` (líneas 62-73) suma `anulado: boolean`, `anulacion: { fecha: string; motivo: string } | null`, `puede_corregir: boolean`, `cambios: number`, `operacion_id: string`, `clases_de_la_operacion: number`, `forma_pago.is_active: boolean` (extensión aditiva, mismos campos que `PagoDeClase`; se elimina `PagoDeTurno` como fuente porque ya no existe).
- `src/app/(dashboard)/turnos/[id]/turno-pago-card.tsx` — pasa a recibir `onCambio: () => void` como prop (ver fila de `turno-detalle.tsx` arriba); el total (líneas 14-18) excluye `pago.anulado` de la suma; cada ítem de la lista (líneas 29-43) muestra "Anulado" (monto tachado) cuando corresponde y agrega `<PagoAcciones pago={pago} contexto="clase" onActualizado={onCambio} />` debajo de cada fila.
- `src/app/(dashboard)/alumnos/[id]/tabla-historial-pagos.tsx` — agrega una columna "Acciones" a `columnasHistorial` (tras "Comprobante") y una celda por fila con `<PagoAcciones pago={pago} contexto="historial" onActualizado={onActualizado} />`; recibe `onActualizado` como prop nueva.
- `src/app/(dashboard)/alumnos/[id]/historial-pagos.tsx` — pasa `onActualizado={() => { iniciarCarga(); setIntento((n) => n + 1); }}` a `TablaHistorialPagos` (mismo mecanismo que ya usan los reintentos de error).
- `src/lib/textos.ts` — agrega las claves nuevas bajo `ui.pagos.correccion.*` y `confirmaciones.pagos.corregir`/`.anular` (sección 4.4) — **no** agrega claves de error (0.1).
- `docs/RULES.md` — sección corta «Aplicación HU-I-06», documentando el patrón `correccion.flujos.ts`/`correccion.lecturas.ts` y que `correccion.service.ts`/`caja.service.ts` no se tocan.
- `docs/DESIGN.md` §6.4 — tres filas nuevas: "Corregir/anular un pago", "Caja de ajuste (Gerente, pago de caja cerrada)" y "Ver detalle del pago (historial de cambios)" (0.4, punto 5).
- `docs/specs/spec_modulo_I.md` §2.17 — nota aditiva de sincronización: `listarPagosDeClase` gana el parámetro `usuario?`/campo `puede_corregir`, `listarPagosDeTurno`/`PagoDeTurno` se eliminan (si la spec los menciona explícitamente; si no, no hace falta tocarla — verificar en Fase 1).

**No se toca en esta task** (explícito, ver sección 1): `correccion.service.ts`, `caja.service.ts`, `comprobante.service.ts`, `comprobante.lectura.ts`, `pago.vigente.ts`, `inscripcion.service.ts`/`recalcularEstadoPago` — todos ya implementan exactamente lo que esta HU necesita.

### 0.4. Puntos relevados — **resueltos tras la Fase 1 de Claude Code (13/10/2026)**

Ronda de relevamiento ya hecha: Claude Code leyó el código real contra lo que este doc asumía y encontró 9 contradicciones, todas verificadas acá de nuevo contra `develop` antes de dar el OK. Quedan así:

1. **`puede_corregir` se calcula dentro de `pago.publico.ts`, pero `puedeCorregirPago` se importa de `correccion.alcance.ts`, no de `correccion.service.ts`.** Contradicción real: `correccion.service.ts` importa `@/server/turnos/inscripcion.publico`, que no está en la lista `permitidos` de `pago.publico.ts` en `publico.aislamiento.test.ts` (ni `correccion.service.ts` tampoco lo está) — importarlo directo rompe la Regla N.° 3 y el test de aislamiento. **Resuelto:** extraer `puedeCorregirPago`/`UsuarioOperador` a `correccion.alcance.ts` (sin dependencias de otros módulos), `correccion.service.ts` los reexporta, `pago.publico.ts` importa del archivo nuevo, y se agrega esa ruta a la lista `permitidos` del test (0.2/0.3).
2. **Caja de ajuste: selector reactivo, no proactivo.** Sin cambios respecto a la propuesta original: ante `409 CAJA_DE_AJUSTE_NO_ABIERTA`, la `ConfirmarAccionDialog` muestra inline (vía `accionError`) el `<SelectorCajaAjuste>` poblado con `GET /api/cajas` (`abiertas`) y "Reintentar con esta caja".
3. **"Ver detalle" visible siempre que `pagos:leer` alcance la fila.** Sin cambios respecto a la propuesta original.
4. **Un solo diálogo "Corregir"** (Monto + Fecha en una fila, Forma de pago debajo, Motivo con contador `0/300`, botones "Cancelar"/"Guardar corrección"), subtítulo "{Alumno} · {Materia} del {fecha corta}". Confirma el prototipo. Tras "Guardar corrección" sigue la `ConfirmarAccionDialog` reversible con el detalle anterior → nuevo, como en `resultado-examen-acciones.tsx`.
5. **Anular NO es de dos pasos: un solo `ConfirmarAccionDialog` irreversible con el motivo adentro** (`contenido`), igual al patrón ya usado en HU-F-05. Texto literal de la imagen del prototipo: título `"¿Estás seguro de que querés anular el pago de {monto} de {alumno} ({materia} del {día abreviado} {fecha})?"`, cuerpo `"El pago no se borra, pero queda marcado como anulado y deja de contar en los totales."`, campo Motivo con contador y el enlace `"Usar el motivo «Reintegro»"` (precarga el campo, editable — nota del criterio 6), botón de confirmar en rojo (variante destructiva). Para Corregir: `"¿Estás seguro de que querés corregir este pago?"` + detalle del cambio, reversible (no destructiva). Aviso de alcance, dentro del diálogo de Corregir cuando cambia forma o fecha: `"Este cambio alcanza a {clases_abarcadas} clases de esta operación."` (singular sin plural), calculado en el cliente como `clases_de_la_operacion` apenas cambia el campo, antes de confirmar — no hay que esperar la respuesta del servidor.
6. **`PagoAcciones` compartido, con dos ajustes sobre la propuesta original:**
   - `onActualizado` es **obligatorio** (no opcional, sin fallback a `router.refresh()`): `turno-detalle.tsx` es client component con fetch propio, `router.refresh()` no recargaría nada ahí (contradicción real, ver 0.3). El padre siempre pasa su propia función de recarga (`cargar(true)` en el detalle de la clase, el mecanismo de `intento`/`setIntento` en la ficha del alumno).
   - Suma las props `alumnoNombre: string` y `claseEtiqueta: string` para armar los títulos de los diálogos; en la ficha del alumno bajan `page.tsx` → `HistorialPagos` → `TablaHistorialPagos` → `PagoAcciones`.
7. **Sin pantalla nueva.** Sin cambios.
8. **Formato de montos: `PagoAcciones` usa `monto()` de `turno-detalle.ts` en los dos contextos** (da `"$ 12.000"`, igual al prototipo); las tablas siguen con sus formateadores actuales para el resto de sus columnas.
9. **Eliminar `listarPagosDeTurno`/`PagoDeTurno`, migrando sus tests a `listarPagosDeClase`.** Confirmado, con el agregado de que hay que actualizar las menciones en `spec_modulo_I.md` (§2.3, §2.17, nota de prueba) y `spec_modulo_C.md` (línea 319), no solo el código (0.3).

**Además, dos correcciones de contrato que no eran puntos de diseño sino errores del borrador original de este doc** (detectadas en la misma Fase 1, ver §4.2 y §4.3 actualizados):
- `fecha_pago` llega al flujo ya como `Date` (lo transforma `fechaCalendarioValidaSchema`), no como string — el snippet de §4.2 que hacía `new Date(`${input.fecha_pago}T00:00…`)` estaba mal.
- El historial de cambios (§4.3/§2.14.6) muestra, por cada evento, el **valor original y el nuevo de esa corrección puntual** (como el ejemplo de la spec: `24000 → 20000`), no "el valor vigente" recalculado — eso es lo que ya hace `vigenteDeOperacion` para pantallas, pero el historial es un registro de eventos discretos.

**Confirmado además (no estaba en duda, pero Claude Code lo validó):** las formas de pago activas del diálogo de Corregir salen de `GET /api/formas-pago/opciones` (`formas_pago:leer`, lo tienen Mesa de entrada y Gerente), **no** de `GET /api/pagos/opciones` (`pagos:crear`, que el Gerente no tiene — le daría 403).

No quedan puntos abiertos. Procede la implementación completa (Fase 2).

---

## 1. Nota de alcance

A diferencia de la mayoría de las HU de Pagos del sprint, **HU-I-06 no tiene prácticamente ningún backend de negocio por escribir**: el PR 0 ya implementó y probó con PostgreSQL real `corregirPago`, `corregirOperacion`, `anularPago`, `puedeCorregirPago` y `registrarAjuste`, los dejó documentados explícitamente como "de esta HU" en sus propios comentarios, y HU-I-02/HU-I-11 ya dejaron sus respectivos extremos preparados (`puede_corregir` expuesto, marcas de comprobante derivadas en vivo) sin conectar los botones. Esta task es, en los hechos:
1. Una capa HTTP delgada (2 `POST` + 1 `GET`) sobre servicios que ya existen.
2. Una lectura nueva, pequeña y de solo compaginar datos ya cargados (`correccion.lecturas.ts`), para el historial de cambios del criterio 3.
3. Conectar el campo `puede_corregir` que HU-I-02 ya expone, y extender a `listarPagosDeClase` el mismo campo para el detalle de la clase.
4. El frontend: dos puntos de entrada ("Pagos registrados" de la clase y el historial del alumno) con un componente de acciones compartido, más el modal de solo lectura del historial de cambios.

**Fuera de alcance de esta task (explícito):**
- Cualquier cambio a `correccion.service.ts`, `caja.service.ts` (`registrarAjuste`/`declararEfectivo`/`cerrarCaja`), `comprobante.service.ts`/`comprobante.lectura.ts`, `pago.vigente.ts` o `inscripcion.service.ts`/`recalcularEstadoPago` — todos ya resuelven exactamente lo que el backlog pide.
- "Mis pagos" del alumno (HU-I-05) — ya se anotó en su propia HU que mostrará las mismas marcas una vez que exista esta task, sin que esta la toque.
- La reasignación de un pago a otro alumno (criterio 2, segunda oración) — no es una operación nueva: es anular con HU-I-06 y volver a registrar con HU-I-10, ya existente. No hay ningún botón "Reasignar".
- La verificación de la forma de pago inactiva (criterio 2, última viñeta) — **ya no está diferida**: HU-I-07 está mergeada (`RULES.md`, "Aplicación HU-I-07"), así que esta task la implementa de punta a punta, sin dejar nada pendiente.
- La regla de cajas cerradas (criterio 5) — **ya no está diferida**: HU-I-12 está mergeada y `registrarAjuste` ya existe; esta task es, justamente, quien la conecta.
- Cualquier UI de movimientos manuales de caja (`registrarMovimiento`/`anularMovimiento`, HU-I-12-b) — no la toca ni la necesita.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada o gerente
**Necesito** corregir el monto, la forma de pago o la fecha de un pago, o anularlo si se cargó por error
**Para** que los pagos y el historial de pagos del alumno no muestren datos equivocados

**SP estimado:** 3

### Criterios de aceptación — backlog literal (`docs/tasks/Sprint 3/HU-Sprint-3.md`, líneas 542-556)

1. En el detalle de la clase (lista "Pagos registrados") y en el historial de pagos del alumno (HU-I-02), cada pago tiene las acciones "Corregir" y "Anular".
2. Corregir abre un formulario precargado con los campos y validaciones del registro de pago (HU-I-01/HU-I-10) y permite cambiar Monto, Forma de pago (solo activas) y Fecha, con las mismas validaciones. Si el pago se cargó a otro alumno, se anula y mesa de entrada lo registra de nuevo con HU-I-10 (el gerente puede anular pero no registra pagos; decisión del PO, 04/10/2026).
   - Cada pago de una operación se corrige o anula por separado. El total de la operación se calcula siempre con los montos vigentes de sus pagos; no se guarda. La fecha y la forma de pago son de la operación: cambiarlas desde un pago registra una corrección de la operación (registro nuevo que la referencia), que se aplica a todos sus pagos, y se informa cuántas clases abarca. Cada corrección o anulación bloquea la operación y la inscripción del pago dentro de la misma transacción (Regla N.° 7).
   - Si la forma de pago de la operación está inactiva (HU-I-07), se muestra con la etiqueta "Inactiva" y se conserva mientras no se cambie; al cambiarla solo se ofrecen las activas.
3. Toda corrección o anulación exige un motivo obligatorio (hasta 300 caracteres) y queda registrada con el valor anterior, el nuevo, el usuario y la fecha; el detalle del pago muestra ese historial de cambios. La corrección y la anulación no modifican el registro original: se guardan como un registro nuevo que lo referencia (Regla N.° 8 de RULES.md); las pantallas, los totales y los indicadores usan el valor vigente.
4. Un pago anulado no se borra: se muestra con la etiqueta "Anulado" y deja de sumar en los totales. Qué pasa con la inscripción (vuelve a "Reservada", queda "Pago sin registrar" o no reaparece ninguna reserva) lo define HU-C-24, criterio 5.
5. El gerente puede corregir o anular cualquier pago; mesa de entrada, solo los registrados en los últimos 30 días, contados desde la fecha en que se registraron (no la fecha de pago), y solo mientras la caja donde quedó el pago siga abierta. Si esa caja está cerrada, el cambio lo hace el gerente y el dinero que se mueve se registra como ajuste en una caja abierta (HU-I-12, criterio 4). El servidor rechaza con 403 los intentos fuera de alcance.
6. Un reintegro hecho en el centro (por ejemplo, cuando el alumno cancela una clase pagada, HU-C-14) se registra anulando el pago de esa clase con el motivo "Reintegro"; el resto de los pagos de la operación no cambia y el comprobante se reemplaza según HU-I-11, criterio 5.
7. Se informa "Pago corregido correctamente" o "Pago anulado".

**Nota del backlog sobre el criterio 6:** el motivo "Reintegro" "carga la interfaz" y "el servidor no trata de forma especial" (`spec_modulo_I.md` §2.14.3, P-I8) — es decir, no hay un tipo de anulación distinto ni un código de error propio para reintegros; la interfaz solo ofrece una forma rápida de precargar ese texto exacto en el campo Motivo (botón "Fue un reintegro", editable antes de confirmar), y el servidor lo trata como cualquier otro motivo de anulación.

**Secuencia y diferidas:** ninguna pendiente — HU-I-01, HU-I-02, HU-I-10, HU-I-11, HU-I-07, HU-I-12 y HU-C-24 ya están mergeadas, y las dos verificaciones que el propio backlog marcaba como diferidas (forma de pago inactiva, caja cerrada) dejaron de estarlo apenas HU-I-07 y HU-I-12 mergearon.

---

## 3. Alcance de esta task

Implementación **frontend + backend**, conforme a `spec_modulo_I.md` §2.14 completa. Incluye:

- `CorregirPagoSchema`/`AnularPagoSchema` en `correccion.schema.ts`.
- `corregirPagoFlujo()`/`anularPagoFlujo()` en `correccion.flujos.ts`, sobre `correccion.service.ts` (sin tocarlo).
- `obtenerHistorialDePago()` en `correccion.lecturas.ts`.
- Los 3 Route Handlers de 0.2 (`POST .../correccion`, `POST .../anulacion`, `GET .../historial`).
- La extensión de `listarPagosDeClase`/`PagoDeClase` con `puede_corregir` y la eliminación de `listarPagosDeTurno`/`PagoDeTurno` (0.3, 0.4 punto 1 y 9).
- UI: botones "Corregir"/"Anular"/"Ver detalle" en "Pagos registrados" (detalle de la clase) y en el historial de pagos del alumno (HU-I-02), con el componente compartido `PagoAcciones`; el selector de caja de ajuste para el Gerente; el modal de historial de cambios.
- Etiqueta "Anulado" (tachado, excluido del total) en ambas listas.
- Textos nuevos en `src/lib/textos.ts` (`ui.pagos.correccion.*`, `confirmaciones.pagos.corregir`/`.anular`) y las filas nuevas en `DESIGN.md` §6.4.
- Sección «Aplicación HU-I-06» en `RULES.md`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo listado en la sección 1, más:
- Cualquier código de error nuevo en `errores-dominio.ts` (ya están todos, sección 0.1).
- Cualquier cambio al contrato de `POST /api/pagos/operaciones`, `GET /api/pagos/historial(/opciones)` o `GET /api/pagos/[id]/comprobante` (ya existentes).
- Cualquier pantalla, ruta o entrada de Sidebar nueva (0.4, punto 7).

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/pagos/correccion.schema.ts`

```typescript
import { z } from "zod";
import { montoSchema, formaPagoIdSchema, motivoSchema } from "@/server/pagos/pago.schema";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";

export const CorregirPagoSchema = z.object({
  monto: montoSchema.optional(),
  forma_pago_id: formaPagoIdSchema.optional(),
  fecha_pago: fechaCalendarioValidaSchema.optional(),
  motivo: motivoSchema,
  caja_ajuste_id: z.string().cuid().optional(),
}).strict().refine(
  (c) => c.monto !== undefined || c.forma_pago_id !== undefined || c.fecha_pago !== undefined,
  "Indicá qué querés corregir",
);
export type CorregirPagoInput = z.infer<typeof CorregirPagoSchema>;

export const AnularPagoSchema = z.object({
  motivo: motivoSchema,
  caja_ajuste_id: z.string().cuid().optional(),
}).strict();
export type AnularPagoInput = z.infer<typeof AnularPagoSchema>;
```

Copiado literal del bloque ya redactado en `spec_modulo_I.md` §2.14.2 — no reinventar validación ni mensajes.

### 4.2. Flujos transaccionales nuevos

**Archivo:** `src/server/pagos/correccion.flujos.ts`

```typescript
/** POST /api/pagos/[id]/correccion (§2.14.2). Orquesta corregirPago/corregirOperacion
 *  de correccion.service.ts en una única transacción; no agrega reglas propias. */
export async function corregirPagoFlujo(
  pagoId: string, input: CorregirPagoInput, usuario: UsuarioOperador,
): Promise<PagoCorregidoDto> {
  return transaccion(async (tx) => {
    let resultadoMonto: PagoCorregido | undefined;
    let resultadoOperacion: OperacionCorregida | undefined;
    if (input.monto !== undefined) {
      resultadoMonto = await corregirPago(tx, {
        pagoId, monto: input.monto, motivo: input.motivo, usuario, cajaAjusteId: input.caja_ajuste_id,
      });
    }
    if (input.forma_pago_id !== undefined || input.fecha_pago !== undefined) {
      // input.fecha_pago ya es Date: fechaCalendarioValidaSchema lo transforma en el schema (§4.1),
      // no hay que reconstruirlo acá — un new Date(`${input.fecha_pago}...`) sobre un Date sería un bug.
      resultadoOperacion = await corregirOperacion(tx, {
        pagoId, formaPagoId: input.forma_pago_id, fechaPago: input.fecha_pago,
        motivo: input.motivo, usuario, cajaAjusteId: input.caja_ajuste_id,
      });
    }
    // arma la respuesta de §2.14.2 a partir de lo que efectivamente corrió
  });
}

/** POST /api/pagos/[id]/anulacion (§2.14.3). */
export async function anularPagoFlujo(
  pagoId: string, input: AnularPagoInput, usuario: UsuarioOperador,
): Promise<PagoAnuladoDto> {
  return transaccion((tx) => anularPago(tx, { pagoId, motivo: input.motivo, usuario, cajaAjusteId: input.caja_ajuste_id }));
}
```

Ninguno de los dos reimplementa una regla de negocio (Regla N.° 4): orquestan `correccion.service.ts`, que ya resuelve bloqueo único, alcance, validación de forma/fecha y ajuste de caja.

### 4.3. Lectura nueva

**Archivo:** `src/server/pagos/correccion.lecturas.ts`

```typescript
/** GET /api/pagos/[id]/historial (DEC-27, §2.14.6): el "detalle del pago" del criterio 3. */
export async function obtenerHistorialDePago(pagoId: string): Promise<HistorialPagoDto> {
  // 1. Lee la operación del pago con INCLUDE_OPERACION_VIGENTE (pago.vigente.ts) — 404 PAGO_NO_ENCONTRADO si no existe.
  // 2. registro: monto/forma/fecha VIGENTES (vigenteDeOperacion) — esto sí es "el estado actual del pago".
  // 3. cambios[]: NO repite el valor vigente por cada fila. Cada evento muestra su propio anterior → nuevo,
  //    tal cual quedó grabado en esa fila de corrección/anulación (igual al ejemplo de spec_modulo_I.md §2.14.6:
  //    una corrección de 24000 a 20000 se lee "24000 → 20000", no "20000" repetido). Un pago con dos correcciones
  //    de monto encadenadas muestra las DOS filas con su anterior/nuevo real, no el original contra el vigente final.
  //    pago.correcciones (CORRECCION_MONTO) + operacion.correcciones (CORRECCION_FORMA/CORRECCION_FECHA,
  //    las de la operación valen para TODOS sus pagos) + pago.anulacion (ANULACION), más nuevo primero.
  // 4. Usuarios resueltos en lote con obtenerNombresPersonal (no una query por cambio).
}
```

### 4.4. Route Handlers

Los 3 archivos de 0.2. Permisos exactos (Regla N.° 10):

| Ruta | Método | Permiso |
|---|---|---|
| `/api/pagos/[id]/correccion` | `POST` | `pagos:corregir` |
| `/api/pagos/[id]/anulacion` | `POST` | `pagos:corregir` |
| `/api/pagos/[id]/historial` | `GET` | `pagos:leer` |

Patrón de error: `respuestaDeError()` de `src/app/api/pagos/respuesta-error.ts` (ya existe), sin overrides — **todos** los códigos que puede lanzar `correccion.service.ts` ya están registrados con su status en `errores-dominio.ts` (0.1). Validación Zod siempre antes del servicio en los dos `POST` (Regla N.° 6); respuesta siempre `{ data, error }` (Regla N.° 5).

**Formas de pago activas del diálogo de Corregir:** `GET /api/formas-pago/opciones` (`formas_pago:leer`, lo tienen Mesa de entrada **y** Gerente) — **no** `GET /api/pagos/opciones` (exige `pagos:crear`, que el Gerente no tiene; le daría `403`).

### 4.5. Textos nuevos en `src/lib/textos.ts`

No agrega ninguna clave de `errores.*` (0.1: ya están todas). Agrega:
- `confirmaciones.pagos.corregir`: texto de 0.4 punto 5 (a confirmar).
- `confirmaciones.pagos.anular`: `"¿Estás seguro de que querés anular este pago de {monto}?"`.
- `ui.pagos.correccion.corregir` / `.anular` / `.verDetalle`: textos de los botones/enlaces de fila.
- `ui.pagos.correccion.dialogoCorregir` / `.dialogoAnular`: títulos de los diálogos de edición.
- `ui.pagos.correccion.monto` / `.formaPago` / `.fecha` / `.motivo` / `.placeholderMotivo`: etiquetas de los campos.
- `ui.pagos.correccion.formaInactiva`: etiqueta "Inactiva" junto a la forma de pago vigente (criterio 2).
- `ui.pagos.correccion.alcanzaClases`: aviso de 0.4 punto 5 (`clases_abarcadas`).
- `ui.pagos.correccion.fueReintegro`: texto del botón que precarga "Reintegro" en el motivo (nota del criterio 6).
- `ui.pagos.correccion.sinCambios` / `.motivoRequerido`: validaciones de cliente antes de enviar.
- `ui.pagos.correccion.exitoCorregir`: "Pago corregido correctamente" (criterio 7, literal).
- `ui.pagos.correccion.exitoAnular`: "Pago anulado" (criterio 7, literal).
- `ui.pagos.correccion.anulado`: etiqueta "Anulado" (criterio 4, literal) — reutilizable en ambas listas.
- `ui.pagos.correccion.historial.titulo` / `.columna.*` / `.sinCambios`: el modal de solo lectura.
- `ui.pagos.correccion.cajaAjuste.titulo` / `.placeholder` / `.reintentar`: el selector de 0.4 punto 2.

---

## 5. Frontend

**"Pagos registrados" — `turno-pago-card.tsx` (detalle de la clase, criterio 1):**
- El total (`Total registrado`) excluye los pagos `anulado`.
- Cada fila con `pago.anulado`: monto tachado + `Badge`/etiqueta "Anulado" (criterio 4), sin acciones de Corregir/Anular (ya anulado), conserva "Ver detalle".
- Cada fila sin anular: `<PagoAcciones>` con "Corregir"/"Anular" si `puede_corregir`, siempre "Ver detalle" (0.4, punto 3).

**Pestaña Pagos del alumno — `tabla-historial-pagos.tsx` (HU-I-02, criterio 1):**
- Misma lógica, columna "Acciones" nueva al final de la tabla del modo Historial (el modo Estado de pago no tiene pagos, no se toca).

**`PagoAcciones` (`src/components/pagos/pago-acciones.tsx`, cliente, compartido — 0.4 punto 6). Props:** `pago` (subconjunto común a `PagoRegistradoTurno`/`PagoHistorialItem`: `{ pago_id, monto, forma_pago: { id, nombre, is_active }, fecha_pago, anulado, puede_corregir, clases_de_la_operacion }`), `alumnoNombre: string`, `claseEtiqueta: string`, `onActualizado: () => void` (**obligatorio**, sin fallback a `router.refresh()` — 0.4 punto 6).
- "Corregir" (si `puede_corregir`): abre un `Dialog` — título "Corregir pago", subtítulo `{alumnoNombre} · {claseEtiqueta}` — con Monto y Fecha en una fila (Monto precargado, `montoSchema`; Fecha precargada, no futura), Forma de pago debajo (`<select>` poblado con `GET /api/formas-pago/opciones` + la vigente aunque esté inactiva, etiquetada "Inactiva" y conservada hasta que se cambie explícitamente — criterio 2, última viñeta), y Motivo (obligatorio, hasta 300, contador `0/300`), botones "Cancelar"/"Guardar corrección". Si cambia forma o fecha, muestra dentro del mismo diálogo "Este cambio alcanza a {clases_de_la_operacion} clases de esta operación" (calculado en el cliente, sin esperar al servidor). Al confirmar "Guardar corrección" arma solo los campos que cambiaron (si ninguno cambió, error de cliente `ui.pagos.correccion.sinCambios` sin llamar al servidor) y abre `ConfirmarAccionDialog` **reversible** (`"¿Estás seguro de que querés corregir este pago?"` + detalle anterior → nuevo).
- "Anular" (si `puede_corregir`): **un solo** `ConfirmarAccionDialog` **irreversible** (`destructiva`, sin paso de edición previo — 0.4 punto 5, corrige la versión original de este doc que lo planteaba en dos pasos): título `"¿Estás seguro de que querés anular el pago de {monto} de {alumnoNombre} ({claseEtiqueta})?"`, `contenido` con el texto `"El pago no se borra, pero queda marcado como anulado y deja de contar en los totales."`, el campo Motivo (obligatorio, contador) con el enlace `"Usar el motivo «Reintegro»"` que lo precarga (editable, nota del criterio 6), botón de confirmar en rojo.
- Si el servidor rechaza con `403 FUERA_DE_ALCANCE`, `409 PAGO_ANULADO`/`PAGO_YA_ANULADO`/`SIN_CAMBIOS`: se muestra dentro del mismo diálogo (comportamiento nativo de `ConfirmarAccionDialog`), sin cerrarlo.
- Si rechaza con `409 CAJA_DE_AJUSTE_NO_ABIERTA` (solo puede pasarle al Gerente): la confirmación muestra, vía `accionError`, `<SelectorCajaAjuste>` (0.4, punto 2) con "Reintentar con esta caja", que reenvía el mismo pedido agregando `caja_ajuste_id`.
- Éxito: toast `"Pago corregido correctamente"` / `"Pago anulado"` (criterio 7, literal) y `onActualizado()`.
- "Ver detalle" (siempre, con `pagos:leer` — 0.4 punto 3): abre `<HistorialCambiosDialog pagoId={...} />`.

**`SelectorCajaAjuste` (`src/components/pagos/selector-caja-ajuste.tsx`):**
- `<select>` poblado con `GET /api/cajas` (campo `abiertas`), mostrando `integrante` + `"hace {antiguedad_minutos} min"`; solo se monta cuando hace falta (lazy fetch al mostrarse el `accionError`), nunca de entrada.

**`HistorialCambiosDialog` (`src/components/pagos/historial-cambios-dialog.tsx`, DEC-27):**
- `Dialog` de solo lectura: arriba el registro original (monto, forma, fecha, registrado por, registrado el); debajo la lista `cambios` (tipo traducido — "Corrección de monto"/"Corrección de forma de pago"/"Corrección de fecha"/"Anulación —, valor anterior → nuevo, motivo, usuario y fecha), más nuevo primero. Vacío: `ui.pagos.correccion.historial.sinCambios` ("Este pago no tiene correcciones ni anulaciones.").

Todos los colores y componentes siguen `docs/DESIGN.md`: tokens de shadcn/ui + Tailwind, nunca hex. `motivo` con contador `n/300` igual a `resultado-examen-acciones.tsx`.

**Fuera de alcance de frontend:** cualquier pantalla propia para esta HU (no hay `/pagos/[id]` de página completa); cualquier cambio al wizard de `/pagos/registrar` (HU-I-10) o a `comprobante-card.tsx` (HU-I-11, que ya deriva sus marcas solo).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios

- `correccion.schema.test.ts`: los dos schemas — válidos e inválidos (ninguno de los tres campos de cambio en `CorregirPagoSchema` → falla el `refine`; motivo vacío o > 300; `caja_ajuste_id` no-CUID; campo extra rechazado por `.strict()`).
- `correccion.flujos.test.ts` (mocks): `corregirPagoFlujo` llama a `corregirPago` solo si vino `monto`, a `corregirOperacion` solo si vino `forma_pago_id`/`fecha_pago`, a los dos si vinieron ambos grupos, en ese orden; `anularPagoFlujo` delega tal cual en `anularPago`, sin envolver sus errores.
- `correccion.flujos.pg.test.ts` (PostgreSQL real, complementa — no repite — `correccion.service.pg.test.ts` que ya cubre las reglas): el flujo completo HTTP-a-servicio para los 4 casos (solo monto, solo forma, solo fecha, monto+forma a la vez con dos comprobantes de reemplazo encadenados); caja cerrada sin `caja_ajuste_id` → `409 CAJA_DE_AJUSTE_NO_ABIERTA`, con `caja_ajuste_id` de una caja abierta → ajuste registrado.
- `correccion.lecturas.test.ts`/`.pg.test.ts`: `obtenerHistorialDePago` arma `cambios` con el tipo correcto por cada tabla de origen, orden más nuevo primero, incluye correcciones de operación de **otro** pago de la misma operación (forma/fecha alcanzan a todos); pago sin ninguna corrección → `cambios: []`; pago inexistente → `404`.
- Componentes (`pago-acciones.test.tsx`): solo se arman los campos que cambiaron antes de enviar; sin ningún cambio, error de cliente sin llamar al servidor; `accionError` con `CAJA_DE_AJUSTE_NO_ABIERTA` muestra el selector y reintenta con `caja_ajuste_id`; "Fue un reintegro" precarga el motivo sin enviar todavía; éxito llama a `onActualizado` si vino o a `router.refresh` si no.

### Nivel 2 — Postman

`docs/testing/Modulo I/hu-i-06/HU-I-06.postman_collection.json`:
- `POST .../correccion` con un cambio de monto → `200` con el contrato de §2.14.2; con los tres valores iguales a los vigentes → `400 SIN_CAMBIOS`; con forma inactiva nueva → `409 FORMA_PAGO_NO_DISPONIBLE`; con fecha futura → `400 FECHA_PAGO_FUTURA`.
- `POST .../anulacion` sobre un pago vigente → `200`; sobre uno ya anulado → `409 PAGO_YA_ANULADO`.
- Mesa de entrada sobre un pago de hace 31 días, o de una caja cerrada → `403 FUERA_DE_ALCANCE`; el Gerente, sobre los mismos casos, → `200`.
- Gerente corrigiendo un pago de caja cerrada sin `caja_ajuste_id` → `409 CAJA_DE_AJUSTE_NO_ABIERTA`; con una caja abierta ajena → `200`.
- `GET .../historial` sobre un pago con una corrección y una anulación → `200` con `cambios` en el orden correcto; sobre uno sin cambios → `cambios: []`; rol sin `pagos:leer` → `403`.
- Sin secretos ni cookies en la colección.

### Nivel 3 — BD / TablePlus

- Tras corregir: fila original de `pagos` **sin cambios**; una fila nueva en `correcciones_pago` o `correcciones_operacion` según el campo; nuevo `comprobantes` con `reemplazaAId` apuntando al anterior.
- Tras anular: fila nueva en `anulaciones_pago` (única por `pagoId`, índice único verificado); `turno_alumno.estadoPago`/`venceEl` según el caso (reabre "Reservada" con plazo nuevo, "Pago sin registrar", o sin cambios si la inscripción no es vigente) — HU-C-24 criterio 5.
- Caja cerrada: fila(s) nueva(s) en `ajustes_caja` con el `origen` correcto (`correccionPagoId`/`correccionOperacionId`/`anulacionPagoId`) y el monto con signo de la tabla de §2.14.4; la caja de ajuste elegida no cambia de estado.
- Ningún `DELETE` en ninguna tabla; `pagos` nunca recibe un `UPDATE`.

**Evidencia esperada:** Postman + SQL; capturas de "Pagos registrados" (fila corregida, fila anulada), de la pestaña Pagos del alumno con las mismas acciones, del diálogo de Corregir con el aviso "alcanza a N clases", del selector de caja de ajuste y del modal de historial de cambios, comparadas contra las fotos del prototipo en `C:\Users\agust\Desktop\Imagenes HU\HU-I-06\` (`Anular pago`, `Corregir pago`).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0, incluidos los 9 puntos de 0.4) confirmado antes de implementar — **hecho, OK dado el 13/10/2026**.
- [ ] `correccion.alcance.ts` extraído (sin dependencias de otros módulos) y `publico.aislamiento.test.ts` actualizado con la nueva ruta permitida en `pago.publico.ts`.
- [ ] `CorregirPagoSchema`/`AnularPagoSchema`, `corregirPagoFlujo`/`anularPagoFlujo` y `obtenerHistorialDePago` implementados, sin ninguna regla de negocio nueva (delegan en `correccion.service.ts`, que no se toca).
- [ ] Los 3 Route Handlers responden `{ data, error }` con los status codes de §2.14.5, reutilizando `respuestaDeError()` de HU-I-10.
- [ ] Ningún código de error nuevo en `errores-dominio.ts` (ya existían todos); ningún permiso nuevo en el seed (ya existía `pagos:corregir`).
- [ ] `listarPagosDeClase`/`PagoDeClase` extendidos con `puede_corregir`; `listarPagosDeTurno`/`PagoDeTurno` eliminados y `turno.detalle.ts` actualizado.
- [ ] Frontend: "Corregir"/"Anular"/"Ver detalle" funcionando en "Pagos registrados" (detalle de la clase) **y** en el historial de pagos del alumno (HU-I-02), con el mismo componente `PagoAcciones`.
- [ ] Motivo obligatorio (hasta 300) en ambas acciones; selector de caja de ajuste para el Gerente ante `CAJA_DE_AJUSTE_NO_ABIERTA`.
- [ ] Modal de historial de cambios (DEC-27) con tipo, valor anterior/nuevo, motivo, usuario y fecha, más nuevo primero.
- [ ] Un pago anulado se ve con la etiqueta "Anulado", tachado, excluido de todos los totales (detalle de la clase, historial del alumno) y sin "Corregir"/"Anular" (conserva "Ver detalle").
- [ ] Ningún `DELETE` ni `UPDATE` sobre `pagos`; toda corrección/anulación es un registro nuevo.
- [ ] Mensajes "Pago corregido correctamente" / "Pago anulado" literales (criterio 7).
- [ ] Textos nuevos agregados a `textos.ts` bajo `ui.pagos.correccion.*`/`confirmaciones.pagos.*`, ninguno hardcodeado.
- [ ] Filas nuevas de HU-I-06 agregadas a `DESIGN.md` §6.4.
- [ ] Sección «Aplicación HU-I-06» agregada a `RULES.md`.
- [ ] Tests de los 3 niveles en verde, con evidencia.
- [ ] PR con diff acotado exclusivamente a esta task.