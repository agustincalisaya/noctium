import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/shared/service-error";

const { tx, evento, vigente, activo, profesores, opcion, dicta, horario, aulaActiva, materiaActiva, inscripcion } = vi.hoisted(() => ({
  tx: {
    // transaccion() y bloquear() (PR-0.md §2.16) usan las dos primeras.
    $executeRawUnsafe: vi.fn(), $queryRawUnsafe: vi.fn(),
    turno: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
  evento: vi.fn(), vigente: vi.fn(), activo: vi.fn(), profesores: vi.fn(), opcion: vi.fn(), dicta: vi.fn(), horario: vi.fn(), aulaActiva: vi.fn(), materiaActiva: vi.fn(),
  // Persistencia de la inscripción (PR-0.md §2.0): el servicio de C reemplaza al deleteMany/createMany.
  inscripcion: { crear: vi.fn(), finalizar: vi.fn(), vigentes: vi.fn(), vencidasDelAlumno: vi.fn() },
}));
// Cada transacción recibe su propio tx (copia con los mismos mocks): bloquear() guarda su estado por transacción.
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((callback) => callback({ ...tx })), eventoTurno: { create: evento } } }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ verificarAlumnoActivo: activo }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorActivo: opcion, profesorActivoDictaMateria: dicta, listarProfesoresActivosPorMateria: profesores, estaDentroDeHorarioAtencion: horario }));
vi.mock("@/server/turnos/turno.validaciones", () => ({ turnoSigueVigente: vigente }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/aulas/aula.publico", () => ({ verificarAulaActiva: aulaActiva }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));
vi.mock("./inscripcion.service", () => ({
  crearInscripcion: inscripcion.crear, finalizarInscripcion: inscripcion.finalizar,
  clasesConReservasVencidasDelAlumno: inscripcion.vencidasDelAlumno, inscripcionVigenteDelPar: vi.fn(), marcarVencidas: vi.fn(),
}));
vi.mock("./inscripcion.vigencia", async (original) => ({ ...(await original<typeof import("./inscripcion.vigencia")>()), inscripcionesVigentes: inscripcion.vigentes }));

const { asignarParticipantesTurno } = await import("./turno.service");
const { AsignarParticipantesTurnoSchema } = await import("./turno.schema");
const { Prisma } = await import("@prisma/client");
const A = "ckalumno00000000000000001";
const B = "ckalumno00000000000000002";
const C = "ckalumno00000000000000003";
const P = "ckprofesor000000000000001";
const TURNO = "ckturno00000000000000001";
const USUARIO = "ckusuario0000000000000001";
const AULA = "ckaula0000000000000000001";
const turno = {
  idTurno: TURNO, estadoTurno: "PENDIENTE", fechaTurno: new Date("2026-10-01T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60, cupoMaximoTurno: 3,
  materiaId: "ckmateria0000000000000001", aulaId: AULA, updatedAtTurno: new Date("2026-09-23T00:00:00.000Z"),
};
const otroTurno = (inicio: string, duracionMinutosTurno: number, alumnos: string[] = []) => ({
  profesorId: P, horaInicioTurno: new Date(`1970-01-01T${inicio}:00.000Z`), duracionMinutosTurno, alumnos: alumnos.map((alumnoId) => ({ alumnoId })),
});
const ejecutar = (alumno_ids = [A, B, C], profesor_id = P) => asignarParticipantesTurno(TURNO, { alumno_ids, profesor_id }, USUARIO);
/** Primera consulta: turnos del profesor; segunda: de los alumnos; tercera: del aula. */
const conflictos = (delProfesor: ReturnType<typeof otroTurno>[], deAlumnos: ReturnType<typeof otroTurno>[] = []) =>
  tx.turno.findMany.mockResolvedValueOnce(delProfesor).mockResolvedValueOnce(deAlumnos);

beforeEach(() => {
  vi.clearAllMocks();
  tx.turno.findUnique.mockResolvedValue(turno);
  // mockReset: un test que falla en la primera consulta deja sin consumir la
  // segunda respuesta de `conflictos()`, y clearAllMocks no la descarta.
  tx.turno.findMany.mockReset().mockResolvedValue([]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
  tx.$executeRawUnsafe.mockResolvedValue(0); tx.$queryRawUnsafe.mockResolvedValue([]);
  inscripcion.crear.mockImplementation(async (_tx, datos) => ({
    inscripcion: { id: `reserva-${datos.alumnoId}`, estadoPago: "RESERVADA", venceEl: new Date("2026-10-01T12:00:00.000Z"), precio: 12000 },
  }));
  inscripcion.finalizar.mockResolvedValue({});
  inscripcion.vigentes.mockResolvedValue([]); inscripcion.vencidasDelAlumno.mockResolvedValue([]);
  evento.mockResolvedValue({}); vigente.mockReturnValue(true); activo.mockResolvedValue(true);
  profesores.mockResolvedValue([{ id: P, nombre: "Ana", apellido: "Pérez" }]); opcion.mockResolvedValue({ id: P }); dicta.mockResolvedValue(true); horario.mockResolvedValue(true);
  aulaActiva.mockResolvedValue({ idAula: AULA, capacidadAula: 3 }); materiaActiva.mockResolvedValue({ idMateria: turno.materiaId });
});
const tipos = () => evento.mock.calls.map(([{ data }]) => data.tipoEvento);

describe("HU-C-04 §2.2 schema", () => {
  it("exige al menos un alumno, sin repetidos, con claves snake_case", () => {
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_ids: [A, B] }).success).toBe(true);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_ids: [A, B], profesor_id: P }).success).toBe(true);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_ids: [], profesor_id: P }).error?.flatten().fieldErrors.alumno_ids).toEqual(["Agregá al menos un alumno"]);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_ids: [A, A], profesor_id: P }).error?.flatten().fieldErrors.alumno_ids).toEqual(["El mismo alumno no puede agregarse dos veces"]);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_ids: ["1"], profesor_id: P }).success).toBe(false);
    expect(AsignarParticipantesTurnoSchema.safeParse({ alumno_id: A, profesor_id: P }).success).toBe(false);
  });
});

