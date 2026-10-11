-- Solo lectura. Ejecutar en la base descartable usada para UI/API.
SELECT p."dniProfesor", p."activoProfesor", p.version,
       u."activoUsuario", u."debeCambiarPasswordUsuario",
       u."sesionesValidasDesdeUsuario" IS NOT NULL AS sesiones_revocadas,
       (SELECT count(*) FROM historial_estados h
        WHERE h.entidad = 'PROFESOR' AND h."entidadId" = p."idProfesor") AS cambios_estado
FROM profesores p LEFT JOIN usuarios u ON u."idUsuario" = p."usuarioId"
WHERE p."dniProfesor" IN ('88080001', '88080002') ORDER BY p."dniProfesor";
