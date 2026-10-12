import { texto } from "@/lib/textos";
import { fechaHoraDeInstante } from "@/lib/turno-detalle";

export function HistorialEstadosAlumno({ historial }: { historial: Awaited<ReturnType<typeof import("@/server/alumnos/alumno.estado.service").obtenerHistorialEstadosAlumno>> }) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-5 text-card-foreground">
      <h2 className="text-lg font-semibold">{texto("ui.alumnos.estado.historial")}</h2>
      {historial.length === 0 ? <p className="text-sm text-muted-foreground">{texto("ui.alumnos.estado.sinHistorial")}</p> : (
        <ol className="divide-y divide-border">
          {historial.map((entrada) => (
            <li key={entrada.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{texto(entrada.accion === "DESACTIVAR" ? "ui.alumnos.estado.baja" : "ui.alumnos.estado.alta")}</p>
              <p className="text-xs text-muted-foreground"><time dateTime={entrada.fecha.toISOString()}>{fechaHoraDeInstante(entrada.fecha.toISOString())}</time>{" · "}{entrada.usuario_nombre ?? texto("ui.alumnos.estado.usuario")}</p>
              {entrada.motivo && <p className="break-words text-sm">{entrada.motivo}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
