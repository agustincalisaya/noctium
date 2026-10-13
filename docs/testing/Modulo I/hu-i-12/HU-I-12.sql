-- HU-I-12 — Nivel 3 (BD): consultas de solo lectura sobre la base de desarrollo.
-- Correr en TablePlus o con: docker exec noctium_db psql -U noctium -d noctium_dev -f HU-I-12.sql

-- 3.1 Estado de cada caja: tras abrir (ABIERTA, efectivoDeclarado NULL), tras
-- declarar (efectivoDeclarado seteado, sigue ABIERTA) y tras cerrar
-- (CERRADA con esperado, diferencia, motivo, resumen y quién cerró; por
-- ausencia, porAusencia = true y el gerente en cerradaPorUsuarioId).
SELECT c."idCaja", u."emailUsuario" AS integrante, c.estado, c."fondoInicial", c."efectivoDeclarado",
       c."efectivoEsperado", c.diferencia, c."porAusencia", cp."emailUsuario" AS cerrada_por,
       c."cerradaPorActorTipo", c.motivo, c."abiertaEl", c."cerradaEl", c.resumen IS NOT NULL AS con_resumen
FROM cajas c
JOIN usuarios u ON u."idUsuario" = c."usuarioId"
LEFT JOIN usuarios cp ON cp."idUsuario" = c."cerradaPorUsuarioId"
ORDER BY c."abiertaEl";

-- 3.2 Una sola caja abierta por integrante (índice único parcial).
SELECT "usuarioId", count(*) AS abiertas FROM cajas WHERE estado = 'ABIERTA' GROUP BY 1 HAVING count(*) > 1;  -- 0 filas

-- 3.3 Coherencia de una caja cerrada: diferencia = declarado − esperado y el
-- resumen guardado coincide con las columnas.
SELECT "idCaja",
       diferencia = "efectivoDeclarado" - "efectivoEsperado" AS diferencia_ok,
       (resumen->>'efectivo_esperado')::numeric = "efectivoEsperado" AS resumen_esperado_ok,
       (resumen->>'diferencia')::numeric = diferencia AS resumen_diferencia_ok
FROM cajas WHERE estado = 'CERRADA';

-- 3.4 Resumen fijo de un cierre (reemplazar el id).
SELECT jsonb_pretty(resumen) FROM cajas WHERE "idCaja" = '<id de la caja cerrada>';

-- 3.5 Cobros de una caja (el que entró mientras se cerraba).
SELECT o."cajaId", p."montoPago", o."formaPagoId", o."registradaEl"
FROM operaciones_pago o JOIN pagos p ON p."operacionId" = o."idOperacionPago"
WHERE o."cajaId" = '<id de la caja>';

-- 3.6 Ninguna caja cerrada recibió operaciones, movimientos ni ajustes después de cerrarse.
SELECT c."idCaja", 'operacion' AS tipo FROM cajas c JOIN operaciones_pago o ON o."cajaId" = c."idCaja"
  WHERE c.estado = 'CERRADA' AND o."registradaEl" > c."cerradaEl"
UNION ALL
SELECT c."idCaja", 'movimiento' FROM cajas c JOIN movimientos_caja m ON m."cajaId" = c."idCaja"
  WHERE c.estado = 'CERRADA' AND m."createdAtMovimientoCaja" > c."cerradaEl"
UNION ALL
SELECT c."idCaja", 'ajuste' FROM cajas c JOIN ajustes_caja a ON a."cajaId" = c."idCaja"
  WHERE c.estado = 'CERRADA' AND a."createdAtAjusteCaja" > c."cerradaEl";  -- 0 filas
