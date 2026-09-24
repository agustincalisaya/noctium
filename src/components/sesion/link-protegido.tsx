"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useDirtyState } from "@/components/sesion/dirty-state-context";

type LinkProtegidoProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/**
 * `<Link>` que pide confirmación antes de salir si hay cambios sin guardar
 * (`DirtyStateProvider`). Usa `onNavigate`, que solo corre en navegaciones
 * del lado del cliente: Ctrl/Cmd+click (pestaña nueva) no se intercepta,
 * porque no abandona la pantalla actual. Sin cambios pendientes se comporta
 * igual que `<Link>`.
 *
 * No usar en el botón explícito "Cancelar" de un formulario: ese conserva
 * su propio comportamiento (ver `dirty-state-context.tsx`).
 */
export function LinkProtegido({ href, replace, scroll, onNavigate, ...props }: LinkProtegidoProps) {
  const router = useRouter();
  const { dirty, confirmarSalida } = useDirtyState();

  return (
    <Link
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(event) => {
        onNavigate?.(event);
        if (!dirty) return;
        event.preventDefault();
        confirmarSalida(() => (replace ? router.replace(href, { scroll }) : router.push(href, { scroll })));
      }}
      {...props}
    />
  );
}
