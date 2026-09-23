-- RBAC (HU-B-04): alumnos:leer, exclusivo de Mesa de Entrada (spec_modulo_B.md §2.4).
INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso") VALUES
  ('perm-alumnos-leer-mesa', 'MESA_ENTRADA', 'alumnos:leer', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
