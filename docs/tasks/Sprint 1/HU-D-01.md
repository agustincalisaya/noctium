# TASK: HU-D-01 — Registrar datos de identidad del profesor

**Módulo:** D (Profesor)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` sección 2.1 · reglas sección 3.1, 3.2 · eventos sección 4 (ver nota de alcance §1) · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-D-01, criterios de aceptación 1-6
**RBAC:** no existe todavía la acción `profesores:crear` en `RolPermiso` — esta task la agrega (exclusiva de `GERENTE`), siguiendo el mismo patrón incremental que dejó HU-A-02 (`spec_modulo_A.md`, nota de sincronización).
**Schema:** ya completo, sin migración. `model Profesor` (`prisma/schema.prisma` líneas 248-278) y `enum Genero` ya contemplan todos los campos de esta HU (`nombreProfesor`, `apellidoProfesor`, `dniProfesor` único, `fechaNacimientoProfesor`, `generoProfesor` opcional, `activoProfesor`, `usuarioId` nullable, `creadoPorUsuarioId`, `createdAtProfesor`). `prisma/seed.ts` ya precarga 5 profesores de ejemplo con estos datos.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

Un relevamiento previo del repo (`develop`, limpio) encontró seis puntos donde la spec (`spec_modulo_D.md`) y/o `spec_modulo_B.md` (tomada como referencia de diseño) no coinciden con la convención real ya establecida en el código, o donde falta infraestructura. Las decisiones ya están tomadas — se documentan acá para que no se vuelvan a relevar:

1. **Ubicación de los schemas Zod:** `spec_modulo_D.md` referencia `lib/schemas/profesores.schema.ts`, pero el repo real no tiene un `lib/schemas/` separado — `sesion.schema.ts` (HU-A-01) vive co-ubicado junto a su servicio, en `src/server/sesion/`. Esta HU sigue esa misma convención real: `src/server/profesores/profesor.schema.ts`, junto a `profesor.service.ts`.
2. **Enum `Genero`:** el pseudocódigo de `spec_modulo_D.md` §2.1 usa `"PREFIERO_NO_INDICAR"` — es un typo de la spec. El valor real en `schema.prisma` (y ya usado por `seed.ts`) es `PREFIERO_NO_INDICARLO`. El schema Zod de esta task usa el enum real de Prisma, no una lista de strings hardcodeada aparte.
3. **Longitud del DNI:** la spec asume un único parámetro `DNI_LONGITUD` con `.length(...)`. El parámetro real, ya sembrado en `ParametroSistema`, son dos claves separadas: `dni_longitud_min` (7) y `dni_longitud_max` (8). El schema Zod valida con `.min(min).max(max)`, leyendo ambos valores vía `getParametroNumerico()` (`src/server/shared/parametros.ts`).
4. **Eventos de dominio / `AuditLog` (Regla N.° 2 de `docs/RULES.md`):** **fuera de alcance explícito de esta task.** La infraestructura de eventos (`lib/events/event-types.ts`, listener de `AuditLog` encadenado por hash) no existe todavía en el repo para **ningún** módulo — ni siquiera Módulo A (HU-A-01/02/03) la implementó, a pesar de que las specs y `RULES.md` la dan por sentada. No corresponde que esta HU la introduzca unilateralmente. **Acción:** plantear en el próximo daily del equipo quién y cuándo construye esa infraestructura transversal (probablemente una task propia, no acoplada a ninguna HU de dominio en particular). Mientras tanto, "alta en transacción única, registra fecha y usuario" (criterio de aceptación 4) se satisface con el `INSERT` en sí (`createdAtProfesor`, `creadoPorUsuarioId`) — sin emisión de evento.
5. **Permiso `profesores:crear`:** se agrega como fila nueva en el bloque de `RolPermiso` de `prisma/seed.ts` (no como migración de datos suelta), ya que el seed es el archivo compartido y versionado por todo el equipo para la matriz RBAC (mismo patrón que el bloque `sesion:ping` existente).
6. **Utilidades compartidas:** `spec_modulo_D.md` da por existentes `fechaCalendarioValidaSchema` y `normalizarTexto()` (`spec_modulo_B.md` §2.1) — ninguna de las dos existe todavía en el repo. Se crean en `src/server/shared/` (junto a `parametros.ts`), con nombres genéricos y sin ningún acoplamiento a "profesor": `spec_modulo_B.md` deja explícito que `HU-B-01` (Alumno, a cargo de Adriel) las va a necesitar también para su propio alta de identidad. Esta task es la primera en tocarlas — quien implemente HU-B-01 después las reutiliza sin duplicar.

**Fuera de alcance de esta task (explícito):**
- Eventos de dominio / `AuditLog` — ver punto 4 arriba.
- HU-D-02 (contacto), HU-D-03 (materias), HU-D-04 (horario), HU-D-05 (listado/detalle real) — esta task solo deja las rutas de destino (`/profesores`, `/profesores/[id]`) como enlaces válidos desde la pantalla de éxito; su contenido real (hoy "en construcción") lo completan sus propias HU.
- Modificación o baja lógica de una ficha de profesor ya registrada (`spec_modulo_D.md`, "Fuera de alcance" general).
- Cualquier vínculo con `Usuario` (`Profesor.usuarioId` permanece `null` — criterio de aceptación 5, `spec_modulo_D.md` §3.1).

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** registrar los datos de identidad de un profesor
**Para** disponer de una ficha que pueda asociarse con materias, horarios y turnos

**SP estimado:** 1

**Justificación de secuencia (`HU-Sprint-1.md`):** base habilitante — sin ficha de profesor no se pueden asociar materias, registrar horarios ni asignarlo a turnos. Depende de HU-A-01 (ya mergeada).

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_D.md` §2.1, con las correcciones de §1 de esta task. Incluye:
- Schema Zod (`src/server/profesores/profesor.schema.ts` → `IdentidadProfesorSchema`).
- Utilidades compartidas nuevas (`src/server/shared/fecha.ts` → `fechaCalendarioValidaSchema`; `src/server/shared/texto.ts` → `normalizarTexto()`).
- Capa de servicios (`src/server/profesores/profesor.service.ts`, hoy stub → `crearProfesor()`).
- Route Handler (`POST /app/api/profesores/route.ts`, hoy stub `501` → implementado; `GET` se deja fuera de alcance, es HU-D-05).
- Server Action equivalente (`app/(dashboard)/profesores/actions.ts` → `crearProfesor()`).
- Fila `profesores:crear` en el bloque `RolPermiso` de `prisma/seed.ts`.
- UI: pantalla "Nuevo profesor" (`app/(dashboard)/profesores/nuevo/page.tsx` + formulario cliente), conectada a `DirtyStateProvider`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Emisión de eventos de dominio / `AuditLog` (ver §1, punto 4).
- Cualquier campo de contacto, materia u horario — solo identidad.
- Contenido real de `/profesores` (listado) y `/profesores/[id]` (detalle) — siguen "en construcción"; esta task solo los usa como destino de navegación desde la pantalla de éxito.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/profesores/profesor.schema.ts`

```typescript
import { z } from "zod";
import { Genero } from "@prisma/client";
import { getParametroNumerico } from "@/server/shared/parametros";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha";
import { normalizarTexto } from "@/server/shared/texto";

