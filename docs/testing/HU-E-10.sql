-- HU-E-10: lectura de auditoría. Ejecutar en una base local de demostración;
-- estas consultas no escriben datos. La fixture identifica los dos resultados
-- por sus observaciones estables.

WITH resultados_fixture AS (
  SELECT r."idResultadoExamen", r."alumnoId", r."materiaId", r."fechaExamen",
    r."notaExamen", r."observaciones", r."createdAtResultadoExamen", r."creadoPorUsuarioId",
    (SELECT count(*)::int FROM "correcciones_resultado_examen" c
      WHERE c."resultadoExamenId" = r."idResultadoExamen") AS cantidad_correcciones,
    (SELECT c."fechaNueva" FROM "correcciones_resultado_examen" c
      WHERE c."resultadoExamenId" = r."idResultadoExamen"
      ORDER BY c."createdAtCorreccion" DESC, c."idCorreccionResultado" DESC LIMIT 1) AS fecha_vigente,
    (SELECT c."notaNueva" FROM "correcciones_resultado_examen" c
      WHERE c."resultadoExamenId" = r."idResultadoExamen"
      ORDER BY c."createdAtCorreccion" DESC, c."idCorreccionResultado" DESC LIMIT 1) AS nota_vigente,
    (SELECT c."motivo" FROM "correcciones_resultado_examen" c
      WHERE c."resultadoExamenId" = r."idResultadoExamen"
      ORDER BY c."createdAtCorreccion" DESC, c."idCorreccionResultado" DESC LIMIT 1) AS motivo_ultima_correccion,
    (SELECT c."creadoPorUsuarioId" FROM "correcciones_resultado_examen" c
      WHERE c."resultadoExamenId" = r."idResultadoExamen"
      ORDER BY c."createdAtCorreccion" DESC, c."idCorreccionResultado" DESC LIMIT 1) AS autor_ultima_correccion,
    a."motivo" AS motivo_anulacion, a."createdAtAnulacion" AS anulada_en,
    a."creadoPorUsuarioId" AS autor_anulacion
  FROM "resultados_examen" r
  LEFT JOIN "anulaciones_resultado_examen" a ON a."resultadoExamenId" = r."idResultadoExamen"
  WHERE r."observaciones" LIKE 'HU-E-10 fixture:%'
)
SELECT f."idResultadoExamen", f."alumnoId", m."nombreMateria", f."observaciones",
  f."fechaExamen" AS fecha_original, f."notaExamen" AS nota_original,
  COALESCE(f.fecha_vigente, f."fechaExamen") AS fecha_vigente,
  COALESCE(f.nota_vigente, f."notaExamen") AS nota_vigente,
  f.cantidad_correcciones, f.motivo_ultima_correccion,
  autor_c."emailUsuario" AS corregido_por,
  f.motivo_anulacion, f.anulada_en, autor_a."emailUsuario" AS anulado_por,
  CASE WHEN f.motivo_anulacion IS NULL THEN 'VIGENTE' ELSE 'ANULADO' END AS estado
FROM resultados_fixture f
JOIN "materias" m ON m."idMateria" = f."materiaId"
LEFT JOIN "usuarios" autor_c ON autor_c."idUsuario" = f.autor_ultima_correccion
LEFT JOIN "usuarios" autor_a ON autor_a."idUsuario" = f.autor_anulacion
ORDER BY f."createdAtResultadoExamen", f."idResultadoExamen";

-- Invariantes: el primer valor anterior debe coincidir con el resultado
-- original; la anulación deja la fila original presente.
SELECT
  count(*) FILTER (
    WHERE primera."idCorreccionResultado" IS NOT NULL
      AND (primera."fechaAnterior" IS DISTINCT FROM r."fechaExamen"
        OR primera."notaAnterior" IS DISTINCT FROM r."notaExamen")
  ) AS correcciones_que_no_partieron_del_original,
  count(*) FILTER (WHERE a."idAnulacionResultado" IS NOT NULL) AS originales_con_anulacion,
  count(*) AS resultados_fixture
FROM "resultados_examen" r
LEFT JOIN LATERAL (
  SELECT c."idCorreccionResultado", c."fechaAnterior", c."notaAnterior"
  FROM "correcciones_resultado_examen" c
  WHERE c."resultadoExamenId" = r."idResultadoExamen"
  ORDER BY c."createdAtCorreccion", c."idCorreccionResultado"
  LIMIT 1
) primera ON true
LEFT JOIN "anulaciones_resultado_examen" a ON a."resultadoExamenId" = r."idResultadoExamen"
WHERE r."observaciones" LIKE 'HU-E-10 fixture:%';
