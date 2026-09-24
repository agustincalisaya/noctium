# TASK: HU-D-01 / HU-D-02 (ajuste) — Alta de profesor con datos de contacto y acciones para continuar

**Módulo:** D (Profesor)
**Sprint:** 1
**Tipo:** ajuste sobre HU ya implementadas (HU-D-01, commit `01518fd`; HU-D-02, PR #40) que además toca el enlace con HU-D-03 y HU-D-04.
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` §2.1 y §2.2 (se agrega nota de sincronización, §4.7) · §2.3 y §2.4 (solo como destino de navegación) · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-D-01 criterios 1-6 y HU-D-02 criterios 1-6 · tasks `HU-D-01.md`, `HU-D-02.md`, `HU-D-04.md`
**RBAC:** sin cambios. El alta sigue exigiendo `profesores:crear` (exclusivo de `GERENTE`). El contacto cargado en el alta **no** exige además `profesores:editar`: es parte del alta, no una edición de una ficha existente (§1 punto 6). Los destinos de las acciones posteriores (contacto, materias, horario) siguen exigiendo `profesores:editar`, que también es exclusivo de `GERENTE`.
**Schema:** sin migración. `model Profesor` ya tiene `telefonoProfesor String?`, `emailProfesor String?`, `creadoPorUsuarioId`, `createdAtProfesor` y `modificadoPorUsuarioId` (HU-D-02). **Verificado al implementar:** `prisma/schema.prisma` y `prisma/seed.ts` no se tocaron.
**Implementación:** hecha sobre `develop` (`dce8315`), **sin commitear** (git queda a cargo del responsable). Typecheck, lint, tests (270/270) y build en verde (§6).

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

**Nota — implementación sin frenar en el relevamiento:** por pedido explícito del responsable, se implementó de corrido. Los tres puntos "relevar antes de asumir" se resolvieron así:
- **Ubicación de los tests (§3.1):** archivos nuevos, uno por capa (schema + servicio, Server Action, formulario, página de horario), en vez de sumar casos a `profesor.schema.test.ts` / `profesor.service.test.ts`. Cada capa necesita mocks distintos (el servicio mockea `prisma`; la action mockea el servicio).
- **`clavesOrdenProfesor(input)` (§4.2):** recibe `{ nombre: string; apellido: string }` (`src/lib/profesor-listado.ts`), así que acepta `AltaProfesorInput` sin cambios.
- **`?profesorId=` en horario (§1 punto 8):** sin cambios en `develop`. Se verificó con tests y no se tocó.

**Nota — estado del código relevado para escribir esta task** (`develop`, `dce8315`, árbol limpio):
- **Alta (HU-D-01):** `src/app/(dashboard)/profesores/nuevo/page.tsx` (Server Component) + `nuevo-profesor-form.tsx` (Client Component). Server Action `crearProfesor(_estadoAnterior, formData)` en `src/app/(dashboard)/profesores/actions.ts`; Route Handler `POST` en `src/app/api/profesores/route.ts`; servicio `crearProfesor()` en `src/server/profesores/profesor.service.ts` (hoy **sin** `$transaction`: `findFirst` de DNI + `create` único, con catch de `P2002` sobre `dniProfesor`). Schema `construirIdentidadProfesorSchema(min, max)` en `profesor.schema.ts`. Estado `EstadoNuevoProfesor` en `src/app/(dashboard)/profesores/profesor.types.ts`.
- **Éxito del alta hoy:** no hay redirect ni toast. El formulario se reemplaza, en la misma página, por un bloque `role="status"` con "Profesor registrado correctamente" y cuatro links: **"Cargar datos de contacto"** (primario, `variant: "default"`), "Registrar horario de atención", "Ver ficha del profesor" y "Volver al listado" (los tres `outline`). **No** ofrece "Asociar materias", aunque D-01 criterio 4 lo pide.
- **Contacto (HU-D-02):** `ContactoSchema`, `telefonoContactoSchema`, `emailContactoSchema` y `campoOpcional()` (exportado desde HU-B-06) en `src/server/shared/contacto.schema.ts`; `normalizarTelefono()` / `contarDigitosTelefono()` en `src/server/shared/contacto.ts`. Servicio `actualizarContactoProfesor()` con la verificación de email contra `Usuario` **inline** dentro de su `$transaction`. Pantalla `/profesores/[id]/contacto`.
- **Horario (HU-D-04):** `src/app/(dashboard)/profesores/horarios/nuevo/page.tsx` **ya acepta `?profesorId=`**: lo busca dentro de `listarProfesoresActivos()` en el servidor; si no es un `string` o no corresponde a un profesor activo, el selector queda vacío (`profesorIdInicial = ""`). `registrar-horario-form.tsx` lo recibe como `profesorIdInicial`. **No hace falta agregar soporte** (§1 punto 8).
- **Materias (HU-D-03):** `/profesores/[id]/materias` existe (`materias/page.tsx`, exige `profesores:editar`).
- **Tests:** a diferencia de lo que dicen las tasks de HU-D-01/02/04, **Vitest ya está instalado** (`package.json`: `"test": "vitest run"`, `vitest ^3.2.7`, `vitest.config.mjs` con alias `@` → `src`). Los tests de esta task se escriben **y se ejecutan**.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

1. **DECISIÓN RESUELTA — contacto en el mismo formulario del alta, opcional.**
   - "Nuevo profesor" agrega una sección **"Datos de contacto"** (Teléfono y Email) debajo de la identidad (debajo de Género).
   - La sección es opcional: si ambos campos quedan vacíos (o con solo espacios), el profesor se crea solo con identidad, exactamente como hoy (`telefonoProfesor` y `emailProfesor` en `NULL`).
   - **No** se aplica la regla "al menos uno" de HU-D-02 criterio 1 (`MENSAJE_CONTACTO_REQUERIDO`) en el alta: esa regla es de la pantalla de contacto, donde el objetivo es justamente cargar contacto. En el alta, vacío = "no cargó contacto todavía".
   - Si se completa cualquiera de los dos campos, se aplican **todas** las reglas de HU-D-02 criterios 2-4 sobre el campo completado.

2. **DECISIÓN RESUELTA — reutilización de schemas, sin duplicar reglas.**
   - El schema del alta se arma extendiendo `construirIdentidadProfesorSchema(min, max)` con `telefono: campoOpcional(telefonoContactoSchema)` y `email: campoOpcional(emailContactoSchema)`, importados de `src/server/shared/contacto.schema.ts`.
   - **No** se usa `ContactoSchema` tal cual (su `superRefine` exige al menos uno) ni `ContactoSchema.partial()` (en Zod v4 lanza en runtime sobre un objeto con refinements — mismo motivo documentado en `contacto.schema.ts` para HU-B-06).
   - Ninguna regex, límite de dígitos, `toLowerCase()` ni `max(254)` se reescribe: salen de los schemas compartidos. Mismo schema en cliente (formulario) y servidor (Server Action y Route Handler).

3. **DECISIÓN RESUELTA — unicidad del email extraída a un helper del servicio.**
   - La verificación de HU-D-02 criterio 4 hoy vive inline en `actualizarContactoProfesor()`. Se extrae a una función privada de `profesor.service.ts`, `verificarEmailNoAsociadoAOtraCuenta(tx, email, usuarioIdPropio)`, que conserva exactamente la misma consulta (`tx.usuario.findFirst` con `mode: "insensitive"` y exclusión de la cuenta propia si existe) y lanza el mismo `EMAIL_YA_ASOCIADO`.
   - La usan `actualizarContactoProfesor()` (sin cambio de comportamiento) y el alta. En el alta el profesor nunca tiene cuenta (HU-D-01 criterio 5, `usuarioId: null`), así que se llama con `usuarioIdPropio = null`: cualquier cuenta con ese email bloquea.
   - El mensaje sigue siendo "Ese email ya está asociado a otra cuenta" (vive en `MENSAJES_POR_CODIGO` de la action) y nunca revela a quién pertenece.

4. **DECISIÓN RESUELTA — una sola transacción para identidad y contacto.**
   - `crearProfesor()` pasa a correr dentro de un único `prisma.$transaction(async (tx) => …)`: verificación de DNI → (si viene email) verificación de email → `tx.profesor.create` con identidad **y** contacto en el mismo `INSERT`.
   - Si falla cualquier validación (Zod en la capa delgada, `DNI_DUPLICADO` o `EMAIL_YA_ASOCIADO` en el servicio), no se crea nada.
   - El catch de `P2002` sobre `dniProfesor` se mantiene, envolviendo la transacción completa (mismo patrón que `asociarMateriasAProfesor()`).
   - Garantía de concurrencia sobre el email: la misma que HU-D-02 (lectura dentro de la transacción, sin bloqueo sobre `usuarios`). No se endurece en esta task.

5. **DECISIÓN RESUELTA — auditoría del alta sin cambios.** Se siguen registrando `createdAtProfesor` (por defecto) y `creadoPorUsuarioId` (usuario de la sesión). `modificadoPorUsuarioId` queda en `NULL`: cargar contacto en el alta **no** es una modificación de la ficha. No se emiten eventos (mismo criterio que HU-D-01 §1 punto 4 y HU-D-02 §1 punto 6).

6. **DECISIÓN RESUELTA — permiso.** El alta con contacto se autoriza solo con `profesores:crear`. No se agrega un segundo chequeo de `profesores:editar`: ambos son exclusivos de `GERENTE` y el contacto forma parte del alta, no de una edición posterior.

7. **DECISIÓN RESUELTA — se mantiene el patrón actual de éxito, con acciones reordenadas.**
   - Sigue siendo el bloque `role="status"` en la misma página (sin redirect ni toast), con el mensaje exacto **"Profesor registrado correctamente"**.
   - Acciones, en este orden, para el profesor recién creado (un único botón `primary` por vista, `docs/DESIGN.md`):
     1. **"Registrar horario de atención"** — primaria (`variant: "default"`) → `/profesores/horarios/nuevo?profesorId=<id>`.
     2. **"Asociar materias"** — `outline` → `/profesores/<id>/materias`. **Nueva** (hoy falta).
     3. **"Cargar datos de contacto"** — `outline` → `/profesores/<id>/contacto`. **Solo si no se cargó ningún dato de contacto en el alta.** Deja de ser la primaria.
     4. **"Ver ficha del profesor"** — `outline` → `/profesores/<id>` (se conserva el texto actual).
     5. **"Volver al listado"** — `outline` → `/profesores`.
   - Para decidir el punto 3, `EstadoNuevoProfesor` en éxito informa si se cargó contacto (`conContacto: boolean`, calculado en la action a partir de lo que devolvió el servicio).

8. **DECISIÓN RESUELTA — `?profesorId=` en el formulario de horario: ya soportado, no se modifica.**
   - `horarios/nuevo/page.tsx` ya resuelve el id en el servidor contra `listarProfesoresActivos()`: id válido y activo → preseleccionado con su resumen semanal; id inexistente, inactivo, con formato inválido o repetido en la URL (`string[]`) → selector vacío, como hoy.
   - Esta task **solo verifica** ese comportamiento (casos de prueba §6) y no toca `page.tsx` ni `registrar-horario-form.tsx`. Si el relevamiento de §0 encontrara que cambió en `develop` antes de implementar, **relevar antes de asumir**: se agrega el soporte con esa misma regla (validación en servidor contra profesores activos, nunca confiando en el cliente).

9. **DECISIÓN RESUELTA — Route Handler con la misma capacidad que la Server Action.** `POST /api/profesores` acepta también `telefono` y `email` opcionales (mismo schema del punto 2) y traduce `EMAIL_YA_ASOCIADO` a `409`. Las dos superficies siguen siendo wrappers delgados del mismo servicio (Regla N.° 4); un body sin contacto se comporta exactamente como hoy.

10. **DECISIÓN RESUELTA — pantalla de contacto de HU-D-02 sin cambios.** `/profesores/[id]/contacto`, `contacto-profesor-form.tsx`, `ficha-contacto.tsx` y la Server Action `actualizarContactoProfesor()` mantienen su comportamiento (incluida la regla "al menos uno"). El único cambio del lado de HU-D-02 es interno: la extracción del helper del punto 3.

**Fuera de alcance de esta task (explícito):**
- Crear, vincular o modificar la cuenta (`Usuario`) del profesor. El email de contacto sigue siendo independiente del de login (HU-D-02 §1 punto 3).
- Dirección del profesor (`direccionProfesor`).
- Cargar materias u horario dentro del alta: solo se ofrecen como acciones posteriores.
- Cambios en `horarios/nuevo/page.tsx` y `registrar-horario-form.tsx` (punto 8), en la pantalla de contacto (punto 10) y en la ficha.
- Verificación de email al salir del campo (`onBlur`) en el alta: la unicidad del email se verifica al confirmar, igual que en HU-D-02.
- Eventos de dominio / `AuditLog`.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** registrar la identidad y, si los tengo, los datos de contacto de un profesor en un solo paso, y seguir con su horario, materias y contacto desde la confirmación del alta
**Para** dejar la ficha lista para asignarle turnos sin tener que buscarla de nuevo

**SP estimado:** 1

**Justificación de secuencia (`HU-Sprint-1.md`):** ajuste sobre HU-D-01 y HU-D-02, ya implementadas. Usa como destinos HU-D-03 y HU-D-04, ya implementadas. No bloquea ninguna otra HU.

### 2.1. Criterios de aceptación y cómo se cumple cada uno

| # | Criterio (esta task) | Cómo se cumple | Archivos |
|---|---|---|---|
| 1 | "Nuevo profesor" tiene una sección "Datos de contacto" con Teléfono y Email, debajo de la identidad. Es opcional: si ambos quedan vacíos, el profesor se crea solo con identidad. | Dos `Input` nuevos (`telefono`, `email`) bajo un subtítulo "Datos de contacto", con el texto guía "Opcional. Podés cargarlos ahora o más tarde desde la ficha.". `campoOpcional()` trata vacío/espacios/ausente como "no provisto"; el servicio guarda `null`. | `nuevo-profesor-form.tsx`, `profesor.schema.ts`, `profesor.service.ts` |
| 2 | Si se completa algún dato de contacto, se aplican las validaciones de HU-D-02: teléfono (caracteres, normalización con `+` inicial, 8-15 dígitos), email (trim, minúsculas, formato, 254) y unicidad del email frente a cuentas internas sin revelar a quién pertenece. | `telefonoContactoSchema` y `emailContactoSchema` reutilizados (§1 punto 2); unicidad con `verificarEmailNoAsociadoAOtraCuenta()` dentro de la transacción (§1 punto 3). | `profesor.schema.ts`, `profesor.service.ts`, `actions.ts`, `api/profesores/route.ts` |
| 3 | Identidad y contacto se guardan en una sola transacción: si falla cualquier validación, no se crea nada. | `crearProfesor()` en un único `$transaction`, con identidad y contacto en el mismo `INSERT` (§1 punto 4). La validación Zod falla antes de llamar al servicio. | `profesor.service.ts` |
| 4 | Validación en la interfaz y repetida en el servidor, con los schemas existentes. Errores junto al campo, datos válidos cargados, foco al primer inválido. | Mismo `construirAltaProfesorSchema()` en el formulario y en las dos superficies del servidor. Campos no controlados (lo tipeado queda cargado). `enfocarPrimerCampoInvalido()` recorre en orden de documento, así que un error de identidad tiene prioridad sobre uno de contacto. `EMAIL_YA_ASOCIADO` se pinta en el campo email. | `nuevo-profesor-form.tsx`, `actions.ts` |
| 5 | Se registran fecha y usuario del alta, como hoy. | `createdAtProfesor` y `creadoPorUsuarioId` sin cambios (§1 punto 5). | `profesor.service.ts` |
| 6 | Éxito: "Profesor registrado correctamente" + "Registrar horario de atención" (primaria, con el profesor preseleccionado), "Asociar materias", "Cargar datos de contacto" (solo si no se cargó contacto), "Ver ficha del profesor" y "Volver al listado". | Bloque de éxito existente con las acciones de §1 punto 7; `conContacto` en `EstadoNuevoProfesor`. La preselección la resuelve la página de horario ya existente (§1 punto 8). | `nuevo-profesor-form.tsx`, `profesor.types.ts`, `actions.ts` |
| 7 | La pantalla de contacto desde la ficha (HU-D-02) sigue igual. | Sin cambios de comportamiento (§1 punto 10). | — |

HU-D-01 criterios 1-3, 5 y 6 y HU-D-02 criterios 2-6 se siguen cumpliendo como están documentados en sus tasks.

---

## 3. Alcance de esta task

Frontend + backend sobre el alta existente. Incluye:
- Schema del alta con contacto opcional (`construirAltaProfesorSchema()`), reutilizando los schemas compartidos (§4.1).
- Servicio `crearProfesor()` transaccional con contacto, y helper `verificarEmailNoAsociadoAOtraCuenta()` compartido con `actualizarContactoProfesor()` (§4.2).
- Server Action `crearProfesor()` y Route Handler `POST /api/profesores` con contacto opcional y `EMAIL_YA_ASOCIADO` (§4.3, §4.4).
- `EstadoNuevoProfesor` con `conContacto` en éxito (§4.3).
- UI: sección "Datos de contacto" en "Nuevo profesor" y acciones posteriores reordenadas, con "Asociar materias" nueva (§5).
- Tests Vitest del schema y del servicio (§6).
- Nota de sincronización en `spec_modulo_D.md` (§4.7).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): ver §1, "Fuera de alcance".

### 3.1. Archivos creados

| Archivo | Qué hace |
|---|---|
| `src/server/profesores/profesor-alta.test.ts` | 24 tests: `construirAltaProfesorSchema()`, `crearProfesor()` y la verificación de email compartida con `actualizarContactoProfesor()`, con `prisma` mockeado (§6) |
| `src/app/(dashboard)/profesores/actions.test.ts` | 5 tests de la Server Action `crearProfesor()` con el servicio y el permiso mockeados: `conContacto`, validación de teléfono, `EMAIL_YA_ASOCIADO` y `DNI_DUPLICADO` como errores de campo |
| `src/app/(dashboard)/profesores/nuevo/nuevo-profesor-form.test.tsx` | 7 tests del formulario (jsdom, mismo patrón que `participantes-turno.test.tsx`): sección de contacto, errores junto al campo, foco, datos conservados y acciones de éxito |
| `src/app/(dashboard)/profesores/horarios/nuevo/page.test.tsx` | 6 tests de la preselección por `?profesorId=` (activo, formato inválido, inexistente, inactivo, repetido, ausente) |

### 3.2. Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `src/server/profesores/profesor.schema.ts` | Agrega `construirAltaProfesorSchema(min, max)` y `AltaProfesorInput`. `construirIdentidadProfesorSchema()` queda igual (la sigue usando `verificarDniDisponible()` con `.shape.dni`). |
| `src/server/profesores/profesor.service.ts` | `crearProfesor()` recibe `AltaProfesorInput`, corre en `$transaction`, verifica email y guarda contacto; devuelve además `telefono` y `email`. Extrae `verificarEmailNoAsociadoAOtraCuenta()` y la usa también en `actualizarContactoProfesor()`. |
| `src/app/(dashboard)/profesores/actions.ts` | `crearProfesor()`: lee `telefono`/`email` del `FormData`, usa `construirAltaProfesorSchema()`, traduce `EMAIL_YA_ASOCIADO` a error del campo `email` y devuelve `conContacto` en éxito. |
| `src/app/(dashboard)/profesores/profesor.types.ts` | `EstadoNuevoProfesor` en éxito suma `conContacto: boolean`. |
| `src/app/api/profesores/route.ts` | `POST` usa `construirAltaProfesorSchema()` y agrega `409 EMAIL_YA_ASOCIADO`. `GET` sin cambios. |
| `src/app/(dashboard)/profesores/nuevo/nuevo-profesor-form.tsx` | Sección "Datos de contacto", validación y errores de `telefono`/`email`, y bloque de éxito con las acciones de §1 punto 7. |
| `docs/specs/spec_modulo_D.md` | Changelog + nota de sincronización en §2.1 y referencia en §2.2 (§4.7). |

**Sin cambios (verificado: no aparecen en `git status`):** `nuevo/page.tsx`, `horarios/nuevo/page.tsx`, `registrar-horario-form.tsx`, `[id]/contacto/*`, `[id]/ficha-contacto.tsx`, `[id]/materias/*`, `src/server/shared/contacto.schema.ts`, `src/server/shared/contacto.ts`, `prisma/schema.prisma`, `prisma/seed.ts`.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/profesores/profesor.schema.ts`

```typescript
import {
  campoOpcional,
  ContactoSchema,
  emailContactoSchema,
  telefonoContactoSchema,
  type ContactoInput,
} from "@/server/shared/contacto.schema";

/**
 * Alta de profesor con contacto opcional (ajuste HU-D-01/HU-D-02). Identidad
 * con las reglas de HU-D-01 y contacto con las de HU-D-02, sin la regla
 * "al menos uno": en el alta, los dos vacíos significan "sin contacto".
 */
export function construirAltaProfesorSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadProfesorSchema(dniLongitudMin, dniLongitudMax).extend({
    telefono: campoOpcional(telefonoContactoSchema),
    email: campoOpcional(emailContactoSchema),
  });
}
export type AltaProfesorInput = z.infer<ReturnType<typeof construirAltaProfesorSchema>>;
```

- `construirIdentidadProfesorSchema()` es un `z.object` sin refinements a nivel objeto, así que `.extend()` es válido en Zod v4.
- Resultado: `telefono` normalizado (ej. `"(0387) 15-412-3456"` → `"0387154123456"`) o `undefined`; `email` en minúsculas sin espacios o `undefined`.
- Mensajes de error: los mismos de HU-D-02 ("El teléfono solo admite dígitos, +, espacios, guiones y paréntesis", "El teléfono debe tener entre 8 y 15 dígitos", "Ingresá un email válido", "El email no puede superar los 254 caracteres").

### 4.2. Servicio

**Archivo:** `src/server/profesores/profesor.service.ts`

**A) Helper privado `verificarEmailNoAsociadoAOtraCuenta(tx: Prisma.TransactionClient, email: string, usuarioIdPropio: string | null): Promise<void>`**
- Mueve, sin cambios, la consulta de `actualizarContactoProfesor()`: `tx.usuario.findFirst({ where: { emailUsuario: { equals: email, mode: "insensitive" }, ...(usuarioIdPropio ? { NOT: { idUsuario: usuarioIdPropio } } : {}) }, select: { idUsuario: true } })`.
- Si encuentra una cuenta: `throw new ServiceError("EMAIL_YA_ASOCIADO", "El email pertenece a otra cuenta")`.
- `actualizarContactoProfesor()` lo llama con `profesor.usuarioId`, solo si viene email (igual que hoy).

**B) `crearProfesor(input: AltaProfesorInput, usuarioRegistranteId: string): Promise<{ id: string; nombre: string; apellido: string; dni: string; activo: boolean; telefono: string | null; email: string | null }>`**

Todo dentro de un único `prisma.$transaction(async (tx) => …)`, en este orden:
1. `tx.profesor.findFirst({ where: { dniProfesor: input.dni } })` contra activos **e** inactivos. Si existe: `DNI_DUPLICADO`.
2. Si `input.email` viene: `verificarEmailNoAsociadoAOtraCuenta(tx, input.email, null)`. Si hay cuenta: `EMAIL_YA_ASOCIADO`.
3. `tx.profesor.create` con los mismos datos de hoy (identidad, `clavesOrdenProfesor(input)`, `activoProfesor: true`, `usuarioId: null`, `creadoPorUsuarioId`) **más** `telefonoProfesor: input.telefono ?? null` y `emailProfesor: input.email ?? null`. `modificadoPorUsuarioId` no se setea (§1 punto 5).
4. Retorna el profesor creado, con `telefono` y `email` tal como quedaron guardados.

El `try/catch` de `P2002` sobre `dniProfesor` envuelve la transacción completa y se sigue traduciendo a `DNI_DUPLICADO`; cualquier otro error se propaga.

**Errores de servicio:** `DNI_DUPLICADO`, `EMAIL_YA_ASOCIADO`.

**`clavesOrdenProfesor(input)`:** recibe `{ nombre, apellido }`, así que acepta `AltaProfesorInput` sin cambios (resuelto en §0).

### 4.3. Server Action

**Archivo:** `src/app/(dashboard)/profesores/actions.ts`
**Función:** `crearProfesor(_estadoAnterior: EstadoNuevoProfesor, formData: FormData): Promise<EstadoNuevoProfesor>` (misma firma)

1. `verificarPermiso("profesores:crear")` (sin cambios).
2. `construirAltaProfesorSchema(min, max).safeParse({ nombre, apellido, dni, fechaNacimiento, genero, telefono: formData.get("telefono"), email: formData.get("email") })`. Si falla → `error_validacion` con `flattenError(...).fieldErrors` (incluye `telefono` / `email`).
3. Servicio → `revalidatePath("/profesores")` → `{ status: "exito", profesorId, nombre, apellido, conContacto: profesor.telefono !== null || profesor.email !== null }`.
4. Traducción de errores:

| Error | Estado devuelto |
|---|---|
| `DNI_DUPLICADO` | `error_validacion` con `{ dni: ["Ya existe un profesor registrado con ese DNI"] }` (sin cambios) |
| `EMAIL_YA_ASOCIADO` | `error_validacion` con `{ email: ["Ese email ya está asociado a otra cuenta"] }` (mismo texto y ubicación que HU-D-02) |
| Otro `ServiceError` | `error` con "No se pudo conectar. Intentá nuevamente" |
| `PermisoError` | `error` con su propio mensaje |
| Cualquier otro error | `error_comunicacion` |

**Tipo** en `src/app/(dashboard)/profesores/profesor.types.ts`:

```typescript
export type EstadoNuevoProfesor =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; profesorId: string; nombre: string; apellido: string; conContacto: boolean };
```

`verificarDniDisponible()` no cambia.

### 4.4. Route Handler

**Archivo:** `src/app/api/profesores/route.ts` — `POST` (el `GET` no cambia)
**Permiso:** `withPermission("profesores:crear")` (sin cambios)
**Body:** el de hoy, más `telefono` y `email` opcionales: `{ "nombre", "apellido", "dni", "fechaNacimiento", "genero"?, "telefono"?, "email"? }`.

| Resultado | Status | Cuerpo |
|---|---|---|
| Éxito | `201` | `{ data: { id, nombre, apellido, dni, activo, telefono, email }, error: null }` (`telefono`/`email` en `null` si no se cargaron) |
| Body no JSON | `400` | `BODY_INVALIDO` (sin cambios) |
| Falla del schema (identidad o contacto) | `400` | `{ code: "VALIDACION", message: "Datos inválidos", campos }` |
| DNI duplicado | `409` | `DNI_DUPLICADO` (sin cambios) |
| Email de otra cuenta | `409` | `{ code: "EMAIL_YA_ASOCIADO", message: "Ese email ya está asociado a otra cuenta" }` |
| Error inesperado | `500` | `ERROR_INTERNO`, sin detalle técnico |
| Sin sesión / sin permiso | `401` / `403` | Lo resuelve `withPermission` |

### 4.5. Horario con profesor preseleccionado (HU-D-04)

Sin cambios de código (§1 punto 8). Contrato que esta task usa y verifica:
- URL: `/profesores/horarios/nuevo?profesorId=<id>`.
- El servidor busca `<id>` en `listarProfesoresActivos()`. Si está: `profesorIdInicial = <id>`, resumen "Horario de Apellido, Nombre" y "Volver a la ficha". Si no está (inexistente, inactivo, no cuid, o el parámetro repetido): `profesorIdInicial = ""`, sin resumen y "Volver al listado".
- La Server Action `registrarHorarioProfesor()` sigue revalidando el profesor en el servicio (`PROFESOR_INACTIVO` / `PROFESOR_NO_ENCONTRADO`), así que la preselección nunca es la única barrera.

### 4.6. Eventos de dominio

Fuera de alcance, mismo criterio que HU-D-01 §4.5 y HU-D-02 §4.4. No se emiten `profesor:creado` ni `profesor:contacto_actualizado`.

### 4.7. Revisión de la spec (SDD, aditiva, sin renumerar)

`docs/specs/spec_modulo_D.md`:
- **Changelog:** fila "HU-D-01 / HU-D-02 (ajuste)" — Estado previo: "§2.1 alta solo con identidad; §2.2 contacto como paso separado desde la ficha". Acción: "Anotada §2.1 (nota de sincronización) y §2.2 (referencia). Sin renumerar."
- **§2.1, nota de sincronización (ajuste HU-D-01/HU-D-02):**
  - el alta acepta `telefono` y `email` opcionales, validados con las reglas de §2.2 salvo "al menos uno";
  - identidad, verificación de email y contacto en una única `$transaction`; `409 EMAIL_YA_ASOCIADO` también en `POST /api/profesores`;
  - respuesta `201` con `telefono` y `email`;
  - acciones posteriores al alta: horario (primaria, con `?profesorId=`), materias, contacto (solo si no se cargó) y ficha/listado;
  - rutas y nombres reales (`construirAltaProfesorSchema()`, `src/server/profesores/`, camelCase), como en las notas de HU-D-03/04/05.
- **§2.2:** una línea indicando que el contacto también puede cargarse en el alta (§2.1) y que esta sección sigue siendo la forma de cargarlo o modificarlo después.

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md`. Errores con `text-destructive`, un único botón `primary` por vista.

