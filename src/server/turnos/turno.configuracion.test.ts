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
const input = { fecha: new Date("2026-10-01T00:00:00.000Z"), hora_inicio: "10:00", materia_id: MATERIA };
const actual = {
  estadoTurno: "PENDIENTE", fechaTurno: input.fecha, horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"),
  materiaId: MATERIA, profesorId: null, cupoMaximoTurno: 20, updatedAtTurno: new Date("2026-09-24T00:00:00.000Z"),
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

describe("HU-C-03 schema (Revisión 3: sin cupo)", () => {
  const base = { fecha: "2026-10-01", hora_inicio: "10:00", materia_id: MATERIA };
  it("acepta la configuración sin cupo_maximo", () => {
    expect(ConfigurarTurnoSchema.safeParse(base).success).toBe(true);
  });
  it("descarta un cupo_maximo enviado por el cliente: el cupo lo fija el aula", () => {
    const resultado = ConfigurarTurnoSchema.safeParse({ ...base, cupo_maximo: 5 });
    expect(resultado.success).toBe(true);
    expect(resultado.data).not.toHaveProperty("cupo_maximo");
  });
});

describe("HU-C-03 configurarTurno", () => {
  it("crea el turno PENDIENTE sin aula, sin cupo y sin recursos", async () => {
    await expect(configurarTurno(input, USUARIO)).resolves.toEqual({ id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", cupo_maximo: null, estado: "PENDIENTE" });
    expect(turno.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cupoMaximoTurno: null, estadoTurno: "PENDIENTE", profesorId: null, aulaId: null, creadoPorUsuarioId: USUARIO }) });
  });
  it("emite turno:configurado sin cupo_maximo después del INSERT", async () => {
    await configurarTurno(input, USUARIO);
    expect(payload("turno:configurado")).toEqual({ turno_id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia_id: MATERIA, usuario_id: USUARIO });
    expect(turno.create.mock.invocationCallOrder[0]).toBeLessThan(evento.mock.invocationCallOrder[0]);
  });
  it("no crea el turno si la materia no está activa", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(turno.create).not.toHaveBeenCalled();
  });
});

describe("HU-C-03 modificarConfiguracionTurno", () => {
  it("actualiza con la condición de estado y versión en la misma sentencia, sin tocar el cupo del aula", async () => {
    const nueva = new Date("2026-10-02T00:00:00.000Z");
    await expect(modificarConfiguracionTurno(TURNO, { ...input, fecha: nueva }, USUARIO)).resolves.toMatchObject({ cupo_maximo: 20, estado: "PENDIENTE" });
    const [{ where, data }] = turno.updateMany.mock.calls[0]!;
    expect(where).toMatchObject({ idTurno: TURNO, estadoTurno: "PENDIENTE", updatedAtTurno: actual.updatedAtTurno });
    expect(data).toMatchObject({ fechaTurno: nueva });
    expect(data).not.toHaveProperty("cupoMaximoTurno");
    expect(turnoAlumno.count).not.toHaveBeenCalled();
    expect(payload("turno:configuracion_modificada")).toMatchObject({ campos_modificados: ["fecha"] });
  });
  it("rechaza con TURNO_YA_DISPONIBLE un turno DISPONIBLE o COMPLETO", async () => {
    for (const estadoTurno of ["DISPONIBLE", "COMPLETO"]) {
      turno.findUnique.mockResolvedValueOnce({ ...actual, estadoTurno });
      await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
    }
    expect(turno.updateMany).not.toHaveBeenCalled();
  });
  it("informa TURNO_MODIFICADO si la fila cambió entre la lectura y la actualización", async () => {
    turno.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(evento).not.toHaveBeenCalled();
  });
});
