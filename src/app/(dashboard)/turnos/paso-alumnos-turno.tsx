"use client";

import { Button } from "@/components/ui/button";
import { BuscadorAlumnos, etiquetaAlumno, type AlumnoBuscado } from "./buscador-alumnos";

export type AlumnoSeleccionadoTurno = { id: string; nombre: string; dni: string };

export function PasoAlumnosTurno({ alumnos, cupo, bloqueado, errorAlumno, onAgregar, onQuitar }: {
  alumnos: AlumnoSeleccionadoTurno[];
  cupo: number;
  bloqueado: boolean;
  errorAlumno: { id: string; mensaje: string } | null;
  onAgregar: (alumno: AlumnoSeleccionadoTurno) => void;
  onQuitar: (id: string) => void;
}) {
  const cupoAlcanzado = alumnos.length >= cupo;
  const agregar = (alumno: AlumnoBuscado) => {
    if (!bloqueado && !cupoAlcanzado && !alumnos.some(({ id }) => id === alumno.id)) onAgregar({ id: alumno.id, nombre: etiquetaAlumno(alumno), dni: alumno.dni });
  };
  return <section aria-labelledby="titulo-paso-alumnos" className="space-y-5">
    <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Paso 5 de 5</p><h2 id="titulo-paso-alumnos" className="text-xl font-semibold">Agregá alumnos</h2><p className="text-sm text-muted-foreground">Elegí al menos un alumno para confirmar el turno.</p></div>
    <fieldset className="space-y-3"><legend className="text-sm font-medium">Alumnos <span className="font-normal text-muted-foreground">({alumnos.length}/{cupo})</span></legend>
      {alumnos.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no agregaste alumnos.</p> :
        <ul aria-label="Alumnos agregados" className="space-y-2">{alumnos.map((alumno) => <li key={alumno.id} className={`space-y-1 rounded-md border p-3 ${errorAlumno?.id === alumno.id ? "border-destructive" : "border-border"}`}>
          <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-words text-sm">{alumno.nombre} · DNI {alumno.dni}</span><Button type="button" variant="outline" size="sm" disabled={bloqueado} onClick={() => onQuitar(alumno.id)} aria-label={`Quitar a ${alumno.nombre}`}>Quitar</Button></div>
          {errorAlumno?.id === alumno.id && <p role="alert" className="text-sm text-destructive">{errorAlumno.mensaje}</p>}
        </li>)}</ul>}
      <label htmlFor="alumno-busqueda-wizard" className="sr-only">Buscar alumno</label>
      <BuscadorAlumnos id="alumno-busqueda-wizard" excluir={alumnos.map(({ id }) => id)} deshabilitado={cupoAlcanzado || bloqueado}
        avisoDeshabilitado={cupoAlcanzado ? "El turno alcanzó su cupo máximo" : undefined} onSeleccionar={agregar} />
    </fieldset>
  </section>;
}
