"use client";

import Link from "next/link";
import { Clock, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatearMonto } from "@/lib/moneda";
import { diaYHoraDeInstanteCentro, formatearFaltan, nombreNatural } from "@/lib/reservas-formato";
import { texto } from "@/lib/textos";
import { diaAbreviadoYFecha } from "@/lib/turno-detalle";
import { cn } from "@/lib/utils";
import type { ReservaPendienteVista, ReservaVencidaVista } from "@/types/reserva.types";

const celda = "px-4 py-3 align-top";
const encabezado = "px-4 py-2 text-xs font-medium uppercase tracking-wide";

/** Columnas comunes de las dos pestañas: alumno, clase (con enlace al detalle) y profesor. */
function CeldaAlumno({ alumno }: { alumno: { nombre_para_mostrar: string; dni: string; reservas_pendientes?: number } }) {
  const pendientes = alumno.reservas_pendientes;
  return (
    <td className={celda}>
      <p className="font-medium text-foreground">{nombreNatural(alumno.nombre_para_mostrar)}</p>
      <p className="font-mono text-xs text-muted-foreground">
        {texto("ui.reservas.dni", { dni: alumno.dni })}
        {pendientes !== undefined && <> · {pendientes === 1 ? texto("ui.reservas.reservaPendiente") : texto("ui.reservas.reservasPendientes", { n: pendientes })}</>}
      </p>
    </td>
  );
}

function CeldaClase({ clase }: { clase: ReservaPendienteVista["clase"] }) {
  const cuando = `${diaAbreviadoYFecha(clase.fecha)} ${clase.hora_inicio}–${clase.hora_fin}`;
  return (
    <td className={celda}>
      <Link href={`/turnos/${clase.turno_id}`} prefetch={false}
        aria-label={texto("ui.reservas.accion.verClase", { materia: clase.materia.nombre, fecha: cuando })}
        className="font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {cuando}
      </Link>
      <p className="text-xs text-muted-foreground">
        {clase.materia.nombre} · {clase.aula?.nombre ?? texto("ui.reservas.sinAsignar")}
      </p>
    </td>
  );
}

function CeldaProfesor({ profesor }: { profesor: ReservaPendienteVista["profesor"] }) {
  return <td className={cn(celda, "text-foreground")}>{profesor ? nombreNatural(profesor.nombre_para_mostrar) : texto("ui.reservas.sinAsignar")}</td>;
}

/**
 * Pestaña «Pendientes» (HU-C-26 criterio 2; foto «Reservas · Pendientes»):
 * vencimiento con cuánto falta (en rojo, con ícono y texto para lectores, si
 * faltan 3 horas o menos), alumno, clase, profesor, precio guardado y las
 * acciones «Registrar pago» (navega a HU-I-10) y «Quitar».
 */
export function TablaPendientes({ items, onQuitar }: { items: ReservaPendienteVista[]; onQuitar: (reserva: ReservaPendienteVista) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{texto("ui.reservas.tabs.pendientes")}</caption>
        <thead className="border-b border-border text-left text-muted-foreground">
          <tr>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.vence")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.alumno")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.clase")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.profesor")}</th>
            <th scope="col" className={cn(encabezado, "text-right")}>{texto("ui.reservas.columna.precio")}</th>
            <th scope="col" className={encabezado}><span className="sr-only">{texto("ui.reservas.columna.acciones")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((reserva) => {
            const alumno = nombreNatural(reserva.alumno.nombre_para_mostrar);
            const materia = reserva.clase.materia.nombre;
            return (
              <tr key={reserva.inscripcion_id} data-vence-pronto={reserva.vence_pronto ? "" : undefined}>
                <td className={cn(celda, "whitespace-nowrap")}>
                  <p className="font-mono text-foreground">{diaYHoraDeInstanteCentro(reserva.vence_el)}</p>
                  {reserva.vence_pronto ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <Clock className="size-3.5" aria-hidden />
                      <span className="sr-only">{texto("ui.reservas.faltan.vencePronto")}: </span>
                      {formatearFaltan(reserva.faltan_min)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{formatearFaltan(reserva.faltan_min)}</p>
                  )}
                </td>
                <CeldaAlumno alumno={reserva.alumno} />
                <CeldaClase clase={reserva.clase} />
                <CeldaProfesor profesor={reserva.profesor} />
                <td className={cn(celda, "whitespace-nowrap text-right font-semibold tabular-nums text-foreground")}>{formatearMonto(reserva.precio)}</td>
                <td className={cn(celda, "whitespace-nowrap")}>
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/pagos/registrar?alumno=${encodeURIComponent(reserva.alumno.id)}&clase=${encodeURIComponent(reserva.clase.turno_id)}`}
                      prefetch={false}
                      aria-label={texto("ui.reservas.accion.registrarPagoDe", { alumno, materia })}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <CreditCard className="size-4" aria-hidden />
                      {texto("ui.reservas.accion.registrarPago")}
                    </Link>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onQuitar(reserva)}
                      aria-label={texto("ui.reservas.accion.quitarA", { alumno, materia })}>
                      {texto("ui.reservas.accion.quitar")}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pestaña «Vencidas · últimos 7 días» (HU-C-26 criterio 3; foto homónima):
 * solo consulta. Estado según DESIGN.md: «Reserva vencida» con el aspecto de
 * «Cancelado» (6.5) y «Vencida · sin marcar todavía» en `warning`.
 */
export function TablaVencidas({ items }: { items: ReservaVencidaVista[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{texto("ui.reservas.tabs.vencidas")}</caption>
        <thead className="border-b border-border text-left text-muted-foreground">
          <tr>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.vencio")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.alumno")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.clase")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.profesor")}</th>
            <th scope="col" className={encabezado}>{texto("ui.reservas.columna.estado")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((reserva) => (
            <tr key={reserva.inscripcion_id}>
              <td className={cn(celda, "whitespace-nowrap font-mono text-foreground")}>{diaYHoraDeInstanteCentro(reserva.vencio_el)}</td>
              <CeldaAlumno alumno={reserva.alumno} />
              <CeldaClase clase={reserva.clase} />
              <CeldaProfesor profesor={reserva.profesor} />
              <td className={celda}>
                {reserva.sin_marcar
                  ? <Badge variant="warning">{texto("ui.reservas.etiqueta.vencidaSinMarcar")}</Badge>
                  : <Badge variant="outline" className="border-destructive bg-card text-destructive">{texto("ui.reservas.etiqueta.vencida")}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
