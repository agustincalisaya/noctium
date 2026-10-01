# TASK: HU-J-03 — Visualizar calendario por día/semana/mes

**Módulo:** J (Visualizar calendario)
**Sprint:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_J.md` Revisión 2 / 2.1 (§1, §2.1, §2.2, **§2.3**, §3.1–3.6) · `docs/specs/spec_modulo_C.md` §2.15 (`listarTurnosParaCalendario`) · `docs/tasks/Sprint 2/HU-Sprint-2.md` HU-J-03, criterios de aceptación 1-5 · `docs/tasks/Sprint 1/HU-J-01.md` y `HU-J-02.md` (grilla, helpers y decisiones que se reutilizan) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila HU-J-03) y §4 (quick-view)
**RBAC:** `calendario:leer` — **ya existe** (HU-J-01) para `MESA_ENTRADA`, `GERENTE` y `PROFESOR`. No se agregan permisos. `ALUMNO` no lo tiene → `403`. El alcance por rol de HU-J-01/HU-J-02 no cambia.
**Schema:** sin migración. Se usan `Turno.fechaTurno`, `estadoTurno` (`enum EstadoTurno { PENDIENTE DISPONIBLE COMPLETO CANCELADO }`) y `prioridadTurno` (`enum PrioridadTurno { NORMAL ALTA URGENTE }`), los mismos campos que ya lee el calendario. **Prohibido** agregar modelos o campos.
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/calendario.types.ts`, schema en `src/server/calendario/calendario.schema.ts`, service en `src/server/calendario/calendario.service.ts`, helpers puros en `src/lib/calendario-semana.ts`, componentes compartidos en `src/components/shared/`).

> **Estado de la task (01/10/2026):** **implementada** sobre `develop` (`72c54b8`), sin commits (git lo maneja el responsable). `tsc`, lint, `npm test` y `npm run build` en verde. Falta la verificación en navegador y la de Niveles 2/3 con sesiones reales (§6, §9). Los tres "A CONFIRMAR" los resolvió el responsable en la consigna de implementación (§1 puntos 7, 8 y 11).
>
> **Nota — implementación de corrido:** por pedido del responsable se implementó sin frenar a confirmar el relevamiento de §0; las decisiones quedan registradas en §1.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno). El refactor de los componentes compartidos no puede romper `/calendario/profesor` ni `/calendario/materia` en la vista Semana.
- Los puntos marcados como **"A CONFIRMAR"** en esta task (§1 puntos 7, 8 y 11; §8), con la pregunta concreta.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

Lo que ya encontró el relevamiento al redactar esta task:

### 0.1. Qué dejan HU-J-01 y HU-J-02

| Pieza | Ubicación | Estado hoy | Uso en HU-J-03 |
|---|---|---|---|
| Página por profesor | `src/app/(dashboard)/calendario/profesor/page.tsx` | Server Component. Lee `?profesorId=&semana=`, calcula `lunes` con `hoyEnZonaCentro()` + `lunesDeLaSemana()`, renderiza `SelectorCalendario`, `NavegacionSemana` y `<Suspense key>` con `AgendaSemanal` → `GrillaSemanal` | Se modifica: lee `vista` y `fecha`, ramifica Día/Semana/Mes (§5.3) |
| Página por materia | `src/app/(dashboard)/calendario/materia/page.tsx` | Igual estructura, con `?materiaId=&semana=` y `TurnosDeLaSemana` | Se modifica igual que la de profesor |
| `/calendario` | `src/app/(dashboard)/calendario/page.tsx` | Redirige a `/calendario/profesor` | Sin cambios |
| `error.tsx` de cada ruta | `calendario/profesor/error.tsx`, `calendario/materia/error.tsx` (cuerpo en `components/shared/error-calendario.tsx`) | Reintentar con `retry()` | Sin cambios |
| `GrillaSemanal` | `src/components/shared/grilla-semanal.tsx` | Genérica (`renderEvento`), columnas = `dias: DiaDeSemana[]`, filas = `franjasDeLaGrilla()`, carriles para superpuestos. Encabezado "Lunes 21/09" y columna de hoy con `bg-secondary` | **Se reutiliza para Día** (un solo elemento en `dias`). Se ajusta el encabezado de columna y la columna de horas al diseño de referencia (§5.1) |
| `BloqueEventoCalendario` | `src/components/shared/bloque-evento-calendario.tsx` | Link a `/turnos/[id]?volver=`, estado con `Badge variant="success"` para **ambos** estados (+ ícono `CalendarCheck` / `Users`), prioridad con `Flag` | Sin cambios de comportamiento. Ver §1 punto 9 (colores de estado) |
| `EventoCalendario` / `EventoCalendarioMateria` | `src/components/shared/evento-calendario.tsx`, `evento-calendario-materia.tsx` | Líneas de datos por vista | Sin cambios (solo reciben otro `volverA`) |
| `NavegacionSemana` | `src/components/shared/navegacion-semana.tsx` | Rango ("Semana del 21/09 al 25/09/2026") + links Anterior / Hoy / Siguiente | Se reemplaza por `NavegacionCalendario` (rótulo por vista, `Hoy` ‹ ›) |
| `SelectorCalendario` | `src/components/shared/selector-calendario.tsx` | `<select>` cliente; al cambiar arma la URL con `construirUrlCalendario(rutaBase, { [parametro]: elegido, semana })` | Se modifica: conserva `vista` y `fecha` en lugar de `semana` |
| `CargandoCalendario`, `AvisoCalendario`, `CalendarioVacio` | `src/components/shared/estado-calendario.tsx` | Texto por prop | Sin cambios |
| Helpers | `src/lib/calendario-semana.ts` | `ZONA_HORARIA_CENTRO`, `hoyEnZonaCentro`, `esFechaCalendario`, `sumarDias`, `lunesDeLaSemana`, `desplazarSemana`, `diasOperativosDeLaSemana`, `rangoDeLaSemana`, `formatearRangoSemana`, `franjasDeLaGrilla`, `posicionEnGrilla`, `asignarCarriles`, `construirUrlCalendario(Profesor\|Materia)`, `etiquetaMateria` | Se amplía con helpers de vista, mes y rótulos (§4.1) |
| Servicio | `src/server/calendario/calendario.service.ts` | `listarTurnosAgendadosDeProfesor()` / `listarTurnosAgendadosDeMateria()` consultan `prisma.turno` (excepción `TODO(Regla N.° 3)`), `where` con rango **semiabierto** `[desde, hasta)`; `semanaDelCalendario(lunes)`; `obtenerCalendarioProfesor({ …, lunes })`; `obtenerCalendarioMateria({ …, lunes })` | Se modifica: rango por vista, resumen del mes, rango cerrado (§4.3–4.5) |
| Schema | `src/server/calendario/calendario.schema.ts` | `ConsultarCalendarioSemanaQuerySchema` (`semana_inicio`), exportado como `…ProfesorQuerySchema` y `…MateriaQuerySchema` | Se reemplaza por `ConsultarCalendarioQuerySchema` (§4.2) |
| Tipos | `src/types/calendario.types.ts` | `EventoCalendarioBase` (con `prioridad`), `EventoCalendario`, `EventoCalendarioMateria`, `RangoSemana`, `CalendarioProfesor`, `CalendarioMateria` | Se amplían con `VistaCalendario` y el resumen del mes (§4.4) |
| Route Handlers | `src/app/api/calendario/profesor/[profesorId]/route.ts`, `src/app/api/calendario/materia/[materiaId]/route.ts` | Parsean `semana_inicio`, normalizan al lunes y llaman al servicio | Se modifican: `vista`, `fecha`, `semana_inicio` como alias (§4.6) |
| Tests | `src/lib/calendario-semana.test.ts`, `src/server/calendario/calendario.service.test.ts`, `src/components/shared/evento-calendario-materia.test.tsx` | Vitest (`npm test`) | Se amplían (§6) |
| Menú | `src/components/layout/Sidebar.tsx` | "Agenda por profesor" / "Agenda por materia" (Mesa, Gerente); "Mi agenda" / "Mis turnos por materia" (Profesor) | Sin cambios |

### 0.2. Cómo se calcula hoy la semana (base de los tres rangos)

- "Hoy" sale de `hoyEnZonaCentro()` en `America/Argentina/Buenos_Aires` (única conversión con zona horaria). El resto es aritmética de fechas calendario `AAAA-MM-DD` con `Date.UTC`.
- Semana **lunes a domingo**: `lunesDeLaSemana(fecha)`; columnas y rango = días de `dias_operativos` (`obtenerParametrosHorarioOperativo()`). En el seed: `LUNES,MARTES,MIERCOLES,JUEVES,VIERNES` (`prisma/seed.ts`, `PARAMETROS.dias_operativos`), así que hoy la semana se ve **lunes a viernes**.
- Rango consultado: `rangoDeLaSemana()` inclusivo; el servicio lo convierte a `[desde, hasta)` sumando un día (`semanaDelCalendario()`).
- Una `semana` inválida en la URL abre la semana actual; en la API, `400 VALIDACION`.

### 0.3. Servicio público del módulo C

