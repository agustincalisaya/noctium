/**
 * Tipos de dominio del módulo D (Regla N.° 11). Los tipos de HU-D-01/D-02
 * siguen en `src/app/(dashboard)/profesores/profesor.types.ts` hasta su
 * refactor propio (deuda técnica, ver HU-D-03 §1 punto 1).
 */

import type { DiaSemanaValor } from "@/lib/horario-atencion";

/** Materia asociada a un profesor. `activa` refleja el estado actual de la materia (HU-D-03 §1 punto 12). */
export type MateriaDeProfesor = { id: string; nombre: string; codigo: string | null; activa: boolean };

export type EstadoAsociarMaterias =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "materias_inactivas"; materias: { id: string; nombre: string }[] }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; asociadas: MateriaDeProfesor[] };

export const ESTADO_INICIAL_ASOCIAR_MATERIAS: EstadoAsociarMaterias = { status: "idle" };

/**
 * Horario de atención del profesor (HU-D-04): intervalo semiabierto
 * [horaInicio, horaFin) recurrente todas las semanas en `diaSemana`. Horas
 * en "HH:mm" (24 h).
 */
export type HorarioAtencion = {
  id: string;
  diaSemana: DiaSemanaValor;
  horaInicio: string;
  horaFin: string;
};

/** Profesor activo para el selector de HU-D-04. */
export type ProfesorActivoOpcion = { id: string; nombre: string; apellido: string; dni: string };

export type EstadoRegistrarHorario =
  | { status: "idle" }
  | { status: "error_validacion"; errores: Record<string, string[] | undefined> }
  | { status: "error"; mensaje: string }
  | { status: "error_comunicacion" }
  | { status: "exito"; horario: HorarioAtencion };

export const ESTADO_INICIAL_REGISTRAR_HORARIO: EstadoRegistrarHorario = { status: "idle" };

/**
 * Opción de profesor activo para selectores (HU-J-01, agenda por profesor):
 * `nombreParaMostrar` es "Apellido, Nombre". Ordenada por apellido, nombre
 * (case/acento-insensitivo) y DNI.
 */
export type OpcionProfesor = { id: string; nombreParaMostrar: string };

/** Fila del listado de profesores (HU-D-05). `materias`: nombres, ordenados. */
export type ProfesorListadoItem = {
  id: string;
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  materias: string[];
};

/** Metadatos de paginación server-side (HU-D-05), mismo shape que Alumnos. */
export type PaginacionProfesores = {
  total: number;
  pagina_actual: number;
  total_paginas: number;
  por_pagina: number;
};

/**
 * Detalle del profesor en modo consulta (HU-D-05 criterio 3): identidad,
 * contacto, estado, fecha de alta, materias completas y horarios.
 */
export type DetalleProfesor = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: Date;
  genero: "MASCULINO" | "FEMENINO" | "OTRO" | "PREFIERO_NO_INDICARLO" | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  fechaAlta: Date;
  materias: MateriaDeProfesor[];
  horarios: HorarioAtencion[];
  /** Concurrencia optimista del modo edición (HU-D-06, `spec_modulo_D.md` §2.5). */
  version: number;
};

/** Resultado de la modificación de identidad y contacto (HU-D-06, `spec_modulo_D.md` §2.6). */
export type ResultadoModificarProfesor =
  | { data: { id: string; campos_modificados: string[]; version: number }; error: null }
  | { data: null; error: { code: string; message: string; detalles?: unknown } };

/** Una materia que no se pudo quitar por sus turnos futuros (HU-D-07 AC3). */
export type MateriaBloqueadaPorTurnos = { materia_id: string; cantidad: number };

/** Resultado del guardado de materias del profesor (HU-D-07, `spec_modulo_D.md` §2.7). */
export type ResultadoActualizarMaterias =
  | {
      data: { agregadas: string[]; quitadas: string[]; pendientes_afectados: number; sin_cambios: boolean };
      error: null;
    }
  | {
      data: null;
      error: {
        code: string;
        message: string;
        /** `MATERIA_INACTIVA`: las materias del lote que dejaron de estar activas. */
        materias?: { id: string; nombre: string }[];
        /** `MATERIA_CON_TURNOS_FUTUROS`: cada materia bloqueada con su N. */
        detalle?: MateriaBloqueadaPorTurnos[];
        detalles?: unknown;
      };
    };

/**
 * Fila del modal «Ver turnos» (HU-D-07 AC3). Misma forma que
 * `TurnoFuturoDeMateria` de `turno.publico.ts` (spec C §2.15), declarada acá
 * como tipo de UI del módulo D para no acoplar la ficha al módulo C.
 */
export type TurnoFuturoDeMateria = {
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
  alumnos_inscriptos: string;
  estado: "DISPONIBLE" | "COMPLETO";
};

export type PaginaTurnosFuturos = {
  items: TurnoFuturoDeMateria[];
  total: number;
  pagina: number;
  por_pagina: number;
};

/**
 * Opción de profesor activo del contrato público (`spec_modulo_D.md` §2.8,
 * `listarOpcionesProfesoresActivos`): `OpcionProfesor` más nombre y apellido
 * por separado.
 */
export type OpcionProfesorConNombre = OpcionProfesor & { nombre: string; apellido: string };

/**
 * Horario de atención del contrato público (`spec_modulo_D.md` §2.8):
 * `dia_semana` es el valor del enum ("LUNES"…"DOMINGO") y las horas son
 * "HH:mm" en 24 h, igual que `HorarioAtencion`.
 */
export type HorarioDeAtencionPublico = {
  horario_id: string;
  dia_semana: DiaSemanaValor;
  hora_inicio: string;
  hora_fin: string;
};
