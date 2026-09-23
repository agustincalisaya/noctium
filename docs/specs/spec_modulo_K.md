```markdown
# Especificación Técnica — Módulo K (Aulas)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 4, 5, 6, 10) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (patrón de unicidad case-insensitiva, como referencia de diseño) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-K-01 (Registrar aula), HU-K-02 (Listar aulas) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Modificación de un aula ya registrada.
- Baja lógica / reactivación de aulas.
- Consulta automática de disponibilidad por horario: eso lo resuelve `spec_modulo_C.md` (HU-C-15) al momento de asignar un aula a un turno — este módulo no expone ningún endpoint de disponibilidad propio.

---

## 1. Visión General

El Módulo K gestiona el catálogo de aulas — el espacio físico que `spec_modulo_C.md` (HU-C-15) asigna a un turno para que pase de `Pendiente` a `Agendado`. Solo el rol Gerente puede dar de alta aulas en este sprint.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `lib/services/aulas/aula.service.ts` (Regla N.° 4 de `docs/RULES.md`).

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Aula`, incluido el parámetro `[id]`, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere `withPermission("aulas:<accion>")` (Regla N.° 10).

---

### 2.1. Alta de Aula (HU-K-01)

**Ruta:** `POST /app/api/aulas/route.ts`
**Server Action equivalente:** `crearAula()` en `app/(dashboard)/aulas/actions.ts`
**Permiso requerido:** `aulas:crear` (exclusivo del rol Gerente)

```typescript
// lib/schemas/aulas.schema.ts
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

**Comportamiento esperado (`lib/services/aulas/aula.service.ts` → `crearAula`):**
1. Calcular `nombre_normalizado = normalizarTexto(nombre)` (misma utilidad compartida `lib/utils/normalizar-texto.ts` de `spec_modulo_L.md` §2.1 — cubre el requisito de comparación case-insensitive del criterio de aceptación, y de paso también acentos, aunque no se esperan en nombres de aula; reutilizar la utilidad existente es preferible a escribir una comparación más limitada solo para este módulo).
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

---

### 2.2. Listado y detalle de Aulas (HU-K-02)

**Ruta (listado):** `GET /app/api/aulas/route.ts`
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

**Ruta (detalle):** `GET /app/api/aulas/[id]/route.ts` — nombre/número, capacidad, estado, fecha de alta.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `lib/services/aulas/aula.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Unicidad case-insensitiva contra el universo completo (activas + inactivas)
Mismo patrón que `spec_modulo_L.md` §3.1: un aula inactiva sigue "ocupando" su nombre. Doble validación (aplicativa + constraint `P2002`).

### 3.2. Orden natural es una propiedad de la columna, no de cada consulta
La collation `natural_es` (sección 2.2) se define una sola vez, a nivel de esquema. Ningún servicio debe implementar su propia lógica de ordenamiento natural en JavaScript ni con expresiones SQL ad-hoc por consulta — el `orderBy` estándar de Prisma ya es correcto gracias a la collation de la columna.

### 3.3. El alta no reserva el recurso
Crear un `Aula` no crea ni modifica ninguna relación con `Turno`. La asignación real, incluida su validación de disponibilidad por horario, es responsabilidad exclusiva de `spec_modulo_C.md` (HU-C-15) — este módulo no debe anticipar ni duplicar esa lógica.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: el evento se emite después de que el `INSERT` (con su defensa de constraint único) resuelva exitosamente.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `aula:creada` | Alta de aula (2.1) | `aula_id, nombre, capacidad, usuario_id` |
```