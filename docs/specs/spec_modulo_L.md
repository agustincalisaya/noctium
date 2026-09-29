```markdown
# Especificación Técnica — Módulo L (Materias)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2)
## Revisión 2 — Sprint 2: modificación de materia (HU-L-03), servicios públicos documentados y ubicación de archivos

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` §2.5 y §3.3 (patrón de concurrencia optimista) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**HU contractualizadas en esta revisión:** HU-L-01 (Registrar materia), HU-L-02 (Listar materias) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-L-03 (Modificar datos de materia).

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-L-03 | Gap — «Modificación de una materia ya registrada» figuraba como fuera de alcance | Añadida sección 2.4 (aditiva, no renumera) y reglas 3.4 y 3.5 |
| HU-L-02 | Contractualizada (Sprint 1) | El detalle `GET /api/materias/[id]` (§2.2) suma `updated_at` y `version` |
| HU-L-01 | Contractualizada (Sprint 1) | Sin cambio de contrato; ubicación de archivos unificada bajo `src/server/materias/` |
| HU-D-03 y HU-D-07 (módulo D, consumidor) | Sin contrato público documentado para consumir materias | §2.3 (`bloquearMateriasParaAsociar`), §2.5 (`obtenerMateriasPorIds`) y §2.6 (`verificarMateriaActiva`, `obtenerOpcionMateriaActiva`, `listarMateriasActivas`), aditivas |

**Changelog — Revisión 2 (Sprint 2) — detalle:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-L-03 | Gap — "Modificación de una materia ya registrada" figuraba como fuera de alcance | Nueva sección 2.4 (aditiva, no renumera). Nueva regla 3.4 |
| Servicios públicos | Solo `bloquearMateriasParaAsociar()` (§2.3) | Nueva sección 2.5: `obtenerMateriasPorIds()`, consumida por `spec_modulo_E.md` y `spec_modulo_D.md` §2.7. Nueva sección 2.6: documenta los servicios públicos que otras specs ya consumen (`verificarMateriaActiva`, `obtenerOpcionMateriaActiva`, `listarMateriasActivas`) |
| Modelo `Materia` | Sin campos de modificación | + `updatedAtMateria`, `modificadoPorUsuarioId`, `version` (concurrencia optimista, mismo patrón que `Alumno`) |
| Permisos | `materias:crear`, `materias:leer` | + `materias:editar` (GERENTE). Matriz en `spec_modulo_A.md` §2.4 |
| Ubicación de archivos | Rutas mezcladas (`app/(dashboard)/...`, `lib/schemas/...`) y servicios públicos declarados en `materia.service.ts` | Todo bajo `src/server/materias/` (`actions.ts`, `materia.schema.ts`). Los servicios públicos (§2.3, 2.5, 2.6) se declaran en `src/server/materias/materia.publico.ts` (Regla N.° 3, igual que B, C, D y E) |
| Detalle `GET /api/materias/[id]` (§2.2) | No devolvía la fecha de última modificación ni la versión | Suma `updated_at` y `version` |

**Changelog previo (trazabilidad Backlog → Spec) — HU-D-03:**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-03 (módulo D, consumidor) | Gap: el módulo L no exponía una consulta pública para revalidar materias dentro de una transacción ajena | Añadida sección 2.3 (`bloquearMateriasParaAsociar()`), aditiva. No modifica ninguna función existente. Sin renumerar. |

**Fuera de alcance de esta spec (explícito):**
- ~~Modificación de una materia ya registrada.~~ **Incorporada en Revisión 2** (2.4, ver «Actualización de alcance» más abajo).
- Baja lógica / reactivación de materias.
- Duración configurable por materia: en este sprint todo turno usa la duración estándar del centro (parámetro definido en `spec_modulo_C.md`) — la entidad `Materia` no posee campo de duración propio.

**Actualización de alcance — Revisión 2 (Sprint 2):** la **modificación de nombre y código** de una materia pasa a estar dentro de alcance (2.4). Siguen fuera: baja lógica y reactivación (cambiar `is_active`) y la duración configurable por materia, que HU-L-03 AC5 excluye expresamente, igual que en Sprint 1. La duración del turno la elige Mesa de Entradas (`spec_modulo_C.md` Revisión 4), no es un dato de la materia.

---

