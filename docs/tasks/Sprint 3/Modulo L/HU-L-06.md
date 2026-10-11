# HU-L-06 — Definir la tarifa por hora de cada materia

Estado: implementada y verificada localmente. Publicación y checks del SHA final: consultar la PR vinculada al issue #209.
Base: `develop` / `7f0fa3aaf58c86bac294408c735230817648d124` (PR #240 integrada).
Rama: `feat/hu-l-06-tarifa-materia`. Issue: https://github.com/agustincalisaya/noctium/issues/209. SP: 3.

## 0. Relevamiento previo

Se contrastaron el issue, el backlog de Sprint 3, `siguientepasos.md`, RULES, DESIGN, metodología SDD, spec L §§2.7–2.10 y reglas 3.6–3.12, PR-0 y código integrado de Materias, permisos, bloqueos, precios y personal. Referencias relacionadas: L-01/L-02/L-03, C-20/C-22/C-24/C-25 e I-10. Los PDF de reparto y dependencias mantienen L-06 antes de L-07; el prototipo sitúa las figuras 26–28 en páginas 25–27. No hay task L-06 ni L-07 preexistente, ni PR abierta, ni rama remota coincidente con L-06 en el relevamiento.

### Archivos existentes a modificar

- `src/server/materias/materia.schema.ts`: schemas estrictos de tarifa.
- `src/server/materias/materia.service.ts`: lectura condicionada de tarifa/historial, DTO y mutación compartida atómica.
- `src/server/materias/actions.ts`: action delgada equivalente al PUT, permisos y revalidación.
- `src/types/materia.types.ts`: tipos de lectura, historial y resultado del cambio.
- `src/app/api/materias/route.ts`: GET con visibilidad resuelta en servidor; conservar POST.
- `src/app/api/materias/[id]/route.ts`: GET con visibilidad resuelta en servidor; conservar PATCH.
- `src/app/(dashboard)/materias/page.tsx`: columna de tarifa y aviso para Gerente/Mesa.
- `src/app/(dashboard)/materias/[id]/page.tsx`: ficha según figura 28, sección de tarifa e historial, edición existente preservada.
- `src/lib/textos.ts`: textos, confirmaciones y errores nuevos centralizados.
- `src/server/shared/errores-dominio.ts`: códigos/status de tarifa.
- `docs/specs/spec_modulo_L.md`: nota aditiva de sincronización, sin renumerar.
- `docs/DESIGN.md`: registrar el flujo de tarifa en la tabla de feedback existente.
- `docs/tasks/Sprint 3/Modulo L/HU-L-06.md`: decisiones, resultados y cierre.

### Archivos a crear

- `src/app/api/materias/[id]/tarifa/route.ts`.
- `src/app/api/materias/[id]/tarifa/route.test.ts`.
- `src/app/api/materias/materias-tarifa-lectura.test.ts` (contratos GET de listado y detalle).
- `src/app/(dashboard)/materias/[id]/cambiar-tarifa-dialog.tsx`.
- `src/app/(dashboard)/materias/[id]/cambiar-tarifa-dialog.test.tsx`.
- `src/server/materias/materia.tarifa.test.ts`.
- `src/server/materias/materia.tarifa.pg.test.ts` (atomicidad, concurrencia, precio congelado y seed repetible).
- `docs/testing/hu-l-06/README.md`.
- `docs/testing/hu-l-06/HU-L-06.postman_collection.json`.
- Capturas en `docs/testing/hu-l-06/`: `gerente-materias.png`, `gerente-cambiar-tarifa.png`, `gerente-confirmacion-tarifa.png`, `gerente-historial-tarifa.png`, `mesa-tarifa-solo-lectura.png`, `profesor-sin-tarifa.png`, `gerente-tarifa-movil.png`.

Una ampliación necesaria de esta lista se reportará antes de implementarla.

### Diferencias resueltas por contratos integrados

1. PR-0 ya creó `Materia.tarifaHoraMateria Int?`, `HistorialTarifa` con anterior nullable, precio de inscripción y permisos. No se necesitan schema, migraciones, cambios de seed ni nuevos permisos.
2. `materias:ver_tarifa` es de Mesa; Gerente usa `materias:cambiar_tarifa` también para ver (PR-0, decisión 9). Visibilidad: cualquiera de ambos permisos, obtenida en servidor. Profesor recibe el DTO original, sin claves de tarifa ni historial; no se seleccionan esos campos al leer para él. Alumno no obtiene acceso nuevo a Materias.
3. Firma real: `bloquear(tx, { recursos: { materias: [id] } })`, dentro de `transaccion`. No copiar la firma ilustrativa de la spec.
4. `obtenerNombresGerentes` no existe en el código. Usar `obtenerNombresPersonal` desde `src/server/personal/personal.publico.ts`, una llamada con ids únicos; ausencia de ficha → nombre null y leyenda central. No consultar tablas de G desde L ni construir un módulo G nuevo.
5. Mantener `VALIDACION` como código de entrada inválida (400), consistente con los endpoints de Materias existentes; documentar diferencia con `VALIDATION_ERROR` de la spec. Los demás códigos nuevos y HTTP siguen §2.8.
6. Ejemplo de dos horas calculado por `precioClase` en servidor, evitando importar dependencias de servidor en el modal cliente. Sin tarifa no hay ejemplo.
7. La figura 26 tiene códigos con guion y botón masivo; son datos de ejemplo y alcance L-07. Conservar validación de códigos y no presentar un botón masivo funcional en L-06. Listado conserva el conteo de profesores y paginación existentes; la HU agrega tarifa, no un contrato nuevo de nombres de profesores en listado.
8. `mapa-pantallas-sprint-3.md` no está en el repositorio. P-43/P-44/M-42 se contrastan con la spec y figuras aportadas, sin inventar contenido del mapa.

### Decisiones confirmadas por el usuario (11/10/2026)

- P-L3: adoptar el tope técnico propuesto de **$1.000.000 por hora**; el issue solo pide entero positivo. No es una necesidad matemática para evitar overflow con ese importe exacto: es un límite adicional de producto propuesto por la spec.
- P-L4: materia inactiva conserva su tarifa y rechaza el cambio individual con **422 MATERIA_INACTIVA**.
- P-L7: exigir `tarifa_actual` nullable y compararla después de bloquear; si cambió → **409 CONFLICTO_EDICION_CONCURRENTE**, sin escritura ni historial duplicado. Esto protege la confirmación C-25.

## 1. Alcance

Como Gerente necesito definir/modificar la tarifa por hora, para que nuevas inscripciones calculen su precio y las existentes conserven el suyo. Incluye listado, ficha, modal, confirmación C-25, API/action, historial y verificaciones de integración de precio/seed. Reutilizar componentes, tokens y cuentas oficiales.

Fuera de alcance: flujo masivo L-07; cambios a alta/edición de nombre/código; recalcular inscripciones, reservas o pagos; implementar nuevas pantallas de pagos o asistencia; crear datos en la base habitual para evidencia. La función de escritura se prepara para L-07 sin agregar sus rutas/UI.

## 2. Contrato backend

`PUT /api/materias/[id]/tarifa`, permiso `materias:cambiar_tarifa`. Body estricto `{ tarifa_hora: entero positivo, tarifa_actual: entero positivo | null }`, ambos obligatorios, tope sujeto al acuerdo anterior. Action equivalente con el mismo permiso y schema. Respuesta estándar `{ data, error }`.

Servicio `cambiarTarifaMateria(id, input, actor)`: bloquear materia, leer fila bloqueada, verificar existencia (404), actividad (422), tarifa mostrada (409) y cambio real (422 TARIFA_SIN_CAMBIO). Delegar en `aplicarCambiosDeTarifa(tx, cambios, { masivo }, actor)`; una fecha de `ahora()` por operación. Actualizar tarifa y usuario modificador e insertar historial en la misma transacción. No incrementar `version` de nombre/código. No escribir inscripciones. Timeout de bloqueo se traduce por helper común a 409 TRANSACCION_OCUPADA.

Resultado: `{ id, tarifa_hora, tarifa_anterior }`. La primera definición lleva anterior null. Historial: fecha e id descendentes, anterior/nueva, usuario `{ id, nombre }`, masivo. No hay actualización/borrado de historial. Lecturas sin acceso a tarifa omiten esas claves y su selección en BD.

## 3. Frontend

Figuras 26–28: columna Tarifa por hora; ficha con datos, profesores y tarjeta de tarifa/historial; modal pequeño de importe, tarifa actual y aviso de nuevas inscripciones. Errores junto al campo y foco accesible. Confirmar con `ConfirmarAccionDialog`; formato monetario oficial. Para anterior null: confirmación de definir tarifa, nunca anterior $0. Volver conserva el importe; durante envío evitar doble ejecución/cierre. Éxito con toast centralizado y refresh del detalle/listado; conflicto permite recargar sin confirmar valores antiguos. Mesa solo lectura, Profesor sin precios. Adaptar tablas y modal a móvil sin desbordamiento de página.

## 4. Matriz de criterios y evidencia prevista

| Criterio | Implementación | Verificación |
| --- | --- | --- |
| 1: tarifa e importe válido | listado, modal, schema y servicio | unit, GET/PUT, browser; cero/negativo/decimal/tope/igual |
| 2: confirmación/éxito | C-25, textos y action | componente/browser; volver, doble envío, errores y foco |
| 3: cálculo | helper integrado `precioClase` | tests existentes y ejemplo de dos horas |
| 4–5: precio congelado y seed | servicios C/I existentes | PG: reservar a 12000, cambiar a 15000, cobrar anterior a 12000; nueva reserva/inscripción centro/pago directo a 15000; seed repetido conserva cambio |
| 6: historial | mutación y DTO de Materias | unit/API/PG: anterior null, actor/fecha/masivo false, rollback, reintento y concurrencia sin duplicados |
| 7: permisos | guards y lectura condicionada | API/GET por roles, UI con cuentas oficiales; Profesor sin claves/campos de precio |

Ejecución secuencial con baja prioridad y un worker: tests dirigidos, PG únicamente en base descartable, seed repetible solo en esa base. No suite PG global ni build local pesada; build/lint globales en CI. Browser Chromium MCP, escritorio y móvil, comparación con figuras. Registrar resultados reales de Unit, API/Postman y BD; no aprobar por mocks lo que exige evidencia real. Verificación masiva diferida a L-07.

## 5. Definition of Done

- [x] Relevamiento y decisiones pendientes confirmados.
- [x] Implementación dentro del alcance; contratos previos preservados.
- [x] Criterios 1–7 verificados y limitaciones documentadas.
- [x] Tarifas/historial atómicos; precio congelado y seed repetible comprobados en base descartable.
- [x] Browser por roles, móvil y figuras; capturas reales.
- [ ] Tipos, textos C-23, pruebas dirigidas y CI del SHA final aprobados.
- [x] Diff limpio de secretos, datos locales y artefactos temporales.
- [ ] PR exclusiva a develop con `Closes #209`; integración solo con autorización vigente y checks aprobados.


## 6. Resultado local

Ver [evidencia](../../../testing/hu-l-06/README.md): 64 casos unit/API mock/componente aprobados; cinco casos PG comprobados entre corrida inicial y repetición dirigida del escenario corregido; seed completo repetido conserva tarifa e historial; HTTP y browser reales con las cuatro cuentas oficiales. Tipos, lint dirigido y checker C-23 aprobados. La ruta/action protege permisos y compara tarifa mostrada; lectura de Profesor no selecciona/exhibe precios. La base habitual no recibió mutaciones, y el servidor dev se detuvo. No se ejecutaron build local ni PG global. Integración L-07 diferida según el issue.

DECISIÓN RESUELTA del escenario I-10: su servicio crea inscripción al confirmar pago solo si el alumno tiene reserva previa vencida/cancelada sin pago; la prueba usa reloj anterior para producir esa situación por servicios, conservando ese contrato sin modificarlo. Los ajustes de datos de prueba no cambian comportamiento del producto.
