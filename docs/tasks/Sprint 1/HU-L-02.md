# TASK: HU-L-02 — Listar materias

**Módulo:** L (Materias)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_L.md` sección 2.2 · eventos sección 4 (sin eventos nuevos en esta task) · `docs/tasks/HU-Sprint-1.md` HU-L-02, criterio de aceptación 4 (estados vacío/carga/error)
**RBAC:** requiere el permiso `materias:leer`, asignado a Gerente, Mesa de Entrada y Profesor (todo rol que necesite consultar el catálogo al operar otro módulo — Alumno queda afuera salvo que se confirme lo contrario, ver punto abierto).
**Schema:** no agrega modelos nuevos. Depende de `Materia` (HU-L-01, ya existente) y de `ProfesorMateria` (`spec_modulo_D.md` §2.3) para el conteo de profesores asociados por materia — **punto crítico de esta task**, ver Nota de alcance.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno) — en particular el seed de `RolPermiso`, que pasa a incluir `materias:leer`.
- El estado real de `ProfesorMateria` al momento de implementar esta task (¿existe ya la tabla, por HU-D-03, o todavía no?) — con la pregunta concreta, nunca resuelto por inferencia propia del agente.
- Todo otro punto marcado en esta task como **"relevar antes de asumir"**.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance — dependencia cruzada con `spec_modulo_D.md` (Profesor)

`spec_modulo_L.md` §2.2 exige que cada ítem del listado incluya `profesores_count`, resuelto vía `_count` sobre `ProfesorMateria`. Esa tabla la define `spec_modulo_D.md` §2.3 (HU-D-03, asociación profesor↔materia), que **no forma parte de las 7 HU asignadas a esta persona** en este sprint y puede no estar implementada todavía cuando se ejecute esta task.

**Punto abierto — cómo proceder si `ProfesorMateria` no existe todavía (relevar antes de implementar, no resolver por inferencia):**
- **(a)** Implementar el listado completo tal como lo pide la spec, y si `ProfesorMateria` no existe, la migración de esta misma task la crea de forma mínima (solo la tabla puente, sin el resto del contrato de HU-D-03) — **riesgo:** esta task terminaría creando schema que en rigor pertenece a otra HU, y si luego HU-D-03 la crea con una forma distinta, hay conflicto de migraciones.
- **(b)** Implementar el listado devolviendo `profesores_count: 0` fijo (o el campo ausente) mientras `ProfesorMateria` no exista, documentado como una simplificación temporal a corregir cuando HU-D-03 esté hecha — se anota como nota de sincronización en `spec_modulo_L.md` §2.2.
- **(c)** Bloquear esta task hasta que `ProfesorMateria` exista (coordinar el orden con quien implemente HU-D-03).

Mientras no se confirme, esta task avanza asumiendo **(b)** por ser la que menos acopla el trabajo de una persona al de otra, pero queda marcado como "DECISIÓN A CONFIRMAR" — Claude Code debe re-preguntarlo en el relevamiento (sección 0), verificando primero si `ProfesorMateria` ya existe en el schema real antes de asumir que hace falta el fallback.

**Punto abierto — tensión con la Regla N.° 3 de `docs/RULES.md` (aislamiento de dominio):** un `_count` de Prisma directo sobre `ProfesorMateria` desde el servicio de Materias es, en sentido estricto, una consulta directa a una tabla que pertenece al dominio de Profesor (Módulo D) — la Regla N.° 3 exige que la comunicación entre módulos ocurra vía eventos de dominio o el servicio público del otro módulo, no vía acceso directo a su tabla. Esta tensión ya viene dada por `spec_modulo_L.md` (no la introduce esta task), pero conviene resolverla explícitamente antes de implementar: o bien (i) se invoca un servicio público de Módulo D (ej. `contarMateriasPorProfesor()` o el equivalente expuesto desde `lib/services/profesores/`), o bien (ii) se mantiene el `_count` directo por pragmatismo y se documenta como una excepción explícita a la Regla N.° 3 en `spec_modulo_L.md`, tal como el propio `RULES.md` exige para cualquier excepción ("se documenta explícitamente... nunca se aplica en silencio"). **Relevar con el equipo antes de implementar** — no se resuelve por default a ninguna de las dos opciones.

**Punto abierto — ¿el rol Alumno tiene `materias:leer`?** La spec dice "todo rol que necesite consultar el catálogo al operar otro módulo" sin nombrar explícitamente a Alumno. Un alumno podría razonablemente necesitar ver el catálogo de materias (p. ej. al pedir un turno). **Confirmar con el equipo** antes de sembrar el permiso — esta task no le asigna `materias:leer` a Alumno por defecto, solo a Gerente/Mesa de Entrada/Profesor, hasta que se confirme lo contrario.

**Fuera de alcance de esta task (explícito):**
- Cualquier endpoint de escritura sobre `Materia` — HU-L-01, ya implementada.
- El contrato completo de `ProfesorMateria` / HU-D-03 — esta task, en el peor caso (opción (a) si se confirma), crea como mucho la tabla puente mínima, nunca la lógica de asociación en sí.

---

## 2. Historia de Usuario

**Como** usuario con acceso al catálogo de materias (Gerente, Mesa de Entrada, Profesor)
**Necesito** ver el listado de materias registradas, con su estado y detalle
**Para** consultarlas al operar otros módulos (asociación de profesores, configuración de turnos) sin tener que buscarlas en otro lado

**SP estimado:** 2

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_L.md` §2.2. Incluye:
- Capa de servicios (`lib/services/materias/materia.service.ts` → `listarMaterias()`, `obtenerMateriaPorId()`), agregadas al archivo ya creado en HU-L-01.
- Schema Zod de query params (`lib/schemas/materias.schema.ts` → `ListarMateriasQuerySchema`), agregado al archivo de HU-L-01.
- Route Handlers: `app/api/materias/route.ts` (método `GET`, agregado al archivo de HU-L-01 que ya tiene el `POST`) y `app/api/materias/[id]/route.ts` (nuevo, método `GET`).
- Agregar `materias:leer` al seed de `RolPermiso`, asignado a Gerente, Mesa de Entrada y Profesor.
- UI: tabla de listado con paginación, estados de vacío/carga/error, y vista de detalle.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- `POST /api/materias` — ya existe (HU-L-01), no se toca.
- El contrato completo de `ProfesorMateria` más allá de lo que el punto abierto de la sección 1 resuelva.
- Filtros de búsqueda por nombre/código — no están en el criterio de aceptación de esta HU tal como está descripta; si se necesitan, es una ampliación a proponer aparte.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `lib/schemas/materias.schema.ts` (agregado a lo existente de HU-L-01)

