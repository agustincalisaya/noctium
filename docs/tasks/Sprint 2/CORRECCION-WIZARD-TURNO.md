# TASK: Corrección del wizard de Turno — adecuación al prototipo aprobado

**Módulo:** C (Gestionar turnos)

**Sprint:** 2

**Origen:** Relevamiento paso a paso del PO sobre `/turnos/nuevo`, comparando
la implementación actual contra el prototipo aprobado el 30/09/2026.

**Aprobado por:** Cali (PO, Sprint 2).

**Naturaleza del trabajo:** corrección nueva sobre el wizard existente.
No reabre HU-C-18, HU-C-04, HU-C-07 ni HU-C-16; todas permanecen Terminadas.

**Pantalla afectada:** `/turnos/nuevo`

**Documento funcional obligatorio:** `cambios-requeridos-wizard-turno.md`

**Prototipo obligatorio:**
https://claude.ai/artifact/9VhY4YdPBzRXU4dhPrFnLo

**Contratos que no se modifican:**
- `configurarTurno`
- `asignarParticipantesTurno`
- `listarOpcionesAulaTurno`

**Estado:** Fases 1–3 y corrección final del stepper y textos de avance implementadas;
verificación local en navegador pendiente por falta de conexión con la base de datos.

---

## 0. Relevamiento previo a implementación

Antes de escribir código se debe comparar la implementación real de `/turnos/nuevo`
contra:

1. `cambios-requeridos-wizard-turno.md`;
2. el prototipo aprobado;
3. los contratos vigentes de Turno;
4. la implementación final de HU-C-18, HU-C-07 y HU-C-16.

El resultado del relevamiento debe informar:

- archivos existentes a modificar, con ruta exacta y motivo;
- archivos nuevos a crear, si fueran realmente necesarios;
- componentes compartidos entre los cinco pasos;
- endpoints y servicios que actualmente alimentan cada paso;
- diferencias visuales contra el prototipo;
- diferencias funcionales contra este documento;
- tests existentes afectados;
- cualquier cambio propuesto fuera de frontend;
- todo punto dudoso que requiera decisión antes de programar.

No se implementa nada hasta que el Scrum Master apruebe este relevamiento.

### 0.1. Principio de autoridad visual

El frontend debe quedar visual e interactivamente igual al prototipo aprobado.

El documento `cambios-requeridos-wizard-turno.md` registra las diferencias detectadas
por el PO, pero no reemplaza al prototipo.

Ante un detalle visual o de interacción no descrito en esta task:

**manda el prototipo.**

Excepción explícita:

- en Paso 5 no se copia la palabra `Opcional` asociada a los alumnos;
- el flujo vigente exige al menos un alumno para confirmar.

### 0.2. Restricción de alcance

Esta corrección no reabre las HU ya terminadas ni redefine sus reglas de negocio.

No se modifican los contratos de:

- `configurarTurno`;
- `asignarParticipantesTurno`;
- `listarOpcionesAulaTurno`.

Los cambios corresponden a:

1. presentación;
2. interacción;
3. utilización correcta de filtros de disponibilidad;
4. dos filtros de opciones que hoy faltan:
   - profesor con al menos un horario de atención registrado;
   - alumno sin turno superpuesto.

### 0.3. Puntos técnicos obligatorios a relevar

#### A. Estructura del wizard

Identificar:

- componente raíz de `/turnos/nuevo`;
- componente del encabezado;
- indicador de progreso;
- panel `Resumen`;
- componentes de los cinco pasos;
- estado compartido;
- navegación Adelante/Atrás;
- qué datos se persisten y en qué momento.

No duplicar el header ni el indicador entre pasos si hoy pueden resolverse desde un
componente común.

#### B. Paso 1 — Materia

Relevar:

- endpoint/servicio que entrega materias;
- DTO actual;
- cómo obtener la cantidad de profesores que dicta cada materia;
- si ese dato ya existe en otro contrato público;
- si puede agregarse a la consulta de opciones sin alterar el contrato de configuración
  de turno.

No consultar directamente tablas internas de Profesor desde frontend.

#### C. Paso 2 — Profesor

Relevar el origen actual de las opciones de profesor.

Debe determinarse cómo excluir únicamente profesores que:

- dictan la materia elegida;
- pero no poseen ningún horario de atención registrado.

Este filtro NO debe comprobar disponibilidad concreta para una fecha.

Un profesor con horarios registrados pero sin huecos libres futuros sigue siendo una
opción válida en Paso 2 y la ausencia de disponibilidad concreta se informa en Paso 3.

Confirmar si el filtro puede resolverse reutilizando el contrato público del Módulo D.

#### D. Paso 3 — Fecha y horario

Comparar la UI actual completa contra el prototipo.

Relevar específicamente:

- shape real que devuelve HU-C-07;
- fechas disponibles;
- intervalos libres;
- información disponible sobre intervalos ocupados;
- navegación temporal;
- granularidad;
- duración seleccionada.

Determinar si el backend actual entrega suficiente información para mostrar:

- calendario mensual;
- días habilitados;
- día seleccionado;
- horario completo del profesor;
- bloques libres;
- bloques ocupados tachados.

No reimplementar reglas de disponibilidad en React.

Si el contrato actual solo devuelve horas libres y no permite reconstruir con seguridad
los bloques ocupados requeridos por el prototipo, detener la implementación y documentar
el gap antes de modificar el backend.

#### E. Paso 4 — Aula

Confirmar que la pantalla consume las opciones filtradas por horario implementadas en
HU-C-16 usando el `turno_id` correspondiente.

No volver al modo de consulta sin `turno_id` para el alta real.

Relevar cómo cambiar la presentación:

- select actual;
- tarjetas seleccionables;
- nombre;
- capacidad;
- estado seleccionado;
- fecha y horario para el subtítulo.

