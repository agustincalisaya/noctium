# TASK: HU-C-27 — Ver todas las clases con filtros de período, fechas y materia

**Módulo:** C (Gestionar turnos) · **Sprint:** 3 · **SP estimado:** 5.
**Contrato de referencia:** pedido del PO del 13/10/2026 (texto literal en la sección 2) · `docs/specs/spec_modulo_C.md` §2.4 (listado), §2.7 (búsqueda y filtro por profesor), §2.16.5 (estado mostrado), §3.11 (excepción de lectura a la Regla N.° 3) · `docs/tasks/Sprint 2/HU-Sprint-2.md` (HU-C-02, criterio 6, que esta HU reemplaza) · `docs/tasks/Sprint 3/Modulo C/HU-C-19.md` (término «Clase»), `HU-C-23.md` (textos centrales), `HU-C-25.md` (criterio 5: filtrar no pide confirmación) · `src/server/pagos/caja.schema.ts:41-55` (precedente de filtro Desde–Hasta con Zod) · `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10, 11) · `docs/DESIGN.md` §8.1 (paginación) y §9 (textos).
**RBAC:** sin cambios. `turnos:leer` (Mesa de entrada, Gerente y Profesor) en `GET /api/turnos` y en la página. Sin permisos nuevos y sin cambios en el seed de permisos.
**Schema:** **con migración**: tres `@@index` nuevos en `Turno` (sección 6). Sin columnas, tablas ni enums nuevos.

> Esta task cubre **todo** el trabajo de la HU: código, base de datos, seed, documentación (spec C, mapa de pantallas, RULES, backlog de Sprint 2) y pruebas de los tres niveles. No deja nada pendiente para el Scrum Master.

---

## 0. Relevamiento previo a implementación (Claude Code)

**Reglas no negociables de `docs/RULES.md` que esta task debe cumplir** (leer el archivo completo antes de implementar):
- **Regla N.° 3**: las opciones del filtro «Materia» se leen por la fachada pública `materia.publico.ts` (L), para los tres roles. C no lee la tabla `materias` para armar el selector; L no lee la tabla `turnos` (C le pasa los ids de las materias con clases: todas para Mesa y Gerente, las del profesor para el Profesor). El filtro por `materiaId` del listado es una columna propia de `turnos`, no una lectura de otro módulo. La excepción de solo lectura de §3.11 **no se amplía** (sección 8.1, §3.11).
- **Regla N.° 4**: el cálculo de «hoy», del período, del rango y del orden vive en `turno.service.ts` (`listarTurnos`). La ruta solo valida y traduce.
- **Regla N.° 5 / N.° 6**: `GET /api/turnos` sigue respondiendo `{ data, error }`; los parámetros nuevos se validan con Zod (`ListarTurnosQuerySchema`, `.strict()`) antes del servicio. Un parámetro inválido es `400`.
- **Regla N.° 10**: sin permisos nuevos.
- **Regla N.° 11**: el código nuevo va en `src/server/turnos/`, `src/server/materias/materia.publico.ts`, `src/lib/` y `src/app/(dashboard)/turnos/`. Nada de lógica en `src/app/**`.
- **Reloj único (PR-0.md §2.2)**: «hoy» sale de `ahora()` (`src/server/shared/reloj.ts`) y de `fechaCentro`/`inicioDelDiaCentro`/`finDelDiaCentro` (`src/server/shared/fechas-centro.ts`). Ni `new Date()` ni `Intl.DateTimeFormat` dentro de `listarTurnos`.

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

- `GET /api/turnos` (`src/app/api/turnos/route.ts:7-22`): valida con `ListarTurnosQuerySchema` y llama a `listarTurnos(pagina, por_pagina, usuario, { q, profesor_id })`. Un `!success` de Zod responde `400` con `code: "VALIDACION"` (no `VALIDATION_ERROR`; los tests lo esperan así y se conserva). Traduce `SIN_PERMISO` → 403 y `PROFESOR_NO_ENCONTRADO` → 404.
- `ListarTurnosQuerySchema` (`src/server/turnos/turno.schema.ts:5-11`): `pagina`, `por_pagina` (opcional, hasta 20), `q`, `profesor_id` (CUID), `.strict()`. El comentario de la línea 9 dice que `materia_id`, `estados` y `solo_futuros` quedan fuera por HU-C-02 AC6: **esta HU lo cambia** (sección 4.1).
- `listarTurnos()` (`src/server/turnos/turno.service.ts:695-724`):
  - Líneas 698-700: calcula `inicioHoy` con `Intl.DateTimeFormat(... "America/Argentina/Buenos_Aires" ...).formatToParts(new Date())`, una tercera copia de la lógica de zona horaria, además de `fechas-centro.ts` y de `ZONA_TURNOS`/`corteLocal` (líneas 59-72).
  - Líneas 704-710: `where = { fechaTurno: { gte: inicioHoy }, ...alcanceProfesor, AND: [busqueda] }`. Es el filtro fijo «desde hoy» que esta HU reemplaza.
  - Línea 715: `include: incluirTurno(relojAhora())` (ya usa el reloj del dominio para la vigencia de los inscriptos).
  - Línea 716: orden fijo `fechaTurno asc, horaInicioTurno asc, profesorId asc nulls last, idTurno asc`.
  - `count` y `findMany` comparten el mismo `where`; una página fuera de rango se lleva a la última.
- `alcanceProfesorListado()` (`turno.service.ts:682-693`): el Profesor ve solo lo suyo y su `profesor_id` propio equivale a no enviarlo; uno ajeno da `SIN_PERMISO`. **No se toca.**
- `construirFiltroBusquedaTurno()` (`src/server/turnos/turno.busqueda.ts`): busca por apellido/nombre del **profesor**, nombre de la **materia** y nombre del **aula**. **No busca por alumno** («decisión del equipo, 29/09/2026», comentario de las líneas 10-11). La spec §2.7 punto 3, su nota de Revisión 6 y §3.11 todavía dicen que busca por alumno: se corrigen en la sección 8.1. **No se toca el código.**
- `presentar()` (`turno.service.ts:628-659`): ya devuelve `materia_id`, `estado` según la ocupación vigente (`estadoSegunOcupacion`), `PENDIENTE` y `CANCELADO` tal cual. Lo comparten el listado y el detalle: **no se cambia** (el campo nuevo de la sección 4.2 se suma solo en el `map` del listado).
- `fechas-centro.ts`: `fechaCentro(momento)` (día del centro como `@db.Date`), `inicioDelDiaCentro(momento)`, `finDelDiaCentro(momento)` (inicio del día siguiente, se apoya en `inicioDelDiaCentro`), `ZONA_CENTRO`.
- `reloj.ts`: `ahora()` y `conReloj(momento, fn)` (pruebas y seed).
- `obtenerOpcionProfesorDeUsuario(usuarioId)` (`profesor.publico.ts`): ficha del profesor de la sesión.
- `obtenerMateriasPorIds(ids, db?)` (`src/server/materias/materia.publico.ts:9`): fichas de materia existentes (activas o no). Sirve para validar «materia existente».
- `listarOpcionesFiltroProfesor()` (`turno.service.ts:669`): opciones del selector de profesor (HU-C-08). Es el modelo de la función de opciones de materia nueva.
- `urlListadoTurnos()` y `urlContinuar()` (`src/lib/turno-listado.ts`), con su test `src/lib/turno-listado.test.ts`. `urlListadoTurnos` siempre escribe `pagina` y `orden=fecha_hora_asc`. Hoy nada lee `orden` (la página lo recibe por props y `TurnosListado` lo ignora).
- Validación de la URL de retorno (`volver`), que tiene que seguir funcionando:
  - `src/app/(dashboard)/turnos/[id]/configuracion/page.tsx:5` y `[id]/participantes/page.tsx:8`: aceptan `volver` solo si empieza con `"/turnos?"`.
  - `src/app/(dashboard)/turnos/[id]/page.tsx:13-16`: acepta `"/turnos..."` o `"/calendario/..."`.
  - Como `urlListadoTurnos` siempre escribe `pagina`, la URL siempre tiene `?` y la validación se cumple también sin `orden`.
- `TurnosListado` (`src/app/(dashboard)/turnos/turnos-listado.tsx`): búsqueda con debounce, una sola petición viva (`AbortController`), `replaceState` con motivo `"busqueda" | "filtro"`, adopción de la URL nueva sin remontar (bloque `origen`, líneas 63-76), selector de profesor (solo Gerente y Mesa), chip y «Limpiar», mensajes vacíos (líneas 161-162), subtítulo (línea 173) y acciones por fila (línea 187: «Continuar configuración» si `puedeConfigurar && estado === "PENDIENTE"`; «Descartar» si `puedeDescartar && estado === "PENDIENTE"`).
- `ControlSegmentado` (`src/components/shared/control-segmentado.tsx`): control segmentado genérico, se reutiliza para «Período».
- `fechaCorta("AAAA-MM-DD")` → `"DD/MM/AAAA"` (`src/lib/turno-detalle.ts:9`), para el subtítulo del rango.
- Textos (`src/lib/textos.ts:154-161`): `ui.clases.interfaz.noSeEncontraronClasesPara`, `.esteProfesorNoTieneClasesRegistradas`, `.noHayClasesRegistradas` y `.desdeHoyOrdenFechaYHoraAscendenteLuegoProfesor`. **Verificado con grep**: el único consumidor de las cuatro es `turnos-listado.tsx`.
- `Turno` no tiene ningún `@@index` (solo la PK y los triggers de `reservas_turno`). Ninguna migración crea índices sobre `turnos`. La última migración es `20261013120000_examen_descripcion_publica`.
- Seed (`prisma/seed.ts`): `TurnoSeed.diaOperativo` cuenta desde el **próximo** día operativo (`0` = el siguiente a hoy; `-1` = el último anterior). **Hoy no hay ninguna clase del seed**: el filtro «Hoy» quedaría siempre vacío. Las clases se crean solo si faltan (ids fijos), así que el seed ya es idempotente para clases. El paso 13 omite las clases de hoy y anteriores (`<= hoy`) y el paso 14 omite las de hoy y posteriores (`>= hoy`). `validarDatos()` rechaza clases de materias inactivas y en días no operativos.
- Fixtures que crean clases (`prisma/seed/fixtures/hu-h-03.ts`, `hu-h-06.ts`, `hu-h-10.ts`, `hu-e-09.ts`) usan meses anteriores o fechas fijas de 2026. `hu-e-02.ts` usa fechas fijas (16/10 y 23/10/2026, de 14 a 18). Las clases nuevas de hoy van de mañana (08 a 14) para no chocar.
- `docs/adicionales/mapa-pantallas-sprint-3.md` **no está en el repo** (lo confirman también HU-A-06, HU-D-08 y HU-F-01). Lo resuelve la sección 8.2.

### 0.2. Archivos nuevos a crear (ruta exacta)

- `prisma/migrations/20261013160000_hu_c27_indices_listado_turnos/migration.sql`: los tres `CREATE INDEX` (sección 6).
- `docs/testing/Modulo C/hu-c-27/HU-C-27.postman_collection.json`.
- `docs/testing/Modulo C/hu-c-27/HU-C-27-evidencia.md` (SQL de nivel 3 y `EXPLAIN`).
- `docs/adicionales/mapa-pantallas-sprint-3.md`, **solo si sigue sin estar en el repo** al implementar (sección 8.2).

No se crean archivos de código nuevos: todo se suma a archivos existentes.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

**Backend**
- `src/server/turnos/turno.schema.ts`: `ListarTurnosQuerySchema` suma `periodo`, `desde`, `hasta` y `materia_id`, con dos `refine`. Se reescribe el comentario de la línea 9. Se exportan `PERIODOS_LISTADO_TURNOS` y el tipo `PeriodoListadoTurnos` (sección 4.1).
- `src/server/turnos/turno.service.ts`:
  - `FiltrosListadoTurnos` suma `periodo`, `desde`, `hasta` y `materia_id`.
  - `listarTurnos()` reemplaza las líneas 698-707 por el cálculo con `ahora()`/`fechaCentro`/`finDelDiaCentro`, aplica período o rango y materia, valida la materia y usa orden descendente con «Anteriores». Cada ítem suma `es_dia_anterior` (sección 4.2).
  - Función nueva `listarOpcionesFiltroMateria(usuario)` (sección 4.4).
  - **No** se tocan `ZONA_TURNOS`/`corteLocal`/`listarTurnosPropios` (HU-C-13, fuera de alcance): el listado simplemente deja de depender de cualquier copia local.
- `src/app/api/turnos/route.ts`: pasa los filtros nuevos al servicio y traduce `ServiceError("VALIDACION")` (materia inexistente) a `400` (sección 4.3).
- `src/server/materias/materia.publico.ts`: función nueva `listarMateriasParaFiltroDeClases(idsConClases, { incluirActivasSinClases }, db?)` (sección 4.4).
- `src/types/turno.types.ts`: `TurnosData.items` pasa a `TurnoListado[]` (`Turno & { es_dia_anterior: boolean }`). Se agregan `PeriodoListadoTurnos` (reexportado) y `OpcionMateriaFiltro = { id: string; nombre: string; activa: boolean }`.

**Frontend y apoyo**
- `src/lib/turno-listado.ts`: `urlListadoTurnos` suma `periodo`, `desde`, `hasta` y `materiaId`, y quita `orden`. Se actualiza el comentario de cabecera (sección 4.5).
- `src/app/(dashboard)/turnos/page.tsx`: lee y sanea `periodo`, `desde`, `hasta` y `materia_id`; quita `orden`; trae las opciones de materia en el servidor y se las pasa a `TurnosListado` (sección 5.1).
- `src/app/(dashboard)/turnos/turnos-listado.tsx`: filtros Período, Desde–Hasta y Materia; «Limpiar filtros»; subtítulo; mensajes vacíos; sin «Continuar configuración» en un Pendiente de un día anterior; se quita la prop `orden` (sección 5.2).
- `src/lib/textos.ts`: claves nuevas `ui.clases.listado.*` y `ui.clases.errores.listado.*`. Se borran las cuatro claves de 0.1, que quedan sin consumidores (sección 4.6).

**Base de datos y seed**
- `prisma/schema.prisma`: tres `@@index` en `model Turno` (sección 6).
- `prisma/seed.ts`: clases de hoy y de días anteriores, con el campo nuevo `hoy` en `TurnoSeed` (sección 7).

**Documentación**
- `docs/specs/spec_modulo_C.md`: nota aditiva HU-C-27, §2.4, §2.7, §2.16.5 y §3.11 (sección 8.1).
- `docs/adicionales/mapa-pantallas-sprint-3.md` §1 (sección 8.2).
- `docs/RULES.md`: sección «Aplicación HU-C-27» (sección 8.3).
- `docs/tasks/Sprint 2/HU-Sprint-2.md`: nota en HU-C-02, criterio 6 (sección 8.4).

**Tests** (sección 9)
- `src/server/turnos/turno.listado.test.ts`, `src/server/turnos/turno.schema.test.ts`, `src/app/api/turnos/listado.route.test.ts`, `src/lib/turno-listado.test.ts`, `src/app/(dashboard)/turnos/turnos-listado.test.tsx`, `src/app/(dashboard)/turnos/turnos-listado-profesor.test.tsx`, `src/server/turnos/turno.listado-profesor.pg.test.ts`.

### 0.4. Decisiones tomadas (no relevar de nuevo)

1. **Período por defecto también en el servidor.** Si la query no trae `periodo`, `desde` ni `hasta`, `listarTurnos` usa `"hoy"`. El único consumidor de `GET /api/turnos` es la pantalla (verificado con grep; el modal de HU-D-07 usa su propia ruta), así que no hay compatibilidad que conservar con «desde hoy». Con `desde` o `hasta` y sin `periodo`, se aplica el rango.
2. **Período y rango son excluyentes en la API.** Enviar `periodo` junto con `desde` o `hasta` es `400`. La pantalla nunca lo hace: al cargar una fecha deja de enviar `periodo` («Rango personalizado») y al elegir un período vacía las fechas. No hay valor `periodo=rango`: el rango se expresa solo con `desde`/`hasta`.
3. **Corte por día calendario del centro**, con `momento = ahora()`:
   - `hoy = fechaCentro(momento)`.
   - `manana = fechaCentro(finDelDiaCentro(momento))` (`finDelDiaCentro` = `inicioDelDiaCentro` + 24 h).
   - Anteriores `fechaTurno < hoy`, Hoy `fechaTurno = hoy`, Próximas `fechaTurno >= manana`, Todas sin condición de fecha.
   - Rango: `fechaTurno >= desde` y/o `fechaTurno <= hasta`, ambos inclusive.
   - Se usa el **mismo `momento`** para el corte, para `incluirTurno(momento)` y para `es_dia_anterior`.
4. **Orden.** Por defecto (Hoy, Próximas, Todas y rango) es el actual: `fechaTurno asc, horaInicioTurno asc, profesorId asc nulls last, idTurno asc`. Con «Anteriores» es `fechaTurno desc, horaInicioTurno desc, profesorId asc nulls last, idTurno asc`: la más reciente primero, con el mismo desempate estable.
5. **«Pendiente de un día anterior» lo decide el servidor.** Cada ítem del listado trae `es_dia_anterior: boolean` (`fechaTurno < hoy`). La pantalla no compara fechas con el reloj del navegador. El campo se suma solo en el `map` de `listarTurnos`, no en `presentar()`, así el detalle no cambia.
6. **Materia inexistente** (CUID bien formado sin ficha): `listarTurnos` la valida con `obtenerMateriasPorIds([materia_id])`. Si no hay ficha, lanza `ServiceError("VALIDACION", texto("ui.clases.errores.listado.materiaInexistente"))` y la ruta responde `400 { code: "VALIDACION", message }`. Una materia existente pero sin clases para ese usuario (por ejemplo, el Profesor con una materia que no dicta) **no** es error: devuelve `200` con lista vacía.
7. **Opciones de materia para Mesa de entrada y Gerente** (criterio 4):
   - C calcula los ids de materia que tienen al menos una clase en su propia tabla (`prisma.turno.findMany({ distinct: ["materiaId"], select: { materiaId: true } })`, que usa el índice `(materiaId, fechaTurno)`).
   - L devuelve las activas más las inactivas de esa lista (`listarMateriasParaFiltroDeClases(idsConClases, { incluirActivasSinClases: true })`).
   - Ni C lee `materias` ni L lee `turnos` (Regla N.° 3).
8. **Opciones de materia para el Profesor** (criterio 4, «las materias de sus clases»): el mismo mecanismo, acotado a sus clases.
   - C calcula los ids de las materias de las clases del profesor de la sesión (`prisma.turno.findMany({ where: { profesorId: propio.id }, distinct: ["materiaId"], select: { materiaId: true } })`, que usa el índice `(profesorId, fechaTurno)`).
   - L devuelve **solo** esas materias, activas o inactivas (`listarMateriasParaFiltroDeClases(ids, { incluirActivasSinClases: false })`); las inactivas llevan «Inactiva».
   - No se usa `obtenerMateriasDelProfesor` (D): esa función devuelve las materias **asociadas** al profesor, no las de sus clases. Una materia asociada sin clases no aparece en el filtro y una materia de la que se lo desasoció después de dictarla sí aparece, porque tiene clases suyas.
9. **Opciones en el servidor, sin endpoint nuevo.** `page.tsx` (Server Component) llama a `listarOpcionesFiltroMateria(session.user)` y pasa `materias` por props. No se crea `GET /api/turnos/filtros/materias`: el listado ya se arma con un primer render del servidor (mismo criterio que HU-C-26, que toma las materias en el servidor).
10. **Parámetros de la URL inválidos al entrar.** `page.tsx` los sanea antes de pasarlos: un `periodo` desconocido → `"hoy"`; una fecha que no es AAAA-MM-DD válida → se ignora; `materia_id` que no está entre las opciones → `""`. Con `desde > hasta` en la URL se respetan ambas y la pantalla muestra el error del criterio 3 **sin consultar**. Así un enlace viejo o editado a mano no termina en un 400 en pantalla.
11. **«Sin otros filtros»** (criterio 10) significa: Período «Hoy», sin `q` efectivo (menos de 2 caracteres cuenta como vacío), sin `profesor_id` y sin `materia_id`. El alcance implícito del Profesor no es un filtro, así que el Profesor también ve «No hay clases para hoy» y «Ver próximas».
12. **Mensajes vacíos.** Los tres mensajes actuales (por `q`, por profesor y sin clases) se reemplazan por los dos del criterio 10. Las claves viejas se borran porque no tienen otro consumidor.
13. **Índices con `@@index` de Prisma** (no SQL manual): nombres por defecto `turnos_fechaTurno_horaInicioTurno_idx`, `turnos_profesorId_fechaTurno_idx` y `turnos_materiaId_fechaTurno_idx`. «Anteriores» recorre el primero hacia atrás; PostgreSQL lo hace sin un índice `DESC` aparte.
14. **Clases de «hoy» en el seed** (sección 7): se crean solo si hoy es día operativo. Si no lo es, se omiten con un aviso (`validarDatos` las rechazaría por día no operativo). Como las clases no se mueven al resembrar, «Hoy» muestra clases el día de la primera corrida; para probar otro día: `npx prisma migrate reset` o `SEED_FECHA_HOY`.

---

## 1. Nota de alcance

HU-C-27 **no es una pantalla nueva**: son filtros sobre el listado «Clases» (`/turnos`, HU-C-01), que ya tiene búsqueda (HU-C-02) y filtro por profesor (HU-C-08). Quita el corte fijo «desde hoy» del servidor y agrega tres filtros (Período, Desde–Hasta y Materia) que se combinan con los existentes, viajan en la URL y se resuelven en el servidor.

**Fuera de alcance (explícito):**
- Filtro por estado (`estados`): sigue prohibido y `.strict()` lo sigue rechazando con `400`. `solo_futuros` también, reemplazado por `periodo`.
- `listarTurnosPropios` / «Mis clases» del alumno (HU-C-13) y su `ZONA_TURNOS`/`corteLocal`: no se tocan.
- La búsqueda (`construirFiltroBusquedaTurno`): no cambia su criterio. Solo se corrige la spec, que decía que buscaba por alumno.
- El detalle (`obtenerTurno`, `presentar`), el calendario y el modal «Ver turnos» de HU-D-07 (`listarTurnosFuturosDeProfesorPorMateria`).
- Las validaciones de los pasos de configuración de un Pendiente vencido: el listado solo deja de ofrecer el enlace (criterio 9). Lo que respondan esas pantallas si se entra por URL no cambia.
- `por_pagina` y la paginación: sin cambios (deuda de §2.7, «Nota de sincronización — `por_pagina`»).

---

## 2. Historia de Usuario

**HU-C-27 – Ver todas las clases con filtros de período, fechas y materia**

**Módulo:** Gestionar turnos
**Actor:** Personal de mesa de entrada, gerente o profesor (sobre sus propias clases)
**Necesito** que el listado «Clases» muestre todas las clases (anteriores, de hoy y próximas) y poder filtrarlas por período, rango de fechas y materia.
**Para** encontrar cualquier clase, por ejemplo una ya dictada para corregir la asistencia o un pago, sin depender del calendario, y empezar el día viendo las clases de hoy.

**SP:** 5 · **Depende de:** HU-C-01, HU-C-02, HU-C-08, HU-C-19, HU-C-23

### Criterios de aceptación (pedido del PO, literal)

1. El listado «Clases» (/turnos, HU-C-01) deja de mostrar solo las clases desde hoy. Con el Período en «Todas» muestra las anteriores, las de hoy y las próximas, en los cuatro estados (Pendiente, Disponible, Completa y Cancelada).
2. Filtro «Período», con las opciones Anteriores, Hoy (por defecto al entrar), Próximas y Todas.
   - Se corta por día calendario en la zona horaria del centro (America/Argentina/Buenos_Aires).
   - «Anteriores» son las clases de días anteriores a hoy.
   - «Hoy» son las clases de hoy, aunque ya hayan terminado.
   - «Próximas» son las clases de mañana en adelante.
   - «Todas» incluye las tres.
   - El servidor calcula «hoy» con el reloj del sistema (ahora()) y las funciones de fecha del centro (fechaCentro, inicioDelDiaCentro), no con new Date() ni con una copia local de esa lógica.
3. Rango de fechas (Desde–Hasta, por fecha de la clase, ambos inclusive).
   - Al cargar una de las dos fechas, el Período pasa a «Rango personalizado». Al elegir una opción de Período, Desde y Hasta se vacían.
   - Se puede cargar una sola fecha.
   - Si Desde es posterior a Hasta, se muestra junto al campo «La fecha Desde no puede ser posterior a Hasta» y el listado muestra «Corregí el rango de fechas para ver las clases».
4. Filtro «Materia», con «Todas» por defecto.
   - Mesa de entrada y gerente ven las materias activas y las inactivas que tengan al menos una clase; las inactivas llevan la etiqueta «Inactiva».
   - El profesor ve solo las materias de sus clases.
5. Combinación:
   - Período o rango, Materia, la búsqueda (q, HU-C-02) y el profesor (profesor_id, HU-C-08) se combinan entre sí.
   - Al cambiar cualquier filtro, el resultado se actualiza sin recargar la pantalla, vuelve a la página 1 e informa la cantidad de clases.
   - «Limpiar filtros» vuelve al estado inicial: Período «Hoy», Materia «Todas», sin búsqueda y sin profesor.
6. Orden:
   - Por defecto, el actual: fecha, hora de inicio, profesor e id, en forma ascendente.
   - Con «Anteriores», fecha y hora en forma descendente, la más reciente primero.
7. El subtítulo del listado describe el período y el orden elegidos, por ejemplo «Hoy · Orden: fecha y hora ascendente». Reemplaza a «Desde hoy · Orden: fecha y hora ascendente, luego profesor».
8. Los filtros viajan en la URL (periodo, desde, hasta, materia_id) junto a q, profesor_id y pagina.
   - Al volver del detalle de una clase, o de los pasos de configuración que usan la URL de retorno del listado, se conservan los filtros y la página.
   - Un enlace con filtros abre el listado ya filtrado.
9. Una clase Pendiente de un día anterior no ofrece «Continuar configuración», porque ya no puede pasar a Disponible. «Descartar» se mantiene. Las demás acciones del listado no cambian.
10. Mensajes cuando no hay resultados:
    - Con «Hoy» y sin otros filtros: «No hay clases para hoy», con la acción «Ver próximas», que cambia el Período a «Próximas».
    - En cualquier otro caso: «No se encontraron clases para los filtros elegidos».
11. Acceso y validación:
    - El acceso no cambia: mesa de entrada y gerente ven todas las clases; el profesor ve solo las suyas, sin selector de profesor (HU-C-08).
    - Los parámetros nuevos se validan en el servidor: período válido, fechas válidas, Desde no posterior a Hasta y materia existente. Si alguno es inválido, responde 400.
    - El filtrado y la paginación se hacen en el servidor.
12. Rendimiento: el listado responde sin recorrer toda la tabla también con «Todas». Para eso, la tabla de clases tiene índices por (fecha, hora de inicio), (profesor, fecha) y (materia, fecha).
13. Textos y confirmación:
    - Los textos salen del archivo central (HU-C-23) y usan el término «Clase» (HU-C-19).
    - Filtrar no pide confirmación (HU-C-25, criterio 5).
14. Pruebas:
    - Se actualizan las pruebas existentes del listado (servicio, API y pantalla).
    - Se agregan casos para cada período, el rango (incluido el 400 por Desde posterior a Hasta), la materia, la combinación con búsqueda y profesor, el orden de «Anteriores» y la acción ausente en un Pendiente de un día anterior.

**Justificación:** pedido del PO (13/10/2026). El listado solo mostraba clases desde hoy. Cambia HU-C-02 (criterio 6) y `spec_modulo_C.md` §2.4 y §2.7, que excluían los filtros por fecha y materia; el filtro por estado sigue fuera del producto. No es una pantalla nueva: son filtros sobre el mismo listado.

---

## 3. Alcance de esta task

Implementación **backend + frontend + base de datos + seed + documentación + pruebas**:

- Schema Zod ampliado (`periodo`, `desde`, `hasta`, `materia_id`) con `400` para todo lo inválido.
- `listarTurnos()` con período o rango, materia, orden según el período, reloj del dominio y `es_dia_anterior`.
- Opciones del filtro «Materia» (por la fachada de L, para los tres roles) y `listarOpcionesFiltroMateria()` en C.
- `urlListadoTurnos()` con los parámetros nuevos y sin `orden`.
- Pantalla: Período (segmentado), Desde–Hasta, Materia, «Limpiar filtros», subtítulo, mensajes vacíos, acción ausente en Pendiente de un día anterior, todo en la URL.
- Textos nuevos en `textos.ts` y borrado de las claves que quedan sin uso.
- Tres índices en `turnos` con su migración.
- Seed: clases de hoy, de días anteriores (incluidos un Pendiente anterior y una materia inactiva con clase), idempotente.
- Spec C (§2.4, §2.7, §2.16.5, §3.11 y nota aditiva), mapa de pantallas §1, RULES y nota en HU-C-02.
- Pruebas de los tres niveles y evidencia.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/turnos/turno.schema.ts` (reemplaza las líneas 5-11)

```typescript
/** HU-C-27: períodos del listado de clases (spec_modulo_C.md §2.4 y §2.7). */
export const PERIODOS_LISTADO_TURNOS = ["anteriores", "hoy", "proximas", "todas"] as const;
export type PeriodoListadoTurnos = (typeof PERIODOS_LISTADO_TURNOS)[number];

