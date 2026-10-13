"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { montoNoNegativoValido, normalizarMonto } from "@/lib/caja";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { monto } from "@/lib/turno-detalle";

/**
 * «Abrir caja» (HU-I-12 criterio 1; spec_modulo_I.md §2.10.1; foto
 * `Abrir caja.png`): `Dialog` con el fondo inicial en efectivo (acepta 0) y
 * la confirmación de HU-C-25 con el monto. El rechazo del servidor (por
 * ejemplo, CAJA_YA_ABIERTA) se ve dentro de la confirmación; el éxito, con
 * toast y `router.refresh()` (DESIGN.md §6.1).
 */
export function AbrirCajaDialog({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const [fondo, setFondo] = useState("");
  const [error, setError] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [abiertoPrevio, setAbiertoPrevio] = useState(abierto);
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (abierto) { setFondo(""); setError(false); setConfirmando(false); }
  }

  const continuar = () => {
    if (!montoNoNegativoValido(fondo)) {
      setError(true);
      return;
    }
    setConfirmando(true);
  };

  return <>
    <Dialog open={abierto && !confirmando} onOpenChange={(open) => { if (!open && !confirmando) onCerrar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{texto("ui.caja.abrir")}</DialogTitle>
          <DialogDescription>{texto("ui.caja.abrir.descripcion")}</DialogDescription>
        </DialogHeader>
        <form className="mt-4 space-y-2" noValidate onSubmit={(evento) => { evento.preventDefault(); continuar(); }}>
          <label htmlFor="abrir-caja-fondo" className="text-sm font-medium">{texto("ui.caja.abrir.fondo")}</label>
          <Input id="abrir-caja-fondo" inputMode="decimal" autoFocus value={fondo} className="font-mono"
            onChange={(evento) => { setFondo(evento.target.value); setError(false); }}
            aria-invalid={error} aria-describedby={error ? "abrir-caja-fondo-error" : undefined} />
          {error && <p id="abrir-caja-fondo-error" role="alert" className="text-xs text-destructive">{texto("ui.caja.abrir.fondoInvalido")}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>{texto("ui.caja.cancelar")}</Button>
            <Button type="submit">{texto("ui.caja.abrir.continuar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmarAccionDialog
      abierto={abierto && confirmando}
      titulo={texto("confirmaciones.caja.abrir", { monto: montoNoNegativoValido(fondo) ? monto(normalizarMonto(fondo)) : "" })}
      textoConfirmar={texto("ui.caja.abrir")}
      onConfirmar={async () => {
        await fetchOLanzar("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fondo_inicial: normalizarMonto(fondo) }),
        });
      }}
      onCerrar={() => setConfirmando(false)}
      onExito={() => {
        onCerrar();
        toast.success(texto("ui.caja.abrir.exito"));
        router.refresh();
      }}
    />
  </>;
}
