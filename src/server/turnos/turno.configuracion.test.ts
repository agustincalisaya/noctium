import { beforeEach, describe, expect, it, vi } from "vitest";

const { turno, turnoAlumno, evento, materiaActiva, validar, dicta, opcion, horario, transaccion } = vi.hoisted(() => ({
  turno: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  turnoAlumno: { count: vi.fn() },
  evento: vi.fn(), materiaActiva: vi.fn(), validar: vi.fn(), dicta: vi.fn(), opcion: vi.fn(), horario: vi.fn(), transaccion: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno, turnoAlumno, $transaction: transaccion, eventoTurno: { create: evento } } }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerOpcionProfesorActivo: opcion, profesorActivoDictaMateria: dicta, listarProfesoresActivosPorMateria: vi.fn(), estaDentroDeHorarioAtencion: horario,
}));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: vi.fn() }));
vi.mock("@/server/turnos/turno.validaciones", () => ({ validarConfiguracionTurno: validar, turnoSigueVigente: vi.fn() }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { configurarTurno, modificarConfiguracionTurno } = await import("./turno.service");
const { ConfigurarTurnoSchema } = await import("./turno.schema");
const TURNO = "ckturno00000000000000001";
const MATERIA = "ckmateria0000000000000001";
const PROFESOR = "ckprofesor000000000000001";
const AULA = "ckaula000000000000000001";
const USUARIO = "ckusuario0000000000000001";
const input = { fecha: new Date("2026-10-01T00:00:00.000Z"), hora_inicio: "10:00", materia_id: MATERIA, profesor_id: PROFESOR, duracion_min: 60 };
const actual = {
  estadoTurno: "PENDIENTE", fechaTurno: input.fecha, horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60,
  materiaId: MATERIA, profesorId: PROFESOR, aulaId: null, cupoMaximoTurno: null, updatedAtTurno: new Date("2026-09-24T00:00:00.000Z"),
};
const payload = (tipo: string) => evento.mock.calls.find(([{ data }]) => data.tipoEvento === tipo)?.[0].data.payloadEvento;

beforeEach(() => {
  vi.clearAllMocks();
  transaccion.mockImplementation((callback: (tx: unknown) => unknown) => callback({ turno }));
  materiaActiva.mockResolvedValue({ idMateria: MATERIA });
  opcion.mockResolvedValue({ id: PROFESOR }); dicta.mockResolvedValue(true); horario.mockResolvedValue(true);
  validar.mockResolvedValue({ fecha: "2026-10-01", hora_fin: "11:00", duracion_min: 60 });
  turno.create.mockImplementation(async ({ data }) => ({ idTurno: TURNO, ...data }));
  turno.findMany.mockResolvedValue([]);
  turno.findUnique.mockResolvedValue(actual);
  turno.updateMany.mockResolvedValue({ count: 1 });
  turnoAlumno.count.mockResolvedValue(0);
  evento.mockResolvedValue({});
});

describe("HU-C-03 schema (Revisión 3: sin cupo; Revisión 4: duración obligatoria)", () => {
  const base = { fecha: "2026-10-01", hora_inicio: "10:00", materia_id: MATERIA, profesor_id: PROFESOR, duracion_min: 60 };
  it("exige profesor_id CUID obligatorio", () => {
    expect(ConfigurarTurnoSchema.safeParse({ ...base, profesor_id: undefined }).error?.flatten().fieldErrors.profesor_id).toBeDefined();
    expect(ConfigurarTurnoSchema.safeParse({ ...base, profesor_id: "otro" }).success).toBe(false);
  });
  it("acepta la configuración sin cupo_maximo", () => {
    expect(ConfigurarTurnoSchema.safeParse(base).success).toBe(true);
  });
  it("descarta un cupo_maximo enviado por el cliente: el cupo lo fija el aula", () => {
    const resultado = ConfigurarTurnoSchema.safeParse({ ...base, cupo_maximo: 5 });
    expect(resultado.success).toBe(true);
    expect(resultado.data).not.toHaveProperty("cupo_maximo");
  });
  it.each([60, 120, 180])("acepta la duración permitida %i", (duracion_min) => {
    expect(ConfigurarTurnoSchema.safeParse({ ...base, duracion_min }).data?.duracion_min).toBe(duracion_min);
  });
  it("exige la duración: sin valor por defecto", () => {
    const { duracion_min: _omitida, ...sinDuracion } = base;
    void _omitida;
    const resultado = ConfigurarTurnoSchema.safeParse(sinDuracion);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.flatten().fieldErrors.duracion_min).toEqual(["Elegí la duración del turno"]);
  });
  it.each([[0], [30], [90], [240], [60.5], ["120"], [null]])("rechaza la duración %j", (duracion_min) => {
    const resultado = ConfigurarTurnoSchema.safeParse({ ...base, duracion_min });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.flatten().fieldErrors.duracion_min).toBeDefined();
  });
});

describe("HU-C-03 configurarTurno", () => {
  it("crea el turno PENDIENTE con profesor, sin aula, cupo, alumnos ni reservas", async () => {
    await expect(configurarTurno(input, USUARIO)).resolves.toEqual({ id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", duracion_min: 60, profesor_id: PROFESOR, cupo_maximo: null, estado: "PENDIENTE" });
    expect(turno.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cupoMaximoTurno: null, estadoTurno: "PENDIENTE", profesorId: PROFESOR, aulaId: null, creadoPorUsuarioId: USUARIO }) });
    expect(turnoAlumno.count).not.toHaveBeenCalled();
  });
  it("persiste la duración elegida, no un valor fijo (Revisión 4)", async () => {
    validar.mockResolvedValueOnce({ fecha: "2026-10-01", hora_fin: "12:00", duracion_min: 120 });
    await expect(configurarTurno({ ...input, duracion_min: 120 }, USUARIO)).resolves.toMatchObject({ hora_fin: "12:00", duracion_min: 120 });
    expect(turno.create).toHaveBeenCalledWith({ data: expect.objectContaining({ duracionMinutosTurno: 120 }) });
  });
  it("emite turno:configurado con duracion_min y sin cupo_maximo después del INSERT", async () => {
    await configurarTurno(input, USUARIO);
    expect(payload("turno:configurado")).toEqual({ turno_id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", duracion_min: 60, materia_id: MATERIA, profesor_id: PROFESOR, usuario_id: USUARIO });
    expect(turno.create.mock.invocationCallOrder[0]).toBeLessThan(evento.mock.invocationCallOrder[0]);
  });
  it("no crea el turno si la materia no está activa", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(turno.create).not.toHaveBeenCalled();
  });
  it("rechaza profesor inexistente/inactivo o que no dicta la materia antes de persistir", async () => {
    opcion.mockResolvedValueOnce(null);
    await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    dicta.mockResolvedValueOnce(false);
    await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_NO_DICTA_MATERIA" });
    expect(turno.create).not.toHaveBeenCalled();
  });
  it("rechaza horario fuera de atención y conflictos DISPONIBLE/COMPLETO", async () => {
    horario.mockResolvedValueOnce(false);
    await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_FUERA_DE_HORARIO" });
    expect(horario).toHaveBeenCalledWith(PROFESOR, input.fecha, "10:00", "11:00", expect.anything());
    for (const estadoTurno of ["DISPONIBLE", "COMPLETO"]) {
      turno.findMany.mockResolvedValueOnce([{ profesorId: PROFESOR, estadoTurno, horaInicioTurno: new Date("1970-01-01T10:30:00.000Z"), duracionMinutosTurno: 60 }]);
      await expect(configurarTurno(input, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_NO_DISPONIBLE" });
    }
    expect(turno.create).not.toHaveBeenCalled();
    expect(turno.findMany.mock.calls.at(-1)![0].where).toMatchObject({ estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, profesorId: { in: [PROFESOR] } });
  });
  it("no bloquean PENDIENTE, CANCELADO ni un confirmado adyacente", async () => {
    turno.findMany.mockResolvedValueOnce([{ profesorId: PROFESOR, horaInicioTurno: new Date("1970-01-01T11:00:00.000Z"), duracionMinutosTurno: 60 }]);
    await expect(configurarTurno(input, USUARIO)).resolves.toMatchObject({ estado: "PENDIENTE" });
    expect(turno.findMany.mock.calls[0]![0].where).toMatchObject({ estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } });
    expect(turno.findMany.mock.calls[0]![0].where).not.toHaveProperty("idTurno");
  });
});

describe("HU-C-03 modificarConfiguracionTurno", () => {
  const conAula = { ...actual, aulaId: AULA, cupoMaximoTurno: 20 };
  const nuevaFecha = new Date("2026-10-02T00:00:00.000Z");
  const otroTurno = (estadoTurno: string, hora = "10:30") => ({
    estadoTurno, horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`), duracionMinutosTurno: 60,
  });

  it("conserva el aula y cupo si el nuevo intervalo sigue libre, usando el mismo tx", async () => {
    const txTurno = { findUnique: vi.fn().mockResolvedValue(conAula), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const tx = { turno: txTurno };
    transaccion.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(modificarConfiguracionTurno(TURNO, { ...input, fecha: nuevaFecha }, USUARIO)).resolves.toMatchObject({ cupo_maximo: 20, aula_desasignada: false });
    expect(opcion).toHaveBeenCalledWith(PROFESOR, tx);
    expect(dicta).toHaveBeenCalledWith(PROFESOR, MATERIA, tx);
    expect(horario).toHaveBeenCalledWith(PROFESOR, nuevaFecha, "10:00", "11:00", tx);
    expect(txTurno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ aulaId: AULA, fechaTurno: nuevaFecha, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, idTurno: { not: TURNO } }) }));
    expect(txTurno.updateMany).toHaveBeenCalledOnce();
    expect(turno.findMany).not.toHaveBeenCalled();
    expect(payload("turno:configuracion_modificada")).toMatchObject({ aula_desasignada: false });
  });

  it.each(["DISPONIBLE", "COMPLETO"])("desasigna aula superpuesta con %s dentro de la transacción", async (estado) => {
    turno.findUnique.mockResolvedValueOnce(conAula);
    turno.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([otroTurno(estado)]);
    const resultado = await modificarConfiguracionTurno(TURNO, { ...input, hora_inicio: "10:30" }, USUARIO);
    expect(resultado).toMatchObject({ hora_inicio: "10:30", cupo_maximo: null, aula_desasignada: true });
    expect(turno.updateMany).toHaveBeenCalledTimes(2);
    expect(turno.updateMany.mock.calls[0]![0].data).toMatchObject({ horaInicioTurno: new Date("1970-01-01T10:30:00.000Z") });
    expect(turno.updateMany.mock.calls[1]![0]).toMatchObject({ where: { idTurno: TURNO, aulaId: AULA }, data: { aulaId: null, cupoMaximoTurno: null } });
    expect(turno.findMany.mock.calls[1]![0].where).toMatchObject({ aulaId: AULA, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, idTurno: { not: TURNO } });
    expect(turno.updateMany.mock.invocationCallOrder[0]).toBeLessThan(turno.findMany.mock.invocationCallOrder[1]);
    expect(turno.findMany.mock.invocationCallOrder[1]).toBeLessThan(turno.updateMany.mock.invocationCallOrder[1]);
    expect(payload("turno:configuracion_modificada")).toMatchObject({ aula_desasignada: true });
  });

  it.each(["PENDIENTE", "CANCELADO"])("%s ajeno no bloquea el aula", async (estado) => {
    turno.findUnique.mockResolvedValueOnce(conAula);
    turno.findMany.mockImplementation(({ where }) => Promise.resolve(where.aulaId && where.estadoTurno.in.includes(estado) ? [otroTurno(estado)] : []));
    await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).resolves.toMatchObject({ aula_desasignada: false, cupo_maximo: 20 });
    expect(turno.findMany.mock.calls[1]![0].where.estadoTurno.in).toEqual(["DISPONIBLE", "COMPLETO"]);
    expect(turno.updateMany).toHaveBeenCalledOnce();
  });

  it("excluye al turno propio y admite un intervalo contiguo", async () => {
    turno.findUnique.mockResolvedValueOnce(conAula);
    turno.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([otroTurno("DISPONIBLE", "11:00")]);
    await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).resolves.toMatchObject({ aula_desasignada: false });
    expect(turno.findMany.mock.calls[1]![0].where.idTurno).toEqual({ not: TURNO });
    expect(turno.updateMany).toHaveBeenCalledOnce();
  });

  it("una validación previa fallida no modifica configuración ni aula", async () => {
    turno.findUnique.mockResolvedValueOnce(conAula);
    horario.mockResolvedValueOnce(false);
    await expect(modificarConfiguracionTurno(TURNO, input, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_FUERA_DE_HORARIO" });
    expect(turno.updateMany).not.toHaveBeenCalled();
    expect(turno.findMany).not.toHaveBeenCalled();
  });

  it("lee, revalida y actualiza con el mismo TransactionClient", async () => {
    const txTurno = { findUnique: vi.fn().mockResolvedValue(actual), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const tx = { turno: txTurno };
    transaccion.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));
    await modificarConfiguracionTurno(TURNO, input, USUARIO);
    expect(transaccion).toHaveBeenCalledOnce();
    expect(txTurno.findUnique).toHaveBeenCalledOnce();
    expect(opcion).toHaveBeenCalledWith(PROFESOR, tx);
    expect(dicta).toHaveBeenCalledWith(PROFESOR, MATERIA, tx);
    expect(horario).toHaveBeenCalledWith(PROFESOR, input.fecha, "10:00", "11:00", tx);
    expect(txTurno.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ idTurno: { not: TURNO }, profesorId: { in: [PROFESOR] } }) }));
    expect(txTurno.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ updatedAtTurno: actual.updatedAtTurno }) }));
    expect(txTurno.findMany.mock.invocationCallOrder[0]).toBeLessThan(txTurno.updateMany.mock.invocationCallOrder[0]);
    expect(turno.findUnique).not.toHaveBeenCalled();
    expect(turno.findMany).not.toHaveBeenCalled();
    expect(turno.updateMany).not.toHaveBeenCalled();
  });
  it("actualiza con la condición de estado y versión en la misma sentencia, sin aula previa", async () => {
    const nueva = new Date("2026-10-02T00:00:00.000Z");
    await expect(modificarConfiguracionTurno(TURNO, { ...input, fecha: nueva }, USUARIO)).resolves.toMatchObject({ cupo_maximo: null, estado: "PENDIENTE", aula_desasignada: false });
    const [{ where, data }] = turno.updateMany.mock.calls[0]!;
    expect(where).toMatchObject({ idTurno: TURNO, estadoTurno: "PENDIENTE", updatedAtTurno: actual.updatedAtTurno });
    expect(data).toMatchObject({ fechaTurno: nueva });
    expect(data).not.toHaveProperty("cupoMaximoTurno");
    expect(turno.updateMany).toHaveBeenCalledOnce();
    expect(turno.findMany).toHaveBeenCalledOnce(); // Solo consulta conflicto de Profesor.
    expect(turnoAlumno.count).not.toHaveBeenCalled();
    expect(payload("turno:configuracion_modificada")).toMatchObject({ campos_modificados: ["fecha"], aula_desasignada: false });
  });
  it("PATCH usa el profesor_id obligatorio del schema compartido y lo persiste", async () => {
    const otroProfesor = "ckprofesor000000000000002";
    await expect(modificarConfiguracionTurno(TURNO, { ...input, profesor_id: otroProfesor }, USUARIO)).resolves.toMatchObject({ profesor_id: otroProfesor });
    expect(turno.updateMany.mock.calls[0]![0].data).toMatchObject({ profesorId: otroProfesor });
    expect(payload("turno:configuracion_modificada")).toMatchObject({ campos_modificados: ["profesor_id"] });
  });
  it("conserva la duración de un turno de 2h al editar otro campo (antes se reseteaba al parámetro fijo de 60)", async () => {
    turno.findUnique.mockResolvedValueOnce({ ...actual, duracionMinutosTurno: 120 });
    validar.mockResolvedValueOnce({ fecha: "2026-10-02", hora_fin: "12:00", duracion_min: 120 });
    const nueva = new Date("2026-10-02T00:00:00.000Z");
    await expect(modificarConfiguracionTurno(TURNO, { ...input, fecha: nueva, duracion_min: 120 }, USUARIO)).resolves.toMatchObject({ hora_fin: "12:00", duracion_min: 120 });
    expect(turno.updateMany.mock.calls[0]![0].data).toMatchObject({ duracionMinutosTurno: 120 });
    expect(payload("turno:configuracion_modificada")).toMatchObject({ campos_modificados: ["fecha"] });
  });
  it("cambiar solo la duración la persiste e informa duracion_min como campo modificado", async () => {
    validar.mockResolvedValueOnce({ fecha: "2026-10-01", hora_fin: "13:00", duracion_min: 180 });
    await expect(modificarConfiguracionTurno(TURNO, { ...input, duracion_min: 180 }, USUARIO)).resolves.toMatchObject({ hora_fin: "13:00", duracion_min: 180 });
    expect(turno.updateMany.mock.calls[0]![0].data).toMatchObject({ duracionMinutosTurno: 180 });
    expect(payload("turno:configuracion_modificada")).toMatchObject({ campos_modificados: ["duracion_min"] });
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