// Fecha de la clase en AAAA-MM-DD; se compara como texto (mismo patrón que caja.schema.ts).
const fechaFiltroTurnosSchema = z.string().trim().refine(
  (valor) => fechaCalendarioValidaSchema.safeParse(valor).success,
  { message: textoC19("ui.clases.errores.listado.fechaInvalida") },
);

export const ListarTurnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).optional(),
  q: z.string().trim().max(100).optional(), // HU-C-02
  profesor_id: z.string().cuid().optional(), // HU-C-08
  // HU-C-27: período o rango (excluyentes), y materia. Sin `estados` ni
  // `solo_futuros`: el filtro por estado sigue fuera del producto y
  // `solo_futuros` lo reemplaza `periodo`; `.strict()` los rechaza con 400.
  periodo: z.enum(PERIODOS_LISTADO_TURNOS).optional(),
  desde: fechaFiltroTurnosSchema.optional(),
  hasta: fechaFiltroTurnosSchema.optional(),
  materia_id: z.string().cuid().optional(),
}).strict()
  .refine((f) => !(f.periodo && (f.desde || f.hasta)), {
    message: textoC19("ui.clases.errores.listado.periodoYRango"), path: ["periodo"],
  })
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    message: textoC19("ui.clases.listado.rango.desdePosteriorAHasta"), path: ["desde"],
  });
