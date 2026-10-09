// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@/components/shared/pagination";
import { TEXTOS } from "@/lib/textos";

const href = (pagina: number) => `/materias?pagina=${pagina}&buscar=algebra`;
describe("Pagination", () => {
  it("conserva enlaces, límites y nombres accesibles", () => {
    const html = renderToStaticMarkup(<Pagination paginaActual={1} totalPaginas={3} total={42} buildHref={href} mostrarNumeros />);
    expect(html).toContain('aria-label="Paginación"');
    expect(html).toContain("Página 1 de 3 · 42 en total");
    expect(html).toContain('aria-label="Página anterior"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("/materias?pagina=2&amp;buscar=algebra");
    expect(renderToStaticMarkup(<Pagination paginaActual={3} totalPaginas={3} buildHref={href} />)).toContain('aria-label="Página siguiente"');
  });
  it("conserva ocultamiento, página única, rango vacío y elipsis", () => {
    expect(renderToStaticMarkup(<Pagination paginaActual={1} totalPaginas={1} buildHref={href} />)).toBe("");
    expect(renderToStaticMarkup(<Pagination paginaActual={1} totalPaginas={0} buildHref={href} />)).toBe("");
    expect(renderToStaticMarkup(<Pagination paginaActual={1} totalPaginas={1} siempreVisible total={0} mostrarRango buildHref={href} />)).toContain("Mostrando 0–0 de 0");
    const html = renderToStaticMarkup(<Pagination paginaActual={8} totalPaginas={16} total={155} mostrarRango mostrarNumeros buildHref={href} />);
    expect(html).toContain("Mostrando 71–80 de 155");
    expect(html).toContain("…");
  });
  it("los botones de cliente conservan navegación sin enviar formularios", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const cambiar = vi.fn();
    await act(async () => { root.render(<Pagination paginaActual={2} totalPaginas={3} buildHref={href} onPageChange={cambiar} mostrarNumeros />); });
    try {
      const siguiente = container.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!;
      expect(siguiente.type).toBe("button");
      await act(async () => { siguiente.click(); });
      expect(cambiar).toHaveBeenCalledWith(3);
    } finally { await act(async () => root.unmount()); }
  });
  it("un cambio del catálogo se propaga a consumidores sin modificar sus fuentes", () => {
    const clave = "ui.comun.paginacion.anterior";
    const catalogo = TEXTOS as Record<string, string>;
    const previo = catalogo[clave];
    try {
      catalogo[clave] = "Anterior de prueba";
      for (const ruta of ["/materias", "/formas-pago"]) {
        expect(renderToStaticMarkup(<Pagination paginaActual={2} totalPaginas={3} buildHref={(p) => `${ruta}?pagina=${p}`} />)).toContain("Anterior de prueba");
      }
    } finally { catalogo[clave] = previo; }
    expect(catalogo[clave]).toBe(previo);
  });
});
