import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// HU-A-06 con HU-D-01 (spec_modulo_D.md §2.9.1): POST /api/profesores con
// `email` crea también la cuenta y la respuesta suma `cuenta`. El permiso y
// el servicio están simulados (el permiso real lo cubre with-permission.test).

const m = vi.hoisted(() => ({ crear: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission:
    (_accion: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown) =>
      handler(Object.assign(req, { auth: { user: { id: "registrante", rol: "MESA_ENTRADA" } } }), ctx),
}));
vi.mock("@/auth", () => ({ obtenerIp: (req: Request) => req.headers.get("x-forwarded-for") ?? "unknown" }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/server/profesores/profesor.service", () => ({ crearProfesor: m.crear, listarProfesores: vi.fn() }));

const { POST } = await import("./route");

const IDENTIDAD = { nombre: "Ana", apellido: "Gómez", dni: "9011122", fechaNacimiento: "1980-05-10" };
const CREADO = { id: "ckprofesor000000000000001", nombre: "Ana", apellido: "Gómez", dni: "9011122", activo: true, telefono: null };

async function crear(body: unknown) {
  const respuesta = await (POST as unknown as (req: NextRequest, ctx: unknown) => Promise<Response>)(
    new NextRequest("http://localhost/api/profesores", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.9" },
    }),
    { params: Promise.resolve({}) },
  );
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/profesores", () => {
  it("con email: 201 con cuenta.creada true; pasa la IP y el email normalizado al servicio", async () => {
    m.crear.mockResolvedValue({ ...CREADO, email: "ana@mail.com", cuenta: { creada: true, debe_cambiar_password: true } });
    const r = await crear({ ...IDENTIDAD, email: " Ana@Mail.com " });
    expect(r).toEqual({
      status: 201,
      cuerpo: { data: { ...CREADO, email: "ana@mail.com", cuenta: { creada: true, debe_cambiar_password: true } }, error: null },
    });
    expect(m.crear).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@mail.com", dni: "9011122" }), "registrante", "10.0.0.9");
  });

  it("sin email: 201 con cuenta.creada false (contrato de Sprint 1 y 2 más el campo extra)", async () => {
    m.crear.mockResolvedValue({ ...CREADO, email: null, cuenta: { creada: false } });
    const r = await crear(IDENTIDAD);
    expect(r.status).toBe(201);
    expect(r.cuerpo.data.cuenta).toEqual({ creada: false });
  });

  it("email inválido: 400 sin llamar al servicio", async () => {
    const r = await crear({ ...IDENTIDAD, email: "no-es-email" });
    expect(r.status).toBe(400);
    expect(r.cuerpo.error.campos.email).toBeDefined();
    expect(m.crear).not.toHaveBeenCalled();
  });

  it.each([
    [new ErrorDeDominio("errores.cuenta.emailYaAsociado"), "EMAIL_YA_ASOCIADO", "Ese email ya está asociado a otra cuenta"],
    [new ServiceError("DNI_DUPLICADO", "Ya existe un profesor registrado con ese DNI"), "DNI_DUPLICADO", "Ya existe un profesor registrado con ese DNI"],
    [new ErrorDeDominio("errores.transaccion.ocupada"), "TRANSACCION_OCUPADA", "Otra persona está modificando estos datos. Intentá de nuevo."],
  ])("%s → 409 con su code, sin revelar de quién es el email", async (error, code, message) => {
    m.crear.mockRejectedValue(error);
    expect(await crear({ ...IDENTIDAD, email: "ana@mail.com" })).toEqual({ status: 409, cuerpo: { data: null, error: { code, message } } });
  });
});
