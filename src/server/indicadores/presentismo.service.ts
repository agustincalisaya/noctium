import { contarAsistenciasPorMes, contarClasesDictadasSinControl, listarAlumnosConPresentismoBajo as listarDesdeHistorial } from "@/server/historial/historial.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { parametrosVigentes } from "@/server/shared/parametros-vigentes";
import { resolverRangoIndicadores, MINIMO_CLASES_PRESENTISMO_BAJO, POR_PAGINA_PRESENTISMO_BAJO, type RangoIndicadoresInput, type PresentismoBajoInput } from "@/server/indicadores/indicadores.schema";
import type { ResumenPresentismo, PresentismoMensualData, PresentismoMateriasData, PresentismoBajoData } from "@/types/indicadores.types";

/** Mitades hacia arriba; calcula sobre cantidades, nunca sobre porcentajes redondeados. */
function porcentaje(presentes: number, total: number): number { return Math.round(Number((presentes * 1000 / total).toPrecision(12))) / 10; }
function resumen(presentes: number, ausentes: number): ResumenPresentismo {
  const inscriptos = presentes + ausentes;
  return { inscriptos, presentes, ausentes, indice: inscriptos ? porcentaje(presentes, inscriptos) : null };
}
function sumar(filas: { presentes: number; ausentes: number }[]): ResumenPresentismo {
  return resumen(filas.reduce((n, f) => n + f.presentes, 0), filas.reduce((n, f) => n + f.ausentes, 0));
}

export async function obtenerPresentismoPorMes(query: RangoIndicadoresInput): Promise<PresentismoMensualData> {
  const rango = resolverRangoIndicadores(query);
  const [filas, clases_sin_control] = await Promise.all([contarAsistenciasPorMes(rango), contarClasesDictadasSinControl(rango)]);
  const porMes = new Map(filas.map(f => [f.mes, f]));
  const meses = rango.meses.map(mes => { const f = porMes.get(mes); return { mes, ...resumen(f?.presentes ?? 0, f?.ausentes ?? 0) }; });
  return { meses, resumen: sumar(meses), clases_sin_control };
}

export async function obtenerPresentismoPorMateria(query: RangoIndicadoresInput): Promise<PresentismoMateriasData> {
  const rango = resolverRangoIndicadores(query);
  const [filas, clases_sin_control] = await Promise.all([contarAsistenciasPorMes(rango, { porMateria: true }), contarClasesDictadasSinControl(rango)]);
  const grupos = new Map<string, { presentes: number; ausentes: number }>();
  for (const f of filas) {
    if (!f.materia_id || f.presentes + f.ausentes === 0) continue;
    const g = grupos.get(f.materia_id) ?? { presentes: 0, ausentes: 0 };
    g.presentes += f.presentes; g.ausentes += f.ausentes; grupos.set(f.materia_id, g);
  }
  const nombres = new Map((await obtenerMateriasPorIds([...grupos.keys()])).map(m => [m.id, m]));
  const items = [...grupos].map(([materia_id, g]) => {
    const materia = nombres.get(materia_id);
    if (!materia) throw new Error("Materia del registro académico inexistente");
    return { materia_id, nombre: materia.nombre, codigo: materia.codigo, activa: materia.activa, ...resumen(g.presentes, g.ausentes) };
  }).sort((a, b) => a.indice! - b.indice! || b.ausentes - a.ausentes || a.nombre.localeCompare(b.nombre, "es") || a.materia_id.localeCompare(b.materia_id));
  return { items, resumen: sumar(items), clases_sin_control };
}

export async function listarAlumnosConPresentismoBajo(query: PresentismoBajoInput): Promise<PresentismoBajoData> {
  const rango = resolverRangoIndicadores(query);
  const { umbralPresentismo: umbral } = await parametrosVigentes();
  const { total, items: filas } = await listarDesdeHistorial(rango, { umbral, minimoClases: MINIMO_CLASES_PRESENTISMO_BAJO, limite: POR_PAGINA_PRESENTISMO_BAJO, desplazamiento: (query.pagina - 1) * POR_PAGINA_PRESENTISMO_BAJO });
  const [alumnos, materias] = await Promise.all([obtenerAlumnosBasicos([...new Set(filas.map(f => f.alumno_id))]), obtenerMateriasPorIds([...new Set(filas.map(f => f.materia_id))])]);
  const porAlumno = new Map(alumnos.map(a => [a.id, a])); const porMateria = new Map(materias.map(m => [m.id, m]));
  const items = filas.map(f => {
    const alumno = porAlumno.get(f.alumno_id); const materia = porMateria.get(f.materia_id);
    if (!alumno || !materia) throw new Error("Referencia del registro académico inexistente");
    return { alumno_id: f.alumno_id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}`, materia_id: f.materia_id, materia: materia.nombre, clases_dictadas: f.clases, ausencias: f.ausentes, porcentaje: porcentaje(f.presentes, f.clases) };
  });
  return { umbral, minimo_clases: MINIMO_CLASES_PRESENTISMO_BAJO, pagina: query.pagina, por_pagina: POR_PAGINA_PRESENTISMO_BAJO, total, items };
}
