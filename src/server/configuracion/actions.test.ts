import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ permiso: vi.fn(), guardar: vi.fn(), revalidar: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidar }));
vi.mock("@/server/shared/with-permission", () => ({ verificarPermiso: m.permiso, PermisoError: class extends Error {} }));
vi.mock("@/server/configuracion/configuracion.service", () => ({ guardarConfiguracion: m.guardar }));
const { guardarConfiguracion } = await import("@/server/configuracion/actions");
const valores = { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 };
const input = { valores: { ...valores, umbralPresentismo: 80 }, esperados: valores };

beforeEach(() => { vi.clearAllMocks(); m.permiso.mockResolvedValue({ id: "g1" }); m.guardar.mockResolvedValue({ cambios: ["umbral_presentismo"] }); });

describe("action de configuración", () => {
  it("valida, verifica permiso y revalida solo si hubo cambios", async () => {
    expect(await guardarConfiguracion(input)).toEqual({ data: { cambios: ["umbral_presentismo"] }, error: null });
    expect(m.permiso).toHaveBeenCalledWith("configuracion:editar");
    expect(m.guardar).toHaveBeenCalledWith(input, { usuarioId: "g1" });
    expect(m.revalidar).toHaveBeenCalledWith("/configuracion");
    m.guardar.mockResolvedValueOnce({ cambios: [] });
    m.revalidar.mockClear();
    await guardarConfiguracion({ valores, esperados: valores });
    expect(m.revalidar).not.toHaveBeenCalled();
  });
  it("un dato inválido no llega al servicio", async () => {
    const resultado = await guardarConfiguracion({ ...input, valores: { ...input.valores, umbralPresentismo: 80.5 } });
    expect(resultado.error?.code).toBe("VALIDATION_ERROR");
    expect(m.guardar).not.toHaveBeenCalled();
  });
});
