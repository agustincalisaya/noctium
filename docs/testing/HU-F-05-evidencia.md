# HU-F-05 — Evidencia de implementación y validación

Task: [HU-F-05](../tasks/Sprint%203/Modulo%20F/HU-F-05.md). Contrato: [Módulo F](../specs/spec_modulo_F.md) §2.4 a §2.7, §3.1, §3.4 a §3.7 y §4.

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (bases PostgreSQL descartables `noctium_pruebas_*`, creadas y borradas por el script; los archivos que corren el seed completo reciben una base propia).
- **Fixture:** `prisma/seed/fixtures/hu-f-05.ts`, ejecutado con `npx prisma db seed` sobre la base de desarrollo: dos veces seguidas al crearlo y otras dos después de las pruebas HTTP.
- **Nivel 2 (pedidos HTTP):** ejecutado con curl contra `next dev` local y la base de desarrollo, por Claude Code. Las sesiones se obtuvieron con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`). No se incluyen cookies ni contraseñas.
- **Nivel 3 (SQL y pantallas):** consultas de solo lectura contra la base de desarrollo (`psql` en el contenedor) y verificación de las pantallas por HTTP, por Claude Code. El recorrido interactivo en el navegador lo realizó el responsable. No se adjuntan capturas.
- Las pruebas manuales usaron solo los integrantes de la fixture (DNI 8806300x). Las dos cuentas de mesa de entrada del seed base (25100001 y 25100002, con la caja abierta) solo recibieron un pedido de baja rechazado (pedido 16), que no cambió nada.

## Criterios de aceptación (backlog, HU-F-05)

Los criterios están en `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-F-05, criterios 1 a 6; HU-A-06, criterio 7).

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1. «Desactivar» pide confirmación con el texto del backlog y el motivo (hasta 300), obligatorio si registró operaciones | `estado-integrante-dialog.test.tsx` (título y detalle de la figura 94, contador, tope de 300, confirmar deshabilitado con motivo obligatorio vacío); `personal.schema.test.ts` (301 rechazado, vacío = no enviado); `personal.service.test.ts` y `personal.estado.pg.test.ts` (`MOTIVO_REQUERIDO` con operaciones, opcional sin ellas y sin cuenta); `actividad-usuario.test.ts` y `.pg.test.ts` (las cuatro líneas de DEC-39); Nivel 2: pedidos 8, 10, 14 y 15 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido interactivo: realizado por el responsable |
| 2. Baja atómica de ficha y cuenta, sesiones revocadas, historial después del commit | `personal.service.test.ts` (orden bloqueo → relectura → caja → motivo → `updateMany` → cuenta → historial; sin historial si la cuenta falla); `personal.estado.pg.test.ts` («baja con cuenta…», con la cola de después del commit observando la baja ya confirmada desde otra conexión; «rollback…»; «dos bajas simultáneas…»); Nivel 2: pedidos 10 a 12; Nivel 3: consultas 3.1 y 3.2 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 2. No se desactiva con la caja abierta | `personal.service.test.ts` y `route.test.ts` (`CAJA_ABIERTA` 409 con el literal del backlog); `personal.estado.pg.test.ts` (caja abierta rechaza sin cambiar nada; cerrada, propia o por ausencia, procede; **concurrencia con `abrirCaja` en los dos órdenes**); `estado-integrante-dialog.test.tsx` (aviso informativo en lugar de la confirmación; el rechazo del servidor dentro del modal); Nivel 2: pedidos 1 y 16; Nivel 3: consulta 3.3 | 1, 2 y 3 | Verificado (test automatizado y ejecución). La pantalla «Cierres de caja» y el «Cierre por ausencia» desde la interfaz: **Bloqueado** hasta HU-I-12 |
| 3. Las operaciones conservan su nombre | `personal.estado.pg.test.ts` (la caja cerrada sigue con su `usuarioId` y `obtenerNombresPersonal` resuelve el nombre después de la baja); Nivel 3: consulta 3.3 | 1 y 3 | Verificado (test automatizado y ejecución) |
| 4. «Integrante desactivado correctamente», «Inactivo» en el listado y DNI reservado | `estado-integrante-dialog.test.tsx` (toast y refresco); `personal.estado.pg.test.ts` («el DNI y el email de la ficha inactiva siguen reservados»); listado de HU-F-03 (activos e inactivos, sin cambios); Nivel 2: pedido 0 | 1 y 2 | Verificado (test automatizado y ejecución) |
| 5. Reactivar con confirmación, historial conservado, cuenta activa y nuevo ingreso | `estado-integrante-dialog.test.tsx` (título, aviso de sesiones, sin motivo, toast); `personal.service.test.ts`; `personal.estado.pg.test.ts` («reactivar: … umbral de sesiones y marca conservados; varias bajas y reactivaciones se conservan»); Nivel 2: pedidos 19 a 29; Nivel 3: consultas 3.1, 3.2 y 3.4 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido interactivo: realizado por el responsable |
| 6. Solo el Gerente (403 a otros roles) | `desactivar/route.test.ts` y `reactivar/route.test.ts` (401 y 403 para MESA_ENTRADA, PROFESOR y ALUMNO); `actions.test.ts` (permiso antes de Zod); `paginas.test.tsx` (sin `personal:cambiar_estado`, ni «Desactivar» ni «Reactivar»); Nivel 2: pedidos 30 a 33; Nivel 3: verificación 3.6 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| A-06 c7 para Mesa de entrada (desactivar y reactivar la ficha desactiva y reactiva la cuenta; la marca se conserva) | `personal.estado.pg.test.ts`; Nivel 2: pedidos 11, 12, 26 a 29; Nivel 3: consulta 3.1 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |

