```markdown
# Especificación Técnica — Módulo L (Materias)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 4, 5, 6, 10) · `spec_modulo_A.md` (sesión/RBAC) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-L-01 (Registrar materia), HU-L-02 (Listar materias) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Modificación de una materia ya registrada.
- Baja lógica / reactivación de materias.
- Duración configurable por materia: en este sprint todo turno usa la duración estándar del centro (parámetro definido en `spec_modulo_C.md`) — la entidad `Materia` no posee campo de duración propio.

---

## 1. Visión General

El Módulo L gestiona el catálogo de materias que dicta el centro. Es una entidad base habilitante: sin materia registrada no puede asociarse un profesor (HU-D-03, `spec_modulo_D.md`) ni configurarse un turno (HU-C-03, `spec_modulo_C.md`). Solo el rol Gerente puede dar de alta materias en este sprint; su consulta (listado y detalle) está disponible para los roles que la necesiten al operar otros módulos.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `lib/services/materias/materia.service.ts` (Regla N.° 4 de `docs/RULES.md`).

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Materia` y `Profesor`, incluido el parámetro `[id]` de Materia, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere sesión y permiso granular vía `withPermission("materias:<accion>")` (Regla N.° 10, middleware definido en `spec_modulo_A.md` §2.2).

---

### 2.1. Alta de Materia (HU-L-01)

**Ruta:** `POST /app/api/materias/route.ts`
**Server Action equivalente:** `crearMateria()` en `app/(dashboard)/materias/actions.ts`
**Permiso requerido:** `materias:crear` (exclusivo del rol Gerente)

```typescript
// lib/schemas/materias.schema.ts
export const CrearMateriaSchema = z.object({
  nombre: z.string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")), // colapsa espacios internos múltiples
  codigo: z.string()
    .trim()
    .max(10, "El código no puede superar los 10 caracteres")
    .regex(/^[A-Za-z0-9]+$/, "El código admite solo letras y números, sin espacios")
    .transform((v) => v.toUpperCase())
    .optional(),
});
export type CrearMateriaInput = z.infer<typeof CrearMateriaSchema>;
```

**Comportamiento esperado (`lib/services/materias/materia.service.ts` → `crearMateria`):**
1. Calcular `nombre_normalizado = normalizarTexto(nombre)` con la utilidad compartida `lib/utils/normalizar-texto.ts` (minúsculas + sin diacríticos — `"Matemática"` y `"matematica"` producen el mismo valor). Esta utilidad es de uso transversal: el mismo requisito de unicidad case/acento-insensitiva aparece en Aulas (HU-K-01) y debe reutilizarse, no reimplementarse.
2. Verificar unicidad aplicativa de `nombre_normalizado` contra **todas** las materias, activas e inactivas (`prisma.materia.findFirst({ where: { nombre_normalizado } })`, sin filtro de `is_active`). Si existe, `409 NOMBRE_DUPLICADO`, indicando en el mensaje si la materia existente está inactiva.
3. Si viene `codigo`: verificar unicidad aplicativa análoga contra `codigo` (ya normalizado a mayúsculas por el schema), también sin filtrar por `is_active`. Si existe, `409 CODIGO_DUPLICADO`.
4. Insertar con `is_active: true`, registrando `nombre`, `nombre_normalizado`, `codigo` (o `null`), fecha de alta y usuario. **Defensa adicional ante condición de carrera:** capturar la violación de constraint único de Prisma (`P2002`) sobre `nombre_normalizado`/`codigo` y traducirla al mismo shape de error `409` que el paso 2/3 — mismo patrón de doble validación (aplicativa + constraint de base) usado en el resto del proyecto ante altas concurrentes.
5. Tras el `INSERT`, emitir el evento `materia:creada` (sección 4).

**Respuesta `201 Created`:**
```json
{
  "data": { "id": "cuid", "nombre": "Matemática", "codigo": "MAT101", "is_active": true },
  "error": null
}
```

**Respuesta `409 Conflict` (nombre duplicado):**
```json
{
  "data": null,
  "error": { "code": "NOMBRE_DUPLICADO", "message": "Ya existe una materia registrada con ese nombre (inactiva)" }
}
```

**Respuesta `409 Conflict` (código duplicado):**
```json
{ "data": null, "error": { "code": "CODIGO_DUPLICADO", "message": "Ya existe una materia registrada con ese código" } }
```

---

### 2.2. Listado y detalle de Materias (HU-L-02)

**Ruta (listado):** `GET /app/api/materias/route.ts`
**Permiso requerido:** `materias:leer` (Gerente, Mesa de Entrada, Profesor — todo rol que necesite consultar el catálogo al operar otro módulo)

```typescript
export const ListarMateriasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarMateriasQuery = z.infer<typeof ListarMateriasQuerySchema>;
```

