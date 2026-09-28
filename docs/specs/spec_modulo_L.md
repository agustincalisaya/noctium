```markdown
# Especificación Técnica — Módulo L (Materias)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 4, 5, 6, 10) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` §2.5 y §3.3 (patrón de concurrencia optimista) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**HU contractualizadas en esta revisión:** HU-L-01 (Registrar materia), HU-L-02 (Listar materias) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-L-03 (Modificar datos de materia).

**Changelog — Revisión 2 (Sprint 2):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-L-03 | Gap — "Modificación de una materia ya registrada" figuraba como fuera de alcance | Nueva sección 2.4 (aditiva, no renumera). Nueva regla 3.4 |
| Servicios públicos | Solo `bloquearMateriasParaAsociar()` (§2.3) | Nueva sección 2.5: `obtenerMateriasPorIds()`, consumida por `spec_modulo_E.md` |
| Modelo `Materia` | Sin campos de modificación | + `updatedAtMateria`, `modificadoPorUsuarioId`, `version` (concurrencia optimista, mismo patrón que `Alumno`) |
| Permisos | `materias:crear`, `materias:leer` | + `materias:editar` (GERENTE). Matriz en `spec_modulo_A.md` §2.4 |

**Changelog (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-03 (módulo D, consumidor) | Gap: el módulo L no exponía una consulta pública para revalidar materias dentro de una transacción ajena | Añadida sección 2.3 (`bloquearMateriasParaAsociar()`), aditiva. No modifica ninguna función existente. Sin renumerar. |

**Fuera de alcance de esta spec (explícito):**
- Modificación de una materia ya registrada.
- Baja lógica / reactivación de materias.
- Duración configurable por materia: en este sprint todo turno usa la duración estándar del centro (parámetro definido en `spec_modulo_C.md`) — la entidad `Materia` no posee campo de duración propio.

**Actualización de alcance — Revisión 2 (Sprint 2):** la **modificación de nombre y código** de una materia pasa a estar dentro de alcance (2.4). Siguen fuera: baja lógica y reactivación (cambiar `is_active`) y la duración configurable por materia, que HU-L-03 AC5 excluye expresamente, igual que en Sprint 1. La duración del turno la elige Mesa de Entradas (`spec_modulo_C.md` Revisión 4), no es un dato de la materia.

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

### 2.3. Consulta pública: bloquear materias para asociar (consumida por HU-D-03)

**Función:** `bloquearMateriasParaAsociar(ids: string[], tx: Prisma.TransactionClient): Promise<{ id, nombre, codigo, activa }[]>` en `src/server/materias/materia.service.ts`.
**Consumidor:** `asociarMateriasAProfesor()` del módulo D (`spec_modulo_D.md` §2.3), vía llamada explícita a la capa de servicios pública (Regla N.° 3). No tiene Route Handler ni Server Action propios.

**Comportamiento:**
- Corre sobre el `tx` del llamador. Hace `SELECT … FROM materias WHERE "idMateria" = ANY($ids) FOR SHARE` con `$queryRaw` parametrizado, nunca concatenado.
- El bloqueo compartido impide que otra transacción cambie `activaMateria` de esas filas hasta el commit del llamador. Así, el chequeo "todas activas" sigue valiendo al momento del `INSERT` (Regla N.° 7).
- Devuelve solo las materias que existen, activas o no, con su estado en `activa`. No lanza errores: decidir qué hacer con las faltantes o las inactivas es regla de negocio del llamador.
- No muta ninguna fila de `materias`.

---

### 2.4. Modificar datos de materia (HU-L-03) — NUEVA en Revisión 2

**Ruta:** `PATCH /app/api/materias/[id]/route.ts`
**Permiso requerido:** `materias:editar` (exclusivo del rol Gerente)
**Pantalla:** modo edición del mismo detalle `/materias/[id]` (mapa de pantallas §1, "Ficha de materia"), con el formulario precargado con nombre y código actuales (HU-L-03 AC1). Página completa, banner inline "Materia actualizada correctamente".

```typescript
// src/server/materias/materia.schema.ts
export const ModificarMateriaSchema = CrearMateriaSchema.partial().extend({
  codigo: CrearMateriaSchema.shape.codigo.nullable(), // null = quitar el código (el alta permite materias sin código)
  version: z.number().int().nonnegative(),             // control de concurrencia optimista — obligatorio
}).strict();
export type ModificarMateriaInput = z.infer<typeof ModificarMateriaSchema>;
```
Mismas reglas de validación y normalización que el alta (2.1): `nombre` recortado, espacios internos colapsados, 2 a 80 caracteres; `codigo` alfanumérico sin espacios, hasta 10, en mayúsculas. **`.strict()` rechaza `is_active` y cualquier campo de duración** (AC5). La UI usa el mismo esquema y la misma normalización que el alta (`MateriaForm`).

**Comportamiento esperado (`materia.service.ts` → `modificarMateria`), dentro de una única `prisma.$transaction`:**
1. La materia debe existir: `404 MATERIA_NO_ENCONTRADA`. Se compara el payload contra los valores actuales; si ningún campo cambia, `200` con `campos_modificados: []` sin escribir (la UI mantiene "Guardar" deshabilitado, AC3).
2. Si cambia `nombre`: `nombreNormalizadaMateria = normalizarTexto(nombre)` y unicidad aplicativa **excluyendo la propia materia**, contra **todas** las demás, activas e inactivas: `409 NOMBRE_DUPLICADO` (con la indicación "(inactiva)" cuando corresponde, igual que 2.1). La comparación no distingue mayúsculas ni acentos (AC2).
3. Si cambia `codigo` (ya en mayúsculas por el schema): unicidad análoga excluyendo la propia materia: `409 CODIGO_DUPLICADO`.
4. **Concurrencia optimista (Regla N.° 7):** condición y mutación en una única sentencia (mismo patrón que `spec_modulo_B.md` §2.5 paso 3):
   ```typescript
   const r = await tx.materia.updateMany({
     where: { idMateria: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, updatedAtMateria: new Date(), modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
   ```
   Defensa adicional: la violación de constraint único (`P2002`) sobre `nombreNormalizadaMateria` o `codigoMateria` se traduce al mismo `409` que los pasos 2 y 3.
5. **Solo se actualizan los campos modificados** (diff, AC3); se registra la fecha de última modificación (`updatedAtMateria`, que el detalle de 2.2 pasa a devolver como `updated_at`). `id`, `is_active` y `createdAtMateria` no son editables.
6. **Efecto sobre otros módulos:** ninguno que requiera trabajo. Turnos y profesores referencian la materia por id, así que el nuevo nombre se refleja solos en todas las pantallas. Un cambio de nombre **no** afecta a los turnos ya configurados ni reabre ninguna validación.

**Modelo (cambios en `schema.prisma`):**
```prisma
model Materia {
  // ... campos existentes ...
  updatedAtMateria       DateTime @default(now()) @updatedAt   // NUEVO
  modificadoPorUsuarioId String?                                // NUEVO, escalar sin relación
  version                Int      @default(0)                   // NUEVO
}
```

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["nombre", "codigo"], "version": 2 }, "error": null }
```

**Errores esperados:** `400` (validación, incluido cualquier campo no permitido) · `403 SIN_PERMISO` · `404 MATERIA_NO_ENCONTRADA` · `409 NOMBRE_DUPLICADO` · `409 CODIGO_DUPLICADO` · `409 CONFLICTO_EDICION_CONCURRENTE` ("La materia fue modificada por otro usuario. Recargá para ver los datos actuales.").

**Cancelar (AC4):** vuelve al detalle sin guardar; si hay cambios sin guardar, pide confirmación (mismo patrón `DirtyStateContext` que el alta).

---

### 2.5. Servicio público: obtener materias por id (Revisión 2, consumido por `spec_modulo_E.md`)

**Función:** `obtenerMateriasPorIds(ids: string[], db?: Prisma.TransactionClient): Promise<{ id, nombre, codigo, activa }[]>` en `src/server/materias/materia.service.ts`.
**Comportamiento:** devuelve las materias que existen, **activas o inactivas**, con su estado en `activa`. No lanza errores por ids inexistentes (simplemente no aparecen). No bloquea filas (a diferencia de 2.3). No tiene Route Handler propio. Sirve para completar nombres en listados de otros módulos sin consultar `materias` (Regla N.° 3).

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

### 3.4. Modificar respeta la unicidad contra el universo completo, excluyéndose a sí misma (Revisión 2)
Igual que el alta (3.1), pero la materia que se edita **no cuenta como duplicado de sí misma**: se puede cambiar solo el código sin que el nombre "choque" consigo mismo. La comparación sigue siendo sobre la forma normalizada, nunca sobre el texto crudo. Aplica la doble validación de 3.2 (aplicativa + constraint).

### 3.5. Concurrencia optimista en la modificación (Revisión 2)
Todo `UPDATE` de una materia desde HU-L-03 exige `version` y la compara en la misma sentencia que la escritura (`spec_modulo_B.md` §3.3). Dos gerentes editando a la vez no se pisan: el segundo recibe `409 CONFLICTO_EDICION_CONCURRENTE`.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: el evento se emite después de que el `INSERT` (con su defensa de constraint único) resuelva exitosamente.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `materia:creada` | Alta de materia (2.1) | `materia_id, nombre, codigo, usuario_id` |

**Nota de sincronización (HU-L-01, resuelta):** no existe event bus ni `AuditLog` en este sprint (mismo gap documentado en `spec_modulo_A.md`). A diferencia de los eventos de sesión, acá no se escribe a ninguna tabla de log separada — `EventoSeguridad` está tipado específicamente para eventos de seguridad, no es un log genérico de dominio, y crear una tabla de auditoría de negocio nueva está fuera del alcance de esta HU. La trazabilidad que pide el criterio 4 de HU-L-01 ("se registran fecha de alta y usuario") queda satisfecha por las columnas `createdAtMateria`/`creadoPorUsuarioId` que la propia fila de `Materia` ya persiste — no hace falta un evento/log aparte para eso.

**Revisión 2 (Sprint 2) — trazabilidad (Regla N.° 2).** La modificación de una materia usa la **opción (a)**: `updatedAtMateria`, `modificadoPorUsuarioId` y `version` en la propia fila; HU-L-03 AC3 ("se registra la fecha de última modificación") queda cubierta por `updatedAtMateria`. No hay evento `materia:modificada`.
```
