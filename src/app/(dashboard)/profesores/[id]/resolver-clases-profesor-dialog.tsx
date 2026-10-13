"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { texto } from "@/lib/textos";
import { pedirDatos } from "@/lib/api-estado-profesor";
import type { listarTurnosFuturosParaBaja, previsualizarCambioDeProfesor, cancelarTurnosFuturosDeProfesor } from "@/server/profesores/profesor.estado.service";

type Lista = Awaited<ReturnType<typeof listarTurnosFuturosParaBaja>>;
type Preview = Awaited<ReturnType<typeof previsualizarCambioDeProfesor>>;
type Resultado = Awaited<ReturnType<typeof cancelarTurnosFuturosDeProfesor>>;
type Fila = Lista["items"][number];
const TAMANO_LOTE = 100;
const columnasTexto = { fecha: "ui.profesores.estado.fecha", hora: "ui.profesores.estado.hora", materia: "ui.profesores.estado.materia", profesor: "ui.profesores.estado.profesor", inscriptos: "ui.profesores.estado.inscriptos", estado: "ui.profesores.estado.estado", resultado: "ui.profesores.estado.resultado" } as const;
const resultadoTexto = { SE_PUEDE: "ui.profesores.estado.sePuede", OCUPADO: "ui.profesores.estado.ocupado", FUERA_DE_HORARIO: "ui.profesores.estado.fueraHorario", NO_DISPONIBLE: "ui.profesores.estado.noDisponible" } as const;
const fecha = (valor: string) => valor.split("-").reverse().join("/");

