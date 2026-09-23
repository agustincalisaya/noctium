import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import type { FichaAlumno } from "@/types/alumno.types";
import type { ContactoAlumnoInput, IdentidadAlumnoInput } from "./alumno.schema";

const MENSAJES = {
  DNI_DUPLICADO_ACTIVA: "Ya existe un alumno registrado con ese DNI",
  DNI_DUPLICADO_INACTIVA: "Ya existe un alumno registrado con ese DNI (ficha inactiva)",
  EMAIL_YA_ASOCIADO: "Ese email ya está asociado a una cuenta existente",
  ALUMNO_NO_ENCONTRADO: "El alumno ya no existe",
} as const;

/**
 * Alta de identidad del alumno (spec_modulo_B.md §2.1). La verificación de
 * unicidad de `dniAlumno` y el `INSERT` ocurren dentro de la misma
 * transacción, uno inmediatamente después del otro — es la "revalidación
 * inmediatamente antes del INSERT" que pide la spec, no una segunda
 * consulta redundante. La garantía real contra una alta duplicada
 * simultánea (Regla N.° 7 de docs/RULES.md) es el constraint único de la
 * base: el catch de `P2002` de abajo no es un caso opcional.
 *
 * Trazabilidad (Regla N.° 2, patrón a): columnas de auditoría en la propia
 * fila (`createdAtAlumno`, `creadoPorUsuarioId`) — no aplica tabla de
 * eventos separada, esto es una mutación única sobre la entidad, no un
 * evento discreto repetible.
 */
