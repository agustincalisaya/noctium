# TASK: HU-J-02 — Visualizar calendario por materia

**Módulo:** J (Visualizar calendario)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_J.md` §1, §2.2 y §3.1–3.4 (con la nota de sincronización de §2.1, que aplica igual a esta vista) · `docs/specs/spec_modulo_L.md` (servicios públicos de Materias) · `docs/tasks/Sprint 1/HU-J-01.md` (grilla, helpers y decisiones que se reutilizan) · backlog vigente (Excel) HU-J-02, criterios de aceptación 1-6
**RBAC:** `calendario:leer` — **ya existe** (HU-J-01) para `MESA_ENTRADA`, `GERENTE` y `PROFESOR`. No se agregan permisos. `ALUMNO` no lo tiene → `403`. `src/proxy.ts` ya incluye `/calendario/:path*` en el `matcher`.
**Schema:** sin migración. `Turno` (`fechaTurno`, `horaInicioTurno`, `duracionMinutosTurno`, `cupoMaximoTurno`, `estadoTurno`, `materiaId`, `profesorId`, `aulaId`), `TurnoAlumno` (N:M), `Materia` (`nombreMateria`, `codigoMateria?`, `activaMateria`) y `Profesor.usuarioId` ya tienen todo lo necesario. La ocupación `x/y` sale de datos existentes (§1 punto 4). **Prohibido** agregar modelos o campos.
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (tipos en `src/types/calendario.types.ts`, schema en `src/server/calendario/calendario.schema.ts`, service en `src/server/calendario/calendario.service.ts`, componentes compartidos en `src/components/shared/`).

> **Estado de la task (24/09/2026):** **implementada** en `feature/HU-J-02`, sobre `develop` con HU-J-01 (v2, flujo nuevo de turnos) mergeada (`7b8aa25`). Ver §9 "Estado de implementación". Quedan pendientes de otros dueños: `?volver=` en `/turnos/[id]` (módulo C) y datos del seed (§8). En el working tree hay una migración sin versionar, `prisma/migrations/20260924222247/`, ajena a esta HU.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno), con especial atención a los archivos de HU-J-01 que se refactorizan para compartir (§3.3): el refactor no puede cambiar el comportamiento de `/calendario/profesor`.
- Los puntos marcados como **"A CONFIRMAR CON EL EQUIPO"** en esta task (§1 puntos 4 y 9), con la pregunta concreta.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

**Nota — implementación de corrido:** por pedido del responsable, la HU se implementó sin frenar a confirmar el relevamiento. Los dos puntos "A CONFIRMAR" (§1 puntos 4 y 9) los resolvió el responsable en la consigna; quedan registrados como default en §1 y en los supuestos.

Lo que ya encontró el relevamiento al redactar esta task (sobre `feature/HU-J-02` = `develop` en `7b8aa25`):

### 0.1. Qué deja HU-J-01 y qué se puede reutilizar

| Pieza de HU-J-01 | Ubicación | ¿Genérica hoy? | Uso en HU-J-02 |
|---|---|---|---|
| `GrillaSemanal` | `src/components/shared/grilla-semanal.tsx` | ✅ Sí. Genérica por `T extends { fecha, hora_inicio, hora_fin }` y `renderEvento`. Ya resuelve columnas por día operativo, filas del horario operativo, columna de hoy, evento con su intervalo completo (`posicionEnGrilla`) y superpuestos lado a lado (`asignarCarriles`) | **Se reutiliza tal cual**, sin cambios |
| Helpers de semana y grilla | `src/lib/calendario-semana.ts` | ✅ Sí (`hoyEnZonaCentro`, `lunesDeLaSemana`, `desplazarSemana`, `diasOperativosDeLaSemana`, `rangoDeLaSemana`, `formatearRangoSemana`, `franjasDeLaGrilla`, `posicionEnGrilla`, `asignarCarriles`, `esFechaCalendario`, `fechaISO`, `fechaCalendarioADate`, `sumarDias`) | **Se reutilizan tal cual** |
| `construirUrlCalendarioProfesor()` | `src/lib/calendario-semana.ts` | ❌ Ruta `/calendario/profesor` y parámetro `profesorId` fijos | Se generaliza (§4.1) |
| `EventoCalendario` (componente) | `src/components/shared/evento-calendario.tsx` | ⚠️ Parcial. Link al detalle con `?volver=`, `title`/`aria-label`, `Badge` con `ETIQUETA_ESTADO` e `ICONO_ESTADO` (`CalendarCheck` / `Users`) son genéricos; **las líneas de datos están fijas** (Alumno, Materia, Aula) | Se extrae la base (§5.2) |
| `NavegacionSemana` | `src/app/(dashboard)/calendario/profesor/navegacion-semana.tsx` | ❌ Vive en la carpeta de la ruta y arma los links con `construirUrlCalendarioProfesor` | Se mueve a `components/shared` y recibe los `href` ya armados (§5.2) |
| `SelectorProfesor` | `src/app/(dashboard)/calendario/profesor/selector-profesor.tsx` | ❌ Específico de profesor | Se generaliza a un selector de calendario (§5.2) |
| `CargandoAgenda`, `Aviso`, estado vacío "Agenda sin turnos" | Funciones locales de `calendario/profesor/page.tsx` | ❌ Privadas a la página, textos fijos | Se extraen con el texto por prop (§5.2) |
| `error.tsx` con Reintentar (`retry()`) | `calendario/profesor/error.tsx` | ❌ Texto fijo. Next exige un `error.tsx` por segmento de ruta | El cuerpo se extrae a un componente compartido; cada ruta conserva su `error.tsx` de 1 línea (§5.2) |
| `listarTurnosAgendadosDeProfesor()` | `src/server/calendario/calendario.service.ts` | ⚠️ `where` por `profesorId`; `select` sin profesor ni cupo; mapea al evento de profesor | Se extrae una consulta base compartida (§4.3) |
| `resolverProfesorDeLaAgenda()` | `calendario.service.ts` | ⚠️ Pensado para "de quién es la agenda"; en J-02 el profesor es un **filtro opcional** | Se reutiliza la parte "profesor propio desde la sesión" (§1 punto 3) |
| `ConsultarCalendarioProfesorQuerySchema` | `src/server/calendario/calendario.schema.ts` | ✅ Solo `semana_inicio` | Mismo shape para materia (§4.2) |
| Tipos `EventoCalendario`, `CalendarioProfesor`, `RangoSemana` | `src/types/calendario.types.ts` | ⚠️ `EventoCalendario` trae `alumno` y `materia` fijos | Se separa una base común (§4.4) |

### 0.2. Servicios públicos de otros módulos disponibles

- **Módulo L** (`src/server/materias/materia.service.ts`): `listarMateriasActivas()` → `{ idMateria, nombreMateria, codigoMateria }[]`, solo activas, orden `nombreMateria asc`; `verificarMateriaActiva(id)` → `{ idMateria } | null`. **No existe** una función que devuelva nombre y código de **una** materia activa por id (`obtenerMateriaPorId()` es el detalle de HU-L-02: trae profesores asociados y no filtra por activa).
- **Módulo D** (`src/server/profesores/profesor.service.ts`): `obtenerOpcionProfesorDeUsuario(usuarioId)` (ficha vinculada a la cuenta, sin filtrar por activo), agregado en HU-J-01.
- **Módulo C:** sigue **sin** exponer `listarTurnosAgendadosPorMateria()` (`spec_modulo_J.md` §1). Misma situación que J-01 §1 punto 7.

### 0.3. Detalle de turno y `?volver=`

Sin cambios desde HU-J-01: `src/app/(dashboard)/turnos/[id]/page.tsx:11` sigue haciendo `volver?.startsWith("/turnos?") ? volver : "/turnos"`, y lo mismo `[id]/aula/page.tsx:8`, `[id]/configuracion/page.tsx:5` y `[id]/participantes/page.tsx`. **Un `?volver=/calendario/materia?...` se descarta** y el link del detalle lleva a `/turnos`. Es el mismo pendiente de J-01 §8 punto 1 (módulo C).

### 0.4. Ocupación en el modelo

`Turno.cupoMaximoTurno Int` (HU-C-03, "cantidad máxima de alumnos inscriptos") + `TurnoAlumno` N:M ("un turno grupal tiene uno o varios alumnos, hasta `Turno.cupoMaximoTurno`", `schema.prisma`). **El modelo sí soporta varios alumnos y un cupo por turno**: la ocupación `x/y` sale directo de ahí (§1 punto 4). El módulo C ya usa ese formato: `alumnos_inscriptos: \`${inscriptos}/${cupo}\`` en `turno.service.ts:213` y `:235`, y la columna "Alumnos" del listado de turnos (HU-C-01).

### 0.5. Datos del seed para probar esta vista

Ver §4.0. Resumen: **el seed actual no alcanza** para los criterios 1 (filtro del profesor con datos de dos profesores), 2 (superpuestos y ocupación `x/y` con más de un inscripto) y 3 (pendiente con profesor de la misma materia).

