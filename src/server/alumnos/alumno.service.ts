import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import type { IdentidadAlumnoInput } from "./alumno.schema";

const MENSAJES = {
  DNI_DUPLICADO_ACTIVA: "Ya existe un alumno registrado con ese DNI",
  DNI_DUPLICADO_INACTIVA: "Ya existe un alumno registrado con ese DNI (ficha inactiva)",
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
