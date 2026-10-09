# TASK HU-C-07 — Mostrar horarios disponibles del profesor

**Módulo:** C — Gestionar turnos  
**Sprint:** 2  
**Estimación:** 2 SP  
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.8  
**Dependencia contractual:** `docs/specs/spec_modulo_D.md` §2.8  
**RBAC:** `turnos:crear`

---

## 0. Relevamiento previo a implementación

### Objetivo del relevamiento

Determinar los cambios necesarios para implementar HU-C-07 sin duplicar
lógica de disponibilidad ni acceder directamente a datos pertenecientes
al módulo Profesores.

La disponibilidad debe calcularse en servidor y reutilizarse posteriormente
por HU-C-17.

### Archivos existentes relevados

#### `src/server/turnos/turno.disponibilidad.ts`

Ya centraliza lógica compartida de disponibilidad de recursos.

Actualmente contiene:

- `ESTADOS_AGENDADOS = ["DISPONIBLE", "COMPLETO"]`.
- `intervaloTurno()`.
- `horaDeMinutos()`.
- `profesoresConTurnoSuperpuesto()`.
- `aulaConTurnoSuperpuesto()`.

Reutiliza `intervalosSeSuperponen()` del módulo Profesores.

No contiene todavía el cálculo de tramos libres ni la generación de
inicios posibles requerida por HU-C-07.

#### `src/server/profesores/profesor.publico.ts`

La spec del módulo D define como contrato público:

`obtenerHorariosDeAtencion(profesorId, db?)`

Retorno esperado:

`{ horario_id, dia_semana, hora_inicio, hora_fin }[]`

ordenado por día y hora.

Al momento del relevamiento, la búsqueda en `src/server` no encontró
`obtenerHorariosDeAtencion` ni `obtenerHorarioDeProfesor`.

Por lo tanto, la integración queda pendiente del handoff con el
responsable del módulo D. No se implementará una consulta directa a
`HorarioProfesor` desde Turnos.

### Archivos previstos a crear

A confirmar contra la estructura existente antes de implementar:

- Route Handler para consultar la disponibilidad del profesor según
  el contrato de `spec_modulo_C.md` §2.8.
- Tests específicos de HU-C-07, siguiendo el patrón de tests existente
  del módulo Turnos.

### Archivos previstos a modificar

#### `src/server/turnos/turno.disponibilidad.ts`

Agregar las funciones puras compartidas:

- `calcularTramosLibres(franja, ocupados)`
- `iniciosPosibles(tramo, duracion, granularidad)`

Estas funciones deben operar con minutos desde las 00:00 y conservar
el criterio único de intervalos semiabiertos:

`a1 < b2 && b1 < a2`

Los intervalos contiguos no se consideran superpuestos.

#### `src/server/turnos/turno.profesor.service.ts`

Incorporar o extender el servicio encargado de calcular la disponibilidad
del profesor para C-07, delegando:

- la obtención de horarios de atención al contrato público del módulo D;
- el cálculo puro de tramos/inicios a `turno.disponibilidad.ts`;
- la consulta de turnos ocupados al módulo Turnos.

#### UI del flujo `/turnos/nuevo`

Integrar la consulta de disponibilidad en el paso
“Elegir Fecha y Horario”.

La UI solo debe mostrar el resultado calculado por servidor; no debe
reimplementar el cálculo de disponibilidad.

El alcance exacto del componente a modificar se confirmará antes de
implementar, teniendo en cuenta que HU-C-18 posteriormente reordenará
el wizard completo.

### Reglas confirmadas

- `HorarioProfesor` representa un patrón semanal recurrente.
- El horario del profesor es independiente de la materia.
- Solo `DISPONIBLE` y `COMPLETO` reservan al profesor.
- `PENDIENTE` no bloquea disponibilidad.
- Los horarios contiguos no se superponen.
- La duración se expresa en minutos.
- Los inicios posibles respetan `GRANULARIDAD_MINUTOS`.
- El rango de fechas está limitado por `ANTICIPACION_MAXIMA_DIAS`.
- C-07 no reserva recursos.
- La fecha y hora seleccionadas deben revalidarse al confirmar el turno.
- HU-C-17 reutilizará el mismo cálculo de disponibilidad.
- El cálculo no debe duplicarse en React.

