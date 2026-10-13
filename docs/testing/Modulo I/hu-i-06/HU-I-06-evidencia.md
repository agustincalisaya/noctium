# HU-I-06 — Corregir o anular un pago registrado · Evidencia

Rama `feature/HU-I-06` (desde `origin/develop` en `1f503e9`). Ejecutado por Claude Code el 13/10/2026.

- **Nivel 1:** `vitest` local (unitarios con mocks y componentes en jsdom) y `npm run test:pg` (bases PostgreSQL descartables `noctium_pruebas_*`, creadas y borradas por el script).
- **Nivel 2 (Postman):** colección [`HU-I-06.postman_collection.json`](HU-I-06.postman_collection.json) ejecutada con **newman 6** contra `next dev` local (puerto 3001) y la base de desarrollo (`noctium_dev`, con el seed). Cada carpeta (A, B, C) corre en una ejecución aparte con su propio login de NextAuth y pasa a la siguiente el environment exportado. La contraseña se pasó con `--env-var` y no está en la colección; no se exportan cookies.
- **Nivel 3 (SQL):** consultas de solo lectura de [`HU-I-06.sql`](HU-I-06.sql) contra `noctium_dev` (`psql` en el contenedor `noctium_db`), después de las tres carpetas.
- **No se adjuntan capturas:** el recorrido en el navegador y la comparación con las fotos del prototipo (`Corregir pago.png`, `Anular pago.png`) quedan para el responsable.

## Nivel 1 — Unitarios y PostgreSQL real

| Comando | Resultado |
|---|---|
| `npx vitest run src/server/pagos/correccion.schema.test.ts src/server/pagos/correccion.flujos.test.ts src/server/pagos/correccion.lecturas.test.ts` | schemas (válidos, `refine`, motivo vacío/301, CUID, `.strict()`), flujos (solo monto, solo forma/fecha, los dos en orden, errores sin envolver), lecturas (tres tablas de origen, orden, empates, proceso automático, 404) — todos pasan |
| `npx vitest run "src/app/api/pagos/"` | 10 archivos, 98 pruebas: las 3 rutas nuevas (permiso, Zod antes del servicio, status de cada código de §2.14.5) y las existentes de pagos |
| `npx vitest run src/components/pagos` | 28 pruebas: `PagoAcciones` (9), `HistorialCambiosDialog` (3), `SelectorCajaAjuste` (3) y las existentes de caja/comprobante |
| `npx vitest run "src/app/(dashboard)/turnos/" "src/app/(dashboard)/alumnos/"` | 16 + 11 archivos (230 + 72 pruebas), incluidas las nuevas de «Pagos registrados» (anulado tachado, fuera del total y del aviso de cancelación) y de la columna «Acciones» del historial |
| `npx vitest run src/server/pagos/pago.publico.test.ts src/server/publico.aislamiento.test.ts src/server/turnos/turno.detalle.test.ts src/server/pagos/pago.service.test.ts` | `listarPagosDeClase` con `puede_corregir` (mesa 30 días + caja abierta, gerente, profesor, sin usuario; la caja nunca sale) y los tests migrados desde `listarPagosDeTurno`; aislamiento con `correccion.alcance.ts` |
| `npm run test:pg -- src/server/pagos/correccion.flujos.pg.test.ts src/server/pagos/correccion.lecturas.pg.test.ts src/server/pagos/correccion.service.pg.test.ts src/server/pagos/pago.publico.pg.test.ts src/server/pagos/pago.service.pg.test.ts` | 5 archivos, 27 pruebas pasan: flujos de punta a punta (solo monto, forma y fecha, monto + forma con dos reemplazos encadenados, rollback completo si falla la segunda parte, anulación con reserva reabierta, anulación de uno de varios, caja cerrada con `FUERA_DE_ALCANCE`/`CAJA_DE_AJUSTE_NO_ABIERTA`/ajuste), historial real (anterior → nuevo de cada evento, correcciones de la operación hechas desde otro pago, orden) y los tests de `correccion.service` del PR 0 migrados |
| `npm run test:pg -- src/server/pagos src/server/turnos` | 29 + 3 + 1 archivos (más 5 salteados por guarda de nombre de base), 234 + 18 + 22 pruebas pasan: sin regresiones en pagos, caja, comprobantes, inscripciones y turnos |
| `npx vitest run src/lib/claves-textos.test.ts --testTimeout=300000` | 36 pasan (claves nuevas `ui.pagos.correccion.*` con formato válido y referencias finitas). En una corrida con `next dev` y newman en paralelo, dos pruebas de este archivo vencieron el timeout por defecto de 60 s; sin esa carga y con el timeout ampliado, pasan todas |
| `npx tsc --noEmit` | sin errores en `src/` (los únicos son los preexistentes de `@playwright/test` en `scripts/testing`) |
| `npx eslint <archivos tocados>` | sin errores ni advertencias |

## Nivel 2 — Postman (newman)

Datos de entrada (consultas «Entrada» de `HU-I-06.sql`): `alumno_id = cmv7046ek000suws86d1xer1a`, `insc_1 = cmv708dq300t3uw58zclb7muh`, `insc_2 = cmv7088t000p3uw587hi8sl7t` (dos reservas vigentes de $ 22.000), `precio = 22000`, `pago_antiguo_id = cmv7057vv00xauws8kyonwvg6` (registrado el 18/11/2024 en la caja abierta de `mesa.entrada@`), `forma_inactiva_id` = «Cheque».

