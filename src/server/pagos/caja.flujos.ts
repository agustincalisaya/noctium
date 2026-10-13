import type { PrismaClient } from "@prisma/client";
import {
  abrirCaja, anularMovimiento, cajaAbiertaDe, cerrarCaja, declararEfectivo, registrarMovimiento, type CajaCerrada,
} from "@/server/pagos/caja.service";
import { conIntegrante } from "@/server/pagos/caja.lecturas";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { isoCentro } from "@/server/shared/fechas-centro";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import type { CajaCerradaDto, MovimientoCajaDto, ResumenCierreDto } from "@/types/caja.types";

/**
 * Flujos HTTP de la caja (HU-I-12 y HU-I-12-b, spec_modulo_I.md §2.10.1,
 * §2.10.3, §2.10.4, §2.11 y §2.12):
 * cada uno abre su `transaccion()`, resuelve qué caja corresponde (la abierta
 * del usuario, o la del integrante en el cierre por ausencia) y llama al
 * servicio del PR 0, que es el dueño de todas las reglas (bloqueo, alcance,
 * declaración única, huella, motivo y cierre condicional). Mismo patrón que
 * `registrarOperacionDePago`. `caja.service.ts` no se modifica.
 *
 * `db` solo lo pasan las pruebas con PostgreSQL real.
 */

type Opciones = { db?: PrismaClient };

/** Abre la caja propia con su fondo inicial (§2.10.1). */
export async function abrirMiCaja(
  usuarioId: string,
  fondoInicial: string,
  opciones: Opciones = {},
): Promise<{ id: string; abierta_el: string; fondo_inicial: string }> {
  const caja = await transaccion((tx) => abrirCaja(tx, { usuarioId, fondoInicial }), opciones);
  return { id: caja.id, abierta_el: isoCentro(caja.abiertaEl), fondo_inicial: caja.fondoInicial };
}

/** La caja abierta del usuario, leída dentro de la transacción; el servicio la bloquea y la revalida. */
async function cajaAbiertaPropia(tx: Tx, usuarioId: string, siNoHay: "errores.caja.sinCajaAbierta" | "errores.caja.yaCerrada") {
  const caja = await cajaAbiertaDe(tx, usuarioId);
  if (!caja) throw new ErrorDeDominio(siNoHay);
  return caja;
}

/** La caja de otro integrante para el cierre por ausencia: existe y sigue abierta (el servicio lo revalida bloqueada). */
async function cajaParaAusencia(tx: Tx, cajaId: string) {
  const caja = await tx.caja.findUnique({ where: { idCaja: cajaId }, select: { idCaja: true, usuarioId: true, estado: true, abiertaEl: true } });
  if (!caja) throw new ErrorDeDominio("errores.caja.noEncontrada");
  if (caja.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.yaCerrada");
  return caja;
}

/**
 * Registra un ingreso o egreso manual en la caja abierta propia (§2.10.3,
 * HU-I-12-b). El servicio bloquea la caja, revalida que siga abierta y, en un
 * egreso, compara con el efectivo esperado dentro de esta misma transacción.
 */
export async function registrarMiMovimiento(
  usuarioId: string,
  datos: { tipo: "INGRESO" | "EGRESO"; monto: string; concepto: string },
  opciones: Opciones = {},
): Promise<MovimientoCajaDto> {
  const movimiento = await transaccion(async (tx) => {
    const abierta = await cajaAbiertaPropia(tx, usuarioId, "errores.caja.sinCajaAbierta");
    return registrarMovimiento(tx, { cajaId: abierta.id, usuarioId, ...datos });
  }, opciones);
  return { ...movimiento, momento: isoCentro(movimiento.momento) };
}

/**
 * Anula un movimiento de la caja abierta propia con un registro nuevo
 * (§2.10.4, HU-I-12-b; Regla N.° 8). El alcance (que sea de la caja propia,
 * si no 404) y que la caja siga abierta los decide el servicio.
 */
export async function anularMiMovimiento(
  usuarioId: string,
  movimientoId: string,
  motivo: string,
  opciones: Opciones = {},
): Promise<{ id: string }> {
  return transaccion((tx) => anularMovimiento(tx, { movimientoId, usuarioId, motivo }), opciones);
}

const respuestaCierre = (cerrada: CajaCerrada): CajaCerradaDto => ({ ...cerrada, cerrada_el: isoCentro(cerrada.cerrada_el) });

/** Paso 1 del cierre propio (§2.11): declara el efectivo contado y devuelve el resumen del paso 2. */
export async function declararMiEfectivo(usuarioId: string, efectivoDeclarado: string, opciones: Opciones = {}): Promise<ResumenCierreDto> {
  return transaccion(async (tx) => {
    const abierta = await cajaAbiertaPropia(tx, usuarioId, "errores.caja.sinCajaAbierta");
    const resultado = await declararEfectivo(tx, { cajaId: abierta.id, usuarioId, efectivoDeclarado });
    return conIntegrante(tx, { idCaja: abierta.id, usuarioId, abiertaEl: abierta.abiertaEl }, resultado);
  }, opciones);
}

/**
 * Paso 2 del cierre propio (§2.11). Si la caja ya no está abierta (por
 * ejemplo, el gerente la cerró por ausencia mientras tanto), CAJA_YA_CERRADA.
 */
export async function cerrarMiCaja(
  usuarioId: string,
  datos: { huella: string; motivo?: string },
  opciones: Opciones = {},
): Promise<CajaCerradaDto> {
  const cerrada = await transaccion(async (tx) => {
    const abierta = await cajaAbiertaPropia(tx, usuarioId, "errores.caja.yaCerrada");
    return cerrarCaja(tx, { cajaId: abierta.id, usuarioId, huella: datos.huella, motivo: datos.motivo });
  }, opciones);
  return respuestaCierre(cerrada);
}

/** Paso 1 del cierre por ausencia (§2.12): el gerente declara el efectivo de la caja de otro integrante. */
export async function declararPorAusencia(
  gerenteId: string,
  cajaId: string,
  efectivoDeclarado: string,
  opciones: Opciones = {},
): Promise<ResumenCierreDto> {
  return transaccion(async (tx) => {
    const caja = await cajaParaAusencia(tx, cajaId);
    const resultado = await declararEfectivo(tx, { cajaId, usuarioId: gerenteId, efectivoDeclarado, porAusencia: true });
    return conIntegrante(tx, caja, resultado);
  }, opciones);
}

/** Paso 2 del cierre por ausencia (§2.12): queda `porAusencia` con el gerente como responsable. */
export async function cerrarPorAusencia(
  gerenteId: string,
  cajaId: string,
  datos: { huella: string; motivo?: string },
  opciones: Opciones = {},
): Promise<CajaCerradaDto> {
  const cerrada = await transaccion(async (tx) => {
    await cajaParaAusencia(tx, cajaId);
    return cerrarCaja(tx, { cajaId, usuarioId: gerenteId, huella: datos.huella, motivo: datos.motivo, porAusencia: true });
  }, opciones);
  return respuestaCierre(cerrada);
}
