# TASK: HU-D-05 — Listar profesores

**Módulo:** D (Profesor)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` §2.5 (con nota de sincronización HU-D-05) · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-D-05, criterios de aceptación 1-6
**RBAC:** `profesores:leer` — **nuevo**, exclusivo de `GERENTE` (mismo criterio que `profesores:crear` / `profesores:editar`). `rutas-por-rol.ts` ya restringe `/profesores/**` a `GERENTE`.
**Schema:** requiere migración — agrega `nombreNormalizadoProfesor` / `apellidoNormalizadoProfesor` a `Profesor` más el índice `profesores_orden_listado_idx` (§1 punto 1, §4.0).
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/profesor.types.ts`, schema en `src/server/profesores/profesor.schema.ts`, service en `src/server/profesores/profesor.service.ts`).

---

## 0. Relevamiento previo a implementación (Claude Code)

Esta task se documenta **después** de implementar: por pedido de la responsable, la HU se implementó de un tirón, sin frenar a confirmar el relevamiento. El relevamiento se hizo igual, leyendo `schema.prisma`, `RULES.md`, `DESIGN.md`, `seed.ts`, `spec_modulo_D.md` y el código de HU-D-01 a HU-D-04. Las decisiones que salieron de ahí se registran en §1.

Lo que encontró el relevamiento:
- `src/app/(dashboard)/profesores/page.tsx` era un stub ("Profesores - en construcción").
- `GET /api/profesores` respondía `501` con un `TODO: implementar en su HU (HU-D-05)`.
- La ficha `profesores/[id]/page.tsx` ya existía (HU-D-02/03/04) y exigía `profesores:editar` porque `profesores:leer` todavía no existía. Esa ficha se reutilizó y se completó; no se duplicó ninguna pantalla.
- `Profesor` **no** tenía columnas normalizadas, a diferencia de `Alumno` (HU-B-04).
- `listarProfesoresActivos()` (HU-D-04) ordenaba por apellido crudo, que sí distingue mayúsculas y acentos.

Se leyeron también `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` (existencia de `retry()` en Next 16) y la guía de `loading.js`, como exige `AGENTS.md`.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

1. **DECISIÓN RESUELTA — orden case/acento-insensitivo: columnas normalizadas + índice.**
   - La spec §2.5 pide ordenar por `apellido_normalizado, nombre_normalizado` y DNI, "mismo criterio que `spec_modulo_B.md` §2.4". `Profesor` no tenía esas columnas, así que el cambio de schema es imprescindible.
   - Se agregan `nombreNormalizadoProfesor` y `apellidoNormalizadoProfesor` (NOT NULL) y un índice compuesto `(apellidoNormalizadoProfesor, nombreNormalizadoProfesor, dniProfesor)` con nombre explícito `profesores_orden_listado_idx`. El nombre por defecto de Prisma supera los 63 caracteres de Postgres.
   - Se cargan con `clavesOrdenProfesor()` (`src/lib/profesor-listado.ts`), que aplica `normalizarTexto()` al alta. Es el mismo patrón que Alumno (HU-B-04) y Materias (HU-L-01).
   - **Descartado:** una collation ICU de Postgres. Una collation determinística ordena "Avila" antes que "Ávila" por el acento aunque el DNI diga lo contrario, así que no cumple el desempate por DNI. Una no determinística rompe `LIKE`/`contains` en PG16, que una futura HU de búsqueda va a necesitar. `$queryRaw` con `ORDER BY` calculado también se descartó: la consigna pide consultas solo vía Prisma.

2. **DECISIÓN RESUELTA — desempate por DNI y orden único del módulo.**
   - `ORDEN_PROFESORES` en `profesor.service.ts` es `[apellidoNormalizado, nombreNormalizado, dniProfesor]`, todos `asc`. Como el DNI es `@unique`, el orden es total, así que la paginación con `skip`/`take` no repite ni omite registros.
   - Se usa el mismo orden en el listado de HU-D-05 y en `listarProfesoresActivos()` (selector de HU-D-04, base de HU-J-01). Antes esa función ordenaba por apellido crudo; ahora ordena igual que el listado.

3. **DECISIÓN RESUELTA — paginación server-side de 20, con `?pagina=` en la URL.**
   - `ListarProfesoresQuerySchema` usa el mismo `default(20)` / `max(20)` que `ListarAlumnosQuerySchema`, `ListarMateriasQuerySchema` y `ListarAulasQuerySchema`. No se usa el parámetro `paginacion_limite_default` (vale `10` en el seed), que solo lee Turnos.
   - Una página fuera de rango se acota a la última (mismo criterio que `listarAlumnos()`).
   - La página viaja en la URL: el listado arma `/profesores/[id]?pagina=N` y "Volver al listado" vuelve a `/profesores?pagina=N`. **El orden no viaja en la URL:** es único y fijo, sin controles para cambiarlo, así que un parámetro de orden no tendría valores que elegir.
   - `Pagination` (`src/components/shared/pagination.tsx`) no se renderizaba con una sola página. El criterio 5 pide mostrar siempre página actual y total, así que se agrega la prop opcional `siempreVisible`. Es retrocompatible: por defecto el componente se comporta igual que antes.

4. **DECISIÓN RESUELTA — resumen de materias "A, B +N".**
   - `resumirMaterias()` (`src/lib/profesor-listado.ts`) muestra las 2 primeras (`MATERIAS_VISIBLES_EN_LISTADO`) y el resto como contador, por ejemplo "Física, Matemática +2". Sin materias muestra "—" (`VALOR_AUSENTE`).
   - Las materias se ordenan por `nombreNormalizadaMateria` (`ORDEN_MATERIAS_DEL_PROFESOR`), igual en el listado y en el detalle: las "2 primeras" del listado son las 2 primeras del detalle. `obtenerMateriasDelProfesor()` (HU-D-03) pasa de ordenar por `nombreMateria` crudo a este mismo orden.
   - La lista completa se ve en el `title` de la celda y en el detalle.

5. **DECISIÓN RESUELTA — horarios agrupados por día.**
   - `agruparHorariosPorDia()` (`src/lib/horario-atencion.ts`) devuelve los días en orden de semana, solo los que tienen intervalos, y cada día ordenado por hora de inicio. `formatearIntervalos()` produce "10:00–12:00, 14:00–16:00" (24 h). No combina intervalos contiguos.
   - `ResumenSemanalHorarios` (HU-D-04) tenía esa lógica inline y ahora usa el helper. Se ve igual: etiqueta del día más un chip por intervalo, y el texto formateado queda como `title`.
   - El Route Handler del detalle devuelve `horarios` como `{ LUNES: [{ horaInicio, horaFin }], ... }`, el shape de la spec en camelCase.

6. **DECISIÓN RESUELTA — carga, vacío y error.**
   - **Carga:** `<Suspense key={pagina}>` manual con fallback "Cargando profesores" (`role="status"`). No se usa `loading.tsx`: cascadea al detalle y rompe el 404 de `notFound()`, mismo hallazgo que HU-L-02 y HU-B-04. La `key` fuerza el fallback al cambiar de página; mientras carga no hay tabla ni paginación, así que no se puede actuar sobre datos viejos.
   - **Vacío:** "No hay profesores registrados", con link "Nuevo profesor" solo si el rol tiene `profesores:crear`. Es distinto del estado de carga.
   - **Error:** `src/app/(dashboard)/profesores/error.tsx`, con el mensaje "No se pudo cargar la información de profesores" (sin detalle técnico) y un botón "Reintentar" que llama a `retry()`.
   - **`retry()` confirmado en Next 16.3.5** instalado: `node_modules/next/dist/client/components/error-boundary.js` lo implementa como `startTransition(() => { router.refresh(); reset(); })`, así que vuelve a pedir los datos al servidor. `reset()` solo re-renderiza sin volver a buscar, y es lo que usan hoy `materias/error.tsx` y `alumnos/error.tsx`.

7. **DECISIÓN RESUELTA — permiso `profesores:leer` exclusivo de Gerente.**
   - La HU nombra solo al gerente. `rutas-por-rol.ts` restringe `/profesores` a `GERENTE` y ninguna matriz existente habilita a Mesa de Entrada para leer profesores.
   - **HU-J-01 no necesita `profesores:leer`:** su spec (`spec_modulo_J.md`) usa `calendario:leer`, y el selector obtiene los profesores vía el servicio público del módulo D (Regla 3), no por la ruta HTTP. Mesa de Entrada queda sin `profesores:leer`.
   - Se carga en la migración (para bases que no corran el seed) y en el seed, mismo patrón que `profesores:editar` y `alumnos:leer`.
   - La ficha pasa de exigir `profesores:editar` a exigir `profesores:leer`. `puedeEditar` sale de un segundo chequeo con `tienePermiso("profesores:editar")`, como estaba anotado en la propia ficha.

8. **DECISIÓN RESUELTA — helpers de permiso para Server Components.**
   - Se agregan `exigirPermiso(accion)` y `tienePermiso(accion)` a `src/server/shared/with-permission.ts`. Son aditivos y no cambian `verificarPermiso` ni `withPermission`.
   - `exigirPermiso` redirige a `/login` si no hay sesión válida y a `/sin-permiso` ("No tenés permisos...") si falta el permiso. Cualquier otro error se propaga al `error.tsx` del segmento.
   - No se dejan en `app/**`: la Regla 11 reserva esa carpeta para páginas, layouts y componentes.

9. **DECISIÓN RESUELTA — función de datos para HU-J-01.**
   - `listarOpcionesProfesoresActivos(): Promise<{ id: string; nombreParaMostrar: string }[]>` en `profesor.service.ts`. Reutiliza `listarProfesoresActivos()`, así que tiene el mismo filtro de activos y el mismo `ORDEN_PROFESORES`. `nombreParaMostrar` es "Apellido, Nombre" (`formatearApellidoNombre()`).
   - Documentada como "Contrato para HU-J-01" en la nota de sincronización de `spec_modulo_D.md` §2.5. No se implementa el calendario.

10. **DECISIÓN RESUELTA — backfill SQL idéntico a `normalizarTexto()`.**
    - La primera versión de la migración usaba `translate()` con una lista fija de letras con tilde. Pero `normalizarTexto()` quita cualquier marca combinable (U+0300–U+036F) y el schema de identidad admite cualquier `\p{L}`, así que diferían en nombres como "Dvořák" o "Čapek".
    - Se reemplazó por el mismo algoritmo paso a paso: `lower(regexp_replace(normalize(x, NFD), '[̀-ͯ]', '', 'g'))`. `normalize()` existe desde PG13 y el proyecto usa PG16 con base UTF8. Hay un test que documenta la equivalencia (§6).

11. **DECISIÓN RESUELTA — datos de prueba en el seed.**
    - El seed tenía 5 profesores, una sola página y ningún caso de orden, así que se agregan 17 fichas sin cuenta (22 en total, 2 páginas).
    - Casos: apellido con tilde inicial (Álvarez), minúscula (benítez, de la Fuente) y mayúsculas (OLMEDO); "Avila / Ávila, Pedro" y dos "Pérez, Juan" (desempate por DNI); uno sin contacto (Ibarra), uno sin materias (Quiroga), uno con 4 materias y 3 intervalos el mismo lunes cargados desordenados (Castro); un segundo inactivo (Sosa); valores largos (Fernández de la Torre y Villanueva).
    - La validación en memoria del seed rechazaba fichas sin teléfono ni email. Se ajusta para aceptarlas, porque una ficha de HU-D-01 sin HU-D-02 es válida. Es el único cambio a lógica existente del seed; no se borró ni se cambió ningún dato de otros subgrupos, y el seed sigue siendo idempotente (upsert por DNI).

**Supuestos tomados:**
- **Materias inactivas incluidas:** el resumen del listado y el detalle incluyen también las materias asociadas que hoy están inactivas, mismo criterio que HU-D-03 §1 punto 12. En el detalle llevan `Badge` "Inactiva".
- **`lower()` de Postgres vs `toLowerCase()` de JS:** el backfill usa `lower()` con el locale de la base. Para letras latinas da lo mismo que `toLowerCase()`; solo podría diferir en casos marginales como la "İ" turca. Solo afecta a filas existentes antes de la migración; toda alta posterior la normaliza la aplicación.
- **Contacto en el listado:** teléfono y email en dos líneas, cada una con "—" si falta (con ícono y etiqueta `sr-only`). La dirección no se muestra: los criterios nombran solo teléfono y email.
- **Detalle:** agrega la sección "Datos personales" (apellido, nombre, DNI, fecha de nacimiento, género, estado y fecha de alta). No expone la cuenta vinculada ni las columnas de auditoría.
- **Accesos de edición existentes:** los botones "Editar contacto", "Asociar materias" y "Registrar horario" son de HU-D-02/03/04. Se conservan, pero solo se muestran con `profesores:editar`; esta HU no agrega botones nuevos.

**Dependencias de esta implementación:**
- **Depende de:**
  - HU-D-01: entidad `Profesor` y alta.
  - Código de HU-D-02 (ficha, `FichaSeccion`/`FichaDatos`, contacto), HU-D-03 (`obtenerMateriasDelProfesor()`, `FichaMaterias`) y HU-D-04 (`obtenerHorariosDelProfesor()`, `ResumenSemanalHorarios`), que se reutilizan en el detalle.
- **Es requisito de:** HU-J-01 (selector de profesor), que consume `listarOpcionesProfesoresActivos()`.

**Fuera de alcance de esta task (explícito):**
- Modificar o desactivar un profesor (criterio 6).
- Búsqueda y filtros del listado.
- Controles para cambiar el orden.
- El calendario de HU-J-01 (solo se deja la función de datos).
- Mover las actions y tipos de HU-D-01/D-02 que siguen en `src/app/(dashboard)/profesores/` (deuda de HU-D-03 §1 punto 1).
- Instalar un test runner o tocar `package.json` (§6).

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** consultar los profesores registrados
**Para** revisar sus datos, materias y horarios

**SP estimado:** 2

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_D.md` §2.5, con las decisiones del §1. Incluye:
- Migración con columnas normalizadas, backfill, índice y permiso `profesores:leer` (§4.0).
- Schema Zod `ListarProfesoresQuerySchema` (§4.1).
- Helpers puros `clavesOrdenProfesor`, `formatearApellidoNombre`, `resumirMaterias`, `agruparHorariosPorDia` y `formatearIntervalos` (§4.2).
- Servicios `listarProfesores()`, `obtenerDetalleProfesor()` y `listarOpcionesProfesoresActivos()`, más ajustes a `crearProfesor()`, `listarProfesoresActivos()`, `obtenerMateriasDelProfesor()` y `obtenerHorariosDelProfesor()` (§4.3).
- Route Handlers `GET /api/profesores` y `GET /api/profesores/[id]` (§4.4).
- Helpers `exigirPermiso` / `tienePermiso` (§4.5).
- UI: listado `/profesores`, detalle `/profesores/[id]` en modo consulta y `error.tsx` del segmento (§5).
- Datos de prueba en el seed (§1 punto 11) y nota de sincronización en `spec_modulo_D.md` §2.5.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Botones o acciones de modificar, desactivar, buscar o filtrar.
- `loading.tsx` en el segmento `/profesores` (rompe el 404 del detalle).
- SQL crudo para ordenar.

---

## 4. Contrato Backend

### 4.0. Migración

**Archivo:** `prisma/migrations/20260923200000_profesor_nombre_normalizado_y_leer_permiso/migration.sql`

```prisma
model Profesor {
  // ...
  nombreProfesor   String
  apellidoProfesor String
  nombreNormalizadoProfesor   String
  apellidoNormalizadoProfesor String
  dniProfesor      String @unique
  // ...
  @@index([apellidoNormalizadoProfesor, nombreNormalizadoProfesor, dniProfesor], map: "profesores_orden_listado_idx")
  @@map("profesores")
}
```

Pasos de la migración:
1. `ADD COLUMN` de las dos columnas como nullable.
2. Backfill: `lower(regexp_replace(normalize(<columna>, NFD), '[̀-ͯ]', '', 'g'))`, equivalente a `normalizarTexto()` (§1 punto 10).
3. `SET NOT NULL` en ambas.
4. `CREATE INDEX "profesores_orden_listado_idx"`.
5. `INSERT` de `('perm-profesores-leer-gerente', 'GERENTE', 'profesores:leer')` con `ON CONFLICT DO NOTHING`.

La diferencia de schema se validó con `prisma migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel prisma/schema.prisma` (mismas columnas e índice) y `prisma validate`.

### 4.1. Schema Zod

**Archivo:** `src/server/profesores/profesor.schema.ts` (se agrega; no se modifica lo existente)

```typescript
export const ListarProfesoresQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarProfesoresQuery = z.infer<typeof ListarProfesoresQuerySchema>;
```

### 4.2. Helpers puros

**`src/lib/profesor-listado.ts`** (nuevo):
- `VALOR_AUSENTE = "—"`, `MATERIAS_VISIBLES_EN_LISTADO = 2`.
- `clavesOrdenProfesor({ nombre, apellido })` → `{ nombreNormalizadoProfesor, apellidoNormalizadoProfesor }` con `normalizarTexto()`. La usan `crearProfesor()` y el seed.
- `formatearApellidoNombre(apellido, nombre)` → `"Apellido, Nombre"`.
- `resumirMaterias(nombres, visibles = 2)` → `"A, B +N"` / `"—"`.

**`src/lib/horario-atencion.ts`** (se agrega):
- `agruparHorariosPorDia(horarios)` → `{ dia, etiqueta, intervalos }[]` en orden de semana, cada día ordenado por `horaInicio`. Es genérica sobre `{ diaSemana, horaInicio }` y no muta el arreglo recibido.
- `formatearIntervalos(intervalos)` → `"10:00–12:00, 14:00–16:00"`.

### 4.3. Servicios del módulo D

**Archivo:** `src/server/profesores/profesor.service.ts`

**Constantes:** `ORDEN_PROFESORES` (§1 punto 2) y `ORDEN_MATERIAS_DEL_PROFESOR` (§1 punto 4), tipadas con `satisfies Prisma.*OrderByWithRelationInput`.

**A) `listarProfesores(query): Promise<{ items: ProfesorListadoItem[]; paginacion: PaginacionProfesores }>`**
1. `prisma.profesor.count()`, sin filtro de activos: el listado incluye activos e inactivos.
2. Acota la página: `total === 0 ? 1 : min(pagina, ceil(total / por_pagina))`.
3. `findMany` con `select` **solo** de lo que muestra la tabla (id, apellido, nombre, DNI, teléfono, email, activo y nombres de materias ordenados), `orderBy: ORDEN_PROFESORES`, `skip`/`take`.
4. Devuelve `paginacion: { total, pagina_actual, total_paginas, por_pagina }`, mismo shape que Alumnos.

**B) `obtenerDetalleProfesor(profesorId): Promise<DetalleProfesor | null>`**
- `findUnique` con `select` de identidad, contacto (teléfono y email), estado y `createdAtProfesor`. No incluye `usuarioId` ni auditoría.
- Reutiliza `obtenerMateriasDelProfesor()` (HU-D-03) y `obtenerHorariosDelProfesor()` (HU-D-04) en paralelo.
- Devuelve `null` si el profesor no existe.

**C) `listarOpcionesProfesoresActivos(): Promise<OpcionProfesor[]>`** — contrato para HU-J-01 (§1 punto 9).

**Ajustes a funciones existentes:**
- `crearProfesor()` (HU-D-01): agrega `...clavesOrdenProfesor(input)` al `data` del `create`. Es el único punto del código que crea profesores (verificado por búsqueda de `profesor.create`/`upsert`).
- `listarProfesoresActivos()` (HU-D-04): `orderBy: ORDEN_PROFESORES`.
- `obtenerMateriasDelProfesor()` (HU-D-03): `orderBy: ORDEN_MATERIAS_DEL_PROFESOR`.
- `obtenerHorariosDelProfesor()` (HU-D-04): agrega `select` (antes traía todas las columnas, incluida la auditoría).
- `obtenerFichaProfesor()` no cambia (solo su comentario): la siguen usando las pantallas de contacto y materias.

**Tipos nuevos** en `src/types/profesor.types.ts`: `OpcionProfesor`, `ProfesorListadoItem`, `PaginacionProfesores` y `DetalleProfesor`.

### 4.4. Route Handlers

**`GET /api/profesores`** (`src/app/api/profesores/route.ts`; reemplaza el `501`):
- `withPermission("profesores:leer")`.
- `ListarProfesoresQuerySchema.safeParse` de `?pagina=&por_pagina=` → `400 VALIDACION` con `flattenError`.
- Éxito → `200 { data: { items, paginacion }, error: null }`.
- Error inesperado → `500 ERROR_INTERNO`, sin detalle técnico.

**`GET /api/profesores/[id]`** (`src/app/api/profesores/[id]/route.ts`, nuevo):
- `withPermission("profesores:leer")`, con `params` async (Next 16).
- Éxito → `200 { data: { ...identidad, contacto: { telefono, email }, materias, horarios: { LUNES: [{ horaInicio, horaFin }], ... } } }`.
- Profesor inexistente → `404 PROFESOR_NO_ENCONTRADO`.
- Error inesperado → `500 ERROR_INTERNO`.

| Resultado | Status |
|---|---|
| Sin sesión | `401 SESION_INVALIDA` (lo resuelve `withPermission`) |
| Rol sin `profesores:leer` | `403 SIN_PERMISO` |

### 4.5. Permisos en Server Components

**Archivo:** `src/server/shared/with-permission.ts` (aditivo, §1 punto 8)

```typescript
export async function exigirPermiso(accion: string): Promise<{ id: string; rol: RolUsuario }>; // redirect /login o /sin-permiso
export async function tienePermiso(accion: string): Promise<boolean>;
```

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md`. Estado con `Badge` `success` ("Activo") o `muted` ("Inactivo"), siempre con texto; fila inactiva con `opacity-60`; hover `bg-accent`; errores con `text-destructive`. Mismo patrón visual que la tabla de Alumnos (HU-B-04).

**Listado** `src/app/(dashboard)/profesores/page.tsx`:
- `exigirPermiso("profesores:leer")`. "Nuevo profesor" solo aparece con `tienePermiso("profesores:crear")`.
- Columnas: Apellido y nombre ("Apellido, Nombre", link a la ficha que ocupa toda la fila), DNI, Contacto (teléfono y email con ícono, "—" si falta), Materias (`resumirMaterias`) y Estado.
- Los valores largos se recortan con `truncate` y el valor completo queda en el `title`; el detalle los muestra completos.
- `overflow-x-auto` para anchos chicos.
- `Pagination` con `siempreVisible`: "Página X de Y · N en total".
- Estados de carga, vacío y error: §1 punto 6.

**Detalle** `src/app/(dashboard)/profesores/[id]/page.tsx` (modo consulta):
- `exigirPermiso("profesores:leer")`; `puedeEditar = tienePermiso("profesores:editar")`.
- "Volver al listado" respeta `?pagina=`: si es un entero mayor a 1, vuelve a `/profesores?pagina=N`; si no, a `/profesores`.
- Secciones: `FichaEncabezado`, `FichaIdentidad` (nueva, `ficha-identidad.tsx`), `FichaContacto`, `FichaMaterias` (nombre + código, todas, con badge "Inactiva") y `FichaHorarios` (`ResumenSemanalHorarios`).
- La fecha de nacimiento (`@db.Date`) se formatea en UTC para que no se corra el día; la fecha de alta, en `America/Argentina/Buenos_Aires`.
- Profesor inexistente → `notFound()`.

**Menú:** el Sidebar de `GERENTE` ya tenía "Profesores > Listado" (`/profesores`); no se modifica.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unit

El proyecto no tiene test runner instalado (igual que en HU-D-01 §6 y HU-D-03 §6). Para ejecutarlos **sin tocar `package.json`** se usó `npx -y vitest@3 run` con una config temporal fuera del repo (alias `@` → `src`). Se corrieron **todos** los tests del repo, no solo los de esta HU.

Tests agregados:
- `src/lib/profesor-listado.test.ts` (nuevo, 8 tests):
  - `resumirMaterias`: sin materias → "—"; 1 y 2 materias sin contador; "Matemática, Física +1" y "+2"; respeta el orden recibido.
  - `formatearApellidoNombre`.
  - `clavesOrdenProfesor`: mayúsculas, tildes y ñ; diacríticos no españoles ("Dvořák Čapek-Gonçalves", "Ōtsuka") iguales al backfill SQL; ordenar 10 profesores del seed por claves + DNI da el orden esperado (Álvarez entre las A, benítez entre las B, Avila (…04) antes que Ávila (…09), los dos Pérez por DNI).
- `src/server/profesores/profesor-listado.service.test.ts` (nuevo, 8 tests, `prisma` mockeado):
  - `listarProfesores`: `orderBy` exacto, `skip`/`take` de la página 2, `select` sin auditoría ni cuenta, nombres de materias, página fuera de rango acotada y listado vacío.
  - `listarOpcionesProfesoresActivos`: filtro de activos, mismo orden y "Apellido, Nombre".
  - `obtenerDetalleProfesor`: `null` si no existe; identidad + materias + horarios combinados.
- `src/lib/horario-atencion.test.ts` (4 tests agregados): agrupación en orden de semana y por hora ("Lunes: 08:00–10:00, 11:00–12:00, 14:00–16:00"), días vacíos omitidos sin combinar contiguos, lista vacía y que no muta el arreglo.

**Resultado:** `8 passed (8)` archivos, `89 passed (89)` tests.

### Verificación estática y build

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ 0 errores, 1 warning preexistente ajeno a la HU (`Clock3` sin usar en `src/app/(dashboard)/home/page.tsx`) |
| `npx prisma validate` | ✅ schema válido |
| `npm run build` | ✅ compila; aparecen `/profesores`, `/profesores/[id]`, `/api/profesores` y `/api/profesores/[id]` |
| `npx tsx prisma/seed.ts` | ✅ pasa la validación en memoria (`validarDatos()`); falla recién en la primera escritura por no haber base levantada |

### Nivel 2 — Postman

**Pendiente:** requiere base levantada. Casos a correr:

| Caso | Esperado |
|---|---|
| `GET /api/profesores` como Gerente | `200`, 20 items, `paginacion: { total: 22, pagina_actual: 1, total_paginas: 2, por_pagina: 20 }` |
| `GET /api/profesores?pagina=2` | `200`, 2 items (Vega, Ybáñez) |
| `GET /api/profesores?pagina=99` | `200`, acotado a la página 2 |
| `GET /api/profesores?pagina=abc` | `400 VALIDACION` |
| Sin sesión | `401 SESION_INVALIDA` |
| Como Mesa de Entrada | `403 SIN_PERMISO` |
| `GET /api/profesores/{Castro}` | `200`, `horarios.LUNES` con 3 intervalos ordenados y 4 materias |
| `GET /api/profesores/{cuid inexistente}` | `404 PROFESOR_NO_ENCONTRADO` |

### Nivel 3 — BD / TablePlus

**Pendiente:** requiere base levantada.
- Tras `migrate deploy`: `\d profesores` muestra las dos columnas `NOT NULL` y el índice `profesores_orden_listado_idx`. Ninguna fila con las columnas en `NULL` o vacías.
- Backfill: para los profesores previos, `apellidoNormalizadoProfesor` coincide con `normalizarTexto(apellidoProfesor)` (por ejemplo, "Acuña" → "acuna" y "Giménez" → "gimenez").
- `roles_permisos` contiene `('GERENTE', 'profesores:leer')` y **no** `('MESA_ENTRADA', 'profesores:leer')`.
- Un alta nueva desde `/profesores/nuevo` guarda las claves normalizadas.

**Evidencia esperada:** Postman + SQL, y capturas del listado (página 1 y 2), estado vacío, carga, error con Reintentar y detalle de Castro.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de implementar. *(Se implementó sin frenar, por pedido explícito de la responsable; el relevamiento está en §0 y §1.)*
- [x] Criterio 1 — columnas del listado, "—" en ausentes y estado como texto: `profesores/page.tsx` (`TablaProfesores`, `DatoContacto`), `formatearApellidoNombre()`.
- [x] Criterio 2 — orden apellido y nombre (sin distinguir mayúsculas ni acentos) + DNI, estable entre páginas: `ORDEN_PROFESORES` en `profesor.service.ts`, `clavesOrdenProfesor()`, migración y seed.
- [x] Criterio 3 — detalle con identidad, contacto, materias (nombre + código), estado, fecha de alta y horarios agrupados por día: `profesores/[id]/page.tsx`, `obtenerDetalleProfesor()`, `ficha-identidad.tsx`, `agruparHorariosPorDia()`.
- [x] Criterio 4 — "A, B +N", "—" sin materias y lista completa en el detalle: `resumirMaterias()`, `FichaMaterias`.
- [x] Criterio 5 — paginación server-side de 20, página y total visibles, `?pagina=` conservada; carga, vacío y error con Reintentar: `listarProfesores()`, `Pagination siempreVisible`, `Suspense key`, `profesores/error.tsx` (`retry()`).
- [x] Criterio 6 — sin modificar, desactivar, búsqueda ni filtros.
- [x] Autorización en servidor: `exigirPermiso` / `withPermission("profesores:leer")`; 401 → `/login`, 403 → `/sin-permiso`.
- [x] Consultas solo vía Prisma, con `select` de los campos necesarios; sin SQL concatenado.
- [x] Solo tokens de `DESIGN.md`.
- [x] Ningún `DELETE` físico nuevo (Regla 1).
- [x] `spec_modulo_D.md` §2.5 con nota de sincronización (incluye el contrato para HU-J-01).
- [x] `tsc`, lint, tests (89/89) y build sin errores.
- [ ] **Migración y seed aplicados contra Postgres real.** Docker no estaba levantado: el backfill SQL y el seed completo todavía no corrieron.
- [ ] Niveles 2 y 3 ejecutados con evidencia.
- [ ] Criterios 1 a 6 verificados en navegador como Gerente, y acceso rechazado como Mesa de Entrada.
- [ ] Aviso al equipo por los archivos compartidos (§8).
- [ ] PR acotado a HU-D-05.

---

## 8. Archivos, impacto en otros subgrupos y pasos de aplicación

### 8.1. Archivos creados

- `prisma/migrations/20260923200000_profesor_nombre_normalizado_y_leer_permiso/migration.sql`
- `src/lib/profesor-listado.ts`
- `src/lib/profesor-listado.test.ts`
- `src/server/profesores/profesor-listado.service.test.ts`
- `src/app/(dashboard)/profesores/error.tsx`
- `src/app/(dashboard)/profesores/[id]/ficha-identidad.tsx`
- `src/app/api/profesores/[id]/route.ts`
- `docs/tasks/Sprint 1/HU-D-05.md` (este documento)

### 8.2. Archivos modificados — propios del módulo D

- `src/app/(dashboard)/profesores/page.tsx` (el stub pasa a ser el listado)
- `src/app/(dashboard)/profesores/[id]/page.tsx` (permiso `profesores:leer`, identidad, `?pagina=`)
- `src/app/api/profesores/route.ts` (`GET`, antes `501`)
- `src/server/profesores/profesor.service.ts`
- `src/server/profesores/profesor.schema.ts`
- `src/types/profesor.types.ts`
- `src/lib/horario-atencion.ts` y `src/lib/horario-atencion.test.ts`
- `docs/specs/spec_modulo_D.md` (nota de sincronización §2.5)

### 8.3. Archivos modificados — compartidos del equipo (avisar)

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | `Profesor`: `nombreNormalizadoProfesor` y `apellidoNormalizadoProfesor` (NOT NULL) + índice `profesores_orden_listado_idx` |
| `prisma/migrations/20260923200000_…` | Columnas, backfill, `NOT NULL`, índice y permiso `profesores:leer` para `GERENTE` |
| `prisma/seed.ts` | 17 profesores nuevos sin cuenta, claves normalizadas para todos y `profesores:leer` para `GERENTE`. La validación de contacto ahora acepta fichas sin teléfono ni email (único cambio a lógica existente) |
| `src/components/shared/pagination.tsx` | Prop opcional `siempreVisible`; por defecto, sin cambios de comportamiento |
| `src/server/shared/with-permission.ts` | Helpers nuevos `exigirPermiso` y `tienePermiso`; lo existente sin cambios |
| `src/components/shared/resumen-semanal-horarios.tsx` | Usa `agruparHorariosPorDia()`; misma apariencia, más un `title` con el texto formateado |

### 8.4. Impacto en otros subgrupos

- **Toda creación de profesores** (actual o futura: importaciones, scripts, otra HU) **debe cargar las columnas normalizadas con `clavesOrdenProfesor()`**. Son `NOT NULL`, así que un `create` sin ellas falla. Una futura HU de **modificación** de profesor debe recalcularlas si cambia nombre o apellido.
- **Mesa de Entrada no tiene `profesores:leer`.** Los módulos que necesiten datos de profesores deben usar los **servicios públicos del módulo D** (Regla 3), no la ruta HTTP ni leer la tabla:
  - HU-J-01 → `listarOpcionesProfesoresActivos()`;
  - HU-C-04 → `estaDentroDeHorarioAtencion()` y `profesorActivoDictaMateria()` (sin cambios).
- `listarProfesoresActivos()` (selector de HU-D-04) ahora ordena sin distinguir acentos ni mayúsculas; su contrato no cambia.
- `ResumenSemanalHorarios` y `Pagination` se ven igual en las pantallas que ya los usaban.

### 8.5. Pasos para aplicar la migración

Con Docker levantado:

```
docker compose up -d
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Se recomienda `migrate deploy` en lugar de `migrate dev`: aplica las migraciones pendientes sin preguntar ni ofrecer resetear la base. El cliente de Prisma ya fue regenerado (`npx prisma generate`); si otra persona trae el cambio, además tiene que correr `npx prisma generate`.

### 8.6. Prueba manual

1. Entrar a `http://localhost:3000/profesores` con **gerente@noctium.local** / **Password123!**.
2. Página 1: "Página 1 de 2 · 22 en total". Orden: Acuña, Álvarez, Avila (…04), Ávila (…09), benítez, Castro, de la Fuente, Fernández de la Torre y Villanueva (recortado), Giménez, Ibarra (contacto "—"), …, Pérez (…01), Pérez (…02), Quiroga (materias "—"), Rossi, Sosa (Inactivo), Toledo.
3. Castro muestra "Física, Matemática +2".
4. Página 2: Vega e Ybáñez.
5. Abrir Castro desde la página 2: el lunes muestra 08:00–10:00, 11:00–12:00 y 15:00–17:00 en ese orden, y las 4 materias con código.
6. "Volver al listado" vuelve a la página 2.
7. Con **mesa.entrada@noctium.local**: `/profesores` redirige a "sin permiso", y `GET /api/profesores` responde `403`.
8. Sin sesión: `/profesores` redirige a `/login`.
