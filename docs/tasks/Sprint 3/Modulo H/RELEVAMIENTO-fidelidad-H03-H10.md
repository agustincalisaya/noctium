# Relevamiento SDD — fidelidad H06/H07, H03 y H10

Estado: aprobado explícitamente por el usuario el 09/10/2026. Fecha: 09/10/2026.
Base actual: origin/develop `aeabb65` (incluye PR #227 C20). Issues #181 y #191 abiertas; sin PRs abiertos al consultar GitHub. Checkout raíz y worktrees E preservados. Rama propia: fix/indicadores-fidelidad-prototipo.

## Decisiones de alcance

La instrucción actual del usuario fija las figuras 52–57 como autoridad visual del contenido. Sidebar fuera de alcance. Cifras del PDF son ejemplos: datos reales de servicios, sin copiarlas al producto. Ocupación pasa de línea a barras turquesa, sin meta visible, por instrucción explícita; documentar revisión aditiva en spec H §2.3 y compatibilidad de §2.4, conservando cálculos y APIs. Los totales contractuales siguen en encabezados compactos aunque algunas figuras omitan los de los rankings. H10 ordena por centro y después alumno, sin sumar unidades aunque el ejemplo visual sugiera otro orden.

## PR 1 — corrección visual compartida

Rama fix/indicadores-fidelidad-prototipo hacia develop. Referenciar #218/#219; no volver a cerrar las HU.

Modificar:
- src/components/indicadores/grafico-indicador.tsx
- src/components/indicadores/grafico-indicador.test.tsx
- src/components/indicadores/graficos-indicadores.tsx
- src/components/indicadores/presentismo-indicadores.tsx
- src/components/indicadores/presentismo-indicadores.test.tsx
- src/components/indicadores/filtro-periodo.tsx
- src/components/indicadores/filtro-periodo.test.tsx
- src/app/(dashboard)/gerente/indicadores-client.tsx
- src/app/(dashboard)/gerente/indicadores-client.test.tsx
- src/app/globals.css
- src/lib/textos.ts
- docs/DESIGN.md
- docs/specs/spec_modulo_H.md (nota aditiva y changelog)

Crear:
- docs/tasks/Sprint 3/Modulo H/FIX-fidelidad-indicadores.md
- docs/testing/indicadores-fidelidad-evidencia.md
- docs/testing/indicadores-fidelidad/ (capturas y resultados visuales)

El componente común contiene encabezado compacto, leyenda arriba cuando hay múltiples series, geometría vertical/horizontal, valores compactos, ejes discretos, etiquetas auxiliares al final de barra, tabla con columnas independientes, scroll mensual local hacia meses recientes y accesibilidad. Sin modificar Card global ni Sidebar. Tokens nuevos propuestos: --chart-attendance-index (ámbar), --chart-expired (ámbar), --chart-withdrawal (gris); petróleo y turquesa usan tokens de marca existentes. Valores y contraste se documentan en DESIGN.

## PR 2 — HU-H-03

Rama feat/hu-h-03-clases-materia-profesor, Closes #181. Publicar cuando el PR compartido esté integrado con autorización del usuario, para diff limpio frente a develop.

Crear:
- src/server/indicadores/clases.service.ts
- src/server/indicadores/clases.service.test.ts
- src/server/indicadores/clases.service.pg.test.ts
- src/app/api/indicadores/clases-por-materia/route.ts
- src/app/api/indicadores/clases-por-materia/route.test.ts
- src/app/api/indicadores/clases-por-profesor/route.ts
- src/app/api/indicadores/clases-por-profesor/route.test.ts
- src/components/indicadores/clases-indicadores.tsx
- src/components/indicadores/clases-indicadores.test.tsx
- prisma/seed/fixtures/hu-h-03.ts
- docs/tasks/Sprint 3/Modulo H/HU-H-03.md
- docs/testing/HU-H-03-evidencia.md
- docs/testing/HU-H-03.sql
- docs/testing/HU-H-03.postman_collection.json
- docs/testing/hu-h-03/ (capturas/resultados)

Modificar:
- src/types/indicadores.types.ts
- src/app/(dashboard)/gerente/indicadores-client.tsx
- src/app/(dashboard)/gerente/indicadores-client.test.tsx
- src/lib/textos.ts
- prisma/seed/fixtures/index.ts

Contrato: spec H §2.5, §2.8.1/4 y reglas 3.9/10/15/16. Reusar RangoIndicadoresQuerySchema: 6 meses por defecto, máximo 24 inclusivos. GET con withPermission(indicadores:leer), 400/401/403 y envoltorio data/error. C contarClasesPorMes ya existe y devuelve estados, cantidades y minutos. L listarMateriasActivas existe en materia.service.ts y devuelve idMateria/nombreMateria/codigoMateria (normalizar en H); obtenerMateriasPorIds en materia.publico.ts trae activa. D listarOpcionesProfesoresActivos/obtenerProfesoresBasicos disponibles en profesor.publico.ts. No ampliar fachadas innecesariamente ni consultar sus tablas desde H.

DISPONIBLE/COMPLETO/CANCELADO cuentan clases; horas solo primeras dos. Todos los activos con cero, inactivos con datos. Orden materia clases/nombre/id; profesor clases/horas/nombre/id. Nombres sin acento/mayúsculas para desempate, horas hasta dos decimales. Dos barras horizontales bajo ingresos/ocupación; profesor muestra clases y horas; tabla incluye estado. Vacío contractual sin barras ficticias. Fixtures por servicios y claves estables, nombres largos, cero, inactivos y canceladas sin horas.

## PR 3 — HU-H-10

Rama feat/hu-h-10-cancelaciones, Closes #191. Publicar tras integración coordinada de H03; no hacer merge automático.

Crear:
- src/server/indicadores/cancelaciones.service.ts
- src/server/indicadores/cancelaciones.service.test.ts
- src/server/indicadores/cancelaciones.service.pg.test.ts
- src/app/api/indicadores/cancelaciones-por-mes/route.ts
- src/app/api/indicadores/cancelaciones-por-mes/route.test.ts
- src/app/api/indicadores/cancelaciones-por-materia/route.ts
- src/app/api/indicadores/cancelaciones-por-materia/route.test.ts
- src/components/indicadores/cancelaciones-indicadores.tsx
- src/components/indicadores/cancelaciones-indicadores.test.tsx
- prisma/seed/fixtures/hu-h-10.ts
- docs/tasks/Sprint 3/Modulo H/HU-H-10.md
- docs/testing/HU-H-10-evidencia.md
- docs/testing/HU-H-10.sql
- docs/testing/HU-H-10.postman_collection.json
- docs/testing/hu-h-10/ (capturas/resultados)

Modificar:
- src/types/indicadores.types.ts
- src/app/(dashboard)/gerente/indicadores-client.tsx
- src/app/(dashboard)/gerente/indicadores-client.test.tsx
- src/lib/textos.ts
- prisma/seed/fixtures/index.ts

Contrato: spec H §2.7, §2.8.1/2 y reglas 3.10/11/13/17. Mismo permiso/rango/envoltorio. contarInscripcionesPorMes ya se reexporta desde inscripcion.publico.ts: clasifica una sola vez con sqlVigenteEn/ahora(), incluye vencidas no marcadas, excluye PENDIENTE/CANCELADO y QUITADA_CENTRO. Cuatro series mensuales distintas: centro rojo, alumno petróleo, reservas ámbar, bajas gris. Por materia solo centro/alumno; orden centro/alumno/nombre/id. Tasas separadas abajo: centro / clases contables; alumno / (vigentes+canceladas alumno+reservas vencidas); bajas y quitadas fuera. Null con denominador cero, redondeo único a un decimal.

Brecha: no se encontraron implementaciones completas de las pantallas C14/B07 en develop; las transiciones públicas finalizarInscripcion/marcarVencidas y las lecturas existen, y E02 ya las usa en fixtures. Eso no certifica esas HU. No implementar C14/B07 dentro de H10 ni ocultar la brecha. Antes del fixture H10, verificar nuevamente integración; si siguen ausentes, registrar limitación de aceptación end-to-end y solicitar decisión concreta sobre demostración por servicios públicos. Bajas al final de la secuencia.

## Matriz visual preliminar

| Figura | Componente | Diferencia comprobable en implementación | Corrección | Evidencia requerida |
|---|---|---|---|---|
| 52 | graficos-indicadores, grafico-indicador | Ocupación línea y meta; encabezados grandes; leyenda inferior | Barras turquesa, encabezados/totales compactos, ejes suaves | Actividad 6 meses desktop/móvil |
| 53 | grafico-indicador | ancho completo >12 existe; altura y formatos necesitan contraste renderizado | Mensuales completos, año primer mes/enero, compacto sin cero vacío | Actividad 13 y 24 meses |
| 54 | grafico-indicador | mínimo 64 px por mes y 26 px por serie; ajustar geometría sin encoger barras | scroll local al final y aviso exacto | Cancelaciones larga/móvil |
| 55 | presentismo-indicadores | línea azul; categorías contienen índice/ausentes; filas 68 px | línea ámbar, doble barra horizontal compacta, índice/ausentes junto a valores, aviso y tabla abajo | Presentismo desktop/móvil |
| 56 | no implementado | faltan ambas tarjetas/rutas | H03 bajo mensuales, clases/horas al final | Actividad parte inferior |
| 57 | pestaña sin contenido | faltan cuatro series, desglose y tasas | H10 con dos gráficos y dos tasas | Cancelaciones 6 meses |

No declarar fidelidad con esta matriz de código. Completar con capturas baseline reales y comparación renderizada de entrega.

## Validación y recursos

Un proceso a la vez. Vitest por archivos afectados --maxWorkers=1; no suites globales. Tests de servicios/rutas/UI en bloques separados. PG dirigido mediante scripts/test-pg.mjs (inspeccionado: base descartable, migraciones y cleanup; no bases personales). Reservas vencidas marcadas/no marcadas, cancelaciones de centro, bajas, múltiples inscripciones, límites, nulos y orden. SQL read-only, fixture repetido y HTTP real con roles. Postman preparado no implica ejecutado.

Navegador: desktop 1440x1000 y móvil 390x844; 6/12/13/24 meses, período persistente entre pestañas, tooltip mouse/toque, teclado, tablas equivalentes, ceros, nombres largos/inactivos, error/reintento por tarjeta y sin overflow global. Una pasada de todos los estados/dispositivos y una confirmación después de corregir diferencias.

Lint dirigido, textos, typegen, tsc y build separados mirando RAM. CI último SHA por PR; no equiparar CI a PG local. Incidente baseline: Turbopack rechaza node_modules symlink fuera de raíz; usar webpack. Heap 768 MB insuficiente en dev (OOM al compilar API); intento aislado con 1536 MB. Registrar resultado sin marcar pruebas pendientes como aprobadas.

## Contraste renderizado baseline ejecutado

Base nueva noctium_h_visual_20261009 en PostgreSQL local 55443, 39 migraciones y seed por servicios ejecutados. Sin reutilizar bases E. Sesión Gerente real. Capturas de develop aeabb65 en docs/testing/indicadores-fidelidad/baseline/:
- actividad-6-desktop.png
- actividad-13-desktop.png
- actividad-13-mobile.png
- presentismo-desktop.png
- presentismo-mobile.png

Capturas abiertas y comparadas con las seis imágenes adjuntas por el usuario (figuras 52–57). Diferencias observadas: tarjetas de Actividad de unos 470 px de alto frente a proporciones más compactas del prototipo; total antes de subtítulo; botón de tabla con borde y padding excesivos; leyenda redundante debajo de series simples; barras de ingresos muy finas; formato «993 k» en vez de «993 mil»; ocupación línea con meta; faltan etiquetas visibles de varios valores, especialmente en largo; presentismo usa línea azul, ausentes no visibles sobre pares, filas horizontales gruesas y estadísticas dentro del nombre. Móvil conserva tarjeta alta y requiere desplazamiento local. La barra superior y footer existentes no se alteran por este encargo.

Servidor y navegador propios cerrados después de capturas. Segundo intento webpack con heap 1536 MB completó capturas; primer intento 768 MB falló por OOM. No se ejecutaron tests ni build de producto en esta fase de relevamiento.

## Confirmación requerida

Aprobar inventario de archivos, distribución de PRs y adaptación visual solicitada. Implementación pendiente; no hay cambios de código de producto todavía.
