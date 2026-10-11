# HU-F-01 — Evidencia de implementación y validación

Task: [HU-F-01](../tasks/Sprint%203/Modulo%20F/HU-F-01.md). Contrato: [Módulo F](../specs/spec_modulo_F.md) §1, §2.1 a §2.4, §3 y §4; [Módulo A](../specs/spec_modulo_A.md) §2.9 (servicios de cuentas). Verifica además HU-A-06, criterios 1, 2, 5 y 6, para el rol Mesa de entrada.

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*` en el servidor local, creada y borrada por el script).
- **Fixtures:** `prisma/seed/fixtures/hu-f-01.ts`, ejecutado con `npx prisma db seed` dos veces sobre la base de desarrollo (el seed completo, con todas las fixtures, termina sin errores las dos veces).
- **Nivel 2 (pedidos HTTP):** ejecutado con curl (no con Postman) contra `next dev` local y la base de desarrollo, por Claude Code a pedido del responsable. La sesión se obtuvo con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`). No se incluyen cookies ni contraseñas.
- **Nivel 3 (SQL):** ejecutado con SQL directo (solo `SELECT`) contra la base de desarrollo, por Claude Code, con las consultas tal como figuran abajo.
- **Pantallas:** Claude Code verificó por HTTP, con la sesión del Gerente, que cada pantalla responde y muestra sus elementos, y las redirecciones del proxy (Nivel 3, recorrido 3.6). El recorrido interactivo en el navegador (escribir, salir de los campos, confirmar, cancelar y recargar ante un conflicto) queda **pendiente del responsable**. No se adjuntan capturas.

## Criterios de aceptación (backlog, HU-F-01)