```typescript
export const ListarMateriasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarMateriasQuery = z.infer<typeof ListarMateriasQuerySchema>;
```

### 4.2. Servicio

**Archivo:** `lib/services/materias/materia.service.ts` (agregado a lo existente de HU-L-01)

**Función:** `listarMaterias(query: ListarMateriasQuery): Promise<{ items: MateriaListItem[]; paginacion: Paginacion }>`

Comportamiento exigido (`spec_modulo_L.md` §2.2):
1. Consulta **sin** filtro `is_active` — incluye materias activas e inactivas.
2. Orden por `nombre_normalizado` ascendente.
3. Cada ítem incluye `profesores_count` — resuelto según lo que determine el punto abierto de la sección 1 (servicio público de Módulo D, `_count` directo documentado como excepción, o fallback fijo si `ProfesorMateria` no existe todavía).
4. Paginación server-side (`skip`/`take`) según `pagina`/`por_pagina`, con `total`, `pagina_actual`, `total_paginas`, `por_pagina` en la respuesta.

**Función:** `obtenerMateriaPorId(id: string): Promise<MateriaDetalle>`

Comportamiento exigido:
1. Buscar por `id`, sin filtro `is_active` (una materia inactiva sigue siendo consultable en detalle).
2. Si no existe → `404 MATERIA_NO_ENCONTRADA`.
3. Incluir `nombre`, `codigo`, `is_active`, `created_at`, y el listado de profesores asociados (`nombre_completo`) — mismo punto abierto de la sección 1.

**Errores de servicio a definir:** `MATERIA_NO_ENCONTRADA`.

### 4.3. Route Handlers

**Archivo:** `app/api/materias/route.ts` (agregado — ya tiene el `POST` de HU-L-01)
**Método:** `GET`
**Permiso de acceso:** `withPermission("materias:leer")`

**Archivo:** `app/api/materias/[id]/route.ts` (nuevo)
**Método:** `GET`
**Permiso de acceso:** `withPermission("materias:leer")`

### 4.4. Server Action

No aplica una Server Action de mutación (es una consulta). Si el frontend consume estos datos vía Server Component con fetch directo a la capa de servicios en lugar de pasar por el Route Handler, **relevar antes de implementar** cuál de los dos patrones sigue el proyecto para listados — la spec no lo resuelve y HU-A-01 dejó abierto un punto similar (Server Action vs. patrón directo) sin cerrarlo todavía.

### 4.5. Eventos de dominio

No hay eventos nuevos — una consulta de lectura no dispara auditoría conforme a `docs/RULES.md` Regla N.° 2 (la auditoría cubre mutaciones sensibles, no lecturas).

---

## 5. Frontend

