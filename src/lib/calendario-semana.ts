import { DIAS_SEMANA, ETIQUETA_DIA, horaAMinutos, type DiaSemanaValor } from "@/lib/horario-atencion";

/**
 * Helpers puros del calendario (HU-J-01/J-02, `spec_modulo_J.md` §2.1 y
 * §2.2; vistas día, semana y mes de HU-J-03, §2.3).
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

// ------------------------------------------------------------
// Vistas día / semana / mes (HU-J-03, `spec_modulo_J.md` §2.3)
// ------------------------------------------------------------

export const VISTAS_CALENDARIO = ["dia", "semana", "mes"] as const;
export type VistaCalendario = (typeof VISTAS_CALENDARIO)[number];

export const ETIQUETA_VISTA: Record<VistaCalendario, string> = { dia: "Día", semana: "Semana", mes: "Mes" };

export function esVistaCalendario(valor: unknown): valor is VistaCalendario {
  return typeof valor === "string" && (VISTAS_CALENDARIO as readonly string[]).includes(valor);
}

/**
 * Vista y fecha de referencia a partir de los searchParams de la página.
 * Sin `vista` (o desconocida) -> semana; sin `fecha` (o inválida) -> hoy.
 * `semana` es el parámetro de HU-J-01/J-02: equivale a `vista=semana&fecha=<valor>`.
 * `fechaExplicita` indica si la fecha vino en la URL (si no, "hoy" se
 * conserva implícito al cambiar de profesor o materia).
 */
export function resolverVistaYFecha(
  params: { vista?: string; fecha?: string; semana?: string },
  hoy: string,
): { vista: VistaCalendario; fecha: string; fechaExplicita: boolean } {
  const vista = esVistaCalendario(params.vista) ? params.vista : "semana";
  const fecha = esFechaCalendario(params.fecha)
    ? params.fecha
    : vista === "semana" && esFechaCalendario(params.semana)
      ? params.semana
      : undefined;
  return { vista, fecha: fecha ?? hoy, fechaExplicita: fecha !== undefined };
}

/** Día de la semana de una fecha "AAAA-MM-DD". */
export function diaDeLaFecha(fecha: string): DiaSemanaValor {
  return DIAS_SEMANA[(aFechaUTC(fecha).getUTCDay() + 6) % 7]!;
}

export const ETIQUETA_DIA_CORTA: Record<DiaSemanaValor, string> = {
  LUNES: "LUN",
  MARTES: "MAR",
  MIERCOLES: "MIÉ",
  JUEVES: "JUE",
  VIERNES: "VIE",
  SABADO: "SÁB",
  DOMINGO: "DOM",
};

export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function ultimoDiaDelMes(fecha: string): string {
  const [anio, mes] = fecha.split("-").map(Number);
  return fechaISO(new Date(Date.UTC(anio!, mes!, 0)));
}

/** Día 1 del mes que está `meses` antes o después del de `fecha`. */
export function desplazarMes(fecha: string, meses: number): string {
  const [anio, mes] = fecha.split("-").map(Number);
  return fechaISO(new Date(Date.UTC(anio!, mes! - 1 + meses, 1)));
}

/** ‹ / ›: un día, una semana o un mes según la vista. */
export function desplazarFecha(vista: VistaCalendario, fecha: string, pasos: number): string {
  if (vista === "dia") return sumarDias(fecha, pasos);
  if (vista === "semana") return desplazarSemana(lunesDeLaSemana(fecha), pasos);
  return desplazarMes(fecha, pasos);
}

/**
 * Grilla de la vista mes: semanas completas de lunes a domingo, desde la que
 * contiene el día 1 hasta la que contiene el último día (5 o 6 semanas). Los
 * días de otros meses son el relleno de la grilla.
 */
export function grillaDelMes(fecha: string): { desde: string; hasta: string; semanas: string[][] } {
  const desde = lunesDeLaSemana(primerDiaDelMes(fecha));
  const hasta = sumarDias(lunesDeLaSemana(ultimoDiaDelMes(fecha)), 6);
  const semanas: string[][] = [];
  for (let lunes = desde; lunes <= hasta; lunes = desplazarSemana(lunes, 1)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)));
  }
  return { desde, hasta, semanas };
}

/**
 * Período de una vista: `rango` es lo que se muestra en el encabezado y
 * `consulta` el rango cerrado de turnos a leer (`spec_modulo_J.md` §2.3
 * punto 1). En el mes, `consulta` abarca la grilla completa para que los
 * días de relleno también muestren sus turnos (HU-J-03.md §1 punto 3).
 */
export type PeriodoCalendario =
  | { vista: "dia" | "semana"; rango: RangoFechas; consulta: RangoFechas; dias: DiaDeSemana[] }
  | { vista: "mes"; rango: RangoFechas; consulta: RangoFechas; semanas: string[][] };

type RangoFechas = { desde: string; hasta: string };

