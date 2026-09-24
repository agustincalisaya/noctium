import { Prisma } from "@prisma/client";

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
