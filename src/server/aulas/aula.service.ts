import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { CrearAulaInput, ListarAulasQuery } from "./aula.schema";

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

/**
 * Listado de aulas (spec_modulo_K.md §2.2). Sin filtro `is_active` — incluye
 * activas e inactivas a propósito, igual que Materias. `orderBy: { nombreAula:
 * "asc" }` es el único `orderBy` posible: el orden natural ("Aula 2" antes
 * que "Aula 10") lo garantiza la collation `natural_es` aplicada a la
 * columna en la migración de esta HU — reimplementarlo acá en JS o con SQL
 * ad-hoc está explícitamente prohibido por la regla de negocio 3.2 de la
 * spec.
 */
export async function listarAulas(query: ListarAulasQuery) {
  const { pagina, por_pagina: porPagina } = query;

  const total = await prisma.aula.count();
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));

  const aulas = await prisma.aula.findMany({
    orderBy: { nombreAula: "asc" },
    skip: (paginaActual - 1) * porPagina,
    take: porPagina,
  });

  return {
    items: aulas.map((aula) => ({
      id: aula.idAula,
      nombre: aula.nombreAula,
      capacidad: aula.capacidadAula,
      is_active: aula.activaAula,
    })),
    paginacion: {
      total,
      pagina_actual: paginaActual,
      total_paginas: Math.ceil(total / porPagina),
      por_pagina: porPagina,
    },
  };
}

/**
 * Detalle de aula (spec_modulo_K.md §2.2). Sin filtro `is_active` — un aula
 * inactiva sigue siendo consultable en detalle, no es un 404 solo por estar
 * de baja.
 */
export async function obtenerAulaPorId(id: string) {
  const aula = await prisma.aula.findUnique({ where: { idAula: id } });

  if (!aula) {
    throw new ServiceError("AULA_NO_ENCONTRADA", "No se encontró el aula");
  }

  return {
    id: aula.idAula,
    nombre: aula.nombreAula,
    capacidad: aula.capacidadAula,
    is_active: aula.activaAula,
    created_at: aula.createdAtAula.toISOString(),
  };
}
