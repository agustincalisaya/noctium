"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampoBusqueda, ESPERA_AVISO_CARGA_MS, ESPERA_BUSQUEDA_MS } from "@/components/shared/campo-busqueda";
import { Pagination } from "@/components/shared/pagination";
import { terminoBusqueda } from "@/lib/busqueda-texto";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { parametrosListadoGerentes } from "@/lib/gerentes-listado";
import { texto } from "@/lib/textos";
import { cn } from "@/lib/utils";
import type { ListadoGerentes as DatosListado } from "@/types/gerente.types";

/**
 * Listado de gerentes con búsqueda, paginación y «(vos)» (P-47, HU-G-03;
 * spec_modulo_G.md §2.3). Misma mecánica que `listado-personal.tsx`, sin
 * acoplarse a ese módulo:
 * - El primer render llega del servidor (`page.tsx`) con el `q` y la `pagina`
 *   de la URL.
 * - Al escribir, con debounce, se busca contra `GET /api/gerentes` en la
 *   página 1, sin recargar, descartando respuestas viejas; la URL se actualiza
 *   con `replaceState`. Menos de 2 caracteres pide el listado completo.
 * - El paginador compartido navega a `/gerentes?q=…&pagina=N`; el servidor
 *   manda los datos nuevos y este componente los adopta sin remontarse.
 * - Sin parpadeo: mientras llega una respuesta, la tabla queda igual; el
 *   spinner del campo aparece solo si tarda.
 * - «(vos)» junto al apellido de la fila con `esVos` (lo decide el servidor).
 * Sin estado vacío sin búsqueda: siempre figura al menos el gerente
 * autenticado; si llegaran cero filas, la tabla queda con los encabezados.
 */
export function ListadoGerentes({ inicial, qInicial }: { inicial: DatosListado; qInicial: string }) {
  const [busqueda, setBusqueda] = useState(qInicial);
  // Los datos en pantalla y el `q` con el que se obtuvieron.
  const [resultado, setResultado] = useState({ q: terminoBusqueda(qInicial), datos: inicial });
  const [buscandoLento, setBuscandoLento] = useState(false);
  const [error, setError] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  const avisoLento = useRef<number | undefined>(undefined);
  const q = terminoBusqueda(busqueda);

  // Datos nuevos del servidor (el paginador navegó): se adoptan en el mismo
  // render, sin remontar el componente.
  const [origen, setOrigen] = useState(inicial);
  if (origen !== inicial) {
    setOrigen(inicial);
    setBusqueda(qInicial);
    setResultado({ q: terminoBusqueda(qInicial), datos: inicial });
    setError(false);
  }

  const terminar = useCallback(() => {
    window.clearTimeout(avisoLento.current);
    setBuscandoLento(false);
  }, []);

  const cargar = useCallback(
    async (buscado: string | undefined) => {
      peticion.current?.abort();
      const controller = new AbortController();
      peticion.current = controller;
      setError(false);
      window.clearTimeout(avisoLento.current);
      avisoLento.current = window.setTimeout(() => setBuscandoLento(true), ESPERA_AVISO_CARGA_MS);
      try {
        const params = new URLSearchParams({ pagina: "1" });
        if (buscado) params.set("q", buscado);
        const respuesta = await fetchAutenticado(`/api/gerentes?${params}`, { signal: controller.signal, cache: "no-store" });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !valor?.data || controller.signal.aborted) throw new Error("listado");
        terminar();
        setResultado({ q: buscado, datos: valor.data });
        window.history.replaceState(null, "", `/gerentes${parametrosListadoGerentes({ q: buscado })}`);
      } catch {
        // Cancelada por una búsqueda más nueva: esa maneja el estado.
        if (peticion.current !== controller) return;
        terminar();
        if (!controller.signal.aborted) setError(true);
      }
    },
    [terminar],
  );

  // Cada cambio del texto efectivo busca de nuevo en la página 1.
  useEffect(() => {
    if (q === resultado.q) return;
    const timer = window.setTimeout(() => void cargar(q), ESPERA_BUSQUEDA_MS);
    return () => {
      window.clearTimeout(timer);
      peticion.current?.abort();
    };
  }, [q, resultado.q, cargar]);

  useEffect(() => () => window.clearTimeout(avisoLento.current), []);

  const { items, pagina, total, total_paginas: totalPaginas, por_pagina: porPagina } = resultado.datos;
  const mostrarError = error && q !== resultado.q;
  const ausente = texto("ui.gerentes.valorAusente");

  return (
    <div className="space-y-4">
      <CampoBusqueda
        valor={busqueda}
        onCambiar={setBusqueda}
        placeholder={texto("ui.gerentes.listado.buscarPlaceholder")}
        etiqueta={texto("ui.gerentes.listado.buscarEtiqueta")}
        buscando={buscandoLento}
        textoBuscando={texto("ui.gerentes.listado.buscando")}
      />

      {mostrarError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
          <p className="text-sm text-destructive">{texto("ui.gerentes.listado.error")}</p>
          <Button variant="outline" size="sm" onClick={() => void cargar(q)}>
            {texto("ui.gerentes.listado.reintentar")}
          </Button>
        </div>
      ) : items.length === 0 && resultado.q ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">{texto("ui.gerentes.listado.sinResultados", { q: resultado.q })}</p>
          <Link href="/gerentes/nuevo" className="text-sm font-medium text-primary underline underline-offset-4">
            {texto("ui.gerentes.listado.nuevo")}
          </Link>
        </div>
      ) : (
        <div aria-busy={buscandoLento} className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">{texto("ui.gerentes.listado.titulo")}</caption>
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.apellido")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.nombre")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.dni")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.telefono")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.email")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.estado")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((gerente) => (
                  <tr
                    key={gerente.id}
                    data-inactivo={gerente.activo ? undefined : ""}
                    className={cn("relative transition-colors hover:bg-accent", !gerente.activo && "opacity-60")}
                  >
                    <td className="px-4 py-2 font-medium text-foreground">
                      {/* Toda la fila enlaza a la ficha (criterio 4), como en el personal. */}
                      <Link
                        href={`/gerentes/${gerente.id}`}
                        className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {gerente.apellido}
                      </Link>
                      {gerente.esVos && (
                        <span data-vos="" className="ml-1 font-normal text-muted-foreground">
                          {texto("ui.gerentes.listado.vos")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{gerente.nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground">{gerente.dni}</td>
                    <td className="px-4 py-2 text-muted-foreground">{gerente.telefono ?? ausente}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground" title={gerente.email}>
                      {gerente.email}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={gerente.activo ? "success" : "muted"}>
                        {gerente.activo ? texto("ui.gerentes.estado.activo") : texto("ui.gerentes.estado.inactivo")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            total={total}
            porPagina={porPagina}
            buildHref={(p) => `/gerentes${parametrosListadoGerentes({ q: resultado.q, pagina: p })}`}
          />
        </div>
      )}
    </div>
  );
}
