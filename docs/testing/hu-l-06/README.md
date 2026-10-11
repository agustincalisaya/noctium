# HU-L-06 — Evidencia de tarifa individual

Fecha: 11/10/2026. Base: develop `7f0fa3a` (C-19 integrada). [Task](../../tasks/Sprint%203/Modulo%20L/HU-L-06.md) · [Issue #209](https://github.com/agustincalisaya/noctium/issues/209).

## Unit y contratos de capa delgada

Ejecución secuencial, prioridad 15, un worker:

```sh
nice -n 15 node_modules/.bin/vitest run src/server/materias/materia.tarifa.test.ts 'src/app/api/materias/[id]/tarifa/route.test.ts' src/app/api/materias/materias-tarifa-lectura.test.ts src/server/materias/materia.modificar.test.ts src/server/shared/precio-clase.test.ts --maxWorkers=1
nice -n 15 node_modules/.bin/vitest run 'src/app/(dashboard)/materias/[id]/cambiar-tarifa-dialog.test.tsx' --maxWorkers=1
```

Resultado: **59 + 5 = 64 casos aprobados**. Se cubren entero positivo/tope/campos ajenos/anterior obligatoria, actividad, igual, inexistencia, conflicto, primera definición, escritura sin tocar versión, selección y DTO sin precios para Profesor, permisos y status del PUT, límites del helper de precio y regresión de nombre/código. Modal: importe actual, errores inline, valores concretos, Volver conserva el importe, primera definición y conflicto que bloquea reintentar hasta recargar. Los tests de API de esta sección mockean guards/servicio; la autorización real se verificó separadamente debajo.

## PostgreSQL real y seed

```sh
nice -n 15 node scripts/test-pg.mjs src/server/materias/materia.tarifa.pg.test.ts
```

El runner creó una base `noctium_pruebas_<aleatorio>`, aplicó las migraciones y la descartó al terminar. En esa corrida aprobaron cuatro casos: primera definición e historial con actor/nombre; dos cambios simultáneos (uno exitoso y uno 409) y reintento sin duplicados; rollback real cuando se inyecta un fallo en la segunda escritura; y seed oficial completo **dos veces**, con cambio de tarifa entre ambas, que conserva tarifa modificada e historial exactamente.

El quinto caso se detuvo por la columna de normalización del dato de prueba. Se corrigió y se ajustó la precondición real de I-10: la inscripción al confirmar pago requiere reserva previa vencida/cancelada sin pago, no cualquier alumno nuevo. Se repitió únicamente ese caso con un worker, usando la base descartable D-08 de browser y claves únicas de fábricas (no la base habitual). **Aprobó**: reserva anterior a $12.000, cambio a $15.000, cobro de la reserva anterior conservando $12.000; reserva nueva del alumno y del centro a $15.000; nueva inscripción al confirmar pago de una reserva vencida con precio $15.000. El vencimiento se produjo con el reloj del dominio, sin falsear filas de inscripción. Los cinco casos quedaron comprobados entre la corrida inicial y esta repetición dirigida; no se repitió el seed pesado por un ajuste aislado del escenario de cobro.

La prueba de rollback mantiene PostgreSQL/transacción reales e inyecta exclusivamente un fallo de `HistorialTarifa.create`. El servicio no incrementa `version`, no toca nombre/código ni escribe inscripciones. Primera tarifa deja `tarifaAnterior = null`; cada cambio deja `masivo = false`. No se cambió schema, migraciones ni seed. La suite PG global no se ejecutó.

## HTTP y browser con cuentas oficiales

Chromium MCP, Next dev en puerto 3108 con la base descartable existente `noctium_pruebas_d08_browser_*`. Se usaron las cuentas oficiales de Gerente, Mesa, Profesor y Alumno; no se crearon usuarios alternativos. Al iniciar se eliminaron cookies antiguas que causaban JWT inválido y se inició sesión de nuevo. Los rechazos HTTP intencionales aparecen como 4xx en consola; tras autenticación fresca no hubo excepciones de la aplicación en los recorridos.

| Operación real | Resultado |
| --- | --- |
| GET listado/detalle Gerente | 200, tarifas/historial incluidos |
| GET listado/detalle Mesa | 200, tarifas/historial incluidos, sin botón de cambio |
| GET listado/detalle Profesor | 200, sin claves de tarifa/historial en DTO; todos los items del listado sin tarifa |
| GET listado/detalle Alumno | 403 SIN_PERMISO |
| PUT tarifa Mesa/Profesor/Alumno | 403 SIN_PERMISO |
| PUT Gerente importe igual | 422 TARIFA_SIN_CAMBIO |
| PUT Gerente cero/decimal/mayor al tope | 400 VALIDACION |
| PUT Gerente id inexistente | 404 MATERIA_NO_ENCONTRADA |
| PUT Gerente materia inactiva | 422 MATERIA_INACTIVA |
| PUT Gerente tarifa mostrada distinta | 409 CONFLICTO_EDICION_CONCURRENTE |
| PUT Gerente $15.000 → $16.000 | 200, envelope con tarifa anterior/nueva |
| Action desde modal $12.000 → $15.000 | éxito, toast, refresh, historial y ejemplo de 2h $30.000 |

Se mantuvo una confirmación abierta mientras otro PUT cambió la tarifa: la action rechazó la confirmación vieja, deshabilitó guardar, ofreció recargar y mostró $16.000 después de la recarga. El historial muestra los dos cambios exitosos en orden descendente, sin una fila por el rechazo.

También se creó **una materia de prueba únicamente en la base descartable**, mediante el alta existente: nace Sin tarifa, modal vacío y error junto al campo; definir $10.000 confirma sin inventar anterior $0 y registra Sin tarifa → $10.000 con usuario/fecha/Individual. Se verificaron foco inicial en el importe, Volver conservando el valor, Escape, escritorio 1366×900 y móvil 390×844 sin desbordamiento horizontal de documento. La base habitual no recibió seed ni mutaciones. El servidor dev se detuvo al finalizar.

La [colección Postman](HU-L-06.postman_collection.json) reproduce contratos; requiere sesión del rol y variables/id/importe actuales. No se afirma ejecución desde el programa Postman: los HTTP reales anteriores se ejecutaron con `fetch` autenticado en browser.

## Comparación visual

El prototipo ubica figuras 26–28 en páginas 25–27; coincide con las imágenes aportadas. Se revisaron imágenes renderizadas de ficha, modal y móvil. La captura inicial del historial precedía al refresh de Server Components y una del modal capturaba su transición; se reemplazaron esperando el dato actualizado y desactivando animaciones para la captura. No son fallos de la escritura ni se cambiaron animaciones del producto.

| Captura | Evidencia |
| --- | --- |
| [gerente-materias.png](gerente-materias.png) | figura 26: columna de tarifa y aviso |
| [gerente-cambiar-tarifa.png](gerente-cambiar-tarifa.png) | figura 27: modal, importe, actual y alcance futuro; estado posterior a prueba de concurrencia ($16.000) |
| [gerente-confirmacion-tarifa.png](gerente-confirmacion-tarifa.png) | confirmación C-25 ($16.000 → $18.000), cancelada en esta captura |
| [gerente-historial-tarifa.png](gerente-historial-tarifa.png) | figura 28: tarjeta tarifa, ejemplo, anterior/nueva/usuario/fecha/Individual, primer cambio a $15.000 |
| [mesa-tarifa-solo-lectura.png](mesa-tarifa-solo-lectura.png) | Mesa ve tarjeta e historial sin acción |
| [profesor-sin-tarifa.png](profesor-sin-tarifa.png) | Profesor conserva ficha sin precios |
| [gerente-tarifa-movil.png](gerente-tarifa-movil.png) | modal móvil, foco y lectura sin desbordamiento |

Se conserva la navegación real de Noctium y sus tokens/componentes. Datos/códigos/profesores del seed difieren de los ejemplos del prototipo; no se alteraron para imitarlo. El listado conserva su conteo de profesores, contrato existente aprobado en el relevamiento. L-07 aporta el botón masivo de figura 26, que no se presenta como funcional acá. El mapa de pantallas citado por la spec no está en el repositorio. No se verificó cambio masivo: queda diferido a L-07.

## Controles de cierre

TypeScript y lint dirigido aprobados. El checker C-23 inicialmente pidió claves explícitas para encabezados del historial; se reemplazó la interpolación de claves por referencias literales. Checker final aprobado. `git diff --check` limpio. No se lanzó build local pesada: lint global/build y CodeQL se verifican en el SHA publicado de la PR. Los resultados de CI se registran en la PR.
