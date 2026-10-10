import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Logo from "@/components/ui/Logo";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { DirtyStateProvider } from "@/components/sesion/dirty-state-context";
import { ProtegerCacheNavegador } from "@/components/sesion/proteger-cache-navegador";
import { texto } from "@/lib/textos";

// Igual que (dashboard): nada de este grupo se sirve desde caché estática.
export const dynamic = "force-dynamic";

/**
 * Layout del primer ingreso (HU-A-06, spec_modulo_A.md §2.6.6): una tarjeta
 * centrada con la marca, el contenido de la página y «Cerrar sesión», sin
 * menú lateral ni barra superior: hasta cambiar la contraseña no hay otra
 * opción. «Cerrar sesión» es el `LogoutButton` de siempre (HU-A-03), que
 * necesita el `DirtyStateProvider`.
 */
export default async function PrimerIngresoLayout({ children }: { children: React.ReactNode }) {
  // Defensa en profundidad, como (dashboard)/layout.tsx: el proxy ya exige sesión.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <DirtyStateProvider>
      <ProtegerCacheNavegador />
      <main className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <section className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary">
                <Logo className="size-6" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{texto("ui.sesion.primerIngreso.marca")}</span>
            </div>
            {children}
          </section>
          <div className="flex justify-center">
            <LogoutButton />
          </div>
        </div>
      </main>
    </DirtyStateProvider>
  );
}
