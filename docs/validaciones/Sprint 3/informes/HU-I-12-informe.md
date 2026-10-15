# Informe de validación PO — HU-I-12 · Abrir y cerrar mi caja con arqueo ciego

- **Fecha:** 14/10/2026
- **Rama revisada:** `develop` @ `d020827` (árbol limpio). La HU entró partida en dos tasks: `HU-I-12.md` (abrir, arqueo ciego, cierre en dos pasos, vistas del gerente, cierre por ausencia) y `HU-I-12-b.md` (movimientos manuales). La segunda mitad del criterio 4 (ajustes) la implementó HU-I-06.
- **Fuente de verdad:** el texto de la HU que entregó el PO (no la task).
- **Documentos leídos:** `prisma/schema.prisma` (`Caja`, `MovimientoCaja`, `AnulacionMovimiento`, `AjusteCaja` y el índice parcial `cajas_abierta_por_integrante_key` de la migración `20261008120100_sprint3_modelo`), `docs/RULES.md` (incluida «Aplicación HU-I-12»), `docs/DESIGN.md` (§6.4 filas 294 a 304 y §6.6), `prisma/seed.ts` y el fixture `hu-f-05.ts`, `docs/specs/spec_modulo_I.md` §2.10 a §2.12, `docs/tasks/Sprint 3/HU-Sprint-3.md` (convenciones 8 y 9, HU-C-25), `docs/tasks/Sprint 3/Modulo I/HU-I-12.md`, `HU-I-12-b.md` y la evidencia de `docs/testing/Modulo I/hu-i-12/` y `hu-i-12-b/`.

> **Resumen:** la HU está implementada de punta a punta. Toda la regla de negocio está en `caja.service.ts` (PR 0), sin cambios. Encima hay envoltorios transaccionales delgados (`caja.flujos.ts`), lecturas (`caja.lecturas.ts`), 13 rutas bajo `/api/cajas/**`, «Mi caja» (`/caja`) y «Cierres de caja» (`/cajas`). El cobro (HU-I-10) y las correcciones (HU-I-06) usan la misma caja y el mismo bloqueo. De los 11 criterios, 9 están **CUBIERTOS**. El **10** queda **PARCIAL** por un caso borde del cierre por ausencia y el **9** tiene un **DESVÍO menor** en cuándo se ve el mensaje. Los tests de la HU están en verde (368 unitarios y 43 contra PostgreSQL real). **No encontré bloqueantes.** Hay 3 puntos para que decida el PO y algunos textos sin centralizar.

---

## 1. Tabla de trazabilidad

Leyenda: **CUBIERTO** · **PARCIAL** · **NO ENCONTRADO** · **DESVÍO** (la task o la spec interpretan el criterio distinto que la HU).

