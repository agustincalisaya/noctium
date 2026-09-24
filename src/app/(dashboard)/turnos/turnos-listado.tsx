"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { EstadoTurnoBadge } from "./estado-turno-badge";
import { urlContinuar, type TurnosData } from "./turno.types";

export function TurnosListado({ pagina, orden, puedeConfigurar }: { pagina: number; orden: string; puedeConfigurar: boolean }) {
  const [data, setData] = useState<TurnosData | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const retorno = `/turnos?pagina=${data?.paginacion.pagina_actual ?? pagina}&orden=${orden}`;
  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const response = await fetchAutenticado(`/api/turnos?pagina=${pagina}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? "No se pudieron consultar los turnos");
      if (!result?.data) throw new Error("No se pudieron consultar los turnos");
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No se pudieron consultar los turnos. Intentá nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [pagina]);

  useEffect(() => {
    const inicial = window.setTimeout(() => void cargar(), 0);
    const actualizar = () => { if (document.visibilityState === "visible") void cargar(); };
    window.addEventListener("pageshow", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.clearTimeout(inicial); window.removeEventListener("pageshow", actualizar); document.removeEventListener("visibilitychange", actualizar); };
  }, [cargar]);

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Turnos</h1><p className="text-sm text-muted-foreground">Desde hoy · Orden: fecha y hora ascendente, luego profesor</p></div>{puedeConfigurar && <Link href="/turnos/nuevo" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Configurar turno</Link>}</div>
    {cargando ? <p role="status">Cargando turnos</p> : error ? <div role="alert" className="space-y-3 rounded-md border p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : !data?.items.length ? <p>No hay turnos registrados</p> : <>
      <div className="overflow-x-auto rounded-md border border-border bg-card text-card-foreground"><table className="w-full min-w-190 text-left text-sm"><thead className="bg-muted"><tr>{["Fecha", "Hora", "Alumnos inscriptos", "Profesor", "Materia", "Aula", "Estado", "Acciones"].map(columna => <th scope="col" className="px-3 py-3 font-medium" key={columna}>{columna}</th>)}</tr></thead><tbody>{data.items.map(turno => <tr className="border-t border-border hover:bg-accent" key={turno.id}>
        <td className="px-3 py-3">{turno.fecha}</td><td className="whitespace-nowrap px-3 py-3">{turno.hora_inicio}–{turno.hora_fin}</td><td className="px-3 py-3">{turno.alumnos_inscriptos}</td><td className="px-3 py-3">{turno.profesor}</td><td className="px-3 py-3">{turno.materia}</td><td className="px-3 py-3">{turno.aula}</td><td className="px-3 py-3"><EstadoTurnoBadge estado={turno.estado} /></td><td className="space-x-2 whitespace-nowrap px-3 py-3"><Link className="rounded-sm text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(turno.id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>Ver detalle</Link>{puedeConfigurar && turno.estado === "PENDIENTE" && <Link className="rounded-sm text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={urlContinuar(turno, retorno)} prefetch={false}>Continuar configuración</Link>}</td>
      </tr>)}</tbody></table></div>
      {data.paginacion.total_paginas > 1 && <nav aria-label="Páginas de turnos" className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {data.paginacion.pagina_actual} de {data.paginacion.total_paginas} · {data.paginacion.total} turnos</span><div className="flex gap-3">{data.paginacion.pagina_actual > 1 ? <Link className={`${buttonVariants({ variant: "outline", size: "sm" })} text-foreground`} href={`/turnos?pagina=${data.paginacion.pagina_actual - 1}&orden=${orden}`}><ChevronLeft className="size-4" aria-hidden />Anterior</Link> : <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none text-foreground opacity-50`} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden />Anterior</span>}{data.paginacion.pagina_actual < data.paginacion.total_paginas ? <Link className={`${buttonVariants({ variant: "outline", size: "sm" })} text-foreground`} href={`/turnos?pagina=${data.paginacion.pagina_actual + 1}&orden=${orden}`}>Siguiente<ChevronRight className="size-4" aria-hidden /></Link> : <span className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none text-foreground opacity-50`} aria-disabled="true">Siguiente<ChevronRight className="size-4" aria-hidden /></span>}</div></nav>}
    </>}
  </main>;
}
