```markdown
# Especificación Técnica — Módulo D (Profesor)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 7, 10) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (patrón de contacto/DNI, como referencia de diseño) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-D-01 (Identidad), HU-D-02 (Contacto), HU-D-03 (Asociación a materias), HU-D-04 (Horario de atención), HU-D-05 (Listado) — Sprint 1.

**Changelog (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-03 | §2.3 contractualizada en snake_case, con rutas `lib/`/`app/` y `@@unique`; §4 declara el evento `profesor:materias_asociadas` | Anotada §2.3 (nota de sincronización) y §4 (el módulo D usa la opción (a) de la Regla N.° 2). Sin renumerar. |
| HU-D-04 | §2.4 contractualizada en snake_case con días fijos L-S y `GRANULARIDAD_MINUTOS` constante; §4 declara `profesor:horario_registrado` | Anotada §2.4 (nota de sincronización + "Contrato para HU-C-04") y §4. Días, franja y granularidad salen de `ParametroSistema`. Sin renumerar. |

**Fuera de alcance de esta spec (explícito):**
- Modificación de una ficha de profesor ya registrada.
- Baja lógica / reactivación del profesor.
- Gestión de la cuenta de acceso del profesor: alta, vinculación o administración de su `Usuario` — se gestiona por un proceso independiente, fuera de esta spec (ver nota de aislamiento en sección 1).

---

## 1. Visión General

El Módulo D gestiona la ficha del Profesor: identidad, contacto, las materias que puede dictar y su horario recurrente de atención semanal — insumos que HU-C-04 (`spec_modulo_C.md`) consulta para validar disponibilidad al asignar un profesor a un turno.

**Nota explícita — sin cuenta de acceso en esta spec:** a diferencia del Módulo B (Alumno), registrar una ficha de Profesor **no** crea ni vincula ninguna cuenta (`Usuario`) de forma automática. El criterio de aceptación de HU-D-01 lo establece de forma explícita: "las cuentas se administran de manera independiente". El campo de vínculo (`Profesor.usuario_id`, si el modelo de datos lo contempla) permanece sin asignar durante todo este sprint; el proceso que eventualmente lo complete es responsabilidad de una HU futura, no de esta.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `lib/services/profesores/*.service.ts` (Regla N.° 4 de `docs/RULES.md`). Los schemas de identidad y contacto reutilizan las mismas utilidades compartidas que `spec_modulo_B.md` (`fechaCalendarioValidaSchema`, `normalizarTexto()`, `normalizarTelefono()`) — utilidades de validación transversales, no acoplamiento de dominio: reutilizar una función de `lib/utils/` o `lib/schemas/shared/` no viola la Regla N.° 3 de aislamiento, que aplica a datos y lógica de negocio de otro módulo, no a utilidades puras sin estado.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Profesor`, `Materia` y `HorarioProfesor` son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo. El parámetro `[id]` refiere a `Profesor`.
- Toda ruta requiere `withPermission("profesores:<accion>")` (Regla N.° 10).

---

### 2.1. Alta de identidad del profesor (HU-D-01)

**Ruta:** `POST /app/api/profesores/route.ts`
**Server Action equivalente:** `crearProfesor()` en `app/(dashboard)/profesores/actions.ts`
**Permiso requerido:** `profesores:crear` (exclusivo del rol Gerente)

```typescript
// lib/schemas/profesores.schema.ts
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

**Comportamiento esperado (`lib/services/profesores/profesor.service.ts` → `crearProfesor`):**
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

---

### 2.2. Registrar datos de contacto (HU-D-02)

**Ruta:** `PATCH /app/api/profesores/[id]/contacto/route.ts`
**Server Action equivalente:** `actualizarContactoProfesor()` en `app/(dashboard)/profesores/actions.ts`
**Permiso requerido:** `profesores:editar`

```typescript
export const ContactoProfesorSchema = z.object({
  telefono: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254).optional(),
}).refine((d) => d.telefono || d.email, {
  message: "Ingresá al menos un teléfono o un email de contacto",
  path: ["telefono"],
});
export type ContactoProfesorInput = z.infer<typeof ContactoProfesorSchema>;
```

**Comportamiento esperado:**
1. `telefono`: misma normalización que `spec_modulo_B.md` §2.2 (`lib/utils/normalizar-telefono.ts`, 8-15 dígitos, conserva `+` inicial).
2. `email`: si se provee, se valida su unicidad contra `Usuario.email` de cualquier cuenta existente — **defensivo**, ya que este módulo no crea cuentas, pero el email de contacto podría coincidir con uno ya usado por otra cuenta si en el futuro se vincula manualmente; el aviso no revela a quién pertenece (`409 EMAIL_YA_ASOCIADO`), mismo criterio que `spec_modulo_B.md` §2.2.
3. Actualiza únicamente los campos provistos, `updated_at`.
4. Emitir `profesor:contacto_actualizado` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "telefono": "+5493874445566", "email": "ana.gomez@mail.com" }, "error": null }
```

---

### 2.3. Asociar profesor a materias (HU-D-03)

**Ruta:** `POST /app/api/profesores/[id]/materias/route.ts`
**Server Action equivalente:** `asociarMateriasProfesor()` en `app/(dashboard)/profesores/actions.ts`
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

**Ruta:** `POST /app/api/profesores/[id]/horarios/route.ts`
**Server Action equivalente:** `registrarHorarioProfesor()` en `app/(dashboard)/profesores/actions.ts`
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
  throw new ServiceError("FUERA_DE_HORARIO_PROFESOR", "El turno está fuera del horario de atención del profesor");
}

// Llamada directa, fuera de una transacción (usa el cliente global):
await estaDentroDeHorarioAtencion(profesorId, new Date(Date.UTC(2026, 8, 21)), "10:00", "12:00"); // lunes
```

---

### 2.5. Listado y detalle de profesores (HU-D-05)

**Ruta (listado):** `GET /app/api/profesores/route.ts`
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

**Ruta (detalle):** `GET /app/api/profesores/[id]/route.ts` — identidad completa, contacto, listado completo de materias asociadas, y horarios **agrupados por día de la semana** (resumen semanal legible, ej. `{ LUNES: [{hora_inicio, hora_fin}], MARTES: [...] }`).

**Respuesta `200 OK` (detalle):**
```json
{
  "data": {
    "id": "cuid",
    "apellido": "Gómez", "nombre": "Ana", "dni": "28456789", "is_active": true,
    "contacto": { "telefono": "+5493874445566", "email": "ana.gomez@mail.com" },
    "materias": [{ "id": "cuid", "nombre": "Matemática", "codigo": "MAT101" }],
    "horarios": { "LUNES": [{ "hora_inicio": "10:00", "hora_fin": "12:00" }], "MARTES": [] }
  },
  "error": null
}
```

**Nota de sincronización (HU-D-05, resuelta):**
- **Rutas reales (Regla N.° 11):**
  - Servicios `listarProfesores(query)`, `obtenerDetalleProfesor(id)` y `listarOpcionesProfesoresActivos()` en `src/server/profesores/profesor.service.ts`.
  - Schema `ListarProfesoresQuerySchema` en `src/server/profesores/profesor.schema.ts`.
  - Helpers puros en `src/lib/profesor-listado.ts` (`resumirMaterias`, `clavesOrdenProfesor`) y en `src/lib/horario-atencion.ts` (`agruparHorariosPorDia`, `formatearIntervalos`).
  - UI: `/profesores?pagina=N` y `/profesores/[id]?pagina=N`. Route Handlers `GET /api/profesores` y `GET /api/profesores/[id]`.
- **Orden:** columnas `apellidoNormalizadoProfesor` / `nombreNormalizadoProfesor` (con `normalizarTexto()`, igual que Alumno en HU-B-04), más `dniProfesor` como desempate. Migración `20260923200000_profesor_nombre_normalizado_y_leer_permiso`, que también completa las filas existentes.
- **Permiso:** `profesores:leer`, exclusivo de Gerente (migración + seed). El detalle muestra los accesos de edición de HU-D-02/03/04 solo con `profesores:editar`.
- **camelCase**, igual que HU-D-03/04. El detalle devuelve `{ ..., contacto: { telefono, email }, horarios: { LUNES: [{ horaInicio, horaFin }] } }`. Solo aparecen los días que tienen horarios.
- **Materias:** se ordenan por nombre normalizado. El listado muestra las 2 primeras y un contador (`"Física, Matemática +2"`); el detalle, todas.
- **Contrato para HU-J-01:** `listarOpcionesProfesoresActivos(): Promise<{ id: string; nombreParaMostrar: string }[]>`. Devuelve los activos con el mismo orden que el listado; `nombreParaMostrar` es `"Apellido, Nombre"`.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `lib/services/profesores/*.service.ts`, conforme a la Regla N.° 4 de `docs/RULES.md`.

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

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite después del `COMMIT`.

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
```