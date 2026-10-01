"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { CampoBusqueda, ESPERA_AVISO_CARGA_MS, ESPERA_BUSQUEDA_MS } from "@/components/shared/campo-busqueda";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { terminoBusqueda } from "@/lib/busqueda-texto";
import { parametrosListadoAlumnos } from "@/lib/alumno-listado";
import type { ListadoAlumnos as DatosListado } from "@/types/alumno.types";
import { AvisoErrorAlumnos } from "./aviso-error-alumnos";

// Las esperas viven con el campo compartido (HU-C-02 las reutiliza); se
// reexportan para no cambiar la interfaz de este módulo.
export { ESPERA_AVISO_CARGA_MS, ESPERA_BUSQUEDA_MS };

/**
 * Listado de alumnos con búsqueda (HU-B-04 + HU-B-05, spec_modulo_B.md §2.7).
 * El primer render llega del servidor (`page.tsx`) ya filtrado por el `q`
 * de la URL. Al escribir, se busca contra `GET /api/alumnos` en la página 1,
 * sin recargar la pantalla, descartando respuestas viejas, y la URL se
 * actualiza con `replaceState` para que "Volver al listado" recupere la
 * misma búsqueda. El paginador sigue siendo el `<Link>` compartido: cambiar
 * de página navega a `/alumnos?q=…&pagina=N`, el servidor manda los datos
 * nuevos y este componente los adopta sin remontarse.
 *
 * Sin parpadeo: mientras llega una respuesta, la tabla queda igual (sin
 * desmontarse, atenuarse ni cambiar de alto) y las filas se reemplazan
 * directo al llegar. "Cargando alumnos" es solo la carga inicial (el
 * `Suspense` de `page.tsx`).
 */
export function ListadoAlumnos({
  inicial,
  qInicial,
  esMesaDeEntrada,
}: {
  inicial: DatosListado;
  qInicial: string;
  esMesaDeEntrada: boolean;
}) {
  const [texto, setTexto] = useState(qInicial);
  // Los datos en pantalla y el `q` con el que se obtuvieron.
  const [resultado, setResultado] = useState({ q: terminoBusqueda(qInicial), datos: inicial });
  const [buscandoLento, setBuscandoLento] = useState(false);
  const [error, setError] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  const avisoLento = useRef<number | undefined>(undefined);
  const q = terminoBusqueda(texto);

  // Datos nuevos del servidor (el paginador navegó a otra página o
  // búsqueda): se adoptan en el mismo render, sin remontar el componente,
  // para que la tabla se reemplace directo en vez de desarmarse y armarse.
  const [origen, setOrigen] = useState(inicial);
  if (origen !== inicial) {
    setOrigen(inicial);
    setTexto(qInicial);
    setResultado({ q: terminoBusqueda(qInicial), datos: inicial });
    setError(false);
  }

  const terminar = useCallback(() => {
    window.clearTimeout(avisoLento.current);
    setBuscandoLento(false);
  }, []);

  const cargar = useCallback(async (buscado: string | undefined) => {
    peticion.current?.abort();
    const controller = new AbortController();
    peticion.current = controller;
    setError(false);
    // Mientras se busca, la tabla sigue mostrando los resultados anteriores.
    // El único aviso es el spinner dentro del input, y solo si la respuesta
    // tarda más de ESPERA_AVISO_CARGA_MS (en local no llega a verse).
    window.clearTimeout(avisoLento.current);
    avisoLento.current = window.setTimeout(() => setBuscandoLento(true), ESPERA_AVISO_CARGA_MS);
    try {
      const params = new URLSearchParams({ pagina: "1", por_pagina: "20" });
      if (buscado) params.set("q", buscado);
      const respuesta = await fetchAutenticado(`/api/alumnos?${params}`, { signal: controller.signal, cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data || controller.signal.aborted) throw new Error("No se pudo cargar el listado de alumnos");
      terminar();
      setResultado({ q: buscado, datos: valor.data });
      window.history.replaceState(null, "", `/alumnos${parametrosListadoAlumnos({ q: buscado })}`);
    } catch {
      // Cancelada por una búsqueda más nueva: esa maneja el estado. Cancelada
      // sin reemplazo (el texto volvió al término que ya está en pantalla):
      // solo se apaga el aviso.
      if (peticion.current !== controller) return;
      terminar();
      if (!controller.signal.aborted) setError(true);
    }
  }, [terminar]);

  // Cada cambio del texto efectivo busca de nuevo en la página 1 (AC4); con
  // menos de 2 caracteres `q` es undefined y se pide el listado completo (AC6).
  useEffect(() => {
    if (q === resultado.q) return;
    const timer = window.setTimeout(() => void cargar(q), ESPERA_BUSQUEDA_MS);
    return () => {
      window.clearTimeout(timer);
      peticion.current?.abort();
    };
  }, [q, resultado.q, cargar]);

  useEffect(() => () => window.clearTimeout(avisoLento.current), []);

  const { items, paginacion } = resultado.datos;
  // Si el texto volvió al término de los datos en pantalla, esos datos valen.
  const mostrarError = error && q !== resultado.q;

  return (
    <div className="space-y-4">
      <CampoBusqueda
        valor={texto}
        onCambiar={setTexto}
        placeholder="Ej.: juan perez, 42…"
        etiqueta="Buscar alumno"
        buscando={buscandoLento}
        textoBuscando="Buscando alumnos"
      />

      {mostrarError ? (
        <AvisoErrorAlumnos onReintentar={() => void cargar(q)} />
      ) : items.length === 0 ? (
        <SinAlumnos q={resultado.q} esMesaDeEntrada={esMesaDeEntrada} />
      ) : (
        <div aria-busy={buscandoLento} className="space-y-4">
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Apellido y nombre</th>
                  <th className="px-4 py-2 text-left font-medium">DNI</th>
                  <th className="px-4 py-2 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((alumno) => (
                  <tr
                    key={alumno.id}
                    className={cn(
                      "relative transition-colors hover:bg-accent",
                      !alumno.is_active && "opacity-60",
                    )}
                  >
                    <td className="max-w-[16rem] truncate px-4 py-2 font-medium text-foreground" title={`${alumno.apellido}, ${alumno.nombre}`}>
                      <Link
                        href={`/alumnos/${alumno.id}?${fichaParams(resultado.q, paginacion.pagina_actual)}`}
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        {alumno.apellido}, {alumno.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{alumno.dni}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2 text-muted-foreground" title={alumno.telefono ?? "—"}>
                      {alumno.telefono ?? "—"}
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground" title={alumno.email ?? "—"}>
                      {alumno.email ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={alumno.is_active ? "success" : "muted"}>
                        {alumno.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            paginaActual={paginacion.pagina_actual}
            totalPaginas={paginacion.total_paginas}
            total={paginacion.total}
            buildHref={(p) => `/alumnos${parametrosListadoAlumnos({ q: resultado.q, pagina: p })}`}
          />
        </div>
      )}
    </div>
  );
}

/** Query de la ficha: conserva página y búsqueda para "Volver al listado". */
function fichaParams(q: string | undefined, pagina: number) {
  const params = new URLSearchParams({ pagina: String(pagina) });
  if (q) params.set("q", q);
  return params.toString();
}

function SinAlumnos({ q, esMesaDeEntrada }: { q: string | undefined; esMesaDeEntrada: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {q ? `No se encontraron alumnos para «${q}»` : "No hay alumnos registrados"}
      </p>
      {esMesaDeEntrada && (
        <Link
          href="/alumnos/nueva"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Nuevo alumno
        </Link>
      )}
    </div>
  );
}
