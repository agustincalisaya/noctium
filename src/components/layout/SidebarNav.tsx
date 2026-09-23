"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { Menu, X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  label: string;
  href: string;
  /** Ya resuelto a JSX (`<Icon className="..." />`) por `Sidebar.tsx`
   * antes de cruzar el límite Server->Client: un componente lucide crudo
   * no es serializable como prop de un Client Component. */
  icon: ReactNode;
  /** Sub-ítems, si los hubiera — siempre expandidos, sin acordeón propio
   * (el acordeón es solo a nivel de sección). Ninguna sección de Sprint 1
   * los usa todavía; el tipo queda listo para cuando haga falta. */
  children?: SidebarNavItem[];
}

export interface SidebarNavSection {
  label: string;
  icon: ReactNode;
  items: SidebarNavItem[];
}

const STORAGE_KEY = "noctium:sidebar:secciones-abiertas";

/**
 * Un href está "activo" si coincide exacto con el pathname, o si el
 * pathname es un descendiente (`href` + "/" + algo más). "/" es especial:
 * solo matchea por igualdad exacta, si no cualquier ruta lo activaría.
 */
function esRutaActiva(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * De todos los hrefs de todas las secciones que matchean el pathname
 * actual, el "activo" es el de match más específico (más largo) — así
 * "/turnos" no queda marcado activo estando en "/turnos/nuevo" si son
 * ítems hermanos, ambos técnicamente "match" por prefijo.
 */
function calcularHrefActivo(secciones: SidebarNavSection[], pathname: string): string | null {
  let mejor: string | null = null;
  for (const seccion of secciones) {
    for (const item of seccion.items) {
      if (esRutaActiva(pathname, item.href) && (!mejor || item.href.length > mejor.length)) {
        mejor = item.href;
      }
    }
  }
  return mejor;
}

// --- Persistencia de secciones abiertas (localStorage vía useSyncExternalStore) ---
// No usar useState + useEffect: useSyncExternalStore es lo correcto para una
// fuente de verdad externa al árbol de React (localStorage), con snapshot de
// servidor vacío (SSR no tiene localStorage) y sin el flash/desync que
// useEffect introduciría entre el render inicial y la hidratación.

type SeccionesAbiertas = Record<string, boolean>;

function leerDeLocalStorage(): SeccionesAbiertas {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as SeccionesAbiertas) : {};
  } catch {
    // JSON corrupto u otro error de parseo: se trata como "sin preferencia
    // guardada", nunca rompe el render.
    return {};
  }
}

let snapshotCache: SeccionesAbiertas | null = null;
function getSnapshot(): SeccionesAbiertas {
  if (snapshotCache === null) snapshotCache = leerDeLocalStorage();
  return snapshotCache;
}

// Referencia estable de módulo: useSyncExternalStore exige que, sin
// cambios reales, el snapshot devuelva la MISMA referencia entre llamadas
// (si no, asume que cambió en cada render y entra en loop). Un literal
// `{}` creado dentro de la función rompe esa garantía en SSR/hidratación.
const SNAPSHOT_VACIO_SERVIDOR: SeccionesAbiertas = {};
function getServerSnapshot(): SeccionesAbiertas {
  return SNAPSHOT_VACIO_SERVIDOR;
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  function handleStorage(e: StorageEvent) {
    // key === null es `localStorage.clear()` — también hay que
    // resincronizar en ese caso, no solo cuando cambia nuestra key puntual.
    if (e.key === STORAGE_KEY || e.key === null) {
      snapshotCache = null;
      listener();
    }
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}
function setSeccionAbierta(label: string, abierta: boolean): void {
  const siguiente = { ...leerDeLocalStorage(), [label]: abierta };
  snapshotCache = siguiente;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(siguiente));
  } catch {
    // Cuota excedida / modo privado: la preferencia simplemente no
    // persiste entre sesiones, no es un error que deba romper la UI.
  }
  listeners.forEach((l) => l());
}

