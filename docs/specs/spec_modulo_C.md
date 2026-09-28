# Especificación Técnica — Módulo C (Turno)
## Noctium — Sprint 1 (Revisión 4) · Sprint 2 (Revisión 5)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker, extensión `btree_gist` prevista pero aún no migrada — ver nota en 3.4) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (Alumno) · `spec_modulo_D.md` (Profesor, fórmula de superposición §3.4) · `spec_modulo_K.md` (Aulas) · `spec_modulo_I.md` (Pagos, Sprint 2) · `spec_modulo_E.md` (Historial, Sprint 2) · `schema.prisma` · `docs/tasks/Sprint 1/` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` · `docs/adicionales/propuesta-cambio-orden-flujo-turno.md`

**HU contractualizadas en esta revisión:** HU-C-03 (Configurar turno — **implementada Revisión 3, reabierta en Revisión 4 por la duración configurable, implementada y verificada en navegador el 25/09/2026**, ver `docs/tasks/Sprint 1/HU-C-03.md`), HU-C-04 (Asignar profesor y alumnos / gestionar inscripciones — implementada Revisión 3, sin cambios en esta revisión, ver `docs/tasks/Sprint 1/HU-C-04.md`), HU-C-15 (Asignar aula — implementada/remediada Revisión 3, sin cambios en esta revisión, ver `docs/tasks/Sprint 1/HU-C-15.md`), HU-C-01 (Listar turnos) — Sprint 1.

**HU contractualizadas en la Revisión 5 (Sprint 2):** HU-C-18 (Reordenar el flujo de registro de turno), HU-C-07 (Mostrar horarios disponibles del profesor), HU-C-16 (Mostrar aulas disponibles según horario — sin cambio de contrato, solo de posición), HU-C-17 (Generar turnos a partir del horario del profesor), HU-C-09 (Consultar detalles del turno), HU-C-05 (Cancelar turno), HU-C-06 (Reprogramar turno), HU-C-10 (Asignar prioridad), HU-C-02 (Búsqueda inteligente de turnos), HU-C-08 (Consultar turnos asociados al profesor), HU-C-12 (Solicitar turno propio), HU-C-13 (Consultar turnos propios). Además provee los servicios públicos que consumen HU-K-03, HU-D-07, HU-I-01, HU-E-01, HU-H-01 (sección 2.15).

**Backlog v2 del 28/09/2026 (xlsx de los PO, 25 HU · 63 SP).** Respecto del backlog anterior (26 HU · 49 SP) los PO: (1) **retiraron HU-C-11** (Asociar forma de pago al turno): el turno ya no lleva forma de pago y la sección 2.13 queda sin contrato; (2) cambiaron HU-C-17 AC7: los turnos generados nacen **`DISPONIBLE` 0/N**, no `PENDIENTE` (queda resuelto el punto Q11); (3) cambiaron HU-C-07 AC1 y HU-C-17 AC1: el horario **no** depende de la materia (resuelve Q1); (4) HU-C-13 ahora **incluye los turnos `CANCELADO`**; (5) HU-C-12 agrega el aviso "El pago se abona en el centro"; (6) HU-D-07 pide listar los turnos que bloquean la baja de una materia; (7) HU-I-01 registra **qué alumno paga**.

**Cambio de flujo (Revisión 5, pedido del cliente vía PO, aprobado 27/09/2026 — ver `docs/adicionales/propuesta-cambio-orden-flujo-turno.md`):** el wizard de Mesa de Entradas pasa a **Elegir Materia → Elegir Profesor → Elegir Fecha y Horario → Elegir Aula → Agregar Alumnos**, y **reemplaza por completo** el orden de la Revisión 4 (Configurar → Aula → Profesor y alumnos). El trabajo de reordenamiento lo absorbe **HU-C-18** (mapa de pantallas §1, "HU-C-03/C-04/C-15 no se reabren"); esta spec ajusta los contratos 2.1, 2.2, 2.3, 2.4 y 2.6 por notas de Revisión 5 dentro de cada sección, sin renumerarlas, y agrega las secciones nuevas 2.7 a 2.15 y las reglas 3.8 a 3.13.

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

**Actualización de alcance — Revisión 5 (Sprint 2):** pasan a estar **dentro de alcance**: cancelar un turno `DISPONIBLE`/`COMPLETO` (2.10), modificar fecha/hora de un turno `DISPONIBLE`/`COMPLETO` (2.11), sugerencia de franjas disponibles (2.8) y búsqueda simple en el listado (2.7). Siguen **fuera de alcance**: cancelar un turno `PENDIENTE` (se descarta sin guardar), cancelación de un turno propio por el alumno (HU-C-14, Sprint 3), cambiar materia, profesor o duración de un turno ya confirmado, reemplazo de aula de un turno confirmado, filtros combinados por estado o rango de fechas (HU-C-02 AC6), notificaciones por cambio de prioridad, y la vista de calendario (módulo J).

---


## ✅ DECISIONES DEL SCRUM MASTER — Revisión 5 (Sprint 2)

Redactadas el 28/09/2026 a partir de `HU-Sprint-2.md`, el mapa de pantallas, la propuesta de orden de flujo, `schema.prisma` y `seed.ts`. Las marcadas **[CONFIRMAR PO]** tienen una propuesta por defecto (la que esta spec contractualiza) y una pregunta abierta; **no se implementa lo dudoso por inferencia** (`sdd-metodologia.md`, "Relevar antes de asumir").

| # | Decisión | Estado |
|---|---|---|
| R5-1 | **Cuándo se persiste el turno.** Los pasos 1 a 3 (Materia, Profesor, Fecha/Horario) viven en el estado del cliente. Al confirmar el paso 3 se hace `POST /api/turnos` (2.1, ahora con `profesor_id`) y el turno nace `PENDIENTE`. El paso 4 usa `PATCH .../aula` (2.3) y el paso 5 `PATCH .../participantes` (2.2), que sigue siendo la operación que confirma. No se crea un endpoint combinado. | Decidido |
| R5-2 | **Profesor obligatorio en el alta.** `profesor_id` pasa a ser requerido en 2.1. En 2.2 pasa a ser opcional: si el turno ya tiene profesor no hace falta reenviarlo. Los turnos `PENDIENTE` creados en Revisión 4 (sin profesor, p. ej. `seed-turno-11/18/25`) se completan enviándolo en 2.2. | Decidido |
| R5-3 | **Dónde se elige la duración (1/2/3 h).** Dentro del paso 3, antes de fecha y hora, porque las horas de inicio posibles dependen de ella (`duracion_min` es parámetro obligatorio de 2.8). HU-C-18 y HU-C-07 no la ubican. | **[DEFAULT SM, sin ratificar — Q2]** |
| R5-4 | **Horario del profesor y materia.** `HorarioProfesor` **no tiene** `materiaId` (`schema.prisma`, `spec_modulo_D.md` §2.4/§3.5). Los PO lo reconocieron en el backlog v2: HU-C-07 AC1 y HU-C-17 AC1 ahora dicen "horario de atención de **ese profesor**" y HU-D-07 AC5 aclara que los horarios no dependen de la materia. Se contractualiza como *las franjas de un profesor activo que dicta esa materia*. **El backlog se deja tal cual** (decisión del equipo, 28/09): HU-C-17 conserva en el sub-punto de AC1 ("horarios … para ese profesor y esa materia") y en **AC5** ("el único solapamiento que se valida es el de aula") una redacción que el modelo no sostiene, porque la franja no tiene materia. **Aquí prevalece el modelo de datos:** 2.9 valida también al **profesor**, sin lo cual un choque de profesor aparecería como error técnico de la base en vez de un mensaje claro (el trigger igualmente lo rechazaría). Es una precisión técnica, no un cambio de alcance. | Resuelto; backlog sin tocar |
| R5-5 | **Estado `CANCELADO`.** Migración aditiva `ALTER TYPE "EstadoTurno" ADD VALUE 'CANCELADO'`, **en una migración propia** (PostgreSQL no permite usar el valor nuevo en la misma transacción que lo agrega; Prisma envuelve cada migración en una). No se usa `migrate reset`: la base ya es compartida por el equipo. Terminal: no vuelve a ningún estado. | Decidido (HU-C-05 pedía coordinarlo con el SM) |
| R5-6 | **Turnos vencidos** (`fecha + hora_inicio` ya pasó, guard `turnoSigueVigente`): **no** admiten cancelar (2.10), reprogramar (2.11) ni inscribir/quitar alumnos (2.5, 2.14). **Sí** admiten prioridad (2.12, HU-C-10 AC5), registrar pago (`spec_modulo_I.md` §2.4) y registrar clase dictada (`spec_modulo_E.md` §2.1). | **[DEFAULT SM, sin ratificar — Q5]** |
| R5-7 | **Búsqueda del listado** (2.7): excepción **documentada** a la Regla N.° 3 (lectura de columnas normalizadas de Alumno, Profesor, Materia y Aula vía relaciones de Prisma, igual que ya hace el presentador `presentar()`); ver 3.11. | Decidido |
| R5-8 | **Generación masiva** (2.9): (a) no se limita por `ANTICIPACION_MAXIMA_DIAS` (=30 en el seed, contradiría "un cuatrimestre"); se limita con dos parámetros nuevos `generacion_maxima_dias` y `generacion_maxima_turnos`; (b) además del aula, valida al **profesor** (R5-4); (c) detecta duplicados: un turno no cancelado del mismo profesor y materia que se superponga con la fecha calculada se informa como conflicto `TURNO_EXISTENTE` (mensaje claro: "ya generaste esas fechas"). Desde que los turnos generados nacen `DISPONIBLE` (R5-9) ya reservan profesor y aula, así que dos corridas idénticas también chocarían contra la exclusión GiST; esta guarda deja de ser la única defensa y pasa a ser solo un mensaje mejor. Se **elimina el advisory lock** de la versión anterior de esta spec. | **[DEFAULT SM, sin ratificar — Q3]** (Q10 ya no bloquea) |
| R5-9 | **Turnos generados nacen `DISPONIBLE` 0/N.** Decisión de los PO en el backlog v2 (HU-C-17 AC7). No pasan por `PENDIENTE`: se insertan ya con profesor, aula, `cupoMaximoTurno` = capacidad del aula y `estadoTurno = DISPONIBLE`, de modo que el trigger `turno_sincronizar_reservas` reserva profesor y aula en el propio `INSERT` y admiten inscripción desde el primer momento (2.5 y autoservicio 2.14). Es el único camino, además de 2.2, por el que un turno llega a `DISPONIBLE`, y el **único que lo hace con 0 alumnos**. | Resuelto (era Q11) |
| R5-10 | **Modificar un turno `PENDIENTE` que ya tiene aula** (paso "Atrás" del wizard, HU-C-18 AC4): si el nuevo profesor, fecha, hora o duración deja el aula en conflicto, el aula se **desasigna** (`aulaId` y `cupoMaximoTurno` a `null`) y se informa, mismo criterio que la desasignación de profesor de Revisión 3 (2.1 paso 8). | Decidido |
| R5-11 | **RETIRADA.** Definía la forma de pago sugerida de HU-C-11 y el campo `createdAtTurnoAlumno`. Al retirarse HU-C-11 del backlog v2 desaparecen ambos; se conserva el número para no renumerar. | Retirada |
| R5-12 | **Alcance por rol** del listado (C-08), detalle (C-09) y turnos propios (C-13): siempre lo resuelve el servidor a partir de la sesión, nunca del parámetro de la URL (mismo principio que `spec_modulo_J.md` §3.2). | Decidido |

