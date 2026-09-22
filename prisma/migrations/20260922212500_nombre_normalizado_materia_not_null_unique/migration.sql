-- AlterTable
ALTER TABLE "materias" ALTER COLUMN "nombreNormalizadaMateria" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "materias_nombreNormalizadaMateria_key" ON "materias"("nombreNormalizadaMateria");
