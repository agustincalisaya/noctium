-- Las reservas son una proyección transaccional de turnos confirmados. No son
-- entidades de dominio: se reemplazan al cambiar el turno o sus alumnos.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "reservas_turno" (
  "turnoId" text NOT NULL REFERENCES "turnos"("idTurno") ON DELETE CASCADE,
  "tipoRecurso" text NOT NULL,
  "recursoId" text NOT NULL,
  "inicioReserva" timestamp(6) NOT NULL,
  "finReserva" timestamp(6) NOT NULL,
  CONSTRAINT "reservas_turno_pkey" PRIMARY KEY ("turnoId", "tipoRecurso", "recursoId"),
  CONSTRAINT "reservas_turno_tipo_check" CHECK ("tipoRecurso" IN ('AULA', 'PROFESOR', 'ALUMNO')),
  CONSTRAINT "reservas_turno_intervalo_check" CHECK ("inicioReserva" < "finReserva"),
  CONSTRAINT "reservas_turno_sin_solapamiento" EXCLUDE USING gist (
    "tipoRecurso" WITH =,
    "recursoId" WITH =,
    tsrange("inicioReserva", "finReserva", '[)') WITH &&
  )
);

-- Un UPDATE de Turno cubre la confirmación y cualquier escritura futura que
-- cambie horario, estado, aula o profesor. PENDIENTE carece de reservas.
CREATE FUNCTION sincronizar_reservas_turno() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inicio timestamp;
  fin timestamp;
BEGIN
  DELETE FROM "reservas_turno" WHERE "turnoId" = NEW."idTurno";
  IF NEW."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') THEN
    inicio := NEW."fechaTurno" + NEW."horaInicioTurno";
    fin := inicio + NEW."duracionMinutosTurno" * interval '1 minute';
    IF NEW."profesorId" IS NOT NULL THEN
      INSERT INTO "reservas_turno" VALUES (NEW."idTurno", 'PROFESOR', NEW."profesorId", inicio, fin);
    END IF;
    IF NEW."aulaId" IS NOT NULL THEN
      INSERT INTO "reservas_turno" VALUES (NEW."idTurno", 'AULA', NEW."aulaId", inicio, fin);
    END IF;
    INSERT INTO "reservas_turno" ("turnoId", "tipoRecurso", "recursoId", "inicioReserva", "finReserva")
    SELECT NEW."idTurno", 'ALUMNO', ta."alumnoId", inicio, fin
    FROM "turno_alumno" ta WHERE ta."turnoId" = NEW."idTurno"
    ORDER BY ta."alumnoId";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER turno_sincronizar_reservas
AFTER INSERT OR UPDATE OF "estadoTurno", "fechaTurno", "horaInicioTurno", "duracionMinutosTurno", "profesorId", "aulaId"
ON "turnos" FOR EACH ROW EXECUTE FUNCTION sincronizar_reservas_turno();

-- El lock del padre coordina altas/bajas de HU-C-04 con la confirmación.
-- La exclusión GiST coordina alumnos compartidos entre turnos distintos.
CREATE FUNCTION sincronizar_reserva_alumno() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  turno "turnos"%ROWTYPE;
  inicio timestamp;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT * INTO turno FROM "turnos" WHERE "idTurno" = OLD."turnoId" FOR UPDATE;
    DELETE FROM "reservas_turno" WHERE "turnoId" = OLD."turnoId"
      AND "tipoRecurso" = 'ALUMNO' AND "recursoId" = OLD."alumnoId";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT * INTO turno FROM "turnos" WHERE "idTurno" = NEW."turnoId" FOR UPDATE;
    IF turno."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') THEN
      inicio := turno."fechaTurno" + turno."horaInicioTurno";
      INSERT INTO "reservas_turno" VALUES (
        NEW."turnoId", 'ALUMNO', NEW."alumnoId", inicio,
        inicio + turno."duracionMinutosTurno" * interval '1 minute'
      );
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER turno_alumno_sincronizar_reserva
AFTER INSERT OR UPDATE OR DELETE ON "turno_alumno"
FOR EACH ROW EXECUTE FUNCTION sincronizar_reserva_alumno();

-- Backfill en la misma transacción: un solapamiento existente aborta toda la
-- migración, sin borrar ni modificar turnos. El lock evita escrituras a medio
-- backfill entre la instalación de los triggers y esta actualización.
LOCK TABLE "turnos", "turno_alumno" IN SHARE ROW EXCLUSIVE MODE;
UPDATE "turnos" SET "estadoTurno" = "estadoTurno"
WHERE "estadoTurno" IN ('DISPONIBLE', 'COMPLETO');

INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso")
VALUES ('perm-turnos-asignar-aula-mesa', 'MESA_ENTRADA', 'turnos:asignar_aula', now())
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;
COMMIT;
