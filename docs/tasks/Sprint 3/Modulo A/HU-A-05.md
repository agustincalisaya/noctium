# TASK: HU-A-05 — Recuperar contraseña olvidada

**Módulo:** A (Sesión) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 5
**Contrato de referencia:** `docs/specs/spec_modulo_A.md` §2.7 (HU-A-05, incluye 2.7.5 esquema y 2.7.6 pantallas), §2.8 («Rutas por rol»: las rutas públicas), §2.9 (`cambiarPassword`), §3.1, §3.3, §3.9 a §3.13 y §4 (eventos de la Revisión 3), T6, T9, T10 y P-A3, P-A4, P-A8, P-A10, P-A11, P-A12 · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-A-05, criterios 1 a 7) · `docs/tasks/Sprint 3/PR-0.md` §2.7, §2.9, §2.11, §2.13 y §2.14 · `docs/tasks/Sprint 3/Modulo A/HU-A-06.md` (sección 9: qué dejó hecho)
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figuras 88 (pedir el enlace), 89 (respuesta) y 90 (enlace de recuperación), **solo las páginas 80 y 81**. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog.
**RBAC:** ninguno. Las dos pantallas y los dos endpoints son **públicos**: no pasan por `withPermission` ni por `exigirPermiso`, y el proxy no los toca (no están en el `matcher`). No se crea ningún permiso ni se modifica `rutas-por-rol.ts` salvo que el relevamiento (punto 12) lo pida.
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. El PR 0 creó `TokenRecuperacion` (`tokens_recuperacion`), `SolicitudRecuperacion` (`solicitudes_recuperacion`) y los eventos `RECUPERACION_SOLICITADA`, `RECUPERACION_LIMITADA`, `RECUPERACION_ENVIO_FALLIDO` y `RECUPERACION_CONFIRMADA`. Los nombres reales de campo son los de `schema.prisma` (sección 4.6), no los de los borradores. Si el relevamiento encuentra algo que falte, se coordina con el responsable del PR 0: esta HU no agrega migraciones.
**Estado de la HU:** implementada y verificada (sección 9).

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:

- **Archivos nuevos a crear** (ruta exacta, uno por uno). Punto de partida propuesto, a corregir contra el repo:
  - `src/server/sesion/recuperacion.service.ts` (`solicitarRecuperacion`, `procesarSolicitudRecuperacion`, `verificarEnlaceRecuperacion`, `restablecerPassword`), `src/server/sesion/recuperacion.constantes.ts` y sus tests (`.test.ts` y `.pg.test.ts`).
  - Los Route Handlers `src/app/api/auth/recuperar-password/route.ts` y `src/app/api/auth/restablecer-password/route.ts`, con sus tests.
  - Las páginas `/recuperar-contrasena` y `/restablecer-contrasena` (propuesta: `src/app/(auth)/…`, junto a `login` y `registro`) y sus componentes de formulario (Regla N.° 11: en `src/app/**` solo `page.tsx`, `layout.tsx` y componentes propios de la ruta; los compartidos, en `src/components/sesion/`).
  - El texto y el HTML del email, con sus claves en `src/lib/textos.ts`.
  - `prisma/seed/fixtures/hu-a-05.ts` y una línea en `prisma/seed/fixtures/index.ts` (sin editar `seed.ts`).
  - `docs/testing/HU-A-05-evidencia.md`.
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno). Se esperan al menos: `src/server/sesion/sesion.schema.ts` (se agregan los schemas), `src/server/sesion/actions.ts` (se agregan las dos Server Actions), `src/app/(auth)/login/login-form.tsx` (enlace «¿Olvidaste tu contraseña?»), `src/app/(dashboard)/mi-cuenta/page.tsx` (el mismo enlace), `src/lib/textos.ts`, `src/server/shared/errores-dominio.ts` (claves nuevas), `next.config.ts` (encabezados, punto 9), `docs/DESIGN.md` (§6.4), `docs/RULES.md` y `docs/specs/spec_modulo_A.md` (nota aditiva, sección 7).
- Todo punto marcado **«relevar antes de asumir»**, con la pregunta concreta (nunca resuelto por inferencia propia del agente). Lo que ya se verificó en el repo al escribir esta task está señalado como «Verificado»: confirmarlo, no volver a investigarlo.
  1. **`after()` de `next/server`.** Verificado: ningún archivo del repo lo usa todavía. Reportar si Next 16.3 lo admite en un Route Handler y en una Server Action, qué pasa con una excepción dentro de la tarea (debe quedar capturada y registrada, sin romper la respuesta ya enviada) y cómo se prueba con vitest (mock de `next/server`). Proponer **dónde** se llama: la spec dice que el servicio lo programa, pero los servicios de este repo no importan módulos de Next (A-06 sacó la reemisión del servicio por el mismo motivo). Propuesta por defecto: `solicitarRecuperacion` devuelve `{ entro: boolean }` y la capa delgada (ruta o acción) hace `after(() => procesarSolicitudRecuperacion(email, ip))` cuando `entro` es `true`.
  2. **Dos entradas por operación.** La spec define un Route Handler y una Server Action equivalente para cada una. Confirmar que ambas son capa delgada sobre el **mismo** servicio (Regla N.° 4), con `{ data, error }` en la ruta (Regla N.° 5) y el shape de `useActionState` o su equivalente en la acción, y que las pantallas usan las Server Actions (como el login y A-06) mientras que los Route Handlers sirven a Postman y al contrato. Reportar cómo se obtiene la IP en cada una: en las rutas, `obtenerIp(request)` de `src/auth.ts`; en las acciones, hoy hay un `ipDeLaSolicitud()` **privado** en `src/server/sesion/actions.ts`. Verificado: se reutiliza el de ese archivo, no se crea un tercero.
  3. **Bloqueo de aviso por email.** Verificado: `src/server/shared/bloquear.ts` no tiene bloqueos de aviso (`pg_advisory_xact_lock`). La spec (§2.7.1 paso 2 y §3.12) pide uno por el hash del email, dentro de la `transaccion` de conteo e inserción. Reportar si se hace con SQL directo (propuesta, es lo que dice la spec) o si conviene extender `bloquear` y qué dice `PR-0.md` §2.10 sobre el orden de bloqueos. Esta HU no combina ese bloqueo con otros.
  4. **`cambiarPassword` real.** Verificado: la firma es `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual, origen?: "CAMBIO" | "RECUPERACION", ip? })`. Con `origen: "RECUPERACION"` registra `RECUPERACION_CONFIRMADA`; guarda el hash, **quita la marca** y llama a `revocarSesiones`. **No invalida los enlaces abiertos de la cuenta** (la spec §2.7.3 paso 5 se lo atribuye, pero el código no lo hace). Confirmar que `restablecerPassword` los invalida por su cuenta en la misma transacción, sin modificar `cuenta.service.ts`, y que la llamada es `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: false, origen: "RECUPERACION", ip })`.
  5. **Eventos de seguridad.** Verificado: el helper `eventoSeguridad(tx, tipo, usuarioId, email, ip)` de `cuenta.service.ts` es **privado** y exige `usuarioId` (los eventos `RECUPERACION_SOLICITADA` y `RECUPERACION_LIMITADA` de un email inexistente no lo tienen), y `registrarEventoSeguridad` de `autenticacion.service.ts` también es privado y solo admite los cuatro tipos del login. Proponer cómo se escriben los cuatro eventos de esta HU (propuesta: un helper propio dentro de `recuperacion.service.ts`, sin exportar ni tocar los otros dos), con `usuarioId` opcional y sin datos sensibles (spec §3.11 y P-A2).
  6. **Errores de dominio.** Cómo se traducen las claves de `ErrorDeDominio` a los `code` de la spec (`VALIDATION_ERROR`, `ENLACE_INVALIDO` 410, `PASSWORD_IGUAL_A_ACTUAL` 422, `TRANSACCION_OCUPADA` 409) en las rutas y las acciones, y qué claves nuevas hay que sumar a `src/server/shared/errores-dominio.ts` y a `textos.ts`. Verificado: ya existen `errores.cuenta.passwordIgualActual` («La contraseña nueva no puede ser igual a la actual»), `errores.cuenta.datosInvalidos` y `errores.transaccion.ocupada`. **Cuidado con el texto:** la spec, el backlog y el prototipo dicen «igual a la **anterior**». Proponer una clave nueva para la recuperación en vez de cambiar la de A-06.
  7. **Email.** Verificado: `src/server/email/email.service.ts` ya existe, con `enviarEmail({ para, asunto, texto, html? })`, el simulador (`emailsSimulados`) y Resend por `fetch` con un tiempo límite de 10 segundos. Reportar: cómo se arma la URL pública (`NEXTAUTH_URL`, con `AUTH_URL` como alternativa de NextAuth; qué pasa si falta, si hay barra final), qué claves de `textos.ts` llevan el asunto, el saludo, el botón, el aviso de vencimiento y de un solo uso y la frase «Si no pediste este cambio, ignorá este email», y cómo se resuelve el saludo (`obtenerNombreVisible(usuarioId, rol)`, de `usuario.service.ts`, T10).
  8. **Enlace y token.** Confirmar el diseño de la spec (§3.9): 32 bytes de `crypto.randomBytes`, en base64url; solo se guarda el hash SHA-256 (`tokenHashRecuperacion`, único); vencimiento a 30 minutos de `ahora()` (`src/server/shared/reloj.ts`, Regla de reloj del PR 0); el valor sin hash no se guarda ni se registra. Proponer qué algoritmo de hash y qué codificación (hex o base64url) y confirmar que alcanza con comparar por igualdad del hash.
  9. **Encabezados.** La spec pide `Referrer-Policy: no-referrer` en `/restablecer-contrasena` (un Server Component no puede fijar encabezados de respuesta) y `Cache-Control: no-store` en las respuestas del módulo. Verificado: `next.config.ts` no define `headers()` hoy. Proponer cómo se fija cada uno (propuesta: `headers()` de `next.config.ts` para la página y `no-store` en las respuestas de los Route Handlers, como en `with-permission.ts`) y cómo se prueba.
  10. **Qué pasa con una sesión abierta en las pantallas públicas.** `/login` redirige a `/home` si ya hay sesión válida. Las dos pantallas nuevas **no** deberían hacerlo, porque «Mi cuenta» va a enlazar a `/recuperar-contrasena` (decisión de la task de A-06). Reportar qué hace hoy el proxy con una sesión que tiene la marca «Debe cambiar la contraseña» cuando entra a estas rutas (no están en el `matcher`, así que no debería intervenir) y confirmar. Al restablecer, las sesiones de la cuenta caen (`sesionesValidasDesde`), incluida la de quien llegó desde «Mi cuenta».
  11. **Formulario de la nueva contraseña.** `CambiarPasswordForm` (A-06) tiene dos modos (`primerIngreso` y `miCuenta`), está probado y se acopla a la reemisión de sesión. Proponer si el formulario de `/restablecer-contrasena` se hace como componente propio (propuesta, para no tocar A-06) o como un tercer modo, y qué se comparte (el schema de la política, `ConfirmarAccionDialog`, las claves `ui.sesion.formPassword.*` ya existentes). Verificado: el aviso de éxito de `/login?contrasena=actualizada` **ya existe** (clave `ui.sesion.formPassword.exitoReingreso`, «Tu contraseña se actualizó. Iniciá sesión con la nueva contraseña.», igual al criterio 5): se reutiliza.
  12. **Rutas públicas.** Verificado: `/recuperar-contrasena` y `/restablecer-contrasena` no están en el `matcher` de `src/proxy.ts` ni en `rutas-por-rol.ts`, así que ya son públicas. Confirmar que no hace falta tocar ninguno de los dos archivos y qué prueba lo deja asentado (por ejemplo, un caso en `rutas-por-rol.test.ts`).
  13. **Tests existentes del login.** Listar los tests de `login-form`, de la página de login y de «Mi cuenta» que se ven afectados por el enlace nuevo. Ningún test de Sprint 1, 2 y de A-06 se borra ni se debilita.
  14. **Textos (`docs/DESIGN.md` §9).** Todo texto visible sale de `src/lib/textos.ts` con `texto(clave)` y se verifica con `scripts/verificar-claves-textos.ts` (no tiene script en `package.json`: se corre con `npx tsx scripts/verificar-claves-textos.ts`). Proponer los prefijos de las claves nuevas (propuesta: `ui.sesion.recuperar.*`, `ui.sesion.restablecer.*`, `ui.sesion.emailRecuperacion.*`, `errores.sesion.enlaceInvalido`, y la clave de «igual a la anterior»), y si el verificador acepta las claves que se usan solo en el email.
  15. **Prototipo.** Reportar cualquier diferencia entre el prototipo (figuras 88 a 90) y la spec que no esté listada en la sección 5. No leer más páginas del PDF que la 80 y la 81.
  16. **Feedback de cada pantalla (`docs/DESIGN.md` §6.4).** Una HU que no está en la tabla define su feedback con el criterio de §6.1 a §6.3 y lo agrega a la tabla **antes** de implementar. Propuesta: `/recuperar-contrasena` = página completa, sin confirmación, y al enviar la misma tarjeta pasa al estado «Revisá tu email» con el mensaje del criterio 2 inline (sin toast); `/restablecer-contrasena` = página completa + `ConfirmarAccionDialog` («Cambiar contraseña»), y al terminar navega a `/login?contrasena=actualizada`. Confirmar o corregir.
  17. **Escenarios de prueba.** `PR-0.md` §2.16 dejó a esta HU el «enlace de recuperación vencido». Como solo se guarda el hash, la fixture necesita un valor conocido para armar el enlace. Proponer las cuentas y los escenarios de la sección 6 (Nivel 3) y cómo se evita que la fixture guarde un enlace vigente (que vencería al rato y no sería reproducible).

**Estado: relevamiento resuelto.** Las decisiones están en la sección 0.1 y no se relevan de nuevo. Se implementa por etapas con pausa entre una y otra (sección 8).

---

### 0.1. Decisiones del relevamiento (resueltas, no relevar de nuevo)

