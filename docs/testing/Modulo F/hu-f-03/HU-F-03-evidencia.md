# HU-F-03 — Evidencia de implementación y validación

Task: [HU-F-03](../tasks/Sprint%203/Modulo%20F/HU-F-03.md). Contrato: [Módulo F](../specs/spec_modulo_F.md) §2.3 y §3.7; criterio de búsqueda de [Módulo B](../specs/spec_modulo_B.md) §2.7 y §3.9.

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*`, creada y borrada por el script).
- **Fixture:** `prisma/seed/fixtures/hu-f-03.ts`, ejecutado con `npx prisma db seed` dos veces sobre la base de desarrollo.
- **Nivel 2 (pedidos HTTP):** ejecutado con curl contra `next dev` local y la base de desarrollo, por Claude Code. La sesión se obtuvo con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`). No se incluyen cookies ni contraseñas.
- **Nivel 3 (SQL y pantallas):** consultas de solo lectura contra la base de desarrollo y verificación de las pantallas por HTTP, por Claude Code. El recorrido interactivo en el navegador queda **pendiente del responsable**. No se adjuntan capturas.

## Criterios de aceptación (backlog, HU-F-03)

Los criterios están en `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-F-03, criterios 1 a 5): listado con orden y paginación de a 10 (c1), búsqueda con el criterio de HU-B-05 (c2), cada fila da acceso a la ficha y desde ella a modificar, desactivar y reactivar (c3), estado vacío con «Nuevo integrante» (c4) y solo el Gerente, con 403 en el servidor para otros roles (c5).

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1 (orden, paginación de a 10, activos e inactivos) | `personal.service.test.ts` (orden, `skip`/`take`, `total` filtrado, `total_paginas`, fuera de rango, vacío); `personal.service.pg.test.ts` («pagina de a 10 con el total filtrado, sin repetidos ni faltantes, en orden», «listado: incluye activas e inactivas…»); `listado-personal.test.tsx` (seis columnas, fila inactiva atenuada, paginador); Nivel 2: pedidos 1 a 3; Nivel 3: consultas 3.1 y 3.4 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 2 (búsqueda) | `personal.busqueda.test.ts` (AND entre palabras, OR entre campos, DNI solo con palabras numéricas, tildes y mayúsculas, menos de 2 caracteres sin filtro); `personal.service.pg.test.ts` («alvarez» → «Álvarez», «nunez» → «Núñez», parcial, AND, por nombre y por DNI); `listado-personal.test.tsx` (debounce, página 1, menos de 2 caracteres pide el listado completo, respuestas viejas descartadas, sin resultados); Nivel 2: pedidos 4 a 12; Nivel 3: consultas 3.2 y 3.3 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido interactivo: pendiente del responsable |
| 3 (acceso a la ficha) | `listado-personal.test.tsx` («… toda la fila enlaza a la ficha»); `paginas.test.tsx` (enlace a `/personal/[id]`) | 1 | Verificado. El acceso a desactivar y reactivar desde la ficha queda **Bloqueado** hasta HU-F-05 |
| 4 (sin integrantes) | `paginas.test.tsx` y `listado-personal.test.tsx` («Todavía no hay personal de mesa de entrada registrado» con «Nuevo integrante»; sin resultados con `q`) | 1 | Verificado (test automatizado) |
| 5 (solo el Gerente) | `route.test.ts` (401 sin sesión y 403 para MESA_ENTRADA, PROFESOR y ALUMNO); `paginas.test.tsx` (sin permiso no consulta); `rutas-por-rol.test.ts` (de HU-F-01); Nivel 2: pedidos 17 y 18; Nivel 3: verificación 3.6 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npm test`) | 2996 pasan, 5 fallan, 327 omitidos (237 archivos pasan, 3 fallan, 48 omitidos). Los 5 fallos son de HU-C-19 en `develop` (ver «Observaciones conocidas») |
| `personal.busqueda.test.ts` (nuevo) | 10 |
| `personal.schema.test.ts` (con `ListarPersonalQuerySchema`) | 28 |
| `personal.service.test.ts` (con mocks; `listarPersonal` adaptado y ampliado) | 31 |
| `api/personal/route.test.ts` (GET adaptado y ampliado) | 23 |
| `listado-personal.test.tsx` (nuevo) y `paginas.test.tsx` (listado adaptado y ampliado) | 9 y 18 |
| PostgreSQL real: `personal.service.pg.test.ts` | 18, todas pasan (5 nuevas de búsqueda y paginación) |
| `npm run test:pg` completo | 284 pasan, 9 fallan, ninguno de esta HU (ver «Observaciones conocidas»); las pasadas de nombre fijo, 18 y 16, pasan |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| `next build` | Compila |
| Fixture `hu-f-03.ts`, dos veces con `npx prisma db seed` | La primera crea 12 fichas (8806200x y 8806201x, 3 inactivas, todas sin cuenta); la segunda no duplica ni falla. Usuarios y eventos sin cambios |

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: Gerente (`gerente@noctium.local`) y Mesa de entrada (`mesa.entrada@noctium.local`), con la contraseña de las cuentas del seed. Base con 17 fichas de mesa de entrada (2 del seed base, 3 de HU-F-01 y 12 de esta fixture).

