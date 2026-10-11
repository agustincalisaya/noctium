# HU-A-06 — Evidencia de implementación y validación

Task: [HU-A-06](../tasks/Sprint%203/Modulo%20A/HU-A-06.md). Contrato: [Módulo A](../specs/spec_modulo_A.md) §2.6, §2.9, §3.6 a §3.13 y §4; [Módulo B](../specs/spec_modulo_B.md) §2.9; [Módulo D](../specs/spec_modulo_D.md) §2.9.

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*` en el servidor local, creada y borrada por el script).
- **Fixtures:** `prisma/seed/fixtures/hu-a-06.ts`, ejecutado dos veces sobre una base descartable propia (migraciones + seed base), consultada y borrada al terminar. La base de desarrollo no se tocó.
- **Nivel 2 (pedidos HTTP):** ejecutado con curl (no con Postman) contra `next dev` local y la base de desarrollo, por Claude Code a pedido del responsable. La sesión se obtuvo con el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`). No se incluyen cookies ni contraseñas.
- **Nivel 3 (SQL):** ejecutado con SQL directo (solo `SELECT`) contra la base de desarrollo, por Claude Code a pedido del responsable, con las consultas tal como figuran abajo.
- **Recorrido de pantallas:** lo hizo el responsable a mano. No se adjuntan capturas.

## Criterios de aceptación (backlog, HU-A-06)