### Puntos pendientes antes de implementar

1. **Dependencia Módulo D — pendiente de integración**

   `src/server/profesores/profesor.publico.ts` todavía no existe en `develop`.

   La spec de Módulo D define el contrato público requerido:

   `obtenerHorariosDeAtencion(profesorId, db?)`

   con retorno:

   `{ horario_id, dia_semana, hora_inicio, hora_fin }[]`

   C-07 debe consumir ese contrato cuando esté disponible. No se realizará
   una consulta directa desde Turnos a `HorarioProfesor` ni se duplicará
   esta función dentro del módulo C.

2. **Relevamiento técnico de tests**

   Antes de implementar se revisará el patrón de tests existente de
   `turno.profesor.service.ts`, Route Handlers y componentes del wizard
   para ubicar la cobertura de C-07 sin crear estructuras paralelas.

### Contratos confirmados durante el relevamiento

#### Paso 2 — profesores por materia

Ruta:

`GET /api/turnos/profesores/por-materia?materia_id=`

Servicio:

`turno.profesor.service.ts -> listarProfesoresPorMateria()`

Permiso:

`turnos:crear`

No filtra por horario. La disponibilidad se aplica en el paso 3.

#### Paso 3 — disponibilidad del profesor

Ruta:

`GET /api/turnos/profesores/[profesorId]/disponibilidad?materia_id=&duracion_min=&desde=&hasta=`

Servicio:

`turno.profesor.service.ts -> calcularDisponibilidadProfesor()`

Permiso:

`turnos:crear`

Query:

- `materia_id`: obligatorio.
- `duracion_min`: 60, 120 o 180 minutos.
- `desde`: opcional; por defecto hoy.
- `hasta`: opcional; por defecto y como máximo
  `hoy + ANTICIPACION_MAXIMA_DIAS`.

La respuesta contiene:

- profesor;
- duración;
- rango efectivo;
- fechas con disponibilidad;
- franjas y horas de inicio posibles.

Las fechas sin horas posibles se omiten.

#### Parámetros

- `GRANULARIDAD_MINUTOS`: `ParametroSistema`,
  clave `granularidad_turno_minutos`, seed `30`.
- `ANTICIPACION_MAXIMA_DIAS`: `ParametroSistema`,
  clave `anticipacion_maxima_dias`, seed `30`.
- `DURACIONES_PERMITIDAS_TURNO_MIN`: constante en
  `turno.schema.ts`, actualmente `[60, 120, 180]`.

#### Integración UI confirmada

C-07 vive dentro de `/turnos/nuevo`.

En el paso 3:

1. se elige duración;
2. se consulta disponibilidad;
3. se elige fecha;
4. se elige hora de inicio.

El cálculo pertenece al servidor. React solamente consume y presenta
la disponibilidad devuelta.

El `POST /api/turnos` se realiza al confirmar el paso 3.
### Relevamiento técnico del frontend existente

Se relevaron:

- `src/app/(dashboard)/turnos/turno-configuracion.tsx`
- `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`

#### Estado actual

`TurnoConfiguracion` implementa actualmente la pantalla fusionada de
HU-C-03 + HU-C-15.

Todavía no existe en este componente el wizard definitivo:

Materia → Profesor → Fecha y horario → Aula → Alumnos.

La reorganización completa del flujo corresponde a HU-C-18.

Actualmente el componente calcula en cliente las horas posibles mediante
`opcionesDeHora()`, utilizando:

- horario operativo;
- granularidad;
- duración;
- fecha actual.

Ese cálculo no contempla todavía el horario recurrente del profesor ni
sus turnos `DISPONIBLE` / `COMPLETO`.

Para HU-C-07 ese cálculo local no será la fuente de verdad de
disponibilidad. La disponibilidad real debe provenir del contrato de
servidor definido en `spec_modulo_C.md` §2.8.

React debe consumir y presentar las fechas e inicios posibles calculados
por backend.

#### Integración con HU-C-18

HU-C-07 implementará la capacidad de consultar y presentar disponibilidad
del profesor.

HU-C-18 será responsable de reorganizar definitivamente la pantalla en
los cinco pasos aprobados.

