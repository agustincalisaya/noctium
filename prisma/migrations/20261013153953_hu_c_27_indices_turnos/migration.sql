-- HU-C-27 (criterio 12): índices del listado de clases.
-- Generada con `prisma migrate dev`; se quitaron el DROP/ADD de
-- "reservas_turno_turnoId_fkey" que agregó por una diferencia previa entre
-- schema.prisma (ON UPDATE CASCADE) y la migración del Sprint 1 que creó la
-- FK (20260924150000): esa diferencia no es de esta HU.

-- CreateIndex
CREATE INDEX "turnos_fechaTurno_horaInicioTurno_idx" ON "turnos"("fechaTurno", "horaInicioTurno");

-- CreateIndex
CREATE INDEX "turnos_profesorId_fechaTurno_idx" ON "turnos"("profesorId", "fechaTurno");

-- CreateIndex
CREATE INDEX "turnos_materiaId_fechaTurno_idx" ON "turnos"("materiaId", "fechaTurno");
