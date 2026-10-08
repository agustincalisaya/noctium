```markdown
# Especificación Técnica — Módulo K (Aulas)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2) · Sprint 3 (nota, sin cambios de contrato)
## Revisión 2 — Sprint 2: modificación de aula (HU-K-03) y alineación al template de specs

## Nota de Sprint 3 (08/10/2026) — sin cambios de contrato

**Fuente:** backlog definitivo del Sprint 3 (40 HU · 107 SP). **Ninguna HU del Sprint 3 es de este módulo.** HU-K-04 (desactivar aula) **salió del backlog el 05/10/2026** y, como no hay Sprint 4, queda fuera del producto: las menciones de esta spec a «HU-K-04, Sprint 3» (HU-K-03 AC5 y «Fuera de alcance») se leen como **«no se implementa»**. El aula sigue sin baja lógica y `is_active` sigue sin ser editable desde 2.4. **Nada de lo desarrollado en los Sprints 1 y 2 cambia:** rutas, schemas, `code` de error y permisos quedan como están.

| Origen | Efecto sobre Aulas | Qué hay que hacer |
|---|---|---|
| HU-C-20, HU-C-22 y HU-C-24 (`spec_modulo_C.md` Revisión 6, 2.16) | `ajustarCuposPorCapacidadDeAula` **conserva firma y forma del resultado**. Ahora cuenta solo inscripciones **vigentes**, y una reserva vencida sin marcar **no** genera conflicto de capacidad (`spec_modulo_C.md` 2.15). La regla 3.4 de esta spec sigue valiendo | **Nada en el código de K.** Revisar que las pruebas de Sprint 2 de 2.4 sigan pasando (usan inscripciones vigentes) |
| HU-C-21 (aula distinta por fecha ocupada, `spec_modulo_C.md` 2.9.1) | C consulta las aulas activas por las funciones públicas de 2.3, **sin cambios** | Nada |
| HU-C-19 y HU-C-23 (texto «clase» en lugar de «turno») | Los textos visibles de las pantallas de Aulas salen del archivo central. El mensaje del `409 CAPACIDAD_MENOR_A_INSCRIPTOS` se muestra como «…alumnos ya inscriptos en **clases** que usan esta aula»; el `code` y la regla **no cambian**. Si una prueba de Sprint 2 compara el texto literal, la ajusta HU-C-19 | Lo hace HU-C-19 |
| HU-D-08 (`spec_modulo_D.md` 2.13.3) | Cambiar el profesor de una clase **no toca el aula** ni el cupo | Nada |

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (patrón de unicidad case-insensitiva y de modificación, como referencia de diseño) · `spec_modulo_C.md` Revisión 5 (§2.15, ajuste de cupos) · `spec_modulo_B.md` §2.5 y §3.3 (patrón de concurrencia optimista) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**HU contractualizadas en esta revisión:** HU-K-01 (Registrar aula), HU-K-02 (Listar aulas) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-K-03 (Modificar datos del aula).

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-K-03 | Gap — «Modificación de un aula ya registrada» figuraba como fuera de alcance | Añadida sección 2.4 (aditiva, no renumera) y reglas 3.4 y 3.5 |
| HU-K-02 | Contractualizada (Sprint 1) | El detalle `GET /api/aulas/[id]` (§2.2) devuelve `version`, que consume 2.4. Sin otro cambio de contrato |
| HU-K-01 | Contractualizada (Sprint 1) | Sin cambio de contrato; estructura alineada al template (Servicio, Errores esperados, §4) |

**Changelog — Revisión 2 (Sprint 2) — detalle:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-K-03 | Gap — "Modificación de un aula ya registrada" figuraba como fuera de alcance | Nueva sección 2.4 (aditiva, no renumera). Nueva regla 3.4 |
| Modelo `Aula` | Sin campos de modificación | + `updatedAtAula`, `modificadoPorUsuarioId`, `version` (control de concurrencia optimista, mismo patrón que `Alumno`, `spec_modulo_B.md` §3.3) |
| Permisos | `aulas:crear`, `aulas:leer` (GERENTE) | + `aulas:editar` (GERENTE). Matriz completa en `spec_modulo_A.md` §2.4 |
| `spec_modulo_C.md` | — | HU-K-03 consume `ajustarCuposPorCapacidadDeAula()` (Revisión 5 de C, §2.15) |

**Fuera de alcance de esta spec (explícito):**
- ~~Modificación de un aula ya registrada.~~ **Incorporada en Revisión 2** (2.4, ver «Actualización de alcance» más abajo).
- Baja lógica / reactivación de aulas.
- Consulta automática de disponibilidad por horario: eso lo resuelve `spec_modulo_C.md` (HU-C-15) al momento de asignar un aula a un turno — este módulo no expone ningún endpoint de disponibilidad propio.

**Actualización de alcance — Revisión 2 (Sprint 2):** la **modificación de nombre/número y capacidad** de un aula pasa a estar dentro de alcance (2.4). Siguen fuera: baja lógica y reactivación (HU-K-04, Sprint 3) y cualquier cambio en la asignación de aulas a turnos confirmados.

---

## 1. Visión General

El Módulo K gestiona el catálogo de aulas — el espacio físico que `spec_modulo_C.md` (HU-C-15, §2.3) asigna a un turno `PENDIENTE` y cuya capacidad fija el cupo del turno. Asignar el aula **no** cambia el estado del turno: sigue `PENDIENTE` y la confirmación (a `DISPONIBLE` o `COMPLETO`) ocurre en `spec_modulo_C.md` §2.2. Solo el rol Gerente puede dar de alta aulas en este sprint.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `src/server/aulas/aula.service.ts` (Regla N.° 4 de `docs/RULES.md`).

**Alcance de esta revisión:** la Revisión 2 es aditiva. Incorpora la sección 2.4 (HU-K-03) y las reglas 3.4 y 3.5 al final de sus bloques, sin renumerar las secciones 2.1–2.3 y 3.1–3.3 preexistentes, para no romper las referencias cruzadas de otras specs (ver `docs/adicionales/sdd-metodologia.md`). Las secciones 2.1–2.3 no cambian de contrato; el detalle de 2.2 suma `version`, que consume 2.4. La baja lógica y la reactivación (HU-K-04) siguen fuera de alcance (Sprint 3).

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Aula`, incluido el parámetro `[id]`, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("aulas:<accion>")` (Regla N.° 10).
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/aula.types.ts`, Server Actions en `src/server/aulas/actions.ts` y services en `src/server/aulas/aula.service.ts` y servicios públicos en `src/server/aulas/aula.publico.ts`. Imports siempre con el alias `@/`.

