import { texto as textoC19 } from "@/lib/textos";
import { bloquear } from "@/server/shared/bloquear";
import { transaccion } from "@/server/shared/transaccion";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { horaAMinutos, intervalosSeSuperponen, minutosAHora } from "@/lib/horario-atencion";
import { verificarMateriaActiva } from "@/server/materias/materia.service";
import { obtenerOpcionProfesorActivo, obtenerHorarioDeProfesor, profesorActivoDictaMateria } from "@/server/profesores/profesor.publico";
import { existeAula, hayAulasActivas, obtenerNombreAula, verificarAulaActiva } from "@/server/aulas/aula.publico";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { esDuracionPermitida } from "./turno.schema";
import { aulaConTurnoSuperpuesto, intervaloTurno, profesoresConTurnoSuperpuesto } from "./turno.disponibilidad";
import { horaLocal } from "./turno.validaciones";
import { esConflictoDeReserva } from "./turno.reserva-error";
import { emitirEventosTurno, type EventoTurnoPendiente } from "./turno.publico";
import { aulasLibresEnFechas } from "./turno.generacion.aulas";
import { calcularOcurrencias, contarOcurrenciasDentroDelMaximo, elegirAulaParaResolver, esSoloExcluible, fechaAjenaALaGeneracion, motivosConflictoGeneracion, sumarMesesCalendario, validarEncajeEnFranja } from "./turno.generacion.calculo";
import type { AulaLibre, FechaVistaPrevia, GenerarTurnosInput, ResultadoGeneracion, VistaPreviaGeneracion, VistaPreviaGeneracionInput } from "./turno.generacion.schema";

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

const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** HU-C-21 (4.1): las listas solo nombran fechas calculadas y un aula distinta de la por defecto. */
function validarListasDeFechas(input: GenerarTurnosInput, fechas: Date[]) {
  const ajena = fechaAjenaALaGeneracion(
    fechas.map(iso),
    (input.aulas_por_fecha ?? []).map(({ fecha }) => ({ fecha: iso(fecha) })),
    (input.fechas_excluidas ?? []).map(iso),
  );
  if (ajena) {
    throw new ServiceError("VALIDATION_ERROR", textoC19("ui.clases.generacion.errores.fechaNoPertenece"), { campo: ajena.campo, fecha: ajena.fecha });
  }
  const igualALaPorDefecto = input.aulas_por_fecha?.find(({ aula_id }) => aula_id === input.aula_id);
  if (igualALaPorDefecto) {
    throw new ServiceError("VALIDATION_ERROR", textoC19("ui.clases.generacion.errores.aulaIgualALaElegida"), { campo: "aulas_por_fecha", fecha: iso(igualALaPorDefecto.fecha) });
  }
}

type AulaDeFecha = { id: string; nombre: string; capacidad: number };

