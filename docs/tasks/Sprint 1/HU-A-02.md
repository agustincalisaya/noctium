# TASK: HU-A-02 — Mantener sesión

**Módulo:** A (Sesión)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_A.md` sección 2.2 · reglas sección 3.5 (parcial, ver Nota de alcance) · eventos sección 4 (sin eventos nuevos en esta task) · `docs/tasks/HU-Sprint-1.md` HU-A-02, criterio de aceptación 6 (protección de caché del navegador)
**RBAC:** esta HU **crea** el mecanismo (`withPermission()`) y el modelo `RolPermiso` (matriz rol → acción). No consume permisos de otros módulos porque todavía no existen — ver punto abierto en sección 1.
**Schema:** agrega vía migración nueva el modelo `RolPermiso` (`id`, `rol` enum `RolUsuario`, `accion` string, `created_at`). `Usuario`, `RolUsuario` e `IntentoAccesoFallido` ya existen (HU-A-01). `TokenRevocado` **todavía no existe** — lo crea HU-A-03 (ver Nota de alcance, punto crítico de esta task).

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno) — en particular `lib/auth/auth.config.ts`, ya existente desde HU-A-01.
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance — desacoplamiento entre HU-A-01, HU-A-02 y HU-A-03

`spec_modulo_A.md` §2.2 describe la renovación deslizante y el middleware `withPermission()` como una sola pieza, incluyendo un paso de verificación contra `TokenRevocado`. Esta task implementa **todo lo de §2.2 excepto ese paso puntual**, porque `TokenRevocado` es un modelo que crea recién HU-A-03 — implementarlo acá adelantaría schema y lógica de una HU que todavía no se hizo, violando el criterio de "diff acotado a esta HU" del checklist.

**Punto abierto — orden real entre HU-A-02 y HU-A-03 (relevar antes de implementar, no resolver por inferencia):** la spec, tal como está redactada en su revisión actual, ubica el chequeo de revocación dentro del comportamiento de `withPermission()` (HU-A-02) pero el modelo que ese chequeo necesita (`TokenRevocado`) pertenece a HU-A-03. Hay dos formas válidas de resolverlo y hay que confirmar con el equipo/PO cuál se sigue:
- **(a)** `withPermission()` se construye en esta task con el paso de revocación **stubbeado** (comentario `// TODO(HU-A-03): verificar contra TokenRevocado` + un chequeo que hoy siempre pasa), y HU-A-03 lo completa cuando cree el modelo.
- **(b)** Esta task deja el paso de revocación completamente fuera del middleware (ni siquiera el stub), y HU-A-03 lo agrega como una modificación explícita a `with-permission.ts` además de crear `TokenRevocado`.

Mientras no se confirme, esta task avanza asumiendo **(a)** por ser la opción que dificulta menos que HU-A-03 lo olvide, pero queda marcado como "DECISIÓN A CONFIRMAR", no "DECISIÓN RESUELTA" — Claude Code debe re-preguntarlo en el relevamiento (sección 0) antes de tocar código.

**Fuera de alcance de esta task (explícito):**
- Verificación efectiva contra `TokenRevocado` — HU-A-03 (ver punto abierto arriba).
- Cierre de sesión y todo lo que dependa de él — HU-A-03.
- Contenido de la matriz RBAC real de los demás módulos (`"turno:crear"`, `"alumno:editar"`, etc.) — esos módulos todavía no tienen tasks implementadas en este sprint más allá de esta. Esta task solo deja **el mecanismo** (`RolPermiso`, `withPermission()`) listo para que cada módulo futuro registre sus propias acciones sin volver a tocar esta capa.
- Pantallas principales por rol — siguen sin existir (mismo punto abierto que HU-A-01, todavía no resuelto).

---

## 2. Historia de Usuario

**Como** usuario autenticado
**Necesito** que mi sesión se mantenga activa mientras estoy usando el sistema, y que se me avise antes de que expire
**Para** no perder mi trabajo por una desconexión inesperada, sin que eso debilite la seguridad de rutas que no me corresponden

