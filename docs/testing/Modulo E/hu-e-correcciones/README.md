# Correcciones HU-E-04 / E-07 / E-08 / E-10 / E-11

Referencia: issues #173, #172, #176, #174 y #175; figuras 69–76 del `Noctium_Prototipo.pdf`. Validación local del 13/10/2026 sobre `develop` (`be491e4`).

## Alcance

- E-04/E-08: el calendario de una indicación convierte primero el timestamp almacenado en UTC y luego lo lleva a Buenos Aires. Una indicación registrada el `2026-10-13T02:37Z` aparece el **12/10**, a las **23:37**. La fecha de la clase vinculada viaja en el DTO de lectura y no depende de las opciones del formulario; Gerente la ve correctamente. El DTO de alumno sigue limitado a campos públicos.
- E-07: internas opcionales omitidas o vacías son válidas; contenido de solo espacios/tabulaciones/saltos de línea se rechaza en schema/API y en UI con un error asociado al campo. Máximo 1000 caracteres y temas obligatorios siguen vigentes.
- E-11, criterio 5: la anulación crea un hecho referenciado con estado anterior/nuevo, usuario, fecha y motivo. Original y alumnos permanecen idénticos. Una proyección PostgreSQL reserva un único registro vigente por turno y se libera transaccionalmente al anular. El bloqueo canónico serializa registro, corrección y anulación. La repetición exacta de la última anulación por el mismo actor devuelve la auditoría anterior, verificando nuevamente permiso, propiedad y plazo.
- E-04: indicación ámbar en la línea de tiempo. E-10: acciones compactas subrayadas; fecha/nota en dos columnas en escritorio; contexto del alumno y aviso de materia inmutable; «Guardar corrección» seguido de confirmación del valor anterior/nuevo.

E-02 no tenía un fallo propio confirmado: sus lecturas se comprueban por regresión. No se añaden funcionalidades de Pagos ni otras dependencias. **No hay cambios en `prisma/seed.ts` ni en `prisma/seed/`.**

## Comprobaciones

- `npm test -- --maxWorkers=2`: 293 archivos, 3980 casos aprobados; 503 casos PostgreSQL deshabilitados en esta pasada. Después del último ajuste de texto E-10, sus dos suites UI pasan de nuevo (8 casos).
- `npm run test:pg -- src/server/historial src/server/shared/permisos-e02.pg.test.ts`: 39 casos de integración y la regresión de seed oficial aprobados en bases descartables.
- `npm run test:pg`: **504 casos aprobados** en todas las pasadas del runner (incluye bases separadas para seed y guardas de nombres). La regresión de limpieza de C-06 se resuelve únicamente en la FK de la proyección nueva; ningún archivo de C cambia. Una prueba de E-11 verifica borrado de la proyección temporal y protección `RESTRICT` del original anulado.
- `npm run lint`, comprobador de claves de textos, `next typegen`, `tsc --noEmit` y `npm run build -- --webpack`: aprobados.
- Migración desde el esquema anterior con seed oficial: **28 originales idénticos**, anulación previa copiada con actor/fecha/motivo, proyección reconstruida y seed repetida sin duplicación (`migracion-resultados.json`).
- Playwright/Chromium real, Next/API/PostgreSQL, escritorio 1366×1000 y móvil 390×844: fechas, privacidad, permisos, validación, registro de observaciones, corrección de examen, primera asistencia legacy, anulación y nuevo registro. Resultado `PASS`, sin errores JavaScript (`playwright-resultados.json`).
- Capturas inspeccionadas: indicaciones/fecha vinculada; error de observaciones; modal E-10; anulación E-11. Los controles de asistencia y los otros módulos mantienen su diseño existente. Algunas capturas del servidor de desarrollo muestran su indicador de compilación; no pertenece al producto.

La migración se probó exclusivamente en PostgreSQL local descartable. Los esquemas y datos personales/demostrativos existentes no se modificaron.
