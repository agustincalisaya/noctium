"use client";

import Link from "next/link";
import { LinkProtegido } from "@/components/sesion/link-protegido";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { SeccionAulaTurno, type AulaOpcion } from "./seccion-aula-turno";
import type { Turno } from "./turno.types";

type Materia = { id: string; nombre: string; codigo: string | null };
type Parametros = { zona_horaria: string; duraciones_permitidas_minutos: number[]; granularidad_minutos: number; dias_operativos: string[]; apertura: string; cierre: string; anticipacion_maxima_dias: number };
// `duracion_min` vacío = sin elegir (Revisión 4: sin valor preseleccionado).
type Campos = { fecha: string; duracion_min: string; hora_inicio: string; materia_id: string };
type Resultado = { id: string; fecha: string; hora_inicio: string; hora_fin: string; aula: string | null; cupo_maximo: number | null; profesor_desasignado?: boolean };
const inicial: Campos = { fecha: "", duracion_min: "", hora_inicio: "", materia_id: "" };
const campoError: Record<string, keyof Campos> = { FECHA_PASADA: "fecha", DIA_NO_OPERATIVO: "fecha", ANTICIPACION_EXCEDIDA: "fecha", DURACION_NO_PERMITIDA: "duracion_min", HORA_NO_GRANULAR: "hora_inicio", FUERA_DE_HORARIO_OPERATIVO: "hora_inicio", MATERIA_NO_DISPONIBLE: "materia_id" };
const dias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

function etiquetaDuracion(minutosTotales: number) {
  const horas = minutosTotales / 60;
  return Number.isInteger(horas) ? `${horas} ${horas === 1 ? "hora" : "horas"}` : `${minutosTotales} minutos`;
}

/** Duración elegida o, sin elegir, la mínima permitida (no bloquea la Hora). */
function duracionEfectiva(duracion: string, parametros: Parametros) {
  return Number(duracion) || Math.min(...parametros.duraciones_permitidas_minutos);
}

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function horaTexto(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function momentoDelCentro(ahora: Date, zona: string) {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return { fecha: `${valor("year")}-${valor("month")}-${valor("day")}`, hora: `${valor("hour")}:${valor("minute")}` };
}

function fechaMaxima(hoy: string, diasMaximos: number) {
  const fecha = new Date(`${hoy}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + diasMaximos);
  return fecha.toISOString().slice(0, 10);
}

function errorDeFecha(fecha: string, hoy: string, maximo: string, parametros: Parametros) {
  if (!fecha) return "";
  const dia = new Date(`${fecha}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== fecha) return "Ingresá una fecha válida";
  if (fecha < hoy) return "La fecha no puede ser anterior a hoy";
  if (fecha > maximo) return `La fecha no puede superar ${parametros.anticipacion_maxima_dias} días de anticipación`;
  if (!parametros.dias_operativos.includes(dias[dia.getUTCDay()])) return "El centro no atiende el día seleccionado";
  return "";
}

function opcionesDeHora(fecha: string, hoy: string, horaActual: string, parametros: Parametros, duracion: number) {
  if (!fecha || errorDeFecha(fecha, hoy, fechaMaxima(hoy, parametros.anticipacion_maxima_dias), parametros)) return [];
  const paso = parametros.granularidad_minutos;
  const ultima = Math.min(minutos(parametros.cierre) - duracion, 1439 - duracion);
  const opciones: string[] = [];
  for (let inicio = Math.ceil(minutos(parametros.apertura) / paso) * paso; inicio <= ultima; inicio += paso) {
    if (fecha !== hoy || inicio > minutos(horaActual)) opciones.push(horaTexto(inicio));
  }
  return opciones;
}

/** Sin turno (alta) lista todas las aulas activas; "sin aulas activas" no es un error de carga. */
async function pedirAulas(turnoId?: string) {
  const respuesta = await fetchAutenticado(`/api/turnos/aula/opciones${turnoId ? `?turno_id=${encodeURIComponent(turnoId)}` : ""}`, { cache: "no-store" });
  const valor = await respuesta.json().catch(() => null);
  if (valor?.error?.code === "SIN_AULAS_ACTIVAS") return { aulas: [] as AulaOpcion[], sinAulas: true };
  if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? "No se pudieron cargar las aulas");
  return { aulas: valor.data as AulaOpcion[], sinAulas: false };
}

