"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { ETIQUETA_DIA, horaAMinutos, minutosAHora, type DiaSemanaValor } from "@/lib/horario-atencion";
import { iniciosPosibles } from "@/server/turnos/turno.disponibilidad";
import { type MateriaOpcionTurno } from "../paso-materia-turno";
import { type ProfesorOpcionTurno } from "../paso-profesor-turno";
import { type AulaOpcion } from "../seccion-aula-turno";

type Franja = { horario_id: string; dia_semana: DiaSemanaValor; hora_inicio: string; hora_fin: string };
type Payload = { materia_id: string; profesor_id: string; horario_id: string; duracion_min: number; hora_inicio: string; aula_id: string; fecha_desde: string; fecha_hasta: string };
type Motivo = "TURNO_EXISTENTE" | "AULA_OCUPADA" | "PROFESOR_OCUPADO";
type VistaPrevia = { cantidad: number; fechas: { fecha: string; estado: "OK" | "CONFLICTO"; motivos: Motivo[] }[]; hay_conflictos: boolean; fechas_omitidas_vencidas: number };
type Resultado = { generacion_id: string; cantidad: number; turno_ids: string[] };
type Consulta<T> = { estado: "cargando" | "listas" | "error" | "sinAulas"; opciones: T[]; mensaje: string };

type Props = {
  materias: MateriaOpcionTurno[]; materiaId: string; profesorId: string;
  profesores: ProfesorOpcionTurno[];
  cargandoMaterias: boolean; errorMaterias: string; onReintentarMaterias: () => void;
  cargandoProfesores: boolean; errorProfesores: string; mensajeProfesores: string; onReintentarProfesores: () => void;
  onSeleccionarMateria: (id: string) => void; onSeleccionarProfesor: (id: string) => void;
  duracionesPermitidas: number[]; granularidadMin: number | null;
  onBusyChange: (busy: boolean) => void;
};

