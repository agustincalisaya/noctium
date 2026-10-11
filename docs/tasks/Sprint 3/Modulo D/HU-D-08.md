# TASK: HU-D-08 — Desactivar y reactivar profesor

**Estado:** implementada y validada localmente; revisión e integración mediante PR exclusiva. Relevamiento, rescate y selección por página confirmados explícitamente por el usuario.
**Issue:** https://github.com/agustincalisaya/noctium/issues/169 · 5 SP.
**Base comprobada:** `develop` / `origin/develop`, `10e3ffb101d63e5c4aee7d8cac1a9ead643b9de0`.
**Rama:** `feat/hu-d-08-baja-reactivacion-profesor`.
**Contratos:** spec D §§2.10–2.13; backlog Sprint 3; PR-0 §§2.9, 2.10, 2.13–2.16; RULES y DESIGN; tasks D-05/06/07, A-06 y C-25.

## 0. Relevamiento y decisiones resueltas

Se obtuvo el cuerpo completo actualizado del issue y se ejecutó `git fetch origin`. No se encontró PR abierta ni rama remota de esta HU. El issue tiene asignados Ivanchuelaa y xRamex; esa asignación no prueba por sí sola que exista implementación. El reparto permite rescatar D-08, pero prohíbe tomar historias ya empezadas: El usuario confirmó el rescate y autorizó continuar. No se contactará a terceros sin autorización.

Los PDF de reparto y dependencias ubican D-08 al final del carril de Tomás y como primera candidata a rescate. A-06 ya está integrada. Las figuras 58–64 se localizaron por su rótulo en el PDF del prototipo (páginas impresas 52–57); las imágenes adjuntas muestran estos mismos estados. La comparación renderizada y capturas están en `docs/testing/hu-d-08/README.md`.

No existe `docs/adicionales/mapa-pantallas-sprint-3.md` en este checkout. Se usarán los códigos P-41, M-40 y M-43 de la spec y las figuras del prototipo; no se inventará el documento.

**Diferencia resuelta por confirmación del usuario:** spec D §2.10.2.4 selecciona todas las clases del filtro, incluso fuera de la página, y expone `seleccion` hasta 500. `siguientepasos.md` limita «Seleccionar todas» al filtro y página visibles. Decisión: respetar el alcance explícito del traspaso (página visible, hasta 10), mantener el contrato aditivo de lectura de la spec y documentar la diferencia con una nota de sincronización. La etiqueta y cantidad de selección deben indicar el conjunto real; nunca anunciar 27 y operar sobre 10 silenciosamente.

**Datos y arquitectura comprobados:**
- `obtenerDetalleProfesor` ya expone estado y versión; `obtenerCuentaDeProfesor` y `CuentaAccesoCard` ya están integrados.
- La ficha exige `profesores:leer` y conserva `profesores:editar` para edición. `rutas-por-rol.ts` todavía limita el prefijo profesores a Mesa: agregar consulta del Gerente y proteger explícitamente rutas de alta/edición.
- Seed incluye `profesores:cambiar_estado`; se comprobará la matriz efectiva y el helper de alcance antes de modificarla.
- `bloquear(tx, { recursos: { profesores: [...] }, clases: [...] })` existe. Historial de estados admite PROFESOR y escribe después del commit con reintento/idempotencia.
- A publica desactivar/reactivar cuenta; la revocación por `sesionesValidasDesde` debe reutilizarse y probarse con `iat_sesion` conservado.
- C publica conteo/listado futuros por materia, pero faltan las funciones generales de D-08 y las mutaciones públicas de resolución. E e I no publican todavía `profesorTieneRegistros` / `turnosConPagosVigentes`.
- C-05 usa su propia transacción y bloqueo directo de clase: extraer núcleo reutilizable, sin llamar una transacción anidada ni ampliar `turnos:cancelar`.
- Creación/confirmación, generación y reprogramación requieren revisión de bloqueo del profesor; no basta la comprobación de actividad antes de la escritura.
- El trigger de reservas ya escucha `profesorId`: no se justifica recrearlo.

## 1. Alcance y exclusiones

Gerente consulta la ficha, obtiene impacto, resuelve clases futuras confirmadas y desactiva/reactiva la misma ficha y cuenta. Motivo de hasta 300 caracteres, obligatorio con clases pasadas o historia académica. Pendientes se informan y no bloquean. Se conservan identidad, unicidad, materias, horarios, hechos académicos, pagos e inscripciones. Reactivar requiere nuevo login y no restaura cancelaciones ni cambios de profesor.

No incluye C-19, L-06, I-06, cuentas alternativas, cuentas retroactivas, edición de Mesa por el Gerente, recreación de base, borrado físico ni carga masiva sobre datos reales. Fixtures y mutaciones de prueba solo en base descartable. Una PR exclusiva a develop con `Closes #169`; integración conforme a instrucción vigente y checks del SHA final.