- Tabla de listado (`app/(dashboard)/materias/page.tsx`): columnas Nombre, Código, Cantidad de profesores, Estado (activa/inactiva) — visual claramente distinto para inactivas (p. ej. atenuado o badge), ya que el listado las incluye a propósito.
- Paginación client-side conectada a los query params (`pagina`, `por_pagina`).
- Fila clickeable → navega al detalle (`app/(dashboard)/materias/[id]/page.tsx`), que muestra el listado de profesores asociados.
- **Estados de la lista (`HU-Sprint-1.md`, HU-L-02, criterio de aceptación 4):**
  - **Carga:** mientras se resuelve la consulta, mostrar un indicador de carga ("Cargando materias") en vez de una tabla vacía o parpadeante.
  - **Vacío:** si no hay materias registradas (colección vacía, no error), mostrar el mensaje "No hay materias registradas" junto con un acceso directo al botón/enlace "Nueva materia" (mismo destino que en HU-L-01).
  - **Error:** si la consulta falla (error de red o `5xx`), mostrar un mensaje de error genérico con un botón "Reintentar" que vuelve a disparar la consulta sin recargar la página completa.
- Gateado por permiso: la sección completa de Materias en la navegación solo se muestra si el rol de la sesión tiene `materias:leer` — la verificación real es la del Route Handler, esto es solo ocultamiento de UI.
- Si `profesores_count`/el listado de profesores queda en `0`/vacío por el punto abierto de la sección 1 (opción (b)), la UI igual debe renderizar esa columna sin romperse — no asumir que el dato siempre viene poblado.

**Fuera de alcance de frontend:** filtros de búsqueda; acciones de edición o baja (no existen en el backend de este sprint).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- Listado incluye materias activas e inactivas sin necesidad de un parámetro explícito para pedirlas.
- Orden por `nombre_normalizado` ascendente, verificado con nombres que difieren solo en acentos/mayúsculas.
- Paginación: `pagina=2`, `por_pagina=5` con 12 registros → devuelve los ítems 6-10, `total_paginas: 3`.
- `obtenerMateriaPorId()` con un `id` inexistente → `404 MATERIA_NO_ENCONTRADA`.
- `obtenerMateriaPorId()` sobre una materia inactiva → la devuelve igual (no es un 404 solo por estar inactiva).
- `profesores_count` refleja correctamente la cantidad de filas en `ProfesorMateria` para esa materia (si la tabla ya existe al momento de testear) — o el valor fijo acordado en el punto abierto (si no existe todavía).

### Nivel 2 — Postman
- Listado exitoso (cualquier rol con `materias:leer`) → `200`, incluye materias activas e inactivas.
- Listado con rol sin `materias:leer` → `403 SIN_PERMISO`.
- Detalle de materia existente → `200`, incluye profesores asociados (o el fallback acordado).
- Detalle de materia inexistente → `404 MATERIA_NO_ENCONTRADA`.
- `pagina`/`por_pagina` fuera de rango (ej. `por_pagina=999`) → `400`, error de validación Zod (tope de 20).

### Nivel 3 — BD / TablePlus
- No aplica verificación de `AuditLog` (no hay eventos en esta task — confirmar explícitamente que no aparece nada nuevo ahí, como corresponde a una operación de solo lectura).
- Verificar en `RolPermiso` que `materias:leer` quedó sembrado exactamente para los roles acordados (Gerente, Mesa de Entrada, Profesor — y Alumno si el punto abierto de la sección 1 se resuelve a favor).

**Evidencia esperada:** Postman + SQL para el contrato de API; capturas de la tabla de listado (con al menos una materia inactiva visible), de la vista de detalle, y de los tres estados (carga, vacío, error con Reintentar).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar, incluyendo el estado real de `ProfesorMateria`.
- [ ] Punto abierto de la sección 1 (fallback ante `ProfesorMateria` inexistente) resuelto y documentado como "DECISIÓN RESUELTA"; si corresponde, anotado como nota de sincronización en `spec_modulo_L.md` §2.2.
- [ ] Punto abierto de la sección 1 (tensión con la Regla N.° 3 de `RULES.md`: `_count` directo vs. servicio público de Módulo D) resuelto y documentado.
- [ ] Punto abierto de la sección 1 (si Alumno tiene `materias:leer`) resuelto.
- [ ] Punto abierto de la sección 4.4 (Server Action vs. fetch directo para listados) resuelto.
- [ ] Servicios y Route Handlers implementados sin lógica de negocio fuera de `materia.service.ts`.
- [ ] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Listado incluye materias activas e inactivas, ordenado por `nombre_normalizado`.
- [ ] Frontend funcional: tabla paginada con estado visible, estados de carga/vacío/error con Reintentar, vista de detalle, gateado por permiso.
- [ ] Ningún `DELETE` físico en ningún punto del código (no aplica en esta task por ser de solo lectura, pero se verifica que no se haya introducido ninguno).
- [ ] Tests de los 3 niveles documentados con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU (sin tocar `POST /api/materias`, ya cerrado en HU-L-01).