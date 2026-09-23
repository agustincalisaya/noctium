# TASK: HU-B-04 — Listar alumnos

**Módulo:** B (Alumno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_B.md` sección 2.4 · ver Nota de alcance
**RBAC:** `alumnos:leer` — **nuevo**, exclusivo de MESA_ENTRADA (mismo criterio que `alumnos:crear`/`alumnos:editar`)
**Schema:** requiere migración — agregar `apellidoNormalizadoAlumno`/`nombreNormalizadoAlumno` a `Alumno` (ver sección 0 y 1)
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/alumno.types.ts`, actions en `src/server/alumnos/actions.ts`, service en `src/server/alumnos/alumno.service.ts`)

---

## 0. Relevamiento previo a implementación (Claude Code)

Relevamiento realizado el 2026-09-23 sobre `feature/HU-B-04` (creada desde `develop`, con HU-L-02 — Listar materias — ya mergeada). Resultado con las decisiones ya resueltas.

**Archivos nuevos a crear:**

| Archivo | Contenido |
|---|---|
| `src/app/api/alumnos/[id]/route.ts` | Route Handler `GET` detalle — archivo nuevo (no existía ni como 501) |
| `prisma/migrations/<ts>_add_apellido_nombre_normalizado_alumno_nullable/` | Paso 1 de la migración en dos pasos |
| `prisma/migrations/<ts>_apellido_nombre_normalizado_alumno_not_null/` | Paso 2 de la migración (sin `UNIQUE`, a diferencia de Materia) |
| `prisma/migrations/<ts>_alumnos_leer_permiso/` | Mismo patrón que `20260923021000_alumnos_editar_permiso` — permiso insertado también por migración, no solo por seed |
| `src/app/(dashboard)/alumnos/error.tsx` | Boundary de error con "Reintentar" — no existía (a diferencia de `materias/error.tsx`), lo exige el criterio 6 |
| `src/app/(dashboard)/alumnos/[id]/ficha-alta-pago.tsx` | Sección nueva de la ficha: fecha de alta + forma de pago preferida — mismo patrón que `ficha-contacto.tsx`, usando `FichaSeccion`/`FichaDatos` ya existente |

**Archivos existentes a modificar:**

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregar `apellidoNormalizadoAlumno`/`nombreNormalizadoAlumno` (`String`, no únicos) al modelo `Alumno` |
| `prisma/seed.ts` | Setear los campos normalizados al crear alumnos (vía `normalizarTexto()`, la misma utilidad de Materias) + agregar `alumnos:leer` a `RolPermiso`, exclusivo MESA_ENTRADA |
| `src/server/alumnos/alumno.schema.ts` | Agregar `ListarAlumnosQuerySchema` (`pagina`, `por_pagina`, default 1/20, máx 20) |
| `src/server/alumnos/alumno.service.ts` | Agregar `listarAlumnos()` y `obtenerDetalleAlumno()` (nueva, separada de `obtenerFichaAlumno()` — ver Nota de alcance) |
| `src/types/alumno.types.ts` | Tipos de listado (ítem + paginación) y del detalle extendido |
| `src/app/(dashboard)/alumnos/page.tsx` | Reemplaza el placeholder ("Alumnos - en construcción", sin gating real) por el listado real, gateado por `alumnos:leer` |
| `src/app/(dashboard)/alumnos/[id]/page.tsx` | Cambia el gating de `alumnos:editar` a `alumnos:leer` (deriva `puedeEditar` de un segundo `verificarPermiso`, tal como ya lo dejó anotado el comentario del propio archivo en HU-B-02); agrega la sección `ficha-alta-pago.tsx`; lee `?pagina=` para el link "Volver al listado" |
| `src/app/(dashboard)/alumnos/[id]/contacto/page.tsx` | Ajuste de gating a confirmar en la implementación si corresponde (sigue usando `obtenerFichaAlumno()`, no `obtenerDetalleAlumno()`) |
| `src/app/(dashboard)/alumnos/[id]/ficha-encabezado.tsx` | **Corrección retroactiva:** cambia el `Badge` de Activo/Inactivo de `accent`/`outline` a `success`/`muted`, para alinear con el criterio usado en el listado nuevo (ver Nota de alcance) |
| `src/components/shared/pagination.tsx` | Agregar prop opcional `total` (cantidad de registros), reusable a futuro por otros listados |