No modificar `listarOpcionesAulaTurno`.

#### F. Paso 5 — Alumnos

Relevar:

- endpoint actual de búsqueda/listado;
- forma actual de agregar/quitar alumnos;
- contrato de `asignarParticipantesTurno`;
- capacidad derivada del aula;
- helper existente de superposición de alumno;
- posibilidad de obtener la lista completa de alumnos elegibles.

Debe definirse una consulta de opciones que permita:

- mostrar la lista completa desde el inicio;
- filtrar localmente por nombre, apellido o DNI;
- excluir alumnos con otro turno superpuesto;
- conservar el guard de servidor al confirmar;
- respetar como máximo la capacidad del aula.

No trasladar al frontend la regla de superposición.

### 0.4. Resultado del contraste con las fuentes obligatorias (30/09/2026)

Se inspeccionaron los cinco pasos del prototipo aprobado, esta task, la implementación
actual y `docs/tasks/Sprint 2/cambios-requeridos-wizard-turno.md`. El documento
funcional confirma el orden, los textos, las grillas, el calendario, la lista inicial
de alumnos y los dos filtros nuevos. Sus excepciones explícitas al prototipo son:
no mostrar `Opcional` en Paso 5 y exigir al menos un alumno para confirmar.

| Punto | Código vigente y decisión de diseño |
|---|---|
| Estructura | `src/app/(dashboard)/turnos/nuevo/page.tsx` monta `turno-wizard.tsx`. Allí viven el header, la navegación y el estado compartido (`paso`, materia, profesor, duración, fecha, hora, alumnos, `turnoId`, aula y cupo). `progreso-turno.tsx` y `resumen-turno.tsx` se renderizan una sola vez para los cinco pasos. Los componentes son `paso-materia-turno.tsx`, `paso-profesor-turno.tsx`, `paso-fecha-horario-turno.tsx`, `seccion-aula-turno.tsx` y `paso-alumnos-turno.tsx`; este último usa `buscador-alumnos.tsx`. No se duplica el header ni el stepper. |
| Persistencia | Pasos 1 y 2: estado local. Al continuar desde Paso 3: `POST /api/turnos` o `PATCH /api/turnos/[id]/configuracion` para el mismo `PENDIENTE`. Paso 4: GET de aulas con `turno_id` real y `PATCH /api/turnos/[id]/aula`. Paso 5: `PATCH /api/turnos/[id]/participantes`, que revalida y confirma. La secuencia de HU-C-18 se conserva. |
| Header e indicador | El subtítulo usa `·`; debe usar `→`. `progreso-turno.tsx` repite `Paso N de 5: Nombre` y muestra `N. Nombre`; el prototipo muestra `Paso N` arriba y el nombre debajo. Los pasos 1, 2, 4 y 5 repiten `Paso N de 5` dentro de la tarjeta; se elimina. |
| Resumen | Hoy tiene cinco filas y expresa alumnos como cantidad. Tendrá seis filas en **los cinco pasos**, incluida `ESTADO INICIAL`, aun cuando el prototipo la introduzca visualmente más tarde. Los nombres salen del arreglo de alumnos ya mantenido por `turno-wizard.tsx`; cantidad y estado inicial se derivan de esa misma selección, sin otro estado mutable. Antes de seleccionar alumnos: `Disponible, 0 alumnos`. |
| Materia | `GET /api/turnos/configuracion` usa `listarMateriasActivas()` y devuelve `{id,nombre,codigo}[]`; no incluye cantidad de profesores. El GET vigente `por-materia` ya devuelve los profesores activos asociados y permite contar por materia sin cambiar el DTO de configuración, a costa de una consulta por materia. `GET /api/materias` publica `profesores_count`, pero es paginado, exige `materias:leer` y cuenta asociaciones sin asegurar actividad; no se usa como fuente del wizard. |
| Profesor | El wizard usa `GET /api/turnos/profesores/por-materia?materia_id=` → `listarProfesoresPorMateria()` y recibe `{id,nombre,apellido}[]`. HU-C-07 §2.8.1 exige expresamente que ese GET no filtre por horario. La lectura nueva de §0.5 conserva ese contrato y filtra solo `horarios.length > 0`; no consulta huecos futuros. |
| Fecha y horario | HU-C-07 §2.8.2 devuelve `profesor`, `duracion_min`, `rango` y `fechas[{fecha,dia_semana,franjas[{hora_inicio,hora_fin,tramos_libres,inicios}]}]`. Omite las fechas sin inicios y no expone intervalos ocupados explícitos. La UI actual es una lista plana de fechas ISO e inicios; el prototipo requiere calendario mensual y ocupados tachados. La lectura específica de §0.6 cubre el gap sin alterar el GET de HU-C-07. |
| Aula | El documento funcional describe el defecto anterior de «todas las aulas», pero el código actual **ya** consume `GET /api/turnos/aula/opciones?turno_id=<id>` en el alta, después de persistir el `PENDIENTE`. HU-C-16 ya filtra ocupación. Cada opción tiene `{id,nombre,capacidad}`; alcanza para las tarjetas. Solo cambian título, subtítulo con intervalo, select por tarjetas y textos auxiliares. `listarOpcionesAulaTurno` queda intacto. |
| Alumnos | Hoy `GET /api/turnos/participantes/alumnos?q=` busca desde dos caracteres y devuelve como máximo 10 activos; una búsqueda vacía devuelve `[]`. `buscador-alumnos.tsx` agrega de a uno. El cupo real ya proviene de `cupo_maximo` del PATCH de Aula. La superposición se valida en `alumnoConTurnoSuperpuesto()` de `turno.service.ts`, dentro de la confirmación. §0.7 propone una lista inicial completa y elegible, con búsqueda local y sin mover esa regla a React. |

