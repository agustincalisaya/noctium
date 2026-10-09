# TASK: HU-E-11 — Corregir o anular registro de clase dictada

Sprint 3 · Iván · 2 SP · Issue #175 · Rama `feat/hu-e-11-corregir-clase`.
Estado: relevamiento preparado el 09/10/2026, aprobado explícitamente por el usuario (“apruebo, continua”). Implementación y validación local completadas; publicación y CI pendientes.

## 0. Relevamiento previo a implementación

Base comprobada: `origin/develop` en `593580522ebcb96490595033ba6ce61e404d030d`. PR #217 a #222 integrados. Issue abierto y asignado a Ivanchuelaa; sin PR abiertos. Checkout compartido preservado. Worktree propio: `/tmp/noctium-sprint3-actual/e11`.

### Archivos existentes a modificar

- `src/server/historial/clase-dictada.schema.ts`: schemas estrictos de corrección y anulación; motivo trim obligatorio, máximo 300.
- `src/server/historial/clase-dictada.service.ts`: corregir/anular bajo bloqueo; ampliar acciones del GET con permiso granular, propiedad y plazo.
- `src/server/historial/clase-dictada.schema.test.ts`: validación, límites, campos desconocidos.
- `src/server/historial/clase-dictada.service.test.ts`: snapshot, autorización, sin cambios, control inicial y errores.
- `src/server/historial/clase-dictada.service.pg.test.ts`: concurrencia, rollback, auditoría y re-registro.
- `src/server/historial/asistencia.pg.test.ts`: efectos reales sobre porcentajes y lecturas de H07.
- `src/types/historial.types.ts`: acciones de corrección/anulación/plazo en RegistroClaseDictada.
- `src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx`: corrección dentro de la misma lista, precarga desde snapshot y motivo debajo.
- `src/app/(dashboard)/turnos/[id]/turno-clase-card.tsx`: acción anular y aviso de plazo; conservar observaciones.
- `src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx`: interacción, precarga, errores y refresco.
- `src/lib/textos.ts`: `ui.historial.correccionClase.*`.
- `prisma/seed/fixtures/index.ts`: registrar fixture propio.
- `docs/specs/spec_modulo_E.md`: nota aditiva de sincronización y changelog, con diferencias visuales/contractuales.
- `docs/tasks/Sprint 3/HU-E-11.md`: estado, aprobación y checklist real.

### Archivos nuevos

- `src/server/historial/correccion-clase.service.test.ts` y `correccion-clase.pg.test.ts`: agrupan los casos nuevos E11 sin mezclar el inventario de casos E09; ajuste de organización dentro del alcance aprobado.

- `src/app/api/turnos/[id]/clase-dictada/correccion-asistencia/route.ts` y `route.test.ts`.
- `src/app/api/turnos/[id]/clase-dictada/anulacion/route.ts` y `route.test.ts`.
- `src/app/(dashboard)/turnos/[id]/anular-clase-dictada-dialog.tsx` y `anular-clase-dictada-dialog.test.tsx`.
- `prisma/seed/fixtures/hu-e-11.ts`.
- `docs/testing/HU-E-11.postman_collection.json`, `HU-E-11.sql`, `HU-E-11-evidencia.md`.
- `docs/testing/hu-e-11/correccion-desktop.png`, `correccion-mobile.png`, `anulacion-desktop.png`, `anulacion-mobile.png`, `resultados-http.json`, `resultado-sql.txt`.

### Contratos y brechas para aprobación

1. Backlog criterio 5 pide anulación como registro nuevo. Spec E §2.11 y PR0 §2.10 ya documentan T3: marca atómica de anulación en la propia fila para el índice parcial. Propuesta: aplicar esa excepción contractual vigente, conservando íntegramente el contenido, las correcciones, actor/fecha/motivo y el estado previo deducible. No crear tablas sin coordinación con el responsable PR0. Si se exige además un hecho de anulación append-only, hay que acordar su contrato y migración antes del código.
2. El plazo usa una fecha calendario `@db.Date`, a medianoche UTC. No pasarla directamente al helper de instantes que convierte a Buenos Aires: podría desplazar la base al día anterior. Normalizar la fecha de clase a su día local antes de usar el helper existente; probar día 7/día 8 y cambio de fecha UTC. Mantener inalterado el plazo de E10 basado en timestamp.
3. El prototipo usa verde sólido para Presente; los tokens actuales son fondos suaves. Propuesta: agregar, si resulta necesario, un token semántico de selección de asistencia en `src/app/globals.css` y documentarlo en `docs/DESIGN.md`, sin alterar tokens usados por el sidebar.

## 1. Nota de alcance

