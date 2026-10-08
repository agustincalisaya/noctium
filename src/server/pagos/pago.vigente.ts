import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Tx } from "@/server/shared/transaccion";

/**
 * Valor vigente de los pagos (spec_modulo_I.md §2.6.2, Regla N.° 8): una
 * sola implementación. Los registros originales no se modifican:
 *  - monto vigente: el nuevo de la última CorreccionPago, o `montoPago`;
 *  - forma y fecha vigentes: las de la última CorreccionOperacion que cambió
 *    cada una, o las originales de la operación;
 *  - anulado: existe una AnulacionPago.
 * Lo usan la emisión de comprobantes y, en la etapa 2, las lecturas públicas.
 */
type Db = Tx | typeof prisma;

export type PagoVigente = {
  pagoId: string;
  turnoId: string;
  inscripcionId: string;
  precio: number;
  montoOriginal: Prisma.Decimal;
  monto: Prisma.Decimal;
  anulado: boolean;
};

export type OperacionVigente = {
  operacionId: string;
  alumnoId: string;
  cajaId: string;
  registradaPorUsuarioId: string;
  registradaEl: Date;
  formaPagoId: string;
  fechaPago: Date;
  pagos: PagoVigente[];
};

const MAS_NUEVO_PRIMERO = <T extends string>(campo: T) => [{ [campo]: "desc" }] as const;

export async function operacionVigente(db: Db, operacionId: string): Promise<OperacionVigente | null> {
  const operacion = await db.operacionPago.findUnique({
    where: { idOperacionPago: operacionId },
    include: {
      correcciones: { orderBy: [...MAS_NUEVO_PRIMERO("createdAtCorreccionOperacion"), { idCorreccionOperacion: "desc" }] },
      pagos: {
        orderBy: { idPago: "asc" },
        include: {
          anulacion: { select: { idAnulacionPago: true } },
          correcciones: {
            orderBy: [...MAS_NUEVO_PRIMERO("createdAtCorreccionPago"), { idCorreccionPago: "desc" }],
            take: 1,
            select: { montoNuevo: true },
          },
        },
      },
    },
  });
  if (!operacion) return null;
  const ultimaForma = operacion.correcciones.find((c) => c.formaPagoNuevaId !== null);
  const ultimaFecha = operacion.correcciones.find((c) => c.fechaPagoNueva !== null);
  return {
    operacionId: operacion.idOperacionPago,
    alumnoId: operacion.alumnoId,
    cajaId: operacion.cajaId,
    registradaPorUsuarioId: operacion.creadoPorUsuarioId,
    registradaEl: operacion.registradaEl,
    formaPagoId: ultimaForma?.formaPagoNuevaId ?? operacion.formaPagoId,
    fechaPago: ultimaFecha?.fechaPagoNueva ?? operacion.fechaPago,
    pagos: operacion.pagos.map((pago) => ({
      pagoId: pago.idPago,
      turnoId: pago.turnoId,
      inscripcionId: pago.inscripcionId,
      precio: pago.precio,
      montoOriginal: pago.montoPago,
      monto: pago.correcciones[0]?.montoNuevo ?? pago.montoPago,
      anulado: pago.anulacion !== null,
    })),
  };
}

/** Pagos no anulados de una inscripción: el conteo que reciben `marcarPagada` y `recalcularEstadoPago` (R3-PR0-I3). */
export async function contarPagosNoAnulados(db: Db, inscripcionId: string): Promise<number> {
  return db.pago.count({ where: { inscripcionId, anulacion: { is: null } } });
}
