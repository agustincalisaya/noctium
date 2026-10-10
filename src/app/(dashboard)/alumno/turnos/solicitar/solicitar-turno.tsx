"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado, fetchOLanzar } from "@/lib/fetch-autenticado";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { texto } from "@/lib/textos";
import { fechaLarga } from "@/lib/turno-detalle";
import { formatearMonto } from "@/lib/moneda";
import type { ResumenInscripcion } from "@/types/turno.types";
import { cn } from "@/lib/utils";

type Materia = { id: string; nombre: string; turnos_con_lugar: number };
type Profesor = { id: string; nombre: string; turnos_con_lugar: number };
type Horario = { turno_id: string; fecha: string; hora_inicio: string; hora_fin: string; aula: string; cupos_libres: number };
type EstadoOpciones<T> = { estado: "esperando" | "cargando" | "listo" | "error"; items: T[]; error: string };

const esperando = <T,>(): EstadoOpciones<T> => ({ estado: "esperando", items: [], error: "" });
const cargando = <T,>(): EstadoOpciones<T> => ({ estado: "cargando", items: [], error: "" });

async function pedirOpciones<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const respuesta = await fetchAutenticado(url, { cache: "no-store", signal });
  const valor = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !Array.isArray(valor?.data?.items)) {
    throw new Error(valor?.error?.message ?? texto("ui.turnos.solicitar.errorOpciones"));
  }
  return valor.data.items as T[];
}

function fechaBreve(fecha: string) {
  const texto = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit",
  }).format(new Date(`${fecha}T00:00:00.000Z`)).replace(/[.,]/g, "");
  return texto.charAt(0).toLocaleUpperCase("es-AR") + texto.slice(1);
}

function cantidadTurnos(cantidad: number) {
  return texto(cantidad === 1 ? "ui.turnos.solicitar.claseConLugar" : "ui.turnos.solicitar.clasesConLugar", { cantidad });
}

function cantidadHorarios(cantidad: number) {
  return texto(cantidad === 1 ? "ui.turnos.solicitar.horarioConLugar" : "ui.turnos.solicitar.horariosConLugar", { cantidad });
}

function Opcion({ name, value, checked, onChange, children, detalle, lateral }: {
  name: string; value: string; checked: boolean; onChange: () => void; children: ReactNode; detalle?: string; lateral?: string;
}) {
  return (
    <label className={cn(
      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent",
      "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
      checked ? "border-primary bg-accent" : "border-border bg-card",
    )}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{children}</span>
        {detalle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detalle}</span>}
      </span>
      {lateral && <span className="shrink-0 text-xs font-semibold text-success-foreground">{lateral}</span>}
    </label>
  );
}

function EstadoLista<T>({ opciones, sinResultados, reintentar }: {
  opciones: EstadoOpciones<T>; sinResultados: string; reintentar: () => void;
}) {
  if (opciones.estado === "esperando") return <p className="text-sm text-muted-foreground">{sinResultados}</p>;
  if (opciones.estado === "cargando") return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> {texto("ui.turnos.solicitar.cargando")}</p>;
  if (opciones.estado === "error") return (
    <div role="alert" className="space-y-2 text-sm">
      <p className="text-destructive">{opciones.error}</p>
      <Button type="button" variant="outline" size="sm" onClick={reintentar}>{texto("ui.turnos.solicitar.reintentar")}</Button>
    </div>
  );
  if (opciones.items.length === 0) return <p className="text-sm text-muted-foreground">{texto("ui.turnos.solicitar.vacio")}</p>;
  return null;
}