export function ResolverClasesProfesorDialog({ profesorId, onCerrar, onDesactivar }: { profesorId: string; onCerrar: () => void; onDesactivar: () => void }) {
  const [datos, setDatos] = useState<Lista | null>(null);
  const [pagina, setPagina] = useState(1);
  const [materia, setMateria] = useState("");
  const [seleccion, setSeleccion] = useState<Fila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [paso, setPaso] = useState<"lista" | "preview">("lista");
  const [destino, setDestino] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmacion, setConfirmacion] = useState<"cancelar" | "cambiar" | null>(null);
  const [resultado, setResultado] = useState<{ mensaje: string; fallos: Resultado["no_procesadas"]; filas: Fila[] } | null>(null);
  const solicitud = useRef(0);
  const base = `/api/profesores/${profesorId}/turnos-futuros`;
  const cargar = useCallback(async (paginaSolicitada = pagina) => {
    const numero = ++solicitud.current;
    setCargando(true); setError(null);
    try {
      const lista = await pedirDatos<Lista>(`${base}?pagina=${paginaSolicitada}${materia ? `&materia_id=${materia}` : ""}`);
      if (numero !== solicitud.current) return;
      if (materia && lista.materias.length <= 1 && lista.materias[0]?.id !== materia) { setMateria(""); setPagina(1); return; }
      const fueraDelListado = lista.seleccion.truncada ? 0 : (resultado?.filas.filter((t) => (!materia || t.materia.id === materia) && !lista.seleccion.items.some((f) => f.turno_id === t.turno_id)).length ?? 0);
      const ultimaPagina = Math.max(1, Math.ceil((lista.total + fueraDelListado) / 10));
      if (paginaSolicitada > ultimaPagina) { setPagina(ultimaPagina); return; }
      setDatos(lista);
    } catch (causa) { if (numero === solicitud.current) setError(causa instanceof Error ? causa.message : texto("ui.profesores.estado.error")); }
    finally { if (numero === solicitud.current) setCargando(false); }
  }, [base, pagina, materia, resultado]);
  useEffect(() => {
    // Sincroniza el filtro y la página con la lectura del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    // Este contador invalida solicitudes asíncronas; no representa un nodo DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { solicitud.current++; };
  }, [cargar]);
  const fallidas = resultado?.filas.filter((t) => !materia || t.materia.id === materia) ?? [];
  // La selección global conserva los datos necesarios fuera de la página visible.
  const disponibles = datos?.seleccion.items ?? [];
  const listaCompleta = [...fallidas, ...disponibles.filter((t) => !fallidas.some((f) => f.turno_id === t.turno_id))];
  const filas = datos?.seleccion.truncada
    ? datos.items
    : listaCompleta.slice((pagina - 1) * 10, pagina * 10);
  const totalFilas = datos?.seleccion.truncada ? datos.total : listaCompleta.length;
  const seleccionadas = seleccion;
  const idsSeleccionados = new Set(seleccion.map((t) => t.turno_id));
  const materiasSeleccionadas = new Set(seleccionadas.map((t) => t.materia.id));
  const destinos = datos?.destinos.find((d) => d.materia_id === seleccionadas[0]?.materia.id)?.profesores ?? [];
  const toggle = (fila: Fila) => {
    setSeleccion((prev) => prev.some((t) => t.turno_id === fila.turno_id) ? prev.filter((t) => t.turno_id !== fila.turno_id) : [...prev, fila]);
    setPreview(null);
  };
  const cambiarDestino = async (id: string) => {
    setDestino(id); setPreview(null); setError(null);
    const numero = ++solicitud.current;
    setCargando(true);
    try {
      if (id) {
        const vista: Preview = { resultados: [], se_pueden: 0, no_se_pueden: 0 };
        for (let inicio = 0; inicio < seleccionadas.length; inicio += TAMANO_LOTE) {
          const tanda = await pedirDatos<Preview>(`${base}/cambio-profesor/previsualizacion`, {
            turno_ids: seleccionadas.slice(inicio, inicio + TAMANO_LOTE).map((t) => t.turno_id), profesor_destino_id: id,
          });
          if (numero !== solicitud.current) return;
          vista.resultados.push(...tanda.resultados);
          vista.se_pueden += tanda.se_pueden;
          vista.no_se_pueden += tanda.no_se_pueden;
        }
        setPreview(vista);
      }
    } catch (causa) { if (numero === solicitud.current) setError(causa instanceof Error ? causa.message : texto("ui.profesores.estado.error")); }
    finally { if (numero === solicitud.current) setCargando(false); }
  };
  const procesar = async () => {
    const tipo = confirmacion!;
    setProcesando(true);
    let procesadas = 0;
    const noProcesadas: Resultado["no_procesadas"] = [];
    try {
      for (let inicio = 0; inicio < seleccionadas.length; inicio += TAMANO_LOTE) {
        try {
          const respuesta = await pedirDatos<Resultado>(`${base}/${tipo === "cancelar" ? "cancelacion" : "cambio-profesor"}`, {
            turno_ids: seleccionadas.slice(inicio, inicio + TAMANO_LOTE).map((t) => t.turno_id),
            ...(tipo === "cambiar" ? { profesor_destino_id: destino } : {}),
          });
          procesadas += respuesta.procesadas;
          noProcesadas.push(...respuesta.no_procesadas);
        } catch (causa) {
          // No reenviar tandas exitosas si se interrumpe una solicitud posterior.
          const message = causa instanceof Error ? causa.message : texto("ui.profesores.estado.error");
          noProcesadas.push(...seleccionadas.slice(inicio).map((t) => ({ turno_id: t.turno_id, code: "LOTE_NO_COMPLETADO", message })));
          break;
        }
      }
      const fallidas = new Set(noProcesadas.map((r) => r.turno_id));
      const mensaje = texto(tipo === "cancelar" ? (procesadas === 1 ? "ui.profesores.estado.canceladasUna" : "ui.profesores.estado.canceladas") : (procesadas === 1 ? "ui.profesores.estado.cambiadasUna" : "ui.profesores.estado.cambiadas"), { total: procesadas });
      const pendientes = seleccionadas.filter((t) => fallidas.has(t.turno_id));
      setResultado({ mensaje, fallos: noProcesadas, filas: pendientes });
      setSeleccion(pendientes); setPaso("lista"); setPreview(null); setDestino(""); setPagina(1);
      if (procesadas > 0) toast.success(mensaje);
      await cargar(1);
    } finally { setProcesando(false); }
  };
  const botonDesactivar = datos?.confirmados === 0 && <Button onClick={onDesactivar}>{texto("ui.profesores.estado.desactivar")}</Button>;
  return <>
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !confirmacion && !procesando) onCerrar(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{texto("ui.profesores.estado.bloqueoTitulo")}</DialogTitle>
          <DialogDescription>{datos && datos.confirmados > 0 ? texto("errores.profesor.conClasesFuturas", { total: datos.confirmados }) : texto(datos ? "ui.profesores.estado.vacio" : "ui.profesores.estado.cargando")}</DialogDescription>
        </DialogHeader>
        {resultado && <div role="status" className="space-y-2">
          <p className="rounded-md bg-success p-3 text-sm text-success-foreground">{resultado.mensaje}</p>
          {resultado.fallos.length > 0 && <p className="rounded-md bg-warning p-3 text-sm text-warning-foreground">{texto(resultado.fallos.length === 1 ? "ui.profesores.estado.parcialUna" : "ui.profesores.estado.parcial", { total: resultado.fallos.length })}</p>}
        </div>}
        {Boolean(datos?.pendientes) && <p className="text-sm text-muted-foreground">{texto("ui.profesores.estado.pendientes", { total: datos!.pendientes })}</p>}
        {error && <div role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">{error} <Button variant="outline" size="sm" onClick={() => void (paso === "preview" && destino ? cambiarDestino(destino) : cargar())}>{texto("ui.profesores.estado.reintentar")}</Button></div>}
        {cargando && <p role="status" className="text-sm text-muted-foreground">{texto("ui.profesores.estado.cargando")}</p>}
        {paso === "lista" ? <>
          <p className="text-sm text-muted-foreground">{texto("ui.profesores.estado.ayuda")}</p>
          {datos && datos.materias.length > 1 && <label className="flex max-w-sm items-center gap-2 text-sm">
            {texto("ui.profesores.estado.materia")}
            <select aria-label={texto("ui.profesores.estado.materia")} value={materia} disabled={cargando} onChange={(e) => { const filtro = e.target.value; setMateria(filtro); setPagina(1); setSeleccion((prev) => prev.filter((t) => !filtro || t.materia.id === filtro)); setPreview(null); }} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2 focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{texto("ui.profesores.estado.todasMaterias", { total: datos.confirmados })}</option>
              {datos.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.cantidad})</option>)}
            </select>
          </label>}
          {datos?.seleccion.truncada && <p role="status" className="rounded-md bg-warning p-3 text-sm text-warning-foreground">{texto("ui.profesores.estado.seleccionTruncada", { total: disponibles.length })}</p>}
          {filas.length > 0 && <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" disabled={cargando} checked={disponibles.length > 0 && disponibles.every((t) => idsSeleccionados.has(t.turno_id))}
                onChange={(e) => { const marcado = e.target.checked; setSeleccion((prev) => marcado ? [...prev.filter((t) => !disponibles.some((d) => d.turno_id === t.turno_id)), ...disponibles] : []); setPreview(null); }} className="size-4 accent-primary" />
                {texto(materia ? "ui.profesores.estado.seleccionarMateria" : "ui.profesores.estado.seleccionarTodas", { materia: datos?.materias.find((m) => m.id === materia)?.nombre, total: datos?.seleccion.total ?? 0 })}
              </label><span aria-live="polite" className="text-muted-foreground">{texto(seleccionadas.length === 1 ? "ui.profesores.estado.seleccionadasUna" : "ui.profesores.estado.seleccionadas", { total: seleccionadas.length })}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!seleccionadas.length || cargando} className="border-destructive text-destructive hover:bg-destructive-soft hover:text-destructive" onClick={() => setConfirmacion("cancelar")}>{texto("ui.profesores.estado.cancelar")}</Button>
              <Button variant="outline" size="sm" disabled={!seleccionadas.length || cargando} onClick={() => {
                if (materiasSeleccionadas.size !== 1) { setError(texto("errores.profesor.materiasDistintas")); return; }
                setPaso("preview"); setError(null); setDestino(""); setPreview(null);
              }}>{texto("ui.profesores.estado.cambiar")}</Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>
                <th className="w-9 p-2"><span className="sr-only">{texto(seleccionadas.length === 1 ? "ui.profesores.estado.seleccionadasUna" : "ui.profesores.estado.seleccionadas", { total: seleccionadas.length })}</span></th>
                {(["fecha", "hora", "materia", "profesor", "inscriptos", "estado"] as const).map((col) => <th key={col} className="p-2 font-medium">{texto(columnasTexto[col])}</th>)}<th className="p-2"><span className="sr-only">{texto("ui.profesores.estado.verClase")}</span></th>
              </tr></thead><tbody>
                {filas.map((t) => <tr key={t.turno_id} className="border-b border-border last:border-0">
                  <td className="p-2"><input type="checkbox" className="size-4 accent-primary" disabled={cargando} checked={idsSeleccionados.has(t.turno_id)} onChange={() => toggle(t)} aria-label={texto("ui.profesores.estado.casilla", { materia: t.materia.nombre, fecha: fecha(t.fecha), hora: t.hora_inicio })} /></td>
                  <td className="whitespace-nowrap p-2 tabular-nums">{fecha(t.fecha)}</td><td className="whitespace-nowrap p-2 tabular-nums">{t.hora_inicio}–{t.hora_fin}</td>
                  <td className="p-2">{t.materia.nombre}</td><td className="p-2">{t.profesor.nombre_para_mostrar}</td><td className="p-2 tabular-nums">{t.alumnos_inscriptos}</td>
                  <td className="p-2"><span className="rounded-full bg-success px-2 py-0.5 text-xs text-success-foreground">{texto(t.estado === "COMPLETO" ? "ui.profesores.estado.completa" : "ui.profesores.estado.disponible")}</span>
                    {resultado?.fallos.find((r) => r.turno_id === t.turno_id) && <p className="mt-1 text-xs text-destructive">{resultado.fallos.find((r) => r.turno_id === t.turno_id)!.message}</p>}
                  </td><td className="p-2"><a target="_blank" rel="noopener noreferrer" href={`/turnos/${t.turno_id}`} className="whitespace-nowrap text-primary underline underline-offset-2">{texto("ui.profesores.estado.verClase")}</a></td>
                </tr>)}
              </tbody></table>
            </div>
          </>}
          {!filas.length && !cargando && !error && <p className="text-sm">{texto("ui.profesores.estado.vacio")}</p>}
          {datos && totalFilas > 10 && <nav aria-label={texto("ui.profesores.estado.pagina", { pagina, total: Math.ceil(totalFilas / 10) })} className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={pagina === 1 || cargando} onClick={() => { setPagina(pagina - 1); }}>{texto("ui.profesores.estado.anterior")}</Button>
            <span className="text-xs tabular-nums">{texto("ui.profesores.estado.pagina", { pagina, total: Math.ceil(totalFilas / 10) })}</span>
            <Button variant="outline" size="sm" disabled={pagina >= Math.ceil(totalFilas / 10) || cargando} onClick={() => { setPagina(pagina + 1); }}>{texto("ui.profesores.estado.siguiente")}</Button>
          </nav>}
        </> : <>
          <p className="text-sm text-muted-foreground">{texto(seleccionadas.length === 1 ? "ui.profesores.estado.previewUna" : "ui.profesores.estado.preview", { total: seleccionadas.length })}</p>
          <label className="flex max-w-sm flex-col gap-2 text-sm font-medium">{texto("ui.profesores.estado.nuevo")}
            <select aria-label={texto("ui.profesores.estado.nuevo")} value={destino} disabled={cargando} onChange={(e) => void cambiarDestino(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{texto("ui.profesores.estado.elegirDestino")}</option>{destinos.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
            </select>
          </label>
          {!destinos.length && <p role="status" className="text-sm">{texto("ui.profesores.estado.sinDestinos")}</p>}
          {preview && <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr>
            {(["fecha", "hora", "materia", "inscriptos", "resultado"] as const).map((col) => <th key={col} className="border-b border-border p-2 text-xs font-medium text-muted-foreground">{texto(columnasTexto[col])}</th>)}
          </tr></thead><tbody>{seleccionadas.map((t) => {
            const r = preview.resultados.find((r) => r.turno_id === t.turno_id)?.resultado ?? "NO_DISPONIBLE";
            return <tr key={t.turno_id} className="border-b border-border"><td className="p-2 tabular-nums">{fecha(t.fecha)}</td><td className="p-2 tabular-nums">{t.hora_inicio}–{t.hora_fin}</td><td className="p-2">{t.materia.nombre}</td><td className="p-2 tabular-nums">{t.inscriptos}</td><td className="p-2"><span className={r === "SE_PUEDE" ? "rounded-full bg-success px-2 py-0.5 text-xs text-success-foreground" : "rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive"}>{texto(resultadoTexto[r])}</span></td></tr>;
          })}</tbody></table></div>}
          <div className="flex gap-2"><Button variant="outline" disabled={cargando} onClick={() => { setPaso("lista"); setPreview(null); }}>{texto("ui.profesores.estado.volver")}</Button>
            <Button disabled={!preview?.se_pueden || cargando} onClick={() => setConfirmacion("cambiar")}>{texto(preview?.se_pueden === 1 ? "ui.profesores.estado.confirmarCantidadUna" : "ui.profesores.estado.confirmarCantidad", { total: preview?.se_pueden ?? 0 })}</Button></div>
        </>}
        <div className="flex items-center justify-end gap-2">{botonDesactivar}<Button variant="outline" disabled={procesando} onClick={onCerrar}>{texto("ui.profesores.estado.cerrar")}</Button></div>
      </DialogContent>
    </Dialog>
    <ConfirmarAccionDialog abierto={confirmacion !== null} irreversible={confirmacion === "cancelar"}
      titulo={texto(confirmacion === "cancelar" ? (seleccionadas.length === 1 ? "ui.profesores.estado.confirmarCancelacionUna" : "ui.profesores.estado.confirmarCancelacion") : (preview?.se_pueden === 1 ? "ui.profesores.estado.confirmarCambioUna" : "ui.profesores.estado.confirmarCambio"), { total: confirmacion === "cancelar" ? seleccionadas.length : preview?.se_pueden ?? 0,
        profesor: destinos.find((p) => p.id === destino) ? `${destinos.find((p) => p.id === destino)!.nombre} ${destinos.find((p) => p.id === destino)!.apellido}` : "" })}
      detalle={confirmacion === "cancelar" ? <><p>{texto(seleccionadas.reduce((s, t) => s + t.inscriptos, 0) === 1 ? "ui.profesores.estado.alumnosAfectadosUna" : "ui.profesores.estado.alumnosAfectados", { total: seleccionadas.reduce((s, t) => s + t.inscriptos, 0) })}</p><p className="mt-2">{texto("ui.profesores.estado.conservar")}</p>{seleccionadas.some((t) => t.con_pagos) && <p className="mt-2">{texto("ui.profesores.estado.reintegro")}</p>}</> : texto("ui.profesores.estado.conservarCambio")}
      textoConfirmar={texto(confirmacion === "cancelar" ? (seleccionadas.length === 1 ? "ui.profesores.estado.cancelarCantidadUna" : "ui.profesores.estado.cancelarCantidad") : (preview?.se_pueden === 1 ? "ui.profesores.estado.confirmarCantidadUna" : "ui.profesores.estado.confirmarCantidad"), { total: confirmacion === "cancelar" ? seleccionadas.length : preview?.se_pueden ?? 0 })}
      onConfirmar={procesar} onCerrar={() => setConfirmacion(null)} />
  </>;
}