---

## 1. Nota de alcance

**Decisiones resueltas (Adriel, 2026-09-23):**

1. **Link "Modificar datos" (criterio 3):** HU-B-06 todavía no existe en el orden de implementación elegido (B-01, B-02, B-04, B-03, B-06, B-08). **Se omite por completo** — no se agrega ningún botón deshabilitado ni sin destino real. Queda documentado acá como pendiente explícito de HU-B-06, no como negligencia: es una dependencia entre HU del mismo sprint, no un criterio incumplido por descuido.
2. **Permiso `alumnos:leer`:** exclusivo de MESA_ENTRADA. Ninguna HU de este sprint requiere que Gerente o Profesor lean el listado HTTP de alumnos — Turnos (Módulo C) consume `Alumno` vía servicio público (`verificarAlumnoActivo`, `buscarAlumnosActivos`, `spec_modulo_C.md` §2.2), no por este permiso.
3. **Orden normalizado:** se persisten `apellidoNormalizadoAlumno`/`nombreNormalizadoAlumno` en `Alumno` (sin `UNIQUE` — apellido/nombre no son únicos, a diferencia del nombre de materia). `normalizarTexto()` es lógica JS pura (NFD + strip diacríticos + lowercase), no expresable en SQL crudo sin extensión `unaccent`; ordenar en runtime rompería el `skip`/`take` de la paginación server-side. Migración en dos pasos (nullable → backfill → `NOT NULL`), mismo patrón ya usado en HU-L-01/L-02.
4. **Badge Activo/Inactivo:** se usa `success`/`muted` en **todo** el módulo Alumno — incluida la corrección retroactiva de `ficha-encabezado.tsx` (HU-B-02, ya mergeada), que había quedado con `accent`/`outline`. Es código del propio módulo B, corregirlo para consistencia interna sí corresponde (distinto de tocar código de otro módulo, que sigue fuera de alcance).
5. **Paginación con total de registros:** se extiende `src/components/shared/pagination.tsx` con una prop opcional `total`, en vez de renderizar el total aparte — queda reusable para cuando otros listados (Aulas, Profesores) también lo necesiten.
6. **`obtenerFichaAlumno()` vs. función nueva:** se crea `obtenerDetalleAlumno()` separada para la ficha completa (identidad + contacto + forma de pago + fecha de alta); `obtenerFichaAlumno()` se deja tal cual para el formulario de contacto, que no necesita forma de pago ni fecha de alta.
7. **Conservar página al volver:** se propaga `?pagina=N` como query param desde el listado hacia la ficha (`/alumnos/[id]?pagina=N`), que lo usa para armar su link "Volver al listado" (`/alumnos?pagina=N`).
8. **Truncado de valores largos (criterio 1):** primera vez que aparece este patrón en el proyecto (ninguna tabla existente lo necesitó). Se resuelve con `truncate` de Tailwind + atributo `title` con el valor completo en la celda — el valor completo de todas formas está disponible en el detalle.
9. **`loading.tsx`:** no existe ningún `loading.tsx` de carpeta hoy en `alumnos/` — no hay bug heredado que corregir (a diferencia del que se encontró y corrigió en `materias/` durante HU-L-02). Se usa `<Suspense>` manual acotado a la tabla, mismo patrón ya aplicado en `materias/page.tsx`.

**Fuera de alcance de esta historia** (textual del documento oficial "Historias de Usuario - Sprint 1"):
- Búsqueda inteligente de alumno (Sprint 2).
- Filtros por estado u otros criterios (Sprint 2).
- Desactivar alumno (Sprint 3).

