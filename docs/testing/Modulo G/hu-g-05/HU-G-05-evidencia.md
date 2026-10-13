# HU-G-05 — Evidencia de implementación y validación

Task: [HU-G-05](../../../tasks/Sprint%203/Modulo%20G/HU-G-05.md). Contrato: [Módulo G](../../../specs/spec_modulo_G.md) §2.4 a §2.6, §3.1, §3.4 a §3.7 y §4 (con la «Nota de implementación HU-G-05»).

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (bases PostgreSQL descartables `noctium_pruebas_*`, creadas y borradas por el script; los archivos que corren el seed completo reciben una base propia). `gerente.estado.pg.test.ts` deja inactivas, al empezar cada caso, las fichas de gerente activas de la base descartable (y sus cuentas), restaura las preexistentes al terminar y se corta si encuentra un gerente del seed base (DNI 24100001 o 24100002).
- **Fixture:** `prisma/seed/fixtures/hu-g-05.ts`, ejecutado con `npx prisma db seed` sobre la base de desarrollo: dos veces seguidas al crearlo y otras dos después de las pruebas HTTP.
- **Nivel 2 (pedidos HTTP):** ejecutado por Claude Code con un script de Node (`fetch`, equivalente a curl) contra `next dev` local y la base de desarrollo. Las sesiones se obtuvieron con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`). No se incluyen cookies ni contraseñas.
- **Nivel 3 (SQL y pantallas):** consultas de solo lectura (`SELECT`) contra la base de desarrollo y verificación de las pantallas por HTTP, por Claude Code. El recorrido interactivo en el navegador lo realizó el responsable con la sesión de un gerente del seed (ver «Recorrido en el navegador»). No se adjuntan capturas.
- Las bajas de las pruebas manuales se hicieron solo sobre los gerentes de la fixture (DNI 8806600x). El gerente del seed base `gerente@noctium.local` (24100001) solo actuó como quien da de baja; ninguno de los dos gerentes del seed cambió (consulta 3.1). `ULTIMO_GERENTE_ACTIVO` no se reproduce por HTTP sin desactivar a los gerentes del seed: lo cubre el Nivel 1 con PostgreSQL.

## Criterios de aceptación (backlog, HU-G-05)

Los criterios están en `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-G-05, criterios 1 a 7; HU-A-06, criterio 7).

Niveles: **unitario** (`vitest`, con mocks), **PostgreSQL** (`npm run test:pg`), **Nivel 2** (pedidos HTTP), **Nivel 3** (SQL y pantallas por HTTP) y **navegador** (recorrido del responsable).