---

## Changelog — Revisión 5 (Sprint 2)

| HU / sección | Estado previo (Revisión 4) | Acción (Revisión 5) |
|---|---|---|
| HU-C-18 / flujo | Configurar → Aula → Profesor y alumnos | Nuevo orden Materia → Profesor → Fecha/Horario → Aula → Alumnos (R5-1). Anotadas 2.1, 2.2, 2.3, 2.6 |
| HU-C-03 / 2.1 | `POST /api/turnos` sin profesor | Recibe `profesor_id` obligatorio y valida al profesor (R5-2). Anotada, sin renumerar |
| HU-C-04 / 2.2 | Recibe `alumno_ids` + `profesor_id` obligatorio | `profesor_id` opcional. Nueva precondición `TURNO_SIN_PROFESOR` |
| HU-C-15 / 2.3 | Segundo paso del flujo | Cuarto paso. Sin cambio de contrato (HU-C-16 sin cambio de contenido) |
| HU-C-04 / 2.6 | Filtra el selector de profesor por horario del turno | Ya no es parte del wizard nuevo; se conserva para completar turnos `PENDIENTE` sin profesor (R5-2) |
| HU-C-01 / 2.4 | Listado sin búsqueda ni prioridad | El presentador agrega `prioridad` y `creado_por`; el detalle agrega los pagos con su alumno (`spec_modulo_I.md`) |
| HU-C-07 | Gap | Nueva sección 2.8 |
| HU-C-17 | Gap | Nueva sección 2.9. Turnos generados `DISPONIBLE` 0/N (AC7 del backlog v2) |
| HU-C-02 / HU-C-08 | Gap | Nueva sección 2.7 |
| HU-C-05 / HU-C-06 / HU-C-10 | Gap | Nuevas secciones 2.10 a 2.12 |
| HU-C-11 | Gap | **Retirada del backlog v2.** La sección 2.13 se conserva como marcador sin contrato (sin renumerar) |
| HU-C-12 / HU-C-13 | Gap | Nueva sección 2.14 |
| Servicios públicos | Solo consumía servicios de otros módulos | Nueva sección 2.15: provee 7 funciones |
| §3.1 máquina de estados | 3 estados | 4 estados: agrega `CANCELADO` terminal |
| Enum `EstadoTurno` | `PENDIENTE`, `DISPONIBLE`, `COMPLETO` | + `CANCELADO` (R5-5) |
| Modelo `Turno` | Sin prioridad | + `prioridadTurno` (enum `PrioridadTurno`, default `NORMAL`). **Sin** forma de pago (HU-C-11 retirada) |
| §3.4 `reservas_turno` | Trigger verificado ante cambios de duración | Relevado: ya cubre fecha, hora, estado, profesor y aula. Sin migración; pendiente prueba con `turno.reservas.pg.test.ts` |
| §4 eventos | 9 eventos | + 4 eventos nuevos y 3 ampliados (ver tabla) |
| Parámetros | — | + `generacion_maxima_dias`, `generacion_maxima_turnos` |

**Migraciones de la Revisión 5** (cada una en su propio archivo; el orden importa):
1. `ALTER TYPE "EstadoTurno" ADD VALUE 'CANCELADO'` — sola, sin más sentencias.
2. `CREATE TYPE "PrioridadTurno" AS ENUM ('NORMAL','ALTA','URGENTE')` + `turnos.prioridadTurno NOT NULL DEFAULT 'NORMAL'`.
3. `INSERT` en `parametros_sistema` y en `roles_permisos` (también en `seed.ts`, ver `spec_modulo_A.md` §2.4).

**Triggers de `reservas_turno`: no requieren migración.** Relevados en `20260924150000_turnos_reservas_recursos_v2`: ya reaccionan a `estadoTurno`, `fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno`, `profesorId` y `aulaId` (2.10 y 2.11). Solo falta probarlo contra Postgres real.

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

