import { DIAS_SEMANA, horaAMinutos, type DiaSemanaValor } from "@/lib/horario-atencion";

/**
 * Helpers puros de la agenda semanal (HU-J-01, `spec_modulo_J.md` §2.1).
 * Sin acceso a base: los usan el servicio, las páginas y los componentes
 * cliente (selector) por igual.
 *
 * Fechas: string "AAAA-MM-DD" (fecha calendario, sin hora ni zona). La
 * aritmética se hace con `Date.UTC`, nunca con la hora local del servidor;
 * la única conversión con zona horaria es `hoyEnZonaCentro()`.
 */

export const ZONA_HORARIA_CENTRO = "America/Argentina/Buenos_Aires";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function aFechaUTC(fecha: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio!, mes! - 1, dia!));
}

/** `Date` en medianoche UTC (`@db.Date`) -> "AAAA-MM-DD". */
export function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" -> `Date` en medianoche UTC, para comparar con `@db.Date`. */
export function fechaCalendarioADate(fecha: string): Date {
  return aFechaUTC(fecha);
}

/** `true` si `valor` es una fecha "AAAA-MM-DD" que existe en el calendario. */
export function esFechaCalendario(valor: unknown): valor is string {
  if (typeof valor !== "string" || !FORMATO_FECHA.test(valor)) return false;
  return fechaISO(aFechaUTC(valor)) === valor;
}

