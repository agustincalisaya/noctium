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

**Estado final de la sección 0:** relevamiento revisado y aprobado. La tabla y los hallazgos anteriores conservan el estado observado **antes** de implementar backend. La decisión posterior fue corregir AC1 en C-16, limitar AC3 al mensaje en esta HU, y dejar la navegación y el cuarto paso a HU-C-18. Se aprobó conservar `turno_id` opcional y no corregir `TURNO_CANCELADO` en esta etapa. La etapa backend ya fue implementada y aprobada; se documenta abajo. **Actualización histórica:** el PO rechazó después que AC1 quedara satisfecho solo en backend; la revalidación del 29/09/2026 se registra en §8 y supera esa reducción de alcance.

---

## 1. Nota de alcance aprobado, superada para AC1 por la revalidación PO

- **AC1:** C-16 corrige el filtrado de aulas ocupadas en las opciones consultadas con `turno_id`.
- **AC2:** nombre/número y capacidad ya estaban cubiertos por HU-C-15; se preservan.
- **AC3:** C-16 muestra exactamente «No hay aulas disponibles para este horario» cuando la lista de opciones está vacía. La navegación real de vuelta al paso Fecha y Horario queda para HU-C-18.
- **AC4:** la revalidación al asignar/confirmar ya estaba implementada por HU-C-15; se verificó con los tests existentes y no se reimplementó.
- **AC5:** el cuarto paso y el reordenamiento completo del wizard pertenecen a HU-C-18.

El modo sin `turno_id` sigue siendo contractual. La decisión previa de no cambiar la secuencia del alta fusionada quedó **superada para AC1** por el rechazo del PO: la corrección de §8 persiste el PENDIENTE antes de consultar aulas. No se adelanta la integración del wizard de HU-C-18.

## 2. Historia de usuario

**Como** personal de mesa de entrada, **necesito** ver las aulas libres para la fecha y horario elegidos, **para** seleccionar un aula sin conflicto horario. Estimación autoritativa del backlog/PDF: **2 SP**. `HU-Sprint-2.md` §9 aún indica 1 SP.

## 3. Alcance de esta task

La etapa backend aprobada completa el filtrado de `GET /api/turnos/aula/opciones?turno_id=` sin cambiar su ruta, permiso, forma de respuesta ni modo sin id. La etapa frontend inicial implementó el mensaje exacto de AC3. Tras el rechazo PO de AC1, la corrección de §8 adapta el alta real para crear el PENDIENTE y consultar aulas únicamente con su id. No incluye el reordenamiento del wizard, la navegación entre pasos, cambios de Prisma/schema, seed, migraciones ni contratos del módulo K.

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
| AC1 | **Backend y pantalla real de alta satisfechos**: el POST crea el PENDIENTE, el GET posterior usa su `turno_id` y solo entonces se ofrecen aulas filtradas. La integración del wizard de HU-C-18 sigue separada. |
| AC2 | **Satisfecho** por HU-C-15; preservado. |
| AC3 | **Parcial en el alcance conjunto del backlog:** mensaje exacto implementado y probado en C-16; navegación al paso Fecha y Horario pendiente de HU-C-18. |
| AC4 | **Satisfecho** por HU-C-15; verificado, sin reimplementación. |
| AC5 | **Pendiente HU-C-18**: Aula como cuarto paso del wizard. |

### Divergencias vigentes que no bloquean AC1

1. `spec_modulo_C.md` §2.3 conserva `turno_id` opcional, pero también enumera `400` cuando falta. Se preservó el modo opcional explícito; no se cambió el contrato.
2. El servicio todavía responde `TURNO_YA_DISPONIBLE` para un turno `CANCELADO`, aunque la spec enumera `TURNO_CANCELADO`. No se corrigió porque no era necesario para el filtrado de AC1.

### Definition of Done de C-16

- [x] Relevamiento revisado y aprobado antes de implementar.
- [x] AC1 backend y alta real: opciones con `turno_id` filtradas por disponibilidad, sin duplicar la regla de superposición.
- [x] AC2 y AC4 preservados desde HU-C-15.
- [x] AC3 dentro del alcance aprobado de C-16: mensaje exacto y distinción de `SIN_AULAS_ACTIVAS`.
- [x] Tests específicos frontend/backend y TypeScript aprobados.
- [x] Revisión de esta etapa frontend por el equipo.

**Estado de la implementación previa:** quedó revisada y aprobada técnicamente, pero el PO rechazó CA1 en el alta real. La reducción de alcance que lo difería a C-18 quedó superada por la corrección de §8. La navegación real al paso Fecha y Horario de AC3 y Aula como cuarto paso de AC5 siguen perteneciendo a HU-C-18. Las divergencias de `turno_id` opcional y `TURNO_CANCELADO` permanecen documentadas arriba.

## 8. Revalidación PO 29/09/2026

### 8.1. Rechazo, causa y alcance corregido