## 2. Archivos previstos

### Crear

- `src/server/profesores/profesor.estado.service.ts`
- `src/server/profesores/profesor.estado.service.test.ts`
- `src/server/profesores/profesor.estado.pg.test.ts`
- `src/server/profesores/profesor.estado.routes.test.ts`
- `src/server/turnos/turno.baja-profesor.service.ts`
- `src/server/turnos/turno.baja-profesor.service.test.ts`
- `src/server/turnos/turno.baja-profesor.pg.test.ts`
- `src/app/(dashboard)/profesores/[id]/estado-profesor-dialog.tsx`
- `src/app/(dashboard)/profesores/[id]/resolver-clases-profesor-dialog.tsx`
- `src/app/(dashboard)/profesores/[id]/historial-estados-profesor.tsx`
- `src/app/(dashboard)/profesores/[id]/estado-profesor-dialog.test.tsx`
- `src/app/(dashboard)/profesores/[id]/resolver-clases-profesor-dialog.test.tsx`
- `src/app/api/profesores/[id]/impacto-baja/route.ts`
- `src/app/api/profesores/[id]/desactivar/route.ts`
- `src/app/api/profesores/[id]/reactivar/route.ts`
- `src/app/api/profesores/[id]/turnos-futuros/route.ts`
- `src/app/api/profesores/[id]/turnos-futuros/cancelacion/route.ts`
- `src/app/api/profesores/[id]/turnos-futuros/cambio-profesor/previsualizacion/route.ts`
- `src/app/api/profesores/[id]/turnos-futuros/cambio-profesor/route.ts`
- `prisma/seed/fixtures/hu-d-08.ts`
- `docs/testing/HU-D-08.postman_collection.json`
- `docs/testing/HU-D-08.sql`
- `docs/testing/HU-D-08-evidencia.md`
- Capturas y resultados reales dentro de `docs/testing/hu-d-08/` (nombres según el escenario).

### Modificar

Hallazgos aditivos comunicados durante implementación: `src/components/layout/Sidebar.tsx` (enlace de consulta del Gerente), `src/app/api/profesores/[id]/route.ts` (historial camelCase), `src/server/shared/errores-dominio.ts` (códigos nuevos con copy central).

- `src/server/profesores/profesor.schema.ts`, `src/types/profesor.types.ts`, `src/server/profesores/actions.ts`: schemas estrictos, DTO y adaptadores delgados.
- `src/server/turnos/turno.publico.ts`: publicar lecturas y operaciones de C; D no consulta tablas de C directamente.
- `src/server/turnos/turno.cancelacion.service.ts`: compartir núcleo C-05 manteniendo su contrato.
- `src/server/turnos/turno.service.ts`, `src/server/turnos/turno.reprogramacion.service.ts`, `src/server/turnos/turno.generacion.service.ts`: bloqueo canónico y actividad revalidada dentro de la transacción.
- `src/server/turnos/turno.publico.test.ts`, `src/server/turnos/turno.publico.pg.test.ts`, `src/server/turnos/turno.reprogramacion.test.ts`, `src/server/turnos/turno.reprogramacion.pg.test.ts`, `src/server/turnos/turno.generacion.service.test.ts`, `src/server/turnos/turno.generacion.pg.test.ts`: regresión de fachadas y carreras.
- `src/server/historial/historial.publico.ts`, `src/server/historial/historial.publico.test.ts`: existencia de historia del profesor.
- `src/server/pagos/pago.publico.ts`, `src/server/pagos/pago.publico.test.ts`: pagos vigentes por lote, sin modificar pagos.
- `src/app/(dashboard)/profesores/[id]/page.tsx`: consulta de Gerente, distribución según figura 58, acción de estado e historial; reutilizar componentes de datos y cuenta.
- `src/server/shared/rutas-por-rol.ts`, `src/server/shared/rutas-por-rol.test.ts`: consulta del Gerente con límites de edición preservados. `src/proxy.ts` ya incluye `/profesores/:path*`, no se prevé cambiar su matcher.
- `src/lib/textos.ts`: copy nuevo centralizado, incluyendo singular/plural, resultados y errores.
- `prisma/seed/fixtures/index.ts`: registrar fixture idempotente, sin cambiar seed.ts.
- `docs/specs/spec_modulo_D.md`, `docs/specs/spec_modulo_C.md`, `docs/RULES.md`: notas aditivas de sincronización y reglas implementadas.
- Esta task: actualizar decisiones, progreso y evidencia real.

No se prevé migración: revisar enum de eventos y permisos efectivos antes de confirmar esa conclusión. Si aparece un cambio necesario de schema o un archivo adicional, registrar el hallazgo antes de implementarlo.

## 3. API, permisos y errores

