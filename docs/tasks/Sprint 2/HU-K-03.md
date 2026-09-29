# TASK: HU-K-03 — Modificar datos del aula

**Módulo:** K (Aulas)
**Sprint:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_K.md` Revisión 2: §2.4 (contrato, incluido «Cancelar (HU-K-03 AC4)» y paso 6, emisión de eventos post-COMMIT), §2.2 (detalle con `version`), §3.4 (la capacidad gobierna el cupo de los turnos futuros), §3.5 (modificar no reserva ni libera recursos), §4 (trazabilidad por columnas, sin evento propio). También: §2.1 (reglas de validación del alta, reutilizadas) · `docs/specs/spec_modulo_C.md` Revisión 5 §2.15 (`ajustarCuposPorCapacidadDeAula` y `emitirEventosTurno`) y §4 (eventos `turno:cupo_actualizado`, `turno:completado`, `turno:disponible_nuevamente`) · `docs/specs/spec_modulo_L.md` §2.4 «Cancelar (AC4)» · `docs/tasks/Sprint 2/HU-Sprint-2.md` HU-K-03 (criterios 1 a 5) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila "Ficha de aula") · `docs/DESIGN.md` §6.2 (banner inline), §6.3 (`AlertDialog` de descarte) y §6.5 (aviso corto de acción rechazada)
**Pantalla de referencia:** Mockup 21 "Ficha de aula — edición" (pantallas de referencia Sprint 2). No está en el repo. Si difiere de la spec o del mapa de pantallas, mandan la spec y el mapa. No se crea ninguna pantalla ni ruta fuera del mapa.
**RBAC:** `aulas:editar`, exclusivo del rol Gerente. **Ya lo trae el paquete de Sprint 2**: está en `prisma/seed.ts` (`["GERENTE", "aulas:editar"]`) y en la migración `20260928150100_sprint2_modelo` (PR 0, #107). Esta task no lo agrega. `aulas:crear` y `aulas:leer` no se tocan.
**Schema:** **sin migración propia.** El paquete de Sprint 2 ya agrega a `Aula` las columnas `updatedAtAula DateTime @default(now()) @updatedAt`, `modificadoPorUsuarioId String?` y `version Int @default(0)`, con los mismos nombres que usa esta task y que `spec_modulo_K.md` §2.4 («Modelo»). **No se modifican `prisma/schema.prisma` ni `prisma/seed.ts`** (pasan por el integrador).

---

## 0. Relevamiento previo a implementación

Relevado el 28/09 sobre `develop` (`7f7a3db`). **Revisado el 29/09 contra `spec_modulo_K.md` Revisión 2** (que no existía cuando se armó esta task) y re-verificado sobre `develop` (`beda994`). Antes de escribir código, quien implemente confirma que nada de esto cambió y **espera OK explícito** sobre los puntos marcados como PENDIENTE (sección 0.6). No se resuelve ninguno por inferencia propia.

### 0.0. Qué cambió con la spec K (29/09) y estado de la rama `feature/HU-K-03`

- La spec K §2.4 paso 6 y la spec C §2.15 fijan **quién y cuándo** se registran los eventos de turno: `ajustarCuposPorCapacidadDeAula()` **no** los emite; `modificarAula()` los emite **después del COMMIT** con `emitirEventosTurno(eventos)`, **exportada por `turno.publico.ts`**. Esto **invierte** la decisión anterior Q-K3-1 (registrarlos dentro del `tx` desde Turno). Ver 0.6.
- La rama local `feature/HU-K-03` (commit `9893da9`, base `7f7a3db`) ya tiene una implementación según la versión anterior de esta task. **Necesita rework**:
  1. Revertir el cambio en `src/server/turnos/turno.publico.ts` (helper `registrarEventoTurno` y escritura de eventos dentro del `tx`, marcado "HU-K-03: coordinar con Tomás") y en `turno.publico.test.ts` / `turno.publico.pg.test.ts`. Esos archivos son del módulo C y quedan como están en `develop`.
  2. Rebasar sobre `develop`: desde `293b79f` los servicios públicos de Aula viven en `src/server/aulas/aula.publico.ts` (spec K §2.3), y la rama todavía los tiene en `aula.service.ts` (conflicto esperable).
  3. Agregar la emisión post-COMMIT (4.2 paso 7) cuando exista `emitirEventosTurno` (depende de Tomás, 0.1).
  4. Ajustar los tests a la emisión post-COMMIT (sección 7).
- El resto de lo implementado en la rama (schema, diff, unicidad, `updateMany` con `version`, rollback ante `ok: false`, `PATCH`, ficha en modo edición) coincide con la spec K y se conserva.

### 0.1. Dependencia de Turno: `turno.publico.ts` — **EXISTE `ajustarCuposPorCapacidadDeAula`; FALTA `emitirEventosTurno`**

- El PR 0 (`sprint2/pr0-migraciones`, #107) y el de servicios públicos de Turno (`sprint2/turno-publico`, #108) **están en `develop`**. `turno.publico.ts` no cambió entre `7f7a3db` y `beda994`.
- `src/server/turnos/turno.publico.ts` exporta, con esta firma real:

  ```typescript
  export async function ajustarCuposPorCapacidadDeAula(
    aulaId: string, nuevaCapacidad: number, usuarioId: string, tx: Prisma.TransactionClient,
  ): Promise<AjusteCupos>;

  type AjusteCupos =
    | { ok: true; turnos_actualizados: number; eventos: EventoTurno[] }
    | { ok: false; turnos_en_conflicto: string[]; max_inscriptos: number };
  ```
  `EventoTurno` también se exporta desde el mismo archivo (unión de `turno:cupo_actualizado`, `turno:completado`, `turno:disponible_nuevamente`, cada uno con `tipoEvento`, `turnoId` y `payloadEvento`). **Diferencia de nombres con la spec C §2.15**, que lo llama `EventoTurnoPendiente = { tipo, turno_id, payload }`: esta task usa el tipo real del código; la alineación la decide el dueño de C (0.6, Q-K3-1).
- **Qué hace (leído en el código, coincide con `spec_modulo_C.md` §2.15 salvo el borde de "futuro"):**
  1. `SELECT … FOR UPDATE` (ordenado por `idTurno`) de los turnos con ese `aulaId` en `PENDIENTE`, `DISPONIBLE` o `COMPLETO` (**`CANCELADO` queda afuera**). Después filtra en memoria los **vigentes** con `turnoSigueVigente()` (definición de "turno futuro", ver 0.6 Q-K3-4).
  2. Cuenta `TurnoAlumno` por turno. Si algún `DISPONIBLE`/`COMPLETO` futuro tiene **más** inscriptos que `nuevaCapacidad` → devuelve `ok: false` **sin escribir**, con los ids en conflicto ordenados por fecha/hora y el máximo de inscriptos.
  3. Si no hay conflicto: `cupoMaximoTurno = nuevaCapacidad` en todos los turnos futuros y recalcula estado (`COMPLETO` si `inscriptos ≥ cupo`, si no `DISPONIBLE`; `PENDIENTE` solo actualiza cupo). Escribe `modificadoPorUsuarioId` en cada turno.
  4. **No emite eventos:** los devuelve en `eventos` para que el llamador los emita **después del COMMIT** (spec C §2.15 paso 4, spec K §2.4 paso 6).
- **No lanza** ante conflicto: devuelve `ok: false`. Es responsabilidad de `modificarAula()` **lanzar** un `ServiceError` dentro del `$transaction` para que se revierta también el `UPDATE` del aula (spec K §2.4 paso 4).
- Tiene tests unitarios (`turno.publico.test.ts`) y contra Postgres real (`turno.publico.pg.test.ts`, incluido "respeta el rollback del llamador" y "bloquea un turno vencido sin modificarlo").
- **Validación de inscriptos:** sale de la misma función pública (paso 2), no de una query propia del módulo Aula.
- **`emitirEventosTurno(eventos, db?)` — NO EXISTE en `develop`.** La spec C §2.15 la declara ("`void`. Emite los `EventoTurnoPendiente` recibidos (`emitirEventoTurno()` por cada uno). El llamador la invoca después del `COMMIT`", consumidor: spec K §2.4 paso 6), pero `turno.publico.ts` no la exporta. Hoy el único emisor es `emitirEventoTurno(tipoEvento, turnoId, usuarioId, payloadEvento)` en `turno.service.ts` (línea 28), que **no es público** (Regla N.° 3). **Aulas no puede importar `turno.service.ts`** ni escribir `eventos_turno` por su cuenta (spec K §2.4 paso 6). La agrega el dueño del módulo C (Tomás): **PENDIENTE, bloquea el paso 7 de 4.2** (ver 0.6 Q-K3-1).
- **Nota sobre el ciclo de imports:** hoy `turno.service.ts` importa `@/server/aulas/aula.publico` (no `aula.service.ts`), y `aula.publico.ts` no importa nada de otros módulos (spec K §2.3). Por eso `aula.service.ts → turno.publico.ts` no arma ciclo. El problema de importar `turno.service.ts` desde Aulas no es un ciclo sino la Regla N.° 3 (no es servicio público) y el acoplamiento transitivo con Materias, Profesores y Alumnos.

### 0.2. Archivos actuales del módulo Aula que se reutilizan (HU-K-01 / HU-K-02)

| Archivo | Qué tiene hoy (`develop`) | Uso en esta HU |
|---|---|---|
| `src/server/aulas/aula.schema.ts` | `CrearAulaSchema` (nombre trim + colapso de espacios, 1–30; capacidad entero > 0), `ListarAulasQuerySchema` | Se agrega `ModificarAulaSchema` derivado de `CrearAulaSchema` (criterio 1: mismas reglas) |
| `src/server/aulas/aula.service.ts` | `crearAula` (unicidad sobre `nombreNormalizadaAula` + defensa `P2002`), `listarAulas`, `obtenerAulaPorId` (hoy **sin** `version`) | Se agrega `modificarAula()`; `obtenerAulaPorId()` suma `updated_at` y `version` (aditivo, spec K §2.2); el mensaje `NOMBRE_DUPLICADO` y la traducción de `P2002` se comparten con `crearAula` |
| `src/server/aulas/aula.publico.ts` | `verificarAulaActiva`, `listarAulasActivasParaTurno`, `hayAulasActivas`, `existeAula` (movidos en `293b79f`, spec K §2.3) | **No se toca.** No importa nada de otros módulos (spec K §2.3); `modificarAula()` no va acá |
| `src/server/aulas/actions.ts` | `crearAula` (ligada a `useActionState`, usa `verificarPermiso`) | Se agrega la Server Action `modificarAula(aulaId, formData)` con shape `{ data, error }` |
| `src/types/aula.types.ts` | `EstadoAula`, `ESTADO_INICIAL` | Se agregan `DetalleAula` y `ResultadoModificarAula` |
| `src/app/api/aulas/[id]/route.ts` | `GET` con `withPermission("aulas:leer")` | Se agrega `PATCH` con `withPermission("aulas:editar")` |
| `src/app/(dashboard)/aulas/[id]/page.tsx` | Detalle (HU-K-02): link "Volver al listado", nombre, badge Activa/Inactiva, capacidad, fecha de alta | Pasa a tener modo consulta + modo edición (`?modo=edicion`) |
| `src/app/(dashboard)/aulas/nueva/aula-form.tsx` | Formulario de alta con `ConfirmarDescarteDialog` y `DirtyStateContext` | Referencia de campos, mensajes y estilos de error (no se modifica) |

**Reutilizables de HU-L-03 (ya mergeada, #110), sin modificarlos** (verificados en `develop` el 29/09):
- `src/lib/modo-edicion.ts` (`esModoEdicion`, `fueActualizada`, `rutaModoEdicion`, `rutaTrasGuardar`). Su comentario ya anticipa el uso desde otras fichas.
- `src/components/shared/breadcrumb.tsx`.
- `src/components/shared/confirmar-descarte-dialog.tsx` + `useDirtyState` (`src/components/sesion/dirty-state-context`). Textos actuales en 5 (Cancelar).
- `Badge variant="warning"` ("Editando") en `src/components/ui/badge.tsx`.
- `exigirPermiso` / `tienePermiso` en `src/server/shared/with-permission.ts`.
- `ServiceError` con `detalles` opcional (`src/server/shared/service-error.ts`), para transportar `turnos_en_conflicto` y `max_inscriptos`.
- `src/app/(dashboard)/materias/[id]/editar-materia-form.tsx` y `page.tsx` como **plantilla de patrón** (no se importan).

### 0.3. Modelo relevado (`prisma/schema.prisma`)

**`Aula`:**
- `idAula` (cuid) · `nombreAula` `@unique @db.VarChar(30)` (collation `natural_es` por migración) · `nombreNormalizadaAula` `@unique` (vía `normalizarTexto`) · `capacidadAula Int` · `activaAula Boolean @default(true)`.
- Auditoría: `createdAtAula`, `updatedAtAula @updatedAt`, `creadoPorUsuarioId`, `modificadoPorUsuarioId`, **`version Int @default(0)`** (bloqueo optimista, ya migrado en `20260928150100_sprint2_modelo`).
- Relación `turnos Turno[]`.
- Hay **dos** `@unique` sobre el nombre (crudo y normalizado): un `P2002` puede venir de cualquiera de los dos; ambos se traducen a `NOMBRE_DUPLICADO`.

**`Turno` (`@@map("turnos")`):**
- `fechaTurno @db.Date` + `horaInicioTurno @db.Time` + `duracionMinutosTurno`.
- `cupoMaximoTurno Int?` (null hasta asignar aula; = capacidad del aula, HU-C-15).
- `estadoTurno EstadoTurno` (`PENDIENTE | DISPONIBLE | COMPLETO | CANCELADO`).
- `aulaId String?`, `modificadoPorUsuarioId`, `updatedAtTurno`.
- Inscriptos: tabla `TurnoAlumno` (`turnoId`, `alumnoId`).
- **Este módulo no lee ni escribe `turnos`, `TurnoAlumno` ni `eventos_turno`** (Regla N.° 3, spec K §3.4 y §2.4 paso 6): todo pasa por `ajustarCuposPorCapacidadDeAula` y `emitirEventosTurno`.

### 0.4. Datos del seed útiles para probar (`prisma/seed.ts`)

Los turnos del seed se fechan en **días operativos relativos al día en que se corre el seed** (0 = próximo día operativo). Para que "futuro/pasado" sea el esperado, **correr el seed el mismo día de la prueba**. `seed-turno-26` y `-27` son los únicos pasados con inscriptos. El seed no cambió entre `7f7a3db` y `beda994`.

| Aula (capacidad) | Turnos futuros (inscriptos / estado) | Máx. futuro | Pasados | Otros |
|---|---|---|---|---|
| **Aula 1** (10) | t01 **10 COMPLETO**, t06 4, t07 5, t17 0, t21 8, t24 3 | 10 | **`seed-s2-turno-historico-1..4`**: DISPONIBLE 0/10, 1 a 4 meses atrás (HU-H-01) | — |
| **Aula 2** (20) | t02 6, t05 0, t14 6, **t20 9**, t12 5 | 9 | **t26: 8** | **t09 CANCELADO** futuro con 2 |
| **Aula 10** (30) | t03 12, t10 12, t16 10, **t23 18** | 18 | **t27: 12** | — |
| **Aula 11** (35) | t08 8, t15 13, **t22 15** | 15 | — | — |
| **Laboratorio** (15) | t04 **15 COMPLETO**, t13 6, t19 8 | 15 | — | — |
| **Aula 12** (25, **inactiva**) | — | — | — | sirve para nombre duplicado contra inactiva |
| **Sala individual** (1) / **Sala grupal** (3) | — | — | — | **aulas sin turnos** |

(`tNN` = `seed-turno-NN`.) Todos los DISPONIBLE salvo los marcados.

**Huecos del seed:**
- Ningún turno `PENDIENTE` del seed tiene aula (t11, t18, t25 tienen `aulaId = null`). Para probar "PENDIENTE solo actualiza cupo" hay que crear uno con el wizard hasta el paso 4 (Aula) sin confirmar alumnos.
- No hay ningún aula donde un turno **pasado** tenga más inscriptos que todos sus futuros. Para el caso "solo turnos pasados bloquearían" se prepara el dato desde la app (CP-02).
- Usuarios: gerente y mesa de entrada del seed (ver encabezado de `seed.ts`).

### 0.5. Archivos a tocar

**Archivos creados:**
- `src/app/(dashboard)/aulas/[id]/editar-aula-form.tsx`: el modo edición de la ficha (componente cliente).
- `src/server/aulas/aula.modificar.test.ts`: tests del service y del schema (Nivel 1).

**Archivos modificados:**
- `src/server/aulas/aula.schema.ts`: `ModificarAulaSchema` / `ModificarAulaInput`.
- `src/server/aulas/aula.service.ts`:
  - `modificarAula()` (importa `ajustarCuposPorCapacidadDeAula`, `emitirEventosTurno` y el tipo `EventoTurno` de `@/server/turnos/turno.publico`; nada más del módulo C);
  - un helper para traducir `P2002` a `NOMBRE_DUPLICADO`, compartido con `crearAula()` (sin cambiar su comportamiento);
  - `obtenerAulaPorId()` devuelve también `updated_at` y `version` (cambio aditivo).
- `src/server/aulas/actions.ts`: Server Action `modificarAula()`.
- `src/types/aula.types.ts`: `DetalleAula` y `ResultadoModificarAula`.
- `src/app/api/aulas/[id]/route.ts`: `PATCH`.
- `src/app/(dashboard)/aulas/[id]/page.tsx`: modo consulta y edición sobre la misma ruta, breadcrumb, botón "Modificar", banner de éxito, fila "Última modificación".

**No se tocan:** `prisma/schema.prisma`, `prisma/seed.ts`, migraciones, `src/server/aulas/aula.publico.ts`, `aula-form.tsx`, `/aulas` (listado), y **ningún archivo de `src/server/turnos/`** (`turno.publico.ts`, `turno.service.ts` ni sus tests). `emitirEventosTurno` la agrega el dueño del módulo C en su propio cambio (0.1); si se decide que la escriba quien implementa esta HU, es con OK de Tomás y en un commit separado del módulo C.

### 0.6. Dudas y resoluciones (28/09, revisadas el 29/09 contra la spec K)

- **Q-K3-1 — CAMBIÓ: eventos de turno. Resuelta por la spec, con una dependencia PENDIENTE.** Spec K §2.4 paso 6: "Después del `COMMIT`, el servicio emite los eventos que `ajustarCuposPorCapacidadDeAula()` devolvió en `eventos` (…) con `emitirEventosTurno(eventos)` (exportada por `turno.publico.ts`, `spec_modulo_C.md` §2.15). Este módulo no escribe en `eventos_turno` por su cuenta (Regla N.° 3)." Lo mismo dicen spec C §2.15 (fila `emitirEventosTurno` y paso 4) y la Regla N.° 2 opción (b) (tabla de eventos → después del COMMIT). Spec K §4: "Los eventos de los turnos afectados (…) los emite el Módulo C".
  - **Se descarta** la decisión del 28/09 (registrar los eventos dentro del `tx` desde `ajustarCuposPorCapacidadDeAula`, con un helper `registrarEventoTurno` en `turno.publico.ts`, como excepción a la Regla N.° 2). Ya no hay excepción que documentar ni que pedir en la spec C.
  - **PENDIENTE (Tomás):** `emitirEventosTurno` no existe en `develop` (0.1). Hay que agregarla en `turno.publico.ts` **sin importar `turno.service.ts`** (spec C: "`turno.publico.ts` no importa nada de los demás módulos", y `turno.service.ts` importa Materias, Profesores, Alumnos y Aulas). Opciones para él: escribir `db.eventoTurno.create` directo en `turno.publico.ts`, o mover `emitirEventoTurno` a un archivo propio del módulo (p. ej. `turno.eventos.ts`) que importen ambos. Además, decidir de dónde sale el `usuarioId` de la columna (hoy solo viene en `payloadEvento.usuario_id`) y si se alinea el nombre del tipo (`EventoTurno` en el código vs. `EventoTurnoPendiente` en la spec).
  - Consecuencia aceptada de la opción (b): si la transacción se revierte no se emite nada (los eventos nunca salen del callback); si la emisión falla **después** del COMMIT, el aula y los cupos quedan guardados sin sus eventos. Es el mismo comportamiento que el resto de las emisiones post-COMMIT de Turno (`await` sin `catch`); no se agrega manejo propio.
- **Q-K3-2 — CAMBIÓ: recálculo `COMPLETO ⇄ DISPONIBLE`. Ratificado por el PO.** Spec C §2.15 paso 3: "recalcular el estado (**ratificado por el PO el 29/09/2026 — Q4**)". Spec K §2.4 paso 4 y §3.5 lo contractualizan: los `DISPONIBLE`/`COMPLETO` futuros recalculan estado; un `PENDIENTE` no cambia de estado. Ya no es DEFAULT SM. Lo implementa `ajustarCuposPorCapacidadDeAula`; Aulas no hace nada extra.
- **Q-K3-3 — RESUELTA por la spec: `PENDIENTE` y `CANCELADO`.** Spec K §2.4 paso 4: bloquean solo los turnos futuros `DISPONIBLE` o `COMPLETO`; "Un turno futuro `PENDIENTE` con esta aula solo actualiza su cupo y sigue `PENDIENTE`". Spec C §2.15 paso 1 solo selecciona `PENDIENTE`, `DISPONIBLE` y `COMPLETO`: un `CANCELADO` **ni bloquea ni se modifica** (conserva su cupo). Spec K §3.5: modificar no crea ni elimina `reservas_turno`. El código coincide.
- **Q-K3-4 — SIGUE ABIERTA (dueño de C), no bloquea: borde de "turno futuro".** Spec K §2.4 solo dice "futuro"/"fecha futura" y delega en C. Spec C §2.15 paso 1 dice `fecha + hora_inicio ≥ ahora`; el código usa `turnoSigueVigente()`, que compara al minuto con `>` (un turno que empieza en el minuto actual cuenta como pasado: ni bloquea ni se ajusta). La propia spec C usa "posterior al momento de la consulta" (`>`) para `listarTurnosFuturosDeProfesorPorMateria`. Aulas no reimplementa el criterio (Regla N.° 3): lo que decida C vale para esta HU. La diferencia es de un minuto y no afecta ningún CP con el seed.
  - Nota de backlog vs. spec: el criterio 2 dice "turnos con fecha futura"; la spec C lo interpreta como **fecha + hora de inicio** (un turno de hoy que ya empezó es pasado). **Manda la spec.**
- **Q-K3-5 — RESUELTA por la spec (implícito): se permite editar un aula inactiva.** Spec K §2.4 paso 1 solo exige que el aula **exista** (`404 AULA_NO_ENCONTRADA`); no hay ningún error por aula inactiva, y el detalle de §2.2 muestra también las inactivas. Mismo criterio que la materia inactiva en HU-L-03. Ya no se pide confirmación al PO; si el PO quisiera bloquearlo, sería un cambio de spec (nuevo código de error).
- **Q-K3-6 — RESUELTA por la spec: error de capacidad y clave `detalle`.** Spec K §2.4, «Errores esperados»: `409 CAPACIDAD_MENOR_A_INSCRIPTOS` (con `detalle: { turnos_en_conflicto, max_inscriptos }`), mensaje literal "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula", y "toda la transacción se revierte (tampoco se guarda el nombre)". `modificarAula()` lanza, **dentro de la transacción**, `ServiceError("CAPACIDAD_MENOR_A_INSCRIPTOS", <mensaje>, { turnos_en_conflicto, max_inscriptos })`. La clase compartida `ServiceError` guarda ese objeto en su campo `detalles` (no se renombra la clase); el `PATCH` **y la Server Action** lo exponen como **`error.detalle`**, como dice la spec. Los errores `VALIDACION` siguen con `detalles` (`flatten()`), como el resto del proyecto.
  - Nota: en el código conviven `detalles` (rutas de Turnos) y `detalle` (specs K y D). Esta task sigue la spec K; unificar es tarea aparte.
- **Q-K3-7 — SIGUE ABIERTA, no bloquea: Mockup 21 no está en el repo** (tampoco en `guia-pantallas-referencia-sprint-2.md`). La pantalla sigue la spec K §2.4 («Pantalla»), la fila del mapa y el patrón de HU-L-03. Si el mockup muestra algo más (lista de turnos afectados, texto sobre el cupo), se consulta al PO.
- **Q-K3-8 — NUEVA, no bloquea: textos del diálogo de descarte.** Spec K §2.4 «Cancelar» pide título «¿Descartar los cambios?», texto «Tenés cambios sin guardar. Si salís de esta pantalla, se van a perder.» y botones «Seguir editando» / «Descartar cambios». El componente existente (`confirmar-descarte-dialog.tsx`) usa «Cambios sin guardar», «Hay datos sin guardar. ¿Salir de todas formas?», «Seguir editando» y «Salir sin guardar». La misma spec resuelve: "Si el componente ya implementado usa otro texto, **prevalece el existente** y se actualiza también L §2.4". Se usa el componente tal cual; queda para el SM actualizar el texto en spec K §2.4 y spec L §2.4.
- **`--destructive-soft` — DECISIÓN RESUELTA:** el token está en `DESIGN.md` pero todavía no en `src/app/globals.css` (verificado el 29/09). Los avisos de error usan `text-destructive`, igual que HU-L-03.

---

## 1. Nota de alcance

**Ruta: la edición es un modo de la misma ficha, `/aulas/[id]?modo=edicion`, no una ruta aparte.** Así lo definen `mapa-pantallas-sprint-2.md` §1 ("Ficha de aula (`/aulas/[id]`) — HU-K-03 — Modo edición del mismo detalle") y `spec_modulo_K.md` §2.4 («Pantalla: modo edición del mismo detalle `/aulas/[id]` … página completa, feedback por banner inline»). **No** se crea `/aulas/[id]/editar`.

**El impacto sobre turnos no es de este módulo.** Cambiar la capacidad del aula **es** cambiar el cupo de sus turnos futuros (§3.4), pero esa decisión, su escritura y sus eventos son de Turno. Aulas solo llama a `ajustarCuposPorCapacidadDeAula()` dentro de su propia transacción, traduce el resultado y, tras el COMMIT, le devuelve los eventos a Turno con `emitirEventosTurno()`.

**Diferencias backlog → spec (manda la spec):**
- Criterio 3 solo pide actualizar el cupo; la spec agrega el **recálculo de estado** `COMPLETO ⇄ DISPONIBLE` de los turnos confirmados (ratificado por el PO, Q-K3-2) y que un `PENDIENTE` también actualiza cupo sin cambiar de estado.
- Criterio 2 habla de "fecha futura"; la spec usa fecha **y hora de inicio** (Q-K3-4).
- Criterio 4 solo pide "confirmación si hay cambios"; la spec fija el comportamiento del diálogo (Q-K3-8).

**Fuera de alcance de esta task (explícito, spec K §2.4 «Fuera de alcance»):**
- Desactivar/reactivar el aula (criterio 5, HU-K-04, Sprint 3). `.strict()` rechaza `is_active`.
- Reasignar el aula de turnos confirmados ni modificar turnos pasados o cancelados.
- Listar en pantalla los turnos en conflicto (no está en el mapa ni en los criterios; ver Q-K3-7).
- Evento `aula:modificada` o tabla de auditoría del aula: la trazabilidad va por columnas (§4, Regla N.° 2 opción (a)).
- Cualquier cambio de schema, migración o seed.
- Implementar `emitirEventosTurno` (es del módulo C, Q-K3-1).

---

## 2. Historia de Usuario

**Como** Gerente
**Necesito** modificar el nombre/número y la capacidad de un aula registrada
**Para** corregir sus datos o ajustar su capacidad real sin dar de baja el aula

**Épica:** Gestionar aulas · **SP estimado:** 2

**Criterios de aceptación** (`HU-Sprint-2.md`, literal):
1. Desde el detalle del aula (HU-K-02) se abre un formulario precargado, con las mismas reglas de HU-K-01 para nombre/número y capacidad.
2. Si se reduce la capacidad por debajo de la cantidad de alumnos ya inscriptos en algún turno futuro (Disponible o Completo) que usa esa aula, se rechaza con "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula" y no se guarda.
   - La validación es contra turnos con fecha futura únicamente; los turnos pasados no bloquean el cambio.
3. Al guardar exitosamente se actualiza el aula, se informa "Aula actualizada correctamente", y los turnos futuros que ya tenían esta aula asignada actualizan su cupo máximo si la capacidad cambió (mismo criterio de HU-C-15: cupo = capacidad del aula).
4. Cancelar vuelve al detalle sin guardar, con confirmación si hay cambios.
5. Esta historia no permite desactivar el aula (HU-K-04, Sprint 3).

**Justificación de secuencia:** depende de HU-K-01/HU-K-02. El impacto sobre el cupo de turnos ya asignados (criterio 3) la hace algo más compleja que HU-L-03, por eso 2 SP en vez de 1.

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_K.md` §2.4:
- schema Zod `ModificarAulaSchema`;
- service `modificarAula()` (aula + ajuste de turnos en **una sola transacción**, eventos de turno **después** del COMMIT);
- `PATCH /api/aulas/[id]`;
- Server Action `modificarAula()`;
- `obtenerAulaPorId()` con `version` (spec K §2.2);
- modo edición de la ficha `/aulas/[id]` según el mockup 21 (subordinado a mapa y spec).

