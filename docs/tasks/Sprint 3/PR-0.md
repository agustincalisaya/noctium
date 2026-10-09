# PR 0 — Base de datos, seed, permisos y contratos del Sprint 3

| Campo | Valor |
|---|---|
| Sprint | 3 (último sprint) |
| Tipo | Historia técnica a cargo del Scrum Master: se hace aparte y no se estima ni se reparte entre los desarrolladores del equipo ni cuenta en los SP del sprint |
| Versión | 20 (cambios respecto de la v19 en la sección 7; trazabilidad de los pedidos de las specs en 2.18) |
| Fuente | Backlog oficial "Historias de Usuario - Sprint 3 - v18" (40 HU), convenciones 5 y 8 (a a j); auditoría del código (rama `develop`, `31813ef`); **principio de compatibilidad con lo ya desarrollado en los Sprints 1 y 2 (sección 1.1)**; pedidos de las specs de los módulos A a N (Revisión 3) y del análisis de dependencias del sprint (R7), recogidos en 2.18 |
| Integración | Un único push y merge del PR 0 completo a `develop`, luego de cumplir toda la Definición de Terminado (ver 0 y 4). **Merge único, sin fecha fija** (la define el equipo; la v19 fijaba otra, que ya no rige). La **etapa 1 se entrega al equipo apenas cumple su condición**, sin mergearla sola (ver 0) |
| Responsable | Adriel (Scrum Master) |
| Base de datos | **Se exige `prisma migrate reset`** en todos los entornos (decisión del PO): no hay datos que preservar; la base se regenera con el seed según las HU que se muestran |

## Alcance reducido (decisión del responsable del PR 0)

El PR 0 se recorta al máximo para mergearlo a `develop` cuanto antes. Cada desarrollador implementa los servicios de sus HU; los que ya escribió el PR 0 quedan disponibles (firmas en 5.2 a 5.4). Esta decisión prevalece sobre lo que el resto del documento pide para las partes que quedan fuera; la sección 4 marca qué validaciones aplican.

**Queda dentro:**
- Etapa 1: esquema, migraciones, permisos (filas de la tabla cerrada de 2.9.1 en migración y seed) y seed base (5.1).
- Etapa 2, partes 1 a 3: los servicios ya escritos, con sus pruebas (5.2 a 5.4).
- Etapa 3 reducida: la adaptación mínima del código de los Sprints 1 y 2 para que todo compile y sus pruebas sigan en verde (2.0, con las consolidaciones de 5.3 y 5.4), una caja abierta por cuenta de mesa de entrada de prueba en el seed base y la carpeta de fixtures vacía (5.5).

**Queda fuera** (no lo hace el PR 0):
- El seed de escenarios (etapa 2, parte 4) y sus fixtures.
- Los cambios de sesión de 2.7 (rechazo de cuentas inactivas, sesiones revocadas y cambio de contraseña pendiente en `withPermission`, el proxy y la reemisión de la sesión).
- Las rutas de permisos de 2.9 (`rutas-por-rol.ts`, `proxy.ts`).
- El historial académico de prueba de 2.16.
- La actualización de `RULES.md` (2.10).
- La etapa 4: CI (2.12) y la Definición de Terminado completa.

**Lo que cae a cada HU:**

| Tema | Quién lo hace |
|---|---|
| Seed de escenarios y fixtures (2.16) | Cada HU agrega los datos que muestra o prueba, con los servicios, en su propio archivo de `prisma/seed/fixtures/` y una línea en el índice, sin editar `seed.ts`: reservas pendientes y vencidas (HU-C-22, C-24, C-26), pagos, anulaciones y comprobantes (HU-I-10, I-06, I-11), cajas históricas y cierres (HU-I-12), meses de indicadores (HU-H-06, H-07, H-10), escenarios de baja de profesores (HU-D-08), formas de pago inactivas (HU-I-07), enlace de recuperación vencido (HU-A-05) y bajas de alumnos (HU-B-07). |
| Historial académico de prueba (2.16) | HU-E-09 (clases con asistencia, con su `registrarClaseDictada`) y HU-E-02, E-04, E-10 y E-11 (clases sin control, exámenes, indicaciones, correcciones y anulaciones), cada una con sus fixtures. |
| Sesión (2.7) | HU-A-06 (cambio de contraseña obligatorio, revocación de sesiones y reemisión) y HU-A-05 (rutas públicas de recuperación). |
| Rutas de permisos (2.9) | Cada HU que agrega o cambia una pantalla suma su ruta en `rutas-por-rol.ts` y `proxy.ts`: entre otras, HU-E-02 (alcance acotado del Profesor al historial), HU-D-05 y D-08 (Gerente en Profesores) e HU-I-12 (cajas). El Profesor conserva `alumnos:leer`: HU-E-02 se lo quita, con una migración nueva, en el mismo cambio en que agrega su acceso acotado (5.5). |
| `RULES.md` (2.10) | Cada HU que implementa una regla de 2.10 la agrega a `RULES.md` en su PR (concurrencia y bloqueos, historial después del commit, valor vigente). |
| CI (2.12) | Fuera del sprint de HU: queda como tarea técnica del Scrum Master. Mientras tanto, cada HU corre `npm run test:pg` en local antes de pedir revisión. |


> **Instrucciones para Claude Code**
>
> 1. Antes de escribir código, leé completos: `prisma/schema.prisma`, todas las migraciones de `prisma/migrations/` (en especial `20260924150000_turnos_reservas_recursos_v2` y `20260928150100_sprint2_modelo`), `docs/RULES.md`, `docs/DESIGN.md`, `prisma/seed.ts`, `src/auth.ts`, `src/proxy.ts`, `src/server/shared/with-permission.ts`, `src/server/shared/rutas-por-rol.ts`, `src/server/shared/parametros.ts`, `src/server/turnos/turno.service.ts`, `src/server/turnos/turno.publico.ts`, `src/server/pagos/pago.service.ts` y las specs de todos los módulos (`docs/specs/spec_modulo_A.md` a `spec_modulo_N.md`, en su Revisión 3; los pedidos de cada una a este PR están en 2.18). Mirá también cómo están hechas las tasks de `docs/tasks/Sprint 2/` y respetá sus convenciones.
> 2. Los nombres de modelos, campos y enums de esta task son **orientativos**. Usá las convenciones del `schema.prisma` actual (idioma, sufijo de entidad en los campos, nombres de relaciones). Si un concepto ya existe con otro nombre, reutilizalo en lugar de duplicarlo, y anotalo en "Decisiones tomadas".
> 3. **No crees ramas, no hagas commits ni cambies de rama.** El manejo de git lo hace el equipo.
> 4. Trabajá **por etapas** (sección 0): dentro de cada etapa, hacé todo sin frenar a pedir confirmación entre pasos. Al terminar cada etapa, cumplí su condición de la tabla, actualizá "Decisiones tomadas" y frená con un resumen de lo hecho. En las etapas 1 y 2 el código existente puede no compilar por el cambio de la inscripción (eso se arregla en la etapa 3): listá esos errores de `tsc`, que tienen que estar todos en los archivos de 2.0. Desde la etapa 3, `npm test` y `npx tsc --noEmit` quedan en verde. Si algo es ambiguo, tomá la opción más conservadora, seguí y dejalo anotado en "Decisiones tomadas".
> 5. Este PR **no** hace pantallas ni endpoints de las HU. Hace esquema, migraciones, seed, permisos, servicios compartidos (contratos entre módulos), reglas, pruebas y la **adaptación del código existente** que deja de compilar o cambia de significado con el modelo nuevo (2.0).
> 6. Respetá el orden de implementación de la sección 0. El PR 0 se integra una sola vez, con todas sus partes y pruebas completas.
> 7. **Compatibilidad (regla del equipo): nada de lo ya desarrollado en los Sprints 1 y 2 se rompe.** Leé la sección 1.1 antes de tocar código. Si una instrucción de este PR choca con algo que ya funciona, ganá lo existente: dejalo funcionando, anotalo en «Decisiones tomadas» y avisá, no lo resuelvas rompiéndolo.
> 8. **Pedidos de las specs (v20):** la sección 2.18 lista cada pedido y dónde se resuelve. Los nombres y la forma de lo que pide cada spec (columnas, nulidad, firmas) son el contrato que usan las HU: si al implementar la forma real difiere, anotalo en «Decisiones tomadas» y avisá al dueño del módulo; no cambies la forma en silencio.

---

## 0. Orden de implementación e integración

El PR 0 lo hace el Scrum Master por separado: no entra en el reparto de HU del equipo ni suma a los SP del sprint. Su alcance incluye expresamente los servicios, migraciones adicionales, comportamiento interino y utilidades de 2.13–2.16.

| Etapa interna | Contenido | Condición |
|---|---|---|
| 1. Esquema, migración y seed base | 2.1, 2.3–2.8, el SQL de los triggers de reservas de 2.0, 2.9 (permisos en migración y seed, con la tabla cerrada de 2.9.1), 2.11, 2.14 (con el detalle de esquema que piden las specs), y el **seed base** de 2.16: catálogos y formas de pago, tarifas, parámetros, datos del centro, cuentas y fichas, y clases de prueba. **Sin** cajas, inscripciones, pagos ni comprobantes | `prisma migrate deploy` corre sobre una base vacía; `prisma migrate reset` corre el seed; los errores de `tsc` que quedan están solo en los archivos listados en 2.0 (incluidos los lectores de `Pago` del Sprint 2). |
| 2. Servicios, utilidades y seed de escenarios | 2.2, 2.13, los helpers de alcance de 2.9 (`profesorPuedeVerHistorial`, `profesorPuedeRegistrarIndicacion`, `gerentePuedeGestionarClaseDeBaja`), el script de caja de 2.15 y las utilidades de 2.16, con sus pruebas; después, el **seed de escenarios** mínimo de 2.16 (cajas abiertas de prueba, inscripciones, pagos y comprobantes), sembrado **llamando a los servicios** | Las pruebas de los servicios nuevos pasan; el seed completo corre dos veces seguidas sin cambios y la prueba de equivalencia de «Pagada» pasa sobre los datos sembrados. Las firmas reales quedan en "Decisiones tomadas" y se publican al equipo **apenas pasan las pruebas de los servicios, antes del seed de escenarios y antes del merge**, en el orden de abajo: es el contrato para que las HU programen. |
| 3. Adaptación del código existente | 2.0, 2.7 (sesión), 2.9 (rutas) y el resto de 2.15, con los tests de los Sprints 1 y 2 actualizados; al final, el **historial académico de prueba** de 2.16 con los servicios ya adaptados | `npm test` y `tsc` en verde, y los tests `*.pg.test.ts` en verde contra el PostgreSQL descartable; el comportamiento interino de 2.15 funciona. |
| 4. CI, documentación y verificación | 2.10, 2.12, 2.17 y toda la sección 4 | Toda la Definición de Terminado cumplida. |

Las etapas son internas: no se mergean por separado.

**Orden de publicación de las firmas (R7-PR0-3).** Los carriles del reparto arrancan en paralelo, así que el PR 0 publica en este orden, avisando al equipo cuando pasan las pruebas de cada grupo sin esperar al siguiente: **(a)** los contratos de la unidad C-22 / I-10 / C-24 / I-11: `crearInscripcion`, `registrarOperacion` y `marcarVencidas`; **(b)** `registrarClaseDictada` adaptado (HU-E-09 es la primera HU del carril 3; en la etapa 3 es la primera adaptación); **(c)** las cuentas (`cuenta.service.ts`), `registrarCambioEstado` y `listarHistorialEstados` (HU-A-06, B-07, F y G); **(d)** el resto.

**Entrega de la etapa 1 (R7-PR0-4, ajustado por el SM).** Los carriles 1, 2 y 3 necesitan el esquema, el seed base y la tabla de permisos desde el primer día, pero la etapa 1 sola no compila el código existente (los errores de `tsc` de 2.0) y 1.1 exige que `develop` funcione en todo momento: **no se mergea sola**. Cuando cumple su condición, el responsable del PR 0 la entrega al equipo con la lista de errores de `tsc` conocidos; el equipo decide cómo publicarla (por ejemplo, una rama de integración compartida de la que parten los carriles: el git es del equipo). Las HU programan contra esa base y contra las firmas publicadas, y el merge a `develop` sigue siendo único.

El PR 0 completo se entrega en un único push y se mergea a `develop` en la fecha que fije el equipo, una vez que compila, pasa la regresión y cumple toda la sección 4. Las HU pueden avanzar en paralelo usando los contratos acordados, pero no se integran flujos dependientes antes de verificar esos contratos.

## 1. Objetivo

Dejar listo, en un único merge, todo lo que varias HU del Sprint 3 necesitan en común, para que se puedan desarrollar en paralelo sin pisarse. Incluye:

- el modelo de inscripción en dos dimensiones;
- el esquema de pagos con comprobantes;
- tarifas, caja y parámetros del centro;
- las fichas del personal;
- los permisos nuevos;
- los servicios compartidos;
- las reglas de concurrencia;
- la adaptación del código existente a todo lo anterior.

No migra datos: se exige `prisma migrate reset` y la base se regenera con el seed (2.1).

### 1.1 Principio de compatibilidad (regla del equipo)

**Nada de lo ya desarrollado en los Sprints 1 y 2 se rompe: el Sprint 3 se acomoda al código existente, no al revés.** Si algo de este PR, de las specs o de una HU choca con lo que ya existe, se resuelve a favor de lo existente y se anota; no se rompe para avisar después.

Cómo se aplica en este PR:

1. **Contratos de API existentes:** la ruta, el método, el cuerpo del pedido, la forma de la respuesta, los códigos HTTP y el `code` de error de los endpoints de los Sprints 1 y 2 **no cambian**. Se admiten campos opcionales nuevos en el pedido, campos extra en la respuesta y códigos de error nuevos solo para condiciones nuevas.
2. **Funciones públicas y servicios existentes** (`*.publico.ts`, `*.service.ts`): mantienen su firma y la forma de su resultado. Si cambia de dónde sale el dato (por ejemplo, el monto vigente de un pago), cambia por dentro.
3. **Tests:** ningún test de los Sprints 1 y 2 se borra ni se debilita. Se pueden tocar los que mockean la persistencia interna que este PR cambia (`prisma.turnoAlumno.*`, `prisma.pago.*`). Todo test cuya aserción de contrato (respuesta, código de error, regla) cambie va en «Decisiones tomadas», con su motivo y la HU o decisión del PO que lo obliga. Las colecciones Postman de los Sprints 1 y 2 corren sin modificarse.
4. **Convenciones del código existente:** nombres con sufijo de entidad, `ServiceError(code)`, Zod, ubicación de archivos. Los servicios nuevos usan `ErrorDeDominio`, que **extiende** `ServiceError` (2.13).
5. **Lo que muestran las pantallas existentes** (inscriptos, cupo, estado de la clase, totales de pagos) no cambia mientras no haya datos del modelo nuevo (reservas, anulaciones).
6. **Cambios de comportamiento inevitables:** solo los que manda el backlog o el PO, que son los de la tabla de abajo. Ninguno más.
7. **Si una instrucción no se puede cumplir sin romper algo existente**, no se cumple: se deja lo existente funcionando, se anota en «Decisiones tomadas» y se avisa al responsable del PR 0.

| Cambio de comportamiento sobre lo existente | Lo manda | Mitigación |
|---|---|---|
| La inscripción no se borra: se finaliza con una vigencia (quitar alumno, asignar participantes, cancelar clase) | Convención 8 (a) | Los endpoints y sus respuestas no cambian (2.0, 2.15) |
| Una reserva vencida no retiene cupo | HU-C-24, criterio 2 | Sin reservas, los números son los de hoy |
| Cobrar exige una caja abierta del usuario y emite comprobante | Convención 8 (b), HU-I-12 e HU-I-11 | El seed deja una caja abierta por cuenta de mesa de entrada y hay un script para abrirla; el contrato de `POST /api/pagos` no cambia (2.15) |
| Inscribir en una materia sin tarifa se rechaza | HU-L-06, criterio 5 | La tarifa admite vacío para que el alta de materia siga igual; el seed carga tarifas (2.4) |
| El profesor pierde `alumnos:leer` y gana el acceso acotado al historial | Convención 8 (g) | Se hace en el mismo cambio (2.9) |
| El gerente gana consulta de Alumnos, Profesores y detalle de clase | Convención 8 (d) | Es aditivo |
| `withPermission` rechaza cuentas inactivas, sesiones revocadas y cuentas con cambio de contraseña pendiente | HU-A-06, RNF-SEG-04 | Las cuentas actuales no tienen marca ni revocación: no cambia nada para ellas |
| Con `email`, el alta de profesor crea la cuenta de acceso en la misma transacción (el alta sin `email` es la de hoy) | HU-A-06, criterios 1, 2, 3 y 5 (`spec_modulo_D.md` T4) | Sin `email` nada cambia; la respuesta suma un campo extra opcional que los clientes de Sprint 1 y 2 ignoran |
| En una ficha con cuenta, el email de la ficha es el de la cuenta (cambiarlo cambia el usuario con el que ingresa) y no puede quedar vacío | HU-A-06, criterio 6 (`spec_modulo_D.md` T5) | Solo las fichas con cuenta; una ficha sin cuenta se comporta como hoy |
| La base se regenera con `prisma migrate reset` | Decisión del PO (06/10) | — |

## 2. Alcance

### 2.0 Adaptación del código existente

Hoy la inscripción es `TurnoAlumno`, con PK compuesta `(turnoId, alumnoId)`, sin estado. Para tener historial (una inscripción quitada o cancelada y otra vigente del mismo alumno en la misma clase), la inscripción necesita **id propio**. La unicidad pasa al índice parcial de 2.1. Eso rompe o cambia el significado de todo lo que hoy asume «fila existente = inscripto»:

- **Decisión de modelo (decidida, 1.1):** se **extiende `TurnoAlumno`**: mismo modelo, misma tabla y misma relación `Turno.alumnos`, con id propio y las columnas de 2.1. No se crea un modelo nuevo, para que los `include`/`select` de `alumnos` y las consultas existentes sigan compilando y solo necesiten el filtro de vigencia. Lo que desaparece es el selector compuesto `turnoId_alumnoId` (sus usos están listados abajo). Anotalo en «Decisiones tomadas».
- **SQL de `20260924150000_turnos_reservas_recursos_v2`:**
  - `sincronizar_reservas_turno()` (líneas 24-45) proyecta una reserva por cada fila de `turno_alumno`. Tiene que proyectar **solo las inscripciones `VIGENTE`**.
  - `sincronizar_reserva_alumno()` y su trigger (53-78) hoy crean la reserva en INSERT y la borran en DELETE. Con baja lógica, tienen que reaccionar al **UPDATE de vigencia**: borrar la reserva al dejar de ser vigente y crearla al volver a serlo.
  - La PK de `reservas_turno` es `(turnoId, tipoRecurso, recursoId)`. Si el trigger proyecta filas no vigentes, choca cuando el mismo alumno tiene una inscripción histórica y otra vigente en la misma clase.
  - **Trigger de `turno` (R3-PR0-D4):** confirmá contra la migración que `turno_sincronizar_reservas` escucha `UPDATE OF "profesorId"` (`spec_modulo_C.md` 2.11 lo releva así, así que no se espera cambio). Si no lo hiciera, extendelo con una migración **aditiva** que sume la columna a la lista: sin eso, cambiar el profesor de una clase (HU-D-08) no actualizaría la reserva del profesor.
- **Servicios** (`src/server/turnos/turno.service.ts` salvo indicación):
  - `:378` `findUnique` por `turnoId_alumnoId`: el selector compuesto deja de existir.
  - `:384` y `:512` `count` de inscriptos: contar solo vigentes (usar 2.2).
  - `:386` `create`: pasa a `crearInscripcion` de 2.13 (vigencia, estado de pago y precio; sin reserva hasta HU-C-22 y HU-C-24, ver 2.15).
  - `:313-314` `deleteMany` + `createMany` de `asignarParticipantesTurno`: no puede borrar físicamente. Las que salen pasan a `QUITADA_CENTRO`.
  - `:508` `deleteMany` de `quitarAlumnoTurno`: pasa a `updateMany` de vigencia a `QUITADA_CENTRO`, con fecha y usuario.
  - Lecturas por turno que tienen que filtrar vigentes: `:389`, `turno.cancelacion.service.ts:34`, `turno.reprogramacion.service.ts:62`, `turno.publico.ts:96-98` (`bloquearTurnoParaOperacion`, que usan Pagos y Clase dictada) y `turno.publico.ts:245`.
  - SQL crudo: `turno.publico.ts:187` (COUNT en `listarTurnosFuturosDeProfesorPorMateria`) y `:348` (GROUP BY de `promediarOcupacionTurnosPorMes`, indicadores).
  - Relación `Turno.alumnos` (`some`/`none`/`_count`/`include`): `turno.service.ts:24,69,239-240,452-496`; `turno.publico.ts:118`; `turno.disponibilidad.ts:89-90`; `turno.reprogramacion.service.ts:94`; `turno.aula.service.ts:27,57`; `calendario.service.ts:101-167`; `turno.detalle.ts:36,46`. Todos necesitan el filtro de vigencia.
  - `pago.service.ts:16-19,49`: valida contra `alumno_ids` y `obtenerAlumnosInscriptosDeTurno`. Tiene que recibir solo vigentes.
  - Lectores de `Pago` del Sprint 2 (`pago.publico.ts`: `listarPagosDeTurno` y `sumarPagosPorMes`; `turno.detalle.ts:33`; `indicadores.service.ts:12` y sus tests). Como `Pago` conserva `turnoId`, `alumnoId`, `montoPago`, `formaPagoId`, `fechaPago` y `creadoPorUsuarioId` (2.3), siguen compilando; igual se pasan a las lecturas públicas de 2.13 (etapa 2) para que usen el monto vigente y excluyan anulados. `listarPagosDeTurno` y `sumarPagosPorMes` **conservan su firma y la forma de su resultado** (`PagoDeTurno`; `{ mes, total }[]`, con `total` en texto decimal): cambia de dónde sale el dato, no lo que devuelven.
  - `clase-dictada.service.ts:31`: igual (un alumno quitado no figura como presente).
  - **Relación `Turno` → `ClaseDictada`:** al reemplazar `turnoId @unique` por el índice parcial de 2.8, Prisma ya no admite la relación 1:1 (exige `@unique` en la clave foránea de un 1:1). Pasa a 1:N (`clasesDictadas`). Todo `findUnique` por `turnoId` pasa a `findFirst` con `anuladaEl: null`; todo `include`/`select` de `claseDictada` pasa a `clasesDictadas: { where: { anuladaEl: null }, take: 1 }`; el filtro `isNot: null` pasa a `some: { anuladaEl: null }` e `is: null` a `none: { anuladaEl: null }`. Listá esos usos en «Decisiones tomadas»: sus errores de `tsc` cuentan como errores de 2.0.
  - **Estado guardado de la clase:** toda lectura que filtra o decide con `Turno.estado` DISPONIBLE/COMPLETO (por ejemplo, las clases que ofrece «Solicitar clase», el calendario y los listados) pasa a decidir con `ocupacion(db, turnoId, ahora())` de 2.2. Listalas en «Decisiones tomadas».
  - `turno.reprogramacion.service.ts:138` (`reprogramarTurno`): antes de cambiar fecha u hora, llama a `marcarVencidas` usando el `venceEl` anterior para no reactivar reservas vencidas. Después recalcula `venceEl` de las reservas que siguen vigentes como el menor entre `venceBaseEl` (límite sin el tope de la clase, guardado al iniciar el plazo) y el nuevo inicio (HU-C-22, crit. 2, última viñeta). Usa `recalcularVencimientos` de 2.13; no aplica el plazo configurado al momento de reprogramar.
  - `turno.cancelacion.service.ts:22` (`cancelarTurno`): llama a `marcarVencidas` antes de cancelar; después de cancelada, las reservas de esa clase dejan de vencer (HU-C-24, crit. 6).
- **`Pago` del Sprint 2** referencia `turnoId` y `alumnoId` por separado, no la PK de `turno_alumno`: `sumarPagosPorMes` y los indicadores de ingresos no se rompen con 2.0. Cambian con 2.3.
- **Tests:** actualizar los 16 archivos que mockean `prisma.turnoAlumno.*` o usan `turnoId_alumnoId`. Los más grandes son `turno.inscripciones.test.ts`, `turno.participantes.test.ts`, `turno.autoservicio.test.ts`, `turno.publico.test.ts` y `aula.modificar.test.ts`. Además: `turno.cancelacion*`, `turno.reprogramacion*`, `turno.configuracion`, `turno.reservas.pg`, `turno.propios.pg`, `pago.service.pg`, `pago.publico.pg` y `turno.publico.pg`. No bajes la cobertura: cada test que verificaba un `deleteMany` pasa a verificar el cambio de vigencia. Por 1.1, solo se tocan los mocks de persistencia: las aserciones sobre respuestas, códigos de error y reglas de los Sprints 1 y 2 se mantienen.
- **Seed** (`prisma/seed.ts:1683-1724`): las inscripciones y pagos del seed actual se reemplazan por el seed de escenarios de 2.16 (etapa 2, con los servicios). El seed base deja las clases de escenario en DISPONIBLE (con aula, profesor y cupo), y el seed de escenarios inscribe en ellas con `crearInscripcion`, igual que la aplicación: el trigger de 2.0 proyecta la reserva al crear la inscripción vigente, y una clase llega a COMPLETA por sus inscripciones. La regla vieja del seed (inscribir antes de pasar la clase a DISPONIBLE) queda obsoleta.

### 2.1 Inscripción: vigencia y estado de pago (convención 8 a)

Ambas dimensiones se guardan **en la fila de la inscripción**.

- `vigencia` (enum), que guarda si la inscripción sigue en pie:
  - `VIGENTE`
  - `CANCELADA_ALUMNO` (HU-C-14)
  - `RESERVA_VENCIDA` (HU-C-24)
  - `BAJA_ALUMNO` (HU-B-07)
  - `QUITADA_CENTRO` (HU-C-04)
- `estadoPago` (enum), que solo tiene sentido si la inscripción es `VIGENTE`. Al finalizar la inscripción, `estadoPago`, `inicioPlazo`, `venceBaseEl` y `venceEl` se conservan **congelados** con su último valor: la regla de re-reserva (HU-C-22 crit. 4) y las listas de vencidas (HU-C-26) los leen. Ninguna pantalla los muestra como estado de pago de una inscripción no vigente.
  - `RESERVADA`
  - `PAGADA`
  - `PAGO_SIN_REGISTRAR`: vigente, sin pago no anulado y sin reserva vigente. Lo tienen las inscripciones creadas sin plazo antes de HU-C-22 (alumno) y HU-C-24 (centro), según 2.15, y las que quedan sin pago al anular el último pago cuando la clase ya empezó o está cancelada (HU-C-24, criterio 5).
- Campos nuevos de la inscripción:
  - `reservadaEl`: momento de la reserva o de la inscripción.
  - `inicioPlazo`: momento desde el que corre el plazo vigente. Se guarda **aparte** de `reservadaEl`, porque una anulación de pago lo reinicia (HU-C-24, criterio 5).
  - `venceBaseEl`: `inicioPlazo + plazo aplicado al iniciar ese plazo`, sin el tope del inicio de la clase. Conserva el límite original aunque el inicio de la clase haya acortado el vencimiento informado. Se fija al reservar y se reinicia al reabrir por anulación. Es null si no es `RESERVADA`.
  - `venceEl`: vencimiento informado y efectivo de la reserva: el menor entre `venceBaseEl` y el inicio de la clase. Al reprogramar, se recalcula con el nuevo inicio y el **mismo** `venceBaseEl`, sin usar el plazo configurable actual. Es null si no es `RESERVADA`.
  - `finalizadaEl` y `finalizadaPor`: fecha y usuario o actor del cambio de vigencia. El actor puede ser "Proceso automático".
  - **Actor:** las columnas de actor de este PR (inscripción, historiales, cajas, anulaciones) son `…UsuarioId` nullable más `actorTipo` (`USUARIO` | `PROCESO_AUTOMATICO`), con un CHECK de coherencia (`USUARIO` exige usuario; `PROCESO_AUTOMATICO` lo exige null). No se crea un usuario de sistema en el seed: una base con solo migraciones tiene que poder registrar el proceso.
  - `precio`: entero en pesos, NOT NULL: toda inscripción lo guarda al crearse con `precioClase`.
  - `reabiertaPorAnulacion`: booleano, para la excepción de HU-C-24, criterio 5.
  - Auditoría de la fila (Regla N.° 2): `creadoPorUsuarioId` y `createdAt`, siguiendo las convenciones del schema.
- **Historial de estados de la inscripción** (Regla N.° 2): una tabla de transiciones (inscripción, vigencia y estado de pago anterior y nuevo, actor, fecha), escrita después de confirmada la operación según 2.10. Los campos `finalizadaEl`/`finalizadaPor` no alcanzan: una inscripción puede pasar Reservada → Pagada → Reservada (reabierta) → Reserva vencida.
- `estadoPago` se actualiza **en la misma transacción** que registra, corrige o anula un pago. Así las condiciones atómicas de la Regla N.° 7 se evalúan sobre esa fila: con READ COMMITTED, PostgreSQL solo vuelve a evaluar la fila que actualiza, no los subselects sobre otras tablas.
- **Índice único parcial:** una sola inscripción `VIGENTE` por (alumno, turno). Va en SQL dentro de la migración, porque Prisma no modela índices parciales.
- **Sin migración de datos (decisión del PO):** no hay datos que preservar. La migración asume que las tablas de negocio (`turno_alumno`, `pagos`, `turnos`, `alumnos`…) están vacías y empieza con una guarda que, si encuentra filas en cualquiera de esas tablas de negocio (`turno_alumno`, `pagos`, `turnos`, `alumnos`, `profesores`, `materias`, `aulas`), falla con el mensaje «Esta migración requiere una base vacía: corré `prisma migrate reset`». Las inscripciones, pagos y fichas los crea el seed.

### 2.2 Servicio "vigente a un momento dado" (convención 8 a, Regla N.° 3)

Es un **único servicio público del módulo C** y lo usan los módulos C, E, H, I y J. Nadie reimplementa la regla. Para las consultas crudas y agregadas (2.0 y lecturas por mes de 2.13), el módulo C expone el fragmento SQL equivalente (`sqlVigenteEn(alias, momento)`); una prueba verifica que da el mismo resultado que `esVigenteEn` en los casos de 2.2.

- `esVigenteEn(inscripcion, momento)`: devuelve true si `vigencia = VIGENTE` y, si está `RESERVADA` en una clase Disponible o Completa, si `momento < venceEl`. Una reserva vence cuando el momento es igual o posterior a `venceEl`. En una clase Cancelada las reservas dejan de vencer y no cuentan como vencidas (HU-C-24, criterio 6).
- `inscripcionesVigentes(db, turnoId, momento)` y `ocupacion(db, turnoId, momento)`, donde `db` es la transacción del llamador o el cliente para lecturas fuera de una transacción: para el cupo, la superposición de horarios y el estado Disponible/Completa que se muestra.
- `marcarVencidas(tx, turnoId)`: dentro de la transacción del llamador, marca como `RESERVA_VENCIDA` las reservas ya vencidas de esa clase, solo si la clase está Disponible o Completa (en una Cancelada no vence nada: HU-C-24, criterio 6). Usa una condición atómica (Regla N.° 7) y registra como fecha el `venceEl` y como actor "Proceso automático". Toda operación que escribe sobre las inscripciones de una clase lo llama primero: inscribir, pagar, cancelar, quitar, desactivar alumno, cancelar clase y registrar clase dictada (HU-C-24, criterio 2).
- **`marcarVencidasDelAlumno(tx, alumnoId, { momento, clases })`:** marca como vencidas las reservas vencidas a `momento` de **ese alumno en las clases Disponibles o Completas indicadas**, que el llamador ya bloqueó. Toda operación que inscribe lo llama además de `marcarVencidas(tx, turnoId)`. Las clases que toca tienen que estar bloqueadas antes (ver «Bloqueos de una operación compuesta» en 2.16). Motivo: el EXCLUDE GiST de `reservas_turno` impide la superposición a nivel de base. Una reserva vencida que todavía no se marcó sigue teniendo su fila en `reservas_turno` y haría fallar la inscripción del alumno en otra clase superpuesta. HU-C-24, criterio 2, dice que no tiene que contar.
- `calcularVencimiento(momento, inicioClase, plazoHoras)`: devuelve `venceBaseEl = momento + plazoHoras` y `venceEl = min(venceBaseEl, inicioClase)`.
- **Estado Disponible/Completa:** `crearInscripcion`, `finalizarInscripcion`, `marcarVencidas` y `marcarVencidasDelAlumno` recalculan y guardan `Turno.estado` (DISPONIBLE ⇄ COMPLETO) en la misma transacción, con la clase bloqueada. El valor guardado puede quedar viejo por el vencimiento perezoso, así que ninguna lectura decide con él: las pantallas que ofrecen o muestran clases filtran `estado IN (DISPONIBLE, COMPLETO)` y deciden con `ocupacion(db, turnoId, ahora())` (HU-C-24, criterio 2). Ninguna HU actualiza `Turno.estado` por su cuenta.
- **Fechas y zona horaria:** todas las fechas de dominio se calculan en la zona `America/Argentina/Buenos_Aires` (UTC−3, sin horario de verano), que es una constante de un único módulo de fechas. `ahora()` devuelve un instante (`Date`, UTC). Un único helper `inicioDeTurno(turno)` arma el inicio de la clase con offset `-03:00`, e `inicioDelDiaCentro`/`finDelDiaCentro` resuelven «hoy» (por ejemplo, «vencieron hoy» de HU-C-26). El SQL crudo nunca usa `now()`: recibe `ahora()` como parámetro. Las fechas de dominio (`reservadaEl`, `registradaEl`, `emitidoEl`, `abiertaEl`…) se guardan con `ahora()`, no con `@default(now())`. El CI corre con `TZ=UTC` para detectar dependencias de la zona del proceso.

### 2.3 Pagos, operaciones y comprobantes (convención 8 b)

- **`OperacionPago`**:
  - campos: alumno, forma de pago, fecha de pago, usuario que registra, `registradaEl` y `cajaId` (NOT NULL: todo pago pertenece a una caja);
  - el total **no se guarda**: se calcula con los montos vigentes.
