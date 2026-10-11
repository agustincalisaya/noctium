import { texto } from "@/lib/textos";
import { fechaHoraDeInstante } from "@/lib/turno-detalle";
import type { EntradaHistorialIntegrante } from "@/types/personal.types";

/**
 * «Historial de estados» de la ficha del integrante (HU-F-05, figura 93;
 * DEC-37): cada baja o reactivación, del más reciente al más antiguo, con la
 * fecha y hora en la zona del centro (el mismo formato que «Registro»), quien
 * la hizo y el motivo. Misma estructura que el historial del profesor (HU-D-08).
 */
export function HistorialEstadosIntegrante({ historial }: { historial: EntradaHistorialIntegrante[] }) {
  return (
    <section
      aria-labelledby="historial-estados-titulo"
      className="space-y-3 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <h2 id="historial-estados-titulo" className="text-lg font-semibold">
        {texto("ui.personal.historial.titulo")}
      </h2>
      {historial.length === 0 ? (
        <p className="text-sm text-muted-foreground">{texto("ui.personal.historial.vacio")}</p>
      ) : (
        <ol className="divide-y divide-border">
          {historial.map((entrada) => (
            <li key={entrada.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">
                {texto(entrada.accion === "DESACTIVAR" ? "ui.personal.historial.desactivacion" : "ui.personal.historial.reactivacion")}
              </p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={entrada.fecha.toISOString()}>{fechaHoraDeInstante(entrada.fecha.toISOString())}</time>
                {" · "}
                {entrada.usuarioNombre ?? texto("ui.personal.historial.usuario")}
              </p>
              {entrada.motivo && <p className="break-words text-sm">{entrada.motivo}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
