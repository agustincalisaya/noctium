# HU-H-10 — Ver cancelaciones

Issue #191, 5 SP. Relevamiento aprobado: [inventario](RELEVAMIENTO-fidelidad-H03-H10.md). Base develop d22806d (incluye C22 #230), tras integración por el usuario de H03 #229 (tres checks SUCCESS).

## Implementación

Dos GET con `indicadores:leer`, envelope y rango comunes. Servicio de lectura compone fachadas C/L; cuatro series mensuales independientes por fecha de clase, meses cero incluidos. Materia solo centro/alumno, inactivas con datos y orden centro/alumno/nombre/id. Tasa clases usa Disponible/Completo/Cancelado como H03. Inscripciones: canceladas alumno / (vigentes + canceladas alumno + reservas vencidas); bajas y quitadas excluidas. C clasifica marcadas/no marcadas y excluye todas las inscripciones de clases canceladas por centro. Redondeo común una vez; denominador cero null.

Pestaña con dos tarjetas y dos tasas debajo; gráfico mensual con cuatro barras agrupadas rojo/petróleo/ámbar/gris y materia con dos barras horizontales. Totales separados por serie/unidad; tablas, errores, loading, reintentos y vacío por tarjeta. Más de 12 meses ancho completo, desplazamiento local en meses recientes.

## Dependencias y fixture

Usuario autorizó explícitamente servicios públicos del PR0 y documentar brechas (09/10/2026). C14/B07/D08 no tienen aún las pantallas completas integradas; no se implementan dentro de H10 ni se afirma prueba de esas pantallas. Fixture usa crearInscripcion/finalizarInscripcion/marcarVencidas y cancelación C por claves naturales; hechos de 13 meses con reserva marcada/no marcada, BAJA_ALUMNO, QUITADA_CENTRO, cancelación/reinscripción y clase cancelada con inscripciones para probar exclusiones. Toda escritura de hechos pasa por servicios con conReloj/transaccion; SQL solo lectura.

## Validación

8 tests de servicio, 18 de rutas, 10 de UI/panel y 6 PG dirigidos aprobados; 10 regresiones gráfico/presentismo/H10 tras ajuste visual. Lint dirigido, textos, typegen, tsc y build webpack aprobados. Chromium de producción desktop/móvil: 6/12/13/24 meses, tablas exactas, etiquetas SVG contra API, tasas, tooltip mouse/touch, scroll/teclado, loading/error/reintento y vacío real; 400/401/403 verificados. Primera pasada y única confirmación comparadas con figuras 54/57. Evidencia en [HU-H-10-evidencia.md](../../../testing/HU-H-10-evidencia.md). Postman preparado, no ejecutado. Sin suites globales, validaciones dirigidas y secuenciales.
