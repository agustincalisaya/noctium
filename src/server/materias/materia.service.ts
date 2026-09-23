import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { CrearMateriaInput } from "./materia.schema";

const MENSAJES = {
  NOMBRE_DUPLICADO_ACTIVA: "Ya existe una materia registrada con ese nombre",
  NOMBRE_DUPLICADO_INACTIVA: "Ya existe una materia registrada con ese nombre (inactiva)",
  CODIGO_DUPLICADO: "Ya existe una materia registrada con ese código",
} as const;

/** Consultas públicas para los flujos que seleccionan una materia. */
export async function listarMateriasActivas() {
  return prisma.materia.findMany({
    where: { activaMateria: true },
    select: { idMateria: true, nombreMateria: true, codigoMateria: true },
    orderBy: [{ nombreMateria: "asc" }, { idMateria: "asc" }],
  });
}

export async function verificarMateriaActiva(id: string) {
  return prisma.materia.findFirst({
    where: { idMateria: id, activaMateria: true },
    select: { idMateria: true },
  });
}

/**
 * Alta de materia (spec_modulo_L.md §2.1). Orden no negociable, dentro de
 * una única transacción: normalizar → verificar unicidad de nombre →
 * verificar unicidad de código → insertar. La verificación aplicativa no es
 * la garantía final contra condiciones de carrera (Regla N.° 7 de
 * docs/RULES.md) — el constraint único de la base lo es; el catch de P2002
 * de abajo es esa defensa, no un caso opcional.
 */
export async function crearMateria(input: CrearMateriaInput, usuarioId: string) {
  const nombreNormalizado = normalizarTexto(input.nombre);

  try {
    return await prisma.$transaction(async (tx) => {
      const nombreExistente = await tx.materia.findFirst({
        where: { nombreNormalizadaMateria: nombreNormalizado },
      });
      if (nombreExistente) {
        throw new ServiceError(
          "NOMBRE_DUPLICADO",
          nombreExistente.activaMateria
            ? MENSAJES.NOMBRE_DUPLICADO_ACTIVA
            : MENSAJES.NOMBRE_DUPLICADO_INACTIVA,
        );
      }

      if (input.codigo) {
        const codigoExistente = await tx.materia.findFirst({
          where: { codigoMateria: input.codigo },
        });
        if (codigoExistente) {
          throw new ServiceError("CODIGO_DUPLICADO", MENSAJES.CODIGO_DUPLICADO);
        }
      }

      return tx.materia.create({
        data: {
          nombreMateria: input.nombre,
          nombreNormalizadaMateria: nombreNormalizado,
          codigoMateria: input.codigo ?? null,
          creadoPorUsuarioId: usuarioId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
      const esNombre = target.some((t) => t.toLowerCase().includes("nombre"));
      throw new ServiceError(
        esNombre ? "NOMBRE_DUPLICADO" : "CODIGO_DUPLICADO",
        esNombre ? MENSAJES.NOMBRE_DUPLICADO_ACTIVA : MENSAJES.CODIGO_DUPLICADO,
      );
    }

    throw error;
  }
}
