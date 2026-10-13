# HU-I-12-b — Evidencia de implementación y validación

Task: [HU-I-12-b](../../../tasks/Sprint%203/Modulo%20I/HU-I-12-b.md). Contrato: [Módulo I](../../../specs/spec_modulo_I.md) §2.10.3, §2.10.4 y §2.10.5. Se construye sobre «Mi caja» de [HU-I-12](../hu-i-12/HU-I-12-evidencia.md). Ajustes de caja (criterio 4): HU-I-06 (fuera de alcance).

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (bases PostgreSQL descartables `noctium_pruebas_*`, creadas y borradas por el script).
- **Nivel 2 (Postman):** colección [`HU-I-12-b.postman_collection.json`](HU-I-12-b.postman_collection.json) ejecutada con **newman 6** contra `next dev` local y la base de desarrollo (`noctium_dev`, con el seed), por Claude Code, el 12/10/2026. Cada carpeta (A, B, C) corre en una ejecución aparte con su propio login de NextAuth (`/api/auth/csrf` + `/api/auth/callback/credentials`) y pasa a la siguiente el environment exportado. La contraseña se pasó con `--env-var` y no está en la colección; no se exportan cookies.
- **Nivel 3 (SQL):** consultas de solo lectura contra la base de desarrollo (`psql` en el contenedor `noctium_db`, archivo [`HU-I-12-b.sql`](HU-I-12-b.sql)). La pantalla `/caja` también se verificó por HTTP (estado, redirección por rol y contenido renderizado). **No se adjuntan capturas**: el recorrido en el navegador y la comparación con las fotos del prototipo (`Registrar movimiento manual.png`, `Caja abierta (arqueo ciego).png`) quedan para el responsable.

Comando de la corrida (una por carpeta, en orden):

```
npx newman@6 run HU-I-12-b.postman_collection.json --folder "<carpeta>" -e env.json --export-environment env.json --env-var password=<contraseña del seed>
```

## Criterio de aceptación (backlog, HU-I-12 criterio 3)

| Parte del criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| Registrar un ingreso o un egreso de efectivo con monto y concepto, en la caja propia abierta | `caja.schema.test.ts`; `movimientos/route.test.ts`; `registrar-movimiento-dialog.test.tsx`; `mi-caja.test.tsx`; `caja.movimientos.pg.test.ts` («registrar…», «sin caja abierta…»); Nivel 2: A01, B01, B02, B04 a B07; Nivel 3: 3.1 | 1, 2 y 3 | Verificado |
| Un egreso no puede superar el efectivo esperado, sin mostrar el esperado (arqueo ciego) | `caja.movimientos.pg.test.ts` («egreso hasta el efectivo esperado…», borde exacto); `movimientos/route.test.ts`; `registrar-movimiento-dialog.test.tsx` (rechazo dentro de la confirmación); Nivel 2: B03 y B16 | 1 y 2 | Verificado |
| Un movimiento no se edita: se anula con un motivo mientras la caja está abierta; la anulación es un registro nuevo | `caja.schema.test.ts`; `movimientos/route.test.ts`; `anular-movimiento-dialog.test.tsx`; `mi-caja.test.tsx` (fila «Anulado» sin la acción); `caja.movimientos.pg.test.ts` («anular…», «dos anulaciones simultáneas…», «caja cerrada…»); Nivel 2: B08 a B14, B17 a B19; Nivel 3: 3.2 a 3.4 | 1, 2 y 3 | Verificado |
| Solo la caja propia; el gerente no registra ni anula | `movimientos/route.test.ts` (401/403); `caja.movimientos.pg.test.ts` («…de otro integrante o inexistente: 404»); `mi-caja.test.tsx` (sin el permiso no hay acciones); Nivel 2: B11, B12, C01 a C03; Nivel 3: 3.5; `/caja` por HTTP | 1, 2 y 3 | Verificado |

