-- HU-D-05 (spec_modulo_D.md §2.5): orden case/acento-insensitivo del listado
-- de profesores, mismo criterio que alumnos (HU-B-04).

-- AlterTable: primero nullable, para poder completar las filas existentes.
ALTER TABLE "profesores" ADD COLUMN     "apellidoNormalizadoProfesor" TEXT,
ADD COLUMN     "nombreNormalizadoProfesor" TEXT;

-- Backfill con el mismo algoritmo que normalizarTexto()
-- (src/lib/normalizar-texto.ts), paso por paso:
--   texto.normalize("NFD")            -> normalize(x, NFD)       (PostgreSQL >= 13)
--   .replace(/[̀-ͯ]/g, "")  -> regexp_replace(..., '[̀-ͯ]', '', 'g')
--   .toLowerCase()                    -> lower(...)
-- Así cubre cualquier letra con diacrítico que admita el schema de identidad
-- (\p{L}), no solo las del español. Requiere una base en UTF8 (la del
-- docker-compose lo es). Las altas nuevas las normaliza la aplicación.
UPDATE "profesores" SET
  "apellidoNormalizadoProfesor" = lower(regexp_replace(normalize("apellidoProfesor", NFD), '[̀-ͯ]', '', 'g')),
  "nombreNormalizadoProfesor"   = lower(regexp_replace(normalize("nombreProfesor", NFD), '[̀-ͯ]', '', 'g'));

ALTER TABLE "profesores" ALTER COLUMN "apellidoNormalizadoProfesor" SET NOT NULL,
ALTER COLUMN "nombreNormalizadoProfesor" SET NOT NULL;

-- CreateIndex
CREATE INDEX "profesores_orden_listado_idx" ON "profesores"("apellidoNormalizadoProfesor", "nombreNormalizadoProfesor", "dniProfesor");

-- RBAC (HU-D-05): profesores:leer (listado y detalle), exclusivo de Gerente —
-- mismo rol que profesores:crear/editar y que la regla de /profesores en
-- src/server/shared/rutas-por-rol.ts.
INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso") VALUES
  ('perm-profesores-leer-gerente', 'GERENTE', 'profesores:leer', NOW())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
