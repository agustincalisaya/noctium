import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
const m = vi.hoisted(() => ({ servicio: vi.fn(), permiso: "", rol: "ALUMNO" }));
vi.mock("@/server/historial/historial.service", () => ({ obtenerMiHistorial: m.servicio }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, fn: (req: NextRequest) => Promise<Response>) => {
  m.permiso = permiso;
  return (req: NextRequest) => m.rol !== "ALUMNO" ? Promise.resolve(NextResponse.json({ data: null, error: { code: "SIN_PERMISO" } }, { status: 403 })) : fn(Object.assign(req, { auth: { user: { id: "u", rol: m.rol } } }));
} }));
import { GET } from "./route";
const pedir = (query = "") => GET(new NextRequest(`http://localhost/api/mi-historial${query}`), { params: Promise.resolve({}) });
beforeEach(() => { vi.clearAllMocks(); m.rol = "ALUMNO"; m.servicio.mockResolvedValue({ items: [] }); });
describe("E08 GET propio", () => {
  it("permiso, sesión, defaults y respuesta no cacheable", async () => {
    expect(m.permiso).toBe("historial:leer_propio");
    const r = await pedir(); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("no-store");
    expect(m.servicio).toHaveBeenCalledWith({ pagina: 1, por_pagina: 10 }, { id: "u", rol: "ALUMNO" });
    expect(await r.json()).toEqual({ data: { items: [] }, error: null });
  });
  it.each(["?alumno_id=otro&pagina=0", "?alumnoId=otro", "?alumno_id="])("ID ajeno se rechaza antes de validar %s", async query => {
    expect((await pedir(query)).status).toBe(403); expect(m.servicio).not.toHaveBeenCalled();
  });
  it.each(["?pagina=0", "?por_pagina=11", "?materia_id=", "?desconocido=x", "?pagina=1.5"])("validación %s", async query => {
    expect((await pedir(query)).status).toBe(400); expect(m.servicio).not.toHaveBeenCalled();
  });
  it.each(["MESA_ENTRADA", "GERENTE", "PROFESOR"])("rol %s", async rol => { m.rol = rol; expect((await pedir()).status).toBe(403); });
  it("sin ficha 403", async () => { m.servicio.mockRejectedValue(new ServiceError("SIN_PERMISO", "Sin ficha")); expect((await pedir()).status).toBe(403); });
  it("filtro y página válidos", async () => { await pedir("?materia_id=m&pagina=2"); expect(m.servicio).toHaveBeenCalledWith({ materia_id: "m", pagina: 2, por_pagina: 10 }, expect.anything()); });
});
