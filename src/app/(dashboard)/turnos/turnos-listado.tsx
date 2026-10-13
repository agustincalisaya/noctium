"use client";

import { texto as textoC19 } from "@/lib/textos";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CampoBusqueda, ESPERA_AVISO_CARGA_MS, ESPERA_BUSQUEDA_MS } from "@/components/shared/campo-busqueda";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { terminoBusqueda } from "@/lib/busqueda-texto";
import { fechaCorta } from "@/lib/turno-detalle";
import { cn } from "@/lib/utils";
import { urlContinuar, urlListadoTurnos } from "@/lib/turno-listado";
import { EstadoTurnoBadge } from "./estado-turno-badge";
import { PrioridadTurnoBadge } from "./prioridad-turno-badge";
import { CancelarTurnoDialog } from "./[id]/cancelar-turno-dialog";
import type { OpcionMateriaFiltro, PeriodoListadoTurnos, TurnosData } from "@/types/turno.types";

/**
 * Filtros del listado (HU-C-02, HU-C-08, HU-C-27). `periodo` es undefined
 * cuando hay rango (`desde`/`hasta`): «Rango personalizado».
 */
type Filtros = { q: string | undefined; profesorId: string | undefined; periodo: PeriodoListadoTurnos | undefined; desde: string | undefined; hasta: string | undefined; materiaId: string | undefined };

/**
 * Qué se le pide a la API. `motivo` distingue la búsqueda y los filtros
 * (actualizan la URL con replaceState) de la navegación del paginador o la
 * recarga al volver a la pestaña (la URL ya es la correcta).
 */
type Solicitud = Filtros & { pagina: number; motivo: "busqueda" | "filtro" | "navegacion" | "recarga" };
type OpcionProfesorFiltro = { id: string; nombre: string; apellido: string };

const PERIODOS: { valor: PeriodoListadoTurnos; etiqueta: string }[] = [
  { valor: "anteriores", etiqueta: textoC19("ui.clases.listado.periodo.anteriores") },
  { valor: "hoy", etiqueta: textoC19("ui.clases.listado.periodo.hoy") },
  { valor: "proximas", etiqueta: textoC19("ui.clases.listado.periodo.proximas") },
  { valor: "todas", etiqueta: textoC19("ui.clases.listado.periodo.todas") },
];

/** «Laura Méndez», como el selector y el chip del mockup (pág. 4). */
const nombreProfesor = (profesor: OpcionProfesorFiltro) => `${profesor.nombre} ${profesor.apellido}`;

const rangoInvertido = (desde: string | undefined, hasta: string | undefined) => Boolean(desde && hasta && desde > hasta);

/** Subtítulo del listado (HU-C-27, criterio 7): período o rango, y orden. */
function subtitulo({ periodo, desde, hasta }: Filtros) {
  const descripcion = periodo ? PERIODOS.find(({ valor }) => valor === periodo)!.etiqueta
    : desde && hasta ? textoC19("ui.clases.listado.rango.entre", { desde: fechaCorta(desde), hasta: fechaCorta(hasta) })
      : desde ? textoC19("ui.clases.listado.rango.soloDesde", { desde: fechaCorta(desde) })
        : textoC19("ui.clases.listado.rango.soloHasta", { hasta: fechaCorta(hasta ?? "") });
  const orden = periodo === "anteriores" ? textoC19("ui.clases.listado.orden.descendente") : textoC19("ui.clases.listado.orden.ascendente");
  return textoC19("ui.clases.listado.subtitulo", { periodo: descripcion, orden });
}

const urlDe = (filtros: Filtros, pagina: number) => urlListadoTurnos({ ...filtros, pagina });

