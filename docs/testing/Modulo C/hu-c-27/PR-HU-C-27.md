# HU-C-27: Ver todas las clases con filtros de período, fechas y materia

## 📌 Descripción del Pull Request

Se implementa la funcionalidad correspondiente a la Historia de Usuario **HU-C-27** (pedido del PO del 13/10/2026).

### Qué resuelve

El listado «Clases» (`/turnos`) solo mostraba las clases desde hoy en adelante. Ahora muestra las anteriores, las de hoy y las próximas, con filtros de **Período** (Anteriores, Hoy, Próximas, Todas), **rango de fechas** (Desde–Hasta) y **Materia**, que se combinan con la búsqueda (HU-C-02) y el filtro por profesor (HU-C-08). Al entrar, el período por defecto es **«Hoy»**. Todo se filtra y pagina en el servidor, y los filtros quedan en la URL.

## ❔ Modificación de archivos esenciales

¿Se modificó?
- [x] schema.prisma (tres `@@index` en `Turno`)
- [x] seed.ts (clases de hoy y de días anteriores)

## 🧩 Cambios

### Pantalla
- `src/app/(dashboard)/turnos/turnos-listado.tsx`: Período (control segmentado), Desde–Hasta con «Rango personalizado» y error junto al campo, selector de Materia (con «· Inactiva»), «Limpiar filtros», subtítulo «{período} · Orden: {orden}», mensajes vacíos nuevos («No hay clases para hoy» + «Ver próximas» / «No se encontraron clases para los filtros elegidos»). Un Pendiente de un día anterior ya no ofrece «Continuar configuración». Se quita la prop `orden`.
- `src/app/(dashboard)/turnos/page.tsx`: lee y sanea `periodo`, `desde`, `hasta` y `materia_id` de la URL (un valor inválido no termina en 400 en pantalla) y trae las opciones de materia en el servidor.
- `src/lib/turno-listado.ts`: `urlListadoTurnos` escribe los filtros nuevos en orden fijo, ya no escribe `orden` y siempre incluye `pagina` (se mantiene el prefijo `/turnos?` que exigen configuración y participantes).

### API y servicio
- `src/server/turnos/turno.schema.ts`: `ListarTurnosQuerySchema` (`.strict()`) suma `periodo`, `desde`, `hasta` y `materia_id`, con dos `refine` (período y rango excluyentes; Desde ≤ Hasta). Exporta `PERIODOS_LISTADO_TURNOS`.
- `src/server/turnos/turno.service.ts`: `listarTurnos` calcula «hoy» con `ahora()` + `fechaCentro`/`finDelDiaCentro` (se elimina la copia con `Intl` + `new Date()`), aplica período o rango y materia, valida que la materia exista, ordena en forma descendente con «Anteriores» y agrega `es_dia_anterior` a cada ítem. Función nueva `listarOpcionesFiltroMateria(usuario)`.
- `src/server/materias/materia.publico.ts` (L): función nueva `listarMateriasParaFiltroDeClases(ids, { incluirActivasSinClases })`.
- `src/app/api/turnos/route.ts`: pasa los filtros nuevos y traduce `ServiceError("VALIDACION")` a `400`.
- `src/types/turno.types.ts`: `TurnoListado`, `PeriodoListadoTurnos` y `OpcionMateriaFiltro`.

### Base de datos (migración con los índices)
- `prisma/schema.prisma`: `@@index([fechaTurno, horaInicioTurno])`, `@@index([profesorId, fechaTurno])` y `@@index([materiaId, fechaTurno])` en `model Turno`.
- `prisma/migrations/20261013153953_hu_c_27_indices_turnos/migration.sql`: solo los tres `CREATE INDEX` sobre `turnos`.

### Seed
- `prisma/seed.ts`: `TurnoSeed` suma `hoy` y `materiaInactiva`. 7 clases nuevas `seed-turno-c27-*`: 3 de hoy (2 Disponibles y 1 Pendiente, solo si hoy es día operativo) y 4 de días anteriores (Disponible, Cancelada, Pendiente sin «Continuar configuración» y Pendiente de la materia inactiva «Historia de la Ciencia»). Sigue siendo idempotente porque usa ids fijos.

