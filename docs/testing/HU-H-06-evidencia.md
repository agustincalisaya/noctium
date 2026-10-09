# HU-H-06 — Evidencia de implementación

Relevamiento confirmado por Iván el 08/10/2026. Issue #164. Rama propia `feat/hu-h-06-panel-indicadores`; UI y endpoint de resumen, sin contenido de H07/E09.

## Verificación dirigida ejecutada

- Vitest: 51 pruebas en 8 archivos de H, rutas y UI pasaron. Además, las 17 pruebas de `turno.validaciones.test.ts` pasaron con la corrección compartida del reloj PR 0 (68 pruebas en la pasada conjunta inicial).
- `next typegen` seguido por `tsc --noEmit`: sin errores.
- ESLint sobre archivos de H, componentes, cliente y fixture: sin errores ni warnings.
- Pruebas de API verifican `{ data, error }`, query, permiso granular y 400/401/403. Los tests de interfaz cubren fallo/vacío por tarjeta, reintento puntual, conservación de período, descarte de respuesta tardía, tabla y 0 % con clases reales.

## PostgreSQL real y fixture idempotente

Base local aislada: `noctium_h06_fixture`, puerto 55443; no se escribió en la base compartida de demostración. Migraciones aplicadas con `prisma migrate deploy`. Seed ejecutado dos veces mediante `tsx prisma/seed.ts`.

| Entidad | Después del primer seed | Después del segundo seed |
|---|---:|---:|
| Clases | 62 | 62 |
| Inscripciones | 112 | 112 |
| Pagos | 24 | 24 |
| Operaciones de pago | 24 | 24 |
| Comprobantes | 24 | 24 |

La consulta de duplicados por clave natural devolvió cero filas en ambas corridas. El fixture creó 24 clases mediante configurar/asignar aula/asignar participantes, y pagos mediante `registrarPago`; sus claves son fecha/hora/profesor/materia/usuario. Fechas en los 23 meses anteriores, salvo cada cuarto mes; el rango de 24 meses incorpora el actual. No hay inserts directos en estas entidades. Una clase parcialmente preparada se retoma sin modificar hechos ya confirmados.

`docs/testing/HU-H-06.sql`, período noviembre 2024–octubre 2026, devolvió 26 clases elegibles (24 propias y dos del seed base) con ocupación del período **43,1 %**. Invocación real de servicios contra la misma base:

```json
{"resumen":{"ocupacion_promedio":43.1,"turnos":26},"meses":24,"ingresos":57600000}
```

SQL y service coinciden. El promedio de los meses no se utiliza: el service pondera por número de clases de cada mes y conserva el promedio simple por clase.

Los defaults de validación C ahora consultan `ahora()` del PR 0, preservando fechas explícitas y el comportamiento productivo. La regresión demuestra que el reloj contextual admite históricos sin mutar `Date` global. El mismo cambio se comparte con E09 para permitir PR independientes.

## Verificación final integrada — 09/10/2026

Validación sobre una rama local de revisión con E09, H06 y H07; cada rama de entrega mantiene únicamente su historia. Base PostgreSQL descartable local, sin modificaciones en una base compartida.

- `npm test`: **1851 aprobados**, 177 PostgreSQL omitidos por diseño; esos casos se ejecutaron separadamente.
- `npm run test:pg`: **177 aprobados** (143 + 18 + 16), migraciones reales, bases temporales eliminadas por el runner.
- Next.js build webpack y TypeScript: aprobados con Node 24.21.0. ESLint: cero errores; un warning preexistente de `CALENDARIO` en Sidebar.
- Catálogo de textos y detalle después del último ajuste de confirmación: 44 aprobados. Componentes de indicadores: 16 aprobados después del ajuste final de etiquetas.
- Fixtures combinados repetidos: 72 turnos, 205 inscripciones, 10 clases dictadas, 93 snapshots, 24 pagos, 136 eventos y 229 entradas de historial; conteos iguales antes/después. Esta medición incluye el registro de 05/01 realizado por la revisión UI.
- Playwright/Chromium con sesiones reales del seed, escritorio 1440×1000 y móvil 390×844. Sin excepciones de página. Capturas inspeccionadas visualmente. Las capturas inferiores usan scroll del contenido de la aplicación.
- La colección Postman queda disponible para repetir los casos; la ejecución HTTP efectiva se realizó con Playwright y sus cookies de sesión. No se ejecutó la aplicación Postman ni TablePlus: SQL read-only se ejecutó con `psql`.

API real validada: ingresos, ocupación mensual y resumen 200; rango inválido 400, sesión ausente 401 y otros roles 403. Resumen mayo–octubre: 26,7 % sobre 18 clases; SQL read-only del período largo ejecutado correctamente. Playwright verificó 6/13/24 meses, conservación de período entre pestañas, tabla, vacío, error 503 aislado y recuperación por reintento. En móvil no hay overflow documental; el scroll de cada gráfico inicia en los meses recientes. Los importes elevados usan etiquetas compactas; totales, tabla y tooltip conservan precisión.

Capturas y respuestas reales de esta HU: `hu-h-06/`. Pestaña Cancelaciones queda como extensión para su historia correspondiente.

Último build de producción después del ajuste visual: aprobado. Revisión final repetida con Playwright: cero excepciones de página. Tooltip real de ingresos: mayo de 2026, $ 993.000,00; navegación de pestañas con ArrowRight y enlace de historial con materia comprobados.

PR propio: https://github.com/agustincalisaya/noctium/pull/218. Base develop, sin mezclar commits de otras HU.

## Actualización de develop durante la entrega

Se integró `b7c3b42` (HU-C-23 y componente HU-C-25) en cada rama por separado, preservando únicamente el diff de la historia frente a develop. Claves de UI migradas a `ui.historial.asistencia.*` / `ui.indicadores.*`, sin modificar claves legacy de dominio. Comprobador de referencias TypeScript aprobado. Suite completa sobre la integración actualizada: **1913 aprobados**, 177 PostgreSQL omitidos en la corrida unitaria; la verificación PostgreSQL de177 casos anterior sigue aplicando, sin cambios adicionales en los servicios ni persistencia. Lint actualizado: cero errores y el warning preexistente de Sidebar.

Build webpack/TypeScript sobre develop actualizado: aprobado. Playwright repetido sobre ese build, sin errores de página. Los tres PR quedaron sin conflictos frente a develop al verificar GitHub.

## CI remoto observado

Sobre el commit de código `c63932c`: [Textos C23](https://github.com/agustincalisaya/noctium/actions/runs/37930867369) aprobado y CodeQL aprobado. [CI build](https://github.com/agustincalisaya/noctium/actions/runs/37930869170) aprobado. Los commits posteriores de evidencia sólo modifican documentación/capturas.
