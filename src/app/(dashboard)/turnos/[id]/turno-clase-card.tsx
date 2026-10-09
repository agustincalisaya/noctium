"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { fechaCorta, fechaDeInstante, fechaHoraDeInstante } from "@/lib/turno-detalle";
import { texto } from "@/lib/textos";
import type { EstadoAsistencia, RegistroClaseDictada } from "@/types/historial.types";
import type { TurnoDetalle } from "@/types/turno.types";
import { RegistrarObservacionesDialog } from "./registrar-observaciones-dialog";

export function TurnoClaseCard({ turno, puedeRegistrarClase, onRegistrada, asistencias, registro, onObservacionRegistrada, onProcesandoChange }: {
  turno: TurnoDetalle;
  puedeRegistrarClase: boolean;
  onRegistrada: () => Promise<void>;
  asistencias: { alumno_id: string; estado: EstadoAsistencia }[];
  registro: RegistroClaseDictada | null;
  onObservacionRegistrada: () => void;
  onProcesandoChange?: (procesando: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const elegible = turno.acciones_habilitadas.includes("registrar_clase");
  const presentes = asistencias.filter(({ estado }) => estado === "PRESENTE").length;
  const ausentes = asistencias.length - presentes;
  const estadoConfirmado = turno.estado === "DISPONIBLE" || turno.estado === "COMPLETO";
  const confirmar = async () => {
    setProcesando(true);
    onProcesandoChange?.(true);
    try {
      await fetchOLanzar(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asistencias }), cache: "no-store",
      });
    } catch (fallo) {
      throw fallo instanceof Error && fallo.message !== "Failed to fetch" ? fallo : new Error(texto("ui.historial.asistencia.errorRegistro"));
    } finally {
      setProcesando(false);
      onProcesandoChange?.(false);
    }
  };
  return <div className="space-y-3 border-t border-border pt-3">
    {turno.clase_dictada ? <>
      <p role="status" className="text-sm text-muted-foreground">{texto("ui.historial.asistencia.fechaRegistro", { fecha: fechaDeInstante(turno.clase_dictada.registrada_en) })}</p>
      {registro?.observacion ? <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <h3 className="text-sm font-semibold">{texto("ui.historial.observaciones.temasEnClase")}</h3>
        <p className="whitespace-pre-wrap text-sm">{registro.observacion.temas_vistos}</p>
        {registro.observacion.observaciones_internas && <div className="space-y-1 border-t border-border pt-2">
          <h4 className="text-xs font-semibold">{texto("ui.historial.observaciones.internasEnClase")}</h4>
          <p className="whitespace-pre-wrap text-sm">{registro.observacion.observaciones_internas}</p>
        </div>}
        <p className="text-xs text-muted-foreground">{texto("ui.historial.observaciones.registradaPor", {
          fechaHora: fechaHoraDeInstante(registro.observacion.registrada_en),
          usuario: registro.observacion.registrada_por ?? texto("ui.historial.observaciones.sinRegistrar"),
        })}</p>
      </div> : registro?.acciones?.registrar_observaciones && <RegistrarObservacionesDialog
        turnoId={turno.id}
        contexto={`${turno.materia} · ${fechaCorta(turno.fecha)}, ${turno.hora_inicio}–${turno.hora_fin}`}
        onRegistrada={onObservacionRegistrada}
      />}
    </>
      : !estadoConfirmado ? <p className="text-sm text-muted-foreground">{texto("ui.historial.asistencia.estadoNoElegible")}</p>
      : <>
        <p className="text-sm text-muted-foreground">{texto(elegible ? "ui.historial.asistencia.pendienteRegistro" : "ui.historial.asistencia.esperarFin")}</p>
        {puedeRegistrarClase && <>
          <Button type="button" variant="outline" disabled={!elegible || procesando} onClick={() => setAbierto(true)}>{texto(procesando ? "ui.historial.asistencia.registrando" : "ui.historial.asistencia.registrar")}</Button>
          <ConfirmarAccionDialog abierto={abierto} onCerrar={() => setAbierto(false)}
            titulo={texto("ui.historial.asistencia.confirmar", { materia: turno.materia, fecha: fechaCorta(turno.fecha) })}
            detalle={texto("ui.historial.asistencia.confirmacion", { horaInicio: turno.hora_inicio, horaFin: turno.hora_fin, presentes, ausentes })}
            textoConfirmar={texto("ui.historial.asistencia.registrar")} irreversible onConfirmar={confirmar}
            onExito={() => { toast.success(texto("ui.historial.asistencia.guardada")); void onRegistrada(); }} />
        </>}
      </>}
  </div>;
}