El contraste visual confirmó tarjetas de hasta tres columnas en Materia, Profesor y
Aula; calendario y panel lateral de horarios en Paso 3; y lista desplazable con
casilleros y contador junto al título en Paso 5. El prototipo muestra horarios
semanales en las tarjetas de Profesor. La leyenda de ocupados solo corresponde a
bloques que el servidor clasifique como ocupados por otro turno.

### 0.5. Contrato propuesto de lectura para Paso 2 — opciones del wizard

**Ruta nueva, de solo lectura:**
`GET /api/turnos/profesores/opciones-wizard?materia_id=<id>`.
**Permiso:** `turnos:crear`. `materia_id` es obligatorio y se valida como en
HU-C-07 §2.8.1. Mantiene el formato `{ data, error }`:

```json
{
  "data": [
    {
      "id": "<profesor_id>",
      "nombre": "Laura",
      "apellido": "Méndez",
      "horarios": [
        { "horario_id": "<id>", "dia_semana": "MARTES", "hora_inicio": "16:00", "hora_fin": "20:00" }
      ]
    }
  ],
  "error": null
}
```

El servicio de Turnos verifica materia activa, obtiene profesores activos que la
dictan con `listarProfesoresActivosPorMateria()` y, para cada uno, invoca
`obtenerHorariosDeAtencion(profesorId)` del contrato público del módulo D.
Conserva únicamente los que tengan **al menos un registro** y entrega los
horarios ordenados como los devuelve D. No consulta tablas internas de Profesor,
ni aplica fecha, horario operativo, disponibilidad puntual o anticipación.
Un profesor con horarios registrados y todos sus próximos turnos ocupados sigue
en esta lista. `data: []` con 200 significa que no hay opciones con horario
registrado. Errores: `400 VALIDATION_ERROR` por parámetro ausente/inválido,
`403 SIN_PERMISO` y `409 MATERIA_NO_DISPONIBLE`. El GET contractual
`por-materia` y su DTO `{id,nombre,apellido}[]` permanecen intactos.

### 0.6. Contrato propuesto de lectura para Paso 3 — agenda visual

**Ruta nueva, de solo lectura:**
`GET /api/turnos/profesores/[profesorId]/agenda-wizard?materia_id=<id>&duracion_min=<60|120|180>&desde=<AAAA-MM-DD>&hasta=<AAAA-MM-DD>`.
`desde` y `hasta` son opcionales y se recortan igual que en HU-C-07 §2.8.2.
**Permiso:** `turnos:crear`. Misma validación de materia activa, profesor activo,
asociación, duración y rango que el GET vigente. Respuesta propuesta:

```ts
{
  data: {
    profesor: { id: string; nombre_completo: string };
    duracion_min: 60 | 120 | 180;
    granularidad_min: number;
    rango: { desde: string; hasta: string }; // fechas inclusivas, AAAA-MM-DD
    franjas_recurrentes: Array<{
      horario_id: string; dia_semana: string;
      hora_inicio: string; hora_fin: string; // HH:mm, contrato público de D
    }>;
    meses: Array<{
      anio: number; mes: number; etiqueta: string; // mes 1–12; etiqueta «Octubre 2026»
      dias: Array<{
        fecha: string; dia_semana: string; numero: number;
        en_rango: boolean; operativo: boolean;
        tiene_horarios_libres: boolean; seleccionable: boolean;
        franjas: Array<{
          hora_inicio: string; hora_fin: string; // franja efectiva, acotada al centro
          tramos_libres: Array<{ desde: string; hasta: string }>;
          tramos_ocupados: Array<{ desde: string; hasta: string }>;
          bloques: Array<{
            inicio: string; fin: string; // HH:mm; duración completa aplicada
            estado: "LIBRE" | "OCUPADO" | "VENCIDO";
            seleccionable: boolean;
          }>;
        }>;
      }>;
    }>;
  };
  error: null;
}
```

`meses` contiene los meses tocados por el rango efectivo y los días calendario
completos de cada mes, incluidos los que quedan fuera del rango para mostrarlos
deshabilitados. Los días operativos sin bloques libres **no se omiten**: así se
puede mostrar su horario y sus ocupados aunque no admitan selección. Una franja
puede tener `bloques: []` si no cabe la duración elegida. `LIBRE` es el único
estado seleccionable; `OCUPADO` se muestra tachado y corresponde a conflicto con
un turno `DISPONIBLE`/`COMPLETO`; `VENCIDO` representa un bloque de hoy que ya
no puede iniciarse y no se rotula como turno ocupado. `seleccionable` del día y
`tiene_horarios_libres` son verdaderos si contiene al menos un bloque `LIBRE`.
El frontend utiliza esos campos para presentar, sin restar intervalos ni inferir
conflictos. Solo calcula la disposición gráfica de la grilla mensual y formatea
textos; no decide disponibilidad.

El servidor reutiliza el recorte de rango, zona horaria, horario operativo,
duración y granularidad de `calcularDisponibilidadProfesor()`; obtiene las
franjas con `obtenerHorariosDeAtencion()` y los turnos agendados con el filtro
`ESTADOS_AGENDADOS`. Reutiliza `intervaloTurno()`, `calcularTramosLibres()`,
`iniciosPosibles()` e `intervalosSeSuperponen()` para construir tramos y bloques.
Los `LIBRE` de la agenda deben coincidir exactamente con los `inicios` que
HU-C-07 ofrece para el mismo profesor, materia, duración y rango. Los ocupados
se generan **en el servidor** a partir de los turnos agendados, nunca como
complemento de libres en React. Los bloques se generan en inicios alineados a
la granularidad cuya duración completa cabe dentro de la franja efectiva;
primero se descartan como `VENCIDO` los inicios de hoy no posteriores a la hora
actual, luego se marca `OCUPADO` si el intervalo se superpone a un turno
agendado, y el resto solo se marca `LIBRE` si pertenece a los inicios válidos
calculados por la lógica vigente. `PENDIENTE` y `CANCELADO` no ocupan.
El GET contractual de disponibilidad de HU-C-07 y su DTO no cambian.

