"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, ChevronLeft, GraduationCap, Loader2, Mail, Phone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { ResumenSemanalHorarios } from "@/components/shared/resumen-semanal-horarios";
import { StepperAltaProfesor } from "@/components/shared/stepper-alta-profesor";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { ParametrosHorarioOperativo } from "@/lib/horario-atencion";
import type { DetalleProfesor, MateriaDeProfesor } from "@/types/profesor.types";
import { NuevoProfesorForm } from "./nuevo/nuevo-profesor-form";
import { ContactoProfesorForm } from "./[id]/contacto/contacto-profesor-form";
import { AsociarMateriasForm, type OpcionMateria } from "./[id]/materias/asociar-materias-form";
import { RegistrarHorarioForm } from "./horarios/nuevo/registrar-horario-form";

type Vista = { tipo: "detalle" | "contacto" | "materias" | "horario"; id: string; alta?: boolean } | { tipo: "nuevo" } | null;
type DetalleApi = Omit<DetalleProfesor, "fechaNacimiento" | "fechaAlta"> & { fechaNacimiento: string; fechaAlta: string };
type Contexto = { abrirDetalle: (id: string) => void; abrirNuevo: () => void };
const ContextoModal = createContext<Contexto | null>(null);

function useModal() {
  const contexto = useContext(ContextoModal);
  if (!contexto) throw new Error("Los controles de profesor requieren ProfesoresModales");
  return contexto;
}

export function AbrirProfesor({ id, nombre }: { id: string; nombre: string }) {
  const { abrirDetalle } = useModal();
  return <button type="button" onClick={() => abrirDetalle(id)} aria-label={`Ver ficha de ${nombre}`} className="font-medium text-left text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">{nombre}</button>;
}

export function AbrirNuevoProfesor() {
  const { abrirNuevo } = useModal();
  return <button type="button" onClick={abrirNuevo} className={buttonVariants({ size: "sm" })}><GraduationCap className="size-4" aria-hidden />Nuevo profesor</button>;
}

function fecha(fechaISO: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(fechaISO));
}

const genero: Record<NonNullable<DetalleProfesor["genero"]>, string> = {
  MASCULINO: "Masculino", FEMENINO: "Femenino", OTRO: "Otro", PREFIERO_NO_INDICARLO: "Prefiere no indicarlo",
};

export function ProfesoresModales({
  children, puedeCrear, puedeEditar, dniLongitudMin, dniLongitudMax, fechaMaximaNacimiento, materiasActivas, parametrosHorario,
}: {
  children: ReactNode;
  puedeCrear: boolean;
  puedeEditar: boolean;
  dniLongitudMin: number;
  dniLongitudMax: number;
  fechaMaximaNacimiento: string;
  materiasActivas: MateriaDeProfesor[];
  parametrosHorario: ParametrosHorarioOperativo;
}) {
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const [vista, setVista] = useState<Vista>(null);
  const [detalle, setDetalle] = useState<DetalleApi | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [destinoDescarte, setDestinoDescarte] = useState<"cerrar" | "ficha" | null>(null);

  useEffect(() => {
    if (!vista || vista.tipo === "nuevo") return;
    const controller = new AbortController();
    const id = vista.id;
    fetchAutenticado(`/api/profesores/${encodeURIComponent(id)}/ficha`, { cache: "no-store", signal: controller.signal })
      .then(async (respuesta) => {
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.data) throw new Error(resultado.error?.message ?? "No se pudo cargar la ficha");
        if (!controller.signal.aborted) setDetalle(resultado.data);
      })
      .catch((fallo: unknown) => { if (!controller.signal.aborted) setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la ficha"); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [vista, recarga]);

  function abrirDetalle(id: string) {
    setDetalle(null); setError(""); setCargando(true); setVista({ tipo: "detalle", id });
  }
  function abrirNuevo() {
    if (!puedeCrear) return;
    setDetalle(null); setError(""); setVista({ tipo: "nuevo" });
  }
  function cerrar() { setVista(null); setDetalle(null); setDirty(false); setDestinoDescarte(null); }
  function solicitarCerrar() { if (dirty) setDestinoDescarte("cerrar"); else cerrar(); }
  function volverAFicha() { if (vista && vista.tipo !== "nuevo") { setDirty(false); setVista({ tipo: "detalle", id: vista.id }); setRecarga((n) => n + 1); } else cerrar(); }
  function solicitarVolverAFicha() { if (dirty) setDestinoDescarte("ficha"); else volverAFicha(); }
  function actualizarFicha() { setRecarga((n) => n + 1); router.refresh(); }

  const opcionesMaterias: OpcionMateria[] = detalle ? [
    ...materiasActivas.map((materia) => ({ ...materia, asociada: detalle.materias.some((asociada) => asociada.id === materia.id) })),
    ...detalle.materias.filter((materia) => !materia.activa).map((materia) => ({ ...materia, asociada: true })),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) : [];
  const titulo = vista?.tipo === "nuevo" ? "Nuevo profesor" : vista?.tipo === "contacto" ? "Datos de contacto" : vista?.tipo === "materias" ? "Materias del profesor" : vista?.tipo === "horario" ? "Horario de atención" : detalle ? `${detalle.apellido}, ${detalle.nombre}` : "Ficha del profesor";

  return <ContextoModal.Provider value={{ abrirDetalle, abrirNuevo }}>
    {children}
    <Dialog.Root open={vista !== null} onOpenChange={(abierto) => { if (!abierto) solicitarCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0"><Dialog.Title className="break-words text-xl font-semibold tracking-tight">{titulo}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{vista?.tipo === "nuevo" ? "Completá los datos para registrar al profesor." : detalle ? `DNI ${detalle.dni}` : "Información del profesor"}</Dialog.Description></div>
            <Dialog.Close aria-label="Cerrar ventana" className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" aria-hidden /></Dialog.Close>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {vista?.tipo === "nuevo" ? <div className="space-y-5"><StepperAltaProfesor paso={1} /><NuevoProfesorForm dniLongitudMin={dniLongitudMin} dniLongitudMax={dniLongitudMax} fechaMaximaNacimiento={fechaMaximaNacimiento} onCancelar={cerrar} onCreado={(id) => { actualizarFicha(); setVista({ tipo: "materias", id, alta: true }); setCargando(true); }} /></div> :
              error ? <div role="alert" className="space-y-3 py-8 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => { setError(""); setCargando(true); setRecarga((n) => n + 1); }}>Reintentar</Button></div> :
              cargando || !detalle ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Cargando ficha…</p> :
              vista?.tipo === "detalle" ? <FichaModal profesor={detalle} puedeEditar={puedeEditar} onContacto={() => setVista({ tipo: "contacto", id: detalle.id })} onMaterias={() => setVista({ tipo: "materias", id: detalle.id })} onHorario={() => setVista({ tipo: "horario", id: detalle.id })} /> :
              vista?.tipo === "contacto" ? <div className="space-y-5"><VolverFicha onClick={solicitarVolverAFicha} /><ContactoProfesorForm profesorId={detalle.id} telefonoActual={detalle.telefono} emailActual={detalle.email} onCancelar={volverAFicha} onGuardado={volverAFicha} /></div> :
              vista?.tipo === "materias" ? <div className="space-y-5">{vista.alta ? <StepperAltaProfesor paso={2} /> : <VolverFicha onClick={solicitarVolverAFicha} />}<AsociarMateriasForm profesorId={detalle.id} opciones={opcionesMaterias} modoAlta={vista.alta} onCancelar={volverAFicha} onGuardado={volverAFicha} onAvanzar={() => { setDirty(false); setVista({ tipo: "horario", id: detalle.id, alta: true }); }} /></div> :
              vista?.tipo === "horario" ? <div className="space-y-5">{vista.alta ? <StepperAltaProfesor paso={3} /> : <VolverFicha onClick={solicitarVolverAFicha} />}<p className="text-sm text-muted-foreground">El intervalo se repite todas las semanas. Horario operativo: {parametrosHorario.apertura} a {parametrosHorario.cierre}.</p><RegistrarHorarioForm key={detalle.id} profesores={[{ id: detalle.id, nombre: detalle.nombre, apellido: detalle.apellido, dni: detalle.dni }]} profesorIdInicial={detalle.id} parametros={parametrosHorario} modoAlta={vista.alta} cantidadHorarios={detalle.horarios.length} fijarProfesor onCancelar={volverAFicha} onGuardado={actualizarFicha} /><div className="rounded-xl border border-border p-4"><h3 className="mb-3 font-semibold">Horario semanal</h3><ResumenSemanalHorarios horarios={detalle.horarios} /></div></div> : null}
          </div>
          {vista?.tipo === "detalle" && detalle && <footer className="flex shrink-0 justify-end border-t border-border px-5 py-3 sm:px-7"><Button variant="outline" size="sm" onClick={cerrar}>Cerrar</Button></footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmarDescarteDialog abierto={destinoDescarte !== null} onAbiertoChange={(abierto) => { if (!abierto) setDestinoDescarte(null); }} onConfirmar={() => { if (destinoDescarte === "ficha") volverAFicha(); else cerrar(); }} />
  </ContextoModal.Provider>;
}

function VolverFicha({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"><ChevronLeft className="size-4" aria-hidden />Volver a la ficha</button>; }

function FichaModal({ profesor, puedeEditar, onContacto, onMaterias, onHorario }: { profesor: DetalleApi; puedeEditar: boolean; onContacto: () => void; onMaterias: () => void; onHorario: () => void }) {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold">{profesor.apellido}, {profesor.nombre}</h3><Badge variant={profesor.activo ? "success" : "muted"}>{profesor.activo ? "Activo" : "Inactivo"}</Badge></div>
    <section className="space-y-4 rounded-xl bg-muted/45 p-5"><h4 className="font-semibold">Datos personales</h4><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2"><Dato etiqueta="DNI" valor={profesor.dni} /><Dato etiqueta="Fecha de nacimiento" valor={fecha(profesor.fechaNacimiento)} /><Dato etiqueta="Género" valor={profesor.genero ? genero[profesor.genero] : "—"} /><Dato etiqueta="Fecha de alta" valor={fecha(profesor.fechaAlta)} /></dl></section>
    <section className="space-y-4 border-b border-border pb-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Contacto</h4>{puedeEditar && <Button variant="outline" size="sm" onClick={onContacto}>Editar contacto</Button>}</div><dl className="grid gap-4 sm:grid-cols-2"><Dato etiqueta="Teléfono" valor={profesor.telefono ?? "—"} icono={<Phone className="size-4" />} /><Dato etiqueta="Email" valor={profesor.email ?? "—"} icono={<Mail className="size-4" />} /></dl></section>
    <section className="space-y-3 border-b border-border pb-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Materias</h4>{puedeEditar && profesor.activo && <Button variant="outline" size="sm" onClick={onMaterias}>Asociar materias</Button>}</div>{profesor.materias.length ? <ul className="flex flex-wrap gap-2">{profesor.materias.map((materia) => <li key={materia.id} className="rounded-md bg-muted px-2.5 py-1.5 text-sm">{materia.nombre}{materia.codigo && <span className="text-muted-foreground"> ({materia.codigo})</span>}{!materia.activa && <span className="ml-1 text-muted-foreground">· Inactiva</span>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Sin materias asociadas.</p>}</section>
    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-primary" aria-hidden />Horario de atención</h4>{puedeEditar && profesor.activo && <Button variant="outline" size="sm" onClick={onHorario}>Editar horario</Button>}</div><ResumenSemanalHorarios horarios={profesor.horarios} /></section>
  </div>;
}

function Dato({ etiqueta, valor, icono }: { etiqueta: string; valor: string; icono?: ReactNode }) { return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{etiqueta}</dt><dd className="mt-1 flex items-center gap-2 break-words text-sm font-medium">{icono && <span className="shrink-0 text-primary" aria-hidden>{icono}</span>}{valor}</dd></div>; }
