"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { desactivarAlumno, reactivarAlumno } from "@/server/alumnos/actions";
import type { ImpactoBajaAlumno } from "@/types/alumno.types";
import { texto } from "@/lib/textos";

export function EstadoAlumnoDialog({ alumno }: { alumno: { id: string; nombre: string; apellido: string; activo: boolean; version: number } }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [impacto, setImpacto] = useState<ImpactoBajaAlumno | null>(null);
  const [motivo, setMotivo] = useState("");

  const iniciar = async () => {
    setMotivo("");
    if (alumno.activo) {
      const respuesta = await fetch(`/api/alumnos/${encodeURIComponent(alumno.id)}/impacto-baja`, { cache: "no-store" });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        toast.error(cuerpo.error?.message ?? texto("ui.alumnos.estado.error"));
        return;
      }
      setImpacto(cuerpo.data);
    }
    setAbierto(true);
  };

  const enviar = async () => {
    const resultado = alumno.activo
      ? await desactivarAlumno(alumno.id, { version: alumno.version, motivo })
      : await reactivarAlumno(alumno.id, { version: alumno.version });
    if (resultado.error) throw new Error(resultado.error.detalles?.motivo?.[0] ?? resultado.error.message);
  };

  return (
    <>
      <Button variant="outline" className={alumno.activo ? "border-destructive text-destructive hover:bg-destructive-soft" : undefined} onClick={iniciar}>
        <Power className="size-4" aria-hidden />
        {texto(alumno.activo ? "ui.alumnos.estado.desactivar" : "ui.alumnos.estado.reactivar")}
      </Button>
      <ConfirmarAccionDialog
        abierto={abierto}
        titulo={texto(alumno.activo ? "ui.alumnos.estado.confirmarBaja" : "ui.alumnos.estado.confirmarReactivacion", { alumno: `${alumno.nombre} ${alumno.apellido}` })}
        detalle={alumno.activo
          ? texto(impacto?.total ? "ui.alumnos.estado.impacto" : "ui.alumnos.estado.sinImpacto", { total: impacto?.total ?? 0 })
          : texto("ui.alumnos.estado.noRestaurar")}
        textoConfirmar={texto(alumno.activo ? "ui.alumnos.estado.desactivar" : "ui.alumnos.estado.reactivar")}
        destructiva={alumno.activo}
        confirmarDeshabilitado={alumno.activo && Boolean(impacto?.motivo_obligatorio) && !motivo.trim()}
        contenido={alumno.activo ? (
          <div className="mt-4 space-y-3">
            {impacto?.inscripciones_futuras.length ? (
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
                {impacto.inscripciones_futuras.map((item) => <li key={item.inscripcion_id}>{item.fecha} · {item.hora_inicio} · {item.materia.nombre} · {item.profesor?.nombre_para_mostrar ?? "Sin profesor"}</li>)}
              </ul>
            ) : null}
            <label htmlFor="motivo-baja-alumno" className="block text-sm font-medium">{texto("ui.alumnos.estado.motivo")}</label>
            <textarea id="motivo-baja-alumno" maxLength={300} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <p className="text-xs text-muted-foreground">{texto(impacto?.motivo_obligatorio ? "ui.alumnos.estado.obligatorio" : "ui.alumnos.estado.opcional")} · {motivo.length}/300</p>
          </div>
        ) : undefined}
        onCerrar={() => setAbierto(false)}
        onConfirmar={enviar}
        onExito={() => {
          toast.success(texto(alumno.activo ? "ui.alumnos.estado.exitoBaja" : "ui.alumnos.estado.exitoReactivacion"));
          setAbierto(false);
          router.refresh();
        }}
      />
    </>
  );
}
