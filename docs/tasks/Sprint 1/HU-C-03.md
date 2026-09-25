# TASK: HU-C-03 — Configurar turno (agregar cupo máximo)

**Módulo:** C (Turno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` (Revisión 2) sección 2.1 · reglas 3.1, 3.2, 3.7 · eventos sección 4 · changelog al inicio del documento
**RBAC:** `turnos:crear` ya existe y no se toca en esta task (la HU no agrega una acción nueva, solo un campo al payload existente) — **relevar antes de asumir:** confirmar contra `spec_modulo_A.md` / seed de `RolPermiso` que `turnos:crear` sigue siendo exclusivo de Mesa de Entrada, sin cambios de matriz.
**Schema:** requiere migración — agregar `cupoMaximoTurno Int` (NOT NULL) al modelo `Turno`, y reemplazar el enum `EstadoTurno` (`PENDIENTE | AGENDADO` → `PENDIENTE | DISPONIBLE | COMPLETO`). Ver Nota de alcance §1 sobre por qué esta task incluye el cambio de enum aunque HU-C-03 en sí solo pide el cupo.

**Estado: CERRADA e implementada tal como está documentada abajo — REABIERTA (24/09/2026) por el rediseño de cupo automático de la Revisión 3 de `spec_modulo_C.md` — REDISEÑO IMPLEMENTADO Y VERIFICADO (24-25/09/2026), ver §9. — REABIERTA NUEVAMENTE (24/09/2026) por la duración configurable de la Revisión 4 de `spec_modulo_C.md` — IMPLEMENTADA Y VERIFICADA EN NAVEGADOR (25/09/2026), ver §10 (relevamiento) y §11 (evidencia).**

> **Nota de reapertura (Revisión 3, 24/09/2026, histórica):** por pedido explícito del cliente, aprobado por el PO (ver `propuesta-cambio-cupo-aula.md`), el campo `cupo_maximo` se **elimina** del formulario y del contrato de esta HU — el cupo pasa a fijarse automáticamente al asignar aula (HU-C-15). Todo lo documentado en las secciones 0-8 de este archivo describe la implementación tal como se cerró y verificó originalmente (Revisión 2); sigue siendo válido como historial, pero el contrato vigente para esta HU es el de `spec_modulo_C.md` §2.1 (Revisión 3). **Esta reapertura ya está resuelta e implementada — ver §9 para la evidencia final**, que reemplaza el estado "no se toca todavía" con el que se escribió originalmente esta nota.

> **Nota de reapertura (Revisión 4, 24/09/2026 — implementada y verificada el 25/09/2026, ver §11):** por pedido explícito del cliente, informado y ampliado por el PO (ver `propuesta-cambio-duracion-turno.md`, aprobada 24/09/2026), la duración del turno deja de ser fija (`DURACION_ESTANDAR_TURNO_MIN`) y pasa a ser un campo obligatorio del formulario (`duracion_min`), elegido por Mesa de Entradas entre 1h/2h/3h (`DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]`), sin valor preseleccionado. `hora_fin` pasa a calcularse como `hora_inicio + duracion_min`. Contrato vigente: `spec_modulo_C.md` §2.1 (Revisión 4). **Esta reapertura ya está resuelta: el relevamiento previo está en §10 (confirmado por el Scrum Master, con R4-1 a R4-6 aprobadas sin cambios) y la evidencia de implementación y verificación en §11.**

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Los puntos marcados abajo como **"relevar antes de asumir"**.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

**Relevar antes de asumir — puntos concretos para esta task:**

1. **¿Se migra el enum `EstadoTurno` en esta task o en HU-C-15?** — **RESUELTO:** se migra en esta task, junto con el cupo (ver §8 para el detalle de lo que arrastró fuera de `src/server/turnos/`: calendario y seed).
2. **Confirmar si hay datos en la base de desarrollo que no se puedan perder.** — **RESUELTO:** no había nada cargado a mano; se aplicó `prisma migrate reset --force` con consentimiento explícito del Scrum Master.
3. **Nombre del campo Zod → columna:** `cupo_maximo` (input) → `cupoMaximoTurno` (columna) — **RESUELTO**, confirmado.

---

## 1. Nota de alcance

`spec_modulo_C.md` (Revisión 2) documenta el Módulo C completo con las 4 HU ya contractualizadas (C-03, C-04, C-15, C-01), pero se implementan en tasks separadas, en ese orden. Esta task cubre **exclusivamente** HU-C-03 (spec §2.1): el campo `cupo_maximo` en el alta/modificación de la configuración del turno. No implementa:

- **Carga de profesor y alumnos** (§2.2) — HU-C-04, próxima task.
- **Asignación de aula y la transición de estados en sí** (§2.3) — HU-C-15. Esta task deja el turno configurado y en `PENDIENTE`; nunca produce ni valida una transición a `DISPONIBLE`/`COMPLETO`.
- **Alta/baja individual de alumnos** (§2.5) — depende de que el turno ya esté `DISPONIBLE`/`COMPLETO`, imposible de alcanzar solo con esta task.
- **Cambios al listado** (§2.4, HU-C-01) — el campo `alumnos_inscriptos` sigue siendo responsabilidad de esa task; la etiqueta de texto del estado se adelantó acá (ver §8, "agregado fuera de lo acordado") porque dejarla en "Agendado" era incorrecto después del cambio de enum.

**Fuera de alcance de esta task (explícito):**
- Migrar la lógica de transición de estados (eso no existe todavía en ningún endpoint hasta HU-C-15) — esta task solo agrega el *valor* del enum al schema, no ningún flujo que lo asigne.
- Tocar `asignarParticipantesTurno()` más allá de lo estrictamente necesario para compilar con el enum nuevo (código de error y filtro de estado) — la firma con `alumno_ids[]` la reescribe HU-C-04.

---

## 2. Historia de Usuario

**Como** personal de mesa de entradas
**Necesito** configurar la fecha, hora, materia y cupo máximo de un turno
**Para** iniciar una reserva antes de asignar sus participantes y aula

**SP estimado:** 5

---

## 3. Alcance de esta task

Implementación backend + frontend conforme a `spec_modulo_C.md` §2.1 (Revisión 2). Incluyó:
- Migración de Prisma: `cupoMaximoTurno Int` en `Turno`, reemplazo del enum `EstadoTurno`.
- `ConfigurarTurnoSchema` (`src/server/turnos/turno.schema.ts`) con `cupo_maximo` (tope agregado, ver §8).
- `configurarTurno()` y `modificarConfiguracionTurno()` (`src/server/turnos/turno.service.ts`): persistencia/validación de `cupoMaximoTurno`, `CUPO_MENOR_A_INSCRIPTOS`.
- Renombre `TURNO_YA_AGENDADO` → `TURNO_YA_DISPONIBLE` en los 4 lugares donde aparecía (incluida la línea de `asignarParticipantesTurno` necesaria para compilar).
- Payload de `turno:configurado` con `cupo_maximo`.
- UI: campo "Cupo máximo" en `turno-configuracion.tsx`, con `DirtyStateContext`.
- Calendario, tipos y seed actualizados para compilar con el enum nuevo (confirmado en el relevamiento, ver decisión resuelta §0.1).

**Fuera de alcance de esta task** (no implementado): endpoints de `asignarParticipantesTurno` (más allá del ajuste de compilación), `asignarAulaTurno`, ni las rutas de alta/baja individual de alumno (§2.5).

---

## 4–6. Contrato Backend / Frontend / Testing

Sin cambios respecto al diseño original de la task (ver historial de versión anterior de este documento) — implementado tal cual estaba especificado. El detalle de lo efectivamente hecho y verificado está en §8.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar, incluidos los 3 puntos "relevar antes de asumir".
- [x] Migración aplicada: `cupoMaximoTurno` en `Turno`, enum `EstadoTurno` con los 3 valores nuevos, sin `AGENDADO` remanente en el schema. Verificado contra la base real (no solo el schema).
- [x] Service y Route Handler actualizados, sin lógica de negocio fuera de `turno.service.ts`. **Server Action: no aplica — `src/server/turnos/actions.ts` no existe en el proyecto (divergencia ya documentada en `spec_modulo_C.md`), el frontend llama al Route Handler directo.**
- [x] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos — verificado con curl.
- [x] `turno:configurado` emitido tras el `INSERT`, con `cupo_maximo` en el payload — verificado en `eventos_turno`.
- [x] Frontend: campo "Cupo máximo" funcional, con su estado de error siguiendo `docs/DESIGN.md` — **verificado en navegador por el Scrum Master el 24/09** (ver §8 para el detalle de los 5 puntos de verificación manual, todos confirmados).
- [x] Ningún `DELETE` físico en ningún punto del código.
- [x] Tests de los 3 niveles documentados con evidencia — Nivel 1 (unitarios, `turno.configuracion.test.ts`, 11 tests) y Nivel 3 (BD, enum y columnas verificadas) con evidencia; Nivel 2 se cubrió con curl en vez de Postman (equivalente, mismo contrato verificado), y con verificación manual en navegador para la superficie visual.
- [ ] PR con diff acotado exclusivamente a esta HU — **el diff incluye archivos fuera de Turno** (`calendario.service.ts` + test, `calendario.types.ts`, `evento-calendario.tsx`, `prisma/seed.ts`) como consecuencia directa y ya confirmada de migrar el enum compartido en esta task (ver §0.1) — no es scope creep, pero el PR debe explicar esa razón en su descripción para quien lo revise sin este contexto. **Pendiente: el commit lo hace el Scrum Master manualmente, no Claude Code.**

---

## 8. Evidencia de implementación (24/09/2026)

**Verificado por Claude Code (curl + revisión de código + tests automatizados), backend:**
- Los 4 puntos del checklist original de comandos pasan: `tsc --noEmit` (0 errores), `eslint src` (0 errores, 1 warning preexistente ajeno a esta HU), `build` con y sin `.env` (ambos OK), `vitest` turnos+calendario (33/33).
- Alta con `cupo_maximo` válido → `201`, `estado: "PENDIENTE"`, columnas y evento verificados en base.
- `cupo_maximo` ausente, `0`, `-1`, `2.5` → `400` con mensaje en el campo.
- `CUPO_MENOR_A_INSCRIPTOS`: cupo 1 con 2 inscriptos → `409`; cupo 2 con 2 inscriptos → `200`.
- Turno ya `DISPONIBLE`/`COMPLETO` → `409 TURNO_YA_DISPONIBLE` (código renombrado, no el viejo).
- Turno pendiente no aparece en el calendario (curl + test del filtro).

**Verificado en navegador por el Scrum Master (24/09/2026) — los 5 puntos que quedaban pendientes, todos confirmados:**
1. **Error inline del campo "Cupo máximo"** (`/turnos/nuevo`): probado con `0`, `0.5`, `-1` y vacío — mismo mensaje ("El cupo máximo debe ser un número entero mayor que cero"), en rojo, pegado al campo, sin perder los demás valores del formulario (Fecha, Hora, Materia se conservan entre intentos). Estado vacío no muestra error prematuro. Valor válido (`30`) habilita el botón con foco en `--ring`/`--brand-accent`, coherente con `DESIGN.md`.
2. **Mensaje de éxito:** confirmado en el flujo de modificación ("Configuración actualizada", banner verde con tokens `--success`/`--success-foreground`, links "Volver al listado"/"Ver detalle"). El de alta ("Turno configurado") ya estaba verificado por curl con el texto exacto.
3. **Precarga en `/turnos/[id]/configuracion`:** confirmado sobre el turno de prueba `cmuf2ihu10002uwgw56cod8cn` — el campo "Cupo máximo" cargó el valor persistido (`2`) junto con Fecha/Hora/Materia.
4. **Badge Disponible/Completo en el calendario** (`Calendario → Agenda por profesor`): confirmado — turnos `DISPONIBLE` y `COMPLETO` aparecen con etiquetas distintas y correctas, sin ningún turno `PENDIENTE` colado (regla de negocio 3.2 verificada visualmente).
5. **`DirtyStateContext` y Cancelar:** confirmado — la confirmación aparece al intentar salir con cambios sin guardar, y "Cancelar" no persiste el cambio ni pide confirmación (mismo patrón que `aula-form.tsx`).

**Agregado fuera de lo acordado en la task original (documentado, no silencioso):**
1. **Etiquetas de estado:** el listado, detalle y formulario de participantes mostraban "Agendado" para cualquier turno no pendiente — texto que quedó incorrecto tras el cambio de enum. Se agregó `ETIQUETA_ESTADO_TURNO` en `turno.types.ts`, usado en `turnos-listado.tsx` y `turno-detalle.tsx`; en `participantes-turno.tsx` solo se corrigió el texto del mensaje. **Nota:** el badge/columna de estado en el listado en sí sigue siendo responsabilidad de HU-C-01 — esto fue solo corregir un texto que, de quedar así, mostraría información falsa en producción. Confirmado visualmente en el listado y en la agenda por profesor.
2. **`cupo_maximo` en el detalle del turno** (`turno-detalle.tsx`): dato adicional en la ficha, sin relación con `alumnos_inscriptos` (que sigue siendo de HU-C-01).
3. **Tope de `2147483647`** en Zod y en el formulario, para evitar que un valor mayor rompa la columna `INTEGER` de Postgres con un `500`.

**Otros hallazgos operativos:**
- `prisma migrate dev --create-only` aplicó de paso una migración pendiente preexistente en el repo (`20260924020844_alumno_version`), no generada por esta task.
- El turno de prueba `cmuf2ihu10002uwgw56cod8cn` quedó con cupo `3` tras las pruebas manuales del Scrum Master (se guardó dos veces durante la verificación) — se borra con el próximo reset, no requiere limpieza manual.
- `participantes-turno.test.tsx` no corrió (falta `jsdom` en caché de `npx`, `vitest` no es dependencia del proyecto) — problema preexistente, ajeno a esta HU. Queda como deuda técnica a resolver en algún momento, no bloquea el cierre de esta task.

**Sin commit ni `git add`** — cambios en el working directory a la espera de que el Scrum Master revise y commitee manualmente.

---

## 9. Evidencia de la reapertura Revisión 3 (24-25/09/2026) — cupo automático

**Relevamiento previo con Claude Code** (H1-H5, D1-D9, todos resueltos con recomendación del Scrum Master antes de implementar) y **redacción completa de `spec_modulo_C.md` §2.1 (Revisión 3)** antes de tocar código, siguiendo la metodología SDD.

**Implementado:**
- `cupo_maximo` eliminado de `ConfigurarTurnoSchema` (`turno.schema.ts`) y del formulario `turno-configuracion.tsx`.
- `configurarTurno()` inserta `cupoMaximoTurno: null`; migración aditiva `20260924235924_turno_cupo_nullable` (`ALTER COLUMN "cupoMaximoTurno" DROP NOT NULL`), sin `migrate reset` (no rompía datos existentes).
- **Fusión de pantallas (decisión de UI, Scrum Master):** `/turnos/nuevo` y `/turnos/[id]/aula` se unificaron en una sola vista (`seccion-aula-turno.tsx`, nuevo) — la sección de aula se habilita recién al completar fecha/hora/materia, y muestra el cupo como texto de solo lectura ("Cupo máximo: N alumnos (capacidad del aula elegida; solo lectura)"), nunca un input. Se sigue llamando en dos pasos al backend (`POST /turnos` y luego `PATCH .../aula`), sin endpoint combinado nuevo.
- Ruta vieja `/turnos/[id]/aula` y sus archivos (`aula-turno.tsx`, `aula-turno.test.tsx`) eliminados (D3) — confirmado que responde `404` sin redirect.
- Seed realineado (D5): cupos de turnos confirmados ajustados a la capacidad real de su aula; se agregaron aulas "Sala individual" (capacidad 1) y "Sala grupal" (capacidad 3) para poder probar los casos límite.

**Verificado en navegador por el Scrum Master (24-25/09/2026), como parte de la verificación de los 10 puntos de aceptación del rediseño completo (detalle íntegro en `HU-C-15.md` §6.3, ya que el rediseño cruza las tres HU):**
1. `/turnos/nuevo` no muestra campo de cupo; la sección de aula está grisada hasta completar fecha/hora/materia — confirmado.
2. Al elegir un aula, aparece "Cupo máximo: 10 alumnos (capacidad del aula elegida; solo lectura)" como texto, no como input — confirmado.
3. Guardado sin aula: "Turno configurado · Sin aula asignada · Pendiente"; reintento y recarga no duplican el turno — confirmado.
4. Modificación de un turno pendiente sin aula: "Cupo" y "Aula" muestran "Sin asignar" en el detalle — confirmado.

**Sin regresiones** respecto a lo verificado en §8 (error inline, mensaje de éxito, `DirtyStateContext`) — el rediseño no tocó esa lógica, solo el campo de cupo y la fusión de pantallas.

**Sin commit ni `git add`** — cambios en el working directory, PR pendiente de armar (descripción a cargo del Scrum Master una vez que se decida el momento del commit, en conjunto con HU-C-04 y HU-C-15 ya que es un único PR cruzando las tres HU).

---

## 10. Relevamiento previo a implementación — Revisión 4 (duración configurable, EJECUTADO 25/09/2026 — CONFIRMADO POR EL SCRUM MASTER, R4-1 a R4-6 aprobadas sin cambios)

**Contrato de referencia actualizado:** `spec_modulo_C.md` §2.1 (Revisión 4) · nuevo parámetro `DURACIONES_PERMITIDAS_TURNO_MIN` · evento `turno:configurado` (payload ampliado) · propuesta aprobada: `propuesta-cambio-duracion-turno.md`.

**Relevamiento ejecutado por Claude Code contra el código real (25/09/2026).** El Scrum Master lo confirmó explícitamente, con las decisiones R4-1 a R4-6 aprobadas tal como se proponen abajo, antes de dar la orden de implementar (igual que en §0 y en el relevamiento de la Revisión 3, H1-H5/D1-D9 en HU-C-15.md). El texto que sigue se conserva tal como se redactó antes de implementar; la evidencia está en §11.

> **Nota:** `propuesta-cambio-duracion-turno.md` no está en el repositorio (se buscó en todo el árbol, sin contar `node_modules`/`.next`). Por eso no se pudo contrastar su sección 5. Este relevamiento toma como contrato `spec_modulo_C.md` §2.1 (Revisión 4).

### 10.1. Resolución de los 7 puntos

**1. ¿Dónde vive `DURACION_ESTANDAR_TURNO_MIN`? — HALLAZGO: no existe como constante en el código.**
El nombre `DURACION_ESTANDAR_TURNO_MIN` solo aparece en la spec y en esta task. En el código, la duración fija es una **fila de `ParametroSistema`** con la clave `duracion_turno_estandar_minutos` (valor sembrado `"60"`). Si falta la fila, el código usa 60. Todos los puntos que la leen o la consumen:

| # | Archivo | Uso |
|---|---|---|
| a | `src/server/turnos/turno.validaciones.ts:27,36` | `parametrosConfiguracionTurno()` lee la clave y la expone como `duracion_minutos`, con 60 si falta la fila |
| b | `src/server/turnos/turno.validaciones.ts:62,67` | `validarConfiguracionTurno()` calcula `fin = inicio + duracion_minutos`, valida el horario operativo con ese valor y devuelve `hora_fin` y `duracion_minutos` |
| c | `src/server/turnos/turno.service.ts:36` | `prepararConfiguracion()` persiste `duracionMinutosTurno: validacion.duracion_minutos`, tanto en el **alta como en la modificación** (ver punto 2) |
| d | `src/app/api/turnos/configuracion/route.ts:7-8` | `GET /api/turnos/configuracion` devuelve `parametros.duracion_minutos` al frontend |
| e | `src/app/(dashboard)/turnos/turno-configuracion.tsx:14` | tipo `Parametros.duracion_minutos` |
| f | `turno-configuracion.tsx:55` | `opcionesDeHora()`: la **última hora de inicio que se ofrece** es `cierre - duracion_minutos`, así que la lista de horas depende de la duración |
| g | `turno-configuracion.tsx:181` | cálculo en pantalla de "Hora de finalización" |
| h | `turno-configuracion.tsx:251` | texto de ayuda "Duración: {duracion_minutos} minutos" |
| i | `turno-configuracion.tsx:119` | en modo edición, `opcionesDeHora()` decide si la hora guardada sigue vigente (usa el mismo parámetro fijo) |
| j | `prisma/seed.ts:534` | siembra `duracion_turno_estandar_minutos: "60"` |

Dato histórico relevante: el modelo original (`20260921053305_init_sprint1`) tenía un enum `DuracionTurno` (`UNA_HORA | DOS_HORAS | TRES_HORAS`). Ese enum se convirtió a `duracionMinutosTurno INTEGER` en `20260921210000_sprint1_modelo_completo`. Es decir, la Revisión 4 vuelve al conjunto 1h/2h/3h del diseño original, pero ahora como entero.

**2. ¿`duracionMinutosTurno` se persiste o se recalcula? — Se persiste. En lectura no se recalcula en ningún punto. En escritura hay un caso a corregir.**
- **Lectura (sin cambios necesarios):** todos los consumidores leen la columna persistida y ninguno lee el parámetro. Son `presentar()` (`turno.service.ts:259,266`, listado/detalle de HU-C-01), `eventoBase()` (`calendario.service.ts:74,86`), `intervaloTurno()` (`turno.disponibilidad.ts:10-13`, usado por 2.2, 2.3, 2.5 y 2.6), `validarIntervalo()` (`turno.aula.service.ts:11-16`), `bloquearTurno()` (`turno.service.ts:196`) y el trigger (punto 3).
- **Escritura (caso a corregir):** `modificarConfiguracionTurno()` reutiliza `prepararConfiguracion()`, así que **cada modificación de un turno `PENDIENTE` pisa `duracionMinutosTurno` con el valor actual del parámetro**. Hoy no se nota porque el parámetro siempre vale 60. Con la Revisión 4 esto desaparece, porque el valor viene de `input.duracion_min`.
- **Frontend (recálculo al vuelo, se reemplaza):** `turno-configuracion.tsx` calcula "Hora de finalización" y la lista de horas válidas con el parámetro, no con el turno. En modo edición, un turno de 2h (por ejemplo `seed-turno-11`) muestra hoy un fin de +1h en el formulario. Ya es un bug de visualización, aunque menor.
- `turno.types.ts` ya incluye `duracion_minutos`, y `turno-detalle.tsx:31` ya muestra "Duración: N minutos" desde el dato persistido.

**3. Trigger real de `reservas_turno` — CONFIRMADO: la spec tenía razón, no hace falta tocar la migración.**
El código real de `20260924150000_turnos_reservas_recursos_v2/migration.sql` difiere de la forma conceptual que describe la spec §3.4, pero no en lo que importa acá. No hay una columna `rango_horario`: hay `"inicioReserva"`/`"finReserva"` (`timestamp(6)`), y la exclusión GiST se arma con `tsrange("inicioReserva", "finReserva", '[)')`. Ambos extremos salen de la duración **persistida del turno**:
- `sincronizar_reservas_turno()` (l. 31-32): `inicio := NEW."fechaTurno" + NEW."horaInicioTurno"; fin := inicio + NEW."duracionMinutosTurno" * interval '1 minute'`.
- `sincronizar_reserva_alumno()` (l. 66-69): la misma fórmula, con `turno."duracionMinutosTurno"`.
- El trigger se dispara con `UPDATE OF ... "duracionMinutosTurno" ...` (l. 48), así que un cambio de duración también re-proyectaría las reservas. En la práctica solo pasa con turnos `PENDIENTE`, que no tienen reservas, y la función no hace nada.
- Ninguna constante ni ningún supuesto de duración fija. `reservas_turno_intervalo_check` (`inicio < fin`) se cumple con 60, 120 y 180.
- Detalle menor de documentación, sin impacto: la spec §3.4 nombra `rango_horario`, `turno_id`, `tipo_recurso` y `recurso_id`, pero las columnas reales son `inicioReserva`/`finReserva`, `turnoId`, `tipoRecurso` y `recursoId`. Se puede corregir en la spec como nota de sincronización si el SM lo quiere.

**4. Posición del selector en el formulario fusionado — propuesta concreta en 10.3 (decisión R4-3).**
El único archivo de UI que cambia es `turno-configuracion.tsx`. `seccion-aula-turno.tsx` **no cambia**: se habilita con `configuracionValida`, que ya se calcula en el padre, así que basta con agregar `duracion_min` a esa condición. Solo cambia el texto de ayuda "Completá fecha, hora y materia…", ver R4-3. El layout actual del formulario es: texto de ayuda de parámetros → Fecha → Hora de inicio (select) → Hora de finalización (solo lectura) → Materia → sección Aula.

**5. ¿Hace falta migración? — NO.**
`duracionMinutosTurno` es `INTEGER NOT NULL`, **sin `DEFAULT` y sin `CHECK`** (se revisaron todas las migraciones: los únicos `CHECK` del proyecto relacionados con turnos están en `reservas_turno`). Admite 60, 120 y 180 sin cambios. El seed ya crea turnos de 1h, 2h y 3h (`seed.ts:587-599`, `duracionMinutosTurno: t.duracion * 60`), así que la base de desarrollo ya tiene datos válidos para las tres duraciones. Solo quedaría desactualizado el **comentario** de `schema.prisma:468-470` ("duración estándar del centro… cambiar el parámetro no altere…"). Cambiar un comentario no genera migración (ver R4-5).

**6. Consumidores fuera de Turno — ninguno lee el parámetro.**
Fuera de `src/server/turnos/` y de la ruta `/turnos`, solo el **Calendario** (`calendario.service.ts:74,86`) usa la duración, y lo hace leyendo la columna persistida (punto 2). Sus tests ya cubren duraciones de 120 y 180 (`calendario.service.test.ts:92,323`). No existe módulo de Indicadores/Dashboard en `src/server/` (los módulos son alumnos, aulas, calendario, materias, profesores, sesion, shared, turnos y usuarios). `obtenerParametrosHorarioOperativo()` (`src/server/shared/parametros.ts`, usado por Calendario y Profesores) **no lee** `duracion_turno_estandar_minutos`. La única referencia fuera de `src/` es `prisma/seed.ts:534`.

**7. Tests que asumen la duración fija — a actualizar (no solo agregar).**

| Test | Qué asume hoy | Qué hay que cambiar |
|---|---|---|
| `src/server/turnos/turno.configuracion.test.ts` | el mock de `validarConfiguracionTurno` devuelve `{ hora_fin: "11:00", duracion_minutos: 60 }`; `toEqual` exactos de la respuesta (l. 54) y del payload de `turno:configurado` (l. 59) sin `duracion_min`; los tests del schema (l. 41-49) validan un `base` sin `duracion_min` | agregar `duracion_min` a `input`/`base` y a los `toEqual`; tests nuevos del schema (falta, 90, `"120"` como string y 0 rechazados; 60/120/180 aceptados); la modificación con cambio de duración persiste el valor nuevo y agrega `"duracion_min"` a `campos_modificados` |
| `src/app/(dashboard)/turnos/turno-configuracion.test.tsx` | `CONFIGURACION.parametros.duracion_minutos: 60`; `completarConfiguracion()` no elige duración (con la Revisión 4 el submit quedaría deshabilitado y **fallarían casi todos los tests del archivo**); el body del POST se compara con `toEqual` exacto sin `duracion_min` (l. 103); la resta del texto de resultado `10:00–11:00` depende del fijo; al fixture `PENDIENTE` le falta `duracion_minutos` | parámetros con `duraciones_permitidas_minutos: [60, 120, 180]`; elegir la duración en `completarConfiguracion()`; body con `duracion_min: 60`; tests nuevos (ver 10.3) |
| — | No existe `turno.validaciones.test.ts`. La validación de horario operativo (`validarConfiguracionTurno`) **no tiene test unitario propio hoy**: siempre se mockea | archivo **nuevo** (R4-6), donde vive el caso exigido por la spec: turno de 2h/3h cerca de `HORA_CIERRE` |

Sin cambios, porque usan `duracionMinutosTurno: 60` solo como dato de fixture y no afirman la regla fija: `turno.profesor.test.ts`, `turno.participantes.test.ts` (su `otroTurno()` ya recibe la duración como parámetro), `turno.aula.test.ts`, `turno.inscripciones.test.ts`, `turno.listado.test.ts`, `turnos-listado.test.tsx` y `calendario.service.test.ts`. `turno.reservas.pg.test.ts` tampoco lo necesita, pero se propone **agregar** un caso (R4-6).

### 10.2. ¿Algo de lo que la spec da por "sin cambios" necesita tocarse? — No. Confirmado contra el código.

- **2.2 / 2.5 / 2.6:** usan `intervaloTurno()`, que suma `duracionMinutosTurno` persistido. `profesoresConTurnoSuperpuesto`, `aulaConTurnoSuperpuesto` y `alumnoConTurnoSuperpuesto` son genéricos respecto del ancho del intervalo. Sin cambios.
- **2.3:** `validarIntervalo()` (`turno.aula.service.ts:11-16`) exige `duración > 0` e `inicio + duración ≤ 1440`, sin suponer 60. `listarOpcionesAulaTurno()` no filtra por horario. Sin cambios.
- **2.4:** `presentar()` ya calcula `hora_fin` desde la columna y ya expone `duracion_minutos`. Sin cambios.
- **3.3:** `intervalosSeSuperponen()` es la fórmula semiabierta genérica. Sin cambios.
- **3.4:** ver punto 3. Sin cambios.
- **Consecuencia de comportamiento, no de código (para conocimiento del PO):** `estaDentroDeHorarioAtencion()` (Módulo D, `profesor.service.ts:633-670`) exige, por diseño documentado, que el turno caiga dentro de **un único** bloque de atención del profesor (dos bloques contiguos no se suman). Con turnos de 2h y 3h va a ser más frecuente que 2.6 devuelva la lista vacía ("No hay profesores disponibles para este horario") aunque el profesor atienda en bloques seguidos. Es el comportamiento contratado en `spec_modulo_D.md`, no un bug. No se toca en esta task.
- **Modificar un `PENDIENTE` que ya tiene aula y alargar su duración:** no se revalida el aula en 2.1. Es el mismo tratamiento que hoy tiene un cambio de hora, y 2.2 paso 5 revalida el aula al confirmar (`aulaConTurnoSuperpuesto`), con la GiST como respaldo. Sin cambios.

### 10.3. Propuesta de contrato (pendiente de OK — no implementado)

**Decisiones a confirmar por el Scrum Master:**

- **R4-1. Dónde vive `DURACIONES_PERMITIDAS_TURNO_MIN`.** *Recomendado:* una **constante en código**, `export const DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180] as const` en `turno.schema.ts`. Permite el `refine` estático de Zod tal como lo escribe la spec, y la propia spec dice que cambiar el conjunto exige una nueva aprobación del PO, así que no es un parámetro que se edite en caliente. El frontend recibe la lista por `GET /api/turnos/configuracion` (no importa código de `src/server`). *Alternativa:* una fila de `ParametroSistema` (`"60,120,180"`) con un schema-factory, como `construirRegistrarHorarioSchema`. Es más configurable, pero se aparta de la spec y agrega complejidad sin un requisito que la pida.
- **R4-2. La fila `duracion_turno_estandar_minutos`.** *Recomendado:* dejar de leerla en `parametrosConfiguracionTurno()` y **quitarla de `PARAMETROS` en `prisma/seed.ts`**, porque queda sin uso. El `upsert` del seed no borra filas, así que en las bases existentes queda huérfana e inofensiva. No se agrega una migración para borrarla.
- **R4-3. Posición del selector.** *Recomendado:* **Fecha → Duración → Hora de inicio → Hora de finalización (solo lectura) → Materia → Aula**. Motivo: la lista de horas de inicio depende de la duración (la última hora ofrecida es `cierre − duración`). Si la duración va antes, la lista siempre es exacta, y cambiar la duración cuando la hora elegida deja de entrar reutiliza tal cual el patrón que ya existe en `cambiarFecha()`: limpia la hora y muestra el aviso "La hora anterior ya no es válida para esta duración. Elegí otra." *Alternativa:* Hora → Duración, con las duraciones que no entran deshabilitadas. Funciona, pero agrega un segundo patrón de invalidación distinto al existente.
  - **Componente:** un grupo de radios nativo dentro de `turno-configuracion.tsx` (no hace falta un componente nuevo). Sería `<fieldset>` + `<legend className="text-sm font-medium">Duración *</legend>` + 3 × `<label><input type="radio" name="duracion_min" value="60|120|180" /> 1 hora / 2 horas / 3 horas</label>`, **ninguno marcado de entrada**, con `aria-invalid`/`aria-describedby` y el error en `text-destructive`, igual que los demás campos. Se usan las clases que ya se usan (`border-input`, `focus-visible:ring-ring`). `DESIGN.md` no define un control segmentado ni un `RadioGroup`, y `src/components/ui/` solo tiene `badge`, `button`, `input` y `label`, así que no se introduce un componente nuevo.
  - Sin duración elegida, la lista de horas se calcula con la duración mínima permitida (60), para no bloquear la Hora detrás de otro campo, y "Hora de finalización" muestra "—".
  - Texto de ayuda (l. 251): "Duración: N minutos" pasa a "Duraciones disponibles: 1, 2 o 3 horas". Texto de `seccion-aula-turno.tsx:35`: "Completá fecha, duración, hora y materia para elegir el aula." Es el único cambio en ese archivo.
- **R4-4. Nombres en las respuestas.** La spec usa `duracion_min` (input, respuesta 201 y payload), y `presentar()` ya expone `duracion_minutos` (HU-C-01). *Recomendado:* agregar `duracion_min` a las respuestas de `configurarTurno`/`modificarConfiguracionTurno` y al payload de `turno:configurado`, como dice la spec, y **no renombrar** `duracion_minutos` en `presentar()`, porque HU-C-01 está "sin cambios". La inconsistencia de nombres queda documentada, no corregida.
- **R4-5. Comentario de `schema.prisma:468-470`.** *Recomendado:* actualizarlo a "Duración elegida al configurar el turno (uno de DURACIONES_PERMITIDAS_TURNO_MIN, Revisión 4)". Es solo un comentario: no genera migración, pero es un archivo compartido.
- **R4-6. Tests nuevos en archivos nuevos o compartidos.** *Recomendado:* crear `turno.validaciones.test.ts`, que es donde vive el caso exigido por la spec (horario operativo con 2h/3h), y agregar un caso a `turno.reservas.pg.test.ts` con Postgres real: un turno confirmado de 2h (10:00–12:00) contra otro de 1h a las 11:00 con el mismo profesor → la GiST lo rechaza. Es evidencia de motor del punto 3 con duración distinta de 60.

**Backend:**

```typescript
// src/server/turnos/turno.schema.ts
export const DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180] as const;
export function esDuracionPermitida(valor: number) { return (DURACIONES_PERMITIDAS_TURNO_MIN as readonly number[]).includes(valor); }

