import { prisma } from "@/lib/prisma";
import { INCLUDE_OPERACION_VIGENTE, vigenteDeOperacion } from "@/server/pagos/pago.vigente";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { isoCentro } from "@/server/shared/fechas-centro";
import type { Tx } from "@/server/shared/transaccion";
import type { HistorialPagoDto, TipoCambioPago } from "@/types/pago.types";

/**
 * Lecturas de HU-I-06 sin bloqueo (patrón `*.lecturas.ts`). Solo compaginan
 * los registros de corrección y anulación que ya carga
 * `INCLUDE_OPERACION_VIGENTE`; no deciden nada.
 */

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);

/**
 * En un mismo instante, el orden de escritura de `corregirPagoFlujo` es monto,
 * forma, fecha (y la anulación siempre es lo último que le pasa a un pago):
 * «más nuevo primero» los invierte.
 */
const ORDEN_EN_EMPATE: Record<TipoCambioPago, number> = { ANULACION: 0, CORRECCION_FECHA: 1, CORRECCION_FORMA: 2, CORRECCION_MONTO: 3 };

type Evento = {
  tipo: TipoCambioPago;
  anterior: string | null;
  nuevo: string | null;
  motivo: string;
  usuarioId: string | null;
  momento: Date;
};

/**
 * «Detalle del pago» (DEC-27, spec_modulo_I.md §2.14.6): arriba los valores
 * vigentes del pago y quién lo registró; abajo cada corrección o anulación
 * con su propio anterior → nuevo, tal como quedó grabado. Las correcciones
 * de forma y fecha son de la operación y figuran en todos sus pagos.
 * `404 PAGO_NO_ENCONTRADO` si no existe.
 */
export async function obtenerHistorialDePago(pagoId: string, db: Tx = prisma): Promise<HistorialPagoDto> {
  const pago = await db.pago.findUnique({ where: { idPago: pagoId }, select: { operacionId: true } });
  if (!pago) throw new ErrorDeDominio("errores.pago.noEncontrado");
  const operacion = await db.operacionPago.findUniqueOrThrow({ where: { idOperacionPago: pago.operacionId }, include: INCLUDE_OPERACION_VIGENTE });
  const vigente = vigenteDeOperacion(operacion);
  const pagoLeido = operacion.pagos.find((p) => p.idPago === pagoId)!;
  const pagoVigente = vigente.pagos.find((p) => p.pagoId === pagoId)!;

  const eventos: Evento[] = [
    ...pagoLeido.correcciones.map((c) => ({
      tipo: "CORRECCION_MONTO" as const, anterior: c.montoAnterior.toFixed(2), nuevo: c.montoNuevo.toFixed(2),
      motivo: c.motivo, usuarioId: c.creadoPorUsuarioId, momento: c.createdAtCorreccionPago,
    })),
    ...operacion.correcciones.map((c) => c.formaPagoNuevaId !== null
      ? {
        tipo: "CORRECCION_FORMA" as const, anterior: c.formaPagoAnteriorId, nuevo: c.formaPagoNuevaId,
        motivo: c.motivo, usuarioId: c.creadoPorUsuarioId, momento: c.createdAtCorreccionOperacion,
      }
      : {
        tipo: "CORRECCION_FECHA" as const, anterior: c.fechaPagoAnterior && dia(c.fechaPagoAnterior), nuevo: c.fechaPagoNueva && dia(c.fechaPagoNueva),
        motivo: c.motivo, usuarioId: c.creadoPorUsuarioId, momento: c.createdAtCorreccionOperacion,
      }),
    ...(pagoLeido.anulacion ? [{
      // Un pago anulado ya no se corrige: su monto vigente es el que tenía al anularse.
      tipo: "ANULACION" as const, anterior: pagoVigente.monto.toFixed(2), nuevo: null,
      motivo: pagoLeido.anulacion.motivo, usuarioId: pagoLeido.anulacion.creadoPorUsuarioId, momento: pagoLeido.anulacion.createdAtAnulacionPago,
    }] : []),
  ].sort((a, b) => b.momento.getTime() - a.momento.getTime() || ORDEN_EN_EMPATE[a.tipo] - ORDEN_EN_EMPATE[b.tipo]);

  const idsFormas = [vigente.formaPagoId, ...eventos.filter((e) => e.tipo === "CORRECCION_FORMA").flatMap((e) => [e.anterior!, e.nuevo!])];
  const idsUsuarios = [vigente.registradaPorUsuarioId, ...eventos.flatMap((e) => (e.usuarioId ? [e.usuarioId] : []))];
  const [formas, nombres] = await Promise.all([
    db.formaPago.findMany({ where: { idFormaPago: { in: [...new Set(idsFormas)] } }, select: { idFormaPago: true, nombreFormaPago: true } }),
    obtenerNombresPersonal(idsUsuarios, db),
  ]);
  const nombreForma = new Map(formas.map((f) => [f.idFormaPago, f.nombreFormaPago]));
  const nombreUsuario = new Map(nombres.map((n) => [n.usuario_id, n.nombre_completo]));
  const persona = (usuarioId: string) => ({ usuario_id: usuarioId, nombre_completo: nombreUsuario.get(usuarioId) ?? null });
  const valor = (evento: Evento, id: string | null) => (evento.tipo === "CORRECCION_FORMA" && id ? nombreForma.get(id) ?? id : id);

  return {
    registro: {
      monto: pagoVigente.monto.toFixed(2),
      forma_pago: { id: vigente.formaPagoId, nombre: nombreForma.get(vigente.formaPagoId) ?? vigente.formaPagoId },
      fecha_pago: dia(vigente.fechaPago),
      registrado_por: persona(vigente.registradaPorUsuarioId),
      registrado_en: isoCentro(pagoVigente.registradoEn),
    },
    cambios: eventos.map((evento) => ({
      tipo: evento.tipo,
      valor_anterior: valor(evento, evento.anterior),
      valor_nuevo: valor(evento, evento.nuevo),
      motivo: evento.motivo,
      usuario: evento.usuarioId ? persona(evento.usuarioId) : null,
      fecha: isoCentro(evento.momento),
    })),
  };
}