describe("HU-C-04 §2.2 asignar participantes", () => {
  it("usa y revalida el profesor persistido cuando el payload lo omite", async () => {
    tx.turno.findUnique.mockResolvedValueOnce({ ...turno, profesorId: P });
    await expect(asignarParticipantesTurno(TURNO, { alumno_ids: [A] }, USUARIO)).resolves.toMatchObject({ profesor_id: P, estado: "DISPONIBLE" });
    expect(profesores).not.toHaveBeenCalled();
    expect(opcion).toHaveBeenCalledWith(P, tx);
    expect(dicta).toHaveBeenCalledWith(P, turno.materiaId, tx);
    expect(horario).toHaveBeenCalledWith(P, turno.fechaTurno, "10:00", "11:00", tx);
    expect(activo).toHaveBeenCalledWith(A, tx);
    expect(aulaActiva).toHaveBeenCalledWith(AULA, tx);
    expect(tx.turno.updateMany.mock.calls[0]![0].data).not.toHaveProperty("profesorId");
  });
  it("sin profesor persistido ni enviado responde TURNO_SIN_PROFESOR", async () => {
    await expect(asignarParticipantesTurno(TURNO, { alumno_ids: [A] }, USUARIO)).rejects.toMatchObject({ code: "TURNO_SIN_PROFESOR", message: "Elegí un profesor antes de confirmar el turno" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(inscripcion.crear).not.toHaveBeenCalled();
  });
  it("el profesor persistido inactivo o desvinculado de la materia impide confirmar", async () => {
    tx.turno.findUnique.mockResolvedValue({ ...turno, profesorId: P });
    opcion.mockResolvedValueOnce(null);
    await expect(asignarParticipantesTurno(TURNO, { alumno_ids: [A] }, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    dicta.mockResolvedValueOnce(false);
    await expect(asignarParticipantesTurno(TURNO, { alumno_ids: [A] }, USUARIO)).rejects.toMatchObject({ code: "PROFESOR_NO_DICTA_MATERIA" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(inscripcion.crear).not.toHaveBeenCalled();
  });
  it("profesor_id explícito conserva la compatibilidad legacy", async () => {
    await expect(ejecutar([A])).resolves.toMatchObject({ profesor_id: P, estado: "DISPONIBLE" });
    expect(profesores).toHaveBeenCalledWith(turno.materiaId, tx);
    expect(tx.turno.updateMany.mock.calls[0]![0].data).toMatchObject({ profesorId: P });
  });
  it("un profesor_id explícito distinto reemplaza al persistido tras revalidarse", async () => {
    const nuevo = "ckprofesor000000000000002";
    tx.turno.findUnique.mockResolvedValueOnce({ ...turno, profesorId: P });
    opcion.mockResolvedValueOnce({ id: nuevo });
    await expect(asignarParticipantesTurno(TURNO, { alumno_ids: [A], profesor_id: nuevo }, USUARIO)).resolves.toMatchObject({ profesor_id: nuevo });
    expect(profesores).toHaveBeenCalledWith(turno.materiaId, tx);
    expect(dicta).toHaveBeenCalledWith(nuevo, turno.materiaId, tx);
    expect(tx.turno.updateMany.mock.calls[0]![0].data).toMatchObject({ profesorId: nuevo });
  });
  it("identifica al alumno inexistente sin mutar el turno", async () => {
    activo.mockRejectedValueOnce(new ServiceError("ALUMNO_NO_ENCONTRADO", "El alumno ya no existe"));
    await expect(ejecutar([A])).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO", detalles: { alumno_id: A } });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(inscripcion.crear).not.toHaveBeenCalled();
  });
  it("asigna profesor y alumnos hasta el cupo, reemplaza vínculos y confirma COMPLETO", async () => {
    await expect(ejecutar()).resolves.toEqual({
      id: TURNO, alumno_ids: [A, B, C], profesor_id: P, cupo_maximo: 3, estado: "COMPLETO",
      // Cada alumno queda como reserva con plazo (HU-C-24, C §2.18.3) y la interfaz ofrece «Registrar pago» junto a cada uno.
      inscripciones: [A, B, C].map((alumno_id) => ({
        alumno_id, inscripcion_id: `reserva-${alumno_id}`, estado_pago: "RESERVADA", vence_el: "2026-10-01T09:00:00-03:00", precio: 12000,
      })),
    });
    expect(tx.turno.updateMany).toHaveBeenNthCalledWith(1, { where: { idTurno: TURNO, estadoTurno: "PENDIENTE", updatedAtTurno: turno.updatedAtTurno }, data: { profesorId: P, modificadoPorUsuarioId: USUARIO } });
    // La clase se confirma y las inscripciones la pasan a COMPLETO al llenar el cupo (crearInscripcion recalcula el estado, PR-0.md §2.2).
    expect(tx.turno.updateMany).toHaveBeenNthCalledWith(2, { where: { idTurno: TURNO, estadoTurno: "PENDIENTE" }, data: { estadoTurno: "DISPONIBLE" } });
    expect(inscripcion.crear.mock.calls.map(([, datos]) => datos)).toEqual([A, B, C].map((alumnoId) => ({
      turnoId: TURNO, alumnoId, origen: "CENTRO", conReserva: true, actor: { tipo: "USUARIO", usuarioId: USUARIO }, bloqueosTomados: true, momento: expect.any(Date),
    })));
    expect(inscripcion.finalizar).not.toHaveBeenCalled();
    // El trigger de reservas proyecta cada inscripción vigente: las altas van después de confirmar la clase.
    expect(tx.turno.updateMany.mock.invocationCallOrder[1]).toBeLessThan(inscripcion.crear.mock.invocationCallOrder[0]);
    expect(evento).toHaveBeenCalledWith({ data: expect.objectContaining({ tipoEvento: "turno:participantes_asignados", payloadEvento: { turno_id: TURNO, alumno_ids: [A, B, C], profesor_id: P, usuario_id: USUARIO } }) });
    expect(tipos()).toEqual(["turno:participantes_asignados", "turno:completado"]);
    expect(evento.mock.calls[1]![0].data.payloadEvento).toEqual({ turno_id: TURNO, alumno_ids: [A, B, C], cupo_maximo: 3, usuario_id: USUARIO });
  });
  it("un alumno alcanzado por la regla de re-reserva devuelve 409 INSCRIPCION_REQUIERE_PAGO y no emite eventos (C §2.18.3)", async () => {
    const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
    inscripcion.crear.mockRejectedValueOnce(new ErrorDeDominio("errores.inscripcion.requierePago", { alumno_id: A }));
    await expect(ejecutar([A, B])).rejects.toMatchObject({ code: "INSCRIPCION_REQUIERE_PAGO", status: 409, detalles: { alumno_id: A } });
    expect(evento).not.toHaveBeenCalled();
  });
  it("confirma DISPONIBLE por debajo del cupo y emite turno:disponibilizado con el payload de §4", async () => {
    await expect(ejecutar([A, B])).resolves.toMatchObject({ estado: "DISPONIBLE", cupo_maximo: 3 });
    expect(tx.turno.updateMany).toHaveBeenNthCalledWith(2, { where: { idTurno: TURNO, estadoTurno: "PENDIENTE" }, data: { estadoTurno: "DISPONIBLE" } });
    expect(tipos()).toEqual(["turno:participantes_asignados", "turno:disponibilizado"]);
    expect(evento.mock.calls[1]![0].data.payloadEvento).toEqual({
      turno_id: TURNO, fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", alumno_ids: [A, B],
      profesor_id: P, aula_id: AULA, materia_id: turno.materiaId, usuario_id: USUARIO,
    });
  });
  it("rechaza TURNO_SIN_AULA sin aula asignada, antes de validar nada más", async () => {
    tx.turno.findUnique.mockResolvedValueOnce({ ...turno, aulaId: null, cupoMaximoTurno: null });
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_SIN_AULA", message: "Asigná un aula antes de confirmar el turno" });
    expect(vigente).not.toHaveBeenCalled();
    expect(activo).not.toHaveBeenCalled();
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });
  it("revalida el aula: inactiva u ocupada por un turno confirmado superpuesto", async () => {
    aulaActiva.mockResolvedValueOnce(null);
    await expect(ejecutar()).rejects.toMatchObject({ code: "AULA_INACTIVA" });
    tx.turno.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([otroTurno("10:30", 60)]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "AULA_NO_DISPONIBLE" });
    expect(tx.turno.findMany.mock.calls.at(-1)![0].where).toMatchObject({ aulaId: AULA, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("rechaza si la materia dejó de estar activa", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(ejecutar()).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("traduce la exclusión de reservas_turno al recurso en conflicto, sin emitir eventos", async () => {
    const exclusion = (clave: string) => new Prisma.PrismaClientKnownRequestError(
      `conflicting key value violates exclusion constraint "reservas_turno_sin_solapamiento" DETAIL: Key (...)=${clave}`,
      { code: "P2010", clientVersion: "test", meta: {} });
    tx.turno.updateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(exclusion("(PROFESOR, x, ...)"));
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_NO_DISPONIBLE" });
    tx.turno.updateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(exclusion(`(ALUMNO, ${B}, ...)`));
    await expect(ejecutar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: B } });
    expect(evento).not.toHaveBeenCalled();
  });
  it("rechaza más alumnos que el cupo sin persistir nada", async () => {
    tx.turno.findUnique.mockResolvedValueOnce({ ...turno, cupoMaximoTurno: 2 });
    await expect(ejecutar()).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE", message: "El turno alcanzó su cupo máximo" });
    expect(activo).not.toHaveBeenCalled();
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("acepta exactamente el cupo", async () => {
    tx.turno.findUnique.mockResolvedValueOnce({ ...turno, cupoMaximoTurno: 3 });
    await expect(ejecutar()).resolves.toMatchObject({ alumno_ids: [A, B, C] });
  });
  it("rechaza turno disponible o completo, vencido y modificación concurrente", async () => {
    for (const estadoTurno of ["DISPONIBLE", "COMPLETO"]) {
      tx.turno.findUnique.mockResolvedValueOnce({ ...turno, estadoTurno });
      await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
    }
    vigente.mockReturnValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    tx.turno.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ejecutar()).rejects.toMatchObject({ code: "TURNO_MODIFICADO" });
    expect(inscripcion.crear).not.toHaveBeenCalled();
    expect(evento).not.toHaveBeenCalled();
  });
  it("identifica al alumno inactivo en detalles", async () => {
    activo.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new ServiceError("ALUMNO_INACTIVO", "El alumno está inactivo"));
    await expect(ejecutar()).rejects.toMatchObject({ code: "ALUMNO_INACTIVO", detalles: { alumno_id: B } });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("rechaza profesor sin materia y ausencia de profesores", async () => {
    profesores.mockResolvedValueOnce([]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "SIN_PROFESORES_PARA_MATERIA", message: "No hay profesores activos asociados a esta materia" });
    dicta.mockResolvedValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_NO_DICTA_MATERIA" });
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });
  it("rechaza profesor fuera del horario de atención con el intervalo completo", async () => {
    horario.mockResolvedValueOnce(false);
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_FUERA_DE_HORARIO", message: "El turno está fuera del horario de atención del profesor" });
    expect(horario).toHaveBeenCalledWith(P, turno.fechaTurno, "10:00", "11:00", tx);
  });
  it("rechaza un turno DISPONIBLE/COMPLETO superpuesto del profesor con horario concreto", async () => {
    conflictos([otroTurno("10:30", 60)]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "PROFESOR_NO_DISPONIBLE", message: "El profesor ya tiene un turno agendado de 10:30 a 11:30" });
    expect(inscripcion.crear).not.toHaveBeenCalled();
  });
  it("permite turnos contiguos y consulta solo DISPONIBLE/COMPLETO, excluyendo el propio", async () => {
    conflictos([otroTurno("11:00", 60)], [otroTurno("09:00", 60, [A])]);
    await expect(ejecutar()).resolves.toMatchObject({ estado: "COMPLETO" });
    for (const [args] of tx.turno.findMany.mock.calls) {
      expect(args.where).toMatchObject({ idTurno: { not: TURNO }, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } });
    }
    expect(tx.turno.findMany.mock.calls[1]![0].where).toMatchObject({ alumnos: { some: { alumnoId: { in: [A, B, C] } } } });
  });
  it("identifica al alumno con un turno superpuesto", async () => {
    conflictos([], [otroTurno("10:30", 60, [C])]);
    await expect(ejecutar()).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: C } });
    expect(inscripcion.crear).not.toHaveBeenCalled();
  });
  it("el reemplazo no borra: las vigentes que no siguen pasan a QUITADA_CENTRO y las que siguen no se tocan", async () => {
    inscripcion.vigentes.mockResolvedValueOnce([{ id: "insc-a", alumnoId: A }, { id: "insc-viejo", alumnoId: "ckalumno00000000000000009" }]);
    await expect(ejecutar()).resolves.toMatchObject({ alumno_ids: [A, B, C] });
    expect(inscripcion.finalizar).toHaveBeenCalledTimes(1);
    expect(inscripcion.finalizar).toHaveBeenCalledWith(tx, { inscripcionId: "insc-viejo", vigencia: "QUITADA_CENTRO", actor: { tipo: "USUARIO", usuarioId: USUARIO }, fecha: expect.any(Date) });
    expect(inscripcion.crear.mock.calls.map(([, datos]) => datos.alumnoId)).toEqual([B, C]);
  });
  it("no emite evento si falla el reemplazo dentro de la transacción", async () => {
    inscripcion.crear.mockRejectedValueOnce(new Error("inserción fallida"));
    await expect(ejecutar()).rejects.toThrow("inserción fallida");
    expect(evento).not.toHaveBeenCalled();
  });
  it("dos confirmaciones concurrentes del mismo turno dejan una sola asignación", async () => {
    tx.turno.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const resultados = await Promise.allSettled([ejecutar(), ejecutar()]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected" && resultado.reason instanceof ServiceError && resultado.reason.code === "TURNO_MODIFICADO")).toHaveLength(1);
    expect(inscripcion.crear).toHaveBeenCalledTimes(3);
  });
});
