# Fidelidad H06/H07 — evidencia

09/10/2026. Base develop aeabb65. Relevamiento aprobado por el usuario. Base aislada noctium_h_visual_20261009, PostgreSQL local 55443: 39 migraciones y seed por servicios. No se modificaron bases E ni el sidebar.

## Diferencias y resolución

| Figura | Antes | Entrega | Captura |
|---|---|---|---|
| 52 | Tarjetas altas, leyenda inferior, ocupación línea/meta | Encabezados compactos, acceso a tabla textual, ocupación barras turquesa con valores | indicadores-fidelidad/actividad-6-desktop.png |
| 53 | Valores ausentes, formatos k y encabezados altos | Total a derecha, valores M/mil por categoría estable, mensuales completos | indicadores-fidelidad/actividad-13-desktop.png |
| 54 | Scroll preparado pero barras/leyendas grandes | Scroll local comienza en recientes, aviso exacto, sin overflow global | indicadores-fidelidad/actividad-24-mobile.png; cuatro series se verifican en H10 |
| 55 | Línea azul, estadísticas en nombre, barras horizontales grandes | Línea ámbar con eje secundario, valores/ausentes visibles, filas compactas; índice/ausentes al final | indicadores-fidelidad/presentismo-desktop.png |
| 56/57 | Contenido pendiente | No incluidas en este PR; H03/H10 tendrán PR independientes | Pendiente en sus evidencias |

Capturas baseline de develop abiertas y comparadas con las seis imágenes adjuntas. Una pasada desktop/móvil sobre implementación y una confirmación en build de producción. En primera pasada se detectó desplazamiento de etiquetas al desaparecer valores cero: corregido usando categoría como identidad. Confirmación asertiva compara lista de etiquetas con datos HTTP cronológicos. Las cifras son de servicios reales y por eso difieren de los ejemplos del prototipo. El total contractual de presentismo conserva presentes/inscriptos en texto pequeño bajo el índice; no se omite. Ocupación cambia de línea/meta a barras por mandato explícito, documentado aditivamente en spec H. La barra superior/footer existentes se conservan.

## Validación ejecutada

Un proceso de validación a la vez, Node 24.21.0. Vitest con --maxWorkers=1 y heap 512 MB:
- grafico-indicador.test.tsx + presentismo-indicadores.test.tsx: 7 aprobados tras corrección final (6 en pasada anterior).
- indicadores-client.test.tsx + filtro-periodo.test.tsx: 10 aprobados.
- indicadores.service.test.ts + presentismo.service.test.ts: 16 aprobados.

33 pruebas dirigidas aprobadas. No suite global ni suite PG global. No se cambian servicios de negocio; PG se usa para baseline/fixtures/HTTP real. next typegen y tsc --noEmit aprobados por separado. ESLint dirigido: cero errores/warnings. scripts/verificar-claves-textos.ts: aprobado. next build --webpack con heap 1536 MB: aprobado, TypeScript y rutas. RAM disponible se comprobó antes de build. Primer intento dev con 768 MB falló OOM; segundo con 1536 MB funcionó. Turbopack local rechaza symlink node_modules fuera de raíz; build/revisión local webpack.

Chromium producción con sesiones reales del seed: 1440×1000 y 390×844, períodos 6/12/13/24 meses; sin excepciones de página. Gráficos de barras, línea y etiquetas; tablas con datos exactos, tooltip de mayo de 2026, scroll local al final y ArrowLeft, error 503 de ingresos sin romper ocupación, reintento, inválido 400, anónimo 401 y Mesa/Profesor/Alumno 403. Primera aserción de recuperación falló por observar ocupación durante loading de su petición; sincronización corregida esperando su barra, pasada funcional aprobada. Resultados en indicadores-fidelidad/resultados-visual.json.

Capturas móviles incluyen desplazamiento horizontal de tabla propia y gráficos propios, sin overflow documental. No se cambió la barra superior propia de la aplicación. No se ejecutó aplicación Postman/TablePlus; HTTP efectivo con Playwright y SQL read-only con psql. Se conservan colecciones H06/H07 existentes porque sus contratos no cambian.

## Seed repetido

Primera y segunda ejecución: 92 turnos, 242 inscripciones y 24 pagos, sin variación. Conteos read-only con psql.

## Entrega

PR y checks remotos se registran después de publicación. H03/H10 pendientes; no declarar objetivo completo con este PR.
