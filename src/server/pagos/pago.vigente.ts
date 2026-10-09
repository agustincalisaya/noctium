import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Tx } from "@/server/shared/transaccion";

/**
 * Valor vigente de los pagos (spec_modulo_I.md §2.6.2, Regla N.° 8): la
 * ÚNICA implementación, en TypeScript (`vigenteDeOperacion`) y en SQL
 * (`sql…Vigente`), con una prueba que verifica que coinciden. Los registros
 * originales no se modifican:
 *  - monto vigente: el nuevo de la última CorreccionPago, o `montoPago`;
 *  - forma y fecha vigentes: las de la última CorreccionOperacion que cambió
 *    cada una, o las originales de la operación (iguales a las del pago);
 *  - anulado: existe una AnulacionPago.
 * «Última» = la más reciente por fecha de registro y, de empate, por id.
 */
type Db = Tx | typeof prisma | Prisma.TransactionClient;

export const INCLUDE_OPERACION_VIGENTE = {
  correcciones: { orderBy: [{ createdAtCorreccionOperacion: "desc" }, { idCorreccionOperacion: "desc" }] },
  pagos: {
    orderBy: { idPago: "asc" },
    include: {
      anulacion: true,
      correcciones: { orderBy: [{ createdAtCorreccionPago: "desc" }, { idCorreccionPago: "desc" }] },
    },
  },
} satisfies Prisma.OperacionPagoInclude;

export type OperacionConVigente = Prisma.OperacionPagoGetPayload<{ include: typeof INCLUDE_OPERACION_VIGENTE }>;

export type PagoVigente = {
  pagoId: string;
  turnoId: string;
  inscripcionId: string;
  precio: number;
  montoOriginal: Prisma.Decimal;
  monto: Prisma.Decimal;
  /** true si el monto vigente sale de una corrección. */
  corregido: boolean;
  motivoAjuste: string | null;
  ajustadoPorUsuarioId: string | null;
  registradoEn: Date;
  anulado: boolean;
  anulacion: { fecha: Date; motivo: string } | null;
  /** Correcciones de monto del pago, correcciones de la operación y anulación. */
  cambios: number;
};

export type OperacionVigente = {
  operacionId: string;
  alumnoId: string;
  cajaId: string;
  registradaPorUsuarioId: string;
  registradaEl: Date;
  formaPagoId: string;
  formaPagoOriginalId: string;
  fechaPago: Date;
  pagos: PagoVigente[];
};

/** Valor vigente de una operación ya leída con `INCLUDE_OPERACION_VIGENTE`. */
export function vigenteDeOperacion(operacion: OperacionConVigente): OperacionVigente {
  const ultimaForma = operacion.correcciones.find((c) => c.formaPagoNuevaId !== null);
  const ultimaFecha = operacion.correcciones.find((c) => c.fechaPagoNueva !== null);
  return {
    operacionId: operacion.idOperacionPago,
    alumnoId: operacion.alumnoId,
    cajaId: operacion.cajaId,
    registradaPorUsuarioId: operacion.creadoPorUsuarioId,
    registradaEl: operacion.registradaEl,
    formaPagoId: ultimaForma?.formaPagoNuevaId ?? operacion.formaPagoId,
    formaPagoOriginalId: operacion.formaPagoId,
    fechaPago: ultimaFecha?.fechaPagoNueva ?? operacion.fechaPago,
    pagos: operacion.pagos.map((pago) => ({
      pagoId: pago.idPago,
      turnoId: pago.turnoId,
      inscripcionId: pago.inscripcionId,
      precio: pago.precio,
      montoOriginal: pago.montoPago,
      monto: pago.correcciones[0]?.montoNuevo ?? pago.montoPago,
      corregido: pago.correcciones.length > 0,
      motivoAjuste: pago.motivoAjuste,
      ajustadoPorUsuarioId: pago.ajustadoPorUsuarioId,
      registradoEn: pago.createdAtPago,
      anulado: pago.anulacion !== null,
      anulacion: pago.anulacion ? { fecha: pago.anulacion.createdAtAnulacionPago, motivo: pago.anulacion.motivo } : null,
      cambios: pago.correcciones.length + operacion.correcciones.length + (pago.anulacion ? 1 : 0),
    })),
  };
}

export async function operacionVigente(db: Db, operacionId: string): Promise<OperacionVigente | null> {
  const operacion = await db.operacionPago.findUnique({ where: { idOperacionPago: operacionId }, include: INCLUDE_OPERACION_VIGENTE });
  return operacion ? vigenteDeOperacion(operacion) : null;
}

/** Pagos no anulados de una inscripción: el conteo que reciben `marcarPagada` y `recalcularEstadoPago` (R3-PR0-I3). */
export async function contarPagosNoAnulados(db: Db, inscripcionId: string): Promise<number> {
  return db.pago.count({ where: { inscripcionId, anulacion: { is: null } } });
}

// --- Fragmentos SQL equivalentes, sobre la fila `alias` de "pagos" ---

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;
function alias(nombre: string): Prisma.Sql {
  if (!ALIAS.test(nombre)) throw new Error(`alias inválido "${nombre}"`);
  return Prisma.raw(`"${nombre}"`);
}

export function sqlMontoVigente(pago: string): Prisma.Sql {
  const p = alias(pago);
  return Prisma.sql`COALESCE((SELECT vcp."montoNuevo" FROM "correcciones_pago" vcp WHERE vcp."pagoId" = ${p}."idPago"
    ORDER BY vcp."createdAtCorreccionPago" DESC, vcp."idCorreccionPago" DESC LIMIT 1), ${p}."montoPago")`;
}

export function sqlFechaPagoVigente(pago: string): Prisma.Sql {
  const p = alias(pago);
  return Prisma.sql`COALESCE((SELECT vco."fechaPagoNueva" FROM "correcciones_operacion" vco
    WHERE vco."operacionId" = ${p}."operacionId" AND vco."fechaPagoNueva" IS NOT NULL
    ORDER BY vco."createdAtCorreccionOperacion" DESC, vco."idCorreccionOperacion" DESC LIMIT 1), ${p}."fechaPago")`;
}

export function sqlFormaPagoVigente(pago: string): Prisma.Sql {
  const p = alias(pago);
  return Prisma.sql`COALESCE((SELECT vco."formaPagoNuevaId" FROM "correcciones_operacion" vco
    WHERE vco."operacionId" = ${p}."operacionId" AND vco."formaPagoNuevaId" IS NOT NULL
    ORDER BY vco."createdAtCorreccionOperacion" DESC, vco."idCorreccionOperacion" DESC LIMIT 1), ${p}."formaPagoId")`;
}

export function sqlPagoNoAnulado(pago: string): Prisma.Sql {
  const p = alias(pago);
  return Prisma.sql`NOT EXISTS (SELECT 1 FROM "anulaciones_pago" vap WHERE vap."pagoId" = ${p}."idPago")`;
}
