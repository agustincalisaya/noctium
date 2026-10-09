import { randomUUID } from "node:crypto";
import { Prisma, type EstadoAsistencia, type RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { bloquear } from "@/server/shared/bloquear";
import { actorUsuario, type ActorDominio } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { bloquearTurnoParaOperacion } from "@/server/turnos/turno.publico";
import { inscripcionesVigentes, marcarVencidas } from "@/server/turnos/inscripcion.publico";
import { turnoYaTermino } from "@/server/turnos/turno.acciones";
import { sqlAsistenciaVigente, sqlConControlVigente } from "@/server/historial/valor-vigente";
import type { RegistrarClaseDictadaInput } from "@/server/historial/clase-dictada.schema";

const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para registrar o consultar esta clase",
  TURNO_NO_ENCONTRADO: "No se encontró el turno",
  TURNO_NO_ADMITE_CLASE: "Solo se puede registrar una clase de un turno disponible o completo",
  CLASE_NO_FINALIZADA: "La clase todavía no terminó",
  CLASE_NO_REGISTRADA: "El turno todavía no tiene una clase dictada registrada",
} as const;

type UsuarioHistorial = { id: string; rol: RolUsuario };
export type DatosRegistroClase = {
  turnoId: string;
  actor: ActorDominio;
  asistencias?: { inscripcionId: string; estado: EstadoAsistencia }[];
};

type FilaAsistencia = { alumno_id: string | null; asistencia: EstadoAsistencia | null; con_control: boolean };
/** Una única consulta aplica el mismo valor vigente que historial e indicadores. */
async function leerAsistencia(db: Tx, claseId: string) {
  const filas = await db.$queryRaw<FilaAsistencia[]>(Prisma.sql`
    SELECT cda."alumnoId" AS alumno_id, ${sqlAsistenciaVigente("cda")} AS asistencia,
           ${sqlConControlVigente("cd")} AS con_control
    FROM "clases_dictadas" cd LEFT JOIN "clases_dictadas_alumnos" cda
      ON cda."claseDictadaId" = cd."idClaseDictada"
    WHERE cd."idClaseDictada" = ${claseId} AND cd."anuladaEl" IS NULL`);
  const alumnos = filas.filter((fila): fila is FilaAsistencia & { alumno_id: string } => fila.alumno_id !== null);
  const control = filas[0]?.con_control ?? false;
  return {
    alumnos,
    control,
    totales: control ? {
      presentes: alumnos.filter(({ asistencia }) => asistencia === "PRESENTE").length,
      ausentes: alumnos.filter(({ asistencia }) => asistencia === "AUSENTE").length,
    } : null,
  };
}

async function prepararClase(tx: Tx, turnoId: string, momento: Date, usuario?: UsuarioHistorial) {
  await bloquear(tx, { clases: [turnoId] });
  const turno = await bloquearTurnoParaOperacion(turnoId, tx);
  if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO", MENSAJES.TURNO_NO_ENCONTRADO);
  if (usuario) {
    if (usuario.rol !== "PROFESOR" && usuario.rol !== "MESA_ENTRADA") {
      throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
    }
    if (usuario.rol === "PROFESOR") {
      const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, tx);
      if (!profesor || profesor.id !== turno.profesor_id) throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
    }
  }
  if (!turno.profesor_id || (turno.estado !== "DISPONIBLE" && turno.estado !== "COMPLETO")) {
    throw new ServiceError("TURNO_NO_ADMITE_CLASE", MENSAJES.TURNO_NO_ADMITE_CLASE);
  }
  if (!turnoYaTermino(new Date(`${turno.fecha}T00:00:00.000Z`),
    new Date(`1970-01-01T${turno.hora_inicio}:00.000Z`), turno.duracion_min, momento)) {
    throw new ServiceError("CLASE_NO_FINALIZADA", MENSAJES.CLASE_NO_FINALIZADA);
  }
  return turno;
}

function validarConjunto(esperados: string[], recibidos: string[]) {
  const conjunto = new Set(recibidos);
  const repeticiones = recibidos.filter((id, indice) => recibidos.indexOf(id) !== indice);
  const detalles = {
    faltan: esperados.filter((id) => !conjunto.has(id)),
    sobran: [...conjunto].filter((id) => !esperados.includes(id)),
    repetidos: [...new Set(repeticiones)],
  };
  if (detalles.faltan.length || detalles.sobran.length || detalles.repetidos.length) {
    throw new ErrorDeDominio("errores.asistencia.incompleta", detalles);
  }
}

async function respuestaRegistro(tx: Tx, turnoId: string, fecha: string, id: string, yaExistia: boolean) {
  const asistencia = await leerAsistencia(tx, id);
  return {
    id, turno_id: turnoId, fecha, alumnos_registrados: asistencia.alumnos.length, ya_existia: yaExistia,
    con_control_asistencia: asistencia.control,
    presentes: asistencia.totales?.presentes ?? null, ausentes: asistencia.totales?.ausentes ?? null,
  };
}

/**
 * Contrato público de registro, para consumidores de confianza (seed/H-07).
 * El llamador abre transaccion() y aporta el actor de dominio; este core toma
 * el bloqueo canónico. La entrada HTTP valida además el rol/propiedad.
 */
export async function registrarClaseDictada(tx: Tx, datos: DatosRegistroClase) {
  const momento = ahora();
  const turno = await prepararClase(tx, datos.turnoId, momento);
  return guardarRegistro(tx, datos, turno, momento);
}

async function guardarRegistro(tx: Tx, datos: DatosRegistroClase, turno: Awaited<ReturnType<typeof prepararClase>>, momento: Date) {
  const existente = await tx.claseDictada.findFirst({ where: { turnoId: datos.turnoId, anuladaEl: null }, select: { idClaseDictada: true } });
  if (existente) return respuestaRegistro(tx, datos.turnoId, turno.fecha, existente.idClaseDictada, true);
  await marcarVencidas(tx, datos.turnoId, { momento });
  const inscriptos = await inscripcionesVigentes(tx, datos.turnoId, momento);
  if (datos.asistencias !== undefined) validarConjunto(inscriptos.map(({ id }) => id), datos.asistencias.map(({ inscripcionId }) => inscripcionId));
  const id = randomUUID();
  const control = datos.asistencias !== undefined;
  const usuarioId = datos.actor.tipo === "USUARIO" ? datos.actor.usuarioId : null;
  const insertadas = await tx.$executeRaw(Prisma.sql`
    INSERT INTO "clases_dictadas" ("idClaseDictada", "turnoId", "fechaClaseDictada", "materiaId", "profesorId",
      "createdAtClaseDictada", "creadoPorUsuarioId", "conControlAsistencia")
    VALUES (${id}, ${datos.turnoId}, ${turno.fecha}::date, ${turno.materia_id}, ${turno.profesor_id},
      ${momento}, ${usuarioId}, ${control})
    ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING`);
  if (!insertadas) {
    const ganadora = await tx.claseDictada.findFirstOrThrow({ where: { turnoId: datos.turnoId, anuladaEl: null }, select: { idClaseDictada: true } });
    return respuestaRegistro(tx, datos.turnoId, turno.fecha, ganadora.idClaseDictada, true);
  }
  const estados = new Map(datos.asistencias?.map(({ inscripcionId, estado }) => [inscripcionId, estado]));
  if (inscriptos.length) await tx.claseDictadaAlumno.createMany({ data: inscriptos.map((inscripcion) => ({
    claseDictadaId: id, alumnoId: inscripcion.alumnoId, estadoAsistencia: estados.get(inscripcion.id) ?? null,
  })) });
  return respuestaRegistro(tx, datos.turnoId, turno.fecha, id, false);
}

/** Entrada de aplicación: la conversión HTTP se hace bajo el bloqueo, nunca en la ruta. */
export async function registrarClaseDictadaDesdeSolicitud(turnoId: string, usuario: UsuarioHistorial, asistencias?: RegistrarClaseDictadaInput["asistencias"]) {
  const momento = ahora();
  return transaccion(async (tx) => {
    const turno = await prepararClase(tx, turnoId, momento, usuario);
    const existente = await tx.claseDictada.findFirst({ where: { turnoId, anuladaEl: null }, select: { idClaseDictada: true } });
    if (existente) return respuestaRegistro(tx, turnoId, turno.fecha, existente.idClaseDictada, true);
    await marcarVencidas(tx, turnoId, { momento });
    // El conjunto vigente se decide en la misma transacción y con el mismo momento.
    // guardarRegistro vuelve a leerlo después de marcar los vencimientos.
    const inscriptos = await inscripcionesVigentes(tx, turnoId, momento);
    if (asistencias !== undefined) validarConjunto(inscriptos.map(({ alumnoId }) => alumnoId), asistencias.map(({ alumno_id }) => alumno_id));
    const porAlumno = new Map(inscriptos.map(({ id, alumnoId }) => [alumnoId, id]));
    return guardarRegistro(tx, {
      turnoId, actor: actorUsuario(usuario.id),
      asistencias: asistencias?.map(({ alumno_id, estado }) => ({ inscripcionId: porAlumno.get(alumno_id)!, estado })),
    }, turno, momento);
  });
}

/** Registro del hecho dictado, resolviendo nombres por los contratos de A y B. */
export async function obtenerRegistroClaseDictada(turnoId: string, usuario: UsuarioHistorial) {
  const clase = await prisma.claseDictada.findFirst({
    where: { turnoId, anuladaEl: null },
    select: { idClaseDictada: true, profesorId: true, creadoPorUsuarioId: true, createdAtClaseDictada: true },
  });
  if (!clase) throw new ServiceError("CLASE_NO_REGISTRADA", MENSAJES.CLASE_NO_REGISTRADA);
  if (usuario.rol === "PROFESOR") {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id);
    if (!profesor || profesor.id !== clase.profesorId) throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
  }
  const asistencia = await leerAsistencia(prisma, clase.idClaseDictada);
  const ids = asistencia.alumnos.map(({ alumno_id }) => alumno_id);
  const [alumnos, registradaPor] = await Promise.all([
    obtenerAlumnosBasicos(ids),
    clase.creadoPorUsuarioId ? obtenerEmailDeUsuario(clase.creadoPorUsuarioId) : Promise.resolve(null),
  ]);
  const porId = new Map(alumnos.map((alumno) => [alumno.id, alumno]));
  const nombres = asistencia.alumnos.map(({ alumno_id: id, asistencia }) => {
    const alumno = porId.get(id);
    if (!alumno) throw new Error(`La clase ${clase.idClaseDictada} referencia al alumno inexistente ${id}`);
    return { id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}`, asistencia };
  }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es-AR"));
  return {
    id: clase.idClaseDictada, registrada_en: clase.createdAtClaseDictada.toISOString(), registrada_por: registradaPor,
    alumnos: nombres, con_control_asistencia: asistencia.control, totales: asistencia.totales,
  };
}
