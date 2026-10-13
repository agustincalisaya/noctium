"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { montoNoNegativoValido, normalizarMonto } from "@/lib/caja";
import { texto } from "@/lib/textos";
import { monto as montoFormateado } from "@/lib/turno-detalle";
import { enviarMovimiento } from "./enviar-movimiento";

const MAXIMO_CONCEPTO = 200;
type Tipo = "INGRESO" | "EGRESO";

/** Mismo formato que `montoSchema` del servidor: mayor a 0 y hasta 2 decimales. */
const montoPositivoValido = (valor: string) => montoNoNegativoValido(valor) && Number(normalizarMonto(valor)) > 0;

/**
 * «Registrar movimiento» (HU-I-12-b, criterio 3; spec_modulo_I.md §2.10.3;
 * foto `Registrar movimiento manual.png`): `Dialog` con tipo, monto y
 * concepto (hasta 200, con contador) y la confirmación de HU-C-25 con los
 * tres datos. No es irreversible: el movimiento se puede anular después. Los
 * rechazos (EGRESO_SUPERA_EFECTIVO, sin el esperado) se ven dentro de la
 * confirmación; el éxito, con toast y `router.refresh()` (DESIGN.md §6.4).
 */
export function RegistrarMovimientoDialog({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("INGRESO");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [errores, setErrores] = useState({ monto: false, concepto: false });
  const [confirmando, setConfirmando] = useState(false);
  const [abiertoPrevio, setAbiertoPrevio] = useState(abierto);
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (abierto) { setTipo("INGRESO"); setMonto(""); setConcepto(""); setErrores({ monto: false, concepto: false }); setConfirmando(false); }
  }

  const continuar = () => {
    const nuevos = { monto: !montoPositivoValido(monto), concepto: concepto.trim().length === 0 };
    setErrores(nuevos);
    if (nuevos.monto || nuevos.concepto) {
      document.getElementById(nuevos.monto ? "movimiento-monto" : "movimiento-concepto")?.focus();
      return;
    }
    setConfirmando(true);
  };

  const tipoEnFrase = texto(tipo === "INGRESO" ? "ui.caja.movimiento.tipoEnFrase.ingreso" : "ui.caja.movimiento.tipoEnFrase.egreso");

  return <>
    <Dialog open={abierto && !confirmando} onOpenChange={(open) => { if (!open && !confirmando) onCerrar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{texto("ui.caja.movimiento.registrar")}</DialogTitle>
          <DialogDescription>{texto("ui.caja.movimiento.descripcion")}</DialogDescription>
        </DialogHeader>
        <form className="mt-4 space-y-4" noValidate onSubmit={(evento) => { evento.preventDefault(); continuar(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="movimiento-tipo" className="text-sm font-medium">{texto("ui.caja.movimiento.tipo")}</label>
              <select id="movimiento-tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value as Tipo)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option value="INGRESO">{texto("ui.caja.movimiento.tipo.ingreso")}</option>
                <option value="EGRESO">{texto("ui.caja.movimiento.tipo.egreso")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="movimiento-monto" className="text-sm font-medium">{texto("ui.caja.movimiento.monto")}</label>
              <Input id="movimiento-monto" inputMode="decimal" value={monto} className="font-mono"
                onChange={(evento) => { setMonto(evento.target.value); setErrores((e) => ({ ...e, monto: false })); }}
                aria-invalid={errores.monto} aria-describedby={errores.monto ? "movimiento-monto-error" : undefined} />
              {errores.monto && <p id="movimiento-monto-error" role="alert" className="text-xs text-destructive">{texto("ui.caja.movimiento.montoInvalido")}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="movimiento-concepto" className="text-sm font-medium">{texto("ui.caja.movimiento.concepto")}</label>
            <textarea id="movimiento-concepto" maxLength={MAXIMO_CONCEPTO} value={concepto}
              placeholder={texto("ui.caja.movimiento.conceptoPlaceholder")}
              onChange={(evento) => { setConcepto(evento.target.value); setErrores((e) => ({ ...e, concepto: false })); }}
              required aria-invalid={errores.concepto} aria-describedby={errores.concepto ? "movimiento-concepto-error" : undefined}
              className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive" />
            <div className="flex justify-between gap-3 text-xs">
              <span id="movimiento-concepto-error" role={errores.concepto ? "alert" : undefined} className="text-destructive">
                {errores.concepto ? texto("ui.caja.movimiento.conceptoRequerido") : ""}
              </span>
              <span className="text-muted-foreground">{texto("ui.caja.movimiento.contadorConcepto", { n: concepto.length })}</span>
            </div>
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
      titulo={texto("confirmaciones.caja.registrarMovimiento", {
        tipo: tipoEnFrase,
        monto: montoPositivoValido(monto) ? montoFormateado(normalizarMonto(monto)) : "",
      })}
      detalle={<p className="break-words">{concepto.trim()}</p>}
      textoConfirmar={texto("ui.caja.movimiento.registrar")}
      onConfirmar={() => enviarMovimiento("/api/cajas/mia/movimientos", { tipo, monto: normalizarMonto(monto), concepto: concepto.trim() })}
      onCerrar={() => setConfirmando(false)}
      onExito={() => {
        onCerrar();
        toast.success(texto("ui.caja.movimiento.exito"));
        router.refresh();
      }}
    />
  </>;
}
