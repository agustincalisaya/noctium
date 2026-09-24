"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { esSalidaPermitida } from "@/lib/salida-sin-confirmar";

/**
 * Estado global de "formulario con cambios sin guardar" (HU-A-03 criterio 2,
 * extendido en HU-C-04 a toda salida de la pantalla). Los formularios llaman
 * `setDirty(true)` mientras el usuario edita y `setDirty(false)` al
 * guardar/descartar; el provider protege las salidas:
 *
 * - Navegación interna (menú, logo, "Volver…"): `<LinkProtegido>` llama a
 *   `confirmarSalida()`, que abre el diálogo de descarte si hay cambios.
 * - Recargar/cerrar la pestaña: `beforeunload` (diálogo nativo del navegador,
 *   su texto no es configurable).
 * - Cerrar sesión: `LogoutButton` mantiene su propio diálogo (HU-A-03).
 *
 * Fuera de alcance, a propósito: el botón explícito "Cancelar" de cada
 * formulario conserva su comportamiento propio (salida intencional, ver
 * spec_modulo_C.md), y el botón "atrás" del navegador — el App Router no
 * expone un evento cancelable para esa navegación (limitación conocida).
 */
type DirtyStateValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** Ejecuta `salir` directamente, o después de confirmar si hay cambios sin guardar. */
  confirmarSalida: (salir: () => void) => void;
};

const DirtyStateContext = createContext<DirtyStateValue | null>(null);

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirtyEstado] = useState(false);
  // Copia síncrona para `beforeunload`: una navegación dura inmediatamente
  // posterior a `setDirty(false)` (ej. LogoutButton) corre antes del commit.
  const dirtyRef = useRef(false);
  const [salidaPendiente, setSalidaPendiente] = useState<(() => void) | null>(null);

  const setDirty = useCallback((valor: boolean) => {
    dirtyRef.current = valor;
    setDirtyEstado(valor);
  }, []);

  const confirmarSalida = useCallback((salir: () => void) => {
    if (!dirtyRef.current) {
      salir();
      return;
    }
    setSalidaPendiente(() => salir);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || esSalidaPermitida()) return;
      event.preventDefault();
      // Requerido por navegadores que todavía no respetan solo preventDefault().
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const value = useMemo(() => ({ dirty, setDirty, confirmarSalida }), [dirty, setDirty, confirmarSalida]);
  return (
    <DirtyStateContext.Provider value={value}>
      {children}
      <ConfirmarDescarteDialog
        abierto={salidaPendiente !== null}
        onAbiertoChange={(abierto) => {
          if (!abierto) setSalidaPendiente(null);
        }}
        onConfirmar={() => {
          const salir = salidaPendiente;
          setDirty(false);
          salir?.();
        }}
      />
    </DirtyStateContext.Provider>
  );
}

export function useDirtyState(): DirtyStateValue {
  const ctx = useContext(DirtyStateContext);
  if (!ctx) {
    throw new Error("useDirtyState() debe usarse dentro de <DirtyStateProvider>");
  }
  return ctx;
}