### 0.7. Contrato propuesto de lectura para Paso 5 — alumnos elegibles

**Ruta nueva, de solo lectura:**
`GET /api/turnos/participantes/alumnos/opciones?turno_id=<id>`.
**Permiso:** `turnos:asignar_participantes`. `turno_id` es obligatorio, pero no
se exige CUID: hay turnos del seed con ids legibles. Respuesta:

```ts
{
  data: {
    turno_id: string;
    alumnos: Array<{ id: string; nombre: string; apellido: string; dni: string }>;
  };
  error: null;
}
```

`alumnos` es la **lista completa**, sin umbral de búsqueda ni límite de 10,
solo de fichas activas sin turno `DISPONIBLE`/`COMPLETO` superpuesto con el
intervalo persistido del `PENDIENTE`; se ordena por apellido, nombre y DNI.
`data.alumnos: []` es 200 válido. Errores: `400 VALIDATION_ERROR` por id ausente,
`403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO`, `409 TURNO_YA_DISPONIBLE` para
un turno no pendiente y `409 TURNO_SIN_AULA` si falta el aula/cupo del Paso 4.
La búsqueda por nombre, apellido o DNI y las marcas son locales sobre la lista
ya elegible; no trasladan la superposición al cliente.

El servicio de Turnos lee fecha, inicio, duración, estado, aula y cupo del
`turno_id` persistido. Consulta los turnos agendados de esa fecha, excluye el
propio turno y usa la misma regla `intervalosSeSuperponen()` de la validación
actual para reunir IDs ocupados. La lista es preventiva y puede quedar obsoleta
por concurrencia: `asignarParticipantesTurno` **conserva** la verificación final
de actividad, superposición, cupo y reservas dentro de su transacción.

**Verificación específica de `obtenerAlumnosBasicos`:** la función ya está
implementada en `src/server/alumnos/alumno.publico.ts`, tipada como
`obtenerAlumnosBasicos(ids: string[], db?)` y probada. La contractualiza
`docs/specs/spec_modulo_B.md` §2.8; entrega en lote
`{id,nombre,apellido,dni,activo,forma_pago_preferida_id}[]`, para los **IDs
recibidos**, incluidos activos e inactivos. No descubre los IDs de todas las
fichas activas ni ofrece paginación completa. Por eso se reutiliza para los
datos básicos, pero le falta **enumeración de IDs activos** para iniciar la
lista. Se propone agregar al módulo B únicamente el contrato público acotado
`listarIdsAlumnosActivos(db?): Promise<string[]>`, con orden estable; Turnos
pasaría esos IDs a `obtenerAlumnosBasicos()` y conservaría solo `activo: true`
antes de aplicar su propio filtro de superposición. No se duplica la función
de datos básicos ni se lee `alumnos` directamente desde Turnos. El buscador
actual `buscarAlumnosActivos()` no sirve para enumerar: con `q` vacío devuelve
`[]` y con texto limita la respuesta a 10. El listado general incluye
inactivos, pagina de a 20 y usa otro permiso. El archivo citado
`Documento_Sprint_2_Developers.pdf` no está en este checkout; la existencia,
firma y límites del contrato se verificaron contra el código, sus tests y
`spec_modulo_B.md`.

### 0.8. Diff propuesto y verificación posterior, aún sin ejecutar

**Frontend existente:** `turno-wizard.tsx`, `progreso-turno.tsx`,
`resumen-turno.tsx`, `paso-materia-turno.tsx`, `paso-profesor-turno.tsx`,
`paso-fecha-horario-turno.tsx`, `seccion-aula-turno.tsx` (solo rama
`modoWizard`) y `paso-alumnos-turno.tsx`. `buscador-alumnos.tsx` conserva su
uso heredado; el nuevo Paso 5 presenta la lista recibida.

**Backend existente:** `turno.profesor.service.ts` para las dos lecturas de
profesor; `turno.service.ts` para las opciones elegibles de Turnos; y
`alumno.publico.ts` con la mínima enumeración de IDs activos, reutilizando
`obtenerAlumnosBasicos()` sin cambiarlo. El alcance de los cambios de módulo B
requiere aprobación técnica del contrato propuesto. **Routes nuevas**: las
tres GET de §0.5–§0.7 y sus tests. No se crea schema, migración, seed, ni
otro flujo de escritura.

**Tests a actualizar/complementar:** `turno-wizard.test.tsx`,
`paso-fecha-horario-turno.test.tsx`, `turno.profesor.test.ts`,
`turno.participantes.test.ts`, `alumno.publico.test.ts` y tests nuevos para
las tres GET. Conservar como regresión los tests vigentes de POST/PATCH de
configuración, disponibilidad de HU-C-07, opciones de Aula de HU-C-16,
participantes y `turno.reservas.pg.test.ts`. Por compartir `SeccionAulaTurno`,
conservar también `turno-configuracion.test.tsx` de la pantalla heredada.
Verificar en navegador los cinco pasos contra el prototipo y el documento
funcional, además de tests, TypeScript, lint y build cuando se autorice
implementar. En esta etapa no se ejecutan tests ni se modifica código.

**No tocar:** contratos de `configurarTurno`, `asignarParticipantesTurno` y
`listarOpcionesAulaTurno`; los GET contractuales de HU-C-07; `schema.prisma`,
migraciones y `seed.ts`. Paso 4 sigue usando
`GET /api/turnos/aula/opciones?turno_id=<id>` sin modo de alta sin id.

### 0.9. Decisión de producto RESUELTA

