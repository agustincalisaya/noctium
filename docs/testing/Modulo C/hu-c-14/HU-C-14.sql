SELECT ta."idInscripcion", ta."turnoId", ta."alumnoId", ta."vigencia", ta."estadoPago",
       ta."finalizadaEl", ta."finalizadaPorActorTipo", ta."finalizadaPorUsuarioId", ta."precio", ta."venceEl"
FROM "turno_alumno" ta
WHERE ta."idInscripcion" = '<inscripcion_id>';

SELECT et."tipoEvento", et."turnoId", et."usuarioId", et."creadoEnEvento", et."payloadEvento"
FROM "eventos_turno" et
WHERE et."turnoId" = '<turno_id>'
ORDER BY et."creadoEnEvento" DESC;

SELECT p.*
FROM "pagos" p
WHERE p."inscripcionId" = '<inscripcion_id>';