| # | Criterio / viñeta | Dónde está (archivo · función · endpoint · componente) | Estado | Justificación |
|---|---|---|---|---|
| 1 | Cada integrante abre su propia caja con «Abrir caja» | `POST /api/cajas` (`cajas:abrir`) → `abrirMiCaja` (`caja.flujos.ts:26`) → `abrirCaja` (`caja.service.ts:42`). UI: `caja/mi-caja.tsx` (estado vacío con «Abrir caja») → `caja/abrir-caja-dialog.tsx` | **CUBIERTO** | La caja siempre queda a nombre de `req.auth.user.id`: no hay forma de abrir la caja de otro. |
| 1 | No depende de la fecha del calendario: dura hasta que se cierra y puede pasar la medianoche | `Caja` no tiene columna de fecha de calendario. `cajaAbiertaDe` busca por `usuarioId` + `estado = ABIERTA` | **CUBIERTO** | No hay ningún cierre automático ni filtro por día. |
| 1 | Fondo inicial en efectivo (puede ser $ 0); se registran fecha, hora y usuario | `AbrirCajaSchema` (regex `^\d{1,9}(\.\d{1,2})?$`, acepta 0), revalidado en el servicio. Guarda `abiertaEl = ahora()`, `usuarioId`, `fondoInicial`. UI: «Fondo inicial en efectivo ($)» y confirmación HU-C-25 con el monto | **CUBIERTO** | `abrirCaja` además exige la ficha de mesa de entrada activa (`bloquearIntegranteActivo`, `409 INTEGRANTE_INACTIVO`). |
| 1 | Máximo una caja abierta por integrante, garantizado por el servidor aunque se abran dos a la vez (Regla N.° 7) | Índice único parcial `cajas_abierta_por_integrante_key` (`usuarioId` WHERE `estado = 'ABIERTA'`); `P2002` → `409 CAJA_YA_ABIERTA` | **CUBIERTO** | Tests PG: «dos aperturas simultáneas del mismo integrante dejan una sola caja» (`caja.flujos.pg.test.ts:45`) y `operacion.service.pg.test.ts:76`. |
| 2 | Sin caja abierta no se registran pagos por ningún camino («Registrar pago» del menú, atajo del detalle de la clase, inscripción con pago) | Los tres caminos navegan al mismo wizard `/pagos/registrar` (`Sidebar.tsx:78`, `turno-alumnos-card.tsx:133` y `:197`, `participantes-turno.tsx:117`, `tabla-reservas.tsx:97`). Todos los pagos se escriben en un único lugar: `registrarOperacion` (`operacion.service.ts:78`), que usan `POST /api/pagos` y `POST /api/pagos/operaciones` | **CUBIERTO** | No hay otro `pago.create` en el código fuera de las fábricas de test. |
| 2 | Se muestra «No se puede registrar un cobro hasta que abras una caja.» con acceso a «Abrir caja», y no se registra nada | Servidor: `operacion.service.ts:172` → `409 CAJA_NO_ABIERTA` con ese texto. UI: `registrar-pago-wizard.tsx:111` (`setSinCaja`) → `paso-confirmacion.tsx:96` pasa `accionError` con el enlace «Abrir caja» → `/caja` a `ConfirmarAccionDialog` | **CUBIERTO** | Todo corre en una transacción: la inscripción que se crea al pagar y las reservas vencidas que marca se revierten. Observación: la caja se valida **al final** (paso 6, «como en Sprint 2»). Si otra validación falla antes (por ejemplo, una clase que ya empezó), el usuario ve primero ese error. El aviso aparece recién al confirmar, no al entrar al wizard. La HU dice «al intentarlo», así que alcanza. |
| 2 | El servidor también rechaza el cobro | Ídem (`registrarOperacion`) | **CUBIERTO** | — |
| 2 | Cada pago queda en la caja abierta de quien lo registra, según el momento del registro (no la fecha de pago), con su forma de pago | `cajaAbiertaDe(tx, usuarioId)` → `operacionPago.create({ cajaId, registradaEl: momento, formaPagoId, fechaPago })` | **CUBIERTO** | `fechaPago` es un dato aparte. El arqueo lista por `registradaEl` (`caja.lecturas.ts:94`). |
| 3 | Con la caja abierta, «Registrar movimiento»: ingreso o egreso de efectivo que no viene de clases | `POST /api/cajas/mia/movimientos` (`cajas:movimiento`) → `registrarMiMovimiento` → `registrarMovimiento` (`caja.service.ts:186`). UI: `caja/registrar-movimiento-dialog.tsx` + `ConfirmarAccionDialog` reversible | **CUBIERTO** | El botón solo aparece con caja abierta y con el permiso. |
| 3 | Tipo, monto positivo y concepto obligatorio (hasta 200) | `RegistrarMovimientoSchema` (`tipo` enum, `montoSchema` > 0, `concepto` 1 a 200) + revalidación en el servicio. UI: `maxLength=200` con contador | **CUBIERTO** | — |
| 3 | Un egreso no puede superar el efectivo que la caja debería tener en ese momento | `registrarMovimiento`: con la caja bloqueada, `calcularResumen` → `409 EGRESO_SUPERA_EFECTIVO` («El egreso supera el efectivo de la caja.», sin el monto esperado) | **CUBIERTO** | Ver la observación de arqueo ciego en §5.3. |
| 3·a | Un movimiento no se edita: se anula con motivo mientras la caja está abierta; la anulación es un registro nuevo que lo referencia (Regla N.° 8) | `POST /api/cajas/mia/movimientos/[movimientoId]/anulacion` → `anularMovimiento` (`caja.service.ts:208`): crea `AnulacionMovimiento` (`movimientoId @unique`), exige caja propia y abierta. UI: «Anular» por fila → `anular-movimiento-dialog.tsx` (motivo obligatorio, hasta 300) + confirmación irreversible | **CUBIERTO** | No hay ningún `update` sobre `MovimientoCaja`. Una caja ajena responde `404 MOVIMIENTO_NO_ENCONTRADO` (no revela que existe). Anular un ingreso que deja el esperado negativo da `409 ANULACION_DEJA_EFECTIVO_NEGATIVO`. |
| 4·a | Con la caja del pago abierta, mesa de entrada corrige o anula según HU-I-06 y el cambio se refleja en esa caja | `puedeCorregirPago` (`correccion.alcance.ts:21`: MESA solo con `cajaAbierta` y hasta 30 días). `calcularResumen` y `obtenerCajaPropia` usan los valores vigentes (`vigenteDeOperacion`) | **CUBIERTO** | La corrección también cambia la huella, así que un cierre en curso recibe `CAJA_CAMBIO`. |
| 4·b | Con la caja cerrada, solo el gerente corrige o anula; la caja cerrada no se modifica; el dinero va como ajuste a una caja abierta | `correccion.service.ts` (`corregirPago`, `corregirOperacion`, `anularPago`) → `registrarAjuste` (`caja.service.ts:245`) sobre `caja_ajuste_id`. El cierre guardó `resumen` (JSONB) y el detalle nunca lo recalcula (`obtenerDetalleCierre`) | **CUBIERTO** (vía HU-I-06) | El cambio de forma genera el par de ajustes (−forma anterior, +forma nueva). El de fecha no mueve dinero. |
| 4·b | El gerente elige la caja abierta del integrante que entrega o recibe el dinero; sin ninguna, «Para registrar este cambio tiene que haber una caja abierta en mesa de entrada» y no se registra | `components/pagos/selector-caja-ajuste.tsx` (cajas abiertas de `GET /api/cajas`, «{integrante} · abierta hace {tiempo}») dentro de `accionError`; servidor: `409 CAJA_DE_AJUSTE_NO_ABIERTA` | **CUBIERTO** (vía HU-I-06) | El selector aparece recién después del primer rechazo (reactivo). Sin cajas, se ve el error del servidor y «No hay ninguna caja abierta en mesa de entrada.». |
| 5 | Con la caja abierta, la pantalla lista cobros, movimientos y ajustes sin totales ni esperado | `GET /api/cajas/mia` → `obtenerCajaPropia` (`caja.lecturas.ts:70`): solo ítems con su monto. `mi-caja.tsx` → `TablaItems` sin pie de totales; leyenda «Arqueo ciego: …» | **CUBIERTO** | Test `caja.lecturas.pg.test.ts` verifica que no viaja ningún total. Tampoco el gerente ve el contenido (solo la antigüedad). |
| 5 | Paso 1: efectivo contado (≥ 0) sin esperado ni totales | `POST /api/cajas/mia/declaracion` → `declararEfectivo` (`caja.service.ts:274`). UI: `components/pagos/cerrar-caja-dialog.tsx` paso 1 | **CUBIERTO** | `GET …/resumen` antes de declarar responde `409 EFECTIVO_NO_DECLARADO`. |
| 5 | Paso 2: al confirmar se muestra el resumen; el monto declarado ya no se puede cambiar | `declararEfectivo` guarda una sola vez (`updateMany … WHERE efectivoDeclarado IS NULL`, Regla N.° 7) → `409 EFECTIVO_YA_DECLARADO` | **CUBIERTO** | Si se cierra el diálogo después de declarar, al volver entra directo al paso 2 (`router.refresh()` + `efectivo_declarado`). |
| 5 | Si entra un cobro, movimiento o ajuste, al confirmar: «La caja cambió mientras cerrabas. Revisá el resumen.», resumen actualizado con el mismo declarado, y no cierra hasta volver a confirmar | `cerrarCaja` recalcula la huella con la caja bloqueada → `409 CAJA_CAMBIO` con `detalles: { resumen, huella }`. UI: `cerrar-caja-dialog.tsx:163-169` reemplaza resumen y huella, muestra el aviso y vuelve a pedir el motivo si hace falta | **CUBIERTO** | La huella también contempla correcciones y anulaciones de pagos (más estricto que la HU). Tests: `caja.service.pg.test.ts:89`, `caja.flujos.pg.test.ts:59`, `cerrar-caja-dialog.test.tsx`. |
| 6 | Resumen: fondo, cobros por forma con cantidad y total, ingresos y egresos manuales, ajustes, efectivo esperado (fórmula), declarado y diferencia; las formas no efectivo se informan pero no entran en el arqueo | `calcularResumen` (`caja.service.ts:116`): suma al esperado solo las formas con `esEfectivo`. UI: `components/pagos/resumen-cierre-caja.tsx` («Cobros en {forma} · N pagos», «(no entra en el arqueo)», ingresos, egresos, «Ajustes en {forma}», esperado, declarado, `Badge` de diferencia y la fórmula) | **CUBIERTO** | Test PG «resumen: fondo + cobros en efectivo + ingresos − egresos; las otras formas se informan pero no suman». Los nombres de las formas salen del catálogo: el seed tiene Efectivo, Transferencia, Débito y Mercado Pago («Tarjeta» de la HU es un ejemplo). |
| 7 | Si no coincide: «Sobrante de $ <monto>» / «Faltante de $ <monto>» y motivo obligatorio (hasta 300) | `textoDiferencia` (`lib/caja.ts:36`) + `DiferenciaCajaBadge`. Motivo: UI (`pedirConfirmacion`, `maxLength=300`) y servidor (`400 MOTIVO_DIFERENCIA_REQUERIDO`; Zod `max(300)`) | **CUBIERTO** | — |
| 7 | Si coincide: «La caja cuadra» y observación opcional | Mismo `textarea`, rotulado «Observación · Opcional» | **CUBIERTO** | — |
| 7 | El cierre registra la diferencia (con signo) y el motivo | `cerrarCaja`: `diferencia = declarado − esperado`, `motivo`, `efectivoEsperado`, `resumen` | **CUBIERTO** | — |
| 8 | Se confirma con el mensaje de HU-C-25 («¿Estás seguro de que querés cerrar tu caja con un faltante de $ 1.500? Esta acción no se puede deshacer.») | `confirmacionCierre` (`lib/caja.ts:48`) + `ConfirmarAccionDialog irreversible` (agrega la leyenda) | **CUBIERTO** | Con un faltante de 1500 el texto queda idéntico al de la HU. Si cuadra: «¿Estás seguro de que querés cerrar tu caja sin diferencia?» (lo acordó el equipo; la HU solo da el ejemplo con faltante). |
| 8 | Pasa a Cerrada con fecha, hora y usuario y queda inmutable (no se le agregan cobros, movimientos ni ajustes; el resumen no cambia aunque después se corrijan pagos) | `updateMany` condicionado a `ABIERTA` (estado, `cerradaEl`, `cerradaPorUsuarioId`, `resumen`). Cobro, movimiento y ajuste bloquean la caja y exigen `ABIERTA`. Detalle: `obtenerDetalleCierre` devuelve el `resumen` guardado | **CUBIERTO** | — |
| 8 | «Imprimir» abre el diálogo de impresión con solo el cierre (centro, integrante, apertura y cierre, resumen, diferencia, motivo, fecha de impresión), sin menú; desde ahí se guarda como PDF | `components/pagos/detalle-cierre-caja.tsx` (`data-cierre-caja`, `window.print()`, «Impreso el {fecha}» solo en impresión) + regla `@media print` de `globals.css:169` (compartida con el comprobante de HU-I-11). Páginas `caja/cierres/[id]` y `cajas/[id]` | **CUBIERTO** | Verificar a mano la vista previa (ver §6). |
| 8 | Para volver a cobrar hay que abrir una caja nueva | Después del cierre `cajaAbiertaDe` devuelve `null`; `/caja` vuelve a «No tenés una caja abierta» | **CUBIERTO** | — |
| 9 | El cierre bloquea la caja en su transacción y calcula ahí el esperado; cobros, movimientos y ajustes toman el mismo bloqueo y verifican que siga abierta | `cajaBloqueada` → `bloquear(tx, { cajas })` en `cerrarCaja`, `declararEfectivo`, `registrarMovimiento`, `anularMovimiento`, `registrarAjuste`; `registrarOperacion` bloquea la caja (`operacion.service.ts:99-104`) y relee su estado (`:173`); `contextoDelPago` (HU-I-06) también | **CUBIERTO** | Test PG: «un cobro y un cierre simultáneos no confirman los dos» (`caja.service.pg.test.ts:130`). |
| 9 | Si la caja se cerró mientras se registraba un cobro: «Tu caja se cerró. Abrí una caja nueva para registrar el cobro.» y no se registra | `operacion.service.ts:174` → `errores.caja.cerradaDuranteCobro` (código `CAJA_NO_ABIERTA`). La UI muestra el mensaje del servidor con «Abrir caja» | **DESVÍO menor** | El texto solo aparece si la caja se cierra **entre la lectura y el bloqueo** del mismo pedido (milisegundos). El caso real (el integrante tiene abierta la confirmación de «Registrar pago» y el gerente le cierra la caja por ausencia, o él mismo la cierra en otra pestaña) muestra «No se puede registrar un cobro hasta que abras una caja.», porque al llegar el pedido ya no hay caja abierta. El resultado funcional es el correcto (no registra y ofrece «Abrir caja»). Solo cambia el texto. |
| 10 | El gerente ve las cajas abiertas con su antigüedad | `GET /api/cajas` → `listarCajasYCierres` (`abiertas` con `antiguedad_minutos`). UI: `cajas/cajas-abiertas.tsx` («45 minutos», «3 horas», «2 días») | **CUBIERTO** | Sin montos (arqueo ciego también para él). |
| 10 | No se puede desactivar a un integrante con la caja abierta (HU-F-05) | `desactivarIntegrante` (`personal.service.ts:362`) → `409 CAJA_ABIERTA`. UI: `personal/[id]/estado-integrante-dialog.tsx:150` con «Ir a Cierres de caja» → `/cajas` | **CUBIERTO** | — |
| 10 | Cierre por ausencia con el mismo arqueo ciego (el gerente cuenta y declara); marcado así y con el gerente como responsable | `POST /api/cajas/[id]/ausencia/declaracion`, `GET …/resumen`, `POST …/cierre` (`cajas:cerrar_ausencia`) → `declararPorAusencia` / `cerrarPorAusencia` → servicio con `porAusencia: true` (`exigirAlcance`: caja de **otro**). UI: mismo `CerrarCajaDialog` en modo ausencia; `Badge` «Por ausencia» y «Cierre por ausencia, hecho por {gerente}» en el detalle | **PARCIAL** | El caso normal está completo. Hay dos casos borde porque el servicio guarda **un solo** «efectivo declarado» por caja y no registra quién lo declaró: **(a)** si el integrante ya había declarado (paso 1) y se fue sin confirmar, el gerente escribe su conteo, el servidor responde `EFECTIVO_YA_DECLARADO` y la UI **pasa en silencio al paso 2 con el monto del integrante** (`cerrar-caja-dialog.tsx:124-127`, `cajas-abiertas.tsx:138-139`). El conteo del gerente se descarta sin avisar, y el cierre queda «por ausencia» con un monto que él no contó. **(b)** al revés: si el gerente declara y no confirma, el integrante puede cerrarla como cierre propio (`porAusencia = false`) con el conteo del gerente. La task lo documenta como «limitación conocida», derivada a HU-I-06 o a un bug ticket. |
| 11 | Cada integrante ve su caja abierta y sus cierres | `GET /api/cajas/mia`, `GET /api/cajas/mia/cierres`, `GET /api/cajas/mia/cierres/[id]` (`403 FUERA_DE_ALCANCE` si es ajeno). UI: `/caja` con «Mis cierres» (de a 10) y `/caja/cierres/[id]` | **CUBIERTO** | La página del detalle responde 404 (`notFound`) ante un cierre ajeno; la API, 403. |
| 11 | El gerente ve todos los cierres (integrante, apertura, cierre, fondo, esperado, declarado, diferencia, motivo), filtro por integrante y rango de fechas, de a 10 | `GET /api/cajas?integrante_id=&desde=&hasta=&pagina=` (`ListarCajasQuerySchema`, rango por **fecha de cierre**, DEC-30, inclusivo). UI: `cajas/page.tsx` + `filtros-cierres.tsx` + `components/pagos/tabla-cierres-caja.tsx` (todas las columnas pedidas) + `Pagination` | **CUBIERTO** | El filtro de integrantes incluye a los que ya no están activos pero tienen cierres. |
| 11 | El gerente no abre cajas, no registra movimientos ni cierra cajas ajenas (salvo por ausencia) | Seed: GERENTE solo tiene `cajas:leer_todas` y `cajas:cerrar_ausencia` (`seed.ts:968-969`) | **CUBIERTO** | Sidebar: el gerente solo ve «Cierres de caja». |
| 11 | El servidor rechaza con 403 cualquier otro acceso; profesor y alumno no acceden | `withPermission` en las 13 rutas (`403 SIN_PERMISO`); `rutas-por-rol.ts:40-41` (`caja: ["MESA_ENTRADA"]`, `cajas: ["GERENTE"]`) + `proxy.ts:80-81` | **CUBIERTO** | Profesor y alumno no tienen ningún permiso `cajas:*`. |

