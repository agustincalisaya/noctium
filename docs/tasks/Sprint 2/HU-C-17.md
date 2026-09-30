
# TASK: HU-C-17 — Generar turnos a partir del horario del profesor

**Módulo:** C (Gestionar turnos)

**Sprint:** 2

**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.9 (Revisión 5) ·
`docs/tasks/Sprint 2/HU-Sprint-2.md` HU-C-17 ·
`Documento_Sprint_2_Developers.pdf` ·
HU-C-07 · HU-C-16 · HU-D-04 · HU-C-03 · HU-C-12

**RBAC:** `turnos:crear`, existente.

**Schema:** no requiere cambios en `schema.prisma`. Sí requiere una migración de datos nueva
para incorporar `generacion_maxima_meses = 6` en `ParametroSistema` y actualizar `seed.ts`;
no se modifican migraciones ya aplicadas.

**Estimación:** **8 SP según el documento de organización del Sprint 2/backlog del 28/09**.
El Kanban informado durante el relevamiento indica 5 SP; se deja registrada la divergencia
administrativa. No modifica el alcance funcional de esta task.

**Estado:** diseño y relevamiento técnico aprobados como base de implementación. HU-C-18 y el
wizard individual están cerrados y mergeados; HU-C-17 todavía no está implementada.

---

## 0. Relevamiento técnico aprobado sobre el estado actual de develop

### 0.1. Wizard y contratos disponibles

- HU-C-18 y el wizard individual de `/turnos/nuevo` están cerrados y mergeados. El selector
  `Turno individual | Generar varios turnos` ya se muestra, pero «Generar varios turnos»
  está deshabilitado. No existe aún flujo recurrente ni rutas de generación.
- `PasoMateriaTurno` y `PasoProfesorTurno` reciben datos y callbacks por props y se reutilizan
  directamente, sin versiones paralelas. El listado inicial de profesores del wizard usa
  `GET /api/turnos/profesores/opciones-wizard?materia_id=`: ofrece profesores activos que
  dictan la materia y tienen horarios, con sus franjas. `por-materia` conserva su contrato
  C-07, que incluye profesores aunque no tengan horarios; no se cambia para C-17.
- El Módulo D ya expone `obtenerHorariosDeAtencion(profesorId, db?)` y
  `obtenerHorarioDeProfesor(profesorId, horarioId, db?)`, con `horario_id`, `dia_semana`,
  `hora_inicio` y `hora_fin`. C-17 usa esos contratos, sin consultar `horarios_profesor`.
- C-07 aporta `iniciosPosibles()`, `intervaloTurno()`, `aulaConTurnoSuperpuesto()` y
  `profesoresConTurnoSuperpuesto()`, además de los estados que reservan: `DISPONIBLE` y
  `COMPLETO`. `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]` es la lista autoritativa.
  La agenda individual recorta a `anticipacion_maxima_dias`; no sirve como preview de seis
  meses y su contrato permanece intacto.
- C-16 ofrece `GET /api/turnos/aula/opciones` sin `turno_id` para listar aulas activas.
  La variante con `turno_id` filtra por una fecha/hora de un `PENDIENTE` y no corresponde a
  una corrida recurrente. El GET exige `turnos:asignar_aula`, permiso que el seed asigna a
  Mesa de Entrada junto con `turnos:crear`; las tres rutas nuevas de §4 usan `turnos:crear`.
- `reservas_turno`, el trigger `turno_sincronizar_reservas`, la exclusión GiST y
  `esConflictoDeReserva()` ya existen. No se agrega advisory lock. Existen
  `emitirEventoTurno()` y `emitirEventosTurno()`; el lote requiere ampliar su tipado para
  los tres eventos de C-17, no crear una infraestructura nueva.
- HU-C-12 está contractualizada en la spec, pero el autoservicio y
  `inscribirAlumnoEnTurno()` aún no están implementados en esta rama. Su ausencia no bloquea
  el desarrollo de C-17; la integración real C-17 → C-12 queda pendiente de verificación
  y es necesaria antes de cerrar el DoD conjunto.

### 0.2. Parámetros y archivos previstos

`ParametroSistema` es clave/valor y no requiere cambiar `schema.prisma`. El seed y una
migración ya aplicada registran `generacion_maxima_dias = 150` y
`generacion_maxima_turnos = 40`, pero no `generacion_maxima_meses = 6`. Incorporar esta
última clave mediante **una migración de datos nueva** y actualizar `prisma/seed.ts`; no
editar migraciones existentes ni ejecutar seed o `migrate reset` sobre una base compartida.
El límite de C-17 son seis meses calendario y 40 turnos, sin usar
`ANTICIPACION_MAXIMA_DIAS` ni el antiguo valor de 150 días.

