import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/shared/service-error";

// HU-D-06: Server Action modificarProfesor() (spec_modulo_D.md §2.6), con
// servicio y permiso mockeados.

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
    servicio: { modificarProfesor: vi.fn() },
    permiso: { PermisoError, verificarPermiso: vi.fn() },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/parametros", () => ({
  getParametroNumerico: vi.fn(async (clave: string) => (clave === "dni_longitud_min" ? 7 : 8)),
  obtenerParametrosHorarioOperativo: vi.fn(),
}));
vi.mock("@/server/shared/with-permission", () => permiso);
vi.mock("@/server/profesores/profesor.service", () => ({
  ...servicio,
  asociarMateriasAProfesor: vi.fn(),
  registrarHorarioProfesor: vi.fn(),
}));

const { modificarProfesor } = await import("@/server/profesores/actions");
const { revalidatePath } = await import("next/cache");

const PROFESOR = "ckprofesor000000000000001";
const USUARIO = "ckusuario0000000000000001";

function formData(valores: Record<string, string>) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(valores)) datos.set(clave, valor);
  return datos;
}

beforeEach(() => {
  vi.clearAllMocks();
  permiso.verificarPermiso.mockResolvedValue({ id: USUARIO });
  servicio.modificarProfesor.mockResolvedValue({ id: PROFESOR, campos_modificados: ["telefono"], version: 4 });
});

describe("modificarProfesor (Server Action)", () => {
  it("arma el payload solo con las claves presentes y version numérica", async () => {
    const r = await modificarProfesor(PROFESOR, formData({ version: "3", telefono: "(0387) 15-412-3456" }));

    expect(permiso.verificarPermiso).toHaveBeenCalledWith("profesores:editar");
    expect(servicio.modificarProfesor).toHaveBeenCalledWith(
      PROFESOR,
      { telefono: "0387154123456", version: 3 },
      USUARIO,
    );
    expect(r).toEqual({ data: { id: PROFESOR, campos_modificados: ["telefono"], version: 4 }, error: null });
    expect(revalidatePath).toHaveBeenCalledWith("/profesores");
    expect(revalidatePath).toHaveBeenCalledWith(`/profesores/${PROFESOR}`);
  });

  it('convierte "" en null para genero, telefono y email', async () => {
    await modificarProfesor(PROFESOR, formData({ version: "3", genero: "", telefono: "", email: "" }));

    expect(servicio.modificarProfesor.mock.calls[0]![1]).toEqual({
      genero: null,
      telefono: null,
      email: null,
      version: 3,
    });
  });

  it("payload inválido → VALIDACION sin llamar al servicio", async () => {
    const r = await modificarProfesor(PROFESOR, formData({ version: "3", dni: "12" }));

    expect(r.data).toBeNull();
    expect(r.error?.code).toBe("VALIDACION");
    expect((r.error?.detalles as { fieldErrors: Record<string, string[]> }).fieldErrors.dni).toBeDefined();
    expect(servicio.modificarProfesor).not.toHaveBeenCalled();
  });

  it("sin version → VALIDACION", async () => {
    const r = await modificarProfesor(PROFESOR, formData({ nombre: "Ana" }));
    expect(r.error?.code).toBe("VALIDACION");
  });

  it("CONTACTO_REQUERIDO → VALIDACION con el error en el campo telefono", async () => {
    servicio.modificarProfesor.mockRejectedValue(
      new ServiceError("CONTACTO_REQUERIDO", "Ingresá al menos un teléfono o un email de contacto"),
    );

    const r = await modificarProfesor(PROFESOR, formData({ version: "3", email: "" }));

    expect(r.error).toEqual({
      code: "VALIDACION",
      message: "Datos inválidos",
      detalles: { formErrors: [], fieldErrors: { telefono: ["Ingresá al menos un teléfono o un email de contacto"] } },
    });
  });

  it.each([
    ["DNI_DUPLICADO", "Ya existe un profesor registrado con ese DNI"],
    ["EMAIL_YA_ASOCIADO", "Ese email ya está asociado a otra cuenta"],
    ["CONFLICTO_EDICION_CONCURRENTE", "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales."],
    ["PROFESOR_NO_ENCONTRADO", "El profesor ya no existe"],
    ["OTRO_CODIGO", "No se pudo conectar. Intentá nuevamente"],
  ])("traduce %s", async (code, message) => {
    servicio.modificarProfesor.mockRejectedValue(new ServiceError(code, "texto del servicio"));

    const r = await modificarProfesor(PROFESOR, formData({ version: "3", nombre: "Ana" }));

    expect(r).toEqual({ data: null, error: { code, message } });
  });

  it("sin permiso → error con el mensaje del PermisoError, sin llamar al servicio", async () => {
    permiso.verificarPermiso.mockRejectedValue(
      new permiso.PermisoError(403, "SIN_PERMISO", "No tenés permisos para acceder a esta sección"),
    );

    const r = await modificarProfesor(PROFESOR, formData({ version: "3", nombre: "Ana" }));

    expect(r).toEqual({
      data: null,
      error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" },
    });
    expect(servicio.modificarProfesor).not.toHaveBeenCalled();
  });

  it("error inesperado → mensaje de comunicación, sin detalle técnico", async () => {
    servicio.modificarProfesor.mockRejectedValue(new Error("conexión perdida"));

    const r = await modificarProfesor(PROFESOR, formData({ version: "3", nombre: "Ana" }));

    expect(r).toEqual({
      data: null,
      error: { code: "ERROR_COMUNICACION", message: "No se pudo conectar. Intentá nuevamente" },
    });
  });
});
