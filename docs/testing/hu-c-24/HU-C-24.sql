-- Solo lectura. Preparar datos mediante fábricas existentes en una base NUEVA
-- noctium_pruebas_<8 hex>. No ejecutar sobre noctium_test ni una base habitual.
-- Reemplazar TURNO_ID (y ALUMNO_ID en la consulta 6); capturar antes y después de
-- cada corrida del proceso (POST /api/procesos/vencer-reservas).
BEGIN READ ONLY;
DO $$
BEGIN
  IF current_database() !~ '^noctium_pruebas_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'C-24 requiere una base aleatoria descartable';
  END IF;
END $$;

-- 1. Reservas de la clase con su situación a la hora actual: las "vencidas sin marcar"
--    son las que todavía figuran VIGENTE/RESERVADA con venceEl <= now() (el proceso
--    detenido las deja así; las operaciones y las pantallas las tratan como vencidas).
SELECT i."idInscripcion", i."alumnoId", i.vigencia, i."estadoPago", i.precio,
  i."reservadaEl", i."inicioPlazo", i."venceBaseEl", i."venceEl",
  i."venceEl" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires' AS vence_hora_centro,
  (i.vigencia = 'VIGENTE' AND i."estadoPago" = 'RESERVADA' AND i."venceEl" <= (now() AT TIME ZONE 'UTC')) AS vencida_sin_marcar,
  i."finalizadaEl", i."finalizadaPorActorTipo", i."finalizadaPorUsuarioId"
FROM turno_alumno i
WHERE i."turnoId" = 'TURNO_ID'
ORDER BY i."reservadaEl", i."idInscripcion";

-- 2. Después del proceso: cada RESERVA_VENCIDA tiene finalizadaEl = venceEl (el
--    vencimiento, no el momento en que se marcó), actor PROCESO_AUTOMATICO y sin usuario.
--    Esperado: 0 filas.
SELECT i."idInscripcion", i."venceEl", i."finalizadaEl", i."finalizadaPorActorTipo", i."finalizadaPorUsuarioId"
FROM turno_alumno i
WHERE i."turnoId" = 'TURNO_ID' AND i.vigencia = 'RESERVA_VENCIDA'
  AND (i."finalizadaEl" IS DISTINCT FROM i."venceEl"
    OR i."finalizadaPorActorTipo" <> 'PROCESO_AUTOMATICO'
    OR i."finalizadaPorUsuarioId" IS NOT NULL);

-- 3. Historial de estados de cada vencimiento: una fila por inscripción vencida, con la
--    fecha del vencimiento y sin usuario. Una segunda corrida no agrega filas (idempotencia).
SELECT h."inscripcionId", h."vigenciaAnterior", h."vigenciaNueva", h."estadoPagoAnterior", h."estadoPagoNuevo",
  h."actorTipo", h."usuarioId", h.fecha, count(*) OVER (PARTITION BY h."inscripcionId") AS filas_de_la_inscripcion
FROM historial_inscripciones h JOIN turno_alumno i ON i."idInscripcion" = h."inscripcionId"
WHERE i."turnoId" = 'TURNO_ID' AND h."vigenciaNueva" = 'RESERVA_VENCIDA'
ORDER BY h."inscripcionId", h.fecha;

-- 4. El proceso no escribe eventos_turno (su usuarioId es obligatorio y el proceso no es
--    un usuario): ningún evento de la clase corresponde al vencimiento.
SELECT e."idEvento", e."tipoEvento", e."usuarioId", e."creadoEnEvento"
FROM eventos_turno e WHERE e."turnoId" = 'TURNO_ID' ORDER BY e."creadoEnEvento";

-- 5. Estado guardado de la clase y ocupación real: una clase COMPLETO cuyas reservas
--    vencieron vuelve a DISPONIBLE; una CANCELADO conserva sus reservas sin vencer.
SELECT t."idTurno", t."estadoTurno", t."cupoMaximoTurno",
  count(*) FILTER (WHERE i.vigencia = 'VIGENTE') AS vigentes_en_columna,
  count(*) FILTER (WHERE i.vigencia = 'VIGENTE'
    AND (i."estadoPago" <> 'RESERVADA' OR i."venceEl" > (now() AT TIME ZONE 'UTC') OR t."estadoTurno" NOT IN ('DISPONIBLE', 'COMPLETO'))) AS vigentes_a_ahora
FROM turnos t LEFT JOIN turno_alumno i ON i."turnoId" = t."idTurno"
WHERE t."idTurno" = 'TURNO_ID' GROUP BY t."idTurno";

-- 6. Inscripción desde el centro: queda VIGENTE/RESERVADA con plazo contado desde el alta,
--    precio congelado y creada por el usuario de mesa de entrada.
SELECT i."idInscripcion", i.vigencia, i."estadoPago", i.precio, i."reservadaEl", i."inicioPlazo", i."venceBaseEl", i."venceEl",
  (i."venceBaseEl" - i."inicioPlazo")::text AS periodo, i."creadoPorUsuarioId"
FROM turno_alumno i WHERE i."turnoId" = 'TURNO_ID' AND i."alumnoId" = 'ALUMNO_ID'
ORDER BY i."reservadaEl", i."idInscripcion";

-- 7. Invariante "Pagada <=> al menos un pago no anulado" (no debe romperse por el proceso).
--    Esperado: 0 filas.
SELECT i."idInscripcion", i."estadoPago",
  (SELECT count(*) FROM pagos p WHERE p."inscripcionId" = i."idInscripcion"
     AND NOT EXISTS (SELECT 1 FROM anulaciones_pago a WHERE a."pagoId" = p."idPago")) AS pagos_no_anulados
FROM turno_alumno i
WHERE i."turnoId" = 'TURNO_ID' AND i.vigencia = 'VIGENTE'
  AND ((i."estadoPago" = 'PAGADA') <> (EXISTS (SELECT 1 FROM pagos p WHERE p."inscripcionId" = i."idInscripcion"
     AND NOT EXISTS (SELECT 1 FROM anulaciones_pago a WHERE a."pagoId" = p."idPago"))));
ROLLBACK;
