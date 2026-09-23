# TASK: HU-D-04 — Registrar horario de atención del profesor

**Módulo:** D (Profesor) — Gestionar profesores
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` §2.4 (con nota de sincronización HU-D-04 y "Contrato para HU-C-04") · reglas §3.4 y §3.5 · eventos §4 (ver §1 punto 7 de esta task) · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-D-04, criterios de aceptación 1-6
**RBAC:** sin cambios. Se reutiliza `profesores:editar`, que ya existe en `RolPermiso` y es exclusivo de `GERENTE` (lo agregó HU-D-02). `rutas-por-rol.ts` ya restringe `/profesores/**` a `GERENTE`.
**Schema:** sin migración. `model HorarioProfesor` ya existía (migración `init_sprint1`) con `diaSemanaHorario DiaSemana`, `horaDesdeHorario` / `horaHastaHorario @db.Time` y las columnas de auditoría `createdAtHorario` y `creadoPorUsuarioId`.
**Implementación:** commit `eb91222` ("feat: Registrar horario de atención de profesor"), mergeado a `develop` en `eb0c392` (PR #54). Este documento se escribió **después** de la implementación, a partir de ese commit y del código actual.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Los puntos marcados como **"relevar antes de asumir"** en esta task, con la pregunta concreta.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

**Nota — task documentada a posteriori:** HU-D-04 se implementó sin un documento de task previo. Este archivo registra lo que realmente quedó en el código; las decisiones de §1 se reconstruyeron a partir del código, sus comentarios y la nota de sincronización que la propia HU dejó en `spec_modulo_D.md` §2.4.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

1. **DECISIÓN RESUELTA — modelo `HorarioProfesor` existente, sin cambios de schema.**
   - El modelo ya tenía todo lo que pide la HU: día de la semana, hora desde/hasta como `@db.Time` (igual que `Turno.horaInicioTurno`) y auditoría (`createdAtHorario`, `creadoPorUsuarioId`).
   - **No tiene fecha ni materia:** representa un patrón semanal recurrente, independiente de la materia (criterio 2, spec §3.5).
   - Prisma lee `@db.Time` como un `Date` sobre 1970-01-01 en UTC. La única conversión entre ese formato y los minutos desde las 00:00 está en `minutosDeTime()` / `timeDeMinutos()` de `profesor.service.ts`. La UI y los contratos usan siempre `"HH:mm"`.

2. **DECISIÓN RESUELTA — parámetros operativos leídos de `ParametroSistema`, nunca hardcodeados.**
   - La spec original fijaba días L-S y una constante `GRANULARIDAD_MINUTOS`. Se reemplazó por `obtenerParametrosHorarioOperativo()` (`src/server/shared/parametros.ts`), que lee las **mismas claves que Turnos** (`src/server/turnos/turno.validaciones.ts`), con los mismos valores por defecto:

     | Clave | Uso | Por defecto |
     |---|---|---|
     | `dias_operativos` | Días en que atiende el centro | `LUNES,…,VIERNES` |
     | `horario_operativo_desde` | Apertura | `08:00` |
     | `horario_operativo_hasta` | Cierre | `20:00` |
     | `granularidad_turno_minutos` | Bloques de hora | `30` |

   - Un valor ausente o mal cargado cae al valor por defecto en vez de romper el flujo: días desconocidos se descartan, una hora sin formato `HH:mm` o una apertura posterior al cierre vuelven a los valores por defecto, y la granularidad tiene que ser un entero entre 1 y 60. Los días se devuelven en orden de la semana y sin repetidos.
   - El schema se construye con esos valores (`construirRegistrarHorarioSchema(parametros)`), mismo patrón que `construirIdentidadProfesorSchema` con la longitud del DNI. En el cliente llegan como props de la página, leídos en el servidor.

3. **DECISIÓN RESUELTA — intervalos semiabiertos `[inicio, fin)`.**
   - Regla única de superposición del proyecto (spec §3.4): `a.inicio < b.fin && b.inicio < a.fin`, en `intervalosSeSuperponen()` (`src/lib/horario-atencion.ts`).
   - Los contiguos (`10:00–12:00` y `12:00–14:00`) **no** se superponen (criterio 4).
   - Otros módulos que necesiten la misma validación (ej. HU-C-04) deben reutilizar esta función, no reimplementarla.

4. **DECISIÓN RESUELTA — una sola regla de intervalo para schema, servicio y seed.**
   - `validarIntervaloHorario(intervalo, parametros)` concentra las reglas que no dependen de la base: día operativo, granularidad, inicio < fin y franja operativa. Devuelve el primer error como `{ codigo, campo, mensaje }` o `null`.
   - La usan el schema Zod (cliente y servidor), el servicio (revalida por si se invoca sin el schema o el parámetro cambió entre el formulario y la confirmación) y `prisma/seed.ts` (`validarDatos()`). Las tres capas aplican exactamente la misma regla.
   - La superposición la valida **solo el servicio**, porque necesita la base.

5. **DECISIÓN RESUELTA — concurrencia (Regla N.° 7) con el mismo patrón que HU-D-03.**
   - Dentro de una única `$transaction`, el primer paso es `tx.profesor.updateMany({ where: { idProfesor, activoProfesor: true }, data: { modificadoPorUsuarioId } })`: condición (profesor activo) y mutación en una sola sentencia.
   - Además, ese `UPDATE` deja **bloqueada la fila del profesor** hasta el commit. Si llegan dos altas simultáneas para el mismo profesor, la segunda espera, y cuando sigue ve el intervalo que insertó la primera, así que se rechaza por superposición. Sin ese bloqueo, las dos podrían pasar el chequeo de superposición a la vez.

6. **DECISIÓN RESUELTA — códigos de error.**

   | Caso | Código | Server Action | Route Handler |
   |---|---|---|---|
   | Día no operativo | `DIA_NO_OPERATIVO` | error del campo `diaSemana` | `400 VALIDACION` |
   | Hora fuera de la granularidad | `HORA_NO_GRANULAR` | error del campo | `400 VALIDACION` |
   | Inicio igual o posterior al fin | `HORARIO_INVERTIDO` | error del campo `horaFin` | `400 VALIDACION` |
   | Fuera de la franja operativa | `FUERA_DE_HORARIO_OPERATIVO` | error del campo, con la franja: "El horario debe estar dentro del horario operativo del centro (08:00 a 20:00)" | `400 VALIDACION` |
   | Profesor inexistente | `PROFESOR_NO_ENCONTRADO` | "El profesor ya no existe" | `404` |
   | Profesor inactivo | `PROFESOR_INACTIVO` | "Solo pueden registrarse horarios de profesores activos" | `409` |
   | Superposición | `HORARIO_SUPERPUESTO` | error general con `mensajeSuperposicion()`: "El intervalo se superpone con Lunes 10:00–12:00" | `409`, mismo mensaje |

   El servicio transporta el detalle en `ServiceError.detalles` (el campo del error de intervalo, o el día y las horas del intervalo en conflicto). El texto de UI se arma en la capa delgada (Regla N.° 5).

7. **DECISIÓN RESUELTA — trazabilidad (Regla N.° 2): opción (a), columnas de auditoría.**
   - La spec §4 lista el evento `profesor:horario_registrado`; no se emite (mismo criterio que HU-D-03, anotado en la spec §4).
   - Cada intervalo es el alta de una fila: `createdAtHorario` y `creadoPorUsuarioId` registran qué se registró, cuándo y quién.
   - El `updateMany` del punto 5 además actualiza `Profesor.modificadoPorUsuarioId` y `updatedAtProfesor`.

8. **DECISIÓN RESUELTA — ubicación de los archivos (Regla N.° 11) y nomenclatura camelCase.**
   - Action en `src/server/profesores/actions.ts` (junto a la de HU-D-03), schema en `profesor.schema.ts`, servicio en `profesor.service.ts`, tipos en `src/types/profesor.types.ts`.
   - Helpers puros en `src/lib/horario-atencion.ts`, **sin** importar Prisma como valor: los usa el schema, que también corre en el cliente. `DIAS_SEMANA` es un array literal con `satisfies DiaSemana[]`, mismo criterio que `GENERO_VALORES` de HU-D-01.
   - Payload camelCase `{ diaSemana, horaInicio, horaFin }`, igual que HU-D-03; la spec original estaba en snake_case (`dia_semana`, `hora_inicio`, `hora_fin`).

9. **DECISIÓN RESUELTA — solo profesores activos (criterio 1), en tres lugares.**
   - El selector usa `listarProfesoresActivos()`; un `?profesorId=` inactivo o inexistente en la URL se ignora.
   - En la ficha de un profesor inactivo, la acción "Registrar horario" se reemplaza por el texto "Solo pueden registrarse horarios de profesores activos".
   - El servicio lo garantiza de todos modos con el `updateMany` condicionado (`PROFESOR_INACTIVO`).

**Dependencias de esta implementación:**
- **Depende de:**
  - HU-D-01: entidad `Profesor` y alta.
  - Código de HU-D-02 y HU-D-03: permiso `profesores:editar`, `modificadoPorUsuarioId`, ficha con `FichaSeccion`, `ServiceError` con `detalles`, `ConfirmarDescarteDialog` y `enfocarPrimerCampoInvalido`.
- **Es requisito de:** HU-C-04 (Emir), que valida la disponibilidad del profesor con `estaDentroDeHorarioAtencion()` (§4.6).
- **No depende de:** HU-D-05 (listado y detalle), que reutiliza después `obtenerHorariosDelProfesor()` y `ResumenSemanalHorarios`.

**Fuera de alcance de esta task (explícito):**
- Modificar o eliminar un intervalo ya registrado. El código de la HU no tiene `update` ni `delete` sobre `horarios_profesor` (el único `deleteMany` es el del seed, que recrea sus propios horarios).
- Combinar intervalos contiguos en uno solo.
- Validar turnos contra el horario: es de HU-C-04, que consume el contrato de §4.6.
- Tabla `EventoProfesor` o emisión de eventos (punto 7).

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** registrar los días y horarios de atención de un profesor
**Para** validar su disponibilidad al asignar turnos

**SP estimado:** 1

**Justificación de secuencia (`HU-Sprint-1.md`):** depende de HU-D-01. Requisito de HU-C-04: la disponibilidad se valida contra este horario.

### 2.1. Criterios de aceptación y dónde se cumplen

| # | Criterio (`HU-Sprint-1.md`) | Cómo se cumple | Dónde |
|---|---|---|---|
| 1 | El formulario solicita Profesor, Día de la semana, Hora de inicio y Hora de fin. Solo profesores activos. Horas en formato 24 h que respetan la granularidad configurada. | Cuatro `<select>` obligatorios. Profesores activos en el selector, en la ficha y en el servicio (§1 punto 9). Las horas se ofrecen en `HH:mm` con `generarHoras()` en pasos de la granularidad; el schema exige `HORA_REGEX` (24 h) y `validarIntervaloHorario()` rechaza horas fuera de la granularidad. | `registrar-horario-form.tsx`, `horarios/nuevo/page.tsx`, `listarProfesoresActivos()`, `ficha-horarios.tsx`, `construirRegistrarHorarioSchema()`, `horario-atencion.ts` |
| 2 | El horario se registra para el profesor, independiente de la materia; se aplica todas las semanas (recurrente). | `HorarioProfesor` no tiene fecha ni materia (§1 punto 1). La pantalla lo aclara: "El intervalo se repite todas las semanas, para todas las materias del profesor." | `schema.prisma` (sin cambios), `horarios/nuevo/page.tsx` |
| 3 | Inicio anterior al fin; el intervalo dentro del horario operativo del centro. Fuera de la franja se rechaza indicando la franja permitida. Solo días en que el centro atiende. | `validarIntervaloHorario()`: `HORARIO_INVERTIDO`, `FUERA_DE_HORARIO_OPERATIVO` (con "08:00 a 20:00" según los parámetros vigentes) y `DIA_NO_OPERATIVO`. El selector de día solo ofrece los días operativos y el de horas solo la franja. La página muestra la franja: "Horario operativo del centro: 08:00 a 20:00". | `horario-atencion.ts`, `parametros.ts`, `profesor.schema.ts`, `profesor.service.ts`, `registrar-horario-form.tsx` |
| 4 | Pueden registrarse varios intervalos por día si no se superponen; los contiguos no se consideran superpuestos. | `intervalosSeSuperponen()` con intervalos semiabiertos (§1 punto 3). Tras guardar, el formulario conserva profesor y día y limpia solo las horas, para cargar otro intervalo del mismo día. | `horario-atencion.ts`, `registrarHorarioProfesor()`, `registrar-horario-form.tsx` |
| 5 | Ante superposición, se identifica día e intervalo en conflicto y no se guarda (ej. "El intervalo se superpone con Lunes 10:00–12:00"). | El servicio busca los intervalos del mismo profesor y día dentro de la transacción; si alguno se superpone, lanza `HORARIO_SUPERPUESTO` con ese intervalo **antes** del `INSERT`. `mensajeSuperposicion()` arma el texto exacto. | `profesor.service.ts`, `src/server/profesores/actions.ts`, `api/profesores/[id]/horarios/route.ts`, `horario-atencion.ts` |
| 6 | Con datos válidos, el intervalo queda disponible para validar turnos: "Horario registrado correctamente". | `INSERT` dentro de la transacción. El formulario muestra el mensaje exacto más el intervalo ("Lunes 12:00–13:00") y refresca el resumen semanal (`router.refresh()` + `revalidatePath`). Queda disponible para `estaDentroDeHorarioAtencion()` (§4.6). | `registrar-horario-form.tsx`, `profesor.service.ts`, `resumen-semanal-horarios.tsx` |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_D.md` §2.4, §3.4 y §3.5, con las decisiones de §1.

### 3.1. Desglose en subtareas técnicas

- [x] **Helpers puros** (`src/lib/horario-atencion.ts`): `DIAS_SEMANA`, `ETIQUETA_DIA`, `diaSemanaDeFecha`, `HORA_REGEX`, `horaAMinutos` / `minutosAHora`, `intervalosSeSuperponen`, `intervaloContenido`, `generarHoras`, `validarIntervaloHorario`, `mensajeSuperposicion` y los tipos `DiaSemanaValor`, `IntervaloMinutos`, `ParametrosHorarioOperativo`, `ErrorIntervaloHorario` (§4.1).
- [x] **Lectura de parámetros operativos** (`src/server/shared/parametros.ts`): `obtenerParametrosHorarioOperativo()` (§1 punto 2).
- [x] **Schema Zod:** `construirRegistrarHorarioSchema(parametros)` en `profesor.schema.ts` (§4.2).
- [x] **Servicio transaccional** con control de superposición y concurrencia: `registrarHorarioProfesor()`, más `listarProfesoresActivos()`, `obtenerHorariosDelProfesor()` y `estaDentroDeHorarioAtencion()` (§4.3).
- [x] **Server Action** `registrarHorarioProfesor(formData)` y **Route Handler** `POST /api/profesores/[id]/horarios` (§4.4 y §4.5).
- [x] **Componente** `ResumenSemanalHorarios` (`src/components/shared/resumen-semanal-horarios.tsx`) (§5).
- [x] **Sección de la ficha** del profesor: `FichaHorarios` (§5).
- [x] **Página y formulario** `/profesores/horarios/nuevo` (§5).
- [x] **Enlace desde el alta de HU-D-01**: "Registrar horario de atención" en la pantalla de éxito (§5).
- [x] **Actualización de `seed.ts`** (§4.7).
- [x] **Tests unitarios**: `src/lib/horario-atencion.test.ts`, 21 tests (§6).
- [x] **Documentación** en `spec_modulo_D.md` §2.4: nota de sincronización y "Contrato para HU-C-04" (§4.8).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Migraciones o cambios de schema.
- `update` o `delete` sobre `horarios_profesor` desde la aplicación.
- Validar turnos contra el horario (HU-C-04).
- Emitir eventos de dominio.

### 3.2. Archivos creados

| Archivo | Qué hace |
|---|---|
| `src/lib/horario-atencion.ts` | Helpers puros de horarios, compartidos por cliente, servidor y seed (§4.1) |
| `src/lib/horario-atencion.test.ts` | 21 tests unitarios de los helpers y del schema (§6) |
| `src/app/api/profesores/[id]/horarios/route.ts` | `POST` delgado con `withPermission("profesores:editar")` (§4.5) |
| `src/app/(dashboard)/profesores/horarios/nuevo/page.tsx` | Server Component: permiso, parámetros, profesores activos, preselección por `?profesorId=` y resumen semanal |
| `src/app/(dashboard)/profesores/horarios/nuevo/registrar-horario-form.tsx` | Formulario cliente con selects controlados, validación, envío, éxito y cancelar |
| `src/app/(dashboard)/profesores/[id]/ficha-horarios.tsx` | Sección "Horario de atención" de la ficha |
| `src/components/shared/resumen-semanal-horarios.tsx` | Resumen de intervalos agrupados por día, en orden de semana y por hora de inicio |

### 3.3. Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `src/server/shared/parametros.ts` | Agrega `obtenerParametrosHorarioOperativo()` |
| `src/server/profesores/profesor.schema.ts` | Agrega `construirRegistrarHorarioSchema()` y `RegistrarHorarioInput` |
| `src/server/profesores/profesor.service.ts` | Agrega `listarProfesoresActivos()`, `obtenerHorariosDelProfesor()`, `registrarHorarioProfesor()`, `estaDentroDeHorarioAtencion()` y re-exporta `intervalosSeSuperponen` |
| `src/server/profesores/actions.ts` | Agrega la Server Action `registrarHorarioProfesor()` y su traducción de errores |
| `src/types/profesor.types.ts` | Agrega `HorarioAtencion`, `ProfesorActivoOpcion`, `EstadoRegistrarHorario` y `ESTADO_INICIAL_REGISTRAR_HORARIO` |
| `src/app/(dashboard)/profesores/[id]/page.tsx` | Carga los horarios y monta `FichaHorarios` |
| `src/app/(dashboard)/profesores/nuevo/nuevo-profesor-form.tsx` | Enlace "Registrar horario de atención" en el éxito del alta |
| `prisma/seed.ts` | Horarios en `"HH:mm"` y validados con las reglas de la app (§4.7) |
| `docs/specs/spec_modulo_D.md` | Changelog, nota de sincronización §2.4 y "Contrato para HU-C-04" (§4.8) |

---

## 4. Contrato Backend

### 4.1. Helpers puros

**Archivo:** `src/lib/horario-atencion.ts` (nuevo). Sin acceso a base ni a Prisma como valor.

- `DIAS_SEMANA` (lunes a domingo, en orden de semana) y `ETIQUETA_DIA` ("Lunes", "Miércoles", …).
- `diaSemanaDeFecha(fecha)`: día de la semana de una fecha `@db.Date` (medianoche UTC), con `getUTCDay()`.
- `HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/`: `"HH:mm"` 24 h con cero a la izquierda.
- `horaAMinutos("10:30") === 630` y `minutosAHora(630) === "10:30"`.
- `intervalosSeSuperponen(a, b)`: `a.inicio < b.fin && b.inicio < a.fin` (§1 punto 3).
- `intervaloContenido(interior, exterior)`: `interior` cae completo dentro de `exterior`, bordes incluidos.
- `generarHoras(desde, hasta, granularidad)`: opciones de los selects, ambos extremos incluidos.
- `validarIntervaloHorario(intervalo, parametros)`: en este orden, día operativo → granularidad de inicio y fin → inicio < fin → inicio dentro de `[apertura, cierre)` → fin ≤ cierre (§1 punto 4).
- `mensajeSuperposicion(dia, inicio, fin)`: "El intervalo se superpone con Lunes 10:00–12:00".

### 4.2. Schema Zod

**Archivo:** `src/server/profesores/profesor.schema.ts`

```typescript
export function construirRegistrarHorarioSchema(parametros: ParametrosHorarioOperativo) {
  const horaSchema = (etiqueta: string) =>
    z
      .string({ error: `Seleccioná la hora de ${etiqueta}` })
      .min(1, `Seleccioná la hora de ${etiqueta}`)
      .regex(HORA_REGEX, `Ingresá la hora de ${etiqueta} en formato 24 h (HH:MM)`);

  return z
    .object({
      profesorId: z.cuid("Seleccioná un profesor"),
      diaSemana: z.enum(DIAS_SEMANA, { error: "Seleccioná un día" }),
      horaInicio: horaSchema("inicio"),
      horaFin: horaSchema("fin"),
    })
    .superRefine((datos, ctx) => {
      const error = validarIntervaloHorario(datos, parametros);
      if (error) ctx.addIssue({ code: "custom", message: error.mensaje, path: [error.campo] });
    });
}
export type RegistrarHorarioInput = z.infer<ReturnType<typeof construirRegistrarHorarioSchema>>;
```

### 4.3. Servicio

**Archivo:** `src/server/profesores/profesor.service.ts`

**A) `registrarHorarioProfesor(input: { profesorId; diaSemana; horaInicio; horaFin }, usuarioId: string): Promise<HorarioAtencion>`**

`usuarioId` es la sesión ya autorizada con `profesores:editar`; el servicio no chequea permisos.
1. `obtenerParametrosHorarioOperativo()` + `validarIntervaloHorario()`. Si falla, lanza el `ServiceError` del intervalo con `{ campo, apertura, cierre }` en `detalles`.
2. En un único `prisma.$transaction`:
   1. `updateMany` condicionado a `activoProfesor: true` (§1 punto 5). Si `count === 0`, un `findUnique` distingue entre `PROFESOR_INACTIVO` y `PROFESOR_NO_ENCONTRADO`.
   2. `findMany` de los horarios del mismo profesor y día; si alguno se superpone, `HORARIO_SUPERPUESTO` con `{ diaSemana, horaInicio, horaFin }` del existente.
   3. `create` con `creadoPorUsuarioId`; `createdAtHorario` por defecto.
3. Retorna el intervalo creado como `HorarioAtencion` (`{ id, diaSemana, horaInicio, horaFin }`, horas `"HH:mm"`).

**B) `listarProfesoresActivos(): Promise<ProfesorActivoOpcion[]>`**: `{ id, nombre, apellido, dni }` de los activos, para el selector.

**C) `obtenerHorariosDelProfesor(profesorId): Promise<HorarioAtencion[]>`**: ordenados por día (el enum `DiaSemana` de Postgres ordena por declaración, lunes primero) y por hora de inicio. La usan la ficha y la pantalla de registro.

**D) `estaDentroDeHorarioAtencion(...)`**: contrato para HU-C-04 (§4.6).

### 4.4. Server Action

**Archivo:** `src/server/profesores/actions.ts`
**Función:** `registrarHorarioProfesor(formData: FormData): Promise<EstadoRegistrarHorario>`

Invocación directa desde el formulario, sin `useActionState`, con shape de estado propio (excepción de la Regla N.° 5). Mismo patrón que `asociarMateriasProfesor` (HU-D-03):
1. `verificarPermiso("profesores:editar")`.
2. Schema armado con los parámetros **leídos en el servidor**, nunca los que mande el cliente; `safeParse` de `profesorId`, `diaSemana`, `horaInicio` y `horaFin`. Si falla → `error_validacion`.
3. Servicio → `revalidatePath(\`/profesores/${profesorId}\`)` y `revalidatePath("/profesores/horarios/nuevo")` → `{ status: "exito", horario }`.
4. Errores traducidos según la tabla de §1 punto 6. Un `PermisoError` devuelve su propio mensaje; cualquier otro error, `error_comunicacion`. Nunca un detalle técnico.

```typescript
export type EstadoRegistrarHorario =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; horario: HorarioAtencion };
```

### 4.5. Route Handler

**Archivo:** `src/app/api/profesores/[id]/horarios/route.ts` (nuevo)
**Método:** `POST` · **Permiso:** `withPermission("profesores:editar")` · `params` async (Next 16)
**Body:** `{ "diaSemana": "LUNES", "horaInicio": "10:00", "horaFin": "12:00" }`. El `profesorId` sale de la ruta y pisa cualquier `profesorId` que venga en el body.

| Resultado | Status | Cuerpo |
|---|---|---|
| Éxito | `201` | `{ data: { id, diaSemana, horaInicio, horaFin }, error: null }` |
| Body que no es JSON | `400` | `BODY_INVALIDO` |
| Falla del schema, o regla de intervalo revalidada por el servicio | `400` | `{ code: "VALIDACION", message: "Datos inválidos", campos }` |
| Profesor inexistente | `404` | `PROFESOR_NO_ENCONTRADO` |
| Profesor inactivo | `409` | `PROFESOR_INACTIVO` |
| Superposición | `409` | `HORARIO_SUPERPUESTO`, message "El intervalo se superpone con Lunes 10:00–12:00" |
| Error inesperado | `500` | `ERROR_INTERNO`, sin detalle técnico |
| Sin sesión / sin permiso | `401` / `403` | Lo resuelve `withPermission` |

### 4.6. Contrato para HU-C-04

Servicio público del módulo D (Regla N.° 3): HU-C-04 no necesita leer `horarios_profesor`. Documentado también en `spec_modulo_D.md` §2.4, "Contrato para HU-C-04".

```typescript
// src/server/profesores/profesor.service.ts
export async function estaDentroDeHorarioAtencion(
  profesorId: string,
  fecha: Date,
  horaInicio: string,
  horaFin: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean>;

// Re-exportada desde profesor.service.ts; definida en src/lib/horario-atencion.ts.
export function intervalosSeSuperponen(a: IntervaloMinutos, b: IntervaloMinutos): boolean;
```

- **`fecha`:** fecha calendario `@db.Date` (medianoche UTC), igual que `Turno.fechaTurno`. Se toman solo los horarios del día de la semana de `fecha` (`getUTCDay()`).
- **`horaInicio` / `horaFin`:** `"HH:mm"` 24 h con cero a la izquierda; `horaInicio < horaFin`.
- **Devuelve `true`** si `[horaInicio, horaFin)` cae **completo** dentro de **un** horario del profesor, bordes incluidos (10:00–12:00 entra en 10:00–12:00).
- **Devuelve `false`:**
  - si solo lo cubren dos horarios contiguos (un turno 11:00–13:00 contra 10:00–12:00 + 12:00–14:00);
  - si alguna hora no cumple `HORA_REGEX`;
  - si `horaInicio >= horaFin`.
- **No verifica** que el profesor esté activo ni que dicte la materia: para eso está `profesorActivoDictaMateria()` (HU-D-03).
- **`db`** permite correrla dentro de la transacción de asignación de quien la llama.

### 4.7. Seed

`prisma/seed.ts` (sin tablas ni permisos nuevos):
- Los horarios pasan a `"HH:mm"` (`HorarioSeed = { dia, desde: string, hasta: string }`) y se guardan con `horaTime()` como `@db.Time`.
- `validarDatos()` valida cada horario con `validarIntervaloHorario()` contra `PARAMETROS_HORARIO` (los mismos parámetros que siembra) y la superposición con `intervalosSeSuperponen()`. El seed no puede generar horarios que la app rechazaría.
- La verificación de que cada turno agendado cae dentro del horario de su profesor pasa a comparar en minutos.
- Acuña suma un intervalo `Viernes 09:30–11:00`, que ejercita la granularidad de 30 minutos. Rossi ya tenía los contiguos `Lunes 10:00–12:00` y `12:00–14:00`.

### 4.8. Revisión de la spec (SDD, aditiva, sin renumerar)

`docs/specs/spec_modulo_D.md`:
- Changelog: fila `HU-D-04` (§2.4 en snake_case con días fijos L-S y `GRANULARIDAD_MINUTOS` constante → anotada; días, franja y granularidad salen de `ParametroSistema`).
- §2.4: nota de sincronización con rutas reales, camelCase, modelo sin cambios, parámetros, códigos de error, atomicidad y trazabilidad; más el "Contrato para HU-C-04" con un ejemplo de uso dentro de la transacción de asignación.

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md`. Éxito con `bg-success text-success-foreground`, errores con `text-destructive`, botón principal `primary` único por vista.

**Ficha** (`profesores/[id]/page.tsx` + `ficha-horarios.tsx`):
- Sección `FichaHorarios` con `FichaSeccion` y `ResumenSemanalHorarios` ("Sin horarios de atención registrados" si no hay).
- Acción "Registrar horario" (`outline`, `sm`) hacia `/profesores/horarios/nuevo?profesorId=<id>`, **solo** si el profesor está activo. Si está inactivo, se reemplaza por "Solo pueden registrarse horarios de profesores activos" (criterio 1).

**`ResumenSemanalHorarios`** (`src/components/shared/resumen-semanal-horarios.tsx`): `<dl>` con un renglón por día que tiene intervalos, en orden de semana, y un chip `HH:mm–HH:mm` por intervalo, ordenados por hora de inicio. Los contiguos se muestran por separado, tal como están registrados.

**Página** `/profesores/horarios/nuevo` (`horarios/nuevo/page.tsx`, Server Component):
- `verificarPermiso("profesores:editar")`; ante `PermisoError` redirige a `/profesores`.
- Lee parámetros y profesores activos en paralelo. Si `?profesorId=` corresponde a un profesor activo, lo preselecciona y muestra debajo su resumen semanal ("Horario de Apellido, Nombre"); si no, lo ignora.
- Texto: "El intervalo se repite todas las semanas, para todas las materias del profesor. Horario operativo del centro: {apertura} a {cierre}."
- Sin profesores activos: "No hay profesores activos", sin formulario.
- "Volver a la ficha" si hay profesor preseleccionado; si no, "Volver al listado".

**Formulario** (`registrar-horario-form.tsx`, Client Component):
- Cuatro `<select>` controlados, obligatorios (con `*`):
  - Profesor: "Apellido, Nombre · DNI …";
  - Día: solo los días operativos;
  - Hora de inicio: desde la apertura hasta el último bloque antes del cierre;
  - Hora de fin: desde el primer bloque después de la apertura hasta el cierre.
- Cambiar de profesor hace `router.replace` a `?profesorId=<id>`, así el servidor vuelve a renderizar el resumen de ese profesor.
- **Envío:**
  - `safeParse` con el mismo schema (armado con los parámetros de la página). Si falla, errores por campo y foco al primer inválido (`enfocarPrimerCampoInvalido`), sin enviar nada.
  - Guard `if (pendiente) return`; selects y botones deshabilitados y `Loader2` mientras guarda; `try/catch` con fallback a `error_comunicacion`.
- **Errores:** los de campo junto al select (`aria-invalid` + `role="alert"`); la superposición y los demás, en un `<p role="alert">` general.
- **Éxito:** `role="status"` con "Horario registrado correctamente" (criterio 6), el intervalo ("Lunes 10:00–12:00") y "Volver a la ficha". Se limpian **solo las horas**, profesor y día quedan cargados, y `router.refresh()` actualiza el resumen.
- **Cancelar:** con datos cargados abre `ConfirmarDescarteDialog`; sin datos vuelve a la ficha o al listado. El dirty flag se sincroniza con `useDirtyState` y se limpia al desmontar.

**Alta de HU-D-01** (`nuevo-profesor-form.tsx`): la pantalla de éxito suma "Registrar horario de atención", que lleva a `/profesores/horarios/nuevo?profesorId=<nuevo>`.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unit

**Archivo:** `src/lib/horario-atencion.test.ts` (sintaxis Vitest, imports por alias `@/`). 21 tests:
- `horaAMinutos` / `minutosAHora`: conversión en ambos sentidos.
- `intervalosSeSuperponen` (criterio 4): superposición parcial, contenido, idénticos, contiguos **no** superpuestos (en ambos órdenes) y separados.
- `intervaloContenido` (contrato HU-C-04): dentro con bordes incluidos; se sale por algún extremo.
- `validarIntervaloHorario`: válido; día no operativo; horas fuera de la granularidad; inicio ≥ fin; empieza antes de la apertura y termina después del cierre, indicando la franja en el mensaje.
- `construirRegistrarHorarioSchema`: datos válidos; campos obligatorios; formato 24 h; error de franja en el campo correcto.
- Helpers de UI: `generarHoras`, `diaSemanaDeFecha` sobre fechas `@db.Date` en UTC y el texto exacto del criterio 5.

**Estado:**
- Al implementar: escritos, no ejecutados. No hay test runner instalado (mismo criterio que HU-D-01 §6: no se instaló nada ni se tocó `package.json`). Quedan fuera de `tsc` por el `exclude` de `tsconfig.json`. El comentario del archivo indica que la misma lógica se verificó contra una base real con el servicio; esa evidencia no está registrada en el repo.
- **Ejecutados el 2026-09-23** (durante HU-D-05) con un vitest temporal vía `npx -y vitest@3 run` y una config fuera del repo (alias `@` → `src`), sin tocar `package.json`: los 21 pasan.

**No cubiertos por tests automatizados:** `registrarHorarioProfesor()`, `estaDentroDeHorarioAtencion()` y `obtenerParametrosHorarioOperativo()` (necesitan base o mocks de `prisma`), la Server Action y el Route Handler.

### Nivel 2 — Postman

`POST /api/profesores/{id}/horarios`, con los profesores del seed (sesión de Gerente salvo que se indique otra cosa):

| Caso | Body | Esperado |
|---|---|---|
| Éxito | Giménez, `{ "diaSemana": "LUNES", "horaInicio": "12:00", "horaFin": "13:00" }` (contiguo a su 08:00–12:00) | `201` |
| Sin sesión | cualquiera | `401 SESION_INVALIDA` |
| Mesa de Entrada | cualquiera | `403 SIN_PERMISO` |
| Body no JSON | `hola` | `400 BODY_INVALIDO` |
| Día no operativo | `"SABADO"` | `400`, `campos.diaSemana`: "El centro no atiende ese día" |
| Granularidad | `"horaInicio": "10:15"` | `400`, "La hora debe ajustarse a bloques de 30 minutos" |
| Invertido | `"horaInicio": "12:00", "horaFin": "10:00"` | `400`, `campos.horaFin` |
| Fuera de franja | `"horaInicio": "19:00", "horaFin": "21:00"` | `400`, "…(08:00 a 20:00)" |
| Superposición | Rossi, `LUNES 11:00–13:00` | `409 HORARIO_SUPERPUESTO`, "El intervalo se superpone con Lunes 10:00–12:00" |
| Profesor inactivo | Molina, intervalo válido | `409 PROFESOR_INACTIVO` |
| Profesor inexistente | cuid válido que no existe | `404 PROFESOR_NO_ENCONTRADO` |
| Id no cuid | `/api/profesores/abc/horarios` | `400`, `campos.profesorId` |

**Estado:** no hay evidencia de estas requests registrada en el repo.

### Nivel 3 — BD / TablePlus

- Fila nueva en `horarios_profesor` con `"diaSemanaHorario"`, horas `time` correctas, `"createdAtHorario"` real y `"creadoPorUsuarioId"` igual al Gerente.
- `profesores."modificadoPorUsuarioId"` y `"updatedAtProfesor"` actualizados en el profesor.
- Tras un `409 HORARIO_SUPERPUESTO` o `PROFESOR_INACTIVO`: ninguna fila nueva, y `"updatedAtProfesor"` sin cambios (la transacción se revierte).
- **Concurrencia:** dos `POST` simultáneos con intervalos superpuestos para el mismo profesor → uno `201` y otro `409`, y una sola fila nueva.
- **Parámetros:** `UPDATE parametros_sistema SET valor = '09:00' WHERE clave = 'horario_operativo_desde'`, recargar la pantalla (las horas de inicio empiezan en 09:00) y un `POST` con `08:00` → `400` "(09:00 a 20:00)". Restaurar el valor.

**Estado:** no hay evidencia registrada en el repo.

### Prueba manual (UI)

Usuario: **gerente@noctium.local** / **Password123!**. Datos del seed: Giménez (lunes 08:00–12:00), Rossi (lunes 10:00–12:00 y 12:00–14:00, contiguos) y Molina (inactivo).

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Resumen en la ficha | Abrir la ficha de Rossi | "Horario de atención" con Lunes 10:00–12:00 y 12:00–14:00 por separado, Martes y Jueves |
| 2 | Profesor inactivo (c1) | Abrir la ficha de Molina | En lugar de "Registrar horario": "Solo pueden registrarse horarios de profesores activos" |
| 3 | Inactivo por URL (c1) | `/profesores/horarios/nuevo?profesorId={Molina}` | El selector queda sin elegir y no aparece resumen; Molina no está en la lista |
| 4 | Preselección | Desde la ficha de Giménez, "Registrar horario" | Giménez seleccionado y su resumen debajo |
| 5 | Opciones (c1, c3) | Abrir los selects | Días de lunes a viernes; inicio de 08:00 a 19:30 y fin de 08:30 a 20:00, en pasos de 30 minutos |
| 6 | Obligatorios | Enviar sin completar | Error en cada campo y foco en Profesor |
| 7 | Invertido (c3) | Inicio 12:00, fin 10:00 | "La hora de inicio debe ser anterior a la hora de fin" junto a Hora de fin |
| 8 | Superposición (c5) | Rossi, lunes 11:00–13:00 | "El intervalo se superpone con Lunes 10:00–12:00"; el resumen no cambia |
| 9 | Contiguo (c4) | Giménez, lunes 12:00–13:00 | "Horario registrado correctamente", "Lunes 12:00–13:00"; el resumen muestra 08:00–12:00 y 12:00–13:00 |
| 10 | Otro intervalo del día (c4) | Después del caso 9 | Profesor y día siguen cargados y las horas vacías; registrar lunes 15:00–16:00 funciona |
| 11 | Cambiar de profesor | Elegir otro profesor en el selector | La URL cambia a su `?profesorId=` y el resumen pasa a ser el suyo |
| 12 | Cancelar con datos | Elegir día y cancelar | Diálogo "Cambios sin guardar" |
| 13 | Rol sin permiso | Con `mesa.entrada@noctium.local`, abrir `/profesores/horarios/nuevo` | El proxy redirige a `/sin-permiso` |
| 14 | Desde el alta de HU-D-01 | Registrar un profesor y usar "Registrar horario de atención" | Abre el formulario con ese profesor preseleccionado |
| 15 | Parámetros (c3) | Cambiar `horario_operativo_desde` a `09:00` en la base y recargar | La hora de inicio empieza en 09:00 y el texto dice "09:00 a 20:00". Restaurar después |

**Evidencia esperada:** capturas del formulario en sus estados (vacío, errores por campo, superposición, cargando, éxito con resumen actualizado) y de la ficha de un profesor inactivo.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de implementar. *(No hubo task previa; este documento es posterior a la implementación.)*
- [x] Sin cambios de schema; `HorarioProfesor` usado tal como estaba.
- [x] Días, franja y granularidad leídos de `ParametroSistema`, sin hardcodear (§1 punto 2).
- [x] Una sola regla de intervalo para schema, servicio y seed (`validarIntervaloHorario`); una sola regla de superposición (`intervalosSeSuperponen`, contiguos permitidos).
- [x] Toda la lógica en `profesor.service.ts`; action y route handler delgados (Regla N.° 4), en las ubicaciones de la Regla N.° 11.
- [x] Condición y mutación del profesor en un `updateMany` que además serializa altas concurrentes (Regla N.° 7).
- [x] Superposición rechazada sin guardar, identificando día e intervalo en conflicto (criterio 5).
- [x] Contrato para HU-C-04 implementado y documentado en la spec (§4.6).
- [x] Solo tokens de `DESIGN.md`.
- [x] Ningún `DELETE` físico en el código de la aplicación (Regla N.° 1).
- [x] `spec_modulo_D.md` revisada de forma aditiva (changelog + nota de sincronización §2.4).
- [x] Tests unitarios escritos (21) y, desde el 2026-09-23, ejecutados con un runner temporal: todos pasan.
- [x] `tsc --noEmit`, `npm run lint` y `npm run build` sin errores. *(Re-verificado el 2026-09-23 sobre el árbol actual, que ya incluye los cambios sin commitear de HU-D-05. Lint: 0 errores y 1 warning ajeno a la HU —`Clock3` sin usar en `home/page.tsx`.)*
- [ ] Niveles 2 y 3 ejecutados con evidencia registrada.
- [ ] Criterios 1 a 6 verificados en navegador como Gerente (§6, prueba manual).
- [ ] HU-C-04 integrada con `estaDentroDeHorarioAtencion()` (ver §8).
- [x] PR acotado a HU-D-04 (PR #54, commit `eb91222`).

---

## 8. Pendientes y notas

- **Test runner:** los tests usan Vitest, pero no hay runner instalado ni script `test` en `package.json`. Se pueden correr con `npx -y vitest@3 run` y una config temporal con el alias `@` → `src`. Instalarlo es una decisión de equipo (misma nota que HU-D-01 §6).
- **HU-C-04 todavía no consume el contrato:** hoy ningún archivo fuera del módulo D llama a `estaDentroDeHorarioAtencion()`. Coordinar con Emir que la asignación de profesor la use (con `db = tx` dentro de su transacción) junto con `profesorActivoDictaMateria()`.
- **Sin edición ni baja de intervalos:** un intervalo mal cargado hoy solo se puede corregir desde la base. Queda para una HU futura.
- **Superposición como error general:** el mensaje de `HORARIO_SUPERPUESTO` se muestra debajo del formulario, no junto a un campo, porque el conflicto es del intervalo completo y no de una hora en particular.
- **Permiso de la pantalla:** `/profesores/horarios/nuevo` y la ficha exigen `profesores:editar`. Un rol sin permiso lo frena primero el proxy (`rutas-por-rol.ts` → `/sin-permiso`).
- **Días no operativos en el enum:** `DiaSemana` incluye `SABADO` y `DOMINGO`. Que se puedan usar depende solo del parámetro `dias_operativos`, no del código.
- **Cambios posteriores de HU-D-05** (en el árbol de trabajo, **sin commitear** al 2026-09-23), que no cambian el comportamiento de esta HU:
  - `listarProfesoresActivos()` pasa a ordenar por apellido y nombre normalizados (sin distinguir mayúsculas ni acentos) + DNI;
  - `obtenerHorariosDelProfesor()` agrega un `select` de las columnas que usa;
  - `ResumenSemanalHorarios` delega la agrupación en `agruparHorariosPorDia()` (nuevo en `horario-atencion.ts`), con la misma apariencia;
  - el seed suma profesores de prueba, algunos con horarios.
