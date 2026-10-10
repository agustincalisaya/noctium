# Corrección visual de indicadores H06/H07

Relevamiento aprobado explícitamente el 09/10/2026. [Inventario y decisiones](RELEVAMIENTO-fidelidad-H03-H10.md). Spec H §2.3, §2.4, §2.6 y nota aditiva del 09/10.

## Alcance implementado

Encabezado/período/pestañas compactos; gráficos con encabezados y acceso a tabla compactos. Ocupación con barras turquesa por instrucción explícita que reemplaza línea/meta visual. Ingresos compactos en M/mil, ejes y guías discretos, valores asociados por categoría estable (no índice de las barras filtradas). Leyenda arriba de múltiples series. Presentismo con doble barra y línea ámbar 0–100%, ausentes sobre pares, doble barra horizontal y estadísticas al final; aviso y tabla abajo. Tabla mantiene índice, ausentes y valores exactos. Filas crecen según categorías. Períodos >12 meses completos y scroll local empieza en recientes. Tokens de nuevas series documentados.

No cambia Sidebar, cálculos, endpoints ni permisos. H03/H10 se implementan en PR propios después de coordinación de integración.

## Validación

[Resultados y capturas](../../../testing/indicadores-fidelidad-evidencia.md). Tests dirigidos secuenciales, lint, textos, typegen, tsc y build webpack; navegador real desktop/móvil y 6/12/13/24 meses. Sin suite global. PR y CI pendientes al crear esta task.
