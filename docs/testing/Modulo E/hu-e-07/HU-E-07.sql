-- Evidencia de HU-E-07. Ejecutar contra la base de desarrollo/fixtures.
-- Es una consulta de lectura; no modifica filas ni permisos.
\set ON_ERROR_STOP on

SELECT
  t."fechaTurno",
  t."horaInicioTurno",
  m."nombreMateria",
  c."idClaseDictada",
  c."anuladaEl",
  o."temasVistos",
  o."observacionesInternas",
  o."createdAtObservacion" AS "registradaEn",
  u."emailUsuario" AS "registradaPor"
FROM "turnos" t
JOIN "materias" m ON m."idMateria" = t."materiaId"
JOIN "clases_dictadas" c ON c."turnoId" = t."idTurno"
LEFT JOIN "observaciones_clase" o ON o."claseDictadaId" = c."idClaseDictada"
LEFT JOIN "usuarios" u ON u."idUsuario" = o."creadoPorUsuarioId"
WHERE t."fechaTurno" BETWEEN DATE '2026-01-06' AND DATE '2026-01-07'
  AND m."nombreMateria" = 'Matemática'
ORDER BY t."fechaTurno", t."horaInicioTurno";

-- Debe devolver cero filas: cada clase vigente tiene a lo sumo una observación.
SELECT c."idClaseDictada", COUNT(o."idObservacionClase") AS "cantidad"
FROM "clases_dictadas" c
JOIN "turnos" t ON t."idTurno" = c."turnoId"
LEFT JOIN "observaciones_clase" o ON o."claseDictadaId" = c."idClaseDictada"
GROUP BY c."idClaseDictada"
HAVING COUNT(o."idObservacionClase") > 1;
