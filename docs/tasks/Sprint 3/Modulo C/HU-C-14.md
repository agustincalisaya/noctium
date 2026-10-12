# TASK: HU-C-14 — Cancelar mi inscripción a una clase

**Módulo:** C (Gestionar turnos)
**Sprint:** 3 · **SP estimado:** 3
**Contrato:** `docs/specs/spec_modulo_C.md` §2.19
**RBAC:** `turnos:cancelar_propia` (Alumno)
**Schema:** completo por PR 0; sin migración.

## 0. Relevamiento previo a implementación

Confirmado por el usuario el 11/10/2026 sobre `feature/hu-restantes`, HEAD `f49a35746377e127a59022c005e4bc5963c26137`, con árbol limpio. El relevamiento autorizó el núcleo compartido, servicio transaccional, Route Handler, diálogo en Mis clases, leyendas diferidas de C-20, pruebas y evidencia. No se autorizaron migraciones ni dependencias.

## 1. Nota de alcance

Implementa la cancelación propia sin borrar la inscripción ni modificar pagos. Usa el parámetro vigente de anticipación y la excepción de reserva sin pagar. Completa las leyendas de cancelación diferidas por C-20.

**Fuera de alcance:** gestión de N-01, reintegro de I-06, pantallas E-02/I-06/N-01, migraciones, permisos y refactorizaciones ajenas.

## 2. Historia de Usuario

**Como** alumno
**Necesito** cancelar mi inscripción a una clase futura
**Para** liberar el lugar cuando no voy a asistir.

Los siete criterios de aceptación son los definidos en `HU-Sprint-3.md` y contractualizados en C §2.19.

## 3. Alcance de esta task

- Evaluador único para listado y escritura.
- Cancelación transaccional con bloqueos y revalidación.
- `POST /api/turnos/[id]/inscripcion/cancelacion`.
- Acción y confirmación C-25 en «Mis clases».
- Leyendas de cancelación en el resumen de «Solicitar clase».
- Pruebas unitarias, de Route Handler, UI y regresión focal.

## 4. Contrato Backend

### 4.1. Schema Zod

No hay body ni identidad aportada por el cliente. El id proviene del segmento de ruta.

### 4.2. Servicio

`cancelarInscripcionPropia(turnoId, usuarioId)` resuelve la ficha, lee la inscripción más reciente, bloquea clase e inscripción, marca reservas vencidas, relee y revalida con el orden de la spec C §2.19 (clase cancelada, clase vencida, inscripción no vigente, anticipación mínima), y finaliza como `CANCELADA_ALUMNO`. Conserva pagos y devuelve `con_pagos`. El límite sale de una única función pura (`limiteCancelacionEnLinea`) que usan también el resumen de C-20 y el listado; el borde es inclusivo (el instante exacto del límite sigue permitido). `alumnos_inscriptos` sale de la regla de ocupación.

### 4.3. Route Handler

`POST /api/turnos/[id]/inscripcion/cancelacion`, protegido con `withPermission("turnos:cancelar_propia")`, responde con el envelope estándar y estados 403/404/409.

### 4.4. Server Action

No aplica.

### 4.5. Trazabilidad

`finalizarInscripcion` conserva fecha, actor y estado en la inscripción y encola el historial para después del commit. El servicio encola `turno:inscripcion_cancelada` (`turno_id, alumno_id, inscripcion_id, estado_pago, usuario_id`) y, si corresponde, `turno:disponible_nuevamente` (`turno_id, alumno_id_liberado, usuario_id`) con el historial compartido (spec C §4): se escriben después del commit, con reintentos y registro del error, y una falla del escritor no convierte en error una cancelación ya confirmada.

## 5. Frontend