El PO rechazó CA1: en `/turnos/nuevo`, `turno-configuracion.tsx` consultaba aulas sin `turno_id` antes del POST. Ese modo contractual devuelve todas las aulas activas y por eso mostraba aulas ocupadas; el PATCH posterior detectaba el conflicto recién al asignar. La aprobación previa del filtrado backend no bastaba para la pantalla usada. Se adopta la alternativa A aprobada: **persistir configuración como PENDIENTE → obtener `turno_id` → consultar `GET /api/turnos/aula/opciones?turno_id=<id>` → mostrar las opciones filtradas → asignar con el PATCH existente**. El modo sin id permanece en el contrato HTTP, pero el alta ya no lo consume.

### 8.2. Implementación y estados

Archivos modificados: `src/app/(dashboard)/turnos/turno-configuracion.tsx`, `turno-configuracion.test.tsx` y este documento. En alta, la sección Aula no muestra opciones antes del primer guardado; ese guardado solo crea el PENDIENTE y carga las aulas con el id recibido, sin ejecutar PATCH de aula. El id se conserva en estado y en la URL para continuar en modo edición sin repetir el POST. La selección posterior usa el PATCH existente, cuya revalidación de CA4 permanece intacta. También puede dejarse el PENDIENTE sin aula, como antes.

La UI distingue sin consulta previa, carga, `200 data: []`, `SIN_AULAS_ACTIVAS` y error HTTP. El texto de CA3, «No hay aulas disponibles para este horario», se muestra solo después de un GET válido con id y `data: []`; mantiene «Reintentar». `SIN_AULAS_ACTIVAS` conserva su mensaje propio. Un error de carga permite reintentar con el id persistido.

Si cambia fecha, hora o duración, se invalidan y ocultan las opciones anteriores y se limpia la elección local. Se persiste primero el nuevo intervalo mediante `PATCH /configuracion`; recién después se vuelve a consultar `GET /aula/opciones?turno_id=<mismo id>`. No se hace PATCH de aula con una selección previa. En edición, la carga inicial sigue consultando con el id existente.

### 8.3. Evidencia y límites

Los tests frontend verifican ausencia de GET sin id, orden POST → GET → PATCH posterior, oferta exclusiva de aulas devueltas, estado de carga, `data: []`, `SIN_AULAS_ACTIVAS`, error y reintento, conflicto 409 al asignar, edición existente e invalidación/recarga para cambios de fecha, hora y duración. Tests específicos de pantalla y Aula: **35 OK en 3 archivos** (15 de pantalla, 13 de servicio y 7 de ruta). Regresión de configuración: **22 OK** en `turno.configuracion.test.ts`; no existe `src/app/api/turnos/route.test.ts` en esta rama. `npx.cmd tsc --noEmit`: **OK**. El backend de Aula, Route Handler, Prisma, schema, seed, migraciones y módulos Profesor/Alumno no se modificaron.

**CA1:** corregido en la pantalla real; pendiente de revisión de esta reapertura. **CA2–CA5:** se conservan los resultados aceptados por PO. HU-C-18 sigue siendo dueña del wizard y de la regla futura de desasignar automáticamente un aula persistida si un cambio de intervalo la vuelve incompatible. Esta corrección oculta y recarga las opciones tras persistir, pero no implementa esa desasignación ni la presenta como resuelta.

### 8.4. Corrección de regresión detectada en revisión

La revisión final detectó que la edición de un PENDIENTE con aula persistida perdía la continuación al cambiar fecha, hora o duración: tras `PATCH /configuracion` y el GET filtrado, la pantalla retornaba al formulario aunque la misma aula siguiera disponible. Ahora se compara el aula persistida con las opciones de la nueva consulta. Si sigue incluida, se restaura como selección vigente y se muestra la continuación sin `PATCH /aula` adicional. Si ya no figura, no se restaura ni se ofrece continuación: la persona debe elegir una de las aulas nuevas y guardarla mediante el PATCH existente. Un error de `PATCH /configuracion` no dispara un GET para valores aún no persistidos ni restaura opciones obsoletas.

Se agregó una protección inmediata frente a dos envíos mientras la primera solicitud sigue pendiente, para que el alta no cree dos PENDIENTES antes de que React refleje el estado de guardado. La secuencia POST → GET con id → selección → PATCH de aula del alta permanece igual. La corrección modifica únicamente `turno-configuracion.tsx`, sus tests y este documento; no cambia backend ni contratos.

Evidencia de esta corrección: **61 tests aprobados en 4 archivos** (19 de pantalla, 13 del servicio de Aula, 7 de la ruta de opciones y 22 de configuración); **`npx.cmd tsc --noEmit` aprobado**. Los tests nuevos cubren aula persistida que sigue disponible, aula que deja de estar disponible, fallo del PATCH de configuración y doble envío durante el POST.

El aula persistida **no se desasigna automáticamente en base** cuando deja de estar disponible para el nuevo intervalo. Esa regla sigue pendiente de HU-C-18 y está separada de la corrección de navegación de C-16.
