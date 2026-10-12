"use client";

import { texto as textoC19 } from "@/lib/textos";

import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { ETIQUETA_DIA, horaAMinutos, minutosAHora, type DiaSemanaValor } from "@/lib/horario-atencion";

export type MotivoGeneracion = "TURNO_EXISTENTE" | "AULA_OCUPADA" | "PROFESOR_OCUPADO";
export type FechaGeneracion = {
  fecha: string; estado: "OK" | "CONFLICTO"; motivos: MotivoGeneracion[];
  aula: { id: string; nombre: string }; aula_cambiada: boolean; cupo: number; cupo_aula_por_defecto: number;
  excluida: boolean; sin_aulas_libres: boolean; solo_excluible: boolean;
};
export type VistaPreviaGeneracion = {
  cantidad: number; cantidad_incluida: number; con_aula_cambiada: number; excluidas: number;
  fechas: FechaGeneracion[]; hay_conflictos: boolean; fechas_omitidas_vencidas: number;
};
type AulaLibre = { id: string; nombre: string; capacidad: number };
type Selector = { fecha: string; estado: "cargando" | "lista" | "error"; aulas: AulaLibre[] };

const MENSAJES_CONFLICTO: Record<MotivoGeneracion, string> = {
  TURNO_EXISTENTE: textoC19("ui.clases.interfaz.profesorConOtraClase"),
  AULA_OCUPADA: textoC19("ui.clases.interfaz.aulaOcupada"),
  PROFESOR_OCUPADO: textoC19("ui.clases.interfaz.profesorConOtraClase"),
};
const BADGE_LIBRE = "rounded-full bg-success px-2.5 py-1 text-xs font-medium text-success-foreground";
const BADGE_CONFLICTO = "rounded-full border border-destructive/50 bg-card px-2.5 py-1 text-xs font-medium text-destructive";
const BADGE_EXCLUIDA = "rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground";
const ACCION = "h-7 px-2 text-xs text-primary hover:underline underline-offset-4";

