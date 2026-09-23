# TASK: HU-K-02 — Listar aulas

**Módulo:** K (Aulas)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_K.md` sección 2.2 · reglas sección 3.2 · eventos sección 4 (sin eventos nuevos en esta task) · `docs/tasks/HU-Sprint-1.md` HU-K-02, criterio de aceptación 4 (estados vacío/carga/error)
**RBAC:** requiere el permiso `aulas:leer`, agregado al seed de `RolPermiso`. La spec no acota a qué roles se asigna más allá de "quien lo necesite" — ver punto abierto.
**Schema:** no agrega modelos nuevos. Depende de `Aula` (HU-K-01, ya existente). Depende de la collation `natural_es` sobre la columna `nombre` — **punto crítico de esta task**, ver Nota de alcance.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno) — en particular el seed de `RolPermiso`, que pasa a incluir `aulas:leer`.
- **Si la columna `nombre` de `Aula` ya tiene la collation `natural_es` aplicada** (si HU-K-01 se implementó asumiendo el punto abierto que dejó a favor de aplicarla en su propia migración) — esto determina si esta task necesita su propia migración `ALTER COLUMN` o no. Pregunta concreta, nunca resuelto por inferencia propia del agente.
- Todo otro punto marcado en esta task como **"relevar antes de asumir"**.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance — collation `natural_es` y su dependencia de HU-K-01

`spec_modulo_K.md` §2.2 define el orden natural ("Aula 2" antes que "Aula 10") como una propiedad de la columna `nombre` de `Aula` vía la collation ICU `natural_es`, no como lógica de consulta. HU-K-01 dejó explícitamente abierto si esa collation se aplica en su propia migración (al crear la tabla) o en esta:

- Si HU-K-01 ya la aplicó: esta task **no crea ninguna migración de schema** — solo necesita el `orderBy: { nombre: "asc" }` estándar de Prisma, que ya produce el orden correcto gracias a la collation existente.
- Si HU-K-01 no la aplicó (dejó `nombre` con la collation por defecto): esta task **sí** crea la migración `ALTER TABLE "Aula" ALTER COLUMN "nombre" TYPE varchar(30) COLLATE "natural_es"` (más la sentencia `CREATE COLLATION IF NOT EXISTS natural_es ...` si tampoco existe todavía a nivel de base).

Ambos casos son válidos y la task se adapta a cuál se encuentre — **no se asume ninguno de los dos sin verificarlo primero en el relevamiento** (sección 0).

**Fuera de alcance de esta task (explícito):**
- Cualquier endpoint de escritura sobre `Aula` — HU-K-01, ya implementada.
- Cualquier lógica de disponibilidad por horario o asignación a turnos — sigue siendo exclusiva de `spec_modulo_C.md` (HU-C-15), igual que en HU-K-01.
- Reimplementar el orden natural en JavaScript o con una expresión SQL ad-hoc por consulta — la Regla de negocio 3.2 de la spec lo prohíbe explícitamente: la collation es la única fuente de ese comportamiento.

---

## 2. Historia de Usuario

**Como** usuario con acceso al catálogo de aulas
**Necesito** ver el listado de aulas registradas, en orden natural y con su capacidad y estado
**Para** consultarlas al operar otros módulos (asignación a turnos) sin tener que buscarlas en otro lado

**SP estimado:** 2

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_K.md` §2.2. Incluye:
- Migración de la collation `natural_es`, **solo si HU-K-01 no la aplicó ya** (ver sección 1).
- Capa de servicios (`lib/services/aulas/aula.service.ts` → `listarAulas()`, `obtenerAulaPorId()`), agregadas al archivo ya creado en HU-K-01.
- Schema Zod de query params (`lib/schemas/aulas.schema.ts` → `ListarAulasQuerySchema`), agregado al archivo de HU-K-01.
- Route Handlers: `app/api/aulas/route.ts` (método `GET`, agregado al archivo de HU-K-01 que ya tiene el `POST`) y `app/api/aulas/[id]/route.ts` (nuevo, método `GET`).
- Agregar `aulas:leer` al seed de `RolPermiso` — ver punto abierto de roles en sección 4.3.
- UI: tabla de listado con paginación, estados de vacío/carga/error, y vista de detalle.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- `POST /api/aulas` — ya existe (HU-K-01), no se toca.
- Cualquier campo o endpoint de disponibilidad/asignación a turnos.
- Filtros de búsqueda por nombre — no están en el criterio de aceptación de esta HU tal como está descripta.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `lib/schemas/aulas.schema.ts` (agregado a lo existente de HU-K-01)