## 1. Visión General

El Módulo L gestiona el catálogo de materias que dicta el centro. Es una entidad base habilitante: sin materia registrada no puede asociarse un profesor (HU-D-03, `spec_modulo_D.md`) ni configurarse un turno (HU-C-03, `spec_modulo_C.md`). Solo el rol Gerente puede dar de alta materias en este sprint; su consulta (listado y detalle) está disponible para los roles que la necesiten al operar otros módulos.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `src/server/materias/materia.service.ts` (Regla N.° 4 de `docs/RULES.md`). Las funciones que otros módulos invocan (§2.3, 2.5 y 2.6) se declaran en `src/server/materias/materia.publico.ts` (Regla N.° 3), no en el servicio interno.

**Alcance de esta revisión:** la Revisión 2 es aditiva. Incorpora las secciones 2.4 (HU-L-03), 2.5 y 2.6 (servicios públicos) y las reglas 3.4 y 3.5 al final de sus bloques, sin renumerar las preexistentes 2.1–2.3 y 3.1–3.3, para no romper las referencias cruzadas de otras specs (ver `docs/adicionales/sdd-metodologia.md`). Las únicas modificaciones sobre secciones existentes son el detalle de 2.2 (suma `updated_at` y `version`) y la ubicación de archivos (servicios públicos en `materia.publico.ts`). La baja lógica, la reactivación y la duración por materia siguen fuera de alcance.

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Materia` y `Profesor`, incluido el parámetro `[id]` de Materia, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("materias:<accion>")` (Regla N.° 10, middleware definido en `spec_modulo_A.md` §2.2).
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/materia.types.ts`, Server Actions en `src/server/materias/actions.ts` y services en `src/server/materias/materia.service.ts`. Imports siempre con el alias `@/`.

---

### 2.1. Alta de Materia (HU-L-01)

**Ruta:** `POST /api/materias`
**Server Action equivalente:** `crearMateria()` en `src/server/materias/actions.ts`
**Servicio:** `crearMateria()` en `src/server/materias/materia.service.ts`
**Permiso requerido:** `materias:crear` (exclusivo del rol Gerente)

```typescript
// src/server/materias/materia.schema.ts
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

**Comportamiento esperado (`src/server/materias/materia.service.ts` → `crearMateria`):**
1. Calcular `nombre_normalizado = normalizarTexto(nombre)` con la utilidad compartida `normalizarTexto()` (ubicación de referencia `lib/utils/normalizar-texto.ts`, **a confirmar contra el código** porque el resto de las specs usa el prefijo `src/`; B, D, I y K remiten a esta sección para la utilidad y no definen otra ruta) (minúsculas + sin diacríticos — `"Matemática"` y `"matematica"` producen el mismo valor). Esta utilidad es de uso transversal: el mismo requisito de unicidad case/acento-insensitiva aparece en Aulas (HU-K-01) y debe reutilizarse, no reimplementarse.
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

**Errores esperados:** `400` (validación Zod, Regla N.° 6) · `403 SIN_PERMISO` · `409 NOMBRE_DUPLICADO` · `409 CODIGO_DUPLICADO` (ambos también ante violación `P2002`).

---

### 2.2. Listado y detalle de Materias (HU-L-02)

**Ruta (listado):** `GET /api/materias`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** listado de materias en `src/server/materias/materia.service.ts` (nombre de la función: a confirmar contra el código)
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

**Errores esperados:** `400` (query inválida, Regla N.° 6) · `403 SIN_PERMISO`.

**Ruta (detalle):** `GET /api/materias/[id]`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** detalle de materia en `src/server/materias/materia.service.ts` (nombre de la función: a confirmar contra el código)
**Permiso requerido:** `materias:leer`