**Desvíos y puntos para que decida el PO:**
- **c10, PARCIAL (cierre por ausencia con declaración previa):** ver la fila. Recomiendo al menos que la UI avise al gerente que ya había un monto declarado por el integrante, en lugar de descartar el suyo en silencio. La solución de fondo (registrar quién declaró y permitir que el gerente declare de nuevo en un cierre por ausencia) toca `caja.service.ts` y el schema. **Decisión del PO:** aceptarlo como limitación conocida o pedir el aviso antes de la prueba.
- **c9, DESVÍO menor (texto):** ver la fila. Si el PO quiere ver «Tu caja se cerró…» también en el caso real, el wizard tendría que mandar la caja que tenía abierta al empezar. Si no, se acepta como está.
- **Partición de la HU:** el equipo partió la HU en `HU-I-12` y `HU-I-12-b`, y la segunda mitad del criterio 4 quedó en HU-I-06. Las tres están mergeadas en `develop`, así que el alcance de la HU completa está presente. No es un desvío de comportamiento.

---

## 2. Textos literales (archivo central `src/lib/textos.ts`, HU-C-23)

| Texto del criterio | Clave en `textos.ts` | Resultado |
|---|---|---|
| «Abrir caja» | `ui.caja.abrir` | **COINCIDE** |
| «Registrar pago» | `ui.turnos.reserva.registrarPago`, `ui.pagos.registrar.titulo` | **COINCIDE** |
| «No se puede registrar un cobro hasta que abras una caja.» | `errores.caja.sinCajaAbierta` | **COINCIDE** |
| «Registrar movimiento» | `ui.caja.movimiento.registrar` | **COINCIDE** |
| «Ingreso de cambio para la caja» / «Retiro para comprar insumos» (ejemplos) | `ui.caja.movimiento.conceptoPlaceholder` = «Ej.: ingreso de cambio para la caja» | Son ejemplos de la HU, no mensajes. Solo el primero se usa, como placeholder y en minúscula. **No es un incumplimiento.** |
| «Para registrar este cambio tiene que haber una caja abierta en mesa de entrada» | `errores.caja.ajusteSinCajaAbierta` = «…en mesa de entrada**.**» | **COINCIDE** (agrega el punto final; en la HU la cita está dentro de una oración) |
| «Cerrar caja» | `ui.caja.cerrar` | **COINCIDE** |
| «La caja cambió mientras cerrabas. Revisá el resumen.» | `errores.caja.cambio` | **COINCIDE** |
| «Efectivo», «Transferencia», «Tarjeta», etc. | Nombres del catálogo `formas_pago` (no son claves de texto) | «Efectivo» y «Transferencia» coinciden. El seed no tiene «Tarjeta» (tiene «Débito» y «Mercado Pago»). Es un ejemplo de la HU. |
| «Sobrante de $ <monto>» / «Faltante de $ <monto>» | `ui.caja.diferencia.sobrante` / `.faltante` = «Sobrante de {monto}» / «Faltante de {monto}», con `{monto}` = «$ 1.500» (`lib/turno-detalle.ts:79`) | **COINCIDE** |
| «La caja cuadra» | `ui.caja.diferencia.cuadra` | **COINCIDE** |
| «¿Estás seguro de que querés cerrar tu caja con un faltante de $ 1.500? Esta acción no se puede deshacer.» | `confirmaciones.caja.cerrar` («¿Estás seguro de que querés cerrar tu caja con {diferencia}?») + `confirmaciones.caja.faltante` («un faltante de {monto}») + leyenda de `ConfirmarAccionDialog` | **COINCIDE** (armado; la leyenda la pone el componente común) |
| «Imprimir» | `ui.caja.detalle.imprimir` | **COINCIDE** |
| «Tu caja se cerró. Abrí una caja nueva para registrar el cobro.» | `errores.caja.cerradaDuranteCobro` | **COINCIDE** (ver el DESVÍO del c9 sobre cuándo aparece) |
| «Cierre por ausencia» | `ui.cajas.abiertas.cierrePorAusencia` (botón); en las tablas, `Badge` «Por ausencia» (`ui.caja.cierres.porAusencia`); en el detalle, «Cierre por ausencia, hecho por {gerente}» | **COINCIDE** (el botón) |

