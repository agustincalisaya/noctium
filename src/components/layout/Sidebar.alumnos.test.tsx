import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

// HU-E-02 criterio 8: el Gerente consulta los alumnos, así que tiene
// «Alumnos > Listado» en el menú, igual que Mesa de Entrada. El Profesor
// perdió alumnos:leer y el Alumno nunca lo tuvo. La sesión y la ruta actual
// están simuladas; el marcado de activo es el del `SidebarNav` real.

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

describe("menú «Alumnos»", () => {
  it.each(["GERENTE", "MESA_ENTRADA"])("%s ve una sección «Alumnos» con un único «Listado» hacia /alumnos", async (rol) => {
    const { secciones } = await seccionesDe(rol);
    const alumnos = secciones.filter((s) => s.label === "Alumnos");
    expect(alumnos).toHaveLength(1);
    expect(alumnos[0]).toMatchObject({ label: "Alumnos", items: [{ label: "Listado", href: "/alumnos" }] });
    expect(hrefs(secciones).filter((h) => h!.startsWith("/alumnos"))).toEqual(["/alumnos"]);
  });

  it("el Gerente no tiene ningún acceso a «Nuevo alumno»", async () => {
    const { secciones } = await seccionesDe("GERENTE");
    expect(hrefs(secciones)).not.toContain("/alumnos/nueva");
  });

  it.each(["PROFESOR", "ALUMNO"])("%s no ve «Alumnos»", async (rol) => {
    const { secciones } = await seccionesDe(rol);
    expect(secciones.some((s) => s.label === "Alumnos")).toBe(false);
    expect(hrefs(secciones).some((h) => h!.startsWith("/alumnos"))).toBe(false);
  });

  it.each(["/alumnos", "/alumnos/ckalumno", "/alumnos/ckalumno/clases", "/alumnos/ckalumno/pagos"])(
    "en %s, el Gerente tiene activo el «Listado» de alumnos",
    async (ruta) => {
      m.ruta = ruta;
      const { elemento } = await seccionesDe("GERENTE");
      expect(new Set(activos(elemento))).toEqual(new Set(["/alumnos"]));
    },
  );
});