**Página** `nuevo/page.tsx`: sin cambios (permiso `profesores:crear`, longitud de DNI y `fechaMaximaNacimiento` como props).

**Formulario** `nuevo-profesor-form.tsx` (Client Component, mismo patrón actual):
- **Sección "Datos de contacto"**, después de Género y antes del error general y los botones:
  - `<fieldset>` con `<legend className="text-lg font-semibold">` "Datos de contacto" (agrupa los dos campos también para lectores de pantalla) y texto guía `text-sm text-muted-foreground`: "Opcional. Podés cargarlos ahora o más tarde desde la ficha.".
  - **Teléfono:** `Input` `id/name="telefono"`, `type="tel"`, `autoComplete="off"`, placeholder "Ej.: (0387) 15-412-3456" (mismo que HU-D-02), **sin** asterisco.
  - **Email:** `Input` `id/name="email"`, `type="email"`, `autoComplete="off"`, **sin** asterisco.
  - Cada uno con `aria-invalid` y `<p role="alert">` propio, igual que el resto de los campos.
- **`leerValores()`** suma `telefono` y `email` del `FormData`; el `safeParse` de cliente usa `construirAltaProfesorSchema()` (mismo `useMemo` con `dniLongitudMin/Max`) y `erroresCliente` suma `telefono` y `email`.
- **Errores del servidor:** `errorTelefono` / `errorEmail` se calculan igual que los demás (`erroresCliente` primero, después `estado.errores`). `EMAIL_YA_ASOCIADO` llega como `error_validacion` en `email`.
- **Foco:** `enfocarPrimerCampoInvalido(form, errores)` sin cambios, para errores de cliente y de servidor. Como recorre en orden de documento, un error de identidad se enfoca antes que uno de contacto.
- **Datos cargados:** los campos siguen no controlados, así que ante un error lo tipeado queda tal cual.
- **Dirty / Cancelar:** sin cambios; el `onChange` del `<form>` ya cubre los campos nuevos.
- **Éxito** (`role="status"`, sin redirect ni toast): "Profesor registrado correctamente" y las acciones de §1 punto 7, en ese orden:

```tsx
<Link href={`/profesores/horarios/nuevo?profesorId=${estado.profesorId}`} className={buttonVariants({ variant: "default" })}>
  Registrar horario de atención
</Link>
<Link href={`/profesores/${estado.profesorId}/materias`} className={buttonVariants({ variant: "outline" })}>
  Asociar materias
</Link>
{!estado.conContacto && (
  <Link href={`/profesores/${estado.profesorId}/contacto`} className={buttonVariants({ variant: "outline" })}>
    Cargar datos de contacto
  </Link>
)}
<Link href={`/profesores/${estado.profesorId}`} className={buttonVariants({ variant: "outline" })}>
  Ver ficha del profesor
</Link>
<Link href="/profesores" className={buttonVariants({ variant: "outline" })}>
  Volver al listado
</Link>
```

---

## 6. Testing (tres niveles, según metodología del proyecto)

**Runner:** Vitest ya está instalado (`npm test` → `vitest run`, alias `@` → `src`, `vitest.config.mjs`). Se usó el runner del repo en lugar del `npx -y vitest@3 run` con config temporal de HU-D-05 / HU-J-01: ese mecanismo existía solo porque no había runner. Mismo criterio que ellas: se corrieron **todos** los tests del repo, no solo los de esta task.

### Resultado de la verificación

