-- Read-only: clases por mes y estado, pendientes excluidas.
SELECT to_char("fechaTurno",'YYYY-MM') mes, "estadoTurno", count(*) clases
FROM turnos WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01'
AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO') GROUP BY 1,2 ORDER BY 1,2;

-- Fecha de clase y clasificación independiente. Inscripciones de canceladas y quitadas excluidas.
SELECT to_char(t."fechaTurno",'YYYY-MM') mes,
CASE WHEN ta.vigencia='VIGENTE' AND ta."estadoPago"='RESERVADA' AND ta."venceEl" <= CURRENT_TIMESTAMP THEN 'RESERVA_VENCIDA' ELSE ta.vigencia::text END vigencia,
count(*) inscripciones FROM turno_alumno ta JOIN turnos t ON t."idTurno"=ta."turnoId"
WHERE t."estadoTurno" IN ('DISPONIBLE','COMPLETO') AND ta.vigencia <> 'QUITADA_CENTRO'
AND t."fechaTurno">=DATE '2026-05-01' AND t."fechaTurno"<DATE '2026-11-01'
GROUP BY 1,2 ORDER BY 1,2;

-- Denominadores/tasas: bajas no entran. Ninguna suma de unidades distintas.
WITH clases AS (SELECT count(*) total, count(*) FILTER (WHERE "estadoTurno"='CANCELADO') canceladas FROM turnos
WHERE "fechaTurno">=DATE '2026-05-01' AND "fechaTurno"<DATE '2026-11-01' AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO'))
SELECT total, canceladas, round(canceladas::numeric*100/nullif(total,0),1) tasa_clases FROM clases;
WITH inscripciones AS (SELECT count(*) total, count(*) FILTER (WHERE ta.vigencia='CANCELADA_ALUMNO') canceladas FROM turno_alumno ta JOIN turnos t ON t."idTurno"=ta."turnoId"
WHERE t."fechaTurno">=DATE '2026-05-01' AND t."fechaTurno"<DATE '2026-11-01' AND t."estadoTurno" IN ('DISPONIBLE','COMPLETO') AND ta.vigencia IN ('VIGENTE','CANCELADA_ALUMNO','RESERVA_VENCIDA'))
SELECT total,canceladas,round(canceladas::numeric*100/nullif(total,0),1) tasa_inscripciones FROM inscripciones;

-- Dos series por materia; reservas y bajas excluidas.
WITH centro AS (SELECT "materiaId" id,count(*) cantidad FROM turnos WHERE "fechaTurno">=DATE '2026-05-01' AND "fechaTurno"<DATE '2026-11-01' AND "estadoTurno"='CANCELADO' GROUP BY 1),
alumno AS (SELECT t."materiaId" id,count(*) cantidad FROM turno_alumno ta JOIN turnos t ON t."idTurno"=ta."turnoId" WHERE t."fechaTurno">=DATE '2026-05-01' AND t."fechaTurno"<DATE '2026-11-01' AND t."estadoTurno" IN ('DISPONIBLE','COMPLETO') AND ta.vigencia='CANCELADA_ALUMNO' GROUP BY 1)
SELECT m."nombreMateria",m."activaMateria",COALESCE(c.cantidad,0) clases_centro,COALESCE(a.cantidad,0) inscripciones_alumno FROM materias m LEFT JOIN centro c ON c.id=m."idMateria" LEFT JOIN alumno a ON a.id=m."idMateria" WHERE COALESCE(c.cantidad,0)+COALESCE(a.cantidad,0)>0 ORDER BY clases_centro DESC,inscripciones_alumno DESC,m."nombreMateria";
