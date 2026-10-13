"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HistorialCambiosDialog } from "@/components/pagos/historial-cambios-dialog";
import { SelectorCajaAjuste } from "@/components/pagos/selector-caja-ajuste";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";
import { fechaCorta, monto as formatoMonto } from "@/lib/turno-detalle";

/**
 * Lo que `PagoAcciones` necesita de un pago: el subconjunto común de
 * `PagoRegistradoTurno` (detalle de la clase) y `PagoHistorialItem` (pestaña
 * Pagos del alumno). Monto, forma y fecha son los vigentes.
 */
export type PagoAccionable = {
  id: string;
  monto: string;
  forma_pago: { id: string; nombre: string; is_active: boolean };
  /** `YYYY-MM-DD`. */
  fecha_pago: string;
  anulado: boolean;
  puede_corregir: boolean;
  /** Pagos no anulados de la operación: el aviso «alcanza a N clases». */
  clases_de_la_operacion: number;
};

type Cambios = { monto?: string; forma_pago_id?: string; fecha_pago?: string; motivo: string };
type Envio = { ruta: "correccion" | "anulacion"; cuerpo: Record<string, string | undefined> };

const MOTIVO_MAX = 300;
const CAJA_DE_AJUSTE_NO_ABIERTA = "CAJA_DE_AJUSTE_NO_ABIERTA";
const MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente.";

/** Error del servidor con su `code`, para decidir la acción que acompaña al rechazo. */
class RechazoServidor extends Error {
  constructor(message: string, readonly code: string | null) {
    super(message);
  }
}

function hoyBuenosAires() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** "12000.00" → "12000"; "15000.50" → "15000.50" (el valor inicial del campo Monto). */
const montoEditable = (valor: string) => valor.replace(/\.00$/, "");

/** Monto escrito por el usuario como decimal con punto, o `null` si no es válido (mismas reglas que `montoSchema`). */
function montoNormalizado(valor: string): string | null {
  const limpio = valor.trim().replace(",", ".");
  return /^\d{1,9}(\.\d{1,2})?$/.test(limpio) && Number(limpio) > 0 ? limpio : null;
}

const centavos = (valor: string) => Math.round(Number(valor) * 100);

