import type { Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoBasico } from "@/server/alumnos/alumno.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerNombresProfesores, obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { existeInscripcionVigenteConProfesor } from "@/server/turnos/inscripcion.publico";
import { profesorAtendioAlumno, profesorPuedeRegistrarIndicacion, asistenciaDeAlumno } from "./historial.publico";
import type { HistorialQuery } from "./historial.schema";

const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para acceder al historial de este alumno",
  ALUMNO_NO_ENCONTRADO: "No se encontró el alumno",
} as const;

import { sqlAsistenciaVigente, sqlClaseDictadaVigente } from "@/server/historial/valor-vigente";

type FilaHistorial = {
  asistencia: "PRESENTE" | "AUSENTE" | null;
  total: bigint;
  materias_disponibles: string[];
  tipo: "CLASE_DICTADA" | "EXAMEN" | null;
  fecha: Date | null;
  materia_id: string | null;
  profesor_id: string | null;
  nota: Prisma.Decimal | string | number | null;
  observaciones: string | null;
  turno_id: string | null;
  registro_id: string | null;
};

type UsuarioHistorial = { id: string; rol: RolUsuario };

function fechaCalendario(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

async function autorizarAlcanceAlumno(
  alumnoId: string,
  usuario: UsuarioHistorial,
  db: Prisma.TransactionClient = prisma,
) {
  if (usuario.rol !== "PROFESOR") return;
  const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, db);
  if (!profesor || !(await profesorAtendioAlumno(profesor.id, alumnoId, db))) {
    throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
  }
}

