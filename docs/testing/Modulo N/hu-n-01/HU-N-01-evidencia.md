# HU-N-01 — Evidencia de implementación y pruebas

**Fecha:** 14/10/2026. **Rama:** `feature/HU-N-01`, worktree aislado sobre `origin/develop` `e3ea18d`. Sin commit, push, merge ni rebase.

## Alcance implementado

- Catálogo de tres parámetros enteros (1–72 h, 1–72 h, 1–100 %), DTOs, schema Zod estricto y lectura sin fallback para la pantalla.
- Escritura por `updateMany` condicional en una transacción, solo de campos cambiados; historial por campo en cola posterior al commit, id estable y hasta tres reintentos.
- `GET/PUT /api/configuracion`, `GET /api/configuracion/historial`, action de guardado, fachada de actividad, permisos de Gerente y `/configuracion` con confirmación, banner e historial.
- No se modificaron `schema.prisma`, migraciones, seed ni consumidores C/H. Se añadió `src/proxy.ts` al alcance por la divergencia confirmada en Fase 1.

## Ejecuciones reales

| Verificación | Resultado |
|---|---|
| `git diff --check` y `git diff --cached --check` | Exit 0, sin errores con todos los archivos de HU-N-01 preparados en el worktree. |
| Parseo de `HU-N-01.postman_collection.json` con Node | Válido, exit 0. |
| `vitest run` focal final de schema, servicio, action y dos routes | 5 archivos, 26/26 pruebas, exit 0. |
| `vitest run src/app/(dashboard)/configuracion/configuracion-form.test.tsx --no-file-parallelism` | 5/5 pruebas, exit 0: vacío, confirmación, validación, conflicto y reintento de carga. |
| `npm run test:pg -- src/server/configuracion/configuracion.service.pg.test.ts` y repetición junto al seed | 7/7 y luego 8/8 pruebas, exit 0, en bases descartables `noctium_pruebas_629faebb` y `noctium_pruebas_a52196bd`. La segunda incluye SQL `READ ONLY`. |
| `npm run test:pg -- src/server/turnos/turno.reserva-alumno.pg.test.ts src/server/turnos/inscripcion.service.pg.test.ts` | Migraciones en base descartable `noctium_pruebas_8cbc046e`; 28/28 pruebas, exit 0. |
| `vitest run` focal C-14/C-20/H-07 y catálogo de N | 4 archivos, 54/54 pruebas, exit 0. |
| `tsc --noEmit` inicial | Exit 1 por `@playwright/test` ausente, `LayoutProps` sin generar y tipos Prisma previos (`descripcionPublica`). Después se regeneró Prisma; dos intentos posteriores de `tsc` se interrumpieron por la carga del equipo. |
| `next build --webpack` | Compilación exitosa; exit 1 en TypeScript por `@playwright/test` ausente en `playwright.historial.config.ts` y `scripts/testing/historial-po.e2e.ts`. No se informaron errores de N. |
| `npm run build` | Exit 1: Turbopack rechazó el junction de `node_modules` del worktree por apuntar fuera de su raíz. |
| `npm run lint` | Se interrumpió tras varios minutos por la carga del equipo. ESLint focal de todos los TS tocados: exit 0, cero errores; queda el aviso previo `CALENDARIO` sin usar en `Sidebar.tsx`. |
| `npm run test:pg -- src/server/configuracion/configuracion.seed.pg.test.ts` (primera pasada) | Exit 1: el seed llegó a la fixture HU-E-10 y el cliente Prisma instalado, anterior al schema, rechazó `descripcionPublica`. Base descartable eliminada. `prisma generate` terminó exit 0; se reejecuta la prueba en una base nueva. |
| `npm run test:pg -- src/server/configuracion/configuracion.seed.pg.test.ts src/server/configuracion/configuracion.service.pg.test.ts` (segunda pasada) | Servicio 8/8; seed completo en `noctium_pruebas_b9bf47a6` agotó 240 s. |
| `npm run test:pg -- src/server/configuracion/configuracion.seed.pg.test.ts` (tercera pasada) | Base descartable `noctium_pruebas_3510fdda`; el primer seed llegó a 24 usuarios, 31 parámetros y 140 turnos, pero agotó 600 s antes de terminar. Base eliminada. La repetición completa queda sin verificar; el test requiere `HU_N_SEED_COMPLETO=1` para ejecutarse por separado. |
| HTTP real en base descartable `noctium_pruebas_http_n_9e3eb29d` | 42 migraciones, cuenta y ficha de Gerente de prueba; `HU-N-01-http.mjs` pasó dos veces. Verificó 401, GET/PUT 200, 400 para decimal, fuera de rango, string, faltante, extra y query inválida; no-op; límites 1/72/100; 409 con rollback; historial 10/15 con usuario y fecha. |
| HTTP real con cuentas del seed local | Gerente: GET configuración e historial 200, PUT no-op 200, payload decimal y query ajena 400. Mesa, Profesor y Alumno: GET/PUT/historial 403. `/configuracion`: Gerente 200, Mesa 307 a `/sin-permiso`. |
| PostgreSQL descartable tras HTTP | SQL `READ ONLY`: valores 56/72/100 y 15 filas de historial con actor y fecha. Se repitió el `upsert({ update: {} })` usado por el seed para las tres claves; conservó 56/72/100. |
| `node_modules/.bin/tsx.cmd scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.», exit 0. |
| `vitest run src/server/shared/rutas-por-rol.test.ts src/server/shared/with-permission.test.ts` | 81/81 pruebas, exit 0. |
| `npm install --no-save --package-lock=false` en el worktree | No progresó tras varios minutos y se interrumpió. Se restableció el junction a las dependencias existentes. |

## Límites de verificación

- El seed **completo** dos veces no se pudo comprobar: la primera ejecución excedió incluso 600 s. Se comprobaron los defectos de migración en PostgreSQL y la preservación de cambios con la misma operación `upsert({ update: {} })` que usa el seed, pero esto no equivale a terminar el seed completo.
- La colección Postman está lista, sin cookies ni credenciales; el recorrido HTTP se ejecutó mediante `HU-N-01-http.mjs`, no dentro de Postman.
- No hubo revisión visual ni capturas en escritorio/móvil: `cua.getState()` devolvió `browsers: []`, y el navegador integrado no está disponible. La ruta real sí respondió 200 para Gerente y redirigió a Mesa.
- `npm run build` y `next build --webpack` no terminaron en verde por el junction de dependencias y la dependencia ajena `@playwright/test` ausente, respectivamente. La compilación de código webpack sí terminó; TypeScript no diagnosticó archivos de N.

## Referencias de contrato

- `HU-N-01.postman_collection.json`: requests sin cookies ni credenciales embebidas, incluidos bordes, 400, 401, 403, concurrencia 409 e historial.
- `HU-N-01-http.mjs`: recorrido HTTP contra base descartable migrada; requiere URL de esa base y credenciales de una cuenta de prueba.
- `HU-N-01.sql`: consultas de solo lectura para parámetros, historial y vencimientos de reservas.
- Regresiones C-14/C-20/H-07: 54/54; C-22/C-24 en PostgreSQL: 28/28. Incluyen reserva nueva y persistida, reprogramación, reapertura, cancelación y presentismo.
