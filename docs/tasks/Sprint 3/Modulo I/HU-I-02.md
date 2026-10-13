# TASK: HU-I-02 — Ver el historial de pagos del alumno

**Módulo:** I (Pagos) · **Sprint:** 3 · **Responsable:** Cali · **SP:** 2
**Rama solicitada:** `HU-F-02`. Es el nombre de rama indicado por el usuario; la HU de esta task es I-02, no F-02.
**Base relevada:** `develop`, commit `be491e4` (13/10/2026). Revalidar contra develop actualizado antes de implementar.
**Estado:** Fase 2 implementada y verificada en el worktree `noctium-codex`; cambios staged para revisión, sin commit.
**Contrato:** `docs/specs/spec_modulo_I.md` §2.13, §2.6.2 y §2.17; `docs/specs/spec_modulo_C.md` §2.18.4 y sus lecturas públicas; `docs/tasks/Sprint 3/PR-0.md` §2.13; `docs/tasks/Sprint 3/HU-Sprint-3.md` HU-I-02; `docs/RULES.md`, `docs/DESIGN.md`, `docs/adicionales/sdd-metodologia.md`.
**Referencia visual usada en Fase 2:** fotos provistas `Historial de pagos.png` y `Filtro por estado de pago.png`, en `C:\Users\agust\Desktop\Imagenes HU\HU-F-02`.
**RBAC:** `pagos:leer` para consultar; `pagos:crear` para ofrecer el atajo a Registrar pago. Profesor y Alumno no acceden a esta API. Gerente consulta sin registrar pagos.
**Schema:** reutilizar el PR 0; sin migraciones, cambios de schema ni seed base.

## 0. Relevamiento previo a implementación

Codex debe leer los documentos normativos completos, verificar este inventario en el código real y reportar las rutas exactas que creará/modificará y cualquier contradicción genuina. Debe esperar el OK explícito antes de modificar código.

### 0.1 Lo observado en develop

- `src/server/pagos/pago.publico.ts` publica `listarPagosDeAlumno(alumnoId, filtros, db?)`. Filtra por fechas y forma de pago vigentes; usa las lecturas compensatorias existentes.
- `src/server/pagos/pago.service.ts` y `pago.schema.ts` existen. No se encontró `listarHistorialDePagos` ni las rutas de historial.
- `src/server/turnos/inscripcion.publico.ts` ya publica `obtenerClasesBasicas` y `listarInscripcionesDeAlumno`. La ubicación real de estas lecturas no coincide con algunas referencias históricas a `turno.publico.ts`: usar la fachada real sin duplicarlas.
- `src/server/turnos/inscripcion.lecturas.ts` implementa `listarInscripcionesDeAlumno` con filtros `desde` y `hasta`. Su resultado incluye `vigente_ahora`, precio, estado de clase, estado de pago y profesor; todavía no expone `vence_el` ni acepta `estadoPago`.
- El mismo archivo implementa `resumenReservas`, `listarReservasPendientes` y `listarReservasVencidas`, usadas por C-26.
- `src/server/pagos/correccion.service.ts` ya contiene `puedeCorregirPago`; no crear otra regla de antigüedad/caja.
- La ficha vive en `src/app/(dashboard)/alumnos/[id]/page.tsx`; tiene pestañas de datos, clases e historial. La subruta `clases/page.tsx` reutiliza la ficha con su pestaña correspondiente. Relevar su implementación exacta antes de sumar Pagos.
- `src/server/shared/rutas-por-rol.ts` y el matcher de `src/proxy.ts` ya protegen `/alumnos/:path*`. No agregar entradas redundantes si la subruta queda cubierta.
- Existen comprobantes, flujo `/pagos/registrar?alumno=&clase=`, reloj inyectable, utilidades de fechas del centro, textos y componentes de paginación.
- El template real es `docs/templates/_template-HU.md`. Sus ejemplos antiguos de servicios/actions no prevalecen sobre RULES ni la estructura actual.
- No se encontró `docs/adicionales/mapa-pantallas-sprint-3.md` en esta base. No inventar su contenido: usar las figuras 77/78 y el contrato de §2.13.

