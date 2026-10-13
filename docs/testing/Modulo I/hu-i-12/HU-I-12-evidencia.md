# HU-I-12 — Evidencia de implementación y validación

Task: [HU-I-12](../../../tasks/Sprint%203/Modulo%20I/HU-I-12.md). Contrato: [Módulo I](../../../specs/spec_modulo_I.md) §2.10.1, §2.10.2, §2.10.5, §2.11 y §2.12. Movimientos manuales y ajustes: HU-I-12-b (fuera de alcance).

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (bases PostgreSQL descartables `noctium_pruebas_*`, creadas y borradas por el script).
- **Nivel 2 (pedidos HTTP):** ejecutados con curl (guion en Python) contra `next dev` local y la base de desarrollo (`noctium_dev`), por Claude Code, el 12/10/2026. Sesiones por el login de NextAuth (`/api/auth/csrf` y `/api/auth/callback/credentials`) con las cuentas del seed. No se incluyen cookies ni contraseñas. La colección [`HU-I-12.postman_collection.json`](HU-I-12.postman_collection.json) tiene los mismos casos con sus asserts, para repetirlos desde Postman.
- **Nivel 3 (SQL y pantallas):** consultas de solo lectura contra la base de desarrollo (`psql` en el contenedor `noctium_db`, archivo [`HU-I-12.sql`](HU-I-12.sql)) y verificación de las pantallas por HTTP (estado, redirección por rol y contenido renderizado). **No se adjuntan capturas**: el recorrido en el navegador y la comparación con las fotos del prototipo quedan para el responsable.

## Criterios de aceptación (backlog, HU-I-12)

| Criterio | Qué lo cubre | Nivel | Estado |
|---|---|---|---|
| 1. Abrir caja con fondo (puede ser 0), fecha, hora y usuario; una sola abierta aunque se abran dos a la vez | `caja.schema.test.ts`; `route.test.ts` (201, 400, 409); `abrir-caja-dialog.test.tsx`; `caja.flujos.pg.test.ts` («abrir…», «dos aperturas simultáneas…»); Nivel 2: pedidos 02 a 06, 22 y 49; Nivel 3: 3.1 y 3.2 | 1, 2 y 3 | Verificado |
| 2. Sin caja abierta no se cobra; mensaje con acceso a «Abrir caja» | Servidor: ya del PR 0 (`CAJA_NO_ABIERTA`); Nivel 2: pedido 21. Interfaz: `registrar-pago-wizard.test.tsx` y `turnos/[id]/registrar-pago-dialog.test.tsx` (enlace «Abrir caja» → `/caja` solo con `CAJA_NO_ABIERTA`); `confirmar-accion-dialog.test.tsx` (`accionError`) | 1 y 2 | Verificado |
| 5. Arqueo ciego y cierre en dos pasos; monto declarado fijo; `CAJA_CAMBIO` con el resumen actualizado | `caja.lecturas.test.ts` (sin ninguna clave de total, también anidada); `caja.lecturas.pg.test.ts`; `cerrar-caja-dialog.test.tsx` (paso 1 sin totales, no avanza sin monto válido, `CAJA_CAMBIO` reemplaza resumen y huella sin cerrar); `caja.flujos.pg.test.ts` («cierre propio completo…»); Nivel 2: pedidos 01, 03, 07 a 12 | 1, 2 y 3 | Verificado |
| 6. Resumen: fondo, cobros por forma (cantidad y total), ingresos, egresos, ajustes, esperado (solo efectivo), declarado, diferencia | `calcularResumen` del PR 0 (`caja.service.pg.test.ts`, sin cambios); `resumen-cierre-caja.tsx` con «(no entra en el arqueo)» (`cerrar-caja-dialog.test.tsx`); Nivel 2: pedidos 08 y 12; Nivel 3: 3.3 y 3.4 | 1, 2 y 3 | Verificado |
| 7. «Sobrante/Faltante de $ N» o «La caja cuadra»; motivo obligatorio con diferencia (hasta 300) | `caja.test.ts` (textos literales); `cerrar-caja-dialog.test.tsx` (motivo obligatorio u «Observación» opcional); `route.test.ts` y Nivel 2: pedidos 13 y 14 (`MOTIVO_DIFERENCIA_REQUERIDO`, 301 caracteres) | 1 y 2 | Verificado |
| 8. Confirmación de HU-C-25 irreversible; caja inmutable; detalle con «Imprimir» que muestra solo el cierre | `caja.test.ts` y `cerrar-caja-dialog.test.tsx` (texto del criterio 8 y leyenda irreversible); `caja.lecturas.test.ts` (el detalle no recalcula); Nivel 2: pedidos 15, 16, 19 y 27; Nivel 3: 3.3 y 3.6; regla `@media print` de `globals.css` sobre `[data-cierre-caja]` (pantallas verificadas por HTTP) | 1, 2 y 3 | Verificado. La impresión en el navegador: **pendiente del responsable** |
| 9. Concurrencia cobro/cierre | PR 0 (`caja.service.pg.test.ts`, sin cambios); `caja.flujos.pg.test.ts` («el integrante y el gerente cierran a la vez…»); Nivel 2: pedidos 11 y 12 | 1 y 2 | Verificado |
| 10. El gerente ve las abiertas con su antigüedad; cierre por ausencia con el mismo arqueo, marcado y con el gerente como responsable; la baja con caja abierta se rechaza | `caja.lecturas.pg.test.ts` (abiertas sin montos); `caja.flujos.pg.test.ts` («cierre por ausencia…», «por ausencia sobre la propia caja: FUERA_DE_ALCANCE»); `cerrar-caja-dialog.test.tsx` (modo ausencia); `estado-integrante-dialog.test.tsx` (enlace «Ir a Cierres de caja»); Nivel 2: pedidos 23, 30 a 36, 43 a 48; Nivel 3: 3.1 | 1, 2 y 3 | Verificado |
| 11. Cada integrante ve su caja y sus cierres; el gerente todos, con filtro por integrante y fechas, de a 10; 403 al resto | `caja.lecturas.test.ts` y `.pg.test.ts` (paginación, filtros por fecha de cierre); `route.test.ts` (401/403 en las 11 rutas con su permiso exacto); `rutas-por-rol.test.ts` y `Sidebar.caja.test.tsx`; Nivel 2: pedidos 18 a 20, 24 a 26, 31, 38 a 41 | 1, 2 y 3 | Verificado |

