
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import { bloquearMateriasParaAsociar } from "@/server/materias/materia.service";
import type {
  ContactoProfesorInput,
  IdentidadProfesorInput,
} from "@/server/profesores/profesor.schema";
import type { MateriaDeProfesor } from "@/types/profesor.types";




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

/**
 * Ficha del profesor (HU-D-02: identidad resumida + contacto actual, para
 * la ficha y para precargar el formulario de contacto). HU-D-05 la extiende
 * con materias y horarios. `null` si el id no existe.
 */
export async function obtenerFichaProfesor(profesorId: string): Promise<{
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  activo: boolean;
  telefono: string | null;
  email: string | null;
} | null> {
  const profesor = await prisma.profesor.findUnique({
    where: { idProfesor: profesorId },
    select: {
      idProfesor: true,
      nombreProfesor: true,
      apellidoProfesor: true,
      dniProfesor: true,
      activoProfesor: true,
      telefonoProfesor: true,
      emailProfesor: true,
    },
  });
  if (!profesor) return null;

  return {
    id: profesor.idProfesor,
    nombre: profesor.nombreProfesor,
    apellido: profesor.apellidoProfesor,
    dni: profesor.dniProfesor,
    activo: profesor.activoProfesor,
    telefono: profesor.telefonoProfesor,
    email: profesor.emailProfesor,
  };
}

/**
 * Registro/actualización del contacto del profesor (HU-D-02,
 * `spec_modulo_D.md` §2.2). `input` ya llegó validado y normalizado por
 * `ContactoProfesorSchema` en la capa delgada; `usuarioModificadorId` es el
 * id de la sesión ya autorizada con `profesores:editar` (mismo criterio que
 * `crearProfesor()` de arriba: este servicio no chequea permisos).
 *
 * Se guardan ambos campos siempre: un campo que viene vacío borra el valor
 * anterior (`null`) — el formulario precarga el contacto actual, así que
 * vaciarlo es una decisión explícita del usuario. El schema ya garantiza que
 * al menos uno de los dos quede cargado.
 *
 * Todo corre en una única `$transaction`: la verificación de email contra
 * cuentas existentes y el `UPDATE` se confirman juntos, sin guardado parcial
 * (criterios 5 y 6). Nunca modifica `Usuario`: las cuentas se administran
 * de manera independiente (HU-D-01 c5).
 */
export async function actualizarContactoProfesor(
  profesorId: string,
  input: ContactoProfesorInput,
  usuarioModificadorId: string,
): Promise<{ id: string; telefono: string | null; email: string | null }> {
  return prisma.$transaction(async (tx) => {
    const profesor = await tx.profesor.findUnique({
      where: { idProfesor: profesorId },
      select: { idProfesor: true, usuarioId: true },
    });
    if (!profesor) {
      throw new ServiceError("PROFESOR_NO_ENCONTRADO", "El profesor no existe");
    }

    if (input.email) {
      // Criterio 4: el email no puede pertenecer a OTRA cuenta. La cuenta
      // propia del profesor (si tiene) queda excluida; sin cuenta vinculada,
      // cualquier coincidencia bloquea. Comparación case-insensitive porque
      // emailUsuario no garantiza estar guardado en minúsculas.
      const otraCuenta = await tx.usuario.findFirst({
        where: {
          emailUsuario: { equals: input.email, mode: "insensitive" },
          ...(profesor.usuarioId ? { NOT: { idUsuario: profesor.usuarioId } } : {}),
        },
        select: { idUsuario: true },
      });
      if (otraCuenta) {
        throw new ServiceError("EMAIL_YA_ASOCIADO", "El email pertenece a otra cuenta");
      }
    }

    const actualizado = await tx.profesor.update({
      where: { idProfesor: profesorId },
      data: {
        telefonoProfesor: input.telefono ?? null,
        emailProfesor: input.email ?? null,
        modificadoPorUsuarioId: usuarioModificadorId,
        // updatedAtProfesor lo actualiza Prisma (@updatedAt).
      },
      select: { idProfesor: true, telefonoProfesor: true, emailProfesor: true },
    });

    return {
      id: actualizado.idProfesor,
      telefono: actualizado.telefonoProfesor,
      email: actualizado.emailProfesor,
    };
  });
}

/**
 * Materias asociadas al profesor (HU-D-03), para la ficha y el formulario de
 * asociación; HU-D-05 la reutiliza para el detalle. Devuelve TODAS las
 * asociadas, también las de materias que después se dieron de baja, con su
 * estado en `activa` — ocultarlas haría que la ficha no refleje lo que está
 * en `profesor_materia` (HU-D-03 §1 punto 12). Lectura sobre la tabla propia
 * del módulo D, vía la relación a `Materia` que ya usan HU-L-02 y el seed.
 */
