import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listar, permiso, sesion } = vi.hoisted(() => ({
  listar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("@/server/pagos/pago.service", () => ({ listarClasesPendientesDePago: listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso }, tokenRevocado: { findUnique: vi.fn() } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) => handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const { ErrorDeDominio } = await import("@/server/shared/error-dominio");
const CUID = "c123456789012345678901234";
const consultar = (query: string) => GET(new NextRequest(`http://localhost/api/pagos/pendientes${query}`), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.resetAllMocks();
  sesion.actual = { user: { id: "u1", rol: "MESA_ENTRADA" } };
  permiso.mockResolvedValue({});
  listar.mockResolvedValue({ alumno: { id: CUID }, clases: [], formas_pago: [] });
});

describe("GET /api/pagos/pendientes (HU-I-10)", () => {
  it("200 con la lista; turno_id opcional", async () => {
    const r = await consultar(`?alumno_id=${CUID}&turno_id=seed-turno-12`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { alumno: { id: CUID }, clases: [], formas_pago: [] }, error: null });
    expect(listar).toHaveBeenCalledWith(CUID, "seed-turno-12");
  });
  it.each(["", "?alumno_id=x", `?alumno_id=${CUID}&extra=1`])("400 VALIDACION (%s)", async (query) => {
    expect((await consultar(query)).status).toBe(400);
    expect(listar).not.toHaveBeenCalled();
  });
  it.each([
    ["errores.alumno.noEncontrado", "ALUMNO_NO_ENCONTRADO", 404],
    ["errores.turno.noEncontrado", "TURNO_NO_ENCONTRADO", 404],
    ["errores.pago.turnoNoAdmitePago", "TURNO_NO_ADMITE_PAGO", 409],
    ["errores.pago.turnoYaEmpezo", "TURNO_YA_EMPEZO", 409],
    ["errores.pago.alumnoNoInscripto", "ALUMNO_NO_INSCRIPTO", 409],
    ["errores.alumno.inactivo", "ALUMNO_INACTIVO", 409],
    ["errores.inscripcion.materiaSinTarifaCentro", "MATERIA_SIN_TARIFA", 422],
  ] as const)("%s → %s %i", async (codigo, code, status) => {
    listar.mockRejectedValue(new ErrorDeDominio(codigo, { turno_id: "t1", materia: "Física I", fecha_dia: "05/10/2026" }));
    const r = await consultar(`?alumno_id=${CUID}&turno_id=t1`);
    expect(r.status).toBe(status);
    expect(await r.json()).toMatchObject({ data: null, error: { code } });
  });
  it("Gerente → 403 SIN_PERMISO", async () => {
    sesion.actual = { user: { id: "g1", rol: "GERENTE" } };
    permiso.mockResolvedValue(null);
    expect((await consultar(`?alumno_id=${CUID}`)).status).toBe(403);
  });
});
