import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { iniciales } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
import { BuscadorAlumnos } from "../buscador-alumnos";

/**
 * Tarjeta «Alumnos inscriptos · N de M» (mockup pág. 5): el listado completo,
 * no solo la ocupación. Con `gestionable` (HU-C-04 §2.5: permiso y turno
 * DISPONIBLE o COMPLETO) conserva el alta y la baja individual: «Agregar
 * alumno» en el encabezado y «Quitar» por fila. Cada acción se aplica en el
 * momento; el estado Disponible ⇄ Completo lo resuelve el servidor.
 */
export function TurnoAlumnosCard({ turno, gestionable, onCambio }: { turno: TurnoDetalle; gestionable: boolean; onCambio: () => Promise<void> }) {
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [errorAlumno, setErrorAlumno] = useState<{ id: string; mensaje: string } | null>(null);
  // Solo se gestiona en turnos DISPONIBLE/COMPLETO, que siempre tienen aula y cupo.
  const cupoAlcanzado = turno.cupo_maximo !== null && turno.alumnos.length >= turno.cupo_maximo;
  const ocupacion = turno.cupo_maximo === null ? "Sin asignar" : `${turno.alumnos.length} de ${turno.cupo_maximo}`;

  const ejecutar = async (clave: string, url: string, init: RequestInit, exito: (estado: string) => string) => {
    setProcesando(clave); setAviso(""); setError(""); setErrorAlumno(null);
    try {
      const respuesta = await fetchAutenticado(url, { ...init, cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        const mensaje = valor?.error?.message ?? "No se pudo actualizar la inscripción";
        const alumnoId = valor?.error?.detalles?.alumno_id;
        if (typeof alumnoId === "string" && turno.alumnos.some(({ id }) => id === alumnoId)) setErrorAlumno({ id: alumnoId, mensaje });
        else setError(mensaje);
        return;
      }
      setAviso(exito(valor.data.estado));
      await onCambio();
    } catch { setError("No se pudo actualizar la inscripción. Intentá nuevamente."); }
    finally { setProcesando(null); }
  };

  const agregar = (alumnoId: string) => ejecutar("agregar", `/api/turnos/${encodeURIComponent(turno.id)}/alumnos`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alumno_id: alumnoId }),
  }, (estado) => estado === "COMPLETO" ? "Alumno agregado. El turno alcanzó su cupo máximo y pasó a Completo." : "Alumno agregado al turno");
  const quitar = (alumnoId: string) => ejecutar(alumnoId, `/api/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumnoId)}`, { method: "DELETE" },
    (estado) => turno.estado === "COMPLETO" && estado === "DISPONIBLE" ? "Alumno quitado. El turno volvió a Disponible." : "Alumno quitado del turno");

  return <section aria-labelledby="inscripciones-titulo" className="space-y-3 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 id="inscripciones-titulo" className="text-sm font-semibold">Alumnos inscriptos <span className="font-normal text-muted-foreground">· {ocupacion}</span></h2>
      {gestionable && <div className="w-full max-w-xs space-y-1"><label htmlFor="agregar-alumno" className="text-xs">Agregar alumno</label>
        <BuscadorAlumnos id="agregar-alumno" excluir={turno.alumnos.map(({ id }) => id)} deshabilitado={cupoAlcanzado || procesando !== null} avisoDeshabilitado={cupoAlcanzado ? "El turno alcanzó su cupo máximo" : undefined} onSeleccionar={(alumno) => void agregar(alumno.id)} />
      </div>}
    </div>
    {turno.alumnos.length === 0 ? <p className="text-sm text-muted-foreground">El turno no tiene alumnos inscriptos.</p> : <ul className="divide-y divide-border border-t border-border" aria-label="Alumnos inscriptos">{turno.alumnos.map((alumno) => {
      const conflicto = errorAlumno?.id === alumno.id ? errorAlumno.mensaje : "";
      return <li key={alumno.id} className={`space-y-1 py-2.5 ${conflicto ? "bg-destructive-soft" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{iniciales(alumno.nombre)}</span>
            <span className="min-w-0 break-words text-sm">{alumno.nombre}</span>
          </span>
          {gestionable && <Button type="button" variant="outline" size="sm" disabled={procesando !== null} onClick={() => void quitar(alumno.id)} aria-label={`Quitar a ${alumno.nombre}`}>{procesando === alumno.id ? "Quitando…" : "Quitar"}</Button>}
        </div>
        {alumno.puede_ver_historial && <Link className="ml-10 inline-flex text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/alumnos/${encodeURIComponent(alumno.id)}?tab=historial&volver=${encodeURIComponent(`/turnos/${turno.id}`)}`} prefetch={false}>Ver historial</Link>}
        {conflicto && <p role="alert" className="text-sm text-destructive">{conflicto}</p>}
      </li>;
    })}</ul>}
    {procesando === "agregar" && <p role="status" className="text-sm text-muted-foreground">Agregando alumno…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {aviso && <p role="status" className="rounded-md bg-success p-3 text-sm text-success-foreground">{aviso}</p>}
  </section>;
}