El documento funcional exige `Disponible, N alumnos`, incluso cuando `N`
alcanza el cupo; el servicio vigente confirma `COMPLETO` en ese caso. La
decisión aprobada afecta únicamente al texto predictivo del frontend; no
cambia la máquina de estados ni los contratos de escritura:

- `N < cupo`: `Disponible, N alumnos`;
- `N = cupo`: `Completo, N alumnos`.

El mismo valor se mostrará en la fila `ESTADO INICIAL` y en el texto vivo del
Paso 5. La fila existe en los cinco pasos; antes de elegir aula/alumnos muestra
`Disponible, 0 alumnos`. Esta diferencia de texto queda **RESUELTA**. El
diseño SDD fue aprobado y las Fases 1–3 están implementadas.

---

## 1. Alcance funcional general

El wizard conserva los cinco pasos existentes:

1. Materia
2. Profesor
3. Fecha y horario
4. Aula
5. Alumnos

No cambia su orden.

La corrección afecta:

- encabezado común;
- indicador de pasos;
- contenido de cada paso;
- presentación de opciones;
- panel Resumen;
- filtros de opciones de Profesor y Alumnos.

---

## 2. Encabezado e indicador de pasos

Aplica de forma idéntica a los cinco pasos.

### 2.1. Subtítulo

Debe mostrarse:

`Materia → Profesor → Fecha y horario → Aula → Alumnos`

No usar separadores `·`.

### 2.2. Texto redundante

Eliminar el texto:

`Paso N de 5: <Nombre>`

que actualmente aparece antes del indicador.

### 2.3. Indicador

Cada paso muestra:

`Paso N`

y debajo:

`Nombre del paso`

No mostrar:

`1. Materia`
`2. Profesor`
etc.

El paso activo se distingue visualmente según el prototipo.

### 2.4. Tarjeta de contenido

No repetir dentro de la tarjeta:

`Paso N de 5`

La tarjeta comienza directamente con su título.

---

## 3. Paso 1 — Materia

### 3.1. Título

Texto exacto:

`Elegí la materia`

No agregar:

`Seleccioná la materia para este turno.`

No utilizar:

`Elegí una materia`.

### 3.2. Presentación

Las materias se muestran mediante tarjetas seleccionables.

Layout:

- hasta 3 tarjetas por fila según ancho disponible;
- mismo diseño, separación, selección y estados visuales del prototipo.

### 3.3. Contenido de la tarjeta

Cada tarjeta muestra como mínimo:

- materia;
- código;
- cantidad de profesores que la dictan.

Ejemplo conceptual:

`FIS-1 · 1 profesor`

Pluralizar correctamente cuando corresponda.

### 3.4. Resumen

El panel Resumen debe incluir también `ESTADO INICIAL`.

---

## 4. Paso 2 — Profesor

### 4.1. Presentación

Los profesores se muestran mediante tarjetas seleccionables.

Cuando haya espacio:

- 3 por fila.

Debe replicar el comportamiento visual del prototipo.

### 4.2. Filtro por horario registrado

No se muestra un profesor que no tenga ningún horario de atención registrado.

Condiciones para aparecer:

1. profesor válido para la materia;
2. al menos un horario recurrente registrado.

Este filtro no equivale a disponibilidad puntual.

Un profesor que tenga horarios de atención cargados pero que posteriormente no posea
ningún hueco libre sigue apareciendo aquí.

En ese caso Paso 3 mantiene el comportamiento vigente:

`Este profesor no tiene horarios disponibles para esta materia en este momento`

y la acción:

`Volver a Profesor`.

### 4.3. Orden del wizard

No se mueve Fecha/Horario delante de Profesor para solucionar este caso.

El orden ya aprobado se conserva.

---

## 5. Paso 3 — Fecha y horario

Este paso debe ser reemplazado visualmente para reproducir el prototipo.

### 5.1. Calendario mensual

No utilizar una lista plana de fechas.

Debe existir un calendario visual con:

- encabezado del mes;
- navegación al mes anterior/siguiente cuando corresponda;
- días de la semana;
- grilla mensual;
- días no seleccionables;
- días con horarios disponibles;
- día seleccionado;
- leyenda visual.

Ejemplo de encabezado:

`‹ Octubre 2026 ›`

### 5.2. Formato de fecha

Dentro de cada día:

- mostrar solamente el número.

Una vez seleccionado:

`Sábado 3 de octubre`

No mostrar como texto principal:

`2026-10-03 · SABADO`.

### 5.3. Bloques horarios

Los horarios se presentan como intervalos completos:

`11:00–12:00`

No como horas de inicio aisladas.

### 5.4. Ocupados

Los intervalos ocupados deben permanecer visibles y aparecer tachados.

Texto explicativo:

`Los horarios tachados no están disponibles: el profesor ya tiene un turno.`

No deben presentarse como seleccionables.

### 5.5. Fuente de verdad

La UI no calcula disponibilidad.

El servidor continúa siendo la fuente de:

- disponibilidad;
- superposición;
- horario del profesor;
- duración;
- granularidad.

---

## 6. Paso 4 — Aula

### 6.1. Disponibilidad

Solo mostrar aulas disponibles para la fecha y horario ya elegidos.

Debe continuar consumiéndose la disponibilidad real implementada en HU-C-16.

### 6.2. Presentación

Reemplazar el `<select>` por tarjetas seleccionables.

Cada tarjeta muestra:

- nombre del aula;
- capacidad;
- estado de selección.

### 6.3. Subtítulo

Debe reflejar el turno concreto.

Ejemplo:

`Aulas libres el sábado 3 de octubre, 11:00–12:00`

No utilizar:

`Las opciones corresponden al horario guardado del turno.`

### 6.4. Título

Texto:

`Elegí el aula`

No:

`Elegí un aula`.