**Verificación diferida:** criterio 3 (movimientos manuales) es de HU-I-12-b; la segunda mitad del criterio 4 (ajustes al corregir o anular pagos de cajas cerradas) queda para HU-I-06. **HU-F-05:** el enlace pendiente a «Cierres de caja» queda agregado y probado.

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| `caja.schema.test.ts` (nuevo) | 24 pasan |
| `caja.lecturas.test.ts` (nuevo, base simulada) | 12 pasan |
| `src/app/api/cajas/route.test.ts` (nuevo, las 11 rutas) | 36 pasan |
| `src/lib/caja.test.ts` (nuevo, formatos) | 6 pasan |
| `cerrar-caja-dialog.test.tsx` y `abrir-caja-dialog.test.tsx` (nuevos) | 7 y 6 pasan |
| `Sidebar.caja.test.tsx` y `turnos/[id]/registrar-pago-dialog.test.tsx` (nuevos) | 4 y 2 pasan |
| `confirmar-accion-dialog.test.tsx`, `registrar-pago-wizard.test.tsx`, `estado-integrante-dialog.test.tsx` y `rutas-por-rol.test.ts` (ampliados) | 13, 12, 13 y 37 pasan |
| PostgreSQL real: `caja.flujos.pg.test.ts` y `caja.lecturas.pg.test.ts` (nuevos) | 7 y 3 pasan |
| `npm run test:pg -- src/server/pagos src/server/personal` | 14 archivos, 106 pasan (incluye `caja.service.pg.test.ts` sin cambios) |
| Suite unitaria completa (`vitest run`) | 274 archivos pasan, 57 omitidos. En esa corrida fallaron `claves-textos.test.ts` (superó su límite de 60 s por la carga: 333 s) y una prueba de `errores-dominio.test.ts` por dos claves con dígitos (`paso1`/`paso2`), que se renombraron. Corridos solos después del arreglo: 49 de 49 pasan |
| `scripts/verificar-claves-textos.ts` | Aprobado |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint sobre lo nuevo y lo tocado | Sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía) |
| `next build` | Compila; incluye las 11 rutas de `/api/cajas/**`, `/caja`, `/caja/cierres/[id]`, `/cajas` y `/cajas/[id]` |

