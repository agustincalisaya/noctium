```markdown
# Especificación Técnica — Módulo A (Sesión)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod · NextAuth (Credentials Provider) · bcryptjs
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 4, 5, 6, 9, 10) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-A-01 (Iniciar sesión), HU-A-02 (Mantener sesión), HU-A-03 (Cerrar sesión) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Recuperación de contraseña (no aparece en el sprint).
- Autenticación de dos factores (2FA).
- Alta, edición o baja de cuentas de profesor, mesa de entrada o gerente — se asume que ya existen, precargadas (seed). Este módulo solo autentica contra cuentas existentes.
- Creación de la cuenta de alumno vía autorregistro: eso lo define HU-B-08 / `spec_modulo_B.md`. Este módulo únicamente provee el mecanismo de emisión de sesión que ese flujo consume al finalizar (mismo contrato de la sección 2.1, sin duplicar lógica).

---

## 1. Visión General

El Módulo A es el subsistema de autenticación y sesión de Noctium, y la base habilitante de la que dependen los demás módulos: define el middleware `withPermission()` (Regla N.° 10 de `docs/RULES.md`) que protege toda ruta del sistema, y es el consumidor de los eventos de dominio que construyen el `AuditLog` encadenado (Regla N.° 2) — cualquier otro módulo que necesite auditar una acción emite su evento y este módulo lo persiste, nunca al revés.

Se implementa sobre **NextAuth (Credentials Provider)** con estrategia de sesión `jwt`. La capa de servicios (`lib/services/sesion/*.service.ts`) concentra toda la lógica de negocio (verificación de credenciales, rate limiting, revocación); los callbacks de NextAuth (`authorize`, `jwt`, `session`) y el middleware de Next.js son capa delgada que invoca esa capa de servicios, conforme a la Regla N.° 4.

El usuario del sistema (`Usuario`) tiene un rol único de: `MESA_ENTRADA`, `PROFESOR`, `GERENTE` o `ALUMNO`. El rol viaja en el JWT y determina tanto el menú disponible en la UI como la autorización efectiva en el servidor — la UI oculta opciones no autorizadas, pero eso nunca reemplaza la verificación server-side (criterio de aceptación HU-A-02 §2).

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar (Route Handlers / Server Actions) y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Ninguna credencial ni secreto (`NEXTAUTH_SECRET`) se hardcodea: se lee desde variable de entorno (Regla N.° 9).
- La contraseña nunca se persiste en texto plano, nunca viaja en URL/query params, nunca aparece en logs ni en el payload de un evento de dominio.

---

### 2.1. Iniciar sesión (HU-A-01)

**Mecanismo:** `authorize()` del Credentials Provider de NextAuth (`lib/auth/auth.config.ts`), delegando en la capa de servicios.
**Servicio:** `verificarCredenciales(email, password, ip)` en `lib/services/sesion/autenticacion.service.ts`

```typescript
// lib/schemas/sesion.schema.ts
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
5. Si la comparación falla (en cualquiera de los dos casos anteriores): registrar intento fallido (sección 3.3) y retornar `CREDENCIALES_INVALIDAS`.
6. Si la comparación es exitosa: **recién ahora** evaluar `Usuario.is_active` (Regla N.° 3.2 — nunca antes de validar la contraseña). Si `is_active = false`, retornar `CUENTA_INACTIVA` sin crear sesión.
7. Si todo es válido: resolver el rol y devolver los claims mínimos para el JWT (`id`, `rol`) — nunca `password_hash` ni datos personales.
8. Emitir el evento correspondiente (sección 4) — después de que el paso 7 resuelva, no antes.

**Traducción de errores al usuario (ambos casos son indistinguibles para el cliente):**
- `CREDENCIALES_INVALIDAS` → "Usuario o contraseña incorrectos".
- `CUENTA_INACTIVA` → "La cuenta está inactiva. Comunicate con la administración" (**este mensaje sí es distinto**, pero solo se emite después de validar la contraseña correctamente — nunca revela inactividad ante una contraseña incorrecta).
- `RATE_LIMIT_EXCEDIDO` → "Demasiados intentos. Esperá unos minutos e intentá nuevamente".

**Sesión creada (éxito):** NextAuth emite el JWT vía `callbacks.jwt` (ver 2.2) en cookie HttpOnly, Secure, SameSite=Strict — nunca en `localStorage`/`sessionStorage`.

---

### 2.2. Mantener sesión (HU-A-02)

**Mecanismo:** `callbacks.jwt` y `callbacks.session` de NextAuth + middleware `withPermission()` (`lib/auth/with-permission.ts`), usado por todo Route Handler/Server Action protegido del sistema.

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

**Respuesta `401`:**
```json
{ "data": null, "error": { "code": "SESION_INVALIDA", "message": "Tu sesión expiró. Iniciá sesión nuevamente" } }
```

**Respuesta `403`:**
```json
{ "data": null, "error": { "code": "SIN_PERMISO", "message": "No tenés permisos para acceder a esta sección" } }
```

---

### 2.3. Cerrar sesión (HU-A-03)

**Ruta:** `POST /app/api/auth/logout/route.ts` (wrapper sobre `signOut()` de NextAuth, extendido con revocación)
**Servicio:** `cerrarSesion(jti, usuarioId, ip)` en `lib/services/sesion/autenticacion.service.ts`

**Comportamiento esperado:**
1. Inserta `jti` en `TokenRevocado` con `expira_en` igual al `exp` original del token (para poder purgar filas vencidas más adelante sin perder cobertura antes de tiempo).
2. Responde eliminando la cookie de sesión (`Max-Age=0`). Como la cookie es HttpOnly, el cliente no puede borrarla por JS — el server es quien la invalida en la respuesta.
3. Emite el evento `sesion:cierre` (sección 4).
4. Si el paso 1 falla por error de comunicación con la base, igualmente se responde éxito al cliente y se reintenta la revocación en segundo plano — el usuario no debe quedar en un estado intermedio con acceso a pantallas protegidas (criterio HU-A-03 §6); como respaldo, el token deja de ser válido al vencer naturalmente (máximo 30 min).

**Respuesta `200 OK`:**
```json
{ "data": { "revocado": true }, "error": null }
```

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `lib/services/sesion/*.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Comparación contra hash de referencia cuando el email no existe
`verificarCredenciales` **siempre** ejecuta un `bcrypt.compare()`, exista o no el `Usuario`. Si no existe, se compara contra una constante de hash de referencia (`DUMMY_PASSWORD_HASH`, generada una vez y fijada en variable de entorno o constante de build) — nunca se hace `return` anticipado sin comparar, para que el tiempo de respuesta no permita inferir por timing si un email está registrado.

### 3.2. Orden no negociable: contraseña antes que estado de cuenta
`Usuario.is_active` se evalúa **únicamente después** de que `bcrypt.compare()` haya resultado exitoso. Evaluar el estado antes filtraría, ante una contraseña incorrecta, si la cuenta existe e indirectamente si está activa — violando el criterio de mensaje neutro de HU-A-01 §4.

### 3.3. Rate limiting por email + IP
Tabla operativa `IntentoAccesoFallido` (`email`, `ip`, `created_at`) — **distinta del `AuditLog`**: se escribe de forma síncrona dentro del propio servicio (no vía evento de dominio), porque el conteo de intentos debe estar disponible de inmediato para la siguiente solicitud; no puede depender de un listener asíncrono que podría no haber corrido todavía.

```typescript
const intentosRecientes = await prisma.intentoAccesoFallido.count({
  where: { email, ip, created_at: { gte: new Date(Date.now() - 15 * 60_000) } },
});
if (intentosRecientes >= 5) throw new ServiceError("RATE_LIMIT_EXCEDIDO");
```
La cuenta **nunca se bloquea** — el límite es por combinación email+IP+ventana de tiempo, no un estado persistente de `Usuario` (criterio HU-A-01 §4).

### 3.4. Ningún dato sensible en logs, eventos ni AuditLog
`password`, `password_hash` y el hash de referencia (3.1) no se incluyen jamás en el payload de un evento de dominio, en un log de aplicación, ni en `valor_nuevo`/`valor_anterior` del `AuditLog`.

### 3.5. Revocación por `jti`, no por invalidación global
`TokenRevocado` opera por token individual (`jti`), no por usuario — cerrar sesión en un dispositivo no afecta sesiones abiertas en otros dispositivos del mismo usuario (comportamiento estándar salvo que una futura HU pida lo contrario).

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite **después** de que la operación resuelva, nunca dentro de una transacción abierta a mitad de camino. El propio Módulo A es quien consume estos eventos para construir el `AuditLog` encadenado (SHA-256 sobre `payload + hash_anterior`).

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `sesion:inicio_exitoso` | Login exitoso (2.1, paso 7) | `usuario_id, rol, ip, user_agent` |
| `sesion:intento_fallido` | Login fallido, cualquier motivo (2.1, paso 5) | `email` (normalizado, tal cual ingresado), `ip`, `motivo` (`CREDENCIALES_INVALIDAS` \| `RATE_LIMIT_EXCEDIDO`) — **nunca** `password` |
| `sesion:cuenta_inactiva_rechazada` | Intento sobre cuenta inactiva con contraseña correcta (2.1, paso 6) | `usuario_id, ip` |
| `sesion:cierre` | Logout (2.3) | `usuario_id, jti, ip` |

---

## Parámetros configurables (referencia)

| Parámetro | Valor por defecto | Usado en |
|---|---|---|
| `SESION_INACTIVIDAD_MIN` | 30 minutos | 2.2 — renovación deslizante |
| `SESION_MAXIMA_HORAS` | 8 horas | 2.2 — tope absoluto |
| `RATE_LIMIT_INTENTOS` | 5 | 3.3 |
| `RATE_LIMIT_VENTANA_MIN` | 15 minutos | 3.3 |
```