- **`Pago`** (uno por clase), **extendiendo el modelo actual** (1.1):
  - conserva `turnoId`, `alumnoId`, `montoPago` (decimal con 2 decimales: es el monto cobrado, mismo tipo y nombre de hoy), `createdAtPago` (se guarda con `ahora()`), `formaPagoId`, `fechaPago` y `creadoPorUsuarioId`. Son los valores **originales e inmutables**; el valor vigente de monto, forma y fecha sale de las correcciones (T6 y P-I2 de `spec_modulo_I.md`);
  - suma `operacionId`, `inscripcionId` (vínculo obligatorio), `precio` (entero en pesos, el de la clase), `motivoAjuste` y `ajustadoPor` (cuando el monto difiere del precio; `motivoAjuste` admite vacío porque el modo de compatibilidad de 2.13 no lo exige);
  - `OperacionPago` guarda **los mismos** valores de forma de pago, fecha de pago y usuario como base de `CorreccionOperacion`; `registrarOperacion` escribe ambos en la misma transacción. La v19 los *movía* a la operación, lo que dejaba de compilar los lectores de Sprint 2: gana lo existente (1.1) y esto se anota en «Decisiones tomadas».
  - índice de la operación por `(alumnoId, fechaPago)`, para `listarPagosDeAlumno` (R3-PR0-I2).
- **Correcciones y anulaciones como registros nuevos** (Regla N.° 8), nunca editando el original:
  - `CorreccionPago`: pago, valor anterior y nuevo, motivo, usuario y fecha.
  - `AnulacionPago`: pago, motivo, usuario y fecha. El motivo puede ser "Reintegro".
  - `CorreccionOperacion`: cambio de forma o de fecha de pago, que alcanza a todos los pagos de la operación.
- **`Comprobante`**:
  - campos: `numero` (entero), `operacionId`, `datos` (JSON con la copia fija de todo lo que muestra el comprobante según HU-I-11, criterio 2: alumno —nombre, apellido y DNI—; cada clase pagada —id del pago, materia, fecha, hora, precio y monto—; total; forma de pago; fecha de pago; usuario que registró; y datos del centro). Al verlo nada se lee de la operación, así un comprobante emitido no cambia cuando después se corrige la operación (HU-I-11, criterio 5). `datos` conserva el usuario real que registró el pago: el reemplazo por «Registrado en el centro» en la vista del alumno lo hace HU-I-11 (criterio 2) al mostrarlo, no el servicio, `emitidoEl` y `reemplazaAId` (nullable, **único**, para que dos comprobantes no reemplacen al mismo);
  - las marcas "ANULADO" y "Reemplazado por" **no se guardan en el comprobante**: salen de los registros de anulación y de reemplazo.
- **Secuencia** `comprobante_numero_seq`: el número se toma dentro de la misma transacción del pago. El formato visible es `0001-` más el número con 8 dígitos (por ejemplo, `0001-00000123`). Puede haber saltos, nunca repeticiones dentro de la misma base generada. `nextval` devuelve `bigint`: convertilo explícitamente a número. Al regenerar la base descartable con `prisma migrate reset`, la secuencia puede volver a empezar; la unicidad se exige dentro de cada base.
- **Sin pagos migrados:** la base empieza vacía (2.1), así que no hay operaciones ni comprobantes que migrar. Todo pago se crea con `registrarOperacion`, pertenece a una caja y su comprobante lo emite `emitirComprobante`.

### 2.4 Tarifas y precio congelado (convención 8 b, HU-L-06)

- `Materia.tarifaHora`: entero en pesos, mayor que 0, **admite vacío** (materia «sin tarifa»). **No es NOT NULL**: el alta de materia de Sprint 1 (HU-L-01) no recibe tarifa y tiene que seguir funcionando sin cambios (1.1; `spec_modulo_L.md`, P-L1 y 3.12). La tabla está vacía al migrar; el seed carga las materias **con** tarifa. El nombre real de la columna sigue la convención del `schema.prisma` (sufijo de entidad).
- `HistorialTarifa`: materia, tarifa anterior y nueva, usuario, fecha y `masivo` (booleano). La tarifa anterior **admite vacío**: la primera definición de la tarifa de una materia sin tarifa no tiene anterior. HU-L-06 escribe los cambios individuales (`masivo = false`) y HU-L-07 los masivos (`masivo = true`), todos en una transacción por operación y bloqueando las materias por id ascendente (2.10). El historial se inserta en la misma transacción que el cambio (`spec_modulo_L.md` §4).
- Seed: tarifas iniciales para todas las materias (valores de prueba, por ejemplo entre $ 9.000 y $ 13.000), solo al crear la materia: una segunda corrida no pisa los cambios de HU-L-06 o HU-L-07. **Los códigos de materia del seed cumplen la regla de HU-L-01 (solo letras y números, por ejemplo `FIS1`)**: los guiones del prototipo («FIS-1») son datos de muestra (P-L8).
- **Forma de los datos de tarifa (P-L5):** `HistorialTarifa` usa `materiaId`, `tarifaAnterior` (nullable), `tarifaNueva`, `usuarioId`, `fecha` y `masivo`, con los sufijos del schema. C e I no leen `Materia.tarifaHora` directamente (Regla N.° 3): usan `obtenerTarifasPorIds` de la fachada de L (activas o no, `null` si no hay tarifa). `precioClase` es un helper compartido de `src/server/shared`, no una función de L. `HistorialTarifa` se inserta **en la misma transacción** que el cambio (P-L6, confirmado: es un dato de negocio y el masivo es atómico; 2.10).
- Helper compartido `precioClase(materia, duracionMin) = tarifaHora × duracionMin / 60`. Lo usan HU-C-20, HU-C-22, HU-C-24 y HU-I-10. Las duraciones permitidas son 60, 120 y 180 minutos (`DURACIONES_PERMITIDAS_TURNO_MIN`), así que el resultado siempre es entero; si alguna vez no lo fuera, el helper falla en vez de redondear. Si la materia no tiene tarifa, `precioClase` lanza `MATERIA_SIN_TARIFA` (422, clave del archivo central) y `crearInscripcion` no crea la inscripción; lo mismo vale para el importe de «Se inscribe al confirmar el pago» de HU-I-10.

### 2.5 Caja y formas de pago (convención 8 b, HU-I-12)

- **`FormaPago.esEfectivo`:** booleano, NOT NULL, por defecto false. La migración lo pone en true para la forma de pago de efectivo (id fijo `formapago-efectivo` de la migración `20260921210000`; si ese id no existe, la migración **falla** con un mensaje que pide resolver a mano qué forma es el efectivo: no se elige por nombre). El seed hace lo mismo. El seed actual hace upsert **por nombre**: reemplazalo por identificación estable por id del catálogo migrado (en particular `formapago-efectivo`). La rama de actualización no cambia nombre, estado activo ni `esEfectivo`, para conservar las modificaciones de HU-I-07. Si falta el id esperado, aunque exista una forma con el mismo nombre normalizado, la migración falla (ver arriba): no crees una segunda forma ni la reasignes silenciosamente. El arqueo de HU-I-12 suma solo las formas con `esEfectivo = true`. Renombrar una forma (HU-I-07) no cambia la marca. Las formas que se crean desde la pantalla (HU-I-03) nacen con `esEfectivo = false`, y ninguna pantalla del sprint edita la marca: solo la tiene la forma «Efectivo» del sistema. Si se desactiva esa forma (HU-I-07), los cobros en efectivo dejan de ofrecerse pero el arqueo de las cajas sigue calculándose igual.
- **`Caja`**:
  - datos de la apertura: integrante, `abiertaEl`, `fondoInicial` y `estado` (`ABIERTA` o `CERRADA`);
  - datos del cierre: `cerradaEl`, `cerradaPor`, `porAusencia`, `efectivoDeclarado` (**admite vacío**: HU-I-12 lo guarda al declararlo, antes del cierre; R3-PR0-I6), `efectivoEsperado`, `diferencia` (con signo), `motivo` y `resumen` (JSON fijo del cierre);
  - **índice único parcial**: como máximo una caja `ABIERTA` por integrante.
- `MovimientoCaja`: caja, tipo (`INGRESO` o `EGRESO`), monto, concepto, usuario y fecha. Su anulación es un registro nuevo (`AnulacionMovimiento`).
- `AjusteCaja`: el dinero que se mueve al corregir o anular un pago de una caja cerrada. Campos: caja abierta destino, pago, corrección o anulación de origen, forma de pago, monto con signo, usuario y fecha. El cambio de forma de pago de un pago de una caja cerrada genera un **par** de ajustes (uno por forma, con signo opuesto); el efectivo esperado suma solo los ajustes de formas con `esEfectivo` (R3-PR0-I8).
- Cada `OperacionPago` nueva guarda su `cajaId`.

### 2.6 Parámetros y datos fijos del centro (convención 5, HU-N-01, HU-I-11)

- **Reutilizá `ParametroSistema`** (clave/valor) y sus lectores de `src/server/shared/parametros.ts` en lugar de crear `ConfiguracionCentro`. Claves nuevas:
  - `plazo_pago_horas` = 24
  - `cancelacion_anticipacion_horas` = 24
  - `umbral_presentismo` = 75
- `HistorialParametro`: `idHistorialParametro`, `clave`, `valorAnterior`, `valorNuevo`, `usuarioId` y `fecha` (HU-N-01, Regla N.° 2; lo escribe HU-N-01 después del commit).
- Datos fijos del centro para comprobantes e impresiones (HU-I-11 criterio 2, HU-I-12 criterio 8): `centro_nombre`, `centro_domicilio` y `centro_telefono`, como claves de `ParametroSistema`.
- **Quién los carga:** la **migración** inserta los valores por defecto de todas estas claves (como ya hacen `20260928150100` y `20260930120000` con otros parámetros), para que una base con solo migraciones ya tenga parámetros y datos del centro. El seed los crea si faltan y no pisa los valores que cambió HU-N-01 (upsert con la rama de actualización vacía).
- Servicio de lectura `parametrosVigentes()`, que reemplaza las lecturas directas de `parametroSistema` en `turno.generacion.service.ts:20` y `turno.validaciones.ts:37` (Regla N.° 3). Entrega `plazo_pago_horas`, `cancelacion_anticipacion_horas` y `umbral_presentismo` como **enteros** (C, N y H; HU-N-01 limita el umbral a 1–100) y **lee la base en cada llamada**, sin caché: un cambio de HU-N-01 rige en la operación siguiente (P-N2). Si alguna vez se agrega una caché, HU-N-01 tiene que invalidarla.
- Anotá qué se hace con `generacion_maxima_dias`: lo inserta una migración, pero no está en el seed ni lo lee el código.

### 2.7 Cuentas, sesiones y fichas del personal (convención 8 h, HU-A-06, RNF-SEG-04)

- Cuenta:
  - `debeCambiarPassword` (booleano, por defecto false; HU-A-06);
  - `sesionesValidasDesde` (fecha y hora, nullable): toda sesión iniciada antes de ese momento se rechaza.
- **Token de NextAuth:** el momento del login **ya existe** como claim `iat_sesion` (`src/auth.ts`, rama de sign-in). Se fija al ingresar y la renovación deslizante no lo cambia; solo se reemite al cambiar la contraseña (ver abajo). Guardá `sesionesValidasDesde` truncado a segundos, igual que `iat_sesion`, para que la comparación no falle por milisegundos. NextAuth tampoco reemite `jti`: solo `iat` y `exp` (`src/auth.ts:131-169`, `src/server/sesion/renovacion.service.ts`). **Usá `iat_sesion`**, no agregues otro claim.
  - **Dónde se compara:** en `src/server/shared/with-permission.ts`, junto a `verificarNoRevocado()`, que ya consulta la base en cada solicitud: si `iat_sesion < sesionesValidasDesde` o la cuenta está inactiva, 401. Lo usan los endpoints (`withPermission`) y las pantallas (`verificarPermiso`/`exigirPermiso`). Toda pantalla nueva del sprint llama a `exigirPermiso` (anotalo en RULES.md), así la revocación alcanza también a la navegación. El proxy (`src/proxy.ts`) **no consulta la base**, así que no puede hacer esa comparación.
  - **`debeCambiarPassword`** viaja **en el token** (se copia al iniciar sesión) para que el proxy redirija a la pantalla de cambio de contraseña sin consultar la base. Al cambiarla, se fija `sesionesValidasDesde = ahora` y se reemite el token de la sesión actual **con `iat_sesion = ahora`** y sin la marca, para que se cierren las otras sesiones y no la que hizo el cambio (HU-A-06, criterio 3). Mientras la marca esté activa, `withPermission` también rechaza toda solicitud salvo cambiar la contraseña, cerrar sesión y `sesion:ping` (HU-A-06: «el servidor rechaza cualquier otra solicitud de esa sesión»). Para esa decisión `withPermission` usa el valor de la base (ya la consulta en cada solicitud), no el del token; el token solo sirve para la redirección del proxy.
  - **Reemisión segura del token:** la rama `trigger === "update"` del callback `jwt` **no copia datos que mande el cliente** (`useSession().update(...)` llega a ese callback). La reemisión con `iat_sesion = ahora` se hace solo desde el servidor, en la server action de cambio de contraseña: o bien con `signIn` del proveedor de credenciales con la contraseña nueva (si el login no exige otro factor), o bien con un valor de un solo uso guardado en la base que el callback valida y consume. Anotá el mecanismo elegido en «Decisiones tomadas». Una prueba verifica que un `update` desde el cliente con otro `iat_sesion` o sin la marca no cambia el token.
  - Lo usan HU-D-08, HU-B-07, HU-F-05, HU-G-05, HU-A-05 y HU-A-06.
  - **Esquema que pide la spec A (R3-PR0-A1):** las dos columnas de arriba, las tablas `TokenRecuperacion` (hash, vencimiento, usado, cuenta) y `SolicitudRecuperacion` (límite por email) y los valores nuevos de `TipoEventoSeguridad`, que se agregan con `ADD VALUE` y **no se usan en la misma migración**.
  - **Código que pide la spec A (R3-PR0-A2 y A3):** `withPermission` suma el código `DEBE_CAMBIAR_PASSWORD` a `PermisoError`; `exigirPermiso` redirige a `/primer-ingreso` en ese caso (y a `/login` en `SESION_INVALIDA`, como hoy); los tests que mockean `withPermission` suman `usuario` a sus mocks. El callback `jwt` copia `debeCambiarPassword` al ingresar y se amplía el tipo del token; el proxy redirige a `/primer-ingreso` con la marca. `/primer-ingreso` es la única página que admite la marca (con sesión).
- Modelos `FichaMesaEntrada` y `FichaGerente`:
  - campos: nombre, apellido, DNI, fecha de nacimiento, género (opcional, con el enum `Genero` del schema), teléfono (opcional), email, `activo`, alta (fecha y usuario), última modificación y `usuarioId` (nullable, único);
  - además (P-F1, P-G1): `version` (entero, por defecto 0, concurrencia optimista), los campos normalizados de nombre y apellido (`normalizarTexto()`, mismo patrón que `Profesor`) y un índice por `(apellido normalizado, nombre normalizado, DNI)` que sostiene el orden del listado;
  - DNI único por tipo de ficha.
- **Fichas del personal:** las crea el seed base junto con cada cuenta interna de prueba, con datos de identidad de prueba. El email de la ficha es el email de la cuenta.
- **Cuentas de prueba extra en el seed:** al menos 2 cuentas de mesa de entrada y 2 de gerente, con sus fichas, para probar varias cajas abiertas, el cierre por ausencia (HU-I-12) y «al menos un gerente activo» (HU-G-05) antes de que existan HU-F-01 y HU-G-01. El seed asegura también cuentas de profesor vinculadas a las fichas que participarán en la demostración, con un conjunto identificado en «Decisiones tomadas»; las demás fichas de prueba pueden quedar sin acceso.

### 2.8 Clase dictada (convención 8 i)

- Agregá la marca de anulación de la clase dictada: `anuladaEl`, `anuladaPor` y `motivoAnulacion` (HU-E-11).
- **Índice único parcial:** una sola clase dictada **no anulada** por turno. Hoy la unicidad es `ClaseDictada.turnoId @unique`: hay que reemplazarla por el índice parcial, si no, después de anular no se puede registrar de nuevo. La relación pasa a 1:N (ver 2.0).
- La lógica y las pantallas de la asistencia individual las agrega HU-E-09; su esquema va en 2.14.

### 2.9 Permisos (convenciones 8 d y 8 g, HU-D-08)

**`ACCIONES_SOLO_MESA_ENTRADA` del seed (convención 8 d):** hoy el seed (paso 10 de `main()`, `prisma/seed.ts:1785`) borra en cada corrida `profesores:crear`, `profesores:editar` y `profesores:leer` de todos los roles salvo MESA_ENTRADA. Eso le quitaría al GERENTE la consulta de Profesores y las acciones de HU-D-08 que este PR le da. Revisá esa lista: debe quedar solo con las acciones que de verdad son exclusivas de mesa de entrada (`profesores:crear` y `profesores:editar`, que siguen siendo de mesa de entrada), sin `profesores:leer` ni las acciones nuevas del gerente. La prueba de la matriz de permisos (sección 4) se corre **después** de correr el seed.

**Tabla cerrada de acciones.** Como las HU no agregan migraciones, este PR define **todas** las acciones que usan las 40 HU. **La tabla definitiva es la de 2.9.1** (la matriz 2.8 de `spec_modulo_A.md` con los nombres que fijó cada spec). Antes de publicar las firmas, anotala en «Decisiones tomadas» (Acción | Roles | HU) con las correcciones que surjan al implementar; debe cubrir, como mínimo: baja y reactivación de alumno (HU-B-07); escrituras del historial académico de mesa de entrada y del profesor acotado (HU-E-04, E-07, E-10, E-11); ver comprobantes (HU-I-11: mesa, gerente y alumno solo los propios); «Mis pagos», «Mi historial» y cancelar la propia inscripción (HU-I-05, E-08, C-14); «Mi cuenta» y cambio de contraseña (HU-A-06, los cuatro roles); tarifas (HU-L-06 y L-07); cajas (abrir, movimiento, cerrar, cierre por ausencia y ver todas, HU-I-12); corregir y anular pagos (HU-I-06); personal de mesa de entrada y gerentes (HU-F, HU-G); configuración (HU-N-01); indicadores (HU-H); reservas (HU-C-26). Si una acción ya existe, indicá cuál se reutiliza en lugar de crear otra. La prueba de la matriz recorre esa tabla.

**Dónde:** cada acción nueva o modificada va en **una migración** (`INSERT INTO roles_permisos` / `DELETE`) **y** en la matriz del seed, como pide la spec A §2.4. Hoy hay acciones que solo están en el seed y una base sin seed queda sin ellas: `sesion:ping`, `materias:crear/leer`, `aulas:crear/leer`, `alumnos:crear`, `profesores:crear` y `calendario:leer`. Pasalas también a migración. Corregí `profesores:editar/leer`: las migraciones se las dan a GERENTE y ninguna a MESA_ENTRADA, al revés de la spec.

- **Gerente**:
  - Alumnos en modo consulta: listado, búsqueda y ficha con las pestañas Clases, Historial académico y Pagos (HU-E-02, criterio 8). No edita, no inscribe ni registra pagos.
  - Puede corregir y anular pagos (HU-I-06).
  - Detalle de la clase en modo consulta (HU-C-09).
  - Profesores: listado y ficha en modo consulta, y desactivar o reactivar (HU-D-08). Esto **deja sin efecto la decisión del Sprint 2 «el Gerente no administra Profesores»**. Los datos y las materias del profesor los sigue editando mesa de entrada.
  - **Clases futuras de un profesor que se está desactivando** (HU-D-08, criterio 2, revisión): puede cancelarlas y cambiarles el profesor desde el modal de la baja. Es un permiso acotado: solo sobre clases futuras de ese profesor y solo desde ese flujo. No da permiso general para cancelar ni editar clases. Dejá el chequeo de alcance como helper compartido, `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId, db?)`: devuelve verdadero si la clase pertenece al profesor indicado, **sin mirar estado ni fecha** (que la clase sea futura y esté Disponible o Completa lo exige la función de C que la procesa; R3-PR0-D2). La acción es una sola, `profesores:cambiar_estado`, solo del gerente: no se crean permisos sobre `turnos:*`.
  - Tarifas: cambiarlas (HU-L-06 y HU-L-07, con la misma acción; propuesta `materias:cambiar_tarifa`), formas de pago (HU-I-07), personal de mesa de entrada (HU-F), gerentes (HU-G), configuración (HU-N-01) e indicadores (HU-H).
  - Cajas: ve todas las cajas y todos los cierres y puede hacer el cierre por ausencia (HU-I-12). No abre cajas ni registra movimientos.
- **Mesa de entrada**:
  - Ve la tarifa de las materias y su historial, igual que el gerente, con una acción de lectura propia (propuesta `materias:ver_tarifa`): el profesor tiene `materias:leer` y no ve precios (HU-L-06, criterio 7), así que `materias:leer` no alcanza para decidir quién ve la tarifa (`spec_modulo_L.md` 2.7 y P-L2).
  - Es el único rol que registra pagos (HU-I-10, criterio 9).
  - Su propia caja: abrirla, registrar movimientos y cerrarla.
  - Corrige y anula pagos de los últimos 30 días, y solo si la caja del pago sigue abierta (HU-I-06).
  - Pantalla «Reservas» (HU-C-26): acción nueva `reservas:leer`, solo MESA_ENTRADA (en migración y seed). «Registrar pago» y «Quitar» usan las acciones que ya tiene (pagos e inscripciones).
- **Profesor** (8 g):
  - **Quitale** `alumnos:leer`, en el **mismo cambio** en que agregás el permiso acotado, para no romper su acceso actual.
  - Permiso acotado: accede al Historial académico de un alumno solo desde el detalle de una clase suya y solo en la materia de esa clase.
  - Helper `profesorPuedeVerHistorial(profesorId, alumnoId, materiaId)`, que **vive en el módulo E** (`src/server/historial/alcance-profesor.ts`, no en una fachada: combina `existeInscripcionVigenteConProfesor` de C con `profesorPuedeRegistrarIndicacion` de E y ninguna `*.publico.ts` importa a otra; R2-PR0-4): devuelve true si el alumno tiene una inscripción vigente en una clase de ese profesor y de esa materia, o si estuvo inscripto en una clase suya de esa materia registrada como dictada (no anulada). Si devuelve false, el servidor responde **403**. Este permiso habilita lectura.
  - **Escribir indicaciones (HU-E-04, criterios 2 y 3):** helper compartido `profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId)` del módulo E. Devuelve true si existe al menos una clase dictada **no anulada** de un turno cuyo profesor es `profesorId` y cuya materia es `materiaId`, en la que el alumno figura en el registro vigente de la clase dictada (el original o su última corrección), con cualquier estado: presente, ausente o sin control de asistencia. Esa misma definición de «alumno de una clase dictada» es la de la segunda condición de `profesorPuedeVerHistorial`. La pantalla del historial lo consulta para deshabilitar «Registrar indicación» con la leyenda de HU-E-04, criterio 2, y el servidor responde 403 si da false. Si el PO cambia la regla del ausente (Pendiente 12 del backlog), solo cambia este helper.
- **Alumno**: sus acciones nuevas (comprobantes propios, «Mi cuenta», cancelar la propia inscripción, si no existen ya) van en la tabla cerrada. «Mi historial», «Mis pagos» y sus comprobantes resuelven al alumno desde la sesión, nunca desde un parámetro.
- **Rutas:** actualizá `src/server/shared/rutas-por-rol.ts` (hoy autoriza por rol, en paralelo a `RolPermiso`) y el `matcher` de `src/proxy.ts` (hoy no incluye `/formas-pago` ni `/home`) para las rutas nuevas del sprint que ya se conozcan (reservas, cajas, personal, gerentes, configuración, mi cuenta). Habilitá para GERENTE las rutas existentes de Alumnos y del detalle de la clase (convención 8 d) y ocultá en esas pantallas las acciones que el rol no tiene, consultando el permiso de cada acción. Dejá **públicas** (sin sesión y sin la redirección de `debeCambiarPassword`) las rutas de «¿Olvidaste tu contraseña?» y de definir la contraseña nueva (HU-A-05) y el endpoint del proceso programado (HU-C-24): el matcher del proxy lo excluye, para que responda 401 sin el secreto en lugar de redirigir al login. Rutas previstas por las specs: `/primer-ingreso` y `/mi-cuenta` (A; con sesión), públicas `/recuperar-contrasena` y `/restablecer-contrasena` (A); `/alumnos` y `/alumnos/[id]` también para el gerente (B); `/reservas` (C, solo mesa de entrada) y la ruta del proceso de vencimiento, **fuera** del control de sesión y autenticada con `CRON_SECRET`; `/profesores` y `/profesores/[id]` también para el gerente, mientras `/profesores/nuevo` y la edición siguen siendo solo de mesa de entrada (D); `/mi-historial`, `/alumnos/[id]/clases` y `/turnos/[turnoId]/alumnos/[alumnoId]/historial` (E); `/gerente` (H); `/pagos/registrar`, `/caja`, `/cajas`, `/mis-pagos` y `/alumnos/[id]/pagos` (I); más las de F, G, L y N tal como las fija cada spec (la ruta real la fija `rutas-por-rol.ts`). Anotá las rutas que dejes previstas.

#### 2.9.1 Tabla cerrada de acciones del Sprint 3

Es la matriz 2.8 de `spec_modulo_A.md` (R3-PR0-A5) con los nombres que fijó cada spec. Todo va en **una migración** y en el seed. Anotala en «Decisiones tomadas» con las correcciones que surjan al implementar. Roles: M = MESA_ENTRADA, G = GERENTE, P = PROFESOR, A = ALUMNO.

**Permisos existentes que cambian**

| Acción | Roles después del cambio | HU | Cambio |
|---|---|---|---|
| `alumnos:leer` | M, G | HU-E-02 (criterio 8), convención 8 d y 8 g | El gerente lo gana (consulta). El profesor lo pierde, **en el mismo cambio** en que se agrega su acceso acotado al historial |
| `historial:leer` | M, G, P | HU-E-05, convención 8 g | Las filas no cambian; cambia el alcance del profesor (helper `profesorPuedeVerHistorial`) |
| `profesores:leer` | M, G | HU-D-05, HU-D-08 | El gerente lo gana (consulta). `profesores:crear` y `profesores:editar` siguen **solo** de M |
| `turnos:leer`, `pagos:leer`, `indicadores:leer`, `formas_pago:*` existentes | sin cambios | HU-C-09, HU-I-02, HU-H-06 | Sin filas nuevas; `indicadores:leer` sigue siendo solo del gerente |

**Permisos nuevos**

| Acción | Roles | HU | Notas |
|---|---|---|---|
| `cuenta:cambiar_password` | M, G, P, A | HU-A-06 | Junto con `sesion:ping`, la única acción que admite una cuenta con la marca «Debe cambiar la contraseña» |
| `observaciones:registrar` | M, P | HU-E-07 | |
| `indicaciones:registrar` | M, P | HU-E-04 | El alcance del profesor lo da `profesorPuedeRegistrarIndicacion` |
| `examenes:corregir` | M, P | HU-E-10 | Corregir y anular |
| `clases:corregir` | M, P | HU-E-11 | Corregir la asistencia y anular el registro |
| `historial:leer_propio` | A | HU-E-08 | «Mi historial»: el alumno sale de la sesión, nunca de un parámetro |
| `turnos:cancelar_propia` | A | HU-C-14 | |
| `reservas:leer` | M | HU-C-26 | Solo mesa de entrada |
| `pagos:corregir` | M (acotado), G | HU-I-06 | Mesa: últimos 30 días y caja del pago abierta (`puedeCorregirPago`) |
| `pagos:leer_propios` | A | HU-I-05 | «Mis pagos» |
| `comprobantes:leer` | M, G | HU-I-11 | |
| `comprobantes:leer_propios` | A | HU-I-11 | |
| `cajas:abrir`, `cajas:movimiento`, `cajas:cerrar`, `cajas:leer` | M | HU-I-12 | Solo su propia caja |
| `cajas:leer_todas`, `cajas:cerrar_ausencia` | G | HU-I-12 | El gerente no abre cajas ni registra movimientos |
| `formas_pago:editar`, `formas_pago:desactivar` | G | HU-I-07 | `desactivar` incluye reactivar |
| `materias:cambiar_tarifa` | G | HU-L-06, HU-L-07 | La misma acción para el cambio individual y el masivo |
| `materias:ver_tarifa` | M | HU-L-06 (criterio 7) | El gerente ve la tarifa con `materias:cambiar_tarifa`; el profesor tiene `materias:leer` y **no** ve precios |
| `alumnos:cambiar_estado` | M | HU-B-07 | Solo mesa de entrada |
| `profesores:cambiar_estado` | G | HU-D-08 | Desactivar, reactivar y las acciones sobre las clases futuras del profesor. **No** hay permisos nuevos sobre `turnos:*` |
| `personal:crear`, `personal:editar`, `personal:leer`, `personal:cambiar_estado` | G | HU-F-01, F-03, F-05 | |
| `gerentes:crear`, `gerentes:editar`, `gerentes:leer`, `gerentes:cambiar_estado` | G | HU-G-01, G-03, G-05 | |
| `configuracion:leer`, `configuracion:editar` | G | HU-N-01 | |

Reglas que no cambian: el profesor no recibe permisos de pagos, comprobantes, cajas ni tarifas; el gerente no tiene `pagos:crear` ni escrituras del historial académico; el alumno nunca manda un id de alumno. Si el PR 0 renombra una acción, solo cambia el `withPermission` de las rutas del módulo que la usa: avisá a su dueño.

### 2.10 RULES.md (convención 8 i)

Agregá o actualizá:

- **Orden de bloqueo único:**
  1. recurso (aula, materia, profesor, alumno, ficha del personal, ficha de gerente);
  2. clase;
  3. inscripción;
  4. operación de pago;
  5. caja.

  Dentro de cada tipo, por id ascendente. El conjunto «formas de pago activas» (HU-I-07, criterio 6) es un nivel propio que se toma antes que todo y no se combina con otros bloqueos.
- **Timeout explícito** para las transacciones interactivas: `maxWait` 2000 ms, `timeout` 8000 ms, aislamiento READ COMMITTED y, al empezar, `SET LOCAL lock_timeout = '5s'` y `SET LOCAL statement_timeout = '7s'` (el timeout de Prisma no corta por sí solo una espera de `FOR UPDATE` en el servidor). Los errores P2028, P2034, `55P03` (lock) y `40P01` (interbloqueo) se traducen a la clave `errores.transaccion.ocupada`, con el mensaje "Otra persona está modificando estos datos. Intentá de nuevo.".
- **Operaciones compuestas:** una operación que llama a varios servicios toma todos sus bloqueos al inicio, en una sola llamada a `bloquear` (2.16), y los servicios anidados no vuelven a bloquear hacia atrás.
- **Write skew:** cuando una regla depende de un conjunto (último gerente activo, última forma de pago activa), se bloquea el conjunto entero o se toma un bloqueo de transacción único. Una condición en una sola sentencia no alcanza con READ COMMITTED.
- **Historial de estados (Regla N.° 2):** se escribe después de confirmada la operación, con la cola `despuesDelCommit` de `transaccion` (2.16). Si falla, se reintenta y el error queda registrado.
- **Regla N.° 8:** correcciones y anulaciones como registros nuevos; las pantallas, los totales y los indicadores usan el valor vigente.
- **Regla N.° 1:** la inscripción ya no se borra. Documentá las excepciones que quedan (por ejemplo, `ProfesorMateria`).
- **Excepción documentada a la Regla N.° 10:** el endpoint del proceso programado de vencimientos (HU-C-24). Se autentica con `CRON_SECRET`, responde 401 sin el secreto y registra cada acción con el actor "Proceso automático".
- **Procesamiento en lote** (HU-D-08, criterio 2): cada clase se procesa y se revalida en su propia transacción. El resultado informa cuáles se procesaron y cuáles no, con el motivo de cada una.
- **Base de datos:** se exige `prisma migrate reset` en todos los entornos; las migraciones del Sprint 3 asumen tablas de negocio vacías (2.1).
- **Contraseña inicial** (HU-A-06): es el DNI y se cambia en el primer ingreso. El login **no** aplica la longitud mínima de la política, porque un DNI puede tener 7 dígitos y la política pide 8. La política se aplica al definir la contraseña nueva.
- **`ErrorDeDominio` extiende `ServiceError`** y los Route Handlers existentes siguen mapeando sus errores por `code` (2.13).
- **Excepción documentada a «el historial se escribe después del commit»:** `HistorialTarifa` (HU-L-06 y L-07) se inserta en la misma transacción que el cambio de tarifa, porque es un dato de negocio y el cambio masivo es atómico (2.4).
- **Excepción documentada a la Regla N.° 8:** la marca de anulación de `ClaseDictada` (`anuladaEl`, `anuladaPor`, `motivoAnulacion`, 2.8) se escribe una sola vez, con condición `anuladaEl IS NULL`, porque el índice único parcial de «una clase dictada no anulada por clase» la necesita en la propia fila. El contenido registrado no se modifica.
- Corregí las discrepancias conocidas **a favor de lo que el proyecto usa hoy** (1.1): RULES dice `prisma-client` y el generator real es `prisma-client-js`; RULES dice Node 24 mientras el CI usa 20 y el equipo 22. Se corrige el **texto** de RULES para que diga lo que se usa (generator `prisma-client-js`, Node 22). No cambies el generator ni el código para que coincidan con RULES. Llevar el CI y `engines` de `package.json` a Node 22 es opcional y solo se hace si `npm ci`, el build y los tests quedan en verde; si algo falla, el CI queda como está y se anota.

### 2.11 Variables de entorno (convención 8 j, Regla N.° 9)

Agregá a `.env.example`, sin valores reales:

- `RESEND_API_KEY`
- `EMAIL_FROM`: remitente del email; solo se usa si se carga `RESEND_API_KEY`. El envío real es opcional (decisión del PO): la demostración usa el simulador.
- `NEXTAUTH_URL`: URL pública del sistema (ya la requiere NextAuth); se documenta porque los enlaces de recuperación de contraseña la usan.
- Sin `RESEND_API_KEY` el envío de emails usa el simulador de `email.service.ts` (2.13).
- `CRON_SECRET`
- No se agrega `TZ_CENTRO`: la zona del centro es una constante del módulo de fechas (2.2), para que no dependa de la configuración de cada entorno.