**Comportamiento esperado:**
- El listado **incluye materias activas e inactivas** (no aplica un filtro `is_active: true` por defecto), porque el criterio de aceptación exige mostrar la columna Estado para ambas — a diferencia del criterio de filtrado por defecto que sí aplican otras consultas del proyecto orientadas solo a registros operativos vigentes.
- Orden inicial: `nombre_normalizado` ascendente (garantiza el criterio "sin distinguir mayúsculas/acentos" del listado, no solo del alta).
- Cada ítem incluye la cantidad de profesores asociados, resuelta vía `_count` sobre la relación con `ProfesorMateria` (definida en `spec_modulo_D.md` §2.3) — no requiere una consulta separada por materia.
- Paginación server-side (`skip`/`take`), con metadatos de página en la respuesta.

**Nota de sincronización (HU-L-02) — excepción documentada a la Regla N.° 3 de `docs/RULES.md`:** el `_count` de arriba se resuelve con `prisma.materia.findMany({ include: { _count: { select: { profesores: true } } } })` desde `materia.service.ts`, es decir, consultando directamente la tabla `ProfesorMateria`. En sentido estricto, `ProfesorMateria` es la tabla de asociación de HU-D-03 (Módulo D/Profesor), y la Regla N.° 3 exige que la comunicación entre módulos ocurra vía eventos de dominio o el servicio público del otro módulo, no vía acceso directo a su tabla. Se documenta acá como excepción explícita, en vez de introducir un servicio público en Módulo D sin otro consumidor real hoy, porque `ProfesorMateria` está declarada como relación (`profesores ProfesorMateria[]`) en el propio modelo `Materia` del schema — no es una tabla interna ajena a la que Materias "se asoma" desde afuera, sino una relación N:M que ambos módulos declaran igual de explícitamente en su propio modelo. Si en el futuro el conteo necesita lógica adicional (ej. excluir profesores inactivos), se reevalúa moverlo a un servicio público de Módulo D en ese momento.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "nombre": "Matemática", "codigo": "MAT101", "profesores_count": 2, "is_active": true }
    ],
    "paginacion": { "total": 12, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Ruta (detalle):** `GET /app/api/materias/[id]/route.ts`
**Permiso requerido:** `materias:leer`

**Comportamiento esperado:** modo consulta — incluye `nombre`, `codigo`, `is_active`, `created_at`, y el listado de profesores asociados (nombre y apellido) resuelto vía `ProfesorMateria` → `Profesor`.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "id": "cuid",
    "nombre": "Matemática",
    "codigo": "MAT101",
    "is_active": true,
    "created_at": "2026-03-02T14:00:00.000Z",
    "profesores": [{ "id": "cuid", "nombre_completo": "Pérez, Ana" }]
  },
  "error": null
}
```

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `lib/services/materias/materia.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Unicidad case/acento-insensitiva contra el universo completo (activas + inactivas)
Tanto `nombre` como `codigo` se validan contra **todas** las materias existentes, sin excluir las dadas de baja — una materia inactiva sigue "ocupando" su nombre y código. La comparación nunca se hace sobre el valor crudo ingresado por el usuario: siempre sobre su forma normalizada (`nombre_normalizado`, `codigo` ya en mayúsculas).

### 3.2. Doble validación: aplicativa + constraint de base
Ninguna verificación de unicidad confía solo en la consulta previa al `INSERT` (riesgo de condición de carrera ante dos altas simultáneas con el mismo nombre). El constraint único de Prisma sobre `nombre_normalizado`/`codigo` es la garantía final; su violación (`P2002`) se traduce al mismo código de error de negocio que la validación aplicativa, nunca se propaga como error técnico crudo al cliente.

### 3.3. Sin campo de duración en este sprint
El servicio no expone ni acepta ningún campo relacionado a duración de clase para `Materia`. Cualquier cálculo de duración de turno usa el parámetro estándar del centro definido en `spec_modulo_C.md` — este acoplamiento es intencional y se documenta acá para que no se reintroduzca un campo de duración por materia sin antes revisar esa spec.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: el evento se emite después de que el `INSERT` (con su defensa de constraint único) resuelva exitosamente.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `materia:creada` | Alta de materia (2.1) | `materia_id, nombre, codigo, usuario_id` |

**Nota de sincronización (HU-L-01, resuelta):** no existe event bus ni `AuditLog` en este sprint (mismo gap documentado en `spec_modulo_A.md`). A diferencia de los eventos de sesión, acá no se escribe a ninguna tabla de log separada — `EventoSeguridad` está tipado específicamente para eventos de seguridad, no es un log genérico de dominio, y crear una tabla de auditoría de negocio nueva está fuera del alcance de esta HU. La trazabilidad que pide el criterio 4 de HU-L-01 ("se registran fecha de alta y usuario") queda satisfecha por las columnas `createdAtMateria`/`creadoPorUsuarioId` que la propia fila de `Materia` ya persiste — no hace falta un evento/log aparte para eso.
```