async function enviar({ ruta, cuerpo }: Envio, pagoId: string): Promise<void> {
  const respuesta = await fetchAutenticado(`/api/pagos/${encodeURIComponent(pagoId)}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  const resultado = await respuesta.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!respuesta.ok) throw new RechazoServidor(resultado?.error?.message ?? MENSAJE_ERROR_GENERICO, resultado?.error?.code ?? null);
}

/**
 * Acciones de un pago (HU-I-06, spec_modulo_I.md §2.14): «Corregir» y
 * «Anular» solo si el servidor lo autoriza (`puede_corregir`, que ya es
 * `false` para un anulado) y «Ver detalle» siempre (DEC-27). Lo comparten
 * «Pagos registrados» del detalle de la clase y la pestaña Pagos del alumno.
 *
 * - Corregir: `Dialog` con Monto, Fecha y Forma de pago precargados con los
 *   vigentes y el Motivo; envía solo lo que cambió, después de la
 *   confirmación reversible de HU-C-25 con el anterior → nuevo.
 * - Anular: una sola confirmación irreversible con el Motivo adentro y el
 *   atajo «Usar el motivo "Reintegro"» (foto «Anular pago», patrón de HU-F-05).
 * - `CAJA_DE_AJUSTE_NO_ABIERTA` (solo el Gerente, caja del pago cerrada):
 *   la confirmación ofrece elegir una caja abierta y reintentar con ella.
 *
 * Al terminar bien: toast literal del criterio 7 y `onActualizado()` (el
 * padre recarga su propia lista; ninguna de las dos pantallas usa `router.refresh()`).
 */
export function PagoAcciones({ pago, alumnoNombre, claseEtiqueta, onActualizado }: {
  pago: PagoAccionable;
  alumnoNombre: string;
  claseEtiqueta: string;
  onActualizado: () => void;
}) {
  const [editor, setEditor] = useState(false);
  const [confirmacion, setConfirmacion] = useState<"corregir" | "anular" | null>(null);
  const [historial, setHistorial] = useState(false);
  const [montoCampo, setMontoCampo] = useState("");
  const [fecha, setFecha] = useState("");
  const [formaId, setFormaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errorLocal, setErrorLocal] = useState("");
  const [cambios, setCambios] = useState<Cambios | null>(null);
  const [formas, setFormas] = useState<{ id: string; nombre: string }[] | null>(null);
  const [errorFormas, setErrorFormas] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);
  const [errorReintento, setErrorReintento] = useState("");

  const etiquetas = { alumno: alumnoNombre, clase: claseEtiqueta };
  const prefijo = `pago-${pago.id}`;

  const cargarFormas = () => {
    setErrorFormas(false);
    fetchAutenticado("/api/formas-pago/opciones", { cache: "no-store" })
      .then(async (respuesta) => {
        const resultado = await respuesta.json().catch(() => null) as { data?: { id: string; nombre: string }[] } | null;
        if (!respuesta.ok || !resultado?.data) throw new Error("formas");
        setFormas(resultado.data);
      })
      .catch(() => setErrorFormas(true));
  };

  const abrirCorregir = () => {
    setMontoCampo(montoEditable(pago.monto));
    setFecha(pago.fecha_pago);
    setFormaId(pago.forma_pago.id);
    setMotivo("");
    setErrorLocal("");
    setCambios(null);
    setEditor(true);
    if (formas === null) cargarFormas();
  };

  const abrirAnular = () => {
    setMotivo("");
    setRechazo(null);
    setErrorReintento("");
    setConfirmacion("anular");
  };

  const cambiaOperacion = formaId !== pago.forma_pago.id || fecha !== pago.fecha_pago;
  const avisoAlcance = pago.clases_de_la_operacion === 1
    ? texto("ui.pagos.correccion.alcanzaUnaClase")
    : texto("ui.pagos.correccion.alcanzaClases", { n: pago.clases_de_la_operacion });

  const prepararCorreccion = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const motivoLimpio = motivo.trim();
    const montoNuevo = montoNormalizado(montoCampo);
    if (montoNuevo === null) return setErrorLocal(texto("ui.pagos.correccion.montoInvalido"));
    if (fecha > hoyBuenosAires()) return setErrorLocal(texto("ui.pagos.correccion.fechaFutura"));
    const pendientes: Cambios = { motivo: motivoLimpio };
    if (centavos(montoNuevo) !== centavos(pago.monto)) pendientes.monto = montoNuevo;
    if (formaId !== pago.forma_pago.id) pendientes.forma_pago_id = formaId;
    if (fecha !== pago.fecha_pago) pendientes.fecha_pago = fecha;
    if (pendientes.monto === undefined && pendientes.forma_pago_id === undefined && pendientes.fecha_pago === undefined) {
      return setErrorLocal(texto("ui.pagos.correccion.sinCambios"));
    }
    if (!motivoLimpio) return setErrorLocal(texto("ui.pagos.correccion.motivoRequerido"));
    setErrorLocal("");
    setCambios(pendientes);
    setRechazo(null);
    setErrorReintento("");
    setEditor(false);
    setConfirmacion("corregir");
  };

  const envioActual = (cajaAjusteId?: string): Envio | null => {
    const caja: Record<string, string> = cajaAjusteId ? { caja_ajuste_id: cajaAjusteId } : {};
    if (confirmacion === "anular") return { ruta: "anulacion", cuerpo: { motivo: motivo.trim(), ...caja } };
    if (confirmacion === "corregir" && cambios) return { ruta: "correccion", cuerpo: { ...cambios, ...caja } };
    return null;
  };

  const confirmar = async () => {
    const envio = envioActual();
    if (!envio) throw new Error(MENSAJE_ERROR_GENERICO);
    try {
      await enviar(envio, pago.id);
    } catch (error) {
      setRechazo(error instanceof RechazoServidor ? error.code : null);
      throw error;
    }
  };

  const terminar = (accion: "corregir" | "anular") => {
    setConfirmacion(null);
    setEditor(false);
    toast.success(texto(accion === "anular" ? "ui.pagos.correccion.exitoAnular" : "ui.pagos.correccion.exitoCorregir"));
    onActualizado();
  };

  /** Mismo pedido, ahora con la caja abierta que eligió el Gerente (spec_modulo_I.md §2.14.4). */
  const reintentarConCaja = async (cajaId: string) => {
    const accion = confirmacion;
    const envio = envioActual(cajaId);
    if (!accion || !envio) return;
    setReintentando(true);
    setErrorReintento("");
    try {
      await enviar(envio, pago.id);
    } catch (error) {
      setErrorReintento(error instanceof Error && error.message ? error.message : MENSAJE_ERROR_GENERICO);
      return;
    } finally {
      setReintentando(false);
    }
    terminar(accion);
  };

  /** «Volver» de la corrección regresa al formulario con lo cargado; el de la anulación cierra. */
  const volverDeConfirmacion = () => {
    const accion = confirmacion;
    setConfirmacion(null);
    if (accion === "corregir") setEditor(true);
  };

  const nombreForma = (id: string) => (id === pago.forma_pago.id ? pago.forma_pago.nombre : formas?.find((f) => f.id === id)?.nombre ?? id);
  const detalleCorreccion = cambios && (
    <ul className="space-y-1">
      {cambios.monto !== undefined && <li>{texto("ui.pagos.correccion.detalleMonto", { anterior: formatoMonto(pago.monto), nuevo: formatoMonto(cambios.monto) })}</li>}
      {cambios.forma_pago_id !== undefined && <li>{texto("ui.pagos.correccion.detalleForma", { anterior: pago.forma_pago.nombre, nuevo: nombreForma(cambios.forma_pago_id) })}</li>}
      {cambios.fecha_pago !== undefined && <li>{texto("ui.pagos.correccion.detalleFecha", { anterior: fechaCorta(pago.fecha_pago), nueva: fechaCorta(cambios.fecha_pago) })}</li>}
      {(cambios.forma_pago_id !== undefined || cambios.fecha_pago !== undefined) && <li>{avisoAlcance}</li>}
      <li>{texto("ui.pagos.correccion.detalleMotivo", { motivo: cambios.motivo })}</li>
    </ul>
  );

  const campoMotivo = (placeholder: string, autoFocus = false) => (
    <div className="space-y-1.5">
      <label htmlFor={`${prefijo}-motivo`} className="text-sm font-medium">{texto("ui.pagos.correccion.motivo")}</label>
      <textarea id={`${prefijo}-motivo`} maxLength={MOTIVO_MAX} rows={3} autoFocus={autoFocus} placeholder={placeholder} value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
        className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <p className="text-right text-xs text-muted-foreground">{texto("ui.pagos.correccion.contador", { n: motivo.length })}</p>
    </div>
  );

  const claseCampo = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const formaInactivaVigente = !pago.forma_pago.is_active && !(formas ?? []).some((f) => f.id === pago.forma_pago.id);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {pago.puede_corregir && !pago.anulado && <>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" aria-label={texto("ui.pagos.correccion.ariaCorregir", etiquetas)} onClick={abrirCorregir}>
          {texto("ui.pagos.correccion.corregir")}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive-soft hover:text-destructive" aria-label={texto("ui.pagos.correccion.ariaAnular", etiquetas)} onClick={abrirAnular}>
          {texto("ui.pagos.correccion.anular")}
        </Button>
      </>}
      <button type="button" className="text-xs text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={texto("ui.pagos.correccion.ariaVerDetalle", etiquetas)} onClick={() => setHistorial(true)}>
        {texto("ui.pagos.correccion.verDetalle")}
      </button>

      <Dialog open={editor} onOpenChange={(abierto) => { if (!abierto) setEditor(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{texto("ui.pagos.correccion.dialogoCorregir")}</DialogTitle>
            <DialogDescription>{texto("ui.pagos.correccion.subtitulo", etiquetas)}</DialogDescription>
          </DialogHeader>
          <form className="mt-5 space-y-4" onSubmit={prepararCorreccion} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${prefijo}-monto`} className="text-sm font-medium">{texto("ui.pagos.correccion.monto")}</label>
                <input id={`${prefijo}-monto`} type="number" inputMode="decimal" min="0.01" step="0.01" value={montoCampo}
                  onChange={(evento) => setMontoCampo(evento.target.value)} className={`${claseCampo} font-mono`} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${prefijo}-fecha`} className="text-sm font-medium">{texto("ui.pagos.correccion.fecha")}</label>
                <input id={`${prefijo}-fecha`} type="date" max={hoyBuenosAires()} value={fecha}
                  onChange={(evento) => setFecha(evento.target.value)} className={claseCampo} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${prefijo}-forma`} className="text-sm font-medium">{texto("ui.pagos.correccion.formaPago")}</label>
              {errorFormas ? (
                <p className="text-sm text-destructive">
                  {texto("ui.pagos.correccion.errorFormas")}{" "}
                  <button type="button" className="text-primary underline underline-offset-4" onClick={cargarFormas}>{texto("ui.pagos.historial.reintentar")}</button>
                </p>
              ) : (
                <select id={`${prefijo}-forma`} value={formaId} disabled={formas === null} onChange={(evento) => setFormaId(evento.target.value)} className={claseCampo}>
                  {/* La forma vigente inactiva se conserva mientras no se cambie (criterio 2); el resto, solo activas. */}
                  {formaInactivaVigente && <option value={pago.forma_pago.id}>{texto("ui.pagos.correccion.formaInactiva", { nombre: pago.forma_pago.nombre })}</option>}
                  {formas === null && !formaInactivaVigente && <option value={pago.forma_pago.id}>{texto("ui.pagos.correccion.cargandoFormas")}</option>}
                  {(formas ?? []).map((forma) => <option key={forma.id} value={forma.id}>{forma.nombre}</option>)}
                </select>
              )}
              {cambiaOperacion && <p role="status" className="text-xs text-muted-foreground">{avisoAlcance}</p>}
            </div>
            {campoMotivo(texto("ui.pagos.correccion.placeholderCorregir"))}
            {errorLocal && <p role="alert" className="text-sm text-destructive">{errorLocal}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditor(false)}>{texto("ui.pagos.correccion.cancelar")}</Button>
              <Button type="submit">{texto("ui.pagos.correccion.guardar")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmarAccionDialog
        abierto={confirmacion !== null}
        titulo={confirmacion === "anular"
          ? texto("confirmaciones.pagos.anular", { monto: formatoMonto(pago.monto), ...etiquetas })
          : texto("confirmaciones.pagos.corregir")}
        detalle={confirmacion === "anular" ? texto("ui.pagos.correccion.anularCuerpo") : detalleCorreccion ?? undefined}
        contenido={confirmacion === "anular" ? (
          <div className="mt-4 space-y-1">
            {campoMotivo(texto("ui.pagos.correccion.placeholderAnular"), true)}
            <button type="button" className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => setMotivo(texto("ui.pagos.correccion.motivoReintegro"))}>
              {texto("ui.pagos.correccion.fueReintegro")}
            </button>
          </div>
        ) : undefined}
        textoConfirmar={texto(confirmacion === "anular" ? "ui.pagos.correccion.confirmarAnular" : "ui.pagos.correccion.confirmarCorregir")}
        irreversible={confirmacion === "anular"}
        confirmarDeshabilitado={confirmacion === "anular" && motivo.trim().length === 0}
        accionError={rechazo === CAJA_DE_AJUSTE_NO_ABIERTA ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <SelectorCajaAjuste enviando={reintentando} onReintentar={(cajaId) => void reintentarConCaja(cajaId)} />
            {errorReintento && <p role="alert" className="text-sm text-destructive">{errorReintento}</p>}
          </div>
        ) : undefined}
        onConfirmar={confirmar}
        onCerrar={volverDeConfirmacion}
        onExito={() => terminar(confirmacion === "anular" ? "anular" : "corregir")}
      />

      {historial && <HistorialCambiosDialog pagoId={pago.id} titulo={texto("ui.pagos.correccion.subtitulo", etiquetas)} onCerrar={() => setHistorial(false)} />}
    </div>
  );
}