**Existentes a modificar:** `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx` para habilitar
el modo y compartir Materia/Profesor sin usar las mutaciones individuales;
`progreso-turno.tsx` y `resumen-turno.tsx` para presentar los pasos y el resumen recurrentes;
`src/app/(dashboard)/turnos/seccion-aula-turno.tsx` solo para adaptar la presentación de sus
tarjetas al modo recurrente; `src/server/turnos/turno.publico.ts` para ampliar el tipado del
lote de eventos; `prisma/seed.ts` y los tests afectados. `PasoMateriaTurno` y
`PasoProfesorTurno` se consumen tal como están. No se modifican los contratos C-07, C-16
ni los del wizard individual.

**Nuevos:** `src/server/turnos/turno.generacion.service.ts`, schema de generación en la
capa de Turnos (`src/server/turnos/turno.generacion.schema.ts`), una migración de datos
nueva y estos Route Handlers:

- `src/app/api/turnos/profesores/[profesorId]/franjas/route.ts`;
- `src/app/api/turnos/generacion/vista-previa/route.ts`;
- `src/app/api/turnos/generacion/route.ts`.

También se agregan componentes recurrentes bajo `src/app/(dashboard)/turnos/nuevo/` y
sus tests unitarios, de API, frontend y PostgreSQL aislado. Los nombres internos de los
componentes visuales se fijan al implementar cada fase; no se agrega una página ni un
ítem de menú.

---

## 1. Nota de alcance y decisiones vigentes

### 1.1. Ubicación del flujo

HU-C-17 no crea una pantalla ni un ítem de menú nuevo.

Vive en:

`/turnos/nuevo`

detrás del control:

`Turno individual | Generar varios turnos`

El modo masivo reutiliza directamente los componentes y orígenes de Materia y Profesor.
Desde el tercer paso (Franja) tiene un flujo independiente del alta individual. No llama
al `POST /api/turnos` ni a los `PATCH` de configuración, aula o participantes del camino
`PENDIENTE` para generar recurrentes.

### 1.2. Orden del modo masivo

1. Materia.
2. Profesor.
3. Franja recurrente.
4. Duración.
5. Hora de inicio.
6. Aula.
7. Rango Desde–Hasta.
8. Vista previa.
9. Confirmación.

Cambiar Materia o Profesor invalida las selecciones dependientes que ya no sean válidas.
Volver de paso por sí solo no borra datos ni escribe; cambiar cualquier dato de la corrida
invalida su vista previa.

### 1.3. Horario del profesor y materia

`HorarioProfesor` no tiene `materiaId`.

La relación con la materia se garantiza así:

1. se selecciona una Materia activa;
2. Profesor reutiliza `opciones-wizard` para ofrecer profesores activos que dictan esa
   materia y tienen horarios registrados;
3. se obtienen las franjas recurrentes del profesor seleccionado;
4. el endpoint de franjas recibe también `materia_id` para revalidar
   `PROFESOR_NO_DICTA_MATERIA`.

`materia_id` no filtra filas de `HorarioProfesor`. Se conserva sin cambios el endpoint
`por-materia` de C-07, cuyo listado puede incluir profesores sin horarios.

### 1.4. Divergencia backlog/spec sobre el estado inicial

El criterio de Kanban recibido durante el relevamiento expresa que los turnos generados
nacen `PENDIENTE`.

El contrato posterior de `spec_modulo_C.md` Revisión 5 y el documento de organización del
Sprint 2 establecen que HU-C-17 crea turnos directamente:

`DISPONIBLE` con `0/N` alumnos.

Esta task adopta el contrato vigente de Revisión 5:

- no pasan por `PENDIENTE`;
- `cupoMaximoTurno = capacidad del aula`;
- profesor y aula quedan reservados desde el `INSERT`;
- podrán recibir inscripciones mediante HU-C-12 desde que ese autoservicio esté implementado.

Un cambio futuro de este estado inicial requiere actualizar primero el contrato.

### 1.5. Límites de generación

