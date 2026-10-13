# HU-G-01 — Evidencia de implementación y validación

Task: [HU-G-01](../../../tasks/Sprint%203/Modulo%20G/HU-G-01.md). Contrato: [Módulo G](../../../specs/spec_modulo_G.md) §2.1, §2.2, §2.4, §3 y §4 (con su «Nota de implementación HU-G-01»); mismo diseño que [Módulo F](../../../specs/spec_modulo_F.md). Verifica además HU-A-06, criterios 1, 2, 5 y 6, para el rol Gerente.

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*` en el servidor local, creada y borrada por el script).
- **Fixtures:** `prisma/seed/fixtures/hu-g-01.ts`, ejecutado con `npx prisma db seed` dos veces sobre la base de desarrollo (el seed completo, con todas las fixtures, termina sin errores las dos veces).
- **Nivel 2 (pedidos HTTP):** ejecutado con curl (no con Postman) contra `next dev` local y la base de desarrollo, por Claude Code a pedido del responsable. La sesión se obtuvo con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`). El cambio de contraseña del primer ingreso se ejecutó invocando la Server Action `cambiarPasswordPropia` de `/primer-ingreso` (encabezado `Next-Action`), la misma que dispara la pantalla. No se incluyen cookies ni contraseñas de las cuentas del seed.
- **Nivel 3 (SQL):** ejecutado con SQL directo (solo `SELECT`) contra la base de desarrollo, por Claude Code, con las consultas tal como figuran abajo.
- **Pantallas:** Claude Code verificó por HTTP, con la sesión del Gerente, que cada pantalla responde y muestra sus elementos, y las redirecciones del proxy (recorrido 3.7). El recorrido interactivo en el navegador, como Gerente y como Mesa de entrada, lo realizó el responsable, sin observaciones (ver «Recorrido en el navegador»). No se adjuntan capturas.

## Criterios de aceptación (backlog, HU-G-01)

