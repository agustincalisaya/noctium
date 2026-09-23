import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";

/**
 * Resuelve el nombre a mostrar en el Navbar (HU-A-03 criterio 1). `Usuario`
 * no tiene campo de nombre propio (el JWT solo lleva `id`/`rol`, nunca
 * datos personales — HU-A-01 criterio 3). Para ALUMNO/PROFESOR el nombre
 * real vive en la ficha vinculada (`Alumno`/`Profesor`); GERENTE y
 * MESA_ENTRADA no tienen ninguna ficha asociada en el modelo de datos de
 * este sprint, así que caen al email como identificador.
 */
export async function obtenerNombreVisible(usuarioId: string, rol: RolUsuario): Promise<string> {
  if (rol === "ALUMNO") {
    const alumno = await prisma.alumno.findUnique({
      where: { usuarioId },
      select: { nombreAlumno: true, apellidoAlumno: true },
    });
    if (alumno) return `${alumno.nombreAlumno} ${alumno.apellidoAlumno}`;
  }

  if (rol === "PROFESOR") {
    const profesor = await prisma.profesor.findUnique({
      where: { usuarioId },
      select: { nombreProfesor: true, apellidoProfesor: true },
    });
    if (profesor) return `${profesor.nombreProfesor} ${profesor.apellidoProfesor}`;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: usuarioId },
    select: { emailUsuario: true },
  });
  return usuario?.emailUsuario ?? "";
}