**Verificaciones diferidas que cierra esta HU:**
- **HU-F-01, límite del criterio 7:** la edición sigue sin desactivar (el formulario no cambió); desactivar y reactivar se hacen desde la ficha. Verificado.
- **HU-F-03, criterio 3:** desde la ficha alcanzada por una fila del listado se accede a «Desactivar» y «Reactivar» (`paginas.test.tsx`; verificación 3.6). Verificado; el recorrido en el navegador lo realizó el responsable.
- **HU-I-12, criterio 10** (de Cali): «no se desactiva a quien tiene la caja abierta» queda verificado del lado de F (servicio, rutas, concurrencia y pedido 16). La pantalla «Cierres de caja» y el «Cierre por ausencia» desde la interfaz: **Bloqueado** hasta HU-I-12. El cierre por ausencia por servicio sí se probó (`personal.estado.pg.test.ts`, «caja cerrada por ausencia: la baja procede»).

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npm test`) | 3113 pasan, 0 fallan, 344 omitidos (244 archivos pasan, 50 omitidos) |
| `actividad-usuario.test.ts` (nuevo) | 6 |
| `personal.schema.test.ts` (con `DesactivarIntegranteSchema` y `ReactivarIntegranteSchema`) | 45 |
| `personal.service.test.ts` (detalle adaptado y ampliado; baja y reactivación) | 53 |
| `actions.test.ts` (con `desactivarIntegrante` y `reactivarIntegrante`) | 44 |
| `api/personal/[id]/route.test.ts` (detalle adaptado), `desactivar/route.test.ts` y `reactivar/route.test.ts` (nuevos) | 16, 15 y 10 |
| `estado-integrante-dialog.test.tsx` (nuevo) y `paginas.test.tsx` (ficha adaptada y ampliada) | 13 y 24 |
| `publico.aislamiento.test.ts` y `errores-dominio.test.ts` (sin cambios; cubren las lecturas y los errores nuevos) | 50 y 13 |
| PostgreSQL real: `personal.estado.pg.test.ts` (nuevo), `actividad-usuario.pg.test.ts` (nuevo) y `personal.service.pg.test.ts` | 11, 6 y 18; todas pasan |
| `npm run test:pg` completo | Pasada principal: 298 pasan, 34 omitidos. Pasadas aisladas con el seed completo: 6 + 5 + 1 + 18 + 16 pasan; falla 1 caso de `cancelaciones.service.pg.test.ts` (ver «Observaciones conocidas»), que corrido solo pasa 6 de 6 |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| `next build` | Compila; incluye `/api/personal/[id]/desactivar` y `/reactivar` |
| Fixture `hu-f-05.ts`, `npx prisma db seed` dos veces (y otras dos después de las pruebas HTTP) | La primera crea 88063001, 88063002 (con su caja abierta y cerrada) y 88063003 (dado de baja con motivo). Las siguientes no cambian nada: conteos de usuarios, fichas, cajas, historial de estados, eventos, clases, inscripciones y pagos, y las filas de las fichas (con `updatedAt`), cuentas, historial y cajas, idénticos antes y después. Un integrante reactivado a mano no se vuelve a dar de baja |

### Integrantes de prueba (fixture)

| DNI | Email | Estado inicial | Para qué |
|---|---|---|---|
| 88063001 | `f05.sinoperaciones@noctium.local` | Activo, con cuenta y la marca de cambio obligatorio, sin operaciones | Baja con motivo opcional |
| 88063002 | `f05.cajacerrada@noctium.local` | Activo, con cuenta, abrió y cerró su caja | Motivo obligatorio, sin caja abierta |
| 88063003 | `f05.inactivo@noctium.local` | Inactivo, dado de baja por el gerente del seed con motivo «Licencia prolongada» | «Reactivar» y un historial real |

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: Gerente (`gerente@noctium.local`), Mesa de entrada (`mesa.entrada@noctium.local`), Profesor (`profesor1@noctium.local`) y Alumno (`alumno01@noctium.local`) con la contraseña de las cuentas del seed, y el integrante 88063001 con su DNI como contraseña inicial.

| # | Pedido | Esperado | Resultado |
|---|---|---|---|
| 0 | `GET /api/personal?q=8806300` | Los tres de la fixture, 88063003 inactivo | OK. 3 filas; 88063003 con `activo: false` |
| 1 | `GET /api/personal/{id}` de 88063001, 88063002, 88063003 y 25100001 | 200 con `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar` | OK. 88063001: `false`/`false`, sin historial; 88063002: `cajaAbierta false`, `motivoObligatorio true`; 88063003: inactivo, ambos `false`, historial `DESACTIVAR` «Licencia prolongada» con `usuarioNombre` del gerente; 25100001: `cajaAbierta true`, `motivoObligatorio true` |
| 2 | Integrante 88063001: login y `GET /api/turnos` antes de la baja | Sesión válida, con la marca | OK. Sesión obtenida; 403 `DEBE_CAMBIAR_PASSWORD` (no 401: la sesión es válida) |
| 5 | `POST …/88063001/desactivar` con `{ version, activo }` | 400: campo ajeno | OK. 400 `VALIDATION_ERROR`, `detalles` vacío (`.strict()`) |
| 6 | Sin `version` | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.version` (mensaje de Zod) |
| 7 | Sin cuerpo | 400 | OK. 400 `VALIDATION_ERROR` |
| 8 | Motivo de 301 caracteres | 400 | OK. 400, `detalles.motivo: ["El motivo admite hasta 300 caracteres."]` |
| 9 | `version` distinta | 409 | OK. 409 `CONFLICTO_EDICION_CONCURRENTE` |
| 10 | Sin motivo, `version: 0` (sin operaciones) | 200 | OK. `{ id, activo: false, version: 1 }` |
| 11 | Sesión previa del integrante: `GET /api/turnos` | 401 | OK. 401 `SESION_INVALIDA` |
| 12 | Login del integrante dado de baja | Rechazado por cuenta inactiva | OK. Redirige a `/login?error=CredentialsSignin&code=CUENTA_INACTIVA` (`CUENTA_INACTIVA_RECHAZADA`, consulta 3.4) |
| 13 | Desactivar de nuevo a 88063001 | 409 | OK. 409 `INTEGRANTE_YA_INACTIVO` |
| 14 | 88063002 sin motivo (registró operaciones) | 400 | OK. 400 `MOTIVO_REQUERIDO`, «Ingresá el motivo de la baja: el integrante registró operaciones.» |
| 15 | 88063002 con motivo «Fin de contrato» | 200 | OK. `{ activo: false, version: 1 }` |
| 16 | 25100001 (caja abierta del seed) con motivo | 409 | OK. 409 `CAJA_ABIERTA` con el literal del backlog; la ficha no cambió (consulta 3.1) |
| 17 | 88063003 (ya inactivo) | 409 | OK. 409 `INTEGRANTE_YA_INACTIVO` |
| 18 | `POST /api/personal/no-existe/desactivar` | 404 | OK. 404 `INTEGRANTE_NO_ENCONTRADO` |
| 19 | `POST …/88063002/reactivar` con `version` vieja | 409 | OK. 409 `CONFLICTO_EDICION_CONCURRENTE` |
| 20 | Reactivar con `motivo` | 400: no lo pide | OK. 400 `VALIDATION_ERROR` (`.strict()`) |
| 21 | Reactivar sin `version` | 400 | OK. 400 `VALIDATION_ERROR`, `detalles.version` |
| 22 | Reactivar 88063001, `version: 1` | 200 | OK. `{ activo: true, version: 2 }` |
| 23 | Reactivar de nuevo a 88063001 | 409 | OK. 409 `INTEGRANTE_YA_ACTIVO` |
| 24 | Reactivar 88063002, `version: 1` | 200 | OK. `{ activo: true, version: 2 }` |
| 25 | `POST /api/personal/no-existe/reactivar` | 404 | OK. 404 `INTEGRANTE_NO_ENCONTRADO` |
| 26 | Sesión previa del integrante, ya reactivado | 401: las sesiones no se restauran | OK. 401 `SESION_INVALIDA` |
| 27 | Nuevo login del integrante con su DNI | Sesión iniciada | OK. Redirige a `/home` (`LOGIN_EXITOSO`) |
| 28 | Nueva sesión: `GET /api/turnos` | 403: sigue debiendo cambiar la contraseña | OK. 403 `DEBE_CAMBIAR_PASSWORD` (el proxy lo manda a `/primer-ingreso`) |
| 29 | Nueva sesión: `GET /api/auth/session` | La marca conservada | OK. `debeCambiarPassword: true` |
| 30 | Sin sesión: `POST …/desactivar` y `…/reactivar` | 401 | OK. 401 `SESION_INVALIDA` en las dos |
| 31 a 33 | Mesa de entrada, Profesor y Alumno: `POST …/desactivar`, `…/reactivar` y `GET /api/personal/{id}` | 403 | OK. 403 `SIN_PERMISO` en los nueve pedidos |

