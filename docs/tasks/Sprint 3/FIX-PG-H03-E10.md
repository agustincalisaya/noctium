# Corrección PostgreSQL H-03 / E-10

## Relevamiento previo

Solicitada por el usuario después de publicar D-08. Base final develop 81b90a4, incluye PR #237 y D-08 (#238) integrada. PR separada. Siete pruebas pasan también sobre esta base final.

Fuentes: spec E §§2.5.3, 3.8 y 3.10; task Sprint 3/HU-E-10.md; spec H §§2.5 y 3.17.3; task Modulo H/HU-H-03.md; PR-0, ocupación e inscripción vigentes. Ambos fallos se reprodujeron en develop anterior a D-08.

E-10 pide historial del Profesor sin materia_id: el contrato exige 403. Corregir la preparación/query del escenario de visibilidad, conservando una prueba negativa sin materia y una positiva con materia. Verificar que el examen anulado permanece para Mesa/Gerencia y se oculta a Profesor/Alumno.

H-03 espera un COMPLETO persistido a partir del seed general. La cobertura de estados no debe depender de reservas históricas que vencen ni de ejecución previa de otras suites. Preparar escenarios propios de Disponible, Completo, Cancelado y Pendiente en la base descartable, con fechas y reloj definidos, cupo/inscripciones consistentes y servicios/fábricas existentes. Mantener el contraste SQL y las aserciones de estados, cantidades y horas. No eliminar la aserción de Completo ni cambiar las reglas de indicadores.

## Archivos exactos

Modificar:
- src/server/indicadores/clases.service.pg.test.ts
- src/server/historial/resultado-examen.service.pg.test.ts

Crear:
- docs/tasks/Sprint 3/FIX-PG-H03-E10.md (este relevamiento)
- docs/testing/FIX-PG-H03-E10.md (resultados reales, fuentes, límites)

Sin cambios previstos de servicios de producción, schema, migraciones o seed. Si la investigación dirigida revela un error de producción, reportar el hallazgo y revisar alcance antes de modificar otros archivos.

## Verificación prevista

Solo los dos archivos PostgreSQL y controles dirigidos necesarios; una ejecución secuencial, un worker y prioridad baja. Base descartable, nunca la base del usuario. No suites completas ni build local mientras el usuario juega. Checks de la PR en GitHub. Registrar qué se ejecutó realmente; no afirmar que todo el proyecto queda libre de fallos.

Estado: relevamiento confirmado explícitamente por el usuario; implementación y pruebas dirigidas completadas, pendiente de revisión/integración de PR.

## Resultado

E-10 agrega materia_id a la consulta positiva del Profesor, comprueba el 403 sin materia y verifica que Alumno tampoco ve el examen anulado. La clase dictada sí permanece visible al Profesor: no basta una lista vacía para aprobar el ocultamiento.

H-03 reemplaza el seed completo por fábricas compartidas PR-0, con reloj fijo en junio de 2026, cuatro estados y una Completa con cupo 1 e inscripción histórica sin vencimiento creada en la misma transacción. El alumno de preparación queda inactivo y no participa de futuras selecciones de seed. Mantiene contraste SQL y asserts de los estados; agrega cantidades exactas (3 clases, 3 horas), y activos con cero. No cambia el seed ni servicios de producción.

Dos archivos PostgreSQL: 7 pruebas aprobadas. Lint dirigido y diff-check aprobados. Evidencia en docs/testing/FIX-PG-H03-E10.md. Sin suite completa ni build local.
