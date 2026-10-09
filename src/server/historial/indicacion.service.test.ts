import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verificar: vi.fn(), profesor: vi.fn(), permisoMateria: vi.fn(), email: vi.fn(), ahora: vi.fn(),
  cursada: vi.fn(), clase: vi.fn(), crear: vi.fn(),
}));
vi.mock("@/server/alumnos/alumno.publico", () => ({ verificarAlumnoActivo: m.verificar }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: m.profesor }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: m.email }));
vi.mock("@/server/shared/reloj", () => ({ ahora: m.ahora }));
vi.mock("./historial.publico", () => ({ profesorPuedeRegistrarIndicacion: m.permisoMateria }));

const { registrarIndicacion } = await import("./indicacion.service");
const tx = {
  claseDictadaAlumno: { findFirst: m.cursada },
  claseDictada: { findFirst: m.clase },
  indicacion: { create: m.crear },
};
const entrada = { materia_id: "materia-1", indicacion: "Practicar ecuaciones" };

beforeEach(() => {
  vi.clearAllMocks();
  m.ahora.mockReturnValue(new Date("2026-10-09T14:00:00.000Z"));
  m.verificar.mockResolvedValue(undefined);
  m.profesor.mockResolvedValue({ id: "profesor-1" });
  m.permisoMateria.mockResolvedValue(true);
  m.cursada.mockResolvedValue({ alumnoId: "alumno-1" });
  m.clase.mockResolvedValue({ materiaId: "materia-1", alumnos: [{ alumnoId: "alumno-1" }] });
  m.crear.mockImplementation(async ({ data }: { data: { alumnoId: string; materiaId: string; claseDictadaId: string | null; texto: string; createdAtIndicacion: Date } }) => ({ idIndicacion: "indicacion-1", ...data }));
  m.email.mockResolvedValue("mesa@noctium.local");
});

describe("HU-E-04 registrarIndicacion", () => {
  it("crea un registro nuevo con autor, fecha y vínculo opcional", async () => {
    const resultado = await registrarIndicacion(tx as never, "alumno-1", { ...entrada, clase_dictada_id: "clase-1" }, { id: "mesa-1", rol: "MESA_ENTRADA" });
    expect(m.verificar).toHaveBeenCalledWith("alumno-1", tx);
    expect(m.clase).toHaveBeenCalledWith(expect.objectContaining({ where: { idClaseDictada: "clase-1", anuladaEl: null } }));
    expect(m.crear).toHaveBeenCalledWith({
      data: expect.objectContaining({ alumnoId: "alumno-1", materiaId: "materia-1", texto: entrada.indicacion, claseDictadaId: "clase-1", creadoPorUsuarioId: "mesa-1" }),
      select: expect.any(Object),
    });
    expect(resultado).toMatchObject({ id: "indicacion-1", alumno_id: "alumno-1", clase_dictada_id: "clase-1", registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local" });
  });

  it("authorizes a professor before looking up the student", async () => {
    m.permisoMateria.mockResolvedValue(false);
    await expect(registrarIndicacion(tx as never, "no-existe", entrada, { id: "profesor-usuario", rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(m.profesor).toHaveBeenCalledWith("profesor-usuario", tx);
    expect(m.permisoMateria).toHaveBeenCalledWith("profesor-1", "no-existe", "materia-1", tx);
    expect(m.verificar).not.toHaveBeenCalled();
  });

  it("rejects a subject the student has not taken", async () => {
    m.cursada.mockResolvedValue(null);
    await expect(registrarIndicacion(tx as never, "alumno-1", entrada, { id: "mesa-1", rol: "MESA_ENTRADA" })).rejects.toMatchObject({ code: "MATERIA_NO_CURSADA" });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("rejects a missing, annulled or mismatched linked class", async () => {
    m.clase.mockResolvedValueOnce(null);
    await expect(registrarIndicacion(tx as never, "alumno-1", { ...entrada, clase_dictada_id: "missing" }, { id: "mesa-1", rol: "MESA_ENTRADA" })).rejects.toMatchObject({ code: "CLASE_DICTADA_NO_ENCONTRADA" });
    m.clase.mockResolvedValueOnce({ materiaId: "otra", alumnos: [{ alumnoId: "alumno-1" }] });
    await expect(registrarIndicacion(tx as never, "alumno-1", { ...entrada, clase_dictada_id: "clase-2" }, { id: "mesa-1", rol: "MESA_ENTRADA" })).rejects.toMatchObject({ code: "CLASE_DICTADA_NO_CORRESPONDE" });
    m.clase.mockResolvedValueOnce({ materiaId: "materia-1", alumnos: [] });
    await expect(registrarIndicacion(tx as never, "alumno-1", { ...entrada, clase_dictada_id: "clase-3" }, { id: "mesa-1", rol: "MESA_ENTRADA" })).rejects.toMatchObject({ code: "CLASE_DICTADA_NO_CORRESPONDE" });
    expect(m.crear).not.toHaveBeenCalled();
  });
});
