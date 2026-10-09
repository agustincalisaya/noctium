"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { fechaCorta, fechaDeInstante } from "@/lib/turno-detalle";
import { texto } from "@/lib/textos";
import type { EstadoAsistencia } from "@/types/historial.types";
import type { TurnoDetalle } from "@/types/turno.types";

export function TurnoClaseCard({
  turno,
  puedeRegistrarClase,
  onRegistrada,
  asistencias,
  onProcesandoChange,
}: {
  turno: TurnoDetalle;
  puedeRegistrarClase: boolean;
  onRegistrada: () => Promise<void>;
  asistencias: { alumno_id: string; estado: EstadoAsistencia }[];
  onProcesandoChange?: (procesando: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const yaRegistrada = Boolean(turno.clase_dictada);
  const elegible = turno.acciones_habilitadas.includes("registrar_clase");
  const presentes = asistencias.filter(({ estado }) => estado === "PRESENTE").length;
  const ausentes = asistencias.length - presentes;
  const estadoConfirmado = turno.estado === "DISPONIBLE" || turno.estado === "COMPLETO";

  const confirmar = async () => {
    setProcesando(true);
    onProcesandoChange?.(true);
    setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asistencias }),
        cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(valor?.error?.message ?? "No se pudo registrar la clase dictada");
      setAbierto(false);
      toast.success(texto("ui.historial.asistencia.guardada"));
      await onRegistrada();
    } catch (fallo) {
      setError(fallo instanceof Error && fallo.message !== "Failed to fetch"
        ? fallo.message
        : texto("ui.historial.asistencia.errorRegistro"));
    } finally {
      setProcesando(false);
      onProcesandoChange?.(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {yaRegistrada ? (
        <p role="status" className="text-sm text-muted-foreground">
          Clase dictada registrada el {fechaDeInstante(turno.clase_dictada!.registrada_en)}.
        </p>
      ) : !estadoConfirmado ? (
        <p className="text-sm text-muted-foreground">Solo se puede registrar una clase de un turno disponible o completo.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {elegible
              ? "La clase ya pasó y todavía no se registró."
              : texto("ui.historial.asistencia.esperarFin")}
          </p>
          {puedeRegistrarClase && (
            <AlertDialog.Root open={abierto} onOpenChange={(siguiente) => { setAbierto(siguiente); if (siguiente) setError(""); }}>
              <AlertDialog.Trigger
                render={<Button type="button" variant="outline" disabled={!elegible || procesando} />}
              >
                {procesando ? texto("ui.historial.asistencia.registrando") : texto("ui.historial.asistencia.registrar")}
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
                <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg outline-none">
                  <AlertDialog.Title className="text-lg font-semibold">{texto("ui.historial.asistencia.confirmar")}</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                    {turno.materia} del {fechaCorta(turno.fecha)}, {turno.hora_inicio}–{turno.hora_fin}. {texto("ui.historial.asistencia.confirmacion", { presentes, ausentes })}
                  </AlertDialog.Description>
                  {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
                  <div className="mt-5 flex justify-end gap-2">
                    <Button type="button" variant="outline" disabled={procesando} onClick={() => setAbierto(false)}>Volver</Button>
                    <Button type="button" disabled={procesando} onClick={() => void confirmar()}>
                      {procesando ? texto("ui.historial.asistencia.registrando") : texto("ui.historial.asistencia.registrar")}
                    </Button>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          )}
        </>
      )}
    </div>
  );
}
