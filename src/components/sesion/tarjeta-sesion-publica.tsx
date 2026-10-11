import type { ReactNode } from "react";
import Logo from "@/components/ui/Logo";
import { texto } from "@/lib/textos";

/**
 * Tarjeta centrada con la marca, sin menú, de las pantallas públicas de la
 * recuperación de contraseña (HU-A-05, figuras 88 a 90; DESIGN.md §6.4).
 * Mismo aspecto que el primer ingreso de HU-A-06. Es un componente y no un
 * `layout.tsx` en `(auth)`, que cambiaría también el login y el registro.
 */
export function TarjetaSesionPublica({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-muted p-4">
      <section className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <Logo className="size-6" aria-hidden />
          </span>
          <span className="text-sm font-semibold">{texto("ui.sesion.primerIngreso.marca")}</span>
        </div>
        {children}
      </section>
    </main>
  );
}
