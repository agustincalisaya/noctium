"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { TarifaHoraSchema, TARIFA_HORA_MAX } from "@/server/materias/materia.schema";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { formatearMonto } from "@/lib/moneda";
import { texto } from "@/lib/textos";
import type { CambioTarifasMasivo, MateriaConTarifa } from "@/types/materia.types";

export function CambiarTarifasDialog() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"seleccion" | "previa" | "confirmacion">("seleccion");
  const [items, setItems] = useState<MateriaConTarifa[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [importe, setImporte] = useState("");
  const [importeEditado, setImporteEditado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const solicitud = useRef<AbortController | null>(null);
  const enviando = useRef(false);
  const resultado = useRef<CambioTarifasMasivo | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => () => solicitud.current?.abort(), []);

  const tarifa = Number(importe);
  const importeValido = importe.trim() !== "" && TarifaHoraSchema.safeParse(tarifa).success;
  const seleccionadas = items.filter((item) => seleccion.has(item.id));
  const filtro = normalizarTexto(busqueda.trim());
  const visibles = filtro.length < 2 ? items : items.filter((item) =>
    normalizarTexto(item.nombre).includes(filtro) || normalizarTexto(item.codigo ?? "").includes(filtro));
  const cambian = seleccionadas.filter((item) => item.tarifa_hora !== tarifa).length;
  const puedeContinuar = !cargando && !errorCarga && seleccionadas.length > 0 && seleccionadas.length <= 200 && importeValido;
  const montoActual = (item: MateriaConTarifa) => item.tarifa_hora === null
    ? texto("ui.materias.tarifa.sinTarifa") : formatearMonto(item.tarifa_hora);

  const cargar = async () => {
    solicitud.current?.abort();
    const control = new AbortController();
    solicitud.current = control;
    setCargando(true);
    setErrorCarga(null);
    let mensaje = texto("ui.materias.tarifas.errorCarga");
    try {
      const response = await fetch("/api/materias/tarifas", { cache: "no-store", signal: control.signal });
      const body = await response.json();
      if (!response.ok || body.error || !Array.isArray(body.data?.items)) {
        mensaje = body.error?.message || mensaje;
        throw new Error(mensaje);
      }
      if (control.signal.aborted) return;
      const actuales: MateriaConTarifa[] = body.data.items;
      setItems(actuales);
      setSeleccion((previa) => new Set(actuales.filter((item) => previa.has(item.id)).map((item) => item.id)));
      setConflicto(false);
    } catch {
      if (!control.signal.aborted) setErrorCarga(mensaje);
    } finally {
      if (!control.signal.aborted) setCargando(false);
    }
  };

  const cerrar = () => {
    if (enviando.current) return;
    solicitud.current?.abort();
    setAbierto(false);
  };
  const continuar = (event: FormEvent) => {
    event.preventDefault();
    setImporteEditado(true);
    if (puedeContinuar) setPaso("previa");
  };
  const guardar = async () => {
    if (enviando.current) throw new Error(texto("errores.materias.tarifaComunicacion"));
    if (conflicto) throw new Error(texto("errores.materias.tarifaConflicto"));
    enviando.current = true;
    resultado.current = null;
    try {
      let response: Response;
      let body;
      try {
        response = await fetch("/api/materias/tarifas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarifa_hora: tarifa, materias: seleccionadas.map((item) => ({ id: item.id, tarifa_actual: item.tarifa_hora })) }),
        });
        body = await response.json();
      } catch {
        throw new Error(texto("errores.materias.tarifaComunicacion"));
      }
      if (!response.ok || body.error || !body.data) {
        if (["CONFLICTO_EDICION_CONCURRENTE", "MATERIA_INACTIVA", "MATERIA_NO_ENCONTRADA"].includes(body.error?.code)) setConflicto(true);
        throw new Error(body.error?.message || texto("errores.materias.tarifaComunicacion"));
      }
      resultado.current = body.data;
    } finally {
      enviando.current = false;
    }
  };
  const previa = <div className="max-h-72 overflow-auto rounded-md border border-border">
    <table className="w-full text-sm">
      <thead className="bg-muted text-muted-foreground"><tr>
        <th className="p-2 text-left">{texto("ui.materias.nombre")}</th>
        <th className="p-2 text-right">{texto("ui.materias.tarifas.actual")}</th>
        <th className="p-2 text-right">{texto("ui.materias.tarifas.nueva")}</th>
        <th className="p-2 text-left">{texto("ui.materias.tarifa.tipo")}</th>
      </tr></thead>
      <tbody className="divide-y divide-border">{seleccionadas.map((item) => <tr key={item.id}>
        <td className="p-2">{item.nombre}{item.codigo && <span className="ml-2 text-muted-foreground">{item.codigo}</span>}</td>
        <td className="p-2 text-right font-mono">{montoActual(item)}</td>
        <td className="p-2 text-right font-mono">{formatearMonto(tarifa)}</td>
        <td className="p-2">{item.tarifa_hora === tarifa ? texto("ui.materias.tarifas.sinCambio") : ""}</td>
      </tr>)}</tbody>
    </table>
  </div>;

  return <>
    <Button variant="outline" size="sm" onClick={() => {
      setPaso("seleccion"); setSeleccion(new Set()); setBusqueda(""); setImporte("");
      setImporteEditado(false); setConflicto(false); setItems([]); setAbierto(true); void cargar();
    }}>{texto("ui.materias.tarifas.cambiar")}</Button>
    <Dialog open={abierto && paso !== "confirmacion"} onOpenChange={(open) => { if (!open) cerrar(); }}>
      <DialogContent initialFocus={campo} className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto">
        <form noValidate onSubmit={continuar}>
          <DialogHeader>
            <DialogTitle>{texto(paso === "seleccion" ? "ui.materias.tarifas.cambiar" : "ui.materias.tarifas.previa")}</DialogTitle>
            <DialogDescription>{texto(paso === "seleccion" ? "ui.materias.tarifas.seleccion" : "ui.materias.tarifa.aviso")}</DialogDescription>
          </DialogHeader>
          {paso === "seleccion" ? <div className="mt-5 space-y-4">
            <div className="space-y-1">
              <label htmlFor="tarifas-busqueda" className="text-sm font-medium">{texto("ui.materias.tarifas.buscar")}</label>
              <Input id="tarifas-busqueda" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} aria-describedby="tarifas-busqueda-ayuda" />
              <p id="tarifas-busqueda-ayuda" className="text-xs text-muted-foreground">{texto("ui.materias.tarifas.buscarAyuda")}</p>
            </div>
            {cargando ? <p role="status">{texto("ui.materias.tarifas.cargando")}</p> : errorCarga ? <div>
              <p role="alert" className="text-sm text-destructive">{errorCarga}</p>
              <Button type="button" variant="outline" onClick={() => void cargar()}>{texto("ui.materias.tarifas.reintentar")}</Button>
            </div> : <>
              <Button type="button" variant="outline" disabled={!visibles.length} onClick={() => setSeleccion((actual) => new Set([...actual, ...visibles.map((item) => item.id)]))}>
                {texto("ui.materias.tarifas.todas", { cantidad: visibles.length })}
              </Button>
              {!visibles.length ? <p>{texto(items.length ? "ui.materias.tarifas.sinResultados" : "ui.materias.tarifas.vacio")}</p> : <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full text-sm"><thead className="bg-muted text-muted-foreground"><tr>
                  <th className="p-2 text-left">{texto("ui.materias.nombre")}</th><th className="p-2 text-left">{texto("ui.materias.codigo")}</th>
                  <th className="p-2 text-right">{texto("ui.materias.tarifas.actual")}</th>
                </tr></thead><tbody className="divide-y divide-border">{visibles.map((item) => <tr key={item.id}>
                  <td className="p-2"><label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={seleccion.has(item.id)} onChange={(event) => {
                    const marcada = event.target.checked;
                    setSeleccion((actual) => { const nueva = new Set(actual); if (marcada) nueva.add(item.id); else nueva.delete(item.id); return nueva; });
                  }} />{item.nombre}</label></td>
                  <td className="p-2">{item.codigo ?? ""}</td><td className="p-2 text-right font-mono">{montoActual(item)}</td>
                </tr>)}</tbody></table>
              </div>}
            </>}
            <p role="status" className="text-sm">{texto("ui.materias.tarifas.seleccionadas", { cantidad: seleccionadas.length })}</p>
            {seleccionadas.length > 200 && <p role="alert" className="text-sm text-destructive">{texto("errores.materias.tarifaSeleccion")}</p>}
            <div className="space-y-1">
              <label htmlFor="tarifas-importe" className="text-sm font-medium">{texto("ui.materias.tarifa.campo")}</label>
              <Input ref={campo} id="tarifas-importe" type="number" inputMode="numeric" min={1} max={TARIFA_HORA_MAX} step={1}
                value={importe} onChange={(event) => { setImporte(event.target.value); setImporteEditado(true); }} onBlur={() => setImporteEditado(true)}
                aria-invalid={importeEditado && !importeValido} aria-describedby={importeEditado && !importeValido ? "tarifas-importe-error" : undefined} />
              {importeEditado && !importeValido && <p id="tarifas-importe-error" role="alert" className="text-sm text-destructive">{texto("errores.materias.tarifaImporte")}</p>}
            </div>
          </div> : <div className="mt-5 space-y-3">{previa}{cambian === 0 && <p role="status" className="text-sm">{texto("ui.materias.tarifas.sinCambios")}</p>}</div>}
          <DialogFooter>
            {paso === "seleccion" ? <>
              <Button type="button" variant="outline" onClick={cerrar}>{texto("ui.materias.tarifa.cancelar")}</Button>
              <Button type="submit" disabled={!puedeContinuar}>{texto("ui.materias.tarifas.continuar")}</Button>
            </> : <>
              <Button type="button" variant="outline" onClick={() => setPaso("seleccion")}>{texto("ui.materias.tarifa.volver")}</Button>
              {cambian ? <Button type="button" onClick={() => setPaso("confirmacion")}>{texto("ui.materias.tarifas.confirmar")}</Button>
                : <Button type="button" onClick={cerrar}>{texto("ui.materias.tarifas.cerrar")}</Button>}
            </>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmarAccionDialog abierto={abierto && paso === "confirmacion"}
      titulo={texto(cambian === 1 ? "confirmaciones.materias.tarifasUna" : "confirmaciones.materias.tarifas", { cantidad: cambian, tarifa: formatearMonto(tarifa) })}
      detalle={<div className="space-y-3"><p>{texto("ui.materias.tarifa.aviso")}</p>{previa}</div>}
      textoConfirmar={texto("ui.materias.tarifas.confirmar")} confirmarDeshabilitado={conflicto}
      contenido={conflicto ? <Button variant="outline" onClick={() => { setPaso("seleccion"); void cargar(); }}>{texto("ui.materias.tarifas.recargar")}</Button> : undefined}
      onConfirmar={guardar} onCerrar={() => setPaso("previa")}
      onExito={() => {
        cerrar(); router.refresh();
        const cantidad = resultado.current!.actualizadas;
        if (cantidad === 0) toast.info(texto("ui.materias.tarifas.sinCambios"));
        else toast.success(texto(cantidad === 1 ? "ui.materias.tarifas.exitoUna" : "ui.materias.tarifas.exito", { cantidad }));
      }} />
  </>;
}