1. El email pasa a ser obligatorio al registrar un gerente (HU-G-01), un integrante de mesa de entrada (HU-F-01), un profesor (HU-D-01) y un alumno registrado por mesa de entrada (HU-B-01): “Ingresá el email: con él se crea la cuenta de acceso”. El teléfono pasa a ser opcional. El email no puede estar en uso por otra cuenta; la verificación se repite en el servidor y el aviso no revela a quién pertenece.
2. Al registrar la ficha, en la misma transacción, se crea la cuenta de acceso: el usuario es el email registrado, la contraseña inicial es el DNI (solo números, sin puntos) y el rol es el del tipo de ficha (Gerente, Mesa de entrada, Profesor o Alumno), sin poder elegir otro. La contraseña se guarda solo como hash, como cualquier otra: nadie la ve. Si no se puede crear la cuenta, tampoco se registra la ficha.
3. Cambio obligatorio en el primer ingreso: la cuenta queda marcada “Debe cambiar la contraseña”. Al ingresar con el DNI, antes de cualquier otra pantalla, se pide definir una contraseña nueva (política de HU-B-08, confirmada dos veces y distinta del DNI): “Por seguridad, definí una contraseña nueva para seguir.”. El servidor rechaza cualquier otra solicitud de esa sesión hasta que la cambie. Al cambiarla se quita la marca y se cierran las demás sesiones de la cuenta (RNF-SEG-04). El ingreso con el DNI no aplica la longitud mínima de la política, porque un DNI puede tener 7 dígitos; la política se aplica a la contraseña nueva.
4. Después puede cambiar su contraseña cuando quiera desde “Mi cuenta” (contraseña actual, nueva y confirmación, con la misma política). Si la olvida, usa HU-A-05.
5. Al registrar se informa “<Tipo de ficha> registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.”, donde <Tipo de ficha> es el sustantivo del mensaje de alta de cada historia (Alumno, Profesor, Integrante o Gerente). La ficha muestra la sección “Cuenta de acceso” con el email, el rol y el estado (“Activa · debe cambiar la contraseña” o “Activa”).
6. Modificar el email en la ficha (HU-B-06, HU-D-06, HU-F-01, HU-G-01) cambia también el email de la cuenta, con la misma validación de unicidad.
7. Desactivar la ficha desactiva la cuenta y reactivarla la reactiva (HU-D-08, HU-B-07, HU-F-05, HU-G-05); la marca de cambio de contraseña se conserva.
8. Rige para las personas que se registren desde la entrega del sistema; las cuentas de prueba anteriores no se migran (decisión del PO). El autorregistro del alumno (HU-B-08) no cambia: el alumno define su contraseña al registrarse.
9. Cada creación de cuenta y cada cambio de contraseña se registran como evento de seguridad (RNF-SEG-09).

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1 (alumno y profesor) | `alumno-form.test.tsx` («muestra Email obligatorio…», «sin email: no abre la confirmación…», «email de otra cuenta: no se registra nada…»); `nuevo-profesor-form.test.tsx` («muestra Email obligatorio…», «sin email…», «email de otra cuenta (servidor)…»); `alumno.cuenta.pg.test.ts` y `profesor.cuenta.pg.test.ts` («email de otra cuenta: EMAIL_YA_ASOCIADO y no se crea la ficha», «dos altas simultáneas con el mismo email…»); `src/app/api/alumnos/route.test.ts` y `src/app/api/profesores/route.test.ts` (409 sin revelar de quién); Nivel 2: pedidos 1, 3, 5, 6, 8 y 10 | 1 y 2 | Verificado (test automatizado y ejecución) |
| 1 (integrante de mesa de entrada y gerente) | Alta de integrantes y de gerentes | — | Bloqueado: depende de HU-F-01 y HU-G-01 |
| 2 (alumno y profesor) | `alumno.cuenta.pg.test.ts` y `profesor.cuenta.pg.test.ts` («con email: ficha y cuenta juntas, rol…, hash del DNI…», «dos altas simultáneas con el mismo DNI: … sin cuenta huérfana»); `alumno.cuenta.test.ts` y `profesor.cuenta.test.ts` («si la cuenta falla (EMAIL_YA_ASOCIADO), no se crea la ficha», «P2002 del DNI … DNI_DUPLICADO»); `cuenta.service.pg.test.ts`; Nivel 2: pedidos 1, 4, 6 y 9; Nivel 3: consultas 3.1, 3.3 y 3.4 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 2 (integrante de mesa de entrada y gerente) | Alta de integrantes y de gerentes | — | Bloqueado: depende de HU-F-01 y HU-G-01 |
| 3 | `with-permission.test.ts` (marca: solo `sesion:ping` y `cuenta:cambiar_password`; 403 `DEBE_CAMBIAR_PASSWORD`; decide con la base; `exigirPermiso` → `/primer-ingreso`); `token-sesion.test.ts` (la marca llega al token; un `update` del cliente no la cambia); `actions.test.ts` (`iniciarSesion` → `/primer-ingreso`; DNI de 7 dígitos); `sesion.schema.test.ts` (el login acepta un DNI de 7 dígitos; política de la nueva); `cambio-password.service.pg.test.ts` («primer ingreso: con un DNI de 7 dígitos … quita la marca y revoca las demás sesiones», «el DNI como contraseña nueva no pasa la política»); `home/page.test.tsx` y `primer-ingreso/page.test.tsx` (redirecciones con el valor de la base); `rutas-por-rol.test.ts` (`rutaAdmiteMarca`); Nivel 2: pedidos 15 y 16; Nivel 3: consultas 3.1 y 3.2 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 3 (recorrido completo y redirección del proxy) | Recorrido manual con el alumno 88060001 y con el profesor 88060002: login con su DNI como contraseña → `/primer-ingreso`; el acceso directo a `/home` vuelve a `/primer-ingreso`; errores de validación (contraseña débil y confirmación distinta); cambio de contraseña con la confirmación → `/home` con el banner «Tu contraseña se actualizó. Ya podés usar el sistema.» | 3 | Verificado (recorrido manual del responsable) |
| 4 | `cambio-password.service.test.ts` y `cambio-password.service.pg.test.ts` (««Mi cuenta»: actual incorrecta → 422 y fila en IntentoLoginFallido…», «… límite de intentos … 429 antes de comparar», «nueva igual a la vigente → 422»); `cambiar-password-form.test.tsx` («pide la contraseña actual…», «confirma avisando el cierre de las otras sesiones…»); `primer-ingreso/page.test.tsx` (`/mi-cuenta`); `actions.test.ts` (mapeo de errores); Nivel 3: consultas 3.1 y 3.2 (cambio desde «Mi cuenta» de 88060003) | 1 y 3 | Verificado (test automatizado y ejecución) |
| 4 (recorrido de «Mi cuenta») | Recorrido manual: el enlace «Mi cuenta» de la barra superior lleva a `/mi-cuenta`; con la contraseña actual incorrecta no cambia nada y muestra el error; con la actual correcta el cambio funciona y se vuelve a ingresar con la contraseña nueva | 3 | Verificado (recorrido manual del responsable) |
| 4 («Si la olvida, usa HU-A-05») | Enlace «¿Olvidaste tu contraseña?» y recuperación | — | Bloqueado: depende de HU-A-05 |
| 5 (alumno y profesor) | `nuevo-profesor-form.test.tsx` (toast con el mensaje de la cuenta); `alumno-form.test.tsx` (navega a `/alumnos?creada=1&cuenta=1`); `cuenta-acceso-card.test.tsx` (los cuatro estados, email y rol) | 1 | Verificado (test automatizado) |
| 5 (confirmaciones de alta, banner del listado de alumnos, toast del alta de profesor y tarjeta en las fichas) | Recorrido manual: las confirmaciones «¿Estás seguro de que querés registrar este alumno?» y «…este profesor?» con el detalle de la cuenta de acceso; al registrar, el banner de éxito en el listado de alumnos y el toast del alta de profesor, ambos con el mensaje de la cuenta creada; la tarjeta «Cuenta de acceso» con «Activa · debe cambiar la contraseña» en el profesor 88060002 y en el alumno y el profesor registrados a mano, «Inactiva» en 88060004 y «Sin cuenta» en 88060005 | 3 | Verificado (recorrido manual del responsable) |
| 5 (integrante de mesa de entrada y gerente) | Mensaje de alta y tarjeta en esas fichas | — | Bloqueado: depende de HU-F-01 y HU-G-01 |
| 6 (alumno y profesor) | `alumno.cuenta.test.ts` y `profesor.cuenta.test.ts` (email nuevo → `cambiarEmailCuenta` en la misma transacción; mismo email sin revalidar; ficha con cuenta sin email → 400; ficha sin cuenta no crea cuenta); `alumno.cuenta.pg.test.ts` y `profesor.cuenta.pg.test.ts` («el email nuevo cambia también la cuenta, sin revocar sesiones…», «email de otra cuenta en la edición…», «ficha inactiva con cuenta…»); `contacto-alumno-form.test.tsx` y `contacto-profesor-form.test.tsx` (aviso y confirmación); `profesor.modificar.test.ts` («ficha con cuenta: cambiar el email cambia también el de la cuenta, y nada más»); Nivel 2: pedidos 11 a 14; Nivel 3: consultas 3.3 y 3.4 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 6 (aviso y confirmación al cambiar el email) | Recorrido manual: aviso y confirmación al cambiar el email de una ficha con cuenta | 3 | Verificado (recorrido manual del responsable) |
| 6 (integrante de mesa de entrada y gerente) | Edición del email de esas fichas | — | Bloqueado: depende de HU-F-01 y HU-G-01 |
| 7 | Desactivar y reactivar la ficha desde la pantalla. Los servicios de A ya existen y `cuenta.service.pg.test.ts` prueba que desactivar revoca y reactivar conserva la marca | 1 (servicio) | Bloqueado: depende de HU-D-08, HU-B-07, HU-F-05 y HU-G-05 |
| 8 | `alumno.cuenta.pg.test.ts` y `profesor.cuenta.pg.test.ts` («ficha anterior sin cuenta: cargarle un email no crea la cuenta»); `autorregistro.service.test.ts` (HU-B-08, sin cambios, en verde) | 1 | Verificado (test automatizado) |
| 9 | `alumno.cuenta.pg.test.ts`, `profesor.cuenta.pg.test.ts` y `cuenta.service.pg.test.ts` (CUENTA_CREADA con usuarioId, email e IP, sin DNI); `cambio-password.service.pg.test.ts` (PASSWORD_CAMBIADA con usuarioId, email e IP, sin contraseñas ni hash); Nivel 3: consultas 3.2 y 3.5 | 1 y 3 | Verificado (test automatizado y ejecución) |
| 9 (LOGIN_EXITOSO de la reemisión) | Nivel 3: consulta 3.2 (PASSWORD_CAMBIADA seguido de LOGIN_EXITOSO para 88060001 y 88060002) | 3 | Verificado (ejecución) |

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npx vitest run`) | 2617 pasan, 281 omitidos por guarda, 0 fallan (213 archivos pasan, 43 omitidos) |
| Archivos nuevos de HU-A-06 (18) | 192 pruebas, todas pasan |
| `with-permission.test.ts` | 34 |
| `rutas-por-rol.test.ts` (16 de HU-A-06 más 1 de HU-E-02) | 17 |
| `token-sesion.test.ts` | 9 |
| `sesion.schema.test.ts` | 12 |
| `cambio-password.service.test.ts` | 15 |
| `src/server/sesion/actions.test.ts` | 17 |
| `home/page.test.tsx` y `primer-ingreso/page.test.tsx` | 5 y 5 |
| `cambiar-password-form.test.tsx` | 9 |
| `alumno.cuenta.test.ts` y `profesor.cuenta.test.ts` | 16 y 13 |
| Rutas: `api/alumnos/route.test.ts`, `api/alumnos/[id]/contacto/route.test.ts`, `api/profesores/route.test.ts`, `api/profesores/[id]/route.test.ts` | 7, 5, 6 y 7 |
| `cuenta-acceso-card.test.tsx`, `contacto-alumno-form.test.tsx`, `contacto-profesor-form.test.tsx` | 5, 5 y 5 |
| PostgreSQL real de HU-A-06: `cambio-password.service.pg.test.ts`, `alumno.cuenta.pg.test.ts`, `profesor.cuenta.pg.test.ts` | 6, 10 y 10, todas pasan |
| `npm run test:pg` completo | 237 pasan, 43 omitidas, 1 falla; 3 archivos fallan (ver «Observaciones conocidas») |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| Fixture `hu-a-06.ts`, dos veces sobre una base descartable | Cuatro cuentas y una ficha sin cuenta; la segunda vuelta no duplica nada (4 CUENTA_CREADA y 1 PASSWORD_CAMBIADA en total); ningún hash es el DNI en claro; ningún evento contiene un DNI |

### Cuentas de fixture

| Caso | DNI | Email | Rol | Estado de la cuenta | Contraseña para ingresar |
|---|---|---|---|---|---|
| Primer ingreso | 88060001 | a06.alumno.primer.ingreso@noctium.local | Alumno | Activa · debe cambiar la contraseña | Su DNI |
| Primer ingreso | 88060002 | a06.profesor.primer.ingreso@noctium.local | Profesor | Activa · debe cambiar la contraseña | Su DNI |
| «Mi cuenta» | 88060003 | a06.alumno.mi.cuenta@noctium.local | Alumno | Activa (ya cambió la contraseña inicial) | La de las cuentas del seed (`prisma/seed.ts`) |
| Tarjeta «Inactiva» | 88060004 | a06.alumno.inactivo@noctium.local | Alumno | Inactiva (ficha y cuenta) | — (no puede ingresar) |
| Tarjeta «Sin cuenta» | 88060005 | — | Alumno | Sin cuenta | — |

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: Mesa de entrada (`mesa.entrada@noctium.local`, contraseña de las cuentas del seed) para las altas y las ediciones; la cuenta creada en el pedido 1 (88060011, contraseña: su DNI, todavía con la marca) para la sesión marcada, porque 88060001 ya había cambiado su contraseña en el recorrido manual. Los DNI 8806001x y 8806002x no los usa el fixture.

| # | Pedido | Cuerpo de ejemplo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | `POST /api/alumnos` | `{"nombre":"Ana","apellido":"Postman","dni":"88060011","fecha_nacimiento":"2004-03-15","email":"a06.postman.alumno@noctium.local","telefono":"0387154123456"}` | 201, `data.cuenta = { creada: true, debe_cambiar_password: true }` | OK. 201, `cuenta = { creada: true, debe_cambiar_password: true }` |
| 2 | `POST /api/alumnos` | `{"nombre":"Ana","apellido":"Postman","dni":"88060012","fecha_nacimiento":"2004-03-15"}` | 201, `data.cuenta = { creada: false }` | OK. 201, `cuenta = { creada: false }` |
| 3 | `POST /api/alumnos` | Como el 1, con `"dni":"88060013"` y `"email":"a06.alumno.primer.ingreso@noctium.local"` | 409 `EMAIL_YA_ASOCIADO`, «Ese email ya está asociado a otra cuenta» | OK. 409 `EMAIL_YA_ASOCIADO`, «Ese email ya está asociado a otra cuenta» |
| 4 | `POST /api/alumnos` | Como el 1, con `"dni":"88060001"` y `"email":"a06.postman.alumno2@noctium.local"` | 409 `DNI_DUPLICADO` | OK. 409 `DNI_DUPLICADO`, «Ya existe un alumno registrado con ese DNI» |
| 5 | `POST /api/alumnos` | Como el 1, con `"dni":"88060014"` y `"email":"no-es-email"` | 400 `VALIDACION`, error en `email` | OK. 400 `VALIDACION`, `fieldErrors.email`: «Ingresá un email válido» |
| 6 | `POST /api/profesores` | `{"nombre":"Bruno","apellido":"Postman","dni":"88060021","fechaNacimiento":"1985-07-20","email":"a06.postman.profesor@noctium.local"}` | 201, `data.cuenta = { creada: true, debe_cambiar_password: true }` | OK. 201, `cuenta = { creada: true, debe_cambiar_password: true }` |
| 7 | `POST /api/profesores` | `{"nombre":"Bruno","apellido":"Postman","dni":"88060022","fechaNacimiento":"1985-07-20"}` | 201, `data.cuenta = { creada: false }` | OK. 201, `cuenta = { creada: false }`, `email: null` |
| 8 | `POST /api/profesores` | Como el 6, con `"dni":"88060023"` y `"email":"a06.profesor.primer.ingreso@noctium.local"` | 409 `EMAIL_YA_ASOCIADO` | OK. 409 `EMAIL_YA_ASOCIADO`, «Ese email ya está asociado a otra cuenta» |
| 9 | `POST /api/profesores` | Como el 6, con `"dni":"88060002"` y `"email":"a06.postman.profesor2@noctium.local"` | 409 `DNI_DUPLICADO` | OK. 409 `DNI_DUPLICADO`, «Ya existe un profesor registrado con ese DNI» |
| 10 | `POST /api/profesores` | Como el 6, con `"dni":"88060024"` y `"email":"no-es-email"` | 400 `VALIDACION`, error en `email` | OK. 400 `VALIDACION`, `campos.email`: «Ingresá un email válido» |
| 11 | `PATCH /api/alumnos/{id del alumno del pedido 1}/contacto` | `{"email":"a06.postman.alumno.nuevo@noctium.local","telefono":"0387154123456"}` | 200; la cuenta pasa a ese email (consulta 3.3) | OK. 200, `email: a06.postman.alumno.nuevo@noctium.local`; la cuenta quedó con ese email (consulta 3.3) |
| 12 | `PATCH /api/alumnos/{id del alumno del pedido 1}/contacto` | `{"email":"a06.profesor.primer.ingreso@noctium.local"}` | 409 `EMAIL_YA_ASOCIADO` | OK. 409 `EMAIL_YA_ASOCIADO` |
| 13 | `PATCH /api/profesores/{id del profesor del pedido 6}` | `{"email":"a06.postman.profesor.nuevo@noctium.local","version":<version actual>}` | 200, `campos_modificados: ["email"]` | OK. 200, `campos_modificados: ["email"]`, `version: 1` (se envió `version: 0`, leída con `GET /api/profesores/{id}`); el `GET` posterior muestra `cuenta.email` con el email nuevo |
| 14 | `PATCH /api/profesores/{id del profesor del pedido 6}` | `{"email":"a06.alumno.primer.ingreso@noctium.local","version":<version actual>}` | 409 `EMAIL_YA_ASOCIADO` | OK. 409 `EMAIL_YA_ASOCIADO` (se envió `version: 1`, leída con `GET`) |
| 15 | Con la sesión de 88060001 (marcada): `GET /api/turnos/propios` | — | 403 `DEBE_CAMBIAR_PASSWORD`, «Tenés que cambiar tu contraseña para seguir» | OK. 403 `DEBE_CAMBIAR_PASSWORD`, «Tenés que cambiar tu contraseña para seguir». Se usó la sesión de la cuenta del pedido 1 (88060011, con la marca), porque 88060001 ya había hecho el primer ingreso; antes del pedido 11 |
| 16 | Con la sesión de 88060001 (marcada): `POST /api/auth/ping` | — | 200 | OK. 200, `{ renovado: true }`, con la misma sesión que el pedido 15 |

## Nivel 3 — SQL (ejecutado contra la base de desarrollo)

| # | Consulta | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT "emailUsuario", "rolUsuario", "activoUsuario", "debeCambiarPasswordUsuario", "sesionesValidasDesdeUsuario", "passwordHashUsuario" LIKE '$2%' AS es_hash, "passwordHashUsuario" LIKE '%8806000%' AS dni_en_claro FROM usuarios WHERE "emailUsuario" LIKE 'a06.%' ORDER BY "emailUsuario";` | Marca en 88060001 y 88060002 (`true`) hasta el primer ingreso; 88060003 sin marca y con `sesionesValidasDesdeUsuario`; 88060004 inactiva; `es_hash` siempre `true`, `dni_en_claro` siempre `false` | OK. `es_hash` siempre `true` y `dni_en_claro` siempre `false`. 88060001 y 88060002 con la marca en `false` y `sesionesValidasDesdeUsuario` fijado: ya hicieron el primer ingreso en la prueba manual. 88060003 sin la marca y con `sesionesValidasDesdeUsuario`; 88060004 inactiva y con la marca conservada. Las cuentas de los pedidos 1 y 6 (y una de la prueba manual) con la marca en `true` y sin revocación |
| 3.2 | `SELECT e."tipoEvento", e."usuarioId", e."emailEvento", e."ipEvento", e."creadoEnEvento" FROM eventos_seguridad e WHERE e."emailEvento" LIKE 'a06.%' AND e."tipoEvento" IN ('CUENTA_CREADA', 'PASSWORD_CAMBIADA', 'LOGIN_EXITOSO') ORDER BY e."creadoEnEvento";` | Un CUENTA_CREADA por cuenta creada; tras el primer ingreso, PASSWORD_CAMBIADA seguido de LOGIN_EXITOSO (la reemisión) para la misma cuenta; todos con `usuarioId`, email e IP | OK. 20 filas, todas con `usuarioId`, email e IP. Un CUENTA_CREADA por cuenta creada (fixture, prueba manual y pedidos 1 y 6). 88060001 y 88060002: PASSWORD_CAMBIADA seguido de LOGIN_EXITOSO (la reemisión). 88060003: además PASSWORD_CAMBIADA seguido de LOGIN_EXITOSO desde «Mi cuenta» |
| 3.3 | `SELECT a."dniAlumno", a."activoAlumno", a."emailAlumno", u."emailUsuario", a."emailAlumno" = u."emailUsuario" AS email_igual FROM alumnos a LEFT JOIN usuarios u ON u."idUsuario" = a."usuarioId" WHERE a."dniAlumno" LIKE '8806%' ORDER BY a."dniAlumno";` | Con cuenta: `email_igual = true` (también después del pedido 11); 88060005 y 88060012 sin cuenta (`emailUsuario` nulo) | OK. 88060001, 88060003, 88060004 y 88060011 con `email_igual = true` (88060011 con el email del pedido 11); 88060005 y 88060012 sin cuenta |
| 3.4 | `SELECT p."dniProfesor", p."emailProfesor", u."emailUsuario", u."rolUsuario", p."emailProfesor" = u."emailUsuario" AS email_igual FROM profesores p LEFT JOIN usuarios u ON u."idUsuario" = p."usuarioId" WHERE p."dniProfesor" LIKE '8806%' ORDER BY p."dniProfesor";` | Con cuenta: rol `PROFESOR` y `email_igual = true` (también después del pedido 13); 88060022 sin cuenta | OK. 88060002 y 88060021 con rol `PROFESOR` y `email_igual = true` (88060021 con el email del pedido 13); 88060022 sin cuenta |
| 3.5 | `SELECT COUNT(*) FROM eventos_seguridad WHERE "emailEvento" LIKE 'a06.%' AND ("emailEvento" ~ '8806[0-9]{4}' OR "ipEvento" ~ '8806[0-9]{4}');` | 0: ningún evento contiene un DNI | OK. `count = 0` |

