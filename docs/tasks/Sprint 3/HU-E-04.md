# TASK: HU-E-04 — Registrar indicaciones académicas

**Módulo:** E (Atención académica / Historial) · **Sprint:** 3 · **SP estimado:** 2  
**Contrato:** `docs/tasks/Sprint 3/HU-Sprint-3.md`, HU-E-04 · `docs/specs/spec_modulo_E.md` §§2.3, 2.5.3, 2.9, 2.12.1 y 2.13 · `docs/tasks/Sprint 3/PR-0.md` · `docs/RULES.md` · `docs/DESIGN.md` · `docs/adicionales/mapa-pantallas-sprint-3.md` (DEC-20, M-22 y P-21).  
**Pantallas:** historial académico del alumno y sección de alumnos del detalle de turno/clase; prototipo `Noctium_Prototipo.pdf`, M-22.  
**Estado:** relevamiento SDD confirmado por el usuario el 08/10/2026; implementación y verificación de esta rama completadas para preparar PR independiente hacia `develop` (issue #173).

## 0. Alcance e inventario

Se agregó el registro inmutable de indicaciones. Cada alta conserva materia, texto, fecha/hora y autor; se permite más de una indicación por alumno y materia. La clase relacionada es opcional y el vínculo se valida contra alumno, materia y estado no anulado. No se agrega migración ni se modifica la matriz de permisos definida por PR 0.

### Archivos nuevos

| Ruta | Propósito |
|---|---|
| `src/server/historial/indicacion.schema.ts` y `.test.ts` | Validación estricta del cuerpo y límites. |
| `src/server/historial/indicacion.service.ts` y sus pruebas unitarias/PG | Reglas de alcance, elegibilidad de materia, vínculo opcional y persistencia transaccional. |
| `src/app/api/alumnos/[id]/indicaciones/route.ts` y `.test.ts` | Route Handler con permiso `indicaciones:registrar` y sobre HTTP estándar. |
| `src/app/(dashboard)/alumnos/[id]/registrar-indicacion-dialog.tsx` | Modal M-22, validación, confirmación HU-C-25 y manejo recuperable de errores. |
| `src/app/(dashboard)/turnos/[id]/alumnos/[alumnoId]/historial/page.tsx` | Entrada DEC-20 que limita el acceso del Profesor a su turno y lleva materia/retorno al historial. |
| `prisma/seed/fixtures/hu-e-04.ts` | Indicación reproducible ligada a la clase real de E-09. |
| `docs/testing/HU-E-04.postman_collection.json`, `.sql`, `-evidencia.md` y `hu-e-04/` | Casos API, comprobación de persistencia y evidencia verificable. |

### Archivos existentes extendidos

- `src/server/historial/historial.service.ts` y `src/types/historial.types.ts`: suma `INDICACION` a la consulta unificada, incluye `id`, autor/fecha local y vínculo vigente; conserva paginación y alcance de materia del Profesor.
- `src/app/(dashboard)/alumnos/[id]/page.tsx`, `historial-academico.tsx` y prueba: muestra la línea de tiempo, botón y leyenda de elegibilidad.
- `src/app/(dashboard)/turnos/[id]/page.tsx`, `turno-detalle.tsx` y `turno-alumnos-card.tsx`: agrega acceso desde cada alumno de la clase y abre el modal con alumno, materia y clase precargados.
- `src/server/turnos/turno.detalle.ts` y pruebas: reutiliza la misma regla de autorización para mostrar el enlace solo en turnos del Profesor.
- `src/lib/turno-detalle.ts` y prueba: formato de instante en `America/Argentina/Buenos_Aires`.
- `src/lib/textos.ts` e `index.ts` de fixtures: textos centralizados y alta ordenada después de la fixture E-09.

## 1. Contrato implementado

`POST /api/alumnos/[id]/indicaciones` recibe `{ materia_id, indicacion, clase_dictada_id? }`. El esquema es estricto, elimina espacios externos, exige texto y limita la indicación a 1000 caracteres. La respuesta es `201` con `{ data, error: null }` e incluye `id`, alumno, materia, texto, clase o `null`, fecha/hora y email del actor.

En el servicio, para Profesor se verifica primero `profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId)` antes de consultar si existe el alumno. Mesa no tiene recorte. Luego se exige alumno activo y al menos una clase dictada no anulada del alumno en la materia. Si hay clase relacionada, debe existir y no estar anulada (`404 CLASE_DICTADA_NO_ENCONTRADA`), pertenecer a esa materia y contener al alumno (`409 CLASE_DICTADA_NO_CORRESPONDE`). El alta se hace con `transaccion`; nunca edita ni reemplaza otra indicación.

El historial devuelve la indicación como tipo `INDICACION`, con la fecha local de registro para la línea de tiempo, email del autor y vínculo solamente mientras la clase esté vigente. El Profesor llega por DEC-20, recibe exclusivamente la materia del turno y usa la misma regla del servicio para habilitar el botón. Desde el turno, cada alumno del snapshot de esa clase puede abrir el historial incluso si ya no tiene inscripción vigente.

## 2. Validaciones realizadas

- Pruebas de esquema, servicio, Route Handler, alcance y renderizado; prueba de persistencia contra PostgreSQL real incluida en `docs/testing/HU-E-04-evidencia.md`.
- Seed ejecutado dos veces; la indicación de ejemplo se encuentra por clave natural y no se duplica.
- `npm test`, `npm run test:pg -- src/server/historial/indicacion.service.pg.test.ts`, `next typegen`, `tsc --noEmit`, verificador de claves, ESLint y build de producción webpack; resultados y límites concretos se registran en la evidencia.
- Playwright con sesión real de Mesa y Profesor; escritorio y móvil. Se comprobó alta repetible, alta con/sin vínculo, filtro de materia del Profesor, navegación DEC-20, elegibilidad antes y después de primera clase, confirmación, toast, persistencia y consola sin errores.
- SQL de comprobación es exclusivamente de lectura. No se ejecutó Postman como aplicación: las interacciones HTTP de la UI se verificaron con Playwright y las rutas también con pruebas automatizadas.

## 3. Diferido y límites

El criterio de «Mi historial» se completa al integrar HU-E-08. Si HU-E-11 anula una clase ya relacionada, la indicación permanece y la lectura oculta el vínculo; esa interacción futura queda diferida a E-11. No se permite editar, borrar ni marcar indicaciones como cumplidas, según contrato. No hay cambio de esquema/RBAC en esta HU.

## 4. Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Validación estricta, servicio transaccional y Route Handler con errores contractuales.
- [x] UI M-22 en ficha y desde detalle de turno; usa HU-C-25 y estados recuperables.
- [x] Historial unificado con id, fecha/hora local, autor y vínculo vigente.
- [x] Alcance de Profesor aplicado en servidor y botón, incluyendo la ruta DEC-20.
- [x] Fixtures idempotentes, pruebas unitarias/componentes y PostgreSQL real.
- [x] Build, TypeScript, lint y verificador de textos ejecutados.
- [x] Colección Postman, SQL, capturas y evidencia documentados sin afirmar ejecuciones no realizadas.
- [x] Rama y PR exclusivos de HU-E-04 hacia `develop`; sin auto-merge.

Detalles y resultados: [`docs/testing/HU-E-04-evidencia.md`](../../testing/HU-E-04-evidencia.md).
