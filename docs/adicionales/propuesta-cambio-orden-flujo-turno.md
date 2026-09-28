# Propuesta de cambio — Nuevo orden del flujo de registro de turno

**Módulo afectado:** C (Turno) — con dependencia directa de D (Profesor, horario de atención)
**Origen del pedido:** cliente, priorizado por los PO anteriores para este incremento (Sprint 2).
**Estado:** ✅ APROBADA por el PO (27/09/2026).
**Nota de alcance de este documento:** esto captura la decisión de negocio para que el Scrum Master la contractualice — **no** redacta ni modifica `spec_modulo_C.md` ni ningún task; esa redacción sigue siendo responsabilidad del Scrum Master, según la metodología del equipo (`docs/adicionales/sdd-metodologia.md`).

---

## 1. Situación actual

El flujo vigente (`spec_modulo_C.md`, Revisión 4, ya implementado y verificado en navegador) es:

**Configurar turno** (fecha, hora, materia, duración) → **Asignar aula** (fija el cupo automáticamente) → **Asignar profesor y alumnos** (confirma el turno).

**Problema:** Mesa de Entradas puede completar fecha y hora sin saber todavía si existe algún profesor disponible en ese momento para la materia elegida. La falta de disponibilidad de profesor recién se descubre en el último paso del flujo (HU-C-04), después de haber invertido tiempo configurando fecha, hora, duración y aula.

## 2. Cambio propuesto

Nuevo orden:

**Elegir Materia → Elegir Profesor → Elegir Fecha y Horario → Elegir Aula → Agregar Alumnos**

- **Materia:** sin cambios respecto a hoy — filtra a los profesores del paso siguiente (misma asociación de `HU-D-03`).
- **Profesor:** se elige antes que la fecha/hora, no al final. Solo se ofrecen profesores activos asociados a la materia elegida.
- **Fecha y Horario:** las opciones ofrecidas se calculan cruzando el horario de atención registrado del profesor elegido (`HU-D-04`) con los turnos que ese profesor ya tiene confirmados (`Disponible`/`Completo`) — mismo criterio de superposición que ya usa hoy la validación de `HU-C-04`, pero aplicado para **generar opciones**, no solo para validar al final.
- **Aula:** sin cambios de comportamiento — sigue fijando el cupo automáticamente según su capacidad (`HU-C-15`, Revisión 3), solo que ahora es el cuarto paso en vez del segundo.
- **Alumnos:** sin cambios — la cantidad admitida sigue dependiendo del cupo fijado por el aula.

**Motivo:** mover la restricción más difícil de cumplir (disponibilidad real del profesor) al principio del flujo, para que Mesa de Entradas nunca llegue a configurar fecha/hora/aula de un turno que después no se puede confirmar por falta de profesor.

## 3. Alcance — flujo de Mesa de Entradas

- **Reemplaza por completo** el flujo vigente (Revisión 4) — no convive con él. Implica reabrir `HU-C-03`, `HU-C-04` y `HU-C-15`, ya implementadas y verificadas tres veces distintas en este sprint.
- **HU-C-07 (Mostrar horarios disponibles del profesor, Sprint 2) cambia de naturaleza:** deja de ser una ayuda visual dentro del selector de profesor de HU-C-04 y pasa a ser **el mecanismo que calcula las opciones del nuevo paso "Elegir Fecha y Horario"**. Su alcance debe redactarse en consecuencia — ya no es un complemento, es un paso central del flujo.
- **HU-C-16 (Mostrar aulas disponibles según horario, Sprint 2) no cambia de contenido**, solo de posición: sigue siendo el filtro del paso "Elegir Aula", que ahora es el cuarto paso en vez del segundo.

## 4. Alcance — autoservicio del alumno (HU-C-12 / HU-C-13, Sprint 2)

**Aclaración importante de alcance, definida en esta propuesta:** el alumno **no crea turnos nuevos**. Su flujo de autoservicio (`HU-C-12`, "Solicitar turno propio") es una **inscripción a un turno ya existente**, no un wizard de creación:

- El alumno elige Materia → Profesor → Horario, pero solo entre las combinaciones que **ya existen** como turnos configurados por Mesa de Entradas (en un estado que admite inscripción).
- El alumno **no elige aula** — el aula ya viene asignada al turno existente que está eligiendo.
- Si no existe ningún turno ya creado que combine la materia/profesor/horario que el alumno busca, no hay nada para ofrecerle — el alumno no puede generar esa combinación por su cuenta.

Esto resuelve el punto abierto que había quedado registrado en `docs/adicionales/mapa-pantallas-sprint-2.md` §3 sobre si HU-C-12 comparte componentes con el wizard de Mesa de Entradas: comparte el *criterio de filtrado* (materia → profesor → horario), pero es una pantalla distinta y más simple, sin los pasos de aula ni de creación.

## 5. HUs a reabrir/redefinir (trabajo del Scrum Master, no de este documento)

| HU | Qué cambia |
|---|---|
| HU-C-03 (Configurar turno) | El paso de fecha/hora deja de ser independiente del profesor — pasa a depender de la elección previa de profesor |
| HU-C-04 (Asignar profesor y alumnos) | El profesor se elige al principio del flujo, no al final; deja de ser el paso que "descubre" la falta de disponibilidad |
| HU-C-15 (Asignar aula) | Sin cambio de contenido — pasa a ser el 4to paso en vez del 2do |
| HU-C-07 (Sprint 2) | Redefinición de alcance: de "ayuda visual" a "mecanismo central" del paso "Elegir Fecha y Horario" |
| HU-C-16 (Sprint 2) | Sin cambio de contenido — cambia su posición en el flujo |
| HU-C-12 / HU-C-13 (Sprint 2) | Aclaración de alcance: inscripción a turno existente, nunca creación (ver sección 4) |

## 6. Fuera de alcance

- No se modifica la fórmula de superposición (`intervalosSeSuperponen`) ni el diseño de `reservas_turno` — ambos ya operan sobre el intervalo real del turno, sin asumir un orden de asignación (confirmado en `spec_modulo_C.md` §3.4, sin cambios esperados).
- No se modifica `HU-D-04` (registro de horario de atención del profesor) — este cambio lo consume tal cual, no le agrega ni le quita nada.
- No se define en este documento el detalle de contrato (schemas, rutas, eventos) de las HU reabiertas — eso es responsabilidad del Scrum Master en la spec.

## 7. Próximos pasos

1. ~~Aprobación de la propuesta~~ — **APROBADA, 27/09/2026.**
2. Scrum Master redacta `spec_modulo_C.md` Revisión 5 con el nuevo orden del flujo.
3. Scrum Master reabre/redacta los tasks de la tabla de la sección 5.
4. Actualizar `docs/adicionales/mapa-pantallas-sprint-2.md` para reflejar el nuevo orden del wizard y la aclaración de HU-C-12/C-13 (seguimiento de este PO).