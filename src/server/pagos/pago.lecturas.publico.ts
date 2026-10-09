import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { formatearNumeroComprobante } from "@/server/pagos/comprobante.schema";
import {
  INCLUDE_OPERACION_VIGENTE,
  sqlFechaPagoVigente,
  sqlMontoVigente,
  sqlPagoNoAnulado,
  vigenteDeOperacion,
  type OperacionConVigente,
} from "@/server/pagos/pago.vigente";

/**
 * Lecturas públicas de pagos del módulo I con el valor vigente (spec_modulo_I.md
 * §2.17, R3-PR0-I11). Solo lectura, sin bloqueo y sin permisos (los valida la
 * ruta del consumidor). Comparten una sola implementación del valor vigente
 * (`pago.vigente.ts`).
 *
 * Etapa 3: `listarPagosDeTurno` y `sumarPagosPorMes` de `pago.publico.ts`
 * (Sprint 2) pasan a ser las versiones con valor vigente de este archivo
 * (`listarPagosDeTurnoVigente`, `sumarPagosPorMesVigente`), con la misma firma
 * y la misma forma del resultado; después este archivo se consolida en
 * `pago.publico.ts`.
 */

type Db = Prisma.TransactionClient;

const INCLUDE_LECTURA = {
  ...INCLUDE_OPERACION_VIGENTE,
  comprobantes: {
    orderBy: { numero: "desc" },
    select: { idComprobante: true, numero: true, datos: true, reemplazadoPor: { select: { idComprobante: true } } },
  },
} satisfies Prisma.OperacionPagoInclude;
type OperacionLeida = Prisma.OperacionPagoGetPayload<{ include: typeof INCLUDE_LECTURA }>;

async function formasPorId(db: Db, ids: string[]) {
  const formas = await db.formaPago.findMany({
    where: { idFormaPago: { in: [...new Set(ids)] } },
    select: { idFormaPago: true, nombreFormaPago: true, activaFormaPago: true },
  });
  return new Map(formas.map((f) => [f.idFormaPago, { id: f.idFormaPago, nombre: f.nombreFormaPago, is_active: f.activaFormaPago }]));
}

/**
 * Comprobante vigente para un pago (spec_modulo_I.md §2.13.1): el que nadie
 * reemplazó; para un pago anulado, el último que lo incluyó.
 */
function comprobanteDelPago(operacion: OperacionLeida, pagoId: string, anulado: boolean) {
  const comprobante = anulado
    ? operacion.comprobantes.find((c) => ((c.datos as { clases?: { pago_id: string }[] }).clases ?? []).some((clase) => clase.pago_id === pagoId))
    : operacion.comprobantes.find((c) => c.reemplazadoPor === null);
  return comprobante ? { id: comprobante.idComprobante, numero: formatearNumeroComprobante(comprobante.numero) } : null;
}

export type PagoDeAlumno = {
  pago_id: string;
  turno_id: string;
  inscripcion_id: string;
  operacion_id: string;
  monto: string;
  monto_original: string | null;
  precio: number;
  motivo_ajuste: string | null;
  ajustado_por: string | null;
  forma_pago: { id: string; nombre: string; is_active: boolean };
  fecha_pago: string;
  registrado_en: string;
  registrado_por: string;
  anulado: boolean;
  anulacion: { fecha: string; motivo: string } | null;
  comprobante_vigente: { id: string; numero: string } | null;
  cambios: number;
  clases_de_la_operacion: number;
};

