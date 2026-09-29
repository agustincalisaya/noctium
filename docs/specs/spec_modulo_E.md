```markdown
# Especificación Técnica — Módulo E (Atención académica / Historial)
## Noctium — Sprint 2
## Revisión 1 — primera versión (módulo nuevo de Sprint 2)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` (Alumno) · `spec_modulo_C.md` Revisión 5 (Turno, §2.15) · `spec_modulo_D.md` (Profesor) · `spec_modulo_L.md` (Materias) · `schema.prisma` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§2, "Historial académico"; §4) · `docs/DESIGN.md` §6

**HU contractualizadas en esta revisión:** HU-E-01 (Registrar clase dictada), HU-E-06 (Registrar resultados de exámenes), HU-E-05 (Ver historial académico del alumno) — Sprint 2. Es la **primera revisión** del módulo: no existía `spec_modulo_E.md`.

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-E-01 | Gap — no contractualizada | Añadida sección 2.1 |
| HU-E-06 | Gap — no contractualizada | Añadida sección 2.2 |
| HU-E-05 | Gap — no contractualizada | Añadida sección 2.3 |

**Fuera de alcance de esta spec (explícito):**
- Asistencia individual (quién faltó): se asume que **todos los inscriptos** al momento de dictarse la clase asistieron (HU-E-01 AC5).
- Promedios, condición de aprobado/desaprobado y cualquier cálculo sobre las notas (HU-E-06 AC5).
- **Editar o anular** una clase dictada o un resultado de examen: son registros de hecho consumado (Regla N.° 8). Una corrección se resolvería con un registro compensatorio nuevo que referencie al original; el PO planificó una HU en Sprint 3 para solventar los casos en que haya que corregir (Q7e).
- Indicaciones académicas y evolución del alumno como texto libre: el backlog final de HU-E-01 no incluye ese campo (el borrador de los PO decía "con indicaciones académicas"). **Ratificado por el PO (29/09/2026) — Q7a**: las indicaciones académicas son HU-E-04, planificada para Sprint 3.
- Filtros del historial distintos de la materia; exportación.

---

## 1. Visión General

El Módulo E registra los hechos académicos de un alumno y los muestra como una línea de tiempo. Gestiona dos registros **inmutables** y una vista de solo lectura:

1. **`ClaseDictada`** — constancia de que un turno se dictó, con la lista de alumnos que estaban inscriptos en ese momento. Se dispara **desde el Detalle de turno** (mapa de pantallas §2), no desde la ficha del alumno.
2. **`ResultadoExamen`** — la nota de un alumno en una materia. Se dispara **desde la ficha del alumno**, dentro del tab "Historial académico": un examen no está atado a un turno puntual.
3. **Historial académico** — vista de solo lectura del mismo tab, con ambos registros en una única línea de tiempo por fecha, filtrable por materia.

**Pantallas (mapa de pantallas):** no hay pantalla nueva de este módulo. E-01 es una acción (`AlertDialog`, sin campos) del Detalle de turno; E-06 es una acción (`Dialog`) del tab; E-05 es el tab "Historial académico" de la ficha del alumno (`/alumnos/[id]`).

Implementación estándar: Route Handlers delgados que delegan en `src/server/historial/clase-dictada.service.ts`, `resultado-examen.service.ts` y `historial.service.ts` (Reglas N.° 4 y 11). Como en Turnos, el frontend llama directamente a los Route Handlers; no se crea `actions.ts` sin uso.

**Alcance de esta revisión:** módulo nuevo de Sprint 2; todas las secciones (2.1 a 2.4 y 3.1 a 3.5) son nuevas y aditivas. No hay secciones preexistentes, por lo que no se renumera nada (criterio de `docs/adicionales/sdd-metodologia.md`); las revisiones futuras (p. ej. la HU de corrección de Sprint 3, Q7e) se agregarán como secciones nuevas al final de la §2.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los ids de `ClaseDictada`, `ResultadoExamen`, `Alumno`, `Profesor` y `Materia` son CUID. **El `id` del turno en la URL no se valida como CUID** (ids de seed `seed-turno-NN`); un id inexistente responde `404`.
- Toda ruta requiere `withPermission("<recurso>:<accion>")` (Regla N.° 10). Permisos nuevos (matriz completa en `spec_modulo_A.md` §2.4):

