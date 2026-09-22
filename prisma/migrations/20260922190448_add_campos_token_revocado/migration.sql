-- AlterTable
ALTER TABLE "tokens_revocados" ADD COLUMN     "creadoEnRevocado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "usuarioId" TEXT;
