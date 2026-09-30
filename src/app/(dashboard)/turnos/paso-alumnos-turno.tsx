"use client";

import { useState } from "react";

export type AlumnoOpcionTurno = { id: string; nombre: string; apellido: string; dni: string };
export type AlumnoSeleccionadoTurno = { id: string; nombre: string; dni: string };

export function PasoAlumnosTurno({ opciones, alumnos, cupo, bloqueado, errorAlumno, estadoPredictivo, onAgregar, onQuitar }: {
  opciones: AlumnoOpcionTurno[];
  alumnos: AlumnoSeleccionadoTurno[];
  cupo: number;
  bloqueado: boolean;
  errorAlumno: { id: string; mensaje: string } | null;
  estadoPredictivo: "Disponible" | "Completo";
  onAgregar: (alumno: AlumnoSeleccionadoTurno) => void;
  onQuitar: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const texto = busqueda.trim().toLocaleLowerCase("es");
  const visibles = opciones.filter(({ nombre, apellido, dni }) =>
    !texto || nombre.toLocaleLowerCase("es").includes(texto) || apellido.toLocaleLowerCase("es").includes(texto) || dni.toLocaleLowerCase("es").includes(texto));
  const seleccionados = new Set(alumnos.map(({ id }) => id));
  return <section aria-labelledby="titulo-paso-alumnos" className="space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1"><h2 id="titulo-paso-alumnos" className="text-xl font-semibold">Inscribí alumnos</h2>
        <p className="text-sm text-muted-foreground">El turno se va a crear en estado {estadoPredictivo}, con {alumnos.length} {alumnos.length === 1 ? "alumno" : "alumnos"}</p></div>
      <span aria-live="polite" className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium">{alumnos.length} de {cupo}</span>
    </div>
    <div className="space-y-3">
      <label htmlFor="alumno-busqueda-wizard" className="sr-only">Buscar alumno</label>
      <input id="alumno-busqueda-wizard" type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar alumno por nombre, apellido o DNI..." className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <fieldset className="max-h-[28rem] space-y-2 overflow-y-auto pr-1"><legend className="sr-only">Alumnos elegibles</legend>
        {visibles.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{opciones.length === 0 ? "No hay alumnos disponibles para este turno." : "No hay alumnos elegibles que coincidan con la búsqueda."}</p> : visibles.map((alumno) => {
          const marcado = seleccionados.has(alumno.id);
          return <label key={alumno.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${errorAlumno?.id === alumno.id ? "border-destructive" : marcado ? "border-primary bg-primary/5" : "border-border"}`}>
            <input type="checkbox" checked={marcado} disabled={bloqueado || (!marcado && alumnos.length >= cupo)}
              onChange={() => marcado ? onQuitar(alumno.id) : onAgregar({ id: alumno.id, nombre: `${alumno.nombre} ${alumno.apellido}`, dni: alumno.dni })} />
            <span className="min-w-0"><span className={marcado ? "font-semibold" : "font-normal"}>{alumno.apellido}, {alumno.nombre}</span> <span className="text-muted-foreground">{alumno.dni}</span></span>
            {errorAlumno?.id === alumno.id && <span role="alert" className="ml-auto text-xs text-destructive">{errorAlumno.mensaje}</span>}
          </label>;
        })}
      </fieldset>
    </div>
  </section>;
}
