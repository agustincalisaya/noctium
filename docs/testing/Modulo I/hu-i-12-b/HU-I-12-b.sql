-- HU-I-12-b — Nivel 3 (BD): consultas de solo lectura sobre la base de desarrollo.
-- Correr en TablePlus o con: docker exec -i noctium_db psql -U noctium -d noctium_dev < HU-I-12-b.sql

-- 3.1 Tras registrar: cada movimiento manual con su caja, tipo, monto,
-- concepto, quién lo registró y cuándo; y si está anulado.
SELECT m."idMovimientoCaja", u."emailUsuario" AS registrado_por, c.estado AS estado_caja,
       m.tipo, m.monto, m.concepto, m."createdAtMovimientoCaja",
       a."idAnulacionMovimiento" IS NOT NULL AS anulado
FROM movimientos_caja m
JOIN cajas c ON c."idCaja" = m."cajaId"
JOIN usuarios u ON u."idUsuario" = m."creadoPorUsuarioId"
LEFT JOIN anulaciones_movimiento a ON a."movimientoId" = m."idMovimientoCaja"
ORDER BY m."createdAtMovimientoCaja" DESC
LIMIT 20;

-- 3.2 Tras anular: la anulación es una fila nueva que referencia el
-- movimiento, con actorTipo, motivo, usuario y fecha (Regla N.° 8).
SELECT a."idAnulacionMovimiento", a."movimientoId", m.tipo, m.monto, m.concepto,
       a."actorTipo", a.motivo, u."emailUsuario" AS anulado_por, a."createdAtAnulacionMovimiento"
FROM anulaciones_movimiento a
JOIN movimientos_caja m ON m."idMovimientoCaja" = a."movimientoId"
LEFT JOIN usuarios u ON u."idUsuario" = a."creadoPorUsuarioId"
ORDER BY a."createdAtAnulacionMovimiento" DESC
LIMIT 20;

-- 3.3 Una sola anulación por movimiento (índice único sobre movimientoId).
SELECT "movimientoId", count(*) AS anulaciones FROM anulaciones_movimiento GROUP BY 1 HAVING count(*) > 1;  -- 0 filas

-- 3.4 El movimiento original no se modifica al anularlo: la anulación es
-- posterior al movimiento y el movimiento conserva su monto y concepto
-- (no hay columnas de estado ni de actualización en movimientos_caja).
SELECT column_name FROM information_schema.columns
WHERE table_name = 'movimientos_caja' ORDER BY ordinal_position;
SELECT count(*) AS anulaciones_anteriores_al_movimiento
FROM anulaciones_movimiento a JOIN movimientos_caja m ON m."idMovimientoCaja" = a."movimientoId"
WHERE a."createdAtAnulacionMovimiento" < m."createdAtMovimientoCaja";  -- 0

-- 3.5 Movimientos y anulaciones solo en la caja de quien los registró: cada
-- anulación la hizo el mismo integrante dueño de la caja del movimiento.
SELECT count(*) AS anulaciones_de_otro_integrante
FROM anulaciones_movimiento a
JOIN movimientos_caja m ON m."idMovimientoCaja" = a."movimientoId"
JOIN cajas c ON c."idCaja" = m."cajaId"
WHERE a."actorTipo" = 'USUARIO' AND a."creadoPorUsuarioId" <> c."usuarioId";  -- 0
