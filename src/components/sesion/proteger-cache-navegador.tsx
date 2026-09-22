"use client";

import { useEffect } from "react";

/**
 * `Cache-Control: no-store` no alcanza para evitar que una pantalla
 * protegida se muestre "volviendo atrás" con datos viejos (HU-A-02
 * criterio 6): desde Chrome 108, el back/forward cache (bfcache) ignora
 * ese header a propósito — es una restauración completa de la página en
 * memoria, sin ningún request al servidor, así que ni el middleware
 * (proxy.ts) ni el layout llegan a revalidar la sesión.
 *
 * `pageshow` con `event.persisted === true` es la señal de que la página
 * vino del bfcache. Forzar una recarga real hace que el servidor vuelva a
 * decidir (redirige a /login si la sesión ya no es válida).
 */
export function ProtegerCacheNavegador() {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