`spec_modulo_C.md` §2.15 contractualiza `listarTurnosParaCalendario({ desde, hasta, profesorId?, materiaId? }, db?)` (rango cerrado `[desde, hasta]`, solo `DISPONIBLE`/`COMPLETO`), y `spec_modulo_J.md` §1 dice que **HU-J-03 migra** `calendario.service.ts` a esa función. **En el código no existe:** `src/server/turnos/turno.publico.ts` exporta `bloquearTurnoParaOperacion`, `obtenerAlumnosInscriptosDeTurno`, `contarTurnosFuturosDeProfesorPorMateria`, `ajustarCuposPorCapacidadDeAula`, `emitirEventosTurno` y `contarTurnosPorMes` (este último cuenta por mes e incluye `CANCELADO`; no sirve para el calendario). Ver §1 punto 7.

### 0.4. Toggle "Por profesor | Por materia"

El diseño de referencia (§5.1) ubica en la fila de filtros un toggle "Por profesor | Por materia". **Hoy no existe:** son dos rutas separadas a las que se llega desde el Sidebar. Ver §1 punto 8.

### 0.5. Quick-view del turno

`spec_modulo_J.md` §2.3 punto 7 y `mapa-pantallas-sprint-2.md` §4 describen un `Dialog` de resumen al tocar un turno (mejora de UX aprobada el 28/09, **no es criterio de aceptación**). Hoy el bloque del turno es un `Link` a `/turnos/[id]?volver=`; no hay ningún `Dialog` en el calendario. Ver §1 punto 11.

### 0.6. Datos del seed para la vista Mes

`prisma/seed.ts` (`TURNOS`) ubica los turnos por **día operativo relativo a hoy** (`fechaOperativa(hoy, n)`, `0` = próximo día operativo): de `-2` a `10`. Con "hoy" = miércoles 30/09/2026 quedan 2 turnos confirmados en septiembre (28/09 y 29/09) y el resto entre el 01/10 y el 14/10. Además hay 3 `PENDIENTE` (`seed-turno-11`, `-18`, `-25`) y 1 `CANCELADO` (`seed-turno-09`). No hay ningún día con **empate** `DISPONIBLE`/`COMPLETO` ni con mayoría de `COMPLETO`, y el mes en curso queda casi vacío. Ver §3.1 (subtarea de seed).

---

## 1. Nota de alcance — decisiones sobre puntos relevados

1. **DECISIÓN — vista y fecha en la URL; la entidad elegida viaja siempre.**
   - `/calendario/profesor?profesorId=<cuid>&vista=dia|semana|mes&fecha=AAAA-MM-DD` y `/calendario/materia?materiaId=<cuid>&vista=…&fecha=…`.
   - Sin `vista` → `semana` (AC1). Una `vista` desconocida → `semana`. Sin `fecha` o `fecha` inválida → hoy en `America/Argentina/Buenos_Aires` (mismo criterio que la `semana` inválida de HU-J-01).
   - **Compatibilidad:** `?semana=<fecha>` (links y "volver" viejos de HU-J-01/HU-J-02) se lee como `vista=semana&fecha=<fecha>` si no viene `fecha`. Los links nuevos ya no generan `semana`.
   - Rol `PROFESOR`: la página sigue ignorando `profesorId` (HU-J-01 §1 punto 1); la URL de vuelta no lo lleva.
   - `fecha` es la **fecha de referencia**: el día visto (Día), cualquier día de la semana (Semana, se normaliza al lunes) o cualquier día del mes (Mes, se normaliza al día 1 para navegar).

2. **DECISIÓN — transiciones de vista (AC4, AC5, `spec_modulo_J.md` §2.3 puntos 5 y 6).**

   | Acción | URL resultante | Efecto |
   |---|---|---|
   | Elegir otra vista en el control Día/Semana/Mes | `vista=<nueva>`, **sin `fecha`** | Abre en hoy / esta semana / este mes. Conserva profesor o materia |
   | "Hoy" | misma `vista`, sin `fecha` | Vuelve al día, semana o mes actual |
   | ‹ / › | misma `vista`, `fecha` ± 1 día / 1 semana / 1 mes | Navega dentro de la vista |
   | Clic en un día del mes | `vista=dia&fecha=<día>` | Única transición que conserva una fecha distinta de hoy |
   | Cambiar profesor o materia en el selector | misma `vista` y `fecha` | Conserva el período consultado (como hoy conserva la semana) |
   | Clic en un turno (Día o Semana) | `/turnos/[id]?volver=<URL actual con vista y fecha>` | Igual que HU-J-01/J-02 |

3. **DECISIÓN — tres rangos cerrados, una sola consulta (`spec_modulo_J.md` §2.3 punto 1, §3.5).**
   - **Día:** `[fecha, fecha]`. Se muestra **aunque no sea día operativo** (p. ej. clic en un sábado del mes, o "Hoy" un domingo): una columna, normalmente vacía con "Agenda sin turnos".
   - **Semana:** sin cambios respecto de HU-J-01: lunes a domingo de la semana de `fecha`, columnas y rango del primer al último día de `dias_operativos`.
   - **Mes (rango mostrado):** del día 1 al último día calendario del mes de `fecha`.
   - **Mes (rango consultado):** la grilla completa, del **lunes** de la semana que contiene el día 1 al **domingo** de la semana que contiene el último día (35 o 42 días). Así los días de relleno del mes anterior/siguiente también muestran sus turnos (diseño de referencia §5.4). Es una ampliación de lo que dice la spec (ver §8, Supuestos).
   - Los tres usan la **misma** consulta y el mismo filtro `DISPONIBLE`/`COMPLETO`; el mes agrega **en memoria** (§3.5 de la spec). No se agrega una consulta propia del mes.
   - El rango pasa a ser **cerrado** en la query (`fechaTurno: { gte: desde, lte: hasta }`), sin sumar un día, alineado con el contrato de `listarTurnosParaCalendario`.

4. **DECISIÓN — estado predominante del día (AC2; `spec_modulo_J.md` §2.3 punto 4, Revisión 2.1).**
   - Solo cuentan los estados que el calendario muestra: `DISPONIBLE` y `COMPLETO` (`PENDIENTE` y `CANCELADO` nunca llegan, §3.1).
   - `estado_predominante` = el estado con **más turnos** ese día; **empate → `COMPLETO`** (orden de desempate `COMPLETO` > `DISPONIBLE`); `null` si `cantidad = 0`.
   - `prioridad_maxima` = la mayor `prioridadTurno` del día (`URGENTE` > `ALTA` > `NORMAL`), `null` sin turnos. Se calcula porque la spec lo pide en la respuesta; la UI del mes no la muestra en esta HU (§8).
   - Se calcula en el servicio con una función pura exportada (`resumirDiasDelMes()`), testeada aparte.

5. **DECISIÓN — Día reutiliza `GrillaSemanal`.** La vista Día es la misma grilla con `dias = [{ fecha, dia }]`: mismo horario operativo, mismas franjas, mismos carriles para superpuestos y el mismo bloque de turno (AC3). La grilla ya ocupa todo el ancho (`minmax(9rem, 1fr)`). No se crea una grilla diaria aparte.

6. **DECISIÓN — componentes compartidos, sin un "mega componente" de calendario.**
   - Las dos páginas difieren en el alcance por rol, los mensajes de error y el bloque de evento; eso queda en cada `page.tsx`.
   - Se extrae lo que es idéntico: encabezado (título, control de vista, filtros, navegación), grilla del mes y la lectura de `vista`/`fecha` de los searchParams (`resolverVistaYFecha()`, helper puro).
   - Archivos nuevos: `control-segmentado.tsx`, `encabezado-calendario.tsx`, `navegacion-calendario.tsx` (reemplaza a `navegacion-semana.tsx`) y `grilla-mensual.tsx` (§3.2).

7. **DECISIÓN RESUELTA (01/10) — migración a `listarTurnosParaCalendario()` (Regla N.° 3): no se migra, porque la función no existe.**
   - Verificado al implementar: `src/server/turnos/turno.publico.ts` sigue sin exportarla (§0.3).
   - Se unificaron las dos consultas en `listarTurnosDelCalendario({ desde, hasta, profesorId?, materiaId? })` dentro de `calendario.service.ts`, con la firma, el rango cerrado y la forma de dato (`TurnoDelCalendario`) del contrato de C. Los eventos de cada pantalla se arman con `eventoDeProfesor()` / `eventoDeMateria()`. `listarTurnosAgendadosDeProfesor()` y `listarTurnosAgendadosDeMateria()` se eliminaron.
   - Se mantiene el `TODO(Regla N.° 3)`. Cuando C la publique, solo cambia el cuerpo de `listarTurnosDelCalendario()`. No se tocó ningún archivo del módulo C.

8. **DECISIÓN RESUELTA (01/10) — toggle "Por profesor | Por materia": sí.**
   - `ControlSegmentado` de **links** entre `/calendario/profesor` y `/calendario/materia`, con el mismo estilo que el control de vista. Conserva `vista` y, si vino explícita en la URL, `fecha`; la entidad no se conserva (son entidades distintas). Etiquetas: "Por profesor | Por materia" para Mesa/Gerente; "Mi agenda | Por materia" para Profesor. El Sidebar no cambia.

