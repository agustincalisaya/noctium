"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LinkProtegido } from "@/components/sesion/link-protegido";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { EstadoTurnoBadge } from "../../estado-turno-badge";
import type { Turno } from "../../turno.types";

type Aula = { id: string; nombre: string; capacidad: number };
type Resultado = { id: string; aula_id: string; estado: Turno["estado"]; mensaje: string };

export function AulaTurno({ id, retorno }: { id: string; retorno: string }) {
  const { setDirty } = useDirtyState();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [aulaId, setAulaId] = useState("");
  const [aulaIdOriginal, setAulaIdOriginal] = useState("");
  const [sinAulas, setSinAulas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setErrorCarga("");
    try {
      const respuestaTurno = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const valorTurno = await respuestaTurno.json().catch(() => null);
      if (!respuestaTurno.ok || !valorTurno?.data) throw new Error(valorTurno?.error?.message ?? "No se pudo cargar el turno");
      const actual = valorTurno.data as Turno;
      if (actual.estado !== "PENDIENTE") {
        setTurno(actual); setAulas([]); setAulaId(""); setAulaIdOriginal(""); setSinAulas(false);
        return;
      }
      const respuestaAulas = await fetchAutenticado(`/api/turnos/aula/opciones?turno_id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const valorAulas = await respuestaAulas.json().catch(() => null);
      if (!respuestaAulas.ok && valorAulas?.error?.code !== "SIN_AULAS_ACTIVAS") {
        throw new Error(valorAulas?.error?.message ?? "No se pudieron cargar las aulas");
      }
      const ningunaActiva = valorAulas?.error?.code === "SIN_AULAS_ACTIVAS";
      const opciones = ningunaActiva ? [] : valorAulas?.data;
      if (!Array.isArray(opciones)) throw new Error("No se pudieron cargar las aulas");
      setTurno(actual); setAulas(opciones); setSinAulas(ningunaActiva);
      const seleccionInicial = actual.aula_id && opciones.some((aula: Aula) => aula.id === actual.aula_id) ? actual.aula_id : "";
      setAulaId(seleccionInicial); setAulaIdOriginal(seleccionInicial);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar el turno");
    } finally { setCargando(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);
  const sinGuardar = Boolean(turno && !resultado && aulaId !== aulaIdOriginal);
  // Misma condición que asignarAulaTurno: sin profesor o sin alumnos el turno sigue Pendiente.
  const confirmaAlGuardar = Boolean(turno?.profesor_id && turno.alumnos.length > 0);
  useEffect(() => { setDirty(sinGuardar); }, [sinGuardar, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!aulaId || guardando) return;
    setGuardando(true); setError(""); setAviso("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}/aula`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aula_id: aulaId }), cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data) {
        setError(valor?.error?.message ?? "No se pudo asignar el aula");
        return;
      }
      const actualizado = valor.data as Resultado;
      if (actualizado.estado === "PENDIENTE") {
        const seleccionada = aulas.find((aula) => aula.id === actualizado.aula_id);
        setTurno((anterior) => anterior && { ...anterior, aula_id: actualizado.aula_id,
          aula: seleccionada?.nombre ?? anterior.aula, aula_capacidad: seleccionada?.capacidad ?? anterior.aula_capacidad });
        setAulaIdOriginal(actualizado.aula_id);
        setAviso(actualizado.mensaje);
      } else {
        setResultado(actualizado);
      }
    } catch { setError("No se pudo asignar el aula. Intentá nuevamente."); }
    finally { setGuardando(false); }
  };

  const detalle = `/turnos/${encodeURIComponent(id)}?volver=${encodeURIComponent(retorno)}`;
  return <main className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
    <LinkProtegido className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</LinkProtegido>
    <h1 className="text-2xl font-semibold">Asignar aula</h1>
    {cargando ? <p role="status">Cargando turno</p> : errorCarga ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{errorCarga}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div>
      : resultado ? <div role="status" className="space-y-4 rounded-md bg-success p-5 text-success-foreground"><p className="font-semibold">Turno confirmado correctamente</p><EstadoTurnoBadge estado={resultado.estado} /><div className="flex flex-wrap gap-4"><Link href={retorno} prefetch={false} className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Volver al listado</Link><Link href={detalle} prefetch={false} className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver detalle</Link></div></div>
      : turno?.estado !== "PENDIENTE" ? <div className="space-y-3 rounded-md border border-border bg-card p-5"><p>El turno ya está confirmado.</p><Link href={detalle} prefetch={false} className="text-primary underline">Ver detalle</Link></div>
      : <form onSubmit={(event) => void guardar(event)} className="space-y-5 rounded-md border border-border bg-card p-5 text-card-foreground">
        <div className="space-y-1"><p className="font-medium">{turno.fecha} · {turno.hora_inicio}–{turno.hora_fin} · {turno.materia}</p><p className="text-sm text-muted-foreground">Profesor: {turno.profesor} · Alumnos: {turno.alumnos_inscriptos} · Cupo máximo: {turno.cupo_maximo}</p><EstadoTurnoBadge estado={turno.estado} /></div>
        {turno.aula_id && !aulas.some((aula) => aula.id === turno.aula_id) && !sinAulas && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">El aula asignada ya no está disponible para este turno. Elegí otra aula.</p>}
        <div className="space-y-2"><label htmlFor="aula" className="text-sm font-medium">Aula *</label>
          {sinAulas ? <div className="space-y-2"><p role="status">No hay aulas activas registradas</p><Button type="button" variant="outline" onClick={() => void cargar()}>Reintentar</Button></div>
            : aulas.length === 0 ? <div className="space-y-2"><p role="status">No hay aulas con capacidad suficiente para el cupo máximo del turno</p><Button type="button" variant="outline" onClick={() => void cargar()}>Reintentar</Button></div>
              : <select id="aula" name="aula_id" required value={aulaId} onChange={(event) => { setAulaId(event.target.value); setError(""); setAviso(""); }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Seleccioná un aula</option>{aulas.map((aula) => <option key={aula.id} value={aula.id}>{aula.nombre} · Capacidad {aula.capacidad}</option>)}</select>}
        </div>
        {!confirmaAlGuardar && <p className="text-sm text-muted-foreground">Si todavía faltan datos del turno, el aula quedará asignada y el turno seguirá Pendiente.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {aviso && <p role="status" className="rounded-md bg-success p-3 text-sm text-success-foreground">{aviso}</p>}
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!aulaId || guardando}>{guardando ? "Guardando…" : confirmaAlGuardar ? "Guardar aula y confirmar turno" : "Guardar aula"}</Button><Link className={buttonVariants({ variant: "outline" })} href={detalle} prefetch={false}>Cancelar</Link></div>
      </form>}
  </main>;
}
