# Evidencia — HU-H-01 y HU-H-02 revisadas (Ingresos cobrados y Tasa de ocupación)

**Task:** `docs/adicionales/nuevosindicadores.md` · **Spec:** `docs/specs/spec_modulo_H.md` Revisión 2 (§2.2, §2.3, §3.6–3.8), más notas aditivas en `spec_modulo_C.md` §2.15, `spec_modulo_I.md` §2.3 y `spec_modulo_B.md` §2.8.
**Fecha:** 01/10/2026.

**Entorno:** base PostgreSQL **temporal** `noctium_tmp_hu_h_rev2`, creada en el contenedor `noctium_db`, con todas las migraciones, el seed y un fixture de contraste (`HU-H-01-H-02-revision.sql`). Se eliminó al terminar. La API se probó con `next build` + `next start -p 3100` contra esa base. La base habitual (`noctium_dev`) y el `next dev` del puerto 3000 no se tocaron.

## Nivel 1 — Unitarios y PostgreSQL

| Archivo | Qué cubre | Resultado |
|---|---|---|
| `src/server/indicadores/indicadores.service.test.ts` | Ingresos con pagos en todos los meses; mes sin pagos en $0 (no se omite); rango por defecto de 6 meses; `desde > hasta` → error de validación del schema. Ocupación: porcentaje con 1 decimal, 0% en meses sin turnos, tope "hoy en Buenos Aires" (no UTC), **regresión del redondeo** (0.38749999999999996 → 38.8) | ✅ |
| `src/server/indicadores/indicadores.schema.test.ts` | Rango, defaults, tope de 24 meses | ✅ |
| `src/app/api/indicadores/{ingresos,ocupacion}-por-mes/route.test.ts` | `withPermission("indicadores:leer")` presente (se verifica la consulta a `RolPermiso` con esa acción), 200, 400 `VALIDATION_ERROR`, 401, 403 | ✅ 7 + 7 |
| `src/server/turnos/turno.publico.test.ts` | SQL de `promediarOcupacionTurnosPorMes`: solo `DISPONIBLE`/`COMPLETO`, `cupo > 0`, `fecha ≤ fechaMaxima`, promedio en `numeric` | ✅ |
| `src/server/pagos/pago.publico.test.ts` | SQL de `sumarPagosPorMes`: suma sin filtrar forma de pago ni turno | ✅ |
| `src/app/(dashboard)/gerente/indicadores-client.test.tsx` | Rango compartido (un cambio pide los 2 endpoints), Skeleton dentro de cada Card, 2 Card en grilla 1/2 columnas, estado vacío, formato moneda y porcentaje, error con reintento | ✅ 9 |
| **PostgreSQL real** `turno.publico.pg.test.ts` | Fixture con DISPONIBLE (1/4), COMPLETO (1/1), **CANCELADO y PENDIENTE** que alterarían el promedio si contaran, y un turno posterior a la fecha máxima → diciembre 0.625, enero 0.5 | ✅ |
| **PostgreSQL real** `pago.publico.pg.test.ts` | Suma exacta (`0.10 + 0.20 = "0.30"`), pago de un turno **CANCELADO** incluido, cruce de año, mes sin pagos omitido | ✅ |

Salidas: `hu-h-01-h-02-revision/nivel1-unit.txt` (131 tests), `nivel1-postgres.txt` (15 tests), `suite-completa.txt` (**1620 passed, 82 skipped**: los `.pg` de otros módulos, que requieren la base aislada), `tsc.txt` (exit 0) y `lint.txt`. El único warning de lint es preexistente (`Sidebar.tsx`, `CALENDARIO` sin uso).

## Nivel 2 — API (casos de la colección Postman)

