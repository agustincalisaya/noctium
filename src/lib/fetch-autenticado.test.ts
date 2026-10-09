import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOLanzar } from "./fetch-autenticado";

const respuesta = (status: number, json: () => Promise<unknown>) => ({ ok: status >= 200 && status < 300, status, json }) as Response;

afterEach(() => { vi.unstubAllGlobals(); });

describe("HU-C-25 fetchOLanzar", () => {
  it("con response.ok devuelve result.data", async () => {
    const fetch = vi.fn().mockResolvedValue(respuesta(201, async () => ({ data: { id: "pago-1" }, error: null })));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchOLanzar("/api/pagos", { method: "POST" })).resolves.toEqual({ id: "pago-1" });
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/pagos", { method: "POST" });
  });

  it("con error y cuerpo { error: { message } } lanza Error(message)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(422, async () => ({
      data: null, error: { code: "RESERVA_VENCIDA", message: "La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo." },
    }))));
    await expect(fetchOLanzar("/api/pagos")).rejects.toThrow(new Error("La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo."));
  });

  it("con error y cuerpo no parseable lanza el mensaje genérico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(500, async () => { throw new SyntaxError("Unexpected token <"); })));
    await expect(fetchOLanzar("/api/pagos")).rejects.toThrow(new Error("No se pudo completar la acción. Intentá nuevamente."));
  });
});