**Decisiones y restricciones de Sprint 2 que esta task deja fijas:**
- **Regla N.° 3:** ni la validación de inscriptos, ni la actualización de cupos/estados, ni el registro de eventos tocan `turnos`/`TurnoAlumno`/`eventos_turno` desde Aulas. Salen de `ajustarCuposPorCapacidadDeAula` y `emitirEventosTurno` (`turno.publico.ts`). Sin import de `turno.service.ts`.
- **Atomicidad:** `UPDATE` del aula + ajuste de turnos dentro del mismo `prisma.$transaction`. Si algo falla (conflicto de versión, capacidad insuficiente, duplicado, error inesperado), **no se guarda nada**: ni el aula, ni el nombre, ni ningún cupo, y no se emite ningún evento.
- **Bloqueo optimista con `version`:** mismo patrón que HU-L-03 y spec B §2.5 (`updateMany` con `version` en el `where`, Regla N.° 7). Si no coincide → `CONFLICTO_EDICION_CONCURRENTE`, no se guarda.
- **Recálculo de estado `COMPLETO ⇄ DISPONIBLE`:** ratificado por el PO el 29/09 (Q-K3-2), implementado en Turno.
- **Eventos de turno:** los emite `modificarAula()` **después del COMMIT** con `emitirEventosTurno(eventos)` (spec K §2.4 paso 6, Regla N.° 2 opción (b)). Sin excepción a la Regla N.° 2.
- **Feedback:** página completa → banner inline "Aula actualizada correctamente" (DESIGN.md §6.2 y tabla §6.4, fila "Alta/edición de … Aula"). Descarte con `AlertDialog` (§6.3). Colores **solo por token**.
- **Solo rol Gerente** (`aulas:editar`, ya sembrado).

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/aulas/aula.schema.ts`

```typescript
export const ModificarAulaSchema = CrearAulaSchema.partial().extend({
  version: z.number().int().nonnegative(), // control de concurrencia optimista — obligatorio
}).strict();
export type ModificarAulaInput = z.infer<typeof ModificarAulaSchema>;
```
- Literal de spec K §2.4. Mismas reglas y normalización que el alta (criterio 1): `nombre` trim + colapso de espacios, 1–30; `capacidad` entero > 0 (`z.coerce`).
- Semántica PATCH: campo ausente = no se modifica. A diferencia de materia, no hay campo opcional que se pueda "vaciar", así que `partial()` de la spec alcanza tal cual.
- `.strict()` rechaza `is_active`, `activaAula` y cualquier otro campo (criterio 5).
- En la Server Action la `version` llega como string del `FormData`: se convierte con `Number(...)` antes del `safeParse`, igual que `modificarMateria`.

### 4.2. Servicio

**Archivo:** `src/server/aulas/aula.service.ts`
**Función:** `modificarAula(id, input, usuarioId): Promise<{ id, campos_modificados, version, turnos_actualizados }>`

Pasos 1 a 6 dentro de **una única** `prisma.$transaction(async (tx) => …)`; el paso 7, fuera:
1. Leer el aula por `idAula` (activa o inactiva, Q-K3-5). Si no existe → `ServiceError("AULA_NO_ENCONTRADA", "No se encontró el aula")`.
2. Diff contra los valores actuales: `nombre` cambia si difiere de `nombreAula` (texto ya normalizado por Zod); `capacidad` si difiere de `capacidadAula`. Si nada cambia → devolver `{ id, campos_modificados: [], version: actual, turnos_actualizados: 0 }` **sin escribir** ni incrementar `version` (spec K §2.4 paso 1). Como el diff va antes del `updateMany`, un body sin cambios con `version` vieja también responde `200` (sin escritura, no hay nada que pisar).
3. Si cambia `nombre`: `nombreNormalizadaAula = normalizarTexto(nombre)` y unicidad contra **todas las demás** aulas, activas e inactivas (`NOT: { idAula: id }`) → `NOMBRE_DUPLICADO` ("Ya existe un aula registrada con ese nombre"). Cambiar solo mayúsculas del propio nombre **no** es duplicado.
4. **Concurrencia (Regla N.° 7, spec K §2.4 paso 3):**
   ```typescript
   const r = await tx.aula.updateMany({
     where: { idAula: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE",
     "El aula fue modificada por otro usuario. Recargá para ver los datos actuales.");
   ```
   Va **antes** del ajuste de turnos: si la versión está vieja no se llega a bloquear turnos.
5. **Solo si cambió `capacidad`:** `const ajuste = await ajustarCuposPorCapacidadDeAula(id, input.capacidad, usuarioId, tx)`.
   - `ajuste.ok === false` → `throw new ServiceError("CAPACIDAD_MENOR_A_INSCRIPTOS", "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula", { turnos_en_conflicto, max_inscriptos })`. El `throw` dentro del callback **revierte también el paso 4** (nombre y capacidad).
   - `ajuste.ok === true` → se guardan `ajuste.turnos_actualizados` y `ajuste.eventos` para devolverlos desde el callback.
   - Si solo cambió el nombre, **no** se llama a la función (`turnos_actualizados: 0`, `eventos: []`).
6. El callback devuelve `{ resultado: { id, campos_modificados, version: input.version + 1, turnos_actualizados }, eventos }`. Errores: `ServiceError` se relanza tal cual; `P2002` → `NOMBRE_DUPLICADO` con el helper compartido con `crearAula()`.
7. **Después del COMMIT** (el `$transaction` ya resolvió): si `eventos.length > 0`, `await emitirEventosTurno(eventos)` (spec K §2.4 paso 6). Si la transacción lanzó, este paso nunca se ejecuta. Aulas no filtra, no transforma ni vuelve a armar los eventos. **Depende de Q-K3-1** (Tomás).
8. Sin evento propio de aula (§4). Devolver `resultado`.

`obtenerAulaPorId()` suma `updated_at` (ISO) y `version` a lo que ya devuelve (aditivo; el `GET` existente no se rompe; spec K §2.2).

**Errores de servicio nuevos:** `CONFLICTO_EDICION_CONCURRENTE`, `CAPACIDAD_MENOR_A_INSCRIPTOS`. Ya existentes: `AULA_NO_ENCONTRADA`, `NOMBRE_DUPLICADO`.

### 4.3. Route Handler

`PATCH /api/aulas/[id]` en `src/app/api/aulas/[id]/route.ts`, protegido con `withPermission("aulas:editar")`, mismo esqueleto que el `PATCH` de materias. Respuestas (spec K §2.4, «Errores esperados»):
- `400 VALIDACION` (`detalles: flatten()`), incluido body con `is_active` o sin `version`;
- `403 SIN_PERMISO` (lo resuelve `withPermission`);
- `404 AULA_NO_ENCONTRADA`;
- `409 NOMBRE_DUPLICADO` / `CONFLICTO_EDICION_CONCURRENTE` / `CAPACIDAD_MENOR_A_INSCRIPTOS` (este último con `detalle: { turnos_en_conflicto, max_inscriptos }`, Q-K3-6);
- `200 { data: { id, campos_modificados, version, turnos_actualizados }, error: null }`.

### 4.4. Server Action

`modificarAula(aulaId, formData)` en `src/server/aulas/actions.ts` (nombre "a confirmar contra el código" en la spec; se usa este). No va ligada a `useActionState`, así que devuelve `{ data, error }` (Regla N.° 5), igual que `modificarMateria()`:
1. Arma el payload con `formData.has()` (ausente = no se modifica) + `version: Number(formData.get("version"))`.
2. Valida con `ModificarAulaSchema` → `VALIDACION` con `detalles` (`flatten()`).
3. `verificarPermiso("aulas:editar")`.
4. Invoca el service.
5. `revalidatePath("/aulas")` y `revalidatePath(`/aulas/${aulaId}`)`. Como el cupo de turnos puede cambiar, también `revalidatePath("/turnos")` si `turnos_actualizados > 0`.
6. `PermisoError`/`ServiceError` → `{ data: null, error: { code, message, detalle? } }`, con `detalle` = `error.detalles` del `ServiceError` (mismo nombre de clave que el `PATCH`, Q-K3-6).

### 4.5. Trazabilidad

- **Aula:** opción (a) (spec K §4). `updatedAtAula` (automático), `modificadoPorUsuarioId` y `version` en el mismo `updateMany`. Sin evento `aula:modificada`.
- **Turnos afectados:** `modificadoPorUsuarioId` lo escribe `ajustarCuposPorCapacidadDeAula` en el mismo `tx`. Los eventos (`turno:cupo_actualizado` por turno, `turno:completado` / `turno:disponible_nuevamente` si hubo transición; payloads de spec C §4) los arma esa función y los **emite el módulo C** vía `emitirEventosTurno()`, invocada por `modificarAula()` **después del COMMIT** (Regla N.° 2 opción (b)). Si la transacción se revierte, no se emite ninguno.

---

## 5. Frontend — ficha `/aulas/[id]` en modo edición (mockup 21)

**Pantalla:** Ficha de aula (`/aulas/[id]`), ver `docs/adicionales/mapa-pantallas-sprint-2.md` §1 y spec K §2.4 («Pantalla»). Página completa, no modal. Mecanismo `?modo=edicion` de `src/lib/modo-edicion.ts` (el mismo de HU-L-03).

**`page.tsx` (Server Component):**
- Recibe `searchParams`. Mantiene `verificarPermiso("aulas:leer")` (redirige a `/aulas` si falla, como hoy).
- Con `?modo=edicion`: `exigirPermiso("aulas:editar")` (redirige a `/sin-permiso`) antes de montar `<EditarAulaForm key={aula.version} aula={aula} />`.
- Breadcrumb "Aulas / <nombre>" (reemplaza el link "Volver al listado").

**Modo consulta** (HU-K-02, ampliado):
- botón "Modificar" (`rutaModoEdicion`), visible solo si `tienePermiso("aulas:editar")`;
- fila "Última modificación", visible solo si `version > 0`;
- banner "Aula actualizada correctamente" con `?actualizada=1`: `bg-success text-success-foreground`, `role="status"` (DESIGN.md §6.2). Texto literal del criterio 3, sin agregarle la cantidad de turnos.

**Modo edición (`editar-aula-form.tsx`, cliente):** formulario propio (el de alta, `aula-form.tsx`, está atado al flujo de creación con `redirect`), con los mismos labels, placeholders, textos de ayuda y reglas Zod que HU-K-01, **precargado con el nombre y la capacidad actuales** (spec K §2.4).
- **Encabezado:** título con el nombre, `Badge variant="warning"` "Editando", "Cancelar" (outline) y "Guardar cambios".
- **Tarjeta "Datos del aula":** inputs **Nombre o número** y **Capacidad** (`type="number"`, `min=1`, `step=1`), precargados. Errores debajo de cada campo con el patrón del alta (`text-destructive`, `role="alert"`, `aria-invalid`).
- Sin switch de estado (criterio 5). Sin lista de turnos.
- **"Guardar cambios":** deshabilitado mientras los valores normalizados (nombre trim + colapso de espacios; capacidad numérica) coincidan con los guardados (spec K §2.4 paso 1: "la UI mantiene 'Guardar' deshabilitado sin cambios"), y mientras se procesa ("Guardando...").
- **Guardar:** manda solo lo que cambió + `version`. Éxito → `setDirty(false)` y `router.replace(rutaTrasGuardar("/aulas/[id]"))`.
- **Errores:**
  - `VALIDACION` → por campo.
  - `NOMBRE_DUPLICADO` → bajo Nombre.
  - `CAPACIDAD_MENOR_A_INSCRIPTOS` → bajo Capacidad, con el mensaje literal del criterio 2. No se guarda nada; el formulario conserva lo tipeado. El `detalle` no se muestra (Q-K3-7).
  - `CONFLICTO_EDICION_CONCURRENTE` → mensaje general con el texto de la spec + botón "Recargar" (`router.refresh()`, el `key={version}` remonta con datos actuales).
  - `AULA_NO_ENCONTRADA` / `SIN_PERMISO` / `SESION_INVALIDA` → mensaje general.
  - Error de red → "No se pudo conectar. Intentá nuevamente".
- **Cancelar (criterio 4, spec K §2.4 «Cancelar»):**
  - Sin cambios sin guardar → vuelve al detalle `/aulas/[id]` en modo consulta, sin diálogo y sin llamar a la API.
  - Con cambios → no navega; abre `ConfirmarDescarteDialog`. «Seguir editando» cierra el diálogo y conserva lo tipeado; el botón de confirmar vuelve a modo consulta con los valores guardados, sin llamar a la API.
  - `useDirtyState` refleja los cambios, así que breadcrumb, menú, logo, logout y cierre de pestaña también piden confirmación (`DirtyStateProvider` centraliza la salida).
  - **Textos:** los del componente existente («Cambios sin guardar» / «Hay datos sin guardar. ¿Salir de todas formas?» / «Seguir editando» / «Salir sin guardar»), no los de la spec: la spec dice que prevalece el existente (Q-K3-8). No se modifica el componente.
- **Estilos:** solo tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `bg-success`, `Badge warning`). Prohibido hex y paleta default de Tailwind. Responsive con el mismo contenedor que HU-L-03.

---

## 6. Plan de implementación paso a paso

1. **Confirmar relevamiento:** `git pull` de `develop`; verificar que `turno.publico.ts` conserva la firma de 0.1 y si ya exporta `emitirEventosTurno`; que `Aula.version` existe en la base local (`npx prisma migrate status`). Esperar OK sobre las dudas abiertas de 0.6 (Q-K3-1 dependencia, Q-K3-4, Q-K3-7, Q-K3-8; ninguna bloquea salvo el paso 7 de 4.2).
2. **Rework de la rama `feature/HU-K-03`** (0.0): revertir los cambios en `src/server/turnos/turno.publico.ts`, `turno.publico.test.ts` y `turno.publico.pg.test.ts`; rebasar sobre `develop` y resolver el conflicto con `aula.publico.ts` (los públicos no vuelven a `aula.service.ts`).
3. **Pedir a Tomás `emitirEventosTurno`** en `turno.publico.ts` (Q-K3-1). Si se demora, se avanza con los pasos 4–7 y el paso 7 de 4.2 queda para el final.
4. **Schema:** `ModificarAulaSchema` + tests de schema.
5. **Types:** `DetalleAula` (con `updated_at`, `version`) y `ResultadoModificarAula`.
6. **Service:** helper de `P2002` compartido; `obtenerAulaPorId()` ampliado; `modificarAula()` según 4.2 pasos 1–6 y 8. Tests unitarios con `ajustarCuposPorCapacidadDeAula` mockeado (Nivel 1).
7. **Route Handler `PATCH`** + **Server Action** (con `detalle` en ambos).
8. **Emisión de eventos post-COMMIT** (4.2 paso 7) con `emitirEventosTurno`, más sus tests, cuando esté disponible.
9. **Frontend:** `page.tsx` (modos, breadcrumb, botón, banner, última modificación) y `editar-aula-form.tsx`.
10. **Verificación:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Re-correr el seed y ejecutar los casos de la sección 7 (Postman + SQL + UI).
11. PR acotado a esta HU, **sin archivos de `src/server/turnos/`** (el git lo maneja el responsable).

---

## 7. Testing (tres niveles)

### Nivel 1 — Unitarios (`src/server/aulas/aula.modificar.test.ts`)

`modificarAula` (con `prisma`, `ajustarCuposPorCapacidadDeAula` y `emitirEventosTurno` mockeados):
- solo nombre → actualiza `nombreAula` y `nombreNormalizadaAula`, **no** llama a `ajustarCupos…` ni a `emitirEventosTurno`, `turnos_actualizados: 0`;
- solo capacidad → llama a `ajustarCupos…(id, capacidad, usuarioId, tx)` con el **mismo** `tx`;
- sin cambios → no escribe, `campos_modificados: []`, `version` igual;
- nombre duplicado contra otra activa y contra otra inactiva, excluyendo la propia; cambio solo de mayúsculas del propio nombre → no es duplicado;
- `P2002` → `NOMBRE_DUPLICADO`;
- `version` desactualizada (`count === 0`) → `CONFLICTO_EDICION_CONCURRENTE` y **no** se llama a `ajustarCupos…`;
- `ajustarCupos…` devuelve `ok: false` → `CAPACIDAD_MENOR_A_INSCRIPTOS` con `detalles` y la transacción se revierte (el callback lanza); **no** se llama a `emitirEventosTurno`;
- `ok: true` con eventos → devuelve `turnos_actualizados` y llama a `emitirEventosTurno(eventos)` **una vez, después** de que resolvió el `$transaction` (verificar el orden de llamadas), con los eventos tal cual los devolvió `ajustarCupos…`;
- `ok: true` sin eventos (aula sin turnos futuros) → no llama a `emitirEventosTurno`;
- aula inexistente → `AULA_NO_ENCONTRADA`; aula inactiva → editable (Q-K3-5).

`ModificarAulaSchema`: misma normalización que el alta; campo ausente; capacidad 0 / negativa / decimal / no numérica → error; nombre vacío o > 30 → error; `version` obligatoria; rechaza `is_active`.

**Import:** un test (o regla de lint, si existe) que verifique que `aula.service.ts` no importa `@/server/turnos/turno.service`.

**Opcional (recomendado):** un caso en Postgres real siguiendo `turno.publico.pg.test.ts` (aula + turno futuro con inscriptos → `modificarAula` rechaza, el aula queda intacta y no hay filas nuevas en `eventos_turno`).

### Nivel 2 — Postman y Nivel 3 — BD / TablePlus: casos con datos del seed

Precondición: `npx prisma db seed` corrido **el mismo día**; sesión de Gerente salvo que se indique. `v` = `version` actual del aula (leerla con `GET /api/aulas/:id` o de la ficha). Los chequeos de `eventos_turno` requieren `emitirEventosTurno` (Q-K3-1).

| # | Caso | Datos | Acción | Resultado esperado (API/UI) | Verificación en BD |
|---|---|---|---|---|---|
| CP-01 | **Reducir por debajo de inscriptos futuros (rechazo)** | Aula 2 (20); t20 futuro con 9 | `capacidad: 8` | `409 CAPACIDAD_MENOR_A_INSCRIPTOS`, mensaje literal del criterio 2, `detalle.turnos_en_conflicto: ["seed-turno-20"]`, `detalle.max_inscriptos: 9`. UI: error bajo Capacidad | Aula 2 sigue en 20 y misma `version`; `cupoMaximoTurno` de todos sus turnos sigue en 20; ninguna fila nueva en `eventos_turno` |
| CP-01b | Rechazo también revierte el nombre | Aula 1 (10); t01 COMPLETO 10/10 | `nombre: "Aula 1 B", capacidad: 9` | `409 CAPACIDAD_MENOR_A_INSCRIPTOS` | Nombre sigue "Aula 1"; capacidad 10; `version` igual; ningún evento |
| CP-02 | **Reducir con conflicto solo en turnos pasados (se permite)** | Aula 2. **Preparación desde la app:** quitar 2 alumnos de t20 (ficha de turno, HU-C-04) → 7/20. Queda: futuros máx. 7, pasado t26 con 8 | `capacidad: 7` | `200`, `turnos_actualizados: 5`; banner "Aula actualizada correctamente" | t26 (pasado) conserva cupo 20 aunque tenga 8 > 7; t09 (CANCELADO) conserva 20; t02, t05, t14, t12 → cupo 7 DISPONIBLE; **t20 → cupo 7 y COMPLETO**; `eventos_turno` (después del COMMIT): 5 `turno:cupo_actualizado` + 1 `turno:completado` (t20) |
| CP-03 | **Aumentar capacidad: COMPLETO pasa a DISPONIBLE** | Aula 1 (10); t01 COMPLETO 10/10 | `capacidad: 12` | `200`, `turnos_actualizados: 6` | t01 → cupo 12 y **DISPONIBLE**; t06, t07, t17, t21, t24 → cupo 12, siguen DISPONIBLE; **`seed-s2-turno-historico-1..4` (pasados) conservan cupo 10**; eventos: 6 `cupo_actualizado` + 1 `turno:disponible_nuevamente` (t01). Variante: Laboratorio 15 → 20 (t04 COMPLETO → DISPONIBLE) |
| CP-04 | **Reducir a exactamente los inscriptos: pasa a COMPLETO** | Aula 10 (30); t23 18; pasado t27 12 | `capacidad: 18` | `200`, `turnos_actualizados: 4` | t23 → cupo 18 y **COMPLETO** (evento `turno:completado`); t03, t10, t16 → cupo 18 DISPONIBLE; **t27 (pasado) conserva 30**. Variante: Aula 11 35 → 15 (t22 → COMPLETO) |
| CP-05 | Aula sin turnos | Sala grupal (3) | `capacidad: 5` | `200`, `turnos_actualizados: 0` | Capacidad 5, `version` +1; ningún evento |
| CP-06 | Solo cambia el nombre | Aula 11 | `nombre: "Aula 11 B"` | `200`, `campos_modificados: ["nombre"]`, `turnos_actualizados: 0` | Turnos de Aula 11 sin cambios (`updatedAtTurno` igual); ningún evento; `modificadoPorUsuarioId` = gerente; `createdAtAula`, `creadoPorUsuarioId` y `activaAula` sin cambios |
| CP-07 | **Nombre duplicado** | Aula 11 | `nombre: "aula 2"` y luego `"AULA 12"` (inactiva) | `409 NOMBRE_DUPLICADO` en ambos; UI: error bajo Nombre | Sin cambios |
| CP-07b | Cambiar solo mayúsculas del propio nombre | Aula 11 | `nombre: "AULA 11"` | `200` (no es duplicado de sí misma) | `nombreAula` = "AULA 11", `nombreNormalizadaAula` sin cambios |
| CP-08 | **Conflicto de version** | Aula 10, dos pestañas en modo edición con la misma `v` | Pestaña 1 guarda `capacidad: 28`; pestaña 2 guarda `nombre: "Aula 10 X"` | Pestaña 2: `409 CONFLICTO_EDICION_CONCURRENTE` con "El aula fue modificada por otro usuario. Recargá para ver los datos actuales." + botón "Recargar" (remonta con 28 y la `version` nueva). Postman: mismo `version` enviado dos veces con cambios → el segundo da 409 | Solo aplicado el cambio de la pestaña 1; `version` +1 una sola vez; el nombre no cambió |
| CP-09 | **Cancelar sin cambios** | Cualquier aula en modo edición | Click "Cancelar" | Vuelve a modo consulta sin diálogo y sin request a la API | Sin cambios |
| CP-10 | **Cancelar con cambios** | Aula 2 en edición, capacidad → 25 | Click "Cancelar" → "Seguir editando" (conserva 25); luego "Cancelar" → confirmar descarte. Repetir con el breadcrumb y con el menú | Aparece `ConfirmarDescarteDialog` con los textos del componente (Q-K3-8); al confirmar vuelve a consulta sin guardar | Capacidad sigue 20, `version` igual |
| CP-11 | Sin cambios reales | Aula 2 | UI: dejar valores o cambiar solo espacios (`" Aula  2 "`). Postman: body idéntico al actual | UI: "Guardar cambios" deshabilitado. API: `200`, `campos_modificados: []` | `version` igual |
| CP-12 | Validaciones (criterio 1) | Aula 2 | `capacidad` 0, -1, 2.5, "abc"; `nombre` vacío o de 31 caracteres; sin `version`; con `is_active: false` | `400 VALIDACION` en todos; mismos mensajes que el alta | Sin cambios |
| CP-13 | Permisos (solo Gerente) | Usuario Mesa de Entrada | `PATCH /api/aulas/:id`; abrir `/aulas/:id?modo=edicion` | `403 SIN_PERMISO`; UI redirige a `/sin-permiso`; botón "Modificar" no se muestra | Sin cambios |
| CP-14 | Aula inexistente | id inventado | `PATCH` | `404 AULA_NO_ENCONTRADA` | — |
| CP-15 | Turno PENDIENTE con aula | Crear con el wizard un turno en Aula 11 hasta el paso 4 (queda PENDIENTE, cupo 35) | `capacidad: 30` | `200` | Ese turno: cupo 30, sigue **PENDIENTE** (evento `turno:cupo_actualizado`, sin transición); un PENDIENTE nunca bloquea |
| CP-16 | Aula inactiva editable (Q-K3-5) | Aula 12 (inactiva) | `nombre: "Aula 12 B"` | `200` | Nombre cambiado; `activaAula` sigue `false` |

**Consultas SQL de apoyo (Nivel 3, solo lectura):**
```sql
SELECT "nombreAula", "capacidadAula", "version", "modificadoPorUsuarioId", "updatedAtAula"
FROM aulas WHERE "nombreAula" = 'Aula 2';

SELECT t."idTurno", t."fechaTurno", t."horaInicioTurno", t."estadoTurno", t."cupoMaximoTurno",
       COUNT(ta."alumnoId") AS inscriptos
FROM turnos t LEFT JOIN turno_alumno ta ON ta."turnoId" = t."idTurno"
WHERE t."aulaId" = (SELECT "idAula" FROM aulas WHERE "nombreAula" = 'Aula 2')
GROUP BY t."idTurno" ORDER BY t."fechaTurno", t."horaInicioTurno";

SELECT "tipoEvento", "turnoId", "payloadEvento", "creadoEnEvento"
FROM eventos_turno ORDER BY "creadoEnEvento" DESC LIMIT 10;
```

**Evidencia esperada:** Postman y SQL de los CP; capturas de la ficha en: modo consulta con botón "Modificar", edición sin cambios (Guardar deshabilitado), error de duplicado, error de capacidad insuficiente, guardando, confirmación de Cancelar, conflicto de versión con "Recargar", y banner de éxito.

---

## 8. Dependencias

| Dependencia | Estado al 29/09 |
|---|---|
| HU-K-01 / HU-K-02 (alta, listado y detalle de aula) | ✅ Implementadas (Sprint 1) |
| PR 0 del Sprint 2 (columnas `version`/`updatedAtAula`/`modificadoPorUsuarioId`, permiso `aulas:editar`) | ✅ Mergeado (#107), verificado en `schema.prisma`, migración y `seed.ts` |
| `turno.publico.ts` → `ajustarCuposPorCapacidadDeAula` | ✅ Mergeado (#108), firma relevada en 0.1 |
| `turno.publico.ts` → `emitirEventosTurno` (spec C §2.15) | ⏳ **No existe en `develop`.** La agrega Tomás (Q-K3-1). Bloquea solo 4.2 paso 7 y los chequeos de `eventos_turno` |
| Refactor de públicos a `aula.publico.ts` (`293b79f`) | ✅ En `develop`; la rama necesita rebase (0.0) |
| Mecanismo de modo edición, breadcrumb, badge `warning`, `ConfirmarDescarteDialog` (HU-L-03) | ✅ Mergeado (#110) |
| Ratificación PO del recálculo `COMPLETO ⇄ DISPONIBLE` | ✅ Ratificado el 29/09 (spec C §2.15, Q4) |
| Borde `≥`/`>` de "turno futuro" | ⏳ A alinear por el dueño de C (Q-K3-4), no bloquea |
| Textos del diálogo de descarte en specs K y L | ⏳ A actualizar por el SM (Q-K3-8), no bloquea |
| Token `--destructive-soft` en `globals.css` | ⏳ Deuda de diseño, no bloquea |
| Mockup 21 accesible para comparar | ⏳ No está en el repo (Q-K3-7) |
| HU-C-04 (quitar alumno) para preparar CP-02 · wizard HU-C-18 para CP-15 | ✅ / según avance del sprint (CP-15 se puede posponer) |

---

## 9. Checklist de Definition of Done

Estado al 29/09, después del rework (cambios sin commitear sobre `develop` `beda994`, a llevar a `feature/HU-K-03`).

- [x] Relevamiento (sección 0) revisado contra spec K Revisión 2; Q-K3-2, Q-K3-3, Q-K3-5 y Q-K3-6 resueltas por la spec.
- [x] Rework (0.0): nada de `src/server/turnos/` en el diff (`turno.publico.ts` y sus dos tests idénticos a `develop`); públicos de Aula en `aula.publico.ts`, sin tocarlo.
- [x] Sin migración, sin cambios en `schema.prisma` ni `seed.ts`.
- [x] `ModificarAulaSchema` con las mismas reglas del alta, `version` obligatoria y `.strict()` (sin `is_active`).
- [x] `modificarAula()`: diff, unicidad excluyendo la propia aula (aplicativa + `P2002`), `updateMany` con `version`, ajuste de turnos **en la misma transacción**; si algo falla no se guarda nada. La transacción devuelve los eventos del ajuste.
- [x] `obtenerAulaPorId()` devuelve `version` y `updated_at` (spec K §2.2).
- [x] Ninguna lectura ni escritura de `turnos`/`turno_alumno`/`eventos_turno` desde el módulo Aulas: todo vía `turno.publico.ts` (Regla N.° 3). Sin import de `turno.service.ts` (lo verifica un test de `aula.modificar.test.ts`).
- [ ] Eventos de turno emitidos con `emitirEventosTurno(eventos)` **después del COMMIT**; ninguno si hubo rollback. **Estructura lista, llamada comentada** en `aula.service.ts` con `TODO HU-K-03: esperar emitirEventosTurno (Tomás)` (requiere Q-K3-1).
- [ ] **Coordinar con Tomás:** `emitirEventosTurno` en `turno.publico.ts` sin importar `turno.service.ts`; borde `≥`/`>` (Q-K3-4); nombre del tipo de evento.
- [x] Route Handler `PATCH` y Server Action delgados, con `detalle` en `CAPACIDAD_MENOR_A_INSCRIPTOS`.
- [x] Ficha con `?modo=edicion`, breadcrumb, "Editando", Guardar deshabilitado sin cambios, errores por campo, "Recargar" ante conflicto, banner "Aula actualizada correctamente".
- [x] Cancelar con `ConfirmarDescarteDialog` (textos del componente existente) y `DirtyStateContext` (criterio 4). Sin switch de estado (criterio 5).
- [ ] Avisar al SM de la diferencia de textos del diálogo (Q-K3-8) para actualizar spec K §2.4 y spec L §2.4.
- [x] Solo tokens de `DESIGN.md`; ningún hex ni color default de Tailwind. Sin `--destructive-soft`.
- [x] Ningún `DELETE` físico.
- [x] Nivel 1 en verde: `aula.modificar.test.ts` 27 pasan + 3 `todo` (emisión post-COMMIT, pendientes de `emitirEventosTurno`); suite completa 434 pasan, 18 omitidos (`*.pg.test.ts` sin base de prueba), 3 `todo`. `tsc --noEmit` y `eslint` limpios.
- [ ] Tests de emisión post-COMMIT (los 3 `todo`) cuando exista `emitirEventosTurno`.
- [ ] Niveles 2 y 3 (CP-01 a CP-16) con evidencia y capturas de UI: a cargo de quien pruebe a mano.
- [ ] PR con el diff acotado a esta HU (sin cambios en `src/server/turnos/`).