/** HU-C-21 (4.2 paso 2): cada aula elegida se valida como la por defecto, una lectura por aula distinta. */
async function aulasElegidas(input: GenerarTurnosInput, db: Prisma.TransactionClient): Promise<Map<string, AulaDeFecha>> {
  const aulas = new Map<string, AulaDeFecha>();
  for (const { fecha, aula_id } of input.aulas_por_fecha ?? []) {
    if (aulas.has(aula_id)) continue;
    const activa = await verificarAulaActiva(aula_id, db);
    const nombre = activa ? await obtenerNombreAula(aula_id, db) : null;
    if (!activa || !nombre) {
      const detalles = { campo: "aulas_por_fecha", fecha: iso(fecha), aula_id };
      if (await existeAula(aula_id, db)) throw new ServiceError("AULA_INACTIVA", textoC19("ui.clases.generacion.errores.aulaDeLaFechaInactiva"), detalles);
      throw new ServiceError("AULA_NO_ENCONTRADA", textoC19("ui.clases.generacion.errores.aulaDeLaFechaNoEncontrada"), detalles);
    }
    aulas.set(aula_id, { id: aula_id, nombre: nombre.nombre, capacidad: activa.capacidadAula });
  }
  return aulas;
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
  const nombreAula = await obtenerNombreAula(input.aula_id, db);
  if (!nombreAula) throw new ServiceError("AULA_NO_ENCONTRADA", "No se encontró el aula seleccionada");
  const aulaPorDefecto: AulaDeFecha = { id: input.aula_id, nombre: nombreAula.nombre, capacidad: aula.capacidadAula };

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
    throw new ServiceError("RANGO_EXCEDIDO", textoC19("ui.clases.errores.laGeneracionNoPuedeSuperarClases", { valor1: limites.turnos }));
  }
  if (fechas.length === 0) throw new ServiceError("SIN_FECHAS_EN_RANGO", "No hay fechas para generar en el rango elegido");
  validarListasDeFechas(input, fechas);
  const elegidas = await aulasElegidas(input, db);
  const aulaDeFecha = new Map((input.aulas_por_fecha ?? []).map(({ fecha, aula_id }) => [iso(fecha), elegidas.get(aula_id)!]));
  const excluidas = new Set((input.fechas_excluidas ?? []).map(iso));
  if (fechas.every((fecha) => excluidas.has(iso(fecha)))) {
    throw new ServiceError("SIN_FECHAS_EN_RANGO", textoC19("ui.clases.generacion.errores.todasLasFechasExcluidas"));
  }

  const horaInicioTurno = new Date(`1970-01-01T${input.hora_inicio}:00.000Z`);
  const ocurrencias: FechaVistaPrevia[] = [];
  for (const fechaTurno of fechas) {
    const fecha = iso(fechaTurno);
    const aulaFecha = aulaDeFecha.get(fecha) ?? aulaPorDefecto;
    const fila = {
      aula: { id: aulaFecha.id, nombre: aulaFecha.nombre }, aula_cambiada: aulaFecha.id !== aulaPorDefecto.id,
      cupo: aulaFecha.capacidad, cupo_aula_por_defecto: aulaPorDefecto.capacidad, sin_aulas_libres: false,
    };
    // Una fecha excluida no se genera: no consulta disponibilidad.
    if (excluidas.has(fecha)) {
      ocurrencias.push({ fecha, estado: "OK", motivos: [], ...fila, excluida: true, solo_excluible: false });
      continue;
    }
    const turno = { fechaTurno, horaInicioTurno, duracionMinutosTurno: input.duracion_min };
    const otrosMismaMateria = await db.turno.findMany({
      where: { fechaTurno, profesorId: input.profesor_id, materiaId: input.materia_id, estadoTurno: { not: "CANCELADO" } },
      select: { horaInicioTurno: true, duracionMinutosTurno: true },
    });
    const intervalo = intervaloTurno(turno);
    const duplicado = otrosMismaMateria.some((otro) => intervalosSeSuperponen(intervalo, intervaloTurno(otro)));
    const [aulaOcupada, profesorOcupado] = duplicado ? [false, false] : await Promise.all([
      aulaConTurnoSuperpuesto(db, turno, aulaFecha.id),
      profesoresConTurnoSuperpuesto(db, turno, [input.profesor_id]).then((ocupados) => ocupados.has(input.profesor_id)),
    ]);
    const motivos = motivosConflictoGeneracion(duplicado, aulaOcupada, profesorOcupado);
    ocurrencias.push({ fecha, estado: motivos.length ? "CONFLICTO" : "OK", motivos, ...fila, excluida: false, solo_excluible: esSoloExcluible(motivos) });
  }

  // Criterio 4, solo en la vista previa: la fachada de K no corre dentro de la transacción (R2).
  // La misma lectura agrupada sirve después a «Resolver todas».
  let aulasLibres = new Map<string, AulaLibre[]>();
  if (!enTransaccion) {
    const cambiables = ocurrencias.filter((o) => o.motivos.includes("AULA_OCUPADA") && !o.solo_excluible);
    if (cambiables.length > 0) {
      aulasLibres = await aulasLibresEnFechas(db, cambiables.map(({ fecha }) => new Date(`${fecha}T00:00:00.000Z`)), input.hora_inicio, input.duracion_min);
      for (const ocurrencia of cambiables) ocurrencia.sin_aulas_libres = (aulasLibres.get(ocurrencia.fecha) ?? []).length === 0;
    }
  }
  return { vistaPrevia: resumirVistaPrevia(ocurrencias, fechasOmitidasVencidas), aulasLibres };
}

/** Totales de la vista previa (4.2 paso 9); los conflictos cuentan solo sobre las fechas incluidas. */
function resumirVistaPrevia(ocurrencias: FechaVistaPrevia[], fechasOmitidasVencidas: number): VistaPreviaGeneracion {
  const incluidas = ocurrencias.filter(({ excluida }) => !excluida);
  return {
    cantidad: ocurrencias.length,
    cantidad_incluida: incluidas.length,
    con_aula_cambiada: incluidas.filter(({ aula_cambiada }) => aula_cambiada).length,
    excluidas: ocurrencias.length - incluidas.length,
    fechas: ocurrencias,
    hay_conflictos: incluidas.some(({ estado }) => estado === "CONFLICTO"),
    fechas_omitidas_vencidas: fechasOmitidasVencidas,
  };
}

/**
 * HU-C-21 «Resolver todas» (4.3; separable por el plan de recorte). Solo en la
 * vista previa. Candidatas: incluidas, con AULA_OCUPADA, sin solo_excluible y
 * sin aula elegida a mano. Usa las aulas libres de la misma lectura agrupada:
 * el aula elegida es libre por construcción y no se vuelve a consultar.
 */
function resolverTodas(vista: VistaPreviaGeneracion, aulasLibres: Map<string, AulaLibre[]>): VistaPreviaGeneracion {
  const fechas = vista.fechas.map((ocurrencia): FechaVistaPrevia => {
    const candidata = !ocurrencia.excluida && ocurrencia.motivos.includes("AULA_OCUPADA") && !ocurrencia.solo_excluible && !ocurrencia.aula_cambiada;
    const aula = candidata ? elegirAulaParaResolver(aulasLibres.get(ocurrencia.fecha) ?? [], ocurrencia.cupo_aula_por_defecto) : null;
    if (!aula) return ocurrencia;
    return { ...ocurrencia, estado: "OK", motivos: [], aula: { id: aula.id, nombre: aula.nombre }, aula_cambiada: true, cupo: aula.capacidad, sin_aulas_libres: false };
  });
  return resumirVistaPrevia(fechas, vista.fechas_omitidas_vencidas);
}

