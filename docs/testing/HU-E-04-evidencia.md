# HU-E-04 — Evidencia de verificación

**Issue:** #173 · **Fecha:** 09/10/2026 · **Rama:** `feat/hu-e-04-indicaciones` · **Base de implementación:** `develop` en `24ca8da` · **Destino:** `develop`.  
**Resultado:** implementación completa y controles locales aprobados; PR individual a publicar/verificar.

## Pruebas y controles locales

- `npm test`: **1933 aprobadas**, **182 omitidas** (casos `test:pg` separados); 146 archivos aprobados y 27 archivos con casos omitidos.
- Pruebas enfocadas a HU-E-04 y la integración de UI/historial: **71 aprobadas**.
- PostgreSQL real: `npm run test:pg -- src/server/historial/indicacion.service.pg.test.ts`, **5 aprobadas**. Comprueba altas repetidas, autor/fecha, elegibilidad del Profesor, materia no cursada, alumno inactivo y clases vinculadas inexistentes, anuladas, de otra materia o sin el alumno.
- `next typegen`, `tsc --noEmit`, comprobador de claves de interfaz y `git diff --check`: aprobados.
- `npm run lint`: cero errores; un warning preexistente en `src/components/layout/Sidebar.tsx:46` por `CALENDARIO`.
- `npm run build -- --webpack`: build de producción aprobado con Node 24.21.0. Se usó webpack porque el binario de Turbopack falla con el enlace del `node_modules` compartido entre worktrees.
- `prisma db seed` se ejecutó dos veces en una base aislada de demostración; el conteo de fixture E-04 permaneció estable. El seed crea una indicación de Matemática vinculada a la clase real E-09 del 06/01/2026. Las altas adicionales de Playwright quedaron únicamente en esa base temporal.

## Playwright sobre la aplicación y PostgreSQL aislados

Servidor de producción local en `127.0.0.1:3131`; base `noctium_e07_demo` en cluster aislado `127.0.0.1:55445`. Sesiones de prueba reales, sin tocar la base de la aplicación compartida.

- **Mesa de Entrada:** registró dos indicaciones para Sofía Fernández, una con clase relacionada y otra sin vínculo. El historial permitió repetir altas, presentó autor/fecha local y mostró el vínculo solo en la primera. La evidencia visual está en `hu-e-04/`.
- **Profesor:** desde el detalle de su propia clase abrió el historial con `materia_id` fijo, registró otra indicación y la vinculó con la clase del 07/05/2026. El navegador obtuvo `201 Created`; el cuerpo de respuesta incluyó `profesor1@noctium.local`, fecha, texto, alumno, materia y clase. Luego el GET de historial devolvió `200` con el nuevo ítem.
- **Antes de la primera clase:** Emilia Acosta, inscrita para una clase futura propia de Laura y sin clase dictada previa de Matemática, llegó por la ruta DEC-20. `Registrar indicación` quedó deshabilitado y apareció exactamente la leyenda contractual. Los componentes reutilizan la misma regla del servicio.
- El modal y el historial se revisaron a 1440×1000 y 390×844. No se observó desborde horizontal; confirmación y formulario conservaron controles utilizables en móvil.
- La consola del navegador no registró errores. Las capturas y la lista HTTP conservada están bajo `hu-e-04/`.

HTTP observado en la verificación final del Profesor: `POST /api/alumnos/cmv11e2v3000ojmpth73cnlbv/indicaciones` → **201**, seguido por `GET …/historial?pagina=1&por_pagina=10&materia_id=cmv11e2yc004jjmptvmwf545x` → **200**. Identificador del registro nuevo: `cmv12v93n0008jm8gcwi1nq0m`.

## SQL de lectura y datos de ejemplo

`HU-E-04.sql` lista indicaciones y autores y comprueba que no haya vínculos vigentes con una materia o alumno incorrectos. Ejecutado con `psql` contra la base aislada; el chequeo `vinculos_invalidos` devolvió **0**. En las indicaciones del test de Sofía se observan registros distintos para Mesa y Profesor, y el actor coincide con el rol de sesión.

La colección Postman está preparada para repetir altas Mesa/Profesor, GET del historial y códigos 403/404/409. **No se ejecutó Postman como aplicación**: las llamadas efectivas de navegador se capturaron con Playwright, las rutas se verificaron con tests y el SQL se ejecutó con `psql`.

## Diferidos contractuales

- La aparición de indicaciones en `GET /api/mi-historial` se verifica al integrar HU-E-08.
- Cuando HU-E-11 anule una clase relacionada, la indicación se conserva y el historial oculta el vínculo; se verificará con esa integración.
- No se edita, borra ni marca como cumplida una indicación; no está previsto por HU-E-04.

Ver colección reproducible: [`HU-E-04.postman_collection.json`](HU-E-04.postman_collection.json). Consulta de persistencia: [`HU-E-04.sql`](HU-E-04.sql).
