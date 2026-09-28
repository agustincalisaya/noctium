-- Separada para que PostgreSQL confirme el nuevo valor antes de usarlo.
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'CANCELADO';