function fechaCompacta(fecha: string) {
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${fecha}T00:00:00.000Z`)).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

/** «jueves 08/10», para los nombres accesibles de las acciones. */
function fechaLarga(fecha: string) {
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${fecha}T00:00:00.000Z`));
  return `${dia} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

/** HU-C-21 «Resolver todas»: fechas incluidas con el aula ocupada, que no son solo excluibles y sin aula elegida (§5.5). */
export function candidatasResolverTodas(vista: VistaPreviaGeneracion): string[] {
  return vista.fechas
    .filter((o) => !o.excluida && o.motivos.includes("AULA_OCUPADA") && !o.solo_excluible && !o.aula_cambiada)
    .map(({ fecha }) => fecha);
}

/** Badges sin repetir texto: PROFESOR_OCUPADO y TURNO_EXISTENTE comparten «Profesor con otra clase». */
function badgesDeConflicto(motivos: MotivoGeneracion[]) {
  return [...new Set(motivos.map((motivo) => MENSAJES_CONFLICTO[motivo]))];
}

type Props = {
  vista: VistaPreviaGeneracion;
  horaInicio: string; duracionMin: number; diaSemana: DiaSemanaValor;
  aulaNombre: string; materiaNombre: string; profesorNombre: string;
  /** Mientras hay un pedido en curso, ninguna acción por fila está disponible. */
  deshabilitada: boolean;
  onCambiarAula: (fecha: string, aulaId: string) => void;
  onDeshacer: (fecha: string) => void;
  onExcluir: (fecha: string) => void;
  onIncluir: (fecha: string) => void;
  /** «Cambiar aula» devolvió una lista vacía: pedir una vista previa nueva. */
  onSinAulasLibres: () => void;
  /** «Resolver todas» (separable, §1.4): sin esta prop no se muestra el botón. */
  onResolverTodas?: () => void;
};

/** HU-C-21: tabla de la vista previa con las acciones por fila (§5.3 a §5.4 de la task). */
export function TablaVistaPreviaGeneracion({ vista, horaInicio, duracionMin, diaSemana, aulaNombre, materiaNombre, profesorNombre,
  deshabilitada, onCambiarAula, onDeshacer, onExcluir, onIncluir, onSinAulasLibres, onResolverTodas }: Props) {
  const [selector, setSelector] = useState<Selector | null>(null);
  const [reintento, setReintento] = useState(0);
  const solicitudRef = useRef(0);
  const incluidas = vista.fechas.filter(({ excluida }) => !excluida);
  const cantidadConflictos = incluidas.filter(({ estado }) => estado === "CONFLICTO").length;
  const unicaIncluida = incluidas.length === 1;
  const horario = `${horaInicio}–${minutosAHora(horaAMinutos(horaInicio) + duracionMin)}`;
  const fechaSelector = selector?.fecha;

  // Una vista previa nueva cierra el selector: la fila pudo cambiar.
  const [vistaPrevia, setVistaPrevia] = useState(vista);
  if (vista !== vistaPrevia) { setVistaPrevia(vista); setSelector(null); }

  useEffect(() => {
    if (!fechaSelector) return;
    const solicitud = ++solicitudRef.current;
    const controlador = new AbortController();
    const cargar = async () => {
      try {
        const query = new URLSearchParams({ fecha: fechaSelector, hora_inicio: horaInicio, duracion_min: String(duracionMin) });
        const respuesta = await fetchAutenticado(`/api/turnos/generacion/aulas-libres?${query}`, { cache: "no-store", signal: controlador.signal });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error();
        if (solicitud !== solicitudRef.current) return;
        const aulas = valor.data as AulaLibre[];
        if (aulas.length === 0) { setSelector(null); onSinAulasLibres(); return; }
        setSelector({ fecha: fechaSelector, estado: "lista", aulas });
      } catch {
        if (!controlador.signal.aborted && solicitud === solicitudRef.current) setSelector({ fecha: fechaSelector, estado: "error", aulas: [] });
      }
    };
    void cargar();
    return () => controlador.abort();
    // Se carga al abrir el selector de una fecha o al reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaSelector, reintento]);

  const abrirSelector = (fecha: string) => setSelector({ fecha, estado: "cargando", aulas: [] });
  const elegir = (fecha: string, aulaId: string) => { setSelector(null); onCambiarAula(fecha, aulaId); };

  return <div className="space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">
      <strong className="text-foreground">{vista.cantidad_incluida} {vista.cantidad_incluida === 1 ? textoC19("ui.clases.interfaz.clase") : textoC19("ui.indicadores.clases.unidad")}</strong>
      {(" " + textoC19("ui.clases.interfaz.conEstadoInicialDisponibleNumeroCeroAlumnos", { valor1: ETIQUETA_DIA[diaSemana].toLocaleLowerCase("es-AR"), valor2: horario, valor3: aulaNombre, valor4: materiaNombre, valor5: profesorNombre }))}
      {vista.excluidas > 0 && (" " + (vista.excluidas === 1 ? textoC19("ui.clases.generacion.resumen.excluida") : textoC19("ui.clases.generacion.resumen.excluidas", { cantidad: vista.excluidas })))}
    </p>
    {vista.fechas_omitidas_vencidas > 0 && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">{vista.fechas_omitidas_vencidas} {vista.fechas_omitidas_vencidas === 1 ? textoC19("ui.clases.interfaz.fechaDeHoyVencidaFueOmitida") : textoC19("ui.clases.interfaz.fechasVencidasFueronOmitidas")}.</p>}
    {vista.hay_conflictos && <div role="status" className="flex gap-3 rounded-md bg-warning px-4 py-3 text-sm text-warning-foreground">
      <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <p><strong>{cantidadConflictos} {cantidadConflictos === 1 ? textoC19("ui.clases.interfaz.fechaTiene") : textoC19("ui.clases.interfaz.fechasTienen")}{(" " + textoC19("ui.clases.interfaz.conflicto"))}</strong>{(" " + textoC19("ui.clases.generacion.conflictos.ayuda"))}</p>
    </div>}
    {onResolverTodas && candidatasResolverTodas(vista).length > 0 && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={deshabilitada} aria-describedby="ayuda-resolver-todas" onClick={onResolverTodas}>{textoC19("ui.clases.generacion.resolver.boton")}</Button>
      <p id="ayuda-resolver-todas" className="text-xs text-muted-foreground">{textoC19("ui.clases.generacion.resolver.ayuda")}</p>
    </div>}
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm" aria-label={textoC19("ui.clases.interfaz.fechasDeLaVistaPrevia")}>
        <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>
          <th scope="col" className="px-3 py-3 font-medium">{textoC19("ui.clases.interfaz.fechaNumeroDos")}</th>
          <th scope="col" className="px-3 py-3 font-medium">{textoC19("ui.clases.interfaz.horario")}</th>
          <th scope="col" className="px-3 py-3 font-medium">{textoC19("ui.clases.interfaz.aula")}</th>
          <th scope="col" className="px-3 py-3 font-medium">{textoC19("ui.clases.interfaz.disponibilidad")}</th>
        </tr></thead>
        <tbody>{vista.fechas.map((ocurrencia) => {
          const { fecha, excluida } = ocurrencia;
          const conflicto = !excluida && ocurrencia.estado === "CONFLICTO";
          const puedeCambiarAula = conflicto && ocurrencia.motivos.includes("AULA_OCUPADA") && !ocurrencia.solo_excluible && !ocurrencia.sin_aulas_libres;
          const cupoDistinto = !excluida && ocurrencia.aula_cambiada && ocurrencia.cupo !== ocurrencia.cupo_aula_por_defecto;
          const abierto = selector?.fecha === fecha ? selector : null;
          const largo = fechaLarga(fecha);
          return <tr key={fecha} data-fecha={fecha} className={`border-b border-border last:border-b-0 ${excluida ? "bg-card text-muted-foreground" : conflicto ? "bg-warning/20" : "bg-card"}`}>
            <td className="whitespace-nowrap px-3 py-3 font-medium"><time dateTime={fecha}>{fechaCompacta(fecha)}</time></td>
            <td className="whitespace-nowrap px-3 py-3 tabular-nums">{horario}</td>
            <td className="px-3 py-3">{ocurrencia.aula.nombre}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-1.5" data-badges>
                {excluida ? <span className={BADGE_EXCLUIDA}>{textoC19("ui.clases.generacion.estado.excluida")}</span>
                  : ocurrencia.estado === "OK"
                    ? <span className={BADGE_LIBRE}>{ocurrencia.aula_cambiada ? textoC19("ui.clases.generacion.estado.libreCambiada", { aula: ocurrencia.aula.nombre }) : textoC19("ui.clases.interfaz.libre")}</span>
                    : <>
                      {badgesDeConflicto(ocurrencia.motivos).map((badge) => <span key={badge} className={BADGE_CONFLICTO}>{badge}</span>)}
                      {ocurrencia.sin_aulas_libres && <span className={BADGE_CONFLICTO}>{textoC19("ui.clases.generacion.estado.sinAulasLibres")}</span>}
                    </>}
              </div>
              {cupoDistinto && <p className="mt-1 text-xs text-muted-foreground">{textoC19("ui.clases.generacion.estado.cupoDistinto", { nuevo: ocurrencia.cupo, original: ocurrencia.cupo_aula_por_defecto })}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-1" data-acciones>
                {excluida
                  ? <Button type="button" variant="ghost" size="sm" className={ACCION} disabled={deshabilitada} aria-label={textoC19("ui.clases.generacion.acciones.incluirFecha", { fecha: largo })} onClick={() => onIncluir(fecha)}>{textoC19("ui.clases.generacion.acciones.incluir")}</Button>
                  : <>
                    {puedeCambiarAula && <Button type="button" variant="ghost" size="sm" className={ACCION} disabled={deshabilitada || Boolean(abierto)} aria-expanded={Boolean(abierto)} aria-label={textoC19("ui.clases.generacion.acciones.cambiarAulaDe", { fecha: largo })} onClick={() => abrirSelector(fecha)}>{textoC19("ui.clases.generacion.acciones.cambiarAula")}</Button>}
                    {ocurrencia.aula_cambiada && <Button type="button" variant="ghost" size="sm" className={ACCION} disabled={deshabilitada} aria-label={textoC19("ui.clases.generacion.acciones.deshacerFecha", { fecha: largo })} onClick={() => onDeshacer(fecha)}>{textoC19("ui.clases.generacion.acciones.deshacer")}</Button>}
                    <Button type="button" variant="ghost" size="sm" className={ACCION} disabled={deshabilitada || unicaIncluida} aria-label={textoC19("ui.clases.generacion.acciones.excluirFecha", { fecha: largo })} aria-describedby={unicaIncluida ? `ultima-${fecha}` : undefined} onClick={() => onExcluir(fecha)}>{textoC19("ui.clases.generacion.acciones.excluir")}</Button>
                    {unicaIncluida && <span id={`ultima-${fecha}`} className="text-xs text-muted-foreground">{textoC19("ui.clases.generacion.acciones.ultimaFecha")}</span>}
                  </>}
              </div>
              {abierto && <div className="mt-2 rounded-md border border-border bg-card p-2 text-foreground" data-selector-aulas>
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{textoC19("ui.clases.generacion.selector.titulo", { fecha: largo })}</p>
                {abierto.estado === "cargando" && <p role="status" className="px-1 text-xs">{textoC19("ui.clases.generacion.selector.cargando")}</p>}
                {abierto.estado === "error" && <div role="alert" className="flex flex-wrap items-center gap-2 px-1 text-xs text-destructive">
                  <span>{textoC19("ui.clases.generacion.selector.error")}</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setSelector({ fecha, estado: "cargando", aulas: [] }); setReintento((n) => n + 1); }}>{textoC19("ui.formasPago.reintentar")}</Button>
                </div>}
                {abierto.estado === "lista" && <ul className="space-y-0.5" aria-label={textoC19("ui.clases.generacion.selector.titulo", { fecha: largo })}>
                  {abierto.aulas.map((aula) => <li key={aula.id}>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start px-2 text-xs" disabled={deshabilitada} onClick={() => elegir(fecha, aula.id)}>
                      {textoC19("ui.clases.generacion.selector.opcion", { aula: aula.nombre, capacidad: aula.capacidad })}
                    </Button>
                  </li>)}
                </ul>}
                <Button type="button" variant="ghost" size="sm" className={`${ACCION} mt-1`} onClick={() => setSelector(null)}>{textoC19("ui.clases.generacion.acciones.cancelar")}</Button>
              </div>}
            </td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}
