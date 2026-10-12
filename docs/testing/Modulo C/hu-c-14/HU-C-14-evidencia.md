# Evidencia HU-C-14

## Resultado

HU-C-14 está implementada y verificada localmente en `feature/hu-restantes`: los siete criterios del Excel (filas 118 a 124) cumplen con las pruebas de las secciones siguientes. La cancelación propia usa un evaluador compartido con el resumen de C-20, revalida con la clase y la inscripción bloqueadas y finaliza la inscripción sin borrarla ni modificar pagos. Quedan pendientes ⏳ el recorrido de navegador de «Mis clases» y el CI sobre el SHA del PR. SHA del PR: ⏳ se completa al abrirlo.

## Matriz de criterios

| CA | Cumple | Evidencia |
|---|---|---|
| 1 | Sí (la interfaz, ⏳ en navegador) | `alumno/page.test.tsx` (18): «Cancelar mi inscripción» habilitada con `PERMITIDA`, sin acción con `NO_APLICA`, solo en la pestaña Próximas. `turno.cancelacion-propia.test.ts` (17): el evaluador responde `PERMITIDA`, `FUERA_DE_PLAZO` o `NO_APLICA` según clase cancelada, pasada o inscripción no vigente; `turno.propios.test.ts` (15): el DTO de «Mis clases» lleva `cancelacion` y no incluye `limite_cancelacion_en_linea` |
| 2 | Sí. Valor configurable con HU-N-01: diferido | Unitarias: borde exacto de las 24 h (clase del 11/10 a las 13:00 del centro = 16:00Z; límite 10/10 16:00Z): límite − 1 ms, límite y límite + 1 ms; reserva sin pagar a `venceEl` − 1 ms, `venceEl` y `venceEl` + 1 s; inicio exacto. PG: `borde exacto de la anticipación mínima` (3 casos de inscripción pagada y 3 de reserva), anticipación vigente al momento de cancelar, reprogramación (recalcula con el inicio nuevo). `page.test.tsx`: botón deshabilitado con `aria-describedby` y la leyenda «Ya no podés cancelar en línea. Comunicate con el centro». `turno.resumen-inscripcion.service.test.ts` (17): C-20 y C-14 comparten la regla en el borde exacto |
| 3 | Sí (⏳ en navegador) | `cancelar-inscripcion.test.tsx` (6): confirmación de `ConfirmarAccionDialog` con materia, fecha y hora y la leyenda irreversible; el rechazo del servidor queda dentro del diálogo; doble envío con dos clics, cada uno en su propio `act`, con la primera petición pendiente: un solo envío |
| 4 | Sí. Pantalla del historial de la inscripción (E-02): diferida | PG: `CANCELADA_ALUMNO` con `finalizadaEl`, actor y fecha en la inscripción y en `historial_inscripciones`; la clase no se cancela; cupo y franja liberados; Completa pasa a Disponible; eventos `turno:inscripcion_cancelada` y `turno:disponible_nuevamente` con el payload completo. Componente: toast «Cancelaste tu inscripción». SQL: aserciones de la fila, el historial, el cupo y los eventos |
| 5 | Sí (la etiqueta en «Mis clases», ⏳ en navegador) | `alumno/page.test.tsx`: etiqueta «Cancelaste tu inscripción». PG: tras cancelar una reserva sin pagar, `exigeInscripcionConPago` responde `CANCELADA_SIN_PAGO`; tras cancelar una inscripción pagada, sin registrar o reabierta por anulación, no exige pago |
| 6 | Sí | PG con intercalado forzado: un pago de I-10 registrado antes de que el POST evalúe, fuera de plazo → 409 `CANCELACION_FUERA_DE_PLAZO` (deja de regir la excepción); dentro de plazo → cancela con `con_pagos: true` y el pago intacto; la cancelación gana al pago (el cobro se rechaza). Rechazos en el orden de la spec: `TURNO_CANCELADO`, `TURNO_VENCIDO`, `INSCRIPCION_NO_VIGENTE`, `CANCELACION_FUERA_DE_PLAZO`; una clase Pendiente responde `TURNO_PENDIENTE` |
| 7 | Sí. Registro del reintegro (I-06): diferido | PG: el pago queda intacto, sin anulaciones. `cancelar-inscripcion.test.tsx`: aviso «Si abonaste esta clase, consultá en el centro por el reintegro» en la confirmación según el listado y en el éxito según `con_pagos` de la respuesta. SQL: pagos intactos |

