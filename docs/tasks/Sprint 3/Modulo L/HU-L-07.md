# TASK: HU-L-07 — Cambiar la tarifa de varias materias a la vez

**Módulo:** L (Materias). **Sprint:** 3. **SP:** 2.
**Contrato de referencia:** `docs/specs/spec_modulo_L.md` §2.9, reglas §3.6–3.12 y nota de sincronización de L-06; PR-0 §2.4/2.10.
**RBAC:** `materias:cambiar_tarifa`, exclusivamente Gerente, ya migrado.
**Schema:** completo desde PR-0; sin migraciones ni cambios de seed.
**Estado:** implementada y verificada localmente en `feature/hu-restantes`; recorrido de navegador, CI sobre el SHA del PR e integración pendientes (ver evidencia). SHA del PR: ⏳ se completa al abrirlo. No se declara Terminada antes de cumplir la convención 9 del backlog.

## 0. Relevamiento previo a implementación

Fuentes contrastadas: Excel oficial del Sprint 3 (`docs/Historias_de_Usuario_Sprint_3.xlsx`, copia local no versionada), filas 90–98, convenciones y hoja «Cierre de pendientes»; backlog Markdown; spec L; PR-0; RULES; DESIGN; metodología SDD; templates; Nota para Tomás y PDF de reparto/dependencias. El prototipo sitúa P-43/P-44 en figuras 26–28, páginas 25–27. El mapa del Sprint 3 sigue ausente, como ya documenta L-06; los contratos y el prototipo permiten ubicar el modal M-41 en el listado existente.

El relevamiento fue confirmado antes de implementar. L-06 aporta `TarifaHoraSchema`, tope $1.000.000, helper masivo, historial, bloqueo, permiso y detalle P-44; C-25 aporta la confirmación común. No falta ningún prerrequisito estructural.

**Existentes modificados:**

- `src/server/materias/materia.schema.ts`: schema masivo estricto.
- `src/server/materias/materia.service.ts`: lectura de activas y servicio masivo.
- `src/types/materia.types.ts`: DTO de selección y resultado.
- `src/app/(dashboard)/materias/page.tsx`: acceso por permiso.
- `src/lib/textos.ts`: textos de Materias.
- `docs/DESIGN.md`: flujo puntual en §6.4.

**Nuevos:**

- `src/app/api/materias/tarifas/route.ts` y `route.test.ts`.
- `src/app/(dashboard)/materias/cambiar-tarifas-dialog.tsx` y `cambiar-tarifas-dialog.test.tsx`.
- `src/server/materias/materia.tarifas-masivo.test.ts` y `materia.tarifas-masivo.pg.test.ts`.
- Esta task.
- `docs/testing/Modulo L/hu-l-07/HU-L-07-evidencia.md`.
- `docs/testing/Modulo L/hu-l-07/HU-L-07.postman_collection.json`.
- `docs/testing/Modulo L/hu-l-07/HU-L-07.sql`.

## 1. Nota de alcance

Se reutiliza `aplicarCambiosDeTarifa` una única vez con la lista de modificaciones y `masivo: true`: ya toma el reloj una vez y ordena las escrituras por id. No se modifica el cambio individual, su firma ni sus pruebas.

Las firmas vigentes prevalecen sobre las ilustrativas: columna `tarifaHoraMateria`, bloqueo `{ recursos: { materias: ids } }`, código de validación `VALIDACION` y nombres del historial mediante la fachada integrada de personal. `codigo` admite null.

La interfaz usa GET/POST directamente; no se agrega una Server Action sin consumidor. Cuando todas están «Sin cambio», muestra el aviso en la previa y permite volver/cerrar, sin POST ni confirmación de cero materias. Singular/plural ajustado para una materia. La selección visible no se trunca: si supera 200, se muestra el límite y se deshabilita Continuar.

**Fuera de alcance:** C-14, B-07, nuevas migraciones/permisos/parámetros, inscripciones desde L, cambios al servicio individual, sistema de eventos, seed persistente y refactorizaciones ajenas.

## 2. Historia de Usuario

**Como** Gerente, **necesito** fijar la misma tarifa por hora para varias materias, eligiendo todas o algunas, **para** actualizar los precios sin cambiar materia por materia.