- `fecha_desde >= hoy`.
- Máximo: `generacion_maxima_meses = 6` meses calendario.
- Máximo: `generacion_maxima_turnos = 40` instancias por corrida.
- No aplica `ANTICIPACION_MAXIMA_DIAS`.
- Si no existe ninguna fecha generable: `SIN_FECHAS_EN_RANGO`.
- Una fecha de hoy cuya hora ya pasó se omite y se cuenta en
  `fechas_omitidas_vencidas`.

### 1.6. Atomicidad

La generación es **todo o nada**.

Si una sola fecha presenta conflicto al confirmar, no se crea ningún turno de la corrida.

---

## 2. Historia de usuario

**Como** Personal de mesa de entrada,

**necesito** generar automáticamente los turnos de un profesor para un rango de fechas,
a partir de su horario recurrente,

**para** crear en un solo paso las clases repetidas de un cuatrimestre sin configurarlas
una por una.

---

## 3. Criterios de aceptación contractualizados

### AC1 — Datos y orden del flujo

Solicitar en orden:

Materia → Profesor → Franja → Duración → Hora de inicio → Aula → Desde/Hasta.

Profesor se filtra por la materia elegida.

La franja pertenece al profesor y proviene de HU-D-04. El listado inicial de profesores
reutiliza `GET /api/turnos/profesores/opciones-wizard?materia_id=`.

Duración admite exclusivamente 60, 120 o 180 minutos.

La hora de inicio puede ser cualquier inicio válido dentro de la franja, alineado a la
granularidad vigente; no queda fijada al inicio de esa franja.

### AC2 — Encaje en la franja

Debe cumplirse:

`franja.inicio <= hora_inicio`

y:

`hora_inicio + duracion_min <= franja.fin`

además de respetar `GRANULARIDAD_MINUTOS`.

Caso inválido:

`400 FUERA_DE_FRANJA`.

### AC3 — Tramo sobrante

Generar, por ejemplo, 16:00–18:00 dentro de una franja 15:00–19:00 no modifica
ni recorta el `HorarioProfesor`.

La franja recurrente permanece intacta.

Los tramos 15:00–16:00 y 18:00–19:00 pueden utilizarse posteriormente si las
fechas concretas no presentan otros conflictos.

### AC4 — Un aula por corrida

`aula_id` es único para toda la generación.

No existe una selección de aula por fecha individual.

Cambiar de aula cambia la elección para toda la corrida y obliga a solicitar nuevamente
la vista previa.

### AC5 — Fechas y disponibilidad

A partir del rango se calculan todas las fechas que:

- están entre Desde y Hasta;
- corresponden al día de semana de la franja;
- son días operativos;
- no representan una ocurrencia ya vencida del día actual.

Cada fecha se valida individualmente contra el intervalo real del turno.

Conflictos:

- `AULA_OCUPADA`
- `PROFESOR_OCUPADO`
- `TURNO_EXISTENTE`

`TURNO_EXISTENTE` tiene precedencia cuando la fecha ya contiene un turno no cancelado
del mismo profesor y materia superpuesto.

La validación visible de aula se resuelve cambiando el aula global o acotando el rango.

Profesor ocupado requiere cambiar hora/franja/rango.

### AC6 — Vista previa y todo-o-nada

Antes de confirmar se muestra:

- cantidad total;
- todas las fechas calculadas;
- horario;
- aula;
- estado por fecha;
- motivo explícito de los conflictos.

La vista previa no persiste nada.

Si `hay_conflictos === true`, la confirmación queda bloqueada.

No se crean solamente las fechas libres ignorando las conflictivas.

### AC7 — Confirmación

Al confirmar una corrida sin conflictos se crea un `Turno` por cada fecha con:

- materia;
- profesor;
- aula;
- fecha;
- hora;
- duración;
- `cupoMaximoTurno = capacidad del aula`;
- `prioridadTurno = NORMAL`;
- `estadoTurno = DISPONIBLE`;
- 0 alumnos;
- usuario creador;
- fecha de creación.

La respuesta informa `generacion_id`, cantidad creada e ids de turnos.

### AC8 — Excepciones del profesor

Este flujo no implementa licencias ni excepciones puntuales del horario recurrente.

Si posteriormente el profesor no puede dictar una instancia generada, esa instancia se
cancela individualmente mediante HU-C-05.

No se altera el horario recurrente ni los demás turnos de la corrida.

### AC9 — Ejecución manual

No existe cron, worker ni proceso automático.

La vista previa y la confirmación son acciones explícitas de una persona autorizada.

### AC10 — Acceso

El acceso es exclusivamente desde `/turnos/nuevo`, mediante el selector de modo.

No se agrega:

- ruta de página independiente;
- opción nueva del menú;
- duplicado de los componentes Materia/Profesor.

---

## 4. Contrato backend

### 4.1. Schema

Contrato esperado:

```ts
{
  materia_id: string;
  profesor_id: string;
  horario_id: string;
  duracion_min: 60 | 120 | 180;
  hora_inicio: string;
  aula_id: string;
  fecha_desde: string;
  fecha_hasta: string;
}
```

El schema debe ser `strict` y reutilizar la constante autoritativa de duraciones
`[60, 120, 180]`; la UI obtiene esas opciones de la configuración existente.

`fecha_desde <= fecha_hasta`.

### 4.2. Endpoint de franjas

`GET /api/turnos/profesores/[profesorId]/franjas?materia_id=...`

Esta ruta nueva cumple el contrato explícito de §2.9. Aunque `opciones-wizard` ya entrega
las franjas para la tarjeta inicial de Profesor, el GET revalida al profesor y su relación
con `materia_id` al entrar en la selección recurrente. Usa el contrato público del Módulo D.

Permiso:

`turnos:crear`

Respuesta:

```json
{
  "data": [
    {
      "horario_id": "...",
      "dia_semana": "JUEVES",
      "hora_inicio": "15:00",
      "hora_fin": "19:00"
    }
  ],
  "error": null
}
```

`materia_id` sirve para revalidar la relación profesor–materia, no para filtrar
`HorarioProfesor`.

Profesor sin horarios:

`200 { data: [], error: null }`

Mensaje de UI:

`Este profesor no tiene horarios de atención registrados`

### 4.3. Vista previa

`POST /api/turnos/generacion/vista-previa` (`turnos:crear`)

No ejecuta escrituras de turnos, reservas ni eventos.

Debe ejecutar el cálculo completo:

- entidades válidas;
- franja;
- duración/hora;
- rango;
- fechas;
- aula;
- profesor;
- duplicados.

Respuesta conceptual:

```json
{
  "data": {
    "cantidad": 8,
    "fechas": [
      {
        "fecha": "2026-10-01",
        "estado": "OK",
        "motivos": []
      },
      {
        "fecha": "2026-10-08",
        "estado": "CONFLICTO",
        "motivos": ["AULA_OCUPADA"]
      }
    ],
    "hay_conflictos": true,
    "fechas_omitidas_vencidas": 0
  },
  "error": null
}
```

### 4.4. Confirmación

`POST /api/turnos/generacion` (`turnos:crear`)

Dentro de una única `prisma.$transaction`:

1. Recalcular completamente la generación.
2. No confiar en las fechas recibidas o mostradas previamente al cliente.
3. Si existe conflicto:
   `409 GENERACION_CON_CONFLICTOS`.
4. Sin conflictos:
   crear todos los turnos.
5. Cada `INSERT` crea el turno directamente `DISPONIBLE`.
6. El trigger existente reserva profesor y aula.
7. Si PostgreSQL rechaza una reserva concurrente con `23P01`, revertir la transacción
   completa y traducir a `GENERACION_CON_CONFLICTOS`.
8. Nunca dejar una generación parcialmente persistida.

No se reutilizan el `POST /api/turnos` ni los `PATCH` del wizard individual: esos contratos
crean o modifican un `PENDIENTE`. La respuesta exitosa entrega un `generacion_id` común,
cantidad creada e ids de todos los turnos.

No se agrega advisory lock.

### 4.5. Eventos

Después del commit, en un único lote sobre `eventos_turno`, por cada turno:

- `turno:configurado`, incluyendo `generacion_id`;
- `turno:aula_asignada`;
- `turno:disponibilizado`, con `alumno_ids: []`.

Todos los payloads de `turno:configurado` de la corrida comparten `generacion_id`. Usar
`emitirEventosTurno()` ampliando su tipado para estos eventos, sin crear otra
infraestructura. Guardar `creadoPorUsuarioId` y `createdAtTurno` en cada fila al insertar.

### 4.6. Errores esperados

Validación / dominio:

- `VALIDATION_ERROR` (payload inválido)
- `FUERA_DE_FRANJA`
- `RANGO_EXCEDIDO`
- `SIN_FECHAS_EN_RANGO`
- `MATERIA_NO_DISPONIBLE`
- `PROFESOR_NO_ENCONTRADO`
- `PROFESOR_NO_DICTA_MATERIA`
- `HORARIO_NO_ENCONTRADO`
- `SIN_AULAS_ACTIVAS`
- `AULA_NO_ENCONTRADA`
- `AULA_INACTIVA`
- `GENERACION_CON_CONFLICTOS`

