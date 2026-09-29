"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus } from "lucide-react";
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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Formas de pago</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Catálogo que Mesa de Entradas usa al asociar la forma de pago y registrar pagos de un turno. Es solo un
            nombre: no conecta con ninguna pasarela de pago.
          </p>
        </div>
        <NuevaFormaPago />
      </div>

      <div className="max-w-[45rem] space-y-2">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((forma) => (
                <tr key={forma.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{forma.nombre}</td>
                  <td className="px-4 py-3">
                    <Badge variant={forma.is_active ? "success" : "muted"}>
                      {forma.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
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
