"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import type { ItemHistorialAcademico } from "@/types/historial.types";

type ResultadoExamenHistorial = Extract<ItemHistorialAcademico, { tipo: "EXAMEN" }>;
type AccionExamen = "corregir" | "anular";
type CorreccionPendiente = { fecha_examen?: string; nota?: string; motivo: string };

function hoyBuenosAires() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function fechaHora(fecha: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(fecha));
}

function fechaCorta(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function ResultadoExamenAcciones({
  alumnoId,
  item,
  onActualizado,
}: {
  alumnoId: string;
  item: ResultadoExamenHistorial;
  onActualizado: () => void;
}) {
  const [editor, setEditor] = useState<AccionExamen | null>(null);
  const [confirmacion, setConfirmacion] = useState<AccionExamen | null>(null);
  const [fecha, setFecha] = useState(item.fecha);
  const [nota, setNota] = useState(item.nota);
  const [motivo, setMotivo] = useState("");
  const [errorLocal, setErrorLocal] = useState("");
  const [correccionPendiente, setCorreccionPendiente] = useState<CorreccionPendiente | null>(null);

  const abrirEditor = (accion: AccionExamen) => {
    setFecha(item.fecha);
    setNota(item.nota);
    setMotivo("");
    setErrorLocal("");
    setCorreccionPendiente(null);
    setEditor(accion);
  };

  const prepararConfirmacion = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
      setErrorLocal(texto("ui.historial.examen.motivoRequerido"));
      return;
    }

    if (editor === "corregir") {
      const notaLimpia = nota.trim().replace(",", ".");
      if (!/^\d{1,3}(\.\d)?$/.test(notaLimpia)) {
        setErrorLocal(texto("ui.historial.examen.notaInvalida"));
        return;
      }
      const cambios: CorreccionPendiente = { motivo: motivoLimpio };
      if (fecha !== item.fecha) cambios.fecha_examen = fecha;
      if (Number(notaLimpia) !== Number(item.nota)) cambios.nota = notaLimpia;
      if (cambios.fecha_examen === undefined && cambios.nota === undefined) {
        setErrorLocal(texto("ui.historial.examen.sinCambios"));
        return;
      }
      setCorreccionPendiente(cambios);
      setEditor(null);
      setConfirmacion("corregir");
      return;
    }

    setEditor(null);
    setConfirmacion("anular");
  };

  const confirmar = async () => {
    const accion = confirmacion;
    if (!accion) return;
    const body = accion === "corregir" ? correccionPendiente : { motivo: motivo.trim() };
    if (!body) throw new Error(texto("ui.historial.examen.errorOperacion"));
    await fetchOLanzar(`/api/alumnos/${encodeURIComponent(alumnoId)}/examenes/${encodeURIComponent(item.id)}/${accion === "corregir" ? "correccion" : "anulacion"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  };

  const confirmarVolver = () => {
    const accion = confirmacion;
    setConfirmacion(null);
    if (accion) setEditor(accion);
  };

  const confirmarExito = () => {
    const accion = confirmacion;
    setConfirmacion(null);
    setEditor(null);
    toast.success(texto(accion === "anular" ? "ui.historial.examen.anulacionGuardada" : "ui.historial.examen.guardado"));
    onActualizado();
  };

  const detalleConfirmacion = confirmacion === "corregir" && correccionPendiente
    ? texto("ui.historial.examen.detalleCorregir", {
      fechaAnterior: fechaCorta(item.fecha),
      notaAnterior: item.nota.replace(".", ","),
      fechaNueva: fechaCorta(correccionPendiente.fecha_examen ?? item.fecha),
      notaNueva: (correccionPendiente.nota ?? item.nota).replace(".", ","),
      motivo: correccionPendiente.motivo,
    })
    : confirmacion === "anular" ? texto("ui.historial.examen.motivoAnulacion", { motivo: motivo.trim() }) : undefined;

  return (
    <div className="space-y-2 pl-4">
      {item.corregido && <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{texto("ui.historial.examen.corregido")}</span>}
      {item.anulado && item.anulacion && <div className="space-y-1 text-xs text-muted-foreground">
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{texto("ui.historial.examen.anulado")}</span>
        <p>{texto("ui.historial.examen.motivoAnulacion", { motivo: item.anulacion.motivo })}</p>
        <p>{texto("ui.historial.examen.datosAnulacion", { fecha: fechaHora(item.anulacion.anulada_en), usuario: item.anulacion.anulada_por ?? "—" })}</p>
      </div>}
      {item.puede_corregir && !item.anulado && <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" aria-label={texto("ui.historial.examen.ariaCorregir", { materia: item.materia.nombre, fecha: fechaCorta(item.fecha) })} onClick={() => abrirEditor("corregir")}>{texto("ui.historial.examen.corregir")}</Button>
        <Button type="button" variant="outline" aria-label={texto("ui.historial.examen.ariaAnular", { materia: item.materia.nombre, fecha: fechaCorta(item.fecha) })} onClick={() => abrirEditor("anular")}>{texto("ui.historial.examen.anular")}</Button>
      </div>}

      <Dialog open={editor !== null} onOpenChange={(abierto) => { if (!abierto) setEditor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{texto(editor === "anular" ? "ui.historial.examen.dialogoAnular" : "ui.historial.examen.dialogoCorregir")}</DialogTitle>
            <DialogDescription>{item.materia.nombre}</DialogDescription>
          </DialogHeader>
          <form className="mt-5 space-y-4" onSubmit={prepararConfirmacion}>
            {editor === "corregir" && <>
              <div className="space-y-1.5">
                <label htmlFor={`fecha-examen-${item.id}`} className="text-sm font-medium">{texto("ui.historial.examen.fecha")}</label>
                <input id={`fecha-examen-${item.id}`} type="date" required max={hoyBuenosAires()} value={fecha} onChange={(evento) => setFecha(evento.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`nota-examen-${item.id}`} className="text-sm font-medium">{texto("ui.historial.examen.nota")}</label>
                <input id={`nota-examen-${item.id}`} type="text" inputMode="decimal" pattern="[0-9]{1,3}([,.][0-9])?" required value={nota} onChange={(evento) => setNota(evento.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </>}
            <div className="space-y-1.5">
              <label htmlFor={`motivo-examen-${item.id}`} className="text-sm font-medium">{texto("ui.historial.examen.motivo")}</label>
              <textarea id={`motivo-examen-${item.id}`} required maxLength={300} rows={3} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <p className="text-right text-xs text-muted-foreground">{motivo.length}/300</p>
            </div>
            {errorLocal && <p role="alert" className="text-sm text-destructive">{errorLocal}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>{texto("ui.historial.examen.cancelar")}</Button>
              <Button type="submit">{texto("ui.historial.examen.continuar")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmarAccionDialog
        abierto={confirmacion !== null}
        titulo={texto(confirmacion === "anular" ? "confirmaciones.examen.anular" : "confirmaciones.examen.corregir", { materia: item.materia.nombre, fecha: fechaCorta(item.fecha) })}
        detalle={detalleConfirmacion}
        textoConfirmar={texto(confirmacion === "anular" ? "ui.historial.examen.confirmarAnular" : "ui.historial.examen.confirmarCorregir")}
        irreversible={confirmacion === "anular"}
        onConfirmar={confirmar}
        onCerrar={confirmarVolver}
        onExito={confirmarExito}
      />
    </div>
  );
}
