# HU-C-10 — Asignar prioridad al turno

**Estado:** relevamiento aprobado por el usuario; C-10 implementada y verificada localmente para revisión. **Rama de entrega:** `feature/HU-C-10_prioridad`, desde `830d4b4` (`origin/develop` local), 30/09/2026. **Módulo:** C (Turnos). **Sprint:** 2. **SP oficial:** 1 (Excel fila 86). El rango operativo inicial de la auditoría fue 3–5 horas efectivas; no deriva de SP.

**Contrato:** `docs/specs/spec_modulo_C.md` revisión 5 §§2.4, 2.12, 3.8, 4; `docs/specs/spec_modulo_J.md` revisión 2.1 §§2.1–2.3; `docs/RULES.md` reglas 2–7, 10–11; `docs/DESIGN.md` §6; mapa de pantallas §1/§4. **Visual inspeccionada:** `docs/Noctium pantallas Sprint 2.pdf` págs. 3–5 (listado y detalle), 10 (Dialog), 14–15 (calendario). Contrato PO posterior al mockup: creador por email y sin «Total registrado»; esta HU no altera esos campos.

**RBAC:** `turnos:priorizar` solo Mesa de Entrada, ya cargado en `prisma/migrations/20260928150100_sprint2_modelo/migration.sql:90` y `prisma/seed.ts:729`. **Schema de datos:** `PrioridadTurno` y `prioridadTurno @default(NORMAL)` ya existen en `prisma/schema.prisma:71,498`. No crear permiso, migración ni seed.

---

## 0. Relevamiento previo a implementación — aprobado por el usuario

Esta sección conserva el estado del código antes de implementar; el resultado verificado figura en §8.

### HECHOS comprobados

