# HU-A-05 — Evidencia de implementación y validación

Task: [HU-A-05](../tasks/Sprint%203/Modulo%20A/HU-A-05.md). Contrato: [Módulo A](../specs/spec_modulo_A.md) §2.7, §2.9, §3.9 a §3.13 y §4 (y su «Nota de implementación HU-A-05»).

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*`, creada y borrada por el script).
- **Fixture:** `prisma/seed/fixtures/hu-a-05.ts`, corrida dos veces con `npx prisma db seed` sobre la base de desarrollo. La segunda corrida no cambió ninguna fila de `tokens_recuperacion`.
- **Nivel 2 (pedidos HTTP):** curl contra `next dev` local y la base de desarrollo, por Claude Code a pedido del responsable. El `.env` local no tiene `NEXTAUTH_URL` ni `AUTH_URL`, así que el servidor se levantó con `NEXTAUTH_URL=http://localhost:3000` solo para ese proceso: sin una URL pública cada envío habría sido un envío fallido (decisión 7). El email lo escribió el simulador en la consola del servidor; de ahí se tomó cada enlace. Los encabezados se verificaron además con `next build` + `next start`.
- **Nivel 3 (pantallas y SQL):** recorrido de pantallas en Chrome (Claude in Chrome) contra el mismo `next dev`, y consultas `SELECT` contra la base de desarrollo. No se adjuntan capturas, cookies, enlaces vigentes ni contraseñas.

## Criterios de aceptación (backlog, HU-A-05)

