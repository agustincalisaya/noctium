"use client";

import { useState, useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "@/components/sesion/dirty-state-context";

/**
 * Botón de cierre de sesión (HU-A-03). Reutiliza `POST /api/auth/logout`
 * (ya implementado en HU-A-03: revoca el `jti` en `TokenRevocado`, registra
 * el evento `LOGOUT` con fecha/hora/usuario/ip) y el `DirtyStateContext`
 * existente (HU-A-03/L-01) para la confirmación condicional del criterio 2
 * — no crea un mecanismo de "formulario sucio" nuevo, ya existe.
 */
export function LogoutButton() {
  const { dirty, setDirty } = useDirtyState();
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();

  function ejecutarLogout() {
    startTransition(async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch {
        // Error de comunicación (criterio 6): no hay nada más que el
        // cliente pueda hacer con esta sesión — se redirige igual, sin
        // mensaje técnico.
      } finally {
        setDirty(false);
        // Navegación dura intencional (no router.push): descarta todo el
        // estado en memoria del árbol autenticado (criterio 3/6).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login?motivo=cerrada";
      }
    });
  }

  function handleClick() {
    if (dirty) {
      setConfirmando(true);
      return;
    }
    ejecutarLogout();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LogOut className="size-4" aria-hidden />
        )}
        Cerrar sesión
      </Button>

      <AlertDialog.Root open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-6 shadow-lg">
            <AlertDialog.Title className="font-semibold">Cambios sin guardar</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              Tenés cambios sin guardar. ¿Querés cerrar sesión igualmente?
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setConfirmando(false);
                  ejecutarLogout();
                }}
              >
                Cerrar sesión igualmente
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
