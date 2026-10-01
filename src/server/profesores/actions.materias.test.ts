import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/shared/service-error";

// HU-D-07: Server Action actualizarMateriasProfesor() (spec_modulo_D.md §2.7),
// con servicio y permiso mockeados.

const { servicio, permiso } = vi.hoisted(() => {
  class PermisoError extends Error {
    constructor(
      public readonly status: 401 | 403,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    servicio: { actualizarMateriasDeProfesor: vi.fn() },
    permiso: { PermisoError, verificarPermiso: vi.fn() },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/parametros", () => ({
  getParametroNumerico: vi.fn(),
  obtenerParametrosHorarioOperativo: vi.fn(),
}));
vi.mock("@/server/shared/with-permission", () => permiso);
vi.mock("@/server/profesores/profesor.service", () => ({
  ...servicio,
  asociarMateriasAProfesor: vi.fn(),
  modificarProfesor: vi.fn(),
  registrarHorarioProfesor: vi.fn(),
}));

const { actualizarMateriasProfesor } = await import("@/server/profesores/actions");
const { revalidatePath } = await import("next/cache");

const PROFESOR = "ckprofesor000000000000001";
const USUARIO = "ckusuario0000000000000001";
const MAT = "ckmateria0000000000000001";
const QUI = "ckmateria0000000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  permiso.verificarPermiso.mockResolvedValue({ id: USUARIO, rol: "MESA_ENTRADA" });
  servicio.actualizarMateriasDeProfesor.mockResolvedValue({
    agregadas: [MAT], quitadas: [QUI], pendientes_afectados: 0, sin_cambios: false,
  });
});

describe("actualizarMateriasProfesor (HU-D-07)", () => {
  it("valida, invoca al servicio con el conjunto final y revalida ficha, listados y materias tocadas", async () => {
    const resultado = await actualizarMateriasProfesor(PROFESOR, [MAT]);
    expect(resultado).toEqual({
      data: { agregadas: [MAT], quitadas: [QUI], pendientes_afectados: 0, sin_cambios: false }, error: null,
    });
    expect(permiso.verificarPermiso).toHaveBeenCalledWith("profesores:editar");
    expect(servicio.actualizarMateriasDeProfesor).toHaveBeenCalledWith(PROFESOR, [MAT], USUARIO);
    for (const ruta of ["/profesores", `/profesores/${PROFESOR}`, "/materias", `/materias/${MAT}`, `/materias/${QUI}`]) {
      expect(revalidatePath).toHaveBeenCalledWith(ruta);
    }
  });

  it("sin cambios no revalida nada", async () => {
    servicio.actualizarMateriasDeProfesor.mockResolvedValue({ agregadas: [], quitadas: [], pendientes_afectados: 0, sin_cambios: true });
    await actualizarMateriasProfesor(PROFESOR, [MAT]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("VALIDACION sin llamar al servicio (ids repetidos)", async () => {
    const resultado = await actualizarMateriasProfesor(PROFESOR, [MAT, MAT]);
    expect(resultado.error?.code).toBe("VALIDACION");
    expect(servicio.actualizarMateriasDeProfesor).not.toHaveBeenCalled();
  });

  it("propaga el detalle de MATERIA_CON_TURNOS_FUTUROS para los avisos por materia", async () => {
    servicio.actualizarMateriasDeProfesor.mockRejectedValue(
      new ServiceError("MATERIA_CON_TURNOS_FUTUROS", "x", { detalle: [{ materia_id: MAT, cantidad: 3 }] }),
    );
    const { error } = await actualizarMateriasProfesor(PROFESOR, []);
    expect(error).toMatchObject({ code: "MATERIA_CON_TURNOS_FUTUROS", detalle: [{ materia_id: MAT, cantidad: 3 }] });
  });

  it("propaga las materias de MATERIA_INACTIVA", async () => {
    servicio.actualizarMateriasDeProfesor.mockRejectedValue(
      new ServiceError("MATERIA_INACTIVA", "x", { materias: [{ id: MAT, nombre: "Historia de la Ciencia" }] }),
    );
    const { error } = await actualizarMateriasProfesor(PROFESOR, [MAT]);
    expect(error).toMatchObject({ code: "MATERIA_INACTIVA", materias: [{ id: MAT, nombre: "Historia de la Ciencia" }] });
  });

  it.each([
    ["PROFESOR_INACTIVO", "Solo pueden asociarse materias a profesores activos"],
    ["MATERIA_YA_ASOCIADA", "Alguna de las materias ya está asociada al profesor. Recargá la página"],
  ])("%s usa el texto de HU-D-03", async (codigo, mensaje) => {
    servicio.actualizarMateriasDeProfesor.mockRejectedValue(new ServiceError(codigo, "x"));
    expect((await actualizarMateriasProfesor(PROFESOR, [MAT])).error).toEqual({ code: codigo, message: mensaje });
  });

  it("sin permiso devuelve el error de permiso sin llamar al servicio", async () => {
    permiso.verificarPermiso.mockRejectedValue(new permiso.PermisoError(403, "SIN_PERMISO", "No tenés permisos"));
    expect((await actualizarMateriasProfesor(PROFESOR, [MAT])).error).toEqual({ code: "SIN_PERMISO", message: "No tenés permisos" });
    expect(servicio.actualizarMateriasDeProfesor).not.toHaveBeenCalled();
  });

  it("un error inesperado no expone detalle técnico", async () => {
    servicio.actualizarMateriasDeProfesor.mockRejectedValue(new Error("SQL roto"));
    expect((await actualizarMateriasProfesor(PROFESOR, [MAT])).error).toEqual({
      code: "ERROR_COMUNICACION", message: "No se pudo conectar. Intentá nuevamente",
    });
  });
});
