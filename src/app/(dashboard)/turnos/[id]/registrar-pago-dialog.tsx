"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { hoyEnZonaCentro } from "@/lib/calendario-semana";
import type { AlumnoPago, OpcionesPago } from "@/types/pago.types";

type Props = { turnoId: string; contexto: string; deshabilitado?: boolean; onRegistrado: () => Promise<void> };
type Errores = Partial<Record<"alumno_id" | "monto" | "forma_pago_id" | "fecha_pago", string>>;


export function RegistrarPagoDialog({ turnoId, contexto, deshabilitado, onRegistrado }: Props) {
  const prefijo = useId();
  const inputAlumno = useRef<HTMLInputElement>(null);
  const solicitudActual = useRef(0);
  const envioActual = useRef(false);
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<OpcionesPago | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [texto, setTexto] = useState("");
  const [alumnoId, setAlumnoId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);
  const [monto, setMonto] = useState("");
  const [formaId, setFormaId] = useState("");
  const [fecha, setFecha] = useState("");

  const seleccionar = (alumno: AlumnoPago) => {
    setAlumnoId(alumno.id);
    setTexto(`${alumno.nombre_completo} · ${alumno.dni}`);
    setFormaId(alumno.forma_pago_preferida_id ?? "");
    setBuscando(false);
    setErrores((previo) => ({ ...previo, alumno_id: undefined, forma_pago_id: undefined }));
  };

  const cargarOpciones = async () => {
    const solicitud = ++solicitudActual.current;
    setCargando(true); setError(""); setOpciones(null);
    try {
      const response = await fetchAutenticado(`/api/pagos/opciones?turno_id=${encodeURIComponent(turnoId)}`, { cache: "no-store" });
      const resultado = await response.json();
      if (!response.ok || !resultado.data) throw new Error(resultado?.error?.message ?? "No se pudieron consultar las opciones de pago");
      if (solicitud !== solicitudActual.current) return;
      const data: OpcionesPago = resultado.data;
      setOpciones(data);
      const unico = data.alumnos.find(({ id }) => id === data.preseleccionar_alumno_id);
      if (unico) seleccionar(unico);
    } catch (causa) {
      if (solicitud === solicitudActual.current) setError(causa instanceof Error && causa.message !== "Failed to fetch"
        ? causa.message : "No se pudo conectar. Intentá nuevamente");
    } finally {
      if (solicitud === solicitudActual.current) setCargando(false);
    }
  };

  const cambiarAbierto = (valor: boolean) => {
    if (envioActual.current) return;
    setAbierto(valor);
    if (valor) {
      setTexto(""); setAlumnoId(""); setMonto(""); setFormaId(""); setFecha(hoyEnZonaCentro());
      setErrores({}); setBuscando(false); setActivo(0);
      void cargarOpciones();
    } else {
      solicitudActual.current++;
    }
  };

  const busqueda = normalizarTexto(texto);
  const resultados = (opciones?.alumnos ?? []).filter((alumno) => /^\d+$/.test(texto.trim())
    ? alumno.dni.includes(texto.trim())
    : busqueda.split(/\s+/).every((palabra) => normalizarTexto(alumno.nombre_completo).includes(palabra)))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es", { sensitivity: "base" }));
  const mostrarResultados = buscando && !cargando && opciones !== null && !alumnoId;
  const cantidadResultados = resultados.length;
  useEffect(() => {
    if (!mostrarResultados) return;
    document.getElementById(`${prefijo}-opcion-${activo}`)?.scrollIntoView({ block: "nearest" });
  }, [activo, mostrarResultados, prefijo, cantidadResultados]);

  const navegar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape" && buscando) {
      evento.preventDefault(); evento.stopPropagation(); setBuscando(false);
    } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setBuscando(true);
      setActivo((previo) => buscando ? Math.max(0, Math.min(resultados.length - 1, previo + (evento.key === "ArrowDown" ? 1 : -1))) : 0);
    } else if (evento.key === "Enter" && mostrarResultados && resultados[activo]) {
      evento.preventDefault(); seleccionar(resultados[activo]);
    }
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (envioActual.current || cargando || !opciones) return;
    const importe = monto.trim().replace(",", ".");
    const validacion: Errores = {};
    if (!alumnoId) validacion.alumno_id = "Elegí el alumno que paga";
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(importe) || Number(importe) <= 0) validacion.monto = "Ingresá un monto mayor a cero con hasta 2 decimales";
    if (!formaId) validacion.forma_pago_id = "Elegí una forma de pago";
    if (!fecha) validacion.fecha_pago = "Ingresá la fecha de pago";
    setErrores(validacion); setError("");
    if (Object.keys(validacion).length) {
      document.getElementById(`${prefijo}-${Object.keys(validacion)[0]}`)?.focus();
      return;
    }
    envioActual.current = true; setEnviando(true);
    try {
      const response = await fetchAutenticado("/api/pagos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turno_id: turnoId, alumno_id: alumnoId, monto: importe, forma_pago_id: formaId, fecha_pago: fecha }),
      });
      const resultado = await response.json();
      if (!response.ok) {
        const campos = resultado?.error?.detalles?.fieldErrors ?? {};
        setErrores(Object.fromEntries(Object.entries(campos).map(([campo, mensajes]) => [campo, (mensajes as string[])[0]])));
        setError(resultado?.error?.message ?? "No se pudo registrar el pago. Intentá nuevamente.");
        return;
      }
      setAbierto(false);
      toast.success("Pago registrado correctamente");
      await onRegistrado();
    } catch {
      setError("No se pudo conectar. Intentá nuevamente");
    } finally {
      envioActual.current = false; setEnviando(false);
    }
  };

  const campoError = (campo: keyof Errores) => errores[campo]
    ? <p id={`${prefijo}-${campo}-error`} className="text-xs text-destructive" role="alert">{errores[campo]}</p> : null;
  const sinAlumnos = opciones?.alumnos.length === 0;
  const sinFormas = opciones?.formas_pago.length === 0;

  return <Dialog open={abierto} onOpenChange={cambiarAbierto}>
    <Button className="w-full" disabled={deshabilitado} onClick={() => cambiarAbierto(true)}>Registrar pago</Button>
    <DialogContent initialFocus={inputAlumno} className="max-h-[calc(100dvh-2rem)] max-w-[390px] overflow-y-auto p-5 pb-8">
      <DialogHeader className="gap-2">
        <DialogTitle className="text-base leading-5">Registrar pago</DialogTitle>
        <DialogDescription className="text-xs">{contexto}</DialogDescription>
      </DialogHeader>
      <form className="mt-4 space-y-3" noValidate onSubmit={enviar} aria-busy={enviando}>
        {cargando && <p role="status" className="text-xs text-muted-foreground">Cargando opciones de pago…</p>}
        {error && <div role="alert" className="space-y-2 rounded-md bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
          <p>{error}</p>{!opciones && !cargando && <Button size="sm" variant="outline" type="button" onClick={() => void cargarOpciones()}>Reintentar</Button>}
        </div>}
        {sinAlumnos && <p role="status" className="text-sm text-muted-foreground">El turno no tiene alumnos inscriptos</p>}
        {sinFormas && <p role="status" className="text-sm text-muted-foreground">No hay formas de pago activas. Consultá con Gerencia.</p>}
        <fieldset disabled={cargando || enviando || !opciones || sinAlumnos || sinFormas} className="min-w-0 space-y-3">
          {/* La lista permanece en flujo hasta elegir o cerrar: colapsarla al blur
              movería Cancelar/Guardar entre pointerdown y click. */}
          <div className="space-y-1.5">
            <Label className="block text-[11px] leading-4 font-normal" htmlFor={`${prefijo}-alumno_id`}>Alumno</Label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
              <Input id={`${prefijo}-alumno_id`} ref={inputAlumno} role="combobox" autoComplete="off" placeholder="Buscar por apellido, nombre o DNI"
                className="bg-card pl-8 text-xs" value={texto} aria-autocomplete="list" aria-expanded={mostrarResultados}
                aria-controls={`${prefijo}-resultados`} aria-activedescendant={mostrarResultados && resultados[activo] ? `${prefijo}-opcion-${activo}` : undefined}
                aria-invalid={Boolean(errores.alumno_id)} aria-describedby={errores.alumno_id ? `${prefijo}-alumno_id-error` : undefined}
                onFocus={() => { if (!alumnoId) setBuscando(true); }} onKeyDown={navegar}
                onChange={(evento) => { setTexto(evento.target.value); setAlumnoId(""); setFormaId(""); setBuscando(true); setActivo(0); }} />
            </div>
            {mostrarResultados && <ul id={`${prefijo}-resultados`} role="listbox" aria-label="Alumnos inscriptos para el pago" className="max-h-40 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
              {resultados.length ? resultados.map((alumno, indice) => <li key={alumno.id} role="presentation">
                <button type="button" role="option" id={`${prefijo}-opcion-${indice}`} aria-selected={indice === activo} tabIndex={-1}
                  className={`w-full rounded-sm px-2 py-2 text-left text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none ${indice === activo ? "bg-accent" : ""}`}
                  onMouseDown={(evento) => evento.preventDefault()} onClick={() => seleccionar(alumno)}>{alumno.nombre_completo} · {alumno.dni}</button>
              </li>) : <li role="presentation" className="px-2 py-3 text-xs text-muted-foreground">No hay alumnos que coincidan con la búsqueda</li>}
            </ul>}
            {campoError("alumno_id")}
          </div>
          <div className="space-y-1.5">
            <Label className="block text-[11px] leading-4 font-normal" htmlFor={`${prefijo}-monto`}>Monto ($)</Label>
            <Input id={`${prefijo}-monto`} className="h-8 bg-card font-mono text-xs" inputMode="decimal" placeholder="12000" value={monto}
              aria-invalid={Boolean(errores.monto)} aria-describedby={errores.monto ? `${prefijo}-monto-error` : undefined} onChange={(evento) => setMonto(evento.target.value)} />
            {campoError("monto")}
          </div>
          <div className="space-y-1.5">
            <Label className="block text-[11px] leading-4 font-normal" htmlFor={`${prefijo}-forma_pago_id`}>Forma de pago</Label>
            <select id={`${prefijo}-forma_pago_id`} value={formaId} onChange={(evento) => setFormaId(evento.target.value)}
              className="h-8 w-full rounded-md border border-input bg-card px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              aria-invalid={Boolean(errores.forma_pago_id)} aria-describedby={errores.forma_pago_id ? `${prefijo}-forma_pago_id-error` : undefined}>
              <option value="">Seleccionar forma de pago</option>
              {opciones?.formas_pago.map((forma) => <option key={forma.id} value={forma.id}>{forma.nombre}</option>)}
            </select>
            {campoError("forma_pago_id")}
          </div>
          <div className="space-y-1.5">
            <Label className="block text-[11px] leading-4 font-normal" htmlFor={`${prefijo}-fecha_pago`}>Fecha de pago</Label>
            <Input id={`${prefijo}-fecha_pago`} className="relative h-8 min-w-0 bg-card font-mono text-xs [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer" type="date" value={fecha} max={hoyEnZonaCentro()}
              aria-invalid={Boolean(errores.fecha_pago)} aria-describedby={errores.fecha_pago ? `${prefijo}-fecha_pago-error` : undefined} onChange={(evento) => setFecha(evento.target.value)} />
            {campoError("fecha_pago")}
          </div>
        </fieldset>
        <DialogFooter className="mt-7">
          <Button type="button" variant="outline" className="h-8 bg-card text-xs" disabled={enviando} onClick={() => cambiarAbierto(false)}>Cancelar</Button>
          <Button type="submit" className="h-8 text-xs" disabled={enviando || cargando || !opciones || sinAlumnos || sinFormas}>{enviando ? "Registrando…" : "Registrar pago"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
