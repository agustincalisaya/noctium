# HU-G-03 — Evidencia de implementación y validación

Task: [HU-G-03](../../../tasks/Sprint%203/Modulo%20G/HU-G-03.md). Contrato: [Módulo G](../../../specs/spec_modulo_G.md) §2.3 y §3.7 (con su «Nota de implementación HU-G-03»); mismo diseño que [Módulo F](../../../specs/spec_modulo_F.md) §2.3 (HU-F-03).

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*` en el servidor local, creada y borrada por el script).
- **Fixtures:** `prisma/seed/fixtures/hu-g-03.ts`, ejecutado con `npx prisma db seed` dos veces sobre la base de desarrollo (el seed completo, con todas las fixtures, termina sin errores las dos veces).
- **Nivel 2 (pedidos HTTP):** ejecutado con curl (no con Postman) contra `next dev` local y la base de desarrollo, por Claude Code. La sesión se obtuvo con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`) con las cuentas del seed, **sin modificarlas** (ni email ni contraseña). No se incluyen cookies ni contraseñas.
- **Nivel 3 (SQL):** ejecutado con SQL directo (solo `SELECT`) contra la base de desarrollo, por Claude Code, con las consultas tal como figuran abajo.
- **Pantallas:** Claude Code verificó por HTTP, con la sesión de cada gerente del seed, que `/gerentes` responde con el buscador, el subtítulo, el paginador, «(vos)» en la fila propia y el estado de «sin resultados», y que el proxy rechaza a los otros roles. El pedido 15 se repitió después de corregir el subtítulo a «o DNI». El recorrido interactivo en el navegador lo realizó el responsable, sin observaciones (ver «Recorrido en el navegador»). No se adjuntan capturas.

