# TASK: HU-C-02 — Búsqueda inteligente de turnos

**Módulo:** C (Turno)
**Sprint:** 2
**Responsable:** Lautaro (Chiki)
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` Revisión 5: §2.7 (búsqueda `q`, contrato completo), §2.4 (listado que se extiende), R5-7 y §3.11 (excepción documentada a la Regla N.° 3) · `docs/tasks/Sprint 2/HU-B-05.md` (criterio y patrón que se reutilizan) · `docs/DESIGN.md` §8.1 (paginación) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila "Listado de turnos (`/turnos`) — HU-C-02") · `docs/tasks/Sprint 2/HU-Sprint-2.md` §7 (criterios 1 a 6) · pantalla de referencia 01 "Turnos — listado" (Noctium pantallas Sprint 2)
**RBAC:** `turnos:leer` — ya existe (HU-C-01): `MESA_ENTRADA`, `GERENTE` y `PROFESOR` (`prisma/seed.ts` l. 718-720). Sin cambios.
**Schema:** sin cambios. Usa columnas normalizadas que ya existen en los tres modelos que participan de la búsqueda: `apellidoNormalizadoProfesor` / `nombreNormalizadoProfesor` (HU-D-05), `nombreNormalizadaMateria` (HU-L-01) y `nombreNormalizadaAula` (HU-K-01). **No se modifican `prisma/schema.prisma` ni `prisma/seed.ts`.**
**Estado:** IMPLEMENTADA (29/09/2026), **con el alcance ajustado de 9.1: la búsqueda no incluye alumnos.** `tsc`, lint y tests limpios; CP-01 a CP-25 verificados contra la base de desarrollo (sección 8). **Pendiente:** verificación manual en el navegador (UI-01 a UI-15), los curl con sesión (CP-26, CP-27) y `npm run build`.
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (schema en `src/server/turnos/turno.schema.ts`, service en `src/server/turnos/turno.service.ts`, helper de búsqueda en `src/server/turnos/turno.busqueda.ts`, helper puro compartido en `src/lib/busqueda-texto.ts`).

> **Cambio de alcance (29/09/2026): se quita la búsqueda por alumno respecto de la planilla del Sprint 2 (decisión del equipo, 29/09/2026).** La búsqueda es solo por nombre/apellido de profesor, nombre de materia y nombre/número de aula. Ver 1.7 punto 13 y 9.1.

> **Restricción (29/09/2026): no se tocan archivos de otras HU en curso.** El wizard `/turnos/nuevo` (Emir, HU-C-18), `src/app/(dashboard)/turnos/[id]/**` y `src/server/turnos/turno.publico.ts` (Tomás, HU-C-08 / HU-C-09) quedan **sin cambios**. Tampoco se tocan `src/components/shared/pagination.tsx`, el código de error `VALIDACION`, `schema.prisma` ni `seed.ts`. Si algo exigiera tocar uno de esos archivos, esa parte no se hace y se anota como pendiente de coordinación (1.8).

---

## 0. Relevamiento previo a implementación (Claude Code)

Relevamiento realizado el 2026-09-29 sobre `feature/HU-C-02` (a la altura de `develop`, `4f06350`, con HU-B-05 ya mergeada en el PR #123).

### 0.1. Qué existe hoy (HU-C-01 y HU-B-05) — rutas reales

| Pieza | Ruta | Estado antes de esta HU |
|---|---|---|
| Página del listado | `src/app/(dashboard)/turnos/page.tsx` | **Server Component mínimo.** Lee `?pagina=` y `?orden=` de `searchParams` (el `orden` se ignora: siempre pasa `"fecha_hora_asc"`), y renderiza `<TurnosListado key={paginaActual} …>`. **La `key` cambia con la página**: cada cambio de página remonta el listado. Sin búsqueda |
| Componente del listado | `src/app/(dashboard)/turnos/turnos-listado.tsx` | **Client Component que trae los datos él mismo** (a diferencia de Alumnos, el servidor no hace el primer render de la tabla): `fetchAutenticado("/api/turnos?pagina=N", { cache: "no-store" })` al montar y otra vez en `pageshow` / `visibilitychange`. Cada consulta pone `cargando = true` y reemplaza la tabla por "Cargando turnos". Sin `AbortController`. Paginador **propio, inline** (no usa `pagination.tsx`): "Página X de Y · N turnos" + `<Link>` "Anterior"/"Siguiente" a `/turnos?pagina=N&orden=fecha_hora_asc`. Vacío: "No hay turnos registrados". Error: el mensaje del servidor + `Button` `outline` "Reintentar" |
| Route Handler del listado | `src/app/api/turnos/route.ts` | `GET` con `withPermission("turnos:leer")`, valida `ListarTurnosQuerySchema` y llama a `listarTurnos(parsed.data.pagina, parsed.data.por_pagina, req.auth!.user)`. Error de validación con código `VALIDACION` |
| Schema del query | `src/server/turnos/turno.schema.ts` | `ListarTurnosQuerySchema` con `pagina` (default 1) y `por_pagina` (máx. 20, **opcional**). Sin `q` ni `.strict()` |
| Servicio del listado | `src/server/turnos/turno.service.ts` | `listarTurnos(pagina, porPaginaSolicitado, usuario)` (**parámetros posicionales**). Tamaño de página: `por_pagina` o el parámetro `paginacion_limite_default` (10 en el seed). `where = { fechaTurno: { gte: inicioHoy }, ...(PROFESOR ? { profesor: { is: { usuarioId } } } : {}) }`, **el mismo** en `count` y `findMany`. `orderBy`: `fechaTurno` → `horaInicioTurno` → `profesorId` (nulls last) → `idTurno`. Página acotada a la última existente. Formato de fila: `presentar()` con `turnoInclude` |
| Tipos del listado | `src/app/(dashboard)/turnos/turno.types.ts` | `Turno`, `TurnosData` (`{ items, paginacion }`), `ETIQUETA_ESTADO_TURNO`, `urlContinuar(turno, retorno)`. Vive en la carpeta de la ruta, no en `src/types/` (ubicación ya relevada en HU-C-04; no se mueve en esta HU) |
| Detalle y "Volver al listado" | `src/app/(dashboard)/turnos/[id]/page.tsx` | Recibe `?volver=` y lo acepta si empieza con `/turnos` (o `/calendario/`). `turno-detalle.tsx` usa ese valor tal cual en "Volver al listado". **No hace falta tocarlo**: si el listado arma `volver` con `q`, la búsqueda se conserva sola (1.4) |
| Pasos del turno pendiente | `src/app/(dashboard)/turnos/[id]/configuracion/page.tsx`, `[id]/participantes/page.tsx` | Aceptan `volver` solo si empieza con `/turnos?`. El `retorno` del listado siempre tiene `?pagina=…`, así que con `q` también pasa (1.4) |
| Criterio de búsqueda (HU-B-05) | `src/lib/busqueda-texto.ts` | `MIN_CARACTERES_BUSQUEDA = 2`, `MAX_TOKENS_BUSQUEDA = 5`, `terminoBusqueda(texto)`, `tokenizarBusqueda(texto)`. Puro, sin Prisma. Su comentario ya anticipa que lo reutiliza HU-C-02 |
| Filtro de alumnos (HU-B-05) | `src/server/alumnos/alumno.busqueda.ts` | `construirFiltroBusquedaAlumno(q)`: `AND` de tokens, `OR` de campos sobre las columnas normalizadas. Es el modelo a copiar (la **forma** del filtro, no los campos: esta HU no busca por alumno); **no se importa** desde Turnos (Regla N.° 3) |
| Listado de alumnos (HU-B-05) | `src/app/(dashboard)/alumnos/listado-alumnos.tsx` | Patrón de cliente a copiar: `ESPERA_BUSQUEDA_MS = 300`, `ESPERA_AVISO_CARGA_MS = 300`, `AbortController`, `window.history.replaceState`, `Loader2` en lugar de la lupa, `role="status"` oculto, sin `key` cambiante |
| `normalizarTexto()` | `src/lib/normalizar-texto.ts` | NFD + quita diacríticos + minúsculas. La usan `tokenizarBusqueda()` y todos los servicios que llenan las columnas normalizadas |
| Tests existentes | `src/server/turnos/turno.listado.test.ts`, `src/app/(dashboard)/turnos/turnos-listado.test.tsx` | El primero verifica `count` con el `where` **exacto** `{ fechaTurno: { gte } }` y el `orderBy`. El segundo verifica "Cargando turnos", los `href` de retorno (`/turnos?pagina=2&orden=fecha_hora_asc`) y la llamada `fetch("/api/turnos?pagina=2", { cache: "no-store" })` |

### 0.2. Modelos relevados (`prisma/schema.prisma`)

- **`Turno`**: `materiaId` (obligatorio), `profesorId` y `aulaId` **opcionales** (`null` en un `PENDIENTE` sin asignar), `alumnos TurnoAlumno[]`, `estadoTurno` (`PENDIENTE` | `DISPONIBLE` | `COMPLETO` | `CANCELADO`), `prioridadTurno` (existe en el schema, pero `presentar()` todavía no lo expone: es de HU-C-10).
- **`TurnoAlumno`** / **`Alumno`**: relevados, pero **no participan de la búsqueda** (cambio de alcance, 1.7 punto 13).
- **`Profesor`**: `nombreNormalizadoProfesor`, `apellidoNormalizadoProfesor` (índice `profesores_orden_listado_idx`). Se llenan con `normalizarTexto()` vía `clavesOrdenProfesor()` (`src/lib/profesor-listado.ts`), también en el seed.
- **`Materia`**: `nombreMateria` y `nombreNormalizadaMateria` (`@unique`). Se llena con `normalizarTexto()` en `materia.service.ts` y en el seed.
- **`Aula`**: `nombreAula` (`@unique`, `varchar(30)`, comentario del schema: "nombre o número de aula") y `nombreNormalizadaAula` (`@unique`). **No hay un campo numérico aparte**: el "número" de aula es parte del nombre ("Aula 2"). Se llena con `normalizarTexto()` en `aula.service.ts` y en el seed.

**Conclusión sobre los acentos:** el mecanismo de HU-B-05 (comparar tokens normalizados contra columnas normalizadas con `contains`) **sirve tal cual para Profesor, Materia y Aula**, porque los tres ya tienen su columna normalizada. No hace falta la alternativa de resolver ids en memoria (1.2).

### 0.3. Datos del seed útiles para probar (`prisma/seed.ts`)

- **27 turnos** (`TURNOS`, l. 782-820), con fechas **relativas al día en que se corre el seed** (días operativos). 25 son futuros y 2 pasados (`seed-turno-26`, `-27`), que el listado no muestra (`fechaTurno >= hoy`). **Sin búsqueda, el listado tiene 25 turnos** en 3 páginas de 10.
- Profesores con turnos (índice en `PROFESORES`): 0 Laura Giménez (`profesor1@noctium.local`), 1 Martín Rossi, 2 Carolina Vega, 3 Sergio Acuña, 9 Julián Castro.
- Materias con turnos: Matemática, Física, Programación I, Bases de Datos, Química, Inglés Técnico. Aulas con turnos: Aula 1, Aula 2, Aula 10, Aula 11, Laboratorio.
- **Palabra que coincide con más de un campo (criterio 2):** con el seed **no existe ninguna palabra completa** que aparezca a la vez en el profesor, la materia o el aula de los turnos futuros. El único fragmento de 3 o más letras que lo cumple es **"ato"**: materia "Bases de Datos" y aula "Laboratorio" (se usa en CP-11, 1.7 punto 10).
- **Apellidos de alumnos que ya no deben encontrar nada:** "muñoz" (Ezequiel Muñoz, inscripto en 16 y 22) y "sofia" (Sofía Fernández, inscripta en 01, 04, 08, 09, 14 y 12) no coinciden con ningún profesor, materia ni aula: dan 0 resultados (CP-18). "Castro" y "Giménez" son apellidos de alumnas **y** de profesores con turnos: ahora solo encuentran los turnos del profesor (CP-19).
- **No hay ningún "Méndez"**: "mendez" da 0 resultados.
- Hay dos profesores "Juan Pérez" (activos), pero **sin turnos**: "juan perez" da 0 resultados.
- Turnos futuros del seed, en el orden del listado (fecha/hora ascendente):

| Id (`seed-turno-`) | Día operativo | Hora | Materia | Profesor | Aula | Estado |
|---|---|---|---|---|---|---|
| 01 | 0 | 08:00 | Matemática | Giménez | Aula 1 | Completo (10/10) |
| 02 | 0 | 10:00 | Programación I | Rossi | Aula 2 | Disponible |
| 03 | 0 | 16:00 | Inglés Técnico | Acuña | Aula 10 | Disponible |
| 05 | 1 | 10:00 | Física | Giménez | Aula 2 | Disponible (0 inscriptos) |
| 06 | 1 | 12:00 | Bases de Datos | Rossi | Aula 1 | Disponible |
| 04 | 1 | 14:00 | Química | Vega | Laboratorio | Completo (15/15) |
| 07 | 2 | 08:00 | Física | Giménez | Aula 1 | Disponible |
| 08 | 2 | 12:00 | Bases de Datos | Rossi | Aula 11 | Disponible |
| 09 | 2 | 15:00 | Matemática | Castro | Aula 2 | **Cancelado** |
| 10 | 3 | 10:00 | Matemática | Giménez | Aula 10 | Disponible |
| 11 | 3 | 14:00 | Química | Sin asignar | Sin asignar | **Pendiente** |
| 13 | 3 | 16:00 | Programación I | Acuña | Laboratorio | Disponible |
| 14 | 4 | 08:00 | Física | Giménez | Aula 2 | Disponible |
| 15 | 4 | 10:00 | Programación I | Rossi | Aula 11 | Disponible |
| 16 | 4 | 14:00 | Química | Vega | Aula 10 | Disponible |
| 17 | 5 | 08:00 | Matemática | Giménez | Aula 1 | Disponible (0 inscriptos) |
| 19 | 5 | 15:00 | Física | Castro | Laboratorio | Disponible |
| 18 | 5 | 16:00 | Inglés Técnico | Sin asignar | Sin asignar | **Pendiente** |
| 20 | 6 | 12:00 | Programación I | Rossi | Aula 2 | Disponible |
| 21 | 6 | 14:00 | Matemática | Vega | Aula 1 | Disponible |
| 22 | 6 | 16:00 | Inglés Técnico | Acuña | Aula 11 | Disponible |
| 23 | 7 | 10:00 | Física | Giménez | Aula 10 | Disponible |
| 24 | 7 | 12:00 | Bases de Datos | Rossi | Aula 1 | Disponible |
| 25 | 7 | 15:00 | Programación I | Sin asignar | Sin asignar | **Pendiente** |
| 12 | 10 | 10:00 | Bases de Datos | Rossi | Aula 2 | Disponible |

- Los resultados de la sección 6 se calcularon aplicando la lógica de 1.2 (**alcance nuevo, sin alumnos**) sobre estos datos (script de solo lectura sobre los arrays del seed, sin base). Todavía no se verificaron contra la base con el código ajustado (9.1). Requieren `npx prisma db seed` corrido **el mismo día** de la prueba (si no, algunos turnos quedan en el pasado y salen del listado) y ningún turno cargado a mano.
- Usuarios: `mesa.entrada@noctium.local`, `gerente@noctium.local`, `profesor1@noctium.local` (Laura Giménez), `alumno01@noctium.local`; todos con `Password123!`.

### 0.4. Diferencias encontradas (la pantalla de referencia y el código contra la spec)

Según el documento de developers de Sprint 2, los mockups no se actualizaron con el backlog: **si difieren, manda la spec**, y esta HU no cambia lo que no le corresponde (criterio 3: se conserva el formato de fila).

| Tema | Pantalla 01 "Turnos — listado" | Spec / código actual | Qué se hace |
|---|---|---|---|
| Columnas | Fecha, Horario, Materia, Profesor, Aula, Inscriptos, Prioridad, Estado | Código: Fecha, Hora, Alumnos inscriptos, Profesor, Materia, Aula, Estado, Acciones | **Se mantienen las columnas actuales** (criterio 3). La columna Prioridad es de HU-C-10 (spec §2.4, nota Revisión 5 y §2.12) |
| "Nuevo turno" | Botón "Nuevo turno" | Link con estilo de botón "Configurar turno" a `/turnos/nuevo` (solo `MESA_ENTRADA`) | Se mantiene. El nombre y el flujo del alta son de HU-C-18 (Emir) |
| "Ir a hoy" | Botón "Ir a hoy" | **No existe** en el código. El listado ya arranca en hoy (`fechaTurno >= hoy`), así que la página 1 siempre es "hoy" | **No se agrega** (1.7 punto 3). Si otra HU lo agrega y calcula la página en el servidor, tiene que usar el mismo `where` de `listarTurnos()` (1.1) |
| Subtítulo | "Buscá por alumno, profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes)." | "Desde hoy · Orden: fecha y hora ascendente, luego profesor" | Primera línea: "Buscá por profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes)." (sin "alumno", 1.7 punto 13); segunda línea: se conserva "Desde hoy · Orden: …" (1.7 punto 4) |
| Buscador | Ancho completo, lupa, placeholder "Ej.: sofia matematica, aula 2, mendez…" | No existe | Se agrega (sección 5) con placeholder sin nombre de alumno: "Ej.: matematica, aula 2, gimenez…" (Giménez es profesora del seed) |
| Contador | "N turnos" arriba de la tabla | El total solo aparece en el paginador, y solo con más de una página | Se agrega el contador con el total **del resultado filtrado** |
| Tamaño de página | — | DESIGN §8.1 y spec §2.7: **20** en Turnos. Código: `por_pagina` opcional, default `paginacion_limite_default` (**10** en el seed) | **Se deja como está** (1.7 punto 5). Deuda anotada |
| Pie de tabla | — | DESIGN §8.1: "Mostrando X–Y de N" con números de página. Código: paginador inline "Página X de Y · N turnos" | **Fuera de esta HU**, misma deuda técnica que HU-B-05 (1.7 punto 2) |
| Código de error 400 | — | Spec: `VALIDATION_ERROR`; código real: `VALIDACION` | Se deja `VALIDACION` (misma deuda que HU-B-05 1.7 punto 7) |
| SP | — | `HU-Sprint-2.md` §7 dice **2 SP** | Se toma **1 SP**, dato de la planilla del Sprint 2 (1.7 punto 1) |

---

## 1. Nota de alcance

### 1.1. Dónde se filtra: en el servidor

**Decisión: el filtro se resuelve en la base, dentro de `listarTurnos()`.** No se filtra en el cliente.

- **Criterio 3:** la paginación es server-side (`skip`/`take`, HU-C-01). El cliente solo tiene las filas de la página actual; filtrarlas ahí daría resultados incompletos y un `total` falso. `count()` y `findMany()` siguen usando **el mismo `where`** (ya lo hacen hoy), ahora con la búsqueda incluida: el total, las páginas y el contador "N turnos" son los del resultado filtrado.
- **Spec §2.7:** la búsqueda es el parámetro `q` de `GET /api/turnos` y la resuelve `listarTurnos()`, que "se amplía, no se duplica".
- **Regla N.° 4:** el criterio de coincidencia es regla de negocio y vive en la capa de servicios, no en el componente.
- **Regla N.° 6:** `q` se valida con `ListarTurnosQuerySchema` (máx. 100 caracteres) antes de llegar al servicio.
- **Orden:** el `orderBy` de HU-C-01 no cambia (`fechaTurno` → `horaInicioTurno` → `profesorId` nulls last → `idTurno`), con o sin búsqueda (criterio 5).
- **"Ir a hoy":** hoy no existe (0.4). Si una HU futura lo agrega y calcula la página en el servidor, debe usar el mismo `where` (incluida la búsqueda); si no, la página calculada no corresponde al resultado filtrado.
- La búsqueda es de solo lectura: no emite eventos de `EventoTurno`.

### 1.2. Búsqueda multipalabra en cualquier orden

Según la spec §2.7 pasos 1 a 3, reutilizando **sin cambios** `src/lib/busqueda-texto.ts` (no se duplica lógica):

1. `q` se recorta. Con **menos de 2 caracteres** se ignora (1.3).
2. `tokenizarBusqueda(q)` lo normaliza con `normalizarTexto()` y lo parte por espacios. Se usan **los 5 primeros tokens; el resto se ignora, sin error**.
3. **Cada token** tiene que coincidir **parcialmente** (`contains`) con **al menos uno** de estos campos (**la relación con alumnos no participa del filtro**, 1.7 punto 13):
   - `apellidoNormalizadoProfesor` o `nombreNormalizadoProfesor` del profesor (`profesor: { is: … }`);
   - `nombreNormalizadaMateria` (`materia: { is: … }`);
   - `nombreNormalizadaAula` (`aula: { is: … }`).
4. **AND entre tokens, OR entre campos.** Las palabras pueden ir en cualquier orden y cada una puede coincidir con un campo distinto ("gimenez matematica": "gimenez" con la profesora, "matematica" con la materia).

```typescript
// forma del where para q = "gimenez matematica"
{ AND: [
  { OR: [
    { profesor: { is: { OR: [{ apellidoNormalizadoProfesor: { contains: "gimenez" } }, { nombreNormalizadoProfesor: { contains: "gimenez" } }] } } },
    { materia: { is: { nombreNormalizadaMateria: { contains: "gimenez" } } } },
    { aula: { is: { nombreNormalizadaAula: { contains: "gimenez" } } } },
  ] },
  { OR: [ /* lo mismo con "matematica" */ ] },
] }
```

- **Sin acentos: mismo mecanismo que HU-B-05.** Tokens normalizados contra columnas normalizadas; no hace falta `mode: "insensitive"`. Los tres modelos ya tienen la columna (0.2), así que **no se modifica `schema.prisma`** y **no se usa** la alternativa de resolver en memoria los ids que coinciden y filtrar con `in`. Esa alternativa queda descartada: sería más código, más consultas, y la spec (§3.11) ya eligió el filtro por relaciones.
- **Turnos `PENDIENTE` sin profesor o sin aula:** con `profesorId` o `aulaId` en `null`, la rama `profesor: { is: … }` o `aula: { is: … }` simplemente no coincide, pero el `OR` sigue evaluando las otras ramas. Un pendiente sin profesor ni aula sigue siendo encontrable por su materia. Ejemplo: "quim" encuentra `seed-turno-11` (Química, sin profesor ni aula).
- **Alumnos:** **no se busca por alumno inscripto** (1.7 punto 13). Un apellido de alumno que no coincida con profesor, materia ni aula devuelve el estado vacío (CP-18, UI-06).
- **Estados:** se incluyen los 4 estados, igual que el listado actual (spec §2.7 paso 4). Un `CANCELADO` aparece si coincide.
- **Alcance por rol:** para `PROFESOR` la búsqueda se combina con AND con su filtro actual (`profesor: { is: { usuarioId } }`): solo busca dentro de sus turnos.
- **Regla N.° 3:** filtrar por columnas de Profesor, Materia y Aula a través de las relaciones de Prisma es la **excepción documentada de solo lectura** de la spec (R5-7, §3.11). `listarTurnos()` ya lee esas relaciones (`turnoInclude`, filtro del rol `PROFESOR`). `turno.busqueda.ts` **no importa nada de `src/server/alumnos/**`** ni de otros módulos; solo `@/lib/busqueda-texto` y el tipo `Prisma`.

**Límites conocidos (no son criterios):**
- La coincidencia es **parcial también para números**: "aula 1" encuentra Aula 1, **Aula 10 y Aula 11** (13 turnos del seed), porque "1" está contenido en "10" y "11". Es consecuencia directa de "coincidencia parcial" (criterio 1), igual que el DNI parcial de HU-B-05. "aula 2" no tiene ese problema con el seed (el único otro nombre con "2" es Aula 12, inactiva y sin turnos).
- Un token de 1 carácter dentro de una búsqueda más larga (el "2" de "aula 2") **sí** filtra: el umbral de 2 caracteres es sobre el texto completo, igual que en HU-B-05.
- Fragmentos muy cortos coinciden con mucho: "ro" da 14 de 25 turnos (Rossi, Castro, Programación, Laboratorio). No hay orden por relevancia (spec §2.7 paso 4: mismo orden que el listado).

### 1.3. 0 o 1 carácter

Con el campo vacío, solo espacios o 1 carácter tras el `trim`, **no se filtra**: se muestra el listado completo en la página 1, con el orden original (criterio 5, spec §2.7 paso 1). Se cumple en los dos lados:
- **Cliente:** no manda `q` y pide `pagina=1`.
- **Servidor:** si igual llega un `q` de 1 carácter (por ejemplo, escrito a mano en la URL), `construirFiltroBusquedaTurno()` devuelve `undefined` y se lista sin filtro. No es un error `400`.

### 1.4. Actualización sin recargar, espera y URL

Mismo patrón que `listado-alumnos.tsx` (HU-B-05 §1.4 y §9.1), adaptado a que este listado trae los datos desde el cliente:

- **Espera (debounce) de 300 ms** desde la última tecla (spec §2.7 paso 6).
- **Al escribir (criterio 3):** se llama a `GET /api/turnos?q=…&pagina=1` y se reemplazan solo las filas, el contador y el paginador. El input no se deshabilita ni pierde el foco.
- **Respuestas viejas:** se descartan con `AbortController`, como en `listado-alumnos.tsx`. Solo cuenta la respuesta del texto vigente. Lo mismo para las consultas de cambio de página y de `pageshow` / `visibilitychange`.
- **Término en la URL: sí, con `window.history.replaceState`.** Formato: `/turnos?q=<texto>&pagina=<n>&orden=fecha_hora_asc`, **siempre con `pagina` y `orden`** (a diferencia de Alumnos, que omite la página 1) porque es el formato de `retorno` que ya usan el listado, sus tests y los pasos de un turno pendiente (`[id]/configuracion` y `[id]/participantes` solo aceptan un `volver` que empiece con `/turnos?`). Sin `q` cuando no hay búsqueda. Se usa `replaceState` y no `pushState` para no sumar una entrada al historial por cada tecla.
- **"Volver al listado" desde el detalle:** el listado arma `retorno` con `q` y `pagina`; `turno-detalle.tsx` ya usa `volver` tal cual. **No se toca `/turnos/[id]`.** Si al probar resultara que no alcanza (por ejemplo, algún paso intermedio pierde `q`), no se corrige ahí: se anota como pendiente para coordinar con Tomás (1.8).
- **Al cambiar de página:** el paginador inline sigue siendo de `<Link>` (no se cambia su aspecto). Su `href` pasa a incluir `q`: `/turnos?q=…&pagina=N&orden=fecha_hora_asc`. Es una navegación del lado del cliente de Next: `page.tsx` vuelve a renderizar con los `searchParams` nuevos, **sin `key`**, y `TurnosListado` consulta la página nueva manteniendo visibles las filas anteriores.
- **Primer render desde la URL:** `page.tsx` lee `q` y `pagina` de `searchParams` y se los pasa a `TurnosListado`, que carga la página pedida ya filtrada y precarga el texto en el input.

**Anti-parpadeo (el mismo de HU-B-05 §9.1):**
- Mientras llega una respuesta (búsqueda, cambio de página o `visibilitychange`), la tabla sigue mostrando las filas anteriores, sin desmontarse, atenuarse ni cambiar de alto, y las filas se reemplazan directo al llegar.
- **"Cargando turnos" solo en la carga inicial** (cuando todavía no hay datos). Hoy aparece en cada consulta, incluido el regreso a la pestaña: eso cambia.
- Si la respuesta tarda **más de 300 ms**, la lupa del input se reemplaza por un `Loader2` que gira (mismo tamaño y lugar, `text-muted-foreground`) y se agrega un `role="status"` oculto ("Buscando turnos").
- **Sin `key` cambiante:** se saca `key={paginaActual}` de `page.tsx`.

### 1.5. `listarTurnos()` recibe la búsqueda como un filtro más

Hoy la firma es posicional: `listarTurnos(pagina, porPaginaSolicitado, usuario)`. **Decisión:** se agrega un cuarto parámetro opcional con los filtros, y cada filtro se suma con AND al `where` base:

```typescript
export type FiltrosListadoTurnos = { q?: string };

export async function listarTurnos(
  pagina: number,
  porPaginaSolicitado: number | undefined,
  usuario: { id: string; rol: RolUsuario },
  filtros: FiltrosListadoTurnos = {},
)
```

- `where = { fechaTurno: { gte: inicioHoy }, ...filtroDelRol, ...(condiciones.length ? { AND: condiciones } : {}) }`, con `condiciones = [construirFiltroBusquedaTurno(filtros.q)]` sin los `undefined`.
- **Sin búsqueda el `where` queda idéntico al de hoy**, así el test de HU-C-01 que compara el `where` exacto sigue pasando y el comportamiento no cambia para ningún otro llamador.
- Así HU-C-08 (Tomás) suma `profesor_id` agregando un campo a `FiltrosListadoTurnos` y una condición más a la lista, **sin reescribir la función ni cambiar su firma** (1.8).
- No se cambia a un objeto único de parámetros (`listarTurnos({ pagina, … })`) para no tocar la llamada de los tests de HU-C-01 más de lo necesario ni pisar el trabajo de otros sobre `turno.service.ts`.

### 1.6. Rendimiento

`contains` sobre columnas sin índice de texto recorre la tabla (con `JOIN` a profesores, materias y aulas). Sin la rama de alumnos ya no hay un `EXISTS` sobre `turno_alumno` por token. Con 25 turnos futuros en el seed (y los cientos esperables en el centro) no afecta. Un índice trigram (`pg_trgm`) queda fuera de alcance, igual que en HU-B-05. Como hay como máximo 5 tokens, el `where` tiene como máximo 5 × 3 ramas.

### 1.7. Decisiones tomadas (29/09/2026, confirmadas por el responsable antes de implementar)

1. **SP: 1.** Dato de la planilla del Sprint 2. `HU-Sprint-2.md` §7 dice 2 SP; si corresponde, se reestima en el Planning.
2. **Paginador:** no se toca `src/components/shared/pagination.tsx` (el listado de turnos ni siquiera lo usa: tiene su paginador inline). Del paginador inline solo cambia el `href` (suma `q`). El pie "Mostrando X–Y de N" de DESIGN §8.1 sigue como **deuda técnica**, la misma de HU-B-05.
3. **"Ir a hoy": no se agrega.** No existe en el código, el listado ya empieza en hoy y la HU no lo pide. Queda anotado en 1.1 qué tiene que respetar si alguien lo agrega. **Columnas, su orden y el botón "Configurar turno" se mantienen como en el código actual**, no como en la pantalla.
4. **Subtítulo:** primera línea, "Buscá por profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes)." (el de la pantalla, sin "alumno", punto 13); segunda línea, se conserva "Desde hoy · Orden: fecha y hora ascendente, luego profesor". **La búsqueda mantiene exactamente el mismo alcance de fechas que el listado actual (`fechaTurno >= hoy`)**: no la amplía a turnos pasados.
5. **Tamaño de página: 10** (`paginacion_limite_default` del seed, como hoy). Llevarlo a 20 (DESIGN §8.1, spec §2.7 `por_pagina` default 20) cambia HU-C-01 y no es parte de la búsqueda. **Deuda técnica** anotada.
6. **`q` se declara en `ListarTurnosQuerySchema`** (string opcional, `trim`, máx. 100). El `.strict()` y `profesor_id` de la spec §2.7 quedan para HU-C-08, que es la que necesita rechazar `materia_id`, `estados` y `solo_futuros` (ver 1.8). Así no se rompe ninguna llamada existente en esta HU.
7. **Código del 400: se deja `VALIDACION`** (misma decisión y misma deuda que HU-B-05 1.7 punto 7).
8. **Error de red al buscar:** se reutiliza el aviso que ya tiene el listado (el mensaje + `Button` `outline` "Reintentar"); "Reintentar" repite la consulta vigente (con `q` y página). No se agrega texto nuevo.
9. **Vacío con búsqueda:** "No se encontraron turnos para «{q}»", con el `q` recortado (criterio 4). Vacío sin búsqueda: el "No hay turnos registrados" de siempre.
10. **Criterio 2 (reformulado por el punto 13):** un valor que coincide con más de un campo (profesor y materia, o materia y aula) devuelve los turnos que coinciden en cualquiera de ellos. **En el seed no hay ninguna palabra completa que lo cumpla** (anotado). Se usa el **fragmento parcial "ato"**, que coincide con la materia "Bases de Datos" y con el aula "Laboratorio": devuelve 7 turnos, 4 de Bases de Datos (06, 08, 24, 12) y 3 en Laboratorio (04, 13, 19) (CP-11).
11. **Sin render del servidor:** el listado sigue trayendo los datos desde el cliente. Al sacar la `key` de `page.tsx`, el cambio de página llega por props y el componente consulta la página nueva con el mismo `AbortController` que la búsqueda, así las respuestas viejas se descartan también al paginar (test de componente y UI-15). Hay que verificar que el cambio de página siga trayendo los datos de la página pedida.
12. **Reutilización de HU-B-05:** el campo de búsqueda (lupa, `Loader2` que la reemplaza, `role="status"` oculto) y las constantes de espera se extraen de `listado-alumnos.tsx` a `src/components/shared/campo-busqueda.tsx`, que usan los dos listados. `listado-alumnos.tsx` no cambia de comportamiento (sus tests siguen pasando sin modificarse).
13. **Sin búsqueda por alumno.** Se quita la búsqueda por alumno respecto de la planilla del Sprint 2 (decisión del equipo, 29/09/2026). `construirFiltroBusquedaTurno()` no tiene la rama sobre alumnos inscriptos: cada palabra coincide con profesor, materia o aula (AND entre palabras, OR entre campos). El ejemplo "Ana" del criterio 2 deja de aplicar. Subtítulo y placeholder sin mención a alumnos. Esto se aparta de la spec C §2.7 paso 3, que incluye alumnos: **la spec no se modifica en esta task**, queda pendiente alinearla (1.8).

### 1.8. Coordinación con otras HU

| HU | Responsable | Qué comparte | Acuerdo |
|---|---|---|---|
| HU-C-08 (Consultar turnos asociados al profesor) | Tomás | `listarTurnos()`, `ListarTurnosQuerySchema`, `turnos-listado.tsx` | Suma `profesor_id` como **otro filtro** en `FiltrosListadoTurnos` y otra condición en la lista del AND (1.5); agrega `.strict()` al schema (1.7 punto 6). Su selector de profesor tiene que volver a la página 1 y conservar `q`, y la búsqueda tiene que conservar `profesor_id` (DESIGN §8.1). El helper de URL de 4.2 está pensado para que sume `profesor_id` |
| HU-C-09 (Consultar detalles del turno) | Tomás | `/turnos/[id]`, `turno-detalle.tsx`, `presentar()` | Esta HU **no toca** `/turnos/[id]` ni `presentar()`. **Pendiente de verificar:** que "Volver al listado" conserve `q` y `pagina` con el `volver` que arma el listado (1.4). Si no alcanza, se coordina con Tomás, no se corrige desde esta HU |
| HU-C-10 (Asignar prioridad) | — | `presentar()`, columnas del listado | La columna Prioridad de la pantalla es de HU-C-10. Esta HU no la agrega |
| HU-C-18 (Reordenar el flujo de registro) | Emir | `turno.service.ts`, `turno.schema.ts`, `/turnos/nuevo` | Esta HU solo toca `listarTurnos()` y `ListarTurnosQuerySchema`. No toca `configurarTurno()`, `ConfigurarTurnoSchema` ni el wizard. Avisar a Emir antes del PR por posibles conflictos de merge en esos dos archivos |
| `turno.publico.ts` | Tomás | Servicios públicos del módulo | Sin cambios. La búsqueda no se expone como servicio público |
| `spec_modulo_C.md` §2.7 y §3.11 | Scrum Master | Campos de la búsqueda | La spec todavía lista a los alumnos inscriptos entre los campos (§2.7 paso 3) y en la excepción a la Regla N.° 3 (§3.11). Hay que alinearla con 1.7 punto 13; esta task no la toca |

### 1.9. Dudas (resueltas el 29/09/2026)

- **Subtítulo:** resuelto en 1.7 punto 4 (dos líneas).
- **Ejemplo "Ana" del criterio 2:** deja de aplicar con el cambio de alcance (1.7 punto 13). No hay en el seed una palabra completa que coincida con más de un campo; se usa el fragmento "ato" (1.7 punto 10).
- **Placeholder:** "mendez" se reemplaza por "gimenez", apellido de una profesora con turnos.

**Fuera de alcance de esta historia** (textual del backlog, criterio 6): filtros combinados por estado, rango de fechas u otro criterio adicional.

**Fuera de alcance de esta task (adicional):** filtro por profesor (HU-C-08), columna Prioridad (HU-C-10), botón "Ir a hoy", cambio de "Configurar turno" a "Nuevo turno", tamaño de página 20, pie "Mostrando X–Y de N", búsqueda por alumno (nombre, apellido o DNI), código de materia o email, orden por relevancia, índices de base de datos, `pagination.tsx`, `schema.prisma`, `seed.ts`, `/turnos/nuevo`, `/turnos/[id]/**`, `turno.publico.ts`.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** buscar turnos por profesor, materia o aula desde el listado
**Para** encontrar un turno puntual sin recorrer todo el listado

> La planilla dice "por alumno, profesor, materia o aula". Se quita la búsqueda por alumno respecto de la planilla del Sprint 2 (decisión del equipo, 29/09/2026).

**SP estimado:** 1 (planilla del Sprint 2; `HU-Sprint-2.md` dice 2, se reestima en el Planning si corresponde)
**Dependencias:** HU-C-01 (extiende el mismo listado; ya implementada). Reutiliza el criterio y el patrón de HU-B-05 (ya mergeada, PR #123). HU-C-08 se apoya en el mismo punto de extensión (1.5).

### 2.1. Criterios de aceptación y cómo se cumple cada uno

| # | Criterio | Cómo se cumple | Estado (29/09) |
|---|---|---|---|
| 1 | El listado incorpora un campo de búsqueda que **filtra por nombre/apellido de profesor, nombre de materia o nombre/número de aula**; desde 2 caracteres; parcial, sin mayúsculas ni acentos, mismo criterio que HU-B-05. *Decisión: se quita la búsqueda por alumno respecto de la planilla del Sprint 2 (decisión del equipo, 29/09/2026).* | Input nuevo en `/turnos`; `q` → `construirFiltroBusquedaTurno()` con `tokenizarBusqueda()` de `src/lib/busqueda-texto.ts` y `contains` sobre las columnas normalizadas de profesor, materia y aula (1.2, 1.3) | ✅ Tests + CP-02 a CP-10 y CP-18 contra la base; falta UI-01 y UI-06 en el navegador |
| 2 | Un valor que coincide con más de un campo (por ejemplo, profesor y materia, o materia y aula) devuelve los turnos que coinciden en cualquiera de ellos | OR entre campos por cada token (1.2). No hay palabra completa en el seed que lo cumpla; se prueba con el fragmento "ato" (Bases de Datos + Laboratorio, 1.7 punto 10) | ✅ Test unitario ("ato") + CP-11 contra la base |
| 3 | Sin recargar; se combina con la paginación (vuelve a la página 1); mismo formato de fila | Client Component con `fetch` a la API y espera de 300 ms; cada cambio de texto pide `pagina=1`; `count` y `findMany` con el mismo `where`; el paginador conserva `q`; la fila no cambia (1.1, 1.4, sección 5) | ✅ Tests de servicio y de componente + CP-24 contra la base; falta UI-02 a UI-04, UI-11, UI-12 y UI-15 en el navegador |
| 4 | "No se encontraron turnos para «texto buscado»" | Estado vacío con `q` válido; el texto es el `q` recortado (1.7 punto 9) | ✅ Test de componente + CP-18 y CP-23 contra la base; falta UI-05 y UI-06 |
| 5 | Al borrar, listado completo con el orden original (fecha/hora ascendente) | Menos de 2 caracteres → sin `q`, `pagina=1`; el `orderBy` no cambia (1.3) | ✅ Tests (`where` y `orderBy` idénticos sin `q`) + CP-01 y CP-20 contra la base; falta UI-07 |
| 6 | Sin filtros combinados | Fuera de alcance (1.9) | ✅ No se agregó ningún filtro extra |

---

## 3. Alcance de esta task

Implementación backend + frontend conforme a `spec_modulo_C.md` §2.7 (solo la parte de `q`). Incluye:

- Schema Zod: parámetro `q` en `ListarTurnosQuerySchema`.
- Helper de dominio `src/server/turnos/turno.busqueda.ts` (`construirFiltroBusquedaTurno`), análogo a `construirFiltroBusquedaAlumno`.
- Servicio: `listarTurnos()` recibe los filtros y aplica la búsqueda con AND (1.5).
- Route Handler: pasa `q` al servicio.
- UI: buscador en `/turnos` con actualización sin recarga, término en la URL, contador, estados vacío, de carga y de error, sin parpadeo.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo indicado en la sección 1.

### Archivos a tocar

**Nuevos:**

| Archivo | Contenido |
|---|---|
| `src/server/turnos/turno.busqueda.ts` | `construirFiltroBusquedaTurno(q): Prisma.TurnoWhereInput \| undefined`, con OR sobre profesor, materia y aula (sin alumnos). Solo importa `@/lib/busqueda-texto` y el tipo `Prisma` |
| `src/server/turnos/turno.busqueda.test.ts` | Tests unitarios del filtro |
| `src/lib/turno-listado.ts` | `urlListadoTurnos({ q, pagina })`: URL del listado compartida por `replaceState`, el paginador y el `retorno` de las filas |
| `src/lib/turno-listado.test.ts` | Tests del armado de la URL |
| `src/components/shared/campo-busqueda.tsx` | `CampoBusqueda` (input con lupa, `Loader2` y `role="status"` oculto) y las constantes `ESPERA_BUSQUEDA_MS` / `ESPERA_AVISO_CARGA_MS`, extraídos de `listado-alumnos.tsx` (1.7 punto 12) |

**Existentes a modificar:**

| Archivo | Cambio |
|---|---|
| `src/app/(dashboard)/alumnos/listado-alumnos.tsx` | Usa `CampoBusqueda` y reexporta las dos constantes; mismo markup y comportamiento (sus 11 tests pasan sin cambios) |
| `src/server/turnos/turno.schema.ts` | Agregar `q: z.string().trim().max(100).optional()` a `ListarTurnosQuerySchema`. Nada más en ese archivo |
| `src/server/turnos/turno.service.ts` | `listarTurnos()` con el cuarto parámetro `filtros` y el AND de condiciones (1.5); tipo `FiltrosListadoTurnos`. Nada más en ese archivo |
| `src/app/api/turnos/route.ts` | `GET`: pasar `{ q: parsed.data.q }` como cuarto argumento. El `POST` no cambia |
| `src/server/turnos/turno.listado.test.ts` | Casos nuevos con `q` (sección 6); los de HU-C-01 siguen pasando sin cambios |
| `src/app/(dashboard)/turnos/page.tsx` | Leer `q`; pasar `q` y `pagina` a `TurnosListado`; **sacar `key={paginaActual}`** |
| `docs/tasks/Sprint 2/HU-C-02.md` | Esta task |
| `src/app/(dashboard)/turnos/turnos-listado.tsx` | Subtítulo, buscador, contador, espera de 300 ms, `AbortController`, `replaceState`, anti-parpadeo, vacío con búsqueda, `href` y `retorno` con `q` (sección 5) |
| `src/app/(dashboard)/turnos/turnos-listado.test.tsx` | Adaptar las llamadas esperadas a `fetch` (ahora con `signal`) y la expectativa de "Cargando turnos" en `visibilitychange`; casos nuevos de búsqueda. **No se toca** el caso de `TurnoDetalleVista` |

**Sin cambios de código:** `src/lib/busqueda-texto.ts`, `src/lib/normalizar-texto.ts`, `src/app/(dashboard)/turnos/turno.types.ts` (`TurnosData` ya sirve; `urlContinuar(turno, retorno)` recibe el `retorno` ya armado con `q`).

**No se tocan:** `prisma/schema.prisma`, migraciones, `prisma/seed.ts`, `src/components/shared/pagination.tsx`, `src/server/turnos/turno.publico.ts`, `src/app/(dashboard)/turnos/[id]/**`, `src/app/(dashboard)/turnos/nuevo/**`, `src/server/alumnos/**`, `configurarTurno()` y `ConfigurarTurnoSchema`.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/turnos/turno.schema.ts`

```typescript
export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).optional(), // sin cambios (1.7 punto 5)
  q: z.string().trim().max(100).optional(), // HU-C-02
  // profesor_id y .strict(): HU-C-08 (1.7 punto 6)
});
```

### 4.2. Servicio

**`src/lib/busqueda-texto.ts`:** se usa tal cual (`tokenizarBusqueda`, `terminoBusqueda`, `MIN_CARACTERES_BUSQUEDA = 2`, `MAX_TOKENS_BUSQUEDA = 5`).

**`src/server/turnos/turno.busqueda.ts`:**

```typescript
export function construirFiltroBusquedaTurno(q: string | undefined): Prisma.TurnoWhereInput | undefined;
```

- Si `tokenizarBusqueda(q)` devuelve `null` → `undefined` (sin filtro).
- Si hay tokens → `{ AND: tokens.map((t) => ({ OR: [profesor.is(apellido|nombre contains t), materia.is(nombreNormalizadaMateria contains t), aula.is(nombreNormalizadaAula contains t)] })) }` (forma completa en 1.2). **Sin rama sobre `alumnos`** (1.7 punto 13).

**`listarTurnos(pagina, porPaginaSolicitado, usuario, filtros = {})`** (`turno.service.ts`):
1. Tamaño de página y `inicioHoy`: sin cambios.
2. `const condiciones = [construirFiltroBusquedaTurno(filtros.q)].filter((c) => c !== undefined)`.
3. `where = { fechaTurno: { gte: inicioHoy }, ...(PROFESOR ? { profesor: { is: { usuarioId } } } : {}), ...(condiciones.length ? { AND: condiciones } : {}) }`. **Sin `q`, idéntico al de hoy.**
4. `prisma.turno.count({ where })` → `total` **filtrado**. La página se acota con ese total, igual que antes (con `total === 0` queda en la página 1).
5. `prisma.turno.findMany({ where, include: turnoInclude, orderBy: <el mismo de antes>, skip, take })`.
6. Misma forma de respuesta: `{ items: presentar[], paginacion: { total, pagina_actual, total_paginas, por_pagina } }`.

**`src/lib/turno-listado.ts`** (puro):

```typescript
/** "/turnos?q=…&pagina=N&orden=fecha_hora_asc"; sin q cuando no hay búsqueda. */
export function urlListadoTurnos({ q, pagina }: { q?: string; pagina: number }): string;
```

Siempre incluye `pagina` y `orden=fecha_hora_asc` (1.4), para que el `retorno` empiece con `/turnos?` y lo acepten `[id]/configuracion` y `[id]/participantes`. HU-C-08 le suma `profesor_id`.

**Errores de servicio:** ninguno nuevo.

### 4.3. Route Handlers

**Archivo:** `src/app/api/turnos/route.ts`, `GET`, `withPermission("turnos:leer")`.

```typescript
const data = await listarTurnos(parsed.data.pagina, parsed.data.por_pagina, req.auth!.user, { q: parsed.data.q });
```

- `200 OK`: misma forma de §2.4 (`items` + `paginacion`), sobre el resultado filtrado. Sin coincidencias: `items: []`, `total: 0`.
- `400 VALIDACION` (código real del proyecto): `q` de más de 100 caracteres, `por_pagina` mayor a 20, `pagina` inválida. Un `q` de 1 carácter **no** es error.
- `401` sin sesión · `403` sin `turnos:leer` (por ejemplo, un `ALUMNO`).

### 4.4. Server Action

No aplica. Es de solo lectura y el listado ya consume el Route Handler (spec §2.7: "solo Route Handler").

### 4.5. Eventos de dominio

No aplica. Es de solo lectura: no escribe en `EventoTurno`.

---

## 5. Frontend

**`/turnos`, el mismo listado de HU-C-01** (no hay pantalla ni modal nuevo; `mapa-pantallas-sprint-2.md` §1, fila "Listado de turnos (`/turnos`) — HU-C-02": "Barra de búsqueda sobre el mismo listado"; pantalla de referencia 01 "Turnos — listado").

- **Encabezado:** título "Turnos" y subtítulo en dos líneas en `text-muted-foreground`: "Buscá por profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes)." y "Desde hoy · Orden: fecha y hora ascendente, luego profesor" (1.7 punto 4). "Configurar turno" se queda como está, arriba a la derecha, solo para `MESA_ENTRADA` (0.4).
- **Buscador:** `Input` de shadcn de ancho completo, ícono `Search` de `lucide-react` a la izquierda, placeholder "Ej.: matematica, aula 2, gimenez…" (sin nombre de alumno; Giménez es profesora del seed), `aria-label="Buscar turno"`, `type="search"`, `autoComplete="off"`, `maxLength={100}`, `className="pl-9"`. Valor inicial: el `q` de la URL. Misma estructura que el de `listado-alumnos.tsx`.
- **Contador:** "N turnos" arriba de la tabla (singular: "1 turno"), con `paginacion.total` del resultado filtrado, en `text-sm text-muted-foreground`. No se muestra en el estado vacío.
- **`page.tsx`:** lee `q` y `pagina` de `searchParams`; renderiza `<TurnosListado pagina={paginaActual} q={q ?? ""} orden="fecha_hora_asc" puedeConfigurar={…} />` **sin `key`**.
- **`turnos-listado.tsx` (Client Component):**
  - Constantes `ESPERA_BUSQUEDA_MS = 300` y `ESPERA_AVISO_CARGA_MS = 300`, como en `listado-alumnos.tsx`.
  - **Carga inicial:** con los `pagina` y `q` recibidos. Mientras no hay datos: "Cargando turnos" (el `role="status"` actual).
  - **Al cambiar el texto:** espera de 300 ms → `q` efectivo con `terminoBusqueda()` → si es distinto del `q` de los datos en pantalla, `fetchAutenticado("/api/turnos?pagina=1[&q=…]", { cache: "no-store", signal })` → reemplaza filas, contador y paginador → `window.history.replaceState(null, "", urlListadoTurnos({ q, pagina: 1 }))`.
  - Si el texto cambia pero el `q` efectivo es el mismo (por ejemplo, "ab" → "ab "), no vuelve a pedir.
  - **Cambio de página por el paginador:** llegan `pagina` y `q` nuevos por props (navegación de Next) → consulta esa página manteniendo las filas anteriores visibles.
  - **`pageshow` / `visibilitychange`:** se mantienen, con el `q` y la página vigentes, y ahora **sin** mostrar "Cargando turnos" (anti-parpadeo, 1.4).
  - **Respuestas viejas:** `AbortController`; una consulta nueva cancela la anterior.
  - **Aviso de carga lenta:** si tarda más de 300 ms, `Loader2` con `animate-spin` en el lugar de la lupa + `<span role="status" className="sr-only">Buscando turnos</span>`. La tabla lleva `aria-busy` mientras tanto.
  - **Fila:** **la misma** de HU-C-01 (columnas, `EstadoTurnoBadge`, "Ver detalle", "Continuar configuración" para `PENDIENTE`). Solo cambia el `retorno` que se pasa a `?volver=` y a `urlContinuar()`: `urlListadoTurnos({ q: q de los datos, pagina: pagina_actual })`.
  - **Paginador inline:** mismo aspecto; `href` de "Anterior"/"Siguiente" con `urlListadoTurnos({ q, pagina: n })`. El texto "Página X de Y · N turnos" no cambia.
  - **Vacío con búsqueda:** "No se encontraron turnos para «{q}»". **Vacío sin búsqueda:** "No hay turnos registrados".
  - **Error:** el aviso actual (mensaje + "Reintentar"); "Reintentar" repite la consulta vigente.
- **`/turnos/[id]`:** sin cambios. "Volver al listado" recibe el `retorno` con `q` y `pagina` (1.4, 1.8).
- Seguir `docs/DESIGN.md`: solo tokens, sin colores a mano. No se suma ninguna librería.

**Fuera de alcance de frontend:** filtros, selector de profesor (HU-C-08), columna Prioridad (HU-C-10), "Ir a hoy" y rediseño de la paginación (1.7).

---

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios (`npm test`)

`src/server/turnos/turno.busqueda.test.ts`:
- `undefined`, `""`, `"   "`, `"a"` → `undefined`.
- `"quim"` → `AND` con un `OR` de **3 ramas**: `profesor.is`, `materia.is`, `aula.is`, todas con `contains: "quim"`. **Ninguna rama sobre `alumnos`.**
- `"MATEMÁTICA"` → el token es `"matematica"`.
- `"gimenez matematica"` → `AND` de 2 `OR`, uno por token.
- `"ato"` sobre datos de prueba → encuentra el turno por materia y el turno por aula (criterio 2).
- Un apellido que solo tiene un alumno inscripto (por ejemplo, `"fernandez"`) → no encuentra ese turno.
- 6 palabras → `AND` de 5.
- El archivo no importa nada de `src/server/alumnos/**` (revisión de imports).

`src/lib/turno-listado.test.ts`: sin `q` → `/turnos?pagina=1&orden=fecha_hora_asc`; con `q` y página 3 → ambos; `q` con espacios y tildes → codificado; siempre empieza con `/turnos?`.

`src/server/turnos/turno.listado.test.ts` (`prisma` mockeado; los 3 casos de HU-C-01 siguen pasando):
- Sin filtros, con `{}` y con `q` de 1 carácter: `count` recibe **exactamente** `{ where: { fechaTurno: { gte } } }`, como hoy.
- Con `q`: `count` y `findMany` reciben **el mismo** `where`, con el `AND` de la búsqueda; `orderBy` sin cambios; `total` y `total_paginas` salen del conteo filtrado.
- Rol `PROFESOR` con `q`: el `where` tiene el filtro del rol **y** el `AND` de la búsqueda.
- Filtrado con 0 resultados → `items: []`, `pagina_actual: 1`, `total_paginas: 0`.
- Página pedida mayor a la última del filtrado → se acota a la última.

`src/app/(dashboard)/turnos/turnos-listado.test.tsx` (jsdom, timers falsos para la espera):
- Una sola petición tras 300 ms con `pagina=1&q=…`; 1 carácter no pide con `q`.
- Respuesta vieja descartada al buscar: escribir "gim" y enseguida "gimenez fisica" → solo se aplica la última.
- **Paginar sin `key`:** al recibir `pagina` nueva por props se consulta esa página (con el `q` vigente), la tabla y el input no se remontan, no aparece "Cargando turnos" y, si llegan dos cambios de página seguidos, la respuesta del primero se descarta.
- La URL pasa a `/turnos?q=…&pagina=1&orden=fecha_hora_asc` con `replaceState`.
- La tabla es el mismo nodo del DOM antes, durante y después de una búsqueda; sin "Cargando turnos" después de la carga inicial (también en `visibilitychange`).
- El spinner no aparece antes de 300 ms de espera, aparece después y se va al llegar la respuesta.
- Vacío con búsqueda: "No se encontraron turnos para «mendez»".
- Placeholder "Ej.: matematica, aula 2, gimenez…" y subtítulo sin "alumno".
- Los `href` de "Ver detalle", "Continuar configuración" y del paginador llevan `q`.
- Contador "N turnos" con el total filtrado.
- Los casos de HU-C-01 que siguen valiendo pasan con la llamada a `fetch` actualizada (ahora con `signal`).

### Nivel 2 — Postman / curl y navegador: casos con datos del seed

Precondición: `npx prisma db seed` corrido **el mismo día**; sesión `mesa.entrada@noctium.local` / `Password123!` salvo que se indique otra. Los resultados son ids `seed-turno-XX` en el orden del listado (tabla de 0.3). Con el tamaño de página actual (10).

| # | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-01 | Sin búsqueda | `GET /api/turnos` | `200`, `total: 25`, 3 páginas; primera fila `01` |
| CP-02 | Profesor por apellido | `q=rossi` | 7: 02, 06, 08, 15, 20, 24, 12 |
| CP-03 | Profesor por nombre; `CANCELADO` incluido | `q=julian` | 2: **09 (Cancelado)**, 19 |
| CP-04 | Profesor con y sin ñ | `q=acuña` y `q=acuna` | Los dos: 3: 03, 13, 22 |
| CP-05 | Profesor en mayúsculas con tilde | `q=GIMÉNEZ` / `q=gimenez` | Los dos: 7: 01, 05, 07, 10, 14, 17, 23 |
| CP-06 | Materia, con y sin tilde | `q=matematica` / `q=Matemática` / `q=MATEMÁTICA` | Los tres: 5: 01, 09, 10, 17, 21 |
| CP-07 | Aula por número | `q=aula 2` | 6: 02, 05, 09, 14, 20, 12 |
| CP-08 | Aula, palabras invertidas | `q=2 aula` | Igual que CP-07 |
| CP-09 | Aula, coincidencia parcial del número | `q=aula 1` | 13: incluye Aula 1, Aula 10 y Aula 11 (límite conocido, 1.2) |
| CP-10 | Aula por nombre | `q=laboratorio` | 3: 04, 13, 19 |
| CP-11 | **Criterio 2:** un valor que coincide con más de un campo | `q=ato` | 7: 06, 04, 08, 13, 19, 24, 12 (materia "Bases de Datos": 06, 08, 24, 12; aula "Laboratorio": 04, 13, 19). Fragmento parcial: no hay palabra completa en el seed que coincida con dos campos (1.7 punto 10) |
| CP-12 | Profesor + materia, en cualquier orden | `q=gimenez matematica` / `q=matematica gimenez` | Los dos: 3: 01, 10, 17 |
| CP-13 | Profesor + materia, con y sin tilde | `q=acuña ingles` / `q=ingles acuna` | Los dos: 2: 03, 22 |
| CP-14 | Profesor + aula | `q=rossi aula 2` | 3: 02, 20, 12 |
| CP-15 | Palabras que no coinciden en el mismo turno | `q=rossi fisica` | 0 (Rossi no da Física): AND entre palabras |
| CP-16 | Turno `PENDIENTE` sin profesor ni aula | `q=quim` | 3: 04, **11 (Pendiente)**, 16 |
| CP-17 | Otros `PENDIENTE` | `q=program` / `q=ingles` | 5: 02, 13, 15, 20, **25 (Pendiente)** / 3: 03, **18 (Pendiente)**, 22 |
| CP-18 | **Nombre o apellido de alumno: no busca por alumno** | `q=muñoz` / `q=sofia` | `200`, `items: []`, `total: 0`. Ezequiel Muñoz está inscripto en 16 y 22, y Sofía Fernández en 6 turnos, pero no coinciden con profesor, materia ni aula. En la UI: "No se encontraron turnos para «muñoz»" |
| CP-19 | Apellido compartido por alumna y profesor | `q=castro` | 2: 09 (Cancelado), 19: solo los del profesor Julián Castro; **no** 04 ni 20, donde está inscripta la alumna Florencia Castro |
| CP-20 | 1 carácter | `q=a` | Listado completo: `total: 25`, sin `400` |
| CP-21 | Espacios | `q=%20%20rossi%20%20` | Igual que CP-02 |
| CP-22 | Más de 5 palabras | `q=matematica aula 1 gimenez laura x` | 3: 01, 10, 17 ("x" se ignora; si se tuviera en cuenta daría 0) |
| CP-23 | Sin resultados | `q=mendez` / `q=juan perez` (profesores sin turnos) | `200`, `items: []`, `total: 0` |
| CP-24 | Paginación del filtrado | `q=aula` | `total: 19`, `total_paginas: 2`; `pagina=2` trae 9 filas |
| CP-25 | Rol Profesor | Sesión `profesor1@noctium.local`, `q=fisica` | 4: 05, 07, 14, 23 (sus turnos de Física; **no** 19, que es de Castro) |
| CP-26 | `q` demasiado largo | `q` de 101 caracteres | `400 VALIDACION` |
| CP-27 | Sin permiso / sin sesión | Sesión `alumno01@noctium.local` / sin cookie | `403` / `401` |

En el navegador (`/turnos`), con la misma sesión:

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| UI-01 | Umbral | Escribir "r" | No filtra; sigue el listado completo |
| UI-02 | Sin recarga | Escribir "rossi" | Tras ~300 ms, "7 turnos" y 7 filas; el input no pierde el foco; la URL pasa a `/turnos?q=rossi&pagina=1&orden=fecha_hora_asc` sin recargar |
| UI-03 | Vuelve a página 1 | Ir a la página 2 sin buscar y escribir "aula" | Página 1 de 2, "19 turnos" |
| UI-04 | Paginación con búsqueda | Con "aula", tocar "Siguiente" | Página 2 de 2 con las 9 filas que corresponden; URL `/turnos?q=aula&pagina=2&orden=fecha_hora_asc`; el input conserva "aula"; la tabla no muestra "Cargando turnos" |
| UI-05 | Sin resultados | Escribir "mendez" | "No se encontraron turnos para «mendez»" |
| UI-06 | No busca por alumno | Escribir "muñoz" | "No se encontraron turnos para «muñoz»" (Ezequiel Muñoz está inscripto en turnos, pero la búsqueda no incluye alumnos) |
| UI-07 | Borrar | Borrar todo el texto | Listado completo, página 1, "25 turnos", orden fecha/hora ascendente; URL `/turnos?pagina=1&orden=fecha_hora_asc` |
| UI-08 | Volver desde el detalle | Buscar "castro", abrir "Ver detalle" del 19 y "Volver al listado" | Vuelve a `/turnos?q=castro&pagina=1&orden=fecha_hora_asc` con los 2 resultados y el texto en el input. **Si no, se anota y se coordina con Tomás (1.8)** |
| UI-09 | Continuar un pendiente | Buscar "quim", "Continuar configuración" en el 11 y volver al listado | Vuelve con "quim" cargado |
| UI-10 | Respuestas viejas al buscar | Escribir "gim" y enseguida "gimenez fisica" | Solo se ve el último resultado (4: 05, 07, 14, 23) |
| UI-11 | Formato de fila | Comparar una fila filtrada con la misma sin filtro | Mismas columnas, badge de estado y enlaces |
| UI-12 | Sin parpadeo | Escribir y borrar caracteres de "rossi"; cambiar de pestaña y volver | La tabla no salta ni se atenúa; "Cargando turnos" no reaparece |
| UI-13 | Error de red | Con las DevTools en "Offline", escribir "rossi" | Aviso de error + "Reintentar"; al volver a "Online" y tocar "Reintentar", aparecen los 7 resultados |
| UI-14 | Rol Profesor | Sesión `profesor1@noctium.local`, escribir "fisica" | 4 turnos, todos de Giménez |
| UI-15 | Paginar rápido (respuestas viejas al paginar) | Sin búsqueda, con la red en "Slow 3G", tocar "Siguiente" dos veces seguidas | Termina en la página 3 con sus filas (la respuesta de la página 2 se descarta); mientras tanto la tabla no muestra "Cargando turnos" |

### Nivel 3 — BD / TablePlus

- Sin escrituras: después de las pruebas no cambió ninguna fila de `turnos` (`updatedAtTurno` sin cambios) ni hay filas nuevas en `eventos_turno`.
- Contrastar CP-07 con SQL: `SELECT t."idTurno" FROM turnos t JOIN aulas a ON a."idAula" = t."aulaId" WHERE a."nombreNormalizadaAula" LIKE '%aula%' AND a."nombreNormalizadaAula" LIKE '%2%' AND t."fechaTurno" >= CURRENT_DATE;` → los 6 de CP-07.

**Evidencia esperada:** salida de `npm test`, curl/Postman de la tabla CP, capturas de UI-02, UI-04, UI-05, UI-06, UI-07 y UI-08.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar; decisiones de 1.7 tomadas.
- [x] `q` agregado a `ListarTurnosQuerySchema` (máx. 100, con `trim`).
- [x] `src/lib/busqueda-texto.ts` reutilizado **sin cambios**; ninguna lógica de umbral, normalización o tokens duplicada.
- [x] `construirFiltroBusquedaTurno()` en `src/server/turnos/turno.busqueda.ts`, sin imports de `src/server/alumnos/**` ni de otros módulos.
- [x] `construirFiltroBusquedaTurno()` **sin la rama sobre alumnos inscriptos** (1.7 punto 13, 9.1); test que confirma que un apellido que solo tiene un alumno no genera coincidencias.
- [x] Subtítulo y placeholder sin mención a alumnos (9.1).
- [x] El test de HU-C-01 (`turno.listado.test.ts`, bloque "HU-C-01 listado y detalle") pasa sin cambios: el diff del archivo solo agrega líneas.
- [x] `listarTurnos()` recibe los filtros como cuarto parámetro y los combina con AND; sin `q`, el `where` es idéntico al de HU-C-01.
- [x] `count` y `findMany` con el mismo `where`: el total, las páginas y el contador son del resultado filtrado.
- [x] Turnos `PENDIENTE` sin profesor o aula encontrables por los demás campos (CP-16, CP-17).
- [x] Sin lógica de negocio en el Route Handler ni en el componente (Regla N.° 4).
- [x] UI: buscador con espera de 300 ms, sin recarga, página 1 al escribir, término en la URL con `replaceState`, contador, estados vacío, de carga y de error.
- [x] Anti-parpadeo: filas anteriores visibles, spinner solo después de 300 ms, "Cargando turnos" solo en la carga inicial, sin `key` en `page.tsx`.
- [x] Fila del listado idéntica a la de HU-C-01.
- [ ] "Volver al listado" desde el detalle conserva `q` y `pagina` sin tocar `/turnos/[id]` — el `volver` ya lleva `q` (test de componente); falta confirmarlo en el navegador (UI-08, UI-09).
- [x] `pagination.tsx`, `schema.prisma`, `seed.ts`, `turno.publico.ts`, `/turnos/nuevo` y `/turnos/[id]/**` sin cambios.
- [x] Solo tokens de `DESIGN.md`, sin colores a mano.
- [x] Ningún `DELETE` físico ni escritura en ningún punto.
- [ ] `npm test`, `npm run lint` y `tsc --noEmit` limpios ✅; `npm run build` no se corrió en esta sesión.
- [ ] Casos CP y UI de la sección 6 documentados con evidencia (CP-01 a CP-25 verificados contra la base con el alcance ajustado, sección 8; faltan CP-26/CP-27 con sesión y UI-01 a UI-15).
- [ ] Emir y Tomás avisados de los cambios en `turno.service.ts`, `turno.schema.ts` y `turnos-listado.tsx` antes del PR (1.8).
- [ ] PR con el diff acotado a esta HU.
- [ ] Verificado manualmente en el navegador antes del commit final.

---

## 8. Evidencia de implementación (Claude Code, 29/09/2026)

> La evidencia de abajo es la **final**, con el alcance ajustado de 9.1 (sin búsqueda por alumno) y la numeración actual de la sección 6.

Implementado sobre `feature/HU-C-02`, sin rama nueva ni commits.

**Verificaciones (después de 9.1):**
- `npx tsc --noEmit`: sin errores. `npm run lint`: sin errores. `npm run build`: no se corrió.
- `npm test`: 59 archivos, **787 tests pasan**, 34 omitidos (`*.pg.test.ts` y similares, sin base de prueba configurada) y 3 `todo`. De esta HU: `turno.busqueda.test.ts` (17), `turno-listado.test.ts` (3), `turno.listado.test.ts` (11: los 3 de HU-C-01 sin cambios + 8 nuevos) y `turnos-listado.test.tsx` (14: los 6 de HU-C-01 + 8 nuevos). `listado-alumnos.test.tsx` (11) pasa sin modificarse después de extraer `CampoBusqueda`.
- **Casos CP contra la base de desarrollo** (script de solo lectura que llama a `listarTurnos()` sin HTTP, borrado al terminar; la base tenía el seed del día, 25 turnos futuros): **CP-01 a CP-25 dan exactamente lo esperado en la sección 6.** Por ejemplo: "ato" → 06, 04, 08, 13, 19, 24, 12 (criterio 2); "muñoz" y "sofia" → 0 (no busca por alumno); "castro" → 09 (Cancelado), 19 (solo el profesor); "quim" → 04, 11 (Pendiente), 16; `q=aula`, página 2 → 9 filas de 19; `profesor1` + "fisica" → 05, 07, 14, 23.
- **Pendiente de verificación manual:** CP-26 y CP-27 (con sesión, vía curl/Postman) y UI-01 a UI-15 en el navegador.

**Decisiones de implementación:**
- `listarTurnos()` recibe `filtros: FiltrosListadoTurnos = {}` como cuarto parámetro; sin filtros el `where` es el mismo objeto que antes (el test de HU-C-01 con el `where` exacto sigue pasando).
- `TurnosListado` usa un estado `solicitud` (`{ q, pagina, motivo }`): la búsqueda, el paginador (props nuevas, sin `key`) y el regreso a la pestaña cambian la solicitud y una única función `cargar()` la consulta con `AbortController`. Solo `motivo: "busqueda"` actualiza la URL con `replaceState`; la navegación del paginador ya trae la URL correcta. Si el router sincroniza un `replaceState` y `page.tsx` recibe los mismos `q`/`pagina` que ya se pidieron, no se vuelve a consultar.
- El error sigue reemplazando la tabla con el aviso de HU-C-01 (mensaje + "Reintentar"), como antes; "Reintentar" repite la solicitud vigente.

## 9. Correcciones posteriores

### 9.1. Cambio de alcance: la búsqueda no incluye alumnos (29/09/2026)

**Decisión del equipo:** se quita la búsqueda por alumno respecto de la planilla del Sprint 2. La búsqueda es solo por nombre/apellido de profesor, nombre de materia y nombre/número de aula (1.7 punto 13). El criterio 2 se reformula (profesor y materia, o materia y aula) y se prueba con "ato" (1.7 punto 10).

**Cambios aplicados al código (29/09/2026):**

| Archivo | Cambio |
|---|---|
| `src/server/turnos/turno.busqueda.ts` | ✅ Se sacó la rama `{ alumnos: { some: … } }` del `OR` y se actualizó el comentario. El `OR` queda con 3 ramas: profesor, materia y aula |
| `src/server/turnos/turno.busqueda.test.ts` | ✅ Reescrito (17 tests): `OR` de 3 ramas; criterio 2 con "ato"; "fernandez" y "sofia" (solo alumnos) no coinciden; "castro" solo encuentra el turno del profesor. Los datos de prueba mantienen alumnos inscriptos y el evaluador sigue interpretando una rama de alumnos: si alguien la vuelve a agregar al filtro, estos tests fallan |
| `src/app/(dashboard)/turnos/turnos-listado.tsx` | ✅ Subtítulo "Buscá por profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes)." y placeholder "Ej.: matematica, aula 2, gimenez…" |
| `src/app/(dashboard)/turnos/turnos-listado.test.tsx` | ✅ Expectativas de subtítulo y placeholder actualizadas |

**Sin cambios:** `turno.schema.ts`, `turno.service.ts` (`listarTurnos()` y `FiltrosListadoTurnos`), `route.ts`, `page.tsx`, `src/lib/turno-listado.ts`, `campo-busqueda.tsx`, `listado-alumnos.tsx` y el resto de las decisiones de 1.7: sin "Ir a hoy"; columnas, orden y botón del código actual; página de 10 (deuda); `q` declarado en el schema, con `.strict()` para HU-C-08; mismo alcance de fechas que el listado; sin render del servidor, y respuestas viejas descartadas también al paginar.

**Verificado después del ajuste:** `tsc`, lint y tests limpios; CP-01 a CP-25 repetidos contra la base, todos correctos (sección 8).