**Textos que no coinciden palabra por palabra:** ninguno.

`npx tsx scripts/verificar-claves-textos.ts` → «Claves de textos verificadas.»

---

## 3. Reglas de servidor

### 3.1 Endpoints

Todas las rutas usan `withPermission` (sin sesión: `401 SESION_INVALIDA`; sin el permiso: `403 SIN_PERMISO`), validan con Zod antes del servicio (`400 VALIDACION` con `flatten()`, Regla N.° 6) y responden `{ data, error }` mediante `respuestaDeError` (Regla N.° 5).

| Método y ruta | Permiso | Roles | Zod | Transacción y bloqueo (Regla N.° 7) | Registro nuevo / inmutabilidad (Reglas N.° 1 y 8) |
|---|---|---|---|---|---|
| `POST /api/cajas` | `cajas:abrir` | MESA_ENTRADA | `AbrirCajaSchema` (`.strict()`) | `transaccion()` → `abrirCaja`: bloquea la ficha activa e inserta; el índice único parcial garantiza una sola abierta (`409 CAJA_YA_ABIERTA`) | `create` de `Caja` |
| `GET /api/cajas` | `cajas:leer_todas` | GERENTE | `ListarCajasQuerySchema` (`.strict()`, fechas válidas, desde ≤ hasta) | Solo lectura | — |
| `GET /api/cajas/mia` | `cajas:leer` | MESA_ENTRADA | — | Solo lectura (arqueo ciego) | — |
| `POST /api/cajas/mia/declaracion` | `cajas:cerrar` | MESA_ENTRADA | `DeclararEfectivoSchema` | `bloquear(cajas)` + `updateMany … efectivoDeclarado IS NULL` (`409 EFECTIVO_YA_DECLARADO`) | Se escribe una sola vez |
| `GET /api/cajas/mia/resumen` | `cajas:cerrar` | MESA_ENTRADA | — | Solo lectura; `409 EFECTIVO_NO_DECLARADO` antes de declarar | — |
| `POST /api/cajas/mia/cierre` | `cajas:cerrar` | MESA_ENTRADA | `ConfirmarCierreSchema` (`huella`, `motivo ≤ 300`) | `bloquear(cajas)` → huella recalculada (`409 CAJA_CAMBIO` + `detalles`) → `updateMany … estado = ABIERTA` (`409 CAJA_YA_CERRADA`) | `resumen` fijo; después ninguna escritura la acepta |
| `GET /api/cajas/mia/cierres` | `cajas:leer` | MESA_ENTRADA | `PaginaQuerySchema` | Solo lectura | — |
| `GET /api/cajas/mia/cierres/{id}` | `cajas:leer` | MESA_ENTRADA | `idCajaSchema` | Solo lectura; `403 FUERA_DE_ALCANCE` si es ajeno, `409 CAJA_NO_CERRADA` si sigue abierta | — |
| `GET /api/cajas/{id}` | `cajas:leer_todas` | GERENTE | `idCajaSchema` | Solo lectura; `409 CAJA_NO_CERRADA` | — |
| `POST /api/cajas/{id}/ausencia/declaracion` | `cajas:cerrar_ausencia` | GERENTE | `idCajaSchema` + `DeclararEfectivoSchema` | Igual que la declaración propia; `403 FUERA_DE_ALCANCE` si es la propia | Ídem |
| `GET /api/cajas/{id}/ausencia/resumen` | `cajas:cerrar_ausencia` | GERENTE | `idCajaSchema` | Solo lectura | — |
| `POST /api/cajas/{id}/ausencia/cierre` | `cajas:cerrar_ausencia` | GERENTE | `idCajaSchema` + `ConfirmarCierreSchema` | Igual que el cierre propio; queda `porAusencia = true`, `cerradaPorUsuarioId` = gerente | Ídem |
| `POST /api/cajas/mia/movimientos` | `cajas:movimiento` | MESA_ENTRADA | `RegistrarMovimientoSchema` | `bloquear(cajas)` + estado `ABIERTA` + esperado calculado bajo el bloqueo (egreso) | `create` de `MovimientoCaja` |
| `POST /api/cajas/mia/movimientos/{id}/anulacion` | `cajas:movimiento` | MESA_ENTRADA | `idCajaSchema` + `AnularMovimientoSchema` | `bloquear(cajas)` + estado `ABIERTA`; índice único por movimiento (`409 MOVIMIENTO_YA_ANULADO`) | `create` de `AnulacionMovimiento`; el movimiento no se toca |
| `POST /api/pagos/operaciones` y `POST /api/pagos` (HU-I-10) | `pagos:crear` | MESA_ENTRADA | Schemas de HU-I-10 | `registrarOperacion` bloquea la caja (último nivel del orden canónico) y relee `estado` | — |
| `POST /api/pagos/{id}/correccion` y `/anulacion` (HU-I-06) | `pagos:corregir` | MESA_ENTRADA, GERENTE | Schemas de HU-I-06 (`caja_ajuste_id?`) | `contextoDelPago` bloquea la caja del pago y la de ajuste; `registrarAjuste` exige que la de ajuste esté `ABIERTA` | `CorreccionPago` / `CorreccionOperacion` / `AnulacionPago` + `AjusteCaja` |

**Regla N.° 7:** la combinación es bloqueo de la fila de la caja (`SELECT … FOR UPDATE` en orden canónico, `bloquear`) más `updateMany` condicionado en la declaración y el cierre, y el índice único parcial en la apertura. Las pruebas de concurrencia contra PostgreSQL real pasan: dos aperturas, dos cierres (integrante y gerente) y un cobro contra un cierre.
**Regla N.° 2:** opción (a), en la propia fila (`abiertaEl`/`usuarioId`, `cerradaEl`/`cerradaPorUsuarioId`/`porAusencia`, y `creadoPorUsuarioId` + fecha en movimientos, anulaciones y ajustes). **Falta:** quién y cuándo declaró el efectivo (ver §5.2).

