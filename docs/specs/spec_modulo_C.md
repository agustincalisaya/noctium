# Especificación Técnica — Módulo C (Turno)
## Noctium — Sprint 1 (Revisión 4)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker, extensión `btree_gist` prevista pero aún no migrada — ver nota en 3.4) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (Alumno) · `spec_modulo_D.md` (Profesor, fórmula de superposición §3.4) · `spec_modulo_K.md` (Aulas) · `schema.prisma` · `docs/tasks/Sprint 1/`

**HU contractualizadas en esta revisión:** HU-C-03 (Configurar turno — **implementada Revisión 3, reabierta en Revisión 4 por la duración configurable, implementada y verificada en navegador el 25/09/2026**, ver `docs/tasks/Sprint 1/HU-C-03.md`), HU-C-04 (Asignar profesor y alumnos / gestionar inscripciones — implementada Revisión 3, sin cambios en esta revisión, ver `docs/tasks/Sprint 1/HU-C-04.md`), HU-C-15 (Asignar aula — implementada/remediada Revisión 3, sin cambios en esta revisión, ver `docs/tasks/Sprint 1/HU-C-15.md`), HU-C-01 (Listar turnos) — Sprint 1.

**Cambio de flujo (Revisión 3, pedido explícito del cliente, aprobado por el PO — ver `propuesta-cambio-cupo-aula.md`):** el cupo máximo de un turno deja de ser un valor que Mesa de Entradas escribe a mano (HU-C-03) y pasa a fijarse automáticamente según la capacidad del aula elegida (HU-C-15). Esto invierte el orden de los últimos dos pasos del flujo: **Configurar turno → Asignar aula (fija el cupo) → Asignar profesor y alumnos (ahora el último paso, el que confirma el turno)**. Ver detalle completo en la sección 1 y en 2.1/2.2/2.3.

**Cambio de esta revisión (Revisión 4, pedido explícito del cliente vía PO, aprobado 24/09/2026 — ver `propuesta-cambio-duracion-turno.md`):** la duración de un turno deja de ser fija (`DURACION_ESTANDAR_TURNO_MIN`) y pasa a ser elegida por Mesa de Entradas al configurar el turno (HU-C-03, 2.1), entre tres valores permitidos: **1 hora, 2 horas o 3 horas**, sin valor preseleccionado. `hora_fin = hora_inicio + duracion_min`, donde `duracion_min` ya no es una constante sino un dato del formulario. El parámetro `DURACION_ESTANDAR_TURNO_MIN` se reemplaza por `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]`. Ver detalle completo en 2.1 y en la tabla de parámetros configurables al pie del documento. **Nota de sincronización (relevamiento Revisión 4, R4-1):** `DURACION_ESTANDAR_TURNO_MIN` nunca existió como constante en el código: la duración fija era la fila `duracion_turno_estandar_minutos` de `ParametroSistema`. Su reemplazo, `DURACIONES_PERMITIDAS_TURNO_MIN`, es una **constante en código** (`src/server/turnos/turno.schema.ts`), no una fila de `ParametroSistema`, porque cambiar el conjunto requiere una nueva aprobación del PO.

**✅ IMPLEMENTADA Y VERIFICADA EN NAVEGADOR (24-25/09/2026) — Revisión 3.** Relevamiento previo con Claude Code, implementación completa (backend + frontend + migración), los tres niveles de test en verde (296 unit + 8 Postgres real + curl + SQL), y verificación en navegador por el Scrum Master de los 10 puntos de la lista de aceptación — 9 confirmados en la primera pasada, 1 (alta/baja individual con `next dev` + Turbopack) resuelto como limitación conocida del entorno de desarrollo, no del código (funciona con `next dev --webpack` y en el build de producción; documentado en `README.md`). Esta sección refleja el contrato real tal como quedó implementado, no solo el diseño — los ajustes que el relevamiento y la implementación encontraron respecto al diseño original están marcados en cada sección afectada.

**✅ REVISIÓN 4 (duración configurable) — IMPLEMENTADA Y VERIFICADA EN NAVEGADOR (25/09/2026).** Relevamiento previo con Claude Code (`docs/tasks/Sprint 1/HU-C-03.md` §10, decisiones R4-1 a R4-6 aprobadas por el Scrum Master sin cambios), implementación sin migración de Prisma, tests en verde (348 unitarios + 9 contra Postgres real + curl + SQL) y verificación en navegador por el Scrum Master de los 5 puntos de aceptación, sin hallazgos. Evidencia completa: `HU-C-03.md` §11.

**Fuera de alcance de esta spec (explícito):**
- Cancelación de un turno, en cualquier estado (`PENDIENTE`, `DISPONIBLE` o `COMPLETO`).
- Modificación de fecha/hora de un turno que ya no está `PENDIENTE`.
- Reemplazo del aula de un turno `DISPONIBLE` o `COMPLETO` (el reemplazo de aula solo aplica mientras el turno es `PENDIENTE`, ver 2.3).
- Sugerencia automática de franjas disponibles: la fecha/hora se elige manualmente este sprint.
- Búsqueda avanzada / filtros combinados en el listado (HU-C-01 §7 lo excluye explícitamente).
- Quitar un alumno individual mientras el turno está `PENDIENTE` — mientras el turno no tiene aula, cualquier cambio en los alumnos se resuelve reemplazando el conjunto completo (2.2), no dando de baja uno solo (la baja individual, 2.5, solo existe a partir de `DISPONIBLE`/`COMPLETO`). Ver **DECISIÓN RESUELTA** al pie de 2.5.
- **Nuevo en Revisión 4:** duraciones de turno distintas a 60/120/180 min. Modificar la duración de un turno que ya no está `PENDIENTE` (mismo criterio que fecha/hora, ver arriba). Cualquier cambio a la fórmula de superposición (3.3) o al diseño de `reservas_turno` (3.4) — el mecanismo existente ya desnormaliza el rango horario por turno y no asume una duración uniforme, no se toca en esta revisión (confirmado en el relevamiento contra el trigger real y en Postgres real, ver nota en 3.4).

---

## ✅ DECISIÓN RESUELTA — Gap crítico de concurrencia (abierto en HU-C-03, resuelto en la implementación real de HU-C-15, ratificado por el Scrum Master el 24/09)

El relevamiento previo a HU-C-03 había confirmado que los *exclusion constraints* que proponía la sección 3.4 (Revisión 2) nunca se migraron. La implementación real de HU-C-15 no siguió esa propuesta: en vez de `EXCLUDE USING gist` directamente sobre `turnos` (que no puede cubrir el caso de superposición por alumno, ya que un turno ahora tiene varios), se construyó una tabla unificada `reservas_turno` — un registro por recurso reservado (profesor, aula o alumno) con el rango horario del turno desnormalizado, y una única exclusión GiST sobre esa tabla, mantenida por triggers. Cubre los tres tipos de recurso con un solo mecanismo.

Este diseño **reemplaza por completo** la propuesta de la sección 3.4 de esta spec (ver 3.4 actualizada abajo) y queda ratificado como el diseño definitivo de concurrencia del módulo. Detalle completo del relevamiento y la ratificación: `docs/tasks/Sprint 1/HU-C-15.md` §3.5 y §4 (hallazgo D8).

---

## ✅ DECISIÓN RESUELTA — Origen y alcance del pedido de duración configurable (Revisión 4, no relevar de nuevo)

Pedido explícito del cliente, informado y ampliado por el PO el 24/09/2026 (el pedido original hablaba de 1h/2h; el PO amplió a 1h/2h/3h antes de que se redactara esta revisión). Propuesta formal aprobada — ver `propuesta-cambio-duracion-turno.md`, sección 5. No requiere una segunda ronda de aprobación salvo que cambie el conjunto de valores permitidos.

---

## Changelog de esta revisión

