"use client";

import { useState, type FormEvent } from "react";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";

export function RegistrarObservacionesDialog({ turnoId, contexto, onRegistrada }: {
  turnoId: string;
  contexto: string;
  onRegistrada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const [temas, setTemas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = () => {
    setTemas("");
    setObservaciones("");
    setError("");
    setConfirmacion(false);
    setAbierto(true);
  };

  const continuar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError("");
    if (!temas.trim()) {
      setError(texto("ui.historial.observaciones.temasRequeridos"));
      return;
    }
    setConfirmacion(true);
  };

  const confirmar = async () => {
    setGuardando(true);
    try {
      await fetchOLanzar(`/api/turnos/${encodeURIComponent(turnoId)}/clase-dictada/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temas_vistos: temas.trim(),
          observaciones_internas: observaciones.trim() || undefined,
        }),
        cache: "no-store",
      });
    } catch (fallo) {
      throw fallo instanceof Error && fallo.message !== "Failed to fetch"
        ? fallo
        : new Error(texto("ui.historial.observaciones.errorRegistro"));
    } finally {
      setGuardando(false);
    }
  };

  return <>
    <Button type="button" variant="outline" onClick={abrir}>
      <NotebookPen className="size-4" aria-hidden />{texto("ui.historial.observaciones.registrar")}
    </Button>
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{texto("ui.historial.observaciones.titulo")}</DialogTitle>
          <DialogDescription>{contexto}</DialogDescription>
        </DialogHeader>
        <p className="mt-3 text-xs text-muted-foreground">{texto("ui.historial.observaciones.noEditar")}</p>
        <form className="mt-5 space-y-4" onSubmit={continuar}>
          <div className="space-y-1.5">
            <label htmlFor="temas-vistos" className="text-sm font-medium">{texto("ui.historial.observaciones.temas")}</label>
            <textarea
              id="temas-vistos"
              required
              maxLength={1000}
              rows={4}
              value={temas}
              onChange={(evento) => {
                setTemas(evento.target.value);
                if (evento.target.value.trim()) setError("");
              }}
              disabled={guardando}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "temas-vistos-contador temas-vistos-error" : "temas-vistos-contador"}
              className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p id="temas-vistos-contador" aria-live="polite" className="text-right text-xs text-muted-foreground">
              {texto("ui.historial.observaciones.contador", { cantidad: temas.length })}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="observaciones-internas" className="text-sm font-medium">{texto("ui.historial.observaciones.internas")}</label>
            <p className="text-xs text-muted-foreground">{texto("ui.historial.observaciones.opcional")}</p>
            <textarea
              id="observaciones-internas"
              maxLength={1000}
              rows={3}
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              disabled={guardando}
              aria-describedby="observaciones-internas-contador"
              className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p id="observaciones-internas-contador" aria-live="polite" className="text-right text-xs text-muted-foreground">
              {texto("ui.historial.observaciones.contador", { cantidad: observaciones.length })}
            </p>
          </div>
          {error && <p id="temas-vistos-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={guardando} onClick={() => setAbierto(false)}>
              {texto("ui.historial.observaciones.cancelar")}
            </Button>
            <Button type="submit" disabled={guardando}>
              {texto("ui.historial.observaciones.continuar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmarAccionDialog
      abierto={confirmacion}
      onCerrar={() => setConfirmacion(false)}
      titulo={texto("ui.historial.observaciones.confirmar")}
      detalle={<p>{contexto}</p>}
      textoConfirmar={texto("ui.historial.observaciones.registrar")}
      irreversible
      onConfirmar={confirmar}
      onExito={() => {
        setAbierto(false);
        toast.success(texto("ui.historial.observaciones.guardada"));
        onRegistrada();
      }}
    />
  </>;
}
