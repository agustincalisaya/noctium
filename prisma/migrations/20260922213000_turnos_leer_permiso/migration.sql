INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso") VALUES
  ('perm-turnos-leer-mesa', 'MESA_ENTRADA', 'turnos:leer', NOW()),
  ('perm-turnos-leer-gerente', 'GERENTE', 'turnos:leer', NOW()),
  ('perm-turnos-leer-profesor', 'PROFESOR', 'turnos:leer', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