Contrato: spec E §2.6.3, §2.11, §3.6–3.12; backlog E11; PR0 §2.8, §2.10 y §2.16; RULES/DESIGN/SDD. Referencia visual inspeccionada: figuras 74–75, páginas físicas 67–68 del prototipo y las dos imágenes del usuario.

## 2. Historia

Como mesa de entrada o profesor sobre mis clases, necesito corregir asistencia o anular el registro para que historial e indicadores reflejen lo sucedido.

## 3. Alcance

Incluye primera carga de asistencia legacy, corrección vigente, anulación, permisos en servidor y comprobación de integraciones E04/E07/H07. Fuera de alcance: H03/H10, edición de inscripciones/pagos, cambios del sidebar, migraciones aplicadas y merges automáticos.

## 4. Backend

POST corrección: `clases:corregir`, 201 con id, clase, control, totales, motivo, actor/fecha. POST anulación: mismo permiso, 200 con clase/turno y motivo/actor/fecha. Sobre `{ data, error }`. Schemas antes del servicio; 400 validación/ASISTENCIA_INCOMPLETA; 403 SIN_PERMISO/PLAZO_CORRECCION_VENCIDO; 404 CLASE_NO_REGISTRADA; 409 ASISTENCIA_SIN_CAMBIOS/CLASE_DICTADA_YA_ANULADA/TRANSACCION_OCUPADA.

En `transaccion`, bloquear clase y leer registro no anulado. Mesa sin límite; profesor propietario, hasta siete días calendario inclusive. Validar conjunto exacto del snapshot, nunca inscripciones actuales. Leer estados con `valor-vigente.ts`. Corrección crea cabecera y todas sus filas anterior/nuevo; nunca modifica asistencia original. Anulación atómica según decisión 0.1. Excluir registro en lecturas; ocultar observaciones; conservar examen e indicación sin vínculo. Re-registro crea otro id. GET calcula acciones con permiso real; gerente sin escrituras.

## 5. Frontend

Figura 74: tarjetas y márgenes actuales; asistencia a la derecha de cada alumno del snapshot, valores guardados; sin control, todos Presente. Motivo y contador debajo de la lista; cancelar conserva lo persistido; guardar usa confirmación C25 y refresca servidor. Figura 75: modal compacto centrado, título con materia/fecha/hora, descripción de efectos, textarea obligatoria, contador 0/300, Volver y Anular registro rojo. Reusar primitivas Base UI y patrón compartido sin cambiar globalmente otros diálogos. Foco, teclado, bloqueo durante envío y errores inline; toast con textos literales de HU. Sidebar intocable.

## 6. Pruebas y datos

Unit/UI/API: conjunto exacto, ausencia de cambios, legacy, propiedad, todos los roles, motivo 0/300/301, siete días inclusivos, payload inválido, precarga/error/reintento. PostgreSQL descartable: transacciones y concurrencia, snapshot original intacto, nueva corrección anterior/vigente, anulación única, re-registro, pagos/inscripciones intactos, observación oculta, examen intacto, indicación conservada, porcentajes y H07 actualizados.

Fixture idempotente por claves estables, servicios de configuración/inscripción/registro y nuevos servicios de la HU. Escenarios reciente, fuera de plazo, sin control, corregida y anulada. Ninguna inserción directa para saltar reglas. SQL read-only de contraste y colección HTTP por contrato. Playwright real escritorio 1440×1000 y móvil 390×844, ambas acciones, roles, foco y consola; capturas inspeccionadas.

Checks previstos: npm test, npm run test:pg, npm run lint, comprobador de claves, next typegen + tsc y build, secuenciales para limitar memoria. Leer y usar runner PostgreSQL que crea su propia base; no resetear demo/personal. No afirmar ejecución antes de hacerla.

## 7. Definition of Done

- [x] Relevamiento y decisión T3 aprobados.
- [x] Código y pruebas de todos los criterios.
- [x] Fixtures idempotentes, SQL/API y revisión visual.
- [ ] Checks locales y remotos documentados honestamente.
- [ ] PR independiente a develop, Closes #175, sin merge automático.

E08 se inicia sobre E11 integrado en develop; requiere merge del usuario antes de publicar su PR independiente.

## 8. Ajustes del inventario durante la implementación

Los nuevos casos PostgreSQL se agruparon en `correccion-clase.pg.test.ts`, sin modificar las pruebas E09 existentes; se ejecutaron conjuntamente. El diálogo tiene sus pruebas UI propias y las pruebas existentes de turno se ejecutaron sin modificar. Se incorporaron el token semántico y su documentación aprobados en `globals.css` y DESIGN. Evidencia detallada: `docs/testing/HU-E-11-evidencia.md`.
