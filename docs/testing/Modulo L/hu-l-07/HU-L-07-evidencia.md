# HU-L-07 — Evidencia del cambio masivo de tarifas

## Resultado

HU-L-07 está implementada y verificada localmente en `feature/hu-restantes`: los nueve criterios del Excel (filas 90 a 98) cumplen con las pruebas de las secciones siguientes. Fuentes: Excel oficial, spec L §2.9 y sus notas de sincronización, PR-0 y DESIGN. No hay diferidos propios de producto. Quedan pendientes ⏳ el recorrido de navegador del modal M-41 sobre el árbol final y el CI sobre el SHA del PR. SHA del PR: ⏳ se completa al abrirlo.

## Matriz de criterios

| CA | Cumple | Evidencia |
|---|---|---|
| 1 | Sí (la interfaz, ⏳ en navegador) | `cambiar-tarifas-dialog.test.tsx` (23): casillas con nombre, código y tarifa; «Seleccionar todas (N)» sobre las visibles; contador; búsqueda por nombre y por código desde dos caracteres, sin mayúsculas ni acentos (10 casos); la selección sobrevive al cambiar la búsqueda. Postman: GET solo con activas, DTO `id, nombre, codigo, tarifa_hora`, sin repetidos, `codigo` y `tarifa_hora` nullables |
| 2 | Sí | Schema estricto (`materia.tarifas-masivo.test.ts`, 23, y `tarifas/route.test.ts`, 14): entero positivo hasta $1.000.000, 1 a 200 materias, sin repetidos, campos ajenos y JSON inválido. Componente: error junto al campo, «Continuar» deshabilitado sin selección o con importe inválido, aviso y bloqueo con más de 200 seleccionadas. Postman: 400 por lista vacía, cero, negativo, decimal, mayor al tope, campo ajeno, id no CUID, ids repetidos, más de 200 y cuerpo que no es JSON |
| 3 | Sí (⏳ en navegador) | Componente: previa con todas las seleccionadas, tarifa actual y nueva, «Sin cambio» para las iguales. Unitarias del servicio: clasificación de actualizadas y sin cambio, con tarifa `null` |
| 4 | Sí (⏳ en navegador) | Componente: confirmación de C-25 «¿Estás seguro de que querés cambiar la tarifa de N materias a $ 8.000 por hora?» con N = las que cambian, detalle y singular; ninguna escritura antes de confirmar |
| 5 | Sí | PG: una transacción, el fallo después del primer historial revierte ambas tarifas e historiales; los rechazos faltante, inactiva y conflicto no escriben nada; materias con y sin tarifa en el mismo pedido. Postman: 200 con cambios (`actualizadas` y `sin_cambio` exactos y tarifas nuevas verificadas por GET) y 200 con `actualizadas: 0` cuando todas ya tenían la tarifa. Componente: sin POST ni confirmación cuando ninguna cambia y doble envío con dos clics en su propio `act` |
| 6 | Sí | Postman: la inactiva no se lista, enviarla da 422 `MATERIA_INACTIVA` sin escribir nada y el GET posterior confirma que ninguna tarifa cambió. PG: la inactiva conserva su tarifa. SQL (A7): la inactiva conserva su tarifa y no tiene historial masivo |
| 7 | Sí (A8 sin inscripciones previas en la base de Postman) | PG: la fila de una inscripción anterior queda idéntica después del cambio masivo, el cobro conserva el precio y las nuevas reservas de alumno y de centro y la nueva inscripción por cobro usan la tarifa nueva (con los servicios reales de C e I). SQL (A8): verifica las inscripciones previas que existan; en la base del recorrido había 0, por lo que esa aserción no aporta evidencia propia |
| 8 | Sí | PG: una fila de `HistorialTarifa` por actualizada con actor, anterior (`null` incluida), nueva, fecha común y `masivo = true`; «Sin cambio» no deja fila y conserva su metadata. SQL (A1 a A6): historial masivo presente, una sola fecha, usuario y tarifa nueva por cambio, una fila por materia, cadena continua y tarifa vigente igual a la del último historial |
| 9 | Sí | PG: matriz real de `RolPermiso` con `materias:cambiar_tarifa` solo para Gerente. Postman: 401 sin sesión y 403 de Mesa de Entrada, Profesor y Alumno en GET y POST con sesiones reales; Gerente opera. SQL (A9): el permiso pertenece solo a GERENTE. La visibilidad del botón por permiso: ⏳ en navegador |

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
| 7b | `npm run test:pg -- src/server/materias/materia.tarifas-masivo.pg.test.ts` | 0 | 13 aprobadas |
| 8 | `npm run build` | 0 | Compilación de producción correcta |
| 9 | Postman: `HU-L-07.postman_collection.json` con un ejecutor mínimo de Node (no hay `newman`), contra `next dev -p 3100` sobre una base descartable con migraciones y seed completo, sesiones obtenidas por el login real de los cuatro roles | 0 | 26 solicitudes, 115 aserciones, 0 fallidas (estado, envelope y `code` en cada una) |
| 10 | SQL: `HU-L-07.sql` con `psql -v ON_ERROR_STOP=1` (`docker exec`) después del recorrido de Postman | 0 | A1 a A9 correctas (A8: 0 inscripciones previas verificadas). Con la tarifa de la inactiva alterada falla A7; con una tarifa vigente distinta de su último historial falla A6 |
| 11 | Barrido de palabras de proceso sobre estos archivos | — | Sin coincidencias |

