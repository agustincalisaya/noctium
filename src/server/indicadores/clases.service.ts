import { contarClasesPorMes } from "@/server/turnos/turno.publico";
import { listarMateriasActivas } from "@/server/materias/materia.service";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { listarOpcionesProfesoresActivos, obtenerProfesoresBasicos } from "@/server/profesores/profesor.publico";
import { resolverRangoIndicadores, type RangoIndicadoresInput } from "@/server/indicadores/indicadores.schema";
import type { ClasesMateriasData, ClasesProfesoresData } from "@/types/indicadores.types";

const estados = ["DISPONIBLE", "COMPLETO", "CANCELADO"] as const;
const nombres = new Intl.Collator("es", { sensitivity: "base" });
const compararId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** H compone los conteos públicos de C con el catálogo de L, incluyendo activos con cero. */
export async function obtenerClasesPorMateria(query: RangoIndicadoresInput): Promise<ClasesMateriasData> {
  const rango = resolverRangoIndicadores(query);
  const [filas, activas] = await Promise.all([
    contarClasesPorMes(rango, { estados: [...estados], por: "materia" }), listarMateriasActivas(),
  ]);
  const cantidades = new Map<string, number>();
  for (const fila of filas) {
    if (!fila.materia_id) throw new Error("Conteo de clases sin materia");
    cantidades.set(fila.materia_id, (cantidades.get(fila.materia_id) ?? 0) + fila.cantidad);
  }
  const catalogo = new Map(activas.map(m => [m.idMateria, { materia_id: m.idMateria, nombre: m.nombreMateria, codigo: m.codigoMateria, activa: true }]));
  const faltantes = [...cantidades.keys()].filter(id => !catalogo.has(id));
  for (const m of await obtenerMateriasPorIds(faltantes)) catalogo.set(m.id, { materia_id: m.id, nombre: m.nombre, codigo: m.codigo, activa: m.activa });
  if (faltantes.some(id => !catalogo.has(id))) throw new Error("Materia de una clase inexistente");
  const items = [...catalogo.values()].map(m => ({ ...m, clases: cantidades.get(m.materia_id) ?? 0 }))
    .sort((a, b) => b.clases - a.clases || nombres.compare(a.nombre, b.nombre) || compararId(a.materia_id, b.materia_id));
  return { total: items.reduce((suma, item) => suma + item.clases, 0), items };
}

/** Canceladas suman clases; sus minutos no entran en las horas ni en el total de horas. */
export async function obtenerClasesPorProfesor(query: RangoIndicadoresInput): Promise<ClasesProfesoresData> {
  const rango = resolverRangoIndicadores(query);
  const [filas, activos] = await Promise.all([
    contarClasesPorMes(rango, { estados: [...estados], por: "profesor" }), listarOpcionesProfesoresActivos(),
  ]);
  const cantidades = new Map<string, { clases: number; minutos: number }>();
  for (const fila of filas) {
    if (!fila.profesor_id) throw new Error("Conteo de clases sin profesor");
    const grupo = cantidades.get(fila.profesor_id) ?? { clases: 0, minutos: 0 };
    grupo.clases += fila.cantidad;
    if (fila.estado !== "CANCELADO") grupo.minutos += fila.minutos;
    cantidades.set(fila.profesor_id, grupo);
  }
  const catalogo = new Map(activos.map(p => [p.id, { profesor_id: p.id, nombre: p.nombreParaMostrar, activo: true }]));
  const faltantes = [...cantidades.keys()].filter(id => !catalogo.has(id));
  for (const p of await obtenerProfesoresBasicos(faltantes)) catalogo.set(p.id, { profesor_id: p.id, nombre: p.nombreParaMostrar, activo: p.activo });
  if (faltantes.some(id => !catalogo.has(id))) throw new Error("Profesor de una clase inexistente");
  const items = [...catalogo.values()].map(p => {
    const grupo = cantidades.get(p.profesor_id);
    return { ...p, clases: grupo?.clases ?? 0, horas: Math.round((grupo?.minutos ?? 0) * 100 / 60) / 100 };
  }).sort((a, b) => b.clases - a.clases || b.horas - a.horas || nombres.compare(a.nombre, b.nombre) || compararId(a.profesor_id, b.profesor_id));
  return { total: { clases: items.reduce((s, p) => s + p.clases, 0), horas: Math.round(items.reduce((s, p) => s + p.horas, 0) * 100) / 100 }, items };
}
