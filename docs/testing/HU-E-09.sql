-- HU-E-09: consultas de lectura, ejecutar sobre la base de demostración.
-- Claves naturales estables del seed: Matemática / profesor1 / 11:00,
-- 05-01 sin registrar, 06-01 con control, 07-01 sin control.
SELECT t."idTurno", t."fechaTurno", t."horaInicioTurno", m."nombreMateria", p."emailProfesor",
       cd."idClaseDictada", cd."conControlAsistencia", cd."creadoPorUsuarioId", cd."createdAtClaseDictada"
FROM turnos t JOIN materias m ON m."idMateria" = t."materiaId"
JOIN profesores p ON p."idProfesor" = t."profesorId"
LEFT JOIN clases_dictadas cd ON cd."turnoId" = t."idTurno" AND cd."anuladaEl" IS NULL
WHERE t."fechaTurno" IN ('2026-01-05', '2026-01-06', '2026-01-07')
  AND t."horaInicioTurno" = '11:00' AND p."emailProfesor" = 'profesor1@noctium.local'
ORDER BY t."fechaTurno";

-- Snapshot y estado original. Las correcciones vigentes se leen con valor-vigente.ts.
SELECT cd."idClaseDictada", cd."fechaClaseDictada", cd."conControlAsistencia", a."idAlumno",
       a."apellidoAlumno", a."nombreAlumno", cda."estadoAsistencia"
FROM clases_dictadas cd JOIN clases_dictadas_alumnos cda ON cda."claseDictadaId" = cd."idClaseDictada"
JOIN alumnos a ON a."idAlumno" = cda."alumnoId"
WHERE cd."fechaClaseDictada" IN ('2026-01-05', '2026-01-06', '2026-01-07')
ORDER BY cd."fechaClaseDictada", a."dniAlumno";

-- Debe devolver cero filas: unicidad no anulada por turno.
SELECT "turnoId", count(*) FROM clases_dictadas WHERE "anuladaEl" IS NULL
GROUP BY "turnoId" HAVING count(*) > 1;

-- Capturar antes/después del registro y comparar: asistencia no cambia pagos/precio/vigencia.
SELECT ta."idInscripcion", ta."alumnoId", ta."vigencia", ta."estadoPago", ta."precio", ta."venceEl"
FROM turno_alumno ta JOIN turnos t ON t."idTurno" = ta."turnoId"
WHERE t."fechaTurno" IN ('2026-01-05', '2026-01-06', '2026-01-07') ORDER BY ta."idInscripcion";
SELECT count(*) AS operaciones FROM operaciones_pago;
SELECT count(*) AS pagos, sum("montoPago") AS monto_original FROM pagos;
