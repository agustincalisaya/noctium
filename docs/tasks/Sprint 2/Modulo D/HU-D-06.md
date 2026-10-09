# TASK: HU-D-06 — Modificar datos del profesor

**Módulo:** D (Profesor)
**Sprint:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` Revisión 2: §2.6 (contrato, incluido «Cancelar (HU-D-06 AC4)» y el paso 3 de contacto aprobado por el PO, N-2; **salvo** lo que §2.6 «Pantalla»/«Entrada» dice de las materias, ver §10 D-06-2), §2.5 (detalle con `version`, nota «Entrada al modo edición»), §3.2 y §3.7 (unicidad de DNI excluyendo la propia ficha), §3.1 (sin tocar `Usuario`), §4 (trazabilidad por columnas). También: §2.1 y §2.2 (reglas de validación del alta y del contacto, reutilizadas) · `docs/tasks/Sprint 2/HU-Sprint-2.md` HU-D-06 (criterios 1 a 5) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila "Ficha de profesor (`/profesores/[id]`) — HU-D-06: Modo edición del mismo detalle") · `docs/DESIGN.md` §6.2 (banner inline), §6.3 (`AlertDialog` de descarte) y §6.4 (fila "Alta/edición de … Profesor") · patrón de referencia: `docs/tasks/Sprint 1/HU-B-06.md` (alumno) y `docs/tasks/Sprint 2/HU-L-03.md` / `HU-K-03.md` (modo edición de ficha)
**Pantalla de referencia:** ficha de profesor en modo edición (pantallas de referencia Sprint 2). No está en el repo ni tiene número de mockup en `guia-pantallas-referencia-sprint-2.md` (ver §10, D-06-9). Si difiere de la spec o del mapa de pantallas, mandan la spec y el mapa. No se crea ninguna pantalla ni ruta fuera del mapa.
**RBAC:** `profesores:editar` y `profesores:leer`, **exclusivos de `MESA_ENTRADA`** (`prisma/seed.ts`, `PERMISOS` y `ACCIONES_SOLO_MESA_ENTRADA`; `rutas-por-rol.ts` restringe `/profesores` a `MESA_ENTRADA`). Ya existen: esta task no agrega permisos. El Gerente no modifica profesores (spec D, «R2-1 resuelto»).
**Schema:** **sin migración propia.** `Profesor.version Int @default(0)` ya lo trajo el paquete de Sprint 2 (`prisma/migrations/20260928150100_sprint2_modelo/migration.sql`, `ALTER TABLE "profesores" ADD COLUMN "version"`). `modificadoPorUsuarioId` y `updatedAtProfesor @updatedAt` existen desde HU-D-02. **No se modifican `prisma/schema.prisma` ni `prisma/seed.ts`.**

---

## 0. Relevamiento previo a implementación

Relevado el 29/09 sobre `develop` (`d1a05ea`, árbol limpio), leyendo `schema.prisma`, `RULES.md`, `DESIGN.md`, `seed.ts`, `spec_modulo_D.md` y el código de HU-D-01, HU-D-02, HU-D-05, HU-B-06, HU-L-03 y HU-K-03. **Esta task solo documenta; no se implementó nada.** Antes de escribir código, quien implemente confirma que nada de esto cambió y resuelve con el SM/PO los puntos de §10 marcados como bloqueantes.

> **Actualización 29/09 (implementación):** los bloqueantes de §10 quedaron resueltos (D-06-1, D-06-2 y D-06-5) y la HU se implementó según esta task. Mandan los criterios de aceptación de HU-D-06 por sobre la spec y el mapa de pantallas.

### 0.1. Qué existe hoy del módulo D (se reutiliza)

| Archivo | Qué tiene hoy (`develop`) | Uso en esta HU |
|---|---|---|
| `src/server/profesores/profesor.schema.ts` | `construirIdentidadProfesorSchema(min, max)` (nombre/apellido con `normalizarTextoNombre` + regex, DNI numérico con largo de `ParametroSistema`, `fechaNacimiento` no futura **y mayor de 18 años**, `genero` opcional); `construirAltaProfesorSchema()` (identidad + `campoOpcional(telefonoContactoSchema)` / `campoOpcional(emailContactoSchema)`); `ContactoProfesorSchema` (= `ContactoSchema`, exige al menos uno) | Se agrega `construirModificarProfesorSchema()` derivado de `construirIdentidadProfesorSchema()` (criterio 1: mismas validaciones) |
| `src/server/shared/contacto.schema.ts` | `telefonoContactoSchema`, `emailContactoSchema`, `campoOpcional()`, `ContactoSchema`, `MENSAJE_CONTACTO_REQUERIDO` | Se reutilizan `telefonoContactoSchema`, `emailContactoSchema` y `MENSAJE_CONTACTO_REQUERIDO`. **No** se usa `campoOpcional()` para contacto (convierte `""` en `undefined`; la spec pide `null` = quitar, ver 4.1). No se modifica |
| `src/server/profesores/profesor.service.ts` | `crearProfesor()` (DNI + email en `$transaction`, catch `P2002` sobre `dniProfesor`); helper **privado** `verificarEmailNoAsociadoAOtraCuenta(tx, email, usuarioIdPropio)`; `actualizarContactoProfesor()`; `obtenerDetalleProfesor()` (hoy **sin** `version`); `obtenerFichaProfesor()` | Se agrega `modificarProfesor()`; `obtenerDetalleProfesor()` suma `version` (aditivo, spec §2.5); se reutiliza `verificarEmailNoAsociadoAOtraCuenta()` (queda privado, mismo archivo) y `clavesOrdenProfesor()`; `actualizarContactoProfesor()` pasa a incrementar `version` en el mismo `UPDATE` (§10, D-06-5) |
| `src/lib/profesor-listado.ts` | `clavesOrdenProfesor({ nombre, apellido })` → `{ nombreNormalizadoProfesor, apellidoNormalizadoProfesor }` | Recalcular las claves de orden si cambian nombre o apellido (spec §2.6 paso 4, HU-D-05 §8.4) |
| `src/server/profesores/actions.ts` | Server Actions de HU-D-03/04 (`asociarMateriasProfesor`, `registrarHorarioProfesor`), ya en la ubicación de la Regla N.° 11 | Se agrega la Server Action `modificarProfesor()` **acá** |
| `src/app/(dashboard)/profesores/actions.ts` | `crearProfesor`, `verificarDniDisponible`, `actualizarContactoProfesor` (deuda de Regla N.° 11, HU-D-01-D-02 §9) | **No se toca** (no se mueve en esta HU; ver 1) |
| `src/types/profesor.types.ts` | `DetalleProfesor` (sin `version`), `MateriaDeProfesor` (con `activa`), `HorarioAtencion` | `DetalleProfesor` suma `version`; se agrega `ResultadoModificarProfesor` |
| `src/app/api/profesores/[id]/route.ts` | `GET` con `withPermission("profesores:leer")` | Se agrega `PATCH` con `withPermission("profesores:editar")`; el `GET` devuelve también `version` (aditivo) |
| `src/app/(dashboard)/profesores/[id]/page.tsx` | Detalle (HU-D-05): "Volver al listado" con `?pagina=`, `FichaEncabezado`, `FichaIdentidad`, `FichaContacto`, `FichaMaterias`, `FichaHorarios`; `puedeEditar = tienePermiso("profesores:editar")` | Pasa a tener modo consulta + modo edición (`?modo=edicion`) |
| `src/app/(dashboard)/profesores/[id]/ficha-identidad.tsx` | "Datos personales" (apellido, nombre, DNI, fecha de nacimiento en UTC, género con `ETIQUETA_GENERO`, estado, fecha de alta) | Referencia de etiquetas y formateo; no se modifica |
| `src/app/(dashboard)/profesores/[id]/ficha-contacto.tsx` | Sección contacto con link "Editar contacto"/"Cargar contacto" → `/profesores/[id]/contacto` (HU-D-02) | No se modifica (ver §10, D-06-5) |
| `src/app/(dashboard)/profesores/nuevo/nuevo-profesor-form.tsx` | Formulario de alta: labels, placeholder de teléfono "Ej.: (0387) 15-412-3456", `OPCIONES_GENERO`, `<input type="date" max={fechaMaximaNacimiento}>`, `enfocarPrimerCampoInvalido`, `verificarDniDisponible` en `onBlur` | Referencia de campos, textos y estilos de error (no se importa ni se modifica) |
| `src/app/(dashboard)/profesores/nuevo/page.tsx` | Calcula `dniLongitudMin/Max` (`getParametroNumerico`) y `fechaMaximaNacimiento = fechaUTCHaceAnios(18)` | Mismo cálculo en la página del modo edición |

**Reutilizables de HU-L-03 / HU-K-03 (ya mergeadas), sin modificarlos:**
- `src/lib/modo-edicion.ts` (`esModoEdicion`, `fueActualizada`, `rutaModoEdicion`, `rutaTrasGuardar`). Su comentario ya nombra a HU-D-06.
- `src/components/shared/breadcrumb.tsx` (`Breadcrumb` con `LinkProtegido`).
- `src/components/shared/confirmar-descarte-dialog.tsx` + `useDirtyState` (`src/components/sesion/dirty-state-context.tsx`).
- `Badge variant="warning"` ("Editando") en `src/components/ui/badge.tsx`.
- `exigirPermiso` / `tienePermiso` / `verificarPermiso` en `src/server/shared/with-permission.ts`.
- `ServiceError` (`src/server/shared/service-error.ts`).
- `src/app/(dashboard)/materias/[id]/editar-materia-form.tsx` y `page.tsx` como **plantilla de patrón** (no se importan).

**Reutilizable de HU-B-06, como patrón (no se importa nada del módulo B, Regla N.° 3):** `modificarAlumno()` en `src/server/alumnos/alumno.service.ts` (existencia → DNI con `NOT: { idAlumno }` → email → `updateMany` con `version` → `P2002`), `construirModificarAlumnoSchema()` en `alumno.schema.ts` (`.partial().extend({...}).strict()`, `genero` `.nullable()`), y la Server Action `modificarAlumno()` en `src/server/alumnos/actions.ts` (payload armado con `formData.has()`, `{ data, error }`).

### 0.2. Modelo relevado (`prisma/schema.prisma`, `model Profesor`)

- Identidad: `nombreProfesor`, `apellidoProfesor`, `nombreNormalizadoProfesor`, `apellidoNormalizadoProfesor` (NOT NULL, índice `profesores_orden_listado_idx`), `dniProfesor @unique`, `fechaNacimientoProfesor @db.Date`, `generoProfesor Genero?`.
- Contacto: `telefonoProfesor String?`, `emailProfesor String?`, `direccionProfesor String?` (la dirección **no** la edita ninguna HU del módulo, ver 1).
- Estado y cuenta: `activoProfesor`, `usuarioId String? @unique` (no se tocan).
- Auditoría y concurrencia: `creadoPorUsuarioId`, `createdAtProfesor`, `modificadoPorUsuarioId`, `updatedAtProfesor @updatedAt`, **`version Int @default(0)`**.
- Un `P2002` puede venir de `dniProfesor` o de `usuarioId`: solo el de `dniProfesor` se traduce a `DNI_DUPLICADO` (mismo filtro por `meta.target` que `crearProfesor()`).

### 0.3. Hallazgos que condicionan la implementación

1. **`version` no se incrementa en las otras escrituras sobre `Profesor`.** `actualizarContactoProfesor()` (HU-D-02), `asociarMateriasAProfesor()` (HU-D-03) y `registrarHorarioProfesor()` (HU-D-04) escriben `modificadoPorUsuarioId` pero no tocan `version`. Consecuencia: un cambio de contacto hecho desde `/profesores/[id]/contacto` mientras otra pestaña está en modo edición **no** lo detecta el control de concurrencia de esta HU, y el guardado posterior lo pisa. **Resuelto (§10, D-06-5):** `actualizarContactoProfesor()` incrementa `version` en el mismo `UPDATE` (misma transacción); materias y horario no escriben columnas que edite esta HU y siguen sin tocarla.
2. **`verificarDniDisponible()` no sirve para el modo edición:** exige `profesores:crear` y no excluye la propia ficha (con el DNI propio respondería "no disponible"). Esta HU **no** hace chequeo de DNI en `onBlur`; la unicidad se valida al guardar (igual que HU-B-06, que tampoco lo hace).
3. **La regla de mayoría de edad** (desviación de HU-D-01 aprobada por el usuario) forma parte de `construirIdentidadProfesorSchema()`, así que también aplica al modificar (criterio 1: "mismas validaciones que el alta").
4. **`--destructive-soft`** está en `DESIGN.md` pero no en `src/app/globals.css` (verificado el 29/09): los errores usan `text-destructive`, igual que HU-L-03/K-03.
5. **Ya no hay "Editar contacto" como única vía:** el modo edición cubre identidad y contacto (criterio 1); la pantalla de HU-D-02 sigue existiendo por su propio contrato (§2.2 de la spec).

### 0.4. Datos del seed útiles para probar (`prisma/seed.ts`)

Usuario de prueba: **mesa.entrada@noctium.local** / **Password123!**. Los teléfonos del seed se guardan normalizados (ej. `+54 11 5560-0002` → `+541155600002`). Los emails `profesor1..4@noctium.local`, `gerente@noctium.local`, `mesa.entrada@noctium.local` y `alumno01..06@noctium.local` son **emails de cuentas** (`usuarios`).

| Profesor (DNI) | Estado / cuenta | Contacto | Útil para |
|---|---|---|---|
| **Rossi, Martín** (28100002) | Activo, cuenta `profesor2@noctium.local` | tel + email (= su cuenta) | Caso base de edición; DNI duplicado; email de otra cuenta |
| **Giménez, Laura** (27100001) | Activo, cuenta `profesor1@noctium.local` | tel + email (= su cuenta) | DNI duplicado contra activo; conservar su propio email de cuenta (no es "otra cuenta") |
| **Vega, Carolina** (29100003) | Activo, cuenta | **solo email** | Quitar el único medio → rechazo «al menos uno» |
| **Acuña, Sergio** (30100004) | Activo, cuenta | **solo teléfono** | Agregar email; quitar teléfono y agregar email en el mismo guardado |
| **Molina, Héctor** (31100005) | **Inactivo**, sin cuenta | tel + email | DNI duplicado contra inactivo; edición de un inactivo (§10, D-06-7) |
| **Sosa, Ramiro** (32200016) | **Inactivo**, sin cuenta | solo tel | Segundo DNI inactivo |
| **Ibarra, Rocío** (32200013) | Activo, sin cuenta | **sin contacto** | Corregir identidad sin inventar contacto (paso 3, N-2); `email: null` sobre vacío |
| **Quiroga, Emilia** (32200014) | Activo, sin cuenta, **sin materias** | tel + email | Cambiar email a uno nuevo libre |
| **Pérez, Juan** (33300001 / 33300002) | Activos | solo tel | Cambio de apellido que mueve la fila en el listado (claves normalizadas) |
| **Avila, Pedro** (32200004) / **Ávila, Pedro** (32200009) | Activos | — | Cambiar solo el acento del propio apellido (no es duplicado: el nombre no es único) |
| **Castro, Julián** (32200011) | Activo, 4 materias, 8 intervalos de horario | tel + email | Verificar que editar datos **no** toca materias ni horarios (criterio 5) |

---

## 1. Nota de alcance

**Ruta: la edición es un modo de la misma ficha, `/profesores/[id]?modo=edicion`, no una ruta aparte.** Así lo definen `mapa-pantallas-sprint-2.md` §1 ("Ficha de profesor (`/profesores/[id]`) — HU-D-06 — Modo edición del mismo detalle"), `spec_modulo_D.md` §2.6 («Pantalla: modo edición de la ficha `/profesores/[id]` … Página completa, banner inline») y `src/lib/modo-edicion.ts`. **No** se crea `/profesores/[id]/editar`, aunque HU-B-06 (alumno, Sprint 1) sí haya usado una subruta.

**Entrada (criterio 1):** botón «Editar» en el detalle (HU-D-05), visible solo con `profesores:editar` (spec §2.5, nota «Entrada al modo edición»).

**Feedback:** página completa → banner inline "Profesor actualizado correctamente" (`DESIGN.md` §6.2 y tabla §6.4). Descarte con `ConfirmarDescarteDialog` (`AlertDialog`, §6.3). Colores **solo por token**. No se usan los toasts del wizard de alta (`src/components/ui/toast.tsx`): esos son del flujo de alta (spec §2.1).

**Relación con HU-D-07 (resuelto, §10 D-06-2):** mandan los criterios de aceptación de HU-D-06 por sobre la spec y el mapa de pantallas. El modo edición contiene **solo** identidad (HU-D-01) y contacto (HU-D-02), precargados y con las mismas validaciones que el alta (criterio 1). Las materias asociadas **no** forman parte del formulario: no se precargan, no se muestran como editables ni se envían al guardar (criterio 5). "Guardar cambios" llama **solo** al endpoint de §2.6. Lo que dicen la spec §2.5, §2.6 «Pantalla»/«Entrada», §2.7 y el mapa de pantallas (revisión 28/09) sobre integrar las materias en el mismo formulario (secuencia 2.7 → 2.6, tabla «Mensajes al guardar») **no aplica a esta HU** y queda pendiente para HU-D-07. Mientras tanto, las materias se siguen editando por `/profesores/[id]/materias` (HU-D-03).

**Diferencias backlog → spec (manda la spec, salvo lo marcado en §10):**
- Criterio 1 dice "mismas validaciones que el alta". La spec §2.6 paso 3 (N-2, aprobado por el PO el 29/09) precisa el contacto: `null` = quitar un medio; la regla «al menos un medio» se aplica sobre el estado resultante **solo si** el request toca teléfono o email **y** el profesor ya tenía alguno.
- Criterio 3 "se actualizan solo los campos modificados": la spec lo resuelve con diff en el servidor y `campos_modificados` en la respuesta; sin cambios → `200` con `campos_modificados: []`, sin escribir.
- Concurrencia optimista con `version` y `409 CONFLICTO_EDICION_CONCURRENTE`: no está en los criterios, la pide la spec §2.6 paso 5 (mismo patrón que HU-B-06).

**Fuera de alcance de esta task (explícito):**
- Modificar materias asociadas (criterio 5, **HU-D-07**). En modo edición no se muestra ninguna sección editable de materias.
- Modificar el horario de atención (criterio 5). Sigue en `/profesores/horarios/nuevo?profesorId=` (HU-D-04).
- Desactivar/reactivar al profesor (criterio 5, **HU-D-08, Sprint 3**). `.strict()` rechaza `activo`, `is_active`, `activoProfesor`.
- Cuenta de acceso (`Usuario`): cambiar el email de contacto **no** modifica `Usuario.emailUsuario` (spec §2.6 paso 7, §3.1). A diferencia de HU-B-06, **no** existe `EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE`.
- Dirección del profesor (`direccionProfesor`): ningún criterio de HU-D-01/D-02/D-06 la pide.
- Chequeo de DNI en `onBlur` (0.3 punto 2).
- Fila "Última modificación" en el detalle: no la pide ningún criterio y `version > 0` no la representaría bien (0.3 punto 1).
- Mover `crearProfesor` / `actualizarContactoProfesor` / `EstadoNuevoProfesor` a `src/server/profesores/` y `src/types/` (deuda de Regla N.° 11 de HU-D-01/D-02; refactor aparte).
- Evento `profesor:modificado` o tabla de auditoría (spec §4, Regla N.° 2 opción (a)).
- Cualquier cambio de schema, migración o seed.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** modificar los datos de identidad y contacto de un profesor
**Para** mantener actualizada su ficha

**Épica:** Gestionar profesores · **SP estimado:** 2 (fuente: planilla de historias de Sprint 2; `HU-Sprint-2.md` dice 1 SP, discrepancia anotada en §10, D-06-1)

**Criterios de aceptación** (`HU-Sprint-2.md`, literal):
1. Desde el detalle del profesor (HU-D-05) se abre un formulario precargado con identidad (HU-D-01) y contacto (HU-D-02), con las mismas validaciones que el alta.
2. Si se cambia el DNI, se valida unicidad contra profesores activos e inactivos, excluyendo la propia ficha (mismo criterio que HU-B-06 aplicó para alumno).
3. Al guardar se actualizan solo los campos modificados y se muestra "Profesor actualizado correctamente".
4. Cancelar vuelve al detalle sin guardar, con confirmación si hay cambios sin guardar.
5. Esta historia NO permite modificar las materias asociadas (HU-D-07) ni el horario de atención, ni desactivar al profesor (HU-D-08, Sprint 3).

**Justificación de secuencia:** depende de HU-D-01/HU-D-02/HU-D-05. Mismo patrón ya resuelto por HU-B-06 en Sprint 1 — bajo riesgo, se puede resolver temprano.

### 2.1. Criterios de aceptación y cómo se cumple cada uno

| # | Cómo se cumple | Archivos |
|---|---|---|
| 1 | Botón «Editar» en el detalle (con `profesores:editar`) → `/profesores/[id]?modo=edicion`. Formulario precargado con `obtenerDetalleProfesor()` (+ `version`). Schema `construirModificarProfesorSchema()` derivado de `construirIdentidadProfesorSchema()` + `telefonoContactoSchema` / `emailContactoSchema`, el mismo en cliente y servidor | `[id]/page.tsx`, `[id]/editar-profesor-form.tsx`, `profesor.schema.ts` |
| 2 | `modificarProfesor()`: `findFirst({ where: { dniProfesor, NOT: { idProfesor: id } } })` sin filtro de `activoProfesor` → `409 DNI_DUPLICADO`; defensa `P2002` sobre `dniProfesor` | `profesor.service.ts` |
| 3 | Diff en el cliente (solo viajan los campos cambiados, "Guardar cambios" deshabilitado sin cambios) **y** en el servidor (solo entran al `data` los campos cuyo valor cambia). Éxito → `router.replace(rutaTrasGuardar(...))` → banner "Profesor actualizado correctamente" | `editar-profesor-form.tsx`, `profesor.service.ts`, `[id]/page.tsx` |
| 4 | "Cancelar": sin cambios vuelve directo al modo consulta; con cambios abre `ConfirmarDescarteDialog`. `useDirtyState` protege breadcrumb, menú, logo, logout y cierre de pestaña | `editar-profesor-form.tsx` |
| 5 | El formulario no tiene materias (ni precargadas ni editables), horario ni estado; "Guardar cambios" solo llama a §2.6. `.strict()` rechaza cualquier clave ajena (`materiaIds`, `activo`, …); el servicio no toca `ProfesorMateria`, `HorarioProfesor` ni `activoProfesor` | `profesor.schema.ts`, `profesor.service.ts`, `editar-profesor-form.tsx` |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_D.md` §2.6:
- schema Zod `construirModificarProfesorSchema()`;
- service `modificarProfesor()` (diff, DNI excluyendo la propia ficha, contacto según N-2, email contra cuentas, claves de orden, `updateMany` con `version`, en **una sola transacción**);
- `obtenerDetalleProfesor()` con `version` (spec §2.5, aditivo);
- `actualizarContactoProfesor()` (HU-D-02) incrementa `version` en la misma transacción (§10, D-06-5);
- `PATCH /api/profesores/[id]`;
- Server Action `modificarProfesor()`;
- modo edición de la ficha `/profesores/[id]` (**solo** identidad + contacto, sin materias: §10 D-06-2), con botón «Editar», breadcrumb, banner de éxito y confirmación al cancelar.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/profesores/profesor.schema.ts`

```typescript
/**
 * Contacto al modificar (spec_modulo_D.md §2.6): ausente = no se toca;
 * null = quitar ese medio; string = nuevo valor con el formato de HU-D-02.
 * No se usa campoOpcional(): convierte "" en undefined ("no se toca") y acá
 * la UI manda null cuando Mesa vacía un dato que tenía. Un "" que llegue por
 * API se rechaza (spec §2.6, comentario del snippet).
 */