1. La pantalla de acceso (HU-A-01) ofrece “¿Olvidaste tu contraseña?”, que pide el email.
2. Exista o no una cuenta con ese email, se muestra siempre el mismo mensaje: “Si el email corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña”. Si la cuenta existe y está activa, el sistema envía automáticamente el email con el enlace mediante el servicio de envío de emails (criterio 7); nadie del centro interviene. Las cuentas inactivas no reciben el enlace. El email se envía fuera de la respuesta, para que el tiempo de respuesta no revele si la cuenta existe.
3. El enlace es de un solo uso, vence a los 30 minutos y se guarda solo su hash; pedir un enlace nuevo invalida el anterior. Si el enlace venció o ya se usó, se muestra “El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?”. Usar el enlace es una operación condicional (Regla N.° 7): dos envíos simultáneos del mismo enlace no pueden confirmarse los dos.
4. La nueva contraseña cumple la política vigente, se confirma dos veces y no puede ser igual a la anterior.
5. Al cambiarla se cierran todas las sesiones abiertas de la cuenta (RNF-SEG-04) y se dirige a la pantalla de acceso con “Tu contraseña se actualizó. Iniciá sesión con la nueva contraseña.”. Si la cuenta todavía debía cambiar la contraseña inicial (HU-A-06, criterio 3), al definir la nueva por este camino también se quita esa marca.
6. Se admiten como máximo 3 solicitudes por email por hora (RNF-SEG-06), y cada solicitud y cambio se registra como evento de seguridad (RNF-SEG-09).
7. Envío del email: el servidor lo envía desde un servicio de envío de emails propio del sistema, no desde la pantalla (simulador o Resend; asunto, saludo, enlace, aviso de 30 minutos y un solo uso, «Si no pediste este cambio, ignorá este email»; si el proveedor falla, mismo mensaje, evento y enlace invalidado).

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1 | `login-form.test.tsx` (enlace a `/recuperar-contrasena`); recorrido: el login muestra «¿Olvidaste tu contraseña?» debajo de la contraseña y lleva a la pantalla que pide el email | 1 y 3 | Verificado (test automatizado y recorrido) |
| 1 (desde «Mi cuenta», cierra el criterio 4 de HU-A-06) | `primer-ingreso/page.test.tsx` («ofrece «¿Olvidaste tu contraseña?» hacia /recuperar-contrasena», con `LinkProtegido`) | 1 | Verificado (test automatizado) |
| 2 | `recuperar-password/route.test.ts` (200 uniforme también limitada; `after()` solo si entró); `recuperacion.service.test.ts` (no busca la cuenta antes de responder); `recuperacion.service.pg.test.ts` (inexistente e inactiva: solo el evento, ni enlace ni email); `actions.test.ts`; `recuperar-password-form.test.tsx` (pasa a «Revisá tu email»); Nivel 2: pedidos 1 a 4; recorrido de pantallas | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 3 | `recuperacion.service.pg.test.ts` (solo el hash, 30 minutos, pedir otro invalida el anterior, vencido, usado e inexistente → 410, dos confirmaciones simultáneas: una gana); `restablecer-contrasena/page.test.tsx` y `restablecer-password-form.test.tsx` (mensaje del enlace inválido al abrir y ante un 410); Nivel 2: pedidos 5 a 7; Nivel 3: consulta 3.2 y recorrido (enlace reutilizado → «Enlace no válido») | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 4 | `sesion.schema.test.ts` (política, confirmación); `recuperacion.service.pg.test.ts` («igual a la vigente → 422 y se deshace todo: el enlace sigue sirviendo», «política o confirmación distinta → 400 sin gastar el enlace»); `restablecer-password/route.test.ts`; `restablecer-password-form.test.tsx`; Nivel 2: pedidos 8 y 9; recorrido (confirmación distinta y 422 junto al campo) | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 5 | `recuperacion.service.pg.test.ts` («quita la marca, cierra las sesiones, invalida los otros enlaces…»); `restablecer-password-form.test.tsx` (logout y `/login?contrasena=actualizada`, también si el logout falla); recorrido con la cuenta marcada 88060011: restablecer → login con el aviso → ingresa con la nueva y llega a `/home`, no a `/primer-ingreso`; Nivel 3: consultas 3.1 y 3.4 | 1 y 3 | Verificado (test automatizado y ejecución) |
| 6 | `recuperacion.service.pg.test.ts` («cuatro pedidos simultáneos del mismo email: entran tres…», ventana de una hora, 409 si el bloqueo se agota); Nivel 2: pedidos 10 a 13; Nivel 3: consultas 3.1 y 3.3 | 1, 2 y 3 | Verificado (test automatizado y ejecución) |
| 7 | `recuperacion.service.test.ts` (asunto, saludo con el nombre, enlace en el texto, aviso de 30 minutos, frase final, HTML escapado; envío fallido, sin URL pública y error al armar el email → enlace invalidado, `RECUPERACION_ENVIO_FALLIDO`, log sin enlace); `recuperacion.service.pg.test.ts` («sin URL pública…»); Nivel 2: el email del simulador del pedido 1 | 1 y 2 | Verificado (test automatizado y ejecución). Resend real no se probó: no es requisito (decisión del PO) |

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npm test`) | 2730 pasan, 294 omitidos por guarda, 0 fallan (221 archivos pasan, 45 omitidos) |
| `recuperacion.service.test.ts` | 27 |
| `recuperacion.service.pg.test.ts` (PostgreSQL real) | 12, todas pasan |
| `sesion.schema.test.ts` (12 de HU-A-06 más 19 de HU-A-05) | 31 |
| `src/server/sesion/actions.test.ts` (17 de HU-A-06 más 13 de HU-A-05) | 30 |
| Rutas: `api/auth/recuperar-password/route.test.ts` y `api/auth/restablecer-password/route.test.ts` | 9 y 10 |
| `next.config.test.ts` | 3 |
| Pantallas: `recuperar-password-form.test.tsx`, `restablecer-contrasena/page.test.tsx`, `restablecer-password-form.test.tsx`, `login-form.test.tsx` | 7, 6, 10 y 2 |
| `primer-ingreso/page.test.tsx` (5 de HU-A-06 más 1) y `rutas-por-rol.test.ts` (17 previos más 6) | 6 y 23 |
| `errores-dominio.test.ts` (prueba de claves, incluye las dos claves nuevas) | 13 |
| `npm run test:pg` completo | 258 pasan, 34 omitidas, 2 fallan, de HU-E-10 y HU-H-03 (ver «Observaciones conocidas») |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| `next build` | Compila; `/recuperar-contrasena` queda estática y `/restablecer-contrasena` dinámica |

### Fixture

| Enlace | Valor (solo se guarda su hash) | Cuenta | Estado | Resultado esperado |
|---|---|---|---|---|
| Vencido | `hu-a-05-enlace-vencido-demo-0001` | `a06.profesor.primer.ingreso@noctium.local` | Venció el 01/01/2026 03:00 UTC, nunca usado | 410 |
| Usado | `hu-a-05-enlace-usado-demo-0002` | la misma | Consumido el 01/01/2026, vence en 2099 | 410 |

Son de la cuenta del profesor de A-06 porque el recorrido no la usa: pedir un enlace para otra cuenta no los toca. Los escenarios reutilizan las cuentas de la fixture de A-06.

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Encabezado `x-forwarded-for: 10.55.0.1` en los pedidos de curl; los de las pantallas quedaron con IP `::1`.

| # | Pedido | Cuerpo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | `POST /api/auth/recuperar-password` | `{"email":"a06.alumno.mi.cuenta@noctium.local"}` (activa) | 200 `{ solicitada: true }` y email en la consola | OK. 200 `{"data":{"solicitada":true},"error":null}`. El simulador escribió «Restablecé tu contraseña de Noctium», «Hola, Tercera Prueba A06:», el enlace `http://localhost:3000/restablecer-contrasena?token=…`, «El enlace vence a los 30 minutos y es de un solo uso.» y «Si no pediste este cambio, ignorá este email.» |
| 2 | ídem | `{"email":"a05.inexistente@noctium.local"}` | El mismo 200 y el mismo cuerpo | OK. Idéntico al pedido 1; sin email |
| 3 | ídem | `{"email":"a06.alumno.inactivo@noctium.local"}` (inactiva) | El mismo 200 y el mismo cuerpo | OK. Idéntico al pedido 1; sin email |
| 4 | ídem | `{"email":"Ana@"}` | 400 `VALIDATION_ERROR` | OK. 400, `detalles.email`: «Ingresá un email válido, por ejemplo nombre@dominio.com.» |
| 5 | `POST /api/auth/restablecer-password` | Enlace ya usado en el recorrido de pantallas | 410 `ENLACE_INVALIDO` | OK. 410, «El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?» |
| 6 | ídem | `token: hu-a-05-enlace-vencido-demo-0001` | 410 | OK. 410 `ENLACE_INVALIDO` |
| 7 | ídem | `token: hu-a-05-enlace-usado-demo-0002` | 410 | OK. 410 `ENLACE_INVALIDO` |
| 8 | ídem | Enlace nuevo de `a06.alumno.mi.cuenta` con la contraseña vigente | 422 `PASSWORD_IGUAL_A_ACTUAL`, sin gastar el enlace | OK. 422, «La contraseña nueva no puede ser igual a la anterior»; la página con ese enlace sigue mostrando el formulario |
| 9 | ídem | El mismo enlace con `"corta"` | 400 `VALIDATION_ERROR` sin gastar el enlace | OK. 400 con los errores de la política en `detalles.password_nueva` |
| 10 a 13 | `POST /api/auth/recuperar-password` ×4 | `{"email":"a05.limite@noctium.local"}` | Cuatro 200 iguales; el cuarto registra `RECUPERACION_LIMITADA` | OK. Cuatro 200 idénticos; 3 solicitudes y 1 `RECUPERACION_LIMITADA` (consulta 3.3) |
| 14 | `curl -I /restablecer-contrasena` (`next start`) | — | `Referrer-Policy: no-referrer`, `Cache-Control: no-store` | OK. `Referrer-Policy: no-referrer`, `Cache-Control: no-store, must-revalidate` (con y sin `?token=`) |
| 15 | `curl -I /recuperar-contrasena` (`next start`) | — | `Cache-Control: no-store` | OK. `Cache-Control: no-store, must-revalidate` |
| 16 | `POST` a las dos rutas de API | — | `Cache-Control: no-store, must-revalidate` | OK, también en los errores |

