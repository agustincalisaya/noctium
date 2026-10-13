"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { ResumenCierreCaja } from "@/components/pagos/resumen-cierre-caja";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { confirmacionCierre, montoNoNegativoValido, normalizarMonto } from "@/lib/caja";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import type { CajaCerradaDto, ResumenCajaDto, ResumenCierreDto } from "@/types/caja.types";

const MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente.";
const MAXIMO_MOTIVO = 300;

export type ModoCierreCaja = { tipo: "propia" } | { tipo: "ausencia"; cajaId: string; integrante: string };

type Props = {
  abierto: boolean;
  modo: ModoCierreCaja;
  /** Efectivo ya declarado (de `GET /api/cajas/mia`): si no es `null`, entra directo al paso 2. */
  efectivoDeclarado: string | null;
  onCerrar: () => void;
  /** Cierre confirmado: el llamador informa con toast (DESIGN.md §6.1) y refresca. */
  onCerrada: (resultado: CajaCerradaDto) => void;
};

type RespuestaApi<T> = { ok: boolean; data: T | null; error: { code?: string; message?: string; detalles?: unknown } | null };

async function llamar<T>(url: string, init?: RequestInit): Promise<RespuestaApi<T>> {
  const respuesta = await fetchAutenticado(url, { cache: "no-store", ...init });
  const cuerpo = await respuesta.json().catch(() => null);
  return { ok: respuesta.ok, data: cuerpo?.data ?? null, error: cuerpo?.error ?? null };
}

/** GET del resumen del paso 2 (409 EFECTIVO_NO_DECLARADO si todavía no se declaró). */
async function pedirResumen(base: string): Promise<{ resumen: ResumenCierreDto } | { error: string }> {
  try {
    const r = await llamar<ResumenCierreDto>(`${base}/resumen`);
    if (r.ok && r.data) return { resumen: r.data };
    return { error: r.error?.message ?? texto("ui.caja.cerrar.errorCarga") };
  } catch {
    return { error: texto("ui.caja.cerrar.errorCarga") };
  }
}

/**
 * «Cerrar caja» con arqueo ciego (HU-I-12 criterios 5 a 8; spec_modulo_I.md
 * §2.11), y el cierre por ausencia del gerente (§2.12) con el mismo flujo: un
 * solo `Dialog` con dos pantallas.
 * - Paso 1: el efectivo contado, sin ningún total. Al confirmarlo queda fijo.
 * - Paso 2: el resumen del criterio 6 con la diferencia y el motivo
 *   (obligatorio si no cuadra; «Observación» opcional si cuadra) y la
 *   confirmación irreversible de HU-C-25.
 * Si el servidor responde CAJA_CAMBIO, se reemplazan el resumen y la huella
 * por los de `detalles`, se avisa dentro del paso 2 y el diálogo sigue abierto
 * con el mismo monto declarado (criterio 5).
 */