/**
 * Listado de clases (HU-C-01) con búsqueda (HU-C-02, spec_modulo_C.md §2.7),
 * filtro por profesor (HU-C-08) y filtros de período, rango y materia
 * (HU-C-27). Los datos se piden desde el cliente a `GET /api/turnos`. Al
 * escribir o cambiar un filtro se consulta la página 1 sin recargar la
 * pantalla y la URL se actualiza con `replaceState`, para que "Volver al
 * listado" recupere los mismos filtros. El paginador sigue siendo de
 * `<Link>`: como `page.tsx` no usa `key`, este componente recibe la página
 * nueva por props y la consulta sin remontarse.
 *
 * Una sola petición viva a la vez (AbortController): una búsqueda, un filtro,
 * un cambio de página o una recarga nueva descarta la respuesta de la
 * anterior. Sin parpadeo: mientras llega la respuesta la tabla queda igual y
 * las filas se reemplazan directo; "Cargando clases" es solo la carga inicial.
 *
 * Período por defecto «Hoy». Cargar Desde o Hasta pasa a «Rango
 * personalizado»; elegir un período vacía las fechas. Con Desde posterior a
 * Hasta no se consulta y se pide corregir el rango. Ningún filtro pide
 * confirmación (HU-C-25 criterio 5). El selector de profesor es solo de
 * Gerente y Mesa de Entrada; el de materia, de los tres roles (las opciones
 * llegan del servidor).
 */
