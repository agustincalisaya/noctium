import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/server/shared/service-error";

// Ajuste HU-D-01/HU-D-02: la Server Action del alta valida el contacto con
// el mismo schema que el formulario, traduce EMAIL_YA_ASOCIADO a un error del
// campo email e informa `conContacto`. Servicio y permiso mockeados.

const { servicio } = vi.hoisted(() => ({
  servicio: { crearProfesor: vi.fn(), actualizarContactoProfesor: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/parametros", () => ({
  getParametroNumerico: vi.fn(async (clave: string) => (clave === "dni_longitud_min" ? 7 : 8)),
}));
vi.mock("@/server/shared/with-permission", () => ({
  PermisoError: class PermisoError extends Error {},
  verificarPermiso: vi.fn(async () => ({ id: "ckusuario0000000000000001" })),
}));
vi.mock("@/server/profesores/profesor.service", () => servicio);

const { crearProfesor } = await import("./actions");

const PROFESOR = "ckprofesor000000000000001";

function formData(valores: Record<string, string>) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries({
    nombre: "Ana",
    apellido: "Gómez",
    dni: "28456789",
    fechaNacimiento: "1980-05-10",
    genero: "",
    telefono: "",
    email: "",
    ...valores,
  })) {
    datos.set(clave, valor);
  }
  return datos;
}

function profesorCreado(contacto: { telefono: string | null; email: string | null }) {
  return { id: PROFESOR, nombre: "Ana", apellido: "Gómez", dni: "28456789", activo: true, ...contacto };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("crearProfesor (Server Action) con contacto", () => {
  it("sin contacto → llama al servicio con telefono/email undefined y conContacto false", async () => {
    servicio.crearProfesor.mockResolvedValue(profesorCreado({ telefono: null, email: null }));

    const estado = await crearProfesor({ status: "idle" }, formData({}));

    expect(servicio.crearProfesor.mock.calls[0]![0]).toMatchObject({ telefono: undefined, email: undefined });
    expect(estado).toEqual({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto: false });
  });

  it("con contacto → lo pasa normalizado y conContacto true", async () => {
    servicio.crearProfesor.mockResolvedValue(profesorCreado({ telefono: "0387154123456", email: null }));

    const estado = await crearProfesor({ status: "idle" }, formData({ telefono: "(0387) 15-412-3456" }));

    expect(servicio.crearProfesor.mock.calls[0]![0]).toMatchObject({ telefono: "0387154123456" });
    expect(estado).toMatchObject({ status: "exito", conContacto: true });
  });

  it("teléfono inválido → error_validacion en telefono, sin llamar al servicio", async () => {
    const estado = await crearProfesor({ status: "idle" }, formData({ telefono: "123-4567" }));

    expect(servicio.crearProfesor).not.toHaveBeenCalled();
    expect(estado).toEqual({
      status: "error_validacion",
      errores: { telefono: ["El teléfono debe tener entre 8 y 15 dígitos"] },
    });
  });

  it("EMAIL_YA_ASOCIADO → error genérico en el campo email", async () => {
    servicio.crearProfesor.mockRejectedValue(new ServiceError("EMAIL_YA_ASOCIADO", "El email pertenece a otra cuenta"));

    const estado = await crearProfesor({ status: "idle" }, formData({ email: "profesor2@noctium.local" }));

    expect(estado).toEqual({
      status: "error_validacion",
      errores: { email: ["Ese email ya está asociado a otra cuenta"] },
    });
  });

  it("DNI_DUPLICADO sigue como error del campo dni", async () => {
    servicio.crearProfesor.mockRejectedValue(new ServiceError("DNI_DUPLICADO"));

    const estado = await crearProfesor({ status: "idle" }, formData({ email: "ana@mail.com" }));

    expect(estado).toEqual({
      status: "error_validacion",
      errores: { dni: ["Ya existe un profesor registrado con ese DNI"] },
    });
  });
});
