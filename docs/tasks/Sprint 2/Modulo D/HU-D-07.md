# TASK: HU-D-07 — Modificar materias asociadas al profesor

**Módulo:** D (Profesor)
**Sprint:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_D.md` Revisión 2: §2.7 (contrato `PUT /api/profesores/[id]/materias`, «Lista de turnos futuros para el modal», «Guardado desde la UI», «Mensajes al guardar»; **salvo** el texto del mensaje de AC4, ver §10 D-07-1), §2.3 (validaciones de HU-D-03 reutilizadas), §2.5 (nota «Entrada al modo edición»), §2.6 (modo edición y Cancelar, ya implementados por HU-D-06), §2.8 (`profesorActivoDictaMateria` con `FOR SHARE`), §3.3 (todo o nada), §3.5, §3.6, §4 (trazabilidad por columnas). También: `docs/specs/spec_modulo_C.md` Revisión 5 §2.15 (`contarTurnosFuturosDeProfesorPorMateria`, `listarTurnosFuturosDeProfesorPorMateria`) y el párrafo «Uso por HU-D-07» de §2.7 · `spec_modulo_L.md` §2.3 (`bloquearMateriasParaAsociar`) y §2.5 (`obtenerMateriasPorIds`) · `docs/tasks/Sprint 2/HU-Sprint-2.md` HU-D-07 (criterios 1 a 5) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila "Ficha de profesor — HU-D-07"), §4 (fila "Ver turnos") · `docs/DESIGN.md` §6.2, §6.3 (excepción del `Dialog` informativo), §6.4, §6.5 (aviso corto y etiquetas de estado), §8.1 (paginación de a 10) · patrón: `docs/tasks/Sprint 1/HU-D-03.md` y `docs/tasks/Sprint 2/HU-D-06.md` (§10 D-06-2 dejó pendiente para esta HU integrar las materias al modo edición)
**Pantalla de referencia:** ficha de profesor en modo edición (`/profesores/[id]?modo=edicion`) con la sección de materias embebida, y el modal informativo "Ver turnos". No se crea ninguna pantalla ni ruta de página nueva.
**RBAC:** sin cambios. `profesores:editar` (guardar) y `profesores:leer` (lista del modal), **exclusivos de `MESA_ENTRADA`** (`prisma/seed.ts`, `PERMISOS` y `ACCIONES_SOLO_MESA_ENTRADA`). El Detalle de turno usa `turnos:leer` y la cancelación `turnos:cancelar`, que Mesa de Entrada ya tiene.
**Schema:** **sin migración.** `ProfesorMateria` ya tiene `createdAtProfesorMateria` y `creadoPorUsuarioId` (HU-D-03, migración `profesor_materia_auditoria`); `Profesor` ya tiene `modificadoPorUsuarioId`, `updatedAtProfesor` y `version`. **No se modifica `prisma/schema.prisma`.** `prisma/seed.ts` recibió solo **agregados** (01/10, ver §11.3 y D-07-9).
**Estado:** ✅ **Implementada el 01/10/2026** (ver §11: decisiones tomadas, archivos, verificación y pendientes). Las secciones §0 a §10 conservan el relevamiento y el plan originales; donde la implementación se apartó o decidió algo, lo dice §11.
**SP:** ver §10 D-07-10 (el pedido de la task dice 5; `HU-Sprint-2.md` dice 2).

---

## 0. Relevamiento previo a implementación

> **Actualización 01/10 (implementación):** la HU se implementó según esta task; ver §11. Los bloqueantes D-07-1 (se usó el literal del AC, pendiente de confirmación del PO) y D-07-9 (datos agregados al seed) quedaron resueltos para poder avanzar.

Relevado el 01/10/2026 sobre `feature/HU-D-07` (árbol limpio, base `1fa04d0`), leyendo `schema.prisma`, `RULES.md`, `DESIGN.md`, `seed.ts`, `spec_modulo_D.md`, `spec_modulo_C.md` §2.7/§2.15 y el código de HU-D-03, HU-D-04, HU-D-05, HU-D-06, HU-C-01/C-02 (listado), HU-C-04 (validación profesor–materia) y HU-C-05 (cancelación). **Esta task solo documenta; no se implementó nada.** Antes de escribir código, quien implemente confirma que nada de esto cambió, lee las guías de `node_modules/next/dist/docs/` que correspondan (Server Actions, Route Handlers con `params` async, `revalidatePath`), como exige `AGENTS.md`, y resuelve con el SM/PO los puntos de §10 marcados como bloqueantes.

### 0.1. Qué existe hoy y se reutiliza

**Módulo D (HU-D-03, asociación inicial):**

| Archivo | Qué tiene hoy | Uso en esta HU |
|---|---|---|
| `src/server/profesores/profesor.service.ts` | `asociarMateriasAProfesor(profesorId, materiaIds, usuarioId)`: `$transaction` con `updateMany` condicionado a `activoProfesor: true` (paso 1), chequeo de duplicados → `MATERIA_YA_ASOCIADA`, `bloquearMateriasParaAsociar()` → `MATERIA_NO_ENCONTRADA` / `MATERIA_INACTIVA` (con `detalles.materias`), `createMany` sin `skipDuplicates`, catch `P2002`. `obtenerMateriasDelProfesor(profesorId)` (todas las asociadas, con `activa`). `obtenerDetalleProfesor(id)` (con `materias` y `version`) | **Patrón** del nuevo `actualizarMateriasDeProfesor()` (mismos pasos 1 y 3, mismos códigos). `asociarMateriasAProfesor()` **no se modifica** (la sigue usando el wizard de alta) |
| `src/server/profesores/profesor.schema.ts` | `AsociarMateriasProfesorSchema` (`materiaIds: z.array(z.cuid(...)).min(1)`), `ProfesorIdSchema = z.cuid()` | Se agregan `ActualizarMateriasProfesorSchema` y `ListarTurnosFuturosQuerySchema`; se reutiliza `ProfesorIdSchema` (también para `materiaId`) |
| `src/server/profesores/actions.ts` | `asociarMateriasProfesor(profesorId, formData)` (estado propio `EstadoAsociarMaterias`), `registrarHorarioProfesor()`, `modificarProfesor()` (`{ data, error }`), `MENSAJES_POR_CODIGO` con `PROFESOR_INACTIVO` / `PROFESOR_NO_ENCONTRADO` / `MATERIA_NO_ENCONTRADA` / `MATERIA_YA_ASOCIADA` | Se agrega `actualizarMateriasProfesor()` acá, con el shape `{ data, error }` de `modificarProfesor()` |
| `src/app/api/profesores/[id]/materias/route.ts` | `POST` (HU-D-03) con `withPermission("profesores:editar")`, `MENSAJES`, `mensajeMateriasInactivas()` | Se agrega `PUT` en el mismo archivo; el `POST` no cambia |
| `src/types/profesor.types.ts` | `MateriaDeProfesor { id, nombre, codigo, activa }`, `EstadoAsociarMaterias`, `DetalleProfesor` (con `version` y `materias`), `ResultadoModificarProfesor` | Se agregan `ResultadoActualizarMaterias`, `TurnoFuturoDeMateria`, `PaginaTurnosFuturos` |
| `src/app/(dashboard)/profesores/[id]/materias/page.tsx` + `asociar-materias-form.tsx` | Pantalla de asociación (HU-D-03) y paso 2 del wizard de alta (`?alta=1`). Las asociadas van **marcadas y `disabled`** (no se pueden quitar). Mensajes: `MENSAJE_EXITO = "Materias del profesor actualizadas"` (fuera del wizard) y `MENSAJE_EXITO_ALTA = "Materias asignadas correctamente"` (wizard) | **No se modifica** (ver §1, "Selector"). Es la referencia visual y de textos del selector |
| `src/lib/filtrar-materias.ts` | `filtrarMaterias(opciones, filtro)` con `normalizarTexto()` sobre nombre y código | Se reutiliza tal cual en el selector nuevo |
| `src/app/(dashboard)/profesores/[id]/ficha-materias.tsx` | Sección "Materias" de la ficha en modo consulta, link "Asociar materias" → `/profesores/[id]/materias` (solo con `puedeEditar` y profesor activo) | Cambia el destino del link (§10 D-07-6) |

**Módulo D (HU-D-06, modo edición):**

| Archivo | Qué tiene hoy | Uso en esta HU |
|---|---|---|
| `src/app/(dashboard)/profesores/[id]/page.tsx` | Modo consulta y modo edición (`?modo=edicion`, `esModoEdicion`), banner "Profesor actualizado correctamente" con `?actualizada=1` (`fueActualizada`), `EditarProfesorForm key={profesor.version}` | En modo edición carga además las materias activas (`listarMateriasActivas()`) para el selector; banner nuevo para "solo materias" (§5) |
| `src/app/(dashboard)/profesores/[id]/editar-profesor-form.tsx` | Formulario de identidad + contacto; diff, `useDirtyState`, `ConfirmarDescarteDialog`, `modificarProfesor()` → `router.replace(rutaTrasGuardar)`, "Recargar" ante conflicto | Suma la sección de materias y la secuencia de guardado 2.7 → 2.6 (§5) |
| `src/lib/modo-edicion.ts` | `esModoEdicion`, `fueActualizada`, `rutaModoEdicion`, `rutaTrasGuardar` (`?actualizada=1`) | Se usa igual; **no se modifica** (compartido con HU-L-03) |
| `src/components/shared/confirmar-descarte-dialog.tsx`, `src/components/sesion/dirty-state-context.tsx`, `src/components/shared/breadcrumb.tsx` | Descarte, dirty state, breadcrumb | Sin cambios |

**HU-D-04 (horarios):** `HorarioProfesor` (`idHorario`, `profesorId`, `diaSemanaHorario`, `horaDesdeHorario`, `horaHastaHorario`, `createdAtHorario`, `creadoPorUsuarioId`) **no tiene `materiaId`**. `registrarHorarioProfesor()` y `obtenerHorariosDelProfesor()` no se tocan. Criterio 5 se cumple por construcción (§2.1).

**Módulo C (Turnos), consumido solo por su capa pública (Regla N.° 3):**

| Archivo | Qué tiene hoy | Uso en esta HU |
|---|---|---|
| `src/server/turnos/turno.publico.ts` | `contarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, db?)` → `{ confirmados, pendientes }` (**ya existe**, con test unitario y `.pg.test`): `DISPONIBLE`/`COMPLETO` = `confirmados`, `PENDIENTE` = `pendientes`, `("fechaTurno" + "horaInicioTurno") > date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')` | Paso 4 del servicio (bloqueo de la baja) |
| `src/server/turnos/turno.publico.ts` | `listarTurnosFuturosDeProfesorPorMateria()` **no existe** (está contractualizada en spec C §2.15 pero no implementada) | **Se agrega** (§4.2). Archivo del módulo C: requiere OK del responsable de Turnos (§9) |
| `src/server/turnos/turno.service.ts` | `listarTurnos(pagina, porPagina, usuario, filtros)` (HU-C-01/C-02/C-08) y `presentar()`, que arma `alumnos_inscriptos` como `"${inscriptos}/${cupoMaximoTurno}"` | **No se usa ni se modifica** (ver §1, "De dónde sale la lista"). Se copia el formato de `alumnos_inscriptos` |
| `src/server/turnos/turno.schema.ts` | `ListarTurnosQuerySchema` `.strict()` **sin** `materia_id`, `estados` ni `solo_futuros` | Motivo por el que el listado de HU-C-01 no sirve para el modal |
| `src/server/turnos/turno.service.ts` (HU-C-04 / C-03) | `profesorActivoDictaMateria(input.profesor_id, input.materia_id, db)` al configurar/confirmar un turno → `PROFESOR_NO_DICTA_MATERIA` | Contraparte de concurrencia del paso 4 (§4.3, "Orden a → b") |
| `src/server/profesores/profesor.publico.ts` | `profesorActivoDictaMateria(profesorId, materiaId, db?)`: con `db` lee `profesor_materia` con `FOR SHARE OF pm` | Sin cambios; es lo que serializa la baja contra la creación de turnos |
| `src/server/turnos/turno.cancelacion.service.ts` + `src/app/api/turnos/[id]/cancelacion/route.ts` + `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.tsx` | HU-C-05: `cancelarTurno(id, usuarioId)` (DISPONIBLE/COMPLETO vigente → `CANCELADO`), `POST /api/turnos/[id]/cancelacion` (`turnos:cancelar`), `AlertDialog` "¿Confirmás cancelar este turno?" + toast "Turno cancelado correctamente" | Sin cambios. Es la herramienta con la que Mesa resuelve los turnos que bloquean, desde el Detalle de turno abierto en otra pestaña |
| `src/app/(dashboard)/turnos/[id]/page.tsx` | Detalle de turno (`/turnos/[id]`, HU-C-09), `?volver=` opcional (por defecto `/turnos`) | Destino de cada fila del modal, en pestaña nueva |
| `src/app/(dashboard)/turnos/estado-turno-badge.tsx` | `EstadoTurnoBadge` (tokens de DESIGN §6.5) + `ETIQUETA_ESTADO_TURNO` en `src/types/turno.types.ts` | Se reutiliza en el modal (§10 D-07-8) |