| Criterio | Qué lo cubre | Probado con | Estado |
|---|---|---|---|
| 1. «Desactivar» pide confirmación con el texto del backlog y el motivo, obligatorio si registró operaciones | Unitario: `estado-gerente-dialog.test.tsx` (título y detalle de la figura 98, «Opcional», contador, tope de 300, confirmar deshabilitado con motivo obligatorio vacío), `gerente.schema.test.ts` (301 rechazado, vacío = no enviado) y `gerente.service.test.ts` (`MOTIVO_REQUERIDO` con operaciones, opcional sin ellas y sin cuenta). PostgreSQL: `gerente.estado.pg.test.ts` (quien dio de baja a otro «registró operaciones» y necesita motivo). Nivel 2: pedidos 16, 18 y 22 a 24. Navegador: modal como la figura 98; 88066002 con motivo obligatorio, «Desactivar» deshabilitado con el campo vacío y la ayuda «Obligatorio: tiene operaciones registradas»; 88066001 sin motivo | Unitario, PostgreSQL, Nivel 2 y navegador | Verificado |
| 2. Un gerente no se desactiva a sí mismo | Unitario: `gerente.service.test.ts` (422 antes de bloquear: `bloquear` no se llama), `paginas.test.tsx` (la ficha propia no ofrece «Desactivar» aunque haya permiso), rutas y acciones (`422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`). PostgreSQL: «autodesactivación: 422 sin cambiar nada… y sin bloquear, incluso con una versión vieja». Nivel 2: pedidos 9 a 12. Nivel 3: verificación 3.6 (la ficha propia de 88066002, pedido 54). Navegador: en la ficha propia no aparece «Desactivar» | Unitario, PostgreSQL, Nivel 2, Nivel 3 y navegador | Verificado |
| 3. Debe quedar al menos un gerente activo | Unitario: `gerente.service.test.ts` (activas + objetivo en una sola llamada a `bloquear`, conteo sobre la relectura; sin cuenta o con la cuenta inactiva no cuentan; el objetivo no se cuenta) y `estado-gerente-dialog.test.tsx` (aviso informativo en lugar de la confirmación; el rechazo del servidor dentro del modal). PostgreSQL: `gerente.estado.pg.test.ts` (**dos bajas cruzadas**, deterministas y sin pausas: exactamente una confirma y la otra `ULTIMO_GERENTE_ACTIVO`; **lectura vieja**: la segunda baja, pausada antes de pedir el bloqueo, relee y responde `ULTIMO_GERENTE_ACTIVO`; tres gerentes y dos bajas simultáneas confirman las dos; único activo con cuenta y el resto sin cuenta o con la cuenta inactiva) | Solo tests (unitario y PostgreSQL) | Verificado con tests de PostgreSQL. No se reproduce por HTTP ni en el navegador sin desactivar a los gerentes del seed: la base de desarrollo tiene más gerentes activos |
| 4. Las operaciones conservan su nombre; ficha y cuenta inactivas; historial después del commit | Unitario: `gerente.service.test.ts` (orden completo; sin historial si la cuenta falla; no se llama a `revocarSesiones` aparte). PostgreSQL: «baja con cuenta…» (la cola de después del commit observa la baja ya confirmada), «rollback…», «“registró operaciones”… nada se borra y su nombre se sigue resolviendo», «dos bajas simultáneas del mismo objetivo…». Nivel 2: pedidos 18 a 20 y 24 a 26. Nivel 3: consultas 3.1 a 3.4. Navegador: el historial muestra acción, fecha y hora, usuario y motivo, del más reciente al más antiguo | Unitario, PostgreSQL, Nivel 2, Nivel 3 y navegador | Verificado |
| 5. «Gerente desactivado correctamente» e «Inactivo» en el listado | Unitario: `estado-gerente-dialog.test.tsx` (toast y refresco). PostgreSQL: «el listado refleja el estado…» y «el DNI y el email de la ficha inactiva siguen reservados». Nivel 2: pedido 0. Navegador: el listado refleja el estado tras la baja y la reactivación | Unitario, PostgreSQL, Nivel 2 y navegador | Verificado |
| 6. Reactivar con confirmación; cuenta activa y nuevo ingreso | Unitario: `estado-gerente-dialog.test.tsx` (título, aviso de sesiones, sin motivo, toast) y `gerente.service.test.ts` (sin regla de último gerente, sin motivo). PostgreSQL: «reactivar: … umbral de sesiones y marca conservados; varias bajas y reactivaciones se conservan» y ficha sin cuenta. Nivel 2: pedidos 28 y 31 a 44. Nivel 3: consultas 3.1 a 3.3. Navegador: reactivación de 88066004 y de las fichas dadas de baja en el recorrido, con su historial; ficha sin cuenta (88066003) con el detalle de «sin cuenta» | Unitario, PostgreSQL, Nivel 2, Nivel 3 y navegador | Verificado |
| 7. Solo el Gerente (403 a otros roles) | Unitario: `desactivar/route.test.ts` y `reactivar/route.test.ts` (401 y 403 para MESA_ENTRADA, PROFESOR y ALUMNO), `actions.test.ts` (permiso antes de Zod) y `paginas.test.tsx` (sin `gerentes:cambiar_estado`, ni «Desactivar» ni «Reactivar»). PostgreSQL: `gerente.service.pg.test.ts` (matriz `gerentes:cambiar_estado` solo para GERENTE). Nivel 2: pedidos 45 a 49. Nivel 3: verificación 3.6 (pantalla como Mesa de entrada y sin sesión, pedidos 55 y 56) | Unitario, PostgreSQL, Nivel 2 y Nivel 3 | Verificado |
| A-06 c7 para Gerente (desactivar y reactivar la ficha desactiva y reactiva la cuenta; la marca se conserva) | PostgreSQL: `gerente.estado.pg.test.ts`. Nivel 2: pedidos 18 a 20 y 35 a 40. Nivel 3: consulta 3.1 | PostgreSQL, Nivel 2 y Nivel 3 | Verificado |

