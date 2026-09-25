"use client";

import Link from "next/link";
import { LinkProtegido } from "@/components/sesion/link-protegido";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { BuscadorAlumnos, etiquetaAlumno } from "../../buscador-alumnos";
import { EstadoTurnoBadge } from "../../estado-turno-badge";
import type { Turno } from "../../turno.types";

type Profesor = { id: string; nombre: string; apellido: string };
/** Mismo formato que `Turno.alumnos`: `nombre` ya es "Apellido, Nombre". */
type AlumnoAgregado = Turno["alumnos"][number];

const mismosIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

export function ParticipantesTurno({ id, retorno }: { id: string; retorno: string }) {
  const { setDirty } = useDirtyState();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoAgregado[]>([]);
  const [profesorId, setProfesorId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [errorAlumno, setErrorAlumno] = useState<{ id: string; mensaje: string } | null>(null);
  const [sinProfesoresMateria, setSinProfesoresMateria] = useState(false);
  const [confirmado, setConfirmado] = useState<Turno["estado"] | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data) throw new Error(valor?.error?.message ?? "No se pudo cargar el turno");
      const actual = valor.data as Turno;
      let opciones: Profesor[] = [];
      let sinProfesores = false;
      // Solo un turno pendiente con aula puede confirmarse (§2.2): recién ahí hay profesores para ofrecer (§2.6).
      if (actual.estado === "PENDIENTE" && actual.aula_id) {
        const opcionesRespuesta = await fetchAutenticado(`/api/turnos/profesores/opciones?turno_id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const valorOpciones = await opcionesRespuesta.json().catch(() => null);
        sinProfesores = valorOpciones?.error?.code === "SIN_PROFESORES_PARA_MATERIA";
        if (!sinProfesores && (!opcionesRespuesta.ok || !Array.isArray(valorOpciones?.data))) throw new Error(valorOpciones?.error?.message ?? "No se pudieron cargar los profesores");
        opciones = sinProfesores ? [] : valorOpciones.data;
      }
      setTurno(actual); setProfesores(opciones); setSinProfesoresMateria(sinProfesores); setAlumnos(actual.alumnos);
      setProfesorId(opciones.some((profesor) => profesor.id === actual.profesor_id) ? actual.profesor_id! : "");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el turno"); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);

  // Cambios sin guardar (HU-A-03 c2): se descartan al confirmar o al salir (Cancelar, c10).
  const sinGuardar = Boolean(turno && !confirmado && (profesorId !== (turno.profesor_id ?? "") || !mismosIds(alumnos.map(({ id: alumnoId }) => alumnoId), turno.alumnos.map(({ id: alumnoId }) => alumnoId))));
  useEffect(() => { setDirty(sinGuardar); }, [sinGuardar, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const cupo = turno?.cupo_maximo ?? 0;
  const cupoAlcanzado = alumnos.length >= cupo;
  const limpiarErrores = () => { setError(""); setErrorAlumno(null); };
  const agregar = (alumno: AlumnoAgregado) => { if (!cupoAlcanzado) { setAlumnos((anteriores) => [...anteriores, alumno]); limpiarErrores(); } };
  const quitar = (alumnoId: string) => { setAlumnos((anteriores) => anteriores.filter(({ id: otro }) => otro !== alumnoId)); limpiarErrores(); };

  const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (alumnos.length === 0 || !profesorId || guardando) return;
    setGuardando(true); limpiarErrores();
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}/participantes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_ids: alumnos.map(({ id: alumnoId }) => alumnoId), profesor_id: profesorId }), cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        const mensaje = valor?.error?.message ?? "No se pudieron asignar los participantes";
        const alumnoId = valor?.error?.detalles?.alumno_id;
        if (typeof alumnoId === "string" && alumnos.some(({ id: otro }) => otro === alumnoId)) setErrorAlumno({ id: alumnoId, mensaje });
        else setError(mensaje);
        return;
      }
      setConfirmado(valor.data.estado);
    } catch { setError("No se pudieron asignar los participantes. Intentá nuevamente."); }
    finally { setGuardando(false); }
  };

  return <main className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
    <LinkProtegido className="rounded-sm text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</LinkProtegido>
    <h1 className="text-2xl font-semibold">Asignar profesor y alumnos</h1>
    {cargando ? <p role="status">Cargando turno</p> : confirmado ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground"><p className="font-semibold">Profesor y alumnos asignados correctamente</p><p className="flex flex-wrap items-center gap-2">Turno confirmado <EstadoTurnoBadge estado={confirmado} /></p><div className="flex flex-wrap gap-4"><Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Ver detalle</Link><Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</Link></div></div> : !turno ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : turno.estado !== "PENDIENTE" ? <p role="alert">Un turno disponible o completo no admite cambios de participantes. Los alumnos se agregan o quitan desde el detalle del turno.</p> : !turno.aula_id ? <div role="status" className="space-y-3 rounded-md border border-border bg-card p-5"><p>Asigná un aula antes de confirmar el turno.</p><Link className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/configuracion?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Asignar aula</Link></div> : <form onSubmit={(event) => void guardar(event)} className="space-y-5 rounded-md border border-border bg-card p-5 text-card-foreground">
      <div className="space-y-1"><p className="font-medium">{turno.fecha} · {turno.hora_inicio}–{turno.hora_fin} · {turno.materia}</p><p className="text-sm text-muted-foreground">Aula: {turno.aula} · Cupo máximo: {turno.cupo_maximo}</p><EstadoTurnoBadge estado={turno.estado} /></div>
      <div className="space-y-2"><label htmlFor="profesor" className="text-sm font-medium">Profesor *</label>
        {sinProfesoresMateria ? <p role="status">No hay profesores activos asociados a esta materia</p> : profesores.length === 0 ? <p role="status">No hay profesores disponibles para este horario</p> : <select id="profesor" value={profesorId} onChange={(event) => { setProfesorId(event.target.value); limpiarErrores(); }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Seleccioná un profesor</option>{profesores.map((profesor) => <option key={profesor.id} value={profesor.id}>{profesor.apellido}, {profesor.nombre}</option>)}</select>}
      </div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Alumnos * <span className="font-normal text-muted-foreground">({alumnos.length}/{cupo})</span></legend>
        {alumnos.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no agregaste alumnos.</p> : <ul className="space-y-2" aria-label="Alumnos agregados">{alumnos.map((alumno) => {
          const conflicto = errorAlumno?.id === alumno.id ? errorAlumno.mensaje : "";
          return <li key={alumno.id} className={`space-y-1 rounded-md border p-2 ${conflicto ? "border-destructive" : "border-border"}`}>
            <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-words text-sm">{alumno.nombre} · DNI {alumno.dni}</span><Button type="button" variant="outline" size="sm" onClick={() => quitar(alumno.id)} aria-label={`Quitar a ${alumno.nombre}`}>Quitar</Button></div>
            {conflicto && <p role="alert" className="text-sm text-destructive">{conflicto}</p>}
          </li>;
        })}</ul>}
        <label htmlFor="alumno-busqueda" className="sr-only">Buscar alumno</label>
        <BuscadorAlumnos id="alumno-busqueda" excluir={alumnos.map(({ id: alumnoId }) => alumnoId)} deshabilitado={cupoAlcanzado} avisoDeshabilitado="El turno alcanzó su cupo máximo" onSeleccionar={(alumno) => agregar({ id: alumno.id, nombre: etiquetaAlumno(alumno), dni: alumno.dni })} />
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={alumnos.length === 0 || !profesorId || guardando}>{guardando ? "Guardando…" : "Confirmar turno"}</Button><Link className={buttonVariants({ variant: "outline" })} href={`/turnos/${encodeURIComponent(id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Cancelar</Link></div>
    </form>}
  </main>;
}
