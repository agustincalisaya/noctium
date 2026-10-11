# HU-H-03 — evidencia

Base `develop` f3da75b (PR #228 integrado por el usuario). Fixture aislado `noctium_h03_review_20261009`, rol GERENTE, Mayo–Octubre 2026 y Octubre 2025–Octubre 2026. Chromium real con build de producción; desktop 1440×1000, móvil 390×844. El sidebar no se modificó.

## Contrato y contraste

9 pruebas de servicio, 18 de rutas, 10 de interfaz/panel y 3 PostgreSQL dirigidas aprobadas. Regresión adicional: 6 pruebas del gráfico común/H03 tras la revisión visual. Ejecuciones secuenciales, `--maxWorkers=1`, heap 512 MB para Vitest. PG usa `scripts/test-pg.mjs` con una sola prueba; creó y eliminó su base descartable.

SQL independiente read-only: [consultas](HU-H-03.sql), [resultado](hu-h-03/resultado-sql.txt). Dos seeds completos sucesivos conservaron 110 turnos, 274 inscripciones y 24 pagos. Los hechos H03 se crean mediante servicios C: disponible, completo, cancelado y pendiente. Canceladas cuentan clases y excluyen horas. Pendientes excluidas. Catálogos activos con cero e inactivos con datos, desempates, nombres idénticos y redondeo cubiertos en tests.

HTTP con sesión real: ambos endpoints 200 por defecto, 6 y 24 meses; 400 por mes inválido, rango invertido y 25 meses; 403 Mesa/Profesor/Alumno; 401 anónimo. [Resultados completos](hu-h-03/resultados-http.json). Tablas comparadas en cantidad de filas con la API, columnas de horas, tooltip con nombre completo, período compartido entre pestañas, fallo aislado 503/reintento y vacío futuro real. Sin errores de página ni overflow horizontal global.

## Comparación visual

Comparación directa con figura 56 (PDF página física 50) y figuras 52/53: tarjetas horizontales contiguas bajo los mensuales, materia petróleo, profesor turquesa, clases al final y horas junto al número; barras ordenadas de mayor a menor. El alto crece por filas y no hay scroll vertical dentro del gráfico. Los datos son reales y difieren de los valores ilustrativos del PDF; los catálogos cero agregan filas. Se conservan los totales contractuales del encabezado.

Primera pasada detectó nombres omitidos por el intervalo automático de Recharts y aviso de meses aplicado a categorías horizontales; se corrigieron juntos (`interval={0}`, aviso solo mensual). Cada tarjeta horizontal conserva su alto propio mediante `self-start`, como figura 56.

Capturas: [desktop](hu-h-03/clases-desktop.png), [actividad](hu-h-03/actividad-desktop.png), [13 meses](hu-h-03/actividad-13-desktop.png), [móvil](hu-h-03/profesores-mobile.png), [tabla](hu-h-03/tablas-desktop.png), [tooltip](hu-h-03/tooltip-profesor.png), [error](hu-h-03/error-independiente.png), [vacío](hu-h-03/sin-clases.png).

## Validación y límites

Lint dirigido, verificador de textos, Next typegen, TypeScript y build webpack aprobados. Heap build 1536 MB; los procesos de revisión se cierran al terminar. No se ejecutaron suites globales. [Postman](HU-H-03.postman_collection.json) preparado, no ejecutado en Postman; los HTTP anteriores sí se ejecutaron en Chromium.

D08 no dispone aún de baja completa integrada: usuario autorizó usar servicios públicos y documentar esta brecha. Inactivos con datos se verificaron en servicio/interfaz; queda pendiente demostrar una baja real de profesor desde la pantalla D08. No se implementa D08 ni se afirma esa prueba integral.