**Verificaciones diferidas que cierra esta HU:**
- **HU-A-06, criterio 7, para gerentes:** verificado (fila anterior).
- **HU-G-03, criterio 4, parte «acceso a desactivar o reactivar desde la ficha»:** la ficha alcanzada desde cada fila del listado ofrece «Desactivar» o «Reactivar» con `gerentes:cambiar_estado` (`paginas.test.tsx`; pantallas 50 a 54 de la verificación 3.6). Verificado por test, por HTTP y en el navegador.

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npm test`) | 3795 pasan, 0 fallan, 482 omitidos (281 archivos pasan, 57 omitidos) |
| `gerente.schema.test.ts` (con `DesactivarGerenteSchema` y `ReactivarGerenteSchema`) | 50 |
| `gerente.service.test.ts` (detalle adaptado y ampliado; baja y reactivación) | 71 |
| `actions.test.ts` (con `desactivarGerente` y `reactivarGerente`) | 50 |
| `api/gerentes/[id]/route.test.ts` (detalle adaptado), `desactivar/route.test.ts` y `reactivar/route.test.ts` (nuevos) | 18, 16 y 10 |
| `estado-gerente-dialog.test.tsx` (nuevo) y `paginas.test.tsx` (ficha adaptada y ampliada) | 16 y 28 |
| `publico.aislamiento.test.ts` y `errores-dominio.test.ts` (sin cambios; cubren los errores nuevos) | 50 y 13 |
| PostgreSQL real: `gerente.estado.pg.test.ts` (nuevo) | 15; todas pasan |
| `npm run test:pg` completo | Pasada principal: 49 archivos, 428 pasan, 40 omitidos. Pasadas aisladas: 2 + 1 + 6 + 5 + 18 + 22 pasan. 0 fallan |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado («Claves de textos verificadas.») |
| `next build` | Compila; incluye `/api/gerentes/[id]/desactivar` y `/reactivar` |
| Fixture `hu-g-05.ts`, `npx prisma db seed` dos veces (y otras dos después de las pruebas HTTP) | La primera crea 88066001, 88066002 (con la contraseña cambiada), 88066003 (sin cuenta) y 88066004 (dado de baja por 88066002 con motivo). Las siguientes terminan sin errores y no cambian nada: las fichas, las cuentas y el historial de los cuatro (consultas 3.1 y 3.2) quedan idénticos antes y después |

### Gerentes de prueba (fixture)

| DNI | Email | Estado inicial | Para qué |
|---|---|---|---|
| 88066001 | `g05.sinoperaciones@noctium.local` | Activo, con cuenta y la marca de cambio obligatorio (contraseña inicial: su DNI), sin operaciones | Baja con motivo opcional |
| 88066002 | `g05.operaciones@noctium.local` | Activo, con cuenta, contraseña ya cambiada (la del seed), «registró operaciones» (dio de baja a 88066004) | Motivo obligatorio; sesión propia para la autodesactivación |
| 88066003 | `g05.sincuenta@noctium.local` | Activo, sin cuenta vinculada | Baja y reactivación sin cuenta |
| 88066004 | `g05.inactivo@noctium.local` | Inactivo, dado de baja por 88066002 con motivo «Licencia prolongada» | «Reactivar» y un historial real |

## Nivel 2 — Pedidos HTTP

Sesiones: Gerente del seed (`gerente@noctium.local`), Mesa de entrada (`mesa.entrada@noctium.local`), Profesor (`profesor1@noctium.local`) y Alumno (`alumno01@noctium.local`) con la contraseña de las cuentas del seed; 88066002 con su contraseña ya cambiada; 88066001 con su DNI como contraseña inicial.

| # | Pedido | Esperado | Resultado |
|---|---|---|---|
| 0 | `GET /api/gerentes?q=8806600` | Los cuatro de la fixture, 88066004 inactivo | OK. 4 filas; 88066004 con `activo: false` |
| 1 a 4 | `GET /api/gerentes/{id}` de 88066001 a 88066004 | 200 con `historialEstados`, `motivoObligatorioAlDesactivar` y `esUltimoGerenteActivo` | OK. 88066001: `false`/`false`, sin historial; 88066002: `motivoObligatorio true`; 88066003: `SIN_CUENTA`, `false`/`false`; 88066004: inactivo, ambos `false`, historial `DESACTIVAR` «Licencia prolongada» con `usuarioNombre` «Prueba Baja, Renata» (88066002). `esUltimoGerenteActivo false` en todos |
| 5 y 6 | 88066001: login con su DNI y `GET /api/turnos` | Sesión válida, con la marca | OK. Sesión obtenida; 403 `DEBE_CAMBIAR_PASSWORD` |
| 7 a 9 | 88066002: login, `GET /api/gerentes` y su propia ficha | Opera; `esVos: true` | OK. Login a `/home`; 200; `esVos: true`, `version` 0 |
| 10 | 88066002 se desactiva a sí mismo (`version` actual, con motivo) | 422 | OK. 422 `NO_PUEDE_DESACTIVARSE_A_SI_MISMO`, «No podés desactivarte a vos mismo.» |
| 11 | Ídem con `version: 7` (vieja) | 422, no 409 | OK. 422 `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` |
| 12 | Ficha de 88066002 después de los dos pedidos | Sin ningún cambio | OK. Activa, `version` 0, cuenta activa, sin historial |
| 13 | 88066001: `{ version, activo }` | 400: campo ajeno | OK. 400 `VALIDATION_ERROR`, `detalles` vacío (`.strict()`) |
| 14 | Sin `version` | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.version` (mensaje de Zod) |
| 15 | Sin cuerpo | 400 | OK. 400 `VALIDATION_ERROR` |
| 16 | Motivo de 301 caracteres | 400 | OK. 400, `detalles.motivo: ["El motivo admite hasta 300 caracteres."]` |
| 17 | `version` distinta | 409 | OK. 409 `CONFLICTO_EDICION_CONCURRENTE` |
| 18 | Sin motivo, `version: 0` (sin operaciones) | 200 | OK. `{ id, activo: false, version: 1 }` |
| 19 | Sesión previa de 88066001: `GET /api/turnos` | 401 | OK. 401 `SESION_INVALIDA` |
| 20 | Login de 88066001 dado de baja | Rechazado por cuenta inactiva | OK. Redirige a `/login?error=CredentialsSignin&code=CUENTA_INACTIVA` |
| 21 | Desactivar de nuevo a 88066001 | 409 | OK. 409 `GERENTE_YA_INACTIVO` |
| 22 | 88066002 sin motivo (registró operaciones) | 400 | OK. 400 `MOTIVO_REQUERIDO`, «Ingresá el motivo de la baja: el gerente registró operaciones.» |
| 23 | 88066002 con motivo de solo espacios | 400 | OK. 400 `MOTIVO_REQUERIDO` |
| 24 | 88066002 con motivo «Fin de contrato» | 200 | OK. `{ activo: false, version: 1 }` |
| 25 | Sesión previa de 88066002: `GET /api/gerentes` | 401 | OK. 401 `SESION_INVALIDA` |
| 26 | Login de 88066002 dado de baja | Rechazado | OK. `code=CUENTA_INACTIVA` |
| 27 | 88066003 (sin cuenta), sin motivo | 200 | OK. `{ activo: false, version: 1 }` |
| 28 | Reactivar 88066003, `version: 1` | 200 | OK. `{ activo: true, version: 2 }` |
| 29 | `POST /api/gerentes/no-existe/desactivar` | 404 | OK. 404 `GERENTE_NO_ENCONTRADO` |
| 30 | 88066004 (ya inactivo) | 409 | OK. 409 `GERENTE_YA_INACTIVO` |
| 31 | Reactivar 88066004 con `version` vieja | 409 | OK. 409 `CONFLICTO_EDICION_CONCURRENTE` |
| 32 | Reactivar con `motivo` | 400: no lo pide | OK. 400 `VALIDATION_ERROR` (`.strict()`) |
| 33 | Reactivar sin `version` | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.version` |
| 34 | `POST /api/gerentes/no-existe/reactivar` | 404 | OK. 404 `GERENTE_NO_ENCONTRADO` |
| 35 | Reactivar 88066001, `version: 1` | 200 | OK. `{ activo: true, version: 2 }` |
| 36 | Reactivar de nuevo a 88066001 | 409 | OK. 409 `GERENTE_YA_ACTIVO` |
| 37 | Sesión previa de 88066001, ya reactivado | 401: las sesiones no se restauran | OK. 401 `SESION_INVALIDA` |
| 38 | Nuevo login de 88066001 con su DNI | Sesión iniciada | OK. Redirige a `/home` |
| 39 | Nueva sesión: `GET /api/turnos` | 403: sigue debiendo cambiar la contraseña | OK. 403 `DEBE_CAMBIAR_PASSWORD` |
| 40 | Nueva sesión: `GET /api/auth/session` | La marca conservada | OK. `debeCambiarPassword: true` |
| 41 | Reactivar 88066002, `version: 1` | 200 | OK. `{ activo: true, version: 2 }` |
| 42 | Sesión previa de 88066002 | 401 | OK. 401 `SESION_INVALIDA` |
| 43 y 44 | Nuevo login de 88066002 y `GET /api/gerentes` | Opera de nuevo | OK. Login a `/home`; 200 |
| 45 y 46 | Sin sesión: `POST …/desactivar` y `…/reactivar` | 401 | OK. 401 `SESION_INVALIDA` en los dos |
| 47 a 49 | Mesa de entrada, Profesor y Alumno: `POST …/desactivar`, `…/reactivar` y `GET /api/gerentes/{id}` | 403 | OK. 403 `SIN_PERMISO` en los nueve pedidos |

## Nivel 3 — SQL y pantallas (base de desarrollo)

| # | Verificación | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT f."dniFichaGerente", f."activoFichaGerente", f.version, f."modificadoPorUsuarioId" IS NOT NULL, u."activoUsuario", u."sesionesValidasDesdeUsuario" IS NOT NULL, u."debeCambiarPasswordUsuario" FROM fichas_gerente f LEFT JOIN usuarios u ON u."idUsuario" = f."usuarioId" WHERE f."dniFichaGerente" IN ('88066001','88066002','88066003','88066004','24100001','24100002');` | Tras baja y reactivación: ficha y cuenta activas, `version` 2, con modificador, umbral de sesiones fijado y la marca conservada; los gerentes del seed sin cambios | OK. 88066001: activa, `version` 2, cuenta activa, umbral fijado, marca `true`. 88066002: activa, `version` 2, cuenta activa, umbral fijado, marca `false` (la cambió la fixture). 88066003: activa, `version` 2, sin cuenta. 88066004: inactiva, `version` 1, cuenta inactiva, marca `true`. 24100001 y 24100002: los mismos valores que antes de las pruebas (activas, cuentas activas, sin umbral de sesiones) |
| 3.2 | `SELECT f."dniFichaGerente", h.accion, h.motivo, h."actorTipo", a."dniFichaGerente" AS actor FROM historial_estados h JOIN fichas_gerente f ON f."idFichaGerente" = h."entidadId" LEFT JOIN fichas_gerente a ON a."usuarioId" = h."usuarioId" WHERE h.entidad = 'FICHA_GERENTE' ORDER BY 1, h.fecha;` | Una fila por baja y por reactivación; ninguna por los rechazos | OK. 88066001: `DESACTIVAR` (sin motivo) y `REACTIVAR`; 88066002: `DESACTIVAR` «Fin de contrato» y `REACTIVAR`; 88066003: `DESACTIVAR` y `REACTIVAR`; todas `USUARIO` con actor 24100001. 88066004: `DESACTIVAR` «Licencia prolongada» con actor 88066002 (fixture). Ninguna por los pedidos rechazados (10, 11, 13 a 17, 21 a 23, 29 a 34 y 36) |
| 3.3 | `SELECT e."emailEvento", e."tipoEvento", count(*) FROM eventos_seguridad e WHERE e."emailEvento" IN ('g05.sinoperaciones@noctium.local','g05.operaciones@noctium.local') GROUP BY 1, 2;` | Alta, logins y el rechazo por cuenta inactiva | OK. 88066001: `CUENTA_CREADA` 1, `LOGIN_EXITOSO` 2 (pedidos 5 y 38), `CUENTA_INACTIVA_RECHAZADA` 1 (pedido 20). 88066002: `CUENTA_CREADA` 1, `PASSWORD_CAMBIADA` 1 (fixture), `LOGIN_EXITOSO` 2 (pedidos 7 y 43), `CUENTA_INACTIVA_RECHAZADA` 1 (pedido 26) |
| 3.4 | Filas de `historial_estados` con `usuarioId` de 88066002 | La baja que hizo sigue con su `usuarioId` después de su propia baja y reactivación | OK. 1 fila (la baja de 88066004) |
| 3.5 | Totales: `fichas_gerente`, activas, `historial_estados` de `FICHA_GERENTE` y total | Nada se borra | OK. 22 fichas de gerente (17 activas), 7 filas de historial de gerentes, 10 en total |
| 3.6 | Pantallas por HTTP: `/gerentes/{id}` de 88066001 a 88066004 con la sesión del Gerente del seed; la propia de 88066002 con su sesión; con Mesa de entrada y sin sesión | «Desactivar» o «Reactivar» según el estado; nunca «Desactivar» en la propia; «Historial de estados» con sus entradas; rechazos del proxy | OK (pedidos 50 a 56). 88066001, 88066002 y 88066003: «Desactivar», historial con «Desactivación» y «Reactivación» (88066002 con «Fin de contrato»); 88066004: «Reactivar», «Desactivación» con «Licencia prolongada»; la propia de 88066002: ni «Desactivar» ni «Reactivar», con su historial. Mesa de entrada → 307 a `/sin-permiso`; sin sesión → 307 a `/login` |