Todas las rutas nuevas requieren sesión y `profesores:cambiar_estado`; respuesta estándar `{ data, error }`. GET impacto y futuros; POST baja/reactivación/cancelación/previsualización/cambio. Payloads y campos snake_case según D §§2.10–2.11; versión obligatoria para estado, motivo normalizado y lote de 1–100 ids únicos no vacíos (incluye ids estables del seed). Cada lote valida alcance completo antes de mutar; ids ajenos → 403 sin procesar ninguno. Cambio exige una materia y destino distinto, activo y habilitado para ella.

Errores: 400 VALIDATION_ERROR/MATERIAS_DISTINTAS/PROFESOR_DESTINO_IGUAL_ORIGEN; 401 sesión; 403 SIN_PERMISO; 404 PROFESOR_NO_ENCONTRADO/MATERIA_NO_ENCONTRADA; 409 conflicto de versión, PROFESOR_INACTIVO, clases futuras o TRANSACCION_OCUPADA; códigos de C para fallos por fila según spec. No sustituir códigos existentes por mensajes genéricos. Textos traducidos desde C-23.

## 4. Concurrencia y trazabilidad

Baja: bloquear profesor, releer versión/estado, comprobar futuras bajo el bloqueo y actualizar ficha y cuenta en una transacción. Historial se encola para después del commit. Reactivación conserva la marca de contraseña y el umbral de sesiones revocadas. Creación, confirmación, generación, cambio de profesor y reprogramación toman el mismo recurso antes de clases/inscripciones. Releer actividad después de tomar el bloqueo; si cambia el profesor respecto de una lectura preliminar, abortar/reintentar sin bloquear recursos fuera de orden.

Cada clase del lote se procesa en una transacción independiente. Cambio bloquea origen y destino por orden canónico, además de clase; revalida estado, inicio futuro, asociación, atención y ocupación; actualiza con condición atómica. Cancelación comparte C-05, conserva pagos e inscripciones y libera reservas mediante trigger. Fallos no revierten éxitos anteriores; informe parcial y selección de fallidas en UI. No depender de la vista previa para aceptar la mutación.

## 5. Pantallas y matriz de evidencia

| Criterio | Implementación/vista | Prueba prevista |
|---|---|---|
| 1 | Impacto y confirmación M-43, figura 64 | Motivo obligatorio según historia, límite 300, opcional sin historia; errores dentro del modal; teclado/foco |
| 2 | M-40, figuras 59–63; servicios D/C | Conteos, 10 por página, filtro, selección acordada, pagos, preview, éxito parcial, alcance, carreras por fila |
| 3 | Ficha P-41 e historial, figura 58 | Baja lógica, actor/fecha/motivo, conflicto/doble envío, historial posterior al commit |
| 4 | Cuenta de A y guards | Misma transacción; sesión previa y token renovado rechazados, login inactivo; rollback |
| 5 | Selectores C-18/C-17/C-12/J-01 | Excluir inactivos; Pendiente requiere activo; nombres históricos, materias y horarios conservados |
| 6 | Alta existente de D | DNI de inactivo continúa único; no cambiar índices |
| 7 | Confirmación reactivación y ficha | Misma ficha/cuenta, historia acumulada, nuevo login, contraseña preservada, no restaurar clases |
| 8 | Rutas API y acceso de consulta | Gerente oficial; 403 Mesa/Profesor/Alumno; edición de Mesa continúa restringida |

Usar ConfirmarAccionDialog (C-25), CuentaAccesoCard, tabla/badges/paginación existentes y tokens DESIGN. En consulta del Gerente reproducir agrupación de datos, materias, cuenta e historial de figura 58, sin alterar el flujo de edición de Mesa. Modal con lista, vista previa y confirmación de cancelación; conservar fallidas seleccionadas y motivos. Baja/reactivación son reversibles; solo cancelación advierte irreversibilidad.

## 6. Validación y Definition of Done

- Unit: schemas, impacto, motivo, estado/versión, selección, resultados, permisos y fachadas.
- API/Postman: siete rutas, éxito, errores, casos límite, otros roles, alcance y respuesta parcial.
- PostgreSQL descartable: cuenta/ficha atómicas, rollback, historial, pagos/inscripciones conservados, trigger y conflictos; baja frente a creación/confirmación/reprogramación; sesiones antiguas tras baja y reactivación.
- UI Chromium: figuras 58–64 en escritorio y tamaño reducido, carga/error/vacío, foco y teclado, cuentas oficiales y selectores afectados. No certificar fidelidad sin capturas renderizadas.
- Checks secuenciales: lint, tsc, npm test, npm run test:pg y build según CI; no ejecutar suites pesadas simultáneamente.
- Revisión de diff sin secretos ni artefactos temporales; PR exclusiva, evidencia de los tres niveles y checks del SHA final. I-06 se informa como verificación diferida del reintegro si aún no está integrada.

