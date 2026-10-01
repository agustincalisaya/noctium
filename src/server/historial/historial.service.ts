import type { Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoBasico } from "@/server/alumnos/alumno.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerNombresProfesores, obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { ServiceError } from "@/server/shared/service-error";
import { profesorAtendioAlumno } from "./historial.publico";
import type { HistorialQuery } from "./historial.schema";

const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para acceder al historial de este alumno",
  ALUMNO_NO_ENCONTRADO: "No se encontró el alumno",
} as const;

type FilaHistorial = {
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
        clase."idClaseDictada" AS registro_id
      FROM "clases_dictadas" AS clase
      INNER JOIN "clases_dictadas_alumnos" AS inscripto
        ON inscripto."claseDictadaId" = clase."idClaseDictada"
      WHERE inscripto."alumnoId" = ${alumnoId}
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
        examen."idResultadoExamen" AS registro_id
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
      pagina.nota, pagina.observaciones, pagina.turno_id, pagina.registro_id
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

  return {
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