Ningún secreto se escribe en el código ni en el seed. Revisá también que `CODIGO_OTP_SECRET` esté documentada.

### 2.12 Entorno de pruebas y CI (convención 8 f)

- `.github/workflows/ci.yaml` hoy corre solo lint, `prisma generate` y build. **HU-C-23 agrega el paso `npm test`** (su criterio 3 necesita que la prueba de claves corra en cada PR y se mergea antes que este PR). Este PR agrega `npx tsc --noEmit` y, si `npm test` todavía no está, lo agrega. Fijá la versión de Node del CI igual a la de RULES y `engines`.
- Los 14 archivos `*.pg.test.ts` (82 tests) se saltean si no hay `HU_Cxx_TEST_DATABASE_URL`. Ahí están las pruebas de los triggers y del EXCLUDE que este PR modifica (`turno.reservas.pg`, `turno.participantes.pg`, `turno.publico.pg`). Agregá un servicio `postgres:16` al CI y las variables que habilitan esos tests (listá todas las `HU_*_TEST_DATABASE_URL` que usa el repo), para que corran en cada PR. En el servicio se crean dos bases: una con `prisma migrate deploy` (migraciones solas, para comparar esquema y guarda) y otra con `prisma migrate reset --force` (migraciones y seed, para la matriz de permisos y la equivalencia de «Pagada»). Los `*.pg.test.ts` corren sin paralelismo entre archivos y con sus fábricas, sin depender de las cuentas del seed. El job corre con `TZ=UTC`. Antes de mergear, correlos también contra un PostgreSQL 16 descartable y anotá el resultado.
- La copia local tiene `recharts` declarado y no instalado (1 suite y 15 errores de `tsc` en la línea base). Corré `npm ci` antes de medir la regresión.
- Si `_auditoria/` queda en el repo, excluila de `tsconfig.json` y ESLint.
- Frontend: agregá con la CLI los componentes `tabs` y `table` de shadcn/ui si faltan (los necesita el panel de HU-H-06; no modifican nada existente).

### 2.13 Servicios de dominio compartidos (contratos entre HU)

Regla: **toda escritura sobre estas entidades pasa por su servicio**. Las HU agregan pantallas, endpoints, validaciones de UI y reglas propias de su caso, pero no escriben directo en las tablas. Cada servicio recibe la transacción del llamador como **primer** parámetro (`tx`), toma los bloqueos con 2.16, mantiene las invariantes y encola el historial de estados en `despuesDelCommit` (2.16). Los servicios **no devuelven textos**: lanzan `ErrorDeDominio(codigo, datos)` cuyo `codigo` es una clave del archivo central de textos de HU-C-23 (por ejemplo, `errores.reserva.noPendiente`, `errores.caja.sinCajaAbierta`, `errores.transaccion.ocupada`). **`ErrorDeDominio` extiende `ServiceError`** (`src/server/shared/service-error.ts`) y lleva, además de la clave del archivo central, el `code` estable que ve la API. Cuando la condición ya existe en los Sprints 1 y 2, el `code` es **el mismo que hoy devuelve el endpoint** (`TURNO_NO_ENCONTRADO`, `ALUMNO_NO_INSCRIPTO`, `FORMA_PAGO_NO_DISPONIBLE`…); los códigos nuevos son solo para condiciones nuevas (1.1). Así los Route Handlers existentes, que mapean por `error.code`, siguen sin cambios. Este PR agrega esas claves con los textos literales de los criterios, y el componente de HU-C-25 muestra ese texto dentro del mismo mensaje (criterio 6). Los servicios y sus dependencias no importan `server-only`, `next/*` ni `@/auth`, para que los usen también el seed y el script de caja. Las firmas son orientativas; anotá las reales en "Decisiones tomadas", porque son el contrato que usan las HU.

**Inscripción** (módulo C, `inscripcion.service.ts` + fachada `inscripcion.publico.ts`):
- `crearInscripcion(tx, { turnoId, alumnoId, origen: "ALUMNO" | "CENTRO" | "PAGO", conReserva, actor })`: llama a `marcarVencidas` y `marcarVencidasDelAlumno`, revalida cupo y superposición, guarda el precio con `precioClase` (si la materia no tiene tarifa, lanza `MATERIA_SIN_TARIFA` y no crea nada; 2.4) y crea la inscripción `VIGENTE`. Con `conReserva = true` queda `RESERVADA` con `inicioPlazo`/`venceBaseEl`/`venceEl`; con `conReserva = false` queda `PAGO_SIN_REGISTRAR`, sin plazo (comportamiento interino de 2.15). Con `origen = "PAGO"` (excepción de HU-C-24 crit. 3) queda `PAGADA` en la misma transacción del pago. Bloquea al alumno, la clase destino y las clases donde el alumno tiene reservas vencidas sin marcar, en una sola llamada a `bloquear` (2.16), recalcula `Turno.estado` (2.2) y rechaza a un alumno inactivo (HU-B-07, criterio 2). Para `origen = "ALUMNO"` con reserva aplica la regla de re-reserva (si el alumno ya tuvo en esa clase una reserva vencida o cancelada sin pago, rechaza: HU-C-22 crit. 4; no cuenta la cancelación de una inscripción sin reserva ni una reserva reabierta por anulación que vence: HU-C-24 crit. 5).
- `exigeInscripcionConPago(tx, { turnoId, alumnoId })`: misma regla de re-reserva, como consulta. **No** la aplica `crearInscripcion(origen = "CENTRO")`: la usa HU-C-24 (crit. 3) en su flujo para derivar a la inscripción con pago. Así, hasta que esté HU-C-24, mesa de entrada puede seguir inscribiendo a cualquier alumno.
- `finalizarInscripcion(tx, { inscripcionId, vigencia, actor, fecha?, soloSiReservaPendiente? })`: `CANCELADA_ALUMNO`, `RESERVA_VENCIDA`, `BAJA_ALUMNO` o `QUITADA_CENTRO`, con condición atómica sobre la vigencia actual; recalcula `Turno.estado` (2.2). Con `soloSiReservaPendiente` la condición exige además `estadoPago = RESERVADA` y `venceEl > ahora`; si no se cumple, falla con «Esta reserva ya no está pendiente: se pagó o venció.» (HU-C-26, criterio 6).
- `marcarPagada(tx, inscripcionId, pagosNoAnulados)` y `recalcularEstadoPago(tx, inscripcionId, pagosNoAnulados)`: reciben el conteo de pagos no anulados de la inscripción, calculado por el servicio de pagos (C no lee `pagos`: Regla N.° 3; R3-PR0-I3); mantienen «Pagada ⇔ al menos un pago no anulado»; al pasar a `PAGADA` limpian `venceBaseEl` y `venceEl`. Si se anula el último pago, aplica HU-C-24 crit. 5: vuelve a `RESERVADA`, fija `inicioPlazo = ahora`, `venceBaseEl = inicioPlazo + plazo vigente en ese momento` y `venceEl = min(venceBaseEl, inicioClase)`, con `reabiertaPorAnulacion = true`; queda `PAGO_SIN_REGISTRAR` si la clase ya empezó o está cancelada (en una clase cancelada no se crea reserva, HU-C-24 crit. 5, pero la inscripción vigente deja de estar `PAGADA`), y no cambia nada si la inscripción ya no está vigente (no tiene estado de pago). Así la equivalencia «Pagada ⇔ al menos un pago no anulado» se mantiene en todos los casos, incluido el reintegro por clase cancelada. En una clase ya iniciada o cancelada, `PAGO_SIN_REGISTRAR` es un estado informativo: la interfaz no ofrece cobro ni muestra una invitación a pagar.
- `recalcularVencimientos(tx, turnoId)`: para la reprogramación (2.0), primero marca las reservas ya vencidas según el vencimiento anterior y luego actualiza solo las que siguen vigentes con `venceEl = min(venceBaseEl, nuevoInicio)`, sin cambiar `inicioPlazo` ni `venceBaseEl`.
- **Aclaraciones de las specs B y C a las funciones de inscripción** (R3-PR0-B3, R6-PR0-1, R6-PR0-4, R6-PR0-9, R6-PR0-10):
  - `crearInscripcion` conserva los códigos de hoy `ALUMNO_NO_ENCONTRADO` (404) y `ALUMNO_INACTIVO` (409) y acepta un `alumnoActivo` ya resuelto (el autoservicio lo trae resuelto). Aun así, y como todo servicio que inscribe, llama a `verificarAlumnoActivo(alumnoId, tx)` **después** de bloquear al alumno, para decidir sobre la fila bloqueada (HU-B-07). La firma no cambia.
  - `crearInscripcion`, `finalizarInscripcion`, `marcarVencidas` y `marcarVencidasDelAlumno` solo recalculan DISPONIBLE ⇄ COMPLETO en clases confirmadas: **no cambian el `Turno.estado` de una clase `PENDIENTE` ni `CANCELADO`**. La salida de `PENDIENTE` es exclusiva del alta de la clase (`spec_modulo_C.md` 2.2, paso 8).
  - El precio se obtiene con `obtenerTarifasPorIds` (fachada del módulo L) y se calcula con `precioClase` (2.4): C no lee `Materia.tarifaHora` directamente (Regla N.° 3).
  - `exigeInscripcionConPago` devuelve además el **motivo** (reserva vencida, o cancelada sin pago) y no cuenta una reserva pagada ni una reabierta por anulación.
  - `marcarVencidas` devuelve la **cantidad marcada**. C publica además la lectura `clasesConReservasVencidas(db, momento)` para el proceso programado de HU-C-24.
  - C publica las lecturas «inscripción **vigente** de un par (alumno, clase)» y «inscripción **más reciente** del par», ambas con `db?`, para las operaciones de cancelación, quitado y baja.
  - B-07 agrega, en su propio PR, `darDeBajaInscripcionesDeAlumno` y `alumnoTieneRegistros` en la fachada de C (y E e I su propio `alumnoTieneRegistros`): este PR solo lo anota en «Lo usan» (R3-PR0-B4).
- Lo usan: 2.0 (código existente), HU-C-20, C-22, C-24, C-26, C-14, B-07, I-10, I-06 y el proceso programado.

**Operación de pago y comprobante** (módulo I, `pago.service.ts` + `pago.publico.ts`):
- `registrarOperacion(tx, { alumnoId, items, formaPagoId, fechaPago, usuarioId, modo })`, con `modo: "completo" | "compatSprint2"` y cada ítem `{ inscripcionId }` o `{ crearInscripcion: { turnoId } }` más `monto` y `motivoAjuste?`. Devuelve la operación, los pagos creados y el comprobante (R3-PR0-I1). Para el ítem «Se inscribe al confirmar el pago» obtiene la tarifa con `obtenerTarifasPorIds` y calcula con `precioClase`. Hace lo siguiente: toma al inicio, en una sola llamada a `bloquear`, al alumno, las clases, las inscripciones existentes y la caja abierta del usuario (ahí revalida que siga `ABIERTA`; `cajaAbiertaDe` solo lee), revalida cada inscripción bloqueada (vigente, no vencida, sin pago no anulado), crea operación y pagos, llama a `marcarPagada` y a `emitirComprobante`. Se cobran inscripciones vigentes en `RESERVADA` (no vencida) o en `PAGO_SIN_REGISTRAR`, de clases Disponibles o Completas. Todo cobro, y toda inscripción creada al confirmar el pago, requiere que la clase no haya empezado (HU-C-22: «el pago se hace antes de la clase»), comparando con el momento del registro (`ahora()`) y no con `fechaPago`; no hay excepciones. En una clase cancelada no se cobra. Todo en una transacción.
  - **Modo de compatibilidad (`compatSprint2`, permanente):** lo usa **solo** el `POST /api/pagos` existente (2.15). Con el modo activo la operación **no** exige que la clase no haya empezado, **no** rechaza una inscripción que ya tiene un pago no anulado y **no** exige `motivoAjuste` cuando el monto difiere del precio. Son reglas de HU-I-10 (criterios 3, 4 y 7) y el cobro de Sprint 2 no las tiene (admite clases ya iniciadas y pagos parciales: `spec_modulo_I.md` Q6a y AC3), así que exigirlas desde el PR 0 rompería lo existente (1.1). Sigue exigiendo caja abierta, clase Disponible o Completa, forma de pago activa y fecha de pago no futura, y emite el comprobante. HU-I-10 usa el modo completo, pero **el modo de compatibilidad no se elimina**: es el que mantiene el contrato de Sprint 2 de `POST /api/pagos` (1.1). La v19 decía que HU-I-10 lo eliminaba; se corrige (R3-PR0-I1).
- `corregirPago`, `anularPago` y `corregirOperacion` (forma o fecha): registros nuevos (Regla N.° 8), `recalcularEstadoPago`, comprobante de reemplazo o marca de anulado, y el ajuste de caja cuando corresponde (`registrarAjuste`). Reciben `cajaAjusteId?`: obligatorio cuando la caja del pago está cerrada y el cambio mueve dinero (HU-I-12, criterio 4: el gerente elige la caja abierta que entrega o recibe el dinero); si falta o esa caja no está abierta, fallan con la clave del texto «Para registrar este cambio tiene que haber una caja abierta en mesa de entrada». Reglas de alcance por rol y antigüedad como helper (`puedeCorregirPago(usuario, pago)`) para que HU-I-06 solo arme la pantalla.
- `emitirComprobante(tx, operacionId)` y `emitirReemplazo(tx, comprobanteId)`: sirven a todos los pagos (HU-I-10/HU-I-06 y el seed). Es el único camino que emite comprobantes; HU-I-11 agrega la vista, la impresión y el acceso por rol.
- Lo usan: HU-I-10, I-06, I-11, I-12, C-24 (inscripción con pago), C-26 (registrar pago) y C-14/B-07 (reintegro).

**Caja** (módulo I, `caja.service.ts`):
- `abrirCaja`, `cajaAbiertaDe(tx, usuarioId)` (solo lectura, sin bloqueo), `registrarMovimiento`, `anularMovimiento`, `registrarAjuste` (con un par de ajustes para el cambio de forma de pago), `declararEfectivo` (guarda `efectivoDeclarado` solo si está vacío y la caja está abierta), `calcularResumen` (devuelve el resumen y la huella) y `cerrarCaja` (arqueo con `esEfectivo`, bloqueo de la caja según 2.16; toma el efectivo declarado de la fila). La huella incluye también las correcciones y anulaciones de pagos de la caja. `cerrarCaja` recibe una huella del resumen que se mostró en el paso 2 de HU-I-12 (efectivo esperado y, por tipo, cantidad y último id de pagos, movimientos, anulaciones y ajustes de la caja) y, con la caja bloqueada, falla con «La caja cambió mientras cerrabas. Revisá el resumen.» si la huella cambió, aunque el cambio sea en una forma de pago que no es efectivo (HU-I-12, criterio 5).
- Así HU-I-10 cumple su crit. 10 («cobrar exige caja abierta») **desde su propio merge**, sin esperar a HU-I-12: hasta que exista la pantalla de HU-I-12, las cajas de prueba se abren con el seed (2.15). HU-I-12 agrega pantallas, arqueo ciego en la UI, cierre por ausencia y consultas.

**Cuenta y sesión** (módulo A, `src/server/usuarios/cuenta.service.ts`; las cuatro funciones de `usuario.service.ts` no cambian de firma ni de comportamiento). Las que escriben reciben el `tx` del llamador; las lecturas aceptan `db?`. Ninguna valida permisos:
- `crearCuentaParaFicha(tx, { email, dni, rol, ip? })` → `{ usuario_id }`: crea la cuenta con el DNI como contraseña inicial y la marca `debeCambiarPassword`; `409 EMAIL_YA_ASOCIADO` si el email está en uso.
- `cambiarEmailCuenta(tx, { usuarioId, email })` → `{ cambio }`: misma validación de unicidad; **no revoca sesiones**. Comparte implementación con `actualizarEmailCuenta`, que se conserva.
- `desactivarCuenta(tx, usuarioId)` y `reactivarCuenta(tx, usuarioId)` → `{ cambio }`: desactivar también revoca las sesiones; ambas idempotentes.
- `revocarSesiones(tx, usuarioId)`: fija `sesionesValidasDesde = ahora` truncado a segundos y **nunca lo retrocede**.
- `cambiarPassword(tx, { usuarioId, nueva, conservarSesionActual })` → `{ reemitir_sesion }`: guarda el hash, quita la marca, revoca sesiones; con `true` (HU-A-06) la sesión actual sigue (reemisión de 2.7), con `false` (HU-A-05, sin sesión) caen todas.
- Lecturas: `obtenerEstadoCuenta(usuarioId, db?)`, `obtenerResumenCuenta(usuarioId | null, db?)` (`ACTIVA` | `INACTIVA` | `SIN_CUENTA`; nunca devuelve el hash), `filtrarCuentasActivas(tx, usuarioIds)` (para «al menos un gerente activo», HU-G-05) y `verificarEmailNoAsociadoAOtraCuenta` (existente).
- `src/server/email/email.service.ts`: envío de emails con **simulador** cuando no hay `RESEND_API_KEY` (R3-PR0-A4).
- Lo usan: HU-A-06, A-05, D-01, D-06, D-08, B-01, B-07, F-01, F-05, G-01 y G-05.

**Lecturas públicas** (Regla N.° 3; cada una en la fachada `*.publico.ts` del módulo dueño del dato). Las HU de consulta e indicadores leen solo por acá, nunca las tablas de otro módulo. Todas clasifican cada inscripción con `esVigenteEn(inscripcion, ahora())`: una reserva vencida sin marcar cuenta como «Reserva vencida», nunca como vigente. Este PR implementa estas lecturas base con sus pruebas; si una HU necesita otra, o un filtro más (por ejemplo, el estado de la clase para HU-H-10, las clases sin control para HU-H-07 o el estado de pago para HU-I-02), lo agrega en la misma fachada y en su propio PR:
- Módulo C: `listarInscripcionesDeAlumno(alumnoId, { desde?, hasta?, resultado? })`, con el resultado de cada clase para el alumno (HU-E-02, HU-C-13); `contarInscripcionesPorMes(rango, { vigencias, porMateria? })` (cancelaciones, vencidas y bajas de HU-H-10; la ocupación de HU-H-06 sigue saliendo de `promediarOcupacionTurnosPorMes`, que conserva su contrato, y los inscriptos de HU-H-07 **no** salen de C sino de E: son `presentes + ausentes` de `contarAsistenciasPorMes`); `contarClasesPorMes(rango, { estados, por: "materia" | "profesor" })` (HU-H-03, HU-H-10); y para HU-C-26: `listarReservasPendientes({ alumno?, materiaId?, vencen?, pagina })` (reservas `RESERVADA` de clases Disponibles o Completas con `venceEl > ahora`, ordenadas por vencimiento, con el precio guardado y cuántas reservas pendientes tiene cada alumno), `listarReservasVencidas({ dias: 7, alumno?, materiaId?, pagina })` (las marcadas `RESERVA_VENCIDA` en el período, sea cual sea el estado actual de la clase, y las vencidas sin marcar de clases Disponibles o Completas, con una marca que las distingue; en una clase Cancelada no vence nada, así que sus reservas pendientes no se listan como vencidas: HU-C-24, criterio 6) y `resumenReservas()` (pendientes con su importe total, las que vencen en las próximas 3 horas, las que vencen hoy y las que vencieron hoy). No hace falta una tabla de corridas del proceso: «cuántas reservas vencieron hoy» sale de las inscripciones.
- Módulo C, además (lecturas de solo lectura, en lote y sin bloqueo): `listarInscripcionesDeAlumno` devuelve por inscripción `{ inscripcion_id, turno_id, fecha, hora_inicio, hora_fin, estado_clase, materia, profesor, aula, vigencia, vigente_ahora, finalizada_el, cancelada_el }` (R2-PR0-3); `existeInscripcionVigenteConProfesor(alumnoId, profesorId, materiaId, db?)`; `inscripcionesVigentes(db, turnoId, momento)` y `marcarVencidas(tx, turnoId)` exportadas en `inscripcion.publico.ts` con `{ id, alumnoId }`; `obtenerClasesBasicas(turnoIds, db?)`; `clasesConReservasVencidas(db, momento)`; y los campos de las listas de reservas de la spec C 2.20 (alumno con DNI y cantidad de reservas pendientes, clase con aula y profesor, precio guardado, `vence_el`, filtro `vencen` = `en_3_horas` | `hoy` | `manana`, y `sin_marcar` en las vencidas).
- Módulo E: `asistenciaDeAlumno(alumnoId, materiaId?)` (HU-E-02, E-05, E-08), `contarAsistenciasPorMes(rango, { porMateria? })` (HU-H-07), `contarClasesDictadasSinControl(rango, db?)` (HU-H-07), `listarAlumnosConPresentismoBajo(rango, { umbral, minimoClases, limite, desplazamiento }, db?)` (HU-H-07) y `profesorPuedeRegistrarIndicacion` (HU-E-04), excluyendo clases dictadas anuladas y «sin control de asistencia».
- Módulo D: `obtenerProfesoresBasicos(ids, db?)` (HU-H-03, HU-H-10). Módulo L: `obtenerTarifasPorIds(ids, db?)` (C e I).
- Módulo I: `listarPagosDeAlumno(alumnoId, filtros)` con monto vigente y anulados (HU-I-02, I-05) y `sumarPagosPorMes` con montos vigentes y sin anulados (se reescribe en la etapa 2 en la misma fachada; sus consumidores se pasan en la etapa 3; HU-H-06; reemplaza la versión actual).
- Módulo I, además: lecturas públicas de pagos y de cajas con sus pruebas (R3-PR0-I11) y `usuarioRegistroOperaciones(tx, usuarioId)`, que la spec F usa para decidir si el motivo de la baja del integrante es obligatorio (DEC-39); cada módulo dueño expone la suya sobre sus propias tablas.
- **Funciones públicas de Sprint 2 del módulo I** (`pago.publico.ts`): `listarPagosDeTurno(turnoId, db?)` y `sumarPagosPorMes(desde, hasta, db?)` **conservan firma y forma del resultado** (`PagoDeTurno`; `{ mes, total }[]` con `total` como texto decimal exacto). Cambia el origen: monto vigente (con correcciones) y sin anulados. Sus consumidores (detalle de la clase, indicadores) no cambian de contrato.

**Clase dictada** (módulo E, `clase-dictada.service.ts` adaptado en la etapa 3): `registrarClaseDictada(tx, { turnoId, actor, asistencias?: { inscripcionId, estado }[] })`. Guarda una fila por cada inscripción vigente al registrarla (`esVigenteEn`), también en el flujo sin control (estado null). Este PR la deja sin `asistencias` (`conControlAsistencia = false`, estados null); HU-E-09 implementa la rama con asistencias sin cambiar la firma. Lo usan el seed (historial académico de prueba), HU-E-09, E-11 y las fixtures de HU-H-07.

**Baja y reactivación de entidades** (compartido): `registrarCambioEstado(tx, { entidad, id, accion, motivo?, actor })` sobre la tabla de historial de 2.14 y su lectura **`listarHistorialEstados(entidad, id, db?)`**, que **publica este PR en la etapa 2** (R7-PR0-1; ya no la agrega HU-D-08). Entidades admitidas: `ALUMNO` (HU-B-07), `PROFESOR` (HU-D-08), `FICHA_MESA_ENTRADA` (HU-F-05), `FICHA_GERENTE` (HU-G-05) y `FORMA_PAGO` (HU-I-07); acciones `DESACTIVAR` y `REACTIVAR`. Lo usa además I para los cambios de estado de pago que provoca un cobro, una corrección o una anulación. Lo usan HU-D-08, B-07, F-05, G-05 e I-07; las fichas lo leen para mostrar el historial (DEC-37).

**Códigos de error de dominio nuevos** (R6-PR0-2, R3-PR0-D*, R2-PR0-6, R3-PR0-I4). Cada uno lleva su clave del archivo central de textos y su `code` HTTP estable; los de las condiciones que ya existen en los Sprints 1 y 2 conservan el `code` y el texto de hoy (1.1). `errores.transaccion.ocupada` mapea a `409 TRANSACCION_OCUPADA`.

| Módulo | Códigos nuevos | Detalle |
|---|---|---|
| C | `MATERIA_SIN_TARIFA` 422, `RESERVA_PREVIA_SIN_PAGO` 409, `INSCRIPCION_REQUIERE_PAGO` 409, `RESERVA_NO_PENDIENTE` 409, `INSCRIPCION_NO_VIGENTE` 409, `CANCELACION_FUERA_DE_PLAZO` 409, `INSCRIPCION_NO_ENCONTRADA` 404 | `spec_modulo_C.md` 2.16.7 |
| D | `PROFESOR_CON_CLASES_FUTURAS`, `PROFESOR_YA_INACTIVO`, `PROFESOR_YA_ACTIVO`, `MOTIVO_REQUERIDO`, `MATERIAS_DISTINTAS`, `PROFESOR_DESTINO_IGUAL_ORIGEN` | `spec_modulo_D.md` (HTTP en cada sección) |
| E | los de las secciones 2.6 a 2.12 | `spec_modulo_E.md` |
| I | `CAJA_NO_ABIERTA` 409 (2.15) y los de 2.7.6, 2.10.5, 2.14.5 y 2.16.4 | `spec_modulo_I.md` |

La prueba de claves (HU-C-23) cubre todos los `codigo` nuevos. Si un código de estas specs choca con uno ya existente, gana el existente y se anota en «Decisiones tomadas».

### 2.14 Todas las migraciones del sprint van en este PR

Para que ninguna HU tenga que agregar migraciones en paralelo (dos migraciones creadas en ramas distintas chocan en orden y en `schema.prisma`), este PR incluye también el esquema que necesitan estas HU, aunque su lógica la hagan ellas:

- **HU-E-09:** estado de asistencia por alumno (`PRESENTE`/`AUSENTE`, nullable) en `ClaseDictadaAlumno` o tabla equivalente, y en `ClaseDictada` la marca `conControlAsistencia`, fijada al crear el registro: false con el flujo actual de HU-E-01 (que deja el estado en null) y true con el de HU-E-09. La corrección de HU-E-11 es un registro nuevo con sus propios estados y su propia marca; «con control» es la marca de la última corrección o, si no hay, la del registro original. Así cargar la asistencia por primera vez (HU-E-11, criterio 2) no edita la fila original (Regla N.° 8).
- **HU-E-11:** corrección de asistencia como registro nuevo (Regla N.° 8) y la anulación de 2.8.
- **HU-E-07:** observaciones de la clase (temas vistos, observaciones internas, usuario, fecha), con `claseDictadaId` único. Cada registro de clase dictada tiene a lo sumo una observación; si se anula y se registra otra clase dictada para el mismo turno, esta tiene otro id y admite observaciones nuevas. Las anteriores se conservan ocultas según HU-E-07.
- **HU-E-04:** indicación académica (alumno, materia, clase dictada opcional, texto, usuario, fecha).
- **HU-E-10:** corrección y anulación de resultado de examen como registros nuevos.
- **HU-A-05:** token de recuperación (hash, vencimiento, usado, cuenta) y su límite por email.
- **Bajas y reactivaciones** (HU-D-08, B-07, F-05, G-05, I-07): tabla de historial de estados con entidad, id, acción, motivo, usuario y fecha (Reglas N.° 1 y 2).
- **Detalle de esquema que piden las specs** (el nombre final sigue la convención del `schema.prisma`; la forma —columnas, nulidad, unicidades— es la de cada spec):
  - **A (R3-PR0-A1):** dos columnas en `Usuario` (2.7), las tablas `TokenRecuperacion` y `SolicitudRecuperacion` y los valores nuevos de `TipoEventoSeguridad`.
  - **E (R2-PR0-1):** en `ClaseDictada`, `conControlAsistencia`, `anuladaEl`, `anuladaPor`, `motivoAnulacion` y el índice único parcial (2.8); `ClaseDictadaAlumno.estadoAsistencia` (enum `EstadoAsistencia`, admite vacío); `CorreccionAsistencia` y `CorreccionAsistenciaAlumno`; `ObservacionClase`; `Indicacion`; `CorreccionResultadoExamen` y `AnulacionResultadoExamen`, con sus índices.
  - **F y G (P-F1, P-G1):** `version`, campos normalizados e índice de orden en `FichaMesaEntrada` y `FichaGerente` (2.7).
  - **I (R3-PR0-I2, I6):** `Pago` conserva `formaPagoId`, `fechaPago` y `creadoPorUsuarioId` (2.3); índice de `OperacionPago` por `(alumnoId, fechaPago)`; `Caja.efectivoDeclarado` admite vacío (2.5).
  - **L (P-L1):** `Materia.tarifaHora` e `HistorialTarifa.tarifaAnterior` admiten vacío (2.4).
  - **N:** `HistorialParametro` (2.6).
  - **Historial de estados:** entidades `ALUMNO`, `PROFESOR`, `FICHA_MESA_ENTRADA`, `FICHA_GERENTE` y `FORMA_PAGO`; acciones `DESACTIVAR` y `REACTIVAR` (2.13).
  - **D (R3-PR0-D8):** si `tipoEvento` de `eventos_turno` es un enum, se suma `turno:profesor_cambiado`.

- **Enums:** este PR crea todos los valores de enum que usan las HU (acciones de baja y reactivación, tipos de evento de seguridad de HU-A-05 y HU-A-06, `actorTipo`, tipos de movimiento de caja), listados en «Decisiones tomadas», o usa `String` validado en el código para los tipos de evento. Un valor agregado con `ALTER TYPE … ADD VALUE` no se usa en la misma migración.

Si durante el sprint una HU necesita un cambio de esquema que no está acá, lo coordina con el responsable del PR 0 y se hace en **una sola migración por día**, mergeada antes que la HU (convención 8, último párrafo).

### 2.15 Comportamiento interino (la rama principal funciona en todo momento)

Desde el merge del PR 0 y hasta que se mergee cada HU:

- **Inscribirse desde «Solicitar clase» (HU-C-12)** usa `crearInscripcion(origen = "ALUMNO", conReserva = false)`: la inscripción queda `PAGO_SIN_REGISTRAR`, sin plazo, como hoy. HU-C-22 la pasa a `conReserva = true` (queda `RESERVADA` con su vencimiento) y agrega el resumen, los textos, la regla de re-reserva y «Mis clases»; HU-C-20 agrega el resumen previo.
- **Inscribir desde el centro (HU-C-04/C-18)** usa `crearInscripcion(origen = "CENTRO", conReserva = false)`: también queda sin plazo, como hoy. HU-C-24 la pasa a `conReserva = true` y agrega el «Registrar pago» al terminar y la excepción de re-inscripción (con `exigeInscripcionConPago` y `origen = "PAGO"`). Así lo dice el backlog: HU-C-24 «cambia el comportamiento de HU-C-04 y HU-C-18, que hasta ahora inscribían sin plazo de pago».
- **Vencimiento:** aunque el proceso programado (HU-C-24) no exista, toda operación vence perezosamente con `marcarVencidas` (2.2) las reservas que ya existan. Ninguna reserva vencida retiene cupo.
- **Registrar pago (HU-I-01, desde el detalle de la clase):** `POST /api/pagos` **conserva su contrato de Sprint 2** (1.1). Pedido `{ turno_id, alumno_id, monto, forma_pago_id, fecha_pago? }`, con `monto` como texto decimal de hasta 2 decimales; respuesta `201` con `PagoRegistrado` (`id`, `turno_id`, `alumno`, `monto`, `forma_pago`, `fecha_pago`); y los códigos `TURNO_NO_ENCONTRADO` 404, `TURNO_NO_ADMITE_PAGO` 409, `ALUMNO_NO_INSCRIPTO` 409, `FORMA_PAGO_NO_ENCONTRADA` 404, `FORMA_PAGO_NO_DISPONIBLE` 409 y `FECHA_PAGO_FUTURA` 400. `GET /api/pagos/opciones` tampoco cambia. Por dentro, `registrarPago` busca la inscripción vigente del par (clase, alumno) y llama a `registrarOperacion` con **una** clase y el **modo de compatibilidad** de 2.13. Lo único nuevo para el cliente es que **exige una caja abierta del usuario** (`409 CAJA_NO_ABIERTA`, código nuevo, para una condición nueva) y que la respuesta puede traer campos extra (el comprobante). El seed deja **una caja abierta para cada cuenta de mesa de entrada de prueba** (si después se la cierra, el seed no la vuelve a abrir: se usa el script de abajo). Hasta HU-I-12 no hay pantalla para abrir una caja: este PR deja un script documentado (`npm run caja:abrir -- <email>` o equivalente, que llama a `abrirCaja`) para abrir la caja de una cuenta de mesa de entrada creada por el seed. Se prueba en una base con seed tras cerrar la caja de una cuenta operativa de demostración; el seed no la vuelve a abrir. Una base con solo migraciones no tiene esas cuentas y se usa únicamente para verificar migraciones y datos que estas insertan. HU-I-10 agrega el punto de entrada nuevo con varias clases y el modo completo; `POST /api/pagos` se queda con el modo de compatibilidad, que es permanente (2.13).
- **Comprobante:** se emite desde el primer pago (2.13). Hasta HU-I-11 no hay pantalla para verlo.
- **Quitar alumno y asignar participantes** dejan de borrar por dentro (2.0), pero **sus endpoints y respuestas no cambian** (1.1): el cliente ve lo mismo que hoy.
- **Cuentas:** las bajas existentes no cambian de comportamiento hasta sus HU, pero `withPermission` ya rechaza cuentas inactivas y sesiones revocadas (2.7).

Cada HU, al mergearse, reemplaza la parte interina que le corresponde y lo dice en su PR.

### 2.16 Utilidades para que el sistema crezca sin romperse