**Revisión 5 — cuarto estado.** La máquina pasa a cuatro estados: `DISPONIBLE ⇄ COMPLETO` siguen siendo automáticos y reversibles; `DISPONIBLE | COMPLETO → CANCELADO` (2.10) es manual y **terminal**. `PENDIENTE` no se cancela: se descarta sin guardar (HU-C-05 AC2). Un turno `CANCELADO` no reserva recursos (3.2), no aparece en calendarios ni en las franjas ocupadas de 2.8 y 2.3, y **conserva su historial completo** (no se borra, Regla N.° 1). Además, desde esta revisión el turno lleva `profesorId` desde el alta (R5-2) y una **prioridad** (2.12). **Excepción a "solo se sale de `PENDIENTE` en 2.2":** la generación masiva (2.9) inserta los turnos ya `DISPONIBLE` con 0 alumnos (R5-9).

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
- **Revisión 5 — permisos nuevos** (`RolPermiso`, sembrados en migración y en `seed.ts`; matriz completa en `spec_modulo_A.md` §2.4): `turnos:cancelar`, `turnos:reprogramar`, `turnos:priorizar` (Mesa de Entrada); `turnos:leer_propios` y `turnos:solicitar_propio` (Alumno). `turnos:leer`, `turnos:crear`, `turnos:asignar_participantes` y `turnos:asignar_aula` no cambian.
- **Revisión 5 — archivos nuevos** (Regla N.° 11, todos en `src/server/turnos/`): `turno.generacion.service.ts` (2.9), `turno.cancelacion.service.ts` (2.10), `turno.reprogramacion.service.ts` (2.11), `turno.publico.ts` (2.15). `turno.disponibilidad.ts` y `turno.profesor.service.ts` se amplían (2.8). **`turno.publico.ts` no importa de otros módulos**; son los módulos consumidores los que importan de él.
- **Revisión 5 — ids de turno en rutas:** las rutas nuevas que reciben el `id` del turno por URL **no** lo validan como CUID (mismo criterio y motivo que la nota de sincronización de HU-C-04: los turnos de seed tienen ids `seed-turno-NN`); un id inexistente responde `404`. El resto de los ids (alumno, profesor, aula, forma de pago, horario) sí se validan como CUID.
- **Limitación conocida del entorno de desarrollo (Turbopack, Revisión 3):** con `next dev` (Turbopack, modo por defecto) la ruta `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (2.5) deja de registrarse una vez que existe la carpeta `api/turnos/profesores/` (2.6), y responde con la página 404 de Next en vez de ejecutar el handler — sin que el código esté roto: funciona correctamente con `next dev --webpack` y en el build de producción. Causa raíz no diagnosticada en profundidad (asumida como un bug de ruteo de Turbopack en modo desarrollo). Workaround documentado en `README.md` ("Puesta en marcha", paso 8): usar `npx next dev --webpack` para desarrollo local. No se modificó el contrato de rutas ni `package.json` para evitar este problema.
- **Nota de sincronización (HU-C-04, 24/09):** las rutas `PATCH .../participantes`, `POST .../alumnos` y `DELETE .../alumnos/[alumnoId]` no validan el `id` del turno en la URL contra el formato CUID (a diferencia del resto de la spec). Motivo: los turnos de seed usan ids no-CUID (`seed-turno-10`, etc.) y la validación los rechazaba con `400` antes de llegar al servicio, impidiendo probar el criterio 6 contra el seed. Un id inexistente ahora responde `404` desde el servicio, igual que `GET /api/turnos/[id]`. El `alumnoId` de la URL y el `alumno_id` del body sí se siguen validando como CUID. Si se decide endurecer esto en el futuro, debe aplicarse parejo en las 4 rutas de Turno que reciben el id por URL, no solo en estas 3.

---

### 2.1. Configurar turno (HU-C-03) — IMPLEMENTADA (Revisión 3), REABIERTA EN REVISIÓN 4, IMPLEMENTADA Y VERIFICADA (Revisión 4, 25/09/2026)

> **Revisión 5 (HU-C-18, R5-1/R5-2/R5-3/R5-10).** El alta se dispara al confirmar el **paso 3** del wizard, no al empezar. `ConfigurarTurnoSchema` **agrega `profesor_id: z.string().cuid()` (obligatorio)**; `duracion_min` sigue igual. Comportamiento adicional, dentro de la misma transacción y sobre turnos `DISPONIBLE`/`COMPLETO` únicamente (3.2):
> - Paso 1b: `profesorActivoDictaMateria(profesor_id, materia_id)` (Módulo D, con `tx`). Si no: `409 PROFESOR_NO_DICTA_MATERIA`. Si no existe o está inactivo: `404 PROFESOR_NO_ENCONTRADO`.
> - Paso 5b: `estaDentroDeHorarioAtencion(profesor_id, fecha, hora_inicio, hora_fin)` y sin superposición con otro turno `DISPONIBLE`/`COMPLETO` del profesor (`intervalosSeSuperponen`). **Se reutiliza la validación de profesor que ya implementa 2.2 paso 5; no se reescribe.** Los códigos de error son los que esa validación ya devuelve (`409` identificando el recurso). Si al implementar no hubiera códigos específicos, usar `409 PROFESOR_FUERA_DE_HORARIO` y `409 PROFESOR_NO_DISPONIBLE`. Es la **revalidación de buena fe** de lo que ofreció 2.8 (HU-C-07 AC4); la defensa de motor sigue siendo `reservas_turno` al confirmar (2.2).
> - Modificación (`PATCH .../configuracion`, solo `PENDIENTE`): admite cambiar `profesor_id` además de fecha, hora, duración y materia. Si cambia la materia y el profesor ya no la dicta, se rechaza con `409 PROFESOR_NO_DICTA_MATERIA` (en Revisión 4 se lo desasignaba; ahora es obligatorio, así que el cliente debe enviar el profesor nuevo en el mismo request). Si el cambio de profesor, fecha, hora o duración deja el **aula ya asignada** en conflicto (2.3 paso 2), el aula se desasigna y la respuesta lleva `"aula_desasignada": true` (R5-10).
> - Respuesta `201` agrega `"profesor_id"`. El evento `turno:configurado` agrega `profesor_id` al payload.
> - Turnos `PENDIENTE` de Revisión 4 sin profesor: siguen siendo válidos; no se migran.

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

> **Revisión 5 (HU-C-18, R5-2).** Sigue siendo la operación que **confirma** el turno y el **quinto y último paso** del wizard (Agregar Alumnos). Cambios: (1) `AsignarParticipantesTurnoSchema.profesor_id` pasa a **opcional**; (2) si el turno ya tiene `profesorId` y no se envía, se usa el existente; si se envía uno distinto, se revalida como en el paso 5 y reemplaza al anterior (solo mientras `PENDIENTE`); (3) si el turno no tiene profesor y no se envía: `409 TURNO_SIN_PROFESOR`, "Elegí un profesor antes de confirmar el turno"; (4) el paso 4 (`SIN_PROFESORES_PARA_MATERIA`) solo aplica cuando se envía un profesor nuevo. El resto de los pasos, la transición y los eventos **no cambian**. Precondición existente `TURNO_SIN_AULA` se mantiene: el aula ahora se elige en el paso 4, antes de este.

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
  // Revisión 5 (R5-2): opcional. Si el turno ya tiene profesor (paso 2 del wizard), se usa el existente;
  // si no lo tiene y no se envía, el servicio responde 409 TURNO_SIN_PROFESOR (no lo decide el schema).
  profesor_id: z.string().cuid().optional(),
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

> **Revisión 5 (HU-C-16, HU-C-18).** **Sin cambios de contrato ni de comportamiento.** Pasa de ser el segundo al **cuarto paso** del wizard. Como el turno ya existe (`PENDIENTE`, con profesor, fecha, hora y duración) cuando se llega acá (R5-1), el frontend usa siempre `GET /api/turnos/aula/opciones?turno_id=` con el `turno_id` real, que filtra por disponibilidad horaria; el modo sin `turno_id` (H1, Revisión 3) queda sin uso en el wizard. HU-C-16 AC1 a AC4 ya están cubiertos por 2.3: cada opción muestra nombre/número y capacidad, "No hay aulas disponibles para este horario" ante lista vacía con oferta de volver al paso 3, y revalidación al confirmar.

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

> **Revisión 5 (HU-C-09, HU-C-10, HU-C-02, HU-C-08).** El presentador `presentar()` agrega: `prioridad` (`"NORMAL" | "ALTA" | "URGENTE"`), `creado_por` y `creado_en`. **El detalle** (`GET /api/turnos/[id]`) agrega además: `cupo_maximo`, `duracion_minutos`, el listado completo de `alumnos`, `pagos` (`listarPagosDeTurno()`, cada uno con su **alumno**, monto, forma de pago y fecha, solo si el rol tiene `pagos:leer`), `clase_dictada` (`{ id, registrada_en } | null`, vía `obtenerClaseDictadaDeTurno()` de `spec_modulo_E.md` §2.4) y `acciones_habilitadas` (lista de las acciones que el estado y el rol permiten: `cancelar`, `reprogramar`, `prioridad`, `registrar_pago`, `registrar_clase`). Cada alumno inscripto lleva el enlace "Ver historial" cuando el rol tiene `historial:leer` (`spec_modulo_E.md` §2.3, punto abierto Q13); es el punto de entrada del Gerente y del Profesor a la ficha del alumno. Un profesor que consulta un turno que no es suyo recibe `403 SIN_PERMISO` sin revelar si existe (`spec_modulo_J.md` §2.1). Los datos no asignados de un `PENDIENTE` se muestran `"Sin asignar"` (D4). **`creado_por`:** `Usuario` no tiene nombre (solo `emailUsuario`) y el personal de mesa de entrada no tiene ficha; se muestra el **email** vía el servicio público de Módulo A `obtenerEmailDeUsuario()` (nunca un `SELECT` sobre `usuarios`). El listado agrega los parámetros de 2.7 (`q`, `profesor_id`) y muestra el indicador visual de prioridad `ALTA`/`URGENTE` (texto o ícono, no solo color). Vista de la pantalla: mapa de pantallas §1, fila "Detalle de turno".

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

> **Revisión 5 (HU-C-12).** El cuerpo de "agregar" se extrae a `inscribirAlumnoEnTurno(turnoId, alumnoId, { origen }, tx)`, que 2.14 reutiliza para la autoinscripción del alumno. Sin cambios de comportamiento ni de contrato para Mesa de Entrada (`origen: "MESA_ENTRADA"`). Un turno `CANCELADO` responde `409 TURNO_CANCELADO` tanto al agregar como al quitar.

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

> **Revisión 5 (R5-2).** Este endpoint **deja de formar parte del wizard nuevo**: el profesor se elige en el paso 2 sin filtrar por horario (2.8, `GET /api/turnos/profesores/por-materia`), y la disponibilidad se aplica después, en el paso 3. Se **conserva sin cambios** para un único caso: completar un turno `PENDIENTE` de Revisión 4 que todavía no tiene profesor (`POST .../participantes` con `profesor_id`, 2.2).

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

### 2.7. Búsqueda en el listado y filtro por profesor (HU-C-02, HU-C-08) — NUEVA en Revisión 5

**Ruta:** la misma de 2.4, `GET /app/api/turnos/route.ts` — **no es una pantalla nueva** (mapa de pantallas §1, filas HU-C-02 y HU-C-08).
**Servicio:** `turno.service.ts` → `listarTurnos()` (se amplía, no se duplica).
**Permiso requerido:** `turnos:leer` (sin cambios: Mesa de Entrada, Gerente y Profesor).

```typescript
// src/server/turnos/turno.schema.ts — se amplía ListarTurnosQuerySchema
export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
  q: z.string().trim().max(100).optional(),        // HU-C-02
  profesor_id: z.string().trim().min(1).optional(), // HU-C-08 (sin .cuid(): ver nota de ids de seed en "Convenciones")
  // Filtros de apoyo para HU-D-07 AC3 ("la lista sale del listado de turnos existente, filtrado por ese
  // profesor, esa materia y fecha futura"). No son filtros combinados de UI (HU-C-02 AC6 sigue fuera de alcance):
  materia_id: z.string().trim().min(1).optional(),
  estados: z.string().optional(),                                  // CSV de EstadoTurno, p. ej. "DISPONIBLE,COMPLETO"; valores inválidos → 400
  solo_futuros: z.enum(["true", "false"]).transform((v) => v === "true").optional(), // fecha + hora_inicio >= ahora
}).strict();
```

**Comportamiento esperado — búsqueda (`q`):**
1. Si `q` tiene menos de 2 caracteres tras el `trim`, se **ignora** (equivale a no filtrar). La UI no lo envía; la regla del servidor evita que un `q` de un carácter devuelva una lista rara. Mismo umbral que HU-B-05 y el selector de HU-C-04.
2. Se normaliza con `normalizarTexto(q)` (minúsculas, sin acentos) y se parte en **tokens** por espacios (máximo 5; el resto se descarta).
3. **Cada token** debe coincidir (parcialmente, `contains`) con **al menos uno** de estos campos: apellido o nombre normalizado de algún alumno inscripto, apellido o nombre normalizado del profesor, `nombreNormalizadaMateria`, `nombreNormalizadaAula`. Entre tokens es **AND**; entre campos, **OR**. Así "Ana" devuelve los turnos donde coincide una alumna o una profesora (HU-C-02 AC2).
4. Devuelve los turnos en cualquier estado, con el mismo formato de fila de 2.4, mismo orden por defecto (fecha/hora ascendente desde hoy, `profesor_id` como desempate) y paginación sobre el resultado filtrado (la UI vuelve a la página 1 al escribir).
5. Sin coincidencias: `200` con `items: []`. Los mensajes "No se encontraron turnos para «texto»" y el vaciado de la búsqueda son responsabilidad de la UI.

**Comportamiento esperado — filtro por profesor (`profesor_id`):**
1. **Alcance por rol, resuelto siempre en el servidor** (R5-12): un `PROFESOR` ve automáticamente **solo sus turnos**; se ignora cualquier `profesor_id` que no sea el propio y, si se envía uno ajeno, `403 SIN_PERMISO` sin revelar si existe. `GERENTE` y `MESA_ENTRADA` pueden enviar cualquier `profesor_id` de un profesor activo (`404 PROFESOR_NO_ENCONTRADO` si no existe).
2. Se combina con `q` y con la paginación.
3. Incluye turnos en **cualquier estado** (`PENDIENTE`, `DISPONIBLE`, `COMPLETO`, `CANCELADO`), a diferencia del calendario (que solo muestra `DISPONIBLE`/`COMPLETO`). Esa es la diferencia que justifica HU-C-08 (AC3).
4. Sin resultados con `profesor_id` y sin `q`: la UI muestra "Este profesor no tiene turnos registrados".

**Uso por HU-D-07 (Profesor, `spec_modulo_D.md` §2.7):** cuando la baja de una materia se rechaza por turnos futuros, la UI de la ficha llama `GET /api/turnos?profesor_id=<id>&materia_id=<id>&estados=DISPONIBLE,COMPLETO&solo_futuros=true` y muestra, por cada turno, fecha, hora y ocupación (p. ej. 3/5) con enlace al Detalle de turno, donde Mesa de Entrada puede cancelarlo (HU-C-05). Los turnos **pasados y cancelados no bloquean** (HU-D-07 AC3), por eso el filtro de estados **excluye** `PENDIENTE` y `CANCELADO`. No hay endpoint nuevo.

**Selector de profesores para el Gerente:** `GET /api/turnos/filtros/profesores` (permiso `turnos:leer`) devuelve `[{ id, nombre, apellido }]` de los profesores activos vía `listarProfesoresActivosOpciones()` (Módulo D, 2.8). No se usa `profesores:leer` porque el Gerente no lo tiene (`seed.ts`, `ACCIONES_SOLO_MESA_ENTRADA`).

**Nota de sincronización — excepción a la Regla N.° 3:** la búsqueda filtra por columnas normalizadas de otros módulos vía relaciones de Prisma. Ver R5-7 y 3.11.

**Respuesta `200 OK`:** igual a 2.4, con los campos ampliados por la nota de Revisión 5.

---

### 2.8. Profesores por materia y disponibilidad para "Fecha y Horario" (HU-C-07) — NUEVA en Revisión 5

Es el mecanismo que calcula las opciones de los pasos 2 y 3 del wizard. **Cambia de naturaleza respecto del backlog original** (propuesta de orden de flujo, §3): ya no es una ayuda visual dentro del selector de profesor, es el paso central "Elegir Fecha y Horario".

**Servicio:** `src/server/turnos/turno.profesor.service.ts` (`listarProfesoresPorMateria()`, `calcularDisponibilidadProfesor()`), con el cálculo puro en `turno.disponibilidad.ts` (módulo compartido, ver "Convenciones generales").
**Permiso requerido:** `turnos:crear`.

#### 2.8.1. Paso 2 — Profesores de la materia

**Ruta:** `GET /api/turnos/profesores/por-materia?materia_id=`

1. Verificar `materia_id` activa (`verificarMateriaActiva()`); si no: `409 MATERIA_NO_DISPONIBLE`.
2. Listar profesores activos asociados (`listarProfesoresActivosPorMateria()`, Módulo D). Si la lista está vacía: `404 SIN_PROFESORES_PARA_MATERIA`. **No** se filtra por horario: eso ocurre en el paso 3.

**Respuesta `200 OK`:** `{ "data": [{ "id": "cuid", "nombre": "Ana", "apellido": "Gómez" }], "error": null }` (array directo, mismo formato que 2.3 y 2.6).

#### 2.8.2. Paso 3 — Fechas y horarios disponibles del profesor

**Ruta:** `GET /api/turnos/profesores/[profesorId]/disponibilidad?materia_id=&duracion_min=&desde=&hasta=`

```typescript
export const DisponibilidadProfesorQuerySchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  duracion_min: z.coerce.number({ error: "Elegí la duración del turno" })
    .int().refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"), // R5-3
  desde: fechaCalendarioValidaSchema.optional(), // por defecto, hoy
  hasta: fechaCalendarioValidaSchema.optional(), // por defecto y como máximo, hoy + ANTICIPACION_MAXIMA_DIAS
});
```

**Comportamiento esperado:**
1. Verificar materia activa (`409 MATERIA_NO_DISPONIBLE`), profesor activo (`404 PROFESOR_NO_ENCONTRADO`) y que dicte la materia (`profesorActivoDictaMateria()`, `409 PROFESOR_NO_DICTA_MATERIA`).
2. Rango efectivo `[max(desde, hoy), min(hasta, hoy + ANTICIPACION_MAXIMA_DIAS)]`. Si `desde > hasta` tras el ajuste: `400`. Los valores fuera de tope se recortan, no se rechazan.
3. Para cada **día operativo** del rango (`DIAS_OPERATIVOS`), tomar las franjas de atención del profesor cuyo `dia_semana` coincide (`obtenerHorariosDeAtencion()`, Módulo D, 2.8). Las franjas son recurrentes y **no tienen materia** (R5-4).
4. De cada franja, **restar** los intervalos de los turnos `DISPONIBLE`/`COMPLETO` del profesor en esa fecha (3.2, misma fórmula `intervalosSeSuperponen`, 3.3). Los `PENDIENTE` y `CANCELADO` **no restan** (HU-C-07 AC2). El resultado son los **tramos libres**.
5. Dentro de cada tramo libre, las **horas de inicio ofrecidas** son las alineadas a `GRANULARIDAD_MINUTOS` tales que `inicio ≥ inicio del tramo` y `inicio + duracion_min ≤ fin del tramo`, y contenidas en `[HORA_APERTURA, HORA_CIERRE]`. Para hoy, solo las posteriores a la hora actual (`America/Argentina/Buenos_Aires`).
6. Se omiten las fechas sin ninguna hora de inicio posible.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
    "duracion_min": 120,
    "rango": { "desde": "2026-09-29", "hasta": "2026-10-28" },
    "fechas": [
      { "fecha": "2026-09-29", "dia_semana": "MARTES",
        "franjas": [ { "hora_inicio": "08:00", "hora_fin": "12:00",
                       "tramos_libres": [{ "desde": "08:00", "hasta": "12:00" }],
                       "inicios": ["08:00", "08:30", "09:00", "09:30", "10:00"] } ] }
    ]
  },
  "error": null
}
```
`fechas: []` significa que no hay ningún horario libre en el rango: la UI muestra "Este profesor no tiene horarios disponibles para esta materia en este momento" y ofrece volver al paso 2 (HU-C-07 AC3). Es `200`, no un error.

