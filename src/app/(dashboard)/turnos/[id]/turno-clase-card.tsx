"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { fechaCorta, fechaDeInstante } from "@/lib/turno-detalle";
import { texto } from "@/lib/textos";
import type { EstadoAsistencia } from "@/types/historial.types";
import type { TurnoDetalle } from "@/types/turno.types";

export function TurnoClaseCard({ turno, puedeRegistrarClase, onRegistrada, asistencias, onProcesandoChange }: {
  turno: TurnoDetalle;
  puedeRegistrarClase: boolean;
  onRegistrada: () => Promise<void>;
  asistencias: { alumno_id: string; estado: EstadoAsistencia }[];
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
    {turno.clase_dictada ? <p role="status" className="text-sm text-muted-foreground">{texto("ui.historial.asistencia.fechaRegistro", { fecha: fechaDeInstante(turno.clase_dictada.registrada_en) })}</p>
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
