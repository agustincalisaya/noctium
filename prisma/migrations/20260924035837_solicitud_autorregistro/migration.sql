-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEventoSeguridad" ADD VALUE 'CODIGO_VERIFICACION_GENERADO';
ALTER TYPE "TipoEventoSeguridad" ADD VALUE 'AUTORREGISTRO_DERIVADO_MESA_ENTRADA';

-- CreateTable
CREATE TABLE "solicitudes_autorregistro" (
    "idSolicitud" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "codigoId" TEXT NOT NULL,
    "confirmadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_autorregistro_pkey" PRIMARY KEY ("idSolicitud")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_autorregistro_codigoId_key" ON "solicitudes_autorregistro"("codigoId");

-- AddForeignKey
ALTER TABLE "solicitudes_autorregistro" ADD CONSTRAINT "solicitudes_autorregistro_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_autorregistro" ADD CONSTRAINT "solicitudes_autorregistro_codigoId_fkey" FOREIGN KEY ("codigoId") REFERENCES "codigos_verificacion"("idCodigo") ON DELETE CASCADE ON UPDATE CASCADE;
