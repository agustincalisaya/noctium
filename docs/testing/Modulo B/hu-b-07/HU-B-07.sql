-- Ficha y cuenta del alumno antes y después de la baja o la reactivación.
SELECT a."idAlumno", a."activoAlumno", a."version", a."usuarioId", a."modificadoPorUsuarioId",
       u."activoUsuario", u."sesionesValidasDesdeUsuario", u."debeCambiarPasswordUsuario"
FROM "alumnos" a
LEFT JOIN "usuarios" u ON u."idUsuario" = a."usuarioId"
WHERE a."idAlumno" = '<alumno_id>';

-- Inscripciones: las futuras Disponibles o Completas quedan BAJA_ALUMNO; ninguna se borra.
SELECT ta."idInscripcion", t."fechaTurno", t."horaInicioTurno", t."estadoTurno", ta."vigencia", ta."estadoPago",
       ta."venceEl", ta."finalizadaEl", ta."finalizadaPorActorTipo", ta."finalizadaPorUsuarioId"
FROM "turno_alumno" ta
JOIN "turnos" t ON t."idTurno" = ta."turnoId"
WHERE ta."alumnoId" = '<alumno_id>'
ORDER BY t."fechaTurno", t."horaInicioTurno";

-- Pagos intactos (comparar antes y después).
SELECT p.* FROM "pagos" p WHERE p."alumnoId" = '<alumno_id>' ORDER BY p."createdAtPago";

-- Historial de estados, escrito después del commit.
SELECT h."accion", h."motivo", h."actorTipo", h."usuarioId", h."fecha"
FROM "historial_estados" h
WHERE h."entidad" = 'ALUMNO' AND h."entidadId" = '<alumno_id>'
ORDER BY h."fecha";

-- Autorregistro con ficha inactiva: ninguna cuenta nueva ni solicitud confirmada.
SELECT s."idSolicitud", s."confirmadaEn", c."invalidadoEn"
FROM "solicitudes_autorregistro" s
JOIN "codigos_verificacion" c ON c."idCodigo" = s."codigoId"
WHERE s."alumnoId" = '<alumno_id>';