**Comunes:** `Dialog` (`src/components/ui/dialog.tsx`, Base UI, se cierra con X/Escape/click afuera), `Pagination` (`src/components/shared/pagination.tsx`, con `onPageChange` para paginar en el cliente, `porPagina`, `mostrarRango`, `mostrarNumeros`), `fetchAutenticado` (`src/lib/fetch-autenticado.ts`), `ServiceError` (con `detalles`), `withPermission` / `verificarPermiso` / `exigirPermiso` / `tienePermiso`, `obtenerMateriasPorIds()` (`src/server/materias/materia.publico.ts`), `bloquearMateriasParaAsociar()` y `listarMateriasActivas()` (`src/server/materias/materia.service.ts`).

### 0.2. Modelo relevado (`prisma/schema.prisma`)

- **`EstadoTurno`**: `PENDIENTE`, `DISPONIBLE`, `COMPLETO`, `CANCELADO` (etiquetas: "Pendiente", "Disponible", "Completo", "Cancelado").
- **`Turno`**: `idTurno`, `fechaTurno @db.Date`, `horaInicioTurno @db.Time`, `duracionMinutosTurno` (la hora de fin se deriva), `cupoMaximoTurno Int?` (capacidad del aula; `NULL` sin aula), `estadoTurno` (default `PENDIENTE`), `prioridadTurno`, `materiaId` (obligatorio), `profesorId String?`, `aulaId String?`, auditoría (`creadoPorUsuarioId`, `modificadoPorUsuarioId`, `createdAtTurno`, `updatedAtTurno`). Relaciones `materia`, `profesor`, `aula`, `alumnos TurnoAlumno[]`. Inscriptos = filas de `TurnoAlumno (turnoId, alumnoId)`.
- **`Profesor`**: `idProfesor`, `activoProfesor`, identidad, contacto, `creadoPorUsuarioId`, `modificadoPorUsuarioId`, `createdAtProfesor`, `updatedAtProfesor @updatedAt`, `version Int @default(0)`; relaciones `materias ProfesorMateria[]`, `horarios HorarioProfesor[]`, `turnos Turno[]`.
- **`Materia`**: `idMateria`, `nombreMateria @unique`, `nombreNormalizadaMateria @unique`, `codigoMateria String? @unique`, `activaMateria`, auditoría, `version`.
- **`ProfesorMateria`** (`profesor_materia`): `profesorId`, `materiaId`, `createdAtProfesorMateria`, `creadoPorUsuarioId String?`; **PK compuesta `@@id([profesorId, materiaId])`**; FKs `onDelete: Cascade`. No tiene `activo`/`deletedAt`: la baja del vínculo es un `DELETE` (§1, Regla N.° 1).
- **`HorarioProfesor`**: sin `materiaId` (ver 0.1).

### 0.3. Hallazgos que condicionan la implementación

1. **El mensaje de AC4 contradice a la spec.** El AC dice "Materias del profesor actualizadas", "mismo mensaje que el de la asociación inicial". La spec §2.7 «Mensajes al guardar» y la nota «Mensaje de HU-D-07 AC4 (decisión del PO, 29/09)» dicen «Materias asignadas correctamente». En el código, la asociación inicial **tiene los dos**: "Materias del profesor actualizadas" en `/profesores/[id]/materias` fuera del wizard y "Materias asignadas correctamente" en el wizard (`asociar-materias-form.tsx`). La task usa el literal del AC (mismo criterio que HU-D-06: mandan los AC). **Bloqueante liviano**: confirmar con el PO (§10 D-07-1).
2. **El listado de HU-C-01 no puede dar la lista del modal.** El AC dice que "sale del listado de turnos existente (HU-C-01), filtrado por profesor, materia y fecha futura", pero `ListarTurnosQuerySchema` es `.strict()` y no tiene `materia_id`, `estados` ni `solo_futuros` (HU-C-02 AC6 los excluye del listado). La spec C §2.7 («Uso por HU-D-07») y la spec D §2.7 resuelven con la ruta propia `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros` sobre `listarTurnosFuturosDeProfesorPorMateria()` (C §2.15). Se sigue la spec: **misma presentación** que el listado (columnas, `"3/5"`, `EstadoTurnoBadge`, link al Detalle) pero consulta propia. No es una pantalla nueva ni una HU nueva, como pide el AC (§10 D-07-2).
3. **`listarTurnosFuturosDeProfesorPorMateria()` no existe todavía** en `turno.publico.ts`. Hay que agregarla (aditiva) en el módulo C. Su contrato está cerrado en C §2.15; **relevar antes de asumir** el formato exacto de `hora_inicio`/`hora_fin` (el helper `horaDeMinutos` del mismo archivo da `"HH:mm"`).
4. **`version` no debe incrementarse en 2.7.** La UI guarda primero 2.7 y después 2.6 con la `version` precargada. Si `actualizarMateriasDeProfesor()` subiera `version`, el `PATCH` de 2.6 inmediatamente posterior daría `CONFLICTO_EDICION_CONCURRENTE` contra sí mismo. La spec §2.7 paso 1 solo registra `modificadoPorUsuarioId` (igual que HU-D-03, HU-D-06 §0.3 punto 1). Se mantiene así.
5. **El selector de HU-D-03 no sirve tal cual.** `AsociarMateriasForm` muestra las asociadas `disabled` (no se pueden destildar) y solo envía las nuevas. Esta HU necesita destildar asociadas y enviar el conjunto final. Se arma un selector nuevo con el **mismo aspecto, textos y filtro** (`filtrarMaterias()`), sin modificar el de HU-D-03, que sigue sirviendo al wizard de alta (§1).
6. **`--destructive-soft` ya está en `src/app/globals.css`** (líneas 30-31 y 79-80, verificado el 01/10). HU-D-06 §0.3 punto 4 lo daba como faltante; ya no lo es. El aviso corto usa `bg-destructive-soft text-destructive-soft-foreground` (DESIGN §6.5).
7. **Turnos `PENDIENTE` con profesor:** `contarTurnosFuturosDeProfesorPorMateria()` cuenta `pendientes` por `profesorId`, pero en el seed todo `PENDIENTE` tiene `profesorId = NULL`, así que `pendientes_afectados` siempre da 0 con los datos actuales. **Relevar antes de asumir** si el wizard de Revisión 5 deja turnos `PENDIENTE` con profesor asignado (si no, el aviso de pendientes es código muerto; §10 D-07-5).
8. **Grafo de imports:** `profesor.service.ts` pasa a importar `@/server/turnos/turno.publico`, y `turno.service.ts` ya importa `@/server/profesores/profesor.publico` (que reexporta de `profesor.service.ts`). `turno.publico.ts` solo importa `./turno.validaciones` → `./turno.schema`, así que no debería haber ciclo. **Relevar antes de asumir** que `turno.schema.ts` no importa nada de profesores, y que `src/server/publico.aislamiento.test.ts` sigue en verde con la función nueva.

### 0.4. Datos del seed útiles para probar (`prisma/seed.ts`)

Usuario: **mesa.entrada@noctium.local** / **Password123!**. Las fechas de los turnos son **relativas al día en que se corre el seed** (día operativo 0 = próximo día hábil después de hoy), así que todo turno con `diaOperativo ≥ 0` es futuro y todo `diaOperativo < 0` es pasado. Cupo = capacidad del aula.

| Profesor (DNI) | Materia | Turnos que **bloquean** (futuros DISPONIBLE/COMPLETO) | No bloquean | Útil para |
|---|---|---|---|---|
| **Giménez, Laura** (27100001) | Matemática | **3**: `seed-turno-01` (día 0, 08:00, Aula 1, 10/10 Completo), `seed-turno-10` (día 3, 10:00, Aula 10, 12/30 Disponible, Urgente), `seed-turno-17` (día 5, 08:00, Aula 1, 0/10 Disponible) | `seed-turno-26` (pasado, con clase dictada) y 4 históricos `seed-s2-turno-historico-1..4` (pasados) | Rechazo con N = 3; pasados que no suman |
| Giménez | Física | **4**: `seed-turno-05` (día 1, 10:00, Aula 2, 0/20), `seed-turno-07` (día 2, 08:00, Aula 1, 5/10), `seed-turno-14` (día 4, 08:00, Aula 2, 6/20), `seed-turno-23` (día 7, 10:00, Aula 10, 18/30) | — | Dos materias bloqueadas en el mismo guardado (3 y 4) |
| **Castro, Julián** (32200011) — 4 materias, 8 horarios | Matemática | 0 | `seed-turno-09` (día 2, 15:00, **CANCELADO**) | **Cancelado no bloquea**: se puede quitar |
| Castro | Física | **1**: `seed-turno-19` (día 5, 15:00, Laboratorio, 8/15) | — | Rechazo con N = 1; error parcial (agregar + quitar otra + quitar Física) |
| Castro | Química, Programación I | 0 | — | Quitar sin turnos; horarios intactos (8 filas) |
| **Acuña, Sergio** (30100004) | Programación I | **1**: `seed-turno-13` (día 3, 16:00, Laboratorio, 6/15) | `seed-turno-27` (pasado) | **Flujo completo**: rechazo → "Ver turnos" → cancelar `seed-turno-13` en otra pestaña → reintentar → se quita (el pasado no bloquea) |
| **Rossi, Martín** (28100002) | Bases de Datos | **4**: `seed-turno-06`, `-08`, `-24`, `-12` | — | Otro caso de N |
| **Quiroga, Emilia** (32200014) | — (sin materias) | — | — | Agregar varias desde cero |
| **Pérez, Juan** (33300001) | Bases de Datos | 0 | — | Quitar la única → conjunto vacío válido |
| **Molina, Héctor** (31100005) | Física | — | — | Profesor **inactivo** → `PROFESOR_INACTIVO` |
| — | Historia de la Ciencia | — | — | Materia **inactiva**: agregarla por API → `MATERIA_INACTIVA` |

**Datos que el seed NO tiene y hacen falta (§10 D-07-9):**
- **Paginación del modal (> 10 turnos):** ningún par profesor–materia tiene más de 4 turnos futuros que bloqueen. Agregar **al menos 8** turnos `DISPONIBLE` de **Giménez + Matemática** (para llegar a 11+), p. ej. a las 08:00 en Aula 1 en días operativos 8 a 15, sin inscriptos o con pocos. Quedan dentro de `anticipacion_maxima_dias = 30` y del horario de Giménez (08-12 todos los días), y no chocan con otros turnos de Aula 1 a esa hora (verificarlo con `SEED_SOLO_VALIDAR=1 npx tsx prisma/seed.ts`).
- **Materia inactiva ya asociada a un profesor activo** (AC1: se muestra tildada con "Inactiva"): ningún profesor activo tiene "Historia de la Ciencia". Agregarla a las materias de un profesor activo sin turnos de ella (p. ej. Quiroga o Ibarra). Ojo: `validarDatos()` exige que toda materia **activa** tenga un profesor activo, no restringe asociar una inactiva.
- **Turno `PENDIENTE` con profesor** (aviso `pendientes_afectados`): no existe; ver 0.3 punto 7.

Alternativa sin tocar el seed: preparar estos datos a mano con SQL en la base local para la prueba y limpiarlos después (dejarlo registrado en la evidencia).

---

## 1. Nota de alcance

**Dónde se edita:** dentro del **modo edición de la ficha** (`/profesores/[id]?modo=edicion`), como sección "Materias" junto a "Datos personales" y "Datos de contacto", con **un solo** "Guardar cambios". Así lo definen la spec D §2.5 (nota «Entrada al modo edición»), §2.7 «Pantalla» y el mapa de pantallas §1 (revisión 28/09). HU-D-06 lo dejó explícitamente pendiente para esta HU (HU-D-06 §10 D-06-2). No se crea `/profesores/[id]/materias/editar` ni un modal picker.