**Fuera de alcance de esta task (adicional):**
- El link "Modificar datos" (punto 1 arriba) — pertenece a HU-B-06.
- Forma de pago preferida editable — esta task solo **muestra** la forma de pago preferida ya existente (o "Sin preferencia" si no hay ninguna); **asociarla/cambiarla** es HU-B-03, siguiente en el orden de implementación.
- Búsqueda de alumno para asignarlo a un turno (HU-C-04) — usa su propio criterio de búsqueda parcial desde 2 caracteres, no reutiliza este listado paginado.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** consultar los alumnos registrados
**Para** acceder a sus fichas y realizar las acciones disponibles en este Sprint

**SP estimado:** 2

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_B.md` §2.4. Incluye:

- Migración: columnas normalizadas en `Alumno` + permiso `alumnos:leer` vía migración y seed.
- Schema Zod: `ListarAlumnosQuerySchema`.
- Servicio (`src/server/alumnos/alumno.service.ts`): `listarAlumnos()`, `obtenerDetalleAlumno()`.
- Route Handlers: `GET /api/alumnos` (listado, hoy 501) y `GET /api/alumnos/[id]` (detalle, archivo nuevo).
- UI: listado paginado en `/alumnos`, extensión de la ficha `/alumnos/[id]` con fecha de alta y forma de pago preferida.
- Extensión de `pagination.tsx` con prop `total`.
- Corrección retroactiva del `Badge` en `ficha-encabezado.tsx`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo indicado en la sección 1.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/alumnos/alumno.schema.ts`

```typescript
export const ListarAlumnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarAlumnosQuery = z.infer<typeof ListarAlumnosQuerySchema>;
```

### 4.2. Servicio

**Archivo:** `src/server/alumnos/alumno.service.ts`
**Funciones:** `listarAlumnos(query: ListarAlumnosQuery)`, `obtenerDetalleAlumno(alumnoId: string)`

`listarAlumnos()`:
1. Incluye alumnos activos e inactivos.
2. Orden: `apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno` ascendente, `dniAlumno` como segundo criterio (desempate estable).
3. Cada ítem: apellido, nombre, DNI, teléfono (`null` → `"—"` se resuelve en el frontend), email (ídem), `activoAlumno`.
4. Paginación server-side (`skip`/`take`), con metadatos: `total`, `pagina_actual`, `total_paginas`, `por_pagina`.

`obtenerDetalleAlumno()`:
1. Identidad + contacto + forma de pago preferida (nombre resuelto vía `include`, no solo el id) + estado + `createdAtAlumno`.
2. Si `alumnoId` no existe: error `ALUMNO_NO_ENCONTRADO`.

**Errores de servicio:** `ALUMNO_NO_ENCONTRADO`.

### 4.3. Route Handlers

**Archivo:** `src/app/api/alumnos/route.ts`
**Método:** `GET`
**Permiso de acceso:** `withPermission("alumnos:leer")`
Valida `ListarAlumnosQuerySchema` sobre los query params, invoca `listarAlumnos()`.

- `200 OK`: `{ "data": { "items": [...], "paginacion": { "total": n, "pagina_actual": n, "total_paginas": n, "por_pagina": n } }, "error": null }`

**Archivo:** `src/app/api/alumnos/[id]/route.ts`
**Método:** `GET`
**Permiso de acceso:** `withPermission("alumnos:leer")`
Invoca `obtenerDetalleAlumno()`.

- `200 OK`: detalle completo.
- `404`: `ALUMNO_NO_ENCONTRADO`.

### 4.4. Server Action

No aplica — esta HU es de solo lectura, se consume directamente desde Server Components (mismo patrón que `materias/page.tsx`), sin necesidad de Server Action ni `revalidatePath`.

### 4.5. Eventos de dominio

No aplica — HU de solo lectura, sin mutación.

---

## 5. Frontend

