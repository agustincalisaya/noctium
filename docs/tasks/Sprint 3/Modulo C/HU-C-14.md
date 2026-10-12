# TASK: HU-C-14 — Cancelar mi inscripción a una clase

**Módulo:** C (Gestionar turnos)
**Sprint:** 3 · **SP estimado:** 3
**Contrato:** `docs/specs/spec_modulo_C.md` §2.19
**RBAC:** `turnos:cancelar_propia` (Alumno)
**Schema:** completo por PR 0; sin migración.

## 0. Relevamiento previo a implementación

Confirmado por el usuario el 11/10/2026 sobre `feature/hu-restantes`, HEAD `f49a35746377e127a59022c005e4bc5963c26137`, con árbol limpio. El relevamiento autorizó el núcleo compartido, servicio transaccional, Route Handler, diálogo en Mis clases, leyendas diferidas de C-20, pruebas y evidencia. No se autorizaron migraciones, dependencias, commit ni push.

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

`cancelarInscripcionPropia(turnoId, usuarioId)` resuelve la ficha, lee la inscripción más reciente, bloquea clase e inscripción, marca reservas vencidas, relee y revalida estado, pago, plazo y parámetro vigente, y finaliza como `CANCELADA_ALUMNO`. Conserva pagos y devuelve `con_pagos`.

### 4.3. Route Handler

`POST /api/turnos/[id]/inscripcion/cancelacion`, protegido con `withPermission("turnos:cancelar_propia")`, responde con el envelope estándar y estados 403/404/409.

### 4.4. Server Action

No aplica.

### 4.5. Trazabilidad

`finalizarInscripcion` conserva fecha, actor y estado en la inscripción y encola el historial para después del commit. El servicio emite `turno:inscripcion_cancelada` (`turno_id, alumno_id, inscripcion_id, estado_pago, usuario_id`) y, si corresponde, `turno:disponible_nuevamente` (`turno_id, alumno_id_liberado, usuario_id`) después de resolver la transacción (spec C §4).

## 5. Frontend

«Mis clases» ofrece «Cancelar mi inscripción» cuando el evaluador responde `PERMITIDA`; con `FUERA_DE_PLAZO` muestra la acción deshabilitada con la leyenda contractual, y con `NO_APLICA` no la muestra (§2.17.4). La confirmación es irreversible, incluye datos reales y aviso de reintegro cuando el listado indica pago. El aviso de reintegro también acompaña al mensaje de éxito cuando la respuesta trae `con_pagos: true`, aunque el pago se haya registrado mientras el alumno confirmaba. Un rechazo queda dentro del diálogo. Al cerrarlo se refresca el listado.

## 6. Testing

### Nivel 1 — Unitario y componente

Límites inclusivos, excepción de reserva, estados no cancelables, contrato HTTP, confirmación, rechazo interno, envío compartido y leyendas C-20.

### Nivel 2 — API / Postman

Colección en `docs/testing/Modulo C/hu-c-14/HU-C-14.postman_collection.json`, con assertions de status, envelope y código para el éxito y cada error (401, 403, 404, 409). Su presencia no acredita ejecución.

### Nivel 3 — PostgreSQL

Consultas en `docs/testing/Modulo C/hu-c-14/HU-C-14.sql`. Tests descartables en `src/server/turnos/turno.cancelacion-propia.pg.test.ts`, que verifican también los payloads de los eventos. Las verificaciones ejecutadas y pendientes se registran en la evidencia.

## 7. Checklist de Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Núcleo, servicio, Route Handler y UI implementados.
- [x] Sin borrado físico ni modificación de pagos.
- [x] Identidad derivada de la sesión y permiso granular.
- [x] Confirmación C-25 y textos centralizados.
- [x] Pruebas focales documentadas.
- [x] PostgreSQL descartable: 7/7 (`turno.cancelacion-propia.pg.test.ts`, ver evidencia).
- [ ] Postman, navegador y CI: ver evidencia.
- [x] Commit de la implementación: 28165e3.
- [ ] Commit de las correcciones de auditoría, push, PR e integración: manuales, no autorizados.

## 8. Correcciones de auditoría

| Hallazgo | Corrección |
|---|---|
| P2-03 | `cancelacion` usa `NO_APLICA` como la spec C §2.17.4 (antes `NO_DISPONIBLE`). |
| P3-01 | Payloads de eventos completos según spec C §4. |
| P3-02 | Acción «Cancelar mi inscripción»; fuera de plazo, deshabilitada con la leyenda. |
| P3-03 | El aviso de reintegro también se decide con `con_pagos` de la respuesta. |
| P3-05 | Evidencia y task actualizadas con la corrida PG real y la colección con assertions. |
