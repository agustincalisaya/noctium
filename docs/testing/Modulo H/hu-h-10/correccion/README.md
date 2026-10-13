# HU-H-03 / HU-H-07 / HU-H-10 — corrección de indicadores

12/10/2026. Capturas y validación visual sobre `develop` en `1ce32c5`. Rama: `fix/hu-h-10-graficos-cancelaciones`. La entrega se actualizó sin conflictos sobre `develop` en `6fceff4` y se repitieron las 129 pruebas dirigidas. Los cambios posteriores de CSS afectan únicamente impresión de comprobantes y cierres de caja.
La entrega reúne la corrección de la issue #191 y los ajustes de presentismo de H-07 y del filtro compartido que también usa H-03, según las observaciones recibidas.

## Cambios

- Desplazamiento horizontal solo cuando el contenedor realmente desborda; se oculta el desborde de redondeo de hasta un píxel.
- Ancho estable para los grupos de cuatro series, con espacio adicional cuando las cifras son largas. Todos los meses se renderizan; el recorrido comienza en los recientes.
- Materias: altura máxima de 320 px, recorrido vertical con muchas filas, margen derecho según la longitud de las cifras y separación suficiente entre las etiquetas de las dos series.
- Para períodos de más de 12 meses, ambas tarjetas usan la fila completa; las tasas conservan su fila de dos columnas en escritorio.
- Singular en totales y denominadores: «1 inscripción» y «1 clase».
- Gráficos y tablas desplazables accesibles mediante foco de teclado.
- Filtro común de las tres pestañas: últimos 24 meses hasta el mes actual del centro; se quitaron las tres opciones futuras.
- Presentismo: grupos mensuales legibles, ausentes centrados sobre cada par, cifras separadas de la línea, «Sin registros» en los meses sin inscripciones y línea interrumpida entre períodos sin datos. El 0 % con registros conserva su punto en la línea.
- Presentismo por materia: fila completa para períodos largos, altura acotada, nombres con elipsis según el espacio real y detalles completos accesibles por tabla. En móvil, los detalles de cantidades muy altas admiten desplazamiento horizontal útil para conservar espacio para las barras.

No se modificaron servicios, consultas, contratos HTTP, cálculos ni ordenamiento de materias.

## Comprobación

`resultados.json` contiene 14 casos de Playwright sobre la pantalla integrada `/gerente`: escritorio 1440×1000 y móvil 390×844; períodos de 6, 12, 13, 22 y 24 meses; 1, 2, 3, 8 y 16 materias; nombres largos, una materia inactiva, cantidades altas y singular.

Los casos extremos interceptan respuestas HTTP con datos deterministas; renderizan los componentes, estilos y filtro reales. Las capturas `real-*` usan los endpoints reales, sin interceptar datos. Las cifras de los escenarios sintéticos se distinguen de las cifras reales del seed.

Se comprobó:

- Todas las categorías existen en el SVG y las tablas conservan cada fila y cada valor.
- Ninguna cifra queda fuera del SVG ni se superpone a otra, incluso con cantidades altas en móvil.
- Seis meses y pocas materias caben en escritorio sin desplazamiento horizontal.
- Meses anteriores accesibles con mouse, teclado y tacto; materias numerosas accesibles por los mismos medios.
- Tablas con desplazamiento horizontal accesible por teclado; nombres completos e inactivas disponibles en la tabla.
- Inicio en meses recientes, aviso de recorrido, ausencia de desborde global y tasas iguales a las respuestas del escenario.
- Sin excepciones de página.

`datos-reales.json` conserva las respuestas reales posteriores, idénticas a las guardadas antes de editar. `comparacion-sql.json` verifica con SQL independiente las cuatro series, los denominadores y las dos tasas: 13 clases canceladas de 85 (15,3 %), 13 inscripciones canceladas de 189 (6,9 %), 55 reservas vencidas y 6 bajas. Las sumas de las dos series por materia coinciden con los totales mensuales.

Validación local: 129 tests dirigidos en 18 archivos, ESLint de los archivos modificados, generación de tipos de Next.js, TypeScript del build, verificación de claves de textos y `git diff --check` aprobados. Build de producción con Webpack aprobado; las matrices finales de navegador usan esa versión compilada. El primer intento de TypeScript con un límite de heap de 768 MB agotó memoria; se repitió con 1536 MB y pasó. La comprobación global de textos también requirió elevar el heap de 512 a 1536 MB.

Para repetir la prueba visual con una instalación de Playwright disponible:

```bash
PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs CHROMIUM_PATH=/ruta/a/chromium node scripts/verificar-cancelaciones-visual.mjs
```

El servidor local debe estar iniciado y contener los usuarios de prueba del seed. Las opciones `VISUAL_BASE_URL`, `VISUAL_OUTPUT`, `VISUAL_STORAGE_STATE` y `VISUAL_CASE` permiten cambiar servidor, destino, sesión local o ejecutar un caso. Las sesiones y credenciales particulares no se guardan en este directorio. Los scripts fijan solo el reloj del navegador al 12/10/2026 para repetir los rangos de la revisión; el servidor conserva su reloj real.

## H-07 y H-03 — ampliación pedida en la misma corrección

`presentismo/resultados.json` registra 14 casos aprobados sobre la versión de producción: 3, 6, 12, 13 y 24 meses; 2, 3, 8 y 16 materias; valores altos y un período completamente sin registros, en ambos tamaños. Se comprobó el índice de todo el período, cada celda de las tablas, ausencia de recortes y superposiciones, centro de los ausentes, separación respecto de la línea, interrupción real del trazado entre meses sin datos y distinción frente a los puntos de 0 %. El aviso se recalcula correctamente al reducir y volver a ampliar la ventana. Las opciones de ambos selectores terminan en octubre de 2026.

`clases/resultados.json` registra cuatro casos aprobados de H-03: 6 y 24 meses en escritorio y móvil. Se verifican las 24 opciones sin fechas futuras, los parámetros de consulta, clases, horas, registros inactivos y cero clases de una materia activa.

Las capturas de `h07/` corresponden al relevamiento previo de ingresos/ocupación, no a la matriz final de presentismo. Allí se detectó que medir solamente `scrollWidth` activaba desplazamiento con 16 px de exceso en 24 meses de escritorio y 2 px en seis meses de móvil, sin categorías ocultas. La medición final usa las categorías y sus cifras realmente dibujadas; observa carga, cambios de tamaño, fuentes y recorrido. Los hallazgos previos se conservan como evidencia histórica.

Para repetir presentismo y H-03, con los mismos parámetros de módulo y navegador:

```bash
node scripts/verificar-presentismo-visual.mjs
node scripts/verificar-periodo-clases-visual.mjs
```

Capturas representativas:

- [Presentismo de 24 meses, escritorio](presentismo/24-desktop-16-mes.png).
- [Presentismo con huecos y 0 %, escritorio](presentismo/6-desktop-3-mes.png).
- [Materias con valores altos, móvil](presentismo/6-mobile-8-altos-materia.png).
- [Clases por profesor, 24 meses en móvil](clases/24-mobile-clases-profesor.png).