---

### 2.1. Alta de Aula (HU-K-01)

**Ruta:** `POST /api/aulas`
**Server Action equivalente:** `crearAula()` en `src/server/aulas/actions.ts`
**Servicio:** `crearAula()` en `src/server/aulas/aula.service.ts`
**Permiso requerido:** `aulas:crear` (exclusivo del rol Gerente)

```typescript
// src/server/aulas/aula.schema.ts
export const CrearAulaSchema = z.object({
  nombre: z.string()
    .trim()
    .min(1, "El nombre o número del aula es obligatorio")
    .max(30, "El nombre no puede superar los 30 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")),
  capacidad: z.coerce.number()
    .int("La capacidad debe ser un número entero")
    .positive("La capacidad debe ser mayor a cero"),
});
export type CrearAulaInput = z.infer<typeof CrearAulaSchema>;
```

**Comportamiento esperado (`src/server/aulas/aula.service.ts` → `crearAula`):**
1. Calcular `nombre_normalizado = normalizarTexto(nombre)` (misma utilidad compartida que declara `spec_modulo_L.md` §2.1, cuya ubicación en el repositorio se fija allí y está a confirmar contra el código; no se define una ruta propia en este módulo — cubre el requisito de comparación case-insensitive del criterio de aceptación, y de paso también acentos, aunque no se esperan en nombres de aula; reutilizar la utilidad existente es preferible a escribir una comparación más limitada solo para este módulo).
2. Verificar unicidad aplicativa de `nombre_normalizado` contra **todas** las aulas, activas e inactivas. Si existe: `409 NOMBRE_DUPLICADO`.
3. Revalidación inmediatamente antes del `INSERT` + defensa de constraint único (`P2002`) — mismo patrón que `spec_modulo_L.md` §3.2.
4. Insertar con `is_active: true`, fecha de alta y usuario registrante.
5. **Aclaración explícita:** el alta **no** asigna el aula a ningún turno de forma automática — es solo la creación del recurso; su asignación es responsabilidad exclusiva de HU-C-15 (`spec_modulo_C.md`).
6. Emitir `aula:creada` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Aula 3", "capacidad": 25, "is_active": true }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "NOMBRE_DUPLICADO", "message": "Ya existe un aula registrada con ese nombre" } }
```

**Errores esperados:** `400` (validación Zod, Regla N.° 6) · `403 SIN_PERMISO` · `409 NOMBRE_DUPLICADO` (unicidad aplicativa o violación `P2002`).

---

### 2.2. Listado y detalle de Aulas (HU-K-02)

**Ruta (listado):** `GET /api/aulas`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** listado de aulas en `src/server/aulas/aula.service.ts` (nombre de la función: a confirmar contra el código)
**Permiso requerido:** `aulas:leer`

```typescript
export const ListarAulasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado — orden natural:**
El criterio de aceptación exige orden **natural**, no alfabético puro: `"Aula 2"` antes que `"Aula 10"` (un `ORDER BY nombre ASC` estándar de Postgres pondría `"Aula 10"` antes que `"Aula 2"`, por comparar carácter a carácter).