- **Bloqueo en orden canónico:** `bloquear(tx, { recursos?, clases?, inscripciones?, operaciones?, cajas? })` toma los `SELECT … FOR UPDATE` en el orden de 2.10 y, dentro de cada tipo, por id ascendente (`ORDER BY id`). Todas las transacciones nuevas lo usan, en vez de escribir los bloqueos a mano. Guarda en la transacción el último nivel e id tomados: pedir uno ya tomado no hace nada y pedir uno anterior lanza un error en desarrollo y en las pruebas. Evita interbloqueos a medida que se suman HU. **Recursos admitidos (nivel 1):** aula, materia, **profesor** (R3-PR0-D3), alumno, **ficha del personal** (P-F4) y **ficha de gerente**, esta última con **varias fichas a la vez por id ascendente** (P-G3, regla «al menos un gerente activo»). Además, el conjunto **«formas de pago»** (todas las activas, por id) para HU-I-07, criterio 6: es un nivel propio que se toma **antes que todo** y no se combina con otros bloqueos (R3-PR0-I9). Una operación de C que toca a un profesor (p. ej. la baja o el cambio de profesor de HU-D-08) lo incluye en su **única** llamada a `bloquear` y vuelve a leer su estado activo ya bloqueado.
- **Bloqueos de una operación compuesta:** `crearInscripcion` toma `momento = ahora()` una sola vez, lee primero (sin bloquear) las clases donde el alumno tiene reservas vencidas sin marcar a ese momento y después llama una sola vez a `bloquear({ recursos: [alumno], clases: [turnoId, ...esas] })`, antes de `marcarVencidasDelAlumno(tx, alumnoId, { momento, clases })` y `marcarVencidas`, que usan ese mismo momento y solo marcan reservas en clases ya bloqueadas. `registrarOperacion` bloquea alumno → clases (incluidas las de `crearInscripcion` y las de reservas vencidas sin marcar del alumno) → inscripciones → caja, y le pasa a `crearInscripcion` la indicación de que esos bloqueos ya están tomados. Una prueba con PostgreSQL real corre en paralelo una inscripción y un cobro con inscripción del mismo alumno en clases superpuestas, sin interbloqueo.
- **Transacción con timeout:** `transaccion(fn)` envuelve `$transaction` con los valores de 2.10 (anotalos en «Decisiones tomadas» en la etapa 2) y traduce esos errores a `ErrorDeDominio('errores.transaccion.ocupada')`, cuyo texto es «Otra persona está modificando estos datos. Intentá de nuevo.». Ofrece `ctx.despuesDelCommit(fn)`: los servicios encolan ahí el historial de estados; la cola corre solo si la transacción confirma, se descarta si revierte, y `transaccion` resuelve recién después de vaciarla, así el seed y las pruebas ven el historial.
- **Reloj inyectable:** `ahora()` en un solo lugar; devuelve un instante y se inyecta por contexto en pruebas, seed y fixtures (en producción no se puede cambiar). Lo usan todos los servicios de 2.13 y los que registran la clase dictada (`clase-dictada.service.ts`), cancelan una clase (`turno.cancelacion.service.ts`), dan de baja y vencen reservas, para poder probar «antes, en y después de `venceEl`» y «el proceso detenido» sin esperar. El seed ya tiene `SEED_FECHA_HOY`: alinealo con `ahora()`. Por defecto vale el día real (zona del centro) de la primera corrida; el CI puede fijarlo. Las clases de escenario quedan entre 2 y 14 días después de esa fecha, así el cobro interino y la reserva pendiente funcionan al sembrar. La reserva pendiente vence a las 24 h de sembrada y el seed repetido no la recrea: para volver a tenerla se usa `prisma migrate reset`.
- **Historial de estados con reintento:** `registrarHistorial(...)` corre desde `despuesDelCommit`, es idempotente (id generado antes del commit, único), reintenta hasta 3 veces y registra el error si falla (2.10). Unifica lo que hoy hacen `emitirEventoTurno` y `EventoSeguridad`.
- **Fábricas de datos de prueba:** `crearInscripcionDePrueba`, `crearOperacionDePrueba`, `abrirCajaDePrueba`, etc., en una carpeta compartida de tests, para que las pruebas de cada HU no inventen datos ni pisen los de otras.
- **Seed repetible y no destructivo:** el seed corre **dos veces seguidas** sin error y la segunda ejecución no cambia los datos que dejó la primera. Reemplazá el `turno.deleteMany` y cualquier borrado/recreación de escenarios por ids o claves de seed estables, con creación solo si faltan y actualización solo de campos técnicos que deban mantenerse. No borres inscripciones, operaciones, pagos, comprobantes, cajas, anulaciones ni historiales para volver a sembrar: preservá sus ids, relaciones, fechas y estados. Para los registros inmutables o numerados, crealos una sola vez; el segundo seed no vuelve a emitir comprobantes, no les asigna otros números ni consume números de la secuencia. Si un escenario de demostración fue modificado por una HU, el seed no lo restaura silenciosamente; para empezar de cero se usa una base descartable nueva o `prisma migrate reset` sobre ella. Como los servicios generan sus propios ids, cada escenario se busca por **clave natural** antes de llamar al servicio: caja = existe alguna caja del integrante, abierta o cerrada; inscripción = el par (alumno, clase) propio del escenario, en cualquier vigencia; operación = el pago de esa inscripción. Las cuentas que reciben caja son una lista fija de ids del seed. Documentá los ids/claves de seed y los campos que se preservan en «Decisiones tomadas».
- **Formas de pago en el seed:** identificá cada forma del catálogo de `20260921210000` por su id estable, nunca por el nombre editable. En la creación poné nombre, estado inicial y `esEfectivo`; en la actualización conservá nombre, `activaFormaPago` y `esEfectivo`. La migración marca como efectivo solo a «Efectivo». Con la base vacía no hay formas preexistentes: no dupliques registros. «Mercado Pago» permanece como forma de pago activa para **registrar en mostrador** un cobro ya realizado por ese medio, con `esEfectivo = false`. No implica checkout, pago en línea, webhook ni integración con la API de Mercado Pago: esa HU salió del backlog. Esta decisión está confirmada por el PO.
- **Verificación de repetibilidad:** en una base descartable, guardá antes y después del segundo seed los conteos e ids de clases, inscripciones, operaciones, pagos, comprobantes, cajas e historiales, las relaciones entre ellos y los números de comprobante. Tienen que ser iguales. Renombrá «Efectivo» y desactivá «Mercado Pago» entre corridas: el segundo seed conserva el nombre, la marca `esEfectivo` de «Efectivo», la desactivación y los ids, sin duplicar formas de pago. Registrá la evidencia en «Decisiones tomadas».
- **Seed en dos partes:** el **seed base** (etapa 1) carga catálogos, formas de pago, tarifas, parámetros, datos del centro, cuentas, fichas y clases. El **seed de escenarios** (etapa 2) abre una caja de prueba por cuenta de mesa de entrada y crea inscripciones, pagos y comprobantes **llamando a los servicios de 2.13** (`crearInscripcion`, `registrarOperacion`, `abrirCaja`, `finalizarInscripcion`…), nunca escribiendo directo en esas tablas. Así los datos sembrados cumplen las mismas reglas que los de la aplicación (equivalencia de «Pagada», numeración y contrato del comprobante, caja).
- **Escenarios mínimos del PR 0:** dejá casos suficientes para probar reserva pendiente, reserva vencida, inscripción pagada y una inscripción quitada, sin forzar datos históricos. La reserva vencida se crea con `crearInscripcion` usando el reloj inyectable de 2.16 en un momento anterior, de modo que su `venceEl` ya pasó y quede **sin marcar**: sirve para probar el vencimiento al operar. Se crea **al final del seed**, en una clase y con un alumno que no usa ningún otro escenario, para que ninguna otra inscripción la marque. En el seed mínimo del PR 0 no se cobra con el reloj desplazado. Dejá también una inscripción `PAGO_SIN_REGISTRAR` creada con `conReserva = false` en una clase futura. La anulación del último pago una vez iniciada la clase se prueba en los servicios.
- **Escenarios ampliados del seed (R7-PR0-2, R3-PR0-D5):** además de los mínimos de arriba, el seed de escenarios deja, **todo creado con los servicios de 2.13**:
  - al menos una inscripción en cada vigencia: `VIGENTE`, `CANCELADA_ALUMNO`, `RESERVA_VENCIDA` (ya marcada), `BAJA_ALUMNO` y `QUITADA_CENTRO` (con `finalizarInscripcion`; si alguna transición no tiene función propia en 2.13, el PR 0 la publica ahí y la HU dueña le agrega encima reglas, permisos y pantallas);
  - reservas pendientes y reservas vencidas (marcadas y sin marcar);
  - un pago anulado (con `anularPago`, en una caja abierta);
  - una forma de pago activa y otra **inactiva** (con id estable propio del seed y `esEfectivo = false`), y un alumno con la forma de pago preferida inactiva;
  - dos gerentes activos (ya en 2.7) y una cuenta con un enlace de recuperación o de definición de contraseña **vencido** (HU-A-05);
  - para HU-D-08: un profesor con clases futuras de dos materias, un profesor sin ninguna clase, un profesor con clases pasadas, un profesor inactivo con cuenta, y dos profesores destino (uno compatible y otro ocupado o fuera de horario).
  Con esto E-02, H-10, H-06, I-06 y D-08 se programan y prueban sin esperar las HU de otros carriles (dependencias E4, E5, E8). Cada escenario se busca por clave natural antes de crearse (repetibilidad, abajo).
- **Historial académico: lo que siembra el PR 0 y lo que siembra cada HU (R2-PR0-7, decidido por el SM).** El PR 0 deja el historial ya previsto arriba (clases dictadas sin control de asistencia y resultados de examen con los servicios existentes). Las clases **con control de asistencia** (presentes y ausentes), con corrección, anuladas, las observaciones, las indicaciones y los exámenes corregidos o anulados dependen de la lógica de HU-E-09, E-07, E-04, E-10 y E-11, que este PR no implementa (3): cada una de esas HU agrega sus fixtures con el punto de extensión de abajo, con los servicios que su propio PR trae. Se avisa al responsable del carril 3.
- **Historial académico de prueba (etapa 3, después de adaptar `clase-dictada.service.ts`):** como la base arranca vacía, el seed de escenarios deja, para al menos dos alumnos y dos materias, clases pasadas con inscripciones creadas antes del inicio (reloj desplazado, `conReserva = false`), registradas como dictadas con el servicio existente de clase dictada (quedan «sin control de asistencia») y al menos un resultado de examen con el servicio existente. Así HU-E-02, E-04, E-10 y E-11 tienen datos sobre los que trabajar. Los profesores de esas clases tienen cuenta (2.7), y al menos un profesor con cuenta tiene un alumno inscripto solo en una clase futura de su materia, para probar el «antes» de HU-E-04 (`profesorPuedeRegistrarIndicacion` da false). Las clases con asistencia individual las genera HU-E-09; los meses de indicadores, el Pendiente 11. Cada fixture se crea una sola vez por id o clave estable.
- **Base de demostración evolutiva:** los datos son de prueba y se pueden reiniciar. PR 0 no tiene que fabricar cierres de caja históricos por día ni casos de faltante, sobrante o cierre por ausencia para HU-I-12. Los datos de presentación de HU-I-12, HU-H-06, HU-H-07 y HU-H-10 (meses pasados, cierres de caja) no son parte de este PR; cada responsable de esas HU crea y mantiene sus fixtures de presentación con ids estables y sin duplicarlas al repetir el seed; el PO valida la demostración. Los nombres se registran al asignar las HU (Pendiente 11 del backlog). Todo pago de prueba queda en la caja abierta al momento del registro. Si se agregan pagos de fechas pasadas para una demo, la fecha informada puede ser pasada, pero la reserva y el cobro se validan en el momento de registro (`ahora()`) y siempre antes del vencimiento de la clase. No se simula un cobro posterior al inicio para poblar indicadores. **Excepción acotada para las fixtures de presentación de meses pasados** (HU-H-06, H-07, H-10, I-12): se pueden crear con el reloj inyectable desplazado siempre que **todo el flujo** sea cronológicamente válido y pase por los servicios: inscribirse antes del inicio, cobrar antes del inicio dentro de una caja abierta y cerrada en ese mismo día desplazado (estas cajas históricas usan **cuentas de mesa de entrada propias de esas fixtures**, que se crean con ellas y no reciben la caja abierta del seed, porque el índice permite una sola caja abierta por integrante), registrar la clase dictada después del inicio, y cancelar o dar de baja en momentos permitidos. Ningún paso viola una regla del servicio, y la prueba de equivalencia de «Pagada» pasa sobre esos datos. Anotá qué fixtures agrega cada HU. Cada fixture usa los servicios que ya existan al mergearla: las de asistencia de HU-H-07 usan `registrarClaseDictada` con asistencias (HU-E-09, que va antes); las de cancelaciones y bajas de HU-H-10, los servicios de HU-C-14 y HU-B-07.
- **Punto de extensión de fixtures:** este PR deja una carpeta (por ejemplo, `prisma/seed/fixtures/`) con un índice que las corre en orden después del seed de escenarios. Cada HU de presentación agrega **su propio archivo** y una línea en el índice, sin editar `seed.ts` ni los archivos de otras HU, para que cuatro ramas no choquen en el mismo archivo.

### 2.17 Specs (metodología SDD)

Las HU del sprint programan contra este PR, y su modelo y sus contratos están en las specs. **Las specs de todos los módulos (A a N, sin M) ya están escritas en su Revisión 3** y recogen lo que esta versión del PR 0 incorpora; el PR 0 no las reescribe.

- **Firmas reales:** al terminar cada etapa se anotan en «Decisiones tomadas». Si una firma real difiere de la spec de su módulo, se agrega una **nota aditiva fechada** al final de esa spec (mismo formato que la nota de `spec_modulo_C.md`), sin reescribir las secciones existentes, y se avisa a su dueño.
- **Qué spec manda en qué:** `spec_modulo_C.md` (modelo de inscripción, vigencia, servicios de inscripción), `spec_modulo_I.md` (operación de pago, pago, correcciones, comprobante, caja), `spec_modulo_A.md` §2.8 y §2.9 (permisos y cuentas) y §3.6 (comprobación por solicitud), `spec_modulo_E.md` (asistencia, observaciones, indicaciones, correcciones y el alcance del profesor), `spec_modulo_D.md` (baja del profesor), `spec_modulo_F.md` y `spec_modulo_G.md` (fichas del personal), `spec_modulo_L.md` (tarifas), `spec_modulo_N.md` (parámetros), `spec_modulo_H.md` (indicadores).
- **Alineación del mapa de pantallas** (`mapa-pantallas-sprint-3.md`; **hecha**): rutas de P-02 a P-05 fijadas por la spec A (P-A11) y mecanismo de reemisión de la sesión (P-A1); ruta `/gerente` de P-49 (H, T1); DEC-41 sin «cupo por mes» y con las lecturas de H-07 publicadas por el PR 0 (H, T2 y T4); y los nombres de todos los permisos reemplazados por los de 2.9.1 (tarifas, cajas, comprobantes, personal, gerentes, configuración, baja de alumno y de profesor, «Mi cuenta», «Mi historial», cancelar la propia inscripción). Es una corrección de documento, no de código.
- **Texto de las specs B, F y G:** la fila de `listarHistorialEstados` dice «publicada por el PR 0 (R7-PR0-1)»; D nace con ese texto.

### 2.18 Pedidos de las specs y del análisis de dependencias, incorporados en la v20

Cada fila es un pedido de la sección «Pedidos al PR 0» de la spec indicada (Revisión 3) o del análisis de dependencias (R7). La última columna dice dónde queda resuelto. Todos son aditivos: ninguno cambia un comportamiento de los Sprints 1 y 2 (1.1), salvo los que están en la tabla de 1.1.

| ID | Pedido (resumen) | Resuelto en |
|---|---|---|
| **A1** | Esquema de cuentas y recuperación: 2 columnas en `Usuario`, `TokenRecuperacion`, `SolicitudRecuperacion`, valores nuevos de `TipoEventoSeguridad` (`ADD VALUE`, no usados en la misma migración) | 2.7, 2.14 |
| **A2** | `withPermission`: `DEBE_CAMBIAR_PASSWORD`; `exigirPermiso` redirige a `/primer-ingreso`; `usuario` en los mocks de sus tests | 2.7 |
| **A3** | Callback `jwt` copia la marca; el proxy redirige a `/primer-ingreso` y deja públicas `/recuperar-contrasena` y `/restablecer-contrasena` | 2.7, 2.9 |
| **A4** | `cuenta.service.ts` y `email.service.ts` con simulador | 2.13 |
| **A5** | Tabla cerrada de permisos = matriz 2.8 de la spec A | 2.9.1 |
| **A6** | `.env.example`: `RESEND_API_KEY`, `EMAIL_FROM`, `NEXTAUTH_URL` | 2.11 |
| **A7** | Mapa: rutas de P-02 a P-05 y reemisión de la sesión | 2.17 |
| **B1** | `alumnos:cambiar_estado` (solo M); `alumnos:leer` a M y G, fuera de P | 2.9.1 |
| **B2** | Historial de estados con la entidad `ALUMNO` y `DESACTIVAR`/`REACTIVAR` | 2.13, 2.14 |
| **B3** | `verificarAlumnoActivo(alumnoId, tx)` después de bloquear al alumno | 2.13 |
| **B4** | Anotar `darDeBajaInscripcionesDeAlumno` y `alumnoTieneRegistros` (los agrega HU-B-07) | 2.13 |
| **B5** | `/alumnos` y `/alumnos/[id]` también para el gerente | 2.9 |
| **C1** | Los servicios de inscripción no cambian `Turno.estado` de una clase `PENDIENTE`/`CANCELADO` | 2.13 |
| **C2** | `ErrorDeDominio` con `code` y texto de hoy y siete códigos nuevos con su HTTP | 2.13 |
| **C3** | Lecturas de la inscripción vigente y de la más reciente de un par | 2.13 |
| **C4** | `exigeInscripcionConPago` devuelve el motivo | 2.13 |
| **C5** | `listarReservasPendientes`/`Vencidas`/`resumenReservas` con los campos de la spec C 2.20 | 2.13 |
| **C6** | `parametrosVigentes()` expone `plazo_pago_horas` y `cancelacion_anticipacion_horas` | 2.6 |
| **C7** | `turnos:cancelar_propia`, `reservas:leer`, ruta `/reservas`; la ruta del proceso de vencimiento fuera del control de sesión | 2.9, 2.9.1 |
| **C8** | Prueba con PostgreSQL real: el trigger proyecta solo `VIGENTE`; finalizar libera al alumno | 2.0, 4 |
| **C9** | `marcarVencidas` devuelve la cantidad; `clasesConReservasVencidas(db, momento)` | 2.13 |
| **C10** | `crearInscripcion` conserva `ALUMNO_NO_ENCONTRADO`/`ALUMNO_INACTIVO`, acepta `alumnoActivo`, usa `obtenerTarifasPorIds` y `precioClase` | 2.13 |
| **D1** | Historial de estados con la entidad `PROFESOR` | 2.13, 2.14 |
| **D2** | `profesores:leer` para G, `profesores:cambiar_estado` solo G, `profesores:leer` fuera de `ACCIONES_SOLO_MESA_ENTRADA`, helper `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId, db?)` | 2.9, 2.9.1 |
| **D3** | `bloquear` acepta al profesor como recurso | 2.16 |
| **D4** | Confirmar que el trigger escucha `UPDATE OF "profesorId"` (no se espera cambio; si faltara, migración aditiva) | 2.0, 4 |
| **D5** | Seed de escenarios para HU-D-08 | 2.16 |
| **D6** | `/profesores` y `/profesores/[id]` también para el gerente | 2.9 |
| **D7** | Dos filas en la tabla de 1.1 (alta con `email` crea la cuenta; email de la ficha = el de la cuenta) | 1.1 |
| **D8** | `turno:profesor_cambiado` si `tipoEvento` es un enum | 2.14 |
| **E1** | Esquema de asistencia, correcciones, observaciones, indicaciones y exámenes | 2.8, 2.14 |
| **E2** | Permisos de la spec E, `historial:leer_propio` y las tres rutas nuevas | 2.9, 2.9.1 |
| **E3** | Lecturas de C que necesita E (`listarInscripcionesDeAlumno`, `existeInscripcionVigenteConProfesor`, `inscripcionesVigentes`, `marcarVencidas(tx, turnoId)`, `obtenerClasesBasicas`) | 2.13 |
| **E4** | `profesorPuedeVerHistorial` vive en E (`src/server/historial/alcance-profesor.ts`), no en una fachada | 2.9 |
| **E5** | Lecturas públicas de E y `registrarClaseDictada(tx, { turnoId, actor, asistencias? })` | 2.13 |
| **E6** | `ErrorDeDominio` de las secciones 2.6 a 2.12 de la spec E | 2.13 |
| **E7** | Seed de historial académico | 2.16 (parcial: ver 6) |
| **E8** | Pruebas: Sprint 2 sin cambios de aserciones; `ON CONFLICT … WHERE "anuladaEl" IS NULL` con PostgreSQL real; equivalencia de `asistenciaDeAlumno` | 4 |
| **H1** | `contarClasesPorMes` y `contarInscripcionesPorMes` | 2.13 |
| **H2** | `contarClasesDictadasSinControl` y `listarAlumnosConPresentismoBajo`; corregir la frase de los inscriptos de HU-H-07 | 2.13 |
| **H3** | `obtenerProfesoresBasicos(ids, db?)` en la fachada de D | 2.13 |
| **H4** | `umbral_presentismo` como entero (75) | 2.6 |
| **H5** | Sin permisos nuevos; `indicadores:leer` solo G | 2.9.1 |
| **H6** | Puntos de extensión del seed para H-06, H-07 y H-10 | 2.16 |
| **H7** | Componentes shadcn/ui `tabs` y `table` | 2.12 |
| **H8** | Mapa: ruta `/gerente` y DEC-41 | 2.17 |
| **I1** | Contrato de `registrarOperacion` (ítems, `modo`, resultado); `compatSprint2` **permanente** | 2.13, 2.15 |
| **I2** | T6: `Pago` conserva `formaPagoId`, `fechaPago` y `creadoPorUsuarioId`; lectores de Sprint 2 con valor vigente; índice `(alumnoId, fechaPago)` | 2.0, 2.3, 2.14 |
| **I3** | `marcarPagada` y `recalcularEstadoPago` reciben el conteo de pagos no anulados | 2.13 |
| **I4** | `ErrorDeDominio` de la spec I | 2.13 |
| **I5** | Permisos de la spec I y rutas `/pagos/registrar`, `/caja`, `/cajas`, `/mis-pagos`, `/alumnos/[id]/pagos` | 2.9, 2.9.1 |
| **I6** | `Caja.efectivoDeclarado` nullable; `declararEfectivo`, `calcularResumen`; la huella incluye correcciones y anulaciones | 2.5, 2.13 |
| **I7** | Contrato Zod del JSON `datos` del comprobante | 2.3, 4 |
| **I8** | `registrarAjuste` con par de ajustes para el cambio de forma de pago | 2.5, 2.13 |
| **I9** | `bloquear` con el nivel «formas de pago» | 2.16 |
| **I10** | Equivalencia de «Pagada» cubre corrección y anulación; contrato del envoltorio de `POST /api/pagos` en los dos modos | 4 |
| **I11** | Lecturas públicas de pagos y de cajas; `usuarioRegistroOperaciones` | 2.13 |
| **F1–F4** | `version`, campos normalizados e índice de las fichas; nombres `personal:*`; lecturas de cuentas y del historial; ficha como recurso de `bloquear` | 2.7, 2.9.1, 2.13, 2.16 |
| **G1–G3** | Lo mismo para `FichaGerente` (`gerentes:*`); `filtrarCuentasActivas`; varias fichas de gerente en un `bloquear` | 2.7, 2.9.1, 2.13, 2.16 |
| **L1** | `Materia.tarifaHora` y `HistorialTarifa.tarifaAnterior` admiten vacío; `MATERIA_SIN_TARIFA` | 2.4, 2.13 |
| **L2** | `materias:ver_tarifa` y `materias:cambiar_tarifa` | 2.9.1 |
| **L5** | Nombres de la tarifa, recurso `materia` en `bloquear`, ubicación de `precioClase`, lectura por `obtenerTarifasPorIds` | 2.4, 2.16 |
| **L6** | `HistorialTarifa` en la misma transacción: **confirmado** (6) | 2.4, 2.10 |
| **L8** | El seed carga códigos de materia sin guion (p. ej. `FIS1`) | 2.4 |
| **N1** | `configuracion:leer` y `configuracion:editar` | 2.9.1 |
| **N2** | Forma de `HistorialParametro`; `parametrosVigentes()` lee en cada llamada | 2.6 |
| **R7-1** | `listarHistorialEstados(entidad, id, db?)` publicada en la etapa 2 | 2.13 |
| **R7-2** | Seed de escenarios ampliado | 2.16 |
| **R7-3** | Orden de publicación de las firmas | 0 |
| **R7-4** | Etapa 1 disponible primero | 0 (con ajuste: ver 6) |

## 3. Fuera de alcance

- Pantallas, componentes y endpoints de las HU (cada HU los hace).
- El archivo central de textos y el componente de confirmación (HU-C-23 y HU-C-25). Este PR solo agrega al archivo central las claves de los errores de sus servicios (2.13).
- La lógica y las pantallas de la asistencia por alumno (HU-E-09; su esquema sí va en 2.14), el proceso programado en sí (HU-C-24; su función `vencerReservas` usa `marcarVencidas`, que ya excluye las clases Canceladas) y el envío real de emails (HU-A-05; este PR deja su tabla de tokens en 2.14 y el servicio con simulador en 2.13).
- Migrar las cuentas de prueba anteriores a HU-A-06 (decisión del PO): solo se crean sus fichas (2.7).

## 4. Definición de Terminado (convención 8 i)

> **Alcance reducido:** cada ítem dice si aplica y se cumplió (`[x]`), si aplica y está pendiente, o si queda fuera del alcance reducido (ver el inicio del documento).

**Validaciones de modelo y migración (obligatorias antes del único merge)**
- [x] `prisma migrate reset` corre sin errores desde cero; sobre una base con datos en cualquiera de las tablas de negocio de la guarda, la migración falla con el mensaje de la guarda de 2.1. — **Aplica, cumplido:** la guarda se probó en la etapa 1 (5.1) y las migraciones corren desde cero, con el seed, en bases descartables (5.5). El `reset` sobre la base de desarrollo lo corre el responsable.
- [x] La migración también corre sobre una base **sin seed** (solo migraciones) y deja parámetros, datos del centro y permisos. — **Aplica, cumplido** (5.1; `npm run test:pg` migra bases sin seed).
- [x] **Diferencias de esquema:** `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <descartable> --script` y la misma comparación `--from-url <descartable migrada>` dan **la misma salida**: vacía, o solo sentencias sobre los objetos manuales listados en "Decisiones tomadas" (índices parciales, EXCLUDE, CHECK, triggers, collation, secuencia). No actives `postgresqlExtensions` en este PR. Si aparecen `DROP INDEX` de índices parciales, queda documentado que toda migración futura se revisa a mano para quitarlos (Pendiente 6). — **Aplica, cumplido** en la etapa 1 (5.1).
- [ ] **Índices parciales y migraciones posteriores:** en una base descartable y sobre una **copia** de `prisma/` (nunca en el repo ni en la base de desarrollo), `prisma migrate dev --create-only` no genera `DROP` de los índices parciales. Si los genera, documentá el procedimiento para evitarlo (Pendiente de la planning). — **Aplica, queda como nota:** no se corrió `migrate dev --create-only` sobre una copia de `prisma/` (5.5).
- [x] Existen los **índices únicos parciales** (inscripción vigente por alumno y clase, clase dictada no anulada por clase, caja abierta por integrante), la unicidad simple de `ObservacionClase.claseDictadaId` y la **secuencia** del comprobante. Se verifica con consultas a `pg_indexes` y `pg_class`. — **Aplica, cumplido** (5.1).
- [ ] **Prueba de la matriz de permisos:** cada rol contra cada acción de la tabla cerrada de 2.9.1, incluidos el 403 del profesor fuera de su alcance, el del gerente al registrar un pago, el del gerente al cancelar una clase fuera del flujo de baja, el de todo rol que no sea mesa de entrada en `reservas:leer` y el del profesor que registra una indicación antes de su primera clase propia dictada con ese alumno (`profesorPuedeRegistrarIndicacion`, incluido el caso del alumno ausente y el de la clase dictada anulada). La prueba compara seed y migraciones. — **Fuera del alcance reducido:** los 403 por alcance dependen de las rutas de 2.9. La tabla cerrada sí está en migración y seed, con el mismo resultado (5.1 y 5.5).
- [ ] `RULES.md` actualizado según 2.10 y `.env.example` según 2.11. — **Fuera del alcance reducido** para `RULES.md`; `.env.example` está hecho (5.1).
- [x] El seed corre desde cero (`prisma migrate reset`) y deja tarifas, parámetros, datos del centro, `esEfectivo`, fichas del personal y las cuentas extra. — **Aplica, cumplido** (5.1 y 5.5).
- [ ] El seed de escenarios del PR 0 usa solo los servicios de 2.13: ningún `create` directo sobre inscripciones, operaciones, pagos, comprobantes ni cajas en `prisma/seed.ts`. Deja una caja abierta por cuenta de mesa de entrada de prueba y casos mínimos de reserva y pago; la prueba de equivalencia de «Pagada» pasa sobre esos datos. Los casos históricos y cierres especiales se agregan con las HU que los muestran. — **Fuera del alcance reducido**, salvo la caja abierta por cuenta de mesa de entrada, que el seed base crea con `abrirCaja` (5.5). Los casos de reserva y pago los agregan las HU como fixtures.
- [x] El script para abrir una caja está documentado y probado sobre una base con seed: se cierra la caja de una cuenta operativa de mesa de entrada y el script la vuelve a abrir para esa misma cuenta. — **Aplica, cumplido** (5.4).
- [x] El seed corre **dos veces seguidas** sin error y conserva conteos, ids, relaciones, estados y números de comprobante; la segunda corrida no vuelve a consumir la secuencia. La prueba de renombrar «Efectivo» y desactivar «Mercado Pago» entre corridas conserva ambos cambios, la marca `esEfectivo` y los ids, sin duplicar formas de pago. Evidencia anotada en «Decisiones tomadas». — **Aplica, cumplido** (5.5). No hay comprobantes en el seed base; la prueba de «Efectivo» y «Mercado Pago» está en 5.1.
- [x] Después de correr el seed, el GERENTE conserva `profesores:leer` y sus permisos nuevos (`ACCIONES_SOLO_MESA_ENTRADA` revisada). — **Aplica, cumplido** (5.1).
- [x] Pruebas de las lecturas públicas de 2.13 (inscripciones por alumno, conteos por mes y vigencia, asistencias, pagos por alumno con montos vigentes, reservas pendientes, vencidas y su resumen, incluidas las vencidas sin marcar). — **Aplica, cumplido** (5.4).

