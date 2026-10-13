-- Lectura equivalente a la aserción SQL ejecutada en
-- src/server/pagos/pago.historial.pg.test.ts contra base descartable
-- del contenedor noctium_i02_pg (127.0.0.1:55434).
-- Sustituir los tres IDs por los que genera ese test; nunca ejecutar sobre
-- la base compartida.
SELECT p."idPago", p."montoPago" AS original,
  COALESCE((
    SELECT c."montoNuevo" FROM "correcciones_pago" c
    WHERE c."pagoId" = p."idPago"
    ORDER BY c."createdAtCorreccionPago" DESC, c."idCorreccionPago" DESC
    LIMIT 1
  ), p."montoPago") AS vigente,
  EXISTS (
    SELECT 1 FROM "anulaciones_pago" a WHERE a."pagoId" = p."idPago"
  ) AS anulado
FROM "pagos" p
WHERE p."idPago" IN ('<pago corregido>', '<pago ajustado al registrar>', '<pago anulado>')
ORDER BY p."idPago";

-- Esperado por la prueba, respectivamente:
-- original=100.00, vigente=101.01, anulado=false
-- original=90.00,  vigente=90.00,  anulado=false
-- original=100.00, vigente=100.00, anulado=true
-- Total no anulado que devuelve el servicio: 191.01.