```typescript
export const ListarAulasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarAulasQuery = z.infer<typeof ListarAulasQuerySchema>;
```

### 4.2. Servicio

**Archivo:** `lib/services/aulas/aula.service.ts` (agregado a lo existente de HU-K-01)

**Función:** `listarAulas(query: ListarAulasQuery): Promise<{ items: AulaListItem[]; paginacion: Paginacion }>`

Comportamiento exigido (`spec_modulo_K.md` §2.2):
1. Consulta **sin** filtro `is_active` — incluye aulas activas e inactivas.
2. `orderBy: { nombre: "asc" }` estándar de Prisma — el orden natural lo garantiza la collation de la columna, **nunca** una transformación en el código de este servicio.
3. Cada ítem: `nombre`, `capacidad`, `is_active`.
4. Paginación server-side (`skip`/`take`) según `pagina`/`por_pagina`, con `total`, `pagina_actual`, `total_paginas`, `por_pagina` en la respuesta.

**Función:** `obtenerAulaPorId(id: string): Promise<AulaDetalle>`

Comportamiento exigido:
1. Buscar por `id`, sin filtro `is_active` (un aula inactiva sigue siendo consultable en detalle).
2. Si no existe → `404 AULA_NO_ENCONTRADA`.
3. Incluir `nombre`, `capacidad`, `is_active`, `created_at`.

**Errores de servicio a definir:** `AULA_NO_ENCONTRADA`.

### 4.3. Route Handlers

**Archivo:** `app/api/aulas/route.ts` (agregado — ya tiene el `POST` de HU-K-01)
**Método:** `GET`
**Permiso de acceso:** `withPermission("aulas:leer")`

**Archivo:** `app/api/aulas/[id]/route.ts` (nuevo)
**Método:** `GET`
**Permiso de acceso:** `withPermission("aulas:leer")`

**Roles asignados a `aulas:leer` — DECISIÓN RESUELTA:** exclusivo del rol Gerente, conforme al backlog oficial (`HU-Sprint-1.md`, columna de rol de HU-K-02). No se siembra para Mesa de Entrada ni Profesor en este sprint. Si HU-C-15 (asignación de aula a turno, fuera del alcance de esta persona) necesita consultar aulas, es responsabilidad de esa HU gestionar su propio acceso — no se anticipa acá.

### 4.4. Server Action

No aplica una Server Action de mutación (es una consulta) — mismo criterio y mismo punto abierto que HU-L-02 sobre Server Action vs. fetch directo para listados, todavía sin cerrar en el proyecto.

### 4.5. Eventos de dominio

No hay eventos nuevos — una consulta de lectura no dispara auditoría conforme a `docs/RULES.md` Regla N.° 2.

---

## 5. Frontend

- Tabla de listado (`app/(dashboard)/aulas/page.tsx`): columnas Nombre/Número, Capacidad, Estado (activa/inactiva) — visual claramente distinto para inactivas, igual que en Materias.
- Verificar visualmente en la UI que el orden mostrado es el natural (Aula 2 antes que Aula 10), no solo confiar en que la collation está aplicada — es el criterio de aceptación observable por el usuario.
- Paginación client-side conectada a los query params (`pagina`, `por_pagina`).
- Fila clickeable → navega al detalle (`app/(dashboard)/aulas/[id]/page.tsx`).
- **Estados de la lista (`HU-Sprint-1.md`, HU-K-02, criterio de aceptación 4):**
  - **Carga:** mientras se resuelve la consulta, mostrar un indicador de carga ("Cargando aulas") en vez de una tabla vacía o parpadeante.
  - **Vacío:** si no hay aulas registradas (colección vacía, no error), mostrar el mensaje "No hay aulas registradas" junto con un acceso directo al botón/enlace "Nueva aula" (mismo destino que en HU-K-01).
  - **Error:** si la consulta falla (error de red o `5xx`), mostrar un mensaje de error genérico con un botón "Reintentar" que vuelve a disparar la consulta sin recargar la página completa.
