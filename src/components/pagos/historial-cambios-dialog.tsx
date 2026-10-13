"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { fechaCorta, monto } from "@/lib/turno-detalle";
import type { HistorialPagoDto, TipoCambioPago } from "@/types/pago.types";

const fechaHora = (valor: string) => new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date(valor));

const ETIQUETA_TIPO: Record<TipoCambioPago, string> = {
  CORRECCION_MONTO: texto("ui.pagos.correccion.historial.tipo.correccionMonto"),
  CORRECCION_FORMA: texto("ui.pagos.correccion.historial.tipo.correccionForma"),
  CORRECCION_FECHA: texto("ui.pagos.correccion.historial.tipo.correccionFecha"),
  ANULACION: texto("ui.pagos.correccion.historial.tipo.anulacion"),
};

const COLUMNAS = [
  texto("ui.pagos.correccion.historial.columna.tipo"),
  texto("ui.pagos.correccion.historial.columna.valores"),
  texto("ui.pagos.correccion.historial.columna.motivo"),
  texto("ui.pagos.correccion.historial.columna.usuario"),
  texto("ui.pagos.correccion.historial.columna.fecha"),
];

/** Cada tipo guarda su valor en su propio formato: monto decimal, nombre de la forma o fecha `YYYY-MM-DD`. */
function valorLegible(tipo: TipoCambioPago, valor: string | null): string {
  if (valor === null) return "—";
  if (tipo === "CORRECCION_MONTO" || tipo === "ANULACION") return monto(valor);
  if (tipo === "CORRECCION_FECHA") return fechaCorta(valor);
  return valor;
}

/**
 * «Detalle del pago» (HU-I-06 criterio 3, DEC-27, spec_modulo_I.md §2.14.6):
 * modal de solo lectura con los valores vigentes y quién lo registró, y
 * debajo cada corrección o anulación con su anterior → nuevo, el motivo, el
 * usuario y la fecha, más nuevas primero. Consulta
 * `GET /api/pagos/[id]/historial` al abrirse. No modifica datos: sin toast.
 */
export function HistorialCambiosDialog({ pagoId, titulo, onCerrar }: { pagoId: string; titulo: string; onCerrar: () => void }) {
  const [data, setData] = useState<HistorialPagoDto | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAutenticado(`/api/pagos/${encodeURIComponent(pagoId)}/historial`, { cache: "no-store", signal: controller.signal })
      .then(async (respuesta) => {
        const resultado = await respuesta.json().catch(() => null) as { data?: HistorialPagoDto } | null;
        if (!respuesta.ok || !resultado?.data) throw new Error("historial");
        setData(resultado.data);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [pagoId, intento]);

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{texto("ui.pagos.correccion.historial.titulo")}</DialogTitle>
          <DialogDescription>{titulo}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-5 text-sm">
          {error ? (
            <p role="alert" className="text-destructive">
              {texto("ui.pagos.correccion.historial.error")}{" "}
              <button type="button" className="text-primary underline underline-offset-4" onClick={() => { setError(false); setIntento((n) => n + 1); }}>
                {texto("ui.pagos.historial.reintentar")}
              </button>
            </p>
          ) : data === null ? (
            <p role="status" className="text-muted-foreground">{texto("ui.pagos.correccion.historial.cargando")}</p>
          ) : <>
            <section aria-labelledby={`registro-${pagoId}`} className="space-y-1 rounded-md border border-border p-3">
              <h3 id={`registro-${pagoId}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">{texto("ui.pagos.correccion.historial.registro")}</h3>
              <p className="font-medium">
                <span className="font-mono tabular-nums">{monto(data.registro.monto)}</span> · {data.registro.forma_pago.nombre} · {fechaCorta(data.registro.fecha_pago)}
              </p>
              <p className="text-xs text-muted-foreground">
                {texto("ui.pagos.correccion.historial.registradoPor", { usuario: data.registro.registrado_por.nombre_completo ?? "—", fecha: fechaHora(data.registro.registrado_en) })}
              </p>
            </section>
            <section aria-labelledby={`cambios-${pagoId}`} className="space-y-2">
              <h3 id={`cambios-${pagoId}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">{texto("ui.pagos.correccion.historial.cambios")}</h3>
              {data.cambios.length === 0 ? (
                <p className="text-muted-foreground">{texto("ui.pagos.correccion.historial.sinCambios")}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="border-b border-border uppercase text-muted-foreground">
                      <tr>
                        {COLUMNAS.map((columna) => <th key={columna} scope="col" className="px-3 py-2 font-medium">{columna}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.cambios.map((cambio, indice) => (
                        <tr key={`${cambio.tipo}-${cambio.fecha}-${indice}`}>
                          <td className="px-3 py-2 align-top font-medium">{ETIQUETA_TIPO[cambio.tipo]}</td>
                          <td className="px-3 py-2 align-top whitespace-nowrap">
                            {valorLegible(cambio.tipo, cambio.valor_anterior)}{cambio.valor_nuevo !== null && <> → {valorLegible(cambio.tipo, cambio.valor_nuevo)}</>}
                          </td>
                          <td className="px-3 py-2 align-top break-words">{cambio.motivo}</td>
                          <td className="px-3 py-2 align-top">{cambio.usuario ? cambio.usuario.nombre_completo ?? "—" : texto("ui.pagos.correccion.historial.procesoAutomatico")}</td>
                          <td className="px-3 py-2 align-top whitespace-nowrap">{fechaHora(cambio.fecha)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>}
        </div>
        <DialogFooter className="mt-5">
          <Button type="button" variant="outline" onClick={onCerrar}>{texto("ui.pagos.correccion.historial.cerrar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
