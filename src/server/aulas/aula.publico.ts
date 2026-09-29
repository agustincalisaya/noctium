import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Contrato acotado para HU-C-15; no concede el permiso general aulas:leer. */
export async function listarAulasActivasParaTurno(cupoMaximo: number) {
  const aulas = await prisma.aula.findMany({
    where: { activaAula: true, capacidadAula: { gte: cupoMaximo } },
    select: { idAula: true, nombreAula: true, capacidadAula: true },
    orderBy: [{ nombreAula: "asc" }, { idAula: "asc" }],
  });
  return aulas.map((aula) => ({ id: aula.idAula, nombre: aula.nombreAula, capacidad: aula.capacidadAula }));
}

export async function verificarAulaActiva(id: string, db: Prisma.TransactionClient = prisma) {
  return db.aula.findFirst({
    where: { idAula: id, activaAula: true },
    select: { idAula: true, capacidadAula: true },
  });
}

/** Contrato para HU-C-15: distingue "no hay aulas activas" sin que Turno consulte la tabla de Aula (Regla N.° 3). */
export async function hayAulasActivas(db: Prisma.TransactionClient = prisma) {
  return (await db.aula.count({ where: { activaAula: true } })) > 0;
}

/** Contrato para HU-C-15: existencia del aula sin importar su estado, para separar inexistente de inactiva. */
export async function existeAula(id: string, db: Prisma.TransactionClient = prisma) {
  return (await db.aula.count({ where: { idAula: id } })) > 0;
}
