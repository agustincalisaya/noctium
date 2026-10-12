import { prisma } from "@/lib/prisma";
import { alumnoTieneRegistros as historialAlumnoTieneRegistros } from "@/server/historial/historial.publico";
import { alumnoTieneRegistros as pagosAlumnoTieneRegistros } from "@/server/pagos/pago.publico";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import type { ActorDominio } from "@/server/shared/historial";
import { listarHistorialEstados, registrarCambioEstado } from "@/server/shared/historial-estados";
import { ahora } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import {
  alumnoTieneRegistros as turnosAlumnoTieneRegistros,
  darDeBajaInscripcionesDeAlumno,
  listarInscripcionesDeAlumno,
} from "@/server/turnos/inscripcion.publico";
import { desactivarCuenta, reactivarCuenta } from "@/server/usuarios/cuenta.service";
import type { DesactivarAlumnoInput, ReactivarAlumnoInput } from "@/server/alumnos/alumno.schema";
import type { HistorialEstadoAlumno, ImpactoBajaAlumno } from "@/types/alumno.types";
import { fechaCentro, instanteCentro, isoCentro } from "@/server/shared/fechas-centro";

async function ficha(id: string, db: Tx = prisma) {
  const alumno = await db.alumno.findUnique({ where: { idAlumno: id } });
  if (!alumno) throw new ErrorDeDominio("errores.alumno.noEncontrado");
  return alumno;
}

async function tieneRegistrosAlumno(id: string, db: Tx = prisma): Promise<boolean> {
  if (await turnosAlumnoTieneRegistros(id, db)) return true;
  if (await pagosAlumnoTieneRegistros(id, db)) return true;
  return historialAlumnoTieneRegistros(id, db);
}

export async function obtenerImpactoBajaAlumno(id: string): Promise<ImpactoBajaAlumno> {
  const alumno = await ficha(id);
  if (!alumno.activoAlumno) throw new ErrorDeDominio("errores.alumno.yaInactivo");
  const momento = ahora();
  const [inscripciones, motivoObligatorio] = await Promise.all([
    listarInscripcionesDeAlumno(id, { desde: fechaCentro(momento).toISOString().slice(0, 10) }),
    tieneRegistrosAlumno(id),
  ]);
  const futuras = inscripciones
    .filter((item) => item.vigente_ahora && ["DISPONIBLE", "COMPLETO"].includes(item.estado_clase))
    .filter((item) => instanteCentro(item.fecha, item.hora_inicio).getTime() > momento.getTime())
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio) || a.inscripcion_id.localeCompare(b.inscripcion_id))
    .map((item) => ({
      inscripcion_id: item.inscripcion_id,
      turno_id: item.turno_id,
      fecha: item.fecha,
      hora_inicio: item.hora_inicio,
      hora_fin: item.hora_fin,
      materia: item.materia,
      profesor: item.profesor && item.profesor_id ? { id: item.profesor_id, nombre_para_mostrar: item.profesor } : null,
    }));
  return {
    alumno: { id, nombre: alumno.nombreAlumno, apellido: alumno.apellidoAlumno },
    version: alumno.version,
    total: futuras.length,
    inscripciones_futuras: futuras,
    motivo_obligatorio: motivoObligatorio,
  };
}

export async function desactivarAlumno(id: string, input: DesactivarAlumnoInput, actor: ActorDominio) {
  return transaccion(async (tx) => {
    await bloquear(tx, { recursos: { alumnos: [id] } });
    const alumno = await ficha(id, tx);
    if (!alumno.activoAlumno) throw new ErrorDeDominio("errores.alumno.yaInactivo");
    if (alumno.version !== input.version) throw new ErrorDeDominio("errores.alumno.conflictoEdicion");
    const motivo = input.motivo?.trim() || null;
    if (!motivo && await tieneRegistrosAlumno(id, tx)) throw new ErrorDeDominio("errores.alumno.motivoRequerido");
    const actualizado = await tx.alumno.updateMany({
      where: { idAlumno: id, activoAlumno: true, version: input.version },
      data: {
        activoAlumno: false,
        version: { increment: 1 },
        modificadoPorUsuarioId: actor.tipo === "USUARIO" ? actor.usuarioId : null,
      },
    });
    if (!actualizado.count) throw new ErrorDeDominio("errores.alumno.conflictoEdicion");
    const bajas = await darDeBajaInscripcionesDeAlumno(tx, { alumnoId: id, actor });
    if (alumno.usuarioId) await desactivarCuenta(tx, alumno.usuarioId);
    registrarCambioEstado(tx, { entidad: "ALUMNO", id, accion: "DESACTIVAR", motivo, actor });
    return { id, activo: false, version: alumno.version + 1, inscripciones_quitadas: bajas.quitadas.length };
  });
}

export async function reactivarAlumno(id: string, input: ReactivarAlumnoInput, actor: ActorDominio) {
  return transaccion(async (tx) => {
    await bloquear(tx, { recursos: { alumnos: [id] } });
    const alumno = await ficha(id, tx);
    if (alumno.activoAlumno) throw new ErrorDeDominio("errores.alumno.yaActivo");
    if (alumno.version !== input.version) throw new ErrorDeDominio("errores.alumno.conflictoEdicion");
    const actualizado = await tx.alumno.updateMany({
      where: { idAlumno: id, activoAlumno: false, version: input.version },
      data: {
        activoAlumno: true,
        version: { increment: 1 },
        modificadoPorUsuarioId: actor.tipo === "USUARIO" ? actor.usuarioId : null,
      },
    });
    if (!actualizado.count) throw new ErrorDeDominio("errores.alumno.conflictoEdicion");
    if (alumno.usuarioId) await reactivarCuenta(tx, alumno.usuarioId);
    registrarCambioEstado(tx, { entidad: "ALUMNO", id, accion: "REACTIVAR", actor });
    return { id, activo: true, version: alumno.version + 1 };
  });
}

/**
 * `historial_estados` de la ficha (spec_modulo_B.md 2.12): del más reciente al
 * más antiguo, con el usuario resuelto en lote (`null` si fue el proceso
 * automático o la cuenta ya no tiene ficha de personal). Lo usan la API y la
 * página de la ficha.
 */
export async function obtenerHistorialEstadosAlumno(id: string): Promise<HistorialEstadoAlumno[]> {
  const historial = await listarHistorialEstados("ALUMNO", id);
  const nombres = await obtenerNombresPersonal(historial.flatMap((item) => item.usuario_id ? [item.usuario_id] : []));
  const porId = new Map(nombres.map((item) => [item.usuario_id, item.nombre_completo]));
  return historial.map((item) => ({
    fecha: isoCentro(item.fecha),
    accion: item.accion,
    usuario: item.usuario_id ? { id: item.usuario_id, nombre_para_mostrar: porId.get(item.usuario_id) ?? null } : null,
    motivo: item.motivo,
  }));
}