/** Vista informativa: consultas de solo lectura, sin reservar recursos. */
export async function vistaPreviaGeneracion(input: VistaPreviaGeneracionInput, ahora: Date = new Date()): Promise<VistaPreviaGeneracion> {
  const { vistaPrevia, aulasLibres } = await calcularGeneracion(input, prisma, ahora, false);
  return input.resolver_automaticamente ? resolverTodas(vistaPrevia, aulasLibres) : vistaPrevia;
}

/** Revalida y crea el lote dentro de un único commit; los eventos se emiten después. */
export async function confirmarGeneracion(input: GenerarTurnosInput, usuarioId: string, ahora: Date = new Date()): Promise<ResultadoGeneracion> {
  type Creado = { idTurno: string; fecha: string; aulaId: string; cupo: number };
  let creados: Creado[];
  let resumen: { aulasCambiadas: number; fechasExcluidas: number };
  try {
    ({ creados, resumen } = await transaccion(async (tx) => {
      await bloquear(tx, { recursos: { profesores: [input.profesor_id] } });
      // Mismo cálculo que la vista previa: revalida cada aula elegida y al profesor en cada fecha incluida (criterio 7).
      const calculo = await calcularGeneracion(input, tx, ahora, true);
      if (calculo.vistaPrevia.hay_conflictos) {
        throw new ServiceError("GENERACION_CON_CONFLICTOS", "La generación tiene fechas en conflicto", { ...calculo.vistaPrevia });
      }
      const nuevos: Creado[] = [];
      const horaInicioTurno = new Date(`1970-01-01T${input.hora_inicio}:00.000Z`);
      for (const ocurrencia of calculo.vistaPrevia.fechas) {
        if (ocurrencia.excluida) continue;
        // Cada clase con el aula y el cupo de su fecha (criterio 6); la exclusión GiST defiende el aula.
        const turno = await tx.turno.create({ data: {
          fechaTurno: new Date(`${ocurrencia.fecha}T00:00:00.000Z`),
          horaInicioTurno, duracionMinutosTurno: input.duracion_min,
          materiaId: input.materia_id, profesorId: input.profesor_id, aulaId: ocurrencia.aula.id,
          estadoTurno: "DISPONIBLE", prioridadTurno: "NORMAL",
          cupoMaximoTurno: ocurrencia.cupo, creadoPorUsuarioId: usuarioId,
        } });
        nuevos.push({ idTurno: turno.idTurno, fecha: ocurrencia.fecha, aulaId: ocurrencia.aula.id, cupo: ocurrencia.cupo });
      }
      return { creados: nuevos, resumen: { aulasCambiadas: calculo.vistaPrevia.con_aula_cambiada, fechasExcluidas: calculo.vistaPrevia.excluidas } };
    }));
  } catch (error) {
    if (esConflictoDeReserva(error)) {
      throw new ServiceError("GENERACION_CON_CONFLICTOS", "Un recurso dejó de estar disponible. Repetí la vista previa");
    }
    throw error;
  }

  // Todo lote tiene al menos una fecha; el primer id de Turno es un CUID estable del lote.
  const generacionId = creados[0]!.idTurno;
  const horaFin = minutosAHora(horaAMinutos(input.hora_inicio) + input.duracion_min);
  const eventos: EventoTurnoPendiente[] = creados.flatMap(({ idTurno, fecha, aulaId, cupo }) => [
    { tipoEvento: "turno:configurado", turnoId: idTurno, payloadEvento: {
      turno_id: idTurno, fecha, hora_inicio: input.hora_inicio, hora_fin: horaFin,
      duracion_min: input.duracion_min, materia_id: input.materia_id, profesor_id: input.profesor_id,
      generacion_id: generacionId, usuario_id: usuarioId,
    } },
    { tipoEvento: "turno:aula_asignada", turnoId: idTurno, payloadEvento: {
      turno_id: idTurno, aula_id: aulaId, cupo_maximo: cupo, usuario_id: usuarioId,
    } },
    { tipoEvento: "turno:disponibilizado", turnoId: idTurno, payloadEvento: {
      turno_id: idTurno, fecha, hora_inicio: input.hora_inicio, hora_fin: horaFin,
      alumno_ids: [], profesor_id: input.profesor_id, aula_id: aulaId,
      materia_id: input.materia_id, usuario_id: usuarioId,
    } },
  ]);
  // La arquitectura del módulo emite tras el COMMIT. Un fallo de eventos no revierte el lote.
  await emitirEventosTurno(eventos);
  return {
    generacion_id: generacionId, cantidad: creados.length, turno_ids: creados.map(({ idTurno }) => idTurno),
    aulas_cambiadas: resumen.aulasCambiadas, fechas_excluidas: resumen.fechasExcluidas,
  };
}
