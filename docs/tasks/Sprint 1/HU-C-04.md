# TASK: HU-C-04 — Asignar profesor y alumnos al turno (turnos grupales)

**Módulo:** C (Turno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` (Revisión 2) secciones 2.2 (carga inicial) y 2.5 (alta/baja individual) · reglas 3.2, 3.3, 3.7 · eventos sección 4
**RBAC:** `turnos:asignar_participantes` ya existe y no se toca (exclusivo Mesa de Entrada) — confirmado en relevamiento, sin cambios.
**Schema:** ya migrado por HU-C-03 (`cupoMaximoTurno`, enum de 3 estados). Esta task no agrega columnas nuevas — solo usa las que ya existen.

**Estado: CERRADA — implementada y verificada en navegador por el Scrum Master (24/09/2026). Lista para commit.**

---

## 0. Relevamiento previo a implementación (Claude Code)

**Relevamiento recibido y confirmado por el Scrum Master el 24/09. Los 5 puntos y las 4 decisiones (A–D) quedan resueltos como se detalla abajo. Claude Code puede proceder a implementar.**

**Puntos "relevar antes de asumir" — RESUELTOS:**

1. **`buscarAlumnosActivos()` — RESUELTO, ya existe.** Confirmado en `src/server/alumnos/alumno.service.ts:113`, junto con la ruta `GET /api/turnos/participantes/alumnos?q=` (permiso `turnos:asignar_participantes`). Cumple exactamente el criterio 1: activación desde 2 caracteres, coincidencia parcial sobre columnas normalizadas de nombre (sin mayúsculas ni acentos), DNI por coincidencia parcial, respuesta `{ id, nombre, apellido, dni }`, máximo 10 resultados. **No hace falta tocar el Módulo B.**
2. **Firma de `asignarParticipantesTurno()` — RESUELTO, sin otros consumidores.** El `alumno_id` único solo aparece en `turno.schema.ts`, el servicio, la ruta `PATCH .../participantes` y `participantes-turno.tsx`, más los dos tests ya identificados. Confirmado además: `presentar()` expone `alumno_id` (el primero) y `urlContinuar()` lo usa para decidir el siguiente paso ("participantes" vs. "aula"). **Se aprueba el cambio propuesto:** `urlContinuar()` pasa a decidir por `alumnos.length === 0`, más correcto con varios alumnos.
3. **Alcance de frontend para 2.5 — RESUELTO, se construye.** Se confirma construir el frontend de alta/baja individual en el detalle del turno, aunque hoy solo sea testeable en navegador contra turnos de seed (`seed-turno-07` a `seed-turno-10`) hasta que exista HU-C-15. Los controles se muestran solo a Mesa de Entrada (Gerente y Profesor también ven el detalle, pero sin estos controles).
4. **`FOR UPDATE` vía `tx.$queryRaw` — RESUELTO, nombres confirmados.** `model Turno` mapea a `turnos` sin `@map` adicionales por columna: `"idTurno"`, `"cupoMaximoTurno"`, `"estadoTurno"`. La query trae también `"estadoTurno"` (necesario para el guard de vigencia de la Decisión A y para la validación de estado en el mismo `SELECT`), vía `tx.$queryRaw` tipado con template literal — nunca `$queryRawUnsafe` ni interpolación de strings.
5. **Patrón de UI — RESUELTO.** No existe componente de chips en `src/components/ui` (solo `badge`, `button`, `input`, `label`); no hay combobox instalado. Se aprueba el patrón propuesto: contador "Alumnos (2/5)" + chips de agregados (cada uno con botón para quitar) arriba, buscador con debounce de 250 ms debajo (reutilizando el patrón ya existente en `participantes-turno.tsx`), resultados excluyendo a los ya agregados y al cupo alcanzado. Se reutiliza el mismo buscador para el alta individual en el detalle. Se suma `DirtyStateContext` al formulario de participantes (nuevo para este formulario, mismo patrón que HU-C-03 aplicó a `turno-configuracion.tsx`).

**Diferencias señaladas por Claude Code respecto al prompt original — RESUELTAS:**
- `ETIQUETA_ESTADO_TURNO` vive en `src/app/(dashboard)/turnos/turno.types.ts`, no en `src/types/`. **Se deja donde está** — corregido en la spec (Revisión 2), no se mueve el archivo.
- `turnos:asignar_participantes` sigue siendo exclusivo de Mesa de Entrada. Confirmado, sin cambios.

**Decisiones A–D — TODAS APROBADAS:**

- **A — Guard de vigencia también en 2.5: APROBADA.** `turnoSigueVigente()` se aplica en `agregarAlumnoTurno()` y `quitarAlumnoTurno()`, con `409 TURNO_VENCIDO`. Motivo confirmado: los turnos de seed 01–06 son `DISPONIBLE`/`COMPLETO` con fecha ya pasada (21–24/09); sin la guarda, se podría seguir modificando la inscripción de una clase que ya ocurrió. **Documentado en la spec** como extensión del guard de vigencia (antes solo cubría operaciones sobre `PENDIENTE`).
- **B — Permitir quitar al último alumno de un turno Disponible: APROBADA.** El turno queda `DISPONIBLE` con `0/N`. El criterio 6 no pone excepciones y un turno sin alumnos sigue siendo válido para recibir inscripciones.
- **C — Identificación del alumno en conflicto (criterio 8): APROBADA.** Se mantiene el mensaje literal exigido por la HU ("El alumno ya tiene un turno agendado en ese horario"); el detalle `{ alumno_id }` viaja en el `ServiceError`, la ruta lo reenvía, la UI marca el chip correspondiente. No viola la Regla N.° 3 porque el dato ya es propio de Turno. Mismo tratamiento para `ALUMNO_YA_ASIGNADO`.
- **D — Prueba de concurrencia: APROBADA.** Los dos niveles propuestos: (1) test unitario con mocks verificando el orden `FOR UPDATE` → conteo, y (2) prueba real contra la base con dos `POST /alumnos` simultáneos sobre `seed-turno-08` (1 lugar libre), esperando un `200` y un `409 CUPO_INSUFICIENTE`.

Claude Code puede proceder a implementar conforme a lo confirmado arriba y al contrato de las secciones 3–7 de esta task.

**Dos decisiones tomadas por Claude Code durante la implementación, sin consulta previa — APROBADAS retroactivamente por el Scrum Master (24/09):**

- **Validación de CUID en el id del turno, sacada de las 3 rutas de esta HU** (`participantes`, `alumnos` POST, `alumnos/[alumnoId]` DELETE). Motivo: los turnos de seed usan ids no-CUID (`seed-turno-10`, etc.), y la validación Zod los rechazaba con `400` antes de llegar al servicio — sin este cambio, el criterio 6 no se podía ejercitar ni por curl ni en el navegador contra el seed (afectaba también a `seed-turno-11` en la ruta de participantes, un problema preexistente a esta HU). Ahora esas 3 rutas se comportan igual que `GET /api/turnos/[id]`: si el id no existe, el servicio responde `404`. **Se aprueba.** El `alumnoId` de la URL y el `alumno_id` del body siguen validándose como CUID (son datos que si son reales en producción sí lo serán). La alternativa —ids de seed en formato CUID— exigía un reset, y esto es más consistente con el resto del módulo. Si en algún momento se decide endurecer la validación del id de turno en toda la spec, debe hacerse pareja en las 4 rutas (esta 3 + `GET /api/turnos/[id]`), no solo acá.
- **No se agregó `DirtyStateContext` en el detalle del turno** (alta/baja individual, §2.5) — solo en el formulario de participantes (§2.2). Motivo: en el detalle, alta y baja se guardan al instante (no hay un estado "sin guardar" que proteger); `DirtyStateContext` solo tiene sentido en formularios con un paso de confirmación explícito. **Se aprueba** — es coherente con el criterio de uso que ya se había fijado en HU-C-03.

---

## 1. Nota de alcance

Esta task cubre **dos operaciones distintas** de la spec, ambas bajo el paraguas de HU-C-04 (ver `spec_modulo_C.md`, sección "Visión General" — no es una decisión de esta task, ya está contractualizado así):

- **§2.2 — Carga/reemplazo inicial** (combo profesor + conjunto completo de alumnos), solo mientras el turno está `PENDIENTE`. Es la reescritura de `asignarParticipantesTurno()` ya existente.
- **§2.5 — Alta/baja individual de un alumno**, solo cuando el turno ya está `DISPONIBLE`/`COMPLETO`. Es funcionalidad nueva, con su propia guarda de concurrencia (spec §3.7), y ahora también con guard de vigencia (Decisión A).

Estas dos operaciones son necesarias para que la HU tal como está redactada quede completa: el criterio 6 ("se puede quitar a un alumno... si el turno estaba en Completo, vuelve a Disponible") solo tiene sentido para un turno que ya superó `PENDIENTE` — es decir, ejercita §2.5, no §2.2.

**Fuera de alcance de esta task (explícito):**
- **Asignación de aula y la transición de estados en sí** (§2.3) — HU-C-15. Esta task nunca hace que un turno pase de `PENDIENTE` a `DISPONIBLE`/`COMPLETO`; solo consume turnos que ya estén en esos estados (de seed, hasta que exista HU-C-15) para probar §2.5.
- **Los `exclusion constraints` de Postgres** (`spec_modulo_C.md` §3.4) — siguen sin existir, es un gap heredado y contractualizado para HU-C-15, no se resuelve acá. La validación de disponibilidad de esta HU sigue siendo aplicativa, sin la defensa de motor.
- **`buscarAlumnosActivos()` en sí** — ya existe, no se toca el Módulo B para esta task.

---

## 2. Historia de Usuario

**Como** personal de mesa de entradas
**Necesito** asignar un profesor y uno o varios alumnos a un turno configurado, y poder agregar o quitar alumnos individualmente una vez que el turno ya tiene aula
**Para** identificar quién dictará la clase y quiénes asistirán, sin perder cupo disponible innecesariamente

**SP estimado:** 3 (del documento de HU original) — **a revisar con el equipo:** el alcance creció respecto al contrato original de un solo alumno (ahora son 2 operaciones, con guarda de concurrencia nueva); puede ameritar re-estimación antes del sprint planning.

---

## 3. Alcance de esta task

Implementación backend + frontend conforme a `spec_modulo_C.md` §2.2 y §2.5. Incluye:

**Backend — §2.2 (reescritura)**
- `AsignarParticipantesTurnoSchema`: `alumno_id` → `alumno_ids: string[]` (mínimo 1, sin duplicados).
- `asignarParticipantesTurno()`: valida `alumno_ids.length <= cupoMaximoTurno`, cada alumno activo, profesor activo+asociado a la materia, disponibilidad de profesor y de cada alumno contra turnos `DISPONIBLE`/`COMPLETO`, reemplaza `TurnoAlumno` con `deleteMany` + `createMany`.
- Payload de `turno:participantes_asignados` con `alumno_ids` (arreglo).
- `urlContinuar()`: pasa a decidir por `alumnos.length === 0` (punto 2 del relevamiento).

**Backend — §2.5 (nuevo)**
- `AgregarAlumnoTurnoSchema` (`alumno_id: string`).
- `agregarAlumnoTurno()`: lock de fila (`FOR UPDATE`, trae también `estadoTurno`), guard de vigencia (Decisión A), validaciones de alumno activo/no duplicado/disponible (con detalle `{ alumno_id }` en conflicto, Decisión C), guarda de cupo atómica, insert, transición a `COMPLETO` si corresponde.
- `quitarAlumnoTurno()`: guard de vigencia (Decisión A), baja física de `TurnoAlumno` (no aplica Regla N.° 1 — no es entidad de dominio), transición a `DISPONIBLE` si el turno estaba `COMPLETO` (permitiendo llegar a `0/N`, Decisión B).
- Rutas: `POST /api/turnos/[id]/alumnos/route.ts`, `DELETE /api/turnos/[id]/alumnos/[alumnoId]/route.ts`.
- Eventos: `turno:alumno_agregado`, `turno:alumno_quitado`, `turno:completado` (si corresponde), `turno:disponible_nuevamente` (si corresponde).

**Frontend**
- `participantes-turno.tsx`: reemplazo del selector de un alumno por selección múltiple con buscador (activo desde 2 caracteres, debounced 250 ms, resultado con Apellido/Nombre/DNI vía `GET /api/turnos/participantes/alumnos?q=`), chips de agregados con opción de quitar antes de confirmar, contador contra el cupo, `DirtyStateContext`.
- `turno-detalle.tsx` (turnos `DISPONIBLE`/`COMPLETO`, solo Mesa de Entrada): agregar/quitar un alumno individual, mismo patrón de buscador + chips, marca visualmente el chip en conflicto (Decisión C).
- Mensajes exactos de la HU: "No hay profesores activos asociados a esta materia", "El turno alcanzó su cupo máximo", "El profesor ya tiene un turno agendado de HH:MM a HH:MM", "El turno está fuera del horario de atención del profesor", "El alumno ya tiene un turno agendado en ese horario", "Profesor y alumnos asignados correctamente".

**Fuera de alcance de frontend:** cualquier UI de asignación de aula (HU-C-15).

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/turnos/turno.schema.ts`

```typescript
export const AsignarParticipantesTurnoSchema = z.object({
  alumno_ids: z.array(z.string().cuid())
    .min(1, "Agregá al menos un alumno")
    .refine((ids) => new Set(ids).size === ids.length, "El mismo alumno no puede agregarse dos veces"),
  profesor_id: z.string().cuid(),
});
export type AsignarParticipantesTurnoInput = z.infer<typeof AsignarParticipantesTurnoSchema>;

export const AgregarAlumnoTurnoSchema = z.object({
  alumno_id: z.string().cuid(),
});
export type AgregarAlumnoTurnoInput = z.infer<typeof AgregarAlumnoTurnoSchema>;
```

### 4.2. Servicio

**Archivo:** `src/server/turnos/turno.service.ts`

**`asignarParticipantesTurno(turnoId, input, usuarioId)`** — dentro de `prisma.$transaction`, en este orden (ver `spec_modulo_C.md` §2.2 para el detalle completo paso a paso):
1. Leer turno, validar `PENDIENTE` + vigencia.
2. Validar `alumno_ids.length <= cupoMaximoTurno` → `CUPO_INSUFICIENTE`.
3. Validar cada alumno activo (`verificarAlumnoActivo`).
4. Validar profesor activo + asociado a la materia (`listarProfesoresActivosPorMateria`) → `SIN_PROFESORES_PARA_MATERIA`.
5. Validar disponibilidad de profesor y de cada alumno contra `DISPONIBLE`/`COMPLETO` → `PROFESOR_NO_DISPONIBLE` / `PROFESOR_FUERA_DE_HORARIO` / `ALUMNO_NO_DISPONIBLE`.
6. `updateMany` del profesor (`where: { idTurno, estadoTurno: "PENDIENTE" }`) → `TURNO_MODIFICADO` si `count === 0`.
7. `deleteMany` + `createMany` de `TurnoAlumno`.
8. Commit → emitir `turno:participantes_asignados`.

**`agregarAlumnoTurno(turnoId, input, usuarioId)`** — dentro de `prisma.$transaction` (ver spec §2.5 y §3.7):
1. `SELECT "idTurno", "cupoMaximoTurno", "estadoTurno" FROM turnos WHERE "idTurno" = $1 FOR UPDATE` vía `tx.$queryRaw`.
2. Validar guard de vigencia (`TURNO_VENCIDO`, Decisión A) y estado `DISPONIBLE` (si `PENDIENTE` → `TURNO_PENDIENTE`; si `COMPLETO` → `CUPO_INSUFICIENTE`).
3. Validar alumno activo, no duplicado (`ALUMNO_YA_ASIGNADO`), disponible (`ALUMNO_NO_DISPONIBLE`, con detalle `{ alumno_id }`, Decisión C).
4. Contar `TurnoAlumno` actuales; si `>= cupoMaximoTurno` → `CUPO_INSUFICIENTE`.
5. Insertar `TurnoAlumno`.
6. Si `count + 1 === cupoMaximoTurno`: transicionar a `COMPLETO`.
7. Commit → emitir `turno:alumno_agregado` (+ `turno:completado` si transicionó).

**`quitarAlumnoTurno(turnoId, alumnoId, usuarioId)`** — dentro de `prisma.$transaction`:
1. Lock de fila, validar guard de vigencia (`TURNO_VENCIDO`, Decisión A) y estado `DISPONIBLE`/`COMPLETO` (`TURNO_PENDIENTE` si no).
2. Eliminar `TurnoAlumno` (`ALUMNO_NO_ASIGNADO` si no existía).
3. Si estaba `COMPLETO`: transicionar a `DISPONIBLE` (permite llegar a `0/N`, Decisión B).
4. Commit → emitir `turno:alumno_quitado` (+ `turno:disponible_nuevamente` si transicionó).

**Errores de servicio a definir:** `CUPO_INSUFICIENTE`, `SIN_PROFESORES_PARA_MATERIA`, `PROFESOR_NO_DISPONIBLE`, `PROFESOR_FUERA_DE_HORARIO`, `ALUMNO_NO_DISPONIBLE`, `TURNO_PENDIENTE`, `TURNO_VENCIDO`, `ALUMNO_YA_ASIGNADO`, `ALUMNO_NO_ASIGNADO`.

### 4.3. Route Handlers

- `app/api/turnos/[id]/participantes/route.ts` (`PATCH`) — ya existe, solo cambia el schema que valida.
- `app/api/turnos/[id]/alumnos/route.ts` (`POST`, nuevo).
- `app/api/turnos/[id]/alumnos/[alumnoId]/route.ts` (`DELETE`, nuevo).
- Permiso: `withPermission("turnos:asignar_participantes")` en los tres.
- Las rutas de §2.5 reenvían el detalle `{ alumno_id }` del `ServiceError` cuando el código es `ALUMNO_NO_DISPONIBLE` o `ALUMNO_YA_ASIGNADO` (Decisión C).

### 4.4. Eventos de dominio

**Archivo:** `src/server/turnos/turno.service.ts` (usa `emitirEventoTurno()` ya existente, sin cambios de infraestructura).
Agregar a la tabla de eventos (si existe un registro central de tipos): `turno:alumno_agregado`, `turno:alumno_quitado`, `turno:disponible_nuevamente` (nuevos); `turno:completado` ya puede existir declarado desde HU-C-03 aunque no se disparara todavía.

---

## 5. Frontend

- `participantes-turno.tsx`: selector múltiple de alumnos (buscador con debounce desde 2 caracteres, vía `GET /api/turnos/participantes/alumnos?q=`), chips de agregados con opción de quitar antes de confirmar, contador "X/cupo", deshabilitar agregar más al llegar al cupo, `DirtyStateContext`.
- `turno-detalle.tsx`: agregar/quitar alumno individual para turnos `DISPONIBLE`/`COMPLETO` (confirmado en relevamiento, punto 3), con el mismo patrón de error inline usado en HU-C-03, visible solo para Mesa de Entrada.
- Mantener `DESIGN.md`: tokens de shadcn/ui, sin colores hardcodeados.
- Mensajes de éxito exactos: "Profesor y alumnos asignados correctamente" (§2.2); para agregar/quitar individual, usar mensajes equivalentes en el mismo tono (no especificados literalmente en los criterios de aceptación).

**Fuera de alcance de frontend:** cualquier UI de asignación de aula (HU-C-15).

---

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios (`turno.service.ts`)
- Combo inicial válido con 3 alumnos → reemplaza `TurnoAlumno`, turno sigue `PENDIENTE`.
- `alumno_ids` repetidos → rechazado por Zod antes de llegar al servicio.
- `alumno_ids.length > cupoMaximoTurno` → `CUPO_INSUFICIENTE`.
- Profesor sin horario compatible → `PROFESOR_FUERA_DE_HORARIO`.
- Profesor con turno `DISPONIBLE` superpuesto → `PROFESOR_NO_DISPONIBLE`.
- Alumno con turno `DISPONIBLE` superpuesto → `ALUMNO_NO_DISPONIBLE`.
- Alta individual sobre turno `COMPLETO` → `CUPO_INSUFICIENTE`, sin insertar.
- Alta individual sobre turno vencido (Decisión A) → `TURNO_VENCIDO`, sin insertar.
- Alta individual que alcanza el cupo → transiciona a `COMPLETO`, emite `turno:completado`.
- Baja individual sobre turno `COMPLETO` → transiciona a `DISPONIBLE`, emite `turno:disponible_nuevamente`.
- Baja individual sobre turno `DISPONIBLE` (no llega a `COMPLETO`) → no emite `turno:disponible_nuevamente` (no hubo transición).
- Baja del último alumno de un turno `DISPONIBLE` (Decisión B) → queda `DISPONIBLE` con `0/N`.
- **Decisión D (nivel 1):** test unitario con mocks que verifica el orden de ejecución: `FOR UPDATE` antes del conteo de `TurnoAlumno`.

### Nivel 2 — Postman / curl
- Combo inicial exitoso → `200`, `alumno_ids` en la respuesta.
- Cada código de error del punto anterior → status semántico correcto.
- Alta individual exitosa → `200`, `alumnos_inscriptos` actualizado.
- Baja individual exitosa con transición → `200`, `estado: "DISPONIBLE"`.
- **Decisión D (nivel 2):** dos `POST /alumnos` simultáneos sobre `seed-turno-08` (1 lugar libre) → uno `200`, el otro `409 CUPO_INSUFICIENTE`.

### Nivel 3 — BD / TablePlus
- `TurnoAlumno` refleja exactamente el conjunto esperado tras el combo inicial (sin registros huérfanos del reemplazo).
- `estadoTurno` transiciona correctamente en altas/bajas individuales sobre turnos de seed.
- `eventos_turno` contiene los eventos nuevos con el payload esperado.

**Evidencia esperada:** igual que HU-C-03 — unit + curl + SQL, capturas de navegador para el multi-select y el alta/baja individual.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado — 5 puntos + decisiones A–D aprobadas (24/09).
- [x] `buscarAlumnosActivos()` disponible (ya existía, confirmado con la firma que necesita el selector).
- [x] `asignarParticipantesTurno()` reescrita a `alumno_ids[]`, sin lógica de negocio fuera de `turno.service.ts`.
- [x] `agregarAlumnoTurno()` / `quitarAlumnoTurno()` implementadas con el patrón `FOR UPDATE` de la spec §3.7 y el guard de vigencia (Decisión A).
- [x] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [x] Eventos de dominio emitidos tras el `COMMIT`, nunca dentro de la transacción — verificado en `eventos_turno`.
- [x] Frontend: selector múltiple funcional; alta/baja individual en el detalle del turno. **Verificación visual pendiente, ver §8.**
- [x] Ningún `DELETE` físico sobre `Turno` (la baja física de `TurnoAlumno` está permitida, no es entidad de dominio — ver nota en spec §2.5).
- [x] Tests de los 3 niveles documentados con evidencia, incluido el test de concurrencia del lock de fila (Decisión D, ambos niveles: unitario de orden + prueba real de dos altas simultáneas).
- [x] Verificación en navegador de los mensajes exactos de la HU — confirmado por el Scrum Master (24/09), ver §8.
- [ ] PR con diff acotado a esta HU — a hacer manualmente por el Scrum Master (commit y push pendientes; Claude Code no hizo git add ni commit en ningún momento).

---

## 8. Evidencia de implementación

### Backend (Claude Code, verificado con curl + tests contra servidor real y base de desarrollo)

| Criterio | Cómo se verificó |
|---|---|
| 1 — Búsqueda desde 2 caracteres, parcial, sin mayúsculas/acentos; Apellido/Nombre/DNI; uno o varios alumnos; sin repetidos | curl: `q=a` devuelve resultados incluyendo "Álvarez"; DNI parcial funciona. Un `alumno_id` repetido en el body → `400`. Lista vacía → `400`. |
| 2 — Solo profesores activos de la materia; mensaje si no hay | curl: la lista de Química devuelve 5 profesores. Mensaje de "sin profesores" cubierto por test de componente. |
| 3 — Horario de atención; intervalo completo; turnos contiguos no chocan; solo cuentan turnos agendados | curl: superposición → "El profesor ya tiene un turno agendado de 08:00 a 11:00"; fuera de horario → mensaje correspondiente; turno contiguo (justo después de otro) → `200`. |
| 4 — El alumno no puede tener otro turno superpuesto | curl → `409` "El alumno ya tiene un turno agendado en ese horario", con `detalles.alumno_id` del alumno en conflicto (Decisión C). |
| 5 — Cupo | curl: 3 alumnos con cupo 2 → `409` "El turno alcanzó su cupo máximo"; agregar a un turno `COMPLETO` → `409`. |
| 6 — Quitar sin afectar a los demás; Completo vuelve a Disponible | curl sobre `seed-turno-10`: Disponible 1/3 → agregó 2 → Completo 3/3 → quitó 1 → Disponible 2/3, los otros dos siguen inscriptos. Sobre `seed-turno-07` (Completo 1/1 del seed): al quitar el único alumno queda Disponible 0/1 (Decisión B). |
| 7 — Revalidación al confirmar, en una única operación (concurrencia) | Todo dentro de una transacción. Prueba real sobre `seed-turno-08` (1 lugar libre): dos altas simultáneas → una `200` (Completo 3/3), la otra `409 CUPO_INSUFICIENTE`. Test unitario verifica el orden `FOR UPDATE` → conteo (Decisión D). |
| 8 — Ante conflicto el turno no cambia y se identifica el recurso | Los 3 mensajes de conflicto verificados por curl; en la base, el turno no cambió tras cada intento fallido. |
| 9 — Guarda profesor y alumnos; sigue Pendiente; se puede reemplazar | curl: asignar 2 alumnos → `200 PENDIENTE`; reemplazar por 1 → `turno_alumno` queda con exactamente 1 fila (sin huérfanos). Mensaje de éxito y "Continuar con aula" cubiertos por test de componente. |
| 10 — Cancelar no cambia nada | Cubierto por test de componente (no se envía el `PATCH`). |

**Guardas extra (Decisión A):** turno vencido → `409 TURNO_VENCIDO` al agregar o quitar; turno `PENDIENTE` → `409 TURNO_PENDIENTE`; quitar un alumno no inscripto → `404 ALUMNO_NO_ASIGNADO`.

**Eventos verificados en base:** `turno:participantes_asignados` (con `alumno_ids`), `turno:alumno_quitado`, `turno:disponible_nuevamente` — payload conforme a la spec §4.

**Textos de éxito redactados por Claude Code** (no estaban definidos literalmente en la HU): "Alumno agregado al turno", "Alumno quitado. El turno volvió a Disponible." — a revisar en el navegador junto con el resto.

**Checklist de comandos:** `tsc --noEmit` (0 errores), `eslint src` (0 errores, 1 warning preexistente), `build` con y sin `.env` (pasa ambos), `vitest` turnos+calendario (45/45), `vitest` del componente de participantes (6/6, corrido con `npx` porque `vitest` no es dependencia del proyecto). No se tocó Módulo B, no hizo falta correr sus tests.

**Estado de la base de desarrollo:** las pruebas modificaron `seed-turno-07`, `08` y `10`, y crearon 5 turnos `PENDIENTE` de prueba con fecha 29/09. Para volver el seed a su estado original alcanza con `npx prisma db seed` (sin reset); los turnos de prueba quedan hasta ese momento.

**Nota operativa de Claude Code:** si al levantar el servidor todas las rutas de `/api` devuelven `404` (incluida `/api/auth/csrf`) sin relación con el código, se resolvió reiniciando el servidor de desarrollo.

### Primera ronda de verificación en navegador (Scrum Master, 24/09) — resultado

Verificado con usuario Mesa de Entradas, puntos 1 a 3 de la lista original:

- ✅ Buscador con debounce (2+ caracteres), resultados correctos.
- ✅ Alumnos agregados con botón "Quitar" (implementados como filas, no como chips — funcionalmente equivalente, no se pidió cambiarlo) y contador "(n/cupo)".
- ⚠️ Conflicto de disponibilidad: no se pudo probar por falta de un turno superpuesto en el seed — **resuelto en la segunda ronda, ver abajo** (turno de prueba `prueba-c04-superposicion`).
- ✅ Mensaje de éxito "Profesor y alumnos asignados correctamente" — correcto.
- ✅ `DirtyStateContext` vía "Cerrar sesión" y "Cancelar" del formulario — correcto.
- 🐛 **Bug encontrado:** `DirtyStateContext` no cubría la navegación por el menú, el logo, ni "Volver al listado" — solo `LogoutButton` lo chequeaba. **Corregido, ver "Segunda ronda" abajo.**
- ✅ Alta/baja individual en `seed-turno-10`: contador y transición de badge Disponible⇄Completo correctos.
- 🐛 **Bugs encontrados y corregidos** (ver detalle abajo): pluralización "1 resultados", detalle del turno mostrando el DNI de un solo alumno, e inconsistencia de puntuación en los mensajes de éxito de alta/baja individual.

### Segunda ronda — correcciones aplicadas por Claude Code (24/09)

**1. Pluralización:** corregida en `buscador-alumnos.tsx:54` ("1 resultado" / "n resultados").

**2. `DirtyStateContext` extendido a todo el proyecto** (no solo Turno — es el mismo gap en Alumnos, Aulas, Materias y Profesores):
- El diálogo ahora vive en `DirtyStateProvider`, reusando `ConfirmarDescarteDialog` ("Hay datos sin guardar. ¿Salir de todas formas?" / "Seguir editando" / "Salir sin guardar").
- Nuevo `<LinkProtegido>` (`src/components/sesion/link-protegido.tsx`, usa `onNavigate` de Next 16.3) reemplaza los links comunes del menú, el logo, y todos los "Volver…".
- `beforeunload` cubre recarga/cierre de pestaña (con el texto nativo del navegador, no personalizable).
- Excepciones correctas: la redirección por sesión expirada y la recarga por bfcache no disparan el aviso (son navegación del sistema, no del usuario). Ningún botón "Cancelar" pasa por `LinkProtegido` — se mantiene el comportamiento ya establecido por cada HU (los formularios de Alumnos/Materias/Profesores ya pedían confirmación en su Cancelar según sus propias HU; solo `aula-form` y los dos de Turno cancelan sin preguntar, comportamiento documentado en `spec_modulo_C.md` — **no se tocó ninguno de los dos grupos**).
- **Limitación conocida, aceptada:** el botón "atrás" del navegador no dispara ninguna confirmación (no hay forma estándar de interceptarlo en App Router). Documentado, no bloqueante.
- **Archivos tocados fuera de Turno** (revisar en el PR de esta HU o separar en un PR de infraestructura transversal — a decidir): `src/components/sesion/dirty-state-context.tsx`, `link-protegido.tsx` (nuevo), `proteger-cache-navegador.tsx`; `src/lib/salida-sin-confirmar.ts` (nuevo), `fetch-autenticado.ts`; `src/components/layout/SidebarNav.tsx`; en Alumnos: `[id]/contacto`, `[id]/editar`, `[id]/forma-pago`; en Profesores: `[id]/contacto`, `[id]/materias`, `horarios/nuevo`, `asociar-materias-form.tsx`, `registrar-horario-form.tsx`; en Turno (HU-C-03): `turno-configuracion.tsx` ("Volver al listado").

**3. Detalle del turno:** fila única "Alumnos" con "Apellido, Nombre · DNI" por alumno, reemplazando las filas separadas "Alumno"/"DNI alumno" que solo mostraban el primero. Se sacaron `alumno_id` y `alumno_dni`, sin uso, del tipo y del servicio.

**4. Mensajes:** "Alumno agregado al turno" y "Alumno quitado del turno", ambos sin punto final (antes tenían punto). Las variantes de dos oraciones (cupo alcanzado / vuelta a Disponible) quedan como estaban.

**Turno de prueba para el criterio 4 (conflicto de horario)** — creado solo en la base local, no en el seed:
- `prueba-c04-superposicion`: 2026-10-01, 11:00–12:00, Disponible, Matemática, prof. Giménez Laura, Aula 1, con Sánchez Martina (DNI 40100007) inscripta.
- Cómo probarlo: en `/turnos/seed-turno-11/participantes` (10:00–12:00 el mismo día), agregar a Sánchez Martina → debería aparecer "El alumno ya tiene un turno agendado en ese horario" con su fila marcada.

**Comandos:** `tsc --noEmit` y `eslint` pasan, `build` pasa. Los tests unitarios siguen sin poder correrse (falta `vitest`/`jsdom` como dependencia instalada, arrastrado desde HU-C-03) — ningún test depende de los textos cambiados.

### Verificación en navegador — segunda ronda, resultado (Scrum Master, 24/09)

1. ⏳ Con cambios sin guardar en el formulario de participantes: navegar por el menú, el logo, "Volver al listado", y F5 → **pendiente de confirmar.**
2. ✅ "Cancelar" en participantes → sale sin preguntar, confirmado.
3. ✅ "Cerrar sesión" con cambios sin guardar → muestra su propio diálogo, sin el aviso nativo duplicado. Confirmado.
4. ✅ Conflicto de horario contra `prueba-c04-superposicion`: en `/turnos/seed-turno-11/participantes`, al agregar a Sánchez, Martina apareció marcada en rojo con "El alumno ya tiene un turno agendado en ese horario", y el aviso "El turno alcanzó su cupo máximo" se disparó correctamente al llegar a 5/5. Confirmado.
5. ✅ Detalle del turno (`seed-turno-10`, visto como Gerente): fila "Alumnos" con "Apellido, Nombre · DNI" por cada uno. Confirmado.
6. ⏳ Mensajes sin punto final al agregar/quitar individualmente ("Alumno agregado al turno", "Alumno quitado del turno") — **pendiente de confirmar** (se probó en la primera ronda con la versión anterior, con punto).
7. ✅ Control de acceso por rol: como Gerente, en `/turnos/seed-turno-10` no aparece ningún control de alta/baja individual. Confirmado.

### Tercera ronda — resultado (24/09)

1. Confirmación al salir con cambios sin guardar, sobre `seed-turno-11/participantes`:
   - ✅ Menú ("Alumnos › Listado"): diálogo correcto, "Seguir editando" mantiene el cambio.
   - ✅ Logo "Noctium": mismo diálogo.
   - ✅ "Volver al listado": mismo diálogo.
   - ✅ "Salir sin guardar": navega afuera y el cambio no se persiste (turno volvió a mostrar el estado previo al recargar).
   - ⏳ F5 (aviso nativo del navegador): no se pudo automatizar — el aviso de Chrome bloquea la extensión. Confirmado indirectamente que la app dispara `beforeunload` correctamente solo cuando hay cambios sin guardar. **Requiere que el Scrum Master lo dispare manualmente, un solo click de F5 en una pantalla con cambios sin guardar, para verlo con sus propios ojos.**
6. ✅ Mensajes exactos confirmados en `seed-turno-10`: "Alumno agregado al turno" y "Alumno quitado del turno", ambos sin punto final.

✅ **F5 confirmado por el Scrum Master (24/09):** con el cambio sin guardar en `seed-turno-11` (3/5), al recargar apareció el diálogo nativo de Chrome "¿Quieres volver a cargar el sitio web? Es posible que los cambios no se guarden." — comportamiento correcto.

**Los 7 puntos de verificación quedan cerrados.** HU-C-04 verificada end-to-end (backend por curl/tests + frontend en navegador con los 3 roles relevantes).

**Nota adicional (no bloqueante):** en `seed-turno-10`, "Última actualización" y "Modificado por" no cambian al agregar/quitar un alumno individual — solo se actualizan cuando el turno transiciona de estado (Disponible↔Completo). Es coherente con el modelo de datos (el alta/baja individual solo escribe en `TurnoAlumno`, no en la fila de `Turno`, salvo que haya transición), no es un bug. Si en algún momento se quiere que esos campos reflejen también los cambios de alumnos, es una decisión de diseño a futuro, no algo a resolver en esta HU.

**Antes de probar:** correr `npx prisma db seed` si el seed quedó con los cambios de las pruebas de Claude Code (no aplica al turno `prueba-c04-superposicion`, que vive fuera del seed).