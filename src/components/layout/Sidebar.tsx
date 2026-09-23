import { CalendarClock, Users, GraduationCap, BookOpen, DoorOpen, type LucideIcon } from "lucide-react";
import type { RolUsuario } from "@prisma/client";
import { auth } from "@/auth";
import { SidebarNav, type SidebarNavSection } from "./SidebarNav";

interface SidebarItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarSeccionConfig {
  label: string;
  icon: LucideIcon;
  items: SidebarItemConfig[];
}

/**
 * Definición completa de la navegación (Sprint 1). Solo se incluyen ítems
 * cuya ruta ya tiene `page.tsx` implementado — el resto queda documentado
 * acá como comentario `TODO Sprint 1` (no se linkean rutas inexistentes ni
 * se crean páginas nuevas):
 *
 * - Turnos: falta "Nuevo turno" (`/turnos/nuevo`) — HU-C-03.
 * - Calendario: sección completa oculta — "Agenda por profesor"
 *   (`/calendario/profesor`, HU-J-01) y "Agenda por materia"
 *   (`/calendario/materia`, HU-J-02) no tienen page.tsx todavía.
 * - Alumnos: falta "Nuevo alumno" (`/alumnos/nuevo`) — HU-B-01.
 * - Profesores: falta "Nuevo profesor" (`/profesores/nuevo`) — HU-D-01.
 */
const SECCIONES_POR_ROL: Record<RolUsuario, SidebarSeccionConfig[]> = {
  MESA_ENTRADA: [
    {
      label: "Turnos",
      icon: CalendarClock,
      items: [{ label: "Listado", href: "/turnos", icon: CalendarClock }],
    },
    {
      label: "Alumnos",
      icon: Users,
      items: [{ label: "Listado", href: "/alumnos", icon: Users }],
    },
    {
      label: "Materias",
      icon: BookOpen,
      items: [{ label: "Listado", href: "/materias", icon: BookOpen }],
    },
  ],
  GERENTE: [
    {
      label: "Profesores",
      icon: GraduationCap,
      items: [{ label: "Listado", href: "/profesores", icon: GraduationCap }],
    },
    {
      label: "Materias",
      icon: BookOpen,
      items: [
        { label: "Listado", href: "/materias", icon: BookOpen },
        { label: "Nueva materia", href: "/materias/nueva", icon: BookOpen },
      ],
    },
    {
      label: "Aulas",
      icon: DoorOpen,
      items: [
        { label: "Listado", href: "/aulas", icon: DoorOpen },
        { label: "Nueva aula", href: "/aulas/nueva", icon: DoorOpen },
      ],
    },
  ],
  // materias:leer (HU-L-02): Profesor también consulta el catálogo al
  // operar otros módulos (ej. asociar sus propias materias, HU-D-03).
  PROFESOR: [
    {
      label: "Materias",
      icon: BookOpen,
      items: [{ label: "Listado", href: "/materias", icon: BookOpen }],
    },
  ],
  ALUMNO: [],
};

/**
 * Sidebar del área autenticada. Server Component: resuelve la sesión con
 * `auth()` y arma la navegación filtrada por rol server-side (la seguridad
 * real es la de cada `page.tsx`/Route Handler vía `withPermission()`, esto
 * es solo para no mostrar accesos que el rol no va a poder usar). Los datos
 * ya filtrados se pasan a `SidebarNav`, que es la que maneja toda la
 * interacción cliente (acordeón, activo, mobile/rail).
 */
export async function Sidebar() {
  const session = await auth();
  if (!session?.user) return null;

  // Los componentes de lucide-react no pueden cruzar el límite
  // Server->Client como referencia cruda (RSC solo serializa elementos ya
  // renderizados, no funciones) — por eso acá se resuelven a JSX antes de
  // pasarlos a `SidebarNav`, que es un Client Component.
  const secciones: SidebarNavSection[] = SECCIONES_POR_ROL[session.user.rol].map((seccion) => {
    const SeccionIcon = seccion.icon;
    return {
      label: seccion.label,
      icon: <SeccionIcon className="size-4 shrink-0" aria-hidden />,
      items: seccion.items.map((item) => {
        const ItemIcon = item.icon;
        return {
          label: item.label,
          href: item.href,
          icon: <ItemIcon className="size-4 shrink-0" aria-hidden />,
        };
      }),
    };
  });

  return <SidebarNav secciones={secciones} />;
}
