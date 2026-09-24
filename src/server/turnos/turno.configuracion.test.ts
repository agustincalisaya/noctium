import { beforeEach, describe, expect, it, vi } from "vitest";

const { turno, turnoAlumno, evento, materiaActiva, validar, dicta } = vi.hoisted(() => ({
  turno: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  turnoAlumno: { count: vi.fn() },
  evento: vi.fn(), materiaActiva: vi.fn(), validar: vi.fn(), dicta: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno, turnoAlumno, eventoTurno: { create: evento } } }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.service", () => ({
  profesorActivoDictaMateria: dicta, listarProfesoresActivosPorMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(), intervalosSeSuperponen: vi.fn(),
}));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: vi.fn() }));
vi.mock("@/server/turnos/turno.validaciones", () => ({ validarConfiguracionTurno: validar, turnoSigueVigente: vi.fn() }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { configurarTurno, modificarConfiguracionTurno } = await import("./turno.service");
const { ConfigurarTurnoSchema } = await import("./turno.schema");
const TURNO = "ckturno00000000000000001";
const MATERIA = "ckmateria0000000000000001";
const USUARIO = "ckusuario0000000000000001";
const input = { fecha: new Date("2026-10-01T00:00:00.000Z"), hora_inicio: "10:00", materia_id: MATERIA, cupo_maximo: 5 };
const actual = {
  estadoTurno: "PENDIENTE", fechaTurno: input.fecha, horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"),
  materiaId: MATERIA, profesorId: null, cupoMaximoTurno: 5, updatedAtTurno: new Date("2026-09-24T00:00:00.000Z"),
};
const payload = (tipo: string) => evento.mock.calls.find(([{ data }]) => data.tipoEvento === tipo)?.[0].data.payloadEvento;

beforeEach(() => {
  vi.clearAllMocks();
  materiaActiva.mockResolvedValue({ idMateria: MATERIA });
  validar.mockResolvedValue({ fecha: "2026-10-01", hora_fin: "11:00", duracion_minutos: 60 });
  turno.create.mockImplementation(async ({ data }) => ({ idTurno: TURNO, ...data }));
  turno.findUnique.mockResolvedValue(actual);
  turno.updateMany.mockResolvedValue({ count: 1 });
  turnoAlumno.count.mockResolvedValue(0);
  evento.mockResolvedValue({});
});

describe("HU-C-03 cupo máximo — schema", () => {
  const base = { fecha: "2026-10-01", hora_inicio: "10:00", materia_id: MATERIA };
  it("exige cupo_maximo entero mayor que cero", () => {
    expect(ConfigurarTurnoSchema.safeParse({ ...base, cupo_maximo: 5 }).success).toBe(true);
    for (const cupo_maximo of [undefined, 0, -1, 2.5, "5"]) {
      const resultado = ConfigurarTurnoSchema.safeParse({ ...base, cupo_maximo });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.flatten().fieldErrors.cupo_maximo).toBeDefined();
    }
  });
  it("rechaza un cupo que desborda la columna INTEGER", () => {
    expect(ConfigurarTurnoSchema.safeParse({ ...base, cupo_maximo: 2_147_483_648 }).success).toBe(false);
  });
});

describe("HU-C-03 configurarTurno", () => {
  it("persiste cupoMaximoTurno en PENDIENTE, sin recursos, y lo devuelve", async () => {
    await expect(configurarTurno(input, USUARIO)).resolves.toEqual({ id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", cupo_maximo: 5, estado: "PENDIENTE" });
    expect(turno.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cupoMaximoTurno: 5, estadoTurno: "PENDIENTE", profesorId: null, aulaId: null, creadoPorUsuarioId: USUARIO }) });
  });
  it("emite turno:configurado con cupo_maximo después del INSERT", async () => {
    await configurarTurno(input, USUARIO);
    expect(payload("turno:configurado")).toEqual({ turno_id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia_id: MATERIA, cupo_maximo: 5, usuario_id: USUARIO });
    expect(turno.create.mock.invocationCallOrder[0]).toBeLessThan(evento.mock.invocationCallOrder[0]);
  });
  it("no crea el turno si la materia no está activa", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(turno.create).not.toHaveBeenCalled();
  });
});

describe("HU-C-03 modificarConfiguracionTurno", () => {
  it("actualiza el cupo con la condición de estado y versión en la misma sentencia", async () => {
    await expect(modificarConfiguracionTurno(TURNO, { ...input, cupo_maximo: 8 }, USUARIO)).resolves.toMatchObject({ cupo_maximo: 8, estado: "PENDIENTE" });
    expect(turno.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ idTurno: TURNO, estadoTurno: "PENDIENTE", updatedAtTurno: actual.updatedAtTurno, cupoMaximoTurno: 5 }),
      data: expect.objectContaining({ cupoMaximoTurno: 8 }),
    });
    expect(payload("turno:configuracion_modificada")).toMatchObject({ campos_modificados: ["cupo_maximo"] });
  });
  it("rechaza un cupo menor a los alumnos ya cargados sin actualizar", async () => {
    turnoAlumno.count.mockResolvedValueOnce(3);
    await expect(modificarConfiguracionTurno(TURNO, { ...input, cupo_maximo: 2 }, USUARIO)).rejects.toMatchObject({ code: "CUPO_MENOR_A_INSCRIPTOS" });
    expect(turno.updateMany).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });
  it("acepta un cupo igual a los alumnos ya cargados", async () => {
    turnoAlumno.count.mockResolvedValueOnce(3);
    await expect(modificarConfiguracionTurno(TURNO, { ...input, cupo_maximo: 3 }, USUARIO)).resolves.toMatchObject({ cupo_maximo: 3 });
  });
  it("rechaza con TURNO_YA_DISPONIBLE un turno DISPONIBLE o COMPLETO", async () => {
    for (const estadoTurno of ["DISPONIBLE", "COMPLETO"]) {
      turno.findUnique.mockResolvedValueOnce({ ...actual, estadoTurno });
      await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
    }
    expect(turno.updateMany).not.toHaveBeenCalled();
  });
  it("informa TURNO_MODIFICADO si la fila cambió entre el conteo y la actualización", async () => {
    turno.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(evento).not.toHaveBeenCalled();
  });
});
