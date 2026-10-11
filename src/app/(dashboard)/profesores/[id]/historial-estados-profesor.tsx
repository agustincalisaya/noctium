import { texto } from "@/lib/textos";
import { FichaSeccion } from "./ficha-seccion";
import type { obtenerHistorialEstadosProfesor } from "@/server/profesores/profesor.estado.service";

export function HistorialEstadosProfesor({ historial }: { historial: Awaited<ReturnType<typeof obtenerHistorialEstadosProfesor>> }) {
  return <FichaSeccion titulo={texto("ui.profesores.estado.historial")}>
    {!historial.length ? <p className="text-sm text-muted-foreground">{texto("ui.profesores.estado.sinHistorial")}</p> :
      <ol className="divide-y divide-border">{historial.map((r) => <li key={r.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
        <p className="text-sm font-medium">{texto(r.accion === "DESACTIVAR" ? "ui.profesores.estado.baja" : "ui.profesores.estado.alta")}</p>
        <p className="text-xs text-muted-foreground"><time dateTime={r.fecha.toISOString()}>{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(r.fecha)}</time> · {r.usuario_nombre ?? r.usuario_id ?? texto("ui.profesores.estado.usuario")}</p>
        {r.motivo && <p className="break-words text-sm">{r.motivo}</p>}
      </li>)}</ol>}
  </FichaSeccion>;
}
