"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearMonto } from "@/lib/moneda";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";
import type { ClasePendienteDePago } from "@/types/pago.types";
import { EstadoPagoBadge } from "./estado-pago-badge";
import { claveDeClase, clasesElegidas, totalElegido, type ErroresDeFila, type FilaElegible, type Seleccion } from "./seleccion-clases";

type Props = {
  nombreAlumno: string;
  clases: ClasePendienteDePago[];
  seleccion: Seleccion;
  /** Errores visibles (se muestran después de intentar continuar). */
  errores: Record<string, ErroresDeFila>;
  avisoSinElegir: boolean;
  onCambiarFila: (clave: string, cambio: Partial<FilaElegible>) => void;
  onBuscarOtro: () => void;
  onVolver: () => void;
  onContinuar: () => void;
};

/**
 * Paso 2 (spec_modulo_I.md §2.7.2): clases del alumno sin pago registrado,
 * con checkbox por fila, estado de pago, importe precargado con el precio y
 * «Modificar importe» con motivo. El total se recalcula al marcar, desmarcar
 * o cambiar un importe (HU-I-10 criterio 4).
 */
export function PasoClasesAlumno({ nombreAlumno, clases, seleccion, errores, avisoSinElegir, onCambiarFila, onBuscarOtro, onVolver, onContinuar }: Props) {
  const elegidas = clasesElegidas(clases, seleccion).length;
  const total = totalElegido(clases, seleccion);

  return <section className="space-y-4" aria-labelledby="paso-clases-titulo">
    <div className="space-y-1">
      <h2 id="paso-clases-titulo" className="text-lg font-semibold">{texto("ui.pagos.clases.titulo", { alumno: nombreAlumno })}</h2>
      {clases.length > 0 && <p className="text-sm text-muted-foreground">{texto("ui.pagos.clases.descripcion")}</p>}
    </div>
    <Button type="button" variant="ghost" className="h-auto px-0 text-primary underline-offset-4 hover:bg-transparent hover:underline" onClick={onBuscarOtro}>{texto("ui.pagos.clases.buscarOtro")}</Button>

    {clases.length === 0 ? (
      <p role="status" className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">{texto("ui.pagos.sinClasesPendientes")}</p>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="w-10 px-4 py-3"><span className="sr-only">{texto("ui.pagos.resumen.clases")}</span></th>
              <th scope="col" className="px-4 py-3 text-left font-medium">{texto("ui.pagos.clases.fecha")}</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">{texto("ui.pagos.clases.materiaProfesor")}</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">{texto("ui.pagos.clases.estadoPago")}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{texto("ui.pagos.clases.importe")}</th>
            </tr>
          </thead>
          <tbody>
            {clases.map((clase) => {
              const clave = claveDeClase(clase);
              const fila = seleccion[clave]!;
              const error = errores[clave];
              const fecha = diaAbreviadoYFecha(clase.fecha);
              const idMonto = `importe-${clave}`;
              return <tr key={clave} className="border-b border-border align-top last:border-b-0">
                <td className="px-4 py-3">
                  <input type="checkbox" className="mt-1 size-4 accent-primary" checked={fila.elegida}
                    aria-label={texto("ui.pagos.clases.elegir", { materia: clase.materia.nombre, fecha })}
                    onChange={(evento) => onCambiarFila(clave, { elegida: evento.target.checked })} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono">{fecha} {clase.hora_inicio}</td>
                <td className="px-4 py-3">
                  <span className="block">{clase.materia.nombre}</span>
                  {clase.profesor && <span className="block text-xs text-muted-foreground">{clase.profesor.nombre_completo}</span>}
                </td>
                <td className="px-4 py-3"><EstadoPagoBadge estado={clase.estado_pago} venceEl={clase.vence_el} /></td>
                <td className="px-4 py-3 text-right">
                  <span className="block font-mono font-semibold">{formatearMonto(clase.precio)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {clase.origen_precio === "INSCRIPCION" ? texto("ui.pagos.origen.inscripcion") : texto("ui.pagos.origen.tarifaVigente")}
                  </span>
                  {fila.modificando ? (
                    <div className="mt-2 space-y-2 text-left">
                      <label htmlFor={idMonto} className="block text-xs font-medium">{texto("ui.pagos.importe.etiqueta", { materia: clase.materia.nombre })}</label>
                      <Input id={idMonto} inputMode="decimal" value={fila.monto} aria-invalid={Boolean(error?.monto)}
                        aria-describedby={error?.monto ? `${idMonto}-error` : undefined}
                        onChange={(evento) => onCambiarFila(clave, { monto: evento.target.value })} />
                      {error?.monto && <p id={`${idMonto}-error`} className="text-xs text-destructive">{texto("ui.pagos.importe.invalido")}</p>}
                      <label htmlFor={`${idMonto}-motivo`} className="block text-xs font-medium">{texto("ui.pagos.importe.motivo")}</label>
                      <Input id={`${idMonto}-motivo`} maxLength={300} value={fila.motivo} aria-invalid={Boolean(error?.motivo)}
                        aria-describedby={error?.motivo ? `${idMonto}-motivo-error` : undefined}
                        onChange={(evento) => onCambiarFila(clave, { motivo: evento.target.value })} />
                      {error?.motivo && <p id={`${idMonto}-motivo-error`} className="text-xs text-destructive">{texto("ui.pagos.importe.motivoRequerido")}</p>}
                      <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-xs text-primary underline-offset-4 hover:bg-transparent hover:underline"
                        onClick={() => onCambiarFila(clave, { modificando: false, monto: String(clase.precio), motivo: "" })}>
                        {texto("ui.pagos.importe.usarPrecio")}
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-xs text-primary underline-offset-4 hover:bg-transparent hover:underline" onClick={() => onCambiarFila(clave, { modificando: true })}>
                      {texto("ui.pagos.importe.modificar")}
                    </Button>
                  )}
                </td>
              </tr>;
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td colSpan={3} className="px-4 py-3">
                {elegidas === 1 ? texto("ui.pagos.clases.elegidas.una") : texto("ui.pagos.clases.elegidas.varias", { n: elegidas })}
              </td>
              <td colSpan={2} className="px-4 py-3 text-right font-mono" data-testid="total-paso-clases">
                {texto("ui.pagos.clases.total", { total: formatearMonto(total) })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    )}

    {avisoSinElegir && <p role="alert" className="text-sm text-destructive">{texto("ui.pagos.clases.ningunaElegida")}</p>}
    <div className="flex justify-between gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onVolver}>{texto("ui.pagos.acciones.volver")}</Button>
      {clases.length > 0 && <Button type="button" onClick={onContinuar}>{texto("ui.pagos.acciones.continuar")}</Button>}
    </div>
  </section>;
}
