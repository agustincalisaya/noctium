"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { BuscadorAlumnos } from "../buscador-alumnos";
import { EstadoTurnoBadge } from "../estado-turno-badge";
import type { TurnoDetalle } from "../turno.types";

export function TurnoDetalleVista({ id, retorno, puedeConfigurar, puedeGestionarAlumnos }: { id: string; retorno: string; puedeConfigurar: boolean; puedeGestionarAlumnos: boolean }) {
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async (recarga = false) => {
    if (!recarga) setCargando(true);
    setError("");
    try {
      const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? "No se pudo consultar el turno");
      if (!result?.data) throw new Error("No se pudo consultar el turno");
      setTurno(result.data);
    } catch (err) { setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No se pudo consultar el turno. Intentá nuevamente."); }
    finally { setCargando(false); }
  }, [id]);
  useEffect(() => { const inicial = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(inicial); }, [cargar]);
  const gestionable = puedeGestionarAlumnos && (turno?.estado === "DISPONIBLE" || turno?.estado === "COMPLETO");

  const campos: [string, ReactNode][] | null = turno && [
    ["Identificador", turno.id], ["Fecha", turno.fecha], ["Hora", `${turno.hora_inicio}–${turno.hora_fin}`], ["Duración", `${turno.duracion_minutos} minutos`], ["Cupo máximo", turno.cupo_maximo?.toString() ?? "Sin asignar"],
    ["Alumnos", turno.alumnos.length ? <ul>{turno.alumnos.map(({ id: alumnoId, nombre, dni }) => <li key={alumnoId}>{nombre} · DNI {dni}</li>)}</ul> : "Sin asignar"],["Profesor", turno.profesor], ["DNI profesor", turno.profesor_dni ?? "Sin asignar"],
    ["Materia", turno.materia], ["Código de materia", turno.materia_codigo ?? "Sin asignar"], ["Aula", turno.aula], ["Capacidad del aula", turno.aula_capacidad?.toString() ?? "Sin asignar"],
    ["Estado", <EstadoTurnoBadge key="estado" estado={turno.estado} />], ["Fecha de creación", new Date(turno.creado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })], ["Última actualización", new Date(turno.actualizado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })], ["Usuario responsable", turno.creado_por], ["Modificado por", turno.modificado_por],
  ];
  return <main className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6"><Link className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</Link><h1 className="text-2xl font-semibold">Detalle del turno</h1>{turno?.estado === "PENDIENTE" && (puedeConfigurar || (puedeGestionarAlumnos && turno.aula_id)) && <div className="flex flex-wrap gap-3">{puedeConfigurar && <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/configuracion?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{turno.aula_id ? "Modificar configuración o aula" : "Modificar configuración y asignar aula"}</Link>}{puedeGestionarAlumnos && turno.aula_id && <Link className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/participantes?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Asignar profesor y alumnos</Link>}</div>}
    {cargando ? <p role="status">Cargando turnos</p> : error ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : <dl className="grid gap-3 rounded-md border border-border bg-card p-5 text-card-foreground sm:grid-cols-2">{campos?.map(([etiqueta, valor]) => <div className="min-w-0" key={etiqueta}><dt className="text-sm text-muted-foreground">{etiqueta}</dt><dd className="break-words font-medium">{valor}</dd></div>)}</dl>}
    {!cargando && !error && turno && gestionable && <InscripcionesTurno turno={turno} onCambio={() => cargar(true)} />}
  </main>;
}

/**
 * HU-C-04 §2.5: alta y baja individual de alumnos en un turno DISPONIBLE o
 * COMPLETO. Cada acción se aplica en el momento (no hay cambios pendientes
 * de guardar); el estado Disponible ⇄ Completo lo resuelve el servidor.
 */
