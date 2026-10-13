import { texto as textoC19 } from "@/lib/textos";
import {
  CalendarClock,
  CalendarDays,
  Users,
  GraduationCap,
  BookOpen,
  DoorOpen,
  ListOrdered,
  Contact,
  Library,
  BadgeCheck,
  CalendarPlus2,
  Wallet,
  BarChart3,
  UserCog,
  Banknote,
  BriefcaseBusiness,
  type LucideIcon
} from "lucide-react";
import { texto } from "@/lib/textos";
import type { RolUsuario } from "@prisma/client";
import { auth } from "@/auth";
import { SidebarNav, type SidebarNavEntrada } from "./SidebarNav";

interface SidebarItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarSeccionConfig {
  label: string;
  icon: LucideIcon;
  items: SidebarItemConfig[];
  collapsible?: boolean;
  hideItemIcons?: boolean;
}

/** Ítem de primer nivel, sin desplegable; activo en toda ruta bajo `prefijoActivo`. */
interface SidebarEnlaceConfig extends SidebarItemConfig {
  prefijoActivo?: string;
}

/**
 * Calendario (HU-J-03): un único ítem. La pantalla ya tiene su propio
 * toggle "Por profesor | Por materia", así que entra por la vista por
 * profesor (la de defecto) y queda activo en /calendario/profesor y
 * /calendario/materia.
 */
const CALENDARIO: SidebarEnlaceConfig = {
  label: textoC19("ui.clases.menu.calendario"),
  href: "/calendario/profesor",
  prefijoActivo: "/calendario",
  icon: CalendarDays,
};

/**
 * Definición completa de la navegación (Sprint 1). Solo se incluyen ítems
 * cuya ruta ya tiene `page.tsx` implementado — el resto queda documentado
 * acá como comentario `TODO Sprint 1` (no se linkean rutas inexistentes ni
 * se crean páginas nuevas):
 *
 * - Turnos: falta "Nuevo turno" (`/turnos/nuevo`) — HU-C-03.
 * - Alumnos: falta "Nuevo alumno" (`/alumnos/nuevo`) — HU-B-01.
 * - Profesores: falta "Nuevo profesor" (`/profesores/nuevo`) — HU-D-01.
 */
