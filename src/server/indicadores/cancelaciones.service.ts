import { contarClasesPorMes } from "@/server/turnos/turno.publico";
import { contarInscripcionesPorMes } from "@/server/turnos/inscripcion.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { resolverRangoIndicadores, type RangoIndicadoresInput } from "./indicadores.schema";
import { porcentajeUnDecimal } from "./indicadores.service";
import type { CancelacionesMesData, CancelacionesMateriaData, SeriesCancelaciones } from "@/types/indicadores.types";

const vacias = (): SeriesCancelaciones => ({ clases_canceladas_centro: 0, inscripciones_canceladas_alumno: 0, reservas_vencidas: 0, bajas: 0 });
const claveInscripcion = { CANCELADA_ALUMNO: "inscripciones_canceladas_alumno", RESERVA_VENCIDA: "reservas_vencidas", BAJA_ALUMNO: "bajas" } as const;

/** Las fachadas de C clasifican una sola vez y excluyen canceladas/quitadas del centro. */
export async function obtenerCancelacionesPorMes(query: RangoIndicadoresInput): Promise<CancelacionesMesData> {
  const rango = resolverRangoIndicadores(query);
  const [clases, inscripciones] = await Promise.all([
    contarClasesPorMes(rango, { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"] }),
    contarInscripcionesPorMes(rango, { vigencias: ["VIGENTE", "CANCELADA_ALUMNO", "RESERVA_VENCIDA", "BAJA_ALUMNO"] }),
  ]);
  const meses = rango.meses.map(mes => ({ mes, ...vacias() }));
  const porMes = new Map(meses.map(m => [m.mes, m]));
  let totalClases = 0, vigentes = 0;
  for (const fila of clases) {
    const mes = porMes.get(fila.mes);
    if (!mes) throw new Error("Conteo de clases fuera del rango");
    totalClases += fila.cantidad;
    if (fila.estado === "CANCELADO") mes.clases_canceladas_centro += fila.cantidad;
  }
  for (const fila of inscripciones) {
    const mes = porMes.get(fila.mes);
    if (!mes) throw new Error("Conteo de inscripciones fuera del rango");
    if (fila.vigencia === "VIGENTE") vigentes += fila.cantidad;
    else mes[claveInscripcion[fila.vigencia]] += fila.cantidad;
  }
  const totales = vacias();
  for (const mes of meses) for (const clave of Object.keys(totales) as (keyof SeriesCancelaciones)[]) totales[clave] += mes[clave];
  const totalInscripciones = vigentes + totales.inscripciones_canceladas_alumno + totales.reservas_vencidas;
  return { meses, totales, tasas: {
    clases: { canceladas: totales.clases_canceladas_centro, totales: totalClases, tasa: totalClases ? porcentajeUnDecimal(totales.clases_canceladas_centro / totalClases) : null },
    inscripciones: { canceladas_alumno: totales.inscripciones_canceladas_alumno, totales: totalInscripciones, tasa: totalInscripciones ? porcentajeUnDecimal(totales.inscripciones_canceladas_alumno / totalInscripciones) : null },
  } };
}

export async function obtenerCancelacionesPorMateria(query: RangoIndicadoresInput): Promise<CancelacionesMateriaData> {
  const rango = resolverRangoIndicadores(query);
  const [clases, inscripciones] = await Promise.all([
    contarClasesPorMes(rango, { estados: ["CANCELADO"], por: "materia" }),
    contarInscripcionesPorMes(rango, { vigencias: ["CANCELADA_ALUMNO"], porMateria: true }),
  ]);
  const cantidades = new Map<string, { clases_canceladas_centro: number; inscripciones_canceladas_alumno: number }>();
  for (const [filas, clave] of [[clases, "clases_canceladas_centro"], [inscripciones, "inscripciones_canceladas_alumno"]] as const) {
    for (const fila of filas) {
      if (!fila.materia_id) throw new Error("Cancelación sin materia");
      if (!fila.cantidad) continue;
      const grupo = cantidades.get(fila.materia_id) ?? { clases_canceladas_centro: 0, inscripciones_canceladas_alumno: 0 };
      grupo[clave] += fila.cantidad;
      cantidades.set(fila.materia_id, grupo);
    }
  }
  const materias = await obtenerMateriasPorIds([...cantidades.keys()]);
  if (materias.length !== cantidades.size) throw new Error("Materia de una cancelación inexistente");
  const nombres = new Intl.Collator("es", { sensitivity: "base" });
  const items = materias.map(m => ({ materia_id: m.id, nombre: m.nombre, codigo: m.codigo, activa: m.activa, ...cantidades.get(m.id)! }))
    .sort((a, b) => b.clases_canceladas_centro - a.clases_canceladas_centro || b.inscripciones_canceladas_alumno - a.inscripciones_canceladas_alumno || nombres.compare(a.nombre, b.nombre) || (a.materia_id < b.materia_id ? -1 : a.materia_id > b.materia_id ? 1 : 0));
  return { items };
}
