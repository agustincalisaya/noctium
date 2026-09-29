import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { ListadoFormasPago } from "@/types/pago.types";
import type { CrearFormaPagoInput, ListarFormasPagoQuery } from "./forma-pago.schema";

const MENSAJES = {
  NOMBRE_DUPLICADO: "Ya existe una forma de pago con ese nombre.",
} as const;

/**
 * Violación de constraint único (P2002) sobre el nombre o el nombre
 * normalizado → mismo `ServiceError` que la validación aplicativa
 * (spec_modulo_I.md §2.1). `null` si no es un P2002, para que el llamador
 * relance el error original.
 */
function traducirViolacionUnicidad(error: unknown): ServiceError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  return new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);
}

/**
 * Alta de forma de pago (spec_modulo_I.md §2.1). Normaliza, verifica que no
 * exista otra (activa o inactiva) con el mismo nombre normalizado e inserta
 * activa. La verificación previa solo mejora el mensaje: no cierra la
 * carrera entre dos altas simultáneas. La garantía es el índice único de la
 * base y la traducción de `P2002` de abajo (Regla N.° 7).
 */
export async function crearFormaPago(input: CrearFormaPagoInput, usuarioId: string) {
  const nombreNormalizado = normalizarTexto(input.nombre);

  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.formaPago.findFirst({
        where: { nombreNormalizadaFormaPago: nombreNormalizado },
        select: { idFormaPago: true },
      });
      if (existente) throw new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);

      return tx.formaPago.create({
        data: {
          nombreFormaPago: input.nombre,
          nombreNormalizadaFormaPago: nombreNormalizado,
          activaFormaPago: true,
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
 * Listado de gestión (spec_modulo_I.md §2.2): activas e inactivas, orden
 * alfabético por nombre normalizado, con el mismo cálculo de página que
 * Materias (página fuera de rango se acota; sin filas, `total_paginas` es 0).
 */
export async function listarFormasPago(query: ListarFormasPagoQuery): Promise<ListadoFormasPago> {
  const { pagina, por_pagina: porPagina } = query;

  const total = await prisma.formaPago.count();
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));

  const formas = await prisma.formaPago.findMany({
    orderBy: { nombreNormalizadaFormaPago: "asc" },
    skip: (paginaActual - 1) * porPagina,
    take: porPagina,
    select: { idFormaPago: true, nombreFormaPago: true, activaFormaPago: true },
  });

  return {
    items: formas.map((forma) => ({
      id: forma.idFormaPago,
      nombre: forma.nombreFormaPago,
      is_active: forma.activaFormaPago,
    })),
    paginacion: {
      total,
      pagina_actual: paginaActual,
      total_paginas: Math.ceil(total / porPagina),
      por_pagina: porPagina,
    },
  };
}
