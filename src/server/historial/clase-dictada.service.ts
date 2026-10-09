import type { RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { bloquearTurnoParaOperacion } from "@/server/turnos/turno.publico";
import { turnoYaTermino } from "@/server/turnos/turno.acciones";

const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para registrar o consultar esta clase",
  TURNO_NO_ENCONTRADO: "No se encontró el turno",
  TURNO_NO_ADMITE_CLASE: "Solo se puede registrar una clase de un turno disponible o completo",
  CLASE_NO_FINALIZADA: "La clase todavía no terminó",
  CLASE_NO_REGISTRADA: "El turno todavía no tiene una clase dictada registrada",
} as const;

type UsuarioHistorial = { id: string; rol: RolUsuario };

/**
 * Registra la clase como un hecho inmutable. `createMany(skipDuplicates)` usa
 * PostgreSQL `ON CONFLICT DO NOTHING`; el índice único parcial por turno
 * (clase dictada no anulada, PR-0.md §2.8) protege también ante dos
 * solicitudes concurrentes. Registra a los alumnos con inscripción vigente
 * (un alumno quitado no figura) y queda «sin control de asistencia» (estados
 * vacíos): la asistencia por alumno es de HU-E-09.
 */
export async function registrarClaseDictada(
  turnoId: string,
  usuario: UsuarioHistorial,
  ahora: Date = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const turno = await bloquearTurnoParaOperacion(turnoId, tx);
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", MENSAJES.TURNO_NO_ENCONTRADO);

    if (usuario.rol === "PROFESOR") {
      const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, tx);
      if (!profesor || profesor.id !== turno.profesor_id) {
        throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
      }
    }

    if (turno.estado !== "DISPONIBLE" && turno.estado !== "COMPLETO") {
      throw new ServiceError("TURNO_NO_ADMITE_CLASE", MENSAJES.TURNO_NO_ADMITE_CLASE);
    }
    if (!turnoYaTermino(
      new Date(`${turno.fecha}T00:00:00.000Z`),
      new Date(`1970-01-01T${turno.hora_inicio}:00.000Z`),
      turno.duracion_min,
      ahora,
    )) {
      throw new ServiceError("CLASE_NO_FINALIZADA", MENSAJES.CLASE_NO_FINALIZADA);
    }
    if (!turno.profesor_id) {
      throw new ServiceError("TURNO_NO_ADMITE_CLASE", MENSAJES.TURNO_NO_ADMITE_CLASE);
    }

    const datosClase = {
      turnoId,
      fechaClaseDictada: new Date(`${turno.fecha}T00:00:00.000Z`),
      materiaId: turno.materia_id,
      profesorId: turno.profesor_id,
      creadoPorUsuarioId: usuario.id,
    };
    const insercion = await tx.claseDictada.createMany({ data: [datosClase], skipDuplicates: true });

    if (insercion.count === 1 && turno.alumno_ids.length > 0) {
      const clase = await tx.claseDictada.findFirstOrThrow({
        where: { turnoId, anuladaEl: null },
        select: { idClaseDictada: true },
      });
      await tx.claseDictadaAlumno.createMany({
        data: turno.alumno_ids.map((alumnoId) => ({ claseDictadaId: clase.idClaseDictada, alumnoId })),
        skipDuplicates: true,
      });
    }

    const clase = await tx.claseDictada.findFirst({
      where: { turnoId, anuladaEl: null },
      select: {
        idClaseDictada: true,
        createdAtClaseDictada: true,
        _count: { select: { alumnos: true } },
      },
    });
    if (!clase) throw new Error(`No se pudo recuperar la clase dictada del turno ${turnoId}`);
    return {
      id: clase.idClaseDictada,
      turno_id: turnoId,
      fecha: turno.fecha,
      alumnos_registrados: clase._count.alumnos,
      ya_existia: insercion.count === 0,
    };
  });
}

/** Registro del hecho dictado, resolviendo nombres por los contratos de A y B. */
export async function obtenerRegistroClaseDictada(turnoId: string, usuario: UsuarioHistorial) {
  const clase = await prisma.claseDictada.findFirst({
    where: { turnoId, anuladaEl: null },
    select: {
      idClaseDictada: true,
      profesorId: true,
      creadoPorUsuarioId: true,
      createdAtClaseDictada: true,
      alumnos: { select: { alumnoId: true } },
    },
  });
  if (!clase) throw new ServiceError("CLASE_NO_REGISTRADA", MENSAJES.CLASE_NO_REGISTRADA);

  if (usuario.rol === "PROFESOR") {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id);
    if (!profesor || profesor.id !== clase.profesorId) {
      throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
    }
  }

  const ids = clase.alumnos.map(({ alumnoId }) => alumnoId);
  const [alumnos, registradaPor] = await Promise.all([
    obtenerAlumnosBasicos(ids),
    clase.creadoPorUsuarioId ? obtenerEmailDeUsuario(clase.creadoPorUsuarioId) : Promise.resolve(null),
  ]);
  const porId = new Map(alumnos.map((alumno) => [alumno.id, alumno]));
  const nombres = ids.map((id) => {
    const alumno = porId.get(id);
    if (!alumno) throw new Error(`La clase ${clase.idClaseDictada} referencia al alumno inexistente ${id}`);
    return { id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` };
  }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es-AR"));

  return {
    id: clase.idClaseDictada,
    registrada_en: clase.createdAtClaseDictada.toISOString(),
    registrada_por: registradaPor,
    alumnos: nombres,
  };
}
