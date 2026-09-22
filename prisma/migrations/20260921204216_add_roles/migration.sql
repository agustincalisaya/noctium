-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('PENDIENTE', 'AGENDADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RolUsuario" ADD VALUE 'GERENTE';
ALTER TYPE "RolUsuario" ADD VALUE 'MESA_ENTRADA';

-- DropForeignKey
ALTER TABLE "turnos" DROP CONSTRAINT "turnos_aulaId_fkey";

-- DropForeignKey
ALTER TABLE "turnos" DROP CONSTRAINT "turnos_profesorId_fkey";

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "estadoTurno" "EstadoTurno" NOT NULL DEFAULT 'PENDIENTE',
ALTER COLUMN "profesorId" DROP NOT NULL,
ALTER COLUMN "aulaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "activoUsuario" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("idProfesor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "aulas"("idAula") ON DELETE SET NULL ON UPDATE CASCADE;
