# TASK: HU-E-08 — Consultar propio historial académico

Sprint 3 · Iván · 3 SP · Issue #176 · Rama `feat/hu-e-08-mi-historial`.
Estado: relevamiento del 09/10/2026 aprobado explícitamente por el usuario; E11 y refactor documental integrados en develop `c0bcd34`; implementación y validación local completadas; PR y CI pendientes.

## 0. Relevamiento previo a implementación

Base comprobada: develop `5935805`. E04/E07/E09/E10 integradas; E11 abierta. Worktree independiente `/tmp/noctium-sprint3-actual/e08`, a actualizar desde develop después del merge E11. No incluir commits E11 en el diff de E08 contra develop.

### Archivos existentes a modificar

- `src/server/historial/historial.service.ts`: consulta unificada en modo alumno, resolución del dueño desde sesión y proyección pública estricta.
- `src/server/historial/historial.schema.ts`: MiHistorialQuerySchema estricto.
- `src/server/historial/historial.service.test.ts`: aislamiento y compatibilidad de los demás modos.
- `src/types/historial.types.ts`: tipos específicos de respuesta propia, sin metadatos internos.
- `src/server/shared/rutas-por-rol.ts`: mi-historial exclusivo de ALUMNO.
- `src/proxy.ts`: proteger nueva ruta.
- `src/app/(dashboard)/alumno/page.tsx`: acceso Mi historial en contenido, pues el usuario prohíbe editar sidebar.
- `src/lib/textos.ts`: `ui.historial.propio.*`.
- `prisma/seed/fixtures/index.ts`: registrar fixture.
- `docs/specs/spec_modulo_E.md`: sincronización aditiva de E08, restricciones y diferencias visuales.
- `docs/tasks/Sprint 3/Modulo E/HU-E-08.md`.

### Archivos nuevos

- `src/app/api/mi-historial/route.ts` y `route.test.ts`.
- `src/app/(dashboard)/mi-historial/page.tsx`, `mi-historial.tsx`, `mi-historial.test.tsx`.
- `src/server/historial/mi-historial.pg.test.ts`.
- `src/server/historial/historial.schema.test.ts`.
- `prisma/seed/fixtures/hu-e-08.ts`.
- `docs/testing/HU-E-08.postman_collection.json`, `HU-E-08.sql`, `HU-E-08-evidencia.md`.
- `docs/testing/hu-e-08/historial-desktop.png`, `historial-mobile.png`, `historial-filtrado.png`, `historial-vacio.png`, `resultados-http.json`, `resultado-sql.txt`.

### Decisiones propuestas para aprobación

La figura 76 contiene descripción/autor del examen, aula/horario de clase y autor de indicación. Spec E §2.12.2 limita explícitamente la respuesta y excluye autores, observaciones de examen y turno_id. Propuesta: reproducir la composición visual (fechas, puntos, badges, nota a la derecha, texto y separadores) con los datos permitidos por la spec. Mostrar porcentajes por materia requeridos por backlog aunque el recorte de la imagen no los muestra. Si se exige incluir todos los metadatos visibles en la figura, aprobar previamente la ampliación del contrato público. No filtrar exámenes anulados después de paginar: excluirlos en la consulta de modo alumno antes de count/limit.

## 1. Nota de alcance

Spec E §2.12.2, §3.6, §3.7 y §3.10; backlog E08; mapa P12. Figura 76, página física 69 inspeccionada y tercera imagen del usuario. UI existente HistorialAcademico es referencia de comportamiento, no se reutiliza una respuesta interna completa como DTO del alumno.

## 2. Historia

Como alumno necesito consultar mis clases, asistencia, temas, exámenes e indicaciones para seguir mi progreso.

## 3. Alcance

Solo historial propio y filtro materia; sin escrituras. Fuera de alcance: otras HU, sidebar, pagos, nuevos registros académicos, datos de otros alumnos y observaciones internas.

## 4. Backend

GET /api/mi-historial con `historial:leer_propio`. `obtenerMiHistorial` obtiene ficha mediante `obtenerAlumnoDeUsuario(usuario.id)`. Sin ficha u otro rol: 403. Query alumno_id/alumnoId: 403 antes de Zod; cualquier otra desconocida: 400. materia_id opcional, pagina positiva y por_pagina máximo 10. Mismo SQL unificado en modo alumno, filtrando exámenes y clases anuladas antes de conteo/paginación. Proyección allowlist exacta §2.12.2, sin alumno/autor/email/turno/observaciones internas/acciones. Temas vistos null si faltan, indicación conservada tras anulación. Resumen de asistencia por materia con valor vigente, sin contar clases sin control ni anuladas. Orden fecha/creación/id descendentes y paginación servidor. Guardar contrato `{ data, error }` y cache no-store.

## 5. Frontend

Título Mi historial y subtítulo de figura 76; filtro Materia compacto y porcentajes por materia arriba. Una tarjeta blanca con línea de tiempo, fecha izquierda, punto y materia/tipo/texto al centro, nota a la derecha. Asistió/Ausente/sin control con texto y color semántico. Filtro reinicia página 1, paginación de 10 solo si hace falta. Carga, error/reintento, vacío literal «Todavía no tenés historial académico» y sin coincidencias. Descartar respuestas tardías. Responsive sin desbordamiento documental; sidebar intacto y entrada desde página alumno.

## 6. Pruebas y datos

Unit/UI/API: dueño de sesión, intento ID ajeno, roles, query estricta, filtro/página/orden, porcentajes, ausencia de claves sensibles, anulados no aparecen ni cuentan. PostgreSQL: mezclar tres tipos, más de 10 registros, correcciones vigentes, legacy, anulados, indicaciones desvinculadas e aislamiento entre dos alumnos. Fixture idempotente mediante servicios ya integrados y E11, con clases/exámenes/indicaciones y materias múltiples. Colección HTTP, SQL de contraste, Playwright escritorio/móvil con sesiones reales, errores/vacío/reintento y consola.

Checks: npm test, test:pg en base creada por runner local descartable, lint, textos, next typegen + tsc, build. CI final del PR tras actualizar develop. Ningún resultado se marca aprobado por existir evidencia de otra HU.

## 7. Definition of Done

- [x] Relevamiento y decisión de DTO público aprobados.
- [x] E11 integrado y rama actualizada desde develop.
- [x] Todos los criterios, aislamiento y ausencia de datos internos verificados.
- [x] Evidencia SQL/HTTP/Playwright y checks reales.
- [ ] PR independiente a develop, Closes #176, sin merge automático.

Organización documental: task ubicada en `Sprint 3/Modulo E` conforme al PR #223 (solo movimientos, integrado en develop).
