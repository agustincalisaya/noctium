-- Solo lectura. Preparar datos mediante fábricas existentes en una base NUEVA
-- noctium_pruebas_<8 hex>. No ejecutar sobre noctium_test ni una base habitual.
-- Reemplazar TURNO_ID y ALUMNO_ID; capturar antes/después del GET y del rechazo.
BEGIN READ ONLY;
DO $$
BEGIN
  IF current_database() !~ '^noctium_pruebas_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'C-22 requiere una base aleatoria descartable';
  END IF;
END $$;

WITH caso AS (SELECT 'TURNO_ID'::text AS turno_id)
SELECT current_database() AS base_descartable,
  (SELECT to_jsonb(t) FROM turnos t, caso c WHERE t."idTurno" = c.turno_id) AS clase,
  (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i."idInscripcion"), '[]'::jsonb)
    FROM turno_alumno i, caso c WHERE i."turnoId" = c.turno_id) AS inscripciones,
  (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r."tipoRecurso", r."recursoId"), '[]'::jsonb)
    FROM reservas_turno r, caso c WHERE r."turnoId" = c.turno_id) AS proyecciones,
  (SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e."idEvento"), '[]'::jsonb)
    FROM eventos_turno e, caso c WHERE e."turnoId" = c.turno_id) AS eventos,
  (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h."idHistorialInscripcion"), '[]'::jsonb)
    FROM historial_inscripciones h JOIN turno_alumno i ON i."idInscripcion" = h."inscripcionId"
    JOIN caso c ON c.turno_id = i."turnoId") AS historial;

-- POST propio: una fila VIGENTE/RESERVADA, actor de sesión, precio congelado,
-- venceBaseEl = inicioPlazo + período original; venceEl limitado al inicio.
-- Tras variar tarifa/plazo del fixture, precio/base originales no cambian.
-- Reprogramar mediante servicio real cambia solo el tope, sin resucitar vencidas.
SELECT i."idInscripcion", i."alumnoId", i.vigencia, i."estadoPago", i.precio,
  i."reservadaEl", i."inicioPlazo", i."venceBaseEl", i."venceEl",
  i."reabiertaPorAnulacion", i."creadoPorUsuarioId",
  i."finalizadaEl", i."finalizadaPorUsuarioId", i."finalizadaPorActorTipo",
  m."tarifaHoraMateria", t."duracionMinutosTurno",
  m."tarifaHoraMateria" * t."duracionMinutosTurno" / 60 AS precio_segun_tarifa_actual,
  i."venceBaseEl" - i."inicioPlazo" AS periodo_original,
  i."venceEl" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires' AS vence_hora_centro
FROM turno_alumno i JOIN turnos t ON t."idTurno" = i."turnoId"
JOIN materias m ON m."idMateria" = t."materiaId"
WHERE i."turnoId" = 'TURNO_ID' AND i."alumnoId" = 'ALUMNO_ID'
ORDER BY i."reservadaEl", i."idInscripcion";

-- Pagos pertenecen a UNA inscripción. Esta consulta conserva toda su historia;
-- no decide si el pago está anulado: esa regla se prueba con PR 0, no SQL parcial.
SELECT p."idPago", p."inscripcionId", p."operacionId", p.precio, p."montoPago"
FROM pagos p JOIN turno_alumno i ON i."idInscripcion" = p."inscripcionId"
WHERE i."turnoId" = 'TURNO_ID' AND i."alumnoId" = 'ALUMNO_ID'
ORDER BY p."inscripcionId", p."idPago";
COMMIT;
