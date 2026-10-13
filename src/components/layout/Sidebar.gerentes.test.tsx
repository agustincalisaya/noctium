import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

// HU-G-01: «Gerentes» en el menú, solo para el Gerente, como sección
// desplegable con su «Listado», a continuación de «Personal de mesa de
// entrada» (el patrón de HU-F-03). La sesión y la ruta actual están simuladas;
// el marcado de activo es el del `SidebarNav` real, que compara por segmento:
// «Indicadores» (/gerente) no queda activo en /gerentes/….

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
  const elemento = (await Sidebar()) as ReactElement<{ secciones: Seccion[] }>;
  return { elemento, secciones: elemento.props.secciones };
}

const hrefs = (secciones: Seccion[]) => secciones.flatMap((s) => [s.href, ...(s.items ?? []).map((i) => i.href)]).filter(Boolean);

function activos(elemento: ReactElement): string[] {
  const html = renderToStaticMarkup(elemento);
  return [...html.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"/g)].map(([, href]) => href!);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ruta = "/";
});

describe("menú «Gerentes»", () => {
  it("el Gerente ve una sección desplegable con un único «Listado» hacia /gerentes, después del personal", async () => {
    const { secciones } = await seccionesDe("GERENTE");
    const gerentes = secciones.filter((s) => s.label === "Gerentes");
    expect(gerentes).toHaveLength(1);
    expect(gerentes[0]).toMatchObject({ label: "Gerentes", items: [{ label: "Listado", href: "/gerentes" }] });
    expect(gerentes[0]!.href).toBeUndefined();
    expect(hrefs(secciones).filter((h) => h!.startsWith("/gerentes"))).toEqual(["/gerentes"]);

    const indicePersonal = secciones.findIndex((s) => s.label === "Personal de mesa de entrada");
    expect(secciones.findIndex((s) => s.label === "Gerentes")).toBe(indicePersonal + 1);
  });

  it.each(["MESA_ENTRADA", "PROFESOR", "ALUMNO"])("%s no ve nada de gerentes", async (rol) => {
    const { secciones } = await seccionesDe(rol);
    expect(secciones.some((s) => s.label === "Gerentes")).toBe(false);
    expect(hrefs(secciones).some((h) => h!.startsWith("/gerentes"))).toBe(false);
  });

  it.each(["/gerentes", "/gerentes/nuevo", "/gerentes/ckficha", "/gerentes/ckficha/editar"])(
    "en %s, solo «Listado» de gerentes queda activo; «Indicadores» (/gerente) no",
    async (ruta) => {
      m.ruta = ruta;
      const { elemento } = await seccionesDe("GERENTE");
      const enRuta = activos(elemento);
      expect(enRuta.length).toBeGreaterThan(0);
      expect(new Set(enRuta)).toEqual(new Set(["/gerentes"]));
      expect(enRuta).not.toContain("/gerente");
    },
  );

  it("en /gerente (Indicadores), el «Listado» de gerentes no queda activo", async () => {
    m.ruta = "/gerente";
    const { elemento } = await seccionesDe("GERENTE");
    expect(new Set(activos(elemento))).toEqual(new Set(["/gerente"]));
  });
});
