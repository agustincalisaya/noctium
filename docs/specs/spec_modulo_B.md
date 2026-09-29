```markdown
# Especificación Técnica — Módulo B (Alumno)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2)
## Revisión 2 — Sprint 2: búsqueda de alumnos (HU-B-05), servicios públicos de lectura (2.8) y traspaso del catálogo `FormaPago` al Módulo I

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod · bcryptjs
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 9, 10, 11) · `spec_modulo_A.md` (sesión, JWT, `EventoSeguridad`) · `spec_modulo_I.md` (Pagos, §2.3, dueño de `FormaPago`) · `spec_modulo_C.md` Revisión 5 · `spec_modulo_H.md` (Indicadores) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-B-05 | Gap — no contractualizada (la búsqueda figuraba fuera de alcance) | Añadida sección 2.7 (aditiva, no renumera). Amplía 2.4 |
| HU-B-03 | Contractualizada (Sprint 1) | Sección 2.3 alineada: el catálogo `FormaPago` pasa al Módulo I; códigos `404 FORMA_PAGO_NO_ENCONTRADA` / `409 FORMA_PAGO_NO_DISPONIBLE`. Sin cambio de ruta ni de permiso |
| HU-B-04 | Contractualizada (Sprint 1) | Sección 2.4 recibe el parámetro opcional `q` (definición única en 2.7) |
| HU-B-01, HU-B-02, HU-B-06, HU-B-08 | Contractualizadas (Sprint 1) | Sin cambios de contrato (2.1, 2.2, 2.5, 2.6). Se completan los campos de la plantilla (Servicio, Errores esperados) |
| — (Regla N.° 3, servicios públicos) | Solo `buscarAlumnosActivos()` y `verificarAlumnoActivo()` | Añadida sección 2.8 (4 funciones nuevas y códigos de `verificarAlumnoActivo()`) |
| — (§3) | Reglas 3.1 a 3.8 | Añadidas las reglas 3.9 y 3.10 |

**HU contractualizadas en esta revisión:** HU-B-01 (Identidad), HU-B-02 (Contacto), HU-B-03 (Forma de pago preferida), HU-B-04 (Listado), HU-B-06 (Modificación), HU-B-08 (Autorregistro) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-B-05 (Búsqueda inteligente de alumnos). Además provee los servicios públicos que consumen HU-C-12/C-13 (`spec_modulo_C.md`), HU-I-01 (`spec_modulo_I.md`), HU-H-02 (`spec_modulo_H.md`) y HU-E-01/E-05/E-06 (`spec_modulo_E.md`).

**Changelog — Revisión 2 (Sprint 2):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-B-05 | Gap — "Búsqueda avanzada / filtros combinados" figuraba como fuera de alcance | Nueva sección 2.7 (aditiva, no renumera). Amplía 2.4 |
| Servicios públicos | Solo `buscarAlumnosActivos()` y `verificarAlumnoActivo()` (consumidos por Turnos) | Nueva sección 2.8: 4 funciones nuevas (incluye `obtenerAlumnosBasicos()`, que usa HU-I-01 para proponer la forma de pago preferida del alumno que paga, y también HU-E-01 para los nombres del registro de clase). Además fija los códigos `ALUMNO_NO_ENCONTRADO` / `ALUMNO_INACTIVO` de `verificarAlumnoActivo()` |
| `FormaPago` | B la lee directamente del catálogo | Pasa a ser propiedad del Módulo I. B la consume por `verificarFormaPagoActiva()` / `existeFormaPago()` / `obtenerFormaPago()` (`spec_modulo_I.md` §2.3). **Sin cambio de ruta ni de permiso.** Códigos de 2.3 alineados con `spec_modulo_I.md` §2.4: `404 FORMA_PAGO_NO_ENCONTRADA` (inexistente) y `409 FORMA_PAGO_NO_DISPONIBLE` (inactiva) |
| §3 | 3.1 a 3.8 | Regla 3.9: criterio de búsqueda compartido con el selector de Turnos |

**Fuera de alcance de esta spec (explícito):**
- Filtros combinados en el listado (estado, forma de pago, fecha de alta). ~~Búsqueda por texto~~: **incorporada en Revisión 2** (2.7).
- Baja lógica y reactivación del alumno (HU-B-06 §9 lo excluye explícitamente — el estado no es editable esta iteración).
- Recuperación de contraseña del autorregistro (cubierto por `spec_modulo_A.md`, fuera de alcance del Sprint).
- Envío real de email/SMS: el servicio de notificación (envío del código OTP) se referencia como interfaz (ubicación a confirmar contra el código; la convención del proyecto es `src/server/<módulo>/`, Regla N.° 11) pero su implementación de proveedor externo no es parte de esta spec.

**Actualización de alcance — Revisión 2 (Sprint 2):** la **búsqueda por texto** en el listado (2.7) pasa a estar dentro de alcance. Siguen fuera de alcance: filtros combinados (estado, forma de pago, fecha de alta) y la baja/reactivación del alumno.

---

## 1. Visión General

El Módulo B gestiona la **ficha de Alumno** (identidad, contacto, forma de pago preferida) y el flujo de **autorregistro de cuenta**. Es importante distinguir dos entidades relacionadas pero independientes:

- **`Alumno`** — la ficha de datos, que puede existir sin acceso al sistema (creada por Mesa de Entrada).
- **`Usuario`** (Módulo A) — la cuenta de acceso, con rol `ALUMNO`, opcionalmente vinculada a una ficha (`Alumno.usuario_id`, nullable).

Un `Alumno` puede crearse con cuenta simultánea (si Mesa de Entrada lo registra pensando en que el propio alumno accederá) o sin cuenta (caso más común en este sprint); una cuenta puede sumarse después vía autorregistro (HU-B-08), que vincula la nueva cuenta a la ficha existente en lugar de duplicarla.

**Alcance de esta revisión:** la Revisión 2 es **aditiva**: agrega la sección 2.7 (búsqueda de alumnos, HU-B-05) y la sección 2.8 (servicios públicos, Regla N.° 3), y las reglas 3.9 y 3.10. Las secciones 2.1 a 2.6 (Sprint 1) **no se renumeran**, porque otras specs las citan por número (ver `docs/adicionales/sdd-metodologia.md`); 2.3 y 2.4 solo reciben notas de revisión sin cambiar ruta ni permiso.

**Nota — forma de pago preferida no es el Módulo de Pagos:** el campo definido en HU-B-03 es exclusivamente una preferencia de UX para prellenar futuras operaciones (hoy, la forma de pago propuesta en el modal de registrar pago de HU-I-01), resuelta contra un catálogo precargado de **nombres genéricos** (seed con cuatro formas: `Efectivo`, `Transferencia`, `Débito`, `Mercado Pago`, según `spec_modulo_I.md`, changelog, fila «Modelo `FormaPago`»; el contenido exacto de `seed.ts` está a confirmar contra el código). No se solicita ni almacena ningún dato financiero sensible (número de tarjeta, CBU, etc.). El Módulo I (Pagos, `spec_modulo_I.md`, Sprint 2) gestiona transacciones reales y es una entidad completamente distinta — esta spec no lo anticipa ni lo reemplaza.

**Aislamiento de dominio (Regla N.° 3 de `docs/RULES.md`):** la tabla `Usuario` es propiedad del Módulo A. Este módulo **nunca** escribe directamente sobre `Usuario` — toda creación o vinculación de cuenta (HU-B-08) invoca el servicio público `crearCuentaConCredenciales()` expuesto por `src/server/usuarios/usuario.service.ts` (Módulo A).

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6. Las Server Actions ligadas a `useActionState` siguen la excepción de la Regla N.° 5.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/alumno.types.ts`, Server Actions en `src/server/alumnos/actions.ts` y services en `src/server/alumnos/alumno.service.ts` (autorregistro: `src/server/alumnos/autorregistro.service.ts`). Imports siempre con el alias `@/`. Los nombres exactos de funciones de servicio que la spec no fijaba están marcados «a confirmar contra el código».
- Los identificadores de `Alumno` y `FormaPago` son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo. El `solicitud_id` de HU-B-08 no corresponde a esas entidades ni está modelado en el esquema vigente: conserva su contrato UUID independiente.
- Toda ruta protegida requiere `withPermission("alumnos:<accion>")` (Regla N.° 10); el autorregistro (2.6) es la única superficie **pública** (sin sesión) de este módulo.
- Los schemas de identidad y contacto de 2.1/2.2 son reutilizados sin duplicación por el autorregistro (2.6) y por la modificación (2.5) — se componen, no se reescriben.

