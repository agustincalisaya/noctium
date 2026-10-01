"use client";

import { useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { MENSAJE_RESULTADO_INCIERTO } from "./turno-acciones-mensajes";

const TEXTOS = {
  cancelar: {
    titulo: "¿Confirmás cancelar este turno?",
    confirmar: "Cancelar turno",
    exito: "Turno cancelado correctamente",
  },
  descartar: {
    titulo: "¿Confirmás descartar este turno?",
    confirmar: "Descartar turno",
    exito: "Turno descartado",
  },
} as const;

/**
 * HU-C-05 (spec_modulo_C.md §2.10, mockup pág. 8): confirmación para
 * cancelar un turno DISPONIBLE/COMPLETO o descartar un PENDIENTE (N-1).
 * `AlertDialog`: no se cierra con click afuera (DESIGN.md §6.3). `resumen`
 * describe el turno; `cantidadPagos` solo llega si el detalle trajo `pagos`
 * (permiso `pagos:leer`), y entonces se avisa N-3.
 */
export function CancelarTurnoDialog({ turnoId, modo, resumen, cantidadPagos, onCerrar, onCambio }: {
  turnoId: string;
  modo: "cancelar" | "descartar";
  resumen?: string;
  cantidadPagos?: number;
  onCerrar: () => void;
  onCambio: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const textos = TEXTOS[modo];

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    let incierto = false;
    try {
      const response = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turnoId)}/cancelacion`, { method: "POST", cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.ok) {
        onCerrar();
        toast.success(textos.exito);
        await onCambio();
        return;
      }
      if (response.status >= 500) incierto = true;
      else {
        toast.error(result?.error?.message ?? "No se pudo completar la acción. Intentá nuevamente.");
        if (response.status === 404 || response.status === 409) {
          onCerrar();
          await onCambio();
        }
      }
    } catch {
      incierto = true;
    } finally {
      setEnviando(false);
    }
    if (incierto) {
      onCerrar();
      toast.error(MENSAJE_RESULTADO_INCIERTO);
      await onCambio();
    }
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => { if (!open && !enviando) onCerrar(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg outline-none">
          <AlertDialog.Title className="text-lg font-semibold">{textos.titulo}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            {resumen ? `${resumen}. ` : ""}Esta acción no se puede deshacer.
          </AlertDialog.Description>
          {modo === "cancelar" && cantidadPagos !== undefined && cantidadPagos > 0 && (
            <p role="note" className="mt-3 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {`Este turno tiene ${cantidadPagos} ${cantidadPagos === 1 ? "pago registrado" : "pagos registrados"}; no se reembolsan automáticamente`}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>Volver</Button>
            <Button type="button" disabled={enviando} onClick={() => void confirmar()} className="bg-destructive text-card hover:bg-destructive/90">
              {enviando ? "Procesando…" : textos.confirmar}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
