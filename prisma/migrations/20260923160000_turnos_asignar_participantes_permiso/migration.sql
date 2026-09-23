INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso")
VALUES ('perm-turnos-asignar-participantes-mesa', 'MESA_ENTRADA', 'turnos:asignar_participantes', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