const SECCIONES_POR_ROL: Record<RolUsuario, (SidebarSeccionConfig | SidebarEnlaceConfig)[]> = {
  MESA_ENTRADA: [
    {
      label: textoC19("ui.pagos.resumen.clases"),
      icon: CalendarClock,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/turnos", icon: ListOrdered }],
    },
    // HU-I-10: registrar pago buscando al alumno (pagos:crear, solo Mesa de Entrada).
    { label: textoC19("ui.turnos.reserva.registrarPago"), href: "/pagos/registrar", prefijoActivo: "/pagos", icon: Wallet },
    // HU-I-12: «Mi caja» (cajas:leer), activo también en el detalle de mis cierres.
    { label: texto("ui.caja.menu"), href: "/caja", prefijoActivo: "/caja", icon: Banknote },
        {
      label: textoC19("ui.clases.menu.calendario"),
      icon: CalendarDays,
      items: [
              {
                label: textoC19("ui.clases.menu.porProfesor"),
                href: "/calendario/profesor",
                icon: GraduationCap // o UserRound
              },
              {
                label: textoC19("ui.clases.menu.porMateria"),
                href: "/calendario/materia",
                icon: BookOpen // o Book
              }
            ],
    },
    {
      label: textoC19("ui.clases.menu.alumnos"),
      icon: Users,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/alumnos", icon: Contact }],
    },
    {
      label: textoC19("ui.clases.menu.materias"),
      icon: BookOpen,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/materias", icon: Library }],
    },
    {
      label: textoC19("ui.profesores.estado.menu"),
      icon: GraduationCap,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/profesores", icon: BadgeCheck }],
    },
  ],
  GERENTE: [
    { label: texto("ui.profesores.estado.menu"), icon: GraduationCap, items: [{ label: texto("ui.profesores.estado.listado"), href: "/profesores", icon: BadgeCheck }] },
    {
      label: textoC19("ui.clases.menu.gestion"),
      icon: BarChart3,
      items: [{ label: textoC19("ui.indicadores.panel.titulo"), href: "/gerente", icon: BarChart3 }],
    },
            {
      label: textoC19("ui.pagos.resumen.clases"),
      icon: CalendarClock,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/turnos", icon: ListOrdered }],
    },
    {
      label: textoC19("ui.clases.menu.calendario"),
      icon: CalendarDays,
      items: [
              {
                label: textoC19("ui.clases.menu.porProfesor"),
                href: "/calendario/profesor",
                icon: GraduationCap // o UserRound
              },
              {
                label: textoC19("ui.clases.menu.porMateria"),
                href: "/calendario/materia",
                icon: BookOpen // o Book
              }
            ],
    },
    {
      label: textoC19("ui.clases.menu.materias"),
      icon: BookOpen,
      items: [
        { label: textoC19("ui.profesores.estado.listado"), href: "/materias", icon: Library },
      ],
    },
    {
      label: textoC19("ui.clases.menu.aulas"),
      icon: DoorOpen,
      items: [
        { label: textoC19("ui.profesores.estado.listado"), href: "/aulas", icon: ListOrdered },
      ],
    },
    {
      label: textoC19("ui.formasPago.titulo"),
      icon: Wallet,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/formas-pago", icon: ListOrdered }],
    },
    // HU-I-12: cajas abiertas y cierres de todo el personal (cajas:leer_todas, solo Gerente).
    { label: texto("ui.cajas.menu"), href: "/cajas", prefijoActivo: "/cajas", icon: Banknote },
    // HU-F-01 y HU-F-03: personal de mesa de entrada (personal:*, solo Gerente).
    {
      label: texto("ui.personal.menu"),
      icon: UserCog,
      items: [{ label: texto("ui.profesores.estado.listado"), href: "/personal", icon: ListOrdered }],
    },
    // HU-G-01: gerentes (gerentes:*, solo Gerente), con el mismo patrón que el personal.
    {
      label: texto("ui.gerentes.menu"),
      icon: BriefcaseBusiness,
      items: [{ label: texto("ui.profesores.estado.listado"), href: "/gerentes", icon: ListOrdered }],
    },
  ],
  // materias:leer (HU-L-02): Profesor también consulta el catálogo al
  // operar otros módulos (ej. asociar sus propias materias, HU-D-03).
  PROFESOR: [
    // Para el rol Profesor, /calendario/profesor es "Mi agenda" (su propia
    // agenda, resuelta desde la sesión en la página).
    {
      label: textoC19("ui.clases.menu.calendario"),
      icon: CalendarDays,
      items: [
        {
          label: textoC19("ui.clases.menu.porProfesor"),
          href: "/calendario/profesor",
          icon: GraduationCap // o UserRound
        }
      ]
    },
    // alumnos:leer: solo lectura (sin alta ni edición).
    {
      label: textoC19("ui.clases.menu.alumnos"),
      icon: Users,
      items: [{ label: textoC19("ui.profesores.estado.listado"), href: "/alumnos", icon: Contact }],
    },
  ],
  ALUMNO: [
    {
      label: textoC19("ui.sesion.menu.miCuenta"),
      icon: CalendarDays,
      collapsible: false,
      hideItemIcons: true,
      items: [
        { label: textoC19("ui.turnos.solicitar.misClases"), href: "/alumno", icon: CalendarDays },
        { label: textoC19("ui.turnos.solicitar.titulo"), href: "/alumno/turnos/solicitar", icon: CalendarPlus2 },
      ],
    },
  ],
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
  const secciones: SidebarNavEntrada[] = SECCIONES_POR_ROL[session.user.rol].map((seccion) => {
    const SeccionIcon = seccion.icon;
    if (!("items" in seccion)) {
      return {
        label: seccion.label,
        href: seccion.href,
        prefijoActivo: seccion.prefijoActivo,
        icon: <SeccionIcon className="size-4 shrink-0" aria-hidden />,
      };
    }
    return {
      label: seccion.label,
      icon: <SeccionIcon className="size-4 shrink-0" aria-hidden />,
      collapsible: seccion.collapsible,
      hideItemIcons: seccion.hideItemIcons,
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