---

### 2.1. Alta de identidad del alumno (HU-B-01)

**Ruta:** `POST /api/alumnos`
**Server Action equivalente:** `crearAlumno()` en `src/server/alumnos/actions.ts`
**Servicio:** `crearAlumno()` en `src/server/alumnos/alumno.service.ts`
**Permiso requerido:** `alumnos:crear` (Mesa de Entrada)

```typescript
// src/server/alumnos/alumno.schema.ts (misma ruta que cita 2.7)
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

**Nota técnica — validación estricta de calendario:** `z.coerce.date()` sobre un `Date` nativo de JS "corrige" fechas inexistentes (`31/02` se interpreta como `03/03`). `fechaCalendarioValidaSchema` (ruta a confirmar contra el código: antes figuraba como `lib/schemas/shared/fecha.schema.ts`, convención anterior a la Regla N.° 11; ninguna otra spec fija la ubicación real) usa un parseo estricto (ej. `date-fns` `parse` + `isValid`) que **rechaza** explícitamente una fecha inexistente en lugar de reinterpretarla — utilidad compartida, reutilizable por cualquier otro módulo que reciba fechas de calendario (Profesor, Turno).

**Comportamiento esperado (`src/server/alumnos/alumno.service.ts` → `crearAlumno`):**
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

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido según `IdentidadAlumnoSchema` (incluye fecha de calendario inexistente o futura).
- `409 DNI_DUPLICADO` — el DNI ya existe en una ficha activa o inactiva (también ante `P2002`); el mensaje indica si la ficha existente está inactiva.

---

### 2.2. Registrar datos de contacto (HU-B-02)

**Ruta:** `PATCH /api/alumnos/[id]/contacto`
**Server Action equivalente:** `actualizarContactoAlumno()` en `src/server/alumnos/actions.ts`
**Servicio:** `actualizarContactoAlumno()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
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
1. Si viene `telefono`: normalizar eliminando espacios/guiones/paréntesis pero **conservando el `+` inicial** (`normalizarTelefono()`, utilidad compartida — mismo requisito en `spec_modulo_D.md` §2.2; ubicación exacta a confirmar contra el código: `spec_modulo_D.md` §2.1 ubica los schemas de contacto compartidos en `src/server/shared/contacto.schema.ts`). Validar longitud entre 8 y 15 dígitos, contando solo dígitos (el `+` no cuenta para la longitud).
2. Si viene `email`: dado que este email es el que eventualmente usará el alumno para autorregistrarse (HU-B-08), se valida su unicidad contra `Usuario.email` de **cualquier cuenta existente**, sin consultar la tabla `usuarios` (Regla N.° 3): por un servicio público del Módulo A (`verificarEmailNoAsociadoAOtraCuenta()`, nombre que cita `spec_modulo_D.md` §2.1; firma a confirmar, ver `spec_modulo_A.md` §2.4) — si ya pertenece a otra cuenta, `409 EMAIL_YA_ASOCIADO`, con un mensaje que **no revela a quién pertenece** esa cuenta.
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