---

## 1. Nota de alcance — decisiones sobre puntos relevados

1. **DECISIÓN — reutilizar y compartir lo de HU-J-01, no duplicar.**
   - `GrillaSemanal` y los helpers de `calendario-semana.ts` se usan sin cambios.
   - Lo que hoy está atado a "profesor" (navegación, selector, estados de carga/vacío/error, bloque del evento, URL, consulta de turnos) se **extrae a una versión compartida** y J-01 pasa a usarla (§3.3). Regla: después del refactor, `/calendario/profesor` renderiza el mismo HTML útil y sus tests siguen verdes sin modificar sus aserciones de comportamiento.
   - No se copia `page.tsx` de profesor a materia con cambios de texto: la página de materia es chica porque todo lo común vive en `components/shared` y `lib`.

2. **DECISIÓN — solo turnos confirmados, en la query (criterio 3).**
   - Mismo filtro que J-01: `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` en el `where` de Prisma, lista positiva. Un `PENDIENTE` con profesor, alumnos o aula cargados **no aparece** (`spec_modulo_J.md` §3.1).
   - La lista de estados se define **una sola vez** en `calendario.service.ts` (constante `ESTADOS_CALENDARIO`) y la usan las dos vistas. Hoy J-01 tiene el literal inline; se reemplaza por la constante.

3. **DECISIÓN — alcance por rol resuelto en el servidor (criterio 1).**
   - `MESA_ENTRADA` / `GERENTE`: todos los turnos confirmados de la materia en la semana, de cualquier profesor.
   - `PROFESOR`: **solo sus propios turnos** de la materia. El `profesorId` del filtro sale **siempre** de la ficha vinculada a la sesión (`obtenerOpcionProfesorDeUsuario(usuario.id)`), nunca de la URL ni del body. Se agrega al `where` (`profesorId: propio.id`) en el servicio, no en la UI. No hay forma de pedir "sin filtro" con rol Profesor.
     - **Corrección a la spec:** `spec_modulo_J.md` §2.2 paso 2 dice `profesorId: session.sub`. `session.sub` es el id de **Usuario**, no de **Profesor**; hay que mapearlo por `Profesor.usuarioId` (igual que J-01). Se documenta en la nota de sincronización (§3.1).
     - Profesor sin ficha vinculada → `PROFESOR_SIN_FICHA` (`403 SIN_PERMISO` en la API, aviso "Tu cuenta no tiene una ficha de profesor vinculada" en la página), mismo criterio que J-01.
     - **(Actualizado en la implementación, ver punto 9)** Un profesor solo puede consultar materias activas **que tiene asociadas** (HU-D-03). Si pide una que no dicta → `SIN_PERMISO` (`403` en la API, aviso "No tenés permisos para ver los turnos de esa materia" en la página), sin revelar si la materia existe. Dentro de una materia que dicta, igual se filtra por su propio `profesorId`.
   - Cualquier otro rol (`ALUMNO`): `403 SIN_PERMISO`, ya desde `withPermission("calendario:leer")`; el servicio lo vuelve a rechazar como defensa en profundidad.
   - Se implementa como un helper único, `resolverFiltroProfesorDeMateria(usuario, materiaId): Promise<string | undefined>` (`undefined` = sin filtro, solo para Mesa/Gerente). Para el rol Profesor comparte con `resolverProfesorDeLaAgenda()` el helper privado `profesorDeLaSesion()`.

4. **DECISIÓN RESUELTA (default, a confirmar con el equipo) — ocupación `x/y` en lugar del nombre del alumno (criterio 2). Etiqueta: "Alumnos: x/y".**
   - El modelo **soporta** turnos grupales con cupo (§0.4), así que no hace falta ninguna interpretación alternativa (como capacidad del aula):
     - `x` = cantidad de filas de `TurnoAlumno` del turno (`_count: { select: { alumnos: true } }` en la misma query).
     - `y` = `Turno.cupoMaximoTurno`.
   - Se devuelve como `alumnos_inscriptos: "3/5"`, **mismo nombre de campo y mismo formato** que el módulo C (§0.4), y además los números sueltos (`inscriptos`, `cupo`) para el `aria-label`.
   - Casos: `DISPONIBLE` con 0 alumnos (Decisión B de HU-C-04) → `"0/3"`, sigue en el calendario. `COMPLETO` → `x == y`.
   - **No se muestran nombres de alumnos** en esta vista (el criterio lo reemplaza explícitamente por la ocupación).
   - **Etiqueta (resuelta por el responsable):** `"Alumnos: 3/5"` (coherente con "Alumnos: …" de `aula-turno.tsx`). En el `aria-label`: "3 de 5 alumnos inscriptos".
   - **Diferencia con la spec:** `spec_modulo_J.md` §2.2 paso 3 y su ejemplo JSON piden `alumno: "Pérez, Ana"`. El backlog vigente pide ocupación. Manda el backlog; se actualiza la spec con nota de sincronización (§3.1).

5. **DECISIÓN — eventos superpuestos lado a lado (criterio 2).**
   - Se reutiliza `asignarCarriles()` sin cambios: agrupa los eventos del día que se solapan transitivamente; dentro de cada grupo asigna a cada evento el primer carril libre y todos los eventos del grupo reparten el ancho de la columna en partes iguales (`width = 100% / carriles`, `left = carril / carriles`). Dos turnos de 10:00 a 11:00 con distintos profesores quedan al 50 % cada uno; tres, al 33 %. Nada se oculta ni se combina (`spec_modulo_J.md` §3.3).
   - **Orden estable de los carriles:** la query ordena por `fechaTurno`, `horaInicioTurno`, apellido/nombre normalizados del profesor e `idTurno`. Como `asignarCarriles()` ordena con `sort` estable por inicio y fin, en un empate el profesor que va primero alfabéticamente queda a la izquierda, en todas las semanas.
   - **Legibilidad con muchos carriles:** la columna mide como mínimo `9rem`. Con 3 o más carriles el bloque queda angosto. Para la densidad del centro (pocas aulas) no se cambia el ancho mínimo; cada línea usa `truncate` y el texto completo queda en `title` y en el `aria-label` (mismo criterio que J-01). Si en la prueba manual con 3 superpuestos no se lee la hora ni el profesor, se evalúa en esta misma HU subir el mínimo de columna solo cuando algún día tiene 3+ carriles, sin tocar la vista de profesor.
   - El backend devuelve todos los eventos tal cual; la disposición es de la UI.

6. **DECISIÓN — selector de materia (criterio 1).**
   - Opciones, resueltas en el servidor por `listarMateriasDelCalendario(usuario)` (§1 punto 9):
     - Mesa/Gerente: `listarMateriasActivas()` del módulo L (Regla 3), **solo activas**, en el orden que ya devuelve (`nombreMateria asc`). No se usa `GET /api/materias` (listado paginado de HU-L-02).
     - Profesor: `obtenerMateriasDelProfesor()` del módulo D filtrada a `activa`, en su orden.
   - Cada opción muestra **nombre y código si existe**: `"Matemática (MAT101)"`; sin código, solo el nombre: `"Química"`. Helper puro `etiquetaMateria({ nombre, codigo })` en `src/lib/calendario-semana.ts` (`filtrar-materias.ts` no tenía un formateo equivalente).
   - El selector se muestra **a los tres roles** (a diferencia de J-01, el profesor también elige la materia, entre las que dicta).
   - Sin materia seleccionada → aviso "Seleccioná una materia para ver sus turnos". Sin materias → "No hay materias activas" (Mesa/Gerente) o "No tenés materias activas asociadas" (Profesor).
   - Materia inexistente o inactiva en la URL (p. ej. se desactivó entre semanas) → aviso "La materia seleccionada no existe o no está activa" en la página; `404 MATERIA_NO_ENCONTRADA` en la API.
   - Para el encabezado ("Turnos de Matemática (MAT101)") hace falta nombre y código de una materia activa por id. Se agrega al módulo L un servicio público aditivo, `obtenerOpcionMateriaActiva(id): Promise<{ id; nombre; codigo } | null>` (mismo patrón que `obtenerOpcionProfesorActivo()` de D). No se cambia la firma de `verificarMateriaActiva()`, que usan otros módulos dentro de transacciones.

7. **DECISIÓN — materia y semana persistidas en la URL (criterio 4).**
   - `/calendario/materia?materiaId=<cuid>&semana=<AAAA-MM-DD>`. Sin `semana` → semana actual; `semana` inválida → semana actual (la API responde `400 VALIDACION`).
   - Anterior / Siguiente cambian `semana` y conservan `materiaId`. **Hoy** quita `semana` (vuelve a la semana actual) y conserva `materiaId`. Cambiar de materia conserva la semana.
   - Cada evento linkea a `/turnos/[id]?volver=<URL actual del calendario, con encodeURIComponent>`.
   - **Vuelta desde el detalle — parcial, bloqueado por el módulo C (igual que J-01 criterio 6):** `/turnos/[id]` descarta todo `volver` que no empiece con `/turnos?` (§0.3). El "atrás" del navegador sí conserva materia y semana porque viajan en la URL. HU-J-02 **no** modifica archivos del módulo C; se suma al pedido ya abierto (§8).

