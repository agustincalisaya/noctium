"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";

const MENSAJE_CONFIRMACION_CANCELAR = "Hay datos sin guardar. ¿Salir de todas formas?";

/**
 * Confirmación antes de descartar un formulario con cambios (criterio común
 * de Sprint 1: "Cancelar no guarda; si hay cambios, pedir confirmación").
 * El formulario decide cuándo abrirlo y qué hacer al confirmar.
 */
export function ConfirmarDescarteDialog({
  abierto,
  onAbiertoChange,
  onConfirmar,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog.Root open={abierto} onOpenChange={onAbiertoChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg">
          <AlertDialog.Title className="font-semibold">Cambios sin guardar</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            {MENSAJE_CONFIRMACION_CANCELAR}
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onAbiertoChange(false)}>
              Seguir editando
            </Button>
            <Button
              onClick={() => {
                onAbiertoChange(false);
                onConfirmar();
              }}
            >
              Salir sin guardar
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