### 3.2 Snippets para comprobar el 403 desde la consola del navegador

Iniciá sesión en `http://localhost:3000` con el rol indicado, abrí DevTools → Console y pegá el snippet. Todos son **seguros**: `withPermission` rechaza antes de llegar al servicio, así que no escriben nada. Los ids de caja salen de la consulta Q1 de §6.2.

**A. Profesor o Alumno: todas las rutas de caja dan `403 SIN_PERMISO`.**
```js
// Sesión: profesor1@noctium.local o alumno01@noctium.local (Password123!)
const CAJA = "PEGAR_ID_CAJA_CERRADA"; // Q1
const j = { "Content-Type": "application/json" };
const pedidos = [
  ["GET  /api/cajas", () => fetch("/api/cajas")],
  ["POST /api/cajas", () => fetch("/api/cajas", { method: "POST", headers: j, body: JSON.stringify({ fondo_inicial: "0" }) })],
  ["GET  /api/cajas/mia", () => fetch("/api/cajas/mia")],
  ["POST /api/cajas/mia/declaracion", () => fetch("/api/cajas/mia/declaracion", { method: "POST", headers: j, body: JSON.stringify({ efectivo_declarado: "0" }) })],
  ["GET  /api/cajas/mia/resumen", () => fetch("/api/cajas/mia/resumen")],
  ["POST /api/cajas/mia/cierre", () => fetch("/api/cajas/mia/cierre", { method: "POST", headers: j, body: JSON.stringify({ huella: "x" }) })],
  ["GET  /api/cajas/mia/cierres", () => fetch("/api/cajas/mia/cierres")],
  ["GET  /api/cajas/mia/cierres/{id}", () => fetch(`/api/cajas/mia/cierres/${CAJA}`)],
  ["POST /api/cajas/mia/movimientos", () => fetch("/api/cajas/mia/movimientos", { method: "POST", headers: j, body: JSON.stringify({ tipo: "INGRESO", monto: "1", concepto: "x" }) })],
  ["GET  /api/cajas/{id}", () => fetch(`/api/cajas/${CAJA}`)],
  ["POST /api/cajas/{id}/ausencia/declaracion", () => fetch(`/api/cajas/${CAJA}/ausencia/declaracion`, { method: "POST", headers: j, body: JSON.stringify({ efectivo_declarado: "0" }) })],
];
for (const [nombre, pedido] of pedidos) {
  const r = await pedido();
  console.log(nombre, r.status, (await r.json()).error?.code); // esperado: 403 SIN_PERMISO en todas
}
```

**B. Gerente: no abre cajas, no declara ni cierra la propia, no registra movimientos ni ve «mi caja» → `403 SIN_PERMISO`.**
```js
// Sesión: gerente@noctium.local (Password123!)
const j = { "Content-Type": "application/json" };
for (const [nombre, pedido] of [
  ["POST /api/cajas (abrir)", () => fetch("/api/cajas", { method: "POST", headers: j, body: JSON.stringify({ fondo_inicial: "0" }) })],
  ["GET  /api/cajas/mia", () => fetch("/api/cajas/mia")],
  ["POST /api/cajas/mia/declaracion", () => fetch("/api/cajas/mia/declaracion", { method: "POST", headers: j, body: JSON.stringify({ efectivo_declarado: "0" }) })],
  ["POST /api/cajas/mia/cierre", () => fetch("/api/cajas/mia/cierre", { method: "POST", headers: j, body: JSON.stringify({ huella: "x" }) })],
  ["POST /api/cajas/mia/movimientos", () => fetch("/api/cajas/mia/movimientos", { method: "POST", headers: j, body: JSON.stringify({ tipo: "INGRESO", monto: "1", concepto: "x" }) })],
  ["GET  /api/cajas/mia/cierres", () => fetch("/api/cajas/mia/cierres")],
]) {
  const r = await pedido();
  console.log(nombre, r.status, (await r.json()).error?.code); // esperado: 403 SIN_PERMISO
}
// Control positivo: el listado sí responde 200
console.log("GET /api/cajas", (await fetch("/api/cajas")).status); // 200
```

**C. Mesa de entrada: no ve el listado del gerente, no ve cierres ajenos y no hace cierres por ausencia.**
```js
// Sesión: mesa.entrada@noctium.local (Password123!)
const AJENA = "PEGAR_ID_CAJA_CERRADA_DE_OTRO_INTEGRANTE"; // Q1: por ejemplo, la de f05.cajacerrada@noctium.local
const ABIERTA_AJENA = "PEGAR_ID_CAJA_ABIERTA_DE_mesa.entrada2"; // Q1
const j = { "Content-Type": "application/json" };
for (const [nombre, pedido, esperado] of [
  ["GET  /api/cajas", () => fetch("/api/cajas"), "403 SIN_PERMISO"],
  ["GET  /api/cajas/{ajena}", () => fetch(`/api/cajas/${AJENA}`), "403 SIN_PERMISO"],
  ["POST /api/cajas/{abierta ajena}/ausencia/declaracion", () => fetch(`/api/cajas/${ABIERTA_AJENA}/ausencia/declaracion`, { method: "POST", headers: j, body: JSON.stringify({ efectivo_declarado: "0" }) }), "403 SIN_PERMISO"],
  ["GET  /api/cajas/{abierta ajena}/ausencia/resumen", () => fetch(`/api/cajas/${ABIERTA_AJENA}/ausencia/resumen`), "403 SIN_PERMISO"],
  ["GET  /api/cajas/mia/cierres/{ajena}", () => fetch(`/api/cajas/mia/cierres/${AJENA}`), "403 FUERA_DE_ALCANCE"],
]) {
  const r = await pedido();
  console.log(nombre, r.status, (await r.json()).error?.code, "← esperado", esperado);
}
```

**D. Arqueo ciego por API (mesa de entrada con la caja abierta y sin declarar):** `GET /api/cajas/mia` no trae totales y `GET /api/cajas/mia/resumen` da `409 EFECTIVO_NO_DECLARADO`. Es seguro.
```js
const mia = await (await fetch("/api/cajas/mia")).json();
console.log(Object.keys(mia.data.caja), JSON.stringify(mia).includes("esperado")); // sin «efectivo_esperado» → false
const r = await fetch("/api/cajas/mia/resumen"); console.log(r.status, (await r.json()).error?.code); // 409 EFECTIVO_NO_DECLARADO
```

