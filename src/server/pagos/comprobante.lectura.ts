import { Prisma } from "@prisma/client";
import { ComprobanteDatosSchema, formatearNumeroComprobante } from "@/server/pagos/comprobante.schema";
import { INCLUDE_OPERACION_VIGENTE, vigenteDeOperacion } from "@/server/pagos/pago.vigente";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { fechaCentro, isoCentro } from "@/server/shared/fechas-centro";
import type { ComprobanteLeido } from "@/types/pago.types";

/**
 * Lectura de comprobantes para mostrarlos (spec_modulo_I.md §2.9.3/2.9.4).
 * Nunca emite ni modifica nada (Regla N.° 8): las marcas «ANULADO»,
 * «Reemplazado por» y «reemplaza a» se DERIVAN acá, nunca se guardan en
 * `Comprobante`. Los datos mostrados son la copia fija de `Comprobante.datos`.
 */

type Db = Prisma.TransactionClient;

/** Operación con su valor vigente y sus comprobantes, más reciente primero. */
export const INCLUDE_LECTURA = {
  ...INCLUDE_OPERACION_VIGENTE,
  comprobantes: {
    orderBy: { numero: "desc" },
    select: { idComprobante: true, numero: true, datos: true, reemplazadoPor: { select: { idComprobante: true } } },
  },
} satisfies Prisma.OperacionPagoInclude;
export type OperacionLeida = Prisma.OperacionPagoGetPayload<{ include: typeof INCLUDE_LECTURA }>;

/**
 * Comprobante vigente para un pago (spec_modulo_I.md §2.13.1): el que nadie
 * reemplazó; para un pago anulado, el último que lo incluyó.
 */
export function comprobanteDelPagoEnOperacion(operacion: OperacionLeida, pagoId: string, anulado: boolean) {
  const comprobante = anulado
    ? operacion.comprobantes.find((c) => ((c.datos as { clases?: { pago_id: string }[] }).clases ?? []).some((clase) => clase.pago_id === pagoId))
    : operacion.comprobantes.find((c) => c.reemplazadoPor === null);
  return comprobante ? { id: comprobante.idComprobante, numero: formatearNumeroComprobante(comprobante.numero) } : null;
}

/**
 * Comprobante de un pago para `GET /api/pagos/[id]/comprobante` (§2.9.3).
 * Lanza `errores.pago.noEncontrado` si el pago no existe; un pago sin
 * comprobante es una inconsistencia (`registrarOperacion` siempre emite uno)
 * y se informa como error, no como «no encontrado».
 */
export async function comprobanteDelPago(db: Db, pagoId: string): Promise<{ id: string; numero: string }> {
  const pago = await db.pago.findUnique({
    where: { idPago: pagoId },
    select: { anulacion: { select: { idAnulacionPago: true } }, operacion: { include: INCLUDE_LECTURA } },
  });
  if (!pago) throw new ErrorDeDominio("errores.pago.noEncontrado");
  const comprobante = comprobanteDelPagoEnOperacion(pago.operacion, pagoId, pago.anulacion !== null);
  if (!comprobante) throw new Error(`El pago ${pagoId} no tiene comprobante`);
  return comprobante;
}

const SELECT_COMPROBANTE = {
  idComprobante: true,
  numero: true,
  datos: true,
  emitidoEl: true,
  reemplazaA: { select: { numero: true } },
  reemplazadoPor: { select: { idComprobante: true, numero: true } },
  operacion: { include: INCLUDE_OPERACION_VIGENTE },
} satisfies Prisma.ComprobanteSelect;
type ComprobanteConOperacion = Prisma.ComprobanteGetPayload<{ select: typeof SELECT_COMPROBANTE }>;

/**
 * «ANULADO» (§2.9.4): solo en el comprobante vigente, cuando todos los pagos
 * de su operación están anulados; fecha y motivo de la última anulación.
 */
function marcaAnulado(comprobante: ComprobanteConOperacion): { fecha: string; motivo: string } | null {
  if (comprobante.reemplazadoPor) return null;
  const { pagos } = vigenteDeOperacion(comprobante.operacion);
  if (pagos.length === 0 || pagos.some((pago) => !pago.anulado)) return null;
  const ultima = pagos
    .map((pago) => pago.anulacion!)
    .reduce((a, b) => (b.fecha.getTime() > a.fecha.getTime() ? b : a));
  return { fecha: fechaCentro(ultima.fecha).toISOString().slice(0, 10), motivo: ultima.motivo };
}

/** Vista completa (mesa de entrada / gerente), sin decidir quién la ve. */
function armarVista(comprobante: ComprobanteConOperacion): ComprobanteLeido {
  const datos = ComprobanteDatosSchema.parse(comprobante.datos);
  return {
    id: comprobante.idComprobante,
    numero: formatearNumeroComprobante(comprobante.numero),
    emitido_el: isoCentro(comprobante.emitidoEl),
    centro: datos.centro,
    alumno: { nombre_completo: `${datos.alumno.apellido}, ${datos.alumno.nombre}`, dni: datos.alumno.dni },
    fecha_pago: datos.fecha_pago,
    forma_pago: { nombre: datos.forma_pago.nombre },
    registrado_por: datos.registrado_por.nombre_completo,
    clases: datos.clases.map((clase) => ({ materia: clase.materia.nombre, fecha: clase.fecha, hora_inicio: clase.hora_inicio, monto: clase.monto })),
    total: datos.total,
    marcas: {
      anulado: marcaAnulado(comprobante),
      reemplazado_por: comprobante.reemplazadoPor
        ? { id: comprobante.reemplazadoPor.idComprobante, numero: formatearNumeroComprobante(comprobante.reemplazadoPor.numero) }
        : null,
      reemplaza_a: comprobante.reemplazaA ? { numero: formatearNumeroComprobante(comprobante.reemplazaA.numero) } : null,
    },
  };
}

/** Vista completa (mesa de entrada / gerente, §2.9.3), o `null` si no existe. */
export async function leerComprobante(db: Db, comprobanteId: string): Promise<ComprobanteLeido | null> {
  const comprobante = await db.comprobante.findUnique({ where: { idComprobante: comprobanteId }, select: SELECT_COMPROBANTE });
  return comprobante ? armarVista(comprobante) : null;
}

/**
 * Vista del alumno (§2.9.3, HU-I-11 criterios 2 y 5): sin `registrado_por`
 * (se reemplaza por `registrado_en_el_centro: true`) y sin el motivo de la
 * anulación; los omite el servidor, así no llegan al navegador. Lanza
 * `errores.pago.fueraDeAlcance` si el comprobante es de otro alumno.
 */
export async function leerComprobanteDeAlumno(db: Db, comprobanteId: string, alumnoId: string): Promise<ComprobanteLeido | null> {
  const comprobante = await db.comprobante.findUnique({ where: { idComprobante: comprobanteId }, select: SELECT_COMPROBANTE });
  if (!comprobante) return null;
  if (comprobante.operacion.alumnoId !== alumnoId) throw new ErrorDeDominio("errores.pago.fueraDeAlcance");
  const vista = armarVista(comprobante);
  delete vista.registrado_por;
  const { marcas } = vista;
  return {
    ...vista,
    registrado_en_el_centro: true,
    marcas: { ...marcas, anulado: marcas.anulado ? { fecha: marcas.anulado.fecha } : null },
  };
}
