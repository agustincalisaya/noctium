-- AlterTable
ALTER TABLE "profesores" ADD COLUMN     "modificadoPorUsuarioId" TEXT;

-- RBAC (HU-D-02): profesores:editar, exclusivo de Gerente (spec_modulo_D.md §2.2).
INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso") VALUES
  ('perm-profesores-editar-gerente', 'GERENTE', 'profesores:editar', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
