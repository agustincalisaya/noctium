import { prisma } from "@/lib/prisma";
import { getParametroNumerico } from "@/server/shared/parametros";
import type { RolUsuario } from "@prisma/client";

const turnoInclude = {
  materia: { select: { idMateria: true, nombreMateria: true, codigoMateria: true } },
  profesor: { select: { idProfesor: true, apellidoProfesor: true, nombreProfesor: true, dniProfesor: true } },
  aula: { select: { idAula: true, nombreAula: true, capacidadAula: true } },
  alumnos: { include: { alumno: { select: { idAlumno: true, apellidoAlumno: true, nombreAlumno: true, dniAlumno: true } } } },
} as const;

function fecha(date: Date) { return date.toISOString().slice(0, 10); }
function hora(date: Date) { return date.toISOString().slice(11, 16); }
function nombre(apellido: string, primero: string) { return `${apellido}, ${primero}`; }

type TurnoConRelaciones = NonNullable<Awaited<ReturnType<typeof prisma.turno.findFirst<{ include: typeof turnoInclude }>>>>;

function presentar(turno: TurnoConRelaciones) {
  const fin = new Date(turno.horaInicioTurno.getTime() + turno.duracionMinutosTurno * 60_000);
  const alumnos = turno.alumnos.map(({ alumno }) => ({ id: alumno.idAlumno, nombre: nombre(alumno.apellidoAlumno, alumno.nombreAlumno), dni: alumno.dniAlumno }));
  const alumno = alumnos[0];
  return {
    id: turno.idTurno,
    fecha: fecha(turno.fechaTurno),
    hora_inicio: hora(turno.horaInicioTurno),
    hora_fin: hora(fin),
    duracion_minutos: turno.duracionMinutosTurno,
    alumno: alumnos.length ? alumnos.map(({ nombre }) => nombre).join("; ") : "Sin asignar",
    alumnos,
    alumno_id: alumno?.id ?? null,
    alumno_dni: alumno?.dni ?? null,
    profesor: turno.profesor ? nombre(turno.profesor.apellidoProfesor, turno.profesor.nombreProfesor) : "Sin asignar",
    profesor_id: turno.profesorId,
    profesor_dni: turno.profesor?.dniProfesor ?? null,
    materia: turno.materia.nombreMateria,
    materia_id: turno.materiaId,
    materia_codigo: turno.materia.codigoMateria,
    aula: turno.aula?.nombreAula ?? "Sin asignar",
    aula_id: turno.aulaId,
    aula_capacidad: turno.aula?.capacidadAula ?? null,
    estado: turno.estadoTurno,
    creado_en: turno.createdAtTurno.toISOString(),
    actualizado_en: turno.updatedAtTurno.toISOString(),
    creado_por_id: turno.creadoPorUsuarioId,
  };
}

export async function listarTurnos(pagina: number, porPaginaSolicitado: number | undefined, usuario: { id: string; rol: RolUsuario }) {
  const configurado = await getParametroNumerico("paginacion_limite_default", 10);
  const porPagina = porPaginaSolicitado ?? Math.min(20, Math.max(1, Math.trunc(configurado)));
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find(({ type }) => type === tipo)!.value;
  const inicioHoy = new Date(`${parte("year")}-${parte("month")}-${parte("day")}T00:00:00.000Z`);
  const where = {
    fechaTurno: { gte: inicioHoy },
    ...(usuario.rol === "PROFESOR" ? { profesor: { is: { usuarioId: usuario.id } } } : {}),
  };
  const total = await prisma.turno.count({ where });
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));
  const turnos = await prisma.turno.findMany({
      where,
      include: turnoInclude,
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { profesorId: { sort: "asc", nulls: "last" } }, { idTurno: "asc" }],
      skip: (paginaActual - 1) * porPagina,
      take: porPagina,
    });
  return {
    items: turnos.map(presentar),
    paginacion: { total, pagina_actual: paginaActual, total_paginas: Math.ceil(total / porPagina), por_pagina: porPagina },
  };
}

export async function obtenerTurno(id: string, usuario: { id: string; rol: RolUsuario }) {
  const turno = await prisma.turno.findFirst({
    where: { idTurno: id, ...(usuario.rol === "PROFESOR" ? { profesor: { is: { usuarioId: usuario.id } } } : {}) },
    include: turnoInclude,
  });
  if (!turno) return null;
  const responsable = turno.creadoPorUsuarioId
    ? await prisma.usuario.findUnique({ where: { idUsuario: turno.creadoPorUsuarioId }, select: { emailUsuario: true } })
    : null;
  return { ...presentar(turno), creado_por: responsable?.emailUsuario ?? turno.creadoPorUsuarioId ?? "Sin registrar" };
}