export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida (HH:MM)"),
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  // Revisión 4: obligatorio, sin default. Número JSON (no se coerciona un string).
  duracion_min: z.number({ error: "Elegí la duración del turno" }).int().refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"),
});
```

Pasos del servicio (cambios puntuales, sin reescribir los archivos):
1. `turno.validaciones.ts` → `parametrosConfiguracionTurno()`: sacar la clave `duracion_turno_estandar_minutos` y `duracion_minutos`, y agregar `duraciones_permitidas_minutos: [...DURACIONES_PERMITIDAS_TURNO_MIN]`. Ajustar los índices `claves[n]` o pasar a leer por nombre de clave, que es más robusto al quitar la primera.
2. `turno.validaciones.ts` → `validarConfiguracionTurno(input)`: revalidar `esDuracionPermitida(input.duracion_min)` (defensa en profundidad, spec paso 4) → `ServiceError("DURACION_NO_PERMITIDA", "Elegí una duración válida (1, 2 o 3 horas)")`, que la ruta responde como `422` por la regla genérica existente. Después, `fin = inicio + input.duracion_min`. La validación `FUERA_DE_HORARIO_OPERATIVO` queda igual (spec paso 5). Devuelve `{ fecha, hora_fin, duracion_min }`.
3. `turno.service.ts` → `prepararConfiguracion()`: `duracionMinutosTurno: input.duracion_min`.
4. `configurarTurno()`: agregar `duracion_min` al payload de `turno:configurado` y a la respuesta.
5. `modificarConfiguracionTurno()`: agregar `duracionMinutosTurno: true` al `select` de `actual`, agregar `actual.duracionMinutosTurno !== input.duracion_min ? "duracion_min" : null` a `camposModificados`, y agregar `duracion_min` a la respuesta. El guard `TURNO_YA_DISPONIBLE` ya impide cambiar la duración de un turno no `PENDIENTE` (fuera de alcance según la spec).
6. Route Handlers (`api/turnos/route.ts`, `api/turnos/[id]/configuracion/route.ts`): **sin cambios**, porque ya pasan `parsed.data` y el `fieldErrors.duracion_min` de Zod llega al front por `detalles`.

**Frontend (`turno-configuracion.tsx`):**
- `Parametros`: `duracion_minutos` → `duraciones_permitidas_minutos: number[]`. `Campos` agrega `duracion_min: string` (`""` = sin elegir). `inicial` agrega `duracion_min: ""`.
- `opcionesDeHora(fecha, hoy, horaActual, parametros, duracion)`: `ultima = min(cierre − duracion, 1439 − duracion)`, con `duracion = Number(campos.duracion_min) || min(duraciones)`.
- `cambiarDuracion(valor)`: si la hora elegida deja de estar en las opciones, limpia la hora y muestra `avisoHora` (el mismo patrón que `cambiarFecha`).
- `configuracionValida` exige `campos.duracion_min`. `fin` usa la duración elegida. El body del POST/PATCH se arma como `{ ...campos, duracion_min: Number(campos.duracion_min) }`.
- Edición: precarga `duracion_min: String(actual.duracion_minutos)`. Si el valor persistido no está en la lista permitida (no ocurre con el seed actual), queda vacío con un aviso que pide elegir otra. `configuracionCambiada` ya compara todos los campos de `Campos`, así que un cambio solo de duración habilita "Guardar cambios" y dispara el PATCH.
- `campoError`: agregar `DURACION_NO_PERMITIDA: "duracion_min"`.

**Tests nuevos de frontend (`turno-configuracion.test.tsx`):** ninguna duración preseleccionada y el submit deshabilitado hasta elegir una; con 3h la última hora ofrecida es 17:00 (cierre 20:00); cambiar la duración de 1h a 3h con la hora 18:00 elegida limpia la hora y muestra el aviso; con 2h, "Hora de finalización" muestra 12:00 para las 10:00; en edición, el turno de 120 min precarga "2 horas" y un cambio solo de duración envía el PATCH con `duracion_min: 180`.

### 10.4. Archivos (nada creado ni modificado todavía, salvo este documento)

**A modificar dentro del Módulo Turno:**
1. `src/server/turnos/turno.schema.ts`: constante `DURACIONES_PERMITIDAS_TURNO_MIN`, `esDuracionPermitida` y el campo `duracion_min`.
2. `src/server/turnos/turno.validaciones.ts`: parámetros (sin la duración estándar y con la lista) y `validarConfiguracionTurno` con `input.duracion_min` más la revalidación.
3. `src/server/turnos/turno.service.ts`: `prepararConfiguracion`, `configurarTurno` y `modificarConfiguracionTurno` (pasos 3-5).
4. `src/server/turnos/turno.configuracion.test.ts`: actualizar y agregar (punto 7).
5. `src/app/(dashboard)/turnos/turno-configuracion.tsx`: selector y lógica dependiente (10.3).
6. `src/app/(dashboard)/turnos/seccion-aula-turno.tsx`: **solo** el texto de ayuda de la l. 35.
7. `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`: actualizar y agregar (punto 7 y 10.3).

**A crear (requiere OK, R4-6):**
8. `src/server/turnos/turno.validaciones.test.ts`: `validarConfiguracionTurno` con `prisma.parametroSistema` mockeado y la fecha fija. Casos: 18:00 con 1h y con 2h aceptados (el fin igual al cierre es válido, porque la validación usa `fin > cierre`); 18:00 con 3h y 18:30 con 2h → `FUERA_DE_HORARIO_OPERATIVO`; `hora_fin` correcta para 60/120/180; 90 → `DURACION_NO_PERMITIDA`.

**A modificar fuera de `src/server/turnos/` o en archivos compartidos (requiere confirmación explícita):**
9. `prisma/seed.ts`: quitar `duracion_turno_estandar_minutos` de `PARAMETROS` (R4-2). Los turnos de seed no cambian: ya usan 1h/2h/3h.
10. `prisma/schema.prisma`: solo el comentario de `duracionMinutosTurno` (R4-5). Sin migración.
11. `src/server/turnos/turno.reservas.pg.test.ts`: agregar un caso con 2h (R4-6). Está dentro de Turno, pero corre contra Postgres real.

**Sin cambios (confirmado):** `api/turnos/route.ts`, `api/turnos/[id]/configuracion/route.ts`, `api/turnos/configuracion/route.ts` (reenvía lo que devuelve `parametrosConfiguracionTurno()` sin tocarlo), `turno.aula.service.ts`, `turno.profesor.service.ts`, `turno.disponibilidad.ts`, `turno.reserva-error.ts`, `calendario.service.ts`, `turno.types.ts`, `turno-detalle.tsx`, `turnos-listado.tsx`, todas las migraciones y `profesor.service.ts`.

**Documentación a actualizar al cerrar la implementación (no antes):** `spec_modulo_C.md` (estado de 2.1 en "implementada", nota de sincronización de §3.4 sobre los nombres reales de columnas y, si se confirma R4-1, que el parámetro es una constante en código y no una fila de `ParametroSistema`) y la evidencia de esta task (§11).

**Alcance de esta reapertura (a confirmar/ajustar tras el relevamiento):**
- `ConfigurarTurnoSchema`: agregar `duracion_min` (obligatorio, sin default, uno de `DURACIONES_PERMITIDAS_TURNO_MIN`).
- `configurarTurno()` / `modificarConfiguracionTurno()`: calcular `hora_fin` a partir de `duracion_min`, persistir `duracionMinutosTurno`, revalidar horario operativo con el nuevo `hora_fin`.
- Nuevo parámetro `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]`, reemplaza a `DURACION_ESTANDAR_TURNO_MIN`.
- Payload de `turno:configurado`: agregar `duracion_min`.
- Frontend: selector de duración (3 opciones, sin preselección) en la pantalla fusionada de configuración.
- Testing: caso nuevo de horario operativo con turno de 2h/3h cerca de `HORA_CIERRE`; regresión de HU-C-01 y calendario con turnos de distinta duración.

**Fuera de alcance de esta reapertura (explícito, salvo que el relevamiento diga lo contrario):**
- Cualquier cambio a `intervalosSeSuperponen()`, a `reservas_turno` o a su migración — se esperan sin cambios (punto 3 del relevamiento debe confirmarlo, no asumirlo).
- Modificar la duración de un turno que ya no está `PENDIENTE`.
- Cambios a HU-C-04, HU-C-15, HU-C-01 más allá de verificación de regresión.

---

## 11. Evidencia de la reapertura Revisión 4 (25/09/2026) — duración configurable

**Relevamiento previo con Claude Code** (§10, los 7 puntos resueltos contra el código real) y decisiones R4-1 a R4-6 aprobadas por el Scrum Master sin cambios antes de implementar, siguiendo la metodología SDD.

**Implementado (coincide exactamente con §10.4, sin desvíos):**
- `turno.schema.ts`: constante `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]` (R4-1, en código y no como fila de `ParametroSistema`), `esDuracionPermitida()` y el campo `duracion_min` en `ConfigurarTurnoSchema` (número JSON, obligatorio, sin default).
- `turno.validaciones.ts`: `parametrosConfiguracionTurno()` deja de leer `duracion_turno_estandar_minutos` y expone `duraciones_permitidas_minutos`; los parámetros pasan a leerse por nombre de clave en vez de por índice. `validarConfiguracionTurno()` revalida la duración (`DURACION_NO_PERMITIDA`, defensa en profundidad) y calcula `fin = inicio + duracion_min`.
- `turno.service.ts`: se persiste `duracionMinutosTurno: input.duracion_min`; `duracion_min` se agrega a las respuestas de alta y modificación y al payload de `turno:configurado`; `"duracion_min"` se agrega a `campos_modificados` de `turno:configuracion_modificada`. `presentar()` sigue exponiendo `duracion_minutos` sin renombrar (R4-4): la inconsistencia de nombres queda documentada, no corregida.
- **Bug del punto 2 de §10.1 corregido:** `modificarConfiguracionTurno()` ya no pisa la duración de un turno `PENDIENTE` con el parámetro fijo de 60 al editar otro campo.
- `turno-configuracion.tsx`: grupo de radios "Duración *" (1 hora / 2 horas / 3 horas, ninguno marcado) entre Fecha y Hora de inicio (R4-3). La lista de horas de inicio depende de la duración elegida (o de la mínima si todavía no se eligió). Cambiar la duración limpia una hora que deja de entrar y muestra un aviso (mismo patrón que `cambiarFecha()`). "Hora de finalización" usa la duración elegida. Edición precarga la duración persistida. El texto de ayuda muestra "Duraciones disponibles: 1 hora, 2 horas, 3 horas".
- `seccion-aula-turno.tsx`: solo el texto de ayuda de la l. 35 ("Completá fecha, duración, hora y materia para elegir el aula.").
- `prisma/seed.ts`: se quitó `duracion_turno_estandar_minutos` de `PARAMETROS` (R4-2). El `upsert` no borra filas, así que en bases existentes la fila queda huérfana y sin uso.
- `prisma/schema.prisma`: solo el comentario de `duracionMinutosTurno` (R4-5). **Sin migración.**

**Verificado por Claude Code (checklist, tests automatizados, curl y SQL):**
- `npx tsc --noEmit`: 0 errores. `npx eslint src`: 0 errores, 0 warnings. `npm run build` con `.env` y **sin `.env`** (renombrado temporalmente y restaurado): ambos OK.
- Tests unitarios (Nivel 1): `turno.configuracion.test.ts` (22, de los cuales 14 nuevos), `turno-configuracion.test.tsx` (9, de los cuales 3 nuevos) y `turno.validaciones.test.ts` (7, archivo nuevo, R4-6): **38/38 en verde**. Suite completa `vitest run`: **348 passed, 0 failed** (sin regresiones). Incluye el test pedido por el Scrum Master: editar un turno `PENDIENTE` de 2h sin tocar la duración conserva 120, no la resetea a 60.
- Postgres real (`turno.reservas.pg.test.ts`, sobre una base temporal creada, migrada y borrada al terminar; `noctium_dev` no se tocó): **9/9 en verde**, incluido el caso nuevo de R4-6. La reserva de un turno de 2h es 10:00–12:00, un turno a las 11:00 con el mismo profesor queda rechazado por la exclusión GiST, y uno contiguo a las 12:00 se acepta. Confirma el punto 3 de §10.1 a nivel de motor.
- curl contra el dev server (Nivel 2), sesión de `mesa.entrada@noctium.local`:
  - `GET /api/turnos/configuracion` → `duraciones_permitidas_minutos: [60, 120, 180]`.
  - `POST /api/turnos` sin `duracion_min` → `400` "Elegí la duración del turno"; con `90` → `400` "Elegí una duración válida (1, 2 o 3 horas)".
  - 18:30 + 120 → `422 FUERA_DE_HORARIO_OPERATIVO`.
  - 10:00 + 120 → `201` con `hora_fin: "12:00"` y `duracion_min: 120`.
  - `PATCH` cambiando solo la fecha → la base conserva `duracionMinutosTurno = 120` (bug del punto 2 corregido). `PATCH` cambiando solo la duración a 180 → `hora_fin: "13:00"`, y el detalle también lo muestra.
- SQL sobre `eventos_turno` (Nivel 3): el payload de `turno:configurado` lleva `duracion_min: 120`; `campos_modificados` registró `["fecha"]` y después `["duracion_min"]`.

**Verificado en navegador por el Scrum Master (25/09/2026) — los 5 puntos, todos confirmados, sin hallazgos:**
1. **`/turnos/nuevo`:** sin duración preseleccionada; no se puede guardar sin elegir una. Con "3 horas", la última hora de inicio ofrecida es 17:00. Con la hora ya elegida (18:00), el recorte de opciones al cambiar la duración funciona como se especificó.
2. **"Hora de finalización"** se recalcula sola al cambiar la duración (probado 2h con 18:00 → 20:00, coincide con el horario operativo del banner).
3. **Edición del turno de prueba `cmughks9z0002uw2kua60x7um`** (02/10, 3h): carga "3 horas" marcado, 10:00 de inicio y 13:00 de fin, y el desplegable sigue ofreciendo horas hasta las 17:00.
4. **Radios de duración** visualmente consistentes con el resto del formulario, tanto en alta como en edición.
5. **Regresión de listado y calendario:** `/turnos` muestra correctamente los horarios de turnos de 2h y 3h, sin errores de renderizado. Calendario → Agenda por profesor (Rossi, Martín, 28/09) dibuja el bloque de 12:00–14:00 con el ancho correcto de 2 horas, no como un bloque de 1h.

**Otros hallazgos operativos:**
- El turno de prueba `cmughks9z0002uw2kua60x7um` (PENDIENTE, 02/10, 10:00–13:00, sin aula) quedó en `noctium_dev` por la verificación con curl y se usó en la verificación del modo edición. Se borra con el próximo reset y no requiere limpieza manual.
- La verificación en navegador se hizo en un `next dev` sin `--webpack` (Turbopack), levantado fuera de la sesión de Claude Code. Ninguno de los 5 puntos usa la ruta afectada por la limitación conocida de Turbopack (`DELETE .../alumnos/[alumnoId]`, ver `README.md`).
- Los tests de frontend emiten warnings preexistentes de `act(...)` en stderr, sin que ningún test falle. No son de esta HU.

**Sin commit ni `git add`:** los cambios quedan en el working directory a la espera de que el Scrum Master revise y commitee manualmente.