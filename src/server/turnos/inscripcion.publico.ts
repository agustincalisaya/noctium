/**
 * Fachada de la inscripción del módulo C (PR-0.md §2.13, Regla N.° 3): los
 * otros módulos (I, E, H, B, D) usan la inscripción solo por acá. Reexporta
 * el servicio y la regla «vigente a un momento dado» del propio módulo; no
 * importa nada de otros módulos.
 */
export {
  crearInscripcion,
  exigeInscripcionConPago,
  finalizarInscripcion,
  marcarPagada,
  recalcularEstadoPago,
  recalcularVencimientos,
  marcarVencidas,
  marcarVencidasDelAlumno,
  clasesConReservasVencidas,
  clasesConReservasVencidasDelAlumno,
  inscripcionVigenteDelPar,
  inscripcionMasRecienteDelPar,
  obtenerClasesBasicas,
  type OrigenInscripcion,
  type DatosCrearInscripcion,
  type InscripcionCreada,
  type InscripcionFinalizada,
  type InscripcionResumen,
  type CambioEstadoPago,
  type MotivoInscripcionConPago,
  type VigenciaFinal,
  type ClaseBasica,
} from "@/server/turnos/inscripcion.service";
export {
  esVigenteEn,
  sqlVigenteEn,
  sqlInstante,
  inscripcionesVigentes,
  ocupacion,
  calcularVencimiento,
  type InscripcionParaVigencia,
  type Ocupacion,
} from "@/server/turnos/inscripcion.vigencia";
export {
  listarInscripcionesDeAlumno,
  existeInscripcionVigenteConProfesor,
  contarInscripcionesPorMes,
  listarReservasPendientes,
  listarReservasVencidas,
  resumenReservas,
  type InscripcionDeAlumno,
  type VigenciaContable,
  type ReservaPendiente,
  type ReservaVencida,
} from "@/server/turnos/inscripcion.lecturas";
