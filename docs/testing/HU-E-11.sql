-- Contraste read-only E11. Fechas y horario estables del fixture, sin datos secretos.
SELECT cd."idClaseDictada", t."fechaTurno", t."horaInicioTurno", cd."conControlAsistencia",
       cd."creadoPorUsuarioId", cd."anuladaEl", cd."anuladaPorUsuarioId", cd."motivoAnulacion",
       (SELECT count(*) FROM correcciones_asistencia ca WHERE ca."claseDictadaId"=cd."idClaseDictada") AS correcciones
FROM clases_dictadas cd JOIN turnos t ON t."idTurno"=cd."turnoId"
JOIN profesores p ON p."idProfesor"=cd."profesorId"
WHERE p."emailProfesor"='profesor1@noctium.local' AND t."horaInicioTurno"='11:00'
  AND t."fechaTurno" IN ('2026-09-28','2026-10-02','2026-10-05','2026-10-06','2026-10-07')
ORDER BY t."fechaTurno", cd."createdAtClaseDictada";
SELECT ca."idCorreccionAsistencia", ca."claseDictadaId", ca."motivo", ca."createdAtCorreccion", ca."creadoPorUsuarioId",
       caa."alumnoId", caa."estadoAnterior", caa."estadoNuevo"
FROM correcciones_asistencia ca JOIN correcciones_asistencia_alumnos caa ON caa."correccionId"=ca."idCorreccionAsistencia"
WHERE ca."motivo" LIKE '%HU-E-11%' OR ca."motivo" LIKE '%revisión E11%' ORDER BY ca."createdAtCorreccion", caa."alumnoId";
-- Conteos para repetir seed ANTES de los flujos de navegador.
SELECT (SELECT count(*) FROM turnos) AS turnos, (SELECT count(*) FROM turno_alumno) AS inscripciones,
       (SELECT count(*) FROM clases_dictadas) AS clases, (SELECT count(*) FROM clases_dictadas_alumnos) AS snapshots,
       (SELECT count(*) FROM correcciones_asistencia) AS correcciones,
       (SELECT count(*) FROM clases_dictadas WHERE "anuladaEl" IS NOT NULL) AS anulaciones,
       (SELECT count(*) FROM pagos) AS pagos;
