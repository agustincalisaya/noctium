# TASK: HU-C-16 — Mostrar aulas disponibles según horario

**Módulo:** C (Gestionar turnos)

**Sprint:** 2

**Contrato de referencia:** `docs/specs/spec_modulo_C.md` 2.3 (Revisión 5) y `docs/tasks/Sprint 2/HU-Sprint-2.md` 9

**RBAC:** `turnos:asignar_aula`, existente

**Schema:** existente; sin migración prevista

---

## 0. Relevamiento previo a implementación

### Alcance contractual y antecedente

HU-C-16 tiene cinco criterios en `HU-Sprint-2.md` §9. La nota de Revisión 5 de `spec_modulo_C.md` §2.3 afirma que AC1–AC4 ya están cubiertos por HU-C-15 y que AC5 solo cambia Aula al cuarto paso. El código actual **no confirma por completo esa afirmación**: la asignación revalida el aula, pero el listado de opciones no filtra conflictos horarios. HU-C-15 documenta el rediseño de cupo automático ya implementado, así como el modo sin `turno_id`; su descripción histórica de la Revisión 2 y algunas evidencias antiguas no reemplazan la spec vigente.

### Evidencia del código relevado

| Archivo | Estado observado |
|---|---|
| `src/server/turnos/turno.aula.service.ts` | `listarOpcionesAulaTurno(turnoId?)` exige turno `PENDIENTE` cuando hay id, calcula capacidad mínima según alumnos y llama a `hayAulasActivas()` y `listarAulasActivasParaTurno()`. **No lee fecha, hora ni duración del turno y no excluye aulas con turnos superpuestos.** `asignarAulaTurno()` sí revalida vigencia, materia, aula activa, capacidad y conflicto mediante `aulaConTurnoSuperpuesto()` antes del `UPDATE` transaccional; fija el cupo desde el aula y emite `turno:aula_asignada` después del commit. |
| `src/server/turnos/turno.aula.test.ts` | Cubre alta sin turno, capacidad mínima, turno inexistente/no pendiente, falta de aulas activas y rechazo de un aula ocupada al asignar, incluidos intervalos contiguos. **No prueba que el listado excluya aulas ocupadas**, ni `data: []` por conflicto, ni `CANCELADO` con su código propio. |
| `src/app/api/turnos/aula/opciones/route.ts` | Ya usa `withPermission("turnos:asignar_aula")`, delega al servicio y responde `{ data, error }`. Conserva el modo sin `turno_id`. El servicio devuelve opciones sin filtrado horario, por lo que la ruta también. |
| Tests de `GET /api/turnos/aula/opciones` | No hay un test de Route Handler en el árbol actual. La afirmación retrospectiva de HU-C-15 §6 de que se agregaron tests de ese GET no coincide con los archivos actuales; `turno.aula.test.ts` prueba el servicio, no la ruta. |
| `src/server/aulas/aula.publico.ts` | `listarAulasActivasParaTurno()` devuelve `{ id, nombre, capacidad }` de aulas activas con capacidad suficiente. No conoce turnos ni conflictos, correctamente por aislamiento de dominio (Regla N.° 3). |
| `src/server/turnos/turno.disponibilidad.ts` | Ya existe `aulaConTurnoSuperpuesto()`, que consulta turnos propios del módulo C en estados `DISPONIBLE`/`COMPLETO` y reutiliza el criterio de intervalos semiabiertos. Se puede reutilizar al filtrar opciones, sin duplicar la regla ni consultar tablas internas de Aulas. |
| `src/app/(dashboard)/turnos/seccion-aula-turno.tsx` | El select muestra `nombre · Capacidad N` y el cupo derivado. Si `aulas.length === 0` dice «No hay aulas con capacidad para los alumnos ya inscriptos en este turno» y solo ofrece «Reintentar»; no muestra el texto contractual ni la acción para volver a fecha/horario. Distingue `SIN_AULAS_ACTIVAS` con otro mensaje. |
| `src/app/(dashboard)/turnos/turno-configuracion.tsx` | La pantalla sigue fusionando configuración y aula. En alta pide opciones **sin `turno_id`** antes de crear el turno, aunque ya haya fecha/hora elegidas; en edición pide opciones con id. Tras crear el turno no vuelve a consultar opciones con el id nuevo. No hay pasos ni navegación al paso 3. |
| `src/app/(dashboard)/turnos/turno-configuracion.test.tsx` | Verifica nombre/capacidad, cupo, guardado con y sin aula, reintento de `PATCH`, precarga en edición y `SIN_AULAS_ACTIVAS`. Afirma el GET sin id en alta. No cubre lista vacía por ocupación, el texto contractual ni retorno a fecha/horario. |
| `docs/tasks/Sprint 1/HU-C-15.md` | Registra la implementación y remediación de la asignación de aula, el modo de opciones sin id y el cupo automático. Su §3 y parte de §6 contienen historia de revisiones anteriores; §6.3 deja constancia de la implementación final de Sprint 1. |