## Capturas

No se adjuntan capturas. El recorrido de pantallas que hizo el responsable queda registrado en la tabla de criterios como «Verificado (recorrido manual del responsable)»; la evidencia de esta HU son ese recorrido, los 16 pedidos HTTP del Nivel 2 y las 5 consultas SQL del Nivel 3.

## Observaciones conocidas

- `npm run test:pg` tiene fallas preexistentes en archivos de otras HU (HU-E-10, HU-H-10 y HU-H-03), que fallan igual sin los cambios de esta HU.
- «Igual al DNI» se prueba por la política de contraseña (400) y no por el 422 `PASSWORD_IGUAL_A_ACTUAL`: un DNI no tiene mayúscula ni minúscula.
- El formulario de cambio de contraseña no usa `useActionState`: `ConfirmarAccionDialog` necesita esperar el resultado de la acción.
- `/home` usa `auth()` sin chequear la revocación de la sesión, igual que antes de la HU; solo suma la lectura de la marca.
- Quedó código sin efecto: el mapeo de `EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE` en `PATCH /api/alumnos/[id]` y en el formulario de edición de alumno.
- Hay duplicación entre alumnos y profesores: `sincronizarEmail`, `CuentaCreadaEnAlta`, `obtenerCuentaDeAlumno`/`obtenerCuentaDeProfesor`, `ipDeLaSolicitud`, la simulación de `ConfirmarAccionDialog` en los tests y el patrón del aviso de cambio de email.