export function periodoDeLaVista(
  vista: VistaCalendario,
  fecha: string,
  diasOperativos: readonly DiaSemanaValor[],
): PeriodoCalendario {
  if (vista === "dia") {
    // Se muestra aunque no sea un día operativo (clic en un sábado del mes, "Hoy" un domingo).
    const rango = { desde: fecha, hasta: fecha };
    return { vista, rango, consulta: rango, dias: [{ fecha, dia: diaDeLaFecha(fecha) }] };
  }
  if (vista === "semana") {
    const lunes = lunesDeLaSemana(fecha);
    const rango = rangoDeLaSemana(lunes, diasOperativos);
    return { vista, rango, consulta: rango, dias: diasOperativosDeLaSemana(lunes, diasOperativos) };
  }
  const grilla = grillaDelMes(fecha);
  return {
    vista,
    rango: { desde: primerDiaDelMes(fecha), hasta: ultimoDiaDelMes(fecha) },
    consulta: { desde: grilla.desde, hasta: grilla.hasta },
    semanas: grilla.semanas,
  };
}

/** ¿La vista muestra el período que contiene a hoy? (botón "Hoy" y resaltado). */
export function esPeriodoActual(vista: VistaCalendario, fecha: string, hoy: string): boolean {
  if (vista === "dia") return fecha === hoy;
  if (vista === "semana") return lunesDeLaSemana(fecha) === lunesDeLaSemana(hoy);
  return fecha.slice(0, 7) === hoy.slice(0, 7);
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio: anio!, mes: MESES[mes! - 1]!, dia: dia! };
}

/** "Miércoles 30 de septiembre de 2026". */
export function formatearDiaLargo(fecha: string): string {
  const { anio, mes, dia } = partes(fecha);
  return `${ETIQUETA_DIA[diaDeLaFecha(fecha)]} ${dia} de ${mes} de ${anio}`;
}

/** "28 sep – 2 oct 2026"; con el año en ambas fechas si cruza de año. */
export function formatearRangoCorto(desde: string, hasta: string): string {
  const inicio = partes(desde);
  const fin = partes(hasta);
  const textoInicio = `${inicio.dia} ${inicio.mes.slice(0, 3)}${inicio.anio === fin.anio ? "" : ` ${inicio.anio}`}`;
  return `${textoInicio} – ${fin.dia} ${fin.mes.slice(0, 3)} ${fin.anio}`;
}

/** "Septiembre 2026". */
export function formatearMes(fecha: string): string {
  const { anio, mes } = partes(fecha);
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${anio}`;
}

/** Rótulo del período en el encabezado, según la vista. */
export function rotuloDelPeriodo(periodo: PeriodoCalendario): string {
  if (periodo.vista === "dia") return formatearDiaLargo(periodo.rango.desde);
  if (periodo.vista === "semana") return formatearRangoCorto(periodo.rango.desde, periodo.rango.hasta);
  return formatearMes(periodo.rango.desde);
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

export type RutaCalendario = "/calendario/profesor" | "/calendario/materia";

/**
 * URL de una vista del calendario con sus searchParams (entidad elegida,
 * vista y fecha), en el orden recibido y omitiendo los vacíos. Compartida
 * por la agenda por profesor (HU-J-01) y por materia (HU-J-02). Sin `fecha`,
 * la vista abre en hoy (HU-J-03 c4 y c5).
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

type VistaYFechaUrl = { vista?: VistaCalendario; fecha?: string };

export function construirUrlCalendarioProfesor({
  profesorId,
  vista,
  fecha,
}: { profesorId?: string } & VistaYFechaUrl): string {
  return construirUrlCalendario("/calendario/profesor", { profesorId, vista, fecha });
}

export function construirUrlCalendarioMateria({
  materiaId,
  vista,
  fecha,
}: { materiaId?: string } & VistaYFechaUrl): string {
  return construirUrlCalendario("/calendario/materia", { materiaId, vista, fecha });
}

/** Links del encabezado de una vista del calendario (control de vista y navegación). */
export type NavegacionDelCalendario = {
  rotulo: string;
  hrefsVista: Record<VistaCalendario, string>;
  hrefAnterior: string;
  hrefHoy: string;
  hrefSiguiente: string;
  esPeriodoActual: boolean;
};

/**
 * Arma los links del encabezado (HU-J-03 c1, c4 y c5, `spec_modulo_J.md`
 * §2.3 punto 6): cambiar de vista y "Hoy" omiten `fecha` (abren en hoy);
 * ‹ / › mueven la fecha un día, una semana o un mes. `url` conserva la
 * entidad elegida (profesor o materia).
 */
export function navegacionDelCalendario({
  periodo,
  fecha,
  hoy,
  url,
}: {
  periodo: PeriodoCalendario;
  fecha: string;
  hoy: string;
  url: (valores: VistaYFechaUrl) => string;
}): NavegacionDelCalendario {
  const { vista } = periodo;
  return {
    rotulo: rotuloDelPeriodo(periodo),
    hrefsVista: { dia: url({ vista: "dia" }), semana: url({ vista: "semana" }), mes: url({ vista: "mes" }) },
    hrefAnterior: url({ vista, fecha: desplazarFecha(vista, fecha, -1) }),
    hrefHoy: url({ vista }),
    hrefSiguiente: url({ vista, fecha: desplazarFecha(vista, fecha, 1) }),
    esPeriodoActual: esPeriodoActual(vista, fecha, hoy),
  };
}

/** Materia en el selector y el encabezado (HU-J-02): "Matemática (MAT101)" o solo el nombre. */
export function etiquetaMateria({ nombre, codigo }: { nombre: string; codigo: string | null }): string {
  return codigo ? `${nombre} (${codigo})` : nombre;
}