const MENSAJES_CONFLICTO: Record<Motivo, string> = {
  TURNO_EXISTENTE: "Profesor con otro turno",
  AULA_OCUPADA: "Aula ocupada",
  PROFESOR_OCUPADO: "Profesor con otro turno",
};
const ORDEN_DIAS: DiaSemanaValor[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

function hoyDelCentro() {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function fechaCompacta(fecha: string) {
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${fecha}T00:00:00.000Z`)).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

function TablaVistaPrevia({ vista, horaInicio, duracionMin, diaSemana, aulaNombre, materiaNombre, profesorNombre }: {
  vista: VistaPrevia; horaInicio: string; duracionMin: number; diaSemana: DiaSemanaValor;
  aulaNombre: string; materiaNombre: string; profesorNombre: string;
}) {
  const cantidadConflictos = vista.fechas.filter(({ estado }) => estado === "CONFLICTO").length;
  const horario = `${horaInicio}–${minutosAHora(horaAMinutos(horaInicio) + duracionMin)}`;
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">
      <strong className="text-foreground">{vista.cantidad} {vista.cantidad === 1 ? "turno" : "turnos"}</strong>
      {` · ${ETIQUETA_DIA[diaSemana].toLocaleLowerCase("es-AR")} ${horario} · ${aulaNombre} · ${materiaNombre} con ${profesorNombre} · estado inicial Disponible, 0 alumnos`}
    </p>
    {vista.fechas_omitidas_vencidas > 0 && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">{vista.fechas_omitidas_vencidas} {vista.fechas_omitidas_vencidas === 1 ? "fecha de hoy vencida fue omitida" : "fechas vencidas fueron omitidas"}.</p>}
    {vista.hay_conflictos && <div role="status" className="flex gap-3 rounded-md bg-warning px-4 py-3 text-sm text-warning-foreground">
      <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <p><strong>{cantidadConflictos} {cantidadConflictos === 1 ? "fecha tiene" : "fechas tienen"} conflicto.</strong> Elegí otra aula para todo el rango o acotá las fechas, y volvé a pedir la vista previa. No se genera ningún turno hasta resolver todos los conflictos.</p>
    </div>}
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm" aria-label="Fechas de la vista previa">
        <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>
          <th scope="col" className="px-3 py-3 font-medium">FECHA</th>
          <th scope="col" className="px-3 py-3 font-medium">HORARIO</th>
          <th scope="col" className="px-3 py-3 font-medium">AULA</th>
          <th scope="col" className="px-3 py-3 font-medium">DISPONIBILIDAD</th>
        </tr></thead>
        <tbody>{vista.fechas.map((ocurrencia) => <tr key={ocurrencia.fecha} className={`border-b border-border last:border-b-0 ${ocurrencia.estado === "CONFLICTO" ? "bg-warning/20" : "bg-card"}`}>
          <td className="whitespace-nowrap px-3 py-3 font-medium"><time dateTime={ocurrencia.fecha}>{fechaCompacta(ocurrencia.fecha)}</time></td>
          <td className="whitespace-nowrap px-3 py-3 tabular-nums">{horario}</td>
          <td className="px-3 py-3">{aulaNombre}</td>
          <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">{ocurrencia.estado === "OK"
            ? <span className="rounded-full bg-success px-2.5 py-1 text-xs font-medium text-success-foreground">Libre</span>
            : ocurrencia.motivos.map((motivo) => <span key={motivo} className="rounded-full border border-destructive/50 bg-card px-2.5 py-1 text-xs font-medium text-destructive">{MENSAJES_CONFLICTO[motivo]}</span>)}</div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

export function TurnoRecurrente(props: Props) {
  const { setDirty } = useDirtyState();
  const { onBusyChange } = props;
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
    // Al cargar o reintentar se comprueba que la selección siga activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reintentoAulas]);

  const invalidarPreview = () => { setPreview(null); setConflictosRecalculados(null); setError(""); };
  const limpiarDesdeFranja = () => { setFranjaId(""); setDuracionMin(null); setHoraInicio(""); setAulaId(""); setFechaDesde(""); setFechaHasta(""); setConsultaFranjas(null); invalidarPreview(); };
  const elegirMateria = (id: string) => {
    if (id === props.materiaId || solicitudRef.current) return;
    limpiarDesdeFranja(); props.onSeleccionarMateria(id);
  };
  const elegirProfesor = (id: string) => {
    if (id === props.profesorId || solicitudRef.current) return;
    limpiarDesdeFranja(); props.onSeleccionarProfesor(id);
  };
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

  const bloqueado = Boolean(solicitando || resultado);
  const puedeGenerarPreview = Boolean(payload && fechaDesde >= hoy && fechaHasta >= fechaDesde && !bloqueado);
  const campo = "block h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const datosTabla = { horaInicio, duracionMin: duracionMin ?? 0, diaSemana: franja?.dia_semana ?? "LUNES" as DiaSemanaValor,
    aulaNombre: aula?.nombre ?? "", materiaNombre: materia?.nombre ?? "",
    profesorNombre: profesor ? `${profesor.nombre} ${profesor.apellido}` : "" };
  return <div className="grid items-start gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
    <section data-testid="configuracion-recurrente" aria-label="Configuración recurrente" className="min-w-0 space-y-7 rounded-xl border border-border bg-card p-6 text-card-foreground">
      <section aria-labelledby="titulo-materia-profesor" className="space-y-4">
        <h2 id="titulo-materia-profesor" className="text-sm font-semibold tracking-wide text-muted-foreground">MATERIA Y PROFESOR</h2>
        <div className="space-y-2"><label htmlFor="materia-recurrente" className="text-sm font-medium">Materia</label>
          <select id="materia-recurrente" className={campo} value={props.materiaId} disabled={bloqueado || props.cargandoMaterias || Boolean(props.errorMaterias)} onChange={(e) => elegirMateria(e.target.value)}>
            <option value="">Seleccioná una materia</option>{props.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          {props.cargandoMaterias && <p role="status">Cargando materias</p>}
          {props.errorMaterias && <div role="alert"><p>{props.errorMaterias}</p><Button type="button" variant="outline" onClick={props.onReintentarMaterias}>Reintentar</Button></div>}
        </div>
        <div className="space-y-2"><label htmlFor="profesor-recurrente" className="text-sm font-medium">Profesor</label>
          <select id="profesor-recurrente" className={campo} value={props.profesorId} disabled={bloqueado || !materia || props.cargandoProfesores || Boolean(props.errorProfesores)} onChange={(e) => elegirProfesor(e.target.value)}>
            <option value="">Seleccioná un profesor</option>{props.profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
          </select>
          {materia && props.cargandoProfesores && <p role="status">Cargando profesores</p>}
          {materia && props.errorProfesores && <div role="alert"><p>{props.errorProfesores}</p><Button type="button" variant="outline" onClick={props.onReintentarProfesores}>Reintentar</Button></div>}
          {materia && !props.cargandoProfesores && !props.errorProfesores && props.profesores.length === 0 && <p className="text-sm text-muted-foreground">{props.mensajeProfesores}</p>}
        </div>
      </section>
      <hr className="border-border" />
      <section aria-labelledby="titulo-franja-horario" className="space-y-4">
        <h2 id="titulo-franja-horario" className="text-sm font-semibold tracking-wide text-muted-foreground">FRANJA Y HORARIO</h2>
        <div className="space-y-2"><label htmlFor="franja-recurrente" className="text-sm font-medium">Franja horaria del profesor</label>
          <select id="franja-recurrente" className={campo} value={franjaId} disabled={bloqueado || !profesor || consultaFranjas?.estado !== "listas"} onChange={(e) => { if (franjaId === e.target.value) return; setFranjaId(e.target.value); setHoraInicio(""); invalidarPreview(); }}>
            <option value="">Seleccioná una franja</option>{[...franjas].sort((a,b) => ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio)).map((f) => <option key={f.horario_id} value={f.horario_id}>{ETIQUETA_DIA[f.dia_semana]}: {f.hora_inicio}–{f.hora_fin}</option>)}
          </select>
          {profesor && (!consultaFranjas || consultaFranjas.estado === "cargando") && <p role="status">Cargando franjas recurrentes</p>}
          {profesor && consultaFranjas?.estado === "error" && <div role="alert"><p>{consultaFranjas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoFranjas((n) => n + 1)}>Reintentar</Button></div>}
          {profesor && consultaFranjas?.estado === "listas" && franjas.length === 0 && <p role="status">Este profesor no tiene horarios de atención registrados</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <fieldset disabled={bloqueado || !franja} className="space-y-2"><legend className="text-sm font-medium">Duración</legend>
            <div className="flex rounded-md border border-input bg-muted p-1">{props.duracionesPermitidas.filter((n) => [60,120,180].includes(n)).map((n) => <label key={n} className={`flex-1 cursor-pointer rounded px-2 py-2 text-center text-sm focus-within:ring-2 focus-within:ring-ring ${duracionMin === n ? "bg-card font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}><input type="radio" name="duracion_recurrente" value={n} checked={duracionMin === n} onChange={() => { if (duracionMin === n) return; const nuevos = franja && props.granularidadMin ? iniciosPosibles({ inicio: horaAMinutos(franja.hora_inicio), fin: horaAMinutos(franja.hora_fin) }, n, props.granularidadMin).map(minutosAHora) : []; setDuracionMin(n); if (!nuevos.includes(horaInicio)) setHoraInicio(""); invalidarPreview(); }} className="sr-only" />{n / 60} h</label>)}</div>
          </fieldset>
          <div className="space-y-2"><label htmlFor="hora-recurrente" className="text-sm font-medium">Hora de inicio</label><select id="hora-recurrente" className={campo} value={horaInicio} disabled={bloqueado || inicios.length === 0} onChange={(e) => { if (horaInicio === e.target.value) return; setHoraInicio(e.target.value); invalidarPreview(); }}><option value="">Seleccioná una hora</option>{inicios.map((inicio) => <option key={inicio} value={inicio}>{inicio}</option>)}</select></div>
        </div>
        {!props.granularidadMin && <p role="alert" className="text-sm text-destructive">No se pudo obtener la granularidad horaria del centro.</p>}
      </section>
      <hr className="border-border" />
      <section aria-labelledby="titulo-aula-fechas" className="space-y-4">
        <h2 id="titulo-aula-fechas" className="text-sm font-semibold tracking-wide text-muted-foreground">AULA Y FECHAS</h2>
        <div className="space-y-2"><label htmlFor="aula-recurrente" className="text-sm font-medium">Aula</label><p className="text-sm text-muted-foreground">Se usa la misma aula en todas las fechas.</p>
          <select id="aula-recurrente" className={campo} value={aulaId} disabled={bloqueado || consultaAulas?.estado !== "listas"} onChange={(e) => { if (aulaId === e.target.value) return; setAulaId(e.target.value); invalidarPreview(); }}><option value="">Seleccioná un aula</option>{aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre} · Capacidad {a.capacidad}</option>)}</select>
          {(!consultaAulas || consultaAulas.estado === "cargando") && <p role="status">Cargando aulas activas</p>}
          {consultaAulas?.estado === "sinAulas" && <p role="status">No hay aulas activas registradas.</p>}
          {consultaAulas?.estado === "error" && <div role="alert"><p>{consultaAulas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoAulas((n) => n + 1)}>Reintentar</Button></div>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">Desde<input type="date" aria-label="Desde" min={hoy} value={fechaDesde} disabled={bloqueado} onChange={(e) => { setFechaDesde(e.target.value); invalidarPreview(); }} className={campo} /></label>
          <label className="space-y-2 text-sm font-medium">Hasta<input type="date" aria-label="Hasta" min={fechaDesde || hoy} value={fechaHasta} disabled={bloqueado} onChange={(e) => { setFechaHasta(e.target.value); invalidarPreview(); }} className={campo} /></label>
        </div>
        <p className="text-sm text-muted-foreground">Máximo 6 meses calendario y 40 turnos.</p>
      </section>
      <Button type="button" variant="outline" className="h-10 w-full" disabled={!puedeGenerarPreview} onClick={() => void generarPreview()}>{solicitando === "preview" ? "Generando vista previa" : "Ver vista previa"}</Button>
    </section>
    <aside data-testid="vista-previa-recurrente" aria-labelledby="titulo-vista-recurrente" className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-7">
      <h2 id="titulo-vista-recurrente" className="text-xl font-semibold">Vista previa</h2>
      {resultado ? <div role="status" className="mt-5 space-y-3 rounded-md bg-success p-5 text-success-foreground"><h3 className="text-lg font-semibold">Turnos generados</h3><p>Se {resultado.cantidad === 1 ? "generó 1 turno" : `generaron ${resultado.cantidad} turnos`} correctamente.</p><p>Estado inicial: Disponible, 0 alumnos por turno.</p><Link href="/turnos" className="inline-block text-sm font-semibold underline underline-offset-2">Ver turnos</Link></div> :
        <div className="mt-5 space-y-5">
          {vistaActual ? <><TablaVistaPrevia vista={vistaActual.data} {...datosTabla} />
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              {vistaActual.data.hay_conflictos && <p className="text-sm text-muted-foreground">Resolvé los conflictos para habilitar la generación.</p>}
              <Button type="button" className="sm:ml-auto" disabled={!puedeConfirmar} onClick={() => void confirmar()}>{solicitando === "confirmacion" ? "Generando turnos" : `Confirmar generación (${vistaActual.data.cantidad} ${vistaActual.data.cantidad === 1 ? "turno" : "turnos"})`}</Button>
            </div></> :
            conflictosRecalculados ? <div className="space-y-3"><h3 className="font-semibold">Conflictos recalculados al confirmar</h3><TablaVistaPrevia vista={conflictosRecalculados} {...datosTabla} /></div> :
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-10 text-center text-sm leading-6 text-muted-foreground">Completá la configuración y tocá Ver vista previa para ver las fechas que se van a generar y si alguna tiene el aula ocupada.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>}
    </aside>
  </div>;
}
