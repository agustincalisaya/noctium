# HU-E-08 — Mi historial académico

09/10/2026. Base develop `c0bcd34`, E11 #224 integrado con tres checks remotos aprobados. Refactor documental #223 integrado; task en `docs/tasks/Sprint 3/Modulo E/HU-E-08.md`.

## Implementación

Dueño resuelto de sesión mediante fachada B. GET propio con `historial:leer_propio`, `alumno_id`/`alumnoId` rechazados con 403 antes de validar, query estricta y respuesta no-store. Consulta SQL unificada reutilizada; exclusión de clases/exámenes anulados antes de conteo y paginación. DTO allowlist sin identidad de alumno, observaciones internas, observaciones del examen, autores, turno, acciones o auditoría.

Línea de tiempo con fechas descendentes, tres tipos distinguibles, asistencia vigente, temas públicos, nota e indicaciones; filtro de materia reinicia página y páginas de diez. Porcentaje por materia excluye anuladas/sin control. Loading, vacío literal, error y reintento; respuestas antiguas descartadas. Acceso desde contenido de `/alumno`, sidebar intacto. Figura 76 aplicada con los campos permitidos del contrato aprobado; los metadatos excluidos del DTO no se inventan.

## Validación realmente ejecutada

- Unit/API/UI dirigidas: 37 y 5 aprobadas.
- `npm test -- --maxWorkers=1`: **2072 aprobadas, 197 omitidas**. Primera pasada detectó referencia dinámica de textos no demostrable; se corrigió a claves explícitas y se repitió completa.
- PostgreSQL E08: **1 prueba de integración extensa aprobada**: 14 hechos vigentes, dos páginas, tres tipos, corrección de asistencia/nota, anulaciones, legacy, indicación conservada, filtro, orden, aislamiento y usuario sin ficha.
- `npm run test:pg`: general **162 aprobadas, 1 fallida, 34 omitidas**; adicionales **18 y 16 aprobadas**. Único fallo E10 ya reproducido sobre develop sin E11/E08: `resultado-examen.service.pg.test.ts` consulta Profesor sin materia requerida y recibe SIN_PERMISO. No se cambiaron pruebas ni autorización de E10 para ocultarlo.
- `npm run lint`: 0 errores, 1 advertencia previa CALENDARIO sin uso en Sidebar intacto.
- `npx tsx scripts/verificar-claves-textos.ts`: aprobado.
- `npx next typegen && npx tsc --noEmit`: aprobado.
- `npm run build -- --webpack`: aprobado.
- Seed propio repetido dos veces: SQL y conteos iguales. Conteos 80 turnos, 228 inscripciones, 17 clases, 11 exámenes, 4 indicaciones, 24 pagos. Servicios públicos usados para hechos y matrículas; base exclusiva `noctium_e08_review_20261009`.
- SQL read-only de contraste ejecutado: [resultado-sql.txt](hu-e-08/resultado-sql.txt).

Colección Postman preparada; no ejecutada en la aplicación Postman. Playwright real sobre build de producción: escritorio 1440×1000, móvil 390×844; filtros, pagina 2, reinicio pagina 1, acceso desde Mis turnos, tres tipos, aislamiento HTTP, roles 403, anónimo 401, error 503 y reintento. Sin errores de página ni desbordamiento móvil. Vacío UI con sesión real y respuesta simulada (todos los alumnos activos del seed tienen clases); el dueño sin hechos sí se verificó contra PostgreSQL real. Capturas revisadas conjuntamente. HTTP real y navegador se documentan en `hu-e-08/resultados-http.json` y capturas. Sin credenciales/cookies/tokens en evidencia.

## Entorno y alcance

Node 24, PostgreSQL 17 local 55443, runner crea/elimina bases descartables propias. Checks pesados serializados. Sin merge automático. E02 se conserva en una rama independiente; H03/H10 fuera de alcance.
