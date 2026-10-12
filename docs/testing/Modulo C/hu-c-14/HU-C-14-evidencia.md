# Evidencia HU-C-14

## Resultado

Implementación en el commit 28165e3 de feature/hu-restantes; las correcciones de auditoría (P2-03, P3-01 a P3-03, P3-05) están en el árbol de trabajo, pendientes de commit. La cancelación propia usa un evaluador compartido, revalidación transaccional y finalización lógica. No modifica pagos.

## Matriz de criterios

| CA | Evidencia |
|---|---|
| 1–2 | `turno.cancelacion-propia.test.ts` (`PERMITIDA`, `FUERA_DE_PLAZO`, `NO_APLICA`); DTO `cancelacion` en Mis clases; acción «Cancelar mi inscripción», deshabilitada con la leyenda fuera de plazo |
| 3 | `cancelar-inscripcion.test.tsx`; `ConfirmarAccionDialog` |
| 4–5 | `turno.cancelacion-propia.pg.test.ts`: `CANCELADA_ALUMNO` con actor y fecha, cupo y franja liberados, Completa → Disponible, payloads de `turno:inscripcion_cancelada` y `turno:disponible_nuevamente`, re-reserva exige pago |
| 6 | Bloqueos, `marcarVencidas` y relectura dentro de la transacción; PG de reserva vencida que revierte |
| 7 | Pago intacto (PG); aviso de reintegro en la confirmación y en el éxito según `con_pagos` de la respuesta (componente) |

## Verificaciones

Corridas del 11/10/2026 sobre el árbol con las correcciones:

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: aprobado, exit 0.
- `npm run test:pg -- src/server/alumnos/alumno.estado.pg.test.ts src/server/turnos/turno.cancelacion-propia.pg.test.ts`: 21/21 (7/7 de C-14), base `noctium_pruebas_<hex>` creada, migrada y descartada por el runner, exit 0.
- Regresión PG focal (`src/server/alumnos`, `turno.cancelacion-propia`, `turno.propios`, `turno.resumen-inscripcion.service`, `historial/clases-alumno`): 6 archivos, 43/43, exit 0.
- Vitest completo: 252 archivos aprobados y 53 omitidos; 3201 pruebas aprobadas, 374 omitidas (las PG sin base) y 0 fallidas, exit 0.
- ESLint sobre los `.ts/.tsx` modificados o nuevos: aprobado, exit 0.
- `node scripts/verificar-claves-textos.ts`: aprobado, exit 0.
- `git diff --check f7ff819`: aprobado, exit 0.
- `npm run build`: aprobado, exit 0.
- Postman (`HU-C-14.postman_collection.json`, 7 requests con assertions), navegador y CI: no ejecutados.

## Límites

Los mocks de Route Handler no acreditan autenticación/RBAC reales. La existencia de la colección no acredita su ejecución. Una comprobación pendiente no se considera aprobada.
