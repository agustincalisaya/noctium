-- Ficha y cuenta del alumno antes y después de la baja o la reactivación.
SELECT a."idAlumno", a."activoAlumno", a."version", a."usuarioId", a."modificadoPorUsuarioId",
       u."activoUsuario", u."sesionesValidasDesdeUsuario", u."debeCambiarPasswordUsuario"
FROM "alumnos" a
LEFT JOIN "usuarios" u ON u."idUsuario" = a."usuarioId"
WHERE a."idAlumno" = '<alumno_id>';

-- Inscripciones: las futuras Disponibles o Completas quedan BAJA_ALUMNO; ninguna se borra.
SELECT ta."idInscripcion", t."fechaTurno", t."horaInicioTurno", t."estadoTurno", ta."vigencia", ta."estadoPago",
       ta."venceEl", ta."finalizadaEl", ta."finalizadaPorActorTipo", ta."finalizadaPorUsuarioId"
FROM "turno_alumno" ta
JOIN "turnos" t ON t."idTurno" = ta."turnoId"
WHERE ta."alumnoId" = '<alumno_id>'
ORDER BY t."fechaTurno", t."horaInicioTurno";

-- Pagos intactos (comparar antes y después).
SELECT p.* FROM "pagos" p WHERE p."alumnoId" = '<alumno_id>' ORDER BY p."createdAtPago";

-- Historial de estados, escrito después del commit.
SELECT h."accion", h."motivo", h."actorTipo", h."usuarioId", h."fecha"
FROM "historial_estados" h
WHERE h."entidad" = 'ALUMNO' AND h."entidadId" = '<alumno_id>'
ORDER BY h."fecha";

-- Autorregistro con ficha inactiva: ninguna cuenta nueva ni solicitud confirmada.
SELECT s."idSolicitud", s."confirmadaEn", c."invalidadoEn"
FROM "solicitudes_autorregistro" s
JOIN "codigos_verificacion" c ON c."idCodigo" = s."codigoId"
WHERE s."alumnoId" = '<alumno_id>';

-- Aserciones (RAISE EXCEPTION si algún dato no coincide). Ejecutar solo contra una base noctium_pruebas_<8 hex>, con psql -v ON_ERROR_STOP=1.
-- Valores de entrada: <alumno_id>; <pagos_antes> (pagos del alumno antes de la baja: tercer bloque de consultas de arriba);
-- <quitadas> (campo total de la respuesta de impacto: inscripciones futuras Disponibles o Completas que la baja tiene que quitar).

-- DESPUES de «Desactivar — 200» (y antes de reactivar).
DO $$
DECLARE
  v_alumno text := '<alumno_id>';
  v_pagos_antes int := <pagos_antes>;
  v_quitadas int := <quitadas>;
  v_ficha "alumnos"%ROWTYPE;
  v_cuenta "usuarios"%ROWTYPE;
  v_ahora timestamp := now() AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_cantidad int;
