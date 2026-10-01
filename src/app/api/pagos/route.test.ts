import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { registrar, opciones, permiso, cookie, sesion } = vi.hoisted(() => ({
  registrar: vi.fn(),
  opciones: vi.fn(),
  permiso: vi.fn(),
  cookie: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ registrarPago: registrar, obtenerOpcionesPago: opciones }));
vi.mock("@/lib/prisma", () => ({
  prisma: { rolPermiso: { findUnique: permiso }, tokenRevocado: { findUnique: vi.fn() } },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { POST } = await import("./route");
const { GET } = await import("./opciones/route");
const ctx = { params: Promise.resolve({}) };
const valido = { turno_id: "seed-turno-02", alumno_id: "c123456789012345678901234", forma_pago_id: "formapago-efectivo", monto: "100.50", fecha_pago: "2026-09-30" };
const publicar = (body: unknown) => POST(new NextRequest("http://localhost/api/pagos", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
}), ctx);
const consultar = (query = "?turno_id=seed-turno-02") => GET(new NextRequest(`http://localhost/api/pagos/opciones${query}`), ctx);

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  registrar.mockResolvedValue({ id: "p1", monto: "100.50" });
  opciones.mockResolvedValue({ alumnos: [], formas_pago: [] });
});

describe("HU-I-01 contrato HTTP", () => {
  it("POST usa permiso granular, valida antes de servicio y responde 201", async () => {
    const r = await publicar(valido);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ data: { id: "p1", monto: "100.50" }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "pagos:crear" } } });
    expect(registrar).toHaveBeenCalledWith({ ...valido, fecha_pago: new Date("2026-09-30") }, "u1");
    expect(r.headers.get("Cache-Control")).toContain("no-store");
  });
  it.each(["POST", "GET"])("%s sin sesión 401, sin permiso 403", async (metodo) => {
    const ejecutar = () => metodo === "POST" ? publicar(valido) : consultar();
    sesion.actual = null;
    expect((await ejecutar()).status).toBe(401);
    sesion.actual = { user: { id: "u1", rol: "PROFESOR" } };
    permiso.mockResolvedValue(null);
    const r = await ejecutar();
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(registrar).not.toHaveBeenCalled(); expect(opciones).not.toHaveBeenCalled();
  });
  it.each([{ ...valido, monto: "0" }, { ...valido, alumno_id: undefined }, { ...valido, cbu: "123" }, "JSON inválido"])("400 VALIDACION sin llamar a servicio (%j)", async (body) => {
    const r = await publicar(body);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION", detalles: { fieldErrors: expect.any(Object) } } });
    expect(registrar).not.toHaveBeenCalled();
  });
  it.each([
    ["TURNO_NO_ENCONTRADO", 404], ["FORMA_PAGO_NO_ENCONTRADA", 404],
    ["TURNO_NO_ADMITE_PAGO", 409], ["ALUMNO_NO_INSCRIPTO", 409],
    ["FORMA_PAGO_NO_DISPONIBLE", 409], ["FECHA_PAGO_FUTURA", 400],
  ])("traduce %s a %i sin flatten", async (code, status) => {
    registrar.mockRejectedValue(new ServiceError(code));
    const r = await publicar(valido); expect(r.status).toBe(status);
    const json = await r.json(); expect(json).toMatchObject({ data: null, error: { code } });
    expect(json.error).not.toHaveProperty("detalles");
    if (code === "FECHA_PAGO_FUTURA") expect(json.error.message).toBe("La fecha de pago no puede ser futura");
  });
  it("GET opciones responde el DTO y verifica pagos:crear", async () => {
    const r = await consultar(); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { alumnos: [], formas_pago: [] }, error: null });
    expect(opciones).toHaveBeenCalledWith("seed-turno-02");
  });
  it("GET sin turno 400 y turno inexistente 404", async () => {
    expect((await consultar("")).status).toBe(400);
    expect(opciones).not.toHaveBeenCalled();
    opciones.mockRejectedValue(new ServiceError("TURNO_NO_ENCONTRADO"));
    expect((await consultar()).status).toBe(404);
  });
  it("no disfraza un error de infraestructura", async () => {
    registrar.mockRejectedValue(new Error("base caída"));
    await expect(publicar(valido)).rejects.toThrow("base caída");
  });
});
