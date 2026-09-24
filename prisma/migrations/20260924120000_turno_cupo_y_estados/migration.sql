-- HU-C-03 (spec_modulo_C.md Revisión 2): cupo máximo por turno y máquina de
-- 3 estados. AGENDADO se reemplaza (no se mapea): se aplica con
-- `prisma migrate reset`, sin datos productivos que migrar.

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoTurno_new" AS ENUM ('PENDIENTE', 'DISPONIBLE', 'COMPLETO');
ALTER TABLE "public"."turnos" ALTER COLUMN "estadoTurno" DROP DEFAULT;
ALTER TABLE "turnos" ALTER COLUMN "estadoTurno" TYPE "EstadoTurno_new" USING ("estadoTurno"::text::"EstadoTurno_new");
ALTER TYPE "EstadoTurno" RENAME TO "EstadoTurno_old";
ALTER TYPE "EstadoTurno_new" RENAME TO "EstadoTurno";
DROP TYPE "public"."EstadoTurno_old";
ALTER TABLE "turnos" ALTER COLUMN "estadoTurno" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "cupoMaximoTurno" INTEGER NOT NULL;

