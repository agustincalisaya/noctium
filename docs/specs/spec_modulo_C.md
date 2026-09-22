```markdown
# Especificación Técnica — Módulo C (Turno)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker, extensión `btree_gist`) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 7, 10) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (Alumno) · `spec_modulo_D.md` (Profesor, fórmula de superposición §3.4) · `spec_modulo_K.md` (Aulas) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-C-03 (Configurar turno), HU-C-04 (Asignar alumno y profesor), HU-C-15 (Asignar aula), HU-C-01 (Listar turnos) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Cancelación de un turno (agendado o pendiente).
- Modificación de fecha/hora de un turno ya **agendado** (solo se permite mientras está `PENDIENTE`, ver 2.1).
- Sugerencia automática de franjas disponibles: la fecha/hora se elige manualmente este sprint.
- Búsqueda avanzada / filtros combinados en el listado (HU-C-01 §7 lo excluye explícitamente).

---

## 1. Visión General

El Módulo C es el núcleo operativo del sistema: gestiona el ciclo de vida de un `Turno` desde su configuración inicial hasta quedar completamente reservado. Es una **máquina de estados de dos valores**, sin reversión en este sprint:

```
PENDIENTE ──(asignar aula, con alumno+profesor+materia+fecha/hora ya válidos)──▶ AGENDADO
```

**Regla central que atraviesa todo el módulo:** *un turno `PENDIENTE` no reserva ningún recurso.* Dos turnos `PENDIENTE` pueden compartir el mismo profesor, alumno o aula en el mismo horario sin que eso sea un conflicto — el conflicto solo existe entre turnos `AGENDADO`. Esto se traduce técnicamente en que toda validación de disponibilidad (secciones 2.2 y 2.3) consulta exclusivamente turnos con `estado: "AGENDADO"`, y en que la defensa de concurrencia a nivel de base de datos (sección 3.4) solo protege filas en ese estado.

**Modelo de referencia:** `Turno` (`id`, `fecha`, `hora_inicio`, `hora_fin`, `materia_id` NOT NULL, `alumno_id` nullable, `profesor_id` nullable, `aula_id` nullable, `estado` — `PENDIENTE` | `AGENDADO`, `created_at`, `created_by`). Un turno tiene **exactamente** un alumno y un profesor (FK simples, no una relación N:M) una vez asignados.

**Servicios públicos consumidos de otros módulos** (Regla N.° 3 de aislamiento — este módulo nunca hace `SELECT`/`UPDATE` directo sobre tablas de Alumno, Profesor, Materia o Aula):
- `verificarMateriaActiva(materiaId)` — Módulo L.
- `buscarAlumnosActivos(query)`, `verificarAlumnoActivo(alumnoId)` — Módulo B.
- `listarProfesoresActivosPorMateria(materiaId)`, `verificarDisponibilidadHorarioProfesor(profesorId, diaSemana, horaInicio, horaFin)` — Módulo D.
- `verificarAulaActiva(aulaId)` — Módulo K.

**Nota de trazabilidad (gap a resolver en revisión futura):** `buscarAlumnosActivos()` (búsqueda parcial por nombre/apellido/DNI) y `listarProfesoresActivosPorMateria()` son necesarios para HU-C-04 pero **no** están contractualizados en `spec_modulo_B.md` (HU-B-04 excluye explícitamente la búsqueda) ni en `spec_modulo_D.md`. Corresponde agregarlos como sección aditiva en una futura revisión de esas specs (mismo patrón de "HU → estado previo → acción" usado en el proyecto de referencia) — se documentan acá solo como contrato consumido por este flujo, no se duplica su definición ni se implementa su lógica dentro de este módulo.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta requiere `withPermission("turnos:<accion>")` (Regla N.° 10): `turnos:crear` (configurar y modificar configuración), `turnos:asignar_participantes`, `turnos:asignar_aula`, `turnos:leer` — todas exclusivas de Mesa de Entrada salvo `turnos:leer`, disponible también para Gerente y Profesor (este último, acotado a sus propios turnos — ver `spec_modulo_J.md`).
- **Guard de vigencia (reutilizado por 2.2 y 2.3, no reimplementado por separado):** toda operación sobre un turno `PENDIENTE` revalida que `fecha + hora_inicio` siga siendo un momento futuro. Si ya pasó: `409 TURNO_VENCIDO`, exige corregir la configuración (2.1) antes de continuar.

---

### 2.1. Configurar turno (HU-C-03)

**Ruta (alta):** `POST /app/api/turnos/route.ts`
**Ruta (modificación, mientras `PENDIENTE`):** `PATCH /app/api/turnos/[id]/configuracion/route.ts`
**Server Actions equivalentes:** `configurarTurno()` / `modificarConfiguracionTurno()` en `app/(dashboard)/turnos/actions.ts`
**Permiso requerido:** `turnos:crear`

```typescript
// lib/schemas/turnos.schema.ts
export const ConfigurarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema, // utilidad compartida, spec_modulo_B.md §2.1
  hora_inicio: horaSchema,            // utilidad compartida, spec_modulo_D.md §2.4 (formato 24h + granularidad)
  materia_id: z.string().uuid(),
});
export type ConfigurarTurnoInput = z.infer<typeof ConfigurarTurnoSchema>;
```

**Comportamiento esperado (`lib/services/turnos/turno.service.ts` → `configurarTurno`):**
1. Verificar `materia_id` activa (vía `verificarMateriaActiva()`, Módulo L). Si no hay materias activas en el sistema, el frontend lo indica antes de mostrar el formulario; si igualmente se envía una inactiva: `409 MATERIA_NO_DISPONIBLE`.
2. Validar que `fecha` no sea pasada; si `fecha` es hoy, `hora_inicio` debe ser posterior a la hora actual.
3. Validar que `fecha` corresponda a un día operativo del centro (parámetro `DIAS_OPERATIVOS`, mismo que `spec_modulo_D.md` §2.4).
4. Calcular `hora_fin = hora_inicio + DURACION_ESTANDAR_TURNO_MIN` (parámetro, sección "Parámetros configurables"). `hora_fin` nunca es editable por el cliente.
5. Validar que `[hora_inicio, hora_fin)` esté completamente contenido en el horario operativo del centro (`HORA_APERTURA`, `HORA_CIERRE`).
6. Validar que `fecha` no supere `ANTICIPACION_MAXIMA_DIAS` desde hoy.
7. **Alta:** insertar con `estado: "PENDIENTE"`, `alumno_id: null`, `profesor_id: null`, `aula_id: null`, fecha de creación y usuario. Un turno `PENDIENTE` recién creado **no aparece en ningún calendario** (`spec_modulo_J.md` solo muestra `AGENDADO`) y no reserva ningún recurso.
8. **Modificación** (solo si `estado === "PENDIENTE"`; si ya está `AGENDADO`, `409 TURNO_YA_AGENDADO` — fuera de alcance de esta spec): si cambia `materia_id` y el turno ya tiene un `profesor_id` asignado, verificar que ese profesor siga asociado a la nueva materia (`listarProfesoresActivosPorMateria`); si no lo está, **desasignar automáticamente** `profesor_id` (vuelve a `null`) e informar en la respuesta cuál dato debe reasignarse — no se aborta la operación completa, solo se invalida la asignación dependiente que dejó de tener sentido.
9. Emitir `turno:configurado` o `turno:configuracion_modificada` (sección 4).

**Respuesta `201 Created` (alta):**
```json
{ "data": { "id": "uuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "11:00", "estado": "PENDIENTE" }, "error": null }
```

**Respuesta `200 OK` (modificación con desasignación dependiente):**
```json
{
  "data": { "id": "uuid", "materia_id": "uuid-nueva", "profesor_desasignado": true },
  "error": null
}
```

---

### 2.2. Asignar alumno y profesor al turno (HU-C-04)

**Ruta:** `PATCH /app/api/turnos/[id]/participantes/route.ts`
**Server Action equivalente:** `asignarParticipantesTurno()` en `app/(dashboard)/turnos/actions.ts`
**Permiso requerido:** `turnos:asignar_participantes`

```typescript
export const AsignarParticipantesTurnoSchema = z.object({
  alumno_id: z.string().uuid(),
  profesor_id: z.string().uuid(),
});
export type AsignarParticipantesTurnoInput = z.infer<typeof AsignarParticipantesTurnoSchema>;
```

**Comportamiento esperado:**
1. Leer el `Turno`; debe existir y estar `PENDIENTE` (si ya `AGENDADO`: `409 TURNO_YA_AGENDADO`). Aplicar el guard de vigencia (sección 2, convenciones).
2. Verificar `alumno_id` activo (`verificarAlumnoActivo()`, Módulo B).
3. Verificar `profesor_id` activo **y** asociado a `turno.materia_id` (`listarProfesoresActivosPorMateria()`, Módulo D). Si no hay ningún profesor asociado a la materia: `404 SIN_PROFESORES_PARA_MATERIA`.
4. **Validación de disponibilidad (aplicativa, contra turnos `AGENDADO` únicamente):**
   - Profesor: el intervalo `[turno.hora_inicio, turno.hora_fin)` debe estar contenido en su `HorarioProfesor` para el día de semana de `turno.fecha` (`verificarDisponibilidadHorarioProfesor()`), y no debe superponerse con otro `Turno` `AGENDADO` de ese mismo profesor en esa fecha — misma fórmula de intervalos semiabiertos definida en `spec_modulo_D.md` §3.4 (`a1 < b2 AND b1 < a2`; contiguos no superponen).
   - Alumno: no debe tener otro `Turno` `AGENDADO` que se superponga con el mismo intervalo (misma fórmula).
   - Si hay conflicto en cualquiera de los dos: `409`, identificando el recurso y el conflicto puntual (ver respuestas de ejemplo). El turno conserva su estado y valores anteriores — ningún dato se pierde.
5. **Nota sobre el alcance real de esta revalidación:** como un turno `PENDIENTE` no reserva recursos (ver sección 1), esta validación es una comprobación de **buena fe contra el estado actual de turnos ya agendados**, para dar feedback inmediato al usuario — no es todavía la garantía atómica final. Esa garantía se activa recién en 2.3, en el momento en que el turno pasa a `AGENDADO` (ver exclusion constraints, sección 3.4). Dos turnos `PENDIENTE` pueden terminar apuntando al mismo profesor en el mismo horario sin error acá; el conflicto real, si llega a ocurrir, se resuelve (y se informa) al intentar agendar cualquiera de los dos.
6. Actualizar `alumno_id` y `profesor_id` del turno (`updateMany` con `where: { id: turnoId, estado: "PENDIENTE" }`, defensa adicional ante un agendado concurrente del mismo turno — `count === 0` ⇒ `409 TURNO_YA_AGENDADO`). El turno permanece `PENDIENTE` — recién pasa a `AGENDADO` cuando además tenga aula (2.3).
7. Mientras el turno siga `PENDIENTE`, este mismo endpoint permite **reemplazar** alumno y/o profesor, con las mismas validaciones (no es una operación distinta).
8. Emitir `turno:participantes_asignados` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "uuid", "alumno_id": "uuid", "profesor_id": "uuid", "estado": "PENDIENTE" }, "error": null }
```

**Respuesta `409 Conflict` (profesor no disponible):**
```json
{
  "data": null,
  "error": { "code": "PROFESOR_NO_DISPONIBLE", "message": "El profesor ya tiene un turno agendado de 10:00 a 11:00" }
}
```

**Respuesta `409 Conflict` (fuera de horario de atención):**
```json
{ "data": null, "error": { "code": "PROFESOR_FUERA_DE_HORARIO", "message": "El turno está fuera del horario de atención del profesor" } }
```

**Respuesta `409 Conflict` (alumno no disponible):**
```json
{ "data": null, "error": { "code": "ALUMNO_NO_DISPONIBLE", "message": "El alumno ya tiene un turno agendado en ese horario" } }
```

---

### 2.3. Asignar aula al turno — transición a Agendado (HU-C-15)

**Ruta:** `PATCH /app/api/turnos/[id]/aula/route.ts`
**Server Action equivalente:** `asignarAulaTurno()` en `app/(dashboard)/turnos/actions.ts`
**Permiso requerido:** `turnos:asignar_aula`

```typescript
export const AsignarAulaTurnoSchema = z.object({
  aula_id: z.string().uuid(),
});
export type AsignarAulaTurnoInput = z.infer<typeof AsignarAulaTurnoSchema>;
```

**Comportamiento esperado, íntegramente dentro de una única `prisma.$transaction` (asignar aula e intentar la transición son una sola operación de negocio, nunca dos pasos separables):**
1. Leer el `Turno`; debe existir. Si ya está `AGENDADO`: `409 TURNO_YA_AGENDADO` (reemplazar el aula de un turno ya agendado está fuera de alcance de esta spec). Aplicar el guard de vigencia.
2. Verificar `aula_id` activa (`verificarAulaActiva()`, Módulo K). Si no hay aulas activas: `404 SIN_AULAS_ACTIVAS`, el turno permanece `PENDIENTE` sin cambios.
3. **Validación de disponibilidad del aula (aplicativa, contra turnos `AGENDADO` únicamente):** el aula no debe tener otro `Turno` `AGENDADO` superpuesto en `turno.fecha`, misma fórmula de intervalos semiabiertos. Si hay conflicto: `409 AULA_NO_DISPONIBLE`, el turno permanece sin cambios (ni siquiera se persiste el nuevo `aula_id`) — se puede elegir otra aula sin perder los demás datos, porque nada de este intento se guardó.
4. Actualizar `aula_id` (`updateMany` con `where: { id: turnoId, estado: "PENDIENTE" }`, defensa de condición de carrera sobre el propio turno).
5. **Evaluar la transición a `AGENDADO`:** si el turno ahora tiene `materia_id`, `alumno_id`, `profesor_id` y `aula_id` todos presentes, y `fecha + hora_inicio` sigue siendo futuro:
   - Revalidar, en esta misma transacción, la disponibilidad de **profesor, alumno y aula** contra turnos `AGENDADO` (mismo criterio que 2.2 paso 4 y 2.3 paso 3, ejecutado una vez más porque pudo cambiar algo entre la asignación de participantes y este momento).
   - Si todo sigue disponible: `UPDATE turno SET estado = "AGENDADO" WHERE id = turnoId AND estado = "PENDIENTE"`.
   - Si algún recurso dejó de estar disponible: la transacción completa revierte — no se persiste ni el `aula_id` ni la transición; se informa qué recurso falló, el cliente puede corregir sin haber perdido ningún otro dato (porque, al revertir, tampoco se guardó el intento).
   - Si no se cumplen todas las precondiciones (ej. todavía falta el profesor): el `aula_id` sí queda guardado, el turno permanece `PENDIENTE`, la respuesta simplemente confirma la asignación del aula sin mencionar agendado.
6. **Defensa atómica final (sección 3.4):** el `UPDATE` a `estado = "AGENDADO"` está protegido por tres *exclusion constraints* de Postgres que impiden, a nivel de motor de base de datos, que dos turnos `AGENDADO` compartan profesor, alumno o aula en intervalos superpuestos — cualquier condición de carrera que la validación aplicativa (paso 5) no alcance a detectar (dos transacciones concurrentes agendando en el mismo instante) es rechazada acá con una violación de constraint (`23P01`), capturada y traducida al mismo error `409` de recurso no disponible.
7. Emitir `turno:aula_asignada` y, si la transición ocurrió, también `turno:agendado` — en ese orden causal, ambos después del `COMMIT` (sección 4).

**Respuesta `200 OK` (aula asignada, turno agendado):**
```json
{ "data": { "id": "uuid", "aula_id": "uuid", "estado": "AGENDADO" }, "error": null }
```

**Respuesta `200 OK` (aula asignada, turno sigue pendiente — falta profesor/alumno):**
```json
{ "data": { "id": "uuid", "aula_id": "uuid", "estado": "PENDIENTE" }, "error": null }
```

**Respuesta `409 Conflict` (aula no disponible):**
```json
{ "data": null, "error": { "code": "AULA_NO_DISPONIBLE", "message": "El aula ya tiene un turno agendado en ese horario" } }
```

---

### 2.4. Listado y detalle de turnos (HU-C-01)

**Ruta (listado):** `GET /app/api/turnos/route.ts`
**Permiso requerido:** `turnos:leer`

```typescript
export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado:**
- Incluye turnos `PENDIENTE` y `AGENDADO` — los pendientes se distinguen con la etiqueta "Pendiente" y ofrecen continuar su configuración (siguiente paso: 2.2 o 2.3, según qué les falte).
- Orden por defecto: `fecha, hora_inicio` ascendente desde la fecha actual en adelante; `profesor_id` como segundo criterio de desempate ante igual fecha/hora.
- Cada ítem: `fecha`, `hora_inicio`–`hora_fin` (como intervalo), `alumno` (`"Apellido, Nombre"` o `"Sin asignar"`), `profesor` (ídem), `materia`, `aula` (ídem o `"Sin asignar"`), `estado` (texto, no solo color).
- Paginación server-side con metadatos.
- Al confirmar cualquier paso de configuración/asignación (2.1 a 2.3), el listado refleja el nuevo estado de inmediato (no hay caché intermedio que lo demore).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "uuid", "fecha": "2026-04-10", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumno": "Pérez, Ana", "profesor": "Gómez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "AGENDADO" },
      { "id": "uuid", "fecha": "2026-04-11", "hora_inicio": "14:00", "hora_fin": "15:00",
        "alumno": "Sin asignar", "profesor": "Sin asignar", "materia": "Física", "aula": "Sin asignar", "estado": "PENDIENTE" }
    ],
    "paginacion": { "total": 15, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Ruta (detalle):** `GET /app/api/turnos/[id]/route.ts` — todos los datos, estado, fecha de creación, usuario que lo registró.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `lib/services/turnos/turno.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Máquina de estados de dos valores, sin reversión
`PENDIENTE → AGENDADO` es la única transición que existe en este sprint. No hay servicio que revierta `AGENDADO` a `PENDIENTE` ni que cancele un turno — cualquier necesidad de ese tipo queda fuera de esta spec (ver "Fuera de alcance").

### 3.2. Un turno `PENDIENTE` nunca reserva recursos
Toda consulta de disponibilidad (2.2 paso 4, 2.3 paso 3 y 5) filtra explícitamente `estado: "AGENDADO"`. Ningún servicio de este módulo debe, por comodidad, ampliar esas consultas para incluir turnos `PENDIENTE` — sería contradecir esta regla de negocio central.

### 3.3. Fórmula de superposición reutilizada, no reimplementada
La fórmula de intervalos semiabiertos (`a1 < b2 AND b1 < a2`) es la misma definida en `spec_modulo_D.md` §3.4, aplicada acá sobre `(fecha, hora_inicio, hora_fin)` combinados en un rango de tipo `tsrange` de Postgres. Cualquier variante de esta validación en el proyecto debe usar esta misma fórmula.

### 3.4. Defensa de concurrencia: *exclusion constraints* de Postgres (extensión `btree_gist`)
Esta es la traducción del principio de la Regla N.° 7 de `docs/RULES.md` a un dominio que no es un simple contador: en lugar de un `updateMany` condicionado sobre una cantidad, se necesita garantizar la ausencia de solapamiento contra un **conjunto de filas** — eso es exactamente lo que resuelve un *exclusion constraint* de PostgreSQL, delegando la atomicidad de la condición al motor de base de datos en lugar de un `find` + verificación + `update` separados en la capa de aplicación.

```sql
-- Migración
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Turno" ADD CONSTRAINT turno_profesor_sin_superposicion
  EXCLUDE USING gist (
    profesor_id WITH =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) WITH &&
  ) WHERE (estado = 'AGENDADO');

ALTER TABLE "Turno" ADD CONSTRAINT turno_alumno_sin_superposicion
  EXCLUDE USING gist (
    alumno_id WITH =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) WITH &&
  ) WHERE (estado = 'AGENDADO');

ALTER TABLE "Turno" ADD CONSTRAINT turno_aula_sin_superposicion
  EXCLUDE USING gist (
    aula_id WITH =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) WITH &&
  ) WHERE (estado = 'AGENDADO');
```

El operador de solapamiento (`&&`) de `tsrange` con los límites por defecto de PostgreSQL (`[)`, cerrado-abierto) trata dos intervalos contiguos como **no superpuestos** — exactamente el mismo criterio que la fórmula aplicativa de la sección 3.3, sin tener que mantener dos implementaciones distintas del mismo concepto sincronizadas a mano.

La cláusula `WHERE (estado = 'AGENDADO')` es la que garantiza, a nivel de motor, la regla de negocio 3.2: filas `PENDIENTE` (con `profesor_id`/`alumno_id`/`aula_id` potencialmente repetidos entre sí) nunca activan el constraint.

### 3.5. Guard de vigencia reutilizado
Ver sección 2, "Convenciones generales" — no se reimplementa por separado en 2.2 y 2.3, es la misma verificación.

### 3.6. Transacción única para "asignar aula + intentar agendar"
Estas dos operaciones (HU-C-15) nunca se separan en dos pasos de base de datos independientes — están dentro de la misma `prisma.$transaction`, de modo que un fallo en la revalidación final revierte también la asignación del aula, nunca deja al turno en un estado intermedio con un `aula_id` guardado pero sin haber evaluado la transición.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite después del `COMMIT`.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `turno:configurado` | Alta (2.1) | `turno_id, fecha, hora_inicio, hora_fin, materia_id, usuario_id` |
| `turno:configuracion_modificada` | Modificación de turno pendiente (2.1) | `turno_id, campos_modificados, profesor_desasignado, usuario_id` |
| `turno:participantes_asignados` | Asignación de alumno/profesor (2.2) | `turno_id, alumno_id, profesor_id, usuario_id` |
| `turno:aula_asignada` | Asignación de aula (2.3) | `turno_id, aula_id, usuario_id` |
| `turno:agendado` | Transición Pendiente→Agendado (2.3) | `turno_id, fecha, hora_inicio, hora_fin, alumno_id, profesor_id, aula_id, materia_id, usuario_id` |

---

## Parámetros configurables (referencia)

| Parámetro | Usado en |
|---|---|
| `DURACION_ESTANDAR_TURNO_MIN` | 2.1 — cálculo de `hora_fin` |
| `GRANULARIDAD_MINUTOS` | 2.1 — validación de `hora_inicio` (compartido con `spec_modulo_D.md`) |
| `DIAS_OPERATIVOS` | 2.1 — día válido para configurar (compartido con `spec_modulo_D.md`) |
| `HORA_APERTURA` / `HORA_CIERRE` | 2.1 — horario operativo del centro (compartido con `spec_modulo_D.md`) |
| `ANTICIPACION_MAXIMA_DIAS` | 2.1 — tope de anticipación para configurar un turno |
```