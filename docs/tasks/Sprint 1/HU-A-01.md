# TASK: HU-A-01 — Iniciar sesión

**Módulo:** A (Sesión)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_A.md` sección 2.1 · reglas sección 3.1, 3.2, 3.3, 3.4 · eventos sección 4 · `docs/tasks/HU-Sprint-1.md` HU-A-01, criterios de aceptación 2 (TLS/JWT) y 6 (mensaje de error de comunicación)
**RBAC:** no existe ningún permiso todavía — esta HU es la base sobre la que se construye `withPermission()` (HU-A-02); el login en sí es una superficie pública, sin sesión previa.
**Schema:** no existe todavía — es la **primera task del proyecto**. Se crean vía migración nueva: modelo `Usuario` (`id`, `email` único, `password_hash`, `rol` enum, `is_active`, `created_at`, `updated_at`), enum `RolUsuario` (`MESA_ENTRADA`, `PROFESOR`, `GERENTE`, `ALUMNO`), y modelo `IntentoAccesoFallido` (`email`, `ip`, `created_at`). El modelo `TokenRevocado` **no** se crea acá — lo agrega HU-A-03, que es la primera task que lo necesita.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance — desacoplamiento entre HU-A-01, HU-A-02 y HU-A-03

`spec_modulo_A.md` documenta el Módulo A completo (login, mantenimiento y cierre de sesión) en una sola spec, pero las tres HU se implementan en tasks separadas y en ese orden. Esta task cubre **exclusivamente** el flujo de login (spec §2.1): verificación de credenciales, mint inicial del JWT y redirección por rol. Las siguientes piezas, aunque están descriptas en `spec_modulo_A.md`, **no** se implementan acá:

- **Renovación deslizante del token en solicitudes subsecuentes** (`spec_modulo_A.md` §2.2, `callbacks.jwt` fuera de la rama de sign-in) y el middleware `withPermission()` que protege el resto de las rutas del sistema — ambos son HU-A-02.
- **Verificación contra la lista de revocación (`TokenRevocado`)** en cada solicitud — también HU-A-02, ya que el modelo ni siquiera existe hasta HU-A-03.
- **Cierre de sesión e inserción en `TokenRevocado`** — HU-A-03.

**Fuera de alcance de esta task (explícito):**
- Recuperación de contraseña y 2FA — fuera de alcance de `spec_modulo_A.md` completa, no solo de esta task.
- Pantallas principales completas por rol — solo se implementa el redirect hacia una ruta por rol; el contenido de esas pantallas pertenece a otros módulos.
- La pantalla de autorregistro (HU-B-08) — el login solo debe ofrecer el enlace "Crear cuenta" apuntando a esa ruta, sin implementarla.

---

## 2. Historia de Usuario

**Como** usuario registrado (personal de mesa de entrada, profesor, gerente o alumno)
**Necesito** acceder de forma segura a las funciones habilitadas para mi rol
**Para** operar el sistema desde el primer momento sin exponer credenciales ni acceder a funciones que no le corresponden

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_A.md` §2.1. Incluye:
- Migración inicial: modelos `Usuario`, `IntentoAccesoFallido`, enum `RolUsuario`.
- Capa de servicios (`lib/services/sesion/autenticacion.service.ts` → `verificarCredenciales()`, `verificarRateLimit()`, `registrarIntentoFallido()`).
- Configuración base de NextAuth con Credentials Provider (`lib/auth/auth.config.ts`) y su Route Handler (`app/api/auth/[...nextauth]/route.ts`).
- Schema Zod (`lib/schemas/sesion.schema.ts` → `CredencialesLoginSchema`).
- Emisión de eventos de dominio (`sesion:inicio_exitoso`, `sesion:intento_fallido`, `sesion:cuenta_inactiva_rechazada`).
- UI: pantalla de login, con sus estados de carga/error y el redirect por rol.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- `middleware.ts` de protección general de rutas (HU-A-02).
- Cualquier pantalla principal por rol más allá del redirect a su ruta.
- Botón "Crear cuenta" funcional — solo el enlace, sin la pantalla destino.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `lib/schemas/sesion.schema.ts`

```typescript
export const CredencialesLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type CredencialesLoginInput = z.infer<typeof CredencialesLoginSchema>;
```