9. **DECISIÓN — colores de estado según `DESIGN.md` §6.5.**
   - El badge de estado del mes usa la tabla 6.5: **Disponible** = `bg-success text-success-foreground`; **Completo** = `bg-primary text-primary-foreground`. Siempre con texto e ícono (`ICONO_ESTADO`), nunca solo color.
   - Hoy `BloqueEventoCalendario` usa `Badge variant="success"` para los dos estados (anterior a la tabla 6.5). Se extrae un mapa compartido `CLASE_ESTADO` en `bloque-evento-calendario.tsx` y lo usan el bloque y la celda del mes, para que Semana/Día y Mes muestren el mismo color por estado. Es un cambio visual menor del bloque; no cambia datos ni comportamiento.

10. **DECISIÓN — `GrillaSemanal`: ajuste visual al diseño de referencia, sin cambios de lógica.**
    - Encabezado de columna: nombre corto en mayúsculas ("LUN", "MIÉ") + número del día; hoy con el número dentro de un círculo `bg-brand-accent` y texto `text-foreground` (DESIGN §4: sobre acento, texto Grafito). Se mantiene `aria-current="date"` y el `sr-only` "(hoy)". Desaparece el fondo `bg-secondary` de la columna de hoy.
    - Columna de horas en `font-mono`, con etiqueta solo en las horas en punto (08:00, 09:00, …). Las filas siguen siendo de `granularidadMinutos` (30) para posicionar los turnos de 30 min.

11. **DECISIÓN RESUELTA (01/10) — quick-view (`Dialog` de resumen): no, queda fuera.**
    - No es AC de HU-J-03. Tocar un turno en Día o Semana sigue abriendo `/turnos/[id]?volver=<URL del calendario con vista y fecha>`. Queda como pendiente (§8).

12. **DECISIÓN (implementación) — `CuerpoCalendario` compartido.** Además de las piezas de §1 punto 6, se extrajo `cuerpo-calendario.tsx`: recibe el calendario de cualquier vista y muestra la línea "Turnos de …", el aviso de vacío y `GrillaSemanal` (día/semana) o `GrillaMensual` (mes). Cada página solo decide el servicio, los mensajes de error y el bloque de evento.

13. **DECISIÓN (implementación) — `fecha` explícita vs. implícita.** `resolverVistaYFecha()` informa si la fecha vino en la URL. Si no vino ("hoy" implícito), el selector de profesor/materia y el toggle de tipo no la agregan, para que la vista siga abriendo en hoy. Los links de vuelta desde el detalle (`volverA`) sí llevan la fecha efectiva.

**Supuestos tomados** (ampliados en §8):
- Columnas de la vista Semana = días operativos configurados (hoy LUN–VIE). El diseño de referencia muestra LUN–SÁB porque supone un centro que abre los sábados; con `dias_operativos` = `LUNES…SABADO` se ve exactamente así.
- La vista Mes siempre muestra LUN–DOM (grilla mensual completa), independientemente de los días operativos (decisión de diseño, §5.4).
- ‹ / › en Día mueven un día calendario (no saltan los días no operativos).

**Dependencias de esta implementación:**
- **Depende de:** HU-J-01 y HU-J-02 (implementadas, mergeadas en `develop`). No depende de ninguna otra HU del Sprint 2.
- **Coordinación (no bloqueante):** módulo C para `listarTurnosParaCalendario()` (§1 punto 7); dueño del seed para los turnos del mes (§3.1).

**Fuera de alcance de esta task (explícito):**
- Quick-view `Dialog` (§1 punto 11).
- Filtros combinados (profesor + materia a la vez).
- Crear, editar o arrastrar turnos desde el calendario; vista por aula.
- Mostrar `CANCELADO` o `PENDIENTE` en cualquier vista.
- Cambios en archivos del módulo C (`src/server/turnos/**`, `src/app/api/turnos/**`, `src/app/(dashboard)/turnos/**`), salvo que el dueño de C publique `listarTurnosParaCalendario()` (§1 punto 7).
- Cambios en `Sidebar.tsx`.
- Migraciones o cambios de schema.

---

## 2. Historia de Usuario

**Como** usuario autorizado
**Necesito** cambiar la vista del calendario entre día, semana y mes
**Para** elegir el nivel de detalle según lo que necesito revisar

**Funcionalidad:** Visualizar calendario
**SP estimado:** 2

**Justificación de secuencia (`HU-Sprint-2.md`):** depende de HU-J-01 y HU-J-02 (ya implementadas), que dejaron esto como "incremento posterior" (criterio 8 de HU-J-01, Sprint 1). No depende de ninguna otra historia de este sprint.

### 2.1. Criterios de aceptación y dónde se cumplen