- `/alumnos` — listado paginado: Apellido y nombre, DNI, Teléfono (`"—"` si ausente), Email (`"—"` si ausente), Estado (`Badge` `success`/`muted`, texto + color). Orden inicial por apellido/nombre ascendente. Valores largos truncados con `title` completo. Estados: `"Cargando alumnos"`, `"No hay alumnos registrados"` con acceso a "Nuevo alumno", error con "Reintentar" (`error.tsx` nuevo). Paginación con `pagination.tsx` extendido (muestra página actual, total de páginas y total de registros). Cada fila abre el detalle con `?pagina=N` en la URL.
- `/alumnos/[id]` — se extiende con `ficha-alta-pago.tsx` (fecha de alta + forma de pago preferida, usando `FichaSeccion`/`FichaDatos` existente). Gating cambia a `alumnos:leer`; `puedeEditar` se deriva de un segundo `verificarPermiso("alumnos:editar")` (mismo patrón ya anotado en el comentario del propio archivo desde HU-B-02). Lee `?pagina=` para el link "Volver al listado".
- Seguir `docs/DESIGN.md`. El `Badge` de estado usa `success`/`muted` en todo el módulo (incluida la corrección de `ficha-encabezado.tsx`).

**Fuera de alcance de frontend:** búsqueda, filtros, desactivación, link "Modificar datos" (ver Nota de alcance), edición de forma de pago (HU-B-03).

---

## 6. Testing (tres niveles, según metodología del proyecto)

> **Nota:** sin test runner instalado en el proyecto (mismo estado ya documentado en HU-B-01/HU-B-02). Nivel 1 se documenta igual, aclarando que no corre.

### Nivel 1 — Unitarios (no ejecutables por ahora, documentar igual)
- `listarAlumnos()`: orden estable con apellidos repetidos (desempate por DNI), paginación (página 1, página intermedia, última página), alumnos activos e inactivos incluidos.
- `obtenerDetalleAlumno()`: caso de éxito con forma de pago resuelta, caso sin forma de pago (`null` → "Sin preferencia"), alumno inexistente.

### Nivel 2 — Postman / curl
- Listado sin query params → `200`, página 1, 20 por página.
- Listado con `pagina`/`por_pagina` distintos → `200`, paginación correcta, sin duplicar ni omitir registros entre páginas.
- Detalle de alumno existente → `200`, incluye forma de pago resuelta por nombre y fecha de alta.
- Detalle de alumno inexistente → `404 ALUMNO_NO_ENCONTRADO`.
- Sin permiso (rol distinto de MESA_ENTRADA) → `403` en ambos endpoints.
- Sin sesión → `401`.

### Nivel 3 — BD / TablePlus
- Verificar que `apellidoNormalizadoAlumno`/`nombreNormalizadoAlumno` se completaron correctamente para todos los alumnos existentes tras la migración (backfill).
- Verificar el permiso `alumnos:leer` sembrado exclusivamente para MESA_ENTRADA.

**Evidencia esperada:** curl/Postman + SQL; capturas de UI (listado con varias páginas, estado vacío, ficha extendida con fecha de alta y forma de pago).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Migración de columnas normalizadas aplicada y backfill verificado.
- [ ] Service y Route Handlers implementados, sin lógica de negocio fuera de la capa de servicios.
- [ ] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Permiso `alumnos:leer` agregado al seed y a la migración, exclusivo MESA_ENTRADA.
- [ ] `pagination.tsx` extendido con prop `total`, sin romper su uso existente en Materias.
- [ ] `ficha-encabezado.tsx` corregido a `Badge` `success`/`muted`.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Frontend funcional: listado `/alumnos` + ficha extendida `/alumnos/[id]`.
- [ ] `npm run lint` y `npm run build` corren limpios.
- [ ] Tests de los niveles 2 y 3 documentados con evidencia (Nivel 1 documentado como no ejecutable).
- [ ] PR con diff acotado exclusivamente a esta HU — sin tocar código de otros módulos.
- [ ] Verificado manualmente por Adriel en el navegador antes del commit final.

---

## 8. Correcciones posteriores

*(se completa si surgen ajustes después de la primera implementación, siguiendo el mismo criterio que HU-B-01/HU-B-02)*
