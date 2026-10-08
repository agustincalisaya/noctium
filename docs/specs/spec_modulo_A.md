```markdown
# Especificación Técnica — Módulo A (Sesión)
## Noctium — Sprint 1 · Sprint 2 · Sprint 3 (Revisión 3)
## Revisión 2 — Sprint 2: matriz RBAC única (§2.4) y servicios públicos de cuentas; sin HU nuevas en este módulo

## Revisión 3 — Sprint 3: cuenta de acceso automática con cambio obligatorio de la contraseña inicial (HU-A-06), recuperación de contraseña (HU-A-05) y matriz de permisos del sprint (08/10/2026)

**Fuente de verdad:** backlog definitivo del Sprint 3 (40 HU · 107 SP). **Referencias de esta revisión:** `PR-0.md` (§1.1 compatibilidad, §2.7 cuentas y sesiones, §2.9 permisos y rutas, §2.10, §2.11 variables de entorno, §2.13 servicio de cuentas, §2.14 esquema) · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-01 a P-05, DEC-01 a DEC-06) · `spec_modulo_B.md` (política de contraseña de HU-B-08, §2.6 y §2.8) · `spec_modulo_C.md`, `spec_modulo_E.md`, `spec_modulo_H.md` e `spec_modulo_I.md` (permisos nuevos que cada una propone).

**HU contractualizadas en esta revisión:**
| HU | SP | Qué agrega | Sección |
|---|---|---|---|
| HU-A-06 Crear la cuenta de acceso al registrar a una persona | 5 | Cuenta automática (email + DNI como contraseña inicial), marca «Debe cambiar la contraseña», pantalla de primer ingreso, «Mi cuenta», sincronización de email y de estado con la ficha | 2.6 |
| HU-A-05 Recuperar contraseña olvidada | 5 | Enlace de un solo uso por email (Resend), restablecer la contraseña, cierre de todas las sesiones | 2.7 |
| — (Regla N.° 10) | — | Matriz de permisos del Sprint 3 (cambios sobre 2.4) | 2.8 |
| — (Regla N.° 3) | — | Servicios públicos nuevos de cuentas y sesiones (complementan 2.5) | 2.9 |

HU-A-05 va inmediatamente después de HU-A-06, que crea las cuentas y la marca que HU-A-05 también quita. HU-A-01 a HU-A-03 (Sprint 1) **no se tocan**.

**Regla de esta revisión (instrucción del SM): nada de lo desarrollado en los Sprints 1 y 2 se rompe.** Esta revisión es aditiva. El único cambio de comportamiento sobre lo existente lo manda el backlog y ya está registrado en `PR-0.md` §1.1: `withPermission` pasa a rechazar, en cada solicitud, las cuentas inactivas y las sesiones revocadas por cuenta (T4).

**Cómo se verificó.** El repositorio revisado trae `src/server/shared/with-permission.ts` y `prisma/schema.prisma`; no trae `src/auth.ts`, `src/proxy.ts`, `src/server/sesion/*` ni `src/server/usuarios/*`. El contraste se hizo contra el `with-permission.ts` real, el esquema (`Usuario`, `TokenRevocado`, `EventoSeguridad`, `IntentoLoginFallido`, `TipoEventoSeguridad`), la Revisión 2 de esta spec, el PR 0 v19 (que cita `src/auth.ts` y `src/proxy.ts`), el mapa y el backlog. Lo que depende de esos archivos ausentes queda marcado «a confirmar contra el código».

**Compatibilidad con los Sprints 1 y 2 (revisada antes de entregar):**
| Elemento existente | Estado en Revisión 3 |
|---|---|
| 2.1 Iniciar sesión: `CredencialesLoginSchema`, pasos 1 a 8, orden (contraseña antes que estado), mensajes, códigos y eventos | **Sin cambios.** El login ya acepta cualquier contraseña de 1 carácter o más (`min(1)`), así que el ingreso con un DNI de 7 dígitos funciona sin tocar el schema (T12). El valor devuelto por `verificarCredenciales` **no cambia** (P-A5) |
| 2.2 JWT: `sub`, `rol`, `jti`, `iat_sesion`, `iat`, `exp` | **Se conservan.** Se suma un claim booleano opcional `debeCambiarPassword`; un token emitido antes (sin el claim) vale como `false` |
| 2.2 `withPermission`: firma, `Cache-Control: no-store`, orden «revocación antes que permiso», `401 SESION_INVALIDA`, `403 SIN_PERMISO` | **Se conservan, en el mismo orden.** Se agrega **un** paso entre la revocación por `jti` y el permiso (3.6). Para una cuenta activa, sin revocación por cuenta y sin la marca, el resultado es idéntico al de hoy |
| 2.3 Cerrar sesión (`POST /api/auth/logout`, revocación por `jti`) | **Sin cambios.** Sigue pudiendo llamarse con la marca activa |
| 2.4 Matriz y 2.5 Servicios públicos (`obtenerEmailDeUsuario`, `crearCuentaConCredenciales`, `actualizarEmailCuenta`, `verificarEmailNoAsociadoAOtraCuenta`) | **Filas y firmas sin cambios.** Las funciones y permisos nuevos están en 2.8 y 2.9 (T2) |
| `Usuario`, `TokenRevocado`, `RolPermiso`, `IntentoLoginFallido`, `EventoSeguridad` y sus valores de enum | **Sin cambios de columnas ni de valores.** Se agregan dos columnas con valor por defecto en `Usuario`, dos tablas y valores de enum (aditivo, PR 0 §2.14) |
| Cuentas existentes (seed, autorregistro de HU-B-08, cuentas de prueba) | **No cambian**: sin marca y sin revocación. Las cuentas de prueba anteriores no se migran (decisión del PO, 05/10/2026) |
| Autorregistro del alumno (HU-B-08) | **Sin cambios**: el alumno elige su contraseña al registrarse y no queda marcado |
| Parámetros `SESION_INACTIVIDAD_MIN`, `SESION_MAXIMA_HORAS`, `login_max_intentos`, `login_ventana_minutos` | **Sin cambios** |
| Tests de Sprint 1 y 2 de 2.1 a 2.3 | **Siguen pasando.** Solo se tocan los mocks de `prisma` de `withPermission` (se suma `usuario`); las aserciones sobre respuestas, códigos y `Cache-Control` no cambian |

**Contradicciones detectadas y cómo se resuelven (siempre «acomodarse a lo ya hecho»):**
| # | Contradicción | Resolución |
|---|---|---|
| T1 | El PR 0 llama `cuenta.service.ts` al servicio de cuentas; esta spec (2.5) dice que el archivo real de cuentas es `usuario.service.ts` y que no existe `sesion/cuenta.service.ts` | No hay choque: las funciones **nuevas** van en `src/server/usuarios/cuenta.service.ts` (archivo nuevo, misma carpeta) y las existentes **se quedan** en `usuario.service.ts` sin moverse |
| T2 | El PR 0 nombra `cambiarEmailCuenta(tx, { usuarioId, email })`; Sprint 2 ya documenta `actualizarEmailCuenta(...)` (consumida por HU-B-06) | **Se conservan las dos.** `actualizarEmailCuenta` no cambia de firma ni de comportamiento; `cambiarEmailCuenta` es la entrada nueva para D, F y G y comparte la misma implementación interna |
| T3 | El PR 0 llama `debeCambiarPassword` y `sesionesValidasDesde` a las columnas nuevas; el esquema real usa sufijo por modelo (`activoUsuario`, `createdAtUsuario`) | Se usan `debeCambiarPasswordUsuario` y `sesionesValidasDesdeUsuario`. Los nombres del PR 0 son conceptuales |
| T4 | La regla 3.5 de Sprint 2 dice que la revocación es por `jti`, «salvo que una futura HU pida lo contrario». HU-A-05, HU-A-06, HU-D-08, HU-B-07, HU-F-05 y HU-G-05 piden cerrar **todas** las sesiones de una cuenta | **Conviven:** la revocación por `jti` (logout) no cambia; se suma una revocación por cuenta con `sesionesValidasDesde` (3.7). Es el único cambio de comportamiento sobre Sprint 1 y 2: `withPermission` ahora también rechaza, en cada solicitud, cuentas inactivas (antes solo se controlaba al ingresar) |
| T5 | «Fuera de alcance» de Sprint 2: recuperación de contraseña; cuentas de personal «precargadas (seed)» | **Superado por el backlog:** HU-A-05 y HU-A-06. Se anota en la lista, sin borrarla |
| T6 | El mapa (DEC-03) pide que, pasadas las 3 solicitudes por hora, se muestre el mismo mensaje y no se envíe nada. Un `429` sería más explícito | Se sigue el mapa y el backlog (criterios 2 y 6): misma respuesta `200`, sin email y con un evento de seguridad (3.10) |
| T7 | La matriz 2.4 no lista al Profesor en `alumnos:leer`; el PR 0 (§2.9) manda quitárselo porque «hoy lo tiene» | El PR 0 verifica contra el `seed.ts` y las migraciones y deja matriz, seed y migraciones iguales. Para el contrato de esta spec el Profesor **no** tiene `alumnos:leer` desde el Sprint 3 (2.8) |
| T8 | La matriz 2.4 y R2-1 de `spec_modulo_D.md` dicen que el Gerente no recibe `profesores:*` | **Lo revierte el backlog** (HU-D-08, convención 8 d): el Gerente consulta profesores y los desactiva o reactiva. `profesores:crear` y `profesores:editar` siguen exclusivas de Mesa de Entrada (2.8) |
| T9 | El mapa (P-04) pide que la nueva contraseña sea «distinta del DNI»; la cuenta no guarda el DNI (está en las fichas de otros módulos) | La condición se cumple comparando la nueva contra el **hash vigente**: mientras la contraseña sea la inicial, «igual a la actual» es «igual al DNI». Así A no lee fichas (Regla N.° 3) |
| T10 | El backlog pide saludo con el nombre en el email; `Usuario` no tiene nombre | Se usa `obtenerNombreVisible()` (existente), que resuelve nombre o email según el rol (2.7.4) |
| T11 | `with-permission.ts` real termina cada respuesta con `Cache-Control: no-store` y lanza `PermisoError` con dos códigos (`SESION_INVALIDA`, `SIN_PERMISO`) | Se conserva todo. Se **agrega** un tercer código, `DEBE_CAMBIAR_PASSWORD` (403), que ninguna prueba ni pantalla de Sprint 1 y 2 puede producir, porque las cuentas existentes no tienen la marca (3.6) |
| T12 | `CredencialesLoginSchema` pide `min(1)` en la contraseña; el DNI tiene 7 u 8 dígitos | No hace falta tocar el schema del login: acepta el DNI tal cual. La política de longitud solo rige para contraseñas **nuevas** (3.8) |

**Changelog de Revisión 3:**
| Sección | Estado previo | Acción |
|---|---|---|
| Fuera de alcance, Visión general, Convenciones, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1 a 3.5, 4 y Parámetros | Vigentes | Nota de Revisión 3 en cada una; el texto original se conserva |
| 2.6 | — | **Nueva:** HU-A-06 (cuenta automática, primer ingreso, «Mi cuenta», servicios de cuenta) |
| 2.7 | — | **Nueva:** HU-A-05 (recuperación de contraseña) |
| 2.8 | — | **Nueva:** matriz de permisos del Sprint 3 |
| 2.9 | — | **Nueva:** servicios públicos nuevos del módulo |
| 3.6 a 3.13 | — | **Nuevas** reglas (estado de la cuenta, revocación por cuenta, contraseña inicial y política, enlace de recuperación, respuestas uniformes, datos sensibles, concurrencia y pruebas) |

**Puntos resueltos por el Scrum Master el 08/10/2026** (el backlog no los definía o el PR 0 los dejaba al implementador):
| # | Punto | Decisión | Informar |
|---|---|---|---|
| P-A1 | Cómo se reemite el token tras cambiar la contraseña (PR 0 §2.7 lo deja abierto) | **Server Action con `signIn` del proveedor de credenciales**, con la contraseña nueva, desde el servidor (2.6.3). No se agrega ningún mecanismo nuevo y la rama `update` del callback `jwt` sigue sin copiar datos del cliente | Equipo |
| P-A2 | Qué guarda el evento de seguridad | `EventoSeguridad` **no cambia de columnas**: el evento lleva `usuarioId` de la cuenta afectada, `emailEvento` e `ipEvento`. Quién la creó queda en la ficha (usuario de alta, HU-A-06 con las fichas) | Equipo |
| P-A3 | Más de 3 solicitudes por hora | Misma respuesta que siempre, sin email, con evento `RECUPERACION_LIMITADA` (T6, DEC-03) | Equipo |
| P-A4 | Cómo no revelar si la cuenta existe | La respuesta se da después de registrar la solicitud; todo lo demás (buscar la cuenta, generar el token, enviar el email) corre **después de responder** con `after()` de Next.js (2.7.1) | Equipo |
| P-A5 | Cómo llega la marca al token | El callback `jwt` (rama de ingreso) la lee con `obtenerEstadoCuenta()` y la copia; `verificarCredenciales` **no cambia su resultado** | Equipo |
| P-A6 | Qué admite el servidor con la marca activa | `sesion:ping`, `cuenta:cambiar_password` y cerrar sesión (que no pasa por `withPermission`). Todo lo demás: `403 DEBE_CAMBIAR_PASSWORD` | Equipo |
| P-A7 | Permiso de «Mi cuenta» y del cambio de contraseña | Uno solo, `cuenta:cambiar_password`, para los cuatro roles | Equipo (tabla cerrada del PR 0) |
| P-A8 | Constantes del enlace | 30 minutos de vida y 3 solicitudes por email por hora son **constantes del módulo**, no `ParametroSistema` (HU-N-01 solo expone tres parámetros) | Equipo |
| P-A9 | Contraseña actual | El primer ingreso **no** la pide (la sesión se acaba de abrir con el DNI); «Mi cuenta» **sí**. Los intentos fallidos con la contraseña actual usan el mismo límite que el login (3.3) | Equipo |
| P-A10 | Política de contraseña | Se reutiliza `politicaPasswordSchema` de HU-B-08 **tal cual**; esta spec no define reglas nuevas | Equipo |
| P-A11 | Rutas | Las del mapa: `/recuperar-contrasena`, `/restablecer-contrasena?token=…`, `/primer-ingreso` y `/mi-cuenta`; endpoints en `/api/auth/…`. Las fija `rutas-por-rol.ts` del PR 0 | Equipo |
| P-A12 | Limpieza de filas vencidas | Igual que `TokenRevocado` en Sprint 1, no hay proceso de limpieza de tokens y solicitudes vencidos: deuda conocida | Equipo |
| P-A13 | F y G (ya entregadas) piden a A `obtenerResumenCuenta` y `filtrarCuentasActivas` (P-F3, P-G2); esta spec solo tenía `obtenerEstadoCuenta` | Se **agregan** las dos a 2.9 (aditivo). `obtenerEstadoCuenta` se queda: la usa el callback `jwt` y es la base de `obtenerResumenCuenta` | Equipo |

**Pedidos al PR 0 (a incorporar en el v20, sin tocar lo existente):**
| # | Pedido | Dónde |
|---|---|---|
| R3-PR0-A1 | Esquema de 2.6.5 y 2.7.5: dos columnas en `Usuario`, tablas `TokenRecuperacion` y `SolicitudRecuperacion` y los valores nuevos de `TipoEventoSeguridad` (`ADD VALUE`, no usados en la misma migración) | `PR-0.md` §2.7 y §2.14 |
| R3-PR0-A2 | `with-permission.ts`: el paso de 3.6, el código `DEBE_CAMBIAR_PASSWORD` en `PermisoError`, y que `exigirPermiso` redirija a `/primer-ingreso` en ese caso (y a `/login` en `SESION_INVALIDA`, como hoy). Sumar `usuario` a los mocks de sus tests | `PR-0.md` §2.7 |
| R3-PR0-A3 | Callback `jwt`: copiar `debeCambiarPassword` al ingresar; ampliar el tipo del token; el proxy redirige a `/primer-ingreso` con la marca y deja públicas `/recuperar-contrasena` y `/restablecer-contrasena` | `PR-0.md` §2.7 y §2.9 |
| R3-PR0-A4 | `src/server/usuarios/cuenta.service.ts` con las funciones de 2.9 y `src/server/email/email.service.ts` con el simulador (2.7.4) | `PR-0.md` §2.13 |
| R3-PR0-A5 | Tabla cerrada de permisos: la matriz de 2.8, con el nombre y los roles de cada fila, en migración y seed | `PR-0.md` §2.9 |
| R3-PR0-A6 | `.env.example`: `RESEND_API_KEY`, `EMAIL_FROM` y la URL pública del sistema (`NEXTAUTH_URL`, ya requerida por NextAuth) | `PR-0.md` §2.11 |
| R3-PR0-A7 | Mapa: rutas de P-02 a P-05 como en P-A11, y el mecanismo de reemisión de P-A1 en «Decisiones tomadas» | `mapa-pantallas-sprint-3.md` |

**Efectos sobre otras specs:** **B** (HU-B-01 llama a `crearCuentaParaFicha`; HU-B-06 sigue con `actualizarEmailCuenta`; HU-B-07 usa `desactivarCuenta` y `reactivarCuenta`); **D** (HU-D-01, D-06 y D-08 usan las mismas funciones); **F y G** (sus altas y bajas usan 2.9, incluidas `obtenerResumenCuenta` y `filtrarCuentasActivas`); **C, E, H e I** (solo sus permisos entran en la matriz de 2.8); **N** (sin efecto: las constantes de 2.7 no son parámetros).

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod · NextAuth (Credentials Provider) · bcryptjs
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 9, 10, 11) · `spec_modulo_A.md` §2.4 (esta matriz) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-A-01 | Contractualizada (Sprint 1) | Sin cambios de contrato (2.1). Se completan los campos de la plantilla (Server Action, Permiso, Errores esperados) |
| HU-A-02 | Contractualizada (Sprint 1) | Sin cambios de contrato (2.2). Se completan los campos de la plantilla; su matriz de permisos se documenta en 2.4 |
| HU-A-03 | Contractualizada (Sprint 1) | Sin cambios de contrato (2.3). Se completan los campos de la plantilla |
| — (Regla N.° 10, matriz RBAC) | No existía como tabla única | Añadida sección 2.4 (aditiva, no renumera) |
| — (Regla N.° 3, servicios públicos) | Sin sección propia | Añadida sección 2.5 (`obtenerEmailDeUsuario()`, `crearCuentaConCredenciales()`, `actualizarEmailCuenta()`, `verificarEmailNoAsociadoAOtraCuenta()`) |

**HU contractualizadas en esta revisión:** HU-A-01 (Iniciar sesión), HU-A-02 (Mantener sesión), HU-A-03 (Cerrar sesión) — Sprint 1.

**Revisión 2 (Sprint 2):** Sprint 2 **no agrega HU a este módulo**. La Regla N.° 10 de `docs/RULES.md` exige que la matriz de permisos por rol "se documente y mantenga junto a `spec_modulo_A.md`"; hasta ahora vivía repartida entre el `seed.ts` y las notas de cada módulo. La Revisión 2 agrega la sección **2.4 — Matriz RBAC**, con todos los permisos existentes y los de Sprint 2, y una función pública para Turnos.

**Changelog — Revisión 2 (Sprint 2):**
| Sección | Estado previo | Acción |
|---|---|---|
| 2.4 Matriz RBAC | No existía como tabla única | Nueva sección (aditiva, no renumera) |
| Servicios públicos | — | `obtenerEmailDeUsuario()` (consumida por `spec_modulo_C.md` §2.4). Se dejan documentados también `crearCuentaConCredenciales()` (existente, consumida por `spec_modulo_B.md` §2.6) y `actualizarEmailCuenta()` (consumida por `spec_modulo_B.md` §2.5), en una tabla única (hoy en la sección 2.5; en la redacción original figuraba dentro de 2.4) |

**Fuera de alcance de esta spec (explícito):**

> **Revisión 3 (Sprint 3).** Esta lista queda como estaba en Sprint 1 y 2; el backlog del Sprint 3 la supera en dos puntos, sin borrar nada de ella: (1) la **recuperación de contraseña** pasa a ser HU-A-05 (2.7); (2) el alta de cuentas de profesor, mesa de entrada y gerente ya no es «precargada (seed)»: cada cuenta se crea **al registrar la ficha** con HU-A-06 (2.6), que también cubre al alumno registrado por mesa de entrada. Siguen **fuera de alcance**: la autenticación de dos factores y el autorregistro del alumno (HU-B-08, que no cambia). Este módulo sigue sin dar de alta ni editar fichas: crea y mantiene solo la **cuenta de acceso** que la ficha le pide.

- Recuperación de contraseña (no aparece en el sprint).
- Autenticación de dos factores (2FA).
- Alta, edición o baja de cuentas de profesor, mesa de entrada o gerente — se asume que ya existen, precargadas (seed). Este módulo solo autentica contra cuentas existentes.
- Creación de la cuenta de alumno vía autorregistro: eso lo define HU-B-08 / `spec_modulo_B.md`. Este módulo únicamente provee el mecanismo de emisión de sesión que ese flujo consume al finalizar (mismo contrato de la sección 2.1, sin duplicar lógica).

---

## 1. Visión General

> **Revisión 3 (Sprint 3).** A, además de autenticar, pasa a ser el dueño de la **cuenta de acceso**: la crea cuando otro módulo registra una ficha (con el DNI como contraseña inicial y la marca «Debe cambiar la contraseña»), la mantiene sincronizada con la ficha (email y estado), deja que la persona cambie su contraseña (primer ingreso y «Mi cuenta») y le permite recuperarla por email. Para eso se suman dos columnas a `Usuario`, dos tablas operativas y valores de `TipoEventoSeguridad`, todo **aditivo** (2.6.5 y 2.7.5). Nada del login, del JWT ni del cierre de sesión cambia de contrato. El único cambio de comportamiento sobre lo ya hecho lo manda el backlog: `withPermission` verifica en cada solicitud que la cuenta siga activa y que la sesión no haya sido revocada por cuenta (3.6 y 3.7). Para las cuentas y las sesiones de Sprint 1 y 2 el resultado es el mismo de hoy.


El Módulo A es el subsistema de autenticación y sesión de Noctium, y la base habilitante de la que dependen los demás módulos: define el middleware `withPermission()` (Regla N.° 10 de `docs/RULES.md`) que protege toda ruta del sistema, y registra sus propios eventos de seguridad (login, rechazos, cierre de sesión) en la tabla `EventoSeguridad` (Regla N.° 2, patrón b). No centraliza la auditoría de otros módulos: cada módulo elige el patrón (a) o (b) de la Regla N.° 2 para sus propias mutaciones.

Se implementa sobre **NextAuth (Credentials Provider)** con estrategia de sesión `jwt`. La capa de servicios (`src/server/sesion/*.service.ts`) concentra toda la lógica de negocio (verificación de credenciales, rate limiting, revocación); los callbacks de NextAuth (`authorize`, `jwt`, `session`) y el middleware de Next.js son capa delgada que invoca esa capa de servicios, conforme a la Regla N.° 4.

El usuario del sistema (`Usuario`) tiene un rol único de: `MESA_ENTRADA`, `PROFESOR`, `GERENTE` o `ALUMNO`. El rol viaja en el JWT y determina tanto el menú disponible en la UI como la autorización efectiva en el servidor — la UI oculta opciones no autorizadas, pero eso nunca reemplaza la verificación server-side (criterio de aceptación HU-A-02 §2).

**Alcance de esta revisión:** la Revisión 2 es **aditiva**: agrega la sección 2.4 (matriz RBAC, Regla N.° 10) y la sección 2.5 (servicios públicos del módulo, Regla N.° 3). Las secciones 2.1 a 2.3 (HU-A-01, HU-A-02, HU-A-03, Sprint 1) **no se renumeran** ni cambian de contrato, porque otras specs las citan por número (ver `docs/adicionales/sdd-metodologia.md`). Las operaciones de sesión (2.1 a 2.3) son de Sprint 1; en 2.4 y 2.5 se documenta el resto.

---

## 2. Interfaces y Contratos

### Convenciones generales

> **Revisión 3.** Valen para las secciones nuevas. Los archivos nuevos siguen la Regla N.° 11 y **no mueven nada de lo existente**: servicios de cuentas nuevos en `src/server/usuarios/cuenta.service.ts` (con `cuenta.schema.ts`), recuperación en `src/server/sesion/recuperacion.service.ts` y `recuperacion.constantes.ts`, envío de emails en `src/server/email/email.service.ts`, Server Action nueva `cambiarPasswordPropia` junto a las existentes en `src/server/sesion/actions.ts`, y Route Handlers en `app/api/auth/recuperar-password/` y `app/api/auth/restablecer-password/`. Los permisos nuevos de todo el sistema están en 2.8. Las rutas de recuperación son **públicas**, igual que el login, y no devuelven nunca datos que permitan saber si una cuenta existe (3.10).

- Contrato de respuesta estándar (Route Handlers / Server Actions) y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta protegida del sistema requiere sesión autenticada y permiso granular vía `withPermission("<recurso>:<accion>")` (Regla N.° 10; middleware definido en 2.2). Las operaciones de este módulo son de **sesión propia o públicas** según corresponda (el login es público; ver el permiso requerido de cada operación); el único permiso de sesión en la matriz es `sesion:ping`.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/sesion.types.ts`, Server Actions en `src/server/sesion/actions.ts` y services en `src/server/sesion/autenticacion.service.ts` (cuentas: `src/server/usuarios/usuario.service.ts`). Imports siempre con el alias `@/`. Los nombres de archivo exactos que la spec no fijaba están marcados «a confirmar contra el código».
- Ninguna credencial ni secreto (`NEXTAUTH_SECRET`) se hardcodea: se lee desde variable de entorno (Regla N.° 9).
- La contraseña nunca se persiste en texto plano, nunca viaja en URL/query params, nunca aparece en logs ni en ninguna tabla de eventos (`EventoSeguridad`, `IntentoLoginFallido`).

---

### 2.1. Iniciar sesión (HU-A-01)

> **Revisión 3.** **Sin cambios** de ruta, schema, pasos, orden, mensajes, códigos ni eventos. `verificarCredenciales` devuelve exactamente lo mismo que hoy (P-A5). Una persona cuya ficha fue registrada en Sprint 3 ingresa por este mismo flujo con su email y su DNI (el schema pide `min(1)`: T12). La marca «Debe cambiar la contraseña» no la lee `verificarCredenciales`: la copia el callback `jwt` después del ingreso (2.6.2). Las cuentas inactivas se siguen rechazando acá después de validar la contraseña (3.2).


**Ruta:** — (sin Route Handler propio: el login lo resuelve el Credentials Provider de NextAuth; ruta exacta de NextAuth: a confirmar contra el código)
**Mecanismo:** `authorize()` del Credentials Provider de NextAuth (`lib/auth/auth.config.ts`), delegando en la capa de servicios.
**Server Action equivalente:** `iniciarSesion()` (reducer de `useActionState` en `login-form.tsx`, con estado `EstadoLogin`, según la excepción de la Regla N.° 5); ubicación en `src/server/sesion/actions.ts`: a confirmar contra el código
**Servicio:** `verificarCredenciales(email, password, ip)` en `src/server/sesion/autenticacion.service.ts`
**Permiso requerido:** público (sin sesión previa; no pasa por `withPermission`)

```typescript
// src/server/sesion/sesion.schema.ts
export const CredencialesLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type CredencialesLoginInput = z.infer<typeof CredencialesLoginSchema>;
```

**Comportamiento esperado, en este orden (dentro de `verificarCredenciales`):**
1. Verificar rate limit (sección 3.3) **antes** de tocar la tabla `Usuario`. Si está excedido, retorna `RATE_LIMIT_EXCEDIDO` sin consultar nada más.
2. Buscar `Usuario` por `email` (ya normalizado por el schema: trim + lowercase).
3. Si no existe, comparar `password` contra un **hash de referencia fijo** (nunca contra `undefined`) para no filtrar por timing la no-existencia del email (Regla N.° 3.1 de esta spec).
4. Si existe, comparar `password` contra `Usuario.password_hash` con `bcrypt.compare()`.
5. Si la comparación falla (en cualquiera de los dos casos anteriores): registrar el intento en `IntentoLoginFallido` (sección 3.3), registrar `LOGIN_FALLIDO` en `EventoSeguridad` (sección 4) y retornar `CREDENCIALES_INVALIDAS`.
6. Si la comparación es exitosa: **recién ahora** evaluar `Usuario.is_active` (Regla N.° 3.2 — nunca antes de validar la contraseña). Si `is_active = false`, retornar `CUENTA_INACTIVA` sin crear sesión.
7. Si todo es válido: resolver el rol y devolver los claims mínimos para el JWT (`id`, `rol`) — nunca `password_hash` ni datos personales.
8. Registrar el evento correspondiente en `EventoSeguridad` (sección 4) mediante escritura directa y síncrona — después de que el paso 7 resuelva, no antes.

**Respuesta (éxito) — sesión creada:** NextAuth emite el JWT vía `callbacks.jwt` (ver 2.2) en cookie HttpOnly, Secure, SameSite=Strict — nunca en `localStorage`/`sessionStorage`.

**Errores esperados:** (traducción al usuario; los dos casos de `CREDENCIALES_INVALIDAS` —email inexistente o contraseña incorrecta— son indistinguibles para el cliente)
- Validación Zod fallida (`CredencialesLoginSchema`, Regla N.° 6) — la action lo devuelve como estado `error_validacion` de `EstadoLogin` (excepción `useActionState` de la Regla N.° 5).
- `CREDENCIALES_INVALIDAS` → "Usuario o contraseña incorrectos".
- `CUENTA_INACTIVA` → "La cuenta está inactiva. Comunicate con la administración" (**este mensaje sí es distinto**, pero solo se emite después de validar la contraseña correctamente — nunca revela inactividad ante una contraseña incorrecta).
- `RATE_LIMIT_EXCEDIDO` → "Demasiados intentos. Esperá unos minutos e intentá nuevamente".

---

### 2.2. Mantener sesión (HU-A-02)

> **Revisión 3.** Se conserva todo: claims, renovación deslizante, tope absoluto, orden «revocación antes que permiso», `Cache-Control: no-store`, `401 SESION_INVALIDA` y `403 SIN_PERMISO`. Se suman tres cosas, todas aditivas: (1) un claim booleano opcional `debeCambiarPassword` en el token (un token sin el claim vale `false`); (2) **un paso nuevo** en `withPermission`, entre la revocación por `jti` y la verificación del rol (3.6), que consulta el estado de la cuenta y la revocación por cuenta (3.7); (3) un código nuevo en `PermisoError`, `DEBE_CAMBIAR_PASSWORD` (403), que solo ocurre con la marca activa. Para una cuenta activa, sin revocación por cuenta y sin la marca, el resultado es idéntico al anterior.


**Ruta:** — (sin ruta propia: es el mecanismo transversal que protege todas las rutas; el «ping» autenticado del aviso de expiración usa el permiso `sesion:ping`; su ruta exacta: a confirmar contra el código)
**Mecanismo:** `callbacks.jwt` y `callbacks.session` de NextAuth + middleware `withPermission()` (`lib/auth/with-permission.ts`), usado por todo Route Handler/Server Action protegido del sistema.
**Server Action equivalente:** — (no aplica: callbacks de NextAuth y middleware)
**Servicio:** verificación de revocación y renovación en `callbacks.jwt` / `withPermission()` (capa delgada); función de servicio exacta en `src/server/sesion/*.service.ts`: a confirmar contra el código
**Permiso requerido:** `sesion:ping` (los 4 roles) para el ping; el propio middleware exige el permiso `accion` de cada ruta protegida (matriz en 2.4)

**Estructura del JWT (claims):**
```typescript
{
  sub: string;              // Usuario.id
  rol: "MESA_ENTRADA" | "PROFESOR" | "GERENTE" | "ALUMNO";
  jti: string;              // identificador único del token, para revocación
  iat_sesion: number;       // timestamp de inicio de sesión, INMUTABLE durante la renovación
  iat: number;              // emitido en esta renovación
  exp: number;              // vence en 30 min desde esta renovación (parámetro configurable)
}
// Nunca contiene password_hash ni datos personales (email, nombre, etc. van solo en `session.user`, resuelto server-side en cada request, no persistido en el token).
```

**Comportamiento esperado — `callbacks.jwt` (renovación deslizante):**
1. En cada solicitud válida, si `now < exp` y el `jti` no está en la tabla de revocación (`TokenRevocado`), se recalcula `exp = now + 30min` (parámetro `SESION_INACTIVIDAD_MIN`, sección "Parámetros configurables").
2. **Tope absoluto:** si `now - iat_sesion > 8h` (parámetro `SESION_MAXIMA_HORAS`), la renovación se rechaza aunque falten minutos para el `exp` vigente — la sesión vence igual.
3. `iat_sesion` nunca se reescribe durante la vida del token; solo se fija una vez, al login (2.1).

**Comportamiento esperado — middleware `withPermission(accion: string)`:**
1. Verifica firma y vencimiento del JWT. Si falla → `401`, no procesa la solicitud.
2. Verifica que el `jti` no esté en `TokenRevocado` (consulta indexada). Si está revocado → `401`.
3. Verifica que el `rol` del token tenga el permiso `accion` en la matriz RBAC (`RolPermiso`, seed). Si no → `403 SIN_PERMISO`, **sin modificar datos** (criterio HU-A-02 §2).
4. La UI oculta opciones no autorizadas, pero esta verificación server-side es la que realmente protege — nunca se confía solo en el ocultamiento de la UI.

**Aviso de expiración próxima (criterio §4):** resuelto client-side comparando `exp` del JWT decodificado (expuesto de forma no sensible vía `session.expires`) contra la hora actual; "Continuar sesión" dispara una solicitud liviana (ping autenticado) que fuerza la renovación de `callbacks.jwt` sin recargar la página.

**Nota de sincronización (HU-A-02, resuelta):**
- El paso 2 de `withPermission()` (verificación contra `TokenRevocado`) queda **stubbeado** (comentario `TODO(HU-A-03)`, sin lógica real) hasta que HU-A-03 exista — `TokenRevocado` está creada en el schema pero HU-A-02 no la consulta ni la llena, para no adelantar lógica de una HU no implementada todavía.
- La matriz `RolPermiso` se puebla **incremental, módulo por módulo**: HU-A-02 solo siembra `"sesion:ping"` (los 4 roles), necesaria para probar el propio middleware. Cada módulo futuro (`turno:crear`, `alumno:editar`, etc.) agrega sus propias filas cuando implemente su HU — sin volver a tocar esta capa.
- El umbral de aviso (`session_aviso_anticipado_minutos`) y los de renovación/tope ya viven en `ParametroSistema` (no hardcodeados), sembrados por `prisma/seed.ts`.

**Respuesta `2xx` (ping `sesion:ping`):** renueva la sesión vía `callbacks.jwt`; forma exacta del cuerpo: a confirmar contra el código.

**Respuesta `401`:**
```json
{ "data": null, "error": { "code": "SESION_INVALIDA", "message": "Tu sesión expiró. Iniciá sesión nuevamente" } }
```

**Respuesta `403`:**
```json
{ "data": null, "error": { "code": "SIN_PERMISO", "message": "No tenés permisos para acceder a esta sección" } }
```

**Errores esperados:**
- `401 SESION_INVALIDA` — firma o vencimiento inválidos, `jti` revocado (`TokenRevocado`) o tope absoluto de `SESION_MAXIMA_HORAS` superado.
- `403 SIN_PERMISO` — el `rol` del token no tiene el permiso `accion` en la matriz RBAC; no se modifica ningún dato.

---

### 2.3. Cerrar sesión (HU-A-03)

> **Revisión 3.** **Sin cambios.** El cierre de sesión revoca por `jti` como hasta ahora y sigue disponible aunque la cuenta tenga la marca «Debe cambiar la contraseña» (P-A6). La revocación de todas las sesiones de una cuenta es un mecanismo aparte (3.7) y no lo reemplaza.


**Ruta:** `POST /api/auth/logout` (wrapper sobre `signOut()` de NextAuth, extendido con revocación)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `cerrarSesion(jti, usuarioId, ip)` en `src/server/sesion/autenticacion.service.ts`
**Permiso requerido:** sesión propia / público (tolera llamarse sin sesión vigente, ver «Logout sin sesión vigente»; no pasa por `withPermission`)

**Comportamiento esperado:**
1. Inserta `jti` en `TokenRevocado` con `expira_en` igual al `exp` original del token (para poder purgar filas vencidas más adelante sin perder cobertura antes de tiempo).
2. Responde eliminando la cookie de sesión (`Max-Age=0`). Como la cookie es HttpOnly, el cliente no puede borrarla por JS — el server es quien la invalida en la respuesta.
3. Registra el evento `LOGOUT` en `EventoSeguridad` (sección 4).
4. Si el paso 1 falla por error de comunicación con la base, el error se ignora (`try/catch`) y se responde igualmente éxito al cliente; el código actual no reintenta la revocación — el usuario no debe quedar en un estado intermedio con acceso a pantallas protegidas (criterio HU-A-03 §6); como respaldo, el token deja de ser válido al vencer naturalmente (máximo 30 min).

**Respuesta `200 OK`:**
```json
{ "data": { "revocado": true }, "error": null }
```

**Errores esperados:**
- Ninguno hacia el cliente: sin sesión vigente responde igual `200 { revocado: true }` (no `401`), y si el `INSERT` en `TokenRevocado` falla por error de comunicación con la base igualmente se responde éxito (se loguea el error; el token vence naturalmente, ver notas).

**Nota de sincronización (HU-A-03, resuelta):**
- **Sin reintento explícito en segundo plano:** el paso 4 de arriba ("se reintenta la revocación en segundo plano") queda simplificado — si el `INSERT` en `TokenRevocado` falla, se loguea el error y no se reintenta. El respaldo es el mismo que ya describe el punto 4: el token deja de ser válido al vencer naturalmente (máx. `SESION_INACTIVIDAD_MIN`, 30min), que acota el daño lo suficiente para no justificar una cola/retry en este sprint.
- **`TokenRevocado` sin purga — deuda conocida:** no hay job de limpieza de filas vencidas (`expiraEn < now`) en Sprint 1. Cada logout agrega una fila permanente; la tabla crece sin límite mientras no exista ese job. No es un defecto de HU-A-03 (explícitamente fuera de su alcance) sino trabajo pendiente a programar en un sprint futuro — se deja anotado acá para que no se pierda.
- **Logout sin sesión vigente:** `POST /api/auth/logout` tolera llamarse sin cookie/sesión válida y responde `200 { revocado: true }` igual (no `401`) — no hay nada que revocar, y el objetivo del cliente (no seguir logueado) ya está cumplido. Un `401` acá sería un error técnico sin nada accionable para el cliente, en contra del espíritu del criterio HU-A-03 §6.
- **`jti` nunca sale de la capa server-side:** para revocar hace falta el `jti` crudo del token, que `callbacks.session` oculta a propósito (HU-A-02). Se resuelve con `getToken()` de `next-auth/jwt` sobre el mismo `decode` HS256 custom — nunca se relaja la regla de HU-A-02 de no exponer `jti` al cliente.

---

### 2.4. Matriz RBAC (Regla N.° 10) — NUEVA en Revisión 2

> **Revisión 3.** La matriz de arriba **no se modifica**: sus filas siguen siendo las de Sprint 2. Los cambios del Sprint 3 (permisos nuevos, `alumnos:leer` y `profesores:leer`) están en 2.8, que es la matriz vigente a partir de este sprint; el PR 0 los lleva a migración y seed. Donde 2.4 y 2.8 difieren, rige 2.8 (T7 y T8).


Fuente única de permisos por rol, sincronizada con `RolPermiso` (`schema.prisma`) y con el arreglo `PERMISOS` de `seed.ts`. **Toda acción nueva se agrega acá, en una migración que inserta la fila y en `seed.ts`** (el seed usa `upsert`, así que es idempotente). Los permisos se comprueban con `withPermission("<recurso>:<accion>")`, nunca por rol suelto. Los roles: **M** = MESA_ENTRADA, **G** = GERENTE, **P** = PROFESOR, **A** = ALUMNO.

| Permiso | M | G | P | A | HU / módulo | Estado |
|---|:-:|:-:|:-:|:-:|---|---|
| `sesion:ping` | ✔ | ✔ | ✔ | ✔ | HU-A-02 | existente |
| `materias:crear` | | ✔ | | | HU-L-01 | existente |
| `materias:leer` | ✔ | ✔ | ✔ | | HU-L-02 | existente |
| `materias:editar` | | ✔ | | | HU-L-03 | **nuevo** |
| `aulas:crear` | | ✔ | | | HU-K-01 | existente |
| `aulas:leer` | | ✔ | | | HU-K-02 | existente |
| `aulas:editar` | | ✔ | | | HU-K-03 | **nuevo** |
| `alumnos:crear` | ✔ | | | | HU-B-01 | existente |
| `alumnos:editar` | ✔ | | | | HU-B-02/03/06 | existente |
| `alumnos:leer` | ✔ | | | | HU-B-04/05 | existente (HU-B-05 la reutiliza) |
| `profesores:crear` | ✔ | | | | HU-D-01 | existente |
| `profesores:editar` | ✔ | | | | HU-D-02/03/04/06/07 | existente (sin cambios: el backlog v2 puso D-06/D-07 en manos de Mesa) |
| `profesores:leer` | ✔ | | | | HU-D-05 | existente |
| `turnos:leer` | ✔ | ✔ | ✔ | | HU-C-01/02/08/09 | existente (el Profesor solo ve los suyos) |
| `turnos:crear` | ✔ | | | | HU-C-03/07/17 | existente |
| `turnos:asignar_participantes` | ✔ | | | | HU-C-04 | existente |
| `turnos:asignar_aula` | ✔ | | | | HU-C-15/16 | existente |
| `turnos:cancelar` | ✔ | | | | HU-C-05 | **nuevo** |
| `turnos:reprogramar` | ✔ | | | | HU-C-06 | **nuevo** |
| `turnos:priorizar` | ✔ | | | | HU-C-10 | **nuevo** |
| `turnos:leer_propios` | | | | ✔ | HU-C-13 | **nuevo** |
| `turnos:solicitar_propio` | | | | ✔ | HU-C-12 | **nuevo** |
| `calendario:leer` | ✔ | ✔ | ✔ | | HU-J-01/02/03 | existente (el Profesor solo ve la suya) |
| `formas_pago:crear` | | ✔ | | | HU-I-03 | **nuevo** |
| `formas_pago:leer` | ✔ | ✔ | | | HU-I-03 y modal de HU-I-01 | **nuevo** |
| `pagos:crear` | ✔ | | | | HU-I-01 (incluye `GET /api/pagos/opciones`) | **nuevo** |
| `pagos:leer` | ✔ | ✔ | | | HU-I-01 (detalle) | **nuevo** — Profesor sin acceso a montos. **Ratificado por el PO (29/09/2026) — Q6d** |
| `clases:registrar` | ✔ | | ✔ | | HU-E-01 | **nuevo** (el Profesor solo en sus turnos) |
| `examenes:registrar` | ✔ | | ✔ | | HU-E-06 | **nuevo** (el Profesor solo con alumnos que atendió) |
| `historial:leer` | ✔ | ✔ | ✔ | | HU-E-05 | **nuevo** (el Profesor solo con alumnos que atendió), **ratificado por el PO (29/09/2026): Q7b (ver historial y registrar exámenes, solo alumnos que atendió) y Q13** |
| `indicadores:leer` | | ✔ | | | HU-H-01/H-02 | **nuevo** |

**Notas de sincronización con `seed.ts`:**
- Agregar las 21 acciones-rol nuevas (15 acciones distintas) al arreglo `PERMISOS` y a **una migración de permisos** (el patrón vigente: `INSERT … ON CONFLICT DO NOTHING`).
- **`ACCIONES_SOLO_MESA_ENTRADA` no se toca** (`profesores:crear`, `:editar`, `:leer`): el backlog v2 dejó a Mesa de Entrada como único rol que modifica profesores (R2-1 de `spec_modulo_D.md`). No agregar filas de `profesores:*` para GERENTE.
- El rol **ALUMNO** es el primero con permisos de negocio: hasta Sprint 1 solo tenía `sesion:ping`. Sus rutas **nunca** aceptan un id de alumno del cliente: la ficha se resuelve con `obtenerAlumnoDeUsuario(session.sub)` (`spec_modulo_B.md` §2.8).

**Servicios públicos del Módulo A:** documentados en la sección 2.5 (antes formaban parte de esta sección; las citas «`spec_modulo_A.md` §2.4» de otras specs a estas funciones deben leerse como §2.5; la matriz de permisos sigue siendo 2.4).

---

### 2.5. Servicios públicos del módulo — NUEVA en Revisión 2

> **Revisión 3.** Las cuatro funciones de esta tabla **conservan firma y comportamiento**. Las funciones nuevas (`crearCuentaParaFicha`, `cambiarEmailCuenta`, `desactivarCuenta`, `reactivarCuenta`, `revocarSesiones`, `cambiarPassword`, `obtenerEstadoCuenta`) están en 2.9, en un archivo nuevo, y se suman a las actuales sin reemplazarlas (T1 y T2).


Conforme a la Regla N.° 3: servicios públicos del Módulo A para cuentas, todos en `src/server/usuarios/usuario.service.ts` (el archivo real del Módulo A para cuentas; **no existe** `sesion/cuenta.service.ts`). Ningún otro módulo consulta ni escribe la tabla `usuarios` directamente.

| Función | Devuelve | Consumidores | Estado |
|---|---|---|---|
| `obtenerEmailDeUsuario(usuarioId): Promise<string \| null>` | Email de la cuenta, sin exponer el hash ni otros campos; `null` si la cuenta no existe (el consumidor decide qué mostrar en ese caso) | `spec_modulo_C.md` §2.4 (`creado_por`); `spec_modulo_E.md` §2.1 (`registrada_por` del registro de clase) | **nuevo** |
| `crearCuentaConCredenciales(...)` | Alta de un `Usuario` con rol `ALUMNO` y sus credenciales. B la invoca en el autorregistro (`spec_modulo_B.md` §2.6: rama (a), alta directa, y verificación de código de la rama (b), con el `password_hash` ya calculado) | `spec_modulo_B.md` §2.6 (y §1, §3.2 como regla de aislamiento) | existente; **firma exacta: a confirmar contra el código** |
| `actualizarEmailCuenta(...)` | Actualiza `Usuario.email` de la cuenta vinculada a un alumno cuando cambia su email de contacto; se invoca dentro de la misma transacción de B (el email llega ya normalizado y con la unicidad validada) | `spec_modulo_B.md` §2.5 (HU-B-06, paso 2) | **a documentar**; **firma exacta: a confirmar contra el código** |
| `verificarEmailNoAsociadoAOtraCuenta(...)` | Comprueba que un email no pertenezca a otra cuenta (`EMAIL_YA_ASOCIADO`, sin revelar de quién es) | `spec_modulo_B.md` §2.2, §2.5; `spec_modulo_D.md` §2.1, §2.2, §2.6 | nombre tomado de D; **existencia y firma: a confirmar contra el código** |

**Notas:** (1) `obtenerEmailDeUsuario()` se agrega junto a `obtenerNombreVisible()`, que ya resuelve nombre o email según el rol pero exige conocer el rol: acá no se lo conoce; lo usa Turnos (`creado_por`), porque `Usuario` no tiene nombre y el personal de mesa de entrada no tiene ficha. (2) `spec_modulo_B.md` ya cita la ubicación `src/server/usuarios/usuario.service.ts` para `crearCuentaConCredenciales()` y `actualizarEmailCuenta()`; la ubicación de ambas y su firma exacta se confirman contra el código, y este módulo (dueño de las tres) debe completar la tabla una vez confirmadas.

---

### 2.6. Cuenta de acceso automática, primer ingreso y «Mi cuenta» (HU-A-06) — NUEVA en Revisión 3

**Qué resuelve este módulo y qué no.** Al registrar a un gerente (HU-G-01), un integrante de mesa de entrada (HU-F-01), un profesor (HU-D-01) o un alumno registrado por mesa de entrada (HU-B-01), la ficha y la cuenta se crean **en la misma transacción**. La ficha y su formulario son de cada módulo; **A es dueño de la cuenta**: ofrece las funciones de 2.9 y nadie más escribe `usuarios` (Regla N.° 3). El autorregistro del alumno (HU-B-08) **no cambia** (criterio 8).

#### 2.6.1. Crear la cuenta de la ficha — `crearCuentaParaFicha` (criterios 1, 2 y 9)

**Servicio público:** `crearCuentaParaFicha(tx, { email, dni, rol, ip? })` en `src/server/usuarios/cuenta.service.ts`. No tiene ruta propia: la llama el servicio de alta de cada ficha dentro de **su** transacción (`tx`).

```typescript
// src/server/usuarios/cuenta.schema.ts
export const CrearCuentaParaFichaSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254),
  dni: z.string().regex(/^\d+$/, "El DNI solo puede tener números"), // solo números, sin puntos
  rol: z.enum(["GERENTE", "MESA_ENTRADA", "PROFESOR", "ALUMNO"]),
});
```
**Comportamiento esperado:**
1. Validar el input (defensivo: la ficha ya validó el DNI y el email con las reglas de su módulo; la longitud del DNI la valida cada módulo con la configurada).
2. Calcular el hash de la contraseña inicial (el DNI) con la **misma función y el mismo costo** que usa `crearCuentaConCredenciales`. El DNI nunca se guarda en claro ni en `usuarios` ni en ningún evento (3.11).
3. Insertar el `Usuario` con `rolUsuario = rol`, `activoUsuario = true`, `debeCambiarPasswordUsuario = true` y el hash, con una **condición atómica** (Regla N.° 7): `INSERT … ON CONFLICT ("emailUsuario") DO NOTHING RETURNING`. Sin fila devuelta: `409 EMAIL_YA_ASOCIADO` («Ese email ya está asociado a otra cuenta»), que **no revela de quién es**. La verificación previa de la pantalla (`verificarEmailNoAsociadoAOtraCuenta`, 2.5) es solo una ayuda; esta condición es la que manda cuando dos altas simultáneas usan el mismo email.
4. Registrar el evento `CUENTA_CREADA` (4) con el `usuarioId` creado, el email y la IP de la solicitud (criterio 9).
5. Devolver `{ usuario_id }`. El servicio de la ficha lo guarda como `usuarioId` de la ficha.

Si el paso 3 falla, la excepción cancela la transacción del llamador: **no se registra la ficha** (criterio 2). El rol lo fija el módulo que llama según el tipo de ficha; nunca viene de un formulario («sin poder elegir otro»).

**Errores:** `409 EMAIL_YA_ASOCIADO` · `400 VALIDATION_ERROR` (input inválido). Los traduce el servicio de la ficha al campo `email` del formulario.

**El mensaje de alta** lo arma cada módulo con su sustantivo (Alumno, Profesor, Integrante o Gerente): «<Tipo de ficha> registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.» (criterio 5).

#### 2.6.2. La marca «Debe cambiar la contraseña» (criterio 3)

- **Login (2.1): sin cambios.** La persona ingresa con su email y el DNI; el login no pide longitud mínima (T12) y `verificarCredenciales` devuelve lo mismo que hoy (P-A5).
- **Token:** en la rama de ingreso del callback `jwt`, después de `verificarCredenciales`, se llama a `obtenerEstadoCuenta(usuarioId)` (2.9) y se copia `debeCambiarPassword` al token. Es un claim booleano; no contiene datos personales. La renovación deslizante no lo cambia y la rama `update` del callback **no** copia nada que mande el cliente (PR 0 §2.7). Un token sin el claim vale como `false`.
- **Proxy (`src/proxy.ts`, «a confirmar contra el código»):** con `debeCambiarPassword = true` en el token, toda navegación a una página protegida se redirige a `/primer-ingreso`, **antes de cualquier otra pantalla**. Quedan fuera de la redirección: la propia `/primer-ingreso`, el cierre de sesión y las rutas públicas (`/login`, `/recuperar-contrasena`, `/restablecer-contrasena`). El proxy no consulta la base: decide con el token.
- **Servidor (`withPermission`, `verificarPermiso`, `exigirPermiso`):** decide con el valor de la **base** (3.6). Con la marca activa solo admite `sesion:ping` y `cuenta:cambiar_password`; todo lo demás responde `403` con `code: "DEBE_CAMBIAR_PASSWORD"` y «Tenés que cambiar tu contraseña para seguir». Las páginas redirigen a `/primer-ingreso`.

#### 2.6.3. Cambiar la propia contraseña — primer ingreso y «Mi cuenta» (criterios 3 y 4)

**Ruta:** — (solo Server Action: la reemisión del token, P-A1, exige escribir la cookie de sesión)
**Server Action:** `cambiarPasswordPropia()` en `src/server/sesion/actions.ts`
**Servicio:** `cambiarPasswordPropia(input, usuarioId, ip)` en `src/server/sesion/cambio-password.service.ts` (archivo nuevo), que usa `cambiarPassword()` de 2.9
**Permiso requerido:** `cuenta:cambiar_password` (los cuatro roles; es de las pocas acciones que la marca admite). Se verifica con `verificarPermiso`, que no renueva la cookie y por eso no choca con la reemisión.

```typescript
// src/server/sesion/sesion.schema.ts (se agrega; no se modifica nada existente)
export const CambiarPasswordSchema = z.object({
  password_actual: z.string().min(1).optional(),        // obligatoria salvo en el primer ingreso
  password_nueva: politicaPasswordSchema,               // el validador de HU-B-08, tal cual (P-A10)
  confirmacion: z.string(),
}).refine((v) => v.password_nueva === v.confirmacion, { message: "Las contraseñas no coinciden", path: ["confirmacion"] });
```
**Comportamiento esperado, en este orden:**
1. Resolver la cuenta **de la sesión** (`usuarioId` del token, nunca de un parámetro) y verificar el permiso.
2. Validar con `CambiarPasswordSchema` (Regla N.° 6).
3. Verificar el límite de intentos del login (3.3) con el email de la cuenta y la IP, **antes** de comparar la contraseña actual.
4. **Contraseña actual:** si la cuenta **no** tiene la marca (caso «Mi cuenta»), `password_actual` es obligatoria y se compara con `bcrypt.compare()`. Si falla: se registra el intento en `IntentoLoginFallido` y responde `422 PASSWORD_ACTUAL_INCORRECTA`. Con la marca (primer ingreso) no se pide: la sesión se acaba de abrir con esa misma contraseña (P-A9).
5. Dentro de una `transaccion` (PR 0): bloquear la fila de la cuenta (`FOR UPDATE`), comprobar que la nueva **no sea igual al hash vigente** (`422 PASSWORD_IGUAL_A_ACTUAL`; mientras la contraseña sea la inicial, esto es «distinta del DNI», T9) y llamar a `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: true })`, que en la misma transacción: guarda el hash nuevo, quita la marca, fija `sesionesValidasDesde = ahora` truncado a segundos (3.7) y registra el evento `PASSWORD_CAMBIADA`.
6. **Después del commit**, reemitir la sesión de esta persona: `signIn("credentials", { email, password: nueva, redirect: false })` desde el servidor. Pasa por el login normal, así que el token nuevo trae `iat_sesion = ahora` (posterior a `sesionesValidasDesde`, por lo que **no** se cierra la sesión que hizo el cambio), sin la marca. Las otras sesiones de la cuenta quedan por debajo de `sesionesValidasDesde` y caen en su próxima solicitud (RNF-SEG-04).
7. Si la reemisión falla (por ejemplo, el límite de intentos), el cambio **ya se hizo**: se responde con `sesion_conservada: false` y la interfaz lleva a `/login` con el aviso de éxito.

**Respuesta `200 OK`:** `{ "data": { "cambiada": true, "sesion_conservada": true }, "error": null }`

**Errores esperados:** `400 VALIDATION_ERROR` (política, confirmación o falta de la contraseña actual) · `401 SESION_INVALIDA` · `403 SIN_PERMISO` · `422 PASSWORD_ACTUAL_INCORRECTA` («La contraseña actual no es correcta») · `422 PASSWORD_IGUAL_A_ACTUAL` («La contraseña nueva no puede ser igual a la actual»; en el primer ingreso la interfaz la muestra como «La contraseña nueva no puede ser tu DNI») · `429 RATE_LIMIT_EXCEDIDO` · `409 TRANSACCION_OCUPADA`.

#### 2.6.4. Qué hace A cuando cambia la ficha (criterios 6 y 7)

- **Cambiar el email de la ficha** (HU-B-06, HU-D-06, HU-F-01, HU-G-01): el servicio de la ficha llama, dentro de su transacción, a `cambiarEmailCuenta(tx, { usuarioId, email })` (o a `actualizarEmailCuenta` en el flujo existente de HU-B-06; son la misma implementación, T2), con la misma validación de unicidad y el mismo `409 EMAIL_YA_ASOCIADO`. **No revoca sesiones** (DEC-44 del mapa): la sesión sigue y la persona ingresa con el email nuevo la próxima vez. El email es la identidad del login; por eso el cambio se limita a un único paso atómico: `UPDATE usuarios SET emailUsuario = … WHERE idUsuario = …` con el `UNIQUE` como condición (Regla N.° 7).
- **Desactivar la ficha** (HU-D-08, HU-B-07, HU-F-05, HU-G-05): `desactivarCuenta(tx, usuarioId)` pone `activoUsuario = false` y revoca las sesiones (3.7) en la misma transacción. **Reactivar:** `reactivarCuenta(tx, usuarioId)` pone `activoUsuario = true`. La marca `debeCambiarPassword` **se conserva** en ambos casos (criterio 7): quien nunca cambió la contraseña inicial sigue obligado. Las dos funciones son idempotentes (`UPDATE … WHERE activoUsuario = <estado previo>` con conteo de filas; sin cambio, no escriben ni revocan de más).
- **La ficha muestra la sección «Cuenta de acceso»** (criterio 5): el módulo dueño de la ficha la arma con `obtenerEstadoCuenta(usuarioId)` (2.9): email, rol y estado: «Activa · debe cambiar la contraseña», «Activa» o «Inactiva».

#### 2.6.5. Esquema (lo crea el PR 0, §2.14)

```prisma
model Usuario {
  // …columnas existentes sin cambios…
  debeCambiarPasswordUsuario   Boolean   @default(false)  // HU-A-06; PR 0: `debeCambiarPassword`
  sesionesValidasDesdeUsuario  DateTime?                  // RNF-SEG-04; PR 0: `sesionesValidasDesde`
}
```
Ambas son aditivas y con valor por defecto: para las cuentas existentes no cambia nada (sin marca ni revocación).

#### 2.6.6. Pantallas

- **`/primer-ingreso` (P-04):** título, el texto «Por seguridad, definí una contraseña nueva para seguir.», contraseña nueva con la ayuda de la política, confirmación, «Guardar y seguir» y «Cerrar sesión». Sin menú lateral ni otra opción. Antes de guardar, la confirmación común de HU-C-25: «¿Estás seguro de que querés cambiar tu contraseña?». Al terminar va a la pantalla inicial del rol: «Tu contraseña se actualizó. Ya podés usar el sistema.». Sin la marca, quien entra a esta ruta va a su pantalla inicial. La página usa `exigirPermiso("cuenta:cambiar_password")`.
- **`/mi-cuenta` (P-05):** para los cuatro roles, desde el bloque del usuario del menú. Formulario: contraseña actual, nueva y confirmación. Confirmación de HU-C-25: «¿Estás seguro de que querés cambiar tu contraseña? Se van a cerrar tus sesiones en otros dispositivos.». Éxito: «Tu contraseña se actualizó.» y la sesión sigue abierta. Si la olvidó, hay un enlace a la recuperación (2.7). Los textos son los iniciales del mapa (DEC-04) y los definitivos van al archivo central (HU-C-23).
- **Menú:** «Mi cuenta» se suma al bloque del usuario sin tocar las opciones existentes (el menú lo define el mapa, P-00).

**Verificación diferida (backlog):** el registro de integrantes de mesa de entrada, cuando esté HU-F-01, y el de gerentes, cuando esté HU-G-01; la desactivación de la cuenta del criterio 7 de HU-A-06, cuando estén HU-F-05 y HU-G-05. Mientras tanto se prueba con altas de alumno y de profesor.

---

### 2.7. Recuperar contraseña olvidada (HU-A-05) — NUEVA en Revisión 3

La persona pide un enlace por email y define una contraseña nueva sin depender de mesa de entrada. Es la **única historia que envía emails** (convención 8 j). Las rutas de esta sección son **públicas**: no pasan por `withPermission` y el proxy no las redirige al login ni al primer ingreso (PR 0 §2.9).

**Archivos (Regla N.° 11):** `src/server/sesion/recuperacion.service.ts` (`solicitarRecuperacion`, `procesarSolicitudRecuperacion`, `verificarEnlaceRecuperacion`, `restablecerPassword`), `src/server/sesion/recuperacion.constantes.ts`, `src/server/email/email.service.ts`; schemas en `src/server/sesion/sesion.schema.ts` (se agregan); Route Handlers en `app/api/auth/recuperar-password/route.ts` y `app/api/auth/restablecer-password/route.ts` (rutas estáticas, junto a `logout`; no chocan con el `[...nextauth]`).

**Constantes del módulo (P-A8):** `MINUTOS_VALIDEZ_ENLACE_RECUPERACION = 30` y `MAX_SOLICITUDES_RECUPERACION_POR_HORA = 3`. No son `ParametroSistema`: HU-N-01 solo expone tres parámetros.

#### 2.7.1. Pedir el enlace (criterios 1, 2 y 6)

**Ruta:** `POST /api/auth/recuperar-password` · **Server Action equivalente:** `solicitarRecuperacion()` · **Servicio:** `solicitarRecuperacion(email, ip)` · **Permiso requerido:** público.

```typescript
export const SolicitarRecuperacionSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254),
});
```
**Comportamiento esperado:**
1. Validar el email. Un formato inválido es el único caso que responde distinto: `400 VALIDATION_ERROR`.
2. En una `transaccion`, con un **bloqueo de aviso por email** (`pg_advisory_xact_lock` sobre el hash del email, para que dos pedidos simultáneos no pasen el límite juntos, Regla N.° 7): contar las filas de `SolicitudRecuperacion` de ese email de los últimos 60 minutos. Si hay **3 o más**: registrar el evento `RECUPERACION_LIMITADA`, **no** insertar ni enviar nada y pasar al paso 4. Si hay menos: insertar la solicitud. El conteo es por email, exista o no la cuenta (T6, P-A3).
3. Si la solicitud entró, programar el resto con `after()` de `next/server`: `procesarSolicitudRecuperacion(email, ip)` corre **después de enviar la respuesta**, para que el tiempo no revele si la cuenta existe (criterio 2, P-A4).
4. Responder siempre lo mismo:
```json
{ "data": { "solicitada": true }, "error": null }
```
La interfaz muestra «Si el email corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña» (criterio 2). La misma respuesta sirve para un email inexistente, una cuenta inactiva, una cuenta activa y una solicitud limitada.

**`procesarSolicitudRecuperacion(email, ip)` (ya fuera de la respuesta):**
1. Buscar la cuenta por email y registrar el evento `RECUPERACION_SOLICITADA` (con `usuarioId` si existe, `null` si no): **cada solicitud** es un evento (criterio 6).
2. Si no existe, o está **inactiva** (una ficha inactiva tiene la cuenta inactiva), terminar sin enviar nada.
3. En una `transaccion`: invalidar los enlaces anteriores de la cuenta que sigan abiertos (`UPDATE … SET consumidoEnToken = ahora WHERE usuarioId = … AND consumidoEnToken IS NULL`, **pedir uno nuevo invalida el anterior**, criterio 3) y crear el nuevo: un valor aleatorio de 32 bytes (`crypto.randomBytes`, en base64url), del que se guarda **solo su hash SHA-256**, con vencimiento a 30 minutos de `ahora()`.
4. Enviar el email (2.7.4). Si el envío falla o no responde: invalidar el enlace recién creado, registrar `RECUPERACION_ENVIO_FALLIDO` y registrar el error en el log **sin el enlace ni la clave**. El usuario no se entera (criterio 7): ve el mismo mensaje y puede pedir otro.

#### 2.7.2. Verificar el enlace al abrirlo

`verificarEnlaceRecuperacion(token)` es una lectura que usa la página `/restablecer-contrasena` (Server Component): devuelve `true` si el hash del token existe, no está consumido ni invalidado y no venció (`venceEnToken > ahora()`). No consume el enlace. Con `false` la página muestra «El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?» (criterio 3), con acceso a la pantalla de pedido. La página responde con `Referrer-Policy: no-referrer` (3.11).

#### 2.7.3. Definir la contraseña nueva (criterios 3, 4, 5 y 6)

**Ruta:** `POST /api/auth/restablecer-password` · **Server Action equivalente:** `restablecerPassword()` · **Servicio:** `restablecerPassword(input, ip)` · **Permiso requerido:** público (lo autoriza el enlace).

```typescript
export const RestablecerPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password_nueva: politicaPasswordSchema,   // la política vigente de HU-B-08, tal cual (P-A10)
  confirmacion: z.string(),
}).refine((v) => v.password_nueva === v.confirmacion, { message: "Las contraseñas no coinciden", path: ["confirmacion"] });
```
**Comportamiento esperado, en este orden:**
1. Validar con el schema. **Antes** de tocar el enlace: una contraseña que no cumple la política o una confirmación distinta responde `400 VALIDATION_ERROR` y no gasta el enlace.
2. En una `transaccion`, **consumir el enlace con una operación condicional** (Regla N.° 7): `UPDATE tokens_recuperacion SET consumidoEnToken = ahora WHERE tokenHash = <hash> AND consumidoEnToken IS NULL AND venceEnToken > ahora RETURNING usuarioId`. Sin fila devuelta (vencido, usado, invalidado por uno nuevo o inexistente): `410 ENLACE_INVALIDO` («El enlace ya no es válido. Pedí uno nuevo desde ¿Olvidaste tu contraseña?»). Dos envíos simultáneos del mismo enlace: **solo uno** confirma; el otro recibe `410`.
3. Bloquear la fila de la cuenta (`FOR UPDATE`). Si está **inactiva**: `410 ENLACE_INVALIDO` (se deshace el consumo).
4. Si la nueva es **igual a la contraseña vigente**: `422 PASSWORD_IGUAL_A_ACTUAL` («La contraseña nueva no puede ser igual a la anterior»). Se deshace toda la transacción, así que el enlace **sigue siendo válido** para reintentar (criterio 4).
5. `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual: false })`: guarda el hash, **quita la marca** `debeCambiarPassword` si la cuenta todavía la tenía (criterio 5), fija `sesionesValidasDesde = ahora` (**caen todas las sesiones de la cuenta**, RNF-SEG-04) e invalida cualquier otro enlace abierto de la cuenta.
6. Registrar el evento `RECUPERACION_CONFIRMADA` en la misma transacción (criterio 6).

**Respuesta `200 OK`:** `{ "data": { "restablecida": true }, "error": null }`. La interfaz va a `/login` con «Tu contraseña se actualizó. Iniciá sesión con la nueva contraseña.» (criterio 5). No se inicia sesión automáticamente.

**Errores esperados:** `400 VALIDATION_ERROR` · `410 ENLACE_INVALIDO` · `422 PASSWORD_IGUAL_A_ACTUAL` · `409 TRANSACCION_OCUPADA`.

#### 2.7.4. Servicio de envío de emails (criterio 7)

- Un servicio propio del sistema, no de A: `src/server/email/email.service.ts`, con `enviarEmail({ para, asunto, texto, html })`. Elige la implementación según el entorno: el **simulador** (en las pruebas automáticas, `NODE_ENV === "test"`, y en desarrollo sin `RESEND_API_KEY`), que no manda ningún email real y escribe el email en la consola (con el enlace, solo fuera de producción); o **Resend** (`RESEND_API_KEY` y `EMAIL_FROM`, Regla N.° 9; nada de esto va en el código ni en el seed), solo si alguien carga esas variables. En producción sin clave, el envío falla y se trata como en 2.7.1 paso 4.
- El llamador es `procesarSolicitudRecuperacion`; la pantalla nunca envía.
- **Contenido:** asunto «Restablecé tu contraseña de Noctium»; saludo con el nombre de la persona (`obtenerNombreVisible()`, que devuelve el nombre o, si no lo tiene, el email: T10); el botón o enlace a `<URL pública>/restablecer-contrasena?token=<token>` (la URL pública es `NEXTAUTH_URL`); el aviso de que vence a los 30 minutos y es de un solo uso; y «Si no pediste este cambio, ignorá este email». Los textos están en el archivo central (HU-C-23).
- **Decisión del PO (08/10/2026):** en el entorno de demostración también rige el simulador: no se manda un email real y no se exige cuenta de Resend ni dominio remitente verificado (convención 8 j y criterio 7 del backlog). La demostración corre en modo desarrollo, para que el simulador muestre el enlace en la consola del servidor. Resend queda como opción que se activa con las variables de entorno; no es requisito del sprint.

#### 2.7.5. Esquema (lo crea el PR 0, §2.14)

```prisma
model TokenRecuperacion {
  idTokenRecuperacion String    @id @default(cuid())
  usuarioId           String
  tokenHashRecuperacion String  @unique       // SHA-256 del valor enviado; el valor no se guarda
  venceEnToken        DateTime
  consumidoEnToken    DateTime?               // usado o invalidado por un enlace nuevo
  creadoEnToken       DateTime  @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [idUsuario])

  @@index([usuarioId, consumidoEnToken])
  @@map("tokens_recuperacion")
}

model SolicitudRecuperacion {   // operativa, solo para contar (como IntentoLoginFallido)
  idSolicitud         String   @id @default(cuid())
  emailSolicitud      String
  ipSolicitud         String
  creadoEnSolicitud   DateTime @default(now())

  @@index([emailSolicitud, creadoEnSolicitud])
  @@map("solicitudes_recuperacion")
}
```
Los nombres de campo siguen el sufijo por modelo del esquema real; el PR 0 los fija.

#### 2.7.6. Pantallas

- **Login:** se suma el enlace «¿Olvidaste tu contraseña?» y el aviso de éxito cuando se llega desde la pantalla de nueva contraseña. Todo lo demás del login queda como está.
- **`/recuperar-contrasena` (P-02):** título, bajada, campo Email, botón «Enviar enlace» y enlace para volver al login. Tras enviar, siempre el mensaje del criterio 2. Email inválido: «Ingresá un email válido, por ejemplo nombre@dominio.com.».
- **`/restablecer-contrasena?token=…` (P-03):** con enlace válido, contraseña nueva (con la ayuda de la política), confirmación y «Guardar contraseña»; con enlace inválido, el mensaje del criterio 3 y el acceso a pedir otro. Antes de guardar, la confirmación común de HU-C-25: «¿Estás seguro de que querés cambiar tu contraseña?». Si el enlace vence o se usa mientras la persona completa el formulario, el `410` muestra el mismo mensaje.
- Los textos marcados «a definir» en el mapa van al archivo central (HU-C-23).

---

### 2.8. Matriz RBAC del Sprint 3 (Regla N.° 10) — NUEVA en Revisión 3

Complementa la matriz de 2.4, que **no se modifica**: sus filas siguen siendo el contrato de Sprint 1 y 2 y acá se listan solo los cambios y las altas del Sprint 3. Valen las mismas reglas: toda acción nueva va en **una migración** que inserta o borra la fila **y** en `seed.ts` (idempotente), y se comprueba con `withPermission("<recurso>:<accion>")`, un solo permiso por ruta. **Los nombres marcados «propuesto» los fija la tabla cerrada de `PR-0.md` §2.9**; si el PR 0 prefiere reutilizar una acción existente, solo cambia el nombre en `withPermission`. Roles: **M** = MESA_ENTRADA, **G** = GERENTE, **P** = PROFESOR, **A** = ALUMNO.

#### 2.8.1. Cambios sobre permisos existentes

| Permiso | M | G | P | A | HU / módulo | Cambio |
|---|:-:|:-:|:-:|:-:|---|---|
| `alumnos:leer` | ✔ | ✔ | | | HU-E-02 (criterio 8), convención 8 (d) y (g) | El **Gerente** lo gana (alumnos en modo consulta: no edita, no inscribe, no registra pagos). El **Profesor** lo pierde, **en el mismo cambio** en que se agrega su acceso acotado al historial (T7) |
| `historial:leer` | ✔ | ✔ | ✔ | | HU-E-05, convención 8 (g) | Las filas **no cambian**. El alcance del Profesor deja de ser «alumnos que atendió» (Q7b) y pasa a ser «desde el detalle de una clase suya y solo en la materia de esa clase» (`spec_modulo_E.md` 2.5.3) |
| `profesores:leer` | ✔ | ✔ | | | HU-D-05, HU-D-08 | El **Gerente** lo gana: listado y ficha en modo consulta. Deja sin efecto la decisión de Sprint 2 «el Gerente no administra Profesores» (T8). `profesores:crear` y `profesores:editar` **siguen exclusivas de M** |
| `turnos:leer`, `pagos:leer`, `indicadores:leer`, `formas_pago:*` existentes | | | | | HU-C-09, HU-I-02, HU-H-06 | **Sin cambios de filas.** El Gerente ya los tiene (detalle de la clase en consulta, pagos, indicadores) |

**`ACCIONES_SOLO_MESA_ENTRADA` del seed:** debe quedar solo con lo que de verdad es exclusivo de Mesa de Entrada (`profesores:crear` y `profesores:editar`); no puede seguir borrando `profesores:leer` del Gerente (`PR-0.md` §2.7). La prueba de la matriz corre **después** del seed.

#### 2.8.2. Permisos nuevos

| Permiso | M | G | P | A | HU / módulo | Estado |
|---|:-:|:-:|:-:|:-:|---|---|
| `cuenta:cambiar_password` | ✔ | ✔ | ✔ | ✔ | HU-A-06 (primer ingreso y «Mi cuenta») | propuesto. **La única acción, junto con `sesion:ping`, que admite una cuenta con la marca «Debe cambiar la contraseña»** (3.6) |
| `observaciones:registrar` | ✔ | | ✔ | | HU-E-07 | propuesto (`spec_modulo_E.md` 2.5.2) |
| `indicaciones:registrar` | ✔ | | ✔ | | HU-E-04 | propuesto |
| `examenes:corregir` | ✔ | | ✔ | | HU-E-10 (corregir y anular) | propuesto |
| `clases:corregir` | ✔ | | ✔ | | HU-E-11 (corregir asistencia y anular el registro) | propuesto |
| `historial:leer_propio` | | | | ✔ | HU-E-08 («Mi historial») | propuesto |
| `turnos:cancelar_propia` | | | | ✔ | HU-C-14 | propuesto (`spec_modulo_C.md` P-C5) |
| `reservas:leer` | ✔ | | | | HU-C-26 (pantalla «Reservas») | nombrado por el PR 0 |
| `pagos:corregir` | ✔ (acotado) | ✔ | | | HU-I-06 | propuesto (`spec_modulo_I.md` 2.6.3); el alcance de M lo da `puedeCorregirPago` |
| `pagos:leer_propios` | | | | ✔ | HU-I-05 («Mis pagos») | propuesto |
| `comprobantes:leer` | ✔ | ✔ | | | HU-I-11 | propuesto |
| `comprobantes:leer_propios` | | | | ✔ | HU-I-11 | propuesto |
| `cajas:abrir`, `cajas:movimiento`, `cajas:cerrar`, `cajas:leer` | ✔ | | | | HU-I-12 (solo su propia caja) | propuesto |
| `cajas:leer_todas`, `cajas:cerrar_ausencia` | | ✔ | | | HU-I-12 | propuesto |
| `formas_pago:editar`, `formas_pago:desactivar` | | ✔ | | | HU-I-07 (`desactivar` incluye reactivar) | propuesto |
| `materias:cambiar_tarifa` | | ✔ | | | HU-L-06 y HU-L-07 | propuesto por el PR 0 §2.9 |
| `materias:ver_tarifa` | ✔ | | | | HU-L-06 criterio 7 (el Profesor tiene `materias:leer` y **no** ve precios) | propuesto por el PR 0 §2.9; el Gerente ve la tarifa con `materias:cambiar_tarifa` (la spec de L confirma) |
| `alumnos:cambiar_estado` | ✔ | | | | HU-B-07 (desactivar y reactivar alumno) | nombre fijado por `spec_modulo_B.md` 2.10; **solo M** |
| `profesores:cambiar_estado` | | ✔ | | | HU-D-08 (desactivar y reactivar profesor, y las acciones sobre las clases futuras del profesor que se desactiva) | nombre fijado por `spec_modulo_D.md` 2.10; **solo G**. El alcance sobre cada clase lo da `gerentePuedeGestionarClaseDeBaja`; **no** hay permisos nuevos sobre `turnos:*` |
| `personal:crear`, `personal:editar`, `personal:leer`, `personal:cambiar_estado` | | ✔ | | | HU-F-01, F-03, F-05 (personal de mesa de entrada) | nombres fijados por `spec_modulo_F.md` (P-F2); **solo G** |
| `gerentes:crear`, `gerentes:editar`, `gerentes:leer`, `gerentes:cambiar_estado` | | ✔ | | | HU-G-01, G-03, G-05 (gerentes) | nombres fijados por `spec_modulo_G.md` (P-G1); **solo G** |
| `configuracion:leer`, `configuracion:editar` | | ✔ | | | HU-N-01 | nombres fijados por `spec_modulo_N.md`; **solo G** |

**Acciones que tenían nombre pendiente** (baja y reactivación de alumno y de profesor; personal de mesa de entrada, gerentes y configuración): quedan nombradas en la tabla de arriba, con el nombre que fijó la spec de cada módulo. El PR 0 las confirma o las renombra en su tabla cerrada (§2.9); si cambia un nombre, solo cambia el `withPermission` de las rutas del módulo.

**Reglas que no cambian:** el **Profesor no recibe ningún permiso de pagos, comprobantes, cajas ni tarifas** (Q6d, HU-I-11 criterio 4, HU-L-06 criterio 7); el **Gerente no tiene `pagos:crear`** ni ninguna escritura del historial académico (HU-I-10 criterio 9, HU-E-02 criterio 8); el rol **ALUMNO** nunca manda un id de alumno: su ficha sale de `obtenerAlumnoDeUsuario(session.sub)`.

**Rutas por rol.** Además de la matriz, el PR 0 actualiza `rutas-por-rol.ts` y el `matcher` del proxy con las rutas del sprint. Las de este módulo: `/primer-ingreso` (con sesión; la única página que admite la marca) y `/mi-cuenta`; **públicas**, sin sesión y sin la redirección del primer ingreso: `/login` (existente), `/recuperar-contrasena` y `/restablecer-contrasena`.

---

### 2.9. Servicios públicos nuevos del módulo — NUEVA en Revisión 3

Complementa 2.5, cuyas cuatro funciones **no cambian de firma ni de comportamiento**. Conforme a la Regla N.° 3, ningún otro módulo consulta ni escribe `usuarios`. Las funciones nuevas viven en `src/server/usuarios/cuenta.service.ts` (archivo nuevo; las de 2.5 se quedan en `usuario.service.ts`, T1). Las que escriben reciben el `tx` del llamador (la cuenta y la ficha cambian juntas); las lecturas aceptan `db?: Prisma.TransactionClient`. Ninguna valida permisos: los valida la ruta del consumidor. A **no lee fichas** de otros módulos.

| Función | Devuelve | Consumidores |
|---|---|---|
| `crearCuentaParaFicha(tx, { email, dni, rol, ip? })` | `{ usuario_id }`. Crea la cuenta con el DNI como contraseña inicial y la marca `debeCambiarPassword`; `409 EMAIL_YA_ASOCIADO` si el email está en uso (2.6.1) | HU-B-01, HU-D-01, HU-F-01, HU-G-01 |
| `cambiarEmailCuenta(tx, { usuarioId, email })` | `{ cambio: boolean }`. Misma validación de unicidad y el mismo `409 EMAIL_YA_ASOCIADO`; no revoca sesiones. **Comparte la implementación** con `actualizarEmailCuenta` (2.5), que se conserva | HU-D-06, HU-F-01, HU-G-01 (HU-B-06 sigue con `actualizarEmailCuenta`) |
| `desactivarCuenta(tx, usuarioId)` y `reactivarCuenta(tx, usuarioId)` | `{ cambio: boolean }`. Desactivar también revoca las sesiones; la marca de contraseña se conserva. Idempotentes | HU-D-08, HU-B-07, HU-F-05, HU-G-05 |
| `revocarSesiones(tx, usuarioId)` | `void`. Fija `sesionesValidasDesde = ahora` truncado a segundos y **nunca lo retrocede** (3.7) | Las anteriores y `cambiarPassword` |
| `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual })` | `{ reemitir_sesion: boolean }` (igual a `conservarSesionActual`). Guarda el hash, quita la marca, revoca las sesiones y registra `PASSWORD_CAMBIADA` o, desde la recuperación, `RECUPERACION_CONFIRMADA`. No compara la contraseña actual: eso lo hace quien lo llama (2.6.3, 2.7.3) | 2.6.3 y 2.7.3 (dentro de este módulo) |
| `obtenerEstadoCuenta(usuarioId, db?)` | `{ email, rol, activa, debe_cambiar_password } \| null`; nunca el hash. Con él las fichas arman «Cuenta de acceso» y el callback `jwt` copia la marca | HU-B-01/06, HU-D-01/06, HU-F-01, HU-G-01 (sección «Cuenta de acceso»); callback `jwt` |
| `obtenerResumenCuenta(usuarioId \| null, db?)` | `{ estado: "ACTIVA" \| "INACTIVA" \| "SIN_CUENTA", email: string \| null, rol: string \| null, debe_cambiar_password: boolean }`. Es la lectura que arma la sección «Cuenta de acceso» de las fichas: con `usuarioId` nulo o inexistente devuelve `SIN_CUENTA` (fichas anteriores a HU-A-06, DEC-14). Se apoya en `obtenerEstadoCuenta`; nunca devuelve el hash. **Es el nombre que usan `spec_modulo_F.md` y `spec_modulo_G.md` (P-F3)** | HU-B-01/06/07, HU-D-01/06/08, HU-F-01/03/05, HU-G-01/03/05 (ficha) |
| `filtrarCuentasActivas(tx, usuarioIds)` | `string[]`: los ids de usuario de la lista cuya cuenta está activa. Una lectura simple, sin bloqueo: quien la usa ya bloqueó las fichas, y la cuenta solo cambia de estado junto con su ficha (P-G2) | HU-G-05 (regla «al menos un gerente activo») |
| `verificarEmailNoAsociadoAOtraCuenta(email, { excluirUsuarioId? }, db?)` | **Existente** (2.5, no cambia). Se lista acá porque F y G la declaran como dependencia: la firma real se confirma contra el código | HU-B-02/06, HU-D-01/02/06, HU-F-01, HU-G-01 |

**No son públicas** (internas de A): `solicitarRecuperacion`, `procesarSolicitudRecuperacion`, `verificarEnlaceRecuperacion`, `restablecerPassword` y `cambiarPasswordPropia`. Las páginas y Server Actions de A las usan directamente.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/sesion/*.service.ts` (`autenticacion.service.ts`; las cuentas, en `src/server/usuarios/usuario.service.ts`). Route Handlers y Server Actions son capa delgada (Regla N.° 4 de `docs/RULES.md`).

### 3.1. Comparación contra hash de referencia cuando el email no existe

> **Revisión 3.** Sin cambios. La recuperación de contraseña aplica el mismo principio de no revelar la existencia de la cuenta (3.10).

`verificarCredenciales` **siempre** ejecuta un `bcrypt.compare()`, exista o no el `Usuario`. Si no existe, se compara contra una constante de hash de referencia (`DUMMY_PASSWORD_HASH`, generada una vez y fijada en variable de entorno o constante de build) — nunca se hace `return` anticipado sin comparar, para que el tiempo de respuesta no permita inferir por timing si un email está registrado.

### 3.2. Orden no negociable: contraseña antes que estado de cuenta

> **Revisión 3.** Sin cambios en el login. Otra cosa es el control por solicitud de 3.6, que corre **con una sesión ya abierta** y por eso no filtra nada que el login no hubiera dicho.

`Usuario.is_active` se evalúa **únicamente después** de que `bcrypt.compare()` haya resultado exitoso. Evaluar el estado antes filtraría, ante una contraseña incorrecta, si la cuenta existe e indirectamente si está activa — violando el criterio de mensaje neutro de HU-A-01 §4.

### 3.3. Rate limiting por email + IP

> **Revisión 3.** Sin cambios en los parámetros ni en el login. El mismo límite lo usa el cambio de contraseña desde «Mi cuenta» cuando la contraseña actual es incorrecta (P-A9). El límite de la recuperación es otro y aparte (2.7.1): 3 solicitudes por email por hora.

Tabla operativa `IntentoLoginFallido` (`emailIntento`, `ipIntento`, `creadoEnIntento`; índice `[emailIntento, creadoEnIntento]`), usada solo para contar. Es **distinta** de `EventoSeguridad`, que también registra `LOGIN_FALLIDO` (sección 4) pero no se usa para contar. Se escribe de forma directa y síncrona dentro del propio servicio, porque el conteo debe estar disponible de inmediato para la siguiente solicitud. Los límites salen de los parámetros configurables `login_max_intentos` y `login_ventana_minutos` (tabla al final). Cuando el límite está excedido, `verificarRateLimit` lanza el error antes de tocar nada más: **no se escribe ninguna fila** (ni en `IntentoLoginFallido` ni en `EventoSeguridad`).

```typescript
const intentosRecientes = await prisma.intentoLoginFallido.count({
  where: { emailIntento: email, ipIntento: ip, creadoEnIntento: { gte: new Date(Date.now() - login_ventana_minutos * 60_000) } },
});
if (intentosRecientes >= login_max_intentos) throw new ServiceError("RATE_LIMIT_EXCEDIDO");
```
La cuenta **nunca se bloquea** — el límite es por combinación email+IP+ventana de tiempo, no un estado persistente de `Usuario` (criterio HU-A-01 §4).

### 3.4. Ningún dato sensible en logs ni en tablas de eventos

> **Revisión 3.** Se conserva y se extiende a las funciones nuevas (3.11): ni el DNI, ni la contraseña, ni el enlace de recuperación, ni su valor sin hash aparecen en logs, eventos ni respuestas.

`password`, `passwordHashUsuario` y el hash de referencia (3.1) no se guardan jamás en `EventoSeguridad`, en `IntentoLoginFallido` ni en logs de aplicación.

### 3.5. Revocación por `jti`, no por invalidación global

> **Revisión 3.** La revocación por `jti` **sigue siendo la del cierre de sesión**. Esta regla decía «salvo que una futura HU pida lo contrario»: HU-A-05, HU-A-06, HU-B-07, HU-D-08, HU-F-05 y HU-G-05 piden cerrar todas las sesiones de una cuenta, y eso se resuelve con un mecanismo que **convive** con el anterior (3.7), sin tocar `TokenRevocado`.

`TokenRevocado` opera por token individual (`jti`), no por usuario — cerrar sesión en un dispositivo no afecta sesiones abiertas en otros dispositivos del mismo usuario (comportamiento estándar salvo que una futura HU pida lo contrario).

### 3.6. Estado de la cuenta en cada solicitud — NUEVA en Revisión 3
`withPermission`, `verificarPermiso` y `exigirPermiso` (`src/server/shared/with-permission.ts`) agregan **un paso** a los de 2.2, sin alterar los existentes ni su orden. Queda así:
1. Sesión válida (firma y vencimiento) → si no, `401 SESION_INVALIDA` *(existente)*.
2. `jti` en `TokenRevocado` → `401 SESION_INVALIDA` *(existente)*.
3. **Nuevo.** Una lectura de la cuenta por clave primaria (`activoUsuario`, `sesionesValidasDesdeUsuario`, `debeCambiarPasswordUsuario`): si no existe o está **inactiva**, o si `iat_sesion` del token es **anterior** a `sesionesValidasDesde`, `401 SESION_INVALIDA`. Es el mismo código y el mismo mensaje que un token vencido: el cliente no distingue «vencida», «cerrada», «revocada» ni «cuenta inactiva».
4. **Nuevo.** Si la cuenta tiene `debeCambiarPassword = true` (valor de la **base**, no del token) y la acción no es `sesion:ping` ni `cuenta:cambiar_password`: `403 DEBE_CAMBIAR_PASSWORD`. `PermisoError` suma ese `code` (aditivo); `exigirPermiso` redirige a `/primer-ingreso` en lugar de `/sin-permiso`.
5. Permiso del rol en `RolPermiso` → `403 SIN_PERMISO` *(existente)*.

Para una cuenta activa, sin revocación por cuenta y sin la marca, el resultado es **idéntico** al de Sprint 2. El cierre de sesión (`POST /api/auth/logout`) y las rutas públicas no pasan por este control. Un token sin `iat_sesion` y una cuenta con `sesionesValidasDesde` se rechazan (no hay forma de saber si es anterior). El costo es una lectura por solicitud. Los tests de `withPermission` de Sprint 2 solo necesitan que el mock de `prisma` sume `usuario`; sus aserciones no cambian.

### 3.7. Revocación de todas las sesiones de una cuenta (complementa 3.5) — NUEVA en Revisión 3
- La revocación por `jti` (cerrar sesión en un dispositivo, 3.5) **se mantiene**. Se suma una revocación **por cuenta**, que cierra todas las sesiones anteriores a un instante: `sesionesValidasDesde`.
- Se fija con `revocarSesiones` al **cambiar la contraseña** (HU-A-06, HU-A-05) y al **desactivar** la cuenta (HU-D-08, HU-B-07, HU-F-05, HU-G-05). Se trunca a segundos, igual que `iat_sesion`, y **solo avanza** (`GREATEST` con el valor anterior).
- La comparación es estricta (`iat_sesion < sesionesValidasDesde`): la sesión reemitida con `iat_sesion = ahora` **no** se cierra; una sesión de otro dispositivo iniciada en el mismo segundo exacto del cambio sobrevive (límite aceptado).
- Alcanza a las API (`withPermission`) y a las pantallas (`exigirPermiso`); el proxy no consulta la base.

### 3.8. Contraseña inicial y política — NUEVA en Revisión 3
La contraseña inicial es el DNI (solo números, sin puntos) y se guarda **únicamente como hash**, igual que cualquier otra; nadie la ve. El login no exige longitud mínima (un DNI puede tener 7 dígitos y la política pide 8); la política de HU-B-08 se aplica a la contraseña **nueva**, sin reglas propias de este módulo. La nueva debe ser distinta de la vigente (comparación contra el hash). Solo `cambiarPassword` quita la marca. La marca se conserva al desactivar y reactivar. Las cuentas creadas por autorregistro o por el seed no la llevan.

### 3.9. Enlace de recuperación — NUEVA en Revisión 3
Valor de 32 bytes aleatorios; se guarda **solo su hash SHA-256**; vence a los 30 minutos; es de un solo uso; pedir uno nuevo invalida el anterior. Usarlo es **una operación condicional** (`UPDATE … WHERE consumido IS NULL AND vence > ahora RETURNING`), nunca «leer y después marcar». Un fallo después de consumirlo (contraseña igual a la vigente, cuenta inactiva) deshace la transacción y el enlace sigue siendo válido. Restablecer **no** inicia sesión: las sesiones de la cuenta caen y la persona vuelve al login.

### 3.10. No revelar si la cuenta existe — NUEVA en Revisión 3
La pantalla de pedido responde lo mismo para un email inexistente, una cuenta inactiva, una cuenta activa y una solicitud que superó el límite (T6); el único caso distinto es el formato inválido. El límite de 3 por hora se cuenta **por email, exista o no la cuenta**. Todo lo que depende de la existencia (buscar la cuenta, crear el enlace, enviar) corre después de responder. Con el login ya valía lo mismo (3.1).

### 3.11. Ningún dato sensible en logs, eventos ni respuestas (extiende 3.4) — NUEVA en Revisión 3
No se guardan ni se registran: contraseñas (actual, nueva o inicial), el DNI usado como contraseña, el valor del enlace, el enlace completo, `RESEND_API_KEY` ni hashes. El único lugar donde puede verse el enlace es el simulador de desarrollo, fuera de producción. La página `/restablecer-contrasena` responde con `Referrer-Policy: no-referrer` para que el valor no salga en el encabezado `Referer`. El email no contiene contraseñas. Todas las respuestas de este módulo llevan `Cache-Control: no-store`.

### 3.12. Concurrencia (Regla N.° 7) — NUEVA en Revisión 3
- Crear la cuenta: `INSERT … ON CONFLICT ("emailUsuario") DO NOTHING RETURNING`; dos altas con el mismo email, una gana y la otra recibe `409`. Nunca captura de `P2002` dentro de la transacción.
- Cambiar la contraseña: la fila de la cuenta se toma con `FOR UPDATE` y no se combina con otros bloqueos (no interviene en el orden de `PR-0.md` §2.10); usa `transaccion` (`maxWait` 2000 ms, `timeout` 8000 ms, `lock_timeout` 5 s: `409 TRANSACCION_OCUPADA`).
- Usar el enlace: la condición del `UPDATE` de 3.9; dos envíos simultáneos, solo uno confirma.
- Límite de solicitudes: bloqueo de aviso por email dentro de la transacción de conteo e inserción.
- Desactivar y reactivar: `UPDATE … WHERE activoUsuario = <estado previo>` con conteo de filas.

### 3.13. Pruebas obligatorias (módulo A) — NUEVA en Revisión 3
1. **Los tests de Sprint 1 y 2 de 2.1 a 2.3 siguen pasando**; solo cambia el mock de `prisma` de `withPermission`. `verificarCredenciales` devuelve lo mismo que antes.
2. **`withPermission`:** una cuenta sin marca ni revocación se comporta como antes; cuenta inactiva → `401`; `iat_sesion` anterior a `sesionesValidasDesde` → `401` (API y página con `exigirPermiso`); con la marca solo pasan `sesion:ping` y `cuenta:cambiar_password` (resto `403 DEBE_CAMBIAR_PASSWORD`; la página redirige a `/primer-ingreso`); el orden de los cinco pasos de 3.6.
3. **Crear cuenta:** rol y marca correctos, hash del DNI (nunca en claro), `409 EMAIL_YA_ASOCIADO` sin revelar de quién, dos altas simultáneas con el mismo email, y la ficha que no se crea si la cuenta falla (con un consumidor de prueba).
4. **Primer ingreso y «Mi cuenta»:** el login con un DNI de 7 dígitos funciona; la marca llega al token; el proxy redirige; cambiar la contraseña quita la marca, deja viva la sesión actual y **cierra las otras**; contraseña actual incorrecta (con el límite de intentos); nueva igual a la vigente y igual al DNI; política; un `update` del cliente no cambia `iat_sesion` ni la marca; si la reemisión falla, el cambio ya está hecho y la respuesta lo informa.
5. **Fichas:** cambiar el email (unicidad, sin revocar sesiones); desactivar revoca y reactivar conserva la marca; `obtenerEstadoCuenta` no devuelve el hash.
6. **Recuperación:** misma respuesta para email inexistente, cuenta inactiva, cuenta activa y solicitud limitada; la cuarta solicitud de la hora no envía ni crea enlace y deja `RECUPERACION_LIMITADA`; enlace vencido, usado, invalidado por uno nuevo y inexistente; dos confirmaciones simultáneas (una gana); contraseña igual a la vigente (el enlace sigue válido); cuenta que se desactiva antes de confirmar; quita la marca; cierra todas las sesiones; falla de Resend (evento, enlace invalidado, mismo mensaje al usuario); el hash del enlace es el único valor guardado.
7. **Datos sensibles:** ni los logs ni `EventoSeguridad` contienen contraseñas, DNI, enlaces ni la clave; el simulador es el único que muestra el enlace y nunca en producción.
8. **Matriz:** cada fila de 2.8 contra el seed **después** de correrlo, y el Gerente sin ninguna escritura del historial ni `pagos:crear`.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

> **Revisión 3.** Los eventos y las mutaciones de Sprint 1 y 2 de esta sección no cambian. Las mutaciones nuevas de este módulo y sus eventos están en la nota de más abajo.


**Opción usada: (b), escritura directa y síncrona a una tabla de eventos por dominio** (`EventoSeguridad`, el patrón de referencia que cita la Regla N.° 2 para este módulo). Motivo: los intentos de acceso, rechazos y cierres de sesión son eventos discretos y repetibles sobre la misma cuenta, no columnas del ciclo de vida de una fila. No se usa la opción (a) en este módulo.

Las escrituras son **directas y síncronas** (un `prisma.eventoSeguridad.create` con `await`, sin `$transaction`, sin event bus ni listeners, sin hash encadenado). La tabla operativa `IntentoLoginFallido` (3.3) es distinta y solo sirve al rate limit.

`EventoSeguridad` guarda: `idEvento`, `tipoEvento`, `usuarioId` (opcional), `emailEvento` (opcional), `ipEvento`, `creadoEnEvento`.

| `tipoEvento` | Cuándo se escribe | Campos que se guardan |
|---|---|---|
| `LOGIN_EXITOSO` | Login exitoso (2.1, paso 7) | `usuarioId`, `emailEvento`, `ipEvento` |
| `LOGIN_FALLIDO` | Credenciales inválidas (2.1, paso 5), después de insertar en `IntentoLoginFallido` | `usuarioId` (o `null` si el email no existe), `emailEvento`, `ipEvento` — **nunca** `password` |
| `CUENTA_INACTIVA_RECHAZADA` | Contraseña correcta sobre cuenta inactiva (2.1, paso 6) | `usuarioId`, `emailEvento`, `ipEvento` |
| `LOGOUT` | Logout (2.3), después de insertar en `TokenRevocado` (dentro de un `try/catch` que ignora el error) | `usuarioId`, `ipEvento` (sin email) |

- **Rate limit excedido:** no escribe ningún evento (ver 3.3).
- **No se guardan** `rol`, `user_agent`, `jti` ni `motivo`. Agregar un tipo `RATE_LIMIT_EXCEDIDO` o esos campos es una decisión futura, fuera del alcance de este sprint.
- El `create` de `LOGOUT` en `EventoSeguridad` no está protegido: si falla, el error se propaga y la ruta no responde 200.
- Los tipos `REGISTRO_CUENTA`, `VERIFICACION_CODIGO_*`, `CODIGO_VERIFICACION_GENERADO` y `AUTORREGISTRO_DERIVADO_MESA_ENTRADA` del mismo enum pertenecen al Módulo B (`spec_modulo_B.md`).

> **Revisión 3.** El módulo sigue en la **opción (b)**, con las mismas reglas: escritura directa y síncrona en `EventoSeguridad`, sin event bus y sin datos sensibles (3.11). **No cambia ninguna columna ni ningún tipo existente.** Se suman estos tipos (los crea el PR 0 con `ADD VALUE`, sin usarlos en la misma migración); todos guardan solo `usuarioId` (si se conoce), `emailEvento` e `ipEvento` (P-A2):
>
> | `tipoEvento` | Cuándo se escribe | Campos |
> |---|---|---|
> | `CUENTA_CREADA` | Al crear la cuenta de una ficha (2.6.1, paso 4), en la transacción de la ficha | `usuarioId` creado, `emailEvento`, `ipEvento` |
> | `PASSWORD_CAMBIADA` | Al cambiar la propia contraseña, en el primer ingreso o desde «Mi cuenta» (2.6.3), en la misma transacción | `usuarioId`, `emailEvento`, `ipEvento` |
> | `RECUPERACION_SOLICITADA` | Cada solicitud de enlace que entra (2.7.1), existan o no la cuenta | `usuarioId` (o `null`), `emailEvento`, `ipEvento` |
> | `RECUPERACION_LIMITADA` | Cuarta solicitud o más de un mismo email en una hora (T6) | `emailEvento`, `ipEvento` |
> | `RECUPERACION_ENVIO_FALLIDO` | Falla o demora de Resend (2.7.1, paso 4) | `usuarioId`, `emailEvento`, `ipEvento` |
> | `RECUPERACION_CONFIRMADA` | Contraseña restablecida con el enlace (2.7.3), en la misma transacción | `usuarioId`, `emailEvento`, `ipEvento` |
>
> `REGISTRO_CUENTA` y los tipos de verificación de código siguen siendo del autorregistro de HU-B-08. Desactivar y reactivar cuentas lo traza el historial de estados de cada ficha (HU-D-08, HU-B-07, HU-F-05, HU-G-05; `PR-0.md` §2.10), no `EventoSeguridad`. La reemisión de la sesión (2.6.3, paso 6) pasa por el login y por eso registra además un `LOGIN_EXITOSO`. `TokenRecuperacion` y `SolicitudRecuperacion` son tablas operativas (como `IntentoLoginFallido`): no son trazabilidad. Como `TokenRevocado`, no tienen proceso de limpieza (P-A12).

---

## Parámetros configurables (referencia)

> **Revisión 3.** Ver la nota al final de esta tabla.


| Parámetro | Valor por defecto | Usado en |
|---|---|---|
| `SESION_INACTIVIDAD_MIN` | 30 minutos | 2.2 — renovación deslizante |
| `SESION_MAXIMA_HORAS` | 8 horas | 2.2 — tope absoluto |
| `login_max_intentos` | 5 | 3.3 |
| `login_ventana_minutos` | 15 minutos | 3.3 |

> **Revisión 3.** Sin cambios en los parámetros de `ParametroSistema`. Las constantes nuevas del módulo, que **no** son parámetros configurables (P-A8): `MINUTOS_VALIDEZ_ENLACE_RECUPERACION = 30` (2.7) y `MAX_SOLICITUDES_RECUPERACION_POR_HORA = 3` (2.7.1). Variables de entorno nuevas (Regla N.° 9; las documenta el PR 0 en `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM` y la URL pública del sistema (`NEXTAUTH_URL`, que NextAuth ya necesita).
```
