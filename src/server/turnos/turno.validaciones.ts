import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/shared/service-error";
import { DURACIONES_PERMITIDAS_TURNO_MIN, esDuracionPermitida, type ConfigurarTurnoInput } from "./turno.schema";

const ZONA = "America/Argentina/Buenos_Aires";
const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function horaLocal(fecha: Date) {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return { fecha: `${valor("year")}-${valor("month")}-${valor("day")}`, hora: `${valor("hour")}:${valor("minute")}` };
}

export function turnoSigueVigente(fecha: Date, horaInicio: Date): boolean {
  const ahora = horaLocal(new Date());
  const diaTurno = fecha.toISOString().slice(0, 10);
  const horaTurno = horaInicio.toISOString().slice(11, 16);
  return diaTurno > ahora.fecha || (diaTurno === ahora.fecha && horaTurno > ahora.hora);
}

export async function parametrosConfiguracionTurno() {
  const claves = ["granularidad_turno_minutos", "dias_operativos", "horario_operativo_desde", "horario_operativo_hasta", "anticipacion_maxima_dias"];
  const filas = await prisma.parametroSistema.findMany({ where: { clave: { in: claves } } });
  const valores = new Map(filas.map(({ clave, valor }) => [clave, valor]));
  const entero = (clave: string, defecto: number) => {
    const numero = Number(valores.get(clave));
    return Number.isSafeInteger(numero) && numero > 0 ? numero : defecto;
  };
  return {
    zona_horaria: ZONA,
    // Revisión 4: la duración la elige Mesa de Entradas entre estas opciones.
    duraciones_permitidas_minutos: [...DURACIONES_PERMITIDAS_TURNO_MIN],
    granularidad_minutos: entero("granularidad_turno_minutos", 30),
    dias_operativos: (valores.get("dias_operativos") ?? "LUNES,MARTES,MIERCOLES,JUEVES,VIERNES").split(",").map((dia) => dia.trim()),
    apertura: valores.get("horario_operativo_desde") ?? "08:00",
    cierre: valores.get("horario_operativo_hasta") ?? "20:00",
    anticipacion_maxima_dias: entero("anticipacion_maxima_dias", 30),
  };
}

export async function validarConfiguracionTurno(input: ConfigurarTurnoInput) {
  const parametros = await parametrosConfiguracionTurno();
  const fecha = input.fecha.toISOString().slice(0, 10);
  const hoy = horaLocal(new Date());
  if (fecha < hoy.fecha || (fecha === hoy.fecha && input.hora_inicio <= hoy.hora)) {
    throw new ServiceError("FECHA_PASADA", "La fecha y hora deben ser posteriores al momento actual");
  }
  const maximo = new Date(`${hoy.fecha}T00:00:00.000Z`);
  maximo.setUTCDate(maximo.getUTCDate() + parametros.anticipacion_maxima_dias);
  if (input.fecha > maximo) throw new ServiceError("ANTICIPACION_EXCEDIDA", `La fecha no puede superar ${parametros.anticipacion_maxima_dias} días de anticipación`);
  if (!parametros.dias_operativos.includes(DIAS[input.fecha.getUTCDay()])) {
    throw new ServiceError("DIA_NO_OPERATIVO", "El centro no atiende el día seleccionado");
  }
  const inicio = minutos(input.hora_inicio);
  if (inicio % parametros.granularidad_minutos !== 0) {
    throw new ServiceError("HORA_NO_GRANULAR", `La hora debe ajustarse a intervalos de ${parametros.granularidad_minutos} minutos`);
  }
  // Defensa en profundidad: el schema Zod ya lo exige (§2.1 paso 4).
  if (!esDuracionPermitida(input.duracion_min)) throw new ServiceError("DURACION_NO_PERMITIDA", "Elegí una duración válida (1, 2 o 3 horas)");
  const fin = inicio + input.duracion_min;
  if (inicio < minutos(parametros.apertura) || fin > minutos(parametros.cierre) || fin >= 24 * 60) {
    throw new ServiceError("FUERA_DE_HORARIO_OPERATIVO", `El turno completo debe estar entre ${parametros.apertura} y ${parametros.cierre}`);
  }
  const hora_fin = `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}`;
  return { fecha, hora_fin, duracion_min: input.duracion_min };
}
