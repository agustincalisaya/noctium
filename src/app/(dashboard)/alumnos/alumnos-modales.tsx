"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, GraduationCap, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { DetalleAlumno } from "@/types/alumno.types";
import { AlumnoForm } from "./nueva/alumno-form";
import { EditarAlumnoForm } from "./[id]/editar/editar-alumno-form";
import { ContactoAlumnoForm } from "./[id]/contacto/contacto-alumno-form";
import { FormaPagoForm } from "./[id]/forma-pago/forma-pago-form";

type Vista = { tipo: "ficha" | "editar" | "contacto" | "pago"; id: string } | { tipo: "nuevo" } | null;
type Destino = "cerrar" | "ficha";
type Contexto = { abrirFicha: (id: string) => void; abrirNuevo: () => void };
const ContextoModal = createContext<Contexto | null>(null);

function useModalAlumno() {
  const contexto = useContext(ContextoModal);
  if (!contexto) throw new Error("Los controles de alumnos requieren AlumnosModales");
  return contexto;
}

export function AbrirAlumno({ id, nombre }: { id: string; nombre: string }) {
  const { abrirFicha } = useModalAlumno();
  return <button type="button" onClick={() => abrirFicha(id)} className="text-left font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" aria-label={`Ver ficha de ${nombre}`}>{nombre}</button>;
}

export function AbrirNuevoAlumno({ compacto = false }: { compacto?: boolean }) {
  const { abrirNuevo } = useModalAlumno();
  return <button type="button" onClick={abrirNuevo} className={compacto ? "text-sm font-medium text-primary underline underline-offset-4" : buttonVariants({ size: "sm" })}><GraduationCap className="mr-2 size-4" aria-hidden />Nuevo alumno</button>;
}

function fecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function AlumnosModales({ children, puedeCrear, puedeEditar, dniLongitudMin, dniLongitudMax, formasPagoActivas }: {
  children: ReactNode;
  puedeCrear: boolean;
  puedeEditar: boolean;
  dniLongitudMin: number;
  dniLongitudMax: number;
  formasPagoActivas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const [vista, setVista] = useState<Vista>(null);
  const [alumno, setAlumno] = useState<DetalleAlumno | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [destinoDescarte, setDestinoDescarte] = useState<Destino | null>(null);
  const [avisoAlta, setAvisoAlta] = useState("");

  useEffect(() => {
    if (!vista || vista.tipo === "nuevo") return;
    const controller = new AbortController();
    fetchAutenticado(`/api/alumnos/${encodeURIComponent(vista.id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (respuesta) => {
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.data) throw new Error(resultado.error?.message ?? "No se pudo cargar la ficha");
        if (!controller.signal.aborted) setAlumno(resultado.data);
      })
      .catch((fallo: unknown) => { if (!controller.signal.aborted) setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la ficha"); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [vista, recarga]);

  function abrirFicha(id: string) { setAlumno(null); setError(""); setCargando(true); setVista({ tipo: "ficha", id }); }
  function abrirNuevo() { if (puedeCrear) { setAvisoAlta(""); setVista({ tipo: "nuevo" }); } }
  function cerrar() { setVista(null); setAlumno(null); setDirty(false); setDestinoDescarte(null); }
  function volverFicha() { if (vista && vista.tipo !== "nuevo") { setDirty(false); setCargando(true); setVista({ tipo: "ficha", id: vista.id }); setRecarga((n) => n + 1); router.refresh(); } else cerrar(); }
  function solicitarSalida(destino: Destino) { if (dirty) setDestinoDescarte(destino); else if (destino === "ficha") volverFicha(); else cerrar(); }
  function editar(tipo: "editar" | "contacto" | "pago") { if (alumno && puedeEditar) { setCargando(true); setVista({ tipo, id: alumno.id }); } }

  const titulo = vista?.tipo === "nuevo" ? "Nuevo alumno" : vista?.tipo === "editar" ? "Modificar datos del alumno" : vista?.tipo === "contacto" ? "Datos de contacto" : vista?.tipo === "pago" ? "Forma de pago preferida" : alumno ? `${alumno.apellido}, ${alumno.nombre}` : "Ficha del alumno";
  return <ContextoModal.Provider value={{ abrirFicha, abrirNuevo }}>
    {children}
    <Dialog.Root open={vista !== null} onOpenChange={(abierto) => { if (!abierto) solicitarSalida("cerrar"); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0"><Dialog.Title className="break-words text-xl font-semibold">{titulo}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{vista?.tipo === "nuevo" ? "Registrá los datos de identidad y, si los tenés, de contacto del alumno." : alumno ? `DNI ${alumno.dni}` : "Información del alumno"}</Dialog.Description></div>
            <Dialog.Close aria-label="Cerrar ventana" className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" aria-hidden /></Dialog.Close>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {vista?.tipo === "nuevo" ? <div className="mx-auto max-w-xl"><AlumnoForm dniLongitudMin={dniLongitudMin} dniLongitudMax={dniLongitudMax} onCancelar={cerrar} onCreado={(id, contacto) => { setDirty(false); router.refresh(); if (contacto !== "sin_cargar" && contacto !== "guardado") setAvisoAlta(contacto.error === "EMAIL_YA_ASOCIADO" ? "Alumno registrado. El email ya está asociado a otra cuenta; podés cargar el contacto desde la ficha." : "Alumno registrado. Los datos de contacto no se guardaron; podés cargarlos desde la ficha."); else setAvisoAlta("Alumno registrado correctamente"); abrirFicha(id); }} /></div> :
              error ? <div role="alert" className="space-y-3 py-8 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => { setError(""); setCargando(true); setRecarga((n) => n + 1); }}>Reintentar</Button></div> :
              cargando || !alumno ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Cargando ficha…</p> :
              vista?.tipo === "ficha" ? <div className="space-y-5">{avisoAlta && <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">{avisoAlta}</p>}<div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold">{alumno.apellido}, {alumno.nombre}</h3><Badge variant={alumno.is_active ? "success" : "muted"}>{alumno.is_active ? "Activo" : "Inactivo"}</Badge></div>{puedeEditar && <button type="button" onClick={() => editar("editar")} className="text-sm text-primary underline underline-offset-4">Modificar datos</button>}<section className="space-y-4 rounded-xl border border-border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Datos de contacto</h4>{puedeEditar && <Button variant="outline" size="sm" onClick={() => editar("contacto")}>{alumno.telefono || alumno.email ? "Editar contacto" : "Cargar contacto"}</Button>}</div><dl className="grid gap-4 sm:grid-cols-2"><Dato etiqueta="Teléfono" valor={alumno.telefono ?? "—"} /><Dato etiqueta="Email" valor={alumno.email ?? "—"} /></dl></section><section className="space-y-4 rounded-xl border border-border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Fecha de alta y forma de pago</h4>{puedeEditar && <Button variant="outline" size="sm" onClick={() => editar("pago")}>Editar forma de pago</Button>}</div><dl className="grid gap-4 sm:grid-cols-2"><Dato etiqueta="Fecha de alta" valor={fecha(alumno.created_at)} /><Dato etiqueta="Forma de pago preferida" valor={alumno.forma_pago_preferida ?? "Sin preferencia"} /></dl></section></div> :
              vista?.tipo === "editar" ? <div className="mx-auto max-w-xl space-y-5"><Volver onClick={() => solicitarSalida("ficha")} /><EditarAlumnoForm key={`${alumno.id}-${alumno.version}`} alumno={alumno} formasPagoActivas={formasPagoActivas} dniLongitudMin={dniLongitudMin} dniLongitudMax={dniLongitudMax} onCancelar={volverFicha} onGuardado={volverFicha} /></div> :
              vista?.tipo === "contacto" ? <div className="mx-auto max-w-xl space-y-5"><Volver onClick={() => solicitarSalida("ficha")} /><ContactoAlumnoForm alumnoId={alumno.id} telefonoActual={alumno.telefono} emailActual={alumno.email} onCancelar={volverFicha} onGuardado={volverFicha} /></div> :
              vista?.tipo === "pago" ? <div className="mx-auto max-w-xl space-y-5"><Volver onClick={() => solicitarSalida("ficha")} /><FormaPagoForm alumnoId={alumno.id} formasPagoActivas={formasPagoActivas} formaPagoIdActual={alumno.forma_pago_preferida_id} onCancelar={volverFicha} onGuardado={volverFicha} /></div> : null}
          </div>
          {vista?.tipo === "ficha" && alumno && <footer className="flex shrink-0 justify-end border-t border-border px-5 py-3 sm:px-7"><Button variant="outline" size="sm" onClick={cerrar}>Cerrar</Button></footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmarDescarteDialog abierto={destinoDescarte !== null} onAbiertoChange={(abierto) => { if (!abierto) setDestinoDescarte(null); }} onConfirmar={() => { if (destinoDescarte === "ficha") volverFicha(); else cerrar(); }} />
  </ContextoModal.Provider>;
}

function Volver({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"><ChevronLeft className="size-4" aria-hidden />Volver a la ficha</button>; }
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) { return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{etiqueta}</dt><dd className="mt-1 break-words text-sm font-medium">{valor}</dd></div>; }
