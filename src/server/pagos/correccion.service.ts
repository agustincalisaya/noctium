import { Prisma, type RolUsuario } from "@prisma/client";
import { registrarAjuste } from "@/server/pagos/caja.service";
import { comprobanteVigenteDe, emitirReemplazo, type ComprobanteEmitido } from "@/server/pagos/comprobante.service";
import { existeFormaPago, verificarFormaPagoActiva } from "@/server/pagos/forma-pago.publico";
import { contarPagosNoAnulados, operacionVigente, type OperacionVigente, type PagoVigente } from "@/server/pagos/pago.vigente";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { fechaCentro } from "@/server/shared/fechas-centro";
import { actorUsuario } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";
import { recalcularEstadoPago, type CambioEstadoPago } from "@/server/turnos/inscripcion.publico";

/**
 * Corrección y anulación de pagos (PR-0.md §2.13, spec_modulo_I.md §2.14).
 * El pago original nunca se actualiza ni se borra (Regla N.° 8): cada cambio
 * es un registro nuevo. Si la caja del pago está cerrada y el cambio mueve
 * dinero, el ajuste va a una caja abierta (`cajaAjusteId`). Cada función toma
 * sus bloqueos en una sola llamada (clase → inscripción → operación → cajas);
 * HU-I-06 puede llamar a `corregirPago` y `corregirOperacion` en la misma
 * transacción: el segundo pedido de los mismos bloqueos no hace nada.
 */

export type UsuarioOperador = { id: string; rol: RolUsuario };

const DIAS_CORRECCION_MESA = 30;

/**
 * Alcance de HU-I-06 (spec_modulo_I.md §2.14.1): el Gerente corrige o anula
 * cualquier pago no anulado; Mesa de Entrada, solo uno registrado hace 30 días
 * o menos y cuya caja siga abierta. El resto, nunca. Las pantallas lo usan
 * para mostrar los botones; el servidor lo vuelve a evaluar con todo bloqueado.
 */
export function puedeCorregirPago(
  usuario: UsuarioOperador,
  pago: { anulado: boolean; registradoEn: Date; cajaAbierta: boolean },
  momento: Date = ahora(),
): boolean {
  if (pago.anulado) return false;
  if (usuario.rol === "GERENTE") return true;
  if (usuario.rol !== "MESA_ENTRADA") return false;
  const limite = momento.getTime() - DIAS_CORRECCION_MESA * 24 * 60 * 60 * 1000;
  return pago.registradoEn.getTime() >= limite && pago.cajaAbierta;
}

type Contexto = { pago: PagoVigente; operacion: OperacionVigente; cajaPagoAbierta: boolean };

/** Lectura previa, un solo `bloquear` y relectura con todo bloqueado (spec_modulo_I.md §2.14.2, pasos 1 a 3). */
async function contextoDelPago(tx: Tx, pagoId: string, cajaAjusteId?: string | null): Promise<Contexto> {
  const previo = await tx.pago.findUnique({
    where: { idPago: pagoId },
    select: { turnoId: true, inscripcionId: true, operacionId: true, operacion: { select: { cajaId: true } } },
  });
  if (!previo) throw new ErrorDeDominio("errores.pago.noEncontrado");
  await bloquear(tx, {
    clases: [previo.turnoId],
    inscripciones: [previo.inscripcionId],
    operaciones: [previo.operacionId],
    cajas: [previo.operacion.cajaId, ...(cajaAjusteId ? [cajaAjusteId] : [])],
  });
  const operacion = (await operacionVigente(tx, previo.operacionId))!;
  const pago = operacion.pagos.find((p) => p.pagoId === pagoId)!;
  const caja = await tx.caja.findUniqueOrThrow({ where: { idCaja: operacion.cajaId }, select: { estado: true } });
  return { pago, operacion, cajaPagoAbierta: caja.estado === "ABIERTA" };
}

function exigirAlcance(usuario: UsuarioOperador, contexto: Contexto) {
  const permitido = puedeCorregirPago(usuario, {
    anulado: contexto.pago.anulado, registradoEn: contexto.operacion.registradaEl, cajaAbierta: contexto.cajaPagoAbierta,
  });
  if (!permitido) throw new ErrorDeDominio("errores.pago.fueraDeAlcance");
}

function validarMotivo(motivo: string): string {
  const limpio = motivo.trim();
  if (limpio.length === 0 || limpio.length > 300) throw new RangeError("motivo de 1 a 300 caracteres");
  return limpio;
}