**Comportamiento esperado:** modo consulta — incluye `nombre`, `codigo`, `is_active`, `created_at`, **`updated_at`** (fecha de última modificación, `updatedAtMateria`; HU-L-03 AC3), **`version`** (la lee el formulario de edición y la reenvía en el `PATCH` de 2.4) y el listado de profesores asociados (nombre y apellido) resuelto vía `ProfesorMateria` → `Profesor`.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "id": "cuid",
    "nombre": "Matemática",
    "codigo": "MAT101",
    "is_active": true,
    "created_at": "2026-03-02T14:00:00.000Z",
    "updated_at": "2026-03-05T10:30:00.000Z",
    "version": 2,
    "profesores": [{ "id": "cuid", "nombre_completo": "Pérez, Ana" }]
  },
  "error": null
}
```

**Errores esperados:** `403 SIN_PERMISO` · `404 MATERIA_NO_ENCONTRADA`.

### 2.3. Consulta pública: bloquear materias para asociar (consumida por HU-D-03 y HU-D-07)

**Función:** `bloquearMateriasParaAsociar(ids: string[], tx: Prisma.TransactionClient): Promise<{ id, nombre, codigo, activa }[]>` declarada y exportada en `src/server/materias/materia.publico.ts` (Regla N.° 3), no en `materia.service.ts`.
**Consumidores**, vía llamada explícita a la capa de servicios pública (Regla N.° 3):
- `asociarMateriasProfesor()` del módulo D (`spec_modulo_D.md` §2.3, HU-D-03).
- `actualizarMateriasDeProfesor()` del módulo D (`spec_modulo_D.md` §2.7, HU-D-07), que la invoca con las materias a agregar.

No tiene Route Handler ni Server Action propios.

**Comportamiento:**
- Corre sobre el `tx` del llamador. Hace `SELECT … FROM materias WHERE "idMateria" = ANY($ids) FOR SHARE` con `$queryRaw` parametrizado, nunca concatenado.
- El bloqueo compartido impide que otra transacción cambie `activaMateria` de esas filas hasta el commit del llamador. Así, el chequeo "todas activas" sigue valiendo al momento del `INSERT` (Regla N.° 7).
- Devuelve solo las materias que existen, activas o no, con su estado en `activa`. No lanza errores: decidir qué hacer con las faltantes o las inactivas es regla de negocio del llamador.
- No muta ninguna fila de `materias`.

---

### 2.4. Modificar datos de materia (HU-L-03) — NUEVA en Revisión 2

**Ruta:** `PATCH /api/materias/[id]`
**Server Action equivalente:** `modificarMateria()` en `src/server/materias/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `modificarMateria()` en `src/server/materias/materia.service.ts`
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
5. **Solo se actualizan los campos modificados** (diff, AC3); se registra la fecha de última modificación (`updatedAtMateria`, que el detalle de 2.2 devuelve como `updated_at`). `id`, `is_active` y `createdAtMateria` no son editables.
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

**Cancelar (AC4):** botón «Cancelar» del modo edición (`MateriaForm`):
- **Sin cambios sin guardar** (los valores coinciden con los cargados desde el detalle): vuelve al detalle `/materias/[id]` en modo lectura, sin diálogo y sin llamar a la API.
- **Con cambios sin guardar** (formulario marcado como modificado en `DirtyStateContext`, el mismo patrón que el alta, HU-L-01): no navega; abre un diálogo de confirmación con el título «¿Descartar los cambios?», el texto «Tenés cambios sin guardar. Si salís de esta pantalla, se van a perder.» y dos botones: «Seguir editando» (cierra el diálogo y conserva lo tipeado) y «Descartar cambios» (vuelve al detalle en modo lectura con los valores guardados, sin llamar a la API).
- El mismo diálogo aparece si se abandona la pantalla por otro camino (menú, logo, cerrar sesión), porque `DirtyStateProvider` centraliza la salida con cambios sin guardar.
- Este es el texto de referencia también para `spec_modulo_K.md` §2.4 (HU-K-03 AC4). Si el componente ya implementado usa otro texto, prevalece el existente y se actualizan L y K a la vez (a confirmar contra el código).

---

### 2.5. Servicio público: obtener materias por id (Revisión 2, consumido por `spec_modulo_E.md` y `spec_modulo_D.md` §2.7)

**Función:** `obtenerMateriasPorIds(ids: string[], db?: Prisma.TransactionClient): Promise<{ id, nombre, codigo, activa }[]>` declarada y exportada en `src/server/materias/materia.publico.ts` (Regla N.° 3).
**Comportamiento:** devuelve las materias que existen, **activas o inactivas**, con su estado en `activa`. No lanza errores por ids inexistentes (simplemente no aparecen). No bloquea filas (a diferencia de 2.3). No tiene Route Handler propio. Sirve para completar nombres en listados de otros módulos sin consultar `materias` (Regla N.° 3).