### 0.2 Inventario propuesto: archivos nuevos

Revalidar y ajustar esta lista en Fase 1; es un plan, no una afirmación de implementación.

| Ruta | Propósito |
|---|---|
| `src/app/api/pagos/historial/route.ts` | GET historial o estado de pago, sesión, permiso y validación |
| `src/app/api/pagos/historial/opciones/route.ts` | GET materias/formas usadas por el alumno |
| `src/app/(dashboard)/alumnos/[id]/pagos/page.tsx` | Entrada a la pestaña Pagos, siguiendo el patrón de Clases |
| `src/app/(dashboard)/alumnos/[id]/historial-pagos.tsx` | Filtros, carga y paginación sin recarga completa |
| `src/app/(dashboard)/alumnos/[id]/tabla-historial-pagos.tsx` | Filas de pagos y clases según el modo |
| `src/lib/pagos-historial-listado.ts` | Parámetros del listado y URL, sin lógica de negocio |
| `src/server/pagos/pago.historial.test.ts` | Composición, totales, filtros y paginación |
| `src/server/pagos/pago.historial.pg.test.ts` | Lecturas reales y valores compensatorios |
| `src/app/api/pagos/historial/route.test.ts` | Contrato y permisos |
| `src/app/api/pagos/historial/opciones/route.test.ts` | Opciones y permisos |
| `src/app/(dashboard)/alumnos/[id]/historial-pagos.test.tsx` | Cambios de modo/filtros, vacíos y acciones |
| `docs/testing/Modulo I/hu-i-02/HU-I-02.postman_collection.json` | Pruebas de API |
| `docs/testing/Modulo I/hu-i-02/HU-I-02.sql` | Consultas de verificación no destructivas |
| `docs/testing/Modulo I/hu-i-02/HU-I-02-evidencia.md` | Resultados ejecutados, límites y capturas |

### 0.3 Inventario propuesto: archivos existentes

| Ruta | Cambio acotado |
|---|---|
| `src/server/pagos/pago.schema.ts` y su test | Query estricta de historial y opciones |
| `src/server/pagos/pago.service.ts` | `listarHistorialDePagos` y lectura de opciones |
| `src/types/pago.types.ts` | Tipos serializables y unión de modos |
| `src/server/turnos/inscripcion.lecturas.ts` | Ampliar solo `listarInscripcionesDeAlumno` y `InscripcionDeAlumno`: filtro opcional `estadoPago` y vencimiento; conservar comportamiento sin filtro |
| `src/server/turnos/inscripcion.lecturas.pg.test.ts` | Verificar ampliación y compatibilidad de consumidores existentes |
| `src/app/(dashboard)/alumnos/[id]/page.tsx` y su test | Pestaña Pagos con permiso y presentación de ficha |
| `src/lib/textos.ts` | Solo claves nuevas `ui.pagos.historial.*` |
| `docs/RULES.md` | Agregar «Aplicación HU-I-02», sin reescribir reglas |
| `docs/DESIGN.md` | Entrada de consulta y navegación de I-02, si necesaria; preservar secciones existentes |
| `docs/specs/spec_modulo_I.md` | Notas aditivas de sincronización con las fachadas reales, si necesarias |
| Esta task | Decisiones confirmadas, inventario final y DoD |

Si un contrato requiere modificar una fachada, tipo o prueba adicional, reportar su ruta en Fase 1. No fabricar archivos compartidos por conveniencia ni reestructurar módulos.

### 0.4 Decisiones y puntos a verificar

