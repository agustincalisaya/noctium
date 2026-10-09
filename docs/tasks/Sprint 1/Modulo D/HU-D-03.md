# TASK: HU-D-03 — Asociar profesor a materias o especialidades

**Módulo:** D (Profesor)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` §2.3 · reglas §3.3 · eventos §4 (ver §1 punto 3 de esta task) · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-D-03, criterios de aceptación 1-6
**RBAC:** sin cambios. Se reutiliza `profesores:editar`, que ya existe en `RolPermiso` y es exclusivo de `GERENTE` (lo agregó HU-D-02). `rutas-por-rol.ts` ya restringe `/profesores/**` a `GERENTE`.
**Schema:** `model ProfesorMateria` ya existe (migración `init_sprint1`, PK compuesta `@@id([profesorId, materiaId])`, FKs `ON DELETE CASCADE`). Esta task agrega **una migración** con columnas de auditoría (§1 punto 3). `prisma/seed.ts` ya precarga asociaciones para los 5 profesores.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Los puntos marcados como **"relevar antes de asumir"** en esta task, con la pregunta concreta.
- Cualquier contradicción entre esta task y el código real, especialmente en los nombres reales de las columnas de `materias` y `profesor_materia` (§4.0 y §4.2) y en la existencia previa de `src/server/profesores/actions.ts` (§1 punto 1).

Antes del relevamiento, leé las guías relevantes de `node_modules/next/dist/docs/` (Server Actions, Route Handlers con `params` async, `revalidatePath`), como exige `AGENTS.md`.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

Un relevamiento previo del repo (`develop`, árbol limpio) encontró divergencias entre `spec_modulo_D.md` §2.3, `docs/RULES.md` y el código real. Las decisiones ya están tomadas y se documentan acá para que no se vuelvan a relevar.

1. **DECISIÓN RESUELTA — ubicación de los archivos nuevos: manda `RULES.md` Regla 11, no la spec.**
   - La spec dice `app/(dashboard)/profesores/actions.ts` y `lib/services/profesores/*`. `RULES.md` (normativo; la nota de historial de la Regla 4 corrige justamente la ruta `lib/services/`) exige, en la Regla 11:
     - `src/server/profesores/actions.ts` para la Server Action;
     - `src/server/profesores/profesor.service.ts` para el servicio;
     - `src/types/profesor.types.ts` para los tipos.
   - El código nuevo de esta HU sigue la Regla 11, con importaciones solo vía alias (`@/server/...`, `@/types/...`).
   - Las actions y tipos existentes de HU-D-01/D-02 (`src/app/(dashboard)/profesores/actions.ts` y `profesor.types.ts`) **no se mueven en esta task**. Quedan como deuda técnica, que se resuelve en un refactor propio.
   - Si `src/server/profesores/actions.ts` ya existe, se agrega ahí; si no, se crea con `"use server"`.

2. **DECISIÓN RESUELTA — nomenclatura camelCase, igual que HU-D-01/D-02.**
   - La spec usa `materia_ids`, `profesor_id`, `is_active`, `@@unique([profesor_id, materia_id])` y `z.string().cuid()`. En el código real:
     - los campos son camelCase con sufijo (`activoProfesor`, `activaMateria`);
     - la unicidad es `@@id([profesorId, materiaId])`;
     - HU-D-01 ya usa camelCase en el payload (`fechaNacimiento`, no `fecha_nacimiento`);
     - Zod 4 depreca `z.string().cuid()` en favor de `z.cuid()`.
   - El contrato de esta task usa `materiaIds`, `profesorId`, `materiasAsociadas` y `materiaIdsInvalidas`. Se anota en la spec como nota de sincronización (§4.8).

3. **DECISIÓN RESUELTA — trazabilidad (Regla 2): opción (a), columnas de auditoría.**
   - La spec §4 lista el evento `profesor:materias_asociadas`, redactado cuando `RULES.md` exigía un event bus. La Regla 2 vigente ya no lo pide: deja elegir entre (a) columnas en la propia entidad y (b) tabla de eventos por dominio.
   - Se elige **(a)**, que es el patrón por defecto cuando la trazabilidad es la del ciclo de vida normal del registro. Cada asociación es el alta de una fila, así que su `createdAt` y su `creadoPorUsuarioId` registran exactamente qué se asoció, cuándo y quién. Es el mismo criterio que ya usa el módulo D (`creadoPorUsuarioId` en HU-D-01, `modificadoPorUsuarioId` en HU-D-02).
   - Migración nueva sobre `ProfesorMateria`:
     - `createdAtProfesorMateria DateTime @default(now())`
     - `creadoPorUsuarioId String?`: escalar sin `@relation`, igual que en `Profesor` y `Materia`. Es nullable porque las filas del seed y las preexistentes no tienen autor.
   - Además, el `updateMany` del paso 1 del servicio (§4.4) setea `Profesor.modificadoPorUsuarioId` y actualiza `updatedAtProfesor`.
   - La trazabilidad se persiste en la misma operación (Regla 2, caso a). **No** se crea tabla `EventoProfesor` ni se emite evento.
   - La spec D pasa a declarar explícitamente que el módulo D usa la opción (a) (§4.8).

4. **DECISIÓN RESUELTA — atomicidad (Regla 7) sin romper el aislamiento (Regla 3).**
   - La spec pide revalidar dentro de la transacción que el profesor siga activo y que todas las materias del lote sigan activas. Un `SELECT` seguido de un `createMany` deja una ventana de carrera bajo `READ COMMITTED`.
   - **Profesor** (tabla propia): `tx.profesor.updateMany({ where: { idProfesor, activoProfesor: true }, data: { modificadoPorUsuarioId } })`. Es el patrón literal de la Regla 7: condición y mutación en una sentencia, y la fila queda bloqueada hasta el commit.
   - **Materias** (tabla de otro módulo): profesores **no** puede leerlas ni mutarlas directamente (Regla 3), y un `updateMany` sobre `materias` sería mutar datos ajenos. Por eso, el módulo L expone una función pública nueva que hace `SELECT … FOR SHARE` sobre las materias pedidas y recibe el `tx` (§4.2). El bloqueo compartido impide que otra transacción cambie `activaMateria` de esas filas hasta el commit, así que el chequeo "todas activas" sigue siendo verdadero en el momento del `INSERT`.

5. **DECISIÓN RESUELTA — duplicados: 409, sin `skipDuplicates`.**
   - La spec §2.3 pide `409 MATERIA_YA_ASOCIADA`.
   - El `createMany` de la HU **no** usa `skipDuplicates`, que queda solo en el seed.
   - La red de seguridad ante dos confirmaciones simultáneas es el `P2002` sobre la PK compuesta, traducido al mismo código.

6. **DECISIÓN RESUELTA — códigos que la spec no define.** La spec no contempla estos casos; se fijan así:

   | Caso | Status | Código |
   |---|---|---|
   | Profesor inexistente | `404` | `PROFESOR_NO_ENCONTRADO` (ya existe en el mapa de mensajes de D-02) |
   | Profesor inactivo | `409` | `PROFESOR_INACTIVO` (conflicto con el estado del recurso, mismo criterio que `MATERIA_INACTIVA`) |
   | Algún id no corresponde a ninguna materia | `404` | `MATERIA_NO_ENCONTRADA` |

7. **DECISIÓN RESUELTA — `ServiceError` con detalles.**
   - `MATERIA_INACTIVA` y `MATERIA_YA_ASOCIADA` necesitan transportar qué materias fallaron.
   - Se agrega a `ServiceError` un tercer parámetro opcional `detalles?: Record<string, unknown>` (readonly). Es retrocompatible: no rompe ningún `new ServiceError(code, message)` existente.

8. **DECISIÓN RESUELTA — materias asociadas en la ficha: función nueva, no se toca `obtenerFichaProfesor()`.**
   - Se crea `obtenerMateriasDelProfesor(profesorId)` en `profesor.service.ts`.
   - HU-D-05 (misma responsable) la reutilizará para el detalle.

9. **DECISIÓN RESUELTA — selector sin dependencias nuevas.**
   - No existe combobox ni multiselect en el repo. Se construye con checkboxes nativos y un input de filtro.
   - El filtro usa `normalizarTexto()` de `src/lib/normalizar-texto.ts`: es función pura, sin imports, usable desde cliente, y es la que corresponde para comparar sin mayúsculas ni acentos.
   - No se instala nada ni se usan primitivas de `@base-ui/react` no probadas en el repo.

10. **Relevar antes de asumir — cambio en el módulo L (Materias, de Cali).**
    - §4.2 agrega una función pública a `src/server/materias/materia.service.ts`. Es aditiva: no modifica ninguna función existente.
    - Claude Code **no** la toca más allá de lo indicado. La responsable de la HU confirma con Cali antes del merge (checklist §7), y la función se documenta en `spec_modulo_L.md` como revisión aditiva (§4.8).

11. **DECISIÓN RESUELTA — sección "Materias" de la ficha: `FichaSeccion` + `<ul>`, sin `FichaDatos`.**
    - `FichaDatos` es una grilla de pares etiqueta/valor (`<dl>` en dos columnas, un valor ausente se muestra como "—"). Sirve para contacto, pero no para una lista de materias de largo variable.
    - La sección usa solo `FichaSeccion` (título, acción opcional, contenido) con una lista `<ul>` de materias. Mantiene el mismo contenedor visual que las demás secciones sin forzar un componente pensado para otra forma de dato.

12. **DECISIÓN RESUELTA — materias asociadas que hoy están inactivas: se muestran con su estado.**
    - Problema: la pantalla de asociación arma la lista con `listarMateriasActivas()`. Una materia asociada que después se dio de baja no aparecería, y el gerente no vería que el profesor ya la tiene.
    - `obtenerMateriasDelProfesor()` devuelve **todas** las asociadas, con `activa: boolean` (§4.4 A). `MateriaDeProfesor` incluye ese campo (§4.6).
    - **Ficha:** se muestran todas. Las inactivas llevan un `Badge` "Inactiva" (texto, no solo color).
    - **Formulario:** la lista es la unión de las materias activas (`listarMateriasActivas()`) y las asociadas inactivas. Toda asociada va marcada y `disabled`; las inactivas muestran "Asociada · Inactiva". El filtro aplica a todas. Las inactivas **no** asociadas no se muestran.
    - Razonamiento: el criterio 2 pide que las ya asociadas "se identifiquen claramente". Ocultar una asociación existente solo porque la materia se dio de baja haría que la ficha y el formulario no reflejen lo que realmente está en `profesor_materia`. Mostrarla deshabilitada no permite ninguna acción nueva sobre ella (quitar asociaciones sigue fuera de alcance).
    - `asociarMateriasAProfesor()` no cambia: solo devuelve materias recién asociadas, que siempre están activas.

**Dependencias de esta implementación:**
- **Depende de:**
  - HU-D-01: entidad `Profesor` y ficha.
  - HU-L-01: catálogo de `Materia`.
  - Código de HU-D-02 (`actualizarContactoProfesor`, permiso `profesores:editar`, ficha con `FichaSeccion`), como patrón y base. No hay documento de task de HU-D-02; toda referencia a D-02 en esta task es al código.
- **Es requisito de:** HU-C-04 (Emir), que consume `profesorActivoDictaMateria()` sin cambios.
- **No depende de:**
  - HU-D-04 (horarios);
  - HU-D-05 (listado y detalle): la sección de materias y `obtenerMateriasDelProfesor()` se construyen sin ella, y HU-D-05 las reutiliza después.

**Fuera de alcance de esta task (explícito):**
- Quitar o reemplazar materias asociadas (Sprint 2, "Modificar materias asociadas al profesor"). Por eso esta task no tiene ningún `DELETE` ni `deleteMany` sobre `profesor_materia`.
- Niveles o grados de especialización por materia.
- Tabla `EventoProfesor` o emisión de eventos de dominio (ver punto 3).
- Mover las actions y tipos existentes de HU-D-01/D-02 a `src/server` y `src/types` (ver punto 1).
- Contenido real de `/profesores` (listado) y detalle completo, con horarios, del profesor (HU-D-05).
- Validación de disponibilidad del profesor en turnos: es de HU-C-04 (Emir), que consume `profesorActivoDictaMateria()` sin cambios.
- Test runner: sigue pendiente de decisión de equipo (igual que en HU-D-01 §6).
- El comentario incorrecto sobre `PROFESOR` en el permiso `materias:leer` (módulo L). Se reporta a Cali, pero no se toca.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** asociar un profesor con una o más materias
**Para** ofrecerle turnos únicamente de las materias que puede dictar

**SP estimado:** 2

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_D.md` §2.3 y §3.3, con las correcciones del §1. Incluye:
- Migración de auditoría sobre `profesor_materia` (§4.0).
- Función pública `bloquearMateriasParaAsociar()` en el módulo L (§4.2).
- Extensión retrocompatible de `ServiceError` (§4.3).
- Schema Zod `AsociarMateriasProfesorSchema` (§4.1).
- Servicios `asociarMateriasAProfesor()` y `obtenerMateriasDelProfesor()` (§4.4).
- Route Handler `POST /api/profesores/[id]/materias` (§4.5).
- Server Action `asociarMateriasProfesor()` y tipos de estado (§4.6).
- UI: sección "Materias" en la ficha y pantalla `/profesores/[id]/materias` (§5).
- Revisión aditiva de `spec_modulo_D.md` y `spec_modulo_L.md` (§4.8).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Ningún `DELETE`, `delete` ni `deleteMany` sobre `profesor_materia`: quitar o reemplazar materias asociadas es de Sprint 2.
- Modificar `profesorActivoDictaMateria()` (contrato con HU-C-04) u `obtenerFichaProfesor()`.
- Modificar funciones existentes de `src/server/materias/materia.service.ts`. Solo se agrega `bloquearMateriasParaAsociar()`.
- Mover o refactorizar las actions y tipos de HU-D-01/D-02 que viven en `src/app/(dashboard)/profesores/`.
- Crear la tabla `EventoProfesor` o emitir eventos de dominio.
- Usar `skipDuplicates` en el `createMany` de la HU.
- Instalar dependencias, instalar un test runner o tocar `package.json`.
- Corregir el comentario sobre `PROFESOR` en el permiso `materias:leer` (se reporta a Cali).
- Contenido del listado `/profesores`, detalle completo del profesor o niveles de especialización por materia.

Contexto y razones de cada ítem: ver §1.

---

## 4. Contrato Backend

### 4.0. Migración

```prisma
model ProfesorMateria {
  profesorId String
  materiaId  String

  // Auditoría (Regla 2, opción a) — HU-D-03. Escalar sin @relation, igual que Profesor/Materia.
  createdAtProfesorMateria DateTime @default(now())
  creadoPorUsuarioId       String?

  // relaciones existentes sin cambios
  @@id([profesorId, materiaId])
  @@map("profesor_materia")
}
```

`npx prisma migrate dev --name profesor_materia_auditoria`. Verificar que las filas existentes quedan con `createdAt = now()` y `creadoPorUsuarioId = NULL`, sin errores. El seed no necesita cambios obligatorios (sigue con `skipDuplicates`).

### 4.1. Schema Zod

**Archivo:** `src/server/profesores/profesor.schema.ts` (se agrega; no se modifica lo existente)

```typescript
export const AsociarMateriasProfesorSchema = z.object({
  materiaIds: z
    .array(z.cuid("Materia inválida"))
    .min(1, "Seleccioná al menos una materia nueva")   // criterio 3
    .transform((ids) => [...new Set(ids)]),              // dedupe defensivo
});
export type AsociarMateriasProfesorInput = z.infer<typeof AsociarMateriasProfesorSchema>;

export const ProfesorIdSchema = z.cuid();
```

El archivo se importa desde Client Components, así que no puede tener imports de valor de `@prisma/client` (misma restricción documentada en HU-D-01 §4.5).

### 4.2. Servicio público del módulo L

**Archivo:** `src/server/materias/materia.service.ts`. Es aditivo: no se modifica ninguna función existente.

```typescript
/**
 * Consulta pública (Regla 3) para HU-D-03. Bloquea con FOR SHARE las materias
 * pedidas dentro de la transacción del llamador, para que su estado activo no
 * cambie hasta el commit (Regla 7). Devuelve solo las que existen.
 */
