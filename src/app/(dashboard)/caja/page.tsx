import { TablaCierresCaja } from "@/components/pagos/tabla-cierres-caja";
import { Pagination } from "@/components/shared/pagination";
import { texto } from "@/lib/textos";
import { PaginaQuerySchema } from "@/server/pagos/caja.schema";
import { listarMisCierres, obtenerCajaPropia, POR_PAGINA_CIERRES } from "@/server/pagos/caja.lecturas";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import { MiCaja } from "./mi-caja";

/**
 * «Mi caja» de mesa de entrada (P-34; HU-I-12 criterios 1, 5 y 11;
 * spec_modulo_I.md §2.10.2 y §2.12): la caja abierta en arqueo ciego (o el
 * estado vacío con «Abrir caja»), y debajo «Mis cierres», paginados de a 10.
 */
export default async function MiCajaPage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const { id: usuarioId } = await exigirPermiso("cajas:leer");
  const { pagina } = await searchParams;
  const consulta = PaginaQuerySchema.safeParse(typeof pagina === "string" ? { pagina } : {});
  const paginaPedida = consulta.success ? consulta.data.pagina : 1;

  const [{ caja }, cierres, puedeAbrir, puedeCerrar] = await Promise.all([
    obtenerCajaPropia(usuarioId),
    listarMisCierres(usuarioId, paginaPedida),
    tienePermiso("cajas:abrir"),
    tienePermiso("cajas:cerrar"),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{texto("ui.caja.titulo")}</h1>
        <p className="text-sm text-muted-foreground">{texto("ui.caja.subtitulo")}</p>
      </header>

      <MiCaja caja={caja} puedeAbrir={puedeAbrir} puedeCerrar={puedeCerrar} />

      <section className="rounded-xl border border-border bg-card text-card-foreground" aria-labelledby="mis-cierres-titulo">
        <h2 id="mis-cierres-titulo" className="px-5 pt-5 pb-3 text-lg font-semibold">{texto("ui.caja.misCierres.titulo")}</h2>
        {cierres.items.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">{texto("ui.caja.misCierres.vacio")}</p>
        ) : (
          <div className="space-y-2 pb-3">
            <TablaCierresCaja cierres={cierres.items} hrefDetalle={(id) => `/caja/cierres/${id}`} />
            <div className="px-5">
              <Pagination paginaActual={cierres.paginacion.pagina_actual} totalPaginas={cierres.paginacion.total_paginas}
                total={cierres.paginacion.total} porPagina={POR_PAGINA_CIERRES} mostrarRango mostrarNumeros
                buildHref={(n) => `/caja?pagina=${n}`} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
