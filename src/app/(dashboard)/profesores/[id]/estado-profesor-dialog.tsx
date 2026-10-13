"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { pedirDatos } from "@/lib/api-estado-profesor";
import { texto } from "@/lib/textos";
import { ResolverClasesProfesorDialog } from "./resolver-clases-profesor-dialog";
import type { obtenerImpactoBajaProfesor } from "@/server/profesores/profesor.estado.service";

type Impacto = Awaited<ReturnType<typeof obtenerImpactoBajaProfesor>>;

export function EstadoProfesorDialog({ profesor }: { profesor: { id: string; nombre: string; apellido: string; activo: boolean; version: number } }) {
  const router = useRouter();
  const [impacto, setImpacto] = useState<Impacto | null>(null);
  const [resolver, setResolver] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iniciar = async () => {
    setError(null); setCargando(true);
    try {
      if (profesor.activo) {
        const datos = await pedirDatos<Impacto>(`/api/profesores/${profesor.id}/impacto-baja`);
        setImpacto(datos); setMotivo("");
        if (datos.clases_futuras.confirmados) setResolver(true); else setConfirmar(true);
      } else setConfirmar(true);
    } catch (causa) { setError(causa instanceof Error ? causa.message : texto("ui.profesores.estado.error")); }
    finally { setCargando(false); }
  };
  const nombre = `${profesor.nombre} ${profesor.apellido}`;
  return <>
    <div className="space-y-2">
      <Button variant="outline" size="sm" className={profesor.activo ? "border-destructive text-destructive hover:bg-destructive-soft hover:text-destructive" : undefined} disabled={cargando} onClick={() => void iniciar()}>
        <Power aria-hidden className="size-4" />{texto(profesor.activo ? "ui.profesores.estado.desactivar" : "ui.profesores.estado.reactivar")}
      </Button>
      {error && <p role="alert" className="max-w-sm text-sm text-destructive">{error}</p>}
    </div>
    <ConfirmarAccionDialog abierto={confirmar}
      titulo={texto(profesor.activo ? "ui.profesores.estado.confirmarBaja" : "ui.profesores.estado.confirmarReactivacion", { profesor: nombre })}
      detalle={profesor.activo ? <>
        <p>{texto(impacto?.tiene_cuenta ? "ui.profesores.estado.impacto" : "ui.profesores.estado.impactoSinCuenta")}</p>
        {Boolean(impacto?.clases_futuras.pendientes) && <p className="mt-2">{texto("ui.profesores.estado.pendientes", { total: impacto!.clases_futuras.pendientes })}</p>}
      </> : texto("ui.profesores.estado.noRestaurar")}
      textoConfirmar={texto(profesor.activo ? "ui.profesores.estado.desactivar" : "ui.profesores.estado.reactivar")}
      destructiva={profesor.activo}
      confirmarDeshabilitado={profesor.activo && Boolean(impacto?.motivo_obligatorio) && !motivo.trim()}
      contenido={profesor.activo ? <div className="mt-4 space-y-2">
        <label htmlFor="motivo-baja-profesor" className="text-sm font-medium">{texto("ui.profesores.estado.motivo")}</label>
        <textarea id="motivo-baja-profesor" autoFocus maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          required={impacto?.motivo_obligatorio} aria-describedby="ayuda-motivo-profesor"
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div id="ayuda-motivo-profesor" className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{texto(impacto?.motivo_obligatorio ? "ui.profesores.estado.obligatorio" : "ui.profesores.estado.opcional")}</span><span>{motivo.length} / 300</span></div>
      </div> : undefined}
      onCerrar={() => setConfirmar(false)}
      onConfirmar={async () => {
        try {
          await pedirDatos(`/api/profesores/${profesor.id}/${profesor.activo ? "desactivar" : "reactivar"}`, profesor.activo ? { motivo, version: impacto?.version ?? profesor.version } : { version: profesor.version });
        } catch (causa) {
          if (causa instanceof Error && "code" in causa && causa.code === "PROFESOR_CON_CLASES_FUTURAS") { setConfirmar(false); setResolver(true); }
          throw causa;
        }
      }}
      onExito={() => {
        toast.success(texto(profesor.activo ? "ui.profesores.estado.exitoBaja" : "ui.profesores.estado.exitoReactivacion"));
        if (!profesor.activo) toast.info(texto("ui.profesores.estado.noRestaurar"));
        router.refresh();
      }} />
    {resolver && <ResolverClasesProfesorDialog profesorId={profesor.id} onCerrar={() => { setResolver(false); setConfirmar(false); router.refresh(); }}
      onDesactivar={() => { setResolver(false); setConfirmar(false); void iniciar(); }} />}
  </>;
}
