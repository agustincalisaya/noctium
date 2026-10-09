"use client";
import { useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
export function AnularClaseDictadaDialog({ turno, onAnulada }: { turno: TurnoDetalle; onAnulada: () => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const volver = useRef<HTMLButtonElement>(null);
  async function confirmar() {
    if (!motivo.trim()) { setError(texto("ui.historial.correccionClase.obligatorio")); return; }
    setEnviando(true); setError("");
    try {
      await fetchOLanzar(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada/anulacion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivo.trim() }) });
      setAbierto(false); toast.success(texto("ui.historial.correccionClase.anulada")); await onAnulada();
    } catch (e) { setError(e instanceof Error ? e.message : texto("ui.historial.correccionClase.error")); }
    finally { setEnviando(false); }
  }
  return <>
    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive-soft" onClick={() => { setMotivo(""); setError(""); setAbierto(true); }}>{texto("ui.historial.correccionClase.accionAnular")}</Button>
    <AlertDialog.Root open={abierto} onOpenChange={open => { if (!enviando) setAbierto(open); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/50" />
        <AlertDialog.Popup initialFocus={volver} className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-5 text-card-foreground shadow-lg outline-none">
          <AlertDialog.Title className="text-base leading-snug font-semibold">{texto("ui.historial.correccionClase.tituloAnular", { materia: turno.materia, fecha: diaAbreviadoYFecha(turno.fecha), hora: turno.hora_inicio })}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto("ui.historial.correccionClase.detalleAnular")}</AlertDialog.Description>
          <label htmlFor="motivo-anulacion-clase" className="mt-4 block text-sm">{texto("ui.historial.correccionClase.motivo")}</label>
          <textarea id="motivo-anulacion-clase" maxLength={300} value={motivo} disabled={enviando} onChange={e => setMotivo(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="error-anulacion-clase contador-anulacion-clase" placeholder={texto("ui.historial.correccionClase.placeholderAnulacion")} className="mt-1 min-h-20 w-full rounded-md border border-input bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <p id="contador-anulacion-clase" className="text-right text-xs tabular-nums text-muted-foreground">{motivo.length} / 300</p>
          <p id="error-anulacion-clase" role={error ? "alert" : undefined} className="text-sm text-destructive">{error}</p>
          <div className="mt-4 flex justify-end gap-2"><Button ref={volver} variant="outline" disabled={enviando} onClick={() => setAbierto(false)}>{texto("ui.historial.correccionClase.volver")}</Button><Button className="bg-destructive text-card hover:bg-destructive/90" disabled={enviando || !motivo.trim()} onClick={() => void confirmar()}>{texto(enviando ? "ui.historial.correccionClase.procesando" : "ui.historial.correccionClase.anular")}</Button></div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </>;
}