async function pagosDeOperaciones(db: Db, operaciones: OperacionLeida[], filtroPago: (pagoId: string, turnoId: string) => boolean): Promise<PagoDeAlumno[]> {
  const vigentes = operaciones.map((operacion) => ({ operacion, vigente: vigenteDeOperacion(operacion as OperacionConVigente) }));
  const formas = await formasPorId(db, vigentes.map((v) => v.vigente.formaPagoId));
  const items: PagoDeAlumno[] = [];
  for (const { operacion, vigente } of vigentes) {
    const clases = vigente.pagos.filter((p) => !p.anulado).length;
    for (const pago of vigente.pagos) {
      if (!filtroPago(pago.pagoId, pago.turnoId)) continue;
      items.push({
        pago_id: pago.pagoId,
        turno_id: pago.turnoId,
        inscripcion_id: pago.inscripcionId,
        operacion_id: vigente.operacionId,
        monto: pago.monto.toFixed(2),
        monto_original: pago.corregido ? pago.montoOriginal.toFixed(2) : null,
        precio: pago.precio,
        motivo_ajuste: pago.motivoAjuste,
        ajustado_por: pago.ajustadoPorUsuarioId,
        forma_pago: formas.get(vigente.formaPagoId) ?? { id: vigente.formaPagoId, nombre: vigente.formaPagoId, is_active: false },
        fecha_pago: vigente.fechaPago.toISOString().slice(0, 10),
        registrado_en: pago.registradoEn.toISOString(),
        registrado_por: vigente.registradaPorUsuarioId,
        anulado: pago.anulado,
        anulacion: pago.anulacion ? { fecha: pago.anulacion.fecha.toISOString(), motivo: pago.anulacion.motivo } : null,
        comprobante_vigente: comprobanteDelPago(operacion, pago.pagoId, pago.anulado),
        cambios: pago.cambios,
        clases_de_la_operacion: clases,
      });
    }
  }
  return items;
}

const ordenFechaYRegistro = (a: PagoDeAlumno, b: PagoDeAlumno) =>
  b.fecha_pago.localeCompare(a.fecha_pago) || b.registrado_en.localeCompare(a.registrado_en) || b.pago_id.localeCompare(a.pago_id);

/**
 * Pagos del alumno como pagador, en cualquier clase (incluidas aquellas de
 * las que fue quitado), sin paginar, con monto vigente y los anulados
 * incluidos. `desde`/`hasta` (AAAA-MM-DD, inclusivos) filtran por la fecha de
 * pago vigente y `formaPagoId` por la forma vigente; `turnoIds` lo usa el
 * servicio para el filtro por materia. Orden: fecha de pago y momento de
 * registro descendentes.
 */
export async function listarPagosDeAlumno(
  alumnoId: string,
  filtros: { desde?: string; hasta?: string; formaPagoId?: string; turnoIds?: string[] } = {},
  db: Db = prisma,
): Promise<PagoDeAlumno[]> {
  const operaciones = await db.operacionPago.findMany({ where: { alumnoId }, include: INCLUDE_LECTURA });
  const turnos = filtros.turnoIds ? new Set(filtros.turnoIds) : null;
  const items = await pagosDeOperaciones(db, operaciones, (_pagoId, turnoId) => !turnos || turnos.has(turnoId));
  return items
    .filter((p) => (!filtros.desde || p.fecha_pago >= filtros.desde) && (!filtros.hasta || p.fecha_pago <= filtros.hasta))
    .filter((p) => !filtros.formaPagoId || p.forma_pago.id === filtros.formaPagoId)
    .sort(ordenFechaYRegistro);
}

export type PagoDeClase = {
  id: string;
  alumno: { id: string; nombre_completo: string };
  monto: string;
  forma_pago: { id: string; nombre: string };
  fecha_pago: string;
  registrado_en: string;
  inscripcion_id: string;
  operacion_id: string;
  anulado: boolean;
  anulacion: { fecha: string; motivo: string } | null;
  comprobante_vigente: { id: string; numero: string } | null;
  cambios: number;
  clases_de_la_operacion: number;
};

async function pagosDeClase(turnoId: string, db: Db): Promise<PagoDeClase[]> {
  const operaciones = await db.operacionPago.findMany({ where: { pagos: { some: { turnoId } } }, include: INCLUDE_LECTURA });
  const items = await pagosDeOperaciones(db, operaciones, (_pagoId, pagoTurnoId) => pagoTurnoId === turnoId);
  const alumnoDePago = new Map(operaciones.flatMap((o) => o.pagos.map((p) => [p.idPago, p.alumnoId] as const)));
  const alumnos = new Map((await obtenerAlumnosBasicos([...new Set(alumnoDePago.values())], db)).map((a) => [a.id, `${a.apellido}, ${a.nombre}`]));
  return items
    .sort((a, b) => b.registrado_en.localeCompare(a.registrado_en) || b.pago_id.localeCompare(a.pago_id))
    .map((p) => {
      const alumnoId = alumnoDePago.get(p.pago_id)!;
      return {
        id: p.pago_id,
        alumno: { id: alumnoId, nombre_completo: alumnos.get(alumnoId) ?? alumnoId },
        monto: p.monto,
        forma_pago: { id: p.forma_pago.id, nombre: p.forma_pago.nombre },
        fecha_pago: p.fecha_pago,
        registrado_en: p.registrado_en,
        inscripcion_id: p.inscripcion_id,
        operacion_id: p.operacion_id,
        anulado: p.anulado,
        anulacion: p.anulacion,
        comprobante_vigente: p.comprobante_vigente,
        cambios: p.cambios,
        clases_de_la_operacion: p.clases_de_la_operacion,
      };
    });
}