El relevamiento confirmó que lo que la task da por existente existe (modelos `TokenRecuperacion` y `SolicitudRecuperacion`, los cuatro eventos del enum, `enviarEmail` con su simulador, `cambiarPassword` con `origen` e `ip`, `obtenerIp`, `ipDeLaSolicitud()`, el banner `?contrasena=actualizada` del login) y que **no hace falta migración**: `schema.prisma` no se toca. Decisiones:

1. **`after()`.** Funciona en Route Handlers y en Server Actions de Next 16.3.8; una excepción dentro de la tarea la captura Next sin romper la respuesta ya enviada. Se llama en la **capa delgada**, no en el servicio: `solicitarRecuperacion` devuelve `{ entro }` y se programa `procesarSolicitudRecuperacion(email, ip)` solo si `entro` es `true`. La tarea lleva su propio `try/catch` con un log que **no incluye enlace ni token**. En vitest se mockea `next/server` (`after`) y el callback capturado se ejecuta a mano.
2. **Dos entradas por operación.** Route Handler (`{ data, error }`, `obtenerIp(request)`) y Server Action (`ipDeLaSolicitud()`), ambas capa delgada sobre el mismo servicio. Las pantallas llaman a la acción directamente, sin `useActionState`, como el login y A-06. Estados del pedido: `idle`, `enviada`, `error_validacion`, `error`. Estados del restablecimiento: `exito`, `enlace_invalido`, `error_validacion`, `error`. Los tipos viven en `src/types/sesion.types.ts`.
3. **Bloqueo por email.** SQL directo con dos claves, `pg_advisory_xact_lock(<constante del módulo>, hashtext(email))`, vía `$executeRaw`, sin tocar `bloquear.ts` (nunca se combina con bloqueos de filas, no entra en el orden de PR-0 §2.10). La inserción fija `creadoEnSolicitud = ahora()` y el conteo usa `ahora()` menos 60 minutos. Si el bloqueo agota su tiempo, el pedido responde **`409 TRANSACCION_OCUPADA`** (depende solo del email, no revela nada de la cuenta).
4. **`cambiarPassword`.** Se llama `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: false, origen: "RECUPERACION", ip })`. No invalida enlaces: `restablecerPassword` invalida los **otros** enlaces de la cuenta con su propio `UPDATE`, en la misma transacción. `cuenta.service.ts` no se toca.
5. **Eventos.** Helper privado en `recuperacion.service.ts` (`usuarioId?: string | null`, email e IP del evento), no exportado. `RECUPERACION_LIMITADA` se escribe siempre con `usuarioId` en `null`: buscar la cuenta antes de responder rompería P-A4.
6. **Errores.** `errores.sesion.enlaceInvalido` → `ENLACE_INVALIDO` 410 (texto del criterio 3) y `errores.sesion.passwordIgualAnterior` → `PASSWORD_IGUAL_A_ACTUAL` 422 («La contraseña nueva no puede ser igual a la anterior»; la clave de A-06 no se cambia). Se suma `410` a la unión de status de `errores-dominio.ts`. La validación reutiliza `errores.cuenta.datosInvalidos` (400); las rutas validan con Zod primero (Regla 6) y devuelven errores por campo. Las rutas nuevas responden `error.status` directamente.
7. **Email.** El simulador imprime solo el texto plano: **el enlace va en el texto**. El nombre de la persona y la URL se escapan antes de armar el HTML. MESA_ENTRADA y GERENTE reciben el saludo con su email (`obtenerNombreVisible` no lee sus fichas; lo admite T10) y no se cambia esa función. URL pública: `NEXTAUTH_URL ?? AUTH_URL`, sin barra final, armada con `new URL("/restablecer-contrasena", base)` y `searchParams`. **Sin respaldo a `localhost`**: si faltan las dos variables se trata como envío fallido (evento `RECUPERACION_ENVIO_FALLIDO`, enlace invalidado y log).
8. **Token.** Diseño de §3.9. Hash SHA-256 en hex (64 caracteres), comparación por igualdad contra el índice único. La página rechaza sin consultar la base un token con largo fuera de 20 a 200.
9. **Encabezados.** `headers()` en `next.config.ts` (hoy vacío): `Referrer-Policy: no-referrer` y `Cache-Control: no-store` para `/restablecer-contrasena`, y `no-store` para `/recuperar-contrasena`. Las dos rutas de API responden `no-store, must-revalidate`, como logout. Se prueba con `next.config.test.ts` y `curl -I` en la evidencia.
10. **Sesión abierta tras restablecer.** Quien restablece desde «Mi cuenta» conserva una cookie ya revocada; `/login` y `/home` usan `auth()` sin mirar la revocación (deuda 9.4 de A-06) y el banner se pierde. Por eso el formulario, al terminar, hace siempre `POST /api/auth/logout` (tolera que no haya sesión) y después navega con `window.location.href = "/login?contrasena=actualizada"`, igual que `CambiarPasswordForm` cuando la sesión no se conserva.
11. **Formulario.** Componente propio de la ruta (Regla 11). Comparte el schema de la política, `ConfirmarAccionDialog` y las claves `ui.sesion.formPassword.*` y `ui.sesion.primerIngreso.confirmacion`; reutiliza `exitoReingreso`.
12. **Rutas públicas.** No están en el matcher del proxy ni en `rutas-por-rol.ts`: esos archivos no se tocan. Se prueba con un caso en `rutas-por-rol.test.ts` (`rutaAdmiteMarca` da `false` y `rolPuedeAccederRuta` da `true` para los cuatro roles). **No** se agrega `proxy.test.ts`.
13. **Tests afectados.** Se suma un caso en `primer-ingreso/page.test.tsx` (ahí vive el test de «Mi cuenta») y los mocks nuevos en `actions.test.ts` (`recuperacion.service` y `next/server`). No se borra ni debilita ningún test.
14. **Textos.** Prefijos `ui.sesion.recuperar.*`, `ui.sesion.restablecer.*`, `ui.sesion.emailRecuperacion.*` (`asunto`, `saludo`, `cuerpo`, `boton`, `aviso`, `ignorar`), más las dos claves de error. Las del email se usan con `texto("…")` literal en el servicio. El mensaje de email inválido es «Ingresá un email válido, por ejemplo nombre@dominio.com.» tanto en el schema como en la pantalla.
15. **Prototipo.** Claude Code no puede leer el PDF en esa máquina y no se instala nada: la fuente para las pantallas es la sección 5 de esta task (figuras 88–90, páginas 80–81).
16. **Feedback.** Como en §5, con un agregado: en `/restablecer-contrasena`, el enlace inválido reemplaza el formulario por el mensaje y el acceso a pedir otro, y un `410` al guardar muestra ese mismo estado.
17. **Pantallas y componentes.** Páginas en `src/app/(auth)/…` con sus formularios al lado; tarjeta centrada compartida en `src/components/sesion/tarjeta-sesion-publica.tsx` (sin `layout.tsx` en `(auth)`, que cambiaría login y registro). El enlace de «Mi cuenta» va con `LinkProtegido` para respetar los cambios sin guardar.
18. **Fixture.** `prisma/seed/fixtures/hu-a-05.ts`, idempotente (busca por hash antes de insertar). Reutiliza las cuentas de A-06 (`a06.alumno.mi.cuenta`, `a06.alumno.primer.ingreso`, `a06.alumno.inactivo`) y un email inexistente. Inserta directo en `tokens_recuperacion` un enlace vencido (vencimiento fijo en el pasado) y uno ya usado, con valores conocidos y constantes de los que solo se guarda el hash. El enlace vigente se pide siempre desde la pantalla o con Postman.