export function SolicitarTurno() {
  const router = useRouter();
  const [materiaId, setMateriaId] = useState("");
  const [profesorId, setProfesorId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [materias, setMaterias] = useState<EstadoOpciones<Materia>>(cargando());
  const [profesores, setProfesores] = useState<EstadoOpciones<Profesor>>(esperando());
  const [horarios, setHorarios] = useState<EstadoOpciones<Horario>>(esperando());
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [resumenInscripcion, setResumenInscripcion] = useState<ResumenInscripcion | null>(null);
  const resumenController = useRef<AbortController | null>(null);
  const envioRef = useRef<Promise<void> | null>(null);
  const reservaConfirmadaRef = useRef<string | null>(null);
  const navegandoRef = useRef(false);
  const resultadoRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void pedirOpciones<Materia>("/api/turnos/inscripcion/opciones", controller.signal)
      .then((items) => { if (!controller.signal.aborted) setMaterias({ estado: "listo", items, error: "" }); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setMaterias({ estado: "error", items: [], error: e instanceof Error ? e.message : texto("ui.turnos.solicitar.errorMaterias") }); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!materiaId) return;
    const controller = new AbortController();
    void pedirOpciones<Profesor>(`/api/turnos/inscripcion/opciones?materia_id=${encodeURIComponent(materiaId)}`, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setProfesores({ estado: "listo", items, error: "" }); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setProfesores({ estado: "error", items: [], error: e instanceof Error ? e.message : texto("ui.turnos.solicitar.errorProfesores") }); });
    return () => controller.abort();
  }, [materiaId, revision]);

  useEffect(() => {
    if (!materiaId || !profesorId) return;
    const controller = new AbortController();
    void pedirOpciones<Horario>(`/api/turnos/inscripcion/opciones?materia_id=${encodeURIComponent(materiaId)}&profesor_id=${encodeURIComponent(profesorId)}`, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setHorarios({ estado: "listo", items, error: "" }); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setHorarios({ estado: "error", items: [], error: e instanceof Error ? e.message : texto("ui.turnos.solicitar.errorHorarios") }); });
    return () => controller.abort();
  }, [materiaId, profesorId, revision]);

  useEffect(() => {
    if (!error) return;
    resultadoRef.current?.closest("main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    resultadoRef.current?.focus({ preventScroll: true });
  }, [error]);

  useEffect(() => () => { resumenController.current?.abort(); }, []);

  function cancelar() {
    if (resumenController.current || resumenInscripcion) return;
    setMateriaId(""); setProfesorId(""); setTurnoId("");
    setMaterias(cargando()); setProfesores(esperando()); setHorarios(esperando());
    setError(""); setRevision((actual) => actual + 1);
  }

  function elegirMateria(id: string) {
    if (resumenController.current || resumenInscripcion) return;
    setMateriaId(id); setProfesorId(""); setTurnoId("");
    setProfesores(cargando()); setHorarios(esperando()); setError("");
  }

  function elegirProfesor(id: string) {
    if (resumenController.current || resumenInscripcion) return;
    setProfesorId(id); setTurnoId(""); setHorarios(cargando()); setError("");
  }

  async function inscribirse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnoId || resumenController.current || resumenInscripcion) return;
    const controller = new AbortController();
    resumenController.current = controller;
    setCargandoResumen(true); setError("");
    try {
      const data = await fetchOLanzar(`/api/turnos/${encodeURIComponent(turnoId)}/inscripcion/resumen`, { cache: "no-store", signal: controller.signal }) as ResumenInscripcion;
      if (!controller.signal.aborted && resumenController.current === controller) setResumenInscripcion(data);
    } catch (causa) {
      if (!controller.signal.aborted) setError(causa instanceof Error && !(causa instanceof TypeError) ? causa.message : texto("ui.turnos.resumen.error"));
    } finally {
      if (!controller.signal.aborted && resumenController.current === controller) {
        resumenController.current = null;
        setCargandoResumen(false);
      }
    }
  }

  function confirmarReserva(): Promise<void> {
    if (envioRef.current) return envioRef.current;
    if (!resumenInscripcion) return Promise.resolve();
    envioRef.current = fetchOLanzar(`/api/turnos/${encodeURIComponent(resumenInscripcion.turno_id)}/inscripcion`, { method: "POST", cache: "no-store" })
      .then((data) => {
        const inscripcion = (data as { inscripcion: { id: string } }).inscripcion;
        reservaConfirmadaRef.current = inscripcion.id;
      })
      .catch((causa: unknown) => { throw causa instanceof Error && !(causa instanceof TypeError) ? causa : new Error(texto("ui.turnos.resumen.errorConfirmacion")); })
      .finally(() => { envioRef.current = null; });
    return envioRef.current;
  }

  const materia = materias.items.find((item) => item.id === materiaId);
  const profesor = profesores.items.find((item) => item.id === profesorId);
  const horario = horarios.items.find((item) => item.turno_id === turnoId);
  const resumen = materia && profesor && horario
    ? `${materia.nombre} · ${profesor.nombre} · ${fechaBreve(horario.fecha)}, ${horario.hora_inicio}–${horario.hora_fin} · ${horario.aula}`
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <nav aria-label={texto("ui.turnos.solicitar.miga")} className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/alumno" className="font-medium text-primary underline-offset-4 hover:underline">{texto("ui.turnos.solicitar.misClases")}</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{texto("ui.turnos.solicitar.titulo")}</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{texto("ui.turnos.solicitar.titulo")}</h1>
        <p className="text-muted-foreground">{texto("ui.turnos.solicitar.descripcion")}</p>
      </header>

      {error && <p ref={resultadoRef} role="alert" tabIndex={-1} className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">{error}</p>}

      <form onSubmit={inscribirse} className="space-y-5">
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <fieldset disabled={cargandoResumen || !!resumenInscripcion} className="min-w-0 rounded-xl border border-border bg-card p-5">
            <legend className="sr-only">{texto("ui.turnos.solicitar.materia")}</legend>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{texto("ui.turnos.solicitar.pasoMateria")}</h2>
            <div className="max-h-[30rem] min-h-24 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              <EstadoLista opciones={materias} sinResultados={texto("ui.turnos.solicitar.cargandoMaterias")} reintentar={() => { setMaterias(cargando()); setRevision((actual) => actual + 1); }} />
              {materias.items.map((item) => <Opcion key={item.id} name="materia" value={item.id} checked={materiaId === item.id} onChange={() => elegirMateria(item.id)} detalle={cantidadTurnos(item.turnos_con_lugar)}>{item.nombre}</Opcion>)}
            </div>
          </fieldset>

          <fieldset disabled={cargandoResumen || !!resumenInscripcion} className="min-w-0 rounded-xl border border-border bg-card p-5">
            <legend className="sr-only">{texto("ui.turnos.solicitar.profesor")}</legend>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{texto("ui.turnos.solicitar.pasoProfesor")}</h2>
            <div className="max-h-[30rem] min-h-24 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              <EstadoLista opciones={profesores} sinResultados={texto("ui.turnos.solicitar.elegirMateria")} reintentar={() => { setProfesores(cargando()); setRevision((actual) => actual + 1); }} />
              {profesores.items.map((item) => <Opcion key={item.id} name="profesor" value={item.id} checked={profesorId === item.id} onChange={() => elegirProfesor(item.id)} detalle={cantidadHorarios(item.turnos_con_lugar)}>{item.nombre}</Opcion>)}
            </div>
          </fieldset>

          <fieldset disabled={cargandoResumen || !!resumenInscripcion} className="min-w-0 rounded-xl border border-border bg-card p-5">
            <legend className="sr-only">{texto("ui.turnos.solicitar.horario")}</legend>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{texto("ui.turnos.solicitar.pasoHorario")}</h2>
            <div className="max-h-[30rem] min-h-24 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              <EstadoLista opciones={horarios} sinResultados={texto("ui.turnos.solicitar.elegirProfesor")} reintentar={() => { setHorarios(cargando()); setRevision((actual) => actual + 1); }} />
              {horarios.items.map((item) => <Opcion key={item.turno_id} name="horario" value={item.turno_id} checked={turnoId === item.turno_id} onChange={() => { if (!resumenController.current && !resumenInscripcion) { setTurnoId(item.turno_id); setError(""); } }} detalle={item.aula} lateral={texto(item.cupos_libres === 1 ? "ui.turnos.solicitar.lugar" : "ui.turnos.solicitar.lugares", { cantidad: item.cupos_libres })}>
                {fechaBreve(item.fecha)} · {item.hora_inicio}–{item.hora_fin}
              </Opcion>)}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{texto("ui.turnos.solicitar.eleccion")}</p>
            {resumen ? (
              <p className="flex items-start gap-2 text-sm font-semibold text-foreground"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{resumen}</p>
            ) : <p className="text-sm text-muted-foreground">{texto("ui.turnos.solicitar.sinHorario")}</p>}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" size="lg" onClick={cancelar} disabled={cargandoResumen || !!resumenInscripcion}>{texto("ui.turnos.solicitar.cancelar")}</Button>
            <Button type="submit" size="lg" disabled={!horario || cargandoResumen || !!resumenInscripcion} aria-busy={cargandoResumen}>
              {cargandoResumen && <Loader2 className="size-4 animate-spin" aria-hidden />}{texto(cargandoResumen ? "ui.turnos.resumen.cargando" : "ui.turnos.solicitar.inscribirme")}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmarAccionDialog
        abierto={!!resumenInscripcion}
        titulo={resumenInscripcion ? texto("ui.turnos.resumen.titulo", {
          materia: resumenInscripcion.materia.nombre,
          dia: fechaLarga(resumenInscripcion.fecha).toLocaleLowerCase("es-AR"),
          hora: resumenInscripcion.hora_inicio,
        }) : ""}
        textoConfirmar={texto("ui.turnos.resumen.confirmar")}
        onCerrar={() => setResumenInscripcion(null)}
        onConfirmar={confirmarReserva}
        onExito={() => { if (!navegandoRef.current) { navegandoRef.current = true; router.push(`/alumno?inscripcion=exitosa&reserva=${encodeURIComponent(reservaConfirmadaRef.current!)}`); } }}
        detalle={resumenInscripcion && <div className="space-y-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt>{texto("ui.turnos.solicitar.materia")}</dt><dd className="font-medium text-foreground">{resumenInscripcion.materia.nombre}</dd>
            <dt>{texto("ui.turnos.solicitar.profesor")}</dt><dd>{resumenInscripcion.profesor.nombre_para_mostrar}</dd>
            <dt>{texto("ui.turnos.resumen.fecha")}</dt><dd>{fechaLarga(resumenInscripcion.fecha)}</dd>
            <dt>{texto("ui.turnos.solicitar.horario")}</dt><dd>{resumenInscripcion.hora_inicio}–{resumenInscripcion.hora_fin}</dd>
            <dt>{texto("ui.turnos.resumen.duracion")}</dt><dd>{texto("ui.turnos.resumen.minutos", { cantidad: resumenInscripcion.duracion_min })}</dd>
            <dt>{texto("ui.turnos.resumen.aula")}</dt><dd>{resumenInscripcion.aula.nombre}</dd>
            <dt>{texto("ui.turnos.resumen.lugares")}</dt><dd>{resumenInscripcion.lugares_disponibles}</dd>
            <dt>{texto("ui.turnos.resumen.precio")}</dt><dd className="font-semibold text-foreground">{formatearMonto(resumenInscripcion.precio)}</dd>
          </dl>
          <p>{texto("ui.turnos.resumen.precioFijo")}</p>
          {resumenInscripcion.vence_pago_el && <p>{texto("ui.turnos.reserva.plazo", {
            vencimiento: texto("ui.turnos.reserva.fechaHora", {
              dia: fechaLarga(resumenInscripcion.vence_pago_el.slice(0, 10)).toLocaleLowerCase("es-AR"),
              hora: resumenInscripcion.vence_pago_el.slice(11, 16),
            }),
          })}</p>}
        </div>}
      />
    </div>
  );
}