Criterios completos del Excel:

1. Desde el listado, «Cambiar tarifas de varias materias» muestra activas con casilla, nombre, código y tarifa actual; «Seleccionar todas (N)» marca las visibles con la búsqueda por nombre/código desde dos caracteres, sin distinguir mayúsculas ni acentos; informa cuántas hay seleccionadas.
2. Tarifa nueva entera en pesos, mayor que cero; error junto al campo. Continuar exige al menos una seleccionada y un importe válido. Se aplica además el tope confirmado P-L3 de $1.000.000.
3. Previa de cada seleccionada, tarifa actual y nueva; las iguales se marcan «Sin cambio» y no se modifican.
4. Confirmación C-25 «¿Estás seguro de que querés cambiar la tarifa de N materias a $ 8.000 por hora?», con detalle. N cuenta las que cambian, según DEC-42.
5. Una transacción: si una falla, ninguna cambia. Informa «Se actualizó la tarifa de N materias». Si todas ya tenían la tarifa, informa «Las materias seleccionadas ya tienen esa tarifa» y no registra nada.
6. Las inactivas no se listan y conservan su tarifa; también se rechaza enviarlas manualmente o si se inactivaron tras la lectura.
7. El cambio rige solo para inscripciones nuevas; las existentes conservan su precio, conforme a L-06 CA4.
8. Cada actualizada deja un registro de historial con marca masiva, conforme a L-06 CA6.
9. Solo Gerente; servidor 403 para otros roles.

## 3. Alcance de esta task

Schema, servicio, GET/POST, textos/tipos, modal M-41 de selección y previa, confirmación C-25, pruebas focales y documentación. Reutiliza componentes, tokens y núcleo transaccional existentes; ninguna dependencia nueva.

## 4. Contrato Backend

### 4.1. Schema Zod

`CambiarTarifasMasivoSchema`: objeto estricto `{ tarifa_hora, materias: [{ id, tarifa_actual }] }`; elementos también estrictos. Tarifa entera positiva hasta $1.000.000, anterior nullable, IDs CUID, 1–200 elementos y sin repetidos. JSON inválido/campos ajenos/entradas fuera de rango: 400 `VALIDACION`, con errores por campo.

### 4.2. Servicio

`listarMateriasConTarifa(db?)`: todas las activas, sin paginación; orden por nombre normalizado e id. `{ id, nombre, codigo: string | null, tarifa_hora: number | null }[]`.

`cambiarTarifasMasivo(input, actor, opciones?)`: una `transaccion`, ids ordenados y una llamada a `bloquear`; relee las filas bloqueadas y valida todo el lote antes de escribir. Faltante → 404 `MATERIA_NO_ENCONTRADA`; inactiva → 422 `MATERIA_INACTIVA`; anterior diferente, incluso en seleccionada «Sin cambio» → 409 `CONFLICTO_EDICION_CONCURRENTE`. El timeout conserva `TRANSACCION_OCUPADA` del núcleo.

Clasifica actualizadas y sin cambio; una llamada al helper con todas las modificaciones. Cero modificaciones no escribe ni toma el reloj. Las que cambian actualizan tarifa/actor e insertan historial con fecha compartida; las otras conservan toda su metadata. No incrementa `version`, protegida para nombre/código. No consulta ni escribe inscripciones.

### 4.3. Route Handler

`GET /api/materias/tarifas` → `{ data: { items }, error: null }`.
`POST /api/materias/tarifas` → `{ data: { tarifa_hora, actualizadas, sin_cambio }, error: null }`.

Ambos usan `withPermission("materias:cambiar_tarifa")`; POST valida antes del servicio y toma actor de sesión. Conserva 401/403, códigos del catálogo y respuesta `{ data, error }`. El segmento estático convive con `[id]`; ambas rutas se ejercitaron en HTTP real.

### 4.4. Server Action

No se agrega: el consumidor usa las rutas. La action de cambio individual permanece intacta.

### 4.5. Trazabilidad / Auditoría (Regla N.° 2)

Una fila `HistorialTarifa` por actualizada, anterior nullable, nueva, actor, fecha común y `masivo: true`, dentro de la transacción de negocio. Excepción aprobada P-L6, sin eventos nuevos ni escritura posterior al commit. El rollback incluye las tarifas y el historial; no-op no modifica metadata ni historial.

