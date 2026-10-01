import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { horaAMinutos, intervalosSeSuperponen, minutosAHora } from "@/lib/horario-atencion";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { obtenerOpcionProfesorActivo, obtenerHorarioDeProfesor, profesorActivoDictaMateria } from "@/server/profesores/profesor.publico";
import { existeAula, hayAulasActivas, verificarAulaActiva } from "@/server/aulas/aula.publico";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { esDuracionPermitida } from "./turno.schema";
import { aulaConTurnoSuperpuesto, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";
import { horaLocal } from "./turno.validaciones";
import { esConflictoDeReserva } from "./turno.reserva-error";
import { emitirEventosTurno, type EventoTurnoPendiente } from "./turno.publico";
import { calcularOcurrencias, contarOcurrenciasDentroDelMaximo, motivosConflictoGeneracion, sumarMesesCalendario, validarEncajeEnFranja } from "./turno.generacion.calculo";
import type { GenerarTurnosInput, ResultadoGeneracion, VistaPreviaGeneracion } from "./turno.generacion.schema";

const CLAVES_LIMITE = ["generacion_maxima_meses", "generacion_maxima_turnos"] as const;

async function limitesGeneracion(db: Prisma.TransactionClient) {
  const filas = await db.parametroSistema.findMany({ where: { clave: { in: [...CLAVES_LIMITE] } } });
  const valores = new Map(filas.map(({ clave, valor }) => [clave, valor]));
  const leer = (clave: (typeof CLAVES_LIMITE)[number]) => {
    const valor = valores.get(clave);
    const numero = valor === undefined ? NaN : Number(valor);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      throw new ServiceError("CONFIGURACION_GENERACION_INCOMPLETA", `Falta un valor válido para ${clave}`);
    }
    return numero;
  };
  return { meses: leer("generacion_maxima_meses"), turnos: leer("generacion_maxima_turnos") };
}

/** Núcleo compartido; en confirmación todas las lecturas usan el mismo tx. */
async function calcularGeneracion(input: GenerarTurnosInput, db: Prisma.TransactionClient, ahora: Date, enTransaccion: boolean) {
  if (!(await verificarMateriaActiva(input.materia_id, db))) {
    throw new ServiceError("MATERIA_NO_DISPONIBLE", "La materia seleccionada no está disponible");
  }
  if (!(await obtenerOpcionProfesorActivo(input.profesor_id, db))) {
    throw new ServiceError("PROFESOR_NO_ENCONTRADO", "No se encontró un profesor activo");
  }
  if (!(await profesorActivoDictaMateria(input.profesor_id, input.materia_id, enTransaccion ? db : undefined))) {
    throw new ServiceError("PROFESOR_NO_DICTA_MATERIA", "El profesor no dicta la materia seleccionada");
  }
  const franja = await obtenerHorarioDeProfesor(input.profesor_id, input.horario_id, db);
  if (!franja) throw new ServiceError("HORARIO_NO_ENCONTRADO", "La franja no pertenece al profesor seleccionado");
  if (!(await hayAulasActivas(db))) throw new ServiceError("SIN_AULAS_ACTIVAS", "No hay aulas activas");
  const aula = await verificarAulaActiva(input.aula_id, db);
  if (!aula) {
    if (await existeAula(input.aula_id, db)) throw new ServiceError("AULA_INACTIVA", "El aula seleccionada está inactiva");
    throw new ServiceError("AULA_NO_ENCONTRADA", "No se encontró el aula seleccionada");
  }

  const [limites, horarioOperativo] = await Promise.all([limitesGeneracion(db), obtenerParametrosHorarioOperativo(db)]);
  if (!esDuracionPermitida(input.duracion_min) || !validarEncajeEnFranja(franja, input.hora_inicio, input.duracion_min, horarioOperativo.granularidadMinutos)) {
    throw new ServiceError("FUERA_DE_FRANJA", "La hora y duración deben caber en la franja y respetar la granularidad");
  }
  const hoy = horaLocal(ahora);
  if (input.fecha_desde.toISOString().slice(0, 10) < hoy.fecha) {
    throw new ServiceError("RANGO_EXCEDIDO", "La fecha desde no puede ser anterior a hoy");
  }
  if (input.fecha_hasta > sumarMesesCalendario(input.fecha_desde, limites.meses)) {
    throw new ServiceError("RANGO_EXCEDIDO", `El rango no puede superar ${limites.meses} meses calendario`);
  }
  const { fechas, fechasOmitidasVencidas } = calcularOcurrencias(
    input.fecha_desde, input.fecha_hasta, franja.dia_semana, horarioOperativo.diasOperativos, input.hora_inicio, hoy,
  );
  if (!contarOcurrenciasDentroDelMaximo(fechas.length, limites.turnos)) {
    throw new ServiceError("RANGO_EXCEDIDO", `La generación no puede superar ${limites.turnos} turnos`);
  }
  if (fechas.length === 0) throw new ServiceError("SIN_FECHAS_EN_RANGO", "No hay fechas para generar en el rango elegido");

  const horaInicioTurno = new Date(`1970-01-01T${input.hora_inicio}:00.000Z`);
  const ocurrencias: VistaPreviaGeneracion["fechas"] = [];
  for (const fechaTurno of fechas) {
    const turno = { fechaTurno, horaInicioTurno, duracionMinutosTurno: input.duracion_min };
    const otrosMismaMateria = await db.turno.findMany({
      where: { fechaTurno, profesorId: input.profesor_id, materiaId: input.materia_id, estadoTurno: { not: "CANCELADO" } },
      select: { horaInicioTurno: true, duracionMinutosTurno: true },
    });
    const intervalo = intervaloTurno(turno);
    const duplicado = otrosMismaMateria.some((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro)));
    const [aulaOcupada, profesorOcupado] = duplicado ? [false, false] : await Promise.all([
      aulaConTurnoSuperpuesto(db, turno, input.aula_id),
      profesoresConTurnoSuperpuesto(db, turno, [input.profesor_id]).then((ocupados) => ocupados.has(input.profesor_id)),
    ]);
    const motivos = motivosConflictoGeneracion(duplicado, aulaOcupada, profesorOcupado);
    ocurrencias.push({ fecha: fechaTurno.toISOString().slice(0, 10), estado: motivos.length ? "CONFLICTO" : "OK", motivos });
  }
  const vistaPrevia: VistaPreviaGeneracion = { cantidad: ocurrencias.length, fechas: ocurrencias, hay_conflictos: ocurrencias.some(({ estado }) => estado === "CONFLICTO"), fechas_omitidas_vencidas: fechasOmitidasVencidas };
  return { vistaPrevia, capacidadAula: aula.capacidadAula };
}

