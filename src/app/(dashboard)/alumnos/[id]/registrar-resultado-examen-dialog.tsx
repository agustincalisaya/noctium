"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { OpcionesExamenData } from "@/types/historial.types";

function hoyBuenosAires() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function RegistrarResultadoExamenDialog({
  alumnoId,
  nombreAlumno,
  onRegistrado,
}: {
  alumnoId: string;
  nombreAlumno: string;
  onRegistrado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<OpcionesExamenData | null>(null);
  const [materiaId, setMateriaId] = useState("");
  const [fecha, setFecha] = useState(hoyBuenosAires);
  const [nota, setNota] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const abrir = async () => {
    setAbierto(true);
    setOpciones(null);
    setMateriaId("");
    setFecha(hoyBuenosAires());
    setNota("");
    setObservaciones("");
    setError("");
    setCargando(true);
    try {
      const respuesta = await fetchAutenticado(`/api/alumnos/${encodeURIComponent(alumnoId)}/examenes/opciones`, { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudieron cargar las materias del alumno");
      setOpciones(valor.data);
      setMateriaId(valor.data?.materias?.[0]?.id ?? "");
    } catch (fallo) {
      setError(fallo instanceof Error && fallo.message !== "Failed to fetch"
        ? fallo.message
        : "No se pudieron cargar las materias del alumno. Intentá nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  const guardar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!materiaId || !opciones || !nota.trim()) return;
    setGuardando(true);
    setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/alumnos/${encodeURIComponent(alumnoId)}/examenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materia_id: materiaId,
          fecha_examen: fecha,
          nota: nota.trim().replace(",", "."),
          observaciones: observaciones.trim() || undefined,
        }),
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudo registrar el resultado");
      setAbierto(false);
      toast.success("Resultado registrado correctamente");
      onRegistrado();
    } catch (fallo) {
      setError(fallo instanceof Error && fallo.message !== "Failed to fetch"
        ? fallo.message
        : "No se pudo registrar el resultado. Intentá nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  const escala = opciones?.escala ?? { min: 1, max: 10 };

  return (
    <>
      <Button type="button" onClick={() => void abrir()}><Plus className="size-4" aria-hidden />Registrar resultado de examen</Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar resultado de examen</DialogTitle>
            <DialogDescription>{nombreAlumno}</DialogDescription>
          </DialogHeader>
          <form className="mt-5 space-y-4" onSubmit={(evento) => void guardar(evento)}>
            <div className="space-y-1.5">
              <label htmlFor="materia-examen" className="text-sm font-medium">Materia</label>
              <p className="text-xs text-muted-foreground">Solo materias con al menos una clase dictada</p>
              <select
                id="materia-examen"
                required
                value={materiaId}
                onChange={(evento) => setMateriaId(evento.target.value)}
                disabled={cargando || guardando || !opciones?.materias.length}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Elegí una materia</option>
                {opciones?.materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="fecha-examen" className="text-sm font-medium">Fecha del examen</label>
                <input id="fecha-examen" type="date" required max={hoyBuenosAires()} value={fecha} onChange={(evento) => setFecha(evento.target.value)} disabled={cargando || guardando} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="nota-examen" className="text-sm font-medium">Nota ({escala.min} a {escala.max})</label>
                <input id="nota-examen" type="text" inputMode="decimal" pattern="[0-9]{1,3}([,.][0-9])?" title="Ingresá un número entero o con un decimal" required value={nota} onChange={(evento) => setNota(evento.target.value)} disabled={cargando || guardando} placeholder="Ej. 8,5" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="observaciones-examen" className="text-sm font-medium">Observaciones</label>
              <p className="text-xs text-muted-foreground">Opcional</p>
              <textarea
                id="observaciones-examen"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                disabled={cargando || guardando}
                placeholder="Ej.: parcial de funciones"
                rows={2}
                className="min-h-16 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {cargando && <p role="status" className="text-sm text-muted-foreground">Cargando opciones…</p>}
            {!cargando && opciones?.materias.length === 0 && <p className="text-sm text-muted-foreground">Este alumno todavía no cursó ninguna materia.</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={cargando || guardando || !materiaId || !opciones?.materias.length}>
                {guardando ? "Registrando…" : "Registrar resultado"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
