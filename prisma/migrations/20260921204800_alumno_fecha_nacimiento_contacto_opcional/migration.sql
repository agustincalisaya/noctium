-- fechaNacimientoAlumno es obligatoria (HU-B-01). Como la tabla puede tener filas
-- previas, se agrega primero nullable, se rellenan con una fecha placeholder y
-- recién después se marca NOT NULL.

-- AlterTable
ALTER TABLE "alumnos" ADD COLUMN     "fechaNacimientoAlumno" DATE,
ALTER COLUMN "telefonoAlumno" DROP NOT NULL,
ALTER COLUMN "emailAlumno" DROP NOT NULL;

-- Backfill de filas existentes (placeholder)
UPDATE "alumnos" SET "fechaNacimientoAlumno" = DATE '2000-01-01' WHERE "fechaNacimientoAlumno" IS NULL;

-- AlterTable
ALTER TABLE "alumnos" ALTER COLUMN "fechaNacimientoAlumno" SET NOT NULL;
