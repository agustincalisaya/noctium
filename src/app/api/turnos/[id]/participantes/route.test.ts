import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { asignar, permiso, cookie } = vi.hoisted(() => ({ asignar: vi.fn(), permiso: vi.fn(), cookie: vi.fn() }));
vi.mock("@/server/turnos/turno.service", () => ({ asignarParticipantesTurno: asignar }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => (req: NextRequest, ctx: unknown) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } }), ctx),
  decodificarToken: vi.fn(),
}));

const { PATCH } = await import("./route");
const TURNO = "ckturno00000000000000001";
const ALUMNO = "ckalumno00000000000000001";
const request = (body: unknown) => PATCH(new NextRequest(`http://localhost/api/turnos/${TURNO}/participantes`, {
  method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), { params: Promise.resolve({ id: TURNO }) });

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({});
  asignar.mockResolvedValue({ id: TURNO, alumno_ids: [ALUMNO], profesor_id: "profesor-1", cupo_maximo: 3, estado: "DISPONIBLE" });
});

describe("PATCH /api/turnos/[id]/participantes", () => {
  it.each([
    ["vacío", []],
    ["duplicado", [ALUMNO, ALUMNO]],
  ])("rechaza alumno_ids %s con 400 VALIDATION_ERROR", async (_caso, alumno_ids) => {
    const respuesta = await request({ alumno_ids });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
    expect(asignar).not.toHaveBeenCalled();
  });

  it("acepta el payload mínimo y conserva el permiso", async () => {
    const respuesta = await request({ alumno_ids: [ALUMNO] });
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ data: { id: TURNO, estado: "DISPONIBLE" }, error: null });
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:asignar_participantes" } } });
    expect(asignar).toHaveBeenCalledExactlyOnceWith(TURNO, { alumno_ids: [ALUMNO] }, "usuario");
  });

  it.each([
    ["TURNO_SIN_PROFESOR", 409],
    ["PROFESOR_NO_ENCONTRADO", 404],
    ["PROFESOR_NO_DICTA_MATERIA", 409],
    ["PROFESOR_FUERA_DE_HORARIO", 409],
    ["PROFESOR_NO_DISPONIBLE", 409],
    ["TURNO_SIN_AULA", 409],
    ["AULA_NO_DISPONIBLE", 409],
    ["ALUMNO_NO_ENCONTRADO", 404],
    ["ALUMNO_NO_DISPONIBLE", 409],
  ])("traduce %s a HTTP %i", async (code, status) => {
    asignar.mockRejectedValueOnce(new ServiceError(code, "Mensaje del servicio"));
    const respuesta = await request({ alumno_ids: [ALUMNO] });
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code, message: "Mensaje del servicio" } });
  });
});