### Criterios de aceptación contra el estado real

| AC | Satisfecho | Pendiente real |
|---|---|---|
| 1. Solo aulas activas sin turno `DISPONIBLE`/`COMPLETO` superpuesto | **Parcial.** El servicio público de Aulas filtra activas y capacidad; el `PATCH` rechaza superposición. | El GET con `turno_id` debe excluir aulas ocupadas en el intervalo real del turno. Probar ocupados, contiguos, estados no bloqueantes y duración variable. |
| 2. Nombre/número y capacidad | **Sí.** La opción pública entrega `nombre` y `capacidad`; el select los presenta. | Solo verificación de regresión. El código usa `nombre`; no hay un campo separado de «número» en este contrato. |
| 3. Lista vacía y vuelta a fecha/horario | **No.** Hay un estado vacío, pero con otro texto y solo «Reintentar». | Distinguir `200 data: []` de `404 SIN_AULAS_ACTIVAS`, mostrar «No hay aulas disponibles para este horario» y ofrecer una acción de regreso. La navegación literal al paso 3 depende del wizard de HU-C-18. |
| 4. Revalidar al confirmar | **Sí para asignar aula.** El `PATCH` revalida disponibilidad y la confirmación de participantes vuelve a verificar recursos; `reservas_turno` defiende la concurrencia final. | Verificar con tests de regresión; no reescribir la lógica. |
| 5. Mismo contenido, Aula en cuarto paso | **Mecanismo de aula existente; posición pendiente.** | La reorganización del wizard completo, incluido el cuarto paso, pertenece a HU-C-18 (§10 del backlog). No adelantarla en C-16. |

### Archivos exactos para una implementación acotada de C-16

**Existentes a modificar:**

1. `src/server/turnos/turno.aula.service.ts`: al recibir `turnoId`, obtener fecha/hora/duración del turno y filtrar las opciones activas por conflictos con turnos del módulo C, reutilizando `aulaConTurnoSuperpuesto()` o el helper compartido. Preservar el modo sin id y el filtro de capacidad. Distinguir `CANCELADO` si se aplica el error que ya exige §2.3.
2. `src/server/turnos/turno.aula.test.ts`: cubrir el filtrado anterior y sus bordes, la lista vacía válida y los códigos de estado del turno. Conservar pruebas de asignación existentes.
3. `src/app/(dashboard)/turnos/seccion-aula-turno.tsx`: adecuar el estado vacío por horario y exponer una acción de regreso sin incorporar el orden de cinco pasos aquí.
4. `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`: verificar el texto vacío y la acción disponible en la pantalla actual, sin afirmar el orden del wizard futuro.

**Archivo nuevo justificado:**

1. `src/app/api/turnos/aula/opciones/route.test.ts`: verificar permiso, shape `200` con opciones y con `data: []`, y traducción de errores existentes. No hay cobertura HTTP actual.

