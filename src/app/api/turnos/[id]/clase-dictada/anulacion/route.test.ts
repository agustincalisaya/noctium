import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
const m = vi.hoisted(() => ({ servicio: vi.fn(), permiso: "", rol: "MESA_ENTRADA" }));
vi.mock("@/server/historial/clase-dictada.service", () => ({ anularClaseDictada: m.servicio }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, fn: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
 m.permiso = permiso;
 return (req: NextRequest, ctx: { params: Promise<unknown> }) => !["PROFESOR", "MESA_ENTRADA"].includes(m.rol) ? Promise.resolve(NextResponse.json({ data: null, error: { code: "SIN_PERMISO" } }, { status: 403 })) : fn(Object.assign(req, { auth: { user: { id: "u", rol: m.rol } } }), ctx);
} }));
import { POST } from "./route";
const body = { motivo: "Error",  };
const pedir = (value: string) => POST(new NextRequest("http://localhost/api/turnos/t/clase-dictada/anulacion", { method: "POST", body: value }), { params: Promise.resolve({ id: "t" }) });
beforeEach(() => { vi.clearAllMocks(); m.rol = "MESA_ENTRADA"; m.servicio.mockResolvedValue({ id: "cd" }); });
describe("E11 anulacion", () => {
 it("permiso y éxito", async () => { expect(m.permiso).toBe("clases:corregir"); const r = await pedir(JSON.stringify(body)); expect(r.status).toBe(200); expect(await r.json()).toEqual({ data: { id: "cd" }, error: null }); });
 it.each(["null", "{", "{}", JSON.stringify({ ...body, motivo: " " }), JSON.stringify({ ...body, otro: true })])("validación %s", async value => { expect((await pedir(value)).status).toBe(400); expect(m.servicio).not.toHaveBeenCalled(); });
 it.each(["GERENTE", "ALUMNO"])("rol %s", async rol => { m.rol = rol; expect((await pedir(JSON.stringify(body))).status).toBe(403); expect(m.servicio).not.toHaveBeenCalled(); });
 it("mapea dominio, permiso e inexistencia", async () => {
 for (const error of [new ErrorDeDominio("errores.correccion.plazoVencido"), new ErrorDeDominio("errores.asistencia.sinCambios"), new ErrorDeDominio("errores.transaccion.ocupada"), new ServiceError("CLASE_NO_REGISTRADA", "No registrada")]) {
 m.servicio.mockRejectedValue(error); const r = await pedir(JSON.stringify(body)); expect(r.status).toBe(error instanceof ErrorDeDominio ? error.status : 404); expect((await r.json()).error.code).toBe(error.code);
 }
 });
});
