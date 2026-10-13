import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { cajaAbiertaDe, calcularResumen, type ResumenCaja } from "@/server/pagos/caja.service";
import { INCLUDE_OPERACION_VIGENTE, vigenteDeOperacion } from "@/server/pagos/pago.vigente";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { instanteCentro, isoCentro } from "@/server/shared/fechas-centro";
import { datosCentro } from "@/server/shared/parametros-vigentes";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";
import { obtenerClasesBasicas } from "@/server/turnos/inscripcion.publico";
import type {
  CajaAbiertaFila, CajaPropiaDto, CajasYCierresDto, CierreCajaFila, CierresPaginados, DetalleCierreDto,
  IntegranteCaja, ItemCajaDto, ResumenCierreDto, TipoDiferenciaCaja,
} from "@/types/caja.types";

/**
 * Lecturas de la caja (HU-I-12, spec_modulo_I.md §2.10.2, §2.11 y §2.12):
 * solo lectura, sin bloqueo y sin reglas de negocio propias (Regla N.° 4). El
 * resumen y la huella los arma siempre `calcularResumen` de `caja.service.ts`;
 * acá solo se decide qué se puede ver y se le da forma a la respuesta.
 *
 * Arqueo ciego (criterio 5, §3.14): mientras la caja está abierta ninguna
 * lectura devuelve totales ni el efectivo esperado, salvo `obtenerResumenCierre`
 * una vez declarado el efectivo.
 */

type Db = Tx | typeof prisma;

/** Cierres por página: «Mis cierres» y los del gerente (criterio 11). */
export const POR_PAGINA_CIERRES = 10;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

const fijo = (valor: Prisma.Decimal | string | number) => new Prisma.Decimal(valor).toFixed(2);

/** «dd/mm» de una fecha de calendario AAAA-MM-DD. */
const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** Nombres «Apellido, Nombre» del personal por `usuarioId`. */
async function nombresPorUsuario(db: Db, usuarioIds: string[]): Promise<Map<string, string>> {
  const nombres = await obtenerNombresPersonal(usuarioIds, db);
  return new Map(nombres.map((n) => [n.usuario_id, n.nombre_completo]));
}

/**
 * «Apellido, Nombre · Materia dd/mm» de cada pago pedido, con los datos del
 * alumno y de la clase leídos por las fachadas de B y C (Regla N.° 3).
 */
async function detallesDePagos(db: Db, pagos: { pagoId: string; alumnoId: string; turnoId: string }[]): Promise<Map<string, string>> {
  const [alumnos, clases] = await Promise.all([
    obtenerAlumnosBasicos(pagos.map((p) => p.alumnoId), db),
    obtenerClasesBasicas(pagos.map((p) => p.turnoId), db),
  ]);
  const alumnoPorId = new Map(alumnos.map((a) => [a.id, `${a.apellido}, ${a.nombre}`]));
  const clasePorId = new Map(clases.map((c) => [c.turno_id, `${c.materia.nombre} ${diaMes(c.fecha)}`]));
  return new Map(pagos.map((p) => [
    p.pagoId,
    [alumnoPorId.get(p.alumnoId), clasePorId.get(p.turnoId)].filter(Boolean).join(" · "),
  ]));
}

/**
 * La caja ABIERTA del usuario en arqueo ciego (spec_modulo_I.md §2.10.2): sus
 * cobros (un ítem por pago, con monto y forma vigentes), movimientos y
 * ajustes, del más nuevo al más viejo, con los anulados marcados. Solo montos
 * individuales: ningún total, subtotal ni el efectivo esperado.
 */
