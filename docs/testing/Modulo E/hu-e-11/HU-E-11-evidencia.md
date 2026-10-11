# HU-E-11 — Evidencia de implementación

Fecha: 09/10/2026. Base: develop `5935805`. Referencia: figuras 74–75 del prototipo, páginas físicas 67–68. Sidebar sin modificaciones.

## Criterios e integración

Corrección con snapshot precargado, motivo obligatorio de 1–300 caracteres y estados anteriores/nuevos append-only; primera carga legacy con todos presentes. Mesa sin límite temporal; Profesor solo clases propias hasta el séptimo día calendario de Buenos Aires. Anulación conserva el registro y auditoría mediante la excepción T3 aprobada del contrato existente. Re-registro crea otro identificador.

PostgreSQL real comprueba correcciones consecutivas, rollback, concurrencia, snapshot original intacto, observaciones ocultas, indicaciones conservadas sin vínculo, exámenes intactos, porcentajes e indicadores H07 sin clase anulada, pagos e inscripciones intactos. No se ampliaron H03/H10.

## Comandos y resultados

- `npm test -- --maxWorkers=1`: **2042 aprobadas, 196 omitidas**. La pasada inicial paralela tuvo un timeout del verificador de textos; se repitió completa en secuencia sin cambiar pruebas.
- `npm run test:pg -- src/server/historial/correccion-clase.pg.test.ts src/server/historial/clase-dictada.service.pg.test.ts src/server/historial/asistencia.pg.test.ts`: **19 aprobadas**.
- `npm run test:pg`: pasada general **152 aprobadas, 3 fallidas, 41 omitidas**; pasadas de bases con nombre exigido **18 y 16 aprobadas**. Dos fallos y un setup omitido fueron timeouts de inscripciones bajo presión de memoria. Repetición aislada de ambas suites y E10: **22 aprobadas, 1 fallida**.
- Fallo restante: E10 `resultado-examen.service.pg.test.ts`, «conserva el anulado y lo muestra solo a Mesa y Gerencia en el historial». Consulta el historial del Profesor sin `materia_id` requerido y recibe `SIN_PERMISO`. **Reproducido también sobre develop sin cambios E11: 3 aprobadas, 1 fallida**. No se debilitó la autorización ni se modificó esa historia.
- `npm run lint`: 0 errores; 1 advertencia previa en Sidebar (`CALENDARIO` sin uso), archivo intacto.
- `npx next typegen && npx tsc --noEmit`: aprobado.
- `npm run build -- --webpack`: aprobado. Primer intento terminado por SIGKILL bajo falta de memoria; repetición exitosa después de conservar las cachés tmpfs en disco.
- Pruebas UI afectadas repetidas tras el ajuste visual final: **35 aprobadas**.
- `npx tsx scripts/verificar-claves-textos.ts`: aprobado.
- Seed ejecutado dos veces sobre base propia `noctium_e11_review_20261009`: IDs y conteos idénticos mediante comparación SQL. Antes del navegador: 77 turnos, 225 inscripciones, 14 clases, 110 filas snapshot, 1 corrección, 1 anulación y 24 pagos.
- Contraste `psql -X -v ON_ERROR_STOP=1 -f docs/testing/HU-E-11.sql`: ejecutado; resultado en [resultado-sql.txt](hu-e-11/resultado-sql.txt).

## HTTP y navegador reales

Playwright con Chromium, escritorio 1440×1000 y móvil 390×844. Profesor propio/ajeno, Mesa, Gerente, Alumno y anónimo. Resultado: [resultados-http.json](hu-e-11/resultados-http.json).

Verificado: precarga, corrección persistida, error 503 y reintento conservando motivo, motivo inválido 400, conjunto incompleto 400, sin cambios 409, plazo y roles 403, anónimo 401, foco inicial Volver, motivo obligatorio, anulación 200, registro oculto 404, re-registro 201 con ID nuevo y primera asistencia legacy. Sin errores JavaScript de página. Capturas finales revisadas visualmente en `hu-e-11/`; recuperación del GET tras 503 aprobada, sin desbordamiento horizontal móvil. Capturas finales realizadas contra el build de producción, sin guardar nuevas correcciones/anulaciones.

Colección Postman preparada por contrato. **No ejecutada en Postman**; las peticiones reales se ejecutaron desde Playwright. No incluye contraseñas, cookies o tokens.

## Entorno

Node 24; PostgreSQL 17 local puerto 55443. Runner crea y elimina sus propias bases descartables; no resetea la base de conexión. Se conservaron las cachés y el cluster temporal trasladándolos desde tmpfs a disco ante falta de espacio/memoria; rutas anteriores conservadas mediante enlaces. Las comprobaciones pesadas se serializaron.

## Entrega e integración

PR independiente hacia develop, `Closes #175`, sin merge automático. E08 requiere E11 integrado en develop antes de construir/publicar su PR. E02 conserva su propia rama. Checks remotos se registrarán contra el último SHA publicado.