**Alcance de buena fe (HU-C-07 AC4):** igual que 2.3 y 2.6, la lista no reserva nada. Se **revalida** en 2.1 (al crear) y otra vez en 2.2 al confirmar, con `reservas_turno` (3.4) como defensa final.

**Fuera de alcance de esta sección:** la vista de calendario (`spec_modulo_J.md`) y la generación masiva (2.9), que reutiliza el mismo cálculo pero en su propia pantalla.

---

### 2.9. Generar turnos a partir del horario del profesor (HU-C-17) — NUEVA en Revisión 5

**Pantalla:** no tiene ruta propia. Vive en `/turnos/nuevo` detrás del control "Turno individual / Generar varios turnos" (decisión de PO 27/09, mapa de pantallas §1). Página completa, feedback por banner.
**Rutas:**
- `POST /api/turnos/generacion/vista-previa` — calcula y valida, **no persiste nada**.
- `POST /api/turnos/generacion` — confirma y persiste.
**Servicio:** `src/server/turnos/turno.generacion.service.ts` (`vistaPreviaGeneracion()`, `generarTurnos()`).
**Permiso requerido:** `turnos:crear`.
**Franjas del profesor:** `GET /api/turnos/profesores/[profesorId]/franjas?materia_id=` (permiso `turnos:crear`) devuelve las franjas **recurrentes** `[{ horario_id, dia_semana, hora_inicio, hora_fin }]` del profesor vía `obtenerHorariosDeAtencion()` (mismo profesor que dicte la materia; sin materia por franja, R5-4).

