import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";

const m = vi.hoisted(() => ({ registrar: vi.fn(), transaccion: vi.fn(), rol: "MESA_ENTRADA", permisos: [] as string[] }));
vi.mock("@/server/historial/indicacion.service", () => ({ registrarIndicacion: m.registrar }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: object) => unknown) => { m.transaccion(); return fn({}); } }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    m.permisos.push(permiso);
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => {
      if (permiso === "indicaciones:registrar" && !["MESA_ENTRADA", "PROFESOR"].includes(m.rol)) {
        return NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
      }
      return handler(Object.assign(req, { auth: { user: { id: "usuario-1", rol: m.rol } } }), ctx);
    };
  },
}));

const { POST } = await import("./route");
const solicitar = (body: string) => POST(new NextRequest("http://localhost/api/alumnos/alumno-1/indicaciones", { method: "POST", body }), { params: Promise.resolve({ id: "alumno-1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  m.rol = "MESA_ENTRADA";
  m.registrar.mockResolvedValue({ id: "indicacion-1", alumno_id: "alumno-1", materia_id: "materia-1", indicacion: "Repasar", clase_dictada_id: null, registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local" });
});

describe("HU-E-04 Route Handler", () => {
  it("usa el permiso específico y responde 201 con el sobre contractual", async () => {
    expect(m.permisos).toEqual(["indicaciones:registrar"]);
    const response = await solicitar(JSON.stringify({ materia_id: " materia-1 ", indicacion: " Repasar " }));
    expect(response.status).toBe(201);
    expect(m.registrar).toHaveBeenCalledWith({}, "alumno-1", { materia_id: "materia-1", indicacion: "Repasar" }, { id: "usuario-1", rol: "MESA_ENTRADA" });
    expect(await response.json()).toMatchObject({ data: { id: "indicacion-1", clase_dictada_id: null }, error: null });
  });

  it.each(["{", "null", "{}", JSON.stringify({ materia_id: "m", indicacion: "   " }), JSON.stringify({ materia_id: "m", indicacion: "x", extra: true })])(
    "rechaza el cuerpo inválido antes del servicio (%s)", async (body) => {
      expect((await solicitar(body)).status).toBe(400);
      expect(m.registrar).not.toHaveBeenCalled();
    },
  );

  it("mapea alcance, alumno, materia y clase a sus códigos HTTP", async () => {
    m.registrar.mockRejectedValueOnce(new ServiceError("SIN_PERMISO", "Fuera de alcance"));
    expect((await solicitar(JSON.stringify({ materia_id: "m", indicacion: "Repasar" }))).status).toBe(403);
    m.registrar.mockRejectedValueOnce(new ServiceError("ALUMNO_NO_ENCONTRADO", "No existe"));
    expect((await solicitar(JSON.stringify({ materia_id: "m", indicacion: "Repasar" }))).status).toBe(404);
    m.registrar.mockRejectedValueOnce(new ErrorDeDominio("errores.examen.materiaNoCursada"));
    expect((await solicitar(JSON.stringify({ materia_id: "m", indicacion: "Repasar" }))).status).toBe(409);
    m.registrar.mockRejectedValueOnce(new ErrorDeDominio("errores.claseDictada.noEncontrada"));
    expect((await solicitar(JSON.stringify({ materia_id: "m", indicacion: "Repasar" }))).status).toBe(404);
    m.registrar.mockRejectedValueOnce(new ErrorDeDominio("errores.claseDictada.noCorresponde"));
    expect((await solicitar(JSON.stringify({ materia_id: "m", indicacion: "Repasar" }))).status).toBe(409);
  });

  it("deniega gerente y alumno en RBAC antes del servicio", async () => {
    for (const rol of ["GERENTE", "ALUMNO"]) {
      m.rol = rol;
      expect((await solicitar(JSON.stringify({ materia_id: "m", indicacion: "Repasar" }))).status).toBe(403);
    }
    expect(m.registrar).not.toHaveBeenCalled();
  });
});