1. Desde “Personal de mesa de entrada”, la opción “Nuevo integrante” abre un formulario con dos secciones: Identidad (Nombre, Apellido, DNI y Fecha de nacimiento, obligatorios; Género, opcional, de la lista configurada) y Contacto (Email, obligatorio porque con él se crea la cuenta de acceso, HU-A-06: “Ingresá el email: con él se crea la cuenta de acceso”; Teléfono, opcional).
2. Se aplican las mismas validaciones y normalizaciones de HU-D-01 y HU-D-02: Nombre y Apellido de 2 a 50 caracteres (letras, espacios, acentos, apóstrofes y guiones), DNI solo numérico con la longitud configurada, fecha de nacimiento no futura ni inexistente; teléfono de 8 a 15 dígitos; email en minúsculas, formato válido, hasta 254 caracteres. Los errores se muestran junto al campo y no se guardan cambios parciales.
3. El DNI no puede pertenecer a otro integrante de mesa de entrada, activo o inactivo. Se verifica al salir del campo y se repite en el servidor al confirmar: “Ya existe un integrante de mesa de entrada con ese DNI”. El email no puede estar en uso como email de acceso de otra cuenta; la verificación se repite en el servidor y el aviso no revela a quién pertenece.
4. Con datos válidos se crea la ficha Activa, en una única transacción que registra fecha de alta y usuario, y se informa “Integrante registrado correctamente”, completado con la cuenta creada según HU-A-06, criterio 5.
5. Modificar: desde la ficha, “Editar” abre el mismo formulario precargado, con las mismas validaciones (la unicidad del DNI y del email excluye la propia ficha). Al guardar se actualizan solo los campos modificados y la fecha de última modificación, y se informa “Integrante actualizado correctamente”; si no hubo cambios, Guardar permanece deshabilitado. Modificar el email cambia también el email de la cuenta de acceso (HU-A-06, criterio 6).
6. Registrar la ficha crea, en la misma transacción, la cuenta de acceso del integrante con su email y su DNI como contraseña inicial, que debe cambiar en el primer ingreso (HU-A-06).
7. Cancelar vuelve al listado o a la ficha sin guardar, con confirmación si hay datos ingresados o cambios. Esta historia no permite desactivar (HU-F-05). Solo el Gerente puede registrar y modificar estos datos; el servidor rechaza con 403 a otros roles.

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1 | `integrante-form.test.tsx` («título, bajada, «Cancelar» y «Registrar» arriba, Identidad y Contacto con la nota del email»; «email vacío: el error del backlog…»); `paginas.test.tsx` (listado con «Nuevo integrante»; alta con título y bajada del prototipo); `Sidebar.personal.test.tsx` (el ítem solo para el Gerente); `personal.schema.test.ts` (email faltante con el mensaje del backlog; teléfono opcional); Nivel 2: pedido 4; recorrido 3.6 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido interactivo: pendiente del responsable |
| 2 | `identidad-persona.schema.test.ts` (nombre y apellido, DNI con la longitud configurada, fecha futura e inexistente, género); `personal.schema.test.ts` (teléfono de 8 a 15 dígitos, email en minúsculas y hasta 254 caracteres, `.strict()`); `integrante-form.test.tsx` («errores de identidad junto a cada campo, sin envío parcial»); rutas y acciones (400 `VALIDATION_ERROR` sin llamar al servicio); Nivel 2: pedidos 1 (teléfono normalizado), 4 y 5 | 1 y 2 | Verificado (test automatizado y ejecución) |
| 3 | `personal.service.test.ts` y `personal.service.pg.test.ts` (DNI en uso, activo o inactivo; email de otra cuenta sin revelar de quién; «la unicidad excluye la propia ficha…»; «el DNI de una ficha inactiva sigue reservado»); `integrante-form.test.tsx` («al salir del DNI y del email verifica la disponibilidad…», «con el DNI marcado como no disponible no abre la confirmación»); `actions.test.ts` (`verificarDisponibilidadIntegrante`: solo la disponibilidad, permiso por modo); Nivel 2: pedidos 2, 3 y 13 | 1 y 2 | Verificado (test automatizado y ejecución). Recorrido interactivo: pendiente del responsable |
| 4 | `personal.service.pg.test.ts` («alta: ficha activa y cuenta MESA_ENTRADA juntas, … y la auditoría»); `integrante-form.test.tsx` (confirmación y navegación a `/personal/[id]?creado=1`); `paginas.test.tsx` («banner tras el alta (con la cuenta creada)…»); Nivel 2: pedido 1; Nivel 3: consultas 3.1 y 3.2; recorrido 3.6 (banner) | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 5 | `personal.service.test.ts` y `personal.service.pg.test.ts` (solo lo que cambia, `version + 1`, `modificadoPor`; sin cambios no escribe; conflicto de versión; cambio de email sincronizado sin revocar sesiones; ficha inactiva modificable); `integrante-form.test.tsx` (precarga, «Guardar» deshabilitado sin cambios, confirmación, aviso de email, «Recargar»); `paginas.test.tsx` («Editar» solo con `personal:editar`, banner tras editar, última modificación); Nivel 2: pedidos 9 a 14; Nivel 3: consultas 3.2 y 3.3 | 1, 2 y 3 | Verificado (test automatizado y ejecución). Recorrido interactivo: pendiente del responsable |
| 6 | `personal.service.pg.test.ts` (cuenta con rol `MESA_ENTRADA`, la marca y el hash del DNI; «alta atómica: si la cuenta falla …» y «… si la ficha falla …, no queda su cuenta»); Nivel 2: pedidos 1 y 17 a 21 (primer ingreso); Nivel 3: consultas 3.2 y 3.4 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 7 (Cancelar) | `integrante-form.test.tsx` (««Cancelar» sin datos vuelve al listado; con datos pide confirmar el descarte», «… sin cambios vuelve a la ficha; con cambios pide confirmar el descarte») | 1 | Verificado (test automatizado). Recorrido interactivo: pendiente del responsable |
| 7 (no permite desactivar) | `paginas.test.tsx` («no ofrece desactivar ni reactivar», ficha activa e inactiva); no hay rutas de baja en `/api/personal`; recorrido 3.6 (la ficha no muestra «Desactivar» ni «Reactivar») | 1 y 3 | Verificado. El límite («Desactivar» y «Reactivar») queda **Bloqueado** hasta HU-F-05 |
| 7 (solo el Gerente, 403) | Rutas (`route.test.ts` y `[id]/route.test.ts`) y acciones (`actions.test.ts`): 401 sin sesión, 403 para MESA_ENTRADA, PROFESOR y ALUMNO; `rutas-por-rol.test.ts`; `paginas.test.tsx` (sin permiso no consulta); Nivel 2: pedidos 6 a 8 y 16; recorrido 3.6 (Mesa de entrada → `/sin-permiso`, sin sesión → `/login`) | 1, 2 y 3 | Verificado (test automatizado y ejecución) |

