import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: { $executeRaw: vi.fn(), $queryRaw: vi.fn(), claseDictada: { findFirst: vi.fn(), findFirstOrThrow: vi.fn() }, claseDictadaAlumno: { createMany: vi.fn() } },
  lectura: vi.fn(), bloquear: vi.fn(), turno: vi.fn(), termino: vi.fn(), alumnos: vi.fn(), email: vi.fn(), profesor: vi.fn(), vigentes: vi.fn(), vencer: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { claseDictada: { findFirst: mocks.lectura }, $queryRaw: mocks.tx.$queryRaw } }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: vi.fn((fn) => fn(mocks.tx)) }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: mocks.bloquear }));
vi.mock("@/server/turnos/turno.publico", () => ({ bloquearTurnoParaOperacion: mocks.turno }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ inscripcionesVigentes: mocks.vigentes, marcarVencidas: mocks.vencer }));
vi.mock("@/server/turnos/turno.acciones", () => ({ turnoYaTermino: mocks.termino }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: mocks.alumnos }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: mocks.email }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: mocks.profesor }));
const { registrarClaseDictada, registrarClaseDictadaDesdeSolicitud: registrarSolicitud, obtenerRegistroClaseDictada } = await import("./clase-dictada.service");
const turno = { id: "turno-1", estado: "DISPONIBLE", fecha: "2026-09-28", hora_inicio: "16:00", hora_fin: "17:00", duracion_min: 60, materia_id: "materia-1", profesor_id: "profesor-1", alumno_ids: ["alumno-1", "alumno-2"] };
const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const inscriptos = [{ id: "ins-1", alumnoId: "alumno-1" }, { id: "ins-2", alumnoId: "alumno-2" }];
const sinControl = inscriptos.map(({ alumnoId }) => ({ alumno_id: alumnoId, asistencia: null, con_control: false }));
const seleccion = [{ alumno_id: "alumno-1", estado: "PRESENTE" as const }, { alumno_id: "alumno-2", estado: "AUSENTE" as const }];

beforeEach(() => {
  vi.clearAllMocks(); mocks.turno.mockResolvedValue(turno); mocks.termino.mockReturnValue(true);
  mocks.profesor.mockResolvedValue({ id: "profesor-1" }); mocks.vigentes.mockResolvedValue(inscriptos);
  mocks.tx.claseDictada.findFirst.mockResolvedValue(null); mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.tx.$queryRaw.mockResolvedValue(sinControl); mocks.lectura.mockResolvedValue(null);
});