export async function obtenerCajaPropia(usuarioId: string, db: Db = prisma): Promise<{ caja: CajaPropiaDto | null }> {
  const abierta = await cajaAbiertaDe(db, usuarioId);
  if (!abierta) return { caja: null };
  const caja = await db.caja.findUniqueOrThrow({ where: { idCaja: abierta.id } });
  const [operaciones, movimientos, ajustes, formas] = await Promise.all([
    db.operacionPago.findMany({ where: { cajaId: caja.idCaja }, include: INCLUDE_OPERACION_VIGENTE }),
    db.movimientoCaja.findMany({ where: { cajaId: caja.idCaja }, include: { anulacion: true } }),
    db.ajusteCaja.findMany({ where: { cajaId: caja.idCaja }, include: { pago: { select: { alumnoId: true, turnoId: true } } } }),
    db.formaPago.findMany({ select: { idFormaPago: true, nombreFormaPago: true } }),
  ]);
  const formaDe = (id: string) => ({ id, nombre: formas.find((f) => f.idFormaPago === id)?.nombreFormaPago ?? id });

  const cobros = operaciones.flatMap((operacion) => {
    const vigente = vigenteDeOperacion(operacion);
    return vigente.pagos.map((pago) => ({ vigente, pago }));
  });
  const detalles = await detallesDePagos(db, [
    ...cobros.map(({ vigente, pago }) => ({ pagoId: pago.pagoId, alumnoId: vigente.alumnoId, turnoId: pago.turnoId })),
    ...ajustes.map((a) => ({ pagoId: a.pagoId, alumnoId: a.pago.alumnoId, turnoId: a.pago.turnoId })),
  ]);

  // `momento` es ISO con el mismo offset y largo: su orden de texto es el cronológico.
  const items: ItemCajaDto[] = [
    ...cobros.map(({ vigente, pago }) => ({
      tipo: "COBRO" as const, id: pago.pagoId, momento: isoCentro(vigente.registradaEl),
      detalle: detalles.get(pago.pagoId) ?? "", forma_pago: formaDe(vigente.formaPagoId), monto: fijo(pago.monto), anulado: pago.anulado,
    })),
    ...movimientos.map((m) => ({
      tipo: "MOVIMIENTO" as const, id: m.idMovimientoCaja, momento: isoCentro(m.createdAtMovimientoCaja),
      detalle: m.concepto, movimiento: m.tipo, monto: fijo(m.monto), anulado: m.anulacion !== null,
    })),
    ...ajustes.map((a) => ({
      tipo: "AJUSTE" as const, id: a.idAjusteCaja, momento: isoCentro(a.createdAtAjusteCaja),
      detalle: detalles.get(a.pagoId) ?? "", origen: a.anulacionPagoId ? "ANULACION" as const : "CORRECCION" as const,
      forma_pago: formaDe(a.formaPagoId), monto: fijo(a.monto), anulado: false as const,
    })),
  ];
  items.sort((a, b) => (a.momento === b.momento ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.momento < b.momento ? 1 : -1));

  return {
    caja: {
      id: caja.idCaja,
      abierta_el: isoCentro(caja.abiertaEl),
      fondo_inicial: fijo(caja.fondoInicial),
      efectivo_declarado: caja.efectivoDeclarado === null ? null : fijo(caja.efectivoDeclarado),
      items,
    },
  };
}

/**
 * Paso 2 del cierre (spec_modulo_I.md §2.11): el resumen actualizado y su
 * huella, recién cuando el efectivo ya está declarado (si no,
 * EFECTIVO_NO_DECLARADO: nadie ve el esperado antes de declarar). Sin
 * `cajaId`, la caja abierta propia; con `cajaId`, el cierre por ausencia del
 * gerente sobre la caja abierta de OTRO integrante (§2.12).
 */