1. Desde “Gerentes”, la opción “Nuevo gerente” abre el formulario de Identidad y Contacto, con los mismos campos, validaciones y normalizaciones de HU-F-01 (email obligatorio, HU-A-06; errores junto al campo y sin cambios parciales).
2. El DNI no puede pertenecer a otro gerente, activo o inactivo: “Ya existe un gerente registrado con ese DNI”. El email no puede estar en uso como email de acceso de otra cuenta, sin revelar a quién pertenece. Ambas verificaciones se repiten en el servidor.
3. Con datos válidos se crea la ficha Activa, registrando fecha de alta y usuario, y se informa “Gerente registrado correctamente”, completado con la cuenta creada según HU-A-06, criterio 5.
4. Modificar: desde la ficha, “Editar” reabre el formulario precargado con las mismas validaciones (la unicidad excluye la propia ficha). Al guardar se actualizan la ficha y la fecha de última modificación, y se informa “Gerente actualizado correctamente”; si no hubo cambios, Guardar permanece deshabilitado. Modificar el email cambia también el email de la cuenta de acceso (HU-A-06, criterio 6).
5. Registrar la ficha crea, en la misma transacción, la cuenta de acceso del gerente con su email y su DNI como contraseña inicial, que debe cambiar en el primer ingreso (HU-A-06).
6. Cancelar vuelve al listado o a la ficha sin guardar, con confirmación si hay datos o cambios. Solo un Gerente puede registrar y modificar gerentes; el servidor rechaza con 403 a otros roles.

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1 | `gerente-form.test.tsx` (modo alta: título, bajada, «Cancelar» y «Registrar» arriba, Identidad y Contacto con la nota del email, «Sin especificar»; errores junto a cada campo, sin envío parcial); `gerente.schema.test.ts` (nombre y apellido, DNI con la longitud configurada, fecha futura e inexistente, teléfono de 8 a 15 dígitos, email en minúsculas y hasta 254, email faltante con el mensaje del backlog, `.strict()`); `paginas.test.tsx` (listado con «Nuevo gerente»; alta con título y bajada del prototipo); `Sidebar.gerentes.test.tsx`; rutas y acciones (400 `VALIDATION_ERROR` sin llamar al servicio); Nivel 2: pedidos 1 (teléfono normalizado), 4, 5 y 17; recorrido 3.7 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 2 | `gerente.service.test.ts` y `gerente.service.pg.test.ts` (DNI en uso, activo o inactivo, con el texto de gerente; acotado a `FichaGerente`; email de otra cuenta sin revelar de quién; altas simultáneas con el mismo DNI y el mismo email); `gerente-form.test.tsx` (verificación al salir del DNI y del email; con el DNI marcado no abre la confirmación); `actions.test.ts` (`verificarDisponibilidadGerente`: solo la disponibilidad, permiso por modo); Nivel 2: pedidos 2, 3, 15 y 16 | 1 y 2 | Verificado (test automatizado y ejecución). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 3 | `gerente.service.pg.test.ts` («alta: ficha activa y cuenta GERENTE juntas, … y la auditoría»); `gerente-form.test.tsx` (confirmación y navegación a `/gerentes/[id]?creado=1`); `paginas.test.tsx` («banner tras el alta (con la cuenta creada)…»); Nivel 2: pedidos 1 y 11; Nivel 3: consultas 3.1 y 3.2; recorrido 3.7 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 4 | `gerente.service.test.ts` y `gerente.service.pg.test.ts` (solo lo que cambia, `version + 1`, `modificadoPor`; sin cambios no escribe; modificación simultánea; la unicidad excluye la propia ficha; ficha inactiva modificable; cambio de email sincronizado sin revocar sesiones); `gerente-form.test.tsx` (precarga, «Guardar» deshabilitado sin cambios, confirmación, aviso del email y aviso propio, «Recargar»); `paginas.test.tsx` («Editar» solo con `gerentes:editar`, banner tras editar, última modificación); Nivel 2: pedidos 12 a 18 y 22 a 24; Nivel 3: consulta 3.3 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 5 | `gerente.service.pg.test.ts` (cuenta con rol `GERENTE`, la marca y el hash del DNI; «alta atómica: si la cuenta falla …» y «… si la ficha falla …, no queda su cuenta»; la contraseña inicial no aparece en ningún resultado, evento ni log); Nivel 2: pedidos 1 y 19 a 21 (primer ingreso); Nivel 3: consultas 3.2, 3.4 y 3.5 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 6 (Cancelar) | `gerente-form.test.tsx` («Cancelar» sin datos vuelve al listado; con datos pide confirmar el descarte; en la edición, sin cambios vuelve a la ficha) | 1 | Verificado (test automatizado). Recorrido en el navegador: realizado por el responsable, sin observaciones |
| 6 (solo el Gerente, 403) | Rutas (`route.test.ts` y `[id]/route.test.ts`) y acciones (`actions.test.ts`): 401 sin sesión, 403 para MESA_ENTRADA, PROFESOR y ALUMNO, permiso antes de Zod; `gerente.service.pg.test.ts` (ruta real contra PostgreSQL y la matriz `gerentes:*` solo para GERENTE); `rutas-por-rol.test.ts`; `paginas.test.tsx` (sin permiso no consulta); Nivel 2: pedidos 6 a 10 y 25; recorrido 3.7 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |

### HU-A-06 para el rol Gerente

| Criterio de A-06 | Qué lo cubre | Estado |
|---|---|---|
| 1. Email obligatorio y único, sin revelar de quién es | Criterios 1 y 2 de arriba; Nivel 2: pedidos 3, 4, 15 y 17 | Verificado |
| 2. Cuenta creada en la misma transacción, rol `GERENTE` fijado por el tipo de ficha, contraseña solo como hash | Criterio 5 de arriba; `.strict()` rechaza `rol` (pedido 5); Nivel 3: consultas 3.2 y 3.5 | Verificado |
| 5. Mensaje de alta y sección «Cuenta de acceso» | `paginas.test.tsx` (banner y `CuentaAccesoCard` con rol Gerente); recorrido 3.7 | Verificado |
| 6. Cambio de email sincronizado con la cuenta | `gerente.service.pg.test.ts`; Nivel 2: pedidos 13, 18 y 22 a 24; Nivel 3: consulta 3.3 | Verificado |
| Primer ingreso del gerente nuevo (con su email y su DNI, el servidor lo manda a `/primer-ingreso`) | Nivel 2: pedidos 19 a 21 | Verificado |

El criterio 7 de A-06 (baja y reactivación de la cuenta) para gerentes queda para HU-G-05.

### DEC-44 — el gerente modifica su propio email

