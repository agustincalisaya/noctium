-- HU-C-21 — Nivel 3: verificación SQL de un lote generado con aula por fecha y fechas excluidas.
-- Solo lectura. Reemplazar:
--   GENERACION_ID  → `generacion_id` de la respuesta 201 (id de la primera clase del lote)
--   FECHA_EXCLUIDA → una fecha de `fechas_excluidas` del pedido (AAAA-MM-DD)
-- Los tests automáticos equivalentes están en src/server/turnos/turno.generacion.pg.test.ts
-- («HU-C-21 Fase 3» y «Fase 5»), que corren en una base descartable con `npm run test:pg`.
BEGIN READ ONLY;

-- 1) Clases del lote: cada una con el aula y el cupo de SU fecha; todas DISPONIBLE y sin alumnos.
--    `cupo_es_capacidad_del_aula` tiene que ser true en todas las filas.
WITH lote AS (
  SELECT e."turnoId" FROM eventos_turno e
  WHERE e."tipoEvento" = 'turno:configurado' AND e."payloadEvento"->>'generacion_id' = 'GENERACION_ID'
)
SELECT t."idTurno", t."fechaTurno", to_char(t."horaInicioTurno", 'HH24:MI') AS hora, t."duracionMinutosTurno",
  t."estadoTurno", a."nombreAula", t."cupoMaximoTurno", a."capacidadAula",
  t."cupoMaximoTurno" = a."capacidadAula" AS cupo_es_capacidad_del_aula,
  (SELECT count(*) FROM turno_alumno i WHERE i."turnoId" = t."idTurno") AS alumnos
FROM turnos t JOIN lote l ON l."turnoId" = t."idTurno" JOIN aulas a ON a."idAula" = t."aulaId"
ORDER BY t."fechaTurno";

-- 2) La fecha excluida no tiene clase del lote (misma materia, profesor y hora) ni reservas propias.
--    Tiene que devolver 0 en las dos columnas.
WITH primera AS (SELECT * FROM turnos WHERE "idTurno" = 'GENERACION_ID')
SELECT
  (SELECT count(*) FROM turnos t, primera p
    WHERE t."fechaTurno" = DATE 'FECHA_EXCLUIDA' AND t."materiaId" = p."materiaId" AND t."profesorId" = p."profesorId"
      AND t."horaInicioTurno" = p."horaInicioTurno" AND t."creadoPorUsuarioId" = p."creadoPorUsuarioId") AS clases_en_fecha_excluida,
  (SELECT count(*) FROM reservas_turno r JOIN turnos t ON t."idTurno" = r."turnoId", primera p
    WHERE t."fechaTurno" = DATE 'FECHA_EXCLUIDA' AND t."materiaId" = p."materiaId" AND t."profesorId" = p."profesorId"
      AND t."horaInicioTurno" = p."horaInicioTurno") AS reservas_en_fecha_excluida;

-- 3) Reservas: una de AULA con el aula de cada clase y una de PROFESOR en todas.
--    `aula_reservada_es_la_de_la_clase` tiene que ser true en todas las filas.
WITH lote AS (
  SELECT e."turnoId" FROM eventos_turno e
  WHERE e."tipoEvento" = 'turno:configurado' AND e."payloadEvento"->>'generacion_id' = 'GENERACION_ID'
)
SELECT t."fechaTurno", r."tipoRecurso", r."recursoId", r."inicioReserva", r."finReserva",
  CASE WHEN r."tipoRecurso" = 'AULA' THEN r."recursoId" = t."aulaId" END AS aula_reservada_es_la_de_la_clase,
  CASE WHEN r."tipoRecurso" = 'PROFESOR' THEN r."recursoId" = t."profesorId" END AS profesor_reservado_es_el_de_la_clase
FROM reservas_turno r JOIN turnos t ON t."idTurno" = r."turnoId" JOIN lote l ON l."turnoId" = t."idTurno"
ORDER BY t."fechaTurno", r."tipoRecurso";

-- 4) Eventos: tres por clase; aula_asignada y disponibilizado con el aula (y el cupo) de cada clase;
--    configurado con el mismo generacion_id en todas. Las columnas `coincide_*` tienen que ser true.
WITH lote AS (
  SELECT e."turnoId" FROM eventos_turno e
  WHERE e."tipoEvento" = 'turno:configurado' AND e."payloadEvento"->>'generacion_id' = 'GENERACION_ID'
)
SELECT t."fechaTurno", e."tipoEvento", e."payloadEvento"->>'aula_id' AS aula_evento,
  (e."payloadEvento"->>'cupo_maximo')::int AS cupo_evento, e."payloadEvento"->>'generacion_id' AS generacion_evento,
  CASE WHEN e."tipoEvento" IN ('turno:aula_asignada', 'turno:disponibilizado') THEN e."payloadEvento"->>'aula_id' = t."aulaId" END AS coincide_aula,
  CASE WHEN e."tipoEvento" = 'turno:aula_asignada' THEN (e."payloadEvento"->>'cupo_maximo')::int = t."cupoMaximoTurno" END AS coincide_cupo,
  CASE WHEN e."tipoEvento" = 'turno:configurado' THEN e."payloadEvento"->>'generacion_id' = 'GENERACION_ID' END AS coincide_generacion
FROM eventos_turno e JOIN turnos t ON t."idTurno" = e."turnoId" JOIN lote l ON l."turnoId" = t."idTurno"
ORDER BY t."fechaTurno", e."tipoEvento";

-- 5) Resumen del lote (criterio 8): clases creadas y cuántas con un aula distinta de la de la primera
--    fecha no excluida. Contrastar con `aulas_cambiadas` del 201 conociendo el aula por defecto del pedido.
WITH lote AS (
  SELECT e."turnoId" FROM eventos_turno e
  WHERE e."tipoEvento" = 'turno:configurado' AND e."payloadEvento"->>'generacion_id' = 'GENERACION_ID'
)
SELECT a."nombreAula", count(*) AS clases
FROM turnos t JOIN lote l ON l."turnoId" = t."idTurno" JOIN aulas a ON a."idAula" = t."aulaId"
GROUP BY a."nombreAula" ORDER BY clases DESC;
COMMIT;
