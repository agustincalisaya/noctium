-- HU-E-04: comprobaciones de lectura para los datos de demostración.
-- Ejecutar con psql -v alumno_id='...' -v materia_id='...' -f docs/testing/HU-E-04.sql
-- No escribe ni modifica datos.

SELECT
  i."idIndicacion" AS indicacion_id,
  i."texto",
  i."createdAtIndicacion" AT TIME ZONE 'America/Argentina/Buenos_Aires' AS registrada_en_ba,
  u."emailUsuario" AS registrada_por,
  m."nombreMateria" AS materia,
  i."claseDictadaId" AS clase_dictada_guardada,
  CASE WHEN cd."anuladaEl" IS NULL THEN cd."fechaClaseDictada" END AS fecha_clase_vigente
FROM indicaciones i
JOIN materias m ON m."idMateria" = i."materiaId"
LEFT JOIN usuarios u ON u."idUsuario" = i."creadoPorUsuarioId"
LEFT JOIN clases_dictadas cd ON cd."idClaseDictada" = i."claseDictadaId"
WHERE i."alumnoId" = :'alumno_id'
  AND i."materiaId" = :'materia_id'
ORDER BY i."createdAtIndicacion" DESC, i."idIndicacion";

-- Debe devolver cero: ningún vínculo vigente apunta a otra materia o a una
-- clase cuyo registro de alumnos no incluya al mismo alumno.
SELECT count(*) AS vinculos_invalidos
FROM indicaciones i
JOIN clases_dictadas cd ON cd."idClaseDictada" = i."claseDictadaId"
WHERE cd."anuladaEl" IS NULL
  AND (
    cd."materiaId" <> i."materiaId"
    OR NOT EXISTS (
      SELECT 1
      FROM clases_dictadas_alumnos cda
      WHERE cda."claseDictadaId" = cd."idClaseDictada"
        AND cda."alumnoId" = i."alumnoId"
    )
  );
