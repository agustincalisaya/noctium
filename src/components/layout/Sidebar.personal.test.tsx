import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

// HU-F-01 y HU-F-03: «Personal de mesa de entrada» en el menú, solo para el
// Gerente, como sección desplegable con su «Listado» (igual que Profesores,
// Materias, Aulas y Formas de pago). La sesión y la ruta actual están
// simuladas; el marcado de activo es el del `SidebarNav` real.

const m = vi.hoisted(() => ({ sesion: null as { user: { rol: string } } | null, ruta: "/" }));
vi.mock("@/auth", () => ({ auth: async () => m.sesion }));
vi.mock("next/navigation", () => ({ usePathname: () => m.ruta, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/sesion/link-protegido", () => ({
  LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { Sidebar } = await import("./Sidebar");

type Seccion = { label: string; href?: string; items?: { label: string; href: string }[] };

async function seccionesDe(rol: string) {
  m.sesion = { user: { rol } };
  // Sidebar devuelve <SidebarNav secciones={…} />: las secciones son sus props.
  const elemento = (await Sidebar()) as ReactElement<{ secciones: Seccion[] }>;
  return { elemento, secciones: elemento.props.secciones };
}

const hrefs = (secciones: Seccion[]) => secciones.flatMap((s) => [s.href, ...(s.items ?? []).map((i) => i.href)]).filter(Boolean);

beforeEach(() => {
  vi.clearAllMocks();
  m.ruta = "/";
});

describe("menú «Personal de mesa de entrada»", () => {
  it("el Gerente ve una sección desplegable con un único «Listado» hacia /personal", async () => {
    const { secciones } = await seccionesDe("GERENTE");
    const personal = secciones.filter((s) => s.label === "Personal de mesa de entrada");
    expect(personal).toHaveLength(1);
    expect(personal[0]).toMatchObject({ label: "Personal de mesa de entrada", items: [{ label: "Listado", href: "/personal" }] });
    // Es sección, no enlace suelto de primer nivel.
    expect(personal[0]!.href).toBeUndefined();
    // Ninguna otra entrada lleva a /personal.
    expect(hrefs(secciones).filter((h) => h!.startsWith("/personal"))).toEqual(["/personal"]);
  });

  it("su «Listado» usa el mismo texto que los otros listados del Gerente", async () => {
    const { secciones } = await seccionesDe("GERENTE");
    const aulas = secciones.find((s) => s.items?.some((i) => i.href === "/aulas"))!;
    const personal = secciones.find((s) => s.label === "Personal de mesa de entrada")!;
    expect(personal.items![0]!.label).toBe(aulas.items!.find((i) => i.href === "/aulas")!.label);
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"])("%s no ve nada de personal", async (rol) => {
    const { secciones } = await seccionesDe(rol);
    expect(secciones.some((s) => s.label === "Personal de mesa de entrada")).toBe(false);
    expect(hrefs(secciones).some((h) => h!.startsWith("/personal"))).toBe(false);
  });

  it.each(["/personal", "/personal/nuevo", "/personal/ckficha", "/personal/ckficha/editar"])(
    "en %s, «Listado» de personal queda activo (y ningún otro ítem)",
    async (ruta) => {
      m.ruta = ruta;
      const { elemento } = await seccionesDe("GERENTE");
      const html = renderToStaticMarkup(elemento);
      const activos = [...html.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"/g)].map(([, href]) => href);
      expect(activos.length).toBeGreaterThan(0);
      expect(new Set(activos)).toEqual(new Set(["/personal"]));
    },
  );
});
