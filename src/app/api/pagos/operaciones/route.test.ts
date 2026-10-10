import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { registrar, permiso, sesion } = vi.hoisted(() => ({
  registrar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ registrarOperacionDePago: registrar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) => handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { POST } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const { ServiceError } = await import("@/server/shared/service-error");
const CUID = "c123456789012345678901234";
const valido = { alumno_id: CUID, items: [{ inscripcion_id: "c223456789012345678901234", monto: "12000" }], forma_pago_id: "formapago-efectivo" };
const publicar = (body: unknown) => POST(new NextRequest("http://localhost/api/pagos/operaciones", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
}), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  registrar.mockResolvedValue({ operacion_id: "op1", pagos: [{ id: "p1" }] });
});

describe("POST /api/pagos/operaciones (HU-I-10)", () => {
  it("201 con permiso pagos:crear; valida con Zod antes del servicio", async () => {
    const r = await publicar(valido);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ data: { operacion_id: "op1", pagos: [{ id: "p1" }] }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "pagos:crear" } } });
    expect(registrar).toHaveBeenCalledWith(valido, "u1");
  });
  it("Gerente (sin pagos:crear) → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    permiso.mockResolvedValue(null);
    const r = await publicar(valido);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(registrar).not.toHaveBeenCalled();
  });
  it.each([
    { ...valido, items: [] },
    { ...valido, items: Array.from({ length: 51 }, (_, i) => ({ turno_id: `t${i}`, monto: "1" })) },
    { ...valido, total: "1" },
    "JSON inválido",
  ])("400 VALIDACION sin llamar al servicio", async (body) => {
    const r = await publicar(body);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION" } });
    expect(registrar).not.toHaveBeenCalled();
  });
  it("400 MOTIVO_AJUSTE_REQUERIDO expone detalles.precio_vigente", async () => {
    registrar.mockRejectedValue(new ErrorDeDominio("errores.pago.motivoAjusteRequerido", { turno_id: "t1", materia: "Física I", precio_vigente: 12000 }));
    const r = await publicar(valido);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({
      data: null,
      error: {
        code: "MOTIVO_AJUSTE_REQUERIDO",
        message: "El monto es distinto del precio de la clase: ingresá el motivo del ajuste.",
        detalles: { turno_id: "t1", materia: "Física I", precio_vigente: 12000 },
      },
    });
  });
  it.each([
    ["errores.pago.turnoYaEmpezo", "TURNO_YA_EMPEZO", 409],
    ["errores.pago.reservaVencida", "RESERVA_VENCIDA", 409],
    ["errores.pago.inscripcionYaPagada", "INSCRIPCION_YA_PAGADA", 409],
    ["errores.caja.sinCajaAbierta", "CAJA_NO_ABIERTA", 409],
    ["errores.transaccion.ocupada", "TRANSACCION_OCUPADA", 409],
    ["errores.inscripcion.materiaSinTarifaCentro", "MATERIA_SIN_TARIFA", 422],
    // Códigos de Sprint 2: el HTTP del catálogo, no el de statusDeErrorNuevo (que da null).
    ["errores.turno.noEncontrado", "TURNO_NO_ENCONTRADO", 404],
    ["errores.pago.alumnoNoInscripto", "ALUMNO_NO_INSCRIPTO", 409],
    ["errores.pago.fechaFutura", "FECHA_PAGO_FUTURA", 400],
    ["errores.alumno.noEncontrado", "ALUMNO_NO_ENCONTRADO", 404],
  ] as const)("%s → %s %i, con la clase en detalles", async (codigo, code, status) => {
    registrar.mockRejectedValue(new ErrorDeDominio(codigo, { turno_id: "t1", materia: "Física I", fecha_dia: "05/10/2026" }));
    const r = await publicar(valido);
    expect(r.status).toBe(status);
    expect(await r.json()).toMatchObject({ data: null, error: { code, detalles: { turno_id: "t1" } } });
  });
  it("ServiceError común: fallback por código", async () => {
    registrar.mockRejectedValue(new ServiceError("FORMA_PAGO_NO_ENCONTRADA", "No se encontró la forma de pago"));
    expect((await publicar(valido)).status).toBe(404);
  });
});