1. **Decisión resuelta:** la tarea es HU-I-02 y la rama solicitada es `HU-F-02`; no desarrollar personal de mesa de entrada por el nombre de la rama. Si la rama ya existe, inspeccionarla: no resetear ni sobrescribir trabajo.
2. **Decisión propuesta para confirmar con Fase 1:** mantener el patrón real de ficha/subruta, con `/alumnos/[id]/pagos` reutilizando la ficha y `tab=pagos` internamente. No crear una pantalla global de pagos.
3. **Decisión resuelta:** usar `inscripcion.publico.ts` como fachada real; `obtenerClasesBasicas` ya existe. No crear otra función con el mismo propósito.
4. **Decisión resuelta:** agregar `estadoPago` de manera opcional. Sin ese filtro, `listarInscripcionesDeAlumno` conserva sus resultados y orden; no filtrar globalmente las inscripciones de E/B/C.
5. **Relevar:** todos los campos necesarios para el response de §2.13 (precio congelado, ajuste y actor, comprobante vigente, cantidad de cambios, caja abierta para `puede_corregir`) deben provenir de lecturas del dominio dueño. Si falta algún campo, proponer una extensión aditiva y acotada en Fase 1, no consultar tablas de C/F directamente desde I.
6. **Relevar:** identificar qué guarda la relación de pagos históricos de Sprint 2 y cómo los incluye `listarPagosDeAlumno`. Contrastar con PR 0 y las decisiones de compatibilidad; reportar una omisión real, sin arreglarla en silencio.
7. **Decisión resuelta:** no implementar botones funcionales de Corregir/Anular ni su historial de cambios, que pertenecen a I-06; preservar el response contractual y preparar la integración sin enlaces a rutas inexistentes.
8. **Decisión resuelta:** las opciones incluyen pagos anulados y formas inactivas usadas; no usar el listado general de materias activas para este filtro.
9. **Relevar:** criterio de página fuera de rango y validación de IDs históricos según los helpers reales y las decisiones ya documentadas; reportar contradicciones con §2.13, sin cambiar contratos por inferencia.

### 0.5 Coordinación con Claude / HU-C-26

- Claude usa `feature/HU-C-26`; Codex usa `HU-F-02`, en otro worktree/carpeta. Nunca ejecutar ambos en el mismo working tree.
- El relevamiento de Claude informa una rama nueve commits detrás de develop y un cambio local en HU-I-12-b. Ese estado pertenece a su copia: el usuario debe revisar y actualizarla preservando sus cambios antes de implementar. Codex no debe hacer pull, stash ni descartes en esa carpeta.
- C-26 propone sumar profesor/aula al resultado de `listarReservasVencidas`. I-02 toca otra función del mismo archivo: `listarInscripcionesDeAlumno`. No editar ni reformatear las tres lecturas de reservas desde esta HU.
- En `textos.ts`, Claude agrega `ui.reservas.*`; Codex agrega `ui.pagos.historial.*`. No reordenar el catálogo ni cambiar claves existentes.
- RULES y DESIGN se comparten: agregar solo la sección/fila de I-02. Pueden aparecer conflictos de integración aunque las funciones sean distintas; resolverlos preservando ambas contribuciones tras revisión del usuario.
- C-26 es dueña de `/reservas`, `reserva.*`, Sidebar, proxy/rutas de reservas, `quitarAlumnoTurno` y su nota en spec C §2.20.3. I-02 no toca esos componentes/acciones.
- No modificar el wizard de I-10: ambos usan sus parámetros de preselección existentes.
- Entornos de prueba con datos separados; no resetear la base utilizada por Claude u otros desarrolladores.

## 1. Nota de alcance

Implementar lectura e interfaz de pagos de la ficha. I-02 no depende de C-26. Reutiliza contratos del PR 0 y funciones ya existentes; las dependencias funcionales son I-01, I-10, I-11, L-06 y B-04; verificar acceso del gerente habilitado por E-02.

**Fuera de alcance:** registrar pagos nuevos, corregir/anular, Mis pagos, configuración del centro, reservas globales, saldos/deudas, caja, migraciones, cambios de tarifas y cambios de reglas de vigencia. Los pagos anulados/corregidos se leen con el soporte del PR 0; no esperar la UI de I-06 para probar datos compensatorios a través de servicios existentes.