---

### 2.6. Servicios públicos del módulo (Revisión 2, documentación del contrato)

Resumen de todas las funciones que este módulo provee a otros (Regla N.° 3: el proveedor documenta su contrato). Las de 2.3 y 2.5 se detallan en sus secciones; las tres últimas las consumían otras specs sin estar escritas acá. Se declaran en `src/server/materias/materia.publico.ts`, como las de 2.3 y 2.5; las que ya existen desde Sprint 1 en otro archivo se mueven o reexportan desde ahí (ubicación actual a confirmar contra el código). Las firmas salen de lo que cada consumidor declara; hay que confirmarlas contra el código existente.

| Función | Devuelve | Consumidores |
|---|---|---|
| `bloquearMateriasParaAsociar(ids, tx)` (§2.3) | `{ id, nombre, codigo, activa }[]` de las materias existentes, con `FOR SHARE` sobre el `tx` del llamador | `spec_modulo_D.md` §2.3 (HU-D-03) y §2.7 (HU-D-07) |
| `obtenerMateriasPorIds(ids, db?)` (§2.5) | `{ id, nombre, codigo, activa }[]` de las materias existentes, activas o no | `spec_modulo_E.md`; `spec_modulo_D.md` §2.7 |
| `verificarMateriaActiva(materiaId)` | la materia si existe y está activa; si no, falla o devuelve vacío (firma exacta: a confirmar) | `spec_modulo_C.md` §2.1, §2.8; `spec_modulo_J.md` §2.2 |
| `obtenerOpcionMateriaActiva(materiaId)` | `{ id, nombre, codigo }` de una materia activa, o `null`. Además del control de actividad, devuelve nombre y código para el encabezado del calendario | `spec_modulo_J.md` §2.2 |
| `listarMateriasActivas()` | `{ id, nombre, codigo }[]` de las materias activas, para el selector de materia | `spec_modulo_J.md` §2.2 (nota) |

Origen: `verificarMateriaActiva` existe desde Sprint 1; `bloquearMateriasParaAsociar`, `obtenerMateriasPorIds`, `obtenerOpcionMateriaActiva` y `listarMateriasActivas` son aditivas (`bloquearMateriasParaAsociar` por HU-D-03; el resto en Revisión 2).

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/materias/materia.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

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

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, el módulo usa la **opción (a) — columnas de auditoría en la propia entidad**: el alta registra `createdAtMateria`/`creadoPorUsuarioId` (HU-L-01) y la modificación registra `updatedAtMateria`, `modificadoPorUsuarioId` y `version` (ver más abajo). Alcanza porque solo se necesita la trazabilidad del ciclo de vida normal de `Materia` (quién y cuándo la creó o modificó), sin eventos discretos repetibles sobre la misma entidad. Al ser parte de la propia fila, se persiste en la misma operación; no hay tabla de eventos propia (opción b) ni escritura posterior al `COMMIT`.

El evento `materia:creada` es la notificación de dominio declarada para el alta; no es el mecanismo de trazabilidad.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `materia:creada` | Alta de materia (2.1) | `materia_id, nombre, codigo, usuario_id` |

**Nota de sincronización (HU-L-01, resuelta):** no existe event bus ni `AuditLog` en este sprint (mismo gap documentado en `spec_modulo_A.md`). A diferencia de los eventos de sesión, acá no se escribe a ninguna tabla de log separada — `EventoSeguridad` está tipado específicamente para eventos de seguridad, no es un log genérico de dominio, y crear una tabla de auditoría de negocio nueva está fuera del alcance de esta HU. La trazabilidad que pide el criterio 4 de HU-L-01 ("se registran fecha de alta y usuario") queda satisfecha por las columnas `createdAtMateria`/`creadoPorUsuarioId` que la propia fila de `Materia` ya persiste — no hace falta un evento/log aparte para eso.

**Revisión 2 (Sprint 2) — trazabilidad (Regla N.° 2).** La modificación de una materia usa la **opción (a)**: `updatedAtMateria`, `modificadoPorUsuarioId` y `version` en la propia fila; HU-L-03 AC3 ("se registra la fecha de última modificación") queda cubierta por `updatedAtMateria`. No hay evento `materia:modificada`.
```
