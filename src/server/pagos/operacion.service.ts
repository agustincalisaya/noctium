import { Prisma } from "@prisma/client";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { cajaAbiertaDe } from "@/server/pagos/caja.service";
import { emitirComprobante, type ComprobanteEmitido } from "@/server/pagos/comprobante.service";
import { existeFormaPago, verificarFormaPagoActiva } from "@/server/pagos/forma-pago.publico";
import { contarPagosNoAnulados } from "@/server/pagos/pago.vigente";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import type { CodigoErrorDominio } from "@/server/shared/errores-dominio";
import { fechaCentro } from "@/server/shared/fechas-centro";
import { actorUsuario } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";
import {
  clasesConReservasVencidasDelAlumno,
  crearInscripcion,
  exigeInscripcionConPago,
  marcarPagada,
  marcarVencidas,
  marcarVencidasDelAlumno,
  obtenerClasesBasicas,
} from "@/server/turnos/inscripcion.publico";

/**
 * Registro de una operación de pago (PR-0.md §2.3 y §2.13, spec_modulo_I.md
 * §2.7.4 y §2.8). Una operación cobra una o más clases de un mismo alumno: un
 * `Pago` por clase, una `OperacionPago` en la caja abierta de quien registra
 * y un comprobante. Todo en la transacción del llamador.
 *
 * Modos:
 * - `completo` (HU-I-10): la clase no empezó, la reserva no venció, una
 *   clase se paga una sola vez y un monto distinto del precio exige motivo.
 * - `compatSprint2` (permanente, solo `POST /api/pagos`): conserva el
 *   comportamiento de Sprint 2 (admite clase ya iniciada, pagos parciales y
 *   monto sin motivo) y sus códigos; exige caja abierta y emite comprobante.
 */

export type ModoOperacion = "completo" | "compatSprint2";

export type ItemOperacion = (
  | { inscripcionId: string; crearInscripcion?: undefined }
  | { crearInscripcion: { turnoId: string }; inscripcionId?: undefined }
) & {
  /** Monto cobrado de esta clase: texto positivo con hasta 2 decimales. */
  monto: string;
  motivoAjuste?: string | null;
};

export type DatosOperacion = {
  alumnoId: string;
  items: ItemOperacion[];
  formaPagoId: string;
  /** Fecha de pago informada (@db.Date); por defecto, hoy en el centro. */
  fechaPago?: Date;
  usuarioId: string;
  modo: ModoOperacion;
};

export type PagoRegistradoEnOperacion = {
  id: string;
  turnoId: string;
  inscripcionId: string;
  precio: number;
  monto: string;
  motivoAjuste: string | null;
};

export type OperacionRegistrada = {
  operacion: { id: string; alumnoId: string; formaPagoId: string; fechaPago: Date; registradaEl: Date; cajaId: string };
  pagos: PagoRegistradoEnOperacion[];
  comprobante: ComprobanteEmitido;
};

const ESTADOS_COBRABLES = ["DISPONIBLE", "COMPLETO"];

const formatoDia = (fechaIso: string) => `${fechaIso.slice(8, 10)}/${fechaIso.slice(5, 7)}/${fechaIso.slice(0, 4)}`;