| # | Criterio (`HU-Sprint-2.md`) | Cómo se cumple | Dónde |
|---|---|---|---|
| 1 | Las pantallas de calendario (HU-J-01, HU-J-02) agregan un control de vista con tres opciones: Día, Semana (vista actual, por defecto) y Mes. | `ControlSegmentado` "Día \| Semana \| Mes" en el encabezado compartido de las dos páginas; sin `vista` en la URL → `semana`. | `encabezado-calendario.tsx`, `control-segmentado.tsx`, `resolverVistaYFecha()`, ambas `page.tsx` |
| 2 | La vista Mes muestra los turnos como indicadores compactos por día (cantidad y estado predominante), sin el detalle hora a hora; al hacer clic en un día se pasa a la vista Día de esa fecha. | Servicio devuelve un `ResumenDiaCalendario` por día de la grilla (cantidad, `por_estado`, `estado_predominante` con desempate `COMPLETO` > `DISPONIBLE`). Celda con chip "N turnos" + badge de estado; cada celda es un link a `vista=dia&fecha=<día>` conservando la entidad. | `resumirDiasDelMes()`, `obtenerCalendario*()`, `grilla-mensual.tsx` |
| 3 | La vista Día muestra el mismo nivel de detalle que la vista Semana actual, pero para un único día. | `GrillaSemanal` con un solo día y los mismos `EventoCalendario` / `EventoCalendarioMateria`. | `grilla-semanal.tsx`, ambas `page.tsx` |
| 4 | Cambiar de vista conserva el profesor o materia seleccionados y navega dentro del rango relativo correspondiente (hoy en Día, esta semana en Semana, este mes en Mes). | Los links del control de vista llevan `profesorId`/`materiaId` + `vista` y **omiten `fecha`** → el servidor toma hoy en Buenos Aires y resuelve día/semana/mes actual. | `construirUrlCalendario()`, `encabezado-calendario.tsx`, `periodoDelCalendario()` |
| 5 | La acción "Hoy" vuelve al día/semana/mes actual según la vista activa. | "Hoy" = misma `vista` sin `fecha`. ‹ / › mueven 1 día, 1 semana o 1 mes. | `navegacion-calendario.tsx`, `desplazarFecha()` |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_J.md` §2.3, con las decisiones de §1.

### 3.1. Desglose en subtareas técnicas

- [x] **Helpers puros** de vista, mes, navegación y rótulos en `src/lib/calendario-semana.ts` (§4.1).
- [x] **Schema Zod** `ConsultarCalendarioQuerySchema` (`vista`, `fecha`, `semana_inicio` como alias) (§4.2).
- [x] **Consulta unificada con rango cerrado** (`listarTurnosDelCalendario()`; C todavía no publicó `listarTurnosParaCalendario()`, §1 punto 7, §4.3).
- [x] **Servicio:** `periodoDelCalendario()`, `resumirDiasDelMes()`, y `obtenerCalendarioProfesor()` / `obtenerCalendarioMateria()` con `vista` + `fecha` (§4.5).
- [x] **Tipos:** `VistaCalendario`, `ResumenDiaCalendario`, uniones por vista (§4.4).
- [x] **Route Handlers:** `vista` y `fecha` en ambos endpoints; respuesta del mes con `dias` (§4.6).
- [x] **UI compartida:** `ControlSegmentado`, `EncabezadoCalendario`, `NavegacionCalendario`, `GrillaMensual`, `CuerpoCalendario`; ajuste visual de `GrillaSemanal`; `CLASE_ESTADO` en `BloqueEventoCalendario`; `SelectorCalendario` con `vista`/`fecha` (§5).
- [x] **Páginas** `/calendario/profesor` y `/calendario/materia`: leer `vista`/`fecha`, ramificar Día/Semana/Mes, `volverA` con vista y fecha (§5.3).
- [ ] **Seed** — **no se modificó** por indicación del responsable; los datos que faltan para probar el Mes quedan en §8 (§4.0).
- [x] **Tests unitarios** de helpers, resumen del mes y servicio; test de componente de la celda del mes (§6).
- [x] **Nota de sincronización** en `spec_modulo_J.md` §2.3 (rango consultado del mes con días de relleno, `en_mes`, Día en día no operativo, estado de la migración a C).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): ver §1, "Fuera de alcance".

### 3.2. Archivos creados

| Archivo | Qué hace |
|---|---|
| `src/components/shared/control-segmentado.tsx` | Control segmentado genérico de **links** (`opciones: { etiqueta, href, activa }[]`), `nav` con `aria-current="page"` en la activa. Lo usan el control de vista y el toggle Por profesor / Por materia |
| `src/components/shared/encabezado-calendario.tsx` | Título "Calendario" + subtítulo, control de vista arriba a la derecha, fila de filtros (toggle de tipo + selector por `children`) y `NavegacionCalendario` a la derecha |
| `src/components/shared/navegacion-calendario.tsx` | "Hoy", ‹, › y rótulo del período en negrita; `aria-label` según vista ("Día anterior", "Semana siguiente", "Mes anterior"…). Reemplaza a `navegacion-semana.tsx` |
| `src/components/shared/grilla-mensual.tsx` | Grilla LUN–DOM de semanas completas con `ResumenDiaCalendario[]`; cada celda es un link a la vista Día (§5.4) |
| `src/components/shared/grilla-mensual.test.tsx` | Celda con/sin turnos, singular/plural, relleno atenuado, hoy, `href` a la vista Día (mismo patrón que `evento-calendario-materia.test.tsx`) |
| `src/components/shared/cuerpo-calendario.tsx` | Cuerpo compartido de las dos páginas: línea "Turnos de …", aviso de vacío y `GrillaSemanal` (día/semana) o `GrillaMensual` (mes) (§1 punto 12) |
| `src/lib/calendario-vistas.test.ts` | Tests de los helpers de vistas, mes, rótulos y navegación (§6) |

### 3.3. Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `src/lib/calendario-semana.ts` | Helpers nuevos (§4.1) y `navegacionDelCalendario()`. `construirUrlCalendarioProfesor/Materia` cambian `semana` por `vista` + `fecha`. `formatearRangoSemana()` se borró (solo lo usaban `navegacion-semana.tsx` y su test) |
| `src/lib/calendario-semana.test.ts` | Se quita el test de `formatearRangoSemana()` y se actualizan los de URL (`vista`/`fecha`); los casos nuevos van en `calendario-vistas.test.ts` |
| `src/server/calendario/calendario.schema.ts` | `ConsultarCalendarioQuerySchema` reemplaza a `ConsultarCalendarioProfesorQuerySchema` / `…MateriaQuerySchema` |
| `src/server/calendario/calendario.service.ts` | `listarTurnosDelCalendario()` (reemplaza a `listarTurnosAgendadosDeProfesor/DeMateria`), `eventoDeProfesor()`, `eventoDeMateria()`, `resumirDiasDelMes()`; `semanaDelCalendario()` → `periodoDelCalendario()`; firmas de `obtenerCalendarioProfesor()` / `obtenerCalendarioMateria()` con `vista` y `fecha` |
| `src/server/calendario/calendario.service.test.ts` | Reescrito sobre la consulta unificada: rango cerrado (`lte`), contrato de C, Día, Semana, Mes, coherencia entre vistas y `resumirDiasDelMes()`; los tests de alcance por rol se conservan |
| `src/types/calendario.types.ts` | `VistaCalendario`, `TurnoDelCalendario` (forma del contrato de C), `ResumenDiaCalendario`, `CalendarioProfesor` / `CalendarioMateria` como uniones por vista |
| `src/app/api/calendario/profesor/[profesorId]/route.ts` | Parseo de `vista`, `fecha`, `semana_inicio`; `vista` en la respuesta; `dias` en el mes |
| `src/app/api/calendario/materia/[materiaId]/route.ts` | Ídem |
| `src/app/(dashboard)/calendario/profesor/page.tsx` | `EncabezadoCalendario` + `CuerpoCalendario`; `key` del `Suspense` = `${profesorId}-${vista}-${consulta.desde}`; `volverA` con vista y fecha |
| `src/app/(dashboard)/calendario/materia/page.tsx` | Ídem |
| `src/components/shared/grilla-semanal.tsx` | Encabezado "MIÉ 30" con círculo de acento para hoy; horas en `font-mono` solo en punto (§1 punto 10) |
| `src/components/shared/bloque-evento-calendario.tsx` | `CLASE_ESTADO` según DESIGN §6.5, exportado (§1 punto 9) |
| `src/components/shared/selector-calendario.tsx` | Props `vista` y `fecha` en lugar de `semana` |
| `src/components/shared/navegacion-semana.tsx` | **Se elimina** (reemplazado por `navegacion-calendario.tsx`; no lo usa nadie más) |
| `docs/specs/spec_modulo_J.md` | Nota de sincronización en §2.3 |

---

## 4. Contrato Backend

### 4.0. Permiso y seed

- **Permiso:** sin cambios (`calendario:leer`).
- **Seed — no modificado en esta HU (indicación del responsable, 01/10).** Queda como pedido al dueño del seed (§8). Con el seed actual corrido el 01/10/2026, los turnos caen entre el 29/09 y el ~16/10: la vista Mes de **octubre** tiene varios días con turnos y los dos turnos pasados (`seed-turno-26`, `-27`) caen en días de relleno de esa grilla (lunes 28/09–miércoles 30/09), así que sirven para probar el relleno. Lo que falta son los casos de abajo.
- **Pedido al dueño del seed (`prisma/seed.ts` es compartido):** sumar a `TURNOS`, con el mismo mecanismo de `diaOperativo` relativo (ids nuevos `seed-turno-28` en adelante, sin modificar los existentes, que usan pagos, clase dictada y exámenes):
  1. **Turnos pasados del mes**: 3 o 4 turnos confirmados en días operativos `-4` a `-12`, para que la vista Mes del mes en curso tenga varios días con turnos (hoy solo tiene el 28 y el 29/09).
  2. **Un día con empate**: 1 `DISPONIBLE` + 1 `COMPLETO` el mismo día (→ predominante `COMPLETO`).
  3. **Un día con mayoría `COMPLETO`**: 2 `COMPLETO` + 1 `DISPONIBLE`.
  4. **Un `PENDIENTE` con profesor asignado** y un `CANCELADO` en un día que ya tenga confirmados, para verificar que no suman a `cantidad`.
  - Respetar las validaciones del propio seed (`validarDatos()`: horario del profesor, superposiciones de aula/profesor/alumno, cupo del aula). Para `COMPLETO` usar aulas chicas (p. ej. la de capacidad 10, como `seed-turno-01`).
  - Si el dueño del seed no lo suma, la prueba manual del Mes usa los turnos existentes (mes siguiente, días 01–14/10) y los casos 2–4 se cubren con los tests unitarios de `resumirDiasDelMes()`.

### 4.1. Helpers puros

**Archivo:** `src/lib/calendario-semana.ts` (se amplía; mismo criterio: fechas `AAAA-MM-DD`, aritmética `Date.UTC`, la única conversión con zona es `hoyEnZonaCentro()`).

```typescript
export const VISTAS_CALENDARIO = ["dia", "semana", "mes"] as const;
export type VistaCalendario = (typeof VISTAS_CALENDARIO)[number];
export function esVistaCalendario(valor: unknown): valor is VistaCalendario;

/** searchParams de la página -> vista y fecha efectivas (§1 punto 1). `semana` es alias legado. */
export function resolverVistaYFecha(
  params: { vista?: string; fecha?: string; semana?: string },
  hoy: string,
): { vista: VistaCalendario; fecha: string; esFechaExplicita: boolean };

export function primerDiaDelMes(fecha: string): string;                 // "2026-09-17" -> "2026-09-01"
export function ultimoDiaDelMes(fecha: string): string;                 // "2026-02-10" -> "2026-02-28"
export function desplazarMes(fecha: string, meses: number): string;     // devuelve el día 1 del mes resultante
export function desplazarFecha(vista: VistaCalendario, fecha: string, pasos: number): string; // ±1 día / semana / mes

/** Grilla del mes: lunes de la semana del día 1 a domingo de la semana del último día. */
export function grillaDelMes(fecha: string): { desde: string; hasta: string; semanas: string[][] }; // 5 o 6 semanas × 7 fechas

/** ¿`fecha` está en la misma vista que hoy? (para `aria-current` del botón Hoy) */
export function esPeriodoActual(vista: VistaCalendario, fecha: string, hoy: string, diasOperativos: readonly DiaSemanaValor[]): boolean;

export const ETIQUETA_DIA_CORTA: Record<DiaSemanaValor, string>;        // "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"
export function diaSemanaDeFecha(fecha: string): DiaSemanaValor;

