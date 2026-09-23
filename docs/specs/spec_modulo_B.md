```markdown
# Especificación Técnica — Módulo B (Alumno)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod · bcryptjs
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 9, 10) · `spec_modulo_A.md` (sesión, JWT, AuditLog) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-B-01 (Identidad), HU-B-02 (Contacto), HU-B-03 (Forma de pago preferida), HU-B-04 (Listado), HU-B-06 (Modificación), HU-B-08 (Autorregistro) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Búsqueda avanzada / filtros combinados en el listado.
- Baja lógica y reactivación del alumno (HU-B-06 §9 lo excluye explícitamente — el estado no es editable esta iteración).
- Recuperación de contraseña del autorregistro (cubierto por `spec_modulo_A.md`, fuera de alcance del Sprint).
- Envío real de email/SMS: el servicio de notificación (envío del código OTP) se referencia como interfaz (`lib/services/notificaciones/*`) pero su implementación de proveedor externo no es parte de esta spec.

---

## 1. Visión General

El Módulo B gestiona la **ficha de Alumno** (identidad, contacto, forma de pago preferida) y el flujo de **autorregistro de cuenta**. Es importante distinguir dos entidades relacionadas pero independientes:

- **`Alumno`** — la ficha de datos, que puede existir sin acceso al sistema (creada por Mesa de Entrada).
- **`Usuario`** (Módulo A) — la cuenta de acceso, con rol `ALUMNO`, opcionalmente vinculada a una ficha (`Alumno.usuario_id`, nullable).

Un `Alumno` puede crearse con cuenta simultánea (si Mesa de Entrada lo registra pensando en que el propio alumno accederá) o sin cuenta (caso más común en este sprint); una cuenta puede sumarse después vía autorregistro (HU-B-08), que vincula la nueva cuenta a la ficha existente en lugar de duplicarla.

**Nota — forma de pago preferida no es el Módulo de Pagos:** el campo definido en HU-B-03 es exclusivamente una preferencia de UX para prellenar futuras operaciones, resuelta contra un catálogo precargado de **nombres genéricos** (`Efectivo`, `Transferencia` en este sprint). No se solicita ni almacena ningún dato financiero sensible (número de tarjeta, CBU, etc.). El futuro Módulo I (Pagos) gestionará transacciones reales y es una entidad completamente distinta — esta spec no lo anticipa ni lo reemplaza.

**Aislamiento de dominio (Regla N.° 3 de `docs/RULES.md`):** la tabla `Usuario` es propiedad del Módulo A. Este módulo **nunca** escribe directamente sobre `Usuario` — toda creación o vinculación de cuenta (HU-B-08) invoca el servicio público `crearCuentaConCredenciales()` expuesto por `lib/services/sesion/cuenta.service.ts` (Módulo A).

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Alumno` y `FormaPago` son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo. El `solicitud_id` de HU-B-08 no corresponde a esas entidades ni está modelado en el esquema vigente: conserva su contrato UUID independiente.
- Toda ruta protegida requiere `withPermission("alumnos:<accion>")` (Regla N.° 10); el autorregistro (2.6) es la única superficie **pública** (sin sesión) de este módulo.
- Los schemas de identidad y contacto de 2.1/2.2 son reutilizados sin duplicación por el autorregistro (2.6) y por la modificación (2.5) — se componen, no se reescriben.

---

### 2.1. Alta de identidad del alumno (HU-B-01)

**Ruta:** `POST /app/api/alumnos/route.ts`
**Server Action equivalente:** `crearAlumno()` en `app/(dashboard)/alumnos/actions.ts`
**Permiso requerido:** `alumnos:crear` (Mesa de Entrada)

```typescript
// lib/schemas/alumnos.schema.ts
export const IdentidadAlumnoSchema = z.object({
  nombre: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  apellido: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  dni: z.string().trim()
    .regex(/^\d+$/, "Ingresá el DNI solo con números")
    .length(DNI_LONGITUD, `El DNI debe tener ${DNI_LONGITUD} dígitos`), // DNI_LONGITUD: parámetro configurable
  fecha_nacimiento: fechaCalendarioValidaSchema // ver nota de validación de calendario, abajo
    .refine((d) => d <= new Date(), "La fecha de nacimiento no puede ser futura"),
  genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICAR"]).optional(),
});
export type IdentidadAlumnoInput = z.infer<typeof IdentidadAlumnoSchema>;
```

**Nota técnica — validación estricta de calendario:** `z.coerce.date()` sobre un `Date` nativo de JS "corrige" fechas inexistentes (`31/02` se interpreta como `03/03`). `fechaCalendarioValidaSchema` (`lib/schemas/shared/fecha.schema.ts`) usa un parseo estricto (ej. `date-fns` `parse` + `isValid`) que **rechaza** explícitamente una fecha inexistente en lugar de reinterpretarla — utilidad compartida, reutilizable por cualquier otro módulo que reciba fechas de calendario (Profesor, Turno).

**Comportamiento esperado (`lib/services/alumnos/alumno.service.ts` → `crearAlumno`):**
1. Verificar unicidad aplicativa de `dni` contra **todos** los alumnos, activos e inactivos (`prisma.alumno.findFirst({ where: { dni } })`).
2. Si existe: `409 DNI_DUPLICADO`, indicando en el mensaje si la ficha existente está inactiva.
3. **Revalidación inmediatamente antes del `INSERT`** (mismo `findFirst`, dentro de la misma operación de servicio) para reducir la ventana de una alta duplicada simultánea, más **defensa de constraint único** (`P2002` sobre `dni`) capturada y traducida al mismo error `409`.
4. Insertar con `is_active: true`, `version: 0` (ver concurrencia optimista, sección 3.3), fecha de alta y usuario registrante.
5. Emitir `alumno:creado` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Ana", "apellido": "Pérez", "dni": "30123456", "is_active": true }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "DNI_DUPLICADO", "message": "Ya existe un alumno registrado con ese DNI" } }
```

---

### 2.2. Registrar datos de contacto (HU-B-02)

**Ruta:** `PATCH /app/api/alumnos/[id]/contacto/route.ts`
**Server Action equivalente:** `actualizarContactoAlumno()` en `app/(dashboard)/alumnos/actions.ts`
**Permiso requerido:** `alumnos:editar`

```typescript
export const ContactoAlumnoSchema = z.object({
  telefono: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254).optional(),
}).refine((d) => d.telefono || d.email, {
  message: "Ingresá al menos un teléfono o un email de contacto",
  path: ["telefono"],
});
export type ContactoAlumnoInput = z.infer<typeof ContactoAlumnoSchema>;
```

**Comportamiento esperado:**
1. Si viene `telefono`: normalizar eliminando espacios/guiones/paréntesis pero **conservando el `+` inicial** (`lib/utils/normalizar-telefono.ts`, utilidad compartida — mismo requisito en `spec_modulo_D.md` §2.2). Validar longitud entre 8 y 15 dígitos, contando solo dígitos (el `+` no cuenta para la longitud).
2. Si viene `email`: dado que este email es el que eventualmente usará el alumno para autorregistrarse (HU-B-08), se valida su unicidad contra `Usuario.email` de **cualquier cuenta existente** — si ya pertenece a otra cuenta, `409 EMAIL_YA_ASOCIADO`, con un mensaje que **no revela a quién pertenece** esa cuenta.
3. Actualiza únicamente los campos provistos, `updated_at`. Operación de una sola tabla, no requiere `$transaction` multi-tabla.
4. Emitir `alumno:contacto_actualizado` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "telefono": "+5493871234567", "email": "ana.perez@mail.com" }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "EMAIL_YA_ASOCIADO", "message": "Ese email ya está asociado a una cuenta existente" } }
```

---

### 2.3. Asociar alumno a forma de pago preferida (HU-B-03)

**Ruta:** `PATCH /app/api/alumnos/[id]/forma-pago/route.ts`
**Server Action equivalente:** `actualizarFormaPagoPreferida()` en `app/(dashboard)/alumnos/actions.ts`
**Permiso requerido:** `alumnos:editar`

```typescript
export const FormaPagoPreferidaSchema = z.object({
  forma_pago_id: z.string().cuid().nullable(), // null = "Sin preferencia"
});
export type FormaPagoPreferidaInput = z.infer<typeof FormaPagoPreferidaSchema>;
```

**Modelo de referencia:** catálogo `FormaPago` (`id`, `nombre`, `is_active`), precargado por seed para este sprint (`Efectivo`, `Transferencia`) — sin ningún campo de dato financiero.

**Comportamiento esperado:**
1. Si `forma_pago_id` no es `null`: verificar que la `FormaPago` exista y tenga `is_active: true` **en el momento de confirmar** (no basta con haber estado activa cuando se abrió el formulario). Si no está disponible: `409 FORMA_PAGO_NO_DISPONIBLE`, se informa el cambio, no se guarda.
2. Actualiza `Alumno.forma_pago_preferida_id`, reemplazando cualquier preferencia anterior (constraint: una sola preferencia por alumno, ya garantizado por ser un único campo FK nullable, no una tabla de relación N:M).
3. **Regla de no retroactividad (análoga a la de costeo del proyecto de referencia):** cambiar o quitar la preferencia **no** modifica ningún turno o pago histórico — esos registros conservan la forma de pago con la que fueron creados en su momento (cuando exista el Módulo I). Este campo es únicamente el valor por defecto sugerido en operaciones futuras.
4. Emitir `alumno:forma_pago_actualizada` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "forma_pago_preferida_id": "cuid" }, "error": null }
```

---

### 2.4. Listado y detalle de alumnos (HU-B-04)

**Ruta (listado):** `GET /app/api/alumnos/route.ts`
**Permiso requerido:** `alumnos:leer`

```typescript
export const ListarAlumnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado:**
- Incluye alumnos activos e inactivos (la columna Estado los distingue; no hay filtro de baja/reactivación en este sprint, ver "Fuera de alcance").
- Orden inicial: `apellido_normalizado, nombre_normalizado` ascendente (sin distinguir mayúsculas/acentos, misma utilidad `normalizarTexto()` de `spec_modulo_L.md`), `dni` como segundo criterio de desempate.
- Cada ítem: apellido, nombre, DNI, teléfono (`"—"` si ausente), email (`"—"` si ausente), estado.
- Paginación server-side con metadatos.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [{ "id": "cuid", "apellido": "Pérez", "nombre": "Ana", "dni": "30123456", "telefono": "+5493871234567", "email": "—", "is_active": true }],
    "paginacion": { "total": 48, "pagina_actual": 1, "total_paginas": 3, "por_pagina": 20 }
  },
  "error": null
}
```

**Ruta (detalle):** `GET /app/api/alumnos/[id]/route.ts` — identidad, contacto, forma de pago preferida (nombre resuelto, no solo el id), estado, fecha de alta.

---

### 2.5. Modificación de datos del alumno (HU-B-06)

**Ruta:** `PATCH /app/api/alumnos/[id]/route.ts`
**Server Action equivalente:** `modificarAlumno()` en `app/(dashboard)/alumnos/actions.ts`
**Permiso requerido:** `alumnos:editar`

```typescript
export const ModificarAlumnoSchema = IdentidadAlumnoSchema.partial()
  .merge(ContactoAlumnoSchema.partial())
  .extend({
    forma_pago_id: z.string().cuid().nullable().optional(),
    version: z.number().int().nonnegative(), // control de concurrencia optimista — obligatorio, no opcional
  })
  .strict();
export type ModificarAlumnoInput = z.infer<typeof ModificarAlumnoSchema>;
```

**Comportamiento esperado:**
1. Si viene `dni`: validar unicidad excluyendo la propia ficha (`id != alumnoId`), contra activas e inactivas — mismo criterio que 2.1.
2. Si viene `email`: validar unicidad contra `Usuario.email` — mismo criterio que 2.2. Si la ficha ya tiene una cuenta vinculada (`Alumno.usuario_id` no nulo), el cambio de email **también actualiza `Usuario.email`** dentro de la misma transacción (ambas tablas son parte de la misma operación de negocio "cambiar el email de contacto/acceso del alumno" — no es una violación del aislamiento de Módulo A porque se invoca el servicio público `actualizarEmailCuenta()` de `lib/services/sesion/cuenta.service.ts`, nunca un `UPDATE` directo sobre `Usuario`).
3. **Concurrencia optimista (Regla N.° 7 de `docs/RULES.md`, aplicada aquí a un `UPDATE` en lugar de un decremento de stock):**
   ```typescript
   const resultado = await tx.alumno.updateMany({
     where: { id: alumnoId, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, updated_at: new Date() },
   });
   if (resultado.count === 0) {
     throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
     // count === 0: o la ficha no existe, o alguien más la modificó entre que el
     // cliente cargó el formulario y confirmó — nunca asumir que no existe sin
     // antes haber verificado su existencia en el paso 1.
   }
   ```
4. Solo se escriben los campos efectivamente provistos en el payload (diff) — `id`, `is_active` y `created_at` nunca son editables desde este endpoint.
5. Emitir `alumno:actualizado` con `campos_modificados` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["telefono", "forma_pago_id"], "version": 4 }, "error": null }
```

**Respuesta `409 Conflict` (edición concurrente):**
```json
{ "data": null, "error": { "code": "CONFLICTO_EDICION_CONCURRENTE", "message": "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." } }
```

---

### 2.6. Autorregistro del alumno (HU-B-08)

**Superficie pública** (sin sesión), accesible desde "Crear cuenta" del login.

**Ruta (paso 1 — registro):** `POST /app/api/auth/autorregistro/route.ts`
**Server Action equivalente:** `iniciarAutorregistro()` en `app/(public)/autorregistro/actions.ts`

```typescript
export const AutorregistroAlumnoSchema = IdentidadAlumnoSchema
  .merge(ContactoAlumnoSchema.pick({ telefono: true }))
  .extend({
    email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254), // obligatorio acá, a diferencia de ContactoAlumnoSchema
    password: politicaPasswordSchema, // ver "Punto abierto" más abajo
    confirmacion_password: z.string(),
    acepta_terminos: z.literal(true, { errorMap: () => ({ message: "Debés aceptar los términos de uso y tratamiento de datos" }) }),
  })
  .refine((d) => d.password === d.confirmacion_password, {
    message: "Las contraseñas no coinciden", path: ["confirmacion_password"],
  })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0].toLowerCase()), {
    message: "La contraseña no puede contener tu email", path: ["password"],
  })
  .refine((d) => !d.password.includes(d.dni), {
    message: "La contraseña no puede contener tu DNI", path: ["password"],
  });
export type AutorregistroAlumnoInput = z.infer<typeof AutorregistroAlumnoSchema>;
```

**Punto abierto — política de contraseña (relevar antes de implementar, no resolver por inferencia):** el criterio de aceptación exige que la contraseña "cumpla la política de seguridad configurada" sin especificar las reglas concretas. Se propone como valor por defecto — a confirmar con el equipo/PO antes de la implementación de `HU-B-08`, siguiendo la convención de `docs/sdd-metodologia.md`: mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número. Una vez confirmado, documentar como "DECISIÓN RESUELTA" en la task correspondiente.

**Comportamiento esperado (`lib/services/alumnos/autorregistro.service.ts` → `iniciarAutorregistro`):**
1. Verificar rate limit por IP (tabla operativa `IntentoAutorregistro`, mismo patrón síncrono que `IntentoAccesoFallido` de `spec_modulo_A.md` §3.3): máximo 5 registros por IP por hora.
2. Verificar que no exista ya un `Usuario` con ese `email` → si existe, `409 CUENTA_YA_EXISTE`, mensaje genérico: "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada."
3. Buscar `Alumno` por `dni`:
   - **(a) No existe ninguna ficha:** crear `Alumno` (mismos datos y validaciones que 2.1) **y** la cuenta `Usuario` (rol `ALUMNO`, vía el servicio público de Módulo A `crearCuentaConCredenciales()`) **en una única `prisma.$transaction`** — si cualquier parte falla, no se crea nada. Responde éxito directo (sin paso de verificación de código).
   - **(b) Existe una ficha con `usuario_id: null` (sin cuenta vinculada):** no se duplica la ficha. Si `Alumno.email` está registrado (dato de contacto ya cargado por Mesa de Entrada, HU-B-02) y coincide con el flujo esperado, se inicia el circuito de verificación por código (paso 2, abajo) contra ese email — **no** contra el email recién tipeado en el formulario, para no permitir que alguien reclame una ficha ajena usando un email propio. Se persiste una `SolicitudAutorregistro` (ver 3.6) con el `password_hash` ya calculado (bcrypt, costo 12, salt único — nunca en texto plano), pendiente de confirmación.
   - **(c) Existe una ficha con `usuario_id` ya asignado:** mismo tratamiento que (b)-existe-cuenta: `409 CUENTA_YA_EXISTE`, mismo mensaje genérico que el paso 2 (no distinguible desde el cliente).
   - **(d) Existe una ficha sin cuenta pero sin email verificable, o el email no coincide con el de contacto registrado:** se deriva a Mesa de Entrada **sin revelar cuál dato no coincidió ni información de la ficha existente**: "No pudimos completar el registro en línea. Acercate a mesa de entrada para vincular tu cuenta." (`200 OK` con este mensaje — no es un error, es el resultado esperado del flujo, igual que el resto de estas ramas no deben ser distinguibles entre sí por un atacante).
4. Registrar aceptación de términos (`AceptacionTerminos`: `version_terminos`, `fecha_hora`) — se persiste al momento de crear la cuenta (rama a) o al confirmar el código (rama b, ver 2.6 paso 2), nunca antes de que la cuenta exista realmente.
5. Emitir el evento correspondiente (sección 4) — como evento de seguridad, mismo canal de auditoría que Módulo A.

**Ruta (paso 2 — verificación de código, solo rama b):** `POST /app/api/auth/autorregistro/verificar-codigo/route.ts`
**Servicio:** `confirmarCodigoAutorregistro(solicitudId, codigo)` en `lib/services/alumnos/autorregistro.service.ts`

```typescript
export const VerificarCodigoAutorregistroSchema = z.object({
  solicitud_id: z.string().uuid(),
  codigo: z.string().length(6).regex(/^\d{6}$/),
});
```

**Comportamiento esperado:**
1. Generación del código (al crear la `SolicitudAutorregistro` en el paso 1-b): 6 dígitos con `crypto.randomInt()` (RNG criptográficamente seguro). En base se persiste **solo** `HMAC-SHA256(codigo, CODIGO_OTP_SECRET)` — nunca el código en texto plano. `CODIGO_OTP_SECRET` es una variable de entorno (Regla N.° 9).
2. Verificación: recalcular el HMAC del `codigo` recibido y compararlo contra el almacenado con una función de **comparación en tiempo constante** (`crypto.timingSafeEqual`), nunca `===`.
3. Precondiciones: código no vencido (`expira_en > now`), intentos restantes `> 0` (se decrementa en cada intento fallido, tope configurable). Si falla cualquiera: error específico, sin revelar cuál parte del código estuvo mal.
4. Éxito: dentro de `prisma.$transaction`, crea el `Usuario` (vía `crearCuentaConCredenciales()` de Módulo A, usando el `password_hash` ya guardado en la solicitud), vincula `Alumno.usuario_id`, marca la `SolicitudAutorregistro` como consumida, registra `AceptacionTerminos`.
5. Emitir `alumno:autorregistro_completado` (vía = `VINCULACION_OTP`).

**Ruta (reenvío de código):** `POST /app/api/auth/autorregistro/reenviar-codigo/route.ts`
- Invalida el código anterior (nuevo hash sobrescribe al anterior; el viejo deja de ser válido de inmediato, no solo al vencer).
- Rate limit: máximo 3 reenvíos por hora, mínimo 60 segundos entre reenvíos consecutivos.
- El email de destino se muestra siempre enmascarado en la respuesta (`j***@gmail.com`), nunca completo.

**Respuesta `200 OK` (registro directo, rama a):**
```json
{ "data": { "via": "DIRECTO", "email": "ana.perez@mail.com" }, "error": null }
```

**Respuesta `202 Accepted` (pendiente de verificación, rama b):**
```json
{ "data": { "via": "VERIFICACION_REQUERIDA", "solicitud_id": "uuid", "email_enmascarado": "a***@mail.com" }, "error": null }
```

**Respuesta `200 OK` (derivado a mesa de entrada, rama d — no es error):**
```json
{ "data": { "via": "DERIVADO_MESA_ENTRADA" }, "error": null }
```

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `lib/services/alumnos/*.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

### 3.1. Ficha (`Alumno`) y Cuenta (`Usuario`) son entidades separadas
Ningún servicio de este módulo asume que un `Alumno` tiene cuenta. `Alumno.usuario_id` es nullable y su ausencia es el caso esperado por defecto en altas hechas por Mesa de Entrada.

### 3.2. Aislamiento de dominio: la tabla `Usuario` no se escribe directamente
Toda creación o modificación de `Usuario` originada en este módulo (autorregistro, cambio de email vinculado) pasa por los servicios públicos de `lib/services/sesion/cuenta.service.ts` (Módulo A) — nunca un `prisma.usuario.create()`/`update()` directo desde `lib/services/alumnos/*` (Regla N.° 3).

### 3.3. Concurrencia optimista en modificación de ficha
Todo `UPDATE` sobre `Alumno` desde HU-B-06 aplica el patrón de condición-y-mutación-atómica de la Regla N.° 7, usando `version` como campo de control en lugar de una cantidad de stock — mismo mecanismo, mismo principio: la condición (`version` sin cambios) y la mutación (aplicar cambios + incrementar `version`) ocurren en una única sentencia, nunca en un `findUnique` + `update` separados.

### 3.4. Unicidad de DNI contra el universo completo (activas + inactivas)
Igual que `spec_modulo_L.md` §3.1: una ficha inactiva sigue "ocupando" su DNI. Doble validación (aplicativa + constraint `P2002`), igual patrón.

### 3.5. Forma de pago preferida es un valor por defecto, no un compromiso retroactivo
Cambiarla no reescribe ningún turno o pago ya registrado (regla de no retroactividad, sección 2.3).

### 3.6. Códigos de verificación (OTP): solo hash, comparación en tiempo constante, un solo uso
- Se persiste únicamente `HMAC-SHA256(codigo, CODIGO_OTP_SECRET)`, nunca el código en claro.
- La comparación usa `crypto.timingSafeEqual`, nunca `===` (mitigación de timing attack, mismo principio que la verificación de contraseña de `spec_modulo_A.md` §3.1).
- Un código consumido o reemplazado por un reenvío deja de ser válido de inmediato — no queda como alternativa válida "por las dudas".

### 3.7. Rate limiting operacional, tabla síncrona (no vía evento)
`IntentoAutorregistro` (registro) y el contador de reenvíos de código se escriben de forma síncrona en el propio servicio — mismo razonamiento que `spec_modulo_A.md` §3.3: el límite debe estar disponible para la siguiente solicitud sin depender de un listener asíncrono.

### 3.8. Ningún dato sensible en logs, eventos ni `AuditLog`
`password`, `password_hash`, el código OTP en claro y su HMAC no se incluyen jamás en el payload de un evento de dominio ni en `valor_nuevo`/`valor_anterior` del `AuditLog` — mismo principio que `spec_modulo_A.md` §3.4.

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite después del `COMMIT`, nunca dentro de la transacción. Los eventos de este módulo relacionados a cuentas (autorregistro) son, además, eventos de seguridad — mismo canal de auditoría que `spec_modulo_A.md` §4.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `alumno:creado` | Alta directa (2.1) | `alumno_id, dni, usuario_registrante_id` |
| `alumno:contacto_actualizado` | Contacto (2.2) | `alumno_id, campos_modificados, usuario_id` |
| `alumno:forma_pago_actualizada` | Forma de pago (2.3) | `alumno_id, forma_pago_id, usuario_id` |
| `alumno:actualizado` | Modificación (2.5) | `alumno_id, campos_modificados, valor_anterior, valor_nuevo, usuario_id` |
| `alumno:autorregistro_completado` | Autorregistro exitoso (2.6, rama a o verificación de código) | `alumno_id, usuario_id, via: "DIRECTO" \| "VINCULACION_OTP"` |
| `alumno:codigo_verificacion_generado` | Envío/reenvío de código (2.6) | `alumno_id, solicitud_id, ip` — **nunca** el código |
| `alumno:autorregistro_derivado_mesa_entrada` | Rama (d), datos no coinciden (2.6) | `dni, ip` — nunca detalle de qué no coincidió |
```