**SP estimado:** 3

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_A.md` §2.2 (con la excepción de la sección 1). Incluye:
- Migración nueva: modelo `RolPermiso` (`rol`, `accion`), con seed mínimo — ver punto abierto en sección 4.3.
- `callbacks.jwt` en `lib/auth/auth.config.ts` (ya existente desde HU-A-01): agregar la rama de renovación deslizante fuera del `trigger === "signIn"`.
- `callbacks.session`: exponer `expires` de forma no sensible para que el cliente pueda calcular el aviso de expiración.
- Middleware `withPermission(accion: string)` (`lib/auth/with-permission.ts`), nuevo.
- **Cabeceras de no-cache en toda ruta protegida** (`Cache-Control: no-store`), para que una pantalla autenticada nunca quede servible desde el caché del navegador tras vencer la sesión o volver atrás (`HU-Sprint-1.md`, HU-A-02, criterio de aceptación 6) — ver 4.3.
- Endpoint de "ping" de renovación liviano (`app/api/auth/ping/route.ts`), protegido por `withPermission()` con una acción mínima (ver punto abierto 4.3), sin efecto de negocio más allá de forzar la renovación del JWT.
- UI: aviso de expiración próxima con botón "Continuar sesión".

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Cualquier chequeo real contra `TokenRevocado` (no existe todavía).
- `app/api/auth/logout/route.ts` y su lógica (HU-A-03).
- Registrar acciones RBAC de otros módulos.

---

## 4. Contrato Backend

### 4.1. Schema Zod

No aplica un schema de entrada nuevo — el "ping" de renovación no recibe payload (`POST` vacío, autenticado). Si en el relevamiento se decide que necesita un body, se define ahí; por default no lo tiene.

### 4.2. Servicio

No hay una función de servicio de negocio nueva en el sentido de `lib/services/sesion/autenticacion.service.ts` — la renovación es lógica de callback de NextAuth y el middleware es infraestructura transversal, no un servicio de dominio. Si el relevamiento encuentra lógica que conviene extraer a una función pura testeable (p. ej. el cálculo de `exp` y el chequeo del tope de 8h), se propone como `calcularRenovacionSesion(claims: JWTClaims, now: number)` en `lib/services/sesion/renovacion.service.ts` para poder testearla sin levantar NextAuth — **relevar antes de decidirlo**, ya que la spec no obliga a esta extracción, es una decisión de testabilidad.

**Comportamiento exigido en `callbacks.jwt` (rama de renovación, fuera de `trigger === "signIn"`), en este orden exacto (`spec_modulo_A.md` §2.2):**
1. Si `now >= exp` del token entrante: no renovar — NextAuth ya lo trata como sesión inválida en `callbacks.session` / el middleware lo rechaza (paso 4.3.1).
2. Si `now - iat_sesion > SESION_MAXIMA_HORAS` (8h, parámetro configurable): no renovar aunque `now < exp` — la sesión vence igual al llegar a las 8h absolutas desde el login.
3. Si pasa ambos chequeos: `exp = now + SESION_INACTIVIDAD_MIN` (30min, parámetro configurable), `iat = now`. `iat_sesion` se copia tal cual del token entrante — **nunca se reescribe**.
4. `sub`, `rol`, `jti` se propagan sin cambios.

**Comportamiento exigido en `callbacks.session`:**
- Expone `{ user: { id, rol }, expires }` — `expires` es lo único que el cliente usa para calcular el aviso de expiración próxima. Nunca expone `jti` (evita que el cliente lo use para nada — es un dato de control interno).

### 4.3. Middleware `withPermission()` y protección de caché

**Archivo:** `lib/auth/with-permission.ts`
**Función:** `withPermission(accion: string)` — higher-order function que envuelve un Route Handler o valida al inicio de un Server Action.

Comportamiento exigido, en este orden:
1. Verificar firma y vencimiento del JWT (delegado a NextAuth, `auth()`). Si no hay sesión válida → `401 SESION_INVALIDA`, no se ejecuta el handler envuelto.
2. **(stub, ver sección 1, opción (a) asumida):** punto donde HU-A-03 insertará la verificación contra `TokenRevocado`. Esta task deja el placeholder comentado, sin lógica real.
3. Verificar que `rol` del token tenga `accion` en `RolPermiso` (consulta indexada por `[rol, accion]`). Si no → `403 SIN_PERMISO`, sin ejecutar el handler envuelto ni modificar datos.
4. Si todo pasa: ejecutar el handler envuelto normalmente.

**Cabeceras de no-cache (`HU-Sprint-1.md` HU-A-02, criterio de aceptación 6):** toda respuesta de una ruta protegida por `withPermission()` — y toda página del layout autenticado — debe incluir `Cache-Control: no-store, must-revalidate` (o el equivalente que exponga Next.js App Router para Server Components/Route Handlers). El objetivo es que, tras vencer la sesión o cerrarla, "volver atrás" en el navegador o reabrir la URL no muestre una versión cacheada de una pantalla protegida con datos reales.

**Punto abierto — mecanismo exacto para aplicar `no-store` de forma consistente (relevar antes de implementar):** Next.js 16 App Router tiene varias superficies donde esto puede fijarse (headers en `withPermission()` para Route Handlers, `export const dynamic = "force-dynamic"` + headers manuales para Server Components de páginas protegidas, o un middleware de Next.js a nivel de todo el árbol `app/(dashboard)/**`). La spec no lo resuelve porque es un detalle de implementación del framework, no de negocio. **Se propone** aplicarlo en dos puntos: (i) dentro de `withPermission()`, seteando el header en toda respuesta de Route Handler; (ii) en el layout de `app/(dashboard)/layout.tsx`, forzando `dynamic = "force-dynamic"` para que ninguna página protegida se sirva desde caché estática — a confirmar con el equipo antes de implementar, ya que afecta el rendimiento (ninguna pantalla protegida sería cacheable ni estática).

**Punto abierto — contenido del seed de `RolPermiso` para esta task (relevar antes de implementar):** ningún otro módulo tiene todavía una task implementada, así que no hay acciones reales que registrar (`"turno:crear"`, etc. no existen aún). Para que el endpoint de ping (necesario para probar el propio middleware) tenga algo que verificar, se necesita al menos una acción mínima por rol — por ejemplo `"sesion:ping"` asignada a los 4 roles. **Confirmar con el equipo** si esa acción placeholder se llama así o de otra forma, y si conviene documentar en `spec_modulo_A.md` §2.2 que la matriz real se puebla de forma incremental, módulo por módulo, a medida que cada uno define sus propias acciones (nota de sincronización a agregar en la spec una vez resuelto esto, no en silencio).

**Errores de servicio/middleware a definir:** `SESION_INVALIDA` (401), `SIN_PERMISO` (403) — shapes exactos ya definidos en `spec_modulo_A.md` §2.2.

### 4.4. Route Handler — ping de renovación

**Archivo:** `app/api/auth/ping/route.ts`
**Método:** `POST`
**Permiso de acceso:** `withPermission("sesion:ping")` (sujeto al punto abierto de 4.3)

Sin lógica de negocio: el solo hecho de pasar por `withPermission()` ya dispara `callbacks.jwt` y renueva el `exp`. Responde `{ data: { renovado: true }, error: null }`.

### 4.5. Eventos de dominio

No hay eventos nuevos en esta task. La renovación de sesión y los `403 SIN_PERMISO` **no** generan un evento de auditoría en esta revisión de la spec — si el equipo considera que un `403` repetido debería auditarse (indicio de intento de acceso indebido), es una ampliación a proponer como revisión aditiva de `spec_modulo_A.md`, no algo a decidir dentro de esta task.

---

## 5. Frontend

- Componente de aviso de expiración próxima (p. ej. `components/sesion/aviso-expiracion.tsx`), montado en el layout autenticado: compara `session.expires` (expuesto por `callbacks.session`) contra la hora actual en el cliente, y se activa a un umbral configurable antes del vencimiento (**punto abierto — relevar antes de implementar:** ¿cuántos minutos antes se muestra el aviso? La spec no lo fija; se propone 5 minutos por default, a confirmar).
- Botón "Continuar sesión" dentro del aviso: invoca el endpoint de ping (4.4), lo que renueva la sesión sin recargar la página; al responder OK, el aviso se oculta.
- Si el usuario no interactúa y el token efectivamente expira, la siguiente solicitud protegida devuelve `401 SESION_INVALIDA` — el manejo de ese caso (redirect a `/login`) es transversal y puede resolverse con un interceptor común a todo `fetch` autenticado; **relevar antes de implementar** si ya existe un wrapper de fetch en el proyecto o hay que crear uno acá.
- **Protección de caché (`HU-Sprint-1.md` HU-A-02, criterio de aceptación 6):** una vez vencida la sesión, usar el botón "Atrás" del navegador o reabrir una URL protegida por historial no debe mostrar, ni siquiera momentáneamente, la última versión renderizada de una pantalla con datos reales — depende de las cabeceras `no-store` de la sección 4.3, pero el frontend debe verificarlo explícitamente (no asumir que basta con el header del lado del servidor): si al volver atrás la ruta protegida se sirve sin datos (porque no hay sesión), el layout debe redirigir a `/login` inmediatamente en vez de renderizar una pantalla vacía o con placeholders confusos.

**Fuera de alcance de frontend:** cualquier pantalla principal por rol (sigue sin existir, mismo punto abierto que HU-A-01).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- Renovación con `now < exp` y `now - iat_sesion < 8h` → nuevo `exp = now + 30min`, `iat_sesion` sin cambios.
- Renovación con `now - iat_sesion > 8h` (aunque falten minutos para `exp`) → no se renueva, la sesión vence.
- `iat_sesion` nunca se reescribe entre dos renovaciones sucesivas (comparar dos llamadas seguidas).
- `withPermission()` con JWT inválido/vencido → `401 SESION_INVALIDA`, el handler envuelto no se ejecuta (mock/spy).
- `withPermission()` con rol sin la acción en `RolPermiso` → `403 SIN_PERMISO`, el handler envuelto no se ejecuta (mock/spy) — verificar explícitamente que no hubo ninguna escritura a base de datos.
- `withPermission()` con rol que sí tiene la acción → el handler envuelto se ejecuta.

### Nivel 2 — Postman
- Request autenticado dentro del `exp` vigente y dentro de las 8h → cookie de sesión renovada en la respuesta (`Set-Cookie` con nuevo `exp`).
- Request autenticado pasadas las 8h desde `iat_sesion` → `401 SESION_INVALIDA` aunque el `exp` individual no hubiera vencido.
- Request a un endpoint protegido por una acción que el rol no tiene → `403 SIN_PERMISO`.
- Request al endpoint de ping (4.4) → `200`, cookie renovada.
- **Toda respuesta de una ruta protegida incluye el header `Cache-Control: no-store`** (verificar explícitamente en la respuesta cruda de Postman, no solo el comportamiento visual).

### Nivel 3 — BD / TablePlus
- Verificar filas sembradas en `RolPermiso` tras la migración/seed (contenido sujeto al punto abierto de 4.3).
- Verificar en `AuditLog` que ningún evento espurio se generó por una renovación de sesión o un `403` (esta task no define eventos — confirmar que efectivamente no aparece nada nuevo ahí).

**Evidencia esperada:** Postman + SQL para el contrato de API y capa de datos; captura del aviso de expiración próxima y de su desaparición tras "Continuar sesión"; captura del comportamiento del navegador (botón Atrás / URL directa) sobre una ruta protegida después de vencida la sesión, mostrando el redirect a `/login` sin datos residuales.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Punto abierto de la sección 1 (orden real HU-A-02/HU-A-03 para el chequeo de revocación) resuelto y documentado como "DECISIÓN RESUELTA" antes del merge.
- [ ] Punto abierto de la sección 4.3 (contenido del seed de `RolPermiso`, nombre de la acción placeholder) resuelto y, si corresponde, agregado como nota de sincronización a `spec_modulo_A.md`.
- [ ] Punto abierto de la sección 4.3 (mecanismo exacto para aplicar `Cache-Control: no-store` en rutas y pantallas protegidas) resuelto y documentado.
- [ ] Punto abierto de la sección 5 (umbral de minutos para el aviso de expiración) resuelto.
- [ ] `callbacks.jwt`, `callbacks.session` y `withPermission()` implementados sin lógica de negocio fuera de lo estrictamente necesario (o extraídos a servicio testeable, si así se decidió en 4.2).
- [ ] Respuestas conforme al shape estándar `{ data, error }` con los códigos `SESION_INVALIDA`/`SIN_PERMISO` exactos de la spec.
- [ ] Ningún evento de dominio nuevo introducido sin que corresponda (ver 4.5).
- [ ] Frontend funcional: aviso de expiración próxima, botón "Continuar sesión", manejo de `401` en el cliente, verificación de que no queda información privada visible al volver atrás o reabrir una URL protegida tras vencer la sesión.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia, incluyendo la verificación del header `Cache-Control: no-store`.
- [ ] PR con diff acotado exclusivamente a HU-A-02 (sin adelantar el chequeo real de `TokenRevocado`, que es de HU-A-03).