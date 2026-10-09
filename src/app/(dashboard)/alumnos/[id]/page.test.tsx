import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), detalle: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({ verificarPermiso: mocks.permiso, PermisoError: class extends Error {} }));
vi.mock("@/server/alumnos/alumno.service", () => ({ obtenerDetalleAlumno: mocks.detalle }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("./historial-academico", () => ({ HistorialAcademico: ({ materiaInicial }: { materiaInicial?: string }) => <div data-materia={materiaInicial ?? ""} /> }));
vi.mock("./ficha-encabezado", () => ({ FichaEncabezado: () => null }));
vi.mock("./ficha-contacto", () => ({ FichaContacto: () => null }));
vi.mock("./ficha-alta-pago", () => ({ FichaAltaPago: () => null }));
import Page from "./page";
import { redirect } from "next/navigation";
beforeEach(() => { vi.clearAllMocks(); vi.mocked(redirect).mockImplementation(() => { throw new Error("REDIRECT"); }); });
describe("Enlace de H07 al historial", () => {
  it("propaga materia de query sin modificar la verificación de permisos", async () => {
    mocks.permiso.mockResolvedValue({ id: "u", rol: "MESA_ENTRADA" }); mocks.detalle.mockResolvedValue({ id: "a", nombre: "Ana", apellido: "Pérez", is_active: true });
    const tree = await Page({ params: Promise.resolve({ id: "a" }), searchParams: Promise.resolve({ tab: "historial", materia_id: "fisica" }) });
    expect(renderToStaticMarkup(tree)).toContain('data-materia="fisica"');
    expect(mocks.permiso.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining(["alumnos:leer", "historial:leer", "alumnos:editar", "examenes:registrar"]));
  });
});

describe("E02 acceso a ficha", () => {
  it("profesor no lee ficha aunque conserve permiso de historial", async () => {
    mocks.permiso.mockResolvedValue({ id: "p", rol: "PROFESOR" });
    await expect(Page({ params: Promise.resolve({ id: "a" }), searchParams: Promise.resolve({ tab: "clases" }) })).rejects.toThrow("REDIRECT");
    expect(mocks.detalle).not.toHaveBeenCalled();
  });
  it("gerente tiene pestaña clases y aviso de consulta", async () => {
    mocks.permiso.mockResolvedValue({ id: "g", rol: "GERENTE" }); mocks.detalle.mockResolvedValue({ id: "a", nombre: "Ana", apellido: "Pérez", is_active: true });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "a" }), searchParams: Promise.resolve({ tab: "clases" }) }));
    expect(html).toContain("Modo consulta"); expect(html).toContain('href="/alumnos/a/clases"'); expect(html).toContain("Clases"); expect(html).not.toContain("Modificar datos");
  });
});
