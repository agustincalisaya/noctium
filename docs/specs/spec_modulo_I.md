# Especificación Técnica — Módulo I (Pagos)
## Noctium — Sprint 2 · Sprint 3 (Revisión 3)
## Revisión 2 — precisiones de HU-I-03 sobre la versión del 29/09/2026 (conserva HU-I-01)

## Revisión 3 — Sprint 3: registro de pago por operación (HU-I-10), comprobante (HU-I-11), caja con arqueo ciego (HU-I-12), historial de pagos del alumno (HU-I-02), corrección y anulación (HU-I-06), «Mis pagos» (HU-I-05) y formas de pago modificables (HU-I-07)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod · NextAuth
**Referencias normativas (Revisión 3):** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11) · Backlog del Sprint 3 (v18, 06/10/2026; convenciones 4, 5, 8 a, 8 b, 8 i y 9, y las HU-I-10, I-11, I-12, I-02, I-06, I-05 e I-07) · `PR-0.md` §1.1 (principio de compatibilidad), §2.1 a §2.6, §2.9, §2.10, §2.13, §2.15 y §2.16 · `spec_modulo_C.md` Revisión 6 (§2.15, §2.16 a §2.20) · `spec_modulo_L.md` Revisión 3 (§2.10, tarifas) · `spec_modulo_F.md` §2.7 · `spec_modulo_B.md` §2.7 y §2.8 · `schema.prisma` · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-13, P-28, P-30, P-34, P-35, P-36, M-31 a M-37 y DEC-21 a DEC-34) · `docs/DESIGN.md` §6

**HU contractualizadas en la Revisión 3 (Sprint 3):** HU-I-10 (Registrar pago buscando al alumno), HU-I-11 (Emitir comprobante de pago), HU-I-12 (Abrir y cerrar mi caja con arqueo ciego), HU-I-02 (Ver el historial de pagos del alumno), HU-I-06 (Corregir o anular un pago registrado), HU-I-05 (Consultar propio historial de pagos) y HU-I-07 (Modificar, desactivar y reactivar forma de pago).

**Fuera de esta spec (explícito):** HU-C-23 (textos centrales) y HU-C-25 (confirmación de cada operación) son transversales: esta spec indica qué operaciones confirman y qué datos lleva cada confirmación, pero los textos viven en el archivo central de HU-C-23 y donde esta spec cita un texto de pantalla prevalece ese archivo. HU-C-19 cambia solo la capa de presentación («turno» → «clase»): los `code`, las rutas y los nombres de campo de este módulo conservan «turno» (HU-C-19, criterio 3). Esta spec usa «turno» para el dato y la regla, y «clase» para lo que se muestra (convención 2 del backlog). No se contractualiza el envío del comprobante por email (HU-I-11, criterio 6), el pago en línea ni el reparto de una operación entre varias formas de pago (HU-I-10, criterio 5). La asistencia, el historial académico y los indicadores no viven en este módulo; sus lecturas de pagos usan las funciones públicas de 2.17.

**Regla del equipo (08/10/2026) — nada de lo ya desarrollado se rompe.** El Sprint 3 se acomoda a lo que se hizo en los Sprints 1 y 2, no al revés. Esta revisión es **aditiva**: no renumera, no reescribe las secciones anteriores (solo les agrega una nota de «Revisión 3») y no cambia ningún contrato HTTP de Sprint 2, salvo por las condiciones nuevas que manda el backlog y que figuran, una por una, en la tabla de abajo.

| Lo que ya existe | Qué se conserva | Qué cambia (y quién lo manda) |
|---|---|---|
| 2.1 `POST /api/formas-pago` | Ruta, cuerpo, respuesta, `code` | La forma nace con `esEfectivo = false` (`PR-0.md` §2.5); no es un campo de la API. Confirmación previa (DEC-29): es solo de la interfaz |
| 2.2 `GET /api/formas-pago` y `/opciones` | Ruta, parámetros, orden, respuesta | Nada. Una forma inactiva sigue en el listado y sale de las opciones (HU-I-07, criterio 4) |
| 2.3 funciones públicas | Firma y forma del resultado de cada función | Cambia el **origen** del dato: monto vigente (con correcciones) y sin anulados (T4 y T5). Funciones nuevas en 2.17 |
| 2.4 `POST /api/pagos` | Ruta, cuerpo (campos opcionales nuevos), respuesta `201` con `PagoRegistrado`, `code` y HTTP de cada error, **y el comportamiento de Sprint 2** (admite clases ya iniciadas, pagos parciales e importes distintos del precio sin motivo): el endpoint conserva siempre el modo `compatSprint2` (T1, T2 y P-I1) | **Único cambio:** exige una caja abierta del usuario (`409 CAJA_NO_ABIERTA`, HU-I-12 criterio 2; lo manda el backlog y figura en `PR-0.md` §1.1; el seed deja una caja abierta por cuenta de mesa de entrada). Las reglas nuevas de HU-I-10 rigen en el endpoint nuevo `POST /api/pagos/operaciones` (2.7), no en este |
| 2.5 `GET /api/pagos/opciones` | Ruta, parámetro, `alumnos`, `formas_pago`, `preseleccionar_alumno_id` | Los alumnos son los de inscripción **vigente**; campos opcionales nuevos por alumno (2.8) |
| Permisos `pagos:crear`, `pagos:leer`, `formas_pago:crear`, `formas_pago:leer` | Roles y significado | Permisos nuevos (2.6.3), propuestos para la tabla cerrada del PR 0 |
| Modelo `Pago` | `turnoId`, `alumnoId`, `montoPago`, `formaPagoId`, `fechaPago`, `creadoPorUsuarioId` y `createdAtPago`, inmutables y **con el mismo significado** | El `Pago` solo **suma** el vínculo con su operación y con su inscripción, el precio y el ajuste (`PR-0.md` §2.3; T6 y P-I2). Los valores vigentes salen de los registros de corrección y anulación |
| Pantalla «Pagos registrados» del detalle (C §2.4) | Lista con alumno, fecha, monto y forma de pago; «Total registrado» | Los pagos anulados se muestran con la etiqueta «Anulado» y no suman; acciones «Corregir», «Anular» y comprobante. Mientras no haya anulaciones, la pantalla se ve igual (`PR-0.md` §1.1, regla 5) |

**Contradicciones entre Sprint 2, el backlog y el PR 0, y cómo se resuelven.** Ninguna obliga a romper un contrato antes de que lo mande una HU; las que siguen son de reglas internas o de redacción.

| # | Contradicción | Resolución |
|---|---|---|
| T1 | 2.4 paso 2 y Q6a (aprobada por el PO el 29/09) admiten registrar un pago en un turno vencido; HU-I-10 (criterios 3 y 7) y HU-C-22 (criterio 4) dicen que el pago se hace **antes** de la clase | Se resuelve a favor de lo existente: `POST /api/pagos` **conserva siempre** el cobro de Sprint 2 (modo `compatSprint2` del PR 0, que no se elimina al mergear HU-I-10). «Antes de la clase» rige en el flujo de HU-I-10 (`POST /api/pagos/operaciones`), que es el que usa la interfaz (P-I1). Q6a se conserva para el endpoint de Sprint 2. Es la misma salvedad que `spec_modulo_C.md` anotó en T3 y P-C7 |
| T2 | 2.4 paso 5 y HU-I-01 AC3 admiten **varios pagos** (parciales) de un mismo alumno en un turno; HU-I-10 (criterio 3) dice que una clase se paga una sola vez | Igual que T1: `POST /api/pagos` sigue admitiendo pagos parciales. En el flujo de HU-I-10 una inscripción con un pago no anulado está pagada (3.8). En ambos, una inscripción con al menos un pago no anulado figura «Pagada» |
| T3 | 3.6 y «Fuera de alcance» dicen que un pago no se edita ni se anula y que no existen rutas de edición ni de baja | Manda el backlog (HU-I-06) **sin tocar la Regla N.° 8**: el pago original nunca se actualiza ni se borra; la corrección y la anulación son registros nuevos que lo referencian, y se agregan rutas que los crean (2.14). Q6c queda cumplida por esta HU |
| T4 | 2.3 `listarPagosDeTurno` devuelve «todos los pagos» y el detalle de C §2.4 los suma | La función conserva firma y forma y devuelve los pagos **no anulados** con el monto vigente. Para mostrar los anulados con su etiqueta (HU-I-06, criterio 4) se agrega `listarPagosDeClase` (2.17); el detalle de la clase lo adopta cuando se mergee HU-I-06 |
| T5 | 2.3 `sumarPagosPorMes` suma todos los pagos por el mes de `fechaPago` | Conserva firma y forma. Suma el monto vigente de los pagos no anulados, por la fecha de pago vigente de su operación (HU-H-06: «con el monto vigente de cada pago y sin los anulados»). Sin correcciones ni anulaciones da el mismo resultado de hoy |
| T6 | El `Pago` de Sprint 2 guarda `formaPagoId`, `fechaPago` y `creadoPorUsuarioId`; el PR 0 (§2.3) los pasa a la operación, y su §2.0 dice que los lectores de `Pago` «siguen compilando» | No pueden las dos cosas a la vez; se resuelve a favor de lo existente: el `Pago` **conserva** las tres columnas (los valores originales, inmutables) y la operación guarda los mismos valores como base de las correcciones; `registrarOperacion` escribe ambos en la misma transacción. Los lectores de Sprint 2 (`listarPagosDeTurno`, `sumarPagosPorMes`) siguen compilando y solo cambian por dentro para usar el valor vigente y excluir anulados (R3-PR0-2). Sus tests cambian solo en la persistencia que mockean y se anotan en «Decisiones tomadas» (`PR-0.md` §1.1, regla 3) |
| T7 | 2.4 pasos 1 y 3 bloquean el turno con `FOR SHARE` (`bloquearTurnoParaOperacion`) y validan contra `alumno_ids`; el PR 0 fija un orden de bloqueo único (recurso → clase → inscripción → operación → caja) y que el cobro bloquee la inscripción | Se usa `bloquear(...)` en el orden canónico. La garantía de 2.4 paso 1 (una cancelación concurrente no deja un pago sobre una clase cancelada) se conserva: la clase queda bloqueada con `FOR UPDATE`, que también la cubre (3.11) |
| T8 | 2.4 paso 3 no exige que el alumno esté activo («el pago es un hecho consumado»); HU-I-10 (criterio 2) ofrece solo alumnos activos | Las dos valen: el **buscador** solo ofrece activos; el cobro de una inscripción **ya vigente** no exige que el alumno siga activo (HU-B-07 finaliza las inscripciones de un alumno dado de baja). Para «Se inscribe al confirmar el pago» sí se exige (`crearInscripcion`, `ALUMNO_INACTIVO`) |
| T9 | §4 dice «no existe tabla de eventos de Pagos» y que se pasaría a la opción (b) si Sprint 3 agregaba anulaciones | Se cumple la previsión de §4: correcciones, anulaciones, movimientos, ajustes y cierres son **registros propios** con usuario y fecha (opción (a), cada registro es la traza); la baja de formas de pago y los cambios de estado de la inscripción usan el historial de estados (opción (b), `PR-0.md` §2.13 y §2.16). Ver la nota de §4 |
| T10 | «Fuera de alcance» excluye el estado de cuenta, la pantalla global de pagos, el precio por materia y los comprobantes | Superado por el backlog: HU-I-10 agrega la pantalla «Registrar pago» (no un listado global), HU-L-06 el precio por materia (que **precarga** el importe y no valida contra un total esperado), HU-I-11 los comprobantes. HU-I-02 **no** tiene estado de cuenta ni saldo (criterios 1 y 5). El envío por email sigue fuera |
| T11 | `PR-0.md` §2.13 ubica `marcarPagada` y `recalcularEstadoPago` en el módulo C, pero «Pagada ⇔ al menos un pago no anulado» exige contar `pagos` | La Regla N.° 3 impide que C lea las tablas de Pagos. Se pide que las dos reciban de I el conteo de pagos no anulados (R3-PR0-3). Quien las llama es siempre el servicio de pagos |
| T12 | HU-I-12 usa dos textos para «sin caja» (criterio 2: «No se puede registrar un cobro hasta que abras una caja.»; criterio 9: «Tu caja se cerró. Abrí una caja nueva para registrar el cobro.») | Es **una sola condición** del servidor: no hay caja abierta del usuario al confirmar. Un único `code` (`409 CAJA_NO_ABIERTA`); la interfaz elige el texto según el contexto: sin caja al entrar (modal M-37) o caja cerrada durante la confirmación (P-I6) |
| T13 | HU-I-12 (criterio 4) y HU-I-06 (criterio 5) dicen que con la caja del pago cerrada solo el gerente cambia el pago; el prototipo deja a mesa de entrada registrar el ajuste en su caja | Manda el backlog (DEC-34): mesa de entrada no ajusta pagos de cajas cerradas (403 `FUERA_DE_ALCANCE`) |
| T14 | HU-I-10 (criterio 4) pide un importe «positivo (validación de HU-I-01)»; el precio de la clase es un entero en pesos y el monto del `Pago` tiene dos decimales | El monto cobrado conserva la validación de 2.4 (hasta 9 enteros y 2 decimales); el precio se compara como número: «distinto del precio» significa `monto ≠ precio` (3.12) |

**Changelog de la Revisión 3 (trazabilidad Backlog → Spec):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| Modelo de pagos del Sprint 3 | `Pago` con forma, fecha y usuario; sin operación, comprobante ni caja | Nueva 2.6: operación, pago, correcciones, anulaciones, comprobante, caja, movimientos y ajustes (lo crea el PR 0); permisos propuestos |
| HU-I-10 | Sin contrato (el pago se registraba desde el detalle de la clase, 2.4) | Nueva 2.7: buscar alumno, clases pendientes y registro de la operación |
| HU-I-01 (atajo) | 2.4 y 2.5 | Nueva 2.8: el atajo del detalle pasa por la misma operación; qué hace `POST /api/pagos` antes y después de HU-I-10 |
| HU-I-11 | Sin contrato | Nueva 2.9: comprobante, numeración, marcas «ANULADO» y «Reemplazado por», vistas por rol |
| HU-I-12 | Sin contrato | Nuevas 2.10 (abrir, movimientos, consulta propia), 2.11 (cierre con arqueo ciego) y 2.12 (cajas del gerente y cierre por ausencia) |
| HU-I-02 | Sin contrato (HU-I-04 y estado de cuenta, fuera de alcance de Sprint 2) | Nueva 2.13: historial de pagos del alumno, filtros y modo «estado de pago» |
| HU-I-06 | Diferida por Q6c | Nueva 2.14: corregir y anular, alcance por rol y antigüedad, ajustes de caja |
| HU-I-05 | Sin contrato | Nueva 2.15: «Mis pagos» |
| HU-I-07 | Fuera de alcance de 2.1 y 2.2 | Nueva 2.16: modificar, desactivar y reactivar |
| §2.3 funciones públicas | Cuatro funciones de lectura de Sprint 2 | Notas de Revisión 3 y nueva 2.17: funciones nuevas |
| §3 Reglas | 3.1 a 3.7 | + 3.8 a 3.17 al final del bloque, sin renumerar. Notas en 3.4, 3.6 y 3.7 |
| §4 Trazabilidad | Opción (a), sin eventos | Nota de Revisión 3 |
| §5 Puntos abiertos | Q6a a Q6d | Nota: Q6c queda cumplida por HU-I-06; Q6a se conserva para `POST /api/pagos` |

**Puntos abiertos de la Revisión 3 — resueltos por el Scrum Master el 08/10/2026.** Cada fila describe la opción elegida; la columna final indica a quién se le informa la decisión (si cambia algo para el PO o para otro módulo, se le avisa antes del merge de la HU).
| # | Decisión | Se informa a |
|---|---|---|
| P-I1 | **`POST /api/pagos` no cambia.** Por la regla del equipo, el endpoint de Sprint 2 conserva **siempre** su comportamiento (clases iniciadas, pagos parciales, importe libre), en el modo `compatSprint2` del PR 0, que HU-I-10 **no** elimina. Las reglas de HU-I-10 (criterios 3, 4 y 7) las aplica el endpoint nuevo `POST /api/pagos/operaciones`, que es el que usan las dos pantallas de cobro (P-30 y el atajo M-31). Ningún test ni caso de Postman de Sprint 2 cambia. Riesgo que se acepta: quien llame a la API de Sprint 2 directamente puede cobrar lo que HU-I-10 no deja cobrar desde la pantalla; si el PO lo quisiera cerrar, sería una decisión suya que rompe esos tests y no se toma acá | PO (informativo) |
| P-I2 | **Columnas del `Pago`: se conservan.** `PR-0.md` §2.3 mueve `formaPagoId`, `fechaPago` y `creadoPorUsuarioId` a la operación; esta spec pide lo contrario para no tocar el código de Sprint 2: el `Pago` las conserva (originales, inmutables) y la operación guarda los mismos valores como base de las correcciones (T6). Se corrige en el PR 0 v20 | SM |
| P-I3 | **Ajustes de caja por cambio de forma de pago** (HU-I-12, criterio 4). El backlog dice que «el dinero que se mueve» se registra como ajuste en una caja abierta, pero no dice cómo se rinde un cambio de forma (por ejemplo, de Efectivo a Transferencia). Esta spec registra **un par de ajustes** en la caja elegida: `−monto` en la forma anterior y `+monto` en la nueva; solo cuenta para el arqueo el que cae en una forma de efectivo. Si el PO quiere otro tratamiento, cambia 2.14.4 y el resumen de 2.11 | PO |
| P-I4 | **Nombres propuestos:** permisos `pagos:corregir`, `pagos:leer_propios`, `comprobantes:leer`, `comprobantes:leer_propios`, `cajas:abrir`, `cajas:movimiento`, `cajas:cerrar`, `cajas:leer`, `cajas:leer_todas`, `cajas:cerrar_ausencia`, `formas_pago:editar` y `formas_pago:desactivar`, y las rutas de 2.7 a 2.16. Los fija la tabla cerrada de `PR-0.md` §2.9 y `rutas-por-rol.ts` | SM |
| P-I5 | **Criterio del buscador de HU-I-10.** El backlog dice «mismo criterio que HU-B-05» (varias palabras). `buscarAlumnosActivos` (B §2.7) busca hoy el texto completo contra un solo `OR` y con «juan perez» no encuentra nada. Mismo asunto que P-C6 de `spec_modulo_C.md`: se pide a B que `buscarAlumnosActivos` adopte `construirFiltroBusquedaAlumno` (opción (a) de B §2.7, con su test actualizado) | SM, dueño de B |
| P-I6 | **Dos textos, un solo error de caja** (T12). La interfaz decide el texto: sin caja al entrar al flujo → M-37 con el texto del criterio 2; caja cerrada mientras se confirmaba → texto del criterio 9 en la misma confirmación. El `message` de la API es siempre el del criterio 2 | SM |
| P-I7 | **Tope técnico de 50 clases por operación.** El backlog no fija un máximo; el tope protege la lista de bloqueos (3.11). Un alumno con más de 50 reservas pendientes cobra en dos operaciones | SM |
| P-I8 | **Anulación de pagos por «Reintegro».** El backlog pide el motivo «Reintegro» al devolver dinero (HU-I-06, criterio 6; HU-C-14, criterio 7). El servidor no trata ese motivo de forma especial; la interfaz lo precarga | PO |
| P-I9 | **Lecturas nuevas en la fachada de C.** El historial de 2.13 necesita los datos de muchas clases a la vez (fecha, hora, materia, profesor). Se agrega `obtenerClasesBasicas(turnoIds, db?)` a `turno.publico.ts` (2.17), en la misma fachada y en el PR de HU-I-02, como ya prevé `PR-0.md` §2.13 para las lecturas que una HU necesite. No cambia ninguna firma existente | SM, dueño de C |