La colección es `HU-H-01-H-02-revision.postman_collection.json`. Se ejecutó con `curl` y sesiones reales de NextAuth (Gerente y Mesa de Entrada, usuarios del seed): **no se afirma ejecución dentro de la aplicación Postman**. La salida completa está en `hu-h-01-h-02-revision/nivel2-api.txt`.

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| 1 | Ingresos, rango con datos | `200`, un total por mes, meses sin pagos en $0 | `200`: `05: 10000 · 06: 0 · 07: 0.3 · 08: 15000.5 · 09: 0 · 10: 16800.5` |
| 2 | Ocupación, rango con datos | `200`, `ocupacion_promedio` por mes | `200`: `05: 0 · 06: 0 · 07: 41.7 · 08: 33.3 · 09: 38.8 · 10: 0` |
| 3 | `desde > hasta` (ambos endpoints) y rango > 24 meses | `400 VALIDATION_ERROR` | `400 VALIDATION_ERROR` con `fieldErrors` |
| 4 | Usuario sin rol Gerente (Mesa de Entrada) | `403` | `403 SIN_PERMISO` (ambos) |
| 5 | Sin sesión | `401` | `401 SESION_INVALIDA` (ambos) |

## Nivel 3 — BD (contraste SQL)

Las queries de la task se reescribieron con las columnas reales (`fechaPago`/`montoPago`, `fechaTurno`/`estadoTurno`/`cupoMaximoTurno`, inscriptos = `COUNT` de `turno_alumno`) y con el tope `fechaTurno ≤ hoy` que se decidió en el relevamiento. Archivo: `HU-H-01-H-02-revision.sql`. Salida: `hu-h-01-h-02-revision/nivel3-sql-primera-corrida.txt`.

| Mes | Ingresos SQL | Ingresos API | Ocupación SQL | Ocupación API |
|---|---|---|---|---|
| 2026-05 | 10000.00 | 10000 | — (sin turnos) | 0 |
| 2026-06 | — (sin pagos) | 0 | 0.0 (1 turno) | 0 |
| 2026-07 | 0.30 | 0.3 | 41.7 | 41.7 |
| 2026-08 | 15000.50 | 15000.5 | 33.3 | 33.3 |
| 2026-09 | — | 0 | 38.8 | 38.8 ✅ *(38.7 antes de la corrección, ver abajo)* |
| 2026-10 | 16800.50 | 16800.5 | — (turnos futuros excluidos) | 0 |

- **Exclusión de Cancelado y Pendiente:** en agosto, la consulta de control que los incluye da **55.6%**; la API y la consulta correcta dan **33.3%**. El turno `ctr-t4` (CANCELADO, 2/2 inscriptos) no altera el promedio.
- **Pago de un turno cancelado:** `ctr-p4` (15000.50, turno CANCELADO) cuenta en los ingresos de agosto. Es la propuesta por defecto de P1, pendiente de ratificación del PO.

### Defecto encontrado y corregido gracias a este nivel
En la primera corrida, septiembre daba **38.8%** en SQL y **38.7%** en la API, y la misma API devolvía 38.8 al consultar solo septiembre. La causa: `AVG` sobre `float8` depende del orden de suma que elige el plan de agregación, y en el borde .5 (38,75%) el valor llegaba como `0.38749999999999996`. La corrección tiene dos partes:
1. C promedia en `numeric`, que es determinístico.
2. H elimina el ruido binario (`toPrecision(12)`) antes de `Math.round`.

Después de la corrección, septiembre da 38.8 en los rangos 05–10, 08–09, 09–09 y en el default. Se agregó un test de regresión con el valor real y una nota de sincronización en la spec H §3.8.

## Verificación visual — **Bloqueado**

No se pudo abrir la pantalla en un navegador: la extensión Claude in Chrome no estaba conectada y Playwright no está instalado en el proyecto. La estructura (Card, grilla, Skeleton, estado vacío, tablas accesibles) se verificó con los tests de componente en jsdom, pero **el render real de los gráficos (Recharts) no se miró**. Pendiente: abrir `/gerente` como Gerente y revisar desktop, mobile, tooltip y línea de meta.