export async function registrarOperacion(tx: Tx, datos: DatosOperacion): Promise<OperacionRegistrada> {
  const { alumnoId, usuarioId, modo } = datos;
  const completo = modo === "completo";
  const momento = ahora();
  const actor = actorUsuario(usuarioId);
  if (datos.items.length === 0) throw new RangeError("registrarOperacion: hace falta al menos una clase");

  // 1. Lectura previa sin bloqueo: caja, inscripciones pedidas y clases con reservas vencidas del alumno.
  const caja = await cajaAbiertaDe(tx, usuarioId);
  const idsInscripcion = datos.items.flatMap((item) => (item.inscripcionId ? [item.inscripcionId] : []));
  const inscripcionesPrevias = await tx.turnoAlumno.findMany({
    where: { idInscripcion: { in: idsInscripcion } },
    select: { idInscripcion: true, turnoId: true },
  });
  const turnoDeInscripcion = new Map(inscripcionesPrevias.map((i) => [i.idInscripcion, i.turnoId]));
  const clasesDeItems = datos.items.flatMap((item) => {
    if (item.crearInscripcion) return [item.crearInscripcion.turnoId];
    const turnoId = turnoDeInscripcion.get(item.inscripcionId);
    return turnoId ? [turnoId] : [];
  });
  const clasesVencidas = await clasesConReservasVencidasDelAlumno(tx, alumnoId, momento);

  // 2. Un solo bloqueo en orden canónico: alumno → clases → inscripciones → caja.
  await bloquear(tx, {
    recursos: { alumnos: [alumnoId] },
    clases: [...clasesDeItems, ...clasesVencidas],
    inscripciones: [...turnoDeInscripcion.keys()],
    cajas: caja ? [caja.id] : [],
  });

  // 3. Vencimiento perezoso con las clases ya bloqueadas.
  const clasesExistentes = await obtenerClasesBasicas([...new Set(clasesDeItems)], tx);
  for (const clase of clasesExistentes) await marcarVencidas(tx, clase.turno_id, { momento });
  await marcarVencidasDelAlumno(tx, alumnoId, { momento, clases: clasesVencidas.filter((id) => !clasesDeItems.includes(id)) });

  // 4. Revalidación por ítem (orden de spec_modulo_I.md §2.7.4); el error identifica la clase.
  const materias = new Map((await obtenerMateriasPorIds(clasesExistentes.map((c) => c.materia.id), tx)).map((m) => [m.id, m.nombre]));
  const porCobrar: { item: ItemOperacion; turnoId: string; inscripcionId: string; precio: number; creada: boolean }[] = [];
  for (const item of datos.items) {
    const turnoId = item.crearInscripcion ? item.crearInscripcion.turnoId : turnoDeInscripcion.get(item.inscripcionId);
    const clase = turnoId ? (await obtenerClasesBasicas([turnoId], tx))[0] : undefined;
    const detalle = clase
      ? { turno_id: clase.turno_id, materia: materias.get(clase.materia.id) ?? clase.materia.nombre, fecha: clase.fecha, fecha_dia: formatoDia(clase.fecha) }
      : { turno_id: turnoId ?? null };
    const fallar = (codigo: CodigoErrorDominio, extra: Record<string, unknown> = {}): never => {
      throw new ErrorDeDominio(codigo, { ...detalle, ...extra });
    };
    try {
      if (!item.crearInscripcion && !turnoId) fallar("errores.inscripcion.noEncontrada");
      if (!clase) fallar("errores.turno.noEncontrado");
      if (!ESTADOS_COBRABLES.includes(clase!.estado)) fallar("errores.pago.turnoNoAdmitePago");
      if (item.crearInscripcion) {
        if (clase!.inicio.getTime() <= momento.getTime()) fallar("errores.pago.turnoYaEmpezo");
        if (!(await exigeInscripcionConPago(tx, { turnoId: clase!.turno_id, alumnoId, momento })).exige) fallar("errores.pago.alumnoNoInscripto");
        const creada = await crearInscripcion(tx, {
          turnoId: clase!.turno_id, alumnoId, origen: "PAGO", conReserva: false, actor, bloqueosTomados: true, momento,
        });
        porCobrar.push({ item, turnoId: clase!.turno_id, inscripcionId: creada.inscripcion.id, precio: creada.inscripcion.precio, creada: true });
      } else {
        const inscripcion = await tx.turnoAlumno.findUniqueOrThrow({
          where: { idInscripcion: item.inscripcionId },
          select: { idInscripcion: true, alumnoId: true, vigencia: true, precio: true },
        });
        if (inscripcion.alumnoId !== alumnoId) fallar("errores.pago.alumnoNoInscripto");
        if (completo && clase!.inicio.getTime() <= momento.getTime()) fallar("errores.pago.turnoYaEmpezo");
        if (inscripcion.vigencia === "RESERVA_VENCIDA") fallar(completo ? "errores.pago.reservaVencida" : "errores.pago.alumnoNoInscripto");
        if (inscripcion.vigencia !== "VIGENTE") fallar("errores.pago.alumnoNoInscripto");
        if (completo && (await contarPagosNoAnulados(tx, inscripcion.idInscripcion)) > 0) fallar("errores.pago.inscripcionYaPagada");
        porCobrar.push({ item, turnoId: clase!.turno_id, inscripcionId: inscripcion.idInscripcion, precio: inscripcion.precio, creada: false });
      }
      const ultimo = porCobrar[porCobrar.length - 1]!;
      const difiere = !new Prisma.Decimal(item.monto).equals(ultimo.precio);
      if (completo && difiere && !item.motivoAjuste?.trim()) {
        fallar("errores.pago.motivoAjusteRequerido", { precio_vigente: ultimo.precio });
      }
    } catch (error) {
      // Los errores de crearInscripcion (cupo, superposición, tarifa…) también identifican la clase.
      if (error instanceof ErrorDeDominio && !("turno_id" in (error.datos ?? {}))) {
        throw new ErrorDeDominio(error.codigo, { ...detalle, ...error.datos });
      }
      throw error;
    }
  }

  // 5. Forma y fecha de pago (mismos códigos de Sprint 2).
  const forma = await verificarFormaPagoActiva(datos.formaPagoId, tx);
  if (!forma) {
    throw new ErrorDeDominio((await existeFormaPago(datos.formaPagoId, tx)) ? "errores.formaPago.noDisponible" : "errores.formaPago.noEncontrada");
  }
  const hoy = fechaCentro(momento);
  const fechaPago = datos.fechaPago ?? hoy;
  if (fechaPago.getTime() > hoy.getTime()) throw new ErrorDeDominio("errores.pago.fechaFutura");

  // 6. Caja abierta, revalidada con la caja bloqueada (se informa al final, como en Sprint 2).
  if (!caja) throw new ErrorDeDominio("errores.caja.sinCajaAbierta");
  const cajaActual = await tx.caja.findUnique({ where: { idCaja: caja.id }, select: { estado: true } });
  if (cajaActual?.estado !== "ABIERTA") throw new ErrorDeDominio("errores.caja.cerradaDuranteCobro");

  // 7. Escritura: operación, un pago por clase, estado de pago y comprobante.
  const operacion = await tx.operacionPago.create({
    data: { alumnoId, formaPagoId: datos.formaPagoId, fechaPago, creadoPorUsuarioId: usuarioId, registradaEl: momento, cajaId: caja.id },
  });
  const pagos: PagoRegistradoEnOperacion[] = [];
  for (const { item, turnoId, inscripcionId, precio, creada } of porCobrar) {
    const monto = new Prisma.Decimal(item.monto);
    const ajustado = !monto.equals(precio);
    const motivoAjuste = ajustado ? (item.motivoAjuste?.trim() || null) : null;
    const pago = await tx.pago.create({
      data: {
        turnoId, alumnoId, montoPago: monto, formaPagoId: datos.formaPagoId, fechaPago, createdAtPago: momento,
        creadoPorUsuarioId: usuarioId, operacionId: operacion.idOperacionPago, inscripcionId, precio,
        motivoAjuste, ajustadoPorUsuarioId: ajustado ? usuarioId : null,
      },
    });
    // La inscripción creada al confirmar el pago ya nació PAGADA (origen PAGO).
    if (!creada) await marcarPagada(tx, inscripcionId, await contarPagosNoAnulados(tx, inscripcionId), actor);
    pagos.push({ id: pago.idPago, turnoId, inscripcionId, precio, monto: monto.toFixed(2), motivoAjuste });
  }
  const comprobante = await emitirComprobante(tx, operacion.idOperacionPago);

  return {
    operacion: {
      id: operacion.idOperacionPago, alumnoId, formaPagoId: datos.formaPagoId, fechaPago,
      registradaEl: momento, cajaId: caja.id,
    },
    pagos,
    comprobante,
  };
}
