# TASK: HU-J-01 — Visualizar calendario de turnos por profesor

**Módulo:** J (Visualizar calendario)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_J.md` §1, §2.1 (con nota de sincronización HU-J-01) y §3.1–3.4 · `docs/specs/spec_modulo_D.md` §2.5 ("Contrato para HU-J-01") · `docs/tasks/Sprint 1/HU-Sprint-1.md` HU-J-01, criterios de aceptación 1-8
**RBAC:** `calendario:leer` — **nuevo**, para `MESA_ENTRADA`, `GERENTE` y `PROFESOR` (`spec_modulo_J.md` §2, convenciones generales). Se agrega en el seed. `rutas-por-rol.ts` ya dejaba `/calendario/**` como `"CUALQUIERA"` y `src/proxy.ts` ya lo incluía en el `matcher`.
**Schema:** sin migración propia. `Turno` (`fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno`, `cupoMaximoTurno`, `estadoTurno`, `materiaId`, `profesorId`, `aulaId`), `TurnoAlumno` y `Profesor.usuarioId` (vínculo cuenta ↔ profesor) ya tienen todo lo necesario. La hora de fin se calcula (`horaInicio + duracionMinutos`), no se guarda. El enum `EstadoTurno` es `PENDIENTE | DISPONIBLE | COMPLETO` desde HU-C-03 (ver §0.1).
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/calendario.types.ts`, schema en `src/server/calendario/calendario.schema.ts`, service en `src/server/calendario/calendario.service.ts`).

> **Nota de sincronización (24/09/2026, remediación de HU-C-15):** desde HU-C-03 el enum `EstadoTurno` es `PENDIENTE | DISPONIBLE | COMPLETO`, y `listarTurnosAgendadosDeProfesor()` ya filtra por `estadoTurno IN ("DISPONIBLE", "COMPLETO")` (migrado en HU-C-03). HU-C-04 y HU-C-15 se cerraron sin que el Módulo C expusiera `listarTurnosAgendadosPorProfesor()`, así que la excepción temporal de §1 punto 7 sigue vigente: el TODO de `calendario.service.ts` se reescribió como deuda técnica explícita, `TODO(Regla N.° 3)`.
>
> **Actualización (24/09/2026, relevamiento del cambio de flujo de turnos):** §1, §2.1, §4 y §8 se reescribieron para el flujo nuevo (ver §0.1). Las menciones a `AGENDADO` que quedan en §0 y en la evidencia original de §6 (Niveles 1–3 y prueba manual) son registro histórico de la implementación original. En el lenguaje de la HU, "turno agendado" equivale hoy a `DISPONIBLE` o `COMPLETO`.

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

## 0.1. Relevamiento — cambio de flujo de turnos (24/09/2026)

Relevado sobre `develop` (último commit `472cd8d fix/HU-C-15-remediacion`), con HU-C-03, HU-C-04 y HU-C-15 mergeadas. En el working tree hay una migración sin versionar, `prisma/migrations/20260924222247/` (cambia la FK `reservas_turno.turnoId` a `ON DELETE CASCADE`) y un cambio en `migration_lock.toml`; ninguno afecta al calendario. Sin cambios de código en este relevamiento.

### 1. Modelo `Turno` y relacionados

`prisma/schema.prisma` (modelo `Turno`, `TurnoAlumno`, `ReservaTurno`, `EventoTurno`):

| Campo / relación | Tipo | Notas |
|---|---|---|
| `fechaTurno` | `DateTime @db.Date` | Fecha calendario, sin hora |
| `horaInicioTurno` | `DateTime @db.Time` | Se lee con `toISOString().slice(11, 16)` |
| `duracionMinutosTurno` | `Int` | Duración estándar vigente al crear. La hora de fin **no se guarda**: `inicio + duración` |
| `cupoMaximoTurno` | `Int` | **Nuevo (HU-C-03).** Máximo de alumnos |
| `estadoTurno` | `EstadoTurno @default(PENDIENTE)` | Ver punto 2 |
| `materiaId` | `String` (NOT NULL) | → `Materia` |
| `profesorId` | `String?` | → `Profesor`. A lo sumo uno. **Puede estar cargado con el turno todavía `PENDIENTE`** (HU-C-04) |
| `aulaId` | `String?` | → `Aula`. **Puede estar cargada con el turno todavía `PENDIENTE`** (HU-C-15, orden libre) |
| `alumnos` | `TurnoAlumno[]` (N:M) | De 0 a `cupoMaximoTurno` alumnos |
| `reservas` | `ReservaTurno[]` | Proyección técnica mantenida por triggers de PostgreSQL (aula, profesor y cada alumno) solo para turnos `DISPONIBLE`/`COMPLETO`; exclusión GiST contra superposiciones (`spec_modulo_C.md` §3.4) |
| `creadoPorUsuarioId`, `modificadoPorUsuarioId`, `createdAtTurno`, `updatedAtTurno` | — | Auditoría (Regla 2a) |

`EventoTurno` guarda los eventos del módulo C (`turno:configurado`, `turno:participantes_asignados`, `turno:aula_asignada`, `turno:disponibilizado`, `turno:completado`, `turno:alumno_agregado`, `turno:alumno_quitado`, `turno:disponible_nuevamente`).

### 2. Estados

`enum EstadoTurno { PENDIENTE DISPONIBLE COMPLETO }` (`schema.prisma`; `spec_modulo_C.md` Revisión 2, §1):

| Estado | Significado | ¿Calendario? |
|---|---|---|
| `PENDIENTE` | Configurado y todavía sin confirmar. Puede tener profesor, alumnos y aula ya cargados, pero **no reserva recursos** | **No** |
| `DISPONIBLE` | Confirmado (tiene aula, profesor y al menos un alumno al confirmar) con lugares libres. Reserva aula, profesor y alumnos. Puede quedar con 0 alumnos si se quitan todos después (Decisión B de HU-C-04) | **Sí** |
| `COMPLETO` | Confirmado con `alumnos == cupoMaximoTurno` | **Sí** |

Transiciones: `PENDIENTE → DISPONIBLE | COMPLETO` (HU-C-15) y `DISPONIBLE ⇄ COMPLETO` automático según inscriptos (HU-C-04 §2.5). No hay vuelta a `PENDIENTE` ni cancelación en Sprint 1. **El equivalente de "turno agendado/confirmado" es `DISPONIBLE` ∪ `COMPLETO`**; el módulo C usa la misma definición en sus validaciones (`ESTADOS_AGENDADOS` en `turno.service.ts:78`, `ESTADOS_CONFIRMADOS` en `turno.aula.service.ts:13`, ambas constantes privadas).

### 3. Flujo de creación y asignación

1. **Configurar** (HU-C-03): `/turnos/nuevo` (`turno-configuracion.tsx`) → `POST /api/turnos` → `configurarTurno()` (`turno.service.ts:45`). Crea el turno con materia, fecha, hora, duración estándar y cupo; `estadoTurno: "PENDIENTE"`, `profesorId: null`, `aulaId: null`. Mientras siga `PENDIENTE` se puede modificar (`PATCH /api/turnos/[id]/configuracion`, `modificarConfiguracionTurno()`); si cambia la materia, el profesor puede quedar desasignado.
2. **Participantes** (HU-C-04 §2.2): `/turnos/[id]/participantes` → `PATCH /api/turnos/[id]/participantes` → `asignarParticipantesTurno()` (`turno.service.ts:114`). Carga o reemplaza el profesor y el conjunto completo de alumnos. **El turno sigue `PENDIENTE`.**
3. **Aula** (HU-C-15): `/turnos/[id]/aula` → `PATCH /api/turnos/[id]/aula` → `asignarAulaTurno()` (`turno.aula.service.ts:67`). Orden libre respecto del paso 2:
   - Sin profesor o sin alumnos: guarda el aula y el turno **sigue `PENDIENTE`** ("Aula asignada correctamente"), sin reservas.
   - Con profesor y al menos un alumno: revalida todo y **confirma** en la misma transacción como `COMPLETO` (alumnos = cupo) o `DISPONIBLE`. Los triggers crean las reservas. Si los participantes se cargan después del aula, hay que volver a `/turnos/[id]/aula` para confirmar.
4. **Inscripciones** (HU-C-04 §2.5), solo sobre turnos confirmados, desde el detalle `/turnos/[id]`: `POST /api/turnos/[id]/alumnos` (`agregarAlumnoTurno()`, puede pasar a `COMPLETO`) y `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (`quitarAlumnoTurno()`, puede volver a `DISPONIBLE`).

**Único momento en que un turno entra al calendario:** la confirmación del paso 3. Desde ahí, el paso 4 puede cambiar el estado entre `DISPONIBLE` y `COMPLETO` y la lista de alumnos, pero no lo saca del calendario.

### 4. Servicio público de lectura por profesor y rango

**No existe.** `turno.service.ts` exporta `configurarTurno`, `modificarConfiguracionTurno`, `asignarParticipantesTurno`, `agregarAlumnoTurno`, `quitarAlumnoTurno`, `listarTurnos(pagina, porPagina, usuario)` (paginado, desde hoy, **todos los estados**), `obtenerTurno(id, usuario)` y `emitirEventoTurno`. `turno.aula.service.ts` exporta `listarOpcionesAulaTurno` y `asignarAulaTurno`. Ninguna filtra por profesor + rango de fechas + estado confirmado; `listarTurnos()` no sirve como sustituto (paginado, sin rango, incluye `PENDIENTE`). `HU-C-15.md` D17 lo registra como deuda técnica fuera de alcance. `spec_modulo_C.md` Revisión 2 tampoco contractualiza `listarTurnosAgendadosPorProfesor()`.

### 5. Detalle `/turnos/[id]`

Sin cambios respecto del problema original. `turnos/[id]/page.tsx:11`: `const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";`. El mismo filtro está en `[id]/aula/page.tsx:8`, `[id]/configuracion/page.tsx:5` y `[id]/participantes/page.tsx:8`. El link de `turno-detalle.tsx` sigue diciendo "Volver al listado". **Un `?volver=/calendario/...` se descarta y el detalle vuelve a `/turnos`.** Además, las subpantallas (aula, participantes, configuración) reenvían ese `retorno`, así que también perderían el calendario.

### 6. Alcance del rol `PROFESOR` en turnos

`listarTurnos()` y `obtenerTurno()` agregan `profesor: { is: { usuarioId: usuario.id } }` al `where` cuando `rol === "PROFESOR"` (`turno.service.ts:277` y `:296`). Un profesor solo ve y abre sus propios turnos, **incluidos los `PENDIENTE` donde ya fue asignado**. Para el calendario es compatible: el evento que ve un profesor es siempre suyo, así que el detalle abre bien. Si no, `obtenerTurno()` devuelve `null` → 404.

### 7. Turnos del seed

`prisma/seed.ts` (`TURNOS`, bloque "8) Turnos + TurnoAlumno"): 11 turnos con ids fijos `seed-turno-01`…`11`, fecha relativa al lunes de la semana en curso (`fechaRelativa(semana, dia)`, con la hora local del proceso) y upsert. Estado: `PENDIENTE` sin profesor; si no, `COMPLETO` cuando 1 alumno ≥ cupo, y `DISPONIBLE` en el resto.

| Semana | Turnos | Estados |
|---|---|---|
| En curso (lun–jue) | 01–06 | `COMPLETO`: 01, 04 · `DISPONIBLE`: 02, 03, 05, 06 |
| Siguiente (lun, mar, mié, vie) | 07–10 | `COMPLETO`: 07, 09 · `DISPONIBLE`: 08, 10 |
| Siguiente (jue 10:00) | 11 | `PENDIENTE`, sin profesor, sin aula y sin alumnos (cupo 5) |

Totales: 6 `DISPONIBLE`, 4 `COMPLETO` y 1 `PENDIENTE`, con 10 inscripciones (un alumno por turno confirmado). **El seed no genera un `PENDIENTE` con profesor asignado**, que es justo el caso nuevo que el filtro del calendario tiene que excluir (hoy solo lo cubre el test unitario del `where`). Tampoco hay turnos grupales ni `DISPONIBLE` con 0 alumnos.

### 8. Impacto sobre la implementación de HU-J-01

`npx tsc --noEmit`: ✅ sin errores. `npx vitest run`: ✅ 26 archivos pasan y 1 se omite (`turno.reservas.pg.test.ts`, que necesita `HU_C15_TEST_DATABASE_URL`). Resultado: `282 passed | 7 skipped`. Del calendario: `calendario.service.test.ts` 11/11 y `calendario-semana.test.ts` 14/14.

HU-C-03 ya había adaptado el código del calendario al enum nuevo. **No hay nada roto a nivel de compilación ni de tests.** Lo que queda desalineado:

| Archivo | Estado | Desalineación |
|---|---|---|
| `src/server/calendario/calendario.service.ts` | ✅ funciona | Filtra `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` en la query. Sigue consultando `prisma.turno` directo (excepción a Regla 3, `TODO(Regla N.° 3)`), porque el módulo C no expone el servicio. Duplica la lista de estados confirmados, que en el módulo C es privada: si C agrega un estado (p. ej. cancelado), el calendario no se entera |
| `src/types/calendario.types.ts` | ✅ | `estado: "DISPONIBLE" \| "COMPLETO"` |
| `src/app/api/calendario/profesor/[profesorId]/route.ts` | ✅ | Sin referencias a estados; no requiere cambios |
| `src/app/(dashboard)/calendario/profesor/page.tsx` | ✅ | Solo el texto "Turnos agendados de…", correcto en lenguaje de la HU |
| `src/components/shared/evento-calendario.tsx` | ⚠️ menor → ✅ resuelto 24/09 | Etiquetas "Disponible"/"Completo", correctas. Ambos estados usan el mismo `Badge variant="success"` y el mismo ícono `CalendarCheck`: el texto los distingue (cumple el criterio 3), pero el ícono no. `DISPONIBLE` con 0 alumnos ahora es un caso válido y se muestra "—" en Alumno  **Resuelto:** íconos distintos (`CalendarCheck` / `Users`). |
| `src/components/shared/grilla-semanal.tsx` | ✅ | Genérica, sin estados |
| `src/server/calendario/calendario.service.test.ts` | ✅ | Cubre el filtro `in [DISPONIBLE, COMPLETO]` y `COMPLETO`. No hay un caso explícito de "PENDIENTE con profesor asignado" más allá de la aserción sobre el `where` |
| `docs/specs/spec_modulo_J.md` | ❌ → ✅ sincronizada 24/09 | §1, §2.1 (paso 3, paso 4 y ejemplo JSON), §2.2 y §3.1 siguen diciendo `AGENDADO`. La nota de sincronización de §2.1 también dice "filtro `AGENDADO`"  |
| Esta task | ❌ desactualizada | §1, §2.1, §4 y §8 decían `AGENDADO`. Se corrigen en esta actualización |
| Criterio 6 (`/turnos/[id]`) | ❌ sigue pendiente | Ver punto 5 |

---

## 1. Nota de alcance — decisiones ya tomadas sobre puntos relevados

1. **DECISIÓN RESUELTA — autorización en el servidor, `profesorId` efectivo según rol.**
   - Un único helper, `resolverProfesorDeLaAgenda()` (`calendario.service.ts`), decide de quién es la agenda.
   - Rol `PROFESOR`: el profesor sale **siempre** de la sesión (`Profesor.usuarioId === session.user.id`), vía `obtenerOpcionProfesorDeUsuario()` del módulo D. Cualquier `profesorId` recibido se ignora para decidir qué agenda se muestra: la página descarta el searchParam y el menú no ofrece selector.
   - En el Route Handler, si el rol es `PROFESOR` y el `profesorId` de la ruta no es el propio → `403 SIN_PERMISO`, sin revelar si ese profesor existe (`spec_modulo_J.md` §2.1 punto 1, criterio 2 "el servidor rechaza"). Es la opción `rechazarAjeno: true` del mismo helper.
   - Rol `PROFESOR` sin ficha vinculada → `PROFESOR_SIN_FICHA`: `403 SIN_PERMISO` en la API y el aviso "Tu cuenta no tiene una ficha de profesor vinculada" en la página.
   - `MESA_ENTRADA` / `GERENTE`: usan el `profesorId` recibido; debe ser un profesor activo (`404 PROFESOR_NO_ENCONTRADO` si no), vía `obtenerOpcionProfesorActivo()` del módulo D.
   - Cualquier otro rol (`ALUMNO`): `403 SIN_PERMISO`, ya desde `calendario:leer`.

2. **DECISIÓN RESUELTA (actualizada 24/09, flujo nuevo) — filtro de turnos confirmados (`DISPONIBLE` o `COMPLETO`) en la query, no en la UI.**
   - "Turno agendado" (HU-Sprint-1, criterio 1) equivale hoy a un turno confirmado por HU-C-15: `DISPONIBLE` o `COMPLETO` (§0.1 punto 2). `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` va en el `where` de Prisma. La UI nunca recibe turnos `PENDIENTE` (`spec_modulo_J.md` §3.1), **aunque ya tengan profesor, alumnos o aula cargados**. Con el flujo nuevo es un caso normal: HU-C-04 asigna el profesor con el turno todavía `PENDIENTE`.
   - Se filtra por lista positiva de estados confirmados, no por `not: "PENDIENTE"`. Si el módulo C agrega un estado (p. ej. cancelado), no aparece en la agenda hasta que se decida explícitamente.
   - El campo `estado` se devuelve en cada evento (`"DISPONIBLE" | "COMPLETO"`), para que la UI lo muestre con texto ("Disponible" / "Completo") e ícono además del color.

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

7. **DECISIÓN RESUELTA (revalidada 24/09) — lectura de turnos dentro del módulo J (excepción temporal a Regla 3 / `spec_modulo_J.md` §3.4). Se mantiene.**
   - El relevamiento del flujo nuevo (§0.1 punto 4) confirmó que el módulo C **no** expone un servicio público de lectura por profesor y rango: `listarTurnos()` es paginado, sin rango y trae `PENDIENTE`; `obtenerTurno()` es por id. Por eso la excepción **no se cierra**.
   - **No se modifican archivos del módulo C** (`src/server/turnos/**`, `src/app/api/turnos/**`, `src/app/(dashboard)/turnos/**`). La consulta de solo lectura sigue en `listarTurnosAgendadosDeProfesor(profesorId, desde, hasta)` de `calendario.service.ts`, adaptada al modelo nuevo (filtro `DISPONIBLE`/`COMPLETO`, `TurnoAlumno` N:M), con rango `[desde, hasta)` y la forma de dato de §4.3.
   - Mantiene el `TODO(Regla N.° 3)`. Cuando el módulo C exponga el servicio (contrato propuesto en §8), se reemplaza el cuerpo por esa llamada sin cambiar la firma ni la forma de `EventoCalendario`, y se cierra la excepción. **Si el servicio se publica antes del cierre del sprint, esta HU pasa a consumirlo** (regla de esta actualización).
   - HU-C-03, HU-C-04 y HU-C-15 ya están cerradas. La integración real con el flujo de turnos (confirmar un turno por `/turnos/[id]/aula` y verlo en la agenda) queda como verificación pendiente (§7).

8. **DECISIÓN RESUELTA — campos por rol.**
   - Cada evento muestra Hora, Alumno, Materia, Aula y Estado para los tres roles. Según `spec_modulo_J.md` §2.1 punto 4, "según los permisos del rol" se refiere al acceso (punto 1), no a campos distintos por rol.

9. **DECISIÓN RESUELTA — turnos grupales (`TurnoAlumno` N:M).**
   - Se mantiene `alumno: string` como define la spec. Si un turno tiene más de un alumno, los nombres se unen como `"Apellido, Nombre; Apellido, Nombre"`, ordenados por apellido y nombre normalizados. Sin cambios de schema.
   - **Sin alumnos** es ahora un caso válido: un turno `DISPONIBLE` puede quedar en `0/N` si se quitan todos (Decisión B de HU-C-04). Sigue en la agenda (el profesor y el aula siguen reservados) y en Alumno muestra "—" (`VALOR_AUSENTE`). Sin aula no debería pasar en un turno confirmado (HU-C-15 exige aula para confirmar); si pasara, también "—".
   - No se agrega la ocupación (`"1/3"`) al evento: la spec J no la pide y el estado `COMPLETO`/`DISPONIBLE` ya la resume. Queda como posible mejora (§8).

10. **DECISIÓN RESUELTA (revalidada 24/09) — `?volver=` en el detalle de turno. Sigue pendiente de integración.**
    - **No se modifica `/turnos/[id]`** (módulo C). El relevamiento (§0.1 punto 5) confirmó que el detalle sigue aceptando solo `volver` que empiece con `/turnos?`. Con `?volver=/calendario/...`, su link "Volver al listado" lleva a `/turnos`. Las subpantallas `aula`, `participantes` y `configuracion` tienen el mismo filtro. Los eventos del calendario ya mandan el `volver` correcto, así que del lado de J no hay nada más que hacer. **Criterio 6 sigue parcial** (§8).

**Supuestos tomados:**
- **Profesor inactivo con cuenta:** puede ver su propia agenda (`obtenerOpcionProfesorDeUsuario()` no filtra por activo). Mesa/Gerente solo consultan profesores activos.
- **Semana inválida en la URL:** la página abre la semana actual; el Route Handler responde `400 VALIDACION`.
- **Sin días operativos configurados:** `obtenerParametrosHorarioOperativo()` ya cae al valor por defecto.
- **Error de negocio vs. error técnico:** profesor inexistente/inactivo y profesor sin ficha se informan en la página con un aviso; solo un error inesperado va a `error.tsx` con Reintentar.

**Dependencias de esta implementación:**
- **Depende de:**
  - HU-C-15: confirmación del turno (`PENDIENTE → DISPONIBLE/COMPLETO`) y HU-C-04: profesor asignado e inscripciones (`DISPONIBLE ⇄ COMPLETO`). Ambas cerradas; el seed trae 6 `DISPONIBLE`, 4 `COMPLETO` y 1 `PENDIENTE`.
  - Módulo C: servicio público de lectura por profesor y rango (**no existe**, §1 punto 7) y `volver` desde `/calendario` en `/turnos/[id]` (**no existe**, §1 punto 10).
  - HU-D-05: `listarOpcionesProfesoresActivos()`.
  - HU-D-04: `obtenerParametrosHorarioOperativo()` y helpers de `horario-atencion.ts`.
- **Es requisito de:** HU-J-02 (calendario por materia), que puede reutilizar `GrillaSemanal`, `EventoCalendario` y `calendario-semana.ts`.

**Fuera de alcance de esta task (explícito):**
- Vistas intercambiables por día, semana y mes (Sprint 2, criterio 8).
- Filtros combinados, por ejemplo profesor + materia (Sprint 3).
- Impresión o exportación de la agenda.
- HU-J-02 (calendario por materia).
- Cualquier escritura sobre turnos.
- Cambios en cualquier archivo del módulo C: `turno.service.ts`, `turno.aula.service.ts`, `/turnos/[id]` y sus subpantallas.

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
| 3 | Cada evento muestra Hora, Alumno, Materia, Aula y Estado; ocupa su intervalo completo; estado con texto o ícono además del color. | Bloque posicionado por hora de inicio y duración; `Badge` con texto "Disponible" o "Completo" e ícono distinto por estado (`CalendarCheck` / `Users`); texto completo en `title` y en el nombre accesible. Turno grupal: alumnos unidos con "; "; `DISPONIBLE` sin alumnos: "—" (§1 punto 9). ✅ Cumplido (verificado con el flujo real, §6). | `evento-calendario.tsx`, `grilla-semanal.tsx`, `posicionEnGrilla()` |
| 4 | Los turnos pendientes no aparecen. | `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` en el `where` del servidor (§1 punto 2). Excluye también los `PENDIENTE` con profesor ya asignado por HU-C-04. ✅ Cumplido. | `listarTurnosAgendadosDeProfesor()` |
| 5 | Semana anterior / siguiente y acción Hoy. | Links que cambian `?semana=` y conservan `?profesorId=`. | `navegacion-semana.tsx`, `construirUrlCalendarioProfesor()`, `desplazarSemana()` |
| 6 | Al seleccionar un evento se abre el detalle; al volver se conservan profesor y semana. | Cada evento abre `/turnos/[id]?volver=<URL del calendario>`. El detalle abre para los tres roles: para `PROFESOR`, `obtenerTurno()` filtra por sus propios turnos, y el evento siempre es suyo. **Parcial, pendiente de integración (revalidado 24/09):** el link "Volver al listado" del detalle sigue ignorando un `volver` que no empiece con `/turnos?` (§0.1 punto 5, §1 punto 10, §8). El "atrás" del navegador sí conserva profesor y semana porque viajan en la URL. | `evento-calendario.tsx` (J, listo) · `turnos/[id]/page.tsx` (C, pendiente) |
| 7 | Sin turnos: "Agenda sin turnos". Indicador de carga; error con Reintentar. | `eventos: []` → "Agenda sin turnos" sobre la grilla. `<Suspense key>` con "Cargando agenda"; `error.tsx` con `retry()`. | `calendario/profesor/page.tsx`, `calendario/profesor/error.tsx` |
| 8 | Vistas por día/semana/mes corresponden a un incremento posterior. | Solo vista semanal, sin controles de cambio de vista. | — |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_J.md` §2.1 y §3, con las decisiones de §1.

### 3.1. Desglose en subtareas técnicas

- [x] **Permiso `calendario:leer`** en el seed para `MESA_ENTRADA`, `GERENTE` y `PROFESOR` (§4.0).
- [x] **Helpers puros de semana y grilla** (`src/lib/calendario-semana.ts`) (§4.1).
- [x] **Schema Zod:** `ConsultarCalendarioProfesorQuerySchema` (§4.2).
- [x] **Consulta de turnos confirmados (`DISPONIBLE`/`COMPLETO`)** dentro del módulo J: `listarTurnosAgendadosDeProfesor()` (§4.3). Adaptada al enum nuevo en HU-C-03 y revalidada el 24/09.
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
- Cambios en archivos del módulo C (`turno.service.ts`, `turno.aula.service.ts`, `/turnos/[id]` y subpantallas).
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
| `src/server/calendario/calendario.service.test.ts` | 11 tests del servicio (10 originales + `COMPLETO`, agregado en HU-C-03) con `prisma`, módulo D y parámetros mockeados (§6) |
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
- **Turnos:** HU-J-01 no agregó turnos. Con el flujo nuevo (HU-C-03), el seed genera, relativos a "hoy", 6 turnos confirmados en la semana en curso y 4 en la siguiente, de los cuatro profesores con cuenta (6 `DISPONIBLE` y 4 `COMPLETO` en total), más 1 `PENDIENTE` sin profesor (§0.1 punto 7). Falta un `PENDIENTE` con profesor asignado para verificar el criterio 4 contra el flujo nuevo; se agrega a mano en la prueba (§6) o lo suma el dueño del seed (§8).

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
- `where: { profesorId, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, fechaTurno: { gte: desde, lt: hasta } }`. Lista positiva de estados confirmados (§1 punto 2).
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
  aula: string;        // "—" si faltara (no debería en un turno confirmado)
  estado: "DISPONIBLE" | "COMPLETO";
};
```

**Contrato objetivo en el módulo C** (propuesto para coordinar, §8; **todavía no existe**, así que HU-J-01 no lo consume). Cuando exista, `listarTurnosAgendadosDeProfesor()` pasa a ser un adaptador que llama a este servicio y mapea al `EventoCalendario` de arriba, sin tocar el `prisma.turno`:

```typescript
// src/server/turnos/turno.service.ts (módulo C) — propuesto
export async function listarTurnosAgendadosPorProfesor(
  profesorId: string,
  desde: Date, // fechaTurno >= desde
  hasta: Date, // fechaTurno <  hasta
): Promise<{
  id: string;
  fecha: string;          // "AAAA-MM-DD"
  hora_inicio: string;    // "HH:mm"
  hora_fin: string;       // "HH:mm"
  estado: "DISPONIBLE" | "COMPLETO"; // solo confirmados, filtrado en la query
  materia: string;
  aula: string | null;
  alumnos: { apellido: string; nombre: string }[]; // orden apellido/nombre normalizados
}[]>;
```

Requisitos para J: filtro de estado confirmado **en la query** (misma definición que `ESTADOS_AGENDADOS`/`ESTADOS_CONFIRMADOS`), rango semiabierto, orden por fecha, hora e id, y sin paginar. HU-J-02 necesitaría además la variante por materia (`listarTurnosAgendadosPorMateria(materiaId, desde, hasta, profesorId?)`, `spec_modulo_J.md` §1).

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

**Paleta:** solo tokens de `docs/DESIGN.md`. Estado con `Badge` `success` ("Disponible" o "Completo", `ETIQUETA_ESTADO` de `evento-calendario.tsx`) **con texto e ícono** (`ICONO_ESTADO`: `CalendarCheck` para Disponible y `Users` para Completo); bloque del evento `bg-background` con borde izquierdo `border-l-primary`, hover `bg-accent`; columna de hoy con `bg-secondary`/`text-secondary-foreground`; errores con `text-destructive`.

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
  - `listarTurnosAgendadosDeProfesor`: `where` con `estadoTurno: "AGENDADO"` (hoy `{ in: ["DISPONIBLE", "COMPLETO"] }`, adaptado en HU-C-03, más un caso `COMPLETO`) y rango `[desde, hasta)`; forma del evento y `hora_fin` por duración; alumnos unidos con "; " y "—" sin alumno/aula.
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

### Revalidación con el flujo nuevo de turnos (24/09/2026)

Sin cambios de código. Solo relevamiento (§0.1):

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npx vitest run` (runner del repo, `vitest.config.mjs`) | ✅ 26 archivos pasan y 1 se omite (`turno.reservas.pg.test.ts`, requiere `HU_C15_TEST_DATABASE_URL`); `282 passed \| 7 skipped` |
| `calendario.service.test.ts` / `calendario-semana.test.ts` | ✅ 11/11 y 14/14 |

### Ajustes posteriores al relevamiento (24/09/2026)

- `spec_modulo_J.md`: `AGENDADO` → confirmado (`DISPONIBLE` o `COMPLETO`) en §1, §2.1 (pasos 3–4, ejemplo JSON y nota de sincronización), §2.2 y §3.1. Explicita que un `PENDIENTE` con profesor, alumnos o aula ya cargados no aparece.
- `calendario.service.test.ts`: 2 casos nuevos, "no incluye un PENDIENTE aunque ya tenga profesor, alumnos y aula asignados" (el mock aplica el `where` recibido) y "muestra un DISPONIBLE sin alumnos con '—' en Alumno". Total: 13 tests.
- `evento-calendario.tsx`: ícono por estado (`ICONO_ESTADO`): `CalendarCheck` para Disponible y `Users` para Completo. Mismo `Badge variant="success"`, mismo texto, sin colores nuevos.

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores ni warnings |
| `npm test` | ✅ 26 archivos pasan y 1 se omite (`turno.reservas.pg.test.ts`); `284 passed \| 7 skipped` (calendario: 13/13) |
| `npm run build` | ✅ compila |

### Pruebas con el flujo real (24/09/2026)

Base `noctium_dev` (contenedor `noctium_db`, migraciones al día según `prisma migrate status`), seed corrido, `npm run dev` y `curl` con sesiones reales de NextAuth (`mesa.entrada@`, `gerente@`, `profesor1@` = Giménez). Solo endpoints del módulo C sin modificar su código. Turno de prueba: viernes 25/09/2026 15:00–16:00, Matemática, cupo 2, profesora Giménez (dentro de su horario del viernes 14–18). Consulta: `GET /api/calendario/profesor/{Giménez}?semana_inicio=2026-09-21`.

- [x] **a. `PENDIENTE` con profesor y alumno no aparece.** `POST /api/turnos` → `201`, `estado: "PENDIENTE"`. `PATCH /api/turnos/{id}/participantes` (Giménez + Herrera) → `200`, `estado: "PENDIENTE"`. En base: `PENDIENTE`, `profesorId` = Giménez, sin aula y 1 alumno. La agenda como Gerente, Mesa y Profesor devuelve solo `seed-turno-01` (`COMPLETO`) y `seed-turno-05` (`DISPONIBLE`); el turno nuevo **no** aparece.
- [x] **b. Al asignar aula pasa a `DISPONIBLE` y aparece.** `PATCH /api/turnos/{id}/aula` (Aula 2) → `200`, `estado: "DISPONIBLE"`, "Turno confirmado correctamente". En base: `DISPONIBLE`, con reservas `PROFESOR`, `AULA` y `ALUMNO` en `reservas_turno`. La agenda (Gerente, Mesa y Profesor) incluye `{ fecha: "2026-09-25", hora_inicio: "15:00", hora_fin: "16:00", alumno: "Herrera, Facundo", materia: "Matemática", aula: "Aula 2", estado: "DISPONIBLE" }`. `GET /api/turnos/{id}` como Profesor → `200` (el evento propio abre el detalle).
- [x] **c. Alta y baja desde el detalle cambian el estado del evento.**
  - `POST /api/turnos/{id}/alumnos` (Castro) → `200`, `2/2`, `COMPLETO`. Evento: `alumno: "Castro, Florencia; Herrera, Facundo"`, `estado: "COMPLETO"` (turno grupal real).
  - `DELETE /api/turnos/{id}/alumnos/{Castro}` → `200`, `1/2`, `DISPONIBLE`. Evento: `alumno: "Herrera, Facundo"`, `estado: "DISPONIBLE"`.
  - `DELETE /api/turnos/{id}/alumnos/{Herrera}` → `200`, `0/2`, `DISPONIBLE`. El evento **sigue** en la agenda con `alumno: "—"`.
- [x] **UI (HTML renderizado como Gerente):** `/calendario/profesor?profesorId={Giménez}&semana=2026-09-21` muestra 2 íconos `lucide-calendar-check` (Disponible) y 1 `lucide-users` (Completo). Los `aria-label` terminan en "· Completo" / "· Disponible".
- [x] **Criterio 6 (sigue pendiente, del módulo C):** `/turnos/{id}?volver=%2Fcalendario%2Fprofesor%3F…` renderiza `href="/turnos"` "Volver al listado": el `volver` del calendario se descarta, como se esperaba (§8 punto 1).

**Limpieza:** se borró el turno de prueba con sus filas de `eventos_turno` (9), `reservas_turno` (2) y `turno_alumno` (0), por `psql` y en una transacción. Son datos de prueba creados en esta verificación, no datos del dominio. Después se volvió a correr el seed: 11 turnos (6 `DISPONIBLE`, 4 `COMPLETO`, 1 `PENDIENTE`), 10 inscripciones, 30 reservas y 0 eventos de turno. No se tocaron `prisma/migrations/` ni archivos del módulo C.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de implementar. *(Se implementó de corrido por pedido explícito del responsable; los puntos a relevar se resolvieron en la consigna y están en §1.)*
- [x] Criterio 1 — selector de profesores activos para Mesa y Gerente; semana actual, días operativos, horario operativo y rango en el encabezado.
- [x] Criterio 2 — el profesor ve su agenda sin selector; `profesorId` ajeno ignorado en la página y rechazado con `403` en la API.
- [x] Criterio 3 — Hora, Alumno, Materia, Aula y Estado ("Disponible" / "Completo"); evento con su intervalo completo; estado con texto e ícono distinto por estado (`CalendarCheck` / `Users`, verificado en HTML el 24/09).
- [x] Criterio 4 — filtro `estadoTurno IN (DISPONIBLE, COMPLETO)` en la query del servidor. Verificado con el flujo real el 24/09: un `PENDIENTE` con profesor y alumno no aparece y aparece al confirmarse (§6 a y b). También lo cubre un test.
- [x] Criterio 5 — Anterior, Siguiente y Hoy.
- [ ] Criterio 6 — **parcial, pendiente de integración (verificado con el flujo real el 24/09):** el evento abre el detalle con `?volver=` correcto, pero `/turnos/[id]` renderiza "Volver al listado" con `href="/turnos"` (§0.1 punto 5, §6, §8).
- [x] Criterio 7 — "Agenda sin turnos", carga y error con Reintentar.
- [x] Criterio 8 — solo vista semanal.
- [x] Autorización en servidor con `calendario:leer`; profesor del rol Profesor tomado de la sesión en un único helper.
- [x] Semana calculada en `America/Argentina/Buenos_Aires`; grilla sin horarios hardcodeados.
- [x] Profesor y semana en la URL (searchParams).
- [ ] El módulo J no consulta `prisma.turno` directamente (Regla 3). *(Excepción temporal vigente, revalidada el 24/09: el módulo C sigue sin exponer un servicio de lectura por profesor y rango. La consulta de solo lectura vive en `calendario.service.ts` con `TODO(Regla N.° 3)`; §1 punto 7, contrato objetivo en §4.3.)*
- [x] Profesores consultados solo vía servicios públicos del módulo D.
- [x] Solo tokens de `DESIGN.md`.
- [x] Ningún `DELETE` físico ni escritura nueva (Regla 1).
- [x] `spec_modulo_J.md` §2.1 con nota de sincronización, y spec alineada con `DISPONIBLE`/`COMPLETO` (24/09).
- [x] `tsc`, lint, tests (113/113) y build sin errores. *(Revalidado 24/09 después de los ajustes: `tsc` ✅, lint ✅, `npm test` 284 passed / 7 skipped, build ✅.)*
- [x] Seed corrido contra Postgres real sin errores.
- [x] Niveles 2 y 3 ejecutados con evidencia (curl + psql).
- [ ] Revisión visual en navegador (grilla, carga y error).
- [x] Integración real con turnos de HU-C-04/C-15 (confirmación por aula, `DISPONIBLE ⇄ COMPLETO`, `PENDIENTE` con profesor excluido, `DISPONIBLE` sin alumnos): validada el 24/09 por API con sesiones reales (§6, "Pruebas con el flujo real").
- [ ] Aviso al equipo por los archivos compartidos (`seed.ts`, `Sidebar.tsx`, `profesor.service.ts`) y por el pendiente de `/turnos/[id]`.
- [ ] PR acotado a HU-J-01.

---

## 8. Pendientes y notas

### A coordinar con el dueño de turnos (módulo C, Emir)

HU-J-01 no modifica archivos del módulo C. Estos pedidos quedan del lado de C:

1. **`/turnos/[id]` debe aceptar `volver` del calendario (criterio 6, bloqueante para cerrarlo):** hoy `turnos/[id]/page.tsx:11` solo respeta `volver` si empieza con `/turnos?`. Hace falta que acepte también rutas internas que empiecen con `/calendario` (idealmente cualquier ruta interna que empiece con `/` y no con `//`, para no abrir un open redirect). El texto del link no debería decir "Volver al listado" en ese caso (p. ej. "Volver a la agenda"). Aplicar el mismo criterio en `[id]/aula/page.tsx:8`, `[id]/participantes/page.tsx:8` y `[id]/configuracion/page.tsx:5`, que reenvían `retorno`. Conviene un helper único de validación de `volver`. Del lado del calendario no hay nada más que hacer: los eventos ya mandan `?volver=%2Fcalendario%2Fprofesor%3FprofesorId%3D…%26semana%3D…`.
2. **Servicio público de lectura por profesor y rango (Regla 3, `spec_modulo_J.md` §3.4, D17 de HU-C-15):** exponer `listarTurnosAgendadosPorProfesor(profesorId, desde, hasta)` con el contrato propuesto en §4.3, y contractualizarlo en `spec_modulo_C.md`. Cuando exista, HU-J-01 reemplaza el cuerpo de `listarTurnosAgendadosDeProfesor()` por esa llamada, borra el `TODO(Regla N.° 3)` y cierra la excepción. La forma de dato que consume la UI no cambia. Para HU-J-02 hace falta además `listarTurnosAgendadosPorMateria()`.
3. **Definición única de "estados confirmados":** hoy existe tres veces (`ESTADOS_AGENDADOS` en `turno.service.ts:78`, `ESTADOS_CONFIRMADOS` en `turno.aula.service.ts:13` y el literal en `calendario.service.ts`). Si C agrega estados (cancelado, finalizado), avisar a J; con el punto 2 resuelto, la definición queda solo en C.
4. **Seed:** sumar un turno `PENDIENTE` **con profesor asignado** (y alumnos) en la semana en curso o la siguiente, que es el caso nuevo que el filtro del calendario debe excluir. Opcionalmente, un turno grupal (2+ alumnos) y un `DISPONIBLE` con 0 alumnos. `prisma/seed.ts` es compartido: confirmar quién lo toca.
5. **Aviso de cambios de estado o flujo:** si C agrega cancelación o reprogramación de turnos confirmados (fuera de alcance del Sprint 1 según `spec_modulo_C.md`), avisar a J para decidir si esos turnos se muestran.

### Otros pendientes

- ~~`spec_modulo_J.md` desactualizada~~ — **resuelto 24/09** (§6, "Ajustes posteriores al relevamiento").
- ~~Integración con HU-C-04 / HU-C-15~~ — **validada 24/09** con el flujo real (§6).
- ~~Ícono de estado~~ — **resuelto 24/09**: `CalendarCheck` (Disponible) y `Users` (Completo), mismo `Badge variant="success"`.
- **Ocupación en el evento:** opcional mostrar `inscriptos/cupo` (p. ej. "1/3"), igual que HU-C-01. La spec J no lo pide; requeriría `cupoMaximoTurno` en la consulta (o en el servicio de C).
- **Turnos grupales:** ningún turno del seed tiene más de un alumno. La unión con "; " la cubre un test unitario y se verificó una vez con el flujo real (§6 c, turno de prueba ya borrado).
- **Seed y zona horaria:** `fechaRelativa()` del seed calcula "hoy" con la hora local del proceso, no con Buenos Aires. Si el seed corre en un contenedor en UTC entre las 21:00 y las 24:00 de un domingo, los turnos quedan una semana corridos respecto de la agenda. Es menor y del dueño del seed.
- **Revisión visual pendiente:** la grilla se verificó por HTML y estilos calculados, no en un navegador. Falta mirar en pantalla la grilla, el indicador de carga y el error con Reintentar.
- **Test runner:** al implementar la HU no había runner instalado (se usó `npx -y vitest@3 run`). Hoy el repo tiene `vitest` en `devDependencies`, `vitest.config.mjs` y `npm test`; la revalidación del 24/09 usó `npx vitest run`.
- **HU-J-02:** `GrillaSemanal` (genérica por `renderEvento`), `EventoCalendario` y `calendario-semana.ts` quedan en `components/shared` y `lib` para que la vista por materia los reutilice.