export type ListarTurnosQuery = z.infer<typeof ListarTurnosQuerySchema>;
```

- `fechaCalendarioValidaSchema` (`src/server/shared/fecha.schema.ts:15`) transforma a `Date` (verificado). Por eso no se usa directo: el `refine` sobre el string (como en `caja.schema.ts:41`) solo lo usa para validar y deja `desde`/`hasta` como `"AAAA-MM-DD"`, así se comparan como texto.
- El mensaje del `refine` de Desde–Hasta es **el mismo texto** que muestra la pantalla (criterio 3), sacado de la misma clave.

### 4.2. Servicio

**Archivo:** `src/server/turnos/turno.service.ts`

```typescript
export type FiltrosListadoTurnos = {
  q?: string; profesor_id?: string;                                // HU-C-02, HU-C-08
  periodo?: PeriodoListadoTurnos; desde?: string; hasta?: string;  // HU-C-27
  materia_id?: string;                                             // HU-C-27
};
```

Actualizar el JSDoc de `FiltrosListadoTurnos` (líneas 661-665): ya no dice «alcance base (desde hoy + rol)» sino «alcance por rol + período o rango».

`listarTurnos(pagina, porPaginaSolicitado, usuario, filtros = {})`. **Firma sin cambios.** Pasos:

1. `const momento = ahora();` (import `ahora` ya existe como `relojAhora`). `const hoy = fechaCentro(momento); const manana = fechaCentro(finDelDiaCentro(momento));`. Se borran las líneas 698-700 (`Intl.DateTimeFormat` + `new Date()` + `inicioHoy`).
2. Período efectivo: `const periodo = filtros.periodo ?? (filtros.desde || filtros.hasta ? undefined : "hoy");`.
3. Condición de fecha:
   - `anteriores` → `{ fechaTurno: { lt: hoy } }`
   - `hoy` → `{ fechaTurno: hoy }`
   - `proximas` → `{ fechaTurno: { gte: manana } }`
   - `todas` → `{}`
   - rango → `{ fechaTurno: { ...(desde && { gte: diaUtc(desde) }), ...(hasta && { lte: diaUtc(hasta) }) } }`, con `diaUtc("AAAA-MM-DD") = new Date(\`${valor}T00:00:00.000Z\`)` (valor `@db.Date`, igual que `fechaCentro`).
4. Defensa en profundidad (la ruta ya validó): si llegan `periodo` y rango juntos, o `desde > hasta`, `ServiceError("VALIDACION", ...)` con las mismas claves de 4.1.
5. Materia: si viene `filtros.materia_id`, `const [materia] = await obtenerMateriasPorIds([filtros.materia_id]);`. Si no existe, `throw new ServiceError("VALIDACION", textoC19("ui.clases.errores.listado.materiaInexistente"))`. Si existe, suma `{ materiaId: filtros.materia_id }`.
6. `where` = `{ ...condicionFecha, ...alcanceProfesor, ...(materia && { materiaId }), ...(busqueda && { AND: [busqueda] }) }`. `alcanceProfesorListado` se llama igual que hoy y **antes** de validar la materia, así un Profesor con `profesor_id` ajeno sigue recibiendo `SIN_PERMISO` primero.
7. `orderBy`: la constante actual o, si `periodo === "anteriores"`, `[{ fechaTurno: "desc" }, { horaInicioTurno: "desc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }]`. Definir las dos como constantes con nombre (`ORDEN_LISTADO_ASC`, `ORDEN_LISTADO_ANTERIORES`).
8. `include: incluirTurno(momento)` (mismo momento que el corte).
9. `items: turnos.map((turno) => ({ ...presentar(turno), es_dia_anterior: turno.fechaTurno < hoy }))`. Comparar con `getTime()`, no con `<` sobre objetos `Date`.
10. `count`, página fuera de rango y `paginacion`: sin cambios.

Imports nuevos: `fechaCentro`, `finDelDiaCentro` de `@/server/shared/fechas-centro` (ya se importan `inicioDeTurno` e `isoCentro` de ahí) y `obtenerMateriasPorIds` de `@/server/materias/materia.publico`.

**Errores del servicio:** `SIN_PERMISO` (403), `PROFESOR_NO_ENCONTRADO` (404), sin cambios. Nuevo: `VALIDACION` (400) por materia inexistente, período más rango o rango invertido.

### 4.3. Route Handler

**Archivo:** `src/app/api/turnos/route.ts` (`GET`)

```typescript
const { pagina, por_pagina, q, profesor_id, periodo, desde, hasta, materia_id } = parsed.data;
const data = await listarTurnos(pagina, por_pagina, req.auth!.user, { q, profesor_id, periodo, desde, hasta, materia_id });
```

- El `catch` suma `VALIDACION` → `400`: `{ data: null, error: { code: "VALIDACION", message } }`.
- El `!success` de Zod sigue igual (`400`, `code: "VALIDACION"`, `detalles: parsed.error.flatten()`); los errores de `refine` aparecen en `detalles.fieldErrors.periodo` / `.desde`.
- Permiso sin cambios: `turnos:leer`. `POST` no se toca.

**Contrato final de `GET /api/turnos`:**

| Parámetro | Tipo | Regla |
|---|---|---|
| `pagina` | entero positivo | default 1 (sin cambios) |
| `por_pagina` | entero 1..20 | opcional (sin cambios) |
| `q` | texto hasta 100 | HU-C-02 (sin cambios) |
| `profesor_id` | CUID | HU-C-08 (sin cambios) |
| `periodo` | `anteriores` \| `hoy` \| `proximas` \| `todas` | default `hoy` si no hay `desde`/`hasta`; excluyente con ellos |
| `desde` / `hasta` | `AAAA-MM-DD` válida | inclusive; `desde <= hasta` |
| `materia_id` | CUID de una materia existente | inexistente → 400 |
| cualquier otro (`estados`, `solo_futuros`, `orden`…) | — | 400 por `.strict()` |

Respuesta `200`: la de §2.4, con `es_dia_anterior: boolean` en cada ítem.

### 4.4. Opciones del filtro «Materia»

**L. `src/server/materias/materia.publico.ts`**, función nueva:

```typescript
/**
 * Opciones del filtro «Materia» del listado de clases (HU-C-27, criterio 4):
 * las materias cuyo id está en `idsConClases`, activas o inactivas (C le
 * pasa las que tienen al menos una clase, así L no lee `turnos`), y además,
 * con `incluirActivasSinClases`, todas las activas. Orden por nombre
 * normalizado. Solo lectura.
 */
export async function listarMateriasParaFiltroDeClases(
  idsConClases: string[],
  { incluirActivasSinClases }: { incluirActivasSinClases: boolean },
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; nombre: string; activa: boolean }[]>
```

- Con `incluirActivasSinClases: true` (Mesa y Gerente): `where: { OR: [{ activaMateria: true }, { idMateria: { in: ids } }] }`.
- Con `false` (Profesor): `where: { idMateria: { in: ids } }`. Con `ids` vacío devuelve `[]` sin consultar.
- En los dos casos: `ids = [...new Set(idsConClases)]` y `orderBy: { nombreNormalizadaMateria: "asc" }`.

**C. `src/server/turnos/turno.service.ts`**, junto a `listarOpcionesFiltroProfesor`:

```typescript
/** Opciones del selector «Materia» del listado (HU-C-27, criterio 4). */
export async function listarOpcionesFiltroMateria(usuario: { id: string; rol: RolUsuario }): Promise<OpcionMateriaFiltro[]>
```

- **PROFESOR**: `obtenerOpcionProfesorDeUsuario(usuario.id)`; sin ficha → `[]` (el listado igual responde `SIN_PERMISO`). Con ficha: `const ids = (await prisma.turno.findMany({ where: { profesorId: propio.id }, distinct: ["materiaId"], select: { materiaId: true } })).map((t) => t.materiaId);` y después `listarMateriasParaFiltroDeClases(ids, { incluirActivasSinClases: false })`.
- **GERENTE / MESA_ENTRADA**: `const ids = (await prisma.turno.findMany({ distinct: ["materiaId"], select: { materiaId: true } })).map((t) => t.materiaId);` y después `listarMateriasParaFiltroDeClases(ids, { incluirActivasSinClases: true })`.
- Las dos ramas comparten el mismo helper interno de C para los ids (`idsMateriasConClases(where)`). No se importa nada nuevo de `profesor.publico.ts` además de `obtenerOpcionProfesorDeUsuario`, que ya se usa.

### 4.5. URL del listado

**Archivo:** `src/lib/turno-listado.ts`

```typescript
export type FiltrosUrlListadoTurnos = {
  pagina: number; q?: string; profesorId?: string;
  periodo?: PeriodoListadoTurnos; desde?: string; hasta?: string; materiaId?: string;
};
export function urlListadoTurnos({ q, pagina, profesorId, periodo, desde, hasta, materiaId }: FiltrosUrlListadoTurnos): string
```

- Orden fijo de los parámetros (para que los tests comparen strings): `q`, `profesor_id`, `periodo`, `desde`, `hasta`, `materia_id`, `pagina`.
- Si hay `desde` o `hasta`, **no** se escribe `periodo` (rango personalizado). Si no, `periodo` se escribe siempre (incluido `hoy`), así la URL describe el estado completo.
- `pagina` se escribe **siempre**: garantiza el prefijo `"/turnos?"` que exigen `configuracion/page.tsx` y `participantes/page.tsx`.
- Se quita `params.set("orden", "fecha_hora_asc")`. Se reescribe el comentario de cabecera (ya no «siempre incluye `pagina` y `orden`»).
- `urlContinuar` no cambia.

`PeriodoListadoTurnos` se importa como **tipo** desde `@/types/turno.types` (no desde el schema de servidor, porque `turno-listado.ts` corre en el cliente).

### 4.6. Textos (`src/lib/textos.ts`, HU-C-23)

**Se borran** (único consumidor: `turnos-listado.tsx`, verificado):
- `ui.clases.interfaz.desdeHoyOrdenFechaYHoraAscendenteLuegoProfesor`
- `ui.clases.interfaz.noSeEncontraronClasesPara`
- `ui.clases.interfaz.esteProfesorNoTieneClasesRegistradas`
- `ui.clases.interfaz.noHayClasesRegistradas`

Antes de borrarlas, repetir `grep -rn "<clave>" src scripts docs` y correr `scripts/verificar-claves-textos.ts`.

**Se agregan:**

| Clave | Texto |
|---|---|
| `ui.clases.listado.periodo.etiqueta` | Período |
| `ui.clases.listado.periodo.anteriores` | Anteriores |
| `ui.clases.listado.periodo.hoy` | Hoy |
| `ui.clases.listado.periodo.proximas` | Próximas |
| `ui.clases.listado.periodo.todas` | Todas |
| `ui.clases.listado.periodo.rangoPersonalizado` | Rango personalizado |
| `ui.clases.listado.rango.desde` | Desde |
| `ui.clases.listado.rango.hasta` | Hasta |
| `ui.clases.listado.rango.desdePosteriorAHasta` | La fecha Desde no puede ser posterior a Hasta |
| `ui.clases.listado.rango.corregir` | Corregí el rango de fechas para ver las clases |
| `ui.clases.listado.rango.entre` | Del {desde} al {hasta} |
| `ui.clases.listado.rango.soloDesde` | Desde el {desde} |
| `ui.clases.listado.rango.soloHasta` | Hasta el {hasta} |
| `ui.clases.listado.materia.etiqueta` | Materia |
| `ui.clases.listado.materia.todas` | Todas |
| `ui.clases.listado.materia.inactiva` | Inactiva |
| `ui.clases.listado.materia.filtrar` | Filtrar por materia |
| `ui.clases.listado.limpiarFiltros` | Limpiar filtros |
| `ui.clases.listado.subtitulo` | {periodo} · Orden: {orden} |
| `ui.clases.listado.orden.ascendente` | fecha y hora ascendente |
| `ui.clases.listado.orden.descendente` | fecha y hora descendente |
| `ui.clases.listado.vacio.hoy` | No hay clases para hoy |
| `ui.clases.listado.vacio.verProximas` | Ver próximas |
| `ui.clases.listado.vacio.filtros` | No se encontraron clases para los filtros elegidos |
| `ui.clases.errores.listado.fechaInvalida` | La fecha no es válida |
| `ui.clases.errores.listado.periodoYRango` | Elegí un período o un rango de fechas, no ambos |
| `ui.clases.errores.listado.materiaInexistente` | La materia elegida no existe |

Todas usan «clase», nunca «turno» (HU-C-19). La clave existente `ui.clases.interfaz.limpiar` («Limpiar») queda sin consumidor si el chip de profesor pasa a usar «Limpiar filtros»: borrarla también si el grep lo confirma.

---

## 5. Frontend

### 5.1. `src/app/(dashboard)/turnos/page.tsx`

- `searchParams`: `{ pagina?, q?, profesor_id?, periodo?, desde?, hasta?, materia_id? }`. Se quita `orden`.
- Saneo (decisión 0.4.10):
  - `periodo` ∈ `PERIODOS_LISTADO_TURNOS`, si no `undefined`.
  - `desde`/`hasta` con `/^\d{4}-\d{2}-\d{2}$/` más una fecha calendario real, si no `""`.
  - Si no quedó ni `periodo` ni fechas → `periodo = "hoy"`. Si quedaron fechas, se ignora `periodo` (gana el rango, como en la API).
- En el `Promise.all` existente suma `listarOpcionesFiltroMateria(session.user)`, con `.catch(() => [])`: sin opciones el selector queda solo con «Todas». Se llama después de `auth()`, así que va en un segundo `await` o se encadena con `session`.
- `materia_id` que no está entre las opciones → `""`.
- Render: `<TurnosListado pagina q profesorId periodo desde hasta materiaId materias={opciones} puedeConfigurar puedeDescartar puedeFiltrarProfesor esProfesor />`. Sin `key` (se conserva la decisión de HU-C-02: no remontar).

### 5.2. `src/app/(dashboard)/turnos/turnos-listado.tsx`

**Props:** se quita `orden`; se agregan `periodo?: PeriodoListadoTurnos`, `desde?: string`, `hasta?: string`, `materiaId?: string`, `materias?: OpcionMateriaFiltro[]`.

**Estado:** `Solicitud` pasa a `{ q, profesorId, periodo, desde, hasta, materiaId, pagina, motivo }`. `periodo` es `undefined` cuando hay rango. `resultado` guarda los mismos filtros con los que se obtuvieron los datos. El bloque `origen` (adopción de la URL sin remontar) compara también los cuatro filtros nuevos.

**`cargar`:** arma la query con los mismos nombres que la API (`periodo` solo si no hay rango) y, con motivo `"busqueda" | "filtro"`, hace `replaceState(urlListadoTurnos({...}))` con la página que devolvió el servidor.

**Controles** (en la misma fila que la búsqueda y el selector de profesor; en móvil se apilan, sin scroll horizontal):
1. **Período**: `ControlSegmentado` con Anteriores · Hoy · Próximas · Todas. Elegir una opción → `desde = hasta = undefined`, `pagina: 1`, motivo `"filtro"`. Con rango activo ninguna opción queda marcada y al lado se ve el texto «Rango personalizado».
2. **Desde / Hasta**: dos `<input type="date">` con `<label>` visible. Al cambiar (valor completo o vacío):
   - Si queda al menos una fecha, `periodo = undefined` («Rango personalizado»).
   - Si se vacían las dos, vuelve a `periodo = "hoy"`.
   - Si `desde > hasta`: no se consulta. Se muestra junto al campo Desde «La fecha Desde no puede ser posterior a Hasta» (`aria-invalid="true"`, `aria-describedby` al mensaje, color `text-destructive`) y en el lugar de la tabla «Corregí el rango de fechas para ver las clases».
   - Si no, consulta con `pagina: 1`, motivo `"filtro"`.
3. **Materia**: `<select>` con etiqueta «Materia», opción «Todas» (`""`) y las opciones de `materias`. Las inactivas muestran `{nombre} · Inactiva` (en un `<select>` nativo no hay badge). Cambia con `pagina: 1`, motivo `"filtro"`. Visible para los tres roles.
4. **Profesor**: sin cambios (solo Gerente y Mesa).
5. **Limpiar filtros**: visible cuando el estado difiere del inicial. Deja `periodo "hoy"`, sin fechas, sin materia, sin `q` (vacía el input) y sin profesor; `pagina: 1`, motivo `"filtro"`. Reemplaza al botón «Limpiar» del chip de profesor. El chip conserva su «×» para quitar solo el profesor.

Ningún filtro pide confirmación (HU-C-25 criterio 5). Todo cambio vuelve a la página 1, se resuelve sin recargar (petición `fetch` + `replaceState`) e informa la cantidad («N clases», que ya existe en la línea 185).

**Subtítulo** (criterio 7). Reemplaza la línea de `desdeHoyOrden…`: `texto("ui.clases.listado.subtitulo", { periodo, orden })`, donde:
- `periodo` es la etiqueta del período, o en rango `rango.entre` / `rango.soloDesde` / `rango.soloHasta` con `fechaCorta(...)`.
- `orden` es `orden.descendente` con «Anteriores» y `orden.ascendente` en los demás casos.
- Se calcula con los filtros **del resultado mostrado** (`resultado`), no con los que se están pidiendo.
- Ejemplos: «Hoy · Orden: fecha y hora ascendente», «Anteriores · Orden: fecha y hora descendente», «Del 01/10/2026 al 13/10/2026 · Orden: fecha y hora ascendente».

La línea de ayuda de búsqueda («Buscá por profesor, materia o aula…») no cambia.

**Mensajes vacíos** (criterio 10, decisión 0.4.11):
- `periodo === "hoy"`, sin `q`, sin `profesorId` y sin `materiaId` → «No hay clases para hoy» más un botón «Ver próximas» (`variant="outline"`), que fija `periodo: "proximas"`, página 1, motivo `"filtro"`.
- Cualquier otro caso → «No se encontraron clases para los filtros elegidos».
- Con `desde > hasta` → «Corregí el rango de fechas para ver las clases» (sin consulta).

**Acciones por fila** (criterio 9). En la línea 187, «Continuar configuración» exige además `!turno.es_dia_anterior`. «Ver detalle» y «Descartar» no cambian (un Pendiente de un día anterior sigue ofreciendo «Descartar»).

**Retornos** (criterio 8): `retorno` y `hrefPagina` usan `urlListadoTurnos` con todos los filtros del `resultado`. «Ver detalle» y `urlContinuar` ya lo pasan como `volver`.

**Diseño:** tokens de `docs/DESIGN.md`, nada de hex; controles de la misma altura que el selector de profesor (`h-9`, `border-input`, `focus-within:ring`). El JSDoc del componente se actualiza para describir HU-C-27.

---

## 6. Base de datos

**`prisma/schema.prisma`, `model Turno`** (antes de `@@map("turnos")`):

```prisma
  // HU-C-27 (criterio 12): el listado filtra y ordena por fecha sin recorrer
  // la tabla, también con «Todas»; por profesor (HU-C-08 y alcance del
  // Profesor) y por materia, siempre con la fecha como segundo criterio.
  @@index([fechaTurno, horaInicioTurno])
  @@index([profesorId, fechaTurno])
  @@index([materiaId, fechaTurno])
```

**Migración:** `npx prisma migrate dev --create-only --name hu_c27_indices_listado_turnos` y renombrar la carpeta a `20261013160000_hu_c27_indices_listado_turnos` si el timestamp generado no queda después de `20261013120000`. El `migration.sql` tiene que tener **solo** los tres `CREATE INDEX "turnos_..._idx" ON "turnos"(...)`. Si `migrate dev` propone tocar triggers, constraints o el SQL manual del Sprint 3 (drift), se descarta eso y se deja solo lo de los índices. Aplicar con `npx prisma migrate dev` y verificar `npx prisma migrate status`.

Sin `CONCURRENTLY`: la tabla es chica en dev y las migraciones de Prisma corren dentro de una transacción.

---

## 7. Seed

**Archivo:** `prisma/seed.ts`. Objetivo: que «Hoy» y «Anteriores» tengan datos al resembrar, y que se puedan probar el criterio 9 (Pendiente de un día anterior) y el criterio 4 (materia inactiva con clase). **Dos corridas seguidas no duplican nada.**

1. **`TurnoSeed`** suma:
   - `hoy?: true`: la clase es del día en que se corre el seed. Es una cuarta forma de fijar la fecha, excluyente con `diaOperativo`, `semanal` y `fecha`.
   - `materiaInactiva?: true`: la clase es de una materia dada de baja, permitido solo en el pasado.
   - Se documentan en el comentario del tipo.
2. **`fechaDeTurno`**: `if (t.hoy) return hoy;`.
3. **`validarDatos`**:
   - La regla «exactamente uno de» incluye `hoy`.
   - `materia inactiva` se acepta solo si `t.materiaInactiva && fecha < hoy`. Con el flag en una fecha de hoy o futura es un error.
4. **Clases de hoy**: al armar `turnosSeed` (`main()`, línea ~1538), si `diaSemanaDeFecha(hoy)` no está en `PARAMETROS_HORARIO.diasOperativos`, se filtran las `hoy: true` y se imprime `  · Hoy no es día operativo: no se crean las clases de hoy (HU-C-27). Usar SEED_FECHA_HOY=AAAA-MM-DD con un día hábil.`.
5. **Filas nuevas** al final de `TURNOS`, con el comentario `// HU-C-27: clases de hoy y de días anteriores para el filtro «Período» del listado`. Las combinaciones de profesor/aula/hora/duración son las que ya validan las filas de `diaOperativo: 0` (franja común de todos los días operativos), en días donde no hay otras filas del seed:

| id | fecha | hora | dur. | materia | profesor | aula | estado resultante | para probar |
|---|---|---|---|---|---|---|---|---|
| `seed-turno-c27-hoy-1` | `hoy: true` | 08:00 | 120 | Matemática | 0 | Aula 1 | DISPONIBLE | Hoy (ya terminada si se siembra a la tarde) |
| `seed-turno-c27-hoy-2` | `hoy: true` | 10:00 | 120 | Programación I | 1 | Aula 2 | DISPONIBLE, `prioridad: "ALTA"` | Hoy |
| `seed-turno-c27-hoy-3` | `hoy: true` | 14:00 | 60 | Química | null | null | PENDIENTE | Hoy: **sí** ofrece «Continuar configuración» |
| `seed-turno-c27-ant-1` | `diaOperativo: -3` | 10:00 | 120 | Física | 0 | Aula 2 | DISPONIBLE | Anteriores |
| `seed-turno-c27-ant-2` | `diaOperativo: -3` | 12:00 | 60 | Bases de Datos | 1 | Aula 1 | CANCELADO (`cancelado: true`) | Anteriores, cuatro estados con «Todas» |
| `seed-turno-c27-ant-3` | `diaOperativo: -4` | 14:00 | 60 | Química | null | null | PENDIENTE | criterio 9: sin «Continuar», con «Descartar» |
| `seed-turno-c27-inactiva` | `diaOperativo: -5` | 10:00 | 60 | Historia de la Ciencia | null | null | PENDIENTE, `materiaInactiva: true` | criterio 4: opción «Historia de la Ciencia · Inactiva» |

   - Todas con `alumnos: []`. El paso 13 omite hoy y anteriores y el paso 14 omite hoy, así que no se inscribe a nadie. No hace falta tocar esos pasos.
   - Si `validarDatos` rechaza alguna combinación (por ejemplo, la franja de Bases de Datos del profesor 1), se cambia la hora por otra de la franja común y se documenta en el comentario de la fila. **No** se relaja la validación.
6. **Idempotencia**: ya la garantiza el paso 8 (ids fijos, «solo se crea si falta»). La segunda corrida informa `0 creados en esta corrida` para estas filas y no las mueve de fecha. No usar `upsert` con `update` (movería la fecha y pisaría lo que les hayan hecho las HU).
7. **Cabecera del archivo** (bloque «Turnos (HU-C-*)», líneas 82-95): sumar un párrafo «HU-C-27: 3 clases de hoy (solo si hoy es día operativo) y 4 de días anteriores (3, 4 y 5 días operativos antes), con un Pendiente anterior y una clase de la materia inactiva Historia de la Ciencia». Actualizar también los totales del encabezado.
8. Verificar:
   - `SEED_SOLO_VALIDAR=1 npx tsx prisma/seed.ts`.
   - `SEED_SOLO_VALIDAR=1 SEED_FECHA_HOY=2026-10-17 npx tsx prisma/seed.ts` (sábado: omite las de hoy sin error).
   - `npx prisma migrate reset` (corre el seed) seguido de `npx prisma db seed` otra vez, y comparar `SELECT count(*) FROM turnos` antes y después de la segunda corrida (tiene que dar igual).

---

## 8. Documentación

### 8.1. `docs/specs/spec_modulo_C.md`

1. **Nota aditiva** nueva antes de «## Nota aditiva — 01/10/2026» (línea 91): «## Nota aditiva — 13/10/2026: HU-C-27, filtros de período, fechas y materia en el listado». Resume el pedido del PO, lista las secciones que cambian (§2.4, §2.7, §2.16.5, §3.11) y aclara que el filtro por estado sigue fuera del producto.
2. **§2.4** (línea 599 en adelante):
   - Título: «… — ampliado por HU-C-27 (13/10/2026)».
   - Primer bullet: «Incluye turnos en los 4 estados…» se conserva.
   - Bullet de orden (línea 617), reemplazar por: «**Período y orden (HU-C-27):** el listado ya no se limita a la fecha actual en adelante. El parámetro `periodo` (2.7) corta por día calendario del centro: `anteriores` (días anteriores a hoy), `hoy` (por defecto, aunque ya hayan terminado), `proximas` (de mañana en adelante) y `todas`; o un rango `desde`–`hasta` inclusive. «Hoy» lo calcula el servicio con `ahora()` y `fechaCentro`/`finDelDiaCentro`. Orden por defecto: `fecha, hora_inicio` ascendente, `profesor_id` (nulos al final) e `id` como desempates; con `anteriores`, `fecha, hora_inicio` **descendente** con los mismos desempates.»
   - Bullet de Pendientes (línea 618): sumar «Un `PENDIENTE` de un día anterior (`es_dia_anterior: true`) no ofrece continuar su configuración (ya no puede pasar a Disponible); sigue ofreciendo «Descartar» (HU-C-27, criterio 9).»
   - Ejemplo de respuesta: agregar `"es_dia_anterior": false` a los ítems.
   - Errores: `400 VALIDATION_ERROR` pasa a «`400 VALIDACION`: parámetros de paginación o de filtro inválidos (2.7)».
   - En la nota de Revisión 5 (línea 604), «El listado agrega los parámetros de 2.7 (`q`, `profesor_id`)» pasa a «(`q`, `profesor_id` y, desde HU-C-27, `periodo`, `desde`, `hasta`, `materia_id`)».
3. **§2.7** (línea 759 en adelante):
   - Título: «Búsqueda en el listado y filtros por profesor, período, fechas y materia (HU-C-02, HU-C-08, HU-C-27)».
   - Nota de Revisión 6 (línea 761): corregir. La búsqueda **no** busca por alumno, así que la vigencia de las inscripciones no interviene en el filtro (solo en `alumnos_inscriptos`).
   - Bloque del schema: reemplazarlo por el de la sección 4.1 de esta task.
   - **Punto 3 de la búsqueda** (línea 784): «**Cada token** debe coincidir (parcialmente, `contains`) con **al menos uno** de estos campos: apellido o nombre normalizado del profesor, `nombreNormalizadaMateria`, `nombreNormalizadaAula`. **No** busca por alumno (decisión del equipo, 29/09/2026, `turno.busqueda.ts`). Entre tokens es AND; entre campos, OR.» Ajustar el ejemplo «Ana»: coincide con una profesora, una materia o un aula.
   - Punto 4 de la búsqueda (línea 785): «mismo orden por defecto (fecha/hora ascendente desde hoy…)» pasa a «mismo orden y mismo período o rango que el resto de los filtros (2.4)».
   - Punto 5 (línea 786) y punto 4 del profesor (línea 793): los mensajes vacíos pasan a los del criterio 10 de HU-C-27 («No hay clases para hoy» / «No se encontraron clases para los filtros elegidos»).
   - Subsección nueva «**Comportamiento esperado: período, rango y materia (HU-C-27)**»: período por defecto `hoy` en la API; período y rango excluyentes (400); `desde <= hasta` (400); fechas `AAAA-MM-DD` válidas (400); `materia_id` CUID de una materia existente (400 `VALIDACION` si no existe; existente sin clases → 200 vacío); se combinan con `q`, `profesor_id` y la paginación; la UI vuelve a la página 1 y actualiza la URL; opciones del selector de materia según la sección 4.4 de la task (activas más inactivas con clases para Gerente y Mesa; solo las materias de sus clases, activas o inactivas, para el Profesor; en los dos casos C calcula los ids con clases y L devuelve las materias).
   - Párrafo «Uso por HU-D-07» (línea 795): reemplazar «HU-C-02 AC6 excluye del listado los filtros por estado, fecha o materia, así que `materia_id`, `estados` y `solo_futuros` no existen aquí» por «el listado no tiene filtro por estado (`estados`) ni `solo_futuros` (reemplazado por `periodo`, HU-C-27), y su filtro por materia no está acotado a un profesor y a turnos futuros como pide el modal». El resto del párrafo sigue igual.
   - **Errores esperados** (línea 805): «`400` (parámetro inválido o ajeno al schema: `pagina`, `por_pagina`, `q`, `profesor_id` mal formado, `periodo` desconocido, `desde`/`hasta` inválidas, `desde` posterior a `hasta`, `periodo` junto con `desde`/`hasta`, `materia_id` mal formado o inexistente, `estados`, `solo_futuros`)».
4. **§2.16.5** (línea 1368): el primer bullet mete «listado y detalle de 2.4» entre las lecturas que «filtran `estadoTurno IN ("DISPONIBLE","COMPLETO")`», y eso contradice 2.4 (el listado muestra los cuatro estados). Reemplazar por dos bullets:
   - «Las lecturas que **ofrecen** clases (opciones de «Solicitar clase», «Mis clases», calendario y servicios públicos de 2.15) filtran `estadoTurno IN ("DISPONIBLE","COMPLETO")` y deciden Disponible/Completa con `ocupacion(db, turnoId, ahora())`.»
   - «El **listado y el detalle** de 2.4 muestran los cuatro estados (`PENDIENTE`, `DISPONIBLE`, `COMPLETO`, `CANCELADO`): `PENDIENTE` y `CANCELADO` tal cual y Disponible/Completa según la ocupación vigente (`estadoSegunOcupacion`). El listado no filtra por estado (HU-C-02 y HU-C-27).»
5. **§3.11** (línea 2029), reevaluación que pedía la propia sección («Si en Sprint 3 se agregan filtros combinados (HU-C-02 AC6), se reevalúa…»). Agregar al principio un bloque «> **Reevaluación HU-C-27 (13/10/2026).**» con:
   - Se agregan filtros combinados (período, rango, materia) y **la excepción no se amplía**: período y rango filtran `fechaTurno` (columna propia de C) y materia filtra `materiaId` (FK propia de C), sin leer columnas de otros módulos.
   - Las opciones del selector de materia salen de la fachada `materia.publico.ts` (L), y C solo aporta los ids de materia con clases de su propia tabla (todas, o las del profesor de la sesión).
   - La búsqueda de 2.7 sigue siendo la única que filtra por columnas de otros módulos (profesor, materia, aula). Mover ese filtro a servicios públicos se descarta otra vez por el mismo motivo (listas de ids potencialmente enormes para un patrón de 2 letras).
   - Corregir en el párrafo principal la lista de columnas: quitar `apellidoNormalizadoAlumno` y `nombreNormalizadoAlumno` (la búsqueda no es por alumno).
6. **Tabla de trazabilidad §4**: sin cambios (el listado no muta nada).

### 8.2. `docs/adicionales/mapa-pantallas-sprint-3.md` §1

- **Si el archivo existe** al implementar: agregar a la tabla de §1 la fila «Listado de clases (`/turnos`) | HU-C-27 | Filtros Período (Anteriores, Hoy, Próximas, Todas), Desde–Hasta y Materia; por defecto Hoy», con las columnas que tenga la tabla.
- **Si no existe** (estado verificado en este relevamiento): crearlo con:
  - Encabezado «# Mapa de Pantallas — Sprint 3».
  - Un aviso: «Este archivo se crea con HU-C-27 porque el mapa del PO no está en el repositorio. Solo registra cambios posteriores; al incorporar el mapa original, se fusionan sus filas en la tabla de §1 sin perder las de este archivo».
  - «## 1. Pantallas que se EXTIENDEN» con las columnas del mapa de Sprint 2 (`| Pantalla | HU de Sprint 3 que la extiende | Qué agrega |`) y la única fila: «Listado de clases (`/turnos`) | HU-C-27 | Filtros Período (Anteriores, Hoy, Próximas, Todas), Desde–Hasta y Materia; por defecto Hoy. No es una pantalla nueva (13/10/2026).»
  - No se inventa ninguna otra ficha (P-xx, DEC-xx).

### 8.3. `docs/RULES.md`

Sección nueva al final, «## Aplicación HU-C-27 — Filtros del listado de clases», con cinco bullets:
1. **Permiso y validación.** `turnos:leer` sin cambios. `ListarTurnosQuerySchema` (`.strict()`) valida `periodo`, `desde`, `hasta` (AAAA-MM-DD, inclusive, Desde ≤ Hasta, excluyentes con `periodo`) y `materia_id`. Todo lo inválido, y la materia inexistente, es `400 VALIDACION`. `estados` y `solo_futuros` siguen rechazados.
2. **Reloj y zona.** `listarTurnos` calcula «hoy» con `ahora()` y `fechaCentro`/`finDelDiaCentro`, nunca con `new Date()`, `Intl` ni copias locales. El mismo momento decide el corte, la vigencia de los inscriptos y `es_dia_anterior`.
3. **Orden y paginación.** Orden estable ascendente (fecha, hora, profesor con nulos al final, id); con «Anteriores», fecha y hora descendente con el mismo desempate. Filtrado y paginación en el servidor, con los índices `(fechaTurno, horaInicioTurno)`, `(profesorId, fechaTurno)` y `(materiaId, fechaTurno)`.
4. **Regla N.° 3.** Las opciones de materia salen de `listarMateriasParaFiltroDeClases` (L), que recibe de C los ids de las materias con clases: todas para Mesa y Gerente (más las activas sin clases), solo las del profesor para el Profesor. La excepción de §3.11 no se amplía.
5. **Pantalla.** Filtros en la URL (`periodo`, `desde`, `hasta`, `materia_id`, `q`, `profesor_id`, `pagina`; sin `orden`), conservados en el retorno del detalle y de los pasos de configuración. Sin confirmación al filtrar. Un Pendiente de un día anterior no ofrece «Continuar configuración». Textos en `ui.clases.listado.*` y `ui.clases.errores.listado.*`.

### 8.4. `docs/tasks/Sprint 2/HU-Sprint-2.md`

Debajo del criterio 6 de HU-C-02 (línea ~203), agregar: «> **Modificado por HU-C-27 (13/10/2026, pedido del PO):** el listado suma filtros por período, rango de fechas y materia. El filtro por estado sigue fuera del producto.» No se cambia el texto original del criterio.

---

## 9. Testing (tres niveles, según metodología del proyecto)

### Nivel 1: unitarios y de componentes

**`src/server/turnos/turno.schema.test.ts`** (casos nuevos de `ListarTurnosQuerySchema`):
- Acepta cada `periodo`, `desde` sola, `hasta` sola, `desde = hasta`, `materia_id` CUID, y todos combinados con `q` y `profesor_id`.
- Rechaza `periodo=ayer`, `desde=2026-02-30`, `desde=13/10/2026`, `desde > hasta` (error en `desde` con el texto del criterio 3), `periodo` + `desde`, `materia_id=no-cuid`, `estados`, `solo_futuros` y `orden`.

**`src/server/turnos/turno.listado.test.ts`** (mocks):
- **Actualizar** los dos tests que esperan `fechaTurno: { gte: … }` (líneas 57-65 y el `base` de la línea 75): sin `periodo`, el `where` es `{ fechaTurno: hoy }`.
- Agregar el mock de `@/server/materias/materia.publico` (`obtenerMateriasPorIds`).
- `it.each` de períodos, con el reloj fijado por `conReloj` y `vi.setSystemTime` puesto **en otro día** (prueba que se usa `ahora()` y no `new Date()`):
  - `anteriores` → `{ fechaTurno: { lt: hoy } }` y orden descendente.
  - `hoy` → `{ fechaTurno: hoy }`.
  - `proximas` → `{ fechaTurno: { gte: mañana } }`.
  - `todas` → sin `fechaTurno`.
  - Los tres últimos con orden ascendente.
- Borde de zona: `conReloj(new Date("2026-10-14T02:59:00Z"))` → `hoy = 2026-10-13`; `…T03:00:00Z` → `hoy = 2026-10-14`.
- Rango: ambas fechas (`gte` + `lte`), solo `desde`, solo `hasta`; orden ascendente.
- Materia existente → `materiaId` en el `where`; inexistente → `ServiceError` `VALIDACION` sin llamar a `count`.
- Combinación: `q` + `profesor_id` + `materia_id` + `periodo` en un único `where` (y `count` y `findMany` con el mismo `where`).
- Profesor con `profesor_id` ajeno + `materia_id` inexistente → `SIN_PERMISO` (el alcance se evalúa primero).
- `es_dia_anterior`: `true` para una clase de ayer, `false` para hoy y mañana.
- `listarOpcionesFiltroMateria` (con `@/server/materias/materia.publico` mockeado):
  - Profesor: `turno.findMany` con `where: { profesorId: <su ficha> }` y `distinct: ["materiaId"]`; `listarMateriasParaFiltroDeClases` con esos ids e `incluirActivasSinClases: false`; **nunca** llama a `obtenerMateriasDelProfesor`.
  - Profesor sin ficha → `[]`, sin consultar `turno`.
  - Mesa/Gerente: `findMany` sin `where` de profesor y con `distinct`, y `listarMateriasParaFiltroDeClases` con esos ids e `incluirActivasSinClases: true`.

**`src/app/api/turnos/listado.route.test.ts`:**
- Quitar el caso «materia_id (excluido por HU-C-02 AC6)» de la tabla de 400.
- El caso feliz pasa al servicio `{ q, profesor_id, periodo, desde, hasta, materia_id }` (con `undefined` donde no vienen).
- 400 sin llamar al servicio: `periodo` inválido, fecha inválida, **`desde` posterior a `hasta`** (verifica `detalles.fieldErrors.desde`), `periodo` + `hasta`, `materia_id` mal formado; `estados` y `solo_futuros` siguen dando 400.
- `ServiceError("VALIDACION")` del servicio (materia inexistente) → 400 con `{ code: "VALIDACION", message }`.

**`src/lib/turno-listado.test.ts`:** sin `orden`; orden fijo de parámetros; con rango no escribe `periodo`; siempre empieza con `/turnos?` y tiene `pagina`.

**`src/app/(dashboard)/turnos/turnos-listado.test.tsx`:**
- Actualizar los `href` esperados (líneas 56-61 y siguientes): `volver=%2Fturnos%3Fperiodo%3Dhoy%26pagina%3D2` en lugar de `…orden%3Dfecha_hora_asc`. Quitar la prop `orden` de `montar`.
- Al montar sin filtros consulta `periodo=hoy` y el subtítulo dice «Hoy · Orden: fecha y hora ascendente».
- Cambiar a «Anteriores» → consulta `periodo=anteriores&pagina=1`, `replaceState` con esos filtros y subtítulo «Anteriores · Orden: fecha y hora descendente». Lo mismo para «Próximas» y «Todas».
- Cargar Desde → «Rango personalizado», consulta sin `periodo`; después elegir «Hoy» → vacía Desde y Hasta.
- Solo Hasta → consulta con `hasta` y subtítulo «Hasta el DD/MM/AAAA…».
- Desde posterior a Hasta → mensaje junto al campo, «Corregí el rango de fechas para ver las clases» y **ninguna** consulta nueva.
- Selector de materia: «Todas» más las opciones, la inactiva con «Inactiva»; elegir una consulta `materia_id` en la página 1.
- Combinación con búsqueda y profesor: la URL final tiene `q`, `profesor_id`, `periodo`, `materia_id` y `pagina=1`.
- «Limpiar filtros» vuelve a `periodo=hoy`, sin `q`, sin profesor ni materia, y vacía el input.
- Vacío con Hoy sin filtros → «No hay clases para hoy» + «Ver próximas», que consulta `periodo=proximas`. Vacío con cualquier otro filtro → «No se encontraron clases para los filtros elegidos».
- Fila `PENDIENTE` con `es_dia_anterior: true` → sin «Continuar configuración», con «Descartar». Con `es_dia_anterior: false` sigue mostrando ambos.
- Props de la URL (`periodo`, `desde`, `materiaId`) → la primera consulta ya va filtrada (criterio 8, enlace con filtros).
- Ninguna interacción de filtro abre un diálogo (criterio 13).

**`src/app/(dashboard)/turnos/turnos-listado-profesor.test.tsx`:** actualizar las URLs esperadas (líneas 71 y 127-128) sin `orden` y con `periodo`; el Profesor ve el selector de materia y no el de profesor; su vacío con Hoy también ofrece «Ver próximas».

### Nivel 1 (PostgreSQL real): `src/server/turnos/turno.listado-profesor.pg.test.ts`

- **Actualizar:** las clases de `FUTURO = "2099-03-10"` ya no aparecen con el período por defecto. Los `listarTurnos` existentes pasan `{ periodo: "todas" }` (o `"proximas"`) y el comentario de la línea 13 se corrige.
- **Agregar** (mismo prefijo aislado y misma guarda `HU_C15_TEST_DATABASE_URL`), con `conReloj` fijo:
  - Clases ayer, hoy (una ya terminada) y mañana del mismo profesor → `anteriores`/`hoy`/`proximas`/`todas` devuelven exactamente las esperadas.
  - `anteriores` viene en orden fecha/hora descendente.
  - Rango inclusive en ambos bordes.
  - `materia_id` filtra.
  - El Profesor solo ve las suyas con cualquier período.
  - `es_dia_anterior` correcto.
  - **Opciones de materia del Profesor (criterio 4)**: el profesor `p1` tiene asociadas (`profesor_materia`) tres materias del prefijo:
    - `m-activa-con-clases`: activa, con una clase suya.
    - `m-asociada-sin-clases`: activa, asociada pero sin clases suyas, aunque sí con una clase de `p2`.
    - `m-inactiva-con-clases`: con una clase suya y después dada de baja (`activaMateria: false`).
    
    `listarOpcionesFiltroMateria({ id: <usuario de p1>, rol: "PROFESOR" })` devuelve, entre las del prefijo, exactamente `m-activa-con-clases` (`activa: true`) y `m-inactiva-con-clases` (`activa: false`). **No** incluye `m-asociada-sin-clases`. Con Mesa de entrada, la misma llamada incluye las tres (la tercera por ser inactiva con clases y las otras por activas).
- Limpiar todo lo creado en `afterAll` como ya hace el archivo.

### Nivel 2: Postman

`docs/testing/Modulo C/hu-c-27/HU-C-27.postman_collection.json` (sin secretos ni cookies; variables `baseUrl`, `materiaId`, `profesorId`):
- `GET /api/turnos` sin parámetros → 200, todas las fechas = hoy.
- `?periodo=anteriores` → 200, fechas < hoy, orden descendente (script que lo verifica).
- `?periodo=proximas` y `?periodo=todas` → 200.
- `?desde=…&hasta=…` → 200 dentro del rango; `?desde=2026-10-20&hasta=2026-10-01` → 400 `VALIDACION`.
- `?periodo=hoy&desde=2026-10-01` → 400.
- `?materia_id={{materiaId}}` → 200; `?materia_id=<cuid inexistente>` → 400.
- `?estados=CANCELADO` → 400.
- Con sesión de Profesor: `?periodo=todas` → solo sus clases; `?profesor_id=<ajeno>` → 403.

### Nivel 3: BD / TablePlus

En `HU-C-27-evidencia.md`:
- `\d turnos` (o la consulta a `pg_indexes`) muestra los tres índices.
- `EXPLAIN (ANALYZE)` de la consulta de «Todas» paginada (`ORDER BY "fechaTurno", "horaInicioTurno" … LIMIT 10`) y de «Anteriores» (`… DESC`): `Index Scan` (o `Index Scan Backward`) sobre `turnos_fechaTurno_horaInicioTurno_idx`. Con pocas filas, PostgreSQL puede elegir `Seq Scan`; para la evidencia correr antes `SET enable_seqscan = off;` y dejarlo anotado.
- `EXPLAIN` con `"profesorId" = …` y con `"materiaId" = …` usa sus índices.
- Seed: dos corridas seguidas de `npx prisma db seed` dejan el mismo `count(*)` de `turnos`, y las filas `seed-turno-c27-*` existen con las fechas esperadas.

**Evidencia de pantalla:** capturas de `/turnos` con Hoy (con datos y vacío con «Ver próximas»), Anteriores (orden descendente y el Pendiente sin «Continuar configuración»), Rango personalizado con el error Desde > Hasta, Materia con una inactiva, y el retorno desde el detalle conservando los filtros. Con Mesa de entrada, Gerente y Profesor.

---

## 10. Checklist de Definition of Done

- [ ] `ListarTurnosQuerySchema` con `periodo`, `desde`, `hasta` y `materia_id`, `.strict()`, comentario de la línea 9 actualizado; todo lo inválido da 400.
- [ ] `listarTurnos` sin `new Date()`, sin `Intl` y sin copias locales de la zona: usa `ahora()`, `fechaCentro` y `finDelDiaCentro`; período por defecto `hoy`; rango inclusive; materia validada; orden descendente solo con «Anteriores»; `es_dia_anterior` por ítem.
- [ ] `GET /api/turnos` pasa los filtros nuevos y traduce `VALIDACION` a 400; acceso por rol sin cambios.
- [ ] `listarMateriasParaFiltroDeClases` (L) y `listarOpcionesFiltroMateria` (C) sin lecturas cruzadas de tablas (Regla N.° 3); el Profesor ve solo las materias de sus clases (activas o inactivas), sin `obtenerMateriasDelProfesor`.
- [ ] `urlListadoTurnos` con los filtros nuevos, sin `orden` y siempre con `pagina`; el retorno del detalle y de configuración/participantes conserva filtros y página.
- [ ] Pantalla: Período (Hoy por defecto), Desde–Hasta con «Rango personalizado» y error inline, Materia con «Inactiva», «Limpiar filtros», subtítulo, mensajes vacíos con «Ver próximas», sin «Continuar configuración» en un Pendiente de un día anterior, sin confirmaciones.
- [ ] Textos nuevos en `textos.ts`; las cuatro claves viejas borradas tras el grep; `scripts/verificar-claves-textos.ts` en verde.
- [ ] Tres `@@index` en `Turno` y migración `20261013160000_hu_c27_indices_listado_turnos` con solo los `CREATE INDEX`; `prisma migrate status` limpio.
- [ ] Seed con clases de hoy (solo en día operativo) y de días anteriores, incluidos un Pendiente anterior y una clase de materia inactiva; validado con `SEED_SOLO_VALIDAR` (día hábil y sábado); dos corridas seguidas sin duplicar.
- [ ] Spec C actualizada (nota aditiva, §2.4, §2.7 incluidos punto 3 y errores, §2.16.5, §3.11); mapa de pantallas §1; RULES «Aplicación HU-C-27»; nota en HU-C-02 del backlog de Sprint 2.
- [ ] Tests de los tres niveles en verde (`npm test`, el `.pg.test.ts` con la base de prueba, Postman), con evidencia en `docs/testing/Modulo C/hu-c-27/`.
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] PR con diff acotado a esta task.
