# HU-L-07 — Evidencia del cambio masivo de tarifas

Implementada y verificada localmente; pendiente commit manual, revisión e integración. Fuentes: Excel oficial filas 90–98 y Cierre de pendientes, spec L §2.9 y sincronización L-06, PR-0 y DESIGN. No hay diferidos propios de producto.

## Matriz de aceptación

| CA | Implementado | Verificación ejecutada y resultado |
|---|---|---|
| 1 | Sí: activas, casilla/nombre/código/tarifa, umbral dos, normalización, todas visibles, contador y selección persistente | ✅ Componentes y navegador real: Física buscada como FISICA, MAT por código, seleccionadas ocultas conservadas. GET real excluye inactiva y conserva null. Código nullable probado |
| 2 | Sí: entero positivo/tope, error de campo, continuar por selección e importe | ✅ Schema límites 1/200, duplicados/campos ajenos/importes inválidos; UI cero/decimal/negativo/tope/vacío y 201 seleccionadas; navegador cero impide continuar |
| 3 | Sí: previa de todas, anterior/nueva y Sin cambio | ✅ Componentes y navegador muestran mezcla $12.000/$15.000/null y todas las seleccionadas |
| 4 | Sí: C-25, N de las que cambian, detalle y singular | ✅ Componentes sin POST previo; navegador confirma dos cambios con tres seleccionadas, luego tres tras recarga |
| 5 | Sí: una transacción, conteo servidor y no-op | ✅ PG rollback tras primer historial y segunda tarifa; lotes cruzados en ambos órdenes, un ganador y un conflicto, sin deadlock. No-op conserva filas completas. UI no confirma cero; POST real no-op retorna ceros |
| 6 | Sí: exclusión y rechazo servidor | ✅ PG y HTTP 422 para envío manual; lote sin escrituras, tarifa inactiva $8.000 conservada. Recarga obligatoria ante inactiva/faltante además del conflicto |
| 7 | Sí: sin acceso a inscripciones desde L | ✅ PG: fila de inscripción anterior idéntica tras masivo; cobro conserva $12.000; nuevas reservas ALUMNO/CENTRO y nueva inscripción por cobro real usan $15.000 |
| 8 | Sí: historial atómico por actualizada, marca y fecha común | ✅ PG actor/anterior/null/nueva/fecha/marca; sin cambio conserva metadata. Navegador ve Cambio masivo en ficha. SQL del recorrido deja cuatro historiales esperados |
| 9 | Sí: mismo permiso granular en GET/POST y botón | ✅ Guard simulado en unitarios, matriz RolPermiso real solo GERENTE, login y GET/POST reales: 401 sin sesión; 403 Mesa/Profesor/Alumno; Gerente opera. Mesa/Profesor sin botón |

## Comandos y resultados

Todos se ejecutaron sobre el árbol de esta entrega, sin suites globales ni build global. Los ejecutables ya estaban instalados.

| Comando | Exit code | Resultado |
|---|---:|---|
| `npx vitest run src/server/materias/materia.tarifas-masivo.test.ts src/app/api/materias/tarifas/route.test.ts src/server/materias/materia.tarifa.test.ts 'src/app/api/materias/[id]/tarifa/route.test.ts'` | 0 | 4 archivos, 65 casos |
| `node node_modules/vitest/vitest.mjs run 'src/app/(dashboard)/materias/cambiar-tarifas-dialog.test.tsx' 'src/app/(dashboard)/materias/[id]/cambiar-tarifa-dialog.test.tsx'` | 0 | 2 archivos, 19 casos |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 0 | Sin errores |
| `npx eslint src/server/materias/materia.schema.ts src/server/materias/materia.service.ts src/types/materia.types.ts src/app/api/materias/tarifas/route.ts src/app/api/materias/tarifas/route.test.ts src/server/materias/materia.tarifas-masivo.test.ts src/server/materias/materia.tarifas-masivo.pg.test.ts` | 0 | Backend y pruebas sin hallazgos |
| `node node_modules/eslint/bin/eslint.js 'src/app/(dashboard)/materias/page.tsx' 'src/app/(dashboard)/materias/cambiar-tarifas-dialog.tsx' 'src/app/(dashboard)/materias/cambiar-tarifas-dialog.test.tsx' src/lib/textos.ts` | 0 | UI/textos sin hallazgos |
| `node scripts/verificar-claves-textos.ts` | 0 | Claves de textos verificadas; aviso de tipo de módulo de Node, sin cambio de configuración |
| `npm run test:pg -- src/server/materias/materia.tarifas-masivo.pg.test.ts` | 0 | Versión final, 9 casos; bases `noctium_pruebas_1e43ebc9` y, después del ajuste de imports a aliases, `noctium_pruebas_d3afc6f3` |
| `npm run test:pg -- src/server/materias/materia.tarifas-masivo.pg.test.ts src/server/materias/materia.tarifa.pg.test.ts` | 1 | L-07 9/9, L-06 4/5; fallo de inicio del subproceso seed |
| `npm run test:pg -- src/server/materias/materia.tarifa.pg.test.ts` | 1 | Repetición focal: L-06 4/5; mismo error de entorno |
| `node "$env:TEMP\noctium-l07-ui-verificacion.mjs"` | 0 | Preparación descartable, 25 controles HTTP/UI y comprobación de BD; servidor detenido y base eliminada |

