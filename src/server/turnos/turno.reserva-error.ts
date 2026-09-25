import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

/** PostgreSQL 23P01 puede llegar envuelto por distintas clases de Prisma. */
export function esConflictoDeReserva(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) &&
      !(error instanceof Prisma.PrismaClientUnknownRequestError)) return false;
  const descripcion = `${error.message} ${error instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(error.meta ?? {}) : ""}`;
  return /23P01|reservas_turno_sin_solapamiento|exclusion constraint/i.test(descripcion);
}

export function recursoEnConflicto(error: unknown): "AULA" | "PROFESOR" | "ALUMNO" | null {
  const descripcion = error instanceof Error ? error.message : String(error);
  const encontrado = descripcion.match(/\b(AULA|PROFESOR|ALUMNO)\b/);
  return encontrado ? encontrado[1] as "AULA" | "PROFESOR" | "ALUMNO" : null;
}

export function alumnoEnConflicto(error: unknown): string | undefined {
  const descripcion = error instanceof Error ? error.message : String(error);
  return descripcion.match(/\(ALUMNO,\s*([^,\s]+),/)?.[1];
}

const MENSAJES_CONFLICTO = {
  AULA: ["AULA_NO_DISPONIBLE", "El aula ya tiene un turno confirmado en ese horario"],
  PROFESOR: ["PROFESOR_NO_DISPONIBLE", "El profesor ya tiene un turno agendado en ese horario"],
  ALUMNO: ["ALUMNO_NO_DISPONIBLE", "El alumno ya tiene un turno agendado en ese horario"],
} as const;

export function conflictoDeRecurso(tipo: keyof typeof MENSAJES_CONFLICTO, alumnoId?: string) {
  const [codigo, mensaje] = MENSAJES_CONFLICTO[tipo];
  return new ServiceError(codigo, mensaje, alumnoId ? { alumno_id: alumnoId } : undefined);
}

/** Traduce una violación de `reservas_turno` al recurso concreto en conflicto. */
export function errorDeReserva(error: unknown) {
  const tipo = recursoEnConflicto(error);
  if (tipo) return conflictoDeRecurso(tipo, tipo === "ALUMNO" ? alumnoEnConflicto(error) : undefined);
  return new ServiceError("RECURSO_NO_DISPONIBLE", "Un recurso dejó de estar disponible. Volvé a intentar");
}
