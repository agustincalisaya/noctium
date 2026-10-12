import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerarTurnosSchema } from "./turno.generacion.schema";

const { materiaActiva, profesorActivo, dictaMateria, horario, aulasActivas, aulaActiva, existeAula, nombreAula, listarAulas,
  parametrosHorario, parametros, buscarTurnos, crearTurno, emitir, orden } = vi.hoisted(() => ({
  materiaActiva: vi.fn(), profesorActivo: vi.fn(), dictaMateria: vi.fn(), horario: vi.fn(),
  aulasActivas: vi.fn(), aulaActiva: vi.fn(), existeAula: vi.fn(), nombreAula: vi.fn(), listarAulas: vi.fn(),
  parametrosHorario: vi.fn(), parametros: vi.fn(), buscarTurnos: vi.fn(), crearTurno: vi.fn(), emitir: vi.fn(),
  orden: [] as string[],
}));
const tx = { parametroSistema: { findMany: parametros }, turno: { findMany: buscarTurnos, create: crearTurno } };
vi.mock("@/lib/prisma", () => ({ prisma: tx }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerOpcionProfesorActivo: profesorActivo, profesorActivoDictaMateria: dictaMateria, obtenerHorarioDeProfesor: horario,
}));
vi.mock("@/server/aulas/aula.publico", () => ({
  hayAulasActivas: aulasActivas, verificarAulaActiva: aulaActiva, existeAula,
  obtenerNombreAula: nombreAula, listarAulasActivasParaTurno: listarAulas,
}));
vi.mock("@/server/shared/parametros", () => ({ obtenerParametrosHorarioOperativo: parametrosHorario }));
// Transacción y bloqueo en memoria: registran el orden para comprobar que los eventos van después del commit.
vi.mock("@/server/shared/transaccion", () => ({
  transaccion: async (tarea: (cliente: unknown) => Promise<unknown>) => {
    const resultado = await tarea(tx);
    orden.push("commit");
    return resultado;
  },
}));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: async () => { orden.push("bloqueo"); return {}; } }));
vi.mock("./turno.publico", () => ({ emitirEventosTurno: emitir }));

const { confirmarGeneracion } = await import("./turno.generacion.service");
const ahora = new Date("2026-09-30T12:00:00.000Z"); // 09:00 en Buenos Aires
const base = {
  materia_id: "materia-1", profesor_id: "ckprofesor000000000000001", horario_id: "ckhorario000000000000001",
  duracion_min: 120, hora_inicio: "10:00", aula_id: "ckaula00000000000000001",
  fecha_desde: "2026-10-05", fecha_hasta: "2026-10-19",
};
const otraAula = "ckaula00000000000000002";
const capacidades: Record<string, number> = { [base.aula_id]: 20, [otraAula]: 8 };
const nombres: Record<string, string> = { [base.aula_id]: "Aula 1", [otraAula]: "Aula 2" };
type TurnoGuardado = { fechaTurno: Date; horaInicioTurno: Date; duracionMinutosTurno: number; profesorId: string; materiaId: string; aulaId: string; estadoTurno: "PENDIENTE" | "DISPONIBLE" | "COMPLETO" | "CANCELADO" };
let turnos: TurnoGuardado[];
const guardado = (fecha: string, hora: string, estado: TurnoGuardado["estadoTurno"], cambios: Partial<TurnoGuardado> = {}): TurnoGuardado => ({
  fechaTurno: new Date(`${fecha}T00:00:00.000Z`), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
  duracionMinutosTurno: 120, profesorId: base.profesor_id, materiaId: base.materia_id, aulaId: base.aula_id,
  estadoTurno: estado, ...cambios,
});
const entrada = () => GenerarTurnosSchema.parse(base);
const conListas = () => GenerarTurnosSchema.parse({
  ...base, aulas_por_fecha: [{ fecha: "2026-10-12", aula_id: otraAula }], fechas_excluidas: ["2026-10-19"],
});

beforeEach(() => {
  vi.clearAllMocks();
  turnos = [];
  orden.length = 0;
  materiaActiva.mockResolvedValue({ idMateria: base.materia_id });
  profesorActivo.mockResolvedValue({ id: base.profesor_id });
  dictaMateria.mockResolvedValue(true);
  horario.mockResolvedValue({ horario_id: base.horario_id, dia_semana: "LUNES", hora_inicio: "08:00", hora_fin: "14:00" });
  aulasActivas.mockResolvedValue(true);
  aulaActiva.mockImplementation(async (id: string) => capacidades[id] ? { idAula: id, capacidadAula: capacidades[id] } : null);
  existeAula.mockResolvedValue(false);
  nombreAula.mockImplementation(async (id: string) => nombres[id] ? { id, nombre: nombres[id] } : null);
  listarAulas.mockResolvedValue([]);
  parametrosHorario.mockResolvedValue({ diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"], apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 });
  parametros.mockResolvedValue([
    { clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "40" },
  ]);
  buscarTurnos.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => turnos.filter((turno) => {
    if (turno.fechaTurno.getTime() !== (where.fechaTurno as Date).getTime()) return false;
    if (where.materiaId && turno.materiaId !== where.materiaId) return false;
    if (where.aulaId && turno.aulaId !== where.aulaId) return false;
    if (typeof where.profesorId === "string" && turno.profesorId !== where.profesorId) return false;
    if (where.profesorId && typeof where.profesorId === "object" && !(where.profesorId as { in: string[] }).in.includes(turno.profesorId)) return false;
    if (where.estadoTurno && typeof where.estadoTurno === "object") {
      const estado = where.estadoTurno as { not?: string; in?: string[] };
      if (estado.not && turno.estadoTurno === estado.not) return false;
      if (estado.in && !estado.in.includes(turno.estadoTurno)) return false;
    }
    return true;
  }));
  let secuencia = 0;
  crearTurno.mockImplementation(async () => { orden.push("insert"); return { idTurno: `cturno${++secuencia}` }; });
  emitir.mockImplementation(async () => { orden.push("eventos"); });
});

describe("HU-C-21: confirmación con aula y cupo por clase", () => {
  it("crea cada clase incluida con el aula y el cupo de su fecha y no crea las excluidas", async () => {
    const resultado = await confirmarGeneracion(conListas(), "usuario-1", ahora);
    expect(resultado).toEqual({ generacion_id: "cturno1", cantidad: 2, turno_ids: ["cturno1", "cturno2"], aulas_cambiadas: 1, fechas_excluidas: 1 });
    expect(crearTurno.mock.calls.map(([{ data }]) => [data.fechaTurno.toISOString().slice(0, 10), data.aulaId, data.cupoMaximoTurno, data.estadoTurno])).toEqual([
      ["2026-10-05", base.aula_id, 20, "DISPONIBLE"],
      ["2026-10-12", otraAula, 8, "DISPONIBLE"],
    ]);
  });

  it("un pedido de Sprint 2 informa 0 aulas cambiadas y 0 fechas excluidas", async () => {
    await expect(confirmarGeneracion(entrada(), "usuario-1", ahora)).resolves.toMatchObject({ cantidad: 3, aulas_cambiadas: 0, fechas_excluidas: 0 });
    expect(crearTurno.mock.calls.every(([{ data }]) => data.aulaId === base.aula_id && data.cupoMaximoTurno === 20)).toBe(true);
  });

  it("los eventos llevan el aula y el cupo de cada clase y se emiten después del commit", async () => {
    await confirmarGeneracion(conListas(), "usuario-1", ahora);
    expect(orden).toEqual(["bloqueo", "insert", "insert", "commit", "eventos"]);
    const eventos = emitir.mock.calls[0]![0] as { tipoEvento: string; turnoId: string; payloadEvento: Record<string, unknown> }[];
    const payload = (turnoId: string, tipo: string) => eventos.find((evento) => evento.turnoId === turnoId && evento.tipoEvento === tipo)?.payloadEvento;
    expect(payload("cturno1", "turno:aula_asignada")).toMatchObject({ aula_id: base.aula_id, cupo_maximo: 20 });
    expect(payload("cturno2", "turno:aula_asignada")).toMatchObject({ aula_id: otraAula, cupo_maximo: 8 });
    expect(payload("cturno1", "turno:disponibilizado")).toMatchObject({ aula_id: base.aula_id });
    expect(payload("cturno2", "turno:disponibilizado")).toMatchObject({ aula_id: otraAula });
    expect(payload("cturno2", "turno:configurado")).toMatchObject({ generacion_id: "cturno1" });
    expect(eventos).toHaveLength(6);
  });

  it("un conflicto en una fecha incluida no crea nada, no emite eventos y no calcula aulas libres", async () => {
    turnos.push(guardado("2026-10-12", "10:00", "DISPONIBLE", { materiaId: "otra-materia", profesorId: "otro-profesor", aulaId: otraAula }));
    await expect(confirmarGeneracion(conListas(), "usuario-1", ahora)).rejects.toMatchObject({
      code: "GENERACION_CON_CONFLICTOS",
      detalles: { hay_conflictos: true, fechas: [{ estado: "OK" }, { motivos: ["AULA_OCUPADA"], aula_cambiada: true, sin_aulas_libres: false }, { excluida: true }] },
    });
    expect(crearTurno).not.toHaveBeenCalled();
    expect(emitir).not.toHaveBeenCalled();
    expect(listarAulas).not.toHaveBeenCalled();
  });

  it("un conflicto en una fecha excluida no impide confirmar", async () => {
    turnos.push(guardado("2026-10-19", "10:00", "PENDIENTE"));
    await expect(confirmarGeneracion(conListas(), "usuario-1", ahora)).resolves.toMatchObject({ cantidad: 2, fechas_excluidas: 1 });
  });
});
