"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { CambiarTarifaSchema, TARIFA_HORA_MAX } from "@/server/materias/materia.schema";
import { cambiarTarifaMateria } from "@/server/materias/actions";
import { texto } from "@/lib/textos";
import { formatearMonto } from "@/lib/moneda";

export function CambiarTarifaDialog({ id, nombre, tarifaActual }: {
  id: string; nombre: string; tarifaActual: number | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [importe, setImporte] = useState(tarifaActual === null ? "" : String(tarifaActual));
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const nueva = Number(importe);
  const continuar = (event: FormEvent) => {
    event.preventDefault();
    const parsed = CambiarTarifaSchema.safeParse({ tarifa_hora: nueva, tarifa_actual: tarifaActual });
    if (!parsed.success || importe.trim() === "") {
      setError(texto("errores.materias.tarifaImporte"));
      campo.current?.focus();
      return;
    }
    if (nueva === tarifaActual) {
      setError(texto("errores.materias.tarifaSinCambio"));
      campo.current?.focus();
      return;
    }
    setError(null);
    setConfirmando(true);
  };
  const guardar = async () => {
    if (conflicto) throw new Error(texto("errores.materias.tarifaConflicto"));
    let resultado;
    try {
      resultado = await cambiarTarifaMateria(id, { tarifa_hora: nueva, tarifa_actual: tarifaActual });
    } catch {
      throw new Error(texto("errores.materias.tarifaComunicacion"));
    }
    if (resultado.error) {
      if (resultado.error.code === "CONFLICTO_EDICION_CONCURRENTE") setConflicto(true);
      throw new Error(resultado.error.message);
    }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => {
      setImporte(tarifaActual === null ? "" : String(tarifaActual));
      setError(null); setConflicto(false); setAbierto(true);
    }}><Pencil className="size-3.5" aria-hidden />{texto("ui.materias.tarifa.cambiar")}</Button>
    <Dialog open={abierto && !confirmando} onOpenChange={(open) => { if (!confirmando) setAbierto(open); }}>
      <DialogContent initialFocus={campo} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form noValidate onSubmit={continuar}>
          <DialogHeader>
            <DialogTitle>{texto("ui.materias.tarifa.modal")}</DialogTitle>
            <DialogDescription>{nombre}. {texto("ui.materias.tarifa.aviso")}</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-2">
            <label htmlFor="tarifa-hora" className="text-sm font-medium">{texto("ui.materias.tarifa.campo")}</label>
            <Input ref={campo} id="tarifa-hora" type="number" inputMode="numeric" min={1} max={TARIFA_HORA_MAX} step={1}
              value={importe} onChange={(event) => { setImporte(event.target.value); setError(null); }}
              aria-invalid={!!error} aria-describedby={error ? "tarifa-actual tarifa-error" : "tarifa-actual"} />
            <p id="tarifa-actual" className="text-xs text-muted-foreground">{texto("ui.materias.tarifa.actual", {
              tarifa: tarifaActual === null ? texto("ui.materias.tarifa.sinTarifa") : formatearMonto(tarifaActual),
            })}</p>
            {error && <p id="tarifa-error" role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>{texto("ui.materias.tarifa.cancelar")}</Button>
            <Button type="submit" disabled={conflicto}>{texto("ui.materias.tarifa.guardar")}</Button>
          </DialogFooter>
          {conflicto && <Button type="button" variant="outline" className="mt-3" onClick={() => { setAbierto(false); router.refresh(); }}>{texto("ui.materias.tarifa.recargar")}</Button>}
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmarAccionDialog abierto={confirmando}
      titulo={texto(tarifaActual === null ? "confirmaciones.materias.definirTarifa" : "confirmaciones.materias.tarifa", {
        materia: nombre, anterior: tarifaActual === null ? undefined : formatearMonto(tarifaActual), nueva: formatearMonto(nueva),
      })}
      detalle={texto("ui.materias.tarifa.aviso")} textoConfirmar={texto("ui.materias.tarifa.guardar")}
      confirmarDeshabilitado={conflicto}
      contenido={conflicto ? <Button variant="outline" className="mt-3" onClick={() => { setConfirmando(false); setAbierto(false); router.refresh(); }}>{texto("ui.materias.tarifa.recargar")}</Button> : undefined}
      onConfirmar={guardar} onCerrar={() => setConfirmando(false)}
      onExito={() => { setAbierto(false); toast.success(texto("ui.materias.tarifa.exito")); router.refresh(); }} />
  </>;
}