/** Caja abierta que recibe el ajuste cuando la caja del pago está cerrada; sin ella, CAJA_DE_AJUSTE_NO_ABIERTA. */
function cajaDeAjuste(cajaAjusteId: string | null | undefined): string {
  if (!cajaAjusteId) throw new ErrorDeDominio("errores.caja.ajusteSinCajaAbierta");
  return cajaAjusteId;
}

async function reemplazarComprobante(tx: Tx, operacionId: string): Promise<ComprobanteEmitido> {
  const vigente = await comprobanteVigenteDe(tx, operacionId);
  if (!vigente) throw new Error(`La operación ${operacionId} no tiene comprobante vigente`);
  return emitirReemplazo(tx, vigente.id);
}

export type PagoCorregido = { correccionId: string; montoAnterior: string; montoNuevo: string; comprobante: ComprobanteEmitido; ajustes: string[] };

/**
 * Corrige el monto de un pago (spec_modulo_I.md §2.14.2): CorreccionPago con
 * el valor vigente anterior y el nuevo, comprobante de reemplazo y, si la caja
 * del pago está cerrada, el ajuste por la diferencia en la forma vigente. No
 * cambia el estado de pago de la inscripción (el pago sigue sin anular).
 */
export async function corregirPago(
  tx: Tx,
  datos: { pagoId: string; monto: string; motivo: string; usuario: UsuarioOperador; cajaAjusteId?: string | null },
): Promise<PagoCorregido> {
  const motivo = validarMotivo(datos.motivo);
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(datos.monto) || Number(datos.monto) <= 0) throw new RangeError("corregirPago: monto positivo con hasta 2 decimales");
  const contexto = await contextoDelPago(tx, datos.pagoId, datos.cajaAjusteId);
  if (contexto.pago.anulado) throw new ErrorDeDominio("errores.pago.anulado");
  exigirAlcance(datos.usuario, contexto);
  const nuevo = new Prisma.Decimal(datos.monto);
  const anterior = contexto.pago.monto;
  if (nuevo.equals(anterior)) throw new ErrorDeDominio("errores.pago.sinCambios");

  const correccion = await tx.correccionPago.create({
    data: {
      pagoId: datos.pagoId, montoAnterior: anterior, montoNuevo: nuevo, motivo,
      creadoPorUsuarioId: datos.usuario.id, createdAtCorreccionPago: ahora(),
    },
  });
  let ajustes: string[] = [];
  if (!contexto.cajaPagoAbierta) {
    ajustes = (await registrarAjuste(tx, {
      cajaId: cajaDeAjuste(datos.cajaAjusteId), pagoId: datos.pagoId, origen: { correccionPagoId: correccion.idCorreccionPago },
      ajustes: [{ formaPagoId: contexto.operacion.formaPagoId, monto: nuevo.minus(anterior) }], usuarioId: datos.usuario.id,
    })).ids;
  }
  const comprobante = await reemplazarComprobante(tx, contexto.operacion.operacionId);
  return { correccionId: correccion.idCorreccionPago, montoAnterior: anterior.toFixed(2), montoNuevo: nuevo.toFixed(2), comprobante, ajustes };
}

export type OperacionCorregida = { correcciones: string[]; clasesAbarcadas: number; comprobante: ComprobanteEmitido; ajustes: string[] };

/**
 * Corrige la forma y/o la fecha de pago de la operación del pago (alcanza a
 * todos sus pagos, spec_modulo_I.md §2.14.2): una CorreccionOperacion por
 * campo que cambia y un comprobante de reemplazo. Enviar la forma o la fecha
 * vigentes no cuenta como cambio (una forma inactiva que ya tenía se
 * conserva). Si la caja está cerrada, el cambio de forma registra un par de
 * ajustes por el total vigente (spec_modulo_I.md §2.14.4); el de fecha no
 * mueve dinero.
 */
