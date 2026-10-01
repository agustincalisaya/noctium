"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CampoBusqueda, ESPERA_AVISO_CARGA_MS, ESPERA_BUSQUEDA_MS } from "@/components/shared/campo-busqueda";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { terminoBusqueda } from "@/lib/busqueda-texto";
import { urlContinuar, urlListadoTurnos } from "@/lib/turno-listado";
import { EstadoTurnoBadge } from "./estado-turno-badge";
import { PrioridadTurnoBadge } from "./prioridad-turno-badge";
import { CancelarTurnoDialog } from "./[id]/cancelar-turno-dialog";
import type { TurnosData } from "@/types/turno.types";

/**
 * Qué se le pide a la API. `motivo` distingue la búsqueda (actualiza la URL
 * con replaceState) de la navegación del paginador o la recarga al volver a
 * la pestaña (la URL ya es la correcta).
 */
type Solicitud = { q: string | undefined; profesorId: string | undefined; pagina: number; motivo: "busqueda" | "filtro" | "navegacion" | "recarga" };
type OpcionProfesorFiltro = { id: string; nombre: string; apellido: string };

/** «Laura Méndez», como el selector y el chip del mockup (pág. 4). */
const nombreProfesor = (profesor: OpcionProfesorFiltro) => `${profesor.nombre} ${profesor.apellido}`;

/**
 * Listado de turnos (HU-C-01) con búsqueda (HU-C-02, spec_modulo_C.md §2.7).
 * Los datos se piden desde el cliente a `GET /api/turnos`. Al escribir, se
 * busca en la página 1 tras ESPERA_BUSQUEDA_MS sin recargar la pantalla y la
 * URL se actualiza con `replaceState`, para que "Volver al listado" recupere
 * la misma búsqueda. El paginador sigue siendo de `<Link>`: cambiar de página
 * navega a `/turnos?q=…&pagina=N`, y como `page.tsx` no usa `key`, este
 * componente recibe la página nueva por props y la consulta sin remontarse.
 *
 * Una sola petición viva a la vez (AbortController): una búsqueda, un cambio
 * de página o una recarga nueva descarta la respuesta de la anterior. Sin
 * parpadeo: mientras llega la respuesta la tabla queda igual y las filas se
 * reemplazan directo; "Cargando turnos" es solo la carga inicial.
 *
 * Filtro por profesor (HU-C-08, mockup pág. 4): Gerente y Mesa de Entrada
 * eligen el profesor en un selector junto al buscador; el filtro se combina
 * con `q` y la paginación, vuelve a la página 1 y queda en la URL
 * (`profesor_id`) y en el `retorno` de cada fila. El Profesor no tiene
 * selector: el servidor le acota el listado a sus turnos.
 */