### Textos
- `src/lib/textos.ts`: claves nuevas `ui.clases.listado.*` y `ui.clases.errores.listado.*`. Se borran las cuatro claves viejas del listado (`desdeHoyOrden…`, `noSeEncontraronClasesPara`, `esteProfesorNoTieneClasesRegistradas`, `noHayClasesRegistradas`) y `ui.clases.interfaz.limpiar`, que ya no tenían consumidores.

### Documentación
- `docs/specs/spec_modulo_C.md`: nota aditiva del 13/10/2026; §2.4 (período, orden, `es_dia_anterior`, error `400 VALIDACION`); §2.7 (parámetros nuevos, corrección de que la búsqueda **no** busca por alumno, errores esperados); §2.16.5 (el listado muestra los cuatro estados); §3.11 (reevaluación: la excepción no se amplía).
- `docs/RULES.md`: sección «Aplicación HU-C-27 — Filtros del listado de clases».
- `docs/adicionales/mapa-pantallas-sprint-3.md`: archivo nuevo (no estaba en el repo), con la fila del listado de clases en §1.
- `docs/tasks/Sprint 2/HU-Sprint-2.md`: nota «Modificado por HU-C-27» debajo del criterio 6 de HU-C-02.
- `docs/tasks/Sprint 3/Modulo C/HU-C-27.md`: la task.
- `docs/testing/Modulo C/hu-c-27/`: `HU-C-27-evidencia.md`, `HU-C-27.sql` y `HU-C-27.postman_collection.json`.

### Tests
- `src/server/turnos/turno.schema.test.ts`: períodos, rangos, combinaciones y rechazos (`periodo=ayer`, fechas inválidas, Desde > Hasta, período + rango, `materia_id` mal formado, `estados`, `solo_futuros`, `orden`).
- `src/server/turnos/turno.listado.test.ts`: `where` por período, corte a medianoche del centro, rango, materia, combinación, orden, `es_dia_anterior`, opciones de materia por rol.
- `src/app/api/turnos/listado.route.test.ts`: parámetros nuevos al servicio y casos de 400.
- `src/lib/turno-listado.test.ts`: formato de la URL.
- `src/app/(dashboard)/turnos/turnos-listado.test.tsx` y `turnos-listado-profesor.test.tsx`: filtros, subtítulo, rango, mensajes vacíos, acciones por fila y URLs actualizadas.
- `src/server/turnos/turno.listado-profesor.pg.test.ts` (PostgreSQL real): períodos, orden de «Anteriores», rango inclusive, materia, alcance del Profesor y opciones de materia.

## ✅ Criterios de aceptación