**Validaciones de adaptación e integración (obligatorias antes del único merge)**
- [x] **Prueba de la equivalencia de "Pagada":** para toda inscripción vigente, `estadoPago = PAGADA` si y solo si tiene al menos un pago no anulado. Cubre registro, corrección y anulación hechas por los servicios (R3-PR0-I10) y los datos del seed. — **Aplica, cumplido** sobre los servicios (5.3 y 5.4). El seed base no tiene pagos.
- [x] Prueba del servicio "vigente a un momento dado": reserva antes, en y después de `venceEl`; `marcarVencidas` idempotente; `marcarVencidasDelAlumno` libera una superposición con el proceso detenido. Reprogramar una clase cuyo inicio original acortó el vencimiento conserva `venceBaseEl` y usa el nuevo inicio; una reserva que ya venció antes de reprogramar no se reactiva; cambiar el parámetro de plazo no altera esa reserva. — **Aplica, cumplido** (5.2 y 5.3).
- [x] Prueba de triggers contra PostgreSQL real: quitar a un alumno y volver a inscribirlo en la misma clase no viola la PK de `reservas_turno`; una inscripción no vigente no tiene reserva; finalizar una inscripción libera al alumno para otra clase superpuesta (EXCLUDE); y el trigger de `turno` escucha `UPDATE OF "profesorId"`. — **Aplica, cumplido** (5.1, 5.3 y 5.5).
- [ ] **Sesión:** una sesión iniciada antes de `sesionesValidasDesde` recibe 401 en la siguiente solicitud a una API y a una pantalla que llama a `exigirPermiso`; al cambiar la contraseña, la sesión actual sigue válida y las otras no; con `debeCambiarPassword` el proxy redirige al cambio de contraseña y las API (salvo cambiarla, cerrar sesión y `sesion:ping`) rechazan; `cambiarPassword` con `conservarSesionActual = false` revoca también la actual; un `update` del token desde el cliente no cambia `iat_sesion` ni la marca; las rutas de HU-A-05 y el endpoint del proceso programado no redirigen al login. — **Fuera del alcance reducido** (2.7).
- [ ] **Compatibilidad (1.1):** las colecciones Postman de los Sprints 1 y 2 corren **sin modificarse** contra el servidor con el PR 0 y dan los mismos resultados. En particular, `POST /api/pagos`, `GET /api/pagos/opciones`, `POST /api/turnos/[id]/inscripcion`, `/participantes` y `/alumnos` de la clase mantienen pedido, respuesta y códigos de error. Toda diferencia está en «Decisiones tomadas» con su motivo. — **Aplica, pendiente:** por decisión del responsable, las colecciones no se corren. La evidencia son las pruebas de punta a punta con PostgreSQL de 5.5 más una prueba manual del responsable.
- [x] Ningún test de los Sprints 1 y 2 se borró ni se debilitó; los modificados están listados en «Decisiones tomadas», cada uno con su motivo. — **Aplica, cumplido** (lista en 5.5).
- [x] **Alta de materia (HU-L-01):** crear una materia sin tarifa funciona como antes; inscribir en esa materia se rechaza con `MATERIA_SIN_TARIFA`; las materias del seed traen tarifa. — **Aplica, cumplido** (5.3 y 5.5).
- [x] `ErrorDeDominio` extiende `ServiceError` y los Route Handlers existentes mapean sus errores sin cambios. `listarPagosDeTurno` y `sumarPagosPorMes` conservan firma y forma del resultado. — **Aplica, cumplido**. `POST /api/pagos` suma la respuesta de los códigos nuevos (5.5).
- [x] La **regresión de los Sprints 1 y 2 pasa**: `npm test` sin fallas, todos los `*.pg.test.ts` (los 82 existentes y los nuevos) corridos contra PostgreSQL real y `tsc --noEmit` sin errores. — **Aplica, cumplido** (5.5).
- [x] Pruebas de los servicios de 2.13: cada transición de inscripción (con y sin reserva, la reapertura por anulación y la anulación del último pago después del inicio o en una clase cancelada, que dejan `PAGO_SIN_REGISTRAR`), `registrarOperacion` con caja cerrada (rechaza), cobro de una inscripción `PAGO_SIN_REGISTRAR` antes del inicio (acepta), todo cobro o inscripción después del inicio (rechaza, aunque la fecha de pago informada sea anterior), cobro en una clase cancelada (rechaza), `finalizarInscripcion` con `soloSiReservaPendiente` sobre una reserva pagada o vencida (rechaza), emisión y reemplazo de comprobante, `revocarSesiones`. — **Aplica, cumplido** (5.3 y 5.4).
- [x] Prueba del comportamiento interino de 2.15: con el PR 0 mergeado y ninguna HU, se puede inscribir (queda `PAGO_SIN_REGISTRAR`, sin plazo), pagar desde el detalle de la clase con la caja del seed antes del inicio (queda pagada y con comprobante) y quitar (queda quitada, no se borra). — **Aplica, cumplido** (`turno.inscripciones.pg.test.ts`, 5.5).
- [x] Prueba de concurrencia con PostgreSQL real: dos cobros simultáneos de la misma inscripción (uno falla); un cobro contra un cierre de caja simultáneo, forzando los dos órdenes (si el cobro —en efectivo o en otra forma de pago— confirma primero, el cierre falla por resumen cambiado; si el cierre confirma primero, el cobro falla por caja cerrada); y una inscripción contra un cobro con inscripción del mismo alumno en clases superpuestas (sin interbloqueo, 2.16). — **Aplica, cumplido** (5.3 y 5.4).
- [x] Prueba del estado guardado de la clase: llenar el cupo la pasa a COMPLETO; quitar, cancelar o vencer una inscripción la devuelve a DISPONIBLE; con el proceso detenido, una clase completa solo por reservas vencidas sin marcar se ofrece como Disponible. — **Aplica, cumplido** (5.2, 5.3 y 5.5).
- [x] Prueba de claves de error: todo `codigo` de `ErrorDeDominio` existe en el archivo central de textos (se suma a la prueba de claves de HU-C-23). — **Aplica, cumplido**.
- [x] Las firmas reales de 2.13 y 2.16 están anotadas en "Decisiones tomadas" (es el contrato de las HU) y en las specs según 2.17. — **Aplica, cumplido** en «Decisiones tomadas». Las notas aditivas en las specs (2.17) quedan **fuera del alcance reducido**: las agrega cada dueño de módulo.
- [x] **Contrato del comprobante:** un único esquema (por ejemplo, Zod) define el JSON `datos` del comprobante; una prueba valida con ese esquema los comprobantes que emite `emitirComprobante` (registro y reemplazo). — **Aplica, cumplido** (5.3).
- [ ] El CI corre `npm test`, `tsc` y los tests `*.pg.test.ts` con PostgreSQL y `TZ=UTC`. — **Fuera del alcance reducido** (2.12).
**Pedidos de las specs (v20)** (obligatorios antes del único merge)
- [ ] **Tabla cerrada completa:** la prueba de la matriz recorre todas las filas de 2.9.1, incluidas las nuevas de B, D, E, F, G, I, L y N, y comprueba que migraciones y seed dan el mismo resultado. El profesor no tiene `alumnos:leer` (alcance reducido: lo conserva hasta HU-E-02, que se lo quita con una migración nueva); el gerente tiene `profesores:leer` y no `profesores:crear`/`editar`; ningún rol salvo el gerente tiene `profesores:cambiar_estado` ni `indicadores:leer`. — **Fuera del alcance reducido** como prueba automática. Migración y seed coinciden (5.1 y 5.5), con `alumnos:leer` del Profesor conservado.
- [x] **Cuentas (A):** `cambiarEmailCuenta` no revoca sesiones; `desactivarCuenta` las revoca; `revocarSesiones` no retrocede `sesionesValidasDesde`; `filtrarCuentasActivas` y `obtenerResumenCuenta` (incluido `SIN_CUENTA`); `crearCuentaParaFicha` rechaza un email en uso con `EMAIL_YA_ASOCIADO`; el simulador de email funciona sin `RESEND_API_KEY`. Los tests de `withPermission` incluyen `usuario` en sus mocks y verifican `DEBE_CAMBIAR_PASSWORD`. — **Aplica, cumplido** para los servicios (5.4). Los tests de `withPermission` son de 2.7, **fuera del alcance reducido**.
- [x] **Historial de estados:** `registrarCambioEstado` y `listarHistorialEstados` para las cinco entidades de 2.13, con la escritura después del commit y reintento. — **Aplica, cumplido** (5.2 y 5.4).
- [x] **`bloquear`:** acepta profesor, ficha del personal, varias fichas de gerente por id ascendente y el nivel «formas de pago»; pedir un nivel anterior al ya tomado falla en las pruebas. — **Aplica, cumplido** (5.2).
- [x] **Servicios de inscripción:** `crearInscripcion` conserva `ALUMNO_NO_ENCONTRADO` y `ALUMNO_INACTIVO`, rechaza a un alumno desactivado entre la lectura y el bloqueo, y no cambia el estado de una clase `PENDIENTE` ni `CANCELADO`; `marcarVencidas` devuelve la cantidad; `exigeInscripcionConPago` devuelve el motivo. — **Aplica, cumplido** (5.3).
- [x] **`registrarOperacion`:** pruebas en los dos modos (`completo` y `compatSprint2`, este último permanente) y del envoltorio de `POST /api/pagos`; ítems `{ inscripcionId }` y `{ crearInscripcion: { turnoId } }`; la materia sin tarifa rechaza con `MATERIA_SIN_TARIFA`. — **Aplica, cumplido** (5.3 y 5.5).
- [x] **Pago de Sprint 2:** `Pago` conserva `formaPagoId`, `fechaPago` y `creadoPorUsuarioId`; las lecturas `listarPagosDeTurno` y `sumarPagosPorMes` devuelven el valor vigente y excluyen anulados sin cambiar firma ni forma. — **Aplica, cumplido** (5.5).
- [x] **Caja:** `efectivoDeclarado` admite vacío; `declararEfectivo` solo guarda si está vacío y la caja está abierta; la huella de `calcularResumen` cambia con una corrección o anulación de pago; el cambio de forma de pago de una caja cerrada genera un par de ajustes. — **Aplica, cumplido** (5.4).
- [ ] **Esquema de E:** el índice parcial de `ClaseDictada` con `ON CONFLICT … WHERE "anuladaEl" IS NULL` (registrar, anular, registrar de nuevo y dos registros simultáneos) contra PostgreSQL real. — **Aplica, queda como nota:** no hay una prueba con PostgreSQL de registrar, anular y volver a registrar, ni de dos registros simultáneos. La hace quien tome HU-E-09 o HU-E-11 (5.5).
- [x] **Triggers:** el trigger de `turno` escucha `UPDATE OF "profesorId"` (si no, migración aditiva) y cambiar el profesor de una clase actualiza la reserva del profesor. — **Aplica, cumplido:** confirmado contra la migración (5.1).
- [x] **Parámetros:** `parametrosVigentes()` devuelve `plazo_pago_horas`, `cancelacion_anticipacion_horas` y `umbral_presentismo` como enteros, y lee la base en cada llamada. — **Aplica, cumplido** (5.3).
- [ ] **Seed de escenarios ampliado (2.16):** existe al menos una inscripción en cada vigencia, reservas pendientes y vencidas, un pago anulado, una forma de pago inactiva, un alumno con forma preferida inactiva, un enlace de recuperación vencido y los escenarios de HU-D-08; el seed corre dos veces seguidas sin cambios. — **Fuera del alcance reducido.**
- [x] **Etapa 1 disponible:** la etapa 1 cumple su condición y se entrega al equipo (0) con la lista de errores de `tsc` conocidos y la tabla cerrada de 2.9.1. — **Aplica, cumplido.**
- [x] **Orden de publicación:** las firmas de los grupos (a), (b), (c) y (d) de 0 están anotadas en «Decisiones tomadas» al pasar las pruebas de cada grupo. — **Aplica, cumplido** (5.2 a 5.4).

- [ ] Integrado en un único push y merge luego de cumplir todas las validaciones de esta sección. — **Aplica, pendiente:** el merge lo hace el equipo.

## 5. Decisiones tomadas

_(Las completa quien implementa: nombres reales de modelos y campos, decisión de 2.0 sobre `TurnoAlumno`, guarda de base vacía, unicidad de observaciones, objetos SQL manuales, rutas previstas y todo lo que se haya resuelto por su cuenta.)_

### 5.1 Etapa 1 — esquema, migraciones, permisos y seed base

**Migraciones creadas** (en este orden):

| Migración | Contenido |
|---|---|
| `20261008120000_sprint3_eventos_seguridad` | Los 6 valores nuevos de `TipoEventoSeguridad` (`CUENTA_CREADA`, `PASSWORD_CAMBIADA`, `RECUPERACION_SOLICITADA`, `RECUPERACION_LIMITADA`, `RECUPERACION_ENVIO_FALLIDO`, `RECUPERACION_CONFIRMADA`) con `ADD VALUE IF NOT EXISTS`, solos en su migración: ninguna migración los usa. |
| `20261008120100_sprint3_modelo` | Guarda de base vacía, todo el modelo del sprint (2.1, 2.3–2.8, 2.14), los objetos SQL manuales, el SQL de los triggers de reservas (2.0), `esEfectivo` de `formapago-efectivo` y los parámetros nuevos con sus valores por defecto. En una sola transacción (`BEGIN`/`COMMIT`). |
| `20261008120200_sprint3_permisos` | La matriz RBAC completa de 2.9.1: lo que solo estaba en el seed (incluido `alumnos:leer` del Profesor, que se conserva hasta HU-E-02), la corrección de `profesores:*`, `alumnos:leer` para el Gerente y todas las acciones nuevas. |

**Decisión de 2.0 (`TurnoAlumno`):** se extiende el mismo modelo, la misma tabla `turno_alumno` y la misma relación `Turno.alumnos`. La PK compuesta `(turnoId, alumnoId)` se reemplaza por `idInscripcion` (cuid); desaparece el selector `turnoId_alumnoId`. La FK que apunta a la inscripción se llama `inscripcionId` (como en las specs C e I). Se conservan los `onDelete: Cascade` de `turnoId` y `alumnoId` que ya tenía la tabla: los `*.pg.test.ts` limpian borrando turnos. `Pago → inscripción` es `RESTRICT`, así que un turno con pagos sigue sin poder borrarse, como hoy.

**Guarda de base vacía:** un `DO $$` al principio de `20261008120100_sprint3_modelo` falla con «Esta migración requiere una base vacía: corré `prisma migrate reset`» si hay filas en `turno_alumno`, `pagos`, `turnos`, `alumnos`, `profesores`, `materias` o `aulas`. Probado sobre una base con seed: falla con ese mensaje.

**Criterio de nombres.** Donde una spec fija el nombre de la columna (A, E, I, N, F/G), se usa el de la spec. Donde la spec dice que el nombre es conceptual (la inscripción, spec C 2.16.1), se usan los nombres de PR-0 §2.1. Excepciones, por convención del schema: las columnas que guardan un usuario terminan en `…UsuarioId` (`creadoPorUsuarioId`, `finalizadaPorUsuarioId`, `anuladaPorUsuarioId`, `cerradaPorUsuarioId`, `ajustadoPorUsuarioId`), y `Materia.tarifaHora` se llama `tarifaHoraMateria`, como pide 2.4.

| Concepto (task / spec) | Nombre real |
|---|---|
| Inscripción (2.1) | `TurnoAlumno` (`turno_alumno`): `idInscripcion`, `turnoId`, `alumnoId`, `vigencia` (`VigenciaInscripcion`, por defecto `VIGENTE`), `estadoPago` (`EstadoPagoInscripcion`, sin valor por defecto), `reservadaEl`, `inicioPlazo?`, `venceBaseEl?`, `venceEl?`, `precio` (Int), `reabiertaPorAnulacion`, `finalizadaEl?`, `finalizadaPorUsuarioId?`, `finalizadaPorActorTipo?` (`ActorTipo`), `creadoPorUsuarioId?`, `createdAtInscripcion` |
| Historial de la inscripción (2.1) | `HistorialInscripcion` (`historial_inscripciones`): `idHistorialInscripcion`, `inscripcionId`, `vigenciaAnterior?`, `vigenciaNueva`, `estadoPagoAnterior?`, `estadoPagoNuevo`, `actorTipo`, `usuarioId?`, `fecha`. En cascada con la inscripción |
| Actor (2.1) | enum `ActorTipo { USUARIO, PROCESO_AUTOMATICO }` + `…UsuarioId` nullable, con CHECK en: `turno_alumno` (finalización), `historial_inscripciones`, `historial_estados`, `cajas` (cierre), `anulaciones_pago`, `anulaciones_movimiento`. No hay usuario de sistema |
| Pago (2.3) | `Pago` conserva todas sus columnas y suma `operacionId`, `inscripcionId`, `precio` (Int), `motivoAjuste?` (varchar 300), `ajustadoPorUsuarioId?` |
| Operación (2.3) | `OperacionPago` (`operaciones_pago`): `idOperacionPago`, `alumnoId`, `formaPagoId`, `fechaPago` (Date), `creadoPorUsuarioId`, `registradaEl`, `cajaId`. Índices `(alumnoId, fechaPago)` y `(cajaId)` |
| Correcciones y anulaciones (2.3) | `CorreccionPago` (`montoAnterior`, `montoNuevo`, `motivo`, `creadoPorUsuarioId`, `createdAtCorreccionPago`); `AnulacionPago` (`pagoId` único, `motivo`, `actorTipo` por defecto `USUARIO`, `creadoPorUsuarioId?`, `createdAtAnulacionPago`); `CorreccionOperacion` (una fila por campo que cambia: `formaPagoAnteriorId`/`formaPagoNuevaId` **o** `fechaPagoAnterior`/`fechaPagoNueva`, con CHECK; `motivo`, `creadoPorUsuarioId`, `createdAtCorreccionOperacion`) |
| Comprobante (2.3) | `Comprobante` (`comprobantes`): `idComprobante`, `numero` (Int, único), `operacionId`, `datos` (JSONB), `emitidoEl`, `reemplazaAId?` (único, autorrelación `reemplazaA`/`reemplazadoPor`). Secuencia `comprobante_numero_seq` (`AS integer`) |
| Tarifa (2.4) | `Materia.tarifaHoraMateria Int?` (CHECK > 0). `HistorialTarifa` (`historial_tarifas`): `idHistorialTarifa`, `materiaId`, `tarifaAnterior?`, `tarifaNueva`, `usuarioId`, `fecha`, `masivo` |
| Caja (2.5) | `FormaPago.esEfectivo`. `Caja` (`cajas`): `idCaja`, `usuarioId` (integrante, FK a `usuarios`), `estado` (`EstadoCaja`), `abiertaEl`, `fondoInicial`, `efectivoDeclarado?`, `cerradaEl?`, `cerradaPorUsuarioId?`, `cerradaPorActorTipo?`, `porAusencia`, `efectivoEsperado?`, `diferencia?`, `motivo?`, `resumen?` (JSONB). `MovimientoCaja` (`tipo` `TipoMovimientoCaja`, `monto` > 0, `concepto` varchar 200, `creadoPorUsuarioId`, `createdAtMovimientoCaja`); `AnulacionMovimiento` (`movimientoId` único); `AjusteCaja` (`cajaId` destino, `pagoId`, exactamente uno de `correccionPagoId`/`correccionOperacionId`/`anulacionPagoId`, `formaPagoId`, `monto` con signo ≠ 0) |
| Parámetros (2.6) | `ParametroSistema` (claves nuevas). `HistorialParametro` (`historial_parametros`): `idHistorialParametro`, `clave`, `valorAnterior`, `valorNuevo`, `usuarioId`, `fecha` |
| Cuenta (2.7) | `Usuario.debeCambiarPasswordUsuario` (por defecto false) y `Usuario.sesionesValidasDesdeUsuario?` (los nombres de la spec A §2.6.5). `TokenRecuperacion` y `SolicitudRecuperacion` con los nombres de la spec A §2.7.5, salvo `idSolicitud` → `idSolicitudRecuperacion` |
| Fichas (2.7) | `FichaMesaEntrada` / `FichaGerente` (`fichas_mesa_entrada` / `fichas_gerente`) con el sufijo del modelo: `id…`, `usuarioId?` (único, `SetNull`), `activo…`, `nombre…`, `apellido…`, `nombreNormalizado…`, `apellidoNormalizado…`, `dni…` (único por tipo), `fechaNacimiento…`, `genero…?`, `telefono…?`, `email…`, `creadoPorUsuarioId?`, `modificadoPorUsuarioId?`, `createdAt…`, `updatedAt…`, `version`. Índices de orden `fichas_mesa_entrada_orden_listado_idx` y `fichas_gerente_orden_listado_idx` |
| Clase dictada (2.8, E) | `ClaseDictada` suma `conControlAsistencia`, `anuladaEl?`, `anuladaPorUsuarioId?`, `motivoAnulacion?`; `turnoId` deja de ser `@unique` (índice simple + parcial). `Turno.claseDictada` → `Turno.clasesDictadas` (1:N). `ClaseDictadaAlumno.estadoAsistencia?` (enum `EstadoAsistencia`). `CorreccionAsistencia`, `CorreccionAsistenciaAlumno`, `ObservacionClase`, `Indicacion`, `CorreccionResultadoExamen`, `AnulacionResultadoExamen` con los campos de la spec E §2.5.1; todas las FK `RESTRICT` |
| Bajas y reactivaciones (2.13, 2.14) | `HistorialEstado` (`historial_estados`): `idHistorialEstado`, `entidad` (`EntidadHistorialEstado`: `ALUMNO`, `PROFESOR`, `FICHA_MESA_ENTRADA`, `FICHA_GERENTE`, `FORMA_PAGO`), `entidadId`, `accion` (`AccionHistorialEstado`: `DESACTIVAR`, `REACTIVAR`), `motivo?`, `actorTipo`, `usuarioId?`, `fecha` |

Enums creados por el PR 0: `VigenciaInscripcion`, `EstadoPagoInscripcion`, `ActorTipo`, `EstadoCaja`, `TipoMovimientoCaja`, `EstadoAsistencia`, `EntidadHistorialEstado`, `AccionHistorialEstado` y los 6 valores nuevos de `TipoEventoSeguridad`. `eventos_turno.tipoEvento` es `String`, no un enum: `turno:profesor_cambiado` no necesita migración (R3-PR0-D8).

**Diferencias de forma respecto de las specs, para avisar a cada dueño** (ninguna cambia lo que piden; son nombres o restricciones extra):
- **E:** `anuladaPor` → `anuladaPorUsuarioId`. Además hay un CHECK de coherencia de la anulación: sin anular, las tres columnas en null; anulada, con `anuladaEl` y `motivoAnulacion`. Se agregaron las relaciones Prisma que la spec no escribía (`CorreccionAsistenciaAlumno.correccion`/`alumno`, `ObservacionClase.clase`, `Indicacion.alumno`/`materia`/`clase`, `ResultadoExamen.correcciones`/`anulacion`).
- **I:** `ajustadoPor` → `ajustadoPorUsuarioId`; `cerradaPor` → `cerradaPorUsuarioId` + `cerradaPorActorTipo`. `AnulacionPago` y `AnulacionMovimiento` llevan `actorTipo` (regla de actor de 2.1). `CorreccionOperacion` guarda una fila por campo (forma **o** fecha), como dice la spec I §2.14.2. La caja se identifica por el `usuarioId` del integrante. Las columnas de usuario de los registros de dinero (`OperacionPago`, `CorreccionPago`, `CorreccionOperacion`, `MovimientoCaja`, `AjusteCaja`) son NOT NULL: el usuario es un dato del hecho, no solo auditoría. CHECK de cierre: una caja `CERRADA` exige `cerradaEl`, actor, `efectivoDeclarado`, `efectivoEsperado`, `diferencia` y `resumen`; una `ABIERTA` no puede tener datos de cierre ni `porAusencia = true`.
- **C:** CHECK de coherencia en `turno_alumno`: `RESERVADA` ⇔ `venceEl` y `venceBaseEl` no nulos (`venceEl ≤ venceBaseEl` y con `inicioPlazo`); `VIGENTE` ⇔ sin `finalizadaEl`/actor; `precio > 0`. `marcarPagada` tiene que limpiar `venceBaseEl` y `venceEl` en el mismo `UPDATE` que pasa a `PAGADA` (es lo que ya dice 2.13).
- **L:** `tarifaHora` → `tarifaHoraMateria` (2.4 pide el sufijo). `HistorialTarifa` usa los nombres de la spec L.
- **A:** se usaron los nombres de la spec A (`debeCambiarPasswordUsuario`, `sesionesValidasDesdeUsuario`) y no los orientativos de 2.7 (`debeCambiarPassword`, `sesionesValidasDesde`). Reemisión de la sesión: no hizo falta esquema (la spec A la hace con `signIn`; la etapa 3 lo confirma).

**Objetos SQL manuales** (Prisma no los modela; toda migración futura se revisa a mano para no perderlos):
- Índices únicos parciales: `turno_alumno_vigente_key` (`alumnoId`, `turnoId`) `WHERE vigencia = 'VIGENTE'`; `clases_dictadas_turno_no_anulada_key` (`turnoId`) `WHERE "anuladaEl" IS NULL` (reemplaza `clases_dictadas_turnoId_key`); `cajas_abierta_por_integrante_key` (`usuarioId`) `WHERE estado = 'ABIERTA'`.
- Unicidad simple de observaciones: `observaciones_clase_claseDictadaId_key` (`@unique` de Prisma).
- Secuencia `comprobante_numero_seq`.
- CHECK: `turno_alumno_precio_check`, `turno_alumno_finalizada_check`, `turno_alumno_actor_check`, `turno_alumno_vencimiento_check`, `historial_inscripciones_actor_check`, `pagos_precio_check`, `correcciones_pago_montos_check`, `anulaciones_pago_actor_check`, `correcciones_operacion_campo_check`, `cajas_montos_check`, `cajas_cierre_check`, `cajas_actor_check`, `movimientos_caja_monto_check`, `anulaciones_movimiento_actor_check`, `ajustes_caja_monto_check`, `ajustes_caja_origen_check`, `materias_tarifa_hora_check`, `historial_tarifas_montos_check`, `clases_dictadas_anulacion_check`, `historial_estados_actor_check`.
- Funciones `sincronizar_reservas_turno()` y `sincronizar_reserva_alumno()` reemplazadas (`CREATE OR REPLACE`) y trigger `turno_alumno_sincronizar_reserva` recreado.
- Ya existían (Sprints 1 y 2): EXCLUDE y CHECK de `reservas_turno`, collation `natural_es`, extensión `btree_gist`.

**Triggers de reservas (2.0):**
- `sincronizar_reservas_turno()` proyecta solo las inscripciones `vigencia = 'VIGENTE'`.
- `sincronizar_reserva_alumno()` borra la reserva cuando la fila vieja era `VIGENTE` y la crea cuando la nueva lo es: INSERT, DELETE y UPDATE de vigencia.
- El trigger de `turno_alumno` ahora escucha solo `INSERT OR UPDATE OF "vigencia", "turnoId", "alumnoId" OR DELETE`: cambiar `estadoPago`, los vencimientos o el precio no toca `reservas_turno`.
- **R3-PR0-D4:** se confirmó contra `20260924150000` que `turno_sincronizar_reservas` ya escucha `UPDATE OF … "profesorId" …`. No hizo falta migración aditiva.
- Probado contra PostgreSQL, en una transacción con `ROLLBACK`:
  - inscripción vigente → 1 reserva;
  - quitada → 0;
  - re-inscripción en la misma clase → 1, sin violar la PK;
  - re-proyección por `UPDATE` del turno → solo la vigente;
  - dos vigentes del mismo par → `turno_alumno_vigente_key`;
  - actor `USUARIO` sin usuario → `turno_alumno_actor_check`;
  - `RESERVADA` sin vencimiento → `turno_alumno_vencimiento_check`.

**Deriva de esquema previa (no es de este PR):** `migrate diff` (desde las migraciones y desde la base migrada, con la misma salida) muestra solo `DROP`/`ADD CONSTRAINT "reservas_turno_turnoId_fkey"`: la migración de Sprint 2 la creó sin `ON UPDATE CASCADE` y Prisma la espera con él. Ya estaba en `develop` y no se tocó (1.1). Los índices parciales **no** aparecen en el diff.

**Permisos (2.9 y 2.9.1).** La tabla cerrada queda **sin renombres**: todas las acciones tienen el nombre de 2.9.1. Las 92 filas (65 acciones) están en migración y en `PERMISOS` del seed. Se comprobó que una base con solo migraciones y la misma base después del seed tienen **exactamente** la misma lista.

| Acción | Roles | HU |
|---|---|---|
| `sesion:ping` | M, G, P, A | HU-A-02 (pasa a migración) |
| `cuenta:cambiar_password` | M, G, P, A | HU-A-06 |
| `materias:crear`, `materias:editar` | G | HU-L-01, L-03 (`crear` pasa a migración) |
| `materias:leer` | M, G, P | HU-L-02 (pasa a migración) |
| `materias:cambiar_tarifa` | G | HU-L-06, L-07 |
| `materias:ver_tarifa` | M | HU-L-06 crit. 7 |
| `aulas:crear`, `aulas:leer`, `aulas:editar` | G | HU-K-01..03 (`crear`/`leer` pasan a migración) |
| `alumnos:crear`, `alumnos:editar` | M | HU-B-01..06 (`crear` pasa a migración) |
| `alumnos:leer` | M, G, P | HU-E-02 crit. 8. **El Profesor la conserva** hasta HU-E-02, que se la quita (8 g) con una migración nueva, en el mismo cambio en que agrega su acceso acotado al historial |
| `alumnos:cambiar_estado` | M | HU-B-07 |
| `profesores:crear`, `profesores:editar` | M | HU-D-01..07 (corregido: la migración se los daba a G) |
| `profesores:leer` | M, G | HU-D-05, D-08 |
| `profesores:cambiar_estado` | G | HU-D-08 (sin permisos nuevos sobre `turnos:*`) |
| `turnos:leer` | M, G, P | sin cambios |
| `turnos:crear`, `asignar_participantes`, `asignar_aula`, `cancelar`, `reprogramar`, `priorizar` | M | sin cambios |
| `turnos:leer_propios`, `turnos:solicitar_propio` | A | sin cambios |
| `turnos:cancelar_propia` | A | HU-C-14 |
| `reservas:leer` | M | HU-C-26 |
| `calendario:leer` | M, G, P | HU-J (pasa a migración) |
| `formas_pago:crear` | G | sin cambios |
| `formas_pago:leer` | M, G | sin cambios |
| `formas_pago:editar`, `formas_pago:desactivar` | G | HU-I-07 |
| `pagos:crear` | M | sin cambios (el Gerente no lo tiene) |
| `pagos:leer` | M, G | sin cambios |
| `pagos:corregir` | M (acotado), G | HU-I-06 |
| `pagos:leer_propios` | A | HU-I-05 |
| `comprobantes:leer` | M, G | HU-I-11 |
| `comprobantes:leer_propios` | A | HU-I-11 |
| `cajas:abrir`, `cajas:movimiento`, `cajas:cerrar`, `cajas:leer` | M | HU-I-12 |
| `cajas:leer_todas`, `cajas:cerrar_ausencia` | G | HU-I-12 |
| `clases:registrar`, `examenes:registrar` | M, P | sin cambios |
| `clases:corregir` | M, P | HU-E-11 |
| `examenes:corregir` | M, P | HU-E-10 |
| `observaciones:registrar` | M, P | HU-E-07 |
| `indicaciones:registrar` | M, P | HU-E-04 |
| `historial:leer` | M, G, P | sin cambios de filas (cambia el alcance del Profesor) |
| `historial:leer_propio` | A | HU-E-08 |
| `indicadores:leer` | G | sin cambios |
| `personal:crear`, `personal:editar`, `personal:leer`, `personal:cambiar_estado` | G | HU-F-01, F-03, F-05 |
| `gerentes:crear`, `gerentes:editar`, `gerentes:leer`, `gerentes:cambiar_estado` | G | HU-G-01, G-03, G-05 |
| `configuracion:leer`, `configuracion:editar` | G | HU-N-01 |

- `ACCIONES_SOLO_MESA_ENTRADA` del seed queda en `profesores:crear` y `profesores:editar`, así que el Gerente conserva `profesores:leer` después del seed (verificado).
- Nuevo `PERMISOS_REVOCADOS` en el seed, por ahora vacío: el upsert no borra filas viejas. HU-E-02 agrega ahí `PROFESOR alumnos:leer` junto con su migración.
- La migración borra filas de `roles_permisos` (`DELETE`): es configuración, no una entidad de dominio, y el seed ya lo hacía.
- Las rutas (`rutas-por-rol.ts`, `proxy.ts`) son de la etapa 3.

**Parámetros (2.6):**
- La migración inserta, con `ON CONFLICT DO NOTHING`: `plazo_pago_horas = 24`, `cancelacion_anticipacion_horas = 24`, `umbral_presentismo = 75`, `centro_nombre = «Instituto Noctium»`, `centro_domicilio = «Av. Siempreviva 742»` y `centro_telefono = «351-4000000»`. Los datos del centro son valores de prueba y se cambian con HU-N-01 o a mano.
- El seed los crea si faltan y **no los pisa** (`PARAMETROS_CONFIGURABLES`, rama de actualización vacía). Los parámetros técnicos de siempre se siguen actualizando como antes.
- **`generacion_maxima_dias`:** lo inserta `20260928150100`, pero no lo lee el código (lo reemplazó `generacion_maxima_meses`, HU-C-17) ni lo siembra el seed. Se deja como está: no se borra para no tocar una migración ni un dato existente. Queda anotado para que HU-N-01 no lo muestre.

**Formas de pago (2.5):**
- La migración falla si no existe `formapago-efectivo` y no elige por nombre.
- El seed identifica las cuatro formas por su id fijo (`formapago-efectivo`, `-transferencia`, `-debito`, `-mercado-pago`), con la rama de actualización vacía.
- Verificado en la base descartable: después de renombrar «Efectivo» y desactivar «Mercado Pago» entre corridas, el seed conserva el nombre, la desactivación, `esEfectivo = true` y los ids, y sigue habiendo 4 formas.

**Seed base (2.16, etapa 1).** Qué siembra:
- 15 cuentas:
  - `gerente@` y `gerente2@` con su `FichaGerente` (DNI `24100001` y `24100002`);
  - `mesa.entrada@` y `mesa.entrada2@` con su `FichaMesaEntrada` (DNI `25100001` y `25100002`);
  - `profesor1..4@`;
  - las 7 de alumnos (6 activas y 1 inactiva).
- Las 4 formas de pago.
- 40 alumnos y las 6 fichas «Demo Historico».
- 24 profesores, con sus materias y horarios.
- 7 materias, todas **con tarifa** (entre $ 9.000 y $ 13.000, solo al crearlas; los códigos ya eran alfanuméricos). Las aulas.
- Los parámetros y los datos del centro.
- La matriz de permisos.
- 38 clases de prueba (`seed-turno-*`): 33 `DISPONIBLE` (con profesor, aula y cupo), 4 `PENDIENTE` y 1 `CANCELADO`, **sin inscriptos**.

Cómo lo siembra:
- Las fichas usan el email de la cuenta y solo se crean si faltan (por DNI).
- Las cuentas de profesor vinculadas para la demostración son `profesor1..4@`: Giménez, Rossi, Vega y Acuña. Las demás fichas de profesor quedan sin cuenta.
- Las clases que el plan llevaba a `COMPLETO` se guardan `DISPONIBLE` (`estadoSeedBase`): llegan a `COMPLETO` con sus inscripciones. `TurnoSeed.alumnos` queda como **plan de inscriptos** para el seed de escenarios y `validarDatos()` lo sigue verificando.
- Las clases **solo se crean si faltan**: se eliminó el `turno.deleteMany` y quedan con la fecha de la primera corrida.

Qué se sacó del seed:
- Las inscripciones (`turnoAlumno.createMany`), los 4 pagos de muestra y la clase dictada y el examen de `seed-turno-26`. Los rehacen los escenarios, con servicios (etapas 2 y 3).
- El **historial de Indicadores** (`HISTORICO_MENSUAL`: turnos pasados con inscriptos y pagos). Según 2.16 lo agregan como fixtures las HU de presentación (H-06, H-07, H-10). Hasta entonces `/gerente` muestra los meses sin datos. Avisar al responsable de las HU de H.
- Los borrados de pagos, clases dictadas y exámenes por id fijo.

Verificado en una base descartable migrada:
- el seed corre sin errores;
- una segunda corrida crea 0 turnos y no cambia la matriz;
- conserva la tarifa y el parámetro cambiados a mano.

**Errores de `tsc` que quedan (15, todos de 2.0):**

| Archivo | Líneas | Motivo |
|---|---|---|
| `src/server/turnos/turno.service.ts` | 314 | `createMany` de `asignarParticipantesTurno` sin `estadoPago`/`precio`/`reservadaEl` (pasa a `crearInscripcion` y `finalizarInscripcion`) |
| | 378 | `findUnique` por `turnoId_alumnoId` |
| | 386 | `create` de la inscripción (pasa a `crearInscripcion`) |
| `src/server/pagos/pago.service.ts` | 33 | `create` de `Pago` sin `operacionId`/`inscripcionId`/`precio` (pasa a `registrarOperacion` `compatSprint2`) |
| `src/server/historial/clase-dictada.service.ts` | 67, 77, 98 | `findUnique` por `turnoId` (ya no es único → `findFirst` con `anuladaEl: null`) |
| | 89, 116 (×2), 122, 126 (×2) | Derivados de los anteriores: `_count`/`alumnos` del `include` y tipos implícitos |
| `src/server/historial/historial.publico.ts` | 10, 21 | `findUnique` por `turnoId` (`obtenerClaseDictadaDeTurno`) y su `_count` |

La línea base antes del PR 0 tenía 0 errores. **Usos de la relación `Turno` → `ClaseDictada` que pasan a 1:N:** `clase-dictada.service.ts:66,76,97` y `historial.publico.ts:9` (`findUnique` por `turnoId`). Ningún archivo usa `include`/`select` de `Turno.claseDictada` ni `isNot`/`is` sobre ella: los demás leen por la fachada `obtenerClaseDictadaDeTurno`. El `createMany(..., skipDuplicates)` de `clase-dictada.service.ts:63` (`ON CONFLICT DO NOTHING` sin destino) sigue funcionando con el índice parcial.

