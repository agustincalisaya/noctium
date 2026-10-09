import { Prisma, type RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoBasico } from "@/server/alumnos/alumno.publico";
import { listarInscripcionesDeAlumno, type InscripcionDeAlumno } from "@/server/turnos/inscripcion.publico";
import { ahora } from "@/server/shared/reloj";
import { instanteCentro } from "@/server/shared/fechas-centro";
import { ServiceError } from "@/server/shared/service-error";
import { sqlAsistenciaVigente, sqlClaseDictadaVigente } from "./valor-vigente";
import { RESULTADOS_CLASE_ALUMNO, type ClasesAlumnoQuery } from "./clases-alumno.schema";
import type { ClaseDelAlumno, ClasesAlumnoData, ResultadoClaseAlumno } from "@/types/clases-alumno.types";

type HechoAsistencia = { turno_id: string; asistencia: "PRESENTE" | "AUSENTE" | null };
function clasificar(i: InscripcionDeAlumno, hecho: HechoAsistencia | undefined, momento: Date): { resultado: ResultadoClaseAlumno; sin_control_asistencia: boolean } {
  let resultado: ResultadoClaseAlumno;
  if (i.vigencia !== "VIGENTE") {
    resultado = i.estado_clase === "CANCELADO" && i.finalizada_el && i.cancelada_el && i.finalizada_el > i.cancelada_el ? "CANCELADA_CENTRO" : i.vigencia;
  } else if (!i.vigente_ahora) resultado = "RESERVA_VENCIDA";
  else if (i.estado_clase === "CANCELADO") resultado = "CANCELADA_CENTRO";
  else if (instanteCentro(i.fecha, i.hora_inicio) > momento) resultado = "PROXIMA";
  else if (hecho) resultado = hecho.asistencia === "AUSENTE" ? "AUSENTE" : "ASISTIO";
  else resultado = "SIN_REGISTRAR_COMO_DICTADA";
  return { resultado, sin_control_asistencia: resultado === "ASISTIO" && hecho?.asistencia === null };
}
export async function listarClasesDelAlumno(alumnoId: string, query: ClasesAlumnoQuery, usuario: { id: string; rol: RolUsuario }): Promise<ClasesAlumnoData> {
  if (usuario.rol !== "MESA_ENTRADA" && usuario.rol !== "GERENTE") throw new ServiceError("SIN_PERMISO", "No tenés permisos para consultar las clases de este alumno");
  const alumno = await obtenerAlumnoBasico(alumnoId);
  if (!alumno) throw new ServiceError("ALUMNO_NO_ENCONTRADO", "No se encontró el alumno");
  const inscripciones = await listarInscripcionesDeAlumno(alumnoId, { desde: query.desde?.toISOString().slice(0, 10), hasta: query.hasta?.toISOString().slice(0, 10) });
  const ids = [...new Set(inscripciones.map(i => i.turno_id))];
  const hechos = ids.length === 0 ? [] : await prisma.$queryRaw<HechoAsistencia[]>(Prisma.sql`
    SELECT clase."turnoId" AS turno_id, ${sqlAsistenciaVigente("inscripto")} AS asistencia
    FROM "clases_dictadas" clase JOIN "clases_dictadas_alumnos" inscripto ON inscripto."claseDictadaId"=clase."idClaseDictada"
    WHERE inscripto."alumnoId"=${alumnoId} AND clase."turnoId" IN (${Prisma.join(ids)}) AND ${sqlClaseDictadaVigente("clase")}
  `);
  const porTurno = new Map(hechos.map(h => [h.turno_id, h]));
  const momento = ahora();
  const filas: ClaseDelAlumno[] = inscripciones.map(i => ({ inscripcion_id: i.inscripcion_id, turno_id: i.turno_id, fecha: i.fecha, hora_inicio: i.hora_inicio, hora_fin: i.hora_fin, materia: i.materia, profesor: i.profesor, aula: i.aula, ...clasificar(i, porTurno.get(i.turno_id), momento) }))
    .filter(i => !query.resultado || i.resultado === query.resultado)
    .sort((a,b) => b.fecha.localeCompare(a.fecha) || b.hora_inicio.localeCompare(a.hora_inicio) || b.inscripcion_id.localeCompare(a.inscripcion_id));
  const porResultado: Record<ResultadoClaseAlumno, number> = { PROXIMA: 0, ASISTIO: 0, AUSENTE: 0, SIN_REGISTRAR_COMO_DICTADA: 0, CANCELADA_CENTRO: 0, CANCELADA_ALUMNO: 0, RESERVA_VENCIDA: 0, BAJA_ALUMNO: 0, QUITADA_CENTRO: 0 };
  for (const resultado of RESULTADOS_CLASE_ALUMNO) porResultado[resultado] = filas.filter(i => i.resultado === resultado).length;
  const sinControl = filas.filter(i => i.sin_control_asistencia).length;
  const presentes = porResultado.ASISTIO - sinControl;
  const conControl = presentes + porResultado.AUSENTE;
  return { alumno: { id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` },
    resumen: { total: filas.length, por_resultado: porResultado, asistio_sin_control: sinControl, clases_con_control: conControl, porcentaje_asistencia: conControl ? Math.round(presentes * 100 / conControl) : null },
    items: filas.slice((query.pagina - 1) * query.por_pagina, query.pagina * query.por_pagina),
    paginacion: { total: filas.length, pagina_actual: query.pagina, total_paginas: Math.ceil(filas.length / query.por_pagina), por_pagina: query.por_pagina } };
}