**Selector (AC1):** mismo selector de HU-D-03 en aspecto y comportamiento (input "Filtrar por nombre o código" con `filtrarMaterias()`, lista de casillas "Nombre (CÓDIGO)", contador), con estas diferencias que pide esta HU:
- las asociadas aparecen **tildadas y habilitadas** (se pueden destildar para quitarlas);
- se envía el **conjunto final** deseado (spec §2.7), no solo las nuevas;
- las asociadas que hoy están **inactivas** aparecen tildadas con la etiqueta "Inactiva" y solo se quitan si Mesa las destilda a propósito (spec §2.7 «Materias asociadas que están inactivas»); las inactivas no asociadas no se ofrecen.

Se implementa como componente nuevo (`materias-profesor-selector.tsx`); `AsociarMateriasForm` y `/profesores/[id]/materias` **no se modifican** y siguen sirviendo al paso 2 del wizard de alta (`?alta=1`).

**De dónde sale la lista del modal (AC3):** ruta propia del módulo D, `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n`, que llama a `listarTurnosFuturosDeProfesorPorMateria()` del módulo C (spec D §2.7, spec C §2.7 y §2.15). No se usa `GET /api/turnos` (ver 0.3 punto 2 y §10 D-07-2).

**Manejo de error parcial — definido por la spec, no es una decisión abierta:**
- **Dentro de 2.7 (agregar unas y quitar otras en la misma operación):** **todo o nada**. Spec D §2.7 («en una única `prisma.$transaction`, todo o nada (3.3)», paso 4: «toda la transacción se revierte, la materia sigue asociada y no se quita ninguna») y §3.3; consistente con la Regla N.° 7 de `RULES.md` (condición y mutación en la misma transacción). Si una sola materia de `quitar` tiene turnos futuros, o una sola de `agregar` está inactiva, **no se guarda nada** de materias: ni las altas válidas ni las otras bajas. La UI vuelve a tildar la casilla bloqueada, muestra el aviso debajo de ella y **conserva sin guardar** el resto de los cambios del formulario para reintentar (spec §2.7 paso 4, «Presentación del rechazo»). Todos los bloqueos se informan juntos (el servicio recorre todas las de `quitar` antes de lanzar), no de a uno.
- **Entre 2.7 y 2.6 (materias + datos personales en el mismo "Guardar cambios"):** son dos endpoints sin transacción común. Spec §2.7 «Guardado desde la UI» y «Mensajes al guardar»: primero 2.7; si falla, 2.6 **no se llama**; si 2.7 sale bien y 2.6 falla, las materias **quedan guardadas** y el banner lo dice ("Las materias se guardaron, pero los datos no: <error>"); el formulario conserva lo escrito y el reintento llama solo a 2.6. `RULES.md` no define nada más fino para este caso; se sigue la spec.

**Trazabilidad (Regla N.° 2, opción (a)):** cada alta de `ProfesorMateria` lleva `createdAtProfesorMateria` + `creadoPorUsuarioId`; toda operación con cambios registra `Profesor.modificadoPorUsuarioId` (+ `updatedAtProfesor` por `@updatedAt`). Sin evento ni tabla `EventoProfesor` (spec §4).

**Regla N.° 1 — excepción documentada:** la baja del vínculo `ProfesorMateria` es un `DELETE` físico sobre una tabla de asociación, excepción ya documentada en la spec D §2.7 paso 6 (igual que la baja de `TurnoAlumno`, spec C §3.13). Esta task la hereda; ninguna otra entidad se borra. La baja queda reflejada en `Profesor.modificadoPorUsuarioId`/`updatedAtProfesor`; **no** queda registro de qué materia se quitó ni de quién lo hizo materia por materia (§10 D-07-7).

**Feedback (DESIGN §6.4):** la edición es de página completa → **banner inline**. El modal "Ver turnos" es la excepción de `Dialog` informativo de DESIGN §6.3: botón único "Entendido" + X, se abre solo desde el link, **no dispara toast**. Colores solo por token.

**Fuera de alcance de esta task (explícito):**
- Reasignar profesor a un turno o dejarlo "esperando profesor" (el backlog del 28/09 lo descartó; HU-C-06 criterio 5).
- Cancelar turnos desde la ficha: se cancelan en el Detalle de turno (HU-C-05), sin cambios.
- Modificar `asociarMateriasAProfesor()`, `AsociarMateriasForm`, `/profesores/[id]/materias` o el wizard de alta (HU-D-03).
- Modificar `listarTurnos()`, `ListarTurnosQuerySchema` o el listado `/turnos` (HU-C-01/C-02/C-08).
- Modificar horarios de atención (HU-D-04) o desactivar al profesor (HU-D-08, Sprint 3).
- Cualquier cambio de `schema.prisma`, migraciones o permisos.
- Concurrencia optimista (`version`) para 2.7 (§10 D-07-4).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** agregar o quitar materias asociadas a un profesor
**Para** mantener actualizado qué materias puede dictar

**Funcionalidad:** Gestionar profesores · **SP estimado:** 5 (según el pedido de esta task; `HU-Sprint-2.md` dice 2 SP, discrepancia en §10 D-07-10)

**Criterios de aceptación** (`HU-Sprint-2.md`):
1. Desde la ficha del profesor se muestran las materias ya asociadas (marcadas) y las materias activas disponibles para agregar, mismo selector de HU-D-03.
2. Se puede agregar una o varias materias nuevas en la misma operación, con las mismas validaciones de HU-D-03 (no duplicar, solo materias activas).
3. Se puede quitar una materia ya asociada, siempre que el profesor no tenga ningún turno futuro (Disponible o Completo) de esa materia. Los turnos pasados o cancelados no bloquean la desasociación.
   - Si los tiene, la operación se rechaza y la materia sigue asociada (la casilla queda tildada). Debajo de esa materia se muestra un aviso corto: "No se puede quitar: el profesor tiene N turnos futuros de esta materia", con el link "Ver turnos".
   - "Ver turnos" abre un modal con el mensaje "El profesor tiene N turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar." y la lista de esos turnos con fecha, hora, aula, cupo ocupado (por ejemplo, 3/5) y estado, paginada de a 10.
   - Esa lista sale del listado de turnos existente (HU-C-01), filtrado por ese profesor, esa materia y fecha futura. No es una pantalla ni una historia nueva.
   - Cada turno de la lista enlaza a su Detalle de turno, que se abre en una pestaña nueva para no perder los cambios de la ficha, y donde Mesa de Entrada puede cancelarlo (HU-C-05). Una vez resueltos todos, reintenta quitar la materia.
4. Al guardar se muestra "Materias del profesor actualizadas", mismo mensaje que el de la asociación inicial.
5. Los horarios de atención del profesor (HU-D-04) no están asociados a ninguna materia en particular — son un patrón semanal general e independiente de qué dicte (`HorarioProfesor` no tiene materia). Por eso, quitar una materia asociada no afecta ni modifica ningún horario: quedan intactos.

**Dependencias:** HU-D-03 (selector y validaciones) y los turnos ya existentes (HU-C-04, relación Turno–Profesor–Materia) para la validación del criterio 3. Algo más compleja que HU-D-06 por esa validación cruzada con Turno.

### 2.1. Criterios de aceptación y cómo se cumple cada uno

| # | Cómo se cumple | Archivos |
|---|---|---|
| 1 | En modo edición, la página carga `profesor.materias` (de `obtenerDetalleProfesor()`, con `activa`) y `listarMateriasActivas()`; el selector muestra la unión (activas + asociadas inactivas), con las asociadas tildadas. Mismo filtro, etiquetas y estilos que HU-D-03 | `[id]/page.tsx`, `[id]/materias-profesor-selector.tsx` |
| 2 | `agregar = deseado − actual`; `bloquearMateriasParaAsociar(agregar, tx)` → `404 MATERIA_NO_ENCONTRADA` / `409 MATERIA_INACTIVA` (mismos códigos y textos que HU-D-03); duplicados imposibles por construcción (conjunto + `refine` "No repitas materias") y defensa `P2002` sobre la PK compuesta | `profesor.schema.ts`, `profesor.service.ts` |
| 3 | `quitar = actual − deseado`; por cada una, `DELETE` + `contarTurnosFuturosDeProfesorPorMateria(…, tx)`; si alguna tiene `confirmados > 0` → `409 MATERIA_CON_TURNOS_FUTUROS` con `detalle` y rollback total. UI: casilla re-tildada, aviso corto con N, link "Ver turnos" → `Dialog` con la lista de `GET …/turnos-futuros` (10 por página), cada fila con `target="_blank"` al Detalle | `profesor.service.ts`, `turno.publico.ts`, `…/turnos-futuros/route.ts`, `materias-profesor-selector.tsx`, `ver-turnos-futuros-dialog.tsx` |
| 4 | Guardado solo de materias → banner "Materias del profesor actualizadas" (literal del AC, §10 D-07-1); con datos personales también → "Profesor actualizado correctamente" (spec §2.7 «Mensajes al guardar») | `editar-profesor-form.tsx`, `[id]/page.tsx` |
| 5 | El servicio no lee ni escribe `HorarioProfesor`; `.strict()` rechaza cualquier campo ajeno. Verificación en BD (CP-D07-14) | `profesor.service.ts` |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_D.md` §2.7 y `spec_modulo_C.md` §2.15:
- función pública `listarTurnosFuturosDeProfesorPorMateria()` en el módulo C (§4.2, aditiva);
- schemas Zod `ActualizarMateriasProfesorSchema` y `ListarTurnosFuturosQuerySchema` (§4.1);
- servicios `actualizarMateriasDeProfesor()` y `listarTurnosFuturosDeMateria()` (§4.3);
- `PUT /api/profesores/[id]/materias` y `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros` (§4.4);
- Server Action `actualizarMateriasProfesor()` y tipos (§4.5);
- sección de materias en el modo edición de la ficha, secuencia de guardado 2.7 → 2.6, aviso corto y modal "Ver turnos" (§5);
- datos de prueba adicionales en el seed **solo si** el SM lo aprueba (§10 D-07-9).

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/profesores/profesor.schema.ts` (se agrega; no se modifica lo existente)

```typescript
/**
 * Conjunto FINAL de materias del profesor (HU-D-07, spec_modulo_D.md §2.7):
 * el servidor calcula agregar/quitar. Puede quedar vacío (profesor sin
 * materias es válido). snake_case, como los contratos nuevos de Sprint 2.
 */
export const ActualizarMateriasProfesorSchema = z
  .object({
    materia_ids: z
      .array(z.cuid("Materia inválida")) // Zod 4: z.cuid(), no z.string().cuid() (nota de HU-D-03)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, "No repitas materias"),
  })
  .strict();
export type ActualizarMateriasProfesorInput = z.infer<typeof ActualizarMateriasProfesorSchema>;

/** Query del modal «Ver turnos» (spec §2.7). por_pagina NO es parámetro: es fijo, 10. */
export const ListarTurnosFuturosQuerySchema = z
  .object({ pagina: z.coerce.number().int().positive().default(1) })
  .strict();

export const TURNOS_FUTUROS_POR_PAGINA = 10; // DESIGN.md §8.1
```

- El archivo lo importan Client Components: sin imports de valor de `@prisma/client` (misma restricción que HU-D-03 §4.1).
- `materiaId` de la ruta se valida con `ProfesorIdSchema` (es `z.cuid()`), o con un alias `MateriaIdSchema = z.cuid()` si se prefiere legibilidad.

### 4.2. Servicio público del módulo C

**Archivo:** `src/server/turnos/turno.publico.ts` (aditivo; ninguna función existente cambia). Contrato: spec C §2.15.

```typescript
export type TurnoFuturoDeMateria = {
  turno_id: string;
  fecha: string;            // "AAAA-MM-DD"
  hora_inicio: string;      // "HH:mm"
  hora_fin: string;         // "HH:mm" (inicio + duracionMinutosTurno)
  aula: string;             // nombre; un DISPONIBLE/COMPLETO siempre tiene aula
  alumnos_inscriptos: string; // "3/5": inscriptos / cupoMaximoTurno, mismo formato que presentar() de HU-C-01
  estado: "DISPONIBLE" | "COMPLETO";
};

export async function listarTurnosFuturosDeProfesorPorMateria(
  profesorId: string,
  materiaId: string,
  { pagina, porPagina }: { pagina: number; porPagina: number },
  db: Db = prisma,
): Promise<{ items: TurnoFuturoDeMateria[]; total: number; pagina: number; por_pagina: number }>;
```