«Mis clases» ofrece «Cancelar mi inscripción» cuando el evaluador responde `PERMITIDA`; con `FUERA_DE_PLAZO` muestra la acción deshabilitada con la leyenda contractual, y con `NO_APLICA` no la muestra (§2.17.4). La confirmación es irreversible, incluye datos reales y aviso de reintegro cuando el listado indica pago. El aviso de reintegro también acompaña al mensaje de éxito cuando la respuesta trae `con_pagos: true`, aunque el pago se haya registrado mientras el alumno confirmaba. Un rechazo queda dentro del diálogo. Al cerrarlo se refresca el listado.

## 6. Testing

### Nivel 1 — Unitario y componente

Límites inclusivos y borde exacto de la anticipación, excepción de reserva, estados no cancelables, contrato HTTP con un caso por cada código de error, confirmación, rechazo interno, doble envío con dos clics en su propio `act`, estados de la acción en «Mis clases» (habilitada, deshabilitada con la leyenda, sin acción) y leyendas de C-20 con la misma regla del límite.

### Nivel 2 — API / Postman

Colección en `docs/testing/Modulo C/hu-c-14/HU-C-14.postman_collection.json`: 10 solicitudes con assertions de status, envelope y código para el éxito y cada error (401, 403 sin permiso y sin ficha, 404 de clase e inscripción, 409 fuera de plazo, clase cancelada, clase vencida e inscripción no vigente). Ejecutada contra la aplicación con una base descartable (ver evidencia).

### Nivel 3 — PostgreSQL

Consultas con aserciones en `docs/testing/Modulo C/hu-c-14/HU-C-14.sql` (fila `CANCELADA_ALUMNO` con fecha y actor, historial, pagos intactos, cupo liberado y eventos). Tests descartables en `src/server/turnos/turno.cancelacion-propia.pg.test.ts` (35): borde exacto con reloj controlado, concurrencia con intercalado forzado (pago de I-10, doble cancelación, alta de otro alumno, baja de B-07, vencimiento de C-24), rechazos en el orden de la spec, IDOR, historial y eventos después del commit. Las verificaciones ejecutadas y pendientes se registran en la evidencia.

## 7. Checklist de Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Núcleo, servicio, Route Handler y UI implementados.
- [x] Sin borrado físico ni modificación de pagos.
- [x] Identidad derivada de la sesión y permiso granular.
- [x] Confirmación C-25 y textos centralizados.
- [x] Pruebas focales documentadas.
- [x] PostgreSQL descartable: 35/35 (`turno.cancelacion-propia.pg.test.ts`, ver evidencia).
- [x] Postman ejecutado (10 solicitudes, 53 aserciones) y SQL con aserciones ejecutado.
- [ ] ⏳ Recorrido de navegador de «Mis clases» y CI sobre el SHA del PR: ver evidencia.
- [ ] ⏳ Revisión e integración del PR.

## 8. Decisiones y ajustes de cierre

| Tema | Decisión |
|---|---|
| Orden de la revalidación | Clase cancelada, clase vencida, inscripción no vigente y anticipación mínima (spec C §2.19 paso 3); un `NO_APLICA` residual se informa con su motivo real (`TURNO_PENDIENTE` o `INSCRIPCION_NO_VIGENTE`). |
| Estado de la acción | `cancelacion` usa `NO_APLICA` como la spec C §2.17.4. |
| Límite de anticipación | Una sola función (`limiteCancelacionEnLinea`) para la cancelación y para C-20; el instante exacto del límite sigue permitido. |
| Eventos | Payloads completos según la spec C §4, encolados con el historial compartido: se escriben después del commit, con reintentos y registro del error. |
| Acción en «Mis clases» | «Cancelar mi inscripción»; fuera de plazo, deshabilitada con la leyenda. |
| Aviso de reintegro | También se decide con `con_pagos` de la respuesta. |
| `alumnos_inscriptos` | Sale de la regla de ocupación, no de un conteo de vigencia. |
| `limite_cancelacion_en_linea` | Se eliminó del objeto `inscripcion` de «Mis turnos»: ningún consumidor lo usaba. El resumen de C-20 conserva el suyo. |
