import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { CrearMateriaInput, ListarMateriasQuery } from "./materia.schema";

function nombreCompleto(apellido: string, nombre: string): string {
  return `${apellido}, ${nombre}`;
}

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

/**
 * Listado de materias (spec_modulo_L.md §2.2). Sin filtro `is_active` —
 * incluye activas e inactivas a propósito, ya que el criterio de
 * aceptación exige mostrar la columna Estado para ambas. `profesores_count`
 * vía `_count` directo sobre la relación `profesores` (ProfesorMateria):
 * excepción documentada a la Regla N.° 3 de docs/RULES.md (ver nota de
 * sincronización en spec_modulo_L.md §2.2) — es una relación declarada en
 * el propio modelo `Materia`, no una consulta cruda a una tabla interna
 * ajena a este dominio.
 */
export async function listarMaterias(query: ListarMateriasQuery) {
  const { pagina, por_pagina: porPagina } = query;

  const total = await prisma.materia.count();
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));

  const materias = await prisma.materia.findMany({
    orderBy: { nombreNormalizadaMateria: "asc" },
    skip: (paginaActual - 1) * porPagina,
    take: porPagina,
    include: { _count: { select: { profesores: true } } },
  });

  return {
    items: materias.map((materia) => ({
      id: materia.idMateria,
      nombre: materia.nombreMateria,
      codigo: materia.codigoMateria,
      profesores_count: materia._count.profesores,
      is_active: materia.activaMateria,
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
 * Detalle de materia (spec_modulo_L.md §2.2). Sin filtro `is_active` — una
 * materia inactiva sigue siendo consultable en detalle, no es un 404 solo
 * por estar de baja.
 */
export async function obtenerMateriaPorId(id: string) {
  const materia = await prisma.materia.findUnique({
    where: { idMateria: id },
    include: {
      profesores: {
        include: {
          profesor: { select: { idProfesor: true, apellidoProfesor: true, nombreProfesor: true } },
        },
      },
    },
  });

  if (!materia) {
    throw new ServiceError("MATERIA_NO_ENCONTRADA", "No se encontró la materia");
  }

  return {
    id: materia.idMateria,
    nombre: materia.nombreMateria,
    codigo: materia.codigoMateria,
    is_active: materia.activaMateria,
    created_at: materia.createdAtMateria.toISOString(),
    profesores: materia.profesores.map(({ profesor }) => ({
      id: profesor.idProfesor,
      nombre_completo: nombreCompleto(profesor.apellidoProfesor, profesor.nombreProfesor),
    })),
  };
}