export function CerrarCajaDialog({ abierto, modo, efectivoDeclarado, onCerrar, onCerrada }: Props) {
  const base = modo.tipo === "propia" ? "/api/cajas/mia" : `/api/cajas/${encodeURIComponent(modo.cajaId)}/ausencia`;
  const integrante = modo.tipo === "ausencia" ? modo.integrante : undefined;

  const [paso, setPaso] = useState<1 | 2>(1);
  const [efectivo, setEfectivo] = useState("");
  const [errorPaso1, setErrorPaso1] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resumen, setResumen] = useState<ResumenCierreDto | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(false);
  const [avisoCambio, setAvisoCambio] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const cambio = useRef(false);
  const resultado = useRef<CajaCerradaDto | null>(null);

  const cargarResumen = async () => {
    setErrorCarga(null);
    setResumen(null);
    const resultado = await pedirResumen(base);
    if ("resumen" in resultado) setResumen(resultado.resumen);
    else setErrorCarga(resultado.error);
  };

  // Cada apertura arranca de cero: paso 1, o paso 2 si el efectivo ya estaba declarado.
  const [abiertoPrevio, setAbiertoPrevio] = useState(false);
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (abierto) {
      setPaso(efectivoDeclarado === null ? 1 : 2);
      setEfectivo(""); setErrorPaso1(null); setEnviando(false); setResumen(null); setErrorCarga(null);
      setMotivo(""); setErrorMotivo(false); setAvisoCambio(false); setConfirmando(false);
    }
  }
  const entraAlPaso2 = abierto && efectivoDeclarado !== null;
  useEffect(() => {
    if (!entraAlPaso2) return;
    let vigente = true;
    void pedirResumen(base).then((resultado) => {
      if (!vigente) return;
      if ("resumen" in resultado) setResumen(resultado.resumen);
      else setErrorCarga(resultado.error);
    });
    return () => { vigente = false; };
  }, [entraAlPaso2, base]);

  const declarar = async () => {
    if (!montoNoNegativoValido(efectivo)) {
      setErrorPaso1(texto("ui.caja.cerrar.pasoUno.invalido"));
      return;
    }
    setEnviando(true);
    setErrorPaso1(null);
    try {
      const r = await llamar<ResumenCierreDto>(`${base}/declaracion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ efectivo_declarado: normalizarMonto(efectivo) }),
      });
      if (r.ok && r.data) {
        setResumen(r.data);
        setPaso(2);
      } else if (r.error?.code === "EFECTIVO_YA_DECLARADO") {
        // Ya estaba declarado (por ejemplo, desde otra pestaña): el monto guardado es el que vale.
        setPaso(2);
        await cargarResumen();
      } else {
        setErrorPaso1(r.error?.message ?? MENSAJE_ERROR_GENERICO);
      }
    } catch {
      setErrorPaso1(MENSAJE_ERROR_GENERICO);
    } finally {
      setEnviando(false);
    }
  };

  const tipo = resumen?.resumen.tipo_diferencia ?? null;
  const conDiferencia = tipo !== null && tipo !== "CUADRA";

  const pedirConfirmacion = () => {
    if (conDiferencia && !motivo.trim()) {
      setErrorMotivo(true);
      return;
    }
    cambio.current = false;
    setConfirmando(true);
  };

  const cerrarCaja = async () => {
    if (!resumen) return;
    setAvisoCambio(false);
    const r = await llamar<CajaCerradaDto>(`${base}/cierre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ huella: resumen.huella, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) }),
    });
    if (r.ok && r.data) {
      resultado.current = r.data;
      return;
    }
    const detalles = r.error?.detalles as { resumen?: ResumenCajaDto; huella?: string } | undefined;
    if (r.error?.code === "CAJA_CAMBIO" && detalles?.resumen && detalles.huella) {
      // La caja cambió: resumen y huella nuevos, mismo declarado; el motivo se vuelve a pedir si hace falta.
      setResumen({ ...resumen, resumen: detalles.resumen, huella: detalles.huella });
      setAvisoCambio(true);
      setErrorMotivo(false);
      cambio.current = true;
      return;
    }
    throw new Error(r.error?.message ?? MENSAJE_ERROR_GENERICO);
  };

  const titulo = paso === 1
    ? (integrante ? texto("ui.caja.cerrar.ausencia.pasoUno.titulo", { integrante }) : texto("ui.caja.cerrar.pasoUno.titulo"))
    : (integrante ? texto("ui.caja.cerrar.ausencia.pasoDos.titulo", { integrante }) : texto("ui.caja.cerrar.pasoDos.titulo"));

  return <>
    <Dialog open={abierto} onOpenChange={(open) => { if (!open && !enviando && !confirmando) onCerrar(); }}>
      <DialogContent className={paso === 2 ? "max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto" : undefined}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {paso === 1 ? texto("ui.caja.cerrar.pasoUno.descripcion") : texto("ui.caja.cerrar.pasoDos.descripcion")}
          </DialogDescription>
          {integrante && paso === 1 && <p className="text-sm text-muted-foreground">{texto("ui.caja.cerrar.ausencia.aviso")}</p>}
        </DialogHeader>

        {paso === 1 ? (
          <form className="mt-4 space-y-2" noValidate onSubmit={(evento) => { evento.preventDefault(); void declarar(); }}>
            <label htmlFor="cerrar-caja-efectivo" className="text-sm font-medium">{texto("ui.caja.cerrar.pasoUno.efectivo")}</label>
            <Input id="cerrar-caja-efectivo" inputMode="decimal" autoFocus value={efectivo} className="font-mono"
              onChange={(evento) => { setEfectivo(evento.target.value); setErrorPaso1(null); }}
              aria-invalid={errorPaso1 !== null} aria-describedby={errorPaso1 ? "cerrar-caja-efectivo-error" : undefined} />
            {errorPaso1 && <p id="cerrar-caja-efectivo-error" role="alert" className="text-xs text-destructive">{errorPaso1}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>{texto("ui.caja.cancelar")}</Button>
              <Button type="submit" disabled={enviando}>{texto("ui.caja.cerrar.pasoUno.confirmar")}</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            {errorCarga ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-destructive">{errorCarga}</p>
                <Button type="button" variant="outline" onClick={() => void cargarResumen()}>{texto("ui.caja.cerrar.reintentar")}</Button>
              </div>
            ) : !resumen ? (
              <p role="status" className="text-sm text-muted-foreground">{texto("ui.caja.cerrar.cargando")}</p>
            ) : (
              <>
                <ResumenCierreCaja resumen={resumen.resumen} />
                <div className="space-y-1.5">
                  <label htmlFor="cerrar-caja-motivo" className="text-sm font-medium">
                    {conDiferencia ? texto("ui.caja.cerrar.motivo") : texto("ui.caja.cerrar.observacion")}
                  </label>
                  {!conDiferencia && <p className="text-xs text-muted-foreground">{texto("ui.caja.cerrar.opcional")}</p>}
                  <textarea id="cerrar-caja-motivo" maxLength={MAXIMO_MOTIVO} value={motivo}
                    placeholder={conDiferencia ? texto("ui.caja.cerrar.motivoPlaceholder") : undefined}
                    onChange={(evento) => { setMotivo(evento.target.value); setErrorMotivo(false); }}
                    required={conDiferencia} aria-invalid={errorMotivo}
                    aria-describedby={errorMotivo ? "cerrar-caja-motivo-error" : undefined}
                    className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive" />
                  <div className="flex justify-between gap-3 text-xs">
                    <span id="cerrar-caja-motivo-error" className="text-destructive">{errorMotivo ? texto("ui.caja.cerrar.motivoRequerido") : ""}</span>
                    <span className="text-muted-foreground">{texto("ui.caja.cerrar.contador", { n: motivo.length })}</span>
                  </div>
                </div>
                {avisoCambio && (
                  <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {texto("errores.caja.cambio")}
                  </p>
                )}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>{texto("ui.caja.cerrar.volver")}</Button>
              <Button type="button" disabled={!resumen} onClick={pedirConfirmacion}
                className="bg-destructive text-card hover:bg-destructive/90">
                {texto("ui.caja.cerrar")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {resumen && tipo && (
      <ConfirmarAccionDialog
        abierto={confirmando}
        titulo={confirmacionCierre(tipo, resumen.resumen.diferencia ?? "0", integrante)}
        textoConfirmar={texto("ui.caja.cerrar")}
        irreversible
        onConfirmar={cerrarCaja}
        onCerrar={() => setConfirmando(false)}
        onExito={() => {
          if (cambio.current || !resultado.current) return;
          onCerrada(resultado.current);
        }}
      />
    )}
  </>;
}