## 2. Historia de Usuario

**Como** personal de mesa de entrada o gerente, **necesito** ver los pagos registrados para un alumno y consultar sus clases por estado de pago, **para** responder consultas sobre lo abonado y detectar cobros sin registrar. **SP:** 2.

## 3. Alcance de esta task

- Pestaña Pagos y dos endpoints GET de §2.13.
- Modo historial: filtros por fechas, forma y materia; total del resultado completo; orden descendente; 10 filas por página.
- Modo estado de pago: clases vigentes Disponibles/Completas, filtros de fechas de clase y estado; atajo de cobro solo habilitado según contrato.
- Comprobantes existentes, etiquetas de anulados, precio congelado y ajustes originales.
- Permisos servidor, pruebas de tres niveles, verificación de UI y evidencia.

## 4. Contrato Backend

### 4.1 Validación

Aplicar el schema estricto de I §2.13.1 en `pago.schema.ts`: `alumno_id`, `desde`, `hasta`, `forma_pago_id`, `materia_id`, `estado_pago`, `pagina`. Fechas calendario válidas y rango ordenado; página entera positiva por defecto 1; rechazar parámetros extra y `estado_pago` junto con forma/materia. No admitir `por_pagina` ni modificar validadores compartidos sin relevamiento.

### 4.2 Servicio y respuestas

Seguir exactamente los campos, tipos, errores y ejemplos de I §2.13.1–4; esta task referencia el contrato sin reemplazarlo.

- Verificar existencia del alumno; también listar pagos de alumnos inactivos y de inscripciones canceladas/quitadas.
- Componer por fachadas públicas de B, C y F y la lectura propia de I, sin consultas por fila ni tablas ajenas.
- Usar monto, forma y fecha vigentes. Listar anulados, sin sumarlos. Total de todo el resultado filtrado, texto decimal exacto de dos decimales; evitar sumas monetarias con flotantes.
- Ordenar por fecha de pago vigente, registro e id descendentes; aplicar filtros, total y luego paginación en memoria según spec.
- Opciones por alumno: materias de clases con pagos, formas usadas activas/inactivas; orden alfabético normalizado.
- Modo estado: clasificación única de C, `ahora()` y fechas del centro; no duplicar vigencia. Una reserva vencida sin marcar no es Reservada vigente.
- Solo clases DISPONIBLE/COMPLETO e inscripciones vigentes en el estado elegido. Fechas sobre la clase; sin `total_pagado` en este modo.
- Exponer vencimiento para Reservada y condición de cobro de C §2.18.4. Gerente nunca recibe `puede_registrar_pago: true`.
- Usar `puedeCorregirPago` existente para el campo contractual cuando los datos necesarios estén disponibles; su resultado no autoriza mutaciones de esta task.

### 4.3 Rutas

`GET /api/pagos/historial` y `GET /api/pagos/historial/opciones`: `withPermission("pagos:leer")`, validación antes del servicio, respuesta estándar `{ data, error }`. 401 sin sesión, 403 sin permiso, 400 query inválida y 404 alumno inexistente según helpers/contrato. Relevar el código real de validación, ya que C-26 detectó diferencias entre helpers y su spec; no modificar el helper global.

### 4.4 Acciones y trazabilidad

Lecturas: no agregar Server Actions de escritura, eventos de mutación, bloqueos de cobro ni auditoría ficticia. Reutilizar trazabilidad existente para mostrar quién registró/ajustó. Ningún pago, inscripción ni caja cambia al consultar.

## 5. Frontend