No se adelantará dentro de C-07 una reescritura completa del wizard que
pertenezca a HU-C-18.

Debe evitarse, sin embargo, introducir nueva lógica de UI que luego
duplique o contradiga el flujo aprobado.

#### Comportamientos existentes a preservar

El componente ya contempla que:

- la duración no tenga valor preseleccionado;
- las duraciones permitidas provengan de configuración;
- cambiar la duración pueda invalidar una hora previamente elegida;
- cambiar la fecha pueda invalidar una hora previamente elegida;
- la hora de finalización se calcule a partir de inicio + duración;
- los cambios sin guardar participen del mecanismo `dirty state`.

C-07 debe mantener esos comportamientos donde sigan siendo aplicables,
pero validar la hora seleccionada contra la disponibilidad devuelta por
servidor.

#### Estrategia de tests frontend

Se reutilizará el patrón existente de
`turno-configuracion.test.tsx`:

- Vitest + jsdom;
- mock de `fetchAutenticado`;
- montaje de `TurnoConfiguracion`;
- respuestas HTTP simuladas;
- aserciones sobre estado visible y requests realizados.

La cobertura de C-07 deberá verificar, como mínimo:

- consulta de disponibilidad después de contar con profesor, materia y
  duración;
- presentación de fechas/horas devueltas por backend;
- cambio de duración que invalida una selección anterior;
- cambio de profesor que limpia fecha/hora pero conserva duración;
- respuesta `fechas: []` con el mensaje contractual:
  “Este profesor no tiene horarios disponibles para esta materia en este momento”;
- ausencia de cálculo duplicado de disponibilidad del profesor en React.

#### Diferencias respecto del mockup

El mockup muestra un límite visual de 60 días y horarios ocupados
tachados.

Estos elementos no reemplazan el contrato vigente:

- el rango máximo proviene de `ANTICIPACION_MAXIMA_DIAS`;
- el frontend consume los inicios posibles calculados por servidor;
- no se hardcodeará el valor 60;
- no se asumirá que el endpoint devuelve horarios ocupados si la spec
  no los incluye.

Ante diferencias entre mockup y spec, prevalece `spec_modulo_C.md`.
#### Divergencias mockup / spec

El mockup contiene el texto:

“hasta 60 días hacia adelante”.

Ese valor no constituye el contrato vigente.

`spec_modulo_C.md` define el límite mediante
`ANTICIPACION_MAXIMA_DIAS`, obtenido de `ParametroSistema`, cuyo valor
de seed actual es 30.

Por lo tanto:

- no hardcodear 60 días;
- la UI debe utilizar el rango efectivo definido por backend.

El mockup también representa algunos horarios ocupados mediante opciones
tachadas.

El contrato vigente de HU-C-07 establece que el servidor calcula los
tramos libres y devuelve las horas de inicio posibles. Por lo tanto,
no se asumirá que los horarios ocupados forman parte de la respuesta
del endpoint solamente porque aparezcan representados en el prototipo.

La implementación seguirá el contrato de `spec_modulo_C.md`; el mockup
se utilizará como referencia de presentación e interacción cuando no
contradiga la spec.

#### Componentes afectados

La integración se realizará sobre la UI existente del wizard, principalmente:

`src/app/(dashboard)/turnos/turno-configuracion.tsx`

No se creará un componente separado para el selector de duración, de
acuerdo con la spec vigente.

Antes de modificar la UI se relevará la implementación actual del
componente para conservar los patrones y componentes compartidos
existentes.

### Estado del relevamiento

Contrato de HU-C-07 relevado.

La implementación propia del módulo C puede comenzar por las funciones
puras de `turno.disponibilidad.ts` y su cobertura unitaria.

La integración completa con los horarios del profesor depende de que
Módulo D publique `obtenerHorariosDeAtencion()` mediante
`profesor.publico.ts`.

No implementar consultas directas a tablas del módulo D como solución
temporal.

**Esperar confirmación explícita del relevamiento antes de avanzar con
las secciones de implementación.**

## 1. Alcance, dependencias y fuera de alcance

### Alcance

HU-C-07 implementa la consulta de disponibilidad real de un profesor
dentro de la configuración de un turno individual.

Incluye:

- listar profesores activos asociados a la materia elegida;
- obtener las franjas recurrentes de atención del profesor;
- consultar sus turnos `DISPONIBLE` / `COMPLETO`;
- calcular tramos libres;
- generar horas de inicio compatibles con la duración elegida;
- limitar las fechas al rango permitido por configuración;
- exponer la disponibilidad mediante Route Handlers;
- presentar la disponibilidad desde `/turnos/nuevo`;
- revalidar la selección mediante los contratos existentes al persistir.

El cálculo debe quedar reutilizable por HU-C-17.

### Dependencias

#### Módulo D

Contrato requerido:

`obtenerHorariosDeAtencion(profesorId, db?)`

en:

`src/server/profesores/profesor.publico.ts`

Retorno:

`{ horario_id, dia_semana, hora_inicio, hora_fin }[]`

También se reutiliza:

`profesorActivoDictaMateria(profesorId, materiaId, db?)`.

La implementación pública de `obtenerHorariosDeAtencion()` todavía no
está disponible en `develop`.

No se accederá directamente a `HorarioProfesor` desde Turnos.

#### Configuración del sistema

Se reutilizan:

- `granularidad_turno_minutos`;
- `anticipacion_maxima_dias`;
- días operativos;
- horario operativo;
- zona horaria del centro.

Las duraciones permitidas continúan saliendo de
`DURACIONES_PERMITIDAS_TURNO_MIN`.

### Fuera de alcance

No corresponde a HU-C-07:

- reorganizar completamente el wizard de cinco pasos;
- selección y disponibilidad de aula;
- inscripción de alumnos;
- generación masiva de turnos;
- calendario;
- modificar el modelo Prisma;
- crear migraciones;
- duplicar en React el cálculo de disponibilidad del servidor.

La reorganización completa del flujo corresponde a HU-C-18.

## 2. Historia de usuario

### HU-C-07 — Mostrar horarios disponibles del profesor

**Como** Personal de mesa de entrada  
**necesito** ver qué franjas y fechas están disponibles para el profesor
ya elegido, dentro del flujo de configuración de turno  
**para** elegir fecha y horario sin arriesgar un momento en que el profesor
no está disponible.

**Estimación:** 2 SP.

### Criterios contractuales relevantes

1. Después de elegir Materia y Profesor, solo se ofrecen fechas y horas
   contenidas en el horario de atención del profesor.

2. Dentro de cada franja se excluyen los intervalos ocupados por turnos
   `DISPONIBLE` o `COMPLETO`.

   `PENDIENTE` y `CANCELADO` no reservan recursos.

3. Si no existen opciones dentro del rango permitido se muestra:

   `Este profesor no tiene horarios disponibles para esta materia en este momento`

4. La selección se revalida al confirmar el turno.

5. HU-C-17 reutiliza el mismo cálculo de disponibilidad.
## 3. Alcance de implementación

### Backend

#### Crear

- `src/app/api/turnos/profesores/por-materia/route.ts`
- `src/app/api/turnos/profesores/[profesorId]/disponibilidad/route.ts`

#### Modificar

- `src/server/turnos/turno.profesor.service.ts`
- `src/server/turnos/turno.disponibilidad.ts`
- `src/server/turnos/turno.schema.ts`

#### Tests backend

Agregar cobertura específica para:

- cálculo de tramos libres;
- generación de inicios posibles;
- profesores por materia;
- disponibilidad por profesor;
- estados que bloquean y estados que no bloquean;
- granularidad;
- duración 60 / 120 / 180;
- anticipación máxima;
- día actual y horarios ya vencidos;
- franjas múltiples;
- intervalos contiguos;
- profesor sin disponibilidad.

### Frontend

Modificar:

- `src/app/(dashboard)/turnos/turno-configuracion.tsx`
- `src/app/(dashboard)/turnos/turno-configuracion.test.tsx`

HU-C-07 incorpora el consumo de disponibilidad real del profesor.

La reorganización visual completa del wizard queda para HU-C-18.

### No implementar

- consultas directas a tablas del módulo Profesores;
- lógica alternativa de superposición;
- cálculo de disponibilidad duplicado en cliente;
- migraciones;
- cambios de schema Prisma;
- generación masiva C-17.

## 4. Contrato backend

### 4.1 Profesores por materia

