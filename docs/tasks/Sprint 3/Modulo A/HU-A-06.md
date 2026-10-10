# TASK: HU-A-06 — Crear la cuenta de acceso al registrar a una persona

**Módulo:** A (Sesión), con la parte de B (alumno) y de D (profesor) que la spec le asigna a esta HU · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 5
**Contrato de referencia:** `docs/specs/spec_modulo_A.md` §2.6 (HU-A-06), §2.8.2 (`cuenta:cambiar_password`), §2.9 (servicios de cuenta), §3.6 a §3.8, §3.11 a §3.13 y §4 (eventos) · `docs/specs/spec_modulo_B.md` §2.9 (alta del alumno con cuenta; notas en §2.2 y §2.5) · `docs/specs/spec_modulo_D.md` §2.9 (alta del profesor con cuenta y email sincronizado) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-A-06, criterios 1 a 9) · `docs/tasks/Sprint 3/PR-0.md` §1.1, §2.7, §2.9 y decisiones 5.4
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figuras 85 (alta de profesor), 86 (ficha con «Cuenta de acceso») y 87 (primer ingreso). Las capturas son orientativas: ante cualquier diferencia prevalece el backlog.
**RBAC:** `cuenta:cambiar_password` (los cuatro roles) **ya está** en la migración `20261008120200_sprint3_permisos` y en `seed.ts`. No se crea ningún permiso. Los permisos de las altas no cambian (`alumnos:crear`, `profesores:crear`).
**Schema:** ya completo, sin migración (`debeCambiarPasswordUsuario`, `sesionesValidasDesdeUsuario`, eventos `CUENTA_CREADA` y `PASSWORD_CAMBIADA`). Si el relevamiento encuentra algo que falte, se coordina con el responsable del PR 0: esta HU no agrega migraciones.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:

