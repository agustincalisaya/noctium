# Evidencia de HU-E-10 — corregir o anular resultado de examen

## Datos y alcance

La verificación persistente usa una base PostgreSQL local aislada (`noctium_e07_demo`), nunca una base compartida o productiva. La fixture agrega un resultado propio de Profesor y otro de Mesa para el mismo alumno y materia; repetir el seed conserva los registros y no genera correcciones ni anulaciones. `docs/testing/HU-E-10.sql` es de solo lectura.

`docs/testing/HU-E-10.postman_collection.json` documenta contratos HTTP para Mesa, Profesor y Gerencia. Postman no se ejecutó; las rutas se comprobaron con pruebas de handler, la suite PostgreSQL y solicitudes autenticadas desde Playwright.

## Verificación automatizada

- `npm test`: 149 archivos aprobados y 27 omitidos; 1.954 pruebas aprobadas y 181 omitidas.
- `npm run test:pg -- src/server/historial/resultado-examen.service.pg.test.ts`: 4 pruebas aprobadas en PostgreSQL real, incluidas cadena de correcciones, original intacto, día local 7 inclusivo, vencimiento, alcance/visibilidad por rol y anulaciones concurrentes.
- `npx tsc --noEmit`, `npx next typegen`, `tsx scripts/verificar-claves-textos.ts`, `npm run lint`, `git diff --check` y `npm run build -- --webpack`: aprobados. Lint conserva una advertencia preexistente en `Sidebar.tsx:46` (`CALENDARIO` sin uso), sin errores.
- La colección Postman valida sintaxis JSON; no se atribuye una ejecución de Postman.

## Playwright manual

En el resultado de Mesa, se corrigieron fecha y nota (`26/09/2026`, `7,5` → `27/09/2026`, `9,0`), se confirmó el resumen previo y luego se anuló con motivo. La Mesa vio la etiqueta, el motivo y la fecha/autor de anulación. La consulta SQL confirma que el original permanece en `26/09/2026`, `7,5`, con una corrección y una anulación.

Como Profesor, se corrigió el resultado propio de `8,0` a `8,5` y el endpoint devolvió `201`. El historial mostró ese valor con la etiqueta «Corregido» y excluyó el resultado anulado de Mesa. Un intento autenticado de corregir ese resultado ajeno devolvió `403 SIN_PERMISO`.

La vista móvil a 390 px no tiene desbordamiento horizontal (`documentWidth = bodyWidth = 390`). Una carga nueva del historial y las vistas móvil y desktop no generaron errores ni advertencias de consola. `consola-errores.txt` y `consola-advertencias.txt` registran cero mensajes.

| Escenario | Evidencia |
|---|---|
| Historial inicial de Mesa | [Captura](hu-e-10/mesa-inicial.png) |
| Confirmación de corrección con valores anterior/nuevo | [Captura](hu-e-10/mesa-confirmacion-correccion.png) |
| Resultado de Mesa corregido | [Captura](hu-e-10/mesa-corregido.png) |
| Confirmación irreversible de anulación | [Captura](hu-e-10/mesa-confirmacion-anulacion.png) |
| Resultado anulado con motivo visible a Mesa | [Captura](hu-e-10/mesa-anulado.png) |
| Profesor ve solo su resultado corregible | [Captura](hu-e-10/profesor-autor-y-visibilidad.png) |
| Confirmación de corrección propia del Profesor | [Captura](hu-e-10/profesor-confirmacion.png) |
| Resultado propio corregido (desktop) | [Captura](hu-e-10/profesor-corregido.png) · [respuesta HTTP 201](hu-e-10/profesor-correccion-201.json) |
| Historial responsive (390 px) | [Captura](hu-e-10/profesor-mobile.png) |
| Corrección propia 201 y resultado ajeno 403 | [Solicitudes HTTP](hu-e-10/red-acciones.txt) |
| Lectura HTTP 200 y consola limpia | [Red](hu-e-10/red-lectura-final.txt) · [errores](hu-e-10/consola-errores.txt) · [advertencias](hu-e-10/consola-advertencias.txt) |

## Auditoría SQL

`docs/testing/hu-e-10/resultado-sql.txt` conserva la salida de la consulta de solo lectura. Confirma dos originales; el de Profesor conserva fecha/nota original y tiene una corrección a `8,5`; el de Mesa conserva `26/09/2026` y `7,5`, con valor vigente `27/09/2026` y `9,0`, una corrección y una anulación. Las invariantes devuelven `correcciones_que_no_partieron_del_original = 0`, `originales_con_anulacion = 1` y `resultados_fixture = 2`.

## Verificaciones diferidas

- La representación de la anulación en «Mi historial» queda para HU-E-08, como indica el criterio 4.
- HU-E-11 no es necesaria para esta historia y no se simula aquí.

## Publicación

La implementación se publicará en un PR individual hacia `develop`, sin merge automático. Los checks y la mergeabilidad remotos se documentan tras su ejecución.
