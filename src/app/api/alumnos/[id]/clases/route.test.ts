import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
const m = vi.hoisted(() => ({ servicio: vi.fn(), permiso: "", rol: "MESA_ENTRADA" }));
vi.mock("@/server/historial/clases-alumno.service", () => ({ listarClasesDelAlumno: m.servicio }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (p: string, fn: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => { m.permiso = p; return (req: NextRequest, ctx: { params: Promise<unknown> }) => fn(Object.assign(req,{auth:{user:{id:"u",rol:m.rol}}}),ctx); } }));
import { GET } from "./route";
const pedir = (q = "") => GET(new NextRequest(`http://localhost/api/alumnos/a/clases${q}`), { params: Promise.resolve({id:"a"}) });
beforeEach(() => { vi.clearAllMocks(); m.rol="MESA_ENTRADA"; m.servicio.mockResolvedValue({items:[]}); });
describe("E02 API", () => {
  it.each(["MESA_ENTRADA","GERENTE"])("rol %s 200",async rol=>{m.rol=rol;const r=await pedir();expect(r.status).toBe(200);expect(m.permiso).toBe("alumnos:leer");expect(m.servicio).toHaveBeenCalledWith("a",{pagina:1,por_pagina:10},{id:"u",rol});});
  it.each(["PROFESOR","ALUMNO"])("rol %s denegado incluso con guarda permisiva",async rol=>{m.rol=rol;expect((await pedir()).status).toBe(403);expect(m.servicio).not.toHaveBeenCalled();});
  it.each(["?desde=2026-02-30","?desde=2026-10-10&hasta=2026-10-09","?resultado=otro","?por_pagina=11","?pagina=0","?otro=x"])("validación %s",async q=>{expect((await pedir(q)).status).toBe(400);expect(m.servicio).not.toHaveBeenCalled();});
  it("fechas transformadas y combinadas",async()=>{await pedir("?desde=2026-10-09&hasta=2026-10-09&resultado=ASISTIO&pagina=2");expect(m.servicio).toHaveBeenCalledWith("a",{desde:new Date("2026-10-09Z"),hasta:new Date("2026-10-09Z"),resultado:"ASISTIO",pagina:2,por_pagina:10},expect.anything());});
  it.each([["ALUMNO_NO_ENCONTRADO",404],["SIN_PERMISO",403]] as const)("error %s",async(code,status)=>{m.servicio.mockRejectedValue(new ServiceError(code,"Error"));expect((await pedir()).status).toBe(status);});
});