### 6.5. Textos a eliminar

No mostrar:

`Elegí un aula para continuar con los alumnos.`

ni:

`Cupo máximo: — (capacidad del aula elegida)`

### 6.6. Capacidad

Debe incluir unidad.

Ejemplo:

`Capacidad 4 alumnos`

---

## 7. Paso 5 — Alumnos

### 7.1. Disponibilidad

Solo se pueden seleccionar alumnos que no tengan otro turno superpuesto con el turno
actual.

El filtro de opciones es preventivo.

`asignarParticipantesTurno` continúa revalidando al confirmar.

### 7.2. Lista

Al entrar al paso se muestra inmediatamente la lista de alumnos elegibles.

No esperar a que el usuario escriba una búsqueda.

Cada alumno tiene un casillero seleccionable.

### 7.3. Buscador

El buscador filtra la lista ya cargada.

Placeholder exacto:

`Buscar alumno por nombre, apellido o DNI...`

No:

`Nombre, apellido o DNI (mínimo 2 caracteres)`.

### 7.4. Título

Texto:

`Inscribí alumnos`

No:

`Agregá alumnos`.

### 7.5. Contador

El contador aparece junto al título.

Ejemplo:

`0 de 4`

El segundo número es la capacidad real del aula elegida.

No usar un tope fijo.

No permitir marcar más alumnos que la capacidad disponible.

### 7.6. Estado inicial

Debajo del título mostrar:

`El turno se va a crear en estado Disponible, con N alumnos`

actualizado en vivo.

No utilizar la palabra:

`Opcional`

Se mantiene la regla vigente: se exige al menos un alumno para confirmar.

### 7.7. Resumen

El Resumen debe mostrar los nombres de los alumnos elegidos.

Ejemplo:

`Sofía Acosta, Florencia Aguirre`

No limitarse a:

`2 alumnos`.

### 7.8. Botón final

Texto exacto:

`Crear turno`

No:

`Confirmar turno`.

### 7.9. Texto innecesario

Eliminar:

`Todavía no agregaste alumnos.`

La lista completa ya debe estar visible.

---

## 8. Panel Resumen

Es compartido por los cinco pasos.

Debe contener seis filas:

1. MATERIA
2. PROFESOR
3. FECHA Y HORARIO
4. AULA
5. ALUMNOS
6. ESTADO INICIAL

### 8.1. Estado inicial

Mostrar:

`Disponible, N alumnos`

El valor N se actualiza en vivo según la selección del Paso 5.

Antes de seleccionar alumnos:

`Disponible, 0 alumnos`

### 8.2. Alumnos

Cuando existan alumnos seleccionados mostrar nombres, no solamente cantidad.

---

## 9. Contratos y reglas que no cambian

Esta task no redefine:

- creación/configuración del turno;
- asignación del aula;
- confirmación de participantes;
- duración permitida;
- máquina de estados;
- capacidad del aula;
- orden del wizard;
- regla de superposición;
- disponibilidad de aula implementada por HU-C-16;
- disponibilidad de profesor implementada por HU-C-07.

En particular no se modifican los contratos de:

- `configurarTurno`;
- `asignarParticipantesTurno`;
- `listarOpcionesAulaTurno`.

Cualquier necesidad de modificar uno de estos contratos detectada durante §0 debe
detenerse y elevarse antes de programarla.

---

## 10. Testing requerido

### 10.1. Encabezado común

Verificar en los cinco pasos:

- flechas `→`;
- ausencia de texto duplicado;
- indicador sin numeración de nombres;
- paso activo correcto;
- ausencia de `Paso N de 5` dentro de la tarjeta.

### 10.2. Materia

Verificar:

- título exacto;
- grilla;
- selección;
- cantidad de profesores;
- pluralización;
- actualización del Resumen.

### 10.3. Profesor

Verificar:

- grilla;
- solo profesores de la materia;
- profesor sin ningún horario registrado excluido;
- profesor con horario registrado pero sin disponibilidad puntual sigue apareciendo;
- comportamiento vigente de Paso 3 para ese caso.

### 10.4. Fecha y horario

Verificar:

- calendario mensual;
- navegación entre meses;
- días disponibles;
- día seleccionado;
- formato legible;
- intervalos con inicio y fin;
- ocupados visibles y tachados;
- ocupados no seleccionables;
- cambio de duración;
- cambio de profesor;
- estado sin disponibilidad.

### 10.5. Aula

Verificar:

- solo aulas libres;
- tarjetas;
- selección;
- capacidad;
- texto con fecha/hora;
- ausencia de textos eliminados;
- estado sin aulas.

### 10.6. Alumnos

Verificar:

- lista visible desde el inicio;
- búsqueda local;
- checkbox;
- alumno ocupado excluido;
- alumno libre incluido;
- capacidad máxima;
- contador;
- al menos un alumno obligatorio;
- texto de estado vivo;
- nombres en Resumen;
- botón `Crear turno`.

### 10.7. Regresión backend

Los cambios de presentación no deben romper:

- configuración;
- disponibilidad de profesor;
- disponibilidad de aula;
- confirmación de participantes;
- reservas;
- validaciones concurrentes.

Ejecutar los tests vigentes de HU-C-18, HU-C-07, HU-C-16 y participantes afectados
por el diff.

### 10.8. Verificación visual

La aceptación visual final se realiza comparando los cinco pasos contra el prototipo,
pantalla por pantalla.

No alcanza con que los tests de componentes estén en verde.

Se debe revisar:

- layout;
- espaciado;
- jerarquía;
- textos;
- estados seleccionados;
- interacción;
- responsive/layout de grillas.

---

## 11. Fuera de alcance