| # | Pedido | Esperado | Resultado |
|---|---|---|---|
| 1 | `GET /api/personal` | 200, `{ items, pagina, por_pagina, total, total_paginas }`, 10 filas ordenadas | OK. `pagina 1`, `por_pagina 10`, `total 17`, `total_paginas 2`; Álvarez, Benítez, Castro, Domínguez (inactivo), Espinoza, Fernández, Ferreyra, Garcés (inactivo), García, Ibáñez |
| 2 | `GET /api/personal?pagina=2` | Las 7 restantes | OK. Muñoz (inactivo), Núñez, Peña, Prueba Http, Prueba Mesa (inactivo), Prueba Mesa, Ruiz |
| 3 | `GET /api/personal?pagina=9` | La última página | OK. `pagina 2`, las mismas 7 filas |
| 4 | `?q=alvarez` | «Álvarez» (sin tilde ni mayúscula) | OK. 1 fila: Álvarez |
| 5 | `?q=NUNEZ` | «Núñez» | OK. 1 fila: Núñez |
| 6 | `?q=garc` | Parcial: «García» y «Garcés» (inactiva) | OK. Garcés (inactivo), García |
| 7 | `?q=agustina` | Por nombre | OK. 1 fila: Álvarez (Agustina) |
| 8 | `?q=lucia%20garc` | AND entre palabras | OK. 1 fila: García (Lucía) |
| 9 | `?q=880620` | DNI parcial, total filtrado | OK. `total 12`, `total_paginas 2`, 10 filas |
| 10 | `?q=88062004` | DNI completo | OK. 1 fila: Garcés (inactivo) |
| 11 | `?q=a` | Menos de 2 caracteres: listado completo | OK. `total 17` |
| 12 | `?q=zzzz` | Sin resultados | OK. `items: []`, `pagina 1`, `total 0`, `total_paginas 0` |
| 13 | `?pagina=0` | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.pagina` |
| 14 | `?pagina=abc` | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.pagina` |
| 15 | `?por_pagina=5` | 400: no es parámetro | OK. 400 `VALIDATION_ERROR`, `detalles` vacío (`.strict()`) |
| 16 | `?q=` de 101 caracteres | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.q` |
| 17 | Mesa de entrada: `GET /api/personal` | 403 | OK. 403 `SIN_PERMISO` |
| 18 | Sin sesión: `GET /api/personal` | 401 | OK. 401 `SESION_INVALIDA` |

## Nivel 3 — SQL y pantallas (base de desarrollo)

| # | Verificación | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT COUNT(*) FROM fichas_mesa_entrada;` | Igual al `total` sin filtro (pedido 1) | OK. 17 |
| 3.2 | `SELECT COUNT(*) FROM fichas_mesa_entrada WHERE "apellidoNormalizadoFichaMesaEntrada" LIKE '%garc%' OR "nombreNormalizadoFichaMesaEntrada" LIKE '%garc%';` | Igual al `total` de `q=garc` (pedido 6) | OK. 2 |
| 3.3 | `SELECT COUNT(*) FROM fichas_mesa_entrada WHERE "dniFichaMesaEntrada" LIKE '%880620%';` | Igual al `total` de `q=880620` (pedido 9) | OK. 12 |
| 3.4 | `SELECT "apellidoFichaMesaEntrada" FROM fichas_mesa_entrada ORDER BY "apellidoNormalizadoFichaMesaEntrada", "nombreNormalizadoFichaMesaEntrada", "dniFichaMesaEntrada";` | El mismo orden que las páginas 1 y 2, sin repetidos ni faltantes | OK. Las 17 en el mismo orden que los pedidos 1 y 2 |
| 3.5 | Conteo de fichas y de eventos y la última modificación de las fichas, antes y después de 4 pedidos de listado | El listado no escribe nada | OK. Antes y después: 17 fichas, 97 eventos (los dos últimos son los `LOGIN_EXITOSO` de las sesiones de curl) y la misma última modificación |
| 3.6 | Pantallas por HTTP: `/personal`, `/personal?q=garc` y `/personal?pagina=2` con el Gerente; `/personal` con Mesa de entrada | 200 con buscador, subtítulo y «Nuevo integrante»; Mesa de entrada rechazada | OK. Las tres responden 200 con el subtítulo, «Buscar integrante», «Nuevo integrante» y el paginador; Mesa de entrada → 307 a `/sin-permiso` |