- **Filtro:** `profesorId`, `materiaId`, `estadoTurno IN ('DISPONIBLE','COMPLETO')` y `("fechaTurno" + "horaInicioTurno") > date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')`: **la misma condición textual** que `contarTurnosFuturosDeProfesorPorMateria()`, para que `total === confirmados` (spec C §2.15). `PENDIENTE`, `CANCELADO` y pasados no aparecen.
- **Orden:** `fechaTurno`, `horaInicioTurno` ascendentes, `idTurno` como desempate.
- **Implementación:** `$queryRaw` parametrizado (nunca concatenado) para el filtro de "futuro" (Prisma no expresa `fecha + hora > ahora` en el `where`): un `COUNT(*)` y un `SELECT … LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}` con `JOIN "aulas"` para el nombre y un `COUNT` de `"turno_alumno"` por turno (subconsulta o `LEFT JOIN … GROUP BY`). **Relevar antes de asumir** los nombres reales de columnas (`"nombreAula"`, `"cupoMaximoTurno"`, `"turnoId"`) en las migraciones, igual que HU-D-03 §4.2.
- Formato de horas con el `horaDeMinutos()` que ya existe en el archivo. `fecha` con `toISOString().slice(0, 10)` (columna `@db.Date`, medianoche UTC), como `bloquearTurnoParaOperacion()`.
- Solo lectura, sin bloqueo. Sin imports de otros módulos (Regla N.° 3; `publico.aislamiento.test.ts`).
- Si `pagina` excede el total: `items: []`, `total` real (la UI corrige a la última página).

### 4.3. Servicios del módulo D

**Archivo:** `src/server/profesores/profesor.service.ts`

**A) `actualizarMateriasDeProfesor(profesorId: string, materiaIds: string[], usuarioId: string): Promise<{ agregadas: string[]; quitadas: string[]; pendientes_afectados: number; sin_cambios: boolean }>`**

Todo dentro de **una única** `prisma.$transaction(async (tx) => …)`, todo o nada, en el orden de la spec §2.7:

1. **Profesor activo y bloqueado (Regla N.° 7):** `tx.profesor.updateMany({ where: { idProfesor: profesorId, activoProfesor: true }, data: { modificadoPorUsuarioId: usuarioId } })`. **No** toca `version` (0.3 punto 4). Si `count === 0`, `findUnique` distingue `PROFESOR_NO_ENCONTRADO` de `PROFESOR_INACTIVO` (mismo código que `asociarMateriasAProfesor()`). La fila queda bloqueada hasta el `COMMIT`: dos guardados simultáneos del mismo profesor se serializan, y el segundo calcula el diff con lo que confirmó el primero.
2. **Diff:** `actual = tx.profesorMateria.findMany({ where: { profesorId }, select: { materiaId: true } })`; `agregar = deseado − actual`, `quitar = actual − deseado`. Si ambos están vacíos → **lanzar** un retorno temprano que **revierta** el `updateMany` del paso 1 (no se escribe nada, spec: «no se escribe nada y equivale a no haber llamado a 2.7»). Opción simple: hacer el diff **antes** del paso 1 con una lectura previa y repetirlo después del bloqueo; o lanzar una señal interna y capturarla fuera del `$transaction` para devolver `{ agregadas: [], quitadas: [], pendientes_afectados: 0, sin_cambios: true }`. Elegir una y testearla (CP-D07-13).
3. **Agregar (AC2):** si `agregar` no está vacío, `bloquearMateriasParaAsociar(agregar, tx)` (`FOR SHARE`, módulo L):
   - falta algún id → `ServiceError("MATERIA_NO_ENCONTRADA", …)`;
   - alguna con `activa === false` → `ServiceError("MATERIA_INACTIVA", …, { materias: [{ id, nombre }] })` con **todas** las inactivas de `agregar`;
   - si todo bien, `tx.profesorMateria.createMany({ data: agregar.map((materiaId) => ({ profesorId, materiaId, creadoPorUsuarioId: usuarioId })) })`, **sin** `skipDuplicates`.
   - Una asociada inactiva que sigue en el conjunto **no** está en `agregar`: no se revalida ni da `MATERIA_INACTIVA` (spec §2.7).
4. **Quitar (AC3), por cada `materiaId` de `quitar`, en este orden:**
   - (a) `tx.profesorMateria.delete({ where: { profesorId_materiaId: { profesorId, materiaId } } })` (o `deleteMany` con las dos columnas);
   - (b) `const { confirmados, pendientes } = await contarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, tx)` (import desde `@/server/turnos/turno.publico`, Regla N.° 3: **nunca** se lee la tabla `turnos` desde D);
   - (c) si `confirmados > 0`, acumular `{ materia_id: materiaId, cantidad: confirmados }`; sumar `pendientes` a `pendientes_afectados`.
   - Al terminar el recorrido, si hay acumulados → `ServiceError("MATERIA_CON_TURNOS_FUTUROS", "No se puede quitar: el profesor tiene turnos futuros de esta materia", { detalle: [...] })`. La transacción entera se revierte: ni las altas del paso 3 ni ninguna baja quedan guardadas.
   - **Por qué (a) antes que (b) (spec §2.7):** el `DELETE` toma un bloqueo exclusivo sobre la fila de `profesor_materia`; `profesorActivoDictaMateria(…, tx)` (HU-C-04, al configurar o confirmar un turno) la lee con `FOR SHARE`. Si Mesa está creando un turno de esa materia en ese momento, el `DELETE` espera a que confirme y el recuento posterior lo ve; si el turno llega después, ya no encuentra la asociación y falla con `PROFESOR_NO_DICTA_MATERIA`. Contar primero y borrar después dejaría una ventana para un turno huérfano.
5. **Horarios (AC5):** no se lee ni se escribe `HorarioProfesor`. Nada que hacer.
6. **Errores fuera del callback:** `ServiceError` se relanza; `P2002` (solo puede venir de la PK compuesta) → `MATERIA_YA_ASOCIADA` (mismo criterio que HU-D-03); el resto se propaga.
7. Devuelve `{ agregadas: agregar, quitadas: quitar, pendientes_afectados, sin_cambios: false }`.

**B) `listarTurnosFuturosDeMateria(profesorId: string, materiaId: string, pagina: number)`**
1. Profesor existe (activo o no) → si no, `PROFESOR_NO_ENCONTRADO`.
2. Materia existe (activa o no) vía `obtenerMateriasPorIds([materiaId])` (módulo L, público) → si no, `MATERIA_NO_ENCONTRADA`.
3. Delegar en `listarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, { pagina, porPagina: TURNOS_FUTUROS_POR_PAGINA })`.
4. No exige que la materia siga asociada. Solo lectura, sin transacción.

### 4.4. Route Handlers

**`PUT /api/profesores/[id]/materias`** — mismo archivo `src/app/api/profesores/[id]/materias/route.ts` (se agrega `PUT`; el `POST` de HU-D-03 no cambia). `withPermission("profesores:editar")`, `params` async (Next 16).

| Resultado | Status | Cuerpo |
|---|---|---|
| Éxito | `200` | `{ data: { agregadas, quitadas, pendientes_afectados, sin_cambios }, error: null }` |
| `id` no-cuid / body inválido / ids repetidos / campo ajeno | `400` | `{ data: null, error: { code: "VALIDACION", message: "Datos inválidos", campos } }` (mismo shape que el `POST`) |
| Body no JSON | `400` | `BODY_INVALIDO` (igual que el `POST`) |
| `PROFESOR_NO_ENCONTRADO` / `MATERIA_NO_ENCONTRADA` | `404` | `{ code, message }` (mensajes del `MENSAJES` existente) |
| `PROFESOR_INACTIVO` / `MATERIA_YA_ASOCIADA` | `409` | ídem |
| `MATERIA_INACTIVA` | `409` | `{ code, message: mensajeMateriasInactivas(…), materia_ids_invalidas: [...] }` (snake_case: contrato nuevo, spec §2.7 «Convención de nombres») |
| `MATERIA_CON_TURNOS_FUTUROS` | `409` | `{ code, message: "No se puede quitar: el profesor tiene N turnos futuros de esta materia" (si es una sola; con varias, un mensaje general), detalle: [{ materia_id, cantidad }] }` |
| Sin sesión / sin permiso | `401` / `403` | `withPermission` |
| Otro | `500` | `ERROR_INTERNO`, sin detalle técnico |

**`GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n`** — archivo nuevo `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.ts`. `withPermission("profesores:leer")`.
- `id` y `materiaId` con `z.cuid()`; query con `ListarTurnosFuturosQuerySchema` (rechaza `por_pagina` y cualquier otro parámetro) → `400 VALIDACION`.
- `404 PROFESOR_NO_ENCONTRADO` / `404 MATERIA_NO_ENCONTRADA`.
- `200 { data: { items, total, pagina, por_pagina: 10 }, error: null }`.

### 4.5. Server Action y tipos

**Tipos** (`src/types/profesor.types.ts`):
```typescript
export type DetalleTurnosFuturos = { materia_id: string; cantidad: number };

export type ResultadoActualizarMaterias =
  | { data: { agregadas: string[]; quitadas: string[]; pendientes_afectados: number; sin_cambios: boolean }; error: null }
  | {
      data: null;
      error: {
        code: string;
        message: string;
        materias?: { id: string; nombre: string }[]; // MATERIA_INACTIVA
        detalle?: DetalleTurnosFuturos[];           // MATERIA_CON_TURNOS_FUTUROS
        detalles?: unknown;                          // VALIDACION
      };
    };

export type TurnoFuturoDeMateria = { /* = el de turno.publico.ts; reexportar el tipo o duplicarlo aquí como tipo de UI */ };
export type PaginaTurnosFuturos = { items: TurnoFuturoDeMateria[]; total: number; pagina: number; por_pagina: number };
```

**Action:** `actualizarMateriasProfesor(profesorId: string, materiaIds: string[]): Promise<ResultadoActualizarMaterias>` en `src/server/profesores/actions.ts` (Regla N.° 11; la spec dice "nombre a confirmar contra el código": se usa este). No va ligada a `useActionState` → `{ data, error }` (Regla N.° 5), igual que `modificarProfesor()`. Recibe el arreglo directo (serializable) en vez de `FormData`, porque el conjunto puede quedar vacío y `FormData.getAll()` no distingue "vacío" de "no enviado"; si el equipo prefiere `FormData`, agregar un campo centinela.
1. `verificarPermiso("profesores:editar")`.
2. `ProfesorIdSchema.safeParse(profesorId)` y `ActualizarMateriasProfesorSchema.safeParse({ materia_ids: materiaIds })` → `VALIDACION` con `flattenError`.
3. Servicio.
4. Si `!sin_cambios`: `revalidatePath("/profesores")`, `revalidatePath(`/profesores/${id}`)`, `revalidatePath("/materias")` y `revalidatePath(`/materias/${materiaId}`)` por cada agregada **y** quitada (HU-L-02 muestra profesores por materia).
5. Traducción con `MENSAJES_POR_CODIGO` (ya existe en el archivo; se agregan las claves nuevas):

| Código | `error.message` | Dónde lo pinta la UI |
|---|---|---|
| `VALIDACION` | "Datos inválidos" | General de la sección Materias |
| `MATERIA_CON_TURNOS_FUTUROS` | "No se pudieron guardar los cambios de materias: hay materias con turnos futuros" + `detalle` | Aviso corto debajo de cada materia bloqueada (§5) |
| `MATERIA_INACTIVA` | "La materia X dejó de estar activa. Quitala de la selección y volvé a confirmar" (texto de HU-D-03) + `materias` | Junto a cada materia (`aria-invalid`) |
| `MATERIA_NO_ENCONTRADA` / `MATERIA_YA_ASOCIADA` | textos existentes de HU-D-03 ("…Recargá la página") | General |
| `PROFESOR_INACTIVO` | "Solo pueden asociarse materias a profesores activos" | General |
| `PROFESOR_NO_ENCONTRADO` | "El profesor ya no existe" | General |
| `PermisoError` | su propio mensaje | General |
| Otro | "No se pudo conectar. Intentá nuevamente" | General |

### 4.6. Trazabilidad

