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

## Verificación final pendiente

La colección `HU-H-06.postman_collection.json` usa variables de sesión local sin secretos guardados. Resta registrar ejecución HTTP contra la app real, Playwright/Chromium (desktop/móvil, 6/13/24 meses, tooltip, scroll, estados y acceso), capturas en `docs/testing/hu-h-06/`, y build/regresión de integración. Se completará este apartado con resultados efectivamente observados; no se presenta una captura o prueba pendiente como realizada.