const NOMBRE_REGEX = /^[\p{L}\s'-]+$/u;

const nombreSchema = (etiqueta: string) =>
  z
    .string()
    .trim()
    .min(2, `${etiqueta} debe tener al menos 2 caracteres`)
    .max(50, `${etiqueta} no puede superar los 50 caracteres`)
    .regex(NOMBRE_REGEX, `${etiqueta} solo admite letras, espacios, acentos, apóstrofes y guiones`)
    .transform(normalizarTexto);

// dni_longitud_min/max se resuelven en el Server Action / Route Handler
// (async, vía ParametroSistema) y se inyectan acá — Zod no soporta refine
// async de forma ergonómica en un objeto sincrónico reutilizado en cliente
// y servidor; ver nota en 4.2 sobre por qué el schema se parametriza así.
export function construirIdentidadProfesorSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return z.object({
    nombre: nombreSchema("El nombre"),
    apellido: nombreSchema("El apellido"),
    dni: z
      .string()
      .trim()
      .regex(/^\d+$/, "Ingresá el DNI solo con números")
      .min(dniLongitudMin, `El DNI debe tener entre ${dniLongitudMin} y ${dniLongitudMax} dígitos`)
      .max(dniLongitudMax, `El DNI debe tener entre ${dniLongitudMin} y ${dniLongitudMax} dígitos`),
    fechaNacimiento: fechaCalendarioValidaSchema.refine(
      (d) => d <= new Date(),
      "La fecha de nacimiento no puede ser futura",
    ),
    genero: z.nativeEnum(Genero).optional(),
  });
}
export type IdentidadProfesorInput = z.infer<ReturnType<typeof construirIdentidadProfesorSchema>>;
```

**Utilidades nuevas a crear (§1, punto 6):**

- **`src/server/shared/fecha.ts` → `fechaCalendarioValidaSchema`:** `z.string()` (formato `YYYY-MM-DD`, el que produce un `<input type="date">`) parseado en forma **estricta** (ej. `date-fns` `parse` + `isValid`, o validación manual de componentes año/mes/día) que **rechaza** una fecha de calendario inexistente (`31/02`, `30/02`) en lugar de que `z.coerce.date()` la "corrija" reinterpretándola como el día siguiente válido. Devuelve un `Date`. Sin acoplamiento a "profesor" — reutilizable tal cual por HU-B-01 (Alumno).
- **`src/server/shared/texto.ts` → `normalizarTexto(valor: string): string`:** colapsa espacios múltiples internos a uno solo (`replace(/\s+/g, " ")`) sobre un valor ya `trim()`eado por el schema que la invoca. Mismo criterio de aceptación 2 de esta HU y de `spec_modulo_B.md` §2.1 — utilidad pura sin estado, reutilizable por cualquier módulo (Regla N.° 3 de `docs/RULES.md`: esto no es acoplamiento de dominio).

**DECISIÓN RESUELTA — formato del input de fecha:** `<input type="date">` nativo (valor `YYYY-MM-DD`, coincide con lo que espera `fechaCalendarioValidaSchema`), sin date picker de librería — no hay ninguno instalado en el proyecto (`package.json` no tiene `react-day-picker` ni similar). Se fija el atributo `max` al día de hoy (`new Date().toISOString().slice(0, 10)`, calculado en el Server Component y pasado como prop al formulario, no recalculado en el cliente) para bloquear fechas futuras como primera barrera de UX. **Esto no reemplaza la validación estricta del servidor:** el atributo `max` de un `<input type="date">` es una restricción del widget del navegador (algunos navegadores/OS igual permiten tipear o pegar un valor fuera de rango), y no tiene forma de rechazar una fecha de calendario inexistente — ambas cosas las sigue validando `fechaCalendarioValidaSchema` en el schema Zod, tanto en el `safeParse` de cliente (mismo schema importado) como, de forma no negociable, en el servidor.

### 4.2. Servicio

**Archivo:** `src/server/profesores/profesor.service.ts` (reemplaza el stub actual)
**Función:** `crearProfesor(input: IdentidadProfesorInput, usuarioRegistranteId: string): Promise<{ id: string; nombre: string; apellido: string; dni: string; activo: boolean }>`

Comportamiento exigido, en este orden (`spec_modulo_D.md` §2.1, con la corrección de §1 punto 4 — sin paso de emisión de evento):
1. Verificar unicidad aplicativa de `dni` contra **todos** los profesores, activos e inactivos (`prisma.profesor.findFirst({ where: { dniProfesor: input.dni } })`).
2. Si existe: lanzar `DNI_DUPLICADO`.
3. Insertar (`prisma.profesor.create`) con `activoProfesor: true`, `usuarioId: null` (§1 punto 4 de la nota de alcance / criterio de aceptación 5), `creadoPorUsuarioId: usuarioRegistranteId`. Envolver en `try/catch` capturando `P2002` sobre `dniProfesor` como defensa adicional ante una alta duplicada simultánea entre el paso 1 y el `INSERT` (mismo patrón que `spec_modulo_D.md` §2.1 punto 3 y `spec_modulo_B.md` §3.4) — se traduce igual a `DNI_DUPLICADO`.
4. Retornar los datos del profesor creado.

No hace falta `prisma.$transaction` multi-tabla: es una única sentencia `INSERT` en `Profesor`, ya atómica por sí misma — el `findFirst` previo reduce la ventana de duplicado, y `P2002` la cierra del todo.

**Resolución de `dni_longitud_min`/`dni_longitud_max`:** vía `getParametroNumerico("dni_longitud_min", 7)` y `getParametroNumerico("dni_longitud_max", 8)`, invocado desde el Route Handler/Server Action **antes** de llamar a `.safeParse()` (necesita ser `async`, a diferencia del resto del schema) — ver `construirIdentidadProfesorSchema()` en 4.1.

**Errores de servicio a definir:** `DNI_DUPLICADO`.

### 4.3. Route Handler

**Archivo:** `app/api/profesores/route.ts`
**Método:** `POST` (reemplaza el stub `501`; el `GET` existente se deja igual, es HU-D-05)
**Permiso de acceso:** `withPermission("profesores:crear")`

Flujo: resolver `dni_longitud_min/max` → `construirIdentidadProfesorSchema(min, max).safeParse(body)` → `400` con `flatten()` si falla (Regla N.° 6) → `crearProfesor(input, session.user.id)` → `201` con el shape estándar `{ data, error: null }`, o `409 { data: null, error: { code: "DNI_DUPLICADO", message: "Ya existe un profesor registrado con ese DNI" } }` si el servicio lanza ese código (Regla N.° 5).

### 4.4. Server Action

**Archivo:** `app/(dashboard)/profesores/actions.ts` (nuevo)
**Función:** `crearProfesor(_estadoAnterior: EstadoNuevoProfesor, formData: FormData): Promise<EstadoNuevoProfesor>`

Wrapper delgado sobre el mismo servicio (Regla N.° 4): `verificarPermiso("profesores:crear")` (`src/server/shared/with-permission.ts`) primero — si lanza `PermisoError`, traducir a un estado de error legible, nunca dejar que se propague sin capturar hacia el Client Component; luego mismo `safeParse` + invocación de `crearProfesor()` del servicio que el Route Handler. `revalidatePath("/profesores")` tras el alta exitosa (para que el listado, cuando exista vía HU-D-05, refleje el nuevo registro).

**Archivo:** `app/(dashboard)/profesores/profesor.types.ts` (nuevo) — `EstadoNuevoProfesor`, mismo patrón que `login.types.ts`:

```typescript
export type EstadoNuevoProfesor =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; profesorId: string; nombre: string; apellido: string };