**Diferencias entre la spec y el código (van en la nota aditiva de `spec_modulo_A.md`, sin reescribir lo existente):**

- §2.7.4: `html` figura como obligatorio y el simulador «escribe el email»; en el código `html` es opcional y la consola muestra solo el texto plano.
- Nombres reales del esquema: `idSolicitudRecuperacion` (la spec dice `idSolicitud`) y `tokenHashRecuperacion` (el `UPDATE` de §2.7.3 dice `tokenHash`).
- §2.7.3 usa `politicaPasswordSchema` como valor, pero es una fábrica: va `construirRestablecerPasswordSchema(longitudMinima)`.
- §2.9: la firma de `cambiarPassword` no lista `origen` ni `ip`; el código sí.
- El mensaje de email inválido difiere entre el schema de §2.7.1 y la pantalla de §2.7.6; se unifica (decisión 14).
- El pedido puede terminar en `409 TRANSACCION_OCUPADA` (decisión 3); la spec solo prevé 200 o 400.
- `ErrorDeDominio` no admitía el status 410 (decisión 6).
- Criterio 5 con sesión abierta: el flujo `/login` → `/home` impide ver el banner (decisión 10).
- Saludo de MESA_ENTRADA y GERENTE con el email (decisión 7).
- IP desconocida: `obtenerIp` da `"unknown"` y el helper de `cuenta.service` da `"desconocida"`; se sigue a `obtenerIp`.

## 1. Nota de alcance

HU-A-05 cierra el módulo de sesión: sin ella, una persona que olvida su contraseña no tiene cómo volver a ingresar (nadie ve las contraseñas guardadas, HU-A-06). Es la **única historia que envía emails**, y por decisión del PO lo hace el **simulador**: no hace falta cuenta de Resend ni dominio verificado.

**Lo que ya existe y esta task usa** (verificado en el repo):

| Qué | Dónde |
|---|---|
| `TokenRecuperacion` y `SolicitudRecuperacion`, y los 4 eventos `RECUPERACION_*` | `prisma/schema.prisma` y migraciones `20261008120000_sprint3_eventos_seguridad`, `20261008120100_sprint3_modelo` |
| `enviarEmail`, el simulador y `emailsSimulados` | `src/server/email/email.service.ts` |
| `cambiarPassword(tx, { …, origen: "RECUPERACION" })`, `revocarSesiones`, `obtenerEstadoCuenta` | `src/server/usuarios/cuenta.service.ts` |
| `hashPassword`, `comparePassword` | `src/lib/password.ts` |
| `politicaPasswordSchema(longitudMinima)` y `password_longitud_minima` | `src/server/shared/password.schema.ts`, `ParametroSistema` |
| `transaccion`, `ahora()` | `src/server/shared/transaccion.ts`, `src/server/shared/reloj.ts` |
| `obtenerNombreVisible(usuarioId, rol)` | `src/server/usuarios/usuario.service.ts` |
| `construirCambiarPasswordSchema` y las acciones de A-06, como patrón | `src/server/sesion/sesion.schema.ts`, `src/server/sesion/actions.ts` |
| Banner de `/login?contrasena=actualizada` | `src/app/(auth)/login/page.tsx` |
| `NEXTAUTH_URL`, `RESEND_API_KEY` y `EMAIL_FROM` documentadas | `.env.example` |

**Lo que no existe y hace esta task:** el servicio de recuperación y sus constantes, los dos Route Handlers y las dos Server Actions, las dos pantallas, el enlace en el login y en «Mi cuenta», el contenido del email, los textos, los encabezados, la fixture y el uso de `after()` (ninguna otra HU lo usa todavía).

**Decisiones resueltas (no relevar de nuevo):**
- Las rutas son `/recuperar-contrasena` y `/restablecer-contrasena?token=…`; los endpoints, `/api/auth/recuperar-password` y `/api/auth/restablecer-password` (P-A11). Públicos.
- La respuesta del pedido es **siempre la misma** para un email inexistente, una cuenta inactiva, una cuenta activa y una solicitud limitada; el único caso distinto es el formato de email inválido (T6, P-A3, spec §3.10). Todo lo que depende de la existencia de la cuenta corre **después** de responder (P-A4).
- 30 minutos de vida del enlace y 3 solicitudes por email por hora son **constantes del módulo**, no `ParametroSistema` (P-A8). El límite se cuenta por email, exista o no la cuenta, y es aparte del límite del login.
- El enlace es de un solo uso: usarlo es una operación condicional (`UPDATE … WHERE consumido IS NULL AND vence > ahora RETURNING`), nunca «leer y después marcar». Un fallo posterior (contraseña igual a la vigente, cuenta inactiva) deshace la transacción y el enlace sigue siendo válido.
- La política de contraseña es `politicaPasswordSchema` tal cual (P-A10). «Igual a la anterior» se resuelve comparando contra el **hash vigente** (T9).
- Restablecer **no** inicia sesión: las sesiones de la cuenta caen y la persona vuelve al login. Si la cuenta todavía tenía la marca «Debe cambiar la contraseña», se quita.
- Sin limpieza de tokens ni de solicitudes vencidas: deuda conocida, igual que `TokenRevocado` (P-A12).
- El enlace «¿Olvidaste tu contraseña?» de «Mi cuenta» lo agrega esta HU (A-06 lo dejó para no dejar un enlace roto).

**Fuera de alcance de esta task (explícito):**
- Crear cuentas, el primer ingreso y «Mi cuenta» (HU-A-06, ya hecha).
- Autenticación de dos factores y cualquier otro uso del email del sistema (las altas de F y G no envían emails).
- Iniciar sesión automáticamente después de restablecer.
- Limpieza de tokens y solicitudes vencidos.
- Usar Resend de verdad: queda como opción que se activa con las variables de entorno, no como requisito.
- Tocar el login más allá del enlace, o `cuenta.service.ts` (salvo que el relevamiento lo confirme).

---

## 2. Historia de Usuario

**Como** usuario registrado (cualquier rol)
**Necesito** definir una contraseña nueva cuando olvidé la actual
**Para** volver a ingresar sin depender de mesa de entrada