export async function bloquearMateriasParaAsociar(
  ids: string[],
  tx: Prisma.TransactionClient,
): Promise<{ id: string; nombre: string; codigo: string | null; activa: boolean }[]>
```

- Implementación con `tx.$queryRaw` parametrizado, **nunca** concatenado (RNF-SEG-07): `SELECT … FROM materias WHERE "idMateria" = ANY(${ids}) FOR SHARE`.
- **Relevar antes de asumir:** los nombres reales de las columnas (`"idMateria"`, `"nombreMateria"`, `"codigoMateria"`, `"activaMateria"`) se confirman en la migración `init_sprint1` / `sprint1_modelo_completo`, no se infieren del schema.
- Mapear el resultado a `{ id, nombre, codigo, activa }`.

### 4.3. `ServiceError`

**Archivo:** `src/server/shared/service-error.ts`

```typescript
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly detalles?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "ServiceError";
  }
}
```

### 4.4. Servicios del módulo D

**Archivo:** `src/server/profesores/profesor.service.ts`

**A) `obtenerMateriasDelProfesor(profesorId: string): Promise<MateriaDeProfesor[]>`** (`{ id, nombre, codigo, activa }`)
- Lee `ProfesorMateria` del profesor con `include`/`select` de su materia, ordenado por nombre. Devuelve **todas** las asociadas, activas e inactivas, con `activa` (§1 punto 12). Es lectura sobre la tabla propia del módulo D; la relación a `Materia` es la misma que ya usan HU-L-02 y el seed.

**B) `asociarMateriasAProfesor(profesorId: string, materiaIds: string[], usuarioId: string): Promise<{ id: string; nombre: string; codigo: string | null }[]>`**

Todo dentro de un único `prisma.$transaction(async (tx) => …)`, todo-o-nada (spec §3.3), en el orden de la spec §2.3:

1. **Profesor activo, atómico (Regla 7):** `tx.profesor.updateMany({ where: { idProfesor: profesorId, activoProfesor: true }, data: { modificadoPorUsuarioId: usuarioId } })`. Si `count === 0`, un `findUnique` distingue entre lanzar `PROFESOR_NO_ENCONTRADO` y `PROFESOR_INACTIVO`.
2. **Duplicados (spec paso 2, criterio 2):** `tx.profesorMateria.findMany({ where: { profesorId, materiaId: { in: materiaIds } } })`. Si hay alguna, lanzar `ServiceError("MATERIA_YA_ASOCIADA", …, { materias: [{ id, nombre }] })`.
3. **Revalidación de materias (spec paso 3, criterio 4):** `bloquearMateriasParaAsociar(materiaIds, tx)`.
   - Si falta algún id en el resultado, lanzar `MATERIA_NO_ENCONTRADA`.
   - Si alguna viene con `activa === false`, lanzar `ServiceError("MATERIA_INACTIVA", …, { materias: [{ id, nombre }] })` con **todas** las inactivas del lote.
   - La transacción aborta y no se guarda ninguna asociación, ni siquiera las válidas.
4. **Insert (spec paso 4, criterio 5):** `tx.profesorMateria.createMany({ data: materiaIds.map((materiaId) => ({ profesorId, materiaId, creadoPorUsuarioId: usuarioId })) })`, **sin** `skipDuplicates`.
5. `try/catch` alrededor del `$transaction`: un `P2002` sobre la PK compuesta se traduce a `MATERIA_YA_ASOCIADA`.
6. Retorna `{ id, nombre, codigo }` de las materias recién asociadas, tomados del resultado del paso 3.

El paso 5 de la spec (emitir evento) no aplica: ver §1 punto 3.

**No se modifica** `profesorActivoDictaMateria()`: es el contrato que consume HU-C-04 (Emir). Criterio 6: las asociaciones creadas acá son las que esa función lee.

### 4.5. Route Handler

**Archivo:** `src/app/api/profesores/[id]/materias/route.ts` (nuevo)
**Método:** `POST` · **Permiso:** `withPermission("profesores:editar")` · `params` async (Next 16)

Flujo:
1. `ProfesorIdSchema.safeParse(id)` y `AsociarMateriasProfesorSchema.safeParse(body)`. Si cualquiera falla, `400` con el `flatten()` de Zod (Regla 6).
2. Llamar al servicio con el id de usuario de la sesión (`req.auth!.user.id`).
3. Traducir el resultado según la tabla.

| Resultado | Status | Cuerpo |
|---|---|---|
| Éxito | `201` | `{ data: { profesorId, materiasAsociadas: [ids] }, error: null }` (shape de la spec §2.3) |
| `PROFESOR_NO_ENCONTRADO` / `MATERIA_NO_ENCONTRADA` | `404` | `{ data: null, error: { code, message } }` |
| `PROFESOR_INACTIVO` | `409` | ídem |
| `MATERIA_YA_ASOCIADA` | `409` | ídem + `materiaIdsInvalidas` |
| `MATERIA_INACTIVA` | `409` | `{ data: null, error: { code, message: "La materia 'Física' ya no está activa", materiaIdsInvalidas: [...] } }`, con un mensaje que nombra cada materia (spec §2.3) |
| Sin sesión / sin permiso | `401` / `403` | lo resuelve `withPermission` |

### 4.6. Server Action y tipos

**Tipos:** `src/types/profesor.types.ts` (nuevo, Regla 11)

```typescript
export type MateriaDeProfesor = { id: string; nombre: string; codigo: string | null; activa: boolean };

