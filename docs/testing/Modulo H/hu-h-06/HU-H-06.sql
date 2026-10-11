-- Lecturas de evidencia HU-H-06; no modifica datos. Ejecutar con psql/TablePlus.
-- Cambiar extremos si la demo usa otro reloj.
WITH parametros AS (
  SELECT '2024-11-01'::date AS desde, '2026-11-01'::date AS hasta_exclusivo,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy,
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS instante
), inscriptos AS (
  SELECT ta."turnoId", COUNT(*) AS cantidad
  FROM turno_alumno ta, parametros p
  WHERE ta.vigencia = 'VIGENTE'
    AND (ta."estadoPago" <> 'RESERVADA' OR ta."venceEl" IS NULL OR ta."venceEl" > p.instante
      OR NOT EXISTS (SELECT 1 FROM turnos t WHERE t."idTurno" = ta."turnoId" AND t."estadoTurno" IN ('DISPONIBLE','COMPLETO')))
  GROUP BY ta."turnoId"
), elegibles AS (
  SELECT t."idTurno", to_char(t."fechaTurno", 'YYYY-MM') AS mes,
    COALESCE(i.cantidad, 0)::numeric / t."cupoMaximoTurno" AS razon
  FROM turnos t CROSS JOIN parametros p LEFT JOIN inscriptos i ON i."turnoId" = t."idTurno"
  WHERE t."fechaTurno" >= p.desde AND t."fechaTurno" < p.hasta_exclusivo
    AND t."fechaTurno" <= p.hoy AND t."estadoTurno" IN ('DISPONIBLE','COMPLETO')
    AND t."cupoMaximoTurno" > 0
)
SELECT mes, COUNT(*) AS turnos, ROUND(AVG(razon)*100,1) AS ocupacion_promedio
FROM elegibles GROUP BY ROLLUP(mes) ORDER BY mes NULLS LAST;

-- Conteos para comparar antes/después de un segundo seed (idempotencia).
SELECT 'turnos' AS entidad, COUNT(*) FROM turnos
UNION ALL SELECT 'inscripciones', COUNT(*) FROM turno_alumno
UNION ALL SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL SELECT 'operaciones', COUNT(*) FROM operaciones_pago
UNION ALL SELECT 'comprobantes', COUNT(*) FROM comprobantes;

-- Detectar fechas de fixture duplicadas por la clave natural del profesor MAT101.
SELECT t."fechaTurno", t."horaInicioTurno", t."profesorId", t."materiaId", COUNT(*)
FROM turnos t JOIN materias m ON m."idMateria"=t."materiaId"
JOIN profesores p ON p."idProfesor"=t."profesorId"
WHERE m."codigoMateria"='MAT101' AND p."dniProfesor"='27100001'
GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
