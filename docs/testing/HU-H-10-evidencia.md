# HU-H-10 — evidencia

Base `develop` d22806d (PR #230 C22 integrado). H03 #229 y fidelidad #228 ya integrados por el usuario, sus tres checks SUCCESS sobre cada head. HU-H-10 tiene diff propio; sidebar intacto. Actualización solicitada por el usuario: se revisaron los 23 archivos de C22, se hizo fast-forward sin conflictos y se repitió PG sobre esa base; no se reimplementó C22.

## Negocio y servicios

8 tests del servicio, 18 de rutas, 10 de UI/panel y 6 PostgreSQL dirigidos aprobados. Después de la actualización a C22 se repitió el archivo PG: 6/6 aprobado en una base descartable nueva, creada/migrada/eliminada por `scripts/test-pg.mjs`. El conteo C público no cambió con C22; centro conserva modo sin plazo hasta C24. H no duplica la clasificación de reservas ni escribe hechos.

Pruebas PG contrastan cuatro series con SQL independiente por fecha de clase, denominador de clases idéntico a H03, inscripciones vigentes/canceladas/vencidas sin bajas/quitadas, centro excluido de las tres series alumno, reserva marcada/sin marcar y cancelación/reinscripción (dos filas). El borde `venceEl = ahora` agrega vencida, conserva denominador y no escribe la fila: un ms antes cuenta vigente. Tasas una vez a un decimal; vacío null. Materia solo dos series; totales por materia equivalen al mensual.

Fixture de 13 meses, 26 clases; usa servicios configurar/asignar/cancelar C y crear/finalizar/marcarVencidas de la fachada pública PR0 con transaccion/conReloj. Claves naturales y revisión de vigencia antes de transicionar. Seed repetido conserva 136 turnos, 482 inscripciones y 24 pagos; test PG compara resultados e inscripciones antes/después. Última reserva de cada clase activa queda vencida sin marcar, con alumno exclusivo por mes. En las canceladas, una reserva creada antes de cancelar deja de vencer y se excluye junto con el resto de inscripciones.

SQL de revisión: [consultas](HU-H-10.sql), [resultados](hu-h-10/resultado-sql.txt). Mayo–Octubre 2026: tasa clases 13/85 = 15,3 %; inscripciones 13/189 = 6,9 %. Series mensuales separadas, ninguna suma entre unidades.

## Validación de interfaz

Build de producción y Chromium con sesión GERENTE. Viewports 1440×1000 / 390×844; período normal y 12/13/24 meses. HTTP 200 por defecto/6/24 meses; 400 por formato/rango invertido/25 meses; 403 Mesa/Profesor/Alumno y 401 anónimo. Tablas exactas por celda contra API, tasas, tooltip mouse/toque, período persistente, scroll local/ArrowLeft, loading/error/reintento y vacío futuro real aprobados. Sin errores de página ni overflow global. [Resultados](hu-h-10/resultados-http.json). Primera pasada conjunta desktop/móvil detectó desplazamiento innecesario en seis meses que recortaba el eje izquierdo; se redujo el ancho mínimo únicamente para series múltiples con ≤12 meses. Se conserva el ancho de barras y desplazamiento largo. Una confirmación posterior verifica seis meses sin scroll en desktop y etiquetas SVG contra API.

Comparación directa con figuras 57 (página física 51) y 54 (48): cuatro barras verticales agrupadas rojo/petróleo/ámbar/gris, dos horizontales por materia y dos tarjetas de tasas abajo. Para más de 12 meses mensual ancho completo y scroll local en recientes; nombres y valores legibles. Datos reales y cantidades de categorías distintos del ejemplo. Totales por serie/unidad en encabezado cumplen spec H §2.7; el PDF no ilustra esos totales. No se sustituyen por una suma. Dos materias con cancelaciones producen una tarjeta más corta que las diez del ejemplo; las tasas siguen debajo de ambos gráficos.

Capturas: [6 meses desktop](hu-h-10/cancelaciones-6-desktop.png), [13 meses](hu-h-10/cancelaciones-13-desktop.png), [24 meses](hu-h-10/cancelaciones-24-desktop.png), [móvil](hu-h-10/cancelaciones-6-mobile.png), [materia/tasas móvil](hu-h-10/materia-mobile.png), [tabla](hu-h-10/tablas-desktop.png), [tooltip táctil](hu-h-10/tooltip-touch.png), [error](hu-h-10/error-materia.png), [carga](hu-h-10/loading.png), [vacío](hu-h-10/vacio-real.png). Primera captura conservada en [primera-pasada](hu-h-10/primera-pasada/cancelaciones-6-desktop.png).

## Herramientas y límites

Vitest por archivos explícitos, `--maxWorkers=1`, heap 512 MB. 10 pruebas de regresión gráfico/presentismo/H10 tras ajuste visual aprobadas. Lint dirigido y textos aprobados; typegen/tsc aprobados. Build webpack heap 1536 MB y browser se ejecutan separados de tests/PG. No suites globales. [Postman](HU-H-10.postman_collection.json) preparado, no ejecutado en Postman; HTTP real se documenta aparte.

Usuario autorizó expresamente fixtures por servicios públicos del PR0 y documentar las brechas: todavía faltan pantallas completas C14/B07/D08. Se acredita la transición de inscripción y su lectura H10, queda pendiente demostrar esas operaciones desde sus pantallas. No se implementan esas HU dentro de este PR ni se afirma E2E de pantallas ausentes.

## Comandos dirigidos (Node 24)

Cada línea pesada se ejecutó después de finalizar la anterior, nunca en paralelo con PG/build/browser:

```sh
NODE_OPTIONS=--max-old-space-size=512 node node_modules/vitest/vitest.mjs run src/server/indicadores/cancelaciones.service.test.ts --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 node node_modules/vitest/vitest.mjs run src/app/api/indicadores/cancelaciones-por-mes/route.test.ts src/app/api/indicadores/cancelaciones-por-materia/route.test.ts --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 node node_modules/vitest/vitest.mjs run src/components/indicadores/cancelaciones-indicadores.test.tsx 'src/app/(dashboard)/gerente/indicadores-client.test.tsx' --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 node scripts/test-pg.mjs src/server/indicadores/cancelaciones.service.pg.test.ts
NODE_OPTIONS=--max-old-space-size=512 node node_modules/vitest/vitest.mjs run src/components/indicadores/grafico-indicador.test.tsx src/components/indicadores/cancelaciones-indicadores.test.tsx src/components/indicadores/presentismo-indicadores.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=1024 node --import tsx scripts/verificar-claves-textos.ts
NODE_OPTIONS=--max-old-space-size=1024 node node_modules/next/dist/bin/next typegen
NODE_OPTIONS=--max-old-space-size=1024 node node_modules/typescript/bin/tsc --noEmit
NODE_OPTIONS=--max-old-space-size=1536 node node_modules/next/dist/bin/next build --webpack
```

Lint por lista explícita de archivos tocados, heap 768 MB; se quitó una variable sin uso del fixture y se confirmó sin warnings. Browser usó el build final y se cerraron Chromium y servidor propio al terminar. Primera pasada y una única confirmación; sin rondas adicionales de pulido. HTTP exacto y capturas están versionados; helpers/sesiones quedan fuera de Git.
