import { createHash } from "node:crypto";
import { Prisma, type TipoMovimientoCaja } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INCLUDE_OPERACION_VIGENTE, vigenteDeOperacion } from "@/server/pagos/pago.vigente";
import { bloquearIntegranteActivo } from "@/server/personal/personal.publico";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";

/**
 * Caja de mesa de entrada (PR-0.md §2.5 y §2.13, spec_modulo_I.md §2.10).
 * Apertura, movimientos, ajustes, declaración del efectivo, resumen con
 * huella y cierre (con el cierre por ausencia del gerente).
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

// ---------------------------------------------------------------------------
// Movimientos, ajustes, declaración, resumen y cierre (HU-I-12, spec_modulo_I.md §2.10 a §2.12)
// ---------------------------------------------------------------------------

function montoValido(monto: string, nombre: string, { permiteCero = false } = {}): Prisma.Decimal {
  if (!MONTO_NO_NEGATIVO.test(monto) || (!permiteCero && Number(monto) <= 0)) {
    throw new RangeError(`${nombre}: monto inválido (${permiteCero ? "mayor o igual a 0" : "mayor a 0"}, hasta 2 decimales)`);
  }
  return new Prisma.Decimal(monto);
}

type CajaFila = { idCaja: string; usuarioId: string; estado: "ABIERTA" | "CERRADA" };

/** Bloquea la caja (nivel caja) y la relee ya bloqueada. */
async function cajaBloqueada(tx: Tx, cajaId: string): Promise<CajaFila> {
  await bloquear(tx, { cajas: [cajaId] });
  const caja = await tx.caja.findUnique({ where: { idCaja: cajaId }, select: { idCaja: true, usuarioId: true, estado: true } });
  if (!caja) throw new ErrorDeDominio("errores.caja.noEncontrada");
  return caja;
}

/** La caja propia; con `porAusencia`, la de otro integrante (el gerente que cierra por ausencia). */
function exigirAlcance(caja: CajaFila, usuarioId: string, porAusencia = false) {
  const propia = caja.usuarioId === usuarioId;
  if (porAusencia ? propia : !propia) throw new ErrorDeDominio("errores.caja.fueraDeAlcance");
}

export type FormaEnResumen = { id: string; nombre: string; es_efectivo: boolean };
export type ResumenCaja = {
  fondo_inicial: string;
  cobros_por_forma: { forma_pago: FormaEnResumen; cantidad: number; total: string }[];
  ingresos_manuales: string;
  egresos_manuales: string;
  ajustes: { forma_pago: FormaEnResumen; total: string }[];
  efectivo_esperado: string;
  efectivo_declarado: string | null;
  diferencia: string | null;
  tipo_diferencia: "SOBRANTE" | "FALTANTE" | "CUADRA" | null;
};

const cero = () => new Prisma.Decimal(0);
const maximo = (ids: string[]) => ids.reduce<string | null>((max, id) => (max === null || id > max ? id : max), null);
const porId = <T>([a]: [string, T], [b]: [string, T]) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Resumen de la caja y su huella (spec_modulo_I.md §2.11): cobros con monto y
 * forma vigentes y sin anulados, movimientos sin anulados y ajustes. El
 * efectivo esperado suma solo las formas con `esEfectivo`. La huella resume
 * lo que se mostró: el esperado y, por tipo, la cantidad y el último id de
 * cobros, correcciones y anulaciones de sus pagos, movimientos, anulaciones de
 * movimientos y ajustes. Cualquier cambio, aunque sea en una forma que no es
 * efectivo, cambia la huella.
 */