### HU-A-06 para el rol Mesa de entrada

| Criterio de A-06 | Qué lo cubre | Estado |
|---|---|---|
| 1. Email obligatorio y único, sin revelar de quién es | Criterios 1 y 3 de arriba; Nivel 2: pedidos 3, 4 y 13 | Verificado |
| 2. Cuenta creada en la misma transacción, rol fijado por el tipo de ficha, contraseña solo como hash | Criterio 6 de arriba; `.strict()` rechaza `rol` (pedido 5); Nivel 3: consultas 3.2 y 3.5 | Verificado |
| 5. Mensaje de alta y sección «Cuenta de acceso» | `paginas.test.tsx` (banner y `CuentaAccesoCard` con «Activa · debe cambiar la contraseña»); recorrido 3.6 | Verificado |
| 6. Cambio de email sincronizado con la cuenta | `personal.service.pg.test.ts`; Nivel 2: pedidos 10, 11 y 17; Nivel 3: consulta 3.3 | Verificado |

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npm test`) | 2882 pasan, 307 omitidos por guarda, 0 fallan (230 archivos pasan, 46 omitidos) |
| Archivos de HU-F-01 (10, más `rutas-por-rol.test.ts`) | 175 pruebas, todas pasan |
| `identidad-persona.schema.test.ts` y `personal.schema.test.ts` | 5 y 20 |
| `personal.service.test.ts` (con mocks) | 26 |
| `actions.test.ts` | 26 |
| `api/personal/route.test.ts` y `api/personal/[id]/route.test.ts` | 15 y 16 |
| `integrante-form.test.tsx` y `paginas.test.tsx` | 19 y 13 |
| `Sidebar.personal.test.tsx` | 4 |
| `rutas-por-rol.test.ts` (con los casos de HU-F-01) | 31 |
| PostgreSQL real: `personal.service.pg.test.ts` | 13, todas pasan |
| `npm run test:pg` completo | 271 pasan, 34 omitidas, 2 fallan (HU-E-10 y HU-H-03, ver «Observaciones conocidas»); las pasadas con nombre fijo, 18 y 16, pasan |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| `next build` | Compila; genera `/personal`, `/personal/nuevo`, `/personal/[id]`, `/personal/[id]/editar`, `/api/personal` y `/api/personal/[id]` |
| Fixture `hu-f-01.ts`, dos veces con `npx prisma db seed` | La segunda vuelta no duplica ni falla: 4 fichas de mesa de entrada y 2 `CUENTA_CREADA` de la fixture después de cada vuelta |

### Integrantes de prueba

| Caso | DNI | Email | Estado de la cuenta | Contraseña para ingresar |
|---|---|---|---|---|
| Seed base | 25100001 | mesa.entrada@noctium.local | Activa | La de las cuentas del seed (`prisma/seed.ts`) |
| Seed base | 25100002 | mesa.entrada2@noctium.local | Activa | La de las cuentas del seed |
| Fixture: activo, primer ingreso | 88061001 | f01.activo@noctium.local | Activa · debe cambiar la contraseña | Su DNI |
| Fixture: inactivo (DNI y email reservados) | 88061002 | f01.inactivo@noctium.local | Inactiva (ficha y cuenta) | — (no puede ingresar) |

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: Gerente (`gerente@noctium.local`) y Mesa de entrada (`mesa.entrada@noctium.local`), ambas con la contraseña de las cuentas del seed; para el primer ingreso, la cuenta creada en el pedido 1. Los DNI 8806102x no los usa la fixture. `{id}` es el de la ficha del pedido 1.

| # | Pedido | Cuerpo de ejemplo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | Gerente: `POST /api/personal` | `{"nombre":"Carla","apellido":"Prueba Http","dni":"88061021","fechaNacimiento":"1991-03-08","genero":"FEMENINO","email":"f01.http.alta@noctium.local","telefono":"(011) 5550-1021"}` | 201 con la ficha y `cuenta`, sin contraseña | OK. 201, `telefono: "01155501021"`, `activo: true`, `cuenta = { estado: "ACTIVA", email, rol: "MESA_ENTRADA", debe_cambiar_password: true }`; ninguna clave de contraseña ni hash |
| 2 | `POST /api/personal` | Como el 1, con `"dni":"88061002"` (ficha inactiva) | 409 `DNI_DUPLICADO` | OK. 409 `DNI_DUPLICADO`, «Ya existe un integrante de mesa de entrada con ese DNI» |
| 3 | `POST /api/personal` | Como el 1, con `"dni":"88061023"` y el email de la cuenta de un alumno en mayúsculas | 409 `EMAIL_YA_ASOCIADO`, sin decir de quién | OK. 409 `EMAIL_YA_ASOCIADO`, «Ese email ya está asociado a otra cuenta» |
| 4 | `POST /api/personal` | `{"nombre":"C","apellido":"Prueba Http","dni":"123","fechaNacimiento":"2099-01-01"}` | 400 `VALIDATION_ERROR` por campo | OK. 400; `detalles`: nombre (mínimo 2), DNI (entre 7 y 8 dígitos), fecha futura y email con el mensaje del backlog |
| 5 | `POST /api/personal` | Como el 1, con `"rol":"GERENTE"` | 400 (`.strict()`) | OK. 400 `VALIDATION_ERROR`, `detalles` vacío (el error es de la raíz) |
| 6 | Mesa de entrada: `POST /api/personal` | Como el 1, con otro DNI | 403 `SIN_PERMISO` | OK. 403 `SIN_PERMISO` |
| 7 | Mesa de entrada: `GET /api/personal` | — | 403 | OK. 403 `SIN_PERMISO` |
| 8 | Sin sesión: `GET /api/personal` | — | 401 | OK. 401 `SESION_INVALIDA` |
| 9 | Gerente: `GET /api/personal` y `GET /api/personal/{id}` | — | 200 con el listado ordenado y el detalle | OK. 200; el detalle con `version: 0`, `fechaNacimiento: "1991-03-08"`, `modificadoEl: null` y `cuenta` |
| 10 | `PATCH /api/personal/{id}` | `{"nombre":"Carla","telefono":"01155501021","version":0}` | 200 sin cambios | OK. 200, `campos_modificados: []`, `version: 0` |
| 11 | `PATCH /api/personal/{id}` | `{"email":"f01.http.nuevo@noctium.local","telefono":null,"version":0}` | 200; la cuenta pasa al email nuevo | OK. 200, `campos_modificados: ["telefono","email"]`, `version: 1`; el `GET` posterior muestra `cuenta.email` con el email nuevo y `modificadoEl` con fecha |
| 12 | `PATCH /api/personal/{id}` | `{"nombre":"Otra","version":0}` | 409 por la versión vieja | OK. 409 `CONFLICTO_EDICION_CONCURRENTE`, «La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.» |
| 13 | `PATCH /api/personal/{id}` | `{"email":"mesa.entrada2@noctium.local","version":1}` | 409 `EMAIL_YA_ASOCIADO` | OK. 409 `EMAIL_YA_ASOCIADO` |
| 14 | `PATCH /api/personal/{id}` | `{"email":"","version":1}` | 400, el email no se puede vaciar | OK. 400, `detalles.email`: «Ingresá el email: con él se crea la cuenta de acceso» |
| 15 | `GET /api/personal/no-existe` | — | 404 | OK. 404 `INTEGRANTE_NO_ENCONTRADO`, «El integrante no existe» |
| 16 | Mesa de entrada: `PATCH /api/personal/{id}` | `{"nombre":"Otra","version":1}` | 403 | OK. 403 `SIN_PERMISO` |
| 17 | Login con el email anterior del integrante (`f01.http.alta@…`) y su DNI | — | Sin sesión: el email ya no es el de la cuenta | OK. Sin sesión (`LOGIN_FALLIDO`, consulta 3.4) |
| 18 | Login con el email nuevo (`f01.http.nuevo@…`) y su DNI como contraseña | — | Sesión iniciada, con la marca | OK. Sesión obtenida (`LOGIN_EXITOSO`) |
| 19 | Con esa sesión: `GET /home` y `GET /turnos` | — | 307 a `/primer-ingreso` | OK. 307 → `/primer-ingreso` en los dos; `GET /primer-ingreso` responde 200 |
| 20 | Con esa sesión: `GET /api/turnos` | — | 403 `DEBE_CAMBIAR_PASSWORD` | OK. 403 `DEBE_CAMBIAR_PASSWORD`, «Tenés que cambiar tu contraseña para seguir» |
| 21 | Con esa sesión: `POST /api/auth/ping` | — | 200 | OK. 200, `{ renovado: true }` |

## Nivel 3 — SQL y pantallas (ejecutado contra la base de desarrollo)

| # | Consulta | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT f."dniFichaMesaEntrada", f."activoFichaMesaEntrada", f.version, f."nombreNormalizadoFichaMesaEntrada", f."apellidoNormalizadoFichaMesaEntrada", f."creadoPorUsuarioId" = g."idUsuario" AS creado_por_gerente, f."modificadoPorUsuarioId" IS NULL AS sin_modificador FROM fichas_mesa_entrada f CROSS JOIN (SELECT "idUsuario" FROM usuarios WHERE "emailUsuario" = 'gerente@noctium.local') g WHERE f."dniFichaMesaEntrada" LIKE '8806%' ORDER BY f."dniFichaMesaEntrada";` | Alta: activa, `version = 0`, creada por el Gerente, sin modificador y nombres normalizados | OK. 88061001: activa, `version 0`, `creado_por_gerente = true`, `sin_modificador = true`, `julian` / `prueba mesa`. 88061002 (inactivo de la fixture) y 88061021 (modificado en el pedido 11): `version 1` y con modificador |
| 3.2 | `SELECT u."emailUsuario", u."rolUsuario", u."activoUsuario", u."debeCambiarPasswordUsuario", u."sesionesValidasDesdeUsuario", u."passwordHashUsuario" LIKE '$2%' AS es_hash, u."passwordHashUsuario" LIKE '%8806%' AS dni_en_claro FROM usuarios u WHERE u."emailUsuario" LIKE 'f01.%' ORDER BY u."emailUsuario";` | Rol `MESA_ENTRADA`, la marca, contraseña solo como hash; el cambio de email no revoca sesiones | OK. Tres cuentas `MESA_ENTRADA` con la marca; `es_hash = true` y `dni_en_claro = false` en todas. `f01.http.nuevo@…` (email cambiado) con `sesionesValidasDesdeUsuario` nulo. `f01.inactivo@…` inactiva y con las sesiones revocadas por `desactivarCuenta` |
| 3.3 | `SELECT f."dniFichaMesaEntrada", f.version, f."modificadoPorUsuarioId" IS NOT NULL AS con_modificador, f."emailFichaMesaEntrada", u."emailUsuario", f."emailFichaMesaEntrada" = u."emailUsuario" AS email_igual FROM fichas_mesa_entrada f LEFT JOIN usuarios u ON u."idUsuario" = f."usuarioId" ORDER BY f."dniFichaMesaEntrada";` | `email_igual = true` en todas, también tras el pedido 11 | OK. Las 5 fichas con `email_igual = true`; 88061021 con `version 1`, modificador y el email del pedido 11 |
| 3.4 | `SELECT e."tipoEvento", e."emailEvento", e."ipEvento" FROM eventos_seguridad e WHERE e."emailEvento" LIKE 'f01.%' ORDER BY e."creadoEnEvento";` | Un `CUENTA_CREADA` por cuenta creada, con email e IP | OK. `CUENTA_CREADA` para las dos de la fixture y la del pedido 1; `LOGIN_FALLIDO` con el email viejo (pedido 17) y `LOGIN_EXITOSO` con el nuevo (pedido 18) |
| 3.5 | `SELECT COUNT(*) FROM eventos_seguridad WHERE "emailEvento" LIKE 'f01.%' AND ("emailEvento" ~ '8806[0-9]{4}' OR "ipEvento" ~ '8806[0-9]{4}');` | 0: ningún evento contiene un DNI | OK. `count = 0` |
| 3.6 | Pantallas por HTTP con la sesión del Gerente: `/personal`, `/personal/nuevo`, `/personal/{id}`, `/personal/{id}?creado=1`, `/personal/{id}/editar`, `/personal/no-existe`; `/personal` con Mesa de entrada y sin sesión | 200 con sus elementos; 404; redirecciones del proxy | OK. Listado con «Nuevo integrante»; alta con «Sin especificar» y la nota del email; ficha con «Cuenta de acceso», «Activa · debe cambiar la contraseña» y «Editar», sin «Desactivar» ni «Reactivar»; `?creado=1` con «Integrante registrado correctamente…»; edición precargada; 404 para un id inexistente; el menú del Gerente muestra «Personal de mesa de entrada»; Mesa de entrada → 307 a `/sin-permiso`; sin sesión → 307 a `/login` |

