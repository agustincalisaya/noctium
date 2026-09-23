INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso")
VALUES ('perm-turnos-crear-mesa', 'MESA_ENTRADA', 'turnos:crear', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