- Fotos provistas de historial y estado de pago: encabezado del alumno, pestañas de ficha, filtros y tabla. Usar tokens y componentes existentes; verificar escritorio y móvil.
- Historial: Fecha, Clase enlazada a detalle (fecha/hora/materia), Precio, Monto cobrado, Forma, Registrado por y Comprobante. Mostrar ajuste con motivo/actor cuando corresponda; Anulado textual y exclusión del total.
- Estado: Fecha, Materia, Profesor, Precio, Estado textual y atajo de cobro si habilitado. Reservada muestra «pagar antes del <fecha y hora>».
- Activar estado limpia/deshabilita forma y materia y muestra la leyenda contractual. Volver a historial no restaura silenciosamente filtros que se limpiaron.
- Fechas cambian de significado al cambiar de modo; comunicarlo en etiquetas. Cambiar modo/filtros vuelve a página 1, sin recargar toda la pantalla; descartar respuestas viejas y mantener URL coherente.
- «Limpiar filtros» vuelve al historial completo, sin estado ni filtros, página 1. Opciones corresponden al alumno, no a la página visible.
- El atajo usa `/pagos/registrar?alumno=<id>&clase=<id>` de I-10; no construir otro modal de cobro. No se ofrece a gerente, en clases iniciadas/canceladas ni para inscripciones no cobrables.
- Comprobantes usan sus rutas/permisos existentes; no reconstruir documentos ni exponer datos de caja.
- Vacíos literales: «Este alumno no tiene pagos registrados», «No hay pagos para los filtros elegidos», «No hay clases con ese estado de pago en el período». Errores de red con reintento; datos ausentes sin inventar nombres.
- Textos nuevos en `ui.pagos.historial.*`. No agregar Sidebar ni nueva pantalla global.

## 6. Testing en tres niveles

### 6.1 Unitarios y componentes

- Queries inválidas, combinación prohibida, calendario/rango y página.
- Total de varias páginas, exactitud decimal, orden/desempates, filtros combinados.
- Valores corregidos vigentes; anulados visibles sin sumar; pagos de quitados/cancelados e inactivos.
- Opciones con formas inactivas y materias de pagos anulados.
- Estados: vencida sin marcar excluida, no vigentes excluidas, clases canceladas excluidas; cobro solo antes del inicio y para mesa.
- Compatibilidad de `listarInscripcionesDeAlumno` sin nuevo filtro.
- UI: página 1 al filtrar, cambio de modo limpia/deshabilita, vacíos, respuestas viejas y comprobantes/atajos por permiso.

### 6.2 API / Postman

Colección para ambos GET: mesa y gerente autorizados, alumno/profesor 403, sin sesión 401; alumno inexistente 404; query inválida 400; éxito en cada modo y opciones. Registrar requests/resultados realmente ejecutados. API no devuelve saldo/deuda ni totales de caja.

### 6.3 PostgreSQL y visual

Crear datos aislados mediante servicios del dominio y reloj inyectable; sin pagos fuera del plazo para fabricar fixtures. Comprobar SQL contra los valores originales/compensatorios y precio de inscripción, filtrado y paginación. Demostrar que consultar no altera pago/inscripción/caja. No usar una base compartida ni seed destructivo.

Comparar ambas vistas con las fotos provistas en escritorio y móvil; guardar capturas/evidencia. Ejecutar los checks del proyecto adecuados (TypeScript, lint, tests dirigidos y build); distinguir fallos previos de nuevos, sin arreglos ajenos. Marcar «Bloqueado» todo criterio no verificado, con motivo, nunca aprobado ficticiamente.

Verificación diferida: integración de acciones de I-06 y vista propia de I-05 cuando se implementen; no difiere la prueba de lectura de anulados/correcciones que el PR 0 ya permite.

## 7. Definition of Done

- [x] Fase 1 con inventario final y decisiones confirmada explícitamente.
- [x] Rama/carpeta propia y base actual revisadas; trabajo de Claude preservado.
- [x] Ambos endpoints y pestaña con contrato completo y permisos servidor.
- [x] Filtros, modos, total exacto y paginación de 10 verificados.
- [x] Vigencia central reutilizada; compatibilidad de lecturas anteriores verificada.
- [x] Pagos anulados/corregidos y precio congelado verificados.
- [x] Atajos de cobro y comprobantes existentes, según permisos.
- [x] UI comparada con las fotos provistas en escritorio/móvil.
- [x] Tres niveles de pruebas ejecutados/documentados, bloqueos explícitos.
- [x] Textos y notas normativas aditivas; diff acotado y sin migraciones.
- [x] Sin commit, push, merge, pull, rebase ni amend; cambios revisables staged.

