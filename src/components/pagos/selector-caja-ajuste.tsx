"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { antiguedad } from "@/lib/caja";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import type { CajaAbiertaFila, CajasYCierresDto } from "@/types/caja.types";

/**
 * HU-I-06 (spec_modulo_I.md §2.14.4): elige la caja abierta de mesa de
 * entrada que recibe el ajuste cuando la caja del pago ya cerró. Solo se
 * monta cuando el servidor rechazó con `CAJA_DE_AJUSTE_NO_ABIERTA` (le pasa
 * únicamente al Gerente, que tiene `cajas:leer_todas`): consulta las
 * `abiertas` de `GET /api/cajas` recién entonces, nunca de entrada.
 */
export function SelectorCajaAjuste({ enviando = false, onReintentar }: {
  enviando?: boolean;
  onReintentar: (cajaId: string) => void;
}) {
  const id = useId();
  const [abiertas, setAbiertas] = useState<CajaAbiertaFila[] | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [cajaId, setCajaId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchAutenticado("/api/cajas", { cache: "no-store", signal: controller.signal })
      .then(async (respuesta) => {
        const resultado = await respuesta.json().catch(() => null) as { data?: CajasYCierresDto } | null;
        if (!respuesta.ok || !resultado?.data) throw new Error("cajas");
        setAbiertas(resultado.data.abiertas);
        setError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [intento]);

  if (error) return (
    <p className="text-sm text-destructive">
      {texto("ui.pagos.correccion.cajaAjuste.error")}{" "}
      <button type="button" className="text-primary underline underline-offset-4" onClick={() => { setError(false); setIntento((n) => n + 1); }}>
        {texto("ui.pagos.historial.reintentar")}
      </button>
    </p>
  );
  if (abiertas === null) return <p role="status" className="text-sm text-muted-foreground">{texto("ui.pagos.correccion.cajaAjuste.cargando")}</p>;
  if (abiertas.length === 0) return <p className="text-sm text-muted-foreground">{texto("ui.pagos.correccion.cajaAjuste.sinCajas")}</p>;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{texto("ui.pagos.correccion.cajaAjuste.titulo")}</label>
      <select id={id} value={cajaId} onChange={(evento) => setCajaId(evento.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">{texto("ui.pagos.correccion.cajaAjuste.placeholder")}</option>
        {abiertas.map((caja) => (
          <option key={caja.id} value={caja.id}>
            {texto("ui.pagos.correccion.cajaAjuste.opcion", { integrante: caja.integrante.nombre_completo ?? "—", tiempo: antiguedad(caja.antiguedad_minutos) })}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" disabled={!cajaId || enviando} onClick={() => onReintentar(cajaId)}>
        {texto("ui.pagos.correccion.cajaAjuste.reintentar")}
      </Button>
    </div>
  );
}
