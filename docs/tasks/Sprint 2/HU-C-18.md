# TASK: HU-C-18 — Reordenar el flujo de registro de turno

**Módulo:** C (Gestionar turnos)
**Sprint:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` Revisión 5, especialmente §§2.1, 2.2, 2.3, 2.6, 2.8 y 2.9; `docs/tasks/Sprint 2/HU-Sprint-2.md` §10
**RBAC:** permisos existentes `turnos:crear`, `turnos:asignar_aula` y `turnos:asignar_participantes`; no se releva un permiso nuevo
**Schema:** el modelo de datos ya admite `profesorId` en el turno; la Revisión 5 exige ajustar los contratos Zod y servicios, sin migración prevista
**SP de trabajo:** 5, según backlog/PDF autoritativo y asignación del Sprint 2

---

## 0. Relevamiento previo a implementación

**Estado de esta sección:** relevamiento revisado y aprobado para iniciar la etapa 1. Rama `feature/HU-C-18`, nacida sobre `feature/HU-C-16`; sin incorporar trabajo de `feature/HU-C-07`. Se compararon el backlog de Sprint 2, la Revisión 5 de la spec, `docs/RULES.md`, las tasks de Sprint 1 HU-C-03/HU-C-04/HU-C-15, HU-C-16 y el código presente. Esta sección conserva el estado previo como evidencia histórica.

### 0.1. Flujo actual de alta y edición

| Momento | Implementación observada |
|---|---|
| Entrada | `/turnos/nuevo` (`nuevo/page.tsx`) renderiza `TurnoConfiguracion` sin id. `/turnos/[id]/configuracion` renderiza el mismo componente con id para editar un `PENDIENTE`. No hay wizard ni paso actual. |
| Carga | `turno-configuracion.tsx` pide `GET /api/turnos/configuracion` para materias activas y parámetros; en edición, también `GET /api/turnos/[id]`. Además pide `GET /api/turnos/aula/opciones` **sin** `turno_id` en alta, o **con** id en edición. Mantiene en estado local `fecha`, `duracion_min`, `hora_inicio`, `materia_id`, aula elegida, opciones, turno/id, valores originales, errores y resultado. |
| Selección | Una pantalla fusiona fecha, duración, hora, materia y aula. El selector de horas usa horario operativo y duración en el cliente; todavía no consulta el horario del profesor. `SeccionAulaTurno` muestra nombre/capacidad y puede elegirse antes de crear el turno. No hay elección de profesor en esta pantalla. |
| Primer guardado | Al pulsar «Guardar turno», `POST /api/turnos` envía fecha, hora, materia y duración. `configurarTurno()` crea el turno `PENDIENTE` **sin profesor ni aula**. En edición, `PATCH /api/turnos/[id]/configuracion` modifica esos campos. Tras el alta se guarda el id local y `history.replaceState` cambia la URL a `/turnos/[id]/configuracion`, evitando un segundo alta al recargar. |
| Aula | Si se eligió un aula, la misma acción de guardado hace después `PATCH /api/turnos/[id]/aula`. El `PATCH` fija aula y cupo; el turno sigue `PENDIENTE`. Puede guardarse sin aula; si falla este segundo request, el turno ya existe y la UI permite reintentar sin duplicarlo. |
| Profesor y alumnos | Tras el resultado de configuración con aula, un enlace lleva a `/turnos/[id]/participantes`. Esa pantalla carga `GET /api/turnos/[id]`, luego `GET /api/turnos/profesores/opciones?turno_id=` (selector heredado filtrado por horario), y busca alumnos con `GET /api/turnos/participantes/alumnos?q=` mediante `BuscadorAlumnos`. Guarda profesor y `alumno_ids` juntos con `PATCH /api/turnos/[id]/participantes`; esta operación confirma a `DISPONIBLE`/`COMPLETO`. Sin aula, remite a configuración. |
| Salidas | El resultado de configuración ofrece continuar a participantes, asignar aula, ver detalle o volver al listado. El resultado de participantes ofrece detalle/listado. `urlContinuar()` en `turno.types.ts` envía un `PENDIENTE` a configuración si carece de aula, o a participantes si ya la tiene. Listado y detalle siguen ese orden heredado. `DirtyStateContext` protege salidas con cambios locales. |

La herencia coincide con HU-C-03 (configuración base y duración), HU-C-04 (profesor más alumnos al confirmar) y HU-C-15 (aula/cupo antes de participantes). HU-C-16, ya implementada y revisada en esta rama, completó el filtrado de aulas activas, suficientes y libres, y el texto exacto para `data: []`. Su sección de aula solo recibe `onReintentar`: no tiene callback de regreso al paso Fecha y horario. La documentación antigua de HU-C-15 contiene estados históricos previos al rediseño; para el comportamiento vigente prevalecen su §6.3, HU-C-16 y la Revisión 5 de la spec.

**Inventario concreto del flujo vigente:** las páginas son `src/app/(dashboard)/turnos/nuevo/page.tsx`, `[id]/configuracion/page.tsx`, `[id]/participantes/page.tsx`, `[id]/page.tsx` y `page.tsx` del listado, junto con `turno-configuracion.tsx`, `seccion-aula-turno.tsx`, `[id]/participantes/participantes-turno.tsx`, `buscador-alumnos.tsx`, `turno.types.ts`, `turnos-listado.tsx` y `[id]/turno-detalle.tsx`. La UI utiliza `fetchAutenticado`, `DirtyStateContext` y enlaces protegidos. Las rutas que efectivamente consulta o muta este recorrido son `src/app/api/turnos/configuracion/route.ts`, `route.ts` (POST), `[id]/route.ts`, `[id]/configuracion/route.ts`, `aula/opciones/route.ts`, `[id]/aula/route.ts`, `profesores/opciones/route.ts`, `participantes/alumnos/route.ts` y `[id]/participantes/route.ts`, todas bajo `src/app/api/turnos/`. Los servicios son `src/server/turnos/turno.service.ts`, `turno.aula.service.ts`, `turno.profesor.service.ts`, con schemas/validaciones en `turno.schema.ts`, `turno.validaciones.ts` y helpers de superposición en `turno.disponibilidad.ts`. No hay hook específico del wizard ni Server Action de Turnos.

### 0.2. Persistencia y navegación exigidas por el contrato vigente

**Decisión contractual cerrada:** Materia, Profesor y Fecha/Horario viven inicialmente en estado cliente. La duración se elige dentro del paso 3, antes de fecha y hora. Al confirmar ese paso, `POST /api/turnos` incluye `profesor_id`, crea el `PENDIENTE` y devuelve `turno_id`. El paso 4 usa `PATCH /api/turnos/[id]/aula`; el paso 5 usa `PATCH /api/turnos/[id]/participantes` y es el que confirma/disponibiliza. No se crea un endpoint combinado.

| Paso nuevo | Antes/después de `turno_id` | Dato y operación al continuar |
|---|---|---|
| 1. Materia | Antes | Selección local de materia activa; todavía no se crea turno. Su origen actual es `GET /api/turnos/configuracion`. |
| 2. Profesor | Antes | Selección local de profesor activo que dicta la materia. HU-C-07 §2.8.1 provee `GET /api/turnos/profesores/por-materia?materia_id=`; **no** corresponde usar el selector heredado `profesores/opciones?turno_id=` para el alta nueva. |
| 3. Fecha y horario | Antes hasta confirmar; después existe id | Primero se elige duración obligatoria de 1/2/3 h; con profesor, materia y duración se consulta disponibilidad de HU-C-07 §2.8.2. Al confirmar, `POST /api/turnos` envía materia, `profesor_id`, fecha, hora y duración; nace un `PENDIENTE` real con id. Si ya existe por un regreso, `PATCH /api/turnos/[id]/configuracion` revalida el conjunto. No se crea endpoint combinado. |
| 4. Aula | Después | `GET /api/turnos/aula/opciones?turno_id=<id real>` consume HU-C-16; `PATCH /api/turnos/[id]/aula` fija aula y cupo. El modo sin id del GET sigue siendo contractual para otros consumidores; el wizard nuevo siempre envía id. |
| 5. Alumnos | Después | Búsqueda/selección local con el buscador actual; `PATCH /api/turnos/[id]/participantes` con `alumno_ids` confirma. La Revisión 5 vuelve opcional `profesor_id` en este `PATCH`: usa el ya persistido y revalida profesor, materia, horario, recursos y alumnos. Conserva la vía de profesor explícito para `PENDIENTE` heredados sin profesor. |

El backend de la rama aún responde al contrato anterior: `ConfigurarTurnoSchema` no exige `profesor_id`; `configurarTurno()` persiste `profesorId: null`; el `PATCH` de configuración puede desasignar profesor al cambiar materia; `AsignarParticipantesTurnoSchema` exige `profesor_id` y el servicio lo escribe al confirmar. La spec ahora exige que la creación y modificación validen profesor activo, materia que dicta, horario y superposición; que un cambio inválido de materia/profesor se rechace; y que un aula en conflicto se desasigne con `aula_desasignada: true`. Son cambios de **contrato y momento de revalidación** de C-18, no reglas de negocio nuevas ni cambios de Prisma.

La spec §2.1 ya define «Atrás»; no hace falta inventar una máquina de estados distinta: volver por sí solo conserva elecciones. Cambiar profesor limpia fecha/hora y vuelve a pedir disponibilidad con la duración conservada; si hay `PENDIENTE` persistido, no se actualiza hasta reconfirmar paso 3. Cambiar materia conserva profesor y horario solo si sigue dictándola; en otro caso limpia ambos. Cambiar fecha/hora/duración conserva profesor, aula y alumnos, salvo que el `PATCH` desasigne aula por conflicto: la UI avisa y lleva al paso 4. Cambiar aula conserva alumnos locales, con cupo revalidado al confirmar. Para un `PENDIENTE` existente, el regreso a pasos 1–3 necesita hidratar la selección desde `GET /api/turnos/[id]`, y cualquier modificación se persiste recién al reconfirmar el paso 3.

### 0.3. Referencia visual aprobada y reutilización

La descripción aprobada del mockup es autoridad **visual**; el backlog y la spec gobiernan comportamiento. Objetivo de `/turnos/nuevo`: breadcrumb «Turnos / Nuevo turno», título «Nuevo turno», subtítulo «Materia  Profesor  Fecha y horario  Aula  Alumnos.», selector superior «Turno individual» / «Generar varios turnos», indicador Materia → Profesor → Fecha y horario → Aula → Alumnos con estados completado/actual/futuro; en escritorio, contenido del paso a la izquierda, «Resumen» persistente a la derecha y navegación al pie. El resumen muestra progresivamente MATERIA, PROFESOR, FECHA Y HORARIO, AULA y ALUMNOS; sin selección, «Sin elegir» o equivalente del diseño.

El paso 3 presenta «Elegí fecha y horario», explicación del rango/horario del profesor, duración 1 h / 2 h / 3 h, calendario mensual con días disponibles y día elegido, panel lateral de horas, leyenda y acciones «Atrás» / «Continuar a aula». Horas libres son seleccionables; el mockup también representa horas no disponibles deshabilitadas/tachadas con explicación. `Breadcrumb`, `Button`, los inputs/selects actuales y el patrón visual de `stepper-alta-profesor.tsx` sirven como referencias reutilizables; el stepper de profesor tiene pasos fijos y no es reutilizable directamente. `BuscadorAlumnos` y la selección/cupo de `SeccionAulaTurno` sí aportan lógica/presentación reutilizable, aunque la copia de «aula opcional» y «profesor después» pertenece al flujo anterior. No se encontró un calendario mensual de turno existente: `selector-calendario.tsx` selecciona una entidad calendario, no fechas del turno. La pantalla actual tiene un `input type=date`, radio de duración y `select` de horas operativas, sin panel de resumen, pasos, calendario mensual ni selector de modo.

HU-C-07 aporta los **inicios disponibles** por fecha, franjas y tramos libres, no una lista de horas ocupadas con motivo individual. Los horarios tachados y su explicación constituyen una divergencia visual del mockup: C-18 mostrará las opciones disponibles del contrato, sin inventar ni recalcular ocupaciones o motivos en el frontend. El mockup sigue guiando el layout, el calendario, la selección y la jerarquía visual. «Generar varios turnos» pertenece funcionalmente a HU-C-17: C-18 estructura Materia y Profesor como componentes reutilizables por ambos modos; el modo masivo comparte esos pasos y desde el paso 3 sigue su flujo propio de C-17. C-18 no crea una implementación falsa o parcial de generación masiva.

### 0.4. Dependencias y límites entre historias

- **HU-C-07:** el contrato esperado es Materia → lista `{id,nombre,apellido}` de profesores activos de esa materia (§2.8.1), y Profesor + materia + duración → fechas/franjas/tramos/inicios posibles (§2.8.2); `fechas: []` es respuesta válida y muestra su mensaje contractual. En esta rama no están las rutas `por-materia` ni `[profesorId]/disponibilidad` ni su integración visual. La ruta heredada `profesores/opciones?turno_id=` corresponde al caso legacy de §2.6. Se puede trabajar de forma independiente en estructura visual/navegación, contratos de creación/confirmación, Aula, Alumnos y tests con interfaces simuladas; la selección real y la disponibilidad del paso 3 esperan el contrato público de C-07. No mergear, cherry-pickear ni copiar su rama durante este relevamiento.
- **HU-C-16:** disponible aquí `GET /api/turnos/aula/opciones?turno_id=` con filtrado de aulas activas, capacidad y ausencia de turno `DISPONIBLE`/`COMPLETO` superpuesto; `data: []` ya muestra «No hay aulas disponibles para este horario», distinto de `SIN_AULAS_ACTIVAS`. C-18 lo llamará después del `POST` del paso 3 y materializará «volver a Fecha y horario» en el wizard. No debe replicar el cálculo de ocupación.
- **HU-C-17:** es dueña del comportamiento funcional de «Generar varios turnos». C-18 deja Materia y Profesor como componentes compartibles por ambos modos y respeta el selector del mockup como estructura visual global; desde el paso 3 el modo masivo sigue su flujo propio de C-17. No se implementan sus pasos posteriores, servicios, rutas ni confirmación, ni una generación masiva ficticia o parcial.
- **`PENDIENTE` abandonado / HU-C-05:** después de confirmar el paso 3, el turno ya está persistido; salir del wizard no lo borra. C-18 no introduce borrado físico ni implementa lateralmente la cancelación posterior de un `PENDIENTE`, que pertenece a su contrato correspondiente (R5-13/§2.10). Aún no se ve una ruta de descarte en esta rama. La única pregunta de reanudación es si listado/detalle deben abrir ese `PENDIENTE` directamente dentro del nuevo wizard y desde qué paso.

### 0.5. Edición frente a alta

HU-C-18 AC1 nombra específicamente `/turnos/nuevo`. La spec §2.1 también prescribe `PATCH .../configuracion` al retroceder **dentro del wizard** luego de creado el `PENDIENTE`, por lo que el alta puede convertirse en edición del mismo id. Hoy existen además `/turnos/[id]/configuracion` y `/turnos/[id]/participantes` para continuar o editar `PENDIENTE`, incluidos legados sin profesor. El contrato no dice inequívocamente que ambas pantallas independientes deban reemplazarse por completo ni cómo se reanuda desde listado/detalle un wizard incompleto. Conservar la compatibilidad de legados es explícito en §2.2; el alcance de la navegación de reanudación necesita aprobación antes de cambiar `urlContinuar()` y enlaces de detalle/listado. La edición de turnos ya `DISPONIBLE`/`COMPLETO` no entra en este wizard.

### 0.6. Archivos candidatos exactos y cobertura

**Existentes a modificar según el contrato de C-18 (sujetos a aprobación de alcance):**

| Archivo | Cambio identificado |
|---|---|
| `src/app/(dashboard)/turnos/nuevo/page.tsx` | Renderizar entrada del wizard individual en lugar de la configuración fusionada. |
| `src/app/(dashboard)/turnos/turno-configuracion.tsx` | Extraer/reutilizar controles y validaciones de fecha/duración/materia donde corresponda, y evitar que el alta nueva siga llamando al GET de aulas sin id. Mantener o adaptar su uso en edición según decisión 0.5. |
| `src/app/(dashboard)/turnos/seccion-aula-turno.tsx` | Reutilizar selector y estados de HU-C-16 en el paso 4; conectar la acción real de regreso y revisar copia de flujo anterior. |
| `src/app/(dashboard)/turnos/[id]/participantes/participantes-turno.tsx` | Reutilizar búsqueda/lista de alumnos en paso 5 sin reelección obligatoria de profesor; preservar la pantalla legacy para `PENDIENTE` sin profesor. |
| `src/server/turnos/turno.schema.ts` | `profesor_id` requerido en configuración; opcional en participantes según Revisión 5. |
| `src/server/turnos/turno.service.ts` | Alta/modificación con profesor y revalidación; posible desasignación de aula en conflicto; confirmación de alumnos con profesor persistido o explícito legacy. Reutilizar validaciones/helpers existentes. |
| `src/app/(dashboard)/turnos/turno.types.ts`, `turnos-listado.tsx`, `[id]/turno-detalle.tsx` | Solo si se aprueba redirigir la continuación de `PENDIENTE` al wizard; actualizar enlaces/copia del orden anterior. |
| `src/app/(dashboard)/turnos/[id]/configuracion/page.tsx`, `[id]/participantes/page.tsx` | Revisar entradas/permisos si se decide reanudar por wizard; no asumir que desaparecen. |

**Archivos nuevos propuestos, solo si la revisión aprueba la división:** `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx` (estado, pasos y requests del modo individual); `src/app/(dashboard)/turnos/paso-materia-turno.tsx` y `src/app/(dashboard)/turnos/paso-profesor-turno.tsx` (componentes reutilizables por C-18 y, luego, C-17); `src/app/(dashboard)/turnos/nuevo/paso-fecha-horario.tsx` (calendario/horarios alimentados por C-07); `src/app/(dashboard)/turnos/nuevo/progreso-turno.tsx` y `src/app/(dashboard)/turnos/nuevo/resumen-turno.tsx` (presentación del mockup). Aula y Alumnos pueden extraerse si la implementación muestra reutilización real con pantallas legacy. Tests nuevos probables: `src/app/(dashboard)/turnos/nuevo/turno-wizard.test.tsx`, tests focalizados para paso 3 y contratos HTTP de `POST /api/turnos`, `PATCH .../configuracion` y `PATCH .../participantes` si su cobertura actual no alcanza los contratos nuevos.

**Tests existentes afectados:** `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`, `[id]/participantes/participantes-turno.test.tsx`, `turnos-listado.test.tsx`, `src/server/turnos/turno.configuracion.test.ts`, `turno.participantes.test.ts`, `turno.profesor.test.ts`; regresión de `turno.aula.test.ts` y `src/app/api/turnos/aula/opciones/route.test.ts`. `turno.validaciones.test.ts` y las pruebas de reservas son candidatas de regresión si se toca el circuito de revalidación.

**No tocar por este relevamiento ni duplicar en implementación:** `prisma/schema.prisma`, migraciones, seed, contratos de módulos D/K, código de la rama C-07, `src/server/turnos/turno.aula.service.ts` y su lógica de superposición, rutas/servicios de generación masiva C-17. Los Route Handlers existentes de alta/configuración/participantes probablemente solo necesiten verificar su traducción de errores y schema al cambiar el contrato; no se proponen rutas nuevas de C-18.

### 0.7. Criterios de HU-C-18 frente al estado real

| Criterio de backlog | Estado actual | Gap real y archivo responsable | Dependencia |
|---|---|---|---|
| AC1: cinco pasos, orden aprobado | Configuración+Aula fusionadas; Profesor+Alumnos juntos | Wizard, estado, presentación y requests en `nuevo/page.tsx`/nuevo componente; contratos de `turno.schema.ts` y `turno.service.ts` | C-07 para pasos 2/3; C-16 ya disponible para 4 |
| AC2: redistribuir C-03/C-15 sin cambiar validaciones | Fecha/duración/materia y aula comparten formulario y guardado secuencial | Pasar materia a 1, fecha/duración/hora a 3 y aula a 4 con id real; `turno-configuracion.tsx`, `seccion-aula-turno.tsx`, backend de configuración | C-07 para horas; C-16 para aulas |
| AC3: separar profesor de alumnos | Ambos se eligen en `participantes-turno.tsx` al final | Profesor local en 2 y persistido al crear; alumnos en 5; schema/servicio de participantes admite profesor persistido y caso legacy | C-07 §2.8.1; reutiliza buscador actual |
| AC4: Atrás conserva salvo invalidez | No hay navegación entre pasos; solo edición separada y limpieza local de hora inválida | Estado de wizard, hidratar id, reglas de invalidación de §2.1, `aula_desasignada`; nuevos componentes y `turno.service.ts` | C-07 para recálculo; C-16 para regreso desde aula vacía |
| AC5: C-03/C-04/C-15 siguen Done; C-18 absorbe reordenar | Implementación de Sprint 1 funciona bajo contrato anterior | Ajustar contratos y tests aquí, sin reabrir esas tasks ni crear reglas nuevas | Ninguna nueva |
| AC6: C-17 comparte Materia/Profesor | No hay selector de modo ni componentes compartidos de esos pasos | Crear componentes reutilizables de Materia/Profesor y estructura visual del selector; C-17 implementará el comportamiento masivo y su flujo desde paso 3 | C-17 funcional pendiente; C-07 como origen común |

### 0.8. Divergencias registradas, sin resolverlas en este relevamiento

1. **Estimación:** HU-C-18 tiene **5 SP** en el backlog/PDF autoritativo y en la asignación de Sprint 2; `HU-Sprint-2.md` §10 todavía indica 3 SP. Es documentación local desactualizada frente al backlog/PDF autoritativo; el valor de trabajo de esta task es **5 SP**.
2. **Spec versus código actual:** los contratos `profesor_id` obligatorio al crear/opcional al confirmar, las revalidaciones del profesor, la desasignación de aula y `aula_desasignada` aún no están implementados en esta rama. Son trabajo de C-18, aunque se documenten en secciones históricas C-03/C-04 de la spec.
3. **Backlog AC4 versus spec §2.1:** el backlog formula «Atrás» en términos generales; la spec ya fija con precisión qué se conserva, cuándo se limpia fecha/hora y cuándo se persiste. Se propone aplicar esta última literalmente.
4. **Divergencia visual, mockup versus contrato C-07:** el mockup muestra horarios no disponibles tachados y una explicación; §2.8.2 entrega inicios disponibles, sin información para atribuir un motivo a cada horario ocupado. C-18 debe mostrar las opciones disponibles, sin inventar ni recalcular motivos en frontend; mantiene el mockup como guía de layout, calendario, selección y jerarquía.
5. **Modo masivo:** el mockup muestra el selector de ambos modos y AC6 exige compartir Materia/Profesor. Su funcionalidad pertenece a HU-C-17 posterior, que comparte esos dos componentes y diverge desde el paso 3. C-18 no entrega una versión parcial de generación masiva.
6. **Spec §2.3 versus código conservado de C-16:** el GET de aula conserva `turno_id` opcional aunque un pasaje de la spec menciona `400` si falta; HU-C-16 dejó documentada esa contradicción. El wizard nuevo siempre usa id, sin cambiar el contrato del GET. También sigue documentado en C-16 que `TURNO_CANCELADO` se agrupa con `TURNO_YA_DISPONIBLE`; no es requisito de reordenamiento.
7. **Spec R5-13 versus rama actual:** la cancelación/descarte posterior de un `PENDIENTE` tiene contrato propio, pero aún no hay ruta de descarte visible. En C-18, salir después del paso 3 deja el `PENDIENTE` persistido; no se borra ni se implementa esa cancelación de manera lateral.

### 0.9. Preguntas concretas para la revisión

1. **Resuelta:** C-18 aplica al nuevo flujo de `/turnos/nuevo`; no agrega navegación desde listado/detalle para reabrir `PENDIENTE`. Conserva los contratos legacy para turnos antiguos sin profesor.
2. **Resuelta:** la captura aportada por el equipo es la referencia visual aprobada. La ausencia de su archivo fuente no bloquea implementación.

### 0.10. Propuesta de etapas pequeñas para aprobación

A. Contratos de configuración/confirmación de C-18: schemas, servicio, revalidación de profesor, `aula_desasignada` y tests; sin endpoints nuevos ni reglas duplicadas.
B. Estructura visual y navegación del wizard individual: encabezado y selector visual conforme al mockup, progreso, resumen, pasos locales, Materia/Profesor como componentes reutilizables por C-17 y preservación de selecciones; tests de navegación. No implementar comportamiento funcional del modo masivo. Puede avanzar sin traer código de C-07.
C. Materia → Profesor y Fecha/horario: integrar **solo el contrato público** de C-07 cuando esté disponible en esta rama; duración antes de disponibilidad, calendario y creación del `PENDIENTE` en paso 3. Si C-07 no está, conservar esta etapa pendiente y no simular reglas de disponibilidad.
D. Aula: consumir HU-C-16 con `turno_id` real, asignar/cambiar aula y hacer efectivo el regreso desde lista vacía a Fecha y horario; pruebas de integración/regresión.
E. Alumnos: reutilizar buscador y cupo, confirmar con profesor persistido, conservar caso legacy; pruebas del paso final.
F. Atrás, cambios e invalidación después de persistir: reconfirmación del paso 3, resolución de aula desasignada y conservación de alumnos; reanudación desde listado/detalle solo según la decisión pendiente. Salir conserva el `PENDIENTE` persistido, sin borrarlo ni añadir cancelación en C-18.
G. Regresión completa de alta, edición legacy, rutas, permisos, validaciones, concurrencia y presentación del mockup; sin código de generación masiva.

**Estado final del relevamiento: revisado y aprobado; etapa 1 backend autorizada.**

---

## 1. Etapa 1 — contrato backend de Profesor al configurar

**Alcance aprobado:** al confirmar el futuro paso 3, `POST /api/turnos` recibe `profesor_id` obligatorio y crea un `PENDIENTE` con materia, profesor, fecha, hora y duración. Los pasos 1–3 vivirán inicialmente en el cliente; esta etapa no implementa el wizard. No incorpora HU-C-07 ni HU-C-17, no agrega navegación desde listado/detalle, y no modifica Prisma, seed ni migraciones.

### 1.1. Contrato antes/después y decisiones

| Punto | Antes | Después de etapa 1 |
|---|---|---|
| `ConfigurarTurnoSchema` | Fecha, hora, materia y duración; profesor ausente | Agrega `profesor_id: z.cuid()` obligatorio, sin alterar los otros campos ni coercionar la duración. Lo comparten POST y PATCH. |
| `configurarTurno()` | Persiste `profesorId: null` | Verifica materia activa y configuración operativa; profesor existente/activo, que dicte la materia, cobertura de su horario y ausencia de turno `DISPONIBLE`/`COMPLETO` superpuesto; inserta `PENDIENTE` con `profesorId`. Aula/cupo permanecen `null`; no vincula alumnos ni crea reservas de recursos. |
| `POST /api/turnos` | `201` sin `profesor_id`; errores del profesor no contemplados | Mantiene `turnos:crear` y `{data,error}`; `201` incluye `profesor_id`; `400 VALIDATION_ERROR` para schema, `404 PROFESOR_NO_ENCONTRADO`, `409 PROFESOR_NO_DICTA_MATERIA` / `PROFESOR_FUERA_DE_HORARIO` / `PROFESOR_NO_DISPONIBLE`. No se crea ruta nueva. |
| Evento `turno:configurado` | Payload sin profesor | Agrega `profesor_id`, exigido por `spec_modulo_C.md` §2.1; se emite después del `INSERT`. |
| `PATCH .../configuracion` | Comparte schema pero no conoce `profesor_id`; podía desasignar profesor al cambiar materia | Adaptación mínima: recibe profesor obligatorio, lo revalida y persiste dentro de una misma transacción, registra `profesor_id` entre los campos modificados y deja de desasignarlo por cambio de materia. Conserva `updatedAtTurno` y las demás condiciones del `updateMany` como control optimista. Los errores nuevos se traducen en la ruta. No se implementa aún `aula_desasignada` ni la navegación «Atrás». |

La validación de profesor usa las funciones existentes de D `obtenerOpcionProfesorActivo()`, `profesorActivoDictaMateria()` y `estaDentroDeHorarioAtencion()`. **Frontera real verificada:** `src/server/profesores/profesor.publico.ts` no existe en `feature/HU-C-18`; las tres funciones están implementadas/exportadas en `profesor.service.ts`, desde donde Turnos las importa temporalmente. La spec de D §2.8 pide exponerlas por `profesor.publico.ts`; queda pendiente el handoff de D, sin copiar implementaciones ni modificar ese módulo en esta etapa. Turnos reutiliza `intervaloTurno()`, `horaDeMinutos()` y `profesoresConTurnoSuperpuesto()`, que a su vez usa `intervalosSeSuperponen()` de D. El helper de superposición acepta ausencia de id al evaluar un turno aún no creado; con id conserva la exclusión del propio turno. La consulta filtra **solo** `DISPONIBLE` y `COMPLETO`, por lo que `PENDIENTE` y `CANCELADO` no bloquean; los intervalos adyacentes no se superponen. No hay consulta directa desde Turnos a `HorarioProfesor` ni duplicación de su lógica.

La comprobación de profesor y el `INSERT` se ejecutan en una transacción. En el PATCH, `tx.turno.findUnique`, `profesorActivoDictaMateria(..., tx)`, `estaDentroDeHorarioAtencion(..., tx)`, la consulta de superposición y `tx.turno.updateMany` usan **el mismo `Prisma.TransactionClient`**; el evento se emite después. `obtenerOpcionProfesorActivo()` se invoca dentro del callback, pero su firma vigente no acepta `tx` y usa su propia conexión; la verificación activa/asociación se repite con `profesorActivoDictaMateria(..., tx)`. `verificarMateriaActiva()` y la validación operativa existente se mantienen antes de la transacción, como en el servicio previo. El `PENDIENTE` no proyecta reservas según §3.2/§3.4; esta etapa no cambia los triggers.

**Límite pendiente de D:** aunque C pasa `tx` a `profesorActivoDictaMateria()`, la implementación real de esa función en `profesor.service.ts` usa `db.profesor.findFirst` y **todavía no hace `SELECT … FOR SHARE` sobre `profesor_materia`** como exige `spec_modulo_D.md` §2.8. La atomicidad de los pasos del PATCH en Turnos quedó corregida, pero la garantía de bloqueo de esa asociación depende del handoff D. No se implementó SQL directo ni una copia de la lógica de D en Turnos.

### 1.2. Archivos modificados y pruebas

- `src/server/turnos/turno.schema.ts`: `profesor_id` requerido.
- `src/server/turnos/turno.service.ts`: validación reutilizable de profesor para configuración, alta con profesor, respuesta/evento y PATCH transaccional con control optimista.
- `src/server/turnos/turno.disponibilidad.ts`: el helper existente permite turno sin id para el alta; conserva exclusión propia cuando hay id.
- `src/app/api/turnos/route.ts`: validación y traducción HTTP del POST, con permiso y shape existentes.
- `src/app/api/turnos/[id]/configuracion/route.ts`: traducción de errores del profesor en PATCH.
- `src/server/turnos/turno.configuracion.test.ts`: schema, alta, rechazos de profesor, estados bloqueantes, contigüidad, evento, duración, materia y PATCH compartido; test con cliente transaccional distinto del `prisma` raíz que prueba que lectura, asociación, horario, solapamiento y `updateMany` comparten `tx`.
- `src/app/api/turnos/route.test.ts` (nuevo): contrato HTTP `201`, `profesor_id` obligatorio, permiso y errores del profesor.
- Este documento registra el alcance, las decisiones, la evidencia y los pendientes.

**Evidencia de la corrección de revisión:** `npx.cmd vitest run src/server/turnos/turno.configuracion.test.ts src/app/api/turnos/route.test.ts src/server/turnos/turno.participantes.test.ts src/server/turnos/turno.profesor.test.ts` → **57 tests OK, 4 archivos** (configuración/POST y regresión participantes/profesor). `npx.cmd tsc --noEmit` → **OK**. En PowerShell se usó `npx.cmd` porque `npx.ps1` está bloqueado por la política local. Vitest necesitó ejecutarse fuera del sandbox porque allí no pudo leer `vitest.config.mjs`.

### 1.3. Criterios habilitados y pendientes

- **AC1/AC3, base backend:** el POST ya puede crear el `PENDIENTE` con Profesor persistido al terminar Fecha/Horario; la elección y el wizard visual siguen pendientes. El paso 5 sigue siendo la operación de confirmación, sin cambiar en esta etapa el contrato legacy de participantes que permite enviar profesor para un `PENDIENTE` antiguo.
- **AC2:** se conserva la validación existente de materia, fecha, hora y duración; no se movieron controles de UI todavía.
- **AC4:** PATCH acepta el schema compartido con profesor y no lo desasigna por cambio de materia. Quedan pendientes la desasignación del aula en conflicto (`aula_desasignada: true`), el contrato completo de «Atrás» y sus tests.
- **AC5/AC6:** sin reabrir las HU de Sprint 1 ni implementar generación masiva. Materia/Profesor compartidos y el modo de C-17 siguen pendientes del frontend.
- **Dependencia C-07:** los endpoints Materia → Profesor y Profesor + duración → disponibilidad aún no están en esta rama. No se incorporó código de `feature/HU-C-07`; su contrato público será necesario para la integración final de pasos 2 y 3.

**Divergencias temporales de integración:** la pantalla fusionada actual `/turnos/nuevo` y su edición todavía no envían `profesor_id`, por lo que el schema nuevo rechazará esas solicitudes con `400` hasta que el wizard/frontend se adapte. No se modificó frontend en esta etapa por decisión expresa. El PATCH actual aún no informa ni ejecuta `aula_desasignada` ante conflicto de una configuración cambiada; se tratará en una etapa posterior de C-18. La frontera `profesor.publico.ts` y el `FOR SHARE` del helper de asociación siguen pendientes del handoff D, como se detalla arriba. Se conservó el flujo legacy de participantes y no se migraron turnos antiguos. La divergencia histórica de 3 SP en `HU-Sprint-2.md` permanece documentada en §0.8; el valor de trabajo aprobado es 5 SP.

**Estado de etapa 1:** la implementación propia de HU-C-18 está completada; 57 tests específicos y de regresión OK, y `npx.cmd tsc --noEmit` OK. Queda una **dependencia externa pendiente del módulo D**: publicar la frontera `profesor.publico.ts` y garantizar `profesorActivoDictaMateria(..., tx)` con `SELECT … FOR SHARE` sobre `profesor_materia`. No se modifica D desde HU-C-18. Cuando D entregue ese contrato, C-18 deberá integrar la frontera pública y ejecutar nuevamente la regresión de configuración, POST y participantes. **HU-C-18 no puede considerarse Done hasta completar esa integración y regresión**, además de las etapas propias restantes del wizard.

---

## 2. Etapa 2 — estructura visual y navegación base del wizard individual

**Alcance:** `/turnos/nuevo` deja de renderizar el formulario fusionado y presenta el shell de cinco pasos Materia → Profesor → Fecha y horario → Aula → Alumnos. La captura aprobada guía jerarquía, progreso, columnas, resumen y navegación; backlog/spec rigen comportamiento. Esta etapa no completa el alta ni persiste turnos: queda bloqueada funcionalmente en Profesor hasta integrar C-07. No implementa C-17, no modifica D ni las reglas backend de etapa 1, y no toca Prisma, seed, migraciones o `aula_desasignada`.

### 2.1. Gate de dependencias y arquitectura elegida

Antes de editar se confirmó que `GET /api/turnos/configuracion` ya devuelve `{ materias: [{id,nombre,codigo}], parametros }` con `turnos:crear`. El wizard usa **solo** ese GET para materias activas; no mueve la carga de materias ni las validaciones de negocio a frontend. En esta rama todavía no existen los endpoints C-07 `profesores/por-materia` y `[profesorId]/disponibilidad`, ni `profesor.publico.ts` de D; el GET de opciones de aula de C-16 sí está disponible. Se revisaron `docs/DESIGN.md`, `Breadcrumb`, `Button`, `Input` y el patrón visual de `StepperAltaProfesor`; las clases usan tokens (`primary`, `card`, `border`, `muted`, `ring`) sin colores hardcodeados. Se leyó la guía de páginas de la versión instalada de Next antes de cambiar `/turnos/nuevo`.

`TurnoWizard` mantiene un `paso` explícito (1–5) y una selección local con `materiaId`, `profesorId`, `duracionMin`, `fecha`, `horaInicio`, `aulaId` y `alumnoIds`; ninguno se persiste en esta etapa. Renderiza encabezado, selector de modo, progreso, contenido, acciones y resumen. Se eligió una estructura simple sin máquina de estados. `PasoMateriaTurno` y `PasoProfesorTurno` son componentes compartibles: reciben opciones, selección y callback por props; C-17 podrá reutilizarlos sin acoplar su flujo masivo al wizard individual. `ProgresoTurno` y `ResumenTurno` se separaron porque son unidades visuales reales del shell. El selector «Generar varios turnos» se muestra deshabilitado: no abre una ruta ficticia ni inicia una generación parcial.

### 2.2. Comportamiento disponible y pendiente

| Paso | Etapa 2 | Próxima integración |
|---|---|---|
| 1. Materia | Carga materias activas reales, muestra selección accesible, habilita Continuar solo con materia elegida y la refleja en Resumen. Carga fallida admite Reintentar. | Mantener origen de materias compartido con C-17. |
| 2. Profesor | Presentación reutilizable preparada para opciones por props. En runtime no recibe opciones ni llama endpoints inexistentes; informa que no puede consultar profesores y Continuar permanece deshabilitado. Atrás conserva Materia. | C-07 §2.8.1 aportará profesores de la materia; el flujo legacy `profesores/opciones?turno_id=` no se usa en el alta. |
| 3. Fecha y horario | Lugar estructural y estado `duracionMin`, `fecha`, `horaInicio` vacíos; no hay duración preseleccionada, calendario falso ni cálculo local de disponibilidad. | C-07 §2.8.2 aportará fechas e inicios reales; duración se elegirá primero, luego `POST /api/turnos` creará el `PENDIENTE` con profesor. |
| 4. Aula | Lugar estructural, sin GET/PATCH todavía. | Consumir C-16 con `turno_id` real después del POST; reutilizar `SeccionAulaTurno` y hacer efectivo el regreso a Fecha/Horario si `data: []`. |
| 5. Alumnos | Lugar estructural, sin búsqueda ni PATCH todavía. | Reutilizar `BuscadorAlumnos`; `PATCH .../participantes` confirma con profesor persistido. |

El indicador muestra los cinco nombres en orden, `aria-current="step"` y estados visuales completado/actual/futuro. No permite saltar a pasos futuros; Atrás solo mueve el paso actual y conserva las elecciones. El resumen usa «Sin elegir» para los campos vacíos y muestra Materia/Profesor cuando existe una selección. En escritorio queda en columna lateral; en pantallas estrechas pasa debajo del contenido, sin ocultar información. El shell no implementa aún las invalidaciones completas de AC4.

### 2.3. Archivos y convivencia legacy

**Nuevos:**

- `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx`: estado local, carga de materias, pasos y navegación.
- `src/app/(dashboard)/turnos/nuevo/progreso-turno.tsx`: stepper de cinco pasos.
- `src/app/(dashboard)/turnos/nuevo/resumen-turno.tsx`: panel lateral progresivo.
- `src/app/(dashboard)/turnos/paso-materia-turno.tsx` y `paso-profesor-turno.tsx`: componentes reutilizables por los modos individual y futuro masivo.
- `src/app/(dashboard)/turnos/nuevo/turno-wizard.test.tsx`: pruebas de página, shell, resumen, navegación y ausencia de requests/persistencia prematuros.

**Modificados:**

- `src/app/(dashboard)/turnos/nuevo/page.tsx`: renderiza `TurnoWizard`.
- `src/app/(dashboard)/turnos/turno-configuracion.tsx` y su test: adaptación acotada de la **edición legacy**. Para un `PENDIENTE` que ya tiene profesor, reenvía su `profesor_id` en el PATCH compartido. Para uno antiguo sin profesor, usa únicamente el endpoint legacy `profesores/opciones?turno_id=` en esa pantalla de edición, permite elegir profesor antes de cambiar su configuración y sigue permitiendo asignar solo el aula sin profesor. No se transformó esa pantalla en wizard; `/turnos/[id]/configuracion` y `/turnos/[id]/participantes` permanecen.
- Este documento: decisiones, evidencia y pendientes.

No se modificaron `urlContinuar()`, listado ni detalle; no se agregó reanudación de `PENDIENTE` desde ellos. La ruta legacy de profesores **solo** se usa en la edición antigua, nunca en `/turnos/nuevo`. Si no hay opciones para el horario antiguo o la consulta falla, la pantalla muestra el aviso y no puede guardar cambios de configuración que ahora requieren `profesor_id`; puede seguir asignando aula sin alterar los datos base. Es una limitación real del contrato compartido hasta que la edición legacy reciba una solución específica, sin introducir datos falsos ni cambiar el backend aprobado.

**Limitaciones temporales no bloqueantes de esta etapa:**

1. La edición legacy de un `PENDIENTE` sin profesor obtiene `profesores/opciones?turno_id=` contra la configuración **persistida**. Si se cambia localmente materia, fecha, hora o duración, esas opciones pueden quedar desactualizadas; el backend revalida y puede responder `409`. No se amplía el flujo legacy en etapa 2: el wizard nuevo resolverá esta interacción al integrar HU-C-07.
2. Un `PENDIENTE` legacy que ya tiene profesor reenvía `profesor_id` al PATCH. Esa pantalla no implementa el cambio coordinado Materia → nuevo Profesor de AC4; queda para el flujo nuevo. No se agregó en etapa 2.

### 2.4. Evidencia y matriz de dependencias

**Pruebas de etapa:** `npx.cmd vitest run --silent=true 'src/app/(dashboard)/turnos/nuevo/turno-wizard.test.tsx' 'src/app/(dashboard)/turnos/turno-configuracion.test.tsx' 'src/app/(dashboard)/turnos/[id]/participantes/participantes-turno.test.tsx' 'src/app/(dashboard)/turnos/turnos-listado.test.tsx'` → **29 tests OK, 4 archivos**, incluida la regresión final posterior a la adaptación legacy. En el cierre documental, el test específico del wizard volvió a pasar (**4 tests OK**) y `npx.cmd tsc --noEmit` → **OK**. `git diff --check` → **OK** para archivos seguidos (Git solo avisó sobre conversión LF/CRLF); revisión independiente de whitespace de los **8 archivos nuevos/sin seguimiento** → **OK**. Los tests verifican página nueva, orden, paso inicial, selección real de Materia, resumen, Atrás, bloqueo sin datos, ausencia de llamadas a C-07, ruta legacy desde el alta y POST/PATCH prematuros. `--silent=true` suprime las advertencias de `act`/`prefetch` de los mocks existentes de los tests legacy; en la corrida previa sin esa opción también pasaron los 29 tests.

| Dependencia | Estado para C-18 | Efecto |
|---|---|
| HU-C-07 | Funcional, pendiente de integración; código ausente en esta rama | Bloquea pasos 2 y 3 reales y el cierre de C-18. No se incorporó código de su rama. |
| HU-C-16 | Funcional, satisfecha en esta rama | Su GET de aula y estado vacío se consumirán en el paso 4 cuando exista `turno_id`. No se duplicó su lógica. |
| HU-C-03/C-04/C-15 | Históricas, Done | Contratos y pantallas legacy se conservan; no bloquean esta estructura. |
| Módulo D / `profesor.publico.ts` | Dependencia técnica pendiente del handoff | Etapa 1 importa temporalmente `profesor.service.ts`; faltan frontera pública y `FOR SHARE` del contrato D. No se modificó D. |
| HU-C-17 | Downstream; no bloquea C-18 | Reutilizará Materia/Profesor; modo masivo no se implementó. |

**Estado de etapa 2:** implementación propia completada y revisada; integración funcional de Profesor/Fecha-Horario pendiente de HU-C-07; rama todavía no mergeable. HU-C-18 sigue abierta por C-07, D y el resto del flujo individual.