export async function calcularResumen(db: Tx | typeof prisma, cajaId: string): Promise<{ resumen: ResumenCaja; huella: string }> {
  const caja = await db.caja.findUnique({ where: { idCaja: cajaId } });
  if (!caja) throw new ErrorDeDominio("errores.caja.noEncontrada");
  const [operaciones, movimientos, ajustes, formas] = await Promise.all([
    db.operacionPago.findMany({ where: { cajaId }, include: INCLUDE_OPERACION_VIGENTE, orderBy: { idOperacionPago: "asc" } }),
    db.movimientoCaja.findMany({ where: { cajaId }, include: { anulacion: true }, orderBy: { idMovimientoCaja: "asc" } }),
    db.ajusteCaja.findMany({ where: { cajaId }, orderBy: { idAjusteCaja: "asc" } }),
    db.formaPago.findMany({ select: { idFormaPago: true, nombreFormaPago: true, esEfectivo: true } }),
  ]);
  const formaPorId = new Map(formas.map((f) => [f.idFormaPago, { id: f.idFormaPago, nombre: f.nombreFormaPago, es_efectivo: f.esEfectivo }]));
  const formaDe = (id: string): FormaEnResumen => formaPorId.get(id) ?? { id, nombre: id, es_efectivo: false };

  const cobros = new Map<string, { cantidad: number; total: Prisma.Decimal }>();
  const idsPagos: string[] = [];
  const idsCorrecciones: string[] = [];
  const idsAnulaciones: string[] = [];
  for (const operacion of operaciones) {
    const vigente = vigenteDeOperacion(operacion);
    idsCorrecciones.push(...operacion.correcciones.map((c) => c.idCorreccionOperacion));
    for (const pago of operacion.pagos) {
      idsPagos.push(pago.idPago);
      idsCorrecciones.push(...pago.correcciones.map((c) => c.idCorreccionPago));
      if (pago.anulacion) idsAnulaciones.push(pago.anulacion.idAnulacionPago);
    }
    for (const pago of vigente.pagos.filter((p) => !p.anulado)) {
      const acumulado = cobros.get(vigente.formaPagoId) ?? { cantidad: 0, total: cero() };
      cobros.set(vigente.formaPagoId, { cantidad: acumulado.cantidad + 1, total: acumulado.total.plus(pago.monto) });
    }
  }
  let ingresos = cero();
  let egresos = cero();
  for (const movimiento of movimientos.filter((m) => !m.anulacion)) {
    if (movimiento.tipo === "INGRESO") ingresos = ingresos.plus(movimiento.monto);
    else egresos = egresos.plus(movimiento.monto);
  }
  const ajustesPorForma = new Map<string, Prisma.Decimal>();
  for (const ajuste of ajustes) ajustesPorForma.set(ajuste.formaPagoId, (ajustesPorForma.get(ajuste.formaPagoId) ?? cero()).plus(ajuste.monto));

  let esperado = new Prisma.Decimal(caja.fondoInicial).plus(ingresos).minus(egresos);
  for (const [id, { total }] of cobros) if (formaDe(id).es_efectivo) esperado = esperado.plus(total);
  for (const [id, total] of ajustesPorForma) if (formaDe(id).es_efectivo) esperado = esperado.plus(total);

  const declarado = caja.efectivoDeclarado === null ? null : new Prisma.Decimal(caja.efectivoDeclarado);
  const diferencia = declarado === null ? null : declarado.minus(esperado);
  const resumen: ResumenCaja = {
    fondo_inicial: new Prisma.Decimal(caja.fondoInicial).toFixed(2),
    cobros_por_forma: [...cobros].sort(porId).map(([id, { cantidad, total }]) => ({ forma_pago: formaDe(id), cantidad, total: total.toFixed(2) })),
    ingresos_manuales: ingresos.toFixed(2),
    egresos_manuales: egresos.toFixed(2),
    ajustes: [...ajustesPorForma].sort(porId).map(([id, total]) => ({ forma_pago: formaDe(id), total: total.toFixed(2) })),
    efectivo_esperado: esperado.toFixed(2),
    efectivo_declarado: declarado?.toFixed(2) ?? null,
    diferencia: diferencia?.toFixed(2) ?? null,
    tipo_diferencia: diferencia === null ? null : diferencia.isZero() ? "CUADRA" : diferencia.isPositive() ? "SOBRANTE" : "FALTANTE",
  };
  const anulacionesMovimiento = movimientos.flatMap((m) => (m.anulacion ? [m.anulacion.idAnulacionMovimiento] : []));
  const datosHuella = {
    esperado: resumen.efectivo_esperado,
    cobros: [idsPagos.length, maximo(idsPagos)],
    correcciones: [idsCorrecciones.length, maximo(idsCorrecciones)],
    anulaciones_pago: [idsAnulaciones.length, maximo(idsAnulaciones)],
    movimientos: [movimientos.length, maximo(movimientos.map((m) => m.idMovimientoCaja))],
    anulaciones_movimiento: [anulacionesMovimiento.length, maximo(anulacionesMovimiento)],
    ajustes: [ajustes.length, maximo(ajustes.map((a) => a.idAjusteCaja))],
  };
  const huella = createHash("sha256").update(JSON.stringify(datosHuella)).digest("hex");
  return { resumen, huella };
}