`caja.service.ts` y `caja.service.pg.test.ts` no se modificaron; no se encontró ningún hueco en el servicio.

## Nivel 2 — Pedidos HTTP (ejecutados con curl)

Sesiones: «mesa2» = `mesa.entrada2@noctium.local` (Ferreyra, Pablo), «mesa1» = `mesa.entrada@noctium.local` (Ruiz, Marta), «gerente» = `gerente@noctium.local` (Paredes, Silvia), `profesor1@` y `alumno01@`. Preparación: dos inscripciones de la alumna López, Valentina (40100003) en `seed-turno-05` ($ 24.000) y `seed-turno-06` ($ 11.000), con `POST /api/turnos/[id]/alumnos`. Un primer intento del guion cerró la caja original de mesa2 cuadrando ($ 0); la corrida de la tabla arranca desde ahí.

| # | Rol | Pedido | Esperado | Resultado |
|---|---|---|---|---|
| 01 | mesa2 | `GET /api/cajas/mia` | `{ caja: null }` | OK |
| 02 | mesa2 | `POST /api/cajas` `{ fondo_inicial: "5000" }` | 201 | OK. `fondo_inicial: "5000.00"`, `abierta_el` con −03:00 |
| 03 | mesa2 | `GET /api/cajas/mia` | 200, ítems sin totales | OK. `items: []`, `efectivo_declarado: null`, sin `efectivo_esperado` |
| 04 | mesa2 | `POST /api/cajas` otra vez | 409 `CAJA_YA_ABIERTA` | OK. «Ya tenés una caja abierta.» |
| 05 | mesa2 | fondo `"-1"` | 400 | OK. `VALIDACION`, `fieldErrors.fondo_inicial` |
| 06 | mesa2 | campo extra | 400 | OK. `VALIDACION` |
| 07 | mesa2 | `GET /api/cajas/mia/resumen` antes de declarar | 409 `EFECTIVO_NO_DECLARADO` | OK. «Primero declará el efectivo contado.» |
| 08 | mesa2 | `POST /api/cajas/mia/declaracion` `"5000"` | 200 con resumen y huella | OK. Esperado 5000.00, `CUADRA` |
| 09 | mesa2 | declarar otra vez | 409 `EFECTIVO_YA_DECLARADO` | OK |
| 10 | mesa2 | `GET /api/cajas/mia` | `efectivo_declarado` informado, sin totales | OK. `efectivo_declarado: "5000.00"` |
| 11 | mesa2 | `POST /api/pagos/operaciones` (efectivo, $ 24.000) | 201: la caja admite cobros mientras se cierra | OK. Comprobante 0001-00000029 |
| 12 | mesa2 | `POST /api/cajas/mia/cierre` con la huella vieja | 409 `CAJA_CAMBIO` con `detalles` | OK. Esperado 29000.00, declarado 5000.00, diferencia −24000.00 `FALTANTE`, huella nueva |
| 13 | mesa2 | cierre con la huella nueva, sin motivo | 400 `MOTIVO_DIFERENCIA_REQUERIDO` | OK |
| 14 | mesa2 | motivo de 301 caracteres | 400 | OK. «El motivo no puede superar los 300 caracteres» |
| 15 | mesa2 | cierre con motivo | 200 `CERRADA` | OK. −24000.00 `FALTANTE`, `por_ausencia: false` |
| 16 | mesa2 | doble cierre | 409 `CAJA_YA_CERRADA` | OK |
| 17 | mesa2 | `GET /api/cajas/mia` | `{ caja: null }` | OK |
| 18 | mesa2 | `GET /api/cajas/mia/cierres` | 200, de a 10 | OK. 2 cierres, el último primero; `cerrada_por: null` |
| 19 | mesa2 | `GET /api/cajas/mia/cierres/{id}` | 200 con resumen fijo y centro | OK. Esperado 29000.00; centro «Instituto Noctium» |
| 20 | mesa1 | el mismo detalle (cierre ajeno) | 403 `FUERA_DE_ALCANCE` | OK |
| 21 | mesa2 | cobro sin caja abierta | 409 `CAJA_NO_ABIERTA` | OK. «No se puede registrar un cobro hasta que abras una caja.» |
| 22 | mesa2 | reabrir con fondo 0 | 201 | OK |
| 23 | gerente | `GET /api/cajas` | 200: abiertas con antigüedad, sin montos | OK. Ruiz (4339 min) y Ferreyra (0 min); cierres de a 10 |
| 24 | gerente | filtrado por integrante (mesa2) y fecha de cierre de hoy | 200 | OK. Solo los 2 cierres de Ferreyra |
| 25 | gerente | `desde` posterior a `hasta` | 400 | OK. `fieldErrors.hasta` |
| 26 | mesa1 | `GET /api/cajas` | 403 `SIN_PERMISO` | OK |
| 27 | gerente | `GET /api/cajas/{cierre}` | 200 | OK. `cerrada_por: null` |
| 28 | gerente | `GET /api/cajas/{caja abierta de mesa1}` | 409 `CAJA_NO_CERRADA` | OK |
| 29 | gerente | id inexistente | 404 `CAJA_NO_ENCONTRADA` | OK |
| 30 | gerente | `GET …/ausencia/resumen` antes de declarar | 409 `EFECTIVO_NO_DECLARADO` | OK |
| 31 | mesa2 | `POST …/ausencia/declaracion` | 403 `SIN_PERMISO` | OK |
| 32 | gerente | `POST …/ausencia/declaracion` `"0"` | 200 | OK. Integrante Ruiz, Marta; esperado 48000.00 (cobros del seed), `FALTANTE` |
| 33 | gerente | `GET …/ausencia/resumen` | 200, misma huella | OK |
| 34 | gerente | `POST …/ausencia/cierre` sin motivo | 400 `MOTIVO_DIFERENCIA_REQUERIDO` | OK (el guion esperaba 200 suponiendo que cuadraba; la respuesta es la correcta) |
| 35 | gerente | declarar otra vez | 409 `EFECTIVO_YA_DECLARADO` | OK |
| 36 | mesa1 | `POST /api/cajas/mia/cierre` sin motivo | 400 `MOTIVO_DIFERENCIA_REQUERIDO` | OK (ver «Observaciones») |
| 38 | gerente | `POST /api/cajas` | 403 `SIN_PERMISO` | OK. El gerente no abre cajas |
| 39–40 | profesor, alumno | `GET /api/cajas/mia` | 403 | OK |
| 41 | sin sesión | `GET /api/cajas/mia` | 401 `SESION_INVALIDA` | OK |
| 43 | gerente | `GET …/ausencia/resumen` | 200 | OK. −48000.00 `FALTANTE` |
| 44 | gerente | `POST …/ausencia/cierre` con motivo | 200 `por_ausencia: true` | OK |
| 45 | gerente | declarar sobre la caja cerrada | 409 `CAJA_YA_CERRADA` | OK |
| 46 | mesa1 | cerrar la propia, ya cerrada por ausencia | 409 `CAJA_YA_CERRADA` | OK |
| 47 | gerente | `GET /api/cajas/{id}` | `por_ausencia: true`, `cerrada_por` = el gerente | OK. Paredes, Silvia |
| 48 | mesa1 | `GET /api/cajas/mia/cierres/{id}` (su cierre por ausencia) | 200 | OK |
| 49 | mesa1 | reabrir con fondo 0 | 201 | OK |