**Lecturas que deciden con `Turno.estado` (relevamiento preliminar para la etapa 3):**
- `turno.service.ts:375` (`CUPO_INSUFICIENTE` por estado guardado);
- `turno.service.ts:449` (opciones de «Solicitar clase»: `estadoTurno: "DISPONIBLE"`);
- `calendario.service.ts:129` (estado mostrado);
- `turno.publico.ts:276-307` (`ajustarCuposPorCapacidadDeAula`).

Las pantallas toman `estado` de esas respuestas.

**`.env.example` (2.11):** se agregaron `NEXTAUTH_URL` (con nota: NextAuth acepta también el `AUTH_URL` que ya estaba documentado), `RESEND_API_KEY`, `EMAIL_FROM` y `CRON_SECRET`, sin valores reales, y una nota sobre la zona horaria como constante. `CODIGO_OTP_SECRET` ya estaba documentada.

**Pendientes y dudas abiertas de la etapa 1:**
1. **Repetibilidad completa del seed (etapa 2).** Los upserts heredados de usuarios, alumnos, profesores y materias siguen actualizando campos de negocio en cada corrida (`activoUsuario`, `activoAlumno`, `codigoMateria`, etc.): pisarían una baja de HU-B-07/D-08/F-05 o una edición. No se tocó en la etapa 1 para no cambiar datos que hoy usan las pruebas manuales. Se resuelve junto con la verificación de repetibilidad de la etapa 2.
2. **Plan de inscriptos de `seed-turno-09`** (`CANCELADO` con alumnos planeados): `crearInscripcion` no inscribe en una clase cancelada. El seed de escenarios tiene que inscribir antes de cancelar con el servicio de cancelación, o cambiar el plan.
3. **Reloj del seed:** el día 0 de las clases es el próximo día operativo, mientras que 2.16 pide clases de escenario entre 2 y 14 días después. Alinear `SEED_FECHA_HOY` con `ahora()` es de la etapa 2.
4. **CHECKs más estrictos que la spec** (vencimiento, cierre de caja, corrección de operación, origen del ajuste): los servicios de la etapa 2 tienen que escribir en una sola sentencia los campos que la regla une. Si un dueño necesita un estado intermedio, se relaja con una migración del PR 0.
5. **Cambios de estado de pago e I:** 2.13 dice que I usa `registrarCambioEstado` para los cambios de estado de pago. Este PR los modela en `HistorialInscripcion` (transiciones de la inscripción) y deja `HistorialEstado` para bajas y reactivaciones de las cinco entidades. Confirmar con el responsable de I.
6. `tokens_recuperacion.usuarioId` y `cajas.usuarioId` son FK `RESTRICT` a `usuarios`: una cuenta con enlaces o cajas no se puede borrar (no hay borrado de cuentas en el sprint).
7. **Base de desarrollo:** las tres migraciones y el seed se probaron sobre bases descartables del mismo PostgreSQL local (`noctium_pr0_shadow` y `noctium_pr0_mig`). El `prisma migrate reset` sobre `noctium_dev` necesita el consentimiento explícito que pide Prisma cuando lo ejecuta un agente.

### 5.2 Etapa 2, parte 1 — infraestructura de los servicios

Esta parte deja la base sobre la que se apoyan los servicios de 2.13: errores de dominio y archivo central de textos, `bloquear`, `transaccion`, el reloj, el historial único, la regla «vigente a un momento dado» y las fábricas de prueba. No toca ningún archivo de 2.0. `tsc` sigue con los mismos 15 errores de 5.1 y todo archivo nuevo compila.

**Archivos nuevos**

| Archivo | Qué es |
|---|---|
| `src/lib/textos.ts` | Archivo central de textos (HU-C-23): `TEXTOS`, `ClaveTexto`, `texto(clave, valores?)` |
| `src/server/shared/errores-dominio.ts` | Catálogo `ERRORES_DE_DOMINIO`: clave → `{ code, status }` |
| `src/server/shared/error-dominio.ts` | `ErrorDeDominio`, `esErrorDeDominio` |
| `src/server/shared/reloj.ts` | `ahora()`, `conReloj()` |
| `src/server/shared/fechas-centro.ts` | Zona del centro y helpers de fechas de dominio |
| `src/server/shared/transaccion.ts` | `transaccion()`, `despuesDelCommit()`, tiempos y traducción de errores |
| `src/server/shared/bloquear.ts` | `bloquear()` en orden canónico |
| `src/server/shared/historial.ts` | Historial único: `registrarHistorial`, `encolarHistorial`, actor |
| `src/server/turnos/inscripcion.vigencia.ts` | «Vigente a un momento dado» (2.2) y recálculo de `Turno.estado` |
| `src/server/testing/fabricas.ts` | Fábricas de datos de prueba compartidas |
| `src/server/testing/pg.ts` | Habilitación de las pruebas con PostgreSQL real |
| `scripts/test-pg.mjs` (`npm run test:pg`) | Corre los `*.pg.test.ts` contra una base descartable |

Pruebas nuevas: `errores-dominio.test.ts` (incluye la prueba de claves de HU-C-23), `reloj.test.ts`, `transaccion.test.ts`, `bloquear.test.ts`, `historial.test.ts`, `inscripcion.vigencia.test.ts`, y con PostgreSQL real `bloquear.pg.test.ts` e `inscripcion.vigencia.pg.test.ts`.

**Firmas reales** (contrato para las HU y para las partes 2 a 4):

```typescript
// src/server/shared/error-dominio.ts
class ErrorDeDominio extends ServiceError {
  readonly codigo: CodigoErrorDominio;          // clave del archivo central (p. ej. "errores.caja.sinCajaAbierta")
  readonly status: number;                      // HTTP del catálogo
  readonly datos?: Record<string, unknown>;     // también expuestos como `detalles`
  constructor(codigo: CodigoErrorDominio, datos?: Record<string, unknown>);
  // heredados: code (el estable de la API), message (texto de la clave con los huecos completados), detalles
}
function esErrorDeDominio(error: unknown, codigo?: CodigoErrorDominio): error is ErrorDeDominio;

// src/lib/textos.ts
const TEXTOS: { readonly [clave: string]: string };   // `as const`; ClaveTexto = keyof typeof TEXTOS
function texto(clave: ClaveTexto, valores?: Record<string, unknown>): string;   // huecos `{nombre}`

// src/server/shared/reloj.ts
function ahora(): Date;
function conReloj<T>(momento: Date | (() => Date), fn: () => T): T;   // lanza RelojNoModificableError en producción

// src/server/shared/fechas-centro.ts  (UTC−3 fijo, sin horario de verano)
const ZONA_CENTRO = "America/Argentina/Buenos_Aires";
function inicioDeTurno(turno: { fechaTurno: Date; horaInicioTurno: Date }): Date;
function finDeTurno(turno: { fechaTurno: Date; horaInicioTurno: Date; duracionMinutosTurno: number }): Date;
function fechaCentro(momento: Date): Date;          // día del centro como valor @db.Date
function inicioDelDiaCentro(momento: Date): Date;
function finDelDiaCentro(momento: Date): Date;      // exclusivo: 00:00 del día siguiente
function instanteCentro(fecha: string, hhmm?: string): Date;

// src/server/shared/transaccion.ts
type Tx = Prisma.TransactionClient;
type ContextoTransaccion = { despuesDelCommit(tarea: () => unknown): void };
function transaccion<T>(fn: (tx: Tx, ctx: ContextoTransaccion) => Promise<T>,
  opciones?: { db?: PrismaClient; tiempos?: Partial<typeof TIEMPOS_TRANSACCION> }): Promise<T>;
function despuesDelCommit(tx: Tx, tarea: () => unknown): void;   // para los servicios, que reciben solo el tx
function tieneColaPosterior(tx: Tx): boolean;
function esErrorDeConcurrencia(error: unknown): boolean;

// src/server/shared/bloquear.ts
type SolicitudBloqueo = {
  formasPago?: boolean;
  recursos?: { aulas?, materias?, profesores?, alumnos?, fichasMesaEntrada?, fichasGerente?: readonly string[] };
  clases?: readonly string[]; inscripciones?: readonly string[]; operaciones?: readonly string[]; cajas?: readonly string[];
};
function bloquear(tx: Tx, solicitud: SolicitudBloqueo): Promise<Partial<Record<TipoBloqueo, string[]>>>;  // ids encontrados y bloqueados
class ErrorDeBloqueo extends Error {}

// src/server/shared/historial.ts
type ActorDominio = { tipo: "USUARIO"; usuarioId: string } | { tipo: "PROCESO_AUTOMATICO" };
const PROCESO_AUTOMATICO: ActorDominio;
function actorUsuario(usuarioId: string): ActorDominio;
function columnasActor(actor: ActorDominio): { actorTipo: ActorTipo; usuarioId: string | null };
type DatosHistorial =
  | { tipo: "INSCRIPCION"; inscripcionId; vigenciaAnterior; vigenciaNueva; estadoPagoAnterior; estadoPagoNuevo; actor; fecha }
  | { tipo: "ESTADO"; entidad; entidadId; accion; motivo?; actor; fecha }
  | { tipo: "EVENTO_TURNO"; tipoEvento; turnoId; usuarioId; payload }
  | { tipo: "EVENTO_SEGURIDAD"; tipoEvento; usuarioId; email; ip };
function prepararHistorial(datos: DatosHistorial): DatosHistorial & { id: string };
function registrarHistorial(registro, opciones?: { db?; reintentos?: number; esperaMs?: number }): Promise<boolean>;
function encolarHistorial(tx: Tx, datos: DatosHistorial, opciones?): DatosHistorial & { id: string };

// src/server/turnos/inscripcion.vigencia.ts  (módulo C)
type InscripcionParaVigencia = { vigencia; estadoPago; venceEl: Date | null; estadoClase: EstadoTurno };
function esVigenteEn(inscripcion: InscripcionParaVigencia, momento: Date): boolean;
function sqlVigenteEn(alias: string, momento: Date): Prisma.Sql;
function inscripcionesVigentes(db, turnoId: string, momento: Date): Promise<{ id: string; alumnoId: string }[]>;
function ocupacion(db, turnoId: string, momento: Date):
  Promise<{ inscriptos: number; cupo: number | null; estadoGuardado: EstadoTurno; estado: EstadoTurno } | null>;
function estadoSegunOcupacion(estadoGuardado: EstadoTurno, inscriptos: number, cupo: number | null): EstadoTurno;
function recalcularEstadoTurno(tx: Tx, turnoId: string, momento: Date):
  Promise<{ anterior: EstadoTurno; nuevo: EstadoTurno; cambio: boolean } | null>;
function calcularVencimiento(momento: Date, inicioClase: Date, plazoHoras: number): { venceBaseEl: Date; venceEl: Date };
```

Fábricas (`src/server/testing/fabricas.ts`; todas reciben `db` como primer parámetro, un `PrismaClient` o un `tx`):
- `unico(prefijo?)`, `crearUsuarioDePrueba`, `crearFichaMesaEntradaDePrueba`, `crearFichaGerenteDePrueba`;
- `crearAlumnoDePrueba`, `crearProfesorDePrueba`, `crearMateriaDePrueba` (con tarifa por defecto; `tarifaHora: null` = sin tarifa), `crearAulaDePrueba`;
- `crearTurnoDePrueba` (DISPONIBLE, a 3 días, 10:00, 60 min, cupo 10, con su propio profesor, aula y materia);
- `crearInscripcionDePrueba` (por defecto `PAGO_SIN_REGISTRAR`; con `RESERVADA` calcula el vencimiento);
- `abrirCajaDePrueba`;
- `crearOperacionDePrueba` (un pago por inscripción; deja cada inscripción `PAGADA` y sin vencimiento).

**Tiempos de `transaccion` (2.10):**
- `maxWait`: 2000 ms.
- `timeout`: 8000 ms.
- Aislamiento: READ COMMITTED.
- `SET LOCAL lock_timeout = '5000ms'` y `SET LOCAL statement_timeout = '7000ms'` al empezar.
- `opciones.tiempos` existe solo para que las pruebas provoquen la espera de un bloqueo.
- Se traducen a `ErrorDeDominio("errores.transaccion.ocupada")` (409 `TRANSACCION_OCUPADA`): P2028, P2034 y 55P03/40P01, vengan en `meta.code` o en el mensaje.

**Decisiones:**
1. **Archivo central de textos.** No existía (HU-C-23 todavía no se mergeó), así que el PR 0 crea `src/lib/textos.ts` con claves planas `area.subarea.nombre`. HU-C-23 puede reorganizar el archivo y sumar los textos de pantalla, pero tiene que conservar estas claves. La prueba de claves (`errores-dominio.test.ts`) verifica tres cosas: que todo código del catálogo tiene texto, que todo `new ErrorDeDominio("…")` del código usa una clave del catálogo, y que los textos de Sprint 2 que reusa el catálogo son idénticos a los de `POST /api/pagos` y `turno.service.ts`.
2. **Códigos que ya existían:** conservan su `code` y su texto de hoy. Cuando el texto depende de quién opera, hay dos claves con el mismo `code`: `alumnoYaAsignado`/`alumnoYaAsignadoPropio`, `alumnoNoDisponible`/`…Propio` e `inactivo`/`inactivoPropio`. Los códigos existentes de E (`CLASE_NO_REGISTRADA`, `TURNO_NO_ADMITE_CLASE`, etc.) no están en el catálogo: hoy su `message` es el propio `code`, y las HU de E agregan su clave conservando ese comportamiento.
3. **Choques de códigos:** ninguno con distinto significado o HTTP. Los que se comparten a propósito:
   - `MOTIVO_REQUERIDO` (400): D y formas de pago de I;
   - `FUERA_DE_ALCANCE` (403): pagos y caja;
   - `CAJA_NO_ABIERTA` (409): dos textos, los criterios 2 y 9 de HU-I-12;
   - `MATERIA_SIN_TARIFA` (422): un texto para el alumno (P-C2) y otro para mesa de entrada. Para mesa se tomó el de `spec_modulo_L.md` 3.12 («Esta materia…») y no la propuesta de P-C2 («La materia…»).
4. **Textos propuestos por el PR 0** (la spec no trae literal; marcados «propuesto» en el archivo):
   - C: `errores.inscripcion.noVigente` y `noEncontrada`;
   - D: `errores.profesor.yaInactivo`, `yaActivo`, `motivoRequerido` y `destinoIgualOrigen`;
   - E: todos los de 2.6 a 2.12;
   - I: `turnoYaEmpezo`, `reservaVencida`, `inscripcionYaPagada`, `motivoAjusteRequerido`, `pago.noEncontrado`/`anulado`/`yaAnulado`/`sinCambios`/`fueraDeAlcance`, `comprobante.noEncontrado`, los de caja salvo los cinco con literal, y `formaPago.yaActiva`/`yaInactiva`/`motivoRequerido`.

   Avisar a los dueños de C, D, E e I para que los confirmen.
5. **`esVigenteEn`:** la firma de la spec es `(inscripcion, momento)`; el objeto inscripción lleva además `estadoClase`, porque la regla depende del estado de la clase (en una Cancelada no vence nada). Una `RESERVADA` sin `venceEl` (imposible por el CHECK) cuenta como vigente.
6. **`sqlVigenteEn(alias, momento)`:** decide el estado de la clase con una subconsulta sobre `turnos` (así no necesita un segundo alias). El momento viaja como parámetro (`'…'::timestamptz AT TIME ZONE 'UTC'`), así que no depende del `TimeZone` de la sesión. La prueba con PostgreSQL real verifica que da lo mismo que `esVigenteEn` antes de `venceEl`, en `venceEl` y después, con una reserva, una pagada, una sin plazo, una quitada y una reserva de una clase cancelada.
7. **`recalcularEstadoTurno`:** el llamador ya bloqueó la clase. Escribe con `updateMany` condicionado al estado anterior y no toca una clase `PENDIENTE` ni `CANCELADO`. `marcarVencidas`, `marcarVencidasDelAlumno` y el resto de las escrituras de la inscripción son de la parte 2.
8. **`bloquear`:**
   - Los recursos se toman en el orden en que los lista 2.10: aula, materia, profesor, alumno, ficha de mesa de entrada, ficha de gerente.
   - Dentro de cada tipo se ordena por id con `COLLATE "C"`, igual que `Array.prototype.sort`: así no importa la collation de la base.
   - El conjunto «formas de pago» toma todas las activas y no se combina en ninguna dirección: no se pide junto con otros niveles, y una transacción que ya lo tomó no toma más bloqueos.
   - Un id que no existe no es error: el resultado trae los encontrados y decide el servicio.
   - En producción, un pedido fuera de orden se registra con `console.error` y se bloquea igual. En desarrollo y en las pruebas lanza `ErrorDeBloqueo`.
   - El estado de los bloqueos tomados se guarda por transacción, en un `WeakMap` sobre el `tx`.
9. **`despuesDelCommit`:**
   - Los servicios reciben solo el `tx`, así que la cola se asocia al `tx` que abre `transaccion()`. Llamarla con un `tx` que no vino de ahí lanza error, para no perder el historial en silencio.
   - Las tareas corren en orden después del COMMIT y `transaccion` resuelve recién cuando termina la cola.
   - Si una tarea falla, se registra y la operación igual resuelve: ya confirmó.
10. **`registrarHistorial`:** id UUID v4 (`node:crypto`), generado antes del commit. Escribe con `createMany({ skipDuplicates: true })`, así reintentar con el mismo id no duplica. Hace 1 intento y hasta 3 reintentos, con espera de 100, 200 y 400 ms. Si todos fallan, registra el error sin datos sensibles y devuelve `false`, sin lanzar.
11. **Unificación de `emitirEventoTurno` y `EventoSeguridad`.** `registrarHistorial` escribe los cuatro tipos con el mismo mecanismo (transiciones de inscripción, bajas y reactivaciones, eventos de turno y eventos de seguridad), pero los llamadores existentes **no se migraron**:
   - `emitirEventoTurno` vive en `turno.service.ts`, que es de 2.0 y se adapta en la etapa 3.
   - Los escritores de `EventoSeguridad` (`autenticacion.service.ts`, `autorregistro.service.ts`) tienen tests que verifican el `data` exacto del `create`. Con el id generado antes, ese `data` cambiaría y habría que debilitar la aserción, cosa que prohíbe 1.1. Además, la spec A pide que el error de `LOGOUT` se propague.

   El código nuevo usa `encolarHistorial`/`registrarHistorial`; los llamadores existentes siguen funcionando igual.
12. **Reloj:** `ahora()` usa `AsyncLocalStorage`, así que el momento inyectado vale para todo lo que corre dentro de `conReloj`, incluido lo asincrónico, sin pisar otras ejecuciones concurrentes. En producción `conReloj` lanza error.
13. **`SEED_FECHA_HOY`:** queda alineado con `ahora()`. Si está definida, el seed corre dentro de `conReloj` a las 12:00 del centro de esa fecha; si no, «hoy» es el día real del centro. Ahora también se admite al sembrar, no solo con `SEED_SOLO_VALIDAR=1`, porque 2.16 dice que el CI puede fijarlo y las clases se crean solo si faltan. Formato inválido: el seed se detiene.
14. **Fábricas:** escriben directo en la base respetando los CHECK y la equivalencia de «Pagada», porque los servicios llegan en la parte 2. `crearOperacionDePrueba` no emite comprobante (eso es de `emitirComprobante`). Cuando estén los servicios, `crearInscripcionDePrueba`, `crearOperacionDePrueba` y `abrirCajaDePrueba` pueden pasar a usarlos sin cambiar de firma.
15. **Pruebas con PostgreSQL real:**
   - Variable nueva `HU_PR0_TEST_DATABASE_URL`: las pruebas corren solo si es igual a `DATABASE_URL`.
   - `npm run test:pg [rutas…]`:
     1. crea `noctium_pruebas_<aleatorio>` en el servidor local de `DATABASE_URL`, o en el de `PG_PRUEBAS_ADMIN_URL` (solo localhost);
     2. aplica `prisma migrate deploy`;
     3. corre los `*.pg.test.ts` de esas rutas sin paralelismo entre archivos, con `TZ=UTC` y con todas las `HU_*_TEST_DATABASE_URL` del repo apuntando a esa base (`HU_PR0`, `HU_C05`, `HU_C06`, `HU_C10`, `HU_C13`, `HU_C15` y `HU_C17`);
     4. la borra aunque las pruebas fallen.
   - Sin rutas corre todos los `*.pg.test.ts`. Los de Sprint 2 van a fallar hasta la etapa 3 (2.0), así que por ahora conviene pasarle las rutas nuevas.

**Resultado:**
- `npm test`: 138 archivos (122 pasan, 16 saltados), 1786 pruebas (1690 pasan, 96 saltadas), 0 fallas.
- `npm run test:pg -- src/server/shared src/server/turnos/inscripcion.vigencia.pg.test.ts`: 2 archivos y 14 pruebas, todas pasan. La base descartable se borró al terminar.
- `npm run lint`: 0 errores; queda 1 aviso que ya existía (`src/components/layout/Sidebar.tsx`, `CALENDARIO` sin usar).
- `npx tsc --noEmit`: los mismos 15 errores de 5.1, en los mismos archivos y líneas.

**Dudas abiertas de esta parte:**
1. **`statement_timeout` (57014):** con `lock_timeout` (5 s) por debajo de `statement_timeout` (7 s), una espera de bloqueo corta antes por 55P03, que sí se traduce. Un 57014 (consulta que tarda más de 7 s por otro motivo) **no** se traduce a `TRANSACCION_OCUPADA` y sale como error. La lista de 2.10 no lo incluye. Confirmar si debe sumarse.
2. **Llamadores existentes de eventos de turno y de seguridad:** confirmar si en la etapa 3 se migran a `registrarHistorial` ajustando solo los mocks de persistencia, o si quedan como están. La decisión 11 los deja como están.
3. **Textos propuestos:** los confirma cada dueño de módulo (decisión 4).


### 5.3 Etapa 2, parte 2 — inscripción, tarifas, apertura de caja, cobro y comprobante

**Respuestas del responsable del PR 0 a las dudas de la parte 1:**
- `statement_timeout` (57014) **no** se traduce a `TRANSACCION_OCUPADA`: queda como está.
- `emitirEventoTurno` y los escritores de `EventoSeguridad` quedan como están, también en la etapa 3. El código nuevo usa `encolarHistorial`/`registrarHistorial`.
- Los textos marcados «propuesto» los confirman los dueños de cada módulo; el responsable del PR 0 les avisa.
- Las pruebas con PostgreSQL se corren siempre pasando las rutas nuevas a `npm run test:pg`.

**Archivos nuevos**

| Módulo | Archivo | Contenido |
|---|---|---|
| L | `src/server/shared/precio-clase.ts` | `precioClase` (helper compartido, 2.4) |
| L | `src/server/materias/materia.publico.ts` (función nueva en un archivo existente) | `obtenerTarifasPorIds` |
| N | `src/server/shared/parametros-vigentes.ts` | `parametrosVigentes`, `datosCentro` |
| C | `src/server/turnos/inscripcion.service.ts` | Servicio de inscripción |
| C | `src/server/turnos/inscripcion.publico.ts` | Fachada: reexporta el servicio y `inscripcion.vigencia.ts` |
| I | `src/server/pagos/caja.service.ts` y `caja.publico.ts` | `abrirCaja`, `cajaAbiertaDe` |
| I | `src/server/pagos/operacion.service.ts` | `registrarOperacion` |
| I | `src/server/pagos/comprobante.service.ts` y `comprobante.schema.ts` | `emitirComprobante`, `emitirReemplazo`, contrato Zod de `datos` |
| I | `src/server/pagos/pago.vigente.ts` | Valor vigente de una operación y conteo de pagos no anulados |
| F | `src/server/personal/personal.publico.ts` | Fachada mínima: `obtenerNombresPersonal`, `bloquearIntegranteActivo` |

Pruebas nuevas:
- unitarias: `src/server/shared/precio-clase.test.ts` (precio, parámetros, tarifas y contrato del comprobante);
- con PostgreSQL real: `src/server/turnos/inscripcion.service.pg.test.ts` y `src/server/pagos/operacion.service.pg.test.ts`;
- `src/server/publico.aislamiento.test.ts` suma, sin quitar nada, las cuatro fachadas nuevas o ampliadas.

**Firmas reales** (contrato para las HU):

```typescript
// L — src/server/materias/materia.publico.ts y src/server/shared/precio-clase.ts
function obtenerTarifasPorIds(ids: string[], db?): Promise<{ id: string; tarifaHora: number | null }[]>;
function precioClase(materia: { tarifaHora: number | null }, duracionMin: number,
  opciones?: { paraAlumno?: boolean }): number;   // MATERIA_SIN_TARIFA 422; falla si no es entero

// N — src/server/shared/parametros-vigentes.ts (lee la base en cada llamada)
function parametrosVigentes(db?): Promise<{ plazoPagoHoras: number; cancelacionAnticipacionHoras: number; umbralPresentismo: number }>;
function datosCentro(db?): Promise<{ nombre: string; domicilio: string; telefono: string }>;

// C — src/server/turnos/inscripcion.publico.ts
type OrigenInscripcion = "ALUMNO" | "CENTRO" | "PAGO";
type InscripcionResumen = { id; turnoId; alumnoId; vigencia; estadoPago; reservadaEl; inicioPlazo; venceBaseEl; venceEl;
  precio; reabiertaPorAnulacion; finalizadaEl };
function crearInscripcion(tx, datos: { turnoId; alumnoId; origen: OrigenInscripcion; conReserva: boolean; actor: ActorDominio;
  alumnoActivo?: boolean; bloqueosTomados?: boolean; momento?: Date }):
  Promise<{ inscripcion: InscripcionResumen; estadoTurno: EstadoTurno; completado: boolean; inscriptos: number; cupo: number; alumnoIds: string[] }>;
function exigeInscripcionConPago(db, datos: { turnoId; alumnoId; momento?: Date }):
  Promise<{ exige: boolean; motivo: "RESERVA_VENCIDA" | "CANCELADA_SIN_PAGO" | null }>;
function finalizarInscripcion(tx, datos: { inscripcionId; vigencia: "CANCELADA_ALUMNO" | "RESERVA_VENCIDA" | "BAJA_ALUMNO" | "QUITADA_CENTRO";
  actor: ActorDominio; fecha?: Date; soloSiReservaPendiente?: boolean }):
  Promise<{ inscripcionId; turnoId; alumnoId; vigencia; estadoPago; estadoTurno: { anterior; nuevo; cambio } | null }>;
function marcarPagada(tx, inscripcionId: string, pagosNoAnulados: number, actor: ActorDominio): Promise<CambioEstadoPago>;
function recalcularEstadoPago(tx, inscripcionId: string, pagosNoAnulados: number, actor: ActorDominio): Promise<CambioEstadoPago>;
//   CambioEstadoPago = { cambio: boolean; anterior: EstadoPagoInscripcion; nuevo: EstadoPagoInscripcion; venceEl: Date | null }
function recalcularVencimientos(tx, turnoId: string, opciones?: { momento?: Date }): Promise<{ marcadas: number; recalculadas: number }>;
function marcarVencidas(tx, turnoId: string, opciones?: { momento?: Date }): Promise<number>;
function marcarVencidasDelAlumno(tx, alumnoId: string, datos: { momento: Date; clases: readonly string[] }): Promise<number>;
function clasesConReservasVencidas(db, momento: Date): Promise<string[]>;
function clasesConReservasVencidasDelAlumno(db, alumnoId: string, momento: Date): Promise<string[]>;
function inscripcionVigenteDelPar(alumnoId: string, turnoId: string, db?): Promise<InscripcionResumen | null>;
function inscripcionMasRecienteDelPar(alumnoId: string, turnoId: string, db?): Promise<InscripcionResumen | null>;
function obtenerClasesBasicas(turnoIds: string[], db?): Promise<{ turno_id; fecha; hora_inicio; hora_fin; estado;
  materia: { id; nombre }; profesor: { id; nombre_para_mostrar } | null; inicio: Date }[]>;
// y, sin cambios desde la parte 1: esVigenteEn, sqlVigenteEn, sqlInstante, inscripcionesVigentes, ocupacion, calcularVencimiento

// I — caja (src/server/pagos/caja.service.ts; cajaAbiertaDe también en caja.publico.ts)
function cajaAbiertaDe(db, usuarioId: string): Promise<{ id: string; abiertaEl: Date } | null>;
function abrirCaja(tx, datos: { usuarioId: string; fondoInicial: string }): Promise<{ id: string; abiertaEl: Date; fondoInicial: string }>;

// I — cobro (src/server/pagos/operacion.service.ts)
type ItemOperacion = ({ inscripcionId: string } | { crearInscripcion: { turnoId: string } }) & { monto: string; motivoAjuste?: string | null };
function registrarOperacion(tx, datos: { alumnoId; items: ItemOperacion[]; formaPagoId; fechaPago?: Date; usuarioId;
  modo: "completo" | "compatSprint2" }): Promise<{
    operacion: { id; alumnoId; formaPagoId; fechaPago; registradaEl; cajaId };
    pagos: { id; turnoId; inscripcionId; precio; monto: string; motivoAjuste: string | null }[];
    comprobante: { id; numero: number; numeroVisible: string; datos: ComprobanteDatos } }>;

// I — comprobante (src/server/pagos/comprobante.service.ts y comprobante.schema.ts)
function emitirComprobante(tx, operacionId: string): Promise<{ id; numero; numeroVisible; datos }>;
function emitirReemplazo(tx, comprobanteId: string): Promise<{ id; numero; numeroVisible; datos }>;
function comprobanteVigenteDe(tx, operacionId: string): Promise<{ id; numero } | null>;
const ComprobanteDatosSchema;                       // contrato único de Comprobante.datos (R3-PR0-I7)
function formatearNumeroComprobante(numero: number): string;   // "0001-00000123"

// I — valor vigente (src/server/pagos/pago.vigente.ts)
function operacionVigente(db, operacionId: string): Promise<OperacionVigente | null>;
function contarPagosNoAnulados(db, inscripcionId: string): Promise<number>;

// F — src/server/personal/personal.publico.ts
function obtenerNombresPersonal(usuarioIds: string[], db?): Promise<{ usuario_id: string; nombre_completo: string }[]>;
function bloquearIntegranteActivo(tx, usuarioId: string): Promise<{ fichaId: string }>;   // INTEGRANTE_INACTIVO
```

**Decisiones y desvíos de las specs** (para avisar a cada dueño):

1. **Archivos de 2.0 sin tocar; consolidar en la etapa 3:**
   - `registrarPago` (`pago.service.ts`) pasa a envolver `registrarOperacion` en modo `compatSprint2`, con la inscripción vigente del par y un solo ítem. La spec I ubica el punto de entrada de HU-I-10 en `pago.service.ts`, pero el servicio de dominio queda en `operacion.service.ts`.
   - `listarPagosDeTurno` y `sumarPagosPorMes` (`pago.publico.ts`) pasan a leer con `pago.vigente.ts`. `cajaAbiertaDe` puede reexportarse además desde `pago.publico.ts`.
   - El núcleo `inscribirAlumnoEnTurno`, `asignarParticipantesTurno` y `quitarAlumnoTurno` (`turno.service.ts`) pasan a `crearInscripcion` y `finalizarInscripcion`.
   - Las lecturas de parámetros de `turno.generacion.service.ts` y `turno.validaciones.ts` pasan a `parametrosVigentes()` (2.6).
2. **Alumno inactivo o inexistente (R6-PR0-10).** Hoy la inscripción desde mesa de entrada (HU-C-04 §2.5) responde `409 ALUMNO_NO_DISPONIBLE` «El alumno no existe o no está activo» con `{ alumno_id }`, no `ALUMNO_NO_ENCONTRADO`/`ALUMNO_INACTIVO`. Gana lo existente (1.1), así que `crearInscripcion` con origen `CENTRO` conserva ese código y ese texto (clave nueva `errores.inscripcion.alumnoNoDisponibleOInactivo`). Con origen `ALUMNO` y `PAGO` responde `409 ALUMNO_INACTIVO` «La ficha del alumno está inactiva» (el texto de hoy del autoservicio) y `404 ALUMNO_NO_ENCONTRADO` «El alumno ya no existe». En todos los casos decide la fila del alumno ya bloqueada, aunque el llamador pase `alumnoActivo: true` (R3-PR0-B3). Avisar a los dueños de C, B e I.
3. **Orden de validación de `crearInscripcion`:** clase inexistente, cancelada, pendiente, sin aula y vencida, después cupo, alumno, repetido y superposición (el orden de hoy de HU-C-04 §2.5, así los Route Handlers conservan sus respuestas), y al final tarifa y re-reserva (spec C §2.17.2).
   - La superposición se evalúa contra `reservas_turno`, con la misma condición que el EXCLUDE, después de marcar las reservas vencidas del alumno. Así no depende de `alumnoConTurnoSuperpuesto` de `turno.service.ts`, que es de 2.0.
   - Si igual salta el EXCLUDE, se informa `ALUMNO_NO_DISPONIBLE`.
   - «Vencida» compara el inicio exacto de la clase con `ahora()`, que da el mismo resultado que la comparación por minuto de hoy.
4. **Regla de re-reserva:** solo la aplica `crearInscripcion` con origen `ALUMNO` y `conReserva: true`. `CENTRO` no la aplica (2.13) y `PAGO` ya la verificó quien cobra. `exigeInscripcionConPago` cuenta también una reserva vigente según la columna pero vencida sin marcar.
5. **Firmas que difieren de 2.13:**
   - `marcarPagada` y `recalcularEstadoPago` reciben además `actor`, para el historial de la transición.
   - `exigeInscripcionConPago` recibe `db` primero, como las demás lecturas que se usan dentro de un `tx`.
   - `marcarVencidas` y `recalcularVencimientos` admiten `opciones.momento`, para usar el momento único de la operación.
   - `crearInscripcion` suma `bloqueosTomados` y `momento` (los usa `registrarOperacion`; 2.16 ya lo preveía).