export function sumarDias(fecha: string, dias: number): string {
  const resultado = aFechaUTC(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return fechaISO(resultado);
}

/** Fecha de hoy en la zona del centro (no la del servidor). */
export function hoyEnZonaCentro(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA_CENTRO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find(({ type }) => type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

/** Lunes de la semana (lunes a domingo) que contiene `fecha`. */
export function lunesDeLaSemana(fecha: string): string {
  const desdeLunes = (aFechaUTC(fecha).getUTCDay() + 6) % 7; // lunes = 0
  return sumarDias(fecha, -desdeLunes);
}

export function desplazarSemana(lunes: string, semanas: number): string {
  return sumarDias(lunes, semanas * 7);
}

export type DiaDeSemana = { fecha: string; dia: DiaSemanaValor };

/**
 * Días de la semana que empieza en `lunes` que son operativos, en orden de
 * semana. Los no operativos no se muestran como columna (HU-J-01 c1).
 */
export function diasOperativosDeLaSemana(
  lunes: string,
  diasOperativos: readonly DiaSemanaValor[],
): DiaDeSemana[] {
  return DIAS_SEMANA.map((dia, i) => ({ fecha: sumarDias(lunes, i), dia })).filter(({ dia }) =>
    diasOperativos.includes(dia),
  );
}

/**
 * Rango consultado (inclusivo): del primer al último día operativo de la
 * semana. Sin días operativos, la semana completa.
 */
export function rangoDeLaSemana(
  lunes: string,
  diasOperativos: readonly DiaSemanaValor[],
): { desde: string; hasta: string } {
  const dias = diasOperativosDeLaSemana(lunes, diasOperativos);
  if (dias.length === 0) return { desde: lunes, hasta: sumarDias(lunes, 6) };
  return { desde: dias[0]!.fecha, hasta: dias[dias.length - 1]!.fecha };
}

/** "2026-09-21" -> "21/09". */
export function formatearFechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split("-");
  return `${dia}/${mes}`;
}

/** "Semana del 21/09 al 25/09/2026" (con el año en ambas si cruza de año). */
export function formatearRangoSemana(desde: string, hasta: string): string {
  const anioDesde = desde.slice(0, 4);
  const anioHasta = hasta.slice(0, 4);
  const inicio =
    anioDesde === anioHasta ? formatearFechaCorta(desde) : `${formatearFechaCorta(desde)}/${anioDesde}`;
  return `Semana del ${inicio} al ${formatearFechaCorta(hasta)}/${anioHasta}`;
}

/** Franja visible de la grilla (horario operativo del centro). */
export type ParametrosGrilla = {
  /** "HH:mm" */
  apertura: string;
  /** "HH:mm" */
  cierre: string;
  granularidadMinutos: number;
};

/** Inicio de cada fila de la grilla: "08:00", "08:30", ... (sin el cierre). */
export function franjasDeLaGrilla({ apertura, cierre, granularidadMinutos }: ParametrosGrilla): string[] {
  const franjas: string[] = [];
  for (let m = horaAMinutos(apertura); m < horaAMinutos(cierre); m += granularidadMinutos) {
    franjas.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return franjas;
}

/**
 * Posición de un evento en la grilla, en filas (0 = primera franja). Ocupa
 * su intervalo completo (HU-J-01 c3); si cae en parte fuera del horario
 * operativo se recorta a la franja visible, y si cae completo afuera
 * devuelve `null`.
 */
export function posicionEnGrilla(
  evento: { hora_inicio: string; hora_fin: string },
  { apertura, cierre, granularidadMinutos }: ParametrosGrilla,
): { filaInicio: number; filas: number } | null {
  const minApertura = horaAMinutos(apertura);
  const inicio = Math.max(horaAMinutos(evento.hora_inicio), minApertura);
  const fin = Math.min(horaAMinutos(evento.hora_fin), horaAMinutos(cierre));
  if (fin <= inicio) return null;
  return {
    filaInicio: (inicio - minApertura) / granularidadMinutos,
    filas: (fin - inicio) / granularidadMinutos,
  };
}

/**
 * Reparte en carriles los eventos de un mismo día que se superponen, para
 * mostrarlos uno al lado del otro (`spec_modulo_J.md` §3.3: nunca se
 * ocultan ni se combinan). `carriles` es la cantidad de columnas del grupo
 * de eventos superpuestos al que pertenece cada uno.
 */
export function asignarCarriles<T extends { hora_inicio: string; hora_fin: string }>(
  eventos: readonly T[],
): { evento: T; carril: number; carriles: number }[] {
  const ordenados = [...eventos].sort(
    (a, b) =>
      horaAMinutos(a.hora_inicio) - horaAMinutos(b.hora_inicio) ||
      horaAMinutos(a.hora_fin) - horaAMinutos(b.hora_fin),
  );

  const resultado: { evento: T; carril: number; carriles: number }[] = [];
  let grupo: { evento: T; carril: number; carriles: number }[] = [];
  let finesPorCarril: number[] = [];
  let finDelGrupo = -1;

  const cerrarGrupo = () => {
    for (const item of grupo) item.carriles = finesPorCarril.length;
    resultado.push(...grupo);
    grupo = [];
    finesPorCarril = [];
  };

  for (const evento of ordenados) {
    const inicio = horaAMinutos(evento.hora_inicio);
    const fin = horaAMinutos(evento.hora_fin);
    if (inicio >= finDelGrupo) cerrarGrupo();

    let carril = finesPorCarril.findIndex((finCarril) => finCarril <= inicio);
    if (carril === -1) carril = finesPorCarril.length;
    finesPorCarril[carril] = fin;
    finDelGrupo = Math.max(finDelGrupo, fin);
    grupo.push({ evento, carril, carriles: 0 });
  }
  cerrarGrupo();

  return resultado;
}

/**
 * URL de la agenda por profesor con profesor y semana en los searchParams
 * (HU-J-01 c5 y c6). Sin `profesorId` (rol Profesor) ni `semana` (semana
 * actual), el parámetro se omite.
 */
export type RutaCalendario = "/calendario/profesor" | "/calendario/materia";

/**
 * URL de una vista del calendario con sus searchParams (entidad elegida y
 * semana), en el orden recibido y omitiendo los vacíos. Compartida por la
 * agenda por profesor (HU-J-01) y por materia (HU-J-02).
 */
export function construirUrlCalendario(
  rutaBase: RutaCalendario,
  valores: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor) params.set(clave, valor);
  }
  const query = params.toString();
  return query ? `${rutaBase}?${query}` : rutaBase;
}

export function construirUrlCalendarioProfesor({
  profesorId,
  semana,
}: {
  profesorId?: string;
  semana?: string;
}): string {
  return construirUrlCalendario("/calendario/profesor", { profesorId, semana });
}

export function construirUrlCalendarioMateria({
  materiaId,
  semana,
}: {
  materiaId?: string;
  semana?: string;
}): string {
  return construirUrlCalendario("/calendario/materia", { materiaId, semana });
}

/** Materia en el selector y el encabezado (HU-J-02): "Matemática (MAT101)" o solo el nombre. */
export function etiquetaMateria({ nombre, codigo }: { nombre: string; codigo: string | null }): string {
  return codigo ? `${nombre} (${codigo})` : nombre;
}
