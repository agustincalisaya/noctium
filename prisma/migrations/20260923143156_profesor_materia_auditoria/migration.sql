-- AlterTable
ALTER TABLE "profesor_materia" ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "createdAtProfesorMateria" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
