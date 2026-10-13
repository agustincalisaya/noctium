"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { montoConSigno } from "@/lib/caja";
import { texto } from "@/lib/textos";
import type { ItemCajaDto } from "@/types/caja.types";
import { enviarMovimiento } from "./enviar-movimiento";

const MAXIMO_MOTIVO = 300;
export type MovimientoAnulable = Extract<ItemCajaDto, { tipo: "MOVIMIENTO" }>;

/**
 * «Anular» un movimiento manual de la caja abierta propia (HU-I-12-b,
 * criterio 3; spec_modulo_I.md §2.10.4): `Dialog` con el motivo obligatorio
 * (hasta 300, con contador) y la confirmación irreversible de HU-C-25 (la
 * leyenda la agrega `ConfirmarAccionDialog`). La anulación es un registro
 * nuevo (Regla N.° 8); el éxito, con toast y `router.refresh()`: la fila pasa
 * a «Anulado» y deja de ofrecer la acción.
 */
export function AnularMovimientoDialog({ movimiento, onCerrar }: { movimiento: MovimientoAnulable | null; onCerrar: () => void }) {
  const router = useRouter();
  const abierto = movimiento !== null;
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [previo, setPrevio] = useState(movimiento?.id ?? null);
  if ((movimiento?.id ?? null) !== previo) {
    setPrevio(movimiento?.id ?? null);
    if (movimiento) { setMotivo(""); setError(false); setConfirmando(false); }
  }

  const continuar = () => {
    if (motivo.trim().length === 0) {
      setError(true);
      document.getElementById("anular-movimiento-motivo")?.focus();
      return;
    }
    setConfirmando(true);
  };

  const resumen = movimiento && [
    texto(movimiento.movimiento === "INGRESO" ? "ui.caja.item.movimiento.ingreso" : "ui.caja.item.movimiento.egreso"),
    movimiento.detalle,
    `${movimiento.movimiento === "EGRESO" ? "− " : ""}${montoConSigno(movimiento.monto)}`,
  ].join(" · ");

  return <>
    <Dialog open={abierto && !confirmando} onOpenChange={(open) => { if (!open && !confirmando) onCerrar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{texto("ui.caja.movimiento.anular.titulo")}</DialogTitle>
          <DialogDescription>{texto("ui.caja.movimiento.anular.descripcion")}</DialogDescription>
        </DialogHeader>
        {resumen && <p className="mt-3 text-sm break-words">{resumen}</p>}
        <form className="mt-4 space-y-1.5" noValidate onSubmit={(evento) => { evento.preventDefault(); continuar(); }}>
          <label htmlFor="anular-movimiento-motivo" className="text-sm font-medium">{texto("ui.caja.movimiento.motivo")}</label>
          <textarea id="anular-movimiento-motivo" maxLength={MAXIMO_MOTIVO} value={motivo}
            placeholder={texto("ui.caja.movimiento.motivoPlaceholder")}
            onChange={(evento) => { setMotivo(evento.target.value); setError(false); }}
            required aria-invalid={error} aria-describedby={error ? "anular-movimiento-motivo-error" : undefined}
            className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive" />
          <div className="flex justify-between gap-3 text-xs">
            <span id="anular-movimiento-motivo-error" role={error ? "alert" : undefined} className="text-destructive">
              {error ? texto("ui.caja.movimiento.motivoRequerido") : ""}
            </span>
            <span className="text-muted-foreground">{texto("ui.caja.movimiento.contadorMotivo", { n: motivo.length })}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>{texto("ui.caja.cancelar")}</Button>
            <Button type="submit">{texto("ui.caja.movimiento.continuar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmarAccionDialog
      abierto={abierto && confirmando}
      titulo={texto("confirmaciones.caja.anularMovimiento")}
      detalle={resumen ? <p className="break-words">{resumen}</p> : undefined}
      textoConfirmar={texto("ui.caja.movimiento.anular.titulo")}
      irreversible
      onConfirmar={() => enviarMovimiento(`/api/cajas/mia/movimientos/${encodeURIComponent(movimiento!.id)}/anulacion`, { motivo: motivo.trim() })}
      onCerrar={() => setConfirmando(false)}
      onExito={() => {
        onCerrar();
        toast.success(texto("ui.caja.movimiento.anular.exito"));
        router.refresh();
      }}
    />
  </>;
}