/**
 * Configurar turno (HU-C-03) y asignar aula (HU-C-15) en una sola pantalla
 * (spec_modulo_C.md Revisión 3): dos llamadas en secuencia, sin endpoint
 * combinado. Sin `id` crea el turno; con `id` modifica uno PENDIENTE.
 */
export function TurnoConfiguracion({ id, retorno }: { id?: string; retorno: string }) {
  const { setDirty } = useDirtyState();
  // Si el alta crea el turno pero falla el aula, se sigue en modo edición sobre este id.
  const [turnoId, setTurnoId] = useState(id);
  const [campos, setCampos] = useState<Campos>(inicial);
  const [originales, setOriginales] = useState<Campos>(inicial);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [parametros, setParametros] = useState<Parametros | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [aulas, setAulas] = useState<AulaOpcion[]>([]);
  const [sinAulas, setSinAulas] = useState(false);
  const [aulaId, setAulaId] = useState("");
  const [aulaIdOriginal, setAulaIdOriginal] = useState("");
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});
  const [errorAula, setErrorAula] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [avisoHora, setAvisoHora] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setErrorCarga("");
    try {
      const respuestas = await Promise.all([
        fetchAutenticado("/api/turnos/configuracion", { cache: "no-store" }),
        ...(id ? [fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" })] : []),
      ]);
      const valores = await Promise.all(respuestas.map((respuesta) => respuesta.json().catch(() => null)));
      if (!respuestas[0].ok || !valores[0]?.data) throw new Error(valores[0]?.error?.message ?? "No se pudo cargar la configuración");
      const configuracion = valores[0].data.parametros as Parametros;
      const momentoCarga = momentoDelCentro(new Date(), configuracion.zona_horaria);
      if (id && (!respuestas[1].ok || !valores[1]?.data)) throw new Error(valores[1]?.error?.message ?? "No se pudo cargar el turno");
      const actual = id ? valores[1].data as Turno : null;
      // Un turno ya confirmado no admite cambios: no hace falta pedir aulas.
      const opciones = actual && actual.estado !== "PENDIENTE" ? { aulas: [], sinAulas: false } : await pedirAulas(id);
      setMaterias(valores[0].data.materias); setParametros(configuracion); setAhora(new Date());
      setTurno(actual); setAulas(opciones.aulas); setSinAulas(opciones.sinAulas);
      if (actual) {
        const duracionVigente = configuracion.duraciones_permitidas_minutos.includes(actual.duracion_minutos);
        const duracion = duracionVigente ? String(actual.duracion_minutos) : "";
        const horaVigente = opcionesDeHora(actual.fecha, momentoCarga.fecha, momentoCarga.hora, configuracion, duracionEfectiva(duracion, configuracion)).includes(actual.hora_inicio);
        const cargados = { fecha: actual.fecha, duracion_min: String(actual.duracion_minutos), hora_inicio: actual.hora_inicio, materia_id: actual.materia_id };
        setOriginales(cargados);
        setCampos({ ...cargados, duracion_min: duracion, hora_inicio: horaVigente ? actual.hora_inicio : "" });
        if (!duracionVigente) setErrores({ duracion_min: "La duración guardada ya no está permitida. Elegí otra." });
        if (!horaVigente) setAvisoHora("La hora anterior ya no es válida. Elegí otra.");
        const seleccion = actual.aula_id && opciones.aulas.some((aula) => aula.id === actual.aula_id) ? actual.aula_id : "";
        setAulaId(seleccion); setAulaIdOriginal(seleccion);
      }
    } catch (e) { setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar la configuración"); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);

  // Reintento solo de las aulas: tras un alta parcial no debe perderse lo cargado.
  const recargarAulas = async () => {
    setErrorAula("");
    try {
      const opciones = await pedirAulas(turnoId);
      setAulas(opciones.aulas); setSinAulas(opciones.sinAulas);
      if (!opciones.aulas.some((aula) => aula.id === aulaId)) setAulaId("");
    } catch (e) { setErrorAula(e instanceof Error ? e.message : "No se pudieron cargar las aulas"); }
  };
  useEffect(() => { const timer = window.setInterval(() => setAhora(new Date()), 30_000); return () => window.clearInterval(timer); }, []);

  // Cambios sin guardar (HU-A-03 c2): se descartan al guardar o al salir (Cancelar).
  const configuracionCambiada = (Object.keys(campos) as (keyof Campos)[]).some((campo) => campos[campo] !== originales[campo]);
  const sinGuardar = !resultado && (configuracionCambiada || aulaId !== aulaIdOriginal);
  useEffect(() => { setDirty(sinGuardar); }, [sinGuardar, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const momento = parametros && ahora ? momentoDelCentro(ahora, parametros.zona_horaria) : null;
  const maximo = parametros && momento ? fechaMaxima(momento.fecha, parametros.anticipacion_maxima_dias) : "";
  const fechaInvalida = parametros && momento ? errorDeFecha(campos.fecha, momento.fecha, maximo, parametros) : "";
  const horas = parametros && momento ? opcionesDeHora(campos.fecha, momento.fecha, momento.hora, parametros, duracionEfectiva(campos.duracion_min, parametros)) : [];
  const horaInvalida = campos.hora_inicio && !horas.includes(campos.hora_inicio) ? "Elegí una hora de inicio válida para la fecha seleccionada" : "";
  const sinHorarios = Boolean(campos.fecha && !fechaInvalida && horas.length === 0);
  const configuracionValida = Boolean(parametros && momento && campos.fecha && !fechaInvalida && campos.duracion_min && campos.hora_inicio && !horaInvalida && campos.materia_id);
  const puedeGuardar = configuracionValida && !guardando && (!turnoId || sinGuardar);

  const cambiar = (campo: keyof Campos, valor: string) => {
    setCampos((anterior) => ({ ...anterior, [campo]: valor }));
    setErrores((anterior) => ({ ...anterior, [campo]: undefined }));
    if (campo === "hora_inicio") setAvisoHora("");
    setError(""); setAviso("");
  };

  const cambiarFecha = (fecha: string) => {
    const nuevasHoras = parametros && momento ? opcionesDeHora(fecha, momento.fecha, momento.hora, parametros, duracionEfectiva(campos.duracion_min, parametros)) : [];
    if (campos.hora_inicio && !nuevasHoras.includes(campos.hora_inicio)) {
      setCampos((anterior) => ({ ...anterior, fecha, hora_inicio: "" }));
      setAvisoHora("La hora anterior ya no es válida para esta fecha. Elegí otra.");
      setErrores((anterior) => ({ ...anterior, fecha: undefined, hora_inicio: undefined }));
      setError(""); setAviso("");
      return;
    }
    cambiar("fecha", fecha);
    setAvisoHora("");
  };

  // Mismo patrón que cambiarFecha: una hora que deja de entrar se limpia con aviso.
  const cambiarDuracion = (duracion: string) => {
    const nuevasHoras = parametros && momento ? opcionesDeHora(campos.fecha, momento.fecha, momento.hora, parametros, duracionEfectiva(duracion, parametros)) : [];
    if (campos.hora_inicio && !nuevasHoras.includes(campos.hora_inicio)) {
      setCampos((anterior) => ({ ...anterior, duracion_min: duracion, hora_inicio: "" }));
      setAvisoHora("La hora anterior ya no es válida para esta duración. Elegí otra.");
      setErrores((anterior) => ({ ...anterior, duracion_min: undefined, hora_inicio: undefined }));
      setError(""); setAviso("");
      return;
    }
    cambiar("duracion_min", duracion);
  };

  const fin = (() => {
    if (!campos.duracion_min || !horas.includes(campos.hora_inicio)) return "—";
    return horaTexto(minutos(campos.hora_inicio) + Number(campos.duracion_min));
  })();

  const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!puedeGuardar) return;
    setErrores({}); setError(""); setErrorAula(""); setAviso(""); setGuardando(true);
    let idGuardado = turnoId;
    let profesorDesasignado = false;
    try {
      // 1) Configuración (§2.1): alta, o modificación solo si cambió.
      if (!idGuardado || configuracionCambiada) {
        const respuesta = await fetchAutenticado(idGuardado ? `/api/turnos/${encodeURIComponent(idGuardado)}/configuracion` : "/api/turnos", {
          method: idGuardado ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...campos, duracion_min: Number(campos.duracion_min) }), cache: "no-store",
        });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok) {
          const codigo = valor?.error?.code as string | undefined;
          const detalles = valor?.error?.detalles?.fieldErrors as Partial<Record<keyof Campos, string[]>> | undefined;
          if (detalles) setErrores(Object.fromEntries(Object.entries(detalles).map(([clave, mensajes]) => [clave, mensajes?.[0]])));
          else if (codigo && campoError[codigo]) setErrores({ [campoError[codigo]]: valor.error.message });
          else setError(valor?.error?.message ?? "No se pudo guardar el turno");
          return;
        }
        profesorDesasignado = Boolean(valor.data.profesor_desasignado);
        if (!idGuardado) {
          idGuardado = valor.data.id as string;
          setTurnoId(idGuardado);
          // Una recarga ya abre el turno creado, no un alta nueva.
          window.history.replaceState(null, "", `/turnos/${encodeURIComponent(idGuardado)}/configuracion?volver=${encodeURIComponent(retorno)}`);
        }
        setOriginales(campos);
      }
      // 2) Aula (§2.3): fija el cupo con su capacidad. Opcional.
      let aula = turno?.aula_id ? { nombre: turno.aula, cupo: turno.cupo_maximo } : null;
      if (aulaId && aulaId !== aulaIdOriginal) {
        const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(idGuardado)}/aula`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aula_id: aulaId }), cache: "no-store",
        });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !valor?.data) {
          setErrorAula(valor?.error?.message ?? "No se pudo asignar el aula");
          if (!turnoId) setAviso("El turno ya quedó guardado como Pendiente, sin aula. Podés elegir otra aula ahora o asignarla más tarde.");
          return;
        }
        aula = { nombre: aulas.find(({ id: otra }) => otra === aulaId)?.nombre ?? "", cupo: valor.data.cupo_maximo };
        setAulaIdOriginal(aulaId);
      }
      setResultado({ id: idGuardado, fecha: campos.fecha, hora_inicio: campos.hora_inicio, hora_fin: fin, aula: aula?.nombre ?? null, cupo_maximo: aula?.cupo ?? null, profesor_desasignado: profesorDesasignado });
    } catch { setError("No se pudo guardar el turno. Intentá nuevamente."); }
    finally { setGuardando(false); }
  };

  const enlace = "underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const aulaGuardadaNoDisponible = Boolean(turno?.aula_id && !aulas.some((aula) => aula.id === turno.aula_id));
  return <main className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
    <LinkProtegido href={retorno} prefetch={false} className="rounded-sm text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Volver al listado</LinkProtegido>
    <h1 className="text-2xl font-semibold">{id ? "Modificar configuración del turno" : "Configurar turno"}</h1>
    {cargando ? <p role="status">Cargando configuración</p> : errorCarga ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{errorCarga}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : resultado ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground">
      <p className="font-semibold">{id ? "Configuración actualizada" : "Turno configurado"}</p>
      <p>{resultado.fecha} · {resultado.hora_inicio}–{resultado.hora_fin} · {resultado.aula ? `${resultado.aula} · Cupo máximo: ${resultado.cupo_maximo}` : "Sin aula asignada"} · Pendiente</p>
      {resultado.profesor_desasignado && <p>El profesor dejó de corresponder a la materia y fue desasignado. Debe reasignarse.</p>}
      {!resultado.aula && <p>Asigná un aula para poder continuar con profesor y alumnos.</p>}
      <div className="flex flex-wrap gap-4">
        {resultado.aula ? <Link className={enlace} href={`/turnos/${encodeURIComponent(resultado.id)}/participantes?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Continuar con profesor y alumnos</Link>
          : <button type="button" className={enlace} onClick={() => setResultado(null)}>Asignar aula ahora</button>}
        <Link className={enlace} href={`/turnos/${encodeURIComponent(resultado.id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Ver detalle</Link>
        <Link className={enlace} href={retorno} prefetch={false}>Volver al listado</Link>
      </div>
    </div> : turno && turno.estado !== "PENDIENTE" ? <p role="alert">Un turno disponible o completo no admite cambios de configuración.</p> : materias.length === 0 ? <p role="status">No hay materias activas para configurar turnos</p> : <form noValidate onSubmit={(event) => void guardar(event)} className="space-y-5 rounded-md border border-border bg-card p-5 text-card-foreground">
      <p className="text-sm text-muted-foreground">Horario operativo: {parametros?.apertura}–{parametros?.cierre}. Duraciones disponibles: {parametros?.duraciones_permitidas_minutos.map(etiquetaDuracion).join(", ")}. Anticipación máxima: {parametros?.anticipacion_maxima_dias} días.</p>
      <div className="space-y-1"><label htmlFor="fecha" className="text-sm font-medium">Fecha *</label><Input id="fecha" type="date" required min={momento?.fecha} max={maximo} value={campos.fecha} onChange={(e) => cambiarFecha(e.target.value)} aria-invalid={Boolean(errores.fecha || fechaInvalida)} aria-describedby={errores.fecha || fechaInvalida ? "fecha-error" : "fecha-ayuda"} /><p id="fecha-ayuda" className="text-sm text-muted-foreground">Elegí una fecha entre hoy y el {maximo}. Los días no operativos se indican al seleccionarlos.</p>{(errores.fecha || fechaInvalida) && <p id="fecha-error" role="alert" className="text-sm text-destructive">{errores.fecha || fechaInvalida}</p>}</div>
      <fieldset id="duracion" aria-invalid={Boolean(errores.duracion_min)} aria-describedby={errores.duracion_min ? "duracion-error" : "duracion-ayuda"} className="space-y-1">
        <legend className="text-sm font-medium">Duración *</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">{parametros?.duraciones_permitidas_minutos.map((duracion) => <label key={duracion} className="flex items-center gap-2 text-sm"><input type="radio" name="duracion_min" value={String(duracion)} checked={campos.duracion_min === String(duracion)} onChange={(e) => cambiarDuracion(e.target.value)} className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />{etiquetaDuracion(duracion)}</label>)}</div>
        <p id="duracion-ayuda" className="text-sm text-muted-foreground">Elegí cuánto dura el turno. Define la hora de finalización y las horas de inicio disponibles.</p>
        {errores.duracion_min && <p id="duracion-error" role="alert" className="text-sm text-destructive">{errores.duracion_min}</p>}
      </fieldset>
      <div className="space-y-1"><label htmlFor="hora" className="text-sm font-medium">Hora de inicio *</label><select id="hora" required value={campos.hora_inicio} onChange={(e) => cambiar("hora_inicio", e.target.value)} disabled={!campos.fecha || Boolean(fechaInvalida) || horas.length === 0} aria-invalid={Boolean(errores.hora_inicio || horaInvalida || sinHorarios)} aria-describedby={errores.hora_inicio || horaInvalida || sinHorarios ? "hora-error" : avisoHora ? "hora-aviso" : undefined} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"><option value="">Seleccioná una hora</option>{horas.map((hora) => <option key={hora} value={hora}>{hora}</option>)}</select>{avisoHora && !horaInvalida && <p id="hora-aviso" role="status" className="text-sm text-warning-foreground">{avisoHora}</p>}{(errores.hora_inicio || horaInvalida || sinHorarios) && <p id="hora-error" role="alert" className="text-sm text-destructive">{errores.hora_inicio || horaInvalida || "No hay horarios de inicio válidos para esta fecha"}</p>}{fechaInvalida === "El centro no atiende el día seleccionado" && <p className="text-sm text-muted-foreground">No se ofrecen horarios en días no operativos.</p>}</div>
      <p className="text-sm">Hora de finalización: <strong aria-live="polite">{fin}</strong> <span className="text-muted-foreground">(calculada automáticamente; solo lectura)</span></p>
      <div className="space-y-1"><label htmlFor="materia" className="text-sm font-medium">Materia *</label><select id="materia" required value={campos.materia_id} onChange={(e) => cambiar("materia_id", e.target.value)} aria-invalid={Boolean(errores.materia_id)} aria-describedby={errores.materia_id ? "materia-error" : undefined} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Seleccioná una materia</option>{materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}{materia.codigo ? ` (${materia.codigo})` : ""}</option>)}</select><p id="materia-error" className="text-sm text-destructive">{errores.materia_id}</p></div>
      <SeccionAulaTurno aulas={aulas} aulaId={aulaId} aulaIdGuardada={aulaIdOriginal} aulaGuardadaNoDisponible={aulaGuardadaNoDisponible} habilitada={configuracionValida} sinAulas={sinAulas} error={errorAula}
        onCambiar={(valor) => { setAulaId(valor); setErrorAula(""); setAviso(""); setError(""); }} onReintentar={() => void recargarAulas()} />
      {aviso && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">{aviso}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!puedeGuardar}>{guardando ? "Guardando…" : turnoId ? "Guardar cambios" : "Guardar turno"}</Button><Link className={buttonVariants({ variant: "outline" })} href={retorno} prefetch={false}>Cancelar</Link></div>
    </form>}
  </main>;
}