export function TurnosListado({ pagina, q: qUrl = "", profesorId: profesorUrl = "", puedeConfigurar, puedeDescartar = false, puedeFiltrarProfesor = false, esProfesor = false }: { pagina: number; q?: string; profesorId?: string; orden?: string; puedeConfigurar: boolean; puedeDescartar?: boolean; puedeFiltrarProfesor?: boolean; esProfesor?: boolean }) {
  // HU-C-05 (spec §2.4, N-1): turno PENDIENTE a descartar desde el listado.
  const [descartando, setDescartando] = useState<string | null>(null);
  const [texto, setTexto] = useState(qUrl);
  const [solicitud, setSolicitud] = useState<Solicitud>({ q: terminoBusqueda(qUrl), profesorId: profesorUrl || undefined, pagina, motivo: "navegacion" });
  // Los datos en pantalla y el `q`/profesor con los que se obtuvieron.
  const [resultado, setResultado] = useState<{ q: string | undefined; profesorId: string | undefined; datos: TurnosData } | null>(null);
  const [profesores, setProfesores] = useState<OpcionProfesorFiltro[]>([]);
  const [error, setError] = useState("");
  const [buscandoLento, setBuscandoLento] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  const avisoLento = useRef<number | undefined>(undefined);
  const q = terminoBusqueda(texto);

  // El paginador navegó (o la URL cambió desde afuera): se adoptan la página
  // y el `q` nuevos en el mismo render, sin remontar la tabla ni el input.
  const [origen, setOrigen] = useState({ pagina, q: qUrl, profesorId: profesorUrl });
  if (origen.pagina !== pagina || origen.q !== qUrl || origen.profesorId !== profesorUrl) {
    setOrigen({ pagina, q: qUrl, profesorId: profesorUrl });
    const qNuevo = terminoBusqueda(qUrl);
    const profesorNuevo = profesorUrl || undefined;
    // Si coincide con lo que ya se pidió (por ejemplo, el router sincronizó
    // el replaceState de una búsqueda), no se vuelve a consultar.
    if (qNuevo !== solicitud.q || pagina !== solicitud.pagina || profesorNuevo !== solicitud.profesorId) {
      setTexto(qUrl);
      setSolicitud({ q: qNuevo, profesorId: profesorNuevo, pagina, motivo: "navegacion" });
    }
  }

  const terminar = useCallback(() => {
    window.clearTimeout(avisoLento.current);
    setBuscandoLento(false);
  }, []);

  const cargar = useCallback(async ({ q: buscado, profesorId, pagina: paginaPedida, motivo }: Solicitud) => {
    peticion.current?.abort();
    const controller = new AbortController();
    peticion.current = controller;
    window.clearTimeout(avisoLento.current);
    avisoLento.current = window.setTimeout(() => setBuscandoLento(true), ESPERA_AVISO_CARGA_MS);
    try {
      const params = new URLSearchParams({ pagina: String(paginaPedida) });
      if (buscado) params.set("q", buscado);
      if (profesorId) params.set("profesor_id", profesorId);
      const response = await fetchAutenticado(`/api/turnos?${params}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result?.error?.message ?? "No se pudieron consultar los turnos");
      if (!result?.data) throw new Error("No se pudieron consultar los turnos");
      terminar();
      setError("");
      setResultado({ q: buscado, profesorId, datos: result.data });
      if (motivo === "busqueda" || motivo === "filtro") window.history.replaceState(null, "", urlListadoTurnos({ q: buscado, profesorId, pagina: result.data.paginacion.pagina_actual }));
    } catch (err) {
      // Cancelada por una petición más nueva: esa maneja el estado.
      if (peticion.current !== controller || controller.signal.aborted) return;
      terminar();
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No se pudieron consultar los turnos. Intentá nuevamente.");
    }
  }, [terminar]);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(solicitud), 0);
    return () => window.clearTimeout(timer);
  }, [solicitud, cargar]);

  // Cada cambio del texto efectivo busca de nuevo en la página 1; con menos
  // de 2 caracteres `q` es undefined y se pide el listado completo.
  useEffect(() => {
    if (q === solicitud.q) return;
    const timer = window.setTimeout(() => setSolicitud((actual) => ({ q, profesorId: actual.profesorId, pagina: 1, motivo: "busqueda" })), ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(timer);
  }, [q, solicitud.q]);

  // Al volver a la pestaña (p. ej. después de modificar un turno) se vuelve a
  // consultar lo mismo, sin mostrar "Cargando turnos".
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === "visible") setSolicitud((actual) => ({ ...actual, motivo: "recarga" })); };
    window.addEventListener("pageshow", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.removeEventListener("pageshow", actualizar); document.removeEventListener("visibilitychange", actualizar); };
  }, []);

  // Opciones del selector «Profesor» (solo Gerente y Mesa de Entrada).
  useEffect(() => {
    if (!puedeFiltrarProfesor) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetchAutenticado("/api/turnos/filtros/profesores", { cache: "no-store", signal: controller.signal });
        const result = await response.json().catch(() => null);
        if (response.ok && Array.isArray(result?.data)) setProfesores(result.data);
      } catch { /* sin opciones el selector queda solo con «Todos»; el listado sigue funcionando */ }
    })();
    return () => controller.abort();
  }, [puedeFiltrarProfesor]);

  /** Cambia el filtro de profesor (y opcionalmente el texto), siempre desde la página 1. */
  const filtrarProfesor = (profesorId: string | undefined, limpiarBusqueda = false) => {
    if (limpiarBusqueda) setTexto("");
    setSolicitud({ q: limpiarBusqueda ? undefined : q, profesorId, pagina: 1, motivo: "filtro" });
  };

  useEffect(() => () => {
    peticion.current?.abort();
    window.clearTimeout(avisoLento.current);
  }, []);

  const datos = resultado?.datos;
  const retorno = urlListadoTurnos({ q: resultado?.q, profesorId: resultado?.profesorId, pagina: datos?.paginacion.pagina_actual ?? pagina });
  const hrefPagina = (n: number) => urlListadoTurnos({ q: resultado?.q, profesorId: resultado?.profesorId, pagina: n });
  const profesorFiltrado = resultado?.profesorId ? profesores.find(({ id }) => id === resultado.profesorId) : undefined;
  const sinTurnos = resultado?.q ? `No se encontraron turnos para «${resultado.q}»`
    : resultado?.profesorId || esProfesor ? "Este profesor no tiene turnos registrados" : "No hay turnos registrados";
  // El chip espera el nombre del profesor (opciones del selector); «Limpiar» queda disponible mientras tanto.
  const filtros = puedeFiltrarProfesor && resultado?.profesorId && <span className="inline-flex items-center gap-3">
    {profesorFiltrado && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
      Profesor: {nombreProfesor(profesorFiltrado)}
      <button type="button" aria-label="Quitar filtro de profesor" className="rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => filtrarProfesor(undefined)}><X className="size-3" aria-hidden /></button>
    </span>}
    <button type="button" className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => filtrarProfesor(undefined, true)}>Limpiar</button>
  </span>;

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Turnos</h1><p className="text-sm text-muted-foreground">Buscá por profesor, materia o aula (desde 2 letras, sin distinguir mayúsculas ni tildes).</p><p className="text-sm text-muted-foreground">Desde hoy · Orden: fecha y hora ascendente, luego profesor</p></div>{puedeConfigurar && <Link href="/turnos/nuevo" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Configurar turno</Link>}</div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1"><CampoBusqueda valor={texto} onCambiar={setTexto} placeholder="Ej.: matematica, aula 2, gimenez…" etiqueta="Buscar turno" buscando={buscandoLento} textoBuscando="Buscando turnos" /></div>
      {puedeFiltrarProfesor && <label className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50">
        <span className="text-muted-foreground">Profesor</span>
        <select aria-label="Filtrar por profesor" className="max-w-56 bg-transparent font-medium outline-none" value={solicitud.profesorId ?? ""} onChange={(event) => filtrarProfesor(event.target.value || undefined)}>
          <option value="">Todos</option>
          {profesores.map((profesor) => <option key={profesor.id} value={profesor.id}>{nombreProfesor(profesor)}</option>)}
        </select>
      </label>}
    </div>
    {error ? <div role="alert" className="space-y-3 rounded-md border p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar(solicitud)}>Reintentar</Button></div> : !datos ? <p role="status">Cargando turnos</p> : !datos.items.length ? <div className="space-y-3">{filtros && <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{filtros}</p>}<p>{sinTurnos}</p></div> : <div aria-busy={buscandoLento} className="space-y-3">
      <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{datos.paginacion.total} {datos.paginacion.total === 1 ? "turno" : "turnos"}</span>{filtros}</p>
      <div className="overflow-x-auto rounded-md border border-border bg-card text-card-foreground"><table className="w-full min-w-190 text-left text-sm"><thead className="bg-muted"><tr>{["Fecha", "Hora", "Alumnos inscriptos", "Profesor", "Materia", "Aula", "Prioridad", "Estado", "Acciones"].map(columna => <th scope="col" className="px-3 py-3 font-medium" key={columna}>{columna}</th>)}</tr></thead><tbody>{datos.items.map(turno => <tr className="border-t border-border hover:bg-accent" key={turno.id}>
        <td className="whitespace-nowrap px-3 py-3">{turno.fecha}</td><td className="whitespace-nowrap px-3 py-3">{turno.hora_inicio}–{turno.hora_fin}</td><td className="px-3 py-3">{turno.alumnos_inscriptos}</td><td className="px-3 py-3">{turno.profesor}</td><td className="px-3 py-3">{turno.materia}</td><td className="px-3 py-3">{turno.aula}</td><td className="px-3 py-3"><PrioridadTurnoBadge prioridad={turno.prioridad} /></td><td className="px-3 py-3"><EstadoTurnoBadge estado={turno.estado} /></td><td className="px-3 py-3"><div className="flex flex-wrap gap-x-3 gap-y-1 whitespace-nowrap"><Link className="rounded-sm text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(turno.id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Ver detalle</Link>{puedeConfigurar && turno.estado === "PENDIENTE" && <Link className="rounded-sm text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={urlContinuar(turno, retorno)} prefetch={false}>Continuar configuración</Link>}{puedeDescartar && turno.estado === "PENDIENTE" && <button type="button" className="rounded-sm text-destructive underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDescartando(turno.id)}>Descartar</button>}</div></td>
      </tr>)}</tbody></table></div>
      {datos.paginacion.total_paginas > 1 && <nav aria-label="Páginas de turnos" className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {datos.paginacion.pagina_actual} de {datos.paginacion.total_paginas} · {datos.paginacion.total} turnos</span><div className="flex gap-3">{datos.paginacion.pagina_actual > 1 ? <Link className={`${buttonVariants({ variant: "outline", size: "sm" })} text-foreground`} href={hrefPagina(datos.paginacion.pagina_actual - 1)}><ChevronLeft className="size-4" aria-hidden />Anterior</Link> : <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none text-foreground opacity-50`} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden />Anterior</span>}{datos.paginacion.pagina_actual < datos.paginacion.total_paginas ? <Link className={`${buttonVariants({ variant: "outline", size: "sm" })} text-foreground`} href={hrefPagina(datos.paginacion.pagina_actual + 1)}>Siguiente<ChevronRight className="size-4" aria-hidden /></Link> : <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none text-foreground opacity-50`} aria-disabled="true">Siguiente<ChevronRight className="size-4" aria-hidden /></span>}</div></nav>}
    </div>}
    {descartando && <CancelarTurnoDialog turnoId={descartando} modo="descartar" onCerrar={() => setDescartando(null)}
      onCambio={async () => setSolicitud((actual) => ({ ...actual, motivo: "recarga" }))} />}
  </main>;
}
