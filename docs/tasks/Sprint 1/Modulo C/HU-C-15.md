# TASK: HU-C-15 — Asignar aula al turno

**Módulo:** C (Turno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.3/§3.4 (Revisión 2, la que corría antes del PR #66 — ver nota abajo) · reglas 3.2, 3.4, 3.6 · eventos sección 4
**RBAC:** `turnos:asignar_aula`, exclusivo de Mesa de Entradas — confirmado en el código real.
**Schema:** migración `20260924150000_turnos_reservas_recursos_v2` (origin/develop) — agrega la tabla `reservas_turno` con exclusión GiST. Todavía no aplicada en el entorno local del Scrum Master al momento de este documento.

**Estado: IMPLEMENTADA EXTERNAMENTE, sin proceso — documentada retroactivamente (24/09/2026), REMEDIADA (D9-D16, 25/09/2026) — REABIERTA (24/09/2026) por el rediseño de cupo automático de la Revisión 3 de `spec_modulo_C.md` — REDISEÑO IMPLEMENTADO Y VERIFICADO EN NAVEGADOR (24-25/09/2026), ver §6.3.**

> **Nota de reapertura (Revisión 3, 24/09/2026, histórica):** por pedido explícito del cliente, aprobado por el PO (ver `propuesta-cambio-cupo-aula.md`), esta operación pasa a ser el **segundo paso del flujo** (antes era el último, confirmaba el turno) y deja de validar contra un cupo preexistente — **lo fija automáticamente** a partir de `capacidadAula`. La confirmación del turno (transición a `Disponible`/`Completo`) se mueve a HU-C-04 (§2.2). Se agrega una validación nueva para reasignar aula con alumnos ya cargados (capacidad insuficiente). Todo lo documentado en las secciones 0-6 de este archivo describe el relevamiento retroactivo y la remediación tal como se cerraron contra la Revisión 2 de la spec; el contrato vigente para esta HU es el de `spec_modulo_C.md` §2.3 (Revisión 3). **Esta reapertura ya está resuelta e implementada — ver §6.3 para la evidencia final del relevamiento, la implementación y la verificación en navegador.**

---

## 0. Cómo se llegó a este documento

Esta HU la implementó y cerró **Emir1481** (PR #66, rama `feature/HU-C-15-asignar-aula-v2`, 3 commits del 24/09, mergeada a `origin/develop`) **sin relevamiento previo, sin este archivo, y sin que el Scrum Master la revisara**. Se detectó al arrancar el trabajo de rediseño de cupo/aula (ver `spec_modulo_C.md`, sección "cupo automático desde el aula" — en curso). Se hizo un relevamiento retroactivo con Claude Code el 24/09, contra `origin/develop` (el working tree del Scrum Master no tenía nada de esto hasta hacer `git pull`).

**Esto no es un relevamiento previo a implementar — es una auditoría de algo ya implementado y ya en `develop`.** El objetivo de este documento es: (a) dejar registro de lo que existe realmente, (b) listar los desvíos respecto a la spec y a `RULES.md`, y (c) priorizar qué se corrige antes de construir el rediseño de cupo automático encima.

---

## 1. Nota de alcance

**Importante:** el mismo PR que implementó esta HU **reescribió** `spec_modulo_C.md` §2.3/§3.4 y los 7 criterios de aceptación de HU-C-15 en `HU-Sprint-1.md` para que coincidieran con el código, sin relevamiento ni revisión (ver hallazgo D1 abajo). Este documento compara el código real contra la **Revisión 2 de la spec, la que corría antes de ese PR** — que es la versión de contrato que el equipo había acordado. La reconciliación de la spec (decidir qué queda del diseño nuevo y qué se revierte o documenta como decisión de equipo) es un paso posterior a este documento, no algo que se resuelve acá.

**Fuera de alcance de esta task (explícito):** el rediseño de "cupo automático desde la capacidad del aula" que el Scrum Master está definiendo en paralelo — ver la Revisión 3 de `spec_modulo_C.md`, ya escrita (ver nota de reapertura al inicio del documento). Esta HU, tal como quedó implementada y documentada en las secciones 3-6 de este archivo, **no** hace eso: el cupo seguía siendo el valor manual de HU-C-03; lo único que había de nuevo era que validaba que la capacidad del aula alcanzara ese cupo. Eso cambia en la Revisión 3, ver nota de reapertura.

---

## 2. Historia de Usuario

**Como** personal de mesa de entradas
**Necesito** asignar un aula a un turno que ya tiene fecha, hora, materia y (opcionalmente) profesor y alumnos
**Para** confirmar el turno y que pase a estar `DISPONIBLE` o `COMPLETO`

**Nota:** el PR reescribió también este "para" en `HU-Sprint-1.md` — no se registró antes de este documento cuál era el texto original ni por qué se cambió. **Nota adicional (Revisión 3):** este "para" también queda desactualizado por la reapertura — asignar aula ya no confirma el turno, eso pasó a HU-C-04.

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
| D8 | Diseño de concurrencia distinto al propuesto (tabla `reservas_turno` + GiST, en vez de `EXCLUDE` sobre `turnos`) — **resuelve el gap crítico pendiente desde HU-C-03** | ✅ **RATIFICADO por el Scrum Master (24/09).** Resuelve en un solo mecanismo lo que la spec vieja iba a necesitar tres soluciones distintas para cubrir (incluido el caso de alumno, que la Revisión 2 dejaba sin resolver). Queda como diseño definitivo — documentado en la Revisión 3 de `spec_modulo_C.md` |
| D9 | **Violación de Regla N.° 3** (aislamiento de módulos): `prisma.aula.count(...)` directo en `turno.aula.service.ts:62` y `:90`, en vez de pasar por el servicio de Aulas | 🔴 Regla violada |
| D10 | **Corrección (25/09):** `AULA_NO_DISPONIBLE` se usa en realidad para **tres** casos, no dos: aula inexistente, aula inactiva, **y** aula ocupada en ese horario (`turno.aula.service.ts:14`) — la descripción original de esta auditoría era imprecisa | 🟡 Calidad |
| D11 | **Violación de Regla N.° 2** (trazabilidad): eventos escritos con `prisma.eventoTurno.create` directo, en vez de `emitirEventoTurno()` | 🔴 Regla violada |
| D12 | El permiso `turnos:asignar_aula` se insertó desde una migración SQL, en vez del mecanismo de seed que usa el resto de los permisos | 🟡 Consistencia |
| D13 | **Tocó código fuera del alcance de esta HU, sin documentarlo:** `agregarAlumnoTurno()` (HU-C-04, ya cerrada y verificada) ahora captura conflictos de reserva; cambió la firma de `verificarMateriaActiva()` (Módulo L) | 🔴 Impacto no evaluado sobre HU cerrada |
| D14 | **Corrección (25/09):** las referencias viejas reales a "Agendado" son solo `spec_modulo_K.md:20` y `HU-Sprint-1.md:204`. `spec_modulo_K.md:14` y `HU-Sprint-1.md:210` mencionan HU-C-15 pero no dicen "Agendado" — salieron por una búsqueda imprecisa, no hace falta tocarlos. `HU-J-01.md` es una task doc ya cerrada; no se reescribe, se agrega una nota de sincronización | 🟢 Limpieza |
| D17 | **Nuevo (25/09), no era una referencia vieja sino deuda real:** el TODO de `calendario.service.ts:29` existe porque el Módulo J consulta la tabla `turnos` directamente — el Módulo C nunca expuso `listarTurnosAgendadosPorProfesor()`. HU-C-04 y HU-C-15 cerraron sin exponer ese servicio público, violación latente de Regla N.° 3 que ninguna de las dos resolvió | 🟡 Deuda técnica, documentada, fuera de alcance de esta remediación |
| D15 | La spec nueva dice "aplicada en `noctium_dev`", pero la migración `20260924150000_turnos_reservas_recursos_v2` todavía no está aplicada en el entorno local del Scrum Master — se va a aplicar al traer `develop` y migrar | 🟢 Operativo |
| D16 | UX: el botón dice "Confirmar turno" aunque falten datos; no hay forma de llegar a la pantalla de aula desde el detalle del turno | 🟡 UX |
| D18 | **Nuevo (24/09, hallado en verificación de D13):** "Fecha de creación" y "Última actualización" en el detalle del turno muestran hora sin formato de 24 horas / sin indicador a.m./p.m. correcto | 🟢 UX, fuera de esta remediación |
| D19 | **Nuevo (24/09):** "Usuario responsable" y "Modificado por" en el detalle muestran el id del usuario en vez de su nombre o email | 🟢 UX, fuera de esta remediación |
| D20 | **Nuevo (24/09):** el badge de estado "Disponible" en el mensaje de confirmación es poco legible (verde sobre fondo verde) | 🟢 UX, fuera de esta remediación |
| D21 | **Nuevo (24/09):** el primer clic en "Guardar aula" a veces no responde (aparenta ser una condición de carrera entre la automatización del click y la habilitación del botón) — a confirmar si reproduce con interacción humana normal antes de tratarlo como bug real | 🟡 A confirmar, fuera de esta remediación |

---

## 5. Plan de remediación (antes de construir el rediseño de cupo automático)

Orden acordado con el Scrum Master (24/09):

1. **Arreglar D9 y D11** (violaciones de Regla N.° 3 y N.° 2) — se resuelven en el equipo (Claude Code), no requieren decisión de negocio.
2. **Revisar impacto no documentado sobre HU-C-04** (D13) — re-verificar en navegador con Chrome que `agregarAlumnoTurno()` sigue comportándose como se verificó y cerró en su momento, ahora con la captura de conflictos de reserva agregada.
3. **Ratificar o ajustar el diseño de `reservas_turno` + GiST** (D8) — evaluación técnica, ver explicación aparte.
4. Limpieza menor: D10, D12, D14, D16.
5. **Recién después**, construir el rediseño de cupo automático desde la capacidad del aula (que cambia el orden del flujo: turno → aula → participantes) sobre esta base ya corregida. **Esto ya está en curso: la Revisión 3 de `spec_modulo_C.md` está escrita — ver nota de reapertura al inicio de este documento. Falta la implementación de código.**

D1 a D7 y D15 quedan como registro histórico de este documento — no requieren una acción de código, salvo D2/D3/D4/D5/D6/D7 que se reconciliaron de una sola vez al escribir la Revisión 3 de `spec_modulo_C.md` (que ya incluye el cambio de cupo automático).

---

## 6. Checklist de Definition of Done (auditoría retroactiva)

- [x] Relevamiento retroactivo completo (esta sección 3).
- [x] Divergencias contra la spec documentadas (sección 4).
- [x] D9 (Regla N.° 3) corregida — `hayAulasActivas()`/`existeAula()` en `aula.service.ts`, ya no hay consulta directa a `prisma.aula` desde Turno.
- [x] D11 (Regla N.° 2) corregida — eventos vía `emitirEventoTurno()`, mismos payloads, después del commit.
- [x] Impacto sobre HU-C-04 re-verificado en navegador (D13) — verificado 24/09, ver sección 6.2.
- [x] Diseño de `reservas_turno` + GiST ratificado por el Scrum Master (24/09) — queda como diseño definitivo.
- [x] Limpieza menor corregida: D10 (tres códigos de error separados: `AULA_NO_ENCONTRADA`/`AULA_INACTIVA`/`AULA_NO_DISPONIBLE`), D12 (permiso `turnos:asignar_aula` agregado al seed), D14 (terminología "Agendado"→"Disponible/Completo" en `spec_modulo_K.md`, `HU-Sprint-1.md`, nota de sincronización en `HU-J-01.md`), D16 (botón condicional "Guardar aula"/"Guardar aula y confirmar turno" + link "Asignar o cambiar aula" en el detalle, gateado por permiso).
- [x] Tests unitarios con mocks de `turno.aula.service.ts` y de `GET .../opciones` — agregados durante la implementación de la Revisión 3 (`turno.aula.test.ts`, 9 tests; `turno.profesor.test.ts`, 5 tests), como parte natural de reescribir estos servicios para el nuevo flujo. Ver §6.3.
- [x] Spec reconciliada (Revisión 3, en conjunto con el rediseño de cupo automático) — **escrita el 24/09, y actualizada el 25/09 con los ajustes que dejó la implementación real** (`turno_id` opcional en las opciones de aula, caso inalcanzable de `AULA_CAPACIDAD_INSUFICIENTE`, formato de respuesta y nombres reales de archivo del endpoint de profesores, revalidaciones agregadas en la confirmación, módulo `turno.disponibilidad.ts`, limitación de Turbopack). **Implementación de código de la Revisión 3 completa y verificada en navegador — ver §6.3.**

### 6.1. Evidencia de la remediación (25/09/2026)

Rama `fix/HU-C-15-remediacion`, PR mergeado a `develop`.

- `tsc`, `eslint` y `build`: sin errores.
- Vitest: 282/289 tests pasando (7 de integración contra Postgres real, salteados por defecto — confirmados pasando manualmente contra una base temporal `noctium_c15_remed`), más 2 tests de componente nuevos (caso "aula sin alumnos" y link condicionado por permiso).
- **No verificado en esta remediación:** el código HTTP 404 real de `AULA_NO_ENCONTRADA` contra el servidor corriendo, y las pantallas en navegador (botón condicional, link nuevo en el detalle) — esto es D13/6.2 abajo, todavía pendiente.

### 6.2. D13 — impacto sobre HU-C-04, verificado en navegador (24/09/2026, Scrum Master vía Chrome)

Se armaron dos turnos de prueba superpuestos en `noctium_dev` (Turno 1 `cmufvqpdt0001uwbksz9kamua`, 05/10 09:00-10:00; Turno 2 `cmufvvbzu0008uwbknzwqmh49`, 05/10 09:30-10:30) y se recorrió el flujo completo:

- Aula asignada primero (Turno 1, Pendiente) → detalle muestra el link nuevo "Asignar o cambiar aula" (D16) → botón dice "Guardar aula" mientras falten datos (D16) → se cargó profesor y alumno vía HU-C-04 sin ningún cambio de comportamiento respecto a lo ya verificado y cerrado → botón cambia a "Guardar aula y confirmar turno" (D16) → al guardar, turno pasa a Disponible, se crean 3 filas en `reservas_turno` (aula, profesor, alumno) y se emite `turno:disponibilizado`.
- Conflicto real probado sobre el Turno 2 (superpuesto): mismo profesor → bloqueado con "El profesor ya tiene un turno agendado de 09:00 a 10:00"; misma aula → bloqueado con "El aula ya tiene un turno confirmado en ese horario". El Turno 1 no se vio afectado por ninguno de los dos intentos (mismo estado, mismas reservas, sin eventos nuevos); el Turno 2 quedó sin cambios (Pendiente, sin reservas).
- Verificación cruzada contra la base (solo lectura): coincide con lo mostrado en pantalla.

**Conclusión: D13 cerrado, sin regresiones sobre HU-C-04, el diseño de concurrencia funciona como se esperaba end-to-end.** Los datos de prueba quedaron en `noctium_dev` (se regeneran con el seed, no hace falta borrarlos a mano) — el Turno 1 ocupa a Giménez, Laura, al alumno González y el Aula 2 el 05/10 de 09:00 a 10:00; tenerlo en cuenta si se sigue probando en ese entorno.

Hallazgos nuevos encontrados durante esta verificación, sin relación con la remediación, catalogados como D18-D21 (sección 4) — quedan pendientes de decisión, no se tocan en este workstream.

### 6.3. Rediseño de cupo automático (Revisión 3) — relevamiento, implementación y verificación en navegador (24-25/09/2026)

**Relevamiento previo con Claude Code:** 5 hallazgos (H1-H5) y 9 decisiones (D1-D9), todos revisados por el Scrum Master con recomendación explícita antes de autorizar la implementación:
- H1 — `turno_id` opcional en `GET /api/turnos/aula/opciones` (la pantalla fusionada necesita listar aulas antes de que exista el turno).
- H2 — cuatro responsabilidades se mueven de `turno.aula.service.ts` a `asignarParticipantesTurno()` (revalidación de aula, el try/catch de conflicto GiST y su mapeo de mensajes, los eventos `turno:disponibilizado`/`turno:completado`, y una corrección de `===` a `>=` en la comparación de cupo); el `UPDATE` de `estadoTurno` debe ejecutarse después del `createMany` de `TurnoAlumno` por cómo lee el trigger de `reservas_turno`.
- H3 — `AULA_CAPACIDAD_INSUFICIENTE` queda inalcanzable en el flujo normal de esta revisión (un turno `PENDIENTE` nunca tiene alumnos confirmados). D8: se implementa igual, como defensa en profundidad, documentado como tal.
- H4 — migración aditiva (`DROP NOT NULL`), sin `migrate reset`.
- H5 — el seed necesitaba realinearse (D5): cupos de turnos confirmados no coincidían con la capacidad real de su aula.
- D1-D9 completas: `turno_id` opcional (sí), aula opcional al guardar en la pantalla fusionada (sí), eliminar la ruta `[id]/aula` sin redirect (sí), "Sin asignar" para cupo/alumnos sin aula (sí), alinear seed (sí), eliminar el endpoint viejo de profesores sin otros consumidores (sí, confirmado sin uso), mismo formato de respuesta que aula para el endpoint nuevo (sí), implementar la validación inalcanzable igual (sí), migración sin reset (sí).

**Implementación completa** (backend + frontend + migración), verificada en los tres niveles:
- Nivel 1 (unitarios): 296 tests en verde, incluidos los 9 nuevos de `turno.aula.test.ts`, 5 de `turno.profesor.test.ts` y 6 de `turno-configuracion.test.tsx`.
- Nivel 2 (Postman/curl) y Nivel 3 (Postgres real): 8 pruebas de integración contra base real + verificación por curl y SQL directo, todas en verde.
- `tsc --noEmit`, `eslint` y `build` sin errores.

**Ocho ajustes sobre la marcha, reportados y aprobados:**
1. Módulo compartido nuevo `src/server/turnos/turno.disponibilidad.ts` (helpers de superposición), para evitar un import circular con `turno.service.ts`.
2. `404 SIN_PROFESORES_PARA_MATERIA` reservado solo para "cero profesores activos para la materia", distinto de "lista vacía por horario" (mismo patrón que `SIN_AULAS_ACTIVAS`).
3. La confirmación (§2.2) revalida también `MATERIA_NO_DISPONIBLE` y `AULA_INACTIVA`, preservando garantías que antes se chequeaban en otros pasos.
4. La migración generada incluía un drop/re-add de FK no relacionado (deuda preexistente de `schema.prisma` vs. la base real) — se sacó de la migración para no mezclar scope; queda como deuda técnica separada, a resolver alineando la anotación de la relación en `schema.prisma`, no generando otra migración.
5. Caché `.next/dev/types` borrada (se regenera sola).
6. Respuesta de `PATCH .../aula` ajustada exactamente al shape de la spec (sin campo `mensaje` extra).
7. Algunos mensajes de conflicto de reserva de profesor omiten el horario cuando el conflicto se detecta en el catch de `reservas_turno` en vez del pre-chequeo (la base no expone el horario en ese punto) — catalogado, no bloqueante.
8. Textos y condiciones del botón del detalle del turno ajustados al nuevo orden de pasos ("Modificar configuración y asignar aula" / "Modificar configuración o aula" / "Asignar profesor y alumnos" solo si ya hay aula).

**Verificación en navegador por el Scrum Master (24-25/09/2026) — 10 puntos de aceptación, 9 confirmados en la primera pasada:**
1. ✅ Sin campo de cupo en `/turnos/nuevo`; sección de aula grisada hasta completar fecha/hora/materia.
2. ✅ Cupo mostrado como texto de solo lectura ("Cupo máximo: N alumnos"), no como input.
3. ✅ Guardado sin aula: "Turno configurado · Sin aula asignada · Pendiente"; reintento y recarga no duplican el turno.
4. ✅ Detalle de un turno pendiente sin aula: solo "Modificar configuración y asignar aula"; Cupo y Aula en "Sin asignar".
5. ✅ Asignación de aula en edición: cupo se fija a la capacidad del aula; detalle pasa a ofrecer "Asignar profesor y alumnos".
6. ✅ Resumen de solo lectura visible en la pantalla de participantes; selector de profesor filtrado por disponibilidad (turno a las 09:30 ofreció solo a un profesor libre, el que tenía conflicto no apareció).
7. ✅ Confirmación con cupo exacto → Completo; con cupo mayor a los inscriptos → Disponible.
8. ✅ Listado: turno pendiente sin aula muestra "Sin asignar" en Alumnos inscriptos; "Continuar configuración" lleva a la pantalla de aula, no a participantes.
9. ❌ con Turbopack (`npm run dev`) / ✅ con webpack — alta/baja individual (2.5): `DELETE /api/turnos/[id]/alumnos/[alumnoId]` respondía la página 404 de Next solo bajo Turbopack, causado por la existencia de la nueva carpeta `api/turnos/profesores/` (2.6). Confirmado que **no es un bug de código** — funciona con `next dev --webpack` y en el build de producción. Se aisló probando: (a) con webpack, la ruta funciona; (b) con Turbopack pero sacando temporalmente la carpeta nueva, la ruta vuelve a funcionar. **Decisión (Scrum Master):** no mover el endpoint nuevo a la URL vieja liberada por D6 (hubiera evitado el síntoma pero es un cambio de contrato para trabajar alrededor de una causa no diagnosticada, y no afecta producción) — en cambio, se documentó el workaround `next dev --webpack` en `README.md` ("Puesta en marcha", paso 8, y en la tabla de scripts). Código de la aplicación sin cambios por este punto.
10. ✅ Ruta vieja `/turnos/[id]/aula` responde 404 sin redirect (confirma D3).

**Hallazgos menores catalogados, no corregidos (misma bolsa que D18-D21, futura ventana de bugfixing):** contraste bajo del badge "Disponible" (verde) sobre el fondo verde del mensaje de éxito; el formulario de un turno de seed muestra la hora de fin calculada con la duración estándar vigente en vez de la guardada (comportamiento preexistente a HU-C-03, no de esta revisión).

**Estado de la base de desarrollo:** se ejecutó `npx prisma migrate reset --force` durante el troubleshooting de un lock de Postgres (advisory-lock timeout por un proceso `prisma migrate dev` colgado) — consentimiento explícito del Scrum Master, sin pérdida de datos relevante (Sprint 1, sin datos productivos). Quedaron dos turnos de prueba en `noctium_dev` (uno Completo 3/3 en Sala grupal, otro Disponible en Aula 2), se pueden borrar o dejar para el próximo reset.

**Sin commit ni `git add`** — cambios en el working directory, PR pendiente de armar en conjunto con HU-C-03 y HU-C-04 (un único PR cruzando las tres HU del rediseño). Descripción de PR a cargo del Scrum Master.