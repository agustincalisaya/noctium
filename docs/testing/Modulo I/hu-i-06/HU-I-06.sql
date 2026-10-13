-- HU-I-06 — Corregir o anular un pago registrado. Consultas de SOLO LECTURA
-- (psql en el contenedor noctium_db, base noctium_dev con el seed).
--   docker exec -i noctium_db psql -U noctium -d noctium_dev -v pago_1=... -v pago_2=... -v operacion=... < HU-I-06.sql
-- Las secciones «Entrada» se corren ANTES de newman (dan las variables de la
-- colección); el resto, DESPUÉS de las tres carpetas.

-- ===================== Entrada (antes de newman) =====================

-- E1. Dos inscripciones cobrables del mismo alumno y el mismo precio → alumno_id, insc_1, insc_2, precio.
--     Cobrable: vigente, sin pagar, clase futura Disponible/Completa y, si es una reserva, sin vencer (si no, RESERVA_VENCIDA).
SELECT ta."alumnoId" AS alumno_id, ta.precio, array_agg(ta."idInscripcion" ORDER BY ta."idInscripcion") AS inscripciones
FROM turno_alumno ta JOIN turnos t ON t."idTurno" = ta."turnoId"
WHERE ta.vigencia = 'VIGENTE' AND ta."estadoPago" <> 'PAGADA'
  AND t."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') AND t."fechaTurno" > now()::date + 2
  AND (ta."estadoPago" = 'PAGO_SIN_REGISTRAR' OR ta."venceEl" > now() + interval '2 hours')
GROUP BY ta."alumnoId", ta.precio HAVING count(*) >= 2 LIMIT 5;

-- E2. Un pago registrado hace más de 30 días, no anulado, en una caja abierta de otro integrante → pago_antiguo_id.
SELECT p."idPago" AS pago_antiguo_id, o."registradaEl", c.estado AS caja, u."emailUsuario" AS cobrado_por
FROM pagos p JOIN operaciones_pago o ON o."idOperacionPago" = p."operacionId"
JOIN cajas c ON c."idCaja" = o."cajaId" JOIN usuarios u ON u."idUsuario" = o."creadoPorUsuarioId"
WHERE o."registradaEl" < now() - interval '30 days' AND c.estado = 'ABIERTA'
  AND NOT EXISTS (SELECT 1 FROM anulaciones_pago a WHERE a."pagoId" = p."idPago")
ORDER BY o."registradaEl" LIMIT 1;

-- E3. Una forma de pago inactiva → forma_inactiva_id.
SELECT "idFormaPago" AS forma_inactiva_id, "nombreFormaPago" FROM formas_pago WHERE NOT "activaFormaPago" LIMIT 1;

-- ===================== Nivel 3 (después de newman) =====================

-- N1. Regla N.° 8: las filas originales de `pagos` conservan los valores de alta (monto 12000, transferencia, fecha del cobro).
SELECT "idPago", "montoPago", "formaPagoId", "fechaPago", "createdAtPago" FROM pagos WHERE "idPago" IN (:'pago_1', :'pago_2');

-- N2. Correcciones de monto del pago 1 (mesa 12000 → 11000; gerente 11000 → 10000).
SELECT "montoAnterior", "montoNuevo", motivo, "creadoPorUsuarioId", "createdAtCorreccionPago"
FROM correcciones_pago WHERE "pagoId" = :'pago_1' ORDER BY "createdAtCorreccionPago";

-- N3. Correcciones de la operación: una fila por campo (forma y fecha), alcanzan a los dos pagos.
SELECT "formaPagoAnteriorId", "formaPagoNuevaId", "fechaPagoAnterior", "fechaPagoNueva", motivo
FROM correcciones_operacion WHERE "operacionId" = :'operacion' ORDER BY "createdAtCorreccionOperacion", "idCorreccionOperacion";

-- N4. Anulación única por pago (índice único sobre "pagoId") y su motivo.
SELECT "pagoId", motivo, "actorTipo", "creadoPorUsuarioId" FROM anulaciones_pago WHERE "pagoId" = :'pago_2';
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'anulaciones_pago' AND indexdef ILIKE '%unique%';

-- N5. Comprobantes de la operación: cadena de reemplazos (cada uno reemplaza al anterior; uno solo sin reemplazar).
SELECT numero, "idComprobante", "reemplazaAId", (SELECT count(*) FROM comprobantes r WHERE r."reemplazaAId" = c."idComprobante") AS reemplazado
FROM comprobantes c WHERE "operacionId" = :'operacion' ORDER BY numero;

-- N6. HU-C-24 criterio 5: la inscripción del pago anulado dejó de estar PAGADA (reabierta o «Pago sin registrar»); la otra sigue PAGADA.
SELECT ta."idInscripcion", ta."estadoPago", ta."venceEl", ta."reabiertaPorAnulacion"
FROM turno_alumno ta WHERE ta."idInscripcion" IN (SELECT "inscripcionId" FROM pagos WHERE "idPago" IN (:'pago_1', :'pago_2'));

-- N7. Caja cerrada: el ajuste del gerente (11000 → 10000 = −1000, en débito) quedó en la caja abierta elegida, con su origen; la caja cerrada no cambió.
SELECT a."cajaId", c.estado AS caja_destino, a."formaPagoId", a.monto, a."correccionPagoId" IS NOT NULL AS por_correccion_monto,
       a."correccionOperacionId" IS NOT NULL AS por_correccion_operacion, a."anulacionPagoId" IS NOT NULL AS por_anulacion
FROM ajustes_caja a JOIN cajas c ON c."idCaja" = a."cajaId" WHERE a."pagoId" = :'pago_1';
SELECT "idCaja", estado, "cerradaEl", "efectivoEsperado", diferencia FROM cajas WHERE "idCaja" = (SELECT "cajaId" FROM operaciones_pago WHERE "idOperacionPago" = :'operacion');

-- N8. Pago antiguo: dos correcciones del gerente (ida y vuelta), sin ajuste (su caja sigue abierta).
SELECT "montoAnterior", "montoNuevo", motivo FROM correcciones_pago WHERE "pagoId" = :'pago_antiguo_id' ORDER BY "createdAtCorreccionPago";
SELECT count(*) AS ajustes_pago_antiguo FROM ajustes_caja WHERE "pagoId" = :'pago_antiguo_id';

-- N9. Equivalencia «Pagada ⇔ ≥ 1 pago no anulado» en toda la base (debe dar 0 filas).
SELECT ta."idInscripcion", ta."estadoPago"
FROM turno_alumno ta
WHERE ta.vigencia = 'VIGENTE'
  AND (ta."estadoPago" = 'PAGADA') <> EXISTS (
    SELECT 1 FROM pagos p WHERE p."inscripcionId" = ta."idInscripcion"
      AND NOT EXISTS (SELECT 1 FROM anulaciones_pago a WHERE a."pagoId" = p."idPago"));
