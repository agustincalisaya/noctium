import { claseDictadaVigente } from "./valor-vigente";
import type { Prisma, PrismaClient, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import { ahora } from "@/server/shared/reloj";
import { validarContextoIndicacion } from "@/server/historial/contexto-indicacion.service";
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
    await validarContextoIndicacion(input.contexto_origen, usuario.id, alumnoId, input.materia_id, tx);
  }

  await verificarAlumnoActivo(alumnoId, tx);

  const cursada = await tx.claseDictadaAlumno.findFirst({
    where: { alumnoId, clase: { is: { materiaId: input.materia_id, ...claseDictadaVigente } } },
    select: { alumnoId: true },
  });
  if (!cursada) throw new ErrorDeDominio("errores.examen.materiaNoCursada");

  if (input.clase_dictada_id) {
    const clase = await tx.claseDictada.findFirst({
      where: { idClaseDictada: input.clase_dictada_id, ...claseDictadaVigente },
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
      ...claseDictadaVigente,
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
