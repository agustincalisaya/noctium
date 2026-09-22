"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

export function AvisoExpiracion({
  expiresISO,
  avisoAnticipadoMin,
}: {
  expiresISO: string;
  avisoAnticipadoMin: number;
}) {
  const router = useRouter();
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const [renovando, setRenovando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const expiraEn = new Date(expiresISO).getTime();
    const umbralMs = avisoAnticipadoMin * 60_000;

    function tick() {
      const restanteMs = expiraEn - Date.now();
      setSegundosRestantes(restanteMs > 0 && restanteMs <= umbralMs ? Math.ceil(restanteMs / 1000) : null);
    }

    tick();
    const intervalo = setInterval(tick, 1000);
    return () => clearInterval(intervalo);
  }, [expiresISO, avisoAnticipadoMin]);

  async function continuarSesion() {
    setRenovando(true);
    setError(null);
    try {
      const response = await fetchAutenticado("/api/auth/ping", { method: "POST" });
      if (!response.ok) throw new Error("ping falló");
      setSegundosRestantes(null);
      // Re-renderiza el layout server-side: vuelve a leer auth() y baja un
      // `expires` nuevo, así el timer de arriba se resetea contra el real.
      router.refresh();
    } catch {
      setError(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setRenovando(false);
    }
  }

  if (segundosRestantes === null) return null;

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100"
    >
      <span>
        Tu sesión vence en {minutos}:{String(segundos).padStart(2, "0")}.
      </span>
      <Button size="sm" onClick={continuarSesion} disabled={renovando}>
        {renovando ? "Renovando..." : "Continuar sesión"}
      </Button>
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}
