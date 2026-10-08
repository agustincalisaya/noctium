import type { Tx } from "@/server/shared/transaccion";

/**
 * Bloqueo en orden canónico (PR-0.md §2.10 y §2.16). Toma los
 * `SELECT … FOR UPDATE` en este orden y, dentro de cada tipo, por id
 * ascendente (`COLLATE "C"`, el mismo orden que `Array.prototype.sort`):
 *
 *  0. el conjunto «formas de pago activas» (HU-I-07): nivel propio, antes que
 *     todo y sin combinarse con otros bloqueos;
 *  1. recursos: aula, materia, profesor, alumno, ficha de mesa de entrada,
 *     ficha de gerente (varias a la vez);
 *  2. clases; 3. inscripciones; 4. operaciones de pago; 5. cajas.
 *
 * Guarda en la transacción el último nivel e id tomados: pedir uno ya tomado
 * no hace nada y pedir uno anterior lanza `ErrorDeBloqueo` en desarrollo y en
 * las pruebas (en producción solo se registra y se bloquea igual). Una
 * operación compuesta pide todo al inicio, en una sola llamada.
 */
export type SolicitudBloqueo = {
  /** Todas las formas de pago activas. No se combina con nada más. */
  formasPago?: boolean;
  recursos?: {
    aulas?: readonly string[];
    materias?: readonly string[];
    profesores?: readonly string[];
    alumnos?: readonly string[];
    fichasMesaEntrada?: readonly string[];
    fichasGerente?: readonly string[];
  };
  clases?: readonly string[];
  inscripciones?: readonly string[];
  operaciones?: readonly string[];
  cajas?: readonly string[];
};

type TipoBloqueo =
  | "formasPago" | "aulas" | "materias" | "profesores" | "alumnos" | "fichasMesaEntrada" | "fichasGerente"
  | "clases" | "inscripciones" | "operaciones" | "cajas";

/** Ids efectivamente encontrados y bloqueados en esta llamada, por tipo. */
export type ResultadoBloqueo = Partial<Record<TipoBloqueo, string[]>>;

// Orden canónico. Tablas y columnas fijas (nunca vienen del llamador).
const NIVELES: readonly { tipo: TipoBloqueo; tabla: string; id: string }[] = [
  { tipo: "formasPago", tabla: "formas_pago", id: "idFormaPago" },
  { tipo: "aulas", tabla: "aulas", id: "idAula" },
  { tipo: "materias", tabla: "materias", id: "idMateria" },
  { tipo: "profesores", tabla: "profesores", id: "idProfesor" },
  { tipo: "alumnos", tabla: "alumnos", id: "idAlumno" },
  { tipo: "fichasMesaEntrada", tabla: "fichas_mesa_entrada", id: "idFichaMesaEntrada" },
  { tipo: "fichasGerente", tabla: "fichas_gerente", id: "idFichaGerente" },
  { tipo: "clases", tabla: "turnos", id: "idTurno" },
  { tipo: "inscripciones", tabla: "turno_alumno", id: "idInscripcion" },
  { tipo: "operaciones", tabla: "operaciones_pago", id: "idOperacionPago" },
  { tipo: "cajas", tabla: "cajas", id: "idCaja" },
];

export class ErrorDeBloqueo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeBloqueo";
  }
}

type EstadoBloqueos = { ultimo: { nivel: number; id: string } | null; tomados: Set<string> };
const estados = new WeakMap<object, EstadoBloqueos>();

function estadoDe(tx: Tx): EstadoBloqueos {
  let estado = estados.get(tx);
  if (!estado) {
    estado = { ultimo: null, tomados: new Set() };
    estados.set(tx, estado);
  }
  return estado;
}

const verificaOrden = () => process.env.NODE_ENV !== "production";
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const CONJUNTO_FORMAS_PAGO = "*";

function idsPorNivel(solicitud: SolicitudBloqueo): Map<number, string[]> {
  const pedidos: Partial<Record<TipoBloqueo, readonly string[] | undefined>> = {
    ...solicitud.recursos,
    clases: solicitud.clases,
    inscripciones: solicitud.inscripciones,
    operaciones: solicitud.operaciones,
    cajas: solicitud.cajas,
  };
  const porNivel = new Map<number, string[]>();
  NIVELES.forEach(({ tipo }, nivel) => {
    if (tipo === "formasPago") {
      if (solicitud.formasPago) porNivel.set(nivel, [CONJUNTO_FORMAS_PAGO]);
      return;
    }
    const ids = pedidos[tipo];
    if (ids && ids.length > 0) porNivel.set(nivel, [...new Set(ids)].sort(comparar));
  });
  return porNivel;
}

function anteriorAlUltimo(estado: EstadoBloqueos, nivel: number, id: string): boolean {
  const { ultimo } = estado;
  if (!ultimo) return false;
  return nivel < ultimo.nivel || (nivel === ultimo.nivel && comparar(id, ultimo.id) < 0);
}

export async function bloquear(tx: Tx, solicitud: SolicitudBloqueo): Promise<ResultadoBloqueo> {
  const porNivel = idsPorNivel(solicitud);
  if (porNivel.has(0) && porNivel.size > 1) {
    throw new ErrorDeBloqueo("El bloqueo de las formas de pago es un nivel propio y no se combina con otros");
  }

  const estado = estadoDe(tx);
  if (estado.tomados.has(`0:${CONJUNTO_FORMAS_PAGO}`) && [...porNivel.keys()].some((nivel) => nivel > 0)) {
    throw new ErrorDeBloqueo("Una transacción que bloqueó las formas de pago no toma otros bloqueos");
  }
  const resultado: ResultadoBloqueo = {};
  for (const [nivel, ids] of [...porNivel].sort(([a], [b]) => a - b)) {
    const { tipo, tabla, id: columna } = NIVELES[nivel];
    const nuevos = ids.filter((id) => !estado.tomados.has(`${nivel}:${id}`));
    if (nuevos.length === 0) continue;

    const fueraDeOrden = nuevos.find((id) => anteriorAlUltimo(estado, nivel, id));
    if (fueraDeOrden !== undefined) {
      const mensaje = `bloquear: se pidió ${tipo} ${fueraDeOrden} después de ${NIVELES[estado.ultimo!.nivel].tipo} ${estado.ultimo!.id} (orden canónico de PR-0.md §2.10)`;
      if (verificaOrden()) throw new ErrorDeBloqueo(mensaje);
      console.error(`[bloquear] ${mensaje}`);
    }

    const filas = tipo === "formasPago"
      ? await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "${columna}" AS id FROM "${tabla}" WHERE "activaFormaPago" ORDER BY "${columna}" COLLATE "C" FOR UPDATE`,
      )
      : await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "${columna}" AS id FROM "${tabla}" WHERE "${columna}" = ANY($1::text[]) ORDER BY "${columna}" COLLATE "C" FOR UPDATE`,
        nuevos,
      );

    resultado[tipo] = filas.map((fila) => fila.id);
    for (const id of nuevos) estado.tomados.add(`${nivel}:${id}`);
    const mayor = nuevos[nuevos.length - 1];
    if (!estado.ultimo || !anteriorAlUltimo(estado, nivel, mayor)) estado.ultimo = { nivel, id: mayor };
  }
  return resultado;
}