**Errores esperados:**
- `400 VALIDATION_ERROR` — ni teléfono ni email, teléfono fuera de 8 a 15 dígitos o email inválido.
- `404 ALUMNO_NO_ENCONTRADO` — la ficha `[id]` no existe (no estaba explicitado en esta sección; a confirmar contra el código).
- `409 EMAIL_YA_ASOCIADO` — el email ya pertenece a otra cuenta; el mensaje no revela a quién.

---

### 2.3. Asociar alumno a forma de pago preferida (HU-B-03)

> **Revisión 2 (Sprint 2).** El catálogo de formas de pago pasa a ser del **Módulo I** (`spec_modulo_I.md`). La función `listarFormasPagoActivas()` que hoy vive en `alumno.service.ts` se **mueve** a Pagos (`forma-pago.publico.ts`); B la importa de allí. Donde esta sección pide "verificar que la `FormaPago` exista y esté activa", el servicio debe invocar `verificarFormaPagoActiva(forma_pago_id)` (y `existeFormaPago()` para distinguir `FORMA_PAGO_NO_ENCONTRADA` de `FORMA_PAGO_NO_DISPONIBLE`) en lugar de leer la tabla `formas_pago`. **Sin cambios de ruta, permiso ni mensajes.** Los códigos se alinean con `spec_modulo_I.md` §2.4: una forma **inexistente** responde `404 FORMA_PAGO_NO_ENCONTRADA` y una forma **inactiva** `409 FORMA_PAGO_NO_DISPONIBLE`. El nombre de la forma de pago en el detalle (2.4) se resuelve con `obtenerFormaPago()`, que devuelve también las formas desactivadas (3.5).

**Ruta:** `PATCH /api/alumnos/[id]/forma-pago`
**Server Action equivalente:** `actualizarFormaPagoPreferida()` en `src/server/alumnos/actions.ts`
**Servicio:** `actualizarFormaPagoPreferida()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `alumnos:editar`

```typescript
export const FormaPagoPreferidaSchema = z.object({
  forma_pago_id: z.string().cuid().nullable(), // null = "Sin preferencia"
});
export type FormaPagoPreferidaInput = z.infer<typeof FormaPagoPreferidaSchema>;
```

**Modelo de referencia:** catálogo `FormaPago` (`id`, `nombre`, `is_active`), precargado por seed desde Sprint 1 con cuatro formas (`Efectivo`, `Transferencia`, `Débito`, `Mercado Pago`; ver `spec_modulo_I.md`, changelog, fila «Modelo `FormaPago`»; contenido exacto de `seed.ts`: a confirmar contra el código) — sin ningún campo de dato financiero.

**Comportamiento esperado:**
1. Si `forma_pago_id` no es `null`: verificar que la `FormaPago` exista y tenga `is_active: true` **en el momento de confirmar** (no basta con haber estado activa cuando se abrió el formulario). Si no existe (`existeFormaPago()` devuelve `false`): `404 FORMA_PAGO_NO_ENCONTRADA`. Si existe pero está inactiva: `409 FORMA_PAGO_NO_DISPONIBLE`, se informa el cambio. En ambos casos no se guarda.
2. Actualiza `Alumno.forma_pago_preferida_id`, reemplazando cualquier preferencia anterior (constraint: una sola preferencia por alumno, ya garantizado por ser un único campo FK nullable, no una tabla de relación N:M).
3. **Regla de no retroactividad (análoga a la de costeo del proyecto de referencia):** cambiar o quitar la preferencia **no** modifica ningún pago histórico — cada pago conserva la forma de pago con la que fue registrado (Módulo I, `spec_modulo_I.md`). El turno no lleva forma de pago (HU-C-11 retirada en el backlog v2): la forma de pago vive solo en el `Pago`. Este campo es únicamente el valor por defecto sugerido en operaciones futuras.
4. Emitir `alumno:forma_pago_actualizada` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "forma_pago_preferida_id": "cuid" }, "error": null }
```