Los pedidos 37 y 42 del guion eran del mismo error de suposición (caja sin cerrar todavía); se repitieron como 43 a 49. El cierre por ausencia sobre la propia caja (403 `FUERA_DE_ALCANCE`) no es alcanzable por HTTP porque el gerente no tiene caja: lo cubren `caja.flujos.pg.test.ts` y `caja.lecturas.test.ts`.

**Pantallas (por HTTP):** con mesa2, `/caja` 200 («Caja abierta», leyenda del arqueo ciego, «Mis cierres» con «Faltante de $ 24.000» y «La caja cuadra»), `/caja/cierres/{propio}` 200, `/caja/cierres/{ajeno}` 404 y `/cajas` → 307 `/sin-permiso`. Con el gerente, `/cajas` 200 (abiertas, «Cierre por ausencia», cierres de ambos integrantes), con filtros 200, `/cajas/{cierre por ausencia}` 200 (`data-cierre-caja`, «Cierre por ausencia, hecho por Paredes, Silvia», datos del centro, «Imprimir»), `/cajas/{caja abierta}` 404 y `/caja` → 307 `/sin-permiso`. El profesor en `/caja` → 307 `/sin-permiso`.

## Nivel 3 — Base de datos

Consultas de [`HU-I-12.sql`](HU-I-12.sql) después del Nivel 2:

| Consulta | Resultado |
|---|---|
| 3.1 Estado de cada caja | La caja nueva de mesa2 quedó `CERRADA` con fondo 5000.00, declarado 5000.00, esperado 29000.00, diferencia −24000.00, motivo, `cerradaPor` = mesa2, `USUARIO` y `resumen`. La caja del seed de mesa1 quedó `CERRADA`, `porAusencia = true`, `cerradaPor` = gerente, diferencia −48000.00. Las dos cuentas tienen otra vez una caja `ABIERTA` (fondo 0) con `efectivoDeclarado` NULL |
| 3.2 Más de una abierta por integrante | 0 filas |
| 3.3 Coherencia de las cerradas | Las 3: `diferencia = declarado − esperado` y el `resumen` guardado coincide con las columnas |
| 3.4 Resumen fijo | Fondo 5000.00, un cobro en Efectivo de 24000.00, esperado 29000.00, declarado 5000.00, `FALTANTE` |
| 3.5 Cobros de la caja | Un pago de 24000.00 en `formapago-efectivo` |
| 3.6 Operaciones posteriores al cierre | 0 filas |

La declaración (paso 1) dejó `efectivoDeclarado` con la caja `ABIERTA` (Nivel 2, pedidos 08 y 10); el mismo estado intermedio lo verifica `caja.flujos.pg.test.ts` contra la fila.

## Observaciones

- **Datos de desarrollo modificados por el Nivel 2:** las dos cajas originales del seed quedaron cerradas (la de mesa1 por ausencia, con los cobros del seed como faltante de $ 48.000) y las dos cuentas tienen una caja nueva abierta con fondo 0, así que se puede seguir cobrando. La alumna López, Valentina quedó inscripta en `seed-turno-05` (pagada) y en `seed-turno-06` (reservada). Un `npx prisma migrate reset` vuelve al seed.
- **Declaración compartida en el cierre por ausencia:** el monto declarado se guarda en la caja, sin importar quién lo declaró (servicio del PR 0). Si el gerente declara por ausencia y el integrante abre «Cerrar caja», entra directo al paso 2 con ese monto y puede cerrarla como cierre propio (pedido 36: llegó hasta el motivo). La spec admite que los dos cierren («gana el primero»), pero no dice qué pasa con la declaración ajena. No se cambió el servicio; queda para que el equipo decida si hace falta una regla.
- **Fixtures de presentación:** el backlog pide fixtures repetibles de la caja para la demo; la task no los incluye y no se crearon.
- **Capturas:** no se adjuntan. El recorrido visual (vacía, abierta, paso 1 y 2, «la caja cambió», listado, detalle, impresión y cierre por ausencia) contra las fotos de `Imagenes HU/HU-I-12` queda para el responsable. «Registrar movimiento» no aparece: es de HU-I-12-b.