- [x] **1. Todas las clases, en los cuatro estados.** Con `periodo=todas` no hay condición de fecha: `turno.listado.test.ts` («HU-C-27 período, rango y materia»), `turno.listado-profesor.pg.test.ts` y las clases Pendiente, Disponible y Cancelada del seed.
- [x] **2. Período por día del centro, con `ahora()`.** `condicionFechaListado` en `turno.service.ts`; tests `it.each` de períodos y «corta a medianoche del centro (UTC−3), no a la de UTC» en `turno.listado.test.ts`; test PG «cada período corta por el día del centro».
- [x] **3. Desde–Hasta.** Pantalla: `turnos-listado.test.tsx` («cargar Desde pasa a Rango personalizado…», «se puede cargar solo Hasta», «Desde posterior a Hasta: aviso junto al campo…»). API: `listado.route.test.ts` («Desde posterior a Hasta → 400»). PG: «rango inclusive en ambos bordes».
- [x] **4. Materia.** `listarOpcionesFiltroMateria` + `listarMateriasParaFiltroDeClases`; tests «opciones del filtro Materia» en `turno.listado.test.ts`, los dos de opciones en el `.pg.test.ts` (la materia asociada sin clases no aparece; la inactiva con clases sí) y «filtro Materia… la inactiva con Inactiva» en `turnos-listado.test.tsx`.
- [x] **5. Combinación, página 1, cantidad y «Limpiar filtros».** «combina período, materia, búsqueda y profesor en un único where» (servicio); «combina búsqueda, profesor, período y materia en la consulta, la URL y el retorno» y «Limpiar filtros vuelve a Hoy…» (pantalla). El contador «N clases» ya existía y se conserva.
- [x] **6. Orden.** `ORDEN_LISTADO_ASC` / `ORDEN_LISTADO_ANTERIORES` en `turno.service.ts`; `it.each` de períodos (asc/desc) en `turno.listado.test.ts` y el test PG de orden de «Anteriores».
- [x] **7. Subtítulo.** Función `subtitulo` en `turnos-listado.tsx`; tests «entra con Hoy por defecto…» y el `it.each` Anteriores/Próximas/Todas en `turnos-listado.test.tsx`.
- [x] **8. Filtros en la URL.** `urlListadoTurnos` (`turno-listado.test.ts`); retorno de «Ver detalle», «Continuar configuración» y el paginador (`turnos-listado.test.tsx`, líneas 56-61); un enlace con filtros abre el listado ya filtrado (test de la combinación, que monta con `periodo`, `materiaId`, `q` y `profesorId`).
- [x] **9. Pendiente de un día anterior.** `!turno.es_dia_anterior` en la acción de la fila; test «un Pendiente de un día anterior no ofrece Continuar configuración pero sí Descartar»; `seed-turno-c27-ant-3`.
- [x] **10. Mensajes vacíos.** Tests «vacío con Hoy y sin filtros… Ver próximas» y «vacío con Hoy y una materia elegida» (`turnos-listado.test.tsx`), y el caso del Profesor en `turnos-listado-profesor.test.tsx`.
- [x] **11. Acceso y validación.** Acceso sin cambios (`alcanceProfesorListado` no se tocó); test «el Profesor con profesor_id ajeno recibe SIN_PERMISO antes de validar la materia»; los 400 en `turno.schema.test.ts` y `listado.route.test.ts` (incluido «materia inexistente → 400»); test PG «el Profesor ve solo sus clases con cualquier período».
- [x] **12. Rendimiento.** Tres índices en `schema.prisma` + migración. Los planes `EXPLAIN` (`Index Scan` / `Index Scan Backward` sobre los tres índices, con `enable_seqscan = off` porque la tabla es chica) están en `HU-C-27-evidencia.md` §5 y `HU-C-27.sql`. No hay un test automático de rendimiento.
- [x] **13. Textos y confirmación.** Claves en `textos.ts`, todas con «clase»; `claves-textos.test.ts` pasa cuando se corre solo; test «filtrar no abre ningún diálogo de confirmación (HU-C-25 c5)».
- [x] **14. Pruebas.** Se actualizaron los tests existentes del listado (servicio, API y pantalla) y se agregaron los casos pedidos (ver «Tests»).

## 🧭 Decisiones tomadas