**Encabezados en `next dev`:** Next pisa el `Cache-Control` de `next.config.ts` y responde `no-cache, must-revalidate` en las dos pantallas. `Referrer-Policy` llega igual. En producción (`next build` + `next start`, pedidos 14 y 15) llega el valor configurado, `no-store, must-revalidate`. Como referencia, `/login` en producción responde el `Cache-Control` propio de Next para páginas dinámicas (`private, no-cache, no-store, max-age=0, must-revalidate`).

## Nivel 3 — Recorrido de pantallas y SQL

### Recorrido (Chrome, `next dev`)

1. **Flujo 1, `a06.alumno.mi.cuenta`** (enlace del pedido 1): `/restablecer-contrasena?token=…` muestra la tarjeta «Definí una contraseña nueva», el aviso de «anterior», «Contraseña nueva» con la ayuda de la política real, «Confirmación» y «Guardar contraseña». Con una confirmación distinta, «Las contraseñas no coinciden» junto al campo y sin diálogo. Con datos válidos, la confirmación «¿Estás seguro de que querés cambiar tu contraseña?» con «Volver» y «Cambiar contraseña». Al confirmar (contraseña temporal), redirige a `/login?contrasena=actualizada` con el aviso «Tu contraseña se actualizó. Iniciá sesión con la nueva contraseña.».
2. **El mismo enlace otra vez:** «Enlace no válido», el mensaje del criterio 3, «Pedir un enlace nuevo» y «Volver a iniciar sesión».
3. **Flujo 2, devolver la contraseña de la fixture:** «Pedir un enlace nuevo» → `/recuperar-contrasena` (figura 88). Con `nombre@`, el error del email junto al campo. Con el email de la cuenta, la tarjeta pasa a «Revisá tu email» (figura 89), con la alerta de éxito y la nota de 30 minutos. Con el enlace nuevo, guardar la contraseña temporal (la vigente) muestra «La contraseña nueva no puede ser igual a la anterior» junto al campo. Con el mismo enlace se guarda `Password123!` (la de las cuentas del seed y de la fixture de A-06) y redirige al login con el aviso. **`a06.alumno.mi.cuenta` quedó con la contraseña de la fixture**: la que tenía antes, distinta y desconocida (cambiada en el recorrido de A-06), no se conserva.
4. **Criterio 5:** `a06.alumno.primer.ingreso` ya no tenía la marca (hizo el primer ingreso en el recorrido de A-06). Se usó la cuenta 88060011 (`a06.postman.alumno.nuevo@noctium.local`, creada en el Nivel 2 de A-06, con la marca y el DNI como contraseña). Restablecer → login con el aviso → ingreso con la contraseña nueva (`Recupero2026A`) → llega a `/home` («Buenas noches, Ana Postman», rol Alumno), sin pasar por `/primer-ingreso`. Se cerró la sesión al terminar.