Opción (a), en la misma transacción: `profesor_materia.createdAtProfesorMateria` / `creadoPorUsuarioId` por cada alta; `profesores.modificadoPorUsuarioId` / `updatedAtProfesor` por cada guardado con cambios. Sin cambios → nada se escribe. Sin evento.

### 4.7. Revisión de specs (SDD, aditiva, sin renumerar)

- `spec_modulo_D.md` §2.7: nota de sincronización con los nombres reales (`actualizarMateriasProfesor()`, archivos), que 2.7 **no** incrementa `version` (0.3 punto 4), el `z.cuid()` de Zod 4, y la resolución que el PO dé sobre el mensaje de AC4 (§10 D-07-1).
- `spec_modulo_C.md` §2.15: marcar `listarTurnosFuturosDeProfesorPorMateria()` como implementada, con la confirmación del formato de horas y del orden.

---

## 5. Frontend — sección de materias en el modo edición de la ficha

**Paleta:** solo tokens de `docs/DESIGN.md`, sin hex ni colores default de Tailwind. Éxito `bg-success text-success-foreground`; aviso de rechazo `bg-destructive-soft text-destructive-soft-foreground` (link subrayado del mismo color, ícono `CircleAlert`); errores de formulario `text-destructive`; hover de ítems `bg-accent`; un solo botón `primary` por vista ("Guardar cambios"); etiquetas de estado con `EstadoTurnoBadge` (Disponible `bg-success`, Completo `bg-primary`); `brand-accent` nunca como texto.

### 5.1. `page.tsx` (Server Component)

- **Modo edición:** además de lo que ya carga (HU-D-06), `listarMateriasActivas()` y arma `opciones` como `materias/page.tsx` de HU-D-03: activas del catálogo + asociadas inactivas, ordenadas por nombre, cada una con `asociada: boolean` y `activa: boolean`. Se pasan a `EditarProfesorForm`.
- **Profesor inactivo en modo edición** (HU-D-06 permite editarlo, D-06-7): la sección Materias se muestra en solo lectura con "Solo pueden asociarse materias a profesores activos" (el servidor respondería `PROFESOR_INACTIVO`). Ver §10 D-07-3.
- **Modo consulta, banners:**
  - `?actualizada=1` → "Profesor actualizado correctamente" (ya existe);
  - `?actualizada=materias` → **"Materias del profesor actualizadas"** (AC4, nuevo). Se resuelve en la página con `query.actualizada === "materias"`; `src/lib/modo-edicion.ts` no se toca;
  - si además viene `&pendientes=N` (N > 0), una segunda línea en el mismo banner con el aviso de pendientes (§10 D-07-5).

### 5.2. `materias-profesor-selector.tsx` (cliente, nuevo, en `src/app/(dashboard)/profesores/[id]/`)

Componente controlado (el estado vive en `EditarProfesorForm`, que es quien guarda):
- Título de tarjeta "Materias"; input "Filtrar por nombre o código" (placeholder "Ej.: matemática o MAT101") con `filtrarMaterias()`; las ocultas por el filtro **conservan** su estado y se envían igual.
- Lista `<ul>` con `<input type="checkbox">` + `<label>` "Nombre (CÓDIGO)", mismas clases que `asociar-materias-form.tsx` (`divide-y divide-border rounded-md border border-border bg-card`, `hover:bg-accent`). Asociadas tildadas y **habilitadas**; inactivas asociadas con `Badge variant="muted"` "Inactiva".
- Contador "N materias asociadas" (estado resultante) y, si hay cambios, "N para agregar · M para quitar".
- **Aviso por materia bloqueada (AC3):** debajo del `<li>` de cada materia de `detalle`, una línea `role="alert"` con ícono, `bg-destructive-soft text-destructive-soft-foreground`: "No se puede quitar: el profesor tiene **N** turnos futuros de esta materia" + botón-link "Ver turnos" (subrayado, mismo color; `type="button"`, no navega). N = `cantidad` del `detalle`. La casilla vuelve a quedar **tildada** (el form la reinserta en el conjunto deseado al recibir el 409).
- El aviso de una materia desaparece si Mesa vuelve a destildarla (va a reintentar) o tras un guardado exitoso.
- `MATERIA_INACTIVA`: igual que HU-D-03 (texto "Dejó de estar activa" junto a la materia, `aria-invalid`, mensaje general `role="alert"`), conservando la selección.
- Sin materias activas ni asociadas: "No hay materias activas para asociar".

### 5.3. `ver-turnos-futuros-dialog.tsx` (cliente, nuevo)

`Dialog` ancho (`DialogContent` con `max-w-3xl`, DESIGN §6.3 excepción informativa):
- **Se abre solo** desde "Ver turnos". En cada apertura y cada cambio de página hace `fetchAutenticado(`/api/profesores/${profesorId}/materias/${materiaId}/turnos-futuros?pagina=${n}`)`, **sin caché**: si Mesa canceló turnos en la otra pestaña, al reabrir ve la lista y el N actualizados.
- `DialogTitle`: nombre de la materia. `DialogDescription`: "El profesor tiene **N** turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar." (N = `total` de la respuesta). Si `total` llega en 0: "El profesor ya no tiene turnos futuros de esta materia. Podés volver a intentar quitarla."
- Tabla (en mobile, lista de tarjetas) con columnas **Fecha** (`dd/mm/aaaa`, sin corrimiento de zona: la fecha viene `AAAA-MM-DD`), **Hora** (`hora_inicio–hora_fin`), **Aula**, **Alumnos inscriptos** (`alumnos_inscriptos`, p. ej. "3/5"), **Estado** (`EstadoTurnoBadge`) y una acción "Ver detalle" por fila: `<a href={`/turnos/${turno_id}`} target="_blank" rel="noopener noreferrer">` con ícono `ExternalLink` y texto accesible "(se abre en una pestaña nueva)". Es un `<a>` simple, no `LinkProtegido`: abrir otra pestaña no descarta nada.
- Paginación: `Pagination` con `onPageChange`, `porPagina={10}`, `mostrarRango`, `mostrarNumeros` ("Mostrando 1–10 de N", DESIGN §8.1). Con una sola página no se muestra.
- Estados: cargando (`Loader2`), error ("No se pudieron cargar los turnos." + "Reintentar").
- `DialogFooter`: único botón "Entendido" (cierra). **No** dispara toast ni modifica datos.

### 5.4. `editar-profesor-form.tsx` (se modifica)

- Estado nuevo: `materiasDeseadas: Set<string>` (inicial = asociadas), `bloqueos: DetalleTurnosFuturos[]`, `materiasInvalidas`, `dialogo: { materiaId } | null`, y `materiasGuardadas: Set<string>` (línea base para el diff de materias; se actualiza si 2.7 sale bien y 2.6 falla).
- `hayCambios` = cambios en datos (HU-D-06) **o** `materiasDeseadas ≠ materiasGuardadas`. Alimenta `useDirtyState` y la confirmación de Cancelar (spec §2.6 «Cancelar» alcanza también a las materias). "Guardar cambios" deshabilitado sin cambios.
- **Secuencia de "Guardar cambios"** (spec §2.7 «Guardado desde la UI»):
  1. Si cambiaron las materias → `actualizarMateriasProfesor(id, [...materiasDeseadas])`.
     - Error `MATERIA_CON_TURNOS_FUTUROS` → reinsertar en `materiasDeseadas` cada `materia_id` de `detalle`, guardar `bloqueos`, **no** llamar a 2.6, no navegar. El resto de los cambios queda en pantalla, sin guardar.
     - Otro error → mostrarlo; no llamar a 2.6.
     - Éxito → `materiasGuardadas = materiasDeseadas`, `bloqueos = []`.
  2. Si cambiaron los datos → `modificarProfesor(id, formData)` con la `version` precargada (2.7 no la cambia, 0.3 punto 4).
     - Error y 2.7 había guardado algo → banner de error "Las materias se guardaron, pero los datos no: <error>"; queda en modo edición; reintento = solo 2.6.
     - Error y no hubo cambios de materias → igual que HU-D-06.
  3. Éxito → `setDirty(false)` y `router.replace(...)`:
     - hubo cambios de datos → `rutaTrasGuardar` (`?actualizada=1`, "Profesor actualizado correctamente");
     - solo materias → `?actualizada=materias` ("Materias del profesor actualizadas"), más `&pendientes=N` si `pendientes_afectados > 0`;
     - `sin_cambios: true` y sin cambios de datos no puede pasar (botón deshabilitado); si pasa, vuelve a consulta sin banner.
- `CONFLICTO_EDICION_CONCURRENTE` de 2.6 → igual que HU-D-06 ("Recargar"); el `key={profesor.version}` remonta también la sección de materias con lo guardado.
- Estructura: tercera tarjeta "Materias" debajo de las dos de HU-D-06 (o en la columna derecha a `md:`), con `id="materias"` para poder llegar con `#materias` desde la ficha (§10 D-07-6). Se elimina la nota de HU-D-06 que decía que las materias se gestionan desde la ficha.

### 5.5. `ficha-materias.tsx` (se modifica, §10 D-07-6)

En modo consulta, el link "Asociar materias" pasa a "Editar materias" → `rutaModoEdicion(`/profesores/${id}`) + "#materias"` (mismo permiso y misma condición de profesor activo). `/profesores/[id]/materias` sigue existiendo para el wizard de alta.

---

## 6. Plan de implementación paso a paso

1. **Confirmar relevamiento:** `git pull` de `develop`; verificar que los archivos de 0.1 no cambiaron y resolver los bloqueantes de §10 (D-07-1, D-07-9). Leer las guías de Next de `node_modules/next/dist/docs/`.
2. **Módulo C:** `listarTurnosFuturosDeProfesorPorMateria()` + tests (unit con `db` mockeado y `.pg.test` en `turno.publico.pg.test.ts`). OK del responsable de Turnos.
3. **Schema:** `ActualizarMateriasProfesorSchema`, `ListarTurnosFuturosQuerySchema`, `TURNOS_FUTUROS_POR_PAGINA` + tests.
4. **Types:** `ResultadoActualizarMaterias`, `DetalleTurnosFuturos`, `TurnoFuturoDeMateria`, `PaginaTurnosFuturos`.
5. **Service:** `actualizarMateriasDeProfesor()` y `listarTurnosFuturosDeMateria()` + tests con `prisma` mockeado.
6. **Route Handlers:** `PUT …/materias` y `GET …/turnos-futuros`. **Server Action** `actualizarMateriasProfesor()`.
7. **Frontend:** `materias-profesor-selector.tsx`, `ver-turnos-futuros-dialog.tsx`, cambios en `editar-profesor-form.tsx`, `page.tsx` y `ficha-materias.tsx`.
8. **Seed** (si el SM lo aprueba, D-07-9): turnos extra de Giménez + Matemática y una materia inactiva asociada; `SEED_SOLO_VALIDAR=1 npx tsx prisma/seed.ts` en verde.
9. **Verificación:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; re-correr el seed y ejecutar los casos de §7.
10. **Specs:** notas de sincronización (§4.7). PR acotado a la HU (git a cargo del responsable).

---

## 7. Testing (tres niveles)

**Runner:** Vitest (`npm test` → `vitest run`, alias `@` → `src`), ya instalado. Los `*.pg.test.ts` necesitan base de prueba configurada.

### Nivel 1 — Unitarios

