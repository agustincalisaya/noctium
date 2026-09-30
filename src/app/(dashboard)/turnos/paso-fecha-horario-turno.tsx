"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";

type BloqueAgenda = { inicio: string; fin: string; estado: "LIBRE" | "OCUPADO" | "VENCIDO"; seleccionable: boolean };
type DiaAgenda = {
  fecha: string; dia_semana: string; numero: number; en_rango: boolean; operativo: boolean;
  tiene_horarios_libres: boolean; seleccionable: boolean;
  franjas: { hora_inicio: string; hora_fin: string; bloques: BloqueAgenda[] }[];
};
type Agenda = {
  profesor: { id: string; nombre_completo: string };
  duracion_min: number; granularidad_min: number;
  rango: { desde: string; hasta: string };
  meses: { anio: number; mes: number; etiqueta: string; dias: DiaAgenda[] }[];
};
type Resultado = { clave: string; agenda: Agenda | null; error: string };

type Props = {
  materiaId: string;
  profesorId: string;
  profesorNombre: string;
  duracionesPermitidas: readonly number[];
  duracionMin: number | null;
  fecha: string;
  horaInicio: string;
  onDuracionChange: (duracion: number) => void;
  onFechaChange: (fecha: string) => void;
  onHoraChange: (hora: string) => void;
  onVolverProfesor: () => void;
  onContinuar: () => void;
};

const MENSAJE_VACIO = "Este profesor no tiene horarios disponibles para esta materia en este momento";
const DIAS_CORTOS = ["L", "M", "M", "J", "V", "S", "D"];

