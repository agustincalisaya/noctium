import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, lecturaClase, bloquearTurno, terminoTurno, alumnos, email, profesor } = vi.hoisted(() => ({
  tx: {
    claseDictada: { createMany: vi.fn(), findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
    claseDictadaAlumno: { createMany: vi.fn() },
  },
  lecturaClase: vi.fn(),
  bloquearTurno: vi.fn(),
  terminoTurno: vi.fn(),
  alumnos: vi.fn(),
  email: vi.fn(),
  profesor: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn((callback) => callback(tx)),
  claseDictada: { findUnique: lecturaClase },
} }));
vi.mock("@/server/turnos/turno.publico", () => ({ bloquearTurnoParaOperacion: bloquearTurno }));
vi.mock("@/server/turnos/turno.acciones", () => ({ turnoYaTermino: terminoTurno }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnosBasicos: alumnos }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: email }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: profesor }));

const { registrarClaseDictada, obtenerRegistroClaseDictada } = await import("./clase-dictada.service");

const turno = {
  id: "turno-1", estado: "DISPONIBLE", fecha: "2026-09-28", hora_inicio: "16:00", hora_fin: "17:00",
  duracion_min: 60, materia_id: "materia-1", profesor_id: "profesor-1", aula_id: "aula-1",
  alumno_ids: ["alumno-1", "alumno-2"], vencido: true,
};
const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };

beforeEach(() => {
  vi.clearAllMocks();
  bloquearTurno.mockResolvedValue(turno);
  terminoTurno.mockReturnValue(true);
  profesor.mockResolvedValue({ id: "profesor-1", nombreParaMostrar: "Giménez, Laura" });
  tx.claseDictada.createMany.mockResolvedValue({ count: 1 });
  tx.claseDictada.findUniqueOrThrow.mockResolvedValue({ idClaseDictada: "clase-1" });
  tx.claseDictada.findUnique.mockResolvedValue({
    idClaseDictada: "clase-1", createdAtClaseDictada: new Date("2026-09-30T12:00:00.000Z"), _count: { alumnos: 2 },
  });
  lecturaClase.mockResolvedValue(null);
  tx.claseDictadaAlumno.createMany.mockResolvedValue({ count: 2 });
});

describe("HU-E-01 registrarClaseDictada", () => {
  it("registra el snapshot del turno y copia a los alumnos inscriptos", async () => {
    await expect(registrarClaseDictada("turno-1", mesa, new Date("2026-09-30T20:00:00.000Z"))).resolves.toEqual({
      id: "clase-1", turno_id: "turno-1", fecha: "2026-09-28", alumnos_registrados: 2, ya_existia: false,
    });

    expect(bloquearTurno).toHaveBeenCalledWith("turno-1", tx);
    expect(terminoTurno).toHaveBeenCalledOnce();
    expect(tx.claseDictada.createMany).toHaveBeenCalledWith({ data: [{
      turnoId: "turno-1", fechaClaseDictada: new Date("2026-09-28T00:00:00.000Z"),
      materiaId: "materia-1", profesorId: "profesor-1", creadoPorUsuarioId: "mesa-1",
    }], skipDuplicates: true });
    expect(tx.claseDictadaAlumno.createMany).toHaveBeenCalledWith({
      data: [{ claseDictadaId: "clase-1", alumnoId: "alumno-1" }, { claseDictadaId: "clase-1", alumnoId: "alumno-2" }],
      skipDuplicates: true,
    });
  });

  it("es idempotente cuando ya existe la clase y no vuelve a copiar inscriptos", async () => {
    tx.claseDictada.createMany.mockResolvedValue({ count: 0 });

    await expect(registrarClaseDictada("turno-1", mesa, new Date("2026-09-30T20:00:00.000Z"))).resolves.toMatchObject({
      id: "clase-1", ya_existia: true, alumnos_registrados: 2,
    });

    expect(tx.claseDictada.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.claseDictadaAlumno.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ["estado PENDIENTE", { estado: "PENDIENTE" }, "TURNO_NO_ADMITE_CLASE"],
    ["estado CANCELADO", { estado: "CANCELADO" }, "TURNO_NO_ADMITE_CLASE"],
  ])("rechaza %s antes de insertar", async (_caso, cambios, codigo) => {
    bloquearTurno.mockResolvedValue({ ...turno, ...cambios });

    await expect(registrarClaseDictada("turno-1", mesa)).rejects.toMatchObject({ code: codigo });
    expect(tx.claseDictada.createMany).not.toHaveBeenCalled();
  });

  it("rechaza una clase que todavía no terminó y un profesor con turno ajeno", async () => {
    terminoTurno.mockReturnValue(false);
    await expect(registrarClaseDictada("turno-1", mesa)).rejects.toMatchObject({ code: "CLASE_NO_FINALIZADA" });
    terminoTurno.mockReturnValue(true);

    profesor.mockResolvedValue({ id: "otro-profesor", nombreParaMostrar: "Otro" });
    await expect(registrarClaseDictada("turno-1", { id: "prof-usuario", rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(tx.claseDictada.createMany).not.toHaveBeenCalled();
  });

  it("permite el turno elegible sin alumnos y omite solo la tabla de vínculos", async () => {
    bloquearTurno.mockResolvedValue({ ...turno, alumno_ids: [] });
    tx.claseDictada.findUnique.mockResolvedValue({
      idClaseDictada: "clase-1", createdAtClaseDictada: new Date("2026-09-30T12:00:00.000Z"), _count: { alumnos: 0 },
    });

    await expect(registrarClaseDictada("turno-1", mesa)).resolves.toMatchObject({ alumnos_registrados: 0, ya_existia: false });
    expect(tx.claseDictada.createMany).toHaveBeenCalledOnce();
    expect(tx.claseDictadaAlumno.createMany).not.toHaveBeenCalled();
  });
});

describe("HU-E-01 obtenerRegistroClaseDictada", () => {
  it("resuelve el nombre público de alumnos y el email del usuario que registró", async () => {
    lecturaClase.mockResolvedValue({
      idClaseDictada: "clase-1", profesorId: "profesor-1", creadoPorUsuarioId: "mesa-1",
      createdAtClaseDictada: new Date("2026-09-30T12:00:00.000Z"),
      alumnos: [{ alumnoId: "alumno-2" }, { alumnoId: "alumno-1" }],
    });
    alumnos.mockResolvedValue([
      { id: "alumno-1", nombre: "Ana", apellido: "Pérez" },
      { id: "alumno-2", nombre: "Luis", apellido: "Acosta" },
    ]);
    email.mockResolvedValue("mesa@noctium.local");

    await expect(obtenerRegistroClaseDictada("turno-1", mesa)).resolves.toEqual({
      id: "clase-1", registrada_en: "2026-09-30T12:00:00.000Z", registrada_por: "mesa@noctium.local",
      alumnos: [
        { id: "alumno-2", nombre_completo: "Acosta, Luis" },
        { id: "alumno-1", nombre_completo: "Pérez, Ana" },
      ],
    });
  });
});