**Pedidos al PR 0 (surgen de esta revisión; el PR 0 se actualiza una vez, con todas las specs listas):**
| # | Pedido | Dónde |
|---|---|---|
| R3-PR0-1 | `registrarOperacion` con el contrato de 2.7.4: cada ítem es `{ inscripcionId }` o `{ crearInscripcion: { turnoId } }`, más `monto` y `motivoAjuste?`; recibe `modo: "completo" \| "compatSprint2"`; devuelve la operación, los pagos creados y el comprobante. **`compatSprint2` es permanente**: lo usa solo `POST /api/pagos` y HU-I-10 no lo elimina (el PR 0 v19 dice lo contrario en §2.13 y §2.15: se corrige en v20). Para el ítem de «Se inscribe al confirmar el pago» obtiene la tarifa con `obtenerTarifasPorIds` (`spec_modulo_L.md` §2.10) y calcula con `precioClase` | 2.7.4; `PR-0.md` §2.13 y §2.15 |
| R3-PR0-2 | Resolver T6 sin tocar los lectores de Sprint 2 más de lo necesario: el `Pago` conserva `formaPagoId`, `fechaPago` y `creadoPorUsuarioId`; `listarPagosDeTurno`, `sumarPagosPorMes`, `turno.detalle.ts` e `indicadores.service.ts` conservan firma y forma y solo suman el valor vigente (correcciones) y la exclusión de anulados, leyendo los registros nuevos; índice en la operación por `(alumnoId, fechaPago)` para `listarPagosDeAlumno` | 2.6, 2.17; `PR-0.md` §2.0 y §2.3 |
| R3-PR0-3 | `marcarPagada` y `recalcularEstadoPago` reciben el conteo de pagos no anulados de la inscripción, calculado por el servicio de pagos, en lugar de leer `pagos` (Regla N.° 3) | 3.8; `PR-0.md` §2.13 |
| R3-PR0-4 | `ErrorDeDominio` con los `code` y HTTP de 2.7.6, 2.10.5, 2.14.5 y 2.16.4; los textos son los literales de los criterios, y los códigos de Sprint 2 conservan su texto de hoy. `errores.transaccion.ocupada` mapea a `409 TRANSACCION_OCUPADA` | 2.7.6 y siguientes; `PR-0.md` §2.13 |
| R3-PR0-5 | Tabla cerrada de permisos con los nombres de 2.6.3, las rutas de 2.7 a 2.16 en `rutas-por-rol.ts` y en el `matcher` del proxy (`/pagos/registrar`, `/caja`, `/cajas`, `/mis-pagos`, `/alumnos/[id]/pagos`) | 2.6.3; `PR-0.md` §2.9 |
| R3-PR0-6 | `Caja.efectivoDeclarado` admite vacío y `cerrarCaja` lo toma de la fila; se agregan `declararEfectivo` (guarda el monto solo si está vacío y la caja está abierta) y `calcularResumen` (devuelve el resumen y la huella; la huella incluye también las correcciones y anulaciones de pagos de la caja). El mapa los atribuye a HU-I-12 (DEC-24); basta con que el esquema los admita | 2.11; `PR-0.md` §2.5 y §2.13 |
| R3-PR0-7 | Contrato Zod del JSON `datos` del comprobante con los campos de 2.9.2 | 2.9.2; `PR-0.md` §2.3 |
| R3-PR0-8 | `registrarAjuste` recibe un par de ajustes para el cambio de forma de pago (P-I3) y el monto con signo; el efectivo esperado suma solo los ajustes de formas con `esEfectivo` | 2.14.4; `PR-0.md` §2.5 y §2.13 |
| R3-PR0-9 | `bloquear` admite el nivel «formas de pago» (todas las activas, por id) para HU-I-07, criterio 6; mientras no se combine con otros bloqueos, va antes que todo | 2.16.3; `PR-0.md` §2.10 y §2.16 |
| R3-PR0-10 | La prueba de equivalencia de «Pagada» cubre también la corrección y la anulación hechas por los servicios, y una prueba de contrato del envoltorio `POST /api/pagos` en los dos modos | 2.8; `PR-0.md` §4 |
| R3-PR0-11 | Lecturas públicas de pagos y de cajas de 2.17, con sus pruebas, y `usuarioRegistroOperaciones` de I para el agregador de `spec_modulo_F.md` (DEC-39) | 2.17; `PR-0.md` §2.13 |

**Efectos en otras specs (se anotan al escribirlas o corregirlas):** `spec_modulo_A.md` (§2.4: permisos de 2.6.3 y rutas por rol), `spec_modulo_B.md` (`contarAlumnosConFormaPagoPreferida` para el aviso de HU-I-07; `buscarAlumnosActivos` con el criterio de P-I5; la preferida inactiva se muestra con «Inactiva»; la pestaña Pagos de la ficha vive en I), `spec_modulo_C.md` (§2.4: `pagos` del detalle con `listarPagosDeClase`; `acciones_habilitadas.registrar_pago` **conserva siempre** la condición de Sprint 2 y el atajo usa el campo nuevo `puede_registrar_pago`; el filtro por estado de pago de `listarInscripcionesDeAlumno` y la lectura en lote nueva `obtenerClasesBasicas`, P-I9), `spec_modulo_E.md` (la pestaña Pagos de la ficha del alumno es de I, con acceso del gerente de HU-E-02, criterio 8), `spec_modulo_H.md` (el ingreso por mes es `sumarPagosPorMes` vigente), `spec_modulo_F.md` (`cajaAbiertaDe`, `usuarioRegistroOperaciones` y `bloquearIntegranteActivo`, ya citadas en su 2.7).

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` (§2.3, forma de pago preferida) · `spec_modulo_C.md` Revisión 5 (§2.4 detalle de turno, §2.15 servicios públicos) · `spec_modulo_K.md` y `spec_modulo_L.md` (patrón de catálogo y unicidad) · `schema.prisma` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§1, §2, §4) · `docs/DESIGN.md` §6

**HU contractualizadas en la spec:** HU-I-03 (Registrar y listar formas de pago del centro), HU-I-01 (Registrar pago) — Sprint 2.

**Nota aditiva de sincronización HU-I-01 (01/10/2026):** el modelo `Pago`, sus relaciones y permisos ya existen en la migración `20260928150100_sprint2_modelo` y el seed vigente; HU-I-01 no crea otra migración. Se reutiliza `listarPagosDeTurno()` de la fachada `pago.publico.ts` ya integrada en develop por HU-C-09: consume B en lote y no importa Turnos, conservando el aislamiento sin ciclo C → I → C. La ruta de detalle existente comprueba `pagos:leer` antes de pedir la lista y omite por completo `pagos` para el Profesor. Task y evidencia: `docs/tasks/Sprint 2/HU-I-01.md`, `docs/testing/HU-I-01-evidencia.md`. Sin cambios en respuestas, reglas de negocio ni numeración; precisión aditiva de validación de IDs históricos.

**Presentación solicitada (01/10/2026):** HU-I-01 muestra `Total registrado` como en la página 5 del PDF, sumando únicamente las filas recibidas en centavos exactos. Este pedido explícito del usuario extiende la presentación sin total de HU-C-09; no representa saldo, precio esperado ni validación del monto del turno.

**Compatibilidad verificada en integración (01/10/2026):** la migración inicial creó las formas con ids `formapago-efectivo`, `formapago-transferencia`, `formapago-debito`, `formapago-mercado-pago`, conservados por el seed. La validación CUID de §2.4 rechazaba pagos válidos contra ese catálogo. `forma_pago_id` acepta un CUID **o exactamente uno de esos cuatro ids existentes**; las reglas de existencia/actividad siguen validándose en el servicio. No se migran ids ni se alteran referencias históricas. El ejemplo de schema de §2.4 debe interpretarse con esta precisión aditiva.

**Backlog v2 del 28/09/2026:** (1) **HU-C-11 se retiró**: el turno ya no lleva forma de pago, así que esta spec ya no la consume ni la propone desde el turno; (2) **HU-I-01 ahora registra qué alumno paga** (AC1, AC3, AC4): el pago lleva `alumnoId` y la forma de pago se propone a partir de la **preferida del alumno elegido** (HU-B-03), sin obligarla; (3) HU-I-01 depende ahora de HU-C-09 (detalle del turno, de donde sale la lista de inscriptos) y no de HU-C-11; (4) HU-I-03 ya no menciona turnos.

**Nota aditiva — 01/10/2026 (`spec_modulo_H.md` Revisión 2):** se agrega la fila `sumarPagosPorMes()` en §2.3, la lectura agregada que consume el indicador "Ingresos cobrados por mes" (HU-H-01 revisada). Es de solo lectura, no cambia el modelo `Pago` ni ninguna regla de negocio, y no se renumera nada.

**Changelog de Revisión 1 (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-I-03 | Gap — no contractualizada | Añadidas secciones 2.1 y 2.2 |
| HU-I-01 | Gap — no contractualizada | Añadidas secciones 2.4 y 2.5 (opciones del modal) |
| HU-C-11 | Vigente en el backlog previo | Retirada del backlog v2: esta spec ya no la consume |

**Changelog de Revisión 2 (HU-I-03):** se precisa el alcance del endpoint de opciones, las fixtures para pruebas de inactivas y el estado de la migración ya versionada. Además (29/09/2026): el mensaje del `409` y el del campo vacío pasan a los textos del mockup (páginas 24 y 25) y del prototipo; el schema colapsa los espacios antes de validar el largo; y se aclara que la garantía frente a la carrera es el índice único. HU-I-01 y los contratos existentes conservan sus secciones y numeración.

**Detalle por sección y modelo:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| Modelo `FormaPago` | Existe desde Sprint 1 como catálogo de seed (`Efectivo`, `Transferencia`, `Débito`, `Mercado Pago`) con `idFormaPago`, `nombreFormaPago @unique`, `activaFormaPago`. Lo lee HU-B-03 | Pasa a ser **propiedad de este módulo**. Se le agregan `nombreNormalizadaFormaPago`, `createdAtFormaPago` y `creadoPorUsuarioId` (§2.1, migración). Sin cambio de contrato en B; B pasa a consumirlo por §2.3. `listarFormasPagoActivas()` se **mueve** de `alumno.service.ts` a esta spec |
| HU-I-03 | Gap — no contractualizada | Secciones 2.1 y 2.2 |
| HU-I-01 | Gap — no contractualizada | Secciones 2.4 y 2.5 (opciones del modal) |
| Modelo `Pago` | No existe en `schema.prisma` | Nuevo (§2.4), **con `alumnoId`** (backlog v2) |
| `spec_modulo_C.md` §2.4 | El detalle no muestra pagos | Lo ajusta la Revisión 5 de C; consume `listarPagosDeTurno()` (§2.3), que ahora devuelve el alumno de cada pago |

**Fuera de alcance de esta spec (explícito):**
- Modificar, dar de baja o reactivar una forma de pago (HU-I-03 AC5): existe el estado `Inactiva` pero ninguna acción de este sprint lo alcanza desde la UI. Para comprobar estas ramas, crear fixtures inactivas aisladas en la base de test o usar mocks según el nivel de prueba. HU-I-03 no exige una forma inactiva en el seed de demo. El `upsert` de las cuatro formas auditado en `b9cc43b` fija `activaFormaPago: true` al actualizar; no usarlo como fixture inactiva ni alterar su política de reactivación en esta HU.
- **Editar o anular un pago ya registrado.** Un pago es un registro de hecho consumado (Regla N.° 8): no admite `UPDATE`; una corrección se resolvería con un registro compensatorio que lo referencie, y el PO planificó una HU en Sprint 3 para solventar los casos en que haya que corregir (Q6c). Ver "Puntos abiertos".
- Historial de pagos por alumno (HU-I-04) y estado de cuenta (HU-I-02), ambos de Sprint 3. (El pago **guarda** el alumno desde este sprint, así que HU-I-04 no requerirá migrar datos; lo que queda fuera es la pantalla.)
- Asociar una forma de pago **al turno** (HU-C-11, retirada del sprint).
- Pantalla o listado global de "Pagos" (mapa de pantallas §2): el pago vive solo en el Detalle de turno.
- Precios por materia y validación contra un monto total esperado (HU-I-01 AC2 y AC3).
- Integración con pasarelas de pago: sin checkout, webhooks ni conciliación. La forma de pago es un dato de texto que carga Mesa de Entrada.
- Comprobantes y notificaciones.

---

## 1. Visión General

> **Revisión 3 (Sprint 3).** El módulo ya no gestiona solo dos entidades: suma la operación de pago, las correcciones y anulaciones, el comprobante y la caja (2.6). El registro de un pago nace de una pantalla propia —«Registrar pago», que parte del alumno (2.7)— y el botón del detalle de la clase queda como atajo (2.8). «El pago no tiene pantalla» y «solo en el Detalle de turno» de esta sección y del mapa de Sprint 2 quedan superados por el mapa del Sprint 3.


El Módulo I gestiona dos entidades independientes:

1. **`FormaPago`** — catálogo de las formas de pago que el centro admite. Lo administra solo el Gerente. Desde este sprint es propiedad de este módulo.
2. **`Pago`** — registro puntual de que un alumno abonó un turno (alumno, monto, forma de pago, fecha). Lo carga Mesa de Entrada desde el Detalle de turno.

**La forma de pago vive solo en el pago.** HU-C-11 (asociar una forma de pago al turno) se retiró del backlog: el turno no tiene forma de pago propia. Al registrar un pago, la forma de pago se **propone** con la preferida del alumno elegido (HU-B-03), sin obligarla, y se elige entre las activas.

**Presentación (mapa de pantallas):** las formas de pago tienen **pantalla propia** (listado, página completa) con el alta en modal; el pago **no** tiene pantalla: es una acción en modal dentro del Detalle de turno (`/turnos/[id]`).

Implementación estándar del proyecto: Route Handlers delgados que delegan en `src/server/pagos/forma-pago.service.ts` y `src/server/pagos/pago.service.ts` (Reglas N.° 4 y 11). Como en Turnos, el frontend llama directamente a los Route Handlers; **no** se crea `actions.ts` sin uso.

**Historial y alcance de Revisión 2:** la Revisión 1 creó las secciones 2.1 a 2.5. Esta revisión solo precisa HU-I-03 en las secciones indicadas en el changelog; preserva la numeración, los contratos de HU-I-01 y la propiedad de `FormaPago` en I.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los ids de `FormaPago` y `Pago` son CUID según `schema.prisma`. **El `turno_id` no se valida como CUID** (los turnos de seed tienen ids `seed-turno-NN`); un id inexistente responde `404` desde el servicio, igual que las rutas de Turno.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("<recurso>:<accion>")` (Regla N.° 10). Permisos nuevos (se siembran en migración y en `seed.ts`; matriz completa en `spec_modulo_A.md` §2.4):

| Permiso | Roles |
|---|---|
| `formas_pago:crear` | GERENTE |
| `formas_pago:leer` | GERENTE, MESA_ENTRADA (la usa también el modal de HU-I-01) |
| `pagos:crear` | MESA_ENTRADA |
| `pagos:leer` | MESA_ENTRADA, GERENTE (el PROFESOR **no** ve montos) **Ratificado por el PO (29/09/2026) — Q6d** |

- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/pago.types.ts`; `src/server/pagos/actions.ts` no se crea (ver sección 1); services, schemas y servicios públicos en `src/server/pagos/{forma-pago.service.ts, forma-pago.schema.ts, pago.service.ts, pago.schema.ts, forma-pago.publico.ts, pago.publico.ts}`; Route Handlers en `app/api/formas-pago/**` y `app/api/pagos/**`.

---

### 2.1. Alta de forma de pago (HU-I-03)

> **Revisión 3.** Ruta, cuerpo, respuesta y `code` **sin cambios**. La forma nace con `esEfectivo = false` (2.6.1), que no es un campo de la API. El esquema del nombre se extrae como `NombreFormaPagoSchema` y lo reutiliza la edición (2.16.1). La confirmación previa del alta (DEC-29) es solo de interfaz. La baja y la modificación, que esta HU dejaba fuera, son HU-I-07 (2.16).


**Ruta:** `POST /api/formas-pago` (Route Handler en `src/app/api/formas-pago/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `crearFormaPago()` en `src/server/pagos/forma-pago.service.ts`
**Permiso requerido:** `formas_pago:crear`
**Presentación:** modal (`Dialog`) sobre el listado; toast "Forma de pago registrada correctamente" (mapa de pantallas §4, `DESIGN.md` §6.1).

```typescript
// src/server/pagos/forma-pago.schema.ts
export const CrearFormaPagoSchema = z.object({
  nombre: z.string()
    .transform((v) => v.trim().replace(/\s+/g, " ")) // primero se recorta y se colapsan los espacios...
    .pipe(z.string()                                    // ...y recién después se valida el largo
      .min(1, "Ingresá el nombre de la forma de pago.") // campo vacío (mockup); con vacío se muestra solo este mensaje
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(40, "El nombre no puede superar los 40 caracteres")),
}).strict(); // rechaza cualquier campo extra: no se solicita ni almacena ningún dato financiero (HU-I-03 AC1)
export type CrearFormaPagoInput = z.infer<typeof CrearFormaPagoSchema>;
```

**Comportamiento esperado (`forma-pago.service.ts` → `crearFormaPago`):**
1. Calcular `nombreNormalizadaFormaPago = normalizarTexto(nombre)` con la utilidad compartida (`spec_modulo_L.md` §2.1; misma que Materias y Aulas).
2. Verificar unicidad aplicativa contra **todas** las formas de pago, activas e inactivas. Si existe: `409 NOMBRE_DUPLICADO`.
3. Revalidación inmediatamente antes del `INSERT` + defensa del constraint único (`P2002`), traducido al mismo `409` (patrón de `spec_modulo_L.md` §3.2). La revalidación mejora el mensaje, pero **no cierra la carrera**: la garantía frente a dos altas simultáneas es el índice único con la captura de `P2002`.
4. Insertar con `activaFormaPago: true`, `createdAtFormaPago` y `creadoPorUsuarioId`.

**Modelo (cambios en `schema.prisma`):**
```prisma
model FormaPago {
  idFormaPago               String   @id @default(cuid())
  nombreFormaPago           String   @unique
  nombreNormalizadaFormaPago String  @unique   // NUEVO: unicidad case/acento-insensitiva
  activaFormaPago           Boolean  @default(true)
  createdAtFormaPago        DateTime @default(now())  // NUEVO (Regla N.° 2, opción a)
  creadoPorUsuarioId        String?                    // NUEVO, escalar sin relación
  alumnos Alumno[]
  pagos   Pago[]    // NUEVO
  @@map("formas_pago")
}
```

**Estado de migración y despliegue:** la base de código auditada en `b9cc43b` ya contiene el modelo y la migración versionada `20260928150100_sprint2_modelo`, con backfill literal de cuatro formas, `NOT NULL` e índice único de `nombreNormalizadaFormaPago`. Su aplicación en cada base no se comprobó. Antes de desplegar en una base no migrada, verificar los nombres preexistentes, las colisiones bajo `normalizarTexto()` y el estado de la migración; si existen otros nombres o colisiones, preparar un saneamiento seguro o una migración adicional apropiada antes de imponer unicidad. No reescribir una migración ya aplicada. El seed auditado fija el nombre normalizado en el `upsert`; verificar su versión vigente al implementar.

**Trazabilidad:** opción (a) de la Regla N.° 2 (columnas de la propia fila), igual que Materias y Aulas. No hay tabla de eventos de Pagos.

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Tarjeta de crédito", "is_active": true }, "error": null }
```
**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "NOMBRE_DUPLICADO", "message": "Ya existe una forma de pago con ese nombre." } }
```

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — nombre fuera de 2–40 caracteres o campo extra (`.strict()`).
- `403 SIN_PERMISO` — rol sin `formas_pago:crear`.
- `409 NOMBRE_DUPLICADO` — ya existe una forma de pago (activa o inactiva) con ese nombre normalizado, o `P2002` del constraint único.

---

### 2.2. Listado y opciones de formas de pago (HU-I-03)

> **Revisión 3.** Ruta, parámetros, orden y respuesta **sin cambios**. Una forma desactivada (2.16) sigue en el listado como «Inactiva» y sale de las opciones. El listado de la pantalla muestra Nombre, Estado y las acciones nuevas; no tiene la columna «Preferida por» (HU-I-07, criterio 1).


**Ruta (listado):** `GET /api/formas-pago` (Route Handler en `src/app/api/formas-pago/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarFormasPago()` en `src/server/pagos/forma-pago.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `formas_pago:leer`

```typescript
export const ListarFormasPagoQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado:**
- Incluye formas de pago activas e inactivas; cada ítem: nombre y estado (`Activa` / `Inactiva`).
- Orden: `nombreNormalizadaFormaPago` ascendente (HU-I-03 AC4), paginación server-side con metadatos — mismo patrón que Materias y Aulas.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [{ "id": "cuid", "nombre": "Débito", "is_active": true }],
    "paginacion": { "total": 4, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Ruta (opciones para selectores):** `GET /api/formas-pago/opciones` — **solo activas**, sin paginar, orden alfabético normalizado, array directo (mismo formato que las rutas de opciones de Turno). Está previsto para el modal de HU-I-01; las páginas actuales de B obtienen las opciones por el servicio público interno de I. Permiso `formas_pago:leer`. Servicio: `listarFormasPagoActivas()` (§2.3).
```json
{ "data": [{ "id": "cuid", "nombre": "Efectivo" }], "error": null }
```

**Alcance de HU-I-03:** esta historia implementa `POST /api/formas-pago` y `GET /api/formas-pago` (listado de gestión). El endpoint HTTP `/api/formas-pago/opciones` queda especificado para HU-I-01 y no se crea en la task I-03. Las páginas actuales de B obtienen las opciones mediante el servicio interno `listarFormasPagoActivas()` de I, sin una ruta HTTP nueva.

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — `pagina` o `por_pagina` inválidos (solo el listado).
- `403 SIN_PERMISO` — rol sin `formas_pago:leer`.

---

### 2.3. Servicios públicos del módulo

> **Revisión 3.** Las cuatro funciones conservan **firma y forma del resultado**. `listarPagosDeTurno` devuelve los pagos no anulados con el monto vigente y `sumarPagosPorMes` suma el monto vigente de los no anulados (T4 y T5); sin correcciones ni anulaciones dan lo mismo que hoy. Las funciones nuevas están en 2.17. El cobro ya no consume `bloquearTurnoParaOperacion`: bloquea con `bloquear` en el orden canónico (T7, 3.11). Sigue valiendo el aislamiento sin ciclo del último párrafo.


Conforme a la Regla N.° 3, **provistos por este módulo**, en `forma-pago.publico.ts` y `pago.publico.ts`. Otros módulos los invocan en lugar de consultar `formas_pago` o `pagos`. No son endpoints ni exigen un permiso `formas_pago:*`/`pagos:*`: el control de acceso lo hace la ruta del módulo consumidor. En las funciones que lo declaran, el parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador; `listarFormasPagoActivas()` no recibe `db`.

| Función | Devuelve | Consumidores |
|---|---|---|
| `verificarFormaPagoActiva(id, db?)` | `{ id, nombre } \| null` si existe y está activa | B §2.3, §2.4 de esta spec |
| `existeFormaPago(id, db?)` | `boolean`: existe, activa o inactiva | separar "no existe" de "inactiva" |
| `obtenerFormaPago(id, db?)` | `{ id, nombre, is_active } \| null` | mostrar el nombre histórico de una forma desactivada (en el detalle de pagos y en la ficha del alumno) |
| `listarFormasPagoActivas()` | `{ id, nombre }[]`, orden alfabético normalizado | selectores |
| `listarPagosDeTurno(turnoId, db?)` | `{ id, alumno: { id, nombre_completo }, monto, forma_pago: { id, nombre }, fecha_pago, registrado_en }[]`, más recientes primero. Los nombres de alumno salen de `obtenerAlumnosBasicos()` (Módulo B, §2.8), en una sola consulta en lote | C §2.4 (detalle) |
| `sumarPagosPorMes(desde, hasta, db?)` — **NUEVA el 01/10/2026** | `desde` y `hasta` son meses `AAAA-MM` con límites inclusivos. Devuelve `{ mes: "AAAA-MM", total }[]`, **solo los meses con pagos**, en orden cronológico. `total` es la suma exacta de `montoPago` como texto decimal con dos decimales (`"450000.00"`, misma convención que `monto` en `listarPagosDeTurno`), agrupada por el mes de `fechaPago` (`@db.Date`). Suma **todos** los pagos sin filtrar por forma de pago ni por el estado del turno (son hechos consumados, §3.6). `$queryRaw` parametrizado, de solo lectura | HU-H-01 revisada, `spec_modulo_H.md` §2.2 |

**Consumido por este módulo:** `bloquearTurnoParaOperacion(turnoId, tx)` de `spec_modulo_C.md` §2.15 — devuelve el turno bloqueado con `FOR SHARE` y **la lista de alumnos inscriptos** (`alumno_ids`), mismo patrón que `bloquearMateriasParaAsociar` (`spec_modulo_L.md` §2.3); y `obtenerAlumnosBasicos(ids)` de `spec_modulo_B.md` §2.8 para nombres y forma de pago preferida.

**Aislamiento y ciclos de importación:** Turnos consume `pago.publico.ts` y Pagos consume `turno.publico.ts`. Para evitar un import circular (precedente: `turno.disponibilidad.ts`), **ninguno de los dos archivos `*.publico.ts` importa nada del otro módulo**.

---

### 2.4. Registrar pago (HU-I-01)

> **Revisión 3.** El contrato HTTP **y el comportamiento** de este endpoint se conservan, incluidos el «Se admite un turno vencido» del paso 2 (Q6a), los pagos parciales del paso 5 y la ausencia de motivo cuando el monto difiere del precio (T1, T2 y P-I1): `registrarPago` llama a `registrarOperacion` con un ítem en el modo `compatSprint2`, que es permanente. Las reglas de HU-I-10 rigen en el endpoint nuevo `POST /api/pagos/operaciones` (2.7). Cambios: exige una caja abierta (`409 CAJA_NO_ABIERTA`, 3.10, por HU-I-12) y emite un comprobante; el `FOR SHARE` del paso 1 pasa a `bloquear` por dentro (T7). Que el alumno no esté activo sigue sin exigirse para una inscripción vigente (T8). Errores nuevos: `CAJA_NO_ABIERTA` y `TRANSACCION_OCUPADA`. El modelo `Pago` de más abajo solo se **extiende** como indica 2.6.1 (P-I2): conserva todas sus columnas.


**Ruta:** `POST /api/pagos` (Route Handler en `src/app/api/pagos/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `registrarPago()` en `src/server/pagos/pago.service.ts`
**Permiso requerido:** `pagos:crear` (Mesa de Entrada)
**Presentación:** modal (`Dialog`) en el Detalle de turno (`/turnos/[id]`); toast "Pago registrado correctamente". Campos del modal (HU-I-01 AC1): **Alumno** (entre los inscriptos del turno, **con buscador**; **se preselecciona solo si hay uno**), **Monto**, **Forma de pago** (entre las activas; por defecto la preferida del alumno elegido, sin obligarla) y **Fecha de pago** (por defecto hoy). Las opciones las provee 2.5.

```typescript
// src/server/pagos/pago.schema.ts
export const RegistrarPagoSchema = z.object({
  turno_id: z.string().trim().min(1, "Falta el turno"), // sin .cuid(), ver convenciones
  alumno_id: z.string().cuid({ error: "Elegí el alumno que paga" }), // HU-I-01 AC1 (backlog v2)
  // String decimal con punto: evita errores de coma flotante. El frontend normaliza la
  // coma decimal del input es-AR ("1500,50") a punto antes de enviar.
  monto: z.string().trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales")
    .refine((v) => Number(v) > 0, "El monto debe ser mayor a cero"),
  forma_pago_id: z.string().cuid(),
  // Solo valida que sea una fecha de calendario válida (utilidad compartida, spec_modulo_B.md §2.1); por defecto, hoy.
  // La regla «no puede ser futura» NO está en Zod: la valida el servicio (§2.4 paso 4), porque «hoy» se mide en America/Argentina/Buenos_Aires.
  fecha_pago: fechaCalendarioValidaSchema.optional(),
}).strict();
export type RegistrarPagoInput = z.infer<typeof RegistrarPagoSchema>;
```

**Comportamiento esperado (`pago.service.ts` → `registrarPago`), dentro de una única `prisma.$transaction`:**
1. Bloquear y leer el turno con `bloquearTurnoParaOperacion(turno_id, tx)`. Si no existe: `404 TURNO_NO_ENCONTRADO`. El bloqueo compartido impide que una cancelación concurrente (`spec_modulo_C.md` §2.10, que toma la fila con `UPDATE`) deje un pago sobre un turno cancelado (Regla N.° 7).
2. El turno debe estar `DISPONIBLE` o `COMPLETO`; de lo contrario `409 TURNO_NO_ADMITE_PAGO`. **Se admite un turno vencido**: pagar después de la clase es el caso normal (`spec_modulo_C.md` §3.8). **Ratificado por el PO (29/09/2026) — Q6a**
3. **El alumno debe estar inscripto en el turno** (HU-I-01 AC1): `alumno_id ∈ turno.alumno_ids` (lista que devolvió el bloqueo del paso 1). Si no: `409 ALUMNO_NO_INSCRIPTO`, "El alumno no está inscripto en este turno". No se exige que el alumno siga activo: el pago es un hecho consumado (Regla N.° 8) y la inscripción ya existe. Si el turno tiene **un solo inscripto**, la UI lo preselecciona, pero el servidor **siempre exige `alumno_id`** en el body (no lo infiere).
3b. Validar la forma de pago con `verificarFormaPagoActiva(forma_pago_id, tx)`. Inexistente (`existeFormaPago`): `404 FORMA_PAGO_NO_ENCONTRADA`. Inactiva: `409 FORMA_PAGO_NO_DISPONIBLE` (mismo código que `spec_modulo_B.md` §2.3).
4. `fecha_pago`: si no viene, hoy en `America/Argentina/Buenos_Aires`. **No puede ser futura, y esa regla la valida el servicio, no Zod** (`RegistrarPagoSchema` solo comprueba que sea una fecha de calendario válida). Si `fecha_pago` es posterior a hoy en esa zona, el servicio lanza `ServiceError("FECHA_PAGO_FUTURA")` y la ruta responde `400` con el sobre de error estándar, **sin** el detalle por campo de `flatten()`:
   ```json
   { "data": null, "error": { "code": "FECHA_PAGO_FUTURA", "message": "La fecha de pago no puede ser futura" } }
   ```
   Como este paso va después de los pasos 1 a 3b, un turno inexistente, un alumno no inscripto o una forma de pago inválida se informan antes que la fecha futura.
5. Insertar el `Pago`. Un turno admite **más de un pago** (AC3): pagos parciales de un mismo alumno o de distintos alumnos inscriptos; cada uno es una fila independiente con su propio alumno, monto, forma de pago y fecha; **no** se valida ningún monto total esperado (Noctium no modela precios este sprint).

La forma de pago llega **propuesta en el modal** con la preferida del alumno (dato que entrega 2.5), pero solo en la UI: el servicio no la infiere, la recibe siempre en el body.

**Modelo (nuevo en `schema.prisma`):**
```prisma
model Pago {
  idPago             String   @id @default(cuid())
  turnoId            String
  alumnoId           String                        // quién paga (backlog v2); debe estar inscripto en el turno
  montoPago          Decimal  @db.Decimal(11, 2)   // hasta 999.999.999,99
  formaPagoId        String
  fechaPago          DateTime @db.Date
  createdAtPago      DateTime @default(now())      // Regla N.° 2, opción (a)
  creadoPorUsuarioId String?                       // escalar sin relación, igual que el resto del schema

  turno     Turno     @relation(fields: [turnoId], references: [idTurno])
  alumno    Alumno    @relation(fields: [alumnoId], references: [idAlumno])
  formaPago FormaPago @relation(fields: [formaPagoId], references: [idFormaPago])

  @@index([turnoId, createdAtPago])
  @@index([alumnoId, createdAtPago]) // HU-I-04 (Sprint 3) listará por alumno
  @@map("pagos")
}
```
Sin `updatedAtPago`: un pago no se actualiza (§3.6). `Turno`, `Alumno` y `FormaPago` agregan la relación inversa `pagos Pago[]`. Las FK a `turnos`, `alumnos` y `formas_pago` son `RESTRICT`: un turno o un alumno con pagos nunca se borra, y de todos modos no se borran (Regla N.° 1).

**Respuesta `201 Created`:**
```json
{
  "data": {
    "id": "cuid", "turno_id": "cuid", "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" }, "monto": "15000.50",
    "forma_pago": { "id": "cuid", "nombre": "Transferencia" }, "fecha_pago": "2026-09-28"
  },
  "error": null
}
```

**Errores esperados:**

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | monto inválido o ≤ 0, falta el alumno, campo extra, `fecha_pago` con formato de fecha inválido |
| 400 | `FECHA_PAGO_FUTURA` | `fecha_pago` posterior a hoy; la valida el servicio (§2.4 paso 4), con el sobre estándar y el mensaje «La fecha de pago no puede ser futura» (sin `flatten()`) |
| 403 | `SIN_PERMISO` | rol sin `pagos:crear` |
| 404 | `TURNO_NO_ENCONTRADO` | el turno no existe |
| 404 | `FORMA_PAGO_NO_ENCONTRADA` | la forma de pago no existe |
| 409 | `TURNO_NO_ADMITE_PAGO` | turno `PENDIENTE` o `CANCELADO` |
| 409 | `ALUMNO_NO_INSCRIPTO` | el alumno no figura entre los inscriptos del turno |
| 409 | `FORMA_PAGO_NO_DISPONIBLE` | la forma de pago está inactiva |

**Visualización (HU-I-01 AC4):** el pago queda visible en el Detalle de turno, en la lista "Pagos registrados", con **alumno**, fecha, monto y forma de pago de cada uno, vía `listarPagosDeTurno()`. Solo lo ve quien tiene `pagos:leer`.

---

### 2.5. Opciones del modal de pago (HU-I-01)

> **Revisión 3.** Ruta, parámetro y campos **sin cambios**; `alumnos` son los inscriptos con inscripción **vigente** y cada uno puede traer `inscripcion` y `cobrable` (2.8). El buscador en el cliente sigue siendo el del atajo del detalle; la búsqueda de alumnos de todo el centro de HU-I-10 es 2.7.1.


**Ruta:** `GET /api/pagos/opciones?turno_id=` (Route Handler en `src/app/api/pagos/opciones/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `obtenerOpcionesPago()` en `src/server/pagos/pago.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `pagos:crear`

Devuelve lo que el modal necesita en una sola llamada, para no obligar a la UI a pedir la ficha de cada alumno.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "alumnos": [ { "id": "cuid", "nombre_completo": "Pérez, Ana", "dni": "40100001", "forma_pago_preferida_id": "cuid" } ],
    "formas_pago": [ { "id": "cuid", "nombre": "Efectivo" } ],
    "preseleccionar_alumno_id": "cuid"
  },
  "error": null
}
```

**Comportamiento esperado:**
- **Buscador del alumno (HU-I-01 AC1, backlog del 28/09):** se resuelve **en el cliente** sobre la lista `alumnos` de esta respuesta, que ya está acotada por el cupo del turno (no puede superar la capacidad del aula). Filtra por apellido y nombre sin distinguir mayúsculas ni acentos, y por DNI parcial si el texto son solo dígitos. **No hay endpoint de búsqueda nuevo** ni se llama al buscador de alumnos de B (ese devuelve alumnos de todo el centro, no los inscriptos de un turno). Para poder buscar por DNI, cada alumno de `alumnos` agrega `dni` (dato que ya expone `obtenerAlumnosBasicos()`).
- `alumnos`: los inscriptos del turno (`obtenerAlumnosInscriptosDeTurno()` de `spec_modulo_C.md` §2.15) con nombre y forma de pago preferida (`obtenerAlumnosBasicos()`, Módulo B). `forma_pago_preferida_id` es `null` si el alumno está "Sin preferencia" **o** si su preferida está desactivada (no se propone una forma que ya no se puede elegir).
- `formas_pago`: solo las activas, orden alfabético normalizado.
- `preseleccionar_alumno_id`: presente **solo si hay exactamente un inscripto**; si no, se omite.
- Turno inexistente: `404 TURNO_NO_ENCONTRADO`. Turno sin inscriptos: `200` con `alumnos: []`; la UI deshabilita "Registrar pago" y muestra "El turno no tiene alumnos inscriptos".

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — falta `turno_id`.
- `403 SIN_PERMISO` — rol sin `pagos:crear`.
- `404 TURNO_NO_ENCONTRADO` — el turno no existe.

---

### 2.6. Modelo de pagos del Sprint 3 y permisos — NUEVA en Revisión 3

> **Quién hace qué.** El esquema, las migraciones, el seed y los servicios de dominio los entrega el **PR 0** (`PR-0.md` §2.3, §2.5 y §2.13), que lo hace el Scrum Master por separado. Esta sección fija los **contratos** que las HU de este módulo usan. Los nombres de modelos y campos son los lógicos de esta spec; el PR 0 usa las convenciones del `schema.prisma` (sufijo de entidad) y anota los reales en «Decisiones tomadas».

#### 2.6.1. Entidades

| Entidad | Qué guarda | Se escribe con |
|---|---|---|
| `OperacionPago` | Un cobro hecho en el mostrador: alumno, **forma de pago**, **fecha de pago**, usuario que lo registra, momento de registro y la caja donde quedó. Guarda los valores originales (los mismos que cada `Pago` conserva) y es la base de las correcciones de forma y fecha. El total no se guarda | `registrarOperacion` |
| `Pago` | Un pago por clase. **Conserva sus columnas de Sprint 2 sin cambios**: `turnoId`, `alumnoId`, `montoPago` (monto cobrado), `formaPagoId`, `fechaPago`, `creadoPorUsuarioId` y `createdAtPago` (los valores originales, copia de los de su operación). **Suma:** `operacionId`, `inscripcionId`, `precio` (entero en pesos, el de la inscripción), `motivoAjuste` y `ajustadoPor` (cuando el monto difiere del precio), `createdAtPago`. **Inmutable** (Regla N.° 8) | `registrarOperacion` |
| `CorreccionPago` | Cambio de monto de un pago: valor anterior y nuevo, motivo, usuario, fecha | `corregirPago` |
| `AnulacionPago` | Anulación de un pago: motivo (puede ser «Reintegro»), usuario, fecha | `anularPago` |
| `CorreccionOperacion` | Cambio de forma o de fecha de pago de la operación (alcanza a todos sus pagos): valor anterior y nuevo, motivo, usuario, fecha | `corregirOperacion` |
| `Comprobante` | Número (secuencia), operación, `datos` (copia fija en JSON), `emitidoEl`, `reemplazaAId` (nullable y **único**) | `emitirComprobante`, `emitirReemplazo` |
| `Caja` | Integrante, apertura (`abiertaEl`, `fondoInicial`), estado `ABIERTA`/`CERRADA`, cierre (`cerradaEl`, `cerradaPor`, `porAusencia`, `efectivoDeclarado`, `efectivoEsperado`, `diferencia` con signo, `motivo`, `resumen` JSON fijo). **Índice único parcial:** una sola caja `ABIERTA` por integrante | `abrirCaja`, `declararEfectivo`, `cerrarCaja` |
| `MovimientoCaja` / `AnulacionMovimiento` | Ingreso o egreso manual de efectivo (tipo, monto, concepto, usuario, fecha) y su anulación como registro nuevo | `registrarMovimiento`, `anularMovimiento` |
| `AjusteCaja` | Dinero que se mueve al corregir o anular un pago de una caja **cerrada**: caja abierta destino, pago, corrección o anulación de origen, forma de pago, monto con signo, usuario, fecha | `registrarAjuste` (la llaman `corregirPago`, `corregirOperacion` y `anularPago`) |
| `FormaPago.esEfectivo` | Marca booleana (por defecto `false`) que solo tiene la forma «Efectivo» del catálogo. El arqueo suma solo las formas con la marca. **Ninguna pantalla la edita** | migración y seed |

**Toda escritura sobre estas entidades pasa por el servicio de dominio del PR 0**; los Route Handlers y las pantallas no escriben directo en las tablas (`PR-0.md` §2.13). El historial de estados de la inscripción (Reservada → Pagada → Reservada…) lo escribe el servicio después de confirmada la operación (`PR-0.md` §2.10 y §2.16).

#### 2.6.2. Valores vigentes

Los registros originales no se modifican; **lo que se muestra y lo que se suma es el valor vigente**, que se calcula siempre del mismo modo (una sola implementación en las funciones públicas de 2.17):

- **Monto vigente de un pago:** el valor nuevo de su última `CorreccionPago`; si no tiene, `montoPago`.
- **Forma y fecha de pago vigentes de un pago:** las de la última `CorreccionOperacion` de su operación que haya cambiado cada una; si no hay ninguna, las originales (`formaPagoId` y `fechaPago` del propio pago, que son las de su operación).
- **Pago anulado:** existe una `AnulacionPago` que lo referencia. Un pago anulado **no suma** en ningún total ni indicador y se muestra con la etiqueta «Anulado».
- **Total de una operación:** suma de los montos vigentes de sus pagos no anulados. No se guarda.
- **Usuario que lo registró:** `creadoPorUsuarioId` del pago (el mismo de la operación).
- **Estado de pago de la inscripción:** `PAGADA` si y solo si tiene al menos un pago no anulado (3.8).

#### 2.6.3. Permisos (propuesta para la tabla cerrada de `PR-0.md` §2.9)

Los permisos de Sprint 2 no cambian. Los nuevos se siembran en migración y en `seed.ts` (spec A §2.4) y los nombres los fija el PR 0 (P-I4):

| Permiso | Roles | Lo usan |
|---|---|---|
| `pagos:crear` *(existente)* | MESA_ENTRADA | 2.7, 2.8 |
| `pagos:leer` *(existente)* | MESA_ENTRADA, GERENTE | 2.13, lista del detalle |
| `pagos:corregir` **(nuevo)** | MESA_ENTRADA (acotado), GERENTE | 2.14 (corregir y anular; el alcance lo da `puedeCorregirPago`) |
| `pagos:leer_propios` **(nuevo)** | ALUMNO | 2.15 |
| `comprobantes:leer` **(nuevo)** | MESA_ENTRADA, GERENTE | 2.9 |
| `comprobantes:leer_propios` **(nuevo)** | ALUMNO | 2.9, 2.15 |
| `cajas:abrir`, `cajas:movimiento`, `cajas:cerrar`, `cajas:leer` **(nuevos)** | MESA_ENTRADA | 2.10, 2.11 (solo su propia caja) |
| `cajas:leer_todas`, `cajas:cerrar_ausencia` **(nuevos)** | GERENTE | 2.12 |
| `formas_pago:crear`, `formas_pago:leer` *(existentes)* | `crear`: GERENTE. `leer`: GERENTE, MESA_ENTRADA | 2.1, 2.2 |
| `formas_pago:editar`, `formas_pago:desactivar` **(nuevos)** | GERENTE | 2.16 (`desactivar` incluye reactivar) |

El **Profesor no recibe ninguno de los permisos de pagos, comprobantes ni cajas** (Q6d, HU-I-11 criterio 4, HU-L-06 criterio 7): ni los montos ni los precios. El **Gerente no tiene `pagos:crear`** (HU-I-10 criterio 9, HU-E-02 criterio 8): no registra pagos, no abre cajas ni registra movimientos; sí corrige y anula pagos (2.14) y hace el cierre por ausencia (2.12). Todo acceso fuera de estos permisos responde `403 SIN_PERMISO`; el que cumple el permiso pero queda fuera del alcance de la regla (por ejemplo, mesa de entrada con una caja cerrada) responde `403 FUERA_DE_ALCANCE`.

---

### 2.7. Registrar pago buscando al alumno (HU-I-10) — NUEVA en Revisión 3

> **Compatibilidad.** El registro desde el detalle de la clase (2.4 y 2.5) **no se reemplaza**: se conserva y pasa a ser un atajo del mismo servicio (2.8). Esta sección agrega la pantalla «Registrar pago» (P-30) y sus endpoints, todos nuevos. `POST /api/pagos` conserva siempre el comportamiento de Sprint 2 (modo `compatSprint2`, `PR-0.md` §2.15); las reglas de HU-I-10 rigen en los endpoints nuevos de esta sección.

**Pantalla:** flujo de tres pasos Alumno → Clases → Confirmación (`/pagos/registrar`, sugerida; acepta alumno y clase preelegidos, por ejemplo `?alumno=<id>&clase=<id>`). La confirmación de HU-C-25 es la del paso 3: «¿Estás seguro de que querés registrar el pago de <total> a nombre de <Alumno>?», con el detalle de las clases (y de los importes distintos del precio), la forma de pago y la fecha, y los botones «Registrar pago» y «Volver» (HU-I-10 criterio 6). Los textos viven en el archivo central de HU-C-23.

#### 2.7.1. Paso 1 · Buscar alumno

**Ruta:** `GET /api/pagos/buscar-alumnos?q=` (Route Handler en `src/app/api/pagos/buscar-alumnos/route.ts`)
**Servicio:** `buscarAlumnosParaCobro()` en `src/server/pagos/pago.service.ts`, que delega en `buscarAlumnosActivos(q)` del Módulo B (`spec_modulo_B.md` §2.8)
**Permiso requerido:** `pagos:crear`

```typescript
export const BuscarAlumnosCobroQuerySchema = z.object({
  q: z.string().trim().min(2, "Escribí al menos 2 caracteres"),
}).strict();
```

Respuesta `200`: `{ "data": [{ "id": "cuid", "nombre": "Ana", "apellido": "Pérez", "dni": "40100001" }], "error": null }`. Solo alumnos **activos**, máximo 10, desde 2 caracteres, sin distinguir mayúsculas ni acentos (HU-I-10 criterio 2). Con menos de 2 caracteres el cliente no llama. El criterio de coincidencia es el de HU-B-05; mientras `buscarAlumnosActivos` no lo adopte, se aplica la salvedad de P-I5. Es un endpoint propio, y no el `GET /api/alumnos` de B, porque `alumnos:leer` y `pagos:crear` son permisos distintos y este paso no devuelve datos de contacto.

> **Nota posterior (08/10/2026) — resuelve P-I5.** `spec_modulo_B.md` (2.13, P-B8) publica `buscarAlumnosActivos(query, { porPalabras: true })`: con esa opción el buscador aplica el criterio de HU-B-05 (varias palabras en cualquier orden, «juan perez») sin tocar el comportamiento de Sprint 1 ni el selector de HU-C-04. `buscarAlumnosParaCobro` la llama con `{ porPalabras: true }`; la salvedad de P-I5 y el pedido de la opción (a) de B 2.7 **dejan de aplicar**. El resto de esta sección no cambia.

#### 2.7.2. Paso 2 · Clases del alumno pendientes de pago

**Ruta:** `GET /api/pagos/pendientes?alumno_id=<cuid>&turno_id=<opcional>` (Route Handler en `src/app/api/pagos/pendientes/route.ts`)
**Servicio:** `listarClasesPendientesDePago()` en `src/server/pagos/pago.service.ts`
**Permiso requerido:** `pagos:crear`

```typescript
export const PendientesQuerySchema = z.object({
  alumno_id: z.string().cuid(),
  turno_id: z.string().trim().min(1).optional(), // solo para «Se inscribe al confirmar el pago» y para marcar una clase
}).strict();
```

**Comportamiento esperado.** Con `momento = ahora()` (3.11):

1. `404 ALUMNO_NO_ENCONTRADO` si la ficha no existe (`obtenerAlumnosBasicos`). El alumno inactivo no se rechaza acá: no tendrá inscripciones vigentes (HU-B-07) y el paso 1 no lo ofrece.
2. **Lista** las inscripciones del alumno (lectura pública de C, `listarInscripcionesDeAlumno`, con el filtro de estado de pago que agrega HU-I-10 en la misma fachada: DEC-23) que cumplan **todas**:
   - **vigentes** a `momento` (`esVigenteEn`): una reserva vencida sin marcar **no** se lista, aunque el proceso de HU-C-24 todavía no la haya cancelado (HU-I-10 criterio 3, última viñeta de reserva vencida);
   - de una clase en estado guardado `DISPONIBLE` o `COMPLETO` (distingue de `PENDIENTE` y `CANCELADO`; entre Disponible y Completa no decide, ver `spec_modulo_C.md` 3.16);
   - cuya clase **todavía no empezó** (`inicioDeTurno(turno) > momento`: «el pago se hace antes de la clase», HU-C-22);
   - **sin pago no anulado** (`estadoPago` ≠ `PAGADA`): una clase se paga una sola vez.
3. Orden: fecha y hora de la clase, ascendente.
4. Con `turno_id`: si el alumno ya tiene una inscripción vigente en esa clase y cumple lo anterior, esa fila viene marcada (`marcada: true`). Si **no** la tiene, solo se lista la clase cuando `exigeInscripcionConPago(tx, { turnoId, alumnoId })` da `true` (excepción de HU-C-24, criterio 3): se agrega una fila con `estado_pago = "SE_INSCRIBE_AL_PAGAR"`, `inscripcion_id = null`, marcada, con el precio **vigente** (`precioClase` con la tarifa de la materia, `origen_precio = "TARIFA_VIGENTE"`) y se exige alumno activo (`409 ALUMNO_INACTIVO`) y materia con tarifa (`422 MATERIA_SIN_TARIFA`). Si no se cumple ninguna de las dos cosas: `409 ALUMNO_NO_INSCRIPTO`; si la clase no existe: `404 TURNO_NO_ENCONTRADO`; si está `PENDIENTE` o `CANCELADO`: `409 TURNO_NO_ADMITE_PAGO`; si ya empezó: `409 TURNO_YA_EMPEZO`.
5. Devuelve también las **formas de pago activas** (orden alfabético normalizado) y la **forma preferida** del alumno solo si está activa (`forma_pago_preferida_id`, `null` si no tiene o está inactiva; HU-I-10 criterio 5, HU-I-07 criterio 5).

```json
{
  "data": {
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana", "dni": "40100001", "forma_pago_preferida_id": "cuid" },
    "clases": [
      {
        "inscripcion_id": "cuid",
        "turno_id": "seed-turno-12",
        "fecha": "2026-10-12", "hora_inicio": "18:00", "hora_fin": "19:00",
        "materia": { "id": "cuid", "nombre": "Física I" },
        "profesor": { "id": "cuid", "nombre_completo": "Gómez, Laura" },
        "estado_pago": "RESERVADA",
        "vence_el": "2026-10-09T15:31:00-03:00",
        "precio": 24000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      }
    ],
    "formas_pago": [{ "id": "cuid", "nombre": "Efectivo" }]
  },
  "error": null
}
```

- `estado_pago` ∈ `RESERVADA | PAGO_SIN_REGISTRAR | SE_INSCRIBE_AL_PAGAR`. `vence_el` solo si está `RESERVADA`. `precio` es el **precio guardado en la inscripción** (HU-L-06, criterio 4; entero en pesos); `origen_precio` ∈ `INSCRIPCION | TARIFA_VIGENTE` para que la interfaz indique de dónde sale.
- Sin clases: `200` con `clases: []`; la interfaz muestra «Este alumno no tiene clases pendientes de pago» y ofrece buscar otro alumno (HU-I-10 criterio 3).
- **El precio nunca se recalcula** para una inscripción existente: si la tarifa de la materia cambió después de reservar, se cobra el precio congelado (HU-L-06 criterio 4).

#### 2.7.3. Paso 3 · Registrar la operación

**Ruta:** `POST /api/pagos/operaciones` (Route Handler en `src/app/api/pagos/operaciones/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `registrarOperacionDePago()` en `src/server/pagos/pago.service.ts`, que arma el pedido y llama a `registrarOperacion` del PR 0 (`PR-0.md` §2.13) con `modo: "completo"`
**Permiso requerido:** `pagos:crear` (solo Mesa de Entrada; el Gerente, el Profesor y el Alumno reciben `403`)

```typescript
// src/server/pagos/pago.schema.ts — Revisión 3: se extraen como constantes compartidas, sin cambiar su
// comportamiento, las validaciones de monto y de forma de pago de RegistrarPagoSchema (2.4).
export const montoSchema = z.string().trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales")
  .refine((v) => Number(v) > 0, "El monto debe ser mayor a cero");
export const formaPagoIdSchema = /* la unión de 2.4: CUID o uno de los cuatro ids del catálogo inicial */;
export const motivoSchema = z.string().trim().min(1, "Ingresá el motivo").max(300, "El motivo no puede superar los 300 caracteres");

