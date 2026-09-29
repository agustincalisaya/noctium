import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import { ajustarCuposPorCapacidadDeAula, type EventoTurno } from "@/server/turnos/turno.publico";
import type { DetalleAula } from "@/types/aula.types";
import type { CrearAulaInput, ListarAulasQuery, ModificarAulaInput } from "./aula.schema";

const MENSAJES = {
  NOMBRE_DUPLICADO: "Ya existe un aula registrada con ese nombre",
  AULA_NO_ENCONTRADA: "No se encontró el aula",
  CONFLICTO_EDICION_CONCURRENTE: "El aula fue modificada por otro usuario. Recargá para ver los datos actuales.",
  CAPACIDAD_MENOR_A_INSCRIPTOS:
    "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula",
} as const;

/** P2002 sobre `nombreAula` o `nombreNormalizadaAula` (los dos únicos de Aula). */
function traducirViolacionUnicidad(error: unknown): ServiceError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  return new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);
}


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
    throw traducirViolacionUnicidad(error) ?? error;
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
export async function obtenerAulaPorId(id: string): Promise<DetalleAula> {
  const aula = await prisma.aula.findUnique({ where: { idAula: id } });

  if (!aula) {
    throw new ServiceError("AULA_NO_ENCONTRADA", MENSAJES.AULA_NO_ENCONTRADA);
  }

  return {
    id: aula.idAula,
    nombre: aula.nombreAula,
    capacidad: aula.capacidadAula,
    is_active: aula.activaAula,
    created_at: aula.createdAtAula.toISOString(),
    // HU-K-03: `version` la reenvía el formulario de edición (spec §2.2).
    updated_at: aula.updatedAtAula.toISOString(),
    version: aula.version,
  };
}

type ResultadoModificacion = {
  id: string;
  campos_modificados: ("nombre" | "capacidad")[];
  version: number;
  turnos_actualizados: number;
};

/**
 * Modificación de aula (spec_modulo_K.md §2.4, HU-K-03). Todo dentro de una
 * única transacción: si falla cualquier paso (duplicado, versión vieja,
 * capacidad menor a inscriptos) no se guarda nada, ni el aula ni los cupos.
 *
 * El impacto sobre turnos es del módulo C (regla 3.4, Regla N.° 3): este
 * servicio nunca lee ni escribe `turnos` ni `eventos_turno`; delega la
 * validación y el ajuste de cupos en `ajustarCuposPorCapacidadDeAula()`
 * sobre el mismo `tx`, y los eventos que esa función devuelve se emiten
 * recién después del COMMIT (§2.4 paso 6, Regla N.° 2 opción b). Un aula
 * inactiva también es editable (§2.4 paso 1 solo exige que exista).
 */
export async function modificarAula(
  id: string,
  input: ModificarAulaInput,
  usuarioId: string,
): Promise<ResultadoModificacion> {
  let transaccion: { resultado: ResultadoModificacion; eventos: EventoTurno[] };
  try {
    transaccion = await prisma.$transaction(async (tx) => {
      const actual = await tx.aula.findUnique({
        where: { idAula: id },
        select: { nombreAula: true, capacidadAula: true, version: true },
      });
      if (!actual) {
        throw new ServiceError("AULA_NO_ENCONTRADA", MENSAJES.AULA_NO_ENCONTRADA);
      }

      const campos_modificados: ResultadoModificacion["campos_modificados"] = [];
      const data: Prisma.AulaUpdateManyMutationInput = {};

      if (input.nombre !== undefined && input.nombre !== actual.nombreAula) {
        const nombreNormalizado = normalizarTexto(input.nombre);
        const otra = await tx.aula.findFirst({
          where: { nombreNormalizadaAula: nombreNormalizado, NOT: { idAula: id } },
          select: { idAula: true },
        });
        if (otra) throw new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);
        data.nombreAula = input.nombre;
        data.nombreNormalizadaAula = nombreNormalizado;
        campos_modificados.push("nombre");
      }

      const nuevaCapacidad =
        input.capacidad !== undefined && input.capacidad !== actual.capacidadAula ? input.capacidad : null;
      if (nuevaCapacidad !== null) {
        data.capacidadAula = nuevaCapacidad;
        campos_modificados.push("capacidad");
      }

      if (campos_modificados.length === 0) {
        return {
          resultado: { id, campos_modificados, version: actual.version, turnos_actualizados: 0 },
          eventos: [],
        };
      }

      // Condición y mutación en una sola sentencia (Regla N.° 7). Va antes
      // del ajuste: con la versión vieja no se llega a bloquear turnos.
      const actualizada = await tx.aula.updateMany({
        where: { idAula: id, version: input.version },
        data: {
          ...data,
          version: { increment: 1 },
          updatedAtAula: new Date(),
          modificadoPorUsuarioId: usuarioId,
        },
      });
      if (actualizada.count === 0) {
        throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE", MENSAJES.CONFLICTO_EDICION_CONCURRENTE);
      }

      let turnos_actualizados = 0;
      let eventos: EventoTurno[] = [];
      if (nuevaCapacidad !== null) {
        const ajuste = await ajustarCuposPorCapacidadDeAula(id, nuevaCapacidad, usuarioId, tx);
        if (!ajuste.ok) {
          // Lanzar dentro del callback revierte también el UPDATE del aula.
          throw new ServiceError("CAPACIDAD_MENOR_A_INSCRIPTOS", MENSAJES.CAPACIDAD_MENOR_A_INSCRIPTOS, {
            turnos_en_conflicto: ajuste.turnos_en_conflicto,
            max_inscriptos: ajuste.max_inscriptos,
          });
        }
        turnos_actualizados = ajuste.turnos_actualizados;
        eventos = ajuste.eventos;
      }

      return {
        resultado: { id, campos_modificados, version: input.version + 1, turnos_actualizados },
        eventos,
      };
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw traducirViolacionUnicidad(error) ?? error;
  }

  // Después del COMMIT: si la transacción lanzó, no se llega acá.
  if (transaccion.eventos.length > 0) {
    // TODO HU-K-03: esperar emitirEventosTurno (Tomás)
    // await emitirEventosTurno(transaccion.eventos);
  }

  return transaccion.resultado;
}