1. **Período por defecto también en la API.** Si no llegan `periodo`, `desde` ni `hasta`, `listarTurnos` usa `"hoy"`. El único consumidor de `GET /api/turnos` es esta pantalla, así que no hay que mantener compatibilidad con el «desde hoy» anterior.
2. **Período y rango son excluyentes.** Mandar `periodo` junto con `desde` o `hasta` da `400`. No existe `periodo=rango`: el rango se expresa solo con `desde`/`hasta`. La pantalla nunca manda las dos cosas juntas.
3. **Corte por día calendario del centro** con un único `momento = ahora()`: `hoy = fechaCentro(momento)` y `mañana = fechaCentro(finDelDiaCentro(momento))`. Anteriores `< hoy`, Hoy `= hoy`, Próximas `>= mañana`, Todas sin condición, y rango inclusive. El mismo momento se usa para el corte, la vigencia de los inscriptos y `es_dia_anterior`.
4. **Orden:** ascendente (fecha, hora, profesor con nulos al final, id) por defecto. Con «Anteriores», fecha y hora en forma descendente, con el mismo desempate.
5. **`es_dia_anterior` lo calcula el servidor**, así la pantalla no depende del reloj del navegador. Se agrega solo en el `map` del listado, no en `presentar()`, así el detalle no cambia.
6. **Materia inexistente:** un CUID bien formado sin ficha da `400 VALIDACION`. Una materia que existe pero no tiene clases para ese usuario devuelve `200` con la lista vacía.
7. **Opciones de materia para Mesa de entrada y Gerente:** C calcula los ids de las materias que tienen clases (`distinct materiaId` en `turnos`) y L devuelve las activas más las inactivas de esa lista. C no lee `materias` y L no lee `turnos` (Regla N.° 3).
8. **Opciones de materia para el Profesor:** el mismo mecanismo, acotado a sus clases, con solo esas materias (activas o inactivas). No se usa `obtenerMateriasDelProfesor`: esa función devuelve las materias *asociadas* al profesor, no las de sus clases.
9. **Opciones en el servidor, sin endpoint nuevo:** `page.tsx` llama a `listarOpcionesFiltroMateria` y las pasa por props.
10. **Parámetros inválidos en la URL al entrar:** `page.tsx` los sanea. Un período desconocido pasa a «hoy», una fecha inválida se ignora y una materia que no está entre las opciones queda vacía. Si la URL trae Desde > Hasta, se muestra el error sin consultar.
11. **«Sin otros filtros»** (criterio 10) significa Hoy, sin `q` efectivo (menos de 2 caracteres), sin profesor y sin materia. El alcance implícito del Profesor no cuenta como filtro.
12. **Mensajes vacíos:** los tres mensajes anteriores se reemplazan por los dos del criterio 10, y se borran sus claves.
13. **Índices con `@@index` de Prisma**, con los nombres por defecto. «Anteriores» recorre el índice de fecha y hora hacia atrás, sin necesitar un índice `DESC` aparte.
14. **Clases de hoy en el seed:** solo se crean si hoy es día operativo; si no, se omiten con un aviso. Como las clases no se mueven al volver a sembrar, para ver «Hoy» con datos otro día hay que usar `npx prisma migrate reset` o `SEED_FECHA_HOY`.

## 🧪 Cómo probarlo

1. `npm install`
2. `npx prisma migrate dev` (aplica `20261013153953_hu_c_27_indices_turnos`). Verificar con `npx prisma migrate status`.
3. `npx prisma db seed`. Si hoy no es día operativo, el seed avisa que omite las clases de hoy: en ese caso usar `SEED_FECHA_HOY=AAAA-MM-DD` con un día hábil, o `npx prisma migrate reset` en un día hábil.
4. `npm run dev` y entrar como **mesa de entrada** (`mesa.entrada@noctium.local` / `Password123!`) a `/turnos`.
5. **Hoy** (por defecto): aparecen las clases de hoy del seed (`seed-turno-c27-hoy-*`), incluso las que ya terminaron. El subtítulo dice «Hoy · Orden: fecha y hora ascendente». El Pendiente de hoy ofrece «Continuar configuración».
6. **Anteriores:** la clase más reciente aparece primero y el subtítulo dice «… descendente». El Pendiente anterior (Química) **no** ofrece «Continuar configuración», pero sí «Descartar». También aparece la clase Cancelada.
7. **Próximas** y **Todas:** con «Todas» se ven los cuatro estados.
8. **Rango:** cargar solo Desde → «Rango personalizado» y el subtítulo «Desde el DD/MM/AAAA…». Cargar también Hasta → «Del … al …». Elegir un período → las fechas se vacían.
9. **Error de rango:** poner Desde posterior a Hasta → aparece «La fecha Desde no puede ser posterior a Hasta» junto al campo, el listado muestra «Corregí el rango de fechas para ver las clases» y no se hace ninguna consulta (se puede ver en la pestaña Red).
10. **Materia:** el selector muestra «Todas», las activas y «Historia de la Ciencia · Inactiva». Al elegirla con «Anteriores» aparece su clase. Combinarla con la búsqueda y el profesor, revisar que la URL tenga todos los filtros, entrar a «Ver detalle» y volver: se conservan los filtros y la página.
11. **Vacío:** con Hoy y sin filtros en un día sin clases → «No hay clases para hoy» + «Ver próximas». Con cualquier filtro → «No se encontraron clases para los filtros elegidos». «Limpiar filtros» vuelve a Hoy.
12. **API:** `GET /api/turnos?periodo=hoy&desde=2026-10-01` → 400; `?desde=2026-10-20&hasta=2026-10-01` → 400; `?estados=CANCELADO` → 400. También se puede usar la colección `docs/testing/Modulo C/hu-c-27/HU-C-27.postman_collection.json`.
13. **Como profesor** (`profesor2@noctium.local` / `Password123!`, que tiene clases `c27` de hoy y anteriores): no ve el selector de profesor, ve el de materia solo con las materias de sus clases y ve únicamente sus clases en cualquier período.