- **Archivos nuevos a crear** (ruta exacta, uno por uno). Punto de partida propuesto, a corregir contra el repo:
  - `src/server/sesion/cambio-password.service.ts` (`cambiarPasswordPropia`) y sus tests (`.test.ts` y `.pg.test.ts`).
  - Página `/primer-ingreso` y página `/mi-cuenta`, más un formulario compartido en `src/components/sesion/` (Regla N.° 11: en `src/app/**` solo `page.tsx`, `layout.tsx` y componentes propios de la ruta).
  - Tarjeta «Cuenta de acceso» reutilizable (propuesta: `src/components/shared/`), para la ficha del alumno y la del profesor (y más adelante F y G).
  - `prisma/seed/fixtures/hu-a-06.ts` y una línea en `prisma/seed/fixtures/index.ts` (sin editar `seed.ts`).
  - `docs/testing/HU-A-06-evidencia.md`.
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno). Se esperan al menos: `src/server/shared/with-permission.ts`, `src/auth.ts`, `src/proxy.ts`, `src/server/shared/rutas-por-rol.ts`, `src/types/next-auth.d.ts`, `src/server/sesion/sesion.schema.ts`, `src/server/sesion/actions.ts`, `src/types/sesion.types.ts`, `src/lib/textos.ts`, `src/components/layout/Navbar.tsx`, `src/server/alumnos/alumno.service.ts` y su schema/ruta/action/formulario de alta, `src/server/profesores/profesor.service.ts` y su ruta/action/wizard de alta, los servicios y pantallas de cambio de contacto de alumno y profesor, las fichas de ambos, `docs/RULES.md` y `docs/specs/spec_modulo_A.md` (nota aditiva, ver sección 7).
- Todo punto marcado **«relevar antes de asumir»**, con la pregunta concreta (nunca resuelto por inferencia propia del agente):
  1. **Dónde vive `/primer-ingreso`.** La spec pide «sin menú lateral ni otra opción», pero `src/app/(dashboard)/layout.tsx` monta siempre Sidebar y Navbar. Propuesta: un route group aparte, fuera de `(dashboard)`, con su propio layout mínimo (título, formulario y «Cerrar sesión»). `/mi-cuenta` sí va dentro de `(dashboard)`. ¿Confirma o hay una opción mejor?
  2. **Entrada con la marca activa.** `iniciarSesion` redirige siempre a `/home`, y `/home` no está en el `matcher` de `src/proxy.ts`. Reportar qué pasa hoy al ingresar con la marca y proponer cómo se garantiza «antes de cualquier otra pantalla» (propuesta: `iniciarSesion` redirige a `/primer-ingreso` cuando la cuenta tiene la marca, y la página de `/home` usa `exigirPermiso`).
  3. **Dos `verificarEmailNoAsociadoAOtraCuenta` con firma distinta.** La de `usuario.service.ts` (la usa `profesor.service.ts` con `(tx, email, null)`) y la de `cuenta.service.ts` (`(email, { excluirUsuarioId }, db)`). Reportar quién usa cada una y cuál se llama en cada alta/edición. Por la regla de compatibilidad (PR-0.md §1.1) la de Sprint 2 **no cambia de firma**.
  4. **Carrera por email en `crearCuentaParaFicha` y `cambiarEmailCuenta`.** La implementación del PR 0 verifica con `findFirst` y captura `P2002`; la spec (§2.6.1 paso 3 y §3.12) pide `INSERT … ON CONFLICT ("emailUsuario") DO NOTHING RETURNING` sin capturar `P2002` dentro de la transacción. Además `emailUsuario` es `@unique` sensible a mayúsculas, mientras la verificación compara sin distinguirlas. Reportar el resultado actual del test de concurrencia en `cuenta.service.pg.test.ts` y proponer: alinear con 3.12 (propuesta por defecto) o conservar lo hecho.
  5. **`actualizarEmailCuenta` no existe en el código** (la spec A §2.5 la da por existente; el comentario de `alumno.service.ts` lo confirma, y hoy el cambio de email de un alumno con cuenta se rechaza). Reportar el estado real de HU-B-02 y HU-B-06 y proponer que ambas llamen a `cambiarEmailCuenta` (spec A T2), indicando qué tests de Sprint 1 y 2 cambian y por qué (criterio 6).
  6. **Errores de dominio.** Cómo se traducen las claves de `ErrorDeDominio` (`errores.cuenta.*`) a los `code` de la spec (`EMAIL_YA_ASOCIADO`, `PASSWORD_ACTUAL_INCORRECTA`, `PASSWORD_IGUAL_A_ACTUAL`, `RATE_LIMIT_EXCEDIDO`, `TRANSACCION_OCUPADA`) en las rutas y acciones, y cuáles claves nuevas hay que sumar a `src/lib/textos.ts`.
  7. **Tests que usan el `withPermission` real.** Listar los que mockean `prisma` sin mockear `with-permission` (a esos hay que sumarles `usuario`); los tests que mockean el módulo entero no se tocan. Ningún test de Sprint 1 y 2 se borra ni se debilita.
  8. **Textos de P-04 y P-05.** `docs/adicionales/mapa-pantallas-sprint-3.md` **no está en el repo**; los textos salen de la spec A §2.6.6 y de los criterios del backlog. Confirmar que alcanza, o pedir el archivo.
  9. **`politicaPasswordSchema` es una fábrica** (`politicaPasswordSchema(longitudMinima)`, con `password_longitud_minima` de `ParametroSistema`), no un valor. Confirmar que `CambiarPasswordSchema` se arma igual que en el autorregistro.
  10. **Prototipo.** El PDF no está en el repo. Confirmar que se puede consultar (figuras 85 a 87) y reportar cualquier diferencia entre el prototipo y la spec que no esté listada en la sección 5.
  11. **Feedback de cada pantalla (`docs/DESIGN.md` §6.4).** Una HU que no está en la tabla define su feedback con el criterio de §6.1 a §6.3 y lo agrega a la tabla **antes** de implementar. Propuesta para esta HU: `/primer-ingreso` = página completa + `ConfirmarAccionDialog`, y al terminar navega a la pantalla inicial del rol con un banner «Tu contraseña se actualizó. Ya podés usar el sistema.» (mismo patrón que HU-C-20); `/mi-cuenta` = página completa + `ConfirmarAccionDialog`, banner inline «Tu contraseña se actualizó.»; altas de alumno y profesor = banner inline (patrón de Sprint 1). Reportar si el banner de destino necesita un parámetro en la URL y en qué pantallas inicia cada rol, y confirmar o corregir la propuesta.
  12. **Textos (`docs/DESIGN.md` §9).** Todo texto visible sale de `src/lib/textos.ts` con `texto(clave)` y se verifica con `scripts/verificar-claves-textos.ts`. Hoy `textos.ts` no tiene claves de sesión ni de cuenta de acceso (solo `errores.cuenta.*`). Proponer el prefijo de las claves nuevas (`ui.<modulo>.<grupo>.<nombre>`) y cómo se pasa el verificador.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