export const RegistrarOperacionSchema = z.object({
  alumno_id: z.string().cuid({ error: "Elegí el alumno que paga" }),
  items: z.array(
    z.object({
      inscripcion_id: z.string().cuid().optional(), // clase con inscripción vigente
      turno_id: z.string().trim().min(1).optional(), // solo «Se inscribe al confirmar el pago»
      monto: montoSchema,                            // importe cobrado de esta clase
      motivo_ajuste: motivoSchema.optional(),        // obligatorio si el monto difiere del precio (lo valida el servicio)
    }).strict().refine((i) => (i.inscripcion_id === undefined) !== (i.turno_id === undefined),
      "Cada clase lleva inscripcion_id o turno_id, no los dos"),
  ).min(1, "Elegí al menos una clase").max(50) // tope técnico, P-I7
    .refine((items) => new Set(items.map((i) => i.inscripcion_id ?? `T:${i.turno_id}`)).size === items.length,
      "No repitas una clase en la misma operación"),
  forma_pago_id: formaPagoIdSchema,
  fecha_pago: fechaCalendarioValidaSchema.optional(), // por defecto, hoy en America/Argentina/Buenos_Aires
}).strict();
export type RegistrarOperacionInput = z.infer<typeof RegistrarOperacionSchema>;
```

El body **no** lleva el precio: el servidor lo lee de la inscripción (o lo calcula en el caso de «Se inscribe al confirmar el pago»); nunca confía en uno enviado por el cliente.

#### 2.7.4. Comportamiento esperado (`registrarOperacion`, una única transacción)

Todo en una `transaccion(...)` del PR 0 (READ COMMITTED, `maxWait` 2000 ms, `timeout` 8000 ms, `lock_timeout` 5 s: `PR-0.md` §2.10). `momento = ahora()` se toma **una sola vez** y es el que se compara con el vencimiento y con el inicio de la clase; **no** la fecha de pago informada (HU-I-10 criterio 7, decisión del PO del 05/10/2026).

1. **Lectura previa sin bloqueo** (para armar la lista de bloqueos): la caja abierta del usuario (`cajaAbiertaDe`, solo lectura), las inscripciones pedidas con su clase, y las clases donde el alumno tiene reservas vencidas sin marcar a `momento`.
2. **Una sola llamada a `bloquear`** en el orden canónico (3.11): el alumno → las clases (las de los ítems, las de las reservas vencidas del alumno y las de «Se inscribe al confirmar el pago»), por id → las inscripciones, por id → la caja del usuario. Los servicios que se llaman después no vuelven a bloquear hacia atrás. Si el usuario no tiene caja abierta no hay caja que bloquear: la validación sigue y el rechazo `CAJA_NO_ABIERTA` se informa al final del paso 4 (así las respuestas de Sprint 2 conservan su precedencia).
3. `marcarVencidas(tx, turnoId)` por cada clase involucrada y `marcarVencidasDelAlumno(tx, alumnoId, { momento, clases })`, con las clases ya bloqueadas (`PR-0.md` §2.2).
4. **Revalidación por ítem**, en este orden (el de 2.4 para las condiciones que ya existían: clase, estado, inscripto, y las nuevas entre «inscripto» y la forma de pago); ante el primer fallo no se registra la operación y la respuesta identifica la clase en `detalles` (`{ turno_id, materia, fecha }`, HU-I-10 criterio 7):
   1. La clase existe (`TURNO_NO_ENCONTRADO`).
   2. La clase está `DISPONIBLE` o `COMPLETO` (`TURNO_NO_ADMITE_PAGO`: en una clase cancelada no se cobra).
   3. La inscripción existe (`INSCRIPCION_NO_ENCONTRADA`, solo para un `inscripcion_id` inexistente) y es **del alumno** (`ALUMNO_NO_INSCRIPTO`).
   4. La clase **no empezó** (`TURNO_YA_EMPEZO`): «La clase de <Materia> del <fecha> ya empezó: el pago se hace antes de la clase.» Se evalúa **antes** que el vencimiento porque, al empezar la clase, la reserva ya venció (su vencimiento nunca supera el inicio) y el mensaje útil es el del inicio.
   5. La reserva **no venció** (`RESERVA_VENCIDA`, la inscripción quedó `RESERVA_VENCIDA` en el paso 3): «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.»
   6. La inscripción sigue **vigente** (si fue cancelada, quitada o dada de baja: `ALUMNO_NO_INSCRIPTO`).
   7. **No tiene un pago no anulado** (`INSCRIPCION_YA_PAGADA`): una clase se paga una sola vez.
   8. **Importe:** `monto` es positivo (Zod). Si `monto` ≠ `precio` (comparación numérica, T14), `motivo_ajuste` es obligatorio (`400 MOTIVO_AJUSTE_REQUERIDO`, con `detalles: { turno_id, precio_vigente }` para que la interfaz recargue el precio: si la tarifa cambió entre que se abrió el flujo y se confirmó, es el caso de DEC-28 y la interfaz muestra «La tarifa de <Materia> cambió. Revisá el importe.»). Con `motivo_ajuste` y monto igual al precio, el motivo se ignora y no se guarda.
   9. **Ítem «Se inscribe al confirmar el pago»** (`turno_id`; reemplaza a 3, 5, 6 y 7): vale solo si `exigeInscripcionConPago` da `true` para (clase, alumno); si no, `ALUMNO_NO_INSCRIPTO`. `crearInscripcion(tx, { turnoId, alumnoId, origen: "PAGO", conReserva: false, actor })` revalida el cupo (`CUPO_INSUFICIENTE`) y la superposición con otras clases del alumno (`ALUMNO_NO_DISPONIBLE`) con las mismas reglas de HU-C-04, rechaza un alumno inactivo (`ALUMNO_INACTIVO`) y una materia sin tarifa (`MATERIA_SIN_TARIFA`), guarda el precio con la tarifa **vigente al confirmar** y deja la inscripción ya `PAGADA`. Si no hay cupo o hay superposición se informa el motivo y no se registra la operación.
5. **Forma y fecha:** `verificarFormaPagoActiva` (`FORMA_PAGO_NO_ENCONTRADA` 404 / `FORMA_PAGO_NO_DISPONIBLE` 409, igual que 2.4 paso 3b) y `fecha_pago` no futura en la zona del centro (`FECHA_PAGO_FUTURA` 400, igual que 2.4 paso 4).
6. **Caja:** el usuario tiene una caja `ABIERTA`, revalidada con la caja bloqueada. Si no: `409 CAJA_NO_ABIERTA` (3.10).
7. **Escritura:** una `OperacionPago` (alumno, forma, fecha, usuario, `registradaEl = momento`, `cajaId`) y un `Pago` por ítem, con `precio`, y `motivoAjuste` y `ajustadoPor` solo si el monto difiere del precio. Cada inscripción pasa a `PAGADA` con `marcarPagada` (que limpia `venceBaseEl` y `venceEl`) y se emite **un solo comprobante** para la operación con `emitirComprobante` (2.9). Si cualquier paso falla, la transacción se revierte entera: no se registra ninguno.
8. Después de confirmada la transacción, el PR 0 escribe el historial de estados de cada inscripción (con reintento, `PR-0.md` §2.16).

#### 2.7.5. Respuesta `201 Created`

```json
{
  "data": {
    "operacion_id": "cuid",
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" },
    "forma_pago": { "id": "cuid", "nombre": "Transferencia" },
    "fecha_pago": "2026-10-09",
    "total": "46000.00",
    "pagos": [
      { "id": "cuid", "turno_id": "seed-turno-12", "inscripcion_id": "cuid",
        "materia": { "id": "cuid", "nombre": "Física I" }, "fecha": "2026-10-12", "hora_inicio": "18:00",
        "precio": 24000, "monto": "22000.00", "motivo_ajuste": "Beca" }
    ],
    "comprobante": { "id": "cuid", "numero": "0001-00000123" }
  },
  "error": null
}
```

La interfaz arma «Pago registrado correctamente (<N> clases)» con `pagos.length` (en singular, «(1 clase)», DEC-22) y ofrece ver el comprobante (2.9.3). Las clases no elegidas quedan como estaban (HU-I-10 criterio 8).

#### 2.7.6. Errores esperados

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | campo extra, monto inválido o ≤ 0, `motivo_ajuste` vacío o de más de 300, ítem sin `inscripcion_id` ni `turno_id` (o con los dos), clase repetida, ninguna clase, más de 50 |
| 400 | `MOTIVO_AJUSTE_REQUERIDO` | el monto difiere del precio y no hay motivo. `detalles: { turno_id, precio_vigente }` |
| 400 | `FECHA_PAGO_FUTURA` | `fecha_pago` posterior a hoy (de Sprint 2, mismo texto) |
| 403 | `SIN_PERMISO` | rol sin `pagos:crear` (Gerente, Profesor, Alumno) |
| 404 | `ALUMNO_NO_ENCONTRADO` · `TURNO_NO_ENCONTRADO` · `INSCRIPCION_NO_ENCONTRADA` · `FORMA_PAGO_NO_ENCONTRADA` | no existe |
| 409 | `TURNO_NO_ADMITE_PAGO` | clase `PENDIENTE` o `CANCELADO` (de Sprint 2) |
| 409 | `TURNO_YA_EMPEZO` | la clase ya empezó (**nuevo**, HU-I-10 criterio 7) |
| 409 | `RESERVA_VENCIDA` | la reserva venció (**nuevo**, HU-C-24 criterio 2) |
| 409 | `ALUMNO_NO_INSCRIPTO` | el alumno ya no está inscripto en la clase (de Sprint 2) |
| 409 | `INSCRIPCION_YA_PAGADA` | la clase ya tiene un pago no anulado (**nuevo**) |
| 409 | `FORMA_PAGO_NO_DISPONIBLE` | forma inactiva (de Sprint 2) |
| 409 | `CAJA_NO_ABIERTA` | el usuario no tiene caja abierta (**nuevo**, HU-I-12 criterios 2 y 9) |
| 409 | `CUPO_INSUFICIENTE` · `ALUMNO_NO_DISPONIBLE` · `ALUMNO_INACTIVO` | solo «Se inscribe al confirmar el pago», con los textos de HU-C-04 |
| 409 | `TRANSACCION_OCUPADA` | «Otra persona está modificando estos datos. Intentá de nuevo.» (`PR-0.md` §2.10) |
| 422 | `MATERIA_SIN_TARIFA` | solo «Se inscribe al confirmar el pago» (HU-L-06 criterio 5) |

El sobre de error es el de siempre (`{ data: null, error: { code, message, detalles? } }`); el `message` sale de la clave del archivo central de HU-C-23 (los códigos de Sprint 2 conservan su texto de hoy).

#### 2.7.7. Pruebas obligatorias

1. **Todo o nada:** con tres clases, una que falla (por ejemplo, ya empezó) no deja ninguna operación, pago ni comprobante, ni consume una inscripción de «Se inscribe al confirmar el pago».
2. **Concurrencia con PostgreSQL real:** dos cobros simultáneos de la misma inscripción (uno gana, el otro `INSCRIPCION_YA_PAGADA`); un cobro y un cierre de caja simultáneos en los dos órdenes (2.11); un cobro con inscripción contra una inscripción del mismo alumno en una clase superpuesta, sin interbloqueo (`PR-0.md` §2.16).
3. **Momento de comparación:** una fecha de pago pasada no habilita cobrar una clase que ya empezó ni una reserva vencida.
4. **Precio congelado:** cambiar la tarifa de la materia después de reservar no cambia el precio precargado ni el guardado; el ítem «Se inscribe al confirmar el pago» usa la tarifa vigente.
5. **Equivalencia de «Pagada»** sobre los datos que deja el servicio (`PR-0.md` §4).

---

### 2.8. Registrar pago desde el detalle de la clase: `POST /api/pagos` (HU-I-01) como atajo — NUEVA en Revisión 3

El botón «Registrar pago» del detalle de la clase se **mantiene** como atajo (HU-I-10 criterio 9). El contrato HTTP de 2.4 y 2.5 **y su comportamiento** se conservan; lo que cambia es solo de dónde sale el dato.

**Atajo de la interfaz (M-31).** Abre el mismo flujo de 2.7 con el alumno y la clase elegidos, limitado a esa clase (DEC-21), y registra con `POST /api/pagos/operaciones` con **un** ítem. Se ofrece solo en clases `DISPONIBLE`/`COMPLETO` que todavía no empezaron, para inscripciones `RESERVADA` no vencidas o `PAGO_SIN_REGISTRAR`, y solo a quien tiene `pagos:crear` (el Gerente ve el detalle en modo consulta y no ve el botón). La lista de inscriptos se arma con `GET /api/pagos/opciones` (abajo) y la condición con `puede_registrar_pago` de `spec_modulo_C.md` §2.18.4.

**`POST /api/pagos` (2.4).** Ruta, método, cuerpo `{ turno_id, alumno_id, monto, forma_pago_id, fecha_pago? }`, respuesta `201` con `PagoRegistrado` y los `code`/HTTP de 2.4 **no cambian**. Se admite un campo opcional nuevo, `motivo_ajuste` (mismo esquema que 2.7.3), y la respuesta puede traer campos extra: `operacion_id`, `inscripcion_id`, `precio` y `comprobante: { id, numero }`. Por dentro, `registrarPago` busca la inscripción vigente del par (clase, alumno) y llama a `registrarOperacion` con **un** ítem; sin inscripción vigente responde `409 ALUMNO_NO_INSCRIPTO`, como hoy.

| | `POST /api/pagos` (Sprint 2, **siempre**) | `POST /api/pagos/operaciones` (HU-I-10, 2.7) |
|---|---|---|
| Modo de `registrarOperacion` | `compatSprint2` (`PR-0.md` §2.13), permanente | `completo` |
| Clase ya iniciada | Se admite (Q6a) | `409 TURNO_YA_EMPEZO` |
| Segundo pago de la misma inscripción (parcial) | Se admite (AC3) | `409 INSCRIPCION_YA_PAGADA` |
| Monto distinto del precio | Se admite sin motivo (`motivo_ajuste` es opcional) | Exige `motivo_ajuste`: `400 MOTIVO_AJUSTE_REQUERIDO` |
| Caja | Exige caja abierta (`409 CAJA_NO_ABIERTA`) | Igual |
| Comprobante | Se emite | Igual |
| Orden de validación | El de 2.4 (clase, estado, inscripto, forma, fecha); la falta de caja se informa **al final** | El de 2.7.4 |
| Quién lo usa | Clientes de la API de Sprint 2 (Postman, tests) | Las pantallas «Registrar pago» (P-30) y el atajo del detalle (M-31) |

Ningún cambio de la tabla afecta a Sprint 2: el endpoint existente se comporta como hoy, salvo por la caja abierta que exige el backlog (HU-I-12, criterio 2; T12). Las reglas de HU-I-10 que Sprint 2 no tenía (clase iniciada, pago repetido, importe sin motivo) las aplica el flujo nuevo, que es el único que usa la interfaz (P-I1).

**`GET /api/pagos/opciones?turno_id=` (2.5).** Conserva ruta, parámetro y campos. `alumnos` pasa a ser los inscriptos **vigentes** (`obtenerAlumnosInscriptosDeTurno` de C, 2.15 Revisión 6). Se agregan, opcionales, por alumno: `inscripcion: { id, estado_pago, vence_el, precio }` y `cobrable: boolean` (misma condición que `puede_registrar_pago`), para que el atajo muestre «los inscriptos con pago pendiente» sin otra consulta. `forma_pago_preferida_id` se calcula como hoy (`null` si la preferida está desactivada). `preseleccionar_alumno_id` se conserva (solo si hay exactamente un inscripto). Sigue requiriendo `pagos:crear`.

---

### 2.9. Comprobante de pago (HU-I-11) — NUEVA en Revisión 3

> **Quién lo emite.** El comprobante lo emiten **solo** `emitirComprobante` y `emitirReemplazo` del PR 0 (`PR-0.md` §2.13), dentro de la transacción del cobro, de la corrección o de la anulación. Esta HU agrega la **vista**, la **impresión** y el **acceso por rol**; nunca emite ni modifica un comprobante.

#### 2.9.1. Emisión, numeración y reemplazos

- **Uno por operación.** Cada `OperacionPago` (HU-I-10, su atajo de 2.8 o `POST /api/pagos`) genera un comprobante con número único `0001-NNNNNNNN`: prefijo fijo `0001` y número correlativo de 8 dígitos (por ejemplo, `0001-00000123`). El entero lo asigna la secuencia `comprobante_numero_seq` **dentro de la misma transacción del pago** (`nextval` devuelve `bigint`: se convierte explícitamente a número), así dos cobros simultáneos no reciben el mismo número. Si una operación falla después de tomar un número, la numeración puede saltearlo; **un número nunca se repite** dentro de una base. Al regenerar la base con `prisma migrate reset` la secuencia vuelve a empezar (HU-I-11 criterio 1).
- **Copia fija.** Los datos del comprobante (alumno, clases, montos, forma de pago) se guardan al emitirlo en `Comprobante.datos` y **no se recalculan**: un comprobante emitido conserva el nombre de la forma de pago aunque después se la renombre (HU-I-07 criterio 2) y no cambia aunque se corrija la operación (HU-I-11 criterio 5).
- **Reemplazo.** Si se **corrige** un pago, o se cambia la forma o la fecha de pago de la operación, o se **anula** un pago de una operación que tiene otros pagos vigentes, el servicio emite un comprobante nuevo con los pagos vigentes de la operación (valores corregidos) y `reemplazaAId` apunta al anterior. La base impide que dos comprobantes reemplacen al mismo (`reemplazaAId` único).
- **Anulación total.** Si se anula el último pago vigente de la operación no se emite nada: el comprobante vigente queda con la marca «ANULADO» (se **deriva** al leerlo, 2.9.4).
- **El comprobante emitido nunca se modifica.** Las marcas «ANULADO» y «Reemplazado por <número>» no se guardan en él: salen de los registros de anulación y de reemplazo que lo referencian (Regla N.° 8).

#### 2.9.2. Contenido (`Comprobante.datos`, contrato Zod único en el PR 0: R3-PR0-7)

```json
{
  "version": 1,
  "centro": { "nombre": "Instituto Noctium", "domicilio": "Av. Siempreviva 742", "telefono": "351-4000000" },
  "alumno": { "id": "cuid", "nombre": "Ana", "apellido": "Pérez", "dni": "40100001" },
  "fecha_pago": "2026-10-09",
  "forma_pago": { "id": "cuid", "nombre": "Transferencia" },
  "registrado_por": { "usuario_id": "cuid", "nombre_completo": "Ruiz, Marta" },
  "clases": [
    { "pago_id": "cuid", "materia": { "id": "cuid", "nombre": "Física I" }, "fecha": "2026-10-12", "hora_inicio": "18:00",
      "precio": 24000, "monto": "22000.00" }
  ],
  "total": "22000.00"
}
```

- Los datos del centro (nombre, domicilio y teléfono) son valores fijos de configuración del sistema (`centro_nombre`, `centro_domicilio`, `centro_telefono` de `ParametroSistema`, `PR-0.md` §2.6) que se copian al emitir. El prototipo muestra el CUIT en lugar del teléfono: manda el backlog (DEC-34).
- `registrado_por` conserva el **usuario real** que registró el cobro (nombre de `obtenerNombresPersonal`, spec F §2.7). El reemplazo por «Registrado en el centro» lo hace la vista del alumno (2.9.3), no el servicio de emisión (HU-I-11 criterio 2).
- La leyenda «Comprobante interno. No válido como factura» (criterio 3) es un texto fijo de la interfaz (archivo central de HU-C-23), no un dato del comprobante.
- `precio` se guarda en la copia fija, pero ninguna vista lo muestra: el backlog pide materia, fecha, hora y monto de cada clase.

#### 2.9.3. Rutas de lectura

| Ruta | Permiso | Devuelve |
|---|---|---|
| `GET /api/comprobantes/[id]` | `comprobantes:leer` (Mesa de Entrada, Gerente) | El comprobante pedido. Lo usa la confirmación del pago (`comprobante.id` de 2.7.5) |
| `GET /api/pagos/[id]/comprobante` | `comprobantes:leer` | **El comprobante vigente de la operación del pago.** Desde un pago anulado, **el último comprobante que lo incluyó** (el más reciente cuyo `datos.clases` contiene el `pago_id`) |
| `GET /api/mis-pagos/[id]/comprobante` | `comprobantes:leer_propios` (Alumno) | Lo mismo que la ruta anterior, solo si el pago es del alumno de la sesión, con la vista del alumno |

```json
{
  "data": {
    "id": "cuid", "numero": "0001-00000123", "emitido_el": "2026-10-09T15:31:00-03:00",
    "centro": { "nombre": "...", "domicilio": "...", "telefono": "..." },
    "alumno": { "nombre_completo": "Pérez, Ana", "dni": "40100001" },
    "fecha_pago": "2026-10-09", "forma_pago": { "nombre": "Transferencia" },
    "registrado_por": "Ruiz, Marta",
    "clases": [{ "materia": "Física I", "fecha": "2026-10-12", "hora_inicio": "18:00", "monto": "22000.00" }],
    "total": "22000.00",
    "marcas": {
      "anulado": { "fecha": "2026-10-10", "motivo": "Reintegro" },
      "reemplazado_por": { "id": "cuid", "numero": "0001-00000130" },
      "reemplaza_a": null
    }
  },
  "error": null
}
```

- Cada marca es `null` cuando no corresponde. `reemplaza_a` indica a qué número reemplaza un comprobante de reemplazo.
- **Vista del alumno** (`/api/mis-pagos/[id]/comprobante`): se omite `registrado_por` y se agrega `registrado_en_el_centro: true` (la interfaz muestra «Registrado en el centro», igual que «Mis pagos»); en `marcas.anulado` viaja la `fecha` pero **no el `motivo`**, que es un dato interno (HU-I-11 criterio 5). Lo omite el servidor: el dato no llega al navegador del alumno.
- **Imprimir.** El botón «Imprimir» llama a `window.print()` con una hoja de estilos de impresión que deja solo el comprobante, sin menú ni resto de la pantalla; desde el diálogo del navegador también se guarda como PDF, **sin librería de PDF** (HU-I-11 criterio 4). No hay envío por email (criterio 6).
- **Dónde se ve:** la confirmación del pago, la lista «Pagos registrados» del detalle de la clase, el historial de pagos del alumno (2.13) y «Mis pagos» (2.15).

#### 2.9.4. Marcas y comprobante vigente (derivados)

- **Vigente de una operación:** el comprobante de la operación que ningún otro reemplaza (no existe otro con `reemplazaAId` igual a su id).
- **«Reemplazado por <número>»:** existe un comprobante cuyo `reemplazaAId` es el id de este.
- **«ANULADO»:** todos los pagos de la operación tienen `AnulacionPago`; la fecha y el motivo son los de la última anulación. Solo se marca el comprobante vigente.
- Un pago corregido sigue apuntando a la misma operación: su comprobante vigente es el último reemplazo.

#### 2.9.5. Errores esperados

- `403 SIN_PERMISO` — el Profesor, aunque llegue desde el detalle de su clase, o cualquier rol sin el permiso (HU-I-11 criterio 4).
- `403 FUERA_DE_ALCANCE` — un alumno que pide el comprobante de un pago de otro alumno (HU-I-05 criterio 4).
- `404 COMPROBANTE_NO_ENCONTRADO` · `404 PAGO_NO_ENCONTRADO`.

---

### 2.10. Caja: abrir, registrar movimientos y consultar la propia (HU-I-12) — NUEVA en Revisión 3

> **Compatibilidad.** Antes de este sprint no había caja. Desde el merge del PR 0 todo pago pertenece a la caja abierta de quien lo registra (`PR-0.md` §2.5 y §2.15): el seed deja una caja abierta por cuenta de mesa de entrada y un script (`npm run caja:abrir -- <email>`) abre la de una cuenta creada por el seed. Esta HU agrega las pantallas y los endpoints. Los servicios (`abrirCaja`, `cajaAbiertaDe`, `registrarMovimiento`, `anularMovimiento`, `registrarAjuste`, `cerrarCaja`, `declararEfectivo`) los entrega el PR 0.

**Pantalla:** «Mi caja» (`/caja`, sugerida; P-34). La caja **no depende de la fecha del calendario**: dura hasta que se cierra y puede pasar la medianoche (HU-I-12 criterio 1). Cada integrante de mesa de entrada tiene como máximo una caja abierta.

#### 2.10.1. Abrir la caja

**Ruta:** `POST /api/cajas` (Route Handler en `src/app/api/cajas/route.ts`) · **Permiso:** `cajas:abrir` (Mesa de Entrada) · **Servicio:** `abrirCaja()`
**Confirmación (HU-C-25):** con el fondo inicial.

```typescript
export const AbrirCajaSchema = z.object({
  fondo_inicial: z.string().trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "El fondo inicial debe ser un número igual o mayor a 0 con hasta 2 decimales"), // puede ser 0
}).strict();
```

1. `bloquearIntegranteActivo(tx, usuarioId)` (spec F §2.7): la cuenta tiene que tener su ficha de mesa de entrada activa.
2. Inserta la `Caja` `ABIERTA` con `abiertaEl = ahora()`, el fondo y el usuario. **La garantía de «una sola caja abierta» es el índice único parcial** (`PR-0.md` §2.5) con la captura de `P2002`, traducida a `409 CAJA_YA_ABIERTA`: dos aperturas simultáneas del mismo integrante dejan una sola (Regla N.° 7).

**Respuesta `201`:** `{ "data": { "id": "cuid", "abierta_el": "2026-10-09T09:00:00-03:00", "fondo_inicial": "5000.00" }, "error": null }`

#### 2.10.2. La caja propia (arqueo ciego)

**Ruta:** `GET /api/cajas/mia` · **Permiso:** `cajas:leer` · **Servicio:** `obtenerCajaPropia()`

Devuelve la caja abierta del usuario de la sesión, o `{ "caja": null }`:

```json
{
  "data": {
    "caja": {
      "id": "cuid", "abierta_el": "2026-10-09T09:00:00-03:00", "fondo_inicial": "5000.00",
      "efectivo_declarado": null,
      "items": [
        { "tipo": "COBRO", "id": "cuid", "momento": "2026-10-09T10:15:00-03:00", "detalle": "Pérez, Ana · Física I 12/10",
          "forma_pago": { "id": "cuid", "nombre": "Efectivo" }, "monto": "22000.00", "anulado": false },
        { "tipo": "MOVIMIENTO", "id": "cuid", "momento": "2026-10-09T11:00:00-03:00", "detalle": "Ingreso · Ingreso de cambio",
          "movimiento": "INGRESO", "monto": "1000.00", "anulado": false },
        { "tipo": "AJUSTE", "id": "cuid", "momento": "2026-10-09T12:00:00-03:00", "detalle": "Ajuste · Reintegro",
          "forma_pago": { "id": "cuid", "nombre": "Efectivo" }, "monto": "-24000.00", "anulado": false }
      ]
    }
  },
  "error": null
}
```

- Lista los **cobros** (pagos de las operaciones de esa caja, con el monto y la forma vigentes), los **movimientos** y los **ajustes**, del más nuevo al más viejo. Los anulados se muestran como anulados (`anulado: true`).
- **Arqueo ciego (HU-I-12 criterio 5):** mientras la caja está abierta, **el servidor no devuelve totales, ni subtotales, ni el efectivo esperado**. Solo los montos individuales. `efectivo_declarado` es el monto que el propio usuario ya declaró (`null` si todavía no): si no es `null`, «Cerrar caja» entra directo al paso 2 (2.11).

#### 2.10.3. Registrar un movimiento manual

**Ruta:** `POST /api/cajas/mia/movimientos` · **Permiso:** `cajas:movimiento` · **Servicio:** `registrarMovimiento()` · **Confirmación (HU-C-25):** con tipo, monto y concepto.

```typescript
export const RegistrarMovimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  monto: montoSchema,                                              // positivo, hasta 2 decimales
  concepto: z.string().trim().min(1, "Ingresá el concepto").max(200, "El concepto no puede superar los 200 caracteres"),
}).strict();
```

Con la caja bloqueada (`bloquear({ cajas: [id] })`): la caja sigue `ABIERTA` (si no, `409 CAJA_NO_ABIERTA`); un **egreso** no puede superar el efectivo que la caja debería tener en ese momento, calculado dentro de la transacción (`409 EGRESO_SUPERA_EFECTIVO`, cuyo mensaje **no muestra el esperado**, para no romper el arqueo ciego). Un movimiento **no se edita**. Respuesta `201`: `{ id, tipo, monto, concepto, momento }`.

#### 2.10.4. Anular un movimiento

**Ruta:** `POST /api/cajas/mia/movimientos/[movimientoId]/anulacion` · **Permiso:** `cajas:movimiento` · **Servicio:** `anularMovimiento()` · **Confirmación (HU-C-25):** irreversible.

Body: `{ "motivo": string }` (obligatorio, hasta 300 caracteres, `motivoSchema` de 2.7.3). Mientras la caja está abierta y con ella bloqueada: el movimiento es de esa caja (`404 MOVIMIENTO_NO_ENCONTRADO`), no está anulado (`409 MOVIMIENTO_YA_ANULADO`) y, si es un **ingreso**, anularlo no deja el efectivo esperado negativo (`409 ANULACION_DEJA_EFECTIVO_NEGATIVO`, sin mostrar el esperado; DEC-31). La anulación es un registro nuevo (`AnulacionMovimiento`, único por movimiento) que lo referencia (Regla N.° 8). Se registra uno nuevo si hace falta corregir (criterio 3).

#### 2.10.5. Errores esperados de caja (2.10 a 2.12)

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | fondo, monto, concepto o motivo inválidos; campo extra |
| 400 | `MOTIVO_DIFERENCIA_REQUERIDO` | cierre con diferencia sin motivo (2.11) |
| 403 | `SIN_PERMISO` · `FUERA_DE_ALCANCE` | rol sin el permiso (el Gerente no abre cajas ni registra movimientos; el Profesor y el Alumno no acceden); o la caja o el cierre es de otro integrante |
| 404 | `CAJA_NO_ENCONTRADA` · `MOVIMIENTO_NO_ENCONTRADO` | no existe |
| 409 | `CAJA_YA_ABIERTA` | el integrante ya tiene una caja abierta (índice único parcial) |
| 409 | `INTEGRANTE_INACTIVO` | la ficha de mesa de entrada no existe o está inactiva (`bloquearIntegranteActivo`; el `code` lo fija el PR 0) |
| 409 | `CAJA_NO_ABIERTA` | no hay caja abierta del usuario (cobros, movimientos, ajustes, declaración; 3.10). Mensaje del criterio 2; la interfaz usa el del criterio 9 si la caja se cerró durante la operación (T12) |
| 409 | `CAJA_YA_CERRADA` | doble cierre, o cierre por ausencia simultáneo con el del integrante |
| 409 | `CAJA_NO_CERRADA` | el gerente pide el detalle de un cierre de una caja que sigue abierta (el arqueo es ciego) |
| 409 | `EGRESO_SUPERA_EFECTIVO` · `ANULACION_DEJA_EFECTIVO_NEGATIVO` | sin mostrar el efectivo esperado |
| 409 | `MOVIMIENTO_YA_ANULADO` | ya estaba anulado |
| 409 | `EFECTIVO_YA_DECLARADO` · `EFECTIVO_NO_DECLARADO` | declarar dos veces; pedir el resumen o cerrar sin declarar (2.11) |
| 409 | `CAJA_CAMBIO` | la caja cambió desde que se mostró el resumen (2.11). `detalles` trae el resumen y la huella nuevos |
| 409 | `TRANSACCION_OCUPADA` | «Otra persona está modificando estos datos. Intentá de nuevo.» |

---

### 2.11. Cerrar la caja con arqueo ciego (HU-I-12) — NUEVA en Revisión 3

El cierre tiene **dos pasos** y el monto declarado queda fijo desde el primero (criterio 5, DEC-24). El efectivo esperado no sale del servidor hasta que el monto está declarado.

| Paso | Ruta | Permiso | Servicio |
|---|---|---|---|
| 1 · Declarar el efectivo contado | `POST /api/cajas/mia/declaracion` | `cajas:cerrar` | `declararEfectivo()` |
| 2 · Ver el resumen (y volver a verlo) | `GET /api/cajas/mia/resumen` | `cajas:cerrar` | `obtenerResumenCierre()` (usa `calcularResumen`) |
| 2 · Confirmar el cierre | `POST /api/cajas/mia/cierre` | `cajas:cerrar` | `cerrarCaja()` |

**Paso 1 · Declarar.** Body `{ "efectivo_declarado": string }` (monto igual o mayor que 0, mismo formato que el fondo inicial). Con la caja bloqueada y `ABIERTA`: guarda el monto en `Caja.efectivoDeclarado` con una condición atómica (`updateMany ... WHERE efectivoDeclarado IS NULL`, Regla N.° 7); si ya había uno, `409 EFECTIVO_YA_DECLARADO` («desde ese momento el monto declarado no se puede cambiar»). Responde `200` con el resumen y la huella del paso 2. **La caja sigue `ABIERTA`**: admite cobros y movimientos mientras se cierra (criterio 5; DEC-34); `cerrarCaja` usa siempre el monto guardado, nunca uno nuevo.

**Paso 2 · Resumen.** `GET .../resumen` responde `409 EFECTIVO_NO_DECLARADO` si todavía no hay monto declarado (así nadie puede ver el esperado antes de declarar) y, si lo hay, el resumen actualizado:

```json
{
  "data": {
    "caja_id": "cuid", "abierta_el": "2026-10-09T09:00:00-03:00",
    "resumen": {
      "fondo_inicial": "5000.00",
      "cobros_por_forma": [
        { "forma_pago": { "id": "cuid", "nombre": "Efectivo", "es_efectivo": true }, "cantidad": 3, "total": "46000.00" },
        { "forma_pago": { "id": "cuid", "nombre": "Transferencia", "es_efectivo": false }, "cantidad": 1, "total": "22000.00" }
      ],
      "ingresos_manuales": "1000.00",
      "egresos_manuales": "500.00",
      "ajustes": [{ "forma_pago": { "id": "cuid", "nombre": "Efectivo", "es_efectivo": true }, "total": "-24000.00" }],
      "efectivo_esperado": "27500.00",
      "efectivo_declarado": "26000.00",
      "diferencia": "-1500.00",
      "tipo_diferencia": "FALTANTE"
    },
    "huella": "9f2c…"
  },
  "error": null
}
```

- **Efectivo esperado** = fondo inicial + cobros en efectivo + ingresos manuales − egresos manuales ± ajustes en efectivo (criterio 6). Suma **solo** las formas con `esEfectivo = true`; las demás se informan pero no entran en el arqueo. Los cobros se toman con el monto y la forma **vigentes** y sin los pagos anulados; los ingresos y egresos, sin los movimientos anulados.
- **Diferencia** = `efectivo_declarado − efectivo_esperado`, **con signo**. `tipo_diferencia` ∈ `SOBRANTE | FALTANTE | CUADRA`; la interfaz arma «Sobrante de $ <monto>», «Faltante de $ <monto>» o «La caja cuadra» (criterio 7).
- **Huella:** valor opaco que resume lo que el usuario vio: el efectivo esperado y, por tipo, la cantidad y el último id de los cobros, las correcciones, las anulaciones de pagos, los movimientos, las anulaciones de movimientos y los ajustes de la caja (R3-PR0-6). Se la envía de vuelta al confirmar.

**Paso 2 · Confirmar.** Body `{ "huella": string, "motivo"?: string }` (motivo de hasta 300 caracteres). **Confirmación (HU-C-25), irreversible:** «¿Estás seguro de que querés cerrar tu caja con un faltante de $ 1.500? Esta acción no se puede deshacer.»

Con la caja bloqueada dentro de la transacción (`bloquear({ cajas: [id] })`):
1. La caja está `ABIERTA` (`409 CAJA_YA_CERRADA` si no) y tiene monto declarado (`409 EFECTIVO_NO_DECLARADO`).
2. Recalcula el resumen y la huella. Si la huella cambió —entró un cobro, un movimiento, un ajuste, una corrección o una anulación, **aunque sea en una forma de pago que no es efectivo**— responde `409 CAJA_CAMBIO` («La caja cambió mientras cerrabas. Revisá el resumen.») con el resumen y la huella nuevos en `detalles`, **sin cerrar**. Se mantiene el mismo monto declarado; si con el nuevo esperado aparece o cambia la diferencia, el motivo se pide de nuevo.
3. Si la diferencia es distinta de cero, el `motivo` es **obligatorio** (`400 MOTIVO_DIFERENCIA_REQUERIDO`). Si coincide («La caja cuadra»), el motivo es una observación opcional.
4. Cierra con **una sola actualización condicional** (`updateMany ... WHERE id = ? AND estado = 'ABIERTA'`, Regla N.° 7): `estado = CERRADA`, `cerradaEl = ahora()`, `cerradaPor`, `efectivoEsperado`, `diferencia`, `motivo` y `resumen` (el JSON fijo de arriba). Si no actualiza ninguna fila, `409 CAJA_YA_CERRADA`.

**Respuesta `200`:** `{ "data": { "caja_id": "cuid", "estado": "CERRADA", "cerrada_el": "…", "diferencia": "-1500.00", "tipo_diferencia": "FALTANTE", "por_ausencia": false }, "error": null }`.

**Después del cierre la caja es inmutable** (criterio 8): no se le agregan cobros, movimientos ni ajustes, y su `resumen` no cambia aunque después se corrijan pagos (los cambios sobre pagos de una caja cerrada se registran como ajustes en una caja abierta, 2.14.4). Para volver a cobrar hay que abrir una caja nueva.

**Concurrencia (criterio 9).** El cierre bloquea la caja y calcula ahí el esperado; los cobros, los movimientos y los ajustes toman el mismo bloqueo y verifican que la caja siga abierta. Un cobro y un cierre simultáneos **no pueden confirmarse los dos**: si el cobro confirma primero, el cierre falla por `CAJA_CAMBIO`; si el cierre confirma primero, el cobro falla por `CAJA_NO_ABIERTA` («Tu caja se cerró. Abrí una caja nueva para registrar el cobro.»). Se prueba en los dos órdenes con PostgreSQL real.

---

### 2.12. Cajas del gerente, cierres y cierre por ausencia (HU-I-12) — NUEVA en Revisión 3

| Qué | Ruta | Permiso |
|---|---|---|
| Mis cierres (mesa de entrada) | `GET /api/cajas/mia/cierres?pagina=` | `cajas:leer` |
| Detalle de uno de mis cierres | `GET /api/cajas/mia/cierres/[id]` (`403 FUERA_DE_ALCANCE` si es de otro integrante) | `cajas:leer` |
| Cajas abiertas y todos los cierres | `GET /api/cajas?integrante_id=&desde=&hasta=&pagina=` | `cajas:leer_todas` (Gerente) |
| Detalle de un cierre | `GET /api/cajas/[id]` (`409 CAJA_NO_CERRADA` si la caja sigue abierta) | `cajas:leer_todas` |
| Cierre por ausencia: declarar, ver el resumen y cerrar | `POST /api/cajas/[id]/ausencia/declaracion`, `GET /api/cajas/[id]/ausencia/resumen`, `POST /api/cajas/[id]/ausencia/cierre` | `cajas:cerrar_ausencia` (Gerente) |

**Listado del gerente (criterio 11).** Respuesta:

```json
{
  "data": {
    "abiertas": [{ "id": "cuid", "integrante": { "id": "cuid", "nombre_completo": "Ruiz, Marta" }, "abierta_el": "2026-10-08T09:00:00-03:00", "antiguedad_minutos": 1620 }],
    "cierres": {
      "items": [{ "id": "cuid", "integrante": { "id": "cuid", "nombre_completo": "Ruiz, Marta" }, "abierta_el": "…", "cerrada_el": "…",
                  "fondo_inicial": "5000.00", "efectivo_esperado": "27500.00", "efectivo_declarado": "26000.00",
                  "diferencia": "-1500.00", "tipo_diferencia": "FALTANTE", "motivo": "…", "por_ausencia": false, "cerrada_por": null }],
      "paginacion": { "total": 12, "pagina_actual": 1, "total_paginas": 2, "por_pagina": 10 }
    }
  },
  "error": null
}
```

- `integrante_id` y el rango `desde`–`hasta` (fechas de **cierre**, DEC-30) filtran los **cierres**; las cajas abiertas se listan siempre completas, con su antigüedad (calculada con `ahora()` al responder). Cierres: más nuevos primero, **de a 10**. «Mis cierres» tiene las mismas columnas sin el integrante.
- **El Gerente ve las cajas abiertas solo con su antigüedad**, no su contenido: el arqueo ciego rige también para él. No abre cajas, no registra movimientos ni cierra cajas ajenas, salvo el cierre por ausencia.
- **Detalle de un cierre** (`GET /api/cajas/[id]` y `/mia/cierres/[id]`): integrante, apertura y cierre, `por_ausencia` y el gerente responsable (`cerrada_por`), el `resumen` **tal como quedó al cerrar** (nunca se recalcula, criterio 8), efectivo declarado, `diferencia`, `motivo`, y los datos del centro para la impresión. El botón «Imprimir» (`window.print()`, sin librería de PDF) muestra solo el cierre: datos del centro, integrante, apertura y cierre, el resumen, la diferencia, el motivo y la **fecha de impresión** (la arma el cliente).

**Cierre por ausencia (criterio 10).** Si el integrante no puede cerrar su caja (por ejemplo, dejó el centro), el Gerente la cierra con el **mismo arqueo ciego**: cuenta él el efectivo y lo declara. Son los mismos tres pasos de 2.11 sobre las rutas `/api/cajas/[id]/ausencia/...`, con estas diferencias: la caja tiene que ser de **otro** integrante y estar `ABIERTA`; el cierre queda marcado `porAusencia = true` con el Gerente en `cerradaPor` como responsable; la confirmación de HU-C-25 es la misma (irreversible). Si el integrante cierra su caja a la vez, gana el primero y el otro recibe `409 CAJA_YA_CERRADA`.

**Baja con la caja abierta.** HU-F-05 consulta `cajaAbiertaDe(tx, usuarioId)` (2.17) y rechaza desactivar al integrante mientras tenga la caja abierta (`spec_modulo_F.md` §2.6, `409 CAJA_ABIERTA`). Esa verificación diferida se cumple cuando esté HU-F-05.

---

### 2.13. Historial de pagos del alumno (HU-I-02) — NUEVA en Revisión 3

Es la pestaña «Pagos» de la ficha del alumno (P-28). No tiene resumen ni «Estado de cuenta» (criterio 1) y **no calcula saldo ni deuda** (criterio 5): lo pendiente de cobro se ve en «Registrar pago» (2.7). La misma consulta, acotada al alumno de la sesión, sirve a «Mis pagos» (2.15).

#### 2.13.1. Modo historial

**Ruta:** `GET /api/pagos/historial?alumno_id=&desde=&hasta=&forma_pago_id=&materia_id=&pagina=` · **Permiso:** `pagos:leer` (Mesa de entrada y Gerente; el Gerente en modo consulta) · **Servicio:** `listarHistorialDePagos()` en `pago.service.ts`, sobre `listarPagosDeAlumno` (2.17).

```typescript
// src/server/pagos/pago.schema.ts
export const HistorialPagosQuerySchema = z.object({
  alumno_id: z.string().cuid(),
  desde: fechaCalendarioValidaSchema.optional(),   // fecha de pago vigente, inclusiva
  hasta: fechaCalendarioValidaSchema.optional(),   // si hay ambas, desde <= hasta
  forma_pago_id: formaPagoIdSchema.optional(),     // activa o inactiva
  materia_id: z.string().trim().min(1).optional(),
  estado_pago: z.enum(["PAGADA", "RESERVADA", "PAGO_SIN_REGISTRAR"]).optional(), // modo de 2.13.3
  pagina: z.coerce.number().int().positive().default(1),
}).strict().refine(
  (q) => q.estado_pago === undefined || (q.forma_pago_id === undefined && q.materia_id === undefined),
  "El estado de pago solo se combina con el rango de fechas",
);
```

El tamaño de página es **fijo en 10** (criterio 2); no hay `por_pagina`.

**Comportamiento (sin `estado_pago`):**
1. `404 ALUMNO_NO_ENCONTRADO` si la ficha no existe (`obtenerAlumnosBasicos`). Se lista **aunque el alumno esté inactivo**: es historia.
2. Pagos del alumno como pagador, en **cualquier clase**, incluidos los de clases de las que fue quitado o cuya inscripción canceló (criterio 5). Los filtros se combinan con «y»:
   - `desde`/`hasta`: sobre la **fecha de pago vigente** (la de la operación con su última corrección, 2.6.2);
   - `forma_pago_id`: sobre la forma vigente de la operación;
   - `materia_id`: sobre la materia de la clase del pago.
3. Orden: fecha de pago vigente descendente; desempate por momento de registro descendente y por id.
4. **`total_pagado`:** suma de los montos vigentes de los pagos **no anulados** de **todo** el resultado filtrado (no solo de la página), como texto decimal exacto de dos decimales. Los anulados se muestran y no suman.
5. **Composición (Regla N.° 3).** `pago.service.ts` pide a `listarPagosDeAlumno` (2.17) los pagos del alumno con los filtros de fecha y forma, completa los datos de la clase (fecha, hora, materia) con **una** lectura en lote de C (`obtenerClasesBasicas`) y el nombre de quien registró con `obtenerNombresPersonal` de F (`spec_modulo_F.md` §2.7); aplica el filtro por materia, calcula `total_pagado` y pagina **en memoria**. El volumen de pagos de un alumno es acotado, y esto evita que I lea las tablas de clases o materias. Sin consultas por fila.

**Respuesta `200 OK`:**

```json
{
  "data": {
    "modo": "HISTORIAL",
    "total_pagado": "48000.00",
    "items": [{
      "pago_id": "cuid",
      "fecha_pago": "2026-10-08",
      "registrado_en": "2026-10-08T10:12:00-03:00",
      "clase": { "turno_id": "cuid", "fecha": "2026-10-12", "hora_inicio": "18:00", "materia": { "id": "cuid", "nombre": "Física I" } },
      "precio": 24000,
      "monto": "20000.00",
      "monto_original": "24000.00",
      "forma_pago": { "id": "cuid", "nombre": "Efectivo", "is_active": true },
      "registrado_por": { "usuario_id": "cuid", "nombre_completo": "Ruiz, Marta" },
      "ajuste": { "motivo": "Beca parcial", "ajustado_por": { "usuario_id": "cuid", "nombre_completo": "Ruiz, Marta" } },
      "anulado": false,
      "comprobante": { "id": "cuid", "numero": "0001-00000123" },
      "operacion": { "id": "cuid", "clases": 2 },
      "cambios": 1,
      "puede_corregir": true
    }],
    "paginacion": { "total": 14, "pagina_actual": 1, "total_paginas": 2, "por_pagina": 10 }
  },
  "error": null
}
```

- `precio` es el entero en pesos que quedó **congelado en la inscripción** (HU-L-06): no cambia si la tarifa cambia después. `monto` es el **vigente**; `monto_original` solo viene si el pago se corrigió (si no, es `null`).
- `ajuste` (precio, motivo y quién lo cambió, criterio 2) viene solo cuando el importe cobrado difería del precio al registrar (`motivoAjuste` del pago, HU-I-10 criterio 4); si no, `null`. La corrección posterior de un monto se ve en el historial de cambios (2.14.6), no acá.
- `comprobante` es el **vigente** de la operación del pago; para un pago anulado, el último que lo incluyó (2.9.3). `operacion.clases` es la cantidad de pagos no anulados de la operación (la usa el aviso de 2.14.2).
- `cambios` es la cantidad de correcciones y anulaciones del pago («Historial de cambios (N)»).
- `puede_corregir` lo calcula `puedeCorregirPago` (2.14.1) y **solo oculta botones**; el servidor lo vuelve a verificar. Es `false` para el Gerente solo cuando el pago ya está anulado.
- `registrado_por.nombre_completo` es `null` si el usuario no tiene ficha de mesa de entrada (por ejemplo, un pago de datos de prueba); la interfaz muestra «—».
- No se envían las cajas ni los totales de caja: el historial del alumno no lleva datos de arqueo.

#### 2.13.2. Opciones de los filtros

`GET /api/pagos/historial/opciones?alumno_id=` (mismo permiso) devuelve `{ formas_pago: [{ id, nombre, is_active }], materias: [{ id, nombre }] }`: las formas **usadas** en pagos de ese alumno —también las inactivas, criterio 3— y las materias de las clases con pagos (anulados incluidos), ambas en orden alfabético normalizado. «Limpiar filtros» es solo de la interfaz: vuelve a pedir sin filtros y a la página 1.

#### 2.13.3. Modo «Estado de pago»

Con `estado_pago` la respuesta **no lista pagos sino clases** (criterio 4):

1. Lee `listarInscripcionesDeAlumno(alumnoId, { desde, hasta, estadoPago })` de C (con el filtro que agrega HU-I-02 en la misma fachada; `PR-0.md` §2.13), clasificando con `esVigenteEn(inscripcion, ahora())`: una reserva vencida sin marcar **no** es vigente, así que ni figura como «Reservada» ni se lista (aunque el proceso de HU-C-24 todavía no la haya cancelado).
2. Solo clases en estado guardado `DISPONIBLE` o `COMPLETO` donde el alumno tiene una inscripción **vigente** en el estado pedido: `PAGADA` (tiene un pago no anulado), `RESERVADA` (reserva con plazo) o `PAGO_SIN_REGISTRAR` (vigente, sin pago y sin reserva vigente).
3. `desde`/`hasta` filtran por la **fecha de la clase**, no por la de pago. `forma_pago_id` y `materia_id` no se aceptan (el `refine` de arriba responde `400`); la interfaz los limpia y deshabilita con la leyenda «El estado de pago solo se combina con el rango de fechas».
4. Orden: fecha y hora de la clase descendente (el backlog no fija el orden). Se pagina de a 10 en este servicio sobre la lista que devuelve C (el volumen de un alumno es acotado). No hay `total_pagado`.

```json
{
  "data": {
    "modo": "ESTADO_DE_PAGO",
    "items": [{
      "inscripcion_id": "cuid",
      "turno_id": "cuid",
      "fecha": "2026-10-12", "hora_inicio": "18:00",
      "materia": { "id": "cuid", "nombre": "Física I" },
      "profesor": { "id": "cuid", "nombre_para_mostrar": "Gómez, Laura" },
      "precio": 24000,
      "estado_pago": "RESERVADA",
      "vence_el": "2026-10-11T18:00:00-03:00",
      "puede_registrar_pago": true
    }],
    "paginacion": { "total": 3, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 10 }
  },
  "error": null
}
```

- `precio` es el congelado en la inscripción. `vence_el` solo viene con `RESERVADA`. La interfaz muestra el estado con texto o ícono, no solo color.
- `puede_registrar_pago` es la condición de `spec_modulo_C.md` §2.18.4 (permiso `pagos:crear`, clase `DISPONIBLE`/`COMPLETO` que todavía no empezó, inscripción `RESERVADA` no vencida o `PAGO_SIN_REGISTRAR`). Es siempre `false` para el Gerente. «Registrar pago» abre 2.7 con el alumno y esa clase ya elegidos (DEC-21).

#### 2.13.4. Errores y mensajes

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | `alumno_id` faltante o inválido, fecha inválida, `desde` > `hasta`, `pagina` inválida, `estado_pago` junto con forma o materia, campo extra |
| 403 | `SIN_PERMISO` | rol sin `pagos:leer` (Profesor y Alumno; Q6d, criterio 7) |
| 404 | `ALUMNO_NO_ENCONTRADO` | la ficha no existe |

Los textos «Este alumno no tiene pagos registrados» (sin ningún pago), «No hay pagos para los filtros elegidos» y «No hay clases con ese estado de pago en el período» (criterio 6) son de la interfaz y salen del archivo central de HU-C-23: el servidor devuelve `items: []`; la interfaz distingue «no tiene pagos» de «los filtros no encuentran nada» porque sabe si hay filtros aplicados.

**Pruebas obligatorias:** el total es el de todo el resultado y no el de la página; un pago anulado se lista y no suma; un pago corregido muestra el monto vigente en lista, total y filtros; el filtro por forma incluye una forma inactiva usada; el pago de una clase de la que el alumno fue quitado sigue apareciendo; una reserva vencida sin marcar no figura como `RESERVADA`; Profesor y Alumno reciben `403`.

---

### 2.14. Corregir y anular un pago (HU-I-06) — NUEVA en Revisión 3

El pago original **nunca se actualiza ni se borra** (Regla N.° 8): cada cambio es un registro nuevo que lo referencia (`CorreccionPago`, `CorreccionOperacion`, `AnulacionPago`; 2.6.1) y todo lo que se muestra o se suma usa el valor vigente (2.6.2). Los servicios que escriben son `corregirPago`, `corregirOperacion` y `anularPago` del PR 0 (`PR-0.md` §2.13); esta HU agrega las rutas, el alcance por rol y el historial de cambios. Un pago de otro alumno **no se reasigna**: se anula y mesa de entrada lo registra de nuevo con 2.7 (criterio 2; el Gerente anula pero no registra).

#### 2.14.1. Alcance (`puedeCorregirPago`)

| Quién | Puede corregir o anular |
|---|---|
| Gerente (`pagos:corregir`) | Cualquier pago no anulado, de cualquier caja y antigüedad |
| Mesa de entrada (`pagos:corregir`) | Solo un pago **registrado hace 30 días o menos** (contados desde el momento de **registro**, `registrado_en`, no desde la fecha de pago) **y** cuya caja siga `ABIERTA`, sea la suya o la de otro integrante (DEC-25) |
| Profesor, Alumno | Nunca: `403 SIN_PERMISO` |

- Fuera de alcance → `403 FUERA_DE_ALCANCE` (criterio 5). Con la caja del pago cerrada, **mesa de entrada no puede** cambiar el pago y no hay camino alternativo para ella (T13, DEC-34).
- `puedeCorregirPago(usuario, pago)` es el helper único del PR 0; las pantallas lo usan para mostrar u ocultar «Corregir» y «Anular» y el servidor lo ejecuta **después de bloquear** (2.14.2 paso 3). Un pago anulado no se corrige ni se vuelve a anular.
- «Hace 30 días o menos» se evalúa con `ahora()`: `registrado_en >= ahora() − 30 días`.

#### 2.14.2. Corregir

**Ruta:** `POST /api/pagos/[id]/correccion` · **Permiso:** `pagos:corregir` · **Servicio:** `corregirPago()` y `corregirOperacion()` en una transacción · **Confirmación (HU-C-25):** con el valor anterior y el nuevo; no es irreversible.

```typescript
export const CorregirPagoSchema = z.object({
  monto: montoSchema.optional(),                    // cambia el monto del pago
  forma_pago_id: formaPagoIdSchema.optional(),      // cambia la forma de la OPERACIÓN
  fecha_pago: fechaCalendarioValidaSchema.optional(), // cambia la fecha de la OPERACIÓN
  motivo: motivoSchema,                              // obligatorio, hasta 300
  caja_ajuste_id: z.string().cuid().optional(),     // 2.14.4
}).strict().refine(
  (c) => c.monto !== undefined || c.forma_pago_id !== undefined || c.fecha_pago !== undefined,
  "Indicá qué querés corregir",
);
```

**Comportamiento (una única `transaccion`, 2.7.4 y 3.11):**
1. **Lectura previa sin bloqueo:** pago, operación, inscripción, clase y caja. `404 PAGO_NO_ENCONTRADO` si no existe.
2. **Un único `bloquear`**, en el orden canónico: la clase del pago, la inscripción del pago, la operación y las cajas (la del pago y, si vino, `caja_ajuste_id`). Es lo que pide el criterio 2 («bloquea la operación y la inscripción del pago»); la clase se toma porque `recalcularEstadoPago` depende de su estado.
3. **Revalidar con todo bloqueado:** que el pago no esté anulado (`409 PAGO_ANULADO`) y el alcance de 2.14.1 con el **estado actual de la caja** (si se cerró mientras tanto, mesa recibe `403 FUERA_DE_ALCANCE`).
4. **Validar lo que cambia** (solo si vino): `forma_pago_id` existe (`404 FORMA_PAGO_NO_ENCONTRADA`) y está activa (`409 FORMA_PAGO_NO_DISPONIBLE`); `fecha_pago` no es futura (`400 FECHA_PAGO_FUTURA`); el monto cumple `montoSchema`. Una forma **inactiva** que la operación ya tenía **se conserva** mientras no se cambie (criterio 2): enviar el mismo id que ya tiene no cuenta como cambio. Si nada difiere de los valores vigentes: `400 SIN_CAMBIOS`.
5. **Escribir** (DEC-26):
   - si cambia el monto: `corregirPago` crea la `CorreccionPago` (anterior, nuevo, motivo, usuario, fecha) y `emitirReemplazo`;
   - si cambian la forma o la fecha: `corregirOperacion` crea una `CorreccionOperacion` por cada campo que cambia (alcanza a **todos los pagos** de la operación) y `emitirReemplazo`;
   - si cambian monto y forma/fecha a la vez, se llama a los dos en la misma transacción: quedan los dos registros y **dos comprobantes de reemplazo encadenados**; el vigente es el último.
6. **Caja:** si la caja del pago sigue abierta, nada más: el cambio se refleja en ella porque el arqueo usa el valor vigente. Si está cerrada y el cambio mueve dinero, `registrarAjuste` según 2.14.4.
7. La corrección no cambia el estado de pago de la inscripción (el pago sigue sin anular), así que no se escribe historial de estados ni se emiten eventos: los registros nuevos son la traza (opción (a), §4).

**Respuesta `200 OK`:**

```json
{
  "data": {
    "pago_id": "cuid",
    "monto": "22000.00",
    "forma_pago": { "id": "cuid", "nombre": "Transferencia", "is_active": true },
    "fecha_pago": "2026-10-08",
    "clases_abarcadas": 2,
    "comprobante": { "id": "cuid", "numero": "0001-00000131" }
  },
  "error": null
}
```

`clases_abarcadas` es la cantidad de pagos no anulados de la operación, para el aviso «este cambio de forma o de fecha alcanza a <N> clases» (criterio 2); es la misma que ya trae `operacion.clases` de 2.13. Mensaje de pantalla: «Pago corregido correctamente» (criterio 7).

#### 2.14.3. Anular

**Ruta:** `POST /api/pagos/[id]/anulacion` · **Permiso:** `pagos:corregir` · **Servicio:** `anularPago()` · **Confirmación (HU-C-25):** **irreversible** («Esta acción no se puede deshacer.»).

Body (`AnularPagoSchema`, `.strict()`): `{ "motivo": string, "caja_ajuste_id"?: string }`. El motivo es obligatorio, hasta 300 caracteres; para un **reintegro** (cancelación de una clase pagada, HU-C-14 criterio 7; baja de alumno o de profesor) el motivo es «Reintegro», que carga la interfaz y el servidor no trata de forma especial (P-I8).

**Comportamiento** (mismos pasos 1 a 3 y 6 de 2.14.2, con el bloqueo de la clase, la inscripción, la operación y las cajas):
1. `409 PAGO_YA_ANULADO` si ya tiene `AnulacionPago` (también lo garantiza el índice único por pago).
2. Crea la `AnulacionPago` (motivo, usuario, fecha). El pago queda con la etiqueta «Anulado» y **deja de sumar** en todo total e indicador (criterio 4).
3. `recalcularEstadoPago(tx, inscripcionId, { pagosNoAnulados })` con el conteo que calcula este servicio (3.8, R3-PR0-3). Si era el último pago no anulado de una inscripción **vigente** en una clase `DISPONIBLE`/`COMPLETO` que todavía no empezó, la inscripción vuelve a `RESERVADA` con un plazo nuevo contado desde ahora (el plazo vigente de HU-N-01, siempre antes del inicio, `reabiertaPorAnulacion = true`); si la clase ya empezó o está cancelada queda `PAGO_SIN_REGISTRAR`, informativo; si la inscripción ya no es vigente (por ejemplo, un reintegro a quien canceló) no se crea reserva (HU-C-24 criterio 5; `spec_modulo_C.md` 2.18).
4. **Comprobante** (HU-I-11 criterio 5): si la operación no tiene otros pagos vigentes, no se emite nada y el comprobante vigente se muestra «ANULADO» (marca derivada, 2.9.4); si los tiene, `emitirReemplazo` con los pagos vigentes y el anterior queda «Reemplazado por <número>».
5. **Caja:** pago de caja abierta, se refleja en ella; de caja cerrada, `registrarAjuste` de `−monto vigente` en la forma vigente (2.14.4).
6. **Después del commit:** si la inscripción cambió de estado (`PAGADA` → `RESERVADA` o `PAGO_SIN_REGISTRAR`), el historial de estados (`registrarCambioEstado`, `PR-0.md` §2.16).

**Respuesta `200 OK`:**

```json
{
  "data": {
    "pago_id": "cuid",
    "anulado": true,
    "inscripcion": { "id": "cuid", "estado_pago": "RESERVADA", "vence_el": "2026-10-10T10:14:00-03:00" },
    "comprobante": { "id": "cuid", "numero": "0001-00000132", "reemplazo": true }
  },
  "error": null
}
```

`comprobante` es `null` si no se emitió ninguno (queda el vigente con la marca «ANULADO»). `inscripcion.vence_el` es `null` si no se reabrió ninguna reserva. Mensaje de pantalla: «Pago anulado».

#### 2.14.4. Ajustes de caja (HU-I-12 criterio 4)

La caja cerrada **no se modifica** (Regla N.° 8). Cuando el pago a cambiar está en una caja `CERRADA`, solo lo hace el Gerente y **el dinero que se mueve** se registra como `AjusteCaja` en una caja **abierta** de mesa de entrada que elige el Gerente (`caja_ajuste_id`; el selector sale de `abiertas` de `GET /api/cajas`, 2.12).

| Cambio | ¿Mueve dinero? | Ajustes que se registran en la caja elegida |
|---|---|---|
| Anular un pago | Sí | `−monto vigente` en la forma vigente |
| Cambiar el monto | Si `nuevo − anterior ≠ 0` | `nuevo − anterior` (con signo) en la forma vigente |
| Cambiar la forma de la operación | Sí, por el total vigente de la operación | **Un par** (P-I3): `−total` en la forma anterior y `+total` en la nueva |
| Cambiar solo la fecha | No | ninguno; no hace falta caja de ajuste |

- Si cambian monto y forma a la vez, primero se ajusta el monto en la forma anterior y después se hace el par con el total ya corregido (mismo orden que las escrituras de 2.14.2).
- El arqueo suma solo los ajustes de formas con `esEfectivo` (2.11); los demás quedan registrados e informados.
- Con la caja del pago **abierta** no se registra ajuste y `caja_ajuste_id`, si llegó, se ignora.
- Cuando hace falta y no vino, o la caja elegida no existe o no está `ABIERTA` (verificado con ella bloqueada): `409 CAJA_DE_AJUSTE_NO_ABIERTA`, «Para registrar este cambio tiene que haber una caja abierta en mesa de entrada.» (criterio 4), y no se registra nada (la transacción falla completa).
- La caja elegida puede ser de otro integrante: el ajuste queda en su caja y entra en su huella de cierre (`CAJA_CAMBIO`, 2.11).

#### 2.14.5. Errores esperados

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | motivo vacío o de más de 300, monto inválido, nada para corregir, campo extra |
| 400 | `SIN_CAMBIOS` | todos los valores enviados son iguales a los vigentes |
| 400 | `FECHA_PAGO_FUTURA` | fecha posterior a hoy (mismo texto que 2.4) |
| 403 | `SIN_PERMISO` | rol sin `pagos:corregir` |
| 403 | `FUERA_DE_ALCANCE` | Mesa de entrada: más de 30 días desde el registro o caja del pago cerrada (T13) |
| 404 | `PAGO_NO_ENCONTRADO` · `FORMA_PAGO_NO_ENCONTRADA` | no existe |
| 409 | `PAGO_ANULADO` | corregir un pago anulado |
| 409 | `PAGO_YA_ANULADO` | anular un pago ya anulado (incluye dos anulaciones simultáneas: gana la primera) |
| 409 | `FORMA_PAGO_NO_DISPONIBLE` | la forma nueva está inactiva |
| 409 | `CAJA_DE_AJUSTE_NO_ABIERTA` | falta `caja_ajuste_id` o su caja no está abierta (2.14.4) |
| 409 | `TRANSACCION_OCUPADA` | «Otra persona está modificando estos datos. Intentá de nuevo.» |

#### 2.14.6. Historial de cambios del pago (DEC-27)

**Ruta:** `GET /api/pagos/[id]/historial` · **Permiso:** `pagos:leer` · Es el «detalle del pago» del criterio 3: un modal de solo lectura, sin pantalla propia. El Alumno **no** lo ve (el motivo es un dato interno).

```json
{
  "data": {
    "registro": { "monto": "24000.00", "forma_pago": { "id": "cuid", "nombre": "Efectivo" }, "fecha_pago": "2026-10-08",
                  "registrado_por": { "usuario_id": "cuid", "nombre_completo": "Ruiz, Marta" }, "registrado_en": "2026-10-08T10:12:00-03:00" },
    "cambios": [
      { "tipo": "ANULACION", "valor_anterior": "20000.00", "valor_nuevo": null, "motivo": "Reintegro",
        "usuario": { "usuario_id": "cuid", "nombre_completo": "Pérez, Ana" }, "fecha": "2026-10-10T09:00:00-03:00" },
      { "tipo": "CORRECCION_MONTO", "valor_anterior": "24000.00", "valor_nuevo": "20000.00", "motivo": "Beca parcial",
        "usuario": { "usuario_id": "cuid", "nombre_completo": "Ruiz, Marta" }, "fecha": "2026-10-09T11:30:00-03:00" }
    ]
  },
  "error": null
}
```

`tipo` ∈ `CORRECCION_MONTO` · `CORRECCION_FORMA` · `CORRECCION_FECHA` · `ANULACION`; las correcciones de forma y de fecha son de la operación y figuran en el historial de **cada** pago de ella. Más nuevos primero. `404 PAGO_NO_ENCONTRADO`; `403 SIN_PERMISO`.

#### 2.14.7. Pruebas obligatorias

1. Corregir y anular **no hacen `UPDATE` ni `DELETE`** sobre `Pago` (la tabla queda idéntica) y el valor vigente sale de los registros nuevos.
2. Concurrencia con PostgreSQL real: dos anulaciones simultáneas del mismo pago (una gana, la otra `PAGO_YA_ANULADO`); una corrección y una anulación de pagos distintos de la misma operación, sin interbloqueo; un cierre de caja y una corrección de mesa de entrada en los dos órdenes (si el cierre confirma primero, `FUERA_DE_ALCANCE`; si la corrección, el cierre falla por `CAJA_CAMBIO`).
3. Anular el último pago: la inscripción vuelve a `RESERVADA` con plazo nuevo (clase futura), queda `PAGO_SIN_REGISTRAR` (clase iniciada o cancelada) o no se crea reserva (inscripción no vigente); «Pagada ⇔ ≥ 1 pago no anulado» después de cada operación (R3-PR0-10).
4. Alcance: mesa de entrada con un pago de 31 días, o con la caja cerrada, `403`; con la caja abierta de otro integrante, puede; el Gerente puede siempre.
5. Ajustes: cada fila de la tabla de 2.14.4 con una caja cerrada y una abierta; sin caja de ajuste, nada queda registrado.
6. Comprobantes: corregir emite reemplazo; anular uno de varios emite reemplazo; anular el último deja el vigente «ANULADO»; monto y forma a la vez dejan dos reemplazos encadenados.

---

### 2.15. Mis pagos (HU-I-05) — NUEVA en Revisión 3

**Ruta:** `GET /api/mis-pagos?desde=&hasta=&materia_id=&pagina=` · **Permiso:** `pagos:leer_propios` (Alumno) · **Servicio:** `listarMisPagos()` sobre `listarPagosDeAlumno` (2.17).

- **El alumno sale de la sesión**, con el mismo mecanismo que «Mis turnos» (`spec_modulo_C.md` §2.14.1). La ruta **no acepta** `alumno_id` (`.strict()`: `400` si viene) y no hay forma de pedir los pagos de otro alumno; cualquier otro rol que llegue acá recibe `403 SIN_PERMISO`, y un Alumno que intente una ruta de 2.13 (que acepta `alumno_id`) recibe `403 SIN_PERMISO` por no tener `pagos:leer`. Si un Alumno pide el comprobante de un pago ajeno: `403 FUERA_DE_ALCANCE` (2.9.3).
- Filtros: rango de fechas de pago vigente y materia (las materias de sus clases pagadas, `GET /api/mis-pagos/opciones`), combinados entre sí. Orden: fecha de pago descendente; **de a 10**; `total_pagado` del resultado filtrado completo (criterio 2). No hay filtro de forma de pago ni de estado.
- **Anulados** con la etiqueta «Anulado»; no suman al total (criterio 1).
- **Lo que no se envía:** el usuario que registró, el precio, el ajuste, el motivo y el historial de cambios, las cajas, ni pagos de otros alumnos de la misma clase (criterio 3). El servidor arma una proyección distinta de la de 2.13; no filtra campos de la misma respuesta.

```json
{
  "data": {
    "total_pagado": "24000.00",
    "items": [{
      "pago_id": "cuid",
      "fecha_pago": "2026-10-08",
      "clase": { "fecha": "2026-10-12", "hora_inicio": "18:00", "materia": { "id": "cuid", "nombre": "Física I" } },
      "monto": "24000.00",
      "forma_pago": { "id": "cuid", "nombre": "Efectivo" },
      "anulado": false,
      "comprobante": { "id": "cuid", "numero": "0001-00000123" }
    }],
    "paginacion": { "total": 5, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 10 }
  },
  "error": null
}
```

`comprobante` abre `GET /api/mis-pagos/[id]/comprobante` (2.9.3) con permiso `comprobantes:leer_propios`. «Todavía no tenés pagos registrados» (criterio 5) y el vacío por filtros son textos de la interfaz (HU-C-23). La pantalla es de solo consulta (criterio 6): no hay rutas de escritura para el Alumno.

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | `alumno_id` u otro campo extra, fecha inválida, `desde` > `hasta`, `pagina` inválida |
| 403 | `SIN_PERMISO` | rol sin `pagos:leer_propios` |
| 404 | `ALUMNO_NO_ENCONTRADO` | la cuenta de la sesión no tiene ficha de alumno (inconsistencia de datos) |

**Pruebas:** un alumno nunca ve pagos de otro (ni de la misma clase); el JSON no contiene `registrado_por`, `precio`, `ajuste` ni `motivo`; el monto es el vigente y el anulado no suma.

---

### 2.16. Modificar, desactivar y reactivar una forma de pago (HU-I-07) — NUEVA en Revisión 3

> **Sincronización de implementación I-07 (10/10/2026).** `modificarFormaPago(tx, id, input)`, `desactivarFormaPago(tx, id, input, actor)` y `reactivarFormaPago(tx, id, actor)` reciben la transacción del llamador como en PR-0 §2.13. `obtenerImpactoFormaPago(id, db?)` responde con objeto directo de §2.16.2; reactivación devuelve objeto directo `{ id, nombre, is_active: true }`. PATCH conserva su envelope, baja su objeto directo. `bloquear` mantiene `formasPago: true` y añade `{ activas?: boolean, ids: string[] }` para incluir solicitada inactiva/bloquear solo propia. Motivo vacío/espacios equivale a omitido, y solo se exige con pagos; se incluyen formas usadas en correcciones de operación. Sin migración. La fachada B de conteo faltaba en develop y la agrega esta HU; cuenta fichas activas e inactivas según P-B10. Las pantallas I-06/I-11 completas no están en esta base, aunque sus servicios sí: sus diferidos visuales se verifican al integrar esas HUs.


Las altas y los listados (2.1 y 2.2) no cambian. La columna «Preferida por» **no existe** (criterio 1): cuántos alumnos la tienen como preferida solo se informa al desactivar (2.16.2).

#### 2.16.1. Modificar el nombre

**Ruta:** `PATCH /api/formas-pago/[id]` · **Permiso:** `formas_pago:editar` (Gerente) · **Servicio:** `modificarFormaPago()` · **Confirmación (HU-C-25):** modifica un dato.

Body: `{ "nombre": string }` con el **mismo esquema que el alta** (`NombreFormaPagoSchema`, extraído de `CrearFormaPagoSchema`: recorta y colapsa espacios, 2 a 40 caracteres, `.strict()`; 2.1 no cambia). `esEfectivo` no es un campo: ninguna pantalla ni API lo edita.

1. `404 FORMA_PAGO_NO_ENCONTRADA` si no existe.
2. Calcula `nombreNormalizadaFormaPago`. Unicidad contra **todas** las formas, activas e inactivas, **excluyendo la propia**; si existe otra: `409 NOMBRE_DUPLICADO` (mismo texto que 2.1). Cambiar solo mayúsculas o acentos de la misma forma es válido.
3. Sin cambios (el nombre y su normalizado son iguales): no escribe y responde `200` con la forma tal cual. La interfaz ya deshabilita «Guardar» (criterio 3).
4. `UPDATE`; el índice único atrapa la carrera: `P2002` → el mismo `409` (la revalidación del paso 2 mejora el mensaje, no cierra la carrera, igual que 2.1).

Respuesta `200`: `{ data: { id, nombre, is_active }, error: null }`. Mensaje: «Forma de pago actualizada correctamente».

**Qué se actualiza solo (criterio 2):** los pagos ya registrados y las preferencias de los alumnos muestran el nombre nuevo, porque resuelven el nombre por consulta (3.4). Los **comprobantes ya emitidos conservan el nombre con que se emitieron** (copia fija, 2.9.1).

#### 2.16.2. Impacto de la desactivación

**Ruta:** `GET /api/formas-pago/[id]/impacto` · **Permiso:** `formas_pago:desactivar` · Devuelve lo que la confirmación necesita: `{ alumnos_con_preferida: number, tiene_pagos: boolean, es_ultima_activa: boolean }`. `alumnos_con_preferida` sale de `contarAlumnosConFormaPagoPreferida(formaPagoId, db?)`, que publica B (`spec_modulo_B.md` §2.3 y §2.8) —I no lee la tabla `alumnos` (Regla N.° 3)—; `tiene_pagos` hace que la interfaz marque el motivo como obligatorio. Es informativo: el servidor lo recalcula al desactivar.

#### 2.16.3. Desactivar

**Ruta:** `POST /api/formas-pago/[id]/desactivacion` · **Permiso:** `formas_pago:desactivar` · **Servicio:** `desactivarFormaPago()` · **Confirmación (HU-C-25):** informa cuántos alumnos la tienen como preferida; **reversible**, sin «Esta acción no se puede deshacer.».

Body: `{ "motivo"?: string }` (`motivoSchema`, hasta 300 caracteres). Una única `transaccion`:
1. **Bloqueo:** `bloquear` con el nivel «formas de pago» (R3-PR0-9): **todas las formas activas, ordenadas por id**, más la forma pedida. Es lo que cierra el *write skew* (criterio 6): una condición en una sola sentencia no alcanza con READ COMMITTED (Regla N.° 7). Va antes que cualquier otro bloqueo; esta operación no se combina con otros.
2. `404 FORMA_PAGO_NO_ENCONTRADA`; `409 FORMA_PAGO_YA_INACTIVA` si ya estaba inactiva.
3. `409 ULTIMA_FORMA_PAGO_ACTIVA`, «Debe quedar al menos una forma de pago activa», si es la única activa (con las filas bloqueadas, dos desactivaciones simultáneas no pueden dejar al centro sin formas).
4. **Motivo:** si la forma tiene pagos registrados y no vino: `400 MOTIVO_REQUERIDO` (Regla N.° 1). Sin pagos es opcional.
5. `activaFormaPago = false`. Los pagos ya registrados no cambian y los alumnos que la tenían como preferida la **conservan** (criterio 5).
6. **Después del commit:** `registrarCambioEstado` con la acción `DESACTIVAR`, el motivo, la fecha y el usuario (criterio 4, como HU-D-08; Regla N.° 2 b).

Respuesta `200`: `{ id, nombre, is_active: false }`. Mensaje: «Forma de pago desactivada».

**Efectos:** deja de ofrecerse al registrar un pago (2.7 y 2.8 solo ofrecen activas) y al elegir la preferida del alumno (HU-B-03). La preferida inactiva se muestra con la etiqueta «Inactiva» y **no se preselecciona** (`forma_pago_preferida_id` es `null` en 2.7 y 2.8, como ya hace 2.5). Desactivar «Efectivo» no cambia el cálculo del arqueo, que usa `esEfectivo`. «Mercado Pago» sigue como forma de mostrador (se registra a mano un cobro ya realizado): no hay pago en línea ni integración.

#### 2.16.4. Reactivar y errores

**Ruta:** `POST /api/formas-pago/[id]/reactivacion` · **Permiso:** `formas_pago:desactivar` · Sin body. `409 FORMA_PAGO_YA_ACTIVA` si ya estaba activa. Pasa a `activaFormaPago = true`, vuelve a ofrecerse y `registrarCambioEstado` (acción `REACTIVAR`) después del commit. No necesita el bloqueo de todas las formas (no puede dejar al centro sin activas); sí bloquea la propia fila. Mensaje: «Forma de pago reactivada».

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | nombre fuera de 2 a 40, campo extra, motivo de más de 300 |
| 400 | `MOTIVO_REQUERIDO` | desactivar una forma con pagos sin motivo |
| 403 | `SIN_PERMISO` | rol distinto del Gerente (criterio 8) |
| 404 | `FORMA_PAGO_NO_ENCONTRADA` | no existe |
| 409 | `NOMBRE_DUPLICADO` | otro registro (activo o inactivo) con ese nombre normalizado, o `P2002` |
| 409 | `ULTIMA_FORMA_PAGO_ACTIVA` | es la última activa |
| 409 | `FORMA_PAGO_YA_INACTIVA` · `FORMA_PAGO_YA_ACTIVA` | ya estaba en ese estado |
| 409 | `TRANSACCION_OCUPADA` | «Otra persona está modificando estos datos. Intentá de nuevo.» |

**Pruebas obligatorias (PostgreSQL real):** dos desactivaciones simultáneas de las dos únicas activas (una gana, la otra `ULTIMA_FORMA_PAGO_ACTIVA`); renombrar a un nombre ya existente (activo o inactivo) y renombrar a variantes de la misma forma; desactivar una forma con pagos sin motivo; una forma inactiva no se ofrece en 2.7 ni se preselecciona; los pagos y comprobantes ya emitidos conservan lo que muestran.

---

### 2.17. Servicios públicos nuevos del módulo — NUEVA en Revisión 3

Se suman a la tabla de 2.3, en `pago.publico.ts` (y, la caja, en la fachada que fije el PR 0: `caja.publico.ts` o un reexporte desde `pago.publico.ts`). Valen las mismas reglas de 2.3: no son endpoints, no exigen un permiso (lo verifica la ruta del consumidor), el parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador, y **ningún `*.publico.ts` importa nada del otro módulo**. Por eso lo que mezcla datos de dos módulos (por ejemplo, un pago con los datos de su clase) lo arma el servicio de quien consume, no la fachada.

| Función | Devuelve | Consumidores |
|---|---|---|
| `listarPagosDeAlumno(alumnoId, filtros, db?)` — `filtros: { desde?, hasta?, formaPagoId?, turnoIds? }` | `PagoDeAlumno[]` **sin paginar**, con monto vigente y los pagos anulados incluidos: `{ pago_id, turno_id, inscripcion_id, operacion_id, monto, monto_original \| null, precio, motivo_ajuste \| null, ajustado_por \| null, forma_pago: { id, nombre, is_active }, fecha_pago, registrado_en, registrado_por (usuarioId), anulado, anulacion: { fecha, motivo } \| null, comprobante_vigente: { id, numero } \| null, cambios, clases_de_la_operacion }`. `fecha_pago` y la forma son las **vigentes** de la operación. Orden: fecha de pago y momento de registro descendentes. `desde`/`hasta` filtran por fecha de pago vigente; `turnoIds` lo usa el servicio para el filtro por materia | 2.13 y 2.15 (`pago.service.ts`) |
| `listarPagosDeClase(turnoId, db?)` | Como `PagoDeTurno` (2.3) con los **anulados incluidos** y los campos nuevos `inscripcion_id`, `operacion_id`, `anulado`, `anulacion`, `comprobante_vigente`, `cambios`, `clases_de_la_operacion`. Mismo orden que `listarPagosDeTurno` | `spec_modulo_C.md` §2.4 (lista «Pagos registrados» con las acciones de HU-I-06) cuando se mergee HU-I-06 |
| `listarPagosDeTurno(turnoId, db?)` *(existente)* | Misma firma y forma (`PagoDeTurno`). **Cambia el origen:** monto vigente, forma y fecha vigentes de la operación, y **sin los pagos anulados** (T4) | C §2.4, el detalle de la clase de Sprint 2 |
| `sumarPagosPorMes(desde, hasta, db?)` *(existente)* | Misma firma y forma. **Cambia el origen:** suma el monto vigente de los pagos no anulados, por mes de la fecha de pago vigente (T5). Un mes sin pagos vigentes no aparece | H §2.2 |
| `cajaAbiertaDe(tx, usuarioId)` | `{ id, abiertaEl } \| null`. Solo lectura, **sin bloqueo** (el que decide bloquea con `bloquear`) | F (HU-F-05, `409 CAJA_ABIERTA`), 2.7 y 2.10 |
| `usuarioRegistroOperaciones(tx, usuarioId)` | `boolean`: el usuario figura como actor de algún pago (operación), corrección, anulación, caja, movimiento, anulación de movimiento, ajuste o cierre por ausencia | F §2.7 (DEC-39: el motivo de la baja del integrante es obligatorio si registró operaciones) |
| `alumnoTieneRegistros(alumnoId, db?)` | `boolean`, solo lectura (`LIMIT 1`): el alumno tiene algún pago, **incluso anulado o corregido**. **La agrega HU-B-07** en esta fachada | `spec_modulo_B.md` 2.10.2 (motivo obligatorio de la baja del alumno) |
| `turnosConPagosVigentes(turnoIds, db?)` | `string[]`: los ids de esas clases que tienen al menos un pago **no anulado**. Solo lectura, en lote (una consulta), sin bloqueo. **La agrega HU-D-08** en esta fachada | `spec_modulo_D.md` 2.10.2 y 2.10.3 (aviso de reintegro al cancelar clases por la baja de un profesor; HU-I-06 se verifica de forma diferida) |

- `listarPagosDeAlumno` y `listarPagosDeClase` comparten **una sola implementación del valor vigente** (2.6.2), igual que `listarPagosDeTurno` y `sumarPagosPorMes`. Una prueba compara los cuatro con los mismos datos (con y sin correcciones y anulaciones).
- Las funciones de lectura no bloquean filas. Las de escritura (`registrarOperacion`, `corregirPago`, `anularPago`, `corregirOperacion`, caja) son servicios de dominio del PR 0 (`PR-0.md` §2.13) y los usa **solo** `pago.service.ts`; el resto de los módulos no las invoca.

**Lo que este módulo consume de otros** (cada uno por su fachada, Regla N.° 3):

| Módulo | Función | Para qué |
|---|---|---|
| C | `listarInscripcionesDeAlumno` (con el filtro de estado de pago de HU-I-10/HU-I-02), `obtenerAlumnosInscriptosDeTurno`, `crearInscripcion`, `marcarVencidas`, `marcarVencidasDelAlumno`, `exigeInscripcionConPago`, `recalcularEstadoPago` | 2.7, 2.8, 2.13, 2.14 |
| C (nueva, P-I9) | `obtenerClasesBasicas(turnoIds, db?)` → `{ turno_id, fecha, hora_inicio, hora_fin, estado, materia: { id, nombre }, profesor: { id, nombre_para_mostrar } }[]`; solo lectura, en lote, sin bloqueo | 2.13 y 2.15 |
| B | `obtenerAlumnosBasicos`, `buscarAlumnosActivos` (con el criterio de P-I5), `contarAlumnosConFormaPagoPreferida(formaPagoId, db?)` (nueva) | 2.7.1, 2.13, 2.16.2 |
| F | `obtenerNombresPersonal`, `bloquearIntegranteActivo` | 2.10, 2.13, 2.14.6 |
| L | `obtenerTarifasPorIds` | ítem «Se inscribe al confirmar el pago» (2.7.4) |

> **Nota posterior (08/10/2026).** De B, `buscarAlumnosActivos` se usa con `{ porPalabras: true }` (2.7.1, P-B8). Las dos funciones nuevas de la tabla de 2.17 (`alumnoTieneRegistros`, `turnosConPagosVigentes`) las agregan HU-B-07 y HU-D-08 en esta fachada.

**Dirección de las dependencias.** I importa las fachadas de C, B, F y L; C, H y F importan **solo** `pago.publico.ts` / la fachada de caja de I. Ningún `*.publico.ts` importa a otro módulo, así que no hay ciclo.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/pagos/forma-pago.service.ts` y `src/server/pagos/pago.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Unicidad case/acento-insensitiva contra el universo completo (activas + inactivas)
Mismo patrón que `spec_modulo_L.md` §3.1 y `spec_modulo_K.md` §3.1: una forma de pago inactiva sigue "ocupando" su nombre. Doble validación (aplicativa + constraint `P2002`).

### 3.2. `FormaPago` es del Módulo I; los demás la consumen por servicio
Alumnos (HU-B-03) no lee la tabla directamente: usa §2.3. (Turnos dejó de consumirla al retirarse HU-C-11.)

### 3.3. Sin datos financieros sensibles
Ningún schema acepta ni almacena número de tarjeta, CBU, alias ni credenciales. Los schemas son `.strict()`: un campo extra se rechaza, no se ignora.

### 3.4. El pago no es retroactivo respecto del catálogo

> **Revisión 3.** Desactivar una forma de pago existe desde HU-I-07 (2.16): los pagos y comprobantes ya emitidos conservan su forma y su nombre, el nombre de una forma renombrada se resuelve por consulta, y la preferida inactiva de un alumno se conserva con la etiqueta «Inactiva» sin preseleccionarse.

Desactivar una forma de pago no altera los pagos ya registrados: el `Pago` conserva su `formaPagoId` y el nombre se resuelve por consulta (`obtenerFormaPago`, que devuelve también las inactivas). Mismo criterio que `spec_modulo_B.md` §3.5. Y la preferida de un alumno que se desactivó no se propone en el modal (§2.5).

### 3.5. El pago pertenece a un alumno inscripto

> **Revisión 3.** La regla sigue valiendo y ahora se verifica contra la **inscripción vigente** del alumno en la clase (`ALUMNO_NO_INSCRIPTO`). El `alumnoId` del pago se conserva aunque la inscripción deje de ser vigente (quitado, baja o cancelación): sus pagos se siguen mostrando (HU-I-02, criterio 5). Un pago cargado a otro alumno no se reasigna: se anula y se registra de nuevo (2.14).

Todo `Pago` guarda el `alumnoId` de quien paga, y ese alumno debe figurar entre los inscriptos del turno **al momento de registrarlo** (§2.4 paso 3). Como `TurnoAlumno` puede cambiar después (un alumno puede quitarse de un turno futuro), el `alumnoId` del pago se conserva aunque el alumno deje de estar inscripto: es un hecho consumado (Regla N.° 8).

### 3.6. Un pago es inmutable (Regla N.° 8)

> **Revisión 3.** La inmutabilidad **se mantiene**. Quedan superadas las frases «no existen rutas de edición ni de baja» y «un monto mal cargado no se puede corregir desde la aplicación»: HU-I-06 agrega las rutas de 2.14, que crean el **registro compensatorio** que esta sección anticipaba, y el valor que se muestra y se suma es el vigente (2.6.2, 3.9). Ver T3.

`Pago` es un registro de hecho consumado: no existen rutas de edición ni de baja, y ningún servicio ejecuta `UPDATE` ni `DELETE` sobre él. Una corrección futura se hará con un **registro compensatorio nuevo** que referencie al original (se contractualizará como sección aditiva en Sprint 3, junto con HU-I-02/I-04). Hasta entonces, un monto mal cargado **no se puede corregir desde la aplicación**: el equipo debe saberlo antes de la demo. El PO resolvió Q6c el 29/09/2026 planificando esa HU de corrección para Sprint 3.

### 3.7. Concurrencia

> **Revisión 3.** Esta sección deja de ser suficiente por sí sola: hay condiciones sensibles que sí piden bloqueo y escritura atómica (una sola vez pagada, 3.8; caja abierta, 3.10; cierre, 3.14; última forma activa, 3.16). El orden de bloqueo, la transacción y los reintentos están en 3.11.

Registrar un pago no depende de un estado que otro pago pueda invalidar (no hay saldo ni total esperado), por lo que no requiere `updateMany` condicional. La única condición sensible, "el turno sigue confirmado", se cubre con el `FOR SHARE` de §2.4 paso 1.

### 3.8. Un pago por inscripción y equivalencia de «Pagada» — NUEVA en Revisión 3
En el flujo de HU-I-10 una clase se paga **una sola vez**: una inscripción con un pago no anulado está pagada y `registrarOperacion` (modo `completo`) rechaza otro pago con `409 INSCRIPCION_YA_PAGADA` (la inscripción está bloqueada cuando se evalúa, así que dos cobros simultáneos no pasan los dos). Se mantiene siempre **«Pagada ⇔ la inscripción tiene al menos un pago no anulado»** (convención 8 a): la escritura del pago y el estado de la inscripción cambian en la **misma transacción**. La Regla N.° 3 impide que C lea `pagos`: este servicio calcula el conteo de pagos no anulados de la inscripción y se lo pasa a `marcarPagada` y `recalcularEstadoPago` (R3-PR0-3). `POST /api/pagos` (modo `compatSprint2`, permanente) conserva los pagos parciales de Sprint 2 (2.8): la inscripción queda pagada con el primero, y «Pagada ⇔ ≥ 1 pago no anulado» vale igual.

### 3.9. Valores vigentes e inmutabilidad (Regla N.° 8) — NUEVA en Revisión 3
Ningún servicio ejecuta `UPDATE` ni `DELETE` sobre `Pago`, `CorreccionPago`, `CorreccionOperacion`, `AnulacionPago`, `Comprobante` (su `datos` incluido), `MovimientoCaja`, `AnulacionMovimiento` ni `AjusteCaja`. Corregir o anular es **insertar un registro nuevo** que referencia al original, y toda pantalla, total e indicador usa el **valor vigente** de 2.6.2 con una sola implementación. Las únicas filas de este módulo que se actualizan son la `Caja` —una sola vez, al cerrarla, con `updateMany` condicional (3.14)— y las formas de pago (2.16). El estado de pago de la inscripción lo actualiza el servicio de inscripciones del PR 0, no este módulo.

### 3.10. Todo pago pertenece a la caja abierta de quien lo registra — NUEVA en Revisión 3
La operación guarda la caja donde se cobró. Si el usuario no tiene una caja `ABIERTA` al confirmar, el cobro falla con `409 CAJA_NO_ABIERTA` (un único `code`; los dos textos de HU-I-12 son una decisión de la interfaz, T12 y P-I6). Vale también para `POST /api/pagos` y para el modo `compatSprint2` (`PR-0.md` §1.1). La caja se verifica **al final** de las validaciones, con ella bloqueada, para no cambiar qué error ve primero quien usa un contrato de Sprint 2 (2.8). El Gerente no registra pagos y por eso no tiene caja propia.

### 3.11. Bloqueo, transacción y reintentos — NUEVA en Revisión 3
- **Un solo `bloquear`** por operación, en el orden canónico del PR 0 (recurso → clase → inscripción → operación → caja), con los ids de cada nivel ordenados; nunca se toman bloqueos sueltos fuera de esa llamada. HU-I-07 usa el nivel «formas de pago» y va antes que todo (R3-PR0-9).
- Se bloquea la **clase con `FOR UPDATE`**, que reemplaza el `FOR SHARE` de 2.4: también impide que una cancelación concurrente deje un pago sobre una clase cancelada (T7). Las demás validaciones de estado se hacen **después** de bloquear, nunca con la lectura previa.
- Todo corre en `transaccion` (`maxWait` 2000 ms, `timeout` 8000 ms, `lock_timeout` 5 s). Un bloqueo que no se obtiene a tiempo responde `409 TRANSACCION_OCUPADA`. Dentro de la transacción solo se llama a servicios del PR 0 que reciben `tx`; el historial de estados y cualquier otro registro posterior van **después del commit** (Regla N.° 2 b).
- Un cobro y un cierre de caja se serializan por el bloqueo de la caja (2.11); una corrección y un cierre, también.

### 3.12. Precio congelado y ajuste de importe — NUEVA en Revisión 3
El precio de la clase es el que quedó **congelado en la inscripción** al reservar (HU-L-06): la tarifa de la materia puede cambiar después sin afectarlo. El importe del pago **precarga** el precio y puede ser otro; si `monto ≠ precio` el servidor exige `motivo_ajuste` (hasta 300 caracteres) y guarda quién lo cambió (`400 MOTIVO_AJUSTE_REQUERIDO`, HU-I-10 criterio 4). El precio es un entero en pesos y el monto tiene dos decimales: se comparan como números (T14). El ítem «Se inscribe al confirmar el pago» usa la tarifa vigente. **El Profesor nunca ve precios ni montos** (Q6d, HU-L-06 criterio 7): ninguna ruta de este módulo le responde.

### 3.13. El comprobante es un hecho emitido — NUEVA en Revisión 3
Solo `emitirComprobante` y `emitirReemplazo` emiten comprobantes, dentro de la misma transacción del cobro, la corrección o la anulación. Un comprobante emitido **no se modifica**; «ANULADO» y «Reemplazado por» se derivan de los registros que lo referencian (2.9.4) y la base impide que dos comprobantes reemplacen al mismo (`reemplazaAId` único). El número sale de una secuencia de la base. La vista del Alumno se arma con una proyección que **no incluye** el usuario que registró ni el motivo de la anulación.

### 3.14. Caja: una por integrante, arqueo ciego e inmutabilidad — NUEVA en Revisión 3
- Un integrante tiene como máximo **una** caja `ABIERTA`, garantizado por el índice único parcial (`409 CAJA_YA_ABIERTA`) aunque se intenten abrir dos a la vez (Regla N.° 7).
- **Arqueo ciego:** mientras la caja está abierta, ninguna ruta devuelve el efectivo esperado ni totales de cobros (ni siquiera al Gerente); el resumen se entrega recién después de declarar el efectivo (2.11).
- El cierre es **una sola escritura** sobre la fila, con `updateMany` condicional sobre `estado = ABIERTA` y la huella del resumen (`CAJA_CAMBIO`); el cierre guarda un `resumen` fijo que no se recalcula. La caja cerrada no recibe cobros, movimientos ni ajustes: los cambios sobre sus pagos se registran como ajustes en una caja abierta (2.14.4).
- Solo las formas con `esEfectivo = true` entran en el efectivo esperado; el resto se informa. Un egreso no puede dejar el efectivo negativo y un ingreso solo se anula si no lo deja negativo (DEC-31).

### 3.15. Alcance de corrección y anulación — NUEVA en Revisión 3
`puedeCorregirPago` decide el alcance (2.14.1) y se evalúa **con los registros bloqueados**, porque la caja puede haberse cerrado un instante antes. Un rol sin el permiso recibe `403 SIN_PERMISO`; quien lo tiene pero está fuera de alcance recibe `403 FUERA_DE_ALCANCE`. Los botones que la interfaz oculta son una comodidad: el servidor siempre rechaza.

### 3.16. Formas de pago — NUEVA en Revisión 3
Renombrar mantiene la unicidad contra activas e inactivas excluyendo la propia (3.1). Desactivar exige el motivo cuando la forma tiene pagos (Regla N.° 1), registra la baja y la reactivación en el historial de estados, y **no puede dejar al centro sin formas activas**: se verifica con todas las activas bloqueadas (`ULTIMA_FORMA_PAGO_ACTIVA`). `esEfectivo` no lo edita ninguna API. Una forma inactiva sigue en pagos históricos, comprobantes y preferencias de alumnos; solo deja de ofrecerse.

### 3.17. Aislamiento entre módulos — NUEVA en Revisión 3
Este módulo lee Alumnos, Turnos, Materias y Personal **solo por sus fachadas** (2.17), y C, E, F y H leen los pagos y las cajas **solo por las suyas**. Ningún `*.publico.ts` importa al de otro módulo; lo que combina datos de dos módulos lo arma el servicio del consumidor. Las tablas de Pagos se escriben solo desde los servicios de dominio del PR 0, nunca desde un Route Handler ni desde otro módulo.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, este módulo usa la **opción (a) — columnas de auditoría en la propia entidad**, que se persisten en la misma operación (no hay escritura posterior a la transacción): la trazabilidad (qué, cuándo, quién) queda en las columnas de la propia fila (`createdAtFormaPago` / `createdAtPago` y `creadoPorUsuarioId`), como Materias, Aulas y Profesores. **No existe** tabla de eventos de Pagos ni se emiten eventos en este sprint. Si Sprint 3 agrega anulaciones o compensaciones (varios eventos sobre el mismo pago), se pasa a la opción (b) en esa spec.

> **Revisión 3 (Sprint 3).** Se cumple la previsión de esta sección: el Sprint 3 agrega correcciones, anulaciones, movimientos y ajustes, y por eso el módulo usa **las dos opciones, según la entidad**:
> - **Opción (a), cada registro es su propia traza** (qué, cuándo, quién, motivo): `OperacionPago` y `Pago`, `CorreccionPago`, `CorreccionOperacion`, `AnulacionPago`, `Comprobante`, `Caja` (apertura y cierre), `MovimientoCaja`, `AnulacionMovimiento` y `AjusteCaja`. Son registros nuevos que referencian al anterior (Regla N.° 8), con el usuario y la fecha en la misma fila, escritos en la misma transacción.
> - **Opción (b), historial de estados** (`registrarCambioEstado`, `PR-0.md` §2.14): la desactivación y la reactivación de formas de pago (2.16, con motivo) y los cambios de estado de pago de la inscripción que provocan un cobro, una corrección o una anulación (Reservada → Pagada → Reservada), que escribe el servicio **después del commit** (Regla N.° 2 b).
> - **No se emiten `eventos_turno` por pagos.** El historial de cambios de un pago (2.14.6) se arma leyendo sus registros de corrección y anulación.

---

## 5. Puntos abiertos (todos resueltos el 29/09/2026)

| # | Punto | Dónde impacta | Resolvió | Propuesta contractualizada |
|---|---|---|---|---|
| Q6a | ¿En qué estados de turno se registra un pago? | §2.4 paso 2 | PO (29/09/2026) | `DISPONIBLE` y `COMPLETO`, incluso vencidos — **ratificado 29/09/2026** |
| ~~Q6b~~ | **Resuelto por el backlog v2:** el pago guarda el alumno (HU-I-01 AC1, AC3, AC4) | Modelo §2.4 | — | `alumnoId` obligatorio, debe estar inscripto |
| Q6c | Sin editar ni anular, un monto mal tipeado no tiene corrección hasta la HU que se planifique | §3.6 | PO (29/09/2026) | **Resuelto 29/09/2026:** el PO planificará una HU en Sprint 3 para corregir estos casos (Regla N.° 8) |
| Q6d | ¿El profesor ve los montos en el detalle de sus turnos? | Permisos, §2.3 | PO (29/09/2026) | No — **ratificado 29/09/2026** |
| — | Tope del monto (9 dígitos enteros) y del nombre (2–40) son propuestas del SM | §2.1, §2.4 | SM (fijado) | Fijados |
| — | ¿Un alumno inactivo puede figurar como pagador? | §2.4 paso 3 | SM (fijado) | Sí, si está inscripto (hecho consumado); no se valida `activo` |
| — | B lee hoy `FormaPago` directo (`alumno.service.ts`) | Changelog, §3.2 | Relevamiento del código | Debe pasar a `verificarFormaPagoActiva()`; `listarFormasPagoActivas()` se mueve a este módulo |

> **Revisión 3 (Sprint 3).** Q6a **se conserva** para `POST /api/pagos` (T1, P-I1); en el flujo de HU-I-10 el pago se hace antes de la clase (criterios 3 y 7). Q6c queda **cumplida** por HU-I-06 (2.14): la corrección y la anulación son registros nuevos, sin tocar la Regla N.° 8 (T3). Q6d sigue vigente: el Profesor no ve montos ni precios (2.6.3). Los puntos abiertos nuevos de este sprint están en «Puntos abiertos de la Revisión 3», al comienzo de este archivo (P-I1 a P-I9, resueltos por el SM el 08/10/2026).