/** Pagos de la clase con los anulados incluidos y los campos de HU-I-06 (spec_modulo_I.md §2.17). Mismo orden que `listarPagosDeTurno`. */
export async function listarPagosDeClase(turnoId: string, db: Db = prisma): Promise<PagoDeClase[]> {
  return pagosDeClase(turnoId, db);
}

/**
 * Versión con valor vigente de `listarPagosDeTurno` (Sprint 2): misma forma
 * (`PagoDeTurno`), sin los pagos anulados y con monto, forma y fecha vigentes.
 */
export async function listarPagosDeTurnoVigente(
  turnoId: string,
  db: Db = prisma,
): Promise<{ id: string; alumno: { id: string; nombre_completo: string }; monto: string; forma_pago: { id: string; nombre: string }; fecha_pago: string; registrado_en: string }[]> {
  return (await pagosDeClase(turnoId, db))
    .filter((p) => !p.anulado)
    .map(({ id, alumno, monto, forma_pago, fecha_pago, registrado_en }) => ({ id, alumno, monto, forma_pago, fecha_pago, registrado_en }));
}

/**
 * Versión con valor vigente de `sumarPagosPorMes` (Sprint 2): misma firma y
 * forma (`{ mes, total }[]`, `total` texto decimal exacto). Suma el monto
 * vigente de los pagos no anulados por el mes de la fecha de pago vigente.
 */
export async function sumarPagosPorMesVigente(desde: string, hasta: string, db: Db = prisma): Promise<{ mes: string; total: string }[]> {
  const fin = new Date(`${hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const hastaExclusivo = fin.toISOString().slice(0, 10);
  return db.$queryRaw<{ mes: string; total: string }[]>(Prisma.sql`
    SELECT to_char(v.fecha, 'YYYY-MM') AS mes, SUM(v.monto)::text AS total
    FROM (
      SELECT ${sqlFechaPagoVigente("p")} AS fecha, ${sqlMontoVigente("p")} AS monto
      FROM "pagos" p WHERE ${sqlPagoNoAnulado("p")}
    ) v
    WHERE v.fecha >= CAST(${`${desde}-01`} AS date) AND v.fecha < CAST(${hastaExclusivo} AS date)
    GROUP BY to_char(v.fecha, 'YYYY-MM')
    ORDER BY mes`);
}

/**
 * `true` si el usuario figura como actor de algún registro de I: operación
 * de pago, corrección, anulación, caja (propia o cerrada por él), movimiento,
 * anulación de movimiento o ajuste (spec_modulo_F.md §2.7, DEC-39). Lectura
 * de existencia, sin bloqueo.
 */
export async function usuarioRegistroOperaciones(tx: Db, usuarioId: string): Promise<boolean> {
  const [fila] = await tx.$queryRaw<{ registro: boolean }[]>(Prisma.sql`
    SELECT (
      EXISTS (SELECT 1 FROM "operaciones_pago" WHERE "creadoPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "correcciones_pago" WHERE "creadoPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "correcciones_operacion" WHERE "creadoPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "anulaciones_pago" WHERE "creadoPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "cajas" WHERE "usuarioId" = ${usuarioId} OR "cerradaPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "movimientos_caja" WHERE "creadoPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "anulaciones_movimiento" WHERE "creadoPorUsuarioId" = ${usuarioId})
      OR EXISTS (SELECT 1 FROM "ajustes_caja" WHERE "creadoPorUsuarioId" = ${usuarioId})
    ) AS registro`);
  return Boolean(fila?.registro);
}
