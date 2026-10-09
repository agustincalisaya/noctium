import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";

const m = vi.hoisted(() => ({ registrar: vi.fn(), transaccion: vi.fn(), rol: "MESA_ENTRADA", permisos: [] as string[] }));
vi.mock("@/server/historial/observacion-clase.service", () => ({ registrarObservacionClase: m.registrar }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: object) => unknown) => { m.transaccion(); return fn({}); } }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
    m.permisos.push(permiso);
    return (req: NextRequest, ctx: { params: Promise<unknown> }) => {
      if (permiso === "observaciones:registrar" && !["MESA_ENTRADA", "PROFESOR"].includes(m.rol)) {
        return NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 });
      }
      return handler(Object.assign(req, { auth: { user: { id: "usuario-1", rol: m.rol } } }), ctx);
    };
  },
}));

const { POST } = await import("./route");
const solicitar = (body: string) => POST(new NextRequest("http://localhost/api/turnos/turno-1/clase-dictada/observaciones", { method: "POST", body }), { params: Promise.resolve({ id: "turno-1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  m.rol = "MESA_ENTRADA";
  m.registrar.mockResolvedValue({ id: "obs-1", clase_dictada_id: "clase-1", temas_vistos: "Álgebra", observaciones_internas: null, registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local" });
});

describe("HU-E-07 Route Handler", () => {
  it("usa el permiso específico de escritura", async () => {
    expect(m.permisos).toEqual(["observaciones:registrar"]);
  });

  it("normaliza el contenido y responde 201 en el sobre contractual", async () => {
    const response = await solicitar(JSON.stringify({ temas_vistos: "  Álgebra  ", observaciones_internas: "  " }));
    expect(response.status).toBe(201);
    expect(m.registrar).toHaveBeenCalledWith({}, "turno-1", { temas_vistos: "Álgebra", observaciones_internas: "" }, { id: "usuario-1", rol: "MESA_ENTRADA" });
    expect(await response.json()).toMatchObject({ data: { id: "obs-1", temas_vistos: "Álgebra" }, error: null });
  });

  it.each(["{", "null", "{}", JSON.stringify({ temas_vistos: " ".repeat(5) }), JSON.stringify({ temas_vistos: "x", extra: true })])(
    "rechaza cuerpo inválido antes del servicio (%s)", async (body) => {
      expect((await solicitar(body)).status).toBe(400);
      expect(m.registrar).not.toHaveBeenCalled();
    },
  );

  it("mapea permiso, clase ausente, duplicado y transacción ocupada", async () => {
    m.registrar.mockRejectedValueOnce(new ServiceError("SIN_PERMISO", "No tenés permisos"));
    expect((await solicitar(JSON.stringify({ temas_vistos: "Álgebra" }))).status).toBe(403);
    m.registrar.mockRejectedValueOnce(new ServiceError("CLASE_NO_REGISTRADA", "No hay clase dictada"));
    expect((await solicitar(JSON.stringify({ temas_vistos: "Álgebra" }))).status).toBe(404);
    m.registrar.mockRejectedValueOnce(new ErrorDeDominio("errores.observaciones.yaRegistradas"));
    expect((await solicitar(JSON.stringify({ temas_vistos: "Álgebra" }))).status).toBe(409);
    m.registrar.mockRejectedValueOnce(new ErrorDeDominio("errores.transaccion.ocupada"));
    expect((await solicitar(JSON.stringify({ temas_vistos: "Álgebra" }))).status).toBe(409);
  });

  it("deniega gerente y alumno en RBAC antes del servicio", async () => {
    for (const rol of ["GERENTE", "ALUMNO"]) {
      m.rol = rol;
      expect((await solicitar(JSON.stringify({ temas_vistos: "Álgebra" }))).status).toBe(403);
    }
    expect(m.registrar).not.toHaveBeenCalled();
  });
});
