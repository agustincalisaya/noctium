import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Página «Registrar pago» (HU-I-10, criterio 9: solo mesa de entrada registra
// pagos; bug B-2 del PO). El permiso y el wizard (componente de cliente)
// están simulados.

const m = vi.hoisted(() => ({ exigir: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: m.exigir }));
vi.mock("./registrar-pago-wizard", () => ({
  RegistrarPagoWizard: ({ alumnoInicialId, claseInicialId }: { alumnoInicialId?: string; claseInicialId?: string }) => (
    <section data-wizard data-alumno={alumnoInicialId ?? ""} data-clase={claseInicialId ?? ""} />
  ),
}));

const { default: RegistrarPago } = await import("./page");

const props = (parametros: Record<string, string | string[] | undefined>) => ({ searchParams: Promise.resolve(parametros) });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigir.mockResolvedValue({ id: "u1", rol: "MESA_ENTRADA" });
});

describe("/pagos/registrar", () => {
  it("exige pagos:crear y muestra el wizard sin preelección", async () => {
    const html = renderToStaticMarkup(await RegistrarPago(props({})));
    expect(m.exigir).toHaveBeenCalledWith("pagos:crear");
    expect(html).toContain('data-alumno=""');
    expect(html).toContain('data-clase=""');
  });

  it("pasa alumno y clase de los searchParams", async () => {
    const html = renderToStaticMarkup(await RegistrarPago(props({ alumno: " alumno-1 ", clase: "turno-1" })));
    expect(html).toContain('data-alumno="alumno-1"');
    expect(html).toContain('data-clase="turno-1"');
  });

  it("ignora la clase si no hay alumno", async () => {
    const html = renderToStaticMarkup(await RegistrarPago(props({ clase: "turno-1" })));
    expect(html).toContain('data-alumno=""');
    expect(html).toContain('data-clase=""');
  });

  it("sin permiso no renderiza el wizard (exigirPermiso redirige)", async () => {
    m.exigir.mockRejectedValue(new Error("REDIRECT:/sin-permiso"));
    await expect(RegistrarPago(props({ alumno: "alumno-1" }))).rejects.toThrow("REDIRECT:/sin-permiso");
  });
});
