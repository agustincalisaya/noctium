"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { Turno } from "./turno.types";

type Materia = { id: string; nombre: string; codigo: string | null };
type Parametros = { zona_horaria: string; duracion_minutos: number; granularidad_minutos: number; dias_operativos: string[]; apertura: string; cierre: string; anticipacion_maxima_dias: number };
type Campos = { fecha: string; hora_inicio: string; materia_id: string };
const inicial: Campos = { fecha: "", hora_inicio: "", materia_id: "" };
const campoError: Record<string, keyof Campos> = { FECHA_PASADA: "fecha", DIA_NO_OPERATIVO: "fecha", ANTICIPACION_EXCEDIDA: "fecha", HORA_NO_GRANULAR: "hora_inicio", FUERA_DE_HORARIO_OPERATIVO: "hora_inicio", MATERIA_NO_DISPONIBLE: "materia_id" };
const dias = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

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

function opcionesDeHora(fecha: string, hoy: string, horaActual: string, parametros: Parametros) {
  if (!fecha || errorDeFecha(fecha, hoy, fechaMaxima(hoy, parametros.anticipacion_maxima_dias), parametros)) return [];
  const paso = parametros.granularidad_minutos;
  const ultima = Math.min(minutos(parametros.cierre) - parametros.duracion_minutos, 1439 - parametros.duracion_minutos);
  const opciones: string[] = [];
  for (let inicio = Math.ceil(minutos(parametros.apertura) / paso) * paso; inicio <= ultima; inicio += paso) {
    if (fecha !== hoy || inicio > minutos(horaActual)) opciones.push(horaTexto(inicio));
  }
  return opciones;
}