Los motivos por fecha de una vista previa no son errores HTTP:

- `AULA_OCUPADA`
- `PROFESOR_OCUPADO`
- `TURNO_EXISTENTE`

---

## 5. Frontend

La referencia visual puede tomar el mockup provisto, pero cuando el mockup contradiga
la spec prevalece la spec.

La pantalla debe:

1. habilitar la opción «Generar varios turnos» del control existente;
2. reutilizar Materia y Profesor del modo individual;
3. ofrecer las franjas recurrentes del profesor;
4. permitir únicamente 60, 120 o 180 minutos;
5. recalcular inicios válidos según franja y duración;
6. permitir una sola aula;
7. solicitar Desde/Hasta;
8. ejecutar la vista previa solo por acción explícita;
9. representar todas las fechas y sus conflictos;
10. deshabilitar Confirmar ante cualquier conflicto;
11. invalidar la preview si el usuario modifica un dato del formulario;
12. tras éxito informar:
    `Se generaron N turnos correctamente`.

No implementar en cliente reglas de disponibilidad o superposición que pertenezcan al
servidor. El cliente presenta el cálculo recibido.

El stepper y el resumen requieren presentación parametrizada para este modo. Al alternar
modos no se deben disparar los `POST/PATCH` del wizard individual; desde Franja, los
controles recurrentes usan solo lectura, vista previa y confirmación de §4.

---

## 6. Testing

### Nivel 1 — unitario / servicio

Cubrir como mínimo:

- schema completo;
- 60/120/180 aceptados y otra duración rechazada;
- inicio al principio, dentro y al final permitido de una franja;
- duración que excede la franja;
- granularidad;
- tramo sobrante sin modificar la franja;
- cálculo de fechas por día semanal;
- rangos inclusivos;
- fecha de hoy ya vencida omitida;
- sin fechas generables;
- rango > 6 meses;
- cantidad > `generacion_maxima_turnos`;
- aula libre/ocupada en fechas diferentes;
- profesor ocupado;
- duplicado `TURNO_EXISTENTE`;
- precedencia de `TURNO_EXISTENTE`;
- contigüidad sin superposición;
- preview sin persistencia;
- confirmación sin conflicto;
- confirmación con un conflicto no crea ninguno.

### Nivel 2 — Route Handlers / API

Cubrir:

- permisos;
- bodies inválidos;
- franjas;
- profesor sin horarios;
- vista previa 200 con y sin conflictos;
- errores de entidades;
- `409 GENERACION_CON_CONFLICTOS`;
- `201` con cantidad e ids.

### Nivel 3 — PostgreSQL real

Verificar:

1. todos los turnos quedan `DISPONIBLE`;
2. todos quedan con 0 alumnos;
3. `cupoMaximoTurno` coincide con la capacidad del aula;
4. profesor y aula aparecen en `reservas_turno`;
5. auditoría de creación;
6. eventos por cada turno con el mismo `generacion_id`;
7. una corrida idéntica posterior se detecta;
8. una corrida parcialmente conflictiva no deja inserts;
9. una carrera real entre preview y confirmación provoca `23P01`, revierte todo y devuelve
   conflicto semántico;
10. intervalos contiguos siguen siendo válidos.

### Frontend

Cubrir:

- alternancia individual/masivo;
- Materia y Profesor compartidos;
- cambios que limpian dependencias;
- franja/duración/inicio;
- aula única;
- preview;
- tabla de fechas;
- textos de conflicto;
- Confirmar deshabilitado con conflictos;
- invalidación de preview al cambiar datos;
- éxito con cantidad creada.

### Integración obligatoria C-17 → C-12

HU-C-12 todavía no está implementada en esta rama. Esto no bloquea el desarrollo de
C-17 ni sus pruebas propias; la siguiente verificación queda pendiente hasta que exista
el autoservicio. No cerrar el DoD de integración únicamente con seed.

Crear al menos un turno mediante HU-C-17 y comprobar que HU-C-12 puede:

- encontrarlo;
- verlo `DISPONIBLE`;
- inscribir un alumno;
- mantener correctamente la transición `DISPONIBLE`/`COMPLETO` según cupo.

---

## 7. Plan de implementación por fases pequeñas