`GET /api/turnos/profesores/por-materia?materia_id=`

Permiso:

`turnos:crear`

Servicio:

`listarProfesoresPorMateria()`

Comportamiento:

1. validar `materia_id`;
2. verificar materia activa;
3. obtener profesores activos asociados mediante el servicio público
   del módulo D;
4. no filtrar todavía por horario.

Respuesta:

```json
{
  "data": [
    {
      "id": "cuid",
      "nombre": "Ana",
      "apellido": "Gómez"
    }
  ],
  "error": null
}

Errores:
- 400 VALIDATION_ERROR
- 403 SIN_PERMISO
- 404 SIN_PROFESORES_PARA_MATERIA
- 409 MATERIA_NO_DISPONIBLE
4.2 Disponibilidad del profesor
GET /api/turnos/profesores/[profesorId]/disponibilidad?materia_id=&duracion_min=&desde=&hasta=
Permiso:
turnos:crear
Servicio:
calcularDisponibilidadProfesor()
Schema:
DisponibilidadProfesorQuerySchema
Campos:
- materia_id: obligatorio;
- duracion_min: 60, 120 o 180;
- desde: opcional, default hoy;
- hasta: opcional, limitado por anticipación máxima.
El servicio:
1. verifica materia activa;
2. verifica profesor activo;
3. verifica que el profesor dicte la materia;
4. obtiene sus horarios recurrentes mediante
   obtenerHorariosDeAtencion();
5. obtiene sus turnos DISPONIBLE / COMPLETO;
6. calcula los tramos libres;
7. genera los inicios compatibles con duración y granularidad;
8. para hoy elimina los horarios vencidos;
9. omite fechas sin opciones.
PENDIENTE y CANCELADO no descuentan disponibilidad.
Una disponibilidad vacía responde 200 con fechas: [].
4.3 Cálculo puro compartido
En:
src/server/turnos/turno.disponibilidad.ts
Agregar: 
calcularTramosLibres(franja, ocupados)
iniciosPosibles(tramo, duracion, granularidad)
Las funciones trabajan con minutos desde las 00:00.
Intervalos semiabiertos:
[inicio, fin) ]
Superposición:
a1 < b2 && b1 < a2
Los intervalos contiguos no se superponen.
Estas funciones deben ser reutilizables por C-17 y C-06.
4.4 Server Actions
No aplica.
HU-C-07 utiliza Route Handlers.
4.5 Persistencia y auditoría
La consulta de disponibilidad es de solo lectura.
No crea turnos, reservas ni eventos.
No requiere cambios de Prisma ni migraciones.


Frontend:

```md
## 5. Frontend

Referencia visual:

Mockup “Nuevo turno — individual, paso 3 (Fecha y horario)”.

La spec prevalece ante diferencias con el mockup.

### Comportamiento

- duración antes de seleccionar fecha/hora;
- consulta al backend según materia, profesor y duración;
- fechas sin disponibilidad no se ofrecen como seleccionables;
- al seleccionar fecha se muestran sus inicios posibles;
- cambiar duración invalida una hora que ya no sea válida;
- cambiar profesor limpia fecha/hora y conserva duración;
- disponibilidad vacía muestra el mensaje contractual;
- React no calcula la agenda del profesor.

### Consideraciones del mockup

No hardcodear “60 días”.

El rango real proviene de `ANTICIPACION_MAXIMA_DIAS`.

Los horarios ocupados tachados del prototipo son una representación
visual y no cambian el contrato del endpoint, que devuelve opciones
disponibles.

## 6. Testing

### Unitarios

Probar `calcularTramosLibres()`:

- sin ocupados;
- ocupado en el medio;
- ocupado al inicio;
- ocupado al final;
- múltiples ocupados;
- intervalos contiguos;
- ocupados fuera de la franja.

Probar `iniciosPosibles()`:

- duración 60;
- duración 120;
- duración 180;
- granularidad 30;
- tramo exactamente igual a la duración;
- tramo menor a la duración;
- inicio no alineado.

### Servicio / integración

Probar:

- profesor que dicta la materia;
- profesor que no la dicta;
- profesor inexistente/inactivo;
- materia inactiva;
- horarios recurrentes;
- `DISPONIBLE` bloquea;
- `COMPLETO` bloquea;
- `PENDIENTE` no bloquea;
- `CANCELADO` no bloquea;
- anticipación máxima;
- horarios vencidos del día actual;
- `fechas: []`.

### Frontend

Vitest + jsdom siguiendo
`turno-configuracion.test.tsx`.

Cubrir:

- carga de disponibilidad;
- selección de fecha/hora;
- cambio de duración;
- cambio de profesor;
- mensaje sin disponibilidad;
- error del endpoint;
- no generar horarios del profesor localmente.

### Verificación manual

Con datos reales de seed:

1. elegir una materia;
2. elegir un profesor asociado;
3. elegir duración;
4. verificar que solo aparezcan fechas y horas dentro de su horario;
5. verificar que un turno `DISPONIBLE` / `COMPLETO` elimine el intervalo;
6. verificar que un `PENDIENTE` no lo elimine;
7. verificar que no pueda elegirse un horario pasado del día actual.

## 7. Definition of Done

- [x] Relevamiento previo documentado y aprobado.
- [x] Contratos con Módulo D respetados para la consulta de disponibilidad.
- [x] Sin consultas directas a `HorarioProfesor` desde Turnos.
- [x] `calcularTramosLibres()` implementada y testeada.
- [x] `iniciosPosibles()` implementada y testeada.
- [x] `listarProfesoresPorMateria()` implementada.
- [x] `calcularDisponibilidadProfesor()` implementada.
- [x] Route Handler de profesores por materia implementado.
- [x] Route Handler de disponibilidad implementado.
- [x] Respuestas `{ data, error }` en ambas rutas de C-07.
- [x] Permiso `turnos:crear` aplicado en ambas rutas de C-07.
- [ ] Frontend consume disponibilidad del servidor.
- [x] Mensaje contractual de disponibilidad vacía implementado en el componente reutilizable.
- [ ] Sin cálculo duplicado de disponibilidad del profesor en React.
- [x] Sin cambios de Prisma, seed ni migraciones.
- [x] Tests unitarios específicos aprobados.
- [ ] Tests de integración aprobados.
- [x] Tests frontend del componente reutilizable aprobados; integración con el wizard pendiente.
- [ ] Verificación manual realizada.
- [ ] PR limitado a HU-C-07.

## 8. Etapa backend de disponibilidad tras el handoff D

**Estado:** implementación backend propia completada y aprobada. HU-C-07 no está Done: falta la integración funcional con el wizard de HU-C-18.

### 8.1. Base y dependencia

La rama `feature/HU-C-07` fue rebaseada sobre `origin/develop` con el PR 0′ de servicios públicos integrado (`b9cc43b`). `src/server/profesores/profesor.publico.ts` publica `obtenerHorariosDeAtencion(profesorId, db?)`, `obtenerOpcionProfesorActivo()` y `profesorActivoDictaMateria()`. El servicio de C-07 consume esas funciones, además de `listarProfesoresActivosPorMateria()` y `estaDentroDeHorarioAtencion()` desde la misma frontera pública. La consulta de horarios devuelve `{ horario_id, dia_semana, hora_inicio, hora_fin }[]`, ordenada por día y hora, con horas `HH:mm`; Turnos no consulta `HorarioProfesor` directamente. El `FOR SHARE` transaccional de `profesorActivoDictaMateria(..., tx)` también está publicado por D, aunque este GET de solo lectura no requiere bloqueo.

### 8.2. Implementación y decisiones

Archivos modificados: `src/server/turnos/turno.profesor.service.ts`, `src/server/turnos/turno.profesor.test.ts`, `src/server/turnos/turno.validaciones.ts` y esta task. Archivos nuevos: `src/app/api/turnos/profesores/[profesorId]/disponibilidad/route.ts` y `route.test.ts` en el mismo directorio. No se modificó módulo D, Prisma, seed, migraciones ni frontend.

