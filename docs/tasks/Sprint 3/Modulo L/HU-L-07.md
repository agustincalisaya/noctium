# TASK: HU-L-07 — Cambiar la tarifa de varias materias a la vez

**Módulo:** L (Materias). **Sprint:** 3. **SP:** 2.
**Contrato de referencia:** `docs/specs/spec_modulo_L.md` §2.9, reglas §3.6–3.12 y nota de sincronización de L-06; PR-0 §2.4/2.10.
**RBAC:** `materias:cambiar_tarifa`, exclusivamente Gerente, ya migrado.
**Schema:** completo desde PR-0; sin migraciones ni cambios de seed.
**Estado:** implementada y verificada localmente; pendiente commit manual, revisión e integración. No se declara Terminada antes de cumplir la convención 9 del backlog.

## 0. Relevamiento previo a implementación

Fuentes contrastadas: Excel oficial `docs/Historias_de_Usuario_Sprint_3.xlsx`, filas 90–98, convenciones y hoja «Cierre de pendientes»; backlog Markdown; spec L; PR-0; RULES; DESIGN; metodología SDD; templates; Nota para Tomás y PDF de reparto/dependencias. El prototipo sitúa P-43/P-44 en figuras 26–28, páginas 25–27. El mapa del Sprint 3 sigue ausente, como ya documenta L-06; los contratos y el prototipo permiten ubicar el modal M-41 en el listado existente.

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

✅ Backend y regresión individual: 65 casos. ✅ Modal masivo y regresión modal individual: 19 casos. Se cubren schema, locks antes de leer, errores sin escritura, no-op, mezcla/null, fecha única, envelopes, filtros, selección oculta, validación, previa, confirmación, doble envío con promesa pendiente en dos actos separados, conflicto/recarga, red y singular.

### Nivel 2 — HTTP / Postman

✅ HTTP y UI reales con Chromium en PC 1366×900, Next dev puerto 3100 y base nueva descartable: 25 comprobaciones. Sesiones obtenidas por login real de los cuatro roles; GET/POST 401 sin sesión, 403 para Mesa/Profesor/Alumno, 200 Gerente, errores 400/404/409/422, conflicto con confirmación abierta, recarga, éxito, no-op y detalle con historial masivo.

⏳ Colección Postman entregada con assertions; no se ejecutó desde Postman. Los HTTP anteriores fueron ejecutados desde el navegador y su contexto autenticado.

### Nivel 3 — BD / PostgreSQL

✅ Nueve pruebas L-07 en bases nuevas `noctium_pruebas_<8 hex>`: metadata intacta, null, misma fecha, errores todo-o-nada, rollback tras escrituras reales, lotes cruzados coordinados en ambos órdenes sin deadlock, matriz real de permisos y precios mediante servicios C/I.

✅ Comprobación SQL después del recorrido HTTP: tres activas a $15.000, inactiva conserva $8.000, cuatro filas de historial masivo (una modificación concurrente y tres confirmadas desde UI). La base se eliminó y el servidor se detuvo.

❌ Regresión PG L-06: cuatro de cinco pasan; el seed repetido falla antes de ejecutar su lógica con `uv_os_get_passwd ENOMEM` desde `tsx/temporary-directory`, reproducido en dos corridas. No se modificó ni debilitó esa prueba. Pendiente repetirla en un entorno donde el subproceso pueda iniciar; responsable de la verificación: quien prepare la revisión/CI.

## 7. Checklist de Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] CA1–9 implementados y con evidencia focal, separando mocks/PG/HTTP/UI.
- [x] Contratos, validación, permisos, textos y confirmación C-25.
- [x] Sin DELETE físico, migraciones, dependencias ni cambios de configuración.
- [x] Historial de negocio atómico, fecha común y no-op sin escritura.
- [x] Diferidos de L-06 CA4/CA6 verificados desde el masivo con flujo real.
- [x] Evidencia, colección y SQL entregados.
- [ ] Seed repetido de L-06: bloqueo de entorno descrito arriba.
- [ ] Ejecución de la colección desde Postman.
- [ ] Commit manual, controles globales de CI, revisión e integración.

L-07 no tiene diferidos propios de producto. C-14 y B-07 no se implementan en esta entrega.
