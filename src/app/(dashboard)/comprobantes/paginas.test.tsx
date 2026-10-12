import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Páginas del comprobante (HU-I-11, spec_modulo_I.md §2.9.3): la de mesa de
// entrada/gerente (`/comprobantes/[id]`) y la del alumno
// (`/mis-pagos/[id]/comprobante`, el `[id]` es el del pago). El permiso, la
// lectura y la tarjeta (componente de cliente) están simulados.

const m = vi.hoisted(() => ({
  exigir: vi.fn(),
  leer: vi.fn(),
  leerDeAlumno: vi.fn(),
  delPago: vi.fn(),
  alumnoDeUsuario: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: m.exigir }));
vi.mock("@/server/pagos/comprobante.lectura", () => ({
  leerComprobante: m.leer, leerComprobanteDeAlumno: m.leerDeAlumno, comprobanteDelPago: m.delPago,
}));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: m.alumnoDeUsuario }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (destino: string) => { throw new Error(`REDIRECT:${destino}`); },
}));
vi.mock("@/components/pagos/comprobante-card", () => ({
  ComprobanteCard: ({ comprobante }: { comprobante: { id: string } }) => <section data-comprobante={comprobante.id} />,
}));

import { ErrorDeDominio } from "@/server/shared/error-dominio";
const { default: Comprobante } = await import("./[id]/page");
const { default: MiComprobante } = await import("../mis-pagos/[id]/comprobante/page");

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigir.mockResolvedValue({ id: "u1", rol: "MESA_ENTRADA" });
});

describe("/comprobantes/[id]", () => {
  it("exige comprobantes:leer y muestra la vista completa", async () => {
    m.leer.mockResolvedValue({ id: "comp-1" });
    const html = renderToStaticMarkup(await Comprobante(params("comp-1")));
    expect(m.exigir).toHaveBeenCalledWith("comprobantes:leer");
    expect(m.leer).toHaveBeenCalledWith(expect.anything(), "comp-1");
    expect(html).toContain('data-comprobante="comp-1"');
  });

  it("inexistente → notFound()", async () => {
    m.leer.mockResolvedValue(null);
    await expect(Comprobante(params("nada"))).rejects.toThrow("NOT_FOUND");
  });

  it("sin permiso no lee nada (exigirPermiso redirige)", async () => {
    m.exigir.mockRejectedValue(new Error("REDIRECT:/sin-permiso"));
    await expect(Comprobante(params("comp-1"))).rejects.toThrow("REDIRECT:/sin-permiso");
    expect(m.leer).not.toHaveBeenCalled();
  });
});

describe("/mis-pagos/[id]/comprobante", () => {
  beforeEach(() => {
    m.exigir.mockResolvedValue({ id: "u-alumno", rol: "ALUMNO" });
    m.alumnoDeUsuario.mockResolvedValue({ id: "alumno-1", activo: true });
    m.delPago.mockResolvedValue({ id: "comp-1", numero: "0001-00000001" });
  });

  it("exige comprobantes:leer_propios y muestra la vista del alumno del pago", async () => {
    m.leerDeAlumno.mockResolvedValue({ id: "comp-1" });
    const html = renderToStaticMarkup(await MiComprobante(params("pago-1")));
    expect(m.exigir).toHaveBeenCalledWith("comprobantes:leer_propios");
    expect(m.alumnoDeUsuario).toHaveBeenCalledWith("u-alumno");
    expect(m.delPago).toHaveBeenCalledWith(expect.anything(), "pago-1");
    expect(m.leerDeAlumno).toHaveBeenCalledWith(expect.anything(), "comp-1", "alumno-1");
    expect(html).toContain('data-comprobante="comp-1"');
  });

  it("pago de otro alumno → /sin-permiso", async () => {
    m.leerDeAlumno.mockRejectedValue(new ErrorDeDominio("errores.pago.fueraDeAlcance"));
    await expect(MiComprobante(params("pago-ajeno"))).rejects.toThrow("REDIRECT:/sin-permiso");
  });

  it("cuenta sin ficha de alumno → /sin-permiso", async () => {
    m.alumnoDeUsuario.mockResolvedValue(null);
    await expect(MiComprobante(params("pago-1"))).rejects.toThrow("REDIRECT:/sin-permiso");
    expect(m.delPago).not.toHaveBeenCalled();
  });

  it("pago inexistente → notFound()", async () => {
    m.delPago.mockRejectedValue(new ErrorDeDominio("errores.pago.noEncontrado"));
    await expect(MiComprobante(params("nada"))).rejects.toThrow("NOT_FOUND");
  });
});