1. **Parámetro y contratos.** Incorporar `generacion_maxima_meses = 6` con una migración
   de datos nueva, actualizar seed, definir el schema `strict` y crear las tres rutas de
   §4 con `turnos:crear`. Probar validaciones, permisos y respuestas HTTP.
2. **Cálculo y vista previa.** Compartir helpers de intervalos/granularidad con C-07,
   enumerar fechas y aplicar límites, vigencia y conflictos por fecha con precedencia de
   `TURNO_EXISTENTE`. Probar que la preview devuelve todas las fechas sin escribir.
3. **Confirmación.** Recalcular dentro de una transacción, insertar directamente
   `DISPONIBLE 0/N`, verificar reservas y rollback ante un conflicto, y traducir `23P01`
   a `GENERACION_CON_CONFLICTOS`. Probar con PostgreSQL aislado, incluida concurrencia.
4. **UI recurrente.** Habilitar el selector, compartir Materia/Profesor, presentar Franja,
   Duración, Hora de inicio, Aula, Desde/Hasta, preview completa y confirmación. Probar
   invalidaciones, navegación, doble envío y regresión del wizard individual.
5. **Trazabilidad e integración.** Emitir los tres eventos por turno con un
   `generacion_id` común y verificar auditoría. Cuando C-12 esté implementada, crear un
   turno desde C-17 y verificar consulta, inscripción y transición por cupo de C-12.

Cada fase conserva los contratos C-07, C-16 y del wizard individual; no se extiende la
agenda C-07 de 30 días para resolver la preview recurrente de seis meses.

---

## 8. Fuera de alcance

- Aula distinta por fecha.
- Alumnos cargados durante la generación.
- Licencias o excepciones puntuales del profesor.
- Modificar el horario recurrente.
- Cron, job o generación automática.
- Nueva pantalla o ítem de menú.
- Reimplementar la lógica de disponibilidad de C-07.
- Consultar directamente tablas internas del Módulo D o K.
- Cambios de `schema.prisma` o de migraciones ya aplicadas. La migración de datos nueva y
  el ajuste de seed descritos en §0.2 sí forman parte de C-17.

---

## 9. Definition of Done

- [ ] Task revisada por el Scrum Master antes de implementar.
- [x] Relevamiento de §0 ejecutado sobre la rama posterior a HU-C-18.
- [ ] Archivos exactos a crear/modificar aprobados antes de escribir código.
- [ ] Contratos de Profesor disponibles y consumidos sin acceso directo a sus tablas.
- [ ] Cálculo compartido con C-07/C-06; sin implementación duplicada.
- [ ] `generacion_maxima_meses = 6` incorporado con migración de datos nueva y seed
      actualizado; `generacion_maxima_turnos = 40` verificado.
- [ ] Vista previa sin persistencia.
- [ ] Confirmación recalcula dentro de una única transacción.
- [ ] Atomicidad todo-o-nada comprobada.
- [ ] Turnos generados `DISPONIBLE 0/N`.
- [ ] Reservas de profesor y aula verificadas contra PostgreSQL.
- [ ] Conflictos concurrentes traducidos sin exponer error técnico.
- [ ] Eventos y auditoría verificados.
- [ ] Frontend conforme a `/turnos/nuevo`, sin pantalla adicional.
- [ ] Tests unitarios, API, frontend y PostgreSQL real aprobados.
- [ ] `tsc --noEmit`, lint y build aprobados.
- [ ] Integración real HU-C-17 → HU-C-12 verificada con un turno creado desde la UI
      cuando el autoservicio de C-12 esté implementado.
- [ ] Evidencia de implementación agregada a esta task.
- [ ] Sin `migrate reset` sobre base compartida.
- [ ] PR revisado y con diff acotado al alcance aprobado.

---

## 10. Estado antes de implementación

**HU-C-17 tiene el diseño y el relevamiento técnico aprobados; no está implementada.**
HU-C-18 y el wizard individual ya están cerrados y mergeados. El selector recurrente
existe, pero sigue deshabilitado. El contrato vigente fija generación directa en
`DISPONIBLE 0/N`; la referencia histórica de Kanban a `PENDIENTE` y 5 SP no modifica
ese contrato ni la estimación de 8 SP indicada al inicio de esta task.

La integración C-17 → C-12 sigue pendiente porque C-12 no está implementada en esta
rama. Esa dependencia no bloquea el desarrollo de las fases propias de C-17, pero sí
impide marcar como verificado el DoD de integración hasta probar un turno generado
desde este flujo y posteriormente inscripto mediante C-12.