## 8. Resoluciones aprobadas y ejecución de Fase 2 (13/10/2026)

El responsable autorizó expresamente la Fase 2 y las decisiones de Fase 1. La rama `HU-F-02` y el worktree `noctium-codex` se conservaron sobre `5745c88`; no se hizo commit, push, merge, pull, rebase ni amend.

- `/alumnos/[id]/pagos` delega en la ficha con `tab=pagos`; el filtro también se puede abrir en `/alumnos/[id]?tab=pagos`. No se creó pantalla global ni menú lateral.
- `pagina` es entera positiva, tamaño fijo 10. Fuera de rango se ajusta a la última página; sin resultados devuelve página 1 y cero páginas.
- `alumno_id` usa CUID, `forma_pago_id` usa el validador de CUID o ids históricos del catálogo y `materia_id` usa texto no vacío, como en la spec y en las lecturas existentes. Las fechas son calendario válido y rango ordenado. La query es estricta.
- Las opciones se forman con las formas y materias realmente usadas por el alumno, incluidos pagos anulados y formas luego inactivas. Los nombres se ordenan normalizados.
- Extensiones aditivas aprobadas: `listarInscripcionesDeAlumno` expone `vence_el` y acepta `estadoPago` opcional. Ese filtro aplica `esVigenteEn` y clase Disponible/Completa; sin filtro conserva el universo anterior. `listarPagosDeAlumno` expone internamente `caja_abierta` consultada en lote para `puedeCorregirPago`; no se envía la caja al cliente.
- El permiso del atajo de cobro se verifica también en servidor con `pagos:crear` y rol Mesa. I-10 vuelve a verificar al cobrar. Los botones Corregir/Anular siguen reservados a I-06.
- La migración `20261013040000_hu_e11_anulacion_append_only` afecta las anulaciones de clases dictadas de E y su proyección vigente; no requiere cambio de schema ni migración propia para I-02. Se regeneró Prisma Client y se aplicaron migraciones solo en `noctium_i02_pg` (`127.0.0.1:55434`).

### Archivos de la HU

- Backend y contratos: `src/server/pagos/pago.schema.ts`, `pago.service.ts`, `pago.publico.ts`, `src/server/turnos/inscripcion.lecturas.ts`, `src/types/pago.types.ts` y ambas rutas bajo `src/app/api/pagos/historial/`.
- Ficha e interfaz: `src/app/(dashboard)/alumnos/[id]/page.tsx`, `pagos/page.tsx`, `historial-pagos.tsx`, `tabla-historial-pagos.tsx`, `src/lib/pagos-historial-listado.ts` y claves `ui.pagos.historial.*` de `src/lib/textos.ts`.
- Verificación: `pago.historial.test.ts`, `pago.historial.pg.test.ts`, `inscripcion.lecturas.pg.test.ts`, ambas pruebas de rutas, `historial-pagos.test.tsx`, adaptación de mocks de `pago.publico.test.ts` y `pago.service.test.ts`, y `docs/testing/Modulo I/hu-i-02/`. Notas acotadas en `docs/RULES.md` y `docs/DESIGN.md`.

La coordinación con C-26 mantiene el cambio de C dentro del tipo y `listarInscripcionesDeAlumno`; no se tocaron las lecturas de reservas de Claude. Las claves de textos nuevas viven solo bajo `ui.pagos.historial.*`. Las notas de RULES/DESIGN son aditivas y deberán integrarse conservando ambas contribuciones cuando se reúnan las ramas.

Evidencia técnica y comparación visual: [HU-I-02-evidencia.md](../../../testing/Modulo%20I/hu-i-02/HU-I-02-evidencia.md). Las referencias visuales usadas fueron las dos fotos provistas de historial y estado de pago, abiertas antes de construir la UI.
