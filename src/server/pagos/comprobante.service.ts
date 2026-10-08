import { Prisma } from "@prisma/client";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { obtenerFormaPago } from "@/server/pagos/forma-pago.publico";
import { ComprobanteDatosSchema, formatearNumeroComprobante, type ComprobanteDatos } from "@/server/pagos/comprobante.schema";
import { operacionVigente } from "@/server/pagos/pago.vigente";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { datosCentro } from "@/server/shared/parametros-vigentes";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";
import { obtenerClasesBasicas } from "@/server/turnos/inscripcion.publico";

/**
 * Emisión de comprobantes (PR-0.md §2.3 y §2.13, spec_modulo_I.md §2.9.1).
 * Es el ÚNICO camino que emite comprobantes; corre dentro de la transacción
 * del cobro, de la corrección o de la anulación, que ya bloqueó la operación.
 */

export type ComprobanteEmitido = { id: string; numero: number; numeroVisible: string; datos: ComprobanteDatos };

export class ComprobanteError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ComprobanteError";
  }
}

/** Copia fija de la operación con sus valores vigentes y solo los pagos no anulados. */
async function armarDatos(tx: Tx, operacionId: string): Promise<ComprobanteDatos> {
  const operacion = await operacionVigente(tx, operacionId);
  if (!operacion) throw new ComprobanteError(`No existe la operación ${operacionId}`);
  const pagos = operacion.pagos.filter((pago) => !pago.anulado);
  if (pagos.length === 0) throw new ComprobanteError(`La operación ${operacionId} no tiene pagos vigentes`);

  const [centro, [alumno], forma, [registrador], clases] = await Promise.all([
    datosCentro(tx),
    obtenerAlumnosBasicos([operacion.alumnoId], tx),
    obtenerFormaPago(operacion.formaPagoId, tx),
    obtenerNombresPersonal([operacion.registradaPorUsuarioId], tx),
    obtenerClasesBasicas(pagos.map((pago) => pago.turnoId), tx),
  ]);
  if (!alumno || !forma) throw new ComprobanteError(`Faltan datos del alumno o de la forma de pago de ${operacionId}`);
  const clasePorId = new Map(clases.map((clase) => [clase.turno_id, clase]));
  const total = pagos.reduce((suma, pago) => suma.plus(pago.monto), new Prisma.Decimal(0));

  return ComprobanteDatosSchema.parse({
    version: 1,
    centro,
    alumno: { id: alumno.id, nombre: alumno.nombre, apellido: alumno.apellido, dni: alumno.dni },
    fecha_pago: operacion.fechaPago.toISOString().slice(0, 10),
    forma_pago: { id: forma.id, nombre: forma.nombre },
    registrado_por: { usuario_id: operacion.registradaPorUsuarioId, nombre_completo: registrador?.nombre_completo ?? null },
    clases: pagos.map((pago) => {
      const clase = clasePorId.get(pago.turnoId);
      if (!clase) throw new ComprobanteError(`No existe la clase ${pago.turnoId}`);
      return {
        pago_id: pago.pagoId, materia: clase.materia, fecha: clase.fecha, hora_inicio: clase.hora_inicio,
        precio: pago.precio, monto: pago.monto.toFixed(2),
      };
    }),
    total: total.toFixed(2),
  });
}

/** Toma el número de la secuencia en la transacción del pago: puede haber saltos, nunca repetidos. */
async function siguienteNumero(tx: Tx): Promise<number> {
  const [fila] = await tx.$queryRaw<{ numero: bigint }[]>`SELECT nextval('comprobante_numero_seq') AS numero`;
  return Number(fila!.numero);
}

/** Emite el comprobante de una operación (uno por operación). */
export async function emitirComprobante(tx: Tx, operacionId: string): Promise<ComprobanteEmitido> {
  const datos = await armarDatos(tx, operacionId);
  const numero = await siguienteNumero(tx);
  const comprobante = await tx.comprobante.create({
    data: { numero, operacionId, datos, emitidoEl: ahora() },
  });
  return { id: comprobante.idComprobante, numero, numeroVisible: formatearNumeroComprobante(numero), datos };
}

/**
 * Emite el reemplazo de un comprobante con los valores vigentes de su
 * operación (corrección, cambio de forma o fecha, o anulación de un pago de
 * una operación con otros pagos vigentes). `reemplazaAId` es único: un
 * comprobante se reemplaza una sola vez. Si la operación ya no tiene pagos
 * vigentes no se emite nada: quien anula no llama acá (el comprobante queda
 * «ANULADO», marca derivada).
 */
export async function emitirReemplazo(tx: Tx, comprobanteId: string): Promise<ComprobanteEmitido> {
  const anterior = await tx.comprobante.findUnique({
    where: { idComprobante: comprobanteId },
    select: { operacionId: true, reemplazadoPor: { select: { idComprobante: true } } },
  });
  if (!anterior) throw new ComprobanteError(`No existe el comprobante ${comprobanteId}`);
  if (anterior.reemplazadoPor) throw new ComprobanteError(`El comprobante ${comprobanteId} ya fue reemplazado`);
  const datos = await armarDatos(tx, anterior.operacionId);
  const numero = await siguienteNumero(tx);
  const comprobante = await tx.comprobante.create({
    data: { numero, operacionId: anterior.operacionId, datos, emitidoEl: ahora(), reemplazaAId: comprobanteId },
  });
  return { id: comprobante.idComprobante, numero, numeroVisible: formatearNumeroComprobante(numero), datos };
}

/** El comprobante vigente de la operación (el que nadie reemplazó), o `null`. */
export async function comprobanteVigenteDe(tx: Tx, operacionId: string): Promise<{ id: string; numero: number } | null> {
  const vigente = await tx.comprobante.findFirst({
    where: { operacionId, reemplazadoPor: { is: null } },
    orderBy: { numero: "desc" },
    select: { idComprobante: true, numero: true },
  });
  return vigente ? { id: vigente.idComprobante, numero: vigente.numero } : null;
}
