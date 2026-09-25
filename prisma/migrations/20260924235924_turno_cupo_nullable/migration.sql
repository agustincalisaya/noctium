-- spec_modulo_C.md Revisión 3: el cupo máximo se fija al asignar aula
-- (cupoMaximoTurno = capacidadAula). Un turno sin aula todavía no tiene cupo.
ALTER TABLE "turnos" ALTER COLUMN "cupoMaximoTurno" DROP NOT NULL;
