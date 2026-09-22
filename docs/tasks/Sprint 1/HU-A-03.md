# TASK: HU-A-03 — Cerrar sesión

**Módulo:** A (Sesión)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_A.md` sección 2.3 · reglas sección 3.5 · eventos sección 4 · `docs/tasks/HU-Sprint-1.md` HU-A-03, criterios de aceptación 2, 4 y 5 (confirmación de cambios sin guardar, mensaje de éxito, protección de caché)
**RBAC:** el logout es una acción disponible para cualquier usuario autenticado sobre su propia sesión — no requiere una acción granular nueva en `RolPermiso` (no es "acceso a una sección", es cerrar la que ya tiene).
**Schema:** agrega vía migración nueva el modelo `TokenRevocado` (`jti` único, `usuario_id`, `expira_en`, `created_at`). `Usuario`, `RolUsuario`, `IntentoAccesoFallido` (HU-A-01) y `RolPermiso` (HU-A-02) ya existen.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno) — en particular `lib/auth/with-permission.ts`, creado en HU-A-02 con un paso stubbeado que esta task debe completar.
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance — cierre del punto abierto dejado por HU-A-02

HU-A-02 implementó `withPermission()` con un paso 2 stubbeado (comentario `// TODO(HU-A-03): verificar contra TokenRevocado`, sin lógica real), bajo la opción (a) documentada en su sección 1. **Esta task es la que cumple esa promesa:** crea `TokenRevocado` y reemplaza el stub por la verificación real. Si al llegar a esta task esa opción (a) nunca se confirmó como "DECISIÓN RESUELTA" en HU-A-02 (es decir, se optó por la opción (b): dejar el paso completamente afuera del middleware en vez de un stub), esta task debe **agregar** el paso al middleware en lugar de reemplazar un stub — Claude Code debe verificar el estado real de `with-permission.ts` en el relevamiento (sección 0) antes de asumir cuál de las dos versiones encuentra.

También cierra el punto abierto de protección de caché dejado en HU-A-02 (§5): si HU-A-02 ya implementó `Cache-Control: no-store` en las rutas/pantallas protegidas, esta task **no** debe reimplementarlo — solo debe **verificarlo como regresión** (sección 6), ya que el criterio de aceptación 5 de esta HU (`HU-Sprint-1.md`) es el mismo mecanismo aplicado al momento específico del logout.

**Fuera de alcance de esta task (explícito):**
- Cualquier cambio a `callbacks.jwt` / renovación deslizante — ya cerrado en HU-A-02.
- Purga o limpieza periódica de filas vencidas de `TokenRevocado` (`expira_en < now`) — la spec (`spec_modulo_A.md` §2.3, punto 1) menciona la posibilidad de purgar más adelante pero no la exige en este sprint; **no** se implementa un job de limpieza acá.
- Invalidación de todas las sesiones de un usuario (logout global multi-dispositivo) — la Regla de negocio 3.5 de la spec es explícita: la revocación es por `jti` individual, no por usuario. Fuera de alcance salvo que una HU futura lo pida.
- Reimplementar las cabeceras `no-store` de rutas protegidas — ya son responsabilidad de HU-A-02 (ver arriba).

---

## 2. Historia de Usuario

