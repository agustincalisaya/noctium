"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAutenticado } from "@/lib/fetch-autenticado";

export type AlumnoBuscado = { id: string; nombre: string; apellido: string; dni: string };
export const etiquetaAlumno = (alumno: AlumnoBuscado) => `${alumno.apellido}, ${alumno.nombre}`;

/**
 * Buscador de alumnos activos (HU-C-04 c1): se activa desde 2 caracteres,
 * con espera de 250 ms y cancelación de la búsqueda anterior. Las
 * coincidencias parciales sin mayúsculas ni acentos las resuelve
 * `buscarAlumnosActivos()` del Módulo B. Oculta los alumnos de `excluir`
 * (ya agregados al turno).
 */
export function BuscadorAlumnos({ id, excluir, deshabilitado, avisoDeshabilitado, onSeleccionar }: {
  id: string;
  excluir: string[];
  deshabilitado: boolean;
  avisoDeshabilitado?: string;
  onSeleccionar: (alumno: AlumnoBuscado) => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<AlumnoBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const activa = !deshabilitado && query.trim().length >= 2;

  useEffect(() => {
    if (!activa) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBuscando(true); setError("");
      try {
        const respuesta = await fetchAutenticado(`/api/turnos/participantes/alumnos?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudo buscar alumnos");
        setResultados(valor.data ?? []);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo buscar alumnos"); }
      finally { if (!controller.signal.aborted) setBuscando(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, activa]);

  const visibles = activa ? resultados.filter((alumno) => !excluir.includes(alumno.id)) : [];
  const seleccionar = (alumno: AlumnoBuscado) => { onSeleccionar(alumno); setQuery(""); setResultados([]); };

  return <div className="space-y-2">
    <Input id={id} value={query} onChange={(event) => { setQuery(event.target.value); setResultados([]); setError(""); }} disabled={deshabilitado} placeholder="Nombre, apellido o DNI (mínimo 2 caracteres)" autoComplete="off" aria-describedby={deshabilitado && avisoDeshabilitado ? `${id}-aviso` : undefined} />
    {deshabilitado && avisoDeshabilitado && <p id={`${id}-aviso`} role="status" className="text-sm text-muted-foreground">{avisoDeshabilitado}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {activa && !error && <p role="status" className="text-sm text-muted-foreground">{buscando ? "Buscando…" : visibles.length === 0 ? "No se encontraron alumnos activos para agregar" : `${visibles.length} ${visibles.length === 1 ? "resultado" : "resultados"}`}</p>}
    {visibles.length > 0 && <ul className="space-y-1" aria-label="Resultados de alumnos">{visibles.map((alumno) => <li key={alumno.id}><Button type="button" variant="outline" className="h-auto w-full justify-start text-left" onClick={() => seleccionar(alumno)}>{etiquetaAlumno(alumno)} · DNI {alumno.dni}</Button></li>)}</ul>}
  </div>;
}