## Verificaciones

Corridas del 12/10/2026 sobre el árbol final de la rama (cambios del delta desde `f7ff819` más el árbol de trabajo).

| # | Comando | Exit | Resultado |
|---|---|---:|---|
| 1 | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 0 | Sin errores |
| 2 | `eslint` sobre los 59 `.ts/.tsx` añadidos o modificados desde `f7ff819` | 0 | 59 archivos analizados, 0 errores, 0 advertencias |
| 3 | `node node_modules/vitest/vitest.mjs run --no-cache` sobre los archivos de B-07, C-13, C-14, C-20, C-24, L-06, L-07, D-08, B-08, ficha de alumno, aislamiento público e I-10 (32 archivos) | 0 | 477 aprobadas, 0 fallidas |
| 4 | `node node_modules/vitest/vitest.mjs run --no-cache` (suite completa, sin base PG) | 0 | 258 archivos aprobados y 54 omitidos; 3298 pruebas aprobadas, 432 omitidas (las PG sin base) |
| 5 | `node scripts/verificar-claves-textos.ts` | 0 | Claves de textos verificadas |
| 6 | `git diff --check f7ff819` | 0 | Sin hallazgos |
| 7 | `npm run test:pg -- <33 archivos PG de alumnos, materias, pagos, shared, usuarios, turnos (sin los tres con guarda de nombre fijo ni turno.generacion), profesor.estado y clases-alumno>` | 0 | 31 archivos y 286 pruebas en la base compartida; dos archivos con seed completo en base propia (2 y 5): 293 pruebas aprobadas. Bases `noctium_pruebas_<8 hex>` creadas, migradas y borradas por el ejecutor |
| 7b | `npm run test:pg -- src/server/turnos/turno.cancelacion-propia.pg.test.ts` | 0 | 35 aprobadas |
| 8 | `npm run build` | 0 | Compilación de producción correcta |
| 9 | Postman: `HU-C-14.postman_collection.json` con un ejecutor mínimo de Node (no hay `newman`), contra `next dev -p 3100` sobre una base descartable con migraciones y seed completo, sesiones obtenidas por el login real | 0 | 10 solicitudes, 53 aserciones, 0 fallidas (estado, envelope, `code`, `message` y `Cache-Control` en cada una) |
| 10 | SQL: `HU-C-14.sql` con `psql -v ON_ERROR_STOP=1` (`docker exec`): bloque ANTES, el POST 200 de la colección y bloque DESPUES | 0 | Aserciones correctas; el mismo bloque falla antes de cancelar («vigencia esperada CANCELADA_ALUMNO, hay VIGENTE») |
| 11 | Barrido de palabras de proceso sobre estos archivos | — | Sin coincidencias |

Detalle de las pruebas de C-14 (aprobadas en las corridas 3 y 7): `turno.cancelacion-propia.test` 17, `cancelacion/route.test` 18, `cancelar-inscripcion.test` 6, `alumno/page.test` 18, `turno.resumen-inscripcion.service.test` 17 (C-20), `turno.propios.test` 15 (C-13), `solicitar-turno.test` 11 (leyendas de C-20) y `turno.cancelacion-propia.pg.test` 35. Regresión en PG: `turno.propios.pg`, `turno.resumen-inscripcion.service.pg`, `turno.reserva-alumno.pg` (C-22 y C-24), `reserva.vencimiento.pg`, `inscripcion.service.pg`, `alumno.estado.pg` (B-07), `operacion.service.pg` y `pago.operacion.pg` (I-10).

