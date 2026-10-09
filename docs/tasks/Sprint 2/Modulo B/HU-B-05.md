# TASK: HU-B-05 — Búsqueda inteligente de alumno

**Módulo:** B (Alumno)
**Sprint:** 2
**Responsable:** Lautaro (Chiki)
**Contrato de referencia:** `docs/specs/spec_modulo_B.md` Revisión 2: §2.7 (búsqueda, contrato completo, incluido el comportamiento de la pantalla), §2.4 (listado que se extiende), §3.9 (un solo criterio de búsqueda de alumnos) · `docs/DESIGN.md` §8.1 (paginación) y §8.2 (criterio del buscador) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila "Listado de alumnos") · `docs/tasks/Sprint 2/HU-Sprint-2.md` §6 (criterios 1 a 8)
**RBAC:** `alumnos:leer` — ya existe (HU-B-04), exclusivo de MESA_ENTRADA. Sin cambios.
**Schema:** sin cambios. Usa las columnas `apellidoNormalizadoAlumno` / `nombreNormalizadoAlumno` que agregó HU-B-04 y `dniAlumno`. **No se modifican `prisma/schema.prisma` ni `prisma/seed.ts`.**
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/alumno.types.ts`, service en `src/server/alumnos/alumno.service.ts`, helper de búsqueda en `src/server/alumnos/alumno.busqueda.ts` según spec §2.7)

> **Restricción (29/09/2026): no se modifica ningún archivo del módulo de Turnos.** Esto incluye `src/app/(dashboard)/turnos/**` (en particular `buscador-alumnos.tsx`), `src/app/api/turnos/**` y `src/server/turnos/**`: Emir está reordenando ese código en HU-C-18. El selector de HU-C-04 recibe el filtro nuevo **solo** a través de `buscarAlumnosActivos()` del módulo B, que ya consume, **sin cambiar su firma (`(query: string)`) ni su tipo de retorno (`{ id, nombre, apellido, dni }[]`)**. Si algo exigiera tocar un archivo de Turnos, esa parte no se hace y se informa.

---

## 0. Relevamiento previo a implementación (Claude Code)

Relevamiento realizado el 2026-09-29 sobre `develop` (`07eba47`).

### 0.1. Qué existe hoy (HU-B-04 y HU-C-04) — rutas reales

| Pieza | Ruta | Estado antes de esta HU |
|---|---|---|
| Página del listado | `src/app/(dashboard)/alumnos/page.tsx` | **Server Component.** Lee `?pagina=` de `searchParams`, llama a `listarAlumnos()` **directo** (no pasa por la API) dentro de un `<Suspense>` manual (`TablaAlumnos`). Sin búsqueda |
| Route Handler del listado | `src/app/api/alumnos/route.ts` | `GET` con `withPermission("alumnos:leer")`, valida `ListarAlumnosQuerySchema` y llama a `listarAlumnos(parsed.data)`. Error de validación con código `VALIDACION` (ver 1.7 punto 7) |
| Schema del query | `src/server/alumnos/alumno.schema.ts` | `ListarAlumnosQuerySchema` con `pagina` y `por_pagina` (máx. 20, default 20). **No tenía `q`** |
| Servicio del listado | `src/server/alumnos/alumno.service.ts` | `listarAlumnos(query)`: `count()` sin `where` + `findMany` con `orderBy` apellido normalizado → nombre normalizado → DNI, `skip`/`take`, página acotada a la última existente |
| Buscador del selector (HU-C-04) | `src/server/alumnos/alumno.service.ts` | `buscarAlumnosActivos(query)`: normaliza, umbral de 2 caracteres, **un solo `OR`** con el texto completo contra nombre, apellido y DNI (sin tokens), solo activos, `take: 10`. Reexportada en `src/server/alumnos/alumno.publico.ts`. La consume `src/app/api/turnos/participantes/alumnos/route.ts` (módulo Turnos, **no se toca**) |
| Test del selector | `src/server/alumnos/alumno.busqueda.test.ts` | Prueba `buscarAlumnosActivos()` mockeando `where.OR` (la forma de antes) |
| Helper de filtro (spec §2.7) | `src/server/alumnos/alumno.busqueda.ts` | **No existía.** Solo existía el test con ese nombre, que prueba otra función |
| `normalizarTexto()` | `src/lib/normalizar-texto.ts` | NFD + quita diacríticos (`U+0300`–`U+036F`) + minúsculas. "Muñoz" → "munoz", "Ibáñez" → "ibanez" |
| Componente del selector (HU-C-04) | `src/app/(dashboard)/turnos/buscador-alumnos.tsx` | Client Component: umbral de 2 caracteres, espera de 250 ms, `AbortController`, `fetchAutenticado`. **No se toca** (restricción) |
| Paginación compartida | `src/components/shared/pagination.tsx` | Solo navegación con `<Link>` (`buildHref`). Muestra "Página X de Y · N en total" + "Anterior"/"Siguiente". **No se toca** (1.7 punto 2) |
| Error del listado (HU-B-04) | `src/app/(dashboard)/alumnos/error.tsx` | Texto "No se pudo cargar la información de alumnos" (`text-destructive`) + `Button` `outline` `sm` "Reintentar". Se reutiliza (1.7 punto 6) |
| Ficha del alumno | `src/app/(dashboard)/alumnos/[id]/page.tsx` | Lee `?pagina=` y arma "Volver al listado" como `/alumnos?pagina=N`. **No conocía `q`** |
| Tipos | `src/types/alumno.types.ts` | `AlumnoListado` y `Paginacion` ya existen |
| Filtro puro de referencia | `src/lib/filtrar-materias.ts` | Precedente de helper puro en `src/lib/` que usa `normalizarTexto()` (HU-D-03) |

### 0.2. Modelo relevado (`prisma/schema.prisma`, `model Alumno`)

`nombreAlumno`, `apellidoAlumno`, `nombreNormalizadoAlumno`, `apellidoNormalizadoAlumno` (no únicos), `dniAlumno` (`@unique`, texto), `activoAlumno`. No hay índices sobre las columnas normalizadas: un `contains` se traduce a `LIKE '%…%'`. Con los volúmenes del proyecto no hace falta índice (ver 1.6).

### 0.3. Datos del seed útiles para probar (`prisma/seed.ts`)

- **40 fichas** (`ALUMNOS`, l. 562-606): 39 activas y **Bruno Paz inactivo**. DNI derivado del índice: `4010` + número de 4 dígitos (`40100001` a `40100040`, l. 609).
- Usuario de prueba: `mesa.entrada@noctium.local` / `Password123!` (MESA_ENTRADA, único rol con `alumnos:leer`).
- Apellidos y nombres con tilde y ñ: Fernández, Martínez, López, González, Rodríguez, Pérez, Sánchez, Díaz, Álvarez, Benítez, Gómez, Ibáñez, Suárez, Vázquez, Giménez, Ramírez, Domínguez, Muñoz; Sofía, Joaquín, Tomás, Benjamín, Lucía, Nicolás, Ailén, Valentín.
- **No hay ningún "Juan"**: el ejemplo del criterio 2 ("juan perez") da **0 resultados** con el seed. Para probar el criterio 2 se usa "joaquin perez" (Joaquín Pérez, `40100006`).
- Los resultados de la sección 6 se calcularon con la lógica de la spec §2.7 sobre las 40 fichas. Requieren `npx prisma db seed` recién corrido y ninguna ficha cargada a mano.

### 0.4. Diferencias encontradas (el mockup y el código contra la spec)

Según el documento de developers de Sprint 2, los mockups no se actualizaron con el backlog: **si difieren, manda la spec**.

| Tema | Mockup (pantalla 15) | Spec / código actual | Qué se hace |
|---|---|---|---|
| Tamaño de página | "Mostrando 1–10 de 30" (10 por página) | Spec §2.4/§2.7 y DESIGN §8.1: **20** en listados principales | Se mantiene **20** |
| Columnas | APELLIDO Y NOMBRE, DNI, EMAIL, TELÉFONO (sin Estado; Email antes que Teléfono) | Spec §2.4 y §2.7 paso 4: incluye **Estado**; el código muestra Apellido y nombre, DNI, Teléfono, Email, Estado | Se mantiene la fila actual sin cambios (criterio 3) |
| Pie de tabla | "Mostrando 1–10 de 30" + números de página | `pagination.tsx`: "Página X de Y · N en total", sin números | **Fuera de esta HU**, deuda técnica (1.7 punto 2) |
| "+ Nuevo alumno" | Botón | Link subrayado con ícono `GraduationCap` | Se mantiene el link (1.7 punto 3) |
| Subtítulo y buscador | Subtítulo + input de ancho completo con lupa y placeholder "Ej.: juan perez, 42…" | No existían | Se agregan (sección 5) |
| Código de error 400 | — | Spec: `VALIDATION_ERROR`; código real: `VALIDACION` | Se deja `VALIDACION` (1.7 punto 7) |
| Espera del buscador | — | Spec §2.7: **300 ms**. Selector de HU-C-04: 250 ms | El listado usa 300 ms; el selector no se toca |
| SP | — | `HU-Sprint-2.md` §6 dice **2 SP** | Se toma **1 SP** (1.7 punto 1) |

---

## 1. Nota de alcance

### 1.1. Dónde se filtra: en el servidor

**Decisión: el filtro se resuelve en la base, dentro de `listarAlumnos()`.** No se filtra en el cliente.

- **Criterio 4:** la paginación es server-side (`skip`/`take`, HU-B-04). El cliente solo tiene las 20 filas de la página actual; filtrarlas ahí daría resultados incompletos y un `total` falso. `count()` y `findMany()` usan **el mismo `where`**, así el total y las páginas son los del resultado filtrado.
- **Spec §2.7:** la búsqueda es el parámetro `q` de `GET /api/alumnos` y la resuelve `listarAlumnos()` con `construirFiltroBusquedaAlumno()`.
- **Regla N.° 4:** el criterio de coincidencia es regla de negocio y vive en la capa de servicios, no en el componente.
- **Regla N.° 6:** `q` se valida con `ListarAlumnosQuerySchema` (máx. 100 caracteres) antes de llegar al servicio.
- La búsqueda es de solo lectura: no emite eventos (spec §4, Revisión 2).

### 1.2. Búsqueda multipalabra en cualquier orden

Según la spec §2.7 pasos 2 y 3:

1. `q` se recorta (`trim`). Con **menos de 2 caracteres** se ignora (1.3).
2. Se normaliza con `normalizarTexto()` y se parte por espacios en **tokens**. Se usan **los 5 primeros; el resto se ignora, sin error** (1.7 punto 4).
3. **Cada token** tiene que coincidir **parcialmente** (`contains`) con **al menos uno** de estos campos: `apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, o `dniAlumno` **solo si el token tiene únicamente dígitos**.
4. **AND entre tokens, OR entre campos:**

```typescript
// forma del where para q = "perez joaquin"
{ AND: [
  { OR: [{ apellidoNormalizadoAlumno: { contains: "perez" } }, { nombreNormalizadoAlumno: { contains: "perez" } }] },
  { OR: [{ apellidoNormalizadoAlumno: { contains: "joaquin" } }, { nombreNormalizadoAlumno: { contains: "joaquin" } }] },
] }
// un token solo de dígitos ("0034") suma { dniAlumno: { contains: "0034" } } a su OR
```

Por eso "joaquin perez", "perez joaquin" y "PÉREZ JOAQUÍN" encuentran a la misma persona. Como los tokens y las columnas ya están normalizados, no hace falta `mode: "insensitive"`.

**Límite conocido (no es un criterio):** un DNI escrito con puntos ("40.100.034") no es "solo dígitos" y no busca por DNI. La spec no lo pide.

### 1.3. 0 o 1 carácter

Con el campo vacío, solo espacios o 1 carácter tras el `trim`, **no se filtra**: se muestra el listado completo en la página 1, con el orden original (criterio 6, spec §2.7 pasos 1 y 5). Esto se cumple en los dos lados:
- **Cliente:** no manda `q` y pide `pagina=1`.
- **Servidor:** si igual llega un `q` de 1 carácter (por ejemplo, escrito a mano en la URL), lo ignora. No es un error `400`.

### 1.4. Actualización sin recargar, espera y URL

- **Espera (debounce) de 300 ms** desde la última tecla. La fija la spec §2.7; el criterio no da milisegundos.
- **Al escribir (criterio 3):** un Client Component llama a `GET /api/alumnos?q=&pagina=1&por_pagina=20` y reemplaza solo la tabla y el paginador. El input no se deshabilita ni pierde el foco. Hay un indicador de carga en la zona de resultados.
- **Respuestas viejas:** se descartan con `AbortController`, el mismo patrón de `buscador-alumnos.tsx`. Solo cuenta la respuesta del texto vigente.
- **Término en la URL: sí, con `window.history.replaceState`.** El término y la página se reflejan como `/alumnos?q=<texto>&pagina=<n>`. Así, al volver desde la ficha, se ve la misma búsqueda en la misma página. `replaceState` no navega ni recarga, y Next 16 lo sincroniza con su router (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API"). Se usa `replaceState` y no `pushState` para no sumar una entrada al historial por cada tecla.
- **Al cambiar de página:** como `pagination.tsx` no se toca (1.7 punto 2), el paginador sigue siendo de `<Link>`. Su `buildHref` arma `/alumnos?q=<q vigente>&pagina=<n>`, que es una **navegación del lado del cliente** de Next: el servidor vuelve a renderizar la página con `q` y `pagina`, sin recargar el documento. Conserva `q` y pagina sobre el resultado filtrado (spec §2.7: "cambiar de página con el paginador conserva `q` y navega sobre el resultado filtrado").
- **Primer render desde la URL:** `page.tsx` (Server Component) lee `q` y `pagina` de `searchParams` y renderiza la página pedida, ya filtrada. Las búsquedas siguientes las hace el Client Component contra la API.

### 1.5. Criterio reutilizable para HU-C-02

HU-C-02 (búsqueda de turnos) reutiliza **el criterio**: umbral de 2 caracteres, normalización y coincidencia parcial. No reutiliza los campos. Por la Regla N.° 3, el módulo C no puede importar `src/server/alumnos/*`. Para que la lógica quede reutilizable se separa en dos capas:

- **`src/lib/busqueda-texto.ts` (nuevo, puro, sin Prisma):** `MIN_CARACTERES_BUSQUEDA = 2`, `MAX_TOKENS_BUSQUEDA = 5`, `terminoBusqueda(texto)` y `tokenizarBusqueda(texto)`. Mismo precedente que `src/lib/filtrar-materias.ts`. **Decidido:** queda con ese nombre y en esa ubicación; HU-C-02 también la implementa Lautaro, así que no hay que coordinar.
- **`src/server/alumnos/alumno.busqueda.ts` (nuevo, el que pide la spec):** `construirFiltroBusquedaAlumno(q)` arma el `Prisma.AlumnoWhereInput` a partir de esos tokens, con los campos propios de Alumno.

### 1.6. Selector de HU-C-04: opción (a), sin tocar Turnos

La spec §2.7 ("Criterio compartido con Turnos") deja elegir entre (a) que el selector adopte `construirFiltroBusquedaAlumno()` y se actualice su test, o (b) dejarlo como está y agregar un test de paridad. **Se elige (a)**, porque la regla §3.9 dice que ambos "comparten `construirFiltroBusquedaAlumno()`".

- El cambio se hace **solo dentro de `buscarAlumnosActivos()`** (`src/server/alumnos/alumno.service.ts`, módulo B): `where: { activoAlumno: true, ...construirFiltroBusquedaAlumno(query) }`. **Misma firma `(query: string)`, mismo tipo de retorno `{ id, nombre, apellido, dni }[]`**, mismo `take: 10` y mismo orden. El route de Turnos y `buscador-alumnos.tsx` no cambian (restricción).
- Efecto visible: el selector de turnos ahora también encuentra "perez joaquin". Antes, con varias palabras, no encontraba nada.
- `alumno.busqueda.test.ts` (módulo B) se actualiza: antes mockeaba `where.OR`, ahora evalúa `where.AND` de `OR`.

**Rendimiento:** `contains` sobre columnas sin índice recorre la tabla. Con 40 fichas (y los cientos esperables en el centro) no afecta. Un índice trigram (`pg_trgm`) queda fuera de alcance.

### 1.7. Decisiones tomadas (antes "A CONFIRMAR"), 29/09/2026

1. **SP: 1.** Es el dato del backlog del PO y del documento de developers de Sprint 2. `HU-Sprint-2.md` §6 dice 2 SP; si corresponde, se reestima en el Planning.
2. **Pie "Mostrando X–Y de N" con números de página: fuera de esta HU.** No se toca `src/components/shared/pagination.tsx`. Esta HU solo garantiza que la paginación actual ("Página X de Y · N en total") informe la página y el total **del resultado filtrado**. **Deuda técnica** para una task aparte: llevar el componente compartido al formato de DESIGN §8.1 (afecta a Alumnos, Aulas, Materias y Profesores).
3. **"+ Nuevo alumno": se mantiene el link.** DESIGN §3 define `--primary` como "el botón que realmente hace avanzar el flujo" y da como ejemplos acciones de envío de formulario ("Guardar", "Registrar materia", "Iniciar sesión"). No define como botón las acciones de navegación de un listado. Los listados de Aulas, Materias y Profesores usan el mismo link subrayado con ícono, así que cambiar solo este rompería la consistencia sin respaldo en DESIGN.
4. **Más de 5 palabras:** se usan las 5 primeras y se ignora el resto, sin error.
5. **`src/lib/busqueda-texto.ts`:** queda con ese nombre y ubicación. HU-C-02 la hace el mismo responsable; no hay que coordinar.
6. **Error de red al buscar:** se reutiliza el patrón de `alumnos/error.tsx` (HU-B-04): el mismo texto, "No se pudo cargar la información de alumnos", y el mismo `Button` `outline` `sm` "Reintentar". Como no había un componente compartido, se extrae `aviso-error-alumnos.tsx` en la carpeta de la ruta y lo usan `error.tsx` y el listado. No se agrega ningún texto nuevo.
7. **Código del 400: se deja `VALIDACION`.** El `grep` del 29/09 muestra que `VALIDACION` lo usan muchos módulos, no solo Alumnos: Aulas, Materias, Profesores, Turnos, Calendario y el autorregistro de Auth (`src/app/api/**/route.ts`, `src/server/*/actions.ts`, formularios). Alinear solo Alumnos a `VALIDATION_ERROR` dejaría el proyecto inconsistente. **Deuda técnica:** la spec B §2.4/§2.7 dice `VALIDATION_ERROR`; unificarlo es una decisión transversal para otra task.

**Fuera de alcance de esta historia** (textual del backlog, criterio 8): filtros combinados por estado, forma de pago u otro criterio adicional.

**Fuera de alcance de esta task (adicional, spec §2.7):** búsqueda por email o teléfono, orden por relevancia (criterio 7), autocompletado del servidor, DNI con puntos, índices de base de datos, cualquier archivo del módulo de Turnos, `pagination.tsx`, `schema.prisma`, `seed.ts`.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** buscar un alumno por nombre, apellido o DNI desde el listado
**Para** encontrarlo rápido sin recorrer todas las páginas del listado

**SP estimado:** 1 (backlog del PO y documento de developers de Sprint 2; `HU-Sprint-2.md` dice 2, se reestima en el Planning si corresponde)
**Dependencias:** HU-B-04 (extiende el mismo listado; ya mergeada). No bloquea a otras historias. Fija el criterio que reutiliza HU-C-02. Puede arrancar de inmediato.

### 2.1. Criterios de aceptación y cómo se cumple cada uno

| # | Criterio | Cómo se cumple | Estado (29/09) |
|---|---|---|---|
| 1 | Campo de búsqueda por Apellido, Nombre o DNI; desde 2 caracteres; parcial, sin mayúsculas ni acentos | Input nuevo en `/alumnos`; `q` → `construirFiltroBusquedaAlumno()` con `normalizarTexto()`, `contains` sobre columnas normalizadas y DNI (1.2, 1.3) | ✅ Tests + CP-02 a CP-06, CP-10, CP-11, CP-14 contra la base |
| 2 | Dos o más palabras en cualquier orden | Tokens con AND entre tokens y OR entre campos (1.2) | ✅ Tests + CP-07 a CP-09 contra la base |
| 3 | Sin recargar la pantalla; mismo formato de fila | Client Component con `fetch` a la API y espera de 300 ms; la fila se mueve sin cambios desde `page.tsx` (1.4, sección 5) | ✅ Test de componente; falta la verificación manual UI-02 / UI-08 |
| 4 | Vuelve a la página 1 y pagina sobre el filtrado | Cada cambio de texto pide `pagina=1`; `count` y `findMany` con el mismo `where`; el paginador conserva `q` (1.1, 1.4) | ✅ Tests + CP-13 contra la base; falta la verificación manual UI-03 / UI-09 |
| 5 | "No se encontraron alumnos para «texto buscado»" y acceso a "Nuevo alumno" | Estado vacío con `q` válido; el texto es el `q` tras el `trim` (spec §2.7 paso 6) | ✅ Test de componente + CP-16; falta la verificación manual UI-04 |
| 6 | Al borrar, listado completo con el orden original | Menos de 2 caracteres → sin `q`, `pagina=1`; el `orderBy` no cambia (1.3) | ✅ Tests; falta la verificación manual UI-05 |
| 7 | Orden alfabético, sin relevancia | Mismo `orderBy` de HU-B-04 (apellido, nombre, DNI) con o sin filtro | ✅ Test (`orderBy` idéntico) + resultados de CP-04, CP-11 y UI-02 en orden alfabético |
| 8 | Sin filtros combinados | Fuera de alcance (1.7) | ✅ No se agregó ningún filtro extra |

---

## 3. Alcance de esta task

Implementación backend + frontend conforme a `spec_modulo_B.md` §2.7. Incluye:

- Schema Zod: parámetro `q` en `ListarAlumnosQuerySchema`.
- Helper puro `src/lib/busqueda-texto.ts` (umbral + normalización + tokens).
- Helper de dominio `src/server/alumnos/alumno.busqueda.ts` (`construirFiltroBusquedaAlumno`).
- Servicio: `listarAlumnos()` filtra con `q`; `buscarAlumnosActivos()` adopta el mismo filtro sin cambiar firma ni retorno (1.6).
- UI: buscador en `/alumnos` con actualización sin recarga, término en la URL, estados vacío, de carga y de error.
- Ficha: "Volver al listado" conserva `q` además de `pagina`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo indicado en la sección 1.

### Archivos a tocar

**Nuevos:**

| Archivo | Contenido |
|---|---|
| `src/lib/busqueda-texto.ts` | `MIN_CARACTERES_BUSQUEDA`, `MAX_TOKENS_BUSQUEDA`, `terminoBusqueda(texto)`, `tokenizarBusqueda(texto)`. Puro, sin Prisma ni `src/server/**` |
| `src/lib/busqueda-texto.test.ts` | Tests unitarios del helper puro |
| `src/lib/alumno-listado.ts` | `parametrosListadoAlumnos({ q, pagina })`: query string compartido por el listado, el paginador y la ficha |
| `src/lib/alumno-listado.test.ts` | Tests del armado de la URL |
| `src/server/alumnos/alumno.busqueda.ts` | `construirFiltroBusquedaAlumno(q): Prisma.AlumnoWhereInput \| undefined` |
| `src/server/alumnos/alumno.listado.test.ts` | Tests de `listarAlumnos()` con y sin `q` |
| `src/app/(dashboard)/alumnos/listado-alumnos.tsx` | Client Component: buscador + tabla + paginador |
| `src/app/(dashboard)/alumnos/listado-alumnos.test.tsx` | Test del componente (jsdom): espera, página 1, vacío, error |
| `src/app/(dashboard)/alumnos/aviso-error-alumnos.tsx` | Aviso "No se pudo cargar la información de alumnos" + "Reintentar", extraído de `error.tsx` |

**Existentes a modificar:**

| Archivo | Cambio |
|---|---|
| `src/server/alumnos/alumno.schema.ts` | Agregar `q: z.string().trim().max(100).optional()` |
| `src/server/alumnos/alumno.service.ts` | `listarAlumnos()` usa el `where` en `count` y `findMany`; `buscarAlumnosActivos()` adopta el filtro compartido (misma firma y retorno) |
| `src/server/alumnos/alumno.busqueda.test.ts` | Evaluar `where.AND` de `OR`; casos de `construirFiltroBusquedaAlumno` y multipalabra |
| `src/types/alumno.types.ts` | Tipo `ListadoAlumnos` (`{ items: AlumnoListado[]; paginacion: Paginacion }`) |
| `src/app/(dashboard)/alumnos/page.tsx` | Leer `q` de `searchParams`; subtítulo; render inicial filtrado; la tabla pasa a `listado-alumnos.tsx` |
| `src/app/(dashboard)/alumnos/error.tsx` | Usar `aviso-error-alumnos.tsx` (mismo texto y botón) |
| `src/app/(dashboard)/alumnos/[id]/page.tsx` | Aceptar `q` en `searchParams`; "Volver al listado" con `q` y `pagina` |

**Sin cambios de código:** `src/app/api/alumnos/route.ts` (ya pasa `parsed.data` completo a `listarAlumnos()`).

**No se tocan:** `prisma/schema.prisma`, migraciones, `prisma/seed.ts`, `src/lib/normalizar-texto.ts`, `src/components/shared/pagination.tsx`, `alumno.publico.ts` (sigue reexportando `buscarAlumnosActivos`) y **ningún archivo del módulo de Turnos** (restricción).

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/alumnos/alumno.schema.ts` (definición única, spec §2.7)

```typescript
export const ListarAlumnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
  q: z.string().trim().max(100).optional(), // HU-B-05
});
export type ListarAlumnosQuery = z.infer<typeof ListarAlumnosQuerySchema>;
```

### 4.2. Servicio

**`src/lib/busqueda-texto.ts`** (puro):

```typescript
export const MIN_CARACTERES_BUSQUEDA = 2;
export const MAX_TOKENS_BUSQUEDA = 5;
/** El texto recortado si alcanza el umbral; undefined si no se busca. */
export function terminoBusqueda(texto: string | undefined): string | undefined;
/** Tokens normalizados (máximo 5); null si no se busca. */
export function tokenizarBusqueda(texto: string | undefined): string[] | null;
```

**`src/server/alumnos/alumno.busqueda.ts`:**

```typescript
export function construirFiltroBusquedaAlumno(q: string | undefined): Prisma.AlumnoWhereInput | undefined;
```

- Si `tokenizarBusqueda(q)` devuelve `null` → `undefined` (sin filtro).
- Si hay tokens → `{ AND: tokens.map((t) => ({ OR: [apellido contains t, nombre contains t, ...(/^\d+$/.test(t) ? [dni contains t] : [])] })) }`.

**`listarAlumnos(query)`** (`alumno.service.ts`):
1. `const where = construirFiltroBusquedaAlumno(query.q)`.
2. `prisma.alumno.count({ where })` → `total` **filtrado**. La página se acota con ese total, igual que antes (con `total === 0` queda en la página 1).
3. `prisma.alumno.findMany({ where, orderBy: <el mismo de antes>, skip, take })`.
4. Sin filtro por `activoAlumno`: activos e inactivos (spec §2.7 paso 4). Misma forma de respuesta que §2.4.

**`buscarAlumnosActivos(query: string)`:** `where: { activoAlumno: true, ...construirFiltroBusquedaAlumno(query) }`. Si el filtro es `undefined`, devuelve `[]` sin consultar, como antes. Mismo `orderBy`, `take: 10` y formato de salida.

**Errores de servicio:** ninguno nuevo.

### 4.3. Route Handlers

**Archivo:** `src/app/api/alumnos/route.ts`, `GET`, `withPermission("alumnos:leer")`. Sin cambios de código.

- `200 OK`: misma forma de §2.4 (`items` + `paginacion`), sobre el resultado filtrado. Sin coincidencias: `items: []`, `total: 0`.
- `400 VALIDACION` (código real del proyecto, 1.7 punto 7): `q` de más de 100 caracteres, `por_pagina` mayor a 20, `pagina` inválida. Un `q` de 1 carácter **no** es error.
- `401` sin sesión · `403` sin `alumnos:leer`.

### 4.4. Server Action

No aplica. Es de solo lectura: el primer render lo hace el Server Component y las búsquedas siguientes usan el Route Handler (spec §2.7: "solo Route Handler").

### 4.5. Eventos de dominio

No aplica. Es de solo lectura (spec §4, Revisión 2: "no emiten eventos").

---

## 5. Frontend

**`/alumnos`, el mismo listado de HU-B-04** (no hay pantalla ni modal nuevo, mapa de pantallas §1):

- **Encabezado:** título "Alumnos" y subtítulo "Buscá por apellido, nombre o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes)." en `text-muted-foreground`. "Nuevo alumno" se queda como link arriba a la derecha (1.7 punto 3).
- **Buscador:** `Input` de shadcn de ancho completo, ícono `Search` de `lucide-react` a la izquierda, placeholder "Ej.: juan perez, 42…", `aria-label="Buscar alumno"`, `autoComplete="off"`, `maxLength={100}`. Valor inicial: el `q` de la URL.
- **`page.tsx` (Server Component):** lee `q` y `pagina`, llama a `listarAlumnos({ pagina, q })` dentro del `<Suspense>` que ya existe y le pasa el resultado y el `q` inicial a `listado-alumnos.tsx`, **sin `key`**: cuando el paginador navega, el componente adopta los datos nuevos sin remontarse (sección 9). El comentario sobre por qué no hay `loading.tsx` se mantiene.
- **`listado-alumnos.tsx` (Client Component):**
  - Cuando cambia el texto: espera de 300 ms → `q` efectivo (`terminoBusqueda`) → si es distinto del `q` de los datos mostrados, `fetchAutenticado("/api/alumnos?...&pagina=1&por_pagina=20")` con `AbortController` → reemplaza filas y paginación → `window.history.replaceState` con `/alumnos?q=…`. Sin `pagina` en la URL cuando es 1; sin `q` cuando no hay búsqueda.
  - Si el texto cambia pero el `q` efectivo es el mismo (por ejemplo, "ab" → "ab "), no vuelve a pedir.
  - Paginador: el `Pagination` compartido sin cambios; `buildHref` → `/alumnos?q=<q vigente>&pagina=<n>` (1.4).
  - Carga (corregido el 29/09, ver sección 9): mientras llega la respuesta, la tabla sigue mostrando los resultados anteriores, sin desmontarse, atenuarse ni cambiar de alto, y las filas se reemplazan directo al llegar. "Cargando alumnos" es solo la carga inicial (el `Suspense` de `page.tsx`). Si la respuesta tarda más de 300 ms, la lupa del input se reemplaza por un `Loader2` que gira, del mismo tamaño y en el mismo lugar, con un `role="status"` oculto ("Buscando alumnos"). El input sigue habilitado y con foco.
  - Fila: **la misma** de HU-B-04, incluidos `truncate`/`title`, la opacidad de inactivos y el `Badge` `success`/`muted`. El link a la ficha es `/alumnos/${id}?pagina=N` y suma `&q=…` si hay búsqueda.
  - Vacío **con** búsqueda: "No se encontraron alumnos para «{q}»" + link "Nuevo alumno" (mismo estilo que el vacío sin búsqueda).
  - Vacío **sin** búsqueda: el "No hay alumnos registrados" de siempre.
  - Error de red: `aviso-error-alumnos.tsx` (1.7 punto 6); "Reintentar" repite la búsqueda vigente. `error.tsx` sigue cubriendo los errores del render en el servidor.
- **`/alumnos/[id]`:** "Volver al listado" → `/alumnos?q=…&pagina=N` con los parámetros que haya.
- Seguir `docs/DESIGN.md`: solo tokens, sin colores a mano. No se suma ninguna librería.

**Fuera de alcance de frontend:** filtros, cambios al buscador de turnos y rediseño de la paginación (1.7 punto 2).

---

## 6. Testing (tres niveles)

> A diferencia de HU-B-04, el proyecto ya tiene `vitest` (`npm test`): el Nivel 1 corre.

### Nivel 1 — Unitarios

`src/lib/busqueda-texto.test.ts`:
- `""`, `"   "`, `"a"`, `" a "` → sin búsqueda.
- `"ab"` → `["ab"]`; `"PÉREZ"` → `["perez"]`; `"Ibáñez"` → `["ibanez"]`; `"  juan   perez  "` → `["juan", "perez"]`.
- 6 palabras → solo las 5 primeras.

`src/lib/alumno-listado.test.ts`: sin parámetros → `""`; `q` y página > 1 → ambos; página 1 → se omite; `q` con espacios y tildes → codificado.

`src/server/alumnos/alumno.busqueda.test.ts` (actualizado):
- `construirFiltroBusquedaAlumno`: sin `q` o con 1 carácter → `undefined`. Un token de texto → `AND` con un `OR` de 2 campos (sin DNI). Un token de dígitos → `OR` de 3 campos (con DNI). Dos tokens → `AND` de 2.
- `buscarAlumnosActivos`: los casos de antes siguen pasando ("ANA", "PÉRE", "1234", "GÓME"; menos de 2 caracteres no consulta; excluye inactivos; `take: 10`) con el mock adaptado a `AND`/`OR`. Nuevo: "perez ana" encuentra a Ána Pérez; el formato de salida no cambia.

`src/server/alumnos/alumno.listado.test.ts` (nuevo, `prisma` mockeado):
- Sin `q` y con `q` de 1 carácter: `count` y `findMany` **sin** `where` (comportamiento de HU-B-04 intacto).
- Con `q`: `count` y `findMany` reciben **el mismo** `where`; `orderBy` sin cambios; `total` y `total_paginas` salen del conteo filtrado.
- Filtrado con 0 resultados → `items: []`, `pagina_actual: 1`, `total_paginas: 0`.
- Página pedida mayor a la última del filtrado → se acota a la última.

`src/app/(dashboard)/alumnos/listado-alumnos.test.tsx` (jsdom, timers falsos): una sola petición tras 300 ms con `pagina=1`; 1 carácter no pide; vacío con el texto recortado y "Nuevo alumno"; error de red con "Reintentar".

### Nivel 2 — Postman / curl y navegador: casos con datos del seed

Precondición: `npx prisma db seed` recién corrido; sesión `mesa.entrada@noctium.local` / `Password123!`. Resultados calculados sobre las 40 fichas del seed (0.3), en el orden del listado.

| # | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-01 | Sin búsqueda | `GET /api/alumnos` | `200`, `total: 40`, 2 páginas de 20, orden Acosta, Aguirre, Álvarez… |
| CP-02 | Mayúsculas sin tilde | `q=LOPEZ` | 1: López, Valentina (`40100003`) |
| CP-03 | Minúsculas con tilde | `q=lópez` | El mismo resultado que CP-02 |
| CP-04 | Parcial por nombre | `q=val` | 2: López, Valentina · Ríos, Valentín |
| CP-05 | Parcial por apellido, con tilde en la base | `q=gom` | 1: Gómez, Santiago (`40100019`) |
| CP-06 | ñ | `q=munoz` y `q=ibañez` | Muñoz, Ezequiel (`40100039`) · Ibáñez, Catalina (`40100020`) |
| CP-07 | Nombre + apellido | `q=joaquin perez` | 1: Pérez, Joaquín (`40100006`) |
| CP-08 | Invertido y en mayúsculas | `q=perez joaquin` / `q=PÉREZ JOAQUÍN` | El mismo resultado que CP-07 |
| CP-09 | Palabras de personas distintas | `q=fernandez lucas` | 0 resultados (Fernández es Sofía; Lucas es Martínez): AND entre tokens |
| CP-10 | DNI parcial | `q=0034` | 1: Morales, Josefina (`40100034`) |
| CP-11 | DNI parcial amplio | `q=4010001` | 10: DNI `40100010` a `40100019` |
| CP-12 | Inactivo incluido | `q=paz` | 1: Paz, Bruno (`40100017`), con estado Inactivo |
| CP-13 | Paginación del filtrado | `q=ez&por_pagina=5` | `total: 17`, `total_paginas: 4`; `pagina=4` trae 2 filas |
| CP-14 | 1 carácter | `q=a` | Listado completo: `total: 40`, sin `400` |
| CP-15 | Espacios | `q=%20%20gómez%20%20` | Igual que CP-05 |
| CP-16 | Sin resultados | `q=juan perez` (no hay ningún Juan en el seed) / `q=xyz` | `200`, `items: []`, `total: 0` |
| CP-17 | `q` demasiado largo | `q` de 101 caracteres | `400 VALIDACION` |
| CP-18 | Sin permiso / sin sesión | Sesión `gerente@noctium.local` / sin cookie | `403` / `401` |

En el navegador (`/alumnos`), con la misma sesión:

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| UI-01 | Umbral | Escribir "l" | No filtra; sigue el listado completo |
| UI-02 | Sin recarga | Escribir "lu" | Tras ~300 ms, 4 filas (Álvarez, Lucía · Ledesma, Guadalupe · Luna, Micaela · Martínez, Lucas); el input no pierde el foco; la URL pasa a `/alumnos?q=lu` sin recargar |
| UI-03 | Vuelve a página 1 | Ir a la página 2 sin buscar y escribir "ez" | Página 1 con 17 resultados y sin control de paginación (una sola página) |
| UI-04 | Sin resultados | Escribir "juan perez" | "No se encontraron alumnos para «juan perez»" + link "Nuevo alumno" |
| UI-05 | Borrar | Borrar todo el texto | Listado completo, página 1, orden Acosta, Aguirre, Álvarez…; URL `/alumnos` |
| UI-06 | Volver desde la ficha | Buscar "val", abrir Ríos, Valentín y "Volver al listado" | Vuelve a `/alumnos?q=val` con el mismo resultado y el texto cargado en el input |
| UI-07 | Respuestas viejas | Escribir "gom" y enseguida "gomez santi" | Solo se ve el último resultado (Gómez, Santiago) |
| UI-08 | Formato de fila | Comparar una fila filtrada con la misma sin filtro | Mismas columnas, truncado, badge y opacidad de inactivo |
| UI-09 | Paginación con búsqueda | Escribir "4010" (40 resultados) y tocar "Siguiente" | Página 2 de 2, "40 en total", URL `/alumnos?q=4010&pagina=2`, el input conserva "4010" |
| UI-10 | Error de red | Con las DevTools en "Offline", escribir "val" | "No se pudo cargar la información de alumnos" + "Reintentar"; al volver a "Online" y tocar "Reintentar", aparecen los 2 resultados |
| UI-11 | Selector de turnos (HU-C-04) | En "Agregar alumno" de un turno, escribir "perez joaquin" | Aparece Pérez, Joaquín (antes no encontraba nada con dos palabras) |

### Nivel 3 — BD / TablePlus

- Sin escrituras: comprobar que después de las pruebas no cambió ninguna fila de `alumnos` (`updatedAtAlumno` sin cambios).
- Contrastar CP-11 con SQL: `SELECT count(*) FROM alumnos WHERE "dniAlumno" LIKE '%4010001%';` → 10.

**Evidencia esperada:** salida de `npm test`, curl/Postman de la tabla CP, capturas de UI-02, UI-04, UI-05 y UI-06.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar; decisiones de 1.7 tomadas.
- [x] `q` agregado a `ListarAlumnosQuerySchema` (máx. 100, con `trim`).
- [x] `src/lib/busqueda-texto.ts` puro, sin imports de `src/server/**` ni de Prisma.
- [x] `construirFiltroBusquedaAlumno()` en `src/server/alumnos/alumno.busqueda.ts`, usado por `listarAlumnos()` y `buscarAlumnosActivos()` (regla §3.9).
- [x] `buscarAlumnosActivos()` con la misma firma y el mismo tipo de retorno.
- [x] `count` y `findMany` con el mismo `where`: el total y las páginas son del resultado filtrado.
- [x] Sin lógica de negocio en el Route Handler ni en el componente (Regla N.° 4).
- [x] UI: buscador con espera de 300 ms, sin recarga, página 1 al escribir, término en la URL con `replaceState`, estados vacío, de carga y de error.
- [x] Fila del listado idéntica a la de HU-B-04.
- [x] "Volver al listado" de la ficha conserva `q` y `pagina`.
- [x] Ningún archivo del módulo de Turnos modificado; `pagination.tsx`, `schema.prisma` y `seed.ts` sin cambios.
- [x] Solo tokens de `DESIGN.md`, sin colores a mano.
- [x] Ningún `DELETE` físico ni escritura en ningún punto.
- [x] `npm test`, `npm run lint`, `tsc --noEmit` y `npm run build` limpios.
- [ ] Casos CP y UI de la sección 6 documentados con evidencia (CP verificados contra el servicio, ver sección 8; faltan los curl con sesión y los casos UI en el navegador).
- [ ] PR con el diff acotado a esta HU.
- [ ] Verificado manualmente en el navegador antes del commit final.

---

## 8. Evidencia de implementación (Claude Code, 29/09/2026)

Implementado sobre `develop` (`07eba47`), sin rama nueva ni commits.

**Verificaciones:**
- `npx tsc --noEmit`: sin errores. `npm run lint`: sin errores. `npm run build`: OK.
- `npm test`: 50 archivos, **667 tests pasan**, 24 omitidos (`*.pg.test.ts`, sin base de prueba configurada) y 3 `todo` (HU-K-03). De esta HU: `busqueda-texto.test.ts` (11), `alumno-listado.test.ts` (3), `alumno.busqueda.test.ts` (17, incluidos los 6 casos de antes del selector), `alumno.listado.test.ts` (9) y `listado-alumnos.test.tsx` (7).
- **Casos CP contra la base de desarrollo** (script de solo lectura que llama a `listarAlumnos()` y `buscarAlumnosActivos()`, sin HTTP): CP-02 a CP-13 y CP-15 a CP-17 dan exactamente lo esperado. CP-01 y CP-14 dieron `total=46` en vez de 40 porque la base local tiene 6 fichas cargadas a mano además del seed; con `npx prisma db seed` recién corrido da 40, como indica la precondición. El selector de Turnos (UI-11) encuentra a Pérez, Joaquín con "perez joaquin" y sigue excluyendo inactivos ("paz" → `[]`).
- **Pendiente de verificación manual:** los curl con sesión (CP con `401`/`403`) y los casos UI-01 a UI-11 en el navegador.

**Diferencia con la primera versión de esta task:** el paginador no pasa por la API. Cambiar de página es una navegación del lado del cliente a `/alumnos?q=…&pagina=N`, porque `pagination.tsx` no se toca (1.7 punto 2).

## 9. Correcciones posteriores

### 9.1. Parpadeo de la tabla al escribir (29/09/2026)

**Síntoma:** cada vez que se agregaba o sacaba un carácter (por ejemplo, "ad"), la tabla hacía una animación muy corta.

**Causa:** en `listado-alumnos.tsx`, cada búsqueda ponía `cargando = true`, y eso hacía dos cosas:
1. Insertaba la línea "Cargando alumnos" **arriba** de la tabla, que la empujaba hacia abajo (cambio de alto y de posición).
2. Pasaba el contenedor de la tabla a `opacity-60` con `transition-opacity`, un fundido de 150 ms.

En local la respuesta llega en milisegundos, así que la línea desaparecía y la opacidad volvía enseguida: salto y fundido en cada tecla. **No era** un `loading.tsx` (no hay ninguno en `src/app`) ni `router.replace` (la URL ya se actualizaba con `window.history.replaceState`). La `key` por `q` + página de `page.tsx` no intervenía al escribir, pero sí remontaba el listado completo en cada cambio de página.

**Cambios:**
- Se quitaron la línea "Cargando alumnos" de las búsquedas y el `opacity-60`/`transition-opacity`. Mientras llega la respuesta, la tabla (el mismo nodo del DOM) sigue con las filas anteriores, y al llegar se reemplazan directo. "Cargando alumnos" queda solo en la carga inicial (`Suspense` de `page.tsx`).
- El aviso de búsqueda es un `Loader2` que reemplaza la lupa dentro del input (mismo tamaño y lugar, `text-muted-foreground`, sin colores a mano), más un `role="status"` oculto ("Buscando alumnos"). Aparece solo si la respuesta tarda más de 300 ms (`ESPERA_AVISO_CARGA_MS`), así que en local no se ve.
- Se sacó la `key` de `ListadoAlumnos` en `page.tsx`. Cuando el paginador navega, el componente adopta los datos nuevos del servidor en el mismo render (comparando la prop `inicial`), sin remontar la tabla ni el input. La navegación ocurre dentro de una transición de Next, así que el `Suspense` ya visible no vuelve a mostrar "Cargando alumnos".
- Sin cambios: la espera de 300 ms antes de buscar, la URL con `replaceState`, "Volver al listado" con `q` y `pagina`, y el aviso de error con "Reintentar".

**Tests** (`listado-alumnos.test.tsx`, ahora 11): la tabla es el mismo nodo antes, durante y después de la búsqueda, sin "Cargando alumnos" ni clases de opacidad o transición; el spinner no aparece antes de 300 ms de espera, aparece después y se va al llegar la respuesta; una respuesta rápida no muestra ningún aviso; los datos nuevos del servidor se adoptan sin remontar la tabla ni el input. `tsc --noEmit`, `npm run lint`, `npm test` (671 pasan) y `npm run build`: OK.

**Pendiente:** verificarlo a ojo en el navegador (UI-02, UI-09).
