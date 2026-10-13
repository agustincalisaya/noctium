import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { texto } from "@/lib/textos";
import { formatearDineroHistorial } from "@/lib/pagos-historial-listado";
import type { HistorialPagosData } from "@/types/pago.types";

const dia = (valor: string) => valor.slice(0, 10).split("-").reverse().join("/");
const fechaClase = (valor: string, hora: string) => {
  const semana = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${valor}T12:00:00Z`));
  return `${semana.charAt(0).toUpperCase() + semana.slice(1)} ${dia(valor)} ${hora}`;
};
const fechaHora = (valor: string) => new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date(valor));

export function TablaHistorialPagos({ data, alumnoId, puedeRegistrarPago }: {
  data: HistorialPagosData;
  alumnoId: string;
  puedeRegistrarPago: boolean;
}) {
  const columnasHistorial = [
    texto("ui.pagos.historial.columna.fecha"),
    texto("ui.pagos.historial.columna.clase"),
    texto("ui.pagos.historial.columna.precio"),
    texto("ui.pagos.historial.columna.monto"),
    texto("ui.pagos.historial.columna.forma"),
    texto("ui.pagos.historial.columna.registrado"),
    texto("ui.pagos.historial.columna.comprobante"),
  ];
  const columnasEstado = [
    texto("ui.pagos.historial.columna.fecha"),
    texto("ui.pagos.historial.columna.materia"),
    texto("ui.pagos.historial.columna.profesor"),
    texto("ui.pagos.historial.columna.precio"),
    texto("ui.pagos.historial.columna.estado"),
    texto("ui.pagos.historial.columna.accion"),
  ];
  if (data.modo === "HISTORIAL") return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4">
        <h2 className="text-sm font-semibold">{texto("ui.pagos.historial.titulo")}</h2>
        <p className="text-xs text-muted-foreground">{texto("ui.pagos.historial.total")} <strong className="ml-1 text-foreground">{formatearDineroHistorial(data.total_pagado)}</strong></p>
      </div>
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="border-y border-border text-xs uppercase text-muted-foreground">
          <tr>{columnasHistorial.map((nombre) =>
            <th key={nombre} scope="col" className="px-3 py-3 font-medium">{nombre}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.items.map((pago) => (
            <tr key={pago.pago_id} className={pago.anulado ? "bg-muted/30 text-muted-foreground" : ""}>
              <td className="whitespace-nowrap px-3 py-3 align-top">{dia(pago.fecha_pago)}</td>
              <td className="px-3 py-3 align-top">
                <Link className="font-medium text-primary underline underline-offset-4" href={`/turnos/${encodeURIComponent(pago.clase.turno_id)}`}>
                  {fechaClase(pago.clase.fecha, pago.clase.hora_inicio)} · {pago.clase.materia.nombre}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-3 align-top">{formatearDineroHistorial(pago.precio)}</td>
              <td className="px-3 py-3 align-top">
                <span className={pago.anulado ? "line-through" : "font-medium"}>{formatearDineroHistorial(pago.monto)}</span>
                {pago.anulado && <span className="ml-2 rounded bg-muted px-2 py-1 text-xs">{texto("ui.pagos.historial.anulado")}</span>}
                {pago.ajuste && <p className="mt-1 text-xs text-muted-foreground">
                  {texto("ui.pagos.historial.ajuste", { motivo: pago.ajuste.motivo, actor: pago.ajuste.ajustado_por.nombre_completo ?? "—" })}
                  {pago.monto_original && <span> · {texto("ui.pagos.historial.original", { monto: formatearDineroHistorial(pago.monto_original) })}</span>}
                </p>}
              </td>
              <td className="px-3 py-3 align-top">{pago.forma_pago.nombre}</td>
              <td className="px-3 py-3 align-top">{pago.registrado_por.nombre_completo ?? "—"}
              </td>
              <td className="px-3 py-3 align-top">
                {pago.comprobante ? <Link className="text-primary underline underline-offset-4" href={`/comprobantes/${encodeURIComponent(pago.comprobante.id)}`}>{pago.comprobante.numero}</Link> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>{columnasEstado.map((nombre) =>
            <th key={nombre} scope="col" className="px-3 py-3 font-medium">{nombre}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.items.map((item) => (
            <tr key={item.inscripcion_id}>
              <td className="whitespace-nowrap px-3 py-3"><Link className="text-primary underline underline-offset-4" href={`/turnos/${encodeURIComponent(item.turno_id)}`}>{fechaClase(item.fecha, item.hora_inicio)}</Link></td>
              <td className="px-3 py-3">{item.materia.nombre}</td>
              <td className="px-3 py-3">{item.profesor?.nombre_para_mostrar ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-3">{formatearDineroHistorial(item.precio)}</td>
              <td className="px-3 py-3">
                <Badge variant={item.estado_pago === "PAGADA" ? "success" : item.estado_pago === "RESERVADA" ? "warning" : "outline"}>
                  {texto(item.estado_pago === "PAGADA" ? "ui.pagos.historial.pagada" : item.estado_pago === "RESERVADA" ? "ui.pagos.historial.reservada" : "ui.pagos.historial.sinRegistrar")}
                  {item.estado_pago === "RESERVADA" && item.vence_el && ` · ${texto("ui.pagos.historial.vencimiento", { fecha: fechaHora(item.vence_el) })}`}
                </Badge>
              </td>
              <td className="px-3 py-3">{puedeRegistrarPago && item.puede_registrar_pago &&
                <Link href={`/pagos/registrar?alumno=${encodeURIComponent(alumnoId)}&clase=${encodeURIComponent(item.turno_id)}`}
                  className="inline-flex whitespace-nowrap rounded-md border border-input px-3 py-2 text-xs font-medium hover:bg-muted">
                  {texto("ui.pagos.historial.registrar")}
                </Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
