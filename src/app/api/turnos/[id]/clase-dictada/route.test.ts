import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
const m = vi.hoisted(() => ({ registrar: vi.fn(), leer: vi.fn(), rol: "MESA_ENTRADA", permisos: [] as string[] }));
vi.mock("@/server/historial/clase-dictada.service", () => ({ registrarClaseDictadaDesdeSolicitud: m.registrar, obtenerRegistroClaseDictada: m.leer }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
  m.permisos.push(permiso);
  return (req: NextRequest, ctx: { params: Promise<unknown> }) => permiso === "clases:registrar" && !["MESA_ENTRADA", "PROFESOR"].includes(m.rol)
    ? NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 })
    : handler(Object.assign(req, { auth: { user: { id: "usuario-1", rol: m.rol } } }), ctx);
} }));
const { POST, GET } = await import("./route");
const consultar = (body?: string) => POST(new NextRequest("http://localhost/api/turnos/seed-turno-01/clase-dictada", { method: "POST", body }), { params: Promise.resolve({ id: "seed-turno-01" }) });
beforeEach(() => { vi.clearAllMocks(); m.rol = "MESA_ENTRADA"; m.registrar.mockResolvedValue({ id: "clase", ya_existia: false }); });
describe("HU-E-09 Route Handlers", () => {
  it("mantiene los permisos originales", () => expect(m.permisos).toEqual(["clases:registrar", "historial:leer"]));
  it("body vacío conserva la llamada sin selección y responde 201", async () => {
    const r = await consultar(); expect(r.status).toBe(201); expect(m.registrar).toHaveBeenCalledWith("seed-turno-01", { id: "usuario-1", rol: "MESA_ENTRADA" }, undefined);
    expect(await r.json()).toEqual({ data: { id: "clase", ya_existia: false }, error: null });
  });
  it("traduce cuerpo normalizado y registro existente a 200", async () => {
    m.registrar.mockResolvedValue({ id: "clase", ya_existia: true });
    expect((await consultar(JSON.stringify({ asistencias: [{ alumno_id: " a ", estado: "AUSENTE" }] }))).status).toBe(200);
    expect(m.registrar.mock.calls[0][2]).toEqual([{ alumno_id: "a", estado: "AUSENTE" }]);
  });
  it.each(["{", " ", "null", "{}", '{"asistencias":[],"otro":true}'])("rechaza body inválido sin servicio", async (body) => {
    expect((await consultar(body)).status).toBe(400); expect(m.registrar).not.toHaveBeenCalled();
  });
  it.each([["ASISTENCIA_INCOMPLETA", 400], ["TRANSACCION_OCUPADA", 409], ["SIN_PERMISO", 403], ["CLASE_NO_FINALIZADA", 409], ["TURNO_NO_ENCONTRADO", 404]])("mapea %s y detalles", async (code, status) => {
    m.registrar.mockRejectedValue(new ServiceError(code as string, "Error", { faltan: ["a"] }));
    const r = await consultar(); expect(r.status).toBe(status); expect((await r.json()).error.detalles).toEqual({ faltan: ["a"] });
  });
  it.each(["GERENTE", "ALUMNO"])("deniega escritura de %s", async (rol) => { m.rol = rol; expect((await consultar()).status).toBe(403); expect(m.registrar).not.toHaveBeenCalled(); });
  it("GET conserva el sobre", async () => {
    m.leer.mockResolvedValue({ id: "clase", alumnos: [], con_control_asistencia: true, totales: { presentes: 0, ausentes: 0 } });
    const r = await GET(new NextRequest("http://localhost/api/turnos/t/clase-dictada"), { params: Promise.resolve({ id: "t" }) });
    expect(r.status).toBe(200); expect((await r.json()).error).toBeNull();
  });
});
