"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { TurnoDetalle } from "../turno.types";

export function TurnoDetalleVista({ id, retorno }: { id: string; retorno: string }) {
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async () => {
    setCargando(true); setError("");
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

  const campos = turno && [
    ["Identificador", turno.id], ["Fecha", turno.fecha], ["Hora", `${turno.hora_inicio}–${turno.hora_fin}`], ["Duración", `${turno.duracion_minutos} minutos`],
    ["Alumno", turno.alumno], ["DNI alumno", turno.alumno_dni ?? "Sin asignar"], ["Profesor", turno.profesor], ["DNI profesor", turno.profesor_dni ?? "Sin asignar"],
    ["Materia", turno.materia], ["Código de materia", turno.materia_codigo ?? "Sin asignar"], ["Aula", turno.aula], ["Capacidad del aula", turno.aula_capacidad?.toString() ?? "Sin asignar"],
    ["Estado", turno.estado === "PENDIENTE" ? "Pendiente" : "Agendado"], ["Fecha de creación", new Date(turno.creado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })], ["Última actualización", new Date(turno.actualizado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })], ["Usuario responsable", turno.creado_por],
  ];
  return <main className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6"><Link className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</Link><h1 className="text-2xl font-semibold">Detalle del turno</h1>
    {cargando ? <p role="status">Cargando turnos</p> : error ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : <dl className="grid gap-3 rounded-md border border-border bg-card p-5 text-card-foreground sm:grid-cols-2">{campos?.map(([etiqueta, valor]) => <div className="min-w-0" key={etiqueta}><dt className="text-sm text-muted-foreground">{etiqueta}</dt><dd className="break-words font-medium">{valor}</dd></div>)}</dl>}
  </main>;
}
