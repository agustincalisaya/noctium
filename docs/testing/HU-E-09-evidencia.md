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

## Verificación final integrada — 09/10/2026

Validación sobre una rama local de revisión con E09, H06 y H07; cada rama de entrega mantiene únicamente su historia. Base PostgreSQL descartable local, sin modificaciones en una base compartida.

- `npm test`: **1851 aprobados**, 177 PostgreSQL omitidos por diseño; esos casos se ejecutaron separadamente.
- `npm run test:pg`: **177 aprobados** (143 + 18 + 16), migraciones reales, bases temporales eliminadas por el runner.
- Next.js build webpack y TypeScript: aprobados con Node 24.21.0. ESLint: cero errores; un warning preexistente de `CALENDARIO` en Sidebar.
- Catálogo de textos y detalle después del último ajuste de confirmación: 44 aprobados. Componentes de indicadores: 16 aprobados después del ajuste final de etiquetas.
- Fixtures combinados repetidos: 72 turnos, 205 inscripciones, 10 clases dictadas, 93 snapshots, 24 pagos, 136 eventos y 229 entradas de historial; conteos iguales antes/después. Esta medición incluye el registro de 05/01 realizado por la revisión UI.
- Playwright/Chromium con sesiones reales del seed, escritorio 1440×1000 y móvil 390×844. Sin excepciones de página. Capturas inspeccionadas visualmente. Las capturas inferiores usan scroll del contenido de la aplicación.
- La colección Postman queda disponible para repetir los casos; la ejecución HTTP efectiva se realizó con Playwright y sus cookies de sesión. No se ejecutó la aplicación Postman ni TablePlus: SQL read-only se ejecutó con `psql`.

Registro por Profesor desde la lista de alumnos: selección individual, confirmación, guardado y lectura con **2 presentes / 1 ausente**. Registro legacy se presenta sin control. Mesa verificó GET e idempotencia POST 200: un segundo envío con otras marcas conserva el snapshot original; payload inválido 400 y sesión ausente 401. Historial real: Matemática 3 presentes/3 ausentes = 50 %, Física 2/0 = 100 %, clases sin control excluidas. SQL de la HU ejecutado sin errores; atomicidad, concurrencia y ausencia sin efectos financieros cubiertos además por PostgreSQL real.

Capturas y resultados: `hu-e-09/`. Las verificaciones dependientes de E02/E08/E11/C14/B07 siguen diferidas, como se explica arriba.

Verificación diferida: Mi historial (E-08), corrección/anulación desde la aplicación (E-11), cancelación propia (C-14), baja de alumno (B-07) y acceso Gerente a la ficha (E-02). La HU ya consume valor vigente y clases no anuladas del modelo existente, comprobados con setup exclusivo de pruebas.

Decisiones de compatibilidad: GET sin clase vigente mantiene 404 CLASE_NO_REGISTRADA también para Profesor; clase registrada ajena responde 403. El resumen nuevo del Profesor se entrega solo para una materia autorizada mediante el helper específico; sin contexto de materia queda vacío hasta E-02, preservando el endpoint anterior sin ampliar datos.

Último build integrado de producción y revisión final Playwright: aprobados.

PR propio: https://github.com/agustincalisaya/noctium/pull/217. Base develop, sin mezclar commits de otras HU.
