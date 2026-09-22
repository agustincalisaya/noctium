"use client";

import { useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "./dirty-state-context";

export function MenuUsuario({ email, rol }: { email: string; rol: string }) {
  const { dirty, setDirty } = useDirtyState();
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  async function ejecutarLogout() {
    setCerrando(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Error de comunicación (criterio 6): no hay nada más que el cliente
      // pueda hacer con esta sesión — se redirige igual, sin mensaje técnico.
    } finally {
      setDirty(false);
      // Navegación dura intencional (no router.push): descarta todo el
      // estado en memoria del árbol autenticado, no solo lo desmonta
      // (criterio 3/6 — "la app descarta el estado del usuario en memoria").
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?motivo=cerrada";
    }
  }

  function handleClick() {
    if (dirty) {
      setConfirmando(true);
      return;
    }
    void ejecutarLogout();
  }

  return (
    <div className="flex items-center justify-end gap-3 border-b px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        {email} · {rol}
      </span>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={cerrando}>
        {cerrando ? "Cerrando..." : "Cerrar sesión"}
      </Button>
      <AlertDialog.Root open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg">
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
                  void ejecutarLogout();
                }}
              >
                Cerrar sesión igualmente
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
