import type { PrismaClient } from "@prisma/client";
import {
  anularPago, corregirOperacion, corregirPago, type OperacionCorregida, type PagoCorregido, type UsuarioOperador,
} from "@/server/pagos/correccion.service";
import type { AnularPagoInput, CorregirPagoInput } from "@/server/pagos/correccion.schema";
import { operacionVigente } from "@/server/pagos/pago.vigente";
import { isoCentro } from "@/server/shared/fechas-centro";
import { transaccion } from "@/server/shared/transaccion";
import type { PagoAnuladoDto, PagoCorregidoDto } from "@/types/pago.types";

/**
 * Flujos HTTP de corrección y anulación de pagos (HU-I-06,
 * spec_modulo_I.md §2.14.2 y §2.14.3): cada uno abre su `transaccion()` y
 * llama a `correccion.service.ts` del PR 0, que es el dueño de todas las
 * reglas (bloqueo único, alcance, valores vigentes, forma activa, fecha no
 * futura, ajuste de caja y comprobante). Acá solo se arma la respuesta.
 *
 * `db` solo lo pasan las pruebas con PostgreSQL real.
 */

type Opciones = { db?: PrismaClient };

/**
 * Corrige el monto del pago y/o la forma o la fecha de su operación, en una
 * sola transacción y en el orden de §2.14.2 paso 5: primero el monto, después
 * forma y fecha. Si cambian los dos grupos quedan dos comprobantes de
 * reemplazo encadenados; la respuesta trae el último (el vigente).
 */
export async function corregirPagoFlujo(
  pagoId: string,
  input: CorregirPagoInput,
  usuario: UsuarioOperador,
  opciones: Opciones = {},
): Promise<PagoCorregidoDto> {
  return transaccion(async (tx) => {
    let resultadoMonto: PagoCorregido | undefined;
    let resultadoOperacion: OperacionCorregida | undefined;
    if (input.monto !== undefined) {
      resultadoMonto = await corregirPago(tx, {
        pagoId, monto: input.monto, motivo: input.motivo, usuario, cajaAjusteId: input.caja_ajuste_id,
      });
    }
    if (input.forma_pago_id !== undefined || input.fecha_pago !== undefined) {
      // `fecha_pago` ya es `Date`: lo transforma `fechaCalendarioValidaSchema`.
      resultadoOperacion = await corregirOperacion(tx, {
        pagoId, formaPagoId: input.forma_pago_id, fechaPago: input.fecha_pago,
        motivo: input.motivo, usuario, cajaAjusteId: input.caja_ajuste_id,
      });
    }
    // El schema exige al menos un campo: alguno de los dos corrió.
    const comprobante = (resultadoOperacion ?? resultadoMonto)!.comprobante;

    // Valores vigentes después de los cambios, leídos con los bloqueos que ya tomó el servicio.
    const { operacionId } = await tx.pago.findUniqueOrThrow({ where: { idPago: pagoId }, select: { operacionId: true } });
    const operacion = (await operacionVigente(tx, operacionId))!;
    const pago = operacion.pagos.find((p) => p.pagoId === pagoId)!;
    const forma = await tx.formaPago.findUniqueOrThrow({
      where: { idFormaPago: operacion.formaPagoId },
      select: { idFormaPago: true, nombreFormaPago: true, activaFormaPago: true },
    });
    return {
      pago_id: pagoId,
      monto: pago.monto.toFixed(2),
      forma_pago: { id: forma.idFormaPago, nombre: forma.nombreFormaPago, is_active: forma.activaFormaPago },
      fecha_pago: operacion.fechaPago.toISOString().slice(0, 10),
      clases_abarcadas: resultadoOperacion?.clasesAbarcadas ?? operacion.pagos.filter((p) => !p.anulado).length,
      comprobante: { id: comprobante.id, numero: comprobante.numeroVisible },
    };
  }, opciones);
}

/**
 * Anula el pago (§2.14.3). El estado de la inscripción lo recalcula el
 * servicio con `recalcularEstadoPago` (HU-C-24 criterio 5); el historial de
 * estados se escribe después del commit.
 */
export async function anularPagoFlujo(
  pagoId: string,
  input: AnularPagoInput,
  usuario: UsuarioOperador,
  opciones: Opciones = {},
): Promise<PagoAnuladoDto> {
  return transaccion(async (tx) => {
    const resultado = await anularPago(tx, { pagoId, motivo: input.motivo, usuario, cajaAjusteId: input.caja_ajuste_id });
    const { inscripcionId } = await tx.pago.findUniqueOrThrow({ where: { idPago: pagoId }, select: { inscripcionId: true } });
    return {
      pago_id: pagoId,
      anulado: true,
      inscripcion: {
        id: inscripcionId,
        estado_pago: resultado.inscripcion.nuevo,
        vence_el: resultado.inscripcion.nuevo === "RESERVADA" && resultado.inscripcion.venceEl ? isoCentro(resultado.inscripcion.venceEl) : null,
      },
      comprobante: resultado.comprobante
        ? { id: resultado.comprobante.id, numero: resultado.comprobante.numeroVisible, reemplazo: true }
        : null,
    };
  }, opciones);
}