> ⚠️ No pruebes con `POST …/declaracion` ni `POST …/cierre` desde la sesión de **mesa de entrada** o del **gerente sobre una caja ajena**: con esos roles el servidor sí acepta y **declara o cierra de verdad** (la declaración no se puede deshacer).

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Cumple, con observaciones menores** | Todo lo nuevo usa `texto()` bajo `ui.caja.*`, `ui.cajas.*` y `confirmaciones.caja.*`. Quedan fuera: (1) `MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente."` en `components/pagos/cerrar-caja-dialog.tsx:15` y `app/(dashboard)/caja/enviar-movimiento.ts:4`. Solo aparece si el servidor no manda mensaje. Es el mismo patrón que ya se observó en HU-I-10 y HU-I-06, y que también tiene `confirmar-accion-dialog.tsx` (HU-C-25: «Volver», «Procesando…», la leyenda irreversible). (2) Mensajes de Zod del servidor («Datos inválidos» en las rutas `POST`, y los de `caja.schema.ts` como «Falta la huella del resumen»). La UI valida antes de enviar, así que casi nunca se ven. (3) El guion «—» de motivo vacío. |
| Ningún texto visible con «turno» | **Cumple** | Ninguna clave `ui.caja*` ni `confirmaciones.caja.*` dice «turno». La palabra solo aparece en rutas (`/turnos/…`), en identificadores y en comentarios. |
| Confirmación HU-C-25 en toda operación que guarda | **Cumple, con un punto para el PO** | Usan `ConfirmarAccionDialog`: abrir caja (con el fondo), registrar movimiento (reversible), anular movimiento (irreversible), cerrar caja y cierre por ausencia (irreversibles). **Punto para el PO:** el **paso 1** («Confirmar efectivo contado») **guarda** el monto declarado, que ya no se puede cambiar, y lo hace sin el diálogo de HU-C-25: el botón del paso 1 funciona como confirmación. El catálogo de HU-C-25 para caja lista solo «abrir, registrar o anular un movimiento manual y cerrar», pero su criterio 1 dice «toda acción que crea o modifica un dato». Con un error de tipeo (15000 en vez de 1500), el integrante queda obligado a cerrar con diferencia y motivo. |
| Tests en verde | **Cumple para la HU** / la suite completa tiene 3 fallos **ajenos** | Tests de la HU (`npx vitest run` sobre `server/pagos/caja*`, `api/cajas`, `(dashboard)/caja`, `(dashboard)/cajas`, `components/pagos`, `confirmar-accion-dialog`, `pagos/registrar`, `rutas-por-rol`, `components/layout`, `(dashboard)/personal`, `lib/caja`): **29 archivos, 368 pruebas en verde** (los 4 archivos `*.pg` se saltean ahí). `npm run test:pg` con `caja.service`, `caja.flujos`, `caja.lecturas`, `caja.movimientos` y `operacion.service` (`*.pg.test.ts`), contra una base descartable: **5 archivos, 43 pruebas en verde**. Suite completa (`npx vitest run`): **4416 en verde y 3 en rojo, ninguno de esta HU**: `src/server/shared/actividad-usuario.test.ts` (2; el mock no contempla `historialParametro`, que agregó HU-N-01) y `src/lib/claves-textos.test.ts` (1, timeout de 60 s; el mismo chequeo por CLI pasa). Son los mismos 3 que ya figuran en el informe de HU-I-06. |

---

## 5. Extras y violaciones

### 5.1 Implementado sin que la HU lo pida (todo aceptable)
- **Huella más estricta:** `CAJA_CAMBIO` también salta con una corrección o anulación de un pago de la caja, no solo con cobros, movimientos o ajustes nuevos.
- **Confirmación «sin diferencia»** cuando la caja cuadra (la HU solo da el ejemplo con faltante) y variantes por ausencia con el nombre del integrante.
- **Toasts** «Caja abierta correctamente», «Caja cerrada · faltante de $ N», «Caja de {integrante} cerrada por ausencia · …», «Movimiento registrado correctamente» y «Movimiento anulado correctamente».
- **Fórmula del esperado** escrita debajo del resumen y la marca «(no entra en el arqueo)» en las formas no efectivo.
- **Abrir caja exige la ficha de mesa de entrada activa** (`409 INTEGRANTE_INACTIVO`).
- **Filtro de integrantes del gerente** que incluye a los inactivos con cierres, y validación de rango «desde ≤ hasta».
- **Texto propio para `CAJA_NO_ABIERTA` en movimientos** («Tu caja se cerró. Recargá la pantalla para ver su estado.»), porque el del servidor habla de cobros.
- **`npm run caja:abrir`** (`scripts/caja-abrir.ts`, PR 0) sigue disponible para reabrir cajas de prueba.

### 5.2 Violaciones a RULES.md / DESIGN.md
- **Ninguna grave.** Regla N.° 1: no hay ningún `DELETE`. Regla N.° 3: nombres, alumnos y clases se leen por las fachadas (`obtenerNombresPersonal`, `obtenerAlumnosBasicos`, `obtenerClasesBasicas`) y HU-F-05 consume `caja.publico.ts`. Regla N.° 4: las rutas y los flujos son delgados y `caja.service.ts` no se modificó. Reglas N.° 5 y 6: se cumplen. Regla N.° 8: movimientos y pagos nunca se actualizan. Regla N.° 10: permisos granulares sembrados. Regla N.° 11: tipos en `src/types/caja.types.ts` y servicios en `src/server/pagos/`.
- **RULES.md, «Aplicación HU-I-12» (documental):** dice que la trazabilidad de la fila cubre «quién y cuándo abrió, **declaró** y cerró», pero `Caja` no tiene columnas para quién ni cuándo se declaró (`efectivoDeclarado` solo guarda el monto). Es la misma causa del PARCIAL del c10. Hay que corregir el texto o agregar el dato.
- **DESIGN.md §6.4, fila «Intento de cobro sin caja abierta» (línea 294, documental):** menciona el rechazo «dentro del modal «Registrar pago» del detalle de la clase», que ya no existe: el atajo navega al wizard `/pagos/registrar`. Es la misma observación del informe de HU-I-10.
- **DESIGN.md:** colores con tokens (`destructive`, `destructive-soft`, `success`, `warning`, `muted`), nunca hex; `Badge` de diferencia según §6.6; feedback por toast según §6.1, como dicen las filas 295 a 301.

### 5.3 Observación de producto para el PO (no es un defecto del código)
- **El arqueo ciego se puede «sondear» con egresos.** El c3 obliga a rechazar un egreso que supera el efectivo esperado. Un integrante podría registrar egresos de distintos montos (y anularlos después) para deducir cuánto efectivo debería haber antes de declarar. Cada intento exitoso queda registrado como movimiento y anulación, con usuario y fecha, así que es auditable. Lo dejo anotado por si el PO quiere que el gerente lo revise en los cierres.

---

## 6. Datos para la prueba manual

### 6.1 Usuarios (contraseña de todos: `Password123!`)

| Usuario | Rol | Para qué |
|---|---|---|
| `mesa.entrada@noctium.local` (Ruiz, Marta) | MESA_ENTRADA | Caja abierta por el seed (fondo $ 0) con muchos cobros por **Transferencia** (clases pasadas seed-turno-26 y 27, y los pagos históricos del fixture HU-H-06). Sirve para ver el arqueo ciego con muchos ítems y un resumen con formas que «no entran en el arqueo». También es la caja destino de ajustes del c4. |
| `mesa.entrada2@noctium.local` (Ferreyra, Pablo) | MESA_ENTRADA | El ciclo completo: cerrar → «No tenés una caja abierta» → abrir → cobrar → movimientos → cerrar. Y el cierre por ausencia. |
| `gerente@noctium.local` (Paredes, Silvia) | GERENTE | «Cierres de caja», filtros, detalle, imprimir, cierre por ausencia, corrección con caja de ajuste (c4), baja con caja abierta (c10). |
| `profesor1@noctium.local` / `alumno01@noctium.local` | PROFESOR / ALUMNO | 403 (snippet A). Navegar a `/caja` o `/cajas` los saca (proxy). |
| `f05.cajacerrada@noctium.local` (Prueba Baja, Tomás) | MESA_ENTRADA | Tiene un **cierre** del fixture HU-F-05 (cuadra en $ 0). Sirve como «cierre ajeno» para el snippet C y para el filtro por integrante. Nació con una contraseña temporal que no está en el seed: no lo uses para iniciar sesión. Para eso están los dos de arriba. |

> **Estado de la base:** según `HU-I-12-evidencia.md`, la corrida de Postman del dev **cerró las cajas originales del seed** (la de `mesa.entrada@` por ausencia, con un faltante de $ 48.000) y **abrió una caja nueva con fondo $ 0** para cada cuenta. La de HU-I-06 dejó además un ajuste de −$ 1.000 y correcciones de prueba. Antes de empezar, corré **Q1** para ver qué cajas están abiertas. Si una cuenta quedó sin caja: `npm run caja:abrir -- mesa.entrada2@noctium.local` (o abrila desde «Mi caja», que también es parte de la prueba). Si preferís empezar de cero, `npx prisma migrate reset` regenera todo con el seed, **pero borra todos los datos de la base local**.

### 6.2 Consultas de apoyo (TablePlus / psql, solo lectura)

