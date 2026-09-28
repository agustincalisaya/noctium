-- Migración aditiva para la base local existente; no se hace reset.
BEGIN;
CREATE TYPE "PrioridadTurno" AS ENUM ('NORMAL', 'ALTA', 'URGENTE');
ALTER TABLE "turnos" ADD COLUMN "prioridadTurno" "PrioridadTurno" NOT NULL DEFAULT 'NORMAL';
-- HU-C-11 retirada del backlog v2 (28/09): el turno no lleva forma de pago ni fecha de inscripción.

ALTER TABLE "formas_pago" ADD COLUMN "nombreNormalizadaFormaPago" TEXT;
ALTER TABLE "formas_pago" ADD COLUMN "createdAtFormaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "formas_pago" ADD COLUMN "creadoPorUsuarioId" TEXT;
-- La base de desarrollo ya tiene estas cuatro opciones de Sprint 1. Ante
-- una opción distinta se detiene antes de imponer NOT NULL: hacer backfill
-- con normalizarTexto() de la aplicación y luego retomar esta migración.
UPDATE "formas_pago" SET "nombreNormalizadaFormaPago" = CASE "nombreFormaPago"
  WHEN 'Efectivo' THEN 'efectivo'
  WHEN 'Transferencia' THEN 'transferencia'
  WHEN 'Débito' THEN 'debito'
  WHEN 'Mercado Pago' THEN 'mercado pago'
  ELSE NULL END;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "formas_pago" WHERE "nombreNormalizadaFormaPago" IS NULL) THEN
    RAISE EXCEPTION 'Hay formas de pago adicionales: hacer backfill con normalizarTexto antes de migrar';
  END IF;
END $$;
ALTER TABLE "formas_pago" ALTER COLUMN "nombreNormalizadaFormaPago" SET NOT NULL;
CREATE UNIQUE INDEX "formas_pago_nombreNormalizadaFormaPago_key" ON "formas_pago"("nombreNormalizadaFormaPago");

ALTER TABLE "profesores" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "materias" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "materias" ADD COLUMN "updatedAtMateria" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "materias" ADD COLUMN "modificadoPorUsuarioId" TEXT;
ALTER TABLE "aulas" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "aulas" ADD COLUMN "updatedAtAula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "aulas" ADD COLUMN "modificadoPorUsuarioId" TEXT;

CREATE TABLE "pagos" (
  "idPago" TEXT NOT NULL PRIMARY KEY,
  "turnoId" TEXT NOT NULL,
  "alumnoId" TEXT NOT NULL,
  "montoPago" DECIMAL(11,2) NOT NULL,
  "formaPagoId" TEXT NOT NULL,
  "fechaPago" DATE NOT NULL,
  "createdAtPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPorUsuarioId" TEXT,
  CONSTRAINT "pagos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("idTurno") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "pagos_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "pagos_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("idFormaPago") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "pagos_turnoId_createdAtPago_idx" ON "pagos"("turnoId", "createdAtPago");
CREATE INDEX "pagos_alumnoId_createdAtPago_idx" ON "pagos"("alumnoId", "createdAtPago");
CREATE TABLE "clases_dictadas" (
  "idClaseDictada" TEXT NOT NULL PRIMARY KEY,
  "turnoId" TEXT NOT NULL,
  "fechaClaseDictada" DATE NOT NULL,
  "materiaId" TEXT NOT NULL,
  "profesorId" TEXT NOT NULL,
  "createdAtClaseDictada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPorUsuarioId" TEXT,
  CONSTRAINT "clases_dictadas_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("idTurno") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "clases_dictadas_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "clases_dictadas_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("idProfesor") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "clases_dictadas_turnoId_key" ON "clases_dictadas"("turnoId");
CREATE TABLE "clases_dictadas_alumnos" (
  "claseDictadaId" TEXT NOT NULL,
  "alumnoId" TEXT NOT NULL,
  CONSTRAINT "clases_dictadas_alumnos_pkey" PRIMARY KEY ("claseDictadaId", "alumnoId"),
  CONSTRAINT "clases_dictadas_alumnos_claseDictadaId_fkey" FOREIGN KEY ("claseDictadaId") REFERENCES "clases_dictadas"("idClaseDictada") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "clases_dictadas_alumnos_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "clases_dictadas_alumnos_alumnoId_idx" ON "clases_dictadas_alumnos"("alumnoId");
CREATE TABLE "resultados_examen" (
  "idResultadoExamen" TEXT NOT NULL PRIMARY KEY,
  "alumnoId" TEXT NOT NULL,
  "materiaId" TEXT NOT NULL,
  "fechaExamen" DATE NOT NULL,
  "notaExamen" DECIMAL(4,1) NOT NULL,
  "createdAtResultadoExamen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPorUsuarioId" TEXT,
  CONSTRAINT "resultados_examen_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "resultados_examen_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "resultados_examen_alumnoId_fechaExamen_idx" ON "resultados_examen"("alumnoId", "fechaExamen");

-- La migración habilita permisos también en una base que aún no corrió seed.
INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso")
SELECT 's2-' || lower(rol::text) || '-' || replace(accion, ':', '-'), rol::"RolUsuario", accion, now()
FROM (VALUES
  ('GERENTE','materias:editar'), ('GERENTE','aulas:editar'),
  ('MESA_ENTRADA','turnos:cancelar'), ('MESA_ENTRADA','turnos:reprogramar'),
  ('MESA_ENTRADA','turnos:priorizar'),
  ('ALUMNO','turnos:leer_propios'), ('ALUMNO','turnos:solicitar_propio'),
  ('GERENTE','formas_pago:crear'), ('GERENTE','formas_pago:leer'),
  ('MESA_ENTRADA','formas_pago:leer'), ('MESA_ENTRADA','pagos:crear'),
  ('MESA_ENTRADA','pagos:leer'), ('GERENTE','pagos:leer'),
  ('MESA_ENTRADA','clases:registrar'), ('PROFESOR','clases:registrar'),
  ('MESA_ENTRADA','examenes:registrar'), ('PROFESOR','examenes:registrar'),
  ('MESA_ENTRADA','historial:leer'), ('GERENTE','historial:leer'),
  ('PROFESOR','historial:leer'), ('GERENTE','indicadores:leer')
) AS p(rol, accion)
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;

INSERT INTO "parametros_sistema" ("clave", "valor") VALUES
  ('generacion_maxima_dias','150'), ('generacion_maxima_turnos','40'),
  ('nota_minima','1'), ('nota_maxima','10')
ON CONFLICT ("clave") DO NOTHING;
COMMIT;
