import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ permiso: vi.fn(), detalle: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({ verificarPermiso: mocks.permiso, PermisoError: class extends Error {} }));
vi.mock("@/server/alumnos/alumno.service", () => ({ obtenerDetalleAlumno: mocks.detalle, obtenerCuentaDeAlumno: vi.fn() }));
vi.mock("@/server/alumnos/alumno.estado.service", () => ({ obtenerHistorialEstadosAlumno: vi.fn().mockResolvedValue([]) }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("./historial-academico", () => ({ HistorialAcademico: ({ materiaInicial }: { materiaInicial?: string }) => <div data-materia={materiaInicial ?? ""} /> }));
// La cabecera simulada solo expone la acción que recibe, para comprobar dónde se ubica el cambio de estado.
vi.mock("./ficha-encabezado", () => ({ FichaEncabezado: ({ accion }: { accion?: React.ReactNode }) => <header data-ficha-encabezado="">{accion}</header> }));
vi.mock("./ficha-contacto", () => ({ FichaContacto: () => null }));
vi.mock("./ficha-alta-pago", () => ({ FichaAltaPago: () => null }));
vi.mock("./estado-alumno-dialog", () => ({ EstadoAlumnoDialog: () => <button data-estado-alumno="">estado</button> }));
vi.mock("./historial-estados-alumno", () => ({ HistorialEstadosAlumno: () => null }));
// HU-A-06: la ficha suma la tarjeta «Cuenta de acceso»; se simula como las demás secciones.
vi.mock("@/components/shared/cuenta-acceso-card", () => ({ CuentaAccesoCard: () => null }));
import Page from "./page";
import { redirect } from "next/navigation";
import { PermisoError } from "@/server/shared/with-permission";
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

describe("HU-B-07 ubicación de «Desactivar alumno»/«Reactivar»", () => {
  const ALUMNO = { id: "a", nombre: "Ana", apellido: "Pérez", is_active: true, version: 1 };
  const render = async (tab?: string) =>
    renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "a" }), searchParams: Promise.resolve(tab ? { tab } : {}) }));
  const ocurrencias = (html: string) => html.split("data-estado-alumno").length - 1;

  it("en la pestaña Datos, con alumnos:cambiar_estado, va dentro de la cabecera y una sola vez", async () => {
    mocks.permiso.mockResolvedValue({ id: "u", rol: "MESA_ENTRADA" }); mocks.detalle.mockResolvedValue(ALUMNO);
    const html = await render();
    expect(html).toMatch(/<header data-ficha-encabezado="">\s*<button data-estado-alumno="">/);
    expect(ocurrencias(html)).toBe(1);
  });

  it("el Gerente, sin alumnos:cambiar_estado, no lo ve", async () => {
    mocks.permiso.mockImplementation(async (accion: string) => {
      if (accion === "alumnos:cambiar_estado") throw Object.assign(new PermisoError(), { status: 403 });
      return { id: "g", rol: "GERENTE" };
    });
    mocks.detalle.mockResolvedValue(ALUMNO);
    expect(ocurrencias(await render())).toBe(0);
  });

  it.each(["clases", "historial"])("no aparece en la pestaña %s", async (tab) => {
    mocks.permiso.mockResolvedValue({ id: "u", rol: "MESA_ENTRADA" }); mocks.detalle.mockResolvedValue(ALUMNO);
    expect(ocurrencias(await render(tab))).toBe(0);
  });
});
