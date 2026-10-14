import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// HU-E-02 criterio 8 (spec_modulo_B.md §2.12): el Gerente entra al listado y
// a la búsqueda de alumnos (alumnos:leer) sin «Nuevo alumno». El permiso y el
// servicio están simulados; el listado de cliente se simula exponiendo lo que
// recibe de la página.

const m = vi.hoisted(() => ({ rol: "GERENTE" as string | null, listar: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => {
  class PermisoError extends Error {}
  return {
    PermisoError,
    verificarPermiso: async () => {
      if (m.rol === null) throw new PermisoError("sin permiso");
      return { id: "u", rol: m.rol };
    },
  };
});
vi.mock("@/server/alumnos/alumno.service", () => ({ listarAlumnos: m.listar }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT:${destino}`); }) }));
vi.mock("./listado-alumnos", () => ({
  ListadoAlumnos: ({ qInicial, esMesaDeEntrada }: { qInicial: string; esMesaDeEntrada: boolean }) =>
    <div data-listado="" data-q={qInicial} data-mesa={String(esMesaDeEntrada)} />,
}));

const { default: AlumnosPage } = await import("./page");

const LISTADO = { items: [], total: 0, pagina: 1, total_paginas: 0 };

/** Reemplaza el contenido de cada `Suspense` (un Server Component async) por lo que resuelve. */
async function resolver(nodo: ReactNode): Promise<ReactNode> {
  if (Array.isArray(nodo)) return Promise.all(nodo.map(resolver));
  if (!isValidElement(nodo)) return nodo;
  const elemento = nodo as ReactElement<{ children?: ReactNode }>;
  if (elemento.type === Suspense) {
    const hijo = elemento.props.children as ReactElement;
    return resolver(await (hijo.type as (props: unknown) => Promise<ReactNode>)(hijo.props));
  }
  if (elemento.props.children === undefined) return elemento;
  return { ...elemento, props: { ...elemento.props, children: await resolver(elemento.props.children) } } as ReactElement;
}

async function listado(searchParams: Record<string, string> = {}) {
  const arbol = await AlumnosPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(await resolver(arbol) as ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.rol = "GERENTE";
  m.listar.mockResolvedValue(LISTADO);
});

describe("listado de alumnos: Gerente en modo consulta (HU-E-02 criterio 8)", () => {
  it("ve el listado con la búsqueda de la URL, sin «Nuevo alumno»", async () => {
    const html = await listado({ q: "perez", pagina: "2" });
    expect(html).toContain("Alumnos");
    expect(html).toContain('data-listado=""');
    expect(html).toContain('data-q="perez"');
    expect(html).toContain('data-mesa="false"');
    expect(html).not.toContain("Nuevo alumno");
    expect(html).not.toContain("/alumnos/nueva");
    expect(m.listar).toHaveBeenCalledWith(expect.objectContaining({ q: "perez", pagina: 2 }));
  });

  it("Mesa de Entrada conserva «Nuevo alumno»", async () => {
    m.rol = "MESA_ENTRADA";
    const html = await listado();
    expect(html).toContain('href="/alumnos/nueva"');
    expect(html).toContain('data-mesa="true"');
  });

  it("sin alumnos:leer redirige sin listar", async () => {
    m.rol = null;
    await expect(AlumnosPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/home");
    expect(m.listar).not.toHaveBeenCalled();
  });
});
