-- HU-C-26 — Verificación en la base (nivel 3, spec_modulo_C.md §2.20.4 y §4).
-- Solo lectura. Correr en una base DESCARTABLE, después de la colección de Postman:
--
--   psql -v quitada=<id del caso 10> -v pagada=<id del caso 12> \
--        -v sin_marcar=<id del caso 13> -v quitada_2_5=<inscripcion_2_5 del caso 15b> \
--        -f HU-C-26.sql
--
-- `quitada`: la reserva quitada desde Reservas; `pagada`: la inscripción PAGADA
-- del caso 12 (la consulta 1 la elige antes de correr la colección);
-- `sin_marcar`: la vencida sin marcar del caso 13; `quitada_2_5`: la inscripción
-- quitada por DELETE /api/turnos/[id]/alumnos/[alumnoId] (HU-C-04).

BEGIN TRANSACTION READ ONLY;

-- 1. Una inscripción PAGADA vigente de una clase Disponible o Completa (para el caso 12).
SELECT ta."idInscripcion" AS inscripcion_pagada_id
FROM turno_alumno ta JOIN turnos t ON t."idTurno" = ta."turnoId"
WHERE ta.vigencia = 'VIGENTE' AND ta."estadoPago" = 'PAGADA' AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO')
ORDER BY 1 LIMIT 1;

-- 2. La reserva quitada: QUITADA_CENTRO con fecha y usuario, estadoPago y precio congelados.
--    La fila existe (Regla N.° 1: ningún DELETE).
SELECT ta."idInscripcion", ta.vigencia, ta."estadoPago", ta.precio, ta."venceEl", ta."finalizadaEl",
       ta."finalizadaPorActorTipo", u."emailUsuario" AS finalizada_por
FROM turno_alumno ta LEFT JOIN usuarios u ON u."idUsuario" = ta."finalizadaPorUsuarioId"
WHERE ta."idInscripcion" = :'quitada';

-- 3. La clase de la reserva quitada: estado y ocupación vigente (se liberó el lugar).
SELECT t."idTurno", t."estadoTurno", t."cupoMaximoTurno",
       count(*) FILTER (WHERE ta.vigencia = 'VIGENTE') AS inscripciones_vigentes
FROM turnos t JOIN turno_alumno ta ON ta."turnoId" = t."idTurno"
WHERE t."idTurno" = (SELECT "turnoId" FROM turno_alumno WHERE "idInscripcion" = :'quitada')
GROUP BY t."idTurno";

-- 4. Historial de estados (PR 0): una fila nueva VIGENTE → QUITADA_CENTRO con actor
--    usuario por cada quitada, escrita después del commit; la pagada y la vencida sin
--    marcar no suman filas posteriores a la colección (solo las del alta del seed).
SELECT h."inscripcionId", h."vigenciaAnterior", h."vigenciaNueva", h."actorTipo", u."emailUsuario" AS actor, h.fecha
FROM historial_inscripciones h LEFT JOIN usuarios u ON u."idUsuario" = h."usuarioId"
WHERE h."inscripcionId" IN (:'quitada', :'pagada', :'sin_marcar', :'quitada_2_5')
ORDER BY h.fecha;

-- 5. eventos_turno: turno:alumno_quitado con inscripcion_id en el payload, tanto desde
--    Reservas como desde el detalle de la clase (2.5); turno:disponible_nuevamente si
--    la clase pasó de Completa a Disponible.
SELECT e."tipoEvento", e."payloadEvento" ->> 'inscripcion_id' AS inscripcion_id,
       e."payloadEvento" ->> 'alumno_id' AS alumno_id, e."creadoEnEvento"
FROM eventos_turno e
WHERE e."tipoEvento" IN ('turno:alumno_quitado', 'turno:disponible_nuevamente')
  AND e."turnoId" IN (SELECT "turnoId" FROM turno_alumno WHERE "idInscripcion" IN (:'quitada', :'quitada_2_5'))
ORDER BY e."creadoEnEvento";

-- 6. Los rechazos (409) no cambiaron nada: la pagada sigue VIGENTE/PAGADA y la vencida
--    sin marcar sigue VIGENTE/RESERVADA (la marca de esa transacción se revirtió).
SELECT "idInscripcion", vigencia, "estadoPago", "venceEl", "finalizadaEl"
FROM turno_alumno WHERE "idInscripcion" IN (:'pagada', :'sin_marcar');

-- 7. La inscripción quitada por 2.5 (HU-C-04) también queda QUITADA_CENTRO, sin DELETE.
SELECT "idInscripcion", vigencia, "finalizadaPorActorTipo", "finalizadaEl" IS NOT NULL AS con_fecha
FROM turno_alumno WHERE "idInscripcion" = :'quitada_2_5';

-- 8. Cantidad total de inscripciones (comparar con la de antes de correr la colección: igual).
SELECT count(*) AS filas_turno_alumno FROM turno_alumno;

ROLLBACK;