**Errores esperados:** (los dos de la forma de pago, como en `spec_modulo_I.md` §2.4)
- `400 VALIDATION_ERROR` — `forma_pago_id` no es un CUID ni `null`.
- `404 ALUMNO_NO_ENCONTRADO` — la ficha `[id]` no existe (no estaba explicitado en esta sección; a confirmar contra el código).
- `404 FORMA_PAGO_NO_ENCONTRADA` — la forma no existe.
- `409 FORMA_PAGO_NO_DISPONIBLE` — la forma existe pero está inactiva.

---

### 2.4. Listado y detalle de alumnos (HU-B-04)

> **Revisión 2 (Sprint 2).** `ListarAlumnosQuerySchema` agrega el parámetro opcional `q` (búsqueda de 2.7). **Definición única en 2.7** (`pagina`, `por_pagina` y `q`); acá no se repite. Sin `q`, el comportamiento y la respuesta son los de siempre.

**Ruta (listado):** `GET /api/alumnos`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarAlumnos()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `alumnos:leer`

**Parámetros de query:** `pagina` (default 1), `por_pagina` (máximo 20, default 20) y `q` opcional; el schema Zod `ListarAlumnosQuerySchema` se define **una sola vez, en 2.7**.

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

**Ruta (detalle):** `GET /api/alumnos/[id]` — identidad, contacto, forma de pago preferida (nombre resuelto, no solo el id), estado, fecha de alta. Servicio: `obtenerAlumno()` en `alumno.service.ts` (nombre a confirmar contra el código); permiso `alumnos:leer`; Server Action: — (solo Route Handler).

**Errores esperados:**
- `400 VALIDATION_ERROR` — parámetros de query inválidos (`pagina`, `por_pagina` mayor a 20, `q`, ver 2.7).
- `404 ALUMNO_NO_ENCONTRADO` — detalle de una ficha inexistente (a confirmar contra el código).

---

### 2.5. Modificación de datos del alumno (HU-B-06)

