import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, evento, vigente, activo, inscripcion } = vi.hoisted(() => ({
  tx: {
    // transaccion() y bloquear() (PR-0.md §2.16) usan las dos primeras.
    $executeRawUnsafe: vi.fn(), $queryRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
    turno: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
  evento: vi.fn(), vigente: vi.fn(), activo: vi.fn(),
  // Persistencia de la inscripción (PR-0.md §2.0): el servicio de C reemplaza a
  // findUnique/count/create/deleteMany de turnoAlumno. Las reglas que decide
  // (cupo, estado, alumno, repetido, superposición) se prueban además contra
  // PostgreSQL real en turno.inscripciones.pg.test.ts.
  inscripcion: { crear: vi.fn(), finalizar: vi.fn(), delPar: vi.fn(), marcar: vi.fn(), vigentes: vi.fn() },
}));
// Cada transacción recibe su propio tx (copia con los mismos mocks): bloquear() guarda su estado por transacción.
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((callback) => callback({ ...tx })), eventoTurno: { create: evento } } }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  profesorActivoDictaMateria: vi.fn(), listarProfesoresActivosPorMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(),
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));
vi.mock("./inscripcion.service", () => ({
  crearInscripcion: inscripcion.crear, finalizarInscripcion: inscripcion.finalizar, inscripcionVigenteDelPar: inscripcion.delPar,
  marcarVencidas: inscripcion.marcar, clasesConReservasVencidasDelAlumno: vi.fn(async () => []),
}));
vi.mock("./inscripcion.vigencia", async (original) => ({ ...(await original<typeof import("./inscripcion.vigencia")>()), inscripcionesVigentes: inscripcion.vigentes }));

const { agregarAlumnoTurno, quitarAlumnoTurno } = await import("./turno.service");
const { AgregarAlumnoTurnoSchema } = await import("./turno.schema");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const A = "ckalumno00000000000000001";
const TURNO = "ckturno00000000000000001";
const USUARIO = "ckusuario0000000000000001";
const horario = { fechaTurno: new Date("2026-10-01T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60 };
const bloqueado = (estadoTurno: string, cupoMaximoTurno = 3) => tx.$queryRaw.mockResolvedValueOnce([{ idTurno: TURNO, cupoMaximoTurno, estadoTurno }]);
/** Lo que devuelve crearInscripcion (PR-0.md §2.13) con `inscriptos` vigentes después del alta. */
const RESERVA = { id: "reserva-1", estadoPago: "RESERVADA", venceEl: new Date("2026-10-01T12:00:00.000Z"), precio: 12000 };
const creada = (inscriptos: number, completado = false, alumnoIds: string[] = []) => ({ completado, inscriptos, cupo: 3, alumnoIds, estadoTurno: completado ? "COMPLETO" : "DISPONIBLE", inscripcion: RESERVA });
const rechaza = (codigo: ConstructorParameters<typeof ErrorDeDominio>[0], datos?: Record<string, unknown>) => inscripcion.crear.mockRejectedValueOnce(new ErrorDeDominio(codigo, datos));
const tipos = () => evento.mock.calls.map(([{ data }]) => data.tipoEvento);
const agregar = () => agregarAlumnoTurno(TURNO, { alumno_id: A }, USUARIO);
const quitar = () => quitarAlumnoTurno(TURNO, A, USUARIO);
const finalizada = (anterior: string, nuevo: string) => ({ estadoTurno: { anterior, nuevo, cambio: anterior !== nuevo } });

beforeEach(() => {
  vi.clearAllMocks();
  tx.$executeRawUnsafe.mockResolvedValue(0); tx.$queryRawUnsafe.mockResolvedValue([]);
  tx.$queryRaw.mockResolvedValue([{ idTurno: TURNO, cupoMaximoTurno: 3, estadoTurno: "DISPONIBLE" }]);
  tx.turno.findUniqueOrThrow.mockResolvedValue(horario);
  tx.turno.findMany.mockResolvedValue([]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
  inscripcion.crear.mockResolvedValue(creada(2));
  inscripcion.delPar.mockResolvedValue({ id: "insc-a" });
  inscripcion.marcar.mockResolvedValue(0);
  inscripcion.finalizar.mockResolvedValue(finalizada("DISPONIBLE", "DISPONIBLE"));
  inscripcion.vigentes.mockResolvedValue([{ id: "insc-b", alumnoId: "b" }]);
  evento.mockResolvedValue({}); vigente.mockReturnValue(true); activo.mockResolvedValue(true);
});

describe("HU-C-04 §2.5 agregar alumno", () => {
  it("valida alumno_id como CUID", () => {
    expect(AgregarAlumnoTurnoSchema.safeParse({ alumno_id: A }).success).toBe(true);
    expect(AgregarAlumnoTurnoSchema.safeParse({ alumno_id: "1" }).success).toBe(false);
  });
  it("inscribe con crearInscripcion (centro, como reserva con plazo) dentro de la transacción, ofrece el pago y emite el evento después", async () => {
    await expect(agregar()).resolves.toEqual({
      id: TURNO, alumno_id: A, alumnos_inscriptos: "2/3", estado: "DISPONIBLE",
      inscripcion: { id: "reserva-1", estado_pago: "RESERVADA", vence_el: "2026-10-01T09:00:00-03:00", precio: 12000 }, ofrecer_pago: true,
    });
    expect(inscripcion.crear).toHaveBeenCalledWith(expect.objectContaining({ $queryRaw: tx.$queryRaw }), {
      turnoId: TURNO, alumnoId: A, origen: "CENTRO", conReserva: true, actor: { tipo: "USUARIO", usuarioId: USUARIO }, alumnoActivo: undefined,
    });
    // La transacción abre con los tiempos de PR-0.md §2.10 antes de inscribir.
    expect(tx.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(inscripcion.crear.mock.invocationCallOrder[0]);
    expect(inscripcion.crear.mock.invocationCallOrder[0]).toBeLessThan(evento.mock.invocationCallOrder[0]);
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(tipos()).toEqual(["turno:alumno_agregado"]);
    expect(evento.mock.calls[0]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_id: A, usuario_id: USUARIO, origen: "MESA_ENTRADA" });
  });
  it("al alcanzar el cupo transiciona a COMPLETO y emite turno:completado", async () => {
    inscripcion.crear.mockResolvedValueOnce(creada(3, true, ["b", "c", A]));
    await expect(agregar()).resolves.toMatchObject({ alumnos_inscriptos: "3/3", estado: "COMPLETO" });
    expect(tipos()).toEqual(["turno:alumno_agregado", "turno:completado"]);
    expect(evento.mock.calls[1]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_ids: ["b", "c", A], cupo_maximo: 3, usuario_id: USUARIO });
  });
  it("rechaza un turno COMPLETO sin insertar", async () => {
    rechaza("errores.turno.cupoInsuficiente");
    await expect(agregar()).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE", message: "El turno alcanzó su cupo máximo" });
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza si el conteo con la fila bloqueada ya alcanzó el cupo", async () => {
    rechaza("errores.turno.cupoInsuficiente");
    await expect(agregar()).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza turno PENDIENTE, inexistente y vencido", async () => {
    rechaza("errores.turno.pendiente");
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
    rechaza("errores.turno.noEncontrado");
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
    rechaza("errores.turno.vencido");
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza un turno CANCELADO con el código de la revisión 5", async () => {
    rechaza("errores.turno.cancelado");
    await expect(agregar()).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza alumno inactivo, repetido o con turno superpuesto, identificándolo", async () => {
    rechaza("errores.inscripcion.alumnoNoDisponibleOInactivo", { alumno_id: A });
    await expect(agregar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", detalles: { alumno_id: A } });
    rechaza("errores.inscripcion.alumnoYaAsignado", { alumno_id: A });
    await expect(agregar()).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO", message: "El mismo alumno no puede agregarse dos veces al mismo turno", detalles: { alumno_id: A } });
    rechaza("errores.inscripcion.alumnoNoDisponible", { alumno_id: A });
    await expect(agregar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: A } });
    expect(evento).not.toHaveBeenCalled();
  });
  it("un turno contiguo del alumno no es conflicto", async () => {
    await expect(agregar()).resolves.toMatchObject({ estado: "DISPONIBLE" });
  });
});

describe("HU-C-04 §2.5 quitar alumno", () => {
  it("en un turno COMPLETO vuelve a DISPONIBLE y emite turno:disponible_nuevamente", async () => {
    bloqueado("COMPLETO");
    inscripcion.finalizar.mockResolvedValueOnce(finalizada("COMPLETO", "DISPONIBLE"));
    inscripcion.vigentes.mockResolvedValueOnce([{ id: "insc-b", alumnoId: "b" }, { id: "insc-c", alumnoId: "c" }]);
    await expect(quitar()).resolves.toEqual({ id: TURNO, alumno_id: A, alumnos_inscriptos: "2/3", estado: "DISPONIBLE" });
    // La inscripción no se borra: pasa a QUITADA_CENTRO con fecha y usuario (PR-0.md §2.0).
    expect(inscripcion.delPar).toHaveBeenCalledWith(A, TURNO, expect.anything());
    expect(inscripcion.finalizar).toHaveBeenCalledWith(expect.anything(), { inscripcionId: "insc-a", vigencia: "QUITADA_CENTRO", actor: { tipo: "USUARIO", usuarioId: USUARIO }, fecha: expect.any(Date) });
    expect(tipos()).toEqual(["turno:alumno_quitado", "turno:disponible_nuevamente"]);
    expect(evento.mock.calls[1]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_id_liberado: A, usuario_id: USUARIO });
  });
  it("en un turno DISPONIBLE no transiciona ni emite turno:disponible_nuevamente, aunque quede en 0", async () => {
    inscripcion.vigentes.mockResolvedValueOnce([]);
    await expect(quitar()).resolves.toMatchObject({ alumnos_inscriptos: "0/3", estado: "DISPONIBLE" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(tipos()).toEqual(["turno:alumno_quitado"]);
  });
  it("rechaza alumno no inscripto, turno PENDIENTE y vencido", async () => {
    inscripcion.delPar.mockResolvedValueOnce(null);
    await expect(quitar()).rejects.toMatchObject({ code: "ALUMNO_NO_ASIGNADO", detalles: { alumno_id: A } });
    bloqueado("PENDIENTE");
    await expect(quitar()).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
    vigente.mockReturnValueOnce(false);
    await expect(quitar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    expect(inscripcion.finalizar).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });
  it("no quita inscripciones de un turno CANCELADO", async () => {
    bloqueado("CANCELADO");
    await expect(quitar()).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
    expect(inscripcion.finalizar).not.toHaveBeenCalled();
  });
});