6. **`finalizarInscripcion`:**
   - `fecha` es la `finalizadaEl` que se registra (por defecto `ahora()`).
   - Con `soloSiReservaPendiente`, la condición es `estadoPago = RESERVADA AND venceEl > ahora()` tal como la escribe 2.13, también si la clase está cancelada.
7. **`inscripcionVigenteDelPar`:** devuelve la fila con `vigencia = VIGENTE` aunque sea una reserva vencida sin marcar. Quien opera marca primero con `marcarVencidas`, y para decidir si cuenta se usa `esVigenteEn`.
8. **Vencimiento perezoso:** `marcarVencidas` y `marcarVencidasDelAlumno` escriben en una sola sentencia (`UPDATE … FROM turnos … RETURNING`) la vigencia, `finalizadaEl = venceEl` y el actor «Proceso automático», como piden los CHECK. Recalculan `Turno.estado` solo en las clases donde marcaron algo y encolan una transición de historial por reserva.
9. **`registrarOperacion`:**
   - Bloquea en una sola llamada: alumno → clases de los ítems y clases con reservas vencidas del alumno → inscripciones existentes → caja.
   - La inscripción creada con «Se inscribe al confirmar el pago» nace `PAGADA` y no se vuelve a pasar por `marcarPagada`: bloquearla después de la caja rompería el orden canónico.
   - En `compatSprint2`, una reserva vencida se informa `ALUMNO_NO_INSCRIPTO` (el código de Sprint 2), no `RESERVA_VENCIDA`.
   - La caja se valida al final. Si la caja que se leyó antes de bloquear apareció cerrada al bloquearla, el texto es el del criterio 9 de HU-I-12 («Tu caja se cerró…»).
   - `motivoAjuste` se guarda solo si el monto difiere del precio. `ajustadoPorUsuarioId` se guarda siempre que difiere, también en compatibilidad sin motivo.
   - Los errores de un ítem llevan en `detalles` `{ turno_id, materia, fecha, fecha_dia }`: `fecha` es AAAA-MM-DD (lo que pide la spec) y `fecha_dia` es DD/MM/AAAA, para el texto de `TURNO_YA_EMPEZO`. También se agregan a los errores que vienen de `crearInscripcion`, como cupo o tarifa.
10. **Textos:** `TURNO_YA_EMPEZO` y `RESERVA_VENCIDA` dejan de ser propuestos: ahora son los literales de la spec I §2.7.4. Claves nuevas: `errores.turno.sinAula` (`TURNO_SIN_AULA`, texto de hoy) y `errores.inscripcion.alumnoNoDisponibleOInactivo`.
11. **Comprobante:**
   - `datos` se valida con `ComprobanteDatosSchema` al emitir.
   - `registrado_por.nombre_completo` admite `null` si la cuenta que registró no tiene ficha del personal: el ejemplo de la spec trae siempre un texto.
   - El número sale de `nextval('comprobante_numero_seq')` convertido a número dentro de la transacción del cobro.
   - `emitirReemplazo` lanza `ComprobanteError` si el comprobante ya fue reemplazado o si la operación no tiene pagos vigentes (en la anulación total no se emite nada: decide `anularPago`, parte 3).
12. **Caja:**
   - `abrirCaja` exige la ficha de mesa de entrada activa con `bloquearIntegranteActivo` (`INTEGRANTE_INACTIVO`) y valida `fondoInicial` (≥ 0, hasta 2 decimales).
   - La unicidad la garantiza el índice parcial: la apertura concurrente perdedora recibe `CAJA_YA_ABIERTA`.
   - Las cuentas `mesa.entrada@` y `mesa.entrada2@` del seed tienen ficha.
13. **Fachada mínima de F (`personal.publico.ts`):** la necesitan la caja (integrante activo, spec I §2.10.1) y el comprobante (nombre de quien registró, spec I §2.9.2). HU-F y HU-G la amplían sin cambiar estas dos firmas. Avisar al dueño de F.
14. **`obtenerClasesBasicas` (C, P-I9):** devuelve además `inicio` (instante de inicio de la clase), que necesita el cobro.
15. **Errores de programación** (`RangeError`, `ComprobanteError`, `Error` de `marcarPagada` con 0 pagos y de `precioClase` no entero): no son `ErrorDeDominio` porque no pueden venir de un pedido válido. Salen como 500.
16. **Anulación en las pruebas:** `anularPago` es de la parte 3. Las pruebas de equivalencia anulan con un registro de `AnulacionPago` y `recalcularEstadoPago`, que es lo que hará ese servicio.

**Pruebas con PostgreSQL real que pidió esta parte:**
- **(a)** una inscripción y un cobro con inscripción del mismo alumno en clases superpuestas, en paralelo y repetido 4 veces: uno confirma, el otro recibe `ALUMNO_NO_DISPONIBLE`, sin interbloqueo ni `TRANSACCION_OCUPADA`.
- **(b)** seis inscripciones simultáneas a la última plaza: entra una, las demás reciben `CUPO_INSUFICIENTE` y la clase queda `COMPLETO`.
- **(c)** «Pagada ⇔ al menos un pago no anulado», verificada sobre todas las inscripciones vigentes de la base después de cada transición:
  - pagar;
  - anular el último pago antes de la clase (reserva reabierta);
  - anular uno de varios pagos;
  - reintegro por clase cancelada;
  - clase ya iniciada;
  - reintegro a quien canceló.
- **(d)** ocho cobros simultáneos de cuatro integrantes: números de comprobante únicos y correlativos, y cada comprobante válido para el contrato.

Además se prueban:
- apertura de caja con ficha inactiva o sin ficha, y apertura concurrente;
- los dos modos de cobro, con todos sus rechazos y con varias clases en una operación;
- «Se inscribe al confirmar el pago»;
- vencimiento perezoso, re-reserva, finalización y `soloSiReservaPendiente`;
- `recalcularVencimientos` y la reapertura por anulación;
- que una inscripción finalizada libera la franja y permite volver a inscribir sin violar `reservas_turno` (R6-PR0-8).

**Resultado:**
- `npm test`: 141 archivos (123 pasan, 18 saltados), 1829 pruebas (1703 pasan, 126 saltadas), 0 fallas.
- `npm run test:pg -- src/server/shared src/server/turnos/inscripcion.vigencia.pg.test.ts src/server/turnos/inscripcion.service.pg.test.ts src/server/pagos/operacion.service.pg.test.ts`: 4 archivos y 44 pruebas, todas pasan. La base descartable se borró.
- `npm run lint`: 0 errores; queda el aviso que ya existía.
- `npx tsc --noEmit`: los mismos 15 errores de 5.1.

**Dudas abiertas de esta parte:**
1. **Decisión 2:** que `CENTRO` conserve `ALUMNO_NO_DISPONIBLE` en lugar de los códigos de R6-PR0-10. Confirmar con los dueños de C y B.
2. **`detalles.fecha_dia`** en los errores por ítem del cobro. Confirmar con el dueño de I, o mover el formato del texto a la interfaz.
3. **`registrado_por.nombre_completo` nulo** cuando la cuenta no tiene ficha. Confirmar con el dueño de I.
4. **Parámetro `actor`** en `marcarPagada` y `recalcularEstadoPago`. Avisar a los dueños de C e I.
5. **`soloSiReservaPendiente` en una clase cancelada** (las reservas no vencen, pero la condición literal compara `venceEl`). Confirmar con el dueño de C.

**Respuestas del responsable del PR 0 a las dudas de esta parte:**
1. `crearInscripcion` con origen `CENTRO` conserva `ALUMNO_NO_DISPONIBLE` (1.1). Se avisa a los dueños de C, B e I.
2. `detalles.fecha_dia` se queda. Se avisa al dueño de I.
3. `registrado_por.nombre_completo` nulo se queda: si falta, HU-I-11 muestra el correo de la cuenta. Se avisa al dueño de I.
4. El parámetro `actor` de `marcarPagada` y `recalcularEstadoPago` se queda. Se avisa a los dueños de C e I.
5. `soloSiReservaPendiente` queda literal, como en 2.13. Lo confirma el dueño de C.

### 5.4 Etapa 2, parte 3 — caja completa, corrección y anulación, cuentas, historial de estados y lecturas públicas

**Archivos nuevos**

| Módulo | Archivo | Contenido |
|---|---|---|
| I | `src/server/pagos/caja.service.ts` (ampliado) | `registrarMovimiento`, `anularMovimiento`, `registrarAjuste`, `declararEfectivo`, `calcularResumen`, `cerrarCaja` |
| I | `src/server/pagos/correccion.service.ts` | `puedeCorregirPago`, `corregirPago`, `corregirOperacion`, `anularPago` |
| I | `src/server/pagos/pago.lecturas.publico.ts` | Lecturas con el valor vigente (R3-PR0-I11) y `usuarioRegistroOperaciones` |
| I | `src/server/pagos/pago.vigente.ts` (reescrito) | Valor vigente de una operación en TypeScript y los mismos cálculos como fragmentos SQL |
| I | `scripts/caja-abrir.ts` y el script `caja:abrir` de `package.json` | `npm run caja:abrir -- <email> [fondo inicial]` (2.15) |
| A | `src/server/usuarios/cuenta.service.ts` y `cuenta.schema.ts` | Cuentas de acceso (HU-A-06, 2.7) |
| A | `src/server/email/email.service.ts` | `enviarEmail`, con simulador |
| N | `src/server/shared/historial-estados.ts` | `registrarCambioEstado`, `listarHistorialEstados` |
| N | `src/server/shared/fechas-centro.ts` (función nueva) | `isoCentro` (instante con `-03:00`) |
| C | `src/server/turnos/inscripcion.lecturas.ts` (reexportado por `inscripcion.publico.ts`) | Inscripciones del alumno, conteos y reservas |
| C | `src/server/turnos/clases.publico.ts` | `contarClasesPorMes`, `gerentePuedeGestionarClaseDeBaja` |
| D | `src/server/profesores/profesor.publico.ts` (función nueva) | `obtenerProfesoresBasicos` |
| E | `src/server/historial/valor-vigente.ts` | Fragmentos SQL: asistencia, «con control» y clase dictada vigentes |
| E | `src/server/historial/asistencia.publico.ts` | Lecturas de asistencia y `profesorPuedeRegistrarIndicacion` |
| E | `src/server/historial/alcance-profesor.ts` | `profesorPuedeVerHistorial` |

Pruebas nuevas:
- unitarias: `src/server/pagos/correccion.alcance.test.ts` (`puedeCorregirPago`, simulador y envío de email, `obtenerProfesoresBasicos`);
- con PostgreSQL real: `src/server/pagos/caja.service.pg.test.ts`, `src/server/pagos/correccion.service.pg.test.ts`, `src/server/usuarios/cuenta.service.pg.test.ts`, `src/server/turnos/inscripcion.lecturas.pg.test.ts` y `src/server/historial/asistencia.pg.test.ts`;
- `src/server/publico.aislamiento.test.ts` suma, sin quitar nada, las tres fachadas nuevas y `inscripcion.lecturas` en la lista de `inscripcion.publico.ts`;
- `src/server/testing/fabricas.ts` suma `crearClaseDictadaDePrueba` y `corregirAsistenciaDePrueba`.

**Firmas reales** (contrato para las HU):

```typescript
// I — caja (src/server/pagos/caja.service.ts)
type FormaEnResumen = { id: string; nombre: string; es_efectivo: boolean };
type ResumenCaja = { fondo_inicial: string; cobros_por_forma: { forma_pago: FormaEnResumen; cantidad: number; total: string }[];
  ingresos_manuales: string; egresos_manuales: string; ajustes: { forma_pago: FormaEnResumen; total: string }[];
  efectivo_esperado: string; efectivo_declarado: string | null; diferencia: string | null;
  tipo_diferencia: "SOBRANTE" | "FALTANTE" | "CUADRA" | null };
function calcularResumen(db, cajaId: string): Promise<{ resumen: ResumenCaja; huella: string }>;
function registrarMovimiento(tx, datos: { cajaId; usuarioId; tipo: TipoMovimientoCaja; monto: string; concepto: string }):
  Promise<{ id; tipo; monto: string; concepto; momento: Date }>;     // EGRESO_SUPERA_EFECTIVO, CAJA_NO_ABIERTA, FUERA_DE_ALCANCE
function anularMovimiento(tx, datos: { movimientoId; usuarioId; motivo }): Promise<{ id: string }>;
  // MOVIMIENTO_NO_ENCONTRADO, MOVIMIENTO_YA_ANULADO, ANULACION_DEJA_EFECTIVO_NEGATIVO
type OrigenAjuste = { correccionPagoId: string } | { correccionOperacionId: string } | { anulacionPagoId: string };
function registrarAjuste(tx, datos: { cajaId; pagoId; origen: OrigenAjuste;
  ajustes: { formaPagoId: string; monto: Prisma.Decimal | string }[]; usuarioId }): Promise<{ ids: string[] }>;
  // CAJA_DE_AJUSTE_NO_ABIERTA
function declararEfectivo(tx, datos: { cajaId; usuarioId; efectivoDeclarado: string; porAusencia?: boolean }):
  Promise<{ resumen: ResumenCaja; huella: string }>;                 // EFECTIVO_YA_DECLARADO
type CajaCerrada = { caja_id; estado: "CERRADA"; cerrada_el: Date; diferencia: string;
  tipo_diferencia: "SOBRANTE" | "FALTANTE" | "CUADRA"; por_ausencia: boolean };
function cerrarCaja(tx, datos: { cajaId; usuarioId; huella: string; motivo?: string | null; porAusencia?: boolean }): Promise<CajaCerrada>;
  // CAJA_YA_CERRADA, EFECTIVO_NO_DECLARADO, CAJA_CAMBIO (detalles: { resumen, huella }), MOTIVO_DIFERENCIA_REQUERIDO

// I — corrección y anulación (src/server/pagos/correccion.service.ts)
type UsuarioOperador = { id: string; rol: RolUsuario };
function puedeCorregirPago(usuario: UsuarioOperador, pago: { anulado: boolean; registradoEn: Date; cajaAbierta: boolean },
  momento?: Date): boolean;
function corregirPago(tx, datos: { pagoId; monto: string; motivo; usuario: UsuarioOperador; cajaAjusteId?: string | null }):
  Promise<{ correccionId; montoAnterior: string; montoNuevo: string; comprobante: ComprobanteEmitido; ajustes: string[] }>;
function corregirOperacion(tx, datos: { pagoId; formaPagoId?: string; fechaPago?: Date; motivo; usuario: UsuarioOperador;
  cajaAjusteId?: string | null }): Promise<{ correcciones: string[]; clasesAbarcadas: number; comprobante: ComprobanteEmitido; ajustes: string[] }>;
function anularPago(tx, datos: { pagoId; motivo; usuario: UsuarioOperador; cajaAjusteId?: string | null }):
  Promise<{ anulacionId; inscripcion: CambioEstadoPago; comprobante: ComprobanteEmitido | null; ajustes: string[] }>;
  // PAGO_NO_ENCONTRADO, FUERA_DE_ALCANCE, PAGO_ANULADO / PAGO_YA_ANULADO, SIN_CAMBIOS, FECHA_FUTURA, CAJA_DE_AJUSTE_NO_ABIERTA

// I — lecturas (src/server/pagos/pago.lecturas.publico.ts)
function listarPagosDeAlumno(alumnoId: string, filtros?: { desde?: string; hasta?: string; formaPagoId?: string; turnoIds?: string[] },
  db?): Promise<PagoDeAlumno[]>;
//   PagoDeAlumno = { pago_id; turno_id; inscripcion_id; operacion_id; monto; monto_original: string | null; precio: number;
//     motivo_ajuste; ajustado_por; forma_pago: { id; nombre; is_active }; fecha_pago; registrado_en; anulado;
//     anulacion: { fecha; motivo } | null; comprobante_vigente: { id; numero } | null; ... }
function listarPagosDeClase(turnoId: string, db?): Promise<PagoDeClase[]>;       // también los anulados, marcados
function listarPagosDeTurnoVigente(turnoId: string, db?): Promise<{ id; alumno: { id; nombre_completo }; monto: string;
  forma_pago: { id; nombre }; fecha_pago: string; registrado_en: string }[]>;     // forma de listarPagosDeTurno de hoy
function sumarPagosPorMesVigente(desde: string, hasta: string, db?): Promise<{ mes: string; total: string }[]>;
function usuarioRegistroOperaciones(tx, usuarioId: string): Promise<boolean>;

// I — valor vigente (src/server/pagos/pago.vigente.ts)
function vigenteDeOperacion(operacion: OperacionConVigente): OperacionVigente;    // con INCLUDE_OPERACION_VIGENTE
function sqlMontoVigente(alias: string): Prisma.Sql;     // y sqlFechaPagoVigente, sqlFormaPagoVigente, sqlPagoNoAnulado

// A — src/server/usuarios/cuenta.service.ts
function verificarEmailNoAsociadoAOtraCuenta(email: string, opciones?: { excluirUsuarioId?: string | null }, db?): Promise<void>;
function crearCuentaParaFicha(tx, datos: { email; dni; rol: RolUsuario; ip?: string | null }): Promise<{ usuario_id: string }>;
function cambiarEmailCuenta(tx, datos: { usuarioId; email }): Promise<{ cambio: boolean }>;
function revocarSesiones(tx, usuarioId: string): Promise<void>;
function desactivarCuenta(tx, usuarioId: string): Promise<{ cambio: boolean }>;
function reactivarCuenta(tx, usuarioId: string): Promise<{ cambio: boolean }>;
function cambiarPassword(tx, datos: { usuarioId; nueva: string; conservarSesionActual: boolean;
  origen?: "CAMBIO" | "RECUPERACION"; ip?: string | null }): Promise<{ reemitir_sesion: boolean }>;
function obtenerEstadoCuenta(usuarioId: string, db?): Promise<{ email; rol; activa: boolean; debe_cambiar_password: boolean } | null>;
function obtenerResumenCuenta(usuarioId: string | null, db?):
  Promise<{ estado: "ACTIVA" | "INACTIVA" | "SIN_CUENTA"; email: string | null; rol: RolUsuario | null; debe_cambiar_password: boolean }>;
function filtrarCuentasActivas(tx, usuarioIds: string[]): Promise<string[]>;

// A — src/server/email/email.service.ts
function enviarEmail(email: { para: string; asunto: string; texto: string; html?: string }): Promise<{ simulado: boolean }>;
const emailsSimulados: Email[];      // lo que «envió» el simulador (pruebas)
class EnvioEmailError extends Error;

// N — src/server/shared/historial-estados.ts
function registrarCambioEstado(tx, cambio: { entidad: EntidadHistorialEstado; id: string; accion: AccionHistorialEstado;
  motivo?: string | null; actor: ActorDominio }): { id: string };              // síncrona: encola para el commit
function listarHistorialEstados(entidad: EntidadHistorialEstado, id: string, db?):
  Promise<{ id; accion; motivo: string | null; fecha: Date; actor_tipo: ActorTipo; usuario_id: string | null }[]>;

// C — src/server/turnos/inscripcion.publico.ts (implementadas en inscripcion.lecturas.ts)
function listarInscripcionesDeAlumno(alumnoId: string, filtros?: { desde?: string; hasta?: string }, db?): Promise<InscripcionDeAlumno[]>;
//   InscripcionDeAlumno = { inscripcion_id; turno_id; fecha; hora_inicio; hora_fin; estado_clase; materia: { id; nombre };
//     profesor: string | null; aula: string | null; vigencia; vigente_ahora: boolean; estado_pago; precio;
//     finalizada_el; cancelada_el: Date | null; ... }
function existeInscripcionVigenteConProfesor(alumnoId: string, profesorId: string, materiaId: string, db?): Promise<boolean>;
function contarInscripcionesPorMes(rango: { desde: string; hasta: string },
  opciones: { vigencias: ("VIGENTE" | "CANCELADA_ALUMNO" | "RESERVA_VENCIDA" | "BAJA_ALUMNO")[]; porMateria?: boolean }, db?):
  Promise<{ mes: string; vigencia; materia_id?: string; cantidad: number }[]>;
function listarReservasPendientes(filtros?: { alumno?: string; materiaId?: string; vencen?: "en_3_horas" | "hoy" | "manana";
  pagina?: number }, db?): Promise<{ items: ReservaPendiente[]; paginacion: Paginacion }>;
function listarReservasVencidas(filtros?: { dias?: number; alumno?: string; materiaId?: string; pagina?: number }, db?):
  Promise<{ items: ReservaVencida[]; paginacion: Paginacion }>;                // ReservaVencida.sin_marcar
function resumenReservas(db?): Promise<{ pendientes: { cantidad: number; importe_total: number }; vencen_en_3_horas: number;
  vencen_hoy: number; vencieron_hoy: number }>;

// C — src/server/turnos/clases.publico.ts
function contarClasesPorMes(rango: { desde: string; hasta: string },
  opciones: { estados: ("DISPONIBLE" | "COMPLETO" | "CANCELADO")[]; por?: "materia" | "profesor" }, db?):
  Promise<{ mes: string; estado; materia_id?: string; profesor_id?: string; cantidad: number; minutos: number }[]>;
function gerentePuedeGestionarClaseDeBaja(turnoId: string, profesorId: string, db?): Promise<boolean>;

// D — src/server/profesores/profesor.publico.ts
function obtenerProfesoresBasicos(ids: string[], db?):
  Promise<{ id: string; nombre: string; apellido: string; nombreParaMostrar: string; activo: boolean }[]>;

// E — src/server/historial/asistencia.publico.ts y alcance-profesor.ts
function asistenciaDeAlumno(alumnoId: string, materiaId?: string, db?):
  Promise<{ materia_id; presentes; ausentes; sin_control; porcentaje: number | null }[]>;
function contarAsistenciasPorMes(rango, opciones?: { porMateria?: boolean }, db?):
  Promise<{ mes; materia_id?: string; presentes; ausentes; sin_control }[]>;
function contarClasesDictadasSinControl(rango, db?): Promise<number>;
function listarAlumnosConPresentismoBajo(rango, opciones: { umbral; minimoClases; limite; desplazamiento }, db?):
  Promise<{ total: number; items: { alumno_id; materia_id; clases; presentes; ausentes }[] }>;
function profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db?): Promise<boolean>;
function profesorPuedeVerHistorial(profesorId, alumnoId, materiaId, db?): Promise<boolean>;
```

**Decisiones y desvíos de las specs** (para avisar a cada dueño):

1. **Archivos de 2.0 sin tocar; consolidar en la etapa 3:**
   - `pago.publico.ts`: `listarPagosDeTurno` y `sumarPagosPorMes` pasan a ser `listarPagosDeTurnoVigente` y `sumarPagosPorMesVigente`. `listarPagosDeAlumno`, `listarPagosDeClase` y `usuarioRegistroOperaciones` se mueven a `pago.publico.ts` y `pago.lecturas.publico.ts` desaparece.
   - `turno.publico.ts`: recibe `contarClasesPorMes` y `gerentePuedeGestionarClaseDeBaja` desde `clases.publico.ts`.
   - `historial.publico.ts`: recibe las lecturas de `asistencia.publico.ts` y los dos helpers de alcance de `alcance-profesor.ts`. `valor-vigente.ts` queda como helper interno de E.
   - `profesor.service.ts`: su `verificarEmailNoAsociadoAOtraCuenta` privada, con el texto «El email pertenece a otra cuenta», pasa a usar la de A. El texto de la respuesta de hoy se conserva hasta que el dueño de D decida (ver dudas).
   - `actualizarEmailCuenta`, que la spec A da como existente, no está en el código. `cambiarEmailCuenta` la reemplaza.
2. **Caja:**
   - La huella es un SHA-256 del efectivo esperado y de la cantidad y el id máximo de cobros, correcciones, anulaciones de pago, movimientos, anulaciones de movimiento y ajustes. Cambia con cualquier cobro, también si no es en efectivo, aunque el esperado quede igual.
   - `cerrarCaja` bloquea la caja, relee el resumen y compara la huella. Si cambió, `CAJA_CAMBIO` lleva en `detalles` el resumen y la huella nuevos, para que la pantalla los muestre sin otra lectura.
   - Solo suma al esperado la forma con `esEfectivo`. Las demás se informan en `cobros_por_forma`.
   - Por ausencia: solo el Gerente, y solo sobre la caja de otro. Sin «por ausencia», solo la caja propia (`FUERA_DE_ALCANCE`).
   - Un movimiento de otra caja responde `MOVIMIENTO_NO_ENCONTRADO`, no `FUERA_DE_ALCANCE`, para no confirmar que existe.
3. **`registrarAjuste` en un cambio de forma:** registra un par por el total vigente de la operación: menos en la forma anterior y más en la nueva, en la caja de ajuste.
4. **Corrección y anulación:**
   - `corregirOperacion` recibe `pagoId` en lugar de `operacionId`: la pantalla de HU-I-06 parte de un pago y el alcance se evalúa sobre ese pago. Corrige toda la operación (`clasesAbarcadas`).
   - Enviar la forma o la fecha vigentes no cuenta como cambio. Una forma que ya tenía y hoy está inactiva se conserva.
   - `anularPago` no emite comprobante si la operación se queda sin pagos vigentes: el comprobante vigente queda «ANULADO» como marca derivada.
   - `puedeCorregirPago` es la regla de las pantallas; el servicio la vuelve a evaluar con todo bloqueado.
   - Cada servicio toma sus bloqueos en una sola llamada (clase → inscripción → operación → cajas, incluida la de ajuste). HU-I-06 puede encadenar `corregirPago` y `corregirOperacion` en la misma transacción.
5. **Lecturas de I:** `comprobante_vigente` de un pago anulado es el último comprobante de la operación cuyo `datos.clases` incluye ese pago. `listarPagosDeAlumno` trae también los anulados, marcados.
6. **Cuentas (A):**
   - `crearCuentaParaFicha` guarda solo el hash del DNI, marca `debeCambiarPassword` y registra `CUENTA_CREADA` en la misma transacción. Sin `ip`, se guarda «desconocida».
   - El email se compara sin distinguir mayúsculas. Si dos altas simultáneas chocan contra el índice único (P2002), la segunda recibe `EMAIL_YA_ASOCIADO`.
   - `cambiarEmailCuenta` no revoca sesiones.
   - `desactivarCuenta` revoca sesiones solo si cambia el estado. Si ya estaba inactiva, no hace nada (`cambio: false`).
   - `revocarSesiones` trunca a segundos (el `iat` del JWT) y nunca retrocede (`GREATEST`).
   - `cambiarPassword` devuelve `reemitir_sesion` según `conservarSesionActual`: la sesión la reemite quien llama (la acción de A), porque los servicios no importan `@/auth`.
7. **Email:** `enviarEmail` usa la API HTTP de Resend con `fetch` y un tiempo límite de 10 segundos: no se agrega la librería. El simulador corre siempre en `NODE_ENV=test` y, fuera de producción, cuando falta `RESEND_API_KEY`. Guarda en `emailsSimulados` y lo escribe en consola fuera de las pruebas. Sin simulador, si faltan `RESEND_API_KEY` o `EMAIL_FROM`, o si Resend no responde bien, falla con `EnvioEmailError`.
8. **Historial de estados:**
   - `registrarCambioEstado` es síncrona: encola la fila para `despuesDelCommit`, así una transacción que revierte no deja registro.
   - Un `motivo` en blanco se guarda `null`.
   - El orden es fecha descendente, con desempate por id.
   - Devuelve `usuario_id`, no el nombre: el nombre lo resuelve quien muestra (DEC-37).
9. **Lecturas de C:**
   - `vigente_ahora`, los conteos y las reservas clasifican con `esVigenteEn` y `sqlVigenteEn`. Una reserva vencida sin marcar cuenta como `RESERVA_VENCIDA`.
   - `contarInscripcionesPorMes` y `contarClasesPorMes` no cuentan las clases canceladas, `PENDIENTE` ni `QUITADA_CENTRO`. Pedir `PENDIENTE` es un error de programación.
   - `listarInscripcionesDeAlumno` no filtra por resultado (lo calcula E) y suma `estado_pago` y `precio`.
   - `cancelada_el` sale del evento `turno:cancelado` de `eventos_turno`, porque la clase no guarda el momento de la cancelación.
   - `existeInscripcionVigenteConProfesor` solo cuenta clases `DISPONIBLE` o `COMPLETO`: una inscripción vigente en una clase cancelada no da alcance.
   - Las lecturas de C leen alumno, materia, aula y profesor por relación, como pide el contrato de 2.13. El filtro por alumno usa `construirFiltroBusquedaAlumno` de `alumno.busqueda.ts`, que no es la fachada de B: en la etapa 3 B lo publica en `alumno.publico.ts`.
10. **Lecturas de E:**
   - Siempre con el valor vigente: la última corrección de asistencia y de «con control», y solo clases dictadas no anuladas.
   - `porcentaje` es `null` si no hay clases con control.
   - `profesorPuedeRegistrarIndicacion` exige una clase dictada no anulada del profesor en la materia donde figure el alumno, presente o ausente.
   - `profesorPuedeVerHistorial` suma la inscripción vigente con el profesor en la materia.
11. **Script `caja:abrir`:**
    - Llama a `abrirCaja` con sus mismas reglas. Responde con un mensaje y código de salida 1 si falta el email, si la cuenta no existe o si el servicio rechaza (`INTEGRANTE_INACTIVO`, `CAJA_YA_ABIERTA`).
    - Se probó contra una base descartable con el seed: abrir, rechazar la segunda apertura, cerrar con los servicios y volver a abrir con fondo inicial. La base se borró.
    - El seed base todavía no abre cajas: las cajas abiertas de prueba son del seed de escenarios (2.16).
12. **Textos nuevos:**
    - D: `PROFESOR_INACTIVO`, `PROFESOR_NO_ENCONTRADO`, `PROFESOR_NO_DICTA_MATERIA` y `CONFLICTO_EDICION_CONCURRENTE`.
    - A: `EMAIL_YA_ASOCIADO`, y `VALIDATION_ERROR` de cuentas, propuesto.
    - E: los códigos de Sprint 2 de clase dictada, examen e historial, con los literales de hoy.
    - Forma de pago: `NOMBRE_DUPLICADO`.
    - La prueba de claves sigue en verde.
13. **Las pruebas de conteo por mes** usan meses lejanos (en el futuro para C, en el pasado para E), porque la base descartable es compartida por todos los archivos de la corrida.

**Pruebas con PostgreSQL real que pidió esta parte:**
- **(a)** `cerrarCaja` después de un cobro que cambió la huella: `CAJA_CAMBIO` con el resumen nuevo, la caja sigue abierta y cierra con la huella nueva.
- **(b)** dos cierres simultáneos de la misma caja (el integrante y el Gerente por ausencia): gana uno y el otro recibe `CAJA_YA_CERRADA`. También un cobro y un cierre simultáneos: no confirman los dos. La apertura concurrente ya estaba en la parte 2.
- **(c)** corrección y anulación:
  - «Pagada ⇔ al menos un pago no anulado» verificada sobre toda la base después de cada paso;
  - numeración de comprobantes única y correlativa con reemplazos;
  - ajustes en caja cerrada con los montos y formas esperados;
  - el valor vigente calculado en SQL es igual al de TypeScript.
- **(d)** desactivar la cuenta revoca las sesiones; reactivarla no las restaura; `revocarSesiones` nunca retrocede.
- **(e)** `listarHistorialEstados` completo y ordenado; una transacción que revierte no deja registro; otra entidad con el mismo id no se mezcla.

Además se prueban:
- los movimientos y sus rechazos, y el resumen con formas que no son efectivo;
- la declaración única del efectivo y el motivo obligatorio si hay diferencia;
- altas simultáneas con el mismo email;
- cambio de contraseña y lecturas de cuenta;
- las lecturas de C y E y los helpers de alcance de 2.9.

**Resultado:**
- `npm test`: 147 archivos (124 pasan, 23 saltados), 1875 pruebas (1719 pasan, 156 saltadas), 0 fallas.
- `npm run test:pg -- src/server/shared src/server/turnos/inscripcion.vigencia.pg.test.ts src/server/turnos/inscripcion.service.pg.test.ts src/server/turnos/inscripcion.lecturas.pg.test.ts src/server/pagos/operacion.service.pg.test.ts src/server/pagos/caja.service.pg.test.ts src/server/pagos/correccion.service.pg.test.ts src/server/usuarios/cuenta.service.pg.test.ts src/server/historial/asistencia.pg.test.ts`: 9 archivos y 74 pruebas, todas pasan. La base descartable se borró.
- `npm run lint`: 0 errores; queda el aviso que ya existía.
- `npx tsc --noEmit`: los mismos 15 errores de 5.1.

**Dudas abiertas de esta parte:**
1. **Texto de `EMAIL_YA_ASOCIADO`:** hoy la ficha de profesor responde «El email pertenece a otra cuenta» y la spec A dice «Ese email ya está asociado a otra cuenta». El servicio nuevo usa el de la spec y el endpoint de hoy conserva el suyo (1.1). Confirmar con los dueños de A y D cuál queda en la etapa 3.
2. **`corregirOperacion` con `pagoId`** en lugar de `operacionId`. Confirmar con el dueño de I.
3. **`existeInscripcionVigenteConProfesor` sin clases canceladas.** Confirmar con los dueños de C y E.
4. **`cancelada_el` desde `eventos_turno`.** Si C prefiere una columna en la clase, es una migración nueva. Confirmar con el dueño de C.
5. **`desactivarCuenta` idempotente** (no revoca si ya estaba inactiva). Confirmar con el dueño de A.
6. **Envío de email con `fetch`** en lugar de la librería de Resend. Confirmar con el dueño de A.

### 5.5 Etapa 3 reducida — adaptación del código de los Sprints 1 y 2

Alcance: el de «Alcance reducido» al inicio del documento. No incluye sesión (2.7), rutas (2.9), seed de escenarios, historial académico de prueba, `RULES.md` ni CI.

**Finales de línea.** Con `core.autocrlf=true`, git deja en CRLF la copia de trabajo de los archivos que no se tocaron, aunque el índice esté en LF. Cada archivo de esta etapa se pasó a LF antes de editarlo. `src/server/profesores/profesor.publico.ts` tenía 198 CR en la copia de trabajo (el índice estaba en LF): se pasó a LF sin cambiar el contenido. La revisión de la parte 3 no los había visto porque el `grep $'\r'` de Git Bash ignora el CR al final de la línea; ahora se cuentan los bytes con `tr -cd '\r' | wc -c`.

**Usos de 2.0 adaptados** (archivo y línea del código actual):