8. **DECISIÓN (revalidar al implementar) — lectura de turnos dentro del módulo J (excepción temporal a Regla 3, igual que J-01 §1 punto 7).**
   - El módulo C no expone `listarTurnosAgendadosPorMateria()`. La consulta de solo lectura vive en `calendario.service.ts`, con el mismo `TODO(Regla N.° 3)` y el contrato objetivo en §4.3.
   - Se implementa como **una sola consulta base** parametrizada por filtro (`{ profesorId }` o `{ materiaId, profesorId? }`) que usan las dos vistas, no dos `findMany` copiados.
   - **Si antes de implementar el módulo C publica el servicio, esta HU lo consume** y no agrega la excepción.
   - No se modifican archivos del módulo C.

9. **DECISIÓN RESUELTA (default, a confirmar con el equipo) — materias que ve el profesor en el selector.**
   - Resuelto por el responsable: Mesa de Entrada y Gerente ven **todas las materias activas**; el Profesor ve **solo las materias activas que tiene asociadas** (HU-D-03).
   - No hizo falta un servicio nuevo del módulo D: `obtenerMateriasDelProfesor(profesorId)` ya es pública (HU-D-03/D-05) y devuelve las asociadas con su `activa`.
   - El servidor, además de filtrar los turnos por el `profesorId` propio, **rechaza con `403 SIN_PERMISO`** una materia que el profesor no dicta (§1 punto 3).
   - Caso borde aceptado: si un profesor deja de estar asociado a una materia en la que todavía tiene turnos confirmados, ya no los ve en esta vista (sí en "Mi agenda", HU-J-01).

10. **DECISIÓN — campos por rol (criterio 2, "según los permisos del rol").**
    - Hora, Profesor, Alumnos inscriptos (ocupación), Aula y Estado para los tres roles. Mismo criterio que J-01 §1 punto 8: la frase se refiere al acceso (punto 3), no a campos distintos.
    - Estado con texto ("Disponible" / "Completo") e ícono (`CalendarCheck` / `Users`), reutilizando `ETIQUETA_ESTADO` / `ICONO_ESTADO`.

**Supuestos tomados:**
- **Etiqueta de ocupación "Alumnos: x/y"** (x = cantidad de `TurnoAlumno` del turno, y = `cupoMaximoTurno`): **default, a confirmar con el equipo** (§1 punto 4).
- **Selector de materia por rol** (Mesa/Gerente: todas las activas; Profesor: solo las activas asociadas, con `403` si pide otra): **default, a confirmar con el equipo** (§1 punto 9).
- **Orden de verificación:** primero el alcance del rol (ficha, materia dictada), después que la materia esté activa. Un Profesor recibe `403` por una materia que no dicta aunque no exista o esté inactiva (no revela su existencia); si la dicta pero está inactiva, `404`.
- **Semana y zona horaria:** idénticas a J-01 §1 punto 3 (lunes–domingo en `America/Argentina/Buenos_Aires`, columnas y rango solo de días operativos).
- **Profesor inactivo con turnos confirmados en la materia:** se muestra igual (el turno existe y reserva recursos). El nombre sale de la relación, sin filtrar por activo.
- **Turno confirmado sin aula:** no debería existir (HU-C-15 exige aula para confirmar); si pasara, Aula muestra "—" (`VALOR_AUSENTE`). Lo mismo para profesor.
- **Error de negocio vs. técnico:** materia inexistente/inactiva y profesor sin ficha → aviso en la página; error inesperado → `error.tsx` con Reintentar.

**Dependencias de esta implementación:**
- **Depende de:**
  - HU-C-15 (confirmación `PENDIENTE → DISPONIBLE/COMPLETO`) y HU-C-04 (profesor, inscripciones, `DISPONIBLE ⇄ COMPLETO`). Cerradas.
  - HU-L-02 / HU-L-01: `listarMateriasActivas()` y `verificarMateriaActiva()`. Cerradas.
  - HU-J-01: grilla, helpers, permiso `calendario:leer`, `obtenerOpcionProfesorDeUsuario()`. Cerrada (con criterio 6 parcial).
  - Módulo C: servicio `listarTurnosAgendadosPorMateria()` (**no existe**, §1 punto 8) y `volver` desde `/calendario` en `/turnos/[id]` (**no existe**, §1 punto 7).
- **Es requisito de:** vistas día/semana/mes intercambiables (Sprint 2) y filtros combinados (Sprint 3), que deberían montarse sobre las piezas compartidas que deja esta HU.

**Fuera de alcance de esta task (explícito):**
- Vistas intercambiables por día, semana y mes (Sprint 2, criterio 6).
- Filtros combinados, por ejemplo materia + profesor (Sprint 3, criterio 6). Mesa/Gerente **no** tienen un filtro de profesor en esta vista.
- Nombres de alumnos en el evento (reemplazados por la ocupación).
- Impresión o exportación.
- Cualquier escritura sobre turnos.
- Cambios en `prisma/schema.prisma`, migraciones y `prisma/seed.ts` (los datos faltantes del seed se piden al dueño, §4.0 y §8).
- Cambios en archivos del módulo C (`src/server/turnos/**`, `src/app/api/turnos/**`, `src/app/(dashboard)/turnos/**`).

---

## 2. Historia de Usuario

**Como** usuario autorizado
**Necesito** visualizar los turnos correspondientes a una materia
**Para** conocer la distribución de sus clases

**SP estimado:** 2

**Justificación de secuencia (backlog vigente):** depende de HU-C-15 y HU-L-02. Vista complementaria del calendario por materia, con ocupación; el flujo básico ya queda cubierto con HU-J-01. Alta prioridad.

### 2.1. Criterios de aceptación y dónde se cumplen

