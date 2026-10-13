import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { corregir, permiso, sesion } = vi.hoisted(() => ({
  corregir: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/correccion.flujos", () => ({ corregirPagoFlujo: corregir }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const { POST } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const CUID = "c123456789012345678901234";
const publicar = (body: unknown) => POST(new NextRequest("http://localhost/api/pagos/p1/correccion", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
}), { params: Promise.resolve({ id: "p1" }) });
const RESPUESTA = {
  pago_id: "p1", monto: "22000.00", forma_pago: { id: "f", nombre: "Transferencia", is_active: true },
  fecha_pago: "2026-10-08", clases_abarcadas: 2, comprobante: { id: "c", numero: "0001-00000131" },
};

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  corregir.mockResolvedValue(RESPUESTA);
});

describe("POST /api/pagos/[id]/correccion (HU-I-06, spec_modulo_I.md §2.14.2)", () => {
  it("200 con pagos:corregir; valida con Zod y pasa el usuario con su rol", async () => {
    const r = await publicar({ monto: "22000", fecha_pago: "2026-10-08", motivo: "Beca" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: RESPUESTA, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "pagos:corregir" } } });
    expect(corregir).toHaveBeenCalledWith("p1", { monto: "22000", fecha_pago: new Date("2026-10-08T00:00:00.000Z"), motivo: "Beca" }, { id: "u1", rol: "MESA_ENTRADA" });
  });

  it("rol sin pagos:corregir → 403 SIN_PERMISO sin llamar al flujo", async () => {
    sesion.actual = { user: { id: "p", rol: "PROFESOR" } };
    permiso.mockResolvedValue(null);
    const r = await publicar({ monto: "1", motivo: "x" });
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(corregir).not.toHaveBeenCalled();
  });

  it.each([
    { motivo: "nada para corregir" },
    { monto: "1", motivo: "" },
    { monto: "1", motivo: "x".repeat(301) },
    { monto: "1", motivo: "x", extra: true },
    { monto: "1", motivo: "x", caja_ajuste_id: "no-cuid" },
    "JSON inválido",
  ])("400 VALIDACION sin llamar al flujo: %o", async (body) => {
    const r = await publicar(body);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION" } });
    expect(corregir).not.toHaveBeenCalled();
  });

  it("acepta caja_ajuste_id con formato CUID", async () => {
    await publicar({ monto: "1", motivo: "x", caja_ajuste_id: CUID });
    expect(corregir).toHaveBeenCalledWith("p1", expect.objectContaining({ caja_ajuste_id: CUID }), expect.anything());
  });

  it.each([
    ["errores.pago.noEncontrado", "PAGO_NO_ENCONTRADO", 404],
    ["errores.pago.sinCambios", "SIN_CAMBIOS", 400],
    ["errores.pago.fechaFutura", "FECHA_PAGO_FUTURA", 400],
    ["errores.pago.fueraDeAlcance", "FUERA_DE_ALCANCE", 403],
    ["errores.formaPago.noEncontrada", "FORMA_PAGO_NO_ENCONTRADA", 404],
    ["errores.pago.anulado", "PAGO_ANULADO", 409],
    ["errores.formaPago.noDisponible", "FORMA_PAGO_NO_DISPONIBLE", 409],
    ["errores.caja.ajusteSinCajaAbierta", "CAJA_DE_AJUSTE_NO_ABIERTA", 409],
    ["errores.transaccion.ocupada", "TRANSACCION_OCUPADA", 409],
  ] as const)("%s → %s %i", async (clave, code, status) => {
    corregir.mockRejectedValue(new ErrorDeDominio(clave));
    const r = await publicar({ monto: "1", motivo: "x" });
    expect(r.status).toBe(status);
    expect(await r.json()).toMatchObject({ data: null, error: { code, message: expect.any(String) } });
  });
});