**Archivo a evaluar solo si se decide cerrar AC1 en el alta fusionada antes de HU-C-18:** `src/app/(dashboard)/turnos/turno-configuracion.tsx`. Hoy pide aulas sin id y no refresca luego de crear el turno. La spec Revisión 5 supone que el turno ya existe al entrar en Aula. Para garantizar opciones filtradas en esta UI antes del reordenamiento habría que cambiar cuándo se persiste/consulta; eso afecta el flujo de HU-C-03 y se superpone con HU-C-18. No asumir este cambio sin decisión de alcance.

**Sin necesidad detectada de crear** un service, schema, Route Handler, modelo Prisma o migración nuevos. `src/app/api/turnos/aula/opciones/route.ts` y `src/app/api/turnos/[id]/aula/route.ts` no requieren cambios para filtrar: la regla debe vivir en el servicio (Regla N.° 4). Conservar `turnos:asignar_aula`, `{ data, error }` y los contratos públicos de Aulas (Reglas N.° 3, 5 y 10).

### Trabajo de HU-C-18 que no corresponde implementar en C-16

HU-C-18 es dueña del orden Materia → Profesor → Fecha y Horario → Aula → Alumnos; de convertir el formulario fusionado en pasos; de persistir el turno al confirmar el paso 3; de entrar a Aula siempre con `turno_id`; y de la navegación «Atrás» al paso 3 con conservación o invalidación de elecciones. C-16 debe dejar lista y comprobada la disponibilidad de aulas que ese paso consumirá, sin reestructurar el wizard ni alterar sus otros pasos.

### Divergencias y punto a decidir antes de implementar

1. **Spec vs. código:** §2.3 afirma que el GET con id ya filtra por disponibilidad, pero `listarOpcionesAulaTurno()` no consulta ocupaciones. Es trabajo real de C-16, aunque la nota de Revisión 5 lo presente como terminado en HU-C-15.
2. **Spec interna:** §2.3 preserva expresamente `turno_id` opcional y a la vez enumera `400` por `turno_id` ausente. El código acepta su ausencia, como indica la regla explícita y HU-C-15; no cambiar ese contrato por la línea contradictoria de errores sin decisión del equipo.
3. **Backlog/spec vs. UI:** el estado vacío actual habla de capacidad, no de disponibilidad horaria, y no ofrece volver a fecha/horario. La posición y la navegación entre pasos son de C-18.
4. **Estado `CANCELADO`:** §2.3 pide `409 TURNO_CANCELADO`; el servicio actual agrupa cualquier estado distinto de `PENDIENTE` como `TURNO_YA_DISPONIBLE`. Confirmar si esa corrección se incluye al cerrar C-16 o se tramita como ajuste independiente de §2.3.
5. **Pregunta concreta de alcance:** ¿se acepta que C-16 cierre el filtrado del GET y el mensaje del estado vacío, dejando para C-18 el uso obligatorio de `turno_id` en el alta y el botón real «Volver al paso 3»? De lo contrario, C-16 tendría que cambiar la secuencia de persistencia de la pantalla fusionada, trabajo que el backlog asigna a C-18.

**Estado final de la sección 0:** relevamiento revisado y aprobado. La tabla y los hallazgos anteriores conservan el estado observado **antes** de implementar backend. La decisión posterior fue corregir AC1 en C-16, limitar AC3 al mensaje en esta HU, y dejar la navegación y el cuarto paso a HU-C-18. Se aprobó conservar `turno_id` opcional y no corregir `TURNO_CANCELADO` en esta etapa. La etapa backend ya fue implementada y aprobada; se documenta abajo.

---

## 1. Nota de alcance aprobado