/** Rótulos del período (§5.1). */
export function formatearDiaLargo(fecha: string): string;              // "Miércoles 30 de septiembre de 2026"
export function formatearRangoCorto(desde: string, hasta: string): string; // "28 sep – 2 oct 2026"; cruce de año: "28 dic 2026 – 1 ene 2027"
export function formatearMes(fecha: string): string;                    // "Septiembre 2026"
```

- Nombres de mes y día en tablas fijas en español (sin `Intl` para el texto: resultado determinista en tests y en el servidor).
- `desplazarMes()` siempre devuelve el día 1 (evita el problema 31/01 + 1 mes).
- `construirUrlCalendario()` no cambia; las variantes `construirUrlCalendarioProfesor({ profesorId?, vista?, fecha? })` / `…Materia({ materiaId?, vista?, fecha? })` reemplazan el parámetro `semana`.

### 4.2. Schema Zod

**Archivo:** `src/server/calendario/calendario.schema.ts` (texto de `spec_modulo_J.md` §2.3).

```typescript
export const VISTAS_CALENDARIO = ["dia", "semana", "mes"] as const; // reexportado desde @/lib/calendario-semana
export const ConsultarCalendarioQuerySchema = z.object({
  vista: z.enum(VISTAS_CALENDARIO).default("semana"),
  fecha: fechaCalendarioValidaSchema.optional(),         // por defecto, hoy (Buenos Aires)
  semana_inicio: fechaCalendarioValidaSchema.optional(), // alias legado: vista=semana&fecha=<valor>
});
export type ConsultarCalendarioQuery = z.infer<typeof ConsultarCalendarioQuerySchema>;
```

Si vienen `fecha` y `semana_inicio`, gana `fecha`. Si viene solo `semana_inicio` sin `vista`, la vista es `semana`.

### 4.3. Lectura de turnos

**Opción A (si C ya publicó `listarTurnosParaCalendario()` en `turno.publico.ts`):** `calendario.service.ts` la llama con `{ desde, hasta, profesorId?, materiaId? }` y mapea campo a campo según la tabla de correspondencia de `spec_modulo_J.md` §2 ("Convenciones generales"). Se borran las consultas a `prisma.turno` y el `TODO(Regla N.° 3)`; se cierra la excepción en las notas de §2.1 y §2.2 de la spec.

**Opción B (default si no existe):** una sola consulta interna con el contrato de C, para que la migración sea cambiar el cuerpo:

```typescript
// calendario.service.ts — TODO(Regla N.° 3) sigue vigente
async function listarTurnosDelCalendario(filtro: {
  desde: string; // "AAAA-MM-DD", inclusivo
  hasta: string; // "AAAA-MM-DD", inclusivo
  profesorId?: string;
  materiaId?: string;
}): Promise<FilaCalendario[]>;
```

- `where: { profesorId?, materiaId?, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, fechaTurno: { gte: desde, lte: hasta } }` — rango **cerrado**, sin sumar un día (`spec_modulo_J.md` §2.3 punto 1). La lista positiva `ESTADOS_CALENDARIO` no cambia: `CANCELADO` y `PENDIENTE` quedan afuera (§3.1, §3.6).
- `select` = unión de lo que hoy piden las dos consultas (materia, profesor, aula, alumnos ordenados, `_count.alumnos`, `cupoMaximoTurno`, `prioridadTurno`).
- Orden: fecha, hora, apellido/nombre del profesor, id (el de C §2.15 y el de HU-J-02).
- `listarTurnosAgendadosDeProfesor()` / `…DeMateria()` pasan a ser mapeos de esas filas a `EventoCalendario` / `EventoCalendarioMateria` (sin cambiar la forma del evento).

### 4.4. Tipos

**Archivo:** `src/types/calendario.types.ts`

```typescript
export type VistaCalendario = "dia" | "semana" | "mes";

export type ResumenDiaCalendario = {
  fecha: string;                        // "AAAA-MM-DD"
  en_mes: boolean;                      // false = día de relleno de la grilla
  cantidad: number;                     // DISPONIBLE + COMPLETO
  por_estado: { DISPONIBLE: number; COMPLETO: number };
  estado_predominante: "DISPONIBLE" | "COMPLETO" | null;
  prioridad_maxima: PrioridadTurno | null;
};

type PeriodoConEventos = { vista: "dia" | "semana"; rango: RangoSemana; dias: DiaDeSemana[]; horario: ParametrosGrilla };
type PeriodoMes = { vista: "mes"; rango: RangoSemana /* día 1 – último día */; dias: ResumenDiaCalendario[] };

export type CalendarioProfesor =
  | (PeriodoConEventos & { profesor: …; eventos: EventoCalendario[] })
  | (PeriodoMes & { profesor: … });
export type CalendarioMateria =
  | (PeriodoConEventos & { materia: MateriaCalendario; eventos: EventoCalendarioMateria[] })
  | (PeriodoMes & { materia: MateriaCalendario });
```

`RangoSemana` se puede renombrar a `RangoCalendario` (alias para no romper imports).

### 4.5. Servicio del módulo J

**Archivo:** `src/server/calendario/calendario.service.ts`

**`periodoDelCalendario(vista, fecha)`** (reemplaza a `semanaDelCalendario(lunes)`):
1. `obtenerParametrosHorarioOperativo()`.
2. Según la vista:
   - `dia`: `rango = consulta = [fecha, fecha]`; `dias = [{ fecha, dia: diaSemanaDeFecha(fecha) }]`.
   - `semana`: `lunes = lunesDeLaSemana(fecha)`; `rango = consulta = rangoDeLaSemana(lunes, diasOperativos)`; `dias = diasOperativosDeLaSemana(…)` (idéntico a HU-J-01).
   - `mes`: `rango = [primerDiaDelMes(fecha), ultimoDiaDelMes(fecha)]`; `consulta = grillaDelMes(fecha)` (con días de relleno).
3. Devuelve `{ vista, rango, consulta: { desde, hasta }, dias?, horario? }`.

**`resumirDiasDelMes(eventos, grilla, mes)`** — pura, exportada para tests (§3.5 de la spec: agrega en memoria el resultado de la misma consulta):
- Un ítem por cada fecha de `grilla.semanas` (relleno incluido, `en_mes` según el mes).
- `por_estado` siempre con las dos claves; `cantidad` = suma.
- `estado_predominante`: mayor conteo; empate → `COMPLETO`; `null` si `cantidad = 0`.
- `prioridad_maxima`: `URGENTE` > `ALTA` > `NORMAL`; `null` sin turnos.

**`obtenerCalendarioProfesor({ usuario, profesorIdSolicitado, vista, fecha, rechazarAjeno })`** y **`obtenerCalendarioMateria({ usuario, materiaId, vista, fecha })`**:
- Alcance por rol **sin cambios** (`resolverProfesorDeLaAgenda()`, `resolverFiltroProfesorDeMateria()` + `obtenerOpcionMateriaActiva()`), en el mismo orden que hoy (el `403` del Profesor sigue antes de mirar la materia).
- Consulta con `periodo.consulta` → para `dia`/`semana` devuelven `eventos`; para `mes`, `dias: resumirDiasDelMes(…)`.

### 4.6. Route Handlers

**`GET /api/calendario/profesor/[profesorId]`** y **`GET /api/calendario/materia/[materiaId]`**:
- `ConsultarCalendarioQuerySchema.safeParse({ vista, fecha, semana_inicio })` de los searchParams → `400 VALIDACION` con `flattenError` (Regla N.° 6).
- `fecha` efectiva = `fecha ?? semana_inicio ?? hoyEnZonaCentro()`.
- Éxito → `200 { data, error: null }`:
  - `dia` / `semana`: `{ profesor|materia, vista, rango, eventos }` (forma de §2.1/§2.2 + `vista`).
  - `mes`: `{ profesor|materia, vista: "mes", rango, dias }` (forma de §2.3 punto 4, con `en_mes`).
- Errores sin cambios respecto de HU-J-01/J-02 (`403 SIN_PERMISO`, `404 PROFESOR_NO_ENCONTRADO` / `MATERIA_NO_ENCONTRADA`, `500 ERROR_INTERNO`).

| Caso nuevo | Status |
|---|---|
| `?vista=anio` | `400 VALIDACION` (`campos.vista`) |
| `?vista=mes&fecha=2026-02-31` | `400 VALIDACION` (`campos.fecha`) |
| `?semana_inicio=2026-09-30` (sin `vista`) | `200`, `vista: "semana"`, mismo resultado que hoy |
| Profesor con `profesorId` ajeno y `vista=mes` | `403 SIN_PERMISO` (el alcance no depende de la vista) |

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md` (regla no negociable: nada de hex ni colores default de Tailwind). Feedback: no hay mutaciones, así que no aplica toast ni banner (DESIGN §6).

### 5.1. Diseño de referencia (UI)

**Encabezado (común a las tres vistas)** — `EncabezadoCalendario`:
- Título "Calendario" (`h1`, `text-lg font-semibold`) + subtítulo existente de cada pantalla en `text-sm text-muted-foreground` ("Agenda por profesor" / "Mi agenda" / "Agenda por materia" / "Mis turnos por materia").
- Arriba a la derecha, alineado con el título: control segmentado **Día | Semana | Mes** (`ControlSegmentado`). Mismo estilo que el toggle "Por profesor | Por materia": contenedor `bg-muted rounded-md p-1`, opciones `text-sm text-muted-foreground px-3 py-1 rounded-sm`, la activa `bg-card text-foreground font-semibold shadow-xs`, foco `focus-visible:ring-2 ring-ring`. Semana por defecto.
- Fila de filtros:
  - Izquierda: toggle "Por profesor | Por materia" (§1 punto 8) y el selector existente (`SelectorCalendario`, p. ej. "Profesor  Laura Méndez ▾"). Ambos se conservan al cambiar de vista.
  - Derecha: botón "Hoy" (`buttonVariants({ variant: "outline", size: "sm" })`), botones ‹ y › (`size: "icon"`, con `aria-label`), y el rótulo del período en `font-semibold`.