**Resultado actual:** implementación autorizada por el usuario; selección limitada a la página visible y rescate confirmados. Verificación en curso; la evidencia final se incorporará al concluir.

### Hallazgos adicionales durante implementación

- El catálogo de errores compartido y el test de aislamiento de fachadas publican específicamente el nuevo servicio propio de C; se conservan las prohibiciones de importar servicios ajenos.
- Tests de configuración y reprogramación adaptan sus clientes simulados a los bloqueos nuevos; las carreras se comprueban aparte en PostgreSQL.
- A revocaba a precisión de segundos: una sesión iniciada antes de una baja dentro del mismo segundo podía sobrevivir a la reactivación. Corrección necesaria para criterio 4: `cuenta.service.ts` conserva milisegundos; `with-permission.ts` compara sin truncar y `auth.ts` fija `iat_sesion` con fracción de segundo solo al ingreso/reemisión explícita. `iat` y `exp` JWT siguen en segundos enteros. Se amplían pruebas de cuenta, guard y token; no se cambia el inicio al renovar.

- Se extrae `src/lib/api-estado-profesor.ts` para compartir el cliente API sin dependencia circular entre los dos diálogos.

- Browser encontró ids oficiales `seed-turno-*`; el lote usa strings no vacíos acotados, como las operaciones de C, sin exigir CUID a las clases. La pertenencia se valida en servidor antes de mutar.

## 7. Implementación y verificación ejecutadas

Los tests nuevos se consolidaron en `profesor.estado.service.test.ts` (esquemas y acceso), `profesor.estado.routes.test.ts` (adaptadores), `profesor.estado.pg.test.ts` (diez casos reales) y `resolver-clases-profesor-dialog.test.tsx` (selección/resultados). No se crearon los archivos adicionales de test de C/diálogo de estado previstos: los casos de negocio cruzados viven en la prueba PostgreSQL de D y se verificaron en navegador. Los DTO se infieren de los servicios; no fue necesario modificar `src/types/profesor.types.ts`. No hay migración.

Fixtures D-08: dos profesores sin futuras, con cuenta, para consulta y reactivación; idempotentes por DNI, preservan fichas existentes. Futuras, incompatibilidad, pagos y carreras se construyen en las bases descartables de tests. Se conservan cuentas oficiales. Postman se guarda en `docs/testing/hu-d-08/HU-D-08.postman_collection.json`; los HTTP reales se probaron en Chromium, no se afirma ejecución de Postman. SQL y capturas acompañan `docs/testing/hu-d-08/README.md`.

- Unidad completa final: 216 archivos, 2.652 tests aprobados; 45 archivos/292 tests PostgreSQL omitidos sin entorno.
- PostgreSQL específico D-08: diez aprobados, incluido rollback de ficha/cuenta/revocación, pago intacto, reprogramación simultánea y bloqueos de creación/confirmación.
- PostgreSQL completo: fase general 256 aprobados, 34 omitidos y dos fallos de H-03/E-10; regresiones de bases nombradas 18 y 16 aprobadas. Checkout limpio del commit base reproduce ambos fallos (246 aprobados en fase general, mismos dos fallos). La interferencia inicial del seed por alumnos creados en tests D-08 fue corregida; seed completo vuelve a pasar.
- HTTP: Gerente oficial y siete rutas; los otros tres roles reciben 403. Baja/reactivación real con cuenta, sesión vieja 401 antes y después de reactivar, login inactivo y nuevo login correcto.
- UI: diez visibles seleccionadas, página/filtro limpian selección; previews y dos resultados parciales; cancelación, motivo obligatorio, cero futuras ofrece baja, historial y reactivación sin restaurar clases. Escritorio y 390 × 844, modal con scroll, foco visible, Tab contenido y Escape. Estados de carga observados; error de API permanece legible y permite reintentar.
- Selectores: Nueva clase y generación excluyen al inactivo y lo restituyen; calendario también. Solicitar clase solo ofrece activos con clases disponibles; se verificó ausencia durante baja, sin inventar clases al reactivar.
- Lint: cero errores, advertencia previa `CALENDARIO` sin usar en Sidebar (constante ya presente en base). Claves centralizadas verificadas. TypeScript aprobado tras regenerar tipos con `next typegen`. Build de producción aprobada con webpack; Turbopack local no pudo abrir su puerto interno. CI por defecto se verificará en el SHA final.

No se certifica el resto del sistema. I-06 queda fuera; los dos fallos PostgreSQL previos se registran explícitamente y no se ocultan ni se debilitan sus tests. El estado de PR y checks del SHA final se consulta en GitHub antes de integrar.

Las respuestas de lotes conservan `canceladas`/`cambiadas` según spec y agregan `procesadas` como contador compartido de la UI. Las pruebas reales verifican ambos campos.