**Verificación diferida:** la segunda mitad del criterio 4 (ajustes al corregir o anular pagos de cajas cerradas) queda para HU-I-06, igual que en HU-I-12.

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| `src/server/pagos/caja.schema.test.ts` (ampliado: `RegistrarMovimientoSchema` y `AnularMovimientoSchema`) | 46 pasan (24 de HU-I-12 + 22 nuevos) |
| `src/app/api/cajas/mia/movimientos/route.test.ts` (nuevo, las 2 rutas) | 25 pasan |
| `registrar-movimiento-dialog.test.tsx` (nuevo): no deja confirmar con concepto vacío ni monto ≤ 0, contador, confirmación con «un egreso de $ N», `EGRESO_SUPERA_EFECTIVO` dentro de la confirmación, `CAJA_NO_ABIERTA` con el texto de UI | 12 pasan |
| `anular-movimiento-dialog.test.tsx` (nuevo): no deja confirmar sin motivo, confirmación irreversible con una sola leyenda, rechazos dentro de la confirmación | 6 pasan |
| `mi-caja.test.tsx` (nuevo): «Anular» solo en movimientos no anulados; el anulado se ve «Anulado», tachado y sin la acción; sin `cajas:movimiento` no hay acciones | 4 pasan |
| `src/app/api/cajas/route.test.ts` y `abrir-caja-dialog.test.tsx` (HU-I-12, sin cambios) | 36 y 6 pasan |
| PostgreSQL real: `caja.movimientos.pg.test.ts` (nuevo) | 8 pasan |
| `npm run test:pg -- src/server/pagos` | 13 archivos, 85 pasan (incluye `caja.service.pg.test.ts` y `caja.flujos.pg.test.ts` sin cambios) |
| Suites relacionadas (`src/server/pagos`, `/caja`, `/api/cajas`, `src/components/pagos`, `confirmar-accion-dialog`, `src/lib/caja`, textos y errores) | 24 archivos pasan, 13 omitidos (pg). `claves-textos.test.ts` superó su límite de 60 s por la carga de la corrida conjunta (63,9 s); corrido solo: 36 de 36 pasan |
| `scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.» |
| TypeScript (`tsc --noEmit`) | Sin errores en el código (los únicos errores salen de `.next/dev/types`, archivos generados por `next dev`) |
| ESLint sobre lo nuevo y lo tocado | Sin errores |

`caja.service.ts` y `caja.service.pg.test.ts` no se modificaron; no se encontró ningún hueco en el servicio.

## Nivel 2 — Postman (newman)

Sesiones: «mesa» = `mesa.entrada2@noctium.local` (Ferreyra, Pablo), «mesa_otra» = `mesa.entrada@noctium.local` (Ruiz, Marta), «gerente» = `gerente@noctium.local`. Las dos cuentas de mesa ya tenían su caja abierta (el pedido de apertura respondió 409 `CAJA_YA_ABIERTA`, aceptado por la colección).

**Resultado de la corrida final:** A 5 pedidos / 7 aserciones, B 24 pedidos / 49 aserciones, C 6 pedidos / 9 aserciones. **0 fallas.** Una corrida anterior completa dio los mismos resultados en todos los pedidos de la HU y falló solo una aserción de control del login (esperaba el email en `/api/auth/session`, que por diseño no lo expone: spec A §2.2). Se cambió para controlar el rol y el id de la sesión, y la corrida se repitió.

| # | Rol | Pedido | Esperado | Resultado |
|---|---|---|---|---|
| A01 | mesa_otra | `POST /api/cajas/mia/movimientos` ingreso $ 10 | 201 | OK. Lo usan B11 y C03 |
| B01 | mesa | ingreso $ 1000, concepto con espacios | 201 `{ id, tipo, monto, concepto, momento }` | OK. `monto: "1000.00"`, concepto recortado, `momento` con −03:00 |
| B02 | mesa | `GET /api/cajas/mia` | el movimiento primero, sin totales | OK. `items[0]` es el nuevo, `anulado: false`, sin `efectivo_esperado` |
| B03 | mesa | egreso $ 999.999.999 | 409 `EGRESO_SUPERA_EFECTIVO`, sin el esperado | OK. «El egreso supera el efectivo de la caja.» Sin `detalles` y sin `esperado`, `resumen` ni `total` en el cuerpo; el mensaje no tiene dígitos |
| B04 | mesa | monto `"0"` | 400 | OK. `VALIDACION`, `fieldErrors.monto` |
| B05 | mesa | concepto de espacios | 400 | OK. «Ingresá el concepto» |
| B06 | mesa | concepto de 201 caracteres | 400 | OK. «El concepto no puede superar los 200 caracteres» |
| B07 | mesa | `tipo: "AJUSTE"` y campo extra | 400 | OK. `VALIDACION` |
| B08 | mesa | `POST …/{B01}/anulacion` | 201 | OK |
| B09 | mesa | anular otra vez | 409 `MOVIMIENTO_YA_ANULADO` | OK |
| B10 | mesa | `GET /api/cajas/mia` | el movimiento con `anulado: true` y el monto intacto | OK |
| B11 | mesa | anular el movimiento A01 (de otra caja) | 404 `MOVIMIENTO_NO_ENCONTRADO` | OK (no 403: no confirma que existe) |
| B12 | mesa | anular `no-existe` | 404 `MOVIMIENTO_NO_ENCONTRADO` | OK |
| B13 | mesa | motivo de espacios | 400 | OK. «Ingresá el motivo» |
| B14 | mesa | motivo de 301 caracteres | 400 | OK. «El motivo no puede superar los 300 caracteres» |
| B15 | mesa | ingreso $ 1.000.000 (preparación) | 201 | OK |
| B16 | mesa | egreso $ 1.000.000 | 201 (no supera el esperado) | OK |
| B17 | mesa | anular el ingreso de B15 | 409 `ANULACION_DEJA_EFECTIVO_NEGATIVO`, sin el esperado | OK. «No se puede anular: la caja quedaría con efectivo negativo.» Sin `detalles` ni montos |
| B18 | mesa | anular el egreso de B16 (limpieza) | 201 | OK |
| B19 | mesa | anular el ingreso de B15 (limpieza) | 201 | OK. La caja vuelve al mismo esperado |
| C01 | sin sesión | `POST /api/cajas/mia/movimientos` | 401 | OK |
| C02 | gerente | `POST /api/cajas/mia/movimientos` | 403 `SIN_PERMISO` | OK |
| C03 | gerente | `POST …/{A01}/anulacion` | 403 `SIN_PERMISO` | OK |

## Nivel 3 — BD (SQL) y pantalla por HTTP

Consultas de [`HU-I-12-b.sql`](HU-I-12-b.sql) después de las dos corridas de newman:

| # | Verificación | Resultado |
|---|---|---|
| 3.1 | Tras registrar: fila en `movimientos_caja` con `tipo`, `monto`, `concepto`, `creadoPorUsuarioId` y `createdAtMovimientoCaja` | OK. 8 filas (4 por corrida): p. ej. `INGRESO 1000.00 «Ingreso de cambio para la caja»`, registrado por `mesa.entrada2@`, caja `ABIERTA` |
| 3.2 | Tras anular: fila en `anulaciones_movimiento` con `movimientoId`, `actorTipo`, `motivo`, usuario y fecha | OK. 6 filas, `actorTipo = USUARIO`, `anulado_por = mesa.entrada2@`, motivos «Se cargó por error» / «Limpieza de la prueba» |
| 3.3 | Una sola anulación por movimiento | OK. 0 filas (los pedidos B09 no crearon una segunda) |
| 3.4 | El movimiento original no se modifica (Regla N.° 8) | OK. `movimientos_caja` no tiene columnas de estado ni de actualización; 0 anulaciones anteriores a su movimiento; B10 devuelve el monto intacto |
| 3.5 | Cada anulación la hizo el dueño de la caja del movimiento | OK. 0 filas de otro integrante |

**Pantalla `/caja` por HTTP (sin navegador):** con la sesión de `mesa.entrada2@`, 200: botón «Registrar movimiento», 6 ítems «Anulado» y ningún «Anular» (todos sus movimientos están anulados); sin `efectivo_esperado` en el HTML. Con `mesa.entrada@`, 200: «Anular» en sus 2 movimientos vigentes. Con `gerente@`, 307 a `/sin-permiso`.

**Datos que quedan en la base de desarrollo:** en la caja abierta de `mesa.entrada@` quedan 2 ingresos de $ 10 «Movimiento de otra caja (HU-I-12-b)» sin anular (los usan B11 y C03). En la caja de `mesa.entrada2@`, todos los movimientos de la prueba están anulados y el efectivo esperado es el de antes.

## Pendiente del responsable (a mano)

- Capturas: el modal «Registrar movimiento» (comparar con `Registrar movimiento manual.png`), el listado con un movimiento anulado (`Caja abierta (arqueo ciego).png`) y el error `EGRESO_SUPERA_EFECTIVO` dentro de la confirmación, sin el esperado.
- Toasts «Movimiento registrado correctamente» y «Movimiento anulado correctamente» en el navegador.
