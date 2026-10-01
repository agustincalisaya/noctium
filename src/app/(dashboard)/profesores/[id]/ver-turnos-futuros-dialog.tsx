"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/shared/pagination";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { EstadoTurnoBadge } from "@/app/(dashboard)/turnos/estado-turno-badge";
import type { PaginaTurnosFuturos } from "@/types/profesor.types";

const POR_PAGINA = 10; // DESIGN.md §8.1: listas dentro de un modal, de a 10.

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; datos: PaginaTurnosFuturos };

/** "AAAA-MM-DD" → "dd/mm/aaaa", sin pasar por Date (sin corrimiento de zona). */
function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Modal informativo «Ver turnos» (HU-D-07 AC3, DESIGN.md §6.3: excepción del
 * `Dialog` que solo informa una acción rechazada). Se abre solo desde el link
 * del aviso corto; no modifica datos ni dispara toast. Cada apertura y cada
 * cambio de página vuelve a pedir la lista, así, si Mesa canceló turnos en la
 * otra pestaña, ve el N actualizado. Cada turno se abre en una pestaña nueva
 * para no perder los cambios sin guardar de la ficha.
 */
export function VerTurnosFuturosDialog({
  profesorId,
  materia,
  onCerrar,
}: {
  profesorId: string;
  materia: { id: string; nombre: string };
  onCerrar: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const solicitud = useRef(0);

  const cargar = useCallback(
    async (numero: number) => {
      const id = ++solicitud.current;
      setEstado({ tipo: "cargando" });
      try {
        const respuesta = await fetchAutenticado(
          `/api/profesores/${profesorId}/materias/${materia.id}/turnos-futuros?pagina=${numero}`,
          { cache: "no-store" },
        );
        const cuerpo = (await respuesta.json()) as { data: PaginaTurnosFuturos | null };
        if (id !== solicitud.current) return; // llegó tarde: ya se pidió otra página
        if (!respuesta.ok || !cuerpo.data) {
          setEstado({ tipo: "error" });
          return;
        }
        const totalPaginas = Math.max(1, Math.ceil(cuerpo.data.total / POR_PAGINA));
        if (cuerpo.data.items.length === 0 && numero > totalPaginas) {
          // Se resolvieron turnos y la página quedó vacía: ir a la última.
          setPagina(totalPaginas);
          return;
        }
        setEstado({ tipo: "listo", datos: cuerpo.data });
      } catch {
        if (id === solicitud.current) setEstado({ tipo: "error" });
      }
    },
    [profesorId, materia.id],
  );

  useEffect(() => {
    // La carga es la sincronización con el servidor que este efecto representa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar(pagina);
  }, [cargar, pagina]);

  const total = estado.tipo === "listo" ? estado.datos.total : null;

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Turnos futuros de {materia.nombre}</DialogTitle>
          <DialogDescription aria-live="polite">
            {total === null
              ? "Buscando los turnos futuros de esta materia…"
              : total === 0
                ? "El profesor ya no tiene turnos futuros de esta materia. Podés volver a intentar quitarla."
                : `El profesor tiene ${total} turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar.`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {estado.tipo === "cargando" && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Cargando turnos…
            </p>
          )}

          {estado.tipo === "error" && (
            <div role="alert" className="flex flex-wrap items-center gap-3 py-4 text-sm text-destructive">
              <p>No se pudieron cargar los turnos.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void cargar(pagina)}>
                Reintentar
              </Button>
            </div>
          )}

          {estado.tipo === "listo" && estado.datos.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Turnos futuros que impiden quitar la materia</caption>
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Hora</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Aula</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Alumnos inscriptos</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Detalle</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {estado.datos.items.map((turno) => (
                  <tr key={turno.turno_id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatearFecha(turno.fecha)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{turno.hora_inicio}–{turno.hora_fin}</td>
                    <td className="py-2 pr-3">{turno.aula}</td>
                    <td className="py-2 pr-3">{turno.alumnos_inscriptos}</td>
                    <td className="py-2 pr-3"><EstadoTurnoBadge estado={turno.estado} /></td>
                    <td className="py-2 text-right">
                      <a
                        href={`/turnos/${turno.turno_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm whitespace-nowrap text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        Ver detalle
                        <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">(se abre en una pestaña nueva)</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {estado.tipo === "listo" && (
          <Pagination
            paginaActual={estado.datos.pagina}
            totalPaginas={Math.ceil(estado.datos.total / POR_PAGINA)}
            total={estado.datos.total}
            porPagina={POR_PAGINA}
            mostrarRango
            mostrarNumeros
            buildHref={() => "#"}
            onPageChange={setPagina}
          />
        )}

        <DialogFooter>
          <Button type="button" onClick={onCerrar}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
