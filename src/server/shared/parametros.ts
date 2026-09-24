import { prisma } from "@/lib/prisma";
import {
  DIAS_SEMANA,
  HORA_REGEX,
  horaAMinutos,
  type DiaSemanaValor,
  type ParametrosHorarioOperativo,
} from "@/lib/horario-atencion";

/**
 * Lee un parámetro numérico de `ParametroSistema`. Si la clave no está
 * sembrada o el valor no es numérico, usa `valorPorDefecto` — nunca
 * revienta el flujo que lo llama por un parámetro mal cargado.
 */
export async function getParametroNumerico(
  clave: string,
  valorPorDefecto: number,
): Promise<number> {
  const parametro = await prisma.parametroSistema.findUnique({
    where: { clave },
  });
  if (!parametro) return valorPorDefecto;

  const valor = Number(parametro.valor);
  return Number.isFinite(valor) ? valor : valorPorDefecto;
}

/**
 * Lee un parámetro de texto de `ParametroSistema` (HU-B-08:
 * `terminos_version_vigente`, no numérico). Mismo criterio que
 * `getParametroNumerico`: si la clave no está sembrada, usa `valorPorDefecto`.
 */
export async function getParametroTexto(
  clave: string,
  valorPorDefecto: string,
): Promise<string> {
  const parametro = await prisma.parametroSistema.findUnique({ where: { clave } });
  return parametro?.valor ?? valorPorDefecto;
}

// Claves de ParametroSistema del horario operativo del centro (sembradas en
// prisma/seed.ts). Son las mismas que lee Turnos en
// src/server/turnos/turno.validaciones.ts, con los mismos valores por defecto.
const CLAVES_HORARIO_OPERATIVO = {
  diasOperativos: "dias_operativos",
  apertura: "horario_operativo_desde",
  cierre: "horario_operativo_hasta",
  granularidadMinutos: "granularidad_turno_minutos",
} as const;

const HORARIO_OPERATIVO_POR_DEFECTO: ParametrosHorarioOperativo = {
  diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
  apertura: "08:00",
  cierre: "20:00",
  granularidadMinutos: 30,
};

/**
 * Horario operativo del centro (días, apertura, cierre y granularidad) desde
 * `ParametroSistema` (HU-D-04). Igual que `getParametroNumerico`, un valor
 * ausente o mal cargado cae al valor por defecto en vez de romper el flujo.
 */
export async function obtenerParametrosHorarioOperativo(): Promise<ParametrosHorarioOperativo> {
  const filas = await prisma.parametroSistema.findMany({
    where: { clave: { in: Object.values(CLAVES_HORARIO_OPERATIVO) } },
  });
  const valores = new Map(filas.map(({ clave, valor }) => [clave, valor.trim()]));
  const defecto = HORARIO_OPERATIVO_POR_DEFECTO;

  const dias = (valores.get(CLAVES_HORARIO_OPERATIVO.diasOperativos) ?? "")
    .split(",")
    .map((dia) => dia.trim())
    .filter((dia): dia is DiaSemanaValor => (DIAS_SEMANA as readonly string[]).includes(dia));

  const hora = (clave: string, valorPorDefecto: string) => {
    const valor = valores.get(clave);
    return valor && HORA_REGEX.test(valor) ? valor : valorPorDefecto;
  };
  let apertura = hora(CLAVES_HORARIO_OPERATIVO.apertura, defecto.apertura);
  let cierre = hora(CLAVES_HORARIO_OPERATIVO.cierre, defecto.cierre);
  if (horaAMinutos(apertura) >= horaAMinutos(cierre)) {
    apertura = defecto.apertura;
    cierre = defecto.cierre;
  }

  const granularidad = Number(valores.get(CLAVES_HORARIO_OPERATIVO.granularidadMinutos));

  return {
    // Orden de la semana, sin repetidos, aunque el parámetro venga desordenado.
    diasOperativos: dias.length > 0 ? DIAS_SEMANA.filter((dia) => dias.includes(dia)) : defecto.diasOperativos,
    apertura,
    cierre,
    granularidadMinutos:
      Number.isSafeInteger(granularidad) && granularidad > 0 && granularidad <= 60
        ? granularidad
        : defecto.granularidadMinutos,
  };
}