```typescript
export const GenerarTurnosSchema = z.object({
  materia_id: z.string().trim().min(1),
  profesor_id: z.string().cuid(),
  horario_id: z.string().cuid(),                 // la franja recurrente elegida (HorarioProfesor)
  duracion_min: z.number().int().refine(esDuracionPermitida, "Elegí una duración válida (1, 2 o 3 horas)"), // corrige el "1 o 2 horas" del criterio original: DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]
  hora_inicio: horaSchema,                       // cualquier inicio dentro de la franja (AC1)
  aula_id: z.string().cuid(),                    // una sola para todo el rango (AC4)
  fecha_desde: fechaCalendarioValidaSchema,
  fecha_hasta: fechaCalendarioValidaSchema,
}).strict().refine((d) => d.fecha_desde <= d.fecha_hasta, { message: "La fecha hasta debe ser posterior o igual a la fecha desde", path: ["fecha_hasta"] });
```

**Comportamiento esperado (ambas rutas ejecutan el mismo cálculo; la de confirmación lo repite dentro de la transacción y nunca confía en una lista enviada por el cliente):**
1. Materia activa; profesor activo que dicta la materia (`409 PROFESOR_NO_DICTA_MATERIA`); `horario_id` pertenece a ese profesor (`404 HORARIO_NO_ENCONTRADO`); aula activa (`404 SIN_AULAS_ACTIVAS` / `404 AULA_NO_ENCONTRADA` / `409 AULA_INACTIVA`, mismos códigos que 2.3). La capacidad del aula no se compara contra inscriptos (no hay ninguno al generar), por lo que `AULA_CAPACIDAD_INSUFICIENTE` no aplica.
2. **Encaje en la franja (AC2):** `hora_inicio` alineada a `GRANULARIDAD_MINUTOS` y `franja.hora_inicio ≤ hora_inicio` y `hora_inicio + duracion_min ≤ franja.hora_fin`. Si no: `400 FUERA_DE_FRANJA`. El tramo sobrante de la franja **no se consume**: sigue ofrecido por 2.8 para otra generación (AC3), porque solo los turnos `DISPONIBLE`/`COMPLETO` restan tramos (3.2).
3. **Rango (R5-8a):** `fecha_desde ≥ hoy`; `fecha_hasta − fecha_desde ≤ generacion_maxima_dias`; cantidad de fechas calculadas `≤ generacion_maxima_turnos`. Si no: `400 RANGO_EXCEDIDO` indicando el máximo. **No aplica** `ANTICIPACION_MAXIMA_DIAS`.
4. **Fechas puntuales (AC5):** todas las fechas de `[fecha_desde, fecha_hasta]` cuyo día de la semana es el de la franja y que sean día operativo. Las de hoy cuya `hora_inicio` ya pasó se **omiten** y se informan en `fechas_omitidas_vencidas`. Cada fecha se valida **por separado** (dos lunes distintos no comparten resultado).
5. **Conflictos por fecha**, contra el intervalo real `[hora_inicio, hora_inicio + duracion_min)`:
   - `AULA_OCUPADA`: el aula tiene un turno `DISPONIBLE`/`COMPLETO` superpuesto (`aulaConTurnoSuperpuesto()`).
   - `PROFESOR_OCUPADO`: el profesor tiene un turno `DISPONIBLE`/`COMPLETO` superpuesto (**agregado por el SM**: AC5 lo da por imposible, R5-4).
   - `TURNO_EXISTENTE`: existe un turno **no cancelado** del mismo profesor y materia superpuesto, en cualquier estado incluido `PENDIENTE` (R5-8c). Evita duplicar una corrida ya hecha. Si además aplican `AULA_OCUPADA` o `PROFESOR_OCUPADO`, se informa **solo** `TURNO_EXISTENTE` (es la causa; los otros son consecuencia).
6. **Vista previa (AC6):** devuelve cantidad, fechas y, por fecha, `estado: "OK" | "CONFLICTO"` con `motivos`. Un conflicto se resuelve cambiando el aula **para todo el rango** o acotando el rango; nunca un aula por fecha (AC4).

**Respuesta `200 OK` (vista previa):**
```json
{
  "data": {
    "cantidad": 15,
    "fechas": [
      { "fecha": "2026-10-05", "estado": "OK", "motivos": [] },
      { "fecha": "2026-10-12", "estado": "CONFLICTO", "motivos": ["AULA_OCUPADA"] }
    ],
    "hay_conflictos": true,
    "fechas_omitidas_vencidas": 0
  },
  "error": null
}
```

**Confirmación (`POST /api/turnos/generacion`), dentro de una única `prisma.$transaction`:**
1. Recalcular 1 a 5 **dentro de la transacción**. **Si existe al menos un conflicto: no se crea ningún turno** y responde `409 GENERACION_CON_CONFLICTOS` con el mismo detalle por fecha. La generación es **todo o nada por corrida** (AC6); no se saltean fechas conflictivas.
2. Sin conflictos: insertar un `Turno` por fecha (`tx.turno.create` en bucle; el tope de `generacion_maxima_turnos` lo acota) **ya confirmado** (HU-C-17 AC7 del backlog v2, R5-9): `estadoTurno: "DISPONIBLE"`, `materiaId`, `profesorId`, `aulaId`, `cupoMaximoTurno = capacidad del aula`, `duracionMinutosTurno`, fecha y hora, `prioridadTurno: "NORMAL"`, `creadoPorUsuarioId`. **Sin alumnos (0/N).** No pasa por `PENDIENTE` ni por 2.2. Es la **única excepción** a "el turno sale de `PENDIENTE` solo en 2.2" (3.1), y la única forma de tener un `DISPONIBLE` con 0 alumnos por alta.
3. **Defensa de motor:** el trigger `turno_sincronizar_reservas` (`AFTER INSERT`) reserva profesor y aula en cada `INSERT`. Si la exclusión GiST rechaza alguno (`23P01`; una reserva concurrente se coló entre el cálculo y la inserción), **toda la transacción se revierte** y se responde `409 GENERACION_CON_CONFLICTOS` pidiendo repetir la vista previa; se traduce con `esConflictoDeReserva()` / `errorDeReserva()` de `turno.reserva-error.ts`, sin reescribirlos. Esto reemplaza al advisory lock de la versión anterior de esta spec: ya no hace falta, porque los turnos generados reservan.
4. Tras el `COMMIT`, emitir por cada turno `turno:configurado` (con `generacion_id`), `turno:aula_asignada` y `turno:disponibilizado` (con `alumno_ids: []`), en un único `createMany` sobre `eventos_turno`.

**Respuesta `201 Created`:** `{ "data": { "generacion_id": "cuid", "cantidad": 15, "turno_ids": ["cuid", "…"] }, "error": null }` — la UI informa la cantidad creada (AC7).

**Reglas que **no** cambian (AC8, AC9):** no hay excepciones de disponibilidad del profesor por fecha (una licencia se resuelve cancelando ese turno puntual con 2.10, sin tocar el horario recurrente ni los demás turnos) y la generación siempre la dispara una persona; no existe proceso automático de fondo.

**Fuera de alcance:** aula distinta por fecha, excepciones por licencia, generación con alumnos, y cualquier proceso programado.

---

### 2.10. Cancelar un turno (HU-C-05) — NUEVA en Revisión 5

**Ruta:** `POST /app/api/turnos/[id]/cancelacion/route.ts` (sin body)
**Servicio:** `src/server/turnos/turno.cancelacion.service.ts` → `cancelarTurno()`
**Permiso requerido:** `turnos:cancelar` (exclusivo de Mesa de Entrada)
**Presentación:** `AlertDialog` en el Detalle de turno, mensaje "¿Confirmás cancelar este turno? Esta acción no se puede deshacer." y botón "Cancelar turno"; toast "Turno cancelado correctamente" (mapa de pantallas §4, `DESIGN.md` §6).

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. Condición y mutación en **una sola sentencia** (Regla N.° 7):
   ```typescript
   const r = await tx.turno.updateMany({
     where: { idTurno: id, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } },
     data: { estadoTurno: "CANCELADO", modificadoPorUsuarioId: usuarioId },
   });
   ```