## Criterios de aceptación (backlog, HU-G-03)

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1. Columnas (apellido, nombre, DNI, teléfono, email, estado), orden por apellido y nombre, activos e inactivos, paginación de a 10 | `gerente.service.test.ts` (orden, `skip`/`take`, `total` filtrado, página fuera de rango, sin resultados); `gerente.service.pg.test.ts` (paginación de a 10 con el `total` filtrado, sin repetidos ni faltantes, en orden; activas e inactivas); `listado-gerentes.test.tsx` y `paginas.test.tsx` (seis columnas, «—» sin teléfono, fila inactiva atenuada con «Inactivo», paginador que conserva `q`); Nivel 2: pedidos 1, 6, 7 y 9; Nivel 3: consultas 3.1 y 3.3 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 2. Búsqueda por nombre, apellido o DNI, desde 2 caracteres, parcial, sin distinguir mayúsculas ni tildes | `gerente.busqueda.test.ts` (AND entre palabras, OR entre campos, el DNI solo con palabras numéricas, tildes y mayúsculas, menos de 2 caracteres sin filtro); `gerente.schema.test.ts` (`q` recortado y hasta 100); `gerente.service.pg.test.ts` («alvarez» encuentra «Álvarez», «NUNEZ» encuentra «Núñez» inactiva, «ferr» encuentra Ferrero y Ferreyra, AND con el nombre, DNI parcial y completo); `listado-gerentes.test.tsx` (una sola búsqueda 300 ms después de la última tecla, en la página 1, URL actualizada, menos de 2 caracteres pide el listado completo, gana la última búsqueda, error con «Reintentar»); Nivel 2: pedidos 2 a 5, 8 y 9; Nivel 3: consulta 3.2 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 3. El gerente autenticado aparece como «(vos)» | `gerente.service.test.ts` (`esVos` solo con el `usuarioId` de la sesión, nunca en una ficha sin cuenta, el ítem no trae `usuarioId`); `gerente.service.pg.test.ts` (`esVos` solo en la ficha de la cuenta que consulta; ficha sin cuenta); `listado-gerentes.test.tsx` y `paginas.test.tsx` («(vos)» solo en la fila con `esVos`, en la celda del apellido, atenuado y con peso normal); `route.test.ts` y `paginas.test.tsx` (la ruta y la página pasan el id de la sesión); Nivel 2: pedidos 6, 13 y 14 (la marca cambia de fila con la otra cuenta del seed); pantallas 15 | 1 y 2 | Verificado (test automatizado y ejecución). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 4. Cada fila lleva a la ficha | `listado-gerentes.test.tsx` (el enlace del apellido cubre toda la fila: `tr` relativa y `after:inset-0`); `paginas.test.tsx` (`href="/gerentes/{id}"` en cada fila) | 1 | Verificado (test automatizado). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 4. Acceso a desactivar o reactivar desde la ficha | — | — | **Verificación diferida a HU-G-05** |
| 5. Solo el Gerente; el servidor rechaza con 403 a otros roles | `route.test.ts` (403 `SIN_PERMISO` para MESA_ENTRADA, PROFESOR y ALUMNO, 401 sin sesión, sin llamar al servicio); `gerente.service.pg.test.ts` (ruta real con `withPermission` contra la base: 403 por rol); `paginas.test.tsx` (sin permiso no consulta); Nivel 2: pedidos 11, 12 y 16 | 1 y 2 | Verificado (test automatizado y ejecución) |
| Sin resultados con búsqueda: mensaje y acceso a «Nuevo gerente» | `listado-gerentes.test.tsx` y `paginas.test.tsx` (texto con `{q}` y «Nuevo gerente»; sin `q` y sin filas, la tabla con los encabezados, sin romperse); Nivel 2: pedido 8; pantallas 15. Texto **propuesto**, pendiente de validar por el PO (P-F6) | 1 y 2 | Verificado (test automatizado y ejecución) |

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| `gerente.busqueda.test.ts` (nuevo) | 10, todas pasan |
| `gerente.schema.test.ts` (8 nuevas de `ListarGerentesQuerySchema`) | 32, todas pasan |
| `gerente.service.test.ts` (el caso de G-01 adaptado y 7 nuevos de `listarGerentes`) | 37, todas pasan |
| `api/gerentes/route.test.ts` (los 3 casos de `GET` de G-01 adaptados y 7 nuevos) | 24, todas pasan |
| `listado-gerentes.test.tsx` (nuevo) | 10, todas pasan |
| `paginas.test.tsx` (los 3 casos del listado de G-01 adaptados y 6 nuevos) | 21, todas pasan |
| PostgreSQL real: `gerente.service.pg.test.ts` (el listado de G-01 adaptado y 7 nuevos de búsqueda, paginación y «(vos)») | 24, todas pasan |
| Suite unitaria completa (`npm test`) | 3672 pasan, 467 omitidos por guarda, 0 fallan (278 archivos pasan, 56 omitidos) |
| `npm run test:pg` completo | Pasada principal: 413 pasan, 40 omitidas, 0 fallan (48 archivos pasan, 4 omitidos). Pasadas con base propia o con nombre fijo, incluidos los tres archivos que corren el seed completo aislado (`seed-asistencia.pg.test.ts`, `cancelaciones.service.pg.test.ts` y `materia.tarifa.pg.test.ts`): todas pasan |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| `next build` | Compila; genera `/gerentes` y `/api/gerentes`, además de las rutas de HU-G-01 |
| Fixture `hu-g-03.ts`, dos veces con `npx prisma db seed` | Las dos corridas terminan sin errores (21 fixtures); la segunda no duplica ni cambia nada: 12 fichas de la fixture, 3 inactivas, sin cuenta, y los mismos totales de fichas de gerente, usuarios y eventos de seguridad |

### Fichas de prueba

| Caso | DNI | Email | Cuenta |
|---|---|---|---|
| Seed base (no se modifica en ninguna prueba) | 24100001 | gerente@noctium.local | Activa |
| Seed base (no se modifica en ninguna prueba) | 24100002 | gerente2@noctium.local | Activa |
| Fixture HU-G-01 | 88064001 y 88064002 | g01.*@noctium.local | Activa e inactiva |
| Fixture HU-G-03: 12 fichas, 3 inactivas (Ferrero, Ordóñez y Báez) | 88065001 a 88065012 | g03.<dni>@noctium.local | Sin cuenta vinculada (la ficha muestra «Sin cuenta») |

Apellidos de la fixture: Arce, Molina, Ferreyra, Ferrero, Álvarez, Núñez, Ordóñez, Gutiérrez, Acuña, Rodríguez, Báez y Toledo.

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: Gerente (`gerente@noctium.local`, DNI 24100001, «Paredes»), Gerente 2 (`gerente2@noctium.local`, DNI 24100002, «Quiroga»), Mesa de entrada (`mesa.entrada@noctium.local`), Profesor (`profesor1@noctium.local`) y Alumno (`alumno01@noctium.local`), con la contraseña de las cuentas del seed. La base de desarrollo tenía 18 fichas de gerente: las 2 del seed base, las 2 de la fixture de G-01, las 12 de esta fixture, la 88064021 que dejó la evidencia de G-01 y una ficha cargada antes de esta verificación (33257894, «Torres»). Los resultados no dependen de cuántas fichas haya.