| # | Criterio (backlog vigente) | Cómo se cumple | Dónde |
|---|---|---|---|
| 1 | Permite seleccionar una materia activa y muestra sus turnos agendados en una vista semanal básica. Abre en la semana actual e indica el rango de fechas. Mesa y gerencia ven todos los turnos de la materia; un profesor ve únicamente los suyos (filtra el servidor). | Selector con `listarMateriasActivas()` ("Nombre (CÓDIGO)"). Semana actual por defecto (Buenos Aires); encabezado "Semana del 21/09 al 25/09/2026". Filtro `profesorId` propio agregado en el servicio para `PROFESOR` (§1 punto 3). | `calendario/materia/page.tsx`, `SelectorCalendario`, `NavegacionSemana`, `resolverFiltroProfesorDeMateria()`, `obtenerCalendarioMateria()` |
| 2 | Cada evento muestra Hora, Profesor, Alumnos inscriptos, Aula y Estado. Alumnos como ocupación sobre cupo ("3/5"). Superpuestos con distintos profesores uno junto al otro. Estado con texto o ícono además del color. | `alumnos_inscriptos` = `_count.alumnos / cupoMaximoTurno` (§1 punto 4). `GrillaSemanal` + `asignarCarriles()` reparten el ancho (§1 punto 5). `Badge` con texto e ícono por estado. | `EventoCalendarioMateria` (sobre `BloqueEventoCalendario`), `GrillaSemanal`, `listarTurnosAgendados()` |
| 3 | Los turnos pendientes no aparecen. | `estadoTurno IN (DISPONIBLE, COMPLETO)` en el `where` (§1 punto 2). | `listarTurnosAgendados()` |
| 4 | La materia seleccionada se conserva al navegar entre semanas y al regresar desde el detalle. Hoy regresa a la semana actual. | `?materiaId=&semana=` en la URL; links Anterior/Hoy/Siguiente conservan `materiaId`; eventos con `?volver=`. **Vuelta desde el detalle: parcial, depende del módulo C** (§1 punto 7). | `NavegacionSemana`, `construirUrlCalendarioMateria()`, `BloqueEventoCalendario` · `turnos/[id]/page.tsx` (C, pendiente) |
| 5 | Sin turnos: "No hay turnos para la materia seleccionada". Indicador de carga; error con Reintentar. | `eventos: []` → mensaje sobre la grilla vacía. `<Suspense key>` con "Cargando turnos de la materia"; `error.tsx` con `retry()`. | `calendario/materia/page.tsx`, `calendario/materia/error.tsx`, `EstadoCalendario*` compartidos |
| 6 | No incluye filtros combinados ni vistas intercambiables por día, semana y mes. | Solo vista semanal; único filtro, la materia. | — |

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_J.md` §2.2 y §3, con las decisiones de §1.

### 3.1. Desglose en subtareas técnicas

- [x] **Refactor compartido de J-01, sin cambio de comportamiento** (§3.3): consulta base, tipos base, URL genérica, navegación, selector, bloque del evento, estados de carga/vacío/error. Correr los tests de J-01 antes y después.
- [x] **Servicio público del módulo L:** `obtenerOpcionMateriaActiva(id)` (§4.3).
- [x] **Helpers puros:** `construirUrlCalendario()`, `construirUrlCalendarioMateria()`, `etiquetaMateria()` (§4.1).
- [x] **Schema Zod:** `ConsultarCalendarioMateriaQuerySchema` (§4.2).
- [x] **Consulta de turnos confirmados por materia** dentro del módulo J, con ocupación y profesor, sobre la consulta base compartida (§4.3). `TODO(Regla N.° 3)`.
- [x] **Servicio del módulo J:** `listarMateriasDelCalendario()`, `resolverFiltroProfesorDeMateria()` y `obtenerCalendarioMateria()` (§4.5).
- [x] **Route Handler** `GET /api/calendario/materia/[materiaId]` (§4.6).
- [x] **UI:** página `/calendario/materia`, selector, navegación, grilla, evento con ocupación, carga, vacío y error (§5).
- [x] **Sidebar:** "Agenda por materia" para Mesa y Gerente; "Mis turnos por materia" para Profesor.
- [x] **Tests unitarios** de helpers, servicio y componente del evento; regresión de J-01 (§6).
- [x] **Nota de sincronización** en `spec_modulo_J.md` §2.2 (ocupación en lugar de `alumno`; `profesorId` resuelto por ficha, no `session.sub`; rango por días operativos; lectura dentro de J con `TODO`).
- [ ] **Detalle de turno:** aceptar `?volver=/calendario/...` — **pendiente del dueño de turnos** (§8), no se implementa en esta HU.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Migraciones, cambios de schema o de `prisma/seed.ts`.
- Cambios en archivos del módulo C.
- Filtrar pendientes o turnos ajenos solo en la UI.
- Filtro de profesor para Mesa/Gerente, selector de vista día/semana/mes, impresión o exportación.

### 3.2. Archivos a crear

| Archivo | Qué hace |
|---|---|
| `src/app/(dashboard)/calendario/materia/page.tsx` | Server Component: permiso, rol, searchParams, selector, navegación, carga y grilla |
| `src/app/(dashboard)/calendario/materia/error.tsx` | Boundary de la ruta: renderiza `ErrorCalendario` con "No se pudo cargar el calendario de la materia" y Reintentar |
| `src/app/api/calendario/materia/[materiaId]/route.ts` | `GET` con `withPermission("calendario:leer")` (§4.6) |
| `src/components/shared/evento-calendario-materia.tsx` | Evento de la vista por materia: Hora, Profesor, Alumnos (ocupación), Aula, Estado, sobre `BloqueEventoCalendario` |
| `src/components/shared/bloque-evento-calendario.tsx` | Base extraída de `evento-calendario.tsx`: link con `?volver=`, horario, `Badge` de estado con ícono, líneas de detalle por prop, `title`/`aria-label` |
| `src/components/shared/navegacion-semana.tsx` | Movido desde `calendario/profesor/`: rango + Anterior/Hoy/Siguiente, recibe los `href` ya armados |
| `src/components/shared/selector-calendario.tsx` | Selector cliente genérico (`<select>` nativo, estilo HU-D-04): opciones `{ id, etiqueta }`, nombre del parámetro y ruta base; conserva `semana` |
| `src/components/shared/estado-calendario.tsx` | `CargandoCalendario`, `AvisoCalendario` y `CalendarioVacio`, con el texto por prop |
| `src/components/shared/error-calendario.tsx` | `ErrorCalendario` (`"use client"`, Reintentar). Separado de `estado-calendario.tsx` para que ese archivo siga siendo de servidor |
| `src/components/shared/evento-calendario-materia.test.tsx` | Test del bloque: ocupación, profesor, estado con texto e ícono, `href` con `volver`; regresión de `EventoCalendario` (J-01) |

### 3.3. Archivos a modificar

| Archivo | Qué cambia |
|---|---|
| `src/server/calendario/calendario.service.ts` | Constante `ESTADOS_CALENDARIO`; consulta base `listarTurnosAgendados(filtro, desde, hasta)` compartida; `listarTurnosAgendadosDeProfesor()` pasa a delegar en ella **sin cambiar firma ni forma del dato**; nuevas `listarTurnosAgendadosDeMateria()`, `resolverFiltroProfesorDeMateria()` y `obtenerCalendarioMateria()` |
| `src/server/calendario/calendario.service.test.ts` | Casos nuevos de materia (§6); los de profesor no cambian sus aserciones |
| `src/server/calendario/calendario.schema.ts` | `ConsultarCalendarioMateriaQuerySchema` (mismo shape; puede ser un alias de un `ConsultarCalendarioSemanaQuerySchema` común) |
| `src/types/calendario.types.ts` | `EventoCalendarioBase` (`turno_id`, `fecha`, `hora_inicio`, `hora_fin`, `aula`, `estado`); `EventoCalendario` (profesor) = base + `alumno` + `materia` (**mismo nombre y forma**, para no romper J-01); `EventoCalendarioMateria` = base + `profesor` + `alumnos_inscriptos` + `inscriptos` + `cupo`; `CalendarioMateria` |
| `src/lib/calendario-semana.ts` | `construirUrlCalendario(rutaBase, params)`; `construirUrlCalendarioProfesor()` delega en ella (misma salida); `construirUrlCalendarioMateria()`; `etiquetaMateria()` |
| `src/lib/calendario-semana.test.ts` | Casos de los helpers nuevos; los de profesor sin cambios |
| `src/components/shared/evento-calendario.tsx` | Pasa a ser un wrapper de `BloqueEventoCalendario` con las líneas Alumno, Materia, Aula (misma salida) |
| `src/app/(dashboard)/calendario/profesor/page.tsx` | Usa `NavegacionSemana`, `SelectorCalendario` y los estados compartidos; textos iguales ("Cargando agenda", "Agenda sin turnos", "Seleccioná un profesor para ver su agenda") |
| `src/app/(dashboard)/calendario/profesor/error.tsx` | Renderiza `ErrorCalendario` con "No se pudo cargar la agenda" |
| `src/app/(dashboard)/calendario/profesor/navegacion-semana.tsx` · `selector-profesor.tsx` | **Eliminados** (reemplazados por `NavegacionSemana` y `SelectorCalendario` de `components/shared`) |
| `src/server/materias/materia.service.ts` | Agrega `obtenerOpcionMateriaActiva(id)` (aditivo, servicio público del módulo L) |
| `src/components/layout/Sidebar.tsx` | "Agenda por materia" (`/calendario/materia`) en la sección Calendario de Mesa, Gerente y Profesor; se actualiza el comentario `TODO Sprint 1` (líneas 38-39) |
| `src/app/(dashboard)/calendario/page.tsx` | Solo el comentario: ya no es "una sola vista". Sigue redirigiendo a `/calendario/profesor` |
| `docs/specs/spec_modulo_J.md` | Nota de sincronización §2.2 |

---

## 4. Contrato Backend

### 4.0. Permiso y seed

- **Permiso:** `calendario:leer` ya está en el seed para los tres roles (HU-J-01). Nada que agregar.
- **Turnos del seed** (`prisma/seed.ts`, `TURNOS`; fechas relativas a la semana en curso). Por materia:

| Materia | Turnos confirmados | Superpuestos con distinto profesor | Ocupación |
|---|---|---|---|
| Matemática | `01` (sem. 0, lun 08–09, Giménez, Aula 1, `COMPLETO`) · `10` (sem. 1, vie 14–16, Giménez, Aula 10, `DISPONIBLE`) | No | `1/1`, `1/3` |
| Física | `05` (sem. 0, mié 09–11, Giménez) | No | `1/3` |
| Programación I | `02` (sem. 0, lun 10–12, Rossi) + `11` `PENDIENTE` sin profesor (sem. 1) | No | `1/3` |
| Bases de Datos | `04` (sem. 0), `07` (sem. 1), ambos Rossi | No | `1/1`, `1/1` |
| Química | `06` (sem. 0), `08` (sem. 1), ambos Vega | No | `1/3`, `1/3` |
| Inglés Técnico | `03` (sem. 0), `09` (sem. 1), ambos Acuña | No | `1/3`, `1/1` |

- **Qué sí alcanza:** vista básica por materia en la semana actual y la siguiente; `DISPONIBLE` y `COMPLETO`; estado vacío (cualquier materia en la semana +2); materia sin código (Química, Inglés Técnico) y materia inactiva (Historia de la Ciencia, no aparece en el selector); Alumno sin permiso.
- **Qué NO alcanza (conclusión: el seed actual no cubre los criterios 1, 2 y 3 de esta HU):**
  - Ninguna materia tiene **dos profesores distintos** con turnos confirmados → no se puede probar que Mesa ve todos y el Profesor solo los suyos.
  - **No hay turnos superpuestos** de la misma materia.
  - Todos los turnos tienen **un solo alumno** → la ocupación nunca pasa de `1/y`.
  - El único `PENDIENTE` no tiene profesor ni es de una materia con otros turnos en su semana → no prueba "pendiente con profesor no aparece" en esta vista.
- **Datos a pedir al dueño del seed** (no se toca en esta HU). Respetan los horarios de atención, las materias que dicta cada profesor y que no se pisen profesor, aula ni alumno:

| Id propuesto | Semana/día/hora | Materia | Profesor | Aula | Alumnos | Cupo | Estado esperado | Para qué |
|---|---|---|---|---|---|---|---|---|
| `seed-turno-12` | sem. 0, lunes 08:00, 1 h | Matemática | Castro, Julián (idx 9; lun 08–10; sin cuenta) | Aula 2 | Álvarez, Lucía (idx 10) | 3 | `DISPONIBLE` (`1/3`) | **Superpuesto** con `seed-turno-01` (Giménez, Aula 1, 08–09) |
| `seed-turno-13` | sem. 0, martes 09:00, 2 h | Matemática | Vega, Carolina (idx 2; mar 08–12; con cuenta `profesor3@`) | Aula 11 | Ruiz (idx 11), Benítez (idx 12), Herrera (idx 13) | 5 | `DISPONIBLE` (`3/5`) | **Ocupación grupal** (el ejemplo "3/5" del criterio) y **segundo profesor con cuenta** para probar el filtro (Giménez no la ve, Vega sí) |
| `seed-turno-14` | sem. 0, miércoles 11:00, 1 h | Matemática | Giménez (idx 0; mié 08–12) | Aula 1 | Castro, Florencia (idx 14) | 2 | **`PENDIENTE`** con profesor, aula y alumno | Criterio 3: no debe aparecer para nadie |
| (opcional) `seed-turno-15` | sem. 0, lunes 08:00, 1 h | Matemática | Ávila, Pedro (idx 6; hoy sin horarios) | Laboratorio | — | 2 | `DISPONIBLE` (`0/2`) | Tercer carril y ocupación `0/y`. Requiere darle a Ávila un horario lunes 08–09 |

  **Aviso para el dueño del seed:** la estructura actual no permite cargar esto sin cambios, porque `TurnoSeed.alumno` es un único índice, el estado se deriva de `profesor !== null` (con profesor, `seed-turno-14` saldría `DISPONIBLE`, nunca `PENDIENTE`) y `validarDatos()` trata como agendado a todo turno con profesor al chequear solapamientos. Haría falta `alumnos: number[]` y un `estado` explícito en `TurnoSeed`, y que `validarDatos()` solo valide solapamientos entre confirmados.
- **Mientras el seed no se actualice:** la prueba manual (§6) crea estos turnos por el flujo real (`POST /api/turnos`, `PATCH .../participantes`, `PATCH .../aula`, `POST .../alumnos`) como en J-01 §6 "Pruebas con el flujo real", y los borra al terminar.

### 4.1. Helpers puros

**Archivo:** `src/lib/calendario-semana.ts` (modificado)

```typescript
export function construirUrlCalendario(
  rutaBase: "/calendario/profesor" | "/calendario/materia",
  params: Record<string, string | undefined>, // se omiten los vacíos; orden estable
): string;
export function construirUrlCalendarioProfesor({ profesorId?, semana? }): string; // delega, misma salida que hoy
export function construirUrlCalendarioMateria({ materiaId?, semana? }): string;   // "/calendario/materia?materiaId=…&semana=…"
export function etiquetaMateria({ nombre, codigo }: { nombre: string; codigo: string | null }): string;
// "Matemática (MAT101)" · "Química"
```

### 4.2. Schema Zod

**Archivo:** `src/server/calendario/calendario.schema.ts`

```typescript
export const ConsultarCalendarioMateriaQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(), // se normaliza al lunes; si falta, semana actual
});
export type ConsultarCalendarioMateriaQuery = z.infer<typeof ConsultarCalendarioMateriaQuerySchema>;
```

### 4.3. Lectura de turnos y de materias

**Consulta base compartida** (`calendario.service.ts`, privada al módulo, `TODO(Regla N.° 3)`):

```typescript
const ESTADOS_CALENDARIO = ["DISPONIBLE", "COMPLETO"] as const satisfies readonly EstadoTurno[];

type FiltroTurnosCalendario =
  | { profesorId: string }
  | { materiaId: string; profesorId?: string }; // profesorId: solo lo pone el servicio para el rol Profesor

async function listarTurnosAgendados(filtro: FiltroTurnosCalendario, desde: Date, hasta: Date);
// where: { ...filtro, estadoTurno: { in: ESTADOS_CALENDARIO }, fechaTurno: { gte: desde, lt: hasta } }
// select: idTurno, estadoTurno, fechaTurno, horaInicioTurno, duracionMinutosTurno, cupoMaximoTurno,
//         materia.nombreMateria, aula.nombreAula, profesor.{apellidoProfesor, nombreProfesor},
//         alumnos (apellido/nombre, solo para la vista de profesor), _count.alumnos
// orderBy: fechaTurno, horaInicioTurno, profesor.apellidoNormalizadoProfesor, profesor.nombreNormalizadoProfesor, idTurno
```

- `listarTurnosAgendadosDeProfesor(profesorId, desde, hasta): Promise<EventoCalendario[]>` — misma firma y salida que hoy.
- `listarTurnosAgendadosDeMateria(materiaId, desde, hasta, profesorId?): Promise<EventoCalendarioMateria[]>`:

```typescript
type EventoCalendarioMateria = {
  turno_id: string;
  fecha: string;              // "AAAA-MM-DD"
  hora_inicio: string;        // "HH:mm"
  hora_fin: string;           // hora_inicio + duracionMinutosTurno
  profesor: string;           // "Apellido, Nombre" (formatearApellidoNombre); "—" si faltara
  alumnos_inscriptos: string; // "3/5" = _count.alumnos / cupoMaximoTurno (mismo formato que el módulo C)
  inscriptos: number;
  cupo: number;
  aula: string;               // "—" si faltara
  estado: "DISPONIBLE" | "COMPLETO";
};
```

  No selecciona nombres de alumnos (no se muestran en esta vista).

**Contrato objetivo en el módulo C** (propuesto, **todavía no existe**; mismo criterio que J-01 §4.3). Cuando exista, `listarTurnosAgendadosDeMateria()` pasa a ser un adaptador sin `prisma.turno`:

```typescript
// src/server/turnos/turno.service.ts (módulo C) — propuesto
export async function listarTurnosAgendadosPorMateria(
  materiaId: string,
  desde: Date,          // fechaTurno >= desde
  hasta: Date,          // fechaTurno <  hasta
  profesorId?: string,  // filtro obligatorio cuando consulta un Profesor
): Promise<{
  id: string; fecha: string; hora_inicio: string; hora_fin: string;
  estado: "DISPONIBLE" | "COMPLETO";
  profesor: { apellido: string; nombre: string } | null;
  aula: string | null;
  inscriptos: number; cupo: number;
}[]>;
```

**Servicio público del módulo L** (`materia.service.ts`, aditivo):
- `obtenerOpcionMateriaActiva(id): Promise<{ id: string; nombre: string; codigo: string | null } | null>` — solo activas.

### 4.4. Tipos

**Archivo:** `src/types/calendario.types.ts`

```typescript
export type EventoCalendarioBase = {
  turno_id: string; fecha: string; hora_inicio: string; hora_fin: string;
  aula: string; estado: "DISPONIBLE" | "COMPLETO";
};
export type EventoCalendario = EventoCalendarioBase & { alumno: string; materia: string }; // J-01, sin cambios
export type EventoCalendarioMateria = EventoCalendarioBase & {
  profesor: string; alumnos_inscriptos: string; inscriptos: number; cupo: number;
};
export type CalendarioMateria = {
  materia: { id: string; nombre: string; codigo: string | null };
  rango: RangoSemana;
  dias: DiaDeSemana[];
  horario: ParametrosGrilla;
  eventos: EventoCalendarioMateria[];
};
```

### 4.5. Servicio del módulo J

**`listarMateriasDelCalendario(usuario): Promise<MateriaCalendario[]>`** — opciones del selector (§1 punto 6): Mesa/Gerente → `listarMateriasActivas()`; Profesor → `obtenerMateriasDelProfesor()` filtrada a activas (sin ficha → `PROFESOR_SIN_FICHA`); otro rol → `SIN_PERMISO`.

**`resolverFiltroProfesorDeMateria(usuario, materiaId): Promise<string | undefined>`** — único punto que decide el alcance (§1 punto 3):
- `PROFESOR` → `obtenerOpcionProfesorDeUsuario(usuario.id)`; sin ficha → `ServiceError("PROFESOR_SIN_FICHA")`; si `materiaId` no está entre `obtenerMateriasDelProfesor()` → `ServiceError("SIN_PERMISO")`; si no, su `id`.
- `MESA_ENTRADA` / `GERENTE` → `undefined` (sin filtro).
- Otro rol → `ServiceError("SIN_PERMISO")`.

**`obtenerCalendarioMateria({ usuario, materiaId, lunes }): Promise<CalendarioMateria>`**
1. `resolverFiltroProfesorDeMateria(usuario, materiaId)`; después, en paralelo, `obtenerOpcionMateriaActiva(materiaId)` y los parámetros de la semana.
2. Materia `null` → `ServiceError("MATERIA_NO_ENCONTRADA")`.
3. Días operativos y rango con los helpers de J-01.
4. `listarTurnosAgendadosDeMateria(materia.id, desde, hastaExclusivo, profesorId)`.
5. Devuelve `{ materia, rango, dias, horario, eventos }`.

El orden de verificación importa: un Profesor sin ficha recibe `PROFESOR_SIN_FICHA` aunque la materia no exista, y nunca se consulta `turnos` sin el filtro del profesor.

### 4.6. Route Handler

**`GET /api/calendario/materia/[materiaId]`** (`src/app/api/calendario/materia/[materiaId]/route.ts`, nuevo), mismo esqueleto que `api/calendario/profesor/[profesorId]/route.ts`:
- `withPermission("calendario:leer")`, `params` async (Next 16; revisar `node_modules/next/dist/docs/` antes de escribirlo, AGENTS.md).
- `ConsultarCalendarioMateriaQuerySchema.safeParse` de `?semana_inicio=` → `400 VALIDACION` con `flattenError`.
- Éxito → `200 { data: { materia, rango, eventos }, error: null }`.
- Error inesperado → `500 ERROR_INTERNO`, sin detalle técnico.

| Resultado | Status |
|---|---|
| Sin sesión | `401 SESION_INVALIDA` (`withPermission`) |
| Rol sin `calendario:leer` (Alumno) | `403 SIN_PERMISO` |
| `PROFESOR` sin ficha vinculada | `403 SIN_PERMISO` |
| Materia inexistente o inactiva (cualquier rol autorizado) | `404 MATERIA_NO_ENCONTRADA` |
| `PROFESOR` pidiendo una materia que no dicta (exista o no) | `403 SIN_PERMISO` |
| `PROFESOR` con materia activa que dicta | `200`, solo sus turnos (puede ser `eventos: []`) |
| Mesa/Gerente con materia activa | `200`, todos los turnos confirmados de la materia |
| `semana_inicio` inválida | `400 VALIDACION` |

---

## 5. Frontend

**Paleta:** solo tokens de `docs/DESIGN.md`, los mismos que J-01 (bloque `bg-background` con `border-l-primary`, hover `bg-accent`, `Badge variant="success"` con texto e ícono, columna de hoy `bg-secondary`, errores `text-destructive`). No se agregan colores ni se distinguen profesores por color (el estado y el profesor se leen como texto).

### 5.1. Página `src/app/(dashboard)/calendario/materia/page.tsx`

- `exigirPermiso("calendario:leer")` (sin sesión → `/login`, sin permiso → `/sin-permiso`).
- Lee `?materiaId=` y `?semana=` (`primerValor`, trim). Semana inválida → actual.
- Título: "Agenda por materia" (Mesa/Gerente) y "Mis turnos por materia" (Profesor), para que el profesor entienda que ve solo los suyos.
- `SelectorCalendario` con `listarMateriasDelCalendario(usuario)` → `{ id, etiqueta: etiquetaMateria(...) }`, parámetro `materiaId`, ruta `/calendario/materia`. Sin materias → "No hay materias activas" / "No tenés materias activas asociadas". Profesor sin ficha → aviso en lugar del selector.
- Sin `materiaId` → `AvisoCalendario` "Seleccioná una materia para ver sus turnos".
- Con `materiaId`: `NavegacionSemana` (rango + Anterior/Hoy/Siguiente con `construirUrlCalendarioMateria`) y `<Suspense key={`${materiaId}-${lunes}`} fallback={<CargandoCalendario texto="Cargando turnos de la materia" />}>`.
- Dentro del Suspense: `obtenerCalendarioMateria()`. Errores de negocio (`MATERIA_NO_ENCONTRADA`, `PROFESOR_SIN_FICHA`, `SIN_PERMISO`) → `AvisoCalendario` con su mensaje; el resto se relanza a `error.tsx`.
- Encabezado del resultado: "Turnos de **Matemática (MAT101)**".
- `eventos: []` → `CalendarioVacio` "No hay turnos para la materia seleccionada" (con ícono, `role="status"`) sobre la grilla vacía.
- `GrillaSemanal` con `renderEvento={(e, estilo) => <EventoCalendarioMateria evento={e} estilo={estilo} volverA={urlActual} />}`.

### 5.2. Componentes compartidos

- **`BloqueEventoCalendario`**: props `turnoId`, `horario`, `estado`, `lineas: { texto: string; destacada?: boolean }[]`, `descripcion` (para `title`/`aria-label`), `estilo`, `volverA`. Contiene `ETIQUETA_ESTADO`/`ICONO_ESTADO` (se exportan desde acá). `EventoCalendario` (J-01) y `EventoCalendarioMateria` son wrappers de pocas líneas.
- **`EventoCalendarioMateria`**: líneas Profesor (destacada), "Alumnos: 3/5" (texto a confirmar, §1 punto 4) y Aula. `aria-label`: "Turno 10:00–11:00 · Gómez, Ana · 3 de 5 alumnos inscriptos · Aula 2 · Disponible. Ver detalle".
- **`NavegacionSemana`**: props `rango`, `hrefAnterior`, `hrefHoy`, `hrefSiguiente`, `esSemanaActual`. Server Component sin conocer la ruta. "Hoy" con `aria-current="date"` cuando ya es la semana actual.
- **`SelectorCalendario`** (`"use client"`): props `id`, `etiqueta` ("Materia" / "Profesor"), `placeholder`, `opciones`, `valor`, `rutaBase`, `parametro`, `semana`. Al cambiar hace `router.push(construirUrlCalendario(rutaBase, { [parametro]: elegido, semana }))` dentro de `useTransition` (deshabilitado mientras navega). Solo recibe datos serializables.
- **`estado-calendario.tsx`**: `CargandoCalendario({ texto })` (`role="status"`, `Loader2`), `AvisoCalendario({ children })`, `CalendarioVacio({ texto })` (`CalendarX`), `ErrorCalendario({ texto, retry })` (`"use client"`, `role="alert"`, botón Reintentar).

**Menú:** `Sidebar.tsx` agrega "Agenda por materia" (`/calendario/materia`) debajo de "Agenda por profesor" / "Mi agenda", para los tres roles. Ícono de `lucide-react` ya usado en el proyecto (p. ej. `Library` o `CalendarRange`), sin colores nuevos.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unit (`npm test`)

- **Regresión J-01 (antes y después del refactor):** `calendario-semana.test.ts` y `calendario.service.test.ts` con las mismas aserciones; `construirUrlCalendarioProfesor()` devuelve lo mismo que hoy.
- `src/lib/calendario-semana.test.ts` (casos nuevos):
  - `construirUrlCalendarioMateria`: sin params, solo materia, materia + semana; omite vacíos.
  - `etiquetaMateria`: con código y sin código.
  - `asignarCarriles` con dos eventos idénticos de distinto profesor → carriles 0 y 1 de 2; con tres → 3 carriles; contiguos (10–11 y 11–12) → 1 carril cada uno.
- `src/server/calendario/calendario.service.test.ts` (casos nuevos, `prisma`, módulos D y L y parámetros mockeados):
  - `listarTurnosAgendadosDeMateria`: `where` con `materiaId`, `estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }` y rango `[desde, hasta)`; **sin** `profesorId` cuando no se pasa.
  - Con `profesorId` → el `where` lo incluye.
  - Un `PENDIENTE` con profesor, alumnos y aula no sale (el mock aplica el `where`, como en J-01).
  - Ocupación: 3 inscriptos / cupo 5 → `"3/5"`, `inscriptos: 3`, `cupo: 5`; `DISPONIBLE` con 0 → `"0/2"`; `COMPLETO` → `"2/2"`.
  - `profesor` como "Apellido, Nombre"; "—" sin aula.
  - Dos turnos al mismo horario con distinto profesor → los dos eventos, en orden por apellido del profesor.
  - `resolverFiltroProfesorDeMateria`: Profesor con ficha → su id; sin ficha → `PROFESOR_SIN_FICHA`; Mesa y Gerente → `undefined`; Alumno → `SIN_PERMISO`.
  - `obtenerCalendarioMateria`: materia inactiva/inexistente → `MATERIA_NO_ENCONTRADA`; Profesor → `listarTurnos…` recibe su `profesorId`; Mesa → no recibe `profesorId`; Profesor sin ficha → no se consulta `turnos`.
- `src/components/shared/evento-calendario-materia.test.tsx`: muestra profesor, "Alumnos: 3/5", aula, texto de estado e ícono distinto por estado; `href` = `/turnos/{id}?volver={encodeURIComponent(url)}`; `aria-label` completo.

### Verificación estática y build

| Comando | Esperado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npm run lint` | Sin errores nuevos |
| `npm test` | Todo verde (calendario incluido), mismos skips que hoy |
| `npm run build` | Aparecen `/calendario/materia` y `/api/calendario/materia/[materiaId]` |

### Nivel 2 — Postman / curl

Con sesiones reales (`mesa.entrada@`, `gerente@`, `profesor1@` = Giménez, `profesor3@` = Vega, `alumno01@`) y los turnos de prueba de §4.0 creados por el flujo real:

| Caso | Esperado |
|---|---|
| Gerente, Matemática, semana actual | `200`; rango lunes–viernes; eventos de Giménez, Castro y Vega; `alumnos_inscriptos` correctos (`1/1`, `1/3`, `3/5`); sin el `PENDIENTE` |
| Mesa de Entrada, mismo request | `200`, mismos eventos |
| Profesor Giménez, Matemática | `200`; **solo** sus turnos (sin Castro ni Vega); sin el `PENDIENTE` propio |
| Profesor Vega, Matemática | `200`; solo `seed-turno-13` / su turno |
| Profesor Giménez, Química (no la dicta) | `403 SIN_PERMISO` |
| `?semana_inicio=` miércoles | `200`, rango normalizado al lunes |
| `?semana_inicio=2026-02-31` | `400 VALIDACION` |
| Materia inactiva (Historia de la Ciencia) | `404 MATERIA_NO_ENCONTRADA` |
| Materia inexistente | `404 MATERIA_NO_ENCONTRADA` |
| Alumno | `403 SIN_PERMISO` |
| Sin sesión | `401 SESION_INVALIDA` |

### Nivel 3 — BD / TablePlus

- Los eventos de la API coinciden con `SELECT … FROM turnos WHERE "materiaId" = … AND "estadoTurno" IN ('DISPONIBLE','COMPLETO') AND "fechaTurno" >= … AND "fechaTurno" < …`.
- La ocupación coincide con `COUNT(*)` de `turno_alumno` por turno y `cupoMaximoTurno`.
- Ninguna escritura: el módulo J solo usa `findMany` / `findFirst` / `findUnique`.

### Prueba manual (UI) — checklist por criterio

**Criterio 1 — selección, semana actual, rango y alcance por rol**
- [x] Como Gerente, `/calendario/materia` muestra "Seleccioná una materia para ver sus turnos" y el selector. *(HTML con sesión real, §9)*
- [x] El selector lista solo materias activas: aparece "Matemática (MAT101)", "Química" (sin código, sin paréntesis) y **no** "Historia de la Ciencia". *(HTML con sesión real, §9)*
- [ ] Al elegir Matemática abre en la semana actual (columna de hoy resaltada) y el encabezado dice "Semana del dd/mm al dd/mm/aaaa" con días operativos.
- [ ] Gerente y Mesa ven los turnos de todos los profesores de la materia.
- [ ] Como Profesor (Giménez) el título es "Mis turnos por materia", ve el selector **solo con sus materias** (Física, Matemática) y en Matemática solo aparecen sus turnos (no los de Castro ni Vega). *(Título y selector verificados, §9; el filtro de turnos ajenos necesita los turnos de §4.0.)*
- [ ] Como Profesor, `?materiaId=` de una materia que no dicta (Química) → aviso "No tenés permisos para ver los turnos de esa materia" ✅ (§9); API → `403` ✅.
- [ ] Como Profesor, pegar en la URL un `materiaId` válido no revela turnos ajenos; la API del mismo `materiaId` tampoco (Nivel 2).
- [ ] Alumno → `/sin-permiso` ✅ (§9); sin sesión → `/login` (no probado en la página; la API da `401`).

**Criterio 2 — datos del evento, ocupación, superpuestos, estado**
- [ ] Cada evento muestra Hora ("08:00–09:00"), Profesor, "Alumnos: x/y", Aula y Estado.
- [ ] Un turno con 3 inscriptos y cupo 5 muestra "3/5"; uno sin alumnos, "0/y"; uno completo, "y/y" con estado "Completo".
- [ ] No aparece ningún nombre de alumno en el bloque.
- [ ] Dos turnos el lunes 08:00–09:00 con distinto profesor (Giménez y Castro) se ven uno junto al otro, cada uno a la mitad del ancho, sin taparse. Con un tercero, a un tercio cada uno y todos visibles (hover muestra el texto completo).
- [ ] El estado se lee como texto ("Disponible" / "Completo") y tiene ícono distinto; el lector de pantalla anuncia la descripción completa.
- [ ] Cada evento ocupa su intervalo completo (un turno de 2 h ocupa 4 franjas de 30 min).

**Criterio 3 — pendientes**
- [ ] El turno `PENDIENTE` de Matemática con profesor, aula y alumno cargados no aparece para Gerente, Mesa ni Giménez.
- [ ] Al confirmarlo (asignar aula por `/turnos/[id]/aula`) aparece en la vista.

**Criterio 4 — persistencia de materia y semana**
- [ ] "Siguiente" y "Anterior" cambian la semana y conservan la materia (la URL mantiene `materiaId`).
- [ ] "Hoy" vuelve a la semana actual conservando la materia.
- [ ] Cambiar de materia conserva la semana consultada.
- [ ] Recargar la página conserva materia y semana.
- [ ] Al hacer clic en un evento se abre `/turnos/[id]` con `?volver=` apuntando a `/calendario/materia?materiaId=…&semana=…`.
- [ ] "Atrás" del navegador desde el detalle vuelve con la misma materia y semana.
- [ ] Link "Volver" del detalle: **se espera que falle** hasta que el módulo C acepte `volver` de `/calendario` (§8). Registrar el resultado.

**Criterio 5 — vacío, carga, error**
- [x] Una semana sin turnos de la materia (p. ej. semana +2) muestra "No hay turnos para la materia seleccionada" sobre la grilla vacía. *(HTML con sesión real, §9)*
- [ ] Al cambiar de materia o de semana se ve "Cargando turnos de la materia" (probar con red lenta en DevTools); el encabezado y la navegación quedan visibles.
- [ ] Con la base caída (o forzando un error) aparece "No se pudo cargar el calendario de la materia" con "Reintentar", sin detalle técnico; al levantar la base, Reintentar carga la vista.
- [ ] Materia inactiva en la URL → aviso "La materia seleccionada no existe o no está activa" (no la pantalla de error).

**Criterio 6 — fuera de alcance**
- [ ] No hay selector día/semana/mes ni filtro de profesor en esta vista.

**Regresión HU-J-01**
- [ ] `/calendario/profesor` se ve y navega igual que antes (selector, "Agenda sin turnos", Anterior/Hoy/Siguiente, eventos con Alumno/Materia/Aula, "Mi agenda" para el profesor).

**Evidencia esperada:** capturas como Gerente, Mesa y Profesor sobre la misma materia y semana; superpuestos lado a lado; ocupación `3/5`; semana vacía; carga; error con Reintentar.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de implementar, incluidos los puntos "A CONFIRMAR" (§1 puntos 4 y 9). *(Se implementó de corrido por pedido del responsable; los dos puntos los resolvió en la consigna, §1.)*
- [x] Criterio 1 — selector de materias activas con código; semana actual y rango; Mesa/Gerente ven todo; Profesor solo lo suyo, filtrado en el servidor. *(Tests + API con sesiones reales. Falta verlo con dos profesores en la misma materia: seed, §4.0.)*
- [x] Criterio 2 — Hora, Profesor, Alumnos (`x/y`), Aula y Estado con texto e ícono; superpuestos lado a lado. *(Ocupación y estado verificados en API/HTML; superpuestos cubiertos por `asignarCarriles` y tests. Falta la revisión visual con turnos superpuestos reales.)*
- [x] Criterio 3 — filtro `estadoTurno IN (DISPONIBLE, COMPLETO)` en la query, verificado con un `PENDIENTE` con profesor. *(En la query y en tests con el mock que aplica el `where`. Falta con el flujo real: §6.)*
- [ ] Criterio 4 — materia y semana en la URL; Hoy vuelve a la semana actual. *(Vuelta desde el detalle: depende del módulo C, §8.)*
- [x] Criterio 5 — "No hay turnos para la materia seleccionada", carga y error con Reintentar. *(Mensaje vacío verificado en HTML; carga y error por código, falta verlos en navegador.)*
- [x] Criterio 6 — solo vista semanal, sin filtros combinados.
- [x] Reutilización: `GrillaSemanal` y helpers sin duplicar; navegación, selector, bloque del evento y estados compartidos entre `/calendario/profesor` y `/calendario/materia`; J-01 sin regresiones.
- [x] Autorización en servidor con `calendario:leer`; filtro del profesor resuelto en un único helper desde la sesión.
- [x] Materias leídas solo vía servicios públicos del módulo L; profesor vía módulo D.
- [ ] El módulo J no consulta `prisma.turno` directamente (Regla 3). *(Excepción temporal esperada, con `TODO(Regla N.° 3)` y contrato objetivo en §4.3, salvo que C publique el servicio antes.)* *(Sigue vigente: C no publicó el servicio.)*
- [x] Sin cambios en schema, migraciones, seed ni módulo C.
- [x] Solo tokens de `DESIGN.md`.
- [x] `spec_modulo_J.md` §2.2 con nota de sincronización.
- [x] `tsc`, lint, tests y build sin errores. *(§9.)*
- [ ] Niveles 2 y 3 ejecutados con evidencia. *(Nivel 2 ejecutado con los datos del seed actual, §9; faltan los casos que necesitan los turnos de §4.0. Nivel 3 pendiente.)*
- [ ] Revisión visual en navegador (grilla con superpuestos, carga y error).
- [ ] Aviso al equipo por archivos compartidos (`Sidebar.tsx`, `materia.service.ts`, componentes de J-01 movidos) y por los datos de seed faltantes.
- [ ] PR acotado a HU-J-02.

