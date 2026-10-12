import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ servicio: vi.fn(), permiso: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => {
    mocks.permiso(permiso);
    return (req: NextRequest, ctx: unknown) => {
      mocks.permiso(permiso);
      return handler(Object.assign(req, { auth: { user: { id: "actor" } } }), ctx);
    };
  },
}));
vi.mock("@/server/alumnos/alumno.estado.service", () => ({
  obtenerImpactoBajaAlumno: mocks.servicio,
  desactivarAlumno: mocks.servicio,
  reactivarAlumno: mocks.servicio,
}));

const rutas = [
  ["impacto-baja", (await import("@/app/api/alumnos/[id]/impacto-baja/route")).GET, undefined],
  ["desactivar", (await import("@/app/api/alumnos/[id]/desactivar/route")).POST, { version: 0 }],
  ["reactivar", (await import("@/app/api/alumnos/[id]/reactivar/route")).POST, { version: 1 }],
] as const;

async function llamar(ruta: typeof rutas[number], cuerpo: unknown = ruta[2]) {
  return (ruta[1] as unknown as (req: NextRequest, ctx: unknown) => Promise<Response>)(
    new NextRequest(`http://localhost/api/alumnos/id/${ruta[0]}`, cuerpo === undefined ? undefined : { method: "POST", body: JSON.stringify(cuerpo) }),
    { params: Promise.resolve({ id: "alumno" }) },
  );
}

beforeEach(() => mocks.servicio.mockReset().mockResolvedValue({ ok: true }));

describe("HU-B-07 rutas delgadas", () => {
  it.each(rutas)("%s usa permiso, envelope y actor", async (...ruta) => {
    const respuesta = await llamar(ruta);
    expect(mocks.permiso).toHaveBeenCalledWith("alumnos:cambiar_estado");
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: { ok: true }, error: null });
    if (ruta[2]) expect(mocks.servicio.mock.calls[0][2]).toEqual({ tipo: "USUARIO", usuarioId: "actor" });
  });

  it.each(rutas.filter((ruta) => ruta[2]))("%s rechaza payload inválido", async (...ruta) => {
    expect((await llamar(ruta, {})).status).toBe(400);
    expect(mocks.servicio).not.toHaveBeenCalled();
  });
});
