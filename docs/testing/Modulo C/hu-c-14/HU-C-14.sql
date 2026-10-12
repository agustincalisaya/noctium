-- HU-C-14: cancelación propia de la inscripción.
-- Ejecutar solo contra una base noctium_pruebas_<8 hex>, con psql.
-- Orden: 1) bloque ANTES (lee y guarda los valores); 2) el POST 200 de la colección Postman;
-- 3) bloque DESPUES (reemplazar los valores indicados con <...>): falla con una excepción si algún dato es incorrecto.

-- ANTES: anotar los valores que usa el bloque DESPUES.
SELECT ta."idInscripcion" AS inscripcion_id, ta."turnoId" AS turno_id, ta."alumnoId" AS alumno_id, ta."estadoPago", ta."vigencia",
       (SELECT count(*) FROM "pagos" p WHERE p."inscripcionId" = ta."idInscripcion") AS pagos_antes,
       (SELECT count(*) FROM "turno_alumno" v WHERE v."turnoId" = ta."turnoId" AND v."vigencia" = 'VIGENTE') AS vigentes_antes,
       (SELECT t."cupoMaximoTurno" FROM "turnos" t WHERE t."idTurno" = ta."turnoId") AS cupo
FROM "turno_alumno" ta
WHERE ta."idInscripcion" = '<inscripcion_id>';

-- DESPUES: aserciones (RAISE EXCEPTION si algo no coincide).
DO $$
DECLARE
  v_inscripcion text := '<inscripcion_id>';
  v_turno text := '<turno_id>';
  v_alumno text := '<alumno_id>';
  v_usuario text := '<usuario_alumno_id>';
  v_pagos_antes int := <pagos_antes>;
  v_vigentes_antes int := <vigentes_antes>;
  v_cupo int := <cupo>;
  v_fila "turno_alumno"%ROWTYPE;
  v_cantidad int;