---

## 1. Nota de alcance

La spec reparte los 5 SP de HU-A-06 en tres bloques, todos de esta task:

- **Bloque A, sesión en el servidor** (spec A §2.6.2, §3.6, §3.7): `withPermission`, `verificarPermiso` y `exigirPermiso` rechazan cuentas inactivas y sesiones revocadas por cuenta, y con la marca solo admiten `sesion:ping` y `cuenta:cambiar_password`; el callback `jwt` copia la marca al token; el proxy redirige a `/primer-ingreso`. El PR 0 reducido no lo hizo (PR-0.md, «Lo que cae a cada HU»).
- **Bloque B, cambio de contraseña** (spec A §2.6.3, §2.6.6): primer ingreso y «Mi cuenta», con reemisión de la sesión.
- **Bloque C, altas con cuenta** (spec B §2.9, spec D §2.9): el alta de alumno y de profesor crea la cuenta con `crearCuentaParaFicha` (PR 0, ya escrita) en la misma transacción; el email de la ficha con cuenta es el de la cuenta; la ficha muestra «Cuenta de acceso».

Los servicios de cuentas (`crearCuentaParaFicha`, `cambiarEmailCuenta`, `desactivarCuenta`, `reactivarCuenta`, `revocarSesiones`, `cambiarPassword`, `obtenerEstadoCuenta`, `obtenerResumenCuenta`, `filtrarCuentasActivas`) **ya existen** en `src/server/usuarios/cuenta.service.ts`. Esta task los usa y solo los modifica si el relevamiento (punto 4) lo confirma.

**Decisiones resueltas (no relevar de nuevo):**
- Reemisión de la sesión: Server Action con `signIn("credentials", …)` y la contraseña nueva, desde el servidor (P-A1). La rama `update` del callback `jwt` no copia nada que mande el cliente.
- La marca llega al token por el callback `jwt` (rama de ingreso) con `obtenerEstadoCuenta`; `verificarCredenciales` no cambia su resultado (P-A5). El proxy decide con el token; el servidor, con la base.
- Con la marca solo pasan `sesion:ping`, `cuenta:cambiar_password` y el cierre de sesión (P-A6). Un solo permiso para primer ingreso y «Mi cuenta» (P-A7).
- El primer ingreso no pide la contraseña actual; «Mi cuenta» sí, y sus fallos cuentan para el límite del login (P-A9). Política = `politicaPasswordSchema`, sin reglas nuevas (P-A10).
- Rutas: `/primer-ingreso` y `/mi-cuenta` (P-A11).
- Los servidores **no rechazan** el alta de alumno ni de profesor sin `email` (contrato de Sprint 1 y 2): la pantalla lo exige y, con `email`, la cuenta es obligatoria. Sin `email` la ficha queda «Sin cuenta» (spec B P-B1, spec D P-D1).
- No se crean cuentas retroactivas: modificar una ficha anterior, aunque se le cargue un email, no crea su cuenta (criterio 8).

**Fuera de alcance de esta task (explícito):**
- Recuperación de contraseña (HU-A-05): `/recuperar-contrasena`, `/restablecer-contrasena`, enlaces, simulador de email y sus tablas. El enlace «¿Olvidaste tu contraseña?» de «Mi cuenta» lo agrega HU-A-05, para no dejar un enlace roto.
- Alta y edición de integrantes de mesa de entrada y de gerentes (HU-F-01, HU-G-01): ahí el servidor sí exige `email`. El criterio 1 se verifica con ellos más adelante.
- Desactivar y reactivar fichas y cuentas desde la pantalla (HU-D-08, HU-B-07, HU-F-05, HU-G-05). Los servicios ya existen; el criterio 7 se verifica cuando estén esas HU.
- Autorregistro del alumno (HU-B-08): no cambia, y su cuenta no lleva la marca.
- Migrar o crear cuentas para fichas anteriores; autenticación de dos factores.
- El archivo central de textos definitivo (HU-C-23): acá solo se suman las claves que esta HU usa.
- Limpieza de tokens revocados (deuda conocida, P-A12).

---

## 2. Historia de Usuario

