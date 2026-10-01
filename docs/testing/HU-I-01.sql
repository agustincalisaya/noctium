-- HU-I-01: consultas de evidencia, solo lectura. Usar una base de pruebas aislada.
-- Ajustar los ids de turno a los utilizados en las pruebas.

-- Registro de cada pago, Decimal exacto, fecha, identidad y auditoría.
SELECT p."idPago", p."turnoId", p."alumnoId", a."apellidoAlumno", a."nombreAlumno",
       p."montoPago"::text AS monto_exacto, f."nombreFormaPago", p."fechaPago",
       p."createdAtPago", p."creadoPorUsuarioId"
FROM pagos p
JOIN alumnos a ON a."idAlumno" = p."alumnoId"
JOIN formas_pago f ON f."idFormaPago" = p."formaPagoId"
WHERE p."turnoId" IN ('seed-turno-02', 'T-0602')
ORDER BY p."createdAtPago" DESC, p."idPago" DESC;

-- Los pagos parciales permanecen como filas independientes.
SELECT "turnoId", "alumnoId", count(*) AS pagos, sum("montoPago") AS total_exacto
FROM pagos WHERE "turnoId" IN ('seed-turno-02', 'T-0602')
GROUP BY "turnoId", "alumnoId";

-- Historia preservada incluso si el alumno ya no está inscripto o está inactivo.
SELECT p."idPago", p."alumnoId", a."activoAlumno", (ta."alumnoId" IS NOT NULL) AS sigue_inscripto
FROM pagos p
JOIN alumnos a ON a."idAlumno" = p."alumnoId"
LEFT JOIN turno_alumno ta ON ta."turnoId" = p."turnoId" AND ta."alumnoId" = p."alumnoId"
WHERE p."turnoId" IN ('seed-turno-02', 'T-0602');

-- Confirmar el tipo de columnas monetaria/de fecha y la ausencia de updatedAtPago.
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'pagos'
ORDER BY ordinal_position;