## 📊 Resultado de las verificaciones (corridas el 14/10/2026 sobre `develop`, `030e0e7`)

| Verificación | Resultado |
|---|---|
| `npm run build` | ✅ Exit 0. Compila y genera las 69 páginas. |
| `npm run lint` | ✅ Exit 0: 0 errores y 1 aviso previo (`CALENDARIO` sin usar en `src/components/layout/Sidebar.tsx`, que no es de esta HU). |
| Tests de HU-C-27 (`vitest run` con los 7 archivos del listado) | ✅ **139 pasan**, 10 omitidos (los del `.pg.test.ts`, que necesitan base). |
| `npm run test:pg -- src/server/turnos/turno.listado-profesor.pg.test.ts` | ✅ **10/10 pasan** (base descartable con todas las migraciones aplicadas, incluida la de HU-C-27). |
| `npm test` (suite completa) | ⚠️ Exit 1: **4382 pasan, 3 fallan**, 550 omitidos (327 archivos pasan, 2 fallan, 67 omitidos). Ninguno de los 3 fallos es de esta HU (ver abajo). |

Fallos de la suite completa, ajenos a HU-C-27:
- `src/lib/claves-textos.test.ts` › «todas las referencias reales tienen texto…»: **timeout de 60 s** en la suite completa. Corrido solo, pasa (**36/36**). Es el mismo fallo que ya documentan las evidencias de HU-C-26 y HU-C-27.
- `src/server/shared/actividad-usuario.test.ts` (2 tests): `TypeError: Cannot read properties of undefined (reading 'findFirst')` en `configuracion.publico.ts`. Esos archivos vienen de los commits de **HU-N-01**, que entraron a `develop` después de HU-C-27.

## 📝 Notas para el revisor

- **Cambia un criterio de una HU ya cerrada:** el criterio 6 de HU-C-02 excluía los filtros por fecha y materia. Se agrega una nota «Modificado por HU-C-27» en `docs/tasks/Sprint 2/HU-Sprint-2.md`, sin tocar el texto original. En la spec C cambian **§2.4** (el listado ya no se limita a desde hoy; período, orden y `es_dia_anterior`) y **§2.7** (parámetros nuevos; `materia_id` deja de estar prohibido). El filtro por estado (`estados`) sigue fuera del producto y `.strict()` lo sigue rechazando.
- La spec §2.7 y §3.11 decían que la búsqueda filtraba por alumno. El código no lo hacía (decisión del 29/09/2026), así que se corrigió **solo la spec**; el código de búsqueda no cambia.
- **La migración agrega tres índices a la tabla `turnos`** (`turnos_fechaTurno_horaInicioTurno_idx`, `turnos_profesorId_fechaTurno_idx`, `turnos_materiaId_fechaTurno_idx`). No hay columnas ni datos nuevos y no usa `CONCURRENTLY`, porque Prisma corre la migración dentro de una transacción.
- Al generar la migración, `prisma migrate dev` también propuso un `DROP`/`ADD` de la FK `reservas_turno_turnoId_fkey` (`ON UPDATE CASCADE`). Es una diferencia previa entre `schema.prisma` y la migración `20260924150000` y no es de esta HU, así que se sacó del archivo (está explicado en un comentario). `migrate dev` lo va a seguir proponiendo hasta que se resuelva aparte.
- La carpeta de la migración se llama `20261013153953_hu_c_27_indices_turnos` y no `20261013160000_hu_c27_indices_listado_turnos` como sugería la task. La task pedía renombrarla solo si el timestamp quedaba antes de `20261013120000`, y no fue el caso.
- El saneo de parámetros de `page.tsx` (decisión 10) no tiene un test propio. Lo cubren de forma indirecta los tests del componente.
- La colección Postman está escrita pero **no se corrió**, y no hay capturas de pantalla (lo aclara `HU-C-27-evidencia.md` §7).

## 🔗 Vinculación con GitHub Projects (Automatización)

Closes #

🤖 Generated with [Claude Code](https://claude.com/claude-code)