2. Si `count === 0`, leer el turno para distinguir: no existe `404 TURNO_NO_ENCONTRADO`; `PENDIENTE` → `409 TURNO_PENDIENTE` (no tiene esta acción, HU-C-05 AC2); ya `CANCELADO` → `409 TURNO_YA_CANCELADO`.
3. **Guard de vigencia** (R5-6): un turno cuyo `fecha + hora_inicio` ya pasó no se cancela → `409 TURNO_VENCIDO`. Un turno con clase dictada registrada (`spec_modulo_E.md`) siempre está vencido, así que queda protegido por el mismo guard.
4. **Liberación de recursos (AC3): la hace el trigger, no el servicio.** `turno_sincronizar_reservas` (migración `20260924150000_turnos_reservas_recursos_v2`, verificado leyendo el SQL) escucha `UPDATE OF "estadoTurno"`, borra **todas** las reservas del turno (aula, profesor y alumnos) y solo las reinserta si el estado es `DISPONIBLE` o `COMPLETO`. Al pasar a `CANCELADO` quedan liberadas sin código adicional. **No se hace `DELETE` manual sobre `reservas_turno`** (así no hay una segunda vía que mantener). **No** se borra `TurnoAlumno`: el turno conserva sus inscriptos como historial, y `sincronizar_reserva_alumno` no vuelve a reservar a nadie porque el turno ya no está confirmado.
5. Ningún camino sale de `CANCELADO`.
6. Emitir `turno:cancelado` después del `COMMIT`.

**Efectos sobre otras consultas (ya cubiertos por 3.2, sin cambios de código):** un `CANCELADO` desaparece de los calendarios (`spec_modulo_J.md` §3.1) y de las franjas ocupadas de 2.8 y 2.3 (todos filtran `IN ("DISPONIBLE","COMPLETO")`). El listado (2.4) y el detalle **lo siguen mostrando** con la etiqueta "Cancelado" y su historial completo (AC5). `ETIQUETA_ESTADO_TURNO` agrega `CANCELADO → "Cancelado"`.

**Relevado (28/09/2026):** el trigger ya contempla el cambio de estado (ver paso 4); no hace falta migración de triggers. **Pendiente solo la prueba** contra Postgres real, con el patrón de `turno.reservas.pg.test.ts`: cancelar un `DISPONIBLE` y comprobar que aula, profesor y alumnos quedan libres para otro turno superpuesto. Ojo: `ALTER TYPE ... ADD VALUE 'CANCELADO'` va en su propia migración (R5-5); el cuerpo del trigger compara contra literales, así que no hay que recrearlo.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "estado": "CANCELADO" }, "error": null }`

**Fuera de alcance:** cancelación de un turno propio por el alumno (HU-C-14, Sprint 3); motivo de cancelación; notificaciones; reactivar un turno cancelado.

---

### 2.11. Reprogramar un turno (HU-C-06) — NUEVA en Revisión 5

**Ruta:** `PATCH /app/api/turnos/[id]/reprogramacion/route.ts`
**Servicio:** `src/server/turnos/turno.reprogramacion.service.ts` → `reprogramarTurno()`
**Permiso requerido:** `turnos:reprogramar` (exclusivo de Mesa de Entrada)
**Presentación:** `Dialog` en el Detalle de turno con **Fecha** y **Hora de inicio**; toast "Turno reprogramado correctamente".

```typescript
export const ReprogramarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: horaSchema,
}).strict(); // no admite duracion, profesor ni materia (HU-C-06 AC5)
```

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. Bloquear el turno con `SELECT … FOR UPDATE` (mismo patrón que 3.7). Debe existir y estar `DISPONIBLE` o `COMPLETO`: `PENDIENTE` → `409 TURNO_PENDIENTE` (se modifica con 2.1); `CANCELADO` → `409 TURNO_CANCELADO`.
2. **Guard de vigencia** sobre el turno actual (R5-6): `409 TURNO_VENCIDO`. La nueva fecha/hora también debe ser futura.
3. Validaciones de fecha de 2.1 pasos 2, 3, 5 y 6 (no pasada, día operativo, dentro del horario operativo con la duración **ya persistida**, dentro de `ANTICIPACION_MAXIMA_DIAS`, alineada a `GRANULARIDAD_MINUTOS`).
4. **Triple validación (AC2)** contra turnos `DISPONIBLE`/`COMPLETO`, **excluyendo el propio turno** de cada comparación, con la misma fórmula de 3.3:
   - Profesor: `estaDentroDeHorarioAtencion()` y sin superposición.
   - Aula ya asignada: sin superposición.
   - **Cada alumno inscripto**: sin otro turno superpuesto.
   Se evalúan los tres y se informan **todos** los conflictos encontrados: `409 REPROGRAMACION_CONFLICTO` con `conflictos: [{ recurso: "PROFESOR" | "AULA" | "ALUMNO", id }]`. No se guarda nada.
5. `UPDATE` de `fechaTurno` y `horaInicioTurno` (y `modificadoPorUsuarioId`). **Estado, inscripciones, aula, profesor, duración e historial de clases dictadas no cambian** (AC4). El turno conserva `DISPONIBLE` o `COMPLETO`.
6. **Defensa de motor:** `reservas_turno` debe recalcular su rango. Una violación de la exclusión GiST (`23P01`) se traduce al mismo `409 REPROGRAMACION_CONFLICTO`, nunca se propaga como error técnico.
7. Emitir `turno:reprogramado` después del `COMMIT`.

**Relevado (28/09/2026), ya no es bloqueante:** `turno_sincronizar_reservas` escucha `AFTER INSERT OR UPDATE OF "estadoTurno", "fechaTurno", "horaInicioTurno", "duracionMinutosTurno", "profesorId", "aulaId"` y, ante cada cambio, borra las reservas del turno y las regenera con el nuevo intervalo, **incluidas las de los alumnos** (las lee de `turno_alumno`). Reprogramar mueve las reservas sin migración. Para traducir la violación de la exclusión GiST usar los helpers existentes de `turno.reserva-error.ts` (`esConflictoDeReserva`, `recursoEnConflicto`, `errorDeReserva`) en vez de reescribirlos. **Pendiente solo la prueba** contra Postgres real: reprogramar hacia un horario donde el aula, el profesor o un alumno ya están ocupados debe devolver `409 REPROGRAMACION_CONFLICTO` y dejar el turno intacto.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "fecha": "2026-10-06", "hora_inicio": "10:00", "hora_fin": "12:00", "estado": "DISPONIBLE" }, "error": null }`

**Fuera de alcance:** cambiar materia, profesor o duración de un turno confirmado (implicaría reconstruirlo); reprogramar un `PENDIENTE`.

---

### 2.12. Asignar prioridad al turno (HU-C-10) — NUEVA en Revisión 5

**Ruta:** `PATCH /app/api/turnos/[id]/prioridad/route.ts`
**Servicio:** `turno.service.ts` → `actualizarPrioridadTurno()`
**Permiso requerido:** `turnos:priorizar` (exclusivo de Mesa de Entrada)
**Presentación:** `Dialog` en el Detalle de turno; toast "Prioridad actualizada".

```typescript
export const PRIORIDADES_TURNO = ["NORMAL", "ALTA", "URGENTE"] as const;
export const ActualizarPrioridadSchema = z.object({ prioridad: z.enum(PRIORIDADES_TURNO) }).strict();
```

**Comportamiento esperado:**
1. `updateMany` con `where: { idTurno: id, estadoTurno: { not: "CANCELADO" } }` (Regla N.° 7). `count === 0`: `404 TURNO_NO_ENCONTRADO` si no existe, `409 TURNO_CANCELADO` si está cancelado. Disponible en **cualquier otro estado**, incluido `PENDIENTE` y turnos vencidos (AC5, R5-6).
2. Si la prioridad enviada es la que ya tiene: `200` con `sin_cambios: true`, sin escribir ni emitir evento.
3. `Normal` es el valor por defecto al crearse; **no se elige en el wizard** de creación.
4. Cambiar la prioridad **no dispara notificaciones** ni altera el orden por defecto del listado (sigue por fecha/hora) (AC3).
5. Emitir `turno:prioridad_actualizada` con valor anterior y nuevo (AC4).