**SP estimado:** 5

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_A.md` §2.7. Incluye:
- Servicio de recuperación (`solicitarRecuperacion`, `procesarSolicitudRecuperacion`, `verificarEnlaceRecuperacion`, `restablecerPassword`) y sus constantes.
- Schemas Zod de las dos operaciones.
- Dos Route Handlers y dos Server Actions equivalentes, capa delgada.
- El email de recuperación, con el servicio de envío que ya existe.
- Eventos de seguridad `RECUPERACION_SOLICITADA`, `RECUPERACION_LIMITADA`, `RECUPERACION_ENVIO_FALLIDO` y `RECUPERACION_CONFIRMADA`.
- UI: «¿Olvidaste tu contraseña?» en el login y en «Mi cuenta», `/recuperar-contrasena` y `/restablecer-contrasena`.
- Encabezados `Referrer-Policy: no-referrer` y `Cache-Control: no-store` donde la spec los pide.
- Fixture del enlace vencido y de los escenarios de prueba, y reglas en `RULES.md`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): lo listado en la sección 1.

---

## 4. Contrato Backend

### 4.1. Schemas Zod

Se agregan a `src/server/sesion/sesion.schema.ts`; no se modifica nada existente.
- `SolicitarRecuperacionSchema`: `email` con `trim`, minúsculas, formato válido y hasta 254 caracteres (spec §2.7.1). El único rechazo distinto de la respuesta uniforme es el formato inválido: `400 VALIDATION_ERROR`.
- `RestablecerPasswordSchema`: `token` (de 20 a 200 caracteres), `password_nueva` y `confirmacion`, con el `refine` de «Las contraseñas no coinciden» (spec §2.7.3). `politicaPasswordSchema` es una **fábrica** que depende de `password_longitud_minima`, así que el schema se arma con una función igual a `construirCambiarPasswordSchema` (propuesta: `construirRestablecerPasswordSchema(longitudMinima)`); lo confirma el relevamiento.

### 4.2. Servicio de recuperación

**Archivo:** `src/server/sesion/recuperacion.service.ts`. Interno del módulo A (no es público, spec §2.9).

**`solicitarRecuperacion(email, ip)`** — criterios 1, 2 y 6, en este orden:
1. Validar con `SolicitarRecuperacionSchema`.
2. En una `transaccion`, con un **bloqueo de aviso por email** (`pg_advisory_xact_lock` sobre el hash del email, Regla N.° 7): contar las filas de `SolicitudRecuperacion` de ese email de los últimos 60 minutos. Con **3 o más**: registrar `RECUPERACION_LIMITADA` y **no** insertar ni enviar nada. Con menos: insertar la solicitud.
3. Si la solicitud entró, programar `procesarSolicitudRecuperacion(email, ip)` con `after()`, para que corra **después de enviar la respuesta**. `after()` no se llama en el servicio: `solicitarRecuperacion` devuelve `{ entro }` y la capa delgada programa `procesarSolicitudRecuperacion` solo si `entro` es `true` (sección 0.1).
4. Responder siempre lo mismo (4.3).

**`procesarSolicitudRecuperacion(email, ip)`** (ya fuera de la respuesta; una excepción acá no puede romper nada ni quedar sin registrar):
1. Buscar la cuenta por email y registrar `RECUPERACION_SOLICITADA` (con `usuarioId` si existe, `null` si no): **cada solicitud que entra** es un evento.
2. Si no existe o está **inactiva** (una ficha inactiva tiene la cuenta inactiva), terminar sin enviar nada.
3. En una `transaccion`: invalidar los enlaces abiertos de la cuenta (`UPDATE … SET consumidoEnToken = ahora WHERE usuarioId = … AND consumidoEnToken IS NULL`: **pedir uno nuevo invalida el anterior**) y crear el nuevo: 32 bytes aleatorios en base64url, del que se guarda **solo su hash SHA-256**, con vencimiento a 30 minutos de `ahora()`.
4. Enviar el email (4.5). Si falla o no responde: invalidar el enlace recién creado, registrar `RECUPERACION_ENVIO_FALLIDO` y registrar el error en el log **sin el enlace ni la clave**. El usuario no se entera: ve el mismo mensaje y puede pedir otro.

**`verificarEnlaceRecuperacion(token): Promise<boolean>`** — lectura que usa la página `/restablecer-contrasena`. `true` si el hash del token existe, no está consumido ni invalidado y no venció. **No consume** el enlace.

**`restablecerPassword(input, ip)`** — criterios 3, 4, 5 y 6, en este orden:
1. Validar con el schema. **Antes** de tocar el enlace: una contraseña que no cumple la política o una confirmación distinta responde `400 VALIDATION_ERROR` y no gasta el enlace.
2. En una `transaccion`, **consumir el enlace con una operación condicional**: `UPDATE tokens_recuperacion SET consumidoEnToken = ahora WHERE tokenHashRecuperacion = <hash> AND consumidoEnToken IS NULL AND venceEnToken > ahora RETURNING usuarioId`. Sin fila (vencido, usado, invalidado por uno nuevo o inexistente): `410 ENLACE_INVALIDO`. Dos envíos simultáneos del mismo enlace: **solo uno** confirma.
3. Bloquear la fila de la cuenta (`FOR UPDATE`, sin combinarlo con otros bloqueos). Si está **inactiva**: `410 ENLACE_INVALIDO` (se deshace el consumo).
4. Si la nueva es **igual a la contraseña vigente** (`comparePassword` contra el hash): `422 PASSWORD_IGUAL_A_ACTUAL`. Se deshace toda la transacción, así que el enlace **sigue siendo válido** para reintentar.
5. `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: false, origen: "RECUPERACION", ip })`: guarda el hash, quita la marca si la tenía y fija `sesionesValidasDesde` (caen todas las sesiones de la cuenta). **Además**, en la misma transacción, invalidar cualquier otro enlace abierto de la cuenta: `cambiarPassword` no lo hace (punto 4 del relevamiento).
6. El evento `RECUPERACION_CONFIRMADA` lo registra `cambiarPassword` con `origen: "RECUPERACION"`, en la misma transacción.

**Errores de servicio:** `VALIDATION_ERROR` (400), `ENLACE_INVALIDO` (410), `PASSWORD_IGUAL_A_ACTUAL` (422), `TRANSACCION_OCUPADA` (409). Ni el token, ni las contraseñas, ni los hashes salen de acá: ni en errores, ni en logs.

### 4.3. Route Handlers

Rutas estáticas junto a `logout`, que no chocan con el `[...nextauth]`. Capa delgada (Regla N.° 4), `{ data, error }` (Regla N.° 5), `Cache-Control: no-store`, IP con `obtenerIp(request)`.
- **`POST /api/auth/recuperar-password`** — público. Cuerpo `{ "email": "…" }`. Responde `200` con `{ "data": { "solicitada": true }, "error": null }` para **todos** los casos válidos (email inexistente, cuenta inactiva, cuenta activa y solicitud limitada). Formato inválido: `400 VALIDATION_ERROR`. Si el bloqueo por email agota su tiempo: `409 TRANSACCION_OCUPADA` (sección 0.1).
- **`POST /api/auth/restablecer-password`** — público, lo autoriza el enlace. Cuerpo `{ "token", "password_nueva", "confirmacion" }`. Responde `200` con `{ "data": { "restablecida": true }, "error": null }`. Errores: `400 VALIDATION_ERROR`, `410 ENLACE_INVALIDO`, `422 PASSWORD_IGUAL_A_ACTUAL`, `409 TRANSACCION_OCUPADA`.

### 4.4. Server Actions

`solicitarRecuperacion()` y `restablecerPassword()` en `src/server/sesion/actions.ts`: capa delgada con la firma de `useActionState` o equivalente (excepción de la Regla N.° 5, como en A-06), Zod, servicio y, si corresponde, `after()`. Restablecer **no** reemite sesión ni llama a `signIn`: la interfaz navega a `/login?contrasena=actualizada`.

### 4.5. Email de recuperación

Lo envía `procesarSolicitudRecuperacion` con `enviarEmail` (ya existe); **nunca** la pantalla. Contenido (spec §2.7.4):
- Asunto «Restablecé tu contraseña de Noctium».
- Saludo con el nombre de la persona (`obtenerNombreVisible`: el nombre o, si no lo tiene, el email).
- El botón o enlace a `<URL pública>/restablecer-contrasena?token=<token>`.
- El aviso de que vence a los 30 minutos y es de un solo uso.
- «Si no pediste este cambio, ignorá este email».
- Sin contraseñas. Todos los textos salen de `src/lib/textos.ts`.

En las pruebas y en la demostración rige el simulador: el email completo, con el enlace, se escribe en la consola del servidor (solo fuera de producción). En producción sin `RESEND_API_KEY`, el envío falla y se trata como en 4.2 paso 4.

### 4.6. Trazabilidad

Módulo A usa la opción (b) de la Regla N.° 2: escritura directa en `EventoSeguridad`, sin event bus ni listeners (las secciones de eventos y `AuditLog` del template no aplican). Los eventos guardan solo `usuarioId` (si se conoce), `emailEvento` e `ipEvento`:

| Evento | Cuándo |
|---|---|
| `RECUPERACION_SOLICITADA` | Cada solicitud que entra, exista o no la cuenta |
| `RECUPERACION_LIMITADA` | La cuarta solicitud o más de un mismo email en una hora |
| `RECUPERACION_ENVIO_FALLIDO` | Falla o demora del envío |
| `RECUPERACION_CONFIRMADA` | Contraseña restablecida, en la misma transacción |

`TokenRecuperacion` y `SolicitudRecuperacion` son tablas operativas (como `IntentoLoginFallido`), no trazabilidad. Campos reales: `tokenHashRecuperacion`, `venceEnToken`, `consumidoEnToken`, `creadoEnToken` y `usuarioId`; `emailSolicitud`, `ipSolicitud` y `creadoEnSolicitud`. Ni contraseñas, ni el valor del enlace, ni el enlace completo, ni la clave de Resend, ni hashes en eventos, logs ni respuestas (spec §3.11). Constantes en `recuperacion.constantes.ts`: `MINUTOS_VALIDEZ_ENLACE_RECUPERACION = 30` y `MAX_SOLICITUDES_RECUPERACION_POR_HORA = 3`.

---

## 5. Frontend

**Referencia visual (prototipo, figuras 88 a 90):** tarjetas centradas, con la marca, sin menú.
- **Fig. 88, pedir el enlace:** título «¿Olvidaste tu contraseña?», bajada, campo Email, botón «Enviar enlace» y enlace «Volver a iniciar sesión».
- **Fig. 89, respuesta:** título «Revisá tu email», el mensaje «Si el email corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña» y la nota «El enlace es de un solo uso y vence a los 30 minutos. Pedir otro invalida el anterior.».
- **Fig. 90, enlace de recuperación:** título «Definí una contraseña nueva», «La contraseña nueva no puede ser igual a la anterior.», Contraseña, Confirmación y «Guardar contraseña».
- **Diferencias ya detectadas (el backlog y la spec prevalecen):** (1) el botón «Abrir el enlace del email (ejemplo)» de la fig. 89 y el enlace «Ver cómo se muestra un enlace vencido» de la fig. 90 son del prototipo y no se implementan: el enlace real llega por el email (el simulador lo escribe en la consola del servidor); (2) la ayuda del prototipo dice «Al menos 8 caracteres, con letras y números», pero la política real exige además mayúscula y minúscula y toma la longitud de `password_longitud_minima`: el texto sale de la política real (la clave `ui.sesion.formPassword.ayudaPolitica` ya existe); (3) el prototipo no muestra el enlace «¿Olvidaste tu contraseña?» en el login ni en «Mi cuenta».

- **Login y «Mi cuenta»:** se suma el enlace «¿Olvidaste tu contraseña?» a `/recuperar-contrasena`. Todo lo demás del login queda como está.
- **`/recuperar-contrasena`:** título, bajada, campo Email, «Enviar enlace» y enlace para volver al login. Tras enviar, **siempre** el mensaje del criterio 2. Email inválido: «Ingresá un email válido, por ejemplo nombre@dominio.com.». No redirige si hay sesión abierta (punto 10 del relevamiento).
- **`/restablecer-contrasena?token=…`:** con enlace válido (`verificarEnlaceRecuperacion`), contraseña nueva con la ayuda de la política, confirmación y «Guardar contraseña»; con enlace inválido, «El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?», con acceso a la pantalla de pedido. Antes de guardar, la confirmación de HU-C-25: «¿Estás seguro de que querés cambiar tu contraseña?». Si el enlace vence o se usa mientras la persona completa el formulario, el `410` muestra el mismo mensaje. Al terminar, va a `/login` con «Tu contraseña se actualizó. Iniciá sesión con la nueva contraseña.». La página responde con `Referrer-Policy: no-referrer`.
- **Feedback (`docs/DESIGN.md` §6):** las dos son páginas completas: sin toast ni modal informativo. Las filas de esta HU se agregan a la tabla §6.4 y a su historial **antes** de implementar (punto 16 del relevamiento). La confirmación lleva el verbo de la acción («Cambiar contraseña»), no «Aceptar».
- **Textos (`docs/DESIGN.md` §9):** todo texto visible sale de `src/lib/textos.ts` con `texto(clave)`, incluidas etiquetas accesibles y el contenido del email. Las claves nuevas usan los prefijos que apruebe el relevamiento y pasan `scripts/verificar-claves-textos.ts`.
- Seguir `docs/DESIGN.md` (tokens de shadcn/ui; nunca hex ni la paleta por defecto de Tailwind).

**Fuera de alcance de frontend:** cualquier cambio de la pantalla de login que no sea el enlace.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
Casos obligatorios de spec A §3.13, puntos 6 y 7 (el resto es de HU-A-06):
- **Pedir el enlace:** misma respuesta para email inexistente, cuenta inactiva, cuenta activa y solicitud limitada; formato inválido → 400; la cuarta solicitud de la hora no envía ni crea enlace y deja `RECUPERACION_LIMITADA`; cuatro solicitudes simultáneas del mismo email: solo tres entran (bloqueo de aviso).
- **Procesar:** pedir uno nuevo invalida el anterior; el enlace guardado es solo el hash; cuenta inactiva o inexistente no recibe nada; el email del simulador tiene el asunto, el saludo con el nombre, el enlace, el aviso y la frase de «ignorá este email»; falla del envío → `RECUPERACION_ENVIO_FALLIDO`, enlace invalidado y el usuario ve el mismo mensaje.
- **Restablecer:** enlace vencido, usado, invalidado por uno nuevo e inexistente → 410; dos confirmaciones simultáneas del mismo enlace (una gana, la otra 410); contraseña igual a la vigente → 422 **y el enlace sigue válido**; política y confirmación distinta → 400 sin gastar el enlace; cuenta que se desactiva antes de confirmar → 410; quita la marca de una cuenta con primer ingreso pendiente; cierra todas las sesiones (`sesionesValidasDesde`); invalida los demás enlaces abiertos de la cuenta; registra `RECUPERACION_CONFIRMADA`; no inicia sesión.
- **Datos sensibles:** ni los logs ni `EventoSeguridad` contienen contraseñas, enlaces, el valor del token ni la clave de Resend; el simulador es el único lugar donde se ve el enlace, y nunca en producción.
- **Capa delgada:** Route Handlers y Server Actions (códigos, `{ data, error }`, `Cache-Control: no-store`, `after()` solo cuando la solicitud entró).
- **Pantallas:** formularios (validación en el cliente, mensaje uniforme, estado «Revisá tu email», confirmación, `410` junto al formulario), enlace en el login y en «Mi cuenta`.
- Los tests de Sprint 1 y 2 y los de HU-A-06 siguen pasando; solo se agregan casos al login y a «Mi cuenta».

