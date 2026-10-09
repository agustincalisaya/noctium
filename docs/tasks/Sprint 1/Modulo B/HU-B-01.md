# TASK: HU-B-01 — Registrar datos de identidad del alumno

**Módulo:** B (Alumno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_B.md` sección 2.1 (Alta de identidad del alumno) · reglas sección 3.1-3.4 · sin sección de eventos aplicable (ver nota en 4.5)
**RBAC:** `alumnos:crear` — permiso nuevo, creado en esta task, sembrado exclusivamente para el rol `MESA_ENTRADA` (mismo patrón que `materias:crear` para `GERENTE`, de HU-L-01)
**Schema:** Ya completo, sin migración. El modelo `Alumno` ya existía en `schema.prisma` con todos los campos necesarios para esta HU (`nombreAlumno`, `apellidoAlumno`, `dniAlumno`, `fechaNacimientoAlumno`, `generoAlumno`, `activoAlumno`, `createdAtAlumno`, `creadoPorUsuarioId`).

---

## 0. Relevamiento previo a implementación (Claude Code)

### 0.1 Archivos nuevos creados
| Archivo | Contenido |
|---|---|
| `src/server/shared/fecha.schema.ts` | `fechaCalendarioValidaSchema` — validación estricta de calendario, implementada a mano (parseo + reconstrucción con `Date.UTC` + comparación exacta de año/mes/día), sin agregar `date-fns` como dependencia nueva. Reutilizable por otros módulos (Profesor, Turno). |
| `src/server/alumnos/alumno.schema.ts` | `crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax)` — factory, porque la longitud del DNI es un rango configurable en `ParametroSistema`, no un valor fijo. |
| `src/app/(dashboard)/alumnos/actions.ts` | Server Action `crearAlumno()` (no existía ningún `actions.ts` bajo `alumnos/` todavía). |
| `src/app/(dashboard)/alumnos/nueva/page.tsx` | Formulario "Nuevo alumno" (criterios de aceptación 1, 8, 9), siguiendo el patrón ya usado en `materias/nueva/` (HU-L-01). Conectado al Server Action `crearAlumno()`. |
| `src/app/(dashboard)/alumnos/nueva/alumno-form.tsx` | Formulario cliente, mismo patrón que `materia-form.tsx`. |

**Nota de convención de rutas (resuelta por precedente):** se sigue la estructura real ya usada por Módulo A (`src/server/<modulo>/*.schema.ts` + `*.service.ts` juntos), no la nomenclatura genérica `lib/schemas/` / `lib/services/` de esta plantilla — el repo no tiene esas carpetas y `tsconfig.json` solo mapea `@/* → ./src/*`.

### 0.2 Archivos existentes modificados
| Archivo | Cambio |
|---|---|
| `src/server/alumnos/alumno.service.ts` | Era un stub (`// TODO... export {}`). Implementa `crearAlumno()`. |
| `src/app/api/alumnos/route.ts` | GET/POST devolvían 501. Implementa POST con `withPermission("alumnos:crear", ...)`. GET queda como está (501) — el listado es HU-B-04, fuera de esta task. |
| `prisma/seed.ts` | Sección "10) RolPermiso": agrega `alumnos:crear`, sembrado únicamente para `MESA_ENTRADA`. |
| `src/app/(dashboard)/alumnos/page.tsx` | Era un placeholder ("Alumnos - en construcción"). Se agrega un link/botón "Nuevo alumno" hacia el formulario, con banner de éxito ante `?creada=1` — lo mínimo para poder navegar, sin construir el listado completo (HU-B-04, sigue fuera de alcance). |

### 0.3 Puntos ambiguos relevados y resueltos
- **DNI, longitud:** el seed real usa `dni_longitud_min: "7"` / `dni_longitud_max: "8"` (rango), no un `DNI_LONGITUD` único como sugería la spec original. El schema usa `.min(min).max(max)` leídos vía `getParametroNumerico()` (`src/server/shared/parametros.ts`), no `.length()`.
- **Alcance del permiso `alumnos:crear`:** solo `MESA_ENTRADA`, según spec_modulo_B.md §2.1 ("Permiso requerido: alumnos:crear — Mesa de Entrada"). No incluye `GERENTE`.
- **`fechaCalendarioValidaSchema`:** implementada a mano, sin dependencia nueva (`date-fns` no está en `package.json`).
- **Forma del payload de respuesta (201):** se mapea a claves limpias (`id`, `nombre`, `apellido`, `dni`, `activo`) en el Route Handler, en vez de exponer los nombres de columna de Prisma tal cual.
- **Trazabilidad de la mutación (DECISIÓN RESUELTA, no relevar de nuevo):** RULES.md fue actualizado por decisión de equipo; ya no exige event bus asíncrono ni `AuditLog` con hash-chain. Para esta HU corresponde el patrón (a) de la Regla N.° 2 actualizada — columnas de auditoría en la propia entidad (`createdAtAlumno`, `creadoPorUsuarioId`), sin tabla de eventos adicional. Ver nota en sección 4.5.
- **Alcance de frontend (DECISIÓN RESUELTA, no relevar de nuevo):** la primera pasada de esta task había dejado el frontend fuera "por decisión de scoping" (backend-first). Al revisar los criterios de aceptación reales de HU-B-01 (HU-Sprint-1.md), se confirmó que los criterios 1, 8 y 9 describen comportamiento de interfaz que es parte de la HU misma. Se corrigió: el frontend se incorporó a esta misma task antes del cierre.

### 0.4 Nota de sincronización (no bloqueante para esta task)
El modelo `Alumno` no tiene columna `version` para concurrencia optimista, que sí exige `spec_modulo_B.md` §3.3 para HU-B-06. No afecta al alta (esta HU) — el `INSERT` simplemente no la setea — pero cuando se implemente HU-B-06 va a hacer falta una migración de Prisma agregándola.

---

## 1. Nota de alcance

Esta task implementa exclusivamente el alta de la ficha de identidad del alumno (HU-B-01), incluyendo su formulario de carga. No crea cuenta de acceso (`Usuario`) — eso corresponde a HU-B-08 (autorregistro). El campo `dniAlumno` valida unicidad contra el universo completo de fichas, activas e inactivas. No depende de ninguna otra HU de Módulo B; depende de HU-A-01 (sesión), ya implementada.

**Fuera de alcance de esta task (explícito):**
- Creación de la cuenta de acceso del alumno (HU-B-08).
- Búsqueda inteligente / filtros combinados en el listado (Sprint 2).
- Desactivación del alumno (Sprint 3).
- Datos de contacto (HU-B-02) y forma de pago preferida (HU-B-03) — se ofrecen como paso siguiente tras el alta, pero no se implementan en esta task.
- Listado completo de alumnos (HU-B-04) — la pantalla `alumnos/page.tsx` solo recibe el link mínimo para navegar al formulario, no se construye la tabla/listado.

---

## 2. Historia de Usuario

**Como** personal de Mesa de Entrada
**Necesito** registrar los datos de identidad de un alumno
**Para** disponer de una ficha confiable al gestionar turnos y su futura atención académica

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación **frontend + backend** conforme a `spec_modulo_B.md` §2.1. Incluye:
- Capa de servicios (`src/server/alumnos/alumno.service.ts`)
- Route Handler (`src/app/api/alumnos/route.ts`)
- Server Action equivalente (`src/app/(dashboard)/alumnos/actions.ts`)
- Schemas Zod (`src/server/alumnos/alumno.schema.ts`, `src/server/shared/fecha.schema.ts`)
- Trazabilidad vía columnas de auditoría (no eventos de dominio — ver 4.5)
- UI: formulario "Nuevo alumno" (`src/app/(dashboard)/alumnos/nueva/`) y link mínimo de navegación en `alumnos/page.tsx`

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Listado completo de alumnos (HU-B-04).
- Datos de contacto (HU-B-02) y forma de pago preferida (HU-B-03).
- Creación de cuenta de acceso (HU-B-08).

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/alumnos/alumno.schema.ts`

```typescript
export function crearIdentidadAlumnoSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return z.object({
    nombre: z.string().trim().min(2).max(50)
      .regex(/^[\p{L}\s'-]+$/u, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
      .transform((v) => v.replace(/\s+/g, " ")),
    apellido: z.string().trim().min(2).max(50)
      .regex(/^[\p{L}\s'-]+$/u, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
      .transform((v) => v.replace(/\s+/g, " ")),
    dni: z.string().trim()
      .regex(/^\d+$/, "Ingresá el DNI solo con números")
      .min(dniLongitudMin).max(dniLongitudMax),
    fecha_nacimiento: fechaCalendarioValidaSchema
      .refine((d) => d <= new Date(), "La fecha de nacimiento no puede ser futura"),
    genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"]).optional(),
  });
}
export type IdentidadAlumnoInput = z.infer<ReturnType<typeof crearIdentidadAlumnoSchema>>;
```

### 4.2. Servicio

**Archivo:** `src/server/alumnos/alumno.service.ts`
**Función:** `crearAlumno(input: IdentidadAlumnoInput, usuarioId: string): Promise<Alumno>`

Comportamiento exigido, dentro de una única `prisma.$transaction`:
1. Verificar unicidad aplicativa de `dniAlumno` contra todos los alumnos, activos e inactivos.
2. Si existe: error `DNI_DUPLICADO`, indicando en el mensaje si la ficha existente está inactiva.
3. Insertar con `activoAlumno: true`, `createdAtAlumno`, `creadoPorUsuarioId`.
4. Commit.
5. Defensa adicional (fuera de la transacción de negocio, en el catch): capturar constraint único `P2002` ante una alta simultánea con el mismo DNI, y traducirlo al mismo error `DNI_DUPLICADO` — garantiza la condición de carrera sin depender solo del chequeo aplicativo.

**Errores de servicio definidos:** `DNI_DUPLICADO`.

### 4.3. Route Handler

**Archivo:** `src/app/api/alumnos/route.ts`
**Método:** `POST`
**Permiso de acceso:** `withPermission("alumnos:crear")`

Contrato estándar (Regla N.° 5 de RULES.md): éxito `201 { data: { id, nombre, apellido, dni, activo }, error: null }`; error `409 { data: null, error: { code: "DNI_DUPLICADO", message } }`; `400` con `flatten()` de Zod ante payload inválido; `401`/`403` según corresponda vía `withPermission`. `GET` queda en `501` (HU-B-04, fuera de alcance).

### 4.4. Server Action

**Archivo:** `src/app/(dashboard)/alumnos/actions.ts`
**Función:** `crearAlumno()` — wrapper delgado sobre el servicio (valida permiso, valida payload con Zod, invoca el servicio, traduce a objeto plano serializable). Mismo contrato que el Route Handler, nunca retorna `NextResponse`.

### 4.5. Eventos de dominio

**No aplica tabla de eventos separada.** RULES.md, Regla N.° 2 (actualizada por decisión de equipo — ya no exige event bus asíncrono ni `AuditLog` con hash-chain SHA-256), ofrece dos patrones válidos: (a) columnas de auditoría en la propia entidad, o (b) escritura directa y síncrona a una tabla de eventos por dominio, para eventos discretos repetibles en el tiempo. El alta de alumno es una mutación única sobre la entidad, no un evento repetible — corresponde el patrón (a): `createdAtAlumno` y `creadoPorUsuarioId`, ya persistidos en el `INSERT` del servicio (sección 4.2). No se agregó ningún listener ni tabla de eventos nueva.

---

## 5. Frontend

**Ruta:** `src/app/(dashboard)/alumnos/nueva/page.tsx` + `alumno-form.tsx`, siguiendo el patrón ya usado en `materias/nueva/` (HU-L-01).

**Campos del formulario:** Nombre, Apellido, DNI, Fecha de nacimiento (obligatorios, con marca visible), Género (opcional, select con el enum real `Genero`).

**Comportamiento (criterios de aceptación 1, 8, 9 de HU-B-01 + definiciones generales del Sprint):**
1. Labels visibles y ayuda de formato en cada campo. Gateo por rol: `alumnos/page.tsx` solo muestra el link "Nuevo alumno" a `MESA_ENTRADA`; el acceso directo a `/alumnos/nueva` con otro rol redirige server-side.
2. Conectado al Server Action `crearAlumno()` — la validación real es el schema Zod del servidor; el cliente solo agrega validación de UX básica.
3. Errores del servidor se muestran junto al campo correspondiente (`parsed.error.flatten()`), sin perder los datos ya cargados, con foco en el primer campo inválido.
4. Botón de submit deshabilitado + indicador de carga durante el envío.
5. Botón Cancelar conectado a `DirtyStateContext` (de HU-A-03, reutilizado): con cambios pide confirmación, sin cambios vuelve directo.
6. Alta exitosa redirige a `/alumnos?creada=1` con banner de confirmación.

**Seguir la guía de diseño del proyecto:** `docs/DESIGN.md` (tokens de shadcn/ui + Tailwind — nunca colores hex ni la paleta default de Tailwind directamente en componentes). *(Ver sección 8 — Correcciones posteriores: esta sección se audita y corrige contra DESIGN.md, incorporado al proyecto después de la implementación original.)*

**Fuera de alcance de frontend:** listado de alumnos (tabla completa, HU-B-04).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- `crearIdentidadAlumnoSchema`: casos válidos e inválidos por campo (nombre/apellido con números o símbolos, DNI con separadores, fecha futura, fecha inexistente como 31/02).
- `fechaCalendarioValidaSchema`: fechas límite de calendario (bisiestos, 31/02, 30/02).
- `crearAlumno`: unicidad de DNI (activo e inactivo), revalidación previa al INSERT. 24/24 casos corridos vía script `tsx` contra la BD real.

### Nivel 2 — Postman (equivalente, sin colección importable en el repo)
- Alta exitosa → `201`, cuerpo conforme spec.
- DNI duplicado, ficha activa → `409 DNI_DUPLICADO`.
- DNI duplicado, ficha inactiva → `409`, mensaje indica inactividad.
- Payload inválido por cada campo → `400` con `flatten()` de Zod.
- Intento sin permiso `alumnos:crear` → `403`.
- Sin sesión → `401 SESION_INVALIDA`.
- Condición de carrera: dos altas simultáneas con el mismo DNI → una `201`, una `409` vía constraint de base, nunca un `500`.
- Server Action probado end-to-end, no solo el Route Handler.

Todos los casos anteriores corridos contra el sistema real (`next dev` + Postgres real) y confirmados con el status/body exacto esperado.

### Nivel 3 — BD / TablePlus
- Verificado `activoAlumno: true`, `createdAtAlumno`, `creadoPorUsuarioId` tras el alta.
- Constraint único de `dniAlumno` a nivel de base (`P2002`) verificado ante alta simultánea.
- `RolPermiso` verificado: `alumnos:crear` sembrado exclusivamente para `MESA_ENTRADA`.

### Frontend — probado en navegador real (Chrome, next dev + Postgres real)
- Formulario completo con labels/ayudas/marca de obligatorios (criterio 1).
- Como rol no autorizado, el link no aparece y la URL directa `/alumnos/nueva` redirige server-side.
- Envío vacío → error específico por campo (criterio 9).
- DNI duplicado → error solo en el campo DNI, resto de los datos no se pierde (criterio 9).
- Cancelar con datos sin guardar → diálogo de confirmación (criterio 8, `DirtyStateContext`).
- Cancelar sin cambios → vuelve directo, sin diálogo (verificado por Adriel a mano).
- Alta exitosa → redirige a `/alumnos?creada=1` con banner.

**Evidencia esperada:** cumplida en los 4 niveles (Unit, Postman-equivalente, BD, Frontend). Ningún criterio quedó marcado como pasado sin haberse verificado.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar.
- [x] Service, Route Handler y Server Action implementados, sin lógica de negocio fuera de la capa de servicios.
- [x] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [x] Trazabilidad resuelta vía columnas de auditoría (patrón a de Regla N.° 2), sin tabla de eventos — no aplica el ítem genérico de "eventos emitidos tras COMMIT" de esta plantilla.
- [x] Frontend funcional, verificado en navegador real por Adriel.
- [x] Ningún `DELETE` físico en ningún punto del código.
- [x] Tests de los 4 niveles (Unit, Postman-equivalente, BD, Frontend) documentados con evidencia real.
- [x] Lint limpio (`npm run lint`), build limpio (`npm run build`).
- [x] PR con diff acotado exclusivamente a esta HU — mergeado a `develop`.

---

## 8. Correcciones posteriores

*(Sección agregada tras el merge original, al incorporarse `DESIGN.md` al proyecto — pendiente de completar por Claude Code en la branch `fix/HU-B-01-reajuste-diseno`.)*

- **Motivo:** `DESIGN.md` (guía oficial de diseño, tokens shadcn/ui en oklch) no existía en el proyecto al momento de implementar HU-B-01. Es posible que el frontend haya copiado colores hardcodeados de la paleta default de Tailwind desde `materias/page.tsx` (que `DESIGN.md` §6 documenta como deuda de diseño pendiente: `bg-emerald-100`/`text-emerald-900` en vez de `bg-success`/`text-success-foreground`).
- **Alcance:** auditar y corregir `alumnos/page.tsx`, `alumnos/nueva/page.tsx` y `alumnos/nueva/alumno-form.tsx` contra `DESIGN.md`. No se toca `materias/page.tsx` (fuera de alcance, es deuda de otra HU/otro compañero).
- **Resultado:**
  - **Auditados:** `alumnos/page.tsx`, `alumnos/nueva/page.tsx`, `alumnos/nueva/alumno-form.tsx` (búsqueda de hex, `blue-*`/`gray-*`/`slate-*`/`emerald-*`/`amber-*`/etc., estilos inline y clases `bg-[...]`/`text-[...]` arbitrarias).
  - **Encontrado:** exactamente el bug previsto en `DESIGN.md` §6, heredado de copiar el patrón de `materias/page.tsx` sin que existiera todavía la guía de diseño. `alumnos/page.tsx` (banner de éxito, `?creada=1`) usaba `bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100` — paleta default de Tailwind, no un token del proyecto.
  - **Corregido:** reemplazado por `bg-success text-success-foreground` (la migración exacta que indica la tabla de `DESIGN.md` §6). Sin variantes `dark:` — igual que documenta `DESIGN.md` §5, el modo oscuro sigue sin resolver en el proyecto y no correspondía inventar algo acá.
  - **`alumnos/nueva/page.tsx` y `alumno-form.tsx`:** sin hallazgos. Ya usaban únicamente tokens del sistema (`text-muted-foreground`, `text-destructive`, `bg-background`, `border-input`, `ring-ring`, `aria-invalid:border-destructive`), heredados de replicar `materia-form.tsx`, que tampoco tiene este bug en particular (el suyo es otro, en `materias/page.tsx`, no en su formulario).
  - **`materias/page.tsx`:** no se tocó, confirmado por `git diff --stat` sin cambios en esa ruta — deuda de diseño de otra HU, queda igual que la documentó `DESIGN.md`.
  - **Lint:** `npm run lint` — sin salida, 0 errores/warnings.
  - **Build:** `npm run build` — compila y tipa sin errores, incluye `/alumnos` y `/alumnos/nueva` en el listado de rutas generadas.

- **Adición posterior — ícono en el link "Nuevo alumno" (motivo: pedido explícito de Adriel tras revisar el diseño, no formaba parte del reajuste de tokens original):**
  - El proyecto ya tiene `lucide-react` como dependencia (`package.json`) — no se agregó ninguna librería nueva. Único uso previo: `Eye`/`EyeOff`/`Loader2` en `login-form.tsx`; no había ningún ícono de "alumno/estudiante" en otro componente todavía.
  - Ícono elegido: `GraduationCap` (birrete de graduación, lucide-react) — semánticamente el más directo para "alumno" dentro del set disponible.
  - Tamaño y spacing copiados del único precedente real de ícono-junto-a-texto del proyecto (`Loader2` en `login-form.tsx:146`): `size-4` + `mr-2`, `aria-hidden` (decorativo, el texto "Nuevo alumno" ya transmite el significado).
  - Color: ninguno asignado a mano — el ícono hereda `currentColor` del texto del link (`text-sm font-medium`), igual que exige no introducir un color nuevo fuera de `DESIGN.md`.
  - Archivo tocado: `src/app/(dashboard)/alumnos/page.tsx` únicamente.
  - Lint y build corridos de nuevo tras el cambio: ambos limpios (mismo resultado que arriba).

- **Segunda ubicación del ícono — título del formulario (motivo: Adriel decidió que va en los dos lugares, no solo en el link de `/alumnos`):**
  - Mismo ícono (`GraduationCap`, lucide-react) agregado también junto al `<h1>Nuevo alumno</h1>` de `src/app/(dashboard)/alumnos/nueva/page.tsx` — no había un import de lucide-react en ese archivo todavía, se agregó de cero.
  - Tamaño ajustado a `size-5` (en vez de `size-4`) porque el título usa `text-xl font-semibold`, visualmente más grande que el `text-sm font-medium` del link de `/alumnos` — mismo criterio de proporcionalidad, no un valor arbitrario.
  - Mismo patrón que la primera ubicación: `mr-2`, `aria-hidden` (decorativo), sin color propio — hereda `currentColor` del `<h1>`.
  - El ícono ahora está en **dos lugares**: el link "Nuevo alumno" de `alumnos/page.tsx` y el título "Nuevo alumno" de `alumnos/nueva/page.tsx`.
  - Lint y build corridos de nuevo tras este cambio: ambos limpios.