**Q1. Cajas con su estado:**
```sql
SELECT c."idCaja", u."emailUsuario" AS integrante, c.estado, c."abiertaEl", c."fondoInicial",
       c."efectivoDeclarado", c."cerradaEl", c."porAusencia", cp."emailUsuario" AS cerrada_por,
       c."efectivoEsperado", c.diferencia, c.motivo
FROM cajas c
JOIN usuarios u ON u."idUsuario" = c."usuarioId"
LEFT JOIN usuarios cp ON cp."idUsuario" = c."cerradaPorUsuarioId"
ORDER BY c."abiertaEl" DESC;
```

**Q2. Contenido de una caja (para cotejar el resumen a mano):**
```sql
SELECT 'COBRO' AS tipo, o."registradaEl" AS momento, f."nombreFormaPago" AS forma, f."esEfectivo", p."montoPago" AS monto,
       (an."pagoId" IS NOT NULL) AS anulado
FROM operaciones_pago o JOIN pagos p ON p."operacionId" = o."idOperacionPago"
JOIN formas_pago f ON f."idFormaPago" = o."formaPagoId" LEFT JOIN anulaciones_pago an ON an."pagoId" = p."idPago"
WHERE o."cajaId" = '<idCaja>'
UNION ALL
SELECT 'MOV ' || m.tipo, m."createdAtMovimientoCaja", 'Efectivo', true, m.monto, (am."movimientoId" IS NOT NULL)
FROM movimientos_caja m LEFT JOIN anulaciones_movimiento am ON am."movimientoId" = m."idMovimientoCaja"
WHERE m."cajaId" = '<idCaja>'
UNION ALL
SELECT 'AJUSTE', a."createdAtAjusteCaja", f."nombreFormaPago", f."esEfectivo", a.monto, false
FROM ajustes_caja a JOIN formas_pago f ON f."idFormaPago" = a."formaPagoId"
WHERE a."cajaId" = '<idCaja>'
ORDER BY 2 DESC;
```
(Q2 muestra el monto **original** de cada pago. Si hubo correcciones, el vigente sale de `correcciones_pago`. El resumen de la pantalla usa el vigente.)

**Q3. Inmutabilidad del cierre (c8):** `SELECT resumen, "efectivoEsperado", diferencia FROM cajas WHERE "idCaja" = '<idCaja cerrada>';` antes y después de que el gerente corrija un pago de esa caja: no tiene que cambiar.

**Q4. Movimientos y su anulación (c3, Regla N.° 8):**
```sql
SELECT * FROM movimientos_caja ORDER BY "createdAtMovimientoCaja" DESC LIMIT 5;
SELECT * FROM anulaciones_movimiento ORDER BY "createdAtAnulacionMovimiento" DESC LIMIT 5;
```

### 6.3 Escenarios por criterio

| Criterio | Datos | Cómo probarlo |
|---|---|---|
| c1 (abrir) | `mesa.entrada2@` sin caja abierta (si tiene una, cerrala primero: es el c5) | «Mi caja» → «No tenés una caja abierta» → «Abrir caja» → probar `-5`, `abc`, `10,123` (error inline) → `0` → confirmación «¿Estás seguro de que querés abrir tu caja con un fondo inicial de $ 0?» → toast → cabecera «Caja abierta · Desde el … · fondo inicial $ 0». Q1: fila `ABIERTA` con `abiertaEl` y el usuario. |
| c1 (dos a la vez) | `mesa.entrada2@` **sin** caja abierta | En la consola: `const a = () => fetch("/api/cajas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fondo_inicial:"0"})}); for (const r of await Promise.all([a(),a()])) console.log(r.status,(await r.json()).error?.code);` → un `201` y un `409 CAJA_YA_ABIERTA`. Q1: una sola abierta. (**Este snippet sí abre una caja**: usalo como el paso de apertura.) |
| c1 (pasa la medianoche) | La caja abierta de `mesa.entrada@` (Q1: `abiertaEl` de días anteriores si no se reabrió hoy) | Registrar un cobro hoy en esa caja: entra sin problema y aparece en su lista. No hay ningún corte por día. |
| c2 (sin caja, los tres caminos) | `mesa.entrada2@` **sin** caja. Alumno **Martínez, Lucas** (reservas futuras en seed-turno-13 y 14) | (1) Menú «Registrar pago» → Martínez → una clase → Efectivo → «Registrar pago» → dentro de la confirmación: «No se puede registrar un cobro hasta que abras una caja.» y el botón «Abrir caja» → lleva a `/caja`. (2) Clases → seed-turno-14 (Física) → «Registrar pago» junto a Martínez → mismo resultado. (3) Inscripción con pago: en el detalle de una clase futura con el aviso de pago para inscribir, el enlace «Registrar pago» del alumno por inscribir → mismo resultado. Q2 / `SELECT count(*) FROM operaciones_pago`: no cambió. |
| c2 (caja de quien registra, por momento) | `mesa.entrada2@` con caja abierta | Registrar un pago en **Efectivo** con **fecha de pago de ayer** → en «Mi caja» aparece con la **hora actual** y en su caja (no en la de `mesa.entrada@`). Q2 sobre las dos cajas. |
| c3 (movimientos) | `mesa.entrada2@` con caja abierta y, por ejemplo, fondo $ 5.000 | «Registrar movimiento» → Ingreso $ 1.000 «Ingreso de cambio para la caja» → confirmación → toast. Egreso $ 2.000 «Retiro para comprar insumos» → OK. Egreso de $ 900.000.000 → «El egreso supera el efectivo de la caja.» (sin mostrar cuánto hay). Concepto vacío o de más de 200 caracteres: no deja. Monto 0: no deja. «Anular» el ingreso → motivo obligatorio → confirmación irreversible → la fila queda «Anulado» con el monto tachado y sin «Anular». Q4: la fila original de `movimientos_caja` está intacta y hay una nueva en `anulaciones_movimiento`. |
| c4·a (caja abierta) | `mesa.entrada2@` con un cobro propio en Efectivo | Corregir el monto de ese pago (HU-I-06) → «Mi caja» muestra el monto nuevo → al cerrar, el resumen usa el vigente. |
| c4·b (caja cerrada → ajuste) | Cerrar la caja de `mesa.entrada2@` con ese cobro adentro. `mesa.entrada@` con caja abierta | `mesa.entrada2@` o `mesa.entrada@`: el pago ya no tiene «Corregir» ni «Anular». `gerente@`: Corregir el monto (o anular con «Reintegro») → confirmar → aparece «Caja abierta donde registrar el ajuste» → elegir la de Ruiz, Marta → «Reintentar con esta caja» → toast. `mesa.entrada@` → «Mi caja»: aparece «Ajuste por corrección» / «Ajuste por anulación». Q3 sobre la caja cerrada: el `resumen` no cambió. |
| c4·b (sin ninguna caja abierta) | Cerrá también la de `mesa.entrada@` (o hacé cierre por ausencia), sin cajas abiertas en Q1 | `gerente@` corrige el monto de un pago de una caja cerrada → dentro de la confirmación: «Para registrar este cambio tiene que haber una caja abierta en mesa de entrada.» y «No hay ninguna caja abierta en mesa de entrada.» → no se registra nada (Q2 de HU-I-06: sin `correcciones_pago` nuevas). Al terminar, reabrí las cajas. |
| c5 (arqueo ciego y dos pasos) | `mesa.entrada2@` con cobros, movimientos y (si hay) un ajuste | «Mi caja»: sin ningún total. Snippet D. «Cerrar caja» → paso 1 sin totales → montos inválidos (−1, texto) → declarar → paso 2 con el resumen. Cerrar el diálogo con «Volver» y reabrir «Cerrar caja»: entra directo al paso 2 con el mismo declarado. |
| c5 (la caja cambió) | Mismo usuario, **dos pestañas** | Pestaña A: llegar al paso 2. Pestaña B (`/caja`): «Registrar movimiento» ingreso $ 500. Pestaña A: «Cerrar caja» → confirmar → «La caja cambió mientras cerrabas. Revisá el resumen.», esperado recalculado (+$ 500), mismo declarado, no cerró (Q1 sigue `ABIERTA`) → volver a confirmar → cierra. Probar también con un cobro en la pestaña B. |
| c6 (resumen) | Caja con cobros en Efectivo, Transferencia y Débito, un ingreso, un egreso y (opcional) un ajuste | Comparar el paso 2 contra Q2: «Cobros en Efectivo · N pagos» con su total, las otras formas con «(no entra en el arqueo)», ingresos, egresos, ajustes y efectivo esperado = fondo + cobros en efectivo + ingresos − egresos ± ajustes en efectivo. |
| c7 (diferencias) | Ídem | Declarar menos que el esperado → «Faltante de $ N», motivo obligatorio (vacío no deja, más de 300 no entra). Otra caja con más → «Sobrante de $ N». Otra igual → «La caja cuadra» con «Observación · Opcional» (cierra sin escribir nada). Q1: `diferencia` con signo y `motivo`. |
| c8 (cierre, inmutable, imprimir) | Una caja cerrada en el paso anterior | Confirmación con faltante de $ 1.500 (declarar $ 1.500 menos que el esperado) → texto idéntico a la HU con «Esta acción no se puede deshacer.» → toast → «No tenés una caja abierta». «Mis cierres» → «Ver cierre» → «Imprimir» → la vista previa muestra solo el cierre (centro, integrante, apertura y cierre, resumen, diferencia, motivo, «Impreso el …»), sin menú → «Guardar como PDF». `gerente@` → `/cajas/[id]` → lo mismo. Q3 antes y después de corregir un pago de esa caja. Snippet: `POST /api/cajas/mia/movimientos` con la sesión del integrante sin caja → `409 CAJA_NO_ABIERTA`. |
| c9 (cobro y cierre a la vez) | `mesa.entrada2@`, dos pestañas | Pestaña A: «Registrar pago» hasta la confirmación, **sin** tocar «Registrar pago». Pestaña B: cerrar la caja completa. Pestaña A: «Registrar pago» → no se registra y ofrece «Abrir caja». **Vas a ver «No se puede registrar un cobro hasta que abras una caja.», no «Tu caja se cerró…»** (DESVÍO menor del c9). El caso exacto de la HU (los dos en el mismo instante) solo se reproduce en la prueba automática `caja.service.pg.test.ts:130`, que está en verde. |
| c10 (abiertas, baja, ausencia) | `gerente@`; caja abierta de `mesa.entrada2@` | «Cierres de caja» → «Cajas abiertas» con «Abierta desde» y «Antigüedad» (sin montos). Personal → Ferreyra, Pablo → «Desactivar» → «No se puede desactivar al integrante» + «Ir a Cierres de caja». «Cierre por ausencia» en la fila de Ferreyra → «Cierre por ausencia de Ferreyra, Pablo · paso 1 de 2» → declarar → paso 2 → confirmar («…cerrar la caja de Ferreyra, Pablo con…») → toast. En «Cierres»: `Badge` «Por ausencia». En el detalle: «Cierre por ausencia, hecho por Paredes, Silvia». Q1: `porAusencia = true`, `cerrada_por` = gerente. Por API: snippet C (mesa → 403). |
| c10 (caso borde del PARCIAL) | `mesa.entrada2@` con caja abierta | `mesa.entrada2@` → «Cerrar caja» → declarar $ 100 → «Volver» (no confirma). `gerente@` → «Cierre por ausencia» de Ferreyra → declarar $ 999 → **el paso 2 muestra «Efectivo declarado $ 100»**, sin aviso. Es lo que decide el PO (§1). |
| c11 (consultas y paginación) | Hacen falta **más de 10 cierres**. Ver el script de §6.4 | `mesa.entrada2@` → «Mis cierres» de a 10 con paginación. `gerente@` → «Cierres» de a 10; filtro por integrante (selector) y por fechas de cierre desde/hasta (probar «desde» > «hasta» → aviso); «Limpiar filtros». Snippets A, B y C. |