| Comando | Resultado |
|---|---|
| `npx vitest run` antes de tocar código (línea base) | ✅ 21 archivos, 228 tests |
| `npx vitest run` al terminar | ✅ **25 archivos, 270 tests** (228 previos + 42 nuevos). Pasan sin cambios los de HU-D-01 (`fecha.test.ts`, `texto.test.ts`), HU-D-03 (`profesor.service.test.ts`, `profesor.schema.test.ts`), HU-D-04 (`horario-atencion.test.ts`) y HU-D-05 (`profesor-listado*.test.ts`). HU-D-02 no tenía tests automatizados; ahora `profesor-alta.test.ts` cubre `actualizarContactoProfesor()` |
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` (`eslint .`) | ✅ 0 errores, 0 warnings |
| `npm run build` | ✅ compila; aparecen `/profesores/nuevo`, `/profesores/horarios/nuevo`, `/profesores/[id]/contacto` y `/profesores/[id]/materias` |

Los avisos "The current testing environment is not configured to support act(...)" de la corrida salen de tests preexistentes de Turnos (`participantes-turno.test.tsx`, `turnos-listado.test.tsx`), no de los de esta task.

### Nivel 1 — Unitarios

**Tests agregados (42):**
- `src/server/profesores/profesor-alta.test.ts` (24): schema y servicio, casos de abajo.
- `src/app/(dashboard)/profesores/actions.test.ts` (5): sin contacto → `conContacto: false`; con teléfono → normalizado y `conContacto: true`; teléfono inválido → `error_validacion` sin llamar al servicio; `EMAIL_YA_ASOCIADO` → `{ email: ["Ese email ya está asociado a otra cuenta"] }`; `DNI_DUPLICADO` → error de `dni`.
- `src/app/(dashboard)/profesores/nuevo/nuevo-profesor-form.test.tsx` (7): sección y etiquetas; teléfono inválido (error junto al campo, foco, nada enviado, datos conservados); errores de identidad y contacto (foco en DNI); `FormData` con teléfono y email; `EMAIL_YA_ASOCIADO` junto a Email con foco; acciones de éxito sin contacto (orden, `href` y única primaria) y con contacto (sin "Cargar datos de contacto").
- `src/app/(dashboard)/profesores/horarios/nuevo/page.test.tsx` (6): `profesorIdInicial` según `?profesorId=`.

**Casos de `profesor-alta.test.ts`:**

**`construirAltaProfesorSchema(7, 8)`:**
- Identidad válida, sin `telefono` ni `email` (ausentes, `""`, `"   "` o `null`) → OK, `telefono` y `email` `undefined`.
- Solo teléfono `"(0387) 15-412-3456"` → OK, `"0387154123456"`; `"+54 9 387 444-5566"` → `"+5493874445566"`.
- Solo email `"  Ana.Gomez@Mail.COM  "` → OK, `"ana.gomez@mail.com"`.
- Ambos → OK, los dos normalizados.
- Teléfono `"123-4567"` (7 dígitos), 16 dígitos, `"0387-ABC-123"`, `"0387+154123456"` → error en `telefono` con el mensaje de HU-D-02.
- Email `"ana@"` y de 255 caracteres → error en `email`.
- Identidad inválida + teléfono inválido → errores en los dos campos a la vez.

**`crearProfesor()` con `prisma` mockeado** (mismo patrón que `profesor.service.test.ts`: `$transaction` que invoca el callback con un `tx` mockeado):
- Sin contacto → `tx.profesor.create` con `telefonoProfesor: null`, `emailProfesor: null`, `creadoPorUsuarioId`, `usuarioId: null`; `tx.usuario.findFirst` **no** se invoca.
- Solo teléfono → `create` con el teléfono normalizado y `emailProfesor: null`; sin consulta a `usuario`.
- Solo email → `tx.usuario.findFirst` con `mode: "insensitive"` y **sin** `NOT`; `create` con el email.
- Ambos → `create` con los dos.
- Email de una cuenta existente → `EMAIL_YA_ASOCIADO` y `create` **no** se invoca.
- DNI existente → `DNI_DUPLICADO`, sin consulta de email ni `create`.
- `P2002` sobre `dniProfesor` forzado en el `create` → `DNI_DUPLICADO`.
- `modificadoPorUsuarioId` no se setea en el `create`.
- Un error inesperado se propaga sin traducir.
- `actualizarContactoProfesor()` después de la extracción del helper: email de otra cuenta → `EMAIL_YA_ASOCIADO` sin `update`; email de la cuenta propia → permitido (la consulta lleva `NOT: { idUsuario }`).

**Estado:** todos ejecutados y en verde.

### Nivel 2 — Postman

`POST /api/profesores` con sesión de Gerente (DNI nuevo en cada caso):

| Caso | Body | Esperado |
|---|---|---|
| Sin contacto | identidad válida | `201`, `telefono: null`, `email: null` |
| Solo teléfono | + `"telefono": "(0387) 15-412-3456"` | `201`, `telefono: "0387154123456"` |
| Solo email | + `"email": "  Nuevo.Prof@Mail.COM "` | `201`, `email: "nuevo.prof@mail.com"` |
| Ambos | + los dos | `201` |
| Teléfono inválido | + `"telefono": "123-4567"` | `400 VALIDACION`, `campos.telefono`; ninguna fila nueva |
| Email duplicado | + `"email": "profesor2@noctium.local"` | `409 EMAIL_YA_ASOCIADO`, mensaje sin datos de la otra cuenta; ninguna fila nueva |
| Email duplicado con mayúsculas | + `"email": "GERENTE@Noctium.Local"` | `409 EMAIL_YA_ASOCIADO` |
| DNI duplicado + contacto válido | DNI de Giménez | `409 DNI_DUPLICADO` |
| Mesa de Entrada | cualquiera | `403 SIN_PERMISO` |

**Estado:** no ejecutado (sin evidencia en el repo). El Route Handler solo quedó verificado por typecheck y build; la traducción equivalente de errores está cubierta en los tests de la Server Action.

### Nivel 3 — BD / TablePlus

- Alta con contacto: fila en `profesores` con `"telefonoProfesor"` normalizado, `"emailProfesor"` en minúsculas, `"creadoPorUsuarioId"` = Gerente, `"createdAtProfesor"` real y `"modificadoPorUsuarioId"` `NULL`.
- Alta sin contacto: `"telefonoProfesor"` y `"emailProfesor"` `NULL`.
- Tras un rechazo (teléfono inválido, `EMAIL_YA_ASOCIADO`, `DNI_DUPLICADO`): `SELECT count(*) FROM profesores WHERE "dniProfesor" = '<dni del intento>'` → `0`.
- `usuarios` sin cambios en todos los casos.

**Estado:** no ejecutado. No se corrió nada contra la base de desarrollo, para no dejar profesores de prueba en ella.

### Casos de prueba manuales (UI)

Usuario: **gerente@noctium.local** / **Password123!** (seed). Emails de cuentas del seed: `profesor1@noctium.local` … `profesor4@noctium.local`, `gerente@noctium.local`, `mesa.entrada@noctium.local`. Usar un DNI nuevo en cada alta.

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Alta sin contacto | Identidad válida, Teléfono y Email vacíos, "Registrar profesor" | "Profesor registrado correctamente"; aparecen "Registrar horario de atención" (primaria), "Asociar materias", "Cargar datos de contacto", "Ver ficha del profesor" y "Volver al listado". En la ficha, Teléfono y Email "—" |
| 2 | Alta con solo teléfono | Identidad válida + Teléfono `(0387) 15-412-3456` | Éxito, **sin** "Cargar datos de contacto". En la ficha: Teléfono `0387154123456`, Email "—" |
| 3 | Alta con solo email | Identidad válida + Email `  Nuevo.Prof@Mail.COM ` | Éxito, sin "Cargar datos de contacto". En la ficha: Email `nuevo.prof@mail.com`, Teléfono "—" |
| 4 | Alta con ambos | Identidad válida + teléfono y email válidos | Éxito, sin "Cargar datos de contacto". Los dos en la ficha, normalizados |
| 5 | Teléfono inválido: no se crea nada | Identidad válida + Teléfono `123-4567` | "El teléfono debe tener entre 8 y 15 dígitos" junto a Teléfono, foco en Teléfono, el resto de los datos siguen cargados. Buscar el DNI en el listado: no existe |
| 6 | Teléfono con caracteres inválidos | Teléfono `0387-ABC-123` | "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis"; nada creado |
| 7 | Email inválido | Email `ana@` | "Ingresá un email válido" junto a Email; nada creado |
| 8 | Email duplicado: no se crea nada | Identidad válida + Email `profesor2@noctium.local` | "Ese email ya está asociado a otra cuenta" junto a Email, sin nombrar a quién pertenece; foco en Email; datos cargados. El DNI no existe en el listado |
| 9 | Email duplicado con mayúsculas | Email `GERENTE@Noctium.Local` | Mismo rechazo que el caso 8 |
| 10 | Foco con errores en identidad y contacto | DNI `12` + Teléfono `123` | Errores en los dos campos; foco en DNI (primero en el documento) |
| 11 | Horario con profesor preseleccionado | Tras el caso 1, "Registrar horario de atención" | Abre `/profesores/horarios/nuevo?profesorId=<nuevo>` con ese profesor seleccionado, el resumen "Horario de Apellido, Nombre" ("Sin horarios de atención registrados") y "Volver a la ficha" |
| 12 | `profesorId` inválido en la URL | `/profesores/horarios/nuevo?profesorId=abc` y con un cuid inexistente | Selector de profesor vacío, sin resumen, "Volver al listado" |
| 13 | `profesorId` inactivo en la URL | `/profesores/horarios/nuevo?profesorId={Molina}` | Selector vacío; Molina no aparece en la lista |
| 14 | "Cargar datos de contacto" solo sin contacto | Comparar los casos 1 y 2 | Aparece en el 1, no en el 2, 3 ni 4 |
| 15 | "Cargar datos de contacto" desde el alta | Tras el caso 1, "Cargar datos de contacto" | Abre `/profesores/<nuevo>/contacto` vacío; guardar un teléfono muestra "Datos de contacto del profesor guardados correctamente" |
| 16 | "Asociar materias" | Tras cualquier alta, "Asociar materias" | Abre `/profesores/<nuevo>/materias` de ese profesor |
| 17 | Edición del contacto desde la ficha sigue igual | En la ficha del profesor del caso 4, "Editar contacto": vaciar ambos y guardar; después cambiar el email por `profesor1@noctium.local` | Primero "Ingresá al menos un teléfono o un email de contacto" (la regla "al menos uno" sigue en HU-D-02); después "Ese email ya está asociado a otra cuenta". Un cambio válido se guarda |
| 18 | Cancelar con contacto cargado | Tipear solo un email y "Cancelar" | Diálogo "Cambios sin guardar" |
| 19 | Doble envío | Doble clic en "Registrar profesor" con contacto | Un solo profesor creado |

**Estado:** no ejecutados en navegador. Los casos 1-5, 8, 10 y 11-14 tienen su equivalente automatizado (formulario, action, servicio y página de horario, con mocks). Los casos 6, 7, 9 y 15-19 dependen de la integración real o del navegador y quedan pendientes.

**Evidencia esperada:** capturas del formulario (vacío, errores de contacto, `EMAIL_YA_ASOCIADO`, éxito con y sin "Cargar datos de contacto"), del formulario de horario preseleccionado y las consultas SQL del Nivel 3.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar. *(Se implementó sin frenar, por pedido explícito del responsable; los puntos "relevar antes de asumir" están resueltos en §0.)*
- [x] `construirAltaProfesorSchema()` reutiliza `telefonoContactoSchema`, `emailContactoSchema` y `campoOpcional()`; ninguna regla de contacto duplicada: `profesor.schema.ts`.
- [x] `verificarEmailNoAsociadoAOtraCuenta()` extraída y usada por el alta y por `actualizarContactoProfesor()`, sin cambio de comportamiento en HU-D-02 (misma consulta, cubierta por tests): `profesor.service.ts`.
- [x] `crearProfesor()` en una única `$transaction`: ante cualquier rechazo no se crea ninguna fila (tests: `create` no se invoca ante `EMAIL_YA_ASOCIADO` ni `DNI_DUPLICADO`).
- [x] Server Action y Route Handler delgados sobre el mismo servicio (Regla N.° 4), con `EMAIL_YA_ASOCIADO` como error del campo email (action) y `409` (route): `actions.ts`, `api/profesores/route.ts`.
- [x] `creadoPorUsuarioId` y `createdAtProfesor` registrados; `modificadoPorUsuarioId` no se setea en el alta (test).
- [x] Sección "Datos de contacto" opcional, errores junto al campo, datos conservados y foco al primer inválido: `nuevo-profesor-form.tsx` (tests del formulario).
- [x] Éxito con "Profesor registrado correctamente", "Registrar horario de atención" como única acción primaria, "Asociar materias", "Cargar datos de contacto" condicional, ficha y listado (tests del formulario).
- [x] Preselección de `?profesorId=` en el formulario de horario verificada (válido, inválido, inexistente, inactivo, repetido, ausente), sin cambios en su código: `horarios/nuevo/page.test.tsx`.
- [x] Pantalla de contacto de HU-D-02 sin cambios en su código (`[id]/contacto/*` y `ficha-contacto.tsx` no aparecen en `git status`). *(Caso manual 17 pendiente.)*
- [x] Solo tokens de `DESIGN.md` (`text-destructive`, `text-muted-foreground`, variantes `default` / `outline` de `buttonVariants`).
- [x] Ningún `DELETE` físico.
- [x] Sin cambios en `prisma/schema.prisma` ni en `prisma/seed.ts`.
- [x] Tests: 42 nuevos y los 228 existentes en verde (270/270).
- [x] `tsc --noEmit`, `npm run lint` (0 errores, 0 warnings) y `npm run build` sin errores.
- [x] `spec_modulo_D.md` actualizada de forma aditiva: fila de changelog, nota de sincronización en §2.1 y nota en §2.2 (§4.7).
- [ ] Niveles 2 y 3 ejecutados con evidencia.
- [ ] Casos manuales de §6 ejecutados en navegador como Gerente.
- [ ] PR con diff acotado a este ajuste.

---

## 8. Desviaciones de la spec original

### 8.1. Contacto en el alta, no solo como paso separado desde la ficha

- **Origen:** `HU-Sprint-1.md`, **HU-D-01 criterio 4** ("Ofrece continuar con contacto (HU-D-02) …") y **HU-D-02 criterio 1** ("**Desde la ficha** se registran Teléfono y Email …") definen el contacto como un paso **separado**, posterior al alta y hecho desde la ficha. `spec_modulo_D.md` §2.1 (alta solo de identidad) y §2.2 (contacto por `PATCH` sobre un profesor existente) siguen esa misma separación, y HU-D-01 §3 lo marcaba como fuera de alcance ("Cualquier campo de contacto … — solo identidad").
- **Qué cambia:** el contacto también puede cargarse en "Nuevo profesor", en la misma transacción que la identidad y con las mismas reglas de HU-D-02 criterios 2-4. La regla "al menos uno" de HU-D-02 criterio 1 no se aplica en el alta (§1 punto 1).
- **Qué no cambia:** la carga y modificación del contacto desde la ficha (HU-D-02) sigue existiendo tal cual, para cargarlo después o modificarlo.
- **Motivo:** decisión del usuario, para evitar un segundo formulario cuando el contacto ya se conoce al momento del alta.
- **Spec:** se anota en `spec_modulo_D.md` con nota de sincronización (§4.7).

### 8.2. Lo que NO es una desviación: ofrecer horario, materias y contacto después del alta

Ofrecer "Registrar horario de atención", "Asociar materias" y "Cargar datos de contacto" al confirmar el alta **no** es una desviación: lo pide **HU-D-01 criterio 4** ("Ofrece continuar con contacto (HU-D-02), materias (HU-D-03), horarios (HU-D-04)"). Esta task completa ese criterio (hoy faltaba "Asociar materias"), cambia cuál es la acción primaria y oculta "Cargar datos de contacto" cuando el contacto ya se cargó en el alta.

---

## 9. Deuda técnica y pendientes

- **Evidencia pendiente:** Niveles 2 y 3 y los casos manuales de §6 (el estado de cada uno está en su sección).
- **Tipos y actions fuera de la Regla N.° 11:** `EstadoNuevoProfesor` y `crearProfesor()` siguen en `src/app/(dashboard)/profesores/` (`profesor.types.ts`, `actions.ts`), mientras HU-D-03/04 ya usan `src/types/profesor.types.ts` y `src/server/profesores/actions.ts`. Misma deuda que HU-D-02 §9; no se mueve en esta task para no mezclar un refactor con el ajuste.
- **Notas desactualizadas sobre el test runner:** las tasks de HU-D-01 §6, HU-D-02 §6, HU-D-04 §8, HU-D-05 §6 y HU-J-01 §6 dicen que no hay runner instalado; hoy Vitest está en `package.json`. No se corrigen acá; queda para quien actualice esas tasks.
- **Caso 2 de HU-D-02 (§6, "Profesor sin contacto"):** sigue siendo válido dejando Teléfono y Email vacíos en el alta; la referencia "el alta de HU-D-01 no pide contacto" queda desactualizada.
- **Concurrencia del email:** igual que en HU-D-02, la verificación contra `usuarios` no bloquea filas; una cuenta creada con ese email en el mismo instante no se detecta. Bajo riesgo (las cuentas se crean por un proceso independiente) y fuera de alcance.
