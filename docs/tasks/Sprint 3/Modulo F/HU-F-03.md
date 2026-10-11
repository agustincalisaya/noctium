# TASK: HU-F-03 — Listar personal de mesa de entrada

**Módulo:** F (Personal de mesa de entrada) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_F.md` §2.3 (listado y búsqueda), §1 («Quién construye qué», DEC-38) y §3.7 · `docs/specs/spec_modulo_B.md` §2.7 y §3.9 (criterio de búsqueda de HU-B-05) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-F-03, criterios 1 a 5) · `docs/tasks/Sprint 3/Modulo F/HU-F-01.md` (sección 9: qué dejó hecho)
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figura 92 («Personal de mesa de entrada», Gerente), **solo la página 83**. Muestra el listado con el buscador y tres filas (una inactiva); no muestra paginación ni los estados vacíos. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog.
**RBAC:** solo **GERENTE** (`personal:leer`, ya sembrado). Cualquier otro rol recibe `403 SIN_PERMISO` en el servidor (spec F §3.7).
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. El índice del listado (apellido y nombre normalizados) lo creó el PR 0.
**Rama:** `feat/hu-f-03-listar-personal`, creada desde `develop` actualizado (F-01 ya está mergeada, PR #242).
**Estado de la HU:** decisiones tomadas (sección 0); se implementa en una sola etapa (sección 8).

---

## 0. Decisiones y verificaciones previas

### 0.1. Decisiones (no relevar de nuevo)

1. **Es completar lo que dejó F-01 (DEC-38).** F-01 dejó `GET /api/personal` y `/personal` sin `q` ni paginación, con `listarPersonal()` que devuelve `{ items, total }`. F-03 suma búsqueda y paginación sobre eso; no crea pantallas ni rutas nuevas.
2. **Servicio.** `listarPersonal(query, db = prisma)`, con `query = { pagina, q? }`. Orden por `apellidoNormalizado`, `nombreNormalizado` y `dni`, ascendente. `skip`/`take` con `POR_PAGINA_PERSONAL = 10` fijo. `total` es el del resultado **filtrado**. Los llamadores de F-01 (página, ruta y tests) se adaptan; ningún test de F-01 se borra ni se debilita.
3. **Query.** `ListarPersonalQuerySchema` en `personal.schema.ts`, tal cual la spec F §2.3: `pagina` entero positivo (por defecto 1), `q` con `trim` y máximo 100 caracteres, `.strict()`. **`por_pagina` no es parámetro**: enviarlo es `400 VALIDATION_ERROR` (distinto de `/api/alumnos`, que sí lo acepta). El 400 usa el mismo formato que el resto de `/api/personal` (`VALIDATION_ERROR` con `detalles`).
4. **Búsqueda.** Un filtro propio `construirFiltroBusquedaPersonal(q)` en `src/server/personal/personal.busqueda.ts`, copia del de alumnos (`src/server/alumnos/alumno.busqueda.ts`) sobre las columnas `apellidoNormalizadoFichaMesaEntrada`, `nombreNormalizadoFichaMesaEntrada` y, solo si el token es numérico, `dniFichaMesaEntrada`. Tokens en AND, campos en OR, coincidencia parcial. `q` de menos de 2 caracteres tras `trim` se ignora y devuelve el listado completo. Opera sobre activos e inactivos.
5. **Diferencia spec/código (anotar en la nota aditiva de la spec).** La spec F dice que `tokenizarBusqueda` vive en `src/server/shared/busqueda-persona.ts` y que lo crea la primera HU que lo necesita. En el repo ya existe `tokenizarBusqueda` en `src/lib/busqueda-texto.ts` (lo usan alumnos y turnos): **se reutiliza esa y no se crea `busqueda-persona.ts`**.
6. **Respuesta de la ruta.** `{ items, pagina, por_pagina, total, total_paginas }` (spec F §2.3). Los tipos de `src/types/personal.types.ts` se actualizan. Es distinta de la de alumnos (`paginacion.pagina_actual…`): la pantalla adapta los nombres al componente `Pagination`, sin cambiar la respuesta de la spec.
7. **Pantalla.** `page.tsx` (servidor) lee `pagina` y `q` de la URL y entrega el primer render; un componente de cliente nuevo, `listado-personal.tsx`, copia la mecánica de `src/app/(dashboard)/alumnos/listado-alumnos.tsx`: `CampoBusqueda` con debounce, búsqueda contra `GET /api/personal?pagina=1&q=…` descartando respuestas viejas, `replaceState` de la URL y paginador compartido (`Pagination`) con links a `/personal?q=…&pagina=N`. Al cambiar el texto se vuelve a la página 1. Se crea `src/lib/personal-listado.ts` (query string del listado, equivalente a `alumno-listado.ts`); **no se acopla con el de alumnos**.
8. **Textos del prototipo.** Subtítulo: «Buscá por nombre, apellido y DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).». Placeholder: «Ej.: ferreyra, 31222…». Etiqueta accesible: «Buscar integrante». Todos van a `textos.ts` (`ui.personal.listado.*`), a diferencia del listado de alumnos, que los tiene fijos en el código.
9. **Estados vacíos.** Sin integrantes y sin `q`: `ui.personal.listado.vacio` («Todavía no hay personal de mesa de entrada registrado»), ya existente, con «Nuevo integrante» (criterio 4). Con `q` y sin resultados: texto nuevo `ui.personal.listado.sinResultados` = «No se encontraron integrantes para «{q}»», **propuesto, marcado como pendiente de validar por el PO (P-F6)**, conservando «Nuevo integrante». «Nuevo integrante» está siempre arriba a la derecha, como en el prototipo.
10. **Filas.** Toda la fila enlaza a `/personal/[id]` (criterio 3), con el mismo recurso de `listado-alumnos.tsx` (enlace con `after:absolute after:inset-0` y `tr` relativa). Las filas de integrantes inactivos se ven atenuadas (`opacity-60`), como en el prototipo y en alumnos; el estado sigue siendo texto en el `Badge` (no solo color).
11. **Error de carga.** Si la búsqueda falla, el listado muestra el aviso con «Reintentar» (claves nuevas en `ui.personal.listado.*`), igual que alumnos.
12. **Fixture.** `prisma/seed/fixtures/hu-f-03.ts` (+ una línea en `fixtures/index.ts`, sin editar `seed.ts`), idempotente por DNI: al menos 12 fichas de mesa de entrada de prueba, con una mezcla de activas e inactivas, apellidos con tilde y con ñ (por ejemplo «Álvarez», «Núñez»), dos apellidos que coincidan parcialmente («García» y «Garcés») y DNIs con prefijo común (8806200x), para que el listado supere una página y se pueda probar la búsqueda y la paginación. Fichas **sin cuenta vinculada** salvo que el schema lo impida (ver 0.2). No se crean usuarios: esta HU solo lista.

### 0.2. A verificar antes de implementar (si algo contradice lo de arriba, detenerse y reportar)

- Que `FichaMesaEntrada` admita fichas sin `usuarioId` y sin otra restricción que impida el fixture (unicidad del email, claves foráneas). Si no, reportar: la alternativa es crear cuentas con `crearCuentaParaFicha`.
- Cómo se comporta `listarAlumnos` cuando `pagina` supera `total_paginas` y cuando `total = 0` (`total_paginas`, `items`), y replicarlo. Anotar la decisión en el §9.
- La API real de `Pagination` y de `CampoBusqueda` (props y si traen textos fijos). **No se modifican** los componentes compartidos; si traen textos fijos, se anota como deuda.
- Todos los llamadores de `listarPersonal` y de `ListadoPersonal` (página, ruta, `paginas.test.tsx`, tests del servicio y de la ruta, el test con PostgreSQL) para adaptarlos.
- Que `texto()` interpole `{q}` (sí: reemplaza `{nombre}` por el valor).

---

## 1. Nota de alcance

HU-F-03 es la segunda del bloque de mesa de entrada y punto de entrada a la ficha para modificar (F-01) y, más adelante, desactivar y reactivar (F-05).

**Lo que ya existe y esta task usa** (verificado en `develop`):

| Qué | Dónde |
|---|---|
| `listarPersonal` (versión mínima), `GET /api/personal`, `/personal` con tabla y estado vacío | F-01 |
| `tokenizarBusqueda` y `terminoBusqueda` | `src/lib/busqueda-texto.ts` |
| Patrón de filtro, listado de cliente y query string | `alumno.busqueda.ts`, `listado-alumnos.tsx`, `alumno-listado.ts` |
| `CampoBusqueda`, `Pagination`, `fetchAutenticado` | `src/components/shared/`, `src/lib/fetch-autenticado.ts` |
| Columnas normalizadas e índice del listado | `prisma/schema.prisma` |

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Desactivar y reactivar, y el historial de estados de la ficha (HU-F-05).
- Cualquier cambio en la ficha (`/personal/[id]`), el formulario o el alta y la modificación (F-01).
- Que «Volver al listado» conserve la búsqueda y la página (alumnos lo hace; la spec de F no lo pide). Queda como mejora posible.
- Modificar `CampoBusqueda`, `Pagination` o cualquier componente compartido, ni el listado de alumnos.
- Migraciones, `schema.prisma` y `seed.ts`.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** ver el listado del personal de mesa de entrada
**Para** acceder a sus fichas y saber quiénes están activos

**SP estimado:** 1

---

## 3. Alcance de esta task

- `listarPersonal` con búsqueda y paginación; `ListarPersonalQuerySchema` y `POR_PAGINA_PERSONAL`; `construirFiltroBusquedaPersonal`.
- `GET /api/personal` con `pagina` y `q`, y la respuesta de la sección 0.1.6.
- `/personal` con buscador, paginador, estados vacíos, error de carga y fila enlazada.
- Fixture de fichas de prueba, reglas en `RULES.md` y nota aditiva en `spec_modulo_F.md`.

---

## 4. Contrato Backend

El contrato completo está en `docs/specs/spec_modulo_F.md` §2.3; esta sección solo fija qué se implementa.

- **Schema:** `ListarPersonalQuerySchema` y `POR_PAGINA_PERSONAL` en `src/server/personal/personal.schema.ts`.
- **Filtro:** `construirFiltroBusquedaPersonal(q)` en `src/server/personal/personal.busqueda.ts`.
- **Servicio:** `listarPersonal(query, db?)` en `personal.service.ts`; solo lectura, no escribe nada.
- **Ruta:** `GET /api/personal` con `withPermission("personal:leer")`; `400 VALIDATION_ERROR` si `pagina` o `q` son inválidos o llega cualquier otro parámetro; `403 SIN_PERMISO` y `401` sin sesión. Capa delgada (Reglas N.° 4, 5 y 6).
- **Tipos:** `ListadoPersonal` en `src/types/personal.types.ts`.
- **Trazabilidad:** ninguna (solo lectura).

---

## 5. Frontend

**Prototipo (figura 92, página 83):**
- Menú: «Personal de mesa de entrada» activo (ya existe por F-01).
- Título «Personal de mesa de entrada», debajo el subtítulo de búsqueda y, a la derecha, el botón «Nuevo integrante».
- Campo de búsqueda con ícono de lupa y el placeholder de la sección 0.1.8, a todo el ancho.
- Tabla con Apellido, Nombre, DNI, Teléfono, Email y Estado (etiqueta «Activo» o «Inactivo»); la fila inactiva se ve atenuada.

**A implementar:** `page.tsx` (servidor, valida permiso y entrega el primer render), `listado-personal.tsx` (cliente), `personal-listado.ts`. Antes de implementar, agregar a `docs/DESIGN.md` §6.4 las filas del buscador, el paginador y los estados vacíos del listado (y su entrada en el historial de cambios).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
- Schema de la query: `pagina` por defecto 1, no entera, 0 y negativa rechazadas, `q` recortado y con máximo 100, `.strict()` rechaza `por_pagina` y cualquier otro campo.
- Filtro: dos palabras en AND, una palabra en apellido o nombre (OR), la palabra numérica suma el DNI y la no numérica no, tildes y mayúsculas, menos de 2 caracteres sin filtro.
- Servicio con mocks: orden, `skip`/`take`, `total` filtrado, `total_paginas`, página fuera de rango (como alumnos).
- Con PostgreSQL real: búsqueda parcial por apellido, nombre y DNI; «alvarez» encuentra «Álvarez» y «nunez» encuentra «Núñez»; AND entre palabras; incluye activos e inactivos; paginación de a 10 con el `total` del resultado filtrado; orden por apellido, nombre y DNI.
- Ruta: `200` con la forma de la spec, `400` (`pagina=0`, `pagina=abc`, `q` de más de 100, `por_pagina=5`), `403` para MESA_ENTRADA, PROFESOR y ALUMNO, `401` sin sesión.
- Pantalla: tabla con las seis columnas, estado vacío con «Nuevo integrante», sin resultados con el texto de `{q}`, fila inactiva atenuada, toda la fila enlaza a la ficha, el paginador conserva `q`, el debounce y el reinicio a la página 1, menos de 2 caracteres pide el listado completo, error con «Reintentar».
- Los tests de F-01 que llamaban a `listarPersonal()` se adaptan sin debilitarse.

### Nivel 2 — Postman (o curl, documentado como en A-06 y A-05)
Listado sin parámetros, con `q` (apellido, nombre y DNI), `pagina=2`, `pagina` fuera de rango, `pagina=0` (`400`), `por_pagina=5` (`400`), sin permiso (`403`) y sin sesión (`401`).

### Nivel 3 — BD / TablePlus
- El conteo de fichas contra `total` del listado sin filtro, y contra el filtrado con una búsqueda.
- La paginación: 10 filas en la primera página y el resto en la segunda, sin repetidos ni faltantes.
- Que el listado no escribe nada (ninguna fila ni evento nuevos).
- Recorrido en el navegador como Gerente: buscar, paginar, abrir una ficha desde una fila y volver; como Mesa de entrada, `/personal` y `/api/personal` rechazan.
- Criterio 3 (acceso a desactivar o reactivar desde la ficha): verificación diferida hasta HU-F-05.

---

## 7. Checklist de Definition of Done

- [x] Servicio, Route Handler y pantalla implementados, sin lógica de negocio en la capa delgada (Regla N.° 4); respuesta `{ data, error }` (Regla N.° 5) y validación Zod previa (Regla N.° 6).
- [x] Orden, búsqueda (criterio de HU-B-05) y paginación de a 10 según la spec, sobre activos e inactivos, con `total` del resultado filtrado.
- [x] Estados vacíos y de error, y fila enlazada a la ficha.
- [x] Solo el Gerente: `403` en el servidor para cualquier otro rol (Regla N.° 10).
- [x] Todos los textos visibles en `textos.ts`, verificados con `scripts/verificar-claves-textos.ts`; el texto de «sin resultados» marcado como propuesto.
- [x] Ningún componente compartido modificado; ningún test de Sprint 1, 2, A-06, A-05 y F-01 borrado ni debilitado.
- [x] Fixture `hu-f-03.ts` con su línea en el índice, sin editar `seed.ts`; el seed corre dos veces sin duplicar.
- [x] Filas de esta HU en `docs/DESIGN.md` §6.4 (y en su historial de cambios).
- [x] Reglas en `RULES.md` y nota aditiva en `spec_modulo_F.md` (incluida la diferencia de `tokenizarBusqueda`).
- [x] `lint`, `tsc`, `npm test`, `npm run test:pg` y `next build` sin fallos nuevos respecto de `develop` (los fallos que quedan son de HU-C-19 y del orden de los tests con PostgreSQL; ver sección 9.3).
- [x] Tests de los 3 niveles documentados en `docs/testing/HU-F-03-evidencia.md`.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapa de implementación

Una sola etapa (1 SP, sobre un patrón ya resuelto). Antes de escribir código, Claude Code verifica los puntos de la sección 0.2; **solo si alguno contradice lo decidido, se detiene y reporta** y, si no, sigue. Al terminar **se detiene** y reporta archivos, resultados de los comandos, desvíos y dudas.

Orden: 1) filas de DESIGN §6.4; 2) schema, filtro y servicio con sus tests; 3) ruta y su test; 4) pantalla, textos y tests; 5) fixture y seed; 6) `RULES.md`, nota aditiva y evidencia; 7) `lint`, `tsc`, `npm test`, `npm run test:pg`, `npx tsx scripts/verificar-claves-textos.ts`, `npx prisma db seed` (dos veces) y `next build`.

---

## 9. Resultado de la implementación

Evidencia completa en `docs/testing/HU-F-03-evidencia.md`. HU-F-03 queda implementada y verificada. El único límite que no se puede cerrar acá es el acceso a desactivar y reactivar desde la ficha (criterio 3), que pertenece a HU-F-05.

### 9.1. Criterios de aceptación

| Criterio | Resultado | Cómo se verificó |
|---|---|---|
| 1. Columnas, orden y paginación de a 10, con las fichas de prueba | Verificado | Tests unitarios y con PostgreSQL; 18 pedidos con curl; conteos SQL contra `total` y orden de las páginas 1 y 2 sin repetidos ni faltantes; recorrido en el navegador |
| 2. Búsqueda por nombre, apellido o DNI (desde 2 caracteres, parcial, sin tildes ni mayúsculas) | Verificado | «alvarez» encuentra «Álvarez», «NUNEZ» encuentra «Núñez», «garc» encuentra García y Garcés, AND entre palabras, DNI parcial y completo, `q` de 1 carácter devuelve todo |
| 3. Cada fila enlaza a la ficha | Verificado | Tests de pantalla y recorrido en el navegador |
| 3. Límite: acceso a desactivar o reactivar | Bloqueado hasta HU-F-05 | Se verifica al implementar F-05 |
| 4. Sin integrantes: mensaje y acceso a «Nuevo integrante» | Verificado | Tests de pantalla; con búsqueda sin resultados se muestra el texto propio y «Nuevo integrante» sigue visible |
| 5. Solo el Gerente | Verificado | `403` con Mesa de entrada y `401` sin sesión (curl y tests de ruta) |

### 9.2. Desvíos respecto de lo decidido

- **Página fuera de rango y sin resultados:** como en `listarAlumnos`, una página mayor que la última devuelve la última y sin resultados responde `pagina: 1` y `total_paginas: 0`.
- **Mensajes del 400:** los errores de `pagina` y `q` salen con los mensajes por defecto de Zod, en inglés, porque la spec da el schema sin mensajes propios. La pantalla no los muestra; solo se ven en la API. Queda como deuda menor.
- **Aviso de error propio:** no se reutilizó `AvisoErrorAlumnos`, para no acoplarse al módulo de alumnos y para que sus textos salgan de `textos.ts`.
- **Test de la página:** `paginas.test.tsx` resuelve a mano el componente async de la tabla, porque `renderToStaticMarkup` no renderiza un componente async dentro de `Suspense`.
- **RULES:** no existía una sección de la búsqueda de alumnos que tomar de modelo; se escribió la de personal a partir del código de alumnos.
- **Menú (ajuste pedido por Adriel):** «Personal de mesa de entrada» pasó de ser un enlace suelto a una sección desplegable con un único «Listado» hacia `/personal`, como Profesores, Materias o Aulas. El ítem queda activo en el listado, el alta, la ficha y la edición. Tocó `Sidebar.tsx`, `Sidebar.personal.test.tsx` (ahora 9 casos) y la fila del listado de `DESIGN.md` §6.4, que es de F-01.
- **Fixture:** 12 fichas sin cuenta vinculada (3 inactivas), DNI 8806200x; con las 5 existentes, 17 en total, 2 páginas.

### 9.3. Verificación final

- `lint` sin errores (el aviso de `CALENDARIO` ya existía), `tsc` sin errores, `verificar-claves-textos` aprobado y `next build` compila.
- `npm test`: 3001 pasan y fallan 5, los de HU-C-19 (#240) en `evento-calendario-materia.test.tsx`, `paso-fecha-horario-turno.test.tsx` y `listado-sin-permiso.route.test.ts`.
- `npm run test:pg` (antes del ajuste del menú, que no lo afecta): 284 pasan y fallan 9, ninguno de esta HU. Los 18 de `personal.service.pg.test.ts` pasan (5 nuevos de búsqueda y paginación).
  - 6 de HU-C-19, los mismos de antes.
  - 2 que corren el seed completo sobre la base compartida (`seed-asistencia.pg.test.ts` y `materia.tarifa.pg.test.ts`, este último de HU-L-06): el seed aborta en la fixture HU-E-04 («necesita la clase dictada del 06/01/2026 de HU-E-09»). Corridos solos o de a dos pasan; el fallo depende del orden.
  - 1 de orden (`cancelaciones.service.pg.test.ts`, HU-H-10): falla en la corrida completa y pasa solo (6 de 6).
- Seed: `npx prisma db seed` dos veces, con las 17 fixtures en verde; la segunda no duplica ni cambia nada (17 fichas, sin usuarios ni eventos nuevos).
- `schema.prisma` y `seed.ts` sin cambios; sin migraciones.
- Recorrido en el navegador (buscar, paginar y abrir una ficha desde una fila): verificado por Adriel.

### 9.4. Deuda y lo que deja para otras HU

- Mensajes de validación de `pagina` y `q` en inglés (solo se ven en la API).
- Los 5 tests de `npm test` y los 9 de `test:pg` que fallan no son de esta HU y no se tocaron.
- «Volver al listado» desde la ficha no conserva la búsqueda ni la página (alumnos sí lo hace; la spec de F no lo pide).
- **HU-F-05:** agrega desactivar y reactivar desde la ficha, que ya es accesible desde cada fila del listado; el listado muestra activos e inactivos, así que no necesita cambios.
