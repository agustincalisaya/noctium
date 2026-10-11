# Evidencia HU-C-14

## Resultado

Implementación local pendiente de commit. La cancelación propia usa un evaluador compartido, revalidación transaccional y finalización lógica. No modifica pagos.

## Matriz de criterios

| CA | Evidencia |
|---|---|
| 1–2 | `turno.cancelacion-propia.test.ts`; DTO `cancelacion` en Mis clases |
| 3 | `cancelar-inscripcion.test.tsx`; `ConfirmarAccionDialog` |
| 4–5 | `cancelarInscripcionPropia`; `finalizarInscripcion`; listado por inscripción más reciente |
| 6 | Bloqueos, `marcarVencidas` y relectura dentro de la transacción |
| 7 | `con_pagos`, aviso de reintegro y ausencia de mutaciones sobre pagos |

## Verificaciones

- `npx tsc --noEmit`: aprobado, exit 0.
- Suite focal C-14/C-20/listado: 68/68 aprobadas, exit 0.
- Componente `cancelar-inscripcion.test.tsx`: 3/3 aprobadas, exit 0.
- Regresión Vitest completa: 3188 aprobadas, 353 omitidas, 0 fallidas, exit 0.
- PostgreSQL descartable (`turno.resumen-inscripcion.service.pg.test.ts` y `turno.propios.pg.test.ts`): 11/11 aprobadas, base creada, migrada y descartada por el runner, exit 0.
- `npm run build`: aprobado, exit 0; incluye la ruta nueva.
- ESLint focal de archivos TypeScript modificados/nuevos: aprobado, exit 0.
- `npm run lint` global: falló por 6 errores preexistentes `no-require-imports` en `docs/fases-sdd/**`; no se modificaron esos archivos. La advertencia propia detectada fue corregida y el lint focal posterior pasó.
- `git diff --check`: aprobado, exit 0.
- Postman, navegador y CI: no ejecutados.

## Límites

Los mocks de Route Handler no acreditan autenticación/RBAC reales. La existencia de la colección no acredita su ejecución. Una comprobación pendiente no se considera aprobada.
