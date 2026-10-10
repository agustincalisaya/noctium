import type { RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listarPagosDeTurno } from "@/server/pagos/pago.publico";
import { inicioDeTurno, isoCentro } from "@/server/shared/fechas-centro";
import { filtroVigenteEn } from "@/server/turnos/inscripcion.vigencia";
import { obtenerClaseDictadaDeTurno, profesorPuedeRegistrarIndicacion } from "@/server/historial/historial.publico";
import { existeInscripcionVigenteConProfesor } from "@/server/turnos/inscripcion.publico";
import type { TurnoDetalle } from "@/types/turno.types";
import { calcularAccionesHabilitadas, type CapacidadesAcciones } from "@/server/turnos/turno.acciones";
import { obtenerTurno } from "@/server/turnos/turno.service";

/**
 * Ensamblador del detalle de turno (HU-C-09, spec_modulo_C.md §2.4). Es el
 * único archivo de Turnos que importa los públicos de Pagos e Historial.
 * Lo importa solo la ruta `GET /api/turnos/[id]`; nunca
 * `turno.publico.ts`, para no crear ciclos con los módulos que consumen Turnos.
 */

export type CapacidadesDetalle = CapacidadesAcciones & { verPagos: boolean; verHistorial: boolean };

/** Inscripciones vigentes a `momento` de la clase, por alumno (una reserva vencida sin marcar no figura). */
async function inscripcionesDelDetalle(turnoId: string, momento: Date) {
  const filas = await prisma.turnoAlumno.findMany({
    where: { turnoId, ...filtroVigenteEn(momento) },
    select: { alumnoId: true, idInscripcion: true, estadoPago: true, venceEl: true, precio: true },
  });
  return new Map(filas.map((fila) => [fila.alumnoId, fila]));
}

export type ResultadoDetalleTurno =
  | { resultado: "ok"; turno: TurnoDetalle }
  | { resultado: "sin_permiso" }
  | { resultado: "no_encontrado" };

export async function obtenerDetalleTurno(
  id: string,
  usuario: { id: string; rol: RolUsuario },
  { capacidades, ahora }: { capacidades: CapacidadesDetalle; ahora: Date },
): Promise<ResultadoDetalleTurno> {
  const base = await obtenerTurno(id, usuario);
  if (base.resultado !== "ok") return base;
  const { turno } = base;

  // El Profesor nunca recibe datos de pago, aunque el rol tuviera el permiso.
  const [pagos, claseDictada] = await Promise.all([
    capacidades.verPagos && usuario.rol !== "PROFESOR" ? listarPagosDeTurno(turno.id) : undefined,
    obtenerClaseDictadaDeTurno(turno.id),
  ]);
  // Reservas pendientes y acceso a «Registrar pago» (HU-C-24, C §2.18.4): solo
  // con `pagos:leer`; el Profesor no ve precios.
  const inscripciones = pagos === undefined ? null : await inscripcionesDelDetalle(turno.id, ahora);
  const inicioClase = inicioDeTurno({
    fechaTurno: new Date(`${turno.fecha}T00:00:00.000Z`),
    horaInicioTurno: new Date(`1970-01-01T${turno.hora_inicio}:00.000Z`),
  });
  const cobrable = capacidades.registrarPago && (turno.estado === "DISPONIBLE" || turno.estado === "COMPLETO")
    && inicioClase.getTime() > ahora.getTime();
  const alumnos = await Promise.all(turno.alumnos.map(async (alumno) => {
    const fila = inscripciones?.get(alumno.id);
    return {
      ...alumno,
      puede_ver_historial: capacidades.verHistorial && (usuario.rol !== "PROFESOR"
        || (turno.profesor_id !== null && turno.materia_id !== null && (
          await existeInscripcionVigenteConProfesor(alumno.id, turno.profesor_id, turno.materia_id)
          || await profesorPuedeRegistrarIndicacion(turno.profesor_id, alumno.id, turno.materia_id)
        ))),
      ...(fila ? {
        inscripcion: {
          id: fila.idInscripcion, estado_pago: fila.estadoPago,
          ...(fila.estadoPago === "RESERVADA" && fila.venceEl ? { vence_el: isoCentro(fila.venceEl) } : {}),
          precio: fila.precio,
        },
        puede_registrar_pago: cobrable && fila.estadoPago !== "PAGADA",
      } : {}),
    };
  }));
  const acciones_habilitadas = calcularAccionesHabilitadas({
    estado: turno.estado,
    fecha: new Date(`${turno.fecha}T00:00:00.000Z`),
    horaInicio: new Date(`1970-01-01T${turno.hora_inicio}:00.000Z`),
    duracionMinutos: turno.duracion_minutos,
    cantidadAlumnos: turno.alumnos.length,
    rol: usuario.rol,
    // Para el Profesor, obtenerTurno() ya exigió que el turno fuera suyo.
    turnoPropio: usuario.rol === "PROFESOR",
    tieneClaseDictada: claseDictada !== null,
    capacidades,
    ahora,
  });
  return {
    resultado: "ok",
    turno: {
      ...turno,
      alumnos,
      ...(pagos === undefined ? {} : { pagos }),
      clase_dictada: claseDictada ? { id: claseDictada.id, registrada_en: claseDictada.registrada_en } : null,
      acciones_habilitadas,
    },
  };
}