### Filas que quedan en la base de desarrollo

- Fichas de mesa de entrada 88061001 (activa, con la marca) y 88061002 (inactiva), de la fixture, con sus cuentas `f01.activo@noctium.local` y `f01.inactivo@noctium.local`.
- Ficha 88061021 «Carla Prueba Http» (pedidos 1 y 11), con la cuenta `f01.http.nuevo@noctium.local`, todavía con la marca: no se completó el primer ingreso.
- Eventos de seguridad de esas cuentas (consulta 3.4).
- Las dos fichas de la fixture se crearon primero con el apellido «Prueba F01» y se corrigieron a «Prueba Mesa» con un `UPDATE` de los campos de apellido (sin cambiar `version`): el apellido no admite dígitos y la fixture ahora usa «Prueba Mesa».

## Capturas

No se adjuntan capturas. La evidencia de esta HU son los tests, los 21 pedidos HTTP del Nivel 2 y las consultas y verificaciones de pantallas del Nivel 3.

## Pendiente del responsable

- Recorrido interactivo en el navegador: alta con la confirmación y el banner en la ficha; verificación al salir del DNI y del email; errores junto al campo; «Cancelar» con y sin datos; edición con «Guardar» deshabilitado sin cambios, la confirmación (con el aviso al cambiar el email) y el banner; «Recargar» ante un conflicto (editar la misma ficha en dos pestañas).
- Completar el primer ingreso de un integrante en `/primer-ingreso` (por ejemplo 88061001, con su DNI) y comprobar que después ve solo lo que corresponde a mesa de entrada. Por HTTP quedó verificado que la cuenta entra con su email y su DNI y que el servidor la manda a `/primer-ingreso`.

## Observaciones conocidas

- `npm run test:pg` tiene fallas preexistentes en archivos de otras HU (HU-E-10 en `resultado-examen.service.pg.test.ts` y HU-H-03 en `clases.service.pg.test.ts`), que no tocan nada de esta HU.
- Un campo ajeno rechazado por `.strict()` responde 400 con `detalles` vacío: `flattenError` pone ese error en la raíz, no en un campo (mismo comportamiento que HU-A-05).
- Los mensajes de formato de fecha, teléfono y email salen de `shared/fecha.ts` y `shared/contacto.schema.ts`, reutilizados sin cambios; no están en `textos.ts`.
- `fechaCalendarioValidaSchema` está duplicado en `shared/fecha.ts` y `shared/fecha.schema.ts` (deuda anterior a esta HU).
- `ConfirmarDescarteDialog` conserva sus textos propios («Cambios sin guardar», «Hay datos sin guardar. ¿Salir de todas formas?»), escritos en el componente compartido y no en `textos.ts`.