- Rótulo según vista:
  - Día → "Miércoles 30 de septiembre de 2026"
  - Semana → "28 sep – 3 oct 2026" (con los días operativos actuales, LUN–VIE: "28 sep – 2 oct 2026")
  - Mes → "Septiembre 2026"
- ‹ / › mueven 1 día, 1 semana o 1 mes según la vista activa. "Hoy" lleva `aria-current="date"` si ya se está viendo el período actual.
- El rótulo va en un elemento con `aria-live="polite"` (como hoy `NavegacionSemana`).

**Vista Semana (la actual; sin cambios de comportamiento)**
- Columnas por día operativo (LUN a SÁB en el diseño; hoy LUN–VIE por configuración) con nombre corto en mayúsculas y número; **hoy** con el número dentro de un círculo `bg-brand-accent text-foreground` (§1 punto 10).
- Columna de horas en `font-mono` (08:00, 09:00, …), grilla hora a hora (líneas cada `granularidadMinutos`, etiqueta en las horas en punto).
- Bloques de turno sin cambios (`EventoCalendario` / `EventoCalendarioMateria`), con el color de estado de DESIGN §6.5 (§1 punto 9).

**Vista Día**
- Misma grilla y nivel de detalle que Semana, **una sola columna a todo el ancho**.
- Encabezado: "MIÉ" + número (círculo de acento si es hoy).
- Mismos bloques de turno y mismo comportamiento al tocar un turno (hoy: detalle con `?volver=`; el resumen en `Dialog` queda pendiente, §1 punto 11).
- Sin turnos: "Agenda sin turnos" / "No hay turnos para la materia seleccionada" sobre la grilla vacía, como en Semana.

**Vista Mes** — `GrillaMensual`:
- Grilla de 7 columnas **LUN a DOM**; encabezados en mayúsculas `text-xs font-medium text-muted-foreground`; semanas completas.
- Días de relleno del mes anterior/siguiente: fondo `bg-muted`, número `text-muted-foreground`. Si tienen turnos, se muestran igual.
- Celda: `bg-card border border-border`, alto mínimo fijo (`min-h-24`), número del día arriba a la izquierda en `font-mono`; **hoy** dentro de una pastilla `bg-brand-accent text-foreground rounded-full px-2`.
- Si hay turnos, debajo del número:
  - Chip oscuro "1 turno" / "N turnos": `bg-primary text-primary-foreground font-semibold text-xs rounded-sm px-1.5` (azul petróleo; el "texto blanco" del diseño es el Marfil de `--primary-foreground`).
  - Debajo, badge chico con el estado predominante: `CLASE_ESTADO` (Disponible `bg-success text-success-foreground`, Completo `bg-primary text-primary-foreground`) + `ICONO_ESTADO` + texto.
- Días sin turnos: solo el número.
- Cada celda es un `Link` a `vista=dia&fecha=<día>` conservando profesor/materia, con `aria-label` completo ("Miércoles 30 de septiembre de 2026: 3 turnos, mayoría Disponible. Ver día") y foco visible. Hover `bg-accent`.
- Sin detalle hora a hora.
- Sin turnos en todo el mes: `CalendarioVacio` arriba de la grilla, como en Semana.

**Notas de diseño**
- **Decisión de diseño:** Semana muestra solo los días operativos (LUN–SÁB en el diseño, LUN–VIE con la configuración actual) y Mes siempre LUN–DOM (grilla mensual completa). Los sábados/domingos no operativos del mes se ven como días normales sin turnos (no se atenúan: el atenuado queda reservado a los días de relleno).
- Tokens de color, tipografía, radios (`rounded-md` contenedores, `rounded-sm` chips) y bordes (`border-border`) de `DESIGN.md`; no se inventan colores.
- **Responsive:**
  - `< sm`: el control Día/Semana/Mes baja debajo del título (`flex-col sm:flex-row`); la fila de filtros apila izquierda y derecha.
  - Mes en `< sm`: el chip muestra solo el número ("3", con `aria-label` "3 turnos") y el badge solo el ícono (texto en `sr-only`). Celdas con `min-h-16`.
  - Día y Semana mantienen `overflow-x-auto` de `GrillaSemanal`.

### 5.2. Componentes compartidos

| Componente | Tipo | Props principales |
|---|---|---|
| `ControlSegmentado` | Server | `etiqueta` (aria-label del `nav`), `opciones: { etiqueta, href, activa }[]` |
| `EncabezadoCalendario` | Server | `subtitulo`, `vista`, `hrefsVista: Record<VistaCalendario, string>`, `tipo?: { profesor: string; materia: string; activo }`, `navegacion?: { rotulo, hrefAnterior, hrefHoy, hrefSiguiente, esPeriodoActual, vista }`, `children` (selector) |
| `NavegacionCalendario` | Server | `vista`, `rotulo`, `hrefAnterior`, `hrefHoy`, `hrefSiguiente`, `esPeriodoActual` |
| `GrillaMensual` | Server | `dias: ResumenDiaCalendario[]`, `hoy`, `hrefDia: (fecha) => string` (armado en la página; no se pasan funciones a componentes cliente) |
| `SelectorCalendario` | Cliente | Igual que hoy, con `vista` y `fecha?` en lugar de `semana` |

### 5.3. Páginas

`src/app/(dashboard)/calendario/profesor/page.tsx` y `src/app/(dashboard)/calendario/materia/page.tsx`:
1. `exigirPermiso("calendario:leer")` (sin cambios).
2. searchParams: `profesorId` / `materiaId`, `vista`, `fecha`, `semana` → `resolverVistaYFecha(params, hoyEnZonaCentro())`.
3. Rótulo y links: `desplazarFecha(vista, fecha, ±1)` para ‹ ›; "Hoy" y el control de vista sin `fecha`. Para el rótulo de la semana se usa `rangoDeLaSemana()` (ya calculado hoy en la página).
4. `<Suspense key={`${entidad}-${vista}-${fecha}`}>` con el mismo `CargandoCalendario` ("Cargando agenda" / "Cargando turnos de la materia").
5. Dentro: `obtenerCalendario*({ …, vista, fecha })` → si `vista === "mes"`, `GrillaMensual`; si no, `GrillaSemanal` con `calendario.dias` (uno en Día).
6. `volverA = construirUrlCalendario*({ entidad, vista, fecha })`.
7. Errores de negocio (`MENSAJES_POR_CODIGO`) y `error.tsx` sin cambios.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unit (`npm test`)

- `src/lib/calendario-vistas.test.ts` (nuevo, 17 tests):
  - `resolverVistaYFecha`: sin params → `semana` + hoy; `vista` inválida → `semana`; `fecha` inválida → hoy; `semana` legado → `vista=semana`; `fecha` gana sobre `semana`.
  - `primerDiaDelMes` / `ultimoDiaDelMes`: febrero común y bisiesto (2028), meses de 30 y 31.
  - `desplazarMes`: 31/01 + 1 → 01/02; diciembre + 1 → enero del año siguiente; −1 en enero.
  - `desplazarFecha` en las tres vistas.
  - `grillaDelMes`: septiembre 2026 → 31/08 a 04/10 (5 semanas); junio 2026 empieza en lunes; agosto 2026, 6 semanas (27/07 a 06/09).
  - `periodoDeLaVista` (día en sábado, semana LUN–VIE, mes con consulta de grilla completa).
  - `formatearDiaLargo`, `formatearRangoCorto` (cruce de mes y de año), `formatearMes`, `rotuloDelPeriodo`, `diaDeLaFecha`.
  - `esPeriodoActual` en las tres vistas.
  - `navegacionDelCalendario`: cambio de vista y "Hoy" sin `fecha` y conservando el profesor; ‹ / › por vista.
- `src/lib/calendario-semana.test.ts` (16 tests): se quitó `formatearRangoSemana` y se actualizaron los de URL.
- `src/server/calendario/calendario.service.test.ts` (reescrito, 39 tests; `prisma`, módulo D, L y parámetros mockeados):
  - `listarTurnosDelCalendario`: `where` con `{ gte: desde, lte: hasta }` (sin sumar un día); día con `desde = hasta`; materia + profesor combinados; forma del contrato de C; orden; `PENDIENTE` y `CANCELADO` excluidos (el mock aplica el `where`).
  - `eventoDeProfesor` / `eventoDeMateria`: forma de la spec, grupal con "; ", "—", ocupación, invariante de cupo.
  - `resumirDiasDelMes`: 35 ítems con `en_mes`, día vacío (`null`/`null`), mayoría `DISPONIBLE`, mayoría `COMPLETO`, **empate → `COMPLETO`**, `prioridad_maxima`, relleno.
  - `obtenerCalendarioProfesor`: semana (regresión de HU-J-01), día en sábado, mes con grilla completa y sin `eventos`, **las tres vistas cuentan los mismos turnos para una fecha**.
  - Alcance por rol sin cambios; Profesor con `profesorId` ajeno → `SIN_PERMISO` en día, semana y mes.
  - `obtenerCalendarioMateria`: semana, mes, Profesor filtrado por su ficha en mes, rechazos sin consultar.