const telefonoModificacionSchema = telefonoContactoSchema.nullable().optional();
const emailModificacionSchema = emailContactoSchema.nullable().optional();

export function construirModificarProfesorSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadProfesorSchema(dniLongitudMin, dniLongitudMax)
    .partial()
    .extend({
      // Igual que HU-B-06: null = volver a "sin especificar" (ver §10, D-06-4).
      genero: z.enum(GENERO_VALORES).nullable().optional(),
      telefono: telefonoModificacionSchema, // sin «al menos uno»: lo aplica el servicio (N-2)
      email: emailModificacionSchema,
      version: z.number().int().nonnegative(), // concurrencia optimista — obligatorio
    })
    .strict();
}
export type ModificarProfesorInput = z.infer<ReturnType<typeof construirModificarProfesorSchema>>;
```

- `construirIdentidadProfesorSchema()` es un `z.object` sin refinements a nivel objeto, así que `.partial()` y `.extend()` son válidos en Zod v4 (el problema documentado en `contacto.schema.ts` es con `ContactoSchema`, que sí tiene `superRefine`).
- **Nombres de campos:** los de identidad son los del código real en camelCase (`nombre`, `apellido`, `dni`, `fechaNacimiento`, `genero`), no el `fecha_nacimiento` del snippet de la spec §2.6 (que parte de un `IdentidadProfesorSchema` que no existe con ese nombre). Ver §10, D-06-3.
- `telefonoContactoSchema` ya rechaza `""` (regex exige al menos un carácter válido) y `emailContactoSchema` también (`z.email`), así que una cadena vacía o con solo espacios da `400`, como pide la spec.
- `.strict()` rechaza `activo`, `is_active`, `usuarioId`, `direccion`, `materiaIds` y cualquier otro campo (criterio 5).
- En la Server Action, `version` llega como string del `FormData`: `Number(formData.get("version"))` antes del `safeParse`; `genero === ""` → `null`; `telefono`/`email` con `""` → `null` (la UI vació el campo), igual que la conversión de HU-B-06.
- Se exporta `GENERO_VALORES` si hace falta (hoy es `const` interna del archivo) o se define el `.extend` dentro del mismo archivo, que ya la tiene en scope.

### 4.2. Servicio

**Archivo:** `src/server/profesores/profesor.service.ts`
**Función:** `modificarProfesor(id: string, input: ModificarProfesorInput, usuarioId: string): Promise<{ id: string; campos_modificados: string[]; version: number }>`

Todo dentro de **una única** `prisma.$transaction(async (tx) => …)`:
1. **Existencia:** `tx.profesor.findUnique({ where: { idProfesor: id }, select: { usuarioId, nombreProfesor, apellidoProfesor, dniProfesor, fechaNacimientoProfesor, generoProfesor, telefonoProfesor, emailProfesor, version } })`. Si no existe → `ServiceError("PROFESOR_NO_ENCONTRADO", "El profesor no existe")`. Activo o inactivo: no se exige activo (spec §2.6 paso 1; ver §10, D-06-7).
2. **Diff (criterio 3):** comparar cada campo **presente** en `input` contra el valor actual (el input ya viene normalizado por Zod):
   - `nombre`/`apellido`: string exacto (un cambio solo de acento o mayúsculas **sí** es cambio).
   - `dni`: string.
   - `fechaNacimiento`: `getTime()` de las dos fechas `@db.Date` (medianoche UTC).
   - `genero`: `input.genero ?? null` contra `generoProfesor`.
   - `telefono`/`email`: `input.x ?? null` contra la columna.
   Si ningún campo cambia → devolver `{ id, campos_modificados: [], version: actual.version }` **sin escribir** ni incrementar `version` (spec §2.6 paso 1). Como el diff va antes del `updateMany`, un body sin cambios con `version` vieja también responde `200`.
3. **DNI (criterio 2)**, solo si cambió: `tx.profesor.findFirst({ where: { dniProfesor: input.dni, NOT: { idProfesor: id } }, select: { idProfesor: true } })`, **sin** filtro de `activoProfesor` → `ServiceError("DNI_DUPLICADO", "Ya existe un profesor registrado con ese DNI")` (mismo código y texto que el alta, spec §2.1/§3.2).
4. **Contacto (spec §2.6 paso 3, N-2)**, solo si `input` trae `telefono` o `email` (con valor o `null`):
   - Estado resultante por medio: ausente = valor actual, `null` = vacío, string = nuevo.
   - Si el profesor **tenía** al menos un medio y el resultante no tiene ninguno → `ServiceError("CONTACTO_REQUERIDO", MENSAJE_CONTACTO_REQUERIDO)`; la capa delgada lo devuelve como `400` de validación en el campo `telefono` (mismo mensaje y campo que §2.2). Si no tenía ninguno y sigue sin ninguno → no es error ni cambio.
   - Si `email` es un string **distinto** del actual → `verificarEmailNoAsociadoAOtraCuenta(tx, input.email, actual.usuarioId)` → `EMAIL_YA_ASOCIADO`. Un email sin cambios no se revalida. La cuenta propia del profesor queda excluida (Giménez puede conservar `profesor1@noctium.local`).
5. **Claves de orden:** si cambió `nombre` o `apellido`, recalcular con `clavesOrdenProfesor({ nombre: nuevoONombreActual, apellido: nuevoOApellidoActual })` (spec §2.6 paso 4, HU-D-05 §8.4). Las dos columnas se escriben juntas aunque cambie solo una.
6. **Concurrencia (Regla N.° 7, spec §2.6 paso 5):**
   ```typescript
   const r = await tx.profesor.updateMany({
     where: { idProfesor: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE",
     "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.");
   ```
   `updatedAtProfesor` lo actualiza Prisma (`@updatedAt`).
7. Devolver `{ id, campos_modificados, version: input.version + 1 }`. `campos_modificados` usa los nombres del payload (`"nombre"`, `"dni"`, `"fechaNacimiento"`, `"telefono"`, …); quitar un medio (`null`) cuenta como modificado.
8. **Errores fuera del callback:** `ServiceError` se relanza tal cual; `P2002` con `meta.target` que incluye `dniProfesor` → `DNI_DUPLICADO` (mismo filtro que `crearProfesor()`); cualquier otro error se propaga.
9. **Nunca** se escribe `Usuario`, `ProfesorMateria`, `HorarioProfesor`, `activoProfesor`, `usuarioId`, `direccionProfesor`, `creadoPorUsuarioId` ni `createdAtProfesor`.

`obtenerDetalleProfesor()` suma `version: true` al `select` y lo devuelve (aditivo; el `GET` y la página existentes no se rompen).

**Errores de servicio nuevos:** `CONFLICTO_EDICION_CONCURRENTE`, `CONTACTO_REQUERIDO`. Ya existentes: `PROFESOR_NO_ENCONTRADO`, `DNI_DUPLICADO`, `EMAIL_YA_ASOCIADO`.

### 4.3. Route Handler

`PATCH /api/profesores/[id]` en `src/app/api/profesores/[id]/route.ts` (el archivo ya existe con `GET`), protegido con `withPermission("profesores:editar")`, mismo esqueleto que el `PATCH` de `src/app/api/alumnos/[id]/route.ts` / `api/materias/[id]/route.ts`:
- Body no JSON → `400 BODY_INVALIDO`.
- `construirModificarProfesorSchema(min, max).safeParse(body)` (largo del DNI con `getParametroNumerico`) → `400 VALIDACION` con `flattenError` (incluye body sin `version` o con `activo`).
- `CONTACTO_REQUERIDO` → `400 VALIDACION` con `{ fieldErrors: { telefono: ["Ingresá al menos un teléfono o un email de contacto"] } }`.
- `404 PROFESOR_NO_ENCONTRADO`.
- `409 DNI_DUPLICADO` / `EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta") / `CONFLICTO_EDICION_CONCURRENTE`.
- `401` / `403 SIN_PERMISO` (lo resuelve `withPermission`).
- Error inesperado → `500 ERROR_INTERNO`, sin detalle técnico.
- Éxito → `200 { data: { id, campos_modificados, version }, error: null }`.

El `GET` existente agrega `version` a `data` (spec §2.5; campo aditivo).

### 4.4. Server Action

`modificarProfesor(profesorId: string, formData: FormData)` en **`src/server/profesores/actions.ts`** (Regla N.° 11; la spec dice "nombre a confirmar contra el código": se usa este). No va ligada a `useActionState`, así que devuelve `{ data, error }` (Regla N.° 5), igual que `modificarAlumno()` y `modificarMateria()`:
1. Arma el payload con `formData.has()` (ausente = no se modifica) + `version: Number(formData.get("version"))`; conversiones `"" → null` para `genero`, `telefono` y `email` (4.1).
2. Valida con `construirModificarProfesorSchema(min, max)` → `{ code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(...) }`.
3. `verificarPermiso("profesores:editar")`.
4. Invoca el service.
5. `revalidatePath("/profesores")` y `revalidatePath(`/profesores/${profesorId}`)`.
6. Traducción de errores con un `MENSAJES_POR_CODIGO` propio de esta action (mismos textos que `src/app/(dashboard)/profesores/actions.ts`, que no se importa desde `app/`):

| Código | `error.message` | Dónde lo pinta la UI |
|---|---|---|
| `VALIDACION` | "Datos inválidos" + `detalles` | Por campo |
| `CONTACTO_REQUERIDO` | "Ingresá al menos un teléfono o un email de contacto" | Campo Teléfono |
| `DNI_DUPLICADO` | "Ya existe un profesor registrado con ese DNI" | Campo DNI |
| `EMAIL_YA_ASOCIADO` | "Ese email ya está asociado a otra cuenta" | Campo Email |
| `CONFLICTO_EDICION_CONCURRENTE` | "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." | General + botón "Recargar" |
| `PROFESOR_NO_ENCONTRADO` | "El profesor ya no existe" | General |
| `PermisoError` | su propio mensaje | General |
| Otro | "No se pudo conectar. Intentá nuevamente" | General |

**Tipo** en `src/types/profesor.types.ts`:
```typescript
export type ResultadoModificarProfesor =
  | { data: { id: string; campos_modificados: string[]; version: number }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };
```
y `DetalleProfesor` suma `version: number`.

### 4.5. Trazabilidad

Opción (a) de la Regla N.° 2 (spec §4, Revisión 2): `modificadoPorUsuarioId`, `updatedAtProfesor` (automático) y `version` en el mismo `updateMany`. Sin evento ni tabla `EventoProfesor`. `createdAtProfesor` y `creadoPorUsuarioId` no cambian.

---

## 5. Frontend — ficha `/profesores/[id]` en modo edición

**Pantalla:** Ficha de profesor (`/profesores/[id]`), `mapa-pantallas-sprint-2.md` §1 y spec §2.6 («Pantalla»). Página completa, no modal. Mecanismo `?modo=edicion` de `src/lib/modo-edicion.ts`.

**`page.tsx` (Server Component):**
- `searchParams` pasa a `Promise<Record<string, string | string[] | undefined>>` (conserva `?pagina=` para "Volver al listado").
- Mantiene `exigirPermiso("profesores:leer")`. Con `?modo=edicion`: además `exigirPermiso("profesores:editar")` (redirige a `/sin-permiso`) antes de montar `<EditarProfesorForm key={profesor.version} … />`.
- En modo edición calcula `dniLongitudMin/Max` (`getParametroNumerico("dni_longitud_min", 7)` / `("dni_longitud_max", 8)`) y `fechaMaximaNacimiento = fechaUTCHaceAnios(18)` como `nuevo/page.tsx`, y los pasa como props.
- Breadcrumb "Profesores / Apellido, Nombre" (`Breadcrumb`, con `href` al listado respetando `?pagina=`), en los dos modos, reemplazando el link "Volver al listado" (mismo cambio que HU-L-03/K-03).

**Modo consulta** (HU-D-05, ampliado):
- botón **«Editar»** (`rutaModoEdicion(`/profesores/${id}`)`, `buttonVariants({ variant: "outline", size: "sm" })`) junto al encabezado, visible solo si `puedeEditar`. El texto «Editar» sale de la spec §2.5/§2.6 (HU-L-03/K-03 usan «Modificar»; ver §10, D-06-8);
- banner "Profesor actualizado correctamente" con `?actualizada=1`: `bg-success text-success-foreground`, `role="status"`, texto literal del criterio 3;
- el resto de las secciones (identidad, contacto, materias, horarios) sin cambios, incluidos los accesos de HU-D-02/03/04.

**Modo edición (`editar-profesor-form.tsx`, cliente, nuevo):** formulario propio (el de alta está atado al flujo de creación y al wizard), con los **mismos labels, placeholders, opciones de género y reglas Zod** que `nuevo-profesor-form.tsx`, precargado con los valores actuales.
- **Encabezado:** "Apellido, Nombre", `Badge variant="warning"` "Editando", "Cancelar" (outline) y "Guardar cambios" (primaria, única de la vista).
- **Tarjeta "Datos personales":** Nombre, Apellido, DNI, Fecha de nacimiento (`type="date"`, `max={fechaMaximaNacimiento}`, valor `YYYY-MM-DD` en UTC), Género (con opción vacía "Sin especificar" → `null`). Estado y fecha de alta en solo lectura (no son editables, criterio 5).
- **Tarjeta "Datos de contacto":** Teléfono (`type="tel"`, placeholder "Ej.: (0387) 15-412-3456") y Email (`type="email"`), sin asterisco. Texto guía: "Podés dejar uno vacío, pero no los dos si el profesor ya tenía alguno." (regla N-2).
- Estructura en dos tarjetas (`md:grid-cols-2`): "Datos personales" y "Datos de contacto". **Sin** tarjeta ni datos de materias (§10 D-06-2): una nota breve aclara que materias y horario se gestionan desde la ficha. Integrar las materias al formulario queda para HU-D-07.
- **Diff y "Guardar cambios":** deshabilitado mientras los valores normalizados coincidan con los guardados (nombre/apellido con `normalizarTextoNombre`, DNI `trim`, teléfono con `normalizarTelefono`, email `trim().toLowerCase()`, vacío = `null`) y mientras se procesa ("Guardando..."). Solo viajan en el `FormData` las claves que cambiaron, más `version` (mismo criterio que `editar-alumno-form.tsx` y `editar-materia-form.tsx`).
- **Validación en cliente:** `construirModificarProfesorSchema()` sobre el payload del diff; errores junto a cada campo con el patrón del alta (`text-destructive`, `role="alert"`, `aria-invalid`) y foco con `enfocarPrimerCampoInvalido()` (`src/lib/enfocar-primer-invalido.ts`). La regla «al menos uno» (N-2) también se anticipa en el cliente con los valores precargados, pero la fuente de verdad es el servicio.
- **Guardar:** llama **solo** a la Server Action de §2.6 (nunca a `PUT .../materias`). Éxito → `setDirty(false)` y `router.replace(rutaTrasGuardar(`/profesores/${id}`))`.
- **Errores del servidor:** según la tabla de 4.4. `CONFLICTO_EDICION_CONCURRENTE` muestra el mensaje general + botón "Recargar" (`router.refresh()`; el `key={version}` remonta con los datos actuales). Error de red → "No se pudo conectar. Intentá nuevamente". Ningún reintento automático.
- **Cancelar (criterio 4, spec §2.6 «Cancelar»):**
  - Sin cambios → vuelve a `/profesores/[id]` en modo consulta, sin diálogo ni request.
  - Con cambios → abre `ConfirmarDescarteDialog`. «Seguir editando» conserva lo tipeado; «Salir sin guardar» vuelve a modo consulta sin llamar a la API.
  - `useDirtyState` refleja `hayCambios`, así que breadcrumb, menú, logo, logout y cierre/recarga de pestaña también piden confirmación. Al desmontar, `setDirty(false)`.
  - Textos: los del componente existente («Cambios sin guardar» / «Hay datos sin guardar. ¿Salir de todas formas?» / «Seguir editando» / «Salir sin guardar»). La spec D no fija otros; no se modifica el componente.
- **Estilos:** solo tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `bg-success`, `Badge warning`). Prohibido hex y paleta default de Tailwind. Mismo contenedor responsive que el detalle (`max-w-3xl`, o `max-w-4xl` en edición como HU-L-03).

---

## 6. Plan de implementación paso a paso

1. **Confirmar relevamiento:** `git pull` de `develop`; verificar que `Profesor.version` existe en la base local (`npx prisma migrate status`) y que los archivos de 0.1 no cambiaron. Los bloqueantes de §10 (D-06-2 y D-06-5) ya están resueltos.
2. **Schema:** `construirModificarProfesorSchema()` + `ModificarProfesorInput` + tests de schema.
3. **Types:** `DetalleProfesor.version` y `ResultadoModificarProfesor`.
4. **Service:** `obtenerDetalleProfesor()` con `version`; `modificarProfesor()` según 4.2; `actualizarContactoProfesor()` con `version: { increment: 1 }` (D-06-5). Tests unitarios con `prisma` mockeado.
5. **Route Handler `PATCH`** (+ `version` en el `GET`) y **Server Action** en `src/server/profesores/actions.ts`.
6. **Frontend:** `page.tsx` (modos, breadcrumb, botón «Editar», banner) y `editar-profesor-form.tsx`.
7. **Verificación:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Re-correr el seed y ejecutar los casos de §7 (Postman + SQL + UI).
8. PR acotado a esta HU (git a cargo del responsable).

---

## 7. Testing (tres niveles)

**Runner:** Vitest (`npm test` → `vitest run`, alias `@` → `src`), ya instalado. Se corren **todos** los tests del repo.

### Nivel 1 — Unitarios (`src/server/profesores/profesor.modificar.test.ts`, nuevo)

`construirModificarProfesorSchema(7, 8)`:
- campo ausente → no aparece en el output; solo `version` → válido;
- nombre/apellido normalizados igual que el alta (espacios colapsados); `"Ana1"` y 1 carácter → error con el mensaje del alta;
- DNI `"12"`, `"123456789"`, `"12.345.678"` → error; fecha futura y menor de 18 años → error;
- `genero: null` → válido (`null`); `genero: "X"` → error;
- teléfono `"(0387) 15-412-3456"` → `"0387154123456"`; `null` → `null`; `""` y `"   "` → error; 7 dígitos → error;
- email `"  Ana@Mail.COM "` → `"ana@mail.com"`; `null` → `null`; `""` → error;
- sin `version`, `version: -1`, con `activo`, `usuarioId` o `materiaIds` → error.

`modificarProfesor` (con `prisma` mockeado, `$transaction` que invoca el callback con `tx`):
- solo teléfono → `updateMany` con `telefonoProfesor`, `version: { increment: 1 }`, `modificadoPorUsuarioId`, `where: { idProfesor, version }`; `campos_modificados: ["telefono"]`;
- solo apellido → escribe `apellidoProfesor` **y** las dos claves normalizadas;
- sin cambios (valores iguales a los actuales) → no llama a `updateMany`, `campos_modificados: []`, `version` igual;
- DNI a otro existente (activo y, en otro caso, inactivo) → `DNI_DUPLICADO`, `findFirst` con `NOT: { idProfesor }`; DNI igual al propio → no consulta duplicados;
- `P2002` sobre `dniProfesor` → `DNI_DUPLICADO`; `P2002` sobre `usuarioId` → se propaga;
- `telefono: null` con email vacío en la ficha → `CONTACTO_REQUERIDO`, sin `updateMany`;
- profesor sin contacto + solo DNI → OK sin validar contacto; `email: null` sobre email ya vacío → no es cambio;
- email nuevo de otra cuenta → `EMAIL_YA_ASOCIADO` (consulta con `NOT: { idUsuario: usuarioIdPropio }` si tiene cuenta, sin `NOT` si no); email sin cambios → no consulta `usuario`;
- `updateMany` con `count: 0` → `CONFLICTO_EDICION_CONCURRENTE`;
- profesor inexistente → `PROFESOR_NO_ENCONTRADO`; profesor inactivo → editable;
- nunca llama a `tx.usuario.update*`, `tx.profesorMateria.*` ni `tx.horarioProfesor.*`.

Concurrencia con HU-D-02 (D-06-5), sobre una fila en memoria que respeta `version`:
- `actualizarContactoProfesor()` incluye `version: { increment: 1 }` en su `UPDATE`;
- pestaña 1 abre el modo edición con `v`; pestaña 2 cambia el contacto por `/contacto` (`version` pasa a `v+1`); pestaña 1 guarda con `v` → `CONFLICTO_EDICION_CONCURRENTE` y el contacto de la pestaña 2 queda intacto.

Server Action (`src/server/profesores/actions.test.ts` o en el mismo archivo, con service y permiso mockeados): payload armado solo con las claves presentes; `""` → `null` en `genero`/`telefono`/`email`; `VALIDACION` sin llamar al service; traducción de cada código de la tabla 4.4.

### Nivel 2 — Postman y Nivel 3 — BD / TablePlus: casos con datos del seed

Precondición: `npx prisma db seed` recién corrido; sesión de **mesa.entrada@noctium.local** salvo que se indique. `v` = `version` actual del profesor (leerla con `GET /api/profesores/:id`, que ahora la devuelve). Ids: leerlos del listado o de `SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '…'`.

| # | Caso | Datos | Acción | Resultado esperado (API/UI) | Verificación en BD |
|---|---|---|---|---|---|
| CP-01 | **Precarga (criterio 1)** | Rossi | Detalle → «Editar» | Abre `/profesores/:id?modo=edicion`, badge "Editando", campos con Rossi, Martín, 28100002, 25/07/1982, Masculino, `+541155600002`, `profesor2@noctium.local`; "Guardar cambios" deshabilitado | — |
| CP-02 | Un solo campo | Rossi | `{ "telefono": "(0387) 15-412-3456", "version": v }` | `200`, `campos_modificados: ["telefono"]`, `version: v+1`; UI: banner "Profesor actualizado correctamente" | `telefonoProfesor = '0387154123456'`; `modificadoPorUsuarioId` = id de mesa.entrada; `updatedAtProfesor` avanzó; `createdAtProfesor`, `creadoPorUsuarioId`, `activoProfesor`, `usuarioId` sin cambios |
| CP-03 | **DNI duplicado contra activo (criterio 2)** | Rossi | `{ "dni": "27100001", "version": v }` (Giménez) | `409 DNI_DUPLICADO` "Ya existe un profesor registrado con ese DNI"; UI: error bajo DNI | Rossi sin cambios, misma `version` |
| CP-04 | **DNI duplicado contra inactivo** | Rossi | `dni: "31100005"` (Molina) y luego `"32200016"` (Sosa) | `409 DNI_DUPLICADO` en ambos | Sin cambios |
| CP-05 | DNI igual al propio | Rossi | `{ "dni": "28100002", "version": v }` | `200`, `campos_modificados: []` (no se autorrechaza ni escribe) | `version` igual |
| CP-06 | DNI nuevo libre | Rossi | `dni: "28100099"` | `200`, `["dni"]` | `dniProfesor = '28100099'` |
| CP-07 | **Quitar el único medio (N-2)** | Vega (solo email) | `{ "email": null, "version": v }` | `400 VALIDACION`, `telefono`: "Ingresá al menos un teléfono o un email de contacto"; UI: error bajo Teléfono | `emailProfesor` sigue `profesor3@noctium.local` |
| CP-08 | Reemplazar un medio por otro | Acuña (solo teléfono) | `{ "telefono": null, "email": "sergio.acuna@example.com", "version": v }` | `200`, `["telefono","email"]` | tel `NULL`, email nuevo |
| CP-09 | **Profesor sin contacto: corregir identidad** | Ibarra (sin contacto) | `{ "nombre": "Rocio", "version": v }` | `200`, `["nombre"]` (no exige contacto) | `nombreNormalizadoProfesor = 'rocio'` |
| CP-09b | `null` sobre medio vacío | Ibarra | `{ "email": null, "version": v }` | `200`, `campos_modificados: []` | `version` igual |
| CP-10 | **Email de otra cuenta** | Rossi | `email: "profesor1@noctium.local"` y luego `"GERENTE@Noctium.Local"` | `409 EMAIL_YA_ASOCIADO` "Ese email ya está asociado a otra cuenta", sin decir de quién | Sin cambios |
| CP-11 | Email de la propia cuenta | Giménez | `email: "PROFESOR1@noctium.local"` | `200`, `campos_modificados: []` (queda igual tras normalizar) | Sin cambios |
| CP-12 | Email de contacto nuevo con cuenta vinculada | Rossi | `email: "martin.rossi@example.com"` | `200`, `["email"]` | `emailProfesor` nuevo; **`usuarios.emailUsuario` de Rossi sigue `profesor2@noctium.local`** (spec §2.6 paso 7) |
| CP-13 | **Cambio de apellido → orden del listado** | Pérez (33300002) | `apellido: "Zapata"` | `200` | `apellidoNormalizadoProfesor = 'zapata'`; en `/profesores` pasa al final de la página 2 |
| CP-13b | Solo acento del propio apellido | Avila (32200004) | `apellido: "Ávila"` | `200`, `["apellido"]` (el nombre no es único) | `apellidoNormalizadoProfesor` sigue `'avila'` |
| CP-14 | **Concurrencia** | Quiroga, dos pestañas en modo edición con la misma `v` | Pestaña 1 guarda teléfono; pestaña 2 guarda nombre | Pestaña 2: `409 CONFLICTO_EDICION_CONCURRENTE` + botón "Recargar" (remonta con el teléfono nuevo). Postman: mismo `version` dos veces con cambios → el segundo 409 | Solo el cambio de la pestaña 1; `version` +1 una vez |
| CP-14b | **Concurrencia con el contacto de HU-D-02 (D-06-5)** | Rossi | Pestaña 1: «Editar» (modo edición, `v`). Pestaña 2: "Editar contacto" (`/profesores/:id/contacto`) → cambiar el teléfono y guardar. Pestaña 1: cambiar el email y "Guardar cambios". Postman: `PATCH .../contacto` y luego `PATCH /api/profesores/:id` con la `v` previa | Pestaña 1: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." + "Recargar" (remonta con el teléfono de la pestaña 2). Postman: `409 CONFLICTO_EDICION_CONCURRENTE` | Teléfono = el de la pestaña 2; email sin cambios; `version = v+1` (lo subió solo HU-D-02) |
| CP-15 | **No toca materias ni horarios (criterio 5)** | Castro | Cambiar teléfono | `200` | `profesor_materia` de Castro: 4 filas, sin cambios; `horarios_profesor`: 8 filas, sin cambios |
| CP-16 | **Validaciones iguales al alta (criterio 1)** | Rossi | `nombre: "A"`, `"Ana1"`; `dni: "12"`; `fechaNacimiento` futura y de hace 10 años; `telefono: "123-4567"`; `email: "ana@"`; `telefono: ""` | `400 VALIDACION` con los mismos mensajes del alta; UI: error junto al campo y foco al primero | Sin cambios |
| CP-17 | Campos fuera de alcance | Rossi | body con `activo: false`, `materiaIds: [...]`, `direccion` o sin `version`. UI: el modo edición no muestra materias ni horario | `400 VALIDACION` | `activoProfesor` sigue `true`; `profesor_materia` sin cambios |
| CP-18 | **Cancelar sin cambios (criterio 4)** | Rossi en edición | "Cancelar" | Vuelve a consulta sin diálogo ni request | — |
| CP-19 | **Cancelar con cambios** | Rossi en edición, cambiar el email | "Cancelar" → "Seguir editando" (conserva) → "Cancelar" → "Salir sin guardar". Repetir con el breadcrumb, con el menú y recargando la pestaña | `ConfirmarDescarteDialog` en los tres primeros; diálogo nativo en la recarga; al confirmar vuelve a consulta | Email sin cambios, `version` igual |
| CP-20 | Sin cambios reales | Rossi | UI: dejar valores o agregar espacios al nombre. Postman: body idéntico | UI: "Guardar cambios" deshabilitado. API: `200`, `[]` | `version` igual |
| CP-21 | Género a "sin especificar" | Castro | `genero: null` | `200`, `["genero"]` | `generoProfesor` `NULL` |
| CP-22 | Permisos | gerente@noctium.local | `PATCH /api/profesores/:id`; abrir `/profesores/:id?modo=edicion` | `403 SIN_PERMISO`; UI redirige a `/sin-permiso` (ya no tiene `profesores:leer`); sin sesión → `401` / `/login` | Sin cambios |
| CP-23 | Profesor inexistente | cuid inventado | `PATCH` | `404 PROFESOR_NO_ENCONTRADO` | — |
| CP-24 | Profesor inactivo (ver §10, D-06-7) | Molina | `telefono: "+54 11 5560-9999"` | `200` (spec §2.6 paso 1 solo exige existencia) | Tel nuevo; `activoProfesor` sigue `false` |

**Consultas SQL de apoyo (Nivel 3, solo lectura):**
```sql
SELECT "idProfesor", "nombreProfesor", "apellidoProfesor", "apellidoNormalizadoProfesor", "dniProfesor",
       "telefonoProfesor", "emailProfesor", "generoProfesor", "version",
       "modificadoPorUsuarioId", "updatedAtProfesor", "activoProfesor", "usuarioId"
FROM profesores WHERE "dniProfesor" IN ('28100002', '29100003', '30100004', '32200013');

SELECT "emailUsuario" FROM usuarios WHERE "idUsuario" = (SELECT "usuarioId" FROM profesores WHERE "dniProfesor" = '28100002');

SELECT COUNT(*) FROM profesor_materia WHERE "profesorId" = (SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '32200011');
SELECT COUNT(*) FROM horarios_profesor WHERE "profesorId" = (SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '32200011');
```

**Evidencia esperada:** Postman y SQL de los CP; capturas de la ficha en: modo consulta con «Editar», edición sin cambios (Guardar deshabilitado), errores de validación, DNI duplicado, «al menos uno», email de otra cuenta, guardando, confirmación de Cancelar, conflicto de versión con "Recargar" (entre dos modos edición y contra `/contacto`), y banner de éxito.

---

## 8. Dependencias

| Dependencia | Estado al 29/09 |
|---|---|
| HU-D-01 / HU-D-02 / HU-D-05 (alta, contacto, listado y detalle) | ✅ Implementadas (Sprint 1), incluido el ajuste de alta con contacto |
| `Profesor.version` (paquete Sprint 2, `20260928150100_sprint2_modelo`) | ✅ En `develop` (migración y `schema.prisma`) |
| Permisos `profesores:editar` / `profesores:leer` para Mesa de Entrada | ✅ En `seed.ts` |
| Modo edición, breadcrumb, badge `warning`, `ConfirmarDescarteDialog`, `DirtyStateContext` (HU-L-03 / HU-K-03) | ✅ En `develop` |
| HU-D-07 (materias en el mismo formulario) | ⏳ No bloquea esta HU ni condiciona su formulario: integrar las materias queda para HU-D-07 (§10, D-06-2) |
| Token `--destructive-soft` en `globals.css` | ⏳ Deuda de diseño, no bloquea |
| Pantalla de referencia de la ficha de profesor en edición | ⏳ No está en el repo (§10, D-06-9) |

---

## 9. Checklist de Definition of Done

- [x] Relevamiento (§0) confirmado contra `develop` y dudas bloqueantes de §10 resueltas.
- [x] Sin migración, sin cambios en `schema.prisma` ni `seed.ts`.
- [x] `construirModificarProfesorSchema()` derivado de `construirIdentidadProfesorSchema()` + schemas de contacto compartidos; `version` obligatoria y `.strict()`.
- [x] `modificarProfesor()`: diff, DNI excluyendo la propia ficha (activos e inactivos, aplicativa + `P2002`), contacto según N-2, email contra cuentas (sin tocar `Usuario`), claves de orden recalculadas, `updateMany` con `version`; todo en una transacción, sin escritura si no hay cambios.
- [x] `actualizarContactoProfesor()` incrementa `version` en la misma transacción (D-06-5).
- [x] `obtenerDetalleProfesor()` y `GET /api/profesores/[id]` devuelven `version`.
- [x] `PATCH /api/profesores/[id]` y Server Action `modificarProfesor()` (en `src/server/profesores/actions.ts`) delgados, `{ data, error }`.
- [x] Ficha con `?modo=edicion`, botón «Editar» solo con `profesores:editar`, breadcrumb, "Editando", Guardar deshabilitado sin cambios, errores por campo, "Recargar" ante conflicto, banner "Profesor actualizado correctamente".
- [x] Cancelar con `ConfirmarDescarteDialog` y `DirtyStateContext` (criterio 4). Sin materias (ni precargadas ni enviadas), horario ni estado editables (criterio 5).
- [x] Solo tokens de `DESIGN.md`. Ningún `DELETE` físico.
- [ ] Nivel 1 en verde; `tsc --noEmit`, `npm run lint` y `npm run build` limpios. (29/09: Nivel 1, `tsc` y `lint` en verde; falta correr `npm run build`.)
- [ ] Niveles 2 y 3 (CP-01 a CP-24) con evidencia y capturas de UI.
- [ ] PR con el diff acotado a esta HU.

---

## 10. Dudas / datos faltantes

Puntos donde la spec, el backlog y el código no coinciden, o falta un dato. **No se resolvieron por inferencia**; la propuesta de cada uno es la que usa esta task mientras no haya respuesta.

- ✅ **D-06-1 — SP (RESUELTO 29/09).** La HU vale **2 SP** (fuente: planilla de historias de Sprint 2); corregido en §2. **Discrepancia pendiente:** `docs/tasks/Sprint 2/HU-Sprint-2.md` (índice y ficha de HU-D-06) sigue diciendo **1 SP**; no se modifica desde esta task, queda para que lo corrija el SM.
- ✅ **D-06-2 — Materias dentro del mismo formulario (RESUELTO 29/09).** Mandan los criterios de aceptación de HU-D-06 por sobre la spec y el mapa de pantallas. El modo edición contiene **solo** identidad (HU-D-01) y contacto (HU-D-02), precargados y con las mismas validaciones que el alta (criterio 1). Las materias asociadas **no** forman parte del formulario: no se precargan, no se muestran como editables ni se envían al guardar (criterio 5). "Guardar cambios" llama solo al endpoint de §2.6. Para esta HU se ignora lo que dicen la spec §2.5 (nota «Entrada al modo edición», en lo que toca a materias), §2.6 «Pantalla»/«Entrada», §2.7 («Pantalla», «Guardado desde la UI», «Mensajes al guardar») y el mapa de pantallas (revisión 28/09) sobre integrar las materias en el mismo formulario. **Pendiente para HU-D-07:** sumar la sección de materias al modo edición, la secuencia de guardado 2.7 → 2.6, la tabla «Mensajes al guardar» y la confirmación de Cancelar sobre cambios de materias. Hasta entonces, las materias se editan por `/profesores/[id]/materias` (HU-D-03).
- **D-06-3 — Nombres de campos del payload (no bloquea).** El snippet de la spec §2.6 parte de `IdentidadProfesorSchema` (que en el código es `construirIdentidadProfesorSchema()`) y usa `fecha_nacimiento`; el código real usa camelCase (`fechaNacimiento`). La spec pide snake_case para los contratos nuevos de Sprint 2 (`campos_modificados`). Propuesta: identidad en camelCase (el schema real, reutilizado tal cual) y respuesta `{ id, campos_modificados, version }` como la spec. Confirmar y, si se acepta, anotar la nota de sincronización en la spec §2.6.
- **D-06-4 — Volver el género a "sin especificar" (no bloquea).** La spec §2.6 no dice si se puede; con `.partial()` puro, `genero` solo admite ausente o un valor. HU-B-06 (patrón que cita el criterio 2) sí lo permite con `.nullable()`. Propuesta: permitirlo (`genero: null`), como alumno. Confirmar con el PO.
- ✅ **D-06-5 — Concurrencia frente a las otras escrituras del módulo (RESUELTO 29/09, opción (a)).** `actualizarContactoProfesor()` (pantalla `/profesores/[id]/contacto`, HU-D-02) incrementa `Profesor.version` en el mismo `UPDATE`, dentro de la misma transacción en que modifica el contacto (sin cambiar su contrato ni su respuesta). Así, si otra pestaña tiene la ficha en modo edición, el `PATCH` de HU-D-06 (`updateMany` con `version`) detecta el conflicto y muestra "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." + "Recargar" en lugar de pisar el cambio. Cubierto en Nivel 1 (bloque «concurrencia con el cambio de contacto de HU-D-02») y en CP-14b. `asociarMateriasAProfesor()` y `registrarHorarioProfesor()` no escriben columnas que edite esta HU y siguen sin tocar `version`. La spec §2.2 no menciona `version`: conviene anotarlo ahí en la próxima revisión.
- **D-06-6 — Código del rechazo «al menos un medio» (no bloquea).** La spec §2.6 paso 3 dice "`400` con el mensaje de 2.2, campo `telefono`" pero no da código. Propuesta: el servicio lanza `CONTACTO_REQUERIDO` y la capa delgada lo expone como `400 VALIDACION` con `fieldErrors.telefono`, para que la UI lo pinte igual que un error de Zod.
- **D-06-7 — Editar un profesor inactivo (no bloquea).** La spec §2.6 paso 1 solo exige que exista (no hay `PROFESOR_INACTIVO` en §2.6, a diferencia de §2.3/§2.7), y el detalle muestra inactivos. Propuesta: permitido, mismo criterio que el aula inactiva en HU-K-03 (Q-K3-5) y la materia en HU-L-03. Si el PO quiere bloquearlo, es un cambio de spec (nuevo error).
- **D-06-8 — Texto del botón de entrada (no bloquea).** La spec D §2.5/§2.6 dice «Editar»; las fichas de materia y aula (HU-L-03/K-03) usan «Modificar». Propuesta: «Editar», literal de la spec. Confirmar si el equipo prefiere unificar.
- **D-06-9 — Pantalla de referencia (no bloquea).** `guia-pantallas-referencia-sprint-2.md` no numera ni adjunta la pantalla "Ficha de profesor — edición" (HU-L-03 y HU-K-03 citan los mockups 20 y 21, tampoco en el repo). La pantalla sigue la spec §2.6, el mapa y el patrón de HU-L-03. Si el mockup muestra otra distribución (p. ej. la tarjeta de materias ya presente), se consulta al PO.
- **D-06-10 — Mensaje de DNI duplicado (no bloquea).** HU-B-06 distingue el texto cuando el duplicado es una ficha inactiva ("…(ficha inactiva)"); la spec D §2.1/§2.6 usa un único texto. Propuesta: el texto único de la spec ("Ya existe un profesor registrado con ese DNI"), igual que el alta de profesor.
- **D-06-11 — Nota del backlog sobre `profesores:crear` (informativo).** `HU-Sprint-2.md` (nota del 28/09 bajo HU-D-07) dice que `profesores:crear` "sigue siendo exclusivo del Gerente"; `seed.ts` (`ACCIONES_SOLO_MESA_ENTRADA`) y la spec D (R2-1) lo tienen como exclusivo de Mesa de Entrada. No afecta a esta HU (usa `profesores:editar`), pero conviene que el SM corrija la nota del backlog.