---

## 8. Pendientes y notas

### A coordinar con el dueño de turnos (módulo C)

1. **`/turnos/[id]` debe aceptar `volver` del calendario** — ya pedido en HU-J-01 §8 punto 1; esta HU lo necesita también para `/calendario/materia`. Propuesta: aceptar cualquier ruta interna que empiece con `/` y no con `//` (o, como mínimo, `/turnos?` y `/calendario/`), con un helper único, y que el link diga "Volver" en lugar de "Volver al listado" cuando viene del calendario. Aplica también a `aula`, `participantes` y `configuracion`.
2. **Servicio público `listarTurnosAgendadosPorMateria(materiaId, desde, hasta, profesorId?)`** con el contrato de §4.3 (incluye `inscriptos` y `cupo`), contractualizado en `spec_modulo_C.md`. Con él y `listarTurnosAgendadosPorProfesor()` se cierra la excepción a la Regla 3 de las dos vistas.
3. **Definición única de estados confirmados:** hoy está en `turno.service.ts:78` (`ESTADOS_AGENDADOS`), `turno.aula.service.ts:13` (`ESTADOS_CONFIRMADOS`) y, después de esta HU, `ESTADOS_CALENDARIO` en J. Con el punto 2 resuelto queda solo en C.

### A coordinar con el dueño del seed

4. **Turnos de prueba para HU-J-02** (§4.0): superpuestos de Matemática con distinto profesor, turno grupal `3/5` de un segundo profesor con cuenta (Vega), `PENDIENTE` con profesor/aula/alumno y, opcional, un `DISPONIBLE` `0/y`. Requiere `alumnos: number[]` y `estado` explícito en `TurnoSeed` y ajustar `validarDatos()`. Coincide con el pedido de HU-J-01 §8 punto 4.

### Otros

5. ~~Texto de la ocupación~~ — **resuelto por el responsable:** "Alumnos: x/y" (default, a confirmar con el equipo).
6. ~~Materias del selector para el Profesor~~ — **resuelto por el responsable:** solo las activas asociadas, con `403` si pide otra (default, a confirmar con el equipo).
7. **Orden del selector:** `listarMateriasActivas()` ordena por `nombreMateria` crudo, no por `nombreNormalizadaMateria` como el listado de HU-L-02. Con los datos actuales no hay diferencia visible; si aparece una materia con tilde inicial ("Álgebra"), avisar al dueño del módulo L. No se cambia en esta HU (la función la usan otros flujos).
8. **Legibilidad con 3+ superpuestos:** evaluar en la prueba manual (§1 punto 5).
9. **Spec J:** además de la nota de §2.2, §3 menciona `lib/services/calendario/calendario.service.ts`; la ubicación real es `src/server/calendario/calendario.service.ts` (Regla N.° 11). Corregir en la misma nota.

---

## 9. Estado de implementación (24/09/2026)

### Hecho

- **Refactor compartido de J-01**, sin cambio de comportamiento:
  - `calendario.service.ts`: `ESTADOS_CALENDARIO`, `whereTurnosCalendario()`, `SELECT_EVENTO_BASE` + `eventoBase()` y `semanaDelCalendario()` compartidos. `listarTurnosAgendadosDeProfesor()` mantiene firma, `where` y forma del dato.
  - `components/shared`: `BloqueEventoCalendario` (evento con link `?volver=`, horario, estado con texto e ícono), `NavegacionSemana` (recibe los `href`), `SelectorCalendario` (genérico por ruta y parámetro), `estado-calendario.tsx` (carga, aviso, vacío) y `error-calendario.tsx` (Reintentar).
  - `/calendario/profesor` usa esos componentes con los mismos textos. Se eliminaron `profesor/navegacion-semana.tsx` y `profesor/selector-profesor.tsx`.
- **Vista por materia:** `/calendario/materia?materiaId=&semana=` y `GET /api/calendario/materia/[materiaId]`, criterios 1 a 6 según §1. Servicio público nuevo del módulo L: `obtenerOpcionMateriaActiva()`. Sidebar: "Agenda por materia" (Mesa, Gerente) y "Mis turnos por materia" (Profesor).
- **Spec J:** nota de sincronización en §2.2.

### Verificación

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores ni warnings |
| `npm test` | ✅ 27 archivos pasan y 1 se omite (`turno.reservas.pg.test.ts`); `309 passed \| 7 skipped` (antes: `284 passed \| 7 skipped`). Calendario: servicio 31, helpers 17, componente 4 |
| `npm run build` | ✅ compila; aparecen `/calendario/materia`, `/calendario/profesor`, `/api/calendario/materia/[materiaId]` y `/api/calendario/profesor/[profesorId]` |

**Humo con sesiones reales** (`next dev`, base `noctium_dev` con el seed actual, solo lectura, semana del 21/09/2026):

| Caso | Resultado |
|---|---|
| Gerente, Matemática | ✅ `200`, rango `2026-09-21`–`2026-09-25`, `seed-turno-01` con `profesor: "Giménez, Laura"`, `alumnos_inscriptos: "1/1"`, `COMPLETO` |
| Mesa, Matemática, `semana_inicio` = miércoles siguiente | ✅ `200`, rango normalizado `2026-09-28`–`2026-10-02`, `seed-turno-10` `"1/3"` `DISPONIBLE` |
| Profesor Giménez, Matemática | ✅ `200`, solo su turno |
| Profesor Giménez, Química (no la dicta) | ✅ `403 SIN_PERMISO` |
| Gerente, Historia de la Ciencia (inactiva) | ✅ `404 MATERIA_NO_ENCONTRADA` |
| `semana_inicio=2026-02-31` | ✅ `400 VALIDACION` |
| Alumno / sin sesión | ✅ `403` / `401` |
| HTML Gerente | ✅ selector con "Matemática (MAT101)", "Química" y sin "Historia de la Ciencia"; "Seleccioná una materia para ver sus turnos"; con materia: "Semana del 21/09 al 25/09/2026", "Alumnos: 1/1", `volver=%2Fcalendario%2Fmateria%3FmateriaId%3D…%26semana%3D2026-09-21`; semana +2: "No hay turnos para la materia seleccionada" |
| HTML Profesor Giménez | ✅ "Mis turnos por materia", selector solo con Física (FIS101) y Matemática (MAT101); Química por URL → "No tenés permisos para ver los turnos de esa materia" |
| Alumno en `/calendario/materia` | ✅ `307` → `/sin-permiso` |
| Regresión J-01 (HTML "Mi agenda" de Giménez) | ✅ eventos con alumno, íconos `calendar-check`/`users`, `volver` a `/calendario/profesor`, "Agenda sin turnos" en semana vacía; API con `profesorId` ajeno → `403` |

### Pendiente (de otros dueños)

- **Módulo C — `?volver=` en `/turnos/[id]`** (§8 punto 1): el evento ya manda el `volver` correcto, pero el detalle vuelve a `/turnos`. Criterio 4 queda **parcial** en la vuelta desde el detalle (el "atrás" del navegador sí conserva materia y semana).
- **Módulo C — `listarTurnosAgendadosPorMateria()`** (§8 punto 2): la excepción a la Regla 3 sigue con `TODO(Regla N.° 3)`.
- **Seed** (§4.0, §8 punto 4): faltan turnos superpuestos de distinto profesor, un turno grupal `3/5` de un segundo profesor con cuenta y un `PENDIENTE` con profesor. Hasta entonces, esos casos se prueban creando los turnos por el flujo real (§6).

### Pendiente (de esta HU)

- Prueba manual en navegador con los turnos de §4.0 creados por el flujo real (superpuestos, `3/5`, pendiente excluido, carga y error con Reintentar), Nivel 3 y capturas.
- Confirmación del equipo de los dos defaults ("Alumnos: x/y" y selector del profesor limitado a sus materias).
- Aviso al equipo por los archivos compartidos tocados (`Sidebar.tsx`, `materia.service.ts`, componentes de J-01 movidos).