## Nivel 3 — SQL y pantallas (base de desarrollo)

| # | Verificación | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT f."dniFichaMesaEntrada", f."activoFichaMesaEntrada", f.version, f."modificadoPorUsuarioId" IS NOT NULL, u."activoUsuario", u."sesionesValidasDesdeUsuario" IS NOT NULL, u."debeCambiarPasswordUsuario" FROM fichas_mesa_entrada f LEFT JOIN usuarios u ON u."idUsuario" = f."usuarioId" WHERE f."dniFichaMesaEntrada" IN ('88063001','88063002','88063003','25100001','25100002');` | Tras baja y reactivación: ficha y cuenta activas, `version` 2, con modificador, umbral de sesiones fijado y la marca conservada; las del seed base sin cambios | OK. 88063001 y 88063002: activas, `version` 2, con modificador, cuenta activa, umbral fijado, marca `true`. 88063003: inactiva, `version` 1, cuenta inactiva, marca `true`. 25100001 y 25100002: activas, `version` 0, sin modificador, sin umbral (la baja rechazada del pedido 16 no cambió nada) |
| 3.2 | `SELECT f."dniFichaMesaEntrada", h.accion, h.motivo, h."actorTipo", h."usuarioId" = <gerente> FROM historial_estados h JOIN fichas_mesa_entrada f ON f."idFichaMesaEntrada" = h."entidadId" WHERE h.entidad = 'FICHA_MESA_ENTRADA' ORDER BY 1, h.fecha;` | Una fila por baja y por reactivación, con el gerente; ninguna por los rechazos | OK. 88063001: `DESACTIVAR` (sin motivo) y `REACTIVAR`; 88063002: `DESACTIVAR` «Fin de contrato» y `REACTIVAR`; 88063003: `DESACTIVAR` «Licencia prolongada». Todas `USUARIO` y del gerente. Ninguna de 25100001 ni de los pedidos rechazados (9, 13, 14, 16, 17, 19 y 23) |
| 3.3 | `SELECT f."dniFichaMesaEntrada", c.estado, c."porAusencia" FROM cajas c JOIN fichas_mesa_entrada f ON f."usuarioId" = c."usuarioId" WHERE f."dniFichaMesaEntrada" IN ('88063002','25100001','25100002');` | La caja de 88063002 se conserva cerrada; las del seed siguen abiertas | OK. 88063002: `CERRADA`; 25100001 y 25100002: `ABIERTA` |
| 3.4 | `SELECT e."tipoEvento", count(*) FROM eventos_seguridad e WHERE e."emailEvento" = 'f05.sinoperaciones@noctium.local' GROUP BY 1;` | Alta, login rechazado por cuenta inactiva y logins exitosos | OK. `CUENTA_CREADA` 1, `LOGIN_EXITOSO` 2 (pedidos 2 y 27), `CUENTA_INACTIVA_RECHAZADA` 1 (pedido 12) |
| 3.5 | Totales: `SELECT count(*)` de `fichas_mesa_entrada`, `historial_estados` y `cajas` | Nada se borra | OK. 19 fichas, 7 filas de historial de estados (2 de otras entidades y 5 de esta HU), 3 cajas |
| 3.6 | Pantallas por HTTP con la sesión del Gerente: `/personal/{id}` de 88063001, 88063002, 88063003 y 25100001; con Mesa de entrada y sin sesión | «Desactivar» o «Reactivar» según el estado; «Historial de estados» con sus entradas o «Sin bajas ni reactivaciones.»; rechazos del proxy | OK. 88063001 y 88063002: «Desactivar», historial con «Desactivación» y «Reactivación» y el nombre del gerente (88063002 con «Fin de contrato»); 88063003: «Reactivar», «Desactivación» con «Licencia prolongada»; 25100001: «Desactivar» y «Sin bajas ni reactivaciones.». Mesa de entrada → 307 a `/sin-permiso`; sin sesión → 307 a `/login` |