### Nivel 2 — Postman
- `POST /api/auth/recuperar-password` con el email de una cuenta activa, con uno inexistente y con el de una cuenta inactiva → `200` y el **mismo** cuerpo. Email inválido → `400`.
- Cuarta solicitud del mismo email en una hora → `200`, sin email nuevo y con el evento `RECUPERACION_LIMITADA` (nivel 3).
- `POST /api/auth/restablecer-password` con el enlace que escribió el simulador en la consola del servidor → `200`; el mismo enlace de nuevo → `410`; un enlace vencido de la fixture → `410`; contraseña igual a la vigente → `422` y el enlace sigue sirviendo; contraseña que no cumple la política → `400`.
- Después de restablecer: el login con la contraseña vieja falla y con la nueva funciona; una sesión abierta antes recibe `401` en su próxima solicitud.

### Nivel 3 — BD / TablePlus
- `solicitudes_recuperacion`: una fila por solicitud que entró (máximo 3 por email por hora).
- `tokens_recuperacion`: solo hash (nunca el valor del enlace), `venceEnToken` a 30 minutos de la creación, `consumidoEnToken` cargado al usar o invalidar.
- `usuarios`: `passwordHashUsuario` nuevo (nunca la contraseña en claro), `debeCambiarPasswordUsuario` en `false` y `sesionesValidasDesdeUsuario` avanzado tras restablecer.
- `eventos_seguridad`: `RECUPERACION_SOLICITADA`, `RECUPERACION_LIMITADA`, `RECUPERACION_ENVIO_FALLIDO` y `RECUPERACION_CONFIRMADA` con `usuarioId` (si se conoce), email e IP, sin datos sensibles; ninguna fila contiene el valor del enlace.