`src/server/profesores/profesor.materias.test.ts` (nuevo):
- **Schema:** `[]` → válido; id no-cuid → error "Materia inválida"; ids repetidos → "No repitas materias"; 101 ids → error; campo ajeno (`materiaIds`, `version`) → error por `.strict()`. Query: `pagina=0`, `pagina=abc`, `por_pagina=50` → error; sin `pagina` → 1.
- **`actualizarMateriasDeProfesor`** (`$transaction` que invoca el callback con `tx` mockeado; `bloquearMateriasParaAsociar` y `contarTurnosFuturosDeProfesorPorMateria` mockeados):
  - solo agregar 2 → `createMany` con `creadoPorUsuarioId`, sin `skipDuplicates`; `agregadas` correctas;
  - solo quitar 1 sin turnos → `delete` **antes** que `contarTurnos…` (verificar orden de invocación); `quitadas` correcta;
  - quitar 1 con `confirmados: 3` → `MATERIA_CON_TURNOS_FUTUROS` con `detalle: [{ materia_id, cantidad: 3 }]`;
  - quitar 2 bloqueadas (3 y 4) → un solo error con las dos en `detalle` (recorre todas antes de lanzar);
  - **error parcial:** agregar 1 válida + quitar 1 libre + quitar 1 bloqueada → error; `createMany` y el `delete` libre se invocaron dentro del mismo `tx` que se revierte (el test verifica que el error se propaga fuera del `$transaction`);
  - `pendientes: 2` sin `confirmados` → no bloquea; `pendientes_afectados: 2`;
  - agregar una inactiva → `MATERIA_INACTIVA` con esa materia; agregar id inexistente → `MATERIA_NO_ENCONTRADA`;
  - asociada inactiva que sigue en el conjunto → no se pasa a `bloquearMateriasParaAsociar` ni da error;
  - conjunto igual al actual → `sin_cambios: true`, sin `createMany`/`delete` y **sin** dejar `modificadoPorUsuarioId` escrito;
  - conjunto vacío sobre un profesor con 1 materia libre → `quitadas: [id]`;
  - profesor inactivo → `PROFESOR_INACTIVO`; inexistente → `PROFESOR_NO_ENCONTRADO`;
  - `P2002` → `MATERIA_YA_ASOCIADA`;
  - el `updateMany` del paso 1 **no** incluye `version`;
  - nunca invoca `tx.horarioProfesor.*` (AC5) ni lee `tx.turno.*` (Regla N.° 3).
- **`listarTurnosFuturosDeMateria`:** profesor inexistente → 404; materia inexistente → 404; materia inactiva → OK; delega con `porPagina: 10`.

`src/server/turnos/turno.publico.test.ts` (se agregan casos) y `turno.publico.pg.test.ts`:
- devuelve solo `DISPONIBLE`/`COMPLETO` futuros del par; excluye `PENDIENTE`, `CANCELADO`, pasados, otro profesor y otra materia;
- `total` coincide con `confirmados` de `contarTurnosFuturosDeProfesorPorMateria()` sobre los mismos datos;
- orden por fecha, hora, id; página 2 con 11 turnos → 1 ítem; `alumnos_inscriptos` "3/5"; `hora_fin` = inicio + duración.

`src/server/publico.aislamiento.test.ts`: sigue en verde (turno.publico sin imports de otros módulos).

Componentes (`materias-profesor-selector.test.tsx`, `ver-turnos-futuros-dialog.test.tsx`, ampliar el test del form si existe):
- asociadas tildadas y habilitadas; inactiva asociada con "Inactiva"; filtro conserva selección;
- con `bloqueos` → aviso con el N literal y botón "Ver turnos"; casilla tildada;
- diálogo: mensaje con N, filas con link `target="_blank"` y `rel` que incluye `noopener`, "Entendido" cierra, paginación con 11 ítems, reabrir vuelve a pedir datos;
- form: con 409 no se llama a `modificarProfesor`; con 2.7 ok + 2.6 error se muestra el banner parcial y el reintento no vuelve a llamar a 2.7; solo materias → `router.replace` con `?actualizada=materias`.

### Nivel 2 — Postman y Nivel 3 — BD / TablePlus: casos con datos del seed

Precondición: `npx prisma db seed` recién corrido (y, si se aprobó, con los datos de D-07-9); sesión de **mesa.entrada@noctium.local** salvo indicación. Ids: `SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '…'` y `SELECT "idMateria", "nombreMateria" FROM materias`. Body del `PUT`: `{ "materia_ids": [...] }` con el **conjunto final**.

| # | Caso | Datos | Acción | Resultado esperado (API/UI) | Verificación en BD |
|---|---|---|---|---|---|
| CP-D07-01 | **Selector precargado (AC1)** | Castro | Ficha → «Editar» | Tarjeta "Materias" con Física, Matemática, Programación I y Química tildadas; Bases de Datos e Inglés Técnico sin tildar; no aparece Historia de la Ciencia | — |
| CP-D07-02 | **Agregar varias (AC2, AC4)** | Quiroga (sin materias) | UI: tildar Matemática y Química → Guardar. API: `{ materia_ids: [Mat, Quí] }` | `200`, `agregadas` con las 2; UI: vuelve a consulta con "Materias del profesor actualizadas" | 2 filas en `profesor_materia` con `creadoPorUsuarioId` = mesa.entrada y `createdAtProfesorMateria` reciente; `profesores.modificadoPorUsuarioId` = mesa.entrada; `version` **sin cambios** |
| CP-D07-03 | **Agregar inactiva (AC2)** | Quiroga | API: `{ materia_ids: [Historia de la Ciencia] }` | `409 MATERIA_INACTIVA`, `materia_ids_invalidas: [id]` | Sin filas nuevas |
| CP-D07-04 | Agregar inexistente | Quiroga | API: cuid válido inventado | `404 MATERIA_NO_ENCONTRADA` | Sin cambios |
| CP-D07-05 | Ids repetidos / campo ajeno | Quiroga | `{ materia_ids: [Mat, Mat] }`; `{ materiaIds: [...] }`; `{ materia_ids: [], version: 1 }` | `400 VALIDACION` | Sin cambios |
| CP-D07-06 | **Quitar sin turnos (AC3)** | Castro | Destildar Química → Guardar | `200`, `quitadas: [Química]`; banner AC4 | Castro: 3 filas en `profesor_materia` |
| CP-D07-07 | **Cancelado no bloquea (AC3)** | Castro | Destildar Matemática (solo tiene `seed-turno-09` CANCELADO) | `200` | Fila borrada; `seed-turno-09` intacto (`CANCELADO`, misma materia y profesor) |
| CP-D07-08 | **Quitar con turnos futuros (AC3)** | Giménez | Destildar Matemática → Guardar. API: `{ materia_ids: [Física] }` | `409 MATERIA_CON_TURNOS_FUTUROS`, `detalle: [{ materia_id: Mat, cantidad: 3 }]`. UI: Matemática vuelve a quedar tildada; debajo: "No se puede quitar: el profesor tiene 3 turnos futuros de esta materia" + "Ver turnos" | Giménez sigue con Matemática y Física; `modificadoPorUsuarioId`/`updatedAtProfesor` **sin cambios** (rollback) |
| CP-D07-09 | **Modal "Ver turnos" (AC3)** | Giménez, tras CP-D07-08 | Click "Ver turnos". API: `GET …/turnos-futuros?pagina=1` | Modal: "El profesor tiene 3 turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar."; filas `seed-turno-01` (Aula 1, 10/10, Completo), `seed-turno-10` (Aula 10, 12/30, Disponible), `seed-turno-17` (Aula 1, 0/10, Disponible), por fecha; **no** aparecen `seed-turno-26` ni los históricos; "Entendido" cierra sin toast | — |
| CP-D07-10 | **Dos bloqueadas a la vez** | Giménez | Destildar Matemática y Física | `409` con `detalle` de 2 (3 y 4); dos avisos, cada uno con su N | Sin cambios |
| CP-D07-11 | **Error parcial dentro de 2.7** | Castro | Tildar Inglés Técnico, destildar Química (libre) y Física (`seed-turno-19`) → Guardar | `409 MATERIA_CON_TURNOS_FUTUROS` (`cantidad: 1` para Física). UI: Física re-tildada con aviso N = 1; Inglés sigue tildado y Química destildada **sin guardar** | Castro con sus 4 materias originales; **sin** Inglés Técnico (todo o nada) |
| CP-D07-12 | **Flujo completo: resolver y reintentar (AC3)** | Acuña | Destildar Programación I → 409 (N = 1) → "Ver turnos" → "Ver detalle" de `seed-turno-13` (abre **pestaña nueva**; la ficha conserva el cambio) → en el Detalle, "Cancelar turno" (HU-C-05) → volver a la ficha → reabrir "Ver turnos" (ahora 0) → Guardar | Segundo guardado `200`, `quitadas: [Programación I]`; banner AC4 | `seed-turno-13` `CANCELADO`; `seed-turno-27` (pasado) intacto; Acuña sin Programación I |
| CP-D07-13 | Sin cambios | Rossi | API: `PUT` con su conjunto actual | `200`, `sin_cambios: true` | `updatedAtProfesor` y `modificadoPorUsuarioId` **sin cambios** |
| CP-D07-14 | **Horarios intactos (AC5)** | Castro, tras CP-D07-06/07 | Contar horarios | — | `horarios_profesor` de Castro: **8 filas**, mismos valores que antes |
| CP-D07-15 | Quitar la única (conjunto vacío) | Pérez (33300001) | API: `{ materia_ids: [] }` | `200`, `quitadas: [Bases de Datos]` | 0 filas; la ficha muestra "Sin materias asociadas" |
| CP-D07-16 | **Materias + datos en el mismo guardado** | Rossi | Cambiar teléfono y tildar Química → Guardar | 2.7 `200`, luego 2.6 `200`; banner "Profesor actualizado correctamente" | Química asociada; teléfono nuevo; `version` +1 (solo por 2.6) |
| CP-D07-17 | **2.7 ok, 2.6 falla** | Rossi | Tildar Química y cambiar DNI a `27100001` (Giménez) → Guardar | Banner "Las materias se guardaron, pero los datos no: Ya existe un profesor registrado con ese DNI"; sigue en edición; el reintento (DNI corregido) llama solo a 2.6 | Química asociada; DNI sin cambios hasta el reintento |
| CP-D07-18 | 2.7 falla → 2.6 no se llama | Giménez | Destildar Matemática y cambiar teléfono → Guardar | 409 de materias; **ninguna** request a `PATCH /api/profesores/:id` (verificar en Network) | Teléfono sin cambios |
| CP-D07-19 | Cancelar con cambios de materias | Castro en edición | Destildar Química → "Cancelar" / breadcrumb / recargar | `ConfirmarDescarteDialog` (y diálogo nativo al recargar) | Sin cambios |
| CP-D07-20 | Profesor inactivo | Molina | UI: modo edición. API: `PUT` | UI: Materias en solo lectura con "Solo pueden asociarse materias a profesores activos". API: `409 PROFESOR_INACTIVO` | Sin cambios |
| CP-D07-21 | Permisos | gerente@noctium.local | `PUT …/materias` y `GET …/turnos-futuros` | `403 SIN_PERMISO`; sin sesión `401` | — |
| CP-D07-22 | Ruta del modal: validaciones | Giménez | `?pagina=0`, `?por_pagina=50`, `materiaId` no-cuid, materia inexistente | `400`, `400`, `400`, `404 MATERIA_NO_ENCONTRADA` | — |
| CP-D07-23 | **Paginación de a 10** *(requiere D-07-9)* | Giménez + Matemática con 11+ turnos | Abrir "Ver turnos"; pasar a página 2 | "Mostrando 1–10 de N", números de página; página 2 con el resto; N del mensaje = total | — |
| CP-D07-24 | **Inactiva asociada (AC1)** *(requiere D-07-9)* | Profesor con Historia de la Ciencia | Modo edición; guardar sin tocarla; luego destildarla y guardar | Aparece tildada con "Inactiva"; el primer guardado no da `MATERIA_INACTIVA`; el segundo la quita (`200`) | Fila presente tras el primero; borrada tras el segundo |
| CP-D07-25 | Concurrencia con creación de turno (Regla N.° 7) | Castro + Química | En `psql`: `BEGIN; SELECT … FROM profesor_materia WHERE … FOR SHARE;` (simula HU-C-04) y, sin cerrar, `PUT` quitando Química | El `PUT` queda esperando hasta `COMMIT`/`ROLLBACK` de la sesión de `psql`; después responde según los turnos que haya | — |

**Consultas SQL de apoyo (solo lectura):**
```sql
-- Materias asociadas de un profesor
SELECT m."nombreMateria", pm."createdAtProfesorMateria", pm."creadoPorUsuarioId"
FROM profesor_materia pm JOIN materias m ON m."idMateria" = pm."materiaId"
WHERE pm."profesorId" = (SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '32200011')
ORDER BY m."nombreMateria";

-- Turnos futuros que bloquean (mismo criterio que contarTurnosFuturosDeProfesorPorMateria)
SELECT t."idTurno", t."fechaTurno", t."horaInicioTurno", t."estadoTurno", a."nombreAula",
       (SELECT COUNT(*) FROM turno_alumno ta WHERE ta."turnoId" = t."idTurno") || '/' || t."cupoMaximoTurno" AS ocupacion
FROM turnos t LEFT JOIN aulas a ON a."idAula" = t."aulaId"
WHERE t."profesorId" = (SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '27100001')
  AND t."materiaId" = (SELECT "idMateria" FROM materias WHERE "nombreMateria" = 'Matemática')
  AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
  AND (t."fechaTurno" + t."horaInicioTurno") > date_trunc('minute', CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
ORDER BY t."fechaTurno", t."horaInicioTurno", t."idTurno";

-- Auditoría del profesor y horarios (AC5)
SELECT "modificadoPorUsuarioId", "updatedAtProfesor", "version" FROM profesores WHERE "dniProfesor" = '32200011';
SELECT COUNT(*) FROM horarios_profesor WHERE "profesorId" = (SELECT "idProfesor" FROM profesores WHERE "dniProfesor" = '32200011');
```