## 5. Frontend

P-43 muestra la acción según permiso. GET al abrir; búsqueda normalizada desde dos caracteres, selección persistente al filtrar y selección de todas las visibles. Carga/error/reintento y lista vacía tienen feedback. El límite de 200 no pagina ni recorta la lista.

Paso 2 muestra todas las seleccionadas, sus valores y «Sin cambio». C-25 confirma cantidad que cambia y detalle, sin escritura previa. Guarda efectiva con `useRef` además del botón deshabilitado. Rechazo dentro del diálogo, sin éxito ficticio. Conflicto/inactiva/faltante requieren recargar la lista y recorrer nuevamente la previa y confirmación; se conservan las seleccionadas que siguen disponibles. Éxito con toast del conteo servidor y `router.refresh()`.

## 6. Testing (tres niveles, según metodología del proyecto)

Detalle de comandos, bases, resultados y límites en [evidencia](../../../testing/Modulo%20L/hu-l-07/HU-L-07-evidencia.md).

### Nivel 1 — Unitarios y componentes

✅ Servicio, schema y ruta: `materia.tarifas-masivo.test` (23) y `tarifas/route.test` (14). ✅ Modal: `cambiar-tarifas-dialog.test` (23, con 10 casos de búsqueda por nombre y por código). Regresión de L-06: `materia.tarifa.test` (17), `[id]/tarifa/route.test` (11) y `cambiar-tarifa-dialog.test` (5). Se cubren schema, locks antes de leer, errores sin escritura, no-op, mezcla con `null`, fecha única, envelopes, filtros, selección oculta, validación, previa, confirmación, doble envío con promesa pendiente en dos actos separados, conflicto con recarga, red y singular.

### Nivel 2 — HTTP / Postman

✅ `HU-L-07.postman_collection.json`: 26 solicitudes y 115 aserciones ejecutadas contra la aplicación (`next dev`, puerto 3100) con una base descartable y sesiones reales de los cuatro roles: 401 sin sesión, 403 de Mesa de Entrada, Profesor y Alumno, 400 (lista vacía, cero, negativo, decimal, tope, campo ajeno, id no CUID, repetidos, más de 200, JSON inválido), 404, 422, 409, 200 con cambios y 200 sin cambios.

⏳ Recorrido de navegador del modal M-41 sobre el árbol final: a cargo de Tomás.

### Nivel 3 — BD / PostgreSQL

✅ `materia.tarifas-masivo.pg.test.ts` (13) en bases `noctium_pruebas_<8 hex>`: metadata intacta, `null` en la guarda (4 casos), misma fecha, errores todo-o-nada, rollback tras escrituras reales, serialización de dos cambios masivos con los mismos ids en orden cruzado, matriz real de permisos y precios mediante servicios C/I.

✅ `HU-L-07.sql` con aserciones A1 a A9 ejecutado después del recorrido de Postman: historial masivo con fecha, usuario y tarifa comunes, una fila por materia, «Sin cambio» sin fila, cadena de historial continua, tarifa vigente igual al último historial, inactiva intacta y permiso solo de Gerente (A8: 0 inscripciones previas en esa base).

✅ Regresión PG de L-06: `materia.tarifa.pg.test.ts` 5/5 con seed completo en base propia.

## 7. Checklist de Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] CA1–9 implementados y con evidencia focal, separando mocks/PG/HTTP/UI.
- [x] Contratos, validación, permisos, textos y confirmación C-25.
- [x] Sin DELETE físico, migraciones, dependencias ni cambios de configuración.
- [x] Historial de negocio atómico, fecha común y no-op sin escritura.
- [x] Diferidos de L-06 CA4/CA6 verificados desde el masivo con flujo real.
- [x] Evidencia, colección y SQL entregados.
- [x] Colección ejecutada (26 solicitudes, 115 aserciones) y SQL con aserciones ejecutado.
- [x] Regresión PG de L-06 aprobada.
- [ ] ⏳ Recorrido de navegador del modal M-41.
- [ ] ⏳ Controles globales de CI, revisión e integración.

L-07 no tiene diferidos propios de producto.