**Evidencia esperada:** pedidos HTTP (Postman o curl) + SQL para el contrato de API y la capa de datos, el recorrido de pantallas hecho por el responsable y los resultados de los tests; todo en `docs/testing/HU-A-05-evidencia.md`. Un criterio que no se pudo verificar se documenta como «Bloqueado» con su motivo.

**Verificaciones diferidas que le tocan a esta HU:** ninguna. Todo lo que usa va antes. En cambio, esta HU cierra la parte «Si la olvida, usa HU-A-05» del criterio 4 de HU-A-06.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) hecho y decisiones registradas (sección 0.1).
- [x] Servicio, Route Handlers y Server Actions implementados, sin lógica de negocio en la capa delgada (Regla N.° 4).
- [x] Los endpoints responden con `{ data, error }` y códigos semánticos; el pedido responde lo mismo en los cuatro casos (Regla N.° 5).
- [x] El enlace es de un solo uso, vence a los 30 minutos, se guarda solo su hash y usarlo es una operación condicional; el límite de 3 solicitudes por email por hora se aplica con bloqueo de aviso (Regla N.° 7).
- [x] Eventos de seguridad escritos según spec A §4, sin datos sensibles.
- [x] El email lo envía el servidor desde `enviarEmail` y los textos están en `textos.ts`; con simulador no se manda nada real y no hace falta cuenta de Resend.
- [x] Enlace en el login y en «Mi cuenta», `/recuperar-contrasena` y `/restablecer-contrasena` funcionando; `Referrer-Policy: no-referrer` en la segunda.
- [x] Ningún `DELETE` físico y ningún test de Sprint 1, 2 y de HU-A-06 borrado ni debilitado.
- [x] Fixtures en `prisma/seed/fixtures/hu-a-05.ts` con su línea en el índice (enlace vencido y escenarios de prueba, idempotentes), sin editar `seed.ts`.
- [x] Filas de esta HU en `docs/DESIGN.md` §6.4 (y en su historial de cambios), y las claves de texto nuevas verificadas con `scripts/verificar-claves-textos.ts`.
- [x] Reglas de la recuperación en `RULES.md` y nota aditiva en `spec_modulo_A.md` (lo que el código real tuvo que acomodar).
- [x] `lint`, `tsc`, `npm test` y `npm run test:pg` en verde antes de pedir revisión.
- [x] Tests de los 3 niveles documentados con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapas de implementación

Se implementa en cuatro etapas. Al terminar cada una, Claude Code **se detiene**, resume lo hecho y espera el «continuamos» del responsable. No pasa a la siguiente por su cuenta ni hace commits o ramas sin que se lo pidan: la HU entra en **un solo commit**, con mensaje de una línea.

1. **Servicio de recuperación.** `recuperacion.constantes.ts`, `recuperacion.service.ts`, los schemas de `sesion.schema.ts`, el helper de eventos, el contenido del email con sus claves de `textos.ts` y las claves de error; el status `410` en `errores-dominio.ts`; tests unitarios y con PostgreSQL (concurrencia incluida).
2. **Capa delgada.** Los dos Route Handlers, las dos Server Actions, el uso de `after()`, `Cache-Control: no-store` y los encabezados de `next.config.ts`; los estados de las acciones en `sesion.types.ts`; sus tests (incluidos los mocks nuevos de `actions.test.ts` y `next.config.test.ts`).
3. **Pantallas.** Siguiendo el prototipo (figuras 88–90, páginas 80–81). El enlace en el login y en «Mi cuenta» (con `LinkProtegido`), la tarjeta compartida `tarjeta-sesion-publica.tsx`, `/recuperar-contrasena`, `/restablecer-contrasena`, sus formularios (con `POST /api/auth/logout` y navegación al terminar de restablecer), los textos y las filas de DESIGN §6.4 (antes de implementar las pantallas); tests de pantallas.
4. **Cierre.** Fixture `hu-a-05.ts` + índice, `RULES.md`, nota aditiva en `spec_modulo_A.md`, `docs/testing/HU-A-05-evidencia.md`, y `lint`, `tsc`, `npm test`, `npm run test:pg` y `npx tsx scripts/verificar-claves-textos.ts` en verde.


---

## 9. Resultado de la implementación

Evidencia completa en `docs/testing/HU-A-05-evidencia.md`. HU-A-05 queda implementada y verificada con el simulador de email. El envío real con Resend no se probó porque no es requisito de la HU.

### 9.1. Criterios de aceptación