export function TurnosListado({
  pagina, q: qUrl = "", profesorId: profesorUrl = "", periodo: periodoUrl, desde: desdeUrl = "", hasta: hastaUrl = "", materiaId: materiaUrl = "",
  materias = [], puedeConfigurar, puedeDescartar = false, puedeFiltrarProfesor = false,
}: {
  pagina: number; q?: string; profesorId?: string; periodo?: PeriodoListadoTurnos; desde?: string; hasta?: string; materiaId?: string;
  materias?: OpcionMateriaFiltro[]; puedeConfigurar: boolean; puedeDescartar?: boolean; puedeFiltrarProfesor?: boolean;
}) {
  // HU-C-05 (spec §2.4, N-1): turno PENDIENTE a descartar desde el listado.
  const [descartando, setDescartando] = useState<string | null>(null);
  const filtrosDeUrl = (): Filtros => ({
    q: terminoBusqueda(qUrl), profesorId: profesorUrl || undefined,
    periodo: desdeUrl || hastaUrl ? undefined : periodoUrl ?? "hoy",
    desde: desdeUrl || undefined, hasta: hastaUrl || undefined, materiaId: materiaUrl || undefined,
  });
  const [texto, setTexto] = useState(qUrl);
  const [desdeInput, setDesdeInput] = useState(desdeUrl);
  const [hastaInput, setHastaInput] = useState(hastaUrl);
  const [solicitud, setSolicitud] = useState<Solicitud>(() => ({ ...filtrosDeUrl(), pagina, motivo: "navegacion" }));
  // Los datos en pantalla y los filtros con los que se obtuvieron.
  const [resultado, setResultado] = useState<{ filtros: Filtros; datos: TurnosData } | null>(null);
  const [profesores, setProfesores] = useState<OpcionProfesorFiltro[]>([]);
  const [error, setError] = useState("");
  const [buscandoLento, setBuscandoLento] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  const avisoLento = useRef<number | undefined>(undefined);
  const q = terminoBusqueda(texto);

  // El paginador navegó (o la URL cambió desde afuera): se adoptan la página
  // y los filtros nuevos en el mismo render, sin remontar la tabla ni el input.
  const claveUrl = [pagina, qUrl, profesorUrl, periodoUrl, desdeUrl, hastaUrl, materiaUrl].join("|");
  const [origen, setOrigen] = useState(claveUrl);
  if (origen !== claveUrl) {
    setOrigen(claveUrl);
    const nuevos = filtrosDeUrl();
    // Si coincide con lo que ya se pidió (por ejemplo, el router sincronizó
    // el replaceState de un filtro), no se vuelve a consultar.
    if (urlDe(nuevos, pagina) !== urlDe(solicitud, solicitud.pagina)) {
      setTexto(qUrl);
      setDesdeInput(desdeUrl);
      setHastaInput(hastaUrl);
      setSolicitud({ ...nuevos, pagina, motivo: "navegacion" });
    }
  }

  const terminar = useCallback(() => {
    window.clearTimeout(avisoLento.current);
    setBuscandoLento(false);
  }, []);

  const cargar = useCallback(async ({ pagina: paginaPedida, motivo, ...filtros }: Solicitud) => {
    // Desde posterior a Hasta (por ejemplo, desde un enlace): no se consulta.
    if (rangoInvertido(filtros.desde, filtros.hasta)) return;
    peticion.current?.abort();
    const controller = new AbortController();
    peticion.current = controller;
    window.clearTimeout(avisoLento.current);
    avisoLento.current = window.setTimeout(() => setBuscandoLento(true), ESPERA_AVISO_CARGA_MS);
    try {
      const params = new URLSearchParams({ pagina: String(paginaPedida) });
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.profesorId) params.set("profesor_id", filtros.profesorId);
      if (filtros.periodo) params.set("periodo", filtros.periodo);
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      if (filtros.materiaId) params.set("materia_id", filtros.materiaId);
      const response = await fetchAutenticado(`/api/turnos?${params}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result?.error?.message ?? textoC19("ui.clases.interfaz.noSePudieronConsultarLasClases"));
      if (!result?.data) throw new Error(textoC19("ui.clases.interfaz.noSePudieronConsultarLasClases"));
      terminar();
      setError("");
      setResultado({ filtros, datos: result.data });
      if (motivo === "busqueda" || motivo === "filtro") window.history.replaceState(null, "", urlDe(filtros, result.data.paginacion.pagina_actual));
    } catch (err) {
      // Cancelada por una petición más nueva: esa maneja el estado.
      if (peticion.current !== controller || controller.signal.aborted) return;
      terminar();
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : textoC19("ui.clases.interfaz.noSePudieronConsultarLasClasesIntentaNuevamente"));
    }
  }, [terminar]);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(solicitud), 0);
    return () => window.clearTimeout(timer);
  }, [solicitud, cargar]);

  // Cada cambio del texto efectivo busca de nuevo en la página 1; con menos
  // de 2 caracteres `q` es undefined y se pide sin búsqueda.
  useEffect(() => {
    if (q === solicitud.q) return;
    const timer = window.setTimeout(() => setSolicitud((actual) => ({ ...actual, q, pagina: 1, motivo: "busqueda" })), ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(timer);
  }, [q, solicitud.q]);

  // Al volver a la pestaña (p. ej. después de modificar un turno) se vuelve a
  // consultar lo mismo, sin mostrar "Cargando clases".
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

  /** Aplica un cambio de filtros, siempre desde la página 1 (HU-C-27, criterio 5). */
  const filtrar = (cambios: Partial<Filtros>) => setSolicitud((actual) => ({ ...actual, q, ...cambios, pagina: 1, motivo: "filtro" }));

  const filtrarProfesor = (profesorId: string | undefined) => filtrar({ profesorId });

  /** Elegir un período vacía Desde y Hasta (criterio 3). */
  const elegirPeriodo = (periodo: PeriodoListadoTurnos) => {
    setDesdeInput("");
    setHastaInput("");
    filtrar({ periodo, desde: undefined, hasta: undefined });
  };

  /** Cargar una fecha pasa a «Rango personalizado»; vaciar las dos vuelve a «Hoy». */
  const cambiarFecha = (campo: "desde" | "hasta", valor: string) => {
    const desde = campo === "desde" ? valor : desdeInput;
    const hasta = campo === "hasta" ? valor : hastaInput;
    setDesdeInput(desde);
    setHastaInput(hasta);
    if (!desde && !hasta) return filtrar({ periodo: "hoy", desde: undefined, hasta: undefined });
    if (rangoInvertido(desde, hasta)) return;
    filtrar({ periodo: undefined, desde: desde || undefined, hasta: hasta || undefined });
  };

  /** Estado inicial: Hoy, todas las materias, sin búsqueda y sin profesor. */
  const limpiarFiltros = () => {
    setTexto("");
    setDesdeInput("");
    setHastaInput("");
    setSolicitud({ q: undefined, profesorId: undefined, periodo: "hoy", desde: undefined, hasta: undefined, materiaId: undefined, pagina: 1, motivo: "filtro" });
  };

  useEffect(() => () => {
    peticion.current?.abort();
    window.clearTimeout(avisoLento.current);
  }, []);

  const datos = resultado?.datos;
  const mostrados = resultado?.filtros ?? solicitud;
  const retorno = urlDe(mostrados, datos?.paginacion.pagina_actual ?? pagina);
  const hrefPagina = (n: number) => urlDe(mostrados, n);
  const rangoConError = rangoInvertido(desdeInput || undefined, hastaInput || undefined);
  const enRango = Boolean(desdeInput || hastaInput);
  const hayFiltros = Boolean(texto.trim() || solicitud.profesorId || solicitud.materiaId || enRango || solicitud.periodo !== "hoy");
  const profesorFiltrado = mostrados.profesorId ? profesores.find(({ id }) => id === mostrados.profesorId) : undefined;
  // Criterio 10: con «Hoy» y sin otros filtros se ofrece ver las próximas.
  const hoySinFiltros = mostrados.periodo === "hoy" && !mostrados.q && !mostrados.profesorId && !mostrados.materiaId;
  const idCampoError = "turnos-rango-error";
  const control = "flex h-9 shrink-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50";
  const chipProfesor = puedeFiltrarProfesor && profesorFiltrado && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
    {textoC19("ui.clases.interfaz.profesor")}{" "}{nombreProfesor(profesorFiltrado)}
    <button type="button" aria-label={textoC19("ui.clases.interfaz.quitarFiltroDeProfesor")} className="rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => filtrarProfesor(undefined)}><X className="size-3" aria-hidden /></button>
  </span>;

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{textoC19("ui.pagos.resumen.clases")}</h1><p className="text-sm text-muted-foreground">{textoC19("ui.clases.interfaz.buscaPorProfesorMateriaOAulaDesdeNumeroDosLetrasSinDistinguirMayusculas")}</p><p className="text-sm text-muted-foreground">{subtitulo(mostrados)}</p></div>{puedeConfigurar && <Link href="/turnos/nuevo" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{textoC19("ui.clases.interfaz.configurarClase")}</Link>}</div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1"><CampoBusqueda valor={texto} onCambiar={setTexto} placeholder={textoC19("ui.clases.interfaz.ejMatematicaAulaNumeroDosGimenez")} etiqueta={textoC19("ui.clases.interfaz.buscarClase")} buscando={buscandoLento} textoBuscando={textoC19("ui.clases.interfaz.buscandoClases")} /></div>
      {puedeFiltrarProfesor && <label className={control}>
        <span className="text-muted-foreground">{textoC19("ui.turnos.solicitar.profesor")}</span>
        <select aria-label={textoC19("ui.clases.interfaz.filtrarPorProfesor")} className="max-w-56 bg-transparent font-medium outline-none" value={solicitud.profesorId ?? ""} onChange={(event) => filtrarProfesor(event.target.value || undefined)}>
          <option value="">{textoC19("ui.historial.clasesAlumno.todos")}</option>
          {profesores.map((profesor) => <option key={profesor.id} value={profesor.id}>{nombreProfesor(profesor)}</option>)}
        </select>
      </label>}
      <label className={control}>
        <span className="text-muted-foreground">{textoC19("ui.clases.listado.materia.etiqueta")}</span>
        <select aria-label={textoC19("ui.clases.listado.materia.filtrar")} className="max-w-56 bg-transparent font-medium outline-none" value={solicitud.materiaId ?? ""} onChange={(event) => filtrar({ materiaId: event.target.value || undefined })}>
          <option value="">{textoC19("ui.clases.listado.materia.todas")}</option>
          {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.activa ? materia.nombre : `${materia.nombre} · ${textoC19("ui.clases.listado.materia.inactiva")}`}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap items-start gap-3">
      <div role="group" aria-label={textoC19("ui.clases.listado.periodo.etiqueta")} className="inline-flex w-fit flex-wrap items-center rounded-md bg-muted p-1">
        {PERIODOS.map(({ valor, etiqueta }) => {
          const activa = !enRango && solicitud.periodo === valor;
          return <button key={valor} type="button" aria-pressed={activa} onClick={() => elegirPeriodo(valor)} className={cn(
            "rounded-sm px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activa ? "bg-card font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}>{etiqueta}</button>;
        })}
        {enRango && <span className="rounded-sm bg-card px-3 py-1 text-sm font-semibold text-foreground shadow-xs">{textoC19("ui.clases.listado.periodo.rangoPersonalizado")}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-3">
          <label className={control}>
            <span className="text-muted-foreground">{textoC19("ui.clases.listado.rango.desde")}</span>
            <input type="date" className="bg-transparent font-medium outline-none" value={desdeInput} aria-invalid={rangoConError || undefined} aria-describedby={rangoConError ? idCampoError : undefined} onChange={(event) => cambiarFecha("desde", event.target.value)} />
          </label>
          <label className={control}>
            <span className="text-muted-foreground">{textoC19("ui.clases.listado.rango.hasta")}</span>
            <input type="date" className="bg-transparent font-medium outline-none" value={hastaInput} onChange={(event) => cambiarFecha("hasta", event.target.value)} />
          </label>
        </div>
        {rangoConError && <p id={idCampoError} className="text-sm text-destructive">{textoC19("ui.clases.listado.rango.desdePosteriorAHasta")}</p>}
      </div>
      {hayFiltros && <Button type="button" variant="ghost" size="sm" className="h-9 text-primary" onClick={limpiarFiltros}>{textoC19("ui.clases.listado.limpiarFiltros")}</Button>}
    </div>
    {rangoConError ? <p role="status">{textoC19("ui.clases.listado.rango.corregir")}</p>
      : error ? <div role="alert" className="space-y-3 rounded-md border p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar(solicitud)}>{textoC19("ui.formasPago.reintentar")}</Button></div>
      : !datos ? <p role="status">{textoC19("ui.clases.interfaz.cargandoClases")}</p>
      : !datos.items.length ? <div className="space-y-3">{chipProfesor && <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{chipProfesor}</p>}
        {hoySinFiltros ? <div className="flex flex-wrap items-center gap-3"><p>{textoC19("ui.clases.listado.vacio.hoy")}</p><Button type="button" variant="outline" size="sm" onClick={() => elegirPeriodo("proximas")}>{textoC19("ui.clases.listado.vacio.verProximas")}</Button></div>
          : <p>{textoC19("ui.clases.listado.vacio.filtros")}</p>}</div>
      : <div aria-busy={buscandoLento} className="space-y-3">
      <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{datos.paginacion.total} {datos.paginacion.total === 1 ? textoC19("ui.clases.interfaz.clase") : textoC19("ui.indicadores.clases.unidad")}</span>{chipProfesor}</p>
      <div className="overflow-x-auto rounded-md border border-border bg-card text-card-foreground"><table className="w-full min-w-190 text-left text-sm"><thead className="bg-muted"><tr>{[textoC19("ui.pagos.clases.fecha"), textoC19("ui.historial.clasesAlumno.hora"), textoC19("ui.clases.interfaz.alumnosInscriptos"), textoC19("ui.turnos.solicitar.profesor"), textoC19("ui.indicadores.presentismo.materiaColumna"), textoC19("ui.turnos.resumen.aula"), textoC19("ui.clases.interfaz.prioridad"), textoC19("ui.formasPago.estado"), textoC19("ui.formasPago.acciones")].map(columna => <th scope="col" className="px-3 py-3 font-medium" key={columna}>{columna}</th>)}</tr></thead><tbody>{datos.items.map(turno => <tr className="border-t border-border hover:bg-accent" key={turno.id}>
        <td className="whitespace-nowrap px-3 py-3">{turno.fecha}</td><td className="whitespace-nowrap px-3 py-3">{turno.hora_inicio}–{turno.hora_fin}</td><td className="px-3 py-3">{turno.alumnos_inscriptos}</td><td className="px-3 py-3">{turno.profesor}</td><td className="px-3 py-3">{turno.materia}</td><td className="px-3 py-3">{turno.aula}</td><td className="px-3 py-3"><PrioridadTurnoBadge prioridad={turno.prioridad} /></td><td className="px-3 py-3"><EstadoTurnoBadge estado={turno.estado} /></td><td className="px-3 py-3"><div className="flex flex-wrap gap-x-3 gap-y-1 whitespace-nowrap"><Link className="rounded-sm text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(turno.id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{textoC19("ui.clases.interfaz.verDetalle")}</Link>{/* HU-C-27 c9: un Pendiente de un día anterior ya no puede pasar a Disponible. */}{puedeConfigurar && turno.estado === "PENDIENTE" && !turno.es_dia_anterior && <Link className="rounded-sm text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={urlContinuar(turno, retorno)} prefetch={false}>{textoC19("ui.clases.interfaz.continuarConfiguracion")}</Link>}{puedeDescartar && turno.estado === "PENDIENTE" && <button type="button" className="rounded-sm text-destructive underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDescartando(turno.id)}>{textoC19("ui.clases.interfaz.descartar")}</button>}</div></td>
      </tr>)}</tbody></table></div>
      {datos.paginacion.total_paginas > 1 && <nav aria-label={textoC19("ui.clases.interfaz.paginasDeClases")} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{(textoC19("ui.clases.interfaz.pagina") + " ")}{datos.paginacion.pagina_actual}{(" " + textoC19("ui.clases.interfaz.de") + " ")}{datos.paginacion.total_paginas} · {datos.paginacion.total}{(" " + textoC19("ui.clases.interfaz.clasesNumeroDos"))}</span><div className="flex gap-3">{datos.paginacion.pagina_actual > 1 ? <Link className={`${buttonVariants({ variant: "outline", size: "sm" })} text-foreground`} href={hrefPagina(datos.paginacion.pagina_actual - 1)}><ChevronLeft className="size-4" aria-hidden />{textoC19("ui.comun.paginacion.anterior")}</Link> : <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none text-foreground opacity-50`} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden />{textoC19("ui.comun.paginacion.anterior")}</span>}{datos.paginacion.pagina_actual < datos.paginacion.total_paginas ? <Link className={`${buttonVariants({ variant: "outline", size: "sm" })} text-foreground`} href={hrefPagina(datos.paginacion.pagina_actual + 1)}>{textoC19("ui.comun.paginacion.siguiente")}<ChevronRight className="size-4" aria-hidden /></Link> : <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none text-foreground opacity-50`} aria-disabled="true">{textoC19("ui.comun.paginacion.siguiente")}<ChevronRight className="size-4" aria-hidden /></span>}</div></nav>}
    </div>}
    {descartando && <CancelarTurnoDialog turnoId={descartando} modo="descartar" onCerrar={() => setDescartando(null)}
      onCambio={async () => setSolicitud((actual) => ({ ...actual, motivo: "recarga" }))} />}
  </main>;
}
