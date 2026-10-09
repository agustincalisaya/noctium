# HU-E-09 — Evidencia

Relevamiento confirmado explícitamente el 08/10/2026. Rama `feat/hu-e-09-asistencia`; issue #207. Implementación aditiva de E-01/E-05, sin migración.

## Verificación ejecutada durante desarrollo

- Unitarios iniciales: 55 pruebas aprobadas (servicio, schema, historial y detalle).
- Pasada final específica: 94 pruebas aprobadas en siete archivos (servicio/schema/historial, API, detalle, historial UI y reloj de configuración). Incluye selección individual/masiva, confirmación y estados persistidos.
- PostgreSQL real: 10 pruebas aprobadas en `clase-dictada.service.pg.test.ts`, usando `npm run test:pg -- src/server/historial/clase-dictada.service.pg.test.ts` y base descartable del runner en 127.0.0.1:55443. El runner aplica migraciones y elimina su base al terminar.
- `npx next typegen` y `npx tsc --noEmit --pretty false`: aprobados. ESLint sobre archivos de la HU: sin errores tras sustituir la lectura impura del reloj en render por estado actualizado en efecto.
- Seed dos veces sobre `noctium_e09_fixture_check`: mismos conteos (41 turnos, 9 inscripciones, 2 clases dictadas, 6 snapshots, 12 eventos de turno, 9 entradas de historial). La segunda corrida no modifica IDs ni agrega eventos; SQL confirma clase 05/01 sin registrar y estados de 06/01 y 07/01.
- La prueba real detectó la conversión incorrecta de Date hacia columna SQL date en un servidor UTC−3. El INSERT ahora parametriza el string calendario con `::date`, conservando exactamente la fecha del turno; el test exige esa igualdad.

Las pruebas PostgreSQL cubren snapshot/auditoría y pagos inalterados, compatibilidad sin cuerpo, validación/rollback, reserva vencida con evento posterior al commit, descarte de evento en rollback, dos registros simultáneos, registro después de una anulación, lectura de corrección vigente coherente entre GET/historial/lectura pública, fin exacto y entrada HTTP.

## Datos de presentación

El seed de la HU usa servicios de configuración, aula, participantes y registro; no escribe directamente turnos, inscripciones ni asistencias. La clave natural (fecha/hora/profesor/materia) mantiene los IDs generados entre corridas.

- Profesor: `profesor1@noctium.local` (Laura Giménez); autor: `mesa.entrada@noctium.local`.
- Materia: Matemática; horario 11:00–12:00; tres alumnos activos ordenados por DNI.
- 2026-01-05: sin registrar, preparado para demostrar la interacción completa.
- 2026-01-06: dos presentes y un ausente.
- 2026-01-07: registro sin control, excluido del porcentaje.
- IDs concretos y alumnos se consultan con `HU-E-09.sql`. La colección Postman requiere esos valores y una sesión autenticada; los casos de alta son independientes.

## Verificación final pendiente

La revisión final integrada registra aquí resultados de suite completa, build y Playwright/API reales, y guarda capturas en `docs/testing/hu-e-09/`. No se afirma ejecución de Postman hasta contar con ella: Playwright puede ejecutar sus contratos con las cookies autenticadas.

Verificación diferida: Mi historial (E-08), corrección/anulación desde la aplicación (E-11), cancelación propia (C-14), baja de alumno (B-07) y acceso Gerente a la ficha (E-02). La HU ya consume valor vigente y clases no anuladas del modelo existente, comprobados con setup exclusivo de pruebas.

Decisiones de compatibilidad: GET sin clase vigente mantiene 404 CLASE_NO_REGISTRADA también para Profesor; clase registrada ajena responde 403. El resumen nuevo del Profesor se entrega solo para una materia autorizada mediante el helper específico; sin contexto de materia queda vacío hasta E-02, preservando el endpoint anterior sin ampliar datos.
