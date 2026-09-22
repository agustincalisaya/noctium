"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Mecanismo mínimo para que un formulario "avise" al layout que tiene
 * cambios sin guardar (HU-A-03 criterio 2). Primera vez que el proyecto lo
 * necesita — no hay ningún formulario de edición real todavía (Materias/
 * Aulas siguen "en construcción"), así que nada lo activa orgánicamente
 * hasta que HU-B-06/L-01/K-01 lo conecten llamando `useDirtyState().setDirty(true)`
 * mientras el usuario edita, y `setDirty(false)` al guardar/descartar.
 */
type DirtyStateValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const DirtyStateContext = createContext<DirtyStateValue | null>(null);

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return <DirtyStateContext.Provider value={value}>{children}</DirtyStateContext.Provider>;
}

export function useDirtyState(): DirtyStateValue {
  const ctx = useContext(DirtyStateContext);
  if (!ctx) {
    throw new Error("useDirtyState() debe usarse dentro de <DirtyStateProvider>");
  }
  return ctx;
}
