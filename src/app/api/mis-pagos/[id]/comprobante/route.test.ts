import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { leerDeAlumno, delPago, alumnoDeUsuario, permiso, sesion } = vi.hoisted(() => ({
  leerDeAlumno: vi.fn(),
  delPago: vi.fn(),
  alumnoDeUsuario: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/comprobante.lectura", () => ({ leerComprobanteDeAlumno: leerDeAlumno, comprobanteDelPago: delPago }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: alumnoDeUsuario }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: sesion.actual }), ctx),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const pedir = (id: string) => GET(new NextRequest(`http://localhost/api/mis-pagos/${id}/comprobante`), { params: Promise.resolve({ id }) });
const VISTA = { id: "comp-1", numero: "0001-00000123", registrado_en_el_centro: true };

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u-alumno", rol: "ALUMNO" } };
  permiso.mockResolvedValue({});
  alumnoDeUsuario.mockResolvedValue({ id: "alumno-1", activo: true });
  delPago.mockResolvedValue({ id: "comp-1", numero: "0001-00000123" });
  leerDeAlumno.mockResolvedValue(VISTA);
});

describe("GET /api/mis-pagos/[id]/comprobante (HU-I-11)", () => {
  it("alumno dueño → 200 con la vista del alumno", async () => {
    const r = await pedir("pago-1");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: VISTA, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "ALUMNO", accionPermiso: "comprobantes:leer_propios" } } });
    expect(alumnoDeUsuario).toHaveBeenCalledWith("u-alumno");
    expect(leerDeAlumno).toHaveBeenCalledWith(expect.anything(), "comp-1", "alumno-1");
  });

  it("pago de otro alumno → 403 FUERA_DE_ALCANCE", async () => {
    leerDeAlumno.mockRejectedValue(new ErrorDeDominio("errores.pago.fueraDeAlcance"));
    const r = await pedir("pago-ajeno");
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ data: null, error: { code: "FUERA_DE_ALCANCE" } });
  });

  it("cuenta sin ficha de alumno → 403 FUERA_DE_ALCANCE sin buscar el pago", async () => {
    alumnoDeUsuario.mockResolvedValue(null);
    const r = await pedir("pago-1");
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ error: { code: "FUERA_DE_ALCANCE" } });
    expect(delPago).not.toHaveBeenCalled();
  });

  it("pago inexistente → 404 PAGO_NO_ENCONTRADO", async () => {
    delPago.mockRejectedValue(new ErrorDeDominio("errores.pago.noEncontrado"));
    const r = await pedir("nada");
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: { code: "PAGO_NO_ENCONTRADO" } });
  });

  it("mesa de entrada (sin comprobantes:leer_propios) → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
    permiso.mockResolvedValue(null);
    const r = await pedir("pago-1");
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ error: { code: "SIN_PERMISO" } });
    expect(alumnoDeUsuario).not.toHaveBeenCalled();
  });
});