| Criterio | Resultado | Cómo se verificó |
|---|---|---|
| 1. Enlace en el login y en «Mi cuenta» | Verificado | Tests de los dos enlaces y recorrido en pantalla. Cierra el criterio 4 de HU-A-06 |
| 2. Respuesta idéntica exista o no la cuenta | Verificado | `200 {"data":{"solicitada":true},"error":null}` igual para cuenta activa, inexistente e inactiva; solo la activa recibió el email |
| 3. Enlace de un solo uso, que vence | Verificado | Enlace reutilizado, vencido y usado: `410`, y la pantalla muestra «Enlace no válido». Pedir otro invalida el anterior. Dos confirmaciones simultáneas: una gana (test con PostgreSQL) |
| 4. Contraseña nueva distinta de la anterior y válida | Verificado | Igual a la vigente: `422` y el enlace sigue sirviendo. Política incumplida: `400`. En pantalla, los dos errores aparecen junto al campo |
| 5. Cuenta con la marca de cambio obligatorio | Verificado | Redirige a `/login` con el aviso; al ingresar con la contraseña nueva llega a `/home`, no a `/primer-ingreso` |
| 6. Límite de solicitudes por email | Verificado | El cuarto pedido de la hora responde igual (`200`) y queda `RECUPERACION_LIMITADA` sin `usuarioId` |
| 7. Contenido del email | Verificado con el simulador | Asunto, saludo con el nombre, enlace, aviso de 30 minutos y frase final, tal como salieron en la consola |

### 9.2. Desvíos respecto de lo decidido

- **`recuperacion.tarea.ts`:** archivo nuevo, no previsto. La ruta y la acción programan la misma tarea con `after()`, y `actions.ts` es `"use server"`: cualquier función exportada ahí queda expuesta como acción. La tarea va en un módulo aparte, que es el único que importa `next/server`. Su log solo dice el nombre y el `code` del error, nunca el mensaje (un error de Prisma puede traer el email o el hash).
- **Formato del 400:** `VALIDATION_ERROR` con el mensaje de `errores.cuenta.datosInvalidos` y los errores por campo en `detalles`, como pide la spec; las rutas existentes usan `VALIDACION`. Un cuerpo que no es JSON responde lo mismo.
- **Bloqueo de la cuenta antes de sus enlaces:** `restablecerPassword` y `procesarSolicitudRecuperacion` bloquean primero la cuenta y después sus enlaces, para evitar bloqueos cruzados; sin eso, dos pedidos simultáneos podían dejar dos enlaces abiertos.
- **Variable de entorno vacía:** `NEXTAUTH_URL` vacía cuenta como faltante (`trim() ||` en lugar de `??`). Cualquier error al armar el email se trata como envío fallido.
- **Token de largo inválido en la acción:** da `enlace_invalido` y no un error de campo, porque la pantalla no tiene campo para el token; la ruta responde `400` con `detalles.token`. La página valida el largo con `construirRestablecerPasswordSchema(...).shape.token`.
- **Estados y textos:** `idle` agregado a `EstadoRestablecerPassword`; los errores de comunicación reutilizan `ui.sesion.formPassword.errorComunicacion`; clave extra `ui.sesion.recuperar.emailInvalido`; la etiqueta es «Contraseña nueva»; el estado de enlace inválido (título «Enlace no válido» y «Pedir un enlace nuevo») no aparece en el prototipo.
- **Test del login:** `login-form.test.tsx` no existía; se agregó para probar el enlace.
- **Fixture:** el enlace vencido y el usado son de `a06.profesor.primer.ingreso`, una cuenta que el recorrido no usa: pedir un enlace nuevo para una cuenta del recorrido marcaría esos enlaces como consumidos y el vencido dejaría de ser «solo vencido». El usado vence en 2099, así su único motivo de `410` es el uso.
- **Evidencia:**
  - El criterio 5 se verificó con `a06.postman.alumno.nuevo` (88060011) y no con `a06.alumno.primer.ingreso`, que ya no tenía la marca (hizo el primer ingreso en el recorrido de A-06).
  - `a06.alumno.mi.cuenta` tenía una contraseña desconocida tras el recorrido de A-06; quedó con la de la fixture de A-06, la contraseña anotada en la evidencia.
  - El servidor se levantó con `NEXTAUTH_URL=http://localhost:3000` solo para ese proceso: el `.env` local no la tiene y sin ella cada pedido de una cuenta activa termina en envío fallido.
  - Hay un `LOGIN_FALLIDO` de más en `a06.alumno.mi.cuenta` por el autocompletado del navegador.
  - La evidencia cubre los siete criterios del backlog.

### 9.3. Verificación final

- `lint` sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía), `tsc` sin errores, `verificar-claves-textos` aprobado y `next build` compila.
- `npm test`: 2730 pasan, 294 se saltean, 0 fallan.
- `npm run test:pg`: 258 pasan y fallan 2 archivos que no son de esta HU (HU-E-10 y HU-H-03); HU-H-10 ya no falla. Los 12 de recuperación pasan.
- Seed: `npx prisma db seed` se corrió dos veces sobre la base de desarrollo; las dos terminan bien («✓ Fixture HU-A-05») y la segunda no cambia filas de `tokens_recuperacion`. Con la fix de Iván, el seed completo ya no se detiene en HU-E-04.
- Encabezados: en producción (`next build` + `next start`) llegan los configurados (`Referrer-Policy: no-referrer` y `Cache-Control: no-store, must-revalidate` en `/restablecer-contrasena`; solo `no-store, must-revalidate` en `/recuperar-contrasena`). Solo `next dev` pisa el `Cache-Control` con `no-cache, must-revalidate`; `Referrer-Policy` llega igual en los dos modos.

### 9.4. Deuda conocida (no se corrige en esta HU)

- `/home` y `/login` usan `auth()` sin chequear la revocación de la sesión (deuda 9.4 de HU-A-06). El formulario de restablecer lo sortea cerrando la sesión antes de ir al login; el problema de fondo sigue.
- En `next dev`, lo que se escribe antes de que la página termine de hidratarse se pierde (pasó dos veces en el recorrido). Con la página ya cargada funciona bien.
- Los dos fallos de `test:pg` (HU-E-10 y HU-H-03) son de otros carriles.
- Tiene que haber `NEXTAUTH_URL` o `AUTH_URL` en el `.env` de cada desarrollador (`.env.example` ya la trae); sin ella el pedido responde `200` pero el envío falla y queda registrado.
- Quedó un enlace abierto en la base de desarrollo, de `a06.alumno.mi.cuenta` (el del `422`, que no se gasta): vence solo a los 30 minutos.

### 9.5. Lo que deja hecho para las HU siguientes

- **Cierra el criterio 4 de HU-A-06** («Mi cuenta» con el enlace de recuperación).
- **`recuperacion.tarea.ts` y `programarProcesamientoRecuperacion`:** patrón para cualquier trabajo posterior a la respuesta con `after()`, probado con el mock de `next/server`.
- **`tarjeta-sesion-publica.tsx`:** tarjeta centrada con la marca, reutilizable por otras pantallas públicas.
- **Status `410`** admitido en el catálogo de `errores-dominio.ts`.
- **Envío con Resend real:** pendiente de probar cuando haya `RESEND_API_KEY` y dominio verificado; con el simulador el enlace sale en la consola de `next dev`.
