import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-F-01: «Personal de mesa de entrada» en el menú, solo para el Gerente. La
// sesión y la navegación de cliente están simuladas.

const m = vi.hoisted(() => ({ sesion: null as { user: { rol: string } } | null }));
vi.mock("@/auth", () => ({ auth: async () => m.sesion }));
vi.mock("./SidebarNav", () => ({ SidebarNav: () => null }));

const { Sidebar } = await import("./Sidebar");

async function enlacesDe(rol: string) {
  m.sesion = { user: { rol } };
  // Sidebar devuelve <SidebarNav secciones={…} />: las secciones son sus props.
  const elemento = (await Sidebar()) as { props: { secciones: { label: string; href?: string }[] } };
  return elemento.props.secciones.filter((s) => s.href);
}

beforeEach(() => vi.clearAllMocks());

describe("menú «Personal de mesa de entrada»", () => {
  it("el Gerente lo ve, con enlace a /personal", async () => {
    expect(await enlacesDe("GERENTE")).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Personal de mesa de entrada", href: "/personal" })]),
    );
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"])("%s no lo ve", async (rol) => {
    expect((await enlacesDe(rol)).some((s) => s.href === "/personal")).toBe(false);
  });
});
