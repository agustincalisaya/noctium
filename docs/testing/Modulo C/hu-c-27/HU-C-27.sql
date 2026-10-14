-- HU-C-27 — Nivel 3 (BD). Solo lectura: correr dentro de una transacción READ ONLY.
--   psql -d <base> -v ON_ERROR_STOP=1 -f HU-C-27.sql
BEGIN TRANSACTION READ ONLY;

-- 1) Los tres índices del listado (criterio 12).
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'turnos' AND indexname LIKE 'turnos_%_idx'
ORDER BY indexname;

-- Con pocas filas PostgreSQL puede preferir Seq Scan; para mostrar que el
-- plan puede usar los índices se desactiva solo en esta transacción.
SET LOCAL enable_seqscan = off;

-- 2) «Todas», primera página, orden ascendente.
EXPLAIN (COSTS OFF)
SELECT "idTurno" FROM turnos
ORDER BY "fechaTurno" ASC, "horaInicioTurno" ASC, "profesorId" ASC NULLS LAST, "idTurno" ASC
LIMIT 10;

-- 3) «Anteriores», la más reciente primero.
EXPLAIN (COSTS OFF)
SELECT "idTurno" FROM turnos
WHERE "fechaTurno" < DATE '2026-10-13'
ORDER BY "fechaTurno" DESC, "horaInicioTurno" DESC
LIMIT 10;

-- 4) Por profesor y por materia, con la fecha.
EXPLAIN (COSTS OFF)
SELECT "idTurno" FROM turnos WHERE "profesorId" = 'x' AND "fechaTurno" = DATE '2026-10-13';
EXPLAIN (COSTS OFF)
SELECT "idTurno" FROM turnos WHERE "materiaId" = 'x' AND "fechaTurno" >= DATE '2026-10-14';

-- 5) Clases del seed de HU-C-27 (criterios 2, 4 y 9).
SELECT t."idTurno", t."fechaTurno", to_char(t."horaInicioTurno", 'HH24:MI') AS hora, t."estadoTurno",
       m."nombreMateria", m."activaMateria", t."profesorId" IS NOT NULL AS con_profesor
FROM turnos t JOIN materias m ON m."idMateria" = t."materiaId"
WHERE t."idTurno" LIKE 'seed-turno-c27-%'
ORDER BY t."fechaTurno", t."horaInicioTurno";

-- 6) Idempotencia del seed: correr antes y después de repetir `npx prisma db seed`; los totales no cambian.
SELECT (SELECT count(*) FROM turnos) AS turnos, (SELECT count(*) FROM turno_alumno) AS inscripciones,
       (SELECT count(*) FROM pagos) AS pagos, (SELECT count(*) FROM reservas_turno) AS reservas;

-- 7) La FK de reservas_turno conserva la definición de la migración del Sprint 1
--    (la migración de HU-C-27 no la toca).
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'reservas_turno_turnoId_fkey';

ROLLBACK;