/** Vista informativa: consultas de solo lectura, sin reservar recursos. */
export async function vistaPreviaGeneracion(input: GenerarTurnosInput, ahora: Date = new Date()): Promise<VistaPreviaGeneracion> {
  return (await calcularGeneracion(input, prisma, ahora, false)).vistaPrevia;
}

/** Revalida y crea el lote dentro de un único commit; los eventos se emiten después. */
export async function confirmarGeneracion(input: GenerarTurnosInput, usuarioId: string, ahora: Date = new Date()): Promise<ResultadoGeneracion> {
  let creados: { idTurno: string; fecha: string }[];
  let capacidadAula: number;
  try {
    ({ creados, capacidadAula } = await prisma.$transaction(async (tx) => {
      const calculo = await calcularGeneracion(input, tx, ahora, true);
      if (calculo.vistaPrevia.hay_conflictos) {
        throw new ServiceError("GENERACION_CON_CONFLICTOS", "La generación tiene fechas en conflicto", { ...calculo.vistaPrevia });
      }
      const nuevos: { idTurno: string; fecha: string }[] = [];
      const horaInicioTurno = new Date(`1970-01-01T${input.hora_inicio}:00.000Z`);
      for (const ocurrencia of calculo.vistaPrevia.fechas) {
        const turno = await tx.turno.create({ data: {
          fechaTurno: new Date(`${ocurrencia.fecha}T00:00:00.000Z`),
          horaInicioTurno, duracionMinutosTurno: input.duracion_min,
          materiaId: input.materia_id, profesorId: input.profesor_id, aulaId: input.aula_id,
          estadoTurno: "DISPONIBLE", prioridadTurno: "NORMAL",
          cupoMaximoTurno: calculo.capacidadAula, creadoPorUsuarioId: usuarioId,
        } });
        nuevos.push({ idTurno: turno.idTurno, fecha: ocurrencia.fecha });
      }
      return { creados: nuevos, capacidadAula: calculo.capacidadAula };
    }, { maxWait: 10_000, timeout: 30_000 }));
  } catch (error) {
    if (esConflictoDeReserva(error)) {
      throw new ServiceError("GENERACION_CON_CONFLICTOS", "Un recurso dejó de estar disponible. Repetí la vista previa");
    }
    throw error;
  }

  // Todo lote tiene al menos una fecha; el primer id de Turno es un CUID estable del lote.
  const generacionId = creados[0]!.idTurno;
  const horaFin = minutosAHora(horaAMinutos(input.hora_inicio) + input.duracion_min);
  const eventos: EventoTurnoPendiente[] = creados.flatMap(({ idTurno, fecha }) => [
    { tipoEvento: "turno:configurado", turnoId: idTurno, payloadEvento: {
      turno_id: idTurno, fecha, hora_inicio: input.hora_inicio, hora_fin: horaFin,
      duracion_min: input.duracion_min, materia_id: input.materia_id, profesor_id: input.profesor_id,
      generacion_id: generacionId, usuario_id: usuarioId,
    } },
    { tipoEvento: "turno:aula_asignada", turnoId: idTurno, payloadEvento: {
      turno_id: idTurno, aula_id: input.aula_id, cupo_maximo: capacidadAula, usuario_id: usuarioId,
    } },
    { tipoEvento: "turno:disponibilizado", turnoId: idTurno, payloadEvento: {
      turno_id: idTurno, fecha, hora_inicio: input.hora_inicio, hora_fin: horaFin,
      alumno_ids: [], profesor_id: input.profesor_id, aula_id: input.aula_id,
      materia_id: input.materia_id, usuario_id: usuarioId,
    } },
  ]);
  // La arquitectura del módulo emite tras el COMMIT. Un fallo de eventos no revierte el lote.
  await emitirEventosTurno(eventos);
  return { generacion_id: generacionId, cantidad: creados.length, turno_ids: creados.map(({ idTurno }) => idTurno) };
}
