import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { minutosAHora } from "@/lib/horario-atencion";
import { formatearApellidoNombre } from "@/lib/profesor-listado";
import type {
  HorarioDeAtencionPublico,
  MateriaDeProfesor,
  OpcionProfesor,
  OpcionProfesorConNombre,
} from "@/types/profesor.types";
import { profesorActivoDictaMateria as profesorActivoDictaMateriaDelServicio } from "@/server/profesores/profesor.service";

/**
 * Servicios públicos del módulo D (`spec_modulo_D.md` §2.8, Regla N.° 3).
 * No importa nada de otros módulos. Las funciones nuevas replican los
 * filtros y el orden de `profesor.service.ts` y aceptan el `db` del llamador.
 */

export { listarProfesoresActivosPorMateria } from "@/server/profesores/profesor.service";
export { estaDentroDeHorarioAtencion } from "@/server/profesores/profesor.service";

/** Misma conversión que `minutosDeTime` de profesor.service.ts (`@db.Time` sobre 1970-01-01 UTC). */
function minutosDeTime(hora: Date): number {
  return hora.getUTCHours() * 60 + hora.getUTCMinutes();
}

function aHorarioPublico(fila: {
  idHorario: string;
  diaSemanaHorario: HorarioDeAtencionPublico["dia_semana"];
  horaDesdeHorario: Date;
  horaHastaHorario: Date;
}): HorarioDeAtencionPublico {
  return {
    horario_id: fila.idHorario,
    dia_semana: fila.diaSemanaHorario,
    hora_inicio: minutosAHora(minutosDeTime(fila.horaDesdeHorario)),
    hora_fin: minutosAHora(minutosDeTime(fila.horaHastaHorario)),
  };
}

const SELECT_HORARIO = {
  idHorario: true,
  diaSemanaHorario: true,
  horaDesdeHorario: true,
  horaHastaHorario: true,
} satisfies Prisma.HorarioProfesorSelect;

const SELECT_OPCION = {
  idProfesor: true,
  nombreProfesor: true,
  apellidoProfesor: true,
} satisfies Prisma.ProfesorSelect;

function aOpcionProfesor(profesor: { idProfesor: string; nombreProfesor: string; apellidoProfesor: string }): OpcionProfesor {
  return {
    id: profesor.idProfesor,
    nombreParaMostrar: formatearApellidoNombre(profesor.apellidoProfesor, profesor.nombreProfesor),
  };
}

/**
 * Profesores activos para selectores, con el mismo filtro y orden que
 * `listarOpcionesProfesoresActivos()` del service (apellido y nombre
 * normalizados, DNI como desempate).
 */
export async function listarOpcionesProfesoresActivos(
  db: Prisma.TransactionClient = prisma,
): Promise<OpcionProfesorConNombre[]> {
  const profesores = await db.profesor.findMany({
    where: { activoProfesor: true },
    select: SELECT_OPCION,
    orderBy: [
      { apellidoNormalizadoProfesor: "asc" },
      { nombreNormalizadoProfesor: "asc" },
      { dniProfesor: "asc" },
    ],
  });
  return profesores.map((profesor) => ({
    ...aOpcionProfesor(profesor),
    nombre: profesor.nombreProfesor,
    apellido: profesor.apellidoProfesor,
  }));
}