- **AC1:** C-16 corrige el filtrado de aulas ocupadas en las opciones consultadas con `turno_id`.
- **AC2:** nombre/número y capacidad ya estaban cubiertos por HU-C-15; se preservan.
- **AC3:** C-16 muestra exactamente «No hay aulas disponibles para este horario» cuando la lista de opciones está vacía. La navegación real de vuelta al paso Fecha y Horario queda para HU-C-18.
- **AC4:** la revalidación al asignar/confirmar ya estaba implementada por HU-C-15; se verificó con los tests existentes y no se reimplementó.
- **AC5:** el cuarto paso y el reordenamiento completo del wizard pertenecen a HU-C-18.

El modo sin `turno_id` sigue siendo contractual. No se cambia la secuencia del alta fusionada ni se adelanta la integración del wizard de HU-C-18.

## 2. Historia de usuario

**Como** personal de mesa de entrada, **necesito** ver las aulas libres para la fecha y horario elegidos, **para** seleccionar un aula sin conflicto horario. Estimación autoritativa del backlog/PDF: **2 SP**. `HU-Sprint-2.md` §9 aún indica 1 SP.

## 3. Alcance de esta task

La etapa backend aprobada completa el filtrado de `GET /api/turnos/aula/opciones?turno_id=` sin cambiar su ruta, permiso, forma de respuesta ni modo sin id. La etapa frontend implementada se limita al mensaje exacto de AC3. No incluye el reordenamiento del wizard, la navegación entre pasos, cambios de Prisma/schema, seed, migraciones ni contratos del módulo K.

## 4. Contrato backend e implementación realizada

### 4.1. Schema

Se conserva el schema existente. No se agregó un campo, validación ni migración para HU-C-16.

### 4.2. Servicio

En `src/server/turnos/turno.aula.service.ts`, `listarOpcionesAulaTurno()` obtiene, cuando recibe `turnoId`, la fecha, `horaInicioTurno` y `duracionMinutosTurno` del turno. Mantiene la selección de aulas activas con capacidad mínima suficiente mediante el contrato público de Aulas. Después excluye las ocupadas reutilizando `aulaConTurnoSuperpuesto()` de `turno.disponibilidad.ts`; no implementa otra fórmula de solapamiento.

El helper usa el intervalo real `horaInicioTurno + duracionMinutosTurno`, considera ocupantes únicamente los turnos `DISPONIBLE` y `COMPLETO`, y excluye el propio turno. `PENDIENTE` y `CANCELADO` no bloquean. Los intervalos adyacentes tampoco se superponen. Si hay aulas activas pero ninguna elegible, el servicio devuelve `[]`, sin error. Sin `turnoId` conserva el listado anterior de aulas activas con la capacidad mínima existente.

`asignarAulaTurno()` y su revalidación de disponibilidad no se modificaron.

### 4.3. Route Handler y respuesta

`src/app/api/turnos/aula/opciones/route.ts` no requirió cambios: ya aplica `withPermission("turnos:asignar_aula")`, delega al servicio y responde `{ data, error }`. La opción con `turno_id` ahora recibe el filtrado del servicio; la lista vacía válida conserva `200` con `{ "data": [], "error": null }`. Se creó `src/app/api/turnos/aula/opciones/route.test.ts` para cubrir ese contrato HTTP, el permiso, el modo sin id y la traducción de errores existentes.

### 4.4. Server Action y trazabilidad

No se requiere Server Action para la consulta. El GET es de solo lectura y no registra mutaciones. El `PATCH` de HU-C-15 y su trazabilidad permanecen como estaban.

## 5. Frontend mínimo de AC3 implementado

**Archivos modificados en esta etapa:**

- `src/app/(dashboard)/turnos/seccion-aula-turno.tsx`: cuando `aulas.length === 0` y no hay `SIN_AULAS_ACTIVAS`, muestra exactamente «No hay aulas disponibles para este horario». Conserva el mensaje propio de `SIN_AULAS_ACTIVAS` y el botón existente «Reintentar».
- `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`: verifica el mensaje exacto para `200 data: []`, la distinción con `SIN_AULAS_ACTIVAS` y la regresión de nombre/capacidad y selección normal de aula.
- `docs/tasks/Sprint 2/HU-C-16.md`: registra alcance, decisiones, evidencia y estado de los criterios.