### SQL

| # | Consulta | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `SELECT "emailSolicitud", count(*) FROM solicitudes_recuperacion GROUP BY 1;` | Una fila por solicitud que entró, máximo 3 por email | OK. `a05.inexistente` 1, `a05.limite` 3, `a06.alumno.inactivo` 1, `a06.alumno.mi.cuenta` 3, `a06.postman.alumno.nuevo` 1 |
| 3.2 | `SELECT u."emailUsuario", length("tokenHashRecuperacion"), "tokenHashRecuperacion" ~ '^[0-9a-f]{64}$', "venceEnToken" - "creadoEnToken", "consumidoEnToken" IS NOT NULL FROM tokens_recuperacion t JOIN usuarios u ON …;` | Solo hashes de 64 caracteres hex; 30 minutos; consumido al usar o invalidar | OK. 6 filas, todas hash hex de 64. Las 2 de la fixture (vencido sin consumir; usado). `a06.alumno.mi.cuenta`: 3 enlaces, 30 minutos cada uno, 2 consumidos (los dos restablecimientos) y 1 abierto, el del 422 del pedido 8, que vence solo a los 30 minutos. `a06.postman.alumno.nuevo`: 1, consumido |
| 3.3 | `SELECT "tipoEvento", "usuarioId" IS NOT NULL, "emailEvento", "ipEvento", count(*) FROM eventos_seguridad WHERE "tipoEvento"::text LIKE 'RECUPERACION%' GROUP BY …;` | Cada solicitud que entra es un `RECUPERACION_SOLICITADA` (sin `usuarioId` si no hay cuenta); la cuarta, `RECUPERACION_LIMITADA` sin `usuarioId`; cada restablecimiento, `RECUPERACION_CONFIRMADA` | OK. `SOLICITADA`: `a05.inexistente` 1 y `a05.limite` 3 sin `usuarioId`; `a06.alumno.inactivo` 1, `a06.alumno.mi.cuenta` 3 y `a06.postman.alumno.nuevo` 1 con `usuarioId`. `LIMITADA`: `a05.limite` 1, sin `usuarioId`. `CONFIRMADA`: `a06.alumno.mi.cuenta` 2 y `a06.postman.alumno.nuevo` 1. Ningún `ENVIO_FALLIDO` (el envío por el simulador no falló) |
| 3.4 | `usuarios` de las dos cuentas restablecidas | Hash nuevo, sin la marca y `sesionesValidasDesdeUsuario` avanzado | OK. `a06.alumno.mi.cuenta` con `Password123!` (bcrypt) y `sesionesValidasDesdeUsuario` 2026-10-11 02:16:38 UTC; `a06.postman.alumno.nuevo` sin la marca, sin el DNI como contraseña y con `sesionesValidasDesdeUsuario` 2026-10-11 02:18:05 UTC |
| 3.5 | Búsqueda de los 4 enlaces enviados y de las contraseñas usadas en `eventos_seguridad`, `tokens_recuperacion` y `solicitudes_recuperacion` | Ninguna coincidencia | OK. Ninguna |

