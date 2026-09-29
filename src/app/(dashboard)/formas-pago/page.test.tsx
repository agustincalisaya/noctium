import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-I-03: el guard de la página es la protección real (Regla N.° 10).

const { verificarPermiso, redirect, PermisoError } = vi.hoisted(() => ({
  verificarPermiso: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
  PermisoError: class PermisoError extends Error {},
}));
vi.mock("@/server/shared/with-permission", () => ({ verificarPermiso, PermisoError }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/server/pagos/forma-pago.service", () => ({ listarFormasPago: vi.fn() }));

const { default: FormasPagoPage } = await import("./page");

const buscar = (pagina?: string) => ({ searchParams: Promise.resolve({ pagina }) });

beforeEach(() => vi.clearAllMocks());

describe("/formas-pago (guard)", () => {
  it("exige formas_pago:crear", async () => {
    verificarPermiso.mockResolvedValue({ id: "u1", rol: "GERENTE" });

    await FormasPagoPage(buscar());

    expect(verificarPermiso).toHaveBeenCalledExactlyOnceWith("formas_pago:crear");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirige a /home a un rol sin permiso (Mesa de Entrada abriendo la URL a mano)", async () => {
    verificarPermiso.mockRejectedValue(new PermisoError("sin permiso"));

    await expect(FormasPagoPage(buscar())).rejects.toThrow("NEXT_REDIRECT:/home");
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/home");
  });

  it("relanza los errores que no son de permiso", async () => {
    verificarPermiso.mockRejectedValue(new Error("base caída"));

    await expect(FormasPagoPage(buscar())).rejects.toThrow("base caída");
    expect(redirect).not.toHaveBeenCalled();
  });
});
