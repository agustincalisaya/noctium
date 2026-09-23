CREATE TABLE "eventos_turno" (
  "idEvento" TEXT NOT NULL,
  "tipoEvento" TEXT NOT NULL,
  "turnoId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "payloadEvento" JSONB NOT NULL,
  "creadoEnEvento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_turno_pkey" PRIMARY KEY ("idEvento")
);

CREATE INDEX "eventos_turno_turnoId_creadoEnEvento_idx" ON "eventos_turno"("turnoId", "creadoEnEvento");
