-- HU-N-01, nivel 3. Ejecutar en la base descartable usada para las pruebas.
-- Solo lectura: repetir antes y después del GET/PUT, del seed y de los flujos C/H.
BEGIN TRANSACTION READ ONLY;

-- Las tres claves contractuales, sus valores actuales y otras claves intactas.
SELECT "clave", "valor"
FROM parametros_sistema
WHERE "clave" IN ('plazo_pago_horas', 'cancelacion_anticipacion_horas', 'umbral_presentismo',
                  'centro_nombre', 'centro_domicilio', 'centro_telefono')
ORDER BY "clave";

-- Historial: una fila por campo cambiado, con actor y fecha; sin filas para no-op.
SELECT "idHistorialParametro", "clave", "valorAnterior", "valorNuevo", "usuarioId", "fecha"
FROM historial_parametros
WHERE "clave" IN ('plazo_pago_horas', 'cancelacion_anticipacion_horas', 'umbral_presentismo')
ORDER BY "fecha" DESC, "idHistorialParametro" DESC
LIMIT 30;

-- Reservas existentes: comparar los mismos ids antes y después de cambiar el plazo.
-- venceBaseEl permanece; reprogramar solo puede cambiar venceEl = min(base, nuevo inicio).
SELECT "idInscripcion", "inicioPlazo", "venceBaseEl", "venceEl", "estadoPago", "vigencia"
FROM turno_alumno
WHERE "venceBaseEl" IS NOT NULL
ORDER BY "idInscripcion"
LIMIT 30;

-- Conteos para probar que no-op y rollback no agregan historia.
SELECT "clave", count(*) AS cambios
FROM historial_parametros
WHERE "clave" IN ('plazo_pago_horas', 'cancelacion_anticipacion_horas', 'umbral_presentismo')
GROUP BY "clave" ORDER BY "clave";

ROLLBACK;