export const ESTADO_INICIAL_NUEVO_PROFESOR: EstadoNuevoProfesor = { status: "idle" };
```

**Server Action adicional — verificación de DNI al salir del campo (DECISIÓN RESUELTA, ver punto abierto anterior de §5):**

**Archivo:** `app/(dashboard)/profesores/actions.ts` (mismo archivo que `crearProfesor()`)
**Función:** `verificarDniDisponible(dni: string): Promise<{ disponible: boolean; inactivo?: boolean }>`

Server Action separada y liviana, disparada en el `onBlur` del campo DNI — **no** reutiliza `crearProfesor()` en un modo "dry run", es una consulta de solo lectura propia:
1. `verificarPermiso("profesores:crear")` primero — misma superficie protegida que el alta real; sin esto, cualquier sesión con acceso al dashboard podría usar esta action como oráculo de DNIs existentes sin tener el rol Gerente.
2. Validar `dni` con el mismo fragmento de `IdentidadProfesorSchema` (formato + longitud) — si no es válido, retornar `{ disponible: true }` sin consultar la base (un DNI mal formado no es "no disponible", el propio campo ya marca su error de formato por separado).
3. `prisma.profesor.findFirst({ where: { dniProfesor: dni }, select: { activoProfesor: true } })` — contempla profesores activos **e inactivos** (criterio de aceptación 3). Funcionalmente equivalente a un `findUnique` (ya que `dniProfesor` es `@unique`); se usa `findFirst` por consistencia con el chequeo que ya hace `crearProfesor()`.
4. Si no hay coincidencia: `{ disponible: true }`. Si hay coincidencia: `{ disponible: false, inactivo: !resultado.activoProfesor }` — el flag `inactivo` queda disponible por si se quiere matizar el mensaje más adelante, sin ser obligatorio distinguirlo en esta task (alcanza con mostrar el mismo texto "Ya existe un profesor registrado con ese DNI" en ambos casos).

**No bloquea el submit:** el resultado solo pinta el error inline del campo DNI (mismo estilo `aria-invalid` + `role="alert"` que el resto). El usuario puede seguir completando y enviando el formulario igual — la verificación real y determinante contra duplicados simultáneos sigue siendo el `findFirst` + `P2002` dentro de `crearProfesor()` al confirmar (`spec_modulo_D.md` §2.1 punto 3): esta mini-action es exclusivamente una ayuda de UX para detectar el caso común antes del submit, nunca la fuente de verdad.

### 4.5. Eventos de dominio

**Fuera de alcance de esta task — ver §1, punto 4.** No se crea `lib/events/event-types.ts` ni ningún listener de `AuditLog` acá. Si esa infraestructura llega a existir antes del merge de esta HU (por resolución del equipo en el daily), esta sección se actualiza para emitir `profesor:creado` (`profesor_id, dni, usuario_registrante_id`) inmediatamente después del `INSERT` — pero no es una condición de bloqueo para dar por terminada esta task.

**Nota — mismo estado que el test runner (ver §6):** ambas son piezas de infraestructura transversal que ningún módulo, ni siquiera A, resolvió todavía. Se documentan acá juntas para que quede claro que no son un olvido de esta HU en particular, sino dos temas a plantear en el próximo daily del equipo.

**Nota — deuda técnica documentada: lista de valores de `Genero` duplicada en `profesor.schema.ts`.** `construirIdentidadProfesorSchema()` (§4.1) no usa `z.enum(Genero)` con el valor real exportado por `@prisma/client`, sino un array de strings hardcodeado (`GENERO_VALORES`). Motivo verificado, no hipotético: `profesor.schema.ts` se importa también desde un Client Component (el formulario, §5, reutiliza el mismo schema para la validación en cliente) y el `index.js` generado por Prisma hace `require('@prisma/client/runtime/library.js')` — el runtime completo del motor de consultas, con dependencias de Node (`fs`, `path`, etc.) — de forma **incondicional** en cuanto se importa cualquier export del paquete, aunque sea un enum. Confirmado con un build real de Next.js (Turbopack): con `import { Genero }` (valor) la fase de bundling fallaba al intentar resolver ese runtime en el bundle del navegador; con `import type { Genero }` (se borra en compilación) más el array hardcodeado, el build compila limpio.

El array usa `as const satisfies Genero[]`, así que TypeScript sí verifica en **compile-time** que esos 4 strings coincidan con los valores reales del enum — pero **no se actualiza solo**: si alguien agrega, renombra o quita un valor de `enum Genero` en `schema.prisma`, hay que actualizar `GENERO_VALORES` a mano en `profesor.schema.ts` (el `satisfies` va a marcar el desajuste como error de compilación si alguien lo olvida, pero no lo corrige). Vale la pena plantear en el daily si conviene un mecanismo más automático (ej. un script de generación) si este patrón se repite en más módulos — no es exclusivo de Profesor, cualquier otro enum de Prisma que un formulario necesite renderizar en un `<select>` va a pisar el mismo problema (HU-B-01 de Alumno, por ejemplo, con el mismo `Genero`).

---

## 5. Frontend

- **Ruta:** `app/(dashboard)/profesores/nuevo/page.tsx` (Server Component) — llama `verificarPermiso("profesores:crear")` antes de renderizar; si lanza `PermisoError` (rol distinto de Gerente), redirige a `/profesores` (defensa en profundidad, igual criterio que el layout del dashboard con la sesión — la superficie real de rechazo es el servidor, en la Server Action/Route Handler, no esta redirección client-side).
- **Formulario:** `app/(dashboard)/profesores/nuevo/nuevo-profesor-form.tsx` (Client Component), mismo patrón que `login-form.tsx`:
  - `"use client"`, sin `useActionState`/`<form action>` — invocación directa de `crearProfesor()` envuelta en `try/catch` (mismo motivo documentado en `login-form.tsx`: un fallo de transporte se escapa como excepción no controlada con el otro mecanismo).
  - Validación en cliente con el mismo `construirIdentidadProfesorSchema(min, max)` antes de enviar — los valores de `dni_longitud_min/max` se pasan como prop desde el Server Component (ya los resolvió para construir el schema del lado servidor, se reutilizan sin una segunda consulta).
  - Un campo por criterio de aceptación 1: Nombre, Apellido, DNI, Fecha de nacimiento (los cuatro con asterisco/indicador de obligatorio), Género (`<select>` con las 4 opciones del enum `Genero` + placeholder vacío, sin permitir texto libre — criterio de aceptación 1).
  - **DNI: verificación al salir del campo** (`onBlur`), además de la validación de formato — criterio de aceptación 3. Invoca `verificarDniDisponible(dni)` (§4.4) apenas el campo pierde el foco y el valor pasa la validación de formato local; si `disponible: false`, pinta el error inline "Ya existe un profesor registrado con ese DNI" (mismo estilo `aria-invalid` + `role="alert"`) **sin deshabilitar el botón de submit** — es una ayuda de UX, no un bloqueo; si el usuario edita el campo después de ese chequeo, el error se limpia hasta el próximo `onBlur`.
  - `aria-invalid` + `<p role="alert">` por campo, mismo patrón que `login-form.tsx`.
  - Botón "Registrar profesor" deshabilitado + `Loader2` mientras `pendiente`; error de comunicación con el mismo texto exacto que HU-A-01 usa como referencia de estilo: "No se pudo conectar. Intentá nuevamente".
  - **Éxito (criterio de aceptación 4):** mensaje "Profesor registrado correctamente" + dos acciones: "Continuar con contacto/materias/horarios" (navega a `/profesores/[id]` recién creado — hoy "en construcción", las HU-D-02/03/04 lo completan) y "Volver al listado" (`/profesores`).
  - **Cancelar (criterio de aceptación 6):** botón "Cancelar" que navega a `/profesores`; si `useDirtyState().dirty === true` (el formulario llamó `setDirty(true)` en el primer `onChange` de cualquier campo), pedir confirmación antes de navegar — `DirtyStateProvider` ya está montado en `app/(dashboard)/layout.tsx`, este formulario es el primero en consumirlo realmente (`setDirty(true)` al editar, `setDirty(false)` al desmontar o tras el alta exitosa).
  - **Sin alta parcial (criterio de aceptación 6):** si el `safeParse` de cliente falla, no se envía nada al servidor; si falla en servidor, ningún campo queda escrito (ya cubierto por el propio `crearProfesor()` del servicio, que no hace ningún `UPDATE` previo).

**Fuera de alcance de frontend:** contenido real de `/profesores` y `/profesores/[id]` (siguen "en construcción").

---

## 6. Testing (tres niveles, según metodología del proyecto)

**Nota — test runner pendiente de decisión de equipo (ver §4.5):** el repo no tiene todavía ningún test runner instalado (`vitest`, `jest`, etc.) ni script `test` en `package.json` — ninguna HU previa, ni siquiera las de Módulo A, lo introdujo. Esta task **ya escribió** el código de los tests del Nivel 1 correspondientes a las utilidades compartidas (`src/server/shared/fecha.test.ts`, `src/server/shared/texto.test.ts`, en sintaxis Vitest) y los que se detallan abajo para `profesor.service.ts`, pero **no se instaló ninguna dependencia nueva ni se tocó `package.json`** — instalar el runner es una decisión de infraestructura compartida (afecta a Cali, Adriel y Emir por igual) que se resuelve en conjunto, no unilateralmente desde esta HU. Hasta que el equipo lo decida, estos tests quedan escritos pero no ejecutables.

**Consecuencia sobre el build y ajuste aplicado:** como `tsconfig.json` incluye `**/*.ts` y `vitest` no está instalado, `next build` (que corre el type-check de TypeScript sobre ese mismo `tsconfig.json`) fallaba con `TS2307: Cannot find module 'vitest'` en `fecha.test.ts` y `texto.test.ts` desde el momento en que esos archivos existieron — no es una regresión de configuración (`tsconfig.json`/`next.config.ts` no cambiaron desde HU-A-01). Ajuste mínimo, sin instalar nada: `"exclude": ["node_modules", "**/*.test.ts", "**/*.test.tsx"]` en `tsconfig.json`, así los tests no entran al type-check de la app. Cuando el equipo instale el runner, Vitest los compila por su cuenta (no depende del `include` del `tsconfig`), así que la exclusión puede quedar; si se quiere type-check de los tests, lo correcto es un `tsconfig.test.json` aparte, no revertir esto.

### Nivel 1 — Unitarios (sobre `profesor.service.ts`)
- Alta exitosa con datos válidos → retorna el profesor creado con `activoProfesor: true`, `usuarioId: null`.
- DNI ya existente en un profesor **activo** → `DNI_DUPLICADO`, no se crea nada.
- DNI ya existente en un profesor **inactivo** → también `DNI_DUPLICADO` (criterio de aceptación 3: "no puede pertenecer a otro profesor activo o inactivo").
- Alta duplicada simulada en la ventana entre el `findFirst` y el `INSERT` (mock forzando `P2002`) → se traduce igual a `DNI_DUPLICADO`, nunca un error 500 sin traducir.
- Nombre/apellido con espacios múltiples internos (`"Ana   María"`) → se persiste normalizado (`"Ana María"`).
- Fecha de nacimiento futura → rechazada por el schema Zod, nunca llega al servicio.
- Fecha de nacimiento inexistente (`31/02/2000`) → rechazada por `fechaCalendarioValidaSchema`, no reinterpretada como otra fecha.
- Género ausente (`undefined`) → alta exitosa con `generoProfesor: null`.
- `verificarDniDisponible()`: DNI de un profesor activo existente → `{ disponible: false, inactivo: false }`. DNI de un profesor inactivo existente → `{ disponible: false, inactivo: true }`. DNI que no existe → `{ disponible: true }`. DNI con formato inválido → `{ disponible: true }` sin llegar a consultar la base (mock/spy sobre `prisma.profesor.findFirst`). Invocada sin sesión de Gerente → lanza `PermisoError` / `SIN_PERMISO`, igual que `crearProfesor()`.

### Nivel 2 — Postman
- `POST /api/profesores` con datos válidos, sesión de Gerente → `201`, cuerpo conforme al contrato de `spec_modulo_D.md` §2.1.
- Mismo request con sesión de un rol distinto de Gerente (ej. Mesa de Entrada) → `403 SIN_PERMISO`.
- Mismo request sin sesión → `401 SESION_INVALIDA`.
- DNI duplicado (activo e inactivo, dos casos) → `409 DNI_DUPLICADO`.
- Nombre con dígitos o símbolos no permitidos → `400`, `flatten()` de Zod con el error en el campo `nombre`.
- Fecha de nacimiento futura → `400` en el campo `fechaNacimiento`.

### Nivel 3 — BD / TablePlus
- Verificar la fila creada en `profesores`: `activo_profesor = true`, `usuario_id IS NULL`, `creado_por_usuario_id` = el Gerente que hizo el alta, `created_at_profesor` con la fecha/hora real de la operación.
- Verificar que el `dni_profesor` insertado respeta el constraint único (`P2002`) probando un `INSERT` manual duplicado desde TablePlus.
- `AuditLog`: **no aplica en esta task** (§1 punto 4) — documentar explícitamente como "Fuera de alcance, ver nota de infraestructura pendiente", nunca como si hubiera pasado.

**Evidencia esperada:** Postman + SQL para el contrato de API y la capa de datos; capturas de la pantalla "Nuevo profesor" en sus estados (vacío, con errores por campo, cargando, éxito con las dos acciones de continuar).

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar.
- [x] `<input type="date">` nativo con `max` fijado a la fecha de hoy menos 18 años (`fechaMaximaNacimiento`, ver §8.1; originalmente era la fecha de hoy) en el campo Fecha de nacimiento; `fechaCalendarioValidaSchema` sigue siendo la validación determinante en el servidor (el `max` del input es solo primera barrera de UX, no la reemplaza). Verificado en navegador (caso 3).
- [x] `verificarDniDisponible()` implementada como Server Action separada (`app/(dashboard)/profesores/actions.ts`), gateada por `verificarPermiso("profesores:crear")`, disparada en `onBlur` del campo DNI, sin bloquear el submit. Verificado en navegador (caso 2, 2 requests reales confirmadas por red).
- [x] `fechaCalendarioValidaSchema` y `normalizarTexto()` creadas en `src/server/shared/` sin acoplamiento a "profesor", listas para que HU-B-01 las reutilice.
- [x] Fila `profesores:crear` agregada al bloque `RolPermiso` de `prisma/seed.ts`, exclusiva de `GERENTE`. Verificado corriendo el seed real contra la base y con una consulta SQL directa.
- [x] Service, Route Handler y Server Action implementados, sin lógica de negocio fuera de `profesor.service.ts`. `POST /app/api/profesores/route.ts` implementado como wrapper delgado sobre el mismo servicio, mismo patrón que `ping/route.ts` y `logout/route.ts`.
- [x] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos (`201`, `400`, `401`, `403`, `409`). Verificado con requests `curl` reales contra los seis casos (caso 5).
- [x] `withPermission("profesores:crear")` / `verificarPermiso("profesores:crear")` cubre las dos superficies (Route Handler y Server Action) — un rol distinto de Gerente es rechazado por el servidor en ambas, no solo ocultado en el cliente. Verificado con curl (403 con sesión de Profesor) y con la redirección server-side de `nuevo/page.tsx`.
- [x] Frontend funcional: formulario con los 4 campos obligatorios + género opcional, errores inline por campo, loading state, mensaje de éxito con las dos acciones de continuar, Cancelar con confirmación vía `DirtyStateProvider` cuando hay datos cargados. Probado end-to-end en navegador real, logueado como Gerente (casos 1-4).
- [x] Ningún `DELETE` físico en ningún punto del código.
- [x] Sin alta parcial: un DNI duplicado o cualquier otro rechazo del servicio no deja ninguna fila creada. Verificado con curl (409) y en navegador (caso 2): ningún intento duplicado creó una fila.
- [x] Eventos de dominio / `AuditLog` explícitamente fuera de alcance (§1 punto 4) — no bloquea el DoD, pero el punto quedó planteado para el próximo daily del equipo.
- [x] Tests de los 3 niveles documentados con evidencia (Nivel 3 de `AuditLog` documentado como "Fuera de alcance", nunca como si hubiera pasado). Nivel 1 queda como "Código escrito, no ejecutado — sin test runner instalado (ver §4.5)", pendiente de decisión de equipo; eso no bloquea el resto del DoD, que sí se verificó por otras vías (build real, curl, navegador).
- [ ] PR con diff acotado exclusivamente a HU-D-01 (sin adelantar contacto, materias, horario ni listado — esas son HU-D-02/03/04/05). Pendiente: acción del usuario, no de esta implementación.

---

## 8. Desviaciones de la spec original

### 8.1. Validación de mayoría de edad (18 años cumplidos) en Fecha de nacimiento

- **Origen:** regla de negocio agregada **por decisión del usuario durante la implementación**. No estaba en `spec_modulo_D.md` ni en los criterios de aceptación de HU-D-01 tal como fueron redactados originalmente.
- **Qué hace:** `fechaNacimiento` en `construirIdentidadProfesorSchema()` (`src/server/profesores/profesor.schema.ts`) suma un segundo `.refine()` que rechaza cualquier fecha posterior a "hoy en UTC menos 18 años exactos", con el mensaje *"El profesor debe ser mayor de edad (18 años cumplidos)"*. El refine de "no futura" se mantiene tal cual.
- **Cálculo:** helper `fechaUTCHaceAnios(anios, ahora?)` en `src/server/shared/fecha.ts`, mismo criterio UTC que `fechaCalendarioValidaSchema` (calendario contra calendario, sin `new Date()` en hora local del servidor). Caso borde: si hoy es 29/02 y el año destino no es bisiesto, el límite se clampa al 28/02 en vez de dejar que `Date.UTC()` rebalancee al 01/03.
- **Frontend:** `nuevo/page.tsx` calcula `fechaMaximaNacimiento` (YYYY-MM-DD) con el mismo helper y la pasa al formulario; `nuevo-profesor-form.tsx` la usa como `max` del `<input type="date">`, así el date picker nativo ya no ofrece fechas de menos de 18 años. El servidor sigue siendo la validación determinante si alguien bypasea el `max`.
- **Punto abierto para el próximo daily:** si esta regla debería aplicarse también a HU-B-01 (Alumno, de Adriel). Es razonable que un alumno de un centro de atención académica tenga también un mínimo de edad, aunque no necesariamente 18 — **no se asume acá**; se plantea al equipo.
- **Verificación:** `tsc --noEmit` y `next build` OK con el repo tal como queda (tests excluidos del `tsconfig.json`, ver nota de consecuencia sobre el build en §6). Schema ejecutado con `tsx` contra fechas borde: 18 años exactos → aceptada; 18 años menos 1 día y 17 años → rechazadas con el mensaje nuevo; clamp 29/02 → 28/02 confirmado. **Pendiente de verificación manual en navegador:** que el date picker no ofrezca fechas posteriores a `fechaMaximaNacimiento` y que el submit con una fecha de hace 17 años muestre el error inline.