BEGIN
  SELECT * INTO v_fila FROM "turno_alumno" WHERE "idInscripcion" = v_inscripcion;
  IF NOT FOUND THEN RAISE EXCEPTION 'La inscripción % no se borra: tiene que existir', v_inscripcion; END IF;

  -- La inscripción queda finalizada por el alumno, con fecha y actor, sin borrarse.
  IF v_fila."vigencia" <> 'CANCELADA_ALUMNO' THEN RAISE EXCEPTION 'vigencia esperada CANCELADA_ALUMNO, hay %', v_fila."vigencia"; END IF;
  IF v_fila."finalizadaEl" IS NULL THEN RAISE EXCEPTION 'finalizadaEl no puede ser nula'; END IF;
  IF v_fila."finalizadaPorActorTipo" <> 'USUARIO' THEN RAISE EXCEPTION 'finalizadaPorActorTipo esperado USUARIO, hay %', v_fila."finalizadaPorActorTipo"; END IF;
  IF v_fila."finalizadaPorUsuarioId" IS DISTINCT FROM v_usuario THEN RAISE EXCEPTION 'finalizadaPorUsuarioId esperado %, hay %', v_usuario, v_fila."finalizadaPorUsuarioId"; END IF;
  IF v_fila."turnoId" <> v_turno OR v_fila."alumnoId" <> v_alumno THEN RAISE EXCEPTION 'la inscripción no corresponde a la clase y al alumno indicados'; END IF;

  -- Historial de la inscripción: una transición VIGENTE -> CANCELADA_ALUMNO del mismo usuario y con la fecha de finalización.
  SELECT count(*) INTO v_cantidad FROM "historial_inscripciones" h
   WHERE h."inscripcionId" = v_inscripcion AND h."vigenciaAnterior" = 'VIGENTE' AND h."vigenciaNueva" = 'CANCELADA_ALUMNO'
     AND h."actorTipo" = 'USUARIO' AND h."usuarioId" = v_usuario AND h."fecha" = v_fila."finalizadaEl";
  IF v_cantidad <> 1 THEN RAISE EXCEPTION 'historial CANCELADA_ALUMNO esperado 1, hay %', v_cantidad; END IF;

  -- Pagos intactos: misma cantidad, ninguno anulado ni corregido por la cancelación, y el estado de pago no cambia.
  SELECT count(*) INTO v_cantidad FROM "pagos" WHERE "inscripcionId" = v_inscripcion;
  IF v_cantidad <> v_pagos_antes THEN RAISE EXCEPTION 'pagos esperados %, hay %', v_pagos_antes, v_cantidad; END IF;
  SELECT count(*) INTO v_cantidad FROM "anulaciones_pago" a JOIN "pagos" p ON p."idPago" = a."pagoId" WHERE p."inscripcionId" = v_inscripcion;
  IF v_cantidad <> 0 THEN RAISE EXCEPTION 'la cancelación no anula pagos: hay % anulaciones', v_cantidad; END IF;
  IF v_pagos_antes > 0 AND v_fila."estadoPago" <> 'PAGADA' THEN RAISE EXCEPTION 'estadoPago esperado PAGADA, hay %', v_fila."estadoPago"; END IF;

  -- Cupo liberado: una vigente menos, por debajo del cupo, y la clase vuelve a admitir inscripciones.
  SELECT count(*) INTO v_cantidad FROM "turno_alumno" WHERE "turnoId" = v_turno AND "vigencia" = 'VIGENTE';
  IF v_cantidad <> v_vigentes_antes - 1 THEN RAISE EXCEPTION 'vigentes esperadas %, hay %', v_vigentes_antes - 1, v_cantidad; END IF;
  IF v_cantidad >= v_cupo THEN RAISE EXCEPTION 'el cupo no se liberó: % de %', v_cantidad, v_cupo; END IF;
  IF (SELECT "estadoTurno" FROM "turnos" WHERE "idTurno" = v_turno) NOT IN ('DISPONIBLE', 'COMPLETO') THEN RAISE EXCEPTION 'la clase no debe cancelarse ni cambiar de familia de estado'; END IF;
  IF v_cantidad < v_cupo AND (SELECT "estadoTurno" FROM "turnos" WHERE "idTurno" = v_turno) <> 'DISPONIBLE' THEN RAISE EXCEPTION 'con cupo libre la clase tiene que estar DISPONIBLE'; END IF;
  SELECT count(*) INTO v_cantidad FROM "reservas_turno" WHERE "turnoId" = v_turno AND "tipoRecurso" = 'ALUMNO' AND "recursoId" = v_alumno;
  IF v_cantidad <> 0 THEN RAISE EXCEPTION 'el alumno no debe conservar la reserva de horario de la clase: hay %', v_cantidad; END IF;

  -- Eventos de la clase: cancelación con el payload completo.
  SELECT count(*) INTO v_cantidad FROM "eventos_turno" e
   WHERE e."turnoId" = v_turno AND e."tipoEvento" = 'turno:inscripcion_cancelada' AND e."usuarioId" = v_usuario
     AND e."payloadEvento" ->> 'turno_id' = v_turno AND e."payloadEvento" ->> 'alumno_id' = v_alumno
     AND e."payloadEvento" ->> 'inscripcion_id' = v_inscripcion AND e."payloadEvento" ->> 'usuario_id' = v_usuario
     AND e."payloadEvento" ->> 'estado_pago' = v_fila."estadoPago"::text;
  IF v_cantidad <> 1 THEN RAISE EXCEPTION 'evento turno:inscripcion_cancelada esperado 1, hay %', v_cantidad; END IF;

  RAISE NOTICE 'HU-C-14: aserciones correctas para la inscripción %', v_inscripcion;
END $$;

-- Referencia (solo lectura): eventos de la clase y pagos de la inscripción.
SELECT et."tipoEvento", et."turnoId", et."usuarioId", et."creadoEnEvento", et."payloadEvento"
FROM "eventos_turno" et
WHERE et."turnoId" = '<turno_id>'
ORDER BY et."creadoEnEvento" DESC;

SELECT p.*
FROM "pagos" p
WHERE p."inscripcionId" = '<inscripcion_id>';