La pantalla actual no tiene pasos ni callback para volver a «Fecha y Horario»: solo ofrece `onReintentar` para recargar las aulas. Por eso C-16 reutiliza esa acción sin crear una navegación artificial. El regreso real al paso 3 y el orden de cinco pasos quedan para HU-C-18. No se cambió `turno-configuracion.tsx`, la persistencia ni el backend en esta etapa.

## 6. Testing y evidencia

- `src/server/turnos/turno.aula.test.ts`: cobertura del filtrado por conflictos, duración real, `DISPONIBLE`/`COMPLETO`, `PENDIENTE`/`CANCELADO`, propio turno, contigüidad, capacidad mínima, lista vacía y modo sin id; conserva pruebas de asignación de HU-C-15.
- `src/app/api/turnos/aula/opciones/route.test.ts`: cobertura de opciones, `data: []`, permiso, modo sin `turno_id` y errores HTTP.
- Ejecución al cerrar la etapa backend: **20 tests específicos aprobados** (13 del servicio y 7 de la ruta); **`npx tsc --noEmit` aprobado**.
- Ejecución al cerrar la etapa frontend: **10 tests de `turno-configuracion.test.tsx` aprobados**, **20 tests backend de C-16 aprobados** (13 del servicio y 7 de la ruta), y **`npx tsc --noEmit` aprobado**. La suite frontend emitió advertencias de `act(...)`/`prefetch` sin fallos.

La prueba de componente verifica el texto renderizado; no se realizó verificación visual en navegador en esta etapa.

## 7. Estado por criterio y próximos pasos

| Criterio | Estado actual |
|---|---|
| AC1 | **Backend satisfecho** para el GET con `turno_id`. La integración completa del wizard queda para HU-C-18. |
| AC2 | **Satisfecho** por HU-C-15; preservado. |
| AC3 | **Parcial en el alcance conjunto del backlog:** mensaje exacto implementado y probado en C-16; navegación al paso Fecha y Horario pendiente de HU-C-18. |
| AC4 | **Satisfecho** por HU-C-15; verificado, sin reimplementación. |
| AC5 | **Pendiente HU-C-18**: Aula como cuarto paso del wizard. |

### Divergencias vigentes que no bloquean AC1

1. `spec_modulo_C.md` §2.3 conserva `turno_id` opcional, pero también enumera `400` cuando falta. Se preservó el modo opcional explícito; no se cambió el contrato.
2. El servicio todavía responde `TURNO_YA_DISPONIBLE` para un turno `CANCELADO`, aunque la spec enumera `TURNO_CANCELADO`. No se corrigió porque no era necesario para el filtrado de AC1.

### Definition of Done de C-16

- [x] Relevamiento revisado y aprobado antes de implementar.
- [x] AC1 backend: opciones con `turno_id` filtradas por disponibilidad, sin duplicar la regla de superposición.
- [x] AC2 y AC4 preservados desde HU-C-15.
- [x] AC3 dentro del alcance aprobado de C-16: mensaje exacto y distinción de `SIN_AULAS_ACTIVAS`.
- [x] Tests específicos frontend/backend y TypeScript aprobados.
- [x] Revisión de esta etapa frontend por el equipo.

**Estado final: la implementación propia de HU-C-16 quedó revisada y aprobada.** La navegación real al paso Fecha y Horario de AC3 y Aula como cuarto paso de AC5 se implementarán en nuestra HU-C-18. Es una separación deliberada de alcance entre C-16 y C-18, no un bloqueo externo. Las divergencias de `turno_id` opcional y `TURNO_CANCELADO` permanecen documentadas arriba.