### Filas que quedan en la base de desarrollo

- 12 fichas de mesa de entrada de la fixture (DNI 88062001 a 88062012, emails `f03.<dni>@noctium.local`), 3 inactivas, todas sin cuenta.

## Pendiente del responsable

- Recorrido en el navegador como Gerente: escribir en el buscador (debounce, sin parpadeo), paginar, abrir una ficha desde cualquier parte de una fila y volver; como Mesa de entrada, ver que `/personal` y `/api/personal` rechazan.

## Observaciones conocidas

- `npm test`: 5 casos fallan en `evento-calendario-materia.test.tsx`, `paso-fecha-horario-turno.test.tsx` y `listado-sin-permiso.route.test.ts`. Vienen de HU-C-19 (#240) en `develop`: los tests esperan los textos viejos («Turno», «Completo»).
- `npm run test:pg`: 9 casos fallan, ninguno de esta HU:
  - 6 por HU-C-19 en `develop` (`operacion.service.pg.test.ts`, `inscripcion.service.pg.test.ts`, `turno.inscripciones.pg.test.ts` y `turno.reservas.pg.test.ts`: esperan los textos viejos).
  - 2 que corren el seed oficial completo (`seed-asistencia.pg.test.ts` y `materia.tarifa.pg.test.ts`) se detienen en la fixture HU-E-04 («HU-E-04 necesita la clase dictada del 06/01/2026 de HU-E-09»), antes de llegar a las fixtures de F-01 y F-03. Fallan igual corridos solos.
  - 1 (`cancelaciones.service.pg.test.ts`, HU-H-10) depende del orden sobre la base compartida: falla en la corrida completa y pasa corrido solo.
- Los mensajes de error de `pagina` y `q` en el 400 son los de Zod por defecto (en inglés): la spec da `ListarPersonalQuerySchema` sin mensajes propios y la pantalla no los muestra.
- «Volver al listado» desde la ficha no conserva la búsqueda ni la página (alumnos sí lo hace); queda fuera de alcance por la task.