| Qué | Cómo | Estado |
|---|---|---|
| El cambio del email propio no toca `sesionesValidasDesde` y la misma sesión sigue válida | `gerente.service.pg.test.ts` («DEC-44: el gerente cambia su propio email y su misma sesión sigue válida», con la ruta real y `withPermission` contra la base) | Verificado |
| Flujo completo con el gerente de la fixture (88064001) | Nivel 2: pedidos 19 a 24; Nivel 3: consulta 3.6 | Verificado |
| Aviso distinto en la confirmación | `gerente-form.test.tsx` («si cambia su propio email, la confirmación avisa que su sesión sigue abierta»). Texto **propuesto**, pendiente del PO | Verificado (test automatizado). Recorrido en el navegador: realizado por el responsable, sin observaciones |

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npm test`) | 3624 pasan, 460 omitidos por guarda, 0 fallan (276 archivos pasan, 56 omitidos) |
| Archivos de HU-G-01 (9, más `rutas-por-rol.test.ts`) | 208 pruebas sin PostgreSQL, todas pasan |
| `gerente.schema.test.ts` | 24 |
| `gerente.service.test.ts` (con mocks) | 30 |
| `actions.test.ts` | 28 |
| `api/gerentes/route.test.ts` y `api/gerentes/[id]/route.test.ts` | 17 y 18 |
| `gerente-form.test.tsx` y `paginas.test.tsx` | 24 y 15 |
| `Sidebar.gerentes.test.tsx` | 9 |
| `rutas-por-rol.test.ts` (con los casos de HU-G-01) | 43 |
| PostgreSQL real: `gerente.service.pg.test.ts` | 17, todas pasan (alta atómica, concurrencia, DEC-44 con la ruta real, 403 por rol y la matriz `gerentes:*`) |
| `npm run test:pg` completo | Pasada principal: 406 pasan, 40 omitidas, 0 fallan (48 archivos pasan, 4 omitidos). Pasadas con base propia o con nombre fijo: 2, 18 y 22 pasan; fallan 3 archivos ajenos a esta HU (ver «Observaciones conocidas») |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| `next build` | Compila; genera `/gerentes`, `/gerentes/nuevo`, `/gerentes/[id]`, `/gerentes/[id]/editar`, `/api/gerentes` y `/api/gerentes/[id]` |
| Fixture `hu-g-01.ts`, dos veces con `npx prisma db seed` | La segunda vuelta no duplica ni falla: 4 fichas de gerente, las dos de la fixture sin cambios (estado, `version`, cuenta y hash). El único cambio entre vueltas es el hash de las cuentas del seed base, que `seed.ts` vuelve a calcular en cada corrida con la misma contraseña (comportamiento anterior a esta HU) |

### Gerentes de prueba

| Caso | DNI | Email | Estado de la cuenta | Contraseña para ingresar |
|---|---|---|---|---|
| Seed base (no se modifica en ninguna prueba) | 24100001 | gerente@noctium.local | Activa | La de las cuentas del seed (`prisma/seed.ts`) |
| Seed base (no se modifica en ninguna prueba) | 24100002 | gerente2@noctium.local | Activa | La de las cuentas del seed |
| Fixture: activo, primer ingreso | 88064001 | g01.activo@noctium.local | Activa · debe cambiar la contraseña | Su DNI |
| Fixture: inactivo (DNI y email reservados) | 88064002 | g01.inactivo@noctium.local | Inactiva (ficha y cuenta) | — (no puede ingresar) |

En la base de desarrollo, el gerente 88064001 quedó con el email y la contraseña de la verificación de DEC-44 (ver «Filas que quedan en la base de desarrollo»). Un `npx prisma migrate reset --force` y el seed lo vuelven al estado de la tabla.

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: Gerente (`gerente@noctium.local`), Mesa de entrada (`mesa.entrada@noctium.local`), Profesor (`profesor1@noctium.local`) y Alumno (`alumno01@noctium.local`), con la contraseña de las cuentas del seed; para DEC-44, el gerente 88064001 de la fixture. Los DNI 8806402x no los usa la fixture. `{id}` es el de la ficha del pedido 1 y `{propia}` el de la ficha 88064001.

| # | Pedido | Cuerpo de ejemplo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | Gerente: `POST /api/gerentes` | `{"nombre":"Carla","apellido":"Prueba Http","dni":"88064021","fechaNacimiento":"1986-03-08","genero":"FEMENINO","email":"g01.http.alta@noctium.local","telefono":"(011) 5550-4021"}` | 201 con la ficha y `cuenta`, sin contraseña | OK. 201, `telefono: "01155504021"`, `activo: true`, `cuenta = { estado: "ACTIVA", email, rol: "GERENTE", debe_cambiar_password: true }`; ninguna clave de contraseña ni hash |
| 2 | `POST /api/gerentes` | Como el 1, con `"dni":"88064002"` (ficha inactiva) | 409 `DNI_DUPLICADO` | OK. 409 `DNI_DUPLICADO`, «Ya existe un gerente registrado con ese DNI» |
| 3 | `POST /api/gerentes` | Como el 1, con `"dni":"88064023"` y el email de la cuenta de un alumno en mayúsculas | 409 `EMAIL_YA_ASOCIADO`, sin decir de quién | OK. 409 `EMAIL_YA_ASOCIADO`, «Ese email ya está asociado a otra cuenta» |
| 4 | `POST /api/gerentes` | `{"nombre":"C","apellido":"Prueba Http","dni":"123","fechaNacimiento":"2099-01-01"}` | 400 `VALIDATION_ERROR` por campo | OK. 400; `detalles`: nombre (mínimo 2), DNI (entre 7 y 8 dígitos), fecha futura y email con el mensaje del backlog |
| 5 | `POST /api/gerentes` | Como el 1, con `"rol":"MESA_ENTRADA"` | 400 (`.strict()`) | OK. 400 `VALIDATION_ERROR`, `detalles` vacío (el error es de la raíz) |
| 6 | Mesa de entrada, Profesor y Alumno: `POST /api/gerentes` | Como el 1, con otro DNI | 403 `SIN_PERMISO` | OK. 403 `SIN_PERMISO` con los tres roles |
| 7 | Los tres roles: `GET /api/gerentes` | — | 403 | OK. 403 con los tres |
| 8 | Los tres roles: `GET /api/gerentes/{id}` | — | 403 | OK. 403 con los tres |
| 9 | Los tres roles: `PATCH /api/gerentes/{id}` | `{"nombre":"Otra","version":0}` | 403 | OK. 403 `SIN_PERMISO` con los tres |
| 10 | Sin sesión: `GET /api/gerentes` y `PATCH /api/gerentes/{id}` | — | 401 | OK. 401 `SESION_INVALIDA` en los dos |
| 11 | Gerente: `GET /api/gerentes` y `GET /api/gerentes/{id}` | — | 200 con el listado ordenado y el detalle | OK. 200; el listado `{ items, total: 5 }` (activos e inactivos, por apellido); el detalle con `version: 0`, `fechaNacimiento: "1986-03-08"`, `modificadoEl: null`, `cuenta` y `esVos: false` |
| 12 | `PATCH /api/gerentes/{id}` | `{"nombre":"Carla","telefono":"01155504021","version":0}` | 200 sin cambios | OK. 200, `campos_modificados: []`, `version: 0` |
| 13 | `PATCH /api/gerentes/{id}` | `{"email":"g01.http.nuevo@noctium.local","telefono":null,"version":0}` | 200; la cuenta pasa al email nuevo | OK. 200, `campos_modificados: ["telefono","email"]`, `version: 1` |
| 14 | `PATCH /api/gerentes/{id}` | `{"nombre":"Otra","version":0}` | 409 por la versión vieja | OK. 409 `CONFLICTO_EDICION_CONCURRENTE`, «La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.» |
| 15 | `PATCH /api/gerentes/{id}` | `{"email":"gerente2@noctium.local","version":1}` | 409 `EMAIL_YA_ASOCIADO` | OK. 409 `EMAIL_YA_ASOCIADO` (sin tocar la cuenta del seed) |
| 16 | `PATCH /api/gerentes/{id}` | `{"dni":"88064001","version":1}` | 409 `DNI_DUPLICADO` | OK. 409 `DNI_DUPLICADO` |
| 17 | `PATCH /api/gerentes/{id}` | `{"email":"","version":1}` | 400, el email no se puede vaciar | OK. 400, `detalles.email`: «Ingresá el email: con él se crea la cuenta de acceso» |
| 18 | `GET /api/gerentes/no-existe` y `PATCH /api/gerentes/no-existe`; `GET /api/gerentes/{id}` | — | 404; el detalle con el email nuevo | OK. 404 `GERENTE_NO_ENCONTRADO`, «El gerente no existe», en los dos; el detalle con `version: 1`, `modificadoEl` con fecha, `telefono: null` y `cuenta.email` igual al email nuevo |
| 19 | DEC-44: login del gerente 88064001 con `g01.activo@noctium.local` y su DNI | — | Sesión iniciada, con la marca | OK. Sesión obtenida (`LOGIN_EXITOSO`, consulta 3.4) |
| 20 | Con esa sesión: `GET /home` y `GET /gerentes`; `GET /api/gerentes` | — | 307 a `/primer-ingreso`; 403 `DEBE_CAMBIAR_PASSWORD` | OK. 307 → `/primer-ingreso` en las dos páginas; la API responde 403 `DEBE_CAMBIAR_PASSWORD`, «Tenés que cambiar tu contraseña para seguir» |
| 21 | Con esa sesión: cambio de contraseña en `/primer-ingreso` (Server Action `cambiarPasswordPropia`, `password_nueva` y `confirmacion`) | — | Contraseña cambiada y sesión reemitida sin la marca | OK. 200, cookie de sesión nueva; con ella `GET /home` responde 200 (`PASSWORD_CAMBIADA` y `LOGIN_EXITOSO`, consulta 3.4) |
| 22 | Con la sesión reemitida: `GET /api/gerentes/{propia}` y `PATCH /api/gerentes/{propia}` | `{"email":"g01.activo.nuevo@noctium.local","version":0}` | `esVos: true`; 200 | OK. El detalle con `esVos: true` y `debe_cambiar_password: false`; el `PATCH` responde 200, `campos_modificados: ["email"]`, `version: 1` |
| 23 | **La misma sesión**, después del `PATCH`: `GET /api/gerentes/{propia}`, `GET /api/gerentes` y `GET /gerentes` | — | 200, la sesión sigue | OK. 200 en los tres; el detalle con `email` y `cuenta.email` nuevos y `esVos: true` |
| 24 | Login con el email viejo (`g01.activo@…`) y con el nuevo (`g01.activo.nuevo@…`), con la contraseña nueva | — | El viejo falla; el nuevo entra | OK. Email viejo: sin sesión (`CREDENCIALES_INVALIDAS`, `LOGIN_FALLIDO`); email nuevo: sesión obtenida (`LOGIN_EXITOSO`), y con ella `GET /api/gerentes/{propia}` responde 200 |
| 25 | Mesa de entrada, Profesor y Alumno: `GET /gerentes`, `/gerentes/nuevo`, `/gerentes/{id}` y `/gerentes/{id}/editar`; sin sesión: `/gerentes` y `/gerentes/nuevo` | — | Redirige el proxy | OK. Los tres roles: 307 → `/sin-permiso` en las cuatro rutas, con un cuerpo de 12 bytes (la redirección del proxy, sin renderizar la página; como referencia, `/formas-pago`, fuera del `matcher`, redirige desde la página con un cuerpo de unos 31 KB). Sin sesión: 307 → `/login?callbackUrl=…`, el `callbackUrl` que solo agrega el proxy. El Gerente sigue entrando a `/gerente` (Indicadores): 200 |

## Nivel 3 — SQL y pantallas (ejecutado contra la base de desarrollo)

| # | Consulta | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT f."dniFichaGerente", f."activoFichaGerente", f.version, f."nombreNormalizadoFichaGerente", f."apellidoNormalizadoFichaGerente", f."creadoPorUsuarioId" = g."idUsuario" AS creado_por_gerente, f."modificadoPorUsuarioId" IS NULL AS sin_modificador FROM fichas_gerente f CROSS JOIN (SELECT "idUsuario" FROM usuarios WHERE "emailUsuario" = 'gerente@noctium.local') g WHERE f."dniFichaGerente" LIKE '8806%' ORDER BY f."dniFichaGerente";` | Alta: activa, `version = 0`, creada por el Gerente, sin modificador y nombres normalizados | OK. Las tres creadas por el Gerente con nombres normalizados (`tomas` / `prueba gerente`, `valeria` / `prueba gerente`, `carla` / `prueba http`). Las tres quedaron con `version 1` y modificador porque se modificaron después del alta: 88064001 en el pedido 22, 88064002 por la fixture (baja) y 88064021 en el pedido 13. Que el alta deja `version 0` y `modificadoPorUsuarioId` nulo lo prueba `gerente.service.pg.test.ts`, y el pedido 11 lo mostró por HTTP (`version: 0`, `modificadoEl: null`) |
| 3.2 | `SELECT u."emailUsuario", u."rolUsuario", u."activoUsuario", u."debeCambiarPasswordUsuario", u."sesionesValidasDesdeUsuario" IS NOT NULL AS sesiones_revocadas, u."passwordHashUsuario" LIKE '$2%' AS es_hash, u."passwordHashUsuario" LIKE '%8806%' AS dni_en_claro FROM usuarios u WHERE u."emailUsuario" LIKE 'g01.%' ORDER BY u."emailUsuario";` | Rol `GERENTE`, contraseña solo como hash; el cambio de email no revoca sesiones | OK. Tres cuentas `GERENTE`, `es_hash = true` y `dni_en_claro = false` en todas. `g01.http.nuevo@…` (email cambiado en el pedido 13): con la marca y sin revocación. `g01.inactivo@…`: inactiva y revocada por `desactivarCuenta`. `g01.activo.nuevo@…`: sin la marca y con `sesionesValidasDesde` fijado por el cambio de contraseña del pedido 21, no por el cambio de email (consulta 3.6) |
| 3.3 | `SELECT f."dniFichaGerente", f.version, f."modificadoPorUsuarioId" IS NOT NULL AS con_modificador, f."emailFichaGerente", u."emailUsuario", f."emailFichaGerente" = u."emailUsuario" AS email_igual FROM fichas_gerente f LEFT JOIN usuarios u ON u."idUsuario" = f."usuarioId" ORDER BY f."dniFichaGerente";` | `email_igual = true` en todas, también tras los cambios de email | OK. Las 5 fichas con `email_igual = true`; 24100001 y 24100002 con `version 0` y sin modificador |
| 3.4 | `SELECT e."tipoEvento", e."emailEvento", e."ipEvento" FROM eventos_seguridad e WHERE e."emailEvento" LIKE 'g01.%' ORDER BY e."creadoEnEvento";` | Un `CUENTA_CREADA` por cuenta creada; los eventos del flujo DEC-44 | OK. `CUENTA_CREADA` para las dos de la fixture (IP `127.0.0.1`) y la del pedido 1; después, para 88064001: `LOGIN_EXITOSO` (pedido 19), `PASSWORD_CAMBIADA` y `LOGIN_EXITOSO` de la reemisión (pedido 21), `LOGIN_FALLIDO` con el email viejo y `LOGIN_EXITOSO` con el nuevo (pedido 24) |
| 3.5 | `SELECT COUNT(*) FROM eventos_seguridad WHERE "emailEvento" LIKE 'g01.%' AND ("emailEvento" ~ '8806[0-9]{4}' OR "ipEvento" ~ '8806[0-9]{4}');` | 0: ningún evento contiene un DNI | OK. `count = 0` |
| 3.6 | Para 88064001: `SELECT u."sesionesValidasDesdeUsuario" < f."updatedAtFichaGerente" AS revocacion_anterior_al_patch, (SELECT MAX(e."creadoEnEvento") FROM eventos_seguridad e WHERE e."usuarioId" = u."idUsuario" AND e."tipoEvento" = 'PASSWORD_CAMBIADA') AS password_cambiada, u."sesionesValidasDesdeUsuario" FROM fichas_gerente f JOIN usuarios u ON u."idUsuario" = f."usuarioId" WHERE f."dniFichaGerente" = '88064001';`; para 24100001 y 24100002: email, marca y `sesionesValidasDesdeUsuario IS NULL` | La única revocación es la del cambio de contraseña, anterior al cambio de email; los gerentes del seed, intactos | OK. `revocacion_anterior_al_patch = true`: `sesionesValidasDesde` coincide con `PASSWORD_CAMBIADA` (pedido 21) y es anterior a la modificación de la ficha (pedido 22), que no lo movió. 24100001 y 24100002: su email de siempre, sin la marca y sin revocación |
| 3.7 | Pantallas por HTTP con la sesión del Gerente: `/gerentes`, `/gerentes/nuevo`, `/gerentes/{id}?creado=1`, `/gerentes/{id}?actualizada=1`, la ficha inactiva, `/gerentes/{id}/editar`, `/gerentes/no-existe` y `/gerentes/no-existe/editar` | 200 con sus elementos; 404 | OK. Listado con «Nuevo gerente», las 5 filas enlazadas a su ficha y sin buscador; en el menú, la sección «Gerentes» con solo «Listado» (`/gerentes`) marcado como activo, no «Indicadores»; alta con la bajada, «Sin especificar» y la nota del email; ficha con el banner del alta, «Cuenta de acceso» y «Editar», sin «Desactivar», «Reactivar» ni historial; banner tras editar; la etiqueta «Inactivo» en la ficha inactiva; edición precargada con «Guardar»; 404 para un id inexistente en la ficha y en la edición |

