"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { ETIQUETA_DIA, horaAMinutos, minutosAHora, type DiaSemanaValor } from "@/lib/horario-atencion";
import { iniciosPosibles } from "@/server/turnos/turno.disponibilidad";
import { PasoMateriaTurno, type MateriaOpcionTurno } from "../paso-materia-turno";
import { PasoProfesorTurno, type ProfesorOpcionTurno } from "../paso-profesor-turno";
import { SeccionAulaTurno, type AulaOpcion } from "../seccion-aula-turno";
import { fechaLegible } from "../paso-fecha-horario-turno";
import { PASOS_TURNO_RECURRENTES, ProgresoTurno, type PasoTurno } from "./progreso-turno";
import { ResumenTurno } from "./resumen-turno";

type Franja = { horario_id: string; dia_semana: DiaSemanaValor; hora_inicio: string; hora_fin: string };
type Payload = { materia_id: string; profesor_id: string; horario_id: string; duracion_min: number; hora_inicio: string; aula_id: string; fecha_desde: string; fecha_hasta: string };
type Motivo = "TURNO_EXISTENTE" | "AULA_OCUPADA" | "PROFESOR_OCUPADO";
type VistaPrevia = { cantidad: number; fechas: { fecha: string; estado: "OK" | "CONFLICTO"; motivos: Motivo[] }[]; hay_conflictos: boolean; fechas_omitidas_vencidas: number };
type Resultado = { generacion_id: string; cantidad: number; turno_ids: string[] };
type Consulta<T> = { estado: "cargando" | "listas" | "error" | "sinAulas"; opciones: T[]; mensaje: string };

type Props = {
  materias: MateriaOpcionTurno[]; materiaId: string; profesorId: string;
  profesores: ProfesorOpcionTurno[]; profesoresPorMateria: Record<string, number>;
  cargandoMaterias: boolean; errorMaterias: string; onReintentarMaterias: () => void;
  cargandoConteos: boolean; errorConteos: string; onReintentarConteos: () => void;
  cargandoProfesores: boolean; errorProfesores: string; mensajeProfesores: string; onReintentarProfesores: () => void;
  onSeleccionarMateria: (id: string) => void; onSeleccionarProfesor: (id: string) => void;
  duracionesPermitidas: number[]; granularidadMin: number | null;
  onBusyChange: (busy: boolean) => void;
};

