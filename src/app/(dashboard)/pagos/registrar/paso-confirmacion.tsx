"use client";

import { useState } from "react";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearMonto } from "@/lib/moneda";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha, fechaCorta } from "@/lib/turno-detalle";
import type { ClasePendienteDePago } from "@/types/pago.types";

export type ClaseAConfirmar = { clase: ClasePendienteDePago; importe: string; motivo: string | null };

type Props = {
  nombreAlumno: string;
  clases: ClaseAConfirmar[];
  total: number;
  formas: { id: string; nombre: string }[];
  formaPagoId: string;
  /** AAAA-MM-DD. */
  fechaPago: string;
  /** Hoy en la zona del centro (AAAA-MM-DD): tope de la fecha de pago. */
  hoy: string;
  onCambiarForma: (formaPagoId: string) => void;
  onCambiarFecha: (fecha: string) => void;
  onVolver: () => void;
  /** POST de la operación; si el servidor rechaza, lanza un Error con el texto a mostrar en el diálogo. */
  onRegistrar: () => Promise<void>;
  onRegistrado: () => void;
};

/**
 * Paso 3 (spec_modulo_I.md §2.7, HU-I-10 criterios 5 y 6): forma de pago
 * (la preferida del alumno ya viene elegida por el wizard), fecha de pago y
 * la confirmación de HU-C-25. El rechazo del servidor se muestra dentro del
 * diálogo, sin cerrarlo; la operación se puede corregir o anular después
 * (HU-I-06), por eso no es `irreversible`.
 */
export function PasoConfirmacion({
  nombreAlumno, clases, total, formas, formaPagoId, fechaPago, hoy,
  onCambiarForma, onCambiarFecha, onVolver, onRegistrar, onRegistrado,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const forma = formas.find(({ id }) => id === formaPagoId);
  const errorForma = intentado && !forma;
  const errorFecha = intentado && (!fechaPago || fechaPago > hoy);

  const confirmar = () => {
    setIntentado(true);
    if (!forma || !fechaPago || fechaPago > hoy) return;
    setAbierto(true);
  };

  return <section className="space-y-5" aria-labelledby="paso-confirmacion-titulo">
    <h2 id="paso-confirmacion-titulo" className="text-lg font-semibold">{texto("ui.pagos.confirmacion.titulo")}</h2>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="registrar-pago-forma" className="text-sm font-medium">{texto("ui.pagos.confirmacion.formaPago")}</label>
        <select id="registrar-pago-forma" value={formaPagoId} onChange={(evento) => onCambiarForma(evento.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
          aria-invalid={errorForma} aria-describedby={errorForma ? "registrar-pago-forma-error" : undefined}>
          <option value="">{texto("ui.pagos.confirmacion.elegirForma")}</option>
          {formas.map(({ id, nombre }) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        {errorForma && <p id="registrar-pago-forma-error" className="text-xs text-destructive">{texto("ui.pagos.confirmacion.elegirForma")}</p>}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="registrar-pago-fecha" className="text-sm font-medium">{texto("ui.pagos.confirmacion.fechaPago")}</label>
        <Input id="registrar-pago-fecha" type="date" value={fechaPago} max={hoy} onChange={(evento) => onCambiarFecha(evento.target.value)}
          aria-invalid={errorFecha} aria-describedby={errorFecha ? "registrar-pago-fecha-error" : undefined} />
        {errorFecha && <p id="registrar-pago-fecha-error" className="text-xs text-destructive">{texto("ui.pagos.confirmacion.fechaFutura")}</p>}
      </div>
    </div>

    <DetalleClases clases={clases} />

    <div className="flex justify-between gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onVolver}>{texto("ui.pagos.acciones.volver")}</Button>
      <Button type="button" onClick={confirmar}>{texto("ui.pagos.acciones.confirmar")}</Button>
    </div>

    <ConfirmarAccionDialog
      abierto={abierto}
      titulo={texto("confirmaciones.pagos.registrarOperacion", { total: formatearMonto(total), alumno: nombreAlumno })}
      detalle={<>
        <DetalleClases clases={clases} />
        <p className="mt-3">{texto("ui.pagos.confirmacion.formaYFecha", { forma: forma?.nombre ?? "", fecha: fechaPago ? fechaCorta(fechaPago) : "" })}</p>
      </>}
      textoConfirmar={texto("ui.pagos.acciones.registrar")}
      irreversible={false}
      onConfirmar={onRegistrar}
      onExito={onRegistrado}
      onCerrar={() => setAbierto(false)}
    />
  </section>;
}

/** Clases elegidas con su importe (y el motivo cuando difiere del precio). */
function DetalleClases({ clases }: { clases: ClaseAConfirmar[] }) {
  return <table className="w-full text-sm">
    <thead className="text-xs uppercase text-muted-foreground">
      <tr className="border-b border-border">
        <th scope="col" className="py-2 text-left font-medium">{texto("ui.pagos.confirmacion.clase")}</th>
        <th scope="col" className="py-2 text-right font-medium">{texto("ui.pagos.confirmacion.importe")}</th>
      </tr>
    </thead>
    <tbody>
      {clases.map(({ clase, importe, motivo }) => <tr key={clase.inscripcion_id ?? clase.turno_id} className="border-b border-border last:border-b-0 text-foreground">
        <td className="py-2">
          <span className="block">{clase.materia.nombre} · {diaAbreviadoYFecha(clase.fecha)} {clase.hora_inicio}</span>
          {motivo && <span className="block text-xs text-muted-foreground">{texto("ui.pagos.confirmacion.motivo", { motivo })}</span>}
        </td>
        <td className="py-2 text-right font-mono align-top">{formatearMonto(Number(importe))}</td>
      </tr>)}
    </tbody>
  </table>;
}