### Filas que quedan en la base de desarrollo

- Fichas de gerente 88064001 y 88064002, de la fixture, con sus cuentas. 88064001 terminó con el email `g01.activo.nuevo@noctium.local` y la contraseña definida en el pedido 21, sin la marca (verificación de DEC-44): ya no sirve para probar el primer ingreso hasta que se reinicie la base.
- Ficha 88064021 «Carla Prueba Http» (pedidos 1 y 13), con la cuenta `g01.http.nuevo@noctium.local`, todavía con la marca.
- Eventos de seguridad de esas cuentas (consulta 3.4).
- Los gerentes del seed base (24100001 y 24100002) no se modificaron (consultas 3.3 y 3.6; el pedido 15 fue rechazado).

## Capturas

No se adjuntan capturas. La evidencia de esta HU son los tests, los 25 pedidos HTTP del Nivel 2 y las consultas y verificaciones de pantallas del Nivel 3.

## Recorrido en el navegador

Realizado por el responsable, como Gerente y como Mesa de entrada, sin observaciones. Se recorrió:

- El listado de gerentes.
- «Nuevo gerente»: el alta con la confirmación.
- Los duplicados de DNI y de email, avisados al salir del campo.
- La ficha con el banner del alta.
- «Editar»: el cambio del email de otro gerente y el del email propio, con los dos avisos distintos en la confirmación.
- «Cancelar» con confirmación.
- El conflicto de versión con «Recargar», editando la misma ficha en dos pestañas.
- Como Mesa de entrada: el menú no muestra «Gerentes».

