"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Power } from "lucide-react";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { texto } from "@/lib/textos";
import { desactivarIntegrante, reactivarIntegrante } from "@/server/personal/actions";
import type { EstadoIntegranteCambiado, ResultadoAccionPersonal } from "@/types/personal.types";

export type IntegranteParaEstado = {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  version: number;
  tieneCuenta: boolean;
  /** Indicadores de solo lectura del detalle (spec_modulo_F.md §2.4); el servidor repite la validación. */
  cajaAbierta: boolean;
  motivoObligatorio: boolean;
};

const MAXIMO_MOTIVO = 300;

/**
 * «Desactivar» o «Reactivar» de la ficha del integrante (HU-F-05, figuras 93
 * y 94; DESIGN.md §6.4), con el patrón de la baja de profesor (HU-D-08):
 * - Baja: `ConfirmarAccionDialog` reversible (`destructiva`, sin
 *   `irreversible`) con el motivo en `contenido`, obligatorio si el
 *   integrante registró operaciones.
 * - Con la caja abierta, «Desactivar» abre un `Dialog` informativo (6.3) en
 *   lugar de la confirmación. Si la caja se abrió después de cargar la ficha,
 *   el rechazo CAJA_ABIERTA aparece dentro de la confirmación.
 * - Reactivación: `ConfirmarAccionDialog` sin motivo.
 * Los rechazos del servidor se muestran dentro del modal; al cerrarlo después
 * de un rechazo (por ejemplo, un conflicto de versión) se refresca la ficha
 * para tomar el estado y la versión actuales. El éxito, con toast y
 * `router.refresh()`.
 */
export function EstadoIntegranteDialog({ integrante }: { integrante: IntegranteParaEstado }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [avisoCaja, setAvisoCaja] = useState(false);
  const [motivo, setMotivo] = useState("");
  const rechazado = useRef(false);
  const { activo } = integrante;
  const datos = { nombre: integrante.nombre, apellido: integrante.apellido };

  const iniciar = () => {
    if (activo && integrante.cajaAbierta) {
      setAvisoCaja(true);
      return;
    }
    setMotivo("");
    rechazado.current = false;
    setConfirmar(true);
  };

  const cerrar = () => {
    setConfirmar(false);
    if (rechazado.current) {
      rechazado.current = false;
      router.refresh();
    }
  };

  const enviar = async () => {
    let resultado: ResultadoAccionPersonal<EstadoIntegranteCambiado>;
    try {
      resultado = activo
        ? await desactivarIntegrante(integrante.id, { motivo, version: integrante.version })
        : await reactivarIntegrante(integrante.id, { version: integrante.version });
    } catch {
      throw new Error(texto("errores.personal.comunicacion"));
    }
    if (resultado.error) {
      rechazado.current = resultado.error.code !== "VALIDATION_ERROR";
      throw new Error(resultado.error.detalles?.motivo?.[0] ?? resultado.error.message);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className={activo ? "border-destructive text-destructive hover:bg-destructive-soft hover:text-destructive" : undefined}
        onClick={iniciar}
      >
        <Power className="size-4" aria-hidden />
        {texto(activo ? "ui.personal.ficha.desactivar" : "ui.personal.ficha.reactivar")}
      </Button>

      <ConfirmarAccionDialog
        abierto={confirmar}
        titulo={texto(activo ? "ui.personal.baja.titulo" : "ui.personal.reactivacion.titulo", datos)}
        detalle={texto(
          activo
            ? integrante.tieneCuenta ? "ui.personal.baja.detalle" : "ui.personal.baja.detalleSinCuenta"
            : integrante.tieneCuenta ? "ui.personal.reactivacion.detalle" : "ui.personal.reactivacion.detalleSinCuenta",
        )}
        textoConfirmar={texto(activo ? "ui.personal.baja.confirmar" : "ui.personal.reactivacion.confirmar")}
        destructiva={activo}
        confirmarDeshabilitado={activo && integrante.motivoObligatorio && !motivo.trim()}
        contenido={
          activo ? (
            <div className="mt-4 space-y-2">
              <label htmlFor="motivo-baja-integrante" className="text-sm font-medium">
                {texto("ui.personal.baja.motivo")}
              </label>
              <textarea
                id="motivo-baja-integrante"
                autoFocus
                maxLength={MAXIMO_MOTIVO}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required={integrante.motivoObligatorio}
                aria-describedby="ayuda-motivo-integrante"
                className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div id="ayuda-motivo-integrante" className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{texto(integrante.motivoObligatorio ? "ui.personal.baja.motivoObligatorio" : "ui.personal.baja.motivoOpcional")}</span>
                <span>{texto("ui.personal.baja.contador", { cantidad: motivo.length })}</span>
              </div>
            </div>
          ) : undefined
        }
        onCerrar={cerrar}
        onConfirmar={enviar}
        onExito={() => {
          toast.success(texto(activo ? "ui.personal.baja.exito" : "ui.personal.reactivacion.exito"));
          router.refresh();
        }}
      />

      <Dialog open={avisoCaja} onOpenChange={setAvisoCaja}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{texto("ui.personal.baja.cajaAbiertaTitulo")}</DialogTitle>
            <DialogDescription>{texto("errores.personal.cajaAbierta")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoCaja(false)}>
              {texto("ui.personal.baja.cerrar")}
            </Button>
            {/* HU-I-12: la pantalla donde se hace el cierre por ausencia. */}
            <Link href="/cajas" className={buttonVariants()}>{texto("ui.personal.baja.irACierresDeCaja")}</Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
