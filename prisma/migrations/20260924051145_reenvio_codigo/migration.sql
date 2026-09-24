-- CreateTable
CREATE TABLE "reenvios_codigo" (
    "idReenvio" TEXT NOT NULL,
    "codigoId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reenvios_codigo_pkey" PRIMARY KEY ("idReenvio")
);

-- CreateIndex
CREATE INDEX "reenvios_codigo_codigoId_creadoEn_idx" ON "reenvios_codigo"("codigoId", "creadoEn");

-- AddForeignKey
ALTER TABLE "reenvios_codigo" ADD CONSTRAINT "reenvios_codigo_codigoId_fkey" FOREIGN KEY ("codigoId") REFERENCES "codigos_verificacion"("idCodigo") ON DELETE CASCADE ON UPDATE CASCADE;