export async function corregirOperacion(
  tx: Tx,
  datos: { pagoId: string; formaPagoId?: string; fechaPago?: Date; motivo: string; usuario: UsuarioOperador; cajaAjusteId?: string | null },
): Promise<OperacionCorregida> {
  const motivo = validarMotivo(datos.motivo);
  const contexto = await contextoDelPago(tx, datos.pagoId, datos.cajaAjusteId);
  if (contexto.pago.anulado) throw new ErrorDeDominio("errores.pago.anulado");
  exigirAlcance(datos.usuario, contexto);
  const { operacion } = contexto;
  const cambiaForma = datos.formaPagoId !== undefined && datos.formaPagoId !== operacion.formaPagoId;
  const cambiaFecha = datos.fechaPago !== undefined && datos.fechaPago.getTime() !== operacion.fechaPago.getTime();
  if (cambiaForma && !(await verificarFormaPagoActiva(datos.formaPagoId!, tx))) {
    throw new ErrorDeDominio((await existeFormaPago(datos.formaPagoId!, tx)) ? "errores.formaPago.noDisponible" : "errores.formaPago.noEncontrada");
  }
  if (cambiaFecha && datos.fechaPago!.getTime() > fechaCentro(ahora()).getTime()) throw new ErrorDeDominio("errores.pago.fechaFutura");
  if (!cambiaForma && !cambiaFecha) throw new ErrorDeDominio("errores.pago.sinCambios");

  const momento = ahora();
  const base = { operacionId: operacion.operacionId, motivo, creadoPorUsuarioId: datos.usuario.id, createdAtCorreccionOperacion: momento };
  const correcciones: string[] = [];
  let ajustes: string[] = [];
  const vigentes = operacion.pagos.filter((p) => !p.anulado);
  if (cambiaForma) {
    const correccion = await tx.correccionOperacion.create({
      data: { ...base, formaPagoAnteriorId: operacion.formaPagoId, formaPagoNuevaId: datos.formaPagoId! },
    });
    correcciones.push(correccion.idCorreccionOperacion);
    if (!contexto.cajaPagoAbierta) {
      const total = vigentes.reduce((suma, p) => suma.plus(p.monto), new Prisma.Decimal(0));
      ajustes = (await registrarAjuste(tx, {
        cajaId: cajaDeAjuste(datos.cajaAjusteId), pagoId: datos.pagoId, origen: { correccionOperacionId: correccion.idCorreccionOperacion },
        ajustes: [{ formaPagoId: operacion.formaPagoId, monto: total.negated() }, { formaPagoId: datos.formaPagoId!, monto: total }],
        usuarioId: datos.usuario.id,
      })).ids;
    }
  }
  if (cambiaFecha) {
    const correccion = await tx.correccionOperacion.create({
      data: { ...base, fechaPagoAnterior: operacion.fechaPago, fechaPagoNueva: datos.fechaPago! },
    });
    correcciones.push(correccion.idCorreccionOperacion);
  }
  const comprobante = await reemplazarComprobante(tx, operacion.operacionId);
  return { correcciones, clasesAbarcadas: vigentes.length, comprobante, ajustes };
}

export type PagoAnulado = { anulacionId: string; inscripcion: CambioEstadoPago; comprobante: ComprobanteEmitido | null; ajustes: string[] };

/**
 * Anula un pago (spec_modulo_I.md §2.14.3): AnulacionPago (una por pago),
 * `recalcularEstadoPago` con el conteo de pagos no anulados (reapertura de la
 * reserva o PAGO_SIN_REGISTRAR según la clase), comprobante de reemplazo si
 * la operación conserva pagos vigentes (si no, el vigente queda «ANULADO»,
 * marca derivada) y, con la caja cerrada, el ajuste de menos el monto vigente.
 */
export async function anularPago(
  tx: Tx,
  datos: { pagoId: string; motivo: string; usuario: UsuarioOperador; cajaAjusteId?: string | null },
): Promise<PagoAnulado> {
  const motivo = validarMotivo(datos.motivo);
  const contexto = await contextoDelPago(tx, datos.pagoId, datos.cajaAjusteId);
  if (contexto.pago.anulado) throw new ErrorDeDominio("errores.pago.yaAnulado");
  exigirAlcance(datos.usuario, contexto);

  let anulacion;
  try {
    anulacion = await tx.anulacionPago.create({
      data: { pagoId: datos.pagoId, motivo, actorTipo: "USUARIO", creadoPorUsuarioId: datos.usuario.id, createdAtAnulacionPago: ahora() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorDeDominio("errores.pago.yaAnulado");
    throw error;
  }
  const inscripcion = await recalcularEstadoPago(
    tx, contexto.pago.inscripcionId, await contarPagosNoAnulados(tx, contexto.pago.inscripcionId), actorUsuario(datos.usuario.id),
  );
  let ajustes: string[] = [];
  if (!contexto.cajaPagoAbierta) {
    ajustes = (await registrarAjuste(tx, {
      cajaId: cajaDeAjuste(datos.cajaAjusteId), pagoId: datos.pagoId, origen: { anulacionPagoId: anulacion.idAnulacionPago },
      ajustes: [{ formaPagoId: contexto.operacion.formaPagoId, monto: contexto.pago.monto.negated() }], usuarioId: datos.usuario.id,
    })).ids;
  }
  const quedanVigentes = contexto.operacion.pagos.some((p) => !p.anulado && p.pagoId !== datos.pagoId);
  const comprobante = quedanVigentes ? await reemplazarComprobante(tx, contexto.operacion.operacionId) : null;
  return { anulacionId: anulacion.idAnulacionPago, inscripcion, comprobante, ajustes };
}
