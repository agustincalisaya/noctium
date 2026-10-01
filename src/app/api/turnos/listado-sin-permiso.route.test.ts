import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// HU-C-08 (m-3): ruta y servicio reales; solo se mockean los datos (Prisma),
// nunca el error. El Profesor recibe el mismo 403 para un profesor ajeno y
// para un CUID inexistente, sin revelar si existe (spec §2.7, R5-12).
const { prisma, sesion } = vi.hoisted(() => ({
  prisma: {
    rolPermiso: { findUnique: vi.fn() },
    profesor: { findUnique: vi.fn(), findFirst: vi.fn() },
    turno: { count: vi.fn(), findMany: vi.fn() },
  },
  sesion: { actual: { user: { id: "usuario-prof", rol: "PROFESOR" } } },
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn(async () => 10) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: sesion.actual })),
  decodificarToken: vi.fn(),
}));

const { GET } = await import("./route");
const contexto = { params: Promise.resolve({}) };
const PROPIO = "cmprofesorpropio0000000001";
const AJENO = "cmprofesorajeno00000000001";
const INEXISTENTE = "cmprofesornoexiste00000001";
const consultar = async (profesorId: string) => {
  const respuesta = await GET(new NextRequest(`http://localhost/api/turnos?profesor_id=${profesorId}`), contexto);
  return { status: respuesta.status, body: await respuesta.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.rolPermiso.findUnique.mockResolvedValue({});
  prisma.profesor.findUnique.mockResolvedValue({ idProfesor: PROPIO, apellidoProfesor: "Giménez", nombreProfesor: "Laura" });
  prisma.profesor.findFirst.mockImplementation(async ({ where }: { where: { idProfesor: string } }) =>
    where.idProfesor === AJENO ? { idProfesor: AJENO, apellidoProfesor: "Rossi", nombreProfesor: "Marco" } : null);
});

describe("HU-C-08 GET /api/turnos: 403 neutro del Profesor", () => {
  it("mismo cuerpo 403 para un profesor_id ajeno y para uno inexistente", async () => {
    const ajeno = await consultar(AJENO);
    const inexistente = await consultar(INEXISTENTE);
    const esperado = { data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para ver los turnos de ese profesor" } };
    expect(ajeno).toEqual({ status: 403, body: esperado });
    expect(inexistente).toEqual({ status: 403, body: esperado });
    expect(prisma.turno.count).not.toHaveBeenCalled();
  });
});
