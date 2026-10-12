"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fetchOLanzar } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";

export function CancelarInscripcion({ turnoId, materia, fecha, hora, conPagos }: {
  turnoId: string;
  materia: string;
  fecha: string;
  hora: string;
  conPagos: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const envio = useRef<Promise<void> | null>(null);
  const conPagosConfirmado = useRef(false);
  const cancelar = () => {
    if (envio.current) return envio.current;
    envio.current = fetchOLanzar(`/api/turnos/${encodeURIComponent(turnoId)}/inscripcion/cancelacion`, { method: "POST", cache: "no-store" })
      .then((data) => { conPagosConfirmado.current = Boolean((data as { con_pagos?: boolean } | null)?.con_pagos); })
      .finally(() => { envio.current = null; });
    return envio.current;
  };
  const informarExito = () => {
    if (conPagosConfirmado.current) toast.success(texto("ui.turnos.cancelacion.exito"), { description: texto("ui.turnos.cancelacion.reintegro") });
    else toast.success(texto("ui.turnos.cancelacion.exito"));
  };
  const cerrar = () => { setAbierto(false); router.refresh(); };
  return <>
    <Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive-soft" onClick={() => setAbierto(true)}>
      {texto("ui.turnos.cancelacion.accion")}
    </Button>
    <ConfirmarAccionDialog
      abierto={abierto}
      titulo={texto("ui.turnos.cancelacion.confirmacion", { materia, fecha, hora })}
      detalle={conPagos ? texto("ui.turnos.cancelacion.reintegro") : undefined}
      textoConfirmar={texto("ui.turnos.cancelacion.confirmar")}
      irreversible
      onCerrar={cerrar}
      onConfirmar={cancelar}
      onExito={informarExito}
    />
  </>;
}
