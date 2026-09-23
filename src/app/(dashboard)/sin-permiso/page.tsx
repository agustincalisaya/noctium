import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROL_LEGIBLE } from "@/components/layout/Navbar";

/**
 * Página 403: destino de src/proxy.ts cuando `rolPuedeAccederRuta()`
 * determina que el rol de la sesión no puede acceder a la ruta pedida (ver
 * src/server/shared/rutas-por-rol.ts). No requiere ningún permiso propio —
 * solo sesión, que ya exige el layout de este grupo (`(dashboard)/layout.tsx`)
 * antes de renderizar esta página.
 */
export default async function SinPermisoPage() {
  const session = await auth();
  const rol = session?.user?.rol;

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
      <ShieldAlert className="size-10 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold text-foreground">No tenés permiso para acceder a esta sección</h1>
      {rol && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          Tu rol actual es <Badge variant="accent">{ROL_LEGIBLE[rol]}</Badge>
        </p>
      )}
      <Link href="/home" className={buttonVariants({ variant: "default" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