/** Horarios de atención del profesor, ordenados por día (lunes primero) y hora de inicio. */
export async function obtenerHorariosDeAtencion(
  profesorId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<HorarioDeAtencionPublico[]> {
  const filas = await db.horarioProfesor.findMany({
    where: { profesorId },
    select: SELECT_HORARIO,
    orderBy: [{ diaSemanaHorario: "asc" }, { horaDesdeHorario: "asc" }],
  });
  return filas.map(aHorarioPublico);
}

/** Un horario de atención, o `null` si no existe o no pertenece a ese profesor. */
export async function obtenerHorarioDeProfesor(
  profesorId: string,
  horarioId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<HorarioDeAtencionPublico | null> {
  const fila = await db.horarioProfesor.findFirst({
    where: { idHorario: horarioId, profesorId },
    select: SELECT_HORARIO,
  });
  return fila ? aHorarioPublico(fila) : null;
}

/** `{ [id]: "Apellido, Nombre" }` en lote, activos e inactivos; los ids inexistentes no aparecen. */
export async function obtenerNombresProfesores(
  ids: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<Record<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return {};

  const profesores = await db.profesor.findMany({
    where: { idProfesor: { in: unicos } },
    select: SELECT_OPCION,
  });
  return Object.fromEntries(
    profesores.map((profesor) => [
      profesor.idProfesor,
      formatearApellidoNombre(profesor.apellidoProfesor, profesor.nombreProfesor),
    ]),
  );
}

/**
 * Datos básicos en lote (spec_modulo_H.md §2.8.4), de profesores activos o
 * inactivos, en el orden de los ids; los inexistentes no aparecen.
 * `nombreParaMostrar` es «Apellido, Nombre». Aditiva: `obtenerNombresProfesores`
 * y `listarOpcionesProfesoresActivos` no cambian.
 */
export async function obtenerProfesoresBasicos(
  ids: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; nombre: string; apellido: string; nombreParaMostrar: string; activo: boolean }[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  const profesores = await db.profesor.findMany({
    where: { idProfesor: { in: unicos } },
    select: { idProfesor: true, nombreProfesor: true, apellidoProfesor: true, activoProfesor: true },
  });
  const porId = new Map(profesores.map((profesor) => [profesor.idProfesor, profesor]));
  return unicos.flatMap((id) => {
    const profesor = porId.get(id);
    return profesor
      ? [{
          id,
          nombre: profesor.nombreProfesor,
          apellido: profesor.apellidoProfesor,
          nombreParaMostrar: formatearApellidoNombre(profesor.apellidoProfesor, profesor.nombreProfesor),
          activo: profesor.activoProfesor,
        }]
      : [];
  });
}

/** Ficha vinculada a la cuenta, o `null`. No filtra por activo. */
export async function obtenerOpcionProfesorDeUsuario(
  usuarioId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<OpcionProfesor | null> {
  const profesor = await db.profesor.findUnique({ where: { usuarioId }, select: SELECT_OPCION });
  return profesor ? aOpcionProfesor(profesor) : null;
}

/** El profesor activo con ese id, o `null` si no existe o está inactivo. */
export async function obtenerOpcionProfesorActivo(
  profesorId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<OpcionProfesor | null> {
  const profesor = await db.profesor.findFirst({
    where: { idProfesor: profesorId, activoProfesor: true },
    select: SELECT_OPCION,
  });
  return profesor ? aOpcionProfesor(profesor) : null;
}

/** Todas las materias asociadas (activas o no, ver `activa`), ordenadas por nombre normalizado. */
export async function obtenerMateriasDelProfesor(
  profesorId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<MateriaDeProfesor[]> {
  const asociaciones = await db.profesorMateria.findMany({
    where: { profesorId },
    select: {
      materia: {
        select: { idMateria: true, nombreMateria: true, codigoMateria: true, activaMateria: true },
      },
    },
    orderBy: { materia: { nombreNormalizadaMateria: "asc" } },
  });
  return asociaciones.map(({ materia }) => ({
    id: materia.idMateria,
    nombre: materia.nombreMateria,
    codigo: materia.codigoMateria,
    activa: materia.activaMateria,
  }));
}

/**
 * `true` si el profesor está activo y tiene asociada la materia.
 * - Sin `db`: delega en la versión del service (comportamiento de siempre).
 * - Con `db`: mismas condiciones, pero bloquea la fila de `profesor_materia`
 *   con `FOR SHARE` hasta que termine la transacción del llamador
 *   (`spec_modulo_D.md` §2.8). La fila del profesor no se bloquea.
 */
export async function profesorActivoDictaMateria(
  profesorId: string,
  materiaId: string,
  db?: Prisma.TransactionClient,
): Promise<boolean> {
  if (!db) return profesorActivoDictaMateriaDelServicio(profesorId, materiaId);

  const filas = await db.$queryRaw<{ profesorId: string }[]>`
    SELECT pm."profesorId"
    FROM "profesores" p
    JOIN "profesor_materia" pm ON pm."profesorId" = p."idProfesor"
    WHERE p."idProfesor" = ${profesorId}
      AND p."activoProfesor" = true
      AND pm."materiaId" = ${materiaId}
    FOR SHARE OF pm
  `;
  return filas.length > 0;
}
