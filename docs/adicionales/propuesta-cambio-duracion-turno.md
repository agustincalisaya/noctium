# Propuesta de cambio — Duración configurable del turno (1h / 2h / 3h)

**Módulo afectado:** C (Turno)
**Origen del pedido:** cliente, informado y ampliado directamente por el PO (60/120/180 min) — no es una decisión de equipo ni surgida del uso del sistema por el Scrum Master.
**Estado:** ✅ APROBADA por el PO (24/09/2026). Se procede a redactar `spec_modulo_C.md` Revisión 4.
**Referencia normativa una vez aprobada:** pasaría a contractualizarse como `spec_modulo_C.md` Revisión 4 (aditiva sobre Revisión 3), siguiendo el mismo patrón que `propuesta-cambio-cupo-aula.md` para la Revisión 3.

---

## 1. Situación actual

Al configurar un turno (HU-C-03, `spec_modulo_C.md` §2.1), la duración es fija e implícita: `hora_fin` se calcula como `hora_inicio + DURACION_ESTANDAR_TURNO_MIN`, un parámetro de configuración del sistema, no una elección de Mesa de Entradas. El modelo `Turno` ya persiste `duracionMinutosTurno`, pero hoy ese valor siempre proviene del parámetro fijo, nunca de una decisión del usuario.

## 2. Cambio propuesto

Mesa de Entradas elige la duración del turno al configurarlo, entre tres opciones fijas:

- 1 hora (60 min)
- 2 horas (120 min)
- 3 horas (180 min)

Sin valor por defecto preseleccionado — la elección es obligatoria en cada turno nuevo.

## 3. Alcance del cambio

- **Parámetro de sistema:** `DURACION_ESTANDAR_TURNO_MIN` se reemplaza por `DURACIONES_PERMITIDAS_TURNO_MIN = [60, 120, 180]` (configurable), de forma que agregar o quitar una opción en el futuro sea un cambio de configuración, no de código.
- **HU-C-03 (2.1):** se agrega `duracion_min` (obligatorio, uno de los valores permitidos) al `ConfigurarTurnoSchema`. `hora_fin = hora_inicio + duracion_min`. La validación de horario operativo (`[hora_inicio, hora_fin)` dentro de `HORA_APERTURA`/`HORA_CIERRE`) se mantiene sin cambios de fórmula, pero ahora puede rechazar franjas de 2h o 3h que un turno de 1h en el mismo horario de inicio no rechazaría — se documentará como caso de prueba explícito.
- **Reasignación de duración:** no permitida una vez que el turno salió de `PENDIENTE` (mismo criterio que ya aplica hoy a fecha/hora, declarado "fuera de alcance" en la spec vigente). Mientras el turno esté `PENDIENTE`, puede modificarse junto con el resto de la configuración (2.1, "Modificación").
- **Sin impacto de fondo esperado en:** fórmula de superposición (`intervalosSeSuperponen`, ya trabaja con intervalos arbitrarios), el diseño de concurrencia `reservas_turno` + exclusión GiST (ya desnormaliza el rango horario por turno, no asume duración uniforme), el listado (HU-C-01) ni el calendario (HU-J-01/HU-J-02) — todos ya operan sobre `hora_inicio`/`hora_fin` calculados, sin asumir una duración fija. Este punto se confirma en el relevamiento previo con Claude Code antes de dar por cerrado el alcance.
- **Eventos de dominio:** el payload de `turno:configurado` deberá incluir la duración elegida (hoy no la lleva explícita, se infiere de `hora_inicio`/`hora_fin`).

## 4. Fuera de alcance (propuesto)

- Duraciones distintas a 60/120/180 min.
- Modificar la duración de un turno ya `DISPONIBLE` o `COMPLETO`.
- Cualquier cambio a la fórmula de superposición o al diseño de `reservas_turno` — se espera que el mecanismo existente cubra esto sin modificaciones, a confirmar en el relevamiento.

## 5. Próximos pasos

1. ~~Aprobación explícita de esta propuesta por el PO/cliente~~ — **APROBADA, 24/09/2026.**
2. Redacción de `spec_modulo_C.md` Revisión 4 (sección 2.1 ampliada + changelog), siguiendo SDD. **← en curso.**
3. Relevamiento previo con Claude Code (archivos a tocar, puntos ambiguos) antes de implementar.
4. Implementación + testing en 3 niveles (unit, Postman/curl, BD) + verificación en navegador.