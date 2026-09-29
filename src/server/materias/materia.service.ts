import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { DetalleMateria } from "@/types/materia.types";
import type { CrearMateriaInput, ListarMateriasQuery, ModificarMateriaInput } from "./materia.schema";

function nombreCompleto(apellido: string, nombre: string): string {
  return `${apellido}, ${nombre}`;
}

const MENSAJES = {
  NOMBRE_DUPLICADO_ACTIVA: "Ya existe una materia registrada con ese nombre",
  NOMBRE_DUPLICADO_INACTIVA: "Ya existe una materia registrada con ese nombre (inactiva)",
  CODIGO_DUPLICADO: "Ya existe una materia registrada con ese código",
  MATERIA_NO_ENCONTRADA: "No se encontró la materia",
  CONFLICTO_EDICION_CONCURRENTE:
    "La materia fue modificada por otro usuario. Recargá para ver los datos actuales.",
} as const;

/**
 * Violación de constraint único (P2002) sobre nombre normalizado o código →
 * mismo `ServiceError` que la validación aplicativa (spec_modulo_L.md §3.2).
 * `null` si el error no es un P2002, para que el llamador lo relance.
 */
function traducirViolacionUnicidad(error: unknown): ServiceError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
  const esNombre = target.some((t) => t.toLowerCase().includes("nombre"));
  return new ServiceError(
    esNombre ? "NOMBRE_DUPLICADO" : "CODIGO_DUPLICADO",
    esNombre ? MENSAJES.NOMBRE_DUPLICADO_ACTIVA : MENSAJES.CODIGO_DUPLICADO,
  );
}

/** Consultas públicas para los flujos que seleccionan una materia. */
export async function listarMateriasActivas() {
  return prisma.materia.findMany({
    where: { activaMateria: true },
    select: { idMateria: true, nombreMateria: true, codigoMateria: true },
    orderBy: [{ nombreMateria: "asc" }, { idMateria: "asc" }],
  });
}

export async function verificarMateriaActiva(id: string, db: Prisma.TransactionClient = prisma) {
  return db.materia.findFirst({
    where: { idMateria: id, activaMateria: true },
    select: { idMateria: true },
  });
}

/**
 * Consulta pública (Regla N.° 3) para HU-J-02: nombre y código de una
 * materia activa, para el encabezado del calendario por materia. `null` si
 * no existe o está inactiva.
 */
export async function obtenerOpcionMateriaActiva(
  id: string,
): Promise<{ id: string; nombre: string; codigo: string | null } | null> {
  const materia = await prisma.materia.findFirst({
    where: { idMateria: id, activaMateria: true },
    select: { idMateria: true, nombreMateria: true, codigoMateria: true },
  });
  return materia ? { id: materia.idMateria, nombre: materia.nombreMateria, codigo: materia.codigoMateria } : null;
}

/**
 * Consulta pública (Regla N.° 3) para HU-D-03: el módulo D la usa para
 * revalidar, dentro de su propia transacción, que las materias a asociar
 * existan y sigan activas. Bloquea las filas con `FOR SHARE` sobre el `tx`
 * del llamador, así `activaMateria` no puede cambiar hasta su commit
 * (Regla N.° 7) — el chequeo "todas activas" sigue valiendo al momento del
 * INSERT. Devuelve solo las que existen; no lanza errores, decidir qué
 * hacer con las faltantes o inactivas es regla de negocio del llamador.
 *
 * `$queryRaw` con template tag: `ids` viaja como parámetro, nunca
 * concatenado en el SQL.
 */
export async function bloquearMateriasParaAsociar(
  ids: string[],
  tx: Prisma.TransactionClient,
): Promise<{ id: string; nombre: string; codigo: string | null; activa: boolean }[]> {
  const filas = await tx.$queryRaw<
    { idMateria: string; nombreMateria: string; codigoMateria: string | null; activaMateria: boolean }[]
  >`
    SELECT "idMateria", "nombreMateria", "codigoMateria", "activaMateria"
    FROM "materias"
    WHERE "idMateria" = ANY(${ids})
    FOR SHARE
  `;

  return filas.map((fila) => ({
    id: fila.idMateria,
    nombre: fila.nombreMateria,
    codigo: fila.codigoMateria,
    activa: fila.activaMateria,
  }));
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
    throw traducirViolacionUnicidad(error) ?? error;
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
export async function obtenerMateriaPorId(id: string): Promise<DetalleMateria> {
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
    throw new ServiceError("MATERIA_NO_ENCONTRADA", MENSAJES.MATERIA_NO_ENCONTRADA);
  }

  return {
    id: materia.idMateria,
    nombre: materia.nombreMateria,
    codigo: materia.codigoMateria,
    is_active: materia.activaMateria,
    created_at: materia.createdAtMateria.toISOString(),
    updated_at: materia.updatedAtMateria.toISOString(),
    version: materia.version,
    profesores: materia.profesores.map(({ profesor }) => ({
      id: profesor.idProfesor,
      nombre_completo: nombreCompleto(profesor.apellidoProfesor, profesor.nombreProfesor),
    })),
  };
}

/**
 * Modificación de materia (spec_modulo_L.md §2.4, HU-L-03), dentro de una
 * única transacción:
 * 1. La materia debe existir (activa o inactiva).
 * 2. Diff contra los valores actuales: solo se escriben los campos que
 *    cambiaron (criterio 3). Sin cambios → no escribe y devuelve
 *    `campos_modificados: []`.
 * 3. Unicidad de nombre normalizado y código contra todas las demás
 *    materias, activas e inactivas, excluyendo la propia (§3.4): un cambio
 *    solo de mayúsculas/acentos del propio nombre no es duplicado.
 * 4. Concurrencia optimista (Regla N.° 7, §3.5): `version` en el `where`
 *    del `updateMany` — `count === 0` es `CONFLICTO_EDICION_CONCURRENTE`.
 * 5. P2002 → mismo 409 que la validación aplicativa (§3.2).
 *
 * Sin evento de dominio: trazabilidad por columnas (Regla N.° 2, opción a).
 */
export async function modificarMateria(
  id: string,
  input: ModificarMateriaInput,
  usuarioId: string,
): Promise<{ id: string; campos_modificados: ("nombre" | "codigo")[]; version: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.materia.findUnique({
        where: { idMateria: id },
        select: { nombreMateria: true, codigoMateria: true, version: true },
      });
      if (!actual) {
        throw new ServiceError("MATERIA_NO_ENCONTRADA", MENSAJES.MATERIA_NO_ENCONTRADA);
      }

      const campos_modificados: ("nombre" | "codigo")[] = [];
      const data: Prisma.MateriaUpdateManyMutationInput = {};

      if (input.nombre !== undefined && input.nombre !== actual.nombreMateria) {
        const nombreNormalizado = normalizarTexto(input.nombre);
        const otra = await tx.materia.findFirst({
          where: { nombreNormalizadaMateria: nombreNormalizado, NOT: { idMateria: id } },
          select: { activaMateria: true },
        });
        if (otra) {
          throw new ServiceError(
            "NOMBRE_DUPLICADO",
            otra.activaMateria ? MENSAJES.NOMBRE_DUPLICADO_ACTIVA : MENSAJES.NOMBRE_DUPLICADO_INACTIVA,
          );
        }
        data.nombreMateria = input.nombre;
        data.nombreNormalizadaMateria = nombreNormalizado;
        campos_modificados.push("nombre");
      }

      if (input.codigo !== undefined && input.codigo !== actual.codigoMateria) {
        if (input.codigo !== null) {
          const otra = await tx.materia.findFirst({
            where: { codigoMateria: input.codigo, NOT: { idMateria: id } },
            select: { idMateria: true },
          });
          if (otra) throw new ServiceError("CODIGO_DUPLICADO", MENSAJES.CODIGO_DUPLICADO);
        }
        data.codigoMateria = input.codigo;
        campos_modificados.push("codigo");
      }

      if (campos_modificados.length === 0) {
        return { id, campos_modificados, version: actual.version };
      }

      const resultado = await tx.materia.updateMany({
        where: { idMateria: id, version: input.version },
        data: {
          ...data,
          version: { increment: 1 },
          updatedAtMateria: new Date(),
          modificadoPorUsuarioId: usuarioId,
        },
      });
      if (resultado.count === 0) {
        throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE", MENSAJES.CONFLICTO_EDICION_CONCURRENTE);
      }

      return { id, campos_modificados, version: input.version + 1 };
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw traducirViolacionUnicidad(error) ?? error;
  }
}