1. **Inscripción** (`src/server/turnos/turno.service.ts`). El selector `turnoId_alumnoId`, el `count`, el `create`, el `createMany` y los `deleteMany` sobre `turnoAlumno` desaparecen:
   - `inscribirAlumnoEnTurno` (:415) llama a `crearInscripcion` con origen `CENTRO` (mesa de entrada) o `ALUMNO` (autoservicio) y `conReserva: false`, como pide 2.15. Mantiene su firma y su resultado. Su `tx` lo abren `agregarAlumnoTurno` (:433) y `solicitarTurnoPropio` (:448) con `transaccion()`, porque el historial se encola para después del commit. Ya no usa su propio `SELECT … FOR UPDATE` ni el conteo: bloquea, vence reservas, cuenta vigentes y revalida `crearInscripcion`, con los mismos códigos y textos.
   - `asignarParticipantesTurno` (:277–:356):
     - toma un solo `bloquear` en orden canónico: los alumnos, la clase y las clases con reservas vencidas de esos alumnos;
     - confirma la clase (`PENDIENTE` → `DISPONIBLE`, el trigger reserva profesor y aula);
     - pasa a `QUITADA_CENTRO` las vigentes que no siguen (`finalizarInscripcion`) e inscribe a los nuevos con `crearInscripcion` (`bloqueosTomados`), que lleva la clase a `COMPLETO` al llenar el cupo.
     - La respuesta y los eventos no cambian. Conserva los 15 s de tiempo máximo que tenía, con `transaccion(…, { tiempos: { timeoutMs: 15_000 } })`.
   - `quitarAlumnoTurno` (:539): bloquea la clase, mantiene las validaciones de hoy, marca las reservas vencidas y pasa la inscripción vigente del par a `QUITADA_CENTRO` con fecha y usuario. `alumnos_inscriptos` cuenta solo vigentes. Mismos códigos, respuesta y eventos.
2. **Lecturas por la relación `Turno.alumnos`** (solo inscripciones vigentes a `ahora()`):
   - filtro de Prisma nuevo `filtroVigenteEn(momento)`, equivalente a `esVigenteEn` y a `sqlVigenteEn`; la prueba de `inscripcion.vigencia.pg.test.ts` verifica las tres;
   - `turno.service.ts`: :43 (`incluirTurno`, el `include` del listado y del detalle, que también usa `turno.detalle.ts`), :89 (`listarTurnosPropios`), :253 (`listarOpcionesAlumnoTurno`) y :477 (`listarOpcionesInscripcion`);
   - `turno.publico.ts`: :100 (`bloquearTurnoParaOperacion`, que usan Pagos y Clase dictada), :122 (`obtenerAlumnosInscriptosDeTurno`) y :250 (`ajustarCuposPorCapacidadDeAula`);
   - `turno.disponibilidad.ts:91` (`alumnosConTurnoSuperpuesto`, que ahora recibe el momento: ver la decisión 3);
   - `turno.reprogramacion.service.ts`: :67 (inscriptos) y :99 (opciones);
   - `turno.aula.service.ts`: :29 y :59 (`_count`);
   - `turno.cancelacion.service.ts:41`;
   - `calendario.service.ts:105`.
3. **SQL crudo con `sqlVigenteEn`:** `turno.publico.ts:191` (inscriptos de `listarTurnosFuturosDeProfesorPorMateria`) y :353 (`promediarOcupacionTurnosPorMes`).
4. **Estado de la clase por la ocupación vigente** (`estadoSegunOcupacion`, igual que `ocupacion(db, turnoId, ahora())` pero sin otra consulta, porque cada lectura ya tiene los inscriptos vigentes y el cupo):
   - `turno.service.ts`: :129 (Mis turnos) y :588 (`presentar`: listado y detalle);
   - `turno.publico.ts`: :106 y :212;
   - `calendario.service.ts:133`.
   - «Solicitar clase» (`listarOpcionesInscripcion`) ofrece las clases `DISPONIBLE` o `COMPLETO` guardadas y decide con los inscriptos vigentes y el cupo. El rechazo de `CUPO_INSUFICIENTE` por estado guardado (`turno.service.ts:375` de 5.1) desaparece: lo decide `crearInscripcion` contando vigentes.
5. **Reprogramación y cancelación** (2.0):
   - `reprogramarTurno` (`turno.reprogramacion.service.ts:150`) corre con `transaccion()`. Llama a `marcarVencidas` (:157) antes de mover la clase y a `recalcularVencimientos` (:170) después.
   - `cancelarTurno` (`turno.cancelacion.service.ts:28`) corre con `transaccion()` y llama a `marcarVencidas` (:40) antes de cancelar, salvo en una clase `PENDIENTE`. El evento lista las inscripciones vigentes.
6. **Pagos** (`src/server/pagos/`):
   - `registrarPago` (`pago.service.ts:23`) envuelve `registrarOperacion` en modo `compatSprint2`, con la inscripción vigente del par y un solo ítem. Antes valida turno, estado e inscripción sin bloquear, con los códigos y el orden de Sprint 2; `registrarOperacion` revalida con todo bloqueado y sigue con forma, fecha y caja. La respuesta suma el campo extra `comprobante: { id, numero }`.
   - `obtenerOpcionesPago` recibe solo vigentes.
   - `POST /api/pagos` (`src/app/api/pagos/route.ts`) suma, después de su tabla de Sprint 2, la respuesta de cualquier `ErrorDeDominio` con su `code`, su texto y su HTTP: `409 CAJA_NO_ABIERTA` y `409 TRANSACCION_OCUPADA`. Los códigos de Sprint 2 conservan su texto de la tabla.
   - `listarPagosDeTurno` y `sumarPagosPorMes` (`pago.publico.ts`) conservan firma y forma y leen el valor vigente. Sus consumidores (`turno.detalle.ts`, `indicadores.service.ts`) no cambian.
7. **Clase dictada (1:N)**:
   - `clase-dictada.service.ts` :70, :80 y :101, e `historial.publico.ts:14` (`obtenerClaseDictadaDeTurno`): `findFirst` con `anuladaEl: null`.
   - `registrarClaseDictada` toma los alumnos de `bloquearTurnoParaOperacion`, que ya devuelve solo vigentes: un alumno quitado no figura.
   - `profesorAtendioAlumno` (`historial.publico.ts:37`) no cuenta clases anuladas.
   - No se implementó la asistencia por alumno (HU-E-09).

**Consolidaciones de 5.3 y 5.4** (sin cambiar firmas ni respuestas de hoy):
- `turno.publico.ts` recibe `contarClasesPorMes` y `gerentePuedeGestionarClaseDeBaja`; se borra `clases.publico.ts`.
- `pago.publico.ts` recibe `listarPagosDeAlumno`, `listarPagosDeClase` y `usuarioRegistroOperaciones`, y sus dos funciones de Sprint 2 pasan a ser las versiones con valor vigente; se borra `pago.lecturas.publico.ts`. Los nombres provisionales `listarPagosDeTurnoVigente` y `sumarPagosPorMesVigente` de 5.4 dejan de existir: el contrato son los nombres de Sprint 2.
- `historial.publico.ts` recibe las lecturas de asistencia y `profesorPuedeRegistrarIndicacion`; se borra `asistencia.publico.ts`. `profesorPuedeVerHistorial` va a `historial.service.ts` y no a la fachada, porque combina una lectura de C con una de E (R2-PR0-4); se borra `alcance-profesor.ts`.
- `profesor.publico.ts` ya tenía `obtenerProfesoresBasicos` (parte 3); solo se corrigieron sus finales de línea.
- `profesor.service.ts`: su chequeo privado de email en uso delega en `verificarEmailNoAsociadoAOtraCuenta` del módulo A y conserva su respuesta de hoy (`EMAIL_YA_ASOCIADO`, «El email pertenece a otra cuenta»).

**Otras decisiones de esta etapa:**
1. **`src/server/turnos/inscripcion.filtro.ts` (nuevo):** contiene `filtroVigenteEn` sin dependencias de servidor (solo tipos de Prisma), y `inscripcion.vigencia.ts` lo reexporta. Hace falta porque `turno.disponibilidad.ts` también lo importa un componente de cliente (`turno-recurrente.tsx` usa `iniciosPosibles`): con el reloj (`node:async_hooks`) en ese archivo, `npm run build` fallaba.
2. **Momento de `alumnosConTurnoSuperpuesto`:** lo recibe como cuarto parámetro opcional (por defecto el reloj del sistema). Los servicios le pasan `ahora()`.
3. **`transaccion()`:** el tipo de `opciones.tiempos` acepta cualquier número (antes exigía los literales por defecto).
4. **`npm run test:pg`:** los `*.pg.test.ts` de Sprint 2 cuya guarda exige un nombre de base fijo (`noctium_test` en HU-C-05, C-06 y C-10, y un nombre con `hu_c17_fase3` en HU-C-17) estaban siempre saltados. El script los corre ahora en pasadas propias, con una base descartable de ese nombre que se borra al terminar. Si `noctium_test` ya existe, no la toca y la pasada falla con un aviso.
5. **Seed base:**
   - **Cajas de prueba:** una caja abierta para cada cuenta de `CUENTAS_CON_CAJA` (`mesa.entrada@` y `mesa.entrada2@`, la lista fija de cuentas del seed por su email, porque la base genera el id de la cuenta). Se crea con `abrirCaja` dentro de `transaccion()`. Si el integrante ya tiene alguna caja, abierta o cerrada, no se crea otra. `validarDatos()` verifica que esas cuentas sean de mesa de entrada.
   - **Fixtures:** al final, después del seed base y de las cajas, `correrFixtures` corre `prisma/seed/fixtures/index.ts`. El índice tiene el comentario para las HU y una lista vacía. El proyecto corre como CommonJS (sin `"type": "module"`), así que el índice no puede ser solo un comentario: necesita la lista y la función que la recorre para que el seed espere a cada fixture. No hay ningún escenario.
   - **Horarios de profesores:** el seed (desde Sprint 1) los borraba y recreaba en cada corrida, y la segunda corrida cambiaba sus ids. Ahora se recrean solo si cambiaron.
6. **Parámetros (5.3, decisión 1):** las lecturas de `turno.generacion.service.ts` y `turno.validaciones.ts` usan otras claves (horario operativo, límites de generación, anticipación) que `parametrosVigentes()` no cubre. Quedan como están.

**Tests de los Sprints 1 y 2 modificados** (solo mocks y datos de persistencia; las aserciones de respuestas, códigos, textos y reglas se mantienen, salvo lo que se indica):

| Test | Motivo |
|---|---|
| `turno.participantes.test.ts` | El `tx` simulado suma lo que usan `transaccion()` y `bloquear()`, y cada transacción recibe su propia copia. Se simula el servicio de inscripción. El `deleteMany`/`createMany` pasa a: altas con `crearInscripcion` y `QUITADA_CENTRO` para las que no siguen (caso nuevo). La confirmación guarda `DISPONIBLE` y las altas llevan la clase a `COMPLETO`, así que las inscripciones van después de confirmar (antes, el `createMany` iba antes). |
| `turno.inscripciones.test.ts` | Se simula `crearInscripcion`/`finalizarInscripcion`. Los casos de cupo, estado, alumno, repetido y superposición simulan el error que lanza `crearInscripcion` y conservan código, texto, detalles y la falta de eventos. Esas reglas se prueban de punta a punta en `turno.inscripciones.pg.test.ts`. La aserción del `SELECT … FOR UPDATE` pasa a: la transacción abre con los tiempos de 2.10 antes de inscribir. El `deleteMany` pasa a `QUITADA_CENTRO`. Mismos 13 casos. |
| `turno.autoservicio.test.ts` | Igual que el anterior para el autoservicio. La consulta de opciones pide clases `DISPONIBLE` o `COMPLETO` y descarta las del alumno con inscripción vigente (2.0, estado por ocupación). |
| `turno.cancelacion.test.ts` | El `tx` suma `$executeRawUnsafe`; los inscriptos salen de `inscripcionesVigentes`. Suma las aserciones de `marcarVencidas` (antes de cancelar y no en una `PENDIENTE`). |
| `turno.reprogramacion.test.ts` | Igual, más `marcarVencidas` y `recalcularVencimientos` (orden respecto del UPDATE). La forma de la consulta incluye el filtro de vigencia y el momento de `alumnosConTurnoSuperpuesto`. |
| `turno.publico.test.ts` | Las filas simuladas suman cupo y las columnas de vigencia. Las consultas incluyen el filtro de vigencia; el fragmento `sqlVigenteEn` se verifica en su posición. |
| `turno.propios.test.ts`, `turno.opciones-alumnos.test.ts`, `turno.detalle.test.ts` | Las consultas incluyen el filtro de vigencia; las filas suman `_count` y cupo. |
| `calendario.service.test.ts` | Dos datos de prueba: una clase `COMPLETO` ahora tiene el cupo lleno, porque el estado mostrado sale de la ocupación (2.2). |
| `clase-dictada.service.test.ts`, `historial.publico.test.ts` | `findUnique` por `turnoId` pasa a `findFirst` con `anuladaEl: null` (1:N). |
| `pago.service.test.ts` | Se simula `registrarOperacion` y la fachada de C. Forma, fecha y parciales los valida ahora `registrarOperacion`: se simula su error y se verifican el código y los datos que recibe. Esas reglas se prueban con PostgreSQL en `operacion.service.pg.test.ts` y `turno.inscripciones.pg.test.ts`. Caso nuevo: `CAJA_NO_ABIERTA`. |
| `pago.publico.test.ts` | Los pagos se leen desde la operación con su valor vigente. `sumarPagosPorMes` verifica el SQL con monto y fecha vigentes y sin anulados. La consulta de alumnos en lote recibe ids sin repetir. Caso nuevo: monto corregido y pago anulado. |
| `publico.aislamiento.test.ts` | La lista permitida de `turno.publico.ts` suma `inscripcion.vigencia`; la de `pago.publico.ts`, `comprobante.schema` y `pago.vigente`. Se agrega `historial.publico.ts`. Se quitan las tres fachadas provisionales de la parte 3 y se suman 4 casos de rechazo. |
| `turno.publico.pg`, `turno.reservas.pg`, `turno.propios.pg`, `turno.participantes.pg`, `turno.cancelacion.pg`, `turno.reprogramacion.pg`, `pago.publico.pg`, `pago.service.pg` | Datos: las inscripciones directas suman `estadoPago`, `precio` y `reservadaEl`; las materias que inscriben por servicio tienen tarifa (HU-L-06). Cada pago tiene su operación, su caja y su inscripción; el que registra por `POST /api/pagos` es una cuenta de mesa de entrada con caja abierta (2.15). Los borrados por `turnoId_alumnoId` pasan a `QUITADA_CENTRO`, y `turno.reservas.pg` verifica además que se libera la reserva. La clase `COMPLETO` de `turno.propios.pg` tiene cupo. `turno.reprogramacion.pg` lee la clase dictada con `findFirst`. |
| `turno.participantes.pg.test.ts` | **Aserción cambiada:** el test fuerza un alumno repetido para provocar un error dentro de la transacción y espera `P2002`. Con `crearInscripcion`, el repetido se detecta antes del índice único y sale `ALUMNO_YA_ASIGNADO`. Las aserciones de reversión (profesor, participantes y eventos) son las mismas. |

Además, tests del PR 0: `errores-dominio.test.ts` fija los literales de Sprint 2 en lugar de leerlos de `turno.service.ts`. `correccion.service.pg.test.ts` e `inscripcion.service.pg.test.ts` calculaban «ayer» y «mañana» con la fecha UTC y fallaban entre las 21 y las 24 del centro; ahora usan la fecha del centro. Los demás solo cambian sus imports. Pruebas nuevas: `turno.inscripciones.pg.test.ts` (10, el comportamiento interino de 2.15 de punta a punta) y la equivalencia de `filtroVigenteEn` en `inscripcion.vigencia.pg.test.ts`.

**Resultado:**
- `npx tsc --noEmit`: 0 errores.
- `npm run lint`: 0 errores; queda el aviso de `Sidebar.tsx`, que ya existía.
- `npm test`: 148 archivos (124 pasan, 24 saltados), 1884 pruebas (1718 pasan, 166 saltadas), 0 fallas. Los saltados son los `*.pg.test.ts`.
- `npm run test:pg` (todos): 24 archivos y 166 pruebas en tres pasadas, todas pasan:
  - la base descartable general: 20 archivos y 132 pruebas; los otros 4 archivos corren en las pasadas de nombre fijo;
  - `noctium_test`: 3 archivos y 18 pruebas;
  - `noctium_pruebas_hu_c17_fase3_…`: 1 archivo y 16 pruebas.
  - Las tres bases se borraron.
- `npm run build` con el `DATABASE_URL` ficticio del CI: compila.
- Seed dos veces seguidas sobre una base descartable migrada: la segunda corrida no cambia conteos ni ids de ninguna tabla, ni las cajas, ni la secuencia de comprobantes. Abre las 2 cajas en la primera corrida y ninguna en la segunda. La base se borró.
- Colecciones Postman (`docs/testing/HU-I-01.postman_collection.json`, `docs/testing/HU-H-01-H-02-revision.postman_collection.json`): no se corrieron. Ver la duda 6.

**Dudas abiertas de esta parte:**
1. **El Profesor perdió `alumnos:leer`** con la migración de permisos de la etapa 1. Su menú sigue mostrando «Alumnos > Listado», que exige ese permiso, y ahora le responde «sin permiso». La ficha por historial sigue andando con `historial:leer`. La tabla de 1.1 decía que se resolvía en el mismo cambio (2.9), que quedó fuera. ¿Se quita el ítem del menú del Profesor, se devuelve el permiso hasta HU-E-02, o se acepta así?
2. **Códigos nuevos en las rutas de turnos:** las rutas de hoy responden 409 a todo `ServiceError` que no sea de inexistencia. Por eso `MATERIA_SIN_TARIFA` (422 en el catálogo) y `TRANSACCION_OCUPADA` salen como 409 por `POST /api/turnos/[id]/alumnos`, `/inscripcion` y `/participantes`. ¿Se ajustan esas rutas (cambio aditivo) o queda así?
3. **Registrar clase dictada no marca reservas vencidas antes** (2.2 lo pide). Las reservas vencidas igual no se registran, porque se filtran con `esVigenteEn`. Marcar exige que la clase dictada corra en `transaccion()` y tome su bloqueo con `bloquear`; lo hace HU-E-09 al pasar a `registrarClaseDictada(tx, …)`.
4. **`turno.participantes.pg.test.ts`:** el código esperado pasa de `P2002` a `ALUMNO_YA_ASIGNADO` (tabla de arriba). Confirmar que se acepta.
5. **Reparto de `RULES.md` y del CI** («Alcance reducido»): es una propuesta. Confirmar con el equipo.
6. **Colecciones Postman:** necesitan cambiar de sesión a mano entre pedidos, cookies que no traen y datos que el seed base ya no tiene (inscriptos de `seed-turno-02`, meses de indicadores), así que correrlas exigía modificarlas. Además, `newman` no está en el repo. Quedan para la prueba manual o para cuando las HU agreguen sus fixtures.
7. **Validaciones pendientes que aplican** (sección 4): `migrate dev --create-only` sobre una copia de `prisma/`, y la prueba con PostgreSQL del índice parcial de la clase dictada.
8. **Parámetros de generación y validación de clases:** siguen leyendo `parametroSistema` directo, con claves que `parametrosVigentes()` no cubre. ¿Las suma HU-N-01?

**Respuestas del responsable del PR 0 a las dudas de esta parte:**
1. El Profesor conserva `alumnos:leer` hasta que HU-E-02 traiga su acceso acotado al historial. Se editó la migración `20261008120200_sprint3_permisos` (todavía no publicada): ya no le quita `alumnos:leer` al Profesor y lo inserta, porque hasta ahora solo lo sembraba el seed. `PERMISOS` del seed lo incluye y `PERMISOS_REVOCADOS` queda vacía. El resto de la matriz de 2.9.1 no cambia. HU-E-02 se lo quita con una migración nueva, en el mismo cambio en que agrega su acceso acotado. Verificado en una base descartable: migraciones solas y la misma base después del seed dan exactamente las mismas 92 filas (65 acciones).
2. En las rutas de turnos, un `ErrorDeDominio` con un `code` nuevo del PR 0 responde con el HTTP de su catálogo; los `code` que ya existían en los Sprints 1 y 2 conservan su respuesta de hoy.
   - `CODIGOS_SPRINTS_1_Y_2` (`errores-dominio.ts`) lista los 29 `code` del catálogo que ya existían en `develop`.
   - `statusDeErrorNuevo(error)` (`error-dominio.ts`) devuelve el HTTP del catálogo solo para los demás.
   - La usan, antes de su tabla de hoy, las seis rutas que llaman a los servicios del PR 0: `POST /api/turnos/[id]/alumnos`, `DELETE …/alumnos/[alumnoId]`, `POST …/inscripcion`, `PATCH …/participantes`, `POST …/cancelacion` y `PATCH …/reprogramacion`.
   - Pruebas: `src/app/api/turnos/[id]/errores-dominio.route.test.ts` (por ruta, `MATERIA_SIN_TARIFA` 422, `TRANSACCION_OCUPADA` 409 y otros códigos nuevos con su HTTP; y códigos existentes lanzados como `ErrorDeDominio` con un HTTP de catálogo distinto, que conservan la respuesta de hoy) y dos casos en `errores-dominio.test.ts`.
3. La marca de reservas vencidas al registrar una clase dictada queda para HU-E-09.
4. Se acepta el cambio de aserción de `P2002` a `ALUMNO_YA_ASIGNADO` en `turno.participantes.pg.test.ts`.
5. El reparto de `RULES.md` y del CI se confirma con el equipo.
6. Las colecciones Postman no se corren. La evidencia de compatibilidad son las pruebas de punta a punta con PostgreSQL más una prueba manual del responsable del PR 0.
7. `migrate dev --create-only` sobre una copia de `prisma/` y la prueba del índice parcial de la clase dictada quedan como nota. La segunda la hace quien tome HU-E-09 o HU-E-11.
8. Los parámetros de generación y validación de clases los suma HU-N-01.

## 6. Decisiones alineadas y datos que debe completar el equipo

- **Fichas de profesores existentes:** el seed asegura cuentas vinculadas para los profesores elegidos para la demostración y anota cuáles son en «Decisiones tomadas»; las demás fichas pueden permanecer sin cuenta. HU-A-06 sigue aplicándose a altas nuevas.
- **Proceso programado:** según HU-C-24, criterio 1 (Pendiente 12, cerrado), corre cada 5 minutos en el entorno reproducible de demostración, que puede ser local y no requiere despliegue público. El documento de developers define el mecanismo de disparo y cómo reproducirlo (por ejemplo, un programador local que llama al endpoint protegido con `CRON_SECRET`, que el endpoint compara en tiempo constante). Este PR deja la variable y la excepción documentada a la Regla N.° 10 (2.10, 2.11).
- **Base de datos:** se exige `prisma migrate reset` en todos los entornos; no hay datos que preservar ni migración de datos (decisión del PO). Responsable del PR 0: Adriel (Scrum Master).
- **Mercado Pago:** el PO confirma que sigue disponible como forma de pago de mostrador. Se registra manualmente un cobro ya realizado; no se implementa pago en línea ni integración externa.
- **Datos de presentación:** la base es descartable y el equipo la reinicia o amplía según las HU que se vayan demostrando. PR 0 asegura el modelo y un seed mínimo repetible; cada HU dueña de indicadores o cajas cerradas carga sus escenarios históricos como fixtures repetibles; el PO valida la demostración (Pendiente 11 del backlog).
- **Decisiones del Scrum Master al integrar las specs (v20).** Cada pedido que no se podía aceptar tal cual o que quedaba abierto se resolvió así; en cada caso se dice a quién avisar:
  1. **Etapa 1 «sola y primero» (R7-PR0-4):** se entrega, pero **no se mergea sola a `develop`**: sin las etapas 2 y 3 el código existente no compila y 1.1 exige que `develop` funcione siempre (0). Avisar al equipo (los cuatro carriles) y confirmar con el equipo cómo se publica (rama de integración compartida u otra).
  2. **Rama de asistencias de `registrarClaseDictada` (R2-PR0-5):** el PR 0 adapta la función y deja la firma final con `asistencias?`, pero la rama con asistencias la implementa HU-E-09, como decía la v19. Avisar al responsable del carril 3.
  3. **Seed de historial académico (R2-PR0-7):** el PR 0 solo siembra lo que sus servicios y los existentes pueden crear; el resto lo siembra cada HU de E con el punto de extensión de fixtures (2.16). Avisar al responsable del carril 3.
  4. **`compatSprint2` permanente (R3-PR0-I1):** corrige la v19, que decía que HU-I-10 lo eliminaba. Avisar al responsable de HU-I-10.
  5. **Columnas del `Pago` (R3-PR0-I2, T6):** `Pago` conserva `formaPagoId`, `fechaPago` y `creadoPorUsuarioId` como valores originales inmutables y la operación guarda los mismos como base de las correcciones; corrige la v19 (2.3), que los pasaba a la operación. Gana lo existente (1.1).
  6. **`HistorialTarifa` en la misma transacción (P-L6):** se confirma, porque es un dato de negocio (Regla N.° 8) y el cambio masivo tiene que ser atómico. Es una excepción acotada a «el historial se escribe después del commit» (2.10). `HistorialParametro` sí se escribe después del commit. Avisar al responsable de HU-L-06/L-07.
  7. **`parametrosVigentes()` sin caché (P-N2):** lee la base en cada llamada, así un cambio de HU-N-01 rige en la operación siguiente.
  8. **`profesorPuedeVerHistorial` vive en E (R2-PR0-4):** no en una fachada, porque combina funciones de C y de E y ninguna `*.publico.ts` importa a otra.
  9. **Gerente y la tarifa:** ve la tarifa con `materias:cambiar_tarifa`; `materias:ver_tarifa` es solo de mesa de entrada (2.9.1).
  10. **Entidad del historial de estados para las formas de pago:** `FORMA_PAGO`, definitiva (mismo patrón que `FICHA_MESA_ENTRADA`).
  11. **Fecha de integración:** sin fecha fija; la define el equipo. La etapa 1 se entrega apenas cumple su condición, porque destraba a los demás carriles. Si no está para el checkpoint del backlog, el checkpoint se mide por el criterio alternativo de la convención 7.
- **Puntos de la spec D, resueltos:** (a) **Fachada de C para la baja del profesor:** `turno.publico.ts` reexporta las funciones nuevas desde un archivo de servicio propio de C (`turno.baja-profesor.service.ts`), que es quien importa la fachada de D. Es el mismo patrón que la regla de aislamiento ya admite para las fachadas (importar solo el service del propio módulo, para reexportar). Si el test de aislamiento no lo aceptara, C usa una segunda fachada propia; el contrato de las funciones no cambia. Lo verifica quien implemente HU-D-08 en su PR: no es parte del PR 0. (b) **`code` de C para un profesor inexistente o inactivo:** `404 PROFESOR_NO_ENCONTRADO` (spec C 2.1, un solo código en Turnos); las rutas de D conservan `409 PROFESOR_INACTIVO`. El destino del cambio de profesor se valida en D con `PROFESOR_NO_ENCONTRADO`/`PROFESOR_INACTIVO`; si el destino se desactiva entre la lectura y el bloqueo, C responde con su código único.
- **Correo (decisión del PO):** PR 0 documenta las variables de Resend sin secretos en el código o seed. La demostración usa el simulador de `email.service.ts` (corre en modo desarrollo y muestra el enlace en la consola); no se exige cuenta de Resend ni dominio remitente, ni para integrar HU-A-05 ni para el merge de PR 0. Si alguien carga `RESEND_API_KEY` y `EMAIL_FROM`, el mismo servicio envía por Resend.

## 7. Cambios de la v20 respecto de la v19

Incorpora, en una sola versión, los pedidos de las specs de los módulos A a N (Revisión 3) y del análisis de dependencias (R7). La tabla de trazabilidad es la sección 2.18. No cambia el alcance del sprint ni el principio de compatibilidad (1.1).

- **Sin fechas:** se quitaron las fechas que había puesto el SM para el PR 0; las define el equipo.
- **Ajuste (tarde):** el PO aceptó que la demostración use el simulador de email (convención 8 j y HU-A-05, criterio 7 del backlog). Cambian solo 2.11 y la nota «Correo» de la sección 6: ya no se exige cuenta de Resend ni dominio remitente. No cambia nada más.
- **Encabezado y sección 0:** fecha de integración: merge único sin fecha fija y etapa 1 apenas cumple su condición (la v19 fijaba otra, que ya no rige); instrucción 1 con todas las specs; **orden de publicación de las firmas** (R7-PR0-3) y **entrega de la etapa 1** al equipo sin mergearla sola (R7-PR0-4 ajustado, 6).
- **1.1:** dos filas nuevas: el alta con `email` crea la cuenta y, con cuenta, el email de la ficha es el de la cuenta (R3-PR0-D7).
- **2.0:** `Pago` conserva más columnas (T6); verificación del trigger por `profesorId` (D4).
- **2.3:** `Pago` conserva `formaPagoId`, `fechaPago` y `creadoPorUsuarioId` (corrige la v19); índice `(alumnoId, fechaPago)`.
- **2.4:** códigos de materia del seed sin guion (P-L8); `HistorialTarifa` en la misma transacción confirmado (P-L6); `obtenerTarifasPorIds`.
- **2.5:** `efectivoDeclarado` admite vacío; par de ajustes para el cambio de forma de pago.
- **2.6:** `parametrosVigentes()` entrega los tres parámetros como enteros y lee en cada llamada; forma de `HistorialParametro`.
- **2.7:** esquema y código de la spec A; fichas con `version`, campos normalizados e índice.
- **2.8:** `motivoAnulacion` (antes `motivo`).
- **2.9 y nueva 2.9.1:** **tabla cerrada de acciones** con todos los permisos de las specs; rutas por rol de A, B, C, D, E, H e I; `profesorPuedeVerHistorial` en E; `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId, db?)`.
- **2.10:** orden de bloqueo con ficha del personal, ficha de gerente y «formas de pago»; excepción documentada del historial de tarifas.
- **2.11 y 2.12:** `NEXTAUTH_URL`; componentes `tabs` y `table` de shadcn/ui.
- **2.13:** aclaraciones de los servicios de inscripción; **`compatSprint2` permanente**; conteo de pagos en `marcarPagada`/`recalcularEstadoPago`; funciones de caja nuevas; servicios de cuentas completos; **`listarHistorialEstados` publicada por el PR 0**; lecturas públicas nuevas de C, D, E, I y L; corrección de la frase de los inscriptos de HU-H-07; códigos de error nuevos.
- **2.14:** detalle de esquema de A, E, F, G, I, L y N.
- **2.15:** aclara que `POST /api/pagos` queda con el modo de compatibilidad.
- **2.16:** `bloquear` con más recursos; seed de escenarios ampliado (R7-PR0-2, D5); alcance del historial académico sembrado.
- **2.17:** las specs ya existen; qué spec manda en qué; alineación del mapa.
- **Nueva 2.18:** trazabilidad de todos los pedidos.
- **4:** nuevo grupo «Pedidos de las specs (v20)» y ajustes a cuatro controles existentes.
- **6:** decisiones del Scrum Master al integrar las specs; los puntos que quedaban a confirmar quedaron resueltos.

### Cambios de la v19 respecto de la v18

Principio de compatibilidad pedido por el Scrum Master: nada de lo ya desarrollado se rompe. No cambia el alcance del sprint ni las etapas.

- **Nueva sección 1.1:** el principio, cómo se aplica y la tabla de los únicos cambios de comportamiento que manda el backlog o el PO. Se agrega la instrucción 7 para Claude Code.
- **2.0:** la decisión de modelo queda resuelta (se extiende `TurnoAlumno`, misma relación `Turno.alumnos`); los lectores de `Pago` siguen compilando y conservan firma y forma; los tests solo cambian en lo que mockean.
- **2.3:** `Pago` conserva `turnoId`, `alumnoId`, `montoPago` y `createdAtPago`; la forma, la fecha y el usuario pasan a la operación.
- **2.4:** `Materia.tarifaHora` **admite vacío** (antes NOT NULL), porque el alta de materia de Sprint 1 no recibe tarifa y se rompía; el historial admite tarifa anterior vacía; `MATERIA_SIN_TARIFA` al inscribir (`spec_modulo_L.md` P-L1).
- **2.9:** acciones de tarifa: cambiar (gerente) y ver (mesa de entrada y gerente), porque el profesor tiene `materias:leer`.
- **2.10:** las discrepancias de RULES se corrigen en el texto, no en el código ni en el CI; `ErrorDeDominio` extiende `ServiceError`; excepción documentada a la Regla N.° 8 para la anulación de la clase dictada.
- **2.13:** `ErrorDeDominio` usa los mismos `code` que hoy; **modo de compatibilidad** de `registrarOperacion` para el cobro de Sprint 2 (clase iniciada, pagos parciales, sin motivo de ajuste) hasta HU-I-10.
- **2.15:** `POST /api/pagos` conserva su contrato completo; quitar alumno y asignar participantes conservan sus respuestas. El cobro exige caja abierta (único cambio visible, con seed y script).
- **4:** nuevos controles de compatibilidad (Postman de Sprint 1 y 2 sin modificar, tests no debilitados, alta de materia sin tarifa).

### Cambios de la v18 respecto de la v17

Alineación con el backlog oficial (40 HU). No cambia el alcance técnico ni las etapas.

- **PR 0 fuera de la estimación:** el PR 0 lo hace el Scrum Master por separado; no se estima en la planning, no se reparte entre el equipo y no se descuenta de la capacidad (encabezado y sección 0). Nota para los POs: la convención 8 (i) y el Pendiente 1 del backlog todavía dicen lo contrario.
- **2.13, lecturas públicas (HU-C-26):** `listarReservasVencidas` incluye las reservas ya marcadas como vencidas aunque la clase se haya cancelado después, como cuentan HU-C-24 (criterio 6) y HU-H-10. Las vencidas sin marcar de clases Canceladas siguen sin listarse.
- **2.3, comprobante:** aclara que `datos` guarda el usuario real y que la vista del alumno lo reemplaza (HU-I-11, criterio 2).
- La fecha de merge no se modificó: sigue como en el backlog y está pendiente de definir.
