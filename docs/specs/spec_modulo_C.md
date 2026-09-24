```markdown
# Especificación Técnica — Módulo C (Turno)
## Noctium — Sprint 1 (Revisión 2)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker, extensión `btree_gist` prevista pero aún no migrada — ver nota en 3.4) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (Alumno) · `spec_modulo_D.md` (Profesor, fórmula de superposición §3.4) · `spec_modulo_K.md` (Aulas) · `schema.prisma` · `docs/tasks/Sprint 1/`

**HU contractualizadas en esta revisión:** HU-C-03 (Configurar turno — **implementada**, ver `docs/tasks/Sprint 1/HU-C-03.md`), HU-C-04 (Asignar profesor y alumnos / gestionar inscripciones), HU-C-15 (Asignar aula), HU-C-01 (Listar turnos) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Cancelación de un turno, en cualquier estado (`PENDIENTE`, `DISPONIBLE` o `COMPLETO`).
- Modificación de fecha/hora de un turno que ya no está `PENDIENTE`.
- Reemplazo del aula de un turno `DISPONIBLE` o `COMPLETO` (el reemplazo de aula solo aplica mientras el turno es `PENDIENTE`, ver 2.3).
- Sugerencia automática de franjas disponibles: la fecha/hora se elige manualmente este sprint.
- Búsqueda avanzada / filtros combinados en el listado (HU-C-01 §7 lo excluye explícitamente).
- Quitar un alumno individual mientras el turno está `PENDIENTE` — mientras el turno no tiene aula, cualquier cambio en los alumnos se resuelve reemplazando el conjunto completo (2.2), no dando de baja uno solo (la baja individual, 2.5, solo existe a partir de `DISPONIBLE`/`COMPLETO`). Ver **DECISIÓN RESUELTA** al pie de 2.5.

---

## ⚠️ Gap crítico descubierto en relevamiento (HU-C-03, 24/09) — pendiente de resolución en HU-C-15

El relevamiento previo a implementar HU-C-03 confirmó contra la base real que **los *exclusion constraints* de la sección 3.4 nunca se migraron**. Lo único que existe hoy en la base sobre `turnos` es el `CREATE TYPE "EstadoTurno"` — no hay extensión `btree_gist`, no hay ningún `EXCLUDE USING gist`. Esto significa que la "defensa atómica final" que las secciones 3.4 y 3.6 describen como ya vigente **nunca estuvo en producción**, en ningún momento del proyecto (ni siquiera bajo el contrato de 2 estados de la Revisión 1). Hoy la única protección contra condiciones de carrera al agendar es la validación aplicativa (2.2 paso 5, 2.3 pasos 3 y 5), que la propia spec ya califica como "de buena fe, no la garantía atómica final" — pero en los hechos, esa garantía atómica final no existe todavía en ningún lado.

No es bloqueante para HU-C-03 (no toca esta capa) ni se resolvió en esta revisión. **Queda contractualizado como punto obligatorio de relevamiento para HU-C-15**, que es la HU que efectivamente depende de esta defensa para la transición a `DISPONIBLE`/`COMPLETO`. Cuando se resuelva, actualizar esta nota a "DECISIÓN RESUELTA" con el resultado.

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

**Decisión de equipo, a partir de definición del PO (no relevar de nuevo):** el valor de enum `AGENDADO` se **reemplaza** por `DISPONIBLE` y `COMPLETO` (no se agrega como un cuarto estado). Como el proyecto está en Sprint 1 sin datos productivos, la migración de Prisma se aplica vía reseteo del entorno de desarrollo (`prisma migrate reset`), no vía migración de datos con `ALTER TYPE`. **Aplicado 24/09** (`prisma migrate reset --force`, consentimiento explícito del Scrum Master documentado en la conversación de la task).

**DECISIÓN RESUELTA (HU-C-03, no relevar de nuevo):** el reemplazo del enum se aplicó en HU-C-03 (no se pospuso a HU-C-15), porque es una columna compartida y posponerlo solo trasladaba el mismo trabajo de compilación forzada. Esto obligó a tocar, en la misma task, archivos fuera de `src/server/turnos/`: `src/server/calendario/calendario.service.ts` (filtro `estadoTurno`, Regla de negocio 3.2 — un turno pendiente no aparece en calendarios), su test, `src/types/calendario.types.ts`, `src/components/shared/evento-calendario.tsx`, y `prisma/seed.ts` (turnos de seed quedaron con `cupoMaximoTurno` y distribuidos en los 3 estados: 1 pendiente, 6 disponibles, 4 completos, para poder verificarlos visualmente).

---

## 1. Visión General

El Módulo C es el núcleo operativo del sistema: gestiona el ciclo de vida de un `Turno` desde su configuración inicial hasta quedar completamente reservado y, opcionalmente, completo de inscripciones. Es una **máquina de tres estados**:

```
PENDIENTE ──(asignar profesor + alumnos, HU-C-04, 2.2)──▶ sigue PENDIENTE (aún sin aula)
PENDIENTE ──(asignar aula, con profesor+≥1 alumno+cupo válidos, HU-C-15, 2.3)──▶ DISPONIBLE o COMPLETO
DISPONIBLE ──(una inscripción alcanza el cupo máximo, HU-C-04, 2.5)──▶ COMPLETO
COMPLETO ──(se libera un lugar, HU-C-04, 2.5)──▶ DISPONIBLE
```

No existe ningún camino de vuelta a `PENDIENTE` una vez que el turno tiene aula — esa parte de la máquina de estados sigue sin reversión, igual que en la Revisión 1. Lo que sí es reversible, y automático, es la alternancia `DISPONIBLE ⇄ COMPLETO` según la cantidad de alumnos inscriptos activos comparada contra `cupoMaximoTurno`.

**Regla central que atraviesa todo el módulo:** *un turno `PENDIENTE` no reserva ningún recurso.* Dos turnos `PENDIENTE` pueden compartir el mismo profesor, alumno o aula en el mismo horario sin que eso sea un conflicto — el conflicto solo existe entre turnos `DISPONIBLE` o `COMPLETO`. Esto se traduce técnicamente en que toda validación de disponibilidad (secciones 2.2, 2.3 y 2.5) consulta exclusivamente turnos con `estadoTurno IN ("DISPONIBLE", "COMPLETO")`. **La defensa de esta regla a nivel de motor de base de datos (sección 3.4) está descripta pero no implementada — ver aviso al inicio del documento; hoy la regla se sostiene únicamente por la validación aplicativa.**

**Modelo de referencia** (`model Turno` en `schema.prisma`, migrado y verificado en base real): `idTurno`, `fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno`, `materiaId` (NOT NULL), `profesorId` (nullable), `aulaId` (nullable), **`cupoMaximoTurno` (NOT NULL, entero > 0, tope `2147483647`)**, `estadoTurno` — `PENDIENTE` | `DISPONIBLE` | `COMPLETO`, `createdAtTurno`, `creadoPorUsuarioId`. Un turno tiene **a lo sumo** un profesor (FK simple `profesorId`) y **uno o varios** alumnos, hasta `cupoMaximoTurno`, vía la tabla intermedia `TurnoAlumno` (N:M) — a diferencia de la Revisión 1, esta relación deja de ser transitoria: es el modelo definitivo de Sprint 1 (el comentario del schema sobre "etapa futura" ya fue actualizado en la migración de HU-C-03).

**Servicios públicos consumidos de otros módulos** (Regla N.° 3 de aislamiento — este módulo nunca hace `SELECT`/`UPDATE` directo sobre tablas de Alumno, Profesor, Materia o Aula):
- `verificarMateriaActiva(materiaId)` — Módulo L.
- `verificarAlumnoActivo(alumnoId)`, `buscarAlumnosActivos(query)` — Módulo B.
- `listarProfesoresActivosPorMateria(materiaId)`, `profesorActivoDictaMateria(profesorId, materiaId)`, `estaDentroDeHorarioAtencion(profesorId, fecha, horaInicio, horaFin)` — Módulo D.
- `verificarAulaActiva(aulaId)` — Módulo K.

**Nota de trazabilidad (gap sin resolver, sin cambios respecto a Revisión 1):** `buscarAlumnosActivos()` (búsqueda parcial por nombre/apellido/DNI, ahora usada también para agregar alumnos de a uno vía 2.5) sigue sin estar contractualizada en `spec_modulo_B.md` (HU-B-04 la excluye explícitamente). Se documenta acá solo como contrato consumido, no se implementa su lógica dentro de este módulo.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores persistidos de `Turno`, `Materia`, `Alumno`, `Profesor` y `Aula` son CUID según `schema.prisma`.
- **Ubicación de archivos (Regla N.° 11):** tipos de dominio en `src/types/turno.types.ts`; capa de servicios en `src/server/turnos/turno.service.ts` (con `turno.schema.ts` y `turno.validaciones.ts` como colaboradores del mismo módulo); Route Handlers en `app/api/turnos/**/route.ts` (no le aplica la Regla N.° 11, que solo rige tipos/actions/services). **Server Actions (`src/server/turnos/actions.ts`): no implementadas — ver nota de sincronización en el changelog.** El frontend de Turno llama directamente a los Route Handlers.
- Toda ruta requiere `withPermission("turnos:<accion>")` (Regla N.° 10): `turnos:crear` (configurar y modificar configuración), `turnos:asignar_participantes` (asignación inicial y alta/baja individual de alumnos, HU-C-04), `turnos:asignar_aula`, `turnos:leer` — todas exclusivas de Mesa de Entrada salvo `turnos:leer`, disponible también para Gerente y Profesor (este último acotado a sus propios turnos, ya implementado en `listarTurnos`/`obtenerTurno`). Confirmado en relevamiento de HU-C-03: la matriz no cambia.
- **Guard de vigencia (reutilizado por 2.2 y 2.3, no reimplementado por separado):** toda operación sobre un turno `PENDIENTE` revalida que `fechaTurno + horaInicioTurno` siga siendo un momento futuro (`turnoSigueVigente()`, ya implementada en `turno.validaciones.ts`). Si ya pasó: `409 TURNO_VENCIDO`, exige corregir la configuración (2.1) antes de continuar.
- **Guard de estado no-pendiente (nuevo):** toda validación de disponibilidad (profesor, alumno, aula) contra "turnos ya reservados" filtra `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` en vez de `estadoTurno: "AGENDADO"`.
- **Etiquetas de texto del estado** (`ETIQUETA_ESTADO_TURNO` en `src/types/turno.types.ts`, agregado en HU-C-03): `PENDIENTE → "Pendiente"`, `DISPONIBLE → "Disponible"`, `COMPLETO → "Completo"`. Usado en `turnos-listado.tsx` y `turno-detalle.tsx`; el resto del diseño visual del listado (badge, columna `alumnos_inscriptos`) sigue siendo responsabilidad de HU-C-01.

---

### 2.1. Configurar turno (HU-C-03) — IMPLEMENTADA

**Ruta (alta):** `POST /app/api/turnos/route.ts`
**Ruta (modificación, mientras `PENDIENTE`):** `PATCH /app/api/turnos/[id]/configuracion/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` → `configurarTurno()` / `modificarConfiguracionTurno()`
**Permiso requerido:** `turnos:crear`

```typescript
// src/server/turnos/turno.schema.ts
export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,          // utilidad compartida, spec_modulo_B.md §2.1
  hora_inicio: horaSchema,                     // utilidad compartida, spec_modulo_D.md §2.4
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  cupo_maximo: z.number().int().positive("El cupo máximo debe ser un número entero mayor que cero")
    // Tope agregado durante la implementación: sin él, un valor mayor rompía
    // la columna INTEGER de Postgres con un 500 en vez de un 400 controlado.
    .max(2147483647, "El cupo máximo excede el límite permitido"),
});
export type ConfigurarTurnoInput = z.infer<typeof ConfigurarTurnoSchema>;
```

**Comportamiento esperado (`configurarTurno` / `modificarConfiguracionTurno`), sin cambios de fondo respecto a Revisión 1 salvo lo marcado:**
1. Verificar `materia_id` activa (`verificarMateriaActiva()`). Si no hay materias activas en el sistema, el frontend lo indica antes de mostrar el formulario ("No hay materias activas para configurar turnos"); si igualmente se envía una inactiva: `409 MATERIA_NO_DISPONIBLE`.
2. Validar que `fecha` no sea pasada; si `fecha` es hoy, `hora_inicio` debe ser posterior a la hora actual.
3. Validar día operativo del centro (`DIAS_OPERATIVOS`).
4. Calcular `hora_fin = hora_inicio + DURACION_ESTANDAR_TURNO_MIN`. `hora_fin` nunca es editable por el cliente.
5. Validar `[hora_inicio, hora_fin)` completamente contenido en el horario operativo (`HORA_APERTURA`, `HORA_CIERRE`).
6. Validar que `fecha` no supere `ANTICIPACION_MAXIMA_DIAS`.
7. **Alta:** insertar con `estadoTurno: "PENDIENTE"`, `profesorId: null`, `aulaId: null`, `cupoMaximoTurno` recibido, sin alumnos vinculados. Un turno `PENDIENTE` recién creado no aparece en ningún calendario y no reserva ningún recurso.
8. **Modificación** (solo si `estadoTurno === "PENDIENTE"`; si ya es `DISPONIBLE`/`COMPLETO`, `409 TURNO_YA_DISPONIBLE` — antes `TURNO_YA_AGENDADO`, código renombrado en los 4 lugares donde aparecía: `turno.service.ts` en `modificarConfiguracionTurno` y en `asignarParticipantesTurno`, el mapeo a `409` de `[id]/configuracion/route.ts`, y el test `turno.participantes.test.ts`): si cambia `materia_id` y el turno ya tiene `profesorId`, verificar que ese profesor siga asociado a la nueva materia (`profesorActivoDictaMateria`); si no, desasignarlo automáticamente e informar cuál dato debe reasignarse. `cupo_maximo` también puede modificarse mientras `PENDIENTE`; si el nuevo valor es menor a la cantidad de alumnos ya cargados en esta fase, `409 CUPO_MENOR_A_INSCRIPTOS` (ver 3.7 para el patrón de verificación, implementado por conteo previo al `updateMany`, sin `FOR UPDATE`).
9. Emitir `turno:configurado` o `turno:configuracion_modificada` (sección 4), vía `emitirEventoTurno()` (`prisma.eventoTurno.create`), verificado en `eventos_turno`.

**Respuesta `201 Created` (alta):**
```json
{ "data": { "id": "cuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "11:00", "cupo_maximo": 5, "estado": "PENDIENTE" }, "error": null }
```

**Verificación pendiente (Scrum Master, en navegador):** comportamiento visual del error inline del campo "Cupo máximo" (vacío, `0`, `2.5`), que el formulario de modificación precargue el `cupo_maximo` actual, y que Cancelar no cree registros ni pierda los demás valores del formulario — ver `docs/tasks/Sprint 1/HU-C-03.md` §8 para el detalle completo.

---

### 2.2. Asignar profesor y alumnos al turno — carga inicial (HU-C-04)

Esta operación es el **combo inicial**: carga profesor + el conjunto completo de alumnos de una sola vez, y solo existe mientras el turno está `PENDIENTE`. Para agregar o quitar un alumno de a uno una vez que el turno ya tiene aula, ver **2.5** (nueva).

**Ruta:** `PATCH /app/api/turnos/[id]/participantes/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` → `asignarParticipantesTurno()` — **firma cambia de `(turnoId, { alumno_id, profesor_id })` a `(turnoId, { alumno_ids, profesor_id })`** (esta HU-C-04 completa; HU-C-03 solo tocó el filtro de estado y el código de error de esta función para que compilara con el nuevo enum, sin cambiar la firma — ese cambio sigue pendiente)

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
1. Leer el `Turno`; debe existir y estar `PENDIENTE` (si ya `DISPONIBLE`/`COMPLETO`: `409 TURNO_YA_DISPONIBLE`). Aplicar el guard de vigencia (`turnoSigueVigente`).
2. **NUEVO:** validar `alumno_ids.length <= turno.cupoMaximoTurno`. Si excede: `409 CUPO_INSUFICIENTE`, "El turno alcanzó su cupo máximo" (HU-C-04 criterio 5) — se informa sin persistir nada.
3. Verificar cada `alumno_id` activo (`verificarAlumnoActivo()`). Ante cualquier alumno inválido, se informa cuál.
4. Verificar `profesor_id` activo y asociado a `turno.materiaId` (`listarProfesoresActivosPorMateria()`). Si no hay ninguno: `404 SIN_PROFESORES_PARA_MATERIA`.
5. **Validación de disponibilidad (aplicativa, contra turnos `DISPONIBLE`/`COMPLETO` únicamente — antes filtraba `estadoTurno: "AGENDADO"`):**
   - Profesor: intervalo del turno contenido en su horario de atención (`estaDentroDeHorarioAtencion`), y sin superposición con otro turno `DISPONIBLE`/`COMPLETO` de ese profesor (fórmula de `spec_modulo_D.md` §3.4, ya implementada en `intervalosSeSuperponen`).
   - Cada alumno de `alumno_ids`: no debe tener otro turno `DISPONIBLE`/`COMPLETO` que se superponga con el mismo intervalo (HU-C-04 criterio 4). Si cualquiera falla, se identifica cuál.
   - Si hay conflicto: `409`, identificando el recurso puntual. El turno conserva su estado y valores anteriores.
6. **Nota sobre el alcance real de esta revalidación:** como un turno `PENDIENTE` no reserva recursos, esta validación es de buena fe contra el estado actual — no hay, hoy, una garantía atómica final de motor que la respalde (ver aviso al inicio del documento); la única protección adicional es el `updateMany` condicionado del paso 7 y, para el caso de alumno individual, el conteo previo de 3.7.
7. `updateMany` del `profesorId` (`where: { idTurno: turnoId, estadoTurno: "PENDIENTE" }`, `count === 0` ⇒ `409 TURNO_MODIFICADO`), luego `deleteMany` de `TurnoAlumno` del turno y `createMany` con el nuevo conjunto de `alumno_ids` (**cambia de `create` de un único registro a `createMany`**). El turno permanece `PENDIENTE`.
8. Mientras el turno siga `PENDIENTE`, este mismo endpoint permite **reemplazar** el combo completo (profesor y/o el conjunto de alumnos) las veces que haga falta.
9. Emitir `turno:participantes_asignados` con el arreglo completo de `alumno_ids` en el payload (antes llevaba `alumno_id` singular).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "alumno_ids": ["cuid1", "cuid2"], "profesor_id": "cuid", "cupo_maximo": 5, "estado": "PENDIENTE" }, "error": null }
```

**Respuesta `409 Conflict` (cupo insuficiente para el combo):**
```json
{ "data": null, "error": { "code": "CUPO_INSUFICIENTE", "message": "El turno alcanzó su cupo máximo" } }
```

---

### 2.3. Asignar aula al turno — transición a Disponible o Completo (HU-C-15)

**Ruta:** `PATCH /app/api/turnos/[id]/aula/route.ts`
**Permiso requerido:** `turnos:asignar_aula`

```typescript
export const AsignarAulaTurnoSchema = z.object({
  aula_id: z.string().cuid(),
});
export type AsignarAulaTurnoInput = z.infer<typeof AsignarAulaTurnoSchema>;
```

**Comportamiento esperado, íntegramente dentro de una única `prisma.$transaction`:**
1. Leer el `Turno` con conteo de alumnos ya inscriptos; debe existir. Si ya es `DISPONIBLE`/`COMPLETO`: `409 TURNO_YA_DISPONIBLE`. Aplicar el guard de vigencia.
2. Verificar `aula_id` activa (`verificarAulaActiva()`). Si no hay aulas activas: `404 SIN_AULAS_ACTIVAS`, el turno permanece `PENDIENTE` sin cambios.
3. **Validación de disponibilidad del aula** (contra turnos `DISPONIBLE`/`COMPLETO` únicamente). Si hay conflicto: `409 AULA_NO_DISPONIBLE`, el turno permanece sin cambios.
4. Actualizar `aula_id` (`updateMany` con `where: { idTurno, estadoTurno: "PENDIENTE" }`).
5. **Evaluar la transición:** si el turno ahora tiene `materiaId`, `profesorId`, `aulaId` presentes y **al menos un alumno** inscripto, y sigue vigente:
   - Revalidar, en esta misma transacción, la disponibilidad de profesor, cada alumno y aula contra turnos `DISPONIBLE`/`COMPLETO`.
   - Si todo sigue disponible: calcular `nuevoEstado = alumnos.length >= cupoMaximoTurno ? "COMPLETO" : "DISPONIBLE"` y `UPDATE turno SET estadoTurno = nuevoEstado WHERE idTurno = turnoId AND estadoTurno = "PENDIENTE"`.
   - Si algún recurso dejó de estar disponible: la transacción completa revierte.
   - Si no se cumplen todas las precondiciones (falta profesor, o cero alumnos): el `aula_id` sí queda guardado, el turno permanece `PENDIENTE`.
6. **Defensa atómica final (sección 3.4):** en el diseño, el `UPDATE` a `estadoTurno IN ('DISPONIBLE','COMPLETO')` debería estar protegido por *exclusion constraints* de Postgres — **pendiente de migrar, ver aviso al inicio del documento; esta HU debe resolver esa migración antes de considerar cerrado este punto.**
7. Emitir `turno:aula_asignada` y, si la transición ocurrió, `turno:disponibilizado` o `turno:completado` según `nuevoEstado`, ambos después del `COMMIT`.
8. **Reemplazo de aula mientras sigue `PENDIENTE`:** si el turno no alcanzó a transicionar, este mismo endpoint permite reemplazar el `aula_id` las veces que haga falta.

**Respuestas `200 OK`:**
```json
{ "data": { "id": "cuid", "aula_id": "cuid", "estado": "COMPLETO" }, "error": null }
```
```json
{ "data": { "id": "cuid", "aula_id": "cuid", "estado": "DISPONIBLE" }, "error": null }
```
```json
{ "data": { "id": "cuid", "aula_id": "cuid", "estado": "PENDIENTE" }, "error": null }
```

---

### 2.4. Listado y detalle de turnos (HU-C-01)

**Ruta (listado):** `GET /app/api/turnos/route.ts` · **Ruta (detalle):** `GET /app/api/turnos/[id]/route.ts`
**Servicio:** `src/server/turnos/turno.service.ts` → `listarTurnos()` / `obtenerTurno()` (ya implementadas, ver función `presentar()`)
**Permiso requerido:** `turnos:leer`

**Comportamiento esperado (cambia el presentador `presentar()`):**
- Incluye turnos en los 3 estados. Cada ítem: `fecha`, `hora_inicio`–`hora_fin`, **`alumnos_inscriptos`** (`"3/5"`, ocupación sobre `cupoMaximoTurno` — reemplaza el campo `alumno`/`alumnos` de nombres de Revisión 1), `profesor` (`"Apellido, Nombre"` o `"Sin asignar"`), `materia`, `aula` (ídem o `"Sin asignar"`), `estado` (texto: `Pendiente` | `Disponible` | `Completo`, ya disponible vía `ETIQUETA_ESTADO_TURNO`, adelantado por HU-C-03). **Nota:** HU-C-03 ya agregó `cupo_maximo` al `presentar()` (para precargar el formulario de modificación) y lo mostró también en el detalle del turno; `alumnos_inscriptos` en sí sigue pendiente de esta HU-C-01.
- Orden por defecto: `fecha, hora_inicio` ascendente desde la fecha actual en adelante; `profesor_id` como segundo criterio de desempate — sin cambios respecto a `listarTurnos()` actual.
- Los turnos `PENDIENTE` se distinguen con la etiqueta "Pendiente" y ofrecen continuar su configuración (2.2 o 2.3, según qué les falte).
- Paginación server-side con metadatos, sin cambios respecto a lo ya implementado.
- El detalle sigue mostrando el listado completo de alumnos inscriptos (`turno.alumnos`, ya incluido en `turnoInclude`), no solo la ocupación.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumnos_inscriptos": "3/5", "profesor": "Gómez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "DISPONIBLE" },
      { "id": "cuid", "fecha": "2026-04-11", "hora_inicio": "14:00", "hora_fin": "15:00",
        "alumnos_inscriptos": "0/3", "profesor": "Sin asignar", "materia": "Física", "aula": "Sin asignar", "estado": "PENDIENTE" }
    ],
    "paginacion": { "total": 15, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

---

### 2.5. Agregar o quitar un alumno individual (HU-C-04, ampliación) — NUEVO

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
1. Leer el `Turno` con lock de fila (ver 3.7); debe existir y estar `DISPONIBLE` (si `PENDIENTE`: `409 TURNO_PENDIENTE`, usar 2.2; si `COMPLETO`: `409 CUPO_INSUFICIENTE`).
2. Verificar `alumno_id` activo.
3. Verificar que no esté ya en el turno: `409 ALUMNO_YA_ASIGNADO`.
4. Verificar disponibilidad del alumno contra otros turnos `DISPONIBLE`/`COMPLETO` superpuestos: `409 ALUMNO_NO_DISPONIBLE`.
5. **Guarda de cupo atómica (3.7):** con la fila ya bloqueada en el paso 1, contar `TurnoAlumno` actuales; si `count >= cupoMaximoTurno`, `409 CUPO_INSUFICIENTE`.
6. Insertar `TurnoAlumno`.
7. Si `count + 1 === cupoMaximoTurno`: `UPDATE turno SET estadoTurno = 'COMPLETO' WHERE idTurno = turnoId AND estadoTurno = 'DISPONIBLE'`.
8. Emitir `turno:alumno_agregado` y, si hubo transición, `turno:completado`.

**Comportamiento esperado — quitar:**
1. Leer el `Turno` con lock de fila; debe existir y estar `DISPONIBLE` o `COMPLETO` (si `PENDIENTE`: `409 TURNO_PENDIENTE`).
2. Eliminar el `TurnoAlumno` correspondiente (baja física de la fila intermedia — no aplica Regla N.° 1 de `RULES.md`, que protege entidades de dominio como `Turno`, no vínculos de inscripción). Si no existía: `404 ALUMNO_NO_ASIGNADO`.
3. Si el turno estaba `COMPLETO`: `UPDATE turno SET estadoTurno = 'DISPONIBLE' WHERE idTurno = turnoId AND estadoTurno = 'COMPLETO'`.
4. Emitir `turno:alumno_quitado` y, si hubo transición, `turno:disponible_nuevamente`.

**Respuesta `200 OK` (agregar, sin alcanzar cupo):**
```json
{ "data": { "id": "cuid", "alumnos_inscriptos": "4/5", "estado": "DISPONIBLE" }, "error": null }
```

**Respuesta `409 Conflict` (cupo alcanzado):**
```json
{ "data": null, "error": { "code": "CUPO_INSUFICIENTE", "message": "El turno alcanzó su cupo máximo" } }
```

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `src/server/turnos/turno.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Máquina de tres estados
`PENDIENTE → {DISPONIBLE, COMPLETO}` es la única transición de salida de `PENDIENTE`, sin reversión. `DISPONIBLE ⇄ COMPLETO` sí es reversible y automático, gobernado exclusivamente por la comparación entre la cantidad de alumnos inscriptos y `cupoMaximoTurno` (2.5). Ningún endpoint permite fijar `COMPLETO` o `DISPONIBLE` manualmente.

### 3.2. Un turno `PENDIENTE` nunca reserva recursos
Toda consulta de disponibilidad (2.2 paso 5, 2.3 pasos 3 y 5, 2.5 paso 4) filtra explícitamente `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }`. Esta regla también rige fuera del módulo: `src/server/calendario/calendario.service.ts` filtra por el mismo criterio para no mostrar turnos pendientes (migrado en HU-C-03, verificado con curl + test del filtro).

### 3.3. Fórmula de superposición reutilizada, no reimplementada
Sin cambios respecto a Revisión 1: intervalos semiabiertos (`a1 < b2 AND b1 < a2`), definida en `spec_modulo_D.md` §3.4, ya implementada en `intervalosSeSuperponen()`.

### 3.4. Defensa de concurrencia: *exclusion constraints* de Postgres (extensión `btree_gist`) — DISEÑO PENDIENTE DE MIGRAR

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "turnos" ADD CONSTRAINT turno_profesor_sin_superposicion
  EXCLUDE USING gist (
    "profesorId" WITH =,
    tsrange("fechaTurno" + "horaInicioTurno", "fechaTurno" + "horaInicioTurno" + ("duracionMinutosTurno" || ' minutes')::interval) WITH &&
  ) WHERE ("estadoTurno" IN ('DISPONIBLE', 'COMPLETO'));

ALTER TABLE "turnos" ADD CONSTRAINT turno_aula_sin_superposicion
  EXCLUDE USING gist (
    "aulaId" WITH =,
    tsrange("fechaTurno" + "horaInicioTurno", "fechaTurno" + "horaInicioTurno" + ("duracionMinutosTurno" || ' minutes')::interval) WITH &&
  ) WHERE ("estadoTurno" IN ('DISPONIBLE', 'COMPLETO'));
```

