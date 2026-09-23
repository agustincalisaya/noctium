import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { CrearAulaInput } from "./aula.schema";

const MENSAJES = {
  NOMBRE_DUPLICADO: "Ya existe un aula registrada con ese nombre",
} as const;

/**
 * Alta de aula (spec_modulo_K.md §2.1). Orden no negociable, dentro de una
 * única transacción: normalizar → verificar unicidad contra el universo
 * completo (activas e inactivas) → insertar. La verificación aplicativa no
 * es la garantía final contra condiciones de carrera (Regla N.° 7 de
 * docs/RULES.md) — el constraint único de la base lo es; el catch de P2002
 * de abajo es esa defensa, no un caso opcional. No toca ninguna tabla
 * relacionada a Turno (regla de negocio 3.3 de la spec): el alta no reserva
 * el recurso.
 */
export async function crearAula(input: CrearAulaInput, usuarioId: string) {
  const nombreNormalizado = normalizarTexto(input.nombre);

  try {
    return await prisma.$transaction(async (tx) => {
      const aulaExistente = await tx.aula.findFirst({
        where: { nombreNormalizadaAula: nombreNormalizado },
      });
      if (aulaExistente) {
        throw new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);
      }

      return tx.aula.create({
        data: {
          nombreAula: input.nombre,
          nombreNormalizadaAula: nombreNormalizado,
          capacidadAula: input.capacidad,
          creadoPorUsuarioId: usuarioId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);
    }

    throw error;
  }
}
