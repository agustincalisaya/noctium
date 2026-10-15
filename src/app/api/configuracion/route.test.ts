import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

const m = vi.hoisted(() => ({ leer: vi.fn(), guardar: vi.fn(), concedidos: new Set<string>() }));
vi.mock("@/server/configuracion/configuracion.service", () => ({ obtenerConfiguracion: m.leer, guardarConfiguracion: m.guardar }));
// Cada handler queda envuelto con su permiso: sin él, 403 sin llegar al handler.
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, handler: (req: unknown) => Promise<Response>) =>
  (req: unknown) => m.concedidos.has(permiso) ? handler(req) : Response.json({ data: null, error: { code: "SIN_PERMISO" } }, { status: 403 }) }));

const { GET, PUT } = await import("@/app/api/configuracion/route");
const request = (body: unknown) => ({ json: async () => body, auth: { user: { id: "gerente-1" } } });
const valores = { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 };
const payload = { valores: { ...valores, plazoPagoHoras: 48 }, esperados: valores };

beforeEach(() => { vi.clearAllMocks(); m.concedidos = new Set(["configuracion:leer", "configuracion:editar"]); m.leer.mockResolvedValue({ parametros: [] }); m.guardar.mockResolvedValue({ cambios: ["plazo_pago_horas"] }); });

describe("/api/configuracion", () => {
  it("GET exige configuracion:leer y PUT configuracion:editar; sin permiso, 403 sin llamar al servicio", async () => {
    m.concedidos = new Set(["configuracion:leer"]);
    expect((await GET(request(null) as never)).status).toBe(200);
    const sinEditar = await PUT(request(payload) as never);
    expect(sinEditar.status).toBe(403);
    expect((await sinEditar.json()).error.code).toBe("SIN_PERMISO");
    expect(m.guardar).not.toHaveBeenCalled();
    m.concedidos = new Set(["configuracion:editar"]);
    expect((await GET(request(null) as never)).status).toBe(403);
    expect(m.leer).toHaveBeenCalledTimes(1);
  });

  it("GET devuelve envelope sin caché por el wrapper de permisos", async () => {
    const respuesta = await GET(request(null) as never);
    expect(await respuesta.json()).toEqual({ data: { parametros: [] }, error: null });
  });

  it("PUT acepta solo payload estricto y pasa actor al servicio", async () => {
    const respuesta = await PUT(request(payload) as never);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: { cambios: ["plazo_pago_horas"] }, error: null });
    expect(m.guardar).toHaveBeenCalledWith(payload, { usuarioId: "gerente-1" });
  });

  it("rechaza decimal, claves ajenas y esperados faltantes con 400 y ruta de campo", async () => {
    for (const invalido of [
      { ...payload, valores: { ...payload.valores, plazoPagoHoras: 1.5 } },
      { ...payload, valores: { ...payload.valores, centro_nombre: "otro" } },
      { valores },
    ]) {
      const respuesta = await PUT(request(invalido) as never);
      expect(respuesta.status).toBe(400);
      expect((await respuesta.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(m.guardar).not.toHaveBeenCalled();
  });

  it("conflicto responde 409; error inesperado no expone detalles", async () => {
    m.guardar.mockRejectedValueOnce(new ErrorDeDominio("errores.configuracion.conflicto"));
    const conflicto = await PUT(request(payload) as never);
    expect(conflicto.status).toBe(409);
    expect((await conflicto.json()).error.code).toBe("CONFLICTO_EDICION_CONCURRENTE");
    m.guardar.mockRejectedValueOnce(new Error("secreto de DB"));
    const interno = await PUT(request(payload) as never);
    expect(interno.status).toBe(500);
    expect(JSON.stringify(await interno.json())).not.toContain("secreto de DB");
  });
});