- `src/components/shared/grilla-mensual.test.tsx` (nuevo, 4 tests, jsdom): LUN–DOM y 35 links a `…vista=dia&fecha=<día>` con el profesor; "1 turno" / "3 turnos" con texto, ícono y `bg-success`; día vacío solo con el número; relleno `bg-muted` con sus turnos; hoy con `aria-current="date"` y pastilla `bg-brand-accent`.
- `src/components/shared/evento-calendario-materia.test.tsx`: sin cambios, pasa con el nuevo `CLASE_ESTADO`.

### Verificación estática y build

| Comando | Resultado (01/10/2026) |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores ni warnings |
| `npm test` | ✅ 90 archivos pasan y 10 se omiten (tests contra Postgres real); `1196 passed \| 49 skipped`. Calendario: 81/81 |
| `npm run build` | ✅ compila; `/calendario/profesor`, `/calendario/materia` y las dos APIs siguen como rutas dinámicas |

### Nivel 2 — Postman / curl

**No ejecutado en esta implementación** (requiere `npm run dev`, Postgres con el seed y sesiones reales). Casos a correr:

| Caso | Esperado |
|---|---|
| `GET /api/calendario/profesor/{Giménez}` (sin params) | `200`, `vista: "semana"`, mismo rango y eventos que antes de la HU |
| `?vista=dia&fecha=<día con turno>` | `200`, `rango.desde = rango.hasta`, solo eventos de ese día |
| `?vista=mes` | `200`, `vista: "mes"`, `rango` = mes actual, `dias` 35/42 con `en_mes` |
| `?vista=mes&fecha=<mes con turnos>` | `dias` con `cantidad` > 0 en los días con turnos; suma de `cantidad` = cantidad de eventos de esos días en `vista=semana` |
| `?vista=anio` / `?fecha=2026-02-31` | `400 VALIDACION` |
| `?semana_inicio=2026-09-30` | `200`, igual que HU-J-01 |
| Profesor con `profesorId` ajeno, `vista=mes` | `403 SIN_PERMISO` |
| `GET /api/calendario/materia/{Matemática}?vista=mes` como Gerente y como Profesor que la dicta | `200`; el Profesor solo cuenta sus turnos |
| Alumno / sin sesión | `403` / `401` |

### Nivel 3 — BD / TablePlus

**No ejecutado.** Casos:
- Para un profesor y un mes: `SELECT "fechaTurno", "estadoTurno", COUNT(*) FROM turnos WHERE "profesorId" = … AND "fechaTurno" BETWEEN <lunes grilla> AND <domingo grilla> GROUP BY 1, 2` → coincide con `por_estado` de cada día de la API, **sin** `PENDIENTE` ni `CANCELADO`.
- Ninguna escritura: el módulo J sigue usando solo `findMany` (verificable por código: ✅).

### Prueba manual (UI) — checklist por criterio

Leyenda: **[x] (código)** = verificado por tests o revisión del código; **[ ] 🖥️** = requiere navegador.

**AC1 — control de vista**
- [x] (código) `/calendario/profesor` y `/calendario/materia` renderizan `EncabezadoCalendario` con "Día | Semana | Mes"; sin `vista` en la URL la activa es **Semana** (`resolverVistaYFecha`, test).
- [ ] 🖥️ El control se ve arriba a la derecha; la opción activa con fondo blanco y negrita, las otras sobre gris claro. Navegable con teclado y foco visible.
- [ ] 🖥️ Gerente, Mesa y Profesor ven el control en ambas pantallas.
- [ ] 🖥️ Toggle "Por profesor | Por materia" (Profesor: "Mi agenda | Por materia") cambia de pantalla conservando la vista.

**AC2 — vista Mes**
- [x] (código) Rótulo "Septiembre 2026" (`rotuloDelPeriodo`, test).
- [x] (código) Grilla LUN–DOM con semanas completas; días de relleno con `bg-muted` y número `text-muted-foreground` (`grilla-mensual.test.tsx`).
- [x] (código) Un día de relleno con turnos muestra igual chip y badge (test de componente y de servicio).
- [x] (código) Chip "1 turno" / "N turnos" y badge del estado predominante con texto e ícono (Disponible `bg-success`); días sin turnos solo con el número.
- [x] (código) Empate 1 Disponible + 1 Completo → "Completo" (`resumirDiasDelMes`, test).
- [x] (código) Sin detalle hora a hora (la vista mes no devuelve `eventos`).
- [x] (código) Hoy con `aria-current="date"` y pastilla `bg-brand-accent`.
- [x] (código) Clic en un día → `…vista=dia&fecha=<día>` con el mismo profesor/materia, también en días de relleno.
- [x] (código) **Coherencia:** las tres vistas cuentan los mismos turnos para una fecha, sin `PENDIENTE` ni `CANCELADO` (test de servicio).
- [ ] 🖥️ Revisión visual de la grilla mensual y del clic (rótulo "Jueves 1 de octubre de 2026" al abrir el día) con datos reales.

**AC3 — vista Día**
- [x] (código) Rótulo "Miércoles 30 de septiembre de 2026"; una sola columna (`dias` con un elemento, también en sábado) con la misma `GrillaSemanal` y los mismos bloques de evento.
- [ ] 🖥️ Encabezado "MIÉ 30" con círculo de acento si es hoy; la columna ocupa todo el ancho.
- [ ] 🖥️ Dos turnos superpuestos del mismo día (vista por materia, Gerente) se ven lado a lado.
- [x] (código) Tocar un turno abre `/turnos/[id]?volver=…` (mismo `BloqueEventoCalendario` que Semana).

**AC4 — cambio de vista**
- [x] (código) Los links del control de vista llevan la entidad y omiten `fecha` → hoy / esta semana / este mes (`navegacionDelCalendario`, test).
- [ ] 🖥️ Recorrido real en `/calendario/profesor` y `/calendario/materia` navegando a otra semana y cambiando de vista.
- [x] (código) Rol Profesor: la página ignora `profesorId` y no renderiza selector en ninguna vista; el servicio rechaza agendas ajenas en las tres vistas (test).
- [x] (código) Cambiar el profesor/materia en el selector conserva `vista` y la `fecha` explícita (`SelectorCalendario`).

**AC5 — "Hoy", ‹ y ›**
- [x] (código) Día ±1 día, Semana ±1 semana, Mes ±1 mes (incluido diciembre → enero); "Hoy" = misma vista sin `fecha` (tests de `desplazarFecha` y `navegacionDelCalendario`).
- [x] (código) Rótulos de los tres formatos (tests).
- [ ] 🖥️ Resaltado de hoy en las tres vistas (círculo en Día/Semana, pastilla en Mes) y que desaparezca al navegar fuera del período actual.

**Regresión y generales**
- [ ] 🖥️ Volver del detalle de un turno (atrás del navegador) conserva entidad, vista y fecha. (El link "Volver" de `/turnos/[id]` sigue siendo pendiente del módulo C, §8.)
- [x] (código) Un link viejo `?semana=2026-09-21` abre la vista Semana de esa semana (`resolverVistaYFecha`, test).
- [x] (código) `?vista=xyz` o `?fecha=basura` abre Semana / hoy sin romper (test).
- [ ] 🖥️ Indicador de carga al cambiar de vista; "Agenda sin turnos" en un día/semana/mes vacío; error con Reintentar.
- [ ] 🖥️ Responsive (≈375 px): el control de vista baja debajo del título; en Mes los chips muestran solo el número y el badge solo el ícono.
- [ ] 🖥️ Colores de estado en los bloques de Semana/Día: Disponible verde claro, Completo `--primary` (DESIGN §6.5).

**Evidencia esperada:** capturas de las tres vistas (profesor y materia), vista Mes con relleno, vista Día desde un clic del mes, y en ancho de celular.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento (§0). *(Implementado de corrido por pedido del responsable; los "A CONFIRMAR" se resolvieron en la consigna, §1 puntos 7, 8 y 11.)*
- [x] AC1 — control Día/Semana/Mes en ambas pantallas, Semana por defecto. *(Falta revisión visual.)*
- [x] AC2 — Mes con chip de cantidad y estado predominante (empate → Completo), sin detalle horario; clic → Día de esa fecha. *(Falta revisión visual.)*
- [x] AC3 — Día con el mismo detalle que Semana para un solo día.
- [x] AC4 — cambio de vista conserva profesor/materia y abre hoy / esta semana / este mes.
- [x] AC5 — "Hoy", ‹ y › según la vista activa.
- [x] Una sola consulta con rango cerrado para las tres vistas; filtro `DISPONIBLE`/`COMPLETO` en la query (§3.1, §3.5 de la spec).
- [x] Alcance por rol sin cambios, verificado en servidor en las tres vistas (tests).
- [x] Fechas en `America/Argentina/Buenos_Aires` y semana lunes–domingo con días operativos (criterio de HU-J-01).
- [x] Solo tokens de `DESIGN.md`; estados con texto e ícono, no solo color.
- [ ] Regla N.° 3: excepción `TODO(Regla N.° 3)` vigente (C no publicó `listarTurnosParaCalendario()`). **Falta avisar al dueño de C** (§8).
- [x] `tsc`, lint, `npm test` y build sin errores.
- [ ] Niveles 2 y 3 ejecutados con evidencia.
- [ ] Prueba manual en navegador (checklist §6) y en ancho de celular.
- [x] Seed: no se modificó (indicación del responsable); la limitación y el pedido quedan documentados (§4.0, §8).
- [x] Nota de sincronización en `spec_modulo_J.md` §2.3.
- [ ] PR acotado a HU-J-03.