export async function obtenerResumenCierre(
  datos: { usuarioId: string; cajaId?: string },
  db: Db = prisma,
): Promise<ResumenCierreDto> {
  let caja: { idCaja: string; usuarioId: string; estado: string; abiertaEl: Date; efectivoDeclarado: Prisma.Decimal | null } | null;
  if (datos.cajaId === undefined) {
    const abierta = await cajaAbiertaDe(db, datos.usuarioId);
    if (!abierta) throw new ErrorDeDominio("errores.caja.sinCajaAbierta");
    caja = await db.caja.findUnique({ where: { idCaja: abierta.id } });
  } else {
    caja = await db.caja.findUnique({ where: { idCaja: datos.cajaId } });
    if (!caja) throw new ErrorDeDominio("errores.caja.noEncontrada");
    if (caja.usuarioId === datos.usuarioId) throw new ErrorDeDominio("errores.caja.fueraDeAlcance");
  }
  if (!caja) throw new ErrorDeDominio("errores.caja.noEncontrada");
  if (caja.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.yaCerrada");
  if (caja.efectivoDeclarado === null) throw new ErrorDeDominio("errores.caja.efectivoNoDeclarado");
  return conIntegrante(db, caja, await calcularResumen(db, caja.idCaja));
}

/** Arma la respuesta del paso 2 (la usan la lectura y la declaración). */
export async function conIntegrante(
  db: Db,
  caja: { idCaja: string; usuarioId: string; abiertaEl: Date },
  { resumen, huella }: { resumen: ResumenCaja; huella: string },
): Promise<ResumenCierreDto> {
  const nombres = await nombresPorUsuario(db, [caja.usuarioId]);
  return {
    caja_id: caja.idCaja,
    abierta_el: isoCentro(caja.abiertaEl),
    integrante: { id: caja.usuarioId, nombre_completo: nombres.get(caja.usuarioId) ?? null },
    resumen,
    huella,
  };
}

type CajaCerradaFila = Prisma.CajaGetPayload<object>;

function filaDeCierre(caja: CajaCerradaFila, nombres: Map<string, string>): CierreCajaFila {
  const diferencia = new Prisma.Decimal(caja.diferencia ?? 0);
  const tipo: TipoDiferenciaCaja = diferencia.isZero() ? "CUADRA" : diferencia.isPositive() ? "SOBRANTE" : "FALTANTE";
  const integrante = (id: string): IntegranteCaja => ({ id, nombre_completo: nombres.get(id) ?? null });
  return {
    id: caja.idCaja,
    integrante: integrante(caja.usuarioId),
    abierta_el: isoCentro(caja.abiertaEl),
    cerrada_el: isoCentro(caja.cerradaEl!),
    fondo_inicial: fijo(caja.fondoInicial),
    efectivo_esperado: fijo(caja.efectivoEsperado ?? 0),
    efectivo_declarado: fijo(caja.efectivoDeclarado ?? 0),
    diferencia: diferencia.toFixed(2),
    tipo_diferencia: tipo,
    motivo: caja.motivo,
    por_ausencia: caja.porAusencia,
    cerrada_por: caja.porAusencia && caja.cerradaPorUsuarioId ? integrante(caja.cerradaPorUsuarioId) : null,
  };
}

/**
 * Cierres paginados de a 10, más nuevos primero. Una página fuera de rango se
 * lleva a la última; sin resultados, página 1 y 0 páginas (criterio de HU-F-03).
 */
async function cierresPaginados(db: Db, where: Prisma.CajaWhereInput, paginaPedida: number): Promise<CierresPaginados> {
  const filtro: Prisma.CajaWhereInput = { ...where, estado: "CERRADA" };
  const total = await db.caja.count({ where: filtro });
  const totalPaginas = Math.ceil(total / POR_PAGINA_CIERRES);
  const pagina = total === 0 ? 1 : Math.min(paginaPedida, totalPaginas);
  const cajas = await db.caja.findMany({
    where: filtro,
    orderBy: [{ cerradaEl: "desc" }, { idCaja: "desc" }],
    skip: (pagina - 1) * POR_PAGINA_CIERRES,
    take: POR_PAGINA_CIERRES,
  });
  const nombres = await nombresPorUsuario(db, cajas.flatMap((c) => [c.usuarioId, ...(c.cerradaPorUsuarioId ? [c.cerradaPorUsuarioId] : [])]));
  return {
    items: cajas.map((c) => filaDeCierre(c, nombres)),
    paginacion: { total, pagina_actual: pagina, total_paginas: totalPaginas, por_pagina: POR_PAGINA_CIERRES },
  };
}

/** «Mis cierres» (spec_modulo_I.md §2.12): los cierres del propio integrante. */
export async function listarMisCierres(usuarioId: string, pagina: number, db: Db = prisma): Promise<CierresPaginados> {
  return cierresPaginados(db, { usuarioId }, pagina);
}

/**
 * Listado del gerente (spec_modulo_I.md §2.12, criterios 10 y 11): todas las
 * cajas abiertas con su antigüedad (sin su contenido: el arqueo es ciego
 * también para él) y los cierres paginados, filtrados por integrante y por
 * rango de fechas de CIERRE (DEC-30), en días del centro e inclusivos.
 */
export async function listarCajasYCierres(
  filtros: { integranteId?: string; desde?: string; hasta?: string; pagina: number },
  db: Db = prisma,
): Promise<CajasYCierresDto> {
  const cerradaEl: Prisma.DateTimeNullableFilter = {};
  if (filtros.desde) cerradaEl.gte = instanteCentro(filtros.desde);
  if (filtros.hasta) cerradaEl.lt = new Date(instanteCentro(filtros.hasta).getTime() + UN_DIA_MS);
  const where: Prisma.CajaWhereInput = {
    ...(filtros.integranteId ? { usuarioId: filtros.integranteId } : {}),
    ...(filtros.desde || filtros.hasta ? { cerradaEl } : {}),
  };

  const [abiertas, cierres] = await Promise.all([
    db.caja.findMany({ where: { estado: "ABIERTA" }, orderBy: [{ abiertaEl: "asc" }, { idCaja: "asc" }] }),
    cierresPaginados(db, where, filtros.pagina),
  ]);
  const nombres = await nombresPorUsuario(db, abiertas.map((c) => c.usuarioId));
  const momento = ahora();
  return {
    abiertas: abiertas.map((c): CajaAbiertaFila => ({
      id: c.idCaja,
      integrante: { id: c.usuarioId, nombre_completo: nombres.get(c.usuarioId) ?? null },
      abierta_el: isoCentro(c.abiertaEl),
      antiguedad_minutos: Math.max(0, Math.floor((momento.getTime() - c.abiertaEl.getTime()) / 60000)),
    })),
    cierres,
  };
}

/**
 * Integrantes con alguna caja (abierta o cerrada), para el filtro del
 * gerente: incluye a los que ya no están activos pero tienen cierres. Se
 * arma desde las cajas y los nombres de la fachada de F (Regla N.° 3).
 */
export async function listarIntegrantesConCaja(db: Db = prisma): Promise<IntegranteCaja[]> {
  const filas = await db.caja.findMany({ distinct: ["usuarioId"], select: { usuarioId: true } });
  const nombres = await nombresPorUsuario(db, filas.map((f) => f.usuarioId));
  return filas
    .map((f) => ({ id: f.usuarioId, nombre_completo: nombres.get(f.usuarioId) ?? null }))
    .sort((a, b) => (a.nombre_completo ?? a.id).localeCompare(b.nombre_completo ?? b.id, "es"));
}

/**
 * Detalle de un cierre (spec_modulo_I.md §2.12): el `resumen` TAL COMO quedó
 * al cerrar (nunca se recalcula, criterio 8), quién lo cerró y si fue por
 * ausencia, y los datos del centro para «Imprimir». Mesa de entrada solo ve
 * los suyos (FUERA_DE_ALCANCE); una caja abierta no tiene cierre que mostrar
 * (CAJA_NO_CERRADA, el arqueo es ciego).
 */
export async function obtenerDetalleCierre(
  cajaId: string,
  alcance: { usuarioId: string; esGerente: boolean },
  db: Db = prisma,
): Promise<DetalleCierreDto> {
  const caja = await db.caja.findUnique({ where: { idCaja: cajaId } });
  if (!caja) throw new ErrorDeDominio("errores.caja.noEncontrada");
  if (!alcance.esGerente && caja.usuarioId !== alcance.usuarioId) throw new ErrorDeDominio("errores.caja.fueraDeAlcance");
  if (caja.estado !== "CERRADA" || caja.resumen === null) throw new ErrorDeDominio("errores.caja.noCerrada");
  const [nombres, centro] = await Promise.all([
    nombresPorUsuario(db, [caja.usuarioId, ...(caja.cerradaPorUsuarioId ? [caja.cerradaPorUsuarioId] : [])]),
    datosCentro(db),
  ]);
  return { ...filaDeCierre(caja, nombres), resumen: caja.resumen as unknown as ResumenCaja, centro };
}