export async function crearAlumno(input: IdentidadAlumnoInput, usuarioId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.alumno.findFirst({
        where: { dniAlumno: input.dni },
      });
      if (existente) {
        throw new ServiceError(
          "DNI_DUPLICADO",
          existente.activoAlumno ? MENSAJES.DNI_DUPLICADO_ACTIVA : MENSAJES.DNI_DUPLICADO_INACTIVA,
        );
      }

      return tx.alumno.create({
        data: {
          nombreAlumno: input.nombre,
          apellidoAlumno: input.apellido,
          dniAlumno: input.dni,
          fechaNacimientoAlumno: input.fecha_nacimiento,
          generoAlumno: input.genero ?? null,
          activoAlumno: true,
          creadoPorUsuarioId: usuarioId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("DNI_DUPLICADO", MENSAJES.DNI_DUPLICADO_ACTIVA);
    }

    throw error;
  }
}

/**
 * Ficha del alumno (HU-B-02: identidad resumida + contacto actual, para la
 * ficha y para precargar el formulario de contacto). `null` si el id no
 * existe. Mismo patrón que `obtenerFichaProfesor()` de HU-D-02.
 */
export async function obtenerFichaAlumno(alumnoId: string): Promise<FichaAlumno | null> {
  const alumno = await prisma.alumno.findUnique({
    where: { idAlumno: alumnoId },
    select: {
      idAlumno: true,
      nombreAlumno: true,
      apellidoAlumno: true,
      dniAlumno: true,
      activoAlumno: true,
      telefonoAlumno: true,
      emailAlumno: true,
    },
  });
  if (!alumno) return null;

  return {
    id: alumno.idAlumno,
    nombre: alumno.nombreAlumno,
    apellido: alumno.apellidoAlumno,
    dni: alumno.dniAlumno,
    activo: alumno.activoAlumno,
    telefono: alumno.telefonoAlumno,
    email: alumno.emailAlumno,
  };
}

/**
 * Registro/actualización del contacto del alumno (HU-B-02,
 * `spec_modulo_B.md` §2.2). `input` ya llegó validado y normalizado por
 * `ContactoAlumnoSchema` en la capa delgada; `usuarioModificadorId` es el id
 * de la sesión ya autorizada con `alumnos:editar` (este servicio no chequea
 * permisos, mismo criterio que `crearAlumno()` de arriba).
 *
 * Actualiza únicamente los campos provistos (`spec_modulo_B.md` §2.2, punto
 * 3, textual) — `camposProvistos` distingue "el campo no vino en el
 * payload" (no se toca la columna) de "el campo vino vacío" (el schema
 * compartido `ContactoSchema` colapsa un string vacío a `undefined`, pero
 * eso significa "el usuario lo vació a propósito": se persiste como
 * `null`). Zod solo no alcanza para esa distinción porque ambos casos
 * llegan igual de `ContactoAlumnoInput` — por eso `camposProvistos` se
 * calcula en la capa delgada (Server Action / Route Handler) mirando la
 * presencia de la clave en el `FormData`/body crudo, antes de parsear, y se
 * pasa explícitamente acá.
 *
 * Corrección post-implementación (ver sección 8 de
 * `docs/tasks/Sprint 1/HU-B-02.md`): la versión original escribía ambos
 * campos siempre (`input.telefono ?? null`), asumiendo que "no provisto" y
 * "provisto vacío" eran equivalentes — cierto para el formulario real (los
 * dos `<input>` siempre están presentes en el `FormData`) pero falso para
 * cualquier otro consumidor de la API que omita una clave, violando el
 * contrato literal de la spec.
 *
 * Todo corre en una única `$transaction`: la verificación de email contra
 * cuentas existentes y el `UPDATE` se confirman juntos, sin guardado
 * parcial (criterios 5 y 6 de la HU).
 *
 * Verificación de email (`tx.usuario.findFirst` sobre `Usuario`, tabla de
 * Módulo A) — mismo patrón que `actualizarContactoProfesor()` de HU-D-02.
 * Documentado en `docs/tasks/Sprint 1/HU-B-02.md` §0 como deuda técnica /
 * posible tensión con la Regla N.° 3 de `docs/RULES.md` (aislamiento de
 * dominio), a resolver por el equipo de forma centralizada — no es un fix
 * unilateral de esta task.
 */
export async function actualizarContactoAlumno(
  alumnoId: string,
  input: ContactoAlumnoInput,
  camposProvistos: { telefono: boolean; email: boolean },
  usuarioModificadorId: string,
): Promise<{ id: string; telefono: string | null; email: string | null }> {
  return prisma.$transaction(async (tx) => {
    const alumno = await tx.alumno.findUnique({
      where: { idAlumno: alumnoId },
      select: { idAlumno: true, usuarioId: true },
    });
    if (!alumno) {
      throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);
    }

    if (input.email) {
      // Criterio 4 de la HU: el email no puede pertenecer a OTRA cuenta. La
      // cuenta propia del alumno (si tiene) queda excluida; sin cuenta
      // vinculada, cualquier coincidencia bloquea. Comparación
      // case-insensitive porque emailUsuario no garantiza estar guardado en
      // minúsculas.
      const otraCuenta = await tx.usuario.findFirst({
        where: {
          emailUsuario: { equals: input.email, mode: "insensitive" },
          ...(alumno.usuarioId ? { NOT: { idUsuario: alumno.usuarioId } } : {}),
        },
        select: { idUsuario: true },
      });
      if (otraCuenta) {
        throw new ServiceError("EMAIL_YA_ASOCIADO", MENSAJES.EMAIL_YA_ASOCIADO);
      }
    }

    const actualizado = await tx.alumno.update({
      where: { idAlumno: alumnoId },
      data: {
        ...(camposProvistos.telefono ? { telefonoAlumno: input.telefono ?? null } : {}),
        ...(camposProvistos.email ? { emailAlumno: input.email ?? null } : {}),
        modificadoPorUsuarioId: usuarioModificadorId,
        // updatedAtAlumno lo actualiza Prisma (@updatedAt).
      },
      select: { idAlumno: true, telefonoAlumno: true, emailAlumno: true },
    });

    return {
      id: actualizado.idAlumno,
      telefono: actualizado.telefonoAlumno,
      email: actualizado.emailAlumno,
    };
  });
}