**Visualización:** el listado (2.4) y el calendario (`spec_modulo_J.md` 2.3) muestran un indicador cuando la prioridad es `ALTA` o `URGENTE`, con **texto o ícono, no solo color**.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "prioridad": "ALTA" }, "error": null }`

---

### 2.13. (RETIRADA) Asociar forma de pago al turno — HU-C-11 fuera del Sprint 2

**Esta sección no tiene contrato.** El backlog v2 del 28/09/2026 **retiró HU-C-11** (Asociar forma de pago al turno). Se conserva el número para no renumerar (`sdd-metodologia.md`). Consecuencias, ya aplicadas en el resto de la spec y en las demás:
- `Turno` **no** lleva `formaPagoId`; no existe ruta `PUT /api/turnos/[id]/forma-pago`, ni el permiso `turnos:forma_pago`, ni el evento `turno:forma_pago_actualizada`, ni el campo `forma_pago` en el listado o el detalle.
- `TurnoAlumno` **no** lleva `createdAtTurnoAlumno` (existía solo para definir "primer alumno inscripto").
- La forma de pago vive únicamente en el **pago** (`spec_modulo_I.md` §2.4): HU-I-01 la pide al registrar y la propone por defecto a partir de la **preferida del alumno que paga** (HU-B-03), sin obligarla.
- HU-I-03 ya no menciona turnos: el catálogo se usa para alumnos (HU-B-03) y pagos (HU-I-01).

---

### 2.14. Autoservicio del alumno: solicitar y consultar turnos propios (HU-C-12, HU-C-13) — NUEVA en Revisión 5

**Aclaración de alcance (propuesta de orden de flujo, §4):** el alumno **no crea turnos**. Se **inscribe en un turno ya existente**, elige Materia → Profesor → Horario entre las combinaciones que ya existen, y **no elige aula** (ya viene con el turno).

**Identidad:** el alumno se resuelve siempre a partir de la sesión: `obtenerAlumnoDeUsuario(session.sub)` (Módulo B, 2.8). Nunca se acepta un `alumno_id` del cliente. Si la cuenta no tiene ficha vinculada: `403 SIN_PERMISO`.

#### 2.14.1. Mis turnos (HU-C-13)

**Ruta:** `GET /app/api/turnos/propios?vista=proximos|anteriores&pagina=&por_pagina=`
**Permiso requerido:** `turnos:leer_propios` (rol ALUMNO)
**Pantalla nueva:** "Mis turnos" (mapa de pantallas §2). Página completa.

1. Los turnos donde el alumno autenticado está inscripto (`TurnoAlumno`), **en cualquier estado, incluido `CANCELADO`** (HU-C-13 AC1 del backlog v2: "el alumno necesita enterarse de que su clase se canceló"). Funciona porque 2.10 **conserva** los `TurnoAlumno` al cancelar.
2. Cada ítem: `fecha`, `hora_inicio`–`hora_fin`, `materia`, `profesor`, `aula`, **`estado`**. **Sin** el dato de alumnos inscriptos (AC2). La UI destaca los `CANCELADO` con texto o ícono, no solo color.
3. **Dos pestañas (definidas por el backlog v2, AC3):** `proximos` (por defecto): `fecha + hora_inicio ≥ ahora`, **cualquier estado** —un `CANCELADO` se ve acá, destacado, mientras su fecha y hora originales no hayan pasado—, orden ascendente. `anteriores`: `fecha + hora_inicio < ahora`, cualquier estado, orden descendente. El pase de una a otra es automático por fecha/hora contra el momento de la consulta: no mueve datos ni requiere proceso de fondo. Paginación server-side en ambas.
4. Sin turnos en la pestaña: `200` con `items: []`; la UI muestra "Todavía no tenés turnos" en Próximos (con acceso directo a HU-C-12) o "No tenés turnos anteriores" en Anteriores (AC4).

#### 2.14.2. Solicitar turno (HU-C-12)

**Pantalla:** "Solicitar turno", **página completa propia** (revisión del 28/09 del mapa de pantallas), accedida desde el botón de "Mis turnos". Tres columnas (Materia / Profesor / Horario), resumen al pie y botón "Inscribirme".
**Permiso requerido:** `turnos:solicitar_propio` (rol ALUMNO)

**Rutas de opciones (solo lectura):** `GET /api/turnos/inscripcion/opciones?materia_id=&profesor_id=`
- Sin parámetros: materias activas que tienen al menos un turno con inscripción abierta.
- Con `materia_id`: profesores que dictan esa materia y tienen al menos un turno con inscripción abierta.
- Con `materia_id` y `profesor_id`: los **horarios**, es decir, los turnos con inscripción abierta de esa combinación, con `turno_id`, fecha, hora, y cupo libre. No se devuelve el aula (AC1) ni datos de otros alumnos.
- **Inscripción abierta** = `estadoTurno = DISPONIBLE`, con `fecha + hora_inicio` futura y `alumnos_inscriptos < cupoMaximoTurno`, y el alumno no inscripto ya.
- Combinación sin turnos: `200` con lista vacía; la UI muestra "No hay turnos disponibles para esta combinación" y ofrece elegir otra materia/profesor (AC2).

**Ruta de inscripción:** `POST /app/api/turnos/[id]/inscripcion/route.ts` (sin body)
**Servicio:** reutiliza el núcleo de 2.5, `inscribirAlumnoEnTurno(turnoId, alumnoId, { origen }, tx)` (no se reimplementa), con `origen: "AUTOSERVICIO"`.

**Comportamiento esperado (dentro de `prisma.$transaction`, con `SELECT … FOR UPDATE` del turno, 3.7):**
1. El turno debe existir y estar `DISPONIBLE`: `COMPLETO` → `409 CUPO_INSUFICIENTE`; `PENDIENTE` o `CANCELADO` → `409 TURNO_NO_DISPONIBLE`. Guard de vigencia: `409 TURNO_VENCIDO`.
2. Alumno activo (`verificarAlumnoActivo()`); ya inscripto: `409 ALUMNO_YA_ASIGNADO`.
3. **Revalidación al confirmar (AC3):** el alumno no tiene otro turno `DISPONIBLE`/`COMPLETO` superpuesto: `409 ALUMNO_NO_DISPONIBLE`, mensaje "Ya tenés otro turno en ese horario". Y el cupo sigue libre (guarda atómica 3.7): `409 CUPO_INSUFICIENTE`.
4. Insertar `TurnoAlumno`. Si `inscriptos + 1 === cupoMaximoTurno`: `DISPONIBLE → COMPLETO` automáticamente (AC5).
5. Emitir `turno:alumno_agregado` con `origen: "AUTOSERVICIO"` y, si hubo transición, `turno:completado`.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "alumnos_inscriptos": "4/5", "estado": "DISPONIBLE" }, "error": null }` — la UI informa "Te inscribiste correctamente" y, junto a ese mensaje, **"El pago se abona en el centro"** (HU-C-12 AC6 del backlog v2: en este sprint la inscripción propia no exige pago previo ni integra pasarela; el pago lo registra Mesa de Entrada con HU-I-01). Banner, porque es página completa.

**Turnos generados (R5-9, resuelto):** los que crea 2.9 nacen `DISPONIBLE` 0/N, así que aparecen en estas opciones desde el primer momento, tal como pide el mapa de pantallas.

**Fuera de alcance:** que el alumno cancele o cambie su inscripción (HU-C-14, Sprint 3), crear turnos, elegir aula, y el cobro online previo (Mercado Pago), que pasa a Sprint 3 porque Noctium no modela precios por materia.

---

### 2.15. Servicios públicos de Turnos para otros módulos (Regla N.° 3) — NUEVA en Revisión 5

Funciones de `src/server/turnos/turno.publico.ts`. Otros módulos las invocan **en lugar de consultar** `turnos`, `turno_alumno` ni `reservas_turno`. No son endpoints ni exigen un permiso `turnos:*`: el control de acceso lo hace la ruta del módulo consumidor. El parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador. **`turno.publico.ts` no importa nada de los demás módulos** (evita el ciclo con `turno.disponibilidad.ts`, ver "Convenciones generales").

| Función | Devuelve | Consumidor |
|---|---|---|
| `bloquearTurnoParaOperacion(turnoId, tx)` | `{ id, estado, fecha, hora_inicio, hora_fin, duracion_min, materia_id, profesor_id, aula_id, alumno_ids, vencido } \| null`, con `SELECT … FOR SHARE` sobre la fila | `spec_modulo_I.md` §2.4 (registrar pago), `spec_modulo_E.md` §2.1 (clase dictada) |
| `obtenerAlumnosInscriptosDeTurno(turnoId, db?)` | `string[]` (ids de `TurnoAlumno`), o `null` si el turno no existe. Solo lectura, sin bloqueo | `spec_modulo_I.md` §2.5 (opciones del modal de pago) |
| `contarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, db?)` | `{ confirmados: number, pendientes: number }`: turnos futuros `DISPONIBLE`/`COMPLETO` (los que **bloquean**) y `PENDIENTE` (solo informativo) | HU-D-07, `spec_modulo_D.md` 2.7 (el **listado** de esos turnos sale de 2.7 de esta spec, no de esta función) |
| `ajustarCuposPorCapacidadDeAula(aulaId, nuevaCapacidad, usuarioId, tx)` | `{ ok: true, turnos_actualizados } \| { ok: false, turnos_en_conflicto, max_inscriptos }` | HU-K-03, `spec_modulo_K.md` 2.4 |
| `contarTurnosPorMes(desde, hasta, db?)` | `{ mes: "YYYY-MM", cantidad }[]`: turnos `DISPONIBLE`/`COMPLETO`/`CANCELADO` agrupados por el mes de `fechaTurno` (**no** de creación); sin ceros | HU-H-01, `spec_modulo_H.md` |

**`ajustarCuposPorCapacidadDeAula` — comportamiento** (dentro del `tx` del llamador, que es la transacción de `modificarAula()`):
1. Seleccionar con `FOR UPDATE`, ordenados por `idTurno` (evita interbloqueos), los turnos **futuros** (`fecha + hora_inicio ≥ ahora`) con ese `aulaId` en estado `PENDIENTE`, `DISPONIBLE` o `COMPLETO`. Los turnos pasados **no bloquean** el cambio ni se modifican.
2. Con la fila bloqueada, contar `TurnoAlumno` de cada uno. Si algún turno `DISPONIBLE`/`COMPLETO` tiene más inscriptos que `nuevaCapacidad`: devolver `{ ok: false, … }` sin escribir (HU-K-03 AC2). El llamador traduce a `409` con el mensaje literal de la HU.
3. Si no hay conflicto: `cupoMaximoTurno = nuevaCapacidad` en todos ellos (mismo criterio de HU-C-15: cupo = capacidad del aula) y **recalcular el estado** (propuesta del SM, **[DEFAULT SM, sin ratificar — Q4]**): `COMPLETO` si `inscriptos ≥ cupo`, `DISPONIBLE` si hay lugar. Un `PENDIENTE` solo actualiza el cupo.
4. Emitir `turno:cupo_actualizado` por turno, y `turno:completado` / `turno:disponible_nuevamente` si hubo transición, **después del `COMMIT` del llamador** (los devuelve para que el llamador los emita).

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

