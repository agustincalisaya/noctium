-- C-20: ejecutar únicamente en la base aleatoria descartable del runner.
-- Evidencia manual pendiente; las pruebas PG automatizadas usan las fábricas existentes.
-- Sustituir el id por el de la clase de prueba. No hay resets ni cambios de datos.
-- Capturar el mismo resultado antes/después de GET: debe ser idéntico.
-- Tras POST rechazado: capturar DESPUÉS de introducir el cambio de cupo/
-- superposición y comparar con el resultado posterior al rechazo.
BEGIN READ ONLY;
DO $$
BEGIN
  IF current_database() !~ '^noctium_pruebas_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'C-20 SQL requiere una base aleatoria descartable; no usar bases habituales';
  END IF;
END $$;

WITH caso AS (SELECT 'REEMPLAZAR_TURNO_ID_DE_PRUEBA'::text AS turno_id)
SELECT current_database() AS base_descartable,
  (SELECT to_jsonb(t) FROM turnos t, caso c WHERE t."idTurno" = c.turno_id) AS clase,
  (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i."idInscripcion"), '[]'::jsonb)
     FROM turno_alumno i, caso c WHERE i."turnoId" = c.turno_id) AS inscripciones,
  (SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e."idEvento"), '[]'::jsonb)
     FROM eventos_turno e, caso c WHERE e."turnoId" = c.turno_id) AS eventos,
  (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r."tipoRecurso", r."recursoId"), '[]'::jsonb)
     FROM reservas_turno r, caso c WHERE r."turnoId" = c.turno_id) AS proyecciones,
  (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h."idHistorialInscripcion"), '[]'::jsonb)
     FROM historial_inscripciones h JOIN turno_alumno i ON i."idInscripcion" = h."inscripcionId"
     JOIN caso c ON c.turno_id = i."turnoId") AS historial;

-- POST exitoso interino: VIGENTE/PAGO_SIN_REGISTRAR, venceEl null,
-- precio entero guardado, creadoPorUsuarioId de la sesión, historial de alta
-- y turno:alumno_agregado. Si completa cupo también turno:completado.
-- GET -> cambio de tarifa -> POST puede guardar un importe distinto del GET.
-- Un cambio de tarifa posterior al alta no debe cambiar i.precio.
WITH caso AS (SELECT 'REEMPLAZAR_TURNO_ID_DE_PRUEBA'::text AS turno_id)
SELECT i."idInscripcion", i."alumnoId", i.vigencia, i."estadoPago", i.precio,
  i."venceEl", i."creadoPorUsuarioId", i."createdAtInscripcion",
  m."tarifaHoraMateria" AS tarifa_actual,
  t."duracionMinutosTurno" AS duracion,
  m."tarifaHoraMateria" * t."duracionMinutosTurno" / 60 AS importe_segun_tarifa_actual
FROM turno_alumno i JOIN caso c ON i."turnoId" = c.turno_id
JOIN turnos t ON t."idTurno" = i."turnoId"
JOIN materias m ON m."idMateria" = t."materiaId"
ORDER BY i."idInscripcion";
COMMIT;
