"use client";

import { texto as textoC19 } from "@/lib/textos";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { ETIQUETA_DIA, horaAMinutos, minutosAHora, type DiaSemanaValor } from "@/lib/horario-atencion";
import { iniciosPosibles } from "@/server/turnos/turno.disponibilidad";
import { type MateriaOpcionTurno } from "../paso-materia-turno";
import { type ProfesorOpcionTurno } from "../paso-profesor-turno";
import { type AulaOpcion } from "../seccion-aula-turno";
import { TablaVistaPreviaGeneracion, type VistaPreviaGeneracion as VistaPrevia } from "./tabla-vista-previa-generacion";

type Franja = { horario_id: string; dia_semana: DiaSemanaValor; hora_inicio: string; hora_fin: string };
type Payload = { materia_id: string; profesor_id: string; horario_id: string; duracion_min: number; hora_inicio: string; aula_id: string; fecha_desde: string; fecha_hasta: string };
type Resultado = { generacion_id: string; cantidad: number; turno_ids: string[]; aulas_cambiadas: number; fechas_excluidas: number };
/** HU-C-21: elecciones de la corrida. Se vacían con cualquier cambio del formulario (D9). */
type Listas = { aulasPorFecha: Record<string, string>; fechasExcluidas: string[] };
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

const ORDEN_DIAS: DiaSemanaValor[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

function hoyDelCentro() {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** Detalle de la confirmación (HU-C-25): «x con el aula cambiada · y fechas excluidas», sin las partes en 0. */
function detalleConfirmacion(vista: VistaPrevia) {
  const partes = [
    vista.con_aula_cambiada === 1 ? textoC19("ui.clases.generacion.confirmacion.unaConAulaCambiada")
      : vista.con_aula_cambiada > 1 ? textoC19("ui.clases.generacion.confirmacion.conAulaCambiada", { cantidad: vista.con_aula_cambiada }) : null,
    vista.excluidas === 1 ? textoC19("ui.clases.generacion.confirmacion.unaFechaExcluida")
      : vista.excluidas > 1 ? textoC19("ui.clases.generacion.confirmacion.fechasExcluidas", { cantidad: vista.excluidas }) : null,
  ].filter(Boolean);
  return partes.length ? <p>{partes.join(" · ")}</p> : undefined;
}

const LISTAS_VACIAS: Listas = { aulasPorFecha: {}, fechasExcluidas: [] };

/** Pedido a la API: los campos de HU-C-21 solo viajan si tienen algo (el pedido de Sprint 2 queda idéntico). */
function pedidoDe(base: Payload, listas: Listas) {
  const aulas = Object.entries(listas.aulasPorFecha).sort(([a], [b]) => a.localeCompare(b));
  return {
    ...base,
    ...(aulas.length ? { aulas_por_fecha: aulas.map(([fecha, aula_id]) => ({ fecha, aula_id })) } : {}),
    ...(listas.fechasExcluidas.length ? { fechas_excluidas: [...listas.fechasExcluidas].sort() } : {}),
  };
}

/** §5.2: las listas se reconstruyen desde lo que validó el servidor. */
function listasDesdeRespuesta(vista: VistaPrevia): Listas {
  return {
    aulasPorFecha: Object.fromEntries(vista.fechas.filter(({ excluida, aula_cambiada }) => !excluida && aula_cambiada).map(({ fecha, aula }) => [fecha, aula.id])),
    fechasExcluidas: vista.fechas.filter(({ excluida }) => excluida).map(({ fecha }) => fecha),
  };
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
  const [listas, setListas] = useState<Listas>(LISTAS_VACIAS);
  const [preview, setPreview] = useState<{ clave: string; listas: Listas; data: VistaPrevia } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [solicitando, setSolicitando] = useState<"preview" | "confirmacion" | null>(null);
  const [error, setError] = useState("");
  const solicitudRef = useRef(false);
  const claveActualRef = useRef("");
  const confirmacionRef = useRef<{ resultado: Resultado | null; conflicto: Listas | null }>({ resultado: null, conflicto: null });
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
  // La vista previa vigente es la pedida con estos datos del formulario y estas listas (§5.1).
  const claveCompleta = payload ? JSON.stringify(pedidoDe(payload, listas)) : "";
  const vistaActual = preview?.clave === claveCompleta ? preview : null;
  const puedeConfirmar = Boolean(vistaActual && vistaActual.data.cantidad_incluida > 0 && !vistaActual.data.hay_conflictos && !solicitando && !resultado);

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
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? textoC19("ui.clases.interfaz.noSePudieronCargarLasFranjasDelProfesor"));
        if (controlador.signal.aborted) return;
        const opciones = valor.data as Franja[];
        if (franjaId && !opciones.some(({ horario_id }) => horario_id === franjaId)) { setFranjaId(""); setHoraInicio(""); setPreview(null); setListas(LISTAS_VACIAS); }
        setConsultaFranjas({ estado: "listas", opciones, mensaje: "" });
      } catch (causa) {
        if (!controlador.signal.aborted) setConsultaFranjas({ estado: "error", opciones: [], mensaje: causa instanceof Error ? causa.message : textoC19("ui.clases.interfaz.noSePudieronCargarLasFranjasDelProfesor") });
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
        if (valor?.error?.code === "SIN_AULAS_ACTIVAS") { setConsultaAulas({ estado: "sinAulas", opciones: [], mensaje: "" }); setAulaId(""); setPreview(null); setListas(LISTAS_VACIAS); return; }
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? textoC19("ui.clases.interfaz.noSePudieronCargarLasAulas"));
        const opciones = valor.data as AulaOpcion[];
        if (aulaId && !opciones.some(({ id }) => id === aulaId)) { setAulaId(""); setPreview(null); setListas(LISTAS_VACIAS); }
        setConsultaAulas({ estado: "listas", opciones, mensaje: "" });
      } catch (causa) {
        if (!controlador.signal.aborted) setConsultaAulas({ estado: "error", opciones: [], mensaje: causa instanceof Error ? causa.message : textoC19("ui.clases.interfaz.noSePudieronCargarLasAulas") });
      }
    };
    void cargar();
    return () => controlador.abort();
    // Al cargar o reintentar se comprueba que la selección siga activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reintentoAulas]);

  const invalidarPreview = () => { setPreview(null); setListas(LISTAS_VACIAS); setError(""); setAviso(""); };
  const limpiarDesdeFranja = () => { setFranjaId(""); setDuracionMin(null); setHoraInicio(""); setAulaId(""); setFechaDesde(""); setFechaHasta(""); setConsultaFranjas(null); invalidarPreview(); };
  const elegirMateria = (id: string) => {
    if (id === props.materiaId || solicitudRef.current) return;
    limpiarDesdeFranja(); props.onSeleccionarMateria(id);
  };
  const elegirProfesor = (id: string) => {
    if (id === props.profesorId || solicitudRef.current) return;
    limpiarDesdeFranja(); props.onSeleccionarProfesor(id);
  };
  /** §5.2: toda acción pide una vista previa nueva; si falla, las listas no cambian y queda la anterior. */
  const solicitarVistaPrevia = async (listasPedido: Listas, avisoTrasPedido = "") => {
    if (!payload || solicitudRef.current || resultado) return;
    const claveSolicitud = clave;
    const base = payload;
    solicitudRef.current = true; props.onBusyChange(true); setSolicitando("preview"); setError(""); setAviso(avisoTrasPedido);
    try {
      const respuesta = await fetchAutenticado("/api/turnos/generacion/vista-previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedidoDe(base, listasPedido)), cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !Array.isArray(valor?.data?.fechas)) throw new Error(valor?.error?.message ?? textoC19("ui.clases.interfaz.noSePudoGenerarLaVistaPrevia"));
      if (claveActualRef.current !== claveSolicitud) return;
      const data = valor.data as VistaPrevia;
      const nuevas = listasDesdeRespuesta(data);
      setListas(nuevas);
      setPreview({ clave: JSON.stringify(pedidoDe(base, nuevas)), listas: nuevas, data });
    } catch (causa) { if (claveActualRef.current === claveSolicitud) setError(causa instanceof Error ? causa.message : textoC19("ui.clases.interfaz.noSePudoGenerarLaVistaPrevia")); }
    finally { solicitudRef.current = false; props.onBusyChange(false); setSolicitando(null); }
  };
  const generarPreview = () => solicitarVistaPrevia(listas);
  const cambiarListas = (cambio: (actuales: Listas) => Listas) => { void solicitarVistaPrevia(cambio(listas)); };
  const sinFecha = (aulas: Record<string, string>, fecha: string) => Object.fromEntries(Object.entries(aulas).filter(([otra]) => otra !== fecha));
  const deshacer = (fecha: string) => cambiarListas((l) => ({ ...l, aulasPorFecha: sinFecha(l.aulasPorFecha, fecha) }));
  // Elegir el aula por defecto equivale a «Deshacer»: nunca se envía como aula de la fecha (D10).
  const cambiarAula = (fecha: string, aulaId: string) => aulaId === payload?.aula_id
    ? deshacer(fecha)
    : cambiarListas((l) => ({ ...l, aulasPorFecha: { ...l.aulasPorFecha, [fecha]: aulaId } }));
  const excluir = (fecha: string) => cambiarListas((l) => ({ aulasPorFecha: sinFecha(l.aulasPorFecha, fecha), fechasExcluidas: [...l.fechasExcluidas, fecha] }));
  const incluir = (fecha: string) => cambiarListas((l) => ({ ...l, fechasExcluidas: l.fechasExcluidas.filter((otra) => otra !== fecha) }));

  /** §5.6: un 409 GENERACION_CON_CONFLICTOS no es un error del modal; lo resuelve `despuesDeConfirmar` (§5.7). */
  const confirmar = async () => {
    if (!vistaActual || solicitudRef.current) return;
    confirmacionRef.current = { resultado: null, conflicto: null };
    solicitudRef.current = true; props.onBusyChange(true); setSolicitando("confirmacion"); setError(""); setAviso("");
    try {
      const respuesta = await fetchAutenticado("/api/turnos/generacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: vistaActual.clave, cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (respuesta.status === 409 && valor?.error?.code === "GENERACION_CON_CONFLICTOS") {
        confirmacionRef.current.conflicto = vistaActual.listas;
        return;
      }
      if (!respuesta.ok || !valor?.data?.generacion_id || !Array.isArray(valor?.data?.turno_ids)) throw new Error(valor?.error?.message ?? textoC19("ui.clases.interfaz.noSePudieronGenerarLasClases"));
      confirmacionRef.current.resultado = valor.data as Resultado;
    } finally { solicitudRef.current = false; props.onBusyChange(false); setSolicitando(null); }
  };
  const despuesDeConfirmar = () => {
    const { resultado: generado, conflicto } = confirmacionRef.current;
    if (conflicto) {
      // §5.7: la disponibilidad cambió; vista previa nueva con las mismas elecciones y con sus acciones.
      setPreview(null);
      void solicitarVistaPrevia(conflicto, textoC19("ui.clases.interfaz.laDisponibilidadCambioDesdeLaVistaPreviaGeneraUnaNuevaAntesDe"));
      return;
    }
    if (generado) setResultado(generado);
  };

  const bloqueado = Boolean(solicitando || resultado);
  const puedeGenerarPreview = Boolean(payload && fechaDesde >= hoy && fechaHasta >= fechaDesde && !bloqueado);
  const campo = "block h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const datosTabla = { horaInicio, duracionMin: duracionMin ?? 0, diaSemana: franja?.dia_semana ?? "LUNES" as DiaSemanaValor,
    aulaNombre: aula?.nombre ?? "", materiaNombre: materia?.nombre ?? "",
    profesorNombre: profesor ? `${profesor.nombre} ${profesor.apellido}` : "" };
  return <div className="grid items-start gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
    <section data-testid="configuracion-recurrente" aria-label={textoC19("ui.clases.interfaz.configuracionRecurrente")} className="min-w-0 space-y-7 rounded-xl border border-border bg-card p-6 text-card-foreground">
      <section aria-labelledby="titulo-materia-profesor" className="space-y-4">
        <h2 id="titulo-materia-profesor" className="text-sm font-semibold tracking-wide text-muted-foreground">{textoC19("ui.clases.interfaz.materiaYProfesor")}</h2>
        <div className="space-y-2"><label htmlFor="materia-recurrente" className="text-sm font-medium">{textoC19("ui.indicadores.presentismo.materiaColumna")}</label>
          <select id="materia-recurrente" className={campo} value={props.materiaId} disabled={bloqueado || props.cargandoMaterias || Boolean(props.errorMaterias)} onChange={(e) => elegirMateria(e.target.value)}>
            <option value="">{textoC19("ui.clases.calendario.seleccionaUnaMateria")}</option>{props.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          {props.cargandoMaterias && <p role="status">{textoC19("ui.clases.interfaz.cargandoMaterias")}</p>}
          {props.errorMaterias && <div role="alert"><p>{props.errorMaterias}</p><Button type="button" variant="outline" onClick={props.onReintentarMaterias}>{textoC19("ui.formasPago.reintentar")}</Button></div>}
        </div>
        <div className="space-y-2"><label htmlFor="profesor-recurrente" className="text-sm font-medium">{textoC19("ui.turnos.solicitar.profesor")}</label>
          <select id="profesor-recurrente" className={campo} value={props.profesorId} disabled={bloqueado || !materia || props.cargandoProfesores || Boolean(props.errorProfesores)} onChange={(e) => elegirProfesor(e.target.value)}>
            <option value="">{textoC19("ui.clases.calendario.seleccionaUnProfesor")}</option>{props.profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
          </select>
          {materia && props.cargandoProfesores && <p role="status">{textoC19("ui.clases.interfaz.cargandoProfesores")}</p>}
          {materia && props.errorProfesores && <div role="alert"><p>{props.errorProfesores}</p><Button type="button" variant="outline" onClick={props.onReintentarProfesores}>{textoC19("ui.formasPago.reintentar")}</Button></div>}
          {materia && !props.cargandoProfesores && !props.errorProfesores && props.profesores.length === 0 && <p className="text-sm text-muted-foreground">{props.mensajeProfesores}</p>}
        </div>
      </section>
      <hr className="border-border" />
      <section aria-labelledby="titulo-franja-horario" className="space-y-4">
        <h2 id="titulo-franja-horario" className="text-sm font-semibold tracking-wide text-muted-foreground">{textoC19("ui.clases.interfaz.franjaYHorario")}</h2>
        <div className="space-y-2"><label htmlFor="franja-recurrente" className="text-sm font-medium">{textoC19("ui.clases.interfaz.franjaHorariaDelProfesor")}</label>
          <select id="franja-recurrente" className={campo} value={franjaId} disabled={bloqueado || !profesor || consultaFranjas?.estado !== "listas"} onChange={(e) => { if (franjaId === e.target.value) return; setFranjaId(e.target.value); setHoraInicio(""); invalidarPreview(); }}>
            <option value="">{textoC19("ui.clases.interfaz.seleccionaUnaFranja")}</option>{[...franjas].sort((a,b) => ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio)).map((f) => <option key={f.horario_id} value={f.horario_id}>{ETIQUETA_DIA[f.dia_semana]}: {f.hora_inicio}–{f.hora_fin}</option>)}
          </select>
          {profesor && (!consultaFranjas || consultaFranjas.estado === "cargando") && <p role="status">{textoC19("ui.clases.interfaz.cargandoFranjasRecurrentes")}</p>}
          {profesor && consultaFranjas?.estado === "error" && <div role="alert"><p>{consultaFranjas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoFranjas((n) => n + 1)}>{textoC19("ui.formasPago.reintentar")}</Button></div>}
          {profesor && consultaFranjas?.estado === "listas" && franjas.length === 0 && <p role="status">{textoC19("ui.clases.interfaz.esteProfesorNoTieneHorariosDeAtencionRegistrados")}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <fieldset disabled={bloqueado || !franja} className="space-y-2"><legend className="text-sm font-medium">{textoC19("ui.turnos.resumen.duracion")}</legend>
            <div className="flex rounded-md border border-input bg-muted p-1">{props.duracionesPermitidas.filter((n) => [60,120,180].includes(n)).map((n) => <label key={n} className={`flex-1 cursor-pointer rounded px-2 py-2 text-center text-sm focus-within:ring-2 focus-within:ring-ring ${duracionMin === n ? "bg-card font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}><input type="radio" name="duracion_recurrente" value={n} checked={duracionMin === n} onChange={() => { if (duracionMin === n) return; const nuevos = franja && props.granularidadMin ? iniciosPosibles({ inicio: horaAMinutos(franja.hora_inicio), fin: horaAMinutos(franja.hora_fin) }, n, props.granularidadMin).map(minutosAHora) : []; setDuracionMin(n); if (!nuevos.includes(horaInicio)) setHoraInicio(""); invalidarPreview(); }} className="sr-only" />{n / 60}{(" " + textoC19("ui.clases.interfaz.hNumeroDos"))}</label>)}</div>
          </fieldset>
          <div className="space-y-2"><label htmlFor="hora-recurrente" className="text-sm font-medium">{textoC19("ui.clases.interfaz.horaDeInicioNumeroDos")}</label><select id="hora-recurrente" className={campo} value={horaInicio} disabled={bloqueado || inicios.length === 0} onChange={(e) => { if (horaInicio === e.target.value) return; setHoraInicio(e.target.value); invalidarPreview(); }}><option value="">{textoC19("ui.clases.interfaz.seleccionaUnaHora")}</option>{inicios.map((inicio) => <option key={inicio} value={inicio}>{inicio}</option>)}</select></div>
        </div>
        {!props.granularidadMin && <p role="alert" className="text-sm text-destructive">{textoC19("ui.clases.interfaz.noSePudoObtenerLaGranularidadHorariaDelCentro")}</p>}
      </section>
      <hr className="border-border" />
      <section aria-labelledby="titulo-aula-fechas" className="space-y-4">
        <h2 id="titulo-aula-fechas" className="text-sm font-semibold tracking-wide text-muted-foreground">{textoC19("ui.clases.interfaz.aulaYFechas")}</h2>
        <div className="space-y-2"><label htmlFor="aula-recurrente" className="text-sm font-medium">{textoC19("ui.turnos.resumen.aula")}</label><p className="text-sm text-muted-foreground">{textoC19("ui.clases.generacion.ayudaAula")}</p>
          <select id="aula-recurrente" className={campo} value={aulaId} disabled={bloqueado || consultaAulas?.estado !== "listas"} onChange={(e) => { if (aulaId === e.target.value) return; setAulaId(e.target.value); invalidarPreview(); }}><option value="">{textoC19("ui.clases.interfaz.seleccionaUnAula")}</option>{aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre}{(" " + textoC19("ui.clases.interfaz.capacidad") + " ")}{a.capacidad}</option>)}</select>
          {(!consultaAulas || consultaAulas.estado === "cargando") && <p role="status">{textoC19("ui.clases.interfaz.cargandoAulasActivas")}</p>}
          {consultaAulas?.estado === "sinAulas" && <p role="status">{textoC19("ui.clases.interfaz.noHayAulasActivasRegistradas")}</p>}
          {consultaAulas?.estado === "error" && <div role="alert"><p>{consultaAulas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoAulas((n) => n + 1)}>{textoC19("ui.formasPago.reintentar")}</Button></div>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">{textoC19("ui.indicadores.panel.desde")}<input type="date" aria-label={textoC19("ui.indicadores.panel.desde")} min={hoy} value={fechaDesde} disabled={bloqueado} onChange={(e) => { setFechaDesde(e.target.value); invalidarPreview(); }} className={campo} /></label>
          <label className="space-y-2 text-sm font-medium">{textoC19("ui.indicadores.panel.hasta")}<input type="date" aria-label={textoC19("ui.indicadores.panel.hasta")} min={fechaDesde || hoy} value={fechaHasta} disabled={bloqueado} onChange={(e) => { setFechaHasta(e.target.value); invalidarPreview(); }} className={campo} /></label>
        </div>
        <p className="text-sm text-muted-foreground">{textoC19("ui.clases.interfaz.maximoNumeroSeisMesesCalendarioYNumeroCuatroCeroClases")}</p>
      </section>
      <Button type="button" variant="outline" className="h-10 w-full" disabled={!puedeGenerarPreview} onClick={() => void generarPreview()}>{solicitando === "preview" ? textoC19("ui.clases.interfaz.generandoVistaPrevia") : textoC19("ui.clases.interfaz.verVistaPrevia")}</Button>
    </section>
    <aside data-testid="vista-previa-recurrente" aria-labelledby="titulo-vista-recurrente" className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-7">
      <h2 id="titulo-vista-recurrente" className="text-xl font-semibold">{textoC19("ui.clases.interfaz.vistaPrevia")}</h2>
      {resultado ? <div role="status" className="mt-5 space-y-3 rounded-md bg-success p-5 text-success-foreground">
        <h3 className="text-lg font-semibold">{textoC19("ui.clases.interfaz.clasesGenerados")}</h3>
        <p>{(textoC19("ui.clases.interfaz.se") + " ")}{resultado.cantidad === 1 ? textoC19("ui.clases.interfaz.generoNumeroUnoClase") : textoC19("ui.clases.interfaz.generaronClases", { valor1: resultado.cantidad })}{(" " + textoC19("ui.clases.interfaz.correctamente"))}</p>
        <p>{resultado.aulas_cambiadas === 0 ? textoC19("ui.clases.generacion.exito.ningunaAulaCambiada") : resultado.aulas_cambiadas === 1 ? textoC19("ui.clases.generacion.exito.unaAulaCambiada") : textoC19("ui.clases.generacion.exito.aulasCambiadas", { cantidad: resultado.aulas_cambiadas })}</p>
        <p>{resultado.fechas_excluidas === 0 ? textoC19("ui.clases.generacion.exito.ningunaExcluida") : resultado.fechas_excluidas === 1 ? textoC19("ui.clases.generacion.exito.unaExcluida") : textoC19("ui.clases.generacion.exito.excluidas", { cantidad: resultado.fechas_excluidas })}</p>
        <p>{textoC19("ui.clases.interfaz.estadoInicialDisponibleNumeroCeroAlumnosPorClase")}</p>
        <Link href="/turnos" className="inline-block text-sm font-semibold underline underline-offset-2">{textoC19("ui.clases.interfaz.verClases")}</Link>
      </div> :
        <div className="mt-5 space-y-5">
          {aviso && <p role="status" className="rounded-md bg-warning px-4 py-3 text-sm text-warning-foreground">{aviso}</p>}
          {vistaActual ? <><TablaVistaPreviaGeneracion vista={vistaActual.data} {...datosTabla} deshabilitada={Boolean(solicitando) || confirmando}
            onCambiarAula={cambiarAula} onDeshacer={deshacer} onExcluir={excluir} onIncluir={incluir} onSinAulasLibres={() => void generarPreview()} />
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              {vistaActual.data.hay_conflictos && <p className="text-sm text-muted-foreground">{textoC19("ui.clases.interfaz.resolveLosConflictosParaHabilitarLaGeneracion")}</p>}
              <Button type="button" className="sm:ml-auto" disabled={!puedeConfirmar || confirmando} onClick={() => setConfirmando(true)}>{solicitando === "confirmacion" ? textoC19("ui.clases.interfaz.generandoClases") : textoC19("ui.clases.interfaz.confirmarGeneracion", { valor1: vistaActual.data.cantidad_incluida, valor2: vistaActual.data.cantidad_incluida === 1 ? textoC19("ui.clases.interfaz.clase") : textoC19("ui.pagos.resumen.clases").toLowerCase() })}</Button>
            </div>
            <ConfirmarAccionDialog
              abierto={confirmando}
              titulo={textoC19("confirmaciones.clases.generar", { cantidad: vistaActual.data.cantidad_incluida === 1 ? textoC19("ui.clases.generacion.confirmacion.unaClase") : textoC19("ui.clases.generacion.confirmacion.clases", { cantidad: vistaActual.data.cantidad_incluida }), materia: datosTabla.materiaNombre, profesor: datosTabla.profesorNombre })}
              detalle={detalleConfirmacion(vistaActual.data)}
              textoConfirmar={textoC19("ui.clases.generacion.confirmacion.boton")}
              onConfirmar={confirmar}
              onExito={despuesDeConfirmar}
              onCerrar={() => setConfirmando(false)}
            /></> :
            solicitando === "preview" ? <p role="status" className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-10 text-center text-sm leading-6 text-muted-foreground">{textoC19("ui.clases.interfaz.generandoVistaPrevia")}</p> :
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-10 text-center text-sm leading-6 text-muted-foreground">{textoC19("ui.clases.interfaz.completaLaConfiguracionYTocaVerVistaPreviaParaVerLasFechas")}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>}
    </aside>
  </div>;
}
