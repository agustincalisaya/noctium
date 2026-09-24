# TASK: HU-C-15 — Asignar aula al turno

**Módulo:** C (Turno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.3/§3.4 (Revisión 2, la que corría antes del PR #66 — ver nota abajo) · reglas 3.2, 3.4, 3.6 · eventos sección 4
**RBAC:** `turnos:asignar_aula`, exclusivo de Mesa de Entradas — confirmado en el código real.
**Schema:** migración `20260924150000_turnos_reservas_recursos_v2` (origin/develop) — agrega la tabla `reservas_turno` con exclusión GiST. Todavía no aplicada en el entorno local del Scrum Master al momento de este documento.

**Estado: IMPLEMENTADA EXTERNAMENTE, sin proceso — documentada retroactivamente (24/09/2026).**

---

## 0. Cómo se llegó a este documento

Esta HU la implementó y cerró **Emir1481** (PR #66, rama `feature/HU-C-15-asignar-aula-v2`, 3 commits del 24/09, mergeada a `origin/develop`) **sin relevamiento previo, sin este archivo, y sin que el Scrum Master la revisara**. Se detectó al arrancar el trabajo de rediseño de cupo/aula (ver `spec_modulo_C.md`, sección "cupo automático desde el aula" — en curso). Se hizo un relevamiento retroactivo con Claude Code el 24/09, contra `origin/develop` (el working tree del Scrum Master no tenía nada de esto hasta hacer `git pull`).

**Esto no es un relevamiento previo a implementar — es una auditoría de algo ya implementado y ya en `develop`.** El objetivo de este documento es: (a) dejar registro de lo que existe realmente, (b) listar los desvíos respecto a la spec y a `RULES.md`, y (c) priorizar qué se corrige antes de construir el rediseño de cupo automático encima.

---

## 1. Nota de alcance

**Importante:** el mismo PR que implementó esta HU **reescribió** `spec_modulo_C.md` §2.3/§3.4 y los 7 criterios de aceptación de HU-C-15 en `HU-Sprint-1.md` para que coincidieran con el código, sin relevamiento ni revisión (ver hallazgo D1 abajo). Este documento compara el código real contra la **Revisión 2 de la spec, la que corría antes de ese PR** — que es la versión de contrato que el equipo había acordado. La reconciliación de la spec (decidir qué queda del diseño nuevo y qué se revierte o documenta como decisión de equipo) es un paso posterior a este documento, no algo que se resuelve acá.

**Fuera de alcance de esta task (explícito):** el rediseño de "cupo automático desde la capacidad del aula" que el Scrum Master está definiendo en paralelo — ver la Revisión 3 de `spec_modulo_C.md`, todavía en curso. Esta HU, tal como quedó implementada, **no** hace eso: el cupo sigue siendo el valor manual de HU-C-03; lo único nuevo es que valida que la capacidad del aula alcance ese cupo.

---

## 2. Historia de Usuario

**Como** personal de mesa de entradas
**Necesito** asignar un aula a un turno que ya tiene fecha, hora, materia y (opcionalmente) profesor y alumnos
**Para** confirmar el turno y que pase a estar `DISPONIBLE` o `COMPLETO`

**Nota:** el PR reescribió también este "para" en `HU-Sprint-1.md` — no se registró antes de este documento cuál era el texto original ni por qué se cambió.

---

## 3. Qué existe realmente (relevamiento retroactivo, Claude Code, 24/09)

### 3.1. Rutas y servicio

- `PATCH /api/turnos/[id]/aula` → `src/app/api/turnos/[id]/aula/route.ts`. Permiso `turnos:asignar_aula`.
- **Ruta nueva, no contractualizada en la spec original:** `GET /api/turnos/aula/opciones?turno_id=` → `src/app/api/turnos/aula/opciones/route.ts`.
- **El servicio no vive en `turno.service.ts`** (donde la spec decía que debía vivir) — está en un archivo nuevo, `src/server/turnos/turno.aula.service.ts` (`asignarAulaTurno()`, `listarOpcionesAulaTurno()`), más `turno.reserva-error.ts` y dos funciones nuevas en `aula.service.ts` (`listarAulasActivasParaTurno()`, `verificarAulaActiva()`).

### 3.2. Orden entre participantes (§2.2) y aula (§2.3)

- **Backend:** orden libre — se puede asignar aula sin profesor ni alumnos; el turno queda `PENDIENTE`, mensaje "Aula asignada correctamente".
- Asignar participantes **nunca** confirma el turno por sí solo — siempre devuelve `PENDIENTE`. Si se carga el aula primero y los participantes después, hay que volver a `/turnos/[id]/aula` (que ya muestra el aula preseleccionada) y volver a confirmar.
- **Frontend:** no obliga el orden, pero lo sugiere fuerte: Configurar → "Continuar con alumno y profesor" → participantes → "Continuar con aula". `urlContinuar()` lleva a participantes si falta profesor/alumnos, si no a aula. El detalle del turno **no tiene ningún link** a la pantalla de aula — solo se llega por los botones "Continuar" o escribiendo la URL a mano.

### 3.3. Cálculo de `cupoMaximoTurno`

- **Sigue siendo 100% el valor manual de HU-C-03.** La capacidad del aula no lo calcula ni lo modifica — esto confirma que el rediseño que se viene charlando con el Scrum Master sigue siendo necesario, HU-C-15 no lo resolvió.
- Regla nueva agregada: la capacidad del aula tiene que alcanzar el cupo ya cargado.
  - `GET .../opciones` solo devuelve aulas activas con `capacidadAula >= cupoMaximoTurno`.
  - El `PATCH` responde `409 AULA_CAPACIDAD_INSUFICIENTE` si no alcanza.
  - Se agregó también `CUPO_INSUFICIENTE` para cuando hay más alumnos que cupo.
- Si se sube el cupo después de haber elegido un aula que ya no alcanza, la pantalla avisa recién al confirmar que el aula dejó de ser elegible.

### 3.4. Transición `PENDIENTE → DISPONIBLE/COMPLETO`

- Sigue ocurriendo únicamente en la asignación de aula (`turno.aula.service.ts:97-108`), dentro de una única `$transaction`. Si ya hay profesor y ≥1 alumno: `COMPLETO` si los alumnos igualan el cupo, si no `DISPONIBLE`.
- Antes de confirmar revalida: vigencia, materia activa, aula activa y su capacidad, profesor activo que dicte la materia, horario de atención del profesor, todos los alumnos activos, y superposiciones de profesor/alumnos/aula.
- **La defensa final de concurrencia quedó resuelta en Postgres** (ver 3.5) — esto es lo que la spec Revisión 2 dejaba como gap crítico pendiente.

### 3.5. Diseño de concurrencia (reemplaza lo que proponía la spec §3.4)

La spec vieja proponía `EXCLUDE USING gist` directamente sobre la tabla `turnos`, para profesor y aula, y dejaba el caso de superposición por alumno explícitamente como "relevar con el equipo" (porque un turno ahora puede tener varios alumnos, y un exclusion constraint no puede hacer join contra una tabla intermedia).

**Lo que se implementó es un diseño distinto, no decidido en equipo:** una tabla nueva `reservas_turno`, mantenida por triggers, con una exclusión GiST sobre esa tabla (en vez de sobre `turnos` directamente). Cubre profesor, aula y alumno de forma unificada. Técnicamente resuelve el problema que la spec dejaba abierto (incluido el caso de alumno, que la Revisión 2 no sabía cómo resolver) — pero es una decisión de arquitectura real que nadie evaluó ni aprobó formalmente.

### 3.6. Pantallas

- `/turnos/[id]/aula` (`page.tsx` + `aula-turno.tsx`). Redirige sin el permiso correspondiente.
  - Resumen arriba: fecha, horario, materia, profesor, alumnos inscriptos, cupo máximo, badge de estado.
  - Select "Aula *" con opciones "Nombre · Capacidad N", filtrado por lo que devuelve `GET .../opciones`.
  - Estados vacíos: "No hay aulas activas registradas" y "No hay aulas con capacidad suficiente…", ambos con "Reintentar".
  - Si el aula ya guardada dejó de ser elegible, muestra un aviso.
  - Texto de ayuda: "Si todavía faltan datos… seguirá Pendiente".
  - Botón "Guardar aula y confirmar turno" + "Cancelar" (vuelve al detalle) + "Volver al listado". Maneja `DirtyStateContext`.
  - Al confirmar: "Turno confirmado correctamente" (con badge, "Volver al listado", "Ver detalle") si terminó de transicionar; "Aula asignada correctamente" si el turno sigue `PENDIENTE`; "El turno ya está confirmado" si ya estaba confirmado.
- Puntos de entrada: éxito de `/turnos/[id]/participantes` ("Continuar con aula"), y "Continuar configuración" desde `/turnos`. **En `/turnos/[id]` (detalle) solo se ven los campos "Aula" y "Capacidad del aula", sin ninguna acción para llegar a asignarla.**

### 3.7. Tests (corridos por Claude Code en un worktree aislado de `develop`, y limpiados después)

- Componente: `aula-turno.test.tsx`, 10 tests, pasan.
- Integración con Postgres real: `turno.reservas.pg.test.ts`, 7 tests (concurrencia de aula/profesor/alumnos, turnos contiguos, altas/bajas de HU-C-04, capacidad, transiciones Disponible/Completo). **Se saltean con `npm test` normal** — exigen una env var (`HU_C15_TEST_DATABASE_URL`) igual a `DATABASE_URL`, que no está seteada por defecto. Corridos manualmente contra una base temporal: pasan los 7.
- Suite completa de `develop`: 280 pasan, 7 salteados (los mismos de arriba).
- **Faltan:** tests unitarios con mocks de `turno.aula.service.ts`, tests de validación Zod, y cualquier test de `GET .../opciones`.

### 3.8. Documentación existente

**No existe `docs/tasks/Sprint 1/HU-C-15.md`** en ninguna rama — este documento es la primera versión. La única "documentación" previa eran los cambios que el mismo PR le hizo a la spec y al backlog, sin relevamiento ni revisión.

---

## 4. Divergencias detectadas contra la Revisión 2 de la spec (pre-PR)

| # | Hallazgo | Severidad |
|---|---|---|
| D1 | Se reescribió la spec (§2.3/§3.4) y los 7 criterios de aceptación de HU-C-15 en `HU-Sprint-1.md`, incluido el "para" de la historia de usuario, sin relevamiento ni revisión | 🔴 Proceso |
| D2 | El servicio quedó en `turno.aula.service.ts`, pero la spec vieja decía "vive en `turno.service.ts`" (línea 297) — esa línea nunca se actualizó, la spec nueva se contradice a sí misma | 🟡 Documentación |
| D3 | Endpoint nuevo `GET /api/turnos/aula/opciones`, no contractualizado en ningún lado antes de este documento | 🟡 Documentación |
| D4 | Regla de negocio nueva: capacidad de aula ≥ cupo, con `AULA_CAPACIDAD_INSUFICIENTE` — no estaba en la spec ni en los criterios originales | 🟡 A ratificar |
| D5 | Validaciones nuevas no documentadas: `CUPO_INSUFICIENTE`, `MATERIA_NO_DISPONIBLE`, `PROFESOR_FUERA_DE_HORARIO`, `HORARIO_INVALIDO` — la spec vieja solo pedía "revalidar disponibilidad" en general | 🟡 A ratificar |
| D6 | Bloqueo optimista por `updatedAtTurno` con `409 TURNO_MODIFICADO`, no descripto en la spec vieja para este endpoint | 🟢 Mejora, a ratificar |
| D7 | La respuesta agrega un campo `mensaje` no contractualizado | 🟢 Menor |
| D8 | Diseño de concurrencia distinto al propuesto (tabla `reservas_turno` + GiST, en vez de `EXCLUDE` sobre `turnos`) — **resuelve el gap crítico pendiente desde HU-C-03** | ✅ **RATIFICADO por el Scrum Master (24/09).** Resuelve en un solo mecanismo lo que la spec vieja iba a necesitar tres soluciones distintas para cubrir (incluido el caso de alumno, que la Revisión 2 dejaba sin resolver). Queda como diseño definitivo — se documenta como tal en la Revisión 3 de `spec_modulo_C.md` |
| D9 | **Violación de Regla N.° 3** (aislamiento de módulos): `prisma.aula.count(...)` directo en `turno.aula.service.ts:62` y `:90`, en vez de pasar por el servicio de Aulas | 🔴 Regla violada |
| D10 | **Corrección (25/09):** `AULA_NO_DISPONIBLE` se usa en realidad para **tres** casos, no dos: aula inexistente, aula inactiva, **y** aula ocupada en ese horario (`turno.aula.service.ts:14`) — la descripción original de esta auditoría era imprecisa | 🟡 Calidad |
| D11 | **Violación de Regla N.° 2** (trazabilidad): eventos escritos con `prisma.eventoTurno.create` directo, en vez de `emitirEventoTurno()` | 🔴 Regla violada |
| D12 | El permiso `turnos:asignar_aula` se insertó desde una migración SQL, en vez del mecanismo de seed que usa el resto de los permisos | 🟡 Consistencia |
| D13 | **Tocó código fuera del alcance de esta HU, sin documentarlo:** `agregarAlumnoTurno()` (HU-C-04, ya cerrada y verificada) ahora captura conflictos de reserva; cambió la firma de `verificarMateriaActiva()` (Módulo L) | 🔴 Impacto no evaluado sobre HU cerrada |
| D14 | **Corrección (25/09):** las referencias viejas reales a "Agendado" son solo `spec_modulo_K.md:20` y `HU-Sprint-1.md:204`. `spec_modulo_K.md:14` y `HU-Sprint-1.md:210` mencionan HU-C-15 pero no dicen "Agendado" — salieron por una búsqueda imprecisa, no hace falta tocarlos. `HU-J-01.md` es una task doc ya cerrada; no se reescribe, se agrega una nota de sincronización | 🟢 Limpieza |
| D17 | **Nuevo (25/09), no era una referencia vieja sino deuda real:** el TODO de `calendario.service.ts:29` existe porque el Módulo J consulta la tabla `turnos` directamente — el Módulo C nunca expuso `listarTurnosAgendadosPorProfesor()`. HU-C-04 y HU-C-15 cerraron sin exponer ese servicio público, violación latente de Regla N.° 3 que ninguna de las dos resolvió | 🟡 Deuda técnica, documentada, fuera de alcance de esta remediación |
| D15 | La spec nueva dice "aplicada en `noctium_dev`", pero la migración `20260924150000_turnos_reservas_recursos_v2` todavía no está aplicada en el entorno local del Scrum Master — se va a aplicar al traer `develop` y migrar | 🟢 Operativo |
| D16 | UX: el botón dice "Confirmar turno" aunque falten datos; no hay forma de llegar a la pantalla de aula desde el detalle del turno | 🟡 UX |

---

## 5. Plan de remediación (antes de construir el rediseño de cupo automático)

Orden acordado con el Scrum Master (24/09):

1. **Arreglar D9 y D11** (violaciones de Regla N.° 3 y N.° 2) — se resuelven en el equipo (Claude Code), no requieren decisión de negocio.
2. **Revisar impacto no documentado sobre HU-C-04** (D13) — re-verificar en navegador con Chrome que `agregarAlumnoTurno()` sigue comportándose como se verificó y cerró en su momento, ahora con la captura de conflictos de reserva agregada.
3. **Ratificar o ajustar el diseño de `reservas_turno` + GiST** (D8) — evaluación técnica, ver explicación aparte.
4. Limpieza menor: D10, D12, D14, D16.
5. **Recién después**, construir el rediseño de cupo automático desde la capacidad del aula (que cambia el orden del flujo: turno → aula → participantes) sobre esta base ya corregida.

D1 a D7 y D15 quedan como registro histórico de este documento — no requieren una acción de código, salvo D2/D3/D4/D5/D6/D7 que se van a reconciliar de una sola vez cuando se escriba la Revisión 3 de `spec_modulo_C.md` (que ya va a incluir el cambio de cupo automático).

---

## 6. Checklist de Definition of Done (auditoría retroactiva)

- [x] Relevamiento retroactivo completo (esta sección 3).
- [x] Divergencias contra la spec documentadas (sección 4).
- [ ] D9 (Regla N.° 3) corregida.
- [ ] D11 (Regla N.° 2) corregida.
- [ ] Impacto sobre HU-C-04 re-verificado en navegador.
- [x] Diseño de `reservas_turno` + GiST ratificado por el Scrum Master (24/09) — queda como diseño definitivo.
- [ ] Limpieza menor (D10, D12, D14, D16).
- [ ] Tests unitarios con mocks de `turno.aula.service.ts` y de `GET .../opciones` (faltan hoy).
- [ ] Spec reconciliada (Revisión 3, en conjunto con el rediseño de cupo automático).