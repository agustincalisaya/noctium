-- HU-I-05 — Mis pagos. Lecturas de verificación NO destructivas (solo SELECT).
-- Ejecutar en una base descartable o, en modo consulta, en la de trabajo.
-- $1 = id del alumno (Alumno."idAlumno"). En TablePlus reemplazar $1 por el id entre comillas.
-- api-check.mjs ejecuta automáticamente el bloque «consulta-vigentes».

-- @consulta-vigentes
-- Valores vigentes por pago del alumno como PAGADOR (spec_modulo_I.md §2.6.2):
-- monto de la última corrección o el original; fecha y forma de la última
-- corrección de operación que cambió cada una; anulado si tiene AnulacionPago.
SELECT
  p."idPago" AS pago_id,
  m."nombreMateria" AS materia,
  t."fechaTurno"::text AS fecha_clase,
  p."montoPago" AS monto_original,
  COALESCE((SELECT c."montoNuevo" FROM correcciones_pago c WHERE c."pagoId" = p."idPago"
            ORDER BY c."createdAtCorreccionPago" DESC, c."idCorreccionPago" DESC LIMIT 1), p."montoPago") AS monto_vigente,
  COALESCE((SELECT co."fechaPagoNueva" FROM correcciones_operacion co WHERE co."operacionId" = p."operacionId" AND co."fechaPagoNueva" IS NOT NULL
            ORDER BY co."createdAtCorreccionOperacion" DESC, co."idCorreccionOperacion" DESC LIMIT 1), o."fechaPago")::text AS fecha_pago_vigente,
  COALESCE((SELECT co."formaPagoNuevaId" FROM correcciones_operacion co WHERE co."operacionId" = p."operacionId" AND co."formaPagoNuevaId" IS NOT NULL
            ORDER BY co."createdAtCorreccionOperacion" DESC, co."idCorreccionOperacion" DESC LIMIT 1), o."formaPagoId") AS forma_vigente,
  EXISTS (SELECT 1 FROM anulaciones_pago a WHERE a."pagoId" = p."idPago") AS anulado
FROM pagos p
JOIN operaciones_pago o ON o."idOperacionPago" = p."operacionId"
JOIN turnos t ON t."idTurno" = p."turnoId"
JOIN materias m ON m."idMateria" = t."materiaId"
WHERE o."alumnoId" = $1
ORDER BY fecha_pago_vigente DESC, p."createdAtPago" DESC, p."idPago" DESC;
-- @fin

-- Total pagado (no anulados, monto vigente) — debe coincidir con data.total_pagado sin filtros.
SELECT COALESCE(SUM(v.monto_vigente) FILTER (WHERE NOT v.anulado), 0)::numeric(14,2) AS total_pagado, COUNT(*) AS filas
FROM (
  SELECT
    COALESCE((SELECT c."montoNuevo" FROM correcciones_pago c WHERE c."pagoId" = p."idPago"
              ORDER BY c."createdAtCorreccionPago" DESC, c."idCorreccionPago" DESC LIMIT 1), p."montoPago") AS monto_vigente,
    EXISTS (SELECT 1 FROM anulaciones_pago a WHERE a."pagoId" = p."idPago") AS anulado
  FROM pagos p JOIN operaciones_pago o ON o."idOperacionPago" = p."operacionId"
  WHERE o."alumnoId" = $1
) v;

-- Pagos de OTROS alumnos en las mismas clases que el alumno (no deben aparecer en su listado).
SELECT p."idPago", p."alumnoId", p."turnoId"
FROM pagos p
WHERE p."alumnoId" <> $1
  AND p."turnoId" IN (SELECT p2."turnoId" FROM pagos p2 WHERE p2."alumnoId" = $1);

-- Comprobantes de cada operación del alumno: número, reemplazos y pertenencia (operación del pagador).
SELECT c.numero, c."idComprobante", c."reemplazaAId", (r."idComprobante" IS NOT NULL) AS reemplazado,
       jsonb_array_length(c.datos -> 'clases') AS clases, o."alumnoId" = $1 AS del_alumno
FROM comprobantes c
JOIN operaciones_pago o ON o."idOperacionPago" = c."operacionId"
LEFT JOIN comprobantes r ON r."reemplazaAId" = c."idComprobante"
WHERE o."alumnoId" = $1
ORDER BY c.numero;

-- Pagos sin ningún comprobante emitido (esperado: 0 en datos creados por los servicios de dominio).
SELECT COUNT(*) AS pagos_sin_comprobante
FROM pagos p
WHERE NOT EXISTS (SELECT 1 FROM comprobantes c WHERE c."operacionId" = p."operacionId");

-- Contraste del diferido I-11 C5: el motivo existe en la base (dato interno), pero no en la vista del alumno.
SELECT a."pagoId", a.motivo, a."createdAtAnulacionPago"
FROM anulaciones_pago a
JOIN pagos p ON p."idPago" = a."pagoId"
WHERE p."alumnoId" = $1;