/** Registra un ingreso o egreso manual de efectivo en la caja propia abierta (spec_modulo_I.md §2.10.3). */
export async function registrarMovimiento(
  tx: Tx,
  datos: { cajaId: string; usuarioId: string; tipo: TipoMovimientoCaja; monto: string; concepto: string },
): Promise<{ id: string; tipo: TipoMovimientoCaja; monto: string; concepto: string; momento: Date }> {
  const monto = montoValido(datos.monto, "registrarMovimiento");
  const concepto = datos.concepto.trim();
  if (concepto.length === 0 || concepto.length > 200) throw new RangeError("registrarMovimiento: concepto de 1 a 200 caracteres");
  const caja = await cajaBloqueada(tx, datos.cajaId);
  exigirAlcance(caja, datos.usuarioId);
  if (caja.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.sinCajaAbierta");
  if (datos.tipo === "EGRESO") {
    const { resumen } = await calcularResumen(tx, caja.idCaja);
    if (monto.greaterThan(resumen.efectivo_esperado)) throw new ErrorDeDominio("errores.caja.egresoSuperaEfectivo");
  }
  const momento = ahora();
  const movimiento = await tx.movimientoCaja.create({
    data: { cajaId: caja.idCaja, tipo: datos.tipo, monto, concepto, creadoPorUsuarioId: datos.usuarioId, createdAtMovimientoCaja: momento },
  });
  return { id: movimiento.idMovimientoCaja, tipo: movimiento.tipo, monto: monto.toFixed(2), concepto, momento };
}

/** Anula un movimiento de la caja propia abierta con un registro nuevo (spec_modulo_I.md §2.10.4). */
export async function anularMovimiento(tx: Tx, datos: { movimientoId: string; usuarioId: string; motivo: string }): Promise<{ id: string }> {
  const motivo = datos.motivo.trim();
  if (motivo.length === 0 || motivo.length > 300) throw new RangeError("anularMovimiento: motivo de 1 a 300 caracteres");
  const previo = await tx.movimientoCaja.findUnique({ where: { idMovimientoCaja: datos.movimientoId }, select: { cajaId: true } });
  if (!previo) throw new ErrorDeDominio("errores.caja.movimientoNoEncontrado");
  const caja = await cajaBloqueada(tx, previo.cajaId);
  if (caja.usuarioId !== datos.usuarioId) throw new ErrorDeDominio("errores.caja.movimientoNoEncontrado");
  if (caja.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.sinCajaAbierta");
  const movimiento = await tx.movimientoCaja.findUniqueOrThrow({ where: { idMovimientoCaja: datos.movimientoId }, include: { anulacion: true } });
  if (movimiento.anulacion) throw new ErrorDeDominio("errores.caja.movimientoYaAnulado");
  if (movimiento.tipo === "INGRESO") {
    const { resumen } = await calcularResumen(tx, caja.idCaja);
    if (new Prisma.Decimal(resumen.efectivo_esperado).minus(movimiento.monto).isNegative()) {
      throw new ErrorDeDominio("errores.caja.anulacionDejaEfectivoNegativo");
    }
  }
  try {
    const anulacion = await tx.anulacionMovimiento.create({
      data: { movimientoId: movimiento.idMovimientoCaja, motivo, actorTipo: "USUARIO", creadoPorUsuarioId: datos.usuarioId, createdAtAnulacionMovimiento: ahora() },
    });
    return { id: anulacion.idAnulacionMovimiento };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorDeDominio("errores.caja.movimientoYaAnulado");
    throw error;
  }
}

export type OrigenAjuste = { correccionPagoId: string } | { correccionOperacionId: string } | { anulacionPagoId: string };

/**
 * Registra el dinero que mueve una corrección o anulación de un pago de una
 * caja CERRADA en una caja ABIERTA (spec_modulo_I.md §2.14.4). Recibe uno o
 * dos ajustes con signo: el cambio de forma de pago es un par (menos el total
 * en la forma anterior, más el total en la nueva). Los montos en 0 no se
 * registran. La caja destino la bloqueó quien llama (pedirla de nuevo no hace
 * nada); si no está abierta, falla con CAJA_DE_AJUSTE_NO_ABIERTA.
 */
export async function registrarAjuste(
  tx: Tx,
  datos: { cajaId: string; pagoId: string; origen: OrigenAjuste; ajustes: { formaPagoId: string; monto: Prisma.Decimal | string }[]; usuarioId: string },
): Promise<{ ids: string[] }> {
  await bloquear(tx, { cajas: [datos.cajaId] });
  const caja = await tx.caja.findUnique({ where: { idCaja: datos.cajaId }, select: { estado: true } });
  if (caja?.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.ajusteSinCajaAbierta");
  const momento = ahora();
  const ids: string[] = [];
  for (const ajuste of datos.ajustes) {
    const monto = new Prisma.Decimal(ajuste.monto);
    if (monto.isZero()) continue;
    const creado = await tx.ajusteCaja.create({
      data: {
        cajaId: datos.cajaId, pagoId: datos.pagoId, ...datos.origen, formaPagoId: ajuste.formaPagoId, monto,
        creadoPorUsuarioId: datos.usuarioId, createdAtAjusteCaja: momento,
      },
    });
    ids.push(creado.idAjusteCaja);
  }
  return { ids };
}

/**
 * Paso 1 del cierre (spec_modulo_I.md §2.11): guarda el efectivo contado una
 * sola vez, con la caja bloqueada y abierta (condición atómica sobre
 * `efectivoDeclarado IS NULL`). Devuelve el resumen y la huella del paso 2. La
 * caja sigue abierta. Con `porAusencia`, declara el gerente sobre la caja de otro.
 */
export async function declararEfectivo(
  tx: Tx,
  datos: { cajaId: string; usuarioId: string; efectivoDeclarado: string; porAusencia?: boolean },
): Promise<{ resumen: ResumenCaja; huella: string }> {
  const monto = montoValido(datos.efectivoDeclarado, "declararEfectivo", { permiteCero: true });
  const caja = await cajaBloqueada(tx, datos.cajaId);
  exigirAlcance(caja, datos.usuarioId, datos.porAusencia);
  if (caja.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.sinCajaAbierta");
  const { count } = await tx.caja.updateMany({
    where: { idCaja: caja.idCaja, estado: "ABIERTA", efectivoDeclarado: null },
    data: { efectivoDeclarado: monto },
  });
  if (count === 0) throw new ErrorDeDominio("errores.caja.efectivoYaDeclarado");
  return calcularResumen(tx, caja.idCaja);
}

export type CajaCerrada = {
  caja_id: string;
  estado: "CERRADA";
  cerrada_el: Date;
  diferencia: string;
  tipo_diferencia: "SOBRANTE" | "FALTANTE" | "CUADRA";
  por_ausencia: boolean;
};

/**
 * Paso 2 del cierre (spec_modulo_I.md §2.11 y §2.12): con la caja bloqueada,
 * recalcula el resumen y compara la huella con la que se mostró. Si cambió,
 * CAJA_CAMBIO con el resumen y la huella nuevos, sin cerrar. Con diferencia
 * exige motivo. Cierra con una sola actualización condicional y guarda el
 * resumen fijo; después la caja es inmutable.
 */
export async function cerrarCaja(
  tx: Tx,
  datos: { cajaId: string; usuarioId: string; huella: string; motivo?: string | null; porAusencia?: boolean },
): Promise<CajaCerrada> {
  const caja = await cajaBloqueada(tx, datos.cajaId);
  exigirAlcance(caja, datos.usuarioId, datos.porAusencia);
  if (caja.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.yaCerrada");
  const { resumen, huella } = await calcularResumen(tx, caja.idCaja);
  if (resumen.efectivo_declarado === null || resumen.diferencia === null || resumen.tipo_diferencia === null) {
    throw new ErrorDeDominio("errores.caja.efectivoNoDeclarado");
  }
  if (huella !== datos.huella) throw new ErrorDeDominio("errores.caja.cambio", { resumen, huella });
  const motivo = datos.motivo?.trim() || null;
  if (resumen.tipo_diferencia !== "CUADRA" && !motivo) throw new ErrorDeDominio("errores.caja.motivoDiferenciaRequerido");
  if (motivo && motivo.length > 300) throw new RangeError("cerrarCaja: motivo de hasta 300 caracteres");
  const momento = ahora();
  const { count } = await tx.caja.updateMany({
    where: { idCaja: caja.idCaja, estado: "ABIERTA" },
    data: {
      estado: "CERRADA", cerradaEl: momento, cerradaPorUsuarioId: datos.usuarioId, cerradaPorActorTipo: "USUARIO",
      porAusencia: Boolean(datos.porAusencia), efectivoEsperado: new Prisma.Decimal(resumen.efectivo_esperado),
      diferencia: new Prisma.Decimal(resumen.diferencia), motivo, resumen: resumen as unknown as Prisma.InputJsonValue,
    },
  });
  if (count === 0) throw new ErrorDeDominio("errores.caja.yaCerrada");
  return {
    caja_id: caja.idCaja, estado: "CERRADA", cerrada_el: momento, diferencia: resumen.diferencia,
    tipo_diferencia: resumen.tipo_diferencia, por_ausencia: Boolean(datos.porAusencia),
  };
}
