"use client";

import { useCallback, type ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";

/** Tiempo visible de cada toast antes de ocultarse solo. */
const DURACION_MS = 3500;

/**
 * Notificaciones no bloqueantes (toast), arriba al centro de la pantalla.
 * Vive en `(dashboard)/layout.tsx`: como el layout no se desmonta en una
 * navegación del lado del cliente, un toast disparado justo antes de
 * `router.push()` sigue visible en la pantalla siguiente (flujo de alta de
 * profesor: cada paso notifica y navega al próximo sin esperar al usuario).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={DURACION_MS}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed top-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 outline-none">
          <ListaToasts />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ListaToasts() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      swipeDirection="up"
      className="flex items-start gap-3 rounded-md bg-success p-3 text-sm text-success-foreground shadow-lg transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
    >
      <Toast.Title className="min-w-0 flex-1 font-medium" />
      <Toast.Close
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden />
      </Toast.Close>
    </Toast.Root>
  ));
}

/** `notificarExito("Profesor registrado correctamente")` muestra un toast de éxito. */
export function useToast() {
  const { add } = Toast.useToastManager();
  const notificarExito = useCallback((mensaje: string) => add({ title: mensaje, type: "exito" }), [add]);
  return { notificarExito };
}