| HU / sección | Estado previo (Revisión 1) | Acción (Revisión 2) |
|---|---|---|
| HU-C-03 | Sin campo de cupo; el turno no era grupal | Se agrega `cupoMaximoTurno` (obligatorio, entero > 0, tope `2147483647` — ver nota en 2.1) al formulario y al modelo `Turno`. **Implementada 24/09.** |
| HU-C-03 / HU-C-01 | Máquina de 2 estados (`PENDIENTE` → `AGENDADO`) | Máquina de 3 estados (`PENDIENTE` → `DISPONIBLE` ⇄ `COMPLETO`), con transición automática Disponible⇄Completo según inscripciones vs. cupo. Enum migrado en base real (`prisma migrate reset --force`, consentimiento del Scrum Master, 24/09) |
| HU-C-04 | Un turno tenía exactamente un alumno (comentario del schema: "en Sprint 1 se reemplazan todos los vínculos y se crea uno solo") | Turno grupal desde este sprint: uno o varios alumnos (N:M vía `TurnoAlumno`, ya presente en `schema.prisma` pero documentada como transitoria — deja de serlo) |
| HU-C-04 | `asignarParticipantesTurno()` recibía `alumno_id` único | Pasa a recibir `alumno_ids: string[]` (carga/reemplazo inicial, 2.2); se agrega una operación nueva de alta/baja individual (2.5). **Nota:** HU-C-03 solo ajustó el código de error y el filtro de estado de esta función para que compilara con el enum nuevo — la firma sigue siendo `alumno_id` único hasta que HU-C-04 la reescriba |
| HU-C-15 | La asignación de aula transicionaba a `AGENDADO` | Transiciona a `DISPONIBLE` o directamente a `COMPLETO` (si los alumnos ya asignados alcanzan el cupo en ese mismo momento) |
| HU-C-01 | Columna "Alumno" (nombre de una persona) | Columna "Alumnos inscriptos" como ocupación sobre cupo (`"3/5"`). **Nota:** HU-C-03 adelantó la corrección del texto de estado (antes decía "Agendado" para cualquier turno no pendiente) vía `ETIQUETA_ESTADO_TURNO` en `turno.types.ts`, y agregó `cupo_maximo` al detalle — el resto del listado (`alumnos_inscriptos`, badge) sigue siendo de esta HU |
| §3.4 (constraints) | `turno_alumno_sin_superposicion` sobre `Turno.alumno_id` + `WHERE (estado = 'AGENDADO')` en las tres constraints — **documentadas como implementadas, pero el relevamiento de HU-C-03 confirmó que nunca se migraron** (ver aviso arriba) | Se redefinen para `WHERE (estado IN ('DISPONIBLE', 'COMPLETO'))`; la de alumno no puede seguir viviendo en `Turno` (ya no hay columna `alumno_id`) — ver nota en 3.4. Migración real: pendiente, a resolver en HU-C-15 |
| §3 (nueva 3.7) | No existía | Guarda de concurrencia para el cupo, con dos patrones distintos según el caso (ver 3.7) |
| Rutas de servicio/actions | Esta spec (Revisión 1) documentaba `lib/services/turnos/turno.service.ts` y `app/(dashboard)/turnos/actions.ts` | **Nota de sincronización:** el código real vive en `src/server/turnos/turno.service.ts`, `turno.schema.ts`, `turno.validaciones.ts` (Regla N.° 11). El relevamiento de HU-C-03 confirmó además que **`src/server/turnos/actions.ts` nunca se creó** — el frontend llama directamente a los Route Handlers (`fetch` a `/api/turnos/...`), sin capa de Server Action intermedia. Se documenta como divergencia aceptada (no se crea un archivo sin uso solo para cumplir la spec) — todo endpoint de esta spec que mencione "Server Action equivalente" debe leerse como aspiracional/no implementado, salvo que una task futura decida agregarlo |
| — | El formulario de configuración de turno no integraba `DirtyStateContext` (sí lo usan Alumnos, Aulas, Materias, Profesores) | HU-C-03 lo agregó al formulario, alineado con el criterio 9 (Cancelar descarta sin perder los demás valores). Implementado sin confirmación al cancelar, mismo patrón que `aula-form.tsx` |
| Convenciones generales / `ETIQUETA_ESTADO_TURNO` | Documentado en Revisión 2 (primera versión) como ubicado en `src/types/turno.types.ts` | **Corrección (relevamiento HU-C-04, 24/09):** la ubicación real es `src/app/(dashboard)/turnos/turno.types.ts` (colocated con la ruta de Turno, no en `src/types/`). Se documenta acá donde realmente vive; sin cambios de código, solo corrección de la spec |
| Guard de vigencia (2.2/2.3) | Solo se exigía explícitamente para operaciones sobre un turno `PENDIENTE` | **Decisión A (relevamiento HU-C-04, 24/09):** se extiende también a las altas/bajas individuales de 2.5 (turnos `DISPONIBLE`/`COMPLETO`). Motivo: los turnos de seed 01–06 están `DISPONIBLE`/`COMPLETO` pero con fecha ya pasada (21–24/09); sin la guarda, se podría seguir modificando la inscripción de una clase que ya ocurrió. Ver 2.5 y "Convenciones generales" |
| `HU-C-04` | **Implementada y verificada en navegador (24/09).** Backend por curl+tests, frontend verificado con los 3 roles relevantes (Mesa de Entrada, Gerente). Ver `docs/tasks/Sprint 1/HU-C-04.md` §8 para el detalle completo, incluida una segunda ronda de correcciones (mensajes de éxito, detalle del turno, `DirtyStateContext`) | — |
| `DirtyStateContext` (fuera del Módulo C) | Solo `LogoutButton` chequeaba el contexto; la navegación por el menú, el logo y otros links salía sin avisar, en todos los formularios del proyecto que usan el contexto (no solo Turno) | **Corregido durante HU-C-04 (24/09), fuera del alcance formal de esta HU pero como fix transversal necesario:** `DirtyStateProvider` ahora centraliza el diálogo de confirmación y un nuevo `<LinkProtegido>` protege toda navegación que no sea el botón explícito "Cancelar" de cada formulario (que sigue sin confirmar, por decisión ya tomada en HU-C-03). Incluye `beforeunload` para recarga/cierre de pestaña. Limitación aceptada: el botón "atrás" del navegador no se puede interceptar en App Router. Archivos tocados fuera de Turno: `src/components/sesion/dirty-state-context.tsx`, `link-protegido.tsx` (nuevo), `proteger-cache-navegador.tsx`, `src/lib/salida-sin-confirmar.ts` (nuevo), `fetch-autenticado.ts`, `src/components/layout/SidebarNav.tsx`, y links de "Volver…" en Alumnos y Profesores |
| HU-C-15 | Implementada externamente (PR #66, "Emir1481", 24/09) sin relevamiento, sin task doc y sin revisión — incluida una reescritura unilateral de esta spec y de los criterios de aceptación | **Auditada y remediada retroactivamente (24-25/09).** Ver `docs/tasks/Sprint 1/HU-C-15.md` para el detalle completo de la auditoría (17 divergencias, D1-D21) y el plan de remediación. Esta Revisión 3 reconcilia la spec con lo que quedó implementado tras la remediación: servicio real en `turno.aula.service.ts` (no en `turno.service.ts`, corrige D2), consulta a Aulas vía servicios públicos en vez de `prisma.aula` directo (D9), eventos vía `emitirEventoTurno()` (D11), tres códigos de error separados en vez de uno genérico (D10), permiso agregado al seed además de la migración (D12), diseño de concurrencia `reservas_turno`+GiST ratificado como definitivo (D8, reemplaza 3.4) |
| HU-C-03 | `cupo_maximo` es un campo obligatorio del formulario de configuración, ingresado a mano | **Revisión 3 (pedido del cliente, aprobado por el PO):** se elimina el campo del formulario y del contrato de 2.1. El cupo pasa a fijarse automáticamente al asignar aula (2.3) |
| HU-C-15 | La asignación de aula valida que la capacidad del aula alcance un cupo ya cargado (`AULA_CAPACIDAD_INSUFICIENTE`) | **Revisión 3:** ya no hay cupo previo que validar — al asignar aula, `cupoMaximoTurno = capacidadAula` se fija automáticamente. Se agrega una validación nueva para el caso de reasignar aula con alumnos ya cargados: si la nueva aula tiene menos capacidad que los alumnos ya inscriptos, se rechaza (ver 2.3) |
| HU-C-04 | El selector de profesor muestra todos los activos asociados a la materia, sin filtrar por horario; el conflicto se informa recién al confirmar | **Revisión 3:** el selector filtra de entrada — solo lista profesores con disponibilidad registrada que cubre el horario del turno y sin conflicto de reserva. Nuevo endpoint `GET /api/turnos/profesores/opciones?turno_id=` (ver 2.6, nueva) |
| HU-C-04 | Es el paso 2 del flujo (después de configurar, antes de aula); no confirma el turno por sí solo | **Revisión 3:** pasa a ser el último paso — el que confirma el turno y dispara la transición a `Disponible`/`Completo`. Se agrega un resumen de solo lectura (fecha, hora, materia, aula, cupo, estado) arriba del formulario, mismo patrón que ya usaba la pantalla de aula |
| HU-C-15 | Es el último paso del flujo; confirma el turno | **Revisión 3:** pasa a ser el segundo paso (justo después de configurar); ya no confirma el turno, solo fija el aula y el cupo — la confirmación se mueve a HU-C-04 |
| Frontend, pantallas de HU-C-03 y HU-C-15 | Dos pantallas separadas (`/turnos/nuevo` y `/turnos/[id]/aula`), navegación en dos saltos | **Revisión 3 (decisión de UI, Scrum Master 24/09):** se fusionan en una sola pantalla — fecha/hora/materia arriba, la sección de aula se habilita al completar esos campos. Sigue habiendo dos llamadas al backend en secuencia (crear turno, luego asignar aula); no se crea un endpoint combinado nuevo |
| §3.4 (constraints) | Propuesta de `EXCLUDE USING gist` directamente sobre `turnos`, nunca migrada, con el caso de alumno sin resolver | **Reemplazada por el diseño real ratificado (D8):** tabla `reservas_turno` con exclusión GiST unificada para profesor/aula/alumno, mantenida por triggers. Ver el aviso al inicio del documento y la 3.4 actualizada |
| HU-C-01 | Criterio 3: "...asignar profesor y alumnos (HU-C-04) o asignar aula (HU-C-15)" | **Revisión 3:** el orden se invierte — "...asignar aula (HU-C-15) o asignar profesor y alumnos (HU-C-04)", según el nuevo orden del flujo |
| HU-C-03 / §2.1 (**Revisión 4**) | `hora_fin = hora_inicio + DURACION_ESTANDAR_TURNO_MIN` (constante fija, no editable) | Se agrega `duracion_min` (obligatorio, uno de `DURACIONES_PERMITIDAS_TURNO_MIN`, sin default) al `ConfigurarTurnoSchema`. `hora_fin = hora_inicio + duracion_min`. **Implementada y verificada en navegador (25/09/2026), ver `HU-C-03.md` §11.** |
| Parámetros configurables (**Revisión 4**) | `DURACION_ESTANDAR_TURNO_MIN` (en el código real, fila `duracion_turno_estandar_minutos` de `ParametroSistema`) | Se reemplaza por `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]`, **constante en código** en `turno.schema.ts` (R4-1). La fila de `ParametroSistema` deja de leerse y se quitó del seed (R4-2) — ver tabla al pie del documento |
| Modelo de referencia, `Turno.duracionMinutosTurno` (**Revisión 4**) | Columna existente en el modelo, pero siempre derivada del parámetro fijo. Además, `modificarConfiguracionTurno()` la pisaba con el parámetro en cada edición de un turno `PENDIENTE` (bug hallado en el relevamiento) | Pasa a persistir el valor elegido por Mesa de Entradas, también al modificar (bug corregido). Sin cambio de columna ni migración: `INTEGER NOT NULL`, sin `DEFAULT` ni `CHECK`. Solo se actualizó el comentario en `schema.prisma` |
| §2.1, validación de horario operativo (**Revisión 4**) | Se validaba `[hora_inicio, hora_fin)` contenido en `HORA_APERTURA`/`HORA_CIERRE`, con `hora_fin` siempre a una distancia fija de `hora_inicio` | Misma fórmula de validación, sin cambios — pero ahora `hora_fin` varía según `duracion_min`, por lo que una franja de 2h o 3h puede rechazarse cerca del cierre operativo donde una de 1h no se rechazaría. Se agrega como caso de prueba explícito (ver 2.1, Testing) |
| §2.1, modificación de turno `PENDIENTE` (**Revisión 4**) | No contemplaba modificar la duración (no existía como campo) | Mientras el turno sigue `PENDIENTE`, `duracion_min` puede modificarse igual que `fecha`/`hora_inicio`/`materia_id`, sujeto a las mismas validaciones de horario operativo y vigencia |
| Evento `turno:configurado` (sección 4, **Revisión 4**) | Payload: `turno_id, fecha, hora_inicio, hora_fin, materia_id, usuario_id` | Se agrega `duracion_min` al payload. Además, `turno:configuracion_modificada` incluye `"duracion_min"` en `campos_modificados` cuando cambia la duración |
| Nombres de campo de duración (**Revisión 4**, R4-4) | — | **Inconsistencia documentada, no corregida:** input, respuestas de 2.1 y eventos usan `duracion_min`; el presentador de 2.4 (`presentar()`, HU-C-01) sigue exponiendo `duracion_minutos`. No se renombró para no tocar HU-C-01 |
| §3.4 (**Revisión 4**, nota de sincronización) | La forma conceptual nombraba `rango_horario`, `turno_id`, `tipo_recurso` y `recurso_id` | Nombres reales de columnas en `reservas_turno`: `inicioReserva`/`finReserva` (`timestamp(6)`; el rango se arma en la exclusión como `tsrange("inicioReserva", "finReserva", '[)')`), `turnoId`, `tipoRecurso` y `recursoId`. Solo corrección de documentación, sin cambio de código — ver 3.4 |

**Decisión de equipo, a partir de definición del PO (no relevar de nuevo):** el valor de enum `AGENDADO` se **reemplaza** por `DISPONIBLE` y `COMPLETO` (no se agrega como un cuarto estado). Como el proyecto está en Sprint 1 sin datos productivos, la migración de Prisma se aplica vía reseteo del entorno de desarrollo (`prisma migrate reset`), no vía migración de datos con `ALTER TYPE`. **Aplicado 24/09** (`prisma migrate reset --force`, consentimiento explícito del Scrum Master documentado en la conversación de la task).

**DECISIÓN RESUELTA (HU-C-03, no relevar de nuevo):** el reemplazo del enum se aplicó en HU-C-03 (no se pospuso a HU-C-15), porque es una columna compartida y posponerlo solo trasladaba el mismo trabajo de compilación forzada. Esto obligó a tocar, en la misma task, archivos fuera de `src/server/turnos/`: `src/server/calendario/calendario.service.ts` (filtro `estadoTurno`, Regla de negocio 3.2 — un turno pendiente no aparece en calendarios), su test, `src/types/calendario.types.ts`, `src/components/shared/evento-calendario.tsx`, y `prisma/seed.ts` (turnos de seed quedaron con `cupoMaximoTurno` y distribuidos en los 3 estados: 1 pendiente, 6 disponibles, 4 completos, para poder verificarlos visualmente).

**DECISIÓN RESUELTA (HU-C-04, relevamiento 24/09, no relevar de nuevo):**
- **A — Guard de vigencia en 2.5:** `turnoSigueVigente()` se aplica también a `agregarAlumnoTurno()` y `quitarAlumnoTurno()`, con `409 TURNO_VENCIDO`. Ver detalle en 2.5 y en "Convenciones generales".
- **B — Quitar el último alumno de un turno `DISPONIBLE`:** permitido. El turno queda `DISPONIBLE` con `0/N` alumnos; la spec no lo prohíbe y un turno sin alumnos sigue siendo válido para recibir inscripciones.
- **C — Identificación del alumno en conflicto (criterio 8, `ALUMNO_NO_DISPONIBLE`):** el mensaje literal exigido por la HU ("El alumno ya tiene un turno agendado en ese horario") se mantiene sin cambios; el detalle `{ alumno_id }` viaja en el `ServiceError`, la ruta lo reenvía en la respuesta y la UI lo usa solo para marcar visualmente el chip del alumno correspondiente — sin violar la Regla N.° 3 (aislamiento de módulos), porque el detalle es un dato que Turno ya tiene (no se consulta a otro módulo para obtenerlo).
- **D — Prueba de concurrencia (guarda de cupo, §3.7):** se exige en dos niveles — (1) un test unitario con mocks que verifica el orden de ejecución (`FOR UPDATE` antes del conteo), y (2) una prueba real contra la base, con dos `POST /alumnos` simultáneos sobre un turno con 1 lugar libre, esperando un `200` y un `409 CUPO_INSUFICIENTE`.

---

## 1. Visión General

El Módulo C es el núcleo operativo del sistema: gestiona el ciclo de vida de un `Turno` desde su configuración inicial hasta quedar completamente reservado y, opcionalmente, completo de inscripciones. Es una **máquina de tres estados**:

**Orden del flujo (Revisión 3, sin cambios en Revisión 4):** Configurar turno → Asignar aula (fija el cupo automáticamente) → Asignar profesor y alumnos (confirma el turno). Ver nota de cambio de flujo al inicio del documento.

```
PENDIENTE ──(asignar aula, HU-C-15, 2.3 — fija cupoMaximoTurno = capacidad del aula)──▶ sigue PENDIENTE (aún sin profesor/alumnos)
PENDIENTE ──(asignar profesor + ≥1 alumno, con aula ya asignada, HU-C-04, 2.2)──▶ DISPONIBLE o COMPLETO
DISPONIBLE ──(una inscripción alcanza el cupo máximo, HU-C-04, 2.5)──▶ COMPLETO
COMPLETO ──(se libera un lugar, HU-C-04, 2.5)──▶ DISPONIBLE
```

No existe ningún camino de vuelta a `PENDIENTE` una vez que el turno tiene profesor y alumnos confirmados — esa parte de la máquina de estados sigue sin reversión, igual que en la Revisión 1. Lo que sí es reversible, y automático, es la alternancia `DISPONIBLE ⇄ COMPLETO` según la cantidad de alumnos inscriptos activos comparada contra `cupoMaximoTurno`.

**Regla central que atraviesa todo el módulo:** *un turno `PENDIENTE` no reserva ningún recurso.* Dos turnos `PENDIENTE` pueden compartir el mismo profesor, alumno o aula en el mismo horario sin que eso sea un conflicto — el conflicto solo existe entre turnos `DISPONIBLE` o `COMPLETO`. Esto se traduce técnicamente en que toda validación de disponibilidad (secciones 2.2, 2.3 y 2.5) consulta exclusivamente turnos con `estadoTurno IN ("DISPONIBLE", "COMPLETO")`. **La defensa de esta regla a nivel de motor de base de datos (sección 3.4) está descripta e implementada — ver 3.4.**

**Modelo de referencia** (`model Turno` en `schema.prisma`, migrado y verificado en base real): `idTurno`, `fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno` (**Revisión 4: persiste el valor elegido por Mesa de Entradas entre `DURACIONES_PERMITIDAS_TURNO_MIN`, no un parámetro fijo. La columna ya existía (`INTEGER NOT NULL`, sin `DEFAULT` ni `CHECK`): confirmado en el relevamiento, sin migración**), `materiaId` (NOT NULL), `profesorId` (nullable), `aulaId` (nullable), **`cupoMaximoTurno` (NOT NULL, entero > 0, tope `2147483647`)**, `estadoTurno` — `PENDIENTE` | `DISPONIBLE` | `COMPLETO`, `createdAtTurno`, `creadoPorUsuarioId`. Un turno tiene **a lo sumo** un profesor (FK simple `profesorId`) y **uno o varios** alumnos, hasta `cupoMaximoTurno`, vía la tabla intermedia `TurnoAlumno` (N:M) — a diferencia de la Revisión 1, esta relación deja de ser transitoria: es el modelo definitivo de Sprint 1 (el comentario del schema sobre "etapa futura" ya fue actualizado en la migración de HU-C-03).

**Servicios públicos consumidos de otros módulos** (Regla N.° 3 de aislamiento — este módulo nunca hace `SELECT`/`UPDATE` directo sobre tablas de Alumno, Profesor, Materia o Aula):
- `verificarMateriaActiva(materiaId)` — Módulo L.
- `verificarAlumnoActivo(alumnoId)`, `buscarAlumnosActivos(query)` — Módulo B.
- `listarProfesoresActivosPorMateria(materiaId)`, `profesorActivoDictaMateria(profesorId, materiaId)`, `estaDentroDeHorarioAtencion(profesorId, fecha, horaInicio, horaFin)` — Módulo D.
- `verificarAulaActiva(aulaId)`, `hayAulasActivas()`, `existeAula(aulaId)` — Módulo K (las dos últimas agregadas en la remediación de HU-C-15, D9, para no consultar `prisma.aula` directamente).

**Nota de trazabilidad (gap sin resolver, sin cambios respecto a Revisión 1):** `buscarAlumnosActivos()` (búsqueda parcial por nombre/apellido/DNI, ahora usada también para agregar alumnos de a uno vía 2.5) sigue sin estar contractualizada en `spec_modulo_B.md` (HU-B-04 la excluye explícitamente). Se documenta acá solo como contrato consumido, no se implementa su lógica dentro de este módulo. **Confirmado en relevamiento de HU-C-04 (24/09):** la función ya existe (`alumno.service.ts:113`) con una ruta `GET /api/turnos/participantes/alumnos?q=` (permiso `turnos:asignar_participantes`), y su comportamiento coincide exactamente con lo requerido: activación desde 2 caracteres, coincidencia parcial sobre columnas normalizadas de nombre (sin mayúsculas ni acentos), DNI por coincidencia parcial, respuesta `{ id, nombre, apellido, dni }`, máximo 10 resultados. No hace falta tocar el Módulo B para HU-C-04.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores persistidos de `Turno`, `Materia`, `Alumno`, `Profesor` y `Aula` son CUID según `schema.prisma`.
- **Ubicación de archivos (Regla N.° 11):** tipos de dominio en `src/types/turno.types.ts`; capa de servicios en `src/server/turnos/turno.service.ts` (con `turno.schema.ts` y `turno.validaciones.ts` como colaboradores del mismo módulo); Route Handlers en `app/api/turnos/**/route.ts` (no le aplica la Regla N.° 11, que solo rige tipos/actions/services). **Server Actions (`src/server/turnos/actions.ts`): no implementadas — ver nota de sincronización en el changelog.** El frontend de Turno llama directamente a los Route Handlers.
- Toda ruta requiere `withPermission("turnos:<accion>")` (Regla N.° 10): `turnos:crear` (configurar y modificar configuración), `turnos:asignar_participantes` (asignación inicial y alta/baja individual de alumnos, HU-C-04), `turnos:asignar_aula`, `turnos:leer` — todas exclusivas de Mesa de Entrada salvo `turnos:leer`, disponible también para Gerente y Profesor (este último acotado a sus propios turnos, ya implementado en `listarTurnos`/`obtenerTurno`). Confirmado en relevamiento de HU-C-03: la matriz no cambia. **Reconfirmado en relevamiento de HU-C-04 (24/09):** `turnos:asignar_participantes` sigue siendo exclusivo de Mesa de Entrada, sin cambios.
- **Guard de vigencia (reutilizado por 2.2, 2.3 y, desde HU-C-04, también por 2.5 — no reimplementado por separado):** toda operación sobre un turno `PENDIENTE` revalida que `fechaTurno + horaInicioTurno` siga siendo un momento futuro (`turnoSigueVigente()`, ya implementada en `turno.validaciones.ts`). Si ya pasó: `409 TURNO_VENCIDO`, exige corregir la configuración (2.1) antes de continuar. **Decisión A (relevamiento HU-C-04, 24/09):** aunque el texto original de esta guarda solo hablaba de operaciones sobre un turno `PENDIENTE`, se extiende también a `agregarAlumnoTurno()` y `quitarAlumnoTurno()` (2.5, turnos `DISPONIBLE`/`COMPLETO`) — motivada por el hallazgo concreto de que los turnos de seed 01–06 son `DISPONIBLE`/`COMPLETO` pero con fecha ya pasada (21–24/09): sin esta guarda, se podría seguir dando de alta o de baja alumnos en una clase que ya ocurrió. Responde con el mismo `409 TURNO_VENCIDO`.
- **Guard de estado no-pendiente (nuevo):** toda validación de disponibilidad (profesor, alumno, aula) contra "turnos ya reservados" filtra `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` en vez de `estadoTurno: "AGENDADO"`.
- **Etiquetas de texto del estado** (`ETIQUETA_ESTADO_TURNO`, agregado en HU-C-03; ubicación corregida en relevamiento de HU-C-04, 24/09: vive en `src/app/(dashboard)/turnos/turno.types.ts`, no en `src/types/turno.types.ts`): `PENDIENTE → "Pendiente"`, `DISPONIBLE → "Disponible"`, `COMPLETO → "Completo"`. Usado en `turnos-listado.tsx` y `turno-detalle.tsx`; el resto del diseño visual del listado (badge, columna `alumnos_inscriptos`) sigue siendo responsabilidad de HU-C-01.
- **Módulo compartido `turno.disponibilidad.ts` (nuevo, Revisión 3):** `src/server/turnos/turno.disponibilidad.ts` agrupa los helpers de superposición de horario (intervalo del turno, profesores y aula con turno superpuesto) que usan en común 2.2, 2.3 y 2.6. Se creó como módulo aparte, en vez de agregar las funciones a `turno.aula.service.ts` o a `turno.profesor.service.ts` directamente, para evitar un import circular: `turno.aula.service.ts` ya importa `emitirEventoTurno` desde `turno.service.ts`, y varios de estos helpers los necesitan ambos servicios.
- **Limitación conocida del entorno de desarrollo (Turbopack, Revisión 3):** con `next dev` (Turbopack, modo por defecto) la ruta `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (2.5) deja de registrarse una vez que existe la carpeta `api/turnos/profesores/` (2.6), y responde con la página 404 de Next en vez de ejecutar el handler — sin que el código esté roto: funciona correctamente con `next dev --webpack` y en el build de producción. Causa raíz no diagnosticada en profundidad (asumida como un bug de ruteo de Turbopack en modo desarrollo). Workaround documentado en `README.md` ("Puesta en marcha", paso 8): usar `npx next dev --webpack` para desarrollo local. No se modificó el contrato de rutas ni `package.json` para evitar este problema.
- **Nota de sincronización (HU-C-04, 24/09):** las rutas `PATCH .../participantes`, `POST .../alumnos` y `DELETE .../alumnos/[alumnoId]` no validan el `id` del turno en la URL contra el formato CUID (a diferencia del resto de la spec). Motivo: los turnos de seed usan ids no-CUID (`seed-turno-10`, etc.) y la validación los rechazaba con `400` antes de llegar al servicio, impidiendo probar el criterio 6 contra el seed. Un id inexistente ahora responde `404` desde el servicio, igual que `GET /api/turnos/[id]`. El `alumnoId` de la URL y el `alumno_id` del body sí se siguen validando como CUID. Si se decide endurecer esto en el futuro, debe aplicarse parejo en las 4 rutas de Turno que reciben el id por URL, no solo en estas 3.

---

### 2.1. Configurar turno (HU-C-03) — IMPLEMENTADA (Revisión 3), REABIERTA EN REVISIÓN 4, IMPLEMENTADA Y VERIFICADA (Revisión 4, 25/09/2026)

**Ruta (alta):** `POST /app/api/turnos/route.ts`
**Ruta (modificación, mientras `PENDIENTE`):** `PATCH /app/api/turnos/[id]/configuracion/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` → `configurarTurno()` / `modificarConfiguracionTurno()`
**Permiso requerido:** `turnos:crear`

**Estado de esta sección:** el contrato descripto a continuación (Revisión 4, con `duracion_min`) está **implementado y verificado en navegador (25/09/2026)**. Relevamiento previo en `docs/tasks/Sprint 1/HU-C-03.md` §10 (decisiones R4-1 a R4-6), evidencia en §11.

**Cambio de Revisión 3:** se elimina `cupo_maximo` del formulario y del contrato de esta HU. El cupo ya no se ingresa a mano — se fija automáticamente al asignar aula (2.3). `cupoMaximoTurno` en el modelo pasa a ser `NULL` hasta que se asigna un aula (columna deja de ser `NOT NULL` a nivel de constraint aplicativo; a nivel de base, ver nota de migración pendiente en el plan de implementación).

**Cambio de Revisión 4:** se agrega `duracion_min` al formulario y al contrato de esta HU. Mesa de Entradas elige la duración del turno entre los valores de `DURACIONES_PERMITIDAS_TURNO_MIN` (ver tabla de parámetros al pie), sin valor preseleccionado — la elección es obligatoria en cada turno nuevo. `hora_fin` deja de calcularse contra una constante fija y pasa a calcularse contra el valor elegido.

```typescript
// src/server/turnos/turno.schema.ts
export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,          // utilidad compartida, spec_modulo_B.md §2.1
  hora_inicio: horaSchema,                     // utilidad compartida, spec_modulo_D.md §2.4
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  // duracion_min: NUEVO en Revisión 4 — obligatorio, sin default, uno de DURACIONES_PERMITIDAS_TURNO_MIN
  // (constante en este mismo archivo, R4-1). Número JSON: un string como "120" se rechaza, no se coerciona.
  duracion_min: z.number({ error: "Elegí la duración del turno" })
    .int("Elegí una duración válida (1, 2 o 3 horas)")
    .refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"),
  // cupo_maximo: ELIMINADO en Revisión 3 — ver 2.3, se fija automáticamente al asignar aula.
});
export type ConfigurarTurnoInput = z.infer<typeof ConfigurarTurnoSchema>;
```

**Comportamiento esperado (`configurarTurno` / `modificarConfiguracionTurno`), sin cambios de fondo respecto a Revisión 3 salvo lo marcado:**
1. Verificar `materia_id` activa (`verificarMateriaActiva()`). Si no hay materias activas en el sistema, el frontend lo indica antes de mostrar el formulario ("No hay materias activas para configurar turnos"); si igualmente se envía una inactiva: `409 MATERIA_NO_DISPONIBLE`.
2. Validar que `fecha` no sea pasada; si `fecha` es hoy, `hora_inicio` debe ser posterior a la hora actual.
3. Validar día operativo del centro (`DIAS_OPERATIVOS`).
4. **Revisión 4:** validar `duracion_min` contra `DURACIONES_PERMITIDAS_TURNO_MIN` (ya cubierto por el schema Zod, pero se revalida en el servicio como defensa en profundidad, mismo criterio que el resto de la spec). Calcular `hora_fin = hora_inicio + duracion_min`. `hora_fin` nunca es editable directamente por el cliente — es siempre derivada de `hora_inicio` + `duracion_min`.
5. Validar `[hora_inicio, hora_fin)` completamente contenido en el horario operativo (`HORA_APERTURA`, `HORA_CIERRE`). **Revisión 4:** con `hora_fin` variable, esta validación puede rechazar una franja de 2h o 3h que una de 1h con el mismo `hora_inicio` no rechazaría — comportamiento esperado, no un caso especial nuevo a programar aparte.
6. Validar que `fecha` no supere `ANTICIPACION_MAXIMA_DIAS`.
7. **Alta:** insertar con `estadoTurno: "PENDIENTE"`, `profesorId: null`, `aulaId: null`, `cupoMaximoTurno: null` (Revisión 3 — antes recibido del formulario), **`duracionMinutosTurno: duracion_min`** (Revisión 4 — antes era siempre la constante fija), sin alumnos vinculados. Un turno `PENDIENTE` recién creado no aparece en ningún calendario y no reserva ningún recurso.
8. **Modificación** (solo si `estadoTurno === "PENDIENTE"`; si ya es `DISPONIBLE`/`COMPLETO`, `409 TURNO_YA_DISPONIBLE`): si cambia `materia_id` y el turno ya tiene `profesorId`, verificar que ese profesor siga asociado a la nueva materia (`profesorActivoDictaMateria`); si no, desasignarlo automáticamente e informar cuál dato debe reasignarse. **Revisión 3:** ya no existe `cupo_maximo` para modificar acá — el código `CUPO_MENOR_A_INSCRIPTOS` y el patrón de verificación de 3.7 para este caso quedan sin uso (el cupo ahora solo cambia al reasignar aula, ver 2.3). **Revisión 4:** si cambia `duracion_min` (con o sin cambio de `hora_inicio`), recalcular `hora_fin` y revalidar el horario operativo (paso 5) igual que en el alta — mismo tratamiento que un cambio de `hora_inicio`.
9. Emitir `turno:configurado` o `turno:configuracion_modificada` (sección 4), vía `emitirEventoTurno()` (`prisma.eventoTurno.create`), verificado en `eventos_turno`. **Revisión 3:** el payload de `turno:configurado` ya no lleva `cupo_maximo` (ver sección 4 actualizada). **Revisión 4:** el payload de `turno:configurado` agrega `duracion_min`.

**Respuesta `201 Created` (alta):**
```json
{ "data": { "id": "cuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "12:00", "duracion_min": 120, "cupo_maximo": null, "estado": "PENDIENTE" }, "error": null }
```

**Frontend (Revisión 3, sin cambios de layout en Revisión 4):** esta pantalla se fusiona con la de asignar aula (2.3) en una sola vista — ver nota de cambio de flujo al inicio del documento. La sección de aula se habilita recién cuando fecha/hora/materia están completos; al guardar, la pantalla encadena `POST /api/turnos` y luego `PATCH .../aula` (dos llamadas, sin endpoint combinado nuevo). **Revisión 4:** se agrega el selector de duración (tres opciones, sin preselección) junto a fecha/hora/materia, antes de la sección de aula. **Implementado (R4-3):** grupo de radios nativo "Duración *" entre Fecha y Hora de inicio, en `turno-configuracion.tsx` (sin componente nuevo). Las horas de inicio ofrecidas dependen de la duración elegida (la última es `cierre − duración`). Si cambiar la duración deja fuera la hora ya elegida, esa hora se limpia con un aviso, igual que al cambiar la fecha. La sección de aula se habilita recién con fecha, duración, hora y materia completas.

**A verificar cuando se implemente la Revisión 3 (ya verificado):** que el formulario ya no muestre el campo de cupo, que el mensaje de éxito ofrezca continuar con la asignación de aula (no con participantes), y que la modificación de un turno `PENDIENTE` sin aula todavía no muestre ningún dato de cupo.

**A verificar cuando se implemente la Revisión 4 (✅ verificado el 25/09/2026, todos los puntos: los de UI en navegador por el Scrum Master, los de backend/motor con tests, curl y SQL — ver `HU-C-03.md` §11):**
- Que el formulario exija elegir una de las tres duraciones antes de habilitar el envío (sin default).
- Que la validación de horario operativo rechace correctamente una franja de 2h/3h cerca de `HORA_CIERRE` que sí sería válida como turno de 1h — caso de prueba explícito.
- Que la modificación de un turno `PENDIENTE` permita cambiar `duracion_min` y recalcule `hora_fin` correctamente, revalidando horario operativo.
- Que `reservas_turno` (3.4) arme `rango_horario` a partir de `hora_inicio`/`hora_fin` reales del turno (no de una constante) — confirmar contra el trigger real, no asumir.
- Que el evento `turno:configurado` lleve `duracion_min` en el payload real, no solo en la spec.
- Que HU-C-01 (listado) y el calendario (`spec_modulo_J.md`) sigan funcionando sin cambios con turnos de distinta duración — verificación de regresión, no de funcionalidad nueva.

---

### 2.2. Asignar profesor y alumnos al turno — carga inicial y confirmación (HU-C-04) — IMPLEMENTADA, REABIERTA EN REVISIÓN 3, sin cambios en Revisión 4

Esta operación es el **combo inicial**: carga profesor + el conjunto completo de alumnos de una sola vez. **Cambio de Revisión 3: pasa a ser el último paso del flujo** (antes era el segundo; ahora requiere que el turno ya tenga aula asignada, ver 2.3) — es la operación que **confirma** el turno y dispara la transición a `Disponible`/`Completo` (antes esa transición ocurría al asignar aula). Para agregar o quitar un alumno de a uno una vez que el turno ya está confirmado, ver **2.5** (sin cambios).

**Ruta:** `PATCH /app/api/turnos/[id]/participantes/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` → `asignarParticipantesTurno()`

**Frontend (Revisión 3):** la pantalla agrega un resumen de solo lectura arriba del formulario, con fecha, hora, materia, **aula y cupo ya asignados** (2.3) y el badge de estado — mismo patrón que ya usaba la pantalla de aula en Revisión 2. El selector de profesor filtra por disponibilidad, ver 2.6 (nueva).

```typescript
export const AsignarParticipantesTurnoSchema = z.object({
  // CAMBIA: antes z.string().cuid() único, ahora arreglo (HU-C-04 criterio 1)
  alumno_ids: z.array(z.string().cuid())
    .min(1, "Agregá al menos un alumno")
    .refine((ids) => new Set(ids).size === ids.length, "El mismo alumno no puede agregarse dos veces"),
  profesor_id: z.string().cuid(),
});
export type AsignarParticipantesTurnoInput = z.infer<typeof AsignarParticipantesTurnoSchema>;
```

**Comportamiento esperado (dentro de la misma `prisma.$transaction` que ya usa `asignarParticipantesTurno`):**
1. Leer el `Turno`; debe existir y estar `PENDIENTE` (si ya `DISPONIBLE`/`COMPLETO`: `409 TURNO_YA_DISPONIBLE`). **Revisión 3, precondición nueva:** el turno debe tener `aula_id` ya asignado — si no, `409 TURNO_SIN_AULA`, "Asigná un aula antes de confirmar el turno" (sin aula no hay `cupoMaximoTurno` contra el cual validar). Aplicar el guard de vigencia (`turnoSigueVigente`). **Ajuste de implementación (Revisión 3):** dado que este paso ahora es el que confirma el turno, revalida también `MATERIA_NO_DISPONIBLE` (la materia sigue activa) y `AULA_INACTIVA` (el aula asignada en 2.3 sigue activa) — estas dos validaciones vivían únicamente en 2.1 y 2.3 respectivamente cuando la confirmación ocurría en la asignación de aula (Revisión 2); al mover la confirmación acá, se preservan ambas garantías revalidándolas también en este paso, por si algo cambió entre que se configuró/asignó aula y que se confirma.
2. Validar `alumno_ids.length <= turno.cupoMaximoTurno`. Si excede: `409 CUPO_INSUFICIENTE`, "El turno alcanzó su cupo máximo" (HU-C-04 criterio 5) — se informa sin persistir nada.
3. Verificar cada `alumno_id` activo (`verificarAlumnoActivo()`). Ante cualquier alumno inválido, se informa cuál.
4. Verificar `profesor_id` activo y asociado a `turno.materiaId` (`listarProfesoresActivosPorMateria()`). Si no hay ninguno: `404 SIN_PROFESORES_PARA_MATERIA`. **Revisión 3:** dado que el selector de frontend ya filtra por disponibilidad (2.6), llegar acá con un `profesor_id` fuera de horario o en conflicto solo pasa si el frontend está desactualizado respecto al momento de la carga — igual se revalida en el paso 5.
5. **Validación de disponibilidad (aplicativa, contra turnos `DISPONIBLE`/`COMPLETO` únicamente):**
   - Profesor: intervalo del turno contenido en su horario de atención (`estaDentroDeHorarioAtencion`), y sin superposición con otro turno `DISPONIBLE`/`COMPLETO` de ese profesor (fórmula de `spec_modulo_D.md` §3.4, ya implementada en `intervalosSeSuperponen`).
   - Cada alumno de `alumno_ids`: no debe tener otro turno `DISPONIBLE`/`COMPLETO` que se superponga con el mismo intervalo (HU-C-04 criterio 4). Si cualquiera falla, se identifica cuál.
   - Aula: revalidar que sigue disponible en ese horario (puede haber cambiado desde que se asignó en 2.3).
   - Si hay conflicto: `409`, identificando el recurso puntual. El turno conserva su estado y valores anteriores.
6. **Defensa final de concurrencia:** protegida por la exclusión GiST de `reservas_turno` (ver 3.4 actualizada) — a diferencia de Revisión 2, esta ya no es solo una validación de buena fe: el mecanismo de motor existe y está ratificado (D8).
7. `updateMany` del `profesorId` (`where: { idTurno: turnoId, estadoTurno: "PENDIENTE" }`, `count === 0` ⇒ `409 TURNO_MODIFICADO`), luego `deleteMany` de `TurnoAlumno` del turno y `createMany` con el nuevo conjunto de `alumno_ids`.
8. **Revisión 3 — evaluar la transición (antes vivía en 2.3):** con profesor, aula y `alumno_ids` ya confirmados, calcular `nuevoEstado = alumno_ids.length >= cupoMaximoTurno ? "COMPLETO" : "DISPONIBLE"` y `UPDATE turno SET estadoTurno = nuevoEstado WHERE idTurno = turnoId AND estadoTurno = "PENDIENTE"`. Este es ahora el único punto del flujo donde el turno sale de `PENDIENTE`.
9. Mientras el turno siga `PENDIENTE` (por ejemplo, si se guardó sin llegar a completar el combo), este mismo endpoint permite **reemplazar** el combo completo las veces que haga falta.
10. Emitir `turno:participantes_asignados` y, si hubo transición, `turno:disponibilizado` o `turno:completado` según `nuevoEstado`, ambos después del `COMMIT` — antes estos dos últimos se emitían desde 2.3.

**Nota Revisión 4:** la validación de disponibilidad del paso 5 (fórmula `intervalosSeSuperponen`) ya opera sobre el intervalo real `[hora_inicio, hora_fin)` del turno, sea cual sea su duración — no requiere cambios de código para soportar duraciones de 1h/2h/3h. **Confirmado en el relevamiento** (`HU-C-03.md` §10.2): `intervaloTurno()` suma el `duracionMinutosTurno` persistido. Sin cambios en esta sección. Consecuencia de comportamiento, no de código: como `estaDentroDeHorarioAtencion()` (Módulo D) exige un único bloque de atención, con turnos de 2h/3h es más frecuente que no haya profesor disponible.

**Respuesta `200 OK` (confirma el turno):**
```json
{ "data": { "id": "cuid", "alumno_ids": ["cuid1", "cuid2"], "profesor_id": "cuid", "cupo_maximo": 5, "estado": "DISPONIBLE" }, "error": null }
```

**Respuesta `409 Conflict` (sin aula asignada):**
```json
{ "data": null, "error": { "code": "TURNO_SIN_AULA", "message": "Asigná un aula antes de confirmar el turno" } }
```

**Respuesta `409 Conflict` (cupo insuficiente para el combo):**
```json
{ "data": null, "error": { "code": "CUPO_INSUFICIENTE", "message": "El turno alcanzó su cupo máximo" } }
```

---

### 2.3. Asignar aula al turno — fija el cupo automáticamente (HU-C-15) — REMEDIADA, REABIERTA EN REVISIÓN 3, sin cambios en Revisión 4

**Cambio de Revisión 3:** pasa a ser el **segundo paso** del flujo (antes era el último y confirmaba el turno; la confirmación se movió a 2.2). Ya no valida contra un cupo preexistente — **lo fija automáticamente** a partir de la capacidad del aula elegida.

**Ruta:** `PATCH /app/api/turnos/[id]/aula/route.ts`
**Ruta de opciones:** `GET /api/turnos/aula/opciones?turno_id=` — contractualizada en esta revisión (ya existía en la implementación real, no estaba documentada, D3). **Ajuste de implementación (H1, relevamiento Revisión 3):** `turno_id` pasa a ser **opcional** en esta ruta — la pantalla fusionada (2.1) necesita listar aulas *antes* de que exista el turno (en `/turnos/nuevo`, previo al primer `POST`). Sin `turno_id`: devuelve todas las aulas activas, sin filtrar por horario. Con `turno_id`: exige que el turno exista y esté `PENDIENTE`, y filtra por disponibilidad usando `max(1, alumnos.length)` como capacidad mínima requerida (relevante para el caso de reasignar aula con alumnos ya cargados, ver paso 3 más abajo).
**Servicio:** `src/server/turnos/turno.aula.service.ts` → `asignarAulaTurno()` / `listarOpcionesAulaTurno()` (corrige D2 — no vive en `turno.service.ts` como decía Revisión 2)
**Permiso requerido:** `turnos:asignar_aula`

```typescript
export const AsignarAulaTurnoSchema = z.object({
  aula_id: z.string().cuid(),
});
export type AsignarAulaTurnoInput = z.infer<typeof AsignarAulaTurnoSchema>;
```

**Comportamiento esperado, íntegramente dentro de una única `prisma.$transaction`:**
1. Leer el `Turno`; debe existir. Si ya es `DISPONIBLE`/`COMPLETO`: `409 TURNO_YA_DISPONIBLE`. Aplicar el guard de vigencia.
2. Verificar `aula_id` (remediación D9/D10 — tres casos, ya no uno genérico):
   - No hay ninguna aula activa en el sistema (`hayAulasActivas()`): `404 SIN_AULAS_ACTIVAS`.
   - El `aula_id` recibido no existe (`existeAula()`): `404 AULA_NO_ENCONTRADA`.
   - El `aula_id` existe pero está inactiva: `409 AULA_INACTIVA`, "El aula seleccionada no está activa".
   - El aula está activa pero ocupada en ese horario por otro turno `DISPONIBLE`/`COMPLETO`: `409 AULA_NO_DISPONIBLE` (este código queda reservado solo para el conflicto de horario desde la remediación).
   - En cualquiera de los tres primeros casos, el turno permanece sin cambios.
3. **Revisión 3 — fijar el cupo:** `cupoMaximoTurno = aula.capacidadAula`. Si el turno **ya tiene alumnos cargados** (reasignación de aula) y la nueva capacidad es menor a la cantidad de alumnos ya inscriptos: `409 AULA_CAPACIDAD_INSUFICIENTE`, "El aula elegida tiene menos capacidad que los alumnos ya inscriptos en este turno" — no se guarda el cambio. Si el turno todavía no tiene alumnos (caso normal, aula es el segundo paso), no aplica esta validación. **Nota (H3, relevamiento Revisión 3):** en el flujo normal de esta revisión, esta validación es en la práctica **inalcanzable** — un turno `PENDIENTE` nunca llega a tener alumnos confirmados, porque 2.2 (la única operación que carga alumnos) siempre transiciona el turno fuera de `PENDIENTE` al confirmar con éxito, y esta ruta (2.3) solo opera sobre turnos `PENDIENTE`. Se implementa y documenta igual, como defensa en profundidad ante cambios futuros del flujo, no porque el caso ocurra hoy.
4. Actualizar `aula_id` y `cupoMaximoTurno` (`updateMany` con `where: { idTurno, estadoTurno: "PENDIENTE" }`, `count === 0` ⇒ `409 TURNO_MODIFICADO`). El turno permanece `PENDIENTE` — **ya no transiciona acá** (Revisión 3: la transición se movió a 2.2, ver ese punto 8).
5. Emitir `turno:aula_asignada`, vía `emitirEventoTurno()` (remediación D11 — antes era un `prisma.eventoTurno.create` directo).
6. **Reemplazo de aula mientras sigue `PENDIENTE`:** este mismo endpoint permite reemplazar el `aula_id` (y recalcular `cupoMaximoTurno`) las veces que haga falta, sujeto a la validación del paso 3 si ya hay alumnos.

**Nota Revisión 4:** la validación de disponibilidad de aula (paso 2, contra turnos `DISPONIBLE`/`COMPLETO` superpuestos) ya opera sobre el intervalo real del turno — no requiere cambios. **Confirmado en el relevamiento** (`HU-C-03.md` §10.2): `aulaConTurnoSuperpuesto()` y `validarIntervalo()` no suponen una duración fija.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "aula_id": "cuid", "cupo_maximo": 30, "estado": "PENDIENTE" }, "error": null }
```

**Respuesta `409 Conflict` (capacidad insuficiente al reasignar con alumnos ya cargados):**
```json
{ "data": null, "error": { "code": "AULA_CAPACIDAD_INSUFICIENTE", "message": "El aula elegida tiene menos capacidad que los alumnos ya inscriptos en este turno" } }
```

---

### 2.4. Listado y detalle de turnos (HU-C-01) — sin cambios en Revisión 4

**Ruta (listado):** `GET /app/api/turnos/route.ts` · **Ruta (detalle):** `GET /app/api/turnos/[id]/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` → `listarTurnos()` / `obtenerTurno()` (ya implementadas, ver función `presentar()`)
**Permiso requerido:** `turnos:leer`

**Comportamiento esperado (cambia el presentador `presentar()`):**
- Incluye turnos en los 3 estados. Cada ítem: `fecha`, `hora_inicio`–`hora_fin`, **`alumnos_inscriptos`** (`"3/5"`, ocupación sobre `cupoMaximoTurno` — reemplaza el campo `alumno`/`alumnos` de nombres de Revisión 1), `profesor` (`"Apellido, Nombre"` o `"Sin asignar"`), `materia`, `aula` (ídem o `"Sin asignar"`), `estado` (texto: `Pendiente` | `Disponible` | `Completo`, ya disponible vía `ETIQUETA_ESTADO_TURNO`, adelantado por HU-C-03). **Nota:** HU-C-03 ya agregó `cupo_maximo` al `presentar()` (para precargar el formulario de modificación) y lo mostró también en el detalle del turno; `alumnos_inscriptos` en sí sigue pendiente de esta HU-C-01. **D4 (Revisión 3):** mientras el turno no tiene aula (`cupoMaximoTurno` es `null`), no hay ocupación que mostrar — `alumnos_inscriptos` muestra el texto `"Sin asignar"` en vez de `"0/N"`, ya que todavía no existe un `N` contra el cual expresar la ocupación.
- Orden por defecto: `fecha, hora_inicio` ascendente desde la fecha actual en adelante; `profesor_id` como segundo criterio de desempate — sin cambios respecto a `listarTurnos()` actual.
- Los turnos `PENDIENTE` se distinguen con la etiqueta "Pendiente" y ofrecen continuar su configuración — **Revisión 3, orden invertido (HU-C-01 criterio 3):** primero asignar aula (2.3) si todavía no la tiene, y recién si ya la tiene, asignar profesor y alumnos (2.2).
- Paginación server-side con metadatos, sin cambios respecto a lo ya implementado.
- El detalle sigue mostrando el listado completo de alumnos inscriptos (`turno.alumnos`, ya incluido en `turnoInclude`), no solo la ocupación.

**Nota Revisión 4:** el listado ya muestra `hora_inicio`–`hora_fin` calculados; con duración variable, simplemente va a mostrar rangos de distinto ancho — no requiere cambio de contrato ni de presentador. **Regresión verificada en navegador (25/09/2026):** el listado muestra bien turnos de 2h y 3h, y la agenda por profesor del calendario dibuja un bloque de 2h con el ancho correcto (`HU-C-03.md` §11). El presentador sigue exponiendo `duracion_minutos` (no `duracion_min`, ver changelog, R4-4).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumnos_inscriptos": "3/5", "profesor": "Gómez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "DISPONIBLE" },
      { "id": "cuid", "fecha": "2026-04-11", "hora_inicio": "14:00", "hora_fin": "15:00",
        "alumnos_inscriptos": "Sin asignar", "profesor": "Sin asignar", "materia": "Física", "aula": "Sin asignar", "estado": "PENDIENTE" }
    ],
    "paginacion": { "total": 15, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

---

### 2.5. Agregar o quitar un alumno individual (HU-C-04, ampliación) — IMPLEMENTADA, sin cambios en Revisión 4

**DECISIÓN RESUELTA (no relevar de nuevo):** esta operación existe **solo** cuando `estadoTurno ∈ {DISPONIBLE, COMPLETO}` — es decir, una vez que el turno ya tiene aula. Mientras el turno está `PENDIENTE`, cualquier cambio en los alumnos se resuelve reemplazando el conjunto completo vía 2.2. Motivo: HU-C-04 criterio 6 describe explícitamente "si el turno estaba en Completo, al quitar un alumno vuelve a Disponible" — esa transición solo existe una vez que el turno dejó de ser `PENDIENTE`.

**Ruta (agregar):** `POST /app/api/turnos/[id]/alumnos/route.ts`
**Ruta (quitar):** `DELETE /app/api/turnos/[id]/alumnos/[alumnoId]/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` — funciones nuevas
**Permiso requerido:** `turnos:asignar_participantes`

```typescript
export const AgregarAlumnoTurnoSchema = z.object({
  alumno_id: z.string().cuid(),
});
```

**Comportamiento esperado — agregar (dentro de `prisma.$transaction`):**
1. Leer el `Turno` con lock de fila (ver 3.7); debe existir y estar `DISPONIBLE` (si `PENDIENTE`: `409 TURNO_PENDIENTE`, usar 2.2; si `COMPLETO`: `409 CUPO_INSUFICIENTE`). **Aplicar el guard de vigencia (`turnoSigueVigente`) — Decisión A: `409 TURNO_VENCIDO`** si `fechaTurno + horaInicioTurno` ya pasó.
2. Verificar `alumno_id` activo.
3. Verificar que no esté ya en el turno: `409 ALUMNO_YA_ASIGNADO`.
4. Verificar disponibilidad del alumno contra otros turnos `DISPONIBLE`/`COMPLETO` superpuestos: `409 ALUMNO_NO_DISPONIBLE`. **Decisión C:** el `ServiceError` de este código lleva `{ alumno_id }` como detalle; la ruta lo reenvía en la respuesta y la UI lo usa únicamente para marcar el chip del alumno en conflicto — el mensaje literal de la HU no cambia.
5. **Guarda de cupo atómica (3.7):** con la fila ya bloqueada en el paso 1, contar `TurnoAlumno` actuales; si `count >= cupoMaximoTurno`, `409 CUPO_INSUFICIENTE`.
6. Insertar `TurnoAlumno`.
7. Si `count + 1 === cupoMaximoTurno`: `UPDATE turno SET estadoTurno = 'COMPLETO' WHERE idTurno = turnoId AND estadoTurno = 'DISPONIBLE'`.
8. Emitir `turno:alumno_agregado` y, si hubo transición, `turno:completado`.

**Comportamiento esperado — quitar:**
1. Leer el `Turno` con lock de fila; debe existir y estar `DISPONIBLE` o `COMPLETO` (si `PENDIENTE`: `409 TURNO_PENDIENTE`). **Aplicar el guard de vigencia (`turnoSigueVigente`) — Decisión A: `409 TURNO_VENCIDO`** si `fechaTurno + horaInicioTurno` ya pasó.
2. Eliminar el `TurnoAlumno` correspondiente (baja física de la fila intermedia — no aplica Regla N.° 1 de `RULES.md`, que protege entidades de dominio como `Turno`, no vínculos de inscripción). Si no existía: `404 ALUMNO_NO_ASIGNADO`.
3. Si el turno estaba `COMPLETO`: `UPDATE turno SET estadoTurno = 'DISPONIBLE' WHERE idTurno = turnoId AND estadoTurno = 'COMPLETO'`.
4. **Decisión B:** se permite quitar al último alumno de un turno `DISPONIBLE`, dejándolo en `0/N` pero seguirá `DISPONIBLE` (la spec no lo prohíbe; un turno sin alumnos inscriptos sigue siendo válido para recibir inscripciones).
5. Emitir `turno:alumno_quitado` y, si hubo transición, `turno:disponible_nuevamente`.

**Respuesta `200 OK` (agregar, sin alcanzar cupo):**
```json
{ "data": { "id": "cuid", "alumnos_inscriptos": "4/5", "estado": "DISPONIBLE" }, "error": null }
```

**Respuesta `409 Conflict` (cupo alcanzado):**
```json
{ "data": null, "error": { "code": "CUPO_INSUFICIENTE", "message": "El turno alcanzó su cupo máximo" } }
```

---

### 2.6. Listar profesores disponibles para el turno (HU-C-04, ampliación — NUEVA en Revisión 3), sin cambios en Revisión 4

Filtra de entrada el selector de profesor de 2.2, en vez de validar recién al confirmar. Mismo patrón que 2.3 usa para las opciones de aula.

**Ruta:** `GET /api/turnos/profesores/opciones?turno_id=`
**Servicio:** `src/server/turnos/turno.profesor.service.ts` → `listarOpcionesProfesorTurno()` (relevamiento Revisión 3 confirmó el archivo — colaborador propio, no vive en `turno.service.ts`, mismo criterio de separación que `turno.aula.service.ts`)
**Permiso requerido:** `turnos:asignar_participantes`

**Comportamiento esperado:**
1. Leer el `Turno` por `turno_id`; debe existir y tener `materiaId` y `fecha`/`hora_inicio` ya definidos (siempre los tiene, se configuran en 2.1). Si no existe: `404 TURNO_NO_ENCONTRADO`.
2. Listar profesores activos asociados a la materia del turno (`listarProfesoresActivosPorMateria()`, ya existente). **Ajuste de implementación (Revisión 3):** si la materia no tiene **ningún** profesor activo asociado (lista vacía en este punto, antes de aplicar el filtro de disponibilidad): `404 SIN_PROFESORES_PARA_MATERIA` — distingue este caso ("no hay profesores que dicten la materia") del caso "hay profesores pero ninguno está libre en ese horario" (paso 4), que responde `200` con lista vacía. Mismo patrón que `SIN_AULAS_ACTIVAS` en 2.3.
3. De esa lista, quedarse solo con los que:
   - Tienen el horario del turno `[hora_inicio, hora_fin)` contenido en su horario de atención registrado (`estaDentroDeHorarioAtencion()`, ya existente — mismo criterio que 2.2 paso 5 usa para revalidar).
   - No tienen otro turno `DISPONIBLE`/`COMPLETO` que se superponga con ese horario (misma fórmula de `intervalosSeSuperponen()`).
4. Devolver la lista filtrada. Si queda vacía (había profesores para la materia, pero ninguno libre en ese horario): `200 OK` con lista vacía — el frontend interpreta eso como "No hay profesores disponibles para este horario" (HU-C-04 criterio 2, ampliado).

**Nota Revisión 4:** el filtro de disponibilidad (paso 3) ya opera sobre el intervalo real del turno — no requiere cambios.

**Respuesta `200 OK`:**
```json
{ "data": [{ "id": "cuid", "nombre": "Ana", "apellido": "Gómez" }], "error": null }
```
**Corrección (D7, relevamiento Revisión 3):** el formato de respuesta es `{ "data": [...] }` (array directo), no `{ "data": { "items": [...] } }` — se alineó con el formato que ya usa el endpoint hermano de aula (2.3) en vez de introducir una forma distinta.

**Respuesta `404 Not Found` (sin profesores para la materia):**
```json
{ "data": null, "error": { "code": "SIN_PROFESORES_PARA_MATERIA", "message": "No hay profesores asociados a esta materia" } }
```

**Nota de alcance:** esta lista es de buena fe, igual que la de aulas (2.3) — el turno todavía no reserva nada hasta confirmarse en 2.2, así que un profesor listado acá puede dejar de estar disponible si otro turno lo toma antes de que este se confirme. Por eso 2.2 revalida igual en su paso 5, con la defensa final de `reservas_turno` (3.4) como garantía de motor.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `src/server/turnos/turno.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Máquina de tres estados
`PENDIENTE → {DISPONIBLE, COMPLETO}` es la única transición de salida de `PENDIENTE`, sin reversión. `DISPONIBLE ⇄ COMPLETO` sí es reversible y automático, gobernado exclusivamente por la comparación entre la cantidad de alumnos inscriptos y `cupoMaximoTurno` (2.5). Ningún endpoint permite fijar `COMPLETO` o `DISPONIBLE` manualmente.

### 3.2. Un turno `PENDIENTE` nunca reserva recursos
Toda consulta de disponibilidad (2.2 pasos 5 y 8, 2.3 paso 2, 2.5 paso 4, 2.6 paso 3) filtra explícitamente `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }`. Esta regla también rige fuera del módulo: `src/server/calendario/calendario.service.ts` filtra por el mismo criterio para no mostrar turnos pendientes (migrado en HU-C-03, verificado con curl + test del filtro).

### 3.3. Fórmula de superposición reutilizada, no reimplementada
Sin cambios respecto a Revisión 1: intervalos semiabiertos (`a1 < b2 AND b1 < a2`), definida en `spec_modulo_D.md` §3.4, ya implementada en `intervalosSeSuperponen()`. **Nota Revisión 4:** esta fórmula nunca asumió una duración fija — opera sobre los dos extremos del intervalo, cualquiera sea su ancho. No requiere cambios para soportar duración variable.

### 3.4. Defensa de concurrencia: tabla `reservas_turno` + exclusión GiST unificada (extensión `btree_gist`) — DISEÑO REAL, RATIFICADO (D8), sin cambios de diseño en Revisión 4

**Reemplaza por completo el diseño propuesto en Revisión 2** (constraints `EXCLUDE` directos sobre `turnos`, nunca migrados, que además no podían cubrir el caso de alumno). Implementado como parte de HU-C-15, auditado y ratificado por el Scrum Master el 24/09.

En vez de poner la exclusión sobre `turnos`, se usa una tabla de reservas unificada: un registro por cada recurso reservado (profesor, aula, alumno) por turno, con el rango horario del turno desnormalizado en cada fila, mantenida automáticamente por triggers al confirmar el turno (2.2). Una única exclusión GiST sobre esa tabla cubre los tres tipos de recurso — evita necesitar tres mecanismos distintos (uno de los cuales, el de alumno, la Revisión 2 dejaba sin resolver porque un `EXCLUDE` no puede hacer join contra la tabla intermedia `TurnoAlumno`).

```
Migración: 20260924150000_turnos_reservas_recursos_v2 (origin/develop)

