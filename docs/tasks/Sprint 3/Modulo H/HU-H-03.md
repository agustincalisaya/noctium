# HU-H-03 — Clases por materia y profesor

Relevamiento aprobado el 09/10/2026. Issue #181, 3 SP. Contrato spec H §2.5, §2.8.1/4, reglas 3.9/10/15/16. [Inventario](RELEVAMIENTO-fidelidad-H03-H10.md). Base develop f3da75b tras integración por el usuario de #228.

## Implementación

Dos servicios puros componen C, L y D; dos GET con permiso indicadores:leer y schema de rango existente. Activos incluso cero, inactivos con datos, clases Disponible/Completo/Cancelado por fecha; Pendiente excluido. Horas suman Disponible/Completo, hasta dos decimales. Orden estable: cantidad, horas en profesor, nombre sin acentos/mayúsculas e ID. Sin acciones/escrituras de H.

Dos tarjetas horizontales en parte inferior de Actividad; mismo período. Profesor agrega horas al final y total contractual. Tablas con nombre completo, estado, clases y horas. IDs como categorías internas evitan colisión de nombres idénticos. Estados vacío/error/loading/reintento independientes. Alto crece con filas sin scroll vertical interno.

## Fixture y dependencia

hu-h-03.ts usa configurarTurno/asignarAulaTurno/asignarParticipantesTurno/cancelarTurno por claves naturales. 18 clases en seis meses anteriores: 6 disponibles/completas, 6 canceladas y 6 pendientes; una completa con cupo lleno. Históricos mediante conReloj, sin INSERT/UPDATE directo de hechos. Primer intento se superponía con seed base de clases futuras; se corrigió rango a meses anteriores, sin relajar validaciones C.

La baja completa D08 todavía no está integrada. Usuario autorizó explícitamente usar servicios públicos y documentar brechas el 09/10/2026. Activos cero e inactivos con datos están cubiertos en tests de servicio/UI; falta demostración de transición de baja D08 desde su pantalla. No se crea esa HU dentro de H03 ni se simula silenciosamente.

## Verificación

Resultados en docs/testing/HU-H-03-evidencia.md y hu-h-03/. 9 tests de servicio, 18 API, 10 UI (incluye 7 regresiones del panel) y 3 PG dirigidos aprobados. Lint dirigido, textos, typegen y tsc aprobados. Build webpack de producción aprobado. Primera revisión visual y corrección conjunta de etiquetas/aviso/alto; confirmación posterior registrada en la evidencia. SQL read-only y Postman propio preparado, no aplicación Postman ejecutada. Sin suites globales; procesos secuenciales y un worker.
