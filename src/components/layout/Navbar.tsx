import { UserCircle2, Bell } from "lucide-react";
import type { RolUsuario } from "@prisma/client";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { obtenerNombreVisible } from "@/server/usuarios/usuario.service";
import { LogoutButton } from "./LogoutButton";

export const ROL_LEGIBLE: Record<RolUsuario, string> = {
  MESA_ENTRADA: "Mesa de entrada",
  PROFESOR: "Profesor",
  GERENTE: "Gerente",
  ALUMNO: "Alumno",
};

/**
 * Barra superior del área autenticada (HU-A-03 criterio 1: "Cerrar sesión"
 * disponible desde el menú de usuario en todas las pantallas autenticadas,
 * siempre en el mismo lugar, junto al nombre y rol"). Server Component:
 * resuelve la sesión con `auth()` server-side, sin sesión no renderiza nada.
 */
export async function Navbar() {
  const session = await auth();
  if (!session?.user) return null;

  const nombre = await obtenerNombreVisible(session.user.id, session.user.rol);

  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-card px-4">
      {/* Reserva el espacio de la hamburguesa mobile (fija, fuera de este
          flujo) para que no se superponga con el contenido de la navbar. */}
      <div className="w-8 lg:hidden" />
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-label="Sin notificaciones configuradas todavía"
          title="Sin notificaciones configuradas todavía"
          className="rounded-md p-2 text-muted-foreground disabled:opacity-50"
        >
          <Bell className="size-4" aria-hidden />
        </button>
        <UserCircle2 className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">{nombre}</span>
        <Badge variant="accent">{ROL_LEGIBLE[session.user.rol]}</Badge>
        <LogoutButton />
      </div>
    </header>
  );
}
