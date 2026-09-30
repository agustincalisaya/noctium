# Cambios requeridos — Wizard de turno (`/turnos/nuevo`)

**Origen:** Relevamiento paso a paso del PO comparando la pantalla actual contra el prototipo aprobado (30/09/2026).
**Aprobado por:** Cali (PO, Sprint 2).
**No reabre:** HU-C-18, HU-C-04, HU-C-07, HU-C-16 — todas siguen **Terminadas**. Este documento define trabajo **nuevo** sobre esas mismas pantallas.
**Alcance de este documento:** describe **qué** debe cambiar, en lenguaje de producto — no cómo implementarlo. La redacción formal (spec, task, criterios de aceptación) es trabajo del Scrum Master; la implementación, del equipo de desarrollo.
**Criterio general del PO:** el frontend del wizard debe quedar **igual, calcado**, al prototipo (https://claude.ai/artifact/9VhY4YdPBzRXU4dhPrFnLo) — layout, textos e interacción — salvo las excepciones que se indican explícitamente en cada paso. Este documento describe las diferencias detectadas hasta ahora, pero **el prototipo es la referencia final**: ante cualquier duda o detalle no cubierto acá, manda lo que muestra el prototipo.

> ⚠️ **Si este documento se le pasa a Codex, Claude Code o cualquier otra IA para programar los cambios, hay que adjuntarle también el link del prototipo** (https://claude.ai/artifact/9VhY4YdPBzRXU4dhPrFnLo). Sin ver el prototipo, la IA solo va a poder seguir la lista de diferencias de este documento, pero no va a poder verificar por sí misma que el resultado quedó calcado.

---

## Encabezado y navegación del wizard (aplica a las 5 pantallas)

Estos 4 puntos se repiten idénticos en Materia, Profesor, Fecha y horario, Aula y Alumnos — es el mismo header y el mismo indicador de pasos en las 5 pantallas, así que se corrige una sola vez y queda resuelto en todas:

1. El subtítulo de arriba ("Materia · Profesor · Fecha y horario · Aula · Alumnos") debe usar flechas ("→") entre cada paso, no puntos ("·").
2. Sacar el texto repetido "Paso N de 5: `<Nombre del paso>`" que aparece arriba del indicador de pasos — es información duplicada, el indicador ya lo muestra.
3. El indicador de pasos no debe numerar los pasos ("1.", "2."...) — solo mostrar "Paso N" arriba y el nombre del paso abajo, en negrita el que está activo.
4. Dentro de la tarjeta de cada paso, no repetir "Paso N de 5" arriba del título — el título va directo, en una sola línea.

---

## Paso 1 — Materia

1. El título dentro de la tarjeta debe ser una sola línea ("Elegí la materia"), sin agregar la frase "Seleccioná la materia para este turno."
2. El texto debe decir "Elegí **la** materia", no "una materia".
3. Agregar una fila "Estado inicial" al panel Resumen (ej. "Disponible, 2 alumnos"), que hoy no existe — ver detalle general en la sección "Panel Resumen" al final de este documento.
4. Las tarjetas de materia deben mostrarse en una grilla de 3 por fila, no apiladas en una columna.
5. Mostrar en cada tarjeta de materia la cantidad de profesores que la dictan (ej. "FIS-1 · 1 profesor") — dato que hoy no llega a este paso.

## Paso 2 — Profesor

1. Las tarjetas de profesor también deben mostrarse en grilla de 3 por fila cuando haya varias opciones (mismo criterio que Materia).
2. **No mostrar como opción a un profesor que no tiene ningún horario de atención cargado** para esa materia. Hoy se puede elegir un profesor y recién en el Paso 3 aparece el mensaje "Este profesor no tiene horarios disponibles para esta materia en este momento".
   - **Alcance de este filtro:** solo excluye al profesor que **no tiene ningún horario de atención registrado**. No garantiza disponibilidad real en una fecha puntual — un profesor con horario cargado pero completo en las próximas semanas va a seguir pasando este filtro y recién se va a detectar en el Paso 3, con el mensaje de arriba y el botón "Volver a Profesor" (comportamiento ya correcto, no se toca).
   - **Decisión tomada (30/09/2026):** no se reordena el wizard para resolver el caso completo (eso implicaría pedir Fecha/Horario antes que Profesor, reabriendo el orden ya aprobado en `propuesta-cambio-orden-flujo-turno.md` y las historias que dependen de él). Se opta por esta versión acotada del filtro.

## Paso 3 — Fecha y horario

**Pedido general: calcar el frontend del prototipo para este paso**, reemplazando la interfaz actual por completo. Puntualmente:

1. **Calendario visual, no lista de fechas.** Hoy se muestra una lista plana de botones con el texto de la fecha completa (ej. "2026-10-13 · MARTES"). Debe reemplazarse por un calendario mensual real: grilla de días de la semana, navegación entre meses ("‹ Octubre 2026 ›"), y los días con horario libre marcados visualmente (verde), con una leyenda tipo "Con horarios libres" / "Seleccionado".
2. **Formato de fecha legible.** Dentro del calendario, cada casillero muestra solo el número de día; al elegir una fecha, debajo se muestra en texto legible (ej. "Sábado 3 de octubre"), no el formato técnico actual ("2026-10-13 · MARTES").
3. **Horarios ocupados visibles y tachados**, no solo omitidos. Debe mostrarse el horario completo de atención del profesor, tachando los intervalos ya ocupados, con la leyenda "Los horarios tachados no están disponibles: el profesor ya tiene un turno."
4. **Cada horario se presenta como un bloque con inicio y fin** (ej. "11:00-12:00"), no como una lista de horas de inicio sueltas cada 30 minutos sin mostrar el fin.

## Paso 4 — Aula

1. **Filtro real de disponibilidad de aulas.** Hoy se muestran todas las aulas cargadas en el sistema, sin verificar si están libres en la fecha y horario ya elegidos. Deben listarse solo las aulas que están libres en ese horario puntual.
2. **Selector en tarjetas, no en un desplegable.** Cada aula debe mostrarse como una tarjeta seleccionable (con nombre y capacidad visibles), en grilla — no como un menú desplegable.
3. **Subtítulo con la fecha y horario elegidos.** Debe decir algo como "Aulas libres el sábado 3 de octubre, 11:00–12:00", no el texto genérico actual ("Las opciones corresponden al horario guardado del turno.").
4. El texto debe decir "Elegí **el** aula", no "un aula".
5. **Sacar el texto auxiliar sobrante:** "Elegí un aula para continuar con los alumnos." y "Cupo máximo: — (capacidad del aula elegida)" no existen en el prototipo — la capacidad ya se ve directamente en cada tarjeta.
6. La capacidad debe incluir la unidad: "Capacidad 4 **alumnos**", no solo "Capacidad 10".

## Paso 5 — Alumnos

1. **Filtro de alumnos disponibles.** Hoy se puede buscar y agregar cualquier alumno, sin comprobar si ya tiene un turno en ese horario — el conflicto recién se detecta al confirmar. Deben poder elegirse solo los alumnos que están disponibles en la fecha/horario ya elegidos.
2. **Lista completa con casilleros, no un buscador que devuelve resultados.** El prototipo muestra de entrada la lista completa de alumnos, cada uno con un casillero para marcar, y un buscador arriba que filtra esa lista. Hoy no se muestra ningún alumno hasta escribir una búsqueda, y cada resultado se agrega de a uno.
3. El título debe decir "Inscribí alumnos", no "Agregá alumnos".
4. **El contador de alumnos debe ir al lado del título**, como una etiqueta (ej. "0 de 4"), con el tope igual a la **capacidad del aula elegida** — no como una línea aparte ("Alumnos (0/10)") con un número fijo de 10 sin relación con el aula.
5. **El resumen debe listar los nombres de los alumnos elegidos** (ej. "Sofía Acosta, Florencia Aguirre..."), no solo la cantidad ("1 alumno").
6. El botón final debe decir "Crear turno", no "Confirmar turno".
7. El placeholder del buscador debe decir "Buscar alumno por nombre, apellido o DNI...", no "Nombre, apellido o DNI (mínimo 2 caracteres)".
8. **Mostrar debajo del título el estado en que se va a crear el turno** (ej. "El turno se va a crear en estado Disponible, con N alumnos", actualizado en vivo a medida que se marcan alumnos) — pero **sin la palabra "Opcional"**, ya que eso ya lo definimos como un error del prototipo: el sistema exige al menos 1 alumno para confirmar.
9. Sacar el texto "Todavía no agregaste alumnos." — no existe en el prototipo, porque ahí la lista completa de alumnos ya se muestra desde el principio.

---

## Panel "Resumen" (aplica a los 5 pasos)

Falta una sexta fila **"ESTADO INICIAL"**, con el texto "Disponible, N alumnos" (actualizado en vivo según los alumnos que se van agregando en el Paso 5). Hoy el panel solo muestra MATERIA, PROFESOR, FECHA Y HORARIO, AULA y ALUMNOS.

---

## Relevamiento completo

Los 5 pasos del wizard (Materia, Profesor, Fecha y horario, Aula, Alumnos), el encabezado/navegación compartido y el panel Resumen ya fueron revisados y confirmados por el PO contra el prototipo.