Después de completar los imports de las pruebas con los aliases del proyecto se repitieron los 65 casos backend, los nueve PG, TypeScript y lint de todos los once archivos TypeScript de la entrega: exit 0. El JSON de la colección y la sintaxis de sus scripts también se comprobaron; son 23 requests. Esta comprobación no equivale a ejecutar las solicitudes desde Postman.

✅ SQL auxiliar ejecutado mediante el cliente PostgreSQL contra la base nueva `noctium_pruebas_56c6ee3c`, con migraciones existentes: guarda de nombre y seis SELECT válidos, exit 0; base eliminada al finalizar. Esa comprobación verifica sintaxis y tablas; la evidencia de datos modificados corresponde a las pruebas PG y al recorrido HTTP descritos abajo. El script de conflicto de Postman elige una tarifa anterior válida diferente, incluso cuando la actual está en el tope; su comportamiento se comprobó con null, uno y un millón.

El caso del seed repetido L-06 termina en `uv_os_get_passwd ENOMEM` desde `tsx/temporary-directory` antes de ejecutar el seed. No se altera la prueba ni la configuración para ocultarlo. Las cuatro pruebas PG de tarifa individual pasan; su helper y servicio no se modificaron.

Primer intento del test de doble click: ❌ una aserción buscaba el botón por su texto anterior después de cambiar a «Procesando…». Se conservó la referencia del botón y se repitieron los dos actos separados manteniendo el POST pendiente: ✅ un único envío, sin toast/refresh previo a la respuesta. No se cambió la guarda del producto por ese fallo de prueba.

## HTTP y recorrido de UI en PC

✅ Chromium con Playwright instalado, Next dev puerto 3100, viewport 1366×900. Base nueva `noctium_pruebas_9a664fb1`, migraciones existentes aplicadas; cuentas y cuatro materias de prueba únicamente allí. Sesiones obtenidas desde el formulario de login real. No se fabricaron tokens ni se sustituyó el guard. El servidor se detuvo y la base se eliminó automáticamente al finalizar.

25 comprobaciones aprobadas: GET/POST sin sesión 401; los tres roles ajenos 403; Mesa/Profesor sin botón; GET Gerente; validación lista vacía/decimal/tope/repetidos; inexistente/inactiva/conflicto; selección/filtro/persistencia/validación/previa; cambio HTTP mientras estaba abierta la confirmación; error dentro del diálogo, reintento bloqueado, recarga y nueva confirmación; éxito/toast; recarga de página; no-op en UI y HTTP; historial masivo en ficha.

La primera preparación del recorrido pasó 18 controles HTTP, pero la UI no encontró Física al buscar FISICA: el transporte del script por stdin había convertido caracteres acentuados de los fixtures en signos de interrogación. Se corrigió la codificación del archivo temporal de verificación, sin cambiar el producto, y el recorrido completo posterior aprobó los 25 controles. Las dos bases se eliminaron.

Reportes y tres capturas (previa, conflicto e historial) permanecen fuera del repositorio, en el directorio temporal del entorno. Se inspeccionaron visualmente previa y conflicto: tabla legible, tokens vigentes, datos concretos y rechazo dentro de la confirmación. No se afirma ejecución desde la aplicación Postman.

Comprobación de BD del recorrido: tres activas a $15.000, inactiva a $8.000, cuatro historiales con `masivo=true`: uno del cambio concurrente y tres del cambio confirmado después de recargar. El no-op no agregó historial.

## Seguridad de las bases y límites

Se leyó `scripts/test-pg.mjs`: para estos archivos crea bases `noctium_pruebas_<8 hex>`, aplica migraciones existentes y elimina al finalizar. No se usaron los caminos especiales para nombres fijos, no se hizo migrate reset, no se editó `.env` ni se mutó la base habitual. La configuración local se consumió sin exponer sus valores.

El precio se comprobó con los servicios reales `crearInscripcion` y `registrarOperacion`, con caja y forma de pago de prueba; no equivale a un recorrido completo de reserva/cobro desde pantallas C/I. El recorrido de navegador sí comprueba el cambio masivo de L y su historial.

## Pendientes y diferidos

- ⏳ Seed repetido de L-06, bloqueado por inicio de subproceso descrito arriba; responsable de verificación: quien prepare revisión/CI.
- ⏳ Ejecutar la colección entregada desde Postman; los HTTP equivalentes ya fueron ejercitados en navegador para los casos indicados.
- ⏳ Controles globales de CI, commit manual, revisión e integración.
- ✅ L-06 CA4 y CA6: verificación diferida de cambio masivo cerrada con flujo real de C/I y detalle de L.
- L-07 no tiene diferidos propios de producto. C-14/B-07 permanecen para entregas posteriores.

La task distingue lista para commit de Terminada; el cierre definitivo exige integración y controles pendientes. El diff se mantiene acotado a los archivos del relevamiento confirmado.

## Controles de cierre

✅ `git diff --check`: exit 0. Seis archivos existentes modificados y diez nuevos, todos incluidos en el relevamiento confirmado. Los cambios funcionales se limitan a L; las fachadas C/I solo se consumen desde las pruebas. Ningún cambio en tests anteriores, migraciones, lockfile, CI ni configuración personal. Las comprobaciones focales finales de TypeScript, lint, backend, PG y auxiliares se describen arriba.