`calcularDisponibilidadProfesor()` verifica materia activa, profesor activo y asociación en ese orden. Lee anticipación, días operativos, apertura, cierre y granularidad desde `parametrosConfiguracionTurno()`, la misma función que usan `validarConfiguracionTurno()` y `GET /api/turnos/configuracion`. Usa la hora local de Buenos Aires ya aplicada por Turnos; `horaLocal()` se expuso desde `turno.validaciones.ts` para evitar repetir esa conversión. El rango inclusivo se recorta a `[hoy, hoy + anticipación]`; un rango efectivo invertido produce `VALIDATION_ERROR` (400). La consulta de Turnos filtra profesor, rango y `ESTADOS_AGENDADOS` (`DISPONIBLE`/`COMPLETO`) en una sola lectura. Agrupa sus intervalos reales por fecha, cruza las franjas recurrentes con el horario operativo y reutiliza `calcularTramosLibres()` e `iniciosPosibles()`. Elimina los inicios de hoy que no son posteriores a la hora actual. Conserva todas las franjas que intersectan el horario operativo, incluso con `tramos_libres: []` e `inicios: []`; omite únicamente fechas cuya suma de inicios es cero. Una lista `fechas: []` es respuesta válida 200.

La nueva ruta aplica `withPermission("turnos:crear")`, valida la query con `DisponibilidadProfesorQuerySchema` y devuelve `{ data, error }`. Traduce `VALIDATION_ERROR` a 400, `PROFESOR_NO_ENCONTRADO` a 404 y `MATERIA_NO_DISPONIBLE`/`PROFESOR_NO_DICTA_MATERIA` a 409; otros `ServiceError` conservan código/mensaje y usan 422, como fallback de las rutas de configuración de Turnos. No reserva recursos: la creación y la confirmación del turno revalidan la elección según §2.1 y §2.2.

### 8.3. Evidencia y criterios

Tras la revisión técnica, tests específicos de cálculo puro, servicio de profesor y ambas rutas de C-07: **60 tests OK en 4 archivos**. Regresión de Aula C-16: **20 tests OK en 2 archivos**; total **80 tests OK en 6 archivos**. `npx.cmd tsc --noEmit`: **OK**. `git diff --check`: **OK** para archivos seguidos; los archivos nuevos se revisan también antes del cierre de la etapa. Vitest se ejecutó fuera del sandbox porque allí no pudo leer `vitest.config.mjs`.

### 8.4. Correcciones de revisión de backend

La revisión detectó que el Route Handler convertía cualquier `ServiceError` no mapeado en 409; se limitó ese status a los dos conflictos de la spec y se probó `ERROR_NO_MAPEADO` → 422. También detectó que `obtenerParametrosHorarioOperativo()` normaliza una granularidad mayor a 60 a 30, mientras el validador de POST/PATCH de Turnos usa el entero positivo persistido. Disponibilidad pasó a consumir `parametrosConfiguracionTurno()` para obtener exactamente la misma granularidad efectiva que la configuración y su endpoint; el caso de 90 minutos confirma que los inicios se alinean a 90. **No se modificó `shared/parametros.ts`**, usado por HU-D-04 y otros consumidores del módulo D.

La fecha se omite solo si ninguna franja tiene inicios. Se agregó el caso de dos franjas del mismo día: una completamente ocupada permanece en la respuesta con `tramos_libres: []` e `inicios: []`, mientras la otra ofrece horas. Se probaron además el tope exacto de anticipación, el día local de Buenos Aires cuando UTC ya avanzó al siguiente y los estados `DISPONIBLE`/`COMPLETO` por separado mediante filas de prueba con estado explícito. La integración funcional con C-18 sigue pendiente; HU-C-07 sigue abierta.

AC1 y AC2: satisfechos en el backend de disponibilidad (franjas del profesor y resta de turnos confirmados). AC3: `fechas: []` disponible; el mensaje y la acción de volver a Profesor están cubiertos en el componente de C-07, con su integración en el wizard pendiente. AC4: la consulta no reserva recursos; la revalidación al crear/confirmar corresponde a §2.1/§2.2 y a la integración con C-18. En esta rama, el `POST /api/turnos` todavía refleja el flujo anterior sin `profesor_id` en la configuración: no se declara AC4 cerrado por esta etapa. AC5: funciones puras reutilizables para C-17; su consumo en C-17 queda fuera de esta HU. La presentación dentro del wizard permanece pendiente de integración con HU-C-18.

## 9. Etapa frontend reutilizable de Fecha y Horario

