import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-A-06 con HU-D-06 (spec_modulo_D.md §2.9.2 y §2.12): PATCH
// /api/profesores/[id] con una ficha con cuenta, y el campo extra `cuenta`
// del detalle. El permiso y el servicio están simulados.

const m = vi.hoisted(() => ({ modificar: vi.fn(), detalle: vi.fn(), cuenta: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission:
    (_accion: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown) =>
      handler(Object.assign(req, { auth: { user: { id: "mesa", rol: "MESA_ENTRADA" } } }), ctx),
}));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/server/profesores/profesor.service", () => ({
  modificarProfesor: m.modificar,
  obtenerDetalleProfesor: m.detalle,
  obtenerCuentaDeProfesor: m.cuenta,
}));

const { GET, PATCH } = await import("./route");
const PROFESOR = "ckprofesor000000000000001";
type Ruta = (req: NextRequest, ctx: unknown) => Promise<Response>;

async function patch(body: unknown) {
  const respuesta = await (PATCH as unknown as Ruta)(
    new NextRequest(`http://localhost/api/profesores/${PROFESOR}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: PROFESOR }) },
  );
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/profesores/[id] con cuenta", () => {
  it("200 con el resultado del servicio", async () => {
    m.modificar.mockResolvedValue({ id: PROFESOR, campos_modificados: ["email"], version: 3 });
    expect(await patch({ email: "nuevo@mail.com", version: 2 })).toEqual({
      status: 200,
      cuerpo: { data: { id: PROFESOR, campos_modificados: ["email"], version: 3 }, error: null },
    });
  });

  it("email de otra cuenta → 409 EMAIL_YA_ASOCIADO, sin revelar de quién", async () => {
    m.modificar.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await patch({ email: "otra@mail.com", version: 2 })).toEqual({
      status: 409,
      cuerpo: { data: null, error: { code: "EMAIL_YA_ASOCIADO", message: "Ese email ya está asociado a otra cuenta" } },
    });
  });

  it("ficha con cuenta sin email → 400 VALIDACION en el campo email", async () => {
    m.modificar.mockRejectedValue(new ServiceError("CONTACTO_REQUERIDO", "Ingresá el email: es el usuario con el que esta persona ingresa al sistema", { campo: "email" }));
    const r = await patch({ email: null, version: 2 });
    expect(r.status).toBe(400);
    expect(r.cuerpo.error).toMatchObject({ code: "VALIDACION", detalles: { fieldErrors: { email: [expect.any(String)] } } });
  });

  it("sin ningún medio de contacto → 400 VALIDACION en telefono, como en Sprint 2", async () => {
    m.modificar.mockRejectedValue(new ServiceError("CONTACTO_REQUERIDO", "Ingresá al menos un teléfono o un email de contacto"));
    const r = await patch({ email: null, version: 2 });
    expect(r.cuerpo.error.detalles.fieldErrors).toEqual({ telefono: ["Ingresá al menos un teléfono o un email de contacto"] });
  });

  it("transacción ocupada → 409", async () => {
    m.modificar.mockRejectedValue(new ErrorDeDominio("errores.transaccion.ocupada"));
    expect((await patch({ email: "nuevo@mail.com", version: 2 })).status).toBe(409);
  });

  it("email inválido → 400 sin llamar al servicio", async () => {
    expect((await patch({ email: "no-es-email", version: 2 })).status).toBe(400);
    expect(m.modificar).not.toHaveBeenCalled();
  });
});

describe("GET /api/profesores/[id]", () => {
  it("suma `cuenta` en camelCase, sin el hash", async () => {
    m.detalle.mockResolvedValue({ id: PROFESOR, nombre: "Ana", telefono: null, email: "ana@mail.com", horarios: [] });
    m.cuenta.mockResolvedValue({ estado: "ACTIVA", email: "ana@mail.com", rol: "PROFESOR", debe_cambiar_password: true });
    const respuesta = await (GET as unknown as Ruta)(new NextRequest(`http://localhost/api/profesores/${PROFESOR}`), {
      params: Promise.resolve({ id: PROFESOR }),
    });
    const { data } = await respuesta.json();
    expect(data.cuenta).toEqual({ estado: "ACTIVA", email: "ana@mail.com", rol: "PROFESOR", debeCambiarPassword: true });
    expect(data.contacto).toEqual({ telefono: null, email: "ana@mail.com" });
  });
});
