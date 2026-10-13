"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
export function AnularClaseDictadaDialog({ turno, onAnulada }: { turno: TurnoDetalle; onAnulada: () => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  return <>
    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive-soft" onClick={() => { setMotivo(""); setAbierto(true); }}>{texto("ui.historial.correccionClase.accionAnular")}</Button>
    <ConfirmarAccionDialog abierto={abierto} onCerrar={() => setAbierto(false)} irreversible
      titulo={texto("ui.historial.correccionClase.tituloAnular", { materia: turno.materia, fecha: diaAbreviadoYFecha(turno.fecha), hora: turno.hora_inicio })}
      detalle={<p>{texto("ui.historial.correccionClase.detalleAnular")}</p>}
      textoConfirmar={texto("ui.historial.correccionClase.anular")}
      confirmarDeshabilitado={!motivo.trim()}
      contenido={<div className="mt-4">
        <label htmlFor="motivo-anulacion-clase" className="block text-sm">{texto("ui.historial.correccionClase.motivo")}</label>
        <textarea id="motivo-anulacion-clase" required maxLength={300} value={motivo} onChange={e => setMotivo(e.target.value)} aria-describedby="contador-anulacion-clase" placeholder={texto("ui.historial.correccionClase.placeholderAnulacion")} className="mt-1 min-h-20 w-full rounded-md border border-input bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <p id="contador-anulacion-clase" className="text-right text-xs tabular-nums text-muted-foreground">{motivo.length} / 300</p>
      </div>}
      onConfirmar={async () => {
        if (!motivo.trim()) throw new Error(texto("ui.historial.correccionClase.obligatorio"));
        await fetchOLanzar(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada/anulacion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivo.trim() }) });
      }}
      onExito={() => { toast.success(texto("ui.historial.correccionClase.anulada")); void onAnulada(); }}
    />
  </>;
}
