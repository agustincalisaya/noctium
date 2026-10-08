import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bloquearIntegranteActivo } from "@/server/personal/personal.publico";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";

/**
 * Caja de mesa de entrada (PR-0.md §2.5 y §2.13, spec_modulo_I.md §2.10).
 * Esta parte trae `abrirCaja` y `cajaAbiertaDe`; movimientos, ajustes,
 * declaración, resumen y cierre llegan en la parte 3 de la etapa 2.
 */

const MONTO_NO_NEGATIVO = /^\d{1,9}(\.\d{1,2})?$/;

export type CajaAbierta = { id: string; abiertaEl: Date };

/**
 * La caja ABIERTA del usuario, o `null`. Solo lectura y sin bloqueo (el que
 * decide la bloquea con `bloquear`, nivel caja). La usan el cobro, la caja
 * propia y la baja del integrante (HU-F-05).
 */
export async function cajaAbiertaDe(db: Tx | typeof prisma, usuarioId: string): Promise<CajaAbierta | null> {
  const caja = await db.caja.findFirst({
    where: { usuarioId, estado: "ABIERTA" },
    select: { idCaja: true, abiertaEl: true },
  });
  return caja ? { id: caja.idCaja, abiertaEl: caja.abiertaEl } : null;
}

/**
 * Abre la caja del integrante (spec_modulo_I.md §2.10.1): exige su ficha de
 * mesa de entrada activa (bloqueada) e inserta la caja ABIERTA con
 * `abiertaEl = ahora()`. La garantía de «una sola caja abierta» es el índice
 * único parcial `cajas_abierta_por_integrante_key`: dos aperturas simultáneas
 * dejan una sola y la otra recibe CAJA_YA_ABIERTA (Regla N.° 7).
 * `fondoInicial`: texto con hasta 2 decimales, puede ser 0 (lo valida Zod en la ruta).
 */
export async function abrirCaja(
  tx: Tx,
  datos: { usuarioId: string; fondoInicial: string },
): Promise<{ id: string; abiertaEl: Date; fondoInicial: string }> {
  if (!MONTO_NO_NEGATIVO.test(datos.fondoInicial)) {
    throw new RangeError("abrirCaja: el fondo inicial tiene que ser un monto mayor o igual a 0 con hasta 2 decimales");
  }
  await bloquearIntegranteActivo(tx, datos.usuarioId);
  try {
    const caja = await tx.caja.create({
      data: { usuarioId: datos.usuarioId, abiertaEl: ahora(), fondoInicial: new Prisma.Decimal(datos.fondoInicial) },
    });
    return { id: caja.idCaja, abiertaEl: caja.abiertaEl, fondoInicial: caja.fondoInicial.toFixed(2) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorDeDominio("errores.caja.yaAbierta");
    }
    throw error;
  }
}
