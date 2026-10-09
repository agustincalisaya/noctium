# TASK: HU-C-06 — Cambiar fecha y hora del turno

**Módulo:** C (Turnos) · **Sprint:** 2 · **SP:** 2 (Excel `docs/Historias de Usuario - Sprint 2.xlsx`, fila 81)
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` Rev. 5 §2.11 (incluye N-4), §2.4, §3.2, §3.3, §3.4, §3.8, §3.10, §4 y parámetros configurables · `docs/RULES.md` Reglas 2, 4, 5, 6, 7, 10, 11 · `docs/DESIGN.md` §6.1, §6.4, §6.5 · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila Detalle de turno) y §4
**Origen de las decisiones SDD:** commit local `bd7d56f`; los deltas que aún requieren ratificación se registran en §11 de esta task, separados de la spec principal.
**Referencia visual:** `docs/Noctium pantallas Sprint 2.pdf` pág. 5 (detalle) y pág. 9 (Modal Reprogramar turno)
**RBAC:** `turnos:reprogramar`, exclusivo de MESA_ENTRADA, ya existe (migración `20260928150100_sprint2_modelo` línea 89; `prisma/seed.ts:728`). No se crean permisos.
**Schema:** ya completo, sin migración. El trigger `turno_sincronizar_reservas` ya reacciona a `fechaTurno` y `horaInicioTurno`.
**Estado:** §0 confirmado por el usuario para la integración sobre `f64fa70140315a9a284651ddc42cff41749923ec`. Implementada y verificada sobre esta base; resultados actuales en §7.

---

## 0. Relevamiento previo a implementación

### 0.1. Base
- Base `f64fa70`, que incluye HU-C-05, su ajuste visual `8dee864`, HU-C-10 y HU-E-01. El árbol estaba limpio antes de integrar.
- HU-I-01 todavía no ofrece el modal «Registrar pago» en esta base; la tarjeta de pagos existente se conserva.

### 0.2. Archivos nuevos
1. `src/server/turnos/turno.reprogramacion.service.ts`
2. `src/server/turnos/turno.reprogramacion.test.ts`
3. `src/server/turnos/turno.reprogramacion.pg.test.ts`
4. `src/app/api/turnos/[id]/reprogramacion/route.ts` y `route.test.ts`
5. `src/app/api/turnos/[id]/reprogramacion/opciones/route.ts` y `route.test.ts`
6. `src/app/(dashboard)/turnos/[id]/reprogramar-turno-dialog.tsx` y `.test.tsx`

### 0.3. Archivos existentes a modificar

| Archivo | Cambio |
|---|---|
| `src/server/turnos/turno.schema.ts` | `ReprogramarTurnoSchema` (`.strict()`), `OpcionesReprogramacionQuerySchema` |
| `src/server/turnos/turno.validaciones.ts` | Extraer `validarFechaHoraTurno(input, { topeFecha? })` y `calcularTopeReprogramacion()`. `validarConfiguracionTurno` delega sin cambiar su comportamiento |
| `src/server/turnos/turno.disponibilidad.ts` | Exportar `alumnosConTurnoSuperpuesto()` (todos los ids, excluye el propio turno) |
| `src/server/turnos/turno.service.ts` | El privado `alumnoConTurnoSuperpuesto` delega en el helper nuevo (HU-C-04 sin cambios) |
| `src/app/(dashboard)/turnos/[id]/turno-detalle-encabezado.tsx`, `turno-detalle.tsx` | Botón «Reprogramar» y estado del modal |
| Tests: `turno.schema.test.ts`, `turno.validaciones.test.ts`, `turno.disponibilidad.test.ts`, `turno-detalle.test.tsx` | Casos nuevos, sin borrar los existentes |

### 0.4. Decisiones resueltas (no relevar de nuevo)
- **DECISIÓN RESUELTA — opciones de horario:** endpoint propio `GET /api/turnos/[id]/reprogramacion/opciones` (usuario, 30/09). El delta pendiente de ratificación queda en §11.
- **DECISIÓN RESUELTA — errores de fecha:** `400 VALIDATION_ERROR` con `detalles.motivo` (spec vigente; usuario, D-2).
- **DECISIÓN RESUELTA — misma fecha y hora:** no se agrega `REPROGRAMACION_SIN_CAMBIOS` ni un 422 (D-3). La UI no ofrece esa opción.
- **DECISIÓN RESUELTA — `conflictos`:** `{ recurso, id }`, a lo sumo una entrada por recurso e id (D-4).
- **DECISIÓN RESUELTA — horario actual:** se deshabilita **solo** si coincide la fecha actual; la misma hora en otra fecha se puede elegir.
- **DECISIÓN RESUELTA — fallo después del COMMIT:** comportamiento T-PC de HU-C-05 (recargar y pedir verificación); `CAMBIO_GUARDADO_SIN_TRAZA` sigue pendiente de ratificación.

### 0.5. A relevar en el §0
- Si el cambio en `alumnoConTurnoSuperpuesto` altera algún orden de error observable en HU-C-04 (debe seguir informando el primer alumno en el orden de `alumnoIds`). **Resuelto al implementar:** delega en `alumnosConTurnoSuperpuesto()` y devuelve el primero en el orden de `alumnoIds`. Los tests de HU-C-04 (`turno.participantes.test.ts`, `turno.inscripciones.test.ts`, `turno.reservas.pg.test.ts` › «agrega y quita reservas…») pasan sin cambios.

---

## 1. Nota de alcance

**Fuera de alcance (explícito):**
- Cambiar materia, profesor, duración o aula (AC5, spec §2.11).
- Reprogramar un `PENDIENTE` (se hace con §2.1) o un turno vencido.
- Notificaciones.
- Implementar E-01. Reimplementar I-01. HU-J-03.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** reprogramar la fecha y hora de un turno ya confirmado
**Para** reagendar una clase sin tener que cancelarla y crear una nueva.

**Criterios de aceptación (literal, Excel filas 81–85):**
1. Desde el detalle de un turno Disponible o Completo, “Reprogramar” abre un formulario con Fecha y Hora de inicio (la Duración y el Profesor no cambian en esta operación).
2. La nueva fecha/hora se valida contra la disponibilidad del profesor (su horario de atención y sus otros turnos confirmados), del aula ya asignada y de todos los alumnos ya inscriptos — mismos criterios de superposición que HU-C-04.
   – Si cualquiera de los tres tiene conflicto, se informa cuál y no se guarda el cambio.
3. Si la nueva fecha/hora es válida, se actualiza el turno manteniendo su estado (Disponible o Completo) y se informa “Turno reprogramado correctamente”.
4. Cambiar la fecha/hora de un turno no reinicia sus inscripciones ni su historial de clases dictadas (HU-E-01) si ya las tuviera.
5. Esta historia no permite cambiar Materia, Profesor ni Duración de un turno ya confirmado — eso implicaría reconstruir el turno, fuera de alcance.

---

## 3. Alcance de esta task

Backend (schemas, validación de fecha con tope N-4, triple validación, servicio de opciones, servicio de reprogramación, dos rutas) y frontend (botón y `Dialog` de la pág. 9).

---

## 4. Contrato backend

### 4.1. Schemas Zod

```typescript
export const ReprogramarTurnoSchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: ConfigurarTurnoSchema.shape.hora_inicio,
}).strict();
export const OpcionesReprogramacionQuerySchema = z.object({ fecha: fechaCalendarioValidaSchema }).strict();
```

### 4.2. Reglas comunes
- **Tope N-4:** `max(fecha actual del turno, hoy + ANTICIPACION_MAXIMA_DIAS)`.
- **Validaciones de fecha y hora (§2.1 pasos 2, 3, 5, 6)**, con la **duración persistida**: futuro, ≤ tope, día operativo, granularidad, horario operativo.
- **Triple validación** contra `DISPONIBLE`/`COMPLETO`, **excluyendo el propio turno**:
  - profesor: horario de atención y superposición;
  - aula;
  - cada alumno inscripto (se informan todos).

### 4.3. Servicio `opcionesReprogramacion(id, fecha)` (solo lectura)
1. Estado y vigencia como el PATCH.
2. Validación de día y tope.
3. Franjas de `obtenerHorariosDeAtencion()` del día, menos los ocupados de profesor, aula y alumnos (sin el propio turno), con `calcularTramosLibres` / `iniciosPosibles`, dentro del horario operativo; si es hoy, solo inicios futuros.
4. `actual = (fecha === fecha actual) && (inicio === hora actual)`.

Devuelve `{ fecha, duracion_min, tope_fecha, inicios: [{ hora_inicio, hora_fin, actual }] }`.

### 4.4. Servicio `reprogramarTurno(id, input, usuarioId)`

Dentro de una única `prisma.$transaction`:
1. `SELECT … FOR UPDATE`: 404; `PENDIENTE` → `TURNO_PENDIENTE`; `CANCELADO` → `TURNO_CANCELADO`; vencido → `TURNO_VENCIDO`.
2. Validaciones de §4.2 (siempre, aunque GET ofreció la opción). Si hay conflictos → `ServiceError("REPROGRAMACION_CONFLICTO", …, { conflictos })` sin escribir.
3. `updateMany({ where: { idTurno: id, estadoTurno: { in: ["DISPONIBLE","COMPLETO"] } }, data: { fechaTurno, horaInicioTurno, modificadoPorUsuarioId } })`; `count 0` → `TURNO_MODIFICADO`. **No** se escriben estado, duración, materia, profesor, aula, cupo, prioridad ni relaciones.
4. El trigger mueve las reservas. Un `23P01` se traduce a `REPROGRAMACION_CONFLICTO` con `recursoEnConflicto` / `alumnoEnConflicto`, con rollback de la transacción.
5. Commit.
6. **Después del COMMIT:** `turno:reprogramado { turno_id, fecha_anterior, hora_inicio_anterior, fecha_nueva, hora_inicio_nueva, hora_fin_nueva, usuario_id }`. Un fallo se propaga (500).

### 4.5. Route Handlers

| Ruta | Permiso | Éxito |
|---|---|---|
| `PATCH /api/turnos/[id]/reprogramacion` | `turnos:reprogramar` | `200 { id, fecha, hora_inicio, hora_fin, estado }` |
| `GET /api/turnos/[id]/reprogramacion/opciones?fecha=` | `turnos:reprogramar` | `200 { fecha, duracion_min, tope_fecha, inicios }` |

| Error | HTTP | Cuerpo |
|---|---|---|
| Schema o query inválidos, campos extra | 400 | `VALIDATION_ERROR` + `detalles` (`flatten()`) |
| `FECHA_PASADA`, `ANTICIPACION_EXCEDIDA`, `DIA_NO_OPERATIVO`, `HORA_NO_GRANULAR`, `FUERA_DE_HORARIO_OPERATIVO` | 400 | `{ code: "VALIDATION_ERROR", message, detalles: { motivo } }` |
| Sin permiso | 403 | `SIN_PERMISO` |
| `TURNO_NO_ENCONTRADO` | 404 | — |
| `TURNO_PENDIENTE`, `TURNO_CANCELADO`, `TURNO_VENCIDO`, `TURNO_MODIFICADO` | 409 | — |
| `REPROGRAMACION_CONFLICTO` (solo PATCH) | 409 | `detalles: { conflictos: [{ recurso, id }] }` |

### 4.6. Server Action
No se crea (convención del módulo C).

---

## 5. Frontend

**Pantalla:** Detalle de turno (`/turnos/[id]`), `mapa-pantallas-sprint-2.md` §1. **Modal:** `Dialog` y feedback por toast (mapa §4, DESIGN §6.1).

- **Encabezado:** «Reprogramar» (primer botón, contorno) si `acciones_habilitadas` incluye `reprogramar`.
- **`ReprogramarTurnoDialog` (pág. 9):**
  - Título «Reprogramar turno».
  - Subtítulo «Cambia fecha y hora de inicio. Profesor ({profesor}), aula y duración se mantienen.».
  - «Nueva fecha»: `input type="date"`, valor inicial = fecha actual, `min` = hoy, `max` = `tope_fecha`.
  - «Hora de inicio (dentro del horario de atención, {N h})»: chips radio `hh:mm–hh:mm`; `actual: true` tachado y deshabilitado solo en la fecha actual.
  - Ayuda «Profesor, {Aula} y alumnos inscriptos disponibles en ese horario.».
  - Sin opciones: «No hay horarios disponibles para esa fecha».
  - Botones «Cancelar» y «Reprogramar» (deshabilitado sin hora).
- **Resultados:**

| Respuesta | UI |
|---|---|
| 200 | Cierra; `toast.success("Turno reprogramado correctamente")`; `cargar(true)` |
| 409 `REPROGRAMACION_CONFLICTO` | Aviso en el Dialog (`--destructive-soft`) con cada recurso por nombre («Profesor …», «{Aula}», «Alumno {Apellido, Nombre}» desde `turno.alumnos`); vuelve a pedir las opciones |
| 400 con `motivo` | Aviso en el Dialog con el mensaje |
| 409 de estado / 404 | `toast.error`; `cargar(true)` |
| ≥ 500 o red (T-PC) | Cierra; `toast.error("No pudimos confirmar si el cambio se guardó. Revisá el detalle actualizado antes de reintentar.")`; `cargar(true)` |

---

## 6. Matriz de aceptación de esta integración

| Criterio | Verificación sobre f64fa70 | Resultado |
|---|---|---|
| AC1: fecha y hora, sin cambiar duración ni profesor | Opciones y modal en Chrome; hora actual deshabilitada solo en su fecha (unit y DOM) | Verificado |
| AC2: profesor, aula y alumnos; exclusión propia y revalidación | Unit del servicio y rutas; PostgreSQL: conflicto triple, exclusión propia, concurrencia y rollback por 23P01 | Verificado |
| AC3: estado y confirmación | PostgreSQL conserva DISPONIBLE/COMPLETO; HTTP 200; navegador muestra el toast literal y recarga el horario | Verificado |
| AC4: inscripciones e historial | PostgreSQL conserva alumnos, pagos y reservas coherentes; prueba integrada con E-01 rechaza un turno con clase registrada como TURNO_VENCIDO y preserva turno, clase y alumnos | Verificado para los estados alcanzables |
| AC5: campos inmutables | Schema estricto, route tests y HTTP rechazan campos extra con 400 VALIDATION_ERROR | Verificado |
| N-4 y T-PC | Unit y PostgreSQL prueban tope; DOM prueba 5xx/red y mensaje compartido de C-05 | Verificado |

Un turno con clase dictada ya comenzó y no puede reprogramarse por el guard de vigencia. Esa es la vía alcanzable para AC4 junto a E-01; no existe un cambio de fecha posterior a la clase que deba preservar un historial modificado.

---

## 7. Verificación ejecutada

**Base:** f64fa70140315a9a284651ddc42cff41749923ec. **Origen selectivo:** bd7d56f9e667a36fb50ab627ccd6dfc7957d3e13. **Entorno:** Node 24.19.0, Next.js 16.3.8, Prisma 6.19.3 y PostgreSQL 16 aislado en un contenedor temporal con base noctium_test y puerto local 55436. La base compartida noctium_db no se usó.

| Comprobación | Resultado |
|---|---|
| npx tsc --noEmit | Correcto, tras regenerar Prisma Client (el instalado estaba desactualizado respecto de observaciones de E-06) |
| ESLint de todos los archivos de código tocados | Correcto |
| npm run lint global | Falla en 6 imports require() de dos scripts preexistentes de docs/fases-sdd; ningún error de C-06 |
| npm run build | Correcto; incluye ambas rutas de reprogramación y la de clase dictada |
| Pruebas afectadas | 167/167 |
| npm test (suite unitaria) | 1268 passed, 57 skipped por PostgreSQL no habilitado para otras suites, 3 todo |
| PostgreSQL C-06 | 9/9: conservación y movimiento de reservas; COMPLETO; exclusión propia; conflictos; concurrencia; rollback; N-4; evento posterior al COMMIT; turno con clase registrada |
| HTTP autenticado | Sin sesión 401 y Gerente/Profesor 403 en GET y PATCH; Mesa: GET 200, PATCH 200, campo extra 400, fecha pasada y tope excedido 400 con detalles.motivo, turno inexistente 404, PENDIENTE/CANCELADO/VENCIDO 409 |
| Chrome headless contra next start | Modal, hora actual deshabilitada, guardado con toast literal y detalle actualizado; acciones C-05/C-10 presentes; tarjeta Clase de E-01 visible. En el turno histórico con clase no aparece Reprogramar |

Las capturas actuales del modal y del guardado están en el directorio temporal del sistema, fuera del repositorio. La fecha se presenta según el navegador, igual que en el mockup. El mockup de la página 9 muestra el modal sobre la pantalla de detalle; la implementación actual conserva además la tarjeta Clase de E-01. «Registrar pago» corresponde a I-01, aún no implementada aquí.

No se repitieron todas las suites PostgreSQL anteriores: la antigua falla de turno.reservas.pg.test.ts informada por C-05 no se atribuye a esta integración ni se declara resuelta.

---

## 8. Integración y límites

- C-05 y su ajuste visual 8dee864 permanecen en la base; el modal de reprogramación usa el mensaje T-PC compartido de C-05.
- C-10 conserva su botón y modal. Reprogramar aparece primero, seguido de Asignar prioridad y Cancelar turno.
- E-01 permanece en el detalle. La nueva prueba integrada demuestra que una clase registrada y su turno no cambian ante un intento de reprogramación.
- I-01 puede añadir más adelante «Registrar pago» a la tarjeta existente. Al hacerlo debe conservarse el modal de C-06.
- J-03 leerá la fecha y hora actualizadas mediante los contratos existentes; no se cambió su código.

---

## 9. Estado de entrega

La implementación, las verificaciones indicadas en §7 y la task están completas en el árbol de trabajo. No hay commit, push, PR ni merge de esta integración.

---

## 10. Archivos integrados

**Nuevos:** servicio y pruebas de reprogramación (incluida PostgreSQL); rutas GET/PATCH con pruebas; modal con prueba; esta task. **Adaptados:** schema, validaciones, disponibilidad, servicio de turnos, encabezado y vista del detalle, y sus pruebas. Se conservaron la función de opciones de alumnos agregada en develop, la tarjeta Clase y las pruebas de E-01. No se copiaron auditorías ni capturas del commit original.

---

## 11. Deltas de spec pendientes de ratificación

Estas decisiones técnicas están implementadas por acuerdo previo del usuario, pero **no se incorporaron como aprobadas** a docs/specs/spec_modulo_C.md:

1. GET /api/turnos/[id]/reprogramacion/opciones, con fecha, duración persistida, tope e inicios; la marca actual compara fecha y hora.
2. Validaciones de fecha/hora como 400 VALIDATION_ERROR con detalles.motivo.
3. Conflictos como detalles.conflictos con pares { recurso, id } sin duplicados.

No se agregaron 422, REPROGRAMACION_SIN_CAMBIOS ni CAMBIO_GUARDADO_SIN_TRAZA.
