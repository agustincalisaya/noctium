import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import type { IdentidadProfesorInput } from "@/server/profesores/profesor.schema";

/**
 * Alta de identidad de profesor (HU-D-01, `spec_modulo_D.md` §2.1 punto 3).
 * `input` ya llegó validado por `construirIdentidadProfesorSchema().safeParse()`
 * en la capa delgada (Server Action / Route Handler) — este servicio no
 * vuelve a parsear con Zod ni verifica sesión/permiso (Regla N.° 4 de
 * `docs/RULES.md`: la capa de servicios es dueña de la lógica de negocio,
 * la validación de forma y el RBAC viven en la capa que la invoca).
 * `usuarioRegistranteId` es el `id` de la sesión ya autorizada por
 * `withPermission("profesores:crear")` / `verificarPermiso("profesores:crear")`
 * — este servicio nunca chequea `SIN_PERMISO`, confía en que quien lo invoca
 * ya lo hizo (mismo criterio que `verificarCredenciales()` en
 * `src/server/sesion/autenticacion.service.ts`, que tampoco autoriza nada).
 *
 * No hay `prisma.$transaction` multi-tabla: es una única sentencia `INSERT`
 * sobre `Profesor`, ya atómica por sí misma. El `findFirst` previo reduce la
 * ventana de una alta duplicada simultánea (dos gerentes registrando el
 * mismo DNI a la vez); el catch de `P2002` es la red de seguridad final que
 * la cierra del todo — mismo patrón de doble defensa documentado para
 * `verificarDniDisponible()` en la task, y el mismo que usa
 * `spec_modulo_B.md` §3.4 para Alumno.
 */
export async function crearProfesor(
  input: IdentidadProfesorInput,
  usuarioRegistranteId: string,
): Promise<{ id: string; nombre: string; apellido: string; dni: string; activo: boolean }> {
  // Verificación de unicidad de DNI contra TODOS los profesores, activos e
  // inactivos (criterio de aceptación 3 de HU-D-01) — sin filtro por
  // activoProfesor, a diferencia de una consulta que solo mirara altas.
  const existente = await prisma.profesor.findFirst({
    where: { dniProfesor: input.dni },
    select: { idProfesor: true },
  });
  if (existente) {
    throw new ServiceError("DNI_DUPLICADO", "Ya existe un profesor registrado con ese DNI");
  }

  try {
    const profesor = await prisma.profesor.create({
      data: {
        nombreProfesor: input.nombre,
        apellidoProfesor: input.apellido,
        dniProfesor: input.dni,
        fechaNacimientoProfesor: input.fechaNacimiento,
        generoProfesor: input.genero ?? null,
        // Criterio de aceptación 4 (ficha activa) y 5 (sin cuenta de
        // acceso — las cuentas se administran de manera independiente).
        activoProfesor: true,
        usuarioId: null,
        creadoPorUsuarioId: usuarioRegistranteId,
      },
    });

    return {
      id: profesor.idProfesor,
      nombre: profesor.nombreProfesor,
      apellido: profesor.apellidoProfesor,
      dni: profesor.dniProfesor,
      activo: profesor.activoProfesor,
    };
  } catch (error) {
    // Defensa final ante un alta duplicada simultánea en la ventana entre el
    // findFirst de arriba y este INSERT (dos requests concurrentes con el
    // mismo DNI). Se filtra por el nombre de la columna en el constraint
    // para no traducir a DNI_DUPLICADO un P2002 de otro campo único de
    // Profesor (ej. usuarioId) que no tiene nada que ver con esta HU.
    const esConflictoDeDni =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (error.meta?.target as string[] | undefined)?.includes("dniProfesor");

    if (esConflictoDeDni) {
      throw new ServiceError("DNI_DUPLICADO", "Ya existe un profesor registrado con ese DNI");
    }
    throw error;
  }
}
