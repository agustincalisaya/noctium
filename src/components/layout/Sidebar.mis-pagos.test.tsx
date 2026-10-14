// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-I-05: «Mis pagos» en Mi cuenta, solo para el alumno, activo también en
// la vista del comprobante propio. La sesión y la ruta están simuladas.

const m = vi.hoisted(() => ({ sesion: null as { user: { rol: string } } | null, ruta: "/" }));
vi.mock("@/auth", () => ({ auth: async () => m.sesion }));
vi.mock("next/navigation", () => ({ usePathname: () => m.ruta, useRouter: () => ({ push: vi.fn() }) }));

const { Sidebar } = await import("./Sidebar");
const { DirtyStateProvider } = await import("@/components/sesion/dirty-state-context");

type Seccion = { label: string; href?: string; items?: { label: string; href: string }[] };
async function sidebarDe(rol: string) {
  m.sesion = { user: { rol } };
  return (await Sidebar()) as ReactElement<{ secciones: Seccion[] }>;
}
const hrefs = (secciones: Seccion[]) => secciones.flatMap((s) => [s.href, ...(s.items ?? []).map((i) => i.href)]).filter(Boolean);

let root: Root;
let contenedor: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
});
afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
});

describe("HU-I-05 menú «Mis pagos»", () => {
  it("el alumno ve Mis clases, Solicitar clase y Mis pagos (en ese orden) dentro de Mi cuenta", async () => {
    const [miCuenta] = (await sidebarDe("ALUMNO")).props.secciones;
    expect(miCuenta!.label).toBe("Mi cuenta");
    expect(miCuenta!.items!.map((i) => [i.label, i.href])).toEqual([
      ["Mis clases", "/alumno"], ["Solicitar clase", "/alumno/turnos/solicitar"], ["Mis pagos", "/mis-pagos"],
    ]);
  });

  it.each(["MESA_ENTRADA", "GERENTE", "PROFESOR"])("%s no ve «Mis pagos»", async (rol) => {
    expect(hrefs((await sidebarDe(rol)).props.secciones)).not.toContain("/mis-pagos");
  });

  it.each(["/mis-pagos", "/mis-pagos/pago-1/comprobante"])("queda activo en %s", async (ruta) => {
    m.ruta = ruta;
    const sidebar = await sidebarDe("ALUMNO");
    await act(async () => root.render(<DirtyStateProvider>{sidebar}</DirtyStateProvider>));
    const activo = contenedor.querySelector('a[aria-current="page"]');
    expect(activo?.getAttribute("href")).toBe("/mis-pagos");
  });
});