**Como** usuario autenticado
**Necesito** poder cerrar mi sesión de forma explícita
**Para** que mis credenciales no queden accesibles si dejo el dispositivo desatendido

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_A.md` §2.3 y a los criterios de aceptación 1-6 de HU-A-03 en `HU-Sprint-1.md`. Incluye:
- Migración nueva: modelo `TokenRevocado`.
- Servicio `cerrarSesion(jti, usuarioId, ip)` en `lib/services/sesion/autenticacion.service.ts` (mismo archivo que `verificarCredenciales`, HU-A-01).
- Route Handler `app/api/auth/logout/route.ts` (wrapper sobre `signOut()` de NextAuth, extendido con la revocación).
- Completar el paso 2 de `withPermission()` (`lib/auth/with-permission.ts`, HU-A-02) con la verificación real contra `TokenRevocado`.
- Emisión del evento `sesion:cierre`.
- UI: botón/acción de "Cerrar sesión" con confirmación condicional por cambios sin guardar, y mensaje de éxito tras el logout.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Job de purga de `TokenRevocado`.
- Logout multi-dispositivo / invalidación global por usuario.
- Cualquier pantalla más allá del botón de logout y el redirect resultante.

---

## 4. Contrato Backend

### 4.1. Schema Zod

No aplica un schema de entrada — el logout no recibe payload del cliente; `jti` y `usuarioId` se resuelven server-side desde la sesión vigente (`auth()`), nunca desde un parámetro que el cliente pueda manipular.

### 4.2. Servicio

**Archivo:** `lib/services/sesion/autenticacion.service.ts`
**Función:** `cerrarSesion(jti: string, usuarioId: string, ip: string): Promise<{ revocado: boolean }>`

Comportamiento exigido, en este orden (`spec_modulo_A.md` §2.3):
1. Insertar `jti` en `TokenRevocado` con `expira_en` igual al `exp` original del token que se está cerrando (no `now + algo` — el valor tal cual venía en el JWT, para poder purgar después sin cubrir de más ni de menos).
2. Si el `INSERT` falla por error de comunicación con la base: **igual se responde éxito al cliente** (ver 4.3) y se reintenta la revocación en segundo plano — el usuario no debe quedar bloqueado en un estado intermedio esperando confirmación de la base. Como respaldo, si el reintento nunca prospera, el token de todos modos deja de ser válido al vencer naturalmente (máximo `SESION_INACTIVIDAD_MIN`, 30min).
3. **Después de la resolución** (haya insertado en el paso 1 o esté reintentando en background): emitir `sesion:cierre` (sección 4.4).

**Punto abierto — mecanismo del reintento en background (relevar antes de implementar):** la spec exige que el fallo del `INSERT` no bloquee la respuesta al cliente, pero no especifica el mecanismo del reintento (una cola, un `setImmediate`/`queueMicrotask` con un reintento simple, o directamente confiar en el respaldo del vencimiento natural sin reintentar). Dado que el propio respaldo (vencimiento a los 30min) ya acota el daño, **se propone no implementar un reintento explícito en este sprint** — loguear el error y confiar en el respaldo — pero es una simplificación respecto de lo que sugiere la letra de la spec ("se reintenta la revocación en segundo plano") y debe confirmarse con el equipo antes de dar la task por resuelta; si se confirma, se anota en `spec_modulo_A.md` §2.3 como nota de sincronización.

**Errores de servicio a definir:** ninguno que se propague al cliente — el paso 2 explícitamente evita que un fallo de base se traduzca en un error visible.

### 4.3. Route Handler

**Archivo:** `app/api/auth/logout/route.ts`
**Método:** `POST`
**Permiso de acceso:** ninguno adicional a estar autenticado (no pasa por `withPermission()` con una acción granular — cualquier sesión válida puede cerrarse a sí misma; ver RBAC en el encabezado). Al estar bajo el layout autenticado, hereda de todos modos las cabeceras `no-store` que HU-A-02 aplicó a nivel general — no requiere configuración adicional en esta task.

Comportamiento:
1. Resolver `jti`, `usuarioId` desde la sesión vigente (`auth()`) — nunca desde el body.
2. Invocar `cerrarSesion(jti, usuarioId, ip)`.
3. Responder eliminando la cookie de sesión (`Max-Age=0`) en la respuesta — el cliente no puede hacerlo por JS al ser `HttpOnly`, así que es el server quien la invalida explícitamente en los headers de la respuesta.

**Respuesta `200 OK`:**
```json
{ "data": { "revocado": true }, "error": null }
```

### 4.4. Completar `withPermission()` — paso de revocación

**Archivo:** `lib/auth/with-permission.ts` (modificar, creado en HU-A-02)

Reemplazar el stub del paso 2 por:
```typescript
const revocado = await prisma.tokenRevocado.findUnique({ where: { jti: claims.jti } });
if (revocado) return unauthorized("SESION_INVALIDA");
```
Consulta indexada por `jti` (ya único por definición de schema). No es una condición+mutación atómica en el sentido de la Regla N.° 7 — es una lectura pura, no hay carrera que resolver acá.

### 4.5. Eventos de dominio

**Archivo:** `lib/events/event-types.ts` — agregar `sesion:cierre` si no está ya declarado desde la spec original.

Se emite después de que `cerrarSesion()` resuelve (paso 3 de 4.2), tanto si el `INSERT` de `TokenRevocado` se completó en el momento como si quedó en el camino del respaldo por vencimiento natural — el cierre de sesión desde la perspectiva del usuario ya ocurrió (cookie eliminada) independientemente de ese detalle interno.

**Listener de auditoría:** agregar el handler en `audit-log.listener.ts`, patrón `void registrarAuditLog(...)` — nunca `await`.

---

## 5. Frontend

- Botón/acción "Cerrar sesión", visible en el menú de usuario en todas las pantallas autenticadas, **siempre en el mismo lugar, junto al nombre y rol del usuario** (`HU-Sprint-1.md`, HU-A-03, criterio de aceptación 1) — disponible para los 4 roles por igual.
- **Confirmación condicional por cambios sin guardar (criterio de aceptación 2):** antes de ejecutar el logout, verificar si hay algún formulario abierto con cambios sin guardar; si los hay, mostrar un diálogo de confirmación con el texto exacto "Tenés cambios sin guardar. ¿Querés cerrar sesión igualmente?" — si el usuario cancela, permanece en la pantalla con los datos intactos, sin ejecutar el logout. **Punto abierto (relevar antes de implementar):** el proyecto todavía no tiene un mecanismo transversal para que un formulario "avise" al layout que tiene cambios sin guardar (algo tipo un contexto de React o un estado global de "dirty"). Esta task es la primera en necesitarlo — definir con el equipo si se construye acá un mecanismo mínimo reutilizable (ej. un `DirtyFormContext`) o si, dado que en este sprint casi no hay formularios de edición todavía (solo altas, sin modificación salvo HU-B-06 que no forma parte de estas 7 HU), se simplifica a que el diálogo solo se dispare si el usuario está en medio de escribir en el propio formulario de alta de Materia/Aula (detectado con un simple `beforeunload`-like state local a esas páginas, sin mecanismo global).
- Al confirmar (o si no había cambios sin guardar): invoca `POST /api/auth/logout`, y en la respuesta exitosa redirige a `/login` mostrando **"Sesión cerrada correctamente"** (`HU-Sprint-1.md`, HU-A-03, criterio de aceptación 4) — mensaje que no estaba en la revisión anterior de esta task y se incorpora acá.
- Mientras la solicitud está en curso: botón deshabilitado (mismo patrón de estados de carga que HU-A-01).
- Si la solicitud falla por error de comunicación (no por lógica de negocio — el servicio no devuelve errores de negocio en este flujo): igual redirige a `/login` tras un timeout corto, ya que del lado del cliente no hay nada más que se pueda hacer con esa sesión de todos modos — **punto abierto (relevar antes de implementar):** confirmar si este comportamiento (redirect igual, optimista) es aceptable o si se prefiere un mensaje de error y reintento manual.
- **Protección de caché tras el cierre (criterio de aceptación 5):** tras el logout, recargar, volver atrás o abrir una URL protegida debe exigir nueva autenticación sin mostrar información privada, ni momentáneamente. Este comportamiento depende directamente de las cabeceras `Cache-Control: no-store` que HU-A-02 aplicó a las rutas/pantallas protegidas (ver sección 1) — esta task no reimplementa ese mecanismo, solo lo verifica como regresión puntual sobre el caso específico de "justo después de cerrar sesión" (sección 6, Nivel 2).

**Fuera de alcance de frontend:** contenido real de las pantallas principales por rol.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- `cerrarSesion()` exitoso → inserta en `TokenRevocado` con `expira_en` igual al `exp` original del token, retorna `{ revocado: true }`.
- Simular fallo del `INSERT` (mock de Prisma) → igual retorna `{ revocado: true }` al caller, sin lanzar.
- `withPermission()` con un `jti` presente en `TokenRevocado` → `401 SESION_INVALIDA`, el handler envuelto no se ejecuta (mock/spy) — este es el caso que HU-A-02 dejó sin cubrir por el stub.
- `withPermission()` con un `jti` que no está en `TokenRevocado` → pasa este paso normalmente (regresión sobre HU-A-02).
- El evento `sesion:cierre` se emite con el payload correcto (`usuario_id, jti, ip`), después de que `cerrarSesion()` resuelve.

### Nivel 2 — Postman
- Logout exitoso → `200`, `Set-Cookie` con `Max-Age=0` en la respuesta.
- Solicitud posterior con la misma cookie/token (si se reenvía manualmente el JWT ya "cerrado") → `401 SESION_INVALIDA` en cualquier ruta protegida — este es el test de integración real de la revocación.
- Logout sin sesión vigente (sin cookie) → verificar el comportamiento (probablemente `401`, a confirmar contra el comportamiento estándar de la ruta protegida si el Route Handler decide pasar por `withPermission()` o no — **relevar en la sección 0** si esta ruta debe exigir sesión previa o tolerar llamarse sin ella).
- **Regresión de caché (criterio de aceptación 5):** tras el logout, una solicitud a una ruta protegida con el token ya revocado devuelve `401` con `Cache-Control: no-store` presente en la respuesta — confirma que el mecanismo de HU-A-02 sigue funcionando también inmediatamente después de un cierre de sesión explícito, no solo tras un vencimiento pasivo.

### Nivel 3 — BD / TablePlus
- Verificar la fila creada en `TokenRevocado` tras un logout (`jti`, `usuario_id`, `expira_en`, `created_at`).
- Verificar en `AuditLog` que `sesion:cierre` quedó encadenado con hash SHA-256 intacto, continuando la cadena de los eventos de HU-A-01 (login) sin romperla.

**Evidencia esperada:** Postman + SQL para el contrato de API y capa de datos; captura del flujo de logout (botón → diálogo de confirmación si hay cambios sin guardar → redirect a `/login` con el mensaje de éxito); captura del comportamiento del navegador (botón Atrás / URL directa) inmediatamente después del logout.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar, incluyendo verificar en qué estado quedó `with-permission.ts` desde HU-A-02 (stub vs. paso ausente) y si las cabeceras `no-store` ya están aplicadas.
- [ ] Punto abierto de la sección 4.2 (mecanismo de reintento en background) resuelto y documentado; si se simplifica respecto de la letra de la spec, anotado como nota de sincronización en `spec_modulo_A.md` §2.3.
- [ ] Punto abierto de la sección 5 (mecanismo de detección de "cambios sin guardar" — global vs. acotado a esta sprint) resuelto.
- [ ] Punto abierto de la sección 5 (comportamiento del cliente ante fallo de comunicación en el logout) resuelto.
- [ ] Punto abierto de Nivel 2 (logout sin sesión vigente) resuelto y testeado.
- [ ] Service, Route Handler y el paso completado de `withPermission()` implementados, sin lógica de negocio fuera de la capa de servicios.
- [ ] Respuesta conforme al shape estándar `{ data, error }`.
- [ ] Evento `sesion:cierre` emitido después de que el servicio resuelve, nunca con datos sensibles en el payload.
- [ ] Frontend funcional: botón de logout junto a nombre/rol, diálogo de confirmación condicional por cambios sin guardar, mensaje "Sesión cerrada correctamente", redirect a `/login`.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia, incluyendo el test de regresión de HU-A-02 (revocación efectiva) y el de protección de caché tras el logout.
- [ ] PR con diff acotado exclusivamente a HU-A-03 (el cambio a `with-permission.ts` es el único tocado fuera de los archivos nuevos, y es exactamente el que HU-A-02 dejó pendiente — no más).