describe("HU-E-01 compatible / HU-E-09 registro", () => {
  it("sin cuerpo conserva snapshot y códigos, añade cantidades null y copia alumnos sin control", async () => {
    const resultado = await registrarSolicitud("turno-1", mesa);
    expect(resultado).toEqual({ id: expect.any(String), turno_id: "turno-1", fecha: "2026-09-28", alumnos_registrados: 2, ya_existia: false, con_control_asistencia: false, presentes: null, ausentes: null });
    expect(mocks.bloquear).toHaveBeenCalledWith(mocks.tx, { clases: ["turno-1"] });
    expect(mocks.turno).toHaveBeenCalledWith("turno-1", mocks.tx); expect(mocks.termino).toHaveBeenCalledOnce();
    const sql = mocks.tx.$executeRaw.mock.calls[0][0];
    expect(sql.sql).toContain('ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING');
    expect(sql.values).toContain("materia-1"); expect(sql.values).toContain("profesor-1"); expect(sql.values).toContain("mesa-1");
    expect(sql.values).toContain("2026-09-28");
    expect(mocks.tx.claseDictadaAlumno.createMany).toHaveBeenCalledWith({ data: [
      { claseDictadaId: resultado.id, alumnoId: "alumno-1", estadoAsistencia: null }, { claseDictadaId: resultado.id, alumnoId: "alumno-2", estadoAsistencia: null },
    ] });
  });
  it("ya existente no valida la selección ni cambia el registro", async () => {
    mocks.tx.claseDictada.findFirst.mockResolvedValue({ idClaseDictada: "clase-1" });
    await expect(registrarSolicitud("turno-1", mesa, [])).resolves.toMatchObject({ id: "clase-1", ya_existia: true, alumnos_registrados: 2 });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled(); expect(mocks.vencer).not.toHaveBeenCalled();
    expect(mocks.tx.claseDictadaAlumno.createMany).not.toHaveBeenCalled();
  });
  it.each(["PENDIENTE", "CANCELADO"])("rechaza %s antes de insertar", async (estado) => {
    mocks.turno.mockResolvedValue({ ...turno, estado });
    await expect(registrarSolicitud("turno-1", mesa)).rejects.toMatchObject({ code: "TURNO_NO_ADMITE_CLASE" });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it("rechaza antes del fin y profesor ajeno, sin cambiar contratos anteriores", async () => {
    mocks.termino.mockReturnValue(false);
    await expect(registrarSolicitud("turno-1", mesa)).rejects.toMatchObject({ code: "CLASE_NO_FINALIZADA" });
    mocks.termino.mockReturnValue(true); mocks.profesor.mockResolvedValue({ id: "otro" });
    await expect(registrarSolicitud("turno-1", { id: "prof", rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it("permite clase elegible sin alumnos y con control explícito", async () => {
    mocks.vigentes.mockResolvedValue([]); mocks.tx.$queryRaw.mockResolvedValue([{ alumno_id: null, asistencia: null, con_control: true }]);
    await expect(registrarSolicitud("turno-1", mesa, [])).resolves.toMatchObject({ alumnos_registrados: 0, presentes: 0, ausentes: 0, con_control_asistencia: true });
    expect(mocks.tx.claseDictadaAlumno.createMany).not.toHaveBeenCalled();
  });
  it("traduce alumno a inscripción bajo bloqueo y persiste los estados", async () => {
    mocks.tx.$queryRaw.mockResolvedValue(seleccion.map(({ alumno_id, estado }) => ({ alumno_id, asistencia: estado, con_control: true })));
    const resultado = await registrarSolicitud("turno-1", mesa, seleccion);
    expect(resultado).toMatchObject({ presentes: 1, ausentes: 1 });
    expect(mocks.tx.claseDictadaAlumno.createMany).toHaveBeenCalledWith({ data: [
      { claseDictadaId: resultado.id, alumnoId: "alumno-1", estadoAsistencia: "PRESENTE" }, { claseDictadaId: resultado.id, alumnoId: "alumno-2", estadoAsistencia: "AUSENTE" },
    ] });
    expect(mocks.bloquear.mock.invocationCallOrder[0]).toBeLessThan(mocks.vigentes.mock.invocationCallOrder[0]);
    expect(mocks.vencer).toHaveBeenCalledWith(mocks.tx, "turno-1", { momento: expect.any(Date) });
  });
  it.each([
    [seleccion.slice(0, 1), { faltan: ["alumno-2"], sobran: [], repetidos: [] }],
    [[...seleccion, { alumno_id: "otro", estado: "AUSENTE" as const }], { faltan: [], sobran: ["otro"], repetidos: [] }],
    [[...seleccion, seleccion[0]], { faltan: [], sobran: [], repetidos: ["alumno-1"] }],
  ])("rechaza conjunto inválido con detalles, sin insertar", async (asistencias, detalles) => {
    await expect(registrarSolicitud("turno-1", mesa, asistencias)).rejects.toMatchObject({ code: "ASISTENCIA_INCOMPLETA", detalles });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it("core acepta ids de inscripción y actor estándar para fixtures", async () => {
    await registrarClaseDictada(mocks.tx as never, { turnoId: "turno-1", actor: { tipo: "USUARIO", usuarioId: mesa.id }, asistencias: [{ inscripcionId: "ins-1", estado: "PRESENTE" }, { inscripcionId: "ins-2", estado: "AUSENTE" }] });
    expect(mocks.tx.claseDictadaAlumno.createMany).toHaveBeenCalledOnce();
  });
  it("devuelve la ganadora si ON CONFLICT no inserta", async () => {
    mocks.tx.$executeRaw.mockResolvedValue(0); mocks.tx.claseDictada.findFirstOrThrow.mockResolvedValue({ idClaseDictada: "ganadora" });
    await expect(registrarSolicitud("turno-1", mesa)).resolves.toMatchObject({ id: "ganadora", ya_existia: true });
    expect(mocks.tx.claseDictadaAlumno.createMany).not.toHaveBeenCalled();
  });
});

describe("HU-E-01 GET ampliado", () => {
  it("conserva nombres ordenados y auditoría, añadiendo asistencia vigente", async () => {
    mocks.lectura.mockResolvedValue({ idClaseDictada: "clase-1", profesorId: "profesor-1", creadoPorUsuarioId: "mesa-1", createdAtClaseDictada: new Date("2026-09-30T12:00:00Z") });
    mocks.alumnos.mockResolvedValue([{ id: "alumno-1", nombre: "Ana", apellido: "Pérez" }, { id: "alumno-2", nombre: "Luis", apellido: "Acosta" }]); mocks.email.mockResolvedValue("mesa@noctium.local");
    await expect(obtenerRegistroClaseDictada("turno-1", mesa)).resolves.toEqual({ id: "clase-1", registrada_en: "2026-09-30T12:00:00.000Z", registrada_por: "mesa@noctium.local", alumnos: [
      { id: "alumno-2", nombre_completo: "Acosta, Luis", asistencia: null }, { id: "alumno-1", nombre_completo: "Pérez, Ana", asistencia: null },
    ], con_control_asistencia: false, totales: null });
  });
  it("conserva 404 sin registro y deniega clase ajena registrada", async () => {
    await expect(obtenerRegistroClaseDictada("turno-1", { id: "prof", rol: "PROFESOR" })).rejects.toMatchObject({ code: "CLASE_NO_REGISTRADA" });
    await expect(obtenerRegistroClaseDictada("turno-1", mesa)).rejects.toMatchObject({ code: "CLASE_NO_REGISTRADA" });
    mocks.lectura.mockResolvedValue({ idClaseDictada: "clase-1", profesorId: "ajeno" });
    await expect(obtenerRegistroClaseDictada("turno-1", { id: "prof", rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
});