**Estado:** presentación propia de C-07 implementada; integración real con `/turnos/nuevo` pendiente de HU-C-18. No se modificó el shell del wizard ni el backend aprobado.

### 9.1. Alcance y archivos

Se crearon `src/app/(dashboard)/turnos/paso-fecha-horario-turno.tsx` y `paso-fecha-horario-turno.test.tsx` en el mismo directorio. El componente recibe materia, profesor, `duracionesPermitidas`, duración, fecha y hora seleccionadas junto con callbacks de cambio, continuación y regreso. El padre conserva el estado del wizard, obtiene `parametros.duraciones_permitidas_minutos` de `GET /api/turnos/configuracion` y será responsable de persistir el turno cuando corresponda. Esta etapa no ejecuta `POST` ni `PATCH`; el componente tampoco consulta la configuración por su cuenta.

### 9.2. Contrato y comportamiento

La duración se elige de los valores recibidos por prop, sin valor preseleccionado por el componente ni una copia local de `[60, 120, 180]`. Una vez elegida, consulta exclusivamente `GET /api/turnos/profesores/[profesorId]/disponibilidad?materia_id=&duracion_min=`. Muestra carga, error con reintento, las fechas y los inicios devueltos por el servidor. Une los `inicios` de las franjas de cada fecha sin duplicados, conservando el orden recibido; no calcula otros horarios ni presenta motivos de indisponibilidad. `fechas: []` muestra exactamente «Este profesor no tiene horarios disponibles para esta materia en este momento» y ofrece volver a Profesor mediante callback. Cambiar duración limpia fecha y hora y vuelve a consultar; cambiar fecha limpia la hora si no pertenece a la nueva fecha. La clave de consulta y `AbortController` impiden que una respuesta tardía de otro profesor o materia sustituya la disponibilidad vigente.

El componente es controlado: el padre de C-18 debe invalidar fecha/hora al cambiar dependencias según las reglas del wizard. Cambiar Profesor limpia fecha/hora; cambiar Materia puede conservar Profesor y horario si sigue dictándola, y los invalida si dejan de ser válidos. Por ello el componente no ejecuta una limpieza automática e incondicional al cambiar `profesorId` o `materiaId`. Continuar requiere un inicio que figure en la respuesta vigente; la integración concreta con el padre sigue pendiente de C-18.

### 9.3. Evidencia y pendientes

Las pruebas del componente cubren parámetros de la consulta, carga, opciones recibidas, selección, invalidación de fecha/hora, vacío, regreso a Profesor, error y ausencia de escrituras HTTP. La revisión final agregó casos para duraciones controladas por prop, fecha con una franja sin inicios y otra disponible, inicio repetido entre franjas y respuesta tardía del profesor anterior tras cambiar al nuevo. Tests específicos frontend y backend de C-07: **71 OK en 5 archivos** (11 del componente y 60 del backend). `npx.cmd tsc --noEmit`: **OK**. `git diff --check`: **OK** para archivos seguidos; se verificó también el whitespace de archivos nuevos.

AC3 queda cubierto a nivel de componente. AC4 sigue pendiente de la integración y revalidación final en C-18. La pantalla `/turnos/nuevo` y el flujo legacy permanecen sin cambios. HU-C-07 no se declara Done hasta que C-18 integre esta presentación y complete el flujo real.

## 10. Evidencia de integración con HU-C-18

La integración posterior de C-18 consume el componente de Fecha/Horario y los GET de C-07 en los pasos 2 y 3 del wizard. Al confirmar el paso 3, `POST/PATCH /api/turnos[/id]/configuracion` revalida profesor activo, materia que dicta, horario y superposición. Al confirmar finalmente el paso 5, `PATCH /api/turnos/[id]/participantes` vuelve a comprobar esas cuatro condiciones dentro de la transacción antes de pasar de `PENDIENTE` a `DISPONIBLE` o `COMPLETO`, incluso cuando el payload omite `profesor_id` y usa el persistido. La regresión de C-18 etapa 6 pasó con **203 tests en 12 archivos**. Esta evidencia cierra funcionalmente AC4 de C-07; el estado histórico de las etapas anteriores permanece como registro de su momento de ejecución. La revisión final de HU-C-18 y su validación manual siguen pendientes.