function estaAbierta(estado: SeccionesAbiertas, label: string, esSeccionActiva: boolean): boolean {
  if (esSeccionActiva) return true; // la sección de la ruta activa siempre abierta
  return estado[label] ?? true; // sin preferencia guardada -> abierta por default
}

/**
 * Navegación del área autenticada (Sidebar.tsx la arma server-side y le
 * pasa `secciones` ya filtradas por rol — este componente solo se encarga
 * de la interacción: acordeón, activo, mobile/rail).
 *
 * El filtro de qué ítems se ven es solo navegación/UX — la seguridad real
 * es la de cada `page.tsx`/Route Handler vía `withPermission()` (HU-A-02
 * criterio 2): un 403 del servidor protege igual aunque se invoque la URL
 * directo, sin pasar por acá.
 */
export function SidebarNav({ secciones }: { secciones: SidebarNavSection[] }) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [menuMobileAbierto, setMenuMobileAbierto] = useState(false);
  const seccionesAbiertas = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const hrefActivo = calcularHrefActivo(secciones, pathname);

  function cerrarMobile() {
    setMenuMobileAbierto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuMobileAbierto((v) => !v)}
        aria-label={menuMobileAbierto ? "Cerrar menú" : "Abrir menú"}
        className="fixed top-3 left-3 z-50 rounded-md border bg-card p-2 text-foreground shadow-sm lg:hidden"
      >
        {menuMobileAbierto ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>

      {menuMobileAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={cerrarMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          colapsado ? "lg:w-[72px]" : "lg:w-64",
          menuMobileAbierto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            N
          </span>
          {!colapsado && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Noctium</span>
              <span className="block truncate text-xs text-sidebar-foreground/70">
                Centro de Atención
              </span>
            </span>
          )}
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {secciones.map((seccion) => {
            const seccionActiva = seccion.items.some((item) => item.href === hrefActivo);

            if (colapsado) {
              return (
                <div key={seccion.label} className="space-y-1">
                  {seccion.items.map((item) => (
                    <ItemLink
                      key={item.href}
                      item={item}
                      activo={item.href === hrefActivo}
                      soloIcono
                      onNavigate={cerrarMobile}
                    />
                  ))}
                </div>
              );
            }

            const abierta = estaAbierta(seccionesAbiertas, seccion.label, seccionActiva);

            return (
              <Collapsible.Root
                key={seccion.label}
                open={abierta}
                onOpenChange={(open) => setSeccionAbierta(seccion.label, open)}
              >
                <Collapsible.Trigger className="group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  {seccion.icon}
                  <span className="flex-1 text-left">{seccion.label}</span>
                  <ChevronDown
                    className="size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180"
                    aria-hidden
                  />
                </Collapsible.Trigger>
                <Collapsible.Panel className="space-y-1 overflow-hidden pt-1 pl-2">
                  {seccion.items.map((item) => (
                    <ItemLink
                      key={item.href}
                      item={item}
                      activo={item.href === hrefActivo}
                      onNavigate={cerrarMobile}
                    />
                  ))}
                </Collapsible.Panel>
              </Collapsible.Root>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setColapsado((v) => !v)}
          aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="absolute top-16 -right-3 hidden size-6 items-center justify-center rounded-full border bg-card text-foreground shadow lg:flex"
        >
          {colapsado ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <ChevronLeft className="size-4" aria-hidden />
          )}
        </button>
      </aside>
    </>
  );
}

function ItemLink({
  item,
  activo,
  soloIcono,
  onNavigate,
}: {
  item: SidebarNavItem;
  activo: boolean;
  soloIcono?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={activo ? "page" : undefined}
      title={soloIcono ? item.label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md border-l-4 px-2 py-2 text-sm transition-colors",
        soloIcono && "justify-center px-0",
        activo
          ? "border-brand-accent bg-sidebar-primary font-medium text-sidebar-primary-foreground"
          : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {item.icon}
      {!soloIcono && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