| # | Pedido | Esperado | Resultado |
|---|---|---|---|
| 1 | Gerente: `GET /api/gerentes` | 200, forma de §2.3, página 1 de 10 en orden | OK. 200; `pagina: 1`, `por_pagina: 10`, `total: 18`, `total_paginas: 2`, 10 ítems de Acuña a Ordóñez, activas e inactivas; `Cache-Control: no-store, must-revalidate`; ningún ítem trae `usuarioId` |
| 2 | `GET /api/gerentes?q=ferr` | Las dos coincidencias parciales | OK. `total: 2`: Ferrero (inactiva) y Ferreyra |
| 3 | `GET /api/gerentes?q=julieta` | Por nombre | OK. `total: 1`: Ferreyra |
| 4 | `GET /api/gerentes?q=88065` y `?q=88065007` | DNI parcial y completo | OK. `total: 12` (las de la fixture) y `total: 1` (Ordóñez, inactiva) |
| 5 | `GET /api/gerentes?q=alvarez`, `?q=NUNEZ` y `?q=hernan%20ferr` | Sin tildes ni mayúsculas; AND entre palabras | OK. Álvarez, Núñez y Ferrero, un resultado cada una |
| 6 | `GET /api/gerentes?pagina=2` | El resto, con «(vos)» en la fila propia | OK. `pagina: 2`, 8 ítems de Paredes a Torres; `esVos: true` solo en Paredes (24100001) |
| 7 | `GET /api/gerentes?pagina=9` | Página fuera de rango: la última | OK. `pagina: 2`, los mismos 8 ítems |
| 8 | `GET /api/gerentes?q=zzzz&pagina=3` | Sin resultados | OK. `items: []`, `pagina: 1`, `total: 0`, `total_paginas: 0` |
| 9 | `GET /api/gerentes?q=a` | Menos de 2 caracteres: listado completo | OK. `total: 18` |
| 10 | `GET /api/gerentes?pagina=0`, `?pagina=abc`, `?por_pagina=5` y `?q=` de 101 caracteres | 400 `VALIDATION_ERROR` | OK. 400 en los cuatro, con «Los datos del gerente no son válidos.»; `detalles.pagina` en los dos primeros, `detalles` vacío con `por_pagina` (el error es de la raíz) y `detalles.q` con el último. Los mensajes de `pagina` y `q` son los de Zod, en inglés (como en F-03) |
| 11 | Mesa de entrada, Profesor y Alumno: `GET /api/gerentes` | 403 | OK. 403 `SIN_PERMISO` con los tres |
| 12 | Sin sesión: `GET /api/gerentes` | 401 | OK. 401 `SESION_INVALIDA` |
| 13 | Gerente 2: `GET /api/gerentes?pagina=2` | «(vos)» en su propia fila | OK. `esVos: true` solo en Quiroga (24100002); Paredes, `false` |
| 14 | Gerente y Gerente 2: `GET /api/gerentes?q=paredes` | La misma fila, «(vos)» solo para su dueño | OK. Con la sesión de 24100001, `esVos: true`; con la de 24100002, `false` |
| 15 | Gerente y Gerente 2: `GET /gerentes?pagina=2`; Gerente: `GET /gerentes?q=zzzz`. **Repetido con el subtítulo corregido** («o DNI», como la figura 96 y el criterio 2), con dos inicios de sesión nuevos | 200 con los elementos de la pantalla | OK. 200 en los tres; el subtítulo «Buscá por nombre, apellido o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).» (ya no aparece «apellido y DNI»), el buscador «Buscar gerente» y una sola marca «(vos)», junto al enlace de «Paredes» con la sesión de 24100001 y junto al de «Quiroga» con la de 24100002. En `?pagina=2`, el paginador («Paginación») con «Página 2 de 2 · 18 en total» y el enlace a la página 1 (`/gerentes`). Con `q=zzzz`: «No se encontraron gerentes para «zzzz»», dos accesos a «Nuevo gerente», sin marca «(vos)» y sin paginador |
| 16 | Mesa de entrada, Profesor y Alumno: `GET /gerentes`; sin sesión: `GET /gerentes` | Redirige el proxy | OK. 307 → `/sin-permiso` con los tres roles; sin sesión, 307 → `/login?callbackUrl=…` |

## Nivel 3 — SQL (ejecutado contra la base de desarrollo, solo lectura)

