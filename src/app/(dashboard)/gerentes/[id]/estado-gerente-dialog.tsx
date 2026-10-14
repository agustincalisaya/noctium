"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Power } from "lucide-react";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { texto } from "@/lib/textos";
import { desactivarGerente, reactivarGerente } from "@/server/gerentes/actions";
import type { EstadoGerenteCambiado, ResultadoAccionGerente } from "@/types/gerente.types";

export type GerenteParaEstado = {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  version: number;
  tieneCuenta: boolean;
  /** Indicadores de solo lectura del detalle (spec_modulo_G.md §2.4); el servidor repite la validación. */
  esUltimoGerenteActivo: boolean;
  motivoObligatorio: boolean;
};

const MAXIMO_MOTIVO = 300;

/**
 * «Desactivar» o «Reactivar» de la ficha del gerente (HU-G-05, figuras 97 y
 * 98; DESIGN.md §6.4), con el patrón de la baja del personal de mesa de
 * entrada (HU-F-05), sin el aviso de caja abierta:
 * - Baja: `ConfirmarAccionDialog` reversible (`destructiva`, sin
 *   `irreversible`) con el motivo en `contenido`, obligatorio si el gerente
 *   registró operaciones. La ficha no lo ofrece en la propia (`esVos`).
 * - Si la ficha indica que es el último gerente activo, «Desactivar» abre un
 *   `Dialog` informativo (6.3) en lugar de la confirmación. Si eso cambió
 *   después de cargar la ficha, el rechazo ULTIMO_GERENTE_ACTIVO aparece
 *   dentro de la confirmación: el servidor decide siempre.
 * - Reactivación: `ConfirmarAccionDialog` sin motivo.
 * Los rechazos del servidor se muestran dentro del modal; al cerrarlo después
 * de un rechazo (por ejemplo, un conflicto de versión) se refresca la ficha
 * para tomar el estado y la versión actuales. El éxito, con toast y
 * `router.refresh()`.
 */
export function EstadoGerenteDialog({ gerente }: { gerente: GerenteParaEstado }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [avisoUltimo, setAvisoUltimo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const rechazado = useRef(false);
  const { activo } = gerente;
  const datos = { nombre: gerente.nombre, apellido: gerente.apellido };

  const iniciar = () => {
    if (activo && gerente.esUltimoGerenteActivo) {
      setAvisoUltimo(true);
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
    let resultado: ResultadoAccionGerente<EstadoGerenteCambiado>;
    try {
      resultado = activo
        ? await desactivarGerente(gerente.id, { motivo, version: gerente.version })
        : await reactivarGerente(gerente.id, { version: gerente.version });
    } catch {
      throw new Error(texto("errores.gerente.comunicacion"));
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
        {texto(activo ? "ui.gerentes.ficha.desactivar" : "ui.gerentes.ficha.reactivar")}
      </Button>

      <ConfirmarAccionDialog
        abierto={confirmar}
        titulo={texto(activo ? "ui.gerentes.baja.titulo" : "ui.gerentes.reactivacion.titulo", datos)}
        detalle={texto(
          activo
            ? gerente.tieneCuenta ? "ui.gerentes.baja.detalle" : "ui.gerentes.baja.detalleSinCuenta"
            : gerente.tieneCuenta ? "ui.gerentes.reactivacion.detalle" : "ui.gerentes.reactivacion.detalleSinCuenta",
        )}
        textoConfirmar={texto(activo ? "ui.gerentes.baja.confirmar" : "ui.gerentes.reactivacion.confirmar")}
        destructiva={activo}
        confirmarDeshabilitado={activo && gerente.motivoObligatorio && !motivo.trim()}
        contenido={
          activo ? (
            <div className="mt-4 space-y-2">
              <label htmlFor="motivo-baja-gerente" className="text-sm font-medium">
                {texto("ui.gerentes.baja.motivo")}
              </label>
              <textarea
                id="motivo-baja-gerente"
                autoFocus
                maxLength={MAXIMO_MOTIVO}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required={gerente.motivoObligatorio}
                aria-describedby="ayuda-motivo-gerente"
                className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div id="ayuda-motivo-gerente" className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{texto(gerente.motivoObligatorio ? "ui.gerentes.baja.motivoObligatorio" : "ui.gerentes.baja.motivoOpcional")}</span>
                <span>{texto("ui.gerentes.baja.contador", { cantidad: motivo.length })}</span>
              </div>
            </div>
          ) : undefined
        }
        onCerrar={cerrar}
        onConfirmar={enviar}
        onExito={() => {
          toast.success(texto(activo ? "ui.gerentes.baja.exito" : "ui.gerentes.reactivacion.exito"));
          router.refresh();
        }}
      />

      <Dialog open={avisoUltimo} onOpenChange={setAvisoUltimo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{texto("ui.gerentes.baja.ultimoActivoTitulo")}</DialogTitle>
            <DialogDescription>{texto("errores.gerente.ultimoGerenteActivo")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoUltimo(false)}>
              {texto("ui.gerentes.baja.cerrar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