### 4.2. Servicio

**Archivo:** `lib/services/sesion/autenticacion.service.ts`
**Función:** `verificarCredenciales(email: string, password: string, ip: string): Promise<{ id: string; rol: RolUsuario }>`

Comportamiento exigido, en este orden exacto (`spec_modulo_A.md` §2.1, paso a paso):
1. `verificarRateLimit(email, ip)` — cuenta `IntentoAccesoFallido` en los últimos 15 minutos para ese `email` + `ip`; si `>= 5`, lanza `RATE_LIMIT_EXCEDIDO` **antes** de tocar `Usuario`.
2. Buscar `Usuario` por `email` (ya normalizado por el schema).
3. Si no existe: comparar `password` contra el hash de referencia fijo (`DUMMY_PASSWORD_HASH`) — nunca hacer `return` anticipado sin comparar (Regla de negocio 3.1 de la spec).
4. Si existe: `bcrypt.compare(password, usuario.password_hash)`.
5. Si la comparación falla (en cualquiera de los dos casos): `registrarIntentoFallido(email, ip)` (INSERT síncrono, no vía evento) y lanzar `CREDENCIALES_INVALIDAS`.
6. Si la comparación es exitosa: recién ahora evaluar `usuario.is_active`. Si es `false`: lanzar `CUENTA_INACTIVA` sin crear sesión.
7. Si todo es válido: retornar `{ id: usuario.id, rol: usuario.rol }` — nunca `password_hash` ni otros datos personales.

No hay `prisma.$transaction` multi-tabla en este flujo: es una operación de lectura con un único `INSERT` síncrono condicional (paso 5).

**Errores de servicio a definir:** `CREDENCIALES_INVALIDAS`, `CUENTA_INACTIVA`, `RATE_LIMIT_EXCEDIDO`.

### 4.3. Configuración de NextAuth (en lugar de un Route Handler propio)

**Archivo:** `lib/auth/auth.config.ts`

- `CredentialsProvider.authorize(credentials)`: valida con `CredencialesLoginSchema.safeParse()` (`400`/`null` si falla), invoca `verificarCredenciales()`, traduce el resultado al `user` que NextAuth espera (`{ id, rol }`) o a un rechazo.
- `session: { strategy: "jwt" }`, `secret: process.env.NEXTAUTH_SECRET` (Regla N.° 9 de `docs/RULES.md` — nunca hardcodeado).
- **Algoritmo del JWT: HS256** (`HU-Sprint-1.md`, HU-A-01, criterio de aceptación 3) — es el default de NextAuth con `strategy: "jwt"` y `NEXTAUTH_SECRET` simétrico, pero se fija explícitamente en la configuración (no se deja implícito) para que quede documentado y no dependa de que el default no cambie entre versiones de `next-auth@beta`.
- Cookie explícitamente `httpOnly: true`, `secure: true`, `sameSite: "strict"` — configurado a mano, no asumir que son los valores por defecto de la versión de NextAuth instalada sin verificarlo.
- **Transporte:** toda la superficie de autenticación (`authorize`, el propio Route Handler de NextAuth, y cualquier endpoint que reciba la contraseña) debe servirse exclusivamente sobre HTTPS con TLS 1.2 o superior (`HU-Sprint-1.md`, HU-A-01, criterio de aceptación 2, RNF-SEG-01) — en local (Docker) esto es responsabilidad del entorno de desarrollo (no se exige HTTPS en `localhost`), pero en cualquier entorno desplegado la configuración del servidor/proxy debe rechazar HTTP plano hacia estas rutas; documentar esta restricción en el `README` de despliegue, no solo en el código.
- `callbacks.jwt`: en la rama de sign-in inicial (`trigger === "signIn"` o equivalente según la API de la versión instalada), setea `sub`, `rol`, `jti` (`crypto.randomUUID()`), `iat_sesion = now`, `iat = now`, `exp = now + SESION_INACTIVIDAD_MIN`.
- `callbacks.session`: expone `{ user: { id, rol }, expires }` — nunca `password_hash` ni otro dato sensible.

**Archivo:** `app/api/auth/[...nextauth]/route.ts` — handlers `GET`/`POST` estándar de NextAuth sobre la configuración anterior.

