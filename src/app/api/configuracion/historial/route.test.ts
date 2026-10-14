import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock("@/server/configuracion/configuracion.service", () => ({ listarHistorialConfiguracion: m.listar }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (_: string, handler: (req: unknown) => Promise<Response>) => handler }));
const { GET } = await import("@/app/api/configuracion/historial/route");
const req = (url: string) => ({ nextUrl: new URL(url) });

beforeEach(() => { vi.clearAllMocks(); m.listar.mockResolvedValue({ items: [], pagina: 1, por_pagina: 10, total: 0, total_paginas: 0 }); });

describe("/api/configuracion/historial", () => {
  it("usa página 1 por defecto y devuelve envelope", async () => {
    const respuesta = await GET(req("http://localhost/api/configuracion/historial") as never);
    expect(respuesta.status).toBe(200);
    expect(m.listar).toHaveBeenCalledWith({ pagina: 1 });
    expect((await respuesta.json()).data.items).toEqual([]);
  });
  it("rechaza página inválida y query ajena, incluso vacía", async () => {
    for (const query of ["?pagina=0", "?pagina=1.5", "?foo="]) {
      const respuesta = await GET(req(`http://localhost/api/configuracion/historial${query}`) as never);
      expect(respuesta.status).toBe(400);
    }
    expect(m.listar).not.toHaveBeenCalled();
  });
});