### Recorrido en el navegador

Realizado por el responsable, con la sesión de un gerente del seed:

- Fichas 88066001 a 88066004: la ficha y el modal de baja se ven como las figuras 97 y 98, con las diferencias ya documentadas en la sección 5 de la task (patrón vigente de HU-G-01 y HU-F-05).
- Baja de 88066002 (registró operaciones): el motivo es obligatorio, el botón «Desactivar» queda deshabilitado con el campo vacío y la ayuda dice «Obligatorio: tiene operaciones registradas»; con motivo, la baja se hizo.
- Baja sin motivo de una ficha sin operaciones (88066001): permitida.
- Baja de una ficha sin cuenta (88066003): se muestra el detalle de «sin cuenta».
- Reactivación (88066004 y las reactivadas): correcta, con su historial.
- Ficha propia: no aparece «Desactivar».
- El historial de estados muestra acción, fecha y hora, usuario y motivo, del más reciente al más antiguo.
- El listado de gerentes refleja el estado tras la baja y la reactivación: verificado en pantalla.
- «Debe quedar al menos un gerente activo» no se pudo reproducir en el navegador (la base de desarrollo tiene más gerentes activos): queda cubierto por los tests de PostgreSQL.

### Estado final de la base de desarrollo

- **88066001**, **88066002** y **88066003:** se dieron de baja y se reactivaron en las pruebas HTTP (y otra vez en el recorrido en el navegador, que suma versiones y filas de historial a las descriptas acá); quedan **activos**, como los dejó la fixture, pero con `version` 2, `modificadoPorUsuarioId` del gerente del seed y dos filas de historial cada uno (la baja no se borra). 88066001 conserva la marca de cambio obligatorio y tiene una sesión abierta del pedido 38; 88066002 sigue sin la marca y sigue «registrando operaciones» (motivo obligatorio).
- **88066004:** al cerrar las pruebas HTTP seguía sin cambios respecto de la fixture (inactivo, `version` 1, una fila `DESACTIVAR`); el responsable lo reactivó en el recorrido en el navegador.
- **24100001** y **24100002:** sin cambios.
- Las dos corridas del seed posteriores a las pruebas no restauraron nada: la fixture no vuelve a dar de baja a quien ya tiene historial ni vuelve a cambiar la contraseña de quien ya no tiene la marca.

## Observaciones conocidas

- El mensaje de `version` faltante en el 400 es el de Zod por defecto, como en la modificación de HU-G-01 y la baja de HU-F-05.
- Con los 4 gerentes de esta fixture, el seed base y las fixtures de HU-G-01, HU-G-03 y HU-G-05 suman 20 fichas de gerente (sigue en dos páginas de 10). La base de desarrollo tiene 22 por altas de pruebas manuales anteriores.
- Textos propuestos, pendientes de validar por el PO: `errores.gerente.noPuedeDesactivarseASiMismo` y `errores.gerente.motivoRequerido` (P-F6), y los marcados como propuestos en `textos.ts` (ver la nota de implementación de la spec G, punto 12).