- Reordenar los cinco pasos.
- Reabrir C-18/C-04/C-07/C-16.
- Crear una pantalla nueva.
- Cambiar reglas de creación del turno.
- Cambiar la máquina de estados.
- Añadir disponibilidad por fecha al filtro de Profesor del Paso 2.
- Permitir cero alumnos.
- Reimplementar disponibilidad en frontend.
- Cambiar la selección de aula por una regla nueva.
- Cambiar el prototipo.

---

## 12. Definition of Done

- [x] Relevamiento técnico §0 ejecutado contra el código actual.
- [x] Prototipo revisado durante el diseño SDD.
- [ ] Archivos exactos del diff aprobados antes de programar.
- [ ] Header/indicador compartido corregido.
- [ ] Paso 1 calcado al prototipo.
- [ ] Paso 2 calcado y filtro de profesor sin horario implementado.
- [ ] Paso 3 reemplazado por calendario e intervalos según prototipo.
- [ ] Paso 4 en tarjetas y consumiendo disponibilidad real.
- [ ] Paso 5 en lista/checks y filtrando alumnos ocupados.
- [ ] Panel Resumen con `ESTADO INICIAL`.
- [ ] Ningún contrato prohibido modificado.
- [ ] Tests específicos aprobados.
- [ ] Regresión de HU-C-18/C-07/C-16/participantes aprobada.
- [ ] `tsc --noEmit` aprobado.
- [ ] lint aprobado.
- [ ] build aprobado.
- [ ] Verificación manual de los cinco pasos contra el prototipo.
- [ ] Revisión final del PO/equipo.
- [ ] Evidencia agregada a esta task antes de cerrarla.

---

## 13. Estado de implementación por fases

El relevamiento §0 y la decisión de §0.9 fueron aprobados. Las Fases 1–3 y
la corrección final están implementadas. Queda pendiente la revisión final del
PO/equipo antes de cerrar esta task.

### 13.1. Evidencia técnica de Fase 2 — Paso 3

- `src/server/turnos/turno.profesor.service.ts`: `calcularBaseAgendaProfesor`
  concentra validación de materia/profesor, recorte de rango, horario operativo,
  franjas, ocupaciones y cálculo de inicios. `calcularDisponibilidadProfesor`
  proyecta desde esa base el DTO contractual de C-07, con su mismo filtro de
  fechas sin inicios. `calcularAgendaProfesorWizard` entrega además meses,
  días, tramos ocupados explícitos y bloques `LIBRE`/`OCUPADO`/`VENCIDO`.
- `src/app/api/turnos/profesores/[profesorId]/agenda-wizard/route.ts`: GET de
  solo lectura, `turnos:crear`, query validada con el schema de C-07, envelope
  `{ data, error }` y los mismos códigos HTTP del GET contractual. `desde` y
  `hasta` son opcionales; si se omiten, el servicio devuelve el rango efectivo
  vigente. El GET de disponibilidad de C-07 no se modificó.
- `src/app/(dashboard)/turnos/paso-fecha-horario-turno.tsx`: calendario mensual,
  duración, días libres/seleccionados/sin huecos, fecha legible, franjas y
  bloques completos. Los ocupados llegan del servidor, permanecen visibles,
  tachados y deshabilitados. Un día con horario pero sin libres se puede
  inspeccionar sin fijarlo como fecha seleccionada. El caso sin disponibilidad
  mantiene el mensaje y `Volver a Profesor`.
- `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx`: al entrar desde Profesor
  usa inicialmente la primera duración contractual (60 minutos), conserva la
  duración vigente al volver, muestra el intervalo completo en Resumen, y deja
  POST/PATCH de configuración en el momento existente de `Continuar a aula`.
- Tests: `turno.profesor.test.ts`, `paso-fecha-horario-turno.test.tsx` y
  `turno-wizard.test.tsx` actualizados; creado
  `src/app/api/turnos/profesores/[profesorId]/agenda-wizard/route.test.ts`.
  La ejecución conjunta con `turno.disponibilidad.test.ts` y el route handler
  contractual de C-07 pasó: 6 archivos, 123 tests. `npx.cmd tsc --noEmit` y
  ESLint de los ocho archivos de código/tests afectados pasaron.

**Comparación visual con el prototipo:** se reprodujeron el calendario y
la navegación mensual, el panel de franjas, las duraciones segmentadas, los
bloques inicio–fin y el tachado de ocupados. El límite se toma del servidor,
por lo que no se muestra el texto fijo «60 días» del prototipo. Cuando la
granularidad vigente ofrece inicios intermedios, se presentan todos los
inicios válidos de C-07, incluso si el ejemplo visual del prototipo muestra
solo bloques contiguos de una hora. La revisión visual local de la Fase 3 se
registra en §13.2.

### 13.2. Evidencia técnica de Fase 3 — Aula y Alumnos (30/09/2026)

- `src/app/(dashboard)/turnos/seccion-aula-turno.tsx`: `modoWizard` presenta
  tarjetas en grilla de hasta tres columnas, nombre, capacidad y selección.
  El consumidor heredado conserva el selector, ayuda y cupo existentes; su
  regresión `turno-configuracion.test.tsx` pasó.
- `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx`: Paso 4 muestra
  `Elegí el aula` y fecha legible con el intervalo ya elegido. Conserva
  `GET /api/turnos/aula/opciones?turno_id=<id>` y el `PATCH` de Aula al
  continuar. El Resumen refleja el aula marcada de inmediato, sin adelantar
  su persistencia. Al entrar al Paso 5 consulta la lista elegible del turno
  persistido, reconcilia las marcas previas con esa lista, y conserva
  `PATCH /api/turnos/[id]/participantes` como confirmación final. El cupo
  proviene de la respuesta persistida del Aula. El mismo valor calculado
  alimenta `ESTADO INICIAL` y el texto predictivo.