export type EstadoAsociarMaterias =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "materias_inactivas"; materias: { id: string; nombre: string }[] }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; asociadas: MateriaDeProfesor[] };

export const ESTADO_INICIAL_ASOCIAR_MATERIAS: EstadoAsociarMaterias = { status: "idle" };
```

**Action:** `src/server/profesores/actions.ts` → `asociarMateriasProfesor(profesorId: string, formData: FormData): Promise<EstadoAsociarMaterias>`

Sigue el mismo patrón que `actualizarContactoProfesor` (HU-D-02): invocación directa, sin `useActionState`, y shape de estado propio (excepción de la Regla 5).

1. `verificarPermiso("profesores:editar")`.
2. `ProfesorIdSchema.safeParse(profesorId)`. Si falla, devolver `error` con el mensaje de profesor no encontrado.
3. `AsociarMateriasProfesorSchema.safeParse({ materiaIds: formData.getAll("materiaIds") })`. Si falla, devolver `error_validacion` con `flattenError(...).fieldErrors`.
4. Llamar al servicio. Su resultado se mapea a `MateriaDeProfesor` con `activa: true`, porque toda materia recién asociada está activa (§1 punto 12).
5. Revalidar rutas:
   - `revalidatePath("/profesores")`
   - `revalidatePath(\`/profesores/${profesorId}\`)`
   - `revalidatePath("/materias")` y `revalidatePath(\`/materias/${id}\`)` por cada materia asociada, porque HU-L-02 muestra la cantidad de profesores y el detalle lista los profesores asociados.
6. `MENSAJES_POR_CODIGO` vive en la action, no en el service (Regla 5):

| Código | Estado devuelto / mensaje |
|---|---|
| `PROFESOR_INACTIVO` | "Solo pueden asociarse materias a profesores activos" |
| `PROFESOR_NO_ENCONTRADO` | el mensaje existente de HU-D-02 |
| `MATERIA_NO_ENCONTRADA` | "Alguna de las materias seleccionadas ya no existe. Recargá la página" |
| `MATERIA_YA_ASOCIADA` | "Alguna de las materias ya está asociada al profesor. Recargá la página" |
| `MATERIA_INACTIVA` | `{ status: "materias_inactivas", materias: error.detalles.materias }` |
| `PermisoError` | su propio mensaje |
| cualquier otro error | `error_comunicacion` |

Nunca se expone un mensaje técnico.

### 4.7. Trazabilidad

Opción (a), persistida en la misma transacción (§1 punto 3):
- `profesor_materia.createdAtProfesorMateria` y `creadoPorUsuarioId` por cada fila;
- `profesores.modificadoPorUsuarioId` y `updatedAtProfesor`.

### 4.8. Revisión de specs (SDD, aditiva, sin renumerar)

- **`docs/specs/spec_modulo_D.md`:**
  - Tabla de changelog al principio: `HU-D-03 → §2.3 contrato en snake_case / evento §4 → anotado`.
  - En §2.3, una **nota de sincronización** con:
    - rutas reales (Regla 11);
    - camelCase (`materiaIds`, `profesorId`, `materiaIdsInvalidas`);
    - `@@id` compuesto en lugar de `@@unique`;
    - `z.cuid()` de Zod 4;
    - los códigos `PROFESOR_INACTIVO` / `PROFESOR_NO_ENCONTRADO` / `MATERIA_NO_ENCONTRADA`;
    - que `MATERIA_INACTIVA` se lanza después del chequeo de duplicados, igual que en la spec.
  - En §4, una nota: **el módulo D usa la opción (a) de la Regla 2** (columnas de auditoría). Los eventos de la tabla quedan como referencia histórica y no se emiten.
- **`docs/specs/spec_modulo_L.md`:** sección nueva al final de Interfaces, sin renumerar, que documenta `bloquearMateriasParaAsociar()` como consulta pública consumida por el módulo D. Incluir la entrada correspondiente en el changelog.

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md`, sin hex ni colores default de Tailwind.
- Éxito: `bg-success text-success-foreground`.
- Errores: `text-destructive`.
- Hover de ítems: `bg-accent`.
- Botón principal: `primary`, uno solo por vista.
- `brand-accent` nunca como color de texto.

**Ficha** (`src/app/(dashboard)/profesores/[id]/page.tsx` + nuevo `ficha-materias.tsx`):
- Nueva sección `FichaMaterias`, construida con `FichaSeccion` y una lista `<ul>` (§1 punto 11).
- Lista **todas** las materias asociadas como "Nombre (CÓDIGO)", o solo "Nombre" si no tiene código. Las inactivas llevan un `Badge` "Inactiva" (§1 punto 12). Si no hay ninguna: "Sin materias asociadas".
- Acción "Asociar materias", con `buttonVariants({ variant: "outline", size: "sm" })`, que lleva a `/profesores/[id]/materias`. **Solo** se muestra si el profesor está activo. Si está inactivo, se reemplaza por el texto "Solo pueden asociarse materias a profesores activos" (criterio 1).

**Pantalla** `src/app/(dashboard)/profesores/[id]/materias/page.tsx` (Server Component):
- `verificarPermiso("profesores:editar")`. Ante `PermisoError`, redirige a `/profesores` (mismo criterio que la ficha).
- Carga `obtenerFichaProfesor`, `obtenerMateriasDelProfesor` y `listarMateriasActivas`. Esta última se mapea a `{ id, nombre, codigo }`, el mismo contrato de "materia activa" que usa `turnos/configuracion` para HU-C-03.
- Profesor inexistente: `notFound()`. Profesor inactivo: muestra el mensaje del criterio 1, sin formulario.

**Formulario** `asociar-materias-form.tsx` (Client Component, mismo patrón que `contacto-profesor-form.tsx`):
- Input "Filtrar por nombre o código", con etiqueta visible. Filtra con `normalizarTexto()` sobre nombre y código (criterio 1). La función de filtrado se extrae a un helper puro testeable.
- La lista es la unión de las materias activas (`listarMateriasActivas()`) y las asociadas inactivas (§1 punto 12). El filtro aplica a todas. Las inactivas no asociadas no se muestran.
- Lista de `<input type="checkbox" name="materiaIds">` con `<label>`, texto "Nombre (CÓDIGO)" (criterio 1).
- Las materias ocultas por el filtro **conservan** su selección y se envían igual.
- Ya asociadas: checkbox marcado y `disabled`, con un `Badge` "Asociada", o "Asociada · Inactiva" si la materia está inactiva (texto, no solo color). No viajan en el `FormData` (criterio 2).
- Contador "N seleccionadas". "Guardar materias" queda deshabilitado con 0 nuevas, y el submit revalida con el schema (criterio 3).
- Envío:
  - guard `if (pendiente) return`;
  - botón deshabilitado + `Loader2` con `animate-spin`;
  - `try/catch` con fallback a `error_comunicacion`.
- `materias_inactivas`:
  - `<p role="alert">` que nombra cada una: "La materia X dejó de estar activa. Quitala de la selección y volvé a confirmar";
  - esos ítems quedan marcados con `aria-invalid` y texto;
  - **la selección se conserva** para destildar y reconfirmar (criterio 4).
- Éxito:
  - `<div role="status">` con "Materias del profesor actualizadas" (criterio 5, texto exacto) y un link "Volver a la ficha";
  - `setDirty(false)`;
  - las nuevas pasan a mostrarse como "Asociada" y se limpia la selección.
- Cancelar: si hay selección, `ConfirmarDescarteDialog` + `useDirtyState`; si no, vuelve a la ficha.
- Sin materias activas: "No hay materias activas para asociar", sin formulario.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unit
Mismo criterio que HU-D-01 §6: sintaxis Vitest, **escritos pero no ejecutables** hasta que el equipo decida el test runner. No se instala nada ni se toca `package.json`.
- `AsociarMateriasProfesorSchema`:
  - array vacío → error;
  - id no-cuid → error;
  - ids repetidos → deduplicados.
- Helper de filtrado:
  - `"matematica"` encuentra "Matemática";
  - `"mat101"` encuentra por código;
  - un filtro vacío devuelve todo.
- `obtenerMateriasDelProfesor` (con mock de `prisma`):
  - devuelve activas e inactivas, con `activa` correcto;
  - profesor sin asociaciones → lista vacía.
- `asociarMateriasAProfesor` (con mocks de `tx`):
  - éxito;
  - profesor inactivo → `PROFESOR_INACTIVO`;
  - inexistente → `PROFESOR_NO_ENCONTRADO`;
  - duplicado → `MATERIA_YA_ASOCIADA`;
  - una inactiva en un lote de tres → `MATERIA_INACTIVA` con esa sola en detalles y `createMany` **no** invocado;
  - `P2002` forzado → `MATERIA_YA_ASOCIADA`.

**Estado:** escrito, no ejecutado — sin test runner. Archivos: `src/server/profesores/profesor.schema.test.ts`, `src/server/profesores/profesor.service.test.ts` y `src/lib/filtrar-materias.test.ts`, todos con imports por alias `@/` (Regla 11). Quedan fuera de `tsc` por el `exclude` de `tsconfig.json`.

### Nivel 2 — Postman
`POST /api/profesores/{id}/materias`:

| Caso | Esperado |
|---|---|
| Éxito, con sesión de Gerente | `201` con el shape de §4.5 |
| Sin sesión | `401 SESION_INVALIDA` |
| Con sesión de Mesa de Entrada | `403 SIN_PERMISO` |
| `materiaIds: []` | `400` |
| id no-cuid | `400` |
| Materia ya asociada al profesor | `409 MATERIA_YA_ASOCIADA` |
| Lote con "Historia de la Ciencia" (inactiva en el seed) + una activa | `409 MATERIA_INACTIVA`, con solo el id inactivo en `materiaIdsInvalidas` |
| Profesor Molina, Héctor (inactivo en el seed) | `409 PROFESOR_INACTIVO` |
| Profesor inexistente | `404` |

**Evidencia (2026-09-23, `npm run dev` local, curl en lugar de Postman).** Login por curl con el flujo Credentials de Auth.js (`GET /api/auth/csrf` → `POST /api/auth/callback/credentials`, `302` + cookie `authjs.session-token` HS256), con `gerente@noctium.local` y `mesa.entrada@noctium.local` del seed. Ids del seed: Giménez `cmue40ygt001guxmws6tchigk`, Molina `cmue40yhk001ouxmwcdpp2lgc`.

| Caso | Request | Status | Cuerpo |
|---|---|---|---|
| Éxito (Gerente) | Giménez + Química, Inglés Técnico | `201` ✅ | `{"data":{"profesorId":"cmue40ygt001guxmws6tchigk","materiasAsociadas":["cmue40yib001uuxmw2k22wgxi","cmue40yi7001tuxmwcyvih9pr"]},"error":null}` |
| Sin sesión | Giménez + Bases de Datos | `401` ✅ | `{"data":null,"error":{"code":"SESION_INVALIDA","message":"Tu sesión expiró. Iniciá sesión nuevamente"}}` |
| Mesa de Entrada | Giménez + Bases de Datos | `403` ✅ | `{"data":null,"error":{"code":"SIN_PERMISO","message":"No tenés permisos para acceder a esta sección"}}` |
| `materiaIds: []` | Giménez | `400` ✅ | `{"data":null,"error":{"code":"VALIDACION","message":"Datos inválidos","campos":{"materiaIds":["Seleccioná al menos una materia nueva"]}}}` |
| id de profesor no-cuid | `/api/profesores/no-es-un-cuid/materias` | `400` ✅ | `{"data":null,"error":{"code":"VALIDACION","message":"Datos inválidos","campos":{"id":["Invalid cuid"]}}}` |
| id de materia no-cuid | `materiaIds: ["123"]` | `400` ✅ | `{"data":null,"error":{"code":"VALIDACION","message":"Datos inválidos","campos":{"materiaIds":["Materia inválida"]}}}` |
| Ya asociada | Giménez + Matemática | `409` ✅ | `{"data":null,"error":{"code":"MATERIA_YA_ASOCIADA","message":"Alguna de las materias ya está asociada al profesor","materiaIdsInvalidas":["cmue40yhq001puxmwn4t1mo8l"]}}` |
| Historia de la Ciencia + Bases de Datos | Giménez | `409` ✅ | `{"data":null,"error":{"code":"MATERIA_INACTIVA","message":"La materia 'Historia de la Ciencia' ya no está activa","materiaIdsInvalidas":["cmue40yif001vuxmwtq8t1ml3"]}}` |
| Profesor inactivo | Molina + Matemática | `409` ✅ | `{"data":null,"error":{"code":"PROFESOR_INACTIVO","message":"Solo pueden asociarse materias a profesores activos"}}` |
| Profesor inexistente | `cjld2cjxh0000qzrmn831i7rn` (cuid válido) | `404` ✅ | `{"data":null,"error":{"code":"PROFESOR_NO_ENCONTRADO","message":"El profesor no existe"}}` |

Smoke test SSR con la misma sesión de Gerente: `/profesores/{Giménez}` y `/profesores/{Giménez}/materias` → `200`, con "Asociar materias", las nuevas asociadas y el formulario; `/profesores/{Molina}` y `/profesores/{Molina}/materias` → `200`, con "Solo pueden asociarse materias a profesores activos" y sin formulario. No reemplaza la verificación en navegador.

### Nivel 3 — BD / TablePlus
- Filas nuevas en `profesor_materia` con `createdAtProfesorMateria` real y `creadoPorUsuarioId` igual al Gerente.
- `profesores.modificadoPorUsuarioId` y `updatedAtProfesor` actualizados.
- Tras el caso `MATERIA_INACTIVA` de Postman, **ninguna** fila nueva para la materia activa del mismo lote (todo-o-nada).
- **Criterio 4 end-to-end:**
  1. Abrir el formulario y seleccionar dos materias.
  2. En TablePlus, `UPDATE materias SET "activaMateria" = false` sobre una de ellas.
  3. Confirmar: se ve el mensaje nombrando esa materia y no se crea ninguna fila.
  4. Quitarla de la selección y reconfirmar: se guarda la otra.
  5. Restaurar el dato.
- `INSERT` manual duplicado → rechazado por la PK compuesta.

**Evidencia SQL (2026-09-23, `psql` vía `docker exec noctium_db`, después de los casos de Nivel 2):**

- Migración `profesor_materia_auditoria`: `npx prisma migrate status` → "Database schema is up to date!" (22 migraciones). `\d profesor_materia` muestra `createdAtProfesorMateria timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` y `creadoPorUsuarioId text NULL`. Las 9 filas previas quedaron con `createdAt` de la migración y `creadoPorUsuarioId = NULL`.
- Filas nuevas con auditoría ✅:
  ```
   nombreMateria  |    creadoPorUsuarioId     |     emailUsuario      | createdAtProfesorMateria
   Física         |                           |                       | 2026-09-23 16:11:05.365
   Inglés Técnico | cmue40yaw0000uxmwu87p8c2y | gerente@noctium.local | 2026-09-23 16:59:07.878
   Matemática     |                           |                       | 2026-09-23 16:11:05.365
   Química        | cmue40yaw0000uxmwu87p8c2y | gerente@noctium.local | 2026-09-23 16:59:07.878
  ```
- Profesor modificado ✅: Giménez `modificadoPorUsuarioId = cmue40yaw0000uxmwu87p8c2y` (Gerente), `updatedAtProfesor = 16:59:07.869` (antes `NULL` / `16:53:58.766`). Los casos `MATERIA_YA_ASOCIADA` y `MATERIA_INACTIVA`, que corrieron después, también ejecutan el `updateMany` y no movieron ese `updatedAtProfesor`: se revirtieron con la transacción.
- Todo-o-nada ✅: tras `MATERIA_INACTIVA`, `SELECT count(*) … WHERE profesorId = Giménez AND materiaId IN (Bases de Datos, Historia de la Ciencia)` → `0`. Total de filas: `11` (9 + las 2 del caso de éxito).
- `INSERT` manual duplicado ✅ (Giménez + Matemática, dentro de `BEGIN … ROLLBACK`): `ERROR: duplicate key value violates unique constraint "profesor_materia_pkey"`.
- Limpieza: se borraron solo las 2 filas creadas en la prueba y se restauraron `modificadoPorUsuarioId = NULL` y `updatedAtProfesor` de Giménez. La base quedó con 9 filas, ninguna con autor. Ninguna materia cambió de estado.
- **Pendiente:** el criterio 4 end-to-end (pasos 1-5 de arriba) requiere navegador.

**Evidencia:** Postman + SQL, y capturas de la pantalla en sus estados: vacío con filtro, con asociadas marcadas, cargando, error de materia inactiva, éxito, y ficha de profesor inactivo.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de implementar.
- [x] Migración `profesor_materia_auditoria` aplicada sin romper filas existentes; seed corre limpio. *(`migrate status` al día y filas previas intactas, ver §6 Nivel 3. El seed no se re-ejecutó en esta verificación. Los `updatedAtProfesor` del seed (16:53) son posteriores a la migración (16:11), así que ya había corrido sobre el schema migrado.)*
- [x] `bloquearMateriasParaAsociar()` agregada al módulo L, parametrizada (`$queryRaw` con template tag), sin cambios en funciones existentes (el diff de `452e3f7` sobre `materia.service.ts` no elimina ni modifica líneas).
- [ ] **OK de Cali** sobre `bloquearMateriasParaAsociar()` antes del merge.
- [x] `ServiceError` extendido de forma retrocompatible (`tsc --noEmit` limpio).
- [x] Toda la lógica en `profesor.service.ts`; action y route handler delgados (Regla 4), en las ubicaciones de la Regla 11 e importados por alias (incluidos los tests).
- [x] Condición y mutación del profesor en un `updateMany`; materias bloqueadas con `FOR SHARE` dentro de la misma transacción (Regla 7).
- [x] Todo-o-nada verificado: ningún error deja asociaciones parciales (§6 Nivel 3, caso `MATERIA_INACTIVA`).
- [x] Sin `skipDuplicates` en la HU; `P2002` traducido.
- [x] `profesorActivoDictaMateria()` sin cambios (contrato con HU-C-04).
- [ ] Criterios 1 a 6 verificados en navegador como Gerente.
- [x] Solo tokens de `DESIGN.md` (sin hex ni colores default de Tailwind en `ficha-materias.tsx`, `materias/page.tsx` ni `asociar-materias-form.tsx`).
- [x] Ningún `DELETE` físico (Regla 1). *(Los únicos `DELETE` fueron la limpieza manual de datos de prueba en la BD local, fuera del código.)*
- [x] `spec_modulo_D.md` y `spec_modulo_L.md` revisadas de forma aditiva, con changelog y notas de sincronización.
- [x] Tests de los 3 niveles documentados; Nivel 1 marcado como "escrito, no ejecutado — sin test runner".
- [x] `npm run lint` y `npm run build` sin errores. *(Lint: 0 errores y 1 warning preexistente, ajeno a la HU: `Clock3` sin usar en `src/app/(dashboard)/home/page.tsx`.)*
- [ ] PR acotado a HU-D-03, desde `feature/HU-D-03-asociar-materias`.