> **Estado real (confirmado en relevamiento de HU-C-03, 24/09):** ninguna de estas constraints existe en la base — ni siquiera la versión de Revisión 1 (`WHERE (estado = 'AGENDADO')`) llegó a migrarse. Esto es una omisión previa a esta revisión, no algo que HU-C-03 rompa. **Relevar y resolver como parte de HU-C-15** (ver aviso al inicio del documento).
>
> **Nota adicional (cambio de diseño respecto a Revisión 1):** el constraint de superposición por **alumno** (`turno_alumno_sin_superposicion`) ya no puede vivir sobre la tabla `turnos` (un turno ahora tiene varios alumnos, no una columna `alumnoId`). Trasladar la protección a `turno_alumno` requiere desnormalizar `fechaTurno`/`horaInicioTurno`/`duracionMinutosTurno` en esa tabla intermedia (un exclusion constraint no puede hacer join) o resolverlo con un trigger que valide contra `turnos` al insertar — **relevar antes de asumir con el equipo cuál de las dos, junto con la migración pendiente de arriba.**

La cláusula `WHERE ("estadoTurno" IN ('DISPONIBLE', 'COMPLETO'))` es la que garantizaría, a nivel de motor, la regla de negocio 3.2 — una vez migrada.

### 3.5. Guard de vigencia reutilizado
Sin cambios — ver sección 2, "Convenciones generales".