export function fechaLegible(fecha: string, incluirAnio = false) {
  const valor = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", ...(incluirAnio ? { year: "numeric" } : {}), timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00.000Z`)).replace(",", "");
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

/** Presenta solo la agenda calculada por Turnos; nunca infiere conflictos en el cliente. */
export function PasoFechaHorarioTurno({ materiaId, profesorId, profesorNombre, duracionesPermitidas, duracionMin, fecha, horaInicio, onDuracionChange, onFechaChange, onHoraChange, onVolverProfesor, onContinuar }: Props) {
  const clave = materiaId && profesorId && duracionMin ? `${materiaId}|${profesorId}|${duracionMin}` : "";
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const [mesVisible, setMesVisible] = useState("");
  const [fechaVista, setFechaVista] = useState<{ clave: string; fecha: string } | null>(null);

  useEffect(() => {
    if (!clave) return;
    const controlador = new AbortController();
    const cargar = async () => {
      try {
        const params = new URLSearchParams({ materia_id: materiaId, duracion_min: String(duracionMin) });
        const respuesta = await fetchAutenticado(`/api/turnos/profesores/${encodeURIComponent(profesorId)}/agenda-wizard?${params}`, { cache: "no-store", signal: controlador.signal });
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !Array.isArray(cuerpo?.data?.meses)) throw new Error(cuerpo?.error?.message ?? "No se pudo cargar la agenda del profesor");
        if (!controlador.signal.aborted) setResultado({ clave, agenda: cuerpo.data, error: "" });
      } catch (causa) {
        if (!controlador.signal.aborted) setResultado({ clave, agenda: null, error: causa instanceof Error ? causa.message : "No se pudo cargar la agenda del profesor" });
      }
    };
    void cargar();
    return () => controlador.abort();
  }, [clave, materiaId, profesorId, duracionMin, intento]);

  const actual = resultado?.clave === clave ? resultado : null;
  const agenda = actual?.agenda;
  const indiceMes = agenda ? Math.max(0, agenda.meses.findIndex((mes) => `${mes.anio}-${String(mes.mes).padStart(2, "0")}` === (mesVisible || fecha.slice(0, 7)))) : 0;
  const mes = agenda?.meses[indiceMes];
  const fechaEnVista = fechaVista?.clave === clave ? fechaVista.fecha : fecha;
  const diaVista = agenda?.meses.flatMap(({ dias }) => dias).find((dia) => dia.fecha === fechaEnVista);
  const horaValida = Boolean(fecha && diaVista?.fecha === fecha && diaVista.franjas.some((franja) => franja.bloques.some((bloque) => bloque.inicio === horaInicio && bloque.seleccionable)));
  const hayDisponibilidad = Boolean(agenda?.meses.some(({ dias }) => dias.some(({ seleccionable }) => seleccionable)));

  const cambiarDuracion = (duracion: number) => {
    if (duracion === duracionMin) return;
    setFechaVista(null);
    onFechaChange("");
    onHoraChange("");
    onDuracionChange(duracion);
  };
  const verDia = (dia: DiaAgenda) => {
    setFechaVista({ clave, fecha: dia.fecha });
    if (!dia.seleccionable) {
      onFechaChange("");
      onHoraChange("");
      return;
    }
    if (dia.fecha !== fecha) {
      if (!dia.franjas.some((franja) => franja.bloques.some((bloque) => bloque.inicio === horaInicio && bloque.seleccionable))) onHoraChange("");
      onFechaChange(dia.fecha);
    }
  };

  return <section aria-labelledby="titulo-fecha-horario" className="space-y-6">
    <div className="space-y-1">
      <h2 id="titulo-fecha-horario" className="text-xl font-semibold">Elegí fecha y horario</h2>
      <p className="text-sm text-muted-foreground">Solo se habilitan días y horarios dentro del horario de atención de {profesorNombre}{agenda ? `, hasta el ${fechaLegible(agenda.rango.hasta)}` : ""}.</p>
    </div>

    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="float-left mr-1 py-2 text-sm font-medium">Duración</legend>
      <div className="inline-flex rounded-lg bg-muted p-1">
        {duracionesPermitidas.map((duracion) => <label key={duracion} className="cursor-pointer rounded-md px-3 py-1.5 text-sm has-checked:bg-card has-checked:font-semibold has-checked:shadow-xs focus-within:ring-2 focus-within:ring-ring">
          <input type="radio" name="duracion_min" value={duracion} checked={duracionMin === duracion} onChange={() => cambiarDuracion(duracion)} className="sr-only" />
          {duracion / 60} h
        </label>)}
      </div>
    </fieldset>

    {!duracionMin ? <p role="status" className="text-sm text-muted-foreground">Elegí una duración para ver fechas y horarios.</p> :
      !materiaId || !profesorId ? <p role="status" className="text-sm text-muted-foreground">Elegí una materia y un profesor para consultar disponibilidad.</p> :
        !actual ? <p role="status">Cargando disponibilidad</p> :
          actual.error ? <div role="alert" className="space-y-3"><p>{actual.error}</p><Button type="button" variant="outline" onClick={() => { setResultado(null); setIntento((valor) => valor + 1); }}>Reintentar</Button></div> :
            !hayDisponibilidad ? <div className="space-y-3"><p role="status">{MENSAJE_VACIO}</p><Button type="button" variant="outline" onClick={onVolverProfesor}>Volver a Profesor</Button></div> :
              <div className="grid gap-6 md:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" className="w-9 px-0" aria-label="Mes anterior" disabled={indiceMes === 0} onClick={() => setMesVisible(`${agenda!.meses[indiceMes - 1]!.anio}-${String(agenda!.meses[indiceMes - 1]!.mes).padStart(2, "0")}`)}>‹</Button>
                    <h3 className="text-sm font-semibold">{mes?.etiqueta}</h3>
                    <Button type="button" variant="outline" size="sm" className="w-9 px-0" aria-label="Mes siguiente" disabled={indiceMes >= (agenda?.meses.length ?? 0) - 1} onClick={() => setMesVisible(`${agenda!.meses[indiceMes + 1]!.anio}-${String(agenda!.meses[indiceMes + 1]!.mes).padStart(2, "0")}`)}>›</Button>
                  </div>
                  <div role="grid" aria-label={`Calendario ${mes?.etiqueta}`} className="grid grid-cols-7 gap-1 text-center text-sm">
                    {DIAS_CORTOS.map((dia, indice) => <span key={indice} className="py-2 text-xs text-muted-foreground">{dia}</span>)}
                    {mes && Array.from({ length: (new Date(Date.UTC(mes.anio, mes.mes - 1, 1)).getUTCDay() + 6) % 7 }, (_, indice) => <span key={`vacio-${indice}`} aria-hidden="true" />)}
                    {mes?.dias.map((dia) => {
                      const seleccionado = dia.seleccionable && fecha === dia.fecha;
                      const conHorario = dia.en_rango && dia.franjas.length > 0;
                      const estado = seleccionado ? "seleccionado" : dia.seleccionable ? "libre" : conHorario ? "sin-libres" : "sin-horario";
                      return <button key={dia.fecha} type="button" data-fecha={dia.fecha} data-estado={estado} aria-pressed={seleccionado}
                        aria-label={`${fechaLegible(dia.fecha, true)}, ${dia.seleccionable ? "con horarios libres" : conHorario ? "con horario sin bloques libres" : "sin horarios"}`}
                        disabled={!dia.en_rango || !conHorario} onClick={() => verDia(dia)}
                        className={`aspect-square rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${seleccionado ? "bg-primary font-semibold text-primary-foreground" : dia.seleccionable ? "bg-success/20 font-semibold text-foreground hover:bg-success/30" : conHorario ? "border border-border text-muted-foreground hover:bg-muted" : "text-muted-foreground/70"}`}>
                        {dia.numero}
                      </button>;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-3 rounded-sm border border-success bg-success/20" />Con horarios libres</span><span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-primary" />Seleccionado</span></div>
                </div>
                <div className="min-w-0 space-y-4 border-t border-border pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  {!diaVista ? <p className="text-sm text-muted-foreground">Elegí un día marcado en el calendario para ver los horarios.</p> : <>
                    <h3 className="font-semibold">{fechaLegible(diaVista.fecha)}</h3>
                    {diaVista.franjas.map((franja, indice) => <div key={`${franja.hora_inicio}-${franja.hora_fin}-${indice}`} className="space-y-3">
                      <p className="text-sm text-muted-foreground">Horario de atención: {franja.hora_inicio}–{franja.hora_fin}</p>
                      {franja.bloques.length === 0 ? <p className="text-sm text-muted-foreground">No hay bloques que admitan esta duración.</p> :
                        <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><legend className="sr-only">Horario</legend>
                          {franja.bloques.map((bloque) => <label key={`${bloque.inicio}-${bloque.fin}`} data-estado={bloque.estado}
                            className={`rounded-lg border p-2 text-center text-sm tabular-nums ${bloque.estado === "OCUPADO" ? "cursor-not-allowed bg-muted text-muted-foreground line-through" : bloque.estado === "VENCIDO" ? "cursor-not-allowed text-muted-foreground" : horaInicio === bloque.inicio && fecha === diaVista.fecha ? "cursor-pointer border-primary bg-primary font-medium text-primary-foreground" : "cursor-pointer border-border hover:bg-accent"}`}>
                            <input type="radio" name="hora_inicio" value={bloque.inicio} checked={fecha === diaVista.fecha && horaInicio === bloque.inicio && bloque.seleccionable}
                              disabled={!bloque.seleccionable || fecha !== diaVista.fecha} onChange={() => onHoraChange(bloque.inicio)} className="sr-only" />
                            {bloque.inicio}–{bloque.fin}
                          </label>)}
                        </fieldset>}
                    </div>)}
                    {diaVista.franjas.some((franja) => franja.bloques.some((bloque) => bloque.estado === "OCUPADO")) && <p className="text-sm text-muted-foreground">Los horarios tachados no están disponibles: el profesor ya tiene un turno.</p>}
                  </>}
                </div>
              </div>}

    <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onVolverProfesor}>Atrás</Button>
      <Button type="button" onClick={onContinuar} disabled={!duracionMin || !fecha || !horaValida || !actual?.agenda}>Continuar a aula</Button>
    </div>
  </section>;
}
