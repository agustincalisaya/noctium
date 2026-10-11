# HU-C-19 — Clase en toda la interfaz

Estado: implementada y verificada localmente; preparada para PR separada a develop. Integración pendiente.
Issue #205, 1 SP, prioridad 8. Base develop e753682: #237, #238 y #239 integradas y checks aprobados. Rama feat/hu-c-19-clase-en-interfaz.

## Fuentes y decisiones

Issue completo, backlog Sprint 3, spec C (exclusión transversal, literal legacy y §2.17), task C-23 y su infraestructura integrada, RULES, DESIGN, SDD, PR-0 y siguientepasos.md. Prototipo figuras 8/9 y capturas aportadas. Guías Next instaladas de Server/Client Components y metadata leídas; catálogo compatible con ambos entornos.

No se encontró task de C-19 existente, rama remota con 19 ni PR abierta. Issue asignado a Ivanchuelaa y xRamex: no se infiere actividad por asignación; el usuario pidió continuar C-19 tras integrar la corrección #239. Documentar confirmación del relevamiento y rescate antes de escribir código.

Mis clases/Solicitar clase ya migradas en parte por C-20/C-22: reutilizar catálogo y no rehacer flujos. Quedan menú/home, listados, wizard/configuración, detalle/modales, calendarios, materias del profesor y errores de servidor/API. ETIQUETA_ESTADO_TURNO y el estado predictivo del wizard son presentación; los enums y valores API se conservan. Los errores de servidor se muestran en pantalla: centralizar su mensaje sin modificar code, status ni reglas.

La metadata vigente dice Noctium y no contiene Turno: conservarla. Emails de recuperación/contacto existentes no contienen terminología antigua: auditar sin reescribirlos. I-11/I-12 no tienen pantallas de impresión en la base; no crear esas HU dentro de C-19. Auditar datos/servicios disponibles, documentar esa verificación diferida y repetir al cierre del sprint. Mapa de pantallas Sprint 3 sigue ausente; inventario real abajo.

## Alcance

Todos los términos visibles pasan a Clase/Clases con concordancia, singular/plural y estados Disponible, Completa, Cancelada, Pendiente. Reformular registro como dictada: «Solo se puede registrar como dictada una clase Disponible o Completa». Mantener rutas /turnos, claves técnicas, nombres de variables, modelos, enums, permisos, eventos y datos existentes. No rediseño, migración de datos ni cambios de negocio.

La escritura de copy se hace en src/lib/textos.ts; consumidores literales pasan a texto(). Al modificar componentes se centraliza el copy visible del bloque/pantalla afectado para cumplir C-23, incluidos aria/ayuda/vacíos/confirmaciones. Las coincidencias técnicas y comentarios no se reemplazan indiscriminadamente. La expresión «turno de caja» de documentación técnica no autoriza cambiar un contrato de caja.

## Archivos de producción previstos a modificar

- `src/lib/textos.ts`
- `src/types/turno.types.ts`
- `src/components/layout/Sidebar.tsx`
- `src/components/shared/grilla-mensual.tsx`
- `src/components/shared/bloque-evento-calendario.tsx`
- `src/app/(dashboard)/home/page.tsx`
- `src/app/(dashboard)/calendario/materia/page.tsx`
- `src/app/(dashboard)/calendario/profesor/page.tsx`
- `src/app/(dashboard)/aulas/nueva/page.tsx`
- `src/app/(dashboard)/alumnos/[id]/page.tsx`
- `src/app/(dashboard)/turnos/turnos-listado.tsx`
- `src/app/(dashboard)/turnos/turno-configuracion.tsx`
- `src/app/(dashboard)/turnos/paso-alumnos-turno.tsx`
- `src/app/(dashboard)/turnos/paso-fecha-horario-turno.tsx`
- `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx`
- `src/app/(dashboard)/turnos/nuevo/turno-recurrente.tsx`
- `src/app/(dashboard)/turnos/nuevo/progreso-turno.tsx`
- `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx`
- `src/app/(dashboard)/turnos/[id]/turno-detalle-encabezado.tsx`
- `src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx`
- `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.tsx`
- `src/app/(dashboard)/turnos/[id]/reprogramar-turno-dialog.tsx`
- `src/app/(dashboard)/turnos/[id]/participantes/participantes-turno.tsx`
- `src/app/(dashboard)/profesores/[id]/materias-profesor-selector.tsx`
- `src/app/(dashboard)/profesores/[id]/ver-turnos-futuros-dialog.tsx`
- `src/app/api/pagos/route.ts`
- `src/app/api/pagos/opciones/route.ts`
- `src/app/api/turnos/[id]/route.ts`
- `src/app/api/turnos/profesores/opciones/route.ts`
- `src/app/api/profesores/[id]/materias/route.ts`
- `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.ts`
- `src/server/pagos/pago.schema.ts`
- `src/server/aulas/aula.service.ts`
- `src/server/profesores/profesor.service.ts`
- `src/server/profesores/actions.ts`
- `src/server/historial/clase-dictada.service.ts`
- `src/server/historial/observacion-clase.service.ts`
- `src/server/turnos/turno.cancelacion.service.ts`
- `src/server/turnos/turno.profesor.service.ts`
- `src/server/turnos/turno.reprogramacion.service.ts`
- `src/server/turnos/turno.reserva-error.ts`
- `src/server/turnos/turno.schema.ts`
- `src/server/turnos/turno.service.ts`
- `src/server/turnos/turno.aula.service.ts`
- `src/app/(dashboard)/turnos/nuevo/resumen-turno.tsx`
- `src/app/(dashboard)/turnos/[id]/alumnos/[alumnoId]/historial/page.tsx`
- `src/app/(dashboard)/turnos/[id]/asignar-prioridad-dialog.tsx`

Ampliación reportada durante la auditoría: `src/app/(dashboard)/turnos/seccion-aula-turno.tsx`, `src/app/(dashboard)/turnos/[id]/registrar-pago-dialog.tsx`, `src/server/turnos/turno.validaciones.ts`; sus ayudas y errores todavía usan terminología antigua.

Ampliación de auditoría completa reportada: `src/app/(dashboard)/turnos/[id]/turno-datos-card.tsx`, `src/app/(dashboard)/turnos/paso-materia-turno.tsx`, `src/app/(dashboard)/profesores/[id]/page.tsx`, `src/server/turnos/turno.generacion.service.ts`, y `src/server/turnos/turno.generacion.service.test.ts` (expectativa del límite). No cambia el límite ni los contratos.

## Tests existentes previstos a ajustar

Solo expectativas de mensajes/etiquetas migradas; preservar aserciones funcionales, code, status y rutas. Inventario inicial de coincidencias incluye ejemplos técnicos y datos de prueba: no modificar por una búsqueda textual ciega. Estos archivos son el alcance permitido si su expectativa de copy cambia:

- `src/app/(dashboard)/profesores/[id]/editar-materias.test.tsx`
- `src/app/(dashboard)/turnos/[id]/alumnos/[alumnoId]/historial/page.test.tsx`
- `src/app/(dashboard)/turnos/[id]/asignar-prioridad-dialog.test.tsx`
- `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.test.tsx`
- `src/app/(dashboard)/turnos/[id]/participantes/participantes-turno.test.tsx`
- `src/app/(dashboard)/turnos/[id]/registrar-observaciones-dialog.test.tsx`
- `src/app/(dashboard)/turnos/[id]/reprogramar-turno-dialog.test.tsx`
- `src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx`
- `src/app/(dashboard)/turnos/nuevo/turno-recurrente.test.tsx`
- `src/app/(dashboard)/turnos/nuevo/turno-wizard.test.tsx`
- `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`
- `src/app/(dashboard)/turnos/turnos-listado-profesor.test.tsx`
- `src/app/(dashboard)/turnos/turnos-listado.test.tsx`
- `src/app/api/pagos/route.test.ts`
- `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.test.ts`
- `src/app/api/profesores/[id]/materias/route.test.ts`
- `src/app/api/turnos/[id]/cancelacion/route.test.ts`
- `src/app/api/turnos/[id]/errores-dominio.route.test.ts`
- `src/app/api/turnos/[id]/participantes/route.test.ts`
- `src/app/api/turnos/[id]/prioridad/route.test.ts`
- `src/app/api/turnos/[id]/reprogramacion/opciones/route.test.ts`
- `src/app/api/turnos/[id]/reprogramacion/route.test.ts`
- `src/app/api/turnos/[id]/route.test.ts`
- `src/components/shared/grilla-mensual.test.tsx`
- `src/server/aulas/aula.modificar.test.ts`
- `src/server/historial/observacion-clase.service.test.ts`
- `src/server/pagos/pago.schema.test.ts`
- `src/server/profesores/profesor.materias.test.ts`
- `src/server/shared/errores-dominio.test.ts`
- `src/server/turnos/turno.aula.test.ts`
- `src/server/turnos/turno.autoservicio.test.ts`
- `src/server/turnos/turno.cancelacion.test.ts`
- `src/server/turnos/turno.configuracion.test.ts`
- `src/server/turnos/turno.inscripciones.test.ts`
- `src/server/turnos/turno.participantes.test.ts`
- `src/server/turnos/turno.profesor.test.ts`
- `src/server/turnos/turno.reprogramacion.test.ts`

## Crear

- `docs/tasks/Sprint 3/Modulo C/HU-C-19.md` (esta task).
- `src/lib/terminologia-clases.test.ts`: valores centrales sin Turno, estados femeninos y conservación de claves/representación interna; regresión de consumidores pertinente.
- `docs/testing/hu-c-19/README.md`: inventario, criterios, resultados y límites reales.
- `docs/testing/hu-c-19/inventario.json`: canales/pantallas, coincidencias técnicas permitidas y pendientes de cierre.
- Capturas PNG en `docs/testing/hu-c-19/` según rol/vista recorrida.

Actualizar esta task y, si hace falta una aclaración aditiva del contrato, `docs/specs/spec_modulo_C.md`. Si aparece otro archivo necesario, reportarlo antes de ampliarlo.

## Matriz criterio → evidencia

| CA | Archivos/vistas | Evidencia prevista |
|---|---|---|
| 1/2/6 | Catálogo y consumidores listados; menú, home, C, D y J | Búsqueda de literales y recorrido por rol; mensajes HTTP representativos |
| 3 | URLs /turnos, handlers, enums y errores | Diff de presentación; pruebas existentes de navegación y envelopes |
| 4 | Etiquetas compartidas y calendario/wizard | Render y estados femeninos; enum interno conservado |
| 5 | textos.ts y texto() | Checker C-23 y prueba de catálogo/consumidores |
| 7 | Errores de clase dictada y pagos | Frases reformuladas y pruebas de mensajes |
| 8 | Inventario de cuatro roles y canales | Auditoría de valores centrales y literales; figuras 8/9; repetir al cierre del sprint |

## Validación y recursos

Mantener pedido del usuario: verificaciones ligeras, secuenciales, un worker/prioridad baja; sin suite PG global ni build local. Ejecutar pruebas dirigidas por bloques, checker, lint dirigido y controles requeridos en CI remoto. PostgreSQL no requiere nueva suite de mutaciones: esta HU no cambia persistencia. Nivel API: lecturas/errores representativos y enlaces /turnos existentes, con cuentas oficiales; no atribuir mocks a HTTP. Nivel BD: constatar ausencia de cambios de dominio/esquema, no declarar pruebas PG que no se ejecutaron.

Recorrer con Playwright configurado/Chromium las pantallas existentes de Gerente, Mesa, Profesor y Alumno, escritorio y tamaño reducido, vacíos/errores/teclado relevantes. Figuras 8/9 guían el vocabulario y distribución vigente, no habilitan un rediseño. No tocar datos reales ni crear cuentas alternativas. No cambiar reservas/clases para producir capturas; reutilizar datos descartables si hacen falta. Registrar límite de futuras impresiones de I-11/I-12 y repetir auditoría al cierre del sprint.

PR exclusiva a develop, Closes #205; comprobar todos los checks del SHA final y CodeQL antes de entrega. No iniciar L-06 desde rama incompleta.

## Resultado de implementación y cierre

Confirmación explícita del usuario recibida antes de implementar. Se amplió el inventario al encontrar ayudas/rótulos/error de límite pendientes, y se reportaron los archivos antes de incorporarlos. Implementación sin cambios en schema, migraciones, URLs, enums, permisos, códigos, reglas o cantidades. Las directivas use client/use server permanecen al principio del módulo.

Catálogo y consumidores migrados; etiquetas compartidas de estados en femenino. Las pruebas mantienen IDs/rutas, códigos/status y aserciones funcionales. La expectativa de fuente de POST /api/pagos comprueba ahora la referencia central junto con el contrato HTTP.

Validación secuencial de prioridad baja y un worker: 37 archivos dirigidos (656 casos) con correcciones y repetición de los afectados; ronda focal posterior de 68 casos aprobada. Auditoría posterior de 7 archivos (139 casos): 137 aprobados, 2 corregidos en la tarjeta de datos y repetición de sus 40 casos aprobada. TypeScript final exit 0; checker C-23 final exit 0; lint dirigido final exit 0, con una advertencia preexistente CALENDARIO sin uso en Sidebar; diff --check aprobado. No build local ni suite PG global.

Recorrido real Chromium/Playwright de los cuatro roles, escritorio y móvil; ocho capturas, sin crear cuentas ni hacer seed o mutaciones de negocio. HTTP 404 con mensaje Clase y denegaciones 403 de Profesor/Alumno comprobadas. Referencia: [evidencia e inventario](../../../testing/hu-c-19/README.md), incluyendo límites de variantes y futuras impresiones I-11/I-12. Coincidencias técnicas permitidas clasificadas; repetir al cierre del sprint.

CI del SHA publicado: comprobar en los checks de la PR a develop (build, lint, Textos C-23 y CodeQL); el resultado se informa con el enlace de la PR. Merge pendiente del usuario. No iniciar L-06 hasta integrar C-19 y actualizar la base.
