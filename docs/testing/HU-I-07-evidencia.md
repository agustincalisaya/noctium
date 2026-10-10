# HU-I-07 — Evidencia de validación

Fecha: 10/10/2026. Base develop `6f553d0`. Rama `feat/hu-i-07-formas-pago`. Issue #180.

Implementación de edición, baja y reactivación por Gerente; nombre normalizado único entre activas e inactivas, preferencias conservadas, pagos y snapshots sin modificar, historial de estados y protección transaccional de la última activa. Listado sin «Preferida por» y confirmación de baja según figuras 83/84. El sidebar existente se conserva.

## Validaciones ejecutadas

Todos los bloques fueron secuenciales, con un worker. Dependencias del lockfile. PostgreSQL 17 nuevo y aislado, sin restauración ni carga masiva; las bases de pruebas fueron migradas y descartadas por el runner.

| Bloque | Resultado |
|---|---|
| Schema, dominio I-07, bloqueos y fachada B | 32 pruebas aprobadas |
| Cuatro endpoints nuevos, contratos y autorización | 39 pruebas aprobadas |
| Listado, página, ficha B y preferida | 35 pruebas aprobadas |
| C-25 compartido y listado después del ajuste visual | 32 pruebas aprobadas |
| Formulario preferida inactiva y regresión alta I-03 | 29 pruebas aprobadas |
| PostgreSQL real I-07 e I-03 | 11 pruebas aprobadas |
| PostgreSQL I-07 con integración de corrección I-06 | 5 pruebas aprobadas |
| HTTP contra servidor de producción local | 17 casos aprobados; [resultados](hu-i-07/http-rbac.json) |
| ESLint de archivos TS/TSX modificados y nuevos | Sin errores |
| Catálogo central de textos | Aprobado |
| Next typegen y TypeScript noEmit | Aprobados |
| Build de producción final | Aprobado; compilación, tipos y 45 rutas estáticas |
| git diff --check | Sin errores |

Las cifras incluyen regresiones repetidas en distintos bloques; no se presentan como total de pruebas únicas. No se ejecutaron suites globales. El build local se limitó temporalmente a un worker; la configuración del repositorio quedó restaurada.

Los casos PostgreSQL verifican que dos bajas simultáneas de las dos únicas activas producen una baja y un rechazo `ULTIMA_FORMA_PAGO_ACTIVA`, dejando una activa; también comprueban preferencias activas/inactivas, actor/fecha/motivo del historial, preservación de pagos y snapshot, unicidad y fixture repetible. I-10 excluye la preferida inactiva de la preselección. I-06 permite conservar la actual inactiva y rechaza cambiar a otra inactiva.

La evidencia HTTP comprueba 401 sin sesión y 403 para Mesa de entrada, Profesor y Alumno en los cuatro endpoints; Gerente recibe 400 `MOTIVO_REQUERIDO` si intenta desactivar una forma con pagos sin motivo. Las sesiones fueron locales y no se incluyen cookies ni secretos.

## Verificación visual y funcional

Chromium `/bin/chromium` mediante MCP Playwright, servidor de producción, datos sintéticos nuevos con seis alumnos que prefieren Transferencia y un pago real. Se verificaron edición precargada, Guardar deshabilitado sin cambios, Volver conserva edición, Cancelar descarta, baja y reactivación reales con recarga, foco dentro del modal y ausencia de desbordamiento horizontal. Consola final: cero errores y cero advertencias.

- [Listado escritorio, 1440 × 900](hu-i-07/listado-desktop.png)
- [Confirmación escritorio, 1440 × 900](hu-i-07/desactivar-desktop.png)
- [Listado móvil, 390 × 844](hu-i-07/listado-mobile.png)
- [Confirmación móvil, 390 × 844](hu-i-07/desactivar-mobile.png)

El formulario de preferida identifica la conservada inactiva y exige una selección explícita para reemplazarla. Sus comportamientos se verificaron con pruebas UI y dominio, sin afirmar una navegación visual adicional de esa pantalla.

## Entrega y límites

La colección Postman adjunta prepara casos reproducibles; no se afirma haber ejecutado Postman. No se implementan pantallas completas de I-06 o I-11: la conservación/corrección y snapshots se verifican con los servicios existentes. Sin migraciones nuevas ni cambio del flag esEfectivo.

Next y PostgreSQL propios fueron apagados después de la validación. La instrucción posterior del usuario autoriza publicar la PR a develop, vincularla mediante `Closes #180` y mergearla únicamente cuando todos los checks del SHA final estén aprobados. Los resultados remotos se verifican en GitHub antes del merge.
