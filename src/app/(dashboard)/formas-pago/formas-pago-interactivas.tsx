"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { texto } from "@/lib/textos";
import { Pagination } from "@/components/shared/pagination";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import type { ListadoFormasPago } from "@/types/pago.types";

const MENSAJE_EXITO = "Forma de pago registrada correctamente";
const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

type RespuestaAlta = {
  error?: {
    message?: string;
    detalles?: { fieldErrors?: { nombre?: string[] } };
  } | null;
} | null;

/** Mensaje del aviso del modal para un 400 (primer error del campo) o un 409. */
function mensajeDeRechazo(resultado: RespuestaAlta): string | null {
  return resultado?.error?.detalles?.fieldErrors?.nombre?.[0] ?? resultado?.error?.message ?? null;
}

export function FormasPagoInteractivas({ items, paginacion }: ListadoFormasPago) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{texto("ui.formasPago.titulo")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {texto("ui.formasPago.descripcion")}
          </p>
        </div>
        <NuevaFormaPago />
      </div>

      <div className="max-w-[45rem] space-y-2">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="w-[30%] px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {texto("ui.formasPago.nombre")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {texto("ui.formasPago.estado")}
                </th>
                <th className="px-4 py-3"><span className="sr-only">{texto("ui.formasPago.acciones")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((forma) => (
                <tr key={forma.id}>
                  <td className="break-words px-4 py-3 font-medium text-foreground">{forma.nombre}</td>
                  <td className="px-4 py-3">
                    <Badge className="rounded-full" variant={forma.is_active ? "success" : "outline"}>
                      {texto(forma.is_active ? "ui.formasPago.activa" : "ui.formasPago.inactiva")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2"><AccionesFormaPago forma={forma} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          paginaActual={paginacion.pagina_actual}
          totalPaginas={paginacion.total_paginas}
          total={paginacion.total}
          buildHref={(pagina) => `/formas-pago?pagina=${pagina}`}
        />
      </div>
    </div>
  );
}

function NuevaFormaPago() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarAbierto = (siguiente: boolean) => {
    if (enviando) return;
    setAbierto(siguiente);
    if (!siguiente) {
      setNombre("");
      setError(null);
    }
  };

  const registrar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetchAutenticado("/api/formas-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const resultado: RespuestaAlta = await respuesta.json().catch(() => null);

      if (respuesta.status === 201) {
        setAbierto(false);
        setNombre("");
        toast.success(MENSAJE_EXITO);
        router.refresh();
        return;
      }
      const mensaje = respuesta.status === 400 || respuesta.status === 409 ? mensajeDeRechazo(resultado) : null;
      if (mensaje) setError(mensaje);
      else toast.error(MENSAJE_ERROR_COMUNICACION);
    } catch {
      toast.error(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button className="shrink-0" onClick={() => setAbierto(true)}>
        <Plus className="size-4" aria-hidden />
        Nueva forma de pago
      </Button>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent initialFocus={inputRef}>
          <form onSubmit={registrar} noValidate>
            <DialogHeader>
              <DialogTitle>Nueva forma de pago</DialogTitle>
              <DialogDescription>
                Es solo un nombre en el catálogo: no se piden ni guardan datos financieros.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-2">
              <Label htmlFor="nombre-forma-pago">Nombre</Label>
              <Input
                ref={inputRef}
                id="nombre-forma-pago"
                name="nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Ej.: Tarjeta de débito"
                maxLength={40}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => cambiarAbierto(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                Registrar forma de pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}


type Forma = ListadoFormasPago["items"][number];
type Impacto = { alumnos_con_preferida: number; tiene_pagos: boolean; es_ultima_activa: boolean };

async function consultar(url: string, opciones?: RequestInit) {
  let respuesta: Response;
  try { respuesta = await fetchAutenticado(url, opciones); }
  catch { throw new Error(texto("ui.formasPago.errorComunicacion")); }
  const resultado = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajeDeRechazo(resultado) ?? texto("ui.formasPago.errorComunicacion"));
  if (!resultado) throw new Error(texto("ui.formasPago.errorComunicacion"));
  return resultado;
}

function AccionesFormaPago({ forma }: { forma: Forma }) {
  const router = useRouter();
  const [accion, setAccion] = useState<"editar" | "desactivar" | "reactivar" | null>(null);
  const [nombre, setNombre] = useState(forma.nombre);
  const [motivo, setMotivo] = useState("");
  const [impacto, setImpacto] = useState<Impacto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoEdicion, setConfirmandoEdicion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (accion === "desactivar" && impacto) motivoRef.current?.focus();
  }, [accion, impacto]);
  const url = `/api/formas-pago/${encodeURIComponent(forma.id)}`;
  const normalizado = nombre.trim().replace(/\s+/g, " ");
  const consultarImpacto = async () => {
    setCargando(true); setError(null); setImpacto(null);
    try { setImpacto(await consultar(`${url}/impacto`)); }
    catch (causa) { setError(causa instanceof Error ? causa.message : texto("ui.formasPago.errorComunicacion")); }
    finally { setCargando(false); }
  };
  const abrir = (siguiente: typeof accion) => {
    setNombre(forma.nombre); setMotivo(""); setImpacto(null); setError(null);
    setAccion(siguiente);
    if (siguiente === "desactivar") void consultarImpacto();
  };
  const cerrar = () => { setAccion(null); setConfirmandoEdicion(false); };
  const exito = (mensaje: "ui.formasPago.actualizada" | "ui.formasPago.desactivada" | "ui.formasPago.reactivada") => {
    cerrar(); toast.success(texto(mensaje)); router.refresh();
  };
  const enviar = (ruta: string, method: string, body?: unknown) => consultar(ruta, {
    method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  }).then(() => undefined);

  return <>
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
      <Button size="sm" variant="ghost" className="h-8 px-1 text-primary" aria-label={`Editar ${forma.nombre}`} onClick={() => abrir("editar")}>
        <Pencil className="size-3.5" aria-hidden />{texto("ui.formasPago.editar")}
      </Button>
      <Button size="sm" variant="ghost" className="h-8 px-1 text-primary" aria-label={`${forma.is_active ? "Desactivar" : "Reactivar"} ${forma.nombre}`} onClick={() => abrir(forma.is_active ? "desactivar" : "reactivar")}>
        {texto(forma.is_active ? "ui.formasPago.desactivar" : "ui.formasPago.reactivar")}
      </Button>
    </div>
    <Dialog open={accion === "editar" && !confirmandoEdicion} onOpenChange={(open) => { if (!open) cerrar(); }}>
      <DialogContent initialFocus={nombreRef}>
        <form onSubmit={(evento) => { evento.preventDefault(); if (normalizado !== forma.nombre && normalizado.length >= 2 && normalizado.length <= 40) setConfirmandoEdicion(true); }}>
          <DialogHeader><DialogTitle>{texto("ui.formasPago.edicion")}</DialogTitle><DialogDescription>{forma.nombre}</DialogDescription></DialogHeader>
          <div className="mt-4 space-y-2"><Label htmlFor={`nombre-${forma.id}`}>{texto("ui.formasPago.nombre")}</Label>
            <Input ref={nombreRef} id={`nombre-${forma.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} required minLength={2} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>{texto("ui.formasPago.cancelar")}</Button>
            <Button type="submit" disabled={normalizado === forma.nombre || normalizado.length < 2 || normalizado.length > 40}>{texto("ui.formasPago.guardar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmarAccionDialog abierto={confirmandoEdicion} titulo={texto("confirmaciones.formasPago.editar", { nombre: forma.nombre })}
      detalle={normalizado} textoConfirmar={texto("ui.formasPago.guardar")}
      onCerrar={() => setConfirmandoEdicion(false)} onConfirmar={() => enviar(url, "PATCH", { nombre })}
      onExito={() => exito("ui.formasPago.actualizada")} />
    <ConfirmarAccionDialog abierto={accion === "desactivar"} titulo={texto("confirmaciones.formasPago.desactivar", { nombre: forma.nombre })}
      detalle={impacto ? texto("ui.formasPago.impacto", { cantidad: impacto.alumnos_con_preferida }) : texto("ui.formasPago.cargandoImpacto")}
      textoConfirmar={texto("ui.formasPago.desactivar")} destructiva
      className="max-w-[25rem] p-5 [&>h2]:text-base [&>h2]:leading-snug [&>div:first-of-type]:text-xs [&>div:first-of-type]:leading-relaxed [&>div:last-child]:mt-4"
      confirmarDeshabilitado={cargando || !impacto || impacto.es_ultima_activa || (impacto.tiene_pagos && !motivo.trim())}
      contenido={<div className="mt-4 space-y-2">
        {error && <div role="alert" className="text-sm text-destructive-soft-foreground"><p>{error}</p><Button variant="outline" size="sm" onClick={() => void consultarImpacto()}>{texto("ui.formasPago.reintentar")}</Button></div>}
        {impacto?.es_ultima_activa && <p role="alert" className="text-sm text-destructive-soft-foreground">{texto("errores.formaPago.ultimaActiva")}</p>}
        {impacto && <><Label htmlFor={`motivo-${forma.id}`}>{texto("ui.formasPago.motivo")}</Label>
          <textarea ref={motivoRef} id={`motivo-${forma.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} required={impacto.tiene_pagos}
            aria-describedby={`contador-${forma.id}`} placeholder={texto(impacto.tiene_pagos ? "ui.formasPago.motivoObligatorio" : "ui.formasPago.motivoOpcional")}
            className="min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
          <p id={`contador-${forma.id}`} className="text-right text-xs tabular-nums text-muted-foreground">{motivo.length} / 300</p></>}
      </div>}
      onCerrar={cerrar} onConfirmar={() => enviar(`${url}/desactivacion`, "POST", { motivo })} onExito={() => exito("ui.formasPago.desactivada")} />
    <ConfirmarAccionDialog abierto={accion === "reactivar"} titulo={texto("confirmaciones.formasPago.reactivar", { nombre: forma.nombre })}
      textoConfirmar={texto("ui.formasPago.reactivar")} onCerrar={cerrar}
      onConfirmar={() => enviar(`${url}/reactivacion`, "POST")} onExito={() => exito("ui.formasPago.reactivada")} />
  </>;
}