**Punto abierto — cómo distinguir `CREDENCIALES_INVALIDAS` de `CUENTA_INACTIVA` en la respuesta al cliente (relevar antes de implementar, no resolver por inferencia):** `authorize()` de NextAuth típicamente solo permite devolver `null` (que `signIn()` traduce a un error genérico sin código propio) o lanzar una `CredentialsSignin` con un mensaje. Hay que verificar, contra la versión exacta de `next-auth@beta` ya instalada en el proyecto (ver `/areas/centro-atencion-tp.md`), si soporta un `code` de error personalizado recuperable del lado del cliente. Si no lo soporta con esa versión, se necesita un mecanismo alternativo (ej. una consulta previa a `signIn()` que solo devuelva el mensaje sin crear sesión). Documentar la decisión tomada como "DECISIÓN RESUELTA" una vez confirmada.

**Punto abierto — Server Action vs. `signIn()` directo desde un Client Component:** la spec no resuelve si el formulario de login invoca `signIn("credentials", {...})` directamente desde un Client Component (patrón habitual de NextAuth) o pasa por un Server Action propio del proyecto (`app/(public)/login/actions.ts`) que lo envuelva. Ambos son válidos y compatibles con el resto de las convenciones del proyecto (Regla N.° 5) — **relevar con el equipo cuál prefieren** antes de construir el formulario, ya que cambia dónde vive la llamada a `CredencialesLoginSchema`.

### 4.4. Eventos de dominio

**Archivo:** `lib/events/event-types.ts` — agregar `sesion:inicio_exitoso`, `sesion:intento_fallido`, `sesion:cuenta_inactiva_rechazada`.

Los tres se emiten inmediatamente después de que `verificarCredenciales()` resuelve (éxito o rechazo) — no hay una transacción multi-tabla cuyo `COMMIT` esperar en el sentido estricto de la Regla N.° 2, pero se mantiene el mismo principio: nunca se emite en medio de una operación de escritura sin resolver (el `INSERT` síncrono de `IntentoAccesoFallido`, si ocurre, ya se completó antes de emitir).

**Listener de auditoría:** agregar los tres handlers en `audit-log.listener.ts`, patrón `void registrarAuditLog(...)` — nunca `await`. El payload de `sesion:intento_fallido` nunca incluye `password` (Regla de negocio 3.4 de la spec).

---

## 5. Frontend

- Pantalla de login (`app/(public)/login/page.tsx`): campos Email y Contraseña con etiquetas visibles, foco inicial en Email, alternar visibilidad de la contraseña sin alterar el valor ingresado.
- Validación en el cliente (mismo `CredencialesLoginSchema`) antes de enviar — campo vacío o solo espacios se marca sin llegar a enviar la solicitud.
- Botón deshabilitado con indicador de carga mientras se procesa; **si no hay respuesta o hay error de comunicación, mostrar el texto exacto "No se pudo conectar. Intentá nuevamente"** (`HU-Sprint-1.md`, HU-A-01, criterio de aceptación 6) y rehabilitar el botón — nunca un mensaje técnico ni detalles internos del error.
- Mensajes de error inline junto al formulario, nunca técnicos: mismo texto para credenciales inválidas y email inexistente; texto distinto para cuenta inactiva; texto distinto para rate limit excedido.
- Al fallar, se conserva el email ingresado y se vacía la contraseña.
- **Redirect post-login por rol** — **punto abierto (relevar antes de implementar):** las pantallas principales de cada rol (Mesa de Entrada, Profesor, Gerente, Alumno) todavía no existen — son de otros módulos. Definir con el usuario si se redirige a una ruta placeholder por rol (ej. `/mesa-entrada`, `/profesor`, `/gerente`, `/alumno`, con una página mínima "en construcción") o a un dashboard genérico temporal compartido hasta que esas pantallas existan.
- Criterio de aceptación §7 (sesión ya válida → redirect directo): resolver la sesión server-side (`auth()`) en la Server Component de `app/(public)/login/page.tsx` antes de renderizar el formulario; si hay sesión válida, redirigir sin mostrarlo.
- Enlace "Crear cuenta" visible, apuntando a la ruta pública de autorregistro (aunque esa pantalla todavía no exista — HU-B-08 la construye).