> Las fechas exactas de las clases dependen del día en que se corrió el seed (`diaOperativo` se cuenta desde esa fecha). Usá el listado de Clases para ubicarlas.

### 6.4 Script de una sola vez: generar cierres para probar la paginación (c11)

No toca código del proyecto: usa los mismos servicios de dominio que el seed (`abrirCaja`, `declararEfectivo`, `cerrarCaja`), con todas sus reglas. **Escribe en tu base local**, así que corrélo solo en desarrollo. Guardalo como `scripts/tmp-cierres-hu-i-12.ts` (no lo commitees; borralo al terminar). La cuenta **no puede tener una caja abierta**: cerrala antes desde la pantalla.

```ts
// npx tsx scripts/tmp-cierres-hu-i-12.ts mesa.entrada2@noctium.local 11
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { abrirCaja, cajaAbiertaDe, cerrarCaja, declararEfectivo } from "../src/server/pagos/caja.service";
import { transaccion } from "../src/server/shared/transaccion";

async function main() {
  const email = process.argv[2] ?? "mesa.entrada2@noctium.local";
  const veces = Number(process.argv[3] ?? 11);
  const { idUsuario } = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: email } });
  if (await cajaAbiertaDe(prisma, idUsuario)) throw new Error(`${email} tiene una caja abierta: cerrala antes`);
  for (let i = 0; i < veces; i++) {
    const caja = await transaccion((tx) => abrirCaja(tx, { usuarioId: idUsuario, fondoInicial: "1000.00" }));
    const declarado = ["1000.00", "900.00", "1100.00"][i % 3]; // cuadra / faltante / sobrante
    const { huella } = await transaccion((tx) => declararEfectivo(tx, { cajaId: caja.id, usuarioId: idUsuario, efectivoDeclarado: declarado }));
    await transaccion((tx) => cerrarCaja(tx, {
      cajaId: caja.id, usuarioId: idUsuario, huella, motivo: declarado === "1000.00" ? null : `Prueba de paginación HU-I-12 n.° ${i + 1}`,
    }));
  }
  console.log(`${veces} cierres creados para ${email}. Abrí una caja nueva desde «Mi caja» para seguir cobrando.`);
}

main().finally(() => prisma.$disconnect());
```

Todos los cierres quedan con la fecha de hoy. Para probar el rango de fechas, filtrá «desde = hoy» (aparecen) y «hasta = ayer» (no aparecen, salvo cierres de días anteriores).

---

## 7. Veredicto preliminar

### ✅ **Lista para prueba manual**

**Bloqueantes:** ninguno.

**Para que decida el PO antes o durante la prueba manual:**
1. **c10, PARCIAL:** en el cierre por ausencia, si el integrante ya había declarado el efectivo, el conteo del gerente se descarta en silencio y se usa el del integrante. A la inversa, el integrante puede terminar como cierre propio un conteo que hizo el gerente. Decidir si se acepta como limitación conocida (como propone la task) o si se pide al menos un aviso en la UI.
2. **c9, DESVÍO menor:** «Tu caja se cerró. Abrí una caja nueva para registrar el cobro.» solo aparece en la carrera exacta. En el caso real se ve «No se puede registrar un cobro hasta que abras una caja.». El resultado es correcto (no registra y ofrece «Abrir caja»). Decidir si alcanza.
3. **DoD HU-C-25:** el paso 1 del cierre guarda el efectivo declarado (irreversible) sin el diálogo común de confirmación. Decidir si el botón «Confirmar efectivo contado» cuenta como confirmación o si se pide el `ConfirmarAccionDialog`.

**No bloqueantes (para una próxima vuelta del dev):**
4. Centralizar `MENSAJE_ERROR_GENERICO` en `textos.ts` (`cerrar-caja-dialog.tsx:15`, `caja/enviar-movimiento.ts:4`; misma observación que en HU-I-10 y HU-I-06).
5. `RULES.md` «Aplicación HU-I-12»: corregir «quién y cuándo… declaró» (no se guarda) o agregar ese dato al resolver el punto 1.
6. `DESIGN.md` §6.4, línea 294: quitar la mención al modal «Registrar pago» del detalle de la clase, que ya no existe.
7. Informativo: el rechazo de egresos permite deducir el efectivo esperado probando montos (§5.3). Es inherente al c3 y queda auditado.