- `presentar()` en `src/server/turnos/turno.service.ts:302–330` ya entrega `prioridad`; `Turno` y `TurnoDetalle` la tipan en `src/types/turno.types.ts:4–25`. `src/app/(dashboard)/turnos/[id]/turno-datos-card.tsx:22` ya renderiza `PrioridadTurnoBadge` con texto e ícono para Alta/Urgente. `turno.acciones.ts:58–68` incluye `prioridad` salvo CANCELADO; los tests correspondientes pasaron. Es base, no C-10 completa.
- No existen `ActualizarPrioridadSchema`, `actualizarPrioridadTurno`, `PATCH /api/turnos/[id]/prioridad`, botón, Dialog ni toast. `turno-detalle-encabezado.tsx:11` reserva espacio para acciones. `turno-detalle.tsx:22–35` expone `cargar(true)` para refrescar la misma vista.
- El listado `turnos-listado.tsx:131` no muestra prioridad; el presentador sí la devuelve. El orden de `listarTurnos()` en `turno.service.ts:358–365` es fecha/hora/profesor/id y debe conservarse.
- Los calendarios semanales existentes leen `calendario.service.ts:69–93`, tipan `src/types/calendario.types.ts:6–20` y comparten `bloque-evento-calendario.tsx:31–82`; ninguno transporta prioridad. J-03 (día/semana/mes) todavía no existe en este HEAD, aunque su spec §2.3 define `prioridad` por evento y `prioridad_maxima` mensual. Integrar C-10 con J-01/J-02 ahora y coordinar el mismo DTO cuando llegue J-03, sin implementar J-03 desde esta task.
- `emitirEventoTurno()` (`turno.service.ts:32`) escribe síncronamente `EventoTurno` y se usa después de `prisma.$transaction` en los servicios actuales. `src/components/ui/sonner.tsx:18` y el Toaster montado en `src/app/(dashboard)/layout.tsx:39` proveen feedback modal. La capa HTTP usa `withPermission` y el sobre `{ data, error }`.
- Las guías de Next instaladas en `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `.../03-api-reference/03-file-conventions/route.md` confirman `PATCH` en `route.ts` y `context.params` asíncrono. No usar ejemplos de Next anteriores.

### Archivos nuevos propuestos

| Archivo | Propósito |
|---|---|
| `src/app/api/turnos/[id]/prioridad/route.ts` | `PATCH` delgado, Zod, permiso, mapping de errores. |
| `src/app/(dashboard)/turnos/[id]/asignar-prioridad-dialog.tsx` | Dialog de radio Normal/Alta/Urgente, Guardar/Cancelar, estado de envío y toast. |
| `src/app/api/turnos/[id]/prioridad/route.test.ts` | HTTP contract con mocks de sesión/servicio. |
| `src/server/turnos/turno.prioridad.test.ts` | Transacción, no-op, estados, trazabilidad posterior a commit. |
| `src/app/(dashboard)/turnos/[id]/asignar-prioridad-dialog.test.tsx` | Flujo de selección, feedback y refresco sin navegación. |

### Archivos existentes a modificar

| Archivo | Cambio acotado |
|---|---|
| `src/server/turnos/turno.schema.ts` | `PRIORIDADES_TURNO` y `ActualizarPrioridadSchema` estricto. |
| `src/server/turnos/turno.service.ts` | `actualizarPrioridadTurno()`; no tocar orden, búsqueda ni `presentar()` salvo necesidad probada. |
| `src/app/(dashboard)/turnos/[id]/turno-detalle-encabezado.tsx` | Botón «Asignar prioridad» solo cuando `acciones_habilitadas` lo incluye; acceso al Dialog. |
| `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx` | Estado del Dialog y `cargar(true)` tras éxito, sin redirigir. |
| `src/app/(dashboard)/turnos/turnos-listado.tsx` | Columna Prioridad; reutilizar `PrioridadTurnoBadge`. Mantener q/paginación/orden existentes. |
| `src/server/calendario/calendario.service.ts` | Seleccionar `prioridadTurno` en evento base y mapearla a `prioridad`; mantener estados y rangos vigentes. |
| `src/types/calendario.types.ts` | `prioridad: PrioridadTurno` en `EventoCalendarioBase`. |
| `src/components/shared/evento-calendario.tsx`, `evento-calendario-materia.tsx`, `bloque-evento-calendario.tsx` | Pasar y mostrar texto/ícono de Alta/Urgente en los dos calendarios; incluirla en nombre accesible si el bloque queda pequeño. |
| `src/server/calendario/calendario.service.test.ts`, `src/components/shared/evento-calendario-materia.test.tsx`, `src/app/(dashboard)/turnos/turnos-listado.test.tsx`, `src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx` | Ampliar aserciones relevantes sin borrar casos previos. |

**Archivos compartidos:** `turno.service.ts`, listado, detalle, DTO y calendario coinciden con C-05/C-06/C-08/C-09/J-03. Una sesión integradora posee cada uno en esta etapa; coordinar con Lautaro antes de integrar J-03. No se cambian docs fuente, `prisma/schema.prisma`, migraciones ni seed.

**Revisión recibida:** el usuario aprobó este relevamiento y autorizó C-10 con indicadores en J-01/J-02, sin ampliar a J-03. La diferencia local de I-01 se comunicó antes de editar los archivos compartidos: el usuario afirma integración/aprobación, pero este HEAD carece de servicio/rutas/modal de alta de pagos y no se localizó su commit/PR. La lectura de pagos se preservó. La pregunta separada sobre búsqueda de alumnos de C-02 está en la auditoría; no altera esta HU.

---

## 1. Nota de alcance

HU-C-09 aporta el detalle y la acción elegible; C-10 debe convertirla en operación real, visible en detalle/listado/calendario. C-10 no espera al cierre de E-01/E-05/E-06 ni a la vista J-03, pero el DTO de prioridad que añade debe ser reutilizable por J-03.

Fuera de alcance: notificaciones, reordenar turnos por prioridad, editar prioridad en el wizard, acciones sobre CANCELADO, crear vistas día/mes de J-03, tocar pagos o clase dictada. El `Dialog` de la pág. 10 explica que Alta/Urgente se marcan y no alteran orden ni envían notificaciones.

## 2. Historia de usuario y CA literales

**Como** personal de mesa de entrada, **necesito** marcar un turno con un nivel de prioridad, **para** identificar visualmente qué turnos requieren atención preferente.

1. El detalle del turno permite elegir una Prioridad entre Normal, Alta y Urgente (Normal por defecto al crearse; no se elige en el wizard de creación).
2. El listado de turnos (HU-C-01) y el calendario (HU-J-01/HU-J-02) muestran un indicador visual de prioridad cuando es Alta o Urgente (texto o ícono, no solo color, mismo criterio de accesibilidad que el resto del sistema).
3. Cambiar la prioridad no dispara ninguna notificación (fuera de alcance este sprint) ni afecta el orden por defecto del listado (que sigue siendo por fecha/hora).
4. Al guardar se informa «Prioridad actualizada» y se registra el cambio en el evento de dominio correspondiente.
5. Disponible para turnos en cualquier estado excepto Cancelado.

## 3. Matriz de cumplimiento prevista

| CA | Backend / API | UI / visual | Evidencia para cierre |
|---|---|---|---|
| 1 | Schema y servicio aceptan exactamente Normal/Alta/Urgente; default Prisma | Botón en detalle y radio en Dialog pág. 10; sin campo en wizard | Unit del schema/default, HTTP 200/400, navegador pág. 5/10 |
| 2 | `prioridad` en listado y DTO de calendario | Badge con texto e ícono en listado págs. 3–4 y grilla pág. 14, ambos roles/vistas; detalle pág. 5 | Unit de DTO/orden, test DOM accesible, navegador en J-01/J-02 |
| 3 | `listarTurnos()` conserva `orderBy`; sin servicio de notificaciones | No prometer avisos | Comparar orden y ausencia de llamadas de notificación antes/después |
| 4 | Evento síncrono `turno:prioridad_actualizada` post-commit, solo si cambió | Toast literal «Prioridad actualizada» tras guardar; error de servidor con toast de error | Spy de transacción/evento, consulta PG de `eventos_turno`, navegador |
| 5 | Transacción bloquea fila, 409 para CANCELADO; PENDIENTE/vencido admitidos | El detalle oculta botón para CANCELADO según `acciones_habilitadas` | Unit/HTTP 200 y 409 por estado; navegador Pendiente/Cancelado |

## 4. Contrato backend

### 4.1 Schema Zod

En `src/server/turnos/turno.schema.ts`: `PRIORIDADES_TURNO = ["NORMAL", "ALTA", "URGENTE"] as const`; `ActualizarPrioridadSchema = z.object({ prioridad: z.enum(PRIORIDADES_TURNO) }).strict()`. Body ausente, valor desconocido o campo extra → `400 VALIDATION_ERROR` con `flatten()` y sobre estándar. La ruta valida antes de invocar el servicio.

### 4.2 Servicio

`actualizarPrioridadTurno(id, input, usuarioId)` en `src/server/turnos/turno.service.ts`:

1. `prisma.$transaction`: `SELECT ... FOR UPDATE` de ese turno, con el patrón actual de bloqueo de `turno.publico.ts:64` adaptado a la operación propia. Si falta → `404 TURNO_NO_ENCONTRADO`; si está CANCELADO → `409 TURNO_CANCELADO`. No aplicar guard de vigencia: PENDIENTE y vencido admitidos.
2. Leer `prioridadTurno` como `prioridad_anterior`. Si igual a la solicitada, devolver `{ id, prioridad, sin_cambios: true }` sin escritura de turno ni evento.
3. Si difiere, `tx.turno.updateMany({ where: { idTurno: id, estadoTurno: { not: "CANCELADO" } }, data: { prioridadTurno: input.prioridad, modificadoPorUsuarioId: usuarioId } })`. `count === 0` → `409 TURNO_MODIFICADO`. Escribir solo prioridad y auditoría, sin alterar fecha, estado, reservas ni orden.
4. Tras resolver el commit, `emitirEventoTurno("turno:prioridad_actualizada", id, usuarioId, { turno_id: id, prioridad_anterior, prioridad_nueva: input.prioridad, usuario_id: usuarioId })` conforme a C §4 y RULES 2. La traza es síncrona, sin hash/listener. Revisar cómo se comunica un fallo de evento post-commit sin afirmar rollback.

### 4.3 Route Handler

`PATCH /api/turnos/[id]/prioridad` en `src/app/api/turnos/[id]/prioridad/route.ts`, con `withPermission("turnos:priorizar", ...)`, `const { id } = await ctx.params`, `schema.safeParse(await req.json().catch(() => null))`, servicio y traducción a `{ data, error }`. 200 `{ id, prioridad }` o `{ id, prioridad, sin_cambios: true }`; 400 validación; 403 `SIN_PERMISO`; 404 `TURNO_NO_ENCONTRADO`; 409 `TURNO_CANCELADO`/`TURNO_MODIFICADO`. Seguir formato y mensajes concretos de las rutas hermanas, sin poner negocio en el handler.

### 4.4 Server Action

No se crea: C §2.12 y las convenciones actuales indican Route Handler directo. El template antiguo muestra actions junto a `app`; aquí no corresponde. Si una action fuera necesaria después, RULES 11 la ubica en `src/server/turnos/actions.ts`.

### 4.5 Trazabilidad

Regla 2 opción (b) de `docs/RULES.md`, C §4: `EventoTurno` post-commit, más `modificadoPorUsuarioId`/`updatedAtTurno` en la fila mutada. La prioridad igual no genera nuevo evento ni actualización. No agregar AuditLog, SHA-256 ni infraestructura asíncrona.

## 5. Frontend

- En el encabezado del detalle, mostrar «Asignar prioridad» solo cuando `turno.acciones_habilitadas.includes("prioridad")`; abrir Dialog de la pág. 10. Tres radios con nombres accesibles Normal, Alta y Urgente; cargar valor actual; Cancelar cierra sin mutar, Guardar envía `PATCH` y deshabilita doble envío.
- En éxito, cerrar, llamar `cargar(true)` para refrescar los datos sin navegación y `toast.success("Prioridad actualizada")`. `DESIGN.md` §6.1: esquina superior derecha, 4 segundos, tokens del componente existente. Ante error mostrar `toast.error` y dejar selección disponible para reintentar. Si el servidor responde CANCELADO por carrera, refrescar el detalle para quitar la acción.
- En listado, columna Prioridad según PDF págs. 3–4. Reutilizar `PrioridadTurnoBadge`; se puede mostrar Normal con contorno como el mockup, y Alta/Urgente siempre con texto/bandera. No alterar `orderBy`, filtros, paginación ni URL.
- En J-01/J-02, transportar `prioridad` del turno a `EventoCalendarioBase` y al bloque compartido; presentar Alta/Urgente con texto o ícono y `aria-label`/`title` completo si el bloque no cabe. Mantener el enlace al detalle y la etiqueta de estado. Integración posterior con J-03 usará ese DTO; no crear día/mes ahora.
- Diferencias PO frente al mockup: «Creado por» es email y no hay «Total registrado». No tocar esos campos desde C-10.

## 6. Testing y evidencia requerida

### Nivel 1 — unitarios/componentes

- Schema: tres válidos, ausente, inválido y campo extra. Servicio: existente/faltante/Cancelado, PENDIENTE y vencido admitidos, mismo valor no-op, `updateMany.count=0`, rollback de error, evento **solo tras commit** con valor anterior correcto. Assert de que no cambia fecha/estado/orden ni se llama notificación.
- Route: permiso Mesa frente a roles sin permiso, `params` asíncronos, cuerpos 200/400/403/404/409 y sobre. UI: radio preseleccionado, Cancelar, Guardar, error y refresco del mismo detalle. Listado/calendarios: badge legible Alta/Urgente y orden estable; ampliar tests existentes sin borrar aserciones.
- Comandos tras implementar: `npx tsc --noEmit`; `npx eslint` sobre archivos tocados; `npm test --` con los archivos nuevos y los tests de detalle, listado y calendario. La auditoría base ya dio 291 tests relevantes verdes, no prueba la implementación futura.

### Nivel 2 — HTTP autenticado

Con servidor local y base de simulación verificada: Mesa cambia Normal→Alta→Urgente; mismo valor devuelve `sin_cambios`; valor incorrecto/campo extra 400; Gerente/Profesor 403; id inexistente 404; CANCELADO 409; PENDIENTE y vencido 200. Tras cada 200, GET del detalle y listado refleja valor; calendarios reflejan prioridad de confirmados. Guardar respuesta/código y rol usado, sin exponer credenciales.

### Nivel 3 — PostgreSQL

En `noctium_test` aislada y migrada, con variables de test explícitas: comparar `turnos.prioridadTurno`, `modificadoPorUsuarioId`, `updatedAtTurno` y fila de `eventos_turno` antes/después; no-op sin escrituras; Cancelado intacto. Verificar evento post-commit mediante test de servicio; la consulta SQL sola no demuestra orden temporal. No correr seeds ni migraciones en esta auditoría.

### Navegador / mockup

Capturas y cotejo de detalle pág. 5 y Dialog pág. 10, listado págs. 3–4, calendario págs. 14–15, con estado Normal/Alta/Urgente y distintos roles. Verificar teclado, foco, texto/ícono, toast literal y actualización in situ. La referencia visual se inspeccionó; **la aplicación no fue cotejada en navegador todavía**.

## 7. Checklist de Definition of Done

- [x] Relevamiento §0 revisado explícitamente conforme SDD antes de editar código.
- [x] `PATCH` protegido, Zod estricto, servicio atómico y errores semánticos; sin lógica de negocio en ruta.
- [x] `CANCELADO` bloqueado en servicio; PENDIENTE y vencido admitidos; no-op sin escritura/evento.
- [x] Evento correcto después de commit y auditoría de fila; sin notificaciones.
- [x] Dialog, toast literal, detalle refrescado; indicador accesible en listado y dos calendarios.
- [x] Orden, búsqueda y paginación originales sin regresión.
- [x] Evidencia unit, HTTP, PostgreSQL y navegador contra páginas exactas.
- [ ] Integración futura de J-03 y de I-01 aprobada en la base compartida; sus cambios no están en este HEAD y requieren handoff del equipo.

## 8. Resultado local de implementación — 30/09/2026

- `turno.schema.ts` valida exclusivamente Normal/Alta/Urgente. `turno.service.ts` bloquea fila, guarda prioridad y usuario, evita escrituras/eventos en no-op y emite `turno:prioridad_actualizada` tras commit. `PATCH /api/turnos/[id]/prioridad` aplica `turnos:priorizar` y el sobre HTTP estándar.
- Si falla la escritura del evento después del commit, la ruta propaga un error 500 y el cambio de prioridad ya persistido no se revierte; sigue el mismo patrón síncrono del módulo C. Se cubrió en unit y debe considerarse al reintentar una operación fallida.
- El detalle ofrece «Asignar prioridad» solo cuando la acción está habilitada. El Dialog precarga la prioridad y muestra «Prioridad actualizada» al guardar; recarga el mismo detalle. El listado muestra la columna Prioridad; J-01/J-02 transportan y muestran Alta/Urgente con texto, bandera y nombre accesible. J-03 no se modificó.
- `npx tsc --noEmit`, ESLint de código tocado y `npm run build`: sin errores; el build incluye la ruta nueva. Suite completa: 1022 passed, 42 skipped, 3 todo. Nueva suite PG C-10 en `noctium_test`: 2 passed, con fixture eliminada.
- HTTP autenticado con fixture temporal: Mesa 200 Alta/Urgente y no-op, 400 body extra, 404 id inexistente, 409 Cancelado; Gerente 403. GET del detalle reflejó Urgente. El fixture y sus eventos se eliminaron.
- Chrome headless cotejado con PDF págs. 3–5, 10 y 14–15: detalle y Dialog, foco inicial, Escape, Guardar, toast, listado, J-01/J-02. El turno semilla usado quedó restaurado con su auditoría original. Capturas en [`docs/auditorias/evidencia-c10/`](../../auditorias/evidencia-c10/); la última escritura de J-02 falló, pero su captura anterior (Alta) y la verificación DOM (Urgente) pasaron.
- **I-01:** integrada y aprobada según el usuario; la base `830d4b4` y `origin/develop` remoto no contienen servicio/rutas/modal ni se identificó commit/PR. Esta task no la reconstruyó ni hizo merge. La rama de entrega se creó desde esa base conservando C-10; la incorporación del trabajo aprobado es una tarea de integración aparte.
