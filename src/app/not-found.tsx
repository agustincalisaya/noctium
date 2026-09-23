import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * 404 raíz: cubre tanto rutas fuera del área autenticada (`/login`,
 * `/registro`, etc.) como cualquier URL que no matchee ninguna ruta de la
 * app — Next.js usa este archivo como fallback global (no hay `layout.tsx`
 * de `(dashboard)` de por medio, así que no asume sesión).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-2xl font-semibold text-foreground">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La página que buscás no existe o fue movida.</p>
      <Link href="/login" className={buttonVariants({ variant: "default" })}>
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
