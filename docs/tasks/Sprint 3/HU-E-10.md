# HU-E-10 — Corregir o anular resultado de examen

**Módulo:** E (Atención académica / Historial) · **Sprint:** 3 · **SP:** 1
**Issue:** #174 · **Responsable:** Iván
**Contrato:** `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-E-10), `docs/specs/spec_modulo_E.md` §§2.10, 3.6–3.7, `docs/RULES.md` Regla N.° 8, `docs/DESIGN.md` y `Noctium_Prototipo.pdf`, figura de historial académico (M-23).
**Estado:** relevamiento SDD confirmado por el usuario; implementación y verificación en curso.

## Historia y criterios

Como personal de mesa de entrada o profesor sobre sus propios resultados, necesito corregir la fecha o la nota de un examen, o anularlo si fue cargado por error, para conservar un historial académico correcto.

1. En cada resultado del historial aparecen «Corregir» y «Anular» cuando el servidor autoriza esa operación.
2. La corrección modifica fecha y/o nota, aplica las validaciones de HU-E-06 y mantiene fija la materia.
3. La corrección y la anulación exigen un motivo de 1 a 300 caracteres. Se insertan como auditoría inmutable con valor anterior/nuevo cuando corresponda, actor y fecha; el resultado original no cambia. Lecturas, totales e indicadores usan la última corrección.
4. El resultado anulado permanece en la base. Se excluye del historial de alumno y Profesor, y se muestra a Mesa y Gerencia con etiqueta y motivo.
5. El Profesor solo corrige o anula resultados propios durante los siete días calendario inclusivos desde su registro; Mesa no tiene ese límite. El servidor vuelve a verificar alcance, plazo y estado dentro del bloqueo transaccional.
6. Mensajes de éxito: «Resultado corregido correctamente» y «Resultado anulado».

## Decisiones de implementación

- Se reutilizan las tablas y la migración de PR 0; esta HU no agrega una migración.
- `POST /api/alumnos/[id]/examenes/[examenId]/correccion` y `/anulacion` usan `examenes:corregir`. La fila original se toma con `SELECT ... FOR UPDATE`; las correcciones son una cadena y la anulación tiene unicidad por resultado. Repetir una anulación devuelve conflicto.
- `valor-vigente.ts` es la fuente compartida para nota/fecha de examen vigente y plazo local de Buenos Aires. El historial expone `corregido`, `anulado`, `puede_corregir` y, solo a Mesa/Gerencia, el motivo y la auditoría de anulación.
- La interfaz usa el historial existente. Antes de enviar, presenta el valor anterior y el nuevo; la anulación usa confirmación irreversible de HU-C-25. Los errores del servidor se conservan en la confirmación para permitir reintento.
- La fixture `hu-e-10.ts` crea un resultado de Profesor y otro de Mesa con el servicio de HU-E-06. Al repetir seed no duplica ni corrige/anula esos resultados.

## Archivos

- Servicio, schemas, lecturas vigentes, rutas y tests: `src/server/historial/resultado-examen.*`, `src/server/historial/valor-vigente.*`, `src/server/historial/historial.service.*`, `src/app/api/alumnos/[id]/examenes/[examenId]/{correccion,anulacion}/`.
- Interfaz y tipos: `src/app/(dashboard)/alumnos/[id]/historial-academico.tsx`, `resultado-examen-acciones.tsx` y sus pruebas; `src/types/historial.types.ts`; `src/lib/textos.ts`.
- Datos y evidencia: `prisma/seed/fixtures/hu-e-10.ts`, `prisma/seed/fixtures/index.ts`, `docs/testing/HU-E-10*` y `docs/testing/hu-e-10/`.

## Verificación

Las pruebas unitarias/componentes y de rutas cubren schema estricto, valores vigentes, permisos, límites, fechas futuras, escala, sin cambios, registros inexistentes/anulados y confirmación de interfaz. `resultado-examen.service.pg.test.ts` cubre persistencia con PostgreSQL real, cadena de correcciones, valor original, ventana inclusiva, visibilidad por rol y carreras de anulación.

La verificación de «Mi historial» queda diferida hasta HU-E-08. La consulta de Gerencia usa la autorización ya existente de HU-E-05. No se modifica ni se simula la verificación diferida de HU-E-11.

La ejecución final, Playwright, SQL de auditoría y resultado remoto se registran en `docs/testing/HU-E-10-evidencia.md`.
