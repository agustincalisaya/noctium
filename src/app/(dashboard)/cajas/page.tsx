import { TablaCierresCaja } from "@/components/pagos/tabla-cierres-caja";
import { Pagination } from "@/components/shared/pagination";
import { texto } from "@/lib/textos";
import { ListarCajasQuerySchema } from "@/server/pagos/caja.schema";
import { listarCajasYCierres, listarIntegrantesConCaja, POR_PAGINA_CIERRES } from "@/server/pagos/caja.lecturas";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import { CajasAbiertas } from "./cajas-abiertas";
import { FiltrosCierres } from "./filtros-cierres";

type Parametros = { integrante_id?: string | string[]; desde?: string | string[]; hasta?: string | string[]; pagina?: string | string[] };

/** Arma la URL del listado conservando los filtros. */
function hrefListado(filtros: { integrante_id?: string; desde?: string; hasta?: string }, pagina: number): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor) query.set(clave, valor);
  if (pagina > 1) query.set("pagina", String(pagina));
  const cadena = query.toString();
  return cadena ? `/cajas?${cadena}` : "/cajas";
}

/**
 * «Cierres de caja» del gerente (HU-I-12 criterios 10 y 11;
 * spec_modulo_I.md §2.12; foto `Cierres de caja de todo el personal.png`):
 * las cajas abiertas con su antigüedad y «Cierre por ausencia», y todos los
 * cierres con filtro por integrante y por rango de fechas de cierre,
 * paginados de a 10. Un filtro inválido de la URL se ignora y se avisa.
 */
export default async function CierresDeCajaPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  await exigirPermiso("cajas:leer_todas");
  const parametros = await searchParams;
  const valorDe = (valor?: string | string[]) => (typeof valor === "string" && valor.trim() !== "" ? valor.trim() : undefined);
  const pedidos = { integrante_id: valorDe(parametros.integrante_id), desde: valorDe(parametros.desde), hasta: valorDe(parametros.hasta) };
  const consulta = ListarCajasQuerySchema.safeParse({
    ...Object.fromEntries(Object.entries(pedidos).filter(([, v]) => v !== undefined)),
    ...(valorDe(parametros.pagina) ? { pagina: valorDe(parametros.pagina) } : {}),
  });
  const filtros = consulta.success ? { integrante_id: consulta.data.integrante_id, desde: consulta.data.desde, hasta: consulta.data.hasta } : {};
  const pagina = consulta.success ? consulta.data.pagina : 1;

  const [{ abiertas, cierres }, integrantes, puedeCerrarPorAusencia] = await Promise.all([
    listarCajasYCierres({ integranteId: filtros.integrante_id, desde: filtros.desde, hasta: filtros.hasta, pagina }),
    listarIntegrantesConCaja(),
    tienePermiso("cajas:cerrar_ausencia"),
  ]);
  const hayFiltros = Boolean(filtros.integrante_id || filtros.desde || filtros.hasta);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{texto("ui.cajas.titulo")}</h1>
        <p className="text-sm text-muted-foreground">{texto("ui.cajas.subtitulo")}</p>
      </header>

      <CajasAbiertas abiertas={abiertas} puedeCerrarPorAusencia={puedeCerrarPorAusencia} />

      <FiltrosCierres integrantes={integrantes} inicial={consulta.success ? filtros : pedidos} rangoInvalido={!consulta.success && consulta.error.issues.some((issue) => issue.path[0] === "desde" || issue.path[0] === "hasta")} />

      <section className="rounded-xl border border-border bg-card text-card-foreground" aria-labelledby="cierres-titulo">
        <h2 id="cierres-titulo" className="px-5 pt-5 pb-3 text-lg font-semibold">{texto("ui.cajas.cierres.titulo")}</h2>
        {cierres.items.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            {texto(hayFiltros ? "ui.cajas.cierres.sinResultados" : "ui.cajas.cierres.vacio")}
          </p>
        ) : (
          <div className="space-y-2 pb-3">
            <TablaCierresCaja cierres={cierres.items} conIntegrante hrefDetalle={(id) => `/cajas/${id}`} />
            <div className="px-5">
              <Pagination paginaActual={cierres.paginacion.pagina_actual} totalPaginas={cierres.paginacion.total_paginas}
                total={cierres.paginacion.total} porPagina={POR_PAGINA_CIERRES} mostrarRango mostrarNumeros
                buildHref={(n) => hrefListado(filtros, n)} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
