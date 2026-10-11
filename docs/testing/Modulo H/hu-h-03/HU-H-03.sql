-- Solo lectura. Contraste mayo–octubre de 2026, inclusive. No modifica datos.
SELECT m."idMateria", m."nombreMateria", m."activaMateria", count(t."idTurno")::int AS clases
FROM materias m LEFT JOIN turnos t ON t."materiaId" = m."idMateria"
AND t."fechaTurno" >= DATE '2026-05-01' AND t."fechaTurno" < DATE '2026-11-01'
AND t."estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO')
GROUP BY m."idMateria" HAVING m."activaMateria" OR count(t."idTurno") > 0
ORDER BY clases DESC, m."nombreMateria", m."idMateria";

SELECT p."idProfesor", p."apellidoProfesor", p."nombreProfesor", p."activoProfesor", count(t."idTurno")::int AS clases,
round(COALESCE(sum(CASE WHEN t."estadoTurno" IN ('DISPONIBLE','COMPLETO') THEN t."duracionMinutosTurno" ELSE 0 END),0)::numeric/60,2) AS horas
FROM profesores p LEFT JOIN turnos t ON t."profesorId" = p."idProfesor"
AND t."fechaTurno" >= DATE '2026-05-01' AND t."fechaTurno" < DATE '2026-11-01'
AND t."estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO')
GROUP BY p."idProfesor" HAVING p."activoProfesor" OR count(t."idTurno") > 0
ORDER BY clases DESC, horas DESC, p."apellidoProfesor", p."nombreProfesor", p."idProfesor";

SELECT "estadoTurno", count(*), sum("duracionMinutosTurno") FROM turnos
WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01' GROUP BY 1 ORDER BY 1;