export async function obtenerMateriasDelProfesor(profesorId: string): Promise<MateriaDeProfesor[]> {
  const asociaciones = await prisma.profesorMateria.findMany({
    where: { profesorId },
    select: {
      materia: {
        select: { idMateria: true, nombreMateria: true, codigoMateria: true, activaMateria: true },
      },
    },
    orderBy: { materia: { nombreMateria: "asc" } },
  });

  return asociaciones.map(({ materia }) => ({
    id: materia.idMateria,
    nombre: materia.nombreMateria,
    codigo: materia.codigoMateria,
    activa: materia.activaMateria,
  }));
}

/**
 * Asociación de materias al profesor (HU-D-03, `spec_modulo_D.md` §2.3 y
 * §3.3). `materiaIds` ya llegó validado y sin repetidos por
 * `AsociarMateriasProfesorSchema`; `usuarioId` es la sesión ya autorizada
 * con `profesores:editar` (este servicio no chequea permisos).
 *
 * Todo-o-nada en una única `$transaction`, en el orden de la spec:
 * 1. Profesor activo: condición y mutación en un solo `updateMany`
 *    (Regla N.° 7) — la fila queda bloqueada hasta el commit, y de paso
 *    registra quién modificó al profesor (Regla N.° 2, opción a).
 * 2. Duplicados: si alguna ya está asociada, se rechaza el lote.
 * 3. Materias: `bloquearMateriasParaAsociar()` (servicio público del
 *    módulo L, Regla N.° 3) las bloquea con FOR SHARE; si alguna no existe
 *    o dejó de estar activa, se aborta sin guardar ninguna (criterio 4).
 * 4. INSERT de todo el lote, sin `skipDuplicates`: un duplicado nunca se
 *    ignora en silencio. El catch de P2002 cubre dos confirmaciones
 *    simultáneas que pasaron el paso 2 a la vez.
 *
 * No emite eventos: la trazabilidad es `createdAtProfesorMateria` +
 * `creadoPorUsuarioId` de cada fila (HU-D-03 §1 punto 3).
 */
export async function asociarMateriasAProfesor(
  profesorId: string,
  materiaIds: string[],
  usuarioId: string,
): Promise<{ id: string; nombre: string; codigo: string | null }[]> {
  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.profesor.updateMany({
        where: { idProfesor: profesorId, activoProfesor: true },
        // updatedAtProfesor lo actualiza Prisma (@updatedAt).
        data: { modificadoPorUsuarioId: usuarioId },
      });
      if (count === 0) {
        const existe = await tx.profesor.findUnique({
          where: { idProfesor: profesorId },
          select: { idProfesor: true },
        });
        throw existe
          ? new ServiceError("PROFESOR_INACTIVO", "El profesor no está activo")
          : new ServiceError("PROFESOR_NO_ENCONTRADO", "El profesor no existe");
      }

      const yaAsociadas = await tx.profesorMateria.findMany({
        where: { profesorId, materiaId: { in: materiaIds } },
        select: { materia: { select: { idMateria: true, nombreMateria: true } } },
      });
      if (yaAsociadas.length > 0) {
        throw new ServiceError("MATERIA_YA_ASOCIADA", "Alguna materia ya está asociada al profesor", {
          materias: yaAsociadas.map(({ materia }) => ({
            id: materia.idMateria,
            nombre: materia.nombreMateria,
          })),
        });
      }

      const materias = await bloquearMateriasParaAsociar(materiaIds, tx);
      if (materias.length !== materiaIds.length) {
        throw new ServiceError("MATERIA_NO_ENCONTRADA", "Alguna materia no existe");
      }
      const inactivas = materias.filter((materia) => !materia.activa);
      if (inactivas.length > 0) {
        throw new ServiceError("MATERIA_INACTIVA", "Alguna materia dejó de estar activa", {
          materias: inactivas.map(({ id, nombre }) => ({ id, nombre })),
        });
      }

      await tx.profesorMateria.createMany({
        data: materiaIds.map((materiaId) => ({
          profesorId,
          materiaId,
          creadoPorUsuarioId: usuarioId,
        })),
      });

      return materias
        .map(({ id, nombre, codigo }) => ({ id, nombre, codigo }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
  } catch (error) {
    // La única restricción única de profesor_materia es la PK compuesta, así
    // que cualquier P2002 de esta transacción es una asociación duplicada.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("MATERIA_YA_ASOCIADA", "Alguna materia ya está asociada al profesor", {
        materias: [],
      });
    }
    throw error;
  }
}

/**
 * Consulta pública para revalidar una asignación
 * dependiente del turno.
 */
export async function profesorActivoDictaMateria(
  profesorId: string,
  materiaId: string,
): Promise<boolean> {
  const profesor = await prisma.profesor.findFirst({
    where: {
      idProfesor: profesorId,
      activoProfesor: true,
      materias: {
        some: {
          materiaId,
        },
      },
    },
    select: {
      idProfesor: true,
    },
  });

  return profesor !== null;}