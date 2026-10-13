"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { nombreNatural } from "@/lib/reservas-formato";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";
import type { ReservaPendienteVista } from "@/types/reserva.types";

/**
 * «Quitar» una reserva pendiente (HU-C-26 criterio 6; foto «Quitar una reserva
 * pendiente»): confirmación irreversible de HU-C-25 con la clave de HU-C-04
 * (`confirmaciones.inscripcion.quitar`) y el párrafo propio de esta pantalla.
 * El rechazo `RESERVA_NO_PENDIENTE` («…se pagó o venció.») queda dentro del
 * diálogo, sin quitar nada; al cerrarlo después de un rechazo, la pantalla se
 * refresca. El éxito: toast y `router.refresh()` (DESIGN.md §6.1).
 */
export function QuitarReservaDialog({ reserva, onCerrar }: { reserva: ReservaPendienteVista | null; onCerrar: () => void }) {
  const router = useRouter();
  const [rechazada, setRechazada] = useState(false);

  const cerrar = () => {
    onCerrar();
    if (rechazada) {
      setRechazada(false);
      router.refresh();
    }
  };

  return (
    <ConfirmarAccionDialog
      abierto={reserva !== null}
      irreversible
      titulo={reserva ? texto("confirmaciones.inscripcion.quitar", {
        alumno: nombreNatural(reserva.alumno.nombre_para_mostrar),
        materia: reserva.clase.materia.nombre,
        fecha: diaAbreviadoYFecha(reserva.clase.fecha),
        hora: reserva.clase.hora_inicio,
      }) : ""}
      detalle={<p>{texto("ui.reservas.quitar.detalle")}</p>}
      textoConfirmar={texto("ui.reservas.quitar.confirmar")}
      onConfirmar={async () => {
        if (!reserva) return;
        try {
          await fetchOLanzar(`/api/reservas/${encodeURIComponent(reserva.inscripcion_id)}/quitar`, { method: "POST", cache: "no-store" });
        } catch (error) {
          setRechazada(true);
          throw error;
        }
      }}
      onExito={() => {
        setRechazada(false);
        toast.success(texto("ui.reservas.toastQuitada"));
        router.refresh();
      }}
      onCerrar={cerrar}
    />
  );
}
