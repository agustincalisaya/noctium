-- Read-only: contraste del dueño de fixture y hechos públicos/ocultos.
SELECT a."idAlumno", u."emailUsuario", count(DISTINCT cd."idClaseDictada") FILTER (WHERE cd."anuladaEl" IS NULL) AS clases_vigentes,
       count(DISTINCT e."idResultadoExamen") FILTER (WHERE NOT EXISTS (SELECT 1 FROM anulaciones_resultado_examen ae WHERE ae."resultadoExamenId"=e."idResultadoExamen")) AS examenes_vigentes
FROM alumnos a JOIN usuarios u ON u."idUsuario"=a."usuarioId"
LEFT JOIN clases_dictadas_alumnos cda ON cda."alumnoId"=a."idAlumno"
LEFT JOIN clases_dictadas cd ON cd."idClaseDictada"=cda."claseDictadaId"
LEFT JOIN resultados_examen e ON e."alumnoId"=a."idAlumno"
WHERE u."emailUsuario"='alumno01@noctium.local' GROUP BY a."idAlumno",u."emailUsuario";
SELECT (SELECT count(*) FROM turnos) AS turnos, (SELECT count(*) FROM turno_alumno) AS inscripciones,
 (SELECT count(*) FROM clases_dictadas) AS clases, (SELECT count(*) FROM resultados_examen) AS examenes,
 (SELECT count(*) FROM indicaciones) AS indicaciones, (SELECT count(*) FROM pagos) AS pagos;