### 3.8. Turnos vencidos: qué se puede y qué no (Revisión 5, R5-6)
Un turno está **vencido** cuando `fecha + hora_inicio` ya pasó (`turnoSigueVigente()`, 2, "Guard de vigencia"). Desde la Revisión 5 el guard `409 TURNO_VENCIDO` se aplica también a **cancelar** (2.10), **reprogramar** (2.11) y **autoinscribirse** (2.14), además de 2.2, 2.3 y 2.5. **No** se aplica a: cambiar prioridad (2.12), registrar un pago (`spec_modulo_I.md` §2.4) ni registrar la clase dictada (`spec_modulo_E.md` §2.1), porque son operaciones que tienen sentido, o son necesarias, después de que la clase ocurrió. Consecuencia útil: un turno con clase dictada registrada nunca puede cancelarse ni reprogramarse. **[DEFAULT SM, sin ratificar — Q5]**

### 3.9. `CANCELADO` es terminal y no reserva nada (Revisión 5)
Ninguna operación de este módulo saca a un turno de `CANCELADO`. Sus `reservas_turno` se eliminan al cancelar (2.10); sus `TurnoAlumno` **se conservan** como historial. Toda consulta de disponibilidad sigue filtrando `estadoTurno IN ("DISPONIBLE","COMPLETO")` (3.2), por lo que `CANCELADO` queda excluido sin cambios de código. Las consultas de **conteo** de `spec_modulo_H.md` sí lo incluyen (HU-H-01 AC2).

### 3.10. Una sola fuente de verdad para "qué tramos están libres" (Revisión 5)
`turno.disponibilidad.ts` expone `calcularTramosLibres(franja, ocupados)` y `iniciosPosibles(tramo, duracion, granularidad)`, funciones puras sobre minutos desde las 00:00. Las usan 2.8 (opciones del wizard), 2.9 (encaje en la franja y conflictos) y 2.11 (validación). Está prohibido reimplementar el cálculo en un componente de frontend: el frontend solo **muestra** lo que devuelve 2.8. La fórmula de superposición sigue siendo `intervalosSeSuperponen()` (3.3, sin cambios).

### 3.11. Búsqueda del listado: excepción documentada a la Regla N.° 3 (Revisión 5, R5-7)
`listarTurnos()` ya lee de otros módulos, por relaciones de Prisma, los datos que muestra (profesor, materia, aula, alumnos). La búsqueda de 2.7 filtra por las **columnas normalizadas** de esas mismas relaciones (`apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, `apellidoNormalizadoProfesor`, `nombreNormalizadoProfesor`, `nombreNormalizadaMateria`, `nombreNormalizadaAula`). Se documenta como **excepción de solo lectura**, en vez de crear cuatro servicios públicos que devuelvan listas de ids potencialmente enormes para un patrón de 2 letras. Si en Sprint 3 se agregan filtros combinados (HU-C-02 AC6), se reevalúa mover el filtro a servicios públicos. La excepción **no** se extiende a escrituras.

### 3.12. Generación masiva: todo o nada, y con reserva desde el `INSERT` (Revisión 5, R5-8 y R5-9)
La generación de 2.9 nunca crea turnos parciales. Como los turnos generados nacen `DISPONIBLE` (backlog v2), el trigger `turno_sincronizar_reservas` reserva profesor y aula en cada `INSERT`, y la exclusión GiST es la defensa final contra dos corridas simultáneas o contra un turno creado por otra vía entre el cálculo y la inserción. **No se usa advisory lock.** La vista previa es solo informativa: la confirmación recalcula todo dentro de su transacción y **nunca** confía en ella. Esta es la **única** ruta por la que un turno se crea directamente `DISPONIBLE`; cualquier otra sigue el camino `PENDIENTE` → 2.2.

### 3.13. Excepciones documentadas a las Reglas N.° 1 y N.° 8 (Revisión 5)
- **Regla N.° 1 (sin `DELETE`):** se eliminan filas de `reservas_turno` al cancelar (2.10) y se elimina el vínculo `ProfesorMateria` al quitar una materia (HU-D-07). Ambas son tablas de proyección o asociación, no entidades de dominio (mismo criterio que la baja de `TurnoAlumno` en 2.5). El `Turno` nunca se borra: se cancela.
- **Regla N.° 8 (inmutabilidad):** el pago y el historial académico son registros de hecho consumado y **no viven en este módulo**; ver `spec_modulo_I.md` §3.6 y `spec_modulo_E.md` §3.1. `Turno` no es un registro de hecho consumado (se reprograma, se cancela).

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
| `turno:cancelado` | Cancelación (2.10) | `turno_id, estado_anterior, profesor_id, aula_id, alumno_ids, usuario_id` |
| `turno:reprogramado` | Reprogramación (2.11) | `turno_id, fecha_anterior, hora_inicio_anterior, fecha_nueva, hora_inicio_nueva, hora_fin_nueva, usuario_id` |
| `turno:prioridad_actualizada` | Cambio de prioridad (2.12) | `turno_id, prioridad_anterior, prioridad_nueva, usuario_id` |
| `turno:cupo_actualizado` | Cambio de capacidad del aula (2.15, HU-K-03) | `turno_id, aula_id, cupo_anterior, cupo_nuevo, usuario_id` |
| `turno:alumno_agregado` (ampliado) | 2.5 y autoinscripción (2.14) | agrega `origen: "MESA_ENTRADA" \| "AUTOSERVICIO"` al payload existente |
| `turno:configurado` (ampliado) | 2.1 y generación masiva (2.9) | agrega `profesor_id` y, si viene de 2.9, `generacion_id` |
| `turno:aula_asignada` (ampliado) | 2.3 y 2.9 | sin cambios de payload; 2.9 lo emite por cada turno generado |

**Revisión 5 — trazabilidad (Regla N.° 2).** Todas las mutaciones nuevas del módulo usan la opción (b): `emitirEventoTurno()` → `eventos_turno`, después del `COMMIT`. `eventos_turno.turnoId` es obligatorio, por eso la generación masiva (2.9) emite eventos por turno y no uno global; el `generacion_id` en el payload los agrupa. Además, la fila `Turno` ya guarda `modificadoPorUsuarioId` y `updatedAtTurno`, que 2.10 a 2.13 actualizan en la misma operación. Los pagos y el historial académico **no** viven en este módulo (`spec_modulo_I.md`, `spec_modulo_E.md`).

---

## Parámetros configurables (referencia)

| Parámetro | Usado en |
|---|---|
| `DURACIONES_PERMITIDAS_TURNO_MIN` | **Revisión 4 — reemplaza a `DURACION_ESTANDAR_TURNO_MIN`** (que en el código real era la fila `duracion_turno_estandar_minutos` de `ParametroSistema`, ya no leída ni sembrada). Lista de valores permitidos, `[60, 120, 180]`. **Constante en código** (`src/server/turnos/turno.schema.ts`), **no fila de `ParametroSistema`** (R4-1): cambiar el conjunto requiere una nueva aprobación del PO. El frontend la recibe vía `GET /api/turnos/configuracion` (`parametros.duraciones_permitidas_minutos`). 2.1 — cálculo de `hora_fin`, validación de `duracion_min` (schema Zod + revalidación en el servicio, `DURACION_NO_PERMITIDA`) || `GRANULARIDAD_MINUTOS` | 2.1 — validación de `hora_inicio` |
| `DIAS_OPERATIVOS` | 2.1 — día válido para configurar |
| `HORA_APERTURA` / `HORA_CIERRE` | 2.1 — horario operativo del centro |
| `ANTICIPACION_MAXIMA_DIAS` | 2.1 — tope de anticipación para configurar un turno |
| `generacion_maxima_dias` | **Revisión 5 — nuevo, fila de `ParametroSistema`.** Amplitud máxima (`fecha_hasta − fecha_desde`) de una generación masiva, en días. Valor propuesto: `150` (≈ un cuatrimestre). 2.9. **[DEFAULT SM, sin ratificar — Q3]** |
| `generacion_maxima_turnos` | **Revisión 5 — nuevo, fila de `ParametroSistema`.** Tope de turnos creados por corrida de 2.9. Valor propuesto: `40`. **[DEFAULT SM, sin ratificar — Q3]** |
| `anticipacion_maxima_dias` (nombre real en `ParametroSistema`; `ANTICIPACION_MAXIMA_DIAS` en esta spec) | 2.1, 2.8 y 2.11. Valor de seed: `30`. **No** aplica a 2.9 (R5-8) |
| `granularidad_turno_minutos` (`GRANULARIDAD_MINUTOS`) | 2.1, 2.8, 2.9, 2.11. Valor de seed: `30` |