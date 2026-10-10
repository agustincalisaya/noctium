import { Prisma } from "@prisma/client";
import { hoyEnZonaCentro } from "@/lib/calendario-semana";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnosInscriptosDeTurno } from "@/server/turnos/turno.publico";
import {
  exigeInscripcionConPago,
  inscripcionVigenteDelPar,
  listarInscripcionesPendientesDePagoDeAlumno,
  obtenerClasesBasicas,
} from "@/server/turnos/inscripcion.publico";
import { buscarAlumnosActivos, obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { obtenerTarifasPorIds } from "@/server/materias/materia.publico";
import { listarFormasPagoActivas, verificarFormaPagoActiva } from "@/server/pagos/forma-pago.publico";
import { registrarOperacion, type ItemOperacion } from "@/server/pagos/operacion.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { precioClase } from "@/server/shared/precio-clase";
import { ahora } from "@/server/shared/reloj";
import { ServiceError } from "@/server/shared/service-error";
import { transaccion } from "@/server/shared/transaccion";
import type { RegistrarOperacionInput, RegistrarPagoInput } from "@/server/pagos/pago.schema";
import type {
  ClasePendienteDePago,
  ClasesPendientesDePago,
  OpcionesPago,
  OperacionDePagoRegistrada,
  PagoRegistrado,
} from "@/types/pago.types";

/** Fecha civil del centro, independiente de la zona del proceso o del navegador. */
export const fechaHoyArgentina = hoyEnZonaCentro;

/**
 * `POST /api/pagos` (HU-I-01): conserva el contrato de Sprint 2 (PR-0.md
 * §2.15). Por dentro busca la inscripción vigente del par (clase, alumno) y
 * llama a `registrarOperacion` con una clase y el modo de compatibilidad
 * (2.13): exige además una caja abierta del usuario (`CAJA_NO_ABIERTA`) y
 * emite el comprobante, que la respuesta suma como campo extra.
 */
export async function registrarPago(input: RegistrarPagoInput, usuarioId: string): Promise<PagoRegistrado & { comprobante: { id: string; numero: string } }> {
  return transaccion(async (tx) => {
    // Mismos códigos y orden que en Sprint 2: turno, estado e inscripción;
    // registrarOperacion los revalida con todo bloqueado y sigue con forma y fecha.
    const [clase] = await obtenerClasesBasicas([input.turno_id], tx);
    if (!clase) throw new ServiceError("TURNO_NO_ENCONTRADO");
    if (clase.estado !== "DISPONIBLE" && clase.estado !== "COMPLETO") throw new ServiceError("TURNO_NO_ADMITE_PAGO");
    const inscripcion = await inscripcionVigenteDelPar(input.alumno_id, input.turno_id, tx);
    if (!inscripcion) throw new ServiceError("ALUMNO_NO_INSCRIPTO");

    const { operacion, pagos: [pago], comprobante } = await registrarOperacion(tx, {
      alumnoId: input.alumno_id,
      items: [{ inscripcionId: inscripcion.id, monto: input.monto }],
      formaPagoId: input.forma_pago_id,
      fechaPago: input.fecha_pago,
      usuarioId,
      modo: "compatSprint2",
    });
    const [[alumno], forma] = await Promise.all([
      obtenerAlumnosBasicos([input.alumno_id], tx),
      verificarFormaPagoActiva(input.forma_pago_id, tx),
    ]);
    if (!alumno || !pago || !forma) throw new ServiceError("ALUMNO_NO_INSCRIPTO");
    return {
      id: pago.id, turno_id: pago.turnoId,
      alumno: { id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` },
      monto: pago.monto, forma_pago: forma,
      fecha_pago: operacion.fechaPago.toISOString().slice(0, 10),
      comprobante: { id: comprobante.id, numero: comprobante.numeroVisible },
    };
  });
}

export async function obtenerOpcionesPago(turnoId: string): Promise<OpcionesPago> {
  const ids = await obtenerAlumnosInscriptosDeTurno(turnoId);
  if (ids === null) throw new ServiceError("TURNO_NO_ENCONTRADO");
  const [alumnos, formas] = await Promise.all([obtenerAlumnosBasicos(ids), listarFormasPagoActivas()]);
  const activas = new Set(formas.map(({ id }) => id));
  return {
    alumnos: alumnos.map((alumno) => ({
      id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}`, dni: alumno.dni,
      forma_pago_preferida_id: alumno.forma_pago_preferida_id && activas.has(alumno.forma_pago_preferida_id)
        ? alumno.forma_pago_preferida_id : null,
    })),
    formas_pago: formas,
    ...(alumnos.length === 1 ? { preseleccionar_alumno_id: alumnos[0].id } : {}),
  };
}

// ---------------------------------------------------------------------------
// Registrar pago buscando al alumno (HU-I-10, spec_modulo_I.md §2.7)
// ---------------------------------------------------------------------------

/**
 * Paso 1 (§2.7.1): alumnos activos, máximo 10, desde 2 caracteres. Delega en
 * B: `buscarAlumnosActivos` ya aplica el criterio por palabras de HU-B-05
 * (varias palabras en cualquier orden), sin segundo parámetro.
 */
export async function buscarAlumnosParaCobro(q: string) {
  return buscarAlumnosActivos(q);
}

const ESTADOS_COBRABLES = new Set(["DISPONIBLE", "COMPLETO"]);
const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const formatoDia = (fechaIso: string) => `${fechaIso.slice(8, 10)}/${fechaIso.slice(5, 7)}/${fechaIso.slice(0, 4)}`;

/**
 * Paso 2 (§2.7.2): clases del alumno pendientes de pago (lectura pública de
 * C, DEC-23) y, con `turnoId`, la clase marcada o la fila «Se inscribe al
 * confirmar el pago» con el precio de la tarifa vigente. Formas de pago
 * activas y la preferida del alumno solo si está activa.
 */
export async function listarClasesPendientesDePago(alumnoId: string, turnoId?: string): Promise<ClasesPendientesDePago> {
  const [alumno] = await obtenerAlumnosBasicos([alumnoId]);
  if (!alumno) throw new ErrorDeDominio("errores.alumno.noEncontrado");
  const [inscripciones, formas] = await Promise.all([
    listarInscripcionesPendientesDePagoDeAlumno(alumnoId),
    listarFormasPagoActivas(),
  ]);
  const clases: ClasePendienteDePago[] = inscripciones.map((inscripcion) => ({
    ...inscripcion,
    origen_precio: "INSCRIPCION",
    marcada: inscripcion.turno_id === turnoId,
  }));

  if (turnoId && !clases.some((clase) => clase.marcada)) {
    clases.push(await claseQueSeInscribeAlPagar(alumno, turnoId));
    clases.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio));
  }

  const activas = new Set(formas.map(({ id }) => id));
  return {
    alumno: {
      id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}`, dni: alumno.dni,
      forma_pago_preferida_id: alumno.forma_pago_preferida_id && activas.has(alumno.forma_pago_preferida_id)
        ? alumno.forma_pago_preferida_id : null,
    },
    clases,
    formas_pago: formas,
  };
}

/**
 * La clase pedida no está entre las pendientes del alumno: solo se lista si
 * corresponde «Se inscribe al confirmar el pago» (HU-C-24 criterio 3,
 * `exigeInscripcionConPago`); si no, el motivo por el que no se puede cobrar.
 */
async function claseQueSeInscribeAlPagar(
  alumno: { id: string; activo: boolean },
  turnoId: string,
): Promise<ClasePendienteDePago> {
  const momento = ahora();
  const [clase] = await obtenerClasesBasicas([turnoId]);
  if (!clase) throw new ErrorDeDominio("errores.turno.noEncontrado");
  const detalle = { turno_id: clase.turno_id, materia: clase.materia.nombre, fecha: clase.fecha, fecha_dia: formatoDia(clase.fecha) };
  if (!ESTADOS_COBRABLES.has(clase.estado)) throw new ErrorDeDominio("errores.pago.turnoNoAdmitePago", detalle);
  if (clase.inicio.getTime() <= momento.getTime()) throw new ErrorDeDominio("errores.pago.turnoYaEmpezo", detalle);
  const vigente = await inscripcionVigenteDelPar(alumno.id, turnoId);
  if (vigente?.estadoPago === "PAGADA") throw new ErrorDeDominio("errores.pago.inscripcionYaPagada", detalle);
  if (!(await exigeInscripcionConPago(prisma, { turnoId, alumnoId: alumno.id, momento })).exige) {
    throw new ErrorDeDominio("errores.pago.alumnoNoInscripto", detalle);
  }
  if (!alumno.activo) throw new ErrorDeDominio("errores.alumno.inactivo", detalle);
  const [tarifa] = await obtenerTarifasPorIds([clase.materia.id]);
  const duracion = (minutosDe(clase.hora_fin) - minutosDe(clase.hora_inicio) + 24 * 60) % (24 * 60);
  return {
    inscripcion_id: null,
    turno_id: clase.turno_id,
    fecha: clase.fecha,
    hora_inicio: clase.hora_inicio,
    hora_fin: clase.hora_fin,
    materia: clase.materia,
    profesor: clase.profesor ? { id: clase.profesor.id, nombre_completo: clase.profesor.nombre_para_mostrar } : null,
    estado_pago: "SE_INSCRIBE_AL_PAGAR",
    vence_el: null,
    precio: precioClase({ tarifaHora: tarifa?.tarifaHora ?? null }, duracion),
    origen_precio: "TARIFA_VIGENTE",
    marcada: true,
  };
}

/**
 * Paso 3 (§2.7.3-2.7.5): arma el pedido y delega toda la regla de negocio
 * (bloqueo, revalidación por ítem, caja, escritura y comprobante) en
 * `registrarOperacion` con el modo `completo`. Solo verifica antes que el
 * alumno exista (404 ALUMNO_NO_ENCONTRADO de §2.7.6) y arma la respuesta.
 */
export async function registrarOperacionDePago(input: RegistrarOperacionInput, usuarioId: string): Promise<OperacionDePagoRegistrada> {
  return transaccion(async (tx) => {
    const [alumno] = await obtenerAlumnosBasicos([input.alumno_id], tx);
    if (!alumno) throw new ErrorDeDominio("errores.alumno.noEncontrado");
    const items: ItemOperacion[] = input.items.map((item) => (
      item.inscripcion_id
        ? { inscripcionId: item.inscripcion_id, monto: item.monto, motivoAjuste: item.motivo_ajuste }
        : { crearInscripcion: { turnoId: item.turno_id! }, monto: item.monto, motivoAjuste: item.motivo_ajuste }
    ));
    const { operacion, pagos, comprobante } = await registrarOperacion(tx, {
      alumnoId: input.alumno_id, items, formaPagoId: input.forma_pago_id,
      fechaPago: input.fecha_pago, usuarioId, modo: "completo",
    });
    const [forma, clases] = await Promise.all([
      verificarFormaPagoActiva(input.forma_pago_id, tx),
      obtenerClasesBasicas(pagos.map((pago) => pago.turnoId), tx),
    ]);
    const clasePorId = new Map(clases.map((clase) => [clase.turno_id, clase]));
    const total = pagos.reduce((suma, pago) => suma.plus(pago.monto), new Prisma.Decimal(0));
    return {
      operacion_id: operacion.id,
      alumno: { id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` },
      forma_pago: forma ?? { id: input.forma_pago_id, nombre: "" },
      fecha_pago: operacion.fechaPago.toISOString().slice(0, 10),
      total: total.toFixed(2),
      pagos: pagos.map((pago) => {
        const clase = clasePorId.get(pago.turnoId);
        return {
          id: pago.id, turno_id: pago.turnoId, inscripcion_id: pago.inscripcionId,
          materia: clase?.materia ?? { id: "", nombre: "" },
          fecha: clase?.fecha ?? "", hora_inicio: clase?.hora_inicio ?? "",
          precio: pago.precio, monto: pago.monto, motivo_ajuste: pago.motivoAjuste,
        };
      }),
      comprobante: { id: comprobante.id, numero: comprobante.numeroVisible },
    };
  });
}