export function TurnoConfiguracion({ id, retorno }: { id?: string; retorno: string }) {
  const [campos, setCampos] = useState<Campos>(inicial);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [parametros, setParametros] = useState<Parametros | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [avisoHora, setAvisoHora] = useState("");
  const [resultado, setResultado] = useState<{ id: string; fecha: string; hora_inicio: string; hora_fin: string; profesor_desasignado?: boolean } | null>(null);

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
      setMaterias(valores[0].data.materias); setParametros(configuracion); setAhora(new Date());
      if (id) {
        if (!respuestas[1].ok || !valores[1]?.data) throw new Error(valores[1]?.error?.message ?? "No se pudo cargar el turno");
        const actual = valores[1].data as Turno;
        setTurno(actual);
        const horaVigente = opcionesDeHora(actual.fecha, momentoCarga.fecha, momentoCarga.hora, configuracion).includes(actual.hora_inicio);
        setCampos({ fecha: actual.fecha, hora_inicio: horaVigente ? actual.hora_inicio : "", materia_id: actual.materia_id });
        if (!horaVigente) setAvisoHora("La hora anterior ya no es válida. Elegí otra.");
      }
    } catch (e) { setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar la configuración"); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);
  useEffect(() => { const timer = window.setInterval(() => setAhora(new Date()), 30_000); return () => window.clearInterval(timer); }, []);

  const momento = parametros && ahora ? momentoDelCentro(ahora, parametros.zona_horaria) : null;
  const maximo = parametros && momento ? fechaMaxima(momento.fecha, parametros.anticipacion_maxima_dias) : "";
  const fechaInvalida = parametros && momento ? errorDeFecha(campos.fecha, momento.fecha, maximo, parametros) : "";
  const horas = parametros && momento ? opcionesDeHora(campos.fecha, momento.fecha, momento.hora, parametros) : [];
  const horaInvalida = campos.hora_inicio && !horas.includes(campos.hora_inicio) ? "Elegí una hora de inicio válida para la fecha seleccionada" : "";
  const sinHorarios = Boolean(campos.fecha && !fechaInvalida && horas.length === 0);
  const puedeGuardar = Boolean(parametros && momento && campos.fecha && !fechaInvalida && campos.hora_inicio && !horaInvalida && campos.materia_id && !guardando);

  const cambiar = (campo: keyof Campos, valor: string) => {
    setCampos((anterior) => ({ ...anterior, [campo]: valor }));
    setErrores((anterior) => ({ ...anterior, [campo]: undefined }));
    if (campo === "hora_inicio") setAvisoHora("");
    setError("");
  };

  const cambiarFecha = (fecha: string) => {
    const nuevasHoras = parametros && momento ? opcionesDeHora(fecha, momento.fecha, momento.hora, parametros) : [];
    if (campos.hora_inicio && !nuevasHoras.includes(campos.hora_inicio)) {
      setCampos((anterior) => ({ ...anterior, fecha, hora_inicio: "" }));
      setAvisoHora("La hora anterior ya no es válida para esta fecha. Elegí otra.");
      setErrores((anterior) => ({ ...anterior, fecha: undefined, hora_inicio: undefined }));
      setError("");
      return;
    }
    cambiar("fecha", fecha);
    setAvisoHora("");
  };

  const fin = (() => {
    if (!parametros || !horas.includes(campos.hora_inicio)) return "—";
    return horaTexto(minutos(campos.hora_inicio) + parametros.duracion_minutos);
  })();

  const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!puedeGuardar) return;
    setErrores({}); setError(""); setGuardando(true);
    try {
      const respuesta = await fetchAutenticado(id ? `/api/turnos/${encodeURIComponent(id)}/configuracion` : "/api/turnos", {
        method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campos), cache: "no-store",
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
      setResultado(valor.data);
    } catch { setError("No se pudo guardar el turno. Intentá nuevamente."); }
    finally { setGuardando(false); }
  };

  return <main className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
    <Link href={retorno} prefetch={false} className="rounded-sm text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Volver al listado</Link>
    <h1 className="text-2xl font-semibold">{id ? "Modificar configuración del turno" : "Configurar turno"}</h1>
    {cargando ? <p role="status">Cargando configuración</p> : errorCarga ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{errorCarga}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : resultado ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground"><p className="font-semibold">{id ? "Configuración actualizada" : "Turno configurado"}</p><p>{resultado.fecha} · {resultado.hora_inicio}–{resultado.hora_fin} · Pendiente</p>{resultado.profesor_desasignado && <p>El profesor dejó de corresponder a la materia y fue desasignado. Debe reasignarse.</p>}<div className="flex flex-wrap gap-4"><Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</Link><Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(resultado.id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Ver detalle</Link>{!id && <Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(resultado.id)}/participantes?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Continuar con alumno y profesor</Link>}</div></div> : turno?.estado === "AGENDADO" ? <p role="alert">Un turno agendado no admite cambios de configuración.</p> : materias.length === 0 ? <p role="status">No hay materias activas para configurar turnos</p> : <form noValidate onSubmit={(event) => void guardar(event)} className="space-y-5 rounded-md border border-border bg-card p-5 text-card-foreground">
      <p className="text-sm text-muted-foreground">Horario operativo: {parametros?.apertura}–{parametros?.cierre}. Duración: {parametros?.duracion_minutos} minutos. Anticipación máxima: {parametros?.anticipacion_maxima_dias} días.</p>
      <div className="space-y-1"><label htmlFor="fecha" className="text-sm font-medium">Fecha *</label><Input id="fecha" type="date" required min={momento?.fecha} max={maximo} value={campos.fecha} onChange={(e) => cambiarFecha(e.target.value)} aria-invalid={Boolean(errores.fecha || fechaInvalida)} aria-describedby={errores.fecha || fechaInvalida ? "fecha-error" : "fecha-ayuda"} /><p id="fecha-ayuda" className="text-sm text-muted-foreground">Elegí una fecha entre hoy y el {maximo}. Los días no operativos se indican al seleccionarlos.</p>{(errores.fecha || fechaInvalida) && <p id="fecha-error" role="alert" className="text-sm text-destructive">{errores.fecha || fechaInvalida}</p>}</div>
      <div className="space-y-1"><label htmlFor="hora" className="text-sm font-medium">Hora de inicio *</label><select id="hora" required value={campos.hora_inicio} onChange={(e) => cambiar("hora_inicio", e.target.value)} disabled={!campos.fecha || Boolean(fechaInvalida) || horas.length === 0} aria-invalid={Boolean(errores.hora_inicio || horaInvalida || sinHorarios)} aria-describedby={errores.hora_inicio || horaInvalida || sinHorarios ? "hora-error" : avisoHora ? "hora-aviso" : undefined} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"><option value="">Seleccioná una hora</option>{horas.map((hora) => <option key={hora} value={hora}>{hora}</option>)}</select>{avisoHora && !horaInvalida && <p id="hora-aviso" role="status" className="text-sm text-warning-foreground">{avisoHora}</p>}{(errores.hora_inicio || horaInvalida || sinHorarios) && <p id="hora-error" role="alert" className="text-sm text-destructive">{errores.hora_inicio || horaInvalida || "No hay horarios de inicio válidos para esta fecha"}</p>}{fechaInvalida === "El centro no atiende el día seleccionado" && <p className="text-sm text-muted-foreground">No se ofrecen horarios en días no operativos.</p>}</div>
      <p className="text-sm">Hora de finalización: <strong aria-live="polite">{fin}</strong> <span className="text-muted-foreground">(calculada automáticamente; solo lectura)</span></p>
      <div className="space-y-1"><label htmlFor="materia" className="text-sm font-medium">Materia *</label><select id="materia" required value={campos.materia_id} onChange={(e) => cambiar("materia_id", e.target.value)} aria-invalid={Boolean(errores.materia_id)} aria-describedby={errores.materia_id ? "materia-error" : undefined} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Seleccioná una materia</option>{materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}{materia.codigo ? ` (${materia.codigo})` : ""}</option>)}</select><p id="materia-error" className="text-sm text-destructive">{errores.materia_id}</p></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!puedeGuardar}>{guardando ? "Guardando…" : id ? "Guardar cambios" : "Configurar turno"}</Button><Link className={buttonVariants({ variant: "outline" })} href={retorno} prefetch={false}>Cancelar</Link></div>
    </form>}
  </main>;
}