const MENSAJES_CONFLICTO: Record<Motivo, string> = {
  TURNO_EXISTENTE: "Ya existe un turno de esta materia y profesor en esa fecha",
  AULA_OCUPADA: "Aula ocupada",
  PROFESOR_OCUPADO: "El profesor ya tiene un turno en esa fecha",
};
const ORDEN_DIAS: DiaSemanaValor[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

function hoyDelCentro() {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function FechasVistaPrevia({ vista, horaInicio, duracionMin }: { vista: VistaPrevia; horaInicio: string; duracionMin: number }) {
  return <div className="space-y-4">
    <p className="text-sm font-medium">{vista.cantidad} {vista.cantidad === 1 ? "fecha" : "fechas"} en el rango.</p>
    {vista.fechas_omitidas_vencidas > 0 && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">{vista.fechas_omitidas_vencidas} {vista.fechas_omitidas_vencidas === 1 ? "fecha de hoy vencida fue omitida" : "fechas vencidas fueron omitidas"}.</p>}
    <p role="status" className={`rounded-md p-3 text-sm ${vista.hay_conflictos ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}`}>
      {vista.hay_conflictos ? "Hay conflictos. Revisá las fechas antes de generar otra vista previa." : "Todas las fechas están disponibles para generar."}
    </p>
    <ol className="space-y-2" aria-label="Fechas de la vista previa">
      {vista.fechas.map((ocurrencia) => <li key={ocurrencia.fecha} className={`rounded-lg border p-3 text-sm ${ocurrencia.estado === "CONFLICTO" ? "border-warning bg-warning/30" : "border-border bg-card"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{fechaLegible(ocurrencia.fecha)}</strong><span className="ml-2 tabular-nums text-muted-foreground">{horaInicio}–{minutosAHora(horaAMinutos(horaInicio) + duracionMin)}</span></span><span className={ocurrencia.estado === "CONFLICTO" ? "font-semibold text-destructive" : "font-semibold text-success-foreground"}>{ocurrencia.estado}</span></div>
        {ocurrencia.motivos.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{ocurrencia.motivos.map((motivo) => <li key={motivo}>{MENSAJES_CONFLICTO[motivo] ?? motivo}</li>)}</ul>}
      </li>)}
    </ol>
  </div>;
}

export function TurnoRecurrente(props: Props) {
  const { setDirty } = useDirtyState();
  const { onBusyChange } = props;
  const [paso, setPaso] = useState<PasoTurno>(1);
  const [pasoMaximo, setPasoMaximo] = useState<PasoTurno>(1);
  const [consultaFranjas, setConsultaFranjas] = useState<Consulta<Franja> | null>(null);
  const [reintentoFranjas, setReintentoFranjas] = useState(0);
  const [franjaId, setFranjaId] = useState("");
  const [duracionMin, setDuracionMin] = useState<number | null>(null);
  const [horaInicio, setHoraInicio] = useState("");
  const [consultaAulas, setConsultaAulas] = useState<Consulta<AulaOpcion> | null>(null);
  const [reintentoAulas, setReintentoAulas] = useState(0);
  const [aulaId, setAulaId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [preview, setPreview] = useState<{ clave: string; payload: Payload; data: VistaPrevia } | null>(null);
  const [conflictosRecalculados, setConflictosRecalculados] = useState<VistaPrevia | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [solicitando, setSolicitando] = useState<"preview" | "confirmacion" | null>(null);
  const [error, setError] = useState("");
  const solicitudRef = useRef(false);
  const claveActualRef = useRef("");
  const hoy = hoyDelCentro();

  const materia = props.materias.find(({ id }) => id === props.materiaId);
  const profesor = props.profesores.find(({ id }) => id === props.profesorId);
  const franjas = consultaFranjas?.estado === "listas" ? consultaFranjas.opciones : [];
  const franja = franjas.find(({ horario_id }) => horario_id === franjaId);
  const inicios = franja && duracionMin && props.granularidadMin
    ? iniciosPosibles({ inicio: horaAMinutos(franja.hora_inicio), fin: horaAMinutos(franja.hora_fin) }, duracionMin, props.granularidadMin).map(minutosAHora) : [];
  const aulas = consultaAulas?.estado === "listas" ? consultaAulas.opciones : [];
  const aula = aulas.find(({ id }) => id === aulaId);
  const payload: Payload | null = materia && profesor && franja && duracionMin && inicios.includes(horaInicio) && aula && fechaDesde && fechaHasta
    ? { materia_id: materia.id, profesor_id: profesor.id, horario_id: franja.horario_id, duracion_min: duracionMin, hora_inicio: horaInicio, aula_id: aula.id, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } : null;
  const clave = payload ? JSON.stringify(payload) : "";
  const vistaActual = preview?.clave === clave ? preview : null;
  const puedeConfirmar = Boolean(vistaActual && vistaActual.data.cantidad > 0 && !vistaActual.data.hay_conflictos && !solicitando && !resultado);

  useEffect(() => {
    setDirty(!resultado && Boolean(props.materiaId || props.profesorId || franjaId || duracionMin || horaInicio || aulaId || fechaDesde || fechaHasta));
  }, [props.materiaId, props.profesorId, franjaId, duracionMin, horaInicio, aulaId, fechaDesde, fechaHasta, resultado, setDirty]);
  useEffect(() => { claveActualRef.current = clave; }, [clave]);
  useEffect(() => () => { setDirty(false); onBusyChange(false); }, [setDirty, onBusyChange]);

  useEffect(() => {
    if (!props.materiaId || !props.profesorId) return;
    const controlador = new AbortController();
    const cargar = async () => {
      setConsultaFranjas({ estado: "cargando", opciones: [], mensaje: "" });
      try {
        const respuesta = await fetchAutenticado(`/api/turnos/profesores/${encodeURIComponent(props.profesorId)}/franjas?materia_id=${encodeURIComponent(props.materiaId)}`, { cache: "no-store", signal: controlador.signal });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? "No se pudieron cargar las franjas del profesor");
        if (controlador.signal.aborted) return;
        const opciones = valor.data as Franja[];
        if (franjaId && !opciones.some(({ horario_id }) => horario_id === franjaId)) { setFranjaId(""); setHoraInicio(""); setPreview(null); }
        setConsultaFranjas({ estado: "listas", opciones, mensaje: "" });
      } catch (causa) {
        if (!controlador.signal.aborted) setConsultaFranjas({ estado: "error", opciones: [], mensaje: causa instanceof Error ? causa.message : "No se pudieron cargar las franjas del profesor" });
      }
    };
    void cargar();
    return () => controlador.abort();
    // Se carga al cambiar la relación profesor-materia o pedir reintento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.materiaId, props.profesorId, reintentoFranjas]);

  useEffect(() => {
    if (paso !== 4) return;
    const controlador = new AbortController();
    const cargar = async () => {
      setConsultaAulas({ estado: "cargando", opciones: [], mensaje: "" });
      try {
        const respuesta = await fetchAutenticado("/api/turnos/aula/opciones", { cache: "no-store", signal: controlador.signal });
        const valor = await respuesta.json().catch(() => null);
        if (controlador.signal.aborted) return;
        if (valor?.error?.code === "SIN_AULAS_ACTIVAS") { setConsultaAulas({ estado: "sinAulas", opciones: [], mensaje: "" }); setAulaId(""); setPreview(null); return; }
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? "No se pudieron cargar las aulas");
        const opciones = valor.data as AulaOpcion[];
        if (aulaId && !opciones.some(({ id }) => id === aulaId)) { setAulaId(""); setPreview(null); }
        setConsultaAulas({ estado: "listas", opciones, mensaje: "" });
      } catch (causa) {
        if (!controlador.signal.aborted) setConsultaAulas({ estado: "error", opciones: [], mensaje: causa instanceof Error ? causa.message : "No se pudieron cargar las aulas" });
      }
    };
    void cargar();
    return () => controlador.abort();
    // Al volver a Aula se comprueba que la selección siga activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, reintentoAulas]);

  const invalidarPreview = () => { setPreview(null); setConflictosRecalculados(null); setError(""); };
  const limpiarDesdeFranja = () => { setFranjaId(""); setDuracionMin(null); setHoraInicio(""); setAulaId(""); setFechaDesde(""); setFechaHasta(""); setConsultaFranjas(null); setConsultaAulas(null); invalidarPreview(); };
  const elegirMateria = (id: string) => {
    if (id === props.materiaId || solicitudRef.current) return;
    limpiarDesdeFranja(); setPasoMaximo(1); props.onSeleccionarMateria(id);
  };
  const elegirProfesor = (id: string) => {
    if (id === props.profesorId || solicitudRef.current) return;
    limpiarDesdeFranja(); setPasoMaximo(2); props.onSeleccionarProfesor(id);
  };
  const seleccionarPaso = (destino: PasoTurno) => {
    if (destino === paso || destino > pasoMaximo || solicitudRef.current || resultado) return;
    setPaso(destino);
  };
  const retroceder = () => { if (paso > 1) seleccionarPaso((paso - 1) as PasoTurno); };

  const generarPreview = async () => {
    if (!payload || solicitudRef.current || resultado) return;
    const claveSolicitud = clave;
    solicitudRef.current = true; props.onBusyChange(true); setSolicitando("preview"); setError(""); setConflictosRecalculados(null);
    try {
      const respuesta = await fetchAutenticado("/api/turnos/generacion/vista-previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !Array.isArray(valor?.data?.fechas)) throw new Error(valor?.error?.message ?? "No se pudo generar la vista previa");
      if (claveActualRef.current === claveSolicitud) setPreview({ clave: claveSolicitud, payload, data: valor.data as VistaPrevia });
    } catch (causa) { if (claveActualRef.current === claveSolicitud) setError(causa instanceof Error ? causa.message : "No se pudo generar la vista previa"); }
    finally { solicitudRef.current = false; props.onBusyChange(false); setSolicitando(null); }
  };

  const confirmar = async () => {
    if (!puedeConfirmar || !vistaActual || solicitudRef.current) return;
    solicitudRef.current = true; props.onBusyChange(true); setSolicitando("confirmacion"); setError("");
    try {
      const respuesta = await fetchAutenticado("/api/turnos/generacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vistaActual.payload), cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (respuesta.status === 409 && valor?.error?.code === "GENERACION_CON_CONFLICTOS") {
        setPreview(null);
        setError("La disponibilidad cambió desde la vista previa. Generá una nueva antes de confirmar.");
        if (Array.isArray(valor?.error?.detalles?.fechas)) setConflictosRecalculados(valor.error.detalles as VistaPrevia);
        return;
      }
      if (!respuesta.ok || !valor?.data?.generacion_id || !Array.isArray(valor?.data?.turno_ids)) throw new Error(valor?.error?.message ?? "No se pudieron generar los turnos");
      setResultado(valor.data as Resultado);
    } catch (causa) { setError(causa instanceof Error ? causa.message : "No se pudieron generar los turnos"); }
    finally { solicitudRef.current = false; props.onBusyChange(false); setSolicitando(null); }
  };

  const puedeAvanzar = paso === 1 ? Boolean(materia) : paso === 2 ? Boolean(profesor)
    : paso === 3 ? Boolean(franja && duracionMin && inicios.includes(horaInicio))
      : paso === 4 ? Boolean(aula && fechaDesde && fechaHasta && fechaDesde >= hoy && fechaHasta >= fechaDesde) : false;

  return <>
    <ProgresoTurno paso={paso} pasoMaximoHabilitado={pasoMaximo} onPasoSeleccionado={seleccionarPaso} nombres={PASOS_TURNO_RECURRENTES} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-7">
        {resultado ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground"><h2 className="text-xl font-semibold">Turnos generados</h2><p>Se {resultado.cantidad === 1 ? "generó 1 turno" : `generaron ${resultado.cantidad} turnos`} correctamente.</p><p>Estado inicial: Disponible, 0 alumnos por turno.</p><Link href="/turnos" className="inline-block text-sm font-semibold underline underline-offset-2">Ver turnos</Link></div> :
          props.cargandoMaterias ? <p role="status">Cargando materias</p> : props.errorMaterias ? <div role="alert" className="space-y-3"><p>{props.errorMaterias}</p><Button type="button" variant="outline" onClick={props.onReintentarMaterias}>Reintentar</Button></div> :
          paso === 1 ? <PasoMateriaTurno materias={props.materias} materiaId={props.materiaId} onSeleccionar={elegirMateria}
            profesoresPorMateria={props.profesoresPorMateria} cargandoConteos={props.cargandoConteos} errorConteos={props.errorConteos} onReintentarConteos={props.onReintentarConteos} /> :
            paso === 2 ? <PasoProfesorTurno profesores={props.profesores} profesorId={props.profesorId} materiaNombre={materia?.nombre ?? ""} onSeleccionar={elegirProfesor}
              cargando={props.cargandoProfesores} error={props.errorProfesores} mensajeVacio={props.mensajeProfesores} onReintentar={props.onReintentarProfesores} /> :
              paso === 3 ? <section aria-labelledby="titulo-franja-recurrente" className="space-y-6">
                <div><h2 id="titulo-franja-recurrente" className="text-xl font-semibold">Elegí la franja y el horario</h2><p className="text-sm text-muted-foreground">Cada turno se generará en el mismo día y horario de la franja elegida.</p></div>
                {!consultaFranjas || consultaFranjas.estado === "cargando" ? <p role="status">Cargando franjas recurrentes</p> : consultaFranjas.estado === "error" ? <div role="alert" className="space-y-2"><p>{consultaFranjas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoFranjas((valor) => valor + 1)}>Reintentar</Button></div> : franjas.length === 0 ? <p role="status">Este profesor no tiene horarios de atención registrados</p> :
                  <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Franja recurrente</legend>{[...franjas].sort((a, b) => ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio)).map((opcion) => <label key={opcion.horario_id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 focus-within:ring-2 focus-within:ring-ring ${franjaId === opcion.horario_id ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}><input type="radio" name="franja_recurrente" value={opcion.horario_id} checked={franjaId === opcion.horario_id} onChange={() => { if (franjaId === opcion.horario_id) return; setFranjaId(opcion.horario_id); setHoraInicio(""); setPasoMaximo(3); invalidarPreview(); }} className="h-4 w-4 accent-primary" /><span className="text-sm font-medium">{ETIQUETA_DIA[opcion.dia_semana]}: <span className="tabular-nums">{opcion.hora_inicio}–{opcion.hora_fin}</span></span></label>)}</fieldset>}
                <fieldset className="space-y-2"><legend className="text-sm font-medium">Duración</legend><div className="flex flex-wrap gap-2">{props.duracionesPermitidas.filter((valor) => [60, 120, 180].includes(valor)).map((valor) => <label key={valor} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-ring ${duracionMin === valor ? "border-primary bg-accent font-medium" : "border-border hover:bg-accent"}`}><input type="radio" name="duracion_recurrente" value={valor} checked={duracionMin === valor} onChange={() => { if (duracionMin === valor) return; const nuevos = franja && props.granularidadMin ? iniciosPosibles({ inicio: horaAMinutos(franja.hora_inicio), fin: horaAMinutos(franja.hora_fin) }, valor, props.granularidadMin).map(minutosAHora) : []; setDuracionMin(valor); if (!nuevos.includes(horaInicio)) setHoraInicio(""); setPasoMaximo(3); invalidarPreview(); }} className="sr-only" />{valor} min</label>)}</div></fieldset>
                <fieldset className="space-y-2"><legend className="text-sm font-medium">Hora de inicio</legend>{!props.granularidadMin ? <p role="alert" className="text-sm text-destructive">No se pudo obtener la granularidad horaria del centro.</p> : inicios.length === 0 ? <p className="text-sm text-muted-foreground">Elegí una franja y una duración que quepa completa.</p> : <div className="flex flex-wrap gap-2">{inicios.map((inicio) => <label key={inicio} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm tabular-nums focus-within:ring-2 focus-within:ring-ring ${horaInicio === inicio ? "border-primary bg-primary font-medium text-primary-foreground" : "border-border hover:bg-accent"}`}><input type="radio" name="hora_recurrente" value={inicio} checked={horaInicio === inicio} onChange={() => { if (horaInicio === inicio) return; setHoraInicio(inicio); setPasoMaximo(3); invalidarPreview(); }} className="sr-only" />{inicio}–{minutosAHora(horaAMinutos(inicio) + (duracionMin ?? 0))}</label>)}</div>}</fieldset>
              </section> : paso === 4 ? <section aria-labelledby="titulo-aula-rango" className="space-y-6">
                <div><h2 id="titulo-aula-rango" className="text-xl font-semibold">Elegí el aula y el rango</h2><p className="text-sm text-muted-foreground">Una misma aula se usará en todas las fechas. La disponibilidad se comprueba en la vista previa.</p></div>
                {!consultaAulas || consultaAulas.estado === "cargando" ? <p role="status">Cargando aulas activas</p> : consultaAulas.estado === "error" ? <div role="alert" className="space-y-2"><p>{consultaAulas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoAulas((valor) => valor + 1)}>Reintentar</Button></div> : <SeccionAulaTurno aulas={aulas} aulaId={aulaId} aulaIdGuardada="" aulaGuardadaNoDisponible={false} habilitada sinAulas={consultaAulas.estado === "sinAulas"} error="" modoWizard mensajeVacio="No hay aulas activas registradas." onReintentar={() => setReintentoAulas((valor) => valor + 1)} onCambiar={(id) => { if (id === aulaId) return; setAulaId(id); setPasoMaximo(4); invalidarPreview(); }} />}
                <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium">Desde<input type="date" aria-label="Desde" min={hoy} value={fechaDesde} onChange={(evento) => { setFechaDesde(evento.target.value); setPasoMaximo(4); invalidarPreview(); }} className="block h-10 w-full rounded-md border border-input bg-background px-3 font-normal" /></label><label className="space-y-1 text-sm font-medium">Hasta<input type="date" aria-label="Hasta" min={fechaDesde || hoy} value={fechaHasta} onChange={(evento) => { setFechaHasta(evento.target.value); setPasoMaximo(4); invalidarPreview(); }} className="block h-10 w-full rounded-md border border-input bg-background px-3 font-normal" /></label></div>
                <p className="text-sm text-muted-foreground">Podés generar hasta 6 meses calendario y 40 turnos. El rango se envía tal como lo elegiste.</p>
              </section> : <section aria-labelledby="titulo-vista-recurrente" className="space-y-5">
                <div><h2 id="titulo-vista-recurrente" className="text-xl font-semibold">Vista previa de la generación</h2><p className="text-sm text-muted-foreground">{franja ? `${ETIQUETA_DIA[franja.dia_semana]}, ${horaInicio}–${minutosAHora(horaAMinutos(horaInicio) + (duracionMin ?? 0))}` : ""} · {fechaDesde && fechaHasta ? `${fechaLegible(fechaDesde)} al ${fechaLegible(fechaHasta)}` : ""}</p></div>
                <Button type="button" variant="outline" disabled={!payload || Boolean(solicitando)} onClick={() => void generarPreview()}>{solicitando === "preview" ? "Generando vista previa" : "Generar vista previa"}</Button>
                {vistaActual ? <FechasVistaPrevia vista={vistaActual.data} horaInicio={horaInicio} duracionMin={duracionMin ?? 0} /> : conflictosRecalculados ? <div className="space-y-3"><h3 className="font-semibold">Conflictos recalculados al confirmar</h3><FechasVistaPrevia vista={conflictosRecalculados} horaInicio={horaInicio} duracionMin={duracionMin ?? 0} /></div> : <p className="text-sm text-muted-foreground">Generá la vista previa para revisar todas las fechas antes de confirmar.</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </section>}
        {!resultado && <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={retroceder} disabled={paso === 1 || Boolean(solicitando)}>Atrás</Button>
          {paso === 5 ? <Button type="button" onClick={() => void confirmar()} disabled={!puedeConfirmar}>{solicitando === "confirmacion" ? "Generando turnos" : "Confirmar generación"}</Button>
            : <Button type="button" disabled={!puedeAvanzar || Boolean(solicitando)} onClick={() => { if (!puedeAvanzar) return; setPasoMaximo((actual) => Math.max(actual, paso + 1) as PasoTurno); setPaso((paso + 1) as PasoTurno); }}>{paso === 1 ? "Continuar a profesor" : paso === 2 ? "Continuar a franja" : paso === 3 ? "Continuar a aula y rango" : "Continuar a vista previa"}</Button>}
        </div>}
      </div>
      <ResumenTurno modo="recurrente" valores={{ materia: materia?.nombre ?? null, profesor: profesor ? `${profesor.nombre} ${profesor.apellido}` : null,
        franja: franja ? `${ETIQUETA_DIA[franja.dia_semana]} ${franja.hora_inicio}–${franja.hora_fin}` : null,
        duracion: duracionMin ? `${duracionMin} min` : null, hora: horaInicio ? `${horaInicio}–${minutosAHora(horaAMinutos(horaInicio) + (duracionMin ?? 0))}` : null,
        aula: aula?.nombre ?? null, rango: fechaDesde && fechaHasta ? `${fechaLegible(fechaDesde)} – ${fechaLegible(fechaHasta)}` : null }} />
    </div>
  </>;
}
