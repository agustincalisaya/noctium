-- HU-E-02: el Profesor conserva historial:leer, exclusivamente con alcance por materia/clase.
DELETE FROM "roles_permisos" WHERE "rolPermiso" = 'PROFESOR' AND "accionPermiso" = 'alumnos:leer';