Filas extra que quedaron por el recorrido: un `LOGIN_FALLIDO` (con su `IntentoLoginFallido`) de `a06.alumno.mi.cuenta`, porque en el criterio 5 el autocompletado de Chrome dejó ese email en el login en el primer intento.

## Capturas

No se adjuntan capturas. El recorrido de pantallas queda descripto en el Nivel 3.

## Observaciones conocidas

- `npm run test:pg` tiene 2 fallas preexistentes de otras HU: HU-E-10 (`resultado-examen.service.pg.test.ts`, `SIN_PERMISO` en el historial) y HU-H-03 (`clases.service.pg.test.ts`, sin clases `COMPLETO`). La de HU-H-10 que registró A-06 ya no falla.
- El `.env` de desarrollo no tiene `NEXTAUTH_URL` ni `AUTH_URL` (`.env.example` sí la documenta). Sin ella cada pedido de una cuenta activa termina en `RECUPERACION_ENVIO_FALLIDO`; para la demostración hay que cargarla.
- En `next dev`, lo que se escribe en el formulario antes de que la página termine de hidratarse se pierde (en el recorrido pasó dos veces): hay que volver a escribirlo. No pasó con la página ya cargada.
- Sin limpieza de enlaces ni de solicitudes vencidas (P-A12), igual que `TokenRevocado`.
- `/home` sigue usando `auth()` sin mirar la revocación de la sesión (deuda de HU-A-06); el formulario de restablecer lo resuelve cerrando la sesión antes de ir al login.
