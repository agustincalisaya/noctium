import type { RolUsuario } from "@prisma/client";
import { listarPagosDeTurno } from "@/server/pagos/pago.publico";
import { obtenerClaseDictadaDeTurno, profesorAtendioAlumno } from "@/server/historial/historial.publico";
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
  const alumnos = await Promise.all(turno.alumnos.map(async (alumno) => ({
    ...alumno,
    puede_ver_historial: capacidades.verHistorial && (usuario.rol !== "PROFESOR"
      || (turno.profesor_id !== null && await profesorAtendioAlumno(turno.profesor_id, alumno.id))),
  })));
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