**Evidencia esperada:** Postman y SQL de los CP; capturas de: selector precargado (con y sin inactiva), aviso de rechazo con "Ver turnos", modal con lista (y paginado, si D-07-9), Detalle de turno abierto en otra pestaña, reintento exitoso, banner "Materias del profesor actualizadas", banner de error parcial 2.7/2.6, confirmación de Cancelar.

---

## 8. Dependencias

| Dependencia | Estado al 01/10 |
|---|---|
| HU-D-03 (asociación, `bloquearMateriasParaAsociar`, auditoría de `profesor_materia`) | ✅ En `develop` |
| HU-D-06 (modo edición de la ficha, `version`, dirty state, banner) | ✅ En `develop`; deja pendiente para esta HU la sección de materias (D-06-2) |
| HU-C-04 / HU-C-03 (turnos con profesor y materia; `profesorActivoDictaMateria` con `FOR SHARE`) | ✅ En `develop` |
| `contarTurnosFuturosDeProfesorPorMateria()` (C §2.15) | ✅ En `develop` (`turno.publico.ts`) |
| `listarTurnosFuturosDeProfesorPorMateria()` (C §2.15) | ✅ Agregada por esta HU (aditiva). ⏳ Falta el OK del responsable de Turnos |
| HU-C-05 (cancelar turno desde el Detalle) y HU-C-09 (Detalle de turno) | ✅ En `develop` |
| Token `--destructive-soft` en `globals.css` | ✅ Presente |
| Datos de seed para paginación, inactiva asociada y PENDIENTE con profesor | ✅ Agregados (D-07-9, §11.3) |

---

## 9. Checklist de Definition of Done

- [x] Relevamiento (§0) confirmado; D-07-1 resuelto provisoriamente con el literal del AC (pendiente PO) y D-07-9 resuelto con agregados al seed.
- [x] Sin migración ni cambios en `schema.prisma`; seed solo con agregados (`SEED_SOLO_VALIDAR=1` en verde: 40 alumnos, 36 turnos; seed real corrido sin errores).
- [x] `listarTurnosFuturosDeProfesorPorMateria()` agregada en `turno.publico.ts`, parametrizada, mismo criterio de "futuro" que `contarTurnos…`.
- [ ] **OK del responsable de Turnos** sobre el agregado a `turno.publico.ts` antes del merge.
- [x] `actualizarMateriasDeProfesor()`: una transacción, todo o nada; `updateMany` condicionado a activo **sin tocar `version`**; agregar con `bloquearMateriasParaAsociar()`; quitar con `DELETE` → `contarTurnos…` en ese orden; todos los bloqueos en un solo error; `P2002` traducido.
- [x] El módulo D nunca lee `turnos` directamente (Regla N.° 3); `publico.aislamiento.test.ts` en verde.
- [x] `PUT …/materias` y `GET …/turnos-futuros` delgados, `{ data, error }`, Zod antes del servicio; Server Action `actualizarMateriasProfesor()` en `src/server/profesores/actions.ts`.
- [x] Modo edición con la sección Materias (asociadas tildadas y quitables, inactivas con etiqueta), aviso corto con N y "Ver turnos", modal informativo paginado de a 10 con links en pestaña nueva y botón "Entendido".
- [x] Secuencia 2.7 → 2.6 con los mensajes de §5.4; banner "Materias del profesor actualizadas" (literal del AC, pendiente PO).
- [x] `HorarioProfesor` intacto (AC5) verificado en BD (Castro: 8 → 8).
- [x] Solo tokens de `DESIGN.md`. Único `DELETE` físico: `profesor_materia` (excepción documentada en spec §2.7 paso 6).
- [x] Nivel 1 en verde (99 archivos, 1374 tests); `tsc --noEmit`, `eslint` y `next build` limpios.
- [ ] Niveles 2 y 3: cubiertos contra la base y el servidor reales por script y HTTP (§11.4); **faltan las capturas de UI en navegador** (CP-D07-01, 09, 12, 19).
- [x] Specs D §2.7 y C §2.15 con notas de sincronización (§4.7).
- [ ] PR acotado a esta HU (git a cargo del responsable).

---

## 10. Dudas / datos faltantes

Puntos donde la HU, la spec, `RULES.md` y el código no coinciden, o falta un dato. **No se resolvieron por inferencia**; la propuesta de cada uno es la que usa esta task mientras no haya respuesta.

- ⏳ **D-07-1 — Mensaje de AC4 (resuelto provisoriamente el 01/10: literal del AC; pendiente del PO).** El AC dice "Materias del profesor actualizadas" y "mismo mensaje que el de la asociación inicial". La spec D §2.7 («Mensajes al guardar» y nota «decisión del PO, 29/09/2026») dice «Materias asignadas correctamente», argumentando que los dos textos del backlog no coinciden. Pero en el código de HU-D-03 la asociación inicial **fuera del wizard** ya dice "Materias del profesor actualizadas" (`asociar-materias-form.tsx`, `MENSAJE_EXITO`); solo el wizard dice "Materias asignadas correctamente" (`MENSAJE_EXITO_ALTA`). O sea, el literal del AC **sí** coincide con un mensaje existente de la asociación inicial. Propuesta: usar el literal del AC (mismo criterio que HU-D-06: mandan los AC) y corregir la nota de la spec. Confirmar con el PO; si mantiene la decisión del 29/09, cambiar solo la constante del banner.
- **D-07-2 — "La lista sale del listado de HU-C-01" (no bloquea).** El AC lo dice, pero el listado (`GET /api/turnos`, `ListarTurnosQuerySchema` `.strict()`) no acepta materia, estado ni fecha futura (HU-C-02 AC6), y las specs C §2.7 y D §2.7 ya resolvieron una ruta propia de D sobre `listarTurnosFuturosDeProfesorPorMateria()`. Se sigue la spec: misma presentación y mismo Detalle de destino, consulta distinta. No es pantalla ni HU nueva, así que respeta la intención del AC. Si el PO exige literalmente el listado de HU-C-01, habría que agregar filtros a `listarTurnos()`, lo que contradice HU-C-02 AC6.
- ✅ **D-07-3 — Profesor inactivo en modo edición (aplicada la propuesta: solo lectura).** HU-D-06 deja editar los datos de un inactivo (D-06-7), pero 2.7 rechaza con `PROFESOR_INACTIVO`. Propuesta: sección Materias en solo lectura con el mensaje de HU-D-03. Confirmar.
- **D-07-4 — Concurrencia entre pestañas (no bloquea).** 2.7 envía el conjunto final sin `version`: si la pestaña A quita X y la pestaña B (desactualizada) guarda después un conjunto que todavía incluye X, B la vuelve a asociar sin aviso. La spec no lo cubre y no debe usar `version` (0.3 punto 4). Propuesta: aceptarlo (el bloqueo de la fila del profesor serializa, pero no detecta el dato viejo). Alternativa si el PO lo pide: enviar también el conjunto original y rechazar si no coincide con el actual (`409 CONFLICTO_EDICION_CONCURRENTE`). Cambio de spec.
- ✅ **D-07-5 — Aviso de turnos `PENDIENTE` (aplicada la propuesta; texto pendiente de confirmación del PO).** La spec §2.7 paso 4 pide informar `pendientes_afectados` (decisión del PO, 29/09, fuera de los AC) pero no fija el texto ni dónde se muestra. Propuesta: segunda línea del banner de éxito, "Atención: hay N turnos pendientes de las materias quitadas que no van a poder confirmarse con este profesor." (`bg-warning text-warning-foreground`). Además, relevar si un `PENDIENTE` puede tener profesor (0.3 punto 7); si no puede, el aviso no aplica nunca y se puede omitir.
- ✅ **D-07-6 — Link "Asociar materias" de la ficha (aplicada la propuesta: "Editar materias").** Hoy lleva a `/profesores/[id]/materias` (HU-D-03), que no permite quitar. Con esta HU quedarían dos lugares para editar materias con comportamientos distintos. Propuesta: en modo consulta, "Editar materias" → `?modo=edicion#materias`; `/profesores/[id]/materias` queda solo para el wizard de alta (`?alta=1`) y acceso directo. Confirmar con el equipo.
- **D-07-7 — Trazabilidad de las bajas (no bloquea).** La baja es un `DELETE` físico (excepción de la Regla N.° 1, spec §2.7 paso 6) y solo queda `Profesor.modificadoPorUsuarioId`/`updatedAtProfesor`: no se sabe qué materia se quitó ni cuándo, materia por materia. `RULES.md` Regla N.° 2 pide registrar "qué" ocurrió en mutaciones sensibles. La spec eligió la opción (a) y no lo considera un hueco. Se señala para que el PO/SM lo confirme; si hace falta, sería opción (b) (tabla de eventos) y un cambio de spec.
- ✅ **D-07-8 — `EstadoTurnoBadge` fuera de su ruta (aplicada la propuesta: se importa tal cual).** Vive en `src/app/(dashboard)/turnos/estado-turno-badge.tsx` y hoy solo lo importan pantallas de `/turnos`. Propuesta: importarlo desde la ficha de profesor tal cual (componente de UI sin lógica de dominio). Alternativa: moverlo a `src/components/shared/` (toca archivos de Turnos).
- ✅ **D-07-9 — Datos de seed faltantes (RESUELTO 01/10: agregados, ver §11.3).** El seed sirve para el criterio 3 en lo esencial (rechazo con N = 1, 3 y 4; cancelado y pasados que no bloquean; flujo completo con Acuña), pero **no** tiene: (a) un par profesor–materia con más de 10 turnos futuros (paginación del modal); (b) una materia inactiva asociada a un profesor activo (AC1); (c) un turno `PENDIENTE` con profesor. Propuesta: agregar (a) y (b) en `prisma/seed.ts` según 0.4, o prepararlos por SQL solo para la prueba. Confirmar con el SM quién y dónde.
- **D-07-10 — SP (no bloquea).** El pedido de esta task dice estimación 5; `HU-Sprint-2.md` (índice y ficha) dice 2 SP. No se modifica el backlog desde esta task; queda para el SM.
- **D-07-11 — Nota del backlog sobre `profesores:crear` (informativo, ya anotado en HU-D-06 D-06-11).** `HU-Sprint-2.md` (nota del 28/09 bajo HU-D-07) dice que `profesores:crear` "sigue siendo exclusivo del Gerente"; `seed.ts` (`ACCIONES_SOLO_MESA_ENTRADA`) y la spec D (R2-1) lo tienen como exclusivo de Mesa de Entrada. No afecta a esta HU.
- ✅ **D-07-12 — Mensaje del 409 con varias materias (aplicada la propuesta).** El literal del AC es por materia ("…N turnos futuros de esta materia"). La API puede rechazar varias a la vez. Propuesta: el `message` del `409` es general y la UI arma un aviso por materia con su `cantidad`. Confirmar que el texto general no tiene que ser literal.

---

## 11. Implementación (01/10/2026)

### 11.1. Decisiones tomadas al implementar

