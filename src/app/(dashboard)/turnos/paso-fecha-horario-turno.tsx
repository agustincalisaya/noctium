"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";

type FranjaDisponible = {
  hora_inicio: string;
  hora_fin: string;
  tramos_libres: { desde: string; hasta: string }[];
  inicios: string[];
};
type FechaDisponible = { fecha: string; dia_semana: string; franjas: FranjaDisponible[] };
type Disponibilidad = { fechas: FechaDisponible[] };

type Props = {
  materiaId: string;
  profesorId: string;
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

/** Presentación de HU-C-07: el servidor es la única fuente de inicios posibles. */
export function PasoFechaHorarioTurno({ materiaId, profesorId, duracionesPermitidas, duracionMin, fecha, horaInicio, onDuracionChange, onFechaChange, onHoraChange, onVolverProfesor, onContinuar }: Props) {
  const clave = materiaId && profesorId && duracionMin ? `${materiaId}|${profesorId}|${duracionMin}` : "";
  const [resultado, setResultado] = useState<{ clave: string; disponibilidad: Disponibilidad } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!clave) return;
    const controlador = new AbortController();
    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const params = new URLSearchParams({ materia_id: materiaId, duracion_min: String(duracionMin) });
        const respuesta = await fetchAutenticado(`/api/turnos/profesores/${encodeURIComponent(profesorId)}/disponibilidad?${params}`, { cache: "no-store", signal: controlador.signal });
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !Array.isArray(cuerpo?.data?.fechas)) throw new Error(cuerpo?.error?.message ?? "No se pudo cargar la disponibilidad del profesor");
        if (!controlador.signal.aborted) setResultado({ clave, disponibilidad: cuerpo.data });
      } catch (causa) {
        if (!controlador.signal.aborted) setError(causa instanceof Error ? causa.message : "No se pudo cargar la disponibilidad del profesor");
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    };
    void cargar();
    return () => controlador.abort();
  }, [clave, materiaId, profesorId, duracionMin, intento]);

  const disponibilidad = resultado?.clave === clave && !error ? resultado.disponibilidad : null;
  const fechas = disponibilidad?.fechas ?? [];
  const elegida = fechas.find((opcion) => opcion.fecha === fecha);
  const inicios = [...new Set(elegida?.franjas.flatMap((franja) => franja.inicios) ?? [])];
  const horaValida = inicios.includes(horaInicio);

  const cambiarDuracion = (duracion: number) => {
    if (duracion === duracionMin) return;
    setResultado(null);
    onFechaChange("");
    onHoraChange("");
    onDuracionChange(duracion);
  };
  const cambiarFecha = (nuevaFecha: string) => {
    if (nuevaFecha === fecha) return;
    const nueva = fechas.find((opcion) => opcion.fecha === nuevaFecha);
    if (!nueva?.franjas.some((franja) => franja.inicios.includes(horaInicio))) onHoraChange("");
    onFechaChange(nuevaFecha);
  };

  return <section aria-labelledby="titulo-fecha-horario" className="space-y-6">
    <div className="space-y-1">
      <h2 id="titulo-fecha-horario" className="text-xl font-semibold">Elegí fecha y horario</h2>
      <p className="text-sm text-muted-foreground">Elegí la duración para consultar los horarios disponibles del profesor.</p>
    </div>

    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Duración</legend>
      <div className="flex flex-wrap gap-2">
        {duracionesPermitidas.map((duracion) => <label key={duracion} className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-muted">
          <input type="radio" name="duracion_min" value={duracion} checked={duracionMin === duracion} onChange={() => cambiarDuracion(duracion)} className="mr-2 accent-primary" />
          {duracion / 60} h
        </label>)}
      </div>
    </fieldset>

    {!duracionMin ? <p role="status" className="text-sm text-muted-foreground">Elegí una duración para ver fechas y horarios.</p> :
      !materiaId || !profesorId ? <p role="status" className="text-sm text-muted-foreground">Elegí una materia y un profesor para consultar disponibilidad.</p> :
        cargando || (!disponibilidad && !error) ? <p role="status">Cargando disponibilidad</p> :
          error ? <div role="alert" className="space-y-3"><p>{error}</p><Button type="button" variant="outline" onClick={() => setIntento((actual) => actual + 1)}>Reintentar</Button></div> :
            fechas.length === 0 ? <div className="space-y-3"><p role="status">{MENSAJE_VACIO}</p><Button type="button" variant="outline" onClick={onVolverProfesor}>Volver a Profesor</Button></div> :
              <div className="space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Fechas disponibles</legend>
                  <div className="flex flex-wrap gap-2">{fechas.map((opcion) => <button key={opcion.fecha} type="button" aria-pressed={fecha === opcion.fecha} onClick={() => cambiarFecha(opcion.fecha)} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-muted">
                    {opcion.fecha} · {opcion.dia_semana}
                  </button>)}</div>
                </fieldset>
                {elegida && <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Horarios disponibles para {fecha}</legend>
                  <div className="flex flex-wrap gap-2">{inicios.map((inicio) => <button key={inicio} type="button" aria-pressed={horaInicio === inicio} onClick={() => onHoraChange(inicio)} className="rounded-md border border-border px-3 py-2 text-sm tabular-nums hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-muted">{inicio}</button>)}</div>
                </fieldset>}
              </div>}

    <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onVolverProfesor}>Atrás</Button>
      <Button type="button" onClick={onContinuar} disabled={!duracionMin || !fecha || !horaValida || cargando || Boolean(error)}>Continuar a aula</Button>
    </div>
  </section>;
}
