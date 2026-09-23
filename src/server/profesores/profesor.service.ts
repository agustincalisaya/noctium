import { prisma } from "@/lib/prisma";

/** Consulta pública para revalidar una asignación dependiente del turno. */
export async function profesorActivoDictaMateria(profesorId: string, materiaId: string) {
  const profesor = await prisma.profesor.findFirst({
    where: { idProfesor: profesorId, activoProfesor: true, materias: { some: { materiaId } } },
    select: { idProfesor: true },
  });
  return profesor !== null;
}
