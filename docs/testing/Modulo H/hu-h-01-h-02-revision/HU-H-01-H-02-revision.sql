-- Queries de contraste nivel 3 (HU-H-01/H-02 revisadas). Columnas reales del schema.
\echo '=== Ingresos: suma manual de contraste (rango 2026-05..2026-10) ==='
SELECT to_char(date_trunc('month', "fechaPago"), 'YYYY-MM') AS mes, SUM("montoPago") AS total
FROM pagos
WHERE "fechaPago" BETWEEN DATE '2026-05-01' AND DATE '2026-10-31'
GROUP BY 1 ORDER BY 1;

\echo '=== Ocupación: promedio manual de contraste (DISPONIBLE/COMPLETO, cupo > 0, fecha <= hoy BA) ==='
SELECT to_char(date_trunc('month', t."fechaTurno"), 'YYYY-MM') AS mes,
       ROUND((AVG((SELECT COUNT(*) FROM turno_alumno ta WHERE ta."turnoId" = t."idTurno")::float / t."cupoMaximoTurno") * 100)::numeric, 1) AS ocupacion_pct,
       COUNT(*) AS turnos
FROM turnos t
WHERE t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') AND t."cupoMaximoTurno" IS NOT NULL AND t."cupoMaximoTurno" > 0
  AND t."fechaTurno" BETWEEN DATE '2026-05-01' AND DATE '2026-10-31'
  AND t."fechaTurno" <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
GROUP BY 1 ORDER BY 1;

\echo '=== Control: si se incluyeran CANCELADO y PENDIENTE (NO debe coincidir con la API) ==='
SELECT to_char(date_trunc('month', t."fechaTurno"), 'YYYY-MM') AS mes,
       ROUND((AVG((SELECT COUNT(*) FROM turno_alumno ta WHERE ta."turnoId" = t."idTurno")::float / NULLIF(t."cupoMaximoTurno", 0)) * 100)::numeric, 1) AS ocupacion_pct_incorrecta
FROM turnos t
WHERE t."fechaTurno" BETWEEN DATE '2026-07-01' AND DATE '2026-08-31'
GROUP BY 1 ORDER BY 1;

\echo '=== Fixture: turnos de contraste y su estado ==='
SELECT "idTurno", "fechaTurno", "estadoTurno", "cupoMaximoTurno",
       (SELECT COUNT(*) FROM turno_alumno ta WHERE ta."turnoId" = t."idTurno") AS inscriptos
FROM turnos t WHERE "idTurno" LIKE 'ctr-%' ORDER BY "fechaTurno";

\echo '=== Pago de un turno CANCELADO: cuenta como ingreso (P1, propuesta por defecto) ==='
SELECT p."idPago", p."fechaPago", p."montoPago", t."estadoTurno" FROM pagos p JOIN turnos t ON t."idTurno" = p."turnoId" WHERE p."idPago" = 'ctr-p4';

-- Fixture usado en la base temporal:
-- -- Fixture de contraste HU-H-01/H-02 revisadas (solo base temporal noctium_tmp_hu_h_rev2).
-- BEGIN;
-- INSERT INTO turnos ("idTurno","fechaTurno","horaInicioTurno","duracionMinutosTurno","cupoMaximoTurno","estadoTurno","materiaId","updatedAtTurno") VALUES
--  ('ctr-t1','2026-07-10','07:00',60,4,'DISPONIBLE','cmupa69lk004buwhwj45bqm7x',now()),
--  ('ctr-t2','2026-07-20','07:00',60,2,'COMPLETO','cmupa69lk004buwhwj45bqm7x',now()),
--  ('ctr-t3','2026-08-05','07:00',60,3,'DISPONIBLE','cmupa69lk004buwhwj45bqm7x',now()),
--  ('ctr-t4','2026-08-12','07:00',60,2,'CANCELADO','cmupa69lk004buwhwj45bqm7x',now()),
--  ('ctr-t5','2026-08-15','07:00',60,NULL,'PENDIENTE','cmupa69lk004buwhwj45bqm7x',now()),
--  ('ctr-t6','2026-09-30','07:00',60,4,'DISPONIBLE','cmupa69lk004buwhwj45bqm7x',now()),
--  ('ctr-t7','2026-10-20','07:00',60,4,'DISPONIBLE','cmupa69lk004buwhwj45bqm7x',now());
-- INSERT INTO turno_alumno ("turnoId","alumnoId") VALUES
--  ('ctr-t1','cmupa693f000iuwhwxe082ic1'),
--  ('ctr-t2','cmupa693f000iuwhwxe082ic1'),('ctr-t2','cmupa693q000kuwhwuxposuq7'),
--  ('ctr-t3','cmupa693f000iuwhwxe082ic1'),('ctr-t3','cmupa693q000kuwhwuxposuq7'),
--  ('ctr-t4','cmupa693f000iuwhwxe082ic1'),('ctr-t4','cmupa693q000kuwhwuxposuq7'),
--  ('ctr-t6','cmupa693f000iuwhwxe082ic1'),('ctr-t6','cmupa693q000kuwhwuxposuq7'),('ctr-t6','cmupa693x000muwhwf9vo5jcg');
-- INSERT INTO pagos ("idPago","turnoId","alumnoId","montoPago","formaPagoId","fechaPago") VALUES
--  ('ctr-p1','ctr-t1','cmupa693f000iuwhwxe082ic1',10000.00,'formapago-efectivo','2026-05-15'),
--  ('ctr-p2','ctr-t1','cmupa693f000iuwhwxe082ic1',0.10,'formapago-efectivo','2026-07-10'),
--  ('ctr-p3','ctr-t2','cmupa693q000kuwhwuxposuq7',0.20,'formapago-efectivo','2026-07-31'),
--  ('ctr-p4','ctr-t4','cmupa693f000iuwhwxe082ic1',15000.50,'formapago-efectivo','2026-08-12');
-- COMMIT;