| # | Consulta | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT COUNT(*) FROM fichas_gerente;` | Igual al `total` del listado sin filtro (pedido 1) | OK. 18 = `total: 18` |
| 3.2 | `SELECT COUNT(*) FROM fichas_gerente WHERE "apellidoNormalizadoFichaGerente" LIKE '%ferr%' OR "nombreNormalizadoFichaGerente" LIKE '%ferr%';` y `SELECT COUNT(*) FROM fichas_gerente WHERE "dniFichaGerente" LIKE '%88065%';` | Iguales al `total` filtrado (pedidos 2 y 4) | OK. 2 y 12 |
| 3.3 | `SELECT "idFichaGerente" FROM fichas_gerente ORDER BY "apellidoNormalizadoFichaGerente", "nombreNormalizadoFichaGerente", "dniFichaGerente" LIMIT 10 OFFSET 0;` y con `OFFSET 10` | Los mismos ids, en el mismo orden, que las páginas 1 y 2 del listado | OK. 10 y 8 ids, idénticos y en el mismo orden que los de `GET /api/gerentes?pagina=1` y `?pagina=2`; 18 distintos, sin repetidos ni faltantes |
| 3.4 | `SELECT (SELECT COUNT(*) FROM fichas_gerente), (SELECT MAX("updatedAtFichaGerente") FROM fichas_gerente), (SELECT COUNT(*) FROM usuarios), (SELECT COUNT(*) FROM eventos_seguridad), (SELECT MAX("creadoEnEvento") FROM eventos_seguridad);` antes y después de 7 pedidos de listado (API y pantalla) | El listado no escribe nada | OK. Los cinco valores, idénticos antes y después |
| 3.5 | `SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT "activoFichaGerente"), COUNT("usuarioId"), COUNT(*) FILTER (WHERE "emailFichaGerente" = 'g03.' \|\| "dniFichaGerente" \|\| '@noctium.local') FROM fichas_gerente WHERE "dniFichaGerente" BETWEEN '88065001' AND '88065012';` | La fixture: 12 fichas, 3 inactivas, sin cuenta | OK. 12, 3, 0 y 12. Igual después de la segunda corrida del seed (sin fichas ni usuarios nuevos) |
| 3.6 | `SELECT f."dniFichaGerente", f."emailFichaGerente", u."emailUsuario", u."debeCambiarPasswordUsuario", u."sesionesValidasDesdeUsuario" IS NULL, u."activoUsuario" FROM fichas_gerente f JOIN usuarios u ON u."idUsuario" = f."usuarioId" WHERE f."dniFichaGerente" IN ('24100001','24100002');` | Los gerentes del seed base, con su email de siempre | OK. `gerente@noctium.local` y `gerente2@noctium.local` en la ficha y en la cuenta, activas, sin la marca y sin revocación. Esta verificación no los modificó: solo inició sesión con ellos |

### Filas que quedan en la base de desarrollo

- Las 12 fichas de la fixture (88065001 a 88065012), sin cuenta.
- Los eventos `LOGIN_EXITOSO` de los inicios de sesión del Nivel 2 y los dos de la repetición del pedido 15 (`gerente@noctium.local` y `gerente2@noctium.local`). Antes y después de esa repetición, las fichas de gerente, los usuarios y la última modificación de las fichas quedaron iguales; los eventos de seguridad sumaron exactamente esos dos. Ninguna otra escritura.

## Capturas

No se adjuntan.

## Recorrido en el navegador

**Realizado por el responsable, sin observaciones.** Como Gerente: buscó por apellido, por nombre, por DNI y con tildes; paginó; vio «(vos)» en la fila propia y que la marca cambia de fila al entrar con la otra cuenta del seed (24100001 y 24100002, sin modificarlas); abrió una ficha desde una fila y volvió al listado. Como Mesa de entrada, `/gerentes` rechaza el acceso.

Comparó una captura de `/gerentes` con la figura 96 del prototipo: coinciden la cabecera (título, subtítulo y «Nuevo gerente»), el buscador, las columnas, el orden, las filas inactivas atenuadas, el paginador y el menú. Dos diferencias aceptadas, que vienen del patrón del listado del personal (figura 92):

- Los encabezados de la tabla van con mayúscula inicial y no en mayúsculas chicas.
- El DNI y el teléfono van sin tipografía de ancho fijo.

## Observaciones conocidas

- **Criterio 4, acceso a desactivar o reactivar desde la ficha:** diferido a HU-G-05.
- **Texto propuesto:** `ui.gerentes.listado.sinResultados`, pendiente de validar por el PO (P-F6).
- **Mensajes del 400 de `pagina` y `q`:** los de Zod, en inglés; solo se ven en la API (misma deuda que F-03). Un parámetro ajeno responde 400 con `detalles` vacío (deuda anterior, igual que F-01 y G-01).
- **«Volver al listado»** desde la ficha no conserva la búsqueda ni la página (F y G no lo piden).
