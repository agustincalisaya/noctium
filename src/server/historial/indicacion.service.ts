import type { Prisma, PrismaClient, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { ahora } from "@/server/shared/reloj";
import { profesorPuedeRegistrarIndicacion } from "./historial.publico";
import type { RegistrarIndicacionInput } from "./indicacion.schema";

type UsuarioHistorial = { id: string; rol: RolUsuario };

/** Registra una indicación nueva; el llamador abre transaccion() y aporta el tx. */
export async function registrarIndicacion(
  tx: Prisma.TransactionClient,
  alumnoId: string,
  input: RegistrarIndicacionInput,
  usuario: UsuarioHistorial,
) {
  if (usuario.rol !== "MESA_ENTRADA" && usuario.rol !== "PROFESOR") {
    throw new ServiceError("SIN_PERMISO", "No tenés permiso para registrar indicaciones");
  }

  // El profesor debe quedar fuera antes de consultar la existencia del alumno.
  if (usuario.rol === "PROFESOR") {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, tx);
    if (!profesor || !(await profesorPuedeRegistrarIndicacion(profesor.id, alumnoId, input.materia_id, tx))) {
      throw new ServiceError("SIN_PERMISO", "Solo podés registrar indicaciones en materias de tus clases dictadas con este alumno");
    }
  }

  await verificarAlumnoActivo(alumnoId, tx);

  const cursada = await tx.claseDictadaAlumno.findFirst({
    where: { alumnoId, clase: { is: { materiaId: input.materia_id, anuladaEl: null } } },
    select: { alumnoId: true },
  });
  if (!cursada) throw new ErrorDeDominio("errores.examen.materiaNoCursada");

  if (input.clase_dictada_id) {
    const clase = await tx.claseDictada.findFirst({
      where: { idClaseDictada: input.clase_dictada_id, anuladaEl: null },
      select: { materiaId: true, alumnos: { where: { alumnoId }, select: { alumnoId: true } } },
    });
    if (!clase) throw new ErrorDeDominio("errores.claseDictada.noEncontrada");
    if (clase.materiaId !== input.materia_id || clase.alumnos.length === 0) {
      throw new ErrorDeDominio("errores.claseDictada.noCorresponde");
    }
  }

  const registradaEn = ahora();
  const indicacion = await tx.indicacion.create({
    data: {
      alumnoId,
      materiaId: input.materia_id,
      claseDictadaId: input.clase_dictada_id ?? null,
      texto: input.indicacion,
      createdAtIndicacion: registradaEn,
      creadoPorUsuarioId: usuario.id,
    },
    select: { idIndicacion: true, alumnoId: true, materiaId: true, claseDictadaId: true, texto: true, createdAtIndicacion: true },
  });
  const email = await obtenerEmailDeUsuario(usuario.id);
  return {
    id: indicacion.idIndicacion,
    alumno_id: indicacion.alumnoId,
    materia_id: indicacion.materiaId,
    indicacion: indicacion.texto,
    clase_dictada_id: indicacion.claseDictadaId,
    registrada_en: indicacion.createdAtIndicacion.toISOString(),
    registrada_por: email,
  };
}

export type ClaseOpcionIndicacion = { id: string; materia_id: string; fecha: string };

/** Materias y clases dictadas no anuladas donde figura el alumno para el formulario. */
export async function opcionesDeIndicacion(
  alumnoId: string,
  materiaId?: string,
  db: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<{ materias: { id: string; nombre: string }[]; clases: ClaseOpcionIndicacion[] }> {
  const clases = await db.claseDictada.findMany({
    where: {
      anuladaEl: null,
      ...(materiaId ? { materiaId } : {}),
      alumnos: { some: { alumnoId } },
    },
    select: { idClaseDictada: true, materiaId: true, fechaClaseDictada: true },
    orderBy: [{ fechaClaseDictada: "desc" }, { idClaseDictada: "desc" }],
  });
  const materias = await obtenerMateriasPorIds([...new Set(clases.map(({ materiaId: id }) => id))], db);
  return {
    materias: materias.map(({ id, nombre }) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
    clases: clases.map((clase) => ({ id: clase.idClaseDictada, materia_id: clase.materiaId, fecha: clase.fechaClaseDictada.toISOString().slice(0, 10) })),
  };
}