Forma conceptual (detalle técnico completo de columnas/triggers reales:
ver docs/tasks/Sprint 1/HU-C-15.md §3.5, relevado contra el código real):

reservas_turno
  - turno_id       (FK a turnos)
  - tipo_recurso   ('PROFESOR' | 'AULA' | 'ALUMNO')
  - recurso_id     (id del profesor, aula o alumno reservado)
  - rango_horario  (tsrange, desnormalizado desde el turno)

  EXCLUDE USING gist (
    tipo_recurso WITH =,
    recurso_id WITH =,
    rango_horario WITH &&
  )
```

Las filas de `reservas_turno` se crean cuando el turno confirma (2.2, transición a `Disponible`/`Completo`) — un turno `PENDIENTE` no tiene reservas, lo que sostiene a nivel de motor la regla de negocio 3.2 ("un turno `PENDIENTE` nunca reserva recursos"), sin necesitar una cláusula `WHERE` sobre el estado del turno como proponía el diseño anterior.

**Esto es, a partir de esta revisión, la defensa atómica final real** — ya no una validación exclusivamente aplicativa. La validación de 2.2 paso 5 sigue existiendo como verificación de buena fe antes de intentar confirmar (para dar un mensaje de error claro), pero el `INSERT` a `reservas_turno` dentro de la misma transacción es lo que efectivamente impide, a nivel de base, que dos turnos terminen confirmados con el mismo recurso en el mismo horario.

**Nota Revisión 4 — CONFIRMADO:** el rango horario se desnormaliza *desde el turno*, no desde una constante. Se releyó el trigger real (`HU-C-03.md` §10.1, punto 3): `sincronizar_reservas_turno()` y `sincronizar_reserva_alumno()` calculan `inicio := "fechaTurno" + "horaInicioTurno"` y `fin := inicio + "duracionMinutosTurno" * interval '1 minute'`, y el trigger sobre `turnos` se dispara también con `UPDATE OF "duracionMinutosTurno"`. El mecanismo soporta turnos de distinta duración por construcción: **no se tocó la migración `20260924150000_turnos_reservas_recursos_v2`**. Verificado además en Postgres real (`turno.reservas.pg.test.ts`, caso Revisión 4): la reserva de un turno de 2h cubre 10:00–12:00, rechaza un turno superpuesto a las 11:00 y acepta uno contiguo a las 12:00.

**Nota de sincronización (relevamiento Revisión 4) — nombres reales de columnas:** la forma conceptual de arriba no coincide con los nombres reales de `reservas_turno`. Correspondencia:

| Forma conceptual (arriba) | Columna real |
|---|---|
| `turno_id` | `"turnoId"` (FK a `turnos`, `ON DELETE CASCADE`) |
| `tipo_recurso` | `"tipoRecurso"` (`CHECK` en `'AULA'`, `'PROFESOR'` o `'ALUMNO'`) |
| `recurso_id` | `"recursoId"` |
| `rango_horario` (tsrange) | **no existe como columna:** hay dos columnas `"inicioReserva"` / `"finReserva"` (`timestamp(6)`, `CHECK "inicioReserva" < "finReserva"`), y el rango se arma en la exclusión como `tsrange("inicioReserva", "finReserva", '[)')` |

Exclusión real: `reservas_turno_sin_solapamiento EXCLUDE USING gist ("tipoRecurso" WITH =, "recursoId" WITH =, tsrange("inicioReserva", "finReserva", '[)') WITH &&)`. PK: `("turnoId", "tipoRecurso", "recursoId")`. Solo corrección de documentación, sin cambio de código.

### 3.5. Guard de vigencia reutilizado
Sin cambios — ver sección 2, "Convenciones generales".

### 3.6. Transacción única para "confirmar participantes + intentar transicionar"
**Revisión 3:** la transacción que evalúa la transición ya no vive en 2.3 (asignar aula) — se movió a 2.2 (asignar profesor y alumnos), que es ahora el último paso. `asignarParticipantesTurno()` sigue resolviéndose en una única `prisma.$transaction`, y el resultado de la transición puede ser `DISPONIBLE` o `COMPLETO`. A diferencia de Revisión 2, esta transacción ya no es la única barrera contra una condición de carrera: la defensa de motor de 3.4 (`reservas_turno` + GiST) está implementada y ratificada.

### 3.7. Guarda de concurrencia para el cupo
Dos casos distintos, con soluciones distintas:

- **Alta/baja individual de alumno (2.5, HU-C-04):** la condición de cupo depende de un **conteo sobre una tabla relacionada** (`TurnoAlumno`), que un `updateMany` simple no puede expresar de forma atómica. Patrón obligatorio: (1) dentro de la transacción, bloquear la fila del turno con `SELECT "idTurno", "cupoMaximoTurno" FROM turnos WHERE "idTurno" = $1 FOR UPDATE` (vía `tx.$queryRaw`); (2) recién con la fila bloqueada, contar `TurnoAlumno` del turno; (3) comparar contra `cupoMaximoTurno` e insertar/rechazar. El `FOR UPDATE` serializa dos altas concurrentes sobre el mismo turno.
- **Modificación de `cupo_maximo` en un turno `PENDIENTE` (2.1, HU-C-03, código `CUPO_MENOR_A_INSCRIPTOS`):** **Revisión 3 — este caso queda sin uso.** El cupo ya no se modifica desde 2.1; solo cambia al reasignar aula (2.3), que tiene su propia validación de capacidad (paso 3 de esa sección, código `AULA_CAPACIDAD_INSUFICIENTE`). El patrón de optimistic locking (`updatedAtTurno`) descripto acá para este caso queda documentado como histórico, no se elimina de la base de conocimiento del proyecto pero no aplica a partir de esta revisión.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite después del `COMMIT`, vía `emitirEventoTurno()` → `prisma.eventoTurno.create()` (opción b de la Regla N.° 2, ya implementada — sin encadenamiento hash, ver historial de esa regla).

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `turno:configurado` | Alta (2.1) | `turno_id, fecha, hora_inicio, hora_fin, duracion_min, materia_id, usuario_id` (Revisión 3: ya no lleva `cupo_maximo`, todavía no existe en este paso; **Revisión 4: agrega `duracion_min`**) |
| `turno:configuracion_modificada` | Modificación de turno pendiente (2.1) | `turno_id, campos_modificados, profesor_desasignado, usuario_id` |
| `turno:aula_asignada` | Asignación de aula (2.3) | `turno_id, aula_id, cupo_maximo, usuario_id` (Revisión 3: agrega `cupo_maximo`, ahora se fija en este paso) |
| `turno:participantes_asignados` | Carga/reemplazo inicial de profesor + alumnos (2.2) | `turno_id, alumno_ids, profesor_id, usuario_id` |
| `turno:disponibilizado` | Transición Pendiente→Disponible (Revisión 3: ahora se dispara desde 2.2, no 2.3) | `turno_id, fecha, hora_inicio, hora_fin, alumno_ids, profesor_id, aula_id, materia_id, usuario_id` |
| `turno:completado` | Transición a Completo, desde 2.2 (Revisión 3) o desde 2.5 | `turno_id, alumno_ids, cupo_maximo, usuario_id` |
| `turno:alumno_agregado` | Alta individual de alumno (2.5) | `turno_id, alumno_id, usuario_id` |
| `turno:alumno_quitado` | Baja individual de alumno (2.5) | `turno_id, alumno_id, usuario_id` |
| `turno:disponible_nuevamente` | Transición Completo→Disponible (2.5) | `turno_id, alumno_id_liberado, usuario_id` |

---

## Parámetros configurables (referencia)

| Parámetro | Usado en |
|---|---|
| `DURACIONES_PERMITIDAS_TURNO_MIN` | **Revisión 4 — reemplaza a `DURACION_ESTANDAR_TURNO_MIN`** (que en el código real era la fila `duracion_turno_estandar_minutos` de `ParametroSistema`, ya no leída ni sembrada). Lista de valores permitidos, `[60, 120, 180]`. **Constante en código** (`src/server/turnos/turno.schema.ts`), **no fila de `ParametroSistema`** (R4-1): cambiar el conjunto requiere una nueva aprobación del PO. El frontend la recibe vía `GET /api/turnos/configuracion` (`parametros.duraciones_permitidas_minutos`). 2.1 — cálculo de `hora_fin`, validación de `duracion_min` (schema Zod + revalidación en el servicio, `DURACION_NO_PERMITIDA`) || `GRANULARIDAD_MINUTOS` | 2.1 — validación de `hora_inicio` |
| `DIAS_OPERATIVOS` | 2.1 — día válido para configurar |
| `HORA_APERTURA` / `HORA_CIERRE` | 2.1 — horario operativo del centro |
| `ANTICIPACION_MAXIMA_DIAS` | 2.1 — tope de anticipación para configurar un turno |