import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * 404 del área autenticada: se renderiza dentro de `(dashboard)/layout.tsx`
 * (mantiene Sidebar/Navbar) para cualquier ruta dentro de este grupo que no
 * matchee ningún segmento — mismo criterio de tarjeta centrada que
 * `aulas/error.tsx` / `materias/error.tsx`.
 */
export default function NotFoundDashboard() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-lg font-semibold text-foreground">No encontramos esta página</h1>
      <p className="text-sm text-muted-foreground">
        La sección que buscás no existe o la dirección es incorrecta.
      </p>
      <Link href="/home" className={buttonVariants({ variant: "default" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