**Como** gerente o personal de mesa de entrada (quien registra a la persona)
**Necesito** que al registrar a un gerente, un integrante de mesa de entrada, un profesor o un alumno el sistema le cree automáticamente su cuenta de acceso con su email y su DNI como contraseña inicial
**Para** que cada persona pueda ingresar desde el primer día con su propio usuario y rol, sin un paso aparte para crear la cuenta

**SP estimado:** 5

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_A.md` §2.6 y a las secciones de B y D indicadas arriba. Incluye:
- Servicio `cambiarPasswordPropia` (`src/server/sesion/cambio-password.service.ts`), que usa `cambiarPassword` del PR 0.
- Cambios en `with-permission.ts`, `auth.ts`, `proxy.ts`, `rutas-por-rol.ts` y los tipos del token.
- Server Action `cambiarPasswordPropia` en `src/server/sesion/actions.ts` (sin Route Handler: la reemisión exige escribir la cookie).
- Schemas Zod: `CambiarPasswordSchema` y `RegistrarAlumnoSchema`.
- Altas de alumno (`POST /api/alumnos`) y de profesor (`POST /api/profesores`) con cuenta, y sincronización del email de la ficha con la cuenta (B-02, B-06, D-02, D-06).
- Eventos de seguridad `CUENTA_CREADA`, `PASSWORD_CAMBIADA` y el `LOGIN_EXITOSO` de la reemisión.
- UI: `/primer-ingreso`, `/mi-cuenta`, «Mi cuenta» en el bloque del usuario, campo Email obligatorio en las altas, aviso al cambiar el email, y la sección «Cuenta de acceso» en las fichas.
- Fixtures, rutas por rol y reglas en `RULES.md`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): lo listado en la sección 1.

---

## 4. Contrato Backend

### 4.1. Schemas Zod

- `src/server/sesion/sesion.schema.ts` (se agrega; no se modifica nada existente): `CambiarPasswordSchema` como en spec A §2.6.3, armado con la fábrica `politicaPasswordSchema(passwordLongitudMinima)`. `password_actual` opcional en el esquema; el servicio la exige cuando la cuenta no tiene la marca.
- `src/server/alumnos/alumno.schema.ts`: `RegistrarAlumnoSchema` como en spec B §2.9 (`IdentidadAlumnoSchema` no se modifica; `email` y `telefono` opcionales).
- El schema de alta de profesor ya admite `email` y `telefono` opcionales: no cambia.

### 4.2. Servicio de cambio de contraseña

**Archivo:** `src/server/sesion/cambio-password.service.ts`
**Función:** `cambiarPasswordPropia(input, usuarioId, ip): Promise<{ cambiada: true; reemitir_sesion: boolean }>`

Comportamiento exigido, en este orden (detalle en spec A §2.6.3):
1. La cuenta sale de la sesión, nunca de un parámetro. Se verifica el permiso `cuenta:cambiar_password` con `verificarPermiso` (no renueva la cookie).
2. Validar con `CambiarPasswordSchema` (Regla N.° 6).
3. Límite de intentos del login (spec A §3.3) con email e IP, **antes** de comparar la actual.
4. Sin la marca: `password_actual` obligatoria y `bcrypt.compare`; si falla, fila en `IntentoLoginFallido` y `PASSWORD_ACTUAL_INCORRECTA`. Con la marca no se pide.
5. En una `transaccion` (PR 0): `FOR UPDATE` sobre la fila de la cuenta, nueva distinta del hash vigente (`PASSWORD_IGUAL_A_ACTUAL`; en el primer ingreso equivale a «distinta del DNI») y `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: true, ip })`.
6. **Después del commit**, la Server Action reemite la sesión con `signIn` (pasa por el login normal: `iat_sesion = ahora`, sin marca, más un `LOGIN_EXITOSO`).
7. Si la reemisión falla, el cambio ya está hecho: respuesta con `sesion_conservada: false` y la interfaz lleva a `/login` con el aviso de éxito.

**Errores de servicio:** `PASSWORD_ACTUAL_INCORRECTA` (422), `PASSWORD_IGUAL_A_ACTUAL` (422), `RATE_LIMIT_EXCEDIDO` (429), `TRANSACCION_OCUPADA` (409), `VALIDATION_ERROR` (400), `SESION_INVALIDA` (401), `SIN_PERMISO` (403).

### 4.3. Sesión en el servidor

**`src/server/shared/with-permission.ts`** (spec A §3.6, en este orden, sin alterar los pasos existentes): sesión válida → `jti` revocado → **nuevo** lectura de la cuenta por clave primaria (inexistente, inactiva o `iat_sesion` anterior a `sesionesValidasDesde` → `401 SESION_INVALIDA`; token sin `iat_sesion` con cuenta revocada también se rechaza) → **nuevo** marca activa (valor de la base) y acción distinta de `sesion:ping` y `cuenta:cambiar_password` → `403 DEBE_CAMBIAR_PASSWORD` («Tenés que cambiar tu contraseña para seguir») → permiso del rol. `PermisoError` suma ese `code`. `exigirPermiso` redirige a `/login` (`SESION_INVALIDA`), a `/primer-ingreso` (`DEBE_CAMBIAR_PASSWORD`) o a `/sin-permiso`. Toda respuesta conserva `Cache-Control: no-store`.
**`src/auth.ts`:** el callback `jwt` (rama de ingreso) llama a `obtenerEstadoCuenta` y copia `debeCambiarPassword`; la rama `update` no copia nada del cliente. Un token sin el claim vale `false`. Tipo del token ampliado en `src/types/next-auth.d.ts`.
**`src/proxy.ts` y `rutas-por-rol.ts`:** con la marca en el token, toda página protegida redirige a `/primer-ingreso`; quedan fuera `/primer-ingreso`, el cierre de sesión y las rutas públicas. Se suman `/primer-ingreso` (con sesión, única página que admite la marca) y `/mi-cuenta` (los cuatro roles). Las rutas públicas de recuperación las suma HU-A-05.

### 4.4. Altas con cuenta y email sincronizado

- **Alumno** (spec B §2.9) y **profesor** (spec D §2.9.1): con `email`, una única `transaccion` que revalida el DNI, llama a `crearCuentaParaFicha(tx, { email, dni, rol, ip })`, e inserta la ficha con `usuarioId`. El rol lo fija el servicio. `P2002` del DNI se captura **fuera** de la transacción y se traduce a `409 DNI_DUPLICADO`. La respuesta `201` suma `cuenta: { creada, debe_cambiar_password }` (sin `email`: `{ creada: false }`). Nunca se devuelve ni se registra el DNI como contraseña.
- **Cambio de email** (spec B §2.2 y §2.5; spec D §2.9.2): si la ficha tiene `usuarioId` y el email cambia, se llama a `cambiarEmailCuenta(tx, …)` en la misma transacción que la ficha; mismo email = no se revalida; no revoca sesiones; una ficha con cuenta no puede quedarse sin email; también vale para fichas inactivas.
- **Sección «Cuenta de acceso»:** la ficha la arma con `obtenerResumenCuenta(usuarioId)`: «Activa · debe cambiar la contraseña», «Activa», «Inactiva» o «Sin cuenta».

### 4.5. Trazabilidad

Módulo A usa la opción (b) de la Regla N.° 2: escritura directa en `EventoSeguridad`, sin event bus ni listeners (las secciones de eventos y `AuditLog` del template no aplican). `CUENTA_CREADA` va en la transacción de la ficha; `PASSWORD_CAMBIADA` en la del cambio. Ni DNI, ni contraseñas, ni hashes en eventos, logs ni respuestas (spec A §3.11).

---

## 5. Frontend

**Referencia visual (prototipo, figuras 85 a 87).** El frontend se arma con los patrones del prototipo y de `docs/DESIGN.md`:
- **Fig. 85, alta de profesor:** el campo Email es obligatorio, con la ayuda «Con él se crea la cuenta de acceso», y el teléfono figura como opcional.
- **Fig. 86, ficha:** tarjeta «Cuenta de acceso» con Estado (etiqueta «Activa · debe cambiar la contraseña»), Rol y Usuario (email), más una nota breve.
- **Fig. 87, primer ingreso:** tarjeta centrada con la marca, título «Primer ingreso», aviso de que hasta cambiar la contraseña no se puede usar otra pantalla, Contraseña, Confirmación y «Guardar y seguir».
- **Sin figura:** `/mi-cuenta` (criterio 4) y el alta de alumno. Se resuelven con los mismos patrones, sin inventar componentes nuevos.
- **Diferencias ya detectadas (el backlog y la spec prevalecen):** (1) el prototipo no muestra «Cerrar sesión» en el primer ingreso y la spec A §2.6.6 sí lo pide: se mantiene; (2) el prototipo muestra el alta de profesor en una sola pantalla y la real es el wizard de 3 pasos, con el email en el paso 1 (spec D §2.9.1); (3) la ayuda del prototipo dice «Al menos 8 caracteres, con letras y números», pero la política real exige además mayúscula y minúscula y toma la longitud de `password_longitud_minima`: el texto sale de la política real.

- **`/primer-ingreso`:** «Por seguridad, definí una contraseña nueva para seguir.», contraseña nueva con la ayuda de la política, confirmación, «Guardar y seguir» y «Cerrar sesión». Sin menú. Confirmación de HU-C-25 (`ConfirmarAccionDialog`): «¿Estás seguro de que querés cambiar tu contraseña?». Al terminar va a la pantalla inicial del rol con «Tu contraseña se actualizó. Ya podés usar el sistema.»; la interfaz muestra «La contraseña nueva no puede ser tu DNI» para `PASSWORD_IGUAL_A_ACTUAL`. Sin la marca, redirige a la pantalla inicial. Usa `exigirPermiso("cuenta:cambiar_password")`.
- **`/mi-cuenta`:** contraseña actual, nueva y confirmación; confirmación «¿Estás seguro de que querés cambiar tu contraseña? Se van a cerrar tus sesiones en otros dispositivos.»; éxito «Tu contraseña se actualizó.» con la sesión abierta. «Mi cuenta» se suma al bloque del usuario sin tocar el resto del menú.
- **Altas** (`/alumnos/nuevo`, paso 1 de `/profesores/nuevo`): campo Email obligatorio con la ayuda «Ingresá el email: con él se crea la cuenta de acceso», teléfono opcional, confirmación de HU-C-25 y mensaje de éxito «<Alumno|Profesor> registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.». `EMAIL_YA_ASOCIADO` junto al campo, sin revelar de quién.
- **Edición de contacto con cuenta:** aviso previo de que cambiar el email cambia también el usuario con el que ingresa, con la confirmación de HU-C-25.
- **Feedback (`docs/DESIGN.md` §6):** las dos pantallas de contraseña y las altas son páginas completas: el éxito se informa con banner inline o con la navegación con banner, nunca con toast ni con un modal informativo; la confirmación de HU-C-25 lleva el verbo de la acción («Cambiar contraseña»), no «Aceptar». Las filas de esta HU se agregan a la tabla §6.4 antes de implementar (punto 11 del relevamiento).
- **Textos (`docs/DESIGN.md` §9):** todo texto visible sale de `src/lib/textos.ts` con `texto(clave)`, incluidas etiquetas accesibles; los datos de negocio (email, rol) no son copy. Las claves nuevas pasan `scripts/verificar-claves-textos.ts`.
- Seguir `docs/DESIGN.md` (tokens de shadcn/ui; nunca hex ni la paleta por defecto de Tailwind).

**Fuera de alcance de frontend:** pantallas de recuperación, listados de personal y gerentes, y botones de desactivar o reactivar.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
Casos obligatorios de spec A §3.13, puntos 1 a 5, 7 y 8 (el 6 es de HU-A-05):
- `withPermission`, `verificarPermiso` y `exigirPermiso`: cuenta sin marca ni revocación idéntica a Sprint 2; cuenta inactiva → 401; `iat_sesion` anterior a `sesionesValidasDesde` → 401; con la marca solo pasan `sesion:ping` y `cuenta:cambiar_password` (resto `403 DEBE_CAMBIAR_PASSWORD`, la página redirige a `/primer-ingreso`); orden de los cinco pasos.
- Crear cuenta: rol y marca correctos, hash del DNI (nunca en claro), `EMAIL_YA_ASOCIADO` sin revelar de quién, dos altas simultáneas con el mismo email, y la ficha que no se crea si la cuenta falla.
- Primer ingreso y «Mi cuenta»: login con un DNI de 7 dígitos; la marca llega al token; el proxy redirige; el cambio quita la marca, deja viva la sesión actual y cierra las otras; contraseña actual incorrecta con el límite de intentos; nueva igual a la vigente y al DNI; política; un `update` del cliente no cambia `iat_sesion` ni la marca; reemisión fallida.
- Fichas: cambio de email (unicidad, sin revocar sesiones, mismo email sin revalidar, ficha con cuenta sin email); desactivar revoca y reactivar conserva la marca; `obtenerEstadoCuenta` no devuelve el hash.
- Datos sensibles: ni logs ni `EventoSeguridad` contienen contraseñas ni DNI.
- Matriz: `cuenta:cambiar_password` para los cuatro roles contra el seed ya corrido.
- Los tests de Sprint 1 y 2 de 2.1 a 2.3 y los de altas y contactos siguen pasando; solo se tocan los mocks de persistencia y los tres que fijan lo que el backlog manda cambiar (alta con `email`, independencia del email, rechazo del cambio de email del alumno con cuenta), cada uno anotado con su motivo.

### Nivel 2 — Postman
- `POST /api/alumnos` y `POST /api/profesores` con `email` → `201` con `cuenta.creada = true`; sin `email` → `201` con `cuenta.creada = false` (contrato de Sprint 1 y 2 intacto).
- Email en uso → `409 EMAIL_YA_ASOCIADO`; DNI repetido → `409 DNI_DUPLICADO`; email inválido → `400`.
- Cambio de contacto de una ficha con cuenta → `200`, y con email ajeno → `409`.
- Con la sesión marcada: cualquier endpoint protegido → `403 DEBE_CAMBIAR_PASSWORD`; `POST /api/auth/ping` → `200`.

### Nivel 3 — BD / TablePlus
- `usuarios`: `debeCambiarPasswordUsuario`, `sesionesValidasDesdeUsuario`, `activoUsuario` y que `passwordHashUsuario` no sea el DNI en claro, tras el alta, el cambio y el cambio de email.
- `eventos_seguridad`: `CUENTA_CREADA`, `PASSWORD_CAMBIADA` y `LOGIN_EXITOSO` con `usuarioId`, email e IP, sin datos sensibles.
- Fichas: `usuarioId` vinculado y email de la ficha igual al de la cuenta.

**Evidencia esperada:** Postman + SQL para el contrato de API y la capa de datos; capturas de `/primer-ingreso`, `/mi-cuenta`, las altas y la sección «Cuenta de acceso»; todo en `docs/testing/HU-A-06-evidencia.md`. Un criterio que no se pudo verificar se documenta como «Bloqueado» con su motivo.

**Verificaciones diferidas que le tocan a esta HU:** criterio 1 con el alta de integrantes (HU-F-01) y de gerentes (HU-G-01); criterio 7 con HU-F-05, HU-G-05 (y HU-D-08 y HU-B-07 cuando estén). Mientras tanto se prueba con altas de alumno y de profesor.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Servicio, Server Action y cambios de sesión implementados, sin lógica de negocio en la capa delgada (Regla N.° 4).
- [ ] Endpoints de alta responden con `{ data, error }` y códigos semánticos; la Server Action de cambio de contraseña usa el shape de `useActionState` (excepción de la Regla N.° 5).
- [ ] Eventos de seguridad escritos según spec A §4, sin datos sensibles.
- [ ] `/primer-ingreso`, `/mi-cuenta`, altas, aviso de email y sección «Cuenta de acceso» funcionando; el servidor rechaza todo lo demás con la marca activa.
- [ ] Ningún `DELETE` físico y ningún test de Sprint 1 y 2 borrado ni debilitado.
- [ ] Fixtures en `prisma/seed/fixtures/hu-a-06.ts` con su línea en el índice (cuentas con la marca para probar el primer ingreso, idempotentes), sin editar `seed.ts`.
- [ ] Rutas `/primer-ingreso` y `/mi-cuenta` en `rutas-por-rol.ts` y `proxy.ts`; reglas de sesión y de `exigirPermiso` en `RULES.md`.
- [ ] Filas de esta HU en `docs/DESIGN.md` §6.4 (y en su historial de cambios), y las claves de texto nuevas verificadas con `scripts/verificar-claves-textos.ts`.
- [ ] Nota aditiva en `spec_modulo_A.md`: los cambios de `withPermission`, del proxy y la reemisión los hace HU-A-06 y no el PR 0.
- [ ] `lint`, `tsc`, `npm test` y `npm run test:pg` en verde antes de pedir revisión.
- [ ] Tests de los 3 niveles documentados con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU.
