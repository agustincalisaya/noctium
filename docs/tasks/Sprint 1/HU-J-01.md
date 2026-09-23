# TASK: HU-J-01 — Visualizar calendario de turnos por profesor

**Módulo:** J (Visualizar calendario)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_J.md` §1, §2.1 (con nota de sincronización HU-J-01) y §3.1–3.4 · `docs/specs/spec_modulo_D.md` §2.5 ("Contrato para HU-J-01") · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-J-01, criterios de aceptación 1-8
**RBAC:** `calendario:leer` — **nuevo**, para `MESA_ENTRADA`, `GERENTE` y `PROFESOR` (`spec_modulo_J.md` §2, convenciones generales). Se agrega en el seed. `rutas-por-rol.ts` ya dejaba `/calendario/**` como `"CUALQUIERA"` y `src/proxy.ts` ya lo incluía en el `matcher`.
**Schema:** sin migración. `Turno` (`fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno`, `estadoTurno`, `materiaId`, `profesorId`, `aulaId`), `TurnoAlumno` y `Profesor.usuarioId` (vínculo cuenta ↔ profesor) ya tienen todo lo necesario. La hora de fin se calcula (`horaInicio + duracionMinutos`), no se guarda.
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/calendario.types.ts`, schema en `src/server/calendario/calendario.schema.ts`, service en `src/server/calendario/calendario.service.ts`).

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Los puntos marcados como **"relevar antes de asumir"** en esta task, con la pregunta concreta.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

**Nota — implementación de corrido:** por pedido del responsable, la HU se implementó sin frenar a confirmar el relevamiento. Los puntos que esta task dejaba como "relevar antes de asumir" los resolvió el responsable en la consigna de implementación; se registran en §1 como decisiones resueltas.

Lo que encontró el relevamiento (`feature/HU-J-01`, sobre `develop` con HU-D-05 mergeada):
- `src/app/(dashboard)/calendario/page.tsx` era un stub ("Calendario - en construcción"). No existía `src/app/api/calendario/`.
- `Sidebar.tsx` ocultaba la sección Calendario completa, con un comentario que anticipaba `/calendario/profesor` (HU-J-01) y `/calendario/materia` (HU-J-02).
- `listarOpcionesProfesoresActivos()` ya existía en `profesor.service.ts` (HU-D-05 §1 punto 9).
- `obtenerParametrosHorarioOperativo()` ya existía en `src/server/shared/parametros.ts` (HU-D-04). En el seed: `LUNES`–`VIERNES`, `08:00`–`20:00`, granularidad `30`.
- `turno.service.ts` (módulo C) **no** tiene `listarTurnosAgendadosPorProfesor()`, el contrato del módulo C que `spec_modulo_J.md` §1 da como servicio a consumir. La función que implementa esta HU en el módulo J es otra: `listarTurnosAgendadosDeProfesor()` (§1 punto 7).
- El vínculo cuenta ↔ profesor **existe** en el schema: `Profesor.usuarioId String? @unique` ↔ `Usuario.profesor`.
- El detalle `/turnos/[id]` acepta `?volver=`, pero solo lo respeta si empieza con `/turnos?` (`turnos/[id]/page.tsx`) y el link dice "Volver al listado".
- El seed ya crea turnos `AGENDADO` en la semana en curso (6) y en la siguiente (4), con fechas relativas a "hoy", más 1 `PENDIENTE` sin profesor.
- `EstadoTurno` tiene solo `PENDIENTE` y `AGENDADO`.

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

1. **DECISIÓN RESUELTA — autorización en el servidor, `profesorId` efectivo según rol.**
   - Un único helper, `resolverProfesorDeLaAgenda()` (`calendario.service.ts`), decide de quién es la agenda.
   - Rol `PROFESOR`: el profesor sale **siempre** de la sesión (`Profesor.usuarioId === session.user.id`), vía `obtenerOpcionProfesorDeUsuario()` del módulo D. Cualquier `profesorId` recibido se ignora para decidir qué agenda se muestra: la página descarta el searchParam y el menú no ofrece selector.
   - En el Route Handler, si el rol es `PROFESOR` y el `profesorId` de la ruta no es el propio → `403 SIN_PERMISO`, sin revelar si ese profesor existe (`spec_modulo_J.md` §2.1 punto 1, criterio 2 "el servidor rechaza"). Es la opción `rechazarAjeno: true` del mismo helper.
   - Rol `PROFESOR` sin ficha vinculada → `PROFESOR_SIN_FICHA`: `403 SIN_PERMISO` en la API y el aviso "Tu cuenta no tiene una ficha de profesor vinculada" en la página.
   - `MESA_ENTRADA` / `GERENTE`: usan el `profesorId` recibido; debe ser un profesor activo (`404 PROFESOR_NO_ENCONTRADO` si no), vía `obtenerOpcionProfesorActivo()` del módulo D.
   - Cualquier otro rol (`ALUMNO`): `403 SIN_PERMISO`, ya desde `calendario:leer`.

2. **DECISIÓN RESUELTA — filtro `AGENDADO` en la query, no en la UI.**
   - `estadoTurno: "AGENDADO"` va en el `where` de Prisma. La UI nunca recibe turnos `PENDIENTE` (`spec_modulo_J.md` §3.1).
   - El campo `estado` se devuelve igual en cada evento, para que la UI lo muestre con texto e ícono además del color.

3. **DECISIÓN RESUELTA — semana lunes–domingo en `America/Argentina/Buenos_Aires`, mostrando solo días operativos.**
   - "Hoy" se calcula en la zona `America/Argentina/Buenos_Aires` (`hoyEnZonaCentro()`, mismo criterio que `listarTurnos()`); el resto es aritmética de fechas calendario en UTC.
   - La grilla muestra solo las columnas de `dias_operativos`. `semana`/`semana_inicio` se normalizan al lunes de su semana.
   - El rango del encabezado y de la respuesta va del primer al último día **operativo** de la semana.
   - **Desviación de la spec:** `spec_modulo_J.md` §2 dice `[lunes, sábado]` fijo. Se usa el parámetro de días operativos para no hardcodear días. **Con la configuración actual (`LUNES`–`VIERNES`) el rango es lunes–viernes; si el centro configurara `LUNES`–`SABADO`, el resultado coincidiría exactamente con la spec.** Documentado como nota de sincronización en `spec_modulo_J.md` §2.1.

4. **DECISIÓN RESUELTA — grilla de 30 min con el horario operativo de la configuración.**
   - Filas generadas con `franjasDeLaGrilla()` a partir de `obtenerParametrosHorarioOperativo()` (apertura, cierre y granularidad). Nada hardcodeado en la UI.
   - Cada evento se posiciona con `posicionEnGrilla()` y ocupa su intervalo completo (criterio 3). Lo que cae en parte fuera de la franja se recorta; lo que cae completo afuera no se dibuja.
   - Eventos superpuestos (dato inconsistente) se muestran uno al lado del otro con `asignarCarriles()`; no se ocultan ni se combinan (`spec_modulo_J.md` §3.3).

5. **DECISIÓN RESUELTA — profesor y semana persistidos en la URL.**
   - `/calendario/profesor?profesorId=<cuid>&semana=<AAAA-MM-DD>`. Sin `semana` → semana actual; una `semana` inválida se ignora y abre la actual. Sin `profesorId` (Mesa/Gerente) → solo el selector con "Seleccioná un profesor para ver su agenda".
   - Anterior / Siguiente / Hoy son links que cambian `semana` y conservan `profesorId`. Cambiar de profesor conserva la semana.
   - Cada evento linkea a `/turnos/[id]?volver=<URL actual del calendario con encodeURIComponent>`. Para el rol Profesor la URL de vuelta no lleva `profesorId`.

6. **DECISIÓN RESUELTA — selector con el servicio público del módulo D.**
   - `listarOpcionesProfesoresActivos()` (Regla 3), no `GET /api/profesores` (exige `profesores:leer`, exclusivo de Gerente). Solo activos, ordenados por Apellido y Nombre (+ DNI).
   - El rol `PROFESOR` no recibe el selector (criterio 2).

7. **DECISIÓN RESUELTA — lectura de turnos dentro del módulo J (excepción temporal a `spec_modulo_J.md` §3.4).**
   - Por decisión del responsable **no se modifica `turno.service.ts`** (es de otro subgrupo). La consulta de solo lectura vive en `listarTurnosAgendadosDeProfesor(profesorId, desde, hasta)` de `calendario.service.ts`, con rango `[desde, hasta)` y la forma de dato de la spec J.
   - Lleva un `TODO(HU-C-04/HU-C-15)` para reemplazar su cuerpo por el servicio público del módulo C cuando exista, sin cambiar la firma ni la forma del dato.
   - Mientras HU-C-04/C-15 no estén cerradas, se desarrolla y prueba con los turnos `AGENDADO` del seed. La integración real con el flujo de turnos se valida al cierre del sprint.

8. **DECISIÓN RESUELTA — campos por rol.**
   - Cada evento muestra Hora, Alumno, Materia, Aula y Estado para los tres roles. Según `spec_modulo_J.md` §2.1 punto 4, "según los permisos del rol" se refiere al acceso (punto 1), no a campos distintos por rol.

9. **DECISIÓN RESUELTA — turnos grupales (`TurnoAlumno` N:M).**
   - Se mantiene `alumno: string` como define la spec. Si un turno tiene más de un alumno, los nombres se unen como `"Apellido, Nombre; Apellido, Nombre"`, ordenados por apellido y nombre normalizados. Sin cambios de schema.
   - Sin alumno o sin aula (no debería pasar en un `AGENDADO`) se muestra "—" (`VALOR_AUSENTE`).

10. **DECISIÓN RESUELTA — `?volver=` en el detalle de turno.**
    - **No se modifica `/turnos/[id]`** (módulo C). Los eventos ya mandan `?volver=` con la URL del calendario, pero hoy ese detalle solo acepta `volver` que empiece con `/turnos?`, así que su link "Volver al listado" lleva a `/turnos`. Queda como pendiente de integración (§8).

**Supuestos tomados:**
- **Profesor inactivo con cuenta:** puede ver su propia agenda (`obtenerOpcionProfesorDeUsuario()` no filtra por activo). Mesa/Gerente solo consultan profesores activos.
- **Semana inválida en la URL:** la página abre la semana actual; el Route Handler responde `400 VALIDACION`.
- **Sin días operativos configurados:** `obtenerParametrosHorarioOperativo()` ya cae al valor por defecto.
- **Error de negocio vs. error técnico:** profesor inexistente/inactivo y profesor sin ficha se informan en la página con un aviso; solo un error inesperado va a `error.tsx` con Reintentar.

**Dependencias de esta implementación:**
- **Depende de:**
  - HU-C-15: turnos en estado `AGENDADO` (y HU-C-04: profesor asignado). Hoy simulado con el seed.
  - HU-D-05: `listarOpcionesProfesoresActivos()`.
  - HU-D-04: `obtenerParametrosHorarioOperativo()` y helpers de `horario-atencion.ts`.
- **Es requisito de:** HU-J-02 (calendario por materia), que puede reutilizar `GrillaSemanal`, `EventoCalendario` y `calendario-semana.ts`.

**Fuera de alcance de esta task (explícito):**
- Vistas intercambiables por día, semana y mes (Sprint 2, criterio 8).
- Filtros combinados, por ejemplo profesor + materia (Sprint 3).
- Impresión o exportación de la agenda.
- HU-J-02 (calendario por materia).
- Cualquier escritura sobre turnos.
- Cambios en `turno.service.ts` y en `/turnos/[id]` (módulo C).

---

## 2. Historia de Usuario

**Como** usuario autorizado
**Necesito** visualizar el calendario de turnos de un profesor
**Para** conocer su agenda de clases

**SP estimado:** 3

**Justificación de secuencia (`HU-Sprint-1.md`):** depende de HU-C-15 y HU-D-05 (solo muestra turnos agendados). Cierra el flujo básico de atención.

### 2.1. Criterios de aceptación y dónde se cumplen

| # | Criterio (`HU-Sprint-1.md`) | Cómo se cumple | Dónde |
|---|---|---|---|
| 1 | Mesa de entrada y gerencia seleccionan un profesor activo y consultan sus turnos agendados en una vista semanal básica. Abre en la semana actual, columnas de días operativos, filas del horario operativo; el encabezado indica el rango de fechas. | Selector con `listarOpcionesProfesoresActivos()`. Semana actual por defecto, calculada en Buenos Aires. Columnas de `dias_operativos` y filas de `franjasDeLaGrilla()`. Encabezado "Semana del 21/09 al 25/09/2026". | `calendario/profesor/page.tsx`, `selector-profesor.tsx`, `navegacion-semana.tsx`, `grilla-semanal.tsx`, `calendario-semana.ts` |
| 2 | Un profesor ve directamente su propia agenda y no puede consultar agendas no autorizadas. No ve el selector; el servidor rechaza la agenda de otro profesor. | Profesor efectivo desde la sesión (`resolverProfesorDeLaAgenda()`); sin selector para `PROFESOR`; `?profesorId=` ajeno ignorado en la página y `403 SIN_PERMISO` en la API (§1 punto 1). | `calendario.service.ts`, `api/calendario/profesor/[profesorId]/route.ts`, `calendario/profesor/page.tsx` |
| 3 | Cada evento muestra Hora, Alumno, Materia, Aula y Estado; ocupa su intervalo completo; estado con texto o ícono además del color. | Bloque posicionado por hora de inicio y duración; `Badge` "Agendado" con ícono `CalendarCheck`; texto completo en `title` y en el nombre accesible. | `evento-calendario.tsx`, `grilla-semanal.tsx`, `posicionEnGrilla()` |
| 4 | Los turnos pendientes no aparecen. | `estadoTurno: "AGENDADO"` en el `where` del servidor (§1 punto 2). | `listarTurnosAgendadosDeProfesor()` |
| 5 | Semana anterior / siguiente y acción Hoy. | Links que cambian `?semana=` y conservan `?profesorId=`. | `navegacion-semana.tsx`, `construirUrlCalendarioProfesor()`, `desplazarSemana()` |
| 6 | Al seleccionar un evento se abre el detalle; al volver se conservan profesor y semana. | Cada evento abre `/turnos/[id]?volver=<URL del calendario>`. **Parcial:** el link "Volver" del detalle todavía ignora ese `volver` (§1 punto 10, §8); el "atrás" del navegador sí conserva profesor y semana porque viajan en la URL. | `evento-calendario.tsx` |
| 7 | Sin turnos: "Agenda sin turnos". Indicador de carga; error con Reintentar. | `eventos: []` → "Agenda sin turnos" sobre la grilla. `<Suspense key>` con "Cargando agenda"; `error.tsx` con `retry()`. | `calendario/profesor/page.tsx`, `calendario/profesor/error.tsx` |
| 8 | Vistas por día/semana/mes corresponden a un incremento posterior. | Solo vista semanal, sin controles de cambio de vista. | — |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_J.md` §2.1 y §3, con las decisiones de §1.

### 3.1. Desglose en subtareas técnicas

- [x] **Permiso `calendario:leer`** en el seed para `MESA_ENTRADA`, `GERENTE` y `PROFESOR` (§4.0).
- [x] **Helpers puros de semana y grilla** (`src/lib/calendario-semana.ts`) (§4.1).
- [x] **Schema Zod:** `ConsultarCalendarioProfesorQuerySchema` (§4.2).
- [x] **Consulta de turnos `AGENDADO`** dentro del módulo J: `listarTurnosAgendadosDeProfesor()` (§4.3).
- [x] **Servicios públicos del módulo D** para resolver el profesor: `obtenerOpcionProfesorActivo()` y `obtenerOpcionProfesorDeUsuario()` (§4.3).
- [x] **Servicio del módulo J:** `resolverProfesorDeLaAgenda()` y `obtenerCalendarioProfesor()` (§4.4).
- [x] **Route Handler** `GET /api/calendario/profesor/[profesorId]` (§4.5).
- [x] **UI:** página `/calendario/profesor`, selector, navegación de semana, grilla, evento, carga, vacío y error (§5).
- [x] **Sidebar:** sección Calendario ("Agenda por profesor" para Mesa y Gerente, "Mi agenda" para Profesor).
- [x] **Tests unitarios** de helpers y servicio (§6).
- [x] **Nota de sincronización** en `spec_modulo_J.md` §2.1.
- [ ] **Detalle de turno:** aceptar `?volver=` del calendario — **pendiente del dueño de turnos** (§8).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Migraciones o cambios de schema.
- Cambios en `turno.service.ts` o en `/turnos/[id]`.
- Filtrar pendientes solo en la UI.
- Selector de vista día/semana/mes, filtros combinados, impresión o exportación.
- `/calendario/materia` (HU-J-02).

### 3.2. Archivos creados

| Archivo | Qué hace |
|---|---|
| `src/lib/calendario-semana.ts` | Helpers puros de semana, rango, grilla, carriles y URL de la agenda (§4.1) |
| `src/lib/calendario-semana.test.ts` | 14 tests de los helpers (§6) |
| `src/types/calendario.types.ts` | `EventoCalendario`, `CalendarioProfesor`, `RangoSemana` |
| `src/server/calendario/calendario.schema.ts` | `ConsultarCalendarioProfesorQuerySchema` (§4.2) |
| `src/server/calendario/calendario.service.ts` | `listarTurnosAgendadosDeProfesor()`, `resolverProfesorDeLaAgenda()` y `obtenerCalendarioProfesor()` (§4.3, §4.4) |
| `src/server/calendario/calendario.service.test.ts` | 10 tests del servicio con `prisma`, módulo D y parámetros mockeados (§6) |
| `src/app/api/calendario/profesor/[profesorId]/route.ts` | `GET` con `withPermission("calendario:leer")` (§4.5) |
| `src/app/(dashboard)/calendario/profesor/page.tsx` | Server Component: permiso, rol, searchParams, selector, navegación, carga y grilla |
| `src/app/(dashboard)/calendario/profesor/selector-profesor.tsx` | Selector cliente que actualiza `?profesorId=` conservando `?semana=` |
| `src/app/(dashboard)/calendario/profesor/navegacion-semana.tsx` | Rango de fechas y Anterior / Hoy / Siguiente |
| `src/app/(dashboard)/calendario/profesor/error.tsx` | "No se pudo cargar la agenda" con Reintentar (`retry()`) |
| `src/components/shared/grilla-semanal.tsx` | Grilla días × franjas, genérica (`renderEvento`), reutilizable por HU-J-02 |
| `src/components/shared/evento-calendario.tsx` | Bloque del evento con Hora, Alumno, Materia, Aula y Estado, link al detalle con `?volver=` |

### 3.3. Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `prisma/seed.ts` | Solo agrega el bloque `calendario:leer` para `MESA_ENTRADA`, `GERENTE` y `PROFESOR`. No se modificó ni borró nada existente. No se agregaron turnos (§4.0) |
| `src/server/profesores/profesor.service.ts` | Agrega `obtenerOpcionProfesorActivo()` y `obtenerOpcionProfesorDeUsuario()` (servicios públicos del módulo D, aditivos) |
| `src/app/(dashboard)/calendario/page.tsx` | El stub redirige a `/calendario/profesor` |
| `src/components/layout/Sidebar.tsx` | Sección "Calendario" para Mesa, Gerente ("Agenda por profesor") y Profesor ("Mi agenda"); comentario `TODO Sprint 1` actualizado |
| `docs/specs/spec_modulo_J.md` | Nota de sincronización §2.1 |

---

## 4. Contrato Backend

### 4.0. Permiso y seed

- Fila `calendario:leer` en `RolPermiso` para `MESA_ENTRADA`, `GERENTE` y `PROFESOR`, con `upsert` al final del bloque RBAC de `prisma/seed.ts` (mismo patrón que `turnos:leer`). No se agregó migración de datos: esta HU no tiene migración de schema y el permiso va solo en el seed.
- **Turnos:** no se agregaron. El seed ya genera turnos `AGENDADO` relativos a "hoy" en la semana en curso (6) y en la siguiente (4), de los cuatro profesores con cuenta, más 1 `PENDIENTE`. La consigna pedía agregar turnos solo si no los había.

### 4.1. Helpers puros

**Archivo:** `src/lib/calendario-semana.ts` (nuevo)

```typescript
export const ZONA_HORARIA_CENTRO = "America/Argentina/Buenos_Aires";

export function hoyEnZonaCentro(ahora?: Date): string;                  // "AAAA-MM-DD"
export function esFechaCalendario(valor: unknown): valor is string;
export function lunesDeLaSemana(fecha: string): string;                 // semana lunes a domingo
export function desplazarSemana(lunes: string, semanas: number): string;
export function diasOperativosDeLaSemana(lunes: string, diasOperativos: readonly DiaSemanaValor[]): DiaDeSemana[];
export function rangoDeLaSemana(lunes: string, diasOperativos: readonly DiaSemanaValor[]): { desde: string; hasta: string };
export function formatearRangoSemana(desde: string, hasta: string): string; // "Semana del 21/09 al 25/09/2026"
export function franjasDeLaGrilla(parametros: ParametrosGrilla): string[];  // "08:00", "08:30", ...
export function posicionEnGrilla(evento, parametros): { filaInicio: number; filas: number } | null;
export function asignarCarriles(eventos): { evento; carril: number; carriles: number }[];
export function construirUrlCalendarioProfesor({ profesorId?, semana? }): string;
```

Trabajan con fechas calendario `AAAA-MM-DD` y aritmética `Date.UTC`; la única conversión con zona horaria es `hoyEnZonaCentro()`. Reutilizan `horaAMinutos()` / `DIAS_SEMANA` de `horario-atencion.ts`.

### 4.2. Schema Zod

**Archivo:** `src/server/calendario/calendario.schema.ts`

```typescript
export const ConsultarCalendarioProfesorQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(), // se normaliza al lunes; si falta, semana actual
});
export type ConsultarCalendarioProfesorQuery = z.infer<typeof ConsultarCalendarioProfesorQuerySchema>;
```

### 4.3. Lectura de turnos y de profesores

**`listarTurnosAgendadosDeProfesor(profesorId, desde, hasta): Promise<EventoCalendario[]>`** (`calendario.service.ts`, §1 punto 7):
- `where: { profesorId, estadoTurno: "AGENDADO", fechaTurno: { gte: desde, lt: hasta } }`.
- `select` solo de lo necesario (id, fecha, hora de inicio, duración, nombre de materia, nombre de aula y apellido/nombre de alumnos).
- `orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { idTurno: "asc" }]`; alumnos por apellido y nombre normalizados.
- Devuelve la forma de `spec_modulo_J.md` §2.1:

```typescript
type EventoCalendario = {
  turno_id: string;
  fecha: string;       // "AAAA-MM-DD"
  hora_inicio: string; // "HH:mm"
  hora_fin: string;    // hora_inicio + duracionMinutosTurno
  alumno: string;      // "Apellido, Nombre" (varios: unidos con "; ")
  materia: string;
  aula: string;        // "—" si faltara
  estado: "AGENDADO";
};
```

**Servicios públicos del módulo D** (`profesor.service.ts`, aditivos):
- `obtenerOpcionProfesorActivo(profesorId): Promise<OpcionProfesor | null>` — solo activos.
- `obtenerOpcionProfesorDeUsuario(usuarioId): Promise<OpcionProfesor | null>` — ficha vinculada a la cuenta (`Profesor.usuarioId`, `@unique`), sin filtrar por activo.

### 4.4. Servicio del módulo J

**Archivo:** `src/server/calendario/calendario.service.ts`

**`resolverProfesorDeLaAgenda(usuario, profesorIdSolicitado, { rechazarAjeno }): Promise<OpcionProfesor>`** — único punto que resuelve el profesor efectivo (§1 punto 1). Errores: `PROFESOR_SIN_FICHA`, `SIN_PERMISO`, `PROFESOR_NO_ENCONTRADO` (`ServiceError`).

**`obtenerCalendarioProfesor({ usuario, profesorIdSolicitado, lunes, rechazarAjeno }): Promise<CalendarioProfesor>`**
1. En paralelo: `resolverProfesorDeLaAgenda()` y `obtenerParametrosHorarioOperativo()`.
2. Días operativos y rango de la semana con §4.1.
3. `listarTurnosAgendadosDeProfesor(profesor.id, desde, hastaExclusivo)`, con `hastaExclusivo` = día siguiente al último día operativo.
4. Devuelve `{ profesor: { id, nombre_completo }, rango: { desde, hasta }, dias, horario: { apertura, cierre, granularidadMinutos }, eventos }`.

La página lo llama con `rechazarAjeno: false` (ignora el `profesorId` del rol Profesor) y el Route Handler con `true` (lo rechaza).

### 4.5. Route Handler

**`GET /api/calendario/profesor/[profesorId]`** (`src/app/api/calendario/profesor/[profesorId]/route.ts`, nuevo):
- `withPermission("calendario:leer")`, con `params` async (Next 16).
- `ConsultarCalendarioProfesorQuerySchema.safeParse` de `?semana_inicio=` → `400 VALIDACION` con `flattenError`.
- Éxito → `200 { data: { profesor, rango, eventos }, error: null }` (shape de `spec_modulo_J.md` §2.1).
- Error inesperado → `500 ERROR_INTERNO`, sin detalle técnico.

| Resultado | Status |
|---|---|
| Sin sesión | `401 SESION_INVALIDA` (lo resuelve `withPermission`) |
| Rol sin `calendario:leer` (Alumno) | `403 SIN_PERMISO` |
| `PROFESOR` pidiendo otra agenda (exista o no) | `403 SIN_PERMISO` |
| `PROFESOR` sin ficha vinculada | `403 SIN_PERMISO` |
| Mesa/Gerente con profesor inexistente o inactivo | `404 PROFESOR_NO_ENCONTRADO` |

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md`. Estado con `Badge` `success` ("Agendado") **con texto e ícono**; bloque del evento `bg-background` con borde izquierdo `border-l-primary`, hover `bg-accent`; columna de hoy con `bg-secondary`/`text-secondary-foreground`; errores con `text-destructive`.

**Página** `src/app/(dashboard)/calendario/profesor/page.tsx`:
- `exigirPermiso("calendario:leer")` (sin sesión → `/login`, sin permiso → `/sin-permiso`). El rol sale de la sesión.
- Lee `?profesorId=` y `?semana=`. Para `PROFESOR` ignora `profesorId` y el título es "Mi agenda"; para Mesa/Gerente, "Agenda por profesor".
- Mesa/Gerente: `SelectorProfesor` (`<select>` nativo, mismo estilo que HU-D-04). Sin profesor → "Seleccioná un profesor para ver su agenda".
- `NavegacionSemana`: rango ("Semana del 21/09 al 25/09/2026") y links "Anterior", "Hoy", "Siguiente".
- `GrillaSemanal`: columnas por día operativo (etiqueta + fecha, hoy resaltado con `aria-current="date"`), filas cada 30 min de apertura a cierre, columna de horas fija al hacer scroll horizontal. Cada día es un `<section>` con su lista de eventos.
- `EventoCalendario`: Hora ("10:00–12:00") + Badge de estado, Alumno, Materia y Aula; link a `/turnos/[id]?volver=<URL actual>`. Texto largo con `truncate`; completo en `title` y `aria-label`.
- `overflow-x-auto` para anchos chicos.

**Carga, vacío y error:**
- **Carga:** `<Suspense key={`${profesorId}-${lunes}`}>` con "Cargando agenda" (`role="status"`). No se usa `loading.tsx` (mismo criterio que HU-D-05 §1 punto 6). El encabezado con el rango y la navegación quedan visibles.
- **Vacío:** `eventos: []` → "Agenda sin turnos" (con ícono, `role="status"`) sobre la grilla vacía.
- **Errores de negocio:** profesor inexistente/inactivo o profesor sin ficha → aviso en la página.
- **Error técnico:** `calendario/profesor/error.tsx` con "No se pudo cargar la agenda" y "Reintentar" (`retry()`).

**Menú:** `Sidebar.tsx` agrega "Calendario > Agenda por profesor" (Mesa, Gerente) y "Calendario > Mi agenda" (Profesor). `/calendario` redirige a `/calendario/profesor`.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unit

Mismo mecanismo que HU-D-05 §6: `npx -y vitest@3 run` con una config temporal fuera del repo (alias `@` → `src`), **sin tocar `package.json`**. Se corrieron **todos** los tests del repo.

- `src/lib/calendario-semana.test.ts` (nuevo, 14 tests):
  - `hoyEnZonaCentro`: 23:30 de Buenos Aires (02:30 UTC del día siguiente) da el día de Buenos Aires.
  - `lunesDeLaSemana`: lunes, miércoles y domingo → lunes; cruce de mes y de año.
  - `desplazarSemana`: ±1 semana, cruce de año.
  - `diasOperativosDeLaSemana` y `rangoDeLaSemana`: lunes–viernes, días no consecutivos, lunes–sábado (coincide con la spec) y sin días operativos.
  - `formatearRangoSemana` (mismo año y cruce de año) y `esFechaCalendario`.
  - `franjasDeLaGrilla` (24 filas de 08:00 a 19:30) y `posicionEnGrilla` (10:00–11:00 → fila 4, 2 filas; recorte y fuera de franja).
  - `asignarCarriles`: superpuestos lado a lado; contiguos no se superponen.
  - `construirUrlCalendarioProfesor`.
- `src/server/calendario/calendario.service.test.ts` (nuevo, 10 tests, `prisma` y módulo D mockeados):
  - `listarTurnosAgendadosDeProfesor`: `where` con `estadoTurno: "AGENDADO"` y rango `[desde, hasta)`; forma del evento y `hora_fin` por duración; alumnos unidos con "; " y "—" sin alumno/aula.
  - `resolverProfesorDeLaAgenda`: Profesor usa su ficha; `profesorId` ajeno ignorado en la página; ajeno en la API → `SIN_PERMISO` sin consultar turnos; sin ficha → `PROFESOR_SIN_FICHA`; Mesa/Gerente con activo, inactivo y sin id; Alumno → `SIN_PERMISO`.
  - `obtenerCalendarioProfesor`: rango consultado lunes a sábado 00:00 (exclusivo), días, horario y profesor.

**Resultado:** `10 passed (10)` archivos, `113 passed (113)` tests.

### Verificación estática y build

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ 0 errores, 1 warning preexistente ajeno a la HU (`Clock3` sin usar en `src/app/(dashboard)/home/page.tsx`) |
| `npm run build` | ✅ compila; aparecen `/calendario`, `/calendario/profesor` y `/api/calendario/profesor/[profesorId]` |
| `npx tsx prisma/seed.ts` | ✅ corre completo contra Postgres (Docker): "3 permisos RBAC creados (calendario:leer para MESA_ENTRADA, GERENTE y PROFESOR)" |

### Nivel 2 — Postman

Ejecutado con `curl` contra `npm run dev` y sesiones reales de NextAuth (semana del 21/09/2026):

| Caso | Esperado | Resultado |
|---|---|---|
| `GET /api/calendario/profesor/{Giménez}` como Gerente | `200`, rango lunes–viernes de la semana actual, solo `AGENDADO` | ✅ `200`, rango `2026-09-21`–`2026-09-25`, `seed-turno-01` y `-05` |
| Mismo request como Mesa de Entrada | `200` | ✅ |
| `?semana_inicio=2026-09-30` (miércoles) | `200`, rango normalizado al lunes | ✅ `2026-09-28`–`2026-10-02`, `seed-turno-10` |
| `?semana_inicio=2026-02-31` | `400 VALIDACION` | ✅ con `campos.semana_inicio` |
| Como Profesor, con su propio `profesorId` | `200` | ✅ |
| Como Profesor, con `profesorId` ajeno (Rossi) | `403 SIN_PERMISO` | ✅ |
| Como Profesor, con `profesorId` inexistente | `403 SIN_PERMISO` (no revela existencia) | ✅ |
| Como Alumno | `403 SIN_PERMISO` | ✅ |
| Sin sesión | `401 SESION_INVALIDA` | ✅ |
| Gerente con profesor inactivo | `404 PROFESOR_NO_ENCONTRADO` | ✅ |
| Gerente con profesor sin turnos (Quiroga) | `200`, `eventos: []` | ✅ |

### Nivel 3 — BD / TablePlus

Ejecutado con `psql` sobre el contenedor `noctium_db`:
- ✅ `roles_permisos` contiene `calendario:leer` para `MESA_ENTRADA`, `GERENTE` y `PROFESOR`, y no para `ALUMNO`.
- ✅ Los eventos de la API coinciden con las filas `AGENDADO` de `turnos` del profesor en el rango.
- ✅ **Pendiente con profesor:** se asignó temporalmente Giménez al turno `seed-turno-11` (`PENDIENTE`, 01/10); la API de la semana del 28/09 devolvió solo `seed-turno-10` (`AGENDADO`). Luego se volvió a correr el seed, que restauró `profesorId = NULL`.
- ✅ Ninguna escritura: el módulo J solo usa `findMany` / `findFirst` / `findUnique`.

### Prueba manual (UI)

Verificado sobre el HTML renderizado por el servidor (`curl` con sesión de cada rol):
- [x] Gerente y Mesa de Entrada ven el selector (profesores activos, ordenados por Apellido y Nombre). Sin profesor: "Seleccioná un profesor para ver su agenda".
- [x] El profesor ve directamente su agenda ("Mi agenda"), sin selector.
- [x] Como profesor, forzar `?profesorId=<Rossi>` muestra igual la agenda propia (Giménez, sin turnos de Rossi), y la API con ese id responde `403`.
- [x] Los turnos pendientes no aparecen.
- [x] Anterior y Siguiente apuntan a `semana=2026-09-21` / `semana=2026-10-05` desde la semana del 28/09, conservando el profesor; Hoy quita `semana`.
- [ ] Volver desde el detalle conserva profesor y semana: los eventos mandan `?volver=` correcto, pero `/turnos/[id]` todavía vuelve a `/turnos` (§8).
- [x] Estado vacío ("Agenda sin turnos" con Quiroga). Profesor inexistente → aviso. Semana inválida → semana actual.
- [x] Cada evento ocupa su intervalo completo (10:00–12:00 → `top: 12rem; height: 12rem`; 14:00–17:00 → `top: 36rem; height: 18rem`) y el estado se lee como texto ("Agendado").
- [x] Alumno → `/sin-permiso`; sin sesión → `/login`; `/calendario` → `/calendario/profesor`.
- [ ] Revisión visual en navegador (grilla, carga "Cargando agenda" y error con Reintentar): no se hizo con navegador en esta implementación.

**Evidencia esperada:** capturas de la vista como Gerente, Mesa y Profesor, semana vacía, carga, error con Reintentar y vuelta desde el detalle (esta última, cuando se integre `/turnos/[id]`).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de implementar. *(Se implementó de corrido por pedido explícito del responsable; los puntos a relevar se resolvieron en la consigna y están en §1.)*
- [x] Criterio 1 — selector de profesores activos para Mesa y Gerente; semana actual, días operativos, horario operativo y rango en el encabezado.
- [x] Criterio 2 — el profesor ve su agenda sin selector; `profesorId` ajeno ignorado en la página y rechazado con `403` en la API.
- [x] Criterio 3 — Hora, Alumno, Materia, Aula y Estado; evento con su intervalo completo; estado con texto e ícono.
- [x] Criterio 4 — filtro `AGENDADO` en la query del servidor (verificado con un pendiente con profesor).
- [x] Criterio 5 — Anterior, Siguiente y Hoy.
- [ ] Criterio 6 — **parcial:** el evento abre el detalle con `?volver=` correcto, pero `/turnos/[id]` todavía no lo acepta (§8).
- [x] Criterio 7 — "Agenda sin turnos", carga y error con Reintentar.
- [x] Criterio 8 — solo vista semanal.
- [x] Autorización en servidor con `calendario:leer`; profesor del rol Profesor tomado de la sesión en un único helper.
- [x] Semana calculada en `America/Argentina/Buenos_Aires`; grilla sin horarios hardcodeados.
- [x] Profesor y semana en la URL (searchParams).
- [ ] El módulo J no consulta `prisma.turno` directamente (Regla 3). *(Excepción temporal por decisión de equipo: la consulta de solo lectura vive en `calendario.service.ts` con un `TODO` hasta que el módulo C exponga su servicio; §1 punto 7.)*
- [x] Profesores consultados solo vía servicios públicos del módulo D.
- [x] Solo tokens de `DESIGN.md`.
- [x] Ningún `DELETE` físico ni escritura nueva (Regla 1).
- [x] `spec_modulo_J.md` §2.1 con nota de sincronización.
- [x] `tsc`, lint, tests (113/113) y build sin errores.
- [x] Seed corrido contra Postgres real sin errores.
- [x] Niveles 2 y 3 ejecutados con evidencia (curl + psql).
- [ ] Revisión visual en navegador (grilla, carga y error).
- [ ] Integración real con turnos de HU-C-04/C-15 validada al cierre del sprint.
- [ ] Aviso al equipo por los archivos compartidos (`seed.ts`, `Sidebar.tsx`, `profesor.service.ts`) y por el pendiente de `/turnos/[id]`.
- [ ] PR acotado a HU-J-01.

---

## 8. Pendientes y notas

- **`/turnos/[id]` debe aceptar `volver` del calendario (criterio 6):** hoy `turnos/[id]/page.tsx` solo respeta `volver` si empieza con `/turnos?`; si no, el link "Volver al listado" lleva a `/turnos`. Hace falta que acepte también rutas internas que empiecen con `/calendario` (idealmente cualquier ruta interna que empiece con `/`, sin `//`, para no abrir un open redirect) y que el texto del link no diga "listado" en ese caso. **A coordinar con el dueño de turnos (Emir).** Del lado del calendario no hay nada más que hacer: los eventos ya mandan `?volver=%2Fcalendario%2Fprofesor%3FprofesorId%3D…%26semana%3D…`.
- **Servicio público de turnos (Regla 3 / `spec_modulo_J.md` §3.4):** cuando el módulo C exponga `listarTurnosAgendadosPorProfesor()` (o equivalente), reemplazar el cuerpo de `listarTurnosAgendadosDeProfesor()` por esa llamada (ver `TODO(HU-C-04/HU-C-15)` en `calendario.service.ts`). La forma de dato que consume la UI no cambia.
- **Integración con HU-C-04 / HU-C-15:** hoy la agenda se prueba con los turnos `AGENDADO` del seed. Al cierre del sprint, validar con turnos que pasan a `AGENDADO` por el flujo real (asignación de profesor y aula) que aparecen en la agenda, y que los que quedan `PENDIENTE` no.
- **Turnos grupales:** ningún turno del seed tiene más de un alumno; la unión con "; " está cubierta solo por test unitario.
- **Revisión visual pendiente:** la grilla se verificó por HTML y estilos calculados, no en un navegador. Falta mirar en pantalla la grilla, el indicador de carga y el error con Reintentar.
- **Test runner:** mismo estado que HU-D-01 §6 y HU-D-05 §6 (sin runner instalado; se corren con `npx -y vitest@3 run`).
- **HU-J-02:** `GrillaSemanal` (genérica por `renderEvento`), `EventoCalendario` y `calendario-semana.ts` quedan en `components/shared` y `lib` para que la vista por materia los reutilice.
