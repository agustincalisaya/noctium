"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { BookOpen, CalendarDays, ChevronRight, Hash, Loader2, TriangleAlert, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { useToast } from "@/components/ui/toast";
import { MateriaForm } from "./nueva/materia-form";
import type { MateriaDetalle, MateriaResumen } from "@/types/materia.types";

type Vista = { tipo: "detalle"; materia: MateriaResumen } | { tipo: "crear" } | null;
type PaginacionMaterias = {
  total: number;
  pagina_actual: number;
  total_paginas: number;
  por_pagina: number;
};

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function MateriasInteractivas({
  items,
  paginacion,
  esGerente,
  creada,
}: {
  items: MateriaResumen[];
  paginacion: PaginacionMaterias;
  esGerente: boolean;
  creada: boolean;
}) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const { notificarExito } = useToast();
  const [vista, setVista] = useState<Vista>(null);
  const [detalle, setDetalle] = useState<MateriaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState(false);
  const [reintento, setReintento] = useState(0);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const hayCambios = useRef(false);

  useEffect(() => {
    if (vista?.tipo !== "detalle") return;
    const controller = new AbortController();
    const id = vista.materia.id;

    async function cargar() {
      try {
        const respuesta = await fetch(`/api/materias/${encodeURIComponent(id)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const resultado = (await respuesta.json()) as { data: MateriaDetalle | null };
        if (!respuesta.ok || !resultado.data) throw new Error("No se pudo cargar la materia");
        if (!controller.signal.aborted) setDetalle(resultado.data);
      } catch {
        if (!controller.signal.aborted) setErrorDetalle(true);
      } finally {
        if (!controller.signal.aborted) setCargandoDetalle(false);
      }
    }

    void cargar();
    return () => controller.abort();
  }, [vista, reintento]);

  function cerrar() {
    setVista(null);
    setConfirmarDescarte(false);
    hayCambios.current = false;
    setDirty(false);
  }

  function solicitarCerrar() {
    if (guardando) return;
    if (vista?.tipo === "crear" && hayCambios.current) {
      setConfirmarDescarte(true);
      return;
    }
    cerrar();
  }

  function materiaCreada() {
    cerrar();
    notificarExito("Materia registrada correctamente");
    router.refresh();
  }

  function abrirDetalle(materia: MateriaResumen) {
    setDetalle(null);
    setErrorDetalle(false);
    setCargandoDetalle(true);
    setVista({ tipo: "detalle", materia });
  }

  function reintentarDetalle() {
    setErrorDetalle(false);
    setCargandoDetalle(true);
    setReintento((valor) => valor + 1);
  }

  const total = paginacion.total;

  return (
    <>
      {creada && (
        <p className="mb-5 rounded-lg bg-success px-4 py-3 text-sm font-medium text-success-foreground" role="status">
          Materia registrada correctamente
        </p>
      )}

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Materias</h1>
          <p className="text-sm text-muted-foreground">Consultá las materias y sus profesores asociados.</p>
        </div>
        {esGerente && (
          <Button type="button" onClick={() => setVista({ tipo: "crear" })} className="h-10 self-start px-4 sm:self-auto">
            <BookOpen className="size-4" aria-hidden />
            Nueva materia
          </Button>
        )}
      </div>

      <section aria-label="Listado de materias" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-foreground">
            {total} {total === 1 ? "materia registrada" : "materias registradas"}
          </p>
          {total > 0 && <p className="text-xs text-muted-foreground">Seleccioná una materia para ver sus datos</p>}
          {total > 0 && <p className="w-full text-xs text-muted-foreground sm:hidden">Deslizá la tabla para ver más columnas.</p>}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-primary">
              <BookOpen className="size-6" aria-hidden />
            </span>
            <p className="font-semibold text-foreground">Todavía no hay materias registradas</p>
            <p className="max-w-sm text-sm text-muted-foreground">Registrá una materia para el catálogo del centro.</p>
            {esGerente && <Button type="button" onClick={() => setVista({ tipo: "crear" })} className="mt-2"><BookOpen className="size-4" aria-hidden />Nueva materia</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Nombre</th>
                  <th className="px-5 py-3 text-left font-medium">Código</th>
                  <th className="px-5 py-3 text-left font-medium">Profesores</th>
                  <th className="px-5 py-3 text-left font-medium">Estado</th>
                  <th className="w-12 px-4 py-3"><span className="sr-only">Abrir detalle</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((materia) => (
                  <tr key={materia.id} className="group relative transition-colors hover:bg-accent focus-within:bg-accent">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => abrirDetalle(materia)}
                        className="flex items-center gap-3 text-left font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Ver detalle de ${materia.nombre}`}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary" aria-hidden>
                          <BookOpen className="size-4" />
                        </span>
                        {materia.nombre}
                      </button>
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">{materia.codigo ?? "—"}</td>
                    <td className="px-5 py-3 font-medium tabular-nums text-foreground">{materia.profesores_count}</td>
                    <td className="px-5 py-3">
                      <Badge variant={materia.is_active ? "success" : "muted"}>
                        {materia.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paginacion.total_paginas > 1 && (
          <div className="border-t border-border px-5 py-3">
            <Pagination
              paginaActual={paginacion.pagina_actual}
              totalPaginas={paginacion.total_paginas}
              buildHref={(pagina) => `/materias?pagina=${pagina}`}
            />
          </div>
        )}
      </section>

      <Dialog.Root open={vista !== null} onOpenChange={(abierto) => { if (!abierto) solicitarCerrar(); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/60" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-card p-6 text-card-foreground shadow-2xl sm:p-8">
            <Dialog.Close
              aria-label="Cerrar ventana"
              className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>

            {vista?.tipo === "detalle" && (
              <>
                <div className="mb-7 flex items-start gap-4 pr-10">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <BookOpen className="size-6" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <Dialog.Title className="break-words text-xl font-semibold tracking-tight">{vista.materia.nombre}</Dialog.Title>
                    <Dialog.Description className="text-sm text-muted-foreground">Detalle de la materia</Dialog.Description>
                  </div>
                </div>

                {cargandoDetalle ? (
                  <div className="flex items-center gap-2 border-y border-border py-8 text-sm text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Cargando información
                  </div>
                ) : errorDetalle || !detalle ? (
                  <div className="space-y-3 border-y border-border py-6" role="alert">
                    <p className="text-sm text-destructive">No se pudo cargar el detalle de la materia.</p>
                    <Button type="button" variant="outline" size="sm" onClick={reintentarDetalle}>
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Badge variant={detalle.is_active ? "success" : "muted"} className="mb-6">
                      {detalle.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    <dl className="divide-y divide-border border-y border-border">
                      <div className="flex items-center justify-between gap-4 py-5">
                        <dt className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Hash className="size-4" aria-hidden />
                          Código
                        </dt>
                        <dd className="text-right text-sm font-semibold text-foreground">{detalle.codigo ?? "Sin código"}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 py-5">
                        <dt className="flex items-center gap-3 text-sm text-muted-foreground">
                          <CalendarDays className="size-4" aria-hidden />
                          Fecha de alta
                        </dt>
                        <dd className="text-right text-sm font-medium text-foreground">{formatearFecha(detalle.created_at)}</dd>
                      </div>
                      <div className="py-5">
                        <dt className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
                          <UsersRound className="size-4" aria-hidden />
                          Profesores asociados
                        </dt>
                        <dd className="text-sm text-foreground">
                          {detalle.profesores.length === 0 ? (
                            <span className="text-muted-foreground">Sin profesores asociados</span>
                          ) : (
                            <ul className="flex flex-wrap gap-2">
                              {detalle.profesores.map((profesor) => (
                                <li key={profesor.id} className="rounded-md bg-muted px-3 py-1.5 font-medium">
                                  {profesor.nombre_completo}
                                </li>
                              ))}
                            </ul>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}

                <div className="mt-6 flex justify-end">
                  <Button type="button" variant="outline" onClick={solicitarCerrar}>Cerrar</Button>
                </div>
              </>
            )}

            {vista?.tipo === "crear" && (
              <>
                <div className="mb-7 flex items-start gap-4 pr-10">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <BookOpen className="size-6" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <Dialog.Title className="text-xl font-semibold tracking-tight">Nueva materia</Dialog.Title>
                    <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                      Registrá una materia para el catálogo del centro.
                    </Dialog.Description>
                  </div>
                </div>
                <MateriaForm
                  onCancelar={solicitarCerrar}
                  onCreada={materiaCreada}
                  onCambios={(valor) => { hayCambios.current = valor; }}
                  onGuardando={setGuardando}
                />
              </>
            )}

            <AlertDialog.Root open={confirmarDescarte} onOpenChange={setConfirmarDescarte}>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop forceRender className="fixed inset-0 z-[60] bg-foreground/50" />
                <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 text-card-foreground shadow-2xl">
                  <span className="mb-5 flex size-10 items-center justify-center rounded-lg bg-warning text-warning-foreground">
                    <TriangleAlert className="size-5" aria-hidden />
                  </span>
                  <AlertDialog.Title className="text-lg font-semibold">¿Descartar los datos?</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    La materia nueva no se registrará y se perderá lo que escribiste.
                  </AlertDialog.Description>
                  <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" onClick={() => setConfirmarDescarte(false)}>Seguir editando</Button>
                    <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={cerrar}>
                      Salir sin guardar
                    </Button>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