```
npx newman@6 run HU-I-06.postman_collection.json --folder "<carpeta>" -e env.json --export-environment env.json \
  --env-var password=<contraseña del seed> --env-var base_url=http://localhost:3001 \
  --env-var alumno_id=… --env-var insc_1=… --env-var insc_2=… --env-var precio=22000 \
  --env-var pago_antiguo_id=… --env-var forma_inactiva_id=…
```

> `base_url` se pasa con `--env-var` (el environment pisa la variable de colección; `--global-var` no).

| Carpeta | Pedidos | Aserciones | Fallidas |
|---|---|---|---|
| A · mesa2 (`mesa.entrada2@`) | 23 | 70 | 0 |
| B · gerente | 10 | 20 | 0 |
| C · profesor (`profesor1@`) | 6 | 13 | 0 |

Lo que cubre (§6 Nivel 2 de la task):

- **A01** cobra las dos clases por transferencia (201). **A02** corrige el monto → `200` con el contrato de §2.14.2 (`monto` 21000.00, `forma_pago` con `is_active`, `clases_abarcadas` 2, comprobante `0001-…`). **A03** los valores vigentes → `400 SIN_CAMBIOS`. **A04** forma inactiva nueva → `409 FORMA_PAGO_NO_DISPONIBLE`. **A05** fecha futura → `400 FECHA_PAGO_FUTURA`. **A06/A07** sin campos de cambio y motivo de 301 → `400 VALIDACION`.
- **A08** forma y fecha de la operación → `200`, alcanza a 2 clases. **A09** anula el segundo pago con «Reintegro» → `200` (inscripción reabierta, `vence_el` con offset, comprobante de reemplazo). **A10** `409 PAGO_YA_ANULADO`; **A11** corregir el anulado `409 PAGO_ANULADO`.
- **A12/A13** historial → `200`, más nuevo primero, cada evento con su anterior → nuevo (la forma por nombre); el pago anulado ve la anulación y las correcciones de la operación. **A14** pago sin cambios → `cambios: []`; **A15** inexistente → `404`.
- **A16** mesa de entrada sobre un pago de hace más de 30 días → `403 FUERA_DE_ALCANCE`. **A17/A18** mesa2 cierra su caja; **A19** mesa sobre el pago de su caja ya cerrada → `403 FUERA_DE_ALCANCE`.
- **B02** el gerente sobre ese pago sin caja de ajuste → `409 CAJA_DE_AJUSTE_NO_ABIERTA`; **B03** con la caja abierta de `mesa.entrada@` → `200`. **B05/B06** el gerente corrige el pago de 2024 y lo restituye → `200` y `200`; **B07** historial con las dos correcciones.
- **C01–C03** el profesor (sin `pagos:leer` ni `pagos:corregir`) → `403 SIN_PERMISO` en las tres rutas.

## Nivel 3 — SQL (después de las tres carpetas)

`pago_1 = cmv70jmgn0009uw7c85f035vc`, `pago_2 = cmv70jmi7000buw7cu9a2j6sa`, operación `cmv70jmgd0007uw7ctzlyh0cw`.

- **N1 · Regla N.° 8:** las dos filas de `pagos` conservan `montoPago` 22000.00, `formapago-transferencia` y la fecha 2026-10-13 (ningún `UPDATE`).
- **N2:** `correcciones_pago` del pago 1: 22000 → 21000 «Beca parcial (HU-I-06)» (mesa2) y 21000 → 20000 «Beca (gerente)» (gerente).
- **N3:** `correcciones_operacion`: una fila por campo — transferencia → débito y 2026-10-13 → 2026-10-12, mismo motivo.
- **N4:** `anulaciones_pago` del pago 2 con «Reintegro», `actorTipo` USUARIO; índice único `anulaciones_pago_pagoId_key` sobre `"pagoId"`.
- **N5:** cinco comprobantes encadenados (números 39 → 43), cada uno reemplaza al anterior y solo el último no está reemplazado (corregir monto, corregir forma y fecha, anular uno de dos, corrección del gerente).
- **N6 · HU-C-24 c5:** la inscripción del pago anulado volvió a `RESERVADA` con plazo nuevo y `reabiertaPorAnulacion = true`; la del otro pago sigue `PAGADA`.
- **N7 · caja cerrada:** un `ajustes_caja` de −1000.00 en débito (la forma vigente) en la caja abierta de `mesa.entrada@`, con origen `correccionPagoId`; la caja de mesa2 sigue `CERRADA` con su esperado y diferencia del cierre (0.00).
- **N8:** el pago de 2024: dos correcciones del gerente (1011000 → 1011001 → 1011000) y ningún ajuste (su caja sigue abierta).
- **N9:** «Pagada ⇔ ≥ 1 pago no anulado» en toda la base: 0 filas que la violen.

## Datos que quedan en la base de desarrollo

- **La caja de `mesa.entrada2@` queda CERRADA**, con la operación de prueba (pago 1 vigente por $ 20.000 en débito; pago 2 anulado). Para volver a cobrar con esa cuenta hay que abrir una caja nueva desde «Mi caja».
- Una primera corrida de la carpeta A apuntó por error al puerto 3000 (otro proceso con código anterior a esta rama, sin las rutas nuevas): cobró dos clases de `cmv7046e9000quws896st1ssp` y cerró una caja anterior de mesa2; sus correcciones devolvieron 404 y no escribieron nada. Antes, otra corrida falló en A01 por una reserva ya vencida (`RESERVA_VENCIDA`, sin cobro) y también cerró una caja vacía de mesa2. Por eso la consulta E1 exige reservas sin vencer.
- En la caja abierta de `mesa.entrada@` queda el ajuste de −$ 1.000 en débito; el pago de 2024 queda con su monto original y dos correcciones.
