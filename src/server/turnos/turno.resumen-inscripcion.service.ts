import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { texto } from "@/lib/textos";
import { obtenerAlumnoDeUsuario } from "@/server/alumnos/alumno.publico";
import { obtenerNombreAula } from "@/server/aulas/aula.publico";
import { obtenerMateriasPorIds, obtenerTarifasPorIds } from "@/server/materias/materia.publico";
import { obtenerNombresProfesores } from "@/server/profesores/profesor.publico";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { inicioDeTurno, isoCentro } from "@/server/shared/fechas-centro";
import { parametrosVigentes } from "@/server/shared/parametros-vigentes";
import { precioClase } from "@/server/shared/precio-clase";
import { ahora } from "@/server/shared/reloj";
import { calcularVencimiento, inscripcionesVigentes, ocupacion } from "@/server/turnos/inscripcion.vigencia";
import type { ResumenInscripcion } from "@/types/turno.types";

/** C §2.17.1: lectura informativa; el POST vigente revalida y calcula su precio. */
export async function obtenerResumenInscripcion(
  turnoId: string, usuarioId: string, db: Prisma.TransactionClient = prisma,
): Promise<ResumenInscripcion> {
  const alumno = await obtenerAlumnoDeUsuario(usuarioId, db);
  if (!alumno) throw new ServiceError("SIN_PERMISO", texto("ui.turnos.resumen.sinFicha"));
  const turno = await db.turno.findUnique({ where: { idTurno: turnoId } });
  if (!turno) throw new ErrorDeDominio("errores.turno.noEncontrado");
  const momento = ahora();
  const actual = await ocupacion(db, turnoId, momento);
  if (!actual || !["DISPONIBLE", "COMPLETO"].includes(actual.estado) || !turno.profesorId || !turno.aulaId) {
    throw new ServiceError("TURNO_NO_DISPONIBLE", texto("ui.turnos.resumen.noDisponible"));
  }
  const inicio = inicioDeTurno(turno);
  if (inicio.getTime() <= momento.getTime()) throw new ErrorDeDominio("errores.turno.vencido");
  const cupo = actual.cupo ?? 0;
  const lugares = cupo - actual.inscriptos;
  if (lugares <= 0) throw new ErrorDeDominio("errores.turno.cupoInsuficiente");
  if (!alumno.activo) throw new ErrorDeDominio("errores.alumno.inactivoPropio");
  const inscripciones = await inscripcionesVigentes(db, turnoId, momento);
  if (inscripciones.some((fila) => fila.alumnoId === alumno.id)) {
    throw new ErrorDeDominio("errores.inscripcion.alumnoYaAsignadoPropio");
  }
  const [materias, tarifas, profesores, aula, parametros] = await Promise.all([
    obtenerMateriasPorIds([turno.materiaId], db),
    obtenerTarifasPorIds([turno.materiaId], db),
    obtenerNombresProfesores([turno.profesorId], db),
    obtenerNombreAula(turno.aulaId, db),
    parametrosVigentes(db),
  ]);
  const precio = precioClase({ tarifaHora: tarifas[0]?.tarifaHora ?? null }, turno.duracionMinutosTurno, { paraAlumno: true });
  const materia = materias[0];
  const nombreProfesor = profesores[turno.profesorId];
  if (!materia || !nombreProfesor || !aula) throw new Error("Resumen: referencias de la clase incompletas");
  const limite = new Date(inicio.getTime() - parametros.cancelacionAnticipacionHoras * 3_600_000);
  const fin = new Date(turno.horaInicioTurno.getTime() + turno.duracionMinutosTurno * 60_000);
  return {
    turno_id: turno.idTurno,
    materia: { id: materia.id, nombre: materia.nombre },
    profesor: { id: turno.profesorId, nombre_para_mostrar: nombreProfesor },
    fecha: turno.fechaTurno.toISOString().slice(0, 10),
    hora_inicio: turno.horaInicioTurno.toISOString().slice(11, 16),
    hora_fin: fin.toISOString().slice(11, 16),
    duracion_min: turno.duracionMinutosTurno,
    aula, cupo, lugares_disponibles: lugares, precio,
    plazo_pago_horas: parametros.plazoPagoHoras,
    vence_pago_el: isoCentro(calcularVencimiento(momento, inicio, parametros.plazoPagoHoras).venceEl),
    limite_cancelacion_en_linea: isoCentro(limite),
    limite_cancelacion_pasado: momento.getTime() >= limite.getTime(),
  };
}