### Pendiente

- Validar con el PO los textos propuestos: el aviso del email propio (`ui.gerentes.edicion.avisoEmailPropio`), `errores.gerente.datosInvalidos` y `ui.gerentes.error.cargar`.

## Observaciones conocidas

- `npm run test:pg` completo tiene tres fallos ajenos a esta HU: `cancelaciones.service.pg.test.ts` (HU-H-10, el `beforeAll` supera los 120 s; fallo conocido) y `seed-asistencia.pg.test.ts` y `materia.tarifa.pg.test.ts`, que corren el seed completo como subproceso con un límite de 120 s y lo superan en esta máquina (`spawnSync … ETIMEDOUT`). Fallan también corridos solos y también sin la fixture de esta HU (se sacó la entrada de `HU-G-01` de `fixtures/index.ts`, se corrió `seed-asistencia.pg.test.ts` y se volvió a poner): no los provoca la fixture `hu-g-01.ts`. El seed completo sobre una base vacía tardó 122,8 s en esta máquina (7,4 s en la repetición y 10,1 s sobre la base de desarrollo ya sembrada). El límite de 120 s del subproceso está fijo en cada test (`seed-asistencia.pg.test.ts:13` y `materia.tarifa.pg.test.ts:78`) y `--testTimeout` no lo modifica. La fixture de HU-G-01 suma cerca de 1 s, y sin ella el seed también supera el límite. Conclusión: es un problema de entorno, no de esta HU; hay que subir ese límite en los dos tests en otra HU.
- Un campo ajeno rechazado por `.strict()` responde 400 con `detalles` vacío: `flattenError` pone ese error en la raíz, no en un campo (mismo comportamiento que HU-F-01).
- `seed.ts` vuelve a calcular el hash de las cuentas del seed base en cada corrida (misma contraseña, otra sal): por eso el hash de 24100001 y 24100002 cambia entre dos vueltas del seed. No es de esta HU.
- El servicio duplica el diseño de `personal.service.ts` sobre `FichaGerente` (decisión 2 de la task): la duplicación queda como deuda, igual que la ya registrada en A-06 y F-01.
- `ConfirmarDescarteDialog` conserva sus textos propios, escritos en el componente compartido y no en `textos.ts` (deuda anterior).