### Estado final de la base de desarrollo

- **88063001** y **88063002:** se dieron de baja y se reactivaron en las pruebas HTTP; quedan **activos**, como los dejó la fixture, pero con `version` 2, `modificadoPorUsuarioId` del gerente, el umbral de sesiones fijado y dos filas de historial cada uno (la baja no se borra). Sus cuentas siguen con la marca de cambio obligatorio. 88063001 tiene una sesión abierta del pedido 27.
- **88063003:** sin cambios respecto de la fixture (inactivo, `version` 1, una fila `DESACTIVAR`), listo para probar «Reactivar» en el navegador.
- **25100001** y **25100002:** sin cambios (activas, `version` 0, sin historial, con su caja abierta).
- Las dos corridas del seed posteriores a las pruebas no restauraron nada: la fixture no vuelve a dar de baja a quien ya tiene historial.

## Observaciones conocidas

- `npm run test:pg`: 1 caso de `cancelaciones.service.pg.test.ts` (HU-H-10, «el borde venceEl clasifica…») falla en la corrida completa y pasa corrido solo (6 de 6, con el mismo seed completo, fixture de esta HU incluida). Es el fallo de orden ya conocido; esta HU no crea inscripciones ni reservas.
- Los 5 casos de `npm test` y los 6 de `test:pg` de HU-C-19, y los 2 archivos que corrían el seed completo sobre la base compartida, ya no fallan (corregidos en `develop`; el script de `test:pg` les da una base propia).
- El mensaje de `version` faltante o no entera en el 400 es el de Zod por defecto, como en la modificación de HU-F-01.
- `abrirCaja` toma `FOR UPDATE` sobre la ficha (`bloquearIntegranteActivo` usa `bloquear`), no `FOR SHARE` como dice la spec F §3.4. La serialización con la baja está probada en los dos órdenes; anotado en la nota de implementación de la spec.
- El texto de `MOTIVO_REQUERIDO` es propuesto y queda pendiente de validar por el PO (P-F6).
