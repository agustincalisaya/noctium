import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { anular, permiso, sesion } = vi.hoisted(() => ({
  anular: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/correccion.flujos", () => ({ anularPagoFlujo: anular }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const { POST } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const CUID = "c123456789012345678901234";
const publicar = (body: unknown) => POST(new NextRequest("http://localhost/api/pagos/p1/anulacion", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
}), { params: Promise.resolve({ id: "p1" }) });
const RESPUESTA = {
  pago_id: "p1", anulado: true, inscripcion: { id: "i1", estado_pago: "RESERVADA", vence_el: "2026-10-10T10:14:00-03:00" },
  comprobante: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
  permiso.mockResolvedValue({});
  anular.mockResolvedValue(RESPUESTA);
});

describe("POST /api/pagos/[id]/anulacion (HU-I-06, spec_modulo_I.md §2.14.3)", () => {
  it("200 con pagos:corregir; «Reintegro» es un motivo más", async () => {
    const r = await publicar({ motivo: "Reintegro", caja_ajuste_id: CUID });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: RESPUESTA, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "pagos:corregir" } } });
    expect(anular).toHaveBeenCalledWith("p1", { motivo: "Reintegro", caja_ajuste_id: CUID }, { id: "g1", rol: "GERENTE" });
  });

  it("rol sin pagos:corregir → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "a", rol: "ALUMNO" } };
    permiso.mockResolvedValue(null);
    const r = await publicar({ motivo: "x" });
    expect(r.status).toBe(403);
    expect(anular).not.toHaveBeenCalled();
  });

  it.each([{}, { motivo: "" }, { motivo: "x".repeat(301) }, { motivo: "x", monto: "1" }, "JSON inválido"])("400 VALIDACION: %o", async (body) => {
    const r = await publicar(body);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "VALIDACION" } });
    expect(anular).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.pago.noEncontrado", "PAGO_NO_ENCONTRADO", 404],
    ["errores.pago.yaAnulado", "PAGO_YA_ANULADO", 409],
    ["errores.pago.fueraDeAlcance", "FUERA_DE_ALCANCE", 403],
    ["errores.caja.ajusteSinCajaAbierta", "CAJA_DE_AJUSTE_NO_ABIERTA", 409],
    ["errores.transaccion.ocupada", "TRANSACCION_OCUPADA", 409],
  ] as const)("%s → %s %i", async (clave, code, status) => {
    anular.mockRejectedValue(new ErrorDeDominio(clave));
    const r = await publicar({ motivo: "x" });
    expect(r.status).toBe(status);
    expect(await r.json()).toMatchObject({ data: null, error: { code } });
  });
});