BEGIN
  SELECT * INTO v_ficha FROM "alumnos" WHERE "idAlumno" = v_alumno;
  IF NOT FOUND THEN RAISE EXCEPTION 'el alumno % no se borra: tiene que existir', v_alumno; END IF;
  IF v_ficha."activoAlumno" THEN RAISE EXCEPTION 'la ficha tiene que quedar inactiva'; END IF;

  -- Cuenta: inactiva y con las sesiones anteriores revocadas.
  IF v_ficha."usuarioId" IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM "usuarios" WHERE "idUsuario" = v_ficha."usuarioId";
    IF v_cuenta."activoUsuario" THEN RAISE EXCEPTION 'la cuenta tiene que quedar inactiva'; END IF;
    IF v_cuenta."sesionesValidasDesdeUsuario" IS NULL THEN RAISE EXCEPTION 'sesionesValidasDesdeUsuario tiene que quedar fijado'; END IF;
  END IF;

  -- Inscripciones quitadas: una BAJA_ALUMNO por cada futura anunciada por el impacto, con fecha y actor, sin borrarse.
  SELECT count(*) INTO v_cantidad FROM "turno_alumno" ta
   WHERE ta."alumnoId" = v_alumno AND ta."vigencia" = 'BAJA_ALUMNO'
     AND ta."finalizadaEl" IS NOT NULL AND ta."finalizadaPorActorTipo" = 'USUARIO' AND ta."finalizadaPorUsuarioId" IS NOT NULL;
  IF v_cantidad <> v_quitadas THEN RAISE EXCEPTION 'inscripciones BAJA_ALUMNO esperadas %, hay %', v_quitadas, v_cantidad; END IF;

  -- Ninguna inscripción vigente a una clase futura Disponible o Completa.
  SELECT count(*) INTO v_cantidad FROM "turno_alumno" ta JOIN "turnos" t ON t."idTurno" = ta."turnoId"
   WHERE ta."alumnoId" = v_alumno AND ta."vigencia" = 'VIGENTE' AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
     AND (t."fechaTurno" + t."horaInicioTurno") > v_ahora;
  IF v_cantidad <> 0 THEN RAISE EXCEPTION 'quedan % inscripciones vigentes a clases futuras', v_cantidad; END IF;

  -- Las inscripciones a clases pasadas o en curso no se tocan.
  SELECT count(*) INTO v_cantidad FROM "turno_alumno" ta JOIN "turnos" t ON t."idTurno" = ta."turnoId"
   WHERE ta."alumnoId" = v_alumno AND ta."vigencia" = 'BAJA_ALUMNO' AND (t."fechaTurno" + t."horaInicioTurno") <= v_ahora;
  IF v_cantidad <> 0 THEN RAISE EXCEPTION 'la baja no debe quitar inscripciones de clases pasadas o en curso: hay %', v_cantidad; END IF;

  -- Pagos intactos: misma cantidad, ninguno anulado.
  SELECT count(*) INTO v_cantidad FROM "pagos" WHERE "alumnoId" = v_alumno;
  IF v_cantidad <> v_pagos_antes THEN RAISE EXCEPTION 'pagos esperados %, hay %', v_pagos_antes, v_cantidad; END IF;
  SELECT count(*) INTO v_cantidad FROM "anulaciones_pago" a JOIN "pagos" p ON p."idPago" = a."pagoId" WHERE p."alumnoId" = v_alumno;
  IF v_cantidad <> 0 THEN RAISE EXCEPTION 'la baja no anula pagos: hay % anulaciones', v_cantidad; END IF;

  -- Historial de estados: la baja con su motivo, escrita por un usuario.
  SELECT count(*) INTO v_cantidad FROM "historial_estados" h
   WHERE h."entidad" = 'ALUMNO' AND h."entidadId" = v_alumno AND h."accion" = 'DESACTIVAR'
     AND h."actorTipo" = 'USUARIO' AND h."usuarioId" IS NOT NULL AND h."motivo" IS NOT NULL;
  IF v_cantidad <> 1 THEN RAISE EXCEPTION 'historial DESACTIVAR esperado 1, hay %', v_cantidad; END IF;

  RAISE NOTICE 'HU-B-07: aserciones de la baja correctas para el alumno %', v_alumno;
END $$;

-- DESPUES de «Reactivar — 200».
DO $$
DECLARE
  v_alumno text := '<alumno_id>';
  v_quitadas int := <quitadas>;
  v_ficha "alumnos"%ROWTYPE;
  v_cuenta "usuarios"%ROWTYPE;
  v_cantidad int;
  v_acciones text;
BEGIN
  SELECT * INTO v_ficha FROM "alumnos" WHERE "idAlumno" = v_alumno;
  IF NOT v_ficha."activoAlumno" THEN RAISE EXCEPTION 'la ficha tiene que quedar activa'; END IF;

  -- Cuenta activa; las sesiones revocadas en la baja no se restauran (la marca queda fijada).
  IF v_ficha."usuarioId" IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM "usuarios" WHERE "idUsuario" = v_ficha."usuarioId";
    IF NOT v_cuenta."activoUsuario" THEN RAISE EXCEPTION 'la cuenta tiene que quedar activa'; END IF;
    IF v_cuenta."sesionesValidasDesdeUsuario" IS NULL THEN RAISE EXCEPTION 'la marca de sesiones revocadas no se borra al reactivar'; END IF;
  END IF;

  -- Las inscripciones quitadas no se restauran.
  SELECT count(*) INTO v_cantidad FROM "turno_alumno" WHERE "alumnoId" = v_alumno AND "vigencia" = 'BAJA_ALUMNO';
  IF v_cantidad <> v_quitadas THEN RAISE EXCEPTION 'las inscripciones BAJA_ALUMNO tienen que seguir siendo %, hay %', v_quitadas, v_cantidad; END IF;
  SELECT count(*) INTO v_cantidad FROM "turno_alumno" ta JOIN "turnos" t ON t."idTurno" = ta."turnoId"
   WHERE ta."alumnoId" = v_alumno AND ta."vigencia" = 'VIGENTE' AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
     AND (t."fechaTurno" + t."horaInicioTurno") > now() AT TIME ZONE 'America/Argentina/Buenos_Aires';
  IF v_cantidad <> 0 THEN RAISE EXCEPTION 'la reactivación no restaura inscripciones: hay % vigentes a clases futuras', v_cantidad; END IF;

  -- Historial: se conservan la baja y la reactivación, en ese orden.
  SELECT string_agg(h."accion"::text, ',' ORDER BY h."fecha") INTO v_acciones
    FROM "historial_estados" h WHERE h."entidad" = 'ALUMNO' AND h."entidadId" = v_alumno;
  IF v_acciones IS DISTINCT FROM 'DESACTIVAR,REACTIVAR' THEN RAISE EXCEPTION 'historial esperado DESACTIVAR,REACTIVAR, hay %', coalesce(v_acciones, '(vacío)'); END IF;

  RAISE NOTICE 'HU-B-07: aserciones de la reactivación correctas para el alumno %', v_alumno;
END $$;