**Decisión técnica:** se crea una collation ICU con orden numérico habilitado, aplicada a la columna `nombre` de `Aula`:
```sql
-- Migración
CREATE COLLATION IF NOT EXISTS natural_es (provider = icu, locale = 'es-u-kn-true');
ALTER TABLE "Aula" ALTER COLUMN "nombre" TYPE varchar(30) COLLATE "natural_es";
```
> **A confirmar contra `schema.prisma` antes de migrar:** el SQL usa `"Aula"` y `"nombre"` como nombres ilustrativos; el modelo usa `idAula`, `nombreAula` y `capacidadAula`, y las tablas pueden tener un `@@map`/`@map` distinto. La migración debe escribirse con los nombres reales de tabla y columna (los que genere `prisma migrate`).
Con la collation aplicada a nivel de columna, el `orderBy: { nombre: "asc" }` habitual de Prisma ya produce el orden natural esperado sin necesidad de una consulta raw en cada listado — la collation es una propiedad de la columna, no de la query.

**Comportamiento esperado (general):**
- Incluye aulas activas e inactivas (columna Estado las distingue).
- Cada ítem: nombre/número, capacidad, estado.
- Paginación server-side con metadatos.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "nombre": "Aula 2", "capacidad": 30, "is_active": true },
      { "id": "cuid", "nombre": "Aula 10", "capacidad": 20, "is_active": true }
    ],
    "paginacion": { "total": 8, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Errores esperados:** `400` (query inválida, Regla N.° 6) · `403 SIN_PERMISO`.

**Ruta (detalle):** `GET /api/aulas/[id]`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** detalle de aula en `src/server/aulas/aula.service.ts` (nombre de la función: a confirmar contra el código)
**Permiso requerido:** `aulas:leer`

**Comportamiento esperado (detalle):** devuelve nombre/número, capacidad, estado, fecha de alta y `version` (la lee el formulario de HU-K-03 y la reenvía en el `PATCH` de 2.4).

**Respuesta `200 OK`:** los campos indicados arriba, en el envoltorio estándar `{ "data": { ... }, "error": null }`.

**Errores esperados:** `403 SIN_PERMISO` · `404 AULA_NO_ENCONTRADA`.

---

### 2.3. Servicios públicos del módulo (Regla N.° 3)

Funciones declaradas en `src/server/aulas/aula.publico.ts` (Regla N.° 3 y 11: los servicios públicos van en un archivo `*.publico.ts` aparte de `aula.service.ts`) que otros módulos invocan en lugar de consultar la tabla `aulas` directamente. No son endpoints ni requieren un permiso `aulas:*`: el control de acceso lo hace la ruta del módulo que las consume (hoy, `turnos:asignar_aula` en `spec_modulo_C.md` §2.3). El parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador para ejecutarse dentro de su `prisma.$transaction`.

| Función | Devuelve | Consumidores |
|---|---|---|
| `verificarAulaActiva(id, db?)` | `{ idAula, capacidadAula }` si el aula existe y está activa; `null` en cualquier otro caso | `spec_modulo_C.md` §2.3 (HU-C-15): aula elegida al asignar |
| `listarAulasActivasParaTurno(capacidadMinima)` | `{ id, nombre, capacidad }[]` de las aulas activas con `capacidad >= capacidadMinima`, en el orden natural de la columna (§3.2). C le pasa `max(1, alumnos.length)` (`spec_modulo_C.md` §2.3) | `spec_modulo_C.md` §2.3 (HU-C-15): opciones de aula (`GET /api/turnos/aula/opciones`) |
| `hayAulasActivas(db?)` | `boolean`: si existe al menos un aula activa | `spec_modulo_C.md` §2.3 (HU-C-15): distinguir "No hay aulas activas registradas" |
| `existeAula(id, db?)` | `boolean`: si el aula existe, activa o inactiva | `spec_modulo_C.md` §2.3 (HU-C-15): separar aula inexistente de aula inactiva |

**No importa nada de otros módulos** (evita ciclos con Turnos, que consume este archivo mientras `modificarAula()` en `aula.service.ts` consume `turno.publico.ts`). **A confirmar contra el código:** si hoy estas funciones viven en `aula.service.ts`, se mueven a `aula.publico.ts` y se actualizan los imports de C (`turno.aula.service.ts`); es una tarea técnica, sin cambio de contrato.

Ninguna de estas funciones evalúa disponibilidad por horario (§3.3): esa validación sigue siendo exclusiva del Módulo C. El criterio de **capacidad mínima** de `listarAulasActivasParaTurno` (`max(1, alumnos.length)`) lo define `spec_modulo_C.md` §2.3; este módulo solo lo aplica como filtro de consulta.

---

### 2.4. Modificar datos del aula (HU-K-03) — NUEVA en Revisión 2

**Ruta:** `PATCH /api/aulas/[id]`
**Server Action equivalente:** `modificarAula()` en `src/server/aulas/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `modificarAula()` en `src/server/aulas/aula.service.ts`
**Permiso requerido:** `aulas:editar` (exclusivo del rol Gerente)
**Pantalla:** modo edición del mismo detalle `/aulas/[id]` (mapa de pantallas §1, "Ficha de aula"), con el formulario precargado con el nombre y la capacidad actuales; página completa, feedback por banner inline "Aula actualizada correctamente". Mismo patrón que HU-B-06 y HU-D-06.
**Cancelar (HU-K-03 AC4):** botón «Cancelar» del modo edición (`AulaForm`). Mismo contrato que `spec_modulo_L.md` §2.4 «Cancelar (AC4)», con el mismo texto:
- **Sin cambios sin guardar** (los valores coinciden con los cargados): vuelve al detalle `/aulas/[id]` en modo lectura, sin diálogo y sin llamar a la API.
- **Con cambios sin guardar** (formulario marcado como modificado en `DirtyStateContext`): no navega; abre un diálogo de confirmación con el título «¿Descartar los cambios?», el texto «Tenés cambios sin guardar. Si salís de esta pantalla, se van a perder.» y dos botones: «Seguir editando» (cierra el diálogo y conserva lo tipeado) y «Descartar cambios» (vuelve al detalle en modo lectura con los valores guardados, sin llamar a la API).
- El mismo diálogo aparece si se abandona la pantalla por otro camino (menú, logo, cerrar sesión), porque `DirtyStateProvider` centraliza la salida con cambios sin guardar. Si el componente ya implementado usa otro texto, prevalece el existente y se actualiza también L §2.4 (a confirmar contra el código).

```typescript
// src/server/aulas/aula.schema.ts
export const ModificarAulaSchema = CrearAulaSchema.partial().extend({
  version: z.number().int().nonnegative(), // control de concurrencia optimista — obligatorio
}).strict();
export type ModificarAulaInput = z.infer<typeof ModificarAulaSchema>;
```
Mismas reglas de `nombre` y `capacidad` que 2.1 (HU-K-01); `.strict()` rechaza cualquier otro campo, en particular `is_active` (HU-K-03 AC5: desactivar es HU-K-04, Sprint 3).

**Comportamiento esperado (`aula.service.ts` → `modificarAula`), dentro de una única `prisma.$transaction`:**
1. El aula debe existir: `404 AULA_NO_ENCONTRADA`. Se compara el payload con los valores actuales; si ningún campo cambia, responde `200` con `campos_modificados: []` sin escribir ni incrementar `version` (la UI mantiene "Guardar" deshabilitado sin cambios).
2. Si cambia `nombre`: recalcular `nombreNormalizadaAula = normalizarTexto(nombre)` y verificar unicidad **excluyendo la propia aula**, contra todas las demás, activas e inactivas: `409 NOMBRE_DUPLICADO`. Defensa del constraint único (`P2002`) traducida al mismo `409` (mismo patrón que 2.1).
3. **Concurrencia optimista (Regla N.° 7):** condición y mutación en una única sentencia, igual que `spec_modulo_B.md` §2.5 paso 3:
   ```typescript
   const r = await tx.aula.updateMany({
     where: { idAula: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE"); // el aula existe (paso 1): alguien la modificó antes
   ```
4. **Si cambia `capacidad`** (HU-K-03 AC2 y AC3): en la **misma transacción**, invocar `ajustarCuposPorCapacidadDeAula(aulaId, nuevaCapacidad, usuarioId, tx)` (`spec_modulo_C.md` §2.15):
   - Si algún turno **futuro** `DISPONIBLE` o `COMPLETO` que usa el aula tiene más alumnos inscriptos que la nueva capacidad: se lanza `409 CAPACIDAD_MENOR_A_INSCRIPTOS` con el mensaje literal "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula", y **toda la transacción se revierte** (tampoco se guarda el nombre). La validación es solo contra turnos con fecha futura: los pasados no bloquean el cambio (AC2).
   - Si no hay conflicto: los turnos futuros que ya tenían esta aula actualizan su `cupoMaximoTurno` a la nueva capacidad (mismo criterio de HU-C-15: cupo = capacidad del aula, AC3) y los `DISPONIBLE`/`COMPLETO` **recalculan su estado** (`COMPLETO` si los inscriptos alcanzan el nuevo cupo, `DISPONIBLE` si queda lugar). Un turno futuro `PENDIENTE` con esta aula solo actualiza su cupo y sigue `PENDIENTE` (`spec_modulo_C.md` §2.15). Los turnos pasados conservan su cupo histórico.
5. Solo se escriben los campos efectivamente provistos (diff). `id`, `is_active` y `createdAtAula` nunca son editables desde este endpoint.
6. Después del `COMMIT`, el servicio emite los eventos que `ajustarCuposPorCapacidadDeAula()` devolvió en `eventos` (`turno:cupo_actualizado` y, si hubo transición, `turno:completado` / `turno:disponible_nuevamente`), con `emitirEventosTurno(eventos)` (exportada por `turno.publico.ts`, `spec_modulo_C.md` §2.15). Este módulo no escribe en `eventos_turno` por su cuenta (Regla N.° 3).

**Modelo (cambios en `schema.prisma`):**
```prisma
model Aula {
  // ... campos existentes ...
  updatedAtAula          DateTime @default(now()) @updatedAt   // NUEVO
  modificadoPorUsuarioId String?                                // NUEVO, escalar sin relación
  version                Int      @default(0)                   // NUEVO, concurrencia optimista
}
```
Migración aditiva; las aulas existentes quedan con `version = 0`.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["capacidad"], "version": 3, "turnos_actualizados": 4 }, "error": null }
```

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `404 AULA_NO_ENCONTRADA` · `409 NOMBRE_DUPLICADO` · `409 CONFLICTO_EDICION_CONCURRENTE` ("El aula fue modificada por otro usuario. Recargá para ver los datos actuales.") · `409 CAPACIDAD_MENOR_A_INSCRIPTOS` (con `detalle: { turnos_en_conflicto, max_inscriptos }`).

**Fuera de alcance:** desactivar el aula (HU-K-04, Sprint 3); reasignar aulas de turnos confirmados; modificar turnos pasados.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/aulas/aula.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Unicidad case-insensitiva contra el universo completo (activas + inactivas)
Mismo patrón que `spec_modulo_L.md` §3.1: un aula inactiva sigue "ocupando" su nombre. Doble validación (aplicativa + constraint `P2002`).

### 3.2. Orden natural es una propiedad de la columna, no de cada consulta
La collation `natural_es` (sección 2.2) se define una sola vez, a nivel de esquema. Ningún servicio debe implementar su propia lógica de ordenamiento natural en JavaScript ni con expresiones SQL ad-hoc por consulta — el `orderBy` estándar de Prisma ya es correcto gracias a la collation de la columna.

### 3.3. El alta no reserva el recurso
Crear un `Aula` no crea ni modifica ninguna relación con `Turno`. La asignación real, incluida su validación de disponibilidad por horario, es responsabilidad exclusiva de `spec_modulo_C.md` (HU-C-15) — este módulo no debe anticipar ni duplicar esa lógica.

---

### 3.4. La capacidad de un aula gobierna el cupo de los turnos futuros (Revisión 2)
Cambiar la capacidad de un aula **es** cambiar el cupo de los turnos futuros que la usan (`spec_modulo_C.md` §2.3: cupo = capacidad del aula). Por eso `modificarAula()` no decide por su cuenta: delega el ajuste y la validación en `ajustarCuposPorCapacidadDeAula()` de Turnos, dentro de su propia transacción, de modo que "guardar el aula" y "ajustar los turnos" son atómicos. Este módulo nunca hace `UPDATE` sobre `turnos` (Regla N.° 3).

### 3.5. Modificar no reserva ni libera recursos
Editar el nombre o la capacidad de un aula no crea ni elimina reservas en `reservas_turno`: el horario de los turnos no cambia. Solo cambia el cupo (y, por consecuencia, el estado `DISPONIBLE ⇄ COMPLETO` de los turnos ya confirmados; un turno `PENDIENTE` no cambia de estado).

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, el módulo usa la **opción (a) — columnas de auditoría en la propia entidad**: el alta registra fecha de alta y usuario registrante (HU-K-01) y la modificación registra `updatedAtAula`, `modificadoPorUsuarioId` y `version` (ver más abajo). Alcanza porque solo se necesita la trazabilidad del ciclo de vida normal del `Aula` (quién y cuándo la creó o modificó), sin eventos discretos repetibles sobre la misma entidad. Al ser parte de la propia fila, se persiste en la misma operación; no hay tabla de eventos propia (opción b) ni escritura posterior al `COMMIT`.

El evento `aula:creada` es la notificación de dominio declarada para el alta; no es el mecanismo de trazabilidad.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `aula:creada` | Alta de aula (2.1) | `aula_id, nombre, capacidad, usuario_id` |

**Revisión 2 (Sprint 2) — trazabilidad (Regla N.° 2).** La modificación de un aula usa la **opción (a)**: `updatedAtAula`, `modificadoPorUsuarioId` y `version` en la propia fila. No hay evento `aula:modificada`. Los eventos de los **turnos afectados** (cambio de cupo y transiciones de estado) los emite el Módulo C.
```