**Ruta:** `PATCH /api/alumnos/[id]`
**Server Action equivalente:** `modificarAlumno()` en `src/server/alumnos/actions.ts`
**Servicio:** `modificarAlumno()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
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

**Paso previo (sin numerar, para no mover la numeración que citan otras specs):** dentro de la transacción, leer la ficha por `id`. Si no existe: `404 ALUMNO_NO_ENCONTRADO`. Así, `count === 0` en el paso 3 solo puede significar una edición concurrente.

**Comportamiento esperado:**
1. Si viene `dni`: validar unicidad excluyendo la propia ficha (`id != alumnoId`), contra activas e inactivas — mismo criterio que 2.1.
2. Si viene `email`: validar unicidad contra `Usuario.email` — mismo criterio que 2.2. Si la ficha ya tiene una cuenta vinculada (`Alumno.usuario_id` no nulo), el cambio de email **también actualiza `Usuario.email`** dentro de la misma transacción (ambas tablas son parte de la misma operación de negocio "cambiar el email de contacto/acceso del alumno" — no es una violación del aislamiento de Módulo A porque se invoca el servicio público `actualizarEmailCuenta()` de `src/server/usuarios/usuario.service.ts`, nunca un `UPDATE` directo sobre `Usuario`).
3. **Concurrencia optimista (Regla N.° 7 de `docs/RULES.md`, aplicada aquí a un `UPDATE` en lugar de un decremento de stock):**
   ```typescript
   const resultado = await tx.alumno.updateMany({
     where: { id: alumnoId, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, updated_at: new Date() },
   });
   if (resultado.count === 0) {
     throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
     // La existencia de la ficha ya se verificó en el «paso previo» (antes del paso 1),
     // así que count === 0 significa que alguien más la modificó entre que el cliente
     // cargó el formulario y confirmó (la `version` ya no coincide).
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

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (el schema es `.strict()` y `version` es obligatoria).
- `404 ALUMNO_NO_ENCONTRADO` — la ficha no existe («paso previo»).
- `409 DNI_DUPLICADO` — el `dni` nuevo pertenece a otra ficha (mismo criterio que 2.1).
- `409 EMAIL_YA_ASOCIADO` — el email nuevo pertenece a otra cuenta (mismo criterio que 2.2).
- `409 CONFLICTO_EDICION_CONCURRENTE` — la `version` ya no coincide.
- Si viene `forma_pago_id`: `404 FORMA_PAGO_NO_ENCONTRADA` / `409 FORMA_PAGO_NO_DISPONIBLE` como en 2.3 (a confirmar contra el código; esta sección no lo explicitaba).

---

### 2.6. Autorregistro del alumno (HU-B-08)

**Superficie pública** (sin sesión), accesible desde "Crear cuenta" del login. **Permiso requerido:** público (sin sesión; no pasa por `withPermission`), acotado por rate limit por IP.

**Ruta (paso 1 — registro):** `POST /api/auth/autorregistro`
**Server Action equivalente:** `iniciarAutorregistro()` en `src/server/alumnos/actions.ts` (antes citada en `app/(public)/autorregistro/actions.ts`, ubicación anterior a la Regla N.° 11; ubicación real: a confirmar contra el código)
**Servicio:** `iniciarAutorregistro()` en `src/server/alumnos/autorregistro.service.ts`

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

**Política de contraseña (HU-B-08, Sprint 1, ya implementada):** el criterio de aceptación dice que la contraseña "cumple la política de seguridad configurada" y que no puede coincidir con el email ni con el DNI; no fija las reglas concretas. La HU está en Done, así que la política vigente es la que implementa el código. Los valores que esta spec proponía (mínimo 8 caracteres, una mayúscula, una minúscula y un número) eran una propuesta y **no son contrato**: la política real está **a confirmar contra el código** (ver pendientes de repo). No es un punto abierto para el PO.

**Comportamiento esperado (`src/server/alumnos/autorregistro.service.ts` → `iniciarAutorregistro`):**
1. Verificar rate limit por IP (tabla operativa `IntentoRegistro`, mismo patrón síncrono que `IntentoLoginFallido` de `spec_modulo_A.md` §3.3): máximo 5 registros por IP por hora.
2. Verificar que no exista ya un `Usuario` con ese `email` → si existe, `409 CUENTA_YA_EXISTE`, mensaje genérico: "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada."
3. Buscar `Alumno` por `dni`:
   - **(a) No existe ninguna ficha:** crear `Alumno` (mismos datos y validaciones que 2.1) **y** la cuenta `Usuario` (rol `ALUMNO`, vía el servicio público de Módulo A `crearCuentaConCredenciales()`) **en una única `prisma.$transaction`** — si cualquier parte falla, no se crea nada. Responde éxito directo (sin paso de verificación de código).
   - **(b) Existe una ficha con `usuario_id: null` (sin cuenta vinculada):** no se duplica la ficha. Si `Alumno.email` está registrado (dato de contacto ya cargado por Mesa de Entrada, HU-B-02) y coincide con el flujo esperado, se inicia el circuito de verificación por código (paso 2, abajo) contra ese email — **no** contra el email recién tipeado en el formulario, para no permitir que alguien reclame una ficha ajena usando un email propio. Se persiste una `SolicitudAutorregistro` (ver 3.6) con el `password_hash` ya calculado (bcrypt, costo 12, salt único — nunca en texto plano), pendiente de confirmación.
   - **(c) Existe una ficha con `usuario_id` ya asignado:** mismo tratamiento que (b)-existe-cuenta: `409 CUENTA_YA_EXISTE`, mismo mensaje genérico que el paso 2 (no distinguible desde el cliente).
   - **(d) Existe una ficha sin cuenta pero sin email verificable, o el email no coincide con el de contacto registrado:** se deriva a Mesa de Entrada **sin revelar cuál dato no coincidió ni información de la ficha existente**: "No pudimos completar el registro en línea. Acercate a mesa de entrada para vincular tu cuenta." (`200 OK` con este mensaje — no es un error, es el resultado esperado del flujo, igual que el resto de estas ramas no deben ser distinguibles entre sí por un atacante).
4. Registrar aceptación de términos (`AceptacionTerminos`: `version_terminos`, `fecha_hora`) — se persiste al momento de crear la cuenta (rama a) o al confirmar el código (rama b, ver 2.6 paso 2), nunca antes de que la cuenta exista realmente.
5. Emitir el evento correspondiente (sección 4) — como evento de seguridad, mismo canal de auditoría que Módulo A.

**Ruta (paso 2 — verificación de código, solo rama b):** `POST /api/auth/autorregistro/verificar-codigo`
**Server Action equivalente:** `confirmarCodigoAutorregistro()` (nombre a confirmar contra el código) en `src/server/alumnos/actions.ts`
**Servicio:** `confirmarCodigoAutorregistro(solicitudId, codigo)` en `src/server/alumnos/autorregistro.service.ts`
**Permiso requerido:** público (sin sesión)

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

**Ruta (reenvío de código):** `POST /api/auth/autorregistro/reenviar-codigo`
**Servicio:** función de reenvío en `autorregistro.service.ts` (nombre a confirmar contra el código) · **Permiso requerido:** público (sin sesión)
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

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (`AutorregistroAlumnoSchema` o `VerificarCodigoAutorregistroSchema`).
- `409 CUENTA_YA_EXISTE` — ya hay un `Usuario` con ese email (paso 2) o la ficha ya tiene cuenta vinculada (rama c); mensaje genérico, indistinguible.
- Rate limit por IP excedido (registro: 5 por hora) o de reenvíos (3 por hora, 60 s entre reenvíos): código y status a confirmar contra el código (`spec_modulo_A.md` §3.3 usa `RATE_LIMIT_EXCEDIDO` para el login).
- Verificación de código fallida (código vencido, sin intentos restantes o incorrecto): error específico sin revelar qué parte falló; código y status a confirmar contra el código.
- La rama (d) no es un error: responde `200` con `via: "DERIVADO_MESA_ENTRADA"`.

---

### 2.7. Búsqueda de alumnos en el listado (HU-B-05) — NUEVA en Revisión 2

**Ruta:** la misma de 2.4, `GET /api/alumnos` — **no es una pantalla nueva**: un campo de búsqueda sobre `/alumnos` (mapa de pantallas §1, fila HU-B-05).
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarAlumnos()` con el filtro de `construirFiltroBusquedaAlumno()` (`src/server/alumnos/alumno.busqueda.ts`), en `alumno.service.ts` (nombre de la función de listado: a confirmar contra el código)
**Permiso requerido:** `alumnos:leer` (sin cambios: exclusivo de Mesa de Entrada)

```typescript
// src/server/alumnos/alumno.schema.ts — definición ÚNICA de ListarAlumnosQuerySchema (2.4 remite acá)
export const ListarAlumnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
  q: z.string().trim().max(100).optional(), // HU-B-05
});
```

**Comportamiento esperado:**
1. Si `q` tiene menos de **2 caracteres** tras el `trim`, se **ignora** (equivale a no buscar). La UI no lo envía (AC1, umbral de 2 caracteres); la regla evita que un `q` de un carácter devuelva un listado engañoso.
2. Se normaliza con `normalizarTexto(q)` (minúsculas y sin acentos, la utilidad de `spec_modulo_L.md`) y se parte en **tokens** por espacios (máximo 5).
3. **Cada token** debe coincidir, de forma **parcial** (`contains`), con al menos uno de estos campos de la ficha: `apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, o `dniAlumno` cuando el token es solo dígitos. Entre tokens es **AND**; entre campos, **OR**. Así "juan perez" y "perez juan" encuentran a Juan Pérez (AC2, varias palabras en cualquier orden), "gom" encuentra "Gómez" y "Gomez" (AC1, coincidencia parcial sin distinguir mayúsculas ni acentos), y "3012" encuentra por DNI parcial (AC1, filtra por Apellido, Nombre o DNI).
4. La búsqueda opera sobre **alumnos activos e inactivos**, igual que el listado (AC de HU-B-04): el estado se sigue mostrando en la columna Estado.
5. El **orden es el del listado** (`apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, `dniAlumno`), **no por relevancia** (AC7); la **paginación y el `total` son sobre el resultado filtrado**, no sobre el total (AC4). Sin `q` válido (texto borrado o de menos de 2 caracteres) se devuelve el listado completo, sin filtro y con el orden original apellido, nombre ascendente (AC6). El orden por defecto es el de 2.4.
6. Sin coincidencias: `200` con `items: []`. El mensaje "No se encontraron alumnos para «texto»" con la opción "Nuevo alumno" es responsabilidad de la UI (AC5): el texto se muestra tal como quedó tras el `trim`, y el acceso a "Nuevo alumno" (`alumnos:crear`) se conserva.

**Respuesta `200 OK`:** la misma de 2.4 (mismo formato de fila que el listado original, AC3).

**Errores esperados:**
- `400 VALIDATION_ERROR` — `pagina`, `por_pagina` (máximo 20) o `q` (máximo 100 caracteres) inválidos según `ListarAlumnosQuerySchema`. Un `q` de menos de 2 caracteres no es un error: se ignora.

**Comportamiento de la pantalla `/alumnos` (cliente) — AC3 y AC4:**
- **Actualización sin recargar la pantalla completa (AC3):** al escribir en el campo de búsqueda, el cliente llama a `GET /api/alumnos?q=<texto>&pagina=<n>&por_pagina=20` con un **debounce de 300 ms** contado desde la última tecla, y reemplaza solo la tabla de resultados y el paginador. No hay navegación ni recarga de la página completa. Mientras la petición está en curso se muestra un **estado de carga** en la zona de resultados; el campo de búsqueda no se deshabilita ni pierde el foco. Si llega la respuesta de una petición anterior a la última enviada, se descarta: solo cuenta la del texto vigente. (Los 300 ms son una decisión de diseño de esta spec: el AC no fija milisegundos.)
- **Página 1 al cambiar el texto (AC4):** cada vez que cambia el texto de búsqueda, la petición pide `pagina=1`. Cambiar de página con el paginador conserva `q` y navega sobre el resultado filtrado (`total` y `total_paginas` son los del filtrado).
- **Umbral y borrado (AC1, AC6):** con menos de 2 caracteres tras el `trim` (incluido el campo vacío) el cliente no envía `q` y pide el listado completo, también en `pagina=1`.

**Fuera de alcance:** filtros combinados por estado, forma de pago u otro criterio (AC8), búsqueda por email o teléfono, ordenamiento por relevancia, autocompletado del servidor.

**Criterio compartido con Turnos:** el selector de alumnos de HU-C-04 (`buscarAlumnosActivos(query)`, en `alumno.service.ts`) usa **el mismo umbral y la misma normalización** (mínimo 2 caracteres, normalizado, parcial), pero devuelve **solo activos y como máximo 10 resultados**. **Diferencia real que hay que respetar:** hoy el selector busca el **texto completo** contra nombre, apellido y DNI con un único `OR` (sin tokens), y `alumno.busqueda.test.ts` mockea exactamente esa forma (`where.OR`). Con un solo token, el filtro de tokens de 2.7 da el mismo resultado; con varios ("juan perez") el selector actual **no** encuentra nada. Se extrae `construirFiltroBusquedaAlumno(q)` en `src/server/alumnos/alumno.busqueda.ts` y, para no romper el selector ya verificado en Sprint 1, el desarrollador elige: (a) que el selector lo adopte y se actualice ese test, o (b) dejar el selector como está y agregar un test de paridad para un solo token. Cualquiera de las dos es válida; lo que no se admite es que diverjan sin test.

---

### 2.8. Servicios públicos del módulo (Regla N.° 3) — NUEVA en Revisión 2

Conforme a la Regla N.° 3: se declaran en `src/server/alumnos/alumno.publico.ts`. **No importa nada de otros módulos.** El parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador.

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerAlumnoDeUsuario(usuarioId, db?)` | `{ id, activo } \| null`: la ficha vinculada a la cuenta (`Alumno.usuarioId`) | `spec_modulo_C.md` §2.14 (autoservicio) |
| `obtenerAlumnosBasicos(ids, db?)` | `{ id, nombre, apellido, dni, activo, forma_pago_preferida_id }[]` (lote, activos o inactivos, ids inexistentes simplemente no aparecen). `forma_pago_preferida_id` es `null` si el alumno está "Sin preferencia" | `spec_modulo_I.md` §2.3 (`listarPagosDeTurno`), §2.4 y §2.5 (alumno que paga y forma de pago propuesta); `spec_modulo_E.md` §2.1 (`GET` del registro de clase: nombres de los inscriptos, en lote) |
| `obtenerAlumnoBasico(id, db?)` | `{ id, nombre, apellido, activo } \| null`, activo o inactivo | `spec_modulo_E.md` §2.3 (nombre del alumno en el historial; E la cita también en su §3.5) |
| `verificarAlumnoActivo(alumnoId)` | verifica que la ficha exista y esté activa, **distinguiendo** los dos fallos con los códigos `ALUMNO_NO_ENCONTRADO` (no existe) y `ALUMNO_INACTIVO` (existe con `activo = false`); ver «Códigos de `verificarAlumnoActivo()`» abajo (**existente de Sprint 1**; firma exacta: a confirmar contra `alumno.service.ts`) | `spec_modulo_C.md` §2.2, §2.5; `spec_modulo_E.md` §2.2. **No** lo consume C §2.14 (autoservicio: usa el `activo` de `obtenerAlumnoDeUsuario()`) |
| `buscarAlumnosActivos(query)` | `{ id, nombre, apellido, dni }[]`, solo activos, máximo 10; activación desde 2 caracteres, coincidencia parcial sobre columnas normalizadas (**existente de Sprint 1**, `alumno.service.ts`; ver «Criterio compartido con Turnos» en 2.7) | `spec_modulo_C.md` §2.5 |
| `contarAlumnosNuevosPorMes(desde, hasta, db?)` | `{ mes: "YYYY-MM", cantidad }[]`, **solo los meses con datos** (los ceros los completa H) | `spec_modulo_H.md` §2.1 |

**Códigos de `verificarAlumnoActivo()`:** ficha inexistente → `ALUMNO_NO_ENCONTRADO`; ficha existente inactiva → `ALUMNO_INACTIVO`; activa → resuelve sin error. Lo que esta spec contractualiza es la **distinción** de ambos casos con esos códigos (B es quien la resuelve, para que los consumidores no la reimplementen leyendo `alumnos`). La forma exacta en que se propagan (`ServiceError` con ese `code` o resultado discriminado) queda **a confirmar contra `alumno.service.ts`**. La traducción a HTTP es del consumidor: `spec_modulo_E.md` §2.2 responde `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO`; C §2.2 y §2.5 rechazan e informan cuál alumno es inválido.

**`contarAlumnosNuevosPorMes`:** `desde` y `hasta` son meses `AAAA-MM`. Cuenta **todas** las fichas (activas o inactivas, con o sin cuenta de acceso) agrupadas por el mes de `createdAtAlumno` **en `America/Argentina/Buenos_Aires`**, no en UTC. Implementación con `$queryRaw` parametrizado (`Prisma.sql`, nunca SQL concatenado): `date_trunc('month', "createdAtAlumno" AT TIME ZONE 'America/Argentina/Buenos_Aires')`, con el límite inferior en el primer instante de `desde` y el superior en el primero del mes siguiente a `hasta`, ambos expresados en esa misma zona.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/alumnos/*.service.ts` (`alumno.service.ts`, `autorregistro.service.ts`). Route Handlers y Server Actions son capa delgada (Regla N.° 4 de `docs/RULES.md`).

### 3.1. Ficha (`Alumno`) y Cuenta (`Usuario`) son entidades separadas
Ningún servicio de este módulo asume que un `Alumno` tiene cuenta. `Alumno.usuario_id` es nullable y su ausencia es el caso esperado por defecto en altas hechas por Mesa de Entrada.

### 3.2. Aislamiento de dominio: la tabla `Usuario` no se escribe directamente
Toda creación o modificación de `Usuario` originada en este módulo (autorregistro, cambio de email vinculado) pasa por los servicios públicos de `src/server/usuarios/usuario.service.ts` (Módulo A) — nunca un `prisma.usuario.create()`/`update()` directo desde `src/server/alumnos/*` (Regla N.° 3).

### 3.3. Concurrencia optimista en modificación de ficha
Todo `UPDATE` sobre `Alumno` desde HU-B-06 aplica el patrón de condición-y-mutación-atómica de la Regla N.° 7, usando `version` como campo de control en lugar de una cantidad de stock — mismo mecanismo, mismo principio: la condición (`version` sin cambios) y la mutación (aplicar cambios + incrementar `version`) ocurren en una única sentencia, nunca en un `findUnique` + `update` separados.

### 3.4. Unicidad de DNI contra el universo completo (activas + inactivas)
Igual que `spec_modulo_L.md` §3.1: una ficha inactiva sigue "ocupando" su DNI. Doble validación (aplicativa + constraint `P2002`), igual patrón.

### 3.5. Forma de pago preferida es un valor por defecto, no un compromiso retroactivo
Cambiarla no reescribe ningún pago ya registrado (regla de no retroactividad, sección 2.3).

### 3.6. Códigos de verificación (OTP): solo hash, comparación en tiempo constante, un solo uso
- Se persiste únicamente `HMAC-SHA256(codigo, CODIGO_OTP_SECRET)`, nunca el código en claro.
- La comparación usa `crypto.timingSafeEqual`, nunca `===` (mitigación de timing attack, mismo principio que la verificación de contraseña de `spec_modulo_A.md` §3.1).
- Un código consumido o reemplazado por un reenvío deja de ser válido de inmediato — no queda como alternativa válida "por las dudas".

### 3.7. Rate limiting operacional, tabla síncrona (no vía evento)
`IntentoRegistro` (registro) y el contador de reenvíos de código se escriben de forma síncrona en el propio servicio — mismo razonamiento que `spec_modulo_A.md` §3.3: el límite debe estar disponible para la siguiente solicitud sin depender de un proceso asíncrono.

### 3.8. Ningún dato sensible en logs ni en tablas de eventos
`password`, `password_hash`, el código OTP en claro y su HMAC no se guardan jamás en `EventoSeguridad`, en `IntentoRegistro` ni en logs de aplicación — mismo principio que `spec_modulo_A.md` §3.4.

---

### 3.9. Un solo criterio de búsqueda de alumnos (Revisión 2)
El listado de Mesa de Entrada (2.7) y el selector de Turnos comparten `construirFiltroBusquedaAlumno()`: mismo umbral de 2 caracteres, misma normalización, misma coincidencia parcial. Solo difieren en lo que devuelven (todos vs. solo activos, paginado vs. tope de 10). Si el criterio cambia, cambia para ambos.

### 3.10. Los meses de un alta se miden en la zona horaria del centro (Revisión 2)
`createdAtAlumno` es un timestamp: agrupar por mes en UTC asignaría al mes siguiente las altas hechas de noche. `contarAlumnosNuevosPorMes()` agrupa siempre en `America/Argentina/Buenos_Aires`.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

**Opción usada: (b), escritura directa y síncrona a una tabla de eventos por dominio.** Motivo: la ficha admite múltiples eventos discretos y repetibles a lo largo del tiempo (contacto, forma de pago, modificaciones, códigos de verificación e intentos de autorregistro), varios de ellos eventos de seguridad. La ficha conserva además sus columnas de ciclo de vida (`created_at`, `updated_at`, `version`, usuario registrante, opción (a)), que no reemplazan a los eventos.

Conforme a `docs/RULES.md` Regla N.° 2: todo evento (opción b) se escribe después de que `prisma.$transaction` resuelva, nunca dentro de la transacción de negocio. Los eventos de este módulo relacionados a cuentas (autorregistro) son, además, eventos de seguridad — misma tabla `EventoSeguridad` que `spec_modulo_A.md` §4 (tipos ya existentes en el enum: `REGISTRO_CUENTA`, `VERIFICACION_CODIGO_EXITOSA`, `VERIFICACION_CODIGO_FALLIDA`, `CODIGO_VERIFICACION_GENERADO`, `AUTORREGISTRO_DERIVADO_MESA_ENTRADA`). Los nombres `alumno:*` de la tabla siguiente son nombres lógicos del evento; su mapeo exacto a `tipoEvento` y los campos que realmente guarda `EventoSeguridad` (`usuarioId`, `emailEvento`, `ipEvento`, sin payload libre) quedan **a confirmar contra el código**; en particular, `valor_anterior`/`valor_nuevo` no existen en ninguna tabla.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `alumno:creado` | Alta directa (2.1) | `alumno_id, dni, usuario_registrante_id` |
| `alumno:contacto_actualizado` | Contacto (2.2) | `alumno_id, campos_modificados, usuario_id` |
| `alumno:forma_pago_actualizada` | Forma de pago (2.3) | `alumno_id, forma_pago_id, usuario_id` |
| `alumno:actualizado` | Modificación (2.5) | `alumno_id, campos_modificados, valor_anterior, valor_nuevo, usuario_id` |
| `alumno:autorregistro_completado` | Autorregistro exitoso (2.6, rama a o verificación de código) | `alumno_id, usuario_id, via: "DIRECTO" \| "VINCULACION_OTP"` |
| `alumno:codigo_verificacion_generado` | Envío/reenvío de código (2.6) | `alumno_id, solicitud_id, ip` — **nunca** el código |
| `alumno:autorregistro_derivado_mesa_entrada` | Rama (d), datos no coinciden (2.6) | `dni, ip` — nunca detalle de qué no coincidió |

**Revisión 2 (Sprint 2).** La búsqueda (2.7) y los servicios públicos (2.8) son de solo lectura: **no emiten eventos**.
```
