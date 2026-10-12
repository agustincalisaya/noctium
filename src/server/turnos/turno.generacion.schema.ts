import { z } from "zod";
import { texto as textoC19 } from "@/lib/textos";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";
import { ConfigurarTurnoSchema, DisponibilidadProfesorQuerySchema } from "./turno.schema";

/** Tope defensivo de las listas; el límite real es pertenecer a las fechas calculadas. */
const MAXIMO_FECHAS_LISTA = 40;
const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** Campos compartidos por la vista previa y la confirmación (HU-C-17 + HU-C-21). */
const camposGeneracion = {
  materia_id: ConfigurarTurnoSchema.shape.materia_id,
  profesor_id: z.cuid(),
  horario_id: z.cuid(),
  duracion_min: ConfigurarTurnoSchema.shape.duracion_min,
  hora_inicio: ConfigurarTurnoSchema.shape.hora_inicio,
  /** Aula por defecto de todo el rango. */
  aula_id: z.cuid(),
  fecha_desde: fechaCalendarioValidaSchema,
  fecha_hasta: fechaCalendarioValidaSchema,
  /** HU-C-21: aula distinta solo para esas fechas. */
  aulas_por_fecha: z.array(z.object({ fecha: fechaCalendarioValidaSchema, aula_id: z.cuid() }).strict())
    .max(MAXIMO_FECHAS_LISTA).optional(),
  /** HU-C-21: fechas que no se generan. */
  fechas_excluidas: z.array(fechaCalendarioValidaSchema).max(MAXIMO_FECHAS_LISTA).optional(),
};

type DatosGeneracion = {
  fecha_desde: Date; fecha_hasta: Date;
  aulas_por_fecha?: { fecha: Date; aula_id: string }[];
  fechas_excluidas?: Date[];
};

function validarGeneracion(datos: DatosGeneracion, ctx: z.RefinementCtx) {
  if (datos.fecha_desde > datos.fecha_hasta) {
    ctx.addIssue({ code: "custom", message: "La fecha hasta debe ser posterior o igual a la fecha desde", path: ["fecha_hasta"] });
  }
  const conAula = new Set<string>();
  datos.aulas_por_fecha?.forEach(({ fecha }, indice) => {
    if (conAula.has(iso(fecha))) ctx.addIssue({ code: "custom", message: textoC19("ui.clases.generacion.errores.fechaRepetida"), path: ["aulas_por_fecha", indice, "fecha"] });
    conAula.add(iso(fecha));
  });
  const excluidas = new Set<string>();
  datos.fechas_excluidas?.forEach((fecha, indice) => {
    if (excluidas.has(iso(fecha))) ctx.addIssue({ code: "custom", message: textoC19("ui.clases.generacion.errores.fechaRepetida"), path: ["fechas_excluidas", indice] });
    else if (conAula.has(iso(fecha))) ctx.addIssue({ code: "custom", message: textoC19("ui.clases.generacion.errores.fechaExcluidaConAula"), path: ["fechas_excluidas", indice] });
    excluidas.add(iso(fecha));
  });
}

/** Confirmación (y payload de HU-C-17). No admite `resolver_automaticamente`. */
export const GenerarTurnosSchema = z.object(camposGeneracion).strict().superRefine(validarGeneracion);

/** Vista previa: suma «Resolver todas» (HU-C-21, criterio 3). */
export const VistaPreviaGeneracionSchema = z.object({
  ...camposGeneracion,
  resolver_automaticamente: z.boolean().optional(),
}).strict().superRefine(validarGeneracion);

export type GenerarTurnosInput = z.infer<typeof GenerarTurnosSchema>;
export type VistaPreviaGeneracionInput = z.infer<typeof VistaPreviaGeneracionSchema>;

/** HU-C-21 (4.4): consulta de aulas libres para una fecha y horario. */
export const AulasLibresQuerySchema = z.object({
  fecha: fechaCalendarioValidaSchema,
  hora_inicio: ConfigurarTurnoSchema.shape.hora_inicio,
  duracion_min: DisponibilidadProfesorQuerySchema.shape.duracion_min,
}).strict();
export type AulasLibresQuery = z.infer<typeof AulasLibresQuerySchema>;
export type AulaLibre = { id: string; nombre: string; capacidad: number };

/** Contratos de éxito de §2.9 compartidos por preview y confirmación; HU-C-21 solo suma campos. */
export type MotivoConflictoGeneracion = "AULA_OCUPADA" | "PROFESOR_OCUPADO" | "TURNO_EXISTENTE";
export type FechaVistaPrevia = {
  fecha: string;
  estado: "OK" | "CONFLICTO";
  motivos: MotivoConflictoGeneracion[];
  /** Aula de esa fecha: la por defecto o la elegida. */
  aula: { id: string; nombre: string };
  aula_cambiada: boolean;
  cupo: number;
  cupo_aula_por_defecto: number;
  excluida: boolean;
  /** Solo en la vista previa, con AULA_OCUPADA y sin solo_excluible. */
  sin_aulas_libres: boolean;
  /** PROFESOR_OCUPADO o TURNO_EXISTENTE: cambiar el aula no lo resuelve (D1). */
  solo_excluible: boolean;
};
export type VistaPreviaGeneracion = {
  /** Fechas calculadas, incluidas las excluidas (significado de Sprint 2). */
  cantidad: number;
  cantidad_incluida: number;
  con_aula_cambiada: number;
  excluidas: number;
  fechas: FechaVistaPrevia[];
  /** Solo sobre las fechas incluidas. */
  hay_conflictos: boolean;
  fechas_omitidas_vencidas: number;
};
export type ResultadoGeneracion = {
  generacion_id: string; cantidad: number; turno_ids: string[];
  /** HU-C-21 (criterio 8): clases creadas con el aula cambiada y fechas que no se generaron. */
  aulas_cambiadas: number; fechas_excluidas: number;
};
