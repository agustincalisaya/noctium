import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-A-06 con HU-B-02 (spec_modulo_B.md §2.2): PATCH /api/alumnos/[id]/contacto
// con una ficha con cuenta. El permiso y el servicio están simulados.

const m = vi.hoisted(() => ({ actualizar: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission:
    (_accion: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown) =>
      handler(Object.assign(req, { auth: { user: { id: "mesa", rol: "MESA_ENTRADA" } } }), ctx),
}));
vi.mock("@/server/alumnos/alumno.service", () => ({ actualizarContactoAlumno: m.actualizar }));

const { PATCH } = await import("./route");
const ALUMNO = "ckalumno00000000000000001";

async function patch(body: unknown) {
  const respuesta = await (PATCH as unknown as (req: NextRequest, ctx: unknown) => Promise<Response>)(
    new NextRequest(`http://localhost/api/alumnos/${ALUMNO}/contacto`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: ALUMNO }) },
  );
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/alumnos/[id]/contacto con cuenta", () => {
  it("200 con el contacto nuevo", async () => {
    m.actualizar.mockResolvedValue({ id: ALUMNO, telefono: null, email: "nuevo@mail.com" });
    expect(await patch({ email: "nuevo@mail.com" })).toEqual({
      status: 200,
      cuerpo: { data: { id: ALUMNO, telefono: null, email: "nuevo@mail.com" }, error: null },
    });
  });

  it("email de otra cuenta → 409 EMAIL_YA_ASOCIADO, sin revelar de quién", async () => {
    m.actualizar.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await patch({ email: "otra@mail.com" })).toEqual({
      status: 409,
      cuerpo: { data: null, error: { code: "EMAIL_YA_ASOCIADO", message: "Ese email ya está asociado a otra cuenta" } },
    });
  });

  it("ficha con cuenta sin email → 400 VALIDACION en el campo email", async () => {
    m.actualizar.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailRequerido"));
    const r = await patch({ telefono: "0387154123456", email: "" });
    expect(r.status).toBe(400);
    expect(r.cuerpo.error).toMatchObject({ code: "VALIDACION", detalles: { fieldErrors: { email: [expect.any(String)] } } });
  });

  it("transacción ocupada → 409 TRANSACCION_OCUPADA", async () => {
    m.actualizar.mockRejectedValue(new ErrorDeDominio("errores.transaccion.ocupada"));
    expect((await patch({ email: "nuevo@mail.com" })).status).toBe(409);
  });

  it("email inválido → 400 sin llamar al servicio", async () => {
    expect((await patch({ email: "no-es-email" })).status).toBe(400);
    expect(m.actualizar).not.toHaveBeenCalled();
  });
});
