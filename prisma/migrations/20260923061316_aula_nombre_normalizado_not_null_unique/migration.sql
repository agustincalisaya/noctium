-- AlterTable
ALTER TABLE "aulas" ALTER COLUMN "nombreNormalizadaAula" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "aulas_nombreNormalizadaAula_key" ON "aulas"("nombreNormalizadaAula");