- `src/app/(dashboard)/turnos/paso-alumnos-turno.tsx`: lista completa desde
  el ingreso, casilleros, búsqueda local por nombre/apellido/DNI sin requests
  por tecla, contador `N de cupo`, bloqueo de opciones restantes al llenarse,
  y título `Inscribí alumnos`. El Resumen muestra nombres seleccionados y
  el botón final dice `Crear turno`. Se conserva el mínimo de un alumno.
- `src/server/alumnos/alumno.publico.ts`: nueva frontera acotada
  `listarIdsAlumnosActivos(db?)`, que enumera únicamente IDs activos.
  `obtenerAlumnosBasicos(ids, db?)` se reutiliza sin cambiar su contrato.
- `src/server/turnos/turno.service.ts`: `listarOpcionesAlumnoTurno(turnoId)`
  verifica turno `PENDIENTE` con aula/cupo, toma IDs y datos básicos por la
  frontera de Alumno, excluye turnos propios y considera solo conflictos
  `DISPONIBLE`/`COMPLETO` de la misma fecha. El helper privado
  `idsAlumnosOcupados` comparte `intervalosSeSuperponen` y `intervaloTurno`
  con la validación final. El cuerpo y el contrato de
  `asignarParticipantesTurno` no cambiaron; continúa revalidando dentro de
  su transacción frente a concurrencia.
- `src/app/api/turnos/participantes/alumnos/opciones/route.ts`:
  `GET ?turno_id=<id>` con `turnos:asignar_participantes`, envelope
  `{ data: { turno_id, alumnos: [{ id, nombre, apellido, dni }] }, error: null }`.
  `data.alumnos: []` responde 200. ID ausente: 400 `VALIDATION_ERROR`;
  permiso: 403 `SIN_PERMISO`; turno inexistente: 404
  `TURNO_NO_ENCONTRADO`; turno no pendiente o sin aula/cupo: 409
  `TURNO_YA_DISPONIBLE` o `TURNO_SIN_AULA`.
- Tests nuevos: `turno.opciones-alumnos.test.ts` y
  `api/turnos/participantes/alumnos/opciones/route.test.ts`. Se actualizaron
  `alumno.publico.test.ts` y `turno-wizard.test.tsx`. Regresión conjunta
  C-18/C-07/C-16/participantes: **15 archivos, 275 tests OK**. También
  pasaron `npx.cmd tsc --noEmit`, ESLint de archivos afectados y
  `git diff --check`. El build completo pasó con acceso de red para descargar
  Geist; el primer intento aislado falló solo en esa descarga. El test de
  participantes en PostgreSQL real no se ejecutó: faltan
  `HU_C15_TEST_DATABASE_URL` y `DATABASE_URL` en el entorno de comandos, y
  el test exige igualdad de ambas para no escribir en la base compartida.

**Comparación visual local contra el prototipo:** se abrió `/turnos/nuevo`
en `next dev --webpack`, con la cuenta de prueba de Mesa de Entradas y datos
locales. Se inspeccionaron los cinco pasos y los estados seleccionados. Pasos
1 y 2: grillas, títulos, horarios y Resumen; Paso 3: calendario, franja y
bloques inicio–fin; Paso 4: tarjetas, subtítulo, capacidad y selección;
Paso 5: lista desplazable, casilleros, contador y Resumen con nombres. El
documento funcional prevalece sobre el prototipo al mostrar `ESTADO INICIAL`
en los cinco pasos, omitir `Opcional` y exigir un alumno. La granularidad y
el rango del Paso 3 siguen la respuesta real del servidor, como se indicó
en §13.1. La aplicación mantiene su shell global actual (barra lateral,
colores y anchos propios), diferente del shell ilustrativo del prototipo;
no se cambió porque afecta pantallas fuera del wizard. La verificación local
creó un turno `PENDIENTE` de prueba al pasar del Paso 3; no se confirmó ni se
ejecutó el PATCH final. La revisión y aceptación final del PO/equipo sigue
pendiente; por eso no se marca el DoD final.

### 13.3. Corrección final — stepper y botones de avance (30/09/2026)

- `progreso-turno.tsx` presenta los pasos ya habilitados como botones
  `type="button"` con foco visible; el paso actual y los aún no habilitados
  permanecen sin acción. La callback de navegación llega desde `TurnoWizard`
  y comparte la transición de retroceso con el botón `Atrás`. Al volver,
  también se puede entrar directamente a un paso previamente completado;
  cambiar Materia, Profesor, fecha, hora, duración o Aula invalida los pasos
  posteriores correspondientes.
- `turno-wizard.tsx` muestra `Continuar a profesor` en el Paso 1 y
  `Continuar a fecha y horario` en el Paso 2. El retroceso por stepper no
  modifica selecciones ni dispara POST/PATCH; las invalidaciones siguen
  ocurriendo solo al cambiar Materia o Profesor.
- Tests específicos del wizard: **44 aprobados**. Suite completa: **943
  aprobados, 0 fallidos, 37 omitidos, 3 pendientes**. Pasaron
  `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` y
  `git diff --check`.
- En el prototipo se verificaron los botones de pasos habilitados, los futuros
  deshabilitados y ambos textos de avance. La aplicación local inició, pero
  el inicio de sesión de la cuenta de prueba falló por falta de conexión con
  la base de datos; queda pendiente repetir en navegador la comparación de
  los cinco pasos y los clics del stepper local. No se ejecutó PostgreSQL real
  porque faltan las variables de seguridad requeridas.
- El turno `cmunvmi6r0002uobg15ei2lle` permanece como dato de prueba
  **PENDIENTE** generado en la revisión visual anterior. No se modificó ni
  se ejecutó limpieza; se espera un flujo soportado o confirmación expresa
  para limpiar la base de otra forma.

El DoD final continúa sin marcar hasta completar la revisión visual local y
la revisión final del PO/equipo.
