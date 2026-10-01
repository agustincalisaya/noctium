```markdown
# Especificación Técnica — Módulo D (Profesor)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2)
## Revisión 2 — Sprint 2: modificación de la ficha (HU-D-06) y de las materias asociadas (HU-D-07), y ampliación de los servicios públicos

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (patrón de contacto/DNI, como referencia de diseño) · `spec_modulo_C.md` Revisión 5 (§2.15, servicios públicos) · `spec_modulo_A.md` §2.4 (matriz RBAC) · `spec_modulo_B.md` §2.5 y §3.3 (patrón de modificación) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-01 | Contractualizada en Sprint 1 (§2.1, alta solo con identidad) | Anotada §2.1 (contacto opcional en el alta y wizard posterior); sin renumerar |
| HU-D-02 | Contractualizada en Sprint 1 (§2.2) | Anotada §2.2 (el contacto también puede cargarse en el alta); sin renumerar |
| HU-D-03 | Contractualizada en Sprint 1 (§2.3) | Anotada §2.3 y §4 (opción (a) de la Regla N.° 2); sin renumerar |
| HU-D-04 | Contractualizada en Sprint 1 (§2.4) | Anotada §2.4 (parámetros desde `ParametroSistema`, «Contrato para HU-C-04») y §4; sin renumerar |
| HU-D-05 | Contractualizada en Sprint 1 (§2.5) | Anotada §2.5 (entrada al modo edición, `version` y `activa` en el detalle); sin renumerar |
| HU-D-06 | Gap — no contractualizada | Añadida sección 2.6 |
| HU-D-07 | Gap — no contractualizada | Añadida sección 2.7 (incluye la ruta `GET .../turnos-futuros`) |

**HU contractualizadas en esta revisión:** HU-D-01 (Identidad), HU-D-02 (Contacto), HU-D-03 (Asociación a materias), HU-D-04 (Horario de atención), HU-D-05 (Listado) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-D-06 (Modificar datos de un profesor), HU-D-07 (Modificar las materias asociadas a un profesor).

**Changelog — Revisión 2 (Sprint 2):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-D-06 | Gap — "Modificación de una ficha de profesor ya registrada" figuraba como fuera de alcance | Nueva sección 2.6 (aditiva, no renumera) |
| HU-D-07 | Gap | Nueva sección 2.7, con su ruta propia `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros` (lista del modal «Ver turnos»). Regla 3.6 |
| Servicios públicos | `profesorActivoDictaMateria()` (existente) | Nueva sección 2.8: 4 funciones nuevas para Turnos (`spec_modulo_C.md` Revisión 5) y Historial, más `obtenerOpcionProfesorDeUsuario()` y `obtenerOpcionProfesorActivo()` (nuevas en Revisión 2, consumidas por Turnos, Historial y Calendario) |
| Modelo `Profesor` | Tiene `modificadoPorUsuarioId` y `updatedAtProfesor` | + `version` (concurrencia optimista, mismo patrón que `Alumno`) |

**Actualización del 29/09/2026 (implementación del PR 0', sin renumerar secciones):**
| Sección | Estado previo | Acción |
|---|---|---|
| 2.8 | Varias firmas marcadas «forma exacta: a confirmar» | **Confirmadas contra el código** (ver tabla): `OpcionProfesor = { id, nombreParaMostrar }`, con `db?` opcional en todas |
| 2.8 (`obtenerMateriasDelProfesor`) | «Materias activas» | Devuelve **todas** las materias asociadas con el campo `activa`; el consumidor filtra (el calendario ya consume esa forma) |
| 2.8 (`profesorActivoDictaMateria`) | Requisito de `FOR SHARE` con `db` | Implementado en `profesor.publico.ts`: con `db` lee `profesor_materia` con `FOR SHARE OF`; sin `db` delega en la del service |
| 2.8 (imports) | «No importa nada de otros módulos» | Se precisa qué sí puede importar (ver nota al inicio de 2.8) |
| Permisos | `profesores:crear`, `profesores:editar`, `profesores:leer` **exclusivos de Mesa de Entrada** (`seed.ts`, `ACCIONES_SOLO_MESA_ENTRADA`) | **Sin cambios.** El backlog v2 corrigió HU-D-06/D-07 a "Como personal de mesa de entrada" (R2-1 resuelto) |

## ✅ RESUELTO — R2-1 (antes Q12): quién modifica un profesor

Las HU-D-06 y HU-D-07 se escribían "Como Gerente", lo que chocaba con `seed.ts` (las tres acciones `profesores:*` son **exclusivas de Mesa de Entrada**). El backlog v2 del 28/09/2026 las corrigió a **"Como personal de mesa de entrada"**: la matriz de permisos **no cambia**. `profesores:editar` y `profesores:leer` siguen siendo solo de Mesa de Entrada, y `ACCIONES_SOLO_MESA_ENTRADA` del seed queda como está. El Gerente **no** modifica profesores en este sprint.

**Changelog (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-03 | §2.3 contractualizada en snake_case, con rutas `lib/`/`app/` y `@@unique`; §4 declara el evento `profesor:materias_asociadas` | Anotada §2.3 (nota de sincronización) y §4 (el módulo D usa la opción (a) de la Regla N.° 2). Sin renumerar. |
| HU-D-04 | §2.4 contractualizada en snake_case con días fijos L-S y `GRANULARIDAD_MINUTOS` constante; §4 declara `profesor:horario_registrado` | Anotada §2.4 (nota de sincronización + "Contrato para HU-C-04") y §4. Días, franja y granularidad salen de `ParametroSistema`. Sin renumerar. |
| HU-D-01 / HU-D-02 (ajuste) | §2.1 alta solo con identidad; §2.2 contacto como paso separado, desde la ficha | Anotada §2.1 (nota de sincronización: contacto opcional en el alta, en la misma transacción, y acciones posteriores al alta) y §2.2 (referencia). Sin renumerar. |

**Fuera de alcance de esta spec (explícito):**
- ~~Modificación de una ficha de profesor ya registrada.~~ **Incorporada en Revisión 2** (2.6 y 2.7, ver «Actualización de alcance» más abajo).
- Baja lógica / reactivación del profesor.
- Gestión de la cuenta de acceso del profesor: alta, vinculación o administración de su `Usuario` — se gestiona por un proceso independiente, fuera de esta spec (ver nota de aislamiento en sección 1).

**Actualización de alcance — Revisión 2 (Sprint 2):** la **modificación de identidad y contacto** (2.6) y de las **materias asociadas** (2.7) pasan a estar dentro de alcance. Siguen fuera: baja lógica y reactivación (HU-D-08, Sprint 3), modificar el horario de atención y la cuenta de acceso.

---

## 1. Visión General

El Módulo D gestiona la ficha del Profesor: identidad, contacto, las materias que puede dictar y su horario recurrente de atención semanal — insumos que HU-C-04 (`spec_modulo_C.md`) consulta para validar disponibilidad al asignar un profesor a un turno.

**Nota explícita — sin cuenta de acceso en esta spec:** a diferencia del Módulo B (Alumno), registrar una ficha de Profesor **no** crea ni vincula ninguna cuenta (`Usuario`) de forma automática. El criterio de aceptación de HU-D-01 lo establece de forma explícita: "las cuentas se administran de manera independiente". El campo de vínculo (`Profesor.usuario_id`, si el modelo de datos lo contempla) permanece sin asignar durante todo este sprint; el proceso que eventualmente lo complete es responsabilidad de una HU futura, no de esta.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `src/server/profesores/*.service.ts` (Regla N.° 4 de `docs/RULES.md`). Los schemas de identidad y contacto reutilizan las mismas utilidades compartidas que `spec_modulo_B.md` (`fechaCalendarioValidaSchema`, `normalizarTexto()`, `normalizarTelefono()`) — utilidades de validación transversales, no acoplamiento de dominio: reutilizar una función de `lib/utils/` o `lib/schemas/shared/` (rutas heredadas de la Revisión 1, que `spec_modulo_B.md` y `spec_modulo_L.md` todavía citan así: **a confirmar contra el código**) no viola la Regla N.° 3 de aislamiento, que aplica a datos y lógica de negocio de otro módulo, no a utilidades puras sin estado.

**Alcance de esta revisión:** las secciones 2.6 (HU-D-06) y 2.7 (HU-D-07) son nuevas y aditivas, y 2.8 amplía los servicios públicos. Las secciones 2.1 a 2.5 (Sprint 1) no se renumeran: se anotan con notas de sincronización, para que las referencias cruzadas de otras specs (`spec_modulo_C.md`, `spec_modulo_E.md`, `spec_modulo_J.md`, `spec_modulo_L.md`) sigan siendo válidas (ver `docs/adicionales/sdd-metodologia.md`).

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Profesor`, `Materia` y `HorarioProfesor` son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo. El parámetro `[id]` refiere a `Profesor`.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("profesores:<accion>")` (Regla N.° 10).
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/profesor.types.ts`, Server Actions en `src/server/profesores/actions.ts` y services en `src/server/profesores/profesor.service.ts`. Imports siempre con el alias `@/`.

---

### 2.1. Alta de identidad del profesor (HU-D-01)

**Ruta:** `POST /api/profesores`
**Server Action equivalente:** `crearProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `crearProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:crear` (exclusivo del rol Mesa de Entrada)

```typescript
// src/server/profesores/profesor.schema.ts (Regla N.° 11; en el código se construye con construirIdentidadProfesorSchema(), ver la nota de §2.1)
export const IdentidadProfesorSchema = z.object({
  nombre: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  apellido: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  dni: z.string().trim().regex(/^\d+$/, "Ingresá el DNI solo con números").length(DNI_LONGITUD),
  fecha_nacimiento: fechaCalendarioValidaSchema.refine((d) => d <= new Date(), "La fecha de nacimiento no puede ser futura"),
  genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICAR"]).optional(),
});
export type IdentidadProfesorInput = z.infer<typeof IdentidadProfesorSchema>;
```

**Nota — unicidad de DNI acotada a `Profesor`, no compartida con `Alumno`:** son entidades y tablas independientes. Una misma persona podría, en teoría, tener ficha de Alumno y de Profesor con el mismo DNI sin que eso sea un conflicto para este sistema — ningún criterio de aceptación pide lo contrario, así que la spec no introduce esa restricción por su cuenta.

**Comportamiento esperado (`src/server/profesores/profesor.service.ts` → `crearProfesor`):**
1. Verificar unicidad aplicativa de `dni` contra **todos** los profesores, activos e inactivos.
2. Si existe: `409 DNI_DUPLICADO`.
3. Revalidación inmediatamente antes del `INSERT` + defensa de constraint único (`P2002`) — mismo patrón que `spec_modulo_L.md` §3.2 y `spec_modulo_B.md` §3.4.
4. Insertar con `is_active: true`, `usuario_id: null` (sin cuenta — ver nota de la sección 1), fecha de alta y usuario registrante.
5. Emitir `profesor:creado` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Ana", "apellido": "Gómez", "dni": "28456789", "is_active": true }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "DNI_DUPLICADO", "message": "Ya existe un profesor registrado con ese DNI" } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (identidad, y contacto si viene).
- `403 SIN_PERMISO` — sin `profesores:crear`.
- `409 DNI_DUPLICADO` — ya existe un profesor con ese DNI (activo o inactivo).
- `409 EMAIL_YA_ASOCIADO` — el email opcional ya está asociado a otra cuenta (ver la nota de sincronización siguiente).

**Nota de sincronización (ajuste HU-D-01/HU-D-02, resuelta — `docs/tasks/Sprint 1/HU-D-01-D-02-alta-con-contacto.md`):**
- **Contacto opcional en el alta:** "Nuevo profesor" suma la sección "Datos de contacto" (`telefono`, `email`). Si los dos quedan vacíos, el alta es solo de identidad, como antes. Si se completa alguno, se aplican las reglas de §2.2 (teléfono normalizado de 8-15 dígitos, email en minúsculas de hasta 254 caracteres, unicidad frente a cuentas sin revelar a quién pertenece), **salvo** "al menos uno", que sigue siendo exclusiva de §2.2.
- **Desviación de `HU-Sprint-1.md`:** HU-D-01 c4 y HU-D-02 c1 definen el contacto como un paso separado desde la ficha. §2.2 se mantiene para cargarlo o modificarlo después. Ofrecer contacto, materias y horario al terminar el alta **no** es una desviación: lo pide HU-D-01 c4.
- **Rutas y nombres reales (Regla N.° 11), camelCase:**
  - Schema `construirAltaProfesorSchema(dniLongitudMin, dniLongitudMax)` en `src/server/profesores/profesor.schema.ts`: `construirIdentidadProfesorSchema()` extendido con `campoOpcional(telefonoContactoSchema)` y `campoOpcional(emailContactoSchema)` de `src/server/shared/contacto.schema.ts`. Mismo schema en el formulario, la Server Action y el Route Handler.
  - Servicio `crearProfesor(input, usuarioRegistranteId)` en `src/server/profesores/profesor.service.ts`. La unicidad del email usa `verificarEmailNoAsociadoAOtraCuenta()`, la misma función que `actualizarContactoProfesor()` (§2.2) y que `modificarProfesor()` (§2.6 paso 3). Proveedor y firma de `verificarEmailNoAsociadoAOtraCuenta()`: **a confirmar contra el código** (no figura entre los servicios públicos de `spec_modulo_A.md` §2.4).
- **Atomicidad:** unicidad de DNI, unicidad del email (solo si vino) e `INSERT` con identidad y contacto en una única `prisma.$transaction`. Cualquier rechazo deja la base sin cambios. El catch de `P2002` sobre `dniProfesor` envuelve la transacción.
- **Trazabilidad (Regla N.° 2, opción (a)):** `createdAtProfesor` y `creadoPorUsuarioId`, como antes. Cargar contacto en el alta no es una modificación: `modificadoPorUsuarioId` queda en `NULL`.
- **`POST /api/profesores`:** acepta `telefono` y `email` opcionales. `201` devuelve además `telefono` y `email` (`null` si no se cargaron). Nuevo `409 EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta"). La Server Action `crearProfesor()` lo devuelve como error del campo `email`.
- **Después del alta, wizard lineal de 3 pasos** (reemplaza la pantalla de éxito con acciones sueltas). Cada paso muestra el indicador "Paso N de 3: <nombre>" (`StepperAltaProfesor`). Los avisos de éxito son toasts no bloqueantes (`src/components/ui/toast.tsx`, Base UI, arriba al centro, se ocultan solos a los 3,5 s). La navegación al paso siguiente no espera a que el usuario los cierre:
  1. **Datos** (`/profesores/nuevo`, obligatorio, sin opción de saltearlo): al confirmar el alta aparece el toast "Profesor registrado correctamente" y se avanza a `/profesores/<id>/materias?alta=1`.
  2. **Materias** (§2.3 con `?alta=1`): mismo encabezado "Apellido, Nombre · DNI". Al guardar aparece el toast "Materias asignadas correctamente" (HU-D-03; el guardado de solo materias desde la ficha usa el mismo texto, por decisión del PO sobre HU-D-07 AC4, §2.7 «Mensajes al guardar») y se avanza a `/profesores/horarios/nuevo?profesorId=<id>&alta=1`. El link secundario "Completar esto más tarde" reemplaza a "Cancelar" y lleva a la ficha. Si no hay materias activas, se ofrece "Continuar con el horario".
  3. **Horario** (§2.4 con `?alta=1`): el mismo encabezado reemplaza al selector de profesor. Cada intervalo guardado muestra el toast "Horario registrado correctamente" y la pantalla se mantiene para cargar otro, con día y horas en blanco. Fuera del wizard el día se conserva, como define HU-D-04. Sin intervalos se ofrece "Completar esto más tarde" y, con al menos uno, "Finalizar". Los dos llevan a la ficha. Si el id no corresponde a un profesor activo, la pantalla funciona en su modo normal.
  - "Cargar datos de contacto" ya no se ofrece al terminar el alta: el contacto es opcional en el paso 1 y se carga después desde la ficha (§2.2).
  - Sin `?alta=1`, las pantallas de §2.3 y §2.4 se comportan como antes, cuando se entra desde la ficha.
  - **Horario sin materias asociadas:** aviso (`bg-warning`) con link a asignar materias, sin bloquear el registro. El horario es independiente de la materia (§2.4) y el servidor no exige materias.

---

### 2.2. Registrar datos de contacto (HU-D-02)

**Ruta:** `PATCH /api/profesores/[id]/contacto`
**Server Action equivalente:** `actualizarContactoProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `actualizarContactoProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar`

```typescript
// Base sin `.refine`: es la que componen otros schemas (p. ej. 2.6). En Zod 4,
// `.partial()` / `.merge()` sobre un objeto con `.refine` a nivel objeto puede fallar.
export const ContactoBaseSchema = z.object({
  telefono: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254).optional(),
});
// Alta de contacto (2.2): exige al menos uno.
export const ContactoProfesorSchema = ContactoBaseSchema.refine((d) => d.telefono || d.email, {
  message: "Ingresá al menos un teléfono o un email de contacto",
  path: ["telefono"],
});
export type ContactoProfesorInput = z.infer<typeof ContactoProfesorSchema>;
```

**Comportamiento esperado:**
1. `telefono`: misma normalización que `spec_modulo_B.md` §2.2 (`lib/utils/normalizar-telefono.ts`, ruta a confirmar contra el código; 8-15 dígitos, conserva `+` inicial).
2. `email`: si se provee, se valida su unicidad contra `Usuario.email` de cualquier cuenta existente — **defensivo**, ya que este módulo no crea cuentas, pero el email de contacto podría coincidir con uno ya usado por otra cuenta si en el futuro se vincula manualmente; el aviso no revela a quién pertenece (`409 EMAIL_YA_ASOCIADO`), mismo criterio que `spec_modulo_B.md` §2.2. Qué módulo provee la comprobación contra `Usuario.email` y con qué firma (`verificarEmailNoAsociadoAOtraCuenta()`): **a confirmar contra el código**.
3. Actualiza únicamente los campos provistos, `updated_at`.
4. Emitir `profesor:contacto_actualizado` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "telefono": "+5493874445566", "email": "ana.gomez@mail.com" }, "error": null }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — formato inválido, o ni teléfono ni email («Ingresá al menos un teléfono o un email de contacto»).
- `403 SIN_PERMISO` — sin `profesores:editar`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente (mismo código que 2.3 y 2.6; a confirmar contra el código para esta operación).
- `409 EMAIL_YA_ASOCIADO` — el email ya está asociado a otra cuenta.

**Nota (ajuste HU-D-01/HU-D-02):** el contacto también puede cargarse en el alta (nota de sincronización de §2.1), con las mismas reglas de esta sección salvo "al menos uno". Esta sección sigue siendo la forma de cargarlo o modificarlo después, desde la ficha, sin cambios de comportamiento.

---

### 2.3. Asociar profesor a materias (HU-D-03)

**Ruta:** `POST /api/profesores/[id]/materias`
**Server Action equivalente:** `asociarMateriasProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `asociarMateriasAProfesor()` en `src/server/profesores/profesor.service.ts` — es el nombre con que `spec_modulo_L.md` §2.3 declara a este módulo como consumidor de `bloquearMateriasParaAsociar()` (nombre y firma exactos: a confirmar contra el código). La modificación de §2.7 (`actualizarMateriasDeProfesor`) llama a la misma función de L.
**Permiso requerido:** `profesores:editar`

```typescript
export const AsociarMateriasProfesorSchema = z.object({
  materia_ids: z.array(z.string().cuid()).min(1, "Seleccioná al menos una materia"),
});
export type AsociarMateriasProfesorInput = z.infer<typeof AsociarMateriasProfesorSchema>;
```

**Modelo de referencia:** `ProfesorMateria` (`profesor_id`, `materia_id`), constraint único compuesto `@@unique([profesor_id, materia_id])`.

**Comportamiento esperado, dentro de `prisma.$transaction` (todo-o-nada):**
1. Verificar que el `Profesor` esté `is_active: true`. Solo se asocian materias a profesores activos.
2. Resolver cuáles de los `materia_ids` recibidos **ya** están asociadas a este profesor. Si alguno lo está: `409 MATERIA_YA_ASOCIADA` — el servidor rechaza el duplicado como defensa (la UI ya impide reseleccionar una materia marcada, esto cubre una llamada directa a la API).
3. **Revalidar que todas las materias del lote sigan `is_active: true` al momento de confirmar** (no alcanza con que lo estuvieran cuando se abrió el formulario). Si **alguna** dejó de estar activa: se aborta la operación completa (no se guarda ninguna asociación de ese lote, ni siquiera las que sí seguían válidas), y se informa específicamente cuál/cuáles materias dejaron de estar activas, para que el cliente las quite de la selección y reconfirme — `409 MATERIA_INACTIVA`, incluyendo la lista de ids problemáticos en el error.
4. Si todo es válido: insertar todas las asociaciones del lote en una única operación (`createMany`).
5. Emitir `profesor:materias_asociadas` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "profesor_id": "cuid", "materias_asociadas": ["cuid-materia-1", "cuid-materia-2"] }, "error": null }
```

**Respuesta `409 Conflict` (materia inactiva en el lote):**
```json
{
  "data": null,
  "error": { "code": "MATERIA_INACTIVA", "message": "La materia 'Física' ya no está activa", "materia_ids_invalidas": ["cuid-materia-2"] }
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — `materia_ids` vacío o con ids inválidos.
- `403 SIN_PERMISO` — sin `profesores:editar`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente.
- `404 MATERIA_NO_ENCONTRADA` — algún id no corresponde a ninguna materia.
- `409 PROFESOR_INACTIVO` — el profesor no está activo.
- `409 MATERIA_YA_ASOCIADA` — alguna materia del lote ya está asociada al profesor.
- `409 MATERIA_INACTIVA` — alguna materia del lote dejó de estar activa (con `materia_ids_invalidas`; no se guarda ninguna).

**Nota de sincronización (HU-D-03, resuelta):**
- **Rutas reales (Regla N.° 11):** Server Action en `src/server/profesores/actions.ts`, servicio en `src/server/profesores/profesor.service.ts`, schema en `src/server/profesores/profesor.schema.ts`, tipos en `src/types/profesor.types.ts`. Route Handler en `src/app/api/profesores/[id]/materias/route.ts`.
- **camelCase**, igual que HU-D-01/D-02: el payload es `materiaIds`; la respuesta `201` es `{ profesorId, materiasAsociadas }`; los errores `409` llevan `materiaIdsInvalidas`.
- **Modelo:** la unicidad de `ProfesorMateria` es la PK compuesta `@@id([profesorId, materiaId])`, no un `@@unique`. Un `P2002` sobre ella se traduce a `MATERIA_YA_ASOCIADA`.
- **Zod 4:** `z.cuid()` en lugar del deprecado `z.string().cuid()`.
- **Códigos que esta sección no definía:**
  - `404 PROFESOR_NO_ENCONTRADO`: profesor inexistente.
  - `409 PROFESOR_INACTIVO`: profesor inactivo (paso 1).
  - `404 MATERIA_NO_ENCONTRADA`: algún id no corresponde a ninguna materia.
- **Orden de validación:** igual que arriba. `MATERIA_INACTIVA` se lanza **después** del chequeo de duplicados (paso 2).
- **Atomicidad (Regla N.° 7):**
  - el paso 1 es un `updateMany` condicionado a `activoProfesor: true`, que además registra `modificadoPorUsuarioId`;
  - el paso 3 usa `bloquearMateriasParaAsociar()` de `spec_modulo_L.md` §2.3, que bloquea las materias con `FOR SHARE` dentro de la misma transacción.
- **Paso 5 (evento):** no se emite. Ver la nota de §4.

---

### 2.4. Registrar horario de atención del profesor (HU-D-04)

**Ruta:** `POST /api/profesores/[id]/horarios`
**Server Action equivalente:** `registrarHorarioProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `registrarHorarioProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar`

```typescript
const horaSchema = z.string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM, 24h)")
  .refine((h) => Number(h.split(":")[1]) % GRANULARIDAD_MINUTOS === 0, {
    message: `El horario debe ajustarse a intervalos de ${GRANULARIDAD_MINUTOS} minutos`,
  });

export const RegistrarHorarioProfesorSchema = z.object({
  dia_semana: z.enum(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]),
  hora_inicio: horaSchema,
  hora_fin: horaSchema,
}).refine((d) => d.hora_inicio < d.hora_fin, {
  message: "La hora de inicio debe ser anterior a la hora de fin",
  path: ["hora_fin"],
});
export type RegistrarHorarioProfesorInput = z.infer<typeof RegistrarHorarioProfesorSchema>;
```

**Naturaleza del registro — recurrente y sin fecha:** `HorarioProfesor` no tiene columna de fecha: representa un patrón semanal que se repite indefinidamente (todos los Lunes 10-12, por ejemplo), independiente de la materia. `spec_modulo_C.md` (HU-C-04) lo consulta contra el día de semana del turno propuesto, no contra una fecha puntual.

**Comportamiento esperado:**
1. Verificar que el `Profesor` esté `is_active: true`.
2. Verificar que `dia_semana` sea uno de los días operativos del centro (parámetro `DIAS_OPERATIVOS`) y que el intervalo `[hora_inicio, hora_fin)` esté completamente contenido en el horario operativo (`HORA_APERTURA`, `HORA_CIERRE`). Si no: `400 FUERA_DE_HORARIO_OPERATIVO`, indicando la franja permitida.
3. **Validación de superposición** contra los `HorarioProfesor` ya registrados del mismo profesor en el mismo `dia_semana`. Regla de superposición explícita: dos intervalos `[a1, a2)` y `[b1, b2)` se superponen **si y solo si** `a1 < b2 AND b1 < a2`. Bajo esta fórmula, dos intervalos contiguos (`a2 == b1`, ej. `10:00–12:00` y `12:00–14:00`) **no** se consideran superpuestos — cumple el criterio de aceptación explícito de HU-D-04 §4.
4. Si hay superposición: `409 HORARIO_SUPERPUESTO`, identificando el día y el intervalo en conflicto. No se guarda el nuevo horario.
5. Si es válido: inserta el nuevo `HorarioProfesor`. Operación de una sola tabla, transaccional simple.
6. Emitir `profesor:horario_registrado` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "dia_semana": "LUNES", "hora_inicio": "10:00", "hora_fin": "12:00" }, "error": null }
```

**Respuesta `409 Conflict` (superposición):**
```json
{
  "data": null,
  "error": { "code": "HORARIO_SUPERPUESTO", "message": "El intervalo se superpone con Lunes 10:00–12:00" }
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — formato de hora inválido.
- `400 DIA_NO_OPERATIVO` / `400 HORA_NO_GRANULAR` / `400 HORARIO_INVERTIDO` / `400 FUERA_DE_HORARIO_OPERATIVO` — según el paso 2 y la nota de sincronización siguiente.
- `403 SIN_PERMISO` — sin `profesores:editar`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente.
- `409 PROFESOR_INACTIVO` — el profesor no está activo.
- `409 HORARIO_SUPERPUESTO` — el intervalo se superpone con uno ya registrado ese día.

**Nota de sincronización (HU-D-04, resuelta):**
- **Rutas reales (Regla N.° 11):**
  - Server Action `registrarHorarioProfesor(formData)` en `src/server/profesores/actions.ts`.
  - Servicio `registrarHorarioProfesor(input, usuarioId)` en `src/server/profesores/profesor.service.ts`.
  - Schema `construirRegistrarHorarioSchema(parametros)` en `src/server/profesores/profesor.schema.ts`.
  - Helpers puros (compartidos cliente/servidor) en `src/lib/horario-atencion.ts`.
  - Route Handler `POST /api/profesores/[id]/horarios` en `src/app/api/profesores/[id]/horarios/route.ts`.
  - UI: `/profesores/horarios/nuevo?profesorId=<id>` y la sección "Horario de atención" de la ficha.
- **camelCase**, igual que HU-D-03: payload `{ diaSemana, horaInicio, horaFin }` (el `profesorId` va en la ruta, o en el `FormData` de la action). La respuesta `201` es `{ id, diaSemana, horaInicio, horaFin }`.
- **Modelo:** se usa el `HorarioProfesor` existente, sin cambios de schema. Las horas son `@db.Time`, igual que `Turno.horaInicioTurno`. El servicio las convierte a minutos desde las 00:00 para comparar. La UI y los contratos usan `"HH:mm"`.
- **Parámetros:** no se hardcodean. `obtenerParametrosHorarioOperativo()` (`src/server/shared/parametros.ts`) lee de `ParametroSistema` las mismas claves que Turnos:
  - `dias_operativos`
  - `horario_operativo_desde` / `horario_operativo_hasta`
  - `granularidad_turno_minutos`
  El schema se construye con esos valores, como `construirIdentidadProfesorSchema` con el DNI.
- **Validaciones:** el schema y el servicio comparten `validarIntervaloHorario()`. Códigos:
  - `400 DIA_NO_OPERATIVO`, `400 HORA_NO_GRANULAR`, `400 HORARIO_INVERTIDO` y `400 FUERA_DE_HORARIO_OPERATIVO`, con el mensaje "El horario debe estar dentro del horario operativo del centro (08:00 a 20:00)". Se devuelven como error de validación del campo.
  - `404 PROFESOR_NO_ENCONTRADO`
  - `409 PROFESOR_INACTIVO`
  - `409 HORARIO_SUPERPUESTO`
- **Atomicidad (Regla N.° 7):** una sola `$transaction` hace tres pasos:
  1. Un `updateMany` condicionado a `activoProfesor: true`, que registra `modificadoPorUsuarioId` (mismo patrón que HU-D-03). También bloquea la fila del profesor hasta el commit.
  2. La búsqueda de superposición en el mismo día.
  3. El `INSERT`.
  Si llegan dos altas simultáneas para el mismo profesor, se serializan. La segunda ve el intervalo de la primera y se rechaza.
- **Trazabilidad:** opción (a) de la Regla N.° 2. Se usan `createdAtHorario` y `creadoPorUsuarioId` de la fila. No se emite `profesor:horario_registrado` (ver §4).
- **Resumen semanal:** `ResumenSemanalHorarios` (`src/components/shared/resumen-semanal-horarios.tsx`) recibe el resultado de `obtenerHorariosDelProfesor()`. Agrupa por día y ordena por hora de inicio. HU-D-05 lo reutiliza en el detalle.

#### Contrato para HU-C-04

Servicio público del módulo D (Regla N.° 3) para validar la disponibilidad del profesor al asignar un turno. No hace falta leer `horarios_profesor` directamente.

```typescript
// src/server/profesores/profesor.service.ts
export async function estaDentroDeHorarioAtencion(
  profesorId: string,
  fecha: Date,        // fecha calendario @db.Date (medianoche UTC), como Turno.fechaTurno
  horaInicio: string, // "HH:mm", 24 h
  horaFin: string,    // "HH:mm", 24 h, posterior a horaInicio
  db?: Prisma.TransactionClient, // opcional: para correr dentro de la transacción de quien llama
): Promise<boolean>;

// Helper puro de superposición (regla única del proyecto, §3.4). Se exporta
// desde src/lib/horario-atencion.ts (usable también en cliente) y se
// re-exporta desde profesor.service.ts.
export function intervalosSeSuperponen(
  a: { inicio: number; fin: number }, // minutos desde las 00:00, [inicio, fin)
  b: { inicio: number; fin: number },
): boolean; // a.inicio < b.fin && b.inicio < a.fin — los contiguos NO se superponen
```

**Formato de horas:** strings `"HH:mm"` en 24 h con cero a la izquierda (`"08:00"`, `"13:30"`, nunca `"8:00"`), validadas con `HORA_REGEX` de `src/lib/horario-atencion.ts`. Internamente se comparan como minutos desde las 00:00. En base, `HorarioProfesor` guarda `@db.Time`, que Prisma lee como `Date` 1970-01-01 UTC. Quien llama no manipula ese formato.

**Qué devuelve:**
- Devuelve `true` si el intervalo `[horaInicio, horaFin)` cae **completo** dentro de **un** horario de atención del profesor. Se consideran solo los horarios del día de la semana de `fecha` (`getUTCDay()`). Los bordes cuentan: un turno 10:00–12:00 entra en un horario 10:00–12:00.
- No combina horarios contiguos. Un turno 11:00–13:00 contra 10:00–12:00 + 12:00–14:00 devuelve `false`.
- Devuelve `false` si alguna hora no tiene formato `HH:mm` o si `horaInicio >= horaFin`.
- No verifica que el profesor esté activo ni que dicte la materia. Para eso está `profesorActivoDictaMateria(profesorId, materiaId)`.
- Para pasar de/a minutos: `horaAMinutos("10:30") === 630` y `minutosAHora(630) === "10:30"`, en `src/lib/horario-atencion.ts`.

Ejemplo de uso (HU-C-04, dentro de la transacción de asignación):

```typescript
import { estaDentroDeHorarioAtencion } from "@/server/profesores/profesor.service";
import { horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import { ServiceError } from "@/server/shared/service-error";

// turno: fila de Turno ya leída; tx: Prisma.TransactionClient de la asignación.
const inicio = minutosAHora(turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes());
const fin = minutosAHora(horaAMinutos(inicio) + turno.duracionMinutosTurno);

if (!(await estaDentroDeHorarioAtencion(profesorId, turno.fechaTurno, inicio, fin, tx))) {
  throw new ServiceError("PROFESOR_FUERA_DE_HORARIO", "El turno está fuera del horario de atención del profesor");
}

// Llamada directa, fuera de una transacción (usa el cliente global):
await estaDentroDeHorarioAtencion(profesorId, new Date(Date.UTC(2026, 8, 21)), "10:00", "12:00"); // lunes
```

---

### 2.5. Listado y detalle de profesores (HU-D-05)

**Ruta (listado):** `GET /api/profesores`
**Server Action equivalente:** — (solo Route Handler)
**Servicio (listado):** `listarProfesores()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:leer`

```typescript
export const ListarProfesoresQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado:**
- Orden inicial: `apellido_normalizado, nombre_normalizado` ascendente, `dni` como segundo criterio de desempate — mismo criterio que `spec_modulo_B.md` §2.4.
- Cada ítem: apellido, nombre, DNI, contacto (`telefono`/`email`, `"—"` si ausentes), materias asociadas **resumidas** (ej. `"Matemática, Física +2"` cuando son más de 2 — se listan las primeras 2 por nombre y se indica el resto como contador, sin impedir ver el detalle completo), estado.
- Incluye profesores activos e inactivos (columna Estado los distingue).
- Paginación server-side con metadatos.

**Ruta (detalle):** `GET /api/profesores/[id]` (**Server Action equivalente:** — (solo Route Handler); **Servicio:** `obtenerDetalleProfesor()` en `src/server/profesores/profesor.service.ts`) — identidad completa, contacto, listado completo de materias asociadas, y horarios **agrupados por día de la semana** (resumen semanal legible, ej. `{ LUNES: [{hora_inicio, hora_fin}], MARTES: [...] }`).

**Respuesta `200 OK` (detalle):**
```json
{
  "data": {
    "id": "cuid",
    "apellido": "Gómez", "nombre": "Ana", "dni": "28456789", "is_active": true, "version": 3,
    "contacto": { "telefono": "+5493874445566", "email": "ana.gomez@mail.com" },
    "materias": [{ "id": "cuid", "nombre": "Matemática", "codigo": "MAT101", "activa": true }],
    "horarios": { "LUNES": [{ "hora_inicio": "10:00", "hora_fin": "12:00" }], "MARTES": [] }
  },
  "error": null
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — query del listado inválida (`pagina`, `por_pagina`).
- `403 SIN_PERMISO` — sin `profesores:leer`.
- `404 PROFESOR_NO_ENCONTRADO` — solo en el detalle, profesor inexistente.

**Nota de sincronización (HU-D-05, resuelta):**
- **Rutas reales (Regla N.° 11):**
  - Servicios `listarProfesores(query)`, `obtenerDetalleProfesor(id)` y `listarOpcionesProfesoresActivos()` en `src/server/profesores/profesor.service.ts`.
  - Schema `ListarProfesoresQuerySchema` en `src/server/profesores/profesor.schema.ts`.
  - Helpers puros en `src/lib/profesor-listado.ts` (`resumirMaterias`, `clavesOrdenProfesor`) y en `src/lib/horario-atencion.ts` (`agruparHorariosPorDia`, `formatearIntervalos`).
  - UI: `/profesores?pagina=N` y `/profesores/[id]?pagina=N`. Route Handlers `GET /api/profesores` y `GET /api/profesores/[id]`.
- **Orden:** columnas `apellidoNormalizadoProfesor` / `nombreNormalizadoProfesor` (con `normalizarTexto()`, igual que Alumno en HU-B-04), más `dniProfesor` como desempate. Migración `20260923200000_profesor_nombre_normalizado_y_leer_permiso`, que también completa las filas existentes.
- **Permiso:** `profesores:leer`, exclusivo de Mesa de Entrada (migración + seed; coincide con `spec_modulo_A.md` §2.4 y con el changelog de esta spec). El Gerente no abre la ficha. El detalle muestra los accesos de edición de HU-D-02/03/04 solo con `profesores:editar`.
- **Entrada al modo edición (HU-D-06 AC1, HU-D-07 AC1):** con `profesores:editar`, el detalle `/profesores/[id]` muestra además el botón «Editar», que abre el modo edición de §2.6/§2.7 en esa misma pantalla, con el formulario precargado. Sin ese permiso el botón no se muestra (el Gerente no lo ve). Para precargar y para la concurrencia optimista, el detalle devuelve también `version` y, en cada materia asociada, `activa` (necesario para marcar las materias inactivas, ver §2.7); ambos campos son aditivos y no cambian el resto del contrato.
- **camelCase**, igual que HU-D-03/04. El detalle devuelve `{ ..., contacto: { telefono, email }, horarios: { LUNES: [{ horaInicio, horaFin }] } }`. Solo aparecen los días que tienen horarios.
- **Materias:** se ordenan por nombre normalizado. El listado muestra las 2 primeras y un contador (`"Física, Matemática +2"`); el detalle, todas.
- **Contrato para `spec_modulo_C.md` §2.7 (unificado en Revisión 2):** `listarOpcionesProfesoresActivos(): Promise<{ id: string; nombre: string; apellido: string; nombreParaMostrar: string }[]>`, expuesta desde `src/server/profesores/profesor.publico.ts` (2.8). Devuelve los activos con el mismo orden que el listado; `nombreParaMostrar` es `"Apellido, Nombre"`. Reemplaza a `listarProfesoresActivosOpciones()`, que ya no existe.

---

### 2.6. Modificar datos del profesor (HU-D-06) — NUEVA en Revisión 2

**Ruta:** `PATCH /api/profesores/[id]` (Route Handler en `src/app/api/profesores/[id]/route.ts`)
**Server Action equivalente:** `modificarProfesor()` en `src/server/profesores/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `modificarProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar` (exclusivo de Mesa de Entrada)
**Pantalla:** modo edición de la ficha `/profesores/[id]` (mapa de pantallas §1, "Ficha de profesor"): un único formulario con identidad, contacto y materias, con un solo botón "Guardar cambios". Página completa, banner inline. Mismo patrón que HU-B-06.
**Entrada (HU-D-06 AC1):** desde el detalle del profesor (2.5), con el botón «Editar» (solo con `profesores:editar`). Abre el mismo `/profesores/[id]` en modo edición, con el formulario **precargado** con la identidad y el contacto actuales, las materias actuales (2.7) y la `version` de la ficha.
**Cancelar (HU-D-06 AC4):** vuelve al detalle en modo lectura sin guardar. Si hay cambios sin guardar (en identidad, contacto o materias: el formulario es uno solo), pide confirmación antes de descartarlos; sin cambios, vuelve directo. Mismo patrón `DirtyStateContext` que el alta y que `spec_modulo_K.md` §2.4 y `spec_modulo_L.md` §2.4: el formulario marca el estado "sucio" en el contexto y el diálogo de confirmación protege también la navegación por menú, logo y links (`LinkProtegido`) y la recarga o cierre de la pestaña (`beforeunload`).

```typescript
// src/server/profesores/profesor.schema.ts
// Contacto al modificar: campo ausente = no se toca; null = quitar ese medio; string = nuevo valor.
// Cadena vacía o solo espacios NO significa «quitar»: se rechaza (la UI envía null cuando Mesa vacía un dato que tenía).
export const ContactoModificacionSchema = z.object({
  telefono: z.string().trim().min(1, "Ingresá un teléfono válido").nullable().optional(),
  email: z.string().trim().toLowerCase().min(1, "Ingresá un email válido").email("Ingresá un email válido").max(254).nullable().optional(),
});
export const ModificarProfesorSchema = IdentidadProfesorSchema.partial()
  .extend({
    ...ContactoModificacionSchema.shape, // sin «al menos uno»: se aplica en el servicio (paso 3)
    version: z.number().int().nonnegative(), // concurrencia optimista — obligatorio
  })
  .strict();
export type ModificarProfesorInput = z.infer<typeof ModificarProfesorSchema>;
```
`IdentidadProfesorSchema` se construye con `construirIdentidadProfesorSchema(parametros)` (largo del DNI desde `ParametroSistema`, igual que 2.1): identidad con las **mismas validaciones que el alta** (HU-D-06 AC1). Un `telefono` o `email` con valor recibe el mismo formato y la misma normalización que 2.2 (8-15 dígitos, email en minúsculas de hasta 254 caracteres). `.strict()` rechaza `is_active`, `usuario_id` y cualquier campo ajeno (AC5). La regla «al menos un medio de contacto» tiene la excepción del paso 3 (HU-D-06 AC1, ver N-2).

**Comportamiento esperado (`profesor.service.ts` → `modificarProfesor`), dentro de una única `prisma.$transaction`:**
1. El profesor debe existir: `404 PROFESOR_NO_ENCONTRADO`. Si ningún campo cambia respecto de los valores actuales: `200` con `campos_modificados: []` sin escribir.
2. Si viene `dni`: unicidad **excluyendo al propio profesor**, contra todos los demás, activos e inactivos: mismo código y criterio que 2.1 (`409 DNI_DUPLICADO`). Defensa del constraint (`P2002`) traducida al mismo `409`.
3. **Contacto — aprobado por el PO el 29/09/2026 (N-2).** Solo aplica si el request incluye `telefono` o `email` (con valor o `null`):
   - Si el request **no** incluye ninguno de los dos, no se valida contacto: un profesor dado de alta solo con identidad (2.1) puede corregir su DNI, nombre o apellido sin inventarle un medio de contacto.
   - Si incluye alguno, se arma el **estado resultante**: por cada medio, ausente = valor actual, `null` = vacío, string = valor nuevo (con el formato de 2.2).
   - **No puede quedar sin ningún medio:** si el profesor **ya tenía** al menos un medio y el estado resultante no tiene ninguno (p. ej. `{ "telefono": null }` cuando el email ya estaba vacío), se rechaza con `400` y el mensaje de 2.2 ("Ingresá al menos un teléfono o un email de contacto", campo `telefono`); la ficha no cambia. Modificar no puede dejarlo sin el último que tenía. Si no tenía ninguno y el request no agrega ninguno (p. ej. `email: null` sobre un email ya vacío), no es error ni cambio.
   - **Unicidad del email:** si `email` es un string distinto del actual, se valida con `verificarEmailNoAsociadoAOtraCuenta()`, igual que el alta (2.1) y 2.2 paso 2: `409 EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta"), sin revelar a quién pertenece. Un email sin cambios no se revalida.
4. Si cambian `nombre` o `apellido`: recalcular `nombreNormalizadoProfesor` y `apellidoNormalizadoProfesor` con `normalizarTexto()`. Mantiene el orden del listado (`profesores_orden_listado_idx`).
5. **Concurrencia optimista (Regla N.° 7):**
   ```typescript
   const r = await tx.profesor.updateMany({
     where: { idProfesor: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
   ```
6. Solo se escriben los campos enviados cuyo valor cambia (diff, AC3). Quitar un medio (`null`) deja la columna en `NULL` y cuenta en `campos_modificados`. `updatedAtProfesor` lo actualiza Prisma (`@updatedAt`).
7. **El email de contacto y el email de la cuenta de acceso son independientes** (3.1): cambiar el primero **no** modifica `Usuario.emailUsuario`. Es distinto de HU-B-06, donde el alumno con cuenta sí sincroniza ambos.

**Modelo (cambio en `schema.prisma`):** `Profesor` agrega `version Int @default(0)`. Migración aditiva.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["telefono", "email"], "version": 3 }, "error": null }
```
**Errores esperados:** `400` (validación, incluido «no puede quedar sin ningún medio de contacto») · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `409 DNI_DUPLICADO` · `409 EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta") · `409 CONFLICTO_EDICION_CONCURRENTE` ("La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.").

---

### 2.7. Modificar las materias asociadas a un profesor (HU-D-07) — NUEVA en Revisión 2

**Ruta:** `PUT /api/profesores/[id]/materias` (Route Handler en `src/app/api/profesores/[id]/materias/route.ts`)
**Server Action equivalente:** `actualizarMateriasProfesor()` en `src/server/profesores/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `actualizarMateriasDeProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar` (exclusivo de Mesa de Entrada)
**Pantalla:** dentro del mismo modo edición de 2.6: buscador + casillas de las materias activas, con las actuales marcadas (mismo selector de HU-D-03). Cancelar y la confirmación ante cambios sin guardar son las de 2.6 y alcanzan también a los cambios de materias. Las materias asociadas que estén inactivas se listan igual, marcadas (regla siguiente).

```typescript
export const ActualizarMateriasProfesorSchema = z.object({
  materia_ids: z.array(z.string().cuid()).max(100)
    .refine((ids) => new Set(ids).size === ids.length, "No repitas materias"),
}).strict(); // el CONJUNTO FINAL deseado; puede quedar vacío
```
Se envía el **conjunto final**, no altas y bajas sueltas: el servidor calcula la diferencia. Un profesor sin materias es un estado válido (2.4 ya lo contempla con un aviso, sin bloquear).

**Materias asociadas que están inactivas (HU-D-07 AC1):** el selector lista las materias activas **más todas las que el profesor ya tiene asociadas, aunque estén inactivas** (dato `activa` del detalle, 2.5). Las inactivas aparecen **tildadas y con la etiqueta «Inactiva»**, para que no se quiten por accidente al enviar el conjunto final; solo dejan de estar asociadas si Mesa de Entrada las destilda de forma explícita. Una materia inactiva que el profesor no tiene asociada no se ofrece. En el servidor, una inactiva que ya estaba asociada y sigue en el conjunto no está en `agregar`, así que no se revalida ni da `MATERIA_INACTIVA`; quitarla sigue la misma regla de turnos futuros que cualquier otra (paso 4). `MATERIA_INACTIVA` solo aplica a las materias que se intentan **agregar**.

**Comportamiento esperado (`profesor.service.ts` → `actualizarMateriasDeProfesor`), en una única `prisma.$transaction`, todo o nada (3.3):**
1. Tomar la fila del profesor: `updateMany` con `where: { idProfesor: id, activoProfesor: true }` que solo registra `modificadoPorUsuarioId`; bloquea la fila hasta el `COMMIT` (patrón de 2.3). `count === 0`: `404 PROFESOR_NO_ENCONTRADO` o `409 PROFESOR_INACTIVO`.
2. Leer el conjunto actual y calcular `agregar = deseado − actual` y `quitar = actual − deseado`. Si ambos están vacíos: `200` con `sin_cambios: true`.
3. **Agregar:** `bloquearMateriasParaAsociar(agregar, tx)` (`spec_modulo_L.md` §2.3): todas las de `agregar` deben existir y estar activas, con los mismos códigos y mensajes que 2.3 (`404 MATERIA_NO_ENCONTRADA` si algún id no existe; `409 MATERIA_INACTIVA` con `materia_ids_invalidas`). Insertar `ProfesorMateria` con `createdAtProfesorMateria` y `creadoPorUsuarioId`.
4. **Quitar (HU-D-07 AC3):** por cada materia a quitar, **en este orden**: (a) eliminar la fila `ProfesorMateria`; (b) invocar `contarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, tx)` (`spec_modulo_C.md` §2.15); (c) si `confirmados > 0`, acumular `{ materia_id, cantidad }`. Si al final hay al menos una materia con turnos futuros: lanzar `409 MATERIA_CON_TURNOS_FUTUROS` con el mensaje literal de la HU, **indicando cuántos**: "No se puede quitar: el profesor tiene N turnos futuros de esta materia" (N = `confirmados` de esa materia; redacción del backlog del 28/09), y `detalle: [{ materia_id, cantidad }]`; **toda la transacción se revierte**, la materia sigue asociada y no se quita ninguna.
   - **Presentación del rechazo (HU-D-07 AC3, backlog del 28/09):** (1) la **casilla de la materia bloqueada vuelve a quedar tildada**; el resto de los cambios del formulario queda **sin guardar** y se puede reintentar (el guardado es todo o nada). (2) **Debajo de esa materia** aparece el aviso corto "No se puede quitar: el profesor tiene N turnos futuros de esta materia" con el enlace **"Ver turnos"**. (3) "Ver turnos" abre un **modal** con el mensaje "El profesor tiene N turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar." (N = `total` de la ruta de «Lista de turnos futuros», más abajo) y la lista de turnos con **fecha, hora, aula, cupo ocupado (p. ej. 3/5) y estado**, **paginada de a 10**, que sale de esa misma ruta. (4) Cada turno enlaza a su Detalle de turno, que se abre **en una pestaña nueva** (`target="_blank"` con `rel="noopener"`) para no perder los cambios de la ficha; ahí Mesa de Entrada puede cancelarlo (HU-C-05). Resueltos todos, reintenta quitar la materia. Todo esto es interfaz: el servidor solo devuelve el `409` con `detalle`.
   - **De dónde sale la lista:** de la ruta propia `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n` (sección «Lista de turnos futuros para el modal», debajo de los errores de esta sección), que llama al servicio público de Turnos `listarTurnosFuturosDeProfesorPorMateria()` (`spec_modulo_C.md` §2.15). No se usa el listado `GET /api/turnos` (`spec_modulo_C.md` §2.7 no acepta filtros por materia ni por estado, HU-C-02 AC6). Los turnos **pasados o cancelados no bloquean** la desasociación.
   - **El orden (a) → (b) es deliberado:** el `DELETE` toma un bloqueo exclusivo sobre la fila; `profesorActivoDictaMateria(…, tx)` de Turnos toma `FOR SHARE` sobre esa misma fila (2.8). Si Mesa está creando un turno justo ahora, el `DELETE` espera a que confirme y el recuento posterior lo ve; si llega después, ya no encuentra la asociación y la rechaza. Es lo que impide dejar un turno futuro con un profesor que ya no dicta la materia (Regla N.° 7).
   - "Turno futuro" = `DISPONIBLE` o `COMPLETO` con `fecha + hora_inicio` posterior a ahora. Los turnos **pasados no bloquean**, y siguen mostrando esa materia (HU-D-07 AC3; el historial no se altera).
   - Los turnos `PENDIENTE` de ese profesor y materia **no bloquean** (la HU los excluye), pero pasarán a fallar con `PROFESOR_NO_DICTA_MATERIA` al confirmarse (`spec_modulo_C.md` §2.2). La respuesta informa cuántos hay (`pendientes_afectados`) para que la UI los avise (se mantiene por decisión del PO, 29/09/2026: aviso informativo fuera de los AC).
5. **No se toca el horario de atención (AC5, reformulado en el backlog v2):** `HorarioProfesor` no tiene `materiaId` (es un patrón semanal general del profesor), así que quitar una materia no afecta ni modifica ningún horario y no hay franjas huérfanas. AC5 no requiere trabajo adicional.
6. La baja del vínculo `ProfesorMateria` es un `DELETE` físico sobre una tabla de asociación: excepción documentada a la Regla N.° 1, igual que la baja de `TurnoAlumno` (`spec_modulo_C.md` §3.13). Se conserva la trazabilidad de las altas (`creadoPorUsuarioId`); la baja queda reflejada en `modificadoPorUsuarioId` del profesor.

**Respuesta `200 OK`:**
```json
{ "data": { "agregadas": ["cuid"], "quitadas": [], "pendientes_afectados": 0, "sin_cambios": false }, "error": null }
```
Si el conjunto enviado coincide con el actual (paso 2), la respuesta es `200` con `{ "agregadas": [], "quitadas": [], "pendientes_afectados": 0, "sin_cambios": true }`: no se escribe nada y equivale a no haber llamado a 2.7 (no muestra mensaje de éxito propio).

**Convención de nombres de campos:** el `POST` de §2.3 conserva los nombres del código de Sprint 1 (camelCase: `materiaIds`, `materiaIdsInvalidas`); los contratos nuevos de Sprint 2 (§2.6, §2.7 y la ruta de turnos futuros) usan snake_case (`materia_ids`, `materia_ids_invalidas`, `campos_modificados`, `pendientes_afectados`, `sin_cambios`), como el resto de los módulos nuevos. No se renombra el `POST` existente porque no es parte de estas HU.

**Errores esperados:** `400` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `404 MATERIA_NO_ENCONTRADA` (algún id de `agregar` no corresponde a ninguna materia, como en 2.3) · `409 PROFESOR_INACTIVO` · `409 MATERIA_INACTIVA` (con `materia_ids_invalidas`) · `409 MATERIA_CON_TURNOS_FUTUROS` (con `detalle: [{ materia_id, cantidad }]`).

#### Lista de turnos futuros para el modal «Ver turnos» (HU-D-07 AC3)

**Ruta:** `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n`
**Route Handler:** `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.ts`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarTurnosFuturosDeMateria()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:leer` (exclusivo de Mesa de Entrada, como el resto de la ficha)

```typescript
// src/server/profesores/profesor.schema.ts
export const ListarTurnosFuturosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
}).strict(); // por_pagina no es parámetro: es fijo, 10
```

**Comportamiento (`profesor.service.ts` → `listarTurnosFuturosDeMateria(profesorId, materiaId, pagina)`):**
1. El profesor debe existir: `404 PROFESOR_NO_ENCONTRADO`. La materia debe existir, activa o inactiva (`obtenerMateriasPorIds()`, `spec_modulo_L.md` §2.5): `404 MATERIA_NO_ENCONTRADA`.
2. Delegar en `listarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, { pagina, porPagina: 10 })` de `spec_modulo_C.md` §2.15 (servicio público de Turnos: este módulo nunca lee la tabla `turnos`, Regla N.° 3). Devuelve solo turnos `DISPONIBLE`/`COMPLETO` con `fecha + hora_inicio` posterior a ahora; los pasados, `CANCELADO` y `PENDIENTE` no aparecen. Orden cronológico ascendente (fecha y hora de inicio; a confirmar con C §2.15).
3. No exige que la materia siga asociada al profesor (tras el rechazo de 2.7 el vínculo se conservó, porque la transacción se revirtió); solo lectura, sin transacción.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "turno_id": "cuid", "fecha": "2026-10-06", "hora_inicio": "10:00", "hora_fin": "11:00", "aula": "Aula 2", "alumnos_inscriptos": "3/5", "estado": "DISPONIBLE" }
    ],
    "total": 12, "pagina": 1, "por_pagina": 10
  },
  "error": null
}
```
**Errores esperados:** `400` (`pagina` inválida o parámetro ajeno) · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `404 MATERIA_NO_ENCONTRADA`.

Cada fila enlaza, por su `turno_id`, al Detalle de turno (`spec_modulo_C.md` §2.4), que se abre en pestaña nueva.

**Guardado desde la UI:** el mapa de pantallas pide un solo "Guardar cambios" para toda la ficha, pero son dos endpoints (2.6 y 2.7). La UI llama **primero a 2.7** (la regla de negocio que más probablemente falle) y **después a 2.6**. Si 2.6 falla, las materias ya quedaron guardadas y el banner lo informa: no hay transacción entre los dos.

**Mensajes al guardar (HU-D-06 AC3, HU-D-07 AC4):**
| Caso | Llamadas | Mensaje |
|---|---|---|
| Cambiaron datos (con o sin materias) y todo salió bien | 2.7 (si hubo cambios de materias) y 2.6 | «Profesor actualizado correctamente» |
| Solo cambiaron las materias | 2.7 | «Materias asignadas correctamente» (el mismo del wizard de alta, HU-D-03) |
| 2.7 salió bien y 2.6 falló | 2.7 ok, 2.6 error | Banner: «Las materias se guardaron, pero los datos no: <error>» (el formulario conserva lo escrito y se reintenta solo 2.6) |
| 2.7 falló | 2.7 error | El error de 2.7 (p. ej. `MATERIA_CON_TURNOS_FUTUROS`); 2.6 no se llama |

**Mensaje de HU-D-07 AC4 (decisión del PO, 29/09/2026):** al guardar solo las materias desde la ficha se muestra «Materias asignadas correctamente», el mismo texto que el wizard de alta (HU-D-03, ya en Done, sin cambios de código). El AC cita el literal «Materias del profesor actualizadas» pero también pide que sea el «mismo mensaje que el de la asociación inicial»; los dos textos del backlog no coinciden y el PO resolvió unificar con el del wizard. Divergencia respecto del literal entrecomillado del AC, aceptada por el PO.


**Nota de sincronización (HU-D-07, implementada el 01/10/2026 — `docs/tasks/Sprint 2/HU-D-07.md` §11):**
- **Nombres reales (Regla N.° 11):** Server Action `actualizarMateriasProfesor(profesorId, materiaIds: string[])` en `src/server/profesores/actions.ts` (recibe el arreglo, no `FormData`: el conjunto vacío es válido); servicios `actualizarMateriasDeProfesor()` y `listarTurnosFuturosDeMateria()` en `profesor.service.ts`; schemas `ActualizarMateriasProfesorSchema` (`z.cuid()` de Zod 4) y `ListarTurnosFuturosQuerySchema` en `profesor.schema.ts`; `PUT` en `src/app/api/profesores/[id]/materias/route.ts`.
- **`version`:** el paso 1 **no** la incrementa. La UI guarda después 2.6 con la `version` precargada; si 2.7 la subiera, 2.6 daría un conflicto falso.
- **`409 MATERIA_CON_TURNOS_FUTUROS`:** con una sola materia, `message` es el literal de la HU con su N; con varias, un mensaje general, y la UI arma un aviso por materia con `detalle[].cantidad`.
- **Mensaje de AC4:** la implementación usa el literal del AC, «Materias del profesor actualizadas» (`?actualizada=materias`), que coincide con el mensaje de HU-D-03 fuera del wizard. **Pendiente de confirmación del PO** frente a la nota «Mensaje de HU-D-07 AC4» de arriba.
- **Pendiente (Regla N.° 2):** de las bajas solo queda `Profesor.modificadoPorUsuarioId`/`updatedAtProfesor`; no se registra qué materia se quitó. Sin tabla nueva hasta que se decida.

---

### 2.8. Servicios públicos del módulo

Conforme a la Regla N.° 3 (ampliados en Revisión 2). Funciones en `src/server/profesores/profesor.publico.ts`. **No importa nada de otros módulos** (evita ciclos con Turnos). El parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador.

**Qué puede importar `profesor.publico.ts` (precisión del 29/09/2026):** `@prisma/client` (solo tipos), `@/lib/prisma`, `@/server/shared/*`, `@/types/profesor.types` y, únicamente para **reexportar** o delegar en funciones existentes, el service de su propio módulo (`@/server/profesores/profesor.service`, siempre con el alias `@/`, Regla N.° 11). También puede importar **utilidades puras de `src/lib/`** (sin `prisma` ni imports de `src/server/**`): hoy `@/lib/profesor-listado` (formato «Apellido, Nombre») y `@/lib/horario-atencion` (formato de hora), para que el público y el service compartan un único formato. Nada de otros módulos de dominio; lo verifica `src/server/publico.aislamiento.test.ts`.

| Función | Devuelve | Consumidores |
|---|---|---|
| `listarOpcionesProfesoresActivos(db?)` | `{ id, nombre, apellido, nombreParaMostrar }[]`, orden `apellidoNormalizado, nombreNormalizado` (con el DNI como último desempate, igual que el service) (**unifica** la función de 2.5; ya no hay una segunda) | `spec_modulo_C.md` §2.7 (filtro del Gerente) |
| `obtenerHorariosDeAtencion(profesorId, db?)` | `{ horario_id, dia_semana, hora_inicio, hora_fin }[]`, orden día y hora. `dia_semana` es el valor del enum (`"LUNES"` … `"DOMINGO"`) y `hora_inicio` / `hora_fin` son `"HH:mm"` en 24 h con cero a la izquierda (formato confirmado el 29/09/2026) | `spec_modulo_C.md` §2.8, §2.9 |
| `obtenerHorarioDeProfesor(profesorId, horarioId, db?)` | la fila anterior, o `null` si no pertenece a ese profesor | `spec_modulo_C.md` §2.9 |
| `obtenerNombresProfesores(ids, db?)` | `Record<id, "Apellido, Nombre">` | `spec_modulo_E.md` §2.3 |
| `profesorActivoDictaMateria(profesorId, materiaId, db?)` | `boolean` (**existente**) | `spec_modulo_C.md` §2.1, §2.2, §2.8, §2.9 |

**Otros servicios públicos de este módulo que consumen otras specs** (documentados aquí por la Regla N.° 3; las firmas salen de lo que cada consumidor declara y hay que confirmarlas contra el código existente):

| Función | Devuelve | Consumidores | Origen |
|---|---|---|---|
| `listarProfesoresActivosPorMateria(materiaId, db?)` | `{ id, nombre, apellido }[]`, orden apellido, nombre e id. **Reexportada** desde el service (firma confirmada el 29/09/2026) | `spec_modulo_C.md` §2.2 paso 4, §2.6, §2.8.1 | existente (Sprint 1) |
| `estaDentroDeHorarioAtencion(profesorId, fecha, horaInicio, horaFin, db?)` | `boolean` (contrato completo en 2.4). **Reexportada** desde `profesor.service.ts` por `profesor.publico.ts` (29/09/2026) | `spec_modulo_C.md` §2.1, §2.2, §2.6, §2.11 | existente (HU-D-04) |
| `obtenerOpcionProfesorDeUsuario(usuarioId, db?)` | `{ id, nombreParaMostrar } \| null`: la opción de profesor de la ficha vinculada a la cuenta (`Profesor.usuarioId`), o `null` si no tiene ficha. **No filtra por activo** (forma confirmada el 29/09/2026) | `spec_modulo_C.md` §2.4, §2.7; `spec_modulo_E.md` §2.1, §2.2, §2.3; `spec_modulo_J.md` §2.1, §2.2 | nueva (Revisión 2) |
| `obtenerOpcionProfesorActivo(profesorId, db?)` | `{ id, nombreParaMostrar } \| null`: la opción de un profesor **activo**, o `null` (forma confirmada el 29/09/2026) | `spec_modulo_C.md` §2.1, §2.2; `spec_modulo_J.md` §2.1, §2.2 | nueva (Revisión 2) |
| `obtenerMateriasDelProfesor(profesorId, db?)` | `{ id, nombre, codigo: string \| null, activa: boolean }[]`: **todas** las materias asociadas, activas o inactivas, con el campo `activa`; quien la consume filtra (p. ej. el Profesor en `spec_modulo_J.md` §2.2 solo opera materias activas) | `spec_modulo_J.md` §2.2 (nota) | existente; publicada en `profesor.publico.ts` (29/09/2026) |

**Requisito nuevo sobre `profesorActivoDictaMateria`:** cuando recibe `db` (o sea, dentro de una transacción), debe leer la fila de `profesor_materia` con **`SELECT … FOR SHARE`**. Es la contraparte del bloqueo de 2.7 paso 4. Sin `db`, se comporta como hasta ahora. **Implementado el 29/09/2026** en `profesor.publico.ts`: el parámetro `db` no tiene valor por defecto (para distinguir «con `db`» de «sin `db`»); sin `db` delega en la versión del service, y con `db` reproduce sus mismas condiciones (profesor activo y relación con la materia) con `FOR SHARE OF` sobre `profesor_materia` únicamente, sin bloquear la fila del profesor.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/profesores/profesor.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Sin vínculo a cuenta de acceso en este sprint
Ningún servicio de este módulo crea, vincula ni modifica un `Usuario`. `Profesor.usuario_id` permanece `null` durante todo el sprint — su asignación, cuando exista, es responsabilidad de una HU futura fuera de esta spec.

### 3.2. Unicidad de DNI acotada a `Profesor`
Igual mecanismo que `spec_modulo_B.md` §3.4 (doble validación aplicativa + constraint `P2002`, contra activos e inactivos), pero sobre la tabla `Profesor` exclusivamente — no hay verificación cruzada contra `Alumno.dni`.

### 3.3. Asociación de materias: todo-o-nada ante revalidación
Si cualquier materia del lote de HU-D-03 dejó de estar activa entre la apertura del formulario y la confirmación, se aborta la operación completa dentro de la misma `$transaction` — nunca se guardan parcialmente las asociaciones que sí seguían siendo válidas.

### 3.4. Superposición de horarios con intervalos semiabiertos
La fórmula `a1 < b2 AND b1 < a2` (sección 2.4) es el único criterio válido de superposición en todo el proyecto para intervalos de horario — cualquier otro módulo que necesite esta misma validación (ej. `spec_modulo_C.md` al validar disponibilidad de aula/profesor) debe reutilizar la misma fórmula, no una aproximación distinta que trate los contiguos como superpuestos.

### 3.5. `HorarioProfesor` es un patrón recurrente, no un evento puntual
No tiene componente de fecha. Una consulta de disponibilidad contra este modelo siempre filtra por `dia_semana`, nunca por fecha calendario.

---

### 3.6. Quitar una materia exige que no queden turnos futuros que la dependan (Revisión 2)
El profesor no puede dejar de dictar una materia mientras tenga turnos futuros `DISPONIBLE` o `COMPLETO` de ella. La regla se resuelve en una sola transacción con un orden fijo (borrar el vínculo, después contar), y la consulta de turnos pertenece a Turnos (`contarTurnosFuturosDeProfesorPorMateria`): este módulo nunca lee la tabla `turnos` (Regla N.° 3). La lista del modal «Ver turnos» sale de `listarTurnosFuturosDeProfesorPorMateria` (`spec_modulo_C.md` §2.15) a través de la ruta propia de 2.7.

### 3.7. Modificar respeta las mismas reglas que el alta, sobre el estado resultante (Revisión 2)
Unicidad de DNI excluyendo al propio profesor. Contacto: mismo formato y misma unicidad de email que el alta (`409 EMAIL_YA_ASOCIADO`); un medio se quita con `null`; la exigencia de «al menos un medio» se aplica sobre el estado resultante solo si el request toca `telefono` o `email` y el profesor ya tenía alguno (2.6 paso 3, aprobado por el PO: N-2). La concurrencia optimista (`version`) se aplica igual que en `spec_modulo_B.md` §3.3.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

El módulo D usa la **opción (a)** de la Regla N.° 2 (columnas de auditoría en la propia entidad), porque la trazabilidad que necesita es la del ciclo de vida normal de la ficha (quién y cuándo la creó o modificó), sin eventos discretos repetibles sobre la misma entidad. Se persiste en la misma operación que la mutación. No usa la opción (b) ni existe tabla de eventos.

La tabla siguiente es **referencia histórica** de la versión previa de la Regla N.° 2 (event bus): esos eventos **no se emiten**.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `profesor:creado` | Alta (2.1) | `profesor_id, dni, usuario_registrante_id` |
| `profesor:contacto_actualizado` | Contacto (2.2) | `profesor_id, campos_modificados, usuario_id` |
| `profesor:materias_asociadas` | Asociación (2.3) | `profesor_id, materia_ids, usuario_id` |
| `profesor:horario_registrado` | Horario (2.4) | `profesor_id, dia_semana, hora_inicio, hora_fin, usuario_id` |

**Nota de sincronización (HU-D-03, resuelta): el módulo D usa la opción (a) de la Regla N.° 2 (columnas de auditoría).**
- Esta tabla se redactó cuando `RULES.md` exigía un event bus. La Regla N.° 2 vigente ya no lo pide. Los eventos de arriba quedan como referencia histórica y **no se emiten**.
- La trazabilidad se persiste en la propia fila, en la misma operación:
  - `Profesor`: `creadoPorUsuarioId` y `createdAtProfesor` (HU-D-01); `modificadoPorUsuarioId` y `updatedAtProfesor` (HU-D-02, HU-D-03).
  - `ProfesorMateria`: `creadoPorUsuarioId` y `createdAtProfesorMateria` (HU-D-03, migración `profesor_materia_auditoria`). Cada asociación es el alta de una fila, así que esas columnas registran qué se asoció, cuándo y quién.
  - `HorarioProfesor`: `creadoPorUsuarioId` y `createdAtHorario` (HU-D-04, columnas ya existentes en el schema). Cada intervalo es el alta de una fila.
- No existe tabla `EventoProfesor`.

**Revisión 2 (Sprint 2) — trazabilidad (Regla N.° 2).** HU-D-06 y HU-D-07 usan la **opción (a)**: `modificadoPorUsuarioId`, `updatedAtProfesor` y `version` en la fila de `Profesor`, y `createdAtProfesorMateria` / `creadoPorUsuarioId` en cada alta de `ProfesorMateria`. Sigue sin existir `EventoProfesor`.
```