function InscripcionesTurno({ turno, onCambio }: { turno: TurnoDetalle; onCambio: () => Promise<void> }) {
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [errorAlumno, setErrorAlumno] = useState<{ id: string; mensaje: string } | null>(null);
  // Solo se muestra en turnos DISPONIBLE/COMPLETO, que siempre tienen aula y cupo.
  const cupoAlcanzado = turno.cupo_maximo !== null && turno.alumnos.length >= turno.cupo_maximo;

  const ejecutar = async (clave: string, url: string, init: RequestInit, exito: (estado: string) => string) => {
    setProcesando(clave); setAviso(""); setError(""); setErrorAlumno(null);
    try {
      const respuesta = await fetchAutenticado(url, { ...init, cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        const mensaje = valor?.error?.message ?? "No se pudo actualizar la inscripción";
        const alumnoId = valor?.error?.detalles?.alumno_id;
        if (typeof alumnoId === "string" && turno.alumnos.some(({ id }) => id === alumnoId)) setErrorAlumno({ id: alumnoId, mensaje });
        else setError(mensaje);
        return;
      }
      setAviso(exito(valor.data.estado));
      await onCambio();
    } catch { setError("No se pudo actualizar la inscripción. Intentá nuevamente."); }
    finally { setProcesando(null); }
  };

  const agregar = (alumnoId: string) => ejecutar("agregar", `/api/turnos/${encodeURIComponent(turno.id)}/alumnos`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alumno_id: alumnoId }),
  }, (estado) => estado === "COMPLETO" ? "Alumno agregado. El turno alcanzó su cupo máximo y pasó a Completo." : "Alumno agregado al turno");
  const quitar = (alumnoId: string) => ejecutar(alumnoId, `/api/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumnoId)}`, { method: "DELETE" },
    (estado) => turno.estado === "COMPLETO" && estado === "DISPONIBLE" ? "Alumno quitado. El turno volvió a Disponible." : "Alumno quitado del turno");

  return <section aria-labelledby="inscripciones-titulo" className="space-y-4 rounded-md border border-border bg-card p-5 text-card-foreground">
    <h2 id="inscripciones-titulo" className="text-lg font-semibold">Alumnos inscriptos <span className="font-normal text-muted-foreground">({turno.alumnos_inscriptos})</span></h2>
    {turno.alumnos.length === 0 ? <p className="text-sm text-muted-foreground">El turno no tiene alumnos inscriptos.</p> : <ul className="space-y-2" aria-label="Alumnos inscriptos">{turno.alumnos.map((alumno) => {
      const conflicto = errorAlumno?.id === alumno.id ? errorAlumno.mensaje : "";
      return <li key={alumno.id} className={`space-y-1 rounded-md border p-2 ${conflicto ? "border-destructive" : "border-border"}`}>
        <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-words text-sm">{alumno.nombre} · DNI {alumno.dni}</span><Button type="button" variant="outline" size="sm" disabled={procesando !== null} onClick={() => void quitar(alumno.id)} aria-label={`Quitar a ${alumno.nombre}`}>{procesando === alumno.id ? "Quitando…" : "Quitar"}</Button></div>
        {conflicto && <p role="alert" className="text-sm text-destructive">{conflicto}</p>}
      </li>;
    })}</ul>}
    <div className="space-y-1"><label htmlFor="agregar-alumno" className="text-sm font-medium">Agregar alumno</label>
      <BuscadorAlumnos id="agregar-alumno" excluir={turno.alumnos.map(({ id }) => id)} deshabilitado={cupoAlcanzado || procesando !== null} avisoDeshabilitado={cupoAlcanzado ? "El turno alcanzó su cupo máximo" : undefined} onSeleccionar={(alumno) => void agregar(alumno.id)} />
    </div>
    {procesando === "agregar" && <p role="status" className="text-sm text-muted-foreground">Agregando alumno…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {aviso && <p role="status" className="rounded-md bg-success p-3 text-sm text-success-foreground">{aviso}</p>}
  </section>;
}