- Gateado por permiso: la sección completa de Aulas en la navegación solo se muestra si el rol de la sesión tiene `aulas:leer`.
- Estilos: seguir `docs/DESIGN.md`. Usar exclusivamente tokens (`bg-primary`, `text-muted-foreground`, `bg-brand-accent`, `bg-success`, `bg-warning`, etc.). Prohibido usar colores hex o la paleta default de Tailwind (`blue-600`, `emerald-100`, etc.).

**Fuera de alcance de frontend:** filtros de búsqueda; acciones de edición o baja (no existen en el backend de este sprint); cualquier indicación de disponibilidad por horario.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- Listado incluye aulas activas e inactivas sin necesidad de un parámetro explícito para pedirlas.
- Orden natural verificado explícitamente con un caso `"Aula 2"` / `"Aula 10"` — falla si el resultado viene en orden alfabético puro (esto es lo que confirma que la collation está realmente aplicada, no solo declarada).
- Paginación: `pagina=2`, `por_pagina=5` con 8 registros → devuelve los ítems 6-8, `total_paginas: 2`.
- `obtenerAulaPorId()` con un `id` inexistente → `404 AULA_NO_ENCONTRADA`.
- `obtenerAulaPorId()` sobre un aula inactiva → la devuelve igual (no es un 404 solo por estar inactiva).

### Nivel 2 — Postman
- Listado exitoso (rol con `aulas:leer`) → `200`, incluye aulas activas e inactivas, en orden natural verificable con datos de prueba tipo "Aula 2"/"Aula 10".
- Listado con rol sin `aulas:leer` → `403 SIN_PERMISO`.
- Detalle de aula existente → `200`.
- Detalle de aula inexistente → `404 AULA_NO_ENCONTRADA`.
- `por_pagina` fuera de rango → `400`, error de validación Zod.

### Nivel 3 — BD / TablePlus
- Verificar directamente en el schema (no solo por el resultado de la API) que la columna `nombre` de `Aula` tiene la collation `natural_es` aplicada.
- Correr `SELECT nombre FROM "Aula" ORDER BY nombre ASC` directo en TablePlus con datos "Aula 2"/"Aula 10"/"Aula 3" y confirmar el orden natural a nivel de base, no solo a través de Prisma.
- No aplica verificación de `AuditLog` (no hay eventos en esta task, operación de solo lectura).
- Verificar en `RolPermiso` que `aulas:leer` quedó sembrado exactamente para los roles acordados (punto abierto de la sección 4.3).

**Evidencia esperada:** Postman + SQL para el contrato de API y capa de datos (incluyendo el `SELECT ... ORDER BY` directo); capturas de la tabla de listado mostrando el orden natural con al menos un caso de doble dígito, y de los tres estados (carga, vacío, error con Reintentar).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar, incluyendo el estado real de la collation `natural_es` sobre `Aula.nombre`.
- [ ] Migración de collation creada **solo si** HU-K-01 no la aplicó ya (verificado en el relevamiento, no asumido).
- [ ] Punto abierto de la sección 4.3 (roles asignados a `aulas:leer`) resuelto y documentado como "DECISIÓN RESUELTA".
- [ ] Punto abierto de la sección 4.4 (Server Action vs. fetch directo) resuelto — consistente con lo decidido en HU-L-02 si ya se resolvió ahí.
- [ ] Servicios y Route Handlers implementados sin lógica de negocio fuera de `aula.service.ts`.
- [ ] Ninguna lógica de ordenamiento natural en JavaScript o SQL ad-hoc introducida (Regla de negocio 3.2) — el `orderBy` estándar es la única fuente.
- [ ] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Listado incluye aulas activas e inactivas, en orden natural verificado con evidencia.
- [ ] Frontend funcional: tabla paginada con estado visible, orden natural verificable, estados de carga/vacío/error con Reintentar, vista de detalle, gateado por permiso.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia, incluyendo el `SELECT` directo en BD del orden natural.
- [ ] UI sin colores hardcodeados: solo tokens definidos en `docs/DESIGN.md`.
- [ ] PR con diff acotado exclusivamente a esta HU (sin tocar `POST /api/aulas`, ya cerrado en HU-K-01).