/** Historial unificado: la unión, el filtro y la paginación se resuelven en PostgreSQL. */
export async function obtenerHistorialAlumno(
  alumnoId: string,
  query: HistorialQuery,
  usuario: UsuarioHistorial,
) {
  await autorizarAlcanceAlumno(alumnoId, usuario);
  const alumno = await obtenerAlumnoBasico(alumnoId);
  if (!alumno) throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);

  const limite = query.por_pagina;
  const offset = (query.pagina - 1) * limite;
  const filtroMateria = query.materia_id ?? null;
  const filas = await prisma.$queryRaw<FilaHistorial[]>`
    WITH registros AS (
      SELECT
        'CLASE_DICTADA'::text AS tipo,
        clase."fechaClaseDictada" AS fecha,
        clase."materiaId" AS materia_id,
        clase."profesorId" AS profesor_id,
        NULL::numeric AS nota,
        NULL::text AS observaciones,
        clase."turnoId" AS turno_id,
        clase."createdAtClaseDictada" AS creado_en,
        clase."idClaseDictada" AS registro_id,
        ${sqlAsistenciaVigente("inscripto")} AS asistencia
      FROM "clases_dictadas" AS clase
      INNER JOIN "clases_dictadas_alumnos" AS inscripto
        ON inscripto."claseDictadaId" = clase."idClaseDictada"
      WHERE inscripto."alumnoId" = ${alumnoId} AND ${sqlClaseDictadaVigente("clase")}
      UNION ALL
      SELECT
        'EXAMEN'::text AS tipo,
        examen."fechaExamen" AS fecha,
        examen."materiaId" AS materia_id,
        NULL::text AS profesor_id,
        examen."notaExamen" AS nota,
        examen."observaciones" AS observaciones,
        NULL::text AS turno_id,
        examen."createdAtResultadoExamen" AS creado_en,
        examen."idResultadoExamen" AS registro_id,
        NULL::"EstadoAsistencia" AS asistencia
      FROM "resultados_examen" AS examen
      WHERE examen."alumnoId" = ${alumnoId}
    ),
    filtrados AS (
      SELECT * FROM registros
      WHERE ${filtroMateria}::text IS NULL OR materia_id = ${filtroMateria}::text
    ),
    conteo AS (
      SELECT COUNT(*)::bigint AS total FROM filtrados
    ),
    materias AS (
      SELECT COALESCE(array_agg(materia_id ORDER BY materia_id), ARRAY[]::text[]) AS ids
      FROM (SELECT DISTINCT materia_id FROM registros) AS distintas
    ),
    pagina AS (
      SELECT * FROM filtrados
      ORDER BY fecha DESC, creado_en DESC, registro_id DESC
      LIMIT ${limite} OFFSET ${offset}
    )
    SELECT conteo.total, materias.ids AS materias_disponibles,
      pagina.tipo, pagina.fecha, pagina.materia_id, pagina.profesor_id,
      pagina.nota, pagina.observaciones, pagina.turno_id, pagina.registro_id, pagina.asistencia
    FROM conteo CROSS JOIN materias
    LEFT JOIN pagina ON TRUE
    ORDER BY pagina.fecha DESC NULLS LAST, pagina.creado_en DESC NULLS LAST, pagina.registro_id DESC NULLS LAST
  `;

  const filaInicial = filas[0];
  const total = Number(filaInicial?.total ?? 0);
  const registros = filas.filter((fila) => fila.tipo !== null);
  const [materias, profesores] = await Promise.all([
    obtenerMateriasPorIds(filaInicial?.materias_disponibles ?? []),
    obtenerNombresProfesores(registros.flatMap((fila) => fila.profesor_id ? [fila.profesor_id] : [])),
  ]);
  const materiasPorId = new Map(materias.map((materia) => [materia.id, materia.nombre]));

  const items = registros.map((fila) => {
    if (!fila.fecha || !fila.materia_id || !fila.registro_id) {
      throw new Error("La consulta de historial devolvió una fila incompleta");
    }
    const nombreMateria = materiasPorId.get(fila.materia_id);
    if (!nombreMateria) throw new Error(`No se encontró la materia ${fila.materia_id} de un registro académico`);
    if (fila.tipo === "CLASE_DICTADA") {
      if (!fila.profesor_id || !fila.turno_id) throw new Error(`La clase ${fila.registro_id} no tiene profesor o turno`);
      const profesor = profesores[fila.profesor_id];
      if (!profesor) throw new Error(`No se encontró el profesor ${fila.profesor_id} de la clase ${fila.registro_id}`);
      return {
        tipo: "CLASE_DICTADA" as const,
        fecha: fechaCalendario(fila.fecha),
        materia: { id: fila.materia_id, nombre: nombreMateria },
        profesor,
        turno_id: fila.turno_id,
        asistencia: fila.asistencia ?? null,
      };
    }
    return {
      tipo: "EXAMEN" as const,
      fecha: fechaCalendario(fila.fecha),
      materia: { id: fila.materia_id, nombre: nombreMateria },
      nota: String(fila.nota),
      observaciones: fila.observaciones,
    };
  });

  // Resumen completo: no cambia con el filtro ni con la página.
  // El campo aditivo no amplía el alcance del Profesor. Hasta E-02 no hay
  // contexto obligatorio de materia en la navegación existente: sin él no
  // se entrega resumen; con él se verifica el alcance específico de E.
  let asistenciaPorMateria: Awaited<ReturnType<typeof asistenciaDeAlumno>> = [];
  if (usuario.rol !== "PROFESOR") asistenciaPorMateria = await asistenciaDeAlumno(alumnoId);
  else if (query.materia_id) {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id);
    if (profesor && await profesorPuedeVerHistorial(profesor.id, alumnoId, query.materia_id)) {
      asistenciaPorMateria = await asistenciaDeAlumno(alumnoId, query.materia_id);
    }
  }
  return {
    asistencia_por_materia: asistenciaPorMateria,
    alumno: { id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` },
    materias_disponibles: materias
      .map(({ id, nombre }) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
    items,
    paginacion: {
      total,
      pagina_actual: query.pagina,
      total_paginas: Math.ceil(total / limite),
      por_pagina: limite,
    },
  };
}

/**
 * Alcance del Profesor sobre el historial académico (convención 8 g, PR-0.md
 * §2.9, spec_modulo_E.md §2.5.3). Vive en el servicio de E y no en la
 * fachada, porque combina una lectura de C con una de E (R2-PR0-4).
 *
 * `true` si el alumno tiene una inscripción vigente en una clase de ese
 * profesor y esa materia (incluidas las futuras), o si figura en el registro
 * de una clase dictada no anulada de ese profesor y esa materia. Con `false`
 * el servidor responde 403 antes de consultar si el alumno existe.
 */
export async function profesorPuedeVerHistorial(
  profesorId: string,
  alumnoId: string,
  materiaId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  return (await existeInscripcionVigenteConProfesor(alumnoId, profesorId, materiaId, db))
    || (await profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db));
}
