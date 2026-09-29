```markdown
# Especificación Técnica — Módulo A (Sesión)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2)
## Revisión 2 — Sprint 2: matriz RBAC única (§2.4) y servicios públicos de cuentas; sin HU nuevas en este módulo

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
- Recuperación de contraseña (no aparece en el sprint).
- Autenticación de dos factores (2FA).
- Alta, edición o baja de cuentas de profesor, mesa de entrada o gerente — se asume que ya existen, precargadas (seed). Este módulo solo autentica contra cuentas existentes.
- Creación de la cuenta de alumno vía autorregistro: eso lo define HU-B-08 / `spec_modulo_B.md`. Este módulo únicamente provee el mecanismo de emisión de sesión que ese flujo consume al finalizar (mismo contrato de la sección 2.1, sin duplicar lógica).

---

## 1. Visión General

El Módulo A es el subsistema de autenticación y sesión de Noctium, y la base habilitante de la que dependen los demás módulos: define el middleware `withPermission()` (Regla N.° 10 de `docs/RULES.md`) que protege toda ruta del sistema, y registra sus propios eventos de seguridad (login, rechazos, cierre de sesión) en la tabla `EventoSeguridad` (Regla N.° 2, patrón b). No centraliza la auditoría de otros módulos: cada módulo elige el patrón (a) o (b) de la Regla N.° 2 para sus propias mutaciones.

Se implementa sobre **NextAuth (Credentials Provider)** con estrategia de sesión `jwt`. La capa de servicios (`src/server/sesion/*.service.ts`) concentra toda la lógica de negocio (verificación de credenciales, rate limiting, revocación); los callbacks de NextAuth (`authorize`, `jwt`, `session`) y el middleware de Next.js son capa delgada que invoca esa capa de servicios, conforme a la Regla N.° 4.

El usuario del sistema (`Usuario`) tiene un rol único de: `MESA_ENTRADA`, `PROFESOR`, `GERENTE` o `ALUMNO`. El rol viaja en el JWT y determina tanto el menú disponible en la UI como la autorización efectiva en el servidor — la UI oculta opciones no autorizadas, pero eso nunca reemplaza la verificación server-side (criterio de aceptación HU-A-02 §2).

**Alcance de esta revisión:** la Revisión 2 es **aditiva**: agrega la sección 2.4 (matriz RBAC, Regla N.° 10) y la sección 2.5 (servicios públicos del módulo, Regla N.° 3). Las secciones 2.1 a 2.3 (HU-A-01, HU-A-02, HU-A-03, Sprint 1) **no se renumeran** ni cambian de contrato, porque otras specs las citan por número (ver `docs/adicionales/sdd-metodologia.md`). Las operaciones de sesión (2.1 a 2.3) son de Sprint 1; en 2.4 y 2.5 se documenta el resto.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar (Route Handlers / Server Actions) y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta protegida del sistema requiere sesión autenticada y permiso granular vía `withPermission("<recurso>:<accion>")` (Regla N.° 10; middleware definido en 2.2). Las operaciones de este módulo son de **sesión propia o públicas** según corresponda (el login es público; ver el permiso requerido de cada operación); el único permiso de sesión en la matriz es `sesion:ping`.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/sesion.types.ts`, Server Actions en `src/server/sesion/actions.ts` y services en `src/server/sesion/autenticacion.service.ts` (cuentas: `src/server/usuarios/usuario.service.ts`). Imports siempre con el alias `@/`. Los nombres de archivo exactos que la spec no fijaba están marcados «a confirmar contra el código».
- Ninguna credencial ni secreto (`NEXTAUTH_SECRET`) se hardcodea: se lee desde variable de entorno (Regla N.° 9).
- La contraseña nunca se persiste en texto plano, nunca viaja en URL/query params, nunca aparece en logs ni en ninguna tabla de eventos (`EventoSeguridad`, `IntentoLoginFallido`).

---

### 2.1. Iniciar sesión (HU-A-01)

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

Conforme a la Regla N.° 3: servicios públicos del Módulo A para cuentas, todos en `src/server/usuarios/usuario.service.ts` (el archivo real del Módulo A para cuentas; **no existe** `sesion/cuenta.service.ts`). Ningún otro módulo consulta ni escribe la tabla `usuarios` directamente.

| Función | Devuelve | Consumidores | Estado |
|---|---|---|---|
| `obtenerEmailDeUsuario(usuarioId): Promise<string \| null>` | Email de la cuenta, sin exponer el hash ni otros campos; `null` si la cuenta no existe (el consumidor decide qué mostrar en ese caso) | `spec_modulo_C.md` §2.4 (`creado_por`); `spec_modulo_E.md` §2.1 (`registrada_por` del registro de clase) | **nuevo** |
| `crearCuentaConCredenciales(...)` | Alta de un `Usuario` con rol `ALUMNO` y sus credenciales. B la invoca en el autorregistro (`spec_modulo_B.md` §2.6: rama (a), alta directa, y verificación de código de la rama (b), con el `password_hash` ya calculado) | `spec_modulo_B.md` §2.6 (y §1, §3.2 como regla de aislamiento) | existente; **firma exacta: a confirmar contra el código** |
| `actualizarEmailCuenta(...)` | Actualiza `Usuario.email` de la cuenta vinculada a un alumno cuando cambia su email de contacto; se invoca dentro de la misma transacción de B (el email llega ya normalizado y con la unicidad validada) | `spec_modulo_B.md` §2.5 (HU-B-06, paso 2) | **a documentar**; **firma exacta: a confirmar contra el código** |
| `verificarEmailNoAsociadoAOtraCuenta(...)` | Comprueba que un email no pertenezca a otra cuenta (`EMAIL_YA_ASOCIADO`, sin revelar de quién es) | `spec_modulo_B.md` §2.2, §2.5; `spec_modulo_D.md` §2.1, §2.2, §2.6 | nombre tomado de D; **existencia y firma: a confirmar contra el código** |

**Notas:** (1) `obtenerEmailDeUsuario()` se agrega junto a `obtenerNombreVisible()`, que ya resuelve nombre o email según el rol pero exige conocer el rol: acá no se lo conoce; lo usa Turnos (`creado_por`), porque `Usuario` no tiene nombre y el personal de mesa de entrada no tiene ficha. (2) `spec_modulo_B.md` ya cita la ubicación `src/server/usuarios/usuario.service.ts` para `crearCuentaConCredenciales()` y `actualizarEmailCuenta()`; la ubicación de ambas y su firma exacta se confirman contra el código, y este módulo (dueño de las tres) debe completar la tabla una vez confirmadas.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/sesion/*.service.ts` (`autenticacion.service.ts`; las cuentas, en `src/server/usuarios/usuario.service.ts`). Route Handlers y Server Actions son capa delgada (Regla N.° 4 de `docs/RULES.md`).

### 3.1. Comparación contra hash de referencia cuando el email no existe
`verificarCredenciales` **siempre** ejecuta un `bcrypt.compare()`, exista o no el `Usuario`. Si no existe, se compara contra una constante de hash de referencia (`DUMMY_PASSWORD_HASH`, generada una vez y fijada en variable de entorno o constante de build) — nunca se hace `return` anticipado sin comparar, para que el tiempo de respuesta no permita inferir por timing si un email está registrado.

### 3.2. Orden no negociable: contraseña antes que estado de cuenta
`Usuario.is_active` se evalúa **únicamente después** de que `bcrypt.compare()` haya resultado exitoso. Evaluar el estado antes filtraría, ante una contraseña incorrecta, si la cuenta existe e indirectamente si está activa — violando el criterio de mensaje neutro de HU-A-01 §4.

### 3.3. Rate limiting por email + IP
Tabla operativa `IntentoLoginFallido` (`emailIntento`, `ipIntento`, `creadoEnIntento`; índice `[emailIntento, creadoEnIntento]`), usada solo para contar. Es **distinta** de `EventoSeguridad`, que también registra `LOGIN_FALLIDO` (sección 4) pero no se usa para contar. Se escribe de forma directa y síncrona dentro del propio servicio, porque el conteo debe estar disponible de inmediato para la siguiente solicitud. Los límites salen de los parámetros configurables `login_max_intentos` y `login_ventana_minutos` (tabla al final). Cuando el límite está excedido, `verificarRateLimit` lanza el error antes de tocar nada más: **no se escribe ninguna fila** (ni en `IntentoLoginFallido` ni en `EventoSeguridad`).

```typescript
const intentosRecientes = await prisma.intentoLoginFallido.count({
  where: { emailIntento: email, ipIntento: ip, creadoEnIntento: { gte: new Date(Date.now() - login_ventana_minutos * 60_000) } },
});
if (intentosRecientes >= login_max_intentos) throw new ServiceError("RATE_LIMIT_EXCEDIDO");
```
La cuenta **nunca se bloquea** — el límite es por combinación email+IP+ventana de tiempo, no un estado persistente de `Usuario` (criterio HU-A-01 §4).

### 3.4. Ningún dato sensible en logs ni en tablas de eventos
`password`, `passwordHashUsuario` y el hash de referencia (3.1) no se guardan jamás en `EventoSeguridad`, en `IntentoLoginFallido` ni en logs de aplicación.

### 3.5. Revocación por `jti`, no por invalidación global
`TokenRevocado` opera por token individual (`jti`), no por usuario — cerrar sesión en un dispositivo no afecta sesiones abiertas en otros dispositivos del mismo usuario (comportamiento estándar salvo que una futura HU pida lo contrario).

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

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

---

## Parámetros configurables (referencia)

| Parámetro | Valor por defecto | Usado en |
|---|---|---|
| `SESION_INACTIVIDAD_MIN` | 30 minutos | 2.2 — renovación deslizante |
| `SESION_MAXIMA_HORAS` | 8 horas | 2.2 — tope absoluto |
| `login_max_intentos` | 5 | 3.3 |
| `login_ventana_minutos` | 15 minutos | 3.3 |
```
