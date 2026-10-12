# TASK: HU-C-21 — Cambiar el aula de las fechas ocupadas al generar varias clases

**Módulo:** C (Gestionar turnos)
**Sprint:** 3 · **Prioridad:** 9 · **SP:** 2 · **Carril:** 1 (se integra con el carril 2 solo a través del archivo central de textos)
**Rama:** `feature/HU-C-21`, creada desde `develop` (`b6e1721`). El relevamiento de esta task se hizo sobre el código de `develop`: los archivos de generación masiva no difieren entre `develop` y `feature/HU-I-11`.
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.9 (Revisión 5, generación masiva de HU-C-17) y **§2.9.1 (Revisión 6, contrato de esta historia)** · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-C-21 y convenciones 2, 7 y 9) · `docs/tasks/Sprint 2/HU-Sprint-2.md` §11 (criterios de HU-C-17 que esta historia reemplaza) · `docs/tasks/Sprint 2/Modulo C/HU-C-17.md` · `docs/tasks/Sprint 2/Modulo C/HU-C-16.md` · `docs/tasks/Sprint 3/Modulo C/HU-C-25.md` (confirmación) · `docs/DESIGN.md` §6 · `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 7, 10 y 11)
**Prototipo:** `C:\Users\agust\Desktop\Imagenes HU\HU-C-21` — «Vista previa con conflictos.png» y «Después de “Resolver todas”.png». Si el prototipo choca con esta task o con la spec, manda la task (ver §1.3).
**RBAC:** `turnos:crear` (Mesa de Entrada), **ya existe**. La ruta nueva de aulas libres usa el mismo permiso. La pantalla sigue usando `GET /api/turnos/aula/opciones` (`turnos:asignar_aula`, también existente) para el aula por defecto. Sin permisos nuevos.
**Schema:** sin cambios en `schema.prisma` y **sin migración**. Cada `Turno` ya guarda su propio `aulaId` y `cupoMaximoTurno`: un aula distinta por fecha no requiere ninguna columna nueva.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code relee el código real de la rama (no solo esta task) y reporta, **esperando confirmación explícita**:
- la lista final de archivos nuevos (0.2) y de archivos a modificar con qué cambia en cada uno (0.3), corregida contra lo que encuentre;
- la respuesta concreta a cada punto de 0.4.

No se implementa nada (sección 4 en adelante) hasta recibir el OK.

**Reglas de `docs/RULES.md` que esta task toca:**
- **Regla N.° 3** (aislamiento entre módulos): las aulas se leen solo por la fachada `src/server/aulas/aula.publico.ts` (`listarAulasActivasParaTurno`, `verificarAulaActiva`, `obtenerNombreAula`, `existeAula`, `hayAulasActivas`). **No se modifica el Módulo K** (`spec_modulo_K.md` lo declara «sin cambios» para HU-C-21). La disponibilidad del aula la resuelve C con `aulaConTurnoSuperpuesto()`, que lee la tabla de turnos del propio módulo.
- **Regla N.° 4** (la lógica vive en el servicio): las rutas solo validan, verifican el permiso, llaman al servicio y traducen. El orden de «Resolver todas», el cálculo de aulas libres y toda validación de fechas viven en `src/server/turnos/`, nunca en el componente.
- **Regla N.° 5** (contrato de respuesta): todo responde `{ data, error }`. Los campos nuevos son aditivos; no se quita ni se renombra ningún campo de Sprint 2.
- **Regla N.° 6** (Zod antes del servicio): los dos pedidos POST y la consulta GET nueva se validan con `safeParse`; un `!success` responde `400 VALIDATION_ERROR` con `detalles`.
- **Regla N.° 7** (condición y mutación atómicas): la confirmación conserva el patrón de HU-C-17: se recalcula todo dentro de la transacción, el `INSERT` lo defiende la exclusión GiST de `reservas_turno` y un `23P01` se traduce a `409 GENERACION_CON_CONFLICTOS`.
- **Regla N.° 10** (RBAC): `withPermission("turnos:crear")` en las tres rutas.
- **Regla N.° 11** (estructura de carpetas): el servicio y el schema siguen en `src/server/turnos/`, y la ruta nueva va en `src/app/api/turnos/generacion/aulas-libres/route.ts`.
- **Reglas N.° 1, 2 y 8:** no se borra nada ni se modifica ningún hecho registrado. La trazabilidad no cambia de mecanismo: columnas de auditoría en cada `Turno` (opción a) y lote de eventos en `eventos_turno` después del commit (opción b), igual que HU-C-17.

### 0.1. Ya existe (verificado en el código; no se vuelve a crear)

| Pieza | Archivo | Estado |
|---|---|---|
| Schema del pedido | `src/server/turnos/turno.generacion.schema.ts` | `GenerarTurnosSchema` `.strict()` con `.refine` de fechas. Tipos `VistaPreviaGeneracion`, `ResultadoGeneracion` y `MotivoConflictoGeneracion` |
| Cálculo puro | `src/server/turnos/turno.generacion.calculo.ts` | `calcularOcurrencias`, `validarEncajeEnFranja`, `sumarMesesCalendario`, `motivosConflictoGeneracion` (precedencia de `TURNO_EXISTENTE`) |
| Servicio | `src/server/turnos/turno.generacion.service.ts` | `calcularGeneracion()` (núcleo compartido por la vista previa y la confirmación), `vistaPreviaGeneracion()`, `confirmarGeneracion()`: `transaccion` + `bloquear(profesor)` + recálculo + `tx.turno.create` por fecha + `esConflictoDeReserva` + eventos después del commit |
| Disponibilidad | `src/server/turnos/turno.disponibilidad.ts` | `aulaConTurnoSuperpuesto(db, turno, aulaId)` y `profesoresConTurnoSuperpuesto()`. Ocupan solo los turnos `DISPONIBLE`/`COMPLETO` |
| Rutas | `src/app/api/turnos/generacion/route.ts` y `.../vista-previa/route.ts` | Mapeo de códigos a status. **Todo `ServiceError` no listado cae en 409** (ver 4.6) |
| Pantalla | `src/app/(dashboard)/turnos/nuevo/turno-recurrente.tsx` | Formulario + `TablaVistaPrevia`. Ya rotula `PROFESOR_OCUPADO` y `TURNO_EXISTENTE` como «Profesor con otra clase». El botón «Confirmar generación» guarda **sin** diálogo de confirmación. Ante un 409 muestra una tabla de solo lectura («conflictos recalculados») |
| Confirmación común | `src/components/shared/confirmar-accion-dialog.tsx` + `fetchOLanzar` (`src/lib/fetch-autenticado.ts`) | De HU-C-25, listo para consumir |
| Textos | `src/lib/textos.ts` + `src/lib/claves-textos.test.ts` | Claves `ui.clases.interfaz.*` de la pantalla actual. La prueba de claves corre en cada PR |
| Tests de HU-C-17 | `turno.generacion.{schema,calculo,service}.test.ts`, `turno.generacion.pg.test.ts`, `src/app/api/turnos/generacion/route.test.ts`, `turno-recurrente.test.tsx` | Tienen que seguir pasando **sin cambios** salvo los que esperan el aviso viejo o la confirmación directa (ver 0.4 R3) |

**Ya hecho en esta rama, no tocar:** la corrección de la cita de la «última viñeta del criterio 5» en `spec_modulo_C.md` §2.9.1 (nota de compatibilidad). Es un cambio de documentación separado del funcional, aprobado por el PO. Claude Code no edita la spec.

### 0.2. Archivos nuevos (a confirmar en el relevamiento)

- `src/app/api/turnos/generacion/aulas-libres/route.ts` — `GET` de aulas libres para una fecha y horario (4.4).
- `src/app/api/turnos/generacion/aulas-libres/route.test.ts`.
- `docs/testing/Modulo C/hu-c-21/` — `HU-C-21-evidencia.md`, `HU-C-21.postman_collection.json`, `HU-C-21.sql` y capturas (mismo formato que `hu-c-22`).
- Opcional, según 0.4 R1: `src/server/turnos/turno.generacion.aulas.ts` (+ test) si la lógica de aulas libres y «Resolver todas» hace que el servicio crezca demasiado.
- Opcional, según 0.4 R7: un componente propio para la tabla de la vista previa, junto a `turno-recurrente.tsx`.

### 0.3. Archivos existentes a modificar

| Archivo | Qué cambia |
|---|---|
| `src/server/turnos/turno.generacion.schema.ts` | Campos opcionales `aulas_por_fecha` y `fechas_excluidas`; variante de vista previa con `resolver_automaticamente`; tipos de respuesta ampliados (4.1) |
| `src/server/turnos/turno.generacion.calculo.ts` | Funciones puras nuevas: orden de candidatas para «Resolver todas», `solo_excluible` y validación de pertenencia de fechas (testeables sin base) |
| `src/server/turnos/turno.generacion.service.ts` | Aula por fecha, exclusión, cupo por aula, `sin_aulas_libres` y «Resolver todas» en el cálculo; aula y cupo por turno, conteos nuevos y eventos por aula en la confirmación (4.2 a 4.5) |
| `src/app/api/turnos/generacion/route.ts` y `.../vista-previa/route.ts` | Schema que corresponde a cada ruta; `VALIDATION_ERROR` del servicio → 400 (4.6) |
| `src/app/(dashboard)/turnos/nuevo/turno-recurrente.tsx` | Acciones por fila, «Resolver todas», banners, confirmación de HU-C-25, resumen final y manejo del 409 (§5) |
| `src/lib/textos.ts` | Claves nuevas bajo `ui.clases.generacion.*` y `confirmaciones.clases.generar` (4.7) |
| Tests existentes de generación | Ampliar con los casos de §6; actualizar solo lo que cambia por esta historia |

**No se modifican:** `HU-C-17.md`, `HU-C-16.md`, `schema.prisma`, migraciones, `prisma/seed.ts`, `src/server/aulas/*`, `turno.disponibilidad.ts`, `turno.reserva-error.ts`, los contratos de C-07, C-16 y C-18, ni el wizard individual.

### 0.4. Relevar antes de asumir (responder con la pregunta concreta, sin inferir)

- **R1 — Dónde vive la lógica de aulas libres.** La misma función (`aulasLibresEn(fecha, horaInicio, duracionMin)` o el nombre que propongas) la usan la ruta GET, «Resolver todas» y `sin_aulas_libres`. Proponé si va en `turno.generacion.service.ts` o en un archivo aparte, y cuántas consultas implica en el peor caso (40 fechas × aulas activas del seed). Si el número es alto, proponé cómo bajarlo **sin reimplementar** la regla de superposición (por ejemplo, una sola lectura de los turnos agendados de esa fecha y aplicarles `intervalosSeSuperponen`), y mostrá que el resultado es idéntico a `aulaConTurnoSuperpuesto`.
- **R2 — Transacción y fachada de K.** `listarAulasActivasParaTurno` no recibe `db` y siempre usa el cliente global. Confirmá que solo se llama fuera de la transacción: en la vista previa y en la ruta GET. En la confirmación no se resuelve nada ni se calcula `sin_aulas_libres` (4.5). Si encontrás un caso que obligue a llamarla dentro de la transacción, avisá antes de tocar K.
- **R3 — Tests que cambian.** Listá qué tests existentes fallan por diseño: el que espera «Elegí otra aula para todo el rango», los que confirman sin diálogo y los que esperan la tabla de solo lectura del 409. Proponé el cambio puntual de cada uno. Los valores esperados de los tests de HU-C-17 no cambian (compatibilidad, §1.2). Resultado del relevamiento: ver 0.5.
- **R4 — Detalle del 409.** La confirmación devuelve en `detalles` la vista previa recalculada. Confirmá que con los campos nuevos sigue serializando bien y qué hace hoy el cliente con ella. La UI nueva no la muestra: pide una vista previa nueva (§5.7).
- **R5 — Claves de textos.** Confirmá que `ui.clases.generacion.*` y `confirmaciones.clases.generar` no existen. Confirmá también si `claves-textos.test.ts` permite dejar claves sin uso o si hay que borrar las que esta historia deja de usar (`ui.clases.interfaz.elegiOtraAulaParaTodoElRangoOAcotaLasFechasY` y `ui.clases.interfaz.seUsaLaMismaAulaEnTodasLasFechas`). Verificá con `grep` que ninguna otra pantalla las use antes de borrarlas.
- **R6 — Schemas de las dos rutas.** `GenerarTurnosSchema` es un `ZodEffects` (tiene `.refine`) y no se puede `.extend()` directo. Proponé la estructura: objeto base + dos schemas finales (confirmación sin `resolver_automaticamente`; vista previa con él), conservando el nombre exportado `GenerarTurnosSchema` para la confirmación.
- **R7 — Tamaño del componente.** `turno-recurrente.tsx` tiene ~300 líneas. Proponé si la tabla con sus acciones por fila se separa en un componente propio en la misma carpeta, o si queda en el mismo archivo.


### 0.5. Resultado del relevamiento (aprobado por el PO, 12/10/2026)

Claude Code relevó el código de la rama y verificó 0.1. Discrepancias encontradas (todas confirmadas contra el código) y cómo se resuelven:

- **Tests de HU-C-17 (corrige §1.2 y R3).** El comportamiento sigue siendo compatible, pero tres tests no pueden quedar sin tocar por cómo están escritos: el mock de `@/server/aulas/aula.publico` en `turno.generacion.service.test.ts` no exporta `obtenerNombreAula` ni `listarAulasActivasParaTurno`; ese archivo compara la respuesta completa con `toEqual` (líneas ~71 y ~93); y `turno.generacion.pg.test.ts` usa `expect.arrayContaining([{ fecha, estado, motivos }])` (líneas ~124 y ~134), que compara cada elemento completo. **Aprobado** como ajuste mecánico: agregar esos dos exports al mock, pasar de `toEqual` a `toMatchObject` y envolver los elementos en `expect.objectContaining`. **Los valores esperados de Sprint 2 no cambian y no se borra ningún test.** Los campos nuevos se prueban en tests nuevos. API y schema, sin cambios.
- **Zod 4.6.5.** El schema actual no es un `ZodEffects`, pero `.extend()` sobre un objeto con refinamientos falla igual. Se mantiene la estructura de R6: objeto base de campos + `GenerarTurnosSchema` (confirmación, conserva nombre, mensaje y `path` del rango) + `VistaPreviaGeneracionSchema` (base + `resolver_automaticamente`), los dos `.strict().superRefine(validar)`. El `.max(40)` de las listas es solo un tope defensivo: el límite real lo pone la pertenencia a las fechas calculadas. En el GET, `duracion_min` usa `z.coerce`, como la variante existente de `turno.schema.ts`.
- **Nombre del aula por defecto.** `verificarAulaActiva` no devuelve el nombre: se agrega una lectura con `obtenerNombreAula(id, db)` (fachada de K, sin cambios).
- **Aulas libres (R1). Aprobado:** archivo nuevo `src/server/turnos/turno.generacion.aulas.ts` con una lectura agrupada: una llamada a `listarAulasActivasParaTurno(1)` y un solo `db.turno.findMany` por `fechaTurno in fechas`, `estadoTurno in ESTADOS_AGENDADOS` y `aulaId in activas`, agrupado en memoria con `intervaloTurno` + `intervalosSeSuperponen`, importados sin modificar `turno.disponibilidad.ts`. Peor caso: unas 2 consultas extra en lugar de ~320. Se usa solo para aulas libres (ruta GET, `sin_aulas_libres` y «Resolver todas»). **La validación por fecha existente (`aulaConTurnoSuperpuesto` sobre el aula de cada fecha) no cambia.** Las fechas que resuelve «Resolver todas» no se vuelven a consultar: el aula sale de esa misma lectura y es libre por construcción. Obligatorio: un test PostgreSQL de equivalencia contra `aulaConTurnoSuperpuesto` (superpuesto, contiguo, `PENDIENTE` y `CANCELADO` no ocupan, otra fecha). El orden de candidatas es una función pura en `turno.generacion.calculo.ts`.
- **Claves de textos (R5). Aprobado** borrar `ui.clases.interfaz.elegiOtraAulaParaTodoElRangoOAcotaLasFechasY`, `ui.clases.interfaz.seUsaLaMismaAulaEnTodasLasFechas` y `ui.clases.interfaz.conflictosRecalculadosAlConfirmar` (queda sin uso por D11). Las tres se usan solo en `turno-recurrente.tsx`, y el verificador de claves no exige borrar las que no se usan. «Reintentar» reutiliza `ui.formasPago.reintentar`.
- **Confirmación y 409 (corrige §5.6). Aprobado:** `fetchOLanzar` lanza `new Error(message)` sin `code`, así que no distingue el 409. `onConfirmar` usa `fetchAutenticado` directamente: ante `409 GENERACION_CON_CONFLICTOS` (con o sin `detalles`, incluido el que viene de `23P01`) resuelve **sin lanzar** y deja marcado el conflicto; `onExito` lo detecta y sigue con §5.7 (vista previa nueva con las mismas listas) en lugar de mostrar el éxito. Cualquier otro rechazo lanza `Error(message)` y se ve dentro del modal, igual que con `fetchOLanzar`. `fetch-autenticado.ts` no se toca.
- **Pedido de Sprint 2 idéntico.** Si `aulas_por_fecha` o `fechas_excluidas` están vacías, el cliente **no las envía**. El test de igualdad del payload existente sigue igual.
- **Componente (R7). Aprobado:** la tabla con sus filas y acciones pasa a `src/app/(dashboard)/turnos/nuevo/tabla-vista-previa-generacion.tsx`. El estado (listas, clave vigente, pedidos) queda en `turno-recurrente.tsx`.
- **Archivos nuevos finales:** la ruta `aulas-libres` + su test, `turno.generacion.aulas.ts` + su test, `tabla-vista-previa-generacion.tsx` y la evidencia en `docs/testing/Modulo C/hu-c-21/`. **A modificar**, además de 0.3: `turno.generacion.service.test.ts`, `turno.generacion.pg.test.ts` y `turno-recurrente.test.tsx` (ajustes de R3 y de esta sección).

---

## 1. Nota de alcance

### 1.1. Qué reemplaza de HU-C-17 y qué sigue igual

HU-C-21 **modifica** la vista previa de «Generar varias clases» (HU-C-17, `/turnos/nuevo`, modo «Generar varias clases»). **No es una pantalla nueva**, ni una ruta de página, ni un ítem de menú. La numeración es la de los criterios de HU-C-17 en el backlog (`HU-Sprint-2.md` §11). En `HU-C-17.md` equivalen a AC4, parte de AC5 y AC6.

| HU-C-17 (backlog) | Texto original | Qué pasa con HU-C-21 |
|---|---|---|
| Criterio 4 | El aula elegida se aplica a todas las fechas; no se admite un aula distinta por semana | **Reemplazado.** El aula elegida es el aula **por defecto**; una fecha ocupada puede llevar otra aula (criterios 1 a 3 de C-21) |
| Criterio 5, última viñeta | «El único solapamiento que se valida en este paso es el de aula» | **Reemplazada** por el criterio 5 de C-21: también se marcan profesor ocupado y clase duplicada («Profesor con otra clase»), que solo se pueden excluir. **Ya implementado** por la nota del 01/10/2026: esta historia no cambia esa validación, solo agrega la acción de excluir |
| Criterio 6 | Vista previa; un conflicto se resuelve **cambiando el aula para todo el rango** o acotando el rango; todo o nada | **Se reemplaza la forma de resolver conflictos**: cambiar el aula de esa fecha, «Resolver todas» o excluir la fecha. **No se reemplaza la atomicidad**: sigue siendo todo o nada, ahora sobre las fechas incluidas (criterio 7 de C-21). El aviso «Elegí otra aula para todo el rango…» se reemplaza por el de esta historia |

**Siguen vigentes sin cambios** los criterios 1, 2, 3, 7, 8, 9 y 10 de HU-C-17 (AC1 a AC3 y AC7 a AC10 de su task): orden del flujo, encaje en la franja, tramo sobrante, alta directa `DISPONIBLE 0/N`, sin excepciones del profesor, ejecución manual y acceso desde `/turnos/nuevo`. También siguen igual los límites (6 meses calendario, 40 fechas), la omisión de hoy vencido, la precedencia de `TURNO_EXISTENTE`, el `generacion_id`, los tres eventos por clase y la defensa GiST. **`HU-C-17.md` no se edita.**

«En esa franja» del criterio 5 de C-21 se implementa como en HU-C-17: superposición contra el **intervalo real** de la clase (`[hora_inicio, hora_inicio + duración)`), no contra toda la franja del profesor. La historia dice que la marca «reutiliza la validación que ya hace HU-C-17»; no es un requisito nuevo.

### 1.2. Compatibilidad (spec §2.9.1)

Los campos nuevos del pedido son **opcionales**. Un pedido sin `aulas_por_fecha`, sin `fechas_excluidas` y sin `resolver_automaticamente` se comporta **exactamente** como en Sprint 2: mismas fechas, mismos estados, mismos motivos y mismos códigos de error. La respuesta solo **suma** campos. Los tests de servicio, PostgreSQL y API de HU-C-17 son la prueba de que esto se cumple: sus valores esperados de Sprint 2 no cambian y no se borra ninguno. Solo se admiten los ajustes mecánicos aprobados en 0.5 (mocks y matchers que comparaban el objeto completo).

### 1.3. Decisiones del PO tomadas en el relevamiento (12/10/2026)

| # | Tema | Decisión |
|---|---|---|
| D1 | Fecha con «Aula ocupada» **y** «Profesor con otra clase» | Cambiar el aula no la resuelve: **no** se ofrece «Cambiar aula», solo «Excluir esta fecha» (criterio 5). «Resolver todas» la saltea y queda marcada para elegir a mano (criterio 3). Tiene prioridad sobre la letra del criterio 1 |
| D2 | Badge «Aula ocupada · Matemática II» del prototipo | Solo «Aula ocupada». La API no informa qué clase ocupa el aula y ningún criterio lo pide |
| D3 | Aviso «Se resolvieron 2 fechas» | **Mensaje en la página** (banner `role="status"` arriba de la tabla), **no toast**: `DESIGN.md` §6.1 reserva el toast a acciones desde un modal, y esta es una página completa (§6.2). Tres variantes: todas, algunas o ninguna resuelta |
| D4 | «Deshacer» en una fila con aula cambiada | Se incluye: saca esa fecha de `aulas_por_fecha` y vuelve a pedir la vista previa |
| D5 | Excluir fechas libres | «Excluir esta fecha» en **toda** fila incluida, también las libres (criterio 4: «se puede excluir cualquier fecha»). Una fila excluida se ve atenuada, con el badge «Excluida» y la acción «Incluir de nuevo» |
| D6 | Última fecha incluida | No se puede excluir (acción deshabilitada con su motivo). El servidor igual responde `400 SIN_FECHAS_EN_RANGO` si llegan todas excluidas |
| D7 | Cupo distinto (criterio 6) | «cupo 6 en lugar de 8» debajo del badge, **solo cuando el cupo difiere** del aula por defecto |
| D8 | Recálculo | Toda acción por fila y «Resolver todas» vuelven a pedir la vista previa al servidor con las listas actualizadas. El cliente **nunca** calcula disponibilidad |
| D9 | Cambios en el formulario | Cambiar cualquier dato del formulario (materia, profesor, franja, duración, hora, **aula por defecto**, desde, hasta) borra `aulas_por_fecha`, `fechas_excluidas` y la vista previa |
| D10 | Aula de una fecha igual al aula por defecto | `400 VALIDATION_ERROR`. Defensivo: la UI nunca lo envía |
| D11 | 409 al confirmar | En vez de la tabla de solo lectura actual, se pide una vista previa nueva **con las mismas elecciones** y se muestra con sus acciones, junto con el aviso de que la disponibilidad cambió |
| D12 | Confirmación de HU-C-25 | `ConfirmarAccionDialog` antes de generar, con materia, profesor, cantidad de clases, cuántas con aula cambiada y cuántas fechas excluidas. El éxito se informa en el **banner inline** de la página (DESIGN §6.3, flujo de página completa), con los tres números del criterio 8 |
| D13 | Cita de la spec | La cita mal hecha de la «última viñeta del criterio 5» en §2.9.1 se corrige en este mismo PR, como diff separado. **Ya está aplicado** en la rama |

### 1.4. Plan de recorte (convención 7, paso 4)

«Resolver todas» es un extra respecto del pedido y es el último paso del plan de recorte. Se implementa **separable**: un flag propio en el pedido (`resolver_automaticamente`), una función propia en el servicio y un botón propio en la UI. Si se recorta, se quitan esas tres piezas sin tocar el cambio de aula por fecha ni la exclusión. Se implementa **después** de que funcionen el cambio de aula por fecha y la exclusión (fases en §7).

**Fuera de alcance de esta task (explícito):**
- Mostrar qué clase ocupa el aula (D2).
- Cambiar el aula de una fecha **libre** (sin conflicto). El criterio 1 ofrece «Cambiar aula» solo en fechas con «Aula ocupada». Una fecha cuya aula cambiada se vuelve a ocupar sí vuelve a ofrecerlo.
- Resolver «Profesor con otra clase» con otra hora u otro profesor por fecha: solo se excluye (criterio 5).
- Que «Resolver todas» corra en la confirmación: **la confirmación nunca resuelve**, solo valida lo que recibe (spec §2.9.1, paso 5).
- Cambios en el Módulo K, en el wizard individual, en el horario del profesor o en el estado inicial `DISPONIBLE 0/N`.
- Bloqueo adicional de aulas: el único bloqueo explícito sigue siendo el del profesor (HU-D-08). La defensa del aula sigue siendo la exclusión GiST (spec §2.9, paso 3 de la confirmación; sin advisory lock).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito**, al generar varias clases, elegir otra aula solo para las fechas en que el aula elegida está ocupada
**Para** generar el cuatrimestre completo aunque el aula no esté libre todas las semanas, sin tener que cambiar el aula de todas las fechas

**SP estimado:** 2 · Cambio obligatorio E (pedido por los profesores en la revisión del Incremento 2). Depende de HU-C-17 y HU-C-16, ambas mergeadas. **Sin verificaciones diferidas**: HU-K-04 está fuera del backlog (05/10/2026), así que en este sprint no se desactivan aulas, y «aulas activas» del criterio 2 cubre las que ya estén inactivas.

**Criterios de aceptación (backlog, literales):**
1. En la vista previa de “Generar varias clases” (HU-C-17), cada fecha con “Aula ocupada” muestra la acción “Cambiar aula”.
2. “Cambiar aula” ofrece solo las aulas activas libres en esa fecha y horario, con su capacidad. Al elegir una, la fila pasa a “Libre · <Aula nueva> (cambiada)” y el resto de las fechas mantiene el aula original.
3. La acción “Resolver todas” asigna automáticamente, a cada fecha ocupada, el aula libre de menor capacidad que sea igual o mayor a la original (si hay empate, por nombre); las fechas que no se pueden resolver quedan marcadas para elegir a mano.
4. Si en una fecha no hay ninguna aula libre, se muestra “Sin aulas libres en este horario” y la opción “Excluir esta fecha”; también se puede excluir cualquier fecha manualmente.
5. La vista previa sigue marcando, como en HU-C-17 (spec_modulo_C.md §2.9, paso 5), las fechas en que el profesor ya tiene una clase Disponible o Completa superpuesta o ya existe una clase no cancelada de la misma materia y profesor en esa franja (incluidas las Pendientes); ambas se muestran como “Profesor con otra clase”. Esas fechas no pueden resolverse cambiando el aula: solo pueden excluirse. El aviso actual “Elegí otra aula para todo el rango” se reemplaza por el de esta historia.
6. Si el aula nueva tiene distinta capacidad, el cupo de esa clase es el del aula nueva (HU-C-17 toma el cupo del aula) y la fila lo indica (por ejemplo, “cupo 6 en lugar de 8”).
7. La generación sigue siendo todo o nada sobre las fechas incluidas: el botón “Confirmar generación” se habilita cuando ninguna fecha incluida tiene conflictos, y al confirmar se revalida la disponibilidad de cada aula elegida y la del profesor en cada fecha incluida.
8. El resumen final informa cuántas clases se generaron, en cuántas se cambió el aula y cuántas fechas se excluyeron.

**Cómo se cumple cada criterio:** 1 → §5.3 (acciones por fila) · 2 → 4.4 (aulas libres) + §5.4 · 3 → 4.3 + §5.5 · 4 → 4.2 pasos 3 y 7 + `sin_aulas_libres` + §5.3 · 5 → 4.2 paso 6 (validación de HU-C-17 sin cambios) + `solo_excluible` + D1 · 6 → 4.2 paso 5 + §5.3 · 7 → 4.5 + §5.6 · 8 → 4.5 (respuesta `201`) + §5.6.

---

## 3. Alcance de esta task

Backend y frontend, conforme a `spec_modulo_C.md` §2.9.1 sobre la base de §2.9:
- Schema: dos campos opcionales en la vista previa y la confirmación, y un flag solo de la vista previa.
- Servicio de generación: aula por fecha, exclusión, cupo por aula, `solo_excluible`, `sin_aulas_libres`, «Resolver todas» y conteos nuevos. La confirmación crea cada clase con su aula y su cupo.
- Ruta nueva `GET /api/turnos/generacion/aulas-libres`.
- Ajuste del mapeo de errores de las dos rutas de generación.
- UI de la vista previa: acciones por fila, «Resolver todas», banners nuevos, confirmación de HU-C-25, resumen final y manejo del 409.
- Textos nuevos en el archivo central (HU-C-23). Ningún texto visible dice «turno» (convención 9).
- Tests de los tres niveles + frontend, y evidencia en `docs/testing/Modulo C/hu-c-21/`.

**Fuera de alcance:** ver §1.4.

---

## 4. Contrato Backend

### 4.1. Schema (`src/server/turnos/turno.generacion.schema.ts`)

Campos nuevos, **todos opcionales**, sobre el pedido actual. `aula_id` sigue siendo **obligatorio** y es el aula por defecto de todo el rango.

```typescript
aulas_por_fecha: z.array(z.object({ fecha: fechaCalendarioValidaSchema, aula_id: z.cuid() }).strict())
  .max(/* tope razonable, p. ej. 40 */).optional(),   // aula distinta solo para esas fechas (criterio 2)
fechas_excluidas: z.array(fechaCalendarioValidaSchema).max(/* ídem */).optional(), // fechas que no se generan (criterio 4)
// Solo en la vista previa (la confirmación lo rechaza: .strict() → 400 VALIDATION_ERROR):
resolver_automaticamente: z.boolean().optional(),     // «Resolver todas» (criterio 3)
```

**Validaciones de Zod** (`superRefine` sobre el objeto, con `path` explícito): una fecha repetida dentro de `aulas_por_fecha`; una fecha repetida dentro de `fechas_excluidas`; una fecha que está en las dos listas. Todas → `400 VALIDATION_ERROR`.

**Validaciones del servicio** (necesitan las fechas calculadas o el aula por defecto; lanzan `ServiceError("VALIDATION_ERROR", mensaje, { campo, fecha })`, que la ruta traduce a 400, ver 4.6):
- una fecha de cualquiera de las dos listas que **no** pertenece a las fechas calculadas del rango (incluye una fecha de hoy ya vencida, que no se calcula);
- un `aula_id` de `aulas_por_fecha` igual al `aula_id` por defecto (D10).

`fechaCalendarioValidaSchema` devuelve un `Date` UTC a medianoche. Las comparaciones contra las fechas calculadas se hacen sobre `AAAA-MM-DD` (`toISOString().slice(0, 10)`), igual que el código actual.

**Estructura (0.4 R6):** objeto base + `GenerarTurnosSchema` (confirmación; conserva el nombre y el `.refine` de fechas) + `VistaPreviaGeneracionSchema` (base + `resolver_automaticamente`). Los dos son `.strict()`.

**Tipos de respuesta** (ampliación aditiva de los actuales):

```typescript
type FechaVistaPrevia = {
  fecha: string; estado: "OK" | "CONFLICTO"; motivos: MotivoConflictoGeneracion[]; // Sprint 2, sin cambios
  aula: { id: string; nombre: string };   // aula de ESA fecha (la por defecto o la elegida)
  aula_cambiada: boolean;                 // true si es distinta del aula por defecto
  cupo: number;                           // capacidad del aula de esa fecha
  cupo_aula_por_defecto: number;
  excluida: boolean;                      // true → estado "OK", motivos []
  sin_aulas_libres: boolean;              // solo con AULA_OCUPADA y no solo_excluible (4.2 paso 7)
  solo_excluible: boolean;                // PROFESOR_OCUPADO o TURNO_EXISTENTE (D1)
};
type VistaPreviaGeneracion = {
  cantidad: number;                // fechas calculadas, incluidas las excluidas (significado de Sprint 2)
  cantidad_incluida: number;       // fechas que se generarían
  con_aula_cambiada: number;       // incluidas con aula_cambiada
  excluidas: number;
  fechas: FechaVistaPrevia[];      // TODAS las calculadas, en orden, también las excluidas
  hay_conflictos: boolean;         // solo sobre las incluidas
  fechas_omitidas_vencidas: number;
};
type ResultadoGeneracion = {
  generacion_id: string; cantidad: number; turno_ids: string[]; // Sprint 2, sin cambios
  aulas_cambiadas: number; fechas_excluidas: number;            // criterio 8
};
```

### 4.2. Cálculo (núcleo compartido `calcularGeneracion`, vista previa y confirmación)

Se conservan, en el mismo orden y con los mismos códigos, los pasos actuales: materia, profesor, dicta la materia, franja, hay aulas activas, aula por defecto activa, límites, encaje, rango, ocurrencias, tope de 40 y `SIN_FECHAS_EN_RANGO` sobre las calculadas. Después:

1. **Pertenencia de las listas:** cada fecha de `aulas_por_fecha` y de `fechas_excluidas` pertenece a las calculadas; si no, `400 VALIDATION_ERROR` (4.1).
2. **Aulas elegidas:** para cada `aula_id` **distinto** de `aulas_por_fecha`: igual al aula por defecto → `400 VALIDATION_ERROR` (D10). Si no, se valida como el aula por defecto: `verificarAulaActiva(id, db)`; si no está activa, `existeAula` → `409 AULA_INACTIVA` o `404 AULA_NO_ENCONTRADA`. Se lee el nombre con `obtenerNombreAula(id, db)`. Se guarda la capacidad de cada una (una lectura por aula distinta, no por fecha).
3. **Exclusión:** las fechas de `fechas_excluidas` **no se validan** (sin consultas de disponibilidad) y se devuelven con `excluida: true`, `estado: "OK"`, `motivos: []`, `solo_excluible: false`, `sin_aulas_libres: false` y el aula que tendrían. Si **todas** quedan excluidas: `400 SIN_FECHAS_EN_RANGO` (mismo código de §2.9 paso 3).
4. **Aula de cada fecha incluida:** la de `aulas_por_fecha` si existe; si no, `aula_id`.
5. **Cupo:** `cupo` = capacidad del aula de esa fecha; `cupo_aula_por_defecto` = capacidad de `aula_id` (criterio 6).
6. **Disponibilidad por fecha incluida:** **sin cambios respecto de HU-C-17**, salvo que `aulaConTurnoSuperpuesto` se evalúa con el aula **de esa fecha**: duplicado (`TURNO_EXISTENTE`, con precedencia) → aula → profesor, con `motivosConflictoGeneracion` tal como está. `solo_excluible = motivos incluye PROFESOR_OCUPADO o TURNO_EXISTENTE`.
7. **Sin aulas libres (criterio 4), solo en la vista previa:** para cada fecha incluida con `AULA_OCUPADA` y `solo_excluible === false`, `sin_aulas_libres = (aulas libres en esa fecha y horario).length === 0`, usando la misma función que la ruta GET (4.4). En la confirmación se devuelve `false` (0.4 R2; la UI no lo necesita ahí, D11).
8. **«Resolver todas»:** solo si `resolver_automaticamente === true` (vista previa). Ver 4.3. Corre **antes** de armar la respuesta, y las fechas que resuelve se recalculan con su aula nueva.
9. **Resumen:** `cantidad`, `cantidad_incluida`, `con_aula_cambiada`, `excluidas`, `hay_conflictos` (solo incluidas) y `fechas_omitidas_vencidas`.

### 4.3. «Resolver todas» (criterio 3; separable por el plan de recorte)

Función propia, invocada solo desde la vista previa con `resolver_automaticamente: true`.

- **Candidatas:** fechas **incluidas** con `AULA_OCUPADA`, `solo_excluible === false` (D1) y **sin** aula en `aulas_por_fecha` (no pisa elecciones hechas a mano, spec §2.9.1 paso 5).
- **Elección por fecha:** de las aulas libres en esa fecha y horario (4.4), las de **capacidad ≥ capacidad del aula por defecto**, ordenadas por capacidad ascendente, después nombre ascendente y por último `id` (para que el orden sea determinista). Se toma la primera.
- **Resultado:** la fecha queda con esa aula (`aula_cambiada: true`, `estado: "OK"`, su cupo). Si no hay ninguna que cumpla, la fecha **queda en `CONFLICTO`** para elegir a mano. Si además no hay ninguna aula libre de ninguna capacidad, `sin_aulas_libres: true`.
- La respuesta es una vista previa completa. El cliente **deriva** de ella las aulas elegidas (§5.5) y las reenvía como `aulas_por_fecha`; la confirmación nunca recibe `resolver_automaticamente`.
- Lógica de orden pura en `turno.generacion.calculo.ts` (testeable sin base).

### 4.4. Aulas libres de una fecha — `GET /api/turnos/generacion/aulas-libres?fecha=&hora_inicio=&duracion_min=`

- **Permiso:** `withPermission("turnos:crear")`. Solo lectura.
- **Query** (Zod `.strict()`): `fecha` (`fechaCalendarioValidaSchema`), `hora_inicio` (el schema de hora de `turno.schema.ts`) y `duracion_min` (entero, duración permitida, el mismo refine de HU-C-17). Inválida → `400 VALIDATION_ERROR` con `detalles`.
- **Servicio** (0.4 R1): `listarAulasActivasParaTurno(1)` (fachada de K, sin cambios) + `aulaConTurnoSuperpuesto(prisma, { fechaTurno, horaInicioTurno, duracionMinutosTurno }, aula.id)` por aula, o la variante equivalente aprobada en R1. Devuelve solo las **activas libres**, ordenadas por capacidad ascendente, nombre e id.
- **Respuesta:** `200 { data: [{ id, nombre, capacidad }], error: null }`. Sin aulas libres o sin aulas activas → `200 { data: [] }` (no es error).
- **Errores:** `400 VALIDATION_ERROR` · `401` · `403 SIN_PERMISO`.

### 4.5. Confirmación — `POST /api/turnos/generacion`

Mismo flujo que HU-C-17 (`transaccion` → `bloquear` del profesor → `calcularGeneracion` dentro de la transacción → si hay conflictos, `409 GENERACION_CON_CONFLICTOS` con la vista previa recalculada en `detalles` → `INSERT`s → `esConflictoDeReserva` → eventos después del commit), con estas diferencias:

- Se crea un `Turno` `DISPONIBLE` **por cada fecha incluida**, con `aulaId` y `cupoMaximoTurno` de **su** aula (criterio 6). Las excluidas no se crean.
- Se **revalida dentro de la transacción** la disponibilidad de cada aula elegida y la del profesor en cada fecha incluida (criterio 7). Es el mismo `calcularGeneracion`, no una validación aparte. Cualquier conflicto → 409, sin crear ninguna clase.
- No resuelve nada ni calcula `sin_aulas_libres` (§1.4, 4.2 paso 7).
- **Respuesta `201`:** `{ generacion_id, cantidad, turno_ids, aulas_cambiadas, fechas_excluidas }`. `cantidad` es la cantidad creada (igual que en Sprint 2).
- **Eventos (después del commit, mismo lote `emitirEventosTurno`):** por clase, `turno:configurado` (con `generacion_id`, sin cambios), `turno:aula_asignada` con `aula_id` y `cupo_maximo` **de esa clase**, y `turno:disponibilizado` con el `aula_id` **de esa clase**. Hoy los tres usan `input.aula_id` y la capacidad única: hay que llevar el aula y el cupo junto con cada turno creado.
- Bloqueo: sin cambios (solo el profesor). No se agrega advisory lock.

### 4.6. Rutas y mapeo de errores

`route.ts` (confirmación) usa `GenerarTurnosSchema`; `vista-previa/route.ts` usa `VistaPreviaGeneracionSchema`. **Mapeo:** hoy todo `ServiceError` no listado cae en 409. Se agrega **`VALIDATION_ERROR` → 400**, con sus `detalles` en las dos rutas. Hoy la vista previa no los expone; se agrega `...(error.detalles ? { detalles } : {})` como ya hace la confirmación. El resto del mapeo no cambia. Si el mapeo se extrae a una función común para no duplicarlo, se hace en `src/server/turnos/` o junto a las rutas, sin cambiar ningún status existente.

**Errores esperados (vista previa y confirmación):** los de §2.9 sin cambios + `400 VALIDATION_ERROR` (listas, pertenencia, D10, `resolver_automaticamente` en la confirmación) + `400 SIN_FECHAS_EN_RANGO` (todo excluido) + `404 AULA_NO_ENCONTRADA` / `409 AULA_INACTIVA` (aula de una fecha). Los motivos por fecha siguen sin ser errores HTTP.

### 4.7. Textos nuevos (`src/lib/textos.ts`, HU-C-23)

Bajo `ui.clases.generacion.*`, para no pisar las claves de `ui.clases.*` del carril 2. Sustantivos en singular y plural y estados en femenino. Ninguno dice «turno». Las claves exactas las propone Claude Code; los valores son estos (salvo singular/plural):

| Uso | Texto |
|---|---|
| Ayuda bajo «Aula» (reemplaza «Se usa la misma aula en todas las fechas.») | «Si está ocupada en alguna fecha, en la vista previa podés cambiar el aula solo de esa fecha.» |
| Banner de conflictos (reemplaza «Elegí otra aula para todo el rango…») | «**{n} fechas tienen conflicto.** Cambiá el aula de las fechas con el aula ocupada o excluilas; las fechas con el profesor ocupado solo pueden excluirse.» (singular: «1 fecha tiene conflicto.») |
| Botón | «Resolver todas» |
| Ayuda del botón | «Asigna a cada fecha ocupada el aula libre de menor capacidad que sea igual o mayor a la original.» |
| Resultado de «Resolver todas»: todas | «Se resolvieron {n} fechas.» / «Se resolvió 1 fecha.» |
| Resultado: algunas | «Se resolvieron {n} de {m} fechas. Las demás quedan para elegir el aula a mano o excluirlas.» |
| Resultado: ninguna | «No se pudo resolver ninguna fecha automáticamente. Elegí el aula a mano o excluí las fechas.» |
| Acciones por fila | «Cambiar aula» · «Excluir esta fecha» · «Deshacer» · «Incluir de nuevo» · «Cancelar» |
| Badges | «Libre · {aula} (cambiada)» · «Sin aulas libres en este horario» · «Excluida» (ya existen: «Libre», «Aula ocupada», «Profesor con otra clase») |
| Cupo distinto | «cupo {nuevo} en lugar de {original}» |
| Selector de aula | «{aula} · capacidad {n}» · «Cargando aulas libres…» · «No se pudieron cargar las aulas libres.» · «Reintentar» (reutilizar la clave existente si ya hay una) |
| Última fecha | «Tiene que quedar al menos una fecha para generar.» |
| Resumen de la vista previa | Sumar «· {n} excluidas» al resumen actual cuando hay excluidas; la cantidad del resumen y del botón «Confirmar generación ({n} clases)» es `cantidad_incluida` |
| Confirmación (HU-C-25) `confirmaciones.clases.generar` | Título: «¿Estás seguro de que querés generar {n} clases de {materia} con {profesor}?» · detalle: «{x} con el aula cambiada · {y} fechas excluidas» (omitir lo que sea 0) · botón: «Generar clases» |
| Resumen final (banner de éxito, criterio 8) | «Se generaron {n} clases correctamente.» + «En {x} se cambió el aula.» + «Se excluyeron {y} fechas.» (singular y plural; una línea con 0 se omite o dice «En ninguna se cambió el aula.»: Claude Code propone y queda fijado en el test) |
| 409 al confirmar | Reutilizar «La disponibilidad cambió desde la vista previa…» (clave existente) |

Las dos claves que se dejan de usar se tratan según 0.4 R5.

---

## 5. Frontend (`turno-recurrente.tsx`, misma página `/turnos/nuevo`, modo «Generar varias clases»)

Referencia visual: las dos imágenes del prototipo. Donde chocan con esta task, manda la task (§1.3). Se respetan los tokens de `docs/DESIGN.md` (sin hex ni la paleta por defecto de Tailwind) y los patrones de badge y banner que ya usa la tabla.

### 5.1. Estado

- **Datos del formulario** (como hoy) → `payload` base y su `clave`.
- **Listas de la corrida:** `aulasPorFecha: Map<fecha, aulaId>` y `fechasExcluidas: Set<fecha>`. Se vacían cuando cambia cualquier dato del formulario (D9), en el mismo lugar donde hoy se invalida la vista previa.
- **Vista previa vigente:** guarda la clave de **base + listas** con la que se pidió. «Confirmar generación» solo se habilita si esa clave coincide con el estado actual, `cantidad_incluida > 0`, `hay_conflictos === false` y no hay pedido en curso.
- **Un solo pedido a la vez:** mientras se pide una vista previa o se confirma, se deshabilitan las acciones por fila, «Resolver todas» y el formulario (mecanismo `solicitudRef` actual). Se descarta una respuesta vieja si la clave cambió mientras volvía (patrón `claveActualRef` actual, extendido a las listas).

### 5.2. Recalcular siempre en el servidor (D8)

Cada acción por fila modifica las listas y **pide de inmediato** una vista previa nueva con `aulas_por_fecha` y `fechas_excluidas`. No invalida y espera, porque el usuario ya está en la vista previa. Si el pedido falla (red o 4xx), se **revierte** el cambio de listas, se conserva la vista previa anterior y se muestra el error. Después de cada respuesta exitosa, `aulasPorFecha` se **reconstruye desde la respuesta**: toda fecha no excluida con `aula_cambiada: true` → su `aula.id`. Así el estado del cliente nunca diverge de lo que el servidor validó.

### 5.3. Fila por situación

| Situación (de la respuesta) | Columna Aula | Disponibilidad | Acciones |
|---|---|---|---|
| Incluida, OK, aula por defecto | aula por defecto | «Libre» | «Excluir esta fecha» |
| Incluida, OK, `aula_cambiada` | aula nueva | «Libre · {aula} (cambiada)» y, si `cupo ≠ cupo_aula_por_defecto`, «cupo {cupo} en lugar de {cupo_aula_por_defecto}» | «Deshacer» · «Excluir esta fecha» |
| `AULA_OCUPADA`, no `solo_excluible`, hay aulas libres | aula de esa fecha | «Aula ocupada» | «Cambiar aula» · «Excluir esta fecha» (+ «Deshacer» si `aula_cambiada`) |
| `AULA_OCUPADA`, `sin_aulas_libres` | aula de esa fecha | «Aula ocupada» + «Sin aulas libres en este horario» | «Excluir esta fecha» (+ «Deshacer» si `aula_cambiada`) |
| `solo_excluible` (con o sin aula ocupada) | aula de esa fecha | un badge por motivo: «Aula ocupada», «Profesor con otra clase» (sin repetir si vienen `PROFESOR_OCUPADO` y `TURNO_EXISTENTE`, que comparten texto) | **solo** «Excluir esta fecha» (D1) |
| `excluida` | aula que tendría, atenuada | «Excluida» | «Incluir de nuevo» |

- «Excluir esta fecha» se deshabilita en la única fecha incluida que queda, con el motivo visible o accesible (D6).
- Las acciones son botones de texto (`variant="link"` o el estilo de acción secundaria que ya use el proyecto), no íconos solos. Cada uno tiene un nombre accesible que incluye la fecha (por ejemplo, `aria-label` «Excluir la fecha jueves 08/10»).
- Fondo de fila: el actual para conflicto (`bg-warning/20`); `bg-card` para libre; atenuado (`opacity` o `text-muted-foreground`) para excluida.

### 5.4. «Cambiar aula» (criterio 2)

- Al tocarlo, la misma fila despliega en línea un selector (no un modal): `GET /api/turnos/generacion/aulas-libres` con la fecha, la hora de inicio y la duración de la corrida. Estados: cargando, error con «Reintentar», lista.
- Opciones con el formato «{aula} · capacidad {n}», en el orden que devuelve el servidor. Más «Cancelar», que cierra sin cambios.
- Si la lista llega vacía (se ocupó todo mientras tanto), se cierra el selector y se pide una vista previa nueva, que mostrará «Sin aulas libres en este horario».
- Al elegir: `aulasPorFecha.set(fecha, aulaId)` → vista previa nueva (5.2). La fila pasa a «Libre · {aula} (cambiada)» y las demás fechas no cambian.
- Un solo selector abierto a la vez.

### 5.5. «Resolver todas» (criterio 3; separable, §1.4)

- Se muestra arriba de la tabla, con su texto de ayuda, solo si hay al menos una fecha incluida con `AULA_OCUPADA`, `solo_excluible === false` y sin aula elegida en `aulas_por_fecha` (en el prototipo desaparece cuando ya no quedan).
- Pide la vista previa con las listas actuales + `resolver_automaticamente: true`. Reconstruye `aulasPorFecha` desde la respuesta (5.2).
- **Banner de resultado** (`role="status"`, arriba de la tabla, **no toast**, D3): con `m` = candidatas antes del pedido y `r` = candidatas que pasaron a OK con aula cambiada, muestra la variante «todas» (`r = m`), «algunas» (`0 < r < m`) o «ninguna» (`r = 0`). El banner desaparece con la siguiente acción.
- La vista previa que vuelve es una vista previa normal: la clave vigente queda con las listas derivadas, así que se puede confirmar sin pedir otra.

### 5.6. Confirmación y resumen (criterios 7 y 8, D12)

- «Confirmar generación ({cantidad_incluida} clases)» abre `ConfirmarAccionDialog` con el título y el detalle de 4.7. No es `irreversible` (una clase generada se cancela con HU-C-05).
- `onConfirmar` hace `POST /api/turnos/generacion` con la base + `aulas_por_fecha` + `fechas_excluidas` de la vista previa vigente (omitidas si están vacías), nunca `resolver_automaticamente`, con `fetchAutenticado` (0.5). Un 409 `GENERACION_CON_CONFLICTOS` **no** se muestra como error del modal: `onConfirmar` resuelve sin lanzar, el diálogo se cierra y `onExito` sigue con 5.7. Cualquier otro rechazo lanza `Error(message)` y se ve dentro del modal.
- Éxito: el panel de resultado actual (banner inline, `role="status"`) con el resumen final de 4.7 (clases generadas, con aula cambiada, fechas excluidas) y el enlace «Ver clases». No hay toast.

### 5.7. 409 al confirmar (D11)

Se reemplaza la tabla de solo lectura de «conflictos recalculados». Se muestra el aviso existente «La disponibilidad cambió desde la vista previa…», se **pide automáticamente una vista previa nueva con las mismas listas** y se muestra con todas sus acciones. Si el aula que se había elegido para una fecha se ocupó, esa fila aparece como «Aula ocupada» con «Cambiar aula» y «Deshacer». El usuario resuelve ahí sin reiniciar el formulario.

### 5.8. Lo que no cambia en la pantalla

Formulario, orden de los campos, límites, resumen superior («8 fechas · jueves 15:00–16:00 · Aula 3 · …», ahora con las excluidas), estados de carga y error de franjas y aulas, alternancia con «Clase individual», `useDirtyState`, enlace «Ver clases». La tabla sigue teniendo las columnas Fecha · Horario · Aula · Disponibilidad. En móvil se conserva el `overflow-x-auto` actual y las acciones caen debajo del badge.

**Fuera de alcance de frontend:** nombre de la clase que ocupa el aula (D2) y toast (D3).

---

## 6. Testing (tres niveles + frontend)

### Nivel 1 — Unitarios (Vitest)

- **Schema:** pedido de Sprint 2 sin campos nuevos válido en las dos rutas; listas válidas; fecha repetida en cada lista; fecha en las dos listas; `resolver_automaticamente` aceptado en la vista previa y rechazado en la confirmación; `aula_id` inválido dentro de `aulas_por_fecha`.
- **Cálculo puro:** orden de candidatas (capacidad ≥ la por defecto, menor primero, empate por nombre y después por id); una más chica nunca se elige en «Resolver todas»; `solo_excluible` para cada combinación de motivos.
- **Servicio (con mocks, como `turno.generacion.service.test.ts`):** compatibilidad (pedido sin campos nuevos → misma respuesta de Sprint 2 en los campos de Sprint 2); fecha ajena al rango → `VALIDATION_ERROR`; aula de fecha igual a la por defecto → `VALIDATION_ERROR`; aula de fecha inexistente → `AULA_NO_ENCONTRADA`; inactiva → `AULA_INACTIVA`; excluida sin consultas de disponibilidad; todas excluidas → `SIN_FECHAS_EN_RANGO`; cupo por aula y `cupo_aula_por_defecto`; aula cambiada que está ocupada → `AULA_OCUPADA` con `aula_cambiada: true`; `sin_aulas_libres` solo con aula ocupada no excluible; «Resolver todas» resuelve, saltea `solo_excluible`, saltea las fechas con aula en `aulas_por_fecha`, saltea las excluidas y deja en conflicto las que no puede resolver; resumen (`cantidad`, `cantidad_incluida`, `con_aula_cambiada`, `excluidas`, `hay_conflictos` solo sobre incluidas).
- **Confirmación (con mocks):** aula y cupo por clase; excluidas no creadas; conteos del 201; eventos `turno:aula_asignada` y `turno:disponibilizado` con el aula y el cupo de cada clase; eventos emitidos después del commit (spy), no dentro de la transacción.
- **Ruta GET:** query inválida (400), sin permiso (403), lista ordenada y lista vacía (200).
- **Rutas POST:** `VALIDATION_ERROR` del servicio → 400 con `detalles` en las dos rutas; el resto del mapeo, sin cambios.

### Nivel 2 — Postman (`docs/testing/Modulo C/hu-c-21/HU-C-21.postman_collection.json`)

- `GET aulas-libres` → 200 con aulas ordenadas; con un horario sin aulas libres → 200 `[]`; query inválida → 400; sin permiso → 403.
- Vista previa sin campos nuevos → 200 con la forma de Sprint 2 + los campos nuevos.
- Vista previa con `aulas_por_fecha` y `fechas_excluidas` → 200, filas cambiadas y excluidas y resumen correcto.
- Vista previa con `resolver_automaticamente: true` → 200 con fechas resueltas y no resueltas.
- Confirmación con aula por fecha y exclusiones → 201 con `aulas_cambiadas` y `fechas_excluidas`.
- Confirmación con `resolver_automaticamente` → 400; con fecha ajena → 400; con aula de fecha igual a la por defecto → 400; con un aula elegida ocupada → 409 `GENERACION_CON_CONFLICTOS` y ninguna clase creada.

### Nivel 3 — PostgreSQL real (`turno.generacion.pg.test.ts` + `HU-C-21.sql`)

1. Cada clase generada tiene el `aulaId` y el `cupoMaximoTurno` de **su** aula. Todas `DISPONIBLE`, 0 alumnos y el mismo `generacion_id` en `turno:configurado`.
2. Las fechas excluidas no tienen ninguna fila de `turno` ni de `reservas_turno`.
3. `reservas_turno` tiene la reserva de aula con el aula de cada fecha y la del profesor en todas.
4. `eventos_turno`: `turno:aula_asignada` y `turno:disponibilizado` con el aula y el cupo de cada clase.
5. Un conflicto en un aula elegida al confirmar no inserta nada (todo o nada sobre las incluidas).
6. Carrera real: otra clase ocupa el aula elegida de una fecha entre la vista previa y la confirmación → `23P01` traducido a 409, sin filas nuevas.
7. Los tests PostgreSQL existentes de HU-C-17 siguen pasando sin cambios (compatibilidad).

### Frontend (Testing Library, `turno-recurrente.test.tsx` o el archivo del componente nuevo)

«Cambiar aula» solo en fechas con aula ocupada no excluibles; selector con estados y orden; elegir un aula marca «Libre · X (cambiada)» y las demás filas no cambian; «cupo X en lugar de Y» solo si difiere; «Deshacer»; «Excluir esta fecha» en filas libres y con conflicto; «Excluida» e «Incluir de nuevo»; la última fecha no se puede excluir; «Sin aulas libres en este horario» solo con «Excluir»; «Profesor con otra clase» solo con «Excluir»; banner nuevo y ausencia del aviso viejo; «Resolver todas» visible solo con candidatas y sus tres mensajes; cambiar un dato del formulario vacía las listas; respuesta vieja descartada; error de una acción revierte las listas; diálogo de confirmación con sus datos; resumen final con los tres números; 409 → vista previa nueva interactiva; ningún texto visible dice «turno» (`terminologia-clases.test.ts` y `claves-textos.test.ts` en verde).

### Verificación manual y evidencia

Recorrido en `noctium_dev` con un escenario equivalente al del prototipo: una materia y su profesor, franja de jueves, 1 h, un aula con algunas fechas ocupadas por otra clase y otras en las que el profesor ya tiene clase. Capturas: vista previa con conflictos, selector de «Cambiar aula», después de «Resolver todas» (banner), fila excluida, diálogo de confirmación, banner de éxito y vista móvil. Evidencia en `docs/testing/Modulo C/hu-c-21/HU-C-21-evidencia.md`, con la salida de la suite completa, `tsc --noEmit`, lint y build.

---

## 7. Fases de implementación y Definition of Done

**Fases** (cada una con sus tests verdes antes de pasar a la siguiente):
1. Schema + validaciones + mapeo de rutas (sin cambio de comportamiento para un pedido de Sprint 2).
2. Cálculo: aula por fecha, exclusión, cupo, `solo_excluible`, ruta GET de aulas libres y `sin_aulas_libres`.
3. Confirmación: aula y cupo por clase, conteos, eventos por aula; PostgreSQL.
4. UI: filas y acciones, selector, exclusión, banners, confirmación de HU-C-25, resumen y 409.
5. «Resolver todas» (backend + botón + banner de resultado). Separable para el plan de recorte.
6. Evidencia y cierre documental en esta task.

**Definition of Done:**
- [ ] Relevamiento (§0, R1 a R7) presentado y confirmado antes de implementar.
- [ ] Pedido sin campos nuevos idéntico a Sprint 2; tests de HU-C-17 en verde con sus valores esperados de Sprint 2 intactos (solo los ajustes mecánicos de 0.5).
- [ ] Test PostgreSQL de equivalencia entre la lectura agrupada de aulas libres y `aulaConTurnoSuperpuesto`.
- [ ] Ruta GET de aulas libres con `turnos:crear`, solo lectura y sin tocar el Módulo K.
- [ ] Aula por fecha, exclusión, cupo por aula, `solo_excluible` y `sin_aulas_libres` según 4.2.
- [ ] «Resolver todas» según 4.3, separable (flag, función y botón propios).
- [ ] Confirmación todo o nada sobre las incluidas, con revalidación dentro de la transacción y defensa GiST; nunca resuelve por su cuenta.
- [ ] Respuesta `201` con `aulas_cambiadas` y `fechas_excluidas`; eventos con el aula y el cupo de cada clase, después del commit.
- [ ] `VALIDATION_ERROR` del servicio → 400 en las dos rutas; ningún otro status cambia.
- [ ] UI conforme a §5 y a las decisiones D1 a D12; banner (no toast); confirmación de HU-C-25; resumen del criterio 8.
- [ ] Textos en `src/lib/textos.ts` bajo `ui.clases.generacion.*` / `confirmaciones.clases.generar`; ninguno dice «turno»; `claves-textos.test.ts` en verde.
- [ ] Sin `DELETE` físico, sin cambios de `schema.prisma`, sin migraciones y sin `migrate reset` sobre base compartida.
- [ ] Tests de los tres niveles + frontend; `tsc --noEmit`, lint, build y suite completa en verde.
- [ ] Evidencia en `docs/testing/Modulo C/hu-c-21/`.
- [ ] Diff acotado a esta HU. La corrección de la cita en `spec_modulo_C.md` §2.9.1 queda como el único cambio de spec, separado del funcional.
- [ ] El PO da la HU por Terminada después del recorrido sobre la rama.