### 3.6. Transacción única para "asignar aula + intentar transicionar"
Sin cambios de fondo respecto a Revisión 1 — HU-C-15 (2.3) sigue resolviéndose en una única `prisma.$transaction`, solo que ahora el resultado de la transición puede ser `DISPONIBLE` o `COMPLETO` en vez de un único valor. Como la defensa de motor de 3.4 todavía no existe, esta transacción es hoy la única barrera real contra una condición de carrera al agendar — motivo adicional para no demorar la resolución de 3.4 en HU-C-15.

### 3.7. Guarda de concurrencia para el cupo (NUEVO)
Dos casos distintos, con soluciones distintas:

- **Alta/baja individual de alumno (2.5, HU-C-04):** la condición de cupo depende de un **conteo sobre una tabla relacionada** (`TurnoAlumno`), que un `updateMany` simple no puede expresar de forma atómica. Patrón obligatorio: (1) dentro de la transacción, bloquear la fila del turno con `SELECT "idTurno", "cupoMaximoTurno" FROM turnos WHERE "idTurno" = $1 FOR UPDATE` (vía `tx.$queryRaw`); (2) recién con la fila bloqueada, contar `TurnoAlumno` del turno; (3) comparar contra `cupoMaximoTurno` e insertar/rechazar. El `FOR UPDATE` serializa dos altas concurrentes sobre el mismo turno.
- **Modificación de `cupo_maximo` en un turno `PENDIENTE` (2.1, HU-C-03, código `CUPO_MENOR_A_INSCRIPTOS`) — implementado así:** no requiere `FOR UPDATE`. `modificarConfiguracionTurno()` ya condiciona su `updateMany` a que `updatedAtTurno` no haya cambiado (optimistic locking existente, patrón de la Regla N.° 7). Alcanza con contar los inscriptos **antes** del `updateMany` e incluir `cupoMaximoTurno` en los datos actualizados: si otro proceso modifica los alumnos entre el conteo y el `updateMany`, `updatedAtTurno` ya no coincide, el `updateMany` no afecta ninguna fila y se traduce a `TURNO_MODIFICADO` — el comportamiento que exige la Regla N.° 7 se sostiene por la condición ya existente, sin necesitar el lock pesado del primer caso. Verificado con curl: cupo 1 con 2 inscriptos → `409`; cupo 2 con 2 inscriptos → `200`.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite después del `COMMIT`, vía `emitirEventoTurno()` → `prisma.eventoTurno.create()` (opción b de la Regla N.° 2, ya implementada — sin encadenamiento hash, ver historial de esa regla).

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `turno:configurado` | Alta (2.1) | `turno_id, fecha, hora_inicio, hora_fin, materia_id, cupo_maximo, usuario_id` |
| `turno:configuracion_modificada` | Modificación de turno pendiente (2.1) | `turno_id, campos_modificados, profesor_desasignado, usuario_id` |
| `turno:participantes_asignados` | Carga/reemplazo inicial de profesor + alumnos (2.2) | `turno_id, alumno_ids, profesor_id, usuario_id` |
| `turno:aula_asignada` | Asignación de aula (2.3) | `turno_id, aula_id, usuario_id` |
| `turno:disponibilizado` | Transición Pendiente→Disponible (2.3) | `turno_id, fecha, hora_inicio, hora_fin, alumno_ids, profesor_id, aula_id, materia_id, usuario_id` |
| `turno:completado` | Transición a Completo, desde 2.3 o desde 2.5 | `turno_id, alumno_ids, cupo_maximo, usuario_id` |
| `turno:alumno_agregado` | Alta individual de alumno (2.5) | `turno_id, alumno_id, usuario_id` |
| `turno:alumno_quitado` | Baja individual de alumno (2.5) | `turno_id, alumno_id, usuario_id` |
| `turno:disponible_nuevamente` | Transición Completo→Disponible (2.5) | `turno_id, alumno_id_liberado, usuario_id` |

---

## Parámetros configurables (referencia, sin cambios)

| Parámetro | Usado en |
|---|---|
| `DURACION_ESTANDAR_TURNO_MIN` | 2.1 — cálculo de `hora_fin` |
| `GRANULARIDAD_MINUTOS` | 2.1 — validación de `hora_inicio` |
| `DIAS_OPERATIVOS` | 2.1 — día válido para configurar |
| `HORA_APERTURA` / `HORA_CIERRE` | 2.1 — horario operativo del centro |
| `ANTICIPACION_MAXIMA_DIAS` | 2.1 — tope de anticipación para configurar un turno |
```