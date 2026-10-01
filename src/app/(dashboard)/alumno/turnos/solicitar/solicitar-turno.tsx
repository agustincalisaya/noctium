"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
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
    throw new Error(valor?.error?.message ?? "No se pudieron cargar las opciones");
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
  return `${cantidad} ${cantidad === 1 ? "turno con lugar" : "turnos con lugar"}`;
}

function cantidadHorarios(cantidad: number) {
  return `${cantidad} ${cantidad === 1 ? "horario con lugar" : "horarios con lugar"}`;
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
  if (opciones.estado === "cargando") return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Cargando opciones…</p>;
  if (opciones.estado === "error") return (
    <div role="alert" className="space-y-2 text-sm">
      <p className="text-destructive">{opciones.error}</p>
      <Button type="button" variant="outline" size="sm" onClick={reintentar}>Reintentar</Button>
    </div>
  );
  if (opciones.items.length === 0) return <p className="text-sm text-muted-foreground">No hay turnos disponibles para esta combinación. Elegí otra materia o profesor.</p>;
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
  const [inscribiendo, setInscribiendo] = useState(false);
  const resultadoRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void pedirOpciones<Materia>("/api/turnos/inscripcion/opciones", controller.signal)
      .then((items) => setMaterias({ estado: "listo", items, error: "" }))
      .catch((e: unknown) => { if (!controller.signal.aborted) setMaterias({ estado: "error", items: [], error: e instanceof Error ? e.message : "No se pudieron cargar las materias" }); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!materiaId) return;
    const controller = new AbortController();
    void pedirOpciones<Profesor>(`/api/turnos/inscripcion/opciones?materia_id=${encodeURIComponent(materiaId)}`, controller.signal)
      .then((items) => setProfesores({ estado: "listo", items, error: "" }))
      .catch((e: unknown) => { if (!controller.signal.aborted) setProfesores({ estado: "error", items: [], error: e instanceof Error ? e.message : "No se pudieron cargar los profesores" }); });
    return () => controller.abort();
  }, [materiaId, revision]);

  useEffect(() => {
    if (!materiaId || !profesorId) return;
    const controller = new AbortController();
    void pedirOpciones<Horario>(`/api/turnos/inscripcion/opciones?materia_id=${encodeURIComponent(materiaId)}&profesor_id=${encodeURIComponent(profesorId)}`, controller.signal)
      .then((items) => setHorarios({ estado: "listo", items, error: "" }))
      .catch((e: unknown) => { if (!controller.signal.aborted) setHorarios({ estado: "error", items: [], error: e instanceof Error ? e.message : "No se pudieron cargar los horarios" }); });
    return () => controller.abort();
  }, [materiaId, profesorId, revision]);

  useEffect(() => {
    if (!error) return;
    resultadoRef.current?.closest("main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    resultadoRef.current?.focus({ preventScroll: true });
  }, [error]);

  function cancelar() {
    setMateriaId(""); setProfesorId(""); setTurnoId("");
    setMaterias(cargando()); setProfesores(esperando()); setHorarios(esperando());
    setError(""); setRevision((actual) => actual + 1);
  }

  function elegirMateria(id: string) {
    setMateriaId(id); setProfesorId(""); setTurnoId("");
    setProfesores(cargando()); setHorarios(esperando()); setError("");
  }

  function elegirProfesor(id: string) {
    setProfesorId(id); setTurnoId(""); setHorarios(cargando()); setError("");
  }

  async function inscribirse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnoId || inscribiendo) return;
    setInscribiendo(true); setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turnoId)}/inscripcion`, { method: "POST", cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setError(valor?.error?.message ?? "No pudimos completar la inscripción. Volvé a intentarlo.");
        setTurnoId(""); setHorarios(cargando()); setRevision((actual) => actual + 1);
        return;
      }
      router.push("/alumno?inscripcion=exitosa");
    } catch {
      setError("No pudimos completar la inscripción. Revisá tu conexión y volvé a intentarlo.");
    } finally {
      setInscribiendo(false);
    }
  }

  const materia = materias.items.find((item) => item.id === materiaId);
  const profesor = profesores.items.find((item) => item.id === profesorId);
  const horario = horarios.items.find((item) => item.turno_id === turnoId);
  const resumen = materia && profesor && horario
    ? `${materia.nombre} · ${profesor.nombre} · ${fechaBreve(horario.fecha)}, ${horario.hora_inicio}–${horario.hora_fin} · ${horario.aula}`
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <nav aria-label="Miga de pan" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/alumno" className="font-medium text-primary underline-offset-4 hover:underline">Mis turnos</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">Solicitar turno</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Solicitar turno</h1>
        <p className="text-muted-foreground">Elegí entre los turnos Disponibles que ya existen. El aula viene asignada con el turno.</p>
      </header>

      {error && <p ref={resultadoRef} role="alert" tabIndex={-1} className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">{error}</p>}

      <form onSubmit={inscribirse} className="space-y-5">
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <fieldset className="min-w-0 rounded-xl border border-border bg-card p-5">
            <legend className="sr-only">Materia</legend>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 · Materia</h2>
            <div className="max-h-[30rem] min-h-24 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              <EstadoLista opciones={materias} sinResultados="Cargando materias disponibles…" reintentar={() => { setMaterias(cargando()); setRevision((actual) => actual + 1); }} />
              {materias.items.map((item) => <Opcion key={item.id} name="materia" value={item.id} checked={materiaId === item.id} onChange={() => elegirMateria(item.id)} detalle={cantidadTurnos(item.turnos_con_lugar)}>{item.nombre}</Opcion>)}
            </div>
          </fieldset>

          <fieldset className="min-w-0 rounded-xl border border-border bg-card p-5">
            <legend className="sr-only">Profesor</legend>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">2 · Profesor</h2>
            <div className="max-h-[30rem] min-h-24 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              <EstadoLista opciones={profesores} sinResultados="Primero elegí la materia." reintentar={() => { setProfesores(cargando()); setRevision((actual) => actual + 1); }} />
              {profesores.items.map((item) => <Opcion key={item.id} name="profesor" value={item.id} checked={profesorId === item.id} onChange={() => elegirProfesor(item.id)} detalle={cantidadHorarios(item.turnos_con_lugar)}>{item.nombre}</Opcion>)}
            </div>
          </fieldset>

          <fieldset className="min-w-0 rounded-xl border border-border bg-card p-5">
            <legend className="sr-only">Horario</legend>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Horario</h2>
            <div className="max-h-[30rem] min-h-24 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              <EstadoLista opciones={horarios} sinResultados="Primero elegí el profesor." reintentar={() => { setHorarios(cargando()); setRevision((actual) => actual + 1); }} />
              {horarios.items.map((item) => <Opcion key={item.turno_id} name="horario" value={item.turno_id} checked={turnoId === item.turno_id} onChange={() => { setTurnoId(item.turno_id); setError(""); }} detalle={item.aula} lateral={`${item.cupos_libres} ${item.cupos_libres === 1 ? "lugar" : "lugares"}`}>
                {fechaBreve(item.fecha)} · {item.hora_inicio}–{item.hora_fin}
              </Opcion>)}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu elección</p>
            {resumen ? (
              <p className="flex items-start gap-2 text-sm font-semibold text-foreground"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{resumen}</p>
            ) : <p className="text-sm text-muted-foreground">Todavía no elegiste un horario.</p>}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" size="lg" onClick={cancelar} disabled={inscribiendo}>Cancelar</Button>
            <Button type="submit" size="lg" disabled={!horario || inscribiendo} aria-busy={inscribiendo}>
              {inscribiendo && <Loader2 className="size-4 animate-spin" aria-hidden />}{inscribiendo ? "Inscribiendo…" : "Inscribirme"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
