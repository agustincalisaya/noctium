-- HU-H-07: contraste de solo lectura. Rango inclusivo mayo-octubre 2026.
-- Reproduce valores vigentes y exclusión de anuladas; no altera datos.
WITH clases AS (
  SELECT cd.*, COALESCE((SELECT ca."conControlAsistencia" FROM correcciones_asistencia ca
    WHERE ca."claseDictadaId"=cd."idClaseDictada" ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1), cd."conControlAsistencia") AS control
  FROM clases_dictadas cd WHERE cd."anuladaEl" IS NULL
    AND cd."fechaClaseDictada">=DATE '2026-05-01' AND cd."fechaClaseDictada"<DATE '2026-11-01'
), estados AS (
  SELECT cd."fechaClaseDictada", cd."materiaId", cda."alumnoId", cd.control,
    COALESCE((SELECT caa."estadoNuevo" FROM correcciones_asistencia_alumnos caa JOIN correcciones_asistencia ca ON ca."idCorreccionAsistencia"=caa."correccionId"
      WHERE ca."claseDictadaId"=cda."claseDictadaId" AND caa."alumnoId"=cda."alumnoId"
      ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1), cda."estadoAsistencia") AS estado
  FROM clases cd JOIN clases_dictadas_alumnos cda ON cda."claseDictadaId"=cd."idClaseDictada"
)
SELECT to_char("fechaClaseDictada", 'YYYY-MM') AS mes,
  count(*) FILTER(WHERE control AND estado IN ('PRESENTE','AUSENTE')) AS inscriptos,
  count(*) FILTER(WHERE control AND estado='PRESENTE') AS presentes,
  count(*) FILTER(WHERE control AND estado='AUSENTE') AS ausentes,
  round(100.0*count(*) FILTER(WHERE control AND estado='PRESENTE')/nullif(count(*) FILTER(WHERE control AND estado IN ('PRESENTE','AUSENTE')),0),1) AS indice
FROM estados GROUP BY 1 ORDER BY 1;

-- Conteo de CLASES excluidas, no filas de alumnos.
SELECT count(*) AS clases_sin_control FROM clases_dictadas cd WHERE cd."anuladaEl" IS NULL
  AND cd."fechaClaseDictada">=DATE '2026-05-01' AND cd."fechaClaseDictada"<DATE '2026-11-01'
  AND NOT COALESCE((SELECT ca."conControlAsistencia" FROM correcciones_asistencia ca WHERE ca."claseDictadaId"=cd."idClaseDictada" ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1),cd."conControlAsistencia");

-- Umbral de lectura vigente, 75 en ausencia de una configuración válida.
SELECT clave, valor FROM parametros_sistema WHERE clave='umbral_presentismo';

-- Versus por materia, sobre los mismos estados vigentes.
WITH clases AS (
  SELECT cd.*, COALESCE((SELECT ca."conControlAsistencia" FROM correcciones_asistencia ca
    WHERE ca."claseDictadaId"=cd."idClaseDictada" ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1), cd."conControlAsistencia") AS control
  FROM clases_dictadas cd WHERE cd."anuladaEl" IS NULL
    AND cd."fechaClaseDictada">=DATE '2026-05-01' AND cd."fechaClaseDictada"<DATE '2026-11-01'
), estados AS (
  SELECT cd."fechaClaseDictada", cd."materiaId", cda."alumnoId", cd.control,
    COALESCE((SELECT caa."estadoNuevo" FROM correcciones_asistencia_alumnos caa JOIN correcciones_asistencia ca ON ca."idCorreccionAsistencia"=caa."correccionId"
      WHERE ca."claseDictadaId"=cda."claseDictadaId" AND caa."alumnoId"=cda."alumnoId"
      ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1), cda."estadoAsistencia") AS estado
  FROM clases cd JOIN clases_dictadas_alumnos cda ON cda."claseDictadaId"=cd."idClaseDictada"
)
SELECT e."materiaId", m."nombreMateria", m."activaMateria", count(*) AS inscriptos,
  count(*) FILTER(WHERE estado='PRESENTE') AS presentes, count(*) FILTER(WHERE estado='AUSENTE') AS ausentes,
  round(100.0*count(*) FILTER(WHERE estado='PRESENTE')/count(*),1) AS indice
FROM estados e JOIN materias m ON m."idMateria"=e."materiaId"
WHERE control AND estado IN ('PRESENTE','AUSENTE')
GROUP BY e."materiaId", m."nombreMateria", m."activaMateria"
ORDER BY indice, ausentes DESC, m."nombreMateria", e."materiaId";

-- Grupos de seguimiento: mínimo dos clases y umbral estricto, sin comparar redondeos.
WITH clases AS (
  SELECT cd.*, COALESCE((SELECT ca."conControlAsistencia" FROM correcciones_asistencia ca
    WHERE ca."claseDictadaId"=cd."idClaseDictada" ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1), cd."conControlAsistencia") AS control
  FROM clases_dictadas cd WHERE cd."anuladaEl" IS NULL
    AND cd."fechaClaseDictada">=DATE '2026-05-01' AND cd."fechaClaseDictada"<DATE '2026-11-01'
), estados AS (
  SELECT cd."fechaClaseDictada", cd."materiaId", cda."alumnoId", cd.control,
    COALESCE((SELECT caa."estadoNuevo" FROM correcciones_asistencia_alumnos caa JOIN correcciones_asistencia ca ON ca."idCorreccionAsistencia"=caa."correccionId"
      WHERE ca."claseDictadaId"=cda."claseDictadaId" AND caa."alumnoId"=cda."alumnoId"
      ORDER BY ca."createdAtCorreccion" DESC, ca."idCorreccionAsistencia" DESC LIMIT 1), cda."estadoAsistencia") AS estado
  FROM clases cd JOIN clases_dictadas_alumnos cda ON cda."claseDictadaId"=cd."idClaseDictada"
)
SELECT e."alumnoId", e."materiaId", count(*) AS clases,
  count(*) FILTER(WHERE estado='PRESENTE') AS presentes, count(*) FILTER(WHERE estado='AUSENTE') AS ausentes,
  round(100.0*count(*) FILTER(WHERE estado='PRESENTE')/count(*),1) AS porcentaje
FROM estados e WHERE control AND estado IN ('PRESENTE','AUSENTE')
GROUP BY e."alumnoId", e."materiaId"
HAVING count(*)>=2 AND count(*) FILTER(WHERE estado='PRESENTE')*100 <
  COALESCE((SELECT valor::integer FROM parametros_sistema WHERE clave='umbral_presentismo'),75)*count(*)
ORDER BY count(*) FILTER(WHERE estado='PRESENTE')::numeric/count(*), ausentes DESC, e."alumnoId" COLLATE "C", e."materiaId" COLLATE "C";