Cobertura de la colección Postman: éxito con contrato exacto, `con_pagos` y cupo liberado; 401 sin sesión; 403 de Mesa de Entrada y de una cuenta de alumno sin ficha; 404 `TURNO_NO_ENCONTRADO`; 404 `INSCRIPCION_NO_ENCONTRADA` (alumno que nunca estuvo inscripto, que cubre también la inscripción de otro alumno); 409 `CANCELACION_FUERA_DE_PLAZO`; 409 `TURNO_CANCELADO`; 409 `TURNO_VENCIDO`; 409 `INSCRIPCION_NO_VIGENTE` al repetir la cancelación.

## Pruebas nuevas y sensibilidad verificada

| Regla | Prueba | Mutación probada | Resultado |
|---|---|---|---|
| Borde inclusivo de la anticipación | Unitarias de C-14 y C-20; PG `borde exacto de la anticipación mínima` | Cambiar `>` por `>=` en `superoElLimiteDeCancelacion` | Fallan 7: 4 unitarias de C-14, 2 de C-20 y 1 PG |
| Relectura bajo bloqueo | PG, pago de I-10 concurrente fuera de plazo y dentro de plazo | Evaluar la lectura previa de la inscripción en lugar de la releída | Fallan las 2 pruebas de pago concurrente |
| Eventos después del commit | PG, `historial y eventos de la clase` | Sin mutación formal: la prueba de visibilidad exige que el evento se escriba cuando la cancelación ya se ve desde otra conexión | Sensibilidad ⏳ no medida con mutación |

Otras pruebas nuevas: dos cancelaciones simultáneas (con intercalado forzado y con `Promise.all`); cancelación contra el alta de otro alumno en la misma clase, contra la baja de B-07 y contra el vencimiento automático de C-24, en los dos órdenes; fallo del escritor de eventos antes del commit (todo se revierte), después del commit con reintento y de forma persistente (la cancelación confirmada responde bien y se registra el error); `alumnos_inscriptos` con la regla de ocupación (una reserva vencida sin marcar no cuenta); IDOR (la identidad sale de la sesión) y cuenta sin ficha de alumno.

## Límites

- Los casos de Route Handler con `withPermission` simulado no acreditan la autenticación ni el RBAC reales; los acreditan los 401 y 403 de Postman con sesiones reales.
- La reprogramación se simula en PG con una actualización de fecha y hora; `turno.reprogramacion.pg.test.ts`, `turno.cancelacion.pg.test.ts` y `turno.prioridad.pg.test.ts` exigen una base con nombre fijo y no se ejecutaron: ⏳.
- La reserva sin pagar y los bordes exactos solo se prueban en unitarias y PG con reloj controlado; Postman no puede fijar el reloj del servidor.
- Los datos de Postman y SQL (clases y pagos) se insertaron directamente en la base descartable; no prueban los flujos de C ni de I que los crean.
- El seed completo termina con el reloj fijado en el 11/10/2026 (`SEED_FECHA_HOY=2026-10-11`). Con el reloj real del 12/10/2026 el fixture de HU-E-02 del seed falla con «Fixture E02 sin inscripción inicial», después de crear los datos base; es ajeno a esta HU.
- Una comprobación pendiente no se considera aprobada.

## Pendientes y diferidos

- ⏳ Recorrido de navegador de «Mis clases» (acción, confirmación, doble envío, error dentro del diálogo, etiqueta tras recargar): a cargo de Tomás.
- ⏳ CI sobre el SHA del PR.
- Diferido a HU-I-06: registro del reintegro (criterio 7). Diferido a HU-E-02: pantalla del historial de la inscripción (criterio 4). Diferido a HU-N-01: anticipación configurable (criterio 2; mientras tanto rige el valor por defecto de 24 h del seed). Los verifica quien integre cada una (convención 1 del Excel).
