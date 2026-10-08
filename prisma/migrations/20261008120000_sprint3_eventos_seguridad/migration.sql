-- Sprint 3 (PR 0, spec_modulo_A.md §4 Revisión 3): tipos de EventoSeguridad de
-- HU-A-06 (cuenta creada, contraseña cambiada) y HU-A-05 (recuperación).
-- Migración separada: PostgreSQL no permite usar un valor agregado con
-- ADD VALUE en la misma transacción, y ninguna migración del sprint los usa.
ALTER TYPE "TipoEventoSeguridad" ADD VALUE IF NOT EXISTS 'CUENTA_CREADA';
ALTER TYPE "TipoEventoSeguridad" ADD VALUE IF NOT EXISTS 'PASSWORD_CAMBIADA';
ALTER TYPE "TipoEventoSeguridad" ADD VALUE IF NOT EXISTS 'RECUPERACION_SOLICITADA';
ALTER TYPE "TipoEventoSeguridad" ADD VALUE IF NOT EXISTS 'RECUPERACION_LIMITADA';
ALTER TYPE "TipoEventoSeguridad" ADD VALUE IF NOT EXISTS 'RECUPERACION_ENVIO_FALLIDO';
ALTER TYPE "TipoEventoSeguridad" ADD VALUE IF NOT EXISTS 'RECUPERACION_CONFIRMADA';
