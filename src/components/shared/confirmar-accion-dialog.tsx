"use client";

import { useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TEXTO_VOLVER = "Volver";
const TEXTO_PROCESANDO = "Procesando…";
const LEYENDA_IRREVERSIBLE = "Esta acción no se puede deshacer.";
const MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente.";

type ConfirmarAccionDialogProps = {
  /** Controla si el diálogo está abierto. Siempre controlado por el padre. */
  abierto: boolean;
  /**
   * "¿Estás seguro de que querés <acción> <datos concretos>?" ya armado por
   * el llamador (criterio 2). Por HU-C-23 (archivo central de textos), la
   * HU dueña de cada acción arma este string con `texto("confirmaciones.<dominio>.<accion>", {datos})`
   * desde `src/lib/textos.ts` — no como un template literal suelto en el
   * componente de esa pantalla.
   */
  titulo: string;
  /** Detalle debajo del título: clases, importes, forma y fecha de pago, etc. (criterio 2). Opcional. */
  detalle?: ReactNode;
  /** Texto del botón de confirmar, con el verbo de la acción (ej. "Registrar pago"). */
  textoConfirmar: string;
  /**
   * true si la operación no se puede deshacer (criterio 4): agrega la leyenda
   * "Esta acción no se puede deshacer.", pinta el botón de confirmar en rojo
   * y pone el foco inicial en "Volver".
   */
  irreversible?: boolean;
  /** Una baja reversible puede requerir el botón rojo sin leyenda irreversible. */
  destructiva?: boolean;
  confirmarDeshabilitado?: boolean;
  contenido?: ReactNode;
  className?: string;
  /**
   * Se llama al tocar el botón de confirmar. Si el servidor rechaza, debe
   * lanzar un error con `.message` ya resuelto (ver `fetchOLanzar`) — el
   * componente lo muestra inline sin cerrar el diálogo (criterio 6). Si
   * resuelve sin lanzar, el componente cierra el diálogo y llama a `onExito`.
   */
  onConfirmar: () => Promise<void>;
  /** Se llama tras un `onConfirmar` exitoso (para refrescar datos, mostrar un toast, etc.). */
  onExito?: () => void;
  /** Botón "Volver": cierra sin guardar lo cargado (no se pierde el formulario de atrás). */
  onCerrar: () => void;
};

/**
 * HU-C-25: confirmación común antes de guardar cualquier operación del
 * Sprint 3. `AlertDialog`: no se cierra con click afuera (DESIGN.md §6.3), ni
 * con Escape mientras hay un envío en curso. El rechazo del servidor se
 * muestra dentro del propio modal (criterio 6, mock de HU-I-10); el toast de
 * éxito lo dispara el llamador desde `onExito`.
 *
 * Las confirmaciones de Sprints 1/2 (p. ej. `CancelarTurnoDialog`) conservan
 * su comportamiento; si se migran, usan este componente.
 */
export function ConfirmarAccionDialog({
  abierto,
  titulo,
  detalle,
  textoConfirmar,
  irreversible = false,
  destructiva = false,
  confirmarDeshabilitado = false,
  contenido,
  className = "",
  onConfirmar,
  onExito,
  onCerrar,
}: ConfirmarAccionDialogProps) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abiertoPrevio, setAbiertoPrevio] = useState(abierto);
  const volverRef = useRef<HTMLButtonElement>(null);

  // Cada apertura arranca sin el error de la anterior.
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (abierto) setError(null);
  }

  const confirmar = async () => {
    if (enviando || confirmarDeshabilitado) return;
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar();
    } catch (causa) {
      setError(causa instanceof Error && causa.message ? causa.message : MENSAJE_ERROR_GENERICO);
      setEnviando(false);
      return;
    }
    setEnviando(false);
    onCerrar();
    onExito?.();
  };

  return (
    <AlertDialog.Root open={abierto} onOpenChange={(open) => { if (!open && !enviando) onCerrar(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Popup
          initialFocus={irreversible ? volverRef : undefined}
          className={cn("fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg outline-none", className)}
        >
          <AlertDialog.Title className="text-lg font-semibold">{titulo}</AlertDialog.Title>
          {(detalle !== undefined || irreversible) && (
            <AlertDialog.Description render={<div />} className="mt-3 text-sm text-muted-foreground">
              {detalle}
              {irreversible && <p className={detalle !== undefined ? "mt-3" : undefined}>{LEYENDA_IRREVERSIBLE}</p>}
            </AlertDialog.Description>
          )}
          {contenido}
          {error && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button ref={volverRef} type="button" variant="outline" disabled={enviando} onClick={onCerrar}>
              {TEXTO_VOLVER}
            </Button>
            <Button
              type="button"
              disabled={enviando || confirmarDeshabilitado}
              onClick={() => void confirmar()}
              className={irreversible || destructiva ? "bg-destructive text-card hover:bg-destructive/90" : undefined}
            >
              {enviando ? TEXTO_PROCESANDO : textoConfirmar}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