Detalle de las pruebas de L-07 (aprobadas en las corridas 3 y 7): `materia.tarifas-masivo.test` 23, `api/materias/tarifas/route.test` 14, `cambiar-tarifas-dialog.test` 23 y `materia.tarifas-masivo.pg.test` 13. Regresión de L-06: `materia.tarifa.test` 17, `api/materias/[id]/tarifa/route.test` 11, `cambiar-tarifa-dialog.test` 5 y `materia.tarifa.pg.test` 5 (seed completo en base propia).

## Pruebas nuevas y sensibilidad verificada

| Regla | Prueba | Mutación probada | Resultado |
|---|---|---|---|
| Guarda de la tarifa mostrada con `null` | PG, «materias sin tarifa (null) frente a la guarda» (4 casos) | Tratar `null` como comodín en la guarda | Falla 1 de las 13 |
| Búsqueda por código | `cambiar-tarifas-dialog.test.tsx` | Quitar el código del filtro | Fallan 3 |
| Umbral de dos caracteres | `cambiar-tarifas-dialog.test.tsx` | Bajar el umbral de 2 a 1 | Fallan 2 |
| Aserciones SQL | `HU-L-07.sql` | Alterar la tarifa de la inactiva / alterar la tarifa vigente de una materia con historial | Falla A7 / falla A6 |

Casos agregados a PG: materia sin tarifa con `tarifa_actual: null` (la define y deja historial con `tarifaAnterior = null`), con `tarifa_actual` distinto de `null` (409), materia con tarifa mostrada como `null` (409) y mezcla de materias con y sin tarifa en un mismo pedido (una guarda desactualizada anula el pedido completo). El caso de lotes con los mismos ids en orden cruzado prueba la serialización de dos cambios masivos (gana el que retiene los bloqueos y el otro recibe `CONFLICTO_EDICION_CONCURRENTE`); no reproduce un ciclo de interbloqueo, que el servicio evita tomando todos los bloqueos en una sola llamada ordenada por id.

## Límites

- El precio de las inscripciones se comprobó con los servicios reales `crearInscripcion` y `registrarOperacion`, con caja y forma de pago de prueba; no equivale a un recorrido completo de reserva y cobro desde las pantallas de C e I.
- Los datos de Postman y SQL (materias con tarifa igual a la nueva, sin tarifa y distinta) se prepararon directamente en la base descartable.
- El timeout de bloqueos y el rollback inyectado se verifican en PG; Postman no los provoca.
- El seed completo termina con el reloj fijado en el 11/10/2026 (`SEED_FECHA_HOY=2026-10-11`). Con el reloj real del 12/10/2026 el fixture de HU-E-02 del seed falla con «Fixture E02 sin inscripción inicial», después de crear los datos base; es ajeno a esta HU.
- Una comprobación pendiente no se considera aprobada.

## Pendientes y diferidos

- ⏳ Recorrido de navegador en PC del modal M-41 (búsqueda, previa, confirmación, conflicto con recarga, éxito y no-op) sobre el árbol final: a cargo de Tomás.
- ⏳ CI sobre el SHA del PR.
- L-07 no tiene diferidos propios de producto. La verificación diferida de L-06 (criterios 4 y 6) quedó cubierta con los servicios reales de C e I y el detalle de L.
