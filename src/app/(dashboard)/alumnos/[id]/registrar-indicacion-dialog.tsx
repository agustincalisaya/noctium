"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { fechaCorta } from "@/lib/turno-detalle";
import { texto } from "@/lib/textos";

type OpcionMateria = { id: string; nombre: string };
type OpcionClase = { id: string; materia_id: string; fecha: string };

export function RegistrarIndicacionDialog({
  alumnoId,
  nombreAlumno,
  materias,
  clases,
  materiaInicial = "",
  materiaFija = false,
  claseInicial,
  deshabilitado = false,
  leyendaDeshabilitado,
  onRegistrado,
}: {
  alumnoId: string;
  nombreAlumno: string;
  materias: OpcionMateria[];
  clases: OpcionClase[];
  materiaInicial?: string;
  materiaFija?: boolean;
  claseInicial?: string;
  deshabilitado?: boolean;
  leyendaDeshabilitado?: string;
  onRegistrado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const [materiaId, setMateriaId] = useState(materiaInicial);
  const [claseId, setClaseId] = useState(claseInicial ?? "");
  const [indicacion, setIndicacion] = useState("");
  const [errorLocal, setErrorLocal] = useState("");

  const abrir = () => {
    setMateriaId(materiaInicial || materias[0]?.id || "");
    setClaseId(claseInicial ?? "");
    setIndicacion("");
    setErrorLocal("");
    setAbierto(true);
  };

  const materiaElegida = materias.find((materia) => materia.id === materiaId);
  const clasesMateria = clases.filter((clase) => clase.materia_id === materiaId);
  const prepararConfirmacion = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!materiaId || !indicacion.trim()) {
      setErrorLocal(texto("ui.historial.indicacion.formularioIncompleto"));
      return;
    }
    setErrorLocal("");
    setConfirmacion(true);
  };

  const guardar = async () => {
    const respuesta = await fetchAutenticado(`/api/alumnos/${encodeURIComponent(alumnoId)}/indicaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia_id: materiaId, indicacion: indicacion.trim(), ...(claseId ? { clase_dictada_id: claseId } : {}) }),
    });
    const valor = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new Error(valor?.error?.message ?? texto("ui.historial.indicacion.error"));
  };

  return <>
    <div className="space-y-1">
      <Button type="button" variant="outline" disabled={deshabilitado || materias.length === 0} onClick={abrir}>
        <Plus className="size-4" aria-hidden />{texto("ui.historial.indicacion.registrar")}
      </Button>
      {deshabilitado && leyendaDeshabilitado && <p className="max-w-md text-xs text-muted-foreground">{leyendaDeshabilitado}</p>}
    </div>
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{texto("ui.historial.indicacion.titulo")}</DialogTitle>
          <DialogDescription>{nombreAlumno}</DialogDescription>
        </DialogHeader>
        <form className="mt-5 space-y-4" onSubmit={prepararConfirmacion}>
          <div className="space-y-1.5">
            <label htmlFor={`materia-indicacion-${alumnoId}`} className="text-sm font-medium">{texto("ui.historial.indicacion.materia")}</label>
            {materiaFija ? (
              <p className="rounded-md border border-input bg-muted px-3 py-2.5 text-sm">{materiaElegida?.nombre ?? materias[0]?.nombre}</p>
            ) : (
              <select
                id={`materia-indicacion-${alumnoId}`}
                required
                value={materiaId}
                onChange={(evento) => { setMateriaId(evento.target.value); setClaseId(""); }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{texto("ui.historial.indicacion.elegirMateria")}</option>
                {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`clase-indicacion-${alumnoId}`} className="text-sm font-medium">{texto("ui.historial.indicacion.clase")}</label>
            <select
              id={`clase-indicacion-${alumnoId}`}
              value={claseId}
              onChange={(evento) => setClaseId(evento.target.value)}
              disabled={!materiaId}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{texto("ui.historial.indicacion.sinClase")}</option>
              {clasesMateria.map((clase) => <option key={clase.id} value={clase.id}>{fechaCorta(clase.fecha)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`texto-indicacion-${alumnoId}`} className="text-sm font-medium">{texto("ui.historial.indicacion.texto")}</label>
            <textarea
              id={`texto-indicacion-${alumnoId}`}
              required
              minLength={1}
              maxLength={1000}
              autoFocus
              value={indicacion}
              onChange={(evento) => setIndicacion(evento.target.value)}
              placeholder={texto("ui.historial.indicacion.placeholder")}
              rows={5}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-right text-xs text-muted-foreground">{texto("ui.historial.indicacion.contador", { cantidad: indicacion.length })}</p>
          </div>
          {errorLocal && <p role="alert" className="text-sm text-destructive">{errorLocal}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>{texto("ui.historial.indicacion.cancelar")}</Button>
            <Button type="submit" disabled={!materias.length || !materiaId || !indicacion.trim() || indicacion.length > 1000}>{texto("ui.historial.indicacion.continuar")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmarAccionDialog
      abierto={confirmacion}
      titulo={texto("ui.historial.indicacion.confirmar", { alumno: nombreAlumno, materia: materiaElegida?.nombre ?? "" })}
      textoConfirmar={texto("ui.historial.indicacion.confirmarAccion")}
      onConfirmar={guardar}
      onCerrar={() => setConfirmacion(false)}
      onExito={() => {
        setAbierto(false);
        toast.success(texto("ui.historial.indicacion.guardada"));
        onRegistrado();
      }}
    />
  </>;
}
