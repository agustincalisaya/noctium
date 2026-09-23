-- RBAC (HU-B-02): alumnos:editar, exclusivo de Mesa de Entrada (spec_modulo_B.md §2.2).
INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso") VALUES
  ('perm-alumnos-editar-mesa', 'MESA_ENTRADA', 'alumnos:editar', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
