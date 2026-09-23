# TASK: HU-D-02 — Registrar datos de contacto del profesor

**Módulo:** D (Profesor)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` sección 2.2 · reglas sección 3.1 · eventos sección 4 (ver nota de alcance §1) · `spec_modulo_B.md` §2.2 (referencia de diseño del contacto) · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-D-02, criterios de aceptación 1-6
**RBAC:** no existía la acción `profesores:editar` en `RolPermiso` — esta task la agrega (exclusiva de `GERENTE`), por migración y por seed (§4.0). `rutas-por-rol.ts` ya restringía `/profesores/**` a `GERENTE`.
**Schema:** requiere migración. `model Profesor` ya tenía `telefonoProfesor`, `emailProfesor` (ambos `String?`) y `updatedAtProfesor @updatedAt`; faltaba registrar **quién** modificó la ficha. Esta task agrega `modificadoPorUsuarioId String?` (migración `20260923015526_profesor_contacto_modificado_por`, §4.0).
**Implementación:** commit `bd6a8f0` ("feat: Registrar datos de contacto del profesor"), mergeado a `develop` en `b4964f1` (PR #40). Este documento se escribió **después** de la implementación, a partir de ese commit y del código actual.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

**Nota — task documentada a posteriori:** HU-D-02 se implementó sin un documento de task previo. Este archivo registra lo que realmente quedó en el código; las decisiones de §1 se reconstruyeron a partir del código y sus comentarios, no de un relevamiento aprobado antes de implementar.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

1. **Validación de contacto compartida con Alumno (HU-B-02).** Las reglas de teléfono y email de los criterios 1-3 son las mismas para Profesor y Alumno (`spec_modulo_D.md` §2.2 remite a `spec_modulo_B.md` §2.2). Se implementan una sola vez, en `src/server/shared/`, sin ninguna referencia a "profesor":
   - `src/server/shared/contacto.ts` → `normalizarTelefono()` y `contarDigitosTelefono()` (funciones puras);
   - `src/server/shared/contacto.schema.ts` → `ContactoSchema` (Zod, usado en cliente y servidor).
   - `profesor.schema.ts` solo lo re-exporta como `ContactoProfesorSchema` / `ContactoProfesorInput`.
   - Pensada para que HU-B-02 la reutilice. **Verificado en el código actual:** `src/server/alumnos/alumno.schema.ts` importa el mismo `ContactoSchema`. Reutilizar una utilidad pura entre módulos no es acoplamiento de dominio (Regla N.° 3 de `docs/RULES.md`).

2. **DECISIÓN RESUELTA — criterio 4 (email vinculado a otra cuenta).** Se rechaza un email que ya sea el `emailUsuario` de una cuenta **distinta** de la vinculada al profesor (`Profesor.usuarioId`):
   - si el profesor tiene cuenta, su propia cuenta queda excluida de la búsqueda (puede conservar o volver a cargar su email de login);
   - si el profesor **no** tiene cuenta, no puede usar ningún email que pertenezca a una cuenta;
   - la comparación no distingue mayúsculas (`mode: "insensitive"`), porque `emailUsuario` no garantiza estar guardado en minúsculas;
   - el mensaje ("Ese email ya está asociado a otra cuenta") no revela a quién pertenece la otra cuenta.

3. **DECISIÓN RESUELTA — no se actualiza el email de login del `Usuario`.** `actualizarContactoProfesor()` nunca modifica `Usuario`: el email de contacto de la ficha y el email de login son datos independientes. Las cuentas se administran por separado (HU-D-01 criterio 5, `spec_modulo_D.md` §3.1); su gestión corresponde a Sprint 3.

4. **DECISIÓN RESUELTA — la ficha `/profesores/[id]` exige `profesores:editar`.** `profesores:leer` todavía no existía (lo crea HU-D-05, dueña del listado y el detalle). El único permiso con sentido sobre una ficha existente era `profesores:editar`, así que la ficha lo exige y pasa `puedeEditar` fijo en `true`. Queda anotado en el propio `page.tsx` qué cambiar cuando exista `profesores:leer` (ver §9).

5. **DECISIÓN RESUELTA — `EMAIL_YA_ASOCIADO` como error de campo, no como `409`.** La única superficie de esta HU es una Server Action (§4.3), y una Server Action no devuelve status HTTP (Regla N.° 5). El error se devuelve como `{ status: "error_validacion", errores: { email: [...] } }`, así se pinta junto al campo email igual que un error de formato (criterio 6).

6. **DECISIÓN RESUELTA — trazabilidad (Regla N.° 2): opción (a), columnas de auditoría.**
   - `spec_modulo_D.md` §2.2 paso 4 pide emitir `profesor:contacto_actualizado`. La infraestructura de eventos no existe (mismo estado documentado en HU-D-01 §1 punto 4).
   - La fecha de última modificación (criterio 5) la registra `updatedAtProfesor @updatedAt`. **Quién** modificó se registra en la columna nueva `modificadoPorUsuarioId`, en el mismo `UPDATE`. No se emite evento.
   - Esa columna la reutilizaron después HU-D-03 y HU-D-04, que setean `modificadoPorUsuarioId` al asociar materias y registrar horarios.

7. **DECISIÓN RESUELTA — se guardan siempre los dos campos.** El formulario precarga el contacto actual, así que vaciar un campo es una decisión explícita del usuario: un campo vacío se guarda como `null` y borra el valor anterior. El schema garantiza que al menos uno quede cargado. Esto difiere de la spec ("actualiza únicamente los campos provistos"), ver §8.2.

**Fuera de alcance de esta task (explícito):**
- Crear, vincular o modificar la cuenta (`Usuario`) del profesor, incluido su email de login (punto 3).
- Dirección del profesor (`direccionProfesor` existe en el schema, pero los criterios de HU-D-02 solo piden teléfono y email).
- Eventos de dominio / `AuditLog` (punto 6).
- HU-D-03 (materias), HU-D-04 (horarios) y HU-D-05 (listado y detalle completo). La ficha de esta HU deja la estructura (`FichaSeccion`, `FichaDatos`, `FichaEncabezado`) para que esas HU agreguen sus secciones.
- Modificación de identidad o baja lógica del profesor.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** registrar los datos de contacto de un profesor
**Para** coordinar su agenda y comunicar novedades

**SP estimado:** 1

**Justificación de secuencia (`HU-Sprint-1.md`):** depende de HU-D-01. No bloquea la asignación de turnos.

### 2.1. Criterios de aceptación y cómo se cumple cada uno

| # | Criterio (`HU-Sprint-1.md`) | Cómo se cumple | Archivos |
|---|---|---|---|
| 1 | Desde la ficha se registran Teléfono y Email; al menos uno obligatorio. Si ambos vacíos: "Ingresá al menos un teléfono o un email de contacto". | La ficha muestra la sección "Datos de contacto" con el acceso "Cargar contacto" / "Editar contacto" hacia el formulario. `ContactoSchema` trata un campo vacío, con solo espacios o ausente del `FormData` como "no provisto" y, si faltan los dos, agrega el error `MENSAJE_CONTACTO_REQUERIDO` sobre `telefono`. | `profesores/[id]/page.tsx`, `ficha-contacto.tsx`, `[id]/contacto/page.tsx`, `contacto-profesor-form.tsx`, `src/server/shared/contacto.schema.ts` |
| 2 | Teléfono: formatos habituales, normalizado, 8-15 dígitos (dígitos + +, espacios, guiones, paréntesis; conserva + inicial). Longitud solo sobre dígitos. | `telefonoContactoSchema`: regex de caracteres permitidos (`+` solo al inicio), `normalizarTelefono()` y `refine` sobre `contarDigitosTelefono()` entre 8 y 15. Se guarda el valor normalizado. Detalle en §4.1. | `src/server/shared/contacto.ts`, `contacto.schema.ts` |
| 3 | Email: sin espacios al inicio/fin, formato válido, minúsculas, máximo 254 caracteres. | `emailContactoSchema`: `trim()`, `toLowerCase()`, `z.email()` y `max(254)`. | `contacto.schema.ts` |
| 4 | Si el email está vinculado a una cuenta interna, no puede pertenecer a otra cuenta (verificación en servidor, aviso no revela a quién pertenece). | `actualizarContactoProfesor()` busca en `Usuario` un `emailUsuario` igual (sin distinguir mayúsculas), excluyendo la cuenta propia del profesor; si existe, lanza `EMAIL_YA_ASOCIADO`. La action lo traduce a un mensaje genérico en el campo email (§1 puntos 2 y 5). | `profesor.service.ts`, `profesores/actions.ts` |
| 5 | Con datos válidos: "Datos de contacto del profesor guardados correctamente". Guardado transaccional, actualiza fecha de última modificación. | Verificación y `UPDATE` dentro de un único `prisma.$transaction`. `updatedAtProfesor` lo actualiza Prisma (`@updatedAt`) y `modificadoPorUsuarioId` registra quién. El formulario muestra el mensaje exacto y los valores guardados (ya normalizados). | `profesor.service.ts`, `contacto-profesor-form.tsx`, migración |
| 6 | Errores junto al campo correspondiente, evitan guardar información parcial. | Cada campo tiene `aria-invalid` y `<p role="alert">` propio; `EMAIL_YA_ASOCIADO` también se pinta en el campo email. Si falla la validación de cliente no se envía nada; si falla en servidor, la transacción no escribe nada. El foco va al primer campo inválido (`enfocarPrimerCampoInvalido`). | `contacto-profesor-form.tsx`, `profesores/actions.ts`, `src/lib/enfocar-primer-invalido.ts` |

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_D.md` §2.2, con las decisiones de §1 y las desviaciones de §8. Incluye:
- Migración: columna `modificadoPorUsuarioId` y permiso `profesores:editar` (§4.0).
- Validación de contacto compartida en `src/server/shared/` (§4.1).
- Servicios `obtenerFichaProfesor()` y `actualizarContactoProfesor()` (§4.2).
- Server Action `actualizarContactoProfesor()` y su tipo de estado (§4.3).
- UI: ficha `/profesores/[id]` (que era "en construcción") y pantalla `/profesores/[id]/contacto` (§5).
- Cambios transversales: `enfocarPrimerCampoInvalido`, `ConfirmarDescarteDialog` y ajustes al alta de HU-D-01 (§5.3).
- Seed: teléfonos normalizados, validación con `ContactoSchema` y permiso `profesores:editar` (§4.0).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Ningún cambio sobre `Usuario` (§1 punto 3).
- Emisión de eventos de dominio / `AuditLog` (§1 punto 6).
- Materias, horarios, listado o detalle completo del profesor (HU-D-03/04/05).

### 3.1. Archivos creados

| Archivo | Qué hace |
|---|---|
| `prisma/migrations/20260923015526_profesor_contacto_modificado_por/migration.sql` | Agrega `profesores.modificadoPorUsuarioId` e inserta `profesores:editar` para `GERENTE` |
| `src/server/shared/contacto.ts` | `normalizarTelefono()` y `contarDigitosTelefono()`, funciones puras compartidas |
| `src/server/shared/contacto.schema.ts` | `ContactoSchema`, `telefonoContactoSchema`, `emailContactoSchema` y `MENSAJE_CONTACTO_REQUERIDO`, compartidos con Alumno |
| `src/app/(dashboard)/profesores/[id]/contacto/page.tsx` | Server Component de la pantalla de contacto: permiso, carga del profesor, `notFound()` |
| `src/app/(dashboard)/profesores/[id]/contacto/contacto-profesor-form.tsx` | Formulario cliente: validación, envío, errores por campo, éxito y cancelar con confirmación |
| `src/app/(dashboard)/profesores/[id]/ficha-contacto.tsx` | Sección "Datos de contacto" de la ficha, con el acceso al formulario |
| `src/app/(dashboard)/profesores/[id]/ficha-encabezado.tsx` | Encabezado de la ficha: "Apellido, Nombre", DNI y badge de estado |
| `src/app/(dashboard)/profesores/[id]/ficha-seccion.tsx` | `FichaSeccion` (contenedor con título y acción) y `FichaDatos` (pares etiqueta/valor, "—" si falta) |
| `src/components/shared/confirmar-descarte-dialog.tsx` | Diálogo "Cambios sin guardar" reutilizable, extraído del alta de HU-D-01 |
| `src/lib/enfocar-primer-invalido.ts` | Lleva el foco al primer campo con error, en orden de documento |

### 3.2. Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `prisma/schema.prisma` | `Profesor.modificadoPorUsuarioId String?` |
| `prisma/seed.ts` | Teléfonos de profesores normalizados, `validarDatos()` con `ContactoSchema` y upsert de `profesores:editar` (§4.0) |
| `src/server/profesores/profesor.schema.ts` | Re-exporta `ContactoSchema` como `ContactoProfesorSchema` |
| `src/server/profesores/profesor.service.ts` | Agrega `obtenerFichaProfesor()` y `actualizarContactoProfesor()` |
| `src/app/(dashboard)/profesores/actions.ts` | Agrega la Server Action `actualizarContactoProfesor()` y los mensajes `EMAIL_YA_ASOCIADO` / `PROFESOR_NO_ENCONTRADO` |
| `src/app/(dashboard)/profesores/profesor.types.ts` | Agrega `EstadoContactoProfesor` y `ESTADO_INICIAL_CONTACTO_PROFESOR` |
| `src/app/(dashboard)/profesores/[id]/page.tsx` | La ficha deja de ser "en construcción": encabezado + contacto |
| `src/app/(dashboard)/profesores/nuevo/nuevo-profesor-form.tsx` | Usa `enfocarPrimerCampoInvalido` y `ConfirmarDescarteDialog`; el éxito ofrece "Cargar datos de contacto" (§5.3) |

---

## 4. Contrato Backend

### 4.0. Migración, RBAC y seed

**Archivo:** `prisma/migrations/20260923015526_profesor_contacto_modificado_por/migration.sql`

```sql
-- AlterTable
ALTER TABLE "profesores" ADD COLUMN     "modificadoPorUsuarioId" TEXT;

-- RBAC (HU-D-02): profesores:editar, exclusivo de Gerente (spec_modulo_D.md §2.2).
INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso") VALUES
  ('perm-profesores-editar-gerente', 'GERENTE', 'profesores:editar', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
```

- `modificadoPorUsuarioId` es un escalar nullable **sin `@relation`**, igual que `creadoPorUsuarioId` (ver la nota de auditoría del encabezado de `schema.prisma`). Las filas existentes quedan en `NULL`.
- El permiso se inserta en la migración **y** en el seed. Así existe también en bases que no corran el seed; `ON CONFLICT DO NOTHING` y el `upsert` del seed hacen que ambos caminos sean idempotentes. HU-D-01 había agregado `profesores:crear` solo por seed (HU-D-01 §1 punto 5); esta HU agrega además la migración.

**Cambios en `prisma/seed.ts`:**
- **Teléfonos de profesores normalizados:** cada profesor se guarda con `ContactoSchema.parse(...)`, igual que lo guarda la app (ej. `"+54 11 5560-0001"` → `"+541155600001"`).
- **`validarDatos()` usa `ContactoSchema`:** reemplaza el chequeo anterior (`!p.telefono && !p.email`) por las mismas reglas del formulario (al menos uno, teléfono de 8-15 dígitos, email válido). El seed no puede generar contactos que la app rechazaría.
- **Upsert de `profesores:editar`** para `GERENTE`.
- **Los datos de alumnos no se tocaron** (verificado en el diff de `bd6a8f0`: los cambios del seed son solo del bloque de profesores y de `RolPermiso`).

### 4.1. Validación compartida de contacto

**`src/server/shared/contacto.ts`:**

```typescript
// "(0387) 15-412-3456" -> "0387154123456", "+54 9 387 444-5566" -> "+5493874445566".
export function normalizarTelefono(valor: string): string {
  return valor.trim().replace(/[\s\-()]/g, "");
}

/** Cantidad de dígitos de un teléfono (el `+` y los separadores no cuentan). */
export function contarDigitosTelefono(valor: string): number {
  return valor.replace(/\D/g, "").length;
}
```

**`src/server/shared/contacto.schema.ts`:**

**Teléfono** (`telefonoContactoSchema`), en este orden:
1. `trim()`.
2. Caracteres permitidos: `/^\+?[\d\s\-()]+$/` — dígitos, espacios, guiones y paréntesis; el `+` **solo como primer carácter**. Si no cumple: "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis".
3. Normalización con `normalizarTelefono()`: quita espacios, guiones y paréntesis y **conserva el `+` inicial**. Ej.: `"(0387) 15-412-3456"` → `"0387154123456"`.
4. Longitud **sobre los dígitos** (`contarDigitosTelefono`), entre 8 y 15 inclusive. Si no cumple: "El teléfono debe tener entre 8 y 15 dígitos".

El valor que sale del schema (normalizado) es el que se guarda.

**Email** (`emailContactoSchema`): `trim()` → `toLowerCase()` → `z.email("Ingresá un email válido")` → `max(254, "El email no puede superar los 254 caracteres")`.

**Objeto** (`ContactoSchema`):
- Cada campo pasa por `campoOpcional()`: `null` (campo ausente del `FormData`), `""` o solo espacios se tratan como "no provisto" (`undefined`), nunca como valor inválido.
- `superRefine`: si faltan los dos, error "Ingresá al menos un teléfono o un email de contacto" (`MENSAJE_CONTACTO_REQUERIDO`) sobre `telefono`, el primer campo del formulario.
- Se usa el mismo schema en el formulario (cliente) y en la Server Action (servidor).

**Reutilización:** pensado para HU-B-02 (Alumno). Hoy lo importan `src/server/alumnos/alumno.schema.ts` y `prisma/seed.ts`, además de `profesor.schema.ts`.

**Diferencia con la spec:** `spec_modulo_D.md` §2.2 ubica la normalización en `lib/utils/normalizar-telefono.ts`. Se siguió la convención real del repo (utilidades compartidas en `src/server/shared/`, igual que `fecha.ts` y `texto.ts` de HU-D-01).

### 4.2. Servicio

**Archivo:** `src/server/profesores/profesor.service.ts`

**A) `obtenerFichaProfesor(profesorId: string)`** → `{ id, nombre, apellido, dni, activo, telefono, email } | null`
- `findUnique` con `select` de identidad resumida y contacto. Devuelve `null` si el id no existe.
- La usan la ficha y la pantalla de contacto (para precargar el formulario). Después la reutilizaron las pantallas de HU-D-03.

**B) `actualizarContactoProfesor(profesorId: string, input: ContactoProfesorInput, usuarioModificadorId: string): Promise<{ id: string; telefono: string | null; email: string | null }>`**

`input` llega ya validado y normalizado por `ContactoProfesorSchema`. El servicio no verifica permisos: confía en la capa que lo invoca, mismo criterio que `crearProfesor()`. Todo dentro de un único `prisma.$transaction(async (tx) => …)`:
1. `tx.profesor.findUnique({ select: { idProfesor, usuarioId } })`. Si no existe: `PROFESOR_NO_ENCONTRADO`.
2. **Criterio 4**, solo si viene email: `tx.usuario.findFirst({ where: { emailUsuario: { equals: input.email, mode: "insensitive" }, ...(usuarioId ? { NOT: { idUsuario: usuarioId } } : {}) } })`. Si encuentra una cuenta: `EMAIL_YA_ASOCIADO` (§1 punto 2).
3. `tx.profesor.update` con `telefonoProfesor: input.telefono ?? null`, `emailProfesor: input.email ?? null` y `modificadoPorUsuarioId`. `updatedAtProfesor` lo actualiza Prisma. Se guardan los dos campos siempre (§1 punto 7).
4. Retorna `{ id, telefono, email }` tal como quedaron guardados.

Nunca modifica `Usuario` (§1 punto 3).

**Errores de servicio:** `PROFESOR_NO_ENCONTRADO`, `EMAIL_YA_ASOCIADO`.

### 4.3. Server Action

**Archivo:** `src/app/(dashboard)/profesores/actions.ts` (mismo archivo que las actions de HU-D-01)
**Función:** `actualizarContactoProfesor(profesorId: string, formData: FormData): Promise<EstadoContactoProfesor>`

Invocación directa desde el formulario (sin `useActionState`), con shape de estado propio (excepción de la Regla N.° 5). Todo el flujo vive en un único `try/catch`:
1. `verificarPermiso("profesores:editar")`. El rechazo por rol vale aunque la action se invoque directamente, sin pasar por la página.
2. `profesorId` vacío o no string → `{ status: "error", mensaje: "El profesor ya no existe" }`.
3. `ContactoProfesorSchema.safeParse({ telefono, email })` desde el `FormData`. Si falla → `{ status: "error_validacion", errores: flattenError(...).fieldErrors }`.
4. Servicio → `revalidatePath("/profesores")` y `revalidatePath(\`/profesores/${profesorId}\`)` → `{ status: "exito", telefono, email }`.
5. Traducción de errores (`MENSAJES_POR_CODIGO` vive en la action, no en el servicio):

| Error | Estado devuelto |
|---|---|
| `EMAIL_YA_ASOCIADO` | `error_validacion` con `{ email: ["Ese email ya está asociado a otra cuenta"] }` (§1 punto 5) |
| `PROFESOR_NO_ENCONTRADO` | `error` con "El profesor ya no existe" |
| Otro `ServiceError` | `error` con "No se pudo conectar. Intentá nuevamente" |
| `PermisoError` | `error` con su propio mensaje |
| Cualquier otro error | `error_comunicacion` |

**Tipo** en `src/app/(dashboard)/profesores/profesor.types.ts`:

```typescript
export type EstadoContactoProfesor =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; telefono: string | null; email: string | null };

export const ESTADO_INICIAL_CONTACTO_PROFESOR: EstadoContactoProfesor = { status: "idle" };
```

**Route Handler:** no se implementó. Ver §8.1.

### 4.4. Eventos de dominio

**Fuera de alcance de esta task — ver §1 punto 6.** No se emite `profesor:contacto_actualizado`; la trazabilidad es `updatedAtProfesor` + `modificadoPorUsuarioId` en la misma fila.

---

## 5. Frontend

Solo tokens de `docs/DESIGN.md` en los componentes nuevos de la ficha y del formulario, con una excepción heredada en el diálogo compartido (§9).

### 5.1. Ficha `/profesores/[id]`

**Archivo:** `src/app/(dashboard)/profesores/[id]/page.tsx` (Server Component; antes era "Detalle de profesor - en construcción")
- `verificarPermiso("profesores:editar")`; ante `PermisoError` redirige a `/profesores` (§1 punto 4).
- `obtenerFichaProfesor(id)`; si no existe → `notFound()`.
- Link "Volver al listado" (`/profesores`), `FichaEncabezado` ("Apellido, Nombre", DNI, badge "Activo" / "Inactivo" con texto) y `FichaContacto` con `puedeEditar` fijo en `true`.

**Componentes de ficha** pensados para que HU-D-03/04/05 los extiendan:
- `FichaSeccion` (`ficha-seccion.tsx`): `<section>` con `aria-labelledby`, título `h2`, acción opcional y contenido.
- `FichaDatos` (`ficha-seccion.tsx`): grilla `<dl>` etiqueta/valor; un valor `null` se muestra como "—".
- `FichaEncabezado` (`ficha-encabezado.tsx`).
- `FichaContacto` (`ficha-contacto.tsx`): Teléfono y Email con `FichaDatos`. La acción dice "Cargar contacto" si no hay ninguno o "Editar contacto" si ya hay alguno, y solo se muestra con `puedeEditar`.

### 5.2. Pantalla `/profesores/[id]/contacto`

**`contacto/page.tsx`** (Server Component):
- `verificarPermiso("profesores:editar")`; ante `PermisoError` redirige a `/profesores`.
- Profesor inexistente → `notFound()`.
- Muestra "Volver a la ficha", el título "Datos de contacto" y "Apellido, Nombre · DNI …", y monta el formulario con el contacto actual precargado.

**`contacto-profesor-form.tsx`** (Client Component), mismo patrón que `NuevoProfesorForm` de HU-D-01:
- Campos no controlados (`defaultValue`): ante un error, lo tipeado queda cargado tal cual.
- Teléfono (`type="tel"`, placeholder "Ej.: (0387) 15-412-3456") y Email (`type="email"`), con el texto guía "Completá al menos uno de los dos datos.". Foco inicial en Teléfono.
- **Envío:**
  - `safeParse` con el mismo `ContactoProfesorSchema`. Si falla, errores por campo, foco al primer inválido y **no se envía nada** (criterio 6).
  - Guard `if (pendiente) return` contra doble envío; botón "Guardar contacto" deshabilitado con `Loader2`; la action se invoca dentro de `try/catch` con fallback a `error_comunicacion`.
- **Errores del servidor:** `error_validacion` (incluido `EMAIL_YA_ASOCIADO`) se pinta en el campo con foco; `error` / `error_comunicacion` en un `<p role="alert">` general. Todos con `text-destructive`.
- **Éxito:** `role="status"` con "Datos de contacto del profesor guardados correctamente" (criterio 5, texto exacto), Teléfono y Email guardados ("—" si falta) y el link "Volver a la ficha". `setDirty(false)`.
- **Cancelar:** con cambios (`useDirtyState().dirty`, que se activa en el `onChange` del form) abre `ConfirmarDescarteDialog`; sin cambios vuelve a la ficha. Al desmontar, `setDirty(false)`.

### 5.3. Cambios transversales hechos en esta HU

- **`src/lib/enfocar-primer-invalido.ts` → `enfocarPrimerCampoInvalido(form, errores)`:** recorre `form.elements` en orden de documento y enfoca el primer `input`/`select`/`textarea` cuyo `name` tenga error. No depende de que React ya haya pintado los errores, así que se llama en el mismo handler que el `setState`. Se aplicó **también al alta de HU-D-01** (`nuevo-profesor-form.tsx`), para errores de cliente y de servidor. Hoy lo usan además los formularios de HU-B-01 (`alumno-form.tsx`), HU-B-02 (`contacto-alumno-form.tsx`) y HU-D-04 (`registrar-horario-form.tsx`).
- **`src/components/shared/confirmar-descarte-dialog.tsx` → `ConfirmarDescarteDialog`:** el `AlertDialog` de `@base-ui/react` que estaba inline en `nuevo-profesor-form.tsx` se extrajo sin cambios de texto ("Cambios sin guardar", "Hay datos sin guardar. ¿Salir de todas formas?", "Seguir editando" / "Salir sin guardar"). El formulario decide cuándo abrirlo y qué hacer al confirmar. Lo usan el alta de HU-D-01 y el contacto de HU-D-02; después lo adoptaron HU-B-02, HU-B-03, HU-D-03 y HU-D-04.
- **Componentes de ficha** (`FichaSeccion`, `FichaDatos`, `FichaEncabezado`) — §5.1.
- **Éxito del alta de HU-D-01:** "Continuar con contacto/materias/horario" se reemplazó por tres acciones: **"Cargar datos de contacto"** (primaria, a `/profesores/[id]/contacto`), "Ver ficha del profesor" y "Volver al listado".

---

## 6. Testing (tres niveles, según metodología del proyecto)

**Nota — test runner:** el repo tiene archivos `.test.ts` en sintaxis Vitest, pero **no hay runner configurado** (sin `vitest` en `package.json` ni script `test`), mismo estado que HU-D-01 §6. **HU-D-02 no agregó archivos `.test.ts`**; ninguno de los tests existentes cubre `ContactoSchema`, `normalizarTelefono()` ni `actualizarContactoProfesor()`.

### Nivel 1 — Unitarios

Verificación realizada:
- **Schema probado con `tsx`** (ejecución directa de `ContactoSchema`, sin runner). Resultados, re-ejecutados al documentar esta task:

| Entrada | Resultado |
|---|---|
| `telefono: "(0387) 15-412-3456"` | OK → `"0387154123456"` |
| `telefono: "+54 9 387 444-5566"` | OK → `"+5493874445566"` (conserva el `+`) |
| `telefono: "123-4567"` (7 dígitos) | Error: "El teléfono debe tener entre 8 y 15 dígitos" |
| `telefono: "1234-5678"` (8 dígitos) | OK → `"12345678"` |
| `telefono: "+123456789012345"` (15 dígitos) | OK |
| `telefono: "1234567890123456"` (16 dígitos) | Error: 8 a 15 dígitos |
| `telefono: "0387+154123456"` (`+` en el medio) | Error: "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis" |
| `telefono: "0387-ABC-123"` | Error: caracteres permitidos |
| `email: "  Ana.Gomez@Mail.COM  "` | OK → `"ana.gomez@mail.com"` |
| `email: "ana@"` | Error: "Ingresá un email válido" |
| email de 254 caracteres | OK |
| email de 255 caracteres | Error: "El email no puede superar los 254 caracteres" |
| `telefono: "   "`, `email: ""` | Error en `telefono`: "Ingresá al menos un teléfono o un email de contacto" |
| `telefono: null`, `email: null` (campos ausentes del `FormData`) | Mismo error |

- **Servicio probado contra la base** (según lo reportado por la responsable de la HU). No hay evidencia adjunta en el repo (salida de consultas o capturas); ver pendiente en §7.

Casos a automatizar cuando exista runner (no escritos todavía):
- `actualizarContactoProfesor`: éxito; profesor inexistente → `PROFESOR_NO_ENCONTRADO`; email de otra cuenta → `EMAIL_YA_ASOCIADO` sin `update`; email de la cuenta propia → permitido; profesor sin cuenta + email de cualquier cuenta → `EMAIL_YA_ASOCIADO`; coincidencia con distinta capitalización → `EMAIL_YA_ASOCIADO`; campo vacío → se guarda `null`; `modificadoPorUsuarioId` seteado.
- `ContactoSchema`: los casos de la tabla de arriba.

### Nivel 2 — Postman

**No aplica tal como está:** no hay Route Handler `PATCH /api/profesores/[id]/contacto` (§8.1). La única superficie es la Server Action, que se prueba desde la UI (casos manuales abajo).

### Nivel 3 — BD / TablePlus

Después de guardar un contacto desde la UI:
- `profesores."telefonoProfesor"` normalizado (sin espacios, guiones ni paréntesis; con `+` si se tipeó) y `"emailProfesor"` en minúsculas.
- `"updatedAtProfesor"` con la hora del guardado y `"modificadoPorUsuarioId"` igual al id del Gerente.
- `usuarios` sin cambios (el email de login del profesor no se modifica).
- Tras un intento rechazado (`EMAIL_YA_ASOCIADO` o error de validación), la fila del profesor sin cambios.
- `roles_permisos` contiene `('GERENTE', 'profesores:editar')`.

### Casos de prueba manuales (UI)

Usuario: **gerente@noctium.local** / **Password123!** (seed). Profesores del seed con cuenta: Giménez (`profesor1@noctium.local`), Rossi (`profesor2@…`), Vega (`profesor3@…`), Acuña (`profesor4@…`). Sin cuenta: Molina (inactivo).

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Acceso desde la ficha | Abrir `/profesores/{Giménez}` | Sección "Datos de contacto" con Teléfono, Email y "Editar contacto" |
| 2 | Profesor sin contacto | Registrar un profesor en `/profesores/nuevo` (el alta de HU-D-01 no pide contacto; el seed de `develop` no tiene profesores sin contacto) y abrir su ficha | Ambos valores "—" y la acción dice "Cargar contacto" |
| 3 | Precarga | Clic en "Editar contacto" | Formulario con el teléfono y el email actuales; foco en Teléfono |
| 4 | Ambos vacíos (c1) | Vaciar los dos campos y guardar | "Ingresá al menos un teléfono o un email de contacto" junto a Teléfono, foco en Teléfono, nada guardado |
| 5 | Normalización (c2) | Teléfono `(0387) 15-412-3456`, guardar | Éxito; se muestra `0387154123456` |
| 6 | `+` inicial (c2) | Teléfono `+54 9 387 444-5566` | Éxito; `+5493874445566` |
| 7 | Pocos dígitos (c2) | Teléfono `123-4567` | "El teléfono debe tener entre 8 y 15 dígitos" |
| 8 | Demasiados dígitos (c2) | Teléfono de 16 dígitos | Mismo error |
| 9 | Caracteres inválidos (c2) | Teléfono `0387-ABC-123` o `0387+154123456` | "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis" |
| 10 | Email normalizado (c3) | Email `  Ana.Gomez@Mail.COM  ` | Éxito; se guarda `ana.gomez@mail.com` |
| 11 | Email inválido (c3) | Email `ana@` | "Ingresá un email válido" junto a Email |
| 12 | Email largo (c3) | Email de 255 caracteres | "El email no puede superar los 254 caracteres" |
| 13 | Email de otra cuenta (c4) | En Giménez, email `profesor2@noctium.local` | "Ese email ya está asociado a otra cuenta" junto a Email; sin revelar de quién es; nada guardado |
| 14 | Email de la cuenta propia (c4) | En Giménez, email `profesor1@noctium.local` | Se guarda |
| 15 | Sin cuenta + email de una cuenta (c4) | En Molina, email `gerente@noctium.local` | "Ese email ya está asociado a otra cuenta" |
| 16 | Sin distinguir mayúsculas (c4) | En Molina, email `GERENTE@Noctium.Local` | Mismo rechazo |
| 17 | Login intacto (§1 punto 3) | Tras el caso 14, cerrar sesión y entrar como `profesor1@noctium.local` | El login sigue funcionando; `usuarios` sin cambios |
| 18 | Éxito (c5) | Datos válidos, guardar | "Datos de contacto del profesor guardados correctamente", valores guardados y "Volver a la ficha" |
| 19 | Borrar un campo (§1 punto 7) | Profesor con ambos datos: vaciar Email y guardar | Éxito; Email pasa a "—" en la ficha |
| 20 | Errores por campo (c6) | Teléfono inválido + email inválido | Cada error junto a su campo, foco en Teléfono, nada guardado |
| 21 | Doble envío | Doble clic en "Guardar contacto" | Una sola invocación; botón deshabilitado con spinner mientras guarda |
| 22 | Cancelar sin cambios | Abrir el formulario y cancelar | Vuelve a la ficha sin diálogo |
| 23 | Cancelar con cambios | Editar un campo y cancelar | Diálogo "Cambios sin guardar"; "Seguir editando" conserva lo tipeado; "Salir sin guardar" vuelve a la ficha sin guardar |
| 24 | Rol sin permiso | Con `mesa.entrada@noctium.local`, abrir `/profesores/{id}/contacto` | No accede: el proxy (`rutas-por-rol.ts`) redirige a `/sin-permiso` antes de llegar a la página, que igual verifica `profesores:editar`. La action rechaza con "No tenés permisos para acceder a esta sección" si se invoca directo |
| 25 | Profesor inexistente | `/profesores/{cuid inexistente}/contacto` | 404 |
| 26 | Alta de HU-D-01 → contacto | Registrar un profesor nuevo y usar "Cargar datos de contacto" | Abre el formulario de contacto de ese profesor, vacío |
| 27 | Foco en el alta de HU-D-01 | En `/profesores/nuevo`, enviar con DNI inválido | Foco en el campo DNI |

**Evidencia esperada:** capturas del formulario en sus estados (vacío, precargado, errores por campo, `EMAIL_YA_ASOCIADO`, cargando, éxito) y consultas SQL del Nivel 3.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar. *(No hubo task previa; este documento es posterior a la implementación.)*
- [x] `ContactoSchema` y `normalizarTelefono()` en `src/server/shared/`, sin acoplamiento a "profesor"; reutilizados por HU-B-02 (`alumno.schema.ts`).
- [x] Migración `20260923015526_profesor_contacto_modificado_por`: `modificadoPorUsuarioId` y `profesores:editar` para `GERENTE`.
- [x] Permiso `profesores:editar` también en el seed (upsert idempotente).
- [x] Service y Server Action implementados, sin lógica de negocio fuera de `profesor.service.ts` (Regla N.° 4).
- [ ] Route Handler `PATCH /api/profesores/[id]/contacto` (spec §2.2). **No implementado**, ver §8.1.
- [x] Verificación de permiso en servidor en la action y en las dos páginas (ficha y contacto).
- [x] Guardado transaccional; `updatedAtProfesor` y `modificadoPorUsuarioId` actualizados (criterio 5).
- [x] Criterio 4 verificado en servidor, sin revelar a quién pertenece la otra cuenta; `Usuario` nunca se modifica.
- [x] Errores junto al campo y sin guardado parcial (criterio 6).
- [x] Ningún `DELETE` físico en el código de la HU.
- [x] `tsc --noEmit`, `npm run lint` y `npm run build` sin errores. *(Reportado para la implementación. Re-verificado el 2026-09-23 sobre el árbol actual, que ya incluye HU-D-03/04 y los cambios sin commitear de HU-D-05: `tsc` limpio, lint con 0 errores y 1 warning ajeno a la HU —`Clock3` sin usar en `home/page.tsx`— y build OK.)*
- [x] Schema probado con `tsx` (§6, Nivel 1).
- [ ] Evidencia del servicio contra la base adjunta al repo. *(La prueba se reportó hecha, pero no hay salida registrada.)*
- [ ] Casos manuales de §6 ejecutados en navegador, con evidencia.
- [ ] Tests unitarios automatizados (pendiente del runner, §9).
- [x] PR con diff acotado a HU-D-02 (PR #40, commit `bd6a8f0`).

---

## 8. Desviaciones de la spec original

### 8.1. Sin Route Handler `PATCH /api/profesores/[id]/contacto`

- **Spec:** `spec_modulo_D.md` §2.2 declara la ruta `PATCH /app/api/profesores/[id]/contacto/route.ts` con respuesta `200 { data: { id, telefono, email }, error: null }`.
- **Implementado:** solo la Server Action `actualizarContactoProfesor()`. En `src/app/api/profesores/[id]/` existen únicamente `horarios/` y `materias/` (de HU-D-04 y HU-D-03).
- **Consecuencia:** el Nivel 2 (Postman) no es aplicable, y `EMAIL_YA_ASOCIADO` no tiene un equivalente `409` (§1 punto 5).
- **Si se agrega:** tiene que ser un wrapper delgado sobre el mismo `actualizarContactoProfesor()` del servicio, con `withPermission("profesores:editar")`, `ContactoProfesorSchema.safeParse` → `400`, y `404 PROFESOR_NO_ENCONTRADO` / `409 EMAIL_YA_ASOCIADO`.

### 8.2. Se guardan los dos campos, no "únicamente los campos provistos"

- **Spec:** §2.2 paso 3, "Actualiza únicamente los campos provistos".
- **Implementado:** el `UPDATE` escribe siempre `telefonoProfesor` y `emailProfesor`; un campo vacío pasa a `null` (§1 punto 7). Como el formulario precarga los valores actuales, el comportamiento para el usuario es "lo que ves es lo que se guarda", y permite borrar un dato que ya no corresponde.

### 8.3. Alcance de la verificación de email

- **Spec:** §2.2 paso 2 valida el email "contra `Usuario.email` de cualquier cuenta existente".
- **Implementado:** excluye la cuenta vinculada al propio profesor (§1 punto 2). Si no, un profesor con cuenta no podría usar su propio email de login como email de contacto, lo que no tiene sentido con la redacción del criterio 4 ("no puede pertenecer a **otra** cuenta").

### 8.4. Ubicación de la normalización y evento

- Normalización de teléfono en `src/server/shared/contacto.ts`, no en `lib/utils/normalizar-telefono.ts` (§4.1).
- No se emite `profesor:contacto_actualizado` (§1 punto 6); la spec D ya lo anota como referencia histórica en su §4 (nota de sincronización de HU-D-03).

---

## 9. Deuda técnica y pendientes

- **Chequeo de permiso de la ficha `/profesores/[id]`:** cuando HU-D-05 cree `profesores:leer`, la ficha tiene que exigir ese permiso y derivar `puedeEditar` de un segundo chequeo de `profesores:editar` (anotado en el propio `page.tsx`). *Estado al 2026-09-23: resuelto en los cambios de HU-D-05, que están en el árbol de trabajo **sin commitear**; hasta que se mergeen, en `develop` la ficha sigue exigiendo `profesores:editar`.*
- **Test runner:** existen archivos `.test.ts` (Vitest) en el repo, pero no hay runner configurado ni script `test`. Decisión de equipo pendiente (misma nota que HU-D-01 §6). Al configurarlo, agregar los casos de §6 Nivel 1.
- **Route Handler faltante** (§8.1): agregarlo si alguna integración lo necesita, o actualizar la spec §2.2 con una nota de sincronización que lo dé de baja. Hoy la spec D no tiene nota de sincronización para HU-D-02.
- **Color hardcodeado en el diálogo compartido:** `ConfirmarDescarteDialog` usa `bg-black/50` para el fondo del overlay, un color default de Tailwind que `DESIGN.md` prohíbe. Viene del formulario de HU-D-01, de donde se extrajo sin cambios. Agregarlo a la tabla de "Deuda de diseño pendiente" de `DESIGN.md` o definir un token de overlay.
- **Tipos y actions fuera de la Regla N.° 11:** `EstadoContactoProfesor` y la action siguen en `src/app/(dashboard)/profesores/` (`profesor.types.ts`, `actions.ts`), igual que los de HU-D-01. Es la misma deuda anotada en HU-D-03 §1 punto 1; se resuelve en un refactor propio.
- **Evidencia pendiente:** salida de la prueba del servicio contra la base y ejecución de los casos manuales de §6.
