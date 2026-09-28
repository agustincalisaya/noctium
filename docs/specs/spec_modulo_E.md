# Especificación Técnica — Módulo E (Atención académica / Historial)
## Noctium — Sprint 2

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` (Alumno) · `spec_modulo_C.md` Revisión 5 (Turno, §2.15) · `spec_modulo_D.md` (Profesor) · `spec_modulo_L.md` (Materias) · `schema.prisma` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§2, "Historial académico"; §4) · `docs/DESIGN.md` §6

**HU contractualizadas en esta revisión:** HU-E-01 (Registrar clase dictada), HU-E-06 (Registrar resultados de exámenes), HU-E-05 (Ver historial académico del alumno) — Sprint 2. Es la **primera revisión** del módulo: no existía `spec_modulo_E.md`.

**Fuera de alcance de esta spec (explícito):**
- Asistencia individual (quién faltó): se asume que **todos los inscriptos** al momento de dictarse la clase asistieron (HU-E-01 AC5).
- Promedios, condición de aprobado/desaprobado y cualquier cálculo sobre las notas (HU-E-06 AC5).
- **Editar o anular** una clase dictada o un resultado de examen: son registros de hecho consumado (Regla N.° 8). Una corrección se resolvería con un registro compensatorio nuevo que referencie al original; queda para una historia futura.
- Indicaciones académicas y evolución del alumno como texto libre: el backlog final de HU-E-01 no incluye ese campo (el borrador de los PO decía "con indicaciones académicas"). **[DEFAULT DEL SM — Q7a, sin respuesta del PO al 28/09: se implementa esto salvo objeción]**
- Filtros del historial distintos de la materia; exportación.

---

## 1. Visión General

El Módulo E registra los hechos académicos de un alumno y los muestra como una línea de tiempo. Gestiona dos registros **inmutables** y una vista de solo lectura:

1. **`ClaseDictada`** — constancia de que un turno se dictó, con la lista de alumnos que estaban inscriptos en ese momento. Se dispara **desde el Detalle de turno** (mapa de pantallas §2), no desde la ficha del alumno.
2. **`ResultadoExamen`** — la nota de un alumno en una materia. Se dispara **desde la ficha del alumno**, dentro del tab "Historial académico": un examen no está atado a un turno puntual.
3. **Historial académico** — vista de solo lectura del mismo tab, con ambos registros en una única línea de tiempo por fecha, filtrable por materia.

**Pantallas (mapa de pantallas):** no hay pantalla nueva de este módulo. E-01 es una acción (`AlertDialog`, sin campos) del Detalle de turno; E-06 es una acción (`Dialog`) del tab; E-05 es el tab "Historial académico" de la ficha del alumno (`/alumnos/[id]`).

Implementación estándar: Route Handlers delgados que delegan en `src/server/historial/clase-dictada.service.ts`, `resultado-examen.service.ts` y `historial.service.ts` (Reglas N.° 4 y 11). Como en Turnos, el frontend llama directamente a los Route Handlers; no se crea `actions.ts` sin uso.

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

- **Alcance del profesor (resuelto siempre en el servidor, nunca por parámetro):** el profesor efectivo se obtiene de la sesión con `obtenerOpcionProfesorDeUsuario()` (Módulo D). Sobre `clases:registrar`, un profesor solo opera sus **propios turnos**. Sobre `examenes:registrar` y `historial:leer`, un profesor solo opera **alumnos que atendió**, es decir, con al menos una `ClaseDictada` a su nombre que incluya al alumno. Fuera de ese alcance: `403 SIN_PERMISO`, sin revelar si el alumno existe. **[DEFAULT DEL SM — Q7b]** (el backlog final no restringe; el borrador de los PO decía "un alumno que atendí").
- Ubicación de archivos (Regla N.° 11): `src/types/historial.types.ts`, `src/server/historial/*`, Route Handlers en `app/api/turnos/[id]/clase-dictada/route.ts`, `app/api/alumnos/[id]/examenes/**` y `app/api/alumnos/[id]/historial/route.ts`.

---

### 2.1. Registrar clase dictada (HU-E-01)

**Ruta:** `POST /app/api/turnos/[id]/clase-dictada/route.ts` (sin body) · `GET` de la misma ruta devuelve el registro existente.
**Servicio:** `src/server/historial/clase-dictada.service.ts` → `registrarClaseDictada()`
**Permiso requerido:** `clases:registrar`
**Presentación:** `AlertDialog` de confirmación simple, sin campos, en el Detalle de turno; toast "Clase dictada registrada correctamente" (texto propuesto por el SM: la HU no lo fija; mapa de pantallas §4, `DESIGN.md` §6.1).

**Comportamiento esperado, dentro de una única `prisma.$transaction`:**
1. Bloquear y leer el turno con `bloquearTurnoParaOperacion(turnoId, tx)` (`spec_modulo_C.md` §2.15, `FOR SHARE`). Si no existe: `404 TURNO_NO_ENCONTRADO`.
2. **Alcance por rol:** si el rol es `PROFESOR` y `turno.profesor_id` no es el profesor efectivo: `403 SIN_PERMISO`.
3. El turno debe estar `DISPONIBLE` o `COMPLETO`; si no (`PENDIENTE` o `CANCELADO`): `409 TURNO_NO_ADMITE_CLASE` (AC1).
4. **Momento:** la acción existe solo cuando el turno **ya terminó** (`fecha + hora_fin ≤ ahora`, `America/Argentina/Buenos_Aires`); antes: `409 CLASE_NO_FINALIZADA`. **[DEFAULT DEL SM — Q7c]:** el backlog dice "cuya fecha/hora ya pasó". Se toma el **fin** y no el inicio porque registrar como dictada una clase que sigue en curso no tiene sentido; la lista de inscriptos ya es estable desde el inicio (`spec_modulo_C.md` §3.8: las inscripciones se congelan al comenzar el turno).
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

**`GET` (registro existente):** `200` con `{ id, registrada_en, registrada_por, alumnos: [{ id, nombre_completo }] }` o `404 CLASE_NO_REGISTRADA`. Permiso `historial:leer`, con el mismo alcance de profesor.

---

### 2.2. Registrar resultado de examen (HU-E-06)

**Ruta:** `POST /app/api/alumnos/[id]/examenes/route.ts`
**Ruta de opciones:** `GET /app/api/alumnos/[id]/examenes/opciones/route.ts` — devuelve `{ materias: [{ id, nombre }], escala: { min, max } }`.
**Servicio:** `src/server/historial/resultado-examen.service.ts` → `registrarResultadoExamen()`, `listarOpcionesExamen()`
**Permiso requerido:** `examenes:registrar`
**Presentación:** `Dialog` sobre el tab "Historial académico" de la ficha del alumno; toast "Resultado registrado correctamente".

```typescript
// src/server/historial/resultado-examen.schema.ts
export const RegistrarResultadoExamenSchema = z.object({
  materia_id: z.string().trim().min(1, "Seleccioná una materia"),
  fecha_examen: fechaCalendarioValidaSchema,        // utilidad compartida, spec_modulo_B.md §2.1
  // Número con punto decimal, como string, hasta 1 decimal.
  nota: z.string().trim().regex(/^\d{1,3}(\.\d)?$/, "La nota debe ser un número con hasta 1 decimal"),
}).strict();
export type RegistrarResultadoExamenInput = z.infer<typeof RegistrarResultadoExamenSchema>;
```

**Comportamiento esperado (`registrarResultadoExamen`), en `prisma.$transaction`:**
1. Alumno existente y activo (`verificarAlumnoActivo()`, Módulo B): `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO`. Alcance de profesor (ver convenciones): `403 SIN_PERMISO`.
2. **Materia (AC1):** el alumno debe tener **al menos una clase dictada registrada** de esa materia (existe una fila `ClaseDictadaAlumno` → `ClaseDictada.materiaId`). Si no: `409 MATERIA_NO_CURSADA`. La materia debe existir (`obtenerMateriasPorIds()`, Módulo L); una materia dada de baja **sí** admite el registro si el alumno la cursó (el hecho ya ocurrió).
3. `fecha_examen`: fecha válida, **no futura**: `400` "La fecha del examen no puede ser futura".
4. **Nota (AC2):** dentro del rango `[nota_minima, nota_maxima]` de `ParametroSistema` (valores propuestos `1` y `10`, **[DEFAULT DEL SM — Q7d]**). Fuera de rango: `422 NOTA_FUERA_DE_RANGO`, mensaje "La nota debe estar entre {min} y {max}".
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

---

### 2.3. Ver historial académico del alumno (HU-E-05)

**Ruta:** `GET /app/api/alumnos/[id]/historial/route.ts`
**Servicio:** `src/server/historial/historial.service.ts` → `obtenerHistorialAlumno()`
**Permiso requerido:** `historial:leer` (Mesa de Entrada, Gerente y Profesor, este último con el alcance de las convenciones)

```typescript
export const HistorialQuerySchema = z.object({
  materia_id: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(50).default(20),
});
```

**Comportamiento esperado:**
1. Alumno existente (`404 ALUMNO_NO_ENCONTRADO`). Alcance de profesor: `403 SIN_PERMISO`. Un alumno inactivo **sí** tiene historial visible.
2. Combinar en **una sola consulta** los dos tipos de registro y paginarla (`$queryRaw` parametrizado con `UNION ALL`, ordenado por `fecha` descendente y `createdAt` descendente como desempate): las **clases dictadas** en las que el alumno figura en `ClaseDictadaAlumno` y sus **resultados de examen**. Paginar cada tipo por separado y mezclarlos rompería el orden. Filtro opcional `materia_id` (AC3).
3. Con la página ya resuelta, completar nombres en lote con los servicios públicos: `obtenerMateriasPorIds()` (Módulo L) y `obtenerNombresProfesores()` (Módulo D). Este módulo no consulta esas tablas.
4. Cada clase dictada: `fecha`, `materia`, `profesor`, `turno_id`. Cada examen: `fecha`, `materia`, `nota` (AC2). El campo `tipo` (`"CLASE_DICTADA" | "EXAMEN"`) permite que la UI los distinga **con texto o ícono, no solo color**.
5. Sin registros: `200` con `items: []`; la UI muestra "Este alumno todavía no tiene historial académico" (AC4).
6. **Solo consulta:** las altas viven en sus propios puntos de entrada (2.1 y 2.2), no acá (AC5).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" },
    "items": [
      { "tipo": "EXAMEN", "fecha": "2026-09-27", "materia": { "id": "cuid", "nombre": "Matemática" }, "nota": "8.5" },
      { "tipo": "CLASE_DICTADA", "fecha": "2026-09-25", "materia": { "id": "cuid", "nombre": "Matemática" }, "profesor": "Giménez, Laura", "turno_id": "seed-turno-26" }
    ],
    "paginacion": { "total": 2, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Acceso a la pantalla (punto abierto Q13):** el tab vive en `/alumnos/[id]`, pero `alumnos:leer` es exclusivo de Mesa de Entrada (`seed.ts`) y el Gerente y el Profesor **no pueden abrir la ficha ni el listado de alumnos**. Propuesta contractualizada: la página de la ficha admite `alumnos:leer` **o** `historial:leer`; con solo `historial:leer` se muestra únicamente el tab "Historial académico" y **nunca** se piden los datos de contacto (`GET /api/alumnos/[id]` sigue exigiendo `alumnos:leer`). El punto de entrada del Gerente y del Profesor es el **Detalle de turno**: cada alumno inscripto lleva el enlace "Ver historial" cuando el rol tiene `historial:leer`. **[DEFAULT DEL SM — Q13]**

---

### 2.4. Servicios públicos (Regla N.° 3)

Provistos en `src/server/historial/historial.publico.ts`. **No importa nada de otros módulos** (evita ciclos con Turnos).

| Función | Devuelve | Consumidor |
|---|---|---|
| `obtenerClaseDictadaDeTurno(turnoId, db?)` | `{ id, registrada_en, alumnos_registrados } \| null` | `spec_modulo_C.md` §2.4: el detalle del turno indica si ya tiene clase dictada y habilita o no la acción |

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `src/server/historial/*.service.ts` (Regla N.° 4).

### 3.1. Inmutabilidad de los registros de hecho consumado (Regla N.° 8)
`ClaseDictada`, `ClaseDictadaAlumno` y `ResultadoExamen` **no admiten `UPDATE` ni `DELETE`** una vez insertados: ningún servicio ni ruta los modifica. Un error de carga se corregirá, en una historia futura, con un registro compensatorio que referencie al original. Hasta entonces **no hay corrección desde la aplicación**; hay que saberlo antes de la demo (Q7e).

### 3.2. La clase dictada es una fotografía, no una vista viva
La lista de alumnos, la fecha, la materia y el profesor se copian al registrar. Cambios posteriores en el turno (que ya está vencido y por lo tanto congelado, `spec_modulo_C.md` §3.8) o en las fichas no alteran el historial.

### 3.3. Un turno, una clase dictada
Garantizado por el constraint `UNIQUE` sobre `turnoId` y por el `INSERT … ON CONFLICT DO NOTHING` de 2.1. Repetir la acción no duplica ni falla: devuelve el registro existente.

### 3.4. Sin asistencia individual
Todos los inscriptos al momento de dictarse la clase se consideran presentes (HU-E-01 AC5).

### 3.5. Aislamiento de dominio
Este módulo no lee `turnos`, `alumnos`, `profesores` ni `materias`: usa `bloquearTurnoParaOperacion()` (C), `verificarAlumnoActivo()` (B), `obtenerMateriasPorIds()` (L), `obtenerNombresProfesores()` y `obtenerOpcionProfesorDeUsuario()` (D). Estas funciones se agregan a los módulos correspondientes en sus revisiones de Sprint 2.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2, este módulo usa la **opción (a)**: la trazabilidad (qué, cuándo, quién) queda en las columnas de la propia fila (`createdAtClaseDictada` / `createdAtResultadoExamen` y `creadoPorUsuarioId`). Al ser registros inmutables de un solo evento por fila, no se necesita tabla de eventos ni se emiten eventos de dominio en este sprint.

---

## 5. Puntos abiertos

| # | Punto | Dónde impacta | Quién resuelve | Propuesta contractualizada |
|---|---|---|---|---|
| Q7a | El borrador de los PO pedía "indicaciones académicas" en HU-E-01; el backlog final no lo incluye | 2.1 | PO | No se incluye |
| Q7b | ¿El profesor ve y registra solo alumnos que atendió? | Convenciones, 2.2, 2.3 | PO | Sí, solo los que atendió |
| Q7c | ¿"Ya pasó" es el inicio o el fin del turno? | 2.1 paso 4 | PO | El fin |
| Q7d | Escala y decimales de la nota | 2.2 | PO | 1 a 10, hasta 1 decimal, parametrizable |
| Q7e | Sin corrección de un registro cargado por error | 3.1 | PO | Se acepta (Regla N.° 8) |
| Q13 | Gerente y Profesor no pueden abrir la ficha del alumno | 2.3 | PO | `historial:leer` + entrada desde el Detalle de turno |