**Fuera de alcance de frontend:** contenido real de las pantallas principales por rol; pantalla de autorregistro.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (sobre `autenticacion.service.ts`)
- Login exitoso con credenciales válidas y cuenta activa → retorna `{ id, rol }`.
- Email inexistente → `CREDENCIALES_INVALIDAS`; verificar con mock/spy que `bcrypt.compare()` se invoca igual (contra el hash de referencia), nunca se retorna antes de comparar.
- Password incorrecta con usuario existente → `CREDENCIALES_INVALIDAS`.
- Password correcta pero `is_active: false` → `CUENTA_INACTIVA`; verificar que el chequeo de `is_active` ocurre después de `bcrypt.compare()`, nunca antes.
- Sexto intento fallido en 15 minutos para el mismo email+IP → `RATE_LIMIT_EXCEDIDO`, sin llegar a ejecutar `bcrypt.compare()`.
- Un intento fallido registrado en `IntentoAccesoFallido` nunca persiste la contraseña ingresada en ningún campo.
- El evento emitido tras cualquier resultado nunca incluye `password` en su payload (mock/spy).

### Nivel 2 — Postman
- Login exitoso → sesión creada, cookie `HttpOnly`/`Secure`/`SameSite=Strict` presente en la respuesta; verificar que el JWT decodificado usa el algoritmo `HS256` (header `alg`).
- Email inexistente → mismo mensaje que password incorrecta: "Usuario o contraseña incorrectos".
- Password incorrecta → mismo mensaje anterior.
- Cuenta inactiva con password correcta → "La cuenta está inactiva. Comunicate con la administración".
- Sexto intento fallido consecutivo → "Demasiados intentos. Esperá unos minutos e intentá nuevamente".
- En un entorno desplegado (no local): verificar que una solicitud por HTTP plano a las rutas de autenticación es rechazada o redirigida a HTTPS — en local, documentar explícitamente que este caso se omite (`localhost` sin TLS).

### Nivel 3 — BD / TablePlus
- Verificar la fila creada en `IntentoAccesoFallido` tras un intento fallido (`email`, `ip`, `created_at`) — confirmar que no existe ninguna columna con la contraseña ingresada.
- Verificar en `AuditLog` que `sesion:inicio_exitoso` y `sesion:intento_fallido` quedaron encadenados con hash SHA-256 intacto. **Si el `AuditLog` todavía no está implementado por ninguna task previa** (es la primera task del proyecto), este criterio se documenta como "Bloqueado" con ese motivo explícito, conforme a `docs/sdd-metodologia.md` — nunca como si hubiera pasado.

**Evidencia esperada:** Postman + SQL para el contrato de API y la capa de datos; capturas de la pantalla de login en sus tres estados (normal, error, cargando), incluyendo el estado de error de comunicación con el texto exacto.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Puntos abiertos de la sección 4.3 (diferenciación de error en `authorize()`, Server Action vs. `signIn()` directo) y de la sección 5 (rutas placeholder por rol) resueltos y documentados como "DECISIÓN RESUELTA" antes del merge.
- [ ] Service, Route Handler y configuración de NextAuth implementados, sin lógica de negocio fuera de `autenticacion.service.ts`.
- [ ] Respuestas conforme al shape estándar `{ data, error }` donde aplique (la superficie de NextAuth en sí sigue su propio contrato, documentado en el punto abierto de 4.3).
- [ ] Eventos de dominio emitidos después de que el servicio resuelve, nunca con el password en el payload.
- [ ] JWT emitido con algoritmo `HS256` explícito; transporte de la superficie de autenticación restringido a HTTPS TLS 1.2+ en cualquier entorno desplegado, documentado en el README de despliegue.
- [ ] Frontend funcional: login con sus tres estados (incluyendo el texto exacto "No se pudo conectar. Intentá nuevamente" en el error de comunicación), redirect por rol, enlace a "Crear cuenta".
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia (Nivel 3 de AuditLog puede quedar "Bloqueado" si aún no existe esa infraestructura, con motivo explícito).
- [ ] PR con diff acotado exclusivamente a HU-A-01 (sin adelantar lógica de HU-A-02 o HU-A-03 más allá de lo que esta task necesita para mintear el JWT inicial).