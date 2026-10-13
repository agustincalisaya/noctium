# HU-D-08 — Corrección de selección por filtro (#169)

Base: `origin/develop` (`625fb4a`). Fuente de verdad: criterio 2 y [comentario de revisión](https://github.com/agustincalisaya/noctium/issues/169#issuecomment-6135608939). Referencias visuales: figuras 58–64 del prototipo, en especial 59–62.

## Resultado comprobado

Chromium con Playwright, aplicación Next.js real, rutas reales y PostgreSQL descartable `noctium_d08_revision_20261012`, con seed oficial y fixtures adicionales. Sesión del Gerente oficial. No se modificó la base de desarrollo.

- Escritorio 1366×950 y móvil 390×844: seleccionar las 206 clases, paginar conservando marcas, filtrar a Matemática conservando 205, ampliar sin restaurar la clase descartada. La tabla muestra diez filas; etiqueta y contador abarcan todo el filtro. Sin desbordamiento de la página; la tabla se desplaza horizontalmente en móvil.
- Cancelación de 205 seleccionadas: la confirmación informa 205 clases, un alumno y el aviso de reintegro. El alumno y su pago pertenecen a la clase 205, fuera de la primera página.
- Vista previa y cambio: tres solicitudes secuenciales de 100, 100 y 5, todas con HTTP 200. Se cambiaron 204; una quedó seleccionada con «Fuera de su horario de atención». Se comprobaron los registros de inscripción y pago sin cambios en PostgreSQL.
- Cancelar la fallida y la otra materia: inscripciones y pagos intactos, cero futuras ofrece Desactivar. Baja y reactivación reales; las clases canceladas no se restauraron. Al desaparecer la materia filtrada y quedar solo otra, la interfaz restablece el filtro para que esa clase siga accesible.
- Cancelación masiva adicional de las 204 clases del destino: tres solicitudes secuenciales de 100, 100 y 4, HTTP 200, contador agregado correcto y comprobación SQL de todas las clases canceladas.
- Sin errores JavaScript del navegador en ambos flujos.

`playwright-resultados.json` y `cancelacion-resultados.json` registran las comprobaciones y el tamaño/estado de las solicitudes. Las capturas muestran selección, confirmaciones, vista previa, resultado parcial y cero futuras. Los archivos de sesión y `.env` se mantuvieron fuera de Git.

## Pruebas adicionales

- 41 pruebas específicas de componente, servicios y rutas aprobadas. Incluyen selección individual, pagos/alumnos fuera de página, materias mezcladas, tandas 100+100+5, fallo de red en la segunda tanda, fallidas paginadas que desaparecieron del listado futuro y límite de 500.
- 10 pruebas PostgreSQL de HU-D-08 aprobadas en otra base descartable. El contrato comprueba las filas completas de `seleccion.items` y su independencia de la página.
- Suite general: 3.781 aprobadas, 477 omitidas y un timeout en la prueba negativa del analizador de textos (límite de 60 segundos). Reejecución aislada de ese archivo: sus 36 pruebas aprobaron. No se aumentó el timeout ni se modificó el analizador.
- TypeScript y comprobación CLI de claves aprobados. Lint sin errores; conserva la advertencia previa de `Sidebar.tsx` sobre `CALENDARIO` sin usar.
- Build de producción con `next build --webpack` aprobada. La compilación por defecto con Turbopack queda además a cargo de CI.

## Reproducción

Preparar una base **nueva y descartable** cuyo nombre comience con `noctium_d08_revision_`, aplicar las migraciones y ejecutar el seed oficial. Configurar la instancia de Next.js para esa base y levantarla en el puerto 3018 (o definir `D08_BASE_URL`).

1. Ejecutar `npx tsx 'docs/testing/Modulo D/hu-d-08/seleccion-filtro/fixtures.ts'`. `D08_ENV` permite indicar el archivo de entorno de prueba; la guarda rechaza otras bases. Genera `/tmp/d08-fixtures.json` (o `D08_FIXTURES`). Las fixtures requieren una base fresca para evitar colisiones con los nombres de materias.
2. Iniciar sesión con el Gerente oficial y guardar el `storageState` de Playwright en `/tmp/d08-browser-session.json` (o `D08_SESSION`). No versionar ese archivo.
3. Ejecutar `node 'docs/testing/Modulo D/hu-d-08/seleccion-filtro/playwright.mjs'` y después `node 'docs/testing/Modulo D/hu-d-08/seleccion-filtro/playwright-cancelacion.mjs'`.

Se requiere Playwright instalado en el entorno de pruebas. `PLAYWRIGHT_MODULE` permite indicar su módulo y `CHROMIUM_PATH` un Chromium del sistema; si se omiten se usan el paquete `playwright` y su navegador instalado. Ambos scripts escriben los informes y las capturas en este directorio y realizan mutaciones únicamente sobre la base descartable protegida por la guarda.

Los casos de fallo de red y truncado a 500 usan las pruebas del componente; no se simularon en el navegador real. Esta evidencia verifica el flujo de HU-D-08 y no certifica todos los módulos del sistema.
