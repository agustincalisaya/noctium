import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaTurno, evento, alumno, activo, vigente, materias, profesores, crear } = vi.hoisted(() => ({
  tx: {
    // transaccion() (PR-0.md §2.16) fija los tiempos de la transacción al empezar.
    $executeRawUnsafe: vi.fn(),
  },
  prismaTurno: { findMany: vi.fn() },
  evento: vi.fn(), alumno: vi.fn(), activo: vi.fn(), vigente: vi.fn(), materias: vi.fn(), profesores: vi.fn(),
  // Persistencia de la inscripción (PR-0.md §2.0): crearInscripcion reemplaza a
  // findUnique/count/create de turnoAlumno. Sus reglas se prueban además contra
  // PostgreSQL real en turno.inscripciones.pg.test.ts.
  crear: vi.fn(),
}));

// Cada transacción recibe su propio tx (copia con los mismos mocks).
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn((callback) => callback({ ...tx })), turno: prismaTurno, eventoTurno: { create: evento },
} }));
vi.mock("./inscripcion.service", () => ({
  crearInscripcion: crear, finalizarInscripcion: vi.fn(), inscripcionVigenteDelPar: vi.fn(), marcarVencidas: vi.fn(), clasesConReservasVencidasDelAlumno: vi.fn(),
}));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: alumno }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/materias/materia.service", () => ({ listarMateriasActivas: materias, verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  listarProfesoresActivosPorMateria: profesores,
  profesorActivoDictaMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(),
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));

const { listarOpcionesInscripcion, solicitarTurnoPropio } = await import("./turno.service");
const { OpcionesInscripcionQuerySchema } = await import("./turno.schema");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const USUARIO = "usuario-alumno";
const ALUMNO = "alumno-de-sesion";
const TURNO = "turno-disponible";
const MATERIA = "materia-matematica";
const PROFESOR = "profesor-gomez";
const horario = { fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60 };
const disponible = { idTurno: TURNO, ...horario, materiaId: MATERIA, profesorId: PROFESOR, aula: { nombreAula: "Aula 4" }, cupoMaximoTurno: 3, _count: { alumnos: 1 } };

beforeEach(() => {
  vi.clearAllMocks();
  alumno.mockResolvedValue({ id: ALUMNO, activo: true });
  activo.mockResolvedValue(true);
  vigente.mockReturnValue(true);
  prismaTurno.findMany.mockResolvedValue([disponible]);
  materias.mockResolvedValue([{ idMateria: MATERIA, nombreMateria: "Matemática" }]);
  profesores.mockResolvedValue([{ id: PROFESOR, nombre: "Ana", apellido: "Gómez" }]);
  tx.$executeRawUnsafe.mockResolvedValue(0);
  crear.mockResolvedValue({ completado: false, inscriptos: 2, cupo: 3, alumnoIds: ["otro", ALUMNO], estadoTurno: "DISPONIBLE" });
  evento.mockResolvedValue({});
});

describe("HU-C-12 §2.14.2 opciones", () => {
  it("exige materia antes de profesor", () => {
    expect(OpcionesInscripcionQuerySchema.safeParse({ profesor_id: PROFESOR }).success).toBe(false);
    expect(OpcionesInscripcionQuerySchema.safeParse({ materia_id: MATERIA, profesor_id: PROFESOR }).success).toBe(true);
  });

  it("filtra materias y profesores por turnos inscribibles del alumno autenticado", async () => {
    expect(await listarOpcionesInscripcion({}, USUARIO)).toEqual({ items: [{ id: MATERIA, nombre: "Matemática", turnos_con_lugar: 1 }] });
    expect(await listarOpcionesInscripcion({ materia_id: MATERIA }, USUARIO)).toEqual({ items: [{ id: PROFESOR, nombre: "Gómez, Ana", turnos_con_lugar: 1 }] });
    // Decide la ocupación vigente, no el estado guardado (PR-0.md §2.2): se consultan las clases confirmadas
    // y se descartan las del alumno con una inscripción vigente.
    expect(prismaTurno.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, alumnos: { none: expect.objectContaining({ alumnoId: ALUMNO, vigencia: "VIGENTE" }) } }),
    }));
  });

  it("devuelve horario, aula informativa y cupo sin datos de otros alumnos", async () => {
    const respuesta = await listarOpcionesInscripcion({ materia_id: MATERIA, profesor_id: PROFESOR }, USUARIO);
    expect(respuesta).toEqual({ items: [{ turno_id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", aula: "Aula 4", cupos_libres: 2 }] });
    expect(JSON.stringify(respuesta)).not.toMatch(/alumno/);
  });

  it("descarta turnos vencidos y sin cupo y devuelve lista vacía para la combinación", async () => {
    vigente.mockReturnValueOnce(false).mockReturnValue(true);
    prismaTurno.findMany.mockResolvedValueOnce([disponible, { ...disponible, idTurno: "turno-lleno", _count: { alumnos: 3 } }]);
    expect(await listarOpcionesInscripcion({ materia_id: MATERIA, profesor_id: PROFESOR }, USUARIO)).toEqual({ items: [] });
  });

  it("rechaza cuentas sin ficha o con ficha inactiva", async () => {
    alumno.mockResolvedValueOnce(null);
    await expect(listarOpcionesInscripcion({}, USUARIO)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    alumno.mockResolvedValueOnce({ id: ALUMNO, activo: false });
    await expect(listarOpcionesInscripcion({}, USUARIO)).rejects.toMatchObject({ code: "ALUMNO_INACTIVO" });
    expect(prismaTurno.findMany).not.toHaveBeenCalled();
  });
});

describe("HU-C-12 §2.14.2 inscripción", () => {
  const rechaza = (codigo: ConstructorParameters<typeof ErrorDeDominio>[0]) => crear.mockRejectedValueOnce(new ErrorDeDominio(codigo));

  it("inscribe a la ficha de la sesión, bloquea turno y emite el origen después de insertar", async () => {
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).resolves.toEqual({ id: TURNO, alumnos_inscriptos: "2/3", estado: "DISPONIBLE" });
    expect(alumno).toHaveBeenCalledWith(USUARIO);
    // crearInscripcion bloquea al alumno y la clase en orden canónico (PR-0.md §2.16) y deja PAGO_SIN_REGISTRAR (2.15).
    expect(crear).toHaveBeenCalledWith(expect.anything(), {
      turnoId: TURNO, alumnoId: ALUMNO, origen: "ALUMNO", conReserva: false, actor: { tipo: "USUARIO", usuarioId: USUARIO }, alumnoActivo: true,
    });
    expect(crear.mock.invocationCallOrder[0]).toBeLessThan(evento.mock.invocationCallOrder[0]);
    expect(evento.mock.calls[0]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_id: ALUMNO, usuario_id: USUARIO, origen: "AUTOSERVICIO" });
  });

  it("pasa a COMPLETO cuando toma el último lugar", async () => {
    crear.mockResolvedValueOnce({ completado: true, inscriptos: 3, cupo: 3, alumnoIds: ["a", "b", ALUMNO], estadoTurno: "COMPLETO" });
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).resolves.toMatchObject({ alumnos_inscriptos: "3/3", estado: "COMPLETO" });
    expect(evento.mock.calls.map(([{ data }]) => data.tipoEvento)).toEqual(["turno:alumno_agregado", "turno:completado"]);
  });

  it.each([["PENDIENTE", "errores.turno.pendiente"], ["CANCELADO", "errores.turno.cancelado"]] as const)("rechaza turno %s", async (_estado, codigo) => {
    rechaza(codigo);
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "TURNO_NO_DISPONIBLE", message: "El turno ya no está disponible" });
    expect(evento).not.toHaveBeenCalled();
  });

  it("rechaza turno completo, vencido, inscripción repetida y cupo ocupado al confirmar", async () => {
    rechaza("errores.turno.cupoInsuficiente");
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    rechaza("errores.turno.vencido");
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    rechaza("errores.inscripcion.alumnoYaAsignadoPropio");
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO", message: "Ya estás inscripto en este turno" });
    rechaza("errores.turno.cupoInsuficiente");
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    expect(evento).not.toHaveBeenCalled();
  });

  it("rechaza superposición al confirmar con el mensaje del alumno", async () => {
    rechaza("errores.inscripcion.alumnoNoDisponiblePropio");
    await expect(solicitarTurnoPropio(TURNO, USUARIO)).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "Ya tenés otro turno en ese horario" });
    expect(evento).not.toHaveBeenCalled();
  });
});