| # | Decisión | Fuente |
|---|---|---|
| I-1 | Mensaje de éxito de solo materias: **"Materias del profesor actualizadas"** (literal del AC), vía `?actualizada=materias`. Con datos personales también, "Profesor actualizado correctamente". | AC4 + D-07-1 (pendiente PO) |
| I-2 | Todo o nada dentro del guardado de materias; entre materias y datos, dos llamadas: materias primero; si fallan, los datos no se envían; si las materias salen bien y los datos no, banner `bg-warning` "Las materias se guardaron, pero los datos no: <error>" y el reintento manda solo los datos. | Spec §2.7 y §3.3 |
| I-3 | El guardado de materias **no** incrementa `Profesor.version`; verificado en BD (Herrera queda en `version = 0`). | §0.3 punto 4 |
| I-4 | Server Action `actualizarMateriasProfesor(profesorId, materiaIds: string[])`: recibe el arreglo, no `FormData` (el conjunto vacío es válido). | §4.5 |
| I-5 | "Sin cambios": el servicio lanza una señal interna dentro del `$transaction` para revertir el `updateMany` del paso 1 y devuelve `sin_cambios: true` sin escribir nada. | §4.3 paso 2 |
| I-6 | El formato `"3/5"` y `"Sin asignar"` de `presentar()` **se replicó** en `listarTurnosFuturosDeProfesorPorMateria()`, no se importó: `presentar()` es privada de `turno.service.ts` y `turno.publico.ts` no puede importar ese archivo (`publico.aislamiento.test.ts`). | Regla N.° 3 |
| I-7 | El selector es un componente nuevo y controlado (`materias-profesor-selector.tsx`) que reutiliza `filtrarMaterias()`, el tipo `OpcionMateria` y los estilos de HU-D-03; `AsociarMateriasForm` y `/profesores/[id]/materias` no se tocaron (wizard de alta). Las opciones del modo edición se arman igual que en `materias/page.tsx` (activas + asociadas inactivas). | §1 «Selector» |
| I-8 | Concurrencia: `DELETE` del vínculo y después conteo, dentro de la misma transacción; contraparte del `FOR SHARE OF pm` de `profesorActivoDictaMateria(…, tx)`. Verificado con dos transacciones reales (§11.4). | Spec §2.7, Regla N.° 7 |
| I-9 | El modal vuelve a pedir la lista en cada apertura y cada página (`cache: "no-store"`), así refleja los turnos cancelados en la otra pestaña; si la página quedó vacía tras cancelar, salta a la última. | §5.3 |
| I-11 | **Bug corregido (01/10):** en modo edición el documento (html/body) quedaba scrolleable. El `<legend className="sr-only">` del selector es `position: absolute` y no tenía ningún ancestro posicionado, así que su bloque contenedor era el documento: quedaba fuera del `<main>` que scrollea y del `overflow-hidden` del layout, y estiraba el documento (900 px contra una ventana de 768). El gesto del touchpad, al llegar al final de `main`, movía toda la página 132 px; el ancla `#materias` lo hacía al cargar. Arreglo: `relative` en la `<section id="materias">`. Medido en Chrome headless: el documento queda en 768 px y `html.scrollTop` en 0 en consulta, edición, `#materias`, aviso de rechazo, modal "Ver turnos" y banner de error parcial. | `materias-profesor-selector.tsx` |
| I-10 | Nombres reales: `materia_ids`, `materia_ids_invalidas`, `detalle: [{ materia_id, cantidad }]`, `pendientes_afectados`, `sin_cambios` (snake_case de Sprint 2). | Spec §2.7 |

### 11.2. Archivos

**Nuevos**
- `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.ts`: `GET` del modal (`profesores:leer`, Zod `.strict()`, 404/400).
- `src/app/(dashboard)/profesores/[id]/materias-profesor-selector.tsx`: sección Materias del modo edición, con aviso corto y "Ver turnos".
- `src/app/(dashboard)/profesores/[id]/ver-turnos-futuros-dialog.tsx`: `Dialog` informativo con la lista paginada de a 10.
- Tests: `src/server/profesores/profesor.materias.test.ts`, `src/server/profesores/actions.materias.test.ts`, `src/app/api/profesores/[id]/materias/route.test.ts`, `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.test.ts`, `src/app/(dashboard)/profesores/[id]/editar-materias.test.tsx`.

**Modificados**
- `src/server/turnos/turno.publico.ts`: + `listarTurnosFuturosDeProfesorPorMateria()` y su tipo (aditivo; nada existente cambió).
- `src/server/turnos/turno.publico.test.ts`: + 3 casos de la función nueva.
- `src/server/profesores/profesor.schema.ts`: + `ActualizarMateriasProfesorSchema`, `ListarTurnosFuturosQuerySchema`, `TURNOS_FUTUROS_POR_PAGINA`.
- `src/server/profesores/profesor.service.ts`: + `actualizarMateriasDeProfesor()` y `listarTurnosFuturosDeMateria()`.
- `src/server/profesores/actions.ts`: + `actualizarMateriasProfesor()`.
- `src/types/profesor.types.ts`: + `ResultadoActualizarMaterias`, `MateriaBloqueadaPorTurnos`, `TurnoFuturoDeMateria`, `PaginaTurnosFuturos`.
- `src/app/api/profesores/[id]/materias/route.ts`: + `PUT` (el `POST` de HU-D-03 no cambia).
- `src/app/(dashboard)/profesores/[id]/page.tsx`: opciones del selector en modo edición y banners `?actualizada=materias` / `&pendientes=N`.
- `src/app/(dashboard)/profesores/[id]/editar-profesor-form.tsx`: sección Materias, dirty state con materias y secuencia de guardado materias → datos.
- `src/app/(dashboard)/profesores/[id]/ficha-materias.tsx`: "Asociar materias" → "Editar materias" (`?modo=edicion#materias`).
- `prisma/seed.ts`: solo agregados (§11.3) y el soporte de `pendiente: true` en `TurnoSeed` / `validarDatos()`.
- `docs/specs/spec_modulo_D.md` §2.7 y `docs/specs/spec_modulo_C.md` §2.15: notas de sincronización.

### 11.3. Seed (solo agregados)
- `seed-turno-28` a `seed-turno-35`: 8 turnos de **Giménez + Matemática** (días operativos 8 a 15, 08:00, Aula 1; uno COMPLETO 10/10). Con los 3 que ya había, **Giménez tiene 11 turnos futuros de Matemática** (antes 3). Física sigue con 4.
- Profesora nueva **Herrera, Mariana** (DNI 32200022, activa, sin cuenta) con Química e **Historia de la Ciencia (inactiva)**. El listado de profesores pasa de 22 a 23 (sigue en 2 páginas de 20).
- `seed-turno-36`: **PENDIENTE de Castro + Química con profesor asignado** (sin aula ni alumnos). `TurnoSeed` suma el flag `pendiente`; `validarDatos()` lo valida con las reglas de profesor (activo, dicta la materia, dentro del horario, sin superposición) y lo excluye de las reservas.

### 11.4. Verificación

- **`tsc --noEmit`:** 0 errores. **`eslint`:** 0 errores, 0 warnings. **`next build`:** OK. **`vitest run`:** 99 archivos y 1374 tests en verde, 11 archivos y 58 tests omitidos (los `*.pg.test.ts`, sin base de prueba configurada); línea base: 94 y 1300. `prisma generate` no se corrió: el `next dev` abierto tiene tomado el motor de Prisma (EPERM) y el schema no cambió.
- **Contra la base y el servidor reales** (seed recién corrido; servicios por script, rutas por HTTP con login real; después se volvió a correr el seed para dejar la base como estaba):
  - Giménez, quitar Matemática y Física → `409` con `detalle` **11** y **4**; materias y `updatedAtProfesor` intactos (rollback). Modal: total 11, página 1 con 10, página 2 con 1; sin `seed-turno-26` ni los históricos.
  - Castro, agregar Inglés + quitar Química + quitar Física → `409` (Física, N = 1) y **nada guardado**. Quitar Matemática (solo `seed-turno-09` CANCELADO) y Química → OK con `pendientes_afectados: 1` (`seed-turno-36`); horarios 8 → 8; `seed-turno-09` sigue CANCELADO.
  - Acuña, quitar Programación I → `409` (N = 1, `seed-turno-13`, 6/15) → `cancelarTurno("seed-turno-13")` (HU-C-05) → modal en 0 → reintento OK; `seed-turno-27` (pasado) intacto.
  - Herrera: guardar sin tocar la inactiva y agregar Matemática → OK (no da `MATERIA_INACTIVA`); repetir → `sin_cambios: true`; `version` sigue en 0. Quiroga + Historia de la Ciencia → `MATERIA_INACTIVA`. Molina → `PROFESOR_INACTIVO`.
  - Concurrencia: una transacción que retiene el `FOR SHARE` de `profesorActivoDictaMateria()` durante 2 s hace esperar a la baja (termina a los 2024 ms, después de la liberación a los 2015 ms); después, `profesorActivoDictaMateria()` devuelve `false`.
  - HTTP: `GET …/turnos-futuros?pagina=2` → 1 ítem (`seed-turno-35`, 2/10); `?por_pagina=50` → 400; `PUT` a Giménez → 409 con el literal "…tiene 11 turnos futuros…"; Gerente → 403 en las dos rutas; sin sesión → 401. SSR del modo edición de Herrera con "Materias", "Historia de la Ciencia", "Inactiva" y el filtro; ficha con `?actualizada=materias&pendientes=1` muestra los dos banners y "Editar materias".

**Cobertura de los casos de §7:**

| CP | Estado | Cómo |
|---|---|---|
| 01 | ✅ | Componente (AC1) + SSR real (Herrera). Falta captura |
| 02 | ✅ | Unit + BD real (Herrera agrega Matemática) |
| 03 | ✅ | Unit + ruta + BD real (Quiroga) |
| 04 | ✅ | Unit + ruta |
| 05 | ✅ | Schema + ruta |
| 06 | ✅ | Unit + BD real (Castro, Química) |
| 07 | ✅ | BD real (Castro, Matemática con solo CANCELADO) |
| 08 | ✅ | Unit + ruta + BD real + HTTP. Con el seed nuevo, Giménez Matemática da **N = 11** (antes 3) |
| 09 | ✅ | Componente + API real. Falta captura |
| 10 | ✅ | Unit + BD real (11 y 4) |
| 11 | ✅ | Unit + BD real (Castro) |
| 12 | ◐ | Servicios reales de punta a punta; el link en pestaña nueva, por test de componente. Falta recorrerlo en navegador |
| 13 | ✅ | Unit + BD real |
| 14 | ✅ | BD real (8 → 8) |
| 15 | ✅ | Unit (conjunto vacío) |
| 16 | ✅ | Componente (orden 2.7 → 2.6, `version` precargada) |
| 17 | ✅ | Componente (banner parcial y reintento solo de datos) |
| 18 | ✅ | Componente (no se llama a 2.6) |
| 19 | ◐ | El dirty flag incluye las materias (test); el diálogo de descarte no se probó en navegador |
| 20 | ✅ | Componente (solo lectura) + BD real (`PROFESOR_INACTIVO`) |
| 21 | ✅ | Ruta + HTTP real (Gerente 403, sin sesión 401) |
| 22 | ✅ | Ruta + HTTP real |
| 23 | ✅ | Componente + API real (pág. 2) |
| 24 | ✅ | BD real + SSR + componente (Herrera) |
| 25 | ✅ | Dos transacciones reales |

### 11.5. Pendientes abiertos
1. **PO — mensaje de AC4 (D-07-1):** se usa "Materias del profesor actualizadas"; la spec §2.7 dice «Materias asignadas correctamente». Si el PO mantiene la spec, cambiar `MENSAJE_MATERIAS_ACTUALIZADAS` en `[id]/page.tsx`.
2. **PO — texto del aviso de pendientes (D-07-5):** "Atención: hay N turnos pendientes de las materias quitadas que no van a poder confirmarse con este profesor."
3. **Auditoría de las bajas (D-07-7):** el proyecto no tiene un mecanismo de eventos para el módulo D (la spec eligió la opción (a); `EventoTurno` y `EventoSeguridad` son de otros dominios). Las **altas** quedan registradas (`createdAtProfesorMateria`, `creadoPorUsuarioId`); de las **bajas** solo queda `Profesor.modificadoPorUsuarioId`/`updatedAtProfesor`, sin saber qué materia se quitó. No se creó tabla nueva; requiere decisión de PO/SM y cambio de spec.
4. **OK del responsable de Turnos** por el agregado a `src/server/turnos/turno.publico.ts`.
5. **Concurrencia entre pestañas de Mesa (D-07-4):** sin control de versión para materias, una pestaña desactualizada puede volver a asociar una materia que otra quitó. Aceptado por la spec; se deja anotado.
6. **Capturas de UI en navegador** (CP-01, 09, 12, 19) para la evidencia del PR.
7. **SP (D-07-10)** y **nota de `profesores:crear` en el backlog (D-07-11)**: administrativos, para el SM.
8. `prisma generate` no corrió por el bloqueo del `next dev` (sin cambios de schema, no hace falta).