| Permiso | Roles | Uso |
|---|---|---|
| `clases:registrar` | MESA_ENTRADA, PROFESOR | 2.1 |
| `examenes:registrar` | MESA_ENTRADA, PROFESOR | 2.2 |
| `historial:leer` | MESA_ENTRADA, GERENTE, PROFESOR | 2.3 |

- **Alcance del profesor (resuelto siempre en el servidor, nunca por parámetro):** el profesor efectivo se obtiene de la sesión con `obtenerOpcionProfesorDeUsuario()` (Módulo D). Sobre `clases:registrar`, un profesor solo opera sus **propios turnos**. Sobre `examenes:registrar` y `historial:leer`, un profesor solo opera **alumnos que atendió**, es decir, con al menos una `ClaseDictada` a su nombre que incluya al alumno. Se resuelve con `profesorAtendioAlumno(profesorId, alumnoId)` (§2.4). Fuera de ese alcance: `403 SIN_PERMISO`, sin revelar si el alumno existe: para el Profesor el chequeo de alcance va **antes** que el de existencia, de modo que un alumno inexistente y uno no atendido responden lo mismo. **No hay recorte por rol más allá de este alcance sobre alumnos:** dentro de un alumno atendido, el Profesor ve el historial completo (todas las clases y exámenes, de cualquier materia y de cualquier profesor) y registra exámenes de cualquier materia que el alumno haya cursado. **Q7b:** el PO ratificó (29/09/2026) que el Profesor **ve** el historial solo de alumnos que atendió. **Ratificado por el PO (29/09/2026):** el Profesor también **registra exámenes** (HU-E-06) solo a alumnos que atendió.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/historial.types.ts`, services en `src/server/historial/<archivo>.service.ts` (`clase-dictada`, `resultado-examen`, `historial`) y schemas Zod en `src/server/historial/*.schema.ts`; no hay `src/server/historial/actions.ts` porque el frontend llama a los Route Handlers (ver §1). Imports siempre con el alias `@/`. Route Handlers en `app/api/turnos/[id]/clase-dictada/route.ts`, `app/api/alumnos/[id]/examenes/**` y `app/api/alumnos/[id]/historial/route.ts`.

---

### 2.1. Registrar clase dictada (HU-E-01)

**Ruta:** `POST /api/turnos/[id]/clase-dictada` (sin body) · `GET` de la misma ruta devuelve el registro existente.
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`, ver §1)
**Servicio:** `src/server/historial/clase-dictada.service.ts` → `registrarClaseDictada()`
**Permiso requerido:** `clases:registrar`
**Presentación:** `AlertDialog` de confirmación simple, sin campos, en el Detalle de turno; toast "Clase dictada registrada correctamente" (texto definido por esta spec: la HU no lo fija; mapa de pantallas §4, `DESIGN.md` §6.1).

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. Bloquear y leer el turno con `bloquearTurnoParaOperacion(turnoId, tx)` (`spec_modulo_C.md` §2.15, `FOR SHARE`). Si no existe: `404 TURNO_NO_ENCONTRADO`.
2. **Alcance por rol:** si el rol es `PROFESOR` y `turno.profesor_id` no es el profesor efectivo: `403 SIN_PERMISO`.
3. El turno debe estar `DISPONIBLE` o `COMPLETO`; si no (`PENDIENTE` o `CANCELADO`): `409 TURNO_NO_ADMITE_CLASE` (AC1).
4. **Momento y condición de `registrar_clase` (definición única).** La acción `registrar_clase` está disponible —tanto en `acciones_habilitadas` del detalle de turno (`spec_modulo_C.md` §2.4, que **referencia** esta condición y no la redefine) como en este servicio— si y solo si se cumplen **las cuatro** condiciones siguientes:
   - (a) el turno está `DISPONIBLE` o `COMPLETO` (paso 3);
   - (b) el turno **ya terminó**: `fecha + hora_fin ≤ ahora`, en `America/Argentina/Buenos_Aires`;
   - (c) el turno **todavía no tiene** una clase dictada (paso 5);
   - (d) si el rol es `PROFESOR`, el turno es **propio** (paso 2).

   Si (b) no se cumple, el servicio responde `409 CLASE_NO_FINALIZADA`. Si (c) no se cumple, el `POST` no falla: devuelve el registro existente (paso 5) y la UI no ofrece la acción. **Divergencia respecto de la letra del AC1, ratificada por el PO (29/09/2026) — Q7c:** el backlog dice "cuya fecha/hora ya pasó" y esta spec toma el **fin** del turno y no su inicio, porque registrar como dictada una clase que sigue en curso no tiene sentido. Consecuencia conocida: entre el inicio y el fin del turno, aunque `spec_modulo_C.md` §3.8 ya lo considera vencido y congela sus inscripciones, la clase todavía no puede registrarse.
5. **Una sola clase por turno (AC3), sin duplicar bajo concurrencia:**
   ```sql
   INSERT INTO clases_dictadas ("idClaseDictada", "turnoId", ...) VALUES (...)
   ON CONFLICT ("turnoId") DO NOTHING;   -- $executeRaw parametrizado
   ```
   No se usa `create` + captura de `P2002`: dentro de una transacción de PostgreSQL, un error de constraint la deja abortada. Si `ON CONFLICT` no insertó (0 filas), se lee y devuelve el registro existente con `ya_existia: true` (AC3, "muestra el registro ya existente").
6. Si se insertó, copiar la **lista de alumnos inscriptos en ese momento** (`turno.alumno_ids`) como filas de `ClaseDictadaAlumno`, en la misma transacción. Es una **copia**, no una referencia viva al turno: el historial no cambia si después se edita la inscripción del turno. Un turno sin inscriptos igual puede registrarse (la lista queda vacía); no se inventa una restricción que el backlog no pide.
7. Copiar también `fechaClaseDictada`, `materiaId` y `profesorId` del turno (AC2): son la fotografía del hecho.

**Modelo (nuevo en `schema.prisma`):**
```prisma
model ClaseDictada {
  idClaseDictada        String   @id @default(cuid())
  turnoId               String   @unique               // una sola clase por turno (AC3)
  fechaClaseDictada     DateTime @db.Date
  materiaId             String
  profesorId            String
  createdAtClaseDictada DateTime @default(now())        // Regla N.° 2, opción (a)
  creadoPorUsuarioId    String?
  turno    Turno    @relation(fields: [turnoId], references: [idTurno])
  materia  Materia  @relation(fields: [materiaId], references: [idMateria])
  profesor Profesor @relation(fields: [profesorId], references: [idProfesor])
  alumnos  ClaseDictadaAlumno[]
  @@map("clases_dictadas")
}

model ClaseDictadaAlumno {
  claseDictadaId String
  alumnoId       String
  clase  ClaseDictada @relation(fields: [claseDictadaId], references: [idClaseDictada])
  alumno Alumno       @relation(fields: [alumnoId], references: [idAlumno])
  @@id([claseDictadaId, alumnoId])
  @@index([alumnoId])
  @@map("clases_dictadas_alumnos")
}
```
`Turno`, `Materia`, `Profesor` y `Alumno` agregan la relación inversa. Todas las FK son `RESTRICT`: un historial nunca se pierde (Regla N.° 1).

**Respuesta `201 Created` (o `200 OK` si ya existía):**
```json
{ "data": { "id": "cuid", "turno_id": "seed-turno-26", "fecha": "2026-09-25", "alumnos_registrados": 8, "ya_existia": false }, "error": null }
```

**Errores esperados:** `403 SIN_PERMISO` · `404 TURNO_NO_ENCONTRADO` · `409 TURNO_NO_ADMITE_CLASE` · `409 CLASE_NO_FINALIZADA`.

**`GET` (registro existente):** permiso `historial:leer`. Lee la `ClaseDictada` por `turnoId` sin consultar el turno: si no existe, `404 CLASE_NO_REGISTRADA` (también para un `turnoId` inexistente); si el rol es `PROFESOR` y `ClaseDictada.profesorId` no es el profesor efectivo, `403 SIN_PERMISO` (alcance por turno propio). Responde `200` con `{ id, registrada_en, registrada_por, alumnos: [{ id, nombre_completo }] }`. Fuentes de los datos (este módulo no consulta `usuarios` ni `alumnos`, Regla N.° 3):
- `registrada_por`: el **email** de la cuenta `creadoPorUsuarioId`, vía `obtenerEmailDeUsuario()` (`spec_modulo_A.md`, la misma que usa Turnos para `creado_por`); `null` si la cuenta no existe.
- `alumnos`: los ids de `ClaseDictadaAlumno` resueltos en lote con `obtenerAlumnosBasicos(ids)` (`spec_modulo_B.md` §2.8); `nombre_completo` es `"Apellido, Nombre"` y la lista va ordenada alfabéticamente por ese valor.

---

### 2.2. Registrar resultado de examen (HU-E-06)

**Ruta:** `POST /api/alumnos/[id]/examenes`
**Ruta de opciones:** `GET /api/alumnos/[id]/examenes/opciones` — devuelve `{ materias: [{ id, nombre }], escala: { min, max } }` (comportamiento en «Opciones del formulario», más abajo).
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`, ver §1)
**Servicio:** `src/server/historial/resultado-examen.service.ts` → `registrarResultadoExamen()`, `listarOpcionesExamen()`
**Permiso requerido:** `examenes:registrar`
**Presentación:** `Dialog` «Registrar resultado de examen» (mismo literal que el AC1 de HU-E-06) sobre el tab "Historial académico" de la ficha del alumno; al abrirlo pide `GET …/examenes/opciones` para poblar el selector de Materia y la escala; toast "Resultado registrado correctamente".

```typescript
// src/server/historial/resultado-examen.schema.ts
export const RegistrarResultadoExamenSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  fecha_examen: fechaCalendarioValidaSchema,        // utilidad compartida, spec_modulo_B.md §2.1
  // Número con punto decimal, como string, hasta 1 decimal. El frontend normaliza la coma decimal (es-AR, «8,5»)
  // a punto antes de enviar, igual que el monto en spec_modulo_I.md §2.4. La regex admite hasta 3 dígitos enteros
  // («100.0»); el rango lo rechaza el servicio con NOTA_FUERA_DE_RANGO.
  nota: z.string().trim().regex(/^\d{1,3}(\.\d)?$/, "La nota debe ser un número con hasta 1 decimal"),
}).strict();
export type RegistrarResultadoExamenInput = z.infer<typeof RegistrarResultadoExamenSchema>;
```

**Comportamiento esperado (`registrarResultadoExamen`), en `prisma.$transaction`:**
1. **Alcance y alumno.** Si el rol es `PROFESOR`: `profesorAtendioAlumno(profesorEfectivo.id, alumnoId)` (§2.4); si es `false` (o el usuario no tiene ficha de profesor): `403 SIN_PERMISO`, antes de consultar la existencia. Luego `verificarAlumnoActivo(alumnoId)` (Módulo B, `spec_modulo_B.md` §2.8): `404 ALUMNO_NO_ENCONTRADO` si la ficha no existe, `409 ALUMNO_INACTIVO` si está inactiva.
2. **Materia (AC1):** el alumno debe tener **al menos una clase dictada registrada** de esa materia (existe una fila `ClaseDictadaAlumno` → `ClaseDictada.materiaId`, sin importar qué profesor la dictó). Si no: `409 MATERIA_NO_CURSADA`. No hay un chequeo de existencia de la materia ni un código de error propio: `ClaseDictada.materiaId` es una FK `RESTRICT`, así que si hay clase la materia existe, y un `materia_id` inexistente cae en `MATERIA_NO_CURSADA`. Este paso no consulta el Módulo L. Una materia dada de baja **sí** admite el registro si el alumno la cursó (el hecho ya ocurrió).
3. `fecha_examen`: fecha válida, **no futura** respecto de hoy en `America/Argentina/Buenos_Aires`: `400 FECHA_EXAMEN_FUTURA` con el mensaje «La fecha del examen no puede ser futura», validada por el servicio con el sobre de error estándar (regla de esta spec: el AC no la pide; mismo criterio que `FECHA_PAGO_FUTURA` en `spec_modulo_I.md`).
4. **Nota (AC2):** dentro del rango `[nota_minima, nota_maxima]` de `ParametroSistema` (valores `1` y `10`; **Ratificado por el PO (29/09/2026) — Q7d**). Fuera de rango: `422 NOTA_FUERA_DE_RANGO`, mensaje "La nota debe estar entre {min} y {max}".
5. **Varios resultados por materia (AC3):** nunca se reemplaza el anterior; siempre se **inserta un registro nuevo** (recuperatorios, parciales).
6. No calcula promedio ni condición (AC5).

**Modelo (nuevo en `schema.prisma`):**
```prisma
model ResultadoExamen {
  idResultadoExamen       String   @id @default(cuid())
  alumnoId                String
  materiaId               String
  fechaExamen             DateTime @db.Date
  notaExamen              Decimal  @db.Decimal(4, 1)
  createdAtResultadoExamen DateTime @default(now())    // Regla N.° 2, opción (a)
  creadoPorUsuarioId      String?
  alumno  Alumno  @relation(fields: [alumnoId], references: [idAlumno])
  materia Materia @relation(fields: [materiaId], references: [idMateria])
  @@index([alumnoId, fechaExamen])
  @@map("resultados_examen")
}
```
Sin `updatedAt...`: no se actualiza (§3.1).

**Parámetros nuevos** (`ParametroSistema`): `nota_minima = 1`, `nota_maxima = 10`.

**Respuesta `201 Created`:** `{ "data": { "id": "cuid", "alumno_id": "cuid", "materia_id": "cuid", "fecha_examen": "2026-09-27", "nota": "8.5" }, "error": null }`

**Errores esperados:** `400` (validación) · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO` · `409 ALUMNO_INACTIVO` · `409 MATERIA_NO_CURSADA` · `422 NOTA_FUERA_DE_RANGO`.

**Opciones del formulario (`listarOpcionesExamen()`, `GET /api/alumnos/[id]/examenes/opciones`, HU-E-06 AC1).** Permiso `examenes:registrar`. Comportamiento:
1. **Alcance y alumno**, igual que el paso 1 del `POST`: Profesor sin haber atendido al alumno (o sin ficha de profesor) → `403 SIN_PERMISO`; ficha inexistente → `404 ALUMNO_NO_ENCONTRADO`; ficha inactiva → `409 ALUMNO_INACTIVO` (no se puede registrar a un alumno inactivo, así que tampoco se ofrecen opciones).
2. **Materias:** las materias **distintas** de las `ClaseDictada` en las que el alumno figura en `ClaseDictadaAlumno` (al menos una clase dictada registrada). Es exactamente el criterio del paso 2 del `POST`, de modo que toda materia ofrecida es aceptada al guardar. No se recorta por profesor ni por rol.
3. Los nombres se resuelven en lote con `obtenerMateriasPorIds()` (Módulo L). **Se incluyen las materias dadas de baja** que el alumno cursó (el hecho ya ocurrió). Orden alfabético por nombre.
4. `escala`: `{ min, max }` numéricos leídos de `ParametroSistema` (`nota_minima`, `nota_maxima`) con el lector de parámetros del proyecto (forma exacta: a confirmar contra el código).
5. Un alumno sin ninguna clase dictada responde `200` con `materias: []`; la UI muestra "Este alumno todavía no cursó ninguna materia" y deshabilita el guardado.

**Nota sobre el `422`:** `NOTA_FUERA_DE_RANGO` es el **único** `422` del proyecto (el resto de las reglas de negocio usa `400` o `409`). Es la **excepción de convención** del proyecto y queda a la espera de registrarse en `docs/RULES.md` (tarea de repositorio); no es una decisión abierta de esta spec.

**Dónde registra el Profesor (Q13):** el tab «Historial académico» de `/alumnos/[id]` se abre con `alumnos:leer` **o** `historial:leer` (2.3). El botón «Registrar resultado de examen» aparece en ese tab cuando el rol tiene `examenes:registrar` (Mesa de Entrada y Profesor, este último acotado a alumnos que atendió, Q7b). Como el Gerente no tiene `examenes:registrar`, no ve el botón.

---

### 2.3. Ver historial académico del alumno (HU-E-05)

**Ruta:** `GET /api/alumnos/[id]/historial`
**Server Action equivalente:** — (solo Route Handler; el módulo no define `actions.ts`, ver §1)
**Servicio:** `src/server/historial/historial.service.ts` → `obtenerHistorialAlumno()`
**Permiso requerido:** `historial:leer` (Mesa de Entrada, Gerente y Profesor, este último con el alcance de las convenciones)

```typescript
export const HistorialQuerySchema = z.object({
  materia_id: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(10).default(10), // HU-E-05 AC6 (backlog del 28/09): de a 10
});
```

**Comportamiento esperado:**
1. **Alcance y alumno.** Alcance de profesor: `403 SIN_PERMISO` (primero, sin revelar si el alumno existe). Luego alumno existente (`404 ALUMNO_NO_ENCONTRADO`). Un alumno inactivo **sí** tiene historial visible.
2. Combinar en **una sola consulta** los dos tipos de registro y paginarla (`$queryRaw` parametrizado con `UNION ALL`, ordenado por `fecha` descendente y `createdAt` descendente como desempate): las **clases dictadas** en las que el alumno figura en `ClaseDictadaAlumno` y sus **resultados de examen**. Paginar cada tipo por separado y mezclarlos rompería el orden. Filtro opcional `materia_id` (AC3).
   - **Materias del filtro (AC3):** la misma respuesta trae `materias_disponibles`, las materias distintas que aparecen en el historial del alumno, calculadas **sin aplicar** `materia_id`. No hay recorte por rol más allá del alcance sobre alumnos (ver convenciones): el Profesor que puede abrir a un alumno ve todo su historial, así que sus `materias_disponibles` son las de todo el historial del alumno y resueltas con `obtenerMateriasPorIds()`. El filtro no depende de `GET /alumnos/[id]/examenes/opciones`, que exige `examenes:registrar` y el Gerente no lo tiene.
3. Con la página ya resuelta, completar nombres en lote con los servicios públicos: `obtenerMateriasPorIds()` (Módulo L) y `obtenerNombresProfesores()` (Módulo D). Este módulo no consulta esas tablas.
4. Cada clase dictada: `fecha`, `materia`, `profesor`, `turno_id`. Cada examen: `fecha`, `materia`, `nota` (AC2). El campo `tipo` (`"CLASE_DICTADA" | "EXAMEN"`) permite que la UI los distinga **con texto o ícono, no solo color**.
5. Sin registros: `200` con `items: []`; la UI muestra "Este alumno todavía no tiene historial académico" (AC4).
6. **Solo consulta:** las altas viven en sus propios puntos de entrada (2.1 y 2.2), no acá (AC5).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" },
    "materias_disponibles": [{ "id": "cuid", "nombre": "Matemática" }],
    "items": [
      { "tipo": "EXAMEN", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" }, "nota": "8.5" },
      { "tipo": "CLASE_DICTADA", "fecha": "2026-09-25", "materia": { "id": "cuid", "nombre": "Matemática" }, "profesor": "Giménez, Laura", "turno_id": "seed-turno-26" }
    ],
    "paginacion": { "total": 2, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 10 }
  },
  "error": null
}
```

**Errores esperados:** `400` (validación Zod de la query, con `flatten()`) · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO`.

**Paginación (HU-E-05 AC6, backlog del 28/09):** la lista se muestra **de a 10 registros por página**. Al cambiar el filtro por Materia la UI vuelve a pedir `pagina=1`, y se pagina **sobre el resultado ya filtrado** (el filtro se aplica dentro de la consulta unificada, antes de paginar; ver paso 2). Con 10 registros o menos la UI **no muestra la paginación**. `paginacion.total` es el total del resultado filtrado.

**Acceso a la pantalla (Q13, aprobado el 29/09/2026):** el tab vive en `/alumnos/[id]`, pero `alumnos:leer` es exclusivo de Mesa de Entrada (`seed.ts`) y el Gerente y el Profesor **no pueden abrir la ficha ni el listado de alumnos**. Contractualizado: la página de la ficha admite `alumnos:leer` **o** `historial:leer`; con solo `historial:leer` se muestra únicamente el tab "Historial académico" y **nunca** se piden los datos de contacto (`GET /api/alumnos/[id]` sigue exigiendo `alumnos:leer`). El punto de entrada del Gerente y del Profesor es el **Detalle de turno**: cada alumno inscripto lleva el enlace "Ver historial" cuando el detalle le marca `puede_ver_historial: true`. **Ratificado por el PO (29/09/2026) — Q13.** *Nota:* ese enlace no figura en ningún criterio de aceptación del backlog y el PO aprobó Q13 sin agregar uno; se implementa como parte del Detalle de turno (HU-C-09) y queda registrado como excepción al backlog.

**Visibilidad del enlace por rol (decisión de diseño de esta spec):** un Profesor solo puede abrir el historial de alumnos que atendió (Q7b); ofrecerle el enlace para cualquier inscripto lo llevaría a un `403 SIN_PERMISO`. Por eso `spec_modulo_C.md` §2.4 agrega a cada elemento de `alumnos[]` del detalle de turno el booleano `puede_ver_historial`, calculado así: Mesa de Entrada y Gerente (roles con `historial:leer` sin recorte) → `true`; Profesor → el resultado de `profesorAtendioAlumno(profesorEfectivo.id, alumno.id)` (§2.4); cualquier otro rol → `false`. La UI muestra el enlace solo si es `true`. Consecuencia aceptada: un Profesor no ve el enlace de un inscripto al que todavía no le registró ninguna clase dictada (incluida la del propio turno hasta que la registre). El `403` de `GET /api/alumnos/[id]/historial` se mantiene como defensa ante una URL escrita a mano.

---

### 2.4. Servicios públicos del módulo

Conforme a la Regla N.° 3: se declaran en `src/server/historial/historial.publico.ts`. **No importa nada de otros módulos** (evita ciclos con Turnos).

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerClaseDictadaDeTurno(turnoId, db?)` | `{ id, registrada_en, alumnos_registrados } \| null` | `spec_modulo_C.md` §2.4: el detalle del turno indica si ya tiene clase dictada (condición (c) de 2.1 paso 4). C expone en `clase_dictada` solo `{ id, registrada_en }`: descarta `alumnos_registrados`, que el detalle no necesita porque ya lista a los inscriptos |
| `profesorAtendioAlumno(profesorId, alumnoId, db?)` | `boolean`: `true` si existe al menos una `ClaseDictada` de `profesorId` que incluya a `alumnoId` en `ClaseDictadaAlumno` | `spec_modulo_C.md` §2.4: calcula `puede_ver_historial` por inscripto cuando el rol es `PROFESOR` (2.3). Es la misma regla de alcance que aplican 2.2 y 2.3 |

La condición de `registrar_clase` que C evalúa para `acciones_habilitadas` es la de 2.1 paso 4; E no expone una función para ella porque sus datos (estado, fecha, hora de fin, profesor del turno) son del turno y ya los tiene C.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/historial/*.service.ts` (`clase-dictada.service.ts`, `resultado-examen.service.ts`, `historial.service.ts`). Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Inmutabilidad de los registros de hecho consumado (Regla N.° 8)
`ClaseDictada`, `ClaseDictadaAlumno` y `ResultadoExamen` **no admiten `UPDATE` ni `DELETE`** una vez insertados: ningún servicio ni ruta los modifica. Un error de carga se corregirá con un registro compensatorio que referencie al original, en una HU que el PO planificó para Sprint 3 (Q7e, a definir). Hasta entonces **no hay corrección desde la aplicación**; hay que saberlo antes de la demo.

### 3.2. La clase dictada es una fotografía, no una vista viva
La lista de alumnos, la fecha, la materia y el profesor se copian al registrar. Cambios posteriores en el turno (que ya está vencido y por lo tanto congelado, `spec_modulo_C.md` §3.8) o en las fichas no alteran el historial.

### 3.3. Un turno, una clase dictada
Garantizado por el constraint `UNIQUE` sobre `turnoId` y por el `INSERT … ON CONFLICT DO NOTHING` de 2.1. Repetir la acción no duplica ni falla: devuelve el registro existente.

### 3.4. Sin asistencia individual
Todos los inscriptos al momento de dictarse la clase se consideran presentes (HU-E-01 AC5).

### 3.5. Aislamiento de dominio
Este módulo no lee `turnos`, `alumnos`, `profesores` ni `materias`: usa `bloquearTurnoParaOperacion()` (C); `verificarAlumnoActivo()` (alta de examen y opciones, con los códigos `ALUMNO_NO_ENCONTRADO` / `ALUMNO_INACTIVO`), `obtenerAlumnoBasico()` (historial) y `obtenerAlumnosBasicos()` (`GET` de la clase dictada) (B); `obtenerMateriasPorIds()` (historial y opciones) (L); `obtenerNombresProfesores()` y `obtenerOpcionProfesorDeUsuario()` (2.1, 2.2, 2.3) (D); y `obtenerEmailDeUsuario()` (A). Estas funciones se agregan a los módulos correspondientes en sus revisiones de Sprint 2.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, este módulo usa la **opción (a) — columnas de auditoría en la propia entidad**, que se persisten en la misma operación: la trazabilidad (qué, cuándo, quién) queda en las columnas de la propia fila (`createdAtClaseDictada` / `createdAtResultadoExamen` y `creadoPorUsuarioId`). Al ser registros inmutables de un solo evento por fila, no se necesita tabla de eventos ni se emiten eventos de dominio en este sprint.

---

## 5. Decisiones del PO (todas resueltas el 29/09/2026)

| # | Punto | Dónde impacta | Quién resuelve | Decisión contractualizada |
|---|---|---|---|---|
| Q7a | El borrador de los PO pedía "indicaciones académicas" en HU-E-01; el backlog final no lo incluye | 2.1 | PO | No se incluye — **ratificado 29/09/2026** (HU-E-04, Sprint 3) |
| Q7b | ¿El profesor ve y registra solo alumnos que atendió? | Convenciones, 2.2, 2.3 | PO | Ver historial: solo los que atendió — **ratificado 29/09/2026**. Registrar exámenes: solo los que atendió — **ratificado 29/09/2026** |
| Q7c | ¿"Ya pasó" es el inicio o el fin del turno? | 2.1 paso 4 | PO | El fin — **ratificado 29/09/2026**. Diverge de la letra del AC1 de HU-E-01 ("cuya fecha/hora ya pasó"); ver 2.1 paso 4 |
| Q7d | Escala y decimales de la nota | 2.2 | PO | 1 a 10, hasta 1 decimal, parametrizable — **ratificado 29/09/2026** |
| Q7e | Sin corrección de un registro cargado por error | 3.1 | PO | Sin corrección hasta la HU de corrección que el PO planificó para Sprint 3 (Regla N.° 8) — **resuelto 29/09/2026** |
| Q13 | Gerente y Profesor no pueden abrir la ficha del alumno | 2.3 | PO | `historial:leer` + entrada desde el Detalle de turno — **aprobado 29/09/2026** |
```
