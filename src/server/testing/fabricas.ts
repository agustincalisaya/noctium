import type { EstadoPagoInscripcion, EstadoTurno, Prisma, PrismaClient, RolUsuario } from "@prisma/client";
import { ahora } from "@/server/shared/reloj";
import { fechaCentro, inicioDeTurno } from "@/server/shared/fechas-centro";
import { calcularVencimiento } from "@/server/turnos/inscripcion.vigencia";

/**
 * Fábricas de datos de prueba compartidas (PR-0.md §2.16): cada prueba crea
 * sus propios datos con ids únicos, sin depender de las cuentas del seed ni
 * pisar los de otras pruebas. Escriben directo en la base y respetan las
 * mismas invariantes que los servicios (CHECK, «Pagada ⇔ pago no anulado»):
 * cuando estén los servicios de dominio, `crearInscripcionDePrueba`,
 * `crearOperacionDePrueba` y `abrirCajaDePrueba` pueden pasar a usarlos sin
 * cambiar su firma.
 */
type Db = PrismaClient | Prisma.TransactionClient;

let contador = 0;
/** Sufijo único por proceso y llamada: sirve para ids, DNIs y nombres. */
export function unico(prefijo = "f"): string {
  contador += 1;
  return `${prefijo}${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
/** DNI de 8 dígitos: los últimos 5 del reloj del proceso y un contador de 3. */
function dniUnico(): string {
  contador += 1;
  return `${String(Date.now()).slice(-5)}${String(contador % 1000).padStart(3, "0")}`;
}

const HORA = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

export async function crearUsuarioDePrueba(db: Db, datos: { rol?: RolUsuario; email?: string; activo?: boolean } = {}) {
  return db.usuario.create({
    data: {
      emailUsuario: datos.email ?? `${unico("u")}@prueba.local`,
      passwordHashUsuario: "hash-de-prueba",
      rolUsuario: datos.rol ?? "MESA_ENTRADA",
      activoUsuario: datos.activo ?? true,
    },
  });
}

/** Ficha de mesa de entrada con su cuenta (el email de la ficha es el de la cuenta). */
export async function crearFichaMesaEntradaDePrueba(db: Db, datos: { activo?: boolean } = {}) {
  const usuario = await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA", activo: datos.activo });
  const id = unico("fm");
  return db.fichaMesaEntrada.create({
    data: {
      usuarioId: usuario.idUsuario, activoFichaMesaEntrada: datos.activo ?? true,
      nombreFichaMesaEntrada: "Integrante", apellidoFichaMesaEntrada: id,
      nombreNormalizadoFichaMesaEntrada: "integrante", apellidoNormalizadoFichaMesaEntrada: id.toLowerCase(),
      dniFichaMesaEntrada: dniUnico(), fechaNacimientoFichaMesaEntrada: new Date(Date.UTC(1990, 0, 1)),
      emailFichaMesaEntrada: usuario.emailUsuario,
    },
  });
}

/** Ficha de gerente con su cuenta. */
export async function crearFichaGerenteDePrueba(db: Db, datos: { activo?: boolean } = {}) {
  const usuario = await crearUsuarioDePrueba(db, { rol: "GERENTE", activo: datos.activo });
  const id = unico("fg");
  return db.fichaGerente.create({
    data: {
      usuarioId: usuario.idUsuario, activoFichaGerente: datos.activo ?? true,
      nombreFichaGerente: "Gerente", apellidoFichaGerente: id,
      nombreNormalizadoFichaGerente: "gerente", apellidoNormalizadoFichaGerente: id.toLowerCase(),
      dniFichaGerente: dniUnico(), fechaNacimientoFichaGerente: new Date(Date.UTC(1980, 0, 1)),
      emailFichaGerente: usuario.emailUsuario,
    },
  });
}

export async function crearAlumnoDePrueba(db: Db, datos: { activo?: boolean; usuarioId?: string | null } = {}) {
  const id = unico("al");
  return db.alumno.create({
    data: {
      nombreAlumno: "Alumno", apellidoAlumno: id,
      nombreNormalizadoAlumno: "alumno", apellidoNormalizadoAlumno: id.toLowerCase(),
      dniAlumno: dniUnico(), fechaNacimientoAlumno: new Date(Date.UTC(2000, 0, 1)),
      activoAlumno: datos.activo ?? true, usuarioId: datos.usuarioId ?? null,
    },
  });
}

export async function crearProfesorDePrueba(db: Db, datos: { activo?: boolean } = {}) {
  const id = unico("pr");
  return db.profesor.create({
    data: {
      nombreProfesor: "Profesor", apellidoProfesor: id,
      nombreNormalizadoProfesor: "profesor", apellidoNormalizadoProfesor: id.toLowerCase(),
      dniProfesor: dniUnico(), fechaNacimientoProfesor: new Date(Date.UTC(1980, 0, 1)),
      activoProfesor: datos.activo ?? true,
    },
  });
}

/** Materia con tarifa (por defecto $ 12.000 por hora); `tarifaHora: null` = «sin tarifa». */
export async function crearMateriaDePrueba(db: Db, datos: { tarifaHora?: number | null } = {}) {
  const nombre = unico("Materia ");
  return db.materia.create({
    data: {
      nombreMateria: nombre, nombreNormalizadaMateria: nombre.toLowerCase(),
      tarifaHoraMateria: datos.tarifaHora === undefined ? 12000 : datos.tarifaHora,
    },
  });
}

export async function crearAulaDePrueba(db: Db, datos: { capacidad?: number } = {}) {
  const nombre = unico("A ").slice(0, 30);
  return db.aula.create({
    data: { nombreAula: nombre, nombreNormalizadaAula: nombre.toLowerCase(), capacidadAula: datos.capacidad ?? 10 },
  });
}

export type DatosTurnoDePrueba = {
  /** Días calendario después de hoy (zona del centro, según `ahora()`); negativo = pasada. Por defecto 3. */
  enDias?: number;
  hora?: string;
  duracionMin?: 60 | 120 | 180;
  estado?: EstadoTurno;
  cupo?: number;
  materiaId?: string;
  profesorId?: string;
  aulaId?: string;
};

/**
 * Clase con su propio profesor, aula y materia (salvo que se pasen): por
 * defecto DISPONIBLE, dentro de 3 días a las 10:00, 60 minutos y cupo 10.
 * Al ser DISPONIBLE, el trigger reserva el profesor y el aula.
 */
export async function crearTurnoDePrueba(db: Db, datos: DatosTurnoDePrueba = {}) {
  const materiaId = datos.materiaId ?? (await crearMateriaDePrueba(db)).idMateria;
  const profesorId = datos.profesorId ?? (await crearProfesorDePrueba(db)).idProfesor;
  const cupo = datos.cupo ?? 10;
  const aulaId = datos.aulaId ?? (await crearAulaDePrueba(db, { capacidad: cupo })).idAula;
  const hoy = fechaCentro(ahora());
  const fechaTurno = new Date(hoy.getTime() + (datos.enDias ?? 3) * 24 * 60 * 60 * 1000);
  return db.turno.create({
    data: {
      idTurno: unico("tu"),
      fechaTurno,
      horaInicioTurno: HORA(datos.hora ?? "10:00"),
      duracionMinutosTurno: datos.duracionMin ?? 60,
      cupoMaximoTurno: cupo,
      estadoTurno: datos.estado ?? "DISPONIBLE",
      materiaId, profesorId, aulaId,
    },
  });
}

export type DatosInscripcionDePrueba = {
  turnoId: string;
  alumnoId: string;
  /** Por defecto PAGO_SIN_REGISTRAR (inscripción sin plazo, comportamiento interino). */
  estadoPago?: EstadoPagoInscripcion;
  /** Momento de la reserva; por defecto `ahora()`. */
  reservadaEl?: Date;
  /** Plazo de una RESERVADA (por defecto 24 h); el vencimiento se topea con el inicio de la clase. */
  plazoHoras?: number;
  precio?: number;
  creadoPorUsuarioId?: string | null;
};

/** Inscripción VIGENTE coherente con los CHECK de turno_alumno. */
export async function crearInscripcionDePrueba(db: Db, datos: DatosInscripcionDePrueba) {
  const estadoPago = datos.estadoPago ?? "PAGO_SIN_REGISTRAR";
  const reservadaEl = datos.reservadaEl ?? ahora();
  let plazo: { inicioPlazo: Date | null; venceBaseEl: Date | null; venceEl: Date | null } = {
    inicioPlazo: null, venceBaseEl: null, venceEl: null,
  };
  if (estadoPago === "RESERVADA") {
    const turno = await db.turno.findUniqueOrThrow({ where: { idTurno: datos.turnoId } });
    const { venceBaseEl, venceEl } = calcularVencimiento(reservadaEl, inicioDeTurno(turno), datos.plazoHoras ?? 24);
    plazo = { inicioPlazo: reservadaEl, venceBaseEl, venceEl };
  }
  return db.turnoAlumno.create({
    data: {
      turnoId: datos.turnoId, alumnoId: datos.alumnoId, estadoPago, reservadaEl, ...plazo,
      precio: datos.precio ?? 12000, creadoPorUsuarioId: datos.creadoPorUsuarioId ?? null,
    },
  });
}

/** Caja ABIERTA de un integrante (crea la cuenta de mesa de entrada si no se pasa). */
export async function abrirCajaDePrueba(db: Db, datos: { usuarioId?: string; fondoInicial?: string; abiertaEl?: Date } = {}) {
  const usuarioId = datos.usuarioId ?? (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
  return db.caja.create({
    data: { usuarioId, abiertaEl: datos.abiertaEl ?? ahora(), fondoInicial: datos.fondoInicial ?? "0.00" },
  });
}

export type DatosOperacionDePrueba = {
  cajaId: string;
  /** Inscripciones que se cobran (todas del mismo alumno). */
  inscripcionIds: string[];
  formaPagoId?: string;
  /** Monto de cada pago; por defecto el precio de la inscripción. */
  monto?: string;
  fechaPago?: Date;
};

/**
 * Operación de pago con un pago por inscripción, en la caja indicada. Deja
 * cada inscripción PAGADA y sin vencimiento («Pagada ⇔ pago no anulado»). No
 * emite comprobante: eso es de `emitirComprobante` (servicio del PR 0).
 */
export async function crearOperacionDePrueba(db: Db, datos: DatosOperacionDePrueba) {
  const inscripciones = await db.turnoAlumno.findMany({ where: { idInscripcion: { in: datos.inscripcionIds } } });
  if (inscripciones.length !== datos.inscripcionIds.length) throw new Error("crearOperacionDePrueba: inscripción inexistente");
  const alumnos = new Set(inscripciones.map((i) => i.alumnoId));
  if (alumnos.size !== 1) throw new Error("crearOperacionDePrueba: las inscripciones tienen que ser del mismo alumno");
  const caja = await db.caja.findUniqueOrThrow({ where: { idCaja: datos.cajaId } });
  const formaPagoId = datos.formaPagoId ?? "formapago-efectivo";
  const fechaPago = datos.fechaPago ?? fechaCentro(ahora());
  const operacion = await db.operacionPago.create({
    data: {
      alumnoId: [...alumnos][0], formaPagoId, fechaPago,
      creadoPorUsuarioId: caja.usuarioId, registradaEl: ahora(), cajaId: caja.idCaja,
    },
  });
  const pagos = [];
  for (const inscripcion of inscripciones) {
    pagos.push(await db.pago.create({
      data: {
        turnoId: inscripcion.turnoId, alumnoId: inscripcion.alumnoId, montoPago: datos.monto ?? `${inscripcion.precio}.00`,
        formaPagoId, fechaPago, creadoPorUsuarioId: caja.usuarioId, createdAtPago: ahora(),
        operacionId: operacion.idOperacionPago, inscripcionId: inscripcion.idInscripcion, precio: inscripcion.precio,
      },
    }));
    await db.turnoAlumno.update({
      where: { idInscripcion: inscripcion.idInscripcion },
      data: { estadoPago: "PAGADA", venceBaseEl: null, venceEl: null },
    });
  }
  return { operacion, pagos };
}

export type DatosClaseDictadaDePrueba = {
  turnoId: string;
  /** Alumnos del registro con su estado (null = sin control). */
  alumnos: { alumnoId: string; estado: "PRESENTE" | "AUSENTE" | null }[];
  conControl?: boolean;
  /** Fecha de la clase dictada (@db.Date); por defecto la del turno. */
  fecha?: Date;
  anulada?: boolean;
};

/**
 * Registro de clase dictada con su asistencia (la lógica de registro la
 * agregan HU-E-09 y la etapa 3; acá solo se arman datos para las lecturas).
 */
export async function crearClaseDictadaDePrueba(db: Db, datos: DatosClaseDictadaDePrueba) {
  const turno = await db.turno.findUniqueOrThrow({ where: { idTurno: datos.turnoId } });
  const clase = await db.claseDictada.create({
    data: {
      turnoId: turno.idTurno, fechaClaseDictada: datos.fecha ?? turno.fechaTurno, materiaId: turno.materiaId,
      profesorId: turno.profesorId!, conControlAsistencia: datos.conControl ?? datos.alumnos.some((a) => a.estado !== null),
      ...(datos.anulada ? { anuladaEl: ahora(), motivoAnulacion: "Prueba" } : {}),
      alumnos: { create: datos.alumnos.map((a) => ({ alumnoId: a.alumnoId, estadoAsistencia: a.estado })) },
    },
  });
  return clase;
}

/** Corrección de asistencia (registro nuevo, HU-E-11) sobre una clase dictada de prueba. */
export async function corregirAsistenciaDePrueba(
  db: Db,
  datos: { claseDictadaId: string; cambios: { alumnoId: string; anterior: "PRESENTE" | "AUSENTE" | null; nuevo: "PRESENTE" | "AUSENTE" }[]; creadaEl?: Date },
) {
  return db.correccionAsistencia.create({
    data: {
      claseDictadaId: datos.claseDictadaId, motivo: "Prueba", conControlAsistencia: true, createdAtCorreccion: datos.creadaEl ?? ahora(),
      alumnos: { create: datos.cambios.map((c) => ({ alumnoId: c.alumnoId, estadoAnterior: c.anterior, estadoNuevo: c.nuevo })) },
    },
  });
}
