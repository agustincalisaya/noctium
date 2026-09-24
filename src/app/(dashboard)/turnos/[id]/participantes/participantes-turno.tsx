"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { Turno } from "../../turno.types";

type Alumno = { id: string; nombre: string; apellido: string; dni: string };
type Profesor = { id: string; nombre: string; apellido: string };
const etiquetaAlumno = (alumno: Alumno) => `${alumno.apellido}, ${alumno.nombre} · DNI ${alumno.dni}`;

export function ParticipantesTurno({ id, retorno }: { id: string; retorno: string }) {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [profesorId, setProfesorId] = useState("");
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Alumno[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data) throw new Error(valor?.error?.message ?? "No se pudo cargar el turno");
      const actual = valor.data as Turno;
      const opcionesRespuesta = await fetchAutenticado(`/api/turnos/participantes/profesores?materiaId=${encodeURIComponent(actual.materia_id)}`, { cache: "no-store" });
      const opciones = await opcionesRespuesta.json().catch(() => null);
      if (!opcionesRespuesta.ok || !opciones?.data) throw new Error(opciones?.error?.message ?? "No se pudieron cargar los profesores");
      setTurno(actual); setProfesores(opciones.data);
      setProfesorId((opciones.data as Profesor[]).some((profesor) => profesor.id === actual.profesor_id) ? actual.profesor_id! : "");
      const asignado = actual.alumnos[0];
      setAlumno(asignado ? { id: asignado.id, nombre: asignado.nombre.split(", ").slice(1).join(", "), apellido: asignado.nombre.split(", ")[0], dni: asignado.dni } : null);
      setQuery(""); setResultados([]);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el turno"); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);
  useEffect(() => {
    if (query.trim().length < 2 || alumno) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const respuesta = await fetchAutenticado(`/api/turnos/participantes/alumnos?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudo buscar alumnos");
        setResultados(valor.data ?? []);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo buscar alumnos"); }
      finally { if (!controller.signal.aborted) setBuscando(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, alumno]);

  const cambiarBusqueda = (valor: string) => { setQuery(valor); setAlumno(null); setResultados([]); setError(""); };
  const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!alumno || !profesorId || guardando) return;
    setGuardando(true); setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}/participantes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: alumno.id, profesor_id: profesorId }), cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudieron asignar los participantes");
      setExito(true);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron asignar los participantes"); }
    finally { setGuardando(false); }
  };

  return <main className="mx-auto w-full max-w-2xl space-y-5 p-6">
    <Link className="text-primary underline" href={retorno} prefetch={false}>Volver al listado</Link>
    <h1 className="text-2xl font-semibold">Asignar alumno y profesor</h1>
    {cargando ? <p role="status">Cargando turno</p> : exito ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground"><p className="font-semibold">Alumno y profesor asignados correctamente</p><Link className="underline" href={`/turnos/${encodeURIComponent(id)}/aula?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Continuar con aula</Link></div> : !turno ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : turno.estado !== "PENDIENTE" ? <p role="alert">Un turno disponible o completo no admite cambios de participantes.</p> : <form onSubmit={(event) => void guardar(event)} className="space-y-5 rounded-md border border-border bg-card p-5">
      <p>{turno.fecha} · {turno.hora_inicio}–{turno.hora_fin} · {turno.materia}</p>
      <div className="space-y-2"><label htmlFor="alumno-busqueda" className="text-sm font-medium">Alumno *</label>
        {alumno && <p>Seleccionado: {etiquetaAlumno(alumno)} <Button type="button" variant="outline" onClick={() => { setAlumno(null); setQuery(""); }}>Cambiar</Button></p>}
        {!alumno && <><Input id="alumno-busqueda" value={query} onChange={(event) => cambiarBusqueda(event.target.value)} placeholder="Nombre, apellido o DNI (mínimo 2 caracteres)" autoComplete="off" />
          {query.trim().length >= 2 && <div role="status">{buscando ? "Buscando…" : resultados.length === 0 ? "No se encontraron alumnos activos" : `${resultados.length} resultados`}</div>}
          {resultados.length > 0 && <ul className="space-y-1" aria-label="Resultados de alumnos">{resultados.map((opcion) => <li key={opcion.id}><Button type="button" variant="outline" className="h-auto w-full justify-start text-left" onClick={() => { setAlumno(opcion); setQuery(""); setResultados([]); }}>{etiquetaAlumno(opcion)}</Button></li>)}</ul>}</>}
      </div>
      <div className="space-y-2"><label htmlFor="profesor" className="text-sm font-medium">Profesor *</label>
        {profesores.length === 0 ? <p role="status">No hay profesores activos asociados a esta materia</p> : <select id="profesor" value={profesorId} onChange={(event) => { setProfesorId(event.target.value); setError(""); }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Seleccioná un profesor</option>{profesores.map((profesor) => <option key={profesor.id} value={profesor.id}>{profesor.apellido}, {profesor.nombre}</option>)}</select>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3"><Button type="submit" disabled={!alumno || !profesorId || guardando}>{guardando ? "Guardando…" : "Confirmar participantes"}</Button><Link className={buttonVariants({ variant: "outline" })} href={`/turnos/${encodeURIComponent(id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Cancelar</Link></div>
    </form>}
  </main>;
}