---

## 8. Supuestos / Pendientes

### Supuestos tomados (por contradicción o falta de dato en la spec)

1. **Rango consultado del mes con días de relleno.** `spec_modulo_J.md` §2.3 dice que el mes va del primer al último día calendario y que `dias` incluye "todos los días del mes". El diseño pide que los días de relleno muestren sus turnos. Se consulta la grilla completa (lunes de la semana del 1 a domingo de la semana del último día), `rango` sigue siendo el mes y cada ítem de `dias` lleva `en_mes`. Es aditivo: los días del mes tienen exactamente la forma de la spec. Registrado como nota de sincronización en §2.3 de la spec.
2. **Días no operativos en el Mes.** La spec dice que la UI "atenúa" los días sin turnos, incluidos los no operativos. El diseño de referencia reserva el atenuado para los días de relleno y deja los días sin turnos con solo el número. Se sigue el diseño, que es más específico.
3. **Semana LUN–SÁB del diseño vs. días operativos.** HU-J-01 (§1 punto 3) ya resolvió que las columnas salen de `dias_operativos`. Se mantiene: con la configuración actual la semana es LUN–VIE y el rótulo "28 sep – 2 oct 2026".
4. **"Vista Semana sin cambios" vs. encabezado nuevo.** El diseño describe para Semana el encabezado "nombre corto + número con círculo de acento" y horas en monoespaciada, distinto del anterior ("Lunes 21/09", columna de hoy en `bg-secondary`). Se ajustó solo el aspecto del encabezado y de la columna de horas (es el mismo componente que usa Día), sin cambiar lógica ni datos. El nombre completo del día queda en el `title` del encabezado y en el `aria-label` de cada columna.
5. **Colores de estado.** Hoy el calendario pintaba los dos estados de verde (`variant="success"`), lo que contradecía DESIGN §6.5 (Completo = `--primary`). Se adoptó §6.5 en las tres vistas (`CLASE_ESTADO`). Consecuencia: en el Mes el chip "N turnos" y el badge "Completo" comparten `--primary`; se distinguen por forma, ícono y texto.
6. **Chip "texto blanco".** Se usa `text-primary-foreground` (Marfil), el token de texto sobre `--primary`; no se agrega blanco puro.
7. **Cambio de vista vuelve a hoy.** Coincide con el AC4 y con la Revisión 2.1 de la spec (§2.3 punto 6). La única transición con fecha distinta de hoy es el clic en un día del mes.
8. **Día no operativo.** La spec no lo define. Se muestra el día igual (columna vacía), para que "Hoy" en domingo y el clic en un sábado del mes no fallen.
9. **‹ / › en Día** mueven un día calendario, no saltan días no operativos (el diseño dice "1 día").
10. **`prioridad_maxima`** se devuelve en la API del mes (lo pide la spec) pero la celda del mes no la muestra: el diseño de referencia no la incluye. Mejora posible: ícono `Flag` junto al chip.
11. **(Nuevo, implementación) Etiqueta de horas.** La grilla mantiene filas de `granularidadMinutos` (30) para posicionar turnos de media hora, pero solo rotula las horas en punto. Si el centro abriera a una hora no redonda (p. ej. 08:30), la primera fila quedaría sin rótulo.
12. **(Nuevo, implementación) "Agenda sin turnos" en el Mes** se muestra si no hay turnos en los días **del mes**; los turnos de días de relleno no cuentan para ese aviso.
13. **(Nuevo, implementación) Respuesta de la API** con `vista` además de lo que pedía la spec, para que el cliente distinga `eventos` de `dias`.
14. **(Nuevo, implementación) `RangoSemana`** se conserva como tipo y se agrega el alias `RangoCalendario`.
15. **(Cambio posterior, 01/10, pedido del responsable) Sidebar con un único ítem "Calendario".** Reemplaza al grupo desplegable "Calendario" con los subítems "Agenda por profesor" / "Agenda por materia" ("Mi agenda" / "Mis turnos por materia" para Profesor), que ya no tenían sentido con el toggle "Por profesor | Por materia" de la pantalla. Es un ítem de primer nivel con el mismo ícono (`CalendarDays`), lleva a `/calendario/profesor` (para el rol Profesor, su propia agenda) y queda activo en `/calendario/profesor` y `/calendario/materia` con cualquier query param (`prefijoActivo: "/calendario"`). Lo ven Mesa de Entrada, Gerente y Profesor, igual que antes. Deja sin efecto el "Cambios en `Sidebar.tsx`" de "Fuera de alcance" (§1). Archivos: `src/components/layout/Sidebar.tsx` y `src/components/layout/SidebarNav.tsx`.

### A coordinar con el dueño de turnos (módulo C)

1. **`listarTurnosParaCalendario()`** está contractualizada en `spec_modulo_C.md` §2.15 pero no implementada en `turno.publico.ts`. HU-J-03 dejó `listarTurnosDelCalendario()` con su misma firma y forma de dato: cuando C la publique, se reemplaza el cuerpo y se cierra la excepción a la Regla N.° 3.
2. **`?volver=` en `/turnos/[id]`** (pendiente heredado de HU-J-01 §8 punto 1): los links del calendario ahora llevan también `vista` y `fecha`. Si C ya acepta `volver` de `/calendario`, no hay nada más que hacer.

### A coordinar con el dueño del seed (no se tocó `prisma/seed.ts`)

- Faltan datos para probar en la vista Mes, con datos reales: un día con **empate** `DISPONIBLE`/`COMPLETO`, un día con **mayoría `COMPLETO`**, un **`PENDIENTE` con profesor asignado** y un `CANCELADO` en un día que ya tenga confirmados, y turnos pasados repartidos en el mes en curso (§4.0). Hoy esos casos solo los cubren los tests unitarios.
- Con el seed actual corrido el 01/10/2026, la vista Mes útil es **octubre** (los turnos van del 29/09 al ~16/10); septiembre solo tiene los dos pasados.
- Recordatorio heredado (HU-J-01 §8): `fechaOperativa()` del seed usa la hora local del proceso, no Buenos Aires.

### Otros pendientes

- **Quick-view `Dialog`** (`spec_modulo_J.md` §2.3 punto 7, mapa de pantallas §4): **fuera de esta HU** por decisión del responsable (§1 punto 11). Si se suma, el bloque de turno pasa a abrir el `Dialog` (consulta `GET /api/turnos/[id]`, `turnos:leer`) con "Ver detalle completo" → `/turnos/[id]?volver=…`, en Día y Semana por igual.
- **Verificación en navegador** y **Niveles 2/3** (§6).

---

## 9. Estado de implementación (01/10/2026)

### Hecho

- Vistas Día, Semana y Mes en `/calendario/profesor` y `/calendario/materia`, con control segmentado Día | Semana | Mes, toggle Por profesor | Por materia, "Hoy", ‹ › y rótulo por vista.
- URL `?<entidad>Id=&vista=&fecha=`, con `?semana=` como alias.
- Una sola consulta con rango cerrado (`listarTurnosDelCalendario()`, contrato de C §2.15); mes agregado en memoria (`resumirDiasDelMes()`) con `en_mes`, estado predominante (empate → Completo) y prioridad máxima.
- APIs con `vista`, `fecha` y `semana_inicio`; mes con `dias`.
- Colores de estado de DESIGN §6.5 en bloques y celdas; resaltado de hoy en las tres vistas; responsive del encabezado y de la grilla mensual.
- Componentes compartidos: `control-segmentado`, `encabezado-calendario`, `navegacion-calendario` (reemplaza a `navegacion-semana`, eliminado), `grilla-mensual`, `cuerpo-calendario`.
- Nota de sincronización en `spec_modulo_J.md` §2.3.
- Sidebar: un único ítem "Calendario" en lugar del grupo con dos subítems (§8, supuesto 15).

### Verificación

- `tsc` ✅, lint ✅, `npm test` ✅ (1196 passed / 49 skipped; calendario 81/81), `npm run build` ✅.

### Pendiente (de otros dueños)

- Módulo C: `listarTurnosParaCalendario()` y `?volver=` desde `/calendario` en `/turnos/[id]`.
- Seed: datos para los casos del Mes (§8).

### Pendiente (de esta HU)

- Prueba manual en navegador (ítems 🖥️ de §6) y en ancho de celular.
- Niveles 2 y 3 con sesiones reales.
- Avisar al dueño de C por la excepción a la Regla N.° 3 que sigue vigente.
