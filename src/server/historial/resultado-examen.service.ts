import type { Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { getParametroNumerico } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { profesorAtendioAlumno } from "./historial.publico";
import type { RegistrarResultadoExamenInput } from "./resultado-examen.schema";

const ZONA = "America/Argentina/Buenos_Aires";
const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para registrar exámenes de este alumno",
  MATERIA_NO_CURSADA: "El alumno todavía no cursó esta materia",
  FECHA_EXAMEN_FUTURA: "La fecha del examen no puede ser futura",
  ALUMNO_NO_ENCONTRADO: "No se encontró el alumno",
  ALUMNO_INACTIVO: "El alumno está inactivo",
} as const;

type UsuarioHistorial = { id: string; rol: RolUsuario };

function fechaLocal(ahora: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

async function autorizarYVerificarAlumno(
  alumnoId: string,
  usuario: UsuarioHistorial,
  tx: Prisma.TransactionClient,
) {
  if (usuario.rol === "PROFESOR") {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, tx);
    if (!profesor || !(await profesorAtendioAlumno(profesor.id, alumnoId, tx))) {
      throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
    }
  }
  await verificarAlumnoActivo(alumnoId, tx);
}

async function materiasCursadas(alumnoId: string, tx: Prisma.TransactionClient) {
  const filas = await tx.claseDictadaAlumno.findMany({
    where: { alumnoId },
    select: { clase: { select: { materiaId: true } } },
  });
  return [...new Set(filas.map(({ clase }) => clase.materiaId))];
}

/** Materias cursadas y escala disponibles para el formulario E-06. */
export async function listarOpcionesExamen(alumnoId: string, usuario: UsuarioHistorial) {
  const [datos, min, max] = await Promise.all([
    prisma.$transaction(async (tx) => {
      await autorizarYVerificarAlumno(alumnoId, usuario, tx);
      const ids = await materiasCursadas(alumnoId, tx);
      return obtenerMateriasPorIds(ids, tx);
    }),
    getParametroNumerico("nota_minima", 1),
    getParametroNumerico("nota_maxima", 10),
  ]);
  return {
    materias: datos
      .map(({ id, nombre }) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
    escala: { min, max },
  };
}

/** Alta inmutable de una nota, autorizada según la ficha y el historial del alumno. */
export async function registrarResultadoExamen(
  alumnoId: string,
  input: RegistrarResultadoExamenInput,
  usuario: UsuarioHistorial,
) {
  const [min, max] = await Promise.all([
    getParametroNumerico("nota_minima", 1),
    getParametroNumerico("nota_maxima", 10),
  ]);
  return prisma.$transaction(async (tx) => {
    await autorizarYVerificarAlumno(alumnoId, usuario, tx);

    const cursada = await tx.claseDictadaAlumno.findFirst({
      where: { alumnoId, clase: { is: { materiaId: input.materia_id } } },
      select: { alumnoId: true },
    });
    if (!cursada) throw new ServiceError("MATERIA_NO_CURSADA", MENSAJES.MATERIA_NO_CURSADA);

    const fecha = input.fecha_examen.toISOString().slice(0, 10);
    if (fecha > fechaLocal(new Date())) {
      throw new ServiceError("FECHA_EXAMEN_FUTURA", MENSAJES.FECHA_EXAMEN_FUTURA);
    }

    const nota = Number(input.nota);
    if (nota < min || nota > max) {
      throw new ServiceError("NOTA_FUERA_DE_RANGO", `La nota debe estar entre ${min} y ${max}`);
    }

    const resultado = await tx.resultadoExamen.create({
      data: {
        alumnoId,
        materiaId: input.materia_id,
        fechaExamen: input.fecha_examen,
        notaExamen: input.nota,
        observaciones: input.observaciones?.trim() || null,
        creadoPorUsuarioId: usuario.id,
      },
      select: { idResultadoExamen: true, alumnoId: true, materiaId: true, fechaExamen: true, notaExamen: true, observaciones: true },
    });
    return {
      id: resultado.idResultadoExamen,
      alumno_id: resultado.alumnoId,
      materia_id: resultado.materiaId,
      fecha_examen: resultado.fechaExamen.toISOString().slice(0, 10),
      nota: resultado.notaExamen.toFixed(1),
      observaciones: resultado.observaciones,
    };
  });
}
