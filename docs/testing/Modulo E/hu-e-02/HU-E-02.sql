-- Solo lectura. Permisos y estados históricos de los fixtures, sin montos.
SELECT "rolPermiso", "accionPermiso" FROM roles_permisos WHERE "accionPermiso" IN ('alumnos:leer','historial:leer') ORDER BY 1,2;
SELECT ta."idInscripcion",t."idTurno",t."fechaTurno",t."horaInicioTurno",t."estadoTurno",ta."vigencia",ta."finalizadaEl",
 cd."idClaseDictada",cd."anuladaEl",cda."estadoAsistencia"
FROM turno_alumno ta JOIN turnos t ON t."idTurno"=ta."turnoId"
JOIN alumnos a ON a."idAlumno"=ta."alumnoId" JOIN usuarios u ON u."idUsuario"=a."usuarioId"
LEFT JOIN clases_dictadas cd ON cd."turnoId"=t."idTurno" AND cd."anuladaEl" IS NULL
LEFT JOIN clases_dictadas_alumnos cda ON cda."claseDictadaId"=cd."idClaseDictada" AND cda."alumnoId"=a."idAlumno"
WHERE u."emailUsuario"='alumno01@noctium.local' AND t."fechaTurno" IN ('2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-20','2026-10-21')
ORDER BY t."fechaTurno" DESC, t."horaInicioTurno" DESC,ta."idInscripcion" DESC;
SELECT (SELECT count(*) FROM turnos) AS turnos, (SELECT count(*) FROM turno_alumno) AS inscripciones,
 (SELECT count(*) FROM clases_dictadas) AS clases, (SELECT count(*) FROM historial_estados) AS auditorias,
 (SELECT count(*) FROM pagos) AS